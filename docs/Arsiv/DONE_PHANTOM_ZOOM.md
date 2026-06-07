# RAPOR: FIX_PHANTOM_ZOOM.md Uygulandı

**Tarih:** 2026-05-17

---

## Sorun

Zaman cetveline çift tıklandığında Lightweight Charts **tüm serilerin** verilerini
ekrana sığdırmaya çalışıyor. Phantom serinin 500 bar geleceği de bu hesaba dahil
edildiğinden chart aşırı zoom out yapıyordu — gerçek mumlar küçülüp kayboluyor.

---

## Yapılan Değişiklik

**Dosya:** `js/chart/chart-phantom.js`  
**Metod:** `init()` → `pane.chart.addLineSeries({...})`  
**Satır:** 53

### Eklenen Satır:
```javascript
autoscaleInfoProvider: () => null, // [FIX] Zoom/fit content hesabından hariç tut
```

### Diff:
```diff
  pane._phantomSeries = pane.chart.addLineSeries({
    color:       'rgba(0,0,0,0)',
    lineWidth:   1,
    priceScaleId: 'phantom_scale',
    lastValueVisible: false,
    priceLineVisible: false,
    crosshairMarkerVisible: false,
+   autoscaleInfoProvider: () => null, // [FIX] Zoom/fit content hesabından hariç tut
  });
```

---

## Nasıl Çalışıyor

`autoscaleInfoProvider: () => null` döndürüldüğünde Lightweight Charts o seriyi
`fitContent()` ve zoom hesabına **dahil etmez**.  
Phantom 500 bar verisi artık ekrana sığdırma hesabını etkilemiyor —
chart çift tıklamada yalnızca gerçek mumları baz alarak zoom ayarı yapıyor.

---

## Dokunulmayan Dosyalar

- `chart-pane.js` ✅
- `chart-data.js` ✅
- `_updatePhantom()` fonksiyonu ✅
- `PHANTOM_BARS` sayısı ✅

---

## Push Edilecek Dosya

```
js/chart/chart-phantom.js
```

---

## Test Adımları

1. Sayfayı yenile, mumlar yüklensin
2. Zaman cetveline çift tıkla — mumlar kaybolmadan ekrana sığıyor mu? ✅
3. Fiyat cetveline çift tıkla — mumlar korunuyor mu? ✅
4. Chart'ı sola sürükle — mumlar korunuyor mu? ✅
5. Son mumun ötesine trend çizgisi çiz — görünüyor mu? ✅
6. Console'da `[ChartPhantom]` hatası var mı? ❌ (olmamalı)
