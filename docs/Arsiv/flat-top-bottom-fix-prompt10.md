# Flat Top/Bottom — Sonsuz Extend (`drawing-trend.js`)

## Sorun
`_extendToEdge(x1, y1, x2, y2, W, H)` canvas'ın görünür piksel sınırına kadar gidiyor.
Chart kaydırılınca canvas değişmediği için çizgi o noktada "takılı" kalıyor — sonsuz gibi görünmüyor.

## Çözüm
Canvas çok büyük bir sınır değeriyle çağrılırsa (`99999`) çizgi pratikte sonsuza uzar.
Canvas'ın kendi clipping'i görünür alanı zaten kesiyor, taşan kısım render edilmiyor.

---

## `_drawFlatTopBottom` içinde extend bloğunu değiştir:

### Mevcut:
```js
if (extendLeft)  { slantA = _extendToEdge(b.x, b.y, a.x, a.y, W, H); hLeft  = 0; }
if (extendRight) { slantB = _extendToEdge(a.x, a.y, b.x, b.y, W, H); hRight = W; }
```

### Yeni:
```js
const INF = 99999;
if (extendLeft)  { slantA = _extendToEdge(b.x, b.y, a.x, a.y, INF, INF); hLeft  = -INF; }
if (extendRight) { slantB = _extendToEdge(a.x, a.y, b.x, b.y, INF, INF); hRight =  INF; }
```

---

## Aynı düzeltmeyi trendline'a da uygula (`_drawTrendLine` fonksiyonu):

Trendline extend de aynı sorunu yaşıyor. Tutarlı olması için:

### Mevcut:
```js
if (extendLeft) drawA = _extendToEdge(b.x, b.y, a.x, a.y, w, h);
if (extendRight) drawB = _extendToEdge(a.x, a.y, b.x, b.y, w, h);
```

### Yeni:
```js
const INF = 99999;
if (extendLeft) drawA = _extendToEdge(b.x, b.y, a.x, a.y, INF, INF);
if (extendRight) drawB = _extendToEdge(a.x, a.y, b.x, b.y, INF, INF);
```

---

Başka hiçbir dosya değişmez. `_extendToEdge` fonksiyonu değişmiyor — sadece çağrı sırasındaki `W/H` sınırları `INF` ile değiştiriliyor.