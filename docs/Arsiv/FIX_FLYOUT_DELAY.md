# GÖREV: Flyout Toolbar Gecikmesi — Stil Değişikliği Anında Yansımıyor

## Proje Bağlamı

PinTrade V2.4. `js/drawing/core/drawing-core.js` ve `js/drawing/ui/property-toolbar.js` dosyalarında birer küçük düzeltme yapılacak. Başka hiçbir dosyaya dokunma.

---

## Sorunun Tam Nedeni

**Flyout toolbar'dan** renk, genişlik vb. değiştirince 1-2 saniyelik gecikme oluyor.
**Settings penceresinden** aynı değişiklik yapılınca anında yansıyor.

**Neden?**

`property-toolbar.js` → `_redraw()` çağrılıyor:
```javascript
function _redraw() {
  DrawingManager.updateToolStyle(_drawing.tool, _drawing.style); // sadece cache günceller
  clearTimeout(_saveTimeout);
  _saveTimeout = setTimeout(() => { State.save(); }, 300);
  EventBus.emit('drawing:settings:saved'); // render tetikler
}
```

`DrawingManager.updateToolStyle()` sadece `_toolStyles` cache'ini ve `State`'i güncelliyor.
**Seçili çizimin (`_drawing`) `style` objesini güncellemediği için**
`requestRedrawAll()` çalışıyor ama çizim eski stiliyle render ediliyor.
Stil değişikliği ancak `State.save()` tamamlanıp `drawing:settings:saved` işlenince yansıyor.

`dsd-apply.js` (Settings penceresi) ise doğrudan `drawing.style` objesini mutate ediyor:
bu yüzden orada anında görünüyor.

**Çözüm:** `property-toolbar.js` → `_redraw()` içinde `DrawingManager.updateToolStyle()` çağrısından önce
seçili çizimin `style` objesini **State içinde de güncelle** — böylece `requestRedrawAll()` doğru stili render eder.

---

## Yapılacak Değişiklik

**Dosya:** `js/drawing/ui/property-toolbar.js`
**Fonksiyon:** `_redraw()`

### ESKİ KOD (satır ~83-92):
```javascript
  let _saveTimeout = null;
  function _redraw() {
    if (_drawing && window.DrawingManager) {
      DrawingManager.updateToolStyle(_drawing.tool, _drawing.style);
    }
    clearTimeout(_saveTimeout);
    _saveTimeout = setTimeout(() => {
      if (window.State) State.save();
    }, 300);
    EventBus.emit('drawing:settings:saved');
  }
```

### YENİ KOD:
```javascript
  let _saveTimeout = null;
  function _redraw() {
    if (_drawing && window.DrawingManager) {
      // [FIX] Seçili çizimin stilini State içinde de anında güncelle.
      // Böylece requestRedrawAll() doğru stili render eder — 1-2 sn gecikme ortadan kalkar.
      if (window.State && _symbol) {
        const drawings = State.getDrawings(_symbol);
        const target = drawings.find(d => d.id === _drawing.id);
        if (target) {
          target.style = JSON.parse(JSON.stringify(_drawing.style));
          State.set('drawings', State.get('drawings'), true); // silent — State'i kirletmeden güncelle
        }
      }
      DrawingManager.updateToolStyle(_drawing.tool, _drawing.style);
    }
    clearTimeout(_saveTimeout);
    _saveTimeout = setTimeout(() => {
      if (window.State) State.save();
    }, 300);
    EventBus.emit('drawing:settings:saved');
  }
```

---

## Özet

| Dosya | Fonksiyon | Değişiklik |
|-------|-----------|------------|
| `js/drawing/ui/property-toolbar.js` | `_redraw()` | State içindeki çizimin `style` objesi anında güncelleniyor |

---

## Kesinlikle Yapılmayacaklar

- `drawing-core.js`'e **dokunma**
- `dsd-apply.js`'e **dokunma**
- `_redraw()` dışındaki hiçbir fonksiyona **dokunma**
- `EventBus.emit('drawing:settings:saved')` satırını **kaldırma veya taşıma**
- `_saveTimeout` mantığına **dokunma**

---

## Test Adımları

1. Sayfayı yenile
2. Bir trend çizgisi çiz, seç
3. Flyout'tan rengini değiştir — anında mı yansıyor?
4. Flyout'tan çizgi kalınlığını değiştir — anında mı yansıyor?
5. Settings penceresinden aynı değişiklikleri yap — hâlâ çalışıyor mu?
6. Console'da hata var mı?
