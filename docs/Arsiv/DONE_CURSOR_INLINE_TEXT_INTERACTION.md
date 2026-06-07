# RAPOR: FIX_CURSOR_INLINE_TEXT_INTERACTION.md Uygulandı

**Tarih:** 2026-05-18

---

## Sorunlar

1. `trendline`, `ray`, `extended` seçiliyken fare çizgi üzerinde her yerde `text` (beam) cursor görünüyordu — sadece hint alanında olmalıydı.
2. `infoline` seçiliyken cursor hiç `text` olmuyordu — hint alanında `text` olmalıydı.
3. `trendangle` seçiliyken yanlışlıkla `text` cursor gösterebiliyordu.
4. Inline text editörü çizginin herhangi bir yerine tıklanınca açılıyordu — sadece hint alanına tıklanınca açılmalıydı.
5. Hızlı çift tıklamada hem inline edit hem settings penceresi açılıyordu.

---

## Yapılan Değişiklikler

### Değişiklik 1 — `drawing-trend.js` (~454)
"Add Text" hint bloğuna, hint bounding-box koordinatlarının (`cx`, `cy`, `hw`, `hh`, `angle`) `window._trendTextHintAreas[d.id]` global map'ine kaydedilmesi eklendi. Hint gösterilmediğinde kayıt siliniyor.

### Değişiklik 2 — `drawing-core.js` (~781)
`_isOverTrendTextHint(x, y, drawingId)` yardımcı fonksiyonu eklendi. Fare konumunu döndürülmüş hint koordinat sistemine çevirerek hit-test yapıyor.

### Değişiklik 3 — `drawing-core.js` (~656)
onMouseMove cursor mantığı güncellendi:
- `texttool`, `note`, `callout` → seçiliyken her zaman `text`
- `trendline`, `ray`, `extended`, `infoline` → sadece hint alanı üzerindeyken `text`, diğer her yerde `pointer`
- `trendangle` → artık hiçbir zaman `text` değil (hint alanı yok)

### Değişiklik 4 — `drawing-core.js` (~770)
onMouseUp içinde inline edit, artık sadece hint alanına tıklandığında ve 280ms gecikmeli açılıyor (dblclick koruması için).

### Değişiklik 5 — `drawing-core.js` (~26 ve ~905)
- `let _pendingTextEditTimer = null;` değişkeni eklendi.
- `onDoubleClick` başına, bekleyen timer'ı iptal eden guard eklendi — çift tıklamada sadece settings açılıyor.

---

## Değiştirilen Dosyalar

1. `js/drawing/tools/drawing-trend.js`
2. `js/drawing/core/drawing-core.js`

---

## Test Adımları

1. **TrendLine** çiz → seç → çizgi üzerinde fareyi gezdirirken `pointer` (hand) görünmeli ✅
2. **TrendLine** seçili → "Add Text" hint alanı üzerine gel → cursor `beam` olmalı ✅
3. **TrendLine** seçili → hint alanına tıkla → inline editor açılmalı ✅
4. **TrendLine** seçili → hint dışına tıkla → inline editor açılmamalı ❌
5. **TrendLine** seçili → hint alanına hızlı çift tıkla → sadece settings açılmalı ✅
6. **InfoLine** için 1-5 adımlarını test et ✅
7. **TrendAngle** çiz → seç → her yerde `pointer` görünmeli, `beam` görünmemeli ✅
