/**
 * Kom1Scanner — Kombinasyon 1 sinyal motoru, büyük zaman dilimi tespiti.
 *
 * gorevler3.md Görev 2 (2026-08-09). Kaynak kural:
 * dokumentasyon/gorevler/sinyal-sistemi-pintrade-entegrasyon.md §2.
 *
 * BU TURUN KAPSAMI: sadece büyük TF (1H/4H) sinyalini tespit eder ve
 * "TOLERANCE_BARS penceresi açık" durumunu bir Map'te tutar. Henüz
 * Watchlist/alarm'a yazmaz (Görev 4), henüz 5dk onayını kontrol etmez
 * (Görev 3) — sadece büyük TF'in kendisi doğru çalışıyor mu görmek için.
 *
 * Kural (büyük TF, 1H veya 4H):
 *   - price <= RC_mid (Regression Channel, 100 bar)
 *   - WT1 bir önceki bar'da oversold'du (WT1 < -53)
 *   - WT1 bu barda WT2'yi yukarı kesti (bullCross)
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
    }
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
    console.log('[Kom1Scanner] Durduruldu.');
  }

  return { start, stop, getPendingSignals };
})();

window.Kom1Scanner = Kom1Scanner;
