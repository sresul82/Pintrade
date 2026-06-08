# Flat Top/Bottom — Tam Yeniden Yazım Talimatı

## Mevcut Durumun Eksikleri (TradingView Referansına Göre)

| Özellik | Mevcut | Olması Gereken |
|---|---|---|
| Slant çizgisi renk/genişlik/stil | ✅ kısmen | ✅ `s.color`, `s.width`, `s.lineStyle` |
| Flat (yatay) çizgi stili | ❌ sabit dashed | ✅ slant ile aynı stil |
| Extend (sol/sağ uzatma) | ❌ yok | ✅ `s.extend` → `left`, `right`, `both`, `none` |
| Background dolgu | ❌ sabit %7 opaklık | ✅ `s.background` true/false + `s.bgColor` |
| Price label (her iki uç fiyatı) | ❌ yok | ✅ `s.showPrices` true/false, fiyatlar sağ kenarda |
| ctx.save/restore + stroke ayarları | ❌ eksik | ✅ her şey save/restore içinde |

---

## Değişiklik 1 — Default stil — `drawing-core.js`

`_getToolStyle` fonksiyonunda `flattopbottom` için özel bir satır **yoktur**, generic default'a düşmektedir.

Aşağıdaki satırı bulun:
```js
if (tool === 'crossline') return { color: '#2962ff', width: 1, lineStyle: 'solid', priceLabel: true, timeLabel: true };
```

Bu satırın **hemen altına** şunu ekleyin:
```js
    if (tool === 'flattopbottom') return { color: '#FF9800', width: 1, lineStyle: 'solid', extend: 'none', showPrices: true, priceColor: '#F44336', priceFontSize: 12, priceBold: false, priceItalic: false, background: true, bgColor: '#FF9800' };
```

---

## Değişiklik 2 — `_drawFlatTopBottom` fonksiyonunu yeniden yaz — `drawing-trend.js`

Aşağıdaki bloğun **tamamını** (fonksiyon açılışından kapanış `}` dahil) yeni kodla değiştirin.

### Eski blok (silinecek):
```js
  function _drawFlatTopBottom(ctx, d, pane) {
      const a = _pt2xy(d.p1, pane);
      const b = _pt2xy(d.p2, pane);
      if (!a || !b) return;
      const W = pane.drawingCanvas.width / (window.devicePixelRatio || 1);
      const color = d.style?.color || '#2962ff';
  
      // Main slanted line
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  
      // Flat band: horizontal at the "opposite" endpoint price
      const flatPrice = d.p2.price > d.p1.price ? d.p1.price : d.p2.price;
      const flatY = pane.series.priceToCoordinate(flatPrice);
      if (flatY === null) return;
  
      const leftX  = Math.min(a.x, b.x);
      const rightX = Math.max(a.x, b.x);
  
      ctx.save();
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(leftX, flatY); ctx.lineTo(rightX, flatY);
      ctx.stroke();
      ctx.setLineDash([]);
  
      // Thin fill between slant and flat side
      ctx.globalAlpha = 0.07;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
      ctx.lineTo(rightX, flatY); ctx.lineTo(leftX, flatY);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
```

### Yeni blok (yerine yazılacak):
```js
  function _drawFlatTopBottom(ctx, d, pane) {
    try {
      const a = _pt2xy(d.p1, pane);
      const b = _pt2xy(d.p2, pane);
      if (!a || !b) return;

      const s = d.style || {};
      const color     = s.color     || '#FF9800';
      const lineWidth = s.width     || 1;
      const extend    = s.extend    || 'none';   // 'none' | 'left' | 'right' | 'both'

      const W = pane.drawingCanvas.width  / (window.devicePixelRatio || 1);
      const H = pane.drawingCanvas.height / (window.devicePixelRatio || 1);

      // ── Dash array ──────────────────────────────────────
      let dashArr = [];
      if (s.lineStyle === 'dashed') dashArr = [8, 5];
      else if (s.lineStyle === 'dotted') dashArr = [3, 3];

      // ── Flat price = the "outer" endpoint ───────────────

      // flat bottom → p2.price > p1.price → flat at p1 (lower)
      const flatPrice = d.p1.price > d.p2.price ? d.p1.price : d.p1.price < d.p2.price ? d.p1.price : d.p1.price;
      // Correct: flat side is always at p1 (the "corner" point — top-left or bottom-left)
      const flatY = pane.series.priceToCoordinate(d.p1.price);
      if (flatY == null || !isFinite(flatY)) return;

      // ── Extend slant line ───────────────────────────────
      let drawA = a, drawB = b;
      if (extend === 'left' || extend === 'both') drawA = _extendToEdge(b.x, b.y, a.x, a.y, W, H);
      if (extend === 'right' || extend === 'both') drawB = _extendToEdge(a.x, a.y, b.x, b.y, W, H);

      // ── Flat line x range ───────────────────────────────
      // Flat horizontal line spans from p1.x to the right edge (or extended)
      let flatLeft  = a.x;
      let flatRight = extend === 'right' || extend === 'both' ? W : b.x;
      if (extend === 'left' || extend === 'both') flatLeft = 0;

      // ── Background fill ─────────────────────────────────
      if (s.background !== false) {
        const bgColor = s.bgColor || color;
        ctx.save();
        ctx.globalAlpha = 0.15;
        ctx.fillStyle = bgColor;
        ctx.beginPath();
        // Triangle/trapezoid: slant line top + flat line bottom (or vice versa)
        ctx.moveTo(drawA.x, drawA.y);
        ctx.lineTo(drawB.x, drawB.y);
        ctx.lineTo(flatRight, flatY);
        ctx.lineTo(flatLeft,  flatY);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth   = lineWidth;
      ctx.setLineDash(dashArr);

      // ── Slant line ──────────────────────────────────────
      ctx.beginPath();
      ctx.moveTo(drawA.x, drawA.y);
      ctx.lineTo(drawB.x, drawB.y);
      ctx.stroke();

      // ── Flat (horizontal) line ──────────────────────────
      ctx.beginPath();
      ctx.moveTo(flatLeft,  flatY);
      ctx.lineTo(flatRight, flatY);
      ctx.stroke();

      ctx.restore();

      // ── Price labels ────────────────────────────────────
      if (s.showPrices !== false) {
        const priceColor = s.priceColor || color;
        // p1 price (flat end)
        _drawPriceLabel(ctx, d.p1.price, flatY, pane, priceColor);
        // p2 price (slant end) — only if meaningfully different
        const p2y = pane.series.priceToCoordinate(d.p2.price);
        if (p2y != null && isFinite(p2y) && Math.abs(p2y - flatY) > 8) {
          _drawPriceLabel(ctx, d.p2.price, p2y, pane, priceColor);
        }
      }

    } catch(e) { /* render hatası diğer çizimleri etkilemesin */ }
  }
```

---

## Değişiklik 3 — Settings dialog desteği

`drawing-settings-dialog.js` veya `dsd-standard-tabs.js` içinde `flattopbottom` için sekme tanımı varsa, aşağıdaki alanların gösterildiğinden emin olun:

| Alan | Tip | Style key |
|---|---|---|
| Line renk + genişlik + stil | color+select | `color`, `width`, `lineStyle` |
| Extend | dropdown | `extend`: `'none'` / `'left'` / `'right'` / `'both'` |
| Prices checkbox + renk + font | checkbox+color | `showPrices`, `priceColor`, `priceFontSize` |
| Background checkbox | checkbox | `background`, `bgColor` |

> Eğer settings dialog `flattopbottom`'u henüz tanımıyorsa ve genel "standard" tab kullanıyorsa, `color`/`width`/`lineStyle` zaten çalışır. Extend ve Prices için özel alan eklemek ayrı bir iştir.

---

## Özet

| # | Dosya | Değişiklik |
|---|---|---|
| 1 | `drawing-core.js` | `crossline` satırının altına `flattopbottom` default stil satırı eklenir |
| 2 | `drawing-trend.js` | `_drawFlatTopBottom` fonksiyonu tamamen yeniden yazılır |
| 3 | Settings dialog | `extend`, `showPrices`, `background` alanları varsa kontrol edilir |
