/* ──────────────────────────────────────────────────────────
   bybit-api.js  —  Bybit Futures (V5) REST + WebSocket
   Global: BybitAPI
────────────────────────────────────────────────────────── */
const BybitAPI = (() => {

  const BASE = AppConfig.API.bybit.rest;
  const WS_BASE = AppConfig.API.bybit.ws;

  /* TF dönüşümü: uygulama içi ('1H') → Bybit V5 API ('60') */
  const TF_MAP_BYBIT = {
    '1m': '1', '3m': '3', '5m': '5', '15m': '15', '30m': '30',
    '1H': '60', '2H': '120', '4H': '240', '6H': '360', '12H': '720',
    '1D': 'D', '3D': 'W', '1W': 'W', '1M': 'M'
  };

  function toApiTf(tf) {
    return TF_MAP_BYBIT[tf] || '60';
  }

  /* ── REST: Kline (OHLCV) ─────────────────────────────── */
  /**
   * @param {string} symbol  - ör. 'BTCUSDT'
   * @param {string} tf      - ör. '1H'
   * @param {number} limit   - max 1000 for bybit v5
   * @param {number|null} endTime - timestamp ms
   * @returns {Promise<Array>} — LW Charts uyumlu bar dizisi
   */
  async function fetchKlines(symbol, tf, limit = 500, endTime = null) {
    try {
      const p = new URLSearchParams({
        category: 'linear',
        symbol: symbol.toUpperCase(),
        interval: toApiTf(tf),
        limit: Math.min(limit, 1000)
      });
      if (endTime) p.set('end', endTime);

      const url = `${BASE}/v5/market/kline?${p}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      if (data.retCode !== 0) throw new Error(`Bybit API Error: ${data.retMsg}`);

      const list = data.result?.list || [];
      
      // Bybit verileri sondan başa (yeniden eskiye) verir!
      // LW Charts eskiyden yeniye ister, bu yüzden reverse() kullanıyoruz.
      return list.map(k => ({
        time:   Math.floor(parseInt(k[0], 10) / 1000), // saniyeye çevir
        open:   parseFloat(k[1]),
        high:   parseFloat(k[2]),
        low:    parseFloat(k[3]),
        close:  parseFloat(k[4]),
        volume: parseFloat(k[5]),
      })).reverse();

    } catch (e) {
      console.error('[BybitAPI] fetchKlines error:', e);
      return [];
    }
  }

  /* ── REST: Aktif Perpetual Kontrat Listesi ───────────── */
  async function fetchSymbols() {
    try {
      const res = await fetch(`${BASE}/v5/market/instruments-info?category=linear`);
      const data = await res.json();
      if (data.retCode !== 0) throw new Error(`Bybit API Error: ${data.retMsg}`);

      // Sadece Trading statüsünde olan ve Base Coin/Quote Coin uyumlu olanları al (genelde USDT)
      const list = data.result?.list || [];
      return list
        .filter(s => s.status === 'Trading' && s.quoteCoin === 'USDT')
        .map(s => s.symbol);
    } catch (e) {
      console.error('[BybitAPI] fetchSymbols error:', e);
      return [];
    }
  }

  /* ── REST: 24H Ticker ────────────────────────────────── */
  async function fetchTicker(symbol) {
    try {
      const res = await fetch(`${BASE}/v5/market/tickers?category=linear&symbol=${symbol}`);
      const data = await res.json();
      if (data.retCode !== 0) throw new Error(data.retMsg);
      const t = data.result?.list?.[0];
      if (!t) return null;
      // Binance tracker verisine benzeyen ortak bir formata uyarlayabiliriz (Gerekirse)
      return {
        lastPrice: t.lastPrice,
        priceChangePercent: ((parseFloat(t.lastPrice) - parseFloat(t.prevPrice24h)) / parseFloat(t.prevPrice24h) * 100).toFixed(2),
        volume: t.volume24h
      };
    } catch (e) {
      console.error('[BybitAPI] fetchTicker error:', e);
      return null;
    }
  }

  /* ── WebSocket Yönetimi ──────────────────────────────── */
  const _subs = new Map();  // key: "BTCUSDT_60" → { ws, callbacks, reconnectMs, pingTimer }

  function _wsKey(symbol, tf) {
    return `${symbol.toUpperCase()}_${toApiTf(tf)}`;
  }

  function _connect(symbol, tf, subKey) {
    const sub = _subs.get(subKey);
    if (!sub) return;

    const streamName = `kline.${toApiTf(tf)}.${symbol.toUpperCase()}`;
    const ws = new WebSocket(WS_BASE);

    sub.ws = ws;
    sub.reconnectMs = sub.reconnectMs || AppConfig.WS.reconnectBaseMs;

    ws.onopen = () => {
      console.log(`[BybitAPI] WS connected: ${streamName} ✓`);
      sub.reconnectMs = AppConfig.WS.reconnectBaseMs;

      // Abonelik talebi gönder
      ws.send(JSON.stringify({
        op: "subscribe",
        args: [streamName]
      }));

      // Ping - Bybit V5 her 20 saniyede bir ping bekler
      sub.pingTimer = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ op: "ping" }));
        }
      }, AppConfig.WS.pingIntervalMs);
    };

    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        
        // Ping response ignore
        if (msg.op === "pong" || !msg.data) return;
        
        // Topic check
        if (msg.topic !== streamName) return;

        // kline list update
        const dataList = Array.isArray(msg.data) ? msg.data : [msg.data];
        
        for (const k of dataList) {
          const bar = {
            time:   Math.floor(parseInt(k.start, 10) / 1000),
            open:   parseFloat(k.open),
            high:   parseFloat(k.high),
            low:    parseFloat(k.low),
            close:  parseFloat(k.close),
            volume: parseFloat(k.volume),
            isClosed: k.confirm, // true = mum kapanışı
          };

          sub.callbacks.forEach(cb => {
            try { cb(bar); } catch (e) { console.error('[BybitAPI] WS callback error:', e); }
          });
        }
      } catch { /* JSON parse error */ }
    };

    ws.onerror = (e) => {
      console.warn(`[BybitAPI] WS error (${streamName}):`, e);
    };

    ws.onclose = () => {
      clearInterval(sub.pingTimer);
      if (!sub.active) return; // bilinçli kapatma

      console.warn(`[BybitAPI] WS closed (${streamName}), reconnect in ${sub.reconnectMs}ms`);
      setTimeout(() => {
        if (_subs.has(subKey)) _connect(symbol, tf, subKey);
      }, sub.reconnectMs);

      // Exponential backoff
      sub.reconnectMs = Math.min(sub.reconnectMs * AppConfig.WS.reconnectFactor, AppConfig.WS.reconnectMaxMs);
    };
  }

  function subscribeKline(symbol, tf, callback) {
    const key = _wsKey(symbol, tf);

    if (!_subs.has(key)) {
      _subs.set(key, { ws: null, callbacks: new Set(), active: true, reconnectMs: AppConfig.WS.reconnectBaseMs });
      _connect(symbol, tf, key);
    }
    _subs.get(key).callbacks.add(callback);

    return () => unsubscribeKline(symbol, tf, callback);
  }

  function unsubscribeKline(symbol, tf, callback) {
    const key = _wsKey(symbol, tf);
    const sub = _subs.get(key);
    if (!sub) return;

    sub.callbacks.delete(callback);

    if (sub.callbacks.size === 0) {
      sub.active = false;
      clearInterval(sub.pingTimer);
      if (sub.ws) {
        // Bybit unsub
        if (sub.ws.readyState === WebSocket.OPEN) {
          sub.ws.send(JSON.stringify({ op: "unsubscribe", args: [`kline.${toApiTf(tf)}.${symbol.toUpperCase()}`] }));
        }
        sub.ws.close();
      }
      _subs.delete(key);
    }
  }

  /* ── WebSocket: Order Book (depth) ────────────────────
     Bybit V5 orderbook stream'i snapshot + delta gönderir (Binance'in
     partial depth'i gibi her seferinde tam top-N göndermez) — bu yüzden
     yerel bir book state (Map<price,qty>) tutup delta'ları üzerine
     uygulamak gerekiyor. "size":"0" olan seviye silinir.
     subscribeKline ile aynı çoklu-abone örüntüsü: tek WS bağlantısı,
     dinamik SUBSCRIBE/UNSUBSCRIBE, sembol başına Set<callback>. */
  const DEPTH_LEVELS = 50;
  const _depthSubs = new Map(); // "BTCUSDT" -> { ws, callbacks, book:{bids:Map,asks:Map}, reconnectMs, pingTimer, active }

  function _depthTopic(symbol) {
    return `orderbook.${DEPTH_LEVELS}.${symbol.toUpperCase()}`;
  }

  function _applyDepthLevels(map, levels) {
    for (const [price, qty] of levels) {
      const q = parseFloat(qty);
      if (!q) map.delete(price); else map.set(price, q);
    }
  }

  function _depthSnapshot(symbol, book) {
    const toSorted = (map, desc) => [...map.entries()]
      .map(([p, q]) => [parseFloat(p), q])
      .sort((a, b) => desc ? b[0] - a[0] : a[0] - b[0]);
    const bids = toSorted(book.bids, true);
    const asks = toSorted(book.asks, false);
    const bidVol = bids.reduce((s, [, q]) => s + q, 0);
    const askVol = asks.reduce((s, [, q]) => s + q, 0);
    const bidAskRatio = askVol > 0 ? bidVol / askVol : null;
    return { symbol, bids: bids.slice(0, 20), asks: asks.slice(0, 20), bidVol, askVol, bidAskRatio, ts: Date.now() };
  }

  function _connectDepth(symbol, subKey) {
    const sub = _depthSubs.get(subKey);
    if (!sub) return;

    const topic = _depthTopic(symbol);
    const ws = new WebSocket(WS_BASE);
    sub.ws = ws;
    sub.reconnectMs = sub.reconnectMs || AppConfig.WS.reconnectBaseMs;

    ws.onopen = () => {
      console.log(`[BybitAPI] Depth WS bağlandı: ${topic} ✓`);
      sub.reconnectMs = AppConfig.WS.reconnectBaseMs;
      sub.book = { bids: new Map(), asks: new Map() }; // yeniden bağlanınca sıfırla, snapshot bekle
      ws.send(JSON.stringify({ op: 'subscribe', args: [topic] }));
      sub.pingTimer = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ op: 'ping' }));
      }, AppConfig.WS.pingIntervalMs);
    };

    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        if (msg.op === 'pong' || !msg.data || msg.topic !== topic) return;

        if (msg.type === 'snapshot') {
          sub.book = { bids: new Map(), asks: new Map() };
        }
        _applyDepthLevels(sub.book.bids, msg.data.b || []);
        _applyDepthLevels(sub.book.asks, msg.data.a || []);

        const snapshot = _depthSnapshot(symbol.toUpperCase(), sub.book);
        sub.callbacks.forEach(cb => {
          try { cb(snapshot); } catch (e) { console.warn('[BybitAPI] Depth callback hatası:', e.message); }
        });
      } catch { /* JSON parse hatası */ }
    };

    ws.onerror = (e) => console.warn(`[BybitAPI] Depth WS hata (${topic}):`, e);

    ws.onclose = () => {
      clearInterval(sub.pingTimer);
      if (!sub.active) return;
      console.warn(`[BybitAPI] Depth WS kapandı (${topic}), ${sub.reconnectMs}ms sonra yeniden bağlanılacak`);
      setTimeout(() => { if (_depthSubs.has(subKey)) _connectDepth(symbol, subKey); }, sub.reconnectMs);
      sub.reconnectMs = Math.min(sub.reconnectMs * AppConfig.WS.reconnectFactor, AppConfig.WS.reconnectMaxMs);
    };
  }

  /** Bir sembolün order book'una abone ol. callback({symbol,bids,asks,bidVol,askVol,bidAskRatio,ts}) çağrılır. */
  function subscribeDepth(symbol, callback) {
    const key = symbol.toUpperCase();
    if (!_depthSubs.has(key)) {
      _depthSubs.set(key, {
        ws: null, callbacks: new Set(), active: true,
        reconnectMs: AppConfig.WS.reconnectBaseMs,
        book: { bids: new Map(), asks: new Map() },
      });
      _connectDepth(symbol, key);
    }
    _depthSubs.get(key).callbacks.add(callback);
  }

  /** subscribeDepth'e verilen AYNI callback referansıyla abonelikten çık. */
  function unsubscribeDepth(symbol, callback) {
    const key = symbol.toUpperCase();
    const sub = _depthSubs.get(key);
    if (!sub) return;
    sub.callbacks.delete(callback);
    if (sub.callbacks.size === 0) {
      sub.active = false;
      clearInterval(sub.pingTimer);
      if (sub.ws) {
        if (sub.ws.readyState === WebSocket.OPEN) {
          sub.ws.send(JSON.stringify({ op: 'unsubscribe', args: [_depthTopic(symbol)] }));
        }
        sub.ws.close();
      }
      _depthSubs.delete(key);
    }
  }

  console.log('[BybitAPI] Ready ✓');

  return {
    fetchKlines,
    fetchSymbols,
    fetchTicker,
    subscribeKline,
    unsubscribeKline,
    subscribeDepth,
    unsubscribeDepth,
    toApiTf,
  };
})();
