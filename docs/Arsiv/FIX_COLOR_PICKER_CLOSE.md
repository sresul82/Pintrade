# GÖREV: Renk Seçimi Sonrası Picker Kapanmıyor — Fare Hareketi Gerektiriyor

## Proje Bağlamı

PinTrade V2.4. `js/drawing/ui/property-toolbar.js` dosyasında küçük bir düzeltme yapılacak.
Başka hiçbir dosyaya dokunma.

---

## Sorunun Tam Nedeni

Flyout toolbar'daki renk butonuna tıklanıp bir renk seçildiğinde:
1. `emit()` çağrılıyor → `onSelect(newColor)` → `_redraw()` çalışıyor ✅
2. Ama renk picker menüsü **açık kalıyor** ❌

Picker açık kaldığı için `requestRedrawAll()` çalışıyor ama canvas yeniden çizilmiyor.
Fare hareket edince `DrawingManager`'ın `mousemove` listener'ı `requestRedrawAll()` tekrar tetikliyor
ve bu sefer render gerçekleşiyor — bu yüzden fare hareket edilince renk yansıyor.

**Çözüm:** Renk hücresine tıklanınca `emit()` çağrısından hemen sonra `_closeAllMenus()` çağır.
Picker kapanınca render doğru zamanda gerçekleşir.

---

## Yapılacak Değişiklik

**Dosya:** `js/drawing/ui/property-toolbar.js`
**Fonksiyon:** `_openColorMenu()` içindeki click event handler
**Satır:** ~249–268

### ESKİ KOD:
```javascript
    // Color cell click events
    el.addEventListener('click', e => {
      const cell = e.target.closest('.ptc-cell');
      if (cell) {
        activeHex = cell.dataset.c;
        applyOpacity();
        emit();
        el.querySelectorAll('.ptc-cell').forEach(c => c.classList.remove('ptc-active'));
        cell.classList.add('ptc-active');
        return;
      }
      if (e.target.closest('#pt-add-custom')) {
        _openAdvancedPicker(activeHex, newHex => {
          if (!CUSTOM_PALETTE.includes(newHex)) CUSTOM_PALETTE.push(newHex);
          activeHex = newHex;
          emit();
          _closeAllMenus();
          // Added color will be shown if they open it again.
        });
      }
    });
```

### YENİ KOD:
```javascript
    // Color cell click events
    el.addEventListener('click', e => {
      const cell = e.target.closest('.ptc-cell');
      if (cell) {
        activeHex = cell.dataset.c;
        applyOpacity();
        emit();
        _closeAllMenus(); // [FIX] Renk seçilince picker'ı kapat — render hemen gerçekleşsin
        return;
      }
      if (e.target.closest('#pt-add-custom')) {
        _openAdvancedPicker(activeHex, newHex => {
          if (!CUSTOM_PALETTE.includes(newHex)) CUSTOM_PALETTE.push(newHex);
          activeHex = newHex;
          emit();
          _closeAllMenus();
        });
      }
    });
```

---

## Özet

| Dosya | Fonksiyon | Değişiklik |
|-------|-----------|------------|
| `js/drawing/ui/property-toolbar.js` | `_openColorMenu()` click handler | `emit()` sonrası `_closeAllMenus()` eklendi, gereksiz `ptc-active` güncelleme satırları kaldırıldı |

---

## Kesinlikle Yapılmayacaklar

- `_redraw()` fonksiyonuna **dokunma**
- Opacity slider koduna **dokunma**
- `_openAdvancedPicker` koduna **dokunma**
- Başka hiçbir fonksiyona **dokunma**

---

## Test Adımları

1. Sayfayı yenile
2. Bir trend çizgisi çiz ve seç
3. Flyout'tan renk butonuna tıkla, bir renk seç — picker kapanıyor mu?
4. Renk tıklanır tıklanmaz çizgiye yansıyor mu? (fare hareketi gerekmeden)
5. Opacity slider'ı sürükle — çalışıyor mu?
6. Console'da hata var mı?
