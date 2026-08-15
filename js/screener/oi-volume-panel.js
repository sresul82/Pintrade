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
  // [2026-08-15, kullanıcı isteği] TF değiştikçe grafik "yakınlaşsın" — her
  // TF'te sondan en fazla bu kadar bar görünür (setVisibleLogicalRange ile).
  // Küçük TF'lerde bar süresi kısa olduğu için bu aynı bar sayısı otomatik
  // olarak daha dar/güncel bir zaman penceresine denk gelir (5m: ~3.3s,
  // 1D: veri tavanı 48s olduğu için zaten tamamı görünür).
  const VISIBLE_BARS = 40;
  // [2026-08-15, kullanıcı isteği] Popup resize edilebilir (hem dikey hem
  // yatay) — genişletilince zaman ekseninde daha fazla bar/zaman görünsün
  // (ana chart'ta olduğu gibi). Sabit bar sayısı yerine, mevcut piksel
  // genişliğine göre "bu genişlikte kaç bar sığar" hesaplanıyor.
  const BAR_PX = 6;
  function _barsForWidth(w) {
    return Math.max(15, Math.floor((w || 0) / BAR_PX)) || VISIBLE_BARS;
  }

  let _oiChart = null, _oiSeries = null, _oiEl = null;
  let _volChart = null, _volSeries = null, _volEl = null;
  let _oiDataLen = 0, _volDataLen = 0;
  let _ro = null;
  let _tf = DEFAULT_TF;
  let _currentSymbol = null, _currentExchange = null;
  let _rawOiRecords = []; // ham (~1dk) OI geçmişi — TF değişince yeniden çekilmez

  /** "#00f3ff" gibi bir hex rengi verilen alpha ile "rgba(0,243,255,a)"'ya çevirir. */
  function _withAlpha(hex, alpha) {
    const h = hex.replace('#', '');
    const r = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  /** lightweight-charts Canvas üzerine çizer — CSS'in aksine ham 'var(--x)'
   *  string'lerini ÇÖZEMEZ (sadece DOM/CSSOM cascade çözer). Bunları
   *  getComputedStyle ile gerçek renk değerine çevirmeden geçmek, önceki
   *  sürümde OI ekseninin/yazısının "siyah fon üzerine siyah yazı" gibi
   *  görünmesine (aslında geçersiz renk → varsayılan siyaha düşmesine) yol
   *  açan asıl sebepti. */
  function _cssVar(name, fallback) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
  }

  function _chartOpts() {
    return {
      // [2026-08-15, kullanıcı geri bildirimi] --text-secondary (#787b86)
      // koyu zemin üzerinde okunaksız bulundu — eksen yazıları --text-primary
      // ile daha açık/beyaza yakın renkte.
      layout: { background: { type: 'solid', color: 'transparent' }, textColor: _cssVar('--text-primary', '#d1d4dc'), fontSize: 10 },
      grid: { vertLines: { color: 'rgba(255,255,255,0.04)' }, horzLines: { color: 'rgba(255,255,255,0.04)' } },
      rightPriceScale: { borderColor: _cssVar('--border-primary', 'rgba(255,255,255,0.1)') },
      timeScale: { borderColor: _cssVar('--border-primary', 'rgba(255,255,255,0.1)'), timeVisible: true },
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
  }

  /** İmleç grafiğin üzerine gelince (crosshair) zaman + değeri gösteren
   *  küçük bir tooltip — referans TradingView/Visivero'daki gibi. lightweight-
   *  charts'ın kendi built-in tooltip'i yok, subscribeCrosshairMove ile elle
   *  konumlanan bir DOM elemanı kullanılıyor. */
  function _attachTooltip(chart, series, hostEl, formatValue) {
    const tip = document.createElement('div');
    tip.style.cssText = 'position:absolute; display:none; pointer-events:none; background:var(--bg-secondary); border:1px solid var(--border-primary); border-radius:4px; padding:3px 7px; font-size:10px; color:var(--text-primary); z-index:5; white-space:nowrap;';
    hostEl.appendChild(tip);
    chart.subscribeCrosshairMove((param) => {
      if (!param.time || !param.point || param.point.x < 0 || param.point.y < 0) {
        tip.style.display = 'none';
        return;
      }
      const d = param.seriesData.get(series);
      if (!d || d.value == null) {
        tip.style.display = 'none';
        return;
      }
      const dt = new Date(param.time * 1000);
      const timeStr = dt.toLocaleString('tr-TR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
      tip.textContent = `${timeStr}  ·  ${formatValue(d.value)}`;
      tip.style.display = 'block';
      // [2026-08-15, kullanıcı isteği] Tooltip artık crosshair noktasının
      // hemen üstünde konumlanıyor (önceden grafiğin üst kenarına sabitti).
      let left = param.point.x - tip.offsetWidth / 2;
      left = Math.max(0, Math.min(left, hostEl.clientWidth - tip.offsetWidth));
      let top = param.point.y - tip.offsetHeight - 8;
      if (top < 0) top = param.point.y + 10; // üstte yer yoksa noktanın altına al
      tip.style.left = left + 'px';
      tip.style.top = top + 'px';
    });
  }

  function _ensureCharts(container) {
    if (_oiChart) return;
    // [2026-08-15, kullanıcı isteği] Resize artık DIŞ pencerede (mini-
    // floating-window.js'teki .mfw-panel, _PANEL_OPTS.oi.resizable) —
    // burası sadece o pencerenin kalan alanını dolduruyor (flex:1). Önceden
    // burada kendi sabit width/height + resize:both'u vardı, ama dış
    // sarmalayıcı hâlâ sabit/dar olduğu için taşan kısım kırpılıyordu
    // (fiyat cetveli kayboluyordu) — kullanıcı bunu fark etti.
    container.style.cssText = 'display:flex; flex-direction:column; gap:6px; padding:8px; text-align:left; overflow:hidden; flex:1 1 auto; min-height:0; width:100%; box-sizing:border-box;';
    container.innerHTML = `
      <div id="mfw-oi-tf" style="display:flex; gap:2px; flex-shrink:0;"></div>
      <div style="font-size:9px; font-weight:700; color:var(--text-primary); text-transform:uppercase; letter-spacing:0.3px;">Open Interest</div>
      <div id="mfw-oi-chart" style="flex:1; min-height:90px; position:relative;"></div>
      <div style="font-size:9px; font-weight:700; color:var(--text-primary); text-transform:uppercase; letter-spacing:0.3px;">Volume</div>
      <div id="mfw-vol-chart" style="flex:1; min-height:90px; position:relative;"></div>
    `;
    _oiEl  = container.querySelector('#mfw-oi-chart');
    _volEl = container.querySelector('#mfw-vol-chart');

    // [2026-08-15, kullanıcı geri bildirimi] Neon accent-blue yerine beyaza
    // yakın çizgi — --text-primary KULLANILIYOR (bu kez kasıtlı): dark
    // temada #d1d4dc (beyaza çok yakın, kullanıcının istediği "beyaz"
    // görünümü verir) ve light temada #1f2328'e döner (beyaz zeminde bir
    // beyaz çizgi görünmez olurdu — tema-duyarlı olması şart).
    const LINE_COLOR = _cssVar('--text-primary', '#d1d4dc');
    const opts = _chartOpts();
    _oiChart = LightweightCharts.createChart(_oiEl, opts);
    _oiSeries = _oiChart.addAreaSeries({
      lineColor: LINE_COLOR, lineWidth: 1.5,
      topColor: _withAlpha(LINE_COLOR, 0.24), bottomColor: _withAlpha(LINE_COLOR, 0),
      priceLineVisible: false,
    });

    _volChart = LightweightCharts.createChart(_volEl, opts);
    _volSeries = _volChart.addAreaSeries({
      lineColor: LINE_COLOR, lineWidth: 1.5,
      topColor: _withAlpha(LINE_COLOR, 0.24), bottomColor: _withAlpha(LINE_COLOR, 0),
      priceLineVisible: false,
    });

    const _fmtVal = (v) => (typeof formatVolume === 'function' ? formatVolume(v) : v);
    _attachTooltip(_oiChart, _oiSeries, _oiEl, _fmtVal);
    _attachTooltip(_volChart, _volSeries, _volEl, _fmtVal);

    // [2026-08-15, kullanıcı isteği] Sadece piksel boyutunu değil, görünür
    // bar sayısını da yeniden hesaplıyor — popup genişletildikçe zaman
    // ekseninde daha fazla bar/zaman görünsün.
    _ro = new ResizeObserver(() => {
      if (_oiEl && _oiChart) {
        _oiChart.resize(_oiEl.clientWidth, _oiEl.clientHeight);
        _applyZoom(_oiChart, _oiDataLen, _barsForWidth(_oiEl.clientWidth));
      }
      if (_volEl && _volChart) {
        _volChart.resize(_volEl.clientWidth, _volEl.clientHeight);
        _applyZoom(_volChart, _volDataLen, _barsForWidth(_volEl.clientWidth));
      }
    });
    _ro.observe(_oiEl);
    _ro.observe(_volEl);

    _renderTfButtons(container.querySelector('#mfw-oi-tf'));
  }

  function _renderTfButtons(el) {
    if (!el) return;
    // [2026-08-15, kullanıcı geri bildirimi: "tek elden çıkmış gibi olmalı"]
    // Aktif buton vurgusu artık projedeki TEK referans örnekle (css/chart.css
    // .rsb-btn.active + .rsb-label — sidebar'ın "yumuşak turkuaz" hissi)
    // birebir aynı formülü kullanıyor: renk + text-shadow glow. Önceden
    // burada glow yoktu, sadece düz renk vardı — aynı hex olsa da glow'suz
    // çok daha "çıplak/keskin neon" görünüyordu.
    el.innerHTML = TF_OPTIONS.map(tf => `
      <button type="button" data-tf="${tf}" style="
        padding:2px 8px; font-size:10px; font-weight:600; border-radius:4px; cursor:pointer;
        background:transparent;
        border:1px solid ${tf === _tf ? 'var(--accent-blue)' : 'var(--border-primary)'};
        color:${tf === _tf ? 'var(--accent-blue)' : 'var(--text-secondary)'};
        text-shadow:${tf === _tf ? 'var(--accent-blue-glow)' : 'none'};
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

  /** setData() sonrası tüm veriyi (fitContent) değil, sondan VISIBLE_BARS
   *  kadarını gösterir — TF küçüldükçe bar süresi kısaldığı için bu aynı bar
   *  sayısı otomatik olarak daha dar/güncel bir zaman penceresi anlamına
   *  gelir (kullanıcı isteği: "TF değiştikçe grafik çizgisi yakınlaşsın"). */
  function _applyZoom(chart, barCount, barsVisible) {
    if (!chart || !barCount) return;
    const visible = barsVisible || VISIBLE_BARS;
    const to = barCount - 1 + 2; // sağda birkaç bar boşluk
    const from = Math.max(0, barCount - visible);
    chart.timeScale().setVisibleLogicalRange({ from, to });
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
    _oiDataLen = data.length;
    _applyZoom(_oiChart, _oiDataLen, _barsForWidth(_oiEl?.clientWidth));
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
      _volDataLen = data.length;
      _applyZoom(_volChart, _volDataLen, _barsForWidth(_volEl?.clientWidth));
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
