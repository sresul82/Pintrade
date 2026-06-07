# RAPOR: FIX_REDRAW_CRASH.md Uygulandı

**Tarih:** 2026-05-17

---

## Sorun

Flyout toolbar'dan herhangi bir renk, kalınlık veya stil değiştirildiğinde `_redraw()` fonksiyonu çalışıyordu. Bu fonksiyonun içinde şu çağrı vardı:
```javascript
DrawingManager.updateToolStyle(_drawing.tool, _drawing.style);
```
Fakat `updateToolStyle` metodu `DrawingManager`'ın dışa açık (public) API'sinde bulunmuyordu (Bu isimle public bir fonksiyon sunulmamış). Bu sebeple kod burada `TypeError` fırlatarak çöküyor ve alttaki kritik kod satırlarına geçemiyordu:

```javascript
EventBus.emit('drawing:settings:saved'); // Hiç çalışamıyordu
```

Bu emit işlemi gerçekleşmediği için de çizimin hemen güncellenmesi (`requestRedrawAll`) tetiklenmiyordu ve ancak kullanıcı faresini hareket ettirirse ekran başka bir `mousemove` etkinliği sayesinde tekrar çiziliyordu.

---

## Yapılan Değişiklikler

**Dosya:** `js/drawing/ui/property-toolbar.js`  
**Fonksiyon:** `_redraw()`  

Fonksiyon içerisindeki hatalı çağrı ve gereksiz atamalar temizlenerek fonksiyon şu güvenli ve hızlı hale getirildi:

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

**Neler Değişti?**
1. Çökmeye sebep olan `DrawingManager.updateToolStyle()` çağrısı **kaldırıldı**.
2. Hedef çizimin stili (referans kullanıldığından) güncellendiğinde zaten `State` içeriği değiştiği için ekstradan çalıştırılan gereksiz `State.set('drawings', State.get('drawings'), true)` çağrısı **kaldırıldı**.
3. Baştaki gereksiz `window.DrawingManager` kontrolü basitleştirildi.

---

## Nasıl Çalışıyor

Bir özellik (renk, kalınlık vs.) değiştiğinde `_redraw()` tetiklenir. `_redraw()` gidip aktif `State` içinden o çizimi bulur ve özelliklerini yeni özelliklerle günceller. Daha sonra, hiçbir engele (çökmeye) takılmadan doğrudan `EventBus.emit('drawing:settings:saved')` çalıştırılır. Bu emit sayesinde dinleyici konumundaki sistemler `requestRedrawAll` komutunu anında çalıştırır. Sonuç olarak kullanıcı faresini yerinden hiç oynatmadan değişiklik grafik üzerinde anında görünür olur.

---

## Dokunulmayan Dosyalar/Metodlar

- `_openColorMenu()`, `_openWidthMenu()`, `_openStyleMenu()`, `_openFontSizeMenu()` ✅
- `drawing-core.js` ✅
- Menülerin kapanma işlemleri ✅

---

## Push Edilecek Dosya

```
js/drawing/ui/property-toolbar.js
```

---

## Test Adımları

1. Sayfayı yenile.
2. Console'u aç — Hata olmamalı. ❌
3. Bir çizim (örneğin trend çizgisi) çiz ve seç.
4. Flyout'tan renk, kalınlık veya stilini değiştir → **Fareyi hareket ettirmeden** anında değişiyor mu? ✅
5. Console'da `updateToolStyle is not a function` şeklinde hata görünüyor mu? ❌ (Görünmemeli)
