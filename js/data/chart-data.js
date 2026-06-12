// ── IndexedDB Sabitleri ────────────────────────────────────────
// Sabitler global çakışmayı önlemek için sınıf içine taşındı.

class CandleStore {
  constructor() {
    this._db = null;
    this.ready = this._open();
  }

  // ── Open / Upgrade ─────────────────────────────────────────
  _open() {
    const dbName    = (typeof AppConfig !== 'undefined') ? AppConfig.IDB.name    : 'PerpetualChartDB';
    const dbVersion = (typeof AppConfig !== 'undefined') ? AppConfig.IDB.version : 1;
    const storeName = (typeof AppConfig !== 'undefined') ? AppConfig.IDB.stores.ohlcv : 'ohlcv';
    this._storeName = storeName; // instance'a kaydet

    return new Promise((resolve, reject) => {
      const req = indexedDB.open(dbName, dbVersion);

      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(storeName)) {
          const store = db.createObjectStore(storeName, { keyPath: 'key' });
          store.createIndex('symbol',  'symbol',  { unique: false });
          store.createIndex('expires', 'expires', { unique: false });
        }
      };

      req.onsuccess = (e) => {
        this._db = e.target.result;
        console.log('[CandleStore] IndexedDB ready.');
        resolve();
      };

      req.onerror = (e) => {
        console.error('[CandleStore] Failed to open IndexedDB:', e.target.error);
        reject(e.target.error);
      };
    });
  }

  // ── Internal key builder ───────────────────────────────────
  _key(symbol, tf, exchange) {
    return `${symbol.toUpperCase()}::${tf}::${exchange.toLowerCase()}`;
  }

  // ── Transaction helper ─────────────────────────────────────
  _tx(mode) {
    return this._db.transaction(this._storeName, mode).objectStore(this._storeName);
  }

  // ── Get all candles for a symbol/tf/exchange ───────────────
  get(symbol, tf, exchange) {
    return new Promise((resolve, reject) => {
      const req = this._tx('readonly').get(this._key(symbol, tf, exchange));
      req.onsuccess = (e) => resolve(e.target.result?.candles ?? null);
      req.onerror   = (e) => reject(e.target.error);
    });
  }

  // ── Store full candle array ────────────────────────────────
  set(symbol, tf, exchange, candles) {
    return new Promise((resolve, reject) => {
      const ttl = (typeof AppConfig !== 'undefined' && AppConfig.TF_TTL && AppConfig.TF_TTL[tf]) ? AppConfig.TF_TTL[tf] : (7 * 24 * 60 * 60 * 1000);
      const record = {
        key:       this._key(symbol, tf, exchange),
        symbol:    symbol.toUpperCase(),
        tf,
        exchange:  exchange.toLowerCase(),
        candles,
        updatedAt: Date.now(),
        cachedAt:  Date.now(),
        expires:   Date.now() + ttl,
      };
      const req = this._tx('readwrite').put(record);
      req.onsuccess = () => resolve();
      req.onerror   = (e) => reject(e.target.error);
    });
  }

  // ── Append / update last candle ────────────────────────────
  // Used for live tick updates: if `candle.time` matches the last stored
  // candle, updates it; otherwise appends as a new bar.
  async append(symbol, tf, exchange, candle) {
    const existing = await this.get(symbol, tf, exchange);
    if (!existing || existing.length === 0) {
      await this.set(symbol, tf, exchange, [candle]);
      return;
    }

    // Önce son elemana bak (hızlı yol — çoğu durumda yeterli)
    const last = existing[existing.length - 1];
    if (last.time === candle.time) {
      existing[existing.length - 1] = candle;
      await this.set(symbol, tf, exchange, existing);
      return;
    }

    // Son eleman değilse tüm dizide ara (duplicate koruması)
    const idx = existing.findIndex(c => c.time === candle.time);
    if (idx !== -1) {
      // Zaten var — güncelle
      existing[idx] = candle;
    } else {
      // Yeni mum — ekle
      existing.push(candle);
    }

    await this.set(symbol, tf, exchange, existing);
  }

  // ── Merge new historical candles with existing ─────────────
  // Prepends older candles fetched during pagination without removing
  // newer candles already stored.
  async mergeHistory(symbol, tf, exchange, olderCandles) {
    const existing = await this.get(symbol, tf, exchange) ?? [];
    const existingTimes = new Set(existing.map(c => c.time));
    const newOnes = olderCandles.filter(c => !existingTimes.has(c.time));
    const merged  = [...newOnes, ...existing].sort((a, b) => a.time - b.time);
    await this.set(symbol, tf, exchange, merged);
    return merged;
  }

  // ── Count stored candles ───────────────────────────────────
  async count(symbol, tf, exchange) {
    const candles = await this.get(symbol, tf, exchange);
    return candles?.length ?? 0;
  }

  // ── Get the earliest stored timestamp ─────────────────────
  async oldestTime(symbol, tf, exchange) {
    const candles = await this.get(symbol, tf, exchange);
    return candles?.[0]?.time ?? null;
  }

  // ── Delete a specific symbol/tf/exchange entry ─────────────
  delete(symbol, tf, exchange) {
    return new Promise((resolve, reject) => {
      const req = this._tx('readwrite').delete(this._key(symbol, tf, exchange));
      req.onsuccess = () => resolve();
      req.onerror   = (e) => reject(e.target.error);
    });
  }

  // ── List all stored keys ───────────────────────────────────
  listAll() {
    return new Promise((resolve, reject) => {
      const req = this._tx('readonly').getAllKeys();
      req.onsuccess = (e) => resolve(e.target.result);
      req.onerror   = (e) => reject(e.target.error);
    });
  }
}

// Singleton — whole app shares one store instance
const candleStore = new CandleStore();

/* --- data-feed.js --- */
// ── data-feed.js ─────────────────────────────────────────────────
// Central data manager for Binance + Bybit.
// Handles: historical REST fetch (paginated), live WebSocket tick,
//          IndexedDB caching via CandleStore, EventBus broadcasting.
//
// Events emitted:
//   'feed:candles'  → { symbol, tf, exchange, candles[] }
//   'feed:tick'     → { symbol, tf, exchange, candle }
//   'feed:price'    → { symbol, exchange, price, change24h, volume24h }
//   'feed:status'   → { exchange, status: 'connecting'|'open'|'closed'|'error' }



// ── TF Mapping ─────────────────────────────────────────────────
// Our internal TF → exchange-specific interval string
const BINANCE_TF = {
  '1m':'1m','3m':'3m','5m':'5m','15m':'15m','30m':'30m',
  '1H':'1h','2H':'2h','4H':'4h','6H':'6h','12H':'12h',
  '1D':'1d','1W':'1w','1M':'1M',
};
const BYBIT_TF = {
  '1m':'1','3m':'3','5m':'5','15m':'15','30m':'30',
  '1H':'60','2H':'120','4H':'240','6H':'360','12H':'720',
  '1D':'D','1W':'W','1M':'M',
};

// TF → seconds (for candle time calculations)
const TF_SECONDS = {
  '1m':60,'3m':180,'5m':300,'15m':900,'30m':1800,
  '1H':3600,'2H':7200,'4H':14400,'6H':21600,'12H':43200,
  '1D':86400,'1W':604800,'1M':2592000,
};

// Desired minimum candle history count
const HISTORY_TARGET = 1500;
const BINANCE_MAX_PER_REQ = 1000;
const BYBIT_MAX_PER_REQ   = 1000;

// ── Candle Normalisers ──────────────────────────────────────────
// Each exchange returns different array shapes. Normalise to:
// { time(unix sec), open, high, low, close, volume }

function normBinance(raw) {
  // raw: [openTime, open, high, low, close, volume, closeTime, ...]
  return {
    time:   Math.floor(raw[0] / 1000),
    open:   parseFloat(raw[1]),
    high:   parseFloat(raw[2]),
    low:    parseFloat(raw[3]),
    close:  parseFloat(raw[4]),
    volume: parseFloat(raw[5]),
  };
}

function normBybit(raw) {
  // raw: [startTime(ms), open, high, low, close, volume, turnover]
  return {
    time:   Math.floor(parseInt(raw[0]) / 1000),
    open:   parseFloat(raw[1]),
    high:   parseFloat(raw[2]),
    low:    parseFloat(raw[3]),
    close:  parseFloat(raw[4]),
    volume: parseFloat(raw[5]),
  };
}

// ── BinanceFeed ────────────────────────────────────────────────
class BinanceFeed {
  constructor() {
    this._ws       = {};   // keyed by `${symbol}_${tf}`
    this._priceWs  = null; // all-ticker mini stream
  }

  // Fetch paginated history. Fetches until we have >= HISTORY_TARGET candles
  // or there is no more data available.
  async fetchHistory(symbol, tf) {
    const interval = BINANCE_TF[tf];
    if (!interval) throw new Error(`BinanceFeed: Unknown TF "${tf}"`);

    // Check what we already have in store
    let stored = await candleStore.get(symbol, tf, 'binance') ?? [];
    let oldestTime = stored.length ? stored[0].time : null;

    // How many more do we need?
    let needed = HISTORY_TARGET - stored.length;

    while (needed > 0) {
      const limit    = Math.min(needed, BINANCE_MAX_PER_REQ);
      const endTime  = oldestTime ? (oldestTime * 1000 - 1) : Date.now();

      // ── Futures REST endpoint ──────────────────────────────
      const url = `${AppConfig.API.binance.restFutures}/fapi/v1/klines` +
        `?symbol=${symbol.toUpperCase()}&interval=${interval}` +
        `&limit=${limit}&endTime=${endTime}`;

      let data;
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        data = await res.json();
      } catch (err) {
        console.error('[BinanceFeed] fetchHistory error:', err);
        break;
      }

      if (!data.length) break; // No more history available

      const candles = data.map(normBinance).sort((a, b) => a.time - b.time);
      stored = await candleStore.mergeHistory(symbol, tf, 'binance', candles);
      oldestTime = stored[0].time;
      needed = HISTORY_TARGET - stored.length;

      // Avoid hammering the API
      if (data.length < limit) break; // Exchange ran out of history
      await _sleep(120); // Binance rate limit: 1200 weight/min
    }

    // ── YENİ: Boşluk tespiti ve doldurma ──────────────────────
    const filledStored = await detectAndFillGap(
      symbol, tf, 'binance', stored,
      async (startMs, endMs, limit) => {
        const interval = BINANCE_TF[tf];
        const url = `${AppConfig.API.binance.restFutures}/fapi/v1/klines` +
          `?symbol=${symbol.toUpperCase()}&interval=${interval}` +
          `&limit=${limit}&startTime=${startMs}&endTime=${endMs}`;
        const res  = await fetch(url);
        if (!res.ok) return [];
        const data = await res.json();
        return Array.isArray(data) ? data.map(normBinance) : [];
      }
    );

    return filledStored;
  }

  // Connect WebSocket for live candle updates
  connectLive(symbol, tf) {
    const key      = `${symbol}_${tf}`;
    const interval = BINANCE_TF[tf];
    if (!interval) return;

    // Zaten çalışan bir poll varsa durdur
    if (this._ws[key]) {
      clearInterval(this._ws[key]);
      this._ws[key] = null;
    }

    console.log(`[BinanceFeed] connectLive (polling) started for ${key}`);
    EventBus.emit('feed:status', { exchange: 'binance', status: 'open' });

    // Son kapalı mumu takip etmek için
    let lastClosedTime = null;

    const poll = async () => {
      try {
        const url = `${AppConfig.API.binance.restFutures}/fapi/v1/klines` +
          `?symbol=${symbol.toUpperCase()}&interval=${interval}&limit=2&_t=${Date.now()}`;

        const res = await fetch(url);
        if (!res.ok) return;
        const data = await res.json();
        if (!Array.isArray(data) || data.length === 0) return;

        // Son eleman = şu an açık olan mum
        const raw = data[data.length - 1];
        const candle = {
          time:   Math.floor(raw[0] / 1000),
          open:   parseFloat(raw[1]),
          high:   parseFloat(raw[2]),
          low:    parseFloat(raw[3]),
          close:  parseFloat(raw[4]),
          volume: parseFloat(raw[5]),
        };

        // Bir önceki eleman = kapanmış mum (eğer yeniyse ekle)
        if (data.length >= 2) {
          const prevRaw  = data[data.length - 2];
          const prevTime = Math.floor(prevRaw[0] / 1000);
          if (prevTime !== lastClosedTime) {
            lastClosedTime = prevTime;
            const prevCandle = {
              time:   prevTime,
              open:   parseFloat(prevRaw[1]),
              high:   parseFloat(prevRaw[2]),
              low:    parseFloat(prevRaw[3]),
              close:  parseFloat(prevRaw[4]),
              volume: parseFloat(prevRaw[5]),
            };
            try { await candleStore.append(symbol, tf, 'binance', prevCandle); } catch(e) {}
            EventBus.emit('feed:liveCandle', {
              symbol, tf, exchange: 'binance',
              candle: prevCandle, isClosed: true,
            });
          }
        }

        // Mevcut açık mumu güncelle
        try { await candleStore.append(symbol, tf, 'binance', candle); } catch(e) {}

        EventBus.emit('feed:liveCandle', {
          symbol, tf, exchange: 'binance',
          candle, isClosed: false,
        });

        EventBus.emit('feed:price', {
          symbol, exchange: 'binance', price: candle.close,
        });

      } catch(e) {
        console.warn('[BinanceFeed] poll error:', e);
      }
    };

    // Hemen bir kez çalıştır, sonra her 2 saniyede tekrarla
    poll();
    this._ws[key] = setInterval(poll, 2000);
  }

  disconnectLive(symbol, tf) {
    const key = `${symbol}_${tf}`;
    if (this._ws[key]) {
      clearInterval(this._ws[key]);
      delete this._ws[key];
      console.log(`[BinanceFeed] polling stopped for ${key}`);
    }
  }

  disconnectAll() {
    Object.keys(this._ws).forEach(k => {
      clearInterval(this._ws[k]);
    });
    this._ws = {};
  }
}

// ── BybitFeed ──────────────────────────────────────────────────
class BybitFeed {
  constructor() {
    this._ws = {};
  }

  async fetchHistory(symbol, tf) {
    const interval = BYBIT_TF[tf];
    if (!interval) throw new Error(`BybitFeed: Unknown TF "${tf}"`);

    let stored = await candleStore.get(symbol, tf, 'bybit') ?? [];
    let oldestTime = stored.length ? stored[0].time : null;
    let needed = HISTORY_TARGET - stored.length;

    while (needed > 0) {
      const limit   = Math.min(needed, BYBIT_MAX_PER_REQ);
      const endMs   = oldestTime ? (oldestTime * 1000 - 1) : Date.now();

      const url = `https://api.bybit.com/v5/market/kline` +
        `?category=linear&symbol=${symbol.toUpperCase()}&interval=${interval}` +
        `&limit=${limit}&end=${endMs}`;

      let data;
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (json.retCode !== 0) throw new Error(json.retMsg);
        data = json.result?.list ?? [];
      } catch (err) {
        console.error('[BybitFeed] fetchHistory error:', err);
        break;
      }

      if (!data.length) break;

      // Bybit returns newest-first, reverse to oldest-first
      const candles = data.map(normBybit).sort((a, b) => a.time - b.time);
      stored = await candleStore.mergeHistory(symbol, tf, 'bybit', candles);
      oldestTime = stored[0].time;
      needed = HISTORY_TARGET - stored.length;

      if (data.length < limit) break;
      await _sleep(100);
    }

    // ── YENİ: Boşluk tespiti ve doldurma ──────────────────────
    const filledStored = await detectAndFillGap(
      symbol, tf, 'bybit', stored,
      async (startMs, endMs, limit) => {
        const interval = BYBIT_TF[tf];
        const url = `https://api.bybit.com/v5/market/kline` +
          `?category=linear&symbol=${symbol.toUpperCase()}&interval=${interval}` +
          `&limit=${limit}&start=${startMs}&end=${endMs}`;
        const res  = await fetch(url);
        if (!res.ok) return [];
        const json = await res.json();
        const data = json.result?.list ?? [];
        return data.map(normBybit).sort((a, b) => a.time - b.time);
      }
    );

    return filledStored;
  }

  connectLive(symbol, tf) {
    const key      = `${symbol}_${tf}`;
    const interval = BYBIT_TF[tf];
    if (!interval) return;
    if (this._ws[key]) this.disconnectLive(symbol, tf);

    const wsUrl = `wss://stream.bybit.com/v5/public/linear`;
    EventBus.emit('feed:status', { exchange: 'bybit', status: 'connecting' });

    const ws  = new WebSocket(wsUrl);
    this._ws[key] = ws;
    const topic = `kline.${interval}.${symbol.toUpperCase()}`;

    ws.onopen = () => {
      ws.send(JSON.stringify({ op: 'subscribe', args: [topic] }));
      EventBus.emit('feed:status', { exchange: 'bybit', status: 'open' });
    };

    ws.onmessage = async (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        if (msg.topic !== topic) return;
        const k = msg.data?.[0];
        if (!k) return;

        const candle = {
          time:   Math.floor(parseInt(k.start) / 1000),
          open:   parseFloat(k.open),
          high:   parseFloat(k.high),
          low:    parseFloat(k.low),
          close:  parseFloat(k.close),
          volume: parseFloat(k.volume),
        };

        await candleStore.append(symbol, tf, 'bybit', candle);

        EventBus.emit('feed:tick', {
          symbol, tf, exchange: 'bybit', candle,
          isClosed: k.confirm,
        });

        EventBus.emit('feed:price', {
          symbol,
          exchange: 'bybit',
          price: candle.close,
        });
      } catch (e) {
        console.error('[BybitFeed] ws parse error:', e);
      }
    };

    // Bybit requires ping every 20s to keep connection alive
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ op: 'ping' }));
      }
    }, 20000);

    ws.onerror = () => EventBus.emit('feed:status', { exchange: 'bybit', status: 'error' });
    ws.onclose = () => {
      clearInterval(pingInterval);
      EventBus.emit('feed:status', { exchange: 'bybit', status: 'closed' });

      // Kasıtlı kapatma değilse (1000 = normal close) yeniden bağlan
      if (ws._intentionalClose) return;

      console.log(`[BybitFeed] WS kapandı, 3sn sonra yeniden bağlanılıyor: ${symbol} ${tf}`);
      setTimeout(() => {
        // Hâlâ aynı pane aktifse reconnect et
        const stillActive = Object.values(DataFeed._active)
          .some(a => a.symbol === symbol && a.tf === tf && a.exchange === 'bybit');
        if (stillActive) {
          console.log(`[BybitFeed] Reconnecting: ${symbol} ${tf}`);
          this.connectLive(symbol, tf);
        }
      }, 3000);
    };

    // Store ping interval ref for cleanup
    ws._pingInterval = pingInterval;
  }

  disconnectLive(symbol, tf) {
    const key = `${symbol}_${tf}`;
    const ws  = this._ws[key];
    if (ws) {
      ws._intentionalClose = true;  // ← YENİ: reconnect tetiklenmesin
      clearInterval(ws._pingInterval);
      // Null handlers first to prevent stale callbacks
      ws.onmessage = null;
      ws.onerror   = null;
      ws.onclose   = null;
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close(1000, 'TF change');
      }
      delete this._ws[key];
    }
  }

  disconnectAll() {
    Object.keys(this._ws).forEach(k => {
      const ws = this._ws[k];
      if (ws) {
        clearInterval(ws._pingInterval);
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) ws.close();
      }
    });
    this._ws = {};
  }
}

// ── DataFeedManager ────────────────────────────────────────────
// High-level API used by chart-pane.js and (later) watchlist.js.
// Coordinates both exchanges for a given symbol+tf request.

class DataFeedManager {
  constructor() {
    this.binance  = new BinanceFeed();
    this.bybit    = new BybitFeed();
    this._active  = {};   // paneId → { symbol, tf }
    this._loadIds = {};   // paneId → current loadId counter
  }

  // Load history + start live feed for a pane.
  // If called again before previous async chain finishes, previous chain
  // is cancelled via loadId mismatch — no stale WS will be opened.
  async load(paneId, symbol, tf, targetExchange) {
    // Bump the load counter for this pane
    this._loadIds[paneId] = (this._loadIds[paneId] ?? 0) + 1;
    const myId = this._loadIds[paneId];

    // Disconnect previous feed for this pane
    const prev = this._active[paneId];
    if (prev) {
      if (!prev.exchange || prev.exchange === 'binance') this.binance.disconnectLive(prev.symbol, prev.tf);
      if (!prev.exchange || prev.exchange === 'bybit') this.bybit.disconnectLive(prev.symbol, prev.tf);
    }
    this._active[paneId] = { symbol, tf, exchange: targetExchange };

    // ── YENİ: Karşı exchange'in stale cache'ini temizle ──────
    // Bybit coini açılınca eski Binance cache'i, Binance coini açılınca eski Bybit cache'i sil
    if (targetExchange === 'bybit') {
      const stale = await candleStore.get(symbol, tf, 'binance');
      if (stale && stale.length > 0) {
        await candleStore.delete(symbol, tf, 'binance').catch(() => {});
        console.log(`[DataFeed] Stale Binance cache temizlendi: ${symbol} ${tf}`);
      }
    } else if (targetExchange === 'binance') {
      const stale = await candleStore.get(symbol, tf, 'bybit');
      if (stale && stale.length > 0) {
        await candleStore.delete(symbol, tf, 'bybit').catch(() => {});
        console.log(`[DataFeed] Stale Bybit cache temizlendi: ${symbol} ${tf}`);
      }
    }

    // Run exchange fetch
    if (!targetExchange || targetExchange === 'binance') {
      this._fetchAndEmit('binance', symbol, tf, paneId, myId);
    }
    if (!targetExchange || targetExchange === 'bybit') {
      this._fetchAndEmit('bybit',   symbol, tf, paneId, myId).catch(() => {});
    }
  }

  async _fetchAndEmit(exchange, symbol, tf, paneId, loadId) {
    // Wait for IndexedDB to be ready
    await candleStore.ready;

    // ── Stale check ── If a newer load() was called, abort silently
    if (this._loadIds[paneId] !== loadId) return;

    const feed   = exchange === 'binance' ? this.binance : this.bybit;
    const stored = await candleStore.get(symbol, tf, exchange);

    if (this._loadIds[paneId] !== loadId) return;

    // Emit cached data immediately for instant chart render
    if (stored && stored.length >= 200) {
      EventBus.emit('feed:candles', { symbol, tf, exchange, candles: stored });
    }

    // Fetch fresh / additional history from exchange
    try {
      const candles = await feed.fetchHistory(symbol, tf);
      if (this._loadIds[paneId] !== loadId) return; // stale after long REST call
      EventBus.emit('feed:candles', { symbol, tf, exchange, candles });
    } catch (err) {
      console.error(`[DataFeed] ${exchange} history fetch failed:`, err);
    }

    // Final stale check before opening WebSocket
    if (this._loadIds[paneId] !== loadId) return;
    feed.connectLive(symbol, tf);
  }

  // Called when pane is destroyed / layout changes
  unload(paneId) {
    const prev = this._active[paneId];
    if (prev) {
      this.binance.disconnectLive(prev.symbol, prev.tf);
      this.bybit.disconnectLive(prev.symbol, prev.tf);
      delete this._active[paneId];
    }
    // Invalidate any in-flight async chains for this pane
    this._loadIds[paneId] = -1;
  }

  // Disconnect everything (app close)
  disconnectAll() {
    this.binance.disconnectAll();
    this.bybit.disconnectAll();
    this._active  = {};
    this._loadIds = {};
  }

  // ── Scroll-triggered lazy history loader ───────────────────
  // Called by ChartPane when the user scrolls left of the first loaded bar.
  // endTimeMs: timestamp in milliseconds of the oldest candle we currently have.
  async loadOlderCandles(paneId, endTimeMs) {
    const active = this._active[paneId];
    if (!active) return;
    const { symbol, tf, exchange } = active;

    const fetchBatch = async (feedName, feed, interval, maxPerReq, normFn, buildUrl) => {
      if (!interval) return;
      const endKey = `${paneId}_${feedName}_loading`;
      if (this[endKey]) return; // already fetching
      this[endKey] = true;
      try {
        const stored = await candleStore.get(symbol, tf, feedName) ?? [];
        const oldestTime = stored.length ? stored[0].time : null;
        // Only fetch if the requested endTime is strictly older than what we have
        // (If endTimeMs >= oldestTime * 1000, it means we already have these candles)
        if (oldestTime && endTimeMs >= oldestTime * 1000) { return; }

        const limit  = 500;
        const endMs  = oldestTime ? (oldestTime * 1000 - 1) : endTimeMs;
        const url    = buildUrl(symbol, interval, limit, endMs);
        const res    = await fetch(url);
        if (!res.ok) return;
        const raw = await res.json();
        const data = feedName === 'bybit' ? (raw.result?.list ?? []) : raw;
        if (!Array.isArray(data) || !data.length) return;

        const candles = data.map(normFn).sort((a, b) => a.time - b.time);
        if (!candles.length) return;
        const merged  = await candleStore.mergeHistory(symbol, tf, feedName, candles);
        if (!merged || !merged.length) return;
        EventBus.emit('feed:olderCandles', { symbol, tf, exchange: feedName, candles: merged });
      } catch (e) {
        console.error(`[DataFeed] loadOlderCandles ${feedName} error:`, e);
      } finally {
        this[endKey] = false;
      }
    };

    if (!exchange || exchange === 'binance') {
      fetchBatch('binance', this.binance, BINANCE_TF[tf], BINANCE_MAX_PER_REQ, normBinance,
        (sym, interval, limit, endMs) =>
          `${AppConfig.API.binance.restFutures}/fapi/v1/klines?symbol=${sym.toUpperCase()}&interval=${interval}&limit=${limit}&endTime=${endMs}`
      );
    }
    if (!exchange || exchange === 'bybit') {
      fetchBatch('bybit', this.bybit, BYBIT_TF[tf], BYBIT_MAX_PER_REQ, normBybit,
        (sym, interval, limit, endMs) =>
          `https://api.bybit.com/v5/market/kline?category=linear&symbol=${sym.toUpperCase()}&interval=${interval}&limit=${limit}&end=${endMs}`
      );
    }
  }
}

/**
 * Cache'deki mum dizisinde boşluk var mı tespit eder.
 * Boşluk bulunursa o aralığı exchange'den çeker ve cache'e yazar.
 *
 * @param {string} symbol
 * @param {string} tf
 * @param {string} exchange   - 'binance' | 'bybit'
 * @param {Array}  stored     - Mevcut cache dizisi (time: unix saniye)
 * @param {Function} fetchFn  - (startMs, endMs, limit) → Promise<candle[]>
 * @returns {Promise<Array>}  - Boşluk doldurulduktan sonraki tam dizi
 */
async function detectAndFillGap(symbol, tf, exchange, stored, fetchFn) {
  if (!stored || stored.length < 2) return stored;

  const tfSec = TF_SECONDS[tf] ?? 3600;
  const allowedGap = tfSec * 3; // 3 mum = normal kabul edilir (API gecikmesi vs.)

  // Dizide boşluk ara — en büyük boşluğu bul
  let maxGapStart = null;
  let maxGapEnd   = null;
  let maxGapSize  = 0;

  for (let i = 1; i < stored.length; i++) {
    const gap = stored[i].time - stored[i - 1].time;
    if (gap > allowedGap && gap > maxGapSize) {
      maxGapSize  = gap;
      maxGapStart = stored[i - 1].time * 1000; // ms
      maxGapEnd   = stored[i].time     * 1000; // ms
    }
  }

  // Ayrıca son mumdan şu ana kadar boşluk var mı?
  const lastTime  = stored[stored.length - 1].time * 1000;
  const nowMs     = Date.now();
  const tailGap   = nowMs - lastTime;

  if (tailGap > allowedGap * 1000 && tailGap > maxGapSize * 1000) {
    maxGapStart = lastTime;
    maxGapEnd   = nowMs;
    maxGapSize  = tailGap / 1000;
  }

  if (!maxGapStart) return stored; // Boşluk yok

  const gapMinutes = Math.round(maxGapSize / 60);
  console.log(`[GapFill] ${exchange} ${symbol} ${tf}: ${gapMinutes}dk boşluk tespit edildi, dolduruluyor...`);

  // Boşluğu doldur — maksimum 1000 mum
  const limit = Math.min(1000, Math.ceil(maxGapSize / tfSec) + 5);

  try {
    const gapCandles = await fetchFn(maxGapStart, maxGapEnd, limit);
    if (!gapCandles || !gapCandles.length) return stored;

    // Cache'e yaz ve birleştir
    const merged = await candleStore.mergeHistory(symbol, tf, exchange, gapCandles);
    console.log(`[GapFill] ${exchange} ${symbol} ${tf}: ${gapCandles.length} mum eklendi, toplam ${merged.length}`);
    return merged;
  } catch (e) {
    console.warn(`[GapFill] ${exchange} ${symbol} ${tf} hata:`, e.message);
    return stored;
  }
}

// ── Util ───────────────────────────────────────────────────────
function _sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Singleton ──────────────────────────────────────────────────
const DataFeed = new DataFeedManager();
// TF_SECONDS global olarak erişilebilir

