/**
 * OiVolumePanel
 * L/S kartındaki gibi boş bir yer tutucu olan OI popup'unun (MiniFloatingWindow
 * 'oi') içeriği — Open Interest (48s, kendi veritabanımızdan) ve Volume
 * (aktif chart pane'inin gerçek mum verisinden, TF'e duyarlı) çizgi/histogram
 * grafikleri. 2026-08-15, kullanıcı isteği.
 *
 * Volume için ayrı bir veri kaynağı YOK — aktif ChartPane'in zaten yüklü
 * `candlesData`'sını okuyor (ekstra istek atmıyor), bu yüzden kullanıcı ana
 * chart'ta TF değiştirdiğinde (5m/1H/4H/...) popup'taki hacim grafiği de
 * otomatik aynı TF'i yansıtıyor. OI ise mum TF'inden bağımsız, sunucunun
 * kendi ~1dk'lık örneklemesi (bkz. server.js collectBinanceData) — bu yüzden
 * TF değişince yeniden çekilmiyor, sadece sembol değişince.
 */
const OiVolumePanel = (() => {
  let _oiChart = null, _oiSeries = null, _oiEl = null;
  let _volChart = null, _volSeries = null, _volEl = null;
  let _ro = null; // ResizeObserver — resize:vertical ile büyüyen popup'a göre grafikleri yeniden boyutlandırır
  let _currentSymbol = null, _currentExchange = null;

  const CHART_OPTS = {
    layout: { background: { type: 'solid', color: 'transparent' }, textColor: 'var(--text-secondary)', fontSize: 10 },
    grid: { vertLines: { color: 'rgba(255,255,255,0.04)' }, horzLines: { color: 'rgba(255,255,255,0.04)' } },
    rightPriceScale: { borderColor: 'var(--border-primary)' },
    timeScale: { borderColor: 'var(--border-primary)', timeVisible: true },
    crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
    handleScroll: false,
    handleScale: false,
  };

  function _ensureCharts(container) {
    if (_oiChart) return; // zaten kurulu — sadece görünür yapılıyor olabilir
    // flex:1 DEĞİL — mini-floating-window.js'teki notla aynı sebep: flex
    // basis:0 elle/resize ile ayarlanan height'ı geçersiz kılıyor. Sabit
    // başlangıç height'ı + resize:vertical kullanılıyor. İçerideki iki grafik
    // div'i (mfw-oi-chart/mfw-vol-chart) kendi flex:1'lerini bu artık GERÇEK
    // bir height'ı olan container içinde güvenle kullanabiliyor.
    container.style.cssText = 'display:flex; flex-direction:column; gap:6px; padding:8px; text-align:left; overflow:hidden; resize:vertical; height:320px; min-height:220px; max-height:70vh;';
    container.innerHTML = `
      <div style="font-size:9px; font-weight:700; color:var(--text-secondary); text-transform:uppercase; letter-spacing:0.3px;">Open Interest (48h)</div>
      <div id="mfw-oi-chart" style="flex:1; min-height:90px;"></div>
      <div style="font-size:9px; font-weight:700; color:var(--text-secondary); text-transform:uppercase; letter-spacing:0.3px;">Volume</div>
      <div id="mfw-vol-chart" style="flex:1; min-height:90px;"></div>
    `;
    _oiEl  = container.querySelector('#mfw-oi-chart');
    _volEl = container.querySelector('#mfw-vol-chart');

    _oiChart = LightweightCharts.createChart(_oiEl, CHART_OPTS);
    _oiSeries = _oiChart.addAreaSeries({
      lineColor: '#2962ff', lineWidth: 1.5,
      topColor: 'rgba(41,98,255,0.28)', bottomColor: 'rgba(41,98,255,0)',
      priceLineVisible: false,
    });

    _volChart = LightweightCharts.createChart(_volEl, CHART_OPTS);
    _volSeries = _volChart.addHistogramSeries({ priceLineVisible: false });

    // resize:vertical (CSS, mini-floating-window.js) ile kullanıcı popup'u
    // büyüttüğünde/küçülttüğünde grafikler kendi container'larına göre
    // yeniden boyutlansın.
    _ro = new ResizeObserver(() => {
      if (_oiEl && _oiChart)  _oiChart.resize(_oiEl.clientWidth, _oiEl.clientHeight);
      if (_volEl && _volChart) _volChart.resize(_volEl.clientWidth, _volEl.clientHeight);
    });
    _ro.observe(_oiEl);
    _ro.observe(_volEl);
  }

  async function _loadOi(symbol, exchange) {
    if (!_oiSeries) return;
    try {
      const res = await fetch(`/api/history/market/${exchange}/${symbol}?hours=48`);
      if (!res.ok) return;
      const records = await res.json();
      const data = records
        .filter(r => r.openInterest != null && r.timestamp)
        .map(r => ({ time: Math.floor(new Date(r.timestamp).getTime() / 1000), value: r.openInterest }));
      if (!data.length) return;
      _oiSeries.setData(data);
      _oiChart.timeScale().fitContent();
    } catch (e) {
      console.warn('[OiVolumePanel] OI geçmişi çekilemedi:', e.message);
    }
  }

  function _applyVolumeFromPane(pane) {
    if (!_volSeries || !pane?.candlesData?.length) return;
    const data = pane.candlesData.map(c => ({
      time: c.time,
      value: c.volume,
      color: c.close >= c.open ? 'rgba(38,166,154,0.6)' : 'rgba(239,83,80,0.6)',
    }));
    _volSeries.setData(data);
    _volChart.timeScale().fitContent();
  }

  function _refreshFromActivePane() {
    const pane = window.LayoutManager?.getActivePane?.();
    if (!pane) return;
    _applyVolumeFromPane(pane);
  }

  /** Popup her açıldığında (veya sembol değiştiğinde, açıkken) çağrılır. */
  function refresh() {
    const pane = window.LayoutManager?.getActivePane?.();
    if (!pane) return;
    _currentSymbol = pane.symbol;
    _currentExchange = pane.exchange;
    _loadOi(_currentSymbol, _currentExchange);
    _applyVolumeFromPane(pane);
    // Container az önce display:none'dan flex'e döndüyse boyutlar yanlış
    // olabilir (canvas 0-boyutta doğmuş olabilir) — bir sonraki frame'de düzelt.
    requestAnimationFrame(() => {
      if (_oiEl && _oiChart)  _oiChart.resize(_oiEl.clientWidth, _oiEl.clientHeight);
      if (_volEl && _volChart) _volChart.resize(_volEl.clientWidth, _volEl.clientHeight);
    });
  }

  function open(container) {
    _ensureCharts(container);
    refresh();
  }

  // Popup açıkken sembol/TF değişirse (kullanıcı ana chart'ta coin/periyot
  // değiştirirse) grafikleri taze tut.
  if (typeof EventBus !== 'undefined') {
    EventBus.on('symbol:change', () => {
      if (window.MiniFloatingWindow?.isVisible('oi')) refresh();
    });
    EventBus.on('tf:change', () => {
      if (window.MiniFloatingWindow?.isVisible('oi')) _refreshFromActivePane();
    });
    EventBus.on('feed:candles', () => {
      if (window.MiniFloatingWindow?.isVisible('oi')) _refreshFromActivePane();
    });
  }

  return { open, refresh };
})();

window.OiVolumePanel = OiVolumePanel;
