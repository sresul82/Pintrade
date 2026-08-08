/**
 * DSD Apply
 * Ayar penceresindeki form verilerini okuyup cizime (drawing) uygulama
 */
window.DSDApply = (() => {

  function applyFromForm(overlay, drawing) {
    const s = drawing.style = drawing.style || {};
    const get = id => overlay.querySelector('#' + id);

    // Style tab — all reads are null-safe; absent fields are simply skipped
    const extLeftEl  = get('dsd-ext-left');
    const extRightEl = get('dsd-ext-right');
    if (extLeftEl)  s.extendLeft  = extLeftEl.checked;
    if (extRightEl) s.extendRight = extRightEl.checked;
    const midEl    = get('dsd-midpoint');   if (midEl)    s.midpoint   = midEl.checked;
    const priceEl  = get('dsd-pricelabel'); if (priceEl)  s.priceLabel = priceEl.checked;
    const statsPEl = get('dsd-statspos');   if (statsPEl) s.statsPos   = statsPEl.value;
    const aStEl    = get('dsd-alwaysstats');if (aStEl)    s.alwaysStats= aStEl.checked;
    const statsOnEl= get('dsd-stats-on');   if (statsOnEl) s.statsOn    = statsOnEl.checked;
    const allStatCbs = overlay.querySelectorAll('.js-stat-field');
    if (allStatCbs.length > 0) {
      const statCbs = overlay.querySelectorAll('.js-stat-field:checked');
      s.statsFields = [...statCbs].map(c => c.dataset.field);
    }

    // Fill / background color (channel, rect) — read from swatch data-color
    const fillSwatch = overlay.querySelector('.js-fill-color');
    if (fillSwatch) s.fillColor = fillSwatch.dataset.color;
    
    // Rectangle specific fields
    const midLineCb = get('dsd-midline');
    if (midLineCb) s.showMidline = midLineCb.checked;
    const showBgCb = get('dsd-showbg');
    if (showBgCb) s.showBg = showBgCb.checked;
    const showBorderCb = get('dsd-showborder');
    if (showBorderCb) s.showBorder = showBorderCb.checked;
    const borderSwatch = overlay.querySelector('.js-border-color');
    if (borderSwatch) s.borderColor = borderSwatch.dataset.color;
    const midlineSwatch = overlay.querySelector('.js-midline-color');
    if (midlineSwatch) s.midlineColor = midlineSwatch.dataset.color;

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

    // Text tab
    const fsEl  = get('dsd-fontsize');
    if (fsEl) {
      if (drawing.tool === 'pricenote') s.userFontSize = parseInt(fsEl.value);
      else s.fontSize = parseInt(fsEl.value);
    }
    const txtEl = get('dsd-text');
    if (txtEl) {
      const annotationTools = ['note','callout','pricenote','pricelabel','tableanno','flagmark'];
      if (drawing.tool === 'texttool' || annotationTools.includes(drawing.tool)) {
        drawing.text = txtEl.value;
      } else {
        s.text = txtEl.value;
      }

      const textWrapCb = get('dsd-text-wrap');
      if (textWrapCb) s.textWrap = textWrapCb.checked;
    }
    const tavEl = get('dsd-textAlignV'); if (tavEl) s.textAlignV = tavEl.value;
    const tahEl = get('dsd-textAlignH'); if (tahEl) s.textAlignH = tahEl.value;

    // Annotation style tab (Note, Callout, Price Note, Price Label, Table)
    const annotTools = ['note','callout','pricenote','pricelabel','tableanno','flagmark'];
    if (annotTools.includes(drawing.tool)) {
      const bgOnCb = get('dsd-anno-bg-on');
      if (bgOnCb) s.showFill = bgOnCb.checked;
      const borderOnCb = get('dsd-anno-border-on');
      if (borderOnCb) s.showBorder = borderOnCb.checked;
      const bgSwatch = overlay.querySelector('.js-anno-bg');
      if (bgSwatch) s.fillColor = bgSwatch.dataset.color;
      const borderSwatch = overlay.querySelector('.js-anno-border');
      if (borderSwatch) s.borderColor = borderSwatch.dataset.color;
      const lineSwatch = overlay.querySelector('.js-anno-line');
      if (lineSwatch) s.color = lineSwatch.dataset.color;
      const textSwatch = overlay.querySelector('.js-anno-text-color');
      if (textSwatch) s.textColor = textSwatch.dataset.color;

      const annoBoldBtn = get('dsd-anno-bold');
      if (annoBoldBtn) s.bold = annoBoldBtn.classList.contains('active');
      const annoItalicBtn = get('dsd-anno-italic');
      if (annoItalicBtn) s.italic = annoItalicBtn.classList.contains('active');
      const annoFsEl = get('dsd-anno-fontsize');
      if (annoFsEl) s.fontSize = parseInt(annoFsEl.value);

      // Bold / italic from text tab
      const boldBtn = get('dsd-bold');
      if (boldBtn) {
        if (drawing.tool === 'pricenote') s.userBold = boldBtn.classList.contains('active');
        else s.bold = boldBtn.classList.contains('active');
      }
      const italicBtn = get('dsd-italic');
      if (italicBtn) {
        if (drawing.tool === 'pricenote') s.userItalic = italicBtn.classList.contains('active');
        else s.italic = italicBtn.classList.contains('active');
      }

      // Callout Text tab swatches (use dedicated classes so they don't conflict with Style tab)
      const calloutBgSwatch = overlay.querySelector('.js-callout-bg');
      if (calloutBgSwatch) s.fillColor = calloutBgSwatch.dataset.color;
      const calloutBorderSwatch = overlay.querySelector('.js-callout-border');
      if (calloutBorderSwatch) s.borderColor = calloutBorderSwatch.dataset.color;

      // Text swatch from Text tab (js-text-color)
      const textSwatchTt = overlay.querySelector('.js-text-color');
      if (textSwatchTt) {
        if (drawing.tool === 'pricenote') s.userTextColor = textSwatchTt.dataset.color;
        else s.textColor = textSwatchTt.dataset.color;
      }
    }

    // Coords tab — write back based on what fields exist in DOM

    const p1pEl = get('dsd-p1price');
    const p1bEl = get('dsd-p1bar');
    const p2pEl = get('dsd-p2price');
    const p2bEl = get('dsd-p2bar');
    const p3pEl = get('dsd-p3price');
    const p3bEl = get('dsd-p3bar');

    if (p1pEl) {
      const v = parseFloat(p1pEl.value);
      if (!isNaN(v)) {
        if (drawing.p1) drawing.p1.price = v;
        else drawing.price = v; // hline fallback
      }
    }
    if (p1bEl) {
      const vStr = p1bEl.value;
      if (vStr !== '') {
        const origTime = drawing.p1 ? drawing.p1.time : drawing.time;
        const parsed = parseTimeVal(vStr, origTime);
        if (parsed !== null) {
          if (drawing.p1) drawing.p1.time = parsed;
          else drawing.time = parsed;
        }
      }
    }
    if (p2pEl && drawing.p2) {
      const v = parseFloat(p2pEl.value);
      if (!isNaN(v)) drawing.p2.price = v;
    }
    if (p2bEl && drawing.p2) {
      const parsed = parseTimeVal(p2bEl.value, drawing.p2.time);
      if (parsed !== null) drawing.p2.time = parsed;
    }
    if (p3pEl && drawing.p3) {
      const v = parseFloat(p3pEl.value);
      if (!isNaN(v)) drawing.p3.price = v;
    }
    if (p3bEl && drawing.p3) {
      const parsed = parseTimeVal(p3bEl.value, drawing.p3.time);
      if (parsed !== null) drawing.p3.time = parsed;
    }

    
    // Fibo tab
    const tlActiveEl = get('dsd-tl-active'); if(tlActiveEl) s.trendLineActive = tlActiveEl.checked;
    const fibExtendEl = get('dsd-fib-extend'); 
    if (fibExtendEl) {
       s.extendLeft = ['left','both'].includes(fibExtendEl.value);
       s.extendRight = ['right','both'].includes(fibExtendEl.value);
    }
    const fibBGEr = get('dsd-fib-bg'); if(fibBGEr) s.fibBg = fibBGEr.checked;
    const fibBgAlph = get('dsd-fib-bgalph'); if(fibBgAlph) s.fibBgAlpha = parseFloat(fibBgAlph.value);
    const fibRevEl = get('dsd-fib-reverse'); if(fibRevEl) s.fibReverse = fibRevEl.checked;
    const fibPricesEl = get('dsd-fib-prices'); if(fibPricesEl) s.fibPrices = fibPricesEl.checked;
    const fibLevelsActEl = get('dsd-fib-levels-active'); if(fibLevelsActEl) s.fibLevelsType = fibLevelsActEl.checked;
    const fibLevelsModEl = get('dsd-fib-levels-mode'); if(fibLevelsModEl) s.fibLevelsMode = fibLevelsModEl.value;
    const fibLabHEl = get('dsd-fib-labels-h'); if(fibLabHEl) s.fibLabelsH = fibLabHEl.value;
    const fibLabVEl = get('dsd-fib-labels-v'); if(fibLabVEl) s.fibLabelsV = fibLabVEl.value;
    const fibFsEl = get('dsd-fib-fontsize'); if(fibFsEl) s.fibFontSize = parseInt(fibFsEl.value);
    const fibLogEl = get('dsd-fib-logscale'); if(fibLogEl) s.fibLogScale = fibLogEl.checked;
    
    const fibCheckboxes = overlay.querySelectorAll('.js-fib-active:not([class*="js-sf-"])');
    if (fibCheckboxes.length > 0) {
       s.fibLevels = s.fibLevels || [];
       // Eskiden burada sabit 24 bekleniyordu — liste artık (Fib Time Zone
       // hariç) 12 satıra indirildiği için bu koşul HER apply'da tutuyor ve
       // diziyi 24 boş satıra sıfırlıyordu. Artık ekrandaki gerçek checkbox
       // sayısına göre boyutlandırılıyor.
       if (s.fibLevels.length !== fibCheckboxes.length) s.fibLevels = new Array(fibCheckboxes.length).fill(null).map(()=>({v:0,color:'#000',active:false}));
       fibCheckboxes.forEach((cb, i) => { s.fibLevels[i].active = cb.checked; });
       overlay.querySelectorAll('.js-fib-val:not([class*="js-sf-"])').forEach((inp, i) => { s.fibLevels[i].v = parseFloat(inp.value) || 0; });
       overlay.querySelectorAll('.js-fib-color:not([class*="js-sf-"])').forEach((swatch, i) => { s.fibLevels[i].color = swatch.dataset.color; });
    }

    if (drawing.tool === 'fib-speedfan') {
       s.labelsLeft = get('dsd-sf-labels-left')?.checked;
       s.labelsRight = get('dsd-sf-labels-right')?.checked;
       s.labelsTop = get('dsd-sf-labels-top')?.checked;
       s.labelsBottom = get('dsd-sf-labels-bottom')?.checked;
       s.gridActive = get('dsd-sf-grid-active')?.checked;
       s.gridColor = overlay.querySelector('.js-grid-color')?.dataset.color;
       
       const priceCbs = overlay.querySelectorAll('.js-sf-price');
       if (priceCbs.length > 0) {
          s.priceLevels = s.priceLevels || [];
          priceCbs.forEach((cb, i) => { 
             s.priceLevels[i] = s.priceLevels[i] || {v:0,color:'#000',active:false,width:1,style:'solid'};
             s.priceLevels[i].active = cb.checked; 
          });
          overlay.querySelectorAll('.js-sf-price-val').forEach((inp, i) => { s.priceLevels[i].v = parseFloat(inp.value) || 0; });
          overlay.querySelectorAll('.js-sf-price-col').forEach((swatch, i) => { s.priceLevels[i].color = swatch.dataset.color; });
       }
       const timeCbs = overlay.querySelectorAll('.js-sf-time');
       if (timeCbs.length > 0) {
          s.timeLevels = s.timeLevels || [];
          timeCbs.forEach((cb, i) => { 
             s.timeLevels[i] = s.timeLevels[i] || {v:0,color:'#000',active:false,width:1,style:'solid'};
             s.timeLevels[i].active = cb.checked; 
          });
          overlay.querySelectorAll('.js-sf-time-val').forEach((inp, i) => { s.timeLevels[i].v = parseFloat(inp.value) || 0; });
          overlay.querySelectorAll('.js-sf-time-col').forEach((swatch, i) => { s.timeLevels[i].color = swatch.dataset.color; });
       }
    }

    if (['longpos', 'shortpos'].includes(drawing.tool)) {
      if (get('dsd-pos-accSize')) s.accSize = parseFloat(get('dsd-pos-accSize').value) || 10000;
      if (get('dsd-pos-risk')) s.risk = parseFloat(get('dsd-pos-risk').value);
      if (get('dsd-pos-risk-type')) s.riskType = get('dsd-pos-risk-type').value;

      if (get('dsd-pos-entry') && drawing.p1) drawing.p1.price = parseFloat(get('dsd-pos-entry').value) || drawing.p1.price;
      if (get('dsd-pos-target') && drawing.p2) drawing.p2.price = parseFloat(get('dsd-pos-target').value) || drawing.p2.price;
      if (get('dsd-pos-stop') && drawing.p3) drawing.p3.price = parseFloat(get('dsd-pos-stop').value) || drawing.p3.price;

      const posColor = overlay.querySelector('.js-pos-color');
      if (posColor) s.color = posColor.dataset.color;
      const stopColor = overlay.querySelector('.js-pos-stop');
      if (stopColor) s.stopColor = stopColor.dataset.color;
      const trgColor = overlay.querySelector('.js-pos-target');
      if (trgColor) s.targetColor = trgColor.dataset.color;
      const txtColor = overlay.querySelector('.js-pos-text');
      if (txtColor) s.textColor = txtColor.dataset.color;

      if (get('dsd-pos-width')) s.width = parseInt(get('dsd-pos-width').value) || 1;
      if (get('dsd-pos-fontsize')) s.fontSize = parseInt(get('dsd-pos-fontsize').value) || 12;

      if (get('dsd-pos-showprice')) s.priceLabels = get('dsd-pos-showprice').checked;
      if (get('dsd-pos-compact')) s.compactStats = get('dsd-pos-compact').checked;
      if (get('dsd-pos-always')) s.alwaysShowStats = get('dsd-pos-always').checked;
    }

// Visibility tab
    const visCbs = overlay.querySelectorAll('.js-vis-tf');
    if (visCbs.length) {
      s.visibility = s.visibility || {};
      visCbs.forEach(cb => { s.visibility[cb.dataset.tf] = cb.checked; });
    }

    // ── Channel-specific apply ──────────────────────────────────────
    if (drawing.tool === 'channel') {
      // Level active toggles (only non-edge levels have checkboxes)
      const levelCbs     = overlay.querySelectorAll('.js-ch-level-active');
      const levelSwatches = overlay.querySelectorAll('.js-ch-level-color');
      const levelVals = overlay.querySelectorAll('.js-ch-level-val');

      if (levelCbs.length > 0 || levelSwatches.length > 0 || levelVals.length > 0) {
        if (!s.channelLevels) s.channelLevels = [];
        
        const initLevel = (idx) => {
           if (!s.channelLevels[idx]) {
              const valInput = overlay.querySelector(`.js-ch-level-val[data-idx="${idx}"]`);
              const swatch = overlay.querySelector(`.js-ch-level-color[data-idx="${idx}"]`);
              const combo = overlay.querySelector(`.js-ch-level-combo[data-idx="${idx}"]`);
              let c = '#2962ff', w = 1, st = 'solid';
              if (swatch && swatch.dataset.color) c = swatch.dataset.color;
              if (combo) {
                 const path = combo.querySelector('path');
                 if (path) {
                    w = parseInt(path.getAttribute('stroke-width')) || 1;
                    const dash = path.getAttribute('stroke-dasharray');
                    if (dash === '8,5') st = 'dashed';
                    else if (dash === '3,3') st = 'dotted';
                 }
              }
              s.channelLevels[idx] = { 
                 v: (valInput ? (parseFloat(valInput.value) || 0) : 0), 
                 active: false, color: c, width: w, style: st 
              };
           }
        };

        levelCbs.forEach(cb => {
          const idx = parseInt(cb.dataset.idx);
          if (!isNaN(idx)) {
             initLevel(idx);
             s.channelLevels[idx].active = cb.checked;
          }
        });
        levelSwatches.forEach(sw => {
          const idx = parseInt(sw.dataset.idx);
          if (!isNaN(idx)) {
             initLevel(idx);
             if (sw.dataset.color) s.channelLevels[idx].color = sw.dataset.color;
          }
        });
        levelVals.forEach(inp => {
          const idx = parseInt(inp.dataset.idx);
          if (!isNaN(idx)) {
             initLevel(idx);
             const v = parseFloat(inp.value);
             if (!isNaN(v)) s.channelLevels[idx].v = v;
          }
        });
      }

      // Extend toggles (override what the general block above wrote)
      const extL = get('dsd-ext-left');
      const extR = get('dsd-ext-right');
      if (extL) s.extendLeft  = extL.checked;
      if (extR) s.extendRight = extR.checked;

      // Background toggle + fill color
      const bgCb  = get('dsd-showbg');
      if (bgCb)  s.showBg   = bgCb.checked;
      const fillSw = overlay.querySelector('.js-fill-color');
      if (fillSw && fillSw.dataset.color) s.fillColor = fillSw.dataset.color;
    }
  }



    function parseTimeVal(str, origTime) {
      if (!str || str.trim() === '') return null;
      if (str.includes('-')) {
        const parts = str.split('-');
        if (parts.length === 3) {
          if (typeof origTime === 'object' && origTime.year) {
             return { year: parseInt(parts[0], 10), month: parseInt(parts[1], 10), day: parseInt(parts[2], 10) };
          }
          return str;
        }
      }
      const num = parseFloat(str);
      return isNaN(num) ? null : num;
    }

  return {
    applyFromForm
  };
})();
