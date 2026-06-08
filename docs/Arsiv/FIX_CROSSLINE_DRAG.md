# GÖREV: HLine, VLine, HRay, CrossLine Drag Düzeltmesi

## Proje Bağlamı

Tek dosyada değişiklik yapılacak:
- `js/drawing/core/drawing-core.js`

Başka hiçbir dosyaya dokunma.

---

## Sorun

`crossline` drag sırasında hem `price` hem `time` güncellenmesi gerekiyor ama şu an hiçbir bloğa girmiyor — `else` bloğuna düşüyor, `p1` olmadığı için hareket etmiyor.

---

## Değişiklik 1 — `drawing-core.js` — CrossLine drag handler ekle

**Dosya:** `js/drawing/core/drawing-core.js`
**Satır:** ~607

**ESKİ KOD:**
```javascript
            } else if (d.tool === 'vline') {
              const origX = _timeToX(pane, _dragState.origTime);
              d.time = pane.chart.timeScale().coordinateToTime(origX + dx);
            } else {
```

**YENİ KOD:**
```javascript
            } else if (d.tool === 'vline') {
              const origX = _timeToX(pane, _dragState.origTime);
              d.time = pane.chart.timeScale().coordinateToTime(origX + dx);
            } else if (d.tool === 'crossline') {
              const origX = _timeToX(pane, _dragState.origTime);
              const origY = pane.series.priceToCoordinate(_dragState.origPrice);
              d.time  = pane.chart.timeScale().coordinateToTime(origX + dx);
              d.price = pane.series.coordinateToPrice(origY + dy);
            } else {
```

---

## Özet Tablo

| # | Dosya | Satır | Değişiklik |
|---|-------|-------|------------|
| 1 | `drawing-core.js` | ~607 | `crossline` drag handler eklendi |

---

## Kesinlikle Yapılmayacaklar

- `hline`, `vline`, `hray` bloklarına **dokunma** — zaten doğru çalışıyor
- Başka hiçbir araca **dokunma**

---

## Test Adımları

1. **CrossLine** çiz → sürükle → hem yatay hem dikey hareket etmeli ✅
2. **HLine** çiz → sürükle → sadece dikey hareket etmeli ✅
3. **VLine** çiz → sürükle → sadece yatay hareket etmeli ✅
4. **HRay** çiz → sürükle → hem yatay hem dikey hareket etmeli ✅
