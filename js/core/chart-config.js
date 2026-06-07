/* --- config.js --- */
// ── Chart Configuration ──────────────────────────────────────
const TF_LIST = ['1m','3m','5m','15m','30m','1H','2H','4H','6H','12H','1D','1W','1M'];

const LAYOUTS = {
  '1':     { cols: 1, rows: 1, count: 1 },
  '1+1':   { cols: 2, rows: 1, count: 2 },
  '1+1+1': { cols: 3, rows: 1, count: 3 },
  '2x2':   { cols: 2, rows: 2, count: 4 },
  '2+2':   { cols: 2, rows: 2, count: 4 },
};

const CHART_TYPES = [
  { id: 'candle', label: 'Candlestick' },
  { id: 'bar',    label: 'Bar' },
  { id: 'line',   label: 'Line' },
  { id: 'area',   label: 'Area' },
];

const SCALE_MODES = [
  { id: 'normal',      label: 'Regular',      key: 'Alt+R' },
  { id: 'percent',     label: 'Percent',      key: 'Alt+P' },
  { id: 'logarithmic', label: 'Logarithmic',  key: 'Alt+L' },
];

const DEFAULTS = {
  symbol:        'BTCUSDT',
  tf:            '1H',
  chartType:     'candle',
  scaleMode:     'normal',
  priceSide:     'right',
  showGrid:      true,
  showVolume: false,
  invertScale:   false,
  priceLine:     true,
  highLowLines:  false,
  countdown:     false,
};

const COLORS = {
  bg:          '#131722',
  bgBar:       '#0e1118',
  bgPanel:     '#1a1e2d',
  bgHover:     '#252a3a',
  grid:        '#1e2130',
  border:      '#2a2e39',
  text:        '#d1d4dc',
  textSub:     '#787b86',
  textFaint:   '#4a4f5e',
  accent:      '#00b8c4',
  accentBg:    'rgba(0,184,196,.15)',
  green:       '#089981',
  red:         '#f23645',
  crosshair:   '#4a8abf',
  crosshairLbl:'#1a2035',
};

/* --- data.js --- */
// ── Demo data generator + formatting helpers ────────────────

function makeDemoData(count = 500, intervalSec = 3600) {
  const data = [];
  const now = Math.floor(Date.now() / 1000);
  // Align time to exact interval step (e.g. exactly on the hour 00:00 for 1H)
  const snappedNow = now - (now % intervalSec);
  // Fix off-by-one error: offset by (count - 1) makes the final bar exactly snappedNow
  let time = snappedNow - ((count - 1) * intervalSec);
  
  let price = 65000 + Math.random() * 8000;
  for (let i = 0; i < count; i++) {
    const open  = price;
    const close = Math.max(1, open + (Math.random() - 0.48) * 600);
    const high  = Math.max(open, close) + Math.random() * 250;
    const low   = Math.min(open, close) - Math.random() * 250;
    const volume = Math.floor(Math.random() * 2000 + 200);
    data.push({ time, open, high, low: Math.max(1, low), close, volume });
    price = close;
    time += intervalSec;
  }
  return data;
}

function _getDynamicDecimals(p) {
  if (!p || p === 0) return 2;
  const a = Math.abs(p);
  if (a >= 1000) return 2;
  if (a >= 10) return 3;
  if (a >= 1) return 4;
  const zeros = Math.max(0, -Math.floor(Math.log10(a)) - 1);
  return Math.min(8, 4 + zeros);
}

function formatPrice(v) {
  if (v == null) return '-';
  const d = _getDynamicDecimals(v);
  return v.toFixed(d);
}

function formatVolume(v) {
  if (v == null) return '—';
  if (v >= 1e9) return (v / 1e9).toFixed(2) + 'B';
  if (v >= 1e6) return (v / 1e6).toFixed(2) + 'M';
  if (v >= 1e3) return (v / 1e3).toFixed(2) + 'K';
  return Math.round(v).toString();
}

