const STORAGE_KEY = 'perpetual_state_v1';

const defaults = {
  theme: 'dark',
  activeSymbol: 'BTCUSDT',
  activeExchange: 'binance',
  activeTf: '1H',
  candleStyle: 'candlestick',
  chartLayout: '1',
  showCountdown: false,
  watchlistOpen: false,
  watchlistTab: 'bn-screener',
  detailTab: 'detail',
  panelHeight: 220,

  paneStates: {}, // Fix: Persist individual pane configs across F5

  indicators: [],
  drawings: {},
  templates: [],

  alarms: [],
  watchlistFavorites: [],

  timezone: 'UTC',

  priceScale: 'normal',
  magnetMode: false,
  lockDrawings: false,
  drawingStyles: {}, // Stores last-used styles per tool

  coinstrip: ['changePct', 'fr', 'bybitFr', 'oi', 'volume24h', 'spike1m'],
};

const State = (() => {
  let _state = { ...defaults };

  function load() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) _state = { ...defaults, ...JSON.parse(saved) };
      
      // Self-heal: normalize symbol format
      // 1) Strip perpetual suffixes like ".P" → "BTCUSDT.P" → "BTCUSDT"
      if (_state.activeSymbol) {
         _state.activeSymbol = _state.activeSymbol.replace(/\.P$/i, '').replace(/USDT\.P$/i, 'USDT');
      }
      // 2) If still doesn't end with USDT after stripping, append it
      if (_state.activeSymbol && !_state.activeSymbol.toUpperCase().endsWith('USDT')) {
         _state.activeSymbol += 'USDT';
      }
    } catch (e) {
      console.warn('[State] Failed to load from localStorage');
    }
  }

  // --- Cloud Sync ---
  let _syncTimeout = null;

  function getSyncKey() {
    return localStorage.getItem('pintrade_sync_key') || '';
  }

  function setSyncKey(key) {
    if (!key) {
      localStorage.removeItem('pintrade_sync_key');
    } else {
      localStorage.setItem('pintrade_sync_key', key);
    }
    fetchCloudDrawings();
  }

  async function fetchCloudDrawings() {
    const key = getSyncKey();
    if (!key) return; // Anonim mode
    try {
      const res = await fetch(`${AppConfig.SYNC_API}/drawings?syncKey=${encodeURIComponent(key)}`);
      if (res.ok) {
        const data = await res.json();
        _state.drawings = data || {};
        
        // Sadece localStorage'ı güncelle, cloud sync tetikleme!
        const toSave = { ..._state };
        delete toSave.indicators;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));

        EventBus.emit('drawings:cloud:synced');
      }
    } catch(err) {
      console.warn('[State] Cloud Sync fetch failed:', err);
    }
  }

  async function _syncSymbolToCloud(symbol) {
    const key = getSyncKey();
    if (!key || !symbol) return;
    try {
      await fetch(`${AppConfig.SYNC_API}/drawings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          syncKey: key,
          symbol: symbol,
          drawings: _state.drawings[symbol] || []
        })
      });
    } catch(err) {
      console.warn('[State] Cloud Sync save failed:', err);
    }
  }

  function syncDrawingsCloud(symbol) {
    if (_syncTimeout) clearTimeout(_syncTimeout);
    _syncTimeout = setTimeout(() => {
      _syncSymbolToCloud(symbol);
    }, 1000); // Debounce
  }

  function save() {
    try {
      const toSave = { ..._state };
      delete toSave.indicators;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
      
      // Auto-sync the active symbol's drawings when state is saved
      if (_state.activeSymbol) {
        syncDrawingsCloud(_state.activeSymbol);
      }
    } catch (e) {
      console.warn('[State] Failed to save to localStorage');
    }
  }

  function get(key) {
    return key ? _state[key] : { ..._state };
  }

  function set(key, value, silent = false) {
    const prev = _state[key];
    _state[key] = value;
    save();
    if (!silent) EventBus.emit(`state:${key}`, { value, prev });
  }

  function setSymbol(symbol, exchange) {
    const prev = _state.activeSymbol;
    _state.activeSymbol = symbol;
    _state.activeExchange = exchange || _state.activeExchange;
    save();
    EventBus.emit('symbol:change', {
      symbol,
      exchange: _state.activeExchange,
      prevSymbol: prev
    });
  }

  function setTheme(theme) {
    _state.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    save();
    EventBus.emit('theme:change', { theme });
  }

  function toggleTheme() {
    setTheme(_state.theme === 'dark' ? 'light' : 'dark');
  }

  function setTf(tf) {
    _state.activeTf = tf;
    save();
    EventBus.emit('chart:tf:change', { tf });
  }

  function setLayout(layout) {
    _state.chartLayout = layout;
    save();
    EventBus.emit('chart:layout:change', { layout });
  }

  function toggleWatchlist() {
    _state.watchlistOpen = !_state.watchlistOpen;
    save();
    EventBus.emit('watchlist:toggle', { open: _state.watchlistOpen });
  }

  function addDrawing(symbol, drawing) {
    if (!_state.drawings[symbol]) _state.drawings[symbol] = [];
    _state.drawings[symbol].push(drawing);
    save();
  }

  function removeDrawing(symbol, id) {
    if (!_state.drawings[symbol]) return;
    _state.drawings[symbol] = _state.drawings[symbol].filter(d => d.id !== id);
    save();
  }

  function getDrawings(symbol) {
    return _state.drawings[symbol] || [];
  }

  function init() {
    load();
    document.documentElement.setAttribute('data-theme', _state.theme);
    // Açılışta cloud'dan çek
    fetchCloudDrawings();
  }

  return {
    get, set, save, load, init,
    setSymbol, setTheme, toggleTheme,
    setTf, setLayout, toggleWatchlist,
    addDrawing, removeDrawing, getDrawings,
    getSyncKey, setSyncKey, fetchCloudDrawings
  };
})();

