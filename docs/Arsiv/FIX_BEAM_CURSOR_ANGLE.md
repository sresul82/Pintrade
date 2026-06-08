# GÖREV: Inline Text Hint Üzerinde Açıya Göre Dönen Beam Cursor

## Proje Bağlamı

Tek dosyada değişiklik yapılacak:
- `js/drawing/core/drawing-core.js`

Başka hiçbir dosyaya dokunma.

---

## Sorunun Tam Nedeni

Şu an hint alanı üzerine gelindiğinde `cursor: text` (düz beam) gösteriliyor.
Ama hint çizginin açısına göre döndürülmüş çiziliyor — cursor da aynı açıda olmalı.
CSS `cursor: text` özelliği açı desteklemez, bu yüzden SVG data URL ile dinamik cursor üretilecek.

---

## Değişiklik 1 — `drawing-core.js` — Döndürülmüş SVG beam cursor üret

**Dosya:** `js/drawing/core/drawing-core.js`
**Konum:** `_isOverTrendTextHint` fonksiyonunun hemen altına ekle (satır ~785)

**EKLENECEK FONKSİYON:**
```javascript
  // Hint açısına göre döndürülmüş SVG beam cursor üretir
  function _makeBeamCursor(angleRad) {
    const deg = Math.round(angleRad * 180 / Math.PI);
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'>
      <g transform='rotate(${deg}, 12, 12)'>
        <line x1='12' y1='2' x2='12' y2='22' stroke='white' stroke-width='1.5'/>
        <line x1='8'  y1='2' x2='16' y2='2'  stroke='white' stroke-width='1.5'/>
        <line x1='8'  y1='22' x2='16' y2='22' stroke='white' stroke-width='1.5'/>
        <line x1='12' y1='2' x2='12' y2='22' stroke='black' stroke-width='0.5' stroke-dasharray='1,2'/>
      </g>
    </svg>`;
    const encoded = `url("data:image/svg+xml,${encodeURIComponent(svg)}") 12 12, text`;
    return encoded;
  }
```

---

## Değişiklik 2 — `drawing-core.js` — `onMouseMove` cursor atamasını güncelle

**Dosya:** `js/drawing/core/drawing-core.js`
**Satır:** ~658

**ESKİ KOD:**
```javascript
          const hintTools = ['trendline', 'ray', 'extended', 'infoline'];
            const isSelected = htDrawing?.id === _selectedId;
            const isOverHint = isSelected && hintTools.includes(htDrawing?.tool)
              && _isOverTrendTextHint(x, y, htDrawing?.id);
            if (['texttool', 'note', 'callout'].includes(htDrawing?.tool) && isSelected) {
              pane.cvs.style.cursor = 'text';
            } else if (isOverHint) {
              pane.cvs.style.cursor = 'text';
            } else {
              pane.cvs.style.cursor = 'pointer';
            }
```

**YENİ KOD:**
```javascript
          const hintTools = ['trendline', 'ray', 'extended', 'infoline'];
            const isSelected = htDrawing?.id === _selectedId;
            const isOverHint = isSelected && hintTools.includes(htDrawing?.tool)
              && _isOverTrendTextHint(x, y, htDrawing?.id);
            if (['texttool', 'note', 'callout'].includes(htDrawing?.tool) && isSelected) {
              pane.cvs.style.cursor = 'text';
            } else if (isOverHint) {
              const hintAngle = window._trendTextHintAreas?.[htDrawing.id]?.angle ?? 0;
              pane.cvs.style.cursor = _makeBeamCursor(hintAngle);
            } else {
              pane.cvs.style.cursor = 'pointer';
            }
```

---

## Özet Tablo

| # | Dosya | Konum | Değişiklik |
|---|-------|-------|------------|
| 1 | `drawing-core.js` | ~785 | `_makeBeamCursor(angleRad)` fonksiyonu eklendi |
| 2 | `drawing-core.js` | ~658 | Hint üzerinde açıya göre döndürülmüş SVG cursor atanıyor |

---

## Kesinlikle Yapılmayacaklar

- `_isOverTrendTextHint` fonksiyonuna **dokunma**
- `texttool`, `note`, `callout` cursor davranışına **dokunma**
- `drawing-trend.js` dosyasına **dokunma**

---

## Test Adımları

1. **TrendLine** çiz → seç → "Add Text" hint alanı üzerine gel → beam cursor çizginin açısında görünmeli ✅
2. Yatay çizgide cursor düz `|` şeklinde görünmeli ✅
3. 45 derece çizgide cursor 45 derece dönmüş görünmeli ✅
4. Hint dışına çık → cursor `pointer` (hand) olmalı ✅
5. **TrendAngle** seçili → hint yok → cursor hiçbir zaman beam olmamalı ✅
