// ===== FR Tracker - Funding Rate History & Change Detection =====

class FRTracker {
    constructor() {
        // Store FR history for each symbol (last 5 values)
        this.frHistory = new Map();

        // Store 24h ago FR for rank calculation
        this.fr24hAgo = new Map();

        // Yeni eşikler (Arayüzdeki Yüzdelik değerlerle uyumlu: 0.01 = %0.01)
        this.lowThreshold = 0.01;
        this.rapidChangeThreshold = 0.02;
        this.globalAlarmThreshold = 0.03;

        // Baseline (Bekleme Başlangıcı) takibi
        this.baselineValue = new Map();
        this.baselineTime = new Map();
    }

    // Add FR value to history (Smart Tracking)
    addFRValue(symbol, fundingRate, timestamp = Date.now()) {
        if (!this.frHistory.has(symbol)) {
            this.frHistory.set(symbol, []);
            this.baselineValue.set(symbol, fundingRate);
            this.baselineTime.set(symbol, timestamp);
        }

        const history = this.frHistory.get(symbol);

        if (history.length === 0) {
            this._addEntry(symbol, fundingRate, timestamp);
            this.baselineValue.set(symbol, fundingRate);
            this.baselineTime.set(symbol, timestamp);
            return;
        }

        const baselineFR = this.baselineValue.get(symbol);
        const baselineTs = this.baselineTime.get(symbol);
        const change = Math.abs(fundingRate - baselineFR);

        if (change >= this.lowThreshold) { // >= 0.01
            // Önceki değeri (baseline) history'ye ekle (eğer son kayıt değilse)
            const lastEntry = history[history.length - 1];
            if (lastEntry && lastEntry.timestamp !== baselineTs) {
                this._addEntry(symbol, baselineFR, baselineTs);
            }
            // Güncel değeri (aşılan noktayı) history'ye ekle
            this._addEntry(symbol, fundingRate, timestamp);

            // Arayüze event fırlat (0.01, 0.02, 0.03 eşiklerini UI'da filtreleyeceğiz)
            window.dispatchEvent(new CustomEvent('frRapidChange', {
                detail: { 
                    symbol, 
                    change, 
                    fundingRate, 
                    previousFR: baselineFR,
                    timestamp 
                }
            }));

            // Yeni baseline olarak güncel durumu ayarla
            this.baselineValue.set(symbol, fundingRate);
            this.baselineTime.set(symbol, timestamp);
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

    /**
     * Sunucudan geçmiş FR verisini çekip history'ye enjekte eder.
     * Sayfa yeni açılmış olsa bile grafik dolup taşar.
     */
    async preloadFromServer(symbol, exchange, hours = 48) {
        try {
            const sym = symbol.endsWith('USDT') ? symbol : symbol + 'USDT';
            const resp = await fetch(`/api/history/fr/${exchange}/${sym}?hours=${hours}`);
            if (!resp.ok) return;
            const records = await resp.json(); // [{ timestamp, fundingRate }, ...]
            if (!Array.isArray(records) || records.length === 0) return;

            // Mevcut history'yi sıfırlama — sadece sunucudan gelen eski verileri ekle
            if (!this.frHistory.has(sym)) {
                this.frHistory.set(sym, []);
                // baseline'ı boş bırakıyoruz, çünkü ilk veri gelince belirlenecek
            }
            const history = this.frHistory.get(sym);
            const existingTs = new Set(history.map(h => h.timestamp));

            // maxHistoryLength kısıtını kaldır — 48 saatlik veri saklansın
            this.maxHistoryLength = Math.max(this.maxHistoryLength, records.length + 200);

            let added = 0;
            for (const r of records) {
                const ts = new Date(r.timestamp).getTime();
                if (existingTs.has(ts)) continue;
                history.push({ value: r.fundingRate, timestamp: ts, interval: 'server' });
                added++;
            }
            // Tarihe göre sırala
            history.sort((a, b) => a.timestamp - b.timestamp);
            console.log(`[FRTracker] Preload: ${sym}@${exchange} — ${added} kayıt eklendi`);
        } catch (e) {
            console.warn('[FRTracker] Sunucu preload hatası:', e.message);
        }
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

    // Yeni Eşikler
    static THRESHOLD_NORMAL = 0.01;
    static THRESHOLD_RAPID  = 0.02;
    static THRESHOLD_ALARM  = 0.03;

    constructor(exchange = 'binance') {
        this.exchange = exchange;
        // Her sembol için bekleme başlangıcı (baseline)
        // Map<symbol, { startFR, startTime }>
        this.windows = new Map();

        // Kaydedilen sinyaller listesi (screener'a gösterilecek)
        this.signals = [];

        // Maksimum kaç sinyal tutulacak
        this.maxSignals = 5000;
    }

    // ─────────────────────────────────────────────────────────────
    // Ana giriş noktası — her dakika FR güncellemesi geldiğinde çağrılır
    // fundingRate: ham değer, borsada "-0.2113%" olarak görüneni → -0.2113
    // ─────────────────────────────────────────────────────────────
    onFRUpdate(symbol, fundingRate, timestamp = Date.now()) {

        // Sadece negatif FR'leri izle
        if (fundingRate >= 0) {
            if (this.windows.has(symbol)) {
                const win = this.windows.get(symbol);
                const delta = fundingRate - win.startFR;
                // Eşiği aşmasa bile pozitife geçişte kırmızı sinyal kaydet ve pencereyi kapat
                if (Math.abs(delta) >= ScalpFRMonitor.THRESHOLD_NORMAL) {
                    this._recordSignal(symbol, win.startFR, fundingRate, timestamp, 'normal', delta);
                }
                this.windows.delete(symbol);
            }
            return;
        }

        // Başlangıç noktası (Baseline) yoksa oluştur
        if (!this.windows.has(symbol)) {
            this.windows.set(symbol, {
                startFR: fundingRate,
                startTime: timestamp
            });
            return;
        }

        const win = this.windows.get(symbol);
        const delta = fundingRate - win.startFR;
        const absDelta = Math.abs(delta);

        // ── KURAL: Kümülatif fark eşiği geçtiğinde sinyal üret ve sıfırla ──
        if (absDelta >= ScalpFRMonitor.THRESHOLD_NORMAL) {
            
            let severity = 'normal';
            if (absDelta >= ScalpFRMonitor.THRESHOLD_ALARM) {
                severity = 'alarm'; // 0.03+ (Global Alarm)
            } else if (absDelta >= ScalpFRMonitor.THRESHOLD_RAPID) {
                severity = 'rapid'; // 0.02+ (Ani Yükseliş)
            }

            this._recordSignal(symbol, win.startFR, fundingRate, timestamp, severity, delta);
            
            // Baseline'ı güncelle (yeni bir bekleme periyodu başlar)
            this.windows.set(symbol, {
                startFR: fundingRate,
                startTime: timestamp
            });
        }
    }

    // ─────────────────────────────────────────────────────────────
    // Sinyal kayıt — tüm kayıtlar buradan geçer
    // severity: 'normal' | 'rapid' | 'alarm'
    // delta: fundingRate - startFR (negatif = daha negatife gitti)
    // ─────────────────────────────────────────────────────────────
    _recordSignal(symbol, startFR, currentFR, timestamp, severity, delta = null) {
        const d = delta !== null ? delta : (currentFR - startFR);

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
            exchange: this.exchange,
            startFR,           
            currentFR,         
            delta: d,          
            deltaAbs: Math.abs(d),
            direction,         
            severity, // 'normal' (0.01), 'rapid' (0.02), 'alarm' (0.03)
            timestamp,
            display: {
                startFR:    this._fmt(startFR),
                currentFR:  this._fmt(currentFR),
                delta:      this._fmtDelta(d),
                time:       this._fmtTime(timestamp),
                colorClass: direction === 'more_negative' ? 'fr-signal-green'
                          : direction === 'less_negative' ? 'fr-signal-red'
                          : 'fr-signal-gray',
                arrow:      direction === 'more_negative' ? '▼'   
                          : direction === 'less_negative' ? '▲'   
                          : '─',
                badge:      severity === 'alarm' ? '🚨 Alarm' 
                          : severity === 'rapid' ? '⚡ Ani' 
                          : 'Sinyal',
            }
        };

        this.signals.unshift(signal); 
        if (this.signals.length > this.maxSignals) this.signals.pop();

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
        return {
            symbol,
            startFR: win.startFR,
            elapsedMs: elapsed,
            elapsedMin
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

const scalpFRMonitor         = new ScalpFRMonitor('binance');
const scalpFRMonitor_bybit   = new ScalpFRMonitor('bybit');

window.scalpFRMonitor        = scalpFRMonitor;          // geriye dönük uyumluluk
window.scalpFRMonitor_bybit  = scalpFRMonitor_bybit;

window.frTracker_binance     = new FRTracker();
window.frTracker_bybit       = new FRTracker();

// Exchange adına göre instance döndüren yardımcı
window.getScalpMonitor = (exchange) =>
  exchange === 'bybit' ? scalpFRMonitor_bybit : scalpFRMonitor;
