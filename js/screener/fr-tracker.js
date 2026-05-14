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
       this.lowThreshold = 0.00014; // 0.014% → ondalık
        this.mediumThreshold = 0.0002; // 0.02% → ondalık
        this.cumulativeThreshold = 0.00015; // 0.015% → ondalık (kullanılmayacak ama kalsın)
        this.rapidChangeThreshold = 0.0005; // 0.05% → ondalık
        this.rapidAlerts = new Map();
        // Kümülatif tracking için
        this.lastCumulativeTime = new Map(); // Son kümülatif kayıt zamanı
        this.cumulativeInterval = 3 * 60 * 1000; // 3 dakika
    }

    // Add FR value to history (Smart Tracking)
    addFRValue(symbol, fundingRate, timestamp = Date.now()) {
        if (!this.frHistory.has(symbol)) {
            this.frHistory.set(symbol, []);
            this.pendingChanges.set(symbol, 0);
        }

        const history = this.frHistory.get(symbol);

        // Ilk kayit - hemen ekle
        if (history.length === 0) {
            this._addEntry(symbol, fundingRate, timestamp);
            return;
        }

        const lastEntry = history[history.length - 1];
        const change = Math.abs(fundingRate - lastEntry.value);
        const timeDiff = timestamp - lastEntry.timestamp;

        // 4 saat gecmisse her turlu kaydet (periodic snapshot)
        if (timeDiff >= 4 * 60 * 60 * 1000) {
            this.pendingChanges.set(symbol, 0);
            this._addEntry(symbol, fundingRate, timestamp);
            return;
        }

        // Ayni deger - kaydetme
        if (change === 0) {
            return;
        }

        // AKILLI CEKME MANTIGI
        if (change >= this.lowThreshold) {
            // ANI DEĞİŞİM (>= 0.009)
            const pending = this.pendingChanges.get(symbol) || 0;

            // Eğer birikmiş kümülatif varsa, önce onu kaydet
            if (pending > 0) {
                this._addEntry(symbol, lastEntry.value, lastEntry.timestamp);
                console.log(`📊 ${symbol}: Kümülatif ${pending.toFixed(5)} (önceki)`);
            }

            // Şimdi ani değişimi kaydet
            this.pendingChanges.set(symbol, 0);
            this.lastCumulativeTime.set(symbol, timestamp);
            this._addEntry(symbol, fundingRate, timestamp);

            if (change >= this.mediumThreshold) {
                console.log(`⚡ ${symbol}: Yüksek ani değişim ${change.toFixed(5)}`);
            } else {
                console.log(`⚡ ${symbol}: Orta ani değişim ${change.toFixed(5)}`);
            }

            // Toast alert for 0.02% change (only for negative FR getting MORE negative)
            const prevFR = lastEntry.value;
            if (change >= 0.0002 && fundingRate < 0 && fundingRate < prevFR) {
                window.dispatchEvent(new CustomEvent('frRapidChange', {
                    detail: { symbol, change, fundingRate }
                }));
            }
            // Rapid alert check (FR crosses -0.05% threshold)            
            if (fundingRate <= -0.0005 && prevFR > -0.0005) {
                this.rapidAlerts.set(symbol, Date.now());
                console.log(`🚨 ${symbol}: FR -0.05%'i geçti! ${fundingRate.toFixed(5)}`);
            }
        } else {
            // KÜÇÜK DEĞİŞİM (< 0.009) - KÜMÜLATİF
            const pending = (this.pendingChanges.get(symbol) || 0) + change;
            this.pendingChanges.set(symbol, pending);
            
            // İlk küçük değişimde zamanı başlat
            if (!this.lastCumulativeTime.has(symbol)) {
                this.lastCumulativeTime.set(symbol, timestamp);
                console.log(`🕐 ${symbol}: İlk kümülatif zaman başlatıldı`);
            }
            
            const lastCumulativeTime = this.lastCumulativeTime.get(symbol);
            const timeSinceLastCumulative = timestamp - lastCumulativeTime;
            
            // DEBUG LOGLARI
            console.log(`🔍 ${symbol}: Küçük değişim ${change.toFixed(6)}, Pending: ${pending.toFixed(6)}, Zaman: ${(timeSinceLastCumulative/1000).toFixed(0)}sn`);
            
            // 2 koşuldan biri: Kümülatif >= 0.00015 VEYA 5 dakika doldu
            if (timeSinceLastCumulative >= this.cumulativeInterval) {
                this._addEntry(symbol, fundingRate, timestamp);
                console.log(`📊 ${symbol}: 3dk kümülatif ${pending.toFixed(5)}`);
                
                this.pendingChanges.set(symbol, 0);
                this.lastCumulativeTime.set(symbol, timestamp);
            } else {
                console.log(`⏳ ${symbol}: Biriktiriliyor... (${pending.toFixed(6)}, Zaman: ${(timeSinceLastCumulative/1000).toFixed(0)}sn)`);
            }
        }
    }

    // Internal: Add entry to history
    _addEntry(symbol, fundingRate, timestamp) {
        const history = this.frHistory.get(symbol);

        history.push({
            value: fundingRate,
            timestamp: timestamp,
            interval: this.detectInterval(symbol, fundingRate)
        });

        // Keep only last N values
        if (history.length > this.maxHistoryLength) {
            history.shift();
        }

        // Store 24h ago value (simplified: store first value as 24h ago)
        if (!this.fr24hAgo.has(symbol)) {
            this.fr24hAgo.set(symbol, fundingRate);
        }
    }

    // Get FR history for symbol
    getHistory(symbol) {
        return this.frHistory.get(symbol) || [];
    }

    // Check if symbol has rapid alert (within last 5 minutes)
    hasRapidAlert(symbol) {
        const alertTime = this.rapidAlerts.get(symbol);
        if (!alertTime) return false;
        return (Date.now() - alertTime) < 5 * 60 * 1000; // 5 dakika
    }

    // Detect if FR interval changed (normal: 4h/8h, abnormal: 1h/2h)
    detectInterval(symbol, currentFR) {
        const history = this.getHistory(symbol);
        if (history.length < 2) return '8h'; // Default

        const lastEntry = history[history.length - 1];
        const timeDiff = Date.now() - lastEntry.timestamp;

        // Check if update frequency changed
        if (timeDiff < 2 * 60 * 60 * 1000) { // Less than 2 hours
            return '1h'; // Abnormal
        } else if (timeDiff < 4 * 60 * 60 * 1000) { // Less than 4 hours
            return '2h'; // Abnormal
        } else if (timeDiff < 6 * 60 * 60 * 1000) { // Less than 6 hours
            return '4h'; // Normal
        }

        return '8h'; // Normal
    }

    // Check if interval changed (for warning)
    hasIntervalChanged(symbol) {
        const history = this.getHistory(symbol);
        if (history.length < 2) return false;

        const lastInterval = history[history.length - 1].interval;
        const prevInterval = history[history.length - 2].interval;

        // Check if changed from 8h/4h to 2h/1h
        if ((prevInterval === '8h' || prevInterval === '4h') &&
            (lastInterval === '2h' || lastInterval === '1h')) {
            return true;
        }

        return false;
    }

    // Calculate FR change from 24h ago
    calculate24hChange(symbol, currentFR) {
        const fr24h = this.fr24hAgo.get(symbol);
        if (!fr24h) return 0;

        return currentFR - fr24h;
    }

    // Get FR change direction and magnitude
    getFRChangeMagnitude(symbol) {
        const history = this.getHistory(symbol);
        if (history.length < 2) return 0;

        const latest = history[history.length - 1].value;
        const previous = history[history.length - 2].value;

        return latest - previous;
    }

    // Format FR history for badge display
    formatHistoryForBadge(symbol) {
        const history = this.getHistory(symbol);

        return history.map((entry, index) => {
            const change = index > 0 ? entry.value - history[index - 1].value : 0;

            return {
                value: Utils.formatFundingRate(entry.value),
                time: Utils.formatTimestamp(entry.timestamp),
                change: change,
                changeFormatted: change !== 0 ?
                    (change > 0 ? '↑ ' : '↓ ') + Utils.formatFundingRate(Math.abs(change)) :
                    '-',
                changeClass: Utils.getColorClass(change)
            };
        }).reverse(); // Show newest first
    }

    // Clear history for symbol
    clearHistory(symbol) {
        this.frHistory.delete(symbol);
        this.fr24hAgo.delete(symbol);
    }

    // Clear all history
    clearAllHistory() {
        this.frHistory.clear();
        this.fr24hAgo.clear();
    }

    // FR Trend Analizi: Düzenli negatif yönde ilerleme kontrolü
    // Son 5 FR değeri düzenli şekilde daha negatif oluyorsa true döner
    // Örnek: -0.01 → -0.02 → -0.03 → -0.04 → -0.05
    isConsistentlyNegative(symbol) {
        const history = this.getHistory(symbol);

        // En az 5 değer olmalı
        if (history.length < 5) return false;

        // Son 5 değeri al
        const last5 = history.slice(-5);

        // Her bir değer bir öncekinden daha negatif mi kontrol et
        for (let i = 1; i < last5.length; i++) {
            // Eğer mevcut değer öncekinden daha büyük veya eşitse (daha az negatif), false döner
            if (last5[i].value >= last5[i - 1].value) {
                return false;
            }
        }

        return true; // Tüm değerler düzenli şekilde azalıyor (daha negatif)
    }

    // FR Trend Analizi: Düzenli pozitif yönde ilerleme kontrolü
    // Son 5 FR değeri düzenli şekilde daha pozitif oluyorsa true döner
    // Örnek: -0.05 → -0.04 → -0.03 → -0.02 → -0.01
    isConsistentlyPositive(symbol) {
        const history = this.getHistory(symbol);

        // En az 5 değer olmalı
        if (history.length < 5) return false;

        // Son 5 değeri al
        const last5 = history.slice(-5);

        // Her bir değer bir öncekinden daha pozitif mi kontrol et
        for (let i = 1; i < last5.length; i++) {
            // Eğer mevcut değer öncekinden daha küçük veya eşitse (daha az pozitif), false döner
            if (last5[i].value <= last5[i - 1].value) {
                return false;
            }
        }

        return true; // Tüm değerler düzenli şekilde artıyor (daha pozitif)
    }

    // FR Trend Tipi: 'negative', 'positive', veya 'neutral'
    // Bu fonksiyon TableManager tarafından styling için kullanılacak
    getFRTrendType(symbol) {
        if (this.isConsistentlyNegative(symbol)) {
            return 'negative'; // Kırmızı, kalın
        } else if (this.isConsistentlyPositive(symbol)) {
            return 'positive'; // Yeşil, normal
        } else {
            return 'neutral'; // Beyaz, normal
        }
    }
}

// Export
window.FRTracker = FRTracker;
