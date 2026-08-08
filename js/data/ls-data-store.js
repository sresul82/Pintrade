/* ============================================================
   ls-data-store.js  —  Long/Short Veri Katmanı (Merkezi)
   ============================================================
   Visivero'nun 4 göstergesinin Binance + Bybit karşılığı — tek
   merkezi kaynak. Chart, detail panel, gelecekteki Kom1/Kom2/Kom3
   motorları hepsi buradan okur; kimse kendi fetch/polling döngüsünü
   açmaz (Görev 5 kuralı — bkz. js/screener/bot-engine.js).

   Visivero göstergesi        → Binance endpoint
   ─────────────────────────────────────────────────────────────
   Long/Short Positions        /futures/data/globalLongShortAccountRatio
                                (hesap SAYISI bazlı, TÜM traderlar)
   Trader Positioning          /futures/data/topLongShortPositionRatio
                                (pozisyon DEĞERİ bazlı, TOP traderlar)
   (ek, faydalı)                /futures/data/topLongShortAccountRatio
                                (hesap SAYISI bazlı, TOP traderlar)
   Market Exposure (yakın)     /futures/data/takerlongshortRatio
                                (taker alım/satım HACİM oranı)
   Order Book                  <symbol>@depth20@100ms WS
                                (MarketDataStore.subscribeDepth üzerinden)

   Visivero göstergesi        → Bybit endpoint (faz 2, 2026-08-08)
   ─────────────────────────────────────────────────────────────
   Long/Short Positions        /v5/market/account-ratio (buyRatio/sellRatio)
                                → sadece "global" alanına eşleniyor.
   Trader Positioning /        Bybit'te public API'de karşılığı YOK —
   (ek) / Market Exposure      topPosition/topAccount/taker Bybit için
                                hep null kalır (veri kaynağı yok, hata değil).
   Order Book                  orderbook.50.<symbol> WS
                                (BybitAPI.subscribeDepth üzerinden)

   Mimari:
     - REST çağrıları BotEngine.queueRestRequest() üzerinden geçer
       (paylaşılan rate-limit bütçesi, ban sinyali tüm botları durdurur).
     - Order book WS, borsaya göre MarketDataStore.subscribeDepth()
       (Binance) veya BybitAPI.subscribeDepth() (Bybit) üzerinden gelir
       — kimse kendi WS bağlantısını AÇMAZ.
     - Periyodik REST yenilemesi TEK merkezi timer'dan yürür — sadece
       subscribe() ile "ilgi" bildirilmiş sembolller için (tüm 500+
       sembolü canlı taramak yerine).
     - exchange parametresi alır ('binance' varsayılan, 'bybit' da
       destekleniyor) — üçüncü bir borsa eklenmek istenirse
       _restBase/_fetchExchangeRestMetrics/_depthAdapterFor'a birer
       case eklemek yeterli.

   EventBus Events:
     'ls:update' → { exchange, symbol, metrics }

   Public API:
     LSDataStore.subscribe(symbol, callback, exchange='binance')
     LSDataStore.unsubscribe(symbol, callback, exchange='binance')
     LSDataStore.get(symbol, exchange='binance') → metrics | null
     LSDataStore.backfill(symbol, exchange='binance') → Promise<metrics>
   ============================================================ */

const LSDataStore = (() => {

  const REFRESH_MS = 30000; // subscribe edilen semboller için REST yenileme periyodu
  const DEFAULT_EXCHANGE = 'binance';
  const SUPPORTED_EXCHANGES = ['binance', 'bybit'];

  // exchange -> sym -> { global, topPosition, topAccount, taker, orderBook, ts }
  const _metrics = new Map();
  // exchange -> sym -> Set<callback>
  const _subscribers = new Map();
  // exchange -> sym -> depth callback (MarketDataStore.subscribeDepth'e verilen referans, unsubscribe için)
  const _depthCallbacks = new Map();

  let _refreshTimer = null;

  function _emit(event, data) {
    if (typeof EventBus !== 'undefined') EventBus.emit(event, data);
  }

  function _metricsMapFor(exchange) {
    if (!_metrics.has(exchange)) _metrics.set(exchange, new Map());
    return _metrics.get(exchange);
  }

  function _subscribersMapFor(exchange) {
    if (!_subscribers.has(exchange)) _subscribers.set(exchange, new Map());
    return _subscribers.get(exchange);
  }

  function _assertSupported(exchange) {
    if (!SUPPORTED_EXCHANGES.includes(exchange)) {
      throw new Error(`LSDataStore: exchange '${exchange}' desteklenmiyor (desteklenenler: ${SUPPORTED_EXCHANGES.join(', ')}).`);
    }
  }

  function _restBase(exchange) {
    if (exchange === 'binance') {
      return AppConfig?.API?.binance?.restFutures
        || 'https://pintrade.onrender.com/api/binance/futures';
    }
    if (exchange === 'bybit') {
      return AppConfig?.API?.bybit?.rest || 'https://api.bybit.com';
    }
    _assertSupported(exchange);
  }

  // ──────────────────────────────────────────────────────────
  // REST — borsaya göre farklı endpoint şekli (Order Book WS ile ayrı geliyor)
  // ──────────────────────────────────────────────────────────

  async function _fetchRatioEndpoint(base, path, sym) {
    const res = await fetch(`${base}${path}?symbol=${sym}&period=5m&limit=1`);
    if (res.status === 429 || res.status === 418) throw new Error(`BAN_SIGNAL_${res.status}`);
    if (!res.ok) throw new Error(`LSDataStore: ${path} başarısız (${sym}, HTTP ${res.status})`);
    const arr = await res.json();
    return arr?.[0] || null;
  }

  /**
   * Binance için 4 REST metriğini çeker (BotEngine kuyruğu üzerinden,
   * her biri ayrı sırada bekler — tek seferde 4'ünü birden atmaz).
   * NOT: takerlongshortRatio yanıtında "symbol" alanı YOKTUR (server.js'in
   * premiumIndex'te openInterest alanını olmayan yerden okuma hatasına
   * düşmemek için doğrulanmış gerçek yanıt şekli) — symbol'ü biz ekliyoruz.
   */
  async function _fetchBinanceRestMetrics(sym, base) {
    const [global, topPosition, topAccount, taker] = await Promise.all([
      BotEngine.queueRestRequest(() => _fetchRatioEndpoint(base, '/futures/data/globalLongShortAccountRatio', sym)),
      BotEngine.queueRestRequest(() => _fetchRatioEndpoint(base, '/futures/data/topLongShortPositionRatio', sym)),
      BotEngine.queueRestRequest(() => _fetchRatioEndpoint(base, '/futures/data/topLongShortAccountRatio', sym)),
      BotEngine.queueRestRequest(() => _fetchRatioEndpoint(base, '/futures/data/takerlongshortRatio', sym)),
    ]);

    return {
      global: global ? {
        ratio: parseFloat(global.longShortRatio),
        longAccountPct: parseFloat(global.longAccount),
        shortAccountPct: parseFloat(global.shortAccount),
        ts: global.timestamp,
      } : null,
      topPosition: topPosition ? {
        ratio: parseFloat(topPosition.longShortRatio),
        longAccountPct: parseFloat(topPosition.longAccount),
        shortAccountPct: parseFloat(topPosition.shortAccount),
        ts: topPosition.timestamp,
      } : null,
      topAccount: topAccount ? {
        ratio: parseFloat(topAccount.longShortRatio),
        longAccountPct: parseFloat(topAccount.longAccount),
        shortAccountPct: parseFloat(topAccount.shortAccount),
        ts: topAccount.timestamp,
      } : null,
      taker: taker ? {
        buySellRatio: parseFloat(taker.buySellRatio),
        buyVol: parseFloat(taker.buyVol),
        sellVol: parseFloat(taker.sellVol),
        ts: taker.timestamp,
      } : null,
    };
  }

  /**
   * Bybit için tek REST metriği (BotEngine kuyruğu üzerinden). Bybit'in
   * public API'sinde Binance'in topPosition/topAccount/taker'ına karşılık
   * gelen bir endpoint YOK — bu alanlar Bybit için hep null kalır, bu
   * eksik veri değil, gerçek bir kaynak kısıtı (rapor: gorevler2.md Görev 3).
   */
  async function _fetchBybitRestMetrics(sym, base) {
    const d = await BotEngine.queueRestRequest(async () => {
      const res = await fetch(`${base}/v5/market/account-ratio?category=linear&symbol=${sym}&period=5min&limit=1`);
      if (res.status === 429 || res.status === 403) throw new Error(`BAN_SIGNAL_${res.status}`);
      if (!res.ok) throw new Error(`LSDataStore: Bybit account-ratio başarısız (${sym}, HTTP ${res.status})`);
      const json = await res.json();
      // Bybit hız-limit sinyalini HTTP 200 içinde retCode ile döner (HTTP
      // status'e bakmak yetmez) — 10006/10018 IP/hesap bazlı throttle demek.
      if (json.retCode === 10006 || json.retCode === 10018) throw new Error(`BAN_SIGNAL_${json.retCode}`);
      if (json.retCode !== 0) throw new Error(`LSDataStore: Bybit API hatası (${sym}): ${json.retMsg}`);
      return json.result?.list?.[0] || null;
    });

    if (!d) return { global: null, topPosition: null, topAccount: null, taker: null };

    const buyRatio  = parseFloat(d.buyRatio);
    const sellRatio = parseFloat(d.sellRatio);
    return {
      global: {
        ratio: sellRatio > 0 ? buyRatio / sellRatio : null,
        longAccountPct: buyRatio,
        shortAccountPct: sellRatio,
        ts: parseInt(d.timestamp, 10),
      },
      topPosition: null, // Bybit public API'de karşılığı yok
      topAccount:  null, // Bybit public API'de karşılığı yok
      taker:       null, // Bybit public API'de karşılığı yok
    };
  }

  async function _fetchRestMetrics(sym, exchange) {
    const base = _restBase(exchange);
    if (exchange === 'binance') return _fetchBinanceRestMetrics(sym, base);
    if (exchange === 'bybit')   return _fetchBybitRestMetrics(sym, base);
    _assertSupported(exchange);
  }

  function _applyMetrics(sym, exchange, partial) {
    const map = _metricsMapFor(exchange);
    const prev = map.get(sym) || {};
    const next = { ...prev, ...partial, symbol: sym, exchange, ts: Date.now() };
    map.set(sym, next);

    const subs = _subscribersMapFor(exchange).get(sym);
    if (subs) subs.forEach(cb => {
      try { cb(next); } catch (e) { console.warn('[LSDataStore] Subscriber hatası:', e.message); }
    });
    _emit('ls:update', { exchange, symbol: sym, metrics: next });
    return next;
  }

  /**
   * Tek seferlik manuel yenileme (örn. detail panel açıldığında).
   * BotEngine kuyruğu üzerinden gider; ban sinyalinde reddeder.
   */
  async function backfill(symbol, exchange = DEFAULT_EXCHANGE) {
    const sym = symbol.endsWith('USDT') ? symbol : symbol + 'USDT';
    const rest = await _fetchRestMetrics(sym, exchange);
    return _applyMetrics(sym, exchange, rest);
  }

  // ──────────────────────────────────────────────────────────
  // Merkezi periyodik yenileme — sadece subscribe edilmiş semboller
  // ──────────────────────────────────────────────────────────
  async function _refreshSubscribed() {
    for (const [exchange, symMap] of _subscribers.entries()) {
      const syms = [...symMap.keys()].filter(s => (symMap.get(s)?.size || 0) > 0);
      for (const sym of syms) {
        try {
          const rest = await _fetchRestMetrics(sym, exchange);
          _applyMetrics(sym, exchange, rest);
        } catch (err) {
          if (String(err?.message).startsWith('BAN_SIGNAL')) {
            console.error('[LSDataStore] ⛔ BAN sinyali — periyodik yenileme durduruluyor, BotEngine kuyruğu zaten tüm botlar için duraklatıldı.');
            return;
          }
          console.warn(`[LSDataStore] Yenileme hatası (${sym}):`, err.message);
        }
      }
    }
  }

  function _ensureRefreshTimer() {
    if (_refreshTimer) return;
    _refreshTimer = setInterval(_refreshSubscribed, REFRESH_MS);
  }

  // ──────────────────────────────────────────────────────────
  // Order Book — borsaya göre MarketDataStore veya BybitAPI üzerinden
  // (kendi WS bağlantısını AÇMAZ, mevcut merkezi WS yöneticilerini kullanır)
  // ──────────────────────────────────────────────────────────
  function _depthCallbackKey(exchange, sym) { return `${exchange}_${sym}`; }

  /** Borsaya göre depth abone/çık fonksiyonlarını döner — üçüncü bir borsa
   *  eklenirse tek yapılacak yer burası. */
  function _depthAdapterFor(exchange) {
    if (exchange === 'binance' && typeof MarketDataStore !== 'undefined') {
      return { subscribe: MarketDataStore.subscribeDepth, unsubscribe: MarketDataStore.unsubscribeDepth };
    }
    if (exchange === 'bybit' && typeof BybitAPI !== 'undefined') {
      return { subscribe: BybitAPI.subscribeDepth, unsubscribe: BybitAPI.unsubscribeDepth };
    }
    return null;
  }

  function _ensureDepthSubscription(sym, exchange) {
    const adapter = _depthAdapterFor(exchange);
    if (!adapter) return;
    const key = _depthCallbackKey(exchange, sym);
    if (_depthCallbacks.has(key)) return;

    const cb = (snapshot) => {
      _applyMetrics(sym, exchange, {
        orderBook: {
          bidVol: snapshot.bidVol,
          askVol: snapshot.askVol,
          bidAskRatio: snapshot.bidAskRatio,
          ts: snapshot.ts,
        },
      });
    };
    _depthCallbacks.set(key, { adapter, callback: cb });
    adapter.subscribe(sym, cb);
  }

  function _releaseDepthSubscription(sym, exchange) {
    const key = _depthCallbackKey(exchange, sym);
    const entry = _depthCallbacks.get(key);
    if (!entry) return;
    entry.adapter.unsubscribe(sym, entry.callback);
    _depthCallbacks.delete(key);
  }

  // ──────────────────────────────────────────────────────────
  // Public API
  // ──────────────────────────────────────────────────────────

  /**
   * Bir sembole "ilgi" bildir — order book WS'i canlı akmaya başlar,
   * REST metrikleri merkezi timer üzerinden periyodik (REFRESH_MS)
   * yenilenir. İlk çağrıda hemen bir backfill de tetiklenir.
   */
  function subscribe(symbol, callback, exchange = DEFAULT_EXCHANGE) {
    const sym = symbol.endsWith('USDT') ? symbol : symbol + 'USDT';
    const symMap = _subscribersMapFor(exchange);
    if (!symMap.has(sym)) symMap.set(sym, new Set());
    const isFirst = symMap.get(sym).size === 0;
    symMap.get(sym).add(callback);

    _ensureDepthSubscription(sym, exchange);
    _ensureRefreshTimer();

    if (isFirst) {
      backfill(sym, exchange).catch(err => {
        if (!String(err?.message).startsWith('BAN_SIGNAL')) {
          console.warn(`[LSDataStore] İlk backfill hatası (${sym}):`, err.message);
        }
      });
    }
  }

  /** subscribe'a verilen AYNI callback referansıyla abonelikten çık. */
  function unsubscribe(symbol, callback, exchange = DEFAULT_EXCHANGE) {
    const sym = symbol.endsWith('USDT') ? symbol : symbol + 'USDT';
    const symMap = _subscribersMapFor(exchange);
    const subs = symMap.get(sym);
    if (!subs) return;
    subs.delete(callback);
    if (subs.size === 0) {
      symMap.delete(sym);
      _releaseDepthSubscription(sym, exchange);
    }
  }

  /** Son bilinen anlık görüntü (subscribe/backfill edilmemişse null). */
  function get(symbol, exchange = DEFAULT_EXCHANGE) {
    const sym = symbol.endsWith('USDT') ? symbol : symbol + 'USDT';
    return _metricsMapFor(exchange).get(sym) || null;
  }

  return { subscribe, unsubscribe, backfill, get };
})();

window.LSDataStore = LSDataStore;
