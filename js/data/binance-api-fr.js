// ===== Binance Futures API - Funding Rate Polling =====
// Binance /fapi/v1/premiumIndex endpoint'inden anlık FR çeker,
// ScalpFRMonitor'a dakikalık olarak besler.
// ─────────────────────────────────────────────────────────────────────
// VERİ FORMATI NOTU:
//   Binance API'den gelen lastFundingRate: "0.00021300" (ondalık, 0.0213% demek)
//   Borsada gösterilen:                    0.0213%
//   Ham değere çevirme:                    parseFloat(raw) * 100  → 0.0213
//   ScalpFRMonitor bu değeri bekler:       -0.2113 gibi (% cinsinden)
// ─────────────────────────────────────────────────────────────────────

class BinanceFRPoller {

    // Binance Futures tüm semboller (premiumIndex) — simge başına lastFundingRate içerir
    static ENDPOINT = `${
      (typeof AppConfig !== 'undefined' && AppConfig.API?.binance?.restFutures)
        ? AppConfig.API.binance.restFutures
        : 'https://pintrade.onrender.com/api/binance/futures'
    }/fapi/v1/premiumIndex`;

    // Polling aralığı: 60 saniye (1 dakika)
    static POLL_INTERVAL_MS = 60 * 1000;

    constructor() {
        this._timer      = null;
        this._isRunning  = false;
        this._lastPollTime = null;
        this._prevFR     = new Map(); // Map<symbol, number>
    }

    // ─────────────────────────────────────────────────────────────
    start() {
        if (this._isRunning) return;
        this._isRunning = true;
        console.log('[BinanceFRPoller] Başlatıldı — her 60sn FR çekilecek');
        this._poll();
        this._timer = setInterval(() => this._poll(), BinanceFRPoller.POLL_INTERVAL_MS);
    }

    stop() {
        if (this._timer) clearInterval(this._timer);
        this._isRunning = false;
        console.log('[BinanceFRPoller] Durduruldu');
    }

    _setInterval(ms) {
        if (this._timer) clearInterval(this._timer);
        if (!this._isRunning) return;
        this._timer = setInterval(() => this._poll(), ms);
        console.log(`[BinanceFRPoller] Interval → ${ms / 1000}sn`);
    }

    // ─────────────────────────────────────────────────────────────
    async _poll() {
        try {
            const res = await fetch(BinanceFRPoller.ENDPOINT);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const list = await res.json(); // dizi döner

            if (!Array.isArray(list)) throw new Error('Beklenen dizi bulunamadı');

            const now = Date.now();
            this._lastPollTime = now;

            let processedCount = 0;

            list.forEach(item => {
                const symbol = item.symbol;
                const rawFR  = item.lastFundingRate; // "0.00021300"

                if (!rawFR) return;

                // Ondalık → % dönüşümü
                // "0.00021300" → 0.0213  |  "-0.00210000" → -0.2100
                const frPct = parseFloat(rawFR) * 100;

                if (isNaN(frPct)) return;

                if (window.FRDataBridge) {
                    window.FRDataBridge.feed('binance', symbol, frPct, now);
                } else if (typeof scalpFRMonitor !== 'undefined') {
                    scalpFRMonitor.onFRUpdate(symbol, frPct, now);
                }

                if (typeof frTracker !== 'undefined') {
                    frTracker.addFRValue(symbol, frPct, now);
                }

                this._prevFR.set(symbol, frPct);
                processedCount++;
            });

            console.log(`[BinanceFRPoller] ${processedCount} coin güncellendi`);

            if (typeof EventBus !== 'undefined') {
                EventBus.emit('binance:frUpdated', { count: processedCount, timestamp: now });
            }

        } catch (err) {
            console.warn('[BinanceFRPoller] Hata:', err.message);
        }
    }

    getLastFR(symbol) {
        return this._prevFR.get(symbol) ?? null;
    }

    getLastPollTime() {
        return this._lastPollTime;
    }
}

// ─────────────────────────────────────────────────────────────────────
// Global instance
// ─────────────────────────────────────────────────────────────────────
const binanceFRPoller = new BinanceFRPoller();
window.binanceFRPoller = binanceFRPoller;
