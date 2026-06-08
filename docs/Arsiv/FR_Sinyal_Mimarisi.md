# FR Sinyal Sistemi — Mimari ve İmplementasyon Planı

## 1. Analiz Özeti (live_fr_data.csv'den çıkarılan bulgular)

### Filtre Kriterleri
| Kriter | Değer | Açıklama |
|---|---|---|
| Şimdiki FR | `<= 0` | Yalnızca negatif veya sıfır FR'daki coinler alınır |
| Minimum değişim | `>= 0.0001` | Mutlak FR değişimi bu eşiğin altındaysa sinyal üretilmez |
| Sıralama | Değişim büyüklüğüne göre azalan | En çok hareket eden coinler üstte gelir |

### Tarama Sıklığı
- Bot her **~60 saniyede bir** tüm Binance perp coinlerini tarar
- Her taramada ortalama **104 coin** sinyal üretir
- Sinyaller aynı timestamp ile toplu (batch) olarak gelir

### FR Değer Dağılımı (referans)
| FR Aralığı | Sinyal Oranı |
|---|---|
| -0.01 ~ 0 | %37 |
| -0.05 ~ -0.01 | %43 |
| -0.1 ~ -0.05 | %13 |
| -0.2 ve altı | %7 |

### `Degisim` Sütunu Hesaplama
```
Degisim = abs(Simdiki_FR - Onceki_FR)
```
Ham API değerlerinden hesaplanır; CSV'deki yuvarlama farkları görmezden gelinebilir.

---

## 2. Sistem Mimarisi

```
Binance API ──┐
              ├──▶  fr-engine.js  ──▶  EventBus.emit('fr:signal')  ──▶  dp-signals-tab
Bybit API   ──┘
```

### Katmanlar

**Veri Kaynağı**
- Binance: `https://fapi.binance.com/fapi/v1/premiumIndex`
- Bybit: `https://api.bybit.com/v5/market/tickers?category=linear`
- Aktif exchange'e göre (mevcut `_lastExchange` değişkeni) otomatik seçilir

**İşleme (fr-engine.js)**
- Her 60 saniyede API çağrısı
- Filtre: `fundingRate <= 0` ve `|delta| >= 0.0001`
- Önbellek: önceki FR değerlerini saklar, delta hesaplar
- Sıralama: delta büyüklüğüne göre azalan
- `EventBus.emit('fr:signal', { signals, exchange })` ile yayınlar

**Arayüz (mevcut HTML)**
- `dp-signals-tab` div'i içinde render edilir
- Seçili coine ait sinyaller filtrelenerek gösterilir
- Telegram bot formatına uygun kart düzeni

---

## 3. Oluşturulacak Dosya

### `fr-engine.js` — Tek dosya, tüm mantık burada

```javascript
// fr-engine.js
// Kurulum: <script src="fr-engine.js"></script> — app.js'den sonra yükle

window.FREngine = (() => {
  const INTERVAL_MS   = 60_000;   // 60 saniye
  const MIN_DELTA     = 0.0001;   // minimum değişim eşiği
  const MAX_SIGNALS   = 200;      // gösterilecek max sinyal

  const cache = {};               // { symbol: lastFundingRate }
  let   timer = null;

  // ── API çağrıları ────────────────────────────────────────────
  async function fetchBinance() {
    const r = await fetch('https://fapi.binance.com/fapi/v1/premiumIndex');
    const d = await r.json();
    return d.map(item => ({
      symbol:      item.symbol,
      fundingRate: parseFloat(item.lastFundingRate),
      nextTime:    parseInt(item.nextFundingTime),
    }));
  }

  async function fetchBybit() {
    const r = await fetch('https://api.bybit.com/v5/market/tickers?category=linear');
    const d = await r.json();
    return (d?.result?.list || [])
      .filter(item => item.fundingRate != null)
      .map(item => ({
        symbol:      item.symbol,
        fundingRate: parseFloat(item.fundingRate),
        nextTime:    parseInt(item.nextFundingTime || 0),
      }));
  }

  // ── Filtre + delta hesaplama ─────────────────────────────────
  function process(tickers) {
    const signals = [];
    const now     = Date.now();

    for (const t of tickers) {
      const fr      = t.fundingRate;
      const prev    = cache[t.symbol];
      const delta   = prev != null ? Math.abs(fr - prev) : 0;

      cache[t.symbol] = fr;   // önbelleği güncelle

      if (prev == null)  continue;              // ilk tarama — delta yok
      if (fr > 0)        continue;              // yalnızca negatif FR
      if (delta < MIN_DELTA) continue;          // minimum değişim eşiği

      const remaining = t.nextTime > now
        ? t.nextTime - now
        : null;

      signals.push({
        symbol:      t.symbol,
        currentFR:   fr,
        previousFR:  prev,
        delta,
        remaining,   // ms cinsinden, null ise bilinmiyor
      });
    }

    // delta büyüklüğüne göre azalan sıralama
    return signals
      .sort((a, b) => b.delta - a.delta)
      .slice(0, MAX_SIGNALS);
  }

  // ── Zaman formatlama ─────────────────────────────────────────
  function fmtRemaining(ms) {
    if (!ms || ms < 0) return '—';
    const h = Math.floor(ms / 3_600_000);
    const m = Math.floor((ms % 3_600_000) / 60_000);
    const s = Math.floor((ms % 60_000) / 1_000);
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  }

  // ── Ana döngü ────────────────────────────────────────────────
  async function tick(exchange) {
    try {
      const tickers = exchange === 'bybit'
        ? await fetchBybit()
        : await fetchBinance();

      const signals = process(tickers);
      EventBus.emit('fr:signal', { signals, exchange, fmtRemaining });
    } catch (err) {
      console.warn('[FREngine] Hata:', err);
    }
  }

  // ── Başlat / Durdur ──────────────────────────────────────────
  function start(exchange = 'binance') {
    stop();
    tick(exchange);
    timer = setInterval(() => tick(exchange), INTERVAL_MS);
  }

  function stop() {
    if (timer) { clearInterval(timer); timer = null; }
  }

  return { start, stop, fmtRemaining };
})();
```

---

## 4. HTML — Sinyal Kartı Şablonu

`dp-signals-tab` içine render edilecek kart formatı (Telegram bot görseliyle aynı düzen):

```html
<!-- Örnek render çıktısı — fr-engine.js otomatik üretir -->
<div class="fr-signal-card">
  <div class="fr-signal-header">
    <span class="fr-symbol">#OMUSDT</span>
    <span class="fr-time">23:33</span>
  </div>
  <div class="fr-signal-body">
    <div>Funding Rate: <span class="fr-negative">-0.8607</span></div>
    <div>Previous Funding: <span class="fr-negative">-0.8442</span></div>
    <div>Difference: <span>0.016565</span></div>
    <div>Time Remaining: <span>01:26:59</span></div>
  </div>
  <div class="fr-signal-links">
    <a href="#">Binance</a> | <a href="#">Tradingview</a>
  </div>
</div>
```

---

## 5. app.js'e Eklenecek Satırlar

`app.js` içinde mevcut `EventBus.on('symbol:change', ...)` bloğunun yanına:

```javascript
// FR Engine'i başlat ve exchange değişimini dinle
if (window.FREngine) {
  FREngine.start(_lastExchange);

  EventBus.on('symbol:change', ({ exchange }) => {
    if (exchange && exchange !== _lastExchange) {
      FREngine.start(exchange);   // exchange değişince yeniden başlat
    }
  });

  // FR sinyallerini Bot Sinyalleri sekmesine yaz
  EventBus.on('fr:signal', ({ signals, exchange, fmtRemaining }) => {
    const tab = document.getElementById('dp-signals-tab');
    if (!tab || tab.style.display === 'none') return;

    const activeSymbol = State.get('activeSymbol');

    // Seçili coinin sinyallerini filtrele (yoksa tümünü göster)
    const filtered = activeSymbol
      ? signals.filter(s => s.symbol === activeSymbol)
      : signals;

    if (filtered.length === 0) {
      tab.innerHTML = '<p style="color:var(--text-muted);padding:12px">Bu coin için FR sinyali yok.</p>';
      return;
    }

    tab.innerHTML = filtered.map(s => `
      <div class="fr-signal-card">
        <div class="fr-signal-header">
          <span class="fr-symbol">#${s.symbol}</span>
          <span class="fr-time">${new Date().toTimeString().slice(0,5)}</span>
        </div>
        <div class="fr-signal-body">
          <div>Funding Rate: <span class="fr-negative">${s.currentFR.toFixed(4)}</span></div>
          <div>Previous Funding: <span class="fr-negative">${s.previousFR.toFixed(4)}</span></div>
          <div>Difference: <span>${s.delta.toFixed(6)}</span></div>
          <div>Time Remaining: <span>${fmtRemaining(s.remaining)}</span></div>
        </div>
        <div class="fr-signal-links">
          <a href="https://www.binance.com/tr/futures/${s.symbol}" target="_blank">Binance</a> |
          <a href="https://www.tradingview.com/chart/?symbol=BINANCE:${s.symbol}.P" target="_blank">Tradingview</a>
        </div>
      </div>
    `).join('');
  });
}
```

---

## 6. CSS — Sinyal Kartı Stilleri

Mevcut CSS dosyana eklenecek:

```css
/* FR Sinyal Kartları */
.fr-signal-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-primary);
  border-radius: 8px;
  padding: 10px 12px;
  margin-bottom: 8px;
  font-size: 13px;
}

.fr-signal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.fr-symbol {
  font-weight: 600;
  color: var(--accent-teal);
  font-size: 14px;
}

.fr-time {
  color: var(--text-muted);
  font-size: 12px;
}

.fr-signal-body div {
  line-height: 1.7;
  color: var(--text-secondary);
}

.fr-negative {
  color: var(--accent-teal);   /* negatif FR = teal (long fırsatı) */
}

.fr-signal-links {
  margin-top: 6px;
  font-size: 12px;
}

.fr-signal-links a {
  color: var(--accent-teal);
  text-decoration: none;
}

.fr-signal-links a:hover {
  text-decoration: underline;
}
```

---

## 7. HTML'e Eklenecek Script Satırı

`app.js`'den **sonra**, kapanış `</body>` etiketinden önce:

```html
<script src="fr-engine.js"></script>
```

---

## 8. Netleşmesi Gereken Sorular

Implementasyona geçmeden önce yanıtlanması gereken 2 soru:

1. **Sinyal kapsamı:** Bot Sinyalleri sekmesinde sadece seçili coinin FR değişimleri mi gösterilecek (örn. EDENUSDT seçiliyken sadece EDEN), yoksa tüm piyasadan en büyük FR değişimleri listesi mi?

2. **HTML dosyası:** `dp-signals-tab` id'li div hangi HTML dosyasında — yükleyebilir misin? Eğer bu div yoksa sıfırdan HTML parçası yazılacak.

---

## 9. Sonraki Adımlar

- [ ] Yukarıdaki 2 soruyu yanıtla
- [ ] HTML dosyasını paylaş (veya yapısını söyle)
- [ ] `fr-engine.js` dosyasını oluştur
- [ ] CSS stillerini ekle
- [ ] `app.js`'e EventBus dinleyicilerini ekle
- [ ] Tarayıcıda test et, exchange geçişini doğrula
- [ ] Diğer sinyal tiplerini (Sinyal 2–6) aynı EventBus mimarisine ekle
