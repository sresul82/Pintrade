# Parallel Channel Render Crash — Bug Report & AI Prompt

---

## 1. Hatanın Tam Sebebi

**Dosya:** `drawing-trend.js`, satır **678**

```js
if (!levels.find(cl => cl.v === dl.v)) levels.push(dl);
```

`s.channelLevels` (kullanıcıdan / localStorage'dan gelen kayıtlı array), içinde
**`null` veya `undefined` eleman** barındırıyor.

`Array.find` bu elemanı callback'e geçirdiğinde `cl` değeri `null` oluyor
ve `cl.v` erişimi **"Cannot read properties of null (reading 'v')"** hatasını
fırlatıyor.

Aynı tehlike satır **686**'da da mevcut:
```js
if (!uniqueLevels.find(u => u.v === cl.v)) {
```

> **Not:** 683–690 arası "uniqueLevels" döngüsünde `if (!cl) return;`
> koruması zaten var — ama 678'deki `find` callback'inde **bu koruma eksik**.

---

## 2. Stack Trace Eşleştirmesi

```
TypeError: Cannot read properties of null (reading 'v')
  at drawing-trend.js:678:35          ← cl.v  (find callback)
  at Array.find (<anonymous>)
  at drawing-trend.js:678:21          ← levels.find(...)
  at Array.forEach (<anonymous>)
  at Object._drawChannel [as drawChannel] (drawing-trend.js:677:21)
  at _renderDrawing (drawing-core.js:1743:51)
  at drawing-core.js:1526:9
  at Array.forEach (<anonymous>)
  at Object.renderPane (drawing-core.js:1515:20)
  at ChartPane.redrawDrawings (chart-pane.js:393:54)
```

Her şey `_drawChannel` → `drawChannel` çağrısından geliyor.
Kanal render'ı tamamen durduğu için ekranda hiç Parallel Channel görünmüyor.

---

## 3. Fix (Minimal, Güvenli)

**Satır 678** — `find` callback'ine null guard ekle:

```js
// ÖNCE (kırık)
if (!levels.find(cl => cl.v === dl.v)) levels.push(dl);

// SONRA (düzeltilmiş)
if (!levels.find(cl => cl != null && cl.v === dl.v)) levels.push(dl);
```

**Satır 681** — sort da null'a çarpabilir, onu da koru:

```js
// ÖNCE
levels.sort((a, b) => a.v - b.v);

// SONRA
levels = levels.filter(cl => cl != null);
levels.sort((a, b) => a.v - b.v);
```

Bu iki değişiklik yeterli. Geri kalan uniqueLevels döngüsünde guard zaten var.

---

## 4. Kök Neden (Neden null geliyor?)

`s.channelLevels` veriyi dışarıdan alıyor (muhtemelen JSON.parse ile
localStorage veya bir API'den). Olası sebepler:

- Eski kayıtlı çizimde array elemanı `null` olarak serialize edilmiş.
- `splice` / `delete` ile eleman silme işlemi array'de delik (sparse) bırakmış.
- Farklı bir kod parçası `channelLevels` array'ine `null` push etmiş.

---

## 5. Yapay Zeka İçin Prompt

Aşağıdaki prompt'u doğrudan bir LLM'e yapıştırabilirsiniz:

---

```
Sen deneyimli bir JavaScript/Canvas çizim motoru geliştiricisisin.

## Bağlam

Bir finansal grafik kütüphanesinde Parallel Channel (paralel kanal) aracı
render edilmiyor. Kullanıcı kanalı çizdiğinde ekranda hiçbir şey görünmüyor
ve konsolda şu hata fırlatılıyor:

  TypeError: Cannot read properties of null (reading 'v')
    at drawing-trend.js:678:35   ← cl.v (Array.find callback içinde)
    at Array.find (<anonymous>)
    at drawing-trend.js:678:21
    at Array.forEach (<anonymous>)
    at Object._drawChannel (drawing-trend.js:677:21)
    at _renderDrawing (drawing-core.js:1743:51)
    at Object.renderPane (drawing-core.js:1515:20)
    at ChartPane.redrawDrawings (chart-pane.js:393:54)

## Sorunlu Kod (drawing-trend.js, satır 672–691)

```js
let levels = s.channelLevels;
if (!levels || levels.length === 0) {
  levels = defaultLevels;
} else {
  // Merge missing default levels
  defaultLevels.forEach(dl => {
    if (!levels.find(cl => cl.v === dl.v)) levels.push(dl);   // ← CRASH BURADA
  });
  // Sort by value
  levels.sort((a, b) => a.v - b.v);
  // Remove duplicate levels (by v) and ignore undefined entries
  const uniqueLevels = [];
  levels.forEach(cl => {
    if (!cl) return;                                           // ← guard VAR ama geç kalıyor
    if (!uniqueLevels.find(u => u.v === cl.v)) {
      uniqueLevels.push(cl);
    }
  });
  levels.length = 0;
  levels.push(...uniqueLevels);
}
```

## Ne İstiyorum

1. Yukarıdaki kod bloğunu tam olarak düzelt (minimum değişiklikle).
2. `s.channelLevels` dışarıdan geldiği için null/undefined eleman içerebilir;
   bunu göz önünde bulundur.
3. Sort işlemi de null'a çarpabilir — onu da güvene al.
4. Düzeltilmiş tam kod bloğunu ver ve her değişikliğin neden gerekli
   olduğunu tek cümleyle açıkla.
5. Aynı pattern'i kullanan başka bir `find(cl => cl.v ...)` ifadesi
   varsa onu da düzelt.
6. Orijinal davranışı (level merge + sort + dedup) bozmadan yap.
```

---

## 6. Özet Tablo

| # | Dosya | Satır | Sorun | Fix |
|---|-------|-------|-------|-----|
| 1 | drawing-trend.js | 678 | `find` callback'inde null guard yok | `cl != null &&` ekle |
| 2 | drawing-trend.js | 681 | `sort` null elemanla çöker | `filter(cl => cl != null)` önce uygula |
