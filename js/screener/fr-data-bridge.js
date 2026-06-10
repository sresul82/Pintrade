/**
 * FRDataBridge
 * Her iki exchange'in FR akışını dinler, doğru ScalpFRMonitor instance'ına besler.
 * Yeni exchange veya veri kaynağı eklemek için sadece bu dosyaya dokunulur.
 */
const FRDataBridge = (() => {

  // ── Config ───────────────────────────────────────────────────────
  // İleride exchange eklemek/çıkarmak için sadece bu listeyi değiştir
  const EXCHANGES = [
    {
      id:       'binance',
      enabled:  true,
      getMonitor: () => window.scalpFRMonitor,          // Binance instance
    },
    {
      id:       'bybit',
      enabled:  true,
      getMonitor: () => window.scalpFRMonitor_bybit,    // Bybit instance
    },
  ];

  // ── State ─────────────────────────────────────────────────────────
  const _lastFR = {
    binance: new Map(),   // symbol → lastFR value
    bybit:   new Map(),
  };

  // ── OI Cache ──────────────────────────────────────────────────────
  const _lastOI = {
    binance: new Map(),   // symbol → { value, timestamp }
    bybit:   new Map(),
  };

  const _lastVol = {
    binance: new Map(),   // symbol → { value, timestamp }
    bybit:   new Map(),
  };

  // ── Ana besleme fonksiyonu ────────────────────────────────────────
  // Dışarıdan çağrılır: FRDataBridge.feed('binance', 'HOMEUSDT', -0.3100)
  function feed(exchange, symbol, fundingRate, timestamp = Date.now()) {
    const cfg = EXCHANGES.find(e => e.id === exchange && e.enabled);
    if (!cfg) return;

    const last = _lastFR[exchange]?.get(symbol);

    // Aynı değer geldiyse işleme (FRTracker zaten kontrol ediyor ama erken çıkmak daha hızlı)
    if (last === fundingRate) return;

    _lastFR[exchange].set(symbol, fundingRate);

    // FRTracker'a history için besle (exchange bazlı tracker varsa)
    const trackerKey = `frTracker_${exchange}`;
    if (window[trackerKey]) {
      window[trackerKey].addFRValue(symbol, fundingRate, timestamp);
    } else if (exchange === 'binance' && window.frTrackerInstance) {
      // Geriye dönük uyumluluk: eski frTrackerInstance Binance tracker'ı
      window.frTrackerInstance.addFRValue(symbol, fundingRate, timestamp);
    }

    // ScalpFRMonitor'a sinyal tespiti için besle
    const monitor = cfg.getMonitor();
    if (monitor) monitor.onFRUpdate(symbol, fundingRate, timestamp);
  }

  // ── Screener entegrasyonu ─────────────────────────────────────────
  // ScreenerCore FR güncellemelerini EventBus üzerinden dinle
  function _listenScreener() {
    if (typeof EventBus === 'undefined') return;

    // Binance FR güncellemesi (screener-core.js'den emit edilmeli — aşağıya bak)
    EventBus.on('fr:update:binance', ({ symbol, fundingRate, timestamp }) => {
      feed('binance', symbol, fundingRate, timestamp);
    });

    // Bybit FR güncellemesi
    EventBus.on('fr:update:bybit', ({ symbol, fundingRate, timestamp }) => {
      feed('bybit', symbol, fundingRate, timestamp);
    });

    // Genel fr:update (exchange belirtilmişse yönlendir)
    EventBus.on('fr:update', ({ symbol, fundingRate, exchange, timestamp }) => {
      if (exchange) feed(exchange, symbol, fundingRate, timestamp);
    });
  }

  // ── OI besleme ────────────────────────────────────────────────────
  function feedOI(exchange, symbol, oiValue, timestamp = Date.now()) {
    if (!_lastOI[exchange]) return;
    _lastOI[exchange].set(symbol, { value: oiValue, timestamp });
    EventBus.emit(`oi:update:${exchange}`, { symbol, value: oiValue, timestamp });
  }

  function getLastOI(exchange, symbol) {
    return _lastOI[exchange]?.get(symbol) ?? null;
  }

  function getBothOI(symbol) {
    return {
      binance: _lastOI.binance.get(symbol) ?? null,
      bybit:   _lastOI.bybit.get(symbol)   ?? null,
    };
  }

  // ── Volume besleme ────────────────────────────────────────────────
  function feedVol(exchange, symbol, volValue, timestamp = Date.now()) {
    if (!_lastVol[exchange]) return;
    _lastVol[exchange].set(symbol, { value: volValue, timestamp });
  }

  function getLastVol(exchange, symbol) {
    return _lastVol[exchange]?.get(symbol) ?? null;
  }

  function getBothVol(symbol) {
    return {
      binance: _lastVol.binance.get(symbol) ?? null,
      bybit:   _lastVol.bybit.get(symbol)   ?? null,
    };
  }

  // ── Exchange enable/disable (runtime'da açıp kapatmak için) ───────
  function setExchangeEnabled(exchange, enabled) {
    const cfg = EXCHANGES.find(e => e.id === exchange);
    if (cfg) cfg.enabled = enabled;
  }

  // ── Durum sorgulama ───────────────────────────────────────────────
  function getLastFR(exchange, symbol) {
    return _lastFR[exchange]?.get(symbol) ?? null;
  }

  // ── Durum sorgulama 2 ─────────────────────────────────────────────
  function getBothFR(symbol) {
    return {
      binance: _lastFR.binance.get(symbol) ?? null,
      bybit:   _lastFR.bybit.get(symbol)   ?? null,
    };
  }

  // ── Init ──────────────────────────────────────────────────────────
  function init() {
    _listenScreener();
    console.log('[FRDataBridge] Initialized ✓ | Exchanges:',
      EXCHANGES.filter(e => e.enabled).map(e => e.id).join(', ')
    );
  }

  return {
    init, feed, setExchangeEnabled,
    getLastFR, getBothFR,
    feedOI, getLastOI, getBothOI,
    feedVol, getLastVol, getBothVol,
  };

})();

window.FRDataBridge = FRDataBridge;
