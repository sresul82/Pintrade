// ===== Bybit API - Funding Rate Polling =====
// Bybit /v5/market/tickers endpoint'inden anlık FR çeker,
// ScalpFRMonitor'a dakikalık olarak besler.
// ─────────────────────────────────────────────────────────────────────
// VERİ FORMATI NOTU:
//   Bybit API'den gelen fundingRate: "0.00021300" (ondalık, 0.0213% demek)
//   Borsada gösterilen:              0.0213%
//   Ham değere çevirme:              parseFloat(raw) * 100  → 0.0213
//   ScalpFRMonitor bu değeri bekler: -0.2113 gibi (% cinsinden, işaretsiz)
// ─────────────────────────────────────────────────────────────────────

class BybitFRPoller {

    // Bybit linear perpetual tickers (tüm USDT/USDC coinler)
    static ENDPOINT = 'https://api.bybit.com/v5/market/tickers?category=linear';

    // Polling aralığı: 60 saniye (1 dakika)
    static POLL_INTERVAL_MS = 60 * 1000;

    constructor() {
        this._timer = null;
        this._isRunning = false;
        this._lastPollTime = null;

        // Önceki FR değerlerini tutar (Δ hesabı için)
        // Map<symbol, number>  — % cinsinden
        this._prevFR = new Map();
    }

    // ─────────────────────────────────────────────────────────────
    // Başlat / Durdur
    // ─────────────────────────────────────────────────────────────

    start() {
        if (this._isRunning) return;
        this._isRunning = true;
        console.log('[BybitFRPoller] Başlatıldı — her 60sn FR çekilecek');
        this._poll(); // ilk çekim hemen
        this._timer = setInterval(() => this._poll(), BybitFRPoller.POLL_INTERVAL_MS);
    }

    stop() {
        if (this._timer) clearInterval(this._timer);
        this._isRunning = false;
        console.log('[BybitFRPoller] Durduruldu');
    }

    // ─────────────────────────────────────────────────────────────
    // Ana polling fonksiyonu
    // ─────────────────────────────────────────────────────────────

    async _poll() {
        try {
            const res = await fetch(BybitFRPoller.ENDPOINT);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = await res.json();

            const list = json?.result?.list;
            if (!Array.isArray(list)) throw new Error('Beklenen result.list bulunamadı');

            const now = Date.now();
            this._lastPollTime = now;

            let processedCount = 0;

            list.forEach(item => {
                const symbol = item.symbol;
                const rawFR  = item.fundingRate; // "0.00021300" veya "-0.00210000"

                if (rawFR === undefined || rawFR === null || rawFR === '') return;

                // Bybit fundingRate ondalık format → % formatına çevir
                // Örnek: "0.00021300" → 0.021300 (yani 0.0213%)
                // Örnek: "-0.00210000" → -0.210000 (yani -0.2100%)
                const frPct = parseFloat(rawFR) * 100;

                if (isNaN(frPct)) return;

                // ScalpFRMonitor'a besle
                if (typeof scalpFRMonitor !== 'undefined') {
                    scalpFRMonitor.onFRUpdate(symbol, frPct, now);
                }

                // FRTracker'a da besle (genel history için)
                if (typeof frTracker !== 'undefined') {
                    frTracker.addFRValue(symbol, frPct, now);
                }

                this._prevFR.set(symbol, frPct);
                processedCount++;
            });

            console.log(`[BybitFRPoller] ${processedCount} coin güncellendi`);

            // EventBus bildirimi (screener tablosunu tetikler)
            if (typeof EventBus !== 'undefined') {
                EventBus.emit('bybit:frUpdated', { count: processedCount, timestamp: now });
            }

        } catch (err) {
            console.warn('[BybitFRPoller] Hata:', err.message);
        }
    }

    // ─────────────────────────────────────────────────────────────
    // Yardımcı: belirli sembol için son bilinen FR
    // ─────────────────────────────────────────────────────────────
    getLastFR(symbol) {
        return this._prevFR.get(symbol) ?? null;
    }

    // Son polling zamanı
    getLastPollTime() {
        return this._lastPollTime;
    }
}

// ─────────────────────────────────────────────────────────────────────
// Global instance — app.js'de start() çağrılacak
// ─────────────────────────────────────────────────────────────────────
const bybitFRPoller = new BybitFRPoller();
window.bybitFRPoller = bybitFRPoller;
