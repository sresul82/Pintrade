/**
 * DSD Standard Tabs
 * Ortak sekmelerin (Style, Text, Coordinates, Visibility) render fonksiyonları
 */
window.DSDStandardTabs = (() => {

  function renderStyleTab(d) {
    const s = d.style || {};
    const caps = window.DrawingSettingsDialog.getCaps(d.tool);

    const color      = s.color || '#58a6ff';
    const width      = s.width || 1;
    const dash       = JSON.stringify(s.dash || []);
    const cap        = s.cap || 'normal';
    const isRay      = d.tool === 'ray';
    const isExtended = d.tool === 'extended';
    const extLeft    = s.extendLeft  !== undefined ? !!s.extendLeft  : isExtended;
    const extRight   = s.extendRight !== undefined ? !!s.extendRight : (isRay || isExtended);
    const midpoint   = s.midpoint !== false;
    const priceLabel = s.priceLabel !== false;
    const statsPos   = s.statsPos || 'right';
    const alwaysStats = !!s.alwaysStats;
    const fillColor  = s.fillColor || 'rgba(41,98,255,0.1)';

    const statFields = ['Price range','Percent change','Bars range','Date/time range','Angle'];
    const ALL_STAT_FIELDS = ['Price range','Percent change','Bars range','Date/time range','Angle'];
    const activeStats = s.statsFields ?? ALL_STAT_FIELDS;
    let statsLabel = 'Hidden';
    if (activeStats.length === 1) statsLabel = activeStats[0];
    else if (activeStats.length > 1) statsLabel = activeStats[0] + ', ...';
    const statCheckboxes = statFields.map(f =>
      `<label class="dsd-checkbox-label" style="padding:4px 0">
        <input type="checkbox" class="js-stat-field" data-field="${f}" ${activeStats.includes(f)?'checked':''}>
        ${f}
      </label>`
    ).join('');

    let html = '';

    if (d.tool === 'channel') {
      const defaultLevels = [
        { v: -0.25, active: false, color: '#787b86',             style: 'dashed', width: 1 },
        { v: 0,     active: true,  color: s.color || '#2962ff', style: 'solid',  width: s.width || 1 },
        { v: 0.25,  active: false, color: '#787b86',             style: 'dashed', width: 1 },
        { v: 0.5,   active: false, color: '#787b86',             style: 'dashed', width: 1 },
        { v: 0.75,  active: false, color: '#787b86',             style: 'dashed', width: 1 },
        { v: 1,     active: true,  color: s.color || '#2962ff', style: 'solid',  width: s.width || 1 },
        { v: 1.25,  active: false, color: '#787b86',             style: 'dashed', width: 1 },
      ];
      
      let channelLevels = s.channelLevels;
      if (!channelLevels || channelLevels.length === 0) {
        channelLevels = defaultLevels;
      } else {
        defaultLevels.forEach(dl => {
          if (!channelLevels.find(cl => cl.v === dl.v)) channelLevels.push(dl);
        });
        channelLevels.sort((a,b) => a.v - b.v);
      }
      // Write back so dsd-apply.js can access levels by index on OK
      s.channelLevels = channelLevels;

      const extRight  = s.extendRight !== undefined ? !!s.extendRight : false;
      const extLeft   = s.extendLeft  !== undefined ? !!s.extendLeft  : false;
      const showBg    = s.showBg !== false;
      const fillColor = s.fillColor || 'rgba(9,105,218,0.2)';

      const levelsHtml = channelLevels.map((lvl, i) => {
        const isEdge   = (lvl.v === 0 || lvl.v === 1);
        const dashAttr = lvl.style === 'dashed' ? 'stroke-dasharray="8,5"'
                       : lvl.style === 'dotted' ? 'stroke-dasharray="3,3"' : '';
        const rowOpacity = (!lvl.active && !isEdge) ? 'opacity:0.45;' : '';

        // Checkbox: shown for non-edge levels; spacer preserves alignment for 0 and 1
        const checkboxHtml = !isEdge
          ? `<input type="checkbox" class="js-ch-level-active" data-idx="${i}" ${lvl.active ? 'checked' : ''}>`
          : `<span style="display:inline-block;width:14px;height:14px;flex-shrink:0;"></span>`;

        return `
        <div class="dsd-row dsd-row-check" style="${rowOpacity}">
          <label class="dsd-checkbox-label">
            ${checkboxHtml}
            <span class="dsd-ch-level-val-box">${lvl.v}</span>
          </label>
          <div class="dsd-line-combo js-ch-level-combo" data-idx="${i}" title="Color, thickness, style" style="margin-left:auto; margin-right:0;">
            <div class="dsd-color-swatch js-ch-level-color"
              data-idx="${i}" data-color="${lvl.color}"
              style="background:${lvl.color}; cursor:pointer;"></div>
            <div class="dsd-combo-divider"></div>
            <div class="dsd-combo-preview">
              <svg width="28" height="16" viewBox="0 0 28 16">
                <path stroke="${lvl.color}" stroke-width="${lvl.width}" ${dashAttr} d="M0 8h28"/>
              </svg>
            </div>
          </div>
        </div>`;
      }).join('');

      html += `
      <div class="dsd-ch-levels-group">
        ${levelsHtml}
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
        <label class="dsd-checkbox-label" style="width:144px; flex-shrink:0;">
          <input type="checkbox" id="dsd-showbg" ${showBg ? 'checked' : ''}>
          Background
        </label>
        <div class="dsd-row-controls">
          <div class="dsd-color-swatch js-fill-color"
            style="background:${fillColor}" data-color="${fillColor}" title="Fill color"></div>
        </div>
      </div>
      `;

      return html;
    }

    if (d.tool === 'rect' || d.tool === 'rotatedrect' || d.tool === 'circle' || d.tool === 'ellipse') {
      const showMidline = s.showMidline !== false;
      const midlineStyle = s.midlineStyle || 'solid';
      const midlineWidth = s.midlineWidth || 1;
      const midlineColor = s.midlineColor || color;
      const midlineDashAttr = midlineStyle === 'dashed' ? 'stroke-dasharray="8,5"' : midlineStyle === 'dotted' ? 'stroke-dasharray="3,3"' : '';
      const showBg = s.showBg !== false;
      
      html += `
      <div class="dsd-row" ${['rotatedrect','circle','ellipse'].includes(d.tool) ? 'style="display:none;"' : ''}>
        <label class="dsd-label">Extend</label>
        <div class="dsd-custom-select" id="dsd-extend-wrap">
          <div class="dsd-custom-select-header" id="dsd-extend-header">
            <span id="dsd-extend-label">${extLeft && extRight ? 'Both' : extLeft ? 'Left' : extRight ? 'Right' : "Don't extend"}</span>
            <svg width="10" height="10" viewBox="0 0 10 10"><path d="M2 3.5l3 3 3-3" stroke="currentColor" fill="none" stroke-width="1.5"/></svg>
          </div>
          <div class="dsd-custom-select-body hidden" id="dsd-extend-body">
            <label class="dsd-checkbox-label" style="padding:6px 8px">
              <input type="checkbox" id="dsd-ext-left" ${extLeft?'checked':''}> Extend left line
            </label>
            <label class="dsd-checkbox-label" style="padding:6px 8px">
              <input type="checkbox" id="dsd-ext-right" ${extRight?'checked':''}> Extend right line
            </label>
          </div>
        </div>
      </div>

      <div class="dsd-row">
        <label class="dsd-label">Border</label>
        <div class="dsd-row-controls">
          <div class="dsd-line-combo" id="dsd-line-combo" title="Color, thickness, style">
            <div class="dsd-color-swatch js-style-color" style="background:${color}" data-color="${color}"></div>
            <div class="dsd-combo-divider"></div>
            <div class="dsd-combo-preview" id="dsd-line-preview">
               <svg width="28" height="16" viewBox="0 0 28 16">
                 <path stroke="${color}" stroke-width="${width}" ${dash==='[5,5]'?'stroke-dasharray="5,5"':dash==='[2,4]'?'stroke-dasharray="2,4"':dash==='[8,5]'?'stroke-dasharray="8,5"':dash==='[3,3]'?'stroke-dasharray="3,3"':''} d="M0 8h28"/>
               </svg>
            </div>
          </div>
        </div>
      </div>

      <div class="dsd-row dsd-row-check">
        <label class="dsd-checkbox-label" style="width:104px; flex-shrink:0;">
          <input type="checkbox" id="dsd-midline" ${showMidline?'checked':''}> 
          Middle line
        </label>
        <div class="dsd-row-controls">
          <div class="dsd-color-swatch js-midline-color js-combined-line" style="background:${midlineColor}; width:24px; height:24px; border-radius:4px; cursor:pointer;" data-color="${midlineColor}" title="Color, thickness, style"></div>
        </div>
      </div>

      <div class="dsd-row dsd-row-check">
        <label class="dsd-checkbox-label" style="width:104px; flex-shrink:0;">
          <input type="checkbox" id="dsd-showbg" ${showBg?'checked':''}>
          Background
        </label>
        <div class="dsd-row-controls">
          <div class="dsd-color-swatch js-fill-color" style="background:${fillColor}" data-color="${fillColor}" title="Fill color"></div>
        </div>
      </div>
      `;
      return html;
    }

    html = `
      <div class="dsd-row">
        <label class="dsd-label">Line</label>
        <div class="dsd-row-controls">
          <div class="dsd-color-swatch js-style-color js-combined-line" style="background:${color}; width:24px; height:24px; border-radius:4px; cursor:pointer;" data-color="${color}" title="Color, thickness, style"></div>`;

    if (caps.capArrows) {
      const capLeft = (s && s.capLeft) || 'normal';
      const capRight = (s && s.capRight) || 'normal';
      const capLabels = {
        normal: `<svg width="24" height="12" viewBox="0 0 24 12"><circle cx="3" cy="6" r="2.5" fill="none" stroke="currentColor" stroke-width="1.5"/><line x1="5.5" y1="6" x2="22" y2="6" stroke="currentColor" stroke-width="1.5"/></svg>`,
        arrow:  `<svg width="24" height="12" viewBox="0 0 24 12"><line x1="2" y1="6" x2="18" y2="6" stroke="currentColor" stroke-width="1.5"/><polyline points="12,2 18,6 12,10" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>`
      };
      html += `
          <div class="dsd-cap-drop" style="position:relative;margin-right:4px;">
            <div class="dsd-cap-drop-btn" data-side="left" style="display:flex;align-items:center;gap:6px;background:#131722;border:1px solid #878a95;border-radius:4px;height:30px;padding:0 8px;cursor:pointer;color:#d1d4dc;">
              <span class="dsd-cap-icon" style="transform:scaleX(-1);">${capLabels[capLeft] || capLabels.normal}</span>
              <svg width="10" height="10" viewBox="0 0 10 10" style="flex-shrink:0;color:#787b86;"><path d="M2 3.5l3 3 3-3" stroke="currentColor" fill="none" stroke-width="1.5"/></svg>
            </div>
          </div>
          <div class="dsd-cap-drop" style="position:relative;">
            <div class="dsd-cap-drop-btn" data-side="right" style="display:flex;align-items:center;gap:6px;background:#131722;border:1px solid #878a95;border-radius:4px;height:30px;padding:0 8px;cursor:pointer;color:#d1d4dc;">
              <span class="dsd-cap-icon">${capLabels[capRight] || capLabels.normal}</span>
              <svg width="10" height="10" viewBox="0 0 10 10" style="flex-shrink:0;color:#787b86;"><path d="M2 3.5l3 3 3-3" stroke="currentColor" fill="none" stroke-width="1.5"/></svg>
            </div>
          </div>`;
    }

    html += `</div></div>`;

    if (caps.midpoint) {
      html += `
      <div class="dsd-row dsd-row-check">
        <label class="dsd-checkbox-label">
          <input type="checkbox" id="dsd-midpoint" ${midpoint?'checked':''}>
          Middle point
        </label>
      </div>`;
    }

    if (caps.priceLabel) {
      html += `
      <div class="dsd-row dsd-row-check">
        <label class="dsd-checkbox-label">
          <input type="checkbox" id="dsd-pricelabel" ${priceLabel?'checked':''}>
          Price labels
        </label>
      </div>`;
    }

    if (caps.extend) {
      html += `
      <div class="dsd-section-label">EXTEND LINE</div>
      <div class="dsd-row dsd-row-check">
        <label class="dsd-checkbox-label">
          <input type="checkbox" id="dsd-ext-right" ${extRight?'checked':''}>
          Extend right line
        </label>
      </div>
      <div class="dsd-row dsd-row-check">
        <label class="dsd-checkbox-label">
          <input type="checkbox" id="dsd-ext-left" ${extLeft?'checked':''}>
          Extend left line
        </label>
      </div>`;
    }

    if (caps.hasFill) {
      html += `
      <div class="dsd-row">
        <label class="dsd-label">Background</label>
        <div class="dsd-row-controls">
          <div class="dsd-line-combo" title="Fill color">
            <div class="dsd-color-swatch js-fill-color" style="background:${fillColor}" data-color="${fillColor}"></div>
          </div>
        </div>
      </div>`;
    }

    if (caps.stats) {
      html += `
      <div class="dsd-section-label">INFO</div>
      <div class="dsd-row">
        <label class="dsd-label">Stats</label>
        <div class="dsd-custom-select" id="dsd-stats-wrap">
          <div class="dsd-custom-select-header" id="dsd-stats-header">
            <span id="dsd-stats-label">${activeStats.length === 0 ? 'Hidden' : statsLabel}</span>
            <svg width="10" height="10" viewBox="0 0 10 10"><path d="M2 3.5l3 3 3-3" stroke="currentColor" fill="none" stroke-width="1.5"/></svg>
          </div>
          <div class="dsd-custom-select-body hidden" id="dsd-stats-body">
            ${statCheckboxes}
          </div>
        </div>
      </div>
      <div class="dsd-row">
        <label class="dsd-label">Stats position</label>
        <select class="dsd-select" id="dsd-statspos">
          <option value="left"   ${statsPos==='left'?'selected':''}>Left</option>
          <option value="center" ${statsPos==='center'?'selected':''}>Center</option>
          <option value="right"  ${statsPos==='right'?'selected':''}>Right</option>
        </select>
      </div>
      <div class="dsd-row dsd-row-check" style="display: flex; gap: 16px;">
        <label class="dsd-checkbox-label">
          <input type="checkbox" id="dsd-stats-on" ${s.statsOn === true ? 'checked' : ''}>
          Stats on/off
        </label>
        <label class="dsd-checkbox-label">
          <input type="checkbox" id="dsd-alwaysstats" ${alwaysStats?'checked':''}>
          Always show
        </label>
      </div>`;
    }

    return html;
  }


  function renderTextTab(d) {
    const s = d.style || {};
    const textColor = s.textColor || '#ffffff';
    const fontSize  = s.fontSize  || 16;
    const bold      = !!s.bold;
    const italic    = !!s.italic;
    const text      = d.tool === 'texttool' ? (d.text || '') : (s.text || '');
    
    // Image 1 specific fields
    const showBg     = s.showBg !== false;
    const fillColor  = s.fillColor || 'rgba(41,98,255,0.2)';
    const showBorder = !!s.showBorder;
    const borderColor = s.borderColor || '#363c4e';
    const textWrap   = s.textWrap !== false;

    return `
      <div class="dsd-row dsd-row-inline" style="margin-bottom:12px;">
        <div class="dsd-color-swatch js-text-color" style="background:${textColor}; padding:3px; background-clip:content-box;" data-color="${textColor}" title="Text color"></div>
        <select class="dsd-select dsd-select-sm" id="dsd-fontsize" style="width:70px;">
          ${[8,10,12,14,16,18,20,24,28,32,40,48,56,64,72,80,96].map(sz =>
            `<option value="${sz}" ${fontSize==sz?'selected':''}>${sz}</option>`
          ).join('')}
        </select>
        <button class="dsd-fmt-btn ${bold?'active':''}" id="dsd-bold" title="Bold"><b>B</b></button>
        <button class="dsd-fmt-btn ${italic?'active':''}" id="dsd-italic" title="Italic"><i>I</i></button>
      </div>

      <div class="dsd-row" style="margin-bottom:16px;">
        <textarea class="dsd-textarea" id="dsd-text" placeholder="Add text" style="min-height:140px; border-radius:6px; border:1px solid #878a95; background:#131722; color:#d1d4dc; padding:8px;">${text}</textarea>
      </div>

      <div class="dsd-row">
        <label class="dsd-label">Text alignment</label>
        <div style="display:flex; gap:8px;">
          <select class="dsd-select" id="dsd-textAlignV">
            <option value="top" ${s.textAlignV==='top'?'selected':''}>Top</option>
            <option value="middle" ${s.textAlignV==='middle'?'selected':''}>Middle</option>
            <option value="bottom" ${s.textAlignV==='bottom'?'selected':''}>Bottom</option>
          </select>
          <select class="dsd-select" id="dsd-textAlignH">
            <option value="left" ${s.textAlignH==='left'?'selected':''}>Left</option>
            <option value="center" ${s.textAlignH==='center'?'selected':''}>Center</option>
            <option value="right" ${s.textAlignH==='right'?'selected':''}>Right</option>
          </select>
        </div>
      </div>
    `;
  }


  function renderCoordsTab(d) {
    const caps = window.DrawingSettingsDialog.getCaps(d.tool);
    const mode = caps.coordsMode;
    const p1 = d.p1 || {};
    const p2 = d.p2 || {};
    let prec = d._panePrecision;
    if (prec === undefined && window.DrawingManager && DrawingManager.getPanePrecision) {
      prec = DrawingManager.getPanePrecision(d);
    }
    const price1 = p1.price ?? (d.price ?? '');
    const bar1   = p1.time  ?? p1.bar ?? (d.time ?? '');
    const price2 = p2.price ?? '';
    const bar2   = p2.time  ?? p2.bar ?? '';

    // priceOnly: hline — just the price, no time
    if (mode === 'priceOnly') {
      return `
        <div class="dsd-coords-grid">
          <div class="dsd-coords-row">
            <span class="dsd-coords-label">Price</span>
            <input class="dsd-input" id="dsd-p1price" type="number" value="${DSDUtils.fmtPrice(price1, prec)}" step="${DSDUtils.getStep(price1, prec)}">
          </div>
        </div>`;
    }

    // timeOnly: vline — just the bar/time, no price
    if (mode === 'timeOnly') {
      return `
        <div class="dsd-coords-grid">
          <div class="dsd-coords-row">
            <span class="dsd-coords-label">Bar</span>
            <input class="dsd-input" id="dsd-p1bar" type="text" value="${DSDUtils.formatTime(bar1)}" style="width:100%;">
          </div>
        </div>`;
    }

    // p1only: hray, crossline, vwap — one price + one bar
    if (mode === 'p1only') {
      return `
        <div class="dsd-coords-grid">
          <div class="dsd-coords-row">
            <span class="dsd-coords-label">#1 (price, bar)</span>
            <input class="dsd-input" id="dsd-p1price" type="number" value="${DSDUtils.fmtPrice(price1, prec)}" step="${DSDUtils.getStep(price1, prec)}" style="width:100%;">
            <input class="dsd-input" id="dsd-p1bar"   type="text" value="${DSDUtils.formatTime(bar1)}" style="width:100%;">
          </div>
        </div>`;
    }

    // p3: three full points (pitchfork, fib-ext)
    if (mode === 'p3') {
      const p3 = d.p3 || {};
      const price3 = p3.price ?? '';
      const bar3   = p3.bar   ?? (d.p3?.time ?? '');
      return `
        <div class="dsd-coords-grid">
          <div class="dsd-coords-row">
            <span class="dsd-coords-label">#1 (price, bar)</span>
            <input class="dsd-input" id="dsd-p1price" type="number" value="${DSDUtils.fmtPrice(price1, prec)}" step="${DSDUtils.getStep(price1, prec)}" style="width:100%;">
            <input class="dsd-input" id="dsd-p1bar"   type="text" value="${DSDUtils.formatTime(bar1)}" style="width:100%;">
          </div>
          <div class="dsd-coords-row">
            <span class="dsd-coords-label">#2 (price, bar)</span>
            <input class="dsd-input" id="dsd-p2price" type="number" value="${DSDUtils.fmtPrice(price2, prec)}" step="${DSDUtils.getStep(price2, prec)}" style="width:100%;">
            <input class="dsd-input" id="dsd-p2bar"   type="text" value="${DSDUtils.formatTime(bar2)}" style="width:100%;">
          </div>
          <div class="dsd-coords-row">
            <span class="dsd-coords-label">#3 (price, bar)</span>
            <input class="dsd-input" id="dsd-p3price" type="number" value="${DSDUtils.fmtPrice(price3, prec)}" step="${DSDUtils.getStep(price3, prec)}" style="width:100%;">
            <input class="dsd-input" id="dsd-p3bar"   type="text" value="${DSDUtils.formatTime(bar3)}" style="width:100%;">
          </div>
        </div>`;
    }

    // default p2: two full points (trendline, ray, channel, etc.)
    return `
      <div class="dsd-coords-grid">
        <div class="dsd-coords-row">
          <span class="dsd-coords-label">#1 (price, bar)</span>
          <input class="dsd-input" id="dsd-p1price" type="number" value="${DSDUtils.fmtPrice(price1, prec)}" step="${DSDUtils.getStep(price1, prec)}" style="width:100%;">
          <input class="dsd-input" id="dsd-p1bar"   type="text" value="${DSDUtils.formatTime(bar1)}" style="width:100%;">
        </div>
        <div class="dsd-coords-row">
          <span class="dsd-coords-label">#2 (price, bar)</span>
          <input class="dsd-input" id="dsd-p2price" type="number" value="${DSDUtils.fmtPrice(price2, prec)}" step="${DSDUtils.getStep(price2, prec)}" style="width:100%;">
          <input class="dsd-input" id="dsd-p2bar"   type="text" value="${DSDUtils.formatTime(bar2)}" style="width:100%;">
        </div>
      </div>`;
  }


  function renderVisibilityTab(d) {
    const vis = d.style?.visibility || {};
    const timeframes = ['1m','5m','15m','30m','1h','4h','1D','1W','1M'];
    return `
      <div class="dsd-section-label" style="margin-bottom:8px;">Show on timeframes</div>
      <div class="dsd-vis-grid">
        ${timeframes.map(tf => `
          <label class="dsd-checkbox-label">
            <input type="checkbox" class="js-vis-tf" data-tf="${tf}" ${vis[tf]!==false?'checked':''}>
            ${tf}
          </label>
        `).join('')}
      </div>
    `;
  }


  return {
    renderStyleTab,
    renderTextTab,
    renderCoordsTab,
    renderVisibilityTab
  };
})();
