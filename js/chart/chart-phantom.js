/* ──────────────────────────────────────────────────────────
   chart-phantom.js  —  Zaman eksenini sağa uzatan phantom seri
   
   Amacı: Lightweight Charts'ta zaman ekseni sadece mum verisi
   olan aralıkta görünür. Bu modül görünmez (opacity=0) bir
   LineSeries ekleyerek zaman eksenini gelecekteki 500 bara
   kadar uzatır. Çizim araçları bu alanda çalışabilir hale gelir.
   
   Kullanım: ChartPhantom.init(chartPane) — chart hazır olduktan sonra
────────────────────────────────────────────────────────── */

const ChartPhantom = (() => {

  // TF → saniye cinsinden bar süresi
  const TF_SECONDS = {
    '1m':  60,
    '3m':  180,
    '5m':  300,
    '15m': 900,
    '30m': 1800,
    '1H':  3600,
    '2H':  7200,
    '4H':  14400,
    '6H':  21600,
    '12H': 43200,
    '1D':  86400,
    '3D':  259200,
    '1W':  604800,
    '1M':  2592000,
  };

  const PHANTOM_BARS = 500; // Sağa uzatılacak bar sayısı

  /**
   * Verilen ChartPane'e phantom seri ekler.
   * @param {ChartPane} pane — ChartPane instance
   */
  function init(pane) {
    if (!pane || !pane.chart) return;

    // Önceki phantom seriyi temizle
    destroy(pane);

    try {
      // Görünmez LineSeries oluştur
      pane._phantomSeries = pane.chart.addLineSeries({
        color:       'rgba(0,0,0,0)',   // Tamamen şeffaf
        lineWidth:   1,
        priceScaleId: 'phantom_scale',  // Ayrı scale — fiyat eksenini etkilemez
        lastValueVisible: false,
        priceLineVisible: false,
        crosshairMarkerVisible: false,
      });

      // Phantom scale'i gizle
      pane.chart.priceScale('phantom_scale').applyOptions({
        visible:       false,
        scaleMargins:  { top: 0, bottom: 0 },
        borderVisible: false,
      });

      // Phantom veriyi oluştur ve set et
      _updatePhantom(pane);

    } catch(e) {
      console.warn('[ChartPhantom] init failed:', e);
    }
  }

  /**
   * Phantom seriyi güncelle — son mum değiştiğinde çağır
   * @param {ChartPane} pane
   */
  function _updatePhantom(pane) {
    if (!pane._phantomSeries) return;

    const tf       = pane.tf;
    const barSec   = TF_SECONDS[tf] || 3600;
    const candles  = pane.candlesData;

    if (!candles || !candles.length) return;

    // Son mumun zamanından başla
    const lastTime = candles[candles.length - 1].time;
    // Fiyat olarak son kapanış fiyatını kullan (görünmez ama gerekli)
    const lastClose = candles[candles.length - 1].close;

    const phantomData = [];
    for (let i = 1; i <= PHANTOM_BARS; i++) {
      phantomData.push({
        time:  lastTime + (barSec * i),
        value: lastClose, // Görünmez ama null olamaz
      });
    }

    try {
      pane._phantomSeries.setData(phantomData);
    } catch(e) {
      console.warn('[ChartPhantom] setData failed:', e);
    }
  }

  /**
   * Phantom seriyi temizle
   * @param {ChartPane} pane
   */
  function destroy(pane) {
    if (!pane || !pane.chart) return;
    if (pane._phantomSeries) {
      try { pane.chart.removeSeries(pane._phantomSeries); } catch(_) {}
      pane._phantomSeries = null;
    }
  }

  /**
   * Son mum değiştiğinde phantom'ı güncelle
   * ChartPane._onFeedCandles() ve _onLiveCandle() sonrası çağrılabilir
   */
  function update(pane) {
    _updatePhantom(pane);
  }

  return { init, update, destroy };

})();
