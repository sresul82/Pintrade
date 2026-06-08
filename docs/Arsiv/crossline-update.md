# CrossLine Tool — Güncelleme Talimatları

## Genel Bakış
CrossLine aracı, HLine (yatay) + VLine (dikey) birleşimidir.
Yapılacak değişiklikler:
1. **Text özelliği kaldırılacak** — settings dialog'dan Text tabı, property toolbar'dan text butonu
2. **Price Label** — zaten `caps.priceLabel:true` var, render tarafına eklenecek
3. **Time Label** — `caps.hasTimeLabel:true` eklenecek, render tarafına eklenecek

---

## 1. `drawing-settings-dialog.js` — TOOL_CAPS

**ESKİ:**
```js
crossline: { priceLabel:true, extend:false, midpoint:false, stats:false, capArrows:false, hasFill:false, coordsMode:'p1only' },
```

**YENİ:**
```js
crossline: { priceLabel:true, extend:false, midpoint:false, stats:false, capArrows:false, hasFill:false, hasText:false, hasTimeLabel:true, coordsMode:'p1only' },
```

---

## 2. `drawing-settings-dialog.js` — `_bindBodyEvents` — `dsd-pricelabel` event binding ekle

`timeLabelCb` bloğunun hemen **üstüne** şunu ekle:

```js
const priceLabelCb = overlay.querySelector('#dsd-pricelabel');
if (priceLabelCb) {
  priceLabelCb.addEventListener('change', () => {
    drawing.style = drawing.style || {};
    drawing.style.priceLabel = priceLabelCb.checked;
    EventBus.emit('drawing:settings:saved');
  });
}
```

---

## 3. `drawing-core.js` — `_getToolStyle`

**ESKİ:**
```js
// crossline için ayrı bir satır yok, generic fallback kullanılıyor
return { color: '#2962ff', width: 1, lineStyle: 'solid' };
```

Crossline'a özel default style ekle. Mevcut fallback satırından **önce**:

```js
if (tool === 'crossline') return { color: '#2962ff', width: 1, lineStyle: 'solid', priceLabel: true, timeLabel: true };
```

---

## 4. `drawing-trend.js` — `_drawCrossLine` fonksiyonu

**ESKİ:**
```js
function _drawCrossLine(ctx, d, pane) {
    try {
      if (d.price == null || !isFinite(d.price)) return;
      if (d.time == null) return;
      const y = pane.series.priceToCoordinate(d.price);
      const x = _timeToX(pane, d.time);
      if (y == null || !isFinite(y) || x == null || !isFinite(x)) return;
      const w = pane.drawingCanvas.width / (window.devicePixelRatio || 1);
      const h = pane.drawingCanvas.height / (window.devicePixelRatio || 1);
      const s = d.style || {};
      ctx.save();
      ctx.strokeStyle = s.color || '#2962ff';
      ctx.lineWidth   = s.width || 1;
      let dashArr = [];
      if (s.lineStyle === 'dashed') dashArr = [8, 5];
      else if (s.lineStyle === 'dotted') dashArr = [3, 3];
      ctx.setLineDash(dashArr);
      ctx.beginPath();
      ctx.moveTo(0, y); ctx.lineTo(w, y);
      ctx.moveTo(x, 0); ctx.lineTo(x, h);
      ctx.stroke();
      ctx.restore();
    } catch(e) { /* render hatası diğer çizimleri etkilemesin */ }
  }
```

**YENİ:**
```js
function _drawCrossLine(ctx, d, pane) {
    try {
      if (d.price == null || !isFinite(d.price)) return;
      if (d.time == null) return;
      const y = pane.series.priceToCoordinate(d.price);
      const x = _timeToX(pane, d.time);
      if (y == null || !isFinite(y) || x == null || !isFinite(x)) return;
      const w = pane.drawingCanvas.width / (window.devicePixelRatio || 1);
      const h = pane.drawingCanvas.height / (window.devicePixelRatio || 1);
      const s = d.style || {};
      ctx.save();
      ctx.strokeStyle = s.color || '#2962ff';
      ctx.lineWidth   = s.width || 1;
      let dashArr = [];
      if (s.lineStyle === 'dashed') dashArr = [8, 5];
      else if (s.lineStyle === 'dotted') dashArr = [3, 3];
      ctx.setLineDash(dashArr);

      // Price label genişliği — varsa yatay çizgi label'in önünde durur
      const showPriceLabel = s.priceLabel !== false;
      let priceLabelW = 0;
      if (showPriceLabel) {
        ctx.save();
        ctx.font = '10px "JetBrains Mono", sans-serif';
        priceLabelW = ctx.measureText(_formatPrice(d.price)).width + 18;
        ctx.restore();
      }

      // Yatay çizgi
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w - priceLabelW, y);
      ctx.stroke();

      // Dikey çizgi
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();

      ctx.restore();

      // Price label (sağ kenar — HLine ile aynı mantık)
      if (showPriceLabel) {
        _drawPriceLabel(ctx, d.price, y, pane, s.color || '#2962ff');
      }

      // Time label (alt kenar — VLine ile aynı mantık)
      if (s.timeLabel !== false) {
        const t = d.time;
        let dateObj;
        if (t && typeof t === 'object' && t.year) {
          dateObj = new Date(t.year, t.month - 1, t.day, t.hour || 0, t.minute || 0);
        } else {
          dateObj = new Date(typeof t === 'number' ? t * 1000 : t);
        }
        const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
        const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        const dd = days[dateObj.getDay()];
        const d2 = String(dateObj.getDate()).padStart(2, '0');
        const mo = months[dateObj.getMonth()];
        const yr = String(dateObj.getFullYear()).slice(2);
        const hh = String(dateObj.getHours()).padStart(2, '0');
        const mm = String(dateObj.getMinutes()).padStart(2, '0');
        const label = `${dd} ${d2} ${mo} '${yr}  ${hh}:${mm}`;
        const fontSize = 11;
        ctx.save();
        ctx.font = `${fontSize}px "JetBrains Mono", sans-serif`;
        const pad = 6;
        const tw = ctx.measureText(label).width;
        const boxW = tw + pad * 2;
        const boxH = fontSize + 8;
        const dpr = window.devicePixelRatio || 1;
        const canvasH = pane.drawingCanvas.height / dpr;
        const bx = x - boxW / 2;
        const by = canvasH - boxH;
        ctx.fillStyle = s.color || '#2962ff';
        ctx.beginPath();
        ctx.roundRect(bx, by, boxW, boxH, 3);
        ctx.fill();
        ctx.fillStyle = '#000000';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, x, by + boxH / 2);
        ctx.restore();
      }

    } catch(e) { /* render hatası diğer çizimleri etkilemesin */ }
  }
```

---

## Özet — Hangi dosya, kaç değişiklik

| Dosya | Değişiklik |
|---|---|
| `drawing-settings-dialog.js` | 2 yer: TOOL_CAPS satırı + `_bindBodyEvents` içine `priceLabelCb` event |
| `drawing-core.js` | 1 yer: `_getToolStyle` içine crossline default style |
| `drawing-trend.js` | 1 yer: `_drawCrossLine` fonksiyonu tamamen değişiyor |

**Not:** `property-toolbar.js`'de crossline için ayrı bir dal yok — genel `else` bloğuna düşüyor ve orada text butonu bulunmuyor, dolayısıyla toolbar tarafında değişiklik gerekmez.
