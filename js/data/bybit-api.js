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

  console.log('[BybitAPI] Ready ✓');

  return {
    fetchKlines,
    fetchSymbols,
    fetchTicker,
    subscribeKline,
    unsubscribeKline,
    toApiTf,
  };
})();
