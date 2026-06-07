# GÖREV: HLine, VLine, HRay, CrossLine — Tamamen Yeniden Yaz

## Proje Bağlamı

İki dosyada değişiklik yapılacak:
- `js/drawing/ui/drawing-trend.js`
- `js/drawing/core/drawing-core.js`

Başka hiçbir dosyaya dokunma.

---

## Değişiklik 1 — `drawing-trend.js` — 4 fonksiyonu tamamen yeniden yaz

**Dosya:** `js/drawing/ui/drawing-trend.js`
**Satır:** ~83

Aşağıdaki 4 fonksiyonu bulup **tamamını** aşağıdaki yeni kodla değiştir.

**ESKİ KOD (83–131 arası, tamamını değiştir):**
```javascript
  function _drawHLine(ctx, d, pane) {
      const y = pane.series.priceToCoordinate(d.price);
      if (y === null) return;
      const w = pane.drawingCanvas.width / (window.devicePixelRatio || 1);
      const s = d.style || {};
      ctx.strokeStyle = s.color || '#2962ff';
      ctx.lineWidth   = s.width || 1;
      let dashArr = s.dash || [];
      if (s.lineStyle === 'dashed') dashArr = [8, 5];
      if (s.lineStyle === 'dotted') dashArr = [3, 3];
      ctx.setLineDash(dashArr);
      if (s.priceLabel) _drawPriceLabel(ctx, d.price, y, pane);
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

  function _drawVLine(ctx, d, pane) {
      const x = _timeToX(pane, d.time);
      if (x === null) return;
      const h = pane.drawingCanvas.height / (window.devicePixelRatio || 1);
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }

  function _drawHRay(ctx, d, pane) {
      const y = pane.series.priceToCoordinate(d.price);
      const x = _timeToX(pane, d.time);
      if (y === null || x === null) return;
      const w = pane.drawingCanvas.width / (window.devicePixelRatio || 1);
      const s = d.style || {};
      ctx.strokeStyle = s.color || '#2962ff';
      ctx.lineWidth   = s.width || 1;
      let dashArr = s.dash || [];
      if (s.lineStyle === 'dashed') dashArr = [8, 5];
      if (s.lineStyle === 'dotted') dashArr = [3, 3];
      ctx.setLineDash(dashArr);
      if (s.priceLabel) _drawPriceLabel(ctx, d.price, y, pane);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(w, y); ctx.stroke();
    }

  function _drawCrossLine(ctx, d, pane) {
      const y = pane.series.priceToCoordinate(d.price);
      const x = _timeToX(pane, d.time);
      if (y === null || x === null) return;
      const w = pane.drawingCanvas.width / (window.devicePixelRatio || 1);
      const h = pane.drawingCanvas.height / (window.devicePixelRatio || 1);
      ctx.beginPath(); 
      ctx.moveTo(0, y); ctx.lineTo(w, y); 
      ctx.moveTo(x, 0); ctx.lineTo(x, h); 
      ctx.stroke();
    }
```

**YENİ KOD:**
```javascript
  function _drawHLine(ctx, d, pane) {
      try {
        if (d.price == null || !isFinite(d.price)) return;
        const y = pane.series.priceToCoordinate(d.price);
        if (y == null || !isFinite(y)) return;
        const w = pane.drawingCanvas.width / (window.devicePixelRatio || 1);
        const s = d.style || {};
        ctx.save();
        ctx.strokeStyle = s.color || '#2962ff';
        ctx.lineWidth   = s.width || 1;
        let dashArr = [];
        if (s.lineStyle === 'dashed') dashArr = [8, 5];
        else if (s.lineStyle === 'dotted') dashArr = [3, 3];
        ctx.setLineDash(dashArr);
        if (s.priceLabel) _drawPriceLabel(ctx, d.price, y, pane);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
        ctx.restore();
      } catch(e) { /* render hatası diğer çizimleri etkilemesin */ }
    }

  function _drawVLine(ctx, d, pane) {
      try {
        if (d.time == null) return;
        const x = _timeToX(pane, d.time);
        if (x == null || !isFinite(x)) return;
        const h = pane.drawingCanvas.height / (window.devicePixelRatio || 1);
        const s = d.style || {};
        ctx.save();
        ctx.strokeStyle = s.color || '#2962ff';
        ctx.lineWidth   = s.width || 1;
        let dashArr = [];
        if (s.lineStyle === 'dashed') dashArr = [8, 5];
        else if (s.lineStyle === 'dotted') dashArr = [3, 3];
        ctx.setLineDash(dashArr);
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
        ctx.restore();
      } catch(e) { /* render hatası diğer çizimleri etkilemesin */ }
    }

  function _drawHRay(ctx, d, pane) {
      try {
        if (d.price == null || !isFinite(d.price)) return;
        if (d.time == null) return;
        const y = pane.series.priceToCoordinate(d.price);
        const x = _timeToX(pane, d.time);
        if (y == null || !isFinite(y) || x == null || !isFinite(x)) return;
        const w = pane.drawingCanvas.width / (window.devicePixelRatio || 1);
        const s = d.style || {};
        ctx.save();
        ctx.strokeStyle = s.color || '#2962ff';
        ctx.lineWidth   = s.width || 1;
        let dashArr = [];
        if (s.lineStyle === 'dashed') dashArr = [8, 5];
        else if (s.lineStyle === 'dotted') dashArr = [3, 3];
        ctx.setLineDash(dashArr);
        if (s.priceLabel) _drawPriceLabel(ctx, d.price, y, pane);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(w, y);
        ctx.stroke();
        ctx.restore();
      } catch(e) { /* render hatası diğer çizimleri etkilemesin */ }
    }

  function _drawCrossLine(ctx, d, pane) {
      try {
        if (d.price == null || !isFinite(d.price)) return;
        if (d.time == null) return;
        const y = pane.series.priceToCoordinate(d.price);
        const x = _timeToX(pane, d.time);
        if (y == null || !isFinite(y) || x == null || !isFinite(x)) return;
        const w = pane.drawingCanvas.width / (window.devicePixelRatio || 1);
        const h = pane.drawingCanvas.height / (window.devicePixelRatio || 1);
        const s = d.style || {};
        ctx.save();
        ctx.strokeStyle = s.color || '#2962ff';
        ctx.lineWidth   = s.width || 1;
        let dashArr = [];
        if (s.lineStyle === 'dashed') dashArr = [8, 5];
        else if (s.lineStyle === 'dotted') dashArr = [3, 3];
        ctx.setLineDash(dashArr);
        ctx.beginPath();
        ctx.moveTo(0, y); ctx.lineTo(w, y);
        ctx.moveTo(x, 0); ctx.lineTo(x, h);
        ctx.stroke();
        ctx.restore();
      } catch(e) { /* render hatası diğer çizimleri etkilemesin */ }
    }
```

---

## Değişiklik 2 — `drawing-core.js` — hit-test'e null guard ekle

**Dosya:** `js/drawing/core/drawing-core.js`
**Satır:** ~2131

**ESKİ KOD:**
```javascript
    if (d.tool === 'hline' || d.tool === 'crossline' || d.tool === 'hray') {
      const ly = pane.series.priceToCoordinate(d.price);
      if (ly !== null && Math.abs(y - ly) <= tolerance) {
        if (d.tool === 'hray') {
          const lx = _timeToX(pane, d.time);
          if (lx !== null && x >= lx - tolerance) return 'line';
        } else {
          return 'line';
        }
      }
    }

    if (d.tool === 'vline' || d.tool === 'crossline') {
      const lx = _timeToX(pane, d.time);
      if (lx !== null && Math.abs(x - lx) <= tolerance) return 'line';
    }
```

**YENİ KOD:**
```javascript
    if (d.tool === 'hline' || d.tool === 'crossline' || d.tool === 'hray') {
      if (d.price != null && isFinite(d.price)) {
        const ly = pane.series.priceToCoordinate(d.price);
        if (ly != null && isFinite(ly) && Math.abs(y - ly) <= tolerance) {
          if (d.tool === 'hray') {
            if (d.time != null) {
              const lx = _timeToX(pane, d.time);
              if (lx != null && isFinite(lx) && x >= lx - tolerance) return 'line';
            }
          } else {
            return 'line';
          }
        }
      }
    }

    if (d.tool === 'vline' || d.tool === 'crossline') {
      if (d.time != null) {
        const lx = _timeToX(pane, d.time);
        if (lx != null && isFinite(lx) && Math.abs(x - lx) <= tolerance) return 'line';
      }
    }
```

---

## Değişiklik 3 — `drawing-core.js` — creation'a null guard ekle

**Dosya:** `js/drawing/core/drawing-core.js`
**Satır:** ~197

**ESKİ KOD:**
```javascript
    if (_activeTool === 'hline') {
      _finishDrawing(pane.symbol, { tool: 'hline', price, id: _uid(), style: _getToolStyle('hline') });
      _lastPointerdownClaimed = true;
      return true;
    }
    if (_activeTool === 'vline') {
      _finishDrawing(pane.symbol, { tool: 'vline', time, id: _uid(), style: _getToolStyle('vline') });
      _lastPointerdownClaimed = true;
      return true;
    }
    if (_activeTool === 'hray') {
      _finishDrawing(pane.symbol, { tool: 'hray', price, time, p1: { time, price }, id: _uid(), style: _getToolStyle('hray') });
      _lastPointerdownClaimed = true;
      return true;
    }
    if (_activeTool === 'crossline') {
      _finishDrawing(pane.symbol, { tool: 'crossline', price, time, id: _uid(), style: _getToolStyle('crossline') });
      _lastPointerdownClaimed = true;
      return true;
    }
```

**YENİ KOD:**
```javascript
    if (_activeTool === 'hline') {
      if (price == null || !isFinite(price)) return false;
      _finishDrawing(pane.symbol, { tool: 'hline', price, id: _uid(), style: _getToolStyle('hline') });
      _lastPointerdownClaimed = true;
      return true;
    }
    if (_activeTool === 'vline') {
      if (time == null) return false;
      _finishDrawing(pane.symbol, { tool: 'vline', time, id: _uid(), style: _getToolStyle('vline') });
      _lastPointerdownClaimed = true;
      return true;
    }
    if (_activeTool === 'hray') {
      if (price == null || !isFinite(price) || time == null) return false;
      _finishDrawing(pane.symbol, { tool: 'hray', price, time, p1: { time, price }, id: _uid(), style: _getToolStyle('hray') });
      _lastPointerdownClaimed = true;
      return true;
    }
    if (_activeTool === 'crossline') {
      if (price == null || !isFinite(price) || time == null) return false;
      _finishDrawing(pane.symbol, { tool: 'crossline', price, time, id: _uid(), style: _getToolStyle('crossline') });
      _lastPointerdownClaimed = true;
      return true;
    }
```

---

## Özet Tablo

| # | Dosya | Satır | Değişiklik |
|---|-------|-------|------------|
| 1 | `drawing-trend.js` | ~83 | 4 fonksiyon tamamen yeniden yazıldı — try-catch, null/isFinite guard, style, ctx.save/restore |
| 2 | `drawing-core.js` | ~2131 | hit-test'e null/isFinite guard eklendi |
| 3 | `drawing-core.js` | ~197 | creation'a null/isFinite guard eklendi |

---

## Kesinlikle Yapılmayacaklar

- Başka hiçbir fonksiyona **dokunma**
- `trendline`, `ray`, `extended` araçlarına **dokunma**

---

## Test Adımları

1. Sayfa yüklendiğinde eski state'teki hline/vline/hray/crossline çizimleri chart'ı kilitlemeden gösterilmeli ✅
2. **HLine** çiz → renk, kalınlık, dash settings'ten değişmeli ✅
3. **VLine** çiz → renk, kalınlık, dash settings'ten değişmeli ✅
4. **HRay** çiz → F5 sonrası kaybolmamalı ✅
5. **CrossLine** çiz → sürükle → hem yatay hem dikey hareket etmeli ✅
6. 4 araç çiziliyken diğer tüm araçlar normal çalışmaya devam etmeli ✅
