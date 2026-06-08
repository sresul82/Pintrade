# RAPOR: FIX_HLINE_HRAY.md Uygulandı

**Tarih:** 2026-05-18

---

## Sorunlar ve Çözümler

### 1. HLine Stil Kaydetme Hatası (`drawing-core.js`)
*   **Sorun:** HLine çizimi yapıldığında stil nesnesi, geçerli olmayan veya boş kalmış olabilecek `_lastDrawingStyle` ile kaydediliyordu. Bu da HLine stil özelliklerinin (renk, kalınlık vb.) çizim anında düzgün yüklenememesine neden oluyordu.
*   **Çözüm:** `_activeTool === 'hline'` bloğunda `_finishDrawing` çağrısı güncellenerek varsayılan araç stilini getiren `_getToolStyle('hline')` fonksiyonu kullanıldı.

### 2. HRay Sürükleme (Drag) Handler Desteği (`drawing-core.js`)
*   **Sorun:** HRay (Yatay Işın) seçilip sürüklendiğinde ne fiyatı (`price`) ne de zamanı (`time`) güncelleniyordu. Ayrıca bu araç taşınırken `p1` alt nesnesinin de senkronize edilmesi gerekiyordu.
*   **Çözüm:** Sürükleme (drag) işleyicisine `hray` koşulu eklendi. Çizimin ilk tıklama koordinatları (`origPrice` ve `origTime`) ile o anki sürükleme mesafeleri (`dx` ve `dy`) hesaba katılarak hem çizginin dikey konumu (`d.price`) hem de yatay başlangıç konumu (`d.time`) güncellendi. Ek olarak, F5 sonrası kaybolmayı önleyen `d.p1` nesnesi de sürüklemeyle paralel olarak senkronize edildi.

---

## Değiştirilen Dosyalar

1. `js/drawing/core/drawing-core.js`

---

## Test Adımları

1. **HLine** çiz → Flyout menüden rengini ve kalınlığını değiştir → Stil başarıyla uygulanmalı ✅
2. **HLine** seç ve dikey olarak sürükle → Doğru şekilde kaymalı ✅
3. **HRay** çiz ve sürükle → Hem yatay (zaman ekseninde başlangıç noktası) hem dikey (fiyat ekseninde seviye) olarak serbestçe taşınabilmeli ✅
4. **HRay** çizdikten sonra diğer araçlar (TrendLine vb.) kilitlenmeden çalışmaya devam etmeli ✅
5. Sidebar üzerindeki "Remove objects" çöp kutusu butonu ile HLine ve HRay başarıyla silinebilmeli ✅
