# GÖREV: Phantom Seri Zoom'dan Hariç Tut — Zaman Cetveli Çift Tık Sorunu

## Proje Bağlamı

PinTrade V2.4. `js/chart/chart-phantom.js` dosyasında bir düzeltme yapılacak.
Başka hiçbir dosyaya dokunma.

---

## Sorunun Tam Nedeni

`chart-phantom.js` içinde phantom seri oluşturulurken 500 bar gelecek verisi ekleniyor.
Lightweight Charts'ta zaman cetveline çift tıklandığında kütüphane
**tüm serilerin tüm verilerini** ekrana sığdırmaya çalışıyor (fit content).
Phantom serinin 500 bar geleceği de bu hesaba dahil ediliyor.
Sonuç: chart çok fazla zoom out yapıyor, gerçek mumlar küçülüp kayboluyor.

**Çözüm:** Phantom seriye `autoscaleInfoProvider` ekle.
Bu fonksiyon `null` döndürünce Lightweight Charts o seriyi
fit content / zoom hesabına **dahil etmez**.

---

## Yapılacak Tek Değişiklik

**Dosya:** `js/chart/chart-phantom.js`

`init()` fonksiyonu içinde `pane.chart.addLineSeries({...})` çağrısını bul.
Mevcut seçeneklere **sadece bir satır ekle:**

### ESKİ:
```javascript
pane._phantomSeries = pane.chart.addLineSeries({
  color:       'rgba(0,0,0,0)',
  lineWidth:   1,
  priceScaleId: 'phantom_scale',
  lastValueVisible: false,
  priceLineVisible: false,
  crosshairMarkerVisible: false,
});
```

### YENİ:
```javascript
pane._phantomSeries = pane.chart.addLineSeries({
  color:       'rgba(0,0,0,0)',
  lineWidth:   1,
  priceScaleId: 'phantom_scale',
  lastValueVisible: false,
  priceLineVisible: false,
  crosshairMarkerVisible: false,
  autoscaleInfoProvider: () => null, // [FIX] Zoom/fit content hesabından hariç tut
});
```

---

## Özet

| Dosya | Metod | Değişiklik |
|-------|-------|------------|
| `js/chart/chart-phantom.js` | `init()` | `addLineSeries` çağrısına `autoscaleInfoProvider: () => null` eklendi |

---

## Kesinlikle Yapılmayacaklar

- `chart-pane.js`'e **dokunma**
- `chart-data.js`'e **dokunma**
- `_updatePhantom()` fonksiyonuna **dokunma**
- `PHANTOM_BARS` sayısını **değiştirme**
- Başka hiçbir dosyaya **dokunma**

---

## Test Adımları

1. Sayfayı yenile, mumlar yüklensin
2. Zaman cetveline çift tıkla — mumlar kaybolmadan ekrana sığıyor mu?
3. Fiyat cetveline çift tıkla — mumlar korunuyor mu?
4. Chart'ı sola sürükle — mumlar korunuyor mu?
5. Son mumun ötesine trend çizgisi çiz — görünüyor mu?
6. Console'da `[ChartPhantom]` hatası var mı?
