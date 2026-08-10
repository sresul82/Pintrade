/**
 * Kom1Scanner — Kombinasyon 1 sinyal motoru.
 *
 * gorevler3.md Görev 2+3 (2026-08-09). Kaynak kural:
 * dokumentasyon/gorevler/sinyal-sistemi-pintrade-entegrasyon.md §2.
 *
 * BU TURUN KAPSAMI: büyük TF (1H/4H) tespiti + 5dk onay penceresi.
 * Onaylanan sinyal `_confirmed` listesine yazılır ve `kom1:signalConfirmed`
 * event'i yayınlanır (Görev 4, `alarm-signal-history.js` bunu dinleyip
 * Watchlist'in Kom1 grubuna ve alarm sekmesine yazıyor).
 *
 * Kural (büyük TF, 1H veya 4H):
 *   - price <= RC_mid (Regression Channel, 100 bar)
 *   - WT1 bir önceki bar'da oversold'du (WT1 < -53)
 *   - WT1 bu barda WT2'yi yukarı kesti (bullCross)
 *
 * Kural (küçük TF, 5dk — büyük TF sinyalinden sonra TOLERANCE_BARS=3
 * büyük TF barı içinde gerçekleşmeli):
 *   - Heikin Ashi mumu yeşil (ha_close >= ha_open)
 *   - HA kapanışı DEMA9'un üzerinde (ha_close > dema9)
 * İkisi birleşince Long sinyali KESİNLEŞİR.
 *
 * 5dk aboneliği KALICI DEĞİL — sadece büyük TF sinyali ateşlenmiş
 * (pending'de) bir coin için açılır, onay gelince veya pencere
 * kapanınca hemen kapatılır ("iki katmanlı tarama" mimari kararı,
 * gorevler3.md — stream limitini düşük tutmak için).
 *
 * Mimari: M1HammerScanner'ın aynı örüntüsü — BotEngine.queueRestRequest()
 * ile tek seferlik backfill, sonra MarketDataStore.subscribeKlines()
 * paylaşılan WS'i. Kendi ayrı fetch/WS döngüsü açmaz.
 *
 * Coin evreni: 11 coin, gorevler3.md'de kullanıcı onaylı sabit liste
 * (tüm piyasaya dinamik ATR taraması ile genişletme Görev 6 — ayrı,
 * kullanıcı onayı gerektiren bir adım).
 */
const Kom1Scanner = (() => {

  const WT_THRESHOLD   = -53;   // Sabit — gorevler3.md kararı (yapılandırılabilir değil, şimdilik)
  const RC_LENGTH       = 100;   // Regression Channel uzunluğu (bar)
  const TOLERANCE_BARS  = 3;     // Büyük TF sinyalinden sonra 5dk onayı bekleme penceresi (büyük TF bar sayısı)
  const SMALL_TF        = '5m';  // Küçük TF onay penceresi
  const DEMA_PERIOD     = 9;
  const SMALL_TF_BARS   = 40;    // DEMA9 için yeterli pay (min ~18 gerekir)
  const CONFIRMED_CAP   = 200;   // getConfirmedSignals() listesi sınırsız büyümesin

  // 11 coin — sinyal-sistemi-pintrade-entegrasyon.md'de ismi geçen,
  // backtest'te test edilmiş ve iyi performans göstermiş coinler.
  const SYMBOLS = [
    'ONDOUSDT', 'STRKUSDT', 'ENAUSDT', 'BIOUSDT', 'JUPUSDT',
    'TUSDT', 'AEVOUSDT', 'MOVEUSDT', 'VANRYUSDT', 'BERAUSDT', 'HYPEUSDT',
  ];
  const BIG_TFS = ['1h', '4h'];

  // RC(100) en büyük ihtiyaç — WT'nin kendi payıyla (chLen+avgLen+5=36) birlikte
  // rahat bir pay bırakıyoruz.
  const BARS       = RC_LENGTH + 30;
  const BUFFER_CAP = BARS + 20;

  let _started = false;
  let _stopped = true;

  // Buffer: "SYM_tf" -> { opens:[], highs:[], lows:[], closes:[] }
  const _buf = new Map();
  function _bufKey(sym, tf) { return `${sym}_${tf}`; }
  function _getBuf(sym, tf) {
    const k = _bufKey(sym, tf);
    if (!_buf.has(k)) _buf.set(k, { opens: [], highs: [], lows: [], closes: [] });
    return _buf.get(k);
  }
  function _pushBar(sym, tf, o, h, l, c) {
    const b = _getBuf(sym, tf);
    b.opens.push(o); b.highs.push(h); b.lows.push(l); b.closes.push(c);
    if (b.closes.length > BUFFER_CAP) { b.opens.shift(); b.highs.shift(); b.lows.shift(); b.closes.shift(); }
  }

  function _hlc3(b) {
    return b.closes.map((c, i) => (b.highs[i] + b.lows[i] + c) / 3);
  }

  // Kaç final bar geldiğini sayar (TOLERANCE_BARS penceresini kapatmak için) —
  // Görev 3, 5dk onayı bu sayaçla karşılaştırarak pencerenin dolup dolmadığına bakacak.
  const _barCount = new Map(); // "SYM_tf" -> number

  // Büyük TF sinyali ateşlenip 5dk onayı bekleyen coin+TF'ler.
  // "SYM_tf" -> { symbol, bigTf, direction:'bull', rcMid, wtVal, firedAtBarCount, expiresAtBarCount, firedAt }
  const _pending = new Map();

  function getPendingSignals() {
    return [..._pending.values()];
  }

  // ── Küçük TF (5dk) — SADECE pending'de bekleyen coinler için, kalıcı değil ──
  const _smallBuf     = new Map(); // "SYM_5m" -> { opens, highs, lows, closes }
  const _smallActive  = new Set(); // hangi semboller için 5dk aboneliği açık

  // Onaylanmış (kesinleşmiş) Long sinyalleri — en yeni başta.
  const _confirmed = [];
  function getConfirmedSignals() {
    return _confirmed.slice();
  }

  // ── Binance kline REST — SADECE tek seferlik backfill, BotEngine kuyruğu
  //    üzerinden (M1HammerScanner ile aynı örüntü/proxy). ──────────────
  async function fetchKlines(symbol, interval, limit) {
    const base = (typeof AppConfig !== 'undefined' && AppConfig?.API?.binance?.restFutures)
      || 'https://pintrade-uwg9.onrender.com/api/binance/futures';
    const url = `${base}/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=${limit}&_t=${Date.now()}`;
    const res = await fetch(url);
    if (res.status === 429 || res.status === 418) throw new Error(`BAN_SIGNAL_${res.status}`);
    if (!res.ok) throw new Error(`kline fetch failed: ${symbol} ${interval} (HTTP ${res.status})`);
    return res.json();
  }

  async function _backfill() {
    const total = SYMBOLS.length * BIG_TFS.length;
    console.log(`[Kom1Scanner] Büyük TF backfill başlıyor — ${total} REST isteği (BotEngine kuyruğu üzerinden).`);
    let ok = 0;

    for (const sym of SYMBOLS) {
      for (const tf of BIG_TFS) {
        try {
          const kl = await BotEngine.queueRestRequest(() => fetchKlines(sym, tf, BARS));
          const b = _getBuf(sym, tf);
          b.opens  = kl.map(k => parseFloat(k[1]));
          b.highs  = kl.map(k => parseFloat(k[2]));
          b.lows   = kl.map(k => parseFloat(k[3]));
          b.closes = kl.map(k => parseFloat(k[4]));
          _barCount.set(_bufKey(sym, tf), b.closes.length);
          ok++;
        } catch (err) {
          if (String(err.message).startsWith('BAN_SIGNAL')) {
            console.error(`[Kom1Scanner] ⛔⛔⛔ BAN/RATE-LIMIT sinyali (${err.message}) — backfill DURDURULDU. Devam etmeden önce durumu bildir.`);
            stop();
            return false;
          }
          console.warn(`[Kom1Scanner] Backfill hata (${sym} ${tf}):`, err.message);
        }
      }
    }

    console.log(`[Kom1Scanner] Backfill tamam — ${ok}/${total} istek başarılı.`);
    return true;
  }

  /** Büyük TF kuralını kontrol eder — koşul sağlanırsa _pending'e yazar. */
  function _checkBigTF(sym, tf) {
    const b = _getBuf(sym, tf);
    if (b.closes.length < RC_LENGTH + 5) return; // yeterli geçmiş yok

    const rc = IndicatorEngine.calcRegressionChannel(b.closes, RC_LENGTH);
    if (!rc) return;

    const wt = IndicatorEngine.calcWT(_hlc3(b));
    if (!wt || wt.dir !== 'bull') return;        // cross yok veya bear cross
    if (wt.prev >= WT_THRESHOLD) return;          // önceki bar oversold değildi

    const price = b.closes[b.closes.length - 1];
    if (price > rc.mid) return;                   // fiyat RC orta bandının üstünde

    // Kural sağlandı — pending'e yaz (Görev 3'ün 5dk onay penceresi bunu kullanacak).
    const key = _bufKey(sym, tf);
    const barCount = _barCount.get(key) || 0;
    const entry = {
      symbol: sym,
      bigTf: tf,
      direction: 'bull',
      rcMid: rc.mid,
      wtVal: wt.val,
      wtPrev: wt.prev,
      price,
      firedAtBarCount: barCount,
      expiresAtBarCount: barCount + TOLERANCE_BARS,
      firedAt: Date.now(),
    };
    _pending.set(key, entry);
    console.log(`[Kom1Scanner] Büyük TF sinyali ateşlendi: ${sym} ${tf} — fiyat=${price}, RC_mid=${rc.mid.toFixed(4)}, WT prev=${wt.prev}→cur=${wt.val}. 5dk onay penceresi açıldı (${TOLERANCE_BARS} ${tf} bar).`);

    // 5dk onay penceresi için bu coin'e hedefli abone ol (kalıcı değil).
    _ensureSmallTFSubscription(sym).catch(err => {
      console.warn(`[Kom1Scanner] 5dk aboneliği başlatılamadı (${sym}):`, err.message);
    });
  }

  /** Süresi geçmiş (TOLERANCE_BARS penceresi kapanmış, onay gelmemiş) pending'leri temizler. */
  function _sweepExpired(sym, tf) {
    const key = _bufKey(sym, tf);
    const entry = _pending.get(key);
    if (!entry) return;
    const barCount = _barCount.get(key) || 0;
    if (barCount > entry.expiresAtBarCount) {
      _pending.delete(key);
      console.log(`[Kom1Scanner] Pencere kapandı, onay gelmedi: ${sym} ${tf} — sinyal iptal.`);
      _releaseSmallTFSubscription(sym); // bu coin için başka pending kalmadıysa 5dk aboneliğini kapat
    }
  }

  /** Bu sembol için hâlâ pending bir büyük TF girişi var mı? */
  function _hasPending(sym) {
    for (const entry of _pending.values()) if (entry.symbol === sym) return true;
    return false;
  }

  // ── Küçük TF (5dk) yönetimi ─────────────────────────────────────────
  function _getSmallBuf(sym) {
    const k = _bufKey(sym, SMALL_TF);
    if (!_smallBuf.has(k)) _smallBuf.set(k, { opens: [], highs: [], lows: [], closes: [] });
    return _smallBuf.get(k);
  }
  function _pushSmallBar(sym, o, h, l, c) {
    const b = _getSmallBuf(sym);
    b.opens.push(o); b.highs.push(h); b.lows.push(l); b.closes.push(c);
    const cap = SMALL_TF_BARS + 20;
    if (b.closes.length > cap) { b.opens.shift(); b.highs.shift(); b.lows.shift(); b.closes.shift(); }
  }

  async function _ensureSmallTFSubscription(sym) {
    if (_smallActive.has(sym)) return; // zaten aktif
    _smallActive.add(sym);
    try {
      const kl = await BotEngine.queueRestRequest(() => fetchKlines(sym, SMALL_TF, SMALL_TF_BARS));
      const b = _getSmallBuf(sym);
      b.opens  = kl.map(k => parseFloat(k[1]));
      b.highs  = kl.map(k => parseFloat(k[2]));
      b.lows   = kl.map(k => parseFloat(k[3]));
      b.closes = kl.map(k => parseFloat(k[4]));
    } catch (err) {
      if (String(err.message).startsWith('BAN_SIGNAL')) {
        console.error(`[Kom1Scanner] ⛔ BAN sinyali (5dk backfill, ${sym}) — Kom1Scanner durduruluyor.`);
        stop();
        return;
      }
      console.warn(`[Kom1Scanner] 5dk backfill hatası (${sym}):`, err.message);
      // Backfill başarısız olsa bile abone ol — canlı barlar birikip DEMA9 için
      // yeterli geçmiş oluşunca onay kontrolü zaten devreye girer.
    }
    MarketDataStore.subscribeKlines(sym, SMALL_TF, _onSmallTFBar);
    console.log(`[Kom1Scanner] 5dk onay aboneliği açıldı: ${sym}`);
  }

  /** Bu coin için hiç pending kalmadıysa 5dk aboneliğini kapatır. */
  function _releaseSmallTFSubscription(sym) {
    if (_hasPending(sym)) return; // başka bir bigTf hâlâ bekliyor olabilir
    if (!_smallActive.has(sym)) return;
    MarketDataStore.unsubscribeKlines(sym, SMALL_TF, _onSmallTFBar);
    _smallActive.delete(sym);
    _smallBuf.delete(_bufKey(sym, SMALL_TF));
    console.log(`[Kom1Scanner] 5dk onay aboneliği kapatıldı: ${sym}`);
  }

  /** Küçük TF onay kuralını kontrol eder — sağlanırsa bu coin için pending
   *  olan TÜM büyük TF girişlerini (1H ve/veya 4H aynı anda bekliyor olabilir)
   *  onaylayıp _confirmed'e taşır. */
  function _checkSmallTFConfirmation(sym) {
    const b = _smallBuf.get(_bufKey(sym, SMALL_TF));
    if (!b || b.closes.length < DEMA_PERIOD * 2) return;

    const ha   = IndicatorEngine.calcHeikinAshi(b.opens, b.highs, b.lows, b.closes);
    const dema = IndicatorEngine.calcDEMA(b.closes, DEMA_PERIOD);
    if (!ha || dema === null) return;
    if (!(ha.haClose >= ha.haOpen && ha.haClose > dema)) return; // onay koşulu sağlanmadı

    let confirmedAny = false;
    for (const [key, entry] of [..._pending.entries()]) {
      if (entry.symbol !== sym) continue;
      const barCount = _barCount.get(_bufKey(entry.symbol, entry.bigTf)) || 0;
      if (barCount > entry.expiresAtBarCount) continue; // pencere zaten kapanmış (sweep henüz uğramamış olabilir)

      _pending.delete(key);
      const confirmed = {
        ...entry,
        haOpen: ha.haOpen, haClose: ha.haClose, dema9: dema,
        confirmedAt: Date.now(),
      };
      _confirmed.unshift(confirmed);
      if (_confirmed.length > CONFIRMED_CAP) _confirmed.length = CONFIRMED_CAP;
      confirmedAny = true;
      console.log(`[Kom1Scanner] ✅ LONG SİNYALİ KESİNLEŞTİ: ${sym} (büyük TF: ${entry.bigTf}, RC_mid=${entry.rcMid.toFixed(4)}, HA close=${ha.haClose.toFixed(4)} > DEMA9=${dema.toFixed(4)})`);
      if (typeof EventBus !== 'undefined') {
        EventBus.emit('kom1:signalConfirmed', { symbol: sym, bigTf: entry.bigTf, confirmedAt: confirmed.confirmedAt });
      }
    }
    if (confirmedAny) _releaseSmallTFSubscription(sym);
  }

  function _onSmallTFBar(bar) {
    if (!bar.isFinal || bar.interval !== SMALL_TF) return;
    _pushSmallBar(bar.symbol, bar.open, bar.high, bar.low, bar.close);
    _checkSmallTFConfirmation(bar.symbol);
  }

  // ── Görev 5 mimari kuralı: kendi WS'imiz yok — MarketDataStore'un
  //    paylaşılan kline stream'ine abone oluyoruz. ─────────────────────
  function _onKlineBar(bar) {
    if (!bar.isFinal) return; // sadece kapanan bar işlenir
    const key = _bufKey(bar.symbol, bar.interval);
    _pushBar(bar.symbol, bar.interval, bar.open, bar.high, bar.low, bar.close);
    _barCount.set(key, (_barCount.get(key) || 0) + 1);
    _sweepExpired(bar.symbol, bar.interval);
    _checkBigTF(bar.symbol, bar.interval);
  }

  function _subscribeAll() {
    SYMBOLS.forEach(sym => {
      BIG_TFS.forEach(tf => MarketDataStore.subscribeKlines(sym, tf, _onKlineBar));
    });
    console.log(`[Kom1Scanner] MarketDataStore kline stream'ine abone olundu (${SYMBOLS.length * BIG_TFS.length} stream, ${SYMBOLS.join(', ')})`);
  }

  function _unsubscribeAll() {
    SYMBOLS.forEach(sym => {
      BIG_TFS.forEach(tf => MarketDataStore.unsubscribeKlines(sym, tf, _onKlineBar));
    });
  }

  async function start() {
    if (_started) { console.log('[Kom1Scanner] zaten çalışıyor.'); return; }
    _started = true;
    _stopped = false;

    console.log(`[Kom1Scanner] Başlıyor — ${SYMBOLS.length} coin × ${BIG_TFS.join('/')}: ${SYMBOLS.join(', ')}`);

    const backfillOk = await _backfill();
    if (!backfillOk) { _started = false; return; }

    // Backfill sonrası mevcut geçmişte zaten sağlanan bir kural var mı diye
    // bir kere kontrol et (canlı ilk bar gelene kadar beklemeye gerek yok).
    SYMBOLS.forEach(sym => BIG_TFS.forEach(tf => _checkBigTF(sym, tf)));

    _subscribeAll();
  }

  function stop() {
    _stopped = true;
    _started = false;
    _unsubscribeAll();
    // Açık kalmış tüm hedefli 5dk aboneliklerini de kapat (sızıntı olmasın).
    [..._smallActive].forEach(sym => {
      MarketDataStore.unsubscribeKlines(sym, SMALL_TF, _onSmallTFBar);
    });
    _smallActive.clear();
    _smallBuf.clear();
    console.log('[Kom1Scanner] Durduruldu.');
  }

  return { start, stop, getPendingSignals, getConfirmedSignals };
})();

window.Kom1Scanner = Kom1Scanner;
