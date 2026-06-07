# VLine — Time Label Düzeltme Talimatı (v2)

## İki Ayrı Sorun Var

### Sorun 1 — Yanlış koşul ifadesi (`drawing-trend.js`)

CrossLine'da time label şu koşulla çizilir:

```js
if (s.timeLabel !== false)   // undefined → true → çizer ✅
```

VLine'da ise:

```js
if (s.timeLabel)             // undefined → false → çizmez ❌
```

`s.timeLabel` ayarlar penceresine dokunulmadan `undefined` olduğundan VLine hiç çizmez.  
Koşulun CrossLine ile **aynı** olması gerekir.

---

### Sorun 2 — Label rengi `s.color`'a bağlı değil (`drawing-trend.js`)

CrossLine'da label arka planı çizgi rengiyle aynı rengi kullanır:

```js
ctx.fillStyle = s.color || '#2962ff';   // çizgi rengi ✅
ctx.fillStyle = '#000000';              // metin siyah ✅
```

VLine'da ise sabit gri renk kodlanmış:

```js
ctx.fillStyle = 'rgba(80, 80, 90, 0.85)';   // sabit gri ❌
ctx.fillStyle = '#d1d4dc';                   // sabit açık gri metin ❌
```

---

## Yapılacak Değişiklikler — Sadece `drawing-trend.js`

Dosyada `_drawVLine` fonksiyonu içinde **iki satır** değişecek.

---

### Değişiklik 1 — Koşul düzeltmesi (satır ~205)

**Eski:**
```js
        if (s.timeLabel) {
```

**Yeni:**
```js
        if (s.timeLabel !== false) {
```

---

### Değişiklik 2 — Renk düzeltmesi (satır ~233–237, label çizim bloğu içinde)

**Eski:**
```js
          ctx.fillStyle = 'rgba(80, 80, 90, 0.85)';
          ctx.beginPath();
          ctx.roundRect(bx, by, boxW, boxH, 3);
          ctx.fill();
          ctx.fillStyle = '#d1d4dc';
```

**Yeni:**
```js
          ctx.fillStyle = s.color || '#2962ff';
          ctx.beginPath();
          ctx.roundRect(bx, by, boxW, boxH, 3);
          ctx.fill();
          ctx.fillStyle = '#000000';
```

---

## Özet Tablosu

| # | Dosya | Satır (yaklaşık) | Eski | Yeni |
|---|---|---|---|---|
| 1 | `drawing-trend.js` | ~205 | `if (s.timeLabel)` | `if (s.timeLabel !== false)` |
| 2 | `drawing-trend.js` | ~233 | `'rgba(80, 80, 90, 0.85)'` | `s.color \|\| '#2962ff'` |
| 3 | `drawing-trend.js` | ~237 | `'#d1d4dc'` | `'#000000'` |

> `drawing-core.js`'e dokunmaya **gerek yok** — asıl sorun `_drawVLine` fonksiyonunun içindeydi.
