# Regression Trend — Hit Test, Cursor ve Drag

## Mantık

- `reg_p1` / `reg_p2` → anchor noktaları (center line'ın başı ve sonu) → cursor: `'default'` (ok)
- `reg_body` → center/upper/lower band'a yakın → cursor: `'grab'` (hand)
- Anchor sürüklenince sadece time değişir (regression yeniden hesaplanır)
- Body sürüklenince p1+p2 birlikte taşınır (sadece time ekseni — fiyat ekseninde kaymaz)

---

## 1. `drawing-core.js` — `_hitTest` içinde regression'a özel blok ekle

Şu an regression genel trendline bloğuna düşüyor ve `'line'` dönüyor.
Genel bloktaki liste içinden `'regression'` kaldır, yerine özel blok ekle.

### 1a. Genel trendline listesinden regression çıkar

**ESKİ (satır ~2213):**
```js
    if (d.p1 && d.p2 && ['trendline', 'ray', 'extended', 'arrowdraw', 'trendangle', 'infoline', 'flattopbottom', 'regression', 'fib-ret',
```

**YENİ:**
```js
    if (d.p1 && d.p2 && ['trendline', 'ray', 'extended', 'arrowdraw', 'trendangle', 'infoline', 'flattopbottom', 'fib-ret',
```

### 1b. Genel body/line listesinden regression çıkar (satır ~2501)

**ESKİ:**
```js
    if (['trendline', 'ray', 'extended', 'channel', 'arrowdraw', 'trendangle', 'infoline', 'flattopbottom', 'regression', 'fib-ret',
```

**YENİ:**
```js
    if (['trendline', 'ray', 'extended', 'channel', 'arrowdraw', 'trendangle', 'infoline', 'flattopbottom', 'fib-ret',
```

### 1c. Regression için özel _hitTest bloğu ekle

Bu bloğu `_hitTest` fonksiyonu içinde, genel trendline p1/p2 bloğunun hemen **altına** ekle:

```js
    // ── Regression Trend özel hit test ───────────────
    if (d.tool === 'regression' && d.p1 && d.p2) {
      const candles = pane.candlesData;
      if (!candles || candles.length < 3) return false;

      const toSec = t => typeof t === 'object'
        ? new Date(t.year, t.month - 1, t.day, t.hour || 0, t.minute || 0).getTime() / 1000 : t;

      const tMin = Math.min(toSec(d.p1.time), toSec(d.p2.time));
      const tMax = Math.max(toSec(d.p1.time), toSec(d.p2.time));
      const inRange = candles.filter(c => { const ct = toSec(c.time); return ct >= tMin && ct <= tMax; });
      if (inRange.length < 3) return false;

      const s = d.style || {};
      const src = s.source || 'close';
      const getPrice = c => {
        if (src === 'open')  return c.open;
        if (src === 'high')  return c.high;
        if (src === 'low')   return c.low;
        if (src === 'hl2')   return (c.high + c.low) / 2;
        if (src === 'hlc3')  return (c.high + c.low + c.close) / 3;
        if (src === 'ohlc4') return (c.open + c.high + c.low + c.close) / 4;
        return c.close;
      };

      const n = inRange.length;
      let sx = 0, sy = 0, sxy = 0, sx2 = 0;
      inRange.forEach((c, i) => { const p = getPrice(c); sx += i; sy += p; sxy += i * p; sx2 += i * i; });
      const denom = n * sx2 - sx * sx;
      if (denom === 0) return false;
      const slope     = (n * sxy - sx * sy) / denom;
      const intercept = (sy - slope * sx) / n;

      let sqDev = 0;
      inRange.forEach((c, i) => { const res = getPrice(c) - (slope * i + intercept); sqDev += res * res; });
      const stdDev = Math.sqrt(sqDev / (n - 2));

      // Anchor noktaları: center line'ın başı (i=0) ve sonu (i=n-1)
      const p1cx  = _timeToX(pane, inRange[0].time);
      const p1reg = slope * 0 + intercept;
      const p1cy  = pane.series.priceToCoordinate(p1reg);

      const p2cx  = _timeToX(pane, inRange[n - 1].time);
      const p2reg = slope * (n - 1) + intercept;
      const p2cy  = pane.series.priceToCoordinate(p2reg);

      if (p1cx != null && p1cy != null && Math.hypot(x - p1cx, y - p1cy) <= tolerance * 1.5) return 'reg_p1';
      if (p2cx != null && p2cy != null && Math.hypot(x - p2cx, y - p2cy) <= tolerance * 1.5) return 'reg_p2';

      // Çizgi hit: center, upper, lower band'ların herhangi birine yakın mı
      const upperDev = s.upperDev ?? 2;
      const lowerDev = s.lowerDev ?? 2;
      const useUpper = s.useUpperDev !== false;
      const useLower = s.useLowerDev !== false;

      const points = inRange.map((c, i) => {
        const cx = _timeToX(pane, c.time);
        const regPrice = slope * i + intercept;
        return { cx, regPrice };
      }).filter(p => p.cx != null && isFinite(p.cx));

      for (let i = 0; i < points.length - 1; i++) {
        const pa = points[i], pb = points[i + 1];

        // Center line
        const cya = pane.series.priceToCoordinate(pa.regPrice);
        const cyb = pane.series.priceToCoordinate(pb.regPrice);
        if (cya != null && cyb != null && _distToSegment(x, y, pa.cx, cya, pb.cx, cyb) <= tolerance) return 'reg_body';

        // Upper band
        if (useUpper) {
          const uya = pane.series.priceToCoordinate(pa.regPrice + upperDev * stdDev);
          const uyb = pane.series.priceToCoordinate(pb.regPrice + upperDev * stdDev);
          if (uya != null && uyb != null && _distToSegment(x, y, pa.cx, uya, pb.cx, uyb) <= tolerance) return 'reg_body';
        }

        // Lower band
        if (useLower) {
          const lya = pane.series.priceToCoordinate(pa.regPrice - lowerDev * stdDev);
          const lyb = pane.series.priceToCoordinate(pb.regPrice - lowerDev * stdDev);
          if (lya != null && lyb != null && _distToSegment(x, y, pa.cx, lya, pb.cx, lyb) <= tolerance) return 'reg_body';
        }
      }

      return false;
    }
```

---

## 2. `drawing-core.js` — Cursor bloğuna reg_p1/reg_p2/reg_body ekle

**ESKİ (satır ~826):**
```js
          if (ht === 'line' || ht === 'body' || ht === 'rect_body' || ht === 'midpoint' || ht === 'vline_midpoint') {
```

**YENİ:**
```js
          if (ht === 'line' || ht === 'body' || ht === 'rect_body' || ht === 'midpoint' || ht === 'vline_midpoint' || ht === 'reg_body') {
```

Aynı cursor bloğunda `p1/p2/p3` dalına regression anchor ekle:

**ESKİ:**
```js
          } else if (ht === 'p1' || ht === 'p2' || ht === 'p3') {
            if (tool === 'rotatedrect' && (ht === 'p1' || ht === 'p2')) {
              pane.cvs.style.cursor = 'default';
            } else if (ht === 'p1' && ['note', 'callout', 'pricenote'].includes(tool)) {
              pane.cvs.style.cursor = 'default';
            } else if (tool === 'regression') {
              pane.cvs.style.cursor = 'default';
            } else {
              pane.cvs.style.cursor = 'pointer';
            }
```

**YENİ:**
```js
          } else if (ht === 'reg_p1' || ht === 'reg_p2') {
            pane.cvs.style.cursor = 'default';
          } else if (ht === 'p1' || ht === 'p2' || ht === 'p3') {
            if (tool === 'rotatedrect' && (ht === 'p1' || ht === 'p2')) {
              pane.cvs.style.cursor = 'default';
            } else if (ht === 'p1' && ['note', 'callout', 'pricenote'].includes(tool)) {
              pane.cvs.style.cursor = 'default';
            } else {
              pane.cvs.style.cursor = 'pointer';
            }
```

---

## 3. `drawing-core.js` — Drag bloğuna reg_p1/reg_p2/reg_body ekle

`_dragState.hitType === 'hray_p1'` bloğunun hemen **altına** ekle:

```js
        } else if (_dragState.hitType === 'reg_p1') {
          // Sol anchor: sadece time değişir
          const { time } = _snapToCandle(pane, rawTime, rawPrice);
          d.p1 = { time, price: d.p1.price };

        } else if (_dragState.hitType === 'reg_p2') {
          // Sağ anchor: sadece time değişir
          const { time } = _snapToCandle(pane, rawTime, rawPrice);
          d.p2 = { time, price: d.p2.price };

        } else if (_dragState.hitType === 'reg_body') {
          // Tüm araç kayar: p1 ve p2 time+price birlikte
          if (d.p1 && _dragState.origP1) {
            const origP1X = _timeToX(pane, _dragState.origP1.time);
            const origP1Y = pane.series.priceToCoordinate(_dragState.origP1.price);
            d.p1.time  = pane.chart.timeScale().coordinateToTime(origP1X + dx);
            d.p1.price = pane.series.coordinateToPrice(origP1Y + dy);
          }
          if (d.p2 && _dragState.origP2) {
            const origP2X = _timeToX(pane, _dragState.origP2.time);
            const origP2Y = pane.series.priceToCoordinate(_dragState.origP2.price);
            d.p2.time  = pane.chart.timeScale().coordinateToTime(origP2X + dx);
            d.p2.price = pane.series.coordinateToPrice(origP2Y + dy);
          }
```

---

## Özet

| Dosya | Değişiklik |
|---|---|
| `drawing-core.js` | 1a: genel trendline listesinden regression çıkar |
| `drawing-core.js` | 1b: genel body/line listesinden regression çıkar |
| `drawing-core.js` | 1c: özel regression hit test bloğu ekle |
| `drawing-core.js` | 2: cursor bloğuna reg_body + reg_p1/reg_p2 ekle |
| `drawing-core.js` | 3: drag bloğuna reg_p1/reg_p2/reg_body ekle |
