# RAPOR: FIX_COLOR_PICKER_CLOSE.md Uygulandı

**Tarih:** 2026-05-17

---

## Sorun

Flyout toolbar üzerinden bir renk paletinden (picker) renk seçildiğinde, seçilen renk arka planda `emit()` ile iletiliyor ve `_redraw()` tetikleniyordu. Ancak picker menüsü açık kaldığı için, sistem render isteğini (requestRedrawAll) tam olarak uygulamayı geciktiriyordu. Kullanıcı faresiyle ekranda hareket edene kadar (`mousemove` tetiklenene kadar) çizimin rengi canvas üzerinde güncellenmiyordu.

---

## Yapılan Değişiklik

**Dosya:** `js/drawing/ui/property-toolbar.js`  
**Fonksiyon:** `_openColorMenu()` içindeki `click` listener'ı  
**Satır:** ~252 

### Değiştirilen Kod Bloğu:
```diff
    // Color cell click events
    el.addEventListener('click', e => {
      const cell = e.target.closest('.ptc-cell');
      if (cell) {
        activeHex = cell.dataset.c;
        applyOpacity();
        emit();
-       el.querySelectorAll('.ptc-cell').forEach(c => c.classList.remove('ptc-active'));
-       cell.classList.add('ptc-active');
+       _closeAllMenus(); // [FIX] Renk seçilince picker'ı kapat — render hemen gerçekleşsin
        return;
      }
```

---

## Nasıl Çalışıyor

Bir renk hücresine (`.ptc-cell`) tıklandığı anda `emit()` fonksiyonu çağrılarak yeni renk state'e işleniyor. Hemen ardından eklediğimiz `_closeAllMenus()` komutu çalışıyor ve renk seçim menüsü anında kapanıyor. 

Menü kapandığında canvas üzerindeki odak temizleniyor ve UI çizimi engellenmiyor. Bu sayede fareyi hiç hareket ettirmeye gerek kalmadan, renk tıklanır tıklanmaz anında çizime yansıyor. Menü zaten kapanacağı için, aktif seçimi gösteren CSS (`ptc-active`) sınıflarını manuel olarak atama satırları gereksiz hale geldiği için temizlendi.

---

## Dokunulmayan Dosyalar/Metodlar

- `_redraw()` fonksiyonu ✅
- Opacity slider (saydamlık sürgüsü) işlemleri ✅
- `_openAdvancedPicker` kod bloğu ✅
- Diğer tüm fonksiyonlar ✅

---

## Push Edilecek Dosya

```
js/drawing/ui/property-toolbar.js
```

---

## Test Adımları

1. Sayfayı yenile.
2. Bir çizim aracı (örneğin trend çizgisi) çiz ve onu seçili duruma getir.
3. Flyout menüsünden renk ikonuna tıkla ve herhangi bir palet rengini seç — Picker anında kapanıyor mu? ✅
4. Renk seçildiği anda, farenin hareket etmesini beklemeden çizgideki renk değişiyor mu? ✅
5. Menüyü tekrar açıp Opacity (şeffaflık) slider'ını sürükle — değişiklik anında çalışıyor mu? ✅
6. Console'da hata var mı? ❌ (Olmamalı)
