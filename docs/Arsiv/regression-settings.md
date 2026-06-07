# Regression Trend — Settings & Toolbar Entegrasyonu

## 1. `drawing-settings-dialog.js` — TOOL_CAPS

**ESKİ:**
```js
regression:   { priceLabel:false, extend:false, midpoint:false, stats:false, capArrows:false, hasFill:false, coordsMode:'p2' },
```

**YENİ:**
```js
regression:   { priceLabel:false, extend:false, midpoint:false, stats:false, capArrows:false, hasFill:false, hasInputs:true, coordsMode:'p2' },
```

---

## 2. `drawing-settings-dialog.js` — Tab listesine Inputs butonu ekle

**ESKİ:**
```js
          ${_getCaps(drawing.tool).isPos ? `<button class="dsd-tab ${_activeTab==='inputs'?'active':''}" data-tab="inputs">Inputs</button>` : ''}
```

**YENİ:**
```js
          ${(_getCaps(drawing.tool).isPos || _getCaps(drawing.tool).hasInputs) ? `<button class="dsd-tab ${_activeTab==='inputs'?'active':''}" data-tab="inputs">Inputs</button>` : ''}
```

---

## 3. `drawing-settings-dialog.js` — İlk aktif tab regression için Inputs olsun

**ESKİ:**
```js
    _activeTab = effectiveTab || (caps.isPos ? 'inputs' : (caps.isTextTool ? 'text' : 'style'));
```

**YENİ:**
```js
    _activeTab = effectiveTab || ((caps.isPos || caps.hasInputs) ? 'inputs' : (caps.isTextTool ? 'text' : 'style'));
```

---

## 4. `drawing-settings-dialog.js` — `_renderTab` içine Inputs ve Style dalları ekle

**ESKİ:**
```js
    if (tab === 'inputs') {
      if (_getCaps(d.tool).isPos) return DSDPositionTabs.renderPositionInputsTab(d);
    }
    if (tab === 'style') {
      if (_getCaps(d.tool).isFibo) return DSDFiboTabs.renderFibStyleTab(d);
      if (_getCaps(d.tool).isPos)  return DSDPositionTabs.renderPositionStyleTab(d);
      if (_getCaps(d.tool).isAnnotation) return DSDAnnotationTabs.renderAnnotationStyleTab(d);
      return DSDStandardTabs.renderStyleTab(d);
    }
```

**YENİ:**
```js
    if (tab === 'inputs') {
      if (_getCaps(d.tool).isPos) return DSDPositionTabs.renderPositionInputsTab(d);
      if (d.tool === 'regression') return _renderRegressionInputsTab(d);
    }
    if (tab === 'style') {
      if (_getCaps(d.tool).isFibo) return DSDFiboTabs.renderFibStyleTab(d);
      if (_getCaps(d.tool).isPos)  return DSDPositionTabs.renderPositionStyleTab(d);
      if (_getCaps(d.tool).isAnnotation) return DSDAnnotationTabs.renderAnnotationStyleTab(d);
      if (d.tool === 'regression') return _renderRegressionStyleTab(d);
      return DSDStandardTabs.renderStyleTab(d);
    }
```

---

## 5. `drawing-settings-dialog.js` — İki render fonksiyonu + event binding ekle

Dosyanın en altına, `return {` satırından hemen önce şu iki fonksiyonu ekle:

```js
  // ── Regression Trend: Inputs Tab ─────────────────
  function _renderRegressionInputsTab(d) {
    const s = d.style || {};
    const upperDev = s.upperDev ?? 2;
    const lowerDev = s.lowerDev ?? 2;
    const useUpper = s.useUpperDev !== false;
    const useLower = s.useLowerDev !== false;
    const source   = s.source || 'close';
    const sourceOpts = ['open','high','low','close','hl2','hlc3','ohlc4']
      .map(v => `<option value="${v}" ${source===v?'selected':''}>${v}</option>`)
      .join('');
    return `
      <div style="padding:8px 0;">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:7px 0;border-bottom:1px solid #2a2e39;">
          <label style="color:#d1d4dc;font-size:13px;">Upper Deviation</label>
          <input id="reg-upper-dev" type="number" min="0.1" step="0.1" value="${upperDev}"
            style="width:80px;background:#1e222d;border:1px solid #363c4e;color:#d1d4dc;border-radius:4px;padding:4px 8px;font-size:13px;text-align:right;">
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;padding:7px 0;border-bottom:1px solid #2a2e39;">
          <label style="color:#d1d4dc;font-size:13px;">Lower Deviation</label>
          <input id="reg-lower-dev" type="number" min="0.1" step="0.1" value="${lowerDev}"
            style="width:80px;background:#1e222d;border:1px solid #363c4e;color:#d1d4dc;border-radius:4px;padding:4px 8px;font-size:13px;text-align:right;">
        </div>
        <div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid #2a2e39;">
          <input id="reg-use-upper" type="checkbox" ${useUpper?'checked':''} style="width:16px;height:16px;cursor:pointer;">
          <label for="reg-use-upper" style="color:#d1d4dc;font-size:13px;cursor:pointer;">Use Upper Deviation</label>
        </div>
        <div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid #2a2e39;">
          <input id="reg-use-lower" type="checkbox" ${useLower?'checked':''} style="width:16px;height:16px;cursor:pointer;">
          <label for="reg-use-lower" style="color:#d1d4dc;font-size:13px;cursor:pointer;">Use Lower Deviation</label>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;padding:7px 0;">
          <label style="color:#d1d4dc;font-size:13px;">Source</label>
          <select id="reg-source"
            style="background:#1e222d;border:1px solid #363c4e;color:#d1d4dc;border-radius:4px;padding:4px 8px;font-size:13px;min-width:90px;">
            ${sourceOpts}
          </select>
        </div>
      </div>`;
  }

  // ── Regression Trend: Style Tab ──────────────────
  function _renderRegressionStyleTab(d) {
    const s = d.style || {};

    // Base (center line)
    const baseColor  = s.color      || '#2962ff';
    const baseWidth  = s.width      || 1;
    const baseStyle  = s.lineStyle  || 'solid';
    const showBase   = s.showBase   !== false;

    // Up band
    const upColor    = s.upColor    || '#2962ff';
    const upWidth    = s.upWidth    || 1;
    const upStyle    = s.upStyle    || 'dashed';
    const showUp     = s.showUp     !== false;

    // Down band
    const downColor  = s.downColor  || '#2962ff';
    const downWidth  = s.downWidth  || 1;
    const downStyle  = s.downStyle  || 'dashed';
    const showDown   = s.showDown   !== false;

    const extRight   = s.extendRight   === true;
    const showPearson = s.showPearson !== false;

    // Line preview SVG helper
    const linePrev = (id, color, w, st) => {
      const dash = st === 'dashed' ? '6,4' : st === 'dotted' ? '2,3' : '';
      return `<svg id="${id}" width="50" height="16" viewBox="0 0 50 16">
        <line x1="2" y1="8" x2="48" y2="8" stroke="${color}" stroke-width="${w}"
          stroke-dasharray="${dash}" stroke-linecap="round"/>
      </svg>`;
    };

    const row = (cbId, label, swatchClass, color, width, lineStyle, previewId) => `
      <div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid #2a2e39;">
        <input id="${cbId}" type="checkbox" ${(s[cbId.replace('reg-show-','show'+(cbId.includes('base')?'Base':cbId.includes('up')?'Up':'Down'))] !== false) ? 'checked' : ''} style="width:16px;height:16px;cursor:pointer;flex-shrink:0;">
        <label for="${cbId}" style="color:#d1d4dc;font-size:13px;min-width:46px;cursor:pointer;">${label}</label>
        <div class="dsd-reg-line-combo ${swatchClass}" data-color="${color}" data-width="${width}" data-linestyle="${lineStyle}"
          style="display:flex;align-items:center;gap:4px;background:#1e222d;border:1px solid #363c4e;border-radius:4px;padding:3px 7px;cursor:pointer;">
          <div class="dsd-reg-swatch" style="width:20px;height:20px;border-radius:3px;background:${color};flex-shrink:0;"></div>
          ${linePrev(previewId, color, width, lineStyle)}
        </div>
      </div>`;

    return `
      <div style="padding:8px 0;">
        ${row('reg-show-base','Base','js-reg-line-base', baseColor, baseWidth, baseStyle, 'reg-prev-base')}
        ${row('reg-show-up',  'Up',  'js-reg-line-up',   upColor,   upWidth,   upStyle,   'reg-prev-up')}
        ${row('reg-show-down','Down','js-reg-line-down',  downColor, downWidth, downStyle, 'reg-prev-down')}
        <div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid #2a2e39;">
          <input id="reg-extend-right" type="checkbox" ${extRight?'checked':''} style="width:16px;height:16px;cursor:pointer;">
          <label for="reg-extend-right" style="color:#d1d4dc;font-size:13px;cursor:pointer;">Extend lines</label>
        </div>
        <div style="display:flex;align-items:center;gap:8px;padding:7px 0;">
          <input id="reg-pearson" type="checkbox" ${showPearson?'checked':''} style="width:16px;height:16px;cursor:pointer;">
          <label for="reg-pearson" style="color:#d1d4dc;font-size:13px;cursor:pointer;">Pearson's R</label>
        </div>
      </div>`;
  }
```

---

## 6. `drawing-settings-dialog.js` — `_bindBodyEvents` içine regression event'leri ekle

`timeLabelCb` bloğunun hemen üstüne ekle:

```js
    // ── Regression Trend: Inputs tab events ──────
    const regUpperDev = overlay.querySelector('#reg-upper-dev');
    if (regUpperDev) regUpperDev.addEventListener('input', () => {
      const v = parseFloat(regUpperDev.value);
      if (!isNaN(v) && v > 0) { drawing.style = drawing.style||{}; drawing.style.upperDev = v; EventBus.emit('drawing:settings:saved'); }
    });
    const regLowerDev = overlay.querySelector('#reg-lower-dev');
    if (regLowerDev) regLowerDev.addEventListener('input', () => {
      const v = parseFloat(regLowerDev.value);
      if (!isNaN(v) && v > 0) { drawing.style = drawing.style||{}; drawing.style.lowerDev = v; EventBus.emit('drawing:settings:saved'); }
    });
    const regUseUpper = overlay.querySelector('#reg-use-upper');
    if (regUseUpper) regUseUpper.addEventListener('change', () => {
      drawing.style = drawing.style||{}; drawing.style.useUpperDev = regUseUpper.checked; EventBus.emit('drawing:settings:saved');
    });
    const regUseLower = overlay.querySelector('#reg-use-lower');
    if (regUseLower) regUseLower.addEventListener('change', () => {
      drawing.style = drawing.style||{}; drawing.style.useLowerDev = regUseLower.checked; EventBus.emit('drawing:settings:saved');
    });
    const regSource = overlay.querySelector('#reg-source');
    if (regSource) regSource.addEventListener('change', () => {
      drawing.style = drawing.style||{}; drawing.style.source = regSource.value; EventBus.emit('drawing:settings:saved');
    });

    // ── Regression Trend: Style tab events ───────
    const regExtRight = overlay.querySelector('#reg-extend-right');
    if (regExtRight) regExtRight.addEventListener('change', () => {
      drawing.style = drawing.style||{}; drawing.style.extendRight = regExtRight.checked; EventBus.emit('drawing:settings:saved');
    });
    const regPearson = overlay.querySelector('#reg-pearson');
    if (regPearson) regPearson.addEventListener('change', () => {
      drawing.style = drawing.style||{}; drawing.style.showPearson = regPearson.checked; EventBus.emit('drawing:settings:saved');
    });

    // Visibility checkboxes (Base/Up/Down)
    [
      { id: 'reg-show-base', key: 'showBase' },
      { id: 'reg-show-up',   key: 'showUp'   },
      { id: 'reg-show-down', key: 'showDown'  },
    ].forEach(({ id, key }) => {
      const cb = overlay.querySelector('#' + id);
      if (cb) cb.addEventListener('change', () => {
        drawing.style = drawing.style||{}; drawing.style[key] = cb.checked; EventBus.emit('drawing:settings:saved');
      });
    });

    // Line combo buttons (Base/Up/Down) — renk + kalınlık + stil
    [
      { selector: '.js-reg-line-base',  colorKey:'color',     widthKey:'width',     styleKey:'lineStyle', prevId:'#reg-prev-base' },
      { selector: '.js-reg-line-up',    colorKey:'upColor',   widthKey:'upWidth',   styleKey:'upStyle',   prevId:'#reg-prev-up'   },
      { selector: '.js-reg-line-down',  colorKey:'downColor', widthKey:'downWidth', styleKey:'downStyle', prevId:'#reg-prev-down' },
    ].forEach(({ selector, colorKey, widthKey, styleKey, prevId }) => {
      const combo = overlay.querySelector(selector);
      if (!combo) return;
      const swatch = combo.querySelector('.dsd-reg-swatch');
      // Renk swatchına tıklayınca sadece renk picker
      swatch?.addEventListener('click', (e) => {
        e.stopPropagation();
        DSDColorPicker.showColorPalette(swatch, combo.dataset.color || '#2962ff', (newColor) => {
          swatch.style.background = newColor;
          combo.dataset.color = newColor;
          drawing.style = drawing.style||{};
          drawing.style[colorKey] = newColor;
          const line = overlay.querySelector(prevId + ' line');
          if (line) line.setAttribute('stroke', newColor);
          EventBus.emit('drawing:settings:saved');
        });
      });
      // Combo geri kalanına tıklayınca renk+kalınlık+stil
      combo.addEventListener('click', (e) => {
        if (e.target.closest('.dsd-reg-swatch')) return;
        const curC = combo.dataset.color || '#2962ff';
        const curW = parseInt(combo.dataset.width) || 1;
        const curS = combo.dataset.linestyle || 'solid';
        DSDColorPicker.showCombinedLineSettings(combo, curC, curW, curS, true, (res) => {
          swatch.style.background = res.color;
          combo.dataset.color     = res.color;
          combo.dataset.width     = res.width;
          combo.dataset.linestyle = res.style;
          drawing.style = drawing.style||{};
          drawing.style[colorKey] = res.color;
          drawing.style[widthKey] = res.width;
          drawing.style[styleKey] = res.style;
          // Preview SVG güncelle
          const line = overlay.querySelector(prevId + ' line');
          if (line) {
            line.setAttribute('stroke', res.color);
            line.setAttribute('stroke-width', res.width);
            const dash = res.style === 'dashed' ? '6,4' : res.style === 'dotted' ? '2,3' : '';
            line.setAttribute('stroke-dasharray', dash);
          }
          EventBus.emit('drawing:settings:saved');
        });
      });
    });
```

---

## 7. `drawing-trend.js` — `_drawRegressionTrend` içinde showBase/Up/Down + ayrı renk/stil kullan

Mevcut render kodunda şu bölümleri güncelle:

**ESKİ:**
```js
      // Fill — önce çiz ki çizgiler üstüne gelsin
      const fillUp   = s.fillUp   || 'rgba(41,98,255,0.1)';
      const fillDown = s.fillDown || 'rgba(41,98,255,0.1)';
      if (useUpper) drawFill(extPoints,  upperDev * stdDev, 0, fillUp);
      if (useLower) drawFill(extPoints, 0, -lowerDev * stdDev, fillDown);

      // Center line
      drawLine(extPoints, 0);

      // Upper band
      if (useUpper) {
        ctx.setLineDash([5, 4]);
        drawLine(extPoints, upperDev * stdDev);
      }

      // Lower band
      if (useLower) {
        ctx.setLineDash([5, 4]);
        drawLine(extPoints, -lowerDev * stdDev);
      }
```

**YENİ:**
```js
      const showBase = s.showBase !== false;
      const showUp   = s.showUp   !== false;
      const showDown = s.showDown !== false;

      // Fill — önce çiz ki çizgiler üstüne gelsin
      const fillUp   = s.upColor   ? s.upColor.replace(/[\d.]+\)$/, '0.1)').replace(/^#/, 'rgba(') : 'rgba(41,98,255,0.1)';
      const fillDown = s.downColor ? s.downColor.replace(/[\d.]+\)$/, '0.1)').replace(/^#/, 'rgba(') : 'rgba(41,98,255,0.1)';
      if (useUpper && showUp)   drawFill(extPoints,  upperDev * stdDev, 0, fillUp);
      if (useLower && showDown) drawFill(extPoints, 0, -lowerDev * stdDev, fillDown);

      // Center line (Base)
      if (showBase) {
        ctx.strokeStyle = s.color     || '#2962ff';
        ctx.lineWidth   = s.width     || 1;
        const bd = s.lineStyle === 'dashed' ? [8,5] : s.lineStyle === 'dotted' ? [3,3] : [];
        ctx.setLineDash(bd);
        drawLine(extPoints, 0);
      }

      // Upper band
      if (useUpper && showUp) {
        ctx.strokeStyle = s.upColor   || s.color || '#2962ff';
        ctx.lineWidth   = s.upWidth   || 1;
        const ud = s.upStyle === 'dashed' ? [8,5] : s.upStyle === 'dotted' ? [3,3] : [5,4];
        ctx.setLineDash(ud);
        drawLine(extPoints, upperDev * stdDev);
      }

      // Lower band
      if (useLower && showDown) {
        ctx.strokeStyle = s.downColor || s.color || '#2962ff';
        ctx.lineWidth   = s.downWidth || 1;
        const dd = s.downStyle === 'dashed' ? [8,5] : s.downStyle === 'dotted' ? [3,3] : [5,4];
        ctx.setLineDash(dd);
        drawLine(extPoints, -lowerDev * stdDev);
      }
```

---

## Özet

| Dosya | Değişiklik |
|---|---|
| `drawing-settings-dialog.js` | TOOL_CAPS + tab list + activeTab + _renderTab + 2 yeni fonksiyon + _bindBodyEvents |
| `drawing-trend.js` | showBase/Up/Down kontrolü + ayrı renk/kalınlık/stil |
