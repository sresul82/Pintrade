/* ──────────────────────────────────────────────────────────
   app-config.js  —  Global uygulama sabitleri
   Tüm modüller bu dosyayı okur, doğrudan değiştirmez.
────────────────────────────────────────────────────────── */
const AppConfig = (() => {

  const IS_LOCAL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const BACKEND_URL = IS_LOCAL ? 'http://localhost:5500' : 'https://pintrade-uwg9.onrender.com';

  /* ── API ──────────────────────────────────────────────── */
  const API = {
    binance: {
      // REST istekleri artık server.js üzerinden proxy'lenir (CORS çözümü)
      restFutures:  `${BACKEND_URL}/api/binance/futures`,
      restSpot:     `${BACKEND_URL}/api/binance/spot`,
      // WebSocket doğrudan bağlanır (CORS kuralı WebSocket'e uygulanmaz)
      wsFutures:    'wss://fstream.binance.com/stream',
      wsSpot:       'wss://stream.binance.com:9443/stream',
    },
    bybit: {
      rest:  'https://api.bybit.com',
      ws:    'wss://stream.bybit.com/v5/public/linear',
    },
  };

  const SYNC_API = `${BACKEND_URL}/api/sync`;

  /* ── Zaman Dilimleri ─────────────────────────────────── */
  const TF_MAP = {
    '1m': '1m', '3m': '3m', '5m': '5m', '15m': '15m', '30m': '30m',
    '1H': '1h', '2H': '2h', '4H': '4h', '6H': '6h', '12H': '12h',
    '1D': '1d', '3D': '3d', '1W': '1w', '1M': '1M',
  };

  const TF_ORDER = ['1m','3m','5m','15m','30m','1H','2H','4H','6H','12H','1D','3D','1W','1M'];

  const TF_TTL = {
    '1m':  3 * 24 * 60 * 60 * 1000,
    '3m':  3 * 24 * 60 * 60 * 1000,
    '5m':  7 * 24 * 60 * 60 * 1000,
    '15m': 7 * 24 * 60 * 60 * 1000,
    '30m': 7 * 24 * 60 * 60 * 1000,
    '1H':  7 * 24 * 60 * 60 * 1000,
    '2H':  30 * 24 * 60 * 60 * 1000,
    '4H':  30 * 24 * 60 * 60 * 1000,
    '6H':  30 * 24 * 60 * 60 * 1000,
    '12H': 30 * 24 * 60 * 60 * 1000,
    '1D':  30 * 24 * 60 * 60 * 1000,
    '3D':  90 * 24 * 60 * 60 * 1000,
    '1W':  90 * 24 * 60 * 60 * 1000,
    '1M':  90 * 24 * 60 * 60 * 1000,
  };

  /* ── Grafik Varsayılanları ────────────────────────────── */
  const CHART = {
    defaultSymbol:   'BTCUSDT',
    defaultTf:       '1H',
    defaultExchange: 'binance',
    klinesLimit:     500,
    klinesMaxPage:   1000,
  };

  /* ── WebSocket Reconnect ──────────────────────────────── */
  const WS = {
    reconnectBaseMs:  1000,
    reconnectMaxMs:   30000,
    reconnectFactor:  2,
    pingIntervalMs:   20000,
  };

  /* ── IndexedDB ───────────────────────────────────────── */
  const IDB = {
    name:    'PerpetualChartDB',
    version: 1,
    stores: {
      ohlcv: 'ohlcv',
    },
  };

  /* ── LW Charts Tema ──────────────────────────────────── */
  const CHART_THEME = {
    dark: {
      layout: {
        background: { type: 'solid', color: '#0d1117' },
        textColor:  '#8b949e',
      },
      grid: {
        vertLines:   { color: '#161b22' },
        horzLines:   { color: '#161b22' },
      },
      crosshair: {
        vertLine: { color: '#30363d', labelBackgroundColor: '#1c2128' },
        horzLine: { color: '#30363d', labelBackgroundColor: '#1c2128' },
      },
      timeScale: { borderColor: '#21262d' },
      rightPriceScale: { borderColor: '#21262d' },
    },
    light: {
      layout: {
        background: { type: 'solid', color: '#ffffff' },
        textColor:  '#656d76',
      },
      grid: {
        vertLines:   { color: '#f6f8fa' },
        horzLines:   { color: '#f6f8fa' },
      },
      crosshair: {
        vertLine: { color: '#d0d7de', labelBackgroundColor: '#eaeef2' },
        horzLine: { color: '#d0d7de', labelBackgroundColor: '#eaeef2' },
      },
      timeScale: { borderColor: '#d0d7de' },
      rightPriceScale: { borderColor: '#d0d7de' },
    },
  };

  const CANDLE_COLORS = {
    dark: {
      up:         '#3fb950',
      down:       '#f85149',
      wickUp:     '#3fb950',
      wickDown:   '#f85149',
      borderUp:   '#3fb950',
      borderDown: '#f85149',
    },
    light: {
      up:         '#26a641',
      down:       '#cf222e',
      wickUp:     '#26a641',
      wickDown:   '#cf222e',
      borderUp:   '#26a641',
      borderDown: '#cf222e',
    },
  };

  console.log('[AppConfig] Loaded ✓');

  return {
    BACKEND_URL,
    API,
    SYNC_API,
    TF_MAP,
    TF_ORDER,
    TF_TTL,
    CHART,
    WS,
    IDB,
    CHART_THEME,
    CANDLE_COLORS,
  };
})();
