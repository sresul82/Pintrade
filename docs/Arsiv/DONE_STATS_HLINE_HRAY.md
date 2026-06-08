# RAPOR: FIX_STATS_HLINE_HRAY.md Uygulandı

**Tarih:** 2026-05-18

---

## Sorunlar ve Çözümler

### 1. Stats On/Off Mantığı (`drawing-trend.js`)
*   **Sorun:** `statsOn` özelliği varsayılan olarak kapalı olması gerekirken, çizim yapıldığında doğrudan görünüyordu.
*   **Çözüm:** `_drawTrendStats` içerisindeki `s.statsOn !== true` (yani true değilse gösterilmesin) kontrolü zaten doğru çalışıyordu. `_drawTrendLine` (~478) ve `_drawTrendAngle` (~188) içindeki stats çağrısı koşuluna `statsOn === true` (veya `d.style?.statsOn === true`) eklenerek, varsayılan olarak kapalı kalması sağlandı. Artık kullanıcı ancak Ayarlar kutusundan (Settings Dialog) "Stats on/off" kutusunu işaretlerse istatistikler görüntülenecektir.

### 2. HLine / HRay Stil Uygulanmama Sorunları (`drawing-trend.js`)
*   **Sorun:** HLine (Yatay Çizgi) ve HRay (Yatay Işın) araçlarında kullanıcının flyout menüden veya ayarlardan seçtiği renk (`color`), kalınlık (`width`), çizgi stili (`dash`) ve fiyat etiketi stili (`priceLabel`) uygulanmıyor, sadece varsayılan düz çizgiler çiziliyordu.
*   **Çözüm:**
    *   `_drawHLine` ve `_drawHRay` fonksiyonları güncellenerek çizimin tarz nesnesinden (`d.style`) renk, genişlik ve kesik çizgiler (`dashed`/`dotted`) alındı.
    *   `priceLabel` aktif ise çizgilerin sonuna fiyat etiketini basan `_drawPriceLabel` çağrısı entegre edildi.

### 3. HRay F5 Sonrası Kaybolma Sorunu (`drawing-core.js`)
*   **Sorun:** HRay çizimi yapıldığında `price` ve `time` değerleri kaydediliyor fakat `p1` (koordinat noktası nesnesi) kaydedilmiyordu. Bu da sayfayı yeniledikten sonra hit-test (çizginin üzerine gelindiğinde tanınması) ve geri yükleme (restore) mekanizmalarının çizimi bulamamasına (yani kaybolmasına) yol açıyordu.
*   **Çözüm:** `_activeTool === 'hray'` olan çizim bitirme bloğunda (`_finishDrawing`), çizim verisine `p1: { time, price }` nesnesi eklenerek kaydedilmesi sağlandı. Böylece yenileme sonrasında çizim başarıyla yüklenmekte ve sidebar'dan da silinebilmektedir.

---

## Değiştirilen Dosyalar

1. `js/drawing/tools/drawing-trend.js`
2. `js/drawing/core/drawing-core.js`

---

## Test Adımları

1. **TrendLine** çiz → seç → varsayılan olarak istatistik kutusu görünmemeli ❌
2. **TrendLine** Ayarları (çift tık) → **Stats on/off** aç → İstatistikler ekrana gelmeli ✅
3. **HLine** çiz → Çizgi rengini kırmızı ve stilini kesikli (dashed) yap → Stil anında uygulanmalı ✅
4. **HRay** çiz → Sayfayı yenile (F5) → Çizgi kaybolmamalı, silinebilmeli ✅
5. **InfoLine** çiz → InfoLine'da varsayılan olarak stats'ın açık kalma kuralı bozulmamış olmalı ✅
