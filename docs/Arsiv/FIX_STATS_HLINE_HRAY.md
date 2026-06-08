# GÖREV: Stats On/Off Düzeltmesi + HLine/HRay Sorunları

## Proje Bağlamı

Değişiklik yapılacak dosyalar:
- `js/drawing/ui/drawing-trend.js`
- `js/drawing/core/drawing-core.js`

Başka hiçbir dosyaya dokunma.

---

## Değişiklik 1 — `drawing-trend.js` — Stats default gizli, statsOn true ise göster

**Dosya:** `js/drawing/ui/drawing-trend.js`
**Satır:** ~195

**ESKİ KOD:**
```javascript
      if (s.statsOn === false) return;
```

**YENİ KOD:**
```javascript
      if (s.statsOn !== true) return;
```

---

## Değişiklik 2 — `drawing-trend.js` — `_drawTrendLine` stats çağrısına statsOn kontrolü ekle

**Dosya:** `js/drawing/ui/drawing-trend.js`
**Satır:** ~476

**ESKİ KOD:**
```javascript
      if (selected || !!s.alwaysStats) {
        _drawTrendStats(ctx, d, pane, a, b);
      }
```

**YENİ KOD:**
```javascript
      if (s.statsOn === true && (selected || !!s.alwaysStats)) {
        _drawTrendStats(ctx, d, pane, a, b);
      }
```

---

## Değişiklik 3 — `drawing-trend.js` — `_drawTrendAngle` stats çağrısına statsOn kontrolü ekle

**Dosya:** `js/drawing/ui/drawing-trend.js`
**Satır:** ~188

**ESKİ KOD:**
```javascript
      if (selected || !!d.style?.alwaysStats) {
        _drawTrendStats(ctx, d, pane, a, b);
      }
```

**YENİ KOD:**
```javascript
      if (d.style?.statsOn === true && (selected || !!d.style?.alwaysStats)) {
        _drawTrendStats(ctx, d, pane, a, b);
      }
```

---

## Değişiklik 4 — `drawing-trend.js` — `_drawHLine` style uygulansın

**Dosya:** `js/drawing/ui/drawing-trend.js`
**Satır:** ~83

**ESKİ KOD:**
```javascript
  function _drawHLine(ctx, d, pane) {
      const y = pane.series.priceToCoordinate(d.price);
      if (y === null) return;
      const w = pane.drawingCanvas.width / (window.devicePixelRatio || 1);
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
```

**YENİ KOD:**
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
```

---

## Değişiklik 5 — `drawing-trend.js` — `_drawHRay` style uygulansın

**Dosya:** `js/drawing/ui/drawing-trend.js`
**Satır:** ~97

**ESKİ KOD:**
```javascript
  function _drawHRay(ctx, d, pane) {
      const y = pane.series.priceToCoordinate(d.price);
      const x = _timeToX(pane, d.time);
      if (y === null || x === null) return;
      const w = pane.drawingCanvas.width / (window.devicePixelRatio || 1);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(w, y); ctx.stroke();
    }
```

**YENİ KOD:**
```javascript
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
```

---

## Değişiklik 6 — `drawing-core.js` — HRay F5 sonrası kaybolma sorunu

**Dosya:** `js/drawing/core/drawing-core.js`
**Satır:** ~208

HRay `price` ve `time` ile kaydediliyor ama `p1` objesi yok. Hit-test ve state restore `p1` bekliyor olabilir. `p1` ekle:

**ESKİ KOD:**
```javascript
    if (_activeTool === 'hray') {
      _finishDrawing(pane.symbol, { tool: 'hray', price, time, id: _uid(), style: _getToolStyle('hray') });
      _lastPointerdownClaimed = true;
      return true;
    }
```

**YENİ KOD:**
```javascript
    if (_activeTool === 'hray') {
      _finishDrawing(pane.symbol, { tool: 'hray', price, time, p1: { time, price }, id: _uid(), style: _getToolStyle('hray') });
      _lastPointerdownClaimed = true;
      return true;
    }
```

---

## Özet Tablo

| # | Dosya | Satır | Değişiklik |
|---|-------|-------|------------|
| 1 | `drawing-trend.js` | ~195 | `statsOn !== true` → default gizli |
| 2 | `drawing-trend.js` | ~476 | `_drawTrendLine` stats çağrısına `statsOn === true` koşulu |
| 3 | `drawing-trend.js` | ~188 | `_drawTrendAngle` stats çağrısına `statsOn === true` koşulu |
| 4 | `drawing-trend.js` | ~83 | `_drawHLine` style, renk, dash, priceLabel uygulandı |
| 5 | `drawing-trend.js` | ~97 | `_drawHRay` style, renk, dash, priceLabel uygulandı |
| 6 | `drawing-core.js` | ~208 | `hray` kaydına `p1` objesi eklendi |

---

## Kesinlikle Yapılmayacaklar

- `_drawTrendStats` fonksiyonunun içine **dokunma**
- `infoline` aracına **dokunma** — zaten `statsOn:true` default olarak set ediliyor
- Başka hiçbir araca **dokunma**

---

## Test Adımları

1. **TrendLine** çiz → seç → stats kutusu görünmemeli ❌ (statsOn default false)
2. Settings → Stats on/off aç → stats kutusu görünmeli ✅
3. Settings → Stats on/off kapat → stats kutusu kaybolmalı ✅
4. **HLine** çiz → renk, kalınlık, dash ayarları uygulanmalı ✅
5. **HRay** çiz → F5 sonrası kaybolmamalı ✅
6. Sidebar'daki "Remove objects" butonu ile silinebilmeli ✅
7. **InfoLine** → stats default açık, davranış değişmemeli ✅
