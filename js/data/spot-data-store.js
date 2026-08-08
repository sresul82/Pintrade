/* ============================================================
   spot-data-store.js  —  Binance SPOT Ticker Veri Havuzu (Görev 7)
   ============================================================
   MarketDataStore'un futures ticker akışıyla AYNI desen — tek WS
   bağlantısı, tüm market batch halinde akar. Kapsam bilinçli olarak
   dar: sadece fiyat/değişim/hacim (Watchlist SPOT listesi için).
   FR/OI/sinyal Binance SPOT'ta yok — o yüzden burada da yok.

   WebSocket Stream:
     !miniTicker@arr  → fiyat, 24h değişim, hacim  (spot WS: wsSpot)

   REST (günde bir):
     /api/v3/exchangeInfo  → geçerli TRADING/USDT sembol listesi
     (delist olan coinleri WS akışından süzmek için — ScreenerCore'un
     futures için kullandığı günlük sembol cache örüntüsüyle aynı)

   EventBus Events:
     'spot:tick'  → { symbol, price, pct24h, volume24h, volumeBase24h }
     'spot:ready' → {} (sembol listesi + ilk WS mesajı hazır olunca)

   Public API:
     SpotDataStore.start()
     SpotDataStore.stop()
     SpotDataStore.isReady()
     SpotDataStore.getTicker(sym)
     SpotDataStore.getAllTickers()
   ============================================================ */

const SpotDataStore = (() => {

  const _tickers = new Map();   // sym → { price, pct24h, volume24h, volumeBase24h, ts }
  let _validSymbols = new Set(); // TRADING durumundaki USDT spot çiftleri

  let _ws          = null;
  let _reconnectMs = 1000;
  const RECONNECT_MAX = 30000;
  let _stopped  = true;
  let _ready    = false;

  function _emit(event, data) {
    if (typeof EventBus !== 'undefined') EventBus.emit(event, data);
  }

  // ── Günlük sembol cache (ScreenerCore'un futures için kullandığı
  //    örüntüyle aynı — delist korumasi, günde bir istek) ──────────
  const LS_KEY = 'pintrade_spot_sym_cache';

  function _today() { return new Date().toISOString().slice(0, 10); }

  function _loadSymCache() {
    try {
      const s = localStorage.getItem(LS_KEY);
      if (s) return JSON.parse(s);
    } catch {}
    return { symbols: [], date: '' };
  }

  function _saveSymCache(symbols) {
    try { localStorage.setItem(LS_KEY, JSON.stringify({ symbols, date: _today() })); } catch {}
  }

  async function _ensureValidSymbols() {
    const cache = _loadSymCache();
    if (cache.date === _today() && cache.symbols.length > 0) {
      _validSymbols = new Set(cache.symbols);
      return;
    }
    try {
      const base = AppConfig?.API?.binance?.restSpot || 'https://api.binance.com/api/v3';
      const res = await fetch(`${base}/exchangeInfo?_t=${Date.now()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const syms = (data.symbols || [])
        .filter(s => s.status === 'TRADING' && s.quoteAsset === 'USDT')
        .map(s => s.symbol);
      _validSymbols = new Set(syms);
      _saveSymCache(syms);
    } catch (e) {
      console.warn('[SpotDataStore] Sembol listesi çekilemedi:', e.message);
      if (cache.symbols.length > 0) _validSymbols = new Set(cache.symbols); // eski cache'i kullan
    }
  }

  // ── WebSocket ────────────────────────────────────────────────
  function _connect() {
    if (_stopped) return;
    const wsUrl = `${AppConfig?.API?.binance?.wsSpot || 'wss://stream.binance.com:9443/stream'}?streams=!miniTicker@arr`;
    console.log('[SpotDataStore] WS bağlanıyor…');
    _ws = new WebSocket(wsUrl);

    _ws.onopen = () => {
      console.log('[SpotDataStore] WS bağlandı ✓');
      _reconnectMs = 1000;
    };

    _ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        const data = msg.data;
        if (!Array.isArray(data)) return;
        _handleMiniTicker(data);
        if (!_ready) {
          _ready = true;
          _emit('spot:ready', {});
          console.log('[SpotDataStore] İlk veri alındı, hazır ✓');
        }
      } catch (e) {
        console.warn('[SpotDataStore] WS parse hatası:', e.message);
      }
    };

    _ws.onerror = (e) => console.warn('[SpotDataStore] WS hata:', e.type);

    _ws.onclose = () => {
      console.warn('[SpotDataStore] WS kapandı.');
      if (_stopped) return;
      setTimeout(() => { if (!_stopped) _connect(); }, _reconnectMs);
      _reconnectMs = Math.min(_reconnectMs * 2, RECONNECT_MAX);
    };
  }

  function _handleMiniTicker(arr) {
    arr.forEach(d => {
      if (!d.s || !d.s.endsWith('USDT')) return;
      if (_validSymbols.size > 0 && !_validSymbols.has(d.s)) return; // delist/geçersiz koruması
      const sym    = d.s;
      const price  = parseFloat(d.c);
      const pct24h = null; // miniTicker %değişim vermiyor, aşağıda ayrıca hesaplanıyor (o = open price)
      const openPrice = parseFloat(d.o);
      const pct = openPrice ? ((price - openPrice) / openPrice) * 100 : null;
      const vol24h     = parseFloat(d.q); // quote volume (USDT)
      const volBase24h = parseFloat(d.v); // base asset volume
      const ts = Date.now();

      _tickers.set(sym, { price, pct24h: pct, volume24h: vol24h, volumeBase24h: volBase24h, ts });
      _emit('spot:tick', { symbol: sym, price, pct24h: pct, volume24h: vol24h, volumeBase24h: volBase24h });
    });
  }

  // ── Başlat / Durdur ─────────────────────────────────────────
  let _starting = false; // start() eş zamanlı/tekrar çağrılırsa ikinci WS açılmasın

  async function start() {
    if (!_stopped || _starting) return; // zaten çalışıyor veya başlatılıyor
    _starting = true;
    _stopped = false;
    await _ensureValidSymbols();
    _connect();
    _starting = false;
    console.log('[SpotDataStore] Başlatıldı ✓');
  }

  function stop() {
    _stopped = true;
    if (_ws) {
      _ws.onclose = null;
      _ws.close(1000, 'SpotDataStore stopped');
      _ws = null;
    }
    _ready = false;
    console.log('[SpotDataStore] Durduruldu.');
  }

  function isReady() { return _ready; }

  function getTicker(sym) {
    const key = sym.endsWith('USDT') ? sym : sym + 'USDT';
    return _tickers.get(key) || null;
  }

  function getAllTickers() { return _tickers; }

  return { start, stop, isReady, getTicker, getAllTickers };
})();

window.SpotDataStore = SpotDataStore;
