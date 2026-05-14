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
                // fundingIntervalHours: 8, 4, 2, 1
                const hours = item.fundingIntervalHours || 8;
                this.cache.set(item.symbol, hours + 'h');
            });
            
            this.loaded = true;
            console.log('✅ Funding intervals loaded:', this.cache.size, 'coins');
        } catch (error) {
            console.error('❌ Failed to fetch funding intervals:', error);
        }
    }
    get(symbol) {
        return this.cache.get(symbol) || '8h';
    }
    is1hInterval(symbol) {
        return this.get(symbol) === '1h';
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