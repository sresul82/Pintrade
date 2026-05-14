/* ──────────────────────────────────────────────────────────
   storage.js  —  Birleşik depolama arayüzü
   • Storage.ls.*   → localStorage wrapper
   • Storage.idb.*  → IndexedDB OHLCV cache
────────────────────────────────────────────────────────── */
const Storage = (() => {

  /* ── localStorage Wrapper ────────────────────────────── */
  const ls = {
    get(key, fallback = null) {
      try {
        const v = localStorage.getItem(key);
        return v === null ? fallback : JSON.parse(v);
      } catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); }
      catch (e) { console.warn('[Storage.ls] set failed:', e); }
    },
    remove(key) {
      try { localStorage.removeItem(key); }
      catch (e) { console.warn('[Storage.ls] remove failed:', e); }
    },
  };

  /* ── IndexedDB ───────────────────────────────────────── */
  let _db = null;

  async function openDB() {
    if (_db) return _db;
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(AppConfig.IDB.name, AppConfig.IDB.version);

      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        // Store: ohlcv — key: "BTCUSDT_1H_binance"
        if (!db.objectStoreNames.contains(AppConfig.IDB.stores.ohlcv)) {
          const store = db.createObjectStore(AppConfig.IDB.stores.ohlcv, { keyPath: 'key' });
          store.createIndex('symbol',  'symbol',  { unique: false });
          store.createIndex('expires', 'expires', { unique: false });
        }
      };

      req.onsuccess = (e) => {
        _db = e.target.result;
        console.log('[Storage] IndexedDB ready ✓');
        resolve(_db);
      };

      req.onerror = (e) => {
        console.error('[Storage] IndexedDB open failed:', e.target.error);
        reject(e.target.error);
      };
    });
  }

  /* ── OHLCV Cache Key ─────────────────────────────────── */
  function ohlcvKey(symbol, tf, exchange) {
    return `${symbol}_${tf}_${exchange}`;
  }

  /* ── IDB: Kaydet ─────────────────────────────────────── */
  async function idbPut(symbol, tf, exchange, bars) {
    try {
      const db  = await openDB();
      const ttl = AppConfig.TF_TTL[tf] || (7 * 24 * 60 * 60 * 1000);
      const key = ohlcvKey(symbol, tf, exchange);
      const record = {
        key,
        symbol,
        tf,
        exchange,
        bars,
        cachedAt: Date.now(),
        expires:  Date.now() + ttl,
      };
      return new Promise((resolve, reject) => {
        const tx  = db.transaction(AppConfig.IDB.stores.ohlcv, 'readwrite');
        const req = tx.objectStore(AppConfig.IDB.stores.ohlcv).put(record);
        req.onsuccess = () => resolve();
        req.onerror   = (e) => reject(e.target.error);
      });
    } catch (e) {
      console.warn('[Storage.idb] put failed:', e);
    }
  }

  /* ── IDB: Oku ────────────────────────────────────────── */
  async function idbGet(symbol, tf, exchange) {
    try {
      const db  = await openDB();
      const key = ohlcvKey(symbol, tf, exchange);
      return new Promise((resolve) => {
        const tx  = db.transaction(AppConfig.IDB.stores.ohlcv, 'readonly');
        const req = tx.objectStore(AppConfig.IDB.stores.ohlcv).get(key);
        req.onsuccess = (e) => {
          const record = e.target.result;
          if (!record) { resolve(null); return; }
          // TTL kontrolü
          if (Date.now() > record.expires) {
            resolve(null); // Expire olmuş → yeni çek
          } else {
            resolve(record.bars);
          }
        };
        req.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  }

  /* ── IDB: Süresi Dolmuşları Temizle ─────────────────── */
  async function idbPurgeExpired() {
    try {
      const db = await openDB();
      const now = Date.now();
      const tx  = db.transaction(AppConfig.IDB.stores.ohlcv, 'readwrite');
      const idx = tx.objectStore(AppConfig.IDB.stores.ohlcv).index('expires');
      const range = IDBKeyRange.upperBound(now);
      idx.openCursor(range).onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) { cursor.delete(); cursor.continue(); }
      };
    } catch (e) {
      console.warn('[Storage.idb] purge failed:', e);
    }
  }

  // Uygulama başlangıcında süresi dolmuş kayıtları temizle
  openDB().then(() => idbPurgeExpired());

  return {
    ls,
    idb: {
      put: idbPut,
      get: idbGet,
      purgeExpired: idbPurgeExpired,
    },
  };
})();
