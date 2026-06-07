# Flat Top/Bottom Çizim Düzeltmesi — `drawing-trend.js`

## Bağlam

`flattopbottom` aracı üç noktalı bir çizimdir:

- **p1** → eğimli çizginin sol/alt başlangıcı
- **p2** → eğimli çizginin sağ ucu (p1'den yukarı/aşağı çıkan nokta)
- **p3** → yatay (flat) çizginin fiyat seviyesini belirleyen anchor noktası

Doğru semantik şema (x ekseni hizalaması):

```
        p3.y
p1.x     |            p2.x
 |       ↓              |
 ●───────────────────── ●   ← yatay (flat) çizgi
  \                    ↑
   \          p2.x'e hizalı sağ uç
    \
     ● p1
```

Yani:
- Yatay çizginin **sol ucu** → `p1.x` (p1'in tam üstünde)
- Yatay çizginin **sağ ucu** → `p2.x` (p2'nin tam üstünde)
- Yatay çizginin **yüksekliği (Y)** → `p3`'ün fiyat seviyesi

---

## Mevcut Sorunlar

`drawing-trend.js` içindeki `_drawFlatTopBottom` fonksiyonunda:

1. `flatY = a.y` → yanlış, p1'in y'sini kullanıyor; p3'ün y'si olmalı
2. `flatRight = c.x` → yanlış, p3'ün x'ini kullanıyor; p2'nin x'i (`b.x`) olmalı
3. Fiyat etiketi `d.p1.price` ile çiziliyor; `d.p3.price` olmalı

---

## Yapılacak Değişiklikler

### `_drawFlatTopBottom` fonksiyonunda şu bloğu bul:

```js
// p3 yoksa (henüz çiziliyorsa) fallback: b ile aynı x, a ile aynı y
let c = d.p3 ? _pt2xy(d.p3, pane) : { x: b.x, y: a.y };
if (!c) c = { x: b.x, y: a.y };

// Flat çizgi: a.x → p3.x, yükseklik sabit a.y (p1'in fiyat seviyesi)
// p3 sadece x konumunu belirler — y koordinatı her zaman p1'in fiyatından gelir
const flatY    = a.y;
const flatLeft = a.x;
const flatRight = c.x;
```

### Ve şununla **tamamen değiştir**:

```js
// p3 yoksa fallback: b ile aynı y (çizim henüz tamamlanmadı)
let c = d.p3 ? _pt2xy(d.p3, pane) : { x: b.x, y: b.y };
if (!c) c = { x: b.x, y: b.y };

// Flat çizgi:
//   - Sol ucu  → p1.x (a.x) — p1'in tam üstünde
//   - Sağ ucu  → p2.x (b.x) — p2'nin tam üstünde
//   - Yükseklik → p3'ün fiyat seviyesi (c.y)
const flatY    = c.y;   // p3'ün y koordinatı
const flatLeft = a.x;   // p1'in x koordinatı (değişmedi)
const flatRight = b.x;  // p2'nin x koordinatı (eskiden c.x idi — düzeltildi)
```

---

### Fiyat etiketi düzeltmesi

Aynı fonksiyonda şu satırı bul:

```js
// p1 fiyatı (flat çizginin sol ucu — sabit seviye)
_drawPriceLabel(ctx, d.p1.price, flatY, pane, labelColor);
```

Şununla **değiştir**:

```js
// p3 fiyatı (flat çizginin seviyesi)
_drawPriceLabel(ctx, d.p3.price, flatY, pane, labelColor);
```

---

## Etkilenen Dosya

- **`drawing-trend.js`** → yalnızca `_drawFlatTopBottom` fonksiyonu

Başka hiçbir fonksiyon veya dosya değiştirilmeyecek.
