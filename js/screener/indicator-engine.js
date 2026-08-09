/* ============================================================
   indicator-engine.js  —  Paylaşılan İndikatör Matematiği
   ============================================================
   gorevler3.md Görev 1 (2026-08-09). Amaç: RSI/StochRSI/WaveTrend
   hesaplamaları önceden m1hammer-scanner.js içine gömülüydü, chart
   ve diğer botlar bunu kullanamıyordu (SISTEM-GENEL-DEGERLENDIRME.md
   bulgusu). Bu modül DOM'a dokunmaz, sadece saf hesaplama fonksiyonları
   içerir — hem chart hem tarayıcı botları (M1Hammer, Kom1Scanner) buradan
   çağırır. Tek kaynak — aynı hesaplama iki yerde farklı sonuç vermesin
   (FR'nin "3 ayrı kaynaktan tutarsız veri" hatasına düşülmesin).

   Public API:
     IndicatorEngine.calcRSI(closes, period=14)
     IndicatorEngine.calcSRSI(closes, period=14, kLen=3, dLen=3)
     IndicatorEngine.calcWT(hlc3Arr, chLen=10, avgLen=21)
     IndicatorEngine.calcDEMA(closes, period=9)
     IndicatorEngine.calcHeikinAshi(opens, highs, lows, closes)
     IndicatorEngine.calcRegressionChannel(closes, length=100)
   ============================================================ */

const IndicatorEngine = (() => {

  const RSI_PERIOD_DEFAULT  = 14;
  const SRSI_K_DEFAULT      = 3;
  const SRSI_D_DEFAULT      = 3;
  const WT_CH_LEN_DEFAULT   = 10;
  const WT_AVG_LEN_DEFAULT  = 21;
  const DEMA_PERIOD_DEFAULT = 9;
  const RC_LENGTH_DEFAULT   = 100;

  // ── EMA — hem son değeri (calcWT'nin eski kullanımı) hem tam seriyi
  //    (DEMA'nın ihtiyacı) döndürebilen iki yardımcı ──────────────────
  function _emaLast(arr, period) {
    const k = 2 / (period + 1);
    let e = arr[0];
    for (let i = 1; i < arr.length; i++) e = arr[i] * k + e * (1 - k);
    return e;
  }

  function _emaSeries(arr, period) {
    const k = 2 / (period + 1);
    const out = [arr[0]];
    for (let i = 1; i < arr.length; i++) out.push(arr[i] * k + out[i - 1] * (1 - k));
    return out;
  }

  /** RSI (Wilder yöntemi). m1hammer-scanner.js'den taşındı, davranış aynı. */
  function calcRSI(closes, period = RSI_PERIOD_DEFAULT) {
    if (closes.length < period + 1) return null;
    let gains = 0, losses = 0;
    for (let i = 1; i <= period; i++) {
      const d = closes[i] - closes[i - 1];
      if (d > 0) gains += d; else losses -= d;
    }
    let avgGain = gains / period;
    let avgLoss = losses / period;
    for (let i = period + 1; i < closes.length; i++) {
      const d = closes[i] - closes[i - 1];
      avgGain = (avgGain * (period - 1) + Math.max(d, 0)) / period;
      avgLoss = (avgLoss * (period - 1) + Math.max(-d, 0)) / period;
    }
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return Math.round(100 - 100 / (1 + rs));
  }

  /** Stochastic RSI — son bar'ın K değeri. m1hammer-scanner.js'den taşındı.
   *  NOT: hâlâ O(n²) (calcRSI'yi döngü içinde tekrar tekrar çağırıyor) —
   *  bilinen, dokümante edilmiş bir borç (bkz. gorevler2.md 10.3), küçük
   *  sembol kümelerinde maliyeti önemsiz, TEST_SYMBOLS büyürse önce bu
   *  optimize edilmeli. */
  function calcSRSI(closes, period = RSI_PERIOD_DEFAULT, kLen = SRSI_K_DEFAULT, dLen = SRSI_D_DEFAULT) {
    if (closes.length < period * 2 + kLen + dLen) return null;
    const rsiArr = [];
    for (let i = period; i < closes.length; i++) {
      rsiArr.push(calcRSI(closes.slice(0, i + 1), period));
    }
    if (rsiArr.length < period + kLen + dLen - 2) return null;
    const stochArr = [];
    for (let i = period - 1; i < rsiArr.length; i++) {
      const slice = rsiArr.slice(i - period + 1, i + 1);
      const minR = Math.min(...slice);
      const maxR = Math.max(...slice);
      stochArr.push(maxR === minR ? 0 : (rsiArr[i] - minR) / (maxR - minR) * 100);
    }
    if (stochArr.length < kLen) return null;
    const k = stochArr.slice(-kLen).reduce((a, b) => a + b, 0) / kLen;
    return Math.round(k);
  }

  /** WaveTrend — son bar'da WT1/WT2 cross var mı, hangi yönde, WT1 değeri ne?
   *  m1hammer-scanner.js'den taşındı, davranış aynı (WT_CH_LEN=10, WT_AVG_LEN=21
   *  varsayılanları Kom1'in beklediği parametrelerle birebir uyumlu).
   *  @returns {{val:number, dir:'bull'|'bear'}|null} */
  function calcWT(hlc3Arr, chLen = WT_CH_LEN_DEFAULT, avgLen = WT_AVG_LEN_DEFAULT) {
    if (hlc3Arr.length < chLen + avgLen + 4) return null;

    const wt1Arr = [];
    const needed = chLen + avgLen + 5;
    const slice = hlc3Arr.slice(-needed);

    for (let i = chLen; i < slice.length; i++) {
      const window = slice.slice(i - chLen, i + 1);
      const esa = _emaLast(window, chLen);
      const dArr = window.map(v => Math.abs(v - esa));
      const d = _emaLast(dArr, chLen);
      const ci = d !== 0 ? (slice[i] - esa) / (0.015 * d) : 0;
      wt1Arr.push(ci);
    }

    if (wt1Arr.length < avgLen + 2) return null;

    const wt1Prev = _emaLast(wt1Arr.slice(-avgLen - 1, -1), avgLen);
    const wt1Curr = _emaLast(wt1Arr.slice(-avgLen), avgLen);
    const wt2Prev = wt1Arr.slice(-5, -1).reduce((a, b) => a + b, 0) / 4;
    const wt2Curr = wt1Arr.slice(-4).reduce((a, b) => a + b, 0) / 4;

    const bullCross = wt1Prev <= wt2Prev && wt1Curr > wt2Curr;
    const bearCross = wt1Prev >= wt2Prev && wt1Curr < wt2Curr;

    if (!bullCross && !bearCross) return null;

    return {
      val: Math.round(wt1Curr),
      dir: bullCross ? 'bull' : 'bear'
    };
  }

  /**
   * DEMA (Double EMA) — standart formül: DEMA = 2*EMA(close,period) - EMA(EMA(close,period),period).
   * Kom1'in küçük TF onay koşulu (`ha_close > dema9`) için — yeni, bu projede ilk kez.
   */
  function calcDEMA(closes, period = DEMA_PERIOD_DEFAULT) {
    if (closes.length < period * 2) return null;
    const ema1 = _emaSeries(closes, period);
    const ema2 = _emaSeries(ema1, period);
    const last = ema1.length - 1;
    return 2 * ema1[last] - ema2[last];
  }

  /**
   * Heikin Ashi — standart iteratif dönüşüm. Sadece SON bar'ın ha_open/ha_close
   * değerini döner (Kom1'in ihtiyacı bu — tam seri gerekirse ayrıca genişletilebilir).
   * NOT: ilk bar için ha_open = (open+close)/2 kabul edilir (standart yaklaşım) —
   * bu, dizinin BAŞINDAN itibaren mi yoksa gerçek geçmişin başından mı hesaplandığına
   * bağlı olarak son değerde küçük bir sapmaya yol açabilir; dizi yeterince uzunsa
   * (Kom1 kullanım senaryosunda BARS kadar) bu sapma birkaç bar içinde sönümlenir.
   */
  function calcHeikinAshi(opens, highs, lows, closes) {
    if (!opens || !opens.length || opens.length !== closes.length) return null;
    let haOpen  = (opens[0] + closes[0]) / 2;
    let haClose = (opens[0] + highs[0] + lows[0] + closes[0]) / 4;
    for (let i = 1; i < closes.length; i++) {
      const newHaClose = (opens[i] + highs[i] + lows[i] + closes[i]) / 4;
      const newHaOpen  = (haOpen + haClose) / 2;
      haOpen  = newHaOpen;
      haClose = newHaClose;
    }
    return { haOpen, haClose };
  }

  /**
   * Regression Channel — `length` barlık basit lineer regresyon (en küçük
   * kareler). Kom1 sadece orta bandı (`mid` — son bar'daki regresyon
   * değeri) kullanıyor; slope/intercept ileride üst/alt bant hesaplamak
   * istenirse hazır dursun diye döndürülüyor.
   */
  function calcRegressionChannel(closes, length = RC_LENGTH_DEFAULT) {
    if (closes.length < length) return null;
    const slice = closes.slice(-length);
    const n = slice.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    for (let i = 0; i < n; i++) {
      sumX += i; sumY += slice[i]; sumXY += i * slice[i]; sumXX += i * i;
    }
    const denom = n * sumXX - sumX * sumX;
    if (denom === 0) return null;
    const slope = (n * sumXY - sumX * sumY) / denom;
    const intercept = (sumY - slope * sumX) / n;
    const mid = slope * (n - 1) + intercept; // son bar'daki regresyon değeri
    return { mid, slope, intercept };
  }

  return {
    calcRSI,
    calcSRSI,
    calcWT,
    calcDEMA,
    calcHeikinAshi,
    calcRegressionChannel,
  };
})();

window.IndicatorEngine = IndicatorEngine;
