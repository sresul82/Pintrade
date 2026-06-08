# VLine — Time Label Varsayılan Olarak Açılmıyor: Düzeltme Talimatı

## Sorunun Kök Nedeni

`drawing-core.js` içinde her çizim aracının varsayılan stil nesnesi `_getToolStyle(tool)` fonksiyonunda tanımlanmaktadır.

`vline` için mevcut tanım şu şekildedir:

```js
// drawing-core.js — mevcut (hatalı) hali
if (tool === 'vline') return { color: '#2962ff', width: 1, lineStyle: 'solid', textOrientation: 'horizontal' };
```

`timeLabel` alanı bu nesnede **yoktur**.

`drawing-trend.js` içindeki `drawVLine` fonksiyonu ise time label'ı şu koşulla çizer:

```js
// drawing-trend.js — VLine draw fonksiyonu
if (s.timeLabel) {   // <-- sadece truthy ise çizer
  // ... label çizim kodu
}
```

`s.timeLabel` ilk yüklemede `undefined` olduğundan koşul **false** döner ve label çizilmez.  
Ayarlar penceresi açılıp kapandığında ise `timeLabel: true` değeri `s` nesnesine yazıldığından label o andan itibaren görünür hale gelir.

---

## Yapılacak Tek Değişiklik

**Dosya:** `drawing-core.js`  
**Fonksiyon:** `_getToolStyle(tool)`

### Eski Satır

```js
if (tool === 'vline') return { color: '#2962ff', width: 1, lineStyle: 'solid', textOrientation: 'horizontal' };
```

### Yeni Satır

```js
if (tool === 'vline') return { color: '#2962ff', width: 1, lineStyle: 'solid', textOrientation: 'horizontal', timeLabel: true };
```

> Tek fark: nesnenin sonuna **`timeLabel: true`** eklenmesidir.

---

## Neden Başka Bir Yere Dokunmaya Gerek Yok?

| Dosya | Durum |
|---|---|
| `drawing-core.js` — `_getToolStyle` | ✅ Sadece bu satır değişecek |
| `drawing-trend.js` — `drawVLine` | ✅ Dokunma, mantık zaten doğru |
| Ayarlar / settings bileşeni | ✅ Dokunma, zaten `timeLabel` alanını okuyor/yazıyor |

`crossline` aracında aynı alan `timeLabel: true` olarak zaten doğru tanımlanmış durumdadır. `vline` için de aynı pattern uygulanmaktadır.

---

## Özet

```
drawing-core.js içinde _getToolStyle fonksiyonunda,
vline satırının sonuna   timeLabel: true   ekle.
```
