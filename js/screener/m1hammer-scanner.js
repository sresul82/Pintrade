/**
 * M1HammerScanner
 *
 * FAZ 1 (Görev 4, 2026-08-07) — REST polling'den WebSocket'e taşındı.
 * Eskiden 5 dakikada bir ~500 sembol × 5 timeframe = ~2500 REST isteği
 * atıyordu (IP ban sebebiydi, 34 saniyede banlanmıştı). Şimdi:
 *   - Sadece TEST_SYMBOLS'taki küçük, sabit bir sembol kümesi taranıyor.
 *   - Geçmiş veri (BARS kadar mum) tek seferlik REST backfill ile çekilir,
 *     ortak BotEngine.queueRestRequest() kuyruğu üzerinden (Görev 5).
 *   - Ondan sonra canlı güncellemeler MarketDataStore'un paylaşılan kline
 *     WebSocket'inden gelir (Görev 5) — kendi ayrı bağlantımız yok artık,
 *     REST'e bir daha dönülmüyor.
 * Binance'te FR'deki gibi "tüm market" kline stream'i YOK — her sembol×tf
 * için ayrı stream adı gerekiyor (sym@kline_5m). Bu yüzden tüm piyasaya
 * (~500 sembol) genişlemek MarketDataStore'un paylaşılan bağlantısında bile
 * pratik değil (200 stream/bağlantı sınırı) — bu, ayrı bir "Faz 2" kararı,
 * kullanıcı onayı olmadan TEST_SYMBOLS büyütülmemeli.
 *
 * Sinyal kriteri: 5m RSI < 30 (bull) veya > 70 (bear) ZORUNLU.
 * Timeframe'ler: 5m, 15m, 1h, 4h, 1D
 * WT: 5m/15m/1h/4h/1D — cross olduğunda değer gelir, yoksa null
 *
 * NOT: calcSRSI hâlâ O(n²) (bkz. calcRSI'yi döngü içinde tekrar tekrar
 * çağırması) — 8 sembolde maliyeti önemsiz, ama TEST_SYMBOLS tüm markete
 * genişlerse (Faz 2) önce bu optimize edilmeli.
 */
const M1HammerScanner = (() => {

  const RSI_PERIOD  = 14;
  const SRSI_PERIOD = 14;
  const SRSI_K      = 3;
  const SRSI_D      = 3;
  const WT_CH_LEN   = 10;  // Channel Length
  const WT_AVG_LEN  = 21;  // Average Length
  const MAX_SIGNALS = 500;

  // Her timeframe için gereken minimum bar sayısı + pay.
  const BARS       = RSI_PERIOD * 2 + SRSI_K + SRSI_D + WT_CH_LEN + WT_AVG_LEN + 10;
  const BUFFER_CAP = BARS + 20; // canlı akışta buffer bu boyutu aşmasın

  // ⚠️ Faz 1 test kümesi — 8 yüksek hacimli coin. Görev 4'ün "küçük alt
  // kümeyle başla, IP ban kontrolü yaparak genişlet" talimatı gereği burada
  // sabit tutuluyor. Genişletme ayrı bir kullanıcı onayı ister.
  const TEST_SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT', 'ADAUSDT', 'LINKUSDT'];
  const TIMEFRAMES   = ['5m', '15m', '1h', '4h', '1d'];

  let _started    = false;
  let _stopped    = true;

  // Buffer: "SYM_tf" -> { closes:[], highs:[], lows:[] }
  const _buf = new Map();
  function _bufKey(sym, tf) { return `${sym}_${tf}`; }
  function _getBuf(sym, tf) {
    const k = _bufKey(sym, tf);
    if (!_buf.has(k)) _buf.set(k, { closes: [], highs: [], lows: [] });
    return _buf.get(k);
  }
  function _pushBar(sym, tf, h, l, c) {
    const b = _getBuf(sym, tf);
    b.closes.push(c); b.highs.push(h); b.lows.push(l);
    if (b.closes.length > BUFFER_CAP) { b.closes.shift(); b.highs.shift(); b.lows.shift(); }
  }

  // RSI/StochRSI/WaveTrend hesaplamaları gorevler3.md Görev 1'de
  // js/screener/indicator-engine.js'e TAŞINDI (kopyalanmadı) — tek kaynak,
  // chart ve gelecekteki Kom1Scanner de aynı fonksiyonları kullanacak.
  // Davranış birebir aynı, sadece çağrı yeri değişti: calcRSI(closes) →
  // IndicatorEngine.calcRSI(closes) (varsayılan period=14 aynı).
  const calcRSI  = (closes) => IndicatorEngine.calcRSI(closes, RSI_PERIOD);
  const calcSRSI = (closes) => IndicatorEngine.calcSRSI(closes, RSI_PERIOD, SRSI_K, SRSI_D);
  const calcWT   = (hlc3Arr) => IndicatorEngine.calcWT(hlc3Arr, WT_CH_LEN, WT_AVG_LEN);

  function _hlc3(b) {
    return b.closes.map((c, i) => (b.highs[i] + b.lows[i] + c) / 3);
  }

  // Binance kline REST — SADECE tek seferlik backfill için, proxy üzerinden
  // (server.js CORS proxy'si — doğrudan fapi.binance.com'a gitmiyoruz).
  async function fetchKlines(symbol, interval, limit) {
    const base = (typeof AppConfig !== 'undefined' && AppConfig?.API?.binance?.restFutures)
      || 'https://pintrade-uwg9.onrender.com/api/binance/futures';
    const url = `${base}/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=${limit}&_t=${Date.now()}`;
    const res = await fetch(url);
    if (res.status === 429 || res.status === 418) {
      throw new Error(`BAN_SIGNAL_${res.status}`);
    }
    if (!res.ok) throw new Error(`kline fetch failed: ${symbol} ${interval} (HTTP ${res.status})`);
    return res.json();
  }

  /** Tek seferlik geçmiş veri doldurma. TEST_SYMBOLS × TIMEFRAMES kadar
   *  istek atar (8×5=40), BotEngine'in paylaşılan kuyruğu üzerinden (Görev 5)
   *  — diğer botlarla aynı rate-limit bütçesini paylaşır. 429/418 görürse
   *  BotEngine kuyruğu TÜM botlar için duraklar, biz de hemen dururuz. */
  async function _backfill() {
    const total = TEST_SYMBOLS.length * TIMEFRAMES.length;
    console.log(`[M1Hammer] Backfill başlıyor — ${total} REST isteği (tek seferlik, ortak BotEngine kuyruğu üzerinden, sonrası WS).`);
    let ok = 0;

    for (const sym of TEST_SYMBOLS) {
      for (const tf of TIMEFRAMES) {
        try {
          const kl = await BotEngine.queueRestRequest(() => fetchKlines(sym, tf, BARS));
          const b = _getBuf(sym, tf);
          b.closes = kl.map(k => parseFloat(k[4]));
          b.highs  = kl.map(k => parseFloat(k[2]));
          b.lows   = kl.map(k => parseFloat(k[3]));
          ok++;
        } catch (err) {
          if (String(err.message).startsWith('BAN_SIGNAL')) {
            console.error(`[M1Hammer] ⛔⛔⛔ BAN/RATE-LIMIT sinyali (${err.message}) — backfill DURDURULDU (BotEngine kuyruğu tüm botlar için duraklatıldı). Muhtemel VPN paylaşımlı IP etkisi. M1HammerScanner.stop() zaten çağrıldı, devam etmeden önce durumu bildir.`);
            stop();
            return false;
          }
          console.warn(`[M1Hammer] Backfill hata (${sym} ${tf}):`, err.message);
        }
      }
    }

    console.log(`[M1Hammer] Backfill tamam — ${ok}/${total} istek başarılı.`);
    return true;
  }

  function getFRMap() {
    const map = {};
    try {
      const signals = typeof scalpFRMonitor !== 'undefined'
        ? scalpFRMonitor.getSignals?.() || []
        : [];
      signals.forEach(s => { map[s.symbol] = s.currentFR; });
    } catch (e) {}
    return map;
  }

  function _computeSignal(sym) {
    const c5  = _getBuf(sym, '5m');
    const c15 = _getBuf(sym, '15m');
    const c1h = _getBuf(sym, '1h');
    const c4h = _getBuf(sym, '4h');
    const c1d = _getBuf(sym, '1d');

    const rsi5m = calcRSI(c5.closes);
    if (rsi5m === null) return null;
    const isBull = rsi5m < 30;
    const isBear = rsi5m > 70;
    if (!isBull && !isBear) return null; // 5m RSI zorunlu kriteri

    const rsi15m = calcRSI(c15.closes);
    const rsi1h  = calcRSI(c1h.closes);
    const rsi4h  = calcRSI(c4h.closes);
    const rsi1d  = calcRSI(c1d.closes);

    const srsi5m  = calcSRSI(c5.closes);
    const srsi15m = calcSRSI(c15.closes);
    const srsi1h  = calcSRSI(c1h.closes);
    const srsi4h  = calcSRSI(c4h.closes);

    const wt5m  = calcWT(_hlc3(c5));
    const wt15m = calcWT(_hlc3(c15));
    const wt1h  = calcWT(_hlc3(c1h));
    const wt4h  = calcWT(_hlc3(c4h));
    const wt1d  = calcWT(_hlc3(c1d));

    const wtDirection = isBull ? 'bull' : 'bear';

    const currentPrice = c5.closes[c5.closes.length - 1];
    const prevPrice    = c5.closes[c5.closes.length - 2];
    const boostValue   = prevPrice ? ((currentPrice - prevPrice) / prevPrice) * 100 : 0;

    return {
      symbol: sym,
      exchange: 'bn',
      boostValue,
      currentPrice,
      prevPrice,
      fr: getFRMap()[sym] ?? null,
      rsi5m,  rsi15m, rsi1h,  rsi4h,  rsi1d,
      srsi5m, srsi15m, srsi1h, srsi4h,
      wt5m:  wt5m  ? wt5m.val  : null,
      wt15m: wt15m ? wt15m.val : null,
      wt1h:  wt1h  ? wt1h.val  : null,
      wt4h:  wt4h  ? wt4h.val  : null,
      wt1d:  wt1d  ? wt1d.val  : null,
      wtDirection,
      timestamp: Date.now(),
    };
  }

  function _upsertSignal(sig) {
    const existing = Array.isArray(window.m1HammerSignals) ? window.m1HammerSignals : [];
    const idx = existing.findIndex(s => s.symbol === sig.symbol);
    if (idx >= 0) existing[idx] = sig; else existing.unshift(sig);
    window.m1HammerSignals = existing.slice(0, MAX_SIGNALS);
    if (window.BotSignalsPanel) BotSignalsPanel.render();
  }

  // Görev 5: kendi özel WS bağlantımız yok artık — MarketDataStore'un
  // paylaşılan kline stream'ine abone oluyoruz. Reconnect/backoff mantığı
  // da MarketDataStore tarafında merkezi olarak yönetiliyor.
  function _onKlineBar(bar) {
    if (!bar.isFinal) return; // sadece kapanan bar işlenir
    _pushBar(bar.symbol, bar.interval, bar.high, bar.low, bar.close);
    const sig = _computeSignal(bar.symbol);
    if (sig) _upsertSignal(sig);
  }

  function _subscribeAll() {
    TEST_SYMBOLS.forEach(sym => {
      TIMEFRAMES.forEach(tf => MarketDataStore.subscribeKlines(sym, tf, _onKlineBar));
    });
    console.log(`[M1Hammer] MarketDataStore kline stream'ine abone olundu (${TEST_SYMBOLS.length * TIMEFRAMES.length} stream, ${TEST_SYMBOLS.join(', ')})`);
  }

  function _unsubscribeAll() {
    TEST_SYMBOLS.forEach(sym => {
      TIMEFRAMES.forEach(tf => MarketDataStore.unsubscribeKlines(sym, tf, _onKlineBar));
    });
  }

  async function start() {
    if (_started) { console.log('[M1Hammer] zaten çalışıyor.'); return; }
    _started = true;
    _stopped = false;
    window.m1HammerSignals = Array.isArray(window.m1HammerSignals) ? window.m1HammerSignals : [];

    console.log(`[M1Hammer] FAZ 1 test modu — ${TEST_SYMBOLS.length} sembol: ${TEST_SYMBOLS.join(', ')}`);

    const backfillOk = await _backfill();
    if (!backfillOk) { _started = false; return; }

    _subscribeAll();
  }

  function stop() {
    _stopped = true;
    _started = false;
    _unsubscribeAll();
    console.log('[M1Hammer] Durduruldu.');
  }

  return { start, stop };
})();

window.M1HammerScanner = M1HammerScanner;
