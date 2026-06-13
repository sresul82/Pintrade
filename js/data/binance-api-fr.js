// ===== Binance Futures API - Funding Rate Poller =====
// ÖNCEKİ DURUM: REST polling (60sn'de bir /fapi/v1/premiumIndex çekerdi)
// YENİ DURUM:   MarketDataStore WebSocket'inden 'mds:fr' event'ini dinler.
//               REST isteği ATILMAZ — IP ban riski ortadan kalkar.
// ─────────────────────────────────────────────────────────────────────
// VERİ FORMATI NOTU:
//   MarketDataStore'dan gelen rate: % cinsinden  (örn: -0.2113)
//   FRDataBridge ve ScalpFRMonitor bu değeri bekler: -0.2113 gibi (% cinsinden)
// ─────────────────────────────────────────────────────────────────────

class BinanceFRPoller {

    constructor() {
        this._isRunning    = false;
        this._lastPollTime = null;
        this._prevFR       = new Map(); // Map<symbol, number>
        this._listener     = null;
    }

    // ─────────────────────────────────────────────────────────────
    // start() → MarketDataStore 'mds:fr' eventini dinlemeye başlar
    // MarketDataStore.start() dışarıdan (screener-core.js'te) zaten çağrılıyor.
    // ─────────────────────────────────────────────────────────────
    start() {
        if (this._isRunning) return;
        this._isRunning = true;

        if (typeof EventBus === 'undefined') {
            console.warn('[BinanceFRPoller] EventBus bulunamadı, başlatılamıyor.');
            return;
        }

        // 'mds:fr' → MarketDataStore'un !markPrice@arr stream'inden gelir (3sn'de bir)
        this._listener = ({ symbol, rate, nextFundingTime }) => {
            if (!symbol.endsWith('USDT')) return;

            const now = Date.now();
            this._lastPollTime = now;

            // FRDataBridge'e besle (FR geçmiş grafiği vb.)
            if (window.FRDataBridge) {
                window.FRDataBridge.feed('binance', symbol, rate, now);
            }

            // ScalpFRMonitor'a besle (bot sinyalleri)
            if (typeof scalpFRMonitor !== 'undefined') {
                scalpFRMonitor.onFRUpdate(symbol, rate, now);
            }

            // FRTracker'a besle (varsa)
            if (typeof frTracker !== 'undefined') {
                frTracker.addFRValue(symbol, rate, now);
            }

            this._prevFR.set(symbol, rate);
        };

        EventBus.on('mds:fr', this._listener);
        console.log('[BinanceFRPoller] Başlatıldı — MarketDataStore mds:fr eventi dinleniyor (REST yok)');
    }

    // ─────────────────────────────────────────────────────────────
    stop() {
        if (this._listener && typeof EventBus !== 'undefined') {
            EventBus.off('mds:fr', this._listener);
        }
        this._listener  = null;
        this._isRunning = false;
        console.log('[BinanceFRPoller] Durduruldu');
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
