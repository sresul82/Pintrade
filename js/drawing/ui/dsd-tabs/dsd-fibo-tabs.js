/**
 * DSD Fibo Tabs
 * Fibo aracları icin sekme html render fonksiyonları
 */
window.DSDFiboTabs = (() => {

function renderFibStyleTab(d) {
    d.style = d.style || {};
    const s = d.style;
    const color = s.color || '#58a6ff';
    const width = s.width || 1;
    const dash  = JSON.stringify(s.dash || []);
    
    const extLeft = !!s.extendLeft;
    const extRight = !!s.extendRight;
    const useOneColor = s.useOneColor || '#4caf50';
    const useOneActive = s.useOneColor && s.useOneColor !== false;
    const fibBg = s.fibBg !== false;
    const fibBgAlpha = s.fibBgAlpha !== undefined ? s.fibBgAlpha : 0.2;
    const fibReverse = !!s.fibReverse;
    const fibPrices = s.fibPrices !== false;
    const fibLevelsMode = s.fibLevelsType !== false;
    const fibLevelsModeVal = s.fibLevelsMode || 'Values';
    const fibLabelsH = s.fibLabelsH || 'Left';
    const fibLabelsV = s.fibLabelsV || 'Middle';
    const fibFontSize = s.fibFontSize || 12;
    const fibLogScale = !!s.fibLogScale;

    const tlActive = s.trendLineActive !== false;
    const tlColor = s.trendLineColor || color;
    const tlWidth = s.trendLineWidth || width;
    const tlDash = s.trendLineDash || dash;
    const lvlDash = s.levelsDash || dash;
    const lvlWidth = s.levelsWidth || width;
    
    const tlDashStr = Array.isArray(tlDash) ? JSON.stringify(tlDash) : tlDash;
    const lvlDashStr = Array.isArray(lvlDash) ? JSON.stringify(lvlDash) : lvlDash;

    
    let defaultLevels = [];
    if (d.tool === 'fib-timezone') {
      defaultLevels = [
        { v: 0, color: '#787b86', active: true },
        { v: 1, color: '#2962ff', active: true },
        { v: 2, color: '#f44336', active: true },
        { v: 3, color: '#ff9800', active: true },
        { v: 5, color: '#4caf50', active: true },
        { v: 8, color: '#00bcd4', active: true },
        { v: 13, color: '#9c27b0', active: true },
        { v: 21, color: '#e91e63', active: true },
        { v: 34, color: '#3f51b5', active: true },
        { v: 55, color: '#607d8b', active: true },
        { v: 89, color: '#795548', active: true }
      ];
    } else if (d.tool === 'fib-timebased') {
      defaultLevels = [
        { v: 0, color: '#787b86', active: true },
        { v: 0.382, color: '#f44336', active: true },
        { v: 0.5, color: '#4caf50', active: false },
        { v: 0.618, color: '#4caf50', active: true },
        { v: 1, color: '#00bcd4', active: true },
        { v: 1.382, color: '#00bcd4', active: true },
        { v: 1.618, color: '#787b86', active: true },
        { v: 2, color: '#2962ff', active: true },
        { v: 2.382, color: '#e91e63', active: true },
        { v: 2.618, color: '#9c27b0', active: true },
        { v: 3, color: '#673ab7', active: true }
      ];
    } else if (d.tool === 'fib-speedfan') {
      defaultLevels = [
        { v: 0, color: '#787b86', active: true },
        { v: 0.25, color: '#f44336', active: true },
        { v: 0.382, color: '#ff9800', active: true },
        { v: 0.5, color: '#4caf50', active: true },
        { v: 0.618, color: '#00bcd4', active: true },
        { v: 0.75, color: '#2962ff', active: true },
        { v: 1, color: '#9c27b0', active: true }
      ];
    } else {
      defaultLevels = [
        { v: 0, color: '#787b86', active: true },
        { v: 0.236, color: '#f44336', active: true },
        { v: 0.382, color: '#ff9800', active: true },
        { v: 0.5, color: '#4caf50', active: true },
        { v: 0.618, color: '#00bcd4', active: true },
        { v: 0.786, color: '#2962ff', active: true },
        { v: 1, color: '#787b86', active: true },
        { v: 1.618, color: '#9c27b0', active: true },
        { v: 2.618, color: '#e91e63', active: true },
        { v: 3.618, color: '#9c27b0', active: d.tool === 'fib-channel' ? true : false },
        { v: 4.236, color: '#e91e63', active: d.tool === 'fib-channel' ? true : false },
        { v: 1.272, color: '#4caf50', active: false },
        { v: 1.414, color: '#f44336', active: false },
        { v: 2.272, color: '#ff9800', active: false },
        { v: 2.414, color: '#4caf50', active: false },
        { v: 2, color: '#00bcd4', active: false },
        { v: 3, color: '#2962ff', active: false },
        { v: 3.272, color: '#787b86', active: false },
        { v: 3.414, color: '#9c27b0', active: false },
        { v: 4, color: '#e91e63', active: false },
        { v: 4.272, color: '#9c27b0', active: false },
        { v: 4.414, color: '#e91e63', active: false },
        { v: 4.618, color: '#4caf50', active: false },
        { v: 4.764, color: '#ff9800', active: false }
      ];
    }
    
    if (!s.fibLevels || s.fibLevels.length === 0) {
      s.fibLevels = defaultLevels;
    }
    const levels = s.fibLevels;
    const isFibChannel = d.tool === 'fib-channel';
    
    if (d.tool === 'fib-speedfan') {
       return renderFibSpeedfanTab(d);
    }
    
    let html = '';
    
    if (!isFibChannel && d.tool !== 'fib-speedfan') {
      html += `
      <div class="dsd-row" style="margin-bottom:8px;">
        <label class="dsd-checkbox-label" style="width:120px;">
          <input type="checkbox" id="dsd-tl-active" ${tlActive ? 'checked' : ''}> Trend line
        </label>
        <div class="dsd-row-controls">
          <div class="dsd-color-swatch js-tl-color js-combined-line" style="background:${tlColor}; width:24px; height:24px; border-radius:4px; cursor:pointer;" data-color="${tlColor}" title="Trend line style"></div>
        </div>
      </div>
      `;
    }

    html += `
      <div class="dsd-row" style="margin-bottom:12px;">
        <label class="dsd-label" style="width:120px;">Extend</label>
        <select class="dsd-select" id="dsd-fib-extend" style="width:140px;">
          <option value="none" ${!extLeft && !extRight ? 'selected' : ''}>Don't extend</option>
          <option value="left" ${extLeft && !extRight ? 'selected' : ''}>Extend left</option>
          <option value="right" ${!extLeft && extRight ? 'selected' : ''}>Extend right</option>
          <option value="both" ${extLeft && extRight ? 'selected' : ''}>Extend both</option>
        </select>
      </div>

      <div class="dsd-fib-levels" style="display:grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin-bottom:16px;">
    `;
    
    levels.forEach((lvl, i) => {
      html += `
        <div class="dsd-row-inline" style="align-items:center; gap:8px; opacity: ${lvl.active ? '1' : '0.4'}; transition: opacity 0.2s;">
           <input type="checkbox" class="js-fib-active" data-idx="${i}" ${lvl.active ? 'checked' : ''}>
           <input type="number" class="dsd-input js-fib-val" data-idx="${i}" value="${lvl.v}" step="0.001" style="width:70px; padding:2px 4px; border:1px solid #2a2e39;">
           <div class="dsd-color-swatch js-fib-color" data-idx="${i}" style="background:${lvl.color}; width:20px; height:20px; border-radius:3px; flex-shrink:0; cursor:pointer;" data-color="${lvl.color}"></div>
        </div>
      `;
    });
    
    html += `
      </div>
      
      <div class="dsd-row" style="margin-bottom:12px;">
         <label class="dsd-checkbox-label" style="width:120px;">
           <input type="checkbox" class="js-fib-useone-cb" id="dsd-fib-useonecolor-cb" ${useOneActive ? 'checked' : ''}> Use one color
         </label>
         <div class="dsd-color-swatch js-fib-onecolor" style="background:${useOneColor}; width:24px; height:24px; border-radius:3px; cursor:pointer;" data-color="${useOneColor}"></div>
      </div>
      
      <div class="dsd-row" style="margin-bottom:12px; align-items:center;">
         <label class="dsd-checkbox-label" style="width:120px;">
           <input type="checkbox" id="dsd-fib-bg" ${fibBg ? 'checked' : ''}> Background
         </label>
         <style>
           .dsd-fib-opacity-slider {
             -webkit-appearance: none;
             height: 9px;
             border-radius: 4px;
             outline: none;
             background: linear-gradient(to right, rgba(41,98,255,0), rgba(41,98,255,1)),
                         repeating-conic-gradient(#3a3e4a 0% 25%, #2a2e39 0% 50%) 50% / 9px 9px;
             box-shadow: inset 0 0 0 1px rgba(0,0,0,0.2);
           }
           .dsd-fib-opacity-slider::-webkit-slider-thumb {
             -webkit-appearance: none;
             width: 20px;
             height: 20px;
             border-radius: 50%;
             background: #ffffff;
             border: 2px solid #1e222d;
             cursor: pointer;
           }
         </style>
         <input type="range" id="dsd-fib-bgalph" class="dsd-fib-opacity-slider" min="0" max="1" step="0.05" value="${fibBgAlpha}" style="width:150px;">
      </div>
      `;
      
      if (!isFibChannel) {
         html += `
         <div class="dsd-row" style="margin-bottom:12px;">
            <label class="dsd-checkbox-label">
              <input type="checkbox" id="dsd-fib-reverse" ${fibReverse ? 'checked' : ''}> Reverse
            </label>
         </div>
         `;
      }
      
      html += `
      
      <div class="dsd-row" style="margin-bottom:12px;">
         <label class="dsd-checkbox-label">
           <input type="checkbox" id="dsd-fib-prices" ${fibPrices ? 'checked' : ''}> Prices
         </label>
      </div>
      
      <div class="dsd-row" style="margin-bottom:12px; gap:16px;">
         <label class="dsd-checkbox-label" style="width:104px;">
           <input type="checkbox" id="dsd-fib-levels-active" ${fibLevelsMode ? 'checked' : ''}> Levels
         </label>
         <select class="dsd-select" id="dsd-fib-levels-mode" style="width:100px;">
            <option value="Values" ${fibLevelsModeVal==='Values'?'selected':''}>Values</option>
            <option value="Percents" ${fibLevelsModeVal==='Percents'?'selected':''}>Percents</option>
         </select>
      </div>

      <div class="dsd-row" style="margin-bottom:12px; gap:16px;">
         <label class="dsd-label" style="width:120px;">Labels</label>
         <select class="dsd-select" id="dsd-fib-labels-h" style="width:80px;">
            <option value="Left" ${fibLabelsH==='Left'?'selected':''}>Left</option>
            <option value="Center" ${fibLabelsH==='Center'?'selected':''}>Center</option>
            <option value="Right" ${fibLabelsH==='Right'?'selected':''}>Right</option>
         </select>
         <select class="dsd-select" id="dsd-fib-labels-v" style="width:80px;">
            <option value="Top" ${fibLabelsV==='Top'?'selected':''}>Top</option>
            <option value="Middle" ${fibLabelsV==='Middle'?'selected':''}>Middle</option>
            <option value="Bottom" ${fibLabelsV==='Bottom'?'selected':''}>Bottom</option>
         </select>
      </div>
      
      <div class="dsd-row" style="margin-bottom:12px; gap:16px;">
         <label class="dsd-label" style="width:120px;">Font size</label>
         <select class="dsd-select" id="dsd-fib-fontsize" style="width:80px;">
            ${[8,10,12,14,16,20,24,28,32].map(sz => `<option value="${sz}" ${fibFontSize==sz?'selected':''}>${sz}</option>`).join('')}
         </select>
      </div>

    `;

    if (!isFibChannel) {
       html += `
      <div class="dsd-row">
         <label class="dsd-checkbox-label" style="color:#a3a6af;">
           <input type="checkbox" id="dsd-fib-logscale" ${fibLogScale ? 'checked' : ''}> Fib levels based on log scale
         </label>
      </div>
       `;
    }

    return html;
  }

  function renderFibSpeedfanTab(d) {
    d.style = d.style || {};
    const s = d.style;
    const defaultPrices = [
      { v: 0, color: '#787b86', active: true },
      { v: 0.25, color: '#f44336', active: true },
      { v: 0.382, color: '#ff9800', active: true },
      { v: 0.5, color: '#4caf50', active: true },
      { v: 0.618, color: '#00bcd4', active: true },
      { v: 0.75, color: '#2962ff', active: true },
      { v: 1, color: '#9c27b0', active: true }
    ];
    const defaultTimes = [
      { v: 0, color: '#787b86', active: true },
      { v: 0.25, color: '#f44336', active: true },
      { v: 0.382, color: '#ff9800', active: true },
      { v: 0.5, color: '#4caf50', active: true },
      { v: 0.618, color: '#00bcd4', active: true },
      { v: 0.75, color: '#2962ff', active: true },
      { v: 1, color: '#9c27b0', active: true }
    ];
    
    // Migrate from old fibLevels if exists but priceLevels doesn't
    let priceLevels = s.priceLevels;
    let timeLevels = s.timeLevels;
    if (!priceLevels && s.fibLevels && s.fibLevels.length > 0) {
       priceLevels = JSON.parse(JSON.stringify(s.fibLevels.slice(0, 7)));
       timeLevels = JSON.parse(JSON.stringify(s.fibLevels.slice(0, 7)));
    }
    if (!priceLevels) priceLevels = s.priceLevels = defaultPrices;
    if (!timeLevels) timeLevels = s.timeLevels = defaultTimes;
    
    const useOneColor = s.useOneColor || '#58a6ff';
    const useOneActive = s.useOneColor && s.useOneColor !== false;
    const fibBg = s.fibBg !== false;
    const fibBgAlpha = s.fibBgAlpha !== undefined ? s.fibBgAlpha : 0.2;
    const fibReverse = !!s.fibReverse;
    const gridStyle = s.gridStyle || 'dashed';
    const gridColor = s.gridColor || '#363c4e';
    const gridDashStr = gridStyle === 'dashed' ? '[8,5]' : gridStyle === 'dotted' ? '[3,3]' : '';
    
    let html = '';
    html += '<div style="font-size:11px;color:#5d606b;margin-bottom:8px;text-transform:uppercase;">Price Levels</div>';
    html += '<div style="display:grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin-bottom:12px;">';
    
    const renderLevel = (lvl, i, prefix) => {
       if (!lvl) return '<div></div>';
       return `
        <div class="dsd-row-inline" style="align-items:center; gap:8px; opacity: ${lvl.active ? '1' : '0.4'}; transition: opacity 0.2s;">
           <input type="checkbox" class="js-fib-active js-sf-${prefix}" data-idx="${i}" ${lvl.active ? 'checked' : ''}>
           <input type="number" class="dsd-input js-fib-val js-sf-${prefix}-val" data-idx="${i}" value="${lvl.v}" step="0.001" style="width:70px; padding:2px 4px; border:1px solid #2a2e39;">
           <div class="dsd-color-swatch js-fib-color js-sf-${prefix}-col" data-idx="${i}" style="background:${lvl.color}; width:20px; height:20px; border-radius:3px; flex-shrink:0; cursor:pointer;" data-color="${lvl.color}"></div>
        </div>`;
    };
    
    const layout = [[0, 1], [2, 3], [4, 5], [6, null]];
    layout.forEach(row => {
       html += renderLevel(priceLevels[row[0]], row[0], 'price');
       html += renderLevel(priceLevels[row[1]], row[1], 'price');
    });
    
    html += '</div>';
    html += `
      <div class="dsd-row" style="margin-bottom:8px;">
         <label class="dsd-checkbox-label"><input type="checkbox" id="dsd-sf-labels-left" ${s.labelsLeft !== false ? 'checked' : ''}> Left labels</label>
      </div>
      <div class="dsd-row" style="margin-bottom:16px;">
         <label class="dsd-checkbox-label"><input type="checkbox" id="dsd-sf-labels-right" ${s.labelsRight === true ? 'checked' : ''}> Right labels</label>
      </div>
    `;

    html += '<div style="font-size:11px;color:#5d606b;margin-bottom:8px;text-transform:uppercase;">Time Levels</div>';
    html += '<div style="display:grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin-bottom:12px;">';
    layout.forEach(row => {
       html += renderLevel(timeLevels[row[0]], row[0], 'time');
       html += renderLevel(timeLevels[row[1]], row[1], 'time');
    });
    html += '</div>';
    
    html += `
      <div class="dsd-row" style="margin-bottom:8px;">
         <label class="dsd-checkbox-label"><input type="checkbox" id="dsd-sf-labels-bottom" ${s.labelsTop === true ? 'checked' : ''}> Top labels</label>
      </div>
      <div class="dsd-row" style="margin-bottom:24px;">
         <label class="dsd-checkbox-label"><input type="checkbox" id="dsd-sf-labels-top" ${s.labelsBottom !== false ? 'checked' : ''}> Bottom labels</label>
      </div>
    `;
    
    html += `
      <div class="dsd-row" style="margin-bottom:12px;">
         <label class="dsd-checkbox-label" style="width:120px;">
           <input type="checkbox" class="js-fib-useone-cb" id="dsd-sf-useonecolor-cb" ${useOneActive ? 'checked' : ''}> Use one color
         </label>
         <div class="dsd-color-swatch js-fib-onecolor" style="background:${useOneColor}; width:24px; height:24px; border-radius:3px; cursor:pointer;" data-color="${useOneColor}"></div>
      </div>
    `;
    const fibBgColorHex = s.fibBgColor || '#2962ff';
    let bg_r = 41, bg_g = 98, bg_b = 255;
    if (fibBgColorHex.startsWith('#') && fibBgColorHex.length === 7) {
       bg_r = parseInt(fibBgColorHex.slice(1,3), 16);
       bg_g = parseInt(fibBgColorHex.slice(3,5), 16);
       bg_b = parseInt(fibBgColorHex.slice(5,7), 16);
    }

    html += `
      <div class="dsd-row" style="margin-bottom:12px; align-items:center;">
         <label class="dsd-checkbox-label" style="width:120px;">
           <input type="checkbox" id="dsd-fib-bg" ${fibBg ? 'checked' : ''}> Background
         </label>
         <div class="dsd-color-swatch js-fib-bg-color" style="background:${fibBgColorHex}; width:24px; height:24px; border-radius:3px; cursor:pointer; margin-right:8px;" data-color="${fibBgColorHex}"></div>
         <style>
           .dsd-fib-opacity-slider {
             -webkit-appearance: none; height: 9px; border-radius: 4px; outline: none;
             background: linear-gradient(to right, rgba(var(--bg-rgb),0), rgba(var(--bg-rgb),1)), repeating-conic-gradient(#3a3e4a 0% 25%, #2a2e39 0% 50%) 50% / 9px 9px;
             box-shadow: inset 0 0 0 1px rgba(0,0,0,0.2);
           }
           .dsd-fib-opacity-slider::-webkit-slider-thumb {
             -webkit-appearance: none; width: 20px; height: 20px; border-radius: 50%; background: #ffffff; border: 2px solid #1e222d; cursor: pointer;
           }
         </style>
         <input type="range" id="dsd-fib-bgalph" class="dsd-fib-opacity-slider" min="0" max="1" step="0.05" value="${fibBgAlpha}" style="width:150px; --bg-rgb: ${bg_r},${bg_g},${bg_b};">
      </div>

      
      <div class="dsd-row" style="margin-bottom:12px;">
        <label class="dsd-checkbox-label" style="width:120px;">
          <input type="checkbox" id="dsd-sf-grid-active" ${s.gridActive !== false ? 'checked' : ''}> Grid
        </label>
        <div class="dsd-row-controls">
          <div class="dsd-color-swatch js-grid-color js-combined-line" style="background:${gridColor}; width:24px; height:24px; border-radius:4px; cursor:pointer;" data-color="${gridColor}" title="Grid style"></div>
        </div>
      </div>

      <div class="dsd-row" style="margin-bottom:12px;">
         <label class="dsd-checkbox-label">
           <input type="checkbox" id="dsd-fib-reverse" ${fibReverse ? 'checked' : ''}> Reverse
         </label>
      </div>
    `;

    return html;
  }


  return {
    renderFibStyleTab,
    renderFibSpeedfanTab
  };
})();
