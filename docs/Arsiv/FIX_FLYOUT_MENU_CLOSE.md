# GÖREV: Flyout Toolbar — Genişlik, Stil ve Font Seçimi Sonrası Menü Kapanmıyor ve Çizim Güncellenmesi Fare Hareketine Kadar Gecikiyor

## Proje Bağlamı

**Dosya:** `js/drawing/ui/property-toolbar.js`  
Başka hiçbir dosyaya dokunma.

---

## Sorunun Tam Nedeni

Renk picker için `_closeAllMenus()` daha önce eklendi ve o sorun çözüldü.
Ama aynı sorun üç dropdown'da daha mevcut:

- `_openWidthMenu()` — çizgi kalınlığı seçimi
- `_openStyleMenu()` — çizgi stili seçimi (solid/dashed/dotted)
- `_openFontSizeMenu()` — font boyutu seçimi

Bu üçünde seçim yapılınca `onSelect()` çağrılıyor → `_redraw()` çalışıyor →
`EventBus.emit('drawing:settings:saved')` gidiyor → `DrawingManager` içinde
`requestRedrawAll()` kuyruğa giriyor (`requestAnimationFrame` ile).

Ama menü DOM'da açık kaldığı için render bir sonraki `mousemove` event'ine
kadar görünür olmuyor. Menü kapanınca bu blok ortadan kalkıyor ve render
hemen gerçekleşiyor.

**Çözüm:** Bu üç menünün click handler'larında `onSelect()` çağrısından
hemen sonra `_closeAllMenus()` ekle. Menü kapanınca `requestAnimationFrame`
temiz çalışır ve çizim anında güncellenir.

---

## Yapılacak Değişiklikler

### Değişiklik 1 — `_openWidthMenu()` click handler

**Mevcut kod (satır ~327–333):**
```javascript
    el.addEventListener('click', e => {
      const item = e.target.closest('.pt-w-item');
      if (!item) return;
      onSelect(parseInt(item.dataset.w));
      el.querySelectorAll('.pt-w-item').forEach(c => c.style.background = 'transparent');
      item.style.background = '#2a2e39';
    });
```

**Yeni kod:**
```javascript
    el.addEventListener('click', e => {
      const item = e.target.closest('.pt-w-item');
      if (!item) return;
      onSelect(parseInt(item.dataset.w));
      _closeAllMenus(); // [FIX] Seçim sonrası menüyü kapat — render hemen gerçekleşsin
    });
```

**Ne değişti:** `onSelect()` sonrasına `_closeAllMenus()` eklendi.
Menü zaten kapanacağı için aktif seçimi gösteren CSS satırları gereksiz
hale geldiğinden kaldırıldı.

---

### Değişiklik 2 — `_openStyleMenu()` click handler

**Mevcut kod (satır ~411–417):**
```javascript
    el.addEventListener('click', e => {
      const item = e.target.closest('.pt-s-item');
      if (!item) return;
      onSelect(item.dataset.s);
      el.querySelectorAll('.pt-s-item').forEach(c => c.style.background = 'transparent');
      item.style.background = '#2a2e39';
    });
```

**Yeni kod:**
```javascript
    el.addEventListener('click', e => {
      const item = e.target.closest('.pt-s-item');
      if (!item) return;
      onSelect(item.dataset.s);
      _closeAllMenus(); // [FIX] Seçim sonrası menüyü kapat — render hemen gerçekleşsin
    });
```

**Ne değişti:** `onSelect()` sonrasına `_closeAllMenus()` eklendi.
Gereksiz CSS güncelleme satırları kaldırıldı.

---

### Değişiklik 3 — `_openFontSizeMenu()` click handler

**Mevcut kod (satır ~364–374):**
```javascript
    el.addEventListener('click', e => {
      const item = e.target.closest('.pt-fs-item');
      if (!item) return;
      onSelect(parseInt(item.dataset.s));
      el.querySelectorAll('.pt-fs-item').forEach(c => {
        c.style.background = 'transparent';
        c.style.color = '#d1d4dc';
      });
      item.style.background = '#2962ff';
      item.style.color = '#fff';
    });
```

**Yeni kod:**
```javascript
    el.addEventListener('click', e => {
      const item = e.target.closest('.pt-fs-item');
      if (!item) return;
      onSelect(parseInt(item.dataset.s));
      _closeAllMenus(); // [FIX] Seçim sonrası menüyü kapat — render hemen gerçekleşsin
    });
```

**Ne değişti:** `onSelect()` sonrasına `_closeAllMenus()` eklendi.
Gereksiz CSS güncelleme satırları kaldırıldı.

---

## Özet Tablo

| Fonksiyon | Satır | Değişiklik |
|-----------|-------|------------|
| `_openWidthMenu()` click handler | ~327 | `onSelect()` sonrası `_closeAllMenus()` eklendi, gereksiz CSS satırları kaldırıldı |
| `_openStyleMenu()` click handler | ~411 | `onSelect()` sonrası `_closeAllMenus()` eklendi, gereksiz CSS satırları kaldırıldı |
| `_openFontSizeMenu()` click handler | ~364 | `onSelect()` sonrası `_closeAllMenus()` eklendi, gereksiz CSS satırları kaldırıldı |

---

## Kesinlikle Yapılmayacaklar

- `_redraw()` fonksiyonuna **dokunma**
- `_openColorMenu()` fonksiyonuna **dokunma** (zaten düzeltildi)
- `_openAdvancedPicker()` fonksiyonuna **dokunma**
- `drawing-core.js` dahil başka hiçbir dosyaya **dokunma**

---

## Test Adımları

1. Sayfayı yenile
2. Bir trend çizgisi çiz ve seç — flyout toolbar görünür
3. **Kalınlık testi:** Width butonuna tıkla, farklı bir px seç → menü kapandı mı? Çizim faresiz anında kalınlaştı mı? ✅
4. **Stil testi:** Style butonuna tıkla, dashed seç → menü kapandı mı? Çizim faresiz anında kesik çizgiye döndü mü? ✅
5. **Font testi:** Bir text/annotation çizimi seç, Font size butonuna tıkla, farklı boyut seç → menü kapandı mı? Faresiz anında değişti mi? ✅
6. Console'da hata var mı? ❌ (Olmamalı)
