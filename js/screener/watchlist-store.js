/* ──────────────────────────────────────────────────────────
   watchlist-store.js  —  Watchlist veri katmanı
   Global: WatchlistStore

   Sorumluluğu SADECE veri: listeler, aktif liste, sütun görünürlüğü,
   pazar filtresi. Hiç DOM'a dokunmaz. Arayüz için bkz. watchlist-menu.js

   Kalıcılık: localStorage
     pintrade_watchlists   → kullanıcı listeleri
     pintrade_wl_active    → aktif liste id'si
     pintrade_wl_columns   → gizlenen sütunlar
     pintrade_wl_market    → pazar filtresi (futures/spot)
     pintrade_wl_change_type → değişim yüzdesi hesap tipi (rolling24h/dayOpen)
     pintrade_wl_volume_type → hacim gösterim tipi (usd/standard)

   Yayınladığı olaylar (EventBus):
     watchlist:listsChanged   → liste eklendi/silindi/adı değişti/coin eklendi
     watchlist:activeChanged  → { id }
     watchlist:columnsChanged → { visible: [...] }
     watchlist:marketChanged  → { type, quote }
     watchlist:changeTypeChanged → { type }
     watchlist:volumeTypeChanged → { type }
────────────────────────────────────────────────────────── */
const WatchlistStore = (() => {

  /* ── Sabitler ─────────────────────────────────────── */
  const LS_LISTS  = 'pintrade_watchlists';
  const LS_ACTIVE = 'pintrade_wl_active';
  const LS_COLS   = 'pintrade_wl_columns';
  const LS_MARKET = 'pintrade_wl_market';
  const LS_CHANGE_TYPE = 'pintrade_wl_change_type';
  const LS_VOLUME_TYPE = 'pintrade_wl_volume_type';

  // Sistem listeleri: adı değiştirilemez, silinemez
  const ALL_ID     = 'sys:all';      // Borsadaki tüm coinler (mevcut screener davranışı)
  const SIGNALS_ID = 'sys:signals';  // Sinyaller — içinde Kom1/Kom2/Kom3 grupları

  // Sinyaller listesinin grupları. Bir coin SADECE bir grupta görünür
  // (puanlamaya göre en yükseği). Doldurma mantığı sonraki turda gelecek.
  const SIGNAL_GROUPS = [
    { id: 'kom1', name: 'Combo 1' },
    { id: 'kom2', name: 'Combo 2' },
    { id: 'kom3', name: 'Combo 3' },
  ];

  // Sütunlar. Genişlikler grid-template-columns için kullanılır.
  // sym esnek (minmax) — sütun kapatılınca artan yeri o alır.
  const ALL_COLUMNS = [
    { key: 'sym',   label: 'Symbol',     width: 'minmax(80px, 1fr)', locked: true },
    { key: 'price', label: 'Price',      width: '74px' },
    { key: 'pct',   label: 'Chg%',       width: '62px' },
    { key: 'fr',    label: 'FR%',        width: '68px' },
    { key: 'frh',   label: 'FR(h)',      width: '48px' },
    { key: 'vol',   label: 'Vol (USDT)', width: '62px' },
    { key: 'oi',    label: 'OI',         width: '56px' },
  ];

  /* ── Depolama yardımcıları ────────────────────────── */
  function _load(key, fallback) {
    try {
      const s = localStorage.getItem(key);
      if (s) return JSON.parse(s);
    } catch (e) { console.warn('[WatchlistStore] okunamadı:', key, e.message); }
    return fallback;
  }

  function _save(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); }
    catch (e) { console.warn('[WatchlistStore] kaydedilemedi:', key, e.message); }
  }

  function _emit(evt, payload) {
    if (typeof EventBus !== 'undefined') EventBus.emit(evt, payload || {});
  }

  /* ── Durum ────────────────────────────────────────── */
  // Kullanıcı listeleri: [{ id, name, symbols: ['BTCUSDT', ...] }]
  let _lists  = _load(LS_LISTS, []);
  let _active = _load(LS_ACTIVE, ALL_ID);
  // Gizlenen sütun anahtarları (varsayılan: hepsi açık)
  let _hidden = _load(LS_COLS, []);
  let _market = _load(LS_MARKET, { type: 'futures', quote: 'USDT' });
  let _changeType = _load(LS_CHANGE_TYPE, 'rolling24h'); // 'rolling24h' | 'dayOpen'
  let _volumeType = _load(LS_VOLUME_TYPE, 'usd');        // 'usd' | 'standard'

  if (!Array.isArray(_lists)) _lists = [];
  if (!Array.isArray(_hidden)) _hidden = [];

  // Aktif liste silinmişse güvenli duruma dön
  if (_active !== ALL_ID && _active !== SIGNALS_ID && !_lists.some(l => l.id === _active)) {
    _active = ALL_ID;
  }

  function _newId() {
    return 'usr:' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  /* ── Listeler ─────────────────────────────────────── */
  function getLists()  { return _lists.map(l => ({ ...l, symbols: [...l.symbols] })); }
  function getList(id) { return _lists.find(l => l.id === id) || null; }

  function isSystem(id) { return id === ALL_ID || id === SIGNALS_ID; }

  function getListName(id) {
    if (id === ALL_ID)     return 'All Coins';
    if (id === SIGNALS_ID) return 'Signals';
    return getList(id)?.name || 'All Coins';
  }

  /** Yeni liste oluşturur. Aynı isim varsa sonuna (2), (3)... ekler. */
  function createList(name) {
    let base = (name || '').trim() || 'Yeni Liste';
    let final = base, n = 2;
    while (_lists.some(l => l.name.toLowerCase() === final.toLowerCase())) {
      final = `${base} (${n++})`;
    }
    const list = { id: _newId(), name: final, symbols: [] };
    _lists.push(list);
    _save(LS_LISTS, _lists);
    _emit('watchlist:listsChanged');
    return list;
  }

  function renameList(id, name) {
    const l = getList(id);
    if (!l) return false;
    const trimmed = (name || '').trim();
    if (!trimmed) return false;
    l.name = trimmed;
    _save(LS_LISTS, _lists);
    _emit('watchlist:listsChanged');
    return true;
  }

  function deleteList(id) {
    if (isSystem(id)) return false;   // sistem listeleri silinemez
    const before = _lists.length;
    _lists = _lists.filter(l => l.id !== id);
    if (_lists.length === before) return false;
    _save(LS_LISTS, _lists);
    if (_active === id) setActive(ALL_ID);
    _emit('watchlist:listsChanged');
    return true;
  }

  /* ── Liste içeriği ────────────────────────────────── */
  // Bir coin birden fazla listede olabilir — kasıtlı, engellenmiyor.
  function addSymbol(listId, symbol) {
    const l = getList(listId);
    if (!l || !symbol) return false;
    const s = symbol.toUpperCase();
    if (l.symbols.includes(s)) return false;
    l.symbols.push(s);
    _save(LS_LISTS, _lists);
    _emit('watchlist:listsChanged');
    return true;
  }

  function removeSymbol(listId, symbol) {
    const l = getList(listId);
    if (!l) return false;
    const s = (symbol || '').toUpperCase();
    const before = l.symbols.length;
    l.symbols = l.symbols.filter(x => x !== s);
    if (l.symbols.length === before) return false;
    _save(LS_LISTS, _lists);
    _emit('watchlist:listsChanged');
    return true;
  }

  function hasSymbol(listId, symbol) {
    return !!getList(listId)?.symbols.includes((symbol || '').toUpperCase());
  }

  /** Bir coin'in bulunduğu kullanıcı listelerinin id'leri */
  function listsContaining(symbol) {
    const s = (symbol || '').toUpperCase();
    return _lists.filter(l => l.symbols.includes(s)).map(l => l.id);
  }

  /* ── Sinyaller ─────────────────────────────────────
     AlarmSignalHistory'nin güncel (Geçmiş etiketli olmayan) demo
     sinyallerinden beslenir — gerçek puanlama motoru gelene kadar. */
  function getSignalGroups() {
    const active = window.AlarmSignalHistory?.getActiveSignals?.() || [];
    return SIGNAL_GROUPS.map((g, i) => {
      const kom = i + 1; // 'kom1' → 1, 'kom2' → 2, 'kom3' → 3
      return { ...g, symbols: active.filter(s => s.kom === kom).map(s => s.symbol) };
    });
  }

  /* ── Aktif liste ──────────────────────────────────── */
  function getActiveId() { return _active; }

  function setActive(id) {
    if (id !== ALL_ID && id !== SIGNALS_ID && !getList(id)) return false;
    if (_active === id) return true;
    _active = id;
    _save(LS_ACTIVE, _active);
    _emit('watchlist:activeChanged', { id });
    return true;
  }

  /* ── Sütun görünürlüğü ────────────────────────────── */
  function getAllColumns() { return ALL_COLUMNS.map(c => ({ ...c })); }

  function isColumnVisible(key) {
    const col = ALL_COLUMNS.find(c => c.key === key);
    if (col?.locked) return true;          // Symbol her zaman açık
    return !_hidden.includes(key);
  }

  function getVisibleColumns() {
    return ALL_COLUMNS.filter(c => isColumnVisible(c.key)).map(c => ({ ...c }));
  }

  function setColumnVisible(key, visible) {
    const col = ALL_COLUMNS.find(c => c.key === key);
    if (!col || col.locked) return false;  // Symbol kapatılamaz
    _hidden = visible ? _hidden.filter(k => k !== key)
                      : (_hidden.includes(key) ? _hidden : [..._hidden, key]);
    _save(LS_COLS, _hidden);
    _emit('watchlist:columnsChanged', { visible: getVisibleColumns().map(c => c.key) });
    return true;
  }

  /** grid-template-columns değeri — görünür sütunlara göre */
  function getGridTemplate() {
    return getVisibleColumns().map(c => c.width).join(' ');
  }

  /* ── Pazar filtresi ───────────────────────────────── */
  // FUTURES ve SPOT ikisi de çalışıyor (Görev 7, 2026-08-08). SPOT'ta
  // sinyal/FR/OI sütunları yok — sadece symbol/price/chg/vol (bkz. screener-core.js).
  function getMarket() { return { ..._market }; }

  function setMarketType(type) {
    if (type !== 'futures' && type !== 'spot') return false;
    if (_market.type === type) return true;
    _market = { ..._market, type };
    _save(LS_MARKET, _market);
    _emit('watchlist:marketChanged', getMarket());
    return true;
  }

  /* ── Değişim (%) hesap tipi ───────────────────────────
     'rolling24h' → mevcut, çalışıyor (borsaların 24h ticker'ı).
     'dayOpen'    → UTC gün başı fiyatına göre — henüz veri kaynağı yok
     (500+ coin için günlük mum çekmek gerekiyor, ayrı bir iş).
     Menüde görünür/seçilebilir ama seçilince "yakında" bildirimi çıkar,
     screener'ın gösterdiği değer değişmez. */
  function getChangeType() { return _changeType; }

  function setChangeType(type) {
    if (type !== 'rolling24h') return false; // dayOpen henüz desteklenmiyor
    if (_changeType === type) return true;
    _changeType = type;
    _save(LS_CHANGE_TYPE, _changeType);
    _emit('watchlist:changeTypeChanged', { type: _changeType });
    return true;
  }

  /* ── Hacim gösterim tipi ───────────────────────────────
     'usd'      → mevcut, çalışıyor (quoteVolume / turnover24h).
     'standard' → coin cinsinden hacim (baseVolume) — çalışıyor,
     borsalardan zaten çekiliyor, sadece görünüm değişir. */
  function getVolumeType() { return _volumeType; }

  function setVolumeType(type) {
    if (type !== 'usd' && type !== 'standard') return false;
    if (_volumeType === type) return true;
    _volumeType = type;
    _save(LS_VOLUME_TYPE, _volumeType);
    _emit('watchlist:volumeTypeChanged', { type: _volumeType });
    return true;
  }

  console.log('[WatchlistStore] Loaded ✓');

  return {
    ALL_ID, SIGNALS_ID, SIGNAL_GROUPS,
    getLists, getList, getListName, isSystem,
    createList, renameList, deleteList,
    addSymbol, removeSymbol, hasSymbol, listsContaining,
    getSignalGroups,
    getActiveId, setActive,
    getAllColumns, getVisibleColumns, isColumnVisible, setColumnVisible, getGridTemplate,
    getMarket, setMarketType,
    getChangeType, setChangeType,
    getVolumeType, setVolumeType,
  };
})();

// Klasik script'te üst seviye `const` window'a eklenmez; diğer modüller
// `window.WatchlistStore` diye kontrol ettiği için açıkça yazıyoruz.
window.WatchlistStore = WatchlistStore;
