/* ============================================================
   market-data-store.js  —  Merkezi Piyasa Veri Havuzu
   ============================================================
   Binance Futures WebSocket üzerinden tüm market verisini
   tek bir bağlantıda çeker; diğer modüller buradan okur.

   WebSocket Streams:
     !miniTicker@arr  → fiyat, 24h değişim, hacim  (1sn güncelleme)
     !markPrice@arr   → mark price, funding rate, nextFundingTime (3sn)

   REST (Seyrek):
     /fapi/v1/openInterest  → 60 saniyede bir, toplu batch

   EventBus Events:
     'mds:tick'  → { symbol, price, pct24h, volume24h, volumeBase24h }
     'mds:fr'    → { symbol, rate, nextFundingTime }
     'mds:oi'    → { symbol, value, dir }
     'mds:ready' → {} (ilk WS mesajı gelince)

   Public API:
     MarketDataStore.getTicker(sym)   → { price, pct24h, volume24h, volumeBase24h }
     MarketDataStore.getFR(sym)       → { rate, nextFundingTime }
     MarketDataStore.getOI(sym)       → { value, dir }
     MarketDataStore.setKlines(sym,tf,candles)
     MarketDataStore.getKlines(sym,tf) → Candle[] | null
     MarketDataStore.start()
     MarketDataStore.stop()
   ============================================================ */

const MarketDataStore = (() => {

  // ── İç Veri Map'leri ───────────────────────────────────────
  const _tickers = new Map();   // sym → { price, pct24h, volume24h, volumeBase24h, ts }
  const _fr      = new Map();   // sym → { rate, nextFundingTime, ts }
  const _oi      = new Map();   // sym → { value, dir, ts }
  const _klines  = new Map();   // "SYM_tf" → Candle[]

  // ── WS Durum ───────────────────────────────────────────────
  let _ws            = null;
  let _reconnectMs   = 1000;
  const RECONNECT_MAX = 30000;
  let _stopped       = false;   // stop() çağrıldığında reconnect engellenir
  let _ready         = false;
  let _oiTimer       = null;

  // ── Yardımcı: EventBus güvenli emit ────────────────────────
  function _emit(event, data) {
    if (typeof EventBus !== 'undefined') EventBus.emit(event, data);
  }

  // ──────────────────────────────────────────────────────────
  // WebSocket Bağlantısı
  // ──────────────────────────────────────────────────────────
  function _connect() {
    if (_stopped) return;

    const wsUrl = 'wss://fstream.binance.com/stream?streams=!miniTicker@arr/!markPrice@arr';
    console.log('[MarketDataStore] WS bağlanıyor…');

    _ws = new WebSocket(wsUrl);

    _ws.onopen = () => {
      console.log('[MarketDataStore] WS bağlandı ✓');
      _reconnectMs = 1000; // Başarılı bağlantıda sıfırla
    };

    _ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        // Combined stream formatı: { stream: "!miniTicker@arr", data: [...] }
        const stream = msg.stream;
        const data   = msg.data;

        if (!stream || !Array.isArray(data)) return;

        if (stream === '!miniTicker@arr') {
          _handleMiniTicker(data);
        } else if (stream === '!markPrice@arr') {
          _handleMarkPrice(data);
        }

        // İlk mesaj gelince ready sinyali ver
        if (!_ready) {
          _ready = true;
          _emit('mds:ready', {});
          console.log('[MarketDataStore] İlk veri alındı, hazır ✓');
        }
      } catch (e) {
        console.warn('[MarketDataStore] WS parse hatası:', e.message);
      }
    };

    _ws.onerror = (e) => {
      console.warn('[MarketDataStore] WS hata:', e.type);
    };

    _ws.onclose = () => {
      console.warn('[MarketDataStore] WS kapandı.');
      if (_stopped) return;

      // Exponential backoff ile yeniden bağlan
      console.log(`[MarketDataStore] ${_reconnectMs}ms sonra yeniden bağlanılıyor…`);
      setTimeout(() => {
        if (!_stopped) _connect();
      }, _reconnectMs);

      _reconnectMs = Math.min(_reconnectMs * 2, RECONNECT_MAX);
    };
  }

  // ──────────────────────────────────────────────────────────
  // Stream İşleyicileri
  // ──────────────────────────────────────────────────────────

  // !miniTicker@arr → fiyat, değişim, hacim
  function _handleMiniTicker(arr) {
    arr.forEach(d => {
      if (!d.s || !d.s.endsWith('USDT')) return;
      const sym    = d.s;                          // "BTCUSDT"
      const price  = parseFloat(d.c);              // close (son fiyat)
      const pct24h = parseFloat(d.P);              // 24h değişim %
      const vol24h = parseFloat(d.q);              // 24h quote volume (USD)
      const volBase24h = parseFloat(d.v);           // 24h base asset volume (coin cinsinden — Volume Type: Standard)
      const ts     = Date.now();

      const prev = _tickers.get(sym);
      _tickers.set(sym, { price, pct24h, volume24h: vol24h, volumeBase24h: volBase24h, ts });

      _emit('mds:tick', { symbol: sym, price, pct24h, volume24h: vol24h, volumeBase24h: volBase24h, prev });
    });
  }

  // !markPrice@arr → mark price, funding rate, nextFundingTime
  function _handleMarkPrice(arr) {
    arr.forEach(d => {
      if (!d.s || !d.s.endsWith('USDT')) return;
      const sym           = d.s;
      const markPrice     = parseFloat(d.p);         // mark price
      const rate          = parseFloat(d.r) * 100;   // funding rate → % cinsine çevir
      const nextFundingTime = parseInt(d.T) || 0;
      const ts            = Date.now();

      _fr.set(sym, { rate, nextFundingTime, ts });

      // Ticker'daki mark price'ı da güncelle (eğer daha doğruysa)
      const ticker = _tickers.get(sym);
      if (ticker) {
        ticker.markPrice = markPrice;
      }

      _emit('mds:fr', { symbol: sym, rate, nextFundingTime });

      // FRDataBridge'e de besle (varsa)
      if (typeof FRDataBridge !== 'undefined') {
        FRDataBridge.feed('binance', sym, rate, ts);
      }
    });
  }

  // ──────────────────────────────────────────────────────────
  // OI REST Poller (60 saniyede bir, batch)
  // ──────────────────────────────────────────────────────────
  async function _pollOI() {
    // _tickers'daki tüm USDT sembolleri için OI çek (batch 5'li)
    const symbols = [..._tickers.keys()].filter(s => s.endsWith('USDT'));
    if (symbols.length === 0) return;

    const base = AppConfig?.API?.binance?.restFutures
      || 'https://pintrade.onrender.com/api/binance/futures';

    const BATCH = 5;
    for (let i = 0; i < symbols.length; i += BATCH) {
      const batch = symbols.slice(i, i + BATCH);
      await Promise.allSettled(batch.map(async sym => {
        try {
          const res = await fetch(`${base}/fapi/v1/openInterest?symbol=${sym}`);
          if (!res.ok) return;
          const d = await res.json();
          if (!d?.openInterest) return;

          const ticker = _tickers.get(sym);
          const price  = ticker?.price || 1;
          const value  = parseFloat(d.openInterest) * price;
          const prev   = _oi.get(sym);
          const dir    = prev ? (value >= prev.value ? 'up' : 'down') : 'up';

          _oi.set(sym, { value, dir, ts: Date.now() });
          _emit('mds:oi', { symbol: sym, value, dir });
        } catch { /* sessizce geç */ }
      }));
      // Batch'ler arası kısa bekleme (rate limit)
      await new Promise(r => setTimeout(r, 120));
    }
  }

  // ──────────────────────────────────────────────────────────
  // Klines Önbelleği (RSI ve teknik analiz için)
  // ──────────────────────────────────────────────────────────
  function _klKey(sym, tf) { return `${sym}_${tf}`; }

  function setKlines(sym, tf, candles) {
    _klines.set(_klKey(sym, tf), candles);
  }

  function getKlines(sym, tf) {
    return _klines.get(_klKey(sym, tf)) || null;
  }

  // ──────────────────────────────────────────────────────────
  // Kline Stream (Görev 5) — paylaşılan, dinamik SUBSCRIBE/UNSUBSCRIBE'lı
  // tek bağlantı. Amaç: her bot kendi kline WS'ini açmasın (5 bot = 5
  // ayrı bağlantı yerine tek bağlantı, dinamik stream listesi).
  // ──────────────────────────────────────────────────────────
  let _klineWs          = null;
  let _klineReconnectMs = 1000;
  let _klineStopped     = true;
  let _klineReqId       = 1;
  const _klineSubscribers  = new Map(); // "SYM_tf" -> Set<callback>
  const _klineActiveStreams = new Set(); // "sym@kline_tf" — WS'e abone olduğumuz stream isimleri

  function _klineStreamName(symbol, interval) {
    return `${symbol.toLowerCase()}@kline_${interval}`;
  }

  function _connectKlineWs() {
    if (_klineStopped) return;
    _klineWs = new WebSocket('wss://fstream.binance.com/stream');

    _klineWs.onopen = () => {
      console.log('[MarketDataStore] Kline WS bağlandı ✓');
      _klineReconnectMs = 1000;
      // Reconnect sonrası önceki abonelikleri geri yükle
      if (_klineActiveStreams.size > 0) {
        _klineWs.send(JSON.stringify({
          method: 'SUBSCRIBE', params: [..._klineActiveStreams], id: _klineReqId++,
        }));
      }
    };

    _klineWs.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        const k = msg?.data?.k;
        if (!k) return;
        const key  = _klKey(k.s, k.i);
        const subs = _klineSubscribers.get(key);
        if (!subs || subs.size === 0) return;
        const bar = {
          symbol: k.s, interval: k.i,
          open: parseFloat(k.o), high: parseFloat(k.h), low: parseFloat(k.l), close: parseFloat(k.c),
          volume: parseFloat(k.v), closeTime: k.T, isFinal: !!k.x,
        };
        subs.forEach(cb => {
          try { cb(bar); } catch (e) { console.warn('[MarketDataStore] Kline subscriber hatası:', e.message); }
        });
        _emit('mds:kline', bar);
      } catch (e) {
        console.warn('[MarketDataStore] Kline WS parse hatası:', e.message);
      }
    };

    _klineWs.onerror = (e) => console.warn('[MarketDataStore] Kline WS hata:', e.type);

    _klineWs.onclose = () => {
      console.warn('[MarketDataStore] Kline WS kapandı.');
      if (_klineStopped) return;
      setTimeout(() => { if (!_klineStopped) _connectKlineWs(); }, _klineReconnectMs);
      _klineReconnectMs = Math.min(_klineReconnectMs * 2, RECONNECT_MAX);
    };
  }

  function _ensureKlineWs() {
    if (_klineWs && (_klineWs.readyState === WebSocket.OPEN || _klineWs.readyState === WebSocket.CONNECTING)) return;
    _klineStopped = false;
    _connectKlineWs();
  }

  /**
   * Bir sembol×timeframe kline stream'ine abone ol. Kapanmış bar geldiğinde
   * callback({symbol, interval, open, high, low, close, volume, closeTime,
   * isFinal}) çağrılır. Aynı sembol×tf'e birden fazla bot abone olabilir —
   * WS'e tek stream isteği gider, callback'ler ayrı ayrı tutulur.
   */
  function subscribeKlines(symbol, interval, callback) {
    _ensureKlineWs();
    const key = _klKey(symbol, interval);
    if (!_klineSubscribers.has(key)) _klineSubscribers.set(key, new Set());
    _klineSubscribers.get(key).add(callback);

    const streamName = _klineStreamName(symbol, interval);
    if (!_klineActiveStreams.has(streamName)) {
      _klineActiveStreams.add(streamName);
      if (_klineWs && _klineWs.readyState === WebSocket.OPEN) {
        _klineWs.send(JSON.stringify({ method: 'SUBSCRIBE', params: [streamName], id: _klineReqId++ }));
      }
      // WS henüz açık değilse: _connectKlineWs'in onopen'ı _klineActiveStreams'in
      // tamamına abone olur, ayrıca bir şey yapmaya gerek yok.
    }
  }

  /** subscribeKlines'a verilen AYNI callback referansıyla abonelikten çık. */
  function unsubscribeKlines(symbol, interval, callback) {
    const key  = _klKey(symbol, interval);
    const subs = _klineSubscribers.get(key);
    if (!subs) return;
    subs.delete(callback);
    if (subs.size === 0) {
      _klineSubscribers.delete(key);
      const streamName = _klineStreamName(symbol, interval);
      _klineActiveStreams.delete(streamName);
      if (_klineWs && _klineWs.readyState === WebSocket.OPEN) {
        _klineWs.send(JSON.stringify({ method: 'UNSUBSCRIBE', params: [streamName], id: _klineReqId++ }));
      }
    }
  }

  // ──────────────────────────────────────────────────────────
  // Depth (Order Book) Stream — paylaşılan, dinamik SUBSCRIBE/
  // UNSUBSCRIBE'lı tek bağlantı (kline stream ile aynı örüntü).
  // Partial book depth (@depth20@100ms) kullanılır — diff stream
  // (@depth) yerine, çünkü diff stream'in doğru çalışması için
  // REST snapshot + update-id senkronizasyonu (U/u/pu) gerekir;
  // partial depth zaten senkronize top-N snapshot gönderir, aynı
  // "3 ayrı kaynaktan tutarsız veri" riskini taşımaz.
  // ──────────────────────────────────────────────────────────
  const DEPTH_LEVELS        = 20;
  let _depthWs               = null;
  let _depthReconnectMs      = 1000;
  let _depthStopped          = true;
  let _depthReqId            = 1;
  const _depthSubscribers    = new Map(); // "SYM" -> Set<callback>
  const _depthActiveStreams  = new Set(); // "sym@depth20@100ms"
  const _depth                = new Map(); // sym -> { bids, asks, bidVol, askVol, bidAskRatio, ts }

  function _depthStreamName(symbol) {
    return `${symbol.toLowerCase()}@depth${DEPTH_LEVELS}@100ms`;
  }

  function _connectDepthWs() {
    if (_depthStopped) return;
    _depthWs = new WebSocket('wss://fstream.binance.com/stream');

    _depthWs.onopen = () => {
      console.log('[MarketDataStore] Depth WS bağlandı ✓');
      _depthReconnectMs = 1000;
      if (_depthActiveStreams.size > 0) {
        _depthWs.send(JSON.stringify({
          method: 'SUBSCRIBE', params: [..._depthActiveStreams], id: _depthReqId++,
        }));
      }
    };

    _depthWs.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        const d = msg?.data;
        if (!d || !Array.isArray(d.b) || !Array.isArray(d.a)) return;
        // "s" futures partial depth payload'ında var; yoksa stream isminden çıkar.
        const sym = d.s || (msg.stream || '').split('@')[0].toUpperCase();
        if (!sym) return;

        const subs = _depthSubscribers.get(sym);
        if (!subs || subs.size === 0) return;

        const bids = d.b.map(([p, q]) => [parseFloat(p), parseFloat(q)]);
        const asks = d.a.map(([p, q]) => [parseFloat(p), parseFloat(q)]);
        const bidVol = bids.reduce((s, [, q]) => s + q, 0);
        const askVol = asks.reduce((s, [, q]) => s + q, 0);
        const bidAskRatio = askVol > 0 ? bidVol / askVol : null;

        const snapshot = { symbol: sym, bids, asks, bidVol, askVol, bidAskRatio, ts: Date.now() };
        _depth.set(sym, snapshot);

        subs.forEach(cb => {
          try { cb(snapshot); } catch (e) { console.warn('[MarketDataStore] Depth subscriber hatası:', e.message); }
        });
        _emit('mds:depth', snapshot);
      } catch (e) {
        console.warn('[MarketDataStore] Depth WS parse hatası:', e.message);
      }
    };

    _depthWs.onerror = (e) => console.warn('[MarketDataStore] Depth WS hata:', e.type);

    _depthWs.onclose = () => {
      console.warn('[MarketDataStore] Depth WS kapandı.');
      if (_depthStopped) return;
      setTimeout(() => { if (!_depthStopped) _connectDepthWs(); }, _depthReconnectMs);
      _depthReconnectMs = Math.min(_depthReconnectMs * 2, RECONNECT_MAX);
    };
  }

  function _ensureDepthWs() {
    if (_depthWs && (_depthWs.readyState === WebSocket.OPEN || _depthWs.readyState === WebSocket.CONNECTING)) return;
    _depthStopped = false;
    _connectDepthWs();
  }

  /**
   * Bir sembolün order book'una (top 20 seviye, 100ms) abone ol.
   * callback({ symbol, bids, asks, bidVol, askVol, bidAskRatio, ts }) çağrılır.
   * Aynı sembole birden fazla tüketici (chart, detail panel, LSDataStore, ...)
   * abone olabilir — WS'e tek stream isteği gider.
   */
  function subscribeDepth(symbol, callback) {
    _ensureDepthWs();
    const sym = symbol.endsWith('USDT') ? symbol : symbol + 'USDT';
    if (!_depthSubscribers.has(sym)) _depthSubscribers.set(sym, new Set());
    _depthSubscribers.get(sym).add(callback);

    const streamName = _depthStreamName(sym);
    if (!_depthActiveStreams.has(streamName)) {
      _depthActiveStreams.add(streamName);
      if (_depthWs && _depthWs.readyState === WebSocket.OPEN) {
        _depthWs.send(JSON.stringify({ method: 'SUBSCRIBE', params: [streamName], id: _depthReqId++ }));
      }
    }
  }

  /** subscribeDepth'e verilen AYNI callback referansıyla abonelikten çık. */
  function unsubscribeDepth(symbol, callback) {
    const sym = symbol.endsWith('USDT') ? symbol : symbol + 'USDT';
    const subs = _depthSubscribers.get(sym);
    if (!subs) return;
    subs.delete(callback);
    if (subs.size === 0) {
      _depthSubscribers.delete(sym);
      _depth.delete(sym);
      const streamName = _depthStreamName(sym);
      _depthActiveStreams.delete(streamName);
      if (_depthWs && _depthWs.readyState === WebSocket.OPEN) {
        _depthWs.send(JSON.stringify({ method: 'UNSUBSCRIBE', params: [streamName], id: _depthReqId++ }));
      }
    }
  }

  /** Son bilinen order book anlık görüntüsü (abone yoksa null). */
  function getDepth(sym) {
    const key = sym.endsWith('USDT') ? sym : sym + 'USDT';
    return _depth.get(key) || null;
  }

  // ──────────────────────────────────────────────────────────
  // Public Getter'lar
  // ──────────────────────────────────────────────────────────

  /**
   * Anlık ticker verisi döner.
   * @param {string} sym  — "BTCUSDT" veya "BTC"
   * @returns {{ price, pct24h, volume24h, markPrice } | null}
   */
  function getTicker(sym) {
    const key = sym.endsWith('USDT') ? sym : sym + 'USDT';
    return _tickers.get(key) || null;
  }

  /**
   * Funding rate verisi döner.
   * @param {string} sym
   * @returns {{ rate, nextFundingTime } | null}
   */
  function getFR(sym) {
    const key = sym.endsWith('USDT') ? sym : sym + 'USDT';
    return _fr.get(key) || null;
  }

  /**
   * Open Interest verisi döner.
   * @param {string} sym
   * @returns {{ value, dir } | null}
   */
  function getOI(sym) {
    const key = sym.endsWith('USDT') ? sym : sym + 'USDT';
    return _oi.get(key) || null;
  }

  /**
   * Tüm FR verilerini Map olarak döner (Screener için).
   * @returns {Map<string, {rate, nextFundingTime}>}
   */
  function getAllFR() { return _fr; }

  /**
   * Tüm ticker verilerini Map olarak döner (Screener için).
   * @returns {Map<string, {price, pct24h, volume24h}>}
   */
  function getAllTickers() { return _tickers; }

  /**
   * Mevcut tüm Screener row'larını oluşturmak için gereken birleşik veri.
   * @param {string} sym — "BTCUSDT"
   * @returns {{ sym, price, pct, fr, nextFundingTime, vol, volBase, oi, oiDir } | null}
   */
  function getScreenerRow(sym) {
    const key    = sym.endsWith('USDT') ? sym : sym + 'USDT';
    const ticker = _tickers.get(key);
    const fr     = _fr.get(key);
    const oi     = _oi.get(key);
    if (!ticker && !fr) return null;
    return {
      sym:             key.replace(/USDT$/, ''),
      price:           ticker?.price            || null,
      pct:             ticker?.pct24h           || null,
      fr:              fr?.rate                 ?? null,
      nextFundingTime: fr?.nextFundingTime      || 0,
      vol:             ticker?.volume24h        || null,
      volBase:         ticker?.volumeBase24h     || null,
      oi:              oi?.value                || null,
      oiDir:           oi?.dir                  || 'up',
    };
  }

  // ──────────────────────────────────────────────────────────
  // Başlat / Durdur
  // ──────────────────────────────────────────────────────────
  function start() {
    _stopped = false;
    _connect();
    // OI poller başlat: 5sn sonra ilk çekim (WS verisi dolsun), sonra 60sn periyot
    _oiTimer = setTimeout(async () => {
      await _pollOI();
      _oiTimer = setInterval(_pollOI, 60000);
    }, 5000);
    console.log('[MarketDataStore] Başlatıldı ✓');
  }

  function stop() {
    _stopped = true;
    if (_ws) {
      _ws.onclose = null; // Reconnect tetiklenmesin
      _ws.close(1000, 'MarketDataStore stopped');
      _ws = null;
    }
    if (_oiTimer) { clearInterval(_oiTimer); clearTimeout(_oiTimer); _oiTimer = null; }
    _klineStopped = true;
    if (_klineWs) {
      _klineWs.onclose = null;
      _klineWs.close(1000, 'MarketDataStore stopped');
      _klineWs = null;
    }
    _klineSubscribers.clear();
    _klineActiveStreams.clear();
    _depthStopped = true;
    if (_depthWs) {
      _depthWs.onclose = null;
      _depthWs.close(1000, 'MarketDataStore stopped');
      _depthWs = null;
    }
    _depthSubscribers.clear();
    _depthActiveStreams.clear();
    _depth.clear();
    _ready = false;
    console.log('[MarketDataStore] Durduruldu.');
  }

  function isReady() { return _ready; }

  // ──────────────────────────────────────────────────────────
  return {
    start,
    stop,
    isReady,
    getTicker,
    getFR,
    getOI,
    getAllFR,
    getAllTickers,
    getScreenerRow,
    setKlines,
    getKlines,
    subscribeKlines,
    unsubscribeKlines,
    subscribeDepth,
    unsubscribeDepth,
    getDepth,
  };
})();

window.MarketDataStore = MarketDataStore;
