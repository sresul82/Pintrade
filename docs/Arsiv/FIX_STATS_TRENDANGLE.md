# GÖREV: Stats Sistemi Düzeltmesi — 4 Dosya, 5 Değişiklik

## Kesinlikle Yapılmayacaklar
- Belirtilen satırların dışına **dokunma**
- Başka hiçbir fonksiyona, araca, stile **dokunma**
- Açıklama ekleme, yorum satırı değiştirme

---

## Değişiklik 1 — `js/drawing/ui/drawing-trend.js`
**Satır ~149** — `_drawTrendAngle` fonksiyon imzası ve `_drawTrendLine` çağrısı

**ESKİ:**
```javascript
function _drawTrendAngle(ctx, d, pane) {
    _drawTrendLine(ctx, d, pane);
```

**YENİ:**
```javascript
function _drawTrendAngle(ctx, d, pane, selected) {
    _drawTrendLine(ctx, d, pane, selected);
```

---

## Değişiklik 2 — `js/drawing/ui/drawing-trend.js`
**Satır ~185** — `_drawTrendAngle` fonksiyonu içinde, `ctx.fillText(...)` ve `ctx.restore()` arasına stats çağrısı ekle

**ESKİ:**
```javascript
      ctx.fillText(`${angleDeg}°`, tx, ty);
      ctx.restore();
    }
```

**YENİ:**
```javascript
      ctx.fillText(`${angleDeg}°`, tx, ty);
      ctx.restore();

      if (selected || !!d.style?.alwaysStats) {
        _drawTrendStats(ctx, d, pane, a, b);
      }
    }
```

---

## Değişiklik 3 — `js/drawing/ui/drawing-trend.js`
**Satır ~192** — `_drawTrendStats` fonksiyonu içinde

**ESKİ:**
```javascript
const activeStats = s.statsFields || [];
```

**YENİ:**
```javascript
const ALL_STAT_FIELDS = ['Price range','Percent change','Bars range','Date/time range','Angle'];
const activeStats = s.statsFields ?? ALL_STAT_FIELDS;
```

---

## Değişiklik 4 — `js/drawing/core/drawing-core.js`
**Satır ~1486**

**ESKİ:**
```javascript
if (d.tool === 'trendangle') window.DrawingTrend.drawTrendAngle(ctx, d, pane);
```

**YENİ:**
```javascript
if (d.tool === 'trendangle') window.DrawingTrend.drawTrendAngle(ctx, d, pane, selected);
```

---

## Değişiklik 5 — `js/drawing/ui/dsd-standard-tabs.js`
**Satır ~26**

**ESKİ:**
```javascript
const activeStats = s.statsFields || [];
```

**YENİ:**
```javascript
const ALL_STAT_FIELDS = ['Price range','Percent change','Bars range','Date/time range','Angle'];
const activeStats = s.statsFields ?? ALL_STAT_FIELDS;
```

---

## Değişiklik 6 — `js/drawing/ui/dsd-standard-tabs.js`
**Satır ~208**

**ESKİ:**
```javascript
<input type="checkbox" id="dsd-stats-on" ${s.statsOn !== false ? 'checked' : ''}>
```

**YENİ:**
```javascript
<input type="checkbox" id="dsd-stats-on" ${s.statsOn === true ? 'checked' : ''}>
```

---

## Değişiklik 7 — `js/drawing/ui/drawing-settings-dialog.js`
**Satır ~916** — `statsBody` bloğunun kapandığı `}` satırından hemen sonra, yeni event binding'ler ekle

**ESKİ:**
```javascript
    }
  }

    // Bold / Italic from Text tab
```

**YENİ:**
```javascript
    }

    // Stats on/off checkbox
    const statsOnCb = overlay.querySelector('#dsd-stats-on');
    if (statsOnCb) {
      statsOnCb.addEventListener('change', () => {
        drawing.style = drawing.style || {};
        drawing.style.statsOn = statsOnCb.checked;
        EventBus.emit('drawing:settings:saved');
      });
    }

    // Always show checkbox
    const alwaysStatsCb = overlay.querySelector('#dsd-alwaysstats');
    if (alwaysStatsCb) {
      alwaysStatsCb.addEventListener('change', () => {
        drawing.style = drawing.style || {};
        drawing.style.alwaysStats = alwaysStatsCb.checked;
        EventBus.emit('drawing:settings:saved');
      });
    }
  }

    // Bold / Italic from Text tab
```

---

## Özet Tablo

| # | Dosya | Satır | Ne Değişti |
|---|-------|-------|------------|
| 1 | `drawing-trend.js` | ~149 | `_drawTrendAngle` `selected` parametresi aldı, `_drawTrendLine`'a geçirildi |
| 2 | `drawing-trend.js` | ~185 | `_drawTrendAngle` içine stats çağrısı eklendi |
| 3 | `drawing-trend.js` | ~192 | `_drawTrendStats` default statsFields tüm alanlar oldu |
| 4 | `drawing-core.js` | ~1486 | `drawTrendAngle` çağrısına `selected` geçirildi |
| 5 | `dsd-standard-tabs.js` | ~26 | `activeStats` default tüm alanlar oldu |
| 6 | `dsd-standard-tabs.js` | ~208 | `statsOn` default kapalı gelsin |
| 7 | `drawing-settings-dialog.js` | ~916 | `statsOn` ve `alwaysStats` checkbox binding eklendi |
