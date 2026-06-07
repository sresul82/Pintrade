
function initLinePicker() {
  document.addEventListener('click', e => {
    // Check if clicked exactly on a trigger button
    const btn = e.target.closest('.tv-linetool-btn');
    if (btn) {
      e.preventDefault();
      // If the same is already open, close it
      if (currentPopover && currentPopover.btn === btn) {
        closePopover();
        return;
      }
      openPopover(btn);
      return;
    }
    
    // Auto-close if clicked outside open popover
    if (currentPopover && !e.target.closest('.tv-line-popover') && !e.target.closest('.tv-linetool-btn')) {
      closePopover();
    }
  });
}

function closePopover() {
  if (currentPopover) {
    currentPopover.el.remove();
    currentPopover.btn.style.borderColor = '#363c4e'; // Reset active border
    currentPopover = null;
  }
}

// Convert '#rrggbb' + opacity to 'rgba(r,g,b, o)' or vice-versa
function colorToRgbArray(c) {
  if (!c) return {r:0,g:0,b:0,a:1};
  if (c.startsWith('#')) {
    const r = parseInt(c.slice(1,3), 16) || 0;
    const g = parseInt(c.slice(3,5), 16) || 0;
    const b = parseInt(c.slice(5,7), 16) || 0;
    return {r,g,b,a:1};
  }
  if (c.startsWith('rgba')) {
    const parts = c.match(/[\d.]+/g);
    return {r:parseInt(parts[0]), g:parseInt(parts[1]), b:parseInt(parts[2]), a:parseFloat(parts[3]??1)};
  }
  if (c.startsWith('rgb')) {
    const parts = c.match(/[\d.]+/g);
    return {r:parseInt(parts[0]), g:parseInt(parts[1]), b:parseInt(parts[2]), a:1};
  }
  return {r:0,g:0,b:0,a:1};
}
function rgbArrayToHex(r,g,b) {
  return '#' + [r,g,b].map(x => x.toString(16).padStart(2,'0')).join('');
}

function hsvToRgb(h, s, v) {
  let r, g, b;
  let i = Math.floor(h * 6);
  let f = h * 6 - i;
  let p = v * (1 - s);
  let q = v * (1 - f * s);
  let t = v * (1 - (1 - f) * s);
  switch (i % 6) {
    case 0: r = v, g = t, b = p; break;
    case 1: r = q, g = v, b = p; break;
    case 2: r = p, g = v, b = t; break;
    case 3: r = p, g = q, b = v; break;
    case 4: r = t, g = p, b = v; break;
    case 5: r = v, g = p, b = q; break;
  }
  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
}

function rgbToHsv(r, g, b) {
  r /= 255, g /= 255, b /= 255;
  let max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, v = max;
  let d = max - min;
  s = max === 0 ? 0 : d / max;
  if (max === min) h = 0; // achromatic
  else {
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return { h, s, v };
}

function openPopover(btn) {
  closePopover(); // close any existing

  const isLineMode = btn.dataset.linemode === 'true';
  const key = btn.dataset.key;
  const currentColor = btn.dataset.color || '#2962ff';
  const currentThickness = parseInt(btn.dataset.thickness, 10) || 1;
  const currentStyle = btn.dataset.style || 'solid';

  const cObj = colorToRgbArray(currentColor);
  const baseHex = rgbArrayToHex(cObj.r, cObj.g, cObj.b);
  const opacityPct = Math.round(cObj.a * 100);

  // Generate Grid HTML
  const mainGrid = TV_PALETTE.map(row => `
    <div style="display:flex; gap:2px; margin-bottom:2px;">
      ${row.map(c => `<div class="tv-color-cell ${c===baseHex?'active':''}" data-hex="${c}" style="background:${c}; width:18px; height:18px; border-radius:2px; cursor:pointer;" title="${c}"></div>`).join('')}
    </div>
  `).join('');

  const neonGrid = `
    <div style="display:flex; flex-wrap:wrap; gap:2px; margin-top:8px; align-items:center;">
      ${NEON_PALETTE.map(c => `<div class="tv-color-cell ${c===baseHex?'active':''}" data-hex="${c}" style="background:${c}; width:18px; height:18px; border-radius:2px; cursor:pointer;"></div>`).join('')}
      ${CUSTOM_PALETTE.map(c => `<div class="tv-color-cell ${c===baseHex?'active':''}" data-hex="${c}" style="background:${c}; width:18px; height:18px; border-radius:2px; cursor:pointer;"></div>`).join('')}
      <div style="position:relative; width:18px; height:18px; display:flex; align-items:center; justify-content:center; color:#787b86; cursor:pointer; overflow:hidden; border:1px solid transparent;">
        <svg viewBox="0 0 18 18" width="10" height="10" stroke="currentColor"><path d="M9 2v14m-7-7h14" stroke-width="2"/></svg>
        <div class="lp-add-color" style="position:absolute; inset:0; cursor:pointer;"></div>
      </div>
    </div>
  `;

  // Provide opacity background as checkerboard
  const popoverHtml = `
    <div class="tv-line-popover" style="position:absolute; top:0; left:0; background:#1e222d; border:1px solid #363c4e; border-radius:6px; padding:12px; z-index:99999; box-shadow:0 4px 10px rgba(0,0,0,0.5); width:230px;">
      <div class="tv-lp-palette" style="display:flex; flex-direction:column;">
        ${mainGrid}
        <div style="height:1px; background:#363c4e; margin:6px 0;"></div>
        ${neonGrid}
      </div>
      
      <div style="margin-top:12px;">
        <div style="display:flex; justify-content:space-between; font-size:12px; color:#787b86; margin-bottom:6px;">
          <span>Opacity</span><span class="lp-opacity-val">${opacityPct}%</span>
        </div>
        <div class="lp-opacity-track" style="position:relative; width:100%; height:10px; border-radius:5px; background:repeating-conic-gradient(#363c4e 0% 25%, #1e222d 0% 50%) 50% / 10px 10px;">
          <div class="lp-opacity-overlay" style="position:absolute; inset:0; border-radius:5px; pointer-events:none; background:linear-gradient(to right, rgba(${cObj.r},${cObj.g},${cObj.b},0) 0%, rgba(${cObj.r},${cObj.g},${cObj.b},1) 100%);"></div>
          <input type="range" class="lp-opacity-slider" min="0" max="100" value="${opacityPct}" style="position:absolute; width:100%; top:0; left:0; opacity:0; cursor:pointer;" />
          <div class="lp-opacity-thumb" style="position:absolute; width:12px; height:12px; border:2px solid #d1d4dc; border-radius:50%; background:#1e222d; top:-1px; left:calc(${opacityPct}% - 6px); pointer-events:none;"></div>
        </div>
      </div>

      ${isLineMode ? `
      <div style="margin-top:12px;">
        <div style="font-size:12px; color:#787b86; margin-bottom:6px;">Thickness</div>
        <div style="display:flex; gap:2px; border:1px solid #363c4e; border-radius:4px; overflow:hidden;">
          ${[1,2,3,4].map(w => `
            <div class="lp-thick-btn ${w===currentThickness?'active':''}" data-w="${w}" style="flex:1; background:${w===currentThickness?'#434651':'#2a2e39'}; height:28px; display:flex; align-items:center; justify-content:center; cursor:pointer; border-right:1px solid #363c4e;">
              <div style="width:20px; height:${w}px; background:#d1d4dc;"></div>
            </div>
          `).join('')}
        </div>
      </div>

      <div style="margin-top:12px;">
        <div style="font-size:12px; color:#787b86; margin-bottom:6px;">Line style</div>
        <div style="display:flex; gap:2px; border:1px solid #363c4e; border-radius:4px; overflow:hidden;">
          <div class="lp-style-btn ${currentStyle==='solid'?'active':''}" data-s="solid" style="flex:1; background:${currentStyle==='solid'?'#434651':'#2a2e39'}; height:28px; display:flex; align-items:center; justify-content:center; cursor:pointer; border-right:1px solid #363c4e;">
            <svg width="24" height="2" viewBox="0 0 24 2"><line x1="0" y1="1" x2="24" y2="1" stroke="#d1d4dc" stroke-width="2"/></svg>
          </div>
          <div class="lp-style-btn ${currentStyle==='dashed'?'active':''}" data-s="dashed" style="flex:1; background:${currentStyle==='dashed'?'#434651':'#2a2e39'}; height:28px; display:flex; align-items:center; justify-content:center; cursor:pointer; border-right:1px solid #363c4e;">
             <svg width="24" height="2" viewBox="0 0 24 2"><line x1="0" y1="1" x2="24" y2="1" stroke="#d1d4dc" stroke-width="2" stroke-dasharray="5,3"/></svg>
          </div>
          <div class="lp-style-btn ${currentStyle==='dotted'?'active':''}" data-s="dotted" style="flex:1; background:${currentStyle==='dotted'?'#434651':'#2a2e39'}; height:28px; display:flex; align-items:center; justify-content:center; cursor:pointer;">
             <svg width="24" height="2" viewBox="0 0 24 2"><line x1="0" y1="1" x2="24" y2="1" stroke="#d1d4dc" stroke-width="2" stroke-dasharray="2,2"/></svg>
          </div>
        </div>
      </div>
      ` : ''}
    </div>
  `;

  // Render Popover
  const popover = document.createElement('div');
  popover.innerHTML = popoverHtml;
  const pEl = popover.firstElementChild;
  document.body.appendChild(pEl);
  
  btn.style.borderColor = '#2962ff'; // highlight trigger box

  currentPopover = { btn, el: pEl };

  // Advanced Positioning Strategy (avoid overflow)
  const rect = btn.getBoundingClientRect();
  let pTop = rect.bottom + 5;
  let pLeft = rect.left;
  
  if (pTop + pEl.offsetHeight > window.innerHeight) {
     pTop = rect.top - pEl.offsetHeight - 5; // Open upwards
  }
  if (pLeft + pEl.offsetWidth > window.innerWidth) {
     pLeft = window.innerWidth - pEl.offsetWidth - 10;
  }
  
  pEl.style.top = pTop + 'px';
  pEl.style.left = pLeft + 'px';

  // State Management inside Popover
  let activeHex = baseHex;
  let activeOpacity = opacityPct;
  let activeThick = currentThickness;
  let activeStyle = currentStyle;
  
  const rebuildLineParam = () => {
     let colorStr = activeHex;
     if (activeOpacity < 100) {
        const rgb = colorToRgbArray(activeHex);
        colorStr = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${activeOpacity/100})`;
     }
     
     // Update trigger button visuals
     btn.dataset.color = colorStr;
     btn.dataset.thickness = activeThick;
     btn.dataset.style = activeStyle;
     btn.querySelector('.tv-linetool-color-preview').style.background = colorStr;
     if (isLineMode) {
       const lineSvg = btn.querySelector('line');
       lineSvg.setAttribute('stroke-width', activeThick);
       lineSvg.removeAttribute('stroke-dasharray');
       if (activeStyle === 'dashed') lineSvg.setAttribute('stroke-dasharray', '4,4');
       if (activeStyle === 'dotted') lineSvg.setAttribute('stroke-dasharray', '2,2');
     }

     // Emit global event so graph updates instantly
     if (window.EventBus) {
       // Fire a specialized event that ChartPane / Settings can listen to optionally 
       window.EventBus.emit('linetool:updated', { key, color: colorStr, thickness: activeThick, style: activeStyle });
     }
  };

  // Listeners
  pEl.querySelectorAll('.tv-color-cell').forEach(c => {
    c.addEventListener('click', () => {
      pEl.querySelectorAll('.tv-color-cell').forEach(x => x.classList.remove('active'));
      c.classList.add('active');
      activeHex = c.dataset.hex;
      // Update gradient overlay
      const rgb = colorToRgbArray(activeHex);
      pEl.querySelector('.lp-opacity-overlay').style.background = `linear-gradient(to right, rgba(${rgb.r},${rgb.g},${rgb.b},0) 0%, rgba(${rgb.r},${rgb.g},${rgb.b},1) 100%)`;
      rebuildLineParam();
    });
  });

  const slider = pEl.querySelector('.lp-opacity-slider');
  const thumb = pEl.querySelector('.lp-opacity-thumb');
  const lbl = pEl.querySelector('.lp-opacity-val');
  
  if (slider) {
    slider.addEventListener('input', e => {
      activeOpacity = parseInt(e.target.value);
      lbl.textContent = activeOpacity + '%';
      thumb.style.left = `calc(${activeOpacity}% - 6px)`;
      rebuildLineParam();
    });
  }

  pEl.querySelectorAll('.lp-thick-btn').forEach(b => {
    b.addEventListener('click', () => {
      pEl.querySelectorAll('.lp-thick-btn').forEach(x => { x.classList.remove('active'); x.style.background='#2a2e39'; });
      b.classList.add('active');
      b.style.background = '#434651';
      activeThick = parseInt(b.dataset.w);
      rebuildLineParam();
    });
  });

  pEl.querySelectorAll('.lp-style-btn').forEach(b => {
    b.addEventListener('click', () => {
      pEl.querySelectorAll('.lp-style-btn').forEach(x => { x.classList.remove('active'); x.style.background='#2a2e39'; });
      b.classList.add('active');
      b.style.background = '#434651';
      activeStyle = b.dataset.s;
      rebuildLineParam();
    });
  });

  const addColorInp = pEl.querySelector('.lp-add-color');
  if (addColorInp) {
    addColorInp.addEventListener('click', (e) => {
      e.stopPropagation();
      // Replace standard view with advanced picker
      openAdvancedPicker(pEl, btn, baseHex, (newHex) => {
         activeHex = newHex;
         rebuildLineParam();
      }, opacityPct);
    });
  }
}

function openAdvancedPicker(pEl, btn, baseHex, rebuildLineParam, startOpacity) {
  const rgb = colorToRgbArray(baseHex);
  let curHsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
  let activeH = curHsv.h;
  let activeS = curHsv.s;
  let activeV = curHsv.v;

  const getHexFromHsv = (h, s, v) => {
    const rrgb = hsvToRgb(h, s, v);
    return rgbArrayToHex(rrgb.r, rrgb.g, rrgb.b);
  };

  const getBaseHueHex = (h) => {
    const hh = hsvToRgb(h, 1, 1);
    return rgbArrayToHex(hh.r, hh.g, hh.b);
  };

  pEl.innerHTML = `
    <div style="display:flex; justify-content:space-between; margin-bottom:12px; align-items:center;">
      <div style="display:flex; align-items:center; gap:8px;">
        <div id="adv-preview" style="width:24px; height:24px; background:${baseHex}; border:1px solid #363c4e; border-radius:4px;"></div>
        <input id="adv-hex" type="text" value="${baseHex.toUpperCase()}" style="width:70px; background:#131722; border:1px solid #2962ff; color:#d1d4dc; padding:4px; border-radius:4px; font-family:'JetBrains Mono',monospace; outline:none; font-size:12px;" />
      </div>
      <button id="adv-add" style="background:#fff; color:#131722; border:none; padding:4px 12px; border-radius:4px; cursor:pointer; font-weight:500;">Add</button>
    </div>
    
    <div style="display:flex; gap:12px;">
      <div id="adv-sv" style="position:relative; width:150px; height:150px; background:${getBaseHueHex(activeH)}; cursor:crosshair; border-radius:4px; overflow:hidden;">
         <div style="position:absolute; inset:0; background:linear-gradient(to right, #fff, rgba(255,255,255,0)); pointer-events:none;"></div>
         <div style="position:absolute; inset:0; background:linear-gradient(to top, #000, rgba(0,0,0,0)); pointer-events:none;"></div>
         <div id="adv-sv-thumb" style="position:absolute; width:10px; height:10px; border:2px solid #fff; border-radius:50%; box-shadow:0 0 2px #000; top:${(1-activeV)*150}px; left:${activeS*150}px; transform:translate(-50%,-50%); pointer-events:none;"></div>
      </div>
      <div id="adv-hue" style="position:relative; width:16px; height:150px; cursor:pointer; border-radius:4px; overflow:hidden; background:linear-gradient(to bottom, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%);">
         <div id="adv-hue-thumb" style="position:absolute; width:100%; height:4px; border:1px solid #000; background:#fff; top:${activeH*150}px; left:0; transform:translateY(-50%); pointer-events:none;"></div>
      </div>
    </div>
    
    <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:16px; border-top:1px solid #363c4e; padding-top:12px;">
       <button id="adv-cancel" style="background:transparent; border:1px solid #363c4e; color:#d1d4dc; padding:6px 16px; border-radius:4px; cursor:pointer;">Cancel</button>
       <button id="adv-ok" style="background:#fff; color:#131722; border:none; padding:6px 16px; border-radius:4px; cursor:pointer; font-weight:500;">Ok</button>
    </div>
  `;

  // Attach Advanced UI Logic
  const pv = pEl.querySelector('#adv-preview');
  const hx = pEl.querySelector('#adv-hex');
  const sv = pEl.querySelector('#adv-sv');
  const svThumb = pEl.querySelector('#adv-sv-thumb');
  const hue = pEl.querySelector('#adv-hue');
  const hueThumb = pEl.querySelector('#adv-hue-thumb');
  
  const updateVisuals = () => {
    const hex = getHexFromHsv(activeH, activeS, activeV);
    sv.style.background = getBaseHueHex(activeH);
    pv.style.background = hex;
    hx.value = hex.toUpperCase();
    svThumb.style.left = px(activeS * 150);
    svThumb.style.top = px((1 - activeV) * 150);
    hueThumb.style.top = px(activeH * 150);
  };
  const px = v => v + 'px';

  // Dragging states
  let isDraggingHue = false;
  let isDraggingSV = false;

  const dragSV = (e) => {
    const r = sv.getBoundingClientRect();
    let x = e.clientX - r.left;
    let y = e.clientY - r.top;
    x = Math.max(0, Math.min(150, x));
    y = Math.max(0, Math.min(150, y));
    activeS = x / 150;
    activeV = 1 - (y / 150);
    updateVisuals();
  };

  const dragHue = (e) => {
    const r = hue.getBoundingClientRect();
    let y = e.clientY - r.top;
    y = Math.max(0, Math.min(150, y));
    activeH = y / 150;
    updateVisuals();
  };

  sv.addEventListener('mousedown', e => { isDraggingSV = true; dragSV(e); });
  hue.addEventListener('mousedown', e => { isDraggingHue = true; dragHue(e); });
  
  window.addEventListener('mousemove', e => {
    if (isDraggingSV) dragSV(e);
    if (isDraggingHue) dragHue(e);
  });
  window.addEventListener('mouseup', () => {
    isDraggingSV = false;
    isDraggingHue = false;
  });

  hx.addEventListener('input', e => {
    const v = e.target.value;
    if (/^#[0-9A-Fa-f]{6}$/.test(v)) {
      const c = colorToRgbArray(v);
      const hsv = rgbToHsv(c.r, c.g, c.b);
      activeH = hsv.h; activeS = hsv.s; activeV = hsv.v;
      updateVisuals();
    }
  });

  pEl.querySelector('#adv-add').addEventListener('click', () => {
    const hex = getHexFromHsv(activeH, activeS, activeV);
    if (!CUSTOM_PALETTE.includes(hex)) CUSTOM_PALETTE.push(hex);
    // Add adds to palette but does not apply? Actually we apply and return to normal mode!
    rebuildLineParam(hex, startOpacity); // Need to apply
    openPopover(btn); // Reopen normal mode
  });

  pEl.querySelector('#adv-cancel').addEventListener('click', () => {
    closePopover();
  });

  pEl.querySelector('#adv-ok').addEventListener('click', () => {
    const hex = getHexFromHsv(activeH, activeS, activeV);
    rebuildLineParam(hex, startOpacity);
    closePopover();
  });
}

/* --- chart-pane.js --- */
// ── Chart Pane ──────────────────────────────────────────────





