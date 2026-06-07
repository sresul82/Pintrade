# GÖREV: Flyout Toolbar — Tüm Değişiklikler Çizime Yansımıyor (Hata: updateToolStyle is not a function)

## Proje Bağlamı

**Dosya:** `js/drawing/ui/property-toolbar.js`  
Başka hiçbir dosyaya dokunma.

---

## Sorunun Tam Nedeni

`property-toolbar.js` içindeki `_redraw()` fonksiyonu (satır ~95) şu çağrıyı yapıyor:

```javascript
DrawingManager.updateToolStyle(_drawing.tool, _drawing.style);
```

Ancak `updateToolStyle` metodu `DrawingManager`'ın public API'sinde **mevcut değil.**
Bu satır çalışınca şu hata fırlatılıyor:

```
Uncaught TypeError: DrawingManager.updateToolStyle is not a function
```

JavaScript'te bir fonksiyon içinde hata fırlatılınca o fonksiyonun geri kalan satırları
**çalışmaz.** Bu yüzden hata satırının altındaki şu kritik satırlar hiç çalışmıyor:

```javascript
clearTimeout(_saveTimeout);
_saveTimeout = setTimeout(() => { ... }, 300);
EventBus.emit('drawing:settings:saved');  // ← HİÇ EMİT EDİLMİYOR
```

`drawing:settings:saved` emit edilmediği için `DrawingManager` içindeki listener
`requestRedrawAll()` çağırmıyor. Chart yeniden çizilmiyor.
Fare hareket edince `onMouseMove` içindeki başka bir `requestRedrawAll()` devreye
giriyor ve ancak o zaman değişiklik görünüyor.

**Not:** State güncellemesi (satır 88–93) doğru çalışıyor — sorun orada değil.

---

## Yapılacak Değişiklik

**Dosya:** `js/drawing/ui/property-toolbar.js`  
**Fonksiyon:** `_redraw()`  
**Satır:** ~83–102

### ESKİ KOD:
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

### YENİ KOD:
```javascript
  let _saveTimeout = null;
  function _redraw() {
    if (_drawing && window.State && _symbol) {
      const drawings = State.getDrawings(_symbol);
      const target = drawings.find(d => d.id === _drawing.id);
      if (target) {
        target.style = JSON.parse(JSON.stringify(_drawing.style));
      }
    }
    clearTimeout(_saveTimeout);
    _saveTimeout = setTimeout(() => {
      if (window.State) State.save();
    }, 300);
    EventBus.emit('drawing:settings:saved');
  }
```

**Ne değişti:**
- `DrawingManager.updateToolStyle(...)` satırı **kaldırıldı** — bu metod public API'de yok, hata fırlatıyordu ve tüm fonksiyonu durduruyordu.
- `State.set('drawings', State.get('drawings'), true)` satırı **kaldırıldı** — `State.getDrawings()` reference döndürdüğü için `target.style` güncellemesi zaten State'i anında etkiliyor, bu ekstra `set()` çağrısı gereksizdi.
- `if (_drawing && window.DrawingManager)` guard'ı `if (_drawing && window.State && _symbol)` olarak sadeleştirildi.

---

## Özet Tablo

| Dosya | Fonksiyon | Değişiklik |
|-------|-----------|------------|
| `js/drawing/ui/property-toolbar.js` | `_redraw()` | `DrawingManager.updateToolStyle()` çağrısı kaldırıldı, gereksiz `State.set()` kaldırıldı |

---

## Kesinlikle Yapılmayacaklar

- `_openColorMenu()` fonksiyonuna **dokunma**
- `_openWidthMenu()` fonksiyonuna **dokunma**
- `_openStyleMenu()` fonksiyonuna **dokunma**
- `_openFontSizeMenu()` fonksiyonuna **dokunma**
- `drawing-core.js` dahil başka hiçbir dosyaya **dokunma**

---

## Test Adımları

1. Sayfayı yenile
2. Console'u aç — sayfa açılırken veya çizim seçince hata var mı? ❌ (Olmamalı)
3. Bir trend çizgisi çiz ve seç
4. Flyout'tan renk değiştir → **fareyi hareket ettirmeden** çizgide renk değişiyor mu? ✅
5. Flyout'tan kalınlık değiştir → fareyi hareket ettirmeden anında yansıyor mu? ✅
6. Flyout'tan çizgi stili değiştir → fareyi hareket ettirmeden anında yansıyor mu? ✅
7. Console'da `updateToolStyle is not a function` hatası yok mu? ❌ (Olmamalı)
