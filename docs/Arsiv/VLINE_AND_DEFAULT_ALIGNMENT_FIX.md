# PinTrade V2.4 — VLine Add Text Hint & Tüm Araçlar İçin Default Hizalama Düzeltme Görevi

## Sorunun Özeti

1. **Tüm araçlarda (hline, trendline, ray, extended, channel, infoline vb.) Settings açılıp kapatılmadan önce `Add Text` hint merkeze değil, başka bir noktaya konumlanıyor.**
   - **Kök neden:** `_getToolStyle` içindeki araç başlangıç stillerinde `textAlignH` ve `textAlignV` field'ları yok. Dolayısıyla `s.textAlignH` ilk çizimde `undefined`. Settings açılıp kapandığında dialog bu değerleri state'e yazıyor, bundan sonra düzeliyor.
   - **HRay'da bu sorun yoktu** çünkü hem render hem hint kodu aynı `|| 'left'` default'ını kullandığından ikisi her zaman tutarlıydı. Ama artık default `'center'` olacağı için hray'da da düzeltme gerekiyor.

2. **`vline` aracında hiç `Add Text` hint'i yok.**

3. **Tüm çizim araçlarında default metin hizalaması `center / top` olmalı.**

---

## Değişiklik 1 — `drawing-core.js`: `_getToolStyle` içine `textAlignH` ve `textAlignV` default'larını ekle

Aşağıdaki her satırı bulup sonuna `textAlignH: 'center', textAlignV: 'top'` ekle:

**Mevcut:**
```js
if (tool === 'trendline') return { color: '#a3a6af', width: 1, lineStyle: 'solid', extendLeft: false, extendRight: false, textColor: '#ffffff', fillColor: 'rgba(41, 137, 255, 0.2)' };
if (tool === 'ray') return { color: '#a3a6af', width: 1, lineStyle: 'solid', extendLeft: false, extendRight: true, textColor: '#ffffff', fillColor: 'rgba(41, 137, 255, 0.2)' };
if (tool === 'extended') return { color: '#a3a6af', width: 1, lineStyle: 'solid', extendLeft: true, extendRight: true, textColor: '#ffffff', fillColor: 'rgba(41, 137, 255, 0.2)' };
if (tool === 'hray') return { color: '#2962ff', width: 1, lineStyle: 'solid', extendLeft: false, textColor: '#ffffff', fillColor: 'rgba(41, 137, 255, 0.2)' };
if (tool === 'hline') return { color: '#2962ff', width: 1, lineStyle: 'solid', textColor: '#ffffff', fillColor: 'rgba(41, 137, 255, 0.2)' };
if (tool === 'vline') return { color: '#2962ff', width: 1, lineStyle: 'solid', textOrientation: 'horizontal', timeLabel: true, textColor: '#ffffff', fillColor: 'rgba(41, 137, 255, 0.2)' };
if (tool === 'channel') return { color: '#2962ff', width: 1, lineStyle: 'solid', fillColor: 'rgba(9, 105, 218, 0.2)', textColor: '#ffffff', priceLabel: true };
```

**Yeni:**
```js
if (tool === 'trendline') return { color: '#a3a6af', width: 1, lineStyle: 'solid', extendLeft: false, extendRight: false, textColor: '#ffffff', fillColor: 'rgba(41, 137, 255, 0.2)', textAlignH: 'center', textAlignV: 'top' };
if (tool === 'ray') return { color: '#a3a6af', width: 1, lineStyle: 'solid', extendLeft: false, extendRight: true, textColor: '#ffffff', fillColor: 'rgba(41, 137, 255, 0.2)', textAlignH: 'center', textAlignV: 'top' };
if (tool === 'extended') return { color: '#a3a6af', width: 1, lineStyle: 'solid', extendLeft: true, extendRight: true, textColor: '#ffffff', fillColor: 'rgba(41, 137, 255, 0.2)', textAlignH: 'center', textAlignV: 'top' };
if (tool === 'hray') return { color: '#2962ff', width: 1, lineStyle: 'solid', extendLeft: false, textColor: '#ffffff', fillColor: 'rgba(41, 137, 255, 0.2)', textAlignH: 'center', textAlignV: 'top' };
if (tool === 'hline') return { color: '#2962ff', width: 1, lineStyle: 'solid', textColor: '#ffffff', fillColor: 'rgba(41, 137, 255, 0.2)', textAlignH: 'center', textAlignV: 'top' };
if (tool === 'vline') return { color: '#2962ff', width: 1, lineStyle: 'solid', textOrientation: 'horizontal', timeLabel: true, textColor: '#ffffff', fillColor: 'rgba(41, 137, 255, 0.2)', textAlignH: 'center', textAlignV: 'top' };
if (tool === 'channel') return { color: '#2962ff', width: 1, lineStyle: 'solid', fillColor: 'rgba(9, 105, 218, 0.2)', textColor: '#ffffff', priceLabel: true, textAlignH: 'center', textAlignV: 'top' };
```

---

## Değişiklik 2 — `drawing-core.js`: `_openTrendlineTextEditor` içindeki hray default'ını düzelt

**Mevcut (~satır 1093):**
```js
const textAlignH = s.textAlignH || (d.tool === 'hray' ? 'left' : 'center');
```

**Yeni:**
```js
const textAlignH = s.textAlignH || 'center';
```

---

## Değişiklik 3 — `drawing-core.js`: `_openTrendlineTextEditor` içine `vline` bloğu ekle

`hline/hray` bloğunun hemen **üstüne** şu yeni bloğu ekle:

```js
// vline: dikey çizgi — zaman eksenine göre X, sabit canvas Y
if (d.tool === 'vline') {
  if (d.time == null) return;
  const x = pane.chart.timeScale().timeToCoordinate(d.time);
  if (x == null || !isFinite(x)) return;
  const dpr = window.devicePixelRatio || 1;
  const cvsH = pane.drawingCanvas.height / dpr;
  const textAlignH = s.textAlignH || 'center';
  const textAlignV = s.textAlignV || 'top';

  let anchorX;
  if      (textAlignH === 'left')  anchorX = x + 6;
  else if (textAlignH === 'right') anchorX = x - 6;
  else                             anchorX = x;

  const rowH = (s.fontSize || 14) + 4;
  let anchorY, transformY;
  if      (textAlignV === 'bottom') { anchorY = cvsH - rowH; transformY = 'translate(-50%, 0%)'; }
  else if (textAlignV === 'middle') { anchorY = cvsH / 2;    transformY = 'translate(-50%, -50%)'; }
  else                              { anchorY = 10;           transformY = 'translate(-50%, 0%)'; }

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
    top:             anchorViewY + 'px',
    transform:       transformY,
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
  return; // vline için burada bitir
}
```

---

## Değişiklik 4 — `drawing-core.js`: `onMouseUp` içindeki araç listesine `vline` ekle

**Mevcut (~satır 1030):**
```js
if (!wasDragging && ds.isReClick && ['trendline', 'ray', 'extended', 'infoline', 'hline', 'hray'].includes(ds.d.tool)) {
```

**Yeni:**
```js
if (!wasDragging && ds.isReClick && ['trendline', 'ray', 'extended', 'infoline', 'hline', 'hray', 'vline'].includes(ds.d.tool)) {
```

---

## Değişiklik 5 — `drawing-core.js`: `drawVLine` çağrısına `selected` parametresi ekle

**Mevcut (~satır 1931):**
```js
if (d.tool === 'vline') window.DrawingTrend.drawVLine(ctx, d, pane);
```

**Yeni:**
```js
if (d.tool === 'vline') window.DrawingTrend.drawVLine(ctx, d, pane, selected);
```

---

## Değişiklik 6 — `drawing-trend.js`: `_drawVLine` fonksiyonuna `selected` parametresi ekle ve Add Text hint bloğu yaz

### 6a — Fonksiyon imzasını güncelle

**Mevcut:**
```js
function _drawVLine(ctx, d, pane) {
```

**Yeni:**
```js
function _drawVLine(ctx, d, pane, selected) {
```

### 6b — Metin render + Add Text hint bloğunu değiştir

Aşağıdaki mevcut bloğu (`const vlineText = s.text || '';` satırından `ctx.restore();` / `} catch` öncesine kadar) tümüyle şu yeni kodla değiştir:

**Mevcut blok:**
```js
        const vlineText = s.text || '';
        if (vlineText) {
          const textAlignH = s.textAlignH || 'left';
          const textAlignV = s.textAlignV || 'top';
          const orientation = s.textOrientation || 'horizontal';
          ctx.save();
          ctx.font = `${s.bold ? 'bold ' : ''}${s.italic ? 'italic ' : ''}${s.fontSize || 14}px "JetBrains Mono", sans-serif`;
          ctx.fillStyle = s.textColor || '#ffffff';
          ctx.globalAlpha = 1;
          let tx, ty;
          if (textAlignH === 'left')        tx = x + 6;
          else if (textAlignH === 'center') tx = x;
          else if (textAlignH === 'right')  tx = x - 6;
          const rowH = (s.fontSize || 14) + 4;
          if (textAlignV === 'top')         ty = 10;
          else if (textAlignV === 'middle') ty = textBaseH / 2;
          else if (textAlignV === 'bottom') ty = textBaseH - rowH;
          if (orientation === 'vertical') {
            ctx.translate(tx, ty);
            ctx.rotate(-Math.PI / 2);
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(vlineText, 0, 0);
          } else {
            ctx.textAlign = textAlignH === 'right' ? 'right' : textAlignH === 'center' ? 'center' : 'left';
            ctx.textBaseline = 'top';
            ctx.fillText(vlineText, tx, ty);
          }
          ctx.restore();
        }
```

**Yeni blok:**
```js
        const vlineText = s.text || '';
        const textAlignH = s.textAlignH || 'center';
        const textAlignV = s.textAlignV || 'top';

        // textAlignH / textAlignV'e göre metin koordinatını hesapla
        let tx, ty;
        if (textAlignH === 'left')        tx = x + 6;
        else if (textAlignH === 'center') tx = x;
        else if (textAlignH === 'right')  tx = x - 6;
        const rowH = (s.fontSize || 14) + 4;
        if (textAlignV === 'top')         ty = 10;
        else if (textAlignV === 'middle') ty = textBaseH / 2;
        else if (textAlignV === 'bottom') ty = textBaseH - rowH;

        if (vlineText) {
          const orientation = s.textOrientation || 'horizontal';
          ctx.save();
          ctx.font = `${s.bold ? 'bold ' : ''}${s.italic ? 'italic ' : ''}${s.fontSize || 14}px "JetBrains Mono", sans-serif`;
          ctx.fillStyle = s.textColor || '#ffffff';
          ctx.globalAlpha = 1;
          if (orientation === 'vertical') {
            ctx.translate(tx, ty);
            ctx.rotate(-Math.PI / 2);
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(vlineText, 0, 0);
          } else {
            ctx.textAlign = textAlignH === 'right' ? 'right' : textAlignH === 'center' ? 'center' : 'left';
            ctx.textBaseline = 'top';
            ctx.fillText(vlineText, tx, ty);
          }
          ctx.restore();
        }

        // "Add Text" hint — seçili ve metin yok
        if (selected && !vlineText) {
          const hintText = 'Add Text';
          ctx.save();
          ctx.font = '12px "JetBrains Mono", sans-serif';
          ctx.fillStyle = s.color || '#2962ff';
          ctx.globalAlpha = 0.6;
          ctx.textAlign = textAlignH === 'right' ? 'right' : textAlignH === 'center' ? 'center' : 'left';
          ctx.textBaseline = 'top';
          ctx.fillText(hintText, tx, ty);
          const hintTextW = ctx.measureText(hintText).width;
          ctx.restore();
          if (!window._trendTextHintAreas) window._trendTextHintAreas = {};
          window._trendTextHintAreas[d.id] = { cx: tx, cy: ty, hw: hintTextW / 2 + 6, hh: 10, angle: 0 };
        } else if (selected && vlineText) {
          ctx.save();
          ctx.font = `${s.fontSize || 14}px "JetBrains Mono", sans-serif`;
          const tw = ctx.measureText(vlineText).width;
          ctx.restore();
          if (!window._trendTextHintAreas) window._trendTextHintAreas = {};
          window._trendTextHintAreas[d.id] = { cx: tx, cy: ty, hw: tw / 2 + 6, hh: 10, angle: 0 };
        } else {
          if (window._trendTextHintAreas) delete window._trendTextHintAreas[d.id];
        }
```

---

## Değişiklik 7 — `drawing-trend.js`: `_drawHRay` içindeki iki `|| 'left'` default'ını `|| 'center'` yap

`_drawHRay` fonksiyonu içinde `textAlignH` için `'left'` olan iki ayrı fallback var. İkisini de `'center'` yap.

**1. Metin render bloğu (~satır 350):**
```js
// Mevcut:
const textAlignH = s.textAlignH || 'left';

// Yeni:
const textAlignH = s.textAlignH || 'center';
```

**2. Add Text hint bloğu (~satır 364):**
```js
// Mevcut:
const textAlignH = s.textAlignH || 'left';

// Yeni:
const textAlignH = s.textAlignH || 'center';
```

---

## Özet Tablosu

| # | Dosya | Yer | Değişiklik |
|---|---|---|---|
| 1 | `drawing-core.js` | `_getToolStyle` — 7 araç satırı | `textAlignH: 'center', textAlignV: 'top'` eklendi |
| 2 | `drawing-core.js` | `_openTrendlineTextEditor` — hray default | `'left'` → `'center'` |
| 3 | `drawing-core.js` | `_openTrendlineTextEditor` | `vline` bloğu eklendi |
| 4 | `drawing-core.js` | `onMouseUp` araç listesi | `'vline'` eklendi |
| 5 | `drawing-core.js` | `drawVLine` çağrısı | `selected` parametresi eklendi |
| 6 | `drawing-trend.js` | `_drawVLine` | `selected` parametresi + Add Text hint bloğu |
| 7 | `drawing-trend.js` | `_drawHRay` — 2 adet `|| 'left'` | `'center'` yapıldı |

**Bu değişiklikler dışında hiçbir şeye dokunma.**
