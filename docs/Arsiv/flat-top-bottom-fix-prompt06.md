# Flat Top/Bottom — 2 Düzeltme (`drawing-trend.js`)

---

## Düzeltme 1 — `_drawInlineLabel` fonksiyonu (Price label boş görünüyor)

Sorun: `ctx.beginPath()` path'i açmadan `roundRect`/`rect` çağrılıyor, sonra `fill()` hiçbir şey doldurmyor. Ayrıca metin rengi `#000000` iken arka plan da koyu olabilir.

### Mevcut `_drawInlineLabel` fonksiyonunu tamamen şununla değiştir:

```js
function _drawInlineLabel(ctx, price, x, y, color, bold, italic, fontSize) {
  if (price == null || x == null || y == null) return;
  const text = _formatPrice(price);
  if (!text) return;
  const fs = fontSize || 10;
  const fontStr = `${italic ? 'italic ' : ''}${bold ? 'bold ' : ''}${fs}px "JetBrains Mono", sans-serif`;

  ctx.save();
  ctx.globalAlpha = 1;
  ctx.font = fontStr;

  const pad  = 4;
  const txtW = ctx.measureText(text).width;
  const boxW = txtW + pad * 2;
  const boxH = fs + 6;
  const bx   = x - boxW / 2;
  const by   = y - boxH - 6;

  // Arka plan kutusu
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(bx, by, boxW, boxH, 3);
  else ctx.rect(bx, by, boxW, boxH);
  ctx.fillStyle = color || '#505060';
  ctx.fill();

  // Metin (arka plana göre kontrast: açık renk üstüne koyu, koyu üstüne açık)
  // Basit luminance hesabı
  let textColor = '#ffffff';
  if (color && color.startsWith('#') && color.length >= 7) {
    const r = parseInt(color.slice(1,3), 16);
    const g = parseInt(color.slice(3,5), 16);
    const b = parseInt(color.slice(5,7), 16);
    const lum = (0.299*r + 0.587*g + 0.114*b) / 255;
    textColor = lum > 0.55 ? '#000000' : '#ffffff';
  }
  ctx.fillStyle    = textColor;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, by + boxH / 2);

  ctx.restore();
}
```

---

## Düzeltme 2 — Text label açısı (Top/Middle/Bottom)

Kullanıcının istediği davranış:
- **Top** → yazı **yatay çizginin açısında** hareket eder (açı = 0, yani düz yatay)
- **Middle** → yazı **yatay çizgi açısı ile trend çizgisi açısının tam ortasında** hareket eder
- **Bottom** → yazı **trend (eğimli) çizginin açısında** hareket eder

`textAlignH` (Left/Center/Right) yazının çizgi üzerinde nereye konumlandığını belirler — bu değişmiyor.

### `_drawFlatTopBottom` içindeki `// ── Text label` bloğunu tamamen şununla değiştir:

```js
// ── Text label ──────────────────────────────────
const ftbText = s.text || '';
const hasText = !!ftbText;

if (hasText) {
  const textAlignH = s.textAlignH || 'center';
  const textAlignV = s.textAlignV || 'top';  // 'top' | 'middle' | 'bottom'

  // Yatay çizgi açısı: her zaman 0 (düz)
  const flatAngle  = 0;
  // Trend (eğimli) çizgi açısı
  const slantAngle = Math.atan2(slantB.y - slantA.y, slantB.x - slantA.x);

  // Yazının döneceği açı: textAlignV'e göre seç
  let rawAngle;
  if (textAlignV === 'top')         rawAngle = flatAngle;                        // yatay çizgi boyunca
  else if (textAlignV === 'bottom') rawAngle = slantAngle;                       // trend çizgisi boyunca
  else                              rawAngle = (flatAngle + slantAngle) / 2;     // ikisinin ortası

  // Yazı ters dönmesin
  let drawAngle = rawAngle;
  let isFlipped = false;
  if (drawAngle > Math.PI / 2 || drawAngle < -Math.PI / 2) {
    drawAngle += Math.PI;
    isFlipped = true;
  }

  // Anchor noktası: textAlignH'e göre çizgi üzerinde konum
  // Top → yatay çizgi üzerinde, Bottom → trend çizgisi üzerinde, Middle → ikisinin ortası
  let anchorX, anchorY;
  if (textAlignV === 'top') {
    // Yatay çizgi üzerinde: hLeft → hRight arası
    if      (textAlignH === 'left')   { anchorX = hLeft;                   anchorY = flatY; }
    else if (textAlignH === 'right')  { anchorX = hRight;                  anchorY = flatY; }
    else                              { anchorX = (hLeft + hRight) / 2;    anchorY = flatY; }
  } else if (textAlignV === 'bottom') {
    // Trend çizgisi üzerinde: slantA → slantB arası
    if      (textAlignH === 'left')   { anchorX = slantA.x; anchorY = slantA.y; }
    else if (textAlignH === 'right')  { anchorX = slantB.x; anchorY = slantB.y; }
    else                              { anchorX = (slantA.x + slantB.x) / 2; anchorY = (slantA.y + slantB.y) / 2; }
  } else {
    // Middle: her iki çizginin orta noktalarının ortası
    const flatMidX  = (hLeft + hRight) / 2;
    const flatMidY  = flatY;
    const slantMidX = (slantA.x + slantB.x) / 2;
    const slantMidY = (slantA.y + slantB.y) / 2;
    if      (textAlignH === 'left')  { anchorX = (hLeft   + slantA.x) / 2; anchorY = (flatY + slantA.y) / 2; }
    else if (textAlignH === 'right') { anchorX = (hRight  + slantB.x) / 2; anchorY = (flatY + slantB.y) / 2; }
    else                             { anchorX = (flatMidX + slantMidX) / 2; anchorY = (flatMidY + slantMidY) / 2; }
  }

  ctx.save();
  ctx.globalAlpha = 1;
  ctx.font      = `${s.italic ? 'italic ' : ''}${s.bold ? 'bold ' : ''}${s.fontSize || 13}px "JetBrains Mono", sans-serif`;
  ctx.fillStyle = s.textColor || '#d1d4dc';
  ctx.translate(anchorX, anchorY);
  ctx.rotate(drawAngle);

  let canvasAlign = 'center';
  if (textAlignH === 'left')  canvasAlign = isFlipped ? 'right' : 'left';
  if (textAlignH === 'right') canvasAlign = isFlipped ? 'left'  : 'right';
  ctx.textAlign    = canvasAlign;
  ctx.textBaseline = 'bottom';  // çizginin hemen üstünde

  const xShift = (canvasAlign === 'left') ? 4 : (canvasAlign === 'right') ? -4 : 0;
  ctx.fillText(ftbText, xShift, -4);
  ctx.restore();
}
```

---

## Özet

| Sorun | Dosya | Değişen yer |
|---|---|---|
| Price label boş (sadece kutu görünüyor) | `drawing-trend.js` | `_drawInlineLabel` — `beginPath()` eklendi, kontrast metin rengi hesaplandı |
| Text Top/Middle/Bottom yanlış çalışıyor | `drawing-trend.js` | `_drawFlatTopBottom` Text label bloğu — her `textAlignV` değeri için ayrı açı ve anchor hesabı |

`dsd-standard-tabs.js` ve `drawing-settings-dialog.js` değişmez.
