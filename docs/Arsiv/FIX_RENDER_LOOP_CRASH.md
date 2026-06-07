# GÖREV: Render Döngüsü Crash Düzeltmesi — HLine, VLine, HRay, CrossLine

## Proje Bağlamı

Tek dosyada değişiklik yapılacak:
- `js/drawing/core/drawing-core.js`

Başka hiçbir dosyaya dokunma.

---

## Sorunun Tam Nedeni

`renderPane` fonksiyonu içindeki `sortedDrawings.forEach` döngüsünde
`_renderDrawing` çağrısının etrafında try-catch **yok**.

`hray`, `vline`, `crossline` araçlarından biri render sırasında herhangi bir
exception fırlatırsa tüm döngü kırılıyor. Canvas `clearRect` ile temizlenmiş
ama hiçbir çizim yapılmamış kalıyor. Bu yüzden:
- Önceki tüm çizimler kayboluyor
- Aktif mumlar gözükmüyor  
- Chart fare ile kaydırılamıyor (canvas state bozuk)

---

## Değişiklik 1 — `drawing-core.js` — render döngüsüne try-catch ekle

**Dosya:** `js/drawing/core/drawing-core.js`
**Satır:** ~1359

**ESKİ KOD:**
```javascript
    sortedDrawings.forEach(d => {
      // Skip if this TF is hidden for this drawing (never hide inProgress drawings)
      const isInProgress = _inProgress && d.id === _inProgress.id;
      if (!isInProgress && activeTf && d.style?.visibility) {
        const vis = d.style.visibility;
        // Find a matching key (case-insensitive)
        const matchKey = Object.keys(vis).find(k => _normalizeVizTf(k) === activeTf);
        if (matchKey !== undefined && vis[matchKey] === false) return; // hidden on this TF
      }
      const isSelected = d.id === _selectedId;
      _renderDrawing(ctx, d, pane, isSelected, isInProgress);
    });
```

**YENİ KOD:**
```javascript
    sortedDrawings.forEach(d => {
      // Skip if this TF is hidden for this drawing (never hide inProgress drawings)
      const isInProgress = _inProgress && d.id === _inProgress.id;
      if (!isInProgress && activeTf && d.style?.visibility) {
        const vis = d.style.visibility;
        // Find a matching key (case-insensitive)
        const matchKey = Object.keys(vis).find(k => _normalizeVizTf(k) === activeTf);
        if (matchKey !== undefined && vis[matchKey] === false) return; // hidden on this TF
      }
      const isSelected = d.id === _selectedId;
      try {
        ctx.save();
        _renderDrawing(ctx, d, pane, isSelected, isInProgress);
      } catch (e) {
        console.warn('[DrawingManager] Render error for tool:', d.tool, d.id, e);
        try { ctx.restore(); } catch(_) {}
      }
    });
```

---

## Özet Tablo

| # | Dosya | Satır | Değişiklik |
|---|-------|-------|------------|
| 1 | `drawing-core.js` | ~1359 | Render döngüsüne try-catch eklendi, exception tek çizimi etkiler, diğerleri render olmaya devam eder |

---

## Kesinlikle Yapılmayacaklar

- `_renderDrawing` fonksiyonuna **dokunma**
- `renderPane` fonksiyonunun başka yerine **dokunma**
- Başka hiçbir fonksiyona **dokunma**

---

## Test Adımları

1. **HRay** çiz → diğer çizimler kaybolmamalı ✅
2. **VLine** çiz → chart donmamalı, mumlar görünmeli ✅
3. **CrossLine** çiz → önceki çizimler yerinde durmalı ✅
4. F5 → state'teki tüm çizimler sorunsuz yüklenmeli ✅
5. Konsola `[DrawingManager] Render error` logu geldiyse hangi tool sorun çıkarıyor görünür ✅
