# Color Bug Fix — Final

---

## Bug 1 — pricelabel: Flyout fillColor picker yanlış default açılıyor

**Dosya:** `js/drawing/ui/property-toolbar.js`

`pt-btn-fillcolor` onclick handler — `pricelabel` için `curFill` hesabı.

**Mevcut (satır ~914-916):**
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

---

**Flyout toolbar HTML render — pricelabel fill bar default rengi.**

**Mevcut (satır ~654):**
```js
<div id="pt-fill-color-bar" style="width:16px;height:4px;border-radius:1px;margin-top:1px;background:${s.fillColor || 'transparent'};"></div>
```

**Yeni:**
```js
<div id="pt-fill-color-bar" style="width:16px;height:4px;border-radius:1px;margin-top:1px;background:${s.fillColor || '#2962ff'};"></div>
```

---

## Bug 2 — pricelabel: Settings style tab'ında `js-anno-bg` handler `fillColor` yazıyor ama `drawing-core` default'u `s.fillColor` — tutarlı, sorun yok. Ancak `dsd-apply.js`'te annotation bloğu `pricelabel` için `bgSwatch = overlay.querySelector('.js-anno-bg')` okuyup `s.fillColor`'a yazıyor — bu doğru. **Sorun:** `dsd-annotation-tabs.js`'te `pricelabel` için `tool === 'pricelabel'` bloğu erken `return` yapıyor, `hasFillColor` bloğuna hiç ulaşmıyor. Yani Settings'te iki farklı "Background" satırı render ediliyor ama `dsd-apply.js` sadece ilkini (`js-anno-bg`) okuyor.

**Dosya:** `js/drawing/ui/dsd-annotation-tabs.js`

`renderAnnotationStyleTab` içinde `pricelabel` bloğu — Background swatch class'ı `js-anno-bg` olmalı (zaten öyle, doğru). Sorun yok burada.

**Asıl sorun:** `dsd-apply.js` annotation bloğunda `pricelabel` için `s.fillColor` yazılıyor ama `pricelabel`'ın `tool === 'pricelabel'` early-return bloğundan dönen HTML'de swatch class'ı `js-anno-bg` — bu `drawing-settings-dialog.js`'teki `js-anno-bg` handler'ına bağlanıyor ve `drawing.style.fillColor = newColor` yazıyor. Bu zincir doğru.

**Gerçek sorun:** `drawing-core.js` line 43'te `pricelabel` default → `fillColor: '#2962ff'` var. `drawing.style` nesnesine bu default **sadece ilk kez çizilirken** `getDefaultStyle()` ile atanıyor. Eğer `drawing.style.fillColor` henüz set edilmemişse (undefined), annotation tab `s.fillColor || '#2962ff'` ile `#2962ff` render ediyor — bu doğru. Flyout `s.fillColor || 'rgba(0,0,0,0)'` ile yanlış açılıyor — Bug 1 bunu düzeltiyor.

---

## Bug 3 — flattopbottom: default'a dönünce flyout rengi chart/settings ile uyuşmuyor

**Sebep:** `_buildToolbar` başında `const color = s.color || '#2962ff'` — flattopbottom default'u `#FF9800` ama fallback `#2962ff`.

**Dosya:** `js/drawing/ui/property-toolbar.js`

**Mevcut (satır ~420):**
```js
const color = s.color || '#2962ff';
```

**Yeni:**
```js
const color = s.color || (_drawing.tool === 'flattopbottom' ? '#FF9800' : '#2962ff');
```

---

## Bug 4 — flattopbottom: Settings OK'da `bgColor`, `showPrices`, `priceColor` vb. yazılmıyor

**Dosya:** `js/drawing/ui/dsd-apply.js`

`applyFromForm` içinde, şu satırın hemen altına ekle:

```js
    const midlineSwatch = overlay.querySelector('.js-midline-color');
    if (midlineSwatch) s.midlineColor = midlineSwatch.dataset.color;
```

**Eklenecek blok:**
```js
    // ── FlatTopBottom specific apply ────────────────────────────────
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

## Bug 5 — flattopbottom: line rengi değişince background rengi de değişiyor

**Sebep:** `dsd-standard-tabs.js`'te flattopbottom line swatch'ı `js-combined-line` class'ına sahip. `drawing-settings-dialog.js`'teki `js-combined-line` handler'ı sadece `drawing.style.color` yazıyor — `bgColor`'a dokunmuyor. **Bu handler tarafı temiz.**

Sorun `dsd-apply.js`'te: `applyFromForm` çağrıldığında flattopbottom için yukarıdaki Bug 4 bloğu yoktu, dolayısıyla `js-ftbg-color` swatch'ı hiç okunmuyordu. Bug 4 fix'i uygulandıktan sonra bu sorun da çözülür — çünkü `bgColor` artık kendi swatchından okunacak, line swatch'ından değil.

**Ek kontrol:** `dsd-standard-tabs.js`'te flattopbottom line swatch class'ı `js-combined-line` — bu `drawing-settings-dialog.js`'te sadece `s.color` yazan handler'a bağlı. `js-ftbg-color` swatch ise ayrı — Bug 4 bloğuyla `s.bgColor`'a bağlanıyor. İki swatch birbirinden bağımsız, sorun yok.
