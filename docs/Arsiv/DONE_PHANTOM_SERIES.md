# RAPOR: ADD_PHANTOM_SERIES.md Uygulandı

**Tarih:** 2026-05-17

---

## Sorun

Lightweight Charts'ta zaman ekseni yalnızca mum verisi olan aralıkta görünüyor.
Son mumun ötesine çizim aracı sürüklendiğinde çizim kayboluyor veya hiç görünmüyor.

---

## Çözüm

Chart'a **görünmez (phantom) bir LineSeries** eklendi.
Bu seri son mumdan itibaren 500 zaman noktasını kapsıyor,
`rgba(0,0,0,0)` rengi ve ayrı `phantom_scale` ekseni sayesinde
kullanıcı tarafından görülmüyor. Sadece zaman eksenini sağa uzatıyor.

---

## Yapılan Değişiklikler

### ADIM 1 — Yeni dosya oluşturuldu

**Dosya:** `js/chart/chart-phantom.js` (**YENİ**)

İçerik:
- `ChartPhantom.init(pane)` — Phantom seriyi oluşturur, `phantom_scale` gizlenir
- `ChartPhantom.update(pane)` — `candlesData` güncellendikçe phantom'ı yeniler
- `ChartPhantom.destroy(pane)` — Pane kapatılırken temizler

```javascript
pane._phantomSeries = pane.chart.addLineSeries({
  color:        'rgba(0,0,0,0)',  // Tamamen şeffaf
  priceScaleId: 'phantom_scale', // Fiyat eksenini etkilemez
  lastValueVisible: false,
  priceLineVisible: false,
  crosshairMarkerVisible: false,
});
// 500 bar gelecek verisi → son mum time + barSec * i
```

---

### ADIM 2 — `index.html`'e script tag eklendi

**Satır:** 769 (chart-pane.js'den hemen önce)

```html
<!-- [ChartPhantom] Invisible phantom series that extends the time axis 500 bars
     to the right of the last candle. Enables drawing tools to work and remain
     visible beyond the last real bar. Must load before chart-pane.js. -->
<script src="js/chart/chart-phantom.js"></script>
```

---

### ADIM 3 — `chart-pane.js`'e 3 çağrı eklendi

**3a) `_onFeedCandles()` — `this.candlesData = deduped` satırından sonra:**
```javascript
// [ChartPhantom] After candle data is set, update the invisible phantom series
// so the time axis extends 500 bars into the future. This allows drawing tools
// to work beyond the last real candle without disappearing.
if (window.ChartPhantom) ChartPhantom.update(this);
```

**3b) `_buildSeries()` — metodun en sonuna:**
```javascript
// [ChartPhantom] Initialize the invisible phantom series that extends the time
// axis to the right. Called every time the series is rebuilt (chart type change,
// symbol change, TF change) so the extension is always in sync.
if (window.ChartPhantom) ChartPhantom.init(this);
```

**3c) `destroy()` — `this.chart.remove()` satırından önce:**
```javascript
// [ChartPhantom] Clean up the phantom series before destroying the chart pane
// to avoid memory leaks and stale series references.
if (window.ChartPhantom) ChartPhantom.destroy(this);
```

---

## Push Edilecek Dosyalar

| Dosya | Durum |
|-------|-------|
| `js/chart/chart-phantom.js` | **YENİ** |
| `index.html` | Değiştirildi (1 script tag eklendi) |
| `js/chart/chart-pane.js` | Değiştirildi (3 satır eklendi) |

---

## Kesinlikle Dokunulmadı

- `chart-data.js` ✅
- `candlesData` dizisi ✅
- Ana `this.series` ✅
- `screener-core.js` ✅
- `_buildSeries()` mevcut kodu ✅ (sadece en sona eklendi)

---

## Test Adımları

1. Sayfayı yenile
2. Chart yüklendi — sağ tarafa zaman ekseni uzuyor mu?
3. Son mumun ötesine bir trend çizgisi çiz — görünüyor mu?
4. O çizgiyi sola/sağa sürükle — kayboluyor mu?
5. Bybit chart'ta da aynı testi yap — çalışıyor mu?
6. Console'da `[ChartPhantom]` hatası var mı?
7. Fiyat skalası bozuldu mu? (Phantom fiyatı göstermemeli)
