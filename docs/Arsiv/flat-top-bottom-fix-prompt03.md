# Flat Top/Bottom — 3 Düzeltme

---

## Düzeltme 1 — Extend event handler temizliği (`drawing-settings-dialog.js`)

`flattopbottom` için eski dropdown event handler'ı hâlâ duruyor ama HTML'de artık
`#dsd-ftextend-header` / `#dsd-ftextend-body` yok — bunların yerine trendline ile
aynı `#dsd-ext-left` / `#dsd-ext-right` checkbox'ları var.

### Şu bloğu **tamamen sil**:

```js
// Extend dropdown (flat top/bottom)
const ftExtHeader = overlay.querySelector('#dsd-ftextend-header');
const ftExtBody   = overlay.querySelector('#dsd-ftextend-body');
if (ftExtHeader && ftExtBody) {
  ftExtHeader.addEventListener('click', () => ftExtBody.classList.toggle('hidden'));
  ftExtBody.querySelectorAll('.dsd-option').forEach(opt => {
    opt.addEventListener('click', () => {
      drawing.style.extend = opt.dataset.val;
      overlay.querySelector('#dsd-ftextend-label').textContent = opt.textContent.trim();
      ftExtBody.classList.add('hidden');
      EventBus.emit('drawing:settings:saved');
    });
  });
}
// ── /Flat Top/Bottom ─────────────────────────────────
```

Bu blok silindikten sonra mevcut `['dsd-ext-left', 'dsd-ext-right']` forEach handler'ı
(satır ~1093) `flattopbottom` için de çalışmaya başlayacak — ekstra bir şey yapmaya gerek yok.

---

## Düzeltme 2 — Background opacity (`drawing-trend.js` → `_drawFlatTopBottom`)

### Mevcut (yanlış — hardcode 0.15):

```js
if (s.background !== false) {
  const bgColor = s.bgColor || color;
  ctx.save();
  ctx.globalAlpha = 0.15;
  ctx.fillStyle = bgColor;
  ctx.beginPath();
  ctx.moveTo(slantA.x, slantA.y);
  ctx.lineTo(slantB.x, slantB.y);
  ctx.lineTo(hRight, flatY);
  ctx.lineTo(hLeft,  flatY);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
```

### Yeni (`bgOpacity` style değerini oku):

```js
if (s.background !== false) {
  const bgColor   = s.bgColor || color;
  // bgOpacity: picker'dan 0-100 int olarak gelir. Yoksa fallback 15.
  const bgOpacity = (s.bgOpacity != null) ? s.bgOpacity / 100 : 0.15;
  ctx.save();
  ctx.globalAlpha = bgOpacity;
  ctx.fillStyle   = bgColor;
  ctx.beginPath();
  ctx.moveTo(slantA.x, slantA.y);
  ctx.lineTo(slantB.x, slantB.y);
  ctx.lineTo(hRight, flatY);
  ctx.lineTo(hLeft,  flatY);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
```

---

## Düzeltme 3 — Price labels (`drawing-trend.js` → `_drawFlatTopBottom`)

`_drawPriceLabel` sadece sağ eksene yapışık label çiziyor — noktanın kendi üstünde
değil. Flat top/bottom için her noktanın kendi koordinatında label göstermek lazım.

### Adım A — `_drawInlineLabel` helper'ını `_drawFlatTopBottom` fonksiyonunun içine ekle

Fonksiyonun en başına (try bloğunun hemen içine, `const a = ...` satırından önce):

```js
// Her noktanın kendi üstünde fiyat etiketi çizer
function _drawInlineLabel(ctx, price, x, y, color, fontSize) {
  if (price == null || x == null || y == null) return;
  const text = _formatPrice(price);
  const fs   = fontSize || 10;
  ctx.save();
  ctx.font = `${fs}px "JetBrains Mono", sans-serif`;
  const pad  = 4;
  const txtW = ctx.measureText(text).width;
  const boxW = txtW + pad * 2;
  const boxH = fs + 6;
  const bx   = x - boxW / 2;
  const by   = y - boxH - 4;   // noktanın hemen üstünde

  ctx.fillStyle = color || 'rgba(80,80,90,0.9)';
  ctx.globalAlpha = 1;
  if (ctx.roundRect) ctx.roundRect(bx, by, boxW, boxH, 3);
  else ctx.rect(bx, by, boxW, boxH);
  ctx.fill();

  ctx.fillStyle    = '#000000';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, by + boxH / 2);
  ctx.restore();
}
```

### Adım B — Fiyat etiketleri bloğunu güncelle

**Mevcut:**

```js
if (s.showPrices !== false) {
  const labelColor = s.priceColor || color;
  // p1 fiyatı (flat çizginin sol ucu — sabit seviye)
  _drawPriceLabel(ctx, d.p1.price, flatY, pane, labelColor);
  // p2 fiyatı (eğimli çizginin sağ ucu)
  const p2y = pane.series.priceToCoordinate(d.p2.price);
  if (p2y != null && isFinite(p2y) && Math.abs(p2y - flatY) > 8) {
    _drawPriceLabel(ctx, d.p2.price, p2y, pane, labelColor);
  }
}
```

**Yeni:**

```js
if (s.showPrices !== false) {
  const labelColor = s.priceColor || color;
  const labelFs    = s.priceFontSize || 10;

  // p1 etiketi — eğimli çizginin sol noktasının üstünde
  _drawInlineLabel(ctx, d.p1.price, a.x, a.y, labelColor, labelFs);

  // p2 etiketi — eğimli çizginin sağ noktasının üstünde
  _drawInlineLabel(ctx, d.p2.price, b.x, b.y, labelColor, labelFs);

  // p3 etiketi — yatay çizginin sağ ucunun üstünde (p2.x, p3 fiyatı)
  if (d.p3) {
    _drawInlineLabel(ctx, d.p3.price, b.x, flatY, labelColor, labelFs);
  }
}
```

---

## Etkilenen Dosyalar

| Dosya | Değişen yer |
|---|---|
| `drawing-settings-dialog.js` | `ftExtHeader`/`ftExtBody` event bloğunu sil |
| `drawing-trend.js` | `_drawFlatTopBottom`: `globalAlpha = 0.15` → `bgOpacity` oku; price labels bloğunu değiştir + `_drawInlineLabel` helper ekle |

`dsd-standard-tabs.js` değişmez — HTML zaten doğru (`dsd-ext-left`/`dsd-ext-right`).
