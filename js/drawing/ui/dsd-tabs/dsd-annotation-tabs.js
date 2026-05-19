/**
 * DSD Annotation Tabs
 * Not, Metin, Fiyat Etiketi aracları icin sekme render fonksiyonları
 */
window.DSDAnnotationTabs = (() => {

  function renderAnnotationStyleTab(d) {
    const s = d.style || {};
    const tool = d.tool;

    // Shared style values
    const hasLabelBg   = !['pricelabel'].includes(tool);  // Price Label uses fill differently
    const hasLabelBorder = !['pricelabel','tableanno'].includes(tool);
    const hasLineColor = ['note','pricenote'].includes(tool);
    const hasFillColor = ['pricelabel'].includes(tool);
    const hasBorderColor = ['tableanno'].includes(tool);
    const isFlag = tool === 'flagmark';

    if (isFlag) {
      const flagColor = s.color || '#2962ff';
      return `
        <div class="dsd-row" style="margin-bottom:16px;">
          <label class="dsd-label" style="min-width:140px; color:#d1d4dc;">Flag</label>
          <div class="dsd-color-swatch js-anno-line" style="background-color:${flagColor}; background-clip:content-box;" data-color="${flagColor}" title="Flag color"></div>
        </div>
      `;
    }

    const hasLabelText   = ['pricenote'].includes(tool);
    const labelBg      = s.fillColor   || '#2a2e39';
    const labelBgOn    = s.showFill    !== false;
    const borderColor  = s.borderColor || '#363c4e';
    const borderOn     = s.showBorder  === true;
    const lineColor    = s.color       || '#d1d4dc';
    const fillColor    = s.fillColor   || '#2962ff';
    const textColor    = s.textColor   || '#d1d4dc';

    if (tool === 'pricelabel') {
      const fontSize = s.fontSize || 14;
      const tColor = s.textColor || '#ffffff';
      const bgColor = s.fillColor || '#2962ff';
      const bColor = s.borderColor || '#2962ff';

      return `
        <div class="dsd-row" style="margin-bottom:16px;">
          <label class="dsd-label" style="min-width:140px; color:#d1d4dc;">Text</label>
          <div style="display:flex; align-items:center; gap:8px;">
            <div class="dsd-color-swatch js-anno-text-color" style="background-color:${tColor}; background-clip:content-box;" data-color="${tColor}" title="Text color"></div>
            <select class="dsd-select" id="dsd-anno-fontsize" style="flex:0 0 70px; width:70px;">
              ${[10,11,12,13,14,16,18,20,24,28,32].map(sz => `<option value="${sz}" ${fontSize==sz?'selected':''}>${sz}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="dsd-row" style="margin-bottom:16px;">
          <label class="dsd-label" style="min-width:140px; color:#d1d4dc;">Background</label>
          <div class="dsd-color-swatch js-anno-bg" style="background-color:${bgColor}; background-clip:content-box;" data-color="${bgColor}"></div>
        </div>
        <div class="dsd-row">
          <label class="dsd-label" style="min-width:140px; color:#d1d4dc;">Border</label>
          <div class="dsd-color-swatch js-anno-border" style="background-color:${bColor}; background-clip:content-box;" data-color="${bColor}"></div>
        </div>
      `;
    }

    let html = '';

    if (hasLabelText) {
      const fontSize = s.fontSize || 13;
      const bold = !!s.bold;
      const italic = !!s.italic;

      html += `
      <div class="dsd-row" style="margin-bottom:14px; align-items:center;">
        <label class="dsd-label" style="min-width:140px; color:#d1d4dc;">Label Text</label>
        <div style="display:flex; align-items:center; gap:4px;">
          <div class="dsd-color-swatch js-anno-text-color" data-color="${textColor}" style="background-color:${textColor};" title="Text color"></div>
          <select class="dsd-select dsd-select-sm" id="dsd-anno-fontsize" style="width:52px;">
            ${[8,10,11,12,13,14,16,18,20,24,28,32].map(sz =>
              `<option value="${sz}" ${fontSize==sz?'selected':''}>${sz}</option>`
            ).join('')}
          </select>
          <button class="dsd-fmt-btn ${bold?'active':''}" id="dsd-anno-bold" title="Bold"><b>B</b></button>
          <button class="dsd-fmt-btn ${italic?'active':''}" id="dsd-anno-italic" title="Italic"><i>I</i></button>
        </div>
      </div>`;
    }

    if (hasLabelBg) {
      html += `
      <div class="dsd-row" style="margin-bottom:14px; align-items:center;">
        <label class="dsd-checkbox-label" style="min-width:140px;">
          <input type="checkbox" id="dsd-anno-bg-on" ${labelBgOn ? 'checked' : ''}>  Label background
        </label>
        <div class="dsd-color-swatch js-anno-bg" data-color="${labelBg}" style="background-color:${labelBg}; padding:3px; background-clip:content-box;"></div>
      </div>`;
    }

    if (hasLabelBorder) {
      html += `
      <div class="dsd-row" style="margin-bottom:14px; align-items:center;">
        <label class="dsd-checkbox-label" style="min-width:140px;">
          <input type="checkbox" id="dsd-anno-border-on" ${borderOn ? 'checked' : ''}>  Label border
        </label>
        <div class="dsd-line-combo" id="dsd-anno-border-combo" title="Color, thickness, style">
          <div class="dsd-color-swatch js-anno-border" data-color="${borderColor}" style="background-color:${borderColor};"></div>
          <div class="dsd-combo-divider"></div>
          <div class="dsd-combo-preview" id="dsd-anno-border-preview">
             <svg width="28" height="16" viewBox="0 0 28 16">
               <path stroke="${borderColor}" stroke-width="${s.borderWidth || 1}" ${s.borderDash==='[5,5]'?'stroke-dasharray="5,5"':s.borderDash==='[2,4]'?'stroke-dasharray="2,4"':s.borderDash==='[8,5]'?'stroke-dasharray="8,5"':s.borderDash==='[3,3]'?'stroke-dasharray="3,3"':''} d="M0 8h28"/>
             </svg>
          </div>
        </div>
      </div>`;
    }

    if (hasLineColor) {
      html += `
      <div class="dsd-row" style="margin-bottom:14px; align-items:center;">
        <label class="dsd-label" style="min-width:140px; color:#d1d4dc;">Line color</label>
        <div class="dsd-line-combo" id="dsd-anno-line-combo" title="Color, thickness, style">
          <div class="dsd-color-swatch js-anno-line" data-color="${lineColor}" style="background-color:${lineColor};"></div>
          <div class="dsd-combo-divider"></div>
          <div class="dsd-combo-preview" id="dsd-anno-line-preview">
             <svg width="28" height="16" viewBox="0 0 28 16">
               <path stroke="${lineColor}" stroke-width="${s.width || 1}" ${s.dash==='[5,5]'?'stroke-dasharray="5,5"':s.dash==='[2,4]'?'stroke-dasharray="2,4"':s.dash==='[8,5]'?'stroke-dasharray="8,5"':s.dash==='[3,3]'?'stroke-dasharray="3,3"':''} d="M0 8h28"/>
             </svg>
          </div>
        </div>
      </div>`;
    }

    if (hasFillColor) {
      html += `
      <div class="dsd-row" style="margin-bottom:14px; align-items:center;">
        <label class="dsd-label" style="min-width:140px; color:#d1d4dc;">Label color</label>
        <div class="dsd-color-swatch js-anno-bg" data-color="${fillColor}" style="background-color:${fillColor};"></div>
      </div>`;
    }

    if (hasBorderColor) {
      html += `
      <div class="dsd-row" style="margin-bottom:14px; align-items:center;">
        <label class="dsd-label" style="min-width:140px; color:#d1d4dc;">Border</label>
        <div class="dsd-color-swatch js-anno-border" data-color="${borderColor}" style="background-color:${borderColor};"></div>
      </div>`;
    }

    return html;
  }


  function renderAnnotationTextTab(d) {
    const s = d.style || {};
    const isPN = d.tool === 'pricenote';
    const isCallout = d.tool === 'callout';
    const textColor = isPN ? (s.userTextColor || '#d1d4dc') : (s.textColor || '#ffffff');
    const fontSize  = isPN ? (s.userFontSize || 14) : (s.fontSize || 14);
    const bold      = isPN ? !!s.userBold : !!s.bold;
    const italic    = isPN ? !!s.userItalic : !!s.italic;
    const text = d.text || '';

    // Callout: pixel-perfect match with reference image
    if (isCallout) {
      const fillColor   = s.fillColor   || '#089981';
      const borderColor = s.borderColor || '#089981';
      const borderWidth = s.borderWidth || 2;
      const bDash = s.borderStyle === 'dashed' ? 'stroke-dasharray="8,5"'
                  : s.borderStyle === 'dotted'  ? 'stroke-dasharray="3,3"' : '';

      return `
        <!-- Row 1: color swatch + font size + B + I -->
        <div style="display:flex; align-items:center; gap:6px; margin-bottom:12px;">
          <div class="dsd-color-swatch js-text-color"
               data-color="${textColor}" style="background-color:${textColor};" title="Text color"></div>
          <select class="dsd-select" id="dsd-fontsize"
                  style="width:52px; height:28px; font-size:13px;">
            ${[8,10,11,12,13,14,16,18,20,24,28,32].map(sz =>
              `<option value="${sz}" ${fontSize==sz?'selected':''}>${sz}</option>`
            ).join('')}
          </select>
          <button class="dsd-fmt-btn ${bold?'active':''}" id="dsd-bold"
                  style="width:28px;height:28px;min-width:28px;font-size:13px;padding:0;" title="Bold"><b>B</b></button>
          <button class="dsd-fmt-btn ${italic?'active':''}" id="dsd-italic"
                  style="width:28px;height:28px;min-width:28px;font-size:13px;padding:0;" title="Italic"><i>I</i></button>
        </div>

        <!-- Row 2: textarea (auto-grow) -->
        <div style="margin-bottom:16px;">
          <textarea class="dsd-textarea" id="dsd-text" placeholder="Add text"
                    style="min-height:80px; height:auto; resize:none; width:100%; box-sizing:border-box; overflow-y:hidden;">${text}</textarea>
        </div>

        <!-- Row 3: Background -->
        <div style="display:flex; align-items:center; margin-bottom:12px;">
          <span style="color:#d1d4dc; font-size:13px; min-width:110px;">Background</span>
          <div class="dsd-color-swatch js-callout-bg"
               data-color="${fillColor}" style="background-color:${fillColor};"></div>
        </div>

        <!-- Row 4: Border — swatch + line-preview in ONE grouped box (like the reference) -->
        <div style="display:flex; align-items:center; margin-bottom:16px;">
          <span style="color:#d1d4dc; font-size:13px; min-width:110px;">Border</span>
          <div style="display:flex; align-items:center; border:1px solid #7d808b; border-radius:4px; overflow:hidden; flex-shrink:0;">
            <div class="dsd-color-swatch js-callout-border"
                 data-color="${borderColor}" style="background-color:${borderColor}; border-right:1px solid #7d808b; border-radius:0;"></div>
            <button id="dsd-callout-border-combo"
                    style="display:flex; align-items:center; justify-content:center; background:#1e222d; border:none; padding:0 10px; height:32px; cursor:pointer; gap:4px; min-width:70px;">
              <svg width="32" height="3" viewBox="0 0 32 3">
                <path d="M0 1.5h32" stroke="${borderColor}" stroke-width="${borderWidth}" ${bDash} id="dsd-callout-border-svg-path"/>
              </svg>
            </button>
          </div>
        </div>

        <!-- Row 5: Text wrap -->
        <div style="display:flex; align-items:center; gap:10px;">
          <input type="checkbox" id="dsd-text-wrap" ${s.textWrap !== false ? 'checked' : ''}
                 style="width:18px; height:18px; cursor:pointer; accent-color:#2962ff; flex-shrink:0;">
          <label for="dsd-text-wrap" style="color:#d1d4dc; font-size:13px; cursor:pointer;">Text wrap</label>
        </div>
      `;
    }

    // Other annotation tools (note, pricenote, pricelabel)
    return `
      <div style="display:flex; align-items:center; margin-bottom:10px;">
        <label class="dsd-label" style="width:60px; flex-shrink:0;">Text</label>
        <div style="display:flex; align-items:center; gap:8px;">
          <div class="dsd-color-swatch js-text-color" data-color="${textColor}" style="background-color:${textColor};" title="Text color"></div>
          <select class="dsd-select dsd-select-sm" id="dsd-fontsize" style="width:52px;">
            ${[8,10,11,12,13,14,16,18,20,24,28,32].map(sz =>
              `<option value="${sz}" ${fontSize==sz?'selected':''}>${sz}</option>`
            ).join('')}
          </select>
          <button class="dsd-fmt-btn ${bold?'active':''}" id="dsd-bold" title="Bold"><b>B</b></button>
          <button class="dsd-fmt-btn ${italic?'active':''}" id="dsd-italic" title="Italic"><i>I</i></button>
        </div>
      </div>

      <div class="dsd-row" style="margin-bottom:0;">
        <textarea class="dsd-textarea" id="dsd-text" placeholder="Add text" style="height:100px; resize:vertical; width:100%;">${text}</textarea>
      </div>
    `;
  }


  return {
    renderAnnotationStyleTab,
    renderAnnotationTextTab
  };
})();
