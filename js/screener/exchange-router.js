/**
 * ExchangeRouter — Tek exchange karar merkezi
 * Tüm modüller exchange bilgisi için buraya sorar.
 * Yeni exchange eklemek için sadece bu dosyaya dokunulur.
 */
const ExchangeRouter = (() => {

  // Desteklenen exchange listesi — ileride OKX, Gate vb. buraya eklenir
  const SUPPORTED = ['binance', 'bybit'];

  // Aktif exchange — her zaman State'ten gelir
  function getActive() {
    return State.get('activeExchange') || 'binance';
  }

  // Karşı exchange (overlay grafik, karşılaştırma widget'ı için)
  function getOpposite(exchange) {
    const ex = exchange || getActive();
    return ex === 'binance' ? 'bybit' : 'binance';
  }

  // Screener tab adından exchange çıkar
  // 'bn-screener' → 'binance' | 'bb-screener' → 'bybit'
  function fromTab(tab) {
    if (!tab) return getActive();
    return tab.startsWith('bn') ? 'binance' : 'bybit';
  }

  // Exchange → doğru ScalpFRMonitor instance
  function getMonitor(exchange) {
    return window.getScalpMonitor?.(exchange || getActive())
      || window.scalpFRMonitor;
  }

  // Exchange → doğru FR Poller instance
  function getPoller(exchange) {
    const ex = exchange || getActive();
    return ex === 'bybit'
      ? window.bybitFRPoller
      : window.binanceFRPoller;
  }

  // Symbol + exchange → funding interval metni ('1h', '4h', '8h')
  function getFundingInterval(symbol, exchange) {
    return window.fundingIntervalManager?.get(
      symbol,
      exchange || getActive()
    ) || '8h';
  }

  // Symbol + exchange → next funding timestamp (ms)
  function getNextFundingTime(symbol, exchange) {
    return window.fundingIntervalManager?.getNextFundingTime(
      symbol,
      exchange || getActive()
    ) || 0;
  }

  // Exchange geçerli mi?
  function isSupported(exchange) {
    return SUPPORTED.includes(exchange);
  }

  return {
    getActive,
    getOpposite,
    fromTab,
    getMonitor,
    getPoller,
    getFundingInterval,
    getNextFundingTime,
    isSupported,
  };

})();

window.ExchangeRouter = ExchangeRouter;
