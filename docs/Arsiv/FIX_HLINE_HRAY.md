# GÖREV: HLine ve HRay Sorunlarını Düzelt

## Proje Bağlamı

Tek dosyada değişiklik yapılacak:
- `js/drawing/core/drawing-core.js`

Başka hiçbir dosyaya dokunma.

---

## Sorunların Özeti

1. **HLine** hiç çalışmıyor — style `_lastDrawingStyle` ile kaydediliyor, `_getToolStyle('hline')` olmalı
2. **HRay** drag (taşıma) sırasında `price` ve `time` güncellemiyor — `hray` için özel drag handler yok
3. **HRay** seçilip grafiğe tıklanınca tüm araçlar çalışmaz hale geliyor — `origPrice` ve `origTime` dragState'e kaydedilmiyor

---

## Değişiklik 1 — `drawing-core.js` — HLine style düzeltmesi

**Dosya:** `js/drawing/core/drawing-core.js`
**Satır:** ~199

**ESKİ KOD:**
```javascript
    if (_activeTool === 'hline') {
      _finishDrawing(pane.symbol, { tool: 'hline', price, id: _uid(), style: { ..._lastDrawingStyle } });
      _lastPointerdownClaimed = true;
      return true;
    }
```

**YENİ KOD:**
```javascript
    if (_activeTool === 'hline') {
      _finishDrawing(pane.symbol, { tool: 'hline', price, id: _uid(), style: _getToolStyle('hline') });
      _lastPointerdownClaimed = true;
      return true;
    }
```

---

## Değişiklik 2 — `drawing-core.js` — HRay drag handler ekle

**Dosya:** `js/drawing/core/drawing-core.js`
**Satır:** ~595

**ESKİ KOD:**
```javascript
            if (d.tool === 'hline') {
              const origY = pane.series.priceToCoordinate(_dragState.origPrice);
              d.price = pane.series.coordinateToPrice(origY + dy);
            } else if (d.tool === 'vline') {
```

**YENİ KOD:**
```javascript
            if (d.tool === 'hline') {
              const origY = pane.series.priceToCoordinate(_dragState.origPrice);
              d.price = pane.series.coordinateToPrice(origY + dy);
            } else if (d.tool === 'hray') {
              const origY = pane.series.priceToCoordinate(_dragState.origPrice);
              const origX = _timeToX(pane, _dragState.origTime);
              d.price = pane.series.coordinateToPrice(origY + dy);
              d.time  = pane.chart.timeScale().coordinateToTime(origX + dx);
              if (d.p1) {
                d.p1.price = d.price;
                d.p1.time  = d.time;
              }
            } else if (d.tool === 'vline') {
```

---

## Özet Tablo

| # | Dosya | Satır | Değişiklik |
|---|-------|-------|------------|
| 1 | `drawing-core.js` | ~199 | `hline` style `_getToolStyle` ile kaydediliyor |
| 2 | `drawing-core.js` | ~595 | `hray` için drag handler eklendi |

---

## Kesinlikle Yapılmayacaklar

- `drawing-trend.js` dosyasına **dokunma**
- `vline`, `crossline` araçlarına **dokunma**
- Başka hiçbir araca **dokunma**

---

## Test Adımları

1. **HLine** çiz → renk, kalınlık settings'ten değişmeli ✅
2. **HLine** çiz → sürükle → doğru hareket etmeli ✅
3. **HRay** çiz → F5 sonrası kaybolmamalı ✅
4. **HRay** seç → sürükle → hem yatay hem dikey hareket etmeli ✅
5. **HRay** çizdikten sonra diğer araçlar çalışmaya devam etmeli ✅
6. Sidebar "Remove objects" → hline ve hray silinmeli ✅
