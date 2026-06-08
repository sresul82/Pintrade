# GÖREV: HLine — Inline Text Editör, Cursor, Hint ve Text Render Düzeltmesi

## Proje Bağlamı

Tek dosyada değişiklik yapılacak:
- `js/drawing/core/drawing-core.js`

`drawing-trend.js` ve `drawing-settings-dialog.js` dosyalarına dokunma.
Bu dosyalarda hline için gerekli her şey zaten doğru yazılmış.

---

## Sorunların Tam Nedeni

`_openTrendlineTextEditor` fonksiyonu satır 856-858'de `d.p1` ve `d.p2` kullanıyor:

```javascript
const a = _pt2xy(d.p1, pane);
const b = _pt2xy(d.p2, pane);
if (!a || !b) return;
```

`hline` aracında `p1` ve `p2` **yoktur** — sadece `d.price` vardır.
Bu yüzden `!a || !b` koşulu true olur ve fonksiyon hemen return eder.
Editör hiç açılmaz.

---

## Değişiklik 1 — `drawing-core.js` — `_openTrendlineTextEditor` hline desteği

**Dosya:** `js/drawing/core/drawing-core.js`
**Satır:** ~848

**ESKİ KOD:**
```javascript
  function _openTrendlineTextEditor(d, pane, e) {
    const existing = document.getElementById('trendline-text-editor');
    if (existing) existing.remove();

    const s = d.style || {};
    const canvasRect = (pane.canvasContainer || pane.drawingCanvas || pane.cvs).getBoundingClientRect();

    // Use the internal _pt2xy (not the public utils wrapper)
    const a = _pt2xy(d.p1, pane);
    const b = _pt2xy(d.p2, pane);
    if (!a || !b) return;

    const textAlignH = s.textAlignH || 'center';
    const textAlignV = s.textAlignV || 'top';
    const lineAngle  = Math.atan2(b.y - a.y, b.x - a.x);
    
    // Normalize angle (same as drawing-trend.js)
    let drawAngle = lineAngle;
    let isFlipped = false;
    if (drawAngle > Math.PI / 2 || drawAngle < -Math.PI / 2) {
      drawAngle += Math.PI;
      isFlipped = true;
    }

    // Anchor point on the line (matching drawing-trend.js)
    let anchorX, anchorY;
    if (textAlignH === 'left') {
      anchorX = a.x; anchorY = a.y;
    } else if (textAlignH === 'right') {
      anchorX = b.x; anchorY = b.y;
    } else {
      anchorX = (a.x + b.x) / 2;
      anchorY = (a.y + b.y) / 2;
    }
```

**YENİ KOD:**
```javascript
  function _openTrendlineTextEditor(d, pane, e) {
    const existing = document.getElementById('trendline-text-editor');
    if (existing) existing.remove();

    const s = d.style || {};
    const canvasRect = (pane.canvasContainer || pane.drawingCanvas || pane.cvs).getBoundingClientRect();

    // hline: p1/p2 yok, price ve canvas genişliğinden anchor hesapla
    if (d.tool === 'hline') {
      if (d.price == null || !isFinite(d.price)) return;
      const y = pane.series.priceToCoordinate(d.price);
      if (y == null || !isFinite(y)) return;
      const cvsW = pane.drawingCanvas.width / (window.devicePixelRatio || 1);
      const anchorX = cvsW / 2;
      const anchorY = y;
      const anchorViewX = canvasRect.left + anchorX;
      const anchorViewY = canvasRect.top  + anchorY;
      const fontSize = s.fontSize || 13;

      const ta = document.createElement('textarea');
      ta.id = 'trendline-text-editor';
      ta.value = s.text || '';
      ta.placeholder = 'Add text…';
      ta.rows = 1;

      Object.assign(ta.style, {
        position:        'fixed',
        left:            anchorViewX + 'px',
        top:             (anchorViewY - 5) + 'px',
        transform:       'translate(-50%, -100%)',
        transformOrigin: '0 0',
        zIndex:          '99999',
        background:      'rgba(19,23,34,0.92)',
        color:           s.textColor || '#d1d4dc',
        fontSize:        fontSize + 'px',
        fontFamily:      '"JetBrains Mono", monospace',
        fontWeight:      s.bold   ? 'bold'   : 'normal',
        fontStyle:       s.italic ? 'italic' : 'normal',
        border:          '1px solid #2962ff',
        outline:         'none',
        padding:         '3px 6px',
        minWidth:        '80px',
        maxWidth:        '300px',
        resize:          'none',
        overflow:        'hidden',
        borderRadius:    '3px',
        cursor:          'text',
        caretColor:      '#fff',
      });

      document.body.appendChild(ta);
      ta.focus();
      ta.select();

      const commit = () => {
        const val = ta.value.trim();
        d.style = d.style || {};
        d.style.text = val || '';
        ta.remove();
        EventBus.emit('drawing:updated', d);
        EventBus.emit('drawing:redraw');
      };

      ta.addEventListener('keydown', ev => {
        if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); commit(); }
        if (ev.key === 'Escape') { ta.remove(); }
      });
      ta.addEventListener('blur', commit);
      return; // hline için burada bitir
    }

    // Use the internal _pt2xy (not the public utils wrapper)
    const a = _pt2xy(d.p1, pane);
    const b = _pt2xy(d.p2, pane);
    if (!a || !b) return;

    const textAlignH = s.textAlignH || 'center';
    const textAlignV = s.textAlignV || 'top';
    const lineAngle  = Math.atan2(b.y - a.y, b.x - a.x);
    
    // Normalize angle (same as drawing-trend.js)
    let drawAngle = lineAngle;
    let isFlipped = false;
    if (drawAngle > Math.PI / 2 || drawAngle < -Math.PI / 2) {
      drawAngle += Math.PI;
      isFlipped = true;
    }

    // Anchor point on the line (matching drawing-trend.js)
    let anchorX, anchorY;
    if (textAlignH === 'left') {
      anchorX = a.x; anchorY = a.y;
    } else if (textAlignH === 'right') {
      anchorX = b.x; anchorY = b.y;
    } else {
      anchorX = (a.x + b.x) / 2;
      anchorY = (a.y + b.y) / 2;
    }
```

---

## Özet Tablo

| # | Dosya | Satır | Değişiklik |
|---|-------|-------|------------|
| 1 | `drawing-core.js` | ~848 | `_openTrendlineTextEditor` başına `hline` için özel blok eklendi |

---

## Kesinlikle Yapılmayacaklar

- `drawing-trend.js` dosyasına **dokunma**
- `drawing-settings-dialog.js` dosyasına **dokunma**
- `trendline`, `ray`, `extended`, `infoline` araçlarına **dokunma**
- `_openTrendlineTextEditor` fonksiyonunun geri kalanına (`hline` bloğundan sonra) **dokunma**

---

## Test Adımları

1. **HLine** çiz → seç → "Add Text" hint görünmeli ✅
2. Hint üzerine gel → cursor beam olmalı ✅
3. Hint'e tıkla → inline editör açılmalı, cursor çizginin üzerinde olmalı ✅
4. Yazı yaz → Enter veya dışarı tıkla → text çizginin üzerinde ortada render edilmeli ✅
5. Settings → Text sekmesinden yazı yaz → chart üzerinde görünmeli ✅
6. **TrendLine** aracı — hiçbir şey değişmemiş olmalı ✅
