# Flat Top/Bottom — 3 Düzeltme

---

## Düzeltme 1 — Text alignment Center/Right konumlanması (`drawing-trend.js`)

### Sorun
Şu anki kod: `center` ve `right` için `anchorX/Y`'yi `slantA/slantB` üzerinden hesaplıyor.
Bu yüzden `right` p2'nin tam konumuna gidiyor, p1–p2 arasında kalmıyor.

### İstenen
- `Left` → p1 noktasının en sol yani p1.x'te başlar
- `Center` → p1 ile p2 arasının tam ortası (x ekseni olarak clamp'li)
- `Right` → p2 noktasının tam konumu **değil**, p1–p2 aralığının içinde p2 tarafına yakın ama geçmez

Daha doğru ifadeyle: `textAlignH` her üç `textAlignV` modu için de **eğimli çizgi** (slant) üzerindeki bir noktayı seçmeli, hiçbiri p2'yi geçmemeli.

### `_drawFlatTopBottom` içindeki `// ── Text label` bloğunu tamamen şununla değiştir:

```js
// ── Text label ──────────────────────────────────
const ftbText = s.text || '';
const hasText = !!ftbText;

if (hasText) {
  const textAlignH = s.textAlignH || 'center';
  const textAlignV = s.textAlignV || 'top';

  // textAlignH: eğimli çizgi (slantA→slantB) üzerinde t parametresi
  // left=0.05, center=0.5, right=0.95  (p2'yi geçmiyor)
  const tH = textAlignH === 'left' ? 0.05 : textAlignH === 'right' ? 0.95 : 0.5;

  // Eğimli çizgi üzerindeki baz nokta
  const slantPt = {
    x: slantA.x + (slantB.x - slantA.x) * tH,
    y: slantA.y + (slantB.y - slantA.y) * tH
  };

  // Yatay çizgi üzerindeki karşılık gelen nokta (aynı tH, hLeft→hRight arası)
  const flatPt = {
    x: hLeft + (hRight - hLeft) * tH,
    y: flatY
  };

  // textAlignV: hangi çizgi üzerinde ve hangi açıda
  // top    → yatay çizgi üzerinde, açı = 0
  // bottom → eğimli çizgi üzerinde, açı = slant açısı
  // middle → ikisinin ortası
  let anchorX, anchorY, rawAngle;

  if (textAlignV === 'top') {
    anchorX  = flatPt.x;
    anchorY  = flatPt.y;
    rawAngle = 0;
  } else if (textAlignV === 'bottom') {
    anchorX  = slantPt.x;
    anchorY  = slantPt.y;
    rawAngle = Math.atan2(slantB.y - slantA.y, slantB.x - slantA.x);
  } else {
    // middle: geometrik orta, açı ortalaması
    anchorX  = (flatPt.x + slantPt.x) / 2;
    anchorY  = (flatPt.y + slantPt.y) / 2;
    const slantAngle = Math.atan2(slantB.y - slantA.y, slantB.x - slantA.x);
    rawAngle = slantAngle / 2;  // flat açısı 0, slant/2 = orta
  }

  // Yazı ters dönmesin
  let drawAngle = rawAngle;
  if (drawAngle > Math.PI / 2 || drawAngle < -Math.PI / 2) drawAngle += Math.PI;

  ctx.save();
  ctx.globalAlpha = 1;
  ctx.font      = `${s.italic ? 'italic ' : ''}${s.bold ? 'bold ' : ''}${s.fontSize || 13}px "JetBrains Mono", sans-serif`;
  ctx.fillStyle = s.textColor || '#d1d4dc';
  ctx.translate(anchorX, anchorY);
  ctx.rotate(drawAngle);
  ctx.textAlign    = 'center';   // tH parametresi zaten konumu halletti
  ctx.textBaseline = 'bottom';   // çizginin hemen üstünde
  ctx.fillText(ftbText, 0, -4);
  ctx.restore();
}
```

---

## Düzeltme 2 — capLeft / capRight ok uçları (`drawing-trend.js`)

### Sorun
`_drawFlatTopBottom` içinde `s.capLeft` / `s.capRight` hiç okunmuyor.
Trendline'daki gibi: `arrow` seçilince o uca ok çizilmeli, `normal` seçilince bir şey çizilmemeli.

### `// ── Çizgiler` bloğunun sonuna (iki `ctx.stroke()` çağrısından sonra, `ctx.restore()` öncesine) ekle:

```js
// Arrow caps — trendline ile aynı _drawArrowHead helper'ı kullanılır
const capLeft  = s.capLeft  || 'normal';
const capRight = s.capRight || 'normal';

// Eğimli çizgi uçları: slantA = p1 tarafı, slantB = p2 tarafı
if (capLeft  === 'arrow') _drawArrowHead(ctx, slantB, slantA); // p1 yönüne ok
if (capRight === 'arrow') _drawArrowHead(ctx, slantA, slantB); // p2 yönüne ok

// Yatay çizgi uçları: hLeft = p1.x tarafı, hRight = p2.x tarafı
const hLeftPt  = { x: hLeft,  y: flatY };
const hRightPt = { x: hRight, y: flatY };
if (capLeft  === 'arrow') _drawArrowHead(ctx, hRightPt, hLeftPt);  // sol uca ok
if (capRight === 'arrow') _drawArrowHead(ctx, hLeftPt,  hRightPt); // sağ uca ok
```

### Ayrıca `drawing-core.js`'de style default'u güncelle (satır ~54):

`capArrows: false` yerine `capLeft` ve `capRight` default'larını ekle:

```js
// Mevcut:
if (tool === 'flattopbottom') return { color: '#FF9800', width: 1, lineStyle: 'solid', extend: 'none', showPrices: true, priceColor: '#F44336', priceFontSize: 12, priceBold: false, priceItalic: false, background: true, bgColor: '#FF9800' };

// Yeni:
if (tool === 'flattopbottom') return { color: '#FF9800', width: 1, lineStyle: 'solid', extendLeft: false, extendRight: false, capLeft: 'normal', capRight: 'normal', showPrices: true, priceColor: '#F44336', priceFontSize: 12, priceBold: false, priceItalic: false, background: true, bgColor: '#FF9800', bgOpacity: 15 };
```

### `dsd-standard-tabs.js`'de `flattopbottom` bloğunda `capArrows: false` → `true` yap (satır ~84):

```js
// Mevcut:
flattopbottom:{ priceLabel:false, extend:true, midpoint:false, stats:false, capArrows:false, hasFill:false, hasText:true, hasFlatTopStyle:true, coordsMode:'p3' },

// Yeni:
flattopbottom:{ priceLabel:false, extend:true, midpoint:false, stats:false, capArrows:true, hasFill:false, hasText:true, hasFlatTopStyle:true, coordsMode:'p3' },
```

---

## Düzeltme 3 — Yatay çizgi cursor davranışı (`drawing-core.js`)

### Sorun
`flattopbottom`'un yatay çizgisine (`ftb_hline`) tıklayınca direkt `ns-resize` cursor geliyor.
İstenen: ilk hover'da `pointer` (hand), seçildikten sonra `ns-resize`.

### Mevcut hit test'te `flattopbottom` generic listeye dahil (satır ~2262 ve ~2665):
Yatay çizgi için özel `ftb_hline` hit-type eklenmesi ve cursor mantığı güncellenmesi gerekiyor.

### Adım A — `_hitTest` içinde `flattopbottom`'u generic listeden çıkar, özel blok ekle

Satır ~2262'deki listeden `'flattopbottom'`'u **sil**.
Satır ~2665'teki listeden `'flattopbottom'`'u **sil**.

Bu iki listeden çıkarıldıktan sonra, her ikisinin hemen **öncesine** şu özel bloğu ekle:

```js
// ── Flat Top/Bottom özel hit test ──────────────────
if (d.tool === 'flattopbottom' && d.p1 && d.p2) {
  const a = _pt2xy(d.p1, pane);
  const b = _pt2xy(d.p2, pane);
  if (!a || !b) return false;

  // p1 ve p2 anchor noktaları
  if (Math.hypot(x - a.x, y - a.y) <= tolerance) return 'p1';
  if (Math.hypot(x - b.x, y - b.y) <= tolerance) return 'p2';

  // Yatay çizgi anchor'ları ve gövdesi
  if (d.p3) {
    const flatY = pane.series.priceToCoordinate(d.p3.price);
    if (flatY != null && isFinite(flatY)) {
      const leftX  = a.x;
      const rightX = b.x;
      const minX   = Math.min(leftX, rightX);
      const maxX   = Math.max(leftX, rightX);

      // Sol anchor (p1.x, p3.price)
      if (Math.hypot(x - leftX,  y - flatY) <= tolerance) return 'ftb_left';
      // Sağ anchor (p2.x, p3.price)
      if (Math.hypot(x - rightX, y - flatY) <= tolerance) return 'ftb_right';
      // Yatay çizgi gövdesi
      if (Math.abs(y - flatY) <= tolerance && x >= minX - tolerance && x <= maxX + tolerance) {
        return 'ftb_hline';
      }
    }
  }

  // Eğimli çizgi gövdesi
  if (_distToSegment(x, y, a.x, a.y, b.x, b.y) <= tolerance) return 'line';

  return false;
}
```

### Adım B — Cursor bloğunu güncelle

`} else if (ht === 'p1' || ht === 'p2' || ht === 'p3') {` satırından **önce** ekle:

```js
} else if (tool === 'flattopbottom' && (ht === 'ftb_left' || ht === 'ftb_right' || ht === 'ftb_hline')) {
  // Seçili değilse pointer (hand), seçiliyse ns-resize
  const isSelected = htDrawing?.id === _selectedId;
  pane.cvs.style.cursor = isSelected ? 'ns-resize' : 'pointer';
```

### Adım C — Drag bloğunda `ftb_hline`, `ftb_left`, `ftb_right` için handler ekle

`} else if (_dragState.hitType === 'p3') {` bloğundan **önce** ekle:

```js
} else if (d.tool === 'flattopbottom' && (_dragState.hitType === 'ftb_hline' || _dragState.hitType === 'ftb_left' || _dragState.hitType === 'ftb_right')) {
  // Yatay çizgi: sadece fiyat (Y) hareket eder, OHLC'ye yapışabilir
  const { price } = _snapToCandle(pane, rawTime, rawPrice);
  d.p3 = { ...d.p3, price };
```

---

## Etkilenen Dosyalar

| Dosya | Değişen yer |
|---|---|
| `drawing-trend.js` | `_drawFlatTopBottom`: Text label bloğu + cap arrows ekleme |
| `drawing-core.js` | Style default, `_hitTest` özel blok, cursor bloğu, drag bloğu |
| `dsd-standard-tabs.js` | `flattopbottom` caps: `capArrows:false` → `capArrows:true` |
