# PinTrade V2.4 — HRay Inline Text Edit + ExtendLeft Düzeltme Görevi

## Bağlam

`hray` aracının inline text editörü çalışmıyor. Referans araç `hline` ile karşılaştırıldığında üç yerde `'hray'` eksik. Ayrıca `hray`'in `extendLeft` (sola uzat) default davranışı ile render'ı düzenlenmesi gerekiyor.

**Kural:** Yalnızca aşağıda belirtilen değişiklikleri yap. Başka hiçbir şeye dokunma.

---

## Değişiklik 1 — `drawing-core.js`: `hintTools` listesine `'hray'` ekle

### Mevcut kod (~satır 873):

```js
const hintTools = ['trendline', 'ray', 'extended', 'infoline', 'hline'];
```

### Yeni kod:

```js
const hintTools = ['trendline', 'ray', 'extended', 'infoline', 'hline', 'hray'];
```

---

## Değişiklik 2 — `drawing-core.js`: `isReClick` inline editör tetikleyicisine `'hray'` ekle

### Mevcut kod (~satır 1030):

```js
if (!wasDragging && ds.isReClick && ['trendline', 'ray', 'extended', 'infoline', 'hline'].includes(ds.d.tool)) {
```

### Yeni kod:

```js
if (!wasDragging && ds.isReClick && ['trendline', 'ray', 'extended', 'infoline', 'hline', 'hray'].includes(ds.d.tool)) {
```

---

## Değişiklik 3 — `drawing-core.js`: `_openTrendlineTextEditor` fonksiyonu içine `hray` kolu ekle

Fonksiyon içinde `hline` için özel bir `if (d.tool === 'hline')` bloğu var ve bu blok `return` ile bitiyor. Hemen bu `if` bloğunun başına `hray`'i de dahil et:

### Mevcut kod (~satır 1089):

```js
if (d.tool === 'hline') {
```

### Yeni kod:

```js
if (d.tool === 'hline' || d.tool === 'hray') {
```

> **Açıklama:** `hray` de `hline` gibi `price` bazlıdır, `p1/p2` noktası yoktur. Dolayısıyla anchor hesabı (`cvsW / 2`, `priceToCoordinate(d.price)`) birebir aynı çalışır. Bu tek satır değişikliği ile `hray` için inline editör `hline` ile tamamen aynı mantıkta açılır.

---

## Değişiklik 4 — `drawing-core.js`: `_getToolStyle` içinde `hray` default stiline `extendLeft` ekle

`hray` aracının "Sola Uzat" kutusu default olarak **kapalı** gelecek.

### Mevcut kod (~satır 50):

```js
if (tool === 'hray') return { color: '#2962ff', width: 1, lineStyle: 'solid', textColor: '#ffffff', fillColor: 'rgba(41, 137, 255, 0.2)' };
```

### Yeni kod:

```js
if (tool === 'hray') return { color: '#2962ff', width: 1, lineStyle: 'solid', extendLeft: false, textColor: '#ffffff', fillColor: 'rgba(41, 137, 255, 0.2)' };
```

---

## Değişiklik 5 — `drawing-trend.js`: `_drawHRay` içinde `extendLeft` desteği ekle

`_drawHRay` fonksiyonu içinde, çizgi çizilen kısımda `startX` hesabını `extendLeft` stiline göre yap. `extendLeft: true` ise `hline` gibi `0`'dan başlasın; `false` ise mevcut davranış (time'dan başla) korunsun.

### Mevcut kod (`_drawHRay` içinde, startX hesabı):

```js
const rawX = _timeToX(pane, d.time);
const startX = (rawX != null && isFinite(rawX)) ? rawX : 0;
```

### Yeni kod:

```js
const extendLeft = !!s.extendLeft;
const rawX = _timeToX(pane, d.time);
const startX = extendLeft ? 0 : ((rawX != null && isFinite(rawX)) ? rawX : 0);
```

---

## Özet Tablosu

| # | Dosya | Yer | Değişiklik |
|---|---|---|---|
| 1 | `drawing-core.js` | `hintTools` array ~satır 873 | `'hray'` eklendi |
| 2 | `drawing-core.js` | `isReClick` koşulu ~satır 1030 | `'hray'` eklendi |
| 3 | `drawing-core.js` | `_openTrendlineTextEditor` ~satır 1089 | `hline` koşuluna `hray` dahil edildi |
| 4 | `drawing-core.js` | `_getToolStyle` ~satır 50 | `extendLeft: false` default eklendi |
| 5 | `drawing-trend.js` | `_drawHRay` startX hesabı | `extendLeft` stiline göre `startX` güncellendi |

Bu beş değişiklik dışında hiçbir şeye dokunma.
