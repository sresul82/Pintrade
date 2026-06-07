# GÖREV: Cursor Tutarsızlığı + Inline Text Etkileşim Düzeltmesi

## Proje Bağlamı

İki dosyada değişiklik yapılacak:
- `js/drawing/ui/drawing-trend.js`
- `js/drawing/core/drawing-core.js`

Başka hiçbir dosyaya dokunma.

---

## Sorunların Özeti

1. `trendline`, `ray`, `extended` seçiliyken fare çizgi üzerinde `text` (beam) cursor gösteriyor — ama hint alanı dışında da gösteriyor. Olması gereken: sadece hint alanı üzerinde `text`, geri kalan her yerde `pointer` (hand).
2. `infoline` seçiliyken cursor hiç `text` olmuyor — hint alanı üzerinde `text` olmalı.
3. `trendangle` seçiliyken cursor yanlışlıkla `pointer` yerine `text` olabiliyor — `trendangle`'da hint alanı yok, her zaman `pointer`.
4. Inline text editörü sadece hint alanına tıklanınca açılmalı, çizginin herhangi bir yerine tıklanınca değil.
5. Hızlı çift tıklamada hem inline edit hem settings penceresi açılıyor — çift tıklamada sadece settings açılmalı, inline edit açılmamalı.

---

## Çözüm Mimarisi

### Adım A — `drawing-trend.js`: Hint alanı koordinatlarını global'e yaz

`_drawTrendLine` içindeki "Add Text" hint çizim bloğunda, hint'in canvas üzerindeki bounding box'ını `window._trendTextHintAreas` map'ine kaydet.

Bu map: `{ [drawingId]: { cx, cy, hw, hh, angle } }` formatında.
- `cx`, `cy`: hint metninin çizildiği anchor noktası (canvas koordinatı)
- `hw`, `hh`: hint kutusunun yaklaşık yarı-genişlik ve yarı-yükseklik
- `angle`: `drawAngle` (radyan)

### Adım B — `drawing-core.js`: onMouseMove cursor mantığı

Hint alanı hit-test fonksiyonu yaz, cursor kararını buna göre ver.

### Adım C — `drawing-core.js`: onMouseUp — sadece hint alanında inline edit

### Adım D — `drawing-core.js`: double-click koruması

---

## Değişiklik 1 — `drawing-trend.js` — Hint alanını global'e yaz

**Dosya:** `js/drawing/ui/drawing-trend.js`
**Konum:** "Add Text" hint çizim bloğu — satır ~449

**ESKİ KOD:**
```javascript
      // "Add Text" hint — shown when selected but no text yet
      if (selected && !hasText && d.tool !== 'trendangle') {
        ctx.save();
        ctx.font = '12px "JetBrains Mono", sans-serif';
        ctx.fillStyle = '#d1d4dc';
        _drawParallelText(ctx, 'Add Text', 0.35);
        ctx.restore();
      }
```

**YENİ KOD:**
```javascript
      // "Add Text" hint — shown when selected but no text yet
      if (selected && !hasText && d.tool !== 'trendangle') {
        ctx.save();
        ctx.font = '12px "JetBrains Mono", sans-serif';
        ctx.fillStyle = '#d1d4dc';
        _drawParallelText(ctx, 'Add Text', 0.35);
        ctx.restore();

        // Hint alanının canvas koordinatlarını global map'e kaydet (cursor ve hit-test için)
        const textAlignH = s.textAlignH || 'center';
        let hcx, hcy;
        if (textAlignH === 'left')       { hcx = a.x; hcy = a.y; }
        else if (textAlignH === 'right') { hcx = b.x; hcy = b.y; }
        else                             { hcx = (a.x + b.x) / 2; hcy = (a.y + b.y) / 2; }

        if (!window._trendTextHintAreas) window._trendTextHintAreas = {};
        window._trendTextHintAreas[d.id] = { cx: hcx, cy: hcy, hw: 36, hh: 10, angle: drawAngle };
      } else {
        // Hint gösterilmiyorsa kaydı temizle
        if (window._trendTextHintAreas) delete window._trendTextHintAreas[d.id];
      }
```

---

## Değişiklik 2 — `drawing-core.js` — `_isOverTrendTextHint` yardımcı fonksiyonu ekle

**Dosya:** `js/drawing/core/drawing-core.js`
**Konum:** `_openTrendlineTextEditor` fonksiyonunun hemen üstüne (satır ~781)

**EKLENECEK KOD:**
```javascript
  // Farenin "Add Text" hint alanı üzerinde olup olmadığını kontrol eder
  function _isOverTrendTextHint(x, y, drawingId) {
    const area = window._trendTextHintAreas?.[drawingId];
    if (!area) return false;
    // Hint alanı döndürülmüş — fareyi hint'in lokal koordinat sistemine çevir
    const dx = x - area.cx;
    const dy = y - area.cy;
    const cos = Math.cos(-area.angle);
    const sin = Math.sin(-area.angle);
    const lx = dx * cos - dy * sin;
    const ly = dx * sin + dy * cos;
    return Math.abs(lx) <= area.hw && Math.abs(ly) <= area.hh;
  }
```

---

## Değişiklik 3 — `drawing-core.js` — `onMouseMove` cursor mantığını düzelt

**Dosya:** `js/drawing/core/drawing-core.js`
**Satır:** ~657

**ESKİ KOD:**
```javascript
          const isEditable = ['texttool', 'note', 'callout', 'trendline', 'ray', 'extended'].includes(htDrawing?.tool);
            if (isEditable && htDrawing.id === _selectedId) {
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
              pane.cvs.style.cursor = 'text';
            } else {
              pane.cvs.style.cursor = 'pointer';
            }
```

---

## Değişiklik 4 — `drawing-core.js` — `onMouseUp` inline edit sadece hint alanında açılsın

**Dosya:** `js/drawing/core/drawing-core.js`
**Satır:** ~770

**ESKİ KOD:**
```javascript
      // If single click on an already selected trendline -> open trendline inline text editor
      if (!wasDragging && ds.isReClick && ['trendline', 'ray', 'extended', 'infoline'].includes(ds.d.tool)) {
        _openTrendlineTextEditor(ds.d, pane, e);
      }
```

**YENİ KOD:**
```javascript
      // If single click on already selected trendline AND over the "Add Text" hint -> open inline editor
      // Double-click koruması: 300ms sonra aç, bu sürede dblclick gelirse iptal et
      if (!wasDragging && ds.isReClick && ['trendline', 'ray', 'extended', 'infoline'].includes(ds.d.tool)) {
        const cx = e.clientX - pane.cvs.getBoundingClientRect().left;
        const cy = e.clientY - pane.cvs.getBoundingClientRect().top;
        if (_isOverTrendTextHint(cx, cy, ds.d.id)) {
          const capturedD = ds.d;
          const capturedPane = pane;
          const capturedE = e;
          _pendingTextEditTimer = setTimeout(() => {
            _pendingTextEditTimer = null;
            _openTrendlineTextEditor(capturedD, capturedPane, capturedE);
          }, 280);
        }
      }
```

---

## Değişiklik 5 — `drawing-core.js` — `_pendingTextEditTimer` değişkeni ve `onDoubleClick` koruması

**Dosya:** `js/drawing/core/drawing-core.js`
**Konum 1:** Modülün en üstünde diğer `let _...` değişkenlerin yanına

**EKLENECEK SATIR:**
```javascript
  let _pendingTextEditTimer = null;
```

**Konum 2:** `onDoubleClick` fonksiyonu başına (satır ~905)

**ESKİ KOD:**
```javascript
  function onDoubleClick(pane, e) {
    const rect = pane.cvs.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
```

**YENİ KOD:**
```javascript
  function onDoubleClick(pane, e) {
    // Bekleyen inline text editörünü iptal et — double-click'te sadece settings açılır
    if (_pendingTextEditTimer) {
      clearTimeout(_pendingTextEditTimer);
      _pendingTextEditTimer = null;
    }

    const rect = pane.cvs.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
```

---

## Özet Tablo

| # | Dosya | Konum | Değişiklik |
|---|-------|-------|------------|
| 1 | `drawing-trend.js` | ~449 | Hint alanı koordinatları `window._trendTextHintAreas`'a yazılıyor |
| 2 | `drawing-core.js` | ~781 | `_isOverTrendTextHint()` yardımcı fonksiyonu eklendi |
| 3 | `drawing-core.js` | ~657 | Cursor: sadece hint üzerinde `text`, aksi halde `pointer` |
| 4 | `drawing-core.js` | ~770 | Inline edit sadece hint alanına tıklanınca ve 280ms gecikmeyle açılıyor |
| 5 | `drawing-core.js` | ~905 | Double-click bekleyen timer'ı iptal ediyor, sadece settings açılıyor |

---

## Kesinlikle Yapılmayacaklar

- `_openTrendlineTextEditor` fonksiyonuna **dokunma**
- `texttool`, `note`, `callout` araçlarının cursor davranışına **dokunma**
- `trendangle` aracına inline text ile ilgili hiçbir şey **ekleme**
- Başka hiçbir mouse event handler'ına **dokunma**

---

## Test Adımları

1. **TrendLine** çiz → seç → çizgi üzerinde fareyi gezdir → `pointer` (hand) görünmeli ✅
2. **TrendLine** seçili → "Add Text" hint alanı üzerine gel → cursor `beam` olmalı ✅
3. **TrendLine** seçili → hint alanına tıkla → inline editor açılmalı ✅
4. **TrendLine** seçili → hint dışına tıkla → inline editor açılmamalı ❌
5. **TrendLine** seçili → hint alanına hızlı çift tıkla → sadece settings açılmalı, inline editor açılmamalı ✅
6. **InfoLine** için 1-5 adımlarının aynısını test et ✅
7. **TrendAngle** çiz → seç → çizgi üzerinde fareyi gezdir → her yerde `pointer` görünmeli, `beam` görünmemeli ✅
8. **TrendAngle** seçili → tıkla → inline editor açılmamalı ❌
