# RAPOR: FIX_PHANTOM_OVERLAY.md Uygulandı

**Tarih:** 2026-05-17

---

## Sorun

Phantom seri `priceScaleId: 'phantom_scale'` ile oluşturuluyordu.
Lightweight Charts'ta özel `priceScaleId`'li her seri fiyat eksenini
bir ölçüde etkiliyor — `autoscaleInfoProvider: () => null` bunu
tam olarak engelleyemiyordu.

Çift tıklama → `fitContent()` → phantom'ın 500 bar geleceği ve
fiyat değerleri hesaba katılıyor → fiyat ekseni bozuluyor → mumlar
görünür alandan çıkıyor ve kayboluyor.

---

## Yapılan Değişiklik

**Dosya:** `js/chart/chart-phantom.js`  
**Fonksiyon:** `init()`

### Diff:

```diff
  pane._phantomSeries = pane.chart.addLineSeries({
-   color:       'rgba(0,0,0,0)',
-   lineWidth:   1,
-   priceScaleId: 'phantom_scale',
-   lastValueVisible: false,
-   priceLineVisible: false,
-   crosshairMarkerVisible: false,
-   autoscaleInfoProvider: () => null,
- });
-
- // Phantom scale'i gizle
- pane.chart.priceScale('phantom_scale').applyOptions({
-   visible:       false,
-   scaleMargins:  { top: 0, bottom: 0 },
-   borderVisible: false,
+ color:                  'rgba(0,0,0,0)', // Tamamen şeffaf — kullanıcı görmez
+ lineWidth:              1,
+ overlay:                true,            // [FIX] Fiyat eksenine bağlanmaz, zoom/fit hesabına girmez
+ scaleMargins:           { top: 0, bottom: 0 },
+ lastValueVisible:       false,
+ priceLineVisible:       false,
+ crosshairMarkerVisible: false,
  });
```

### Silinen Blok:
```javascript
// Phantom scale'i gizle
pane.chart.priceScale('phantom_scale').applyOptions({
  visible:       false,
  scaleMargins:  { top: 0, bottom: 0 },
  borderVisible: false,
});
```
`overlay: true` kullanıldığında bu bloğa gerek kalmadığından tamamen kaldırıldı.

---

## Neden `overlay: true` Daha İyi

| Özellik | `priceScaleId: 'phantom_scale'` | `overlay: true` |
|---------|--------------------------------|-----------------|
| Fiyat eksenine etkisi | Var (gizlenmiş de olsa) | **Yok** |
| Zoom/fitContent hesabına giriyor mu | Kısmen | **Hayır** |
| Ek `applyOptions` gerekiyor mu | Evet | **Hayır** |
| Kullanıcı tarafından görülüyor mu | Hayır (şeffaf) | **Hayır** |

---

## Dokunulmayan Kısımlar

- `chart-pane.js` ✅
- `chart-data.js` ✅
- `_updatePhantom()` fonksiyonu ✅
- `destroy()` fonksiyonu ✅
- `PHANTOM_BARS` sayısı ✅
- `init()` içindeki `destroy(pane)` çağrısı ✅

---

## Push Edilecek Dosya

```
js/chart/chart-phantom.js
```

---

## Test Adımları

1. Sayfayı yenile, mumlar yüklensin
2. Zaman cetveline çift tıkla — mumlar ekranda kalıyor mu? ✅
3. Fiyat cetvelini fare ile yukarı/aşağı çek — yatay grid bozuluyor mu? ❌ (bozulmamalı)
4. Chart'ı sola kaydır — mumlar korunuyor mu? ✅
5. Son mumun ötesine trend çizgisi çiz — görünüyor mu? ✅
6. Console'da `[ChartPhantom]` hatası var mı? ❌ (olmamalı)
