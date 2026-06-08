// ===== Funding Interval Manager =====
// Fetches and caches funding interval info from Binance API
class FundingIntervalManager {
    constructor() {
        this.cache = {
            binance: new Map(),
            bybit:   new Map(),
        };
        this.loaded = false;
    }

    async fetch() {
        // Binance
        try {
            const response = await fetch(`${AppConfig.API.binance.restFutures}/fapi/v1/fundingInfo`);
            const data = await response.json();
            data.forEach(item => {
                const hours = item.fundingIntervalHours || 8;
                this.cache.binance.set(item.symbol, hours + 'h');
            });
        } catch (e) {}

        // Bybit
        try {
            const response = await fetch('https://api.bybit.com/v5/market/instruments-info?category=linear&limit=1000');
            const data = await response.json();
            (data?.result?.list || []).forEach(item => {
                const hours = parseInt(item.fundingInterval) / 60 || 8;
                this.cache.bybit.set(item.symbol, hours + 'h');
            });
        } catch (e) {}

        this.loaded = true;
        console.log('✅ Funding intervals loaded:',
            'Binance:', this.cache.binance.size,
            'Bybit:', this.cache.bybit.size
        );
        EventBus.emit('funding:loaded');
    }

    // exchange parametresi zorunlu, default 'binance' (geriye dönük uyumluluk için)
    get(symbol, exchange = 'binance') {
        return this.cache[exchange]?.get(symbol) || '8h';
    }

    is1hInterval(symbol, exchange = 'binance') {
        return this.get(symbol, exchange) === '1h';
    }

    getNextFundingTime(symbol, exchange = 'binance') {
        const intervalText = this.get(symbol, exchange);
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