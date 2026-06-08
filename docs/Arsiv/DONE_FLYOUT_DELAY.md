# RAPOR: FIX_FLYOUT_DELAY.md Uygulandı

**Tarih:** 2026-05-17

---

## Sorun

Flyout toolbar (çizim seçildiğinde çıkan küçük ayar çubuğu) üzerinden renk veya kalınlık değiştirildiğinde, çizim üzerinde bu değişikliklerin görünmesi 1-2 saniye gecikiyordu. Oysa büyük Settings penceresinden yapılan aynı değişiklikler anında yansıyordu. 

Sorunun nedeni: `property-toolbar.js` içindeki `_redraw()` fonksiyonu, `DrawingManager.updateToolStyle()` çağırarak sadece yeni aracı ve önbelleği (`_toolStyles`) güncelliyor ancak anlık seçili çizimin (`_drawing.style`) state (durum) yansımasını bekletiyordu. Sistem `State.save()` fonksiyonunun (300ms throttle) tamamlanıp tetiklenmesini beklediği için gecikme yaşanıyordu.

---

## Yapılan Değişiklik

**Dosya:** `js/drawing/ui/property-toolbar.js`  
**Fonksiyon:** `_redraw()`  
**Satır:** 82 - 92

### Eklenen Kod Bloğu:
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

## Nasıl Çalışıyor

Yeni kod ile `_redraw()` fonksiyonu çağrıldığında, `State` içerisindeki mevcut çizimlerin listesini alır, aktif olarak değiştirilen çizimi (`_drawing.id` ile) bulur ve stilini (`_drawing.style`) o an `State` içine derin kopya ile anında kaydeder. Hemen ardından `silent: true` parametresi ile state set edilir. Bu işlem sayesinde gecikmeyi beklemeksizin tetiklenen render işlemi `State` üzerinden doğru stili okuyabilir ve çizim anında yeni stiliyle ekranda güncellenir.

---

## Dokunulmayan Dosyalar/Metodlar

- `drawing-core.js` ✅
- `dsd-apply.js` ✅
- `EventBus.emit('drawing:settings:saved')` (satır korundu) ✅
- `_saveTimeout` mantığı (gecikmeli save korundu) ✅

---

## Push Edilecek Dosya

```
js/drawing/ui/property-toolbar.js
```

---

## Test Adımları

1. Sayfayı yenile.
2. Bir trend çizgisi çiz ve seç.
3. Flyout'tan rengini değiştir — anında yansıyor mu? ✅
4. Flyout'tan çizgi kalınlığını değiştir — anında yansıyor mu? ✅
5. Settings penceresinden aynı değişiklikleri yap — hâlâ çalışıyor mu? ✅
6. Console'da hata var mı? ❌ (Olmamalı)
