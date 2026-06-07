# Flat Top/Bottom — Background Fill Sonsuz Extend Düzeltmesi (`drawing-trend.js`)

## Sorun
Background fill 4 köşeli polygon:
```
slantA → slantB → (hRight, flatY) → (hLeft, flatY)
```

Extend açıkken `slantA/slantB` INF'a uzuyor ama polygon hâlâ bu 4 nokta.
E�imli çizgi ekran dışına çıkınca köşe boşta kalıyor — flat ile slant arasındaki üçgen alan dolmuyor.

## Çözüm
Extend açıkken polygon'a ekstra köşe ekle:
- `extendLeft` açıksa: slantA ekranın sol+üst/alt köşesine gidiyor → flat çizgisinin sol ucuyla (`hLeft, flatY`) arasındaki köşeyi kapatmak için `(hLeft, slantA.y)` ekle
- `extendRight` açıksa: aynı mantıkla `(hRight, slantB.y)` ekle

## `// ── Background fill` bloğunu tamamen şununla değiştir:

```js
// ── Background fill ───────────────────────────────
if (s.background !== false) {
  const bgColor   = s.bgColor || color;
  const bgOpacity = (s.bgOpacity != null) ? s.bgOpacity / 100 : 0.15;
  ctx.save();
  ctx.globalAlpha = bgOpacity;
  ctx.fillStyle   = bgColor;
  ctx.beginPath();

  // Sol üst: slantA (extend açıksa INF'a uzuyor)
  ctx.moveTo(slantA.x, slantA.y);

  // Sağ üst: slantB (extend açıksa INF'a uzuyor)
  ctx.lineTo(slantB.x, slantB.y);

  // Extend right açıksa: slantB ile flatY arasındaki köşeyi kapat
  if (extendRight) ctx.lineTo(hRight, slantB.y);

  // Sağ alt: yatay çizginin sağ ucu
  ctx.lineTo(hRight, flatY);

  // Sol alt: yatay çizginin sol ucu
  ctx.lineTo(hLeft, flatY);

  // Extend left açıksa: hLeft ile slantA arasındaki köşeyi kapat
  if (extendLeft) ctx.lineTo(hLeft, slantA.y);

  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
```

Başka hiçbir şey değişmez.