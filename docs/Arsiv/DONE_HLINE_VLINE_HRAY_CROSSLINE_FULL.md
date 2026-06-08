# RAPOR: FIX_HLINE_VLINE_HRAY_CROSSLINE_FULL.md Uygulandı

**Tarih:** 2026-05-18

---

## Sorunlar ve Çözümler

### 1. Robust Çizim Fonksiyonları (`drawing-trend.js`)
*   **Sorun:** `hline`, `vline`, `hray` ve `crossline` araçları render edilirken (özellikle eski geçersiz state verilerinden dolayı veya mouse sürükleme sırasında koordinatların `null`/`undefined`/`NaN` olması durumunda) canvas API üzerinde hata fırlatıp tüm grafiği kilitleyebiliyordu.
*   **Çözüm:** 
    *   `_drawHLine`, `_drawVLine`, `_drawHRay` ve `_drawCrossLine` fonksiyonlarının tamamı yeniden yazıldı.
    *   Her fonksiyona `price == null`, `time == null`, `!isFinite()` gibi kapsamlı sayısal geçerlilik ve `null` koruma koşulları (guard clauses) eklendi.
    *   Fonksiyon gövdeleri `try-catch` blokları ile sarmalanarak olası bir render hatasının diğer çizim araçlarını etkilemesi tamamen engellendi.
    *   Stil çizimleri (`ctx.strokeStyle`, `ctx.lineWidth`, `ctx.setLineDash`) başlamadan önce `ctx.save()`, çizim bittikten sonra `ctx.restore()` çağrılarak canvas context'inin kirletilmesi/bozulması engellendi.

### 2. Hit-Test Korumaları (`drawing-core.js`)
*   **Sorun:** Farenin grafik üzerinde gezmesi veya tıklanması durumunda `priceToCoordinate` veya `_timeToX` hesaplamaları geçersiz nesneler üzerinden yapılabiliyor ve hit-test motorunun kilitlenmesine neden olabiliyordu.
*   **Çözüm:** Hit-test algoritmasında `d.price != null`, `isFinite(d.price)`, `d.time != null`, `isFinite(lx)` gibi koruma blokları eklenerek hatalar engellendi.

### 3. Çizim Oluşturma (Creation) Korumaları (`drawing-core.js`)
*   **Sorun:** Fareyle tıklama anında grafiğin sınırları dışında veya geçersiz koordinatlarda çizim oluşturulmaya çalışılması state'i kirletiyordu.
*   **Çözüm:** Single-click çizim oluşturma bloklarına (`hline`, `vline`, `hray`, `crossline`) `price == null`, `!isFinite(price)`, `time == null` kontrolleri eklenerek geçersiz çizimlerin state'e kaydedilmesi en başından engellendi.

---

## Değiştirilen Dosyalar

1. `js/drawing/tools/drawing-trend.js`
2. `js/drawing/core/drawing-core.js`

---

## Test Adımları

1. Grafikteki tüm çizimlerin F5 sonrasında chart'ı ve çizim motorunu kilitlemeden başarıyla gösterilmesi ✅
2. **HLine** çiz → Renk, kalınlık ve çizgi tipini Ayarlar sekmelerinden başarıyla değiştir ✅
3. **VLine** çiz → Renk, kalınlık ve kesikli çizgi tipinin anında uygulanması ✅
4. **HRay** çiz → Yenileme (F5) sonrasında kaybolmaması, sürükleme davranışının ve silinmesinin hatasız çalışması ✅
5. **CrossLine** çiz → Hem yatay hem de dikey olarak sorunsuz şekilde sürükle ✅
6. Grafik üzerindeki diğer tüm çizim araçlarının (TrendLine vb.) kilitlenmeden çalışmaya devam etmesi ✅
