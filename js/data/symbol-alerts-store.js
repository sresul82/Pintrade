/* ============================================================
   symbol-alerts-store.js  —  Delist / Yeni Liste Uyarı Katmanı
   ============================================================
   Görev 8 (2026-08-08). Sunucunun `/api/symbol-status/events`
   endpoint'inden (server.js'teki collectSymbolStatusChanges()) periyodik
   olarak beslenir — bu bizim KENDİ backend'imiz, Binance'e gitmiyor, bu
   yüzden BotEngine kuyruğuna gerek yok (BotEngine sadece Binance IP
   rate-limit bütçesini paylaşan istekler için).

   Kapsam: sadece Binance (spot + futures) — Bybit için aynı public
   status mekanizması araştırılmadı, faz 2. `getAlert()` Bybit sembolleri
   için her zaman null döner (veri yok, sessizce yanlış göstermek yerine).

   EventBus Events:
     'symbolAlerts:updated' → {} (yeni veri geldiğinde)

   Public API:
     SymbolAlertsStore.start()
     SymbolAlertsStore.getAlert(pairSym, market) → 'delist_warning' | 'new_listing' | null
     SymbolAlertsStore.getDelistSymbols(market)      → string[]
     SymbolAlertsStore.getNewListingSymbols(market)  → string[]
     SymbolAlertsStore.isLoaded()
   ============================================================ */

const SymbolAlertsStore = (() => {

  const REFRESH_MS = 5 * 60 * 1000; // 5dk — kendi backend'imiz, ağır değil

  // market ('spot'|'futures') -> Map<pairSymbol, { category, timestamp }>
  const _delist     = { spot: new Map(), futures: new Map() };
  const _newListing = { spot: new Map(), futures: new Map() };
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

      const delist     = { spot: new Map(), futures: new Map() };
      const newListing = { spot: new Map(), futures: new Map() };

      // Sunucu timestamp DESC sıralı döndürüyor — ilk görülen (en yeni)
      // olay kalır, Map.has ile üzerine yazılmıyor.
      events.forEach(e => {
        const target = e.category === 'delist_warning' ? delist
          : e.category === 'new_listing' ? newListing
          : null;
        const map = target?.[e.market];
        if (!map || map.has(e.symbol)) return;
        map.set(e.symbol, { category: e.category, timestamp: e.timestamp });
      });

      _delist.spot = delist.spot;         _delist.futures = delist.futures;
      _newListing.spot = newListing.spot; _newListing.futures = newListing.futures;
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
  function getAlert(pairSym, market) {
    if (_delist[market]?.has(pairSym)) return 'delist_warning';
    if (_newListing[market]?.has(pairSym)) return 'new_listing';
    return null;
  }

  function getDelistSymbols(market)     { return [...(_delist[market]?.keys() || [])]; }
  function getNewListingSymbols(market) { return [...(_newListing[market]?.keys() || [])]; }
  function isLoaded() { return _loaded; }

  return { start, refresh: _refresh, getAlert, getDelistSymbols, getNewListingSymbols, isLoaded };
})();

window.SymbolAlertsStore = SymbolAlertsStore;
