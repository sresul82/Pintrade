// ===== OI (Open Interest) API HANDLER =====
// Fetches Open Interest data from Binance Futures API

class OIManager {
  constructor() {
    this.oiData = new Map();
    this.previousOI = new Map();
    this.updateInterval = 60000;
  }

  async fetchAllOI(symbols, priceMap) {
    const batchSize = 5;
    for (let i = 0; i < symbols.length; i += batchSize) {
      const batch = symbols.slice(i, i + batchSize);
      await Promise.allSettled(batch.map(sym => this.fetchOI(sym, priceMap)));
    }
  }

  async fetchOI(symbol, priceMap) {
    try {
      const resp = await fetch(`${AppConfig.API.binance.restFutures}/fapi/v1/openInterest?symbol=${symbol}USDT`);
      if (!resp.ok) return;
      const data = await resp.json();
      const oi = parseFloat(data.openInterest);
      const price = priceMap.get(symbol) || 0;
      if (!price) return;
      const oiUSD = oi * price;
      const prev = this.previousOI.get(symbol);
      const oiChange = prev ? ((oiUSD - prev) / prev) * 100 : 0;
      this.previousOI.set(symbol, oiUSD);
      this.oiData.set(symbol, { oiUSD, oiChange, lastUpdate: Date.now() });
    } catch(e) {}
  }

  get(symbol) { return this.oiData.get(symbol) || null; }

  fmt(oiUSD) {
    if (!oiUSD) return '—';
    if (oiUSD >= 1e9) return (oiUSD / 1e9).toFixed(2) + 'B';
    if (oiUSD >= 1e6) return (oiUSD / 1e6).toFixed(1) + 'M';
    if (oiUSD >= 1e3) return (oiUSD / 1e3).toFixed(0) + 'K';
    return oiUSD.toFixed(0);
  }
}

window.OIManager = OIManager;