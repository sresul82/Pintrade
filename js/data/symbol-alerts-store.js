/* ============================================================
   symbol-alerts-store.js  —  Delist / Yeni Liste Uyarı Katmanı
   ============================================================
   Görev 8 (2026-08-08). Sunucunun `/api/symbol-status/events`
   endpoint'inden (server.js'teki collectSymbolStatusChanges()) periyodik
   olarak beslenir — bu bizim KENDİ backend'imiz, Binance'e gitmiyor, bu
   yüzden BotEngine kuyruğuna gerek yok (BotEngine sadece Binance IP
   rate-limit bütçesini paylaşan istekler için).

   Kapsam (2026-08-27 genişletildi): Binance (spot+futures) VE Bybit
   (sadece futures/linear — bu projede Bybit SPOT hiç yok). Aynı sembol
   (ör. BTCUSDT) iki borsada da var olabileceği için maps artık
   `exchange` ile de ayrılıyor — aksi halde Binance'teki bir delist olayı
   Bybit'in aynı isimli sembolüne yanlışlıkla sızardı.

   EventBus Events:
     'symbolAlerts:updated' → {} (yeni veri geldiğinde)

   Public API:
     SymbolAlertsStore.start()
     SymbolAlertsStore.getAlert(pairSym, market, exchange='binance') → 'delist_warning' | 'new_listing' | null
     SymbolAlertsStore.getDelistSymbols(market, exchange='binance')      → string[]
     SymbolAlertsStore.getNewListingSymbols(market, exchange='binance')  → string[]
     SymbolAlertsStore.isLoaded()
   ============================================================ */

const SymbolAlertsStore = (() => {

  const REFRESH_MS = 5 * 60 * 1000; // 5dk — kendi backend'imiz, ağır değil

  const _emptyBucket = () => ({ spot: new Map(), futures: new Map() });
  // exchange -> { spot: Map<pairSymbol,{category,timestamp}>, futures: Map<...> }
  const _delist     = { binance: _emptyBucket(), bybit: _emptyBucket() };
  const _newListing = { binance: _emptyBucket(), bybit: _emptyBucket() };
  let _loaded = false;
  let _timer  = null;

  function _backendBase() {
    return window.AppConfig?.SYNC_API?.replace('/api/sync', '')
      || window.AppConfig?.API?.binance?.restFutures?.replace('/api/binance/futures', '')
      || 'https://pintrade-uwg9.onrender.com';
  }

  async function _refresh() {
    try {
      const res = await fetch(`${_backendBase()}/api/symbol-status/events?hours=168`);
      if (!res.ok) return;
      const events = await res.json();
      if (!Array.isArray(events)) return;

      const delist     = { binance: _emptyBucket(), bybit: _emptyBucket() };
      const newListing = { binance: _emptyBucket(), bybit: _emptyBucket() };

      // Sunucu timestamp DESC sıralı döndürüyor — ilk görülen (en yeni)
      // olay kalır, Map.has ile üzerine yazılmıyor.
      events.forEach(e => {
        const exch = delist[e.exchange] ? e.exchange : 'binance'; // bilinmeyen exchange gelirse sessizce binance'e düşür
        const target = e.category === 'delist_warning' ? delist
          : e.category === 'new_listing' ? newListing
          : null;
        const map = target?.[exch]?.[e.market];
        if (!map || map.has(e.symbol)) return;
        map.set(e.symbol, { category: e.category, timestamp: e.timestamp });
      });

      _delist.binance = delist.binance;         _delist.bybit = delist.bybit;
      _newListing.binance = newListing.binance; _newListing.bybit = newListing.bybit;
      _loaded = true;
      if (typeof EventBus !== 'undefined') EventBus.emit('symbolAlerts:updated', {});
    } catch (e) {
      console.warn('[SymbolAlertsStore] Yenileme hatası:', e.message);
    }
  }

  function start() {
    if (_timer) return; // idempotent
    _refresh();
    _timer = setInterval(_refresh, REFRESH_MS);
  }

  /** @returns {'delist_warning'|'new_listing'|null} */
  function getAlert(pairSym, market, exchange = 'binance') {
    if (_delist[exchange]?.[market]?.has(pairSym)) return 'delist_warning';
    if (_newListing[exchange]?.[market]?.has(pairSym)) return 'new_listing';
    return null;
  }

  function getDelistSymbols(market, exchange = 'binance')     { return [...(_delist[exchange]?.[market]?.keys() || [])]; }
  function getNewListingSymbols(market, exchange = 'binance') { return [...(_newListing[exchange]?.[market]?.keys() || [])]; }
  function isLoaded() { return _loaded; }

  return { start, refresh: _refresh, getAlert, getDelistSymbols, getNewListingSymbols, isLoaded };
})();

window.SymbolAlertsStore = SymbolAlertsStore;
