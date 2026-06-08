# GÖREV: Phantom Seriyi Overlay Moda Al — Fiyat Eksenini Etkileyen Sorun

## Proje Bağlamı

PinTrade V2.4. `js/chart/chart-phantom.js` dosyasında bir düzeltme yapılacak.
Başka hiçbir dosyaya dokunma.

---

## Sorunun Tam Nedeni

Şu an phantom seri `priceScaleId: 'phantom_scale'` ile oluşturuluyor.
Lightweight Charts'ta özel scale ID'si olan her seri fiyat eksenini etkiliyor —
`autoscaleInfoProvider: () => null` bunu tam engelleyemiyor.

Zaman cetveline çift tıklandığında `fitContent()` çalışıyor,
phantom'ın 500 bar geleceği ve fiyat değerleri hesaba katılıyor,
fiyat ekseni bozuluyor, mumlar görünür alandan çıkıyor ve kayboluyor.

**Doğru çözüm:** `priceScaleId` yerine `overlay: true` kullan.
Overlay seriler fiyat eksenine hiç bağlanmaz, zoom/fit hesabına girmez,
kullanıcı tarafından görülmez — sadece zaman eksenini uzatır.

---

## Yapılacak Değişiklik

**Dosya:** `js/chart/chart-phantom.js`
**Fonksiyon:** `init()`

### ESKİ KOD — `addLineSeries` çağrısı ve hemen sonrasındaki `priceScale` bloğu:
```javascript
      pane._phantomSeries = pane.chart.addLineSeries({
        color:       'rgba(0,0,0,0)',   // Tamamen şeffaf
        lineWidth:   1,
        priceScaleId: 'phantom_scale',  // Ayrı scale — fiyat eksenini etkilemez
        lastValueVisible: false,
        priceLineVisible: false,
        crosshairMarkerVisible: false,
        autoscaleInfoProvider: () => null, // [FIX] Zoom/fit content hesabından hariç tut
      });

      // Phantom scale'i gizle
      pane.chart.priceScale('phantom_scale').applyOptions({
        visible:       false,
        scaleMargins:  { top: 0, bottom: 0 },
        borderVisible: false,
      });
```

### YENİ KOD:
```javascript
      pane._phantomSeries = pane.chart.addLineSeries({
        color:                  'rgba(0,0,0,0)', // Tamamen şeffaf — kullanıcı görmez
        lineWidth:              1,
        overlay:                true,            // [FIX] Fiyat eksenine bağlanmaz, zoom/fit hesabına girmez
        scaleMargins:           { top: 0, bottom: 0 },
        lastValueVisible:       false,
        priceLineVisible:       false,
        crosshairMarkerVisible: false,
      });
```

**Not:** `overlay: true` kullanıldığında `priceScaleId` ve ayrı `priceScale().applyOptions()` bloğuna
gerek kalmaz — o blok tamamen siliniyor.

---

## Özet

| Dosya | Değişiklik |
|-------|------------|
| `js/chart/chart-phantom.js` | `priceScaleId: 'phantom_scale'` + `autoscaleInfoProvider` → `overlay: true` ile değiştirildi |
| `js/chart/chart-phantom.js` | `pane.chart.priceScale('phantom_scale').applyOptions(...)` bloğu silindi |

---

## Kesinlikle Yapılmayacaklar

- `chart-pane.js`'e **dokunma**
- `chart-data.js`'e **dokunma**
- `_updatePhantom()` fonksiyonuna **dokunma**
- `destroy()` fonksiyonuna **dokunma**
- `PHANTOM_BARS` sayısını **değiştirme**
- `init()` içindeki `destroy(pane)` çağrısına **dokunma**

---

## Test Adımları

1. Sayfayı yenile, mumlar yüklensin
2. Zaman cetveline çift tıkla — mumlar ekranda kalıyor mu?
3. Fiyat cetvelini fare ile aşağı/yukarı çek — yatay grid çizgileri kayboluyor mu?
4. Chart'ı sola kaydır — mumlar korunuyor mu?
5. Son mumun ötesine trend çizgisi çiz — görünüyor mu?
6. Console'da `[ChartPhantom]` hatası var mı?
