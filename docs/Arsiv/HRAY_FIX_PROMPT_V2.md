# PinTrade V2.4 — Horizontal Ray (`hray`) Tam Düzeltme Görevi

## Bağlam

`drawing-trend.js` içindeki `_drawHRay` fonksiyonu ve `drawing-core.js` içindeki ilgili mantık yanlış çalışmaktadır. Referans araç olan `_drawHLine` (Horizontal Line) ile karşılaştırmalı inceleme yapılmış, aşağıdaki farklar tespit edilmiştir.

**Temel Kural:** Yalnızca aşağıda belirtilen değişiklikleri yap. Başka hiçbir araca, fonksiyona veya satıra dokunma.

---

## Sorun 1 — `drawing-trend.js`: `_drawHRay` render hatası (çizgi görünmüyor / kaçıyor)

### Neden oluyor

`_drawHRay` şu anda şunu yapıyor:

```js
const x = _timeToX(pane, d.time);
if (y == null || !isFinite(y) || x == null || !isFinite(x)) return; // ← HATALI ÇIKIŞ
// ...
ctx.moveTo(x, y);
ctx.lineTo(w - hrayLabelW, y);
```

**Problem 1:** `_timeToX` chart scroll/zoom edildiğinde görünür alanın dışında kalan zaman için negatif veya `w`'den büyük bir değer döndürür. Bu durumda `isFinite(x)` **true** olur ama çizgi ekran dışına çıkar. Yani `!isFinite(x)` koşulu bu durumu yakalamaz.

**Problem 2:** `x > w - hrayLabelW` olduğunda (başlangıç noktası bitiş noktasının sağına geçtiğinde) canvas sıfır veya negatif uzunluklu çizgi çizer — ekranda hiçbir şey görünmez.

**Problem 3:** `_drawHLine`'dan farklı olarak `_drawHRay`, seçili durumda "Add Text" hint ve `_trendTextHintAreas` kaydı yapmıyor. Bu tutarsızlık ileriki hatalara yol açar.

### Çözüm

`drawing-trend.js` içindeki `_drawHRay` fonksiyonunun **tamamını** aşağıdaki kod ile değiştir:

```js
function _drawHRay(ctx, d, pane, selected) {
  try {
    if (d.price == null || !isFinite(d.price)) return;
    if (d.time == null) return;
    const y = pane.series.priceToCoordinate(d.price);
    if (y == null || !isFinite(y)) return;

    const w = pane.drawingCanvas.width / (window.devicePixelRatio || 1);
    const s = d.style || {};

    // Başlangıç X'ini hesapla; görünür alan dışına çıkmışsa 0'a sabitle
    const rawX = _timeToX(pane, d.time);
    // rawX null veya NaN ise 0'dan başlat (hline gibi davran)
    const startX = (rawX != null && isFinite(rawX)) ? rawX : 0;

    ctx.save();
    ctx.strokeStyle = s.color || '#2962ff';
    ctx.lineWidth   = s.width || 1;
    let dashArr = [];
    if (s.lineStyle === 'dashed') dashArr = [8, 5];
    else if (s.lineStyle === 'dotted') dashArr = [3, 3];
    ctx.setLineDash(dashArr);

    // Price label genişliği
    const showLabel = s.priceLabel !== false;
    let hrayLabelW = 0;
    if (showLabel) {
      ctx.save();
      ctx.font = '10px "JetBrains Mono", sans-serif';
      hrayLabelW = ctx.measureText(_formatPrice(d.price)).width + 8 + 5 + 5;
      ctx.restore();
    }

    const endX = w - hrayLabelW;

    // Başlangıç noktası bitiş noktasının sağına geçmişse çizgiyi gösterme
    // (zaman henüz chart'a girmemiş demektir — sağda bekliyor)
    if (startX < endX) {
      ctx.beginPath();
      ctx.moveTo(startX, y);
      ctx.lineTo(endX, y);
      ctx.stroke();
    }

    if (showLabel) _drawPriceLabel(ctx, d.price, y, pane, s.color || '#2962ff');

    // Metin
    const hrayText = s.text || '';
    if (hrayText) {
      ctx.save();
      ctx.font = `${s.bold ? 'bold ' : ''}${s.italic ? 'italic ' : ''}${s.fontSize || 14}px "JetBrains Mono", sans-serif`;
      ctx.fillStyle = s.textColor || '#ffffff';
      ctx.textBaseline = 'bottom';
      ctx.globalAlpha = 1;
      const textAlignH = s.textAlignH || 'left';
      const textAlignV = s.textAlignV || 'top';
      let tx, ty;
      if (textAlignH === 'left')        { ctx.textAlign = 'left';   tx = startX + 6; }
      else if (textAlignH === 'center') { ctx.textAlign = 'center'; tx = (startX + w) / 2; }
      else if (textAlignH === 'right')  { ctx.textAlign = 'right';  tx = w - 6; }
      if (textAlignV === 'top')         { ctx.textBaseline = 'bottom'; ty = y - 5; }
      else if (textAlignV === 'middle') { ctx.textBaseline = 'middle'; ty = y; }
      else if (textAlignV === 'bottom') { ctx.textBaseline = 'top';    ty = y + 5; }
      ctx.fillText(hrayText, tx, ty);
      ctx.restore();
    }

    // "Add Text" hint — hline ile aynı davranış
    if (selected && !hrayText) {
      const hintText = 'Add Text';
      ctx.save();
      ctx.font = '12px "JetBrains Mono", sans-serif';
      ctx.fillStyle = s.color || '#2962ff';
      ctx.globalAlpha = 0.6;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      const midX = (startX + endX) / 2;
      ctx.fillText(hintText, midX, y - 5);
      const hintTextW = ctx.measureText(hintText).width;
      ctx.restore();
      if (!window._trendTextHintAreas) window._trendTextHintAreas = {};
      window._trendTextHintAreas[d.id] = { cx: midX, cy: y - 5, hw: hintTextW / 2 + 6, hh: 10, angle: 0 };
    } else if (selected && hrayText) {
      ctx.save();
      ctx.font = `${s.fontSize || 14}px "JetBrains Mono", sans-serif`;
      const tw = ctx.measureText(hrayText).width;
      ctx.restore();
      if (!window._trendTextHintAreas) window._trendTextHintAreas = {};
      window._trendTextHintAreas[d.id] = { cx: (startX + endX) / 2, cy: y - 5, hw: tw / 2 + 6, hh: 10, angle: 0 };
    } else {
      if (window._trendTextHintAreas) delete window._trendTextHintAreas[d.id];
    }

    ctx.restore();
  } catch(e) { console.warn('[HRay] render error', e); }
}
```

---

## Sorun 2 — `drawing-core.js`: `_renderDrawing` içinde `drawHRay` çağrısı `selected` parametresi almıyor

### Mevcut kod (yaklaşık satır 1902):

```js
if (d.tool === 'hray') window.DrawingTrend.drawHRay(ctx, d, pane);
```

### Düzeltilmiş kod:

```js
if (d.tool === 'hray') window.DrawingTrend.drawHRay(ctx, d, pane, selected);
```

---

## Sorun 3 — `drawing-core.js`: `_clearDrawings` içinde `_saveState` tanımsız

### Mevcut kod (yaklaşık satır 1449):

```js
_saveState(all);
```

### Düzeltilmiş kod:

```js
State.set('drawings', all);
Storage.save('drawings', all);
```

---

## Sorun 4 — `drawing-trend.js`: Export listesinde `drawHRay` `selected` parametresi belgelenmiyor

`drawing-trend.js` dosyasının en altındaki `return { ... }` bloğunda `drawHRay` zaten export edilmekte. Değişen sadece fonksiyon imzasıdır (`selected` parametresi eklendi). Return bloğunda ayrıca bir değişiklik gerekmez.

---

## Özet Tablosu

| Dosya | Yer | Değişiklik |
|---|---|---|
| `drawing-trend.js` | `_drawHRay` fonksiyonunun tamamı | Yeniden yazıldı: `startX` güvenli hesabı, `selected` parametresi, `_trendTextHintAreas` desteği |
| `drawing-core.js` | `_renderDrawing` ~satır 1902 | `drawHRay(ctx, d, pane)` → `drawHRay(ctx, d, pane, selected)` |
| `drawing-core.js` | `_clearDrawings` ~satır 1449 | `_saveState(all)` → `State.set + Storage.save` |

Bu üç değişiklik dışında hiçbir şeye dokunma.
