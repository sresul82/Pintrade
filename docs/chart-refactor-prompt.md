# Chart Refactor Prompt — `bot-signals-panel.js` Grafik Bölümü

## Hedef

`bot-signals-panel.js` içindeki FR geçmiş grafiği iki açıdan yeniden yazılacak:

1. **Grafik veri kaynağı değişecek** — `window.frTrackerInstance.getHistory()` yerine, grafik doğrudan `scalpFRMonitor`'dan gelen sinyallerin zaman + FR değerlerini kullanacak.
2. **Grafik açılır/kapanır hale gelecek** — başlık satırına tıklanınca grafik alanı smooth animasyonla kapanıp açılacak. State JS değişkeninde tutulacak.

---

## Değişecek Bölümler

### A. State: Yeni değişken ekle

`render()` fonksiyonunun dışında, diğer state değişkenlerinin yanına şu eklenecek:

```js
let _chartOpen = true;   // grafik başlangıçta açık
```

---

### B. Grafik başlık satırı (titlebar) HTML'i

Mevcut kod (satır ~311):
```js
html += `
  <div style="padding: 6px 10px; font-size:10px; font-weight:600; color:var(--text-primary); border-bottom:0.5px solid var(--border-primary);">
    ${_selectedSymbol} FR GEÇMİŞİ (son 24s)
  </div>
  <div class="bsp-chart-container">
    <canvas id="bsp-mini-chart"></canvas>
  </div>`;
```

Yeni kod:
```js
html += `
  <div id="bsp-chart-titlebar" style="
    display:flex; align-items:center; justify-content:space-between;
    padding:5px 10px; cursor:pointer; user-select:none;
    background:var(--bg-secondary);
    border-bottom:0.5px solid var(--border-primary);
  ">
    <span style="font-size:10px; font-weight:600; color:var(--text-primary);">
      ${_selectedSymbol} FR GEÇMİŞİ (son 24s)
    </span>
    <span id="bsp-chart-arrow" style="
      font-size:10px; color:var(--text-secondary);
      display:inline-block;
      transform: ${_chartOpen ? 'rotate(0deg)' : 'rotate(-90deg)'};
      transition: transform 0.22s ease;
    ">▼</span>
  </div>
  <div id="bsp-chart-section" style="
    overflow:hidden;
    max-height:${_chartOpen ? '200px' : '0'};
    transition: max-height 0.28s ease;
    border-bottom:0.5px solid var(--border-primary);
  ">
    <div class="bsp-chart-container">
      <canvas id="bsp-mini-chart"></canvas>
    </div>
  </div>`;
```

---

### C. Event delegation — titlebar tıklaması

`init()` içindeki `container.addEventListener('click', ...)` bloğuna şu `if` dalı eklenmeli (diğer `if` dallarıyla aynı seviyede):

```js
// Chart titlebar toggle
if (e.target.closest('#bsp-chart-titlebar')) {
  _chartOpen = !_chartOpen;
  const section = document.getElementById('bsp-chart-section');
  const arrow   = document.getElementById('bsp-chart-arrow');
  if (section) section.style.maxHeight = _chartOpen ? '200px' : '0';
  if (arrow)   arrow.style.transform   = _chartOpen ? 'rotate(0deg)' : 'rotate(-90deg)';
  return; // render() çağırma — sadece DOM güncelle
}
```

> **Önemli:** Bu toggle `render()` çağırmamalı. Sadece `max-height` ve `transform` değiştirilmeli, böylece grafik yeniden oluşturulmaz.

---

### D. Grafik veri kaynağı — `frTrackerInstance` yerine sinyal listesi

Mevcut kod (`render()` sonunda, satır ~416):
```js
const tracker = window.frTrackerInstance;
const history = tracker ? tracker.getHistory(_selectedSymbol + 'USDT') : [];
const filteredHistory = history.filter(h => (Date.now() - h.timestamp) <= maxAge);

const labels    = filteredHistory.map(h => new Date(h.timestamp).toLocaleTimeString(...));
const frValues  = filteredHistory.map(h => h.value * 100);

const signalPoints = frValues.map((val, idx) => {
  const entry = filteredHistory[idx];
  const hasSig = allSignals.some(s => Math.abs(s.timestamp - entry.timestamp) < 90000 ...);
  return hasSig ? val : null;
});
```

Yeni kod — **`frTrackerInstance` bağımlılığı tamamen kalkıyor**, grafik doğrudan `allSignals` listesinden besleniyor:

```js
// Seçili coin'e ait sinyalleri zaman sırasına göre sırala (eskiden yenie)
const chartSignals = allSignals
  .filter(s => s.symbol.replace(/USDT$/, '') === _selectedSymbol)
  .sort((a, b) => a.timestamp - b.timestamp);

const labels   = chartSignals.map(s =>
  new Date(s.timestamp).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
);
const frValues = chartSignals.map(s => s.currentFR); // zaten % değeri, *100 YOK

// Her veri noktası için nokta tipi ve renk
const ptRadius = chartSignals.map(() => 3);
const ptStyle  = chartSignals.map(() => 'triangle');  // hepsi üçgen — sinyal noktaları
const ptColor  = chartSignals.map(s => {
  const delta = s.startFR - s.currentFR;
  return delta > 0 ? 'var(--signal-color-green)' : 'var(--signal-color-red)';
});
const ptRotation = chartSignals.map(s => {
  const delta = s.startFR - s.currentFR;
  return delta > 0 ? 0 : 180;   // yeşil yukarı, kırmızı aşağı
});
```

Chart.js dataset kısmı şöyle güncellenecek:

```js
_chartInstance = new Chart(ctx, {
  type: 'line',
  data: {
    labels,
    datasets: [{
      data: frValues,
      borderColor: '#f0b90b',     // Binance sarısı — hardcoded çünkü Chart.js CSS var okuyamaz
      borderWidth: 1.5,
      pointBackgroundColor: ptColor,
      pointBorderColor: ptColor,
      pointRadius: ptRadius,
      pointStyle: ptStyle,
      rotation: ptRotation,
      tension: 0.2,
      fill: false,
    }]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        mode: 'index',
        intersect: false,
        callbacks: {
          label: ctx => ' ' + ctx.parsed.y.toFixed(4) + '%'
        }
      }
    },
    scales: {
      x: {
        grid: { color: gridColor },
        ticks: { color: textColor, font: { size: 9 }, maxTicksLimit: 6 }
      },
      y: {
        grid: { color: gridColor },
        ticks: {
          color: textColor,
          font: { size: 9 },
          callback: v => v.toFixed(4) + '%'
        }
      }
    }
  }
});
```

> **Not:** `bar` ve `scatter` dataset'leri kaldırılıyor. Tek `line` dataset yeterli — sinyal noktaları zaten üçgen `pointStyle` ile çizgi üzerinde gösteriliyor.

---

### E. `bsp-chart-container` CSS yüksekliği

Mevcut stil (satır ~183):
```css
.bsp-chart-container {
  height: 120px;
  ...
}
```

Yeni değer:
```css
.bsp-chart-container {
  height: 160px;   /* Binance stiline yakın, biraz daha yüksek */
  padding: 8px 10px;
  background: var(--bg-primary);
  position: relative;
}
```

---

## Değişmeyecek Şeyler

- `hasChart` koşulu: hâlâ `_coinFilter === 'selected' && _selectedSymbol` — grafik sadece seçili coin modunda gösteriliyor.
- `chartSignals.length === 0` ise `hasChart = false` olarak kalmalı (grafik bölümü hiç render edilmez).
- `_chartInstance.destroy()` çağrısı `render()` başında zaten var, korunmalı.
- `allSignals` değişkeni zaten `render()` içinde tanımlı, tekrar tanımlanmasına gerek yok.
- `gridColor` ve `textColor` `getComputedStyle` ile okunuyor, bu da korunacak.

---

## Özet: Hangi Satırlar Değişiyor

| Bölüm | Mevcut | Yeni |
|---|---|---|
| State | yok | `let _chartOpen = true` eklenir |
| Titlebar HTML | düz `<div>` başlık | tıklanabilir titlebar + ok + animasyonlu `max-height` wrapper |
| Toggle click handler | yok | `#bsp-chart-titlebar` için `if` dalı `init()` delegate'e eklenir |
| Grafik verisi | `frTrackerInstance.getHistory()` | `allSignals` filtresi (frTrackerInstance kaldırılır) |
| Dataset yapısı | line + bar + scatter (3 adet) | sadece line (1 adet), üçgen pointStyle ile |
| Chart yüksekliği | 120px | 160px |
| FR değeri çarpanı | `h.value * 100` | `s.currentFR` (zaten % cinsinden, çarpma yok) |
