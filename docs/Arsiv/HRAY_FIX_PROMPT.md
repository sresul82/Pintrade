# PinTrade V2.4 — Hata Düzeltme Görevi

## Bağlam

Bu proje LightweightCharts kütüphanesi üzerine canvas overlay ile inşa edilmiş bir çizim sistemi kullanmaktadır. Aşağıda **iki ayrı hata** ve her birinin tam düzeltmesi açıklanmaktadır. Yalnızca belirtilen satırları değiştir, başka hiçbir şeye dokunma.

---

## Hata 1 — `drawing-core.js`: `_saveState` tanımsız (ReferenceError)

### Sorun

`drawing-core.js` içindeki `_clearDrawings` fonksiyonu (yaklaşık satır 1449) `_saveState(all)` çağrısı yapıyor. Ancak `_saveState` adında bir fonksiyon bu dosyada hiç tanımlanmamış. Bu, `drawing:clear:drawings` eventi tetiklendiğinde (çizim silindiğinde) konsola `ReferenceError: _saveState is not defined` hatası düşürür ve state bozulur.

### Düzeltme

`drawing-core.js` içinde `_clearDrawings` fonksiyonunu bul. İçindeki şu satırı:

```js
_saveState(all);
```

Şununla değiştir:

```js
State.set('drawings', all);
Storage.save('drawings', all);
```

> **Not:** Projedeki diğer kaydetme akışları `State.set` + `Storage.save` ikilisini kullanmaktadır. `_saveState` adında bir wrapper fonksiyon yoktur; varsa zaten `_saveHistory` adını taşımaktadır ve farklı bir iş yapar.

---

## Hata 2 — `drawing-trend.js`: `_drawHRay` başlangıç noktası görünür alana düşmüyor

### Sorun

`_drawHRay` fonksiyonu içindeki çizim kodu şu şekilde:

```js
ctx.moveTo(x, y);
ctx.lineTo(w - hrayLabelW, y);
```

Burada `x = _timeToX(pane, d.time)` hesaplanıyor. Eğer `x` değeri `w - hrayLabelW`'den büyük veya eşitse (yani başlangıç noktasının X'i, bitiş noktasının X'inden sağda kalıyorsa) canvas'a sıfır uzunluklu ya da negatif yönlü bir çizgi gönderilir ve ekranda **hiçbir şey görünmez**. Kullanıcı tıkladığında Horizontal Ray objesi oluşturulur (flyout menüsü açılır) fakat çizgi ekranda gözükmez.

Bunun yanında, Hray'in başlangıç noktası (`d.time`) bazen görünür alanın dışına (sol veya sağ) çıkabilir; bu durumda `_timeToX` negatif ya da `w`'den büyük bir değer döndürür ve çizgi yine görünmez.

### Düzeltme

`drawing-trend.js` içinde `_drawHRay` fonksiyonunu bul. Mevcut `ctx.beginPath()` bloğunu içeren kısmı aşağıdaki kodla değiştir:

**Mevcut kod (yaklaşık satır 302–305):**
```js
ctx.beginPath();
ctx.moveTo(x, y);
ctx.lineTo(w - hrayLabelW, y);
ctx.stroke();
```

**Yeni kod:**
```js
// Başlangıç X'i görünür alanın dışına taşmışsa sol kenara sabitle,
// böylece çizgi her zaman canvas üzerinde görünür kalır.
const startX = Math.min(x, w - hrayLabelW - 1);
const endX   = w - hrayLabelW;

if (startX < endX) {
  ctx.beginPath();
  ctx.moveTo(startX, y);
  ctx.lineTo(endX, y);
  ctx.stroke();
}
```

> **Açıklama:** `startX` hesabı, başlangıç noktasının bitiş noktasını geçmesini önler. `startX < endX` koşulu ise tamamen çakışık iki nokta durumunda gereksiz `stroke()` çağrısını engeller. Bu sayede:
> - Tıklanan an ekran içindeyse çizgi tıklanan X'ten başlayıp sağa uzanır.
> - Başlangıç noktası scroll ile görünür alanın dışına çıksa bile çizgi sol kenardan itibaren devam eder.

---

## Özet

| Dosya | Değişen Yer | Eski | Yeni |
|---|---|---|---|
| `drawing-core.js` | `_clearDrawings` ~satır 1449 | `_saveState(all)` | `State.set('drawings', all); Storage.save('drawings', all);` |
| `drawing-trend.js` | `_drawHRay` ~satır 302–305 | `ctx.moveTo(x,y); ctx.lineTo(w-hrayLabelW,y);` | Korumalı `startX` hesabı ile değiştirildi |

Bu iki değişiklikten başka hiçbir şeye dokunma.
