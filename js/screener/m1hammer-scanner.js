/**
 * M1HammerScanner
 * Binance Futures USDT coinlerini tarar.
 * Tetikleme: 5m kapanışında (her 5 dakikada bir).
 * Sinyal kriteri: 5m RSI < 30 (bull) veya > 70 (bear) ZORUNLU.
 * Timeframe'ler: 5m, 15m, 1h, 4h, 1D
 * WT: 5m/15m/1h/4h/1D — cross olduğunda değer gelir, yoksa null
 */
const M1HammerScanner = (() => {

  const BASE = 'https://fapi.binance.com';
  const RSI_PERIOD  = 14;
  const SRSI_PERIOD = 14;
  const SRSI_K      = 3;
  const SRSI_D      = 3;
  const WT_CH_LEN   = 10;  // Channel Length
  const WT_AVG_LEN  = 21;  // Average Length
  const MAX_SIGNALS = 500;

  let _running = false;
  let _timer   = null;

  // RSI hesapla (Wilder yöntemi)
  function calcRSI(closes) {
    if (closes.length < RSI_PERIOD + 1) return null;
    let gains = 0, losses = 0;
    for (let i = 1; i <= RSI_PERIOD; i++) {
      const d = closes[i] - closes[i - 1];
      if (d > 0) gains += d; else losses -= d;
    }
    let avgGain = gains / RSI_PERIOD;
    let avgLoss = losses / RSI_PERIOD;
    for (let i = RSI_PERIOD + 1; i < closes.length; i++) {
      const d = closes[i] - closes[i - 1];
      avgGain = (avgGain * (RSI_PERIOD - 1) + Math.max(d, 0)) / RSI_PERIOD;
      avgLoss = (avgLoss * (RSI_PERIOD - 1) + Math.max(-d, 0)) / RSI_PERIOD;
    }
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return Math.round(100 - 100 / (1 + rs));
  }

  // Stochastic RSI hesapla — son bar'ın K değeri
  function calcSRSI(closes) {
    if (closes.length < RSI_PERIOD * 2 + SRSI_K + SRSI_D) return null;
    // Tüm RSI değerlerini hesapla
    const rsiArr = [];
    for (let i = RSI_PERIOD; i < closes.length; i++) {
      rsiArr.push(calcRSI(closes.slice(0, i + 1)));
    }
    if (rsiArr.length < SRSI_PERIOD + SRSI_K + SRSI_D - 2) return null;
    // Stoch RSI
    const stochArr = [];
    for (let i = SRSI_PERIOD - 1; i < rsiArr.length; i++) {
      const slice = rsiArr.slice(i - SRSI_PERIOD + 1, i + 1);
      const minR = Math.min(...slice);
      const maxR = Math.max(...slice);
      stochArr.push(maxR === minR ? 0 : (rsiArr[i] - minR) / (maxR - minR) * 100);
    }
    // K = SMA(stoch, SRSI_K)
    if (stochArr.length < SRSI_K) return null;
    const k = stochArr.slice(-SRSI_K).reduce((a, b) => a + b, 0) / SRSI_K;
    return Math.round(k);
  }

  // WaveTrend hesapla — son bar'da cross var mı, cross değeri ne?
  // Returns: { val: number, crossed: true/false } veya null
  function calcWT(hlc3Arr) {
    if (hlc3Arr.length < WT_CH_LEN + WT_AVG_LEN + 4) return null;

    // ESA = EMA(hlc3, CH_LEN)
    function ema(arr, len) {
      const k = 2 / (len + 1);
      let e = arr[0];
      for (let i = 1; i < arr.length; i++) e = arr[i] * k + e * (1 - k);
      return e;
    }

    // WT1 ve WT2 dizilerini hesapla (son 5 bar yeterli)
    const wt1Arr = [], wt2Arr = [];
    const needed = WT_CH_LEN + WT_AVG_LEN + 5;
    const slice = hlc3Arr.slice(-needed);

    for (let i = WT_CH_LEN; i < slice.length; i++) {
      const window = slice.slice(i - WT_CH_LEN, i + 1);
      const esa = ema(window, WT_CH_LEN);
      const dArr = window.map(v => Math.abs(v - esa));
      const d = ema(dArr, WT_CH_LEN);
      const ci = d !== 0 ? (slice[i] - esa) / (0.015 * d) : 0;
      // WT1 için yeterli ci birikince
      wt1Arr.push(ci);
    }

    if (wt1Arr.length < WT_AVG_LEN + 2) return null;

    // WT1 = EMA(ci, AVG_LEN) — son 2 değer
    const wt1Prev = ema(wt1Arr.slice(-WT_AVG_LEN - 1, -1), WT_AVG_LEN);
    const wt1Curr = ema(wt1Arr.slice(-WT_AVG_LEN), WT_AVG_LEN);
    // WT2 = SMA(WT1, 4)
    const wt2Prev = wt1Arr.slice(-5, -1).reduce((a, b) => a + b, 0) / 4;
    const wt2Curr = wt1Arr.slice(-4).reduce((a, b) => a + b, 0) / 4;

    // Cross tespiti
    const bullCross = wt1Prev <= wt2Prev && wt1Curr > wt2Curr;
    const bearCross = wt1Prev >= wt2Prev && wt1Curr < wt2Curr;

    if (!bullCross && !bearCross) return null;

    return {
      val: Math.round(wt1Curr),
      dir: bullCross ? 'bull' : 'bear'
    };
  }

  // Binance kline çek
  async function fetchKlines(symbol, interval, limit) {
    const url = `${BASE}/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`kline fetch failed: ${symbol} ${interval}`);
    return res.json();
  }

  // Tek coin tara
  async function scanSymbol(symbol, currentFR) {
    // Her timeframe için gereken bar sayısı
    const BARS = RSI_PERIOD * 2 + SRSI_K + SRSI_D + WT_CH_LEN + WT_AVG_LEN + 10;

    // Paralel çek: 5m, 15m, 1h, 4h, 1D
    const [k5m, k15m, k1h, k4h, k1d] = await Promise.all([
      fetchKlines(symbol, '5m',  BARS),
      fetchKlines(symbol, '15m', BARS),
      fetchKlines(symbol, '1h',  BARS),
      fetchKlines(symbol, '4h',  BARS),
      fetchKlines(symbol, '1d',  BARS),
    ]);

    const closes5m  = k5m.map(k => parseFloat(k[4]));
    const closes15m = k15m.map(k => parseFloat(k[4]));
    const closes1h  = k1h.map(k => parseFloat(k[4]));
    const closes4h  = k4h.map(k => parseFloat(k[4]));
    const closes1d  = k1d.map(k => parseFloat(k[4]));

    const hlc3_5m  = k5m.map(k  => (parseFloat(k[2]) + parseFloat(k[3]) + parseFloat(k[4])) / 3);
    const hlc3_15m = k15m.map(k => (parseFloat(k[2]) + parseFloat(k[3]) + parseFloat(k[4])) / 3);
    const hlc3_1h  = k1h.map(k  => (parseFloat(k[2]) + parseFloat(k[3]) + parseFloat(k[4])) / 3);
    const hlc3_4h  = k4h.map(k  => (parseFloat(k[2]) + parseFloat(k[3]) + parseFloat(k[4])) / 3);
    const hlc3_1d  = k1d.map(k  => (parseFloat(k[2]) + parseFloat(k[3]) + parseFloat(k[4])) / 3);

    // RSI
    const rsi5m  = calcRSI(closes5m);
    const rsi15m = calcRSI(closes15m);
    const rsi1h  = calcRSI(closes1h);
    const rsi4h  = calcRSI(closes4h);
    const rsi1d  = calcRSI(closes1d);

    // 5m RSI zorunlu kontrol
    if (rsi5m === null) return null;
    const isBull = rsi5m < 30;
    const isBear = rsi5m > 70;
    if (!isBull && !isBear) return null;

    // SRSI
    const srsi5m  = calcSRSI(closes5m);
    const srsi15m = calcSRSI(closes15m);
    const srsi1h  = calcSRSI(closes1h);
    const srsi4h  = calcSRSI(closes4h);

    // WT — sadece cross olduğunda değer gelir
    const wt5m  = calcWT(hlc3_5m);
    const wt15m = calcWT(hlc3_15m);
    const wt1h  = calcWT(hlc3_1h);
    const wt4h  = calcWT(hlc3_4h);
    const wt1d  = calcWT(hlc3_1d);

    const wtDirection = isBull ? 'bull' : 'bear';

    // Boost value: (currentPrice - prevPrice) / prevPrice * 100
    const currentPrice = closes5m[closes5m.length - 1];
    const prevPrice    = closes5m[closes5m.length - 2];
    const boostValue   = prevPrice !== 0
      ? ((currentPrice - prevPrice) / prevPrice) * 100
      : 0;

    return {
      symbol,
      exchange: 'bn',
      boostValue,
      currentPrice,
      prevPrice,
      fr: currentFR ?? null,
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

  // Tüm USDT futures sembollerini al
  async function fetchAllSymbols() {
    const res = await fetch(`${BASE}/fapi/v1/exchangeInfo`);
    const data = await res.json();
    return data.symbols
      .filter(s => s.quoteAsset === 'USDT' && s.status === 'TRADING' && s.contractType === 'PERPETUAL')
      .map(s => s.symbol);
  }

  // Mevcut FR değerlerini al (screener'dan)
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

  // Ana tarama döngüsü
  async function _scan() {
    if (_running) return;
    _running = true;
    console.log('[M1Hammer] Tarama başladı...');

    try {
      const [symbols, frMap] = await Promise.all([
        fetchAllSymbols(),
        Promise.resolve(getFRMap()),
      ]);

      // Rate limit aşmamak için gruplar halinde tara (5'er paralel)
      const BATCH = 5;
      const newSignals = [];

      for (let i = 0; i < symbols.length; i += BATCH) {
        const batch = symbols.slice(i, i + BATCH);
        const results = await Promise.allSettled(
          batch.map(sym => scanSymbol(sym, frMap[sym] ?? null))
        );
        results.forEach(r => {
          if (r.status === 'fulfilled' && r.value) newSignals.push(r.value);
        });
      }

      // Mevcut sinyallerle birleştir (aynı symbol varsa güncelle, yoksa ekle)
      const existing = Array.isArray(window.m1HammerSignals) ? window.m1HammerSignals : [];
      const merged = [...newSignals];
      existing.forEach(old => {
        if (!merged.find(n => n.symbol === old.symbol)) merged.push(old);
      });

      // MAX_SIGNALS sınırı — en yeni kalır
      window.m1HammerSignals = merged
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, MAX_SIGNALS);

      console.log(`[M1Hammer] ${newSignals.length} sinyal bulundu.`);

      // Panel'i güncelle
      if (window.BotSignalsPanel) BotSignalsPanel.render();

    } catch (err) {
      console.error('[M1Hammer] Tarama hatası:', err);
    } finally {
      _running = false;
    }
  }

  // 5m kapanışında tetikle
  function _scheduleNext() {
    const now = Date.now();
    const ms5m = 5 * 60 * 1000;
    const nextClose = Math.ceil(now / ms5m) * ms5m + 2000; // +2sn kapanış toleransı
    const delay = nextClose - now;
    _timer = setTimeout(() => {
      _scan();
      _scheduleNext();
    }, delay);
    console.log(`[M1Hammer] Sonraki tarama: ${Math.round(delay / 1000)}s sonra`);
  }

  function start() {
    window.m1HammerSignals = [];
    _scan();         // Hemen bir kere çalıştır
    _scheduleNext(); // 5m kapanışlarına sync et
  }

  function stop() {
    if (_timer) clearTimeout(_timer);
    _running = false;
  }

  return { start, stop };
})();

window.M1HammerScanner = M1HammerScanner;
