# RAPOR: FIX_FLYOUT_MENU_CLOSE.md Uygulandı

**Tarih:** 2026-05-17

---

## Sorun

Flyout toolbar'daki renk menüsünün fare gecikmesi sorununu çözdükten sonra, benzer durumun diğer dropdown menülerinde (kalınlık, çizgi stili ve font boyutu) de yaşandığı tespit edildi. 

Bu menülerde bir seçim yapıldığında değer atanıyor ve çizim sistemine yeniden çizim sinyali (`requestRedrawAll`) gidiyordu. Ancak menü DOM üzerinde kapanmadan açık kaldığı için, sistem render işlemini ekrana yansıtmayı, fare bir sonraki hareketi yapana kadar geciktiriyordu (`mousemove` tetiklenene kadar).

---

## Yapılan Değişiklikler

**Dosya:** `js/drawing/ui/property-toolbar.js`

Gereksiz aktif CSS sınıflarını (örn. `pt-w-active`, `pt-fs-active`) manipüle eden DOM satırları silinerek yerine `_closeAllMenus();` çağrısı eklendi. Çünkü menü zaten tıklandığı anda kapatılacağı için arka plan rengini değiştirmeye çalışmak gereksizdi.

### 1. `_openWidthMenu()` (Çizgi Kalınlığı)
```diff
    el.addEventListener('click', e => {
      const item = e.target.closest('.pt-w-item');
      if (!item) return;
      onSelect(parseInt(item.dataset.w));
-     el.querySelectorAll('.pt-w-item').forEach(c => c.style.background = 'transparent');
-     item.style.background = '#2a2e39';
+     _closeAllMenus(); // [FIX] Seçim sonrası menüyü kapat — render hemen gerçekleşsin
    });
```

### 2. `_openFontSizeMenu()` (Yazı Tipi Boyutu)
```diff
    el.addEventListener('click', e => {
      const item = e.target.closest('.pt-fs-item');
      if (!item) return;
      onSelect(parseInt(item.dataset.s));
-     el.querySelectorAll('.pt-fs-item').forEach(c => {
-       c.style.background = 'transparent';
-       c.style.color = '#d1d4dc';
-     });
-     item.style.background = '#2962ff';
-     item.style.color = '#fff';
+     _closeAllMenus(); // [FIX] Seçim sonrası menüyü kapat — render hemen gerçekleşsin
    });
```

### 3. `_openStyleMenu()` (Çizgi Stili)
```diff
    el.addEventListener('click', e => {
      const item = e.target.closest('.pt-s-item');
      if (!item) return;
      onSelect(item.dataset.s);
-     el.querySelectorAll('.pt-s-item').forEach(c => c.style.background = 'transparent');
-     item.style.background = '#2a2e39';
+     _closeAllMenus(); // [FIX] Seçim sonrası menüyü kapat — render hemen gerçekleşsin
    });
```

---

## Nasıl Çalışıyor

İlgili ayarlardan biri (kalınlık, stil veya boyut) seçildiği an:
1. `onSelect()` çalışarak yeni ayarı sisteme aktarır.
2. `_closeAllMenus()` çalışarak o an açık olan dropdown menüsünü HTML'den siler.
3. Menü kapandığı için sistem anında UI kilidini kaldırır ve `requestAnimationFrame` sorunsuz çalışarak çizimin yeni halini faresiz (hareket gerektirmeden) hemen ekrana çizer.

---

## Dokunulmayan Dosyalar/Metodlar

- `_redraw()` fonksiyonu ✅
- `_openColorMenu()` (Daha önce çözülmüştü) ✅
- `_openAdvancedPicker()` ✅
- Diğer hiçbir dosyaya dokunulmadı ✅

---

## Push Edilecek Dosya

```
js/drawing/ui/property-toolbar.js
```

---

## Test Adımları

1. Sayfayı yenile.
2. Bir trend çizgisi çiz ve seç (flyout görünür).
3. **Kalınlık Testi:** Width butonuna tıkla, farklı bir kalınlık seç → menü kapandı mı ve çizim anında güncellendi mi? ✅
4. **Stil Testi:** Style butonuna tıkla, dashed (kesik) seç → menü kapandı mı ve çizim anında güncellendi mi? ✅
5. **Font Testi:** Bir metin (text) aracı çiz, Font size butonuna tıkla, boyutu değiştir → menü kapandı mı ve metin anında büyüdü/küçüldü mü? ✅
6. Console'da herhangi bir hata var mı? ❌ (Olmamalı)
