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
      dir: bullCross ? 'bull' : 'bear',
      prev: Math.round(wt1Prev), // Kom1'in "önceki bar oversold mu" (WT1 < eşik) kontrolü için — gorevler3.md Görev 2
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
   * Heikin Ashi — standart iteratif dönüşüm. Varsayılan modda sadece SON bar'ın
   * ha_open/ha_close değerini döner (Kom1'in ihtiyacı bu). `returnSeries=true`
   * verilirse chart'ın render katmanının ihtiyaç duyduğu TAM seri (her bar için
   * ha_open/ha_high/ha_low/ha_close) de eklenir — geriye dönük uyumlu, mevcut
   * çağıranlar (Kom1Scanner) etkilenmez.
   * NOT: ilk bar için ha_open = (open+close)/2 kabul edilir (standart yaklaşım) —
   * bu, dizinin BAŞINDAN itibaren mi yoksa gerçek geçmişin başından mı hesaplandığına
   * bağlı olarak son değerde küçük bir sapmaya yol açabilir; dizi yeterince uzunsa
   * bu sapma birkaç bar içinde sönümlenir.
   */
  function calcHeikinAshi(opens, highs, lows, closes, returnSeries = false) {
    if (!opens || !opens.length || opens.length !== closes.length) return null;
    let haOpen  = (opens[0] + closes[0]) / 2;
    let haClose = (opens[0] + highs[0] + lows[0] + closes[0]) / 4;
    let haHigh  = Math.max(highs[0], haOpen, haClose);
    let haLow   = Math.min(lows[0], haOpen, haClose);
    const series = returnSeries ? [{ haOpen, haHigh, haLow, haClose }] : null;
    for (let i = 1; i < closes.length; i++) {
      const newHaClose = (opens[i] + highs[i] + lows[i] + closes[i]) / 4;
      const newHaOpen  = (haOpen + haClose) / 2;
      const newHaHigh  = Math.max(highs[i], newHaOpen, newHaClose);
      const newHaLow   = Math.min(lows[i], newHaOpen, newHaClose);
      haOpen  = newHaOpen;
      haClose = newHaClose;
      haHigh  = newHaHigh;
      haLow   = newHaLow;
      if (series) series.push({ haOpen, haHigh, haLow, haClose });
    }
    if (returnSeries) return { haOpen, haClose, haHigh, haLow, series };
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

  // ══════════════════════════════════════════════════════════════
  // gorevler2.md Görev 14 (2026-08-11) — Chart overlay/alt-pencere
  // indikatörleri için TAM SERİ döndüren, TradingView'in ta.ema()
  // ile birebir eşleşen (SMA-seed) fonksiyonlar.
  //
  // NOT: Yukarıdaki calcRSI/calcDEMA/_emaLast/_emaSeries bot'lar
  // (M1Hammer, Kom1Scanner) tarafından kullanılıyor — bot-architecture
  // kuralı gereği DAVRANIŞLARI DEĞİŞTİRİLMEDİ (ilk EMA değerini ham
  // ilk kapanışla seed ediyorlar, TV ile birebir eşleşmiyor ama bot
  // sinyalleri zaten bu davranışa göre kalibre). Chart'ın ihtiyacı
  // ayrı — bu yüzden burada YENİ, SMA-seed kullanan bir aile var.
  // ══════════════════════════════════════════════════════════════

  /** TV'nin ta.ema() davranışı: ilk değer SMA(ilk `period` bar), sonrası EMA. */
  function _smaSeedEmaSeries(values, period) {
    const out = new Array(values.length).fill(null);
    if (values.length < period) return out;
    const k = 2 / (period + 1);
    let sum = 0;
    for (let i = 0; i < period; i++) sum += values[i];
    let ema = sum / period;
    out[period - 1] = ema;
    for (let i = period; i < values.length; i++) {
      ema = values[i] * k + ema * (1 - k);
      out[i] = ema;
    }
    return out;
  }

  /** EMA — tam seri, chart overlay için. */
  function calcEMAFull(closes, period = 20) {
    return _smaSeedEmaSeries(closes, period);
  }

  /** DEMA — tam seri, chart overlay için. DEMA = 2*EMA1 - EMA(EMA1). */
  function calcDEMAFull(closes, period = DEMA_PERIOD_DEFAULT) {
    const ema1 = _smaSeedEmaSeries(closes, period);
    const firstValid = ema1.findIndex(v => v != null);
    const out = new Array(closes.length).fill(null);
    if (firstValid === -1) return out;
    const ema1Valid = ema1.slice(firstValid);
    const ema2Valid = _smaSeedEmaSeries(ema1Valid, period);
    for (let i = 0; i < ema2Valid.length; i++) {
      if (ema2Valid[i] == null) continue;
      out[firstValid + i] = 2 * ema1Valid[i] - ema2Valid[i];
    }
    return out;
  }

  // ══════════════════════════════════════════════════════════════
  // [2026-08-27, kullanıcı isteği] TV'nin GERÇEK "Linear Regression
  // Channel" indikatörünün (built-in) Pine kaynağı kullanıcı tarafından
  // birebir paylaşıldı, bu fonksiyonlar o kaynağın DOĞRUDAN portu (satır
  // satır aynı formüller — calcSlope/calcDev). YUKARIDAKİ calcRegressionChannel
  // (bkz. dosya başındaki not) ile KARIŞTIRILMASIN — o, Kom1 botunun
  // kendi basit "sadece mid değeri" ihtiyacı için (bot-architecture
  // kuralı: davranışı DEĞİŞTİRİLMEDİ), sapma bantları/Pearson's R yok.
  // Bu yeni fonksiyonlar SADECE chart göstergesi için, TV'nin dolgu/uzatma
  // hariç TÜM matematiğini (deviation bantları + Pearson's R) içerir.
  //
  // NOT: Pine'da series[0] = EN GÜNCEL bar, series[length-1] = length bar
  // ÖNCESİ (yani "en yeniden en eskiye" sıralı). Bu projede candlesData
  // TERSİ yönde (en eskiden en yeniye, ascending time) tutuluyor — bu
  // yüzden fonksiyonlar `recentFirst` (Pine sırası) dizileri BEKLER,
  // çağıran taraf (chart-pane.js) `slice(-length).reverse()` ile çevirir.
  // ══════════════════════════════════════════════════════════════

  /** Pine calcSlope() portu — recentFirst[0]=en güncel bar. */
  function calcLinRegSlope(recentFirst, length) {
    if (length <= 1 || recentFirst.length < length) return { slope: null, average: null, intercept: null };
    let sumX = 0, sumY = 0, sumXSqr = 0, sumXY = 0;
    for (let i = 0; i < length; i++) {
      const val = recentFirst[i];
      const per = i + 1;
      sumX += per; sumY += val; sumXSqr += per * per; sumXY += val * per;
    }
    const denom = length * sumXSqr - sumX * sumX;
    if (denom === 0) return { slope: null, average: null, intercept: null };
    const slope = (length * sumXY - sumX * sumY) / denom;
    const average = sumY / length;
    const intercept = average - slope * sumX / length + slope;
    return { slope, average, intercept };
  }

  /** Pine calcDev() portu — sourceRecentFirst/highRecentFirst/lowRecentFirst
   *  hepsi Pine sırasında (index 0 = en güncel bar). */
  function calcLinRegDeviation(sourceRecentFirst, highRecentFirst, lowRecentFirst, length, slope, average, intercept) {
    let upDev = 0, dnDev = 0, stdDevAcc = 0, dsxx = 0, dsyy = 0, dsxy = 0;
    const periods = length - 1;
    const daY = intercept + slope * periods / 2;
    let val = intercept;
    for (let j = 0; j <= periods; j++) {
      let price = highRecentFirst[j] - val;
      if (price > upDev) upDev = price;
      price = val - lowRecentFirst[j];
      if (price > dnDev) dnDev = price;
      price = sourceRecentFirst[j];
      const dxt = price - average;
      const dyt = val - daY;
      price -= val;
      stdDevAcc += price * price;
      dsxx += dxt * dxt; dsyy += dyt * dyt; dsxy += dxt * dyt;
      val += slope;
    }
    const stdDev = Math.sqrt(stdDevAcc / (periods === 0 ? 1 : periods));
    const pearsonR = (dsxx === 0 || dsyy === 0) ? 0 : dsxy / Math.sqrt(dsxx * dsyy);
    return { stdDev, pearsonR, upDev, dnDev };
  }

  /**
   * Chart göstergesi için tek giriş noktası — TV'nin sadece "son bar"da
   * hesapladığı kanalı üretir (`barstate.islast` — geçmiş her bar için
   * TEKRAR hesaplanmaz, tek bir statik kanal). `sourceAsc`/`highAsc`/
   * `lowAsc` bu projenin kendi sırasında (ascending, en eski→en yeni).
   * @returns {null | {startPrice, endPrice, upperStart, upperEnd, lowerStart, lowerEnd, pearsonR}}
   */
  function calcLinRegChannelFull(sourceAsc, highAsc, lowAsc, length, opts = {}) {
    const n = sourceAsc.length;
    if (n < length || length <= 1) return null;
    // Pine sırasına çevir: index 0 = en güncel bar.
    const srcRF  = sourceAsc.slice(n - length).reverse();
    const highRF = highAsc.slice(n - length).reverse();
    const lowRF  = lowAsc.slice(n - length).reverse();

    const { slope, average, intercept } = calcLinRegSlope(srcRF, length);
    if (slope == null) return null;
    const startPrice = intercept + slope * (length - 1);
    const endPrice = intercept;

    const { stdDev, pearsonR, upDev, dnDev } = calcLinRegDeviation(srcRF, highRF, lowRF, length, slope, average, intercept);

    const useUpperDev = opts.useUpperDev !== false;
    const useLowerDev = opts.useLowerDev !== false;
    const upperMult = opts.upperMult ?? 2.0;
    const lowerMult = opts.lowerMult ?? 2.0;

    const upperOffsetStart = useUpperDev ? upperMult * stdDev : upDev;
    const upperOffsetEnd   = useUpperDev ? upperMult * stdDev : upDev;
    const lowerOffsetStart = useLowerDev ? -lowerMult * stdDev : -dnDev;
    const lowerOffsetEnd   = useLowerDev ? -lowerMult * stdDev : -dnDev;

    return {
      startPrice, endPrice,
      upperStart: startPrice + upperOffsetStart, upperEnd: endPrice + upperOffsetEnd,
      lowerStart: startPrice + lowerOffsetStart, lowerEnd: endPrice + lowerOffsetEnd,
      pearsonR,
    };
  }

  /** RSI (Wilder) — tam seri, yuvarlanmamış, chart alt-pencere için. */
  function calcRSIFull(closes, period = RSI_PERIOD_DEFAULT) {
    const out = new Array(closes.length).fill(null);
    if (closes.length < period + 1) return out;
    let gains = 0, losses = 0;
    for (let i = 1; i <= period; i++) {
      const d = closes[i] - closes[i - 1];
      if (d > 0) gains += d; else losses -= d;
    }
    let avgGain = gains / period;
    let avgLoss = losses / period;
    out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
    for (let i = period + 1; i < closes.length; i++) {
      const d = closes[i] - closes[i - 1];
      avgGain = (avgGain * (period - 1) + Math.max(d, 0)) / period;
      avgLoss = (avgLoss * (period - 1) + Math.max(-d, 0)) / period;
      out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
    }
    return out;
  }

  function _pureSmaSeries(arr, period) {
    const out = new Array(arr.length).fill(null);
    let sum = 0;
    for (let i = 0; i < arr.length; i++) {
      sum += arr[i];
      if (i >= period) sum -= arr[i - period];
      if (i >= period - 1) out[i] = sum / period;
    }
    return out;
  }

  /** SMMA/RMA (Wilder smoothing) — ilk değer SMA seed, sonrası Wilder ortalaması. */
  function _rmaSeries(arr, period) {
    const out = new Array(arr.length).fill(null);
    if (arr.length < period) return out;
    let sum = 0;
    for (let i = 0; i < period; i++) sum += arr[i];
    let prev = sum / period;
    out[period - 1] = prev;
    for (let i = period; i < arr.length; i++) {
      prev = (prev * (period - 1) + arr[i]) / period;
      out[i] = prev;
    }
    return out;
  }

  function _wmaSeries(arr, period) {
    const out = new Array(arr.length).fill(null);
    const denom = period * (period + 1) / 2;
    for (let i = period - 1; i < arr.length; i++) {
      let sum = 0;
      for (let j = 0; j < period; j++) sum += arr[i - j] * (period - j);
      out[i] = sum / denom;
    }
    return out;
  }

  /** Başka bir indikatör serisinin (ör. RSI) üzerine hareketli ortalama —
   *  TV'nin "RSI-based MA" alanı. `series` baştan null'lu (RSI period'una
   *  kadar) gelebilir, ilk geçerli değerden itibaren hesaplanır. */
  function calcMAOfSeries(series, period, type = 'sma') {
    const firstValid = series.findIndex(v => v != null);
    const out = new Array(series.length).fill(null);
    if (firstValid === -1) return out;
    const valid = series.slice(firstValid);
    let maValid;
    if (type === 'ema') maValid = _smaSeedEmaSeries(valid, period);
    else if (type === 'smma') maValid = _rmaSeries(valid, period);
    else if (type === 'wma') maValid = _wmaSeries(valid, period);
    else maValid = _pureSmaSeries(valid, period); // 'sma'
    for (let i = 0; i < maValid.length; i++) {
      if (maValid[i] != null) out[firstValid + i] = maValid[i];
    }
    return out;
  }

  const DIV_PIVOT_LEFT  = 5;  // TV'nin RSI script'indeki lbL
  const DIV_PIVOT_RIGHT = 5;  // TV'nin RSI script'indeki lbR
  const DIV_RANGE_MIN   = 5;  // rangeLower
  const DIV_RANGE_MAX   = 60; // rangeUpper

  /** i barı [i-left, i+right] penceresinde en düşük/yüksek mi (ties'a izin
   *  verir — TV'nin ta.pivotlow/ta.pivothigh mantığı). null komşular atlanır. */
  function _pivotLow(arr, i, left, right) {
    if (arr[i] == null) return false;
    for (let j = Math.max(0, i - left); j <= Math.min(arr.length - 1, i + right); j++) {
      if (j === i || arr[j] == null) continue;
      if (arr[j] < arr[i]) return false;
    }
    return true;
  }
  function _pivotHigh(arr, i, left, right) {
    if (arr[i] == null) return false;
    for (let j = Math.max(0, i - left); j <= Math.min(arr.length - 1, i + right); j++) {
      if (j === i || arr[j] == null) continue;
      if (arr[j] > arr[i]) return false;
    }
    return true;
  }

  /** TV'nin RSI script'indeki "Calculate Divergence" ile AYNI mantık:
   *  ardışık iki RSI pivot-low'u arasında RSI yükselirken FİYATIN (low)
   *  düşmesi = Regular Bullish; ardışık iki pivot-high arasında RSI
   *  düşerken FİYATIN (high) yükselmesi = Regular Bearish. Pivot'lar
   *  arası bar sayısı [rangeMin, rangeMax] dışındaysa sinyal sayılmaz.
   *  `rsiArr`/`lowArr`/`highArr` aynı uzunlukta, zaman-hizalı olmalı. */
  function calcRegularDivergence(rsiArr, lowArr, highArr, opts = {}) {
    const left = opts.left ?? DIV_PIVOT_LEFT;
    const right = opts.right ?? DIV_PIVOT_RIGHT;
    const rangeMin = opts.rangeMin ?? DIV_RANGE_MIN;
    const rangeMax = opts.rangeMax ?? DIV_RANGE_MAX;
    const lows = [], highs = [];
    for (let i = 0; i < rsiArr.length; i++) {
      if (_pivotLow(rsiArr, i, left, right)) lows.push(i);
      if (_pivotHigh(rsiArr, i, left, right)) highs.push(i);
    }
    const bullish = [];
    for (let k = 1; k < lows.length; k++) {
      const a = lows[k - 1], b = lows[k];
      const gap = b - a;
      if (gap < rangeMin || gap > rangeMax) continue;
      if (rsiArr[a] == null || rsiArr[b] == null || lowArr[a] == null || lowArr[b] == null) continue;
      if (rsiArr[b] > rsiArr[a] && lowArr[b] < lowArr[a]) bullish.push({ aIdx: a, bIdx: b });
    }
    const bearish = [];
    for (let k = 1; k < highs.length; k++) {
      const a = highs[k - 1], b = highs[k];
      const gap = b - a;
      if (gap < rangeMin || gap > rangeMax) continue;
      if (rsiArr[a] == null || rsiArr[b] == null || highArr[a] == null || highArr[b] == null) continue;
      if (rsiArr[b] < rsiArr[a] && highArr[b] > highArr[a]) bearish.push({ aIdx: a, bIdx: b });
    }
    return { bullish, bearish };
  }

  return {
    calcRSI,
    calcSRSI,
    calcWT,
    calcDEMA,
    calcHeikinAshi,
    calcRegressionChannel,
    calcEMAFull,
    calcDEMAFull,
    calcRSIFull,
    calcMAOfSeries,
    calcRegularDivergence,
    calcLinRegChannelFull,
  };
})();

// gorevler3.md Görev 5 (2026-08-11) — sunucu tarafı Kom1 shadow-logger
// (js/screener/kom1-server-watcher.js) bu modülü Node'da require() ile
// kullanabilsin diye izomorfik hâle getirildi. Tarayıcıda `window` var,
// Node'da yok — davranış/hesap değişmedi, sadece dışa açma yolu eklendi.
if (typeof window !== 'undefined') window.IndicatorEngine = IndicatorEngine;
if (typeof module !== 'undefined' && module.exports) module.exports = IndicatorEngine;
