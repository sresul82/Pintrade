/**
 * OiVolumePanel
 * OI popup'unun (MiniFloatingWindow 'oi') içeriği — Open Interest ve Volume'un
 * çizgi/alan grafikleri, ortak bir TF seçiciyle (5m/15m/1H/4H/1D). 2026-08-15,
 * kullanıcı isteği (birlikte netleştirildi).
 *
 * OI: `/api/history/market` zaten en fazla 48 saatlik, ~1dk çözünürlüklü
 * ham veri veriyor (server.js'teki MarketData koleksiyonunun TTL'i de 48s).
 * Bu ham veri BİR KEZ çekilip önbelleğe alınıyor, TF butonuna tıklanınca
 * yeniden istek atılmıyor — seçilen TF'in bar süresine göre client-side
 * "resample" ediliyor (her bucket'ın son değeri alınıyor). NOT: 1D seçiliyse
 * 48 saatlik veriden sadece ~2 nokta çıkar — bu API'nin/TTL'in doğal bir
 * sınırı, hata değil.
 *
 * Volume: OI'nin aksine, aktif chart pane'inin verisine bağlı DEĞİL — TF
 * seçici bağımsız olduğu için (kullanıcı popup'ta 15m seçip ana chart'ta
 * 1H'de kalabilir) her TF değişiminde o TF için taze kline çekiliyor
 * (gerçek mum hacmi, DataFeedManager'ın canlı-abonelik mekanizmasına hiç
 * girmeden tek seferlik REST — bkz. _fetchKlines).
 */
const OiVolumePanel = (() => {
  const TF_OPTIONS = ['5m', '15m', '1H', '4H', '1D'];
  const DEFAULT_TF = '15m';
  const TF_SECONDS  = { '5m': 300, '15m': 900, '1H': 3600, '4H': 14400, '1D': 86400 };
  const BINANCE_TF  = { '5m': '5m', '15m': '15m', '1H': '1h', '4H': '4h', '1D': '1d' };
  const BYBIT_TF    = { '5m': '5', '15m': '15', '1H': '60', '4H': '240', '1D': 'D' };

  let _oiChart = null, _oiSeries = null, _oiEl = null;
  let _volChart = null, _volSeries = null, _volEl = null;
  let _ro = null;
  let _tf = DEFAULT_TF;
  let _currentSymbol = null, _currentExchange = null;
  let _rawOiRecords = []; // ham (~1dk) OI geçmişi — TF değişince yeniden çekilmez

  const CHART_OPTS = {
    layout: { background: { type: 'solid', color: 'transparent' }, textColor: 'var(--text-secondary)', fontSize: 10 },
    grid: { vertLines: { color: 'rgba(255,255,255,0.04)' }, horzLines: { color: 'rgba(255,255,255,0.04)' } },
    rightPriceScale: { borderColor: 'var(--border-primary)' },
    timeScale: { borderColor: 'var(--border-primary)', timeVisible: true },
    crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
    // OI ve Volume'un sağ eksen etiketleri (7,037,729,788.00 gibi) uzun
    // olunca iki grafiğin çizim alanı hizasız duruyordu — K/M/B kısaltması
    // (chart-config.js'teki formatVolume, ana chart'ın hacim sütununda da
    // kullanılan aynı fonksiyon) her iki eksende de kullanılınca etiket
    // genişlikleri birbirine çok yaklaşıyor, grafikler hizalanıyor.
    localization: { priceFormatter: (v) => (typeof formatVolume === 'function' ? formatVolume(v) : v) },
    handleScroll: false,
    handleScale: false,
  };

  function _ensureCharts(container) {
    if (_oiChart) return;
    container.style.cssText = 'display:flex; flex-direction:column; gap:6px; padding:8px; text-align:left; overflow:hidden; resize:vertical; height:360px; min-height:260px; max-height:70vh;';
    container.innerHTML = `
      <div id="mfw-oi-tf" style="display:flex; gap:2px; flex-shrink:0;"></div>
      <div style="font-size:9px; font-weight:700; color:var(--text-secondary); text-transform:uppercase; letter-spacing:0.3px;">Open Interest</div>
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
    _volSeries = _volChart.addAreaSeries({
      lineColor: '#f0b90b', lineWidth: 1.5,
      topColor: 'rgba(240,185,11,0.28)', bottomColor: 'rgba(240,185,11,0)',
      priceLineVisible: false,
    });

    _ro = new ResizeObserver(() => {
      if (_oiEl && _oiChart)  _oiChart.resize(_oiEl.clientWidth, _oiEl.clientHeight);
      if (_volEl && _volChart) _volChart.resize(_volEl.clientWidth, _volEl.clientHeight);
    });
    _ro.observe(_oiEl);
    _ro.observe(_volEl);

    _renderTfButtons(container.querySelector('#mfw-oi-tf'));
  }

  function _renderTfButtons(el) {
    if (!el) return;
    el.innerHTML = TF_OPTIONS.map(tf => `
      <button type="button" data-tf="${tf}" style="
        padding:2px 8px; font-size:10px; font-weight:600; border-radius:4px; cursor:pointer;
        border:1px solid var(--border-primary); background:${tf === _tf ? 'var(--accent-blue,#2962ff)' : 'transparent'};
        color:${tf === _tf ? '#fff' : 'var(--text-secondary)'};
      ">${tf}</button>`).join('');
    el.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        if (_tf === btn.dataset.tf) return;
        _tf = btn.dataset.tf;
        _renderTfButtons(el);
        _resampleOi();
        _loadVolume();
      });
    });
  }

  /** Ham (~1dk) OI kayıtlarını seçili TF'in bar süresine göre "resample"
   *  eder — her bucket'ın son (en güncel) değeri alınır. */
  function _resampleOi() {
    if (!_oiSeries || !_rawOiRecords.length) return;
    const bucketSec = TF_SECONDS[_tf];
    const buckets = new Map(); // bucketTime -> {time, value}
    for (const r of _rawOiRecords) {
      if (r.openInterest == null || !r.timestamp) continue;
      const t = Math.floor(new Date(r.timestamp).getTime() / 1000);
      const bucketTime = Math.floor(t / bucketSec) * bucketSec;
      buckets.set(bucketTime, { time: bucketTime, value: r.openInterest }); // son değer kazanır (Map insertion order + overwrite)
    }
    const data = [...buckets.values()].sort((a, b) => a.time - b.time);
    if (!data.length) return;
    _oiSeries.setData(data);
    _oiChart.timeScale().fitContent();
  }

  async function _loadOi(symbol, exchange) {
    if (!_oiSeries) return;
    try {
      const res = await fetch(`/api/history/market/${exchange}/${symbol}?hours=48`);
      if (!res.ok) return;
      _rawOiRecords = await res.json();
      _resampleOi();
    } catch (e) {
      console.warn('[OiVolumePanel] OI geçmişi çekilemedi:', e.message);
    }
  }

  /** Seçili TF için gerçek mum hacmi — aktif chart pane'inden BAĞIMSIZ, tek
   *  seferlik REST (DataFeedManager'ın canlı-abonelik/IndexedDB mekanizması
   *  devreye girmiyor, popup kapanınca iz bırakmaz). */
  async function _fetchKlines(symbol, exchange, tf, limit = 200) {
    if (exchange === 'bybit') {
      const url = `https://api.bybit.com/v5/market/kline?category=linear&symbol=${symbol}&interval=${BYBIT_TF[tf]}&limit=${limit}`;
      const res = await fetch(url);
      const json = await res.json();
      const list = json.result?.list ?? [];
      return list.map(k => ({ time: Math.floor(parseInt(k[0], 10) / 1000), value: parseFloat(k[5]) })).reverse();
    }
    const base = window.AppConfig?.API?.binance?.restFutures || 'https://pintrade-uwg9.onrender.com/api/binance/futures';
    const url = `${base}/fapi/v1/klines?symbol=${symbol}&interval=${BINANCE_TF[tf]}&limit=${limit}`;
    const res = await fetch(url);
    const raw = await res.json();
    if (!Array.isArray(raw)) return [];
    return raw.map(k => ({ time: Math.floor(k[0] / 1000), value: parseFloat(k[5]) }));
  }

  async function _loadVolume() {
    if (!_volSeries || !_currentSymbol) return;
    try {
      const data = await _fetchKlines(_currentSymbol, _currentExchange, _tf);
      if (!data.length) return;
      _volSeries.setData(data);
      _volChart.timeScale().fitContent();
    } catch (e) {
      console.warn('[OiVolumePanel] Volume geçmişi çekilemedi:', e.message);
    }
  }

  function refresh() {
    const pane = window.LayoutManager?.getActivePane?.();
    if (!pane) return;
    _currentSymbol = pane.symbol;
    _currentExchange = pane.exchange;
    _loadOi(_currentSymbol, _currentExchange);
    _loadVolume();
    requestAnimationFrame(() => {
      if (_oiEl && _oiChart)  _oiChart.resize(_oiEl.clientWidth, _oiEl.clientHeight);
      if (_volEl && _volChart) _volChart.resize(_volEl.clientWidth, _volEl.clientHeight);
    });
  }

  function open(container) {
    _ensureCharts(container);
    refresh();
  }

  if (typeof EventBus !== 'undefined') {
    EventBus.on('symbol:change', () => {
      if (window.MiniFloatingWindow?.isVisible('oi')) refresh();
    });
  }

  return { open, refresh };
})();

window.OiVolumePanel = OiVolumePanel;
