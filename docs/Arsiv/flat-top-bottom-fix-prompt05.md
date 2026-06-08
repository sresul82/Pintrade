# Flat Top/Bottom — 3 Düzeltme (`drawing-trend.js`)

Tüm değişiklikler `_drawFlatTopBottom` fonksiyonu içinde.

---

## Düzeltme 1 — Price Labels (P1, P2, P3 noktaları üstünde fiyat)

`_drawPriceLabel` sağ eksene yapışık çiziyor — p1/p2 için yanlış.
Fonksiyonun içine yeni bir helper ekle, mevcut `showPrices` bloğunu değiştir.

### `_drawFlatTopBottom` içinde, `// ── Fiyat etiketleri` bloğunun hemen üstüne bu helper'ı ekle:

```js
// Noktanın üstünde inline fiyat etiketi
function _drawInlineLabel(ctx, price, x, y, color, bold, italic, fontSize) {
  if (price == null || x == null || y == null) return;
  const text = _formatPrice(price);
  const fs   = fontSize || 10;
  const fontStr = `${italic ? 'italic ' : ''}${bold ? 'bold ' : ''}${fs}px "JetBrains Mono", sans-serif`;
  ctx.save();
  ctx.font = fontStr;
  const pad  = 4;
  const txtW = ctx.measureText(text).width;
  const boxW = txtW + pad * 2;
  const boxH = fs + 6;
  const bx   = x - boxW / 2;
  const by   = y - boxH - 6;

  // Arka plan kutusu
  ctx.globalAlpha = 1;
  ctx.fillStyle = color || '#505060';
  if (ctx.roundRect) ctx.roundRect(bx, by, boxW, boxH, 3);
  else ctx.rect(bx, by, boxW, boxH);
  ctx.fill();

  // Metin
  ctx.fillStyle    = '#000000';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, by + boxH / 2);
  ctx.restore();
}
```

### Mevcut `// ── Fiyat etiketleri` bloğunu tamamen şununla değiştir:

```js
// ── Fiyat etiketleri ─────────────────────────────
if (s.showPrices !== false) {
  const labelColor = s.priceColor || color;
  const labelFs    = s.priceFontSize || 10;
  const labelBold  = !!s.priceBold;
  const labelItalic = !!s.priceItalic;

  // p1 etiketi — eğimli çizginin sol noktasının üstünde
  _drawInlineLabel(ctx, d.p1.price, a.x, a.y, labelColor, labelBold, labelItalic, labelFs);

  // p2 etiketi — eğimli çizginin sağ noktasının üstünde
  _drawInlineLabel(ctx, d.p2.price, b.x, b.y, labelColor, labelBold, labelItalic, labelFs);

  // p3 etiketi — yatay çizginin sağ ucunun üstünde (p2.x'te, p3 fiyatında)
  if (d.p3) {
    _drawInlineLabel(ctx, d.p3.price, b.x, flatY, labelColor, labelBold, labelItalic, labelFs);
  }
}
```

---

## Düzeltme 2 — Text (Settings/Text'e yazılan yazı chartta görünsün)

`_drawFlatTopBottom` hiç `s.text` okumyor. Trendline'daki gibi eğimli çizgiye paralel text çizimi eklenecek.

### `ctx.restore();` satırından (çizgiler bloğunun sonu) hemen **sonra** ekle:

```js
// ── Text label ────────────────────────────────────
const ftbText = s.text || '';
const hasText = !!ftbText;

// Eğimli çizginin açısı (trendline ile aynı mantık)
const lineAngle = Math.atan2(slantB.y - slantA.y, slantB.x - slantA.x);
let drawAngle = lineAngle;
let isFlipped = false;
if (drawAngle > Math.PI / 2 || drawAngle < -Math.PI / 2) {
  drawAngle += Math.PI;
  isFlipped = true;
}

if (hasText) {
  const textAlignH = s.textAlignH || 'center';
  const textAlignV = s.textAlignV || 'top';

  let anchorX, anchorY;
  if (textAlignH === 'left')       { anchorX = slantA.x; anchorY = slantA.y; }
  else if (textAlignH === 'right') { anchorX = slantB.x; anchorY = slantB.y; }
  else                             { anchorX = (slantA.x + slantB.x) / 2; anchorY = (slantA.y + slantB.y) / 2; }

  ctx.save();
  ctx.font = `${s.italic ? 'italic ' : ''}${s.bold ? 'bold ' : ''}${s.fontSize || 13}px "JetBrains Mono", sans-serif`;
  ctx.fillStyle = s.textColor || '#d1d4dc';
  ctx.globalAlpha = 1;
  ctx.translate(anchorX, anchorY);
  ctx.rotate(drawAngle);

  let canvasAlign = 'center';
  if (textAlignH === 'left')  canvasAlign = isFlipped ? 'right' : 'left';
  if (textAlignH === 'right') canvasAlign = isFlipped ? 'left'  : 'right';
  ctx.textAlign = canvasAlign;

  const offsetDist = 6;
  let yOffset = 0;
  if (textAlignV === 'top')         { yOffset = -offsetDist; ctx.textBaseline = 'bottom'; }
  else if (textAlignV === 'bottom') { yOffset =  offsetDist; ctx.textBaseline = 'top'; }
  else                              { yOffset = 0;           ctx.textBaseline = 'middle'; }

  const xShift = (canvasAlign === 'left') ? 4 : (canvasAlign === 'right') ? -4 : 0;
  ctx.fillText(ftbText, xShift, yOffset);
  ctx.restore();
}
```

---

## Özet

| Sorun | Nerede | Ne yapıldı |
|---|---|---|
| P1/P2 price text gözükmüyor | `_drawFlatTopBottom` | `_drawInlineLabel` helper eklendi, noktanın üstünde çiziyor |
| B/I butonları etki etmiyor | `_drawFlatTopBottom` | `_drawInlineLabel` `bold`/`italic` parametresi aldı, `fontStr`'e yansıtıldı |
| Settings/Text yazısı gözükmüyor | `_drawFlatTopBottom` | `s.text` okunup eğimli çizgiye paralel çiziliyor (trendline ile aynı mantık) |

Sadece `drawing-trend.js` → `_drawFlatTopBottom` fonksiyonu değişiyor.
