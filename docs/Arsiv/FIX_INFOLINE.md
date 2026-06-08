# GÖREV: InfoLine Aracını TrendLine ile Birebir Hizala

## Proje Bağlamı

3 dosyada değişiklik yapılacak:
- `js/drawing/ui/drawing-trend.js`
- `js/drawing/core/drawing-core.js`
- `js/drawing/ui/drawing-settings-dialog.js`

Başka hiçbir dosyaya dokunma.

---

## Sorunun Tam Nedeni

`infoline` aracı şu an kendi içinde hardcoded bir stat kutusu çiziyor.
TrendLine'daki `_drawTrendStats` sistemini kullanmıyor, `selected` parametresi almıyor,
`statsOn` / `alwaysStats` flag'lerine bakmıyor.

Hedef: InfoLine = TrendLine ile birebir aynı davranış.
Tek fark: `statsOn` ve `alwaysStats` default olarak `true` gelsin.

---

## Değişiklik 1 — `drawing-trend.js` — `_drawInfoLine` tamamen yeniden yaz

**Dosya:** `js/drawing/ui/drawing-trend.js`
**Satır:** ~509

**ESKİ KOD:**
```javascript
  function _drawInfoLine(ctx, d, pane) {
      const a = _pt2xy(d.p1, pane);
      const b = _pt2xy(d.p2, pane);
      if (!a || !b) return;
  
      // Draw the base line
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  
      // Stats calculation
      const priceDiff = d.p2.price - d.p1.price;
      const pricePct  = d.p1.price ? (priceDiff / d.p1.price) * 100 : 0;
      const sign      = priceDiff >= 0 ? '+' : '';
      const angleRad  = Math.atan2(-(b.y - a.y), b.x - a.x);
      const angleDeg  = (angleRad * 180 / Math.PI).toFixed(1);
  
      // Count bars in range
      let barCount = 0;
      const candles = pane.candlesData;
      if (candles && candles.length) {
        const toSec = t => typeof t === 'object'
          ? new Date(t.year, t.month - 1, t.day).getTime() / 1000 : t;
        const tMin = Math.min(toSec(d.p1.time), toSec(d.p2.time));
        const tMax = Math.max(toSec(d.p1.time), toSec(d.p2.time));
        barCount = candles.filter(c => { const ct = toSec(c.time); return ct >= tMin && ct <= tMax; }).length;
      }
  
      const color = d.style?.color || '#2962ff';
      const upColor   = '#26a69a';
      const downColor = '#ef5350';
      const lineColor = priceDiff >= 0 ? upColor : downColor;
  
      // Stat box position: just above midpoint
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      ctx.save();
      ctx.setLineDash([]);
      ctx.font = '11px "JetBrains Mono", monospace';
      const lines = [
        `${sign}${priceDiff.toFixed(2)}  ${sign}${pricePct.toFixed(2)}%`,
        `${barCount} bars  ${angleDeg}°`
      ];
      const pad = 7, lh = 16;
      const maxW = Math.max(...lines.map(l => ctx.measureText(l).width));
      const bw = maxW + pad * 2, bh = lines.length * lh + pad * 2;
      const bx = mx - bw / 2, by = my - bh - 10;
  
      // Background
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = '#1e222d';
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(bx, by, bw, bh, 4);
      else ctx.rect(bx, by, bw, bh);
      ctx.fill(); ctx.stroke();
  
      // Text
      ctx.globalAlpha = 1;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillStyle = lineColor;
      ctx.fillText(lines[0], bx + pad, by + pad);
      ctx.fillStyle = '#d1d4dc';
      ctx.fillText(lines[1], bx + pad, by + pad + lh);
      ctx.restore();
    }
```

**YENİ KOD:**
```javascript
  function _drawInfoLine(ctx, d, pane, selected) {
      d.style = d.style || {};
      if (d.style.statsOn === undefined) d.style.statsOn = true;
      if (d.style.alwaysStats === undefined) d.style.alwaysStats = true;
      _drawTrendLine(ctx, d, pane, selected);
    }
```

---

## Değişiklik 2 — `drawing-core.js` — `drawInfoLine` çağrısına `selected` ekle

**Dosya:** `js/drawing/core/drawing-core.js`
**Satır:** ~1488

**ESKİ KOD:**
```javascript
    if (d.tool === 'infoline') window.DrawingTrend.drawInfoLine(ctx, d, pane);
```

**YENİ KOD:**
```javascript
    if (d.tool === 'infoline') window.DrawingTrend.drawInfoLine(ctx, d, pane, selected);
```

---

## Değişiklik 3 — `drawing-settings-dialog.js` — `infoline` caps'ını TrendLine ile hizala

**Dosya:** `js/drawing/ui/drawing-settings-dialog.js`
**Satır:** ~83

**ESKİ KOD:**
```javascript
    infoline:     { priceLabel:true,  extend:true,  midpoint:true,  stats:true,  capArrows:false, hasFill:false, coordsMode:'p2'       },
```

**YENİ KOD:**
```javascript
    infoline:     { priceLabel:true,  extend:true,  midpoint:true,  stats:true,  capArrows:true,  hasFill:false, hasText:true, coordsMode:'p2' },
```

**Ne değişti:** `capArrows:true` ve `hasText:true` eklendi — TrendLine caps'ı ile birebir hizalandı.

---

## Özet Tablo

| # | Dosya | Satır | Değişiklik |
|---|-------|-------|------------|
| 1 | `drawing-trend.js` | ~509 | `_drawInfoLine` hardcoded kutu kaldırıldı, `_drawTrendLine`'a delegate edildi, default `statsOn` ve `alwaysStats` true |
| 2 | `drawing-core.js` | ~1488 | `drawInfoLine` çağrısına `selected` eklendi |
| 3 | `drawing-settings-dialog.js` | ~83 | `infoline` caps'ına `capArrows:true` ve `hasText:true` eklendi |

---

## Kesinlikle Yapılmayacaklar

- `_drawTrendLine`, `_drawTrendStats` fonksiyonlarına **dokunma**
- `trendline`, `ray`, `extended` araçlarına **dokunma**
- Başka hiçbir araca **dokunma**

---

## Test Adımları

1. Sayfayı yenile
2. InfoLine aracını seç ve bir çizgi çiz
3. Çizgi çizilirken stat kutusu görünüyor mu? ✅ (alwaysStats:true olduğu için)
4. Çizgiyi seç — stat kutusu görünüyor mu? ✅
5. Çizginin seçimini kaldır — stat kutusu hâlâ görünüyor mu? ✅ (alwaysStats:true)
6. Settings'te Text sekmesi var mı? ✅
7. Settings'te cap arrows (ok uçları) var mı? ✅
8. TrendLine aracını seç — hiçbir şeyi değişmemiş olmalı ✅
