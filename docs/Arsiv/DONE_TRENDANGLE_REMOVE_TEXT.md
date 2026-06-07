# RAPOR: FIX_TRENDANGLE_REMOVE_TEXT.md Uygulandı

**Tarih:** 2026-05-17

---

## Sorun

`trendangle` (Trend Angle) aracının, sadece açı gösteren bir çizgi aracı olmasına rağmen hem küçük hızlı ayar çubuğunda (flyout toolbar) hem de detaylı ayar penceresinde (Settings Dialog) "Yazı/Text" seçeneklerini göstermesi. Trend Angle aracında manuel bir metin (text) girme özelliği bulunmamasına rağmen text rengi ve Text sekmesi hatalı bir şekilde aktif görünüyordu.

---

## Yapılan Değişiklikler

Trend Angle aracının, text (metin) özelliğine sahip **olmayan** araçlar listesine eklenmesi sağlandı.

### 1. Flyout Toolbar'dan Text Renginin Gizlenmesi
**Dosya:** `js/drawing/ui/property-toolbar.js`

`hasText` boolean'ını belirleyen `.includes(_drawing.tool)` kontrol listesinin en sonuna `'trendangle'` eklendi.
Böylece Trend Angle aracı seçildiğinde küçük ayarlarda "Text Color" (T) butonu artık ekrana render edilmeyecek.

```diff
-   const hasText = !['vline', ..., 'pathtool'].includes(_drawing.tool);
+   const hasText = !['vline', ..., 'pathtool', 'trendangle'].includes(_drawing.tool);
```

### 2. Settings Dialog'dan Text Sekmesinin Gizlenmesi
**Dosya:** `js/drawing/ui/drawing-settings-dialog.js`

Çizim araçlarının yeteneklerini (capabilities/caps) belirleyen konfigürasyonda `trendangle` nesnesi içerisine `hasText: false` parametresi eklendi.
Bu sayede detaylı Ayarlar penceresi açıldığında "Text" isimli üst sekme oluşturulmayacak.

```diff
-   trendangle: { priceLabel:true, extend:true, midpoint:false, stats:false, capArrows:false, hasFill:false, coordsMode:'p2' },
+   trendangle: { priceLabel:true, extend:true, midpoint:false, stats:false, capArrows:false, hasFill:false, hasText:false, coordsMode:'p2' },
```

---

## Dokunulmayan Dosyalar/Özellikler

- `drawing-trend.js` dosyasındaki açı hesaplama ve çizdirme özellikleri (derece) tamamen korundu. ✅
- Diğer hiçbir aracın konfigürasyonu değiştirilmedi (örneğin TrendLine aracı hâlâ text içeriyor). ✅

---

## Push Edilecek Dosyalar

```
js/drawing/ui/property-toolbar.js
js/drawing/ui/drawing-settings-dialog.js
```

---

## Test Adımları

1. Sayfayı yenile.
2. **Trend Angle** aracını seç ve çizgi çek.
3. Çizgi seçiliyken açılan Flyout Toolbar'a bak — **Text rengi butonu yok mu?** ✅ (Olmamalı)
4. Ayarlar simgesine tıkla — Açılan pencerede **"Text" sekmesi yok mu?** ✅ (Olmamalı)
5. Çizginin üzerinde açı (örneğin 45°) hesaplanıp gösteriliyor mu? ✅ (Görünmeli)
6. Normal **Trend Line** aracını çizip seç — Flyout'ta ve Settings'te Text özellikleri **hâlâ var mı?** ✅ (Olmalı)
