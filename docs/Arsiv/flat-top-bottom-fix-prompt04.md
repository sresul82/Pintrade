# Flat Top/Bottom — Settings Dialog Style Tab Düzeltmesi

## Dosya: `dsd-standard-tabs.js` → `renderStyleTab` içindeki `flattopbottom` bloğu

### Sorunlar
1. `dsd-row-controls` div'i kapanmıyor — Extend/Prices/Background Line satırının içine yığılıyor
2. `js-combined-line` class yok — Line swatch'a tıklanınca kalınlık/style picker açılmıyor
3. `capArrows` butonları (ok uçları) eksik — trendline'daki gibi olması isteniyor

### Mevcut bloğu **tamamen** şununla değiştir:

`if (d.tool === 'flattopbottom') {` ile başlayıp `return ...;` ile biten tüm bloğu sil ve yerine şunu yaz:

```js
if (d.tool === 'flattopbottom') {
  const ftColor    = s.color    || '#FF9800';
  const ftWidth    = s.width    || 1;
  const showPrices = s.showPrices !== false;
  const priceColor = s.priceColor || '#F44336';
  const showBg     = s.background !== false;
  const bgColor    = s.bgColor    || ftColor;
  const dashAttr   = s.lineStyle === 'dashed' ? 'stroke-dasharray="8,5"'
                   : s.lineStyle === 'dotted' ? 'stroke-dasharray="3,3"' : '';
  const capLeft    = s.capLeft  || 'normal';
  const capRight   = s.capRight || 'normal';
  const extLeft    = !!s.extendLeft;
  const extRight   = !!s.extendRight;

  let curOp = s.bgOpacity !== undefined ? s.bgOpacity : 15;
  let displayBgColor = bgColor;
  if (bgColor.startsWith('#')) {
    let c = bgColor.substring(1);
    if (c.length === 3) c = c[0]+c[0]+c[1]+c[1]+c[2]+c[2];
    const r = parseInt(c.slice(0,2), 16);
    const g = parseInt(c.slice(2,4), 16);
    const b = parseInt(c.slice(4,6), 16);
    displayBgColor = `rgba(${r},${g},${b},${curOp/100})`;
  }

  const capLabels = {
    normal: `<svg width="24" height="12" viewBox="0 0 24 12"><circle cx="3" cy="6" r="2.5" fill="none" stroke="currentColor" stroke-width="1.5"/><line x1="5.5" y1="6" x2="22" y2="6" stroke="currentColor" stroke-width="1.5"/></svg>`,
    arrow:  `<svg width="24" height="12" viewBox="0 0 24 12"><line x1="2" y1="6" x2="18" y2="6" stroke="currentColor" stroke-width="1.5"/><polyline points="12,2 18,6 12,10" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>`
  };

  return `
    <div class="dsd-row">
      <label class="dsd-label">Line</label>
      <div class="dsd-row-controls">
        <div class="dsd-color-swatch js-style-color js-combined-line"
             style="background:${ftColor}; width:24px; height:24px; border-radius:4px; cursor:pointer;"
             data-color="${ftColor}" title="Color, thickness, style"></div>
        <div class="dsd-cap-drop" style="position:relative;margin-right:4px;">
          <div class="dsd-cap-drop-btn" data-side="left"
               style="display:flex;align-items:center;gap:6px;background:#131722;border:1px solid #7d808b;border-radius:4px;height:30px;padding:0 8px;cursor:pointer;color:#d1d4dc;">
            <span class="dsd-cap-icon" style="transform:scaleX(-1);">${capLabels[capLeft] || capLabels.normal}</span>
            <svg width="10" height="10" viewBox="0 0 10 10" style="flex-shrink:0;color:#787b86;"><path d="M2 3.5l3 3 3-3" stroke="currentColor" fill="none" stroke-width="1.5"/></svg>
          </div>
        </div>
        <div class="dsd-cap-drop" style="position:relative;">
          <div class="dsd-cap-drop-btn" data-side="right"
               style="display:flex;align-items:center;gap:6px;background:#131722;border:1px solid #7d808b;border-radius:4px;height:30px;padding:0 8px;cursor:pointer;color:#d1d4dc;">
            <span class="dsd-cap-icon">${capLabels[capRight] || capLabels.normal}</span>
            <svg width="10" height="10" viewBox="0 0 10 10" style="flex-shrink:0;color:#787b86;"><path d="M2 3.5l3 3 3-3" stroke="currentColor" fill="none" stroke-width="1.5"/></svg>
          </div>
        </div>
      </div>
    </div>

    <div class="dsd-section-label">EXTEND LINE</div>
    <div class="dsd-row dsd-row-check">
      <label class="dsd-checkbox-label">
        <input type="checkbox" id="dsd-ext-right" ${extRight ? 'checked' : ''}>
        Extend right line
      </label>
    </div>
    <div class="dsd-row dsd-row-check">
      <label class="dsd-checkbox-label">
        <input type="checkbox" id="dsd-ext-left" ${extLeft ? 'checked' : ''}>
        Extend left line
      </label>
    </div>

    <div class="dsd-row dsd-row-check">
      <label class="dsd-checkbox-label" style="width:104px; flex-shrink:0;">
        <input type="checkbox" id="dsd-showprices" ${showPrices ? 'checked' : ''}>
        Prices
      </label>
      <div class="dsd-row-controls" style="gap:6px; align-items:center;">
        <div class="dsd-color-swatch js-price-color"
             style="background:${priceColor}" data-color="${priceColor}" title="Price label color"></div>
        <select class="dsd-select dsd-select-sm" id="dsd-pricefontsize" style="width:62px;">
          ${[8,10,11,12,13,14,16,18,20].map(sz =>
            `<option value="${sz}" ${(s.priceFontSize||12)==sz?'selected':''}>${sz}</option>`
          ).join('')}
        </select>
        <button class="dsd-fmt-btn ${s.priceBold?'active':''}"   id="dsd-pricebold"   title="Bold"><b>B</b></button>
        <button class="dsd-fmt-btn ${s.priceItalic?'active':''}" id="dsd-priceitalic" title="Italic"><i>I</i></button>
      </div>
    </div>

    <div class="dsd-row dsd-row-check">
      <label class="dsd-checkbox-label" style="width:104px; flex-shrink:0;">
        <input type="checkbox" id="dsd-ftbg" ${showBg ? 'checked' : ''}>
        Background
      </label>
      <div class="dsd-row-controls">
        <div class="dsd-color-swatch js-ftbg-color"
             style="background:${displayBgColor}" data-color="${bgColor}" title="Background color"></div>
      </div>
    </div>
  `;
}
```

---

## Etkilenen Dosya

- **`dsd-standard-tabs.js`** → `renderStyleTab` içindeki `flattopbottom` bloğu

Başka hiçbir dosya değişmez.
