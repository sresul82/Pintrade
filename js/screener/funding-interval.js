// ===== Funding Interval Manager =====
// Fetches and caches funding interval info from Binance API
class FundingIntervalManager {
    constructor() {
        this.cache = new Map();
        this.loaded = false;
    }
    async fetch() {
    try {
        const response = await fetch(`${AppConfig.API.binance.restFutures}/fapi/v1/fundingInfo`);
        const data = await response.json();
        data.forEach(item => {
            const hours = item.fundingIntervalHours || 8;
            this.cache.set(item.symbol, hours + 'h');
        });
    } catch (e) {}

    try {
        const response = await fetch('https://api.bybit.com/v5/market/instruments-info?category=linear&limit=1000');
        const data = await response.json();
        (data?.result?.list || []).forEach(item => {
            const hours = parseInt(item.fundingInterval) / 60 || 8;
            this.cache.set(item.symbol, hours + 'h');
        });
    } catch (e) {}

    this.loaded = true;
    console.log('✅ Funding intervals loaded:', this.cache.size, 'coins');
    EventBus.emit('funding:loaded');
}
    get(symbol) {
        return this.cache.get(symbol) || '8h';
    }
    is1hInterval(symbol) {
        return this.get(symbol) === '1h';
    }
    getNextFundingTime(symbol) {
        const intervalText = this.get(symbol);
        const hours = parseInt(intervalText) || 8;
        const now = Date.now();
        const date = new Date(now);
        const currentUTCHours = date.getUTCHours();
        const nextUTCHours = Math.ceil((currentUTCHours + 0.0001) / hours) * hours;
        const nextFundingDate = new Date(date);
        nextFundingDate.setUTCHours(nextUTCHours, 0, 0, 0);
        return nextFundingDate.getTime();
    }
}
// Create global instance
const fundingIntervalManager = new FundingIntervalManager();
// Fetch on load
fundingIntervalManager.fetch();
// Refresh every 5 minutes
setInterval(() => fundingIntervalManager.fetch(), 5 * 60 * 1000);
// Export
window.fundingIntervalManager = fundingIntervalManager;