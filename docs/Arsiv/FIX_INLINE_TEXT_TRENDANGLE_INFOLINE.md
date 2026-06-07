# GÖREV: InfoLine Inline Text Ekle + TrendAngle "Add Text" Hint Kaldır

## Proje Bağlamı

İki dosyada değişiklik yapılacak:
- `js/drawing/core/drawing-core.js`
- `js/drawing/ui/drawing-trend.js`

Başka hiçbir dosyaya dokunma.

---

## Değişiklik 1 — `drawing-core.js` — InfoLine'a inline text editörü ekle

**Dosya:** `js/drawing/core/drawing-core.js`
**Satır:** ~771

**ESKİ KOD:**
```javascript
      if (!wasDragging && ds.isReClick && ['trendline', 'ray', 'extended'].includes(ds.d.tool)) {
        _openTrendlineTextEditor(ds.d, pane, e);
      }
```

**YENİ KOD:**
```javascript
      if (!wasDragging && ds.isReClick && ['trendline', 'ray', 'extended', 'infoline'].includes(ds.d.tool)) {
        _openTrendlineTextEditor(ds.d, pane, e);
      }
```

**Ne değişti:** `'infoline'` listeye eklendi.

---

## Değişiklik 2 — `drawing-trend.js` — TrendAngle'da "Add Text" hint'ini gizle

**Dosya:** `js/drawing/ui/drawing-trend.js`
**Satır:** ~450

**ESKİ KOD:**
```javascript
      // "Add Text" hint — shown when selected but no text yet
      if (selected && !hasText) {
        ctx.save();
        ctx.font = '12px "JetBrains Mono", sans-serif';
        ctx.fillStyle = '#d1d4dc';
        _drawParallelText(ctx, 'Add Text', 0.35);
        ctx.restore();
      }
```

**YENİ KOD:**
```javascript
      // "Add Text" hint — shown when selected but no text yet (not for trendangle)
      if (selected && !hasText && d.tool !== 'trendangle') {
        ctx.save();
        ctx.font = '12px "JetBrains Mono", sans-serif';
        ctx.fillStyle = '#d1d4dc';
        _drawParallelText(ctx, 'Add Text', 0.35);
        ctx.restore();
      }
```

**Ne değişti:** `&& d.tool !== 'trendangle'` koşulu eklendi.

---

## Özet Tablo

| # | Dosya | Satır | Değişiklik |
|---|-------|-------|------------|
| 1 | `drawing-core.js` | ~771 | `'infoline'` inline text editör listesine eklendi |
| 2 | `drawing-trend.js` | ~450 | `trendangle` için "Add Text" hint gizlendi |

---

## Kesinlikle Yapılmayacaklar

- `_openTrendlineTextEditor` fonksiyonuna **dokunma**
- `trendline`, `ray`, `extended` araçlarına **dokunma**
- `_drawTrendLine` fonksiyonunun başka hiçbir yerine **dokunma**

---

## Test Adımları

1. Sayfayı yenile
2. **TrendAngle** seç → "Add Text" yazısı görünmemeli ❌
3. **TrendLine** seç → "Add Text" yazısı hâlâ görünmeli ✅
4. **InfoLine** çiz → seç → üstüne tekrar tıkla → text editörü açılmalı ✅
5. InfoLine text yaz → kaydet → text çizgi üzerinde görünmeli ✅
