# Fix

---

## Dosya 1: `js/drawing/ui/dsd-standard-tabs.js`

flattopbottom line swatch'ından `js-combined-line` kaldır, `js-ftb-line-combo` ekle.

**Mevcut (satır ~75):**
```js
        <div class="dsd-color-swatch js-style-color js-combined-line"
             style="background:${ftColor}; width:24px; height:24px; border-radius:4px; cursor:pointer;"
             data-color="${ftColor}" title="Color, thickness, style"></div>
```

**Yeni:**
```js
        <div class="dsd-color-swatch js-style-color js-ftb-line-combo"
             style="background:${ftColor}; width:24px; height:24px; border-radius:4px; cursor:pointer;"
             data-color="${ftColor}" title="Color, thickness, style"></div>
```

---

## Dosya 2: `js/drawing/ui/dsd-apply.js`

`applyFromForm` içinde şu satırın hemen altına flattopbottom bloğunu ekle:

```js
    const midlineSwatch = overlay.querySelector('.js-midline-color');
    if (midlineSwatch) s.midlineColor = midlineSwatch.dataset.color;
```

**Eklenecek:**
```js
    if (drawing.tool === 'flattopbottom') {
      const ftBgCb = get('dsd-ftbg');
      if (ftBgCb) s.background = ftBgCb.checked;
      const ftBgSwatch = overlay.querySelector('.js-ftbg-color');
      if (ftBgSwatch && ftBgSwatch.dataset.color) s.bgColor = ftBgSwatch.dataset.color;
      const ftShowPricesCb = get('dsd-showprices');
      if (ftShowPricesCb) s.showPrices = ftShowPricesCb.checked;
      const ftPriceSwatch = overlay.querySelector('.js-price-color');
      if (ftPriceSwatch && ftPriceSwatch.dataset.color) s.priceColor = ftPriceSwatch.dataset.color;
      const ftPriceBoldBtn = get('dsd-pricebold');
      if (ftPriceBoldBtn) s.priceBold = ftPriceBoldBtn.classList.contains('active');
      const ftPriceItalicBtn = get('dsd-priceitalic');
      if (ftPriceItalicBtn) s.priceItalic = ftPriceItalicBtn.classList.contains('active');
      const ftPriceFsEl = get('dsd-pricefontsize');
      if (ftPriceFsEl) s.priceFontSize = parseInt(ftPriceFsEl.value);
    }
```

---

## Dosya 3: `js/drawing/ui/property-toolbar.js`

### Fix A — flattopbottom default renk (`_buildToolbar` satır ~420)

**Mevcut:**
```js
const color = s.color || '#2962ff';
```

**Yeni:**
```js
const color = s.color || (_drawing.tool === 'flattopbottom' ? '#FF9800' : '#2962ff');
```

---

### Fix B — pricelabel flyout fill bar default rengi (satır ~654)

**Mevcut:**
```js
<div id="pt-fill-color-bar" style="width:16px;height:4px;border-radius:1px;margin-top:1px;background:${s.fillColor || 'transparent'};"></div>
```

**Yeni:**
```js
<div id="pt-fill-color-bar" style="width:16px;height:4px;border-radius:1px;margin-top:1px;background:${s.fillColor || '#2962ff'};"></div>
```

---

### Fix C — pricelabel picker default rengi (`pt-btn-fillcolor` onclick, satır ~914)

**Mevcut:**
```js
const curFill = _drawing.tool === 'texttool' || ['note', 'pricenote', 'tableanno', 'callout', 'pricelabel'].includes(_drawing.tool)
  ? (_drawing.style?.fillColor || 'rgba(0,0,0,0)')
  : (_drawing.tool === 'flagmark' ? (_drawing.style?.color || '#2962ff') : (_drawing.style?.fillColor || 'rgba(9, 105, 218, 0.2)'));
```

**Yeni:**
```js
const curFill = _drawing.tool === 'texttool' || ['note', 'pricenote', 'tableanno', 'callout'].includes(_drawing.tool)
  ? (_drawing.style?.fillColor || 'rgba(0,0,0,0)')
  : _drawing.tool === 'pricelabel'
    ? (_drawing.style?.fillColor || '#2962ff')
    : (_drawing.tool === 'flagmark' ? (_drawing.style?.color || '#2962ff') : (_drawing.style?.fillColor || 'rgba(9, 105, 218, 0.2)'));
```
