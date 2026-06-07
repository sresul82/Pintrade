# FlatTopBottom Color Bug Fix

## Dosya 1: `js/drawing/ui/property-toolbar.js`

### Satır ~420 — Line color default fallback düzeltmesi

**Mevcut:**
```js
const color = s.color || '#2962ff';
```

**Yeni:**
```js
const color = s.color || (_drawing.tool === 'flattopbottom' ? '#FF9800' : '#2962ff');
```

---

## Dosya 2: `js/drawing/ui/dsd-apply.js`

### `applyFromForm` fonksiyonu — `// Rectangle specific fields` bloğunun hemen altına ekle

**Eklenecek kod:**
```js
// FlatTopBottom specific fields
if (drawing.tool === 'flattopbottom') {
  const ftBgCb = get('dsd-ftbg');
  if (ftBgCb) s.background = ftBgCb.checked;
  const ftShowPricesCb = get('dsd-showprices');
  if (ftShowPricesCb) s.showPrices = ftShowPricesCb.checked;
  const ftPriceSwatch = overlay.querySelector('.js-price-color');
  if (ftPriceSwatch) s.priceColor = ftPriceSwatch.dataset.color;
  const ftPriceBoldBtn = get('dsd-pricebold');
  if (ftPriceBoldBtn) s.priceBold = ftPriceBoldBtn.classList.contains('active');
  const ftPriceItalicBtn = get('dsd-priceitalic');
  if (ftPriceItalicBtn) s.priceItalic = ftPriceItalicBtn.classList.contains('active');
  const ftPriceFsEl = get('dsd-pricefontsize');
  if (ftPriceFsEl) s.priceFontSize = parseInt(ftPriceFsEl.value);
  const ftBgSwatch = overlay.querySelector('.js-ftbg-color');
  if (ftBgSwatch) {
    s.bgColor = ftBgSwatch.dataset.color;
    // bgOpacity ayrı tutulur; swatch sadece hex rengini taşır
    // opacity dsd-standard-tabs'ta displayBgColor hesaplanırken s.bgOpacity kullanılır
  }
  const capLeftEl = overlay.querySelector('.dsd-cap-drop-btn[data-side="left"] .dsd-cap-icon');
  const capRightEl = overlay.querySelector('.dsd-cap-drop-btn[data-side="right"] .dsd-cap-icon');
  if (capLeftEl) s.capLeft = capLeftEl.dataset.cap || s.capLeft;
  if (capRightEl) s.capRight = capRightEl.dataset.cap || s.capRight;
}
```

**Yerleştirme referansı — mevcut kodda bu satırın hemen altına:**
```js
    const showBorderCb = get('dsd-showborder');
    if (showBorderCb) s.showBorder = showBorderCb.checked;
    const borderSwatch = overlay.querySelector('.js-border-color');
    if (borderSwatch) s.borderColor = borderSwatch.dataset.color;
    const midlineSwatch = overlay.querySelector('.js-midline-color');
    if (midlineSwatch) s.midlineColor = midlineSwatch.dataset.color;
```

---

## Dosya 3: `js/drawing/ui/dsd-standard-tabs.js`

### `renderStyleTab` — flattopbottom bloğu, `js-ftbg-color` swatch'ına `data-cap` desteği için cap dropdown'larına cap değerini yaz

**Mevcut** (capLabels div'lerinde `data-side` var ama seçili cap değeri DOM'a yazılmıyor):
```js
        <div class="dsd-cap-drop-btn" data-side="left"
```

**Yeni** — her iki `.dsd-cap-drop-btn` içindeki `.dsd-cap-icon` span'ına `data-cap` ekle:
```js
        <div class="dsd-cap-drop-btn" data-side="left"
             style="display:flex;align-items:center;gap:6px;background:#131722;border:1px solid #7d808b;border-radius:4px;height:30px;padding:0 8px;cursor:pointer;color:#d1d4dc;">
          <span class="dsd-cap-icon" data-cap="${capLeft}" style="transform:scaleX(-1);">${capLabels[capLeft] || capLabels.normal}</span>
```

```js
        <div class="dsd-cap-drop-btn" data-side="right"
             style="display:flex;align-items:center;gap:6px;background:#131722;border:1px solid #7d808b;border-radius:4px;height:30px;padding:0 8px;cursor:pointer;color:#d1d4dc;">
          <span class="dsd-cap-icon" data-cap="${capRight}">${capLabels[capRight] || capLabels.normal}</span>
```

### `renderStyleTab` — pricelabel background color default tutarsızlığı

`pricelabel` için settings Style tab'ında background color swatch **yok** — bu color sadece annotation tab'ında (`js-anno-bg`) render ediliyor. `dsd-apply.js`'teki annotation bloğu zaten `s.fillColor = bgSwatch.dataset.color` yazıyor. Flyout toolbar'da ise `pricelabel` için `pt-fill-color-bar` şunu kullanıyor:

```js
background:${s.fillColor || 'transparent'}
```

Settings annotation tab'ındaki default:

**`dsd-annotation-tabs.js` dosyasını da paylaş** — `pricelabel` için `s.fillColor` default değerinin ne olduğunu görmek gerekiyor. Eğer orada `s.fillColor || 'rgba(41,98,255,0.2)'` veya başka bir renk varsa, `property-toolbar.js` satır ~644'teki `'transparent'` ile uyuşmuyor demektir ve o fallback'i aynı değerle eşleştirmek gerekir.
