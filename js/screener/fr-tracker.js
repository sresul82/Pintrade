// ===== FR Tracker - Funding Rate History & Change Detection =====

class FRTracker {
    constructor() {
        // Store FR history for each symbol (last 5 values)
        this.frHistory = new Map();

        // Store 24h ago FR for rank calculation
        this.fr24hAgo = new Map();

        // Pending changes for smart tracking (biriken kucuk degisimler)
        this.pendingChanges = new Map();

        // Max history length
        this.maxHistoryLength = 30;

        // Thresholds for smart tracking (yüzde değerleri direkt)
        this.lowThreshold = 0.00014;
        this.mediumThreshold = 0.0002;
        this.cumulativeThreshold = 0.00015;
        this.rapidChangeThreshold = 0.0005;
        this.rapidAlerts = new Map();

        // Kümülatif tracking için
        this.lastCumulativeTime = new Map();
        this.cumulativeInterval = 3 * 60 * 1000; // 3 dakika
    }

    // Add FR value to history (Smart Tracking)
    addFRValue(symbol, fundingRate, timestamp = Date.now()) {
        if (!this.frHistory.has(symbol)) {
            this.frHistory.set(symbol, []);
            this.pendingChanges.set(symbol, 0);
        }

        const history = this.frHistory.get(symbol);

        if (history.length === 0) {
            this._addEntry(symbol, fundingRate, timestamp);
            return;
        }

        const lastEntry = history[history.length - 1];
        const change = Math.abs(fundingRate - lastEntry.value);
        const timeDiff = timestamp - lastEntry.timestamp;

        if (timeDiff >= 4 * 60 * 60 * 1000) {
            this.pendingChanges.set(symbol, 0);
            this._addEntry(symbol, fundingRate, timestamp);
            return;
        }

        if (change === 0) return;

        if (change >= this.lowThreshold) {
            const pending = this.pendingChanges.get(symbol) || 0;
            if (pending > 0) {
                this._addEntry(symbol, lastEntry.value, lastEntry.timestamp);
            }
            this.pendingChanges.set(symbol, 0);
            this.lastCumulativeTime.set(symbol, timestamp);
            this._addEntry(symbol, fundingRate, timestamp);

            const prevFR = lastEntry.value;
            if (change >= 0.0002 && fundingRate < 0 && fundingRate < prevFR) {
                window.dispatchEvent(new CustomEvent('frRapidChange', {
                    detail: { symbol, change, fundingRate }
                }));
            }
            if (fundingRate <= -0.0005 && prevFR > -0.0005) {
                this.rapidAlerts.set(symbol, Date.now());
            }
        } else {
            const pending = (this.pendingChanges.get(symbol) || 0) + change;
            this.pendingChanges.set(symbol, pending);

            if (!this.lastCumulativeTime.has(symbol)) {
                this.lastCumulativeTime.set(symbol, timestamp);
            }
            const lastCumulativeTime = this.lastCumulativeTime.get(symbol);
            const timeSinceLastCumulative = timestamp - lastCumulativeTime;

            if (timeSinceLastCumulative >= this.cumulativeInterval) {
                this._addEntry(symbol, fundingRate, timestamp);
                this.pendingChanges.set(symbol, 0);
                this.lastCumulativeTime.set(symbol, timestamp);
            }
        }
    }

    _addEntry(symbol, fundingRate, timestamp) {
        const history = this.frHistory.get(symbol);
        history.push({
            value: fundingRate,
            timestamp: timestamp,
            interval: this.detectInterval(symbol, fundingRate)
        });
        if (history.length > this.maxHistoryLength) history.shift();
        if (!this.fr24hAgo.has(symbol)) this.fr24hAgo.set(symbol, fundingRate);
    }

    getHistory(symbol) {
        return this.frHistory.get(symbol) || [];
    }

    hasRapidAlert(symbol) {
        const alertTime = this.rapidAlerts.get(symbol);
        if (!alertTime) return false;
        return (Date.now() - alertTime) < 5 * 60 * 1000;
    }

    detectInterval(symbol, currentFR) {
        const history = this.getHistory(symbol);
        if (history.length < 2) return '8h';
        const lastEntry = history[history.length - 1];
        const timeDiff = Date.now() - lastEntry.timestamp;
        if (timeDiff < 2 * 60 * 60 * 1000) return '1h';
        else if (timeDiff < 4 * 60 * 60 * 1000) return '2h';
        else if (timeDiff < 6 * 60 * 60 * 1000) return '4h';
        return '8h';
    }

    hasIntervalChanged(symbol) {
        const history = this.getHistory(symbol);
        if (history.length < 2) return false;
        const lastInterval = history[history.length - 1].interval;
        const prevInterval = history[history.length - 2].interval;
        return (prevInterval === '8h' || prevInterval === '4h') &&
               (lastInterval === '2h' || lastInterval === '1h');
    }

    calculate24hChange(symbol, currentFR) {
        const fr24h = this.fr24hAgo.get(symbol);
        if (!fr24h) return 0;
        return currentFR - fr24h;
    }

    getFRChangeMagnitude(symbol) {
        const history = this.getHistory(symbol);
        if (history.length < 2) return 0;
        return history[history.length - 1].value - history[history.length - 2].value;
    }

    formatHistoryForBadge(symbol) {
        const history = this.getHistory(symbol);
        return history.map((entry, index) => {
            const change = index > 0 ? entry.value - history[index - 1].value : 0;
            return {
                value: Utils.formatFundingRate(entry.value),
                time: Utils.formatTimestamp(entry.timestamp),
                change,
                changeFormatted: change !== 0 ?
                    (change > 0 ? '↑ ' : '↓ ') + Utils.formatFundingRate(Math.abs(change)) : '-',
                changeClass: Utils.getColorClass(change)
            };
        }).reverse();
    }

    clearHistory(symbol) {
        this.frHistory.delete(symbol);
        this.fr24hAgo.delete(symbol);
    }

    clearAllHistory() {
        this.frHistory.clear();
        this.fr24hAgo.clear();
    }

    isConsistentlyNegative(symbol) {
        const history = this.getHistory(symbol);
        if (history.length < 5) return false;
        const last5 = history.slice(-5);
        for (let i = 1; i < last5.length; i++) {
            if (last5[i].value >= last5[i - 1].value) return false;
        }
        return true;
    }

    isConsistentlyPositive(symbol) {
        const history = this.getHistory(symbol);
        if (history.length < 5) return false;
        const last5 = history.slice(-5);
        for (let i = 1; i < last5.length; i++) {
            if (last5[i].value <= last5[i - 1].value) return false;
        }
        return true;
    }

    getFRTrendType(symbol) {
        if (this.isConsistentlyNegative(symbol)) return 'negative';
        if (this.isConsistentlyPositive(symbol)) return 'positive';
        return 'neutral';
    }
}

// =====================================================================
// ScalpFRMonitor — 10 dakikalık pencere takip sistemi
// =====================================================================
// Kural:
//   1. Her coin için her dakika gelen FR değeri izlenir.
//   2. Dakikalar arası fark (|Δ|) >= SCALP_THRESHOLD ise → anında kaydet.
//   3. 1-9. dakikalar arası eşik geçilmediyse → 10. dakika sonunda kaydet.
//   4. Her iki durumda da: kaydedilen değer ile pencereNin 1. dakikası arasındaki fark verilir.
//   5. Sadece negatife giden FR'ler izlenir (fundingRate < 0 ve daha negatife gidiyor).
//      Yeşil: daha negatif (long için fırsat), Kırmızı: daha az negatif / pozitife dönüyor.
// =====================================================================

class ScalpFRMonitor {

    // SCALP_THRESHOLD: Ham veri olarak 0.001 (borsada "0.001%" görünür, % işareti yok)
    static SCALP_THRESHOLD = 0.001;

    // Pencere süresi: 10 dakika (ms)
    static WINDOW_MS = 10 * 60 * 1000;

    constructor() {
        // Her sembol için aktif pencere
        // Map<symbol, { startFR, startTime, minuteSnapshots: [{fr, ts}] }>
        this.windows = new Map();

        // Kaydedilen sinyaller listesi (screener'a gösterilecek)
        // Array<ScalpSignal>
        this.signals = [];

        // Maksimum kaç sinyal tutulacak
        this.maxSignals = 200;
    }

    // ─────────────────────────────────────────────────────────────
    // Ana giriş noktası — her dakika FR güncellemesi geldiğinde çağrılır
    // fundingRate: ham değer, borsada "-0.2113%" olarak görüneni → -0.2113
    // ─────────────────────────────────────────────────────────────
    onFRUpdate(symbol, fundingRate, timestamp = Date.now()) {

        // Sadece negatif FR'leri izle
        if (fundingRate >= 0) {
            // Pozitife geçtiyse aktif pencereyi kapat (kırmızı sinyal)
            if (this.windows.has(symbol)) {
                const win = this.windows.get(symbol);
                this._recordSignal(symbol, win.startFR, fundingRate, timestamp, 'timeout');
                this.windows.delete(symbol);
            }
            return;
        }

        // Pencere yoksa yeni pencere aç
        if (!this.windows.has(symbol)) {
            this.windows.set(symbol, {
                startFR: fundingRate,
                startTime: timestamp,
                minuteSnapshots: [{ fr: fundingRate, ts: timestamp }]
            });
            return;
        }

        const win = this.windows.get(symbol);

        // Dakikalık snapshot ekle
        win.minuteSnapshots.push({ fr: fundingRate, ts: timestamp });

        // 1. Dakika bazlı anlık değişim (bir önceki snapshot'a göre)
        const prev = win.minuteSnapshots[win.minuteSnapshots.length - 2];
        const instantDelta = fundingRate - prev.fr; // negatif sayı → daha negatif demek

        // 2. Pencere başından toplam değişim
        const totalDelta = fundingRate - win.startFR;

        const instantAbs = Math.abs(instantDelta);
        const elapsed = timestamp - win.startTime;

        // ── KURAL 1: Anlık değişim eşiği geçti ──────────────────
        if (instantAbs >= ScalpFRMonitor.SCALP_THRESHOLD) {
            this._recordSignal(symbol, win.startFR, fundingRate, timestamp, 'threshold', instantDelta);
            // Pencereyi sıfırla — bu noktadan yeni pencere başlar
            this.windows.set(symbol, {
                startFR: fundingRate,
                startTime: timestamp,
                minuteSnapshots: [{ fr: fundingRate, ts: timestamp }]
            });
            return;
        }

        // ── KURAL 2: 10 dakika doldu, eşik geçilmedi ─────────────
        if (elapsed >= ScalpFRMonitor.WINDOW_MS) {
            this._recordSignal(symbol, win.startFR, fundingRate, timestamp, 'timeout', totalDelta);
            // Yeni pencere başlat
            this.windows.set(symbol, {
                startFR: fundingRate,
                startTime: timestamp,
                minuteSnapshots: [{ fr: fundingRate, ts: timestamp }]
            });
        }
    }

    // ─────────────────────────────────────────────────────────────
    // Sinyal kayıt — tüm kayıtlar buradan geçer
    // triggerType: 'threshold' | 'timeout'
    // delta: fundingRate - startFR (negatif = daha negatife gitti)
    // ─────────────────────────────────────────────────────────────
    _recordSignal(symbol, startFR, currentFR, timestamp, triggerType, delta = null) {
        const d = delta !== null ? delta : (currentFR - startFR);

        // Yön belirleme:
        // daha negatif → 'more_negative' → Yeşil (short sıkışıyor, long fırsatı)
        // daha az negatif veya sıfıra yaklaşıyor → 'less_negative' → Kırmızı
        // fark = 0 → 'flat'
        let direction;
        if (Math.abs(d) < 0.0000001) {
            direction = 'flat';
        } else if (d < 0) {
            direction = 'more_negative'; // FR daha negatife gitti
        } else {
            direction = 'less_negative'; // FR pozitife doğru geri döndü
        }

        const signal = {
            symbol,
            exchange: (typeof ScreenerCore !== 'undefined' && ScreenerCore.getActiveTab && ScreenerCore.getActiveTab().startsWith('by')) ? 'bybit' : 'binance',
            startFR,           // pencere başlangıç FR (borsadaki % değeri)
            currentFR,         // tetiklenme anındaki FR
            delta: d,          // currentFR - startFR
            deltaAbs: Math.abs(d),
            direction,         // 'more_negative' | 'less_negative' | 'flat'
            triggerType,       // 'threshold' → eşik geçildi | 'timeout' → 10dk doldu
            timestamp,
            // Borsada gösterim için formatlanmış değerler
            display: {
                startFR:    this._fmt(startFR),
                currentFR:  this._fmt(currentFR),
                delta:      this._fmtDelta(d),
                time:       this._fmtTime(timestamp),
                colorClass: direction === 'more_negative' ? 'fr-signal-green'
                          : direction === 'less_negative' ? 'fr-signal-red'
                          : 'fr-signal-gray',
                arrow:      direction === 'more_negative' ? '▼'   // daha negatif
                          : direction === 'less_negative' ? '▲'   // pozitife dönüş
                          : '─',
                badge:      triggerType === 'threshold' ? '⚡ Eşik' : '⏱ 10dk',
            }
        };

        this.signals.unshift(signal); // en yeni başa
        if (this.signals.length > this.maxSignals) this.signals.pop();

        // EventBus üzerinden screener'a bildir
        if (typeof EventBus !== 'undefined') {
            EventBus.emit('scalp:frSignal', signal);
        }
        // Ayrıca native event (detail-panel vb. dinleyenler için)
        window.dispatchEvent(new CustomEvent('scalpFRSignal', { detail: signal }));

        // Konsol logu
        const arrow = signal.display.arrow;
        const badge = signal.display.badge;
        console.log(
            `[ScalpFR] ${badge} ${symbol} | Başlangıç: ${signal.display.startFR}% → Şimdi: ${signal.display.currentFR}% | Δ: ${signal.display.delta}% | ${arrow} ${direction}`
        );
    }

    // ─────────────────────────────────────────────────────────────
    // Sorgulama metodları
    // ─────────────────────────────────────────────────────────────

    // Son N sinyali döner (screener tablosu için)
    getSignals(limit = 50) {
        return this.signals.slice(0, limit);
    }

    // Belirli sembolün son sinyali
    getLastSignal(symbol) {
        return this.signals.find(s => s.symbol === symbol) || null;
    }

    // Sadece yeşil sinyaller (more_negative)
    getGreenSignals(limit = 50) {
        return this.signals.filter(s => s.direction === 'more_negative').slice(0, limit);
    }

    // Sadece kırmızı sinyaller (less_negative)
    getRedSignals(limit = 50) {
        return this.signals.filter(s => s.direction === 'less_negative').slice(0, limit);
    }

    // Bir sembolün aktif pencere bilgisi (ne zaman başladı, şu anki durum)
    getWindowStatus(symbol) {
        if (!this.windows.has(symbol)) return null;
        const win = this.windows.get(symbol);
        const elapsed = Date.now() - win.startTime;
        const elapsedMin = Math.floor(elapsed / 60000);
        const lastFR = win.minuteSnapshots[win.minuteSnapshots.length - 1].fr;
        return {
            symbol,
            startFR: win.startFR,
            lastFR,
            delta: lastFR - win.startFR,
            elapsedMs: elapsed,
            elapsedMin,
            remainingMin: Math.max(0, 10 - elapsedMin),
            snapshotCount: win.minuteSnapshots.length,
        };
    }

    // Tüm aktif pencerelerin durumu
    getAllWindowStatuses() {
        return Array.from(this.windows.keys()).map(s => this.getWindowStatus(s));
    }

    // ─────────────────────────────────────────────────────────────
    // Format yardımcıları
    // ─────────────────────────────────────────────────────────────

    // FR değerini borsadaki görünümüne çevirir: -0.2113 → "-0.2113%"
    // (değer zaten % cinsinden, sadece % işareti eklenir)
    _fmt(val) {
        return val.toFixed(4) + '%';
    }

    // Delta formatı: negatif delta "-0.0123%", pozitif "+0.0123%"
    _fmtDelta(delta) {
        const sign = delta >= 0 ? '+' : '';
        return sign + delta.toFixed(4) + '%';
    }

    _fmtTime(ts) {
        return new Date(ts).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }

    // Sinyalleri temizle
    clearSignals() {
        this.signals = [];
    }

    // Belirli sembolün penceresini manuel sıfırla
    resetWindow(symbol) {
        this.windows.delete(symbol);
    }

    // Tüm pencereleri sıfırla
    resetAllWindows() {
        this.windows.clear();
    }
}

// =====================================================================
// Global instance'lar
// =====================================================================
window.FRTracker = FRTracker;

const scalpFRMonitor = new ScalpFRMonitor();
window.scalpFRMonitor = scalpFRMonitor;
