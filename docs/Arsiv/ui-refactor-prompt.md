# UI Refactor Prompt — Bot Signals / Scalp FR Sinyalleri Paneli

## Bağlam

Bu proje bir kripto screener web uygulamasıdır. Mevcut kodda iki dosya ilgilidir:

- **`fr-tracker.js`** — `FRTracker` ve `ScalpFRMonitor` sınıflarını içerir. İş mantığı doğrudur, değişmeyecek.
- **`detail-panel.js`** — `DetailPanel` modülünü içerir. İçinde `_renderSignalsTab()` fonksiyonu, "Bot Sinyalleri" sekmesinin HTML'ini üretir. Bu fonksiyon tamamen yeniden yazılacak.

---

## Mevcut Sorunlar

1. **Coin filtresi yok:** `_renderSignalsTab()` tüm coinlerin sinyallerini listeler. Kullanıcının seçili coin'e göre (Selected Coin) veya tüm coin'lere göre (All Coins) filtreleyebilmesi gerekiyor.
2. **Dark/Light tema uyumsuzluğu:** Satır renkleri `rgba(38,166,154,0.04)` gibi hardcoded hex değerleriyle yazılmış. CSS değişkeni kullanılmıyor, bu yüzden light temada görünüm bozuluyor.
3. **Mimari sorun:** Bot UI kodu `detail-panel.js` içinde gömülü. Ayrı bir dosyaya (`bot-signals-panel.js`) taşınması gerekiyor.
4. **Grafik eksik:** İkinci referans görselde (hedef tasarım) her coin için küçük bir FR geçmiş grafiği (çubuk + çizgi + sinyal üçgeni) bulunuyor. Mevcut kodda bu yok.
5. **Tarih filtresi eksik:** `24s / 3g / 7g / 30g` zaman dilimi butonları yok. Şu an sadece son 24 saat gösteriliyor.
6. **İç sekme yapısı eksik:** FR / M1 Hammer / M1-A / V3 / 4S gibi bot tipi sekmeleri yok. Şu an tek bir liste var.

---

## Hedef Tasarım (Referans Görsel 2)

Hedef UI şu bileşenleri içerir:

```
┌─────────────────────────────────────────────────┐
│ [Detailed View]  [Bot Signals ✓]  [Coin News]   │  ← Dış sekmeler (mevcut)
├─────────────────────────────────────────────────┤
│ [FR ✓] [M1 Hammer] [M1-A] [V3] [4S]            │  ← İç bot tipi sekmeleri (YENİ)
├─────────────────────────────────────────────────┤
│ 📅 Filtre: [24s ✓] [3g] [7g] [30g]             │  ← Zaman filtresi (YENİ)
├─────────────────────────────────────────────────┤
│ BABYUSDT — FR geçmişi (24s)           [grafik]  │  ← Mini grafik (YENİ, seçili coin için)
├─────────────────────────────────────────────────┤
│ Filtre: [Seçili Coin ✓] [Tüm Coinler]          │  ← Coin filtresi (YENİ)
├─────────────────────────────────────────────────┤
│ ↑  Previous    Current    Delta   Remaining Saat│  ← Tablo başlığı
│ [yeşil bant] -1.9800%  -2.0000%  +0.0200%  ... │  ← Satırlar
│ [kırmızı bant] ...                              │
│ son 24s · 3 sinyal                              │
└─────────────────────────────────────────────────┘
```

---

## Yapılacak Değişiklikler

### 1. Yeni Dosya: `bot-signals-panel.js`

`detail-panel.js` içindeki `_renderSignalsTab()` fonksiyonu ve bağlı tüm state bu dosyaya taşınacak. `detail-panel.js`'de yalnızca şu kalacak:

```js
// detail-panel.js içinde:
EventBus.on('scalp:frSignal', () => BotSignalsPanel.render());
window.addEventListener('scalpFRSignal', () => BotSignalsPanel.render());
```

`bot-signals-panel.js` şu yapıda olacak:

```js
const BotSignalsPanel = (() => {

  // State
  let _activeBot = 'fr';          // 'fr' | 'm1hammer' | 'm1a' | 'v3' | '4s'
  let _activeFilter = '24s';      // '24s' | '3g' | '7g' | '30g'
  let _coinFilter = 'selected';   // 'selected' | 'all'
  let _selectedSymbol = null;     // EventBus'tan gelir

  // Public API
  function init() { /* event listener bağla, ilk render */ }
  function render() { /* container'ı güncelle */ }

  return { init, render };
})();

window.BotSignalsPanel = BotSignalsPanel;
```

---

### 2. Coin Filtresi

`_renderSignalsTab()` (yeni adıyla `BotSignalsPanel.render()`) içine şu filtre butonu grubu eklenmeli:

```html
<div class="bsp-coin-filter">
  <button class="bsp-filter-btn active" data-filter="selected">Seçili Coin</button>
  <button class="bsp-filter-btn" data-filter="all">Tüm Coinler</button>
</div>
```

Filtre mantığı:

```js
const signals = scalpFRMonitor.getSignals(200).filter(s => {
  // Zaman filtresi
  const age = Date.now() - s.timestamp;
  const maxAge = { '24s': 86400000, '3g': 259200000, '7g': 604800000, '30g': 2592000000 }[_activeFilter];
  if (age > maxAge) return false;

  // Coin filtresi
  if (_coinFilter === 'selected' && _selectedSymbol) {
    const sigSym = s.symbol.replace(/USDT$/, '');
    if (sigSym !== _selectedSymbol) return false;
  }

  return true;
});
```

`_selectedSymbol`, `EventBus.on('symbol:change', ...)` ile güncellenir.

---

### 3. Dark/Light Tema Uyumu

Mevcut hardcoded renkler CSS değişkenleriyle değiştirilmeli:

| Eski (hardcoded) | Yeni (CSS var) |
|---|---|
| `rgba(38,166,154,0.04)` | `var(--signal-bg-green)` |
| `rgba(239,83,80,0.04)` | `var(--signal-bg-red)` |
| `#26a69a` | `var(--signal-color-green)` |
| `#ef5350` | `var(--signal-color-red)` |
| `font-family:'Inter', sans-serif` | `var(--font-sans)` |

CSS'e (veya `<style>` bloğuna) şunlar eklenmeli:

```css
/* Light tema */
:root {
  --signal-color-green: #0d9488;
  --signal-color-red:   #dc2626;
  --signal-bg-green:    rgba(13, 148, 136, 0.06);
  --signal-bg-red:      rgba(220, 38,  38,  0.06);
}

/* Dark tema */
[data-theme="dark"], .dark {
  --signal-color-green: #2dd4bf;
  --signal-color-red:   #f87171;
  --signal-bg-green:    rgba(45, 212, 191, 0.08);
  --signal-bg-red:      rgba(248, 113, 113, 0.08);
}
```

---

### 4. Zaman Filtresi Butonları

Mevcut `cutoff = Date.now() - 24 * 60 * 60 * 1000` sabit değeri kaldırılacak. Yerine state'ten okunacak:

```js
const filterMs = {
  '24s': 24 * 3600 * 1000,
  '3g':   3 * 86400 * 1000,
  '7g':   7 * 86400 * 1000,
  '30g': 30 * 86400 * 1000,
}[_activeFilter] ?? 86400000;

const cutoff = Date.now() - filterMs;
```

Butonlar tıklandığında `_activeFilter` güncellenir ve `render()` tekrar çağrılır.

---

### 5. İç Bot Tipi Sekmeleri (FR / M1 Hammer / M1-A / V3 / 4S)

Şu an sadece FR sinyalleri var. Diğer bot tipleri (M1 Hammer vb.) henüz implement edilmemiş olabilir. Bu sekmeler UI'da gösterilmeli ancak aktif olmayan sekmeler için "Yakında" veya boş state gösterilmeli:

```js
const BOT_TABS = [
  { id: 'fr',        label: 'FR' },
  { id: 'm1hammer',  label: 'M1 Hammer' },
  { id: 'm1a',       label: 'M1-A' },
  { id: 'v3',        label: 'V3' },
  { id: '4s',        label: '4S' },
];
```

Sadece `fr` sekmesi aktif sinyal verir. Diğerleri için:

```html
<div class="bsp-empty">Bu bot tipi henüz aktif değil.</div>
```

---

### 6. Mini FR Grafik (Seçili Coin için)

`_coinFilter === 'selected'` ve `_selectedSymbol` set edilmişse, tablo üzerinde küçük bir grafik gösterilmeli.

Grafik verisi `window.FRTracker` instance'ından alınır (eğer global olarak oluşturulmuşsa):

```js
const frTrackerInstance = window.frTrackerInstance; // veya global adı neyse
const history = frTrackerInstance?.getHistory(_selectedSymbol + 'USDT') || [];
```

Grafik için Chart.js kullanılacak (zaten projede var). Çubuk + çizgi + sinyal üçgeni:

```js
new Chart(ctx, {
  data: {
    datasets: [
      { type: 'bar',     data: frValues, backgroundColor: 'var(--signal-color-green)' },
      { type: 'line',    data: frValues, borderColor: 'var(--signal-color-green)', pointRadius: 0 },
      { type: 'scatter', data: signalPoints, pointStyle: 'triangle', ... }
    ]
  }
});
```

Grafik sadece `fr` sekmesinde ve `selected` modunda gösterilir.

---

## Değişmeyecek Şeyler

- `FRTracker` ve `ScalpFRMonitor` sınıflarının iç mantığı (`fr-tracker.js`) — dokunma.
- `detail-panel.js`'deki `update()`, `loadSymbol()`, `init()` fonksiyonları — yalnızca `_renderSignalsTab()` çağrıları `BotSignalsPanel.render()` ile değiştirilecek.
- `EventBus`, `State`, `AppConfig` — bunlar mevcut global altyapı, aynı kullanılacak.
- Sinyal veri formatı (`sig.display.startFR`, `sig.display.currentFR`, `sig.display.delta`, `sig.display.time`) — aynı.

---

## Beklenen Çıktı Dosyaları

1. **`bot-signals-panel.js`** — Yeni dosya. Tüm bot UI mantığı burada.
2. **`detail-panel.js` (güncellendi)** — `_renderSignalsTab()` kaldırıldı, yerine `BotSignalsPanel.render()` çağrısı eklendi.
3. **CSS eklentisi** — `--signal-color-green`, `--signal-color-red`, `--signal-bg-green`, `--signal-bg-red` değişkenleri, mevcut CSS dosyasına (veya `<style>` bloğuna) eklenmeli.

---

## Notlar

- `fr-tracker.js`'de `window.FRTracker = FRTracker` ve `window.scalpFRMonitor = scalpFRMonitor` global olarak tanımlı. `BotSignalsPanel` bunları `window.scalpFRMonitor` üzerinden okuyacak.
- Grafik her render'da yeniden oluşturulacak. Önceki Chart.js instance'ı `chart.destroy()` ile temizlenmeli.
- `BotSignalsPanel.init()`, `DetailPanel.init()` içinden çağrılacak: `BotSignalsPanel.init()` satırı `detail-panel.js`'in `init()` fonksiyonuna eklenmeli.
- `_selectedSymbol` başlangıçta `State.get('activeSymbol')?.replace(/USDT$/, '')` ile set edilmeli.
