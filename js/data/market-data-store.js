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
     'mds:tick'  → { symbol, price, pct24h, volume24h }
     'mds:fr'    → { symbol, rate, nextFundingTime }
     'mds:oi'    → { symbol, value, dir }
     'mds:ready' → {} (ilk WS mesajı gelince)

   Public API:
     MarketDataStore.getTicker(sym)   → { price, pct24h, volume24h }
     MarketDataStore.getFR(sym)       → { rate, nextFundingTime }
     MarketDataStore.getOI(sym)       → { value, dir }
     MarketDataStore.setKlines(sym,tf,candles)
     MarketDataStore.getKlines(sym,tf) → Candle[] | null
     MarketDataStore.start()
     MarketDataStore.stop()
   ============================================================ */

const MarketDataStore = (() => {

  // ── İç Veri Map'leri ───────────────────────────────────────
  const _tickers = new Map();   // sym → { price, pct24h, volume24h, ts }
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
      const ts     = Date.now();

      const prev = _tickers.get(sym);
      _tickers.set(sym, { price, pct24h, volume24h: vol24h, ts });

      _emit('mds:tick', { symbol: sym, price, pct24h, volume24h: vol24h, prev });
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
   * @returns {{ sym, price, pct, fr, nextFundingTime, vol, oi, oiDir } | null}
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
  };
})();
