# Çift Tıklama — Cetvel Bölgesinde Araç Settings Açılıyor: Düzeltme Talimatı

## Sorunun Kök Nedeni

`chart-pane.js` içinde `drawingCanvas` boyutu fiyat ve zaman cetvelinin **üzerine taşmaması** için kırpılmaktadır:

```
drawingCanvas genişliği  = pane genişliği − priceScale genişliği  (scaleW ~65px)
drawingCanvas yüksekliği = pane yüksekliği − timeScale yüksekliği (timeScaleH ~22px)
```

Yani `drawingCanvas`, cetvel bölgelerine **fiziksel olarak uzanmaz**. Cetvel bölgelerindeki tıklamalar `drawingCanvas`'a değil, doğrudan Lightweight Charts'ın kendi DOM elementine düşer.

`chart-pane.js`'de çift tıklama olayı şu şekilde kurulmuştur:

```js
// chart-pane.js satır ~173
this.cvs.addEventListener('dblclick', e => {
  if (e.button !== 0) return;
  if (window.DrawingManager && window.DrawingManager.onDoubleClick) {
    const claimed = window.DrawingManager.onDoubleClick(this, e);
    if (claimed) { e.preventDefault(); e.stopPropagation(); }
  }
}, { capture: true });
```

Bu listener **`this.cvs`** (tüm pane container'ı) üzerinde dinlemektedir — cetvel bölgeleri dahil.

`drawing-core.js`'deki `onDoubleClick` fonksiyonu ise koordinatı `pane.cvs.getBoundingClientRect()`'e göre hesaplar ve hit-test yapar:

```js
const rect = pane.cvs.getBoundingClientRect();
const x = e.clientX - rect.left;
const y = e.clientY - rect.top;
```

Cetvel bölgesine tıklandığında `x` ve `y`, `drawingCanvas` dışındaki bir koordinatı işaret eder. Ancak bazı araçlar (özellikle `vline`, `hline`, tüm ekranı kaplayan araçlar) geniş hit-test alanına sahip olduğundan **cetvel koordinatı bile hit döndürebilir** ve settings dialogu açılır. Ardından `return true` ile olay tüketildiğinden `fitContent()` hiç tetiklenmez.

---

## Yapılacak Tek Değişiklik — `drawing-core.js`

`onDoubleClick` fonksiyonunun başına, tıklama cetvel bölgesine düştüyse **erken çıkış** eklenecek.

---

### Değişiklik — `onDoubleClick` fonksiyonuna cetvel bölgesi kontrolü ekle

**Dosya:** `drawing-core.js`  
**Fonksiyon:** `onDoubleClick(pane, e)`

**Eski kod:**
```js
  function onDoubleClick(pane, e) {
    // Bekleyen inline text editörünü iptal et — double-click'te sadece settings açılır
    if (_pendingTextEditTimer) {
      clearTimeout(_pendingTextEditTimer);
      _pendingTextEditTimer = null;
    }

    const rect = pane.cvs.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const drawings = getDrawingsForPane(pane.symbol);
```

**Yeni kod:**
```js
  function onDoubleClick(pane, e) {
    // Bekleyen inline text editörünü iptal et — double-click'te sadece settings açılır
    if (_pendingTextEditTimer) {
      clearTimeout(_pendingTextEditTimer);
      _pendingTextEditTimer = null;
    }

    const rect = pane.cvs.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Fiyat cetveli veya zaman cetveli bölgesine tıklandıysa drawing hit-test yapma.
    // Bu bölgelerdeki çift tıklama fitContent() için LWC'ye bırakılmalı.
    const timeScaleH = 22;
    const priceScaleW = (pane.chart
      ? (pane.chart.priceScale(pane.priceSide === 'left' ? 'left' : 'right').width() || 65)
      : 65);
    const drawingW = rect.width - priceScaleW;
    const drawingH = rect.height - timeScaleH;
    const drawingOffsetX = pane.priceSide === 'left' ? priceScaleW : 0;
    if (x < drawingOffsetX || x > drawingOffsetX + drawingW || y > drawingH) {
      return false;
    }

    const drawings = getDrawingsForPane(pane.symbol);
```

---

## Neden Bu Yeterli?

`return false` döndürüldüğünde `chart-pane.js` tarafındaki `claimed` değişkeni `false` olur ve `e.stopPropagation()` çağrılmaz. Olay Lightweight Charts'a ulaşır ve kendi `dblclick` → `fitContent()` davranışı devreye girer.

Cetvel **dışında** olan tıklamalarda mantık tamamen eskisi gibi çalışmaya devam eder.

---

## Özet

| Dosya | Değişiklik |
|---|---|
| `drawing-core.js` | `onDoubleClick` başına 9 satır cetvel bölgesi kontrolü eklenir |
| `chart-pane.js` | Dokunma |
| `chart-core.js` | Dokunma |
