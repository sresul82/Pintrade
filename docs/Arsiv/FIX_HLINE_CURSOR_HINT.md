# GÖREV: HLine — Cursor ve Hint Alanı Düzeltmesi

## Proje Bağlamı

İki dosyada değişiklik yapılacak:
- `js/drawing/core/drawing-core.js`
- `js/drawing/ui/drawing-trend.js`

Başka hiçbir dosyaya dokunma.

---

## Sorunların Tam Nedeni

**Sorun 1 — Cursor:**
`hline` hit-test her yerde `'line'` döndürüyor.
Cursor kodu `ht === 'line'` + `htDrawing.tool === 'hline'` ise `ns-resize` gösteriyor.
Bu yüzden çizginin her yerine gelindiğinde `ns-resize` görünüyor.
Olması gereken: sadece **middle point** üzerinde `ns-resize`, geri kalan her yerde `pointer`.

**Sorun 2 — Hint alanı ile çizgi arası boşluk:**
`drawing-trend.js`'de hint `y - 5`'e çiziliyor ama hit alanı `cy: y - 11`'de kaydediliyor.
Bu yüzden cursor `beam` olmadan önce fazla yukarı çıkmak gerekiyor.
`cy` değeri hint'in gerçek pozisyonuyla eşleşmeli: `y - 5`.

---

## Değişiklik 1 — `drawing-core.js` — HLine hit-test'e midpoint desteği ekle

**Dosya:** `js/drawing/core/drawing-core.js`
**Satır:** ~2142

**ESKİ KOD:**
```javascript
    if (d.tool === 'hline' || d.tool === 'crossline' || d.tool === 'hray') {
      if (d.price != null && isFinite(d.price)) {
        const ly = pane.series.priceToCoordinate(d.price);
        if (ly != null && isFinite(ly) && Math.abs(y - ly) <= tolerance) {
          if (d.tool === 'hray') {
            if (d.time != null) {
              const lx = _timeToX(pane, d.time);
              if (lx != null && isFinite(lx) && x >= lx - tolerance) return 'line';
            }
          } else {
            return 'line';
          }
        }
      }
    }
```

**YENİ KOD:**
```javascript
    if (d.tool === 'hline' || d.tool === 'crossline' || d.tool === 'hray') {
      if (d.price != null && isFinite(d.price)) {
        const ly = pane.series.priceToCoordinate(d.price);
        if (ly != null && isFinite(ly) && Math.abs(y - ly) <= tolerance) {
          if (d.tool === 'hray') {
            if (d.time != null) {
              const lx = _timeToX(pane, d.time);
              if (lx != null && isFinite(lx) && x >= lx - tolerance) return 'line';
            }
          } else if (d.tool === 'hline') {
            // Middle point: çizginin yatay ortası
            const cvsW = pane.drawingCanvas.width / (window.devicePixelRatio || 1);
            if (Math.abs(x - cvsW / 2) <= tolerance * 2) return 'midpoint';
            return 'line';
          } else {
            return 'line';
          }
        }
      }
    }
```

---

## Değişiklik 2 — `drawing-core.js` — Cursor: midpoint → ns-resize, line → pointer

**Dosya:** `js/drawing/core/drawing-core.js`
**Satır:** ~684

**ESKİ KOD:**
```javascript
            } else if (htDrawing?.tool === 'hline') {
              pane.cvs.style.cursor = 'ns-resize';
            } else {
              pane.cvs.style.cursor = 'pointer';
            }
```

**YENİ KOD:**
```javascript
            } else if (htDrawing?.tool === 'hline' && ht === 'midpoint') {
              pane.cvs.style.cursor = 'ns-resize';
            } else {
              pane.cvs.style.cursor = 'pointer';
            }
```

---

## Değişiklik 3 — `drawing-trend.js` — Hint alanı cy değerini düzelt

**Dosya:** `js/drawing/ui/drawing-trend.js`
**Satır:** ~145

**ESKİ KOD:**
```javascript
          window._trendTextHintAreas[d.id] = { cx: w / 2, cy: y - 11, hw: hintTextW / 2 + 6, hh: 10, angle: 0 };
```

**YENİ KOD:**
```javascript
          window._trendTextHintAreas[d.id] = { cx: w / 2, cy: y - 5, hw: hintTextW / 2 + 6, hh: 10, angle: 0 };
```

---

## Özet Tablo

| # | Dosya | Satır | Değişiklik |
|---|-------|-------|------------|
| 1 | `drawing-core.js` | ~2142 | `hline` hit-test'e `midpoint` desteği eklendi |
| 2 | `drawing-core.js` | ~684 | Cursor: sadece `midpoint`'te `ns-resize`, `line`'da `pointer` |
| 3 | `drawing-trend.js` | ~145 | Hint alanı `cy` değeri `y - 5`'e düzeltildi |

---

## Kesinlikle Yapılmayacaklar

- `hray`, `crossline`, `vline` hit-test bloklarına **dokunma**
- `trendline`, `ray`, `extended` cursor davranışına **dokunma**
- `_openTrendlineTextEditor` fonksiyonuna **dokunma**

---

## Test Adımları

1. **HLine** çiz → çizgi üzerinde fareyi gezdир → `pointer` (hand) görünmeli ✅
2. **HLine** seçili → middle point üzerine gel → `ns-resize` (↕) görünmeli ✅
3. **HLine** seçili → "Add Text" hint üzerine gel → `beam` görünmeli ✅
4. Hint ile çizgi arası boşluk TrendLine ile aynı olmalı ✅
5. **TrendLine** — hiçbir şey değişmemiş olmalı ✅
