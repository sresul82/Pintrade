# RAPOR: FIX_CROSSLINE_DRAG.md Uygulandı

**Tarih:** 2026-05-18

---

## Sorun ve Çözüm

### 1. CrossLine Drag Desteği (`drawing-core.js`)
*   **Sorun:** Kesişen Çizgi (`crossline`) sürüklenmek istendiğinde dikey/yatay taşıma işlemlerine hiçbir koşula uymadığı için `else` bloğuna düşüyor ve `p1` nesnesi olmadığı için de hareket etmiyordu.
*   **Çözüm:** Sürükleme (drag) işleyicisine `crossline` koşulu eklendi. Çizimin ilk tıklama koordinatları (`origPrice` ve `origTime`) ile o anki sürükleme mesafeleri (`dx` ve `dy`) hesaba katılarak hem dikey fiyat konumu (`d.price`) hem de yatay başlangıç zamanı (`d.time`) dinamik olarak güncellendi. Artık grafikte her yöne akıcı şekilde taşınabilmektedir.

---

## Değiştirilen Dosyalar

1. `js/drawing/core/drawing-core.js`

---

## Test Adımları

1. **CrossLine** çiz → Seç ve sürükle → Hem dikey hem de yatay olarak serbestçe taşınabilmeli ✅
2. **HLine** çiz → Sürükle → Sadece dikey olarak hareket etmeli ✅
3. **VLine** çiz → Sürükle → Sadece yatay olarak hareket etmeli ✅
4. **HRay** çiz → Sürükle → Hem dikey hem de yatay olarak serbestçe taşınabilmeli ✅
