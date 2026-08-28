/**
 * PropertyToolbar — TradingView-style Drawing Toolbar
 * Birebir TradingView referans görsellerine göre yazılmıştır.
 * Çakışan event listener hataları onarılmıştır. Tüm butonlar çalışır vaziyettedir.
 */
window.PropertyToolbar = (() => {

  // ────────── PALETTE DATA ──────────
  const TV_PALETTE = [
    ['#ffffff','#e1e3e6','#c1c4cd','#a3a6af','#787b86','#5d606b','#434651','#2a2e39','#1e222d','#131722','#000000'],
    ['#f23645','#ff9800','#ffeb3b','#4caf50','#089981','#00bcd4','#2962ff','#311b92','#9c27b0','#e91e63','#f8bbd0'],
    ['#fcccd0','#ffe0b2','#fff9c4','#c8e6c9','#b2dfdb','#b2ebf2','#bbdefb','#d1c4e9','#e1bee7','#f48fb1','#fce4ec'],
    ['#ef5350','#ffa726','#ffee58','#66bb6a','#26a69a','#26c6da','#42a5f5','#7e57c2','#ab47bc','#ec407a','#f06292'],
    ['#e53935','#f57c00','#fbc02d','#43a047','#00897b','#00acc1','#1e88e5','#5e35b1','#8e24aa','#d81b60','#e91e63'],
    ['#b71c1c','#e65100','#f57f17','#1b5e20','#004d40','#006064','#0d47a1','#311b92','#4a148c','#880e4f','#ad1457']
  ];
  const NEON_PALETTE = ['#39ff14','#ccff00','#df00ff','#00ffff','#ff0000','#5c4033','#00e5ff','#ffaa00'];
  let CUSTOM_PALETTE = [];

  // ────────── STATE ──────────
  let _drawing = null;
  let _symbol  = null;
  let _panel   = null;
  let _openMenu = null;
  let _outsideHandler = null; // Menü dışı tıklamaları izler
  let _sliderCleanup = null;  // Opacity slider event'lerini temizler
  let _lastX = 0;
  let _lastY = 0;

  // ────────── COLOR HELPERS ──────────
  function _hexToRgb(hex) {
    if (!hex || !hex.startsWith('#')) return { r:89, g:166, b:255, a:1 };
    let h = hex.slice(1);
    if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
    return { r:parseInt(h.slice(0,2),16), g:parseInt(h.slice(2,4),16), b:parseInt(h.slice(4,6),16), a:1 };
  }
  function _rgbToHex(r,g,b) {
    return '#' + [r,g,b].map(x => Math.max(0,Math.min(255,Math.round(x))).toString(16).padStart(2,'0')).join('');
  }
  function _parseColor(c) {
    if (!c) return { hex:'#2962ff', opacityPct:100 };
    if (c.startsWith('#')) return { hex:c, opacityPct:100 };
    const m = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if (m) return { hex:_rgbToHex(+m[1],+m[2],+m[3]), opacityPct: m[4] != null ? Math.round(parseFloat(m[4])*100) : 100 };
    return { hex:'#2962ff', opacityPct:100 };
  }
  function _buildColor(hex, opacityPct) {
    if (opacityPct >= 100) return hex;
    const {r,g,b} = _hexToRgb(hex);
    return `rgba(${r},${g},${b},${(opacityPct/100).toFixed(2)})`;
  }
  function _hsvToRgb(h,s,v) {
    let r,g,b, i=Math.floor(h*6),f=h*6-i,p=v*(1-s),q=v*(1-f*s),t=v*(1-(1-f)*s);
    switch(i%6){case 0:r=v,g=t,b=p;break;case 1:r=q,g=v,b=p;break;case 2:r=p,g=v,b=t;break;case 3:r=p,g=q,b=v;break;case 4:r=t,g=p,b=v;break;case 5:r=v,g=p,b=q;break;}
    return {r:Math.round(r*255),g:Math.round(g*255),b:Math.round(b*255)};
  }
  function _rgbToHsv(r,g,b) {
    r/=255;g/=255;b/=255;
    const max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;
    let h=0,s=max?d/max:0,vv=max;
    if(d){switch(max){case r:h=(g-b)/d+(g<b?6:0);break;case g:h=(b-r)/d+2;break;case b:h=(r-g)/d+4;break;}h/=6;}
    return {h,s,v:vv};
  }

  // ────────── CLOSE ALL MENUS ──────────
  function _closeAllMenus() {
    if (_sliderCleanup) {
      _sliderCleanup();
      _sliderCleanup = null;
    }
    if (_outsideHandler) {
      document.removeEventListener('mousedown', _outsideHandler);
      _outsideHandler = null;
    }
    if (_openMenu) { 
      _openMenu.remove(); 
      _openMenu = null; 
    }
  }

  // ────────── REDRAW ──────────
  let _saveTimeout = null;
  function _redraw() {
    if (_drawing && window.State && _symbol) {
      const drawings = State.getDrawings(_symbol);
      const target = drawings.find(d => d.id === _drawing.id);
      if (target) {
        target.style = JSON.parse(JSON.stringify(_drawing.style));
      }
    }
    clearTimeout(_saveTimeout);
    _saveTimeout = setTimeout(() => {
      if (window.State) State.save();
    }, 300);
    EventBus.emit('drawing:settings:saved');
  }

  // ────────── ADVANCED HSV PICKER (+ button) ──────────
  function _openAdvancedPicker(baseHex, onOk) {
    document.getElementById('pt-adv-picker')?.remove();
    const {r,g,b} = _hexToRgb(baseHex);
    let hsv = _rgbToHsv(r,g,b);
    let H=hsv.h, S=hsv.s, V=hsv.v;

    const hex = () => { const c=_hsvToRgb(H,S,V); return _rgbToHex(c.r,c.g,c.b); };
    const hueHex = (h) => { const c=_hsvToRgb(h,1,1); return _rgbToHex(c.r,c.g,c.b); };
    const px = v => v+'px';

    const el = document.createElement('div');
    el.id = 'pt-adv-picker';
    el.style.cssText = `position:fixed;z-index:100000;background:#1e222d;border:1px solid #7d808b;border-radius:6px;padding:12px;box-shadow:0 8px 24px rgba(0,0,0,0.6);width:200px;`;
    el.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
        <div id="ap-preview" style="width:24px;height:24px;background:${baseHex};border:1px solid #7d808b;border-radius:4px;flex-shrink:0;"></div>
        <input id="ap-hex" type="text" value="${baseHex.toUpperCase()}" style="flex:1;background:#131722;border:1px solid #2962ff;color:#a3a6af;padding:4px 6px;border-radius:4px;font-family:monospace;font-size:12px;outline:none;"/>
        <button id="ap-add" style="background:#a3a6af;color:#131722;border:none;padding:4px 10px;border-radius:4px;cursor:pointer;font-weight:600;font-size:12px;">Add</button>
      </div>
      <div style="display:flex;gap:10px;">
        <div id="ap-sv" style="position:relative;width:140px;height:140px;background:${hueHex(H)};cursor:crosshair;border-radius:4px;overflow:hidden;flex-shrink:0;">
          <div style="position:absolute;inset:0;background:linear-gradient(to right,#fff,transparent);pointer-events:none;"></div>
          <div style="position:absolute;inset:0;background:linear-gradient(to top,#000,transparent);pointer-events:none;"></div>
          <div id="ap-sv-thumb" style="position:absolute;width:10px;height:10px;border:2px solid #fff;border-radius:50%;box-shadow:0 0 3px rgba(0,0,0,0.8);transform:translate(-50%,-50%);pointer-events:none;top:${(1-V)*140}px;left:${S*140}px;"></div>
        </div>
        <div id="ap-hue" style="position:relative;width:14px;height:140px;border-radius:4px;overflow:hidden;cursor:pointer;background:linear-gradient(to bottom,#f00,#ff0 17%,#0f0 33%,#0ff 50%,#00f 67%,#f0f 83%,#f00);flex-shrink:0;">
          <div id="ap-hue-thumb" style="position:absolute;left:0;right:0;height:4px;background:#fff;border:1px solid #000;border-radius:2px;transform:translateY(-50%);pointer-events:none;top:${H*140}px;"></div>
        </div>
      </div>
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:12px;padding-top:10px;border-top:1px solid #2a2e39;">
        <button id="ap-cancel" style="background:transparent;border:1px solid #7d808b;color:#a3a6af;padding:5px 14px;border-radius:4px;cursor:pointer;font-size:12px;">Cancel</button>
        <button id="ap-ok" style="background:#a3a6af;color:#131722;border:none;padding:5px 14px;border-radius:4px;cursor:pointer;font-weight:600;font-size:12px;">Ok</button>
      </div>
    `;
    document.body.appendChild(el);

    // Center Dialog
    el.style.top = '120px';
    el.style.left = '50%';
    el.style.transform = 'translateX(-50%)';

    const pv  = el.querySelector('#ap-preview');
    const hxI = el.querySelector('#ap-hex');
    const sv  = el.querySelector('#ap-sv');
    const svT = el.querySelector('#ap-sv-thumb');
    const hu  = el.querySelector('#ap-hue');
    const huT = el.querySelector('#ap-hue-thumb');

    const update = () => {
      const h = hex();
      sv.style.background = hueHex(H);
      pv.style.background = h;
      hxI.value = h.toUpperCase();
      svT.style.left = px(S*140); svT.style.top = px((1-V)*140);
      huT.style.top  = px(H*140);
    };

    let dragSV=false, dragHU=false;
    sv.addEventListener('mousedown', e => { dragSV=true; moveSV(e); });
    hu.addEventListener('mousedown', e => { dragHU=true; moveHU(e); });
    const moveSV = e => { const r=sv.getBoundingClientRect(); S=Math.max(0,Math.min(1,(e.clientX-r.left)/140)); V=1-Math.max(0,Math.min(1,(e.clientY-r.top)/140)); update(); };
    const moveHU = e => { const r=hu.getBoundingClientRect(); H=Math.max(0,Math.min(1,(e.clientY-r.top)/140)); update(); };
    const gMove = e => { if(dragSV) moveSV(e); if(dragHU) moveHU(e); };
    const gUp   = () => { dragSV=false; dragHU=false; };
    window.addEventListener('mousemove',gMove); window.addEventListener('mouseup',gUp);

    hxI.addEventListener('input', e => {
      if(/^#[0-9a-fA-F]{6}$/.test(e.target.value)) {
        const {r,g,b}=_hexToRgb(e.target.value); const h=_rgbToHsv(r,g,b);
        H=h.h; S=h.s; V=h.v; update();
      }
    });

    const cleanup = () => { window.removeEventListener('mousemove',gMove); window.removeEventListener('mouseup',gUp); el.remove(); };
    el.querySelector('#ap-cancel').onclick = cleanup;
    el.querySelector('#ap-add').onclick = el.querySelector('#ap-ok').onclick = () => { onOk(hex()); cleanup(); };
  }

  // ────────── COLOR PICKER DROPDOWN ──────────
  function _openColorMenu(anchorEl, currentColor, onSelect) {
    _closeAllMenus(); // Her zaman önce diğerlerini kapatır

    const {hex:baseHex, opacityPct:baseOp} = _parseColor(currentColor);
    const {r:cr, g:cg, b:cb} = _hexToRgb(baseHex);

    const el = document.createElement('div');
    el.style.cssText = `position:fixed;z-index:50000;background:#1e222d;border:1px solid #7d808b;border-radius:6px;padding:10px;box-shadow:0 6px 20px rgba(0,0,0,0.5);width:242px;`;

    const mainRows = TV_PALETTE.map(row =>
      `<div style="display:flex;gap:2px;margin-bottom:2px;">
        ${row.map(c => `<div class="ptc-cell${c.toLowerCase()===baseHex.toLowerCase()?' ptc-active':''}" data-c="${c}" style="background:${c};width:18px;height:18px;border-radius:2px;cursor:pointer;box-sizing:border-box;"></div>`).join('')}
       </div>`
    ).join('');

    const neonRow = [...NEON_PALETTE,...CUSTOM_PALETTE].map(c =>
      `<div class="ptc-cell${c.toLowerCase()===baseHex.toLowerCase()?' ptc-active':''}" data-c="${c}" style="background:${c};width:18px;height:18px;border-radius:2px;cursor:pointer;box-sizing:border-box;"></div>`
    ).join('');

    el.innerHTML = `
      <div>${mainRows}</div>
      <div style="height:1px;background:#2a2e39;margin:6px -10px;"></div>
      <div style="display:flex;align-items:center;gap:2px;flex-wrap:wrap;">
        ${neonRow}
        <div id="pt-add-custom" style="width:18px;height:18px;border-radius:2px;cursor:pointer;border:1px solid #7d808b;display:flex;align-items:center;justify-content:center;color:#787b86;">
          <svg viewBox="0 0 10 10" width="10" height="10" stroke="currentColor"><path d="M5 1v8M1 5h8" stroke-width="1.5"/></svg>
        </div>
      </div>
      <div style="height:1px;background:#2a2e39;margin:6px -10px;"></div>
      <div style="margin-top:4px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;">
          <span style="font-size:11px;color:#787b86;">Opacity</span>
          <span id="pt-op-val" style="font-size:11px;color:#a3a6af;background:#131722;border:1px solid #7d808b;padding:2px 6px;border-radius:3px;min-width:38px;text-align:center;">${baseOp}%</span>
        </div>
        <div style="position:relative;height:12px;border-radius:6px;overflow:hidden;background:repeating-conic-gradient(#363c4e 0% 25%,#2a2e39 0% 50%) 50%/10px 10px;cursor:pointer;" id="pt-op-track">
          <div id="pt-op-overlay" style="position:absolute;inset:0;background:linear-gradient(to right,rgba(${cr},${cg},${cb},0),rgba(${cr},${cg},${cb},1));pointer-events:none;"></div>
          <div id="pt-op-thumb" style="position:absolute;top:50%;width:14px;height:14px;border-radius:50%;background:#fff;border:2px solid #a3a6af;box-shadow:0 1px 4px rgba(0,0,0,0.5);transform:translate(-50%,-50%);pointer-events:none;left:${baseOp}%;"></div>
        </div>
        <input id="pt-op-slider" type="range" min="0" max="100" value="${baseOp}" style="position:absolute;opacity:0;pointer-events:none;"/>
      </div>
    `;

    document.body.appendChild(el);
    _openMenu = el; // Menü aktif

    // Position
    const rect = anchorEl.getBoundingClientRect();
    el.style.top  = (rect.bottom + 4) + 'px';
    el.style.left = rect.left + 'px';
    requestAnimationFrame(() => {
      if (parseFloat(el.style.left) + el.offsetWidth > window.innerWidth) el.style.left = (window.innerWidth - el.offsetWidth - 8) + 'px';
      if (parseFloat(el.style.top) + el.offsetHeight > window.innerHeight) el.style.top = (rect.top - el.offsetHeight - 4) + 'px';
    });

    let activeHex = baseHex;
    let activeOp  = baseOp;

    const applyOpacity = () => {
      const {r,g,b} = _hexToRgb(activeHex);
      el.querySelector('#pt-op-overlay').style.background = `linear-gradient(to right,rgba(${r},${g},${b},0),rgba(${r},${g},${b},1))`;
    };

    const emit = () => onSelect(_buildColor(activeHex, activeOp));

    // Color cell click events
    el.addEventListener('click', e => {
      const cell = e.target.closest('.ptc-cell');
      if (cell) {
        activeHex = cell.dataset.c;
        applyOpacity();
        emit();
        _closeAllMenus(); // [FIX] Renk seçilince picker'ı kapat — render hemen gerçekleşsin
        return;
      }
      if (e.target.closest('#pt-add-custom')) {
        _openAdvancedPicker(activeHex, newHex => {
          if (!CUSTOM_PALETTE.includes(newHex)) CUSTOM_PALETTE.push(newHex);
          activeHex = newHex;
          emit();
          _closeAllMenus();
          // Added color will be shown if they open it again.
        });
      }
    });

    // Opacity track events
    const track = el.querySelector('#pt-op-track');
    const thumb = el.querySelector('#pt-op-thumb');
    const valEl = el.querySelector('#pt-op-val');
    let draggingOp = false;

    const updateOp = e => {
      const r = track.getBoundingClientRect();
      let pct = Math.round(Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100)));
      activeOp = pct;
      thumb.style.left = pct + '%';
      valEl.textContent = pct + '%';
      emit();
    };
    track.addEventListener('mousedown', e => { draggingOp=true; updateOp(e); });
    const gMove = e => { if(draggingOp) updateOp(e); };
    const gUp   = () => { draggingOp=false; };
    window.addEventListener('mousemove', gMove);
    window.addEventListener('mouseup',   gUp);
    
    _sliderCleanup = () => {
      window.removeEventListener('mousemove', gMove);
      window.removeEventListener('mouseup', gUp);
    };

    // Outside click event
    _outsideHandler = function(e) {
      if (!el.contains(e.target) && !anchorEl.contains(e.target)) {
        _closeAllMenus();
      }
    };
    setTimeout(() => { document.addEventListener('mousedown', _outsideHandler); }, 0);
  }

  // ────────── WIDTH DROPDOWN ──────────
  function _openWidthMenu(anchorEl, currentWidth, onSelect) {
    _closeAllMenus();

    const el = document.createElement('div');
    el.style.cssText = `position:fixed;z-index:50000;background:#1e222d;border:1px solid #7d808b;border-radius:6px;padding:4px 0;box-shadow:0 6px 20px rgba(0,0,0,0.5);min-width:100px;`;

    const items = [1,2,3,4];
    el.innerHTML = items.map(w => `
      <div class="pt-w-item${w===currentWidth?' pt-w-active':''}" data-w="${w}" style="display:flex;align-items:center;gap:10px;padding:7px 14px;cursor:pointer;color:${ w===currentWidth ? '#f0b90b' : '#a3a6af'};font-size:13px;">
        <svg width="28" height="${Math.max(2,w+1)}" viewBox="0 0 28 ${Math.max(2,w+1)}">
          <line x1="0" y1="${(Math.max(2,w+1))/2}" x2="28" y2="${(Math.max(2,w+1))/2}" stroke="${w===currentWidth?'#f0b90b':'#a3a6af'}" stroke-width="${w}"/>
        </svg>
        ${w}px
      </div>
    `).join('');

    document.body.appendChild(el);
    _openMenu = el;

    const rect = anchorEl.getBoundingClientRect();
    el.style.top  = (rect.bottom + 4) + 'px';
    el.style.left = rect.left + 'px';

    el.addEventListener('click', e => {
      const item = e.target.closest('.pt-w-item');
      if (!item) return;
      onSelect(parseInt(item.dataset.w));
      _closeAllMenus(); // [FIX] Seçim sonrası menüyü kapat — render hemen gerçekleşsin
    });

    _outsideHandler = function(e) {
      if (!el.contains(e.target) && !anchorEl.contains(e.target)) {
        _closeAllMenus();
      }
    };
    setTimeout(() => { document.addEventListener('mousedown', _outsideHandler); }, 0);
  }

  // ────────── FONT SIZE DROPDOWN ──────────
  function _openFontSizeMenu(anchorEl, currentSize, onSelect) {
    _closeAllMenus();

    const el = document.createElement('div');
    el.style.cssText = `position:fixed;z-index:50000;background:#1e222d;border:1px solid #7d808b;border-radius:6px;padding:4px 0;box-shadow:0 6px 20px rgba(0,0,0,0.5);min-width:60px;max-height:200px;overflow-y:auto;`;

    const items = [10, 11, 12, 14, 16, 20, 24, 28, 32, 40, 80];
    el.innerHTML = items.map(s => `
      <div class="pt-fs-item${s===currentSize?' pt-fs-active':''}" data-s="${s}" style="padding:6px 14px;cursor:pointer;color:${ s===currentSize ? '#f0b90b' : '#a3a6af'};font-size:13px;text-align:center;">
        ${s}
      </div>
    `).join('');

    document.body.appendChild(el);
    _openMenu = el;

    const rect = anchorEl.getBoundingClientRect();
    el.style.top  = (rect.bottom + 4) + 'px';
    el.style.left = rect.left + 'px';

    el.addEventListener('click', e => {
      const item = e.target.closest('.pt-fs-item');
      if (!item) return;
      onSelect(parseInt(item.dataset.s));
      _closeAllMenus(); // [FIX] Seçim sonrası menüyü kapat — render hemen gerçekleşsin
    });

    _outsideHandler = function(e) {
      if (!el.contains(e.target) && !anchorEl.contains(e.target)) {
        _closeAllMenus();
      }
    };
    setTimeout(() => { document.addEventListener('mousedown', _outsideHandler); }, 0);
  }

  // ────────── LINE STYLE DROPDOWN ──────────
  function _openStyleMenu(anchorEl, currentStyle, onSelect) {
    _closeAllMenus();

    const el = document.createElement('div');
    el.style.cssText = `position:fixed;z-index:50000;background:#1e222d;border:1px solid #7d808b;border-radius:6px;padding:4px 0;box-shadow:0 6px 20px rgba(0,0,0,0.5);min-width:130px;`;

    const styles = [
      { key:'solid',  label:'Line',        svg:'<line x1="0" y1="1" x2="28" y2="1" stroke="currentColor" stroke-width="2"/>' },
      { key:'dashed', label:'Dashed line', svg:'<line x1="0" y1="1" x2="28" y2="1" stroke="currentColor" stroke-width="2" stroke-dasharray="5,3"/>' },
      { key:'dotted', label:'Dotted line', svg:'<line x1="0" y1="1" x2="28" y2="1" stroke="currentColor" stroke-width="2" stroke-dasharray="2,2"/>' }
    ];

    el.innerHTML = styles.map(s => `
      <div class="pt-s-item" data-s="${s.key}" style="display:flex;align-items:center;gap:10px;padding:8px 14px;cursor:pointer;color:${s.key===currentStyle?'#f0b90b':'#a3a6af'};font-size:13px;">
        <svg width="28" height="2" viewBox="0 0 28 2" style="flex-shrink:0;color:${s.key===currentStyle?'#f0b90b':'#a3a6af'}">${s.svg}</svg>
        ${s.label}
      </div>
    `).join('');

    document.body.appendChild(el);
    _openMenu = el;

    const rect = anchorEl.getBoundingClientRect();
    el.style.top  = (rect.bottom + 4) + 'px';
    el.style.left = rect.left + 'px';

    el.addEventListener('click', e => {
      const item = e.target.closest('.pt-s-item');
      if (!item) return;
      onSelect(item.dataset.s);
      _closeAllMenus(); // [FIX] Seçim sonrası menüyü kapat — render hemen gerçekleşsin
    });

    _outsideHandler = function(e) {
      if (!el.contains(e.target) && !anchorEl.contains(e.target)) {
        _closeAllMenus();
      }
    };
    setTimeout(() => { document.addEventListener('mousedown', _outsideHandler); }, 0);
  }

  // ────────── BUILD TOOLBAR ──────────
  function _buildToolbar(x, y) {
    document.getElementById('pt-toolbar')?.remove();
    _closeAllMenus();

    const s = _drawing.style || {};
    const color     = s.color     || (_drawing.tool === 'flattopbottom' ? '#FF9800' : '#2962ff');
    const textColor = s.textColor || '#ffffff';
    const width     = s.width     || 1;
    const lineStyle = s.lineStyle || 'solid';

    const {hex} = _parseColor(color);

    const dashSvg = lineStyle === 'dashed'
      ? '<line x1="2" y1="8" x2="26" y2="8" stroke="#a3a6af" stroke-width="2" stroke-dasharray="5,3"/>'
      : lineStyle === 'dotted'
        ? '<line x1="2" y1="8" x2="26" y2="8" stroke="#a3a6af" stroke-width="2" stroke-dasharray="2,2"/>'
        : '<line x1="2" y1="8" x2="26" y2="8" stroke="#a3a6af" stroke-width="2"/>';

    const dashSvgSmall = lineStyle === 'dashed'
      ? '<line x1="2" y1="8" x2="22" y2="8" stroke="#a3a6af" stroke-width="2" stroke-dasharray="5,3"/>'
      : lineStyle === 'dotted'
        ? '<line x1="2" y1="8" x2="22" y2="8" stroke="#a3a6af" stroke-width="2" stroke-dasharray="2,2"/>'
        : '<line x1="2" y1="8" x2="22" y2="8" stroke="#a3a6af" stroke-width="2"/>';

    const isFibo = _drawing.tool && _drawing.tool.startsWith('fib');
    const isPosition = ['longpos', 'shortpos'].includes(_drawing.tool);

    const hasFill = ['rect', 'rotatedrect', 'circle', 'ellipse', 'channel', 'triangle', 'arc', 'pricerange', 'daterange', 'datepricerange'].includes(_drawing.tool);
    const hasText = !['arrowdraw', 'regression', 'rotatedrect', 'circle', 'ellipse', 'arrowmarker', 'arrowup', 'arrowdown', 'triangle', 'arc', 'pathtool', 'trendangle', 'crossline', 'fixedvolprof', 'anchvolprof', 'brush', 'highlighter'].includes(_drawing.tool);
    // gorevler2.md Görev 11 (2026-08-10, kullanıcı onaylı kapsam) — eskiden
    // çoğu araçta görünüyordu ama tıklayınca sadece "yakında" alert'i
    // gösteriyordu. Artık gerçekten AlertStore'a kaydediyor, bu yüzden
    // sadece kullanıcının belirlediği 7 çizgi aracında gösteriliyor.
    const hasAlert = window.AlertStore ? window.AlertStore.SUPPORTED_TOOLS.includes(_drawing.tool) : false;

    _panel = document.createElement('div');
    _panel.id = 'pt-toolbar';

    const dragHtml = `
      <div id="pt-drag" style="display:flex;align-items:center;justify-content:center;width:21px;height:28px;cursor:grab;color:#5d606b;border-right:1px solid #2a2e39;padding-right:6px;margin-right:3px;flex-shrink:0;">
        <svg viewBox="0 0 10 14" width="10" height="14" fill="currentColor">
          <circle cx="3" cy="2" r="1.5"/><circle cx="3" cy="7" r="1.5"/><circle cx="3" cy="12" r="1.5"/>
          <circle cx="7" cy="2" r="1.5"/><circle cx="7" cy="7" r="1.5"/><circle cx="7" cy="12" r="1.5"/>
        </svg>
      </div>
    `;

    // ── Standard TradingView-matching SVG icons ──
    const templateSvg = `
      <svg width="26" height="26" viewBox="0 0 28 28" fill="none" stroke="currentColor">
        <rect x="6" y="6" width="6" height="6" rx="1.5" stroke-width="1.5"/>
        <rect x="16" y="6" width="6" height="6" rx="1.5" stroke-width="1.5"/>
        <rect x="6" y="16" width="6" height="6" rx="1.5" stroke-width="1.5"/>
        <path d="M19 16v6M16 19h6" stroke-width="1.5" stroke-linecap="round"/>
      </svg>`;

    const pencilSvg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="22" height="22" fill="none" stroke="currentColor">
        <path d="M8.5 20H5v-3.5L16.5 5.5l3.5 3.5L8.5 20z" stroke-width="1.5" stroke-linejoin="round"/>
      </svg>`;

    const textSvg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="26" height="26" fill="none" stroke="currentColor">
        <path d="M7 8h14M14 8v12M11 20h6" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`;

    const paintBucketSvg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="26" height="26" fill="none" stroke="currentColor">
        <path d="M12.5 5.5l9 9-4.5 4.5-9-9 4.5-4.5z" stroke-width="1.5"/>
        <path d="M8 10L6.5 11.5C5.5 12.5 5.5 15 7.5 15s4-1 4-1l1.5-1.5" stroke-width="1.5" stroke-linecap="round"/>
        <circle cx="21" cy="7" r="1.5" fill="currentColor" stroke="none"/>
      </svg>`;

    const settingsSvg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="26" height="26" fill="none" stroke="currentColor">
        <path d="M14 5.5l7.36 4.25v8.5L14 22.5l-7.36-4.25v-8.5L14 5.5z" stroke-width="1.5" stroke-linejoin="round"/>
        <circle cx="14" cy="14" r="3.5" stroke-width="1.5"/>
      </svg>`;

    // Bell / alert
    const alertSvg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="28" height="28"><path fill="currentColor" d="m19.54 4.5 3.96 4.32-.74.68-3.96-4.32.74-.68ZM7.46 4.5 3.5 8.82l.74.68L8.2 5.18l-.74-.68ZM19.74 10.33A7.5 7.5 0 0 1 21 14.5v.5h1v-.5a8.5 8.5 0 1 0-8.5 8.5h.5v-1h-.5a7.5 7.5 0 1 1 6.24-11.67Z"/><path fill="currentColor" d="M13 9v5h-3v1h4V9h-1ZM19 20v-4h1v4h4v1h-4v4h-1v-4h-4v-1h4Z"/></svg>`;

    const deleteSvg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="26" height="26" fill="none" stroke="currentColor">
        <path d="M10 8V5.5a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 .5.5V8" stroke-width="1.5"/>
        <path d="M6 8h16" stroke-width="1.5" stroke-linecap="round"/>
        <path d="M8.5 8l.8 13.5a1.5 1.5 0 0 0 1.5 1.5h6.4a1.5 1.5 0 0 0 1.5-1.5L19.5 8" stroke-width="1.5"/>
      </svg>`;

    const lockSvg = _drawing.locked
      ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="26" height="26" fill="none" stroke="currentColor"><rect x="9" y="13" width="10" height="8" rx="1.5" stroke-width="1.5"/><path d="M11 13V9a3 3 0 0 1 6 0v4" stroke-width="1.5"/></svg>`
      : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="26" height="26" fill="none" stroke="currentColor"><rect x="9" y="13" width="10" height="8" rx="1.5" stroke-width="1.5"/><path d="M11 13V9a3 3 0 0 1 6 0" stroke-width="1.5"/></svg>`;

    const commonEndHtml = `
      <!-- Lock -->
      <button id="pt-btn-lock" class="pt-btn" title="${_drawing.locked ? 'Unlock drawing' : 'Lock drawing'}" style="color: ${_drawing.locked ? '#f0b90b' : ''}">
        ${lockSvg}
      </button>
      <!-- Delete -->
      <button id="pt-btn-delete" class="pt-btn pt-btn-danger" title="Remove drawing">
        ${deleteSvg}
      </button>
    `;

    if (isPosition) {
      const topColor = s.targetColor || 'rgba(8,153,129,0.2)';
      const btmColor = s.stopColor || 'rgba(242,54,69,0.2)';
      _panel.innerHTML = `
        ${dragHtml}
        <!-- Template -->
        <button id="pt-btn-template" class="pt-btn" title="Templates">${templateSvg}</button>

        <!-- Text Color -->
        <button id="pt-btn-textcolor" class="pt-btn pt-btn-color" title="Text color">
          ${textSvg}
          <div id="pt-text-color-bar" style="width:16px;height:3px;border-radius:2px;margin-top:2px;background:${textColor};"></div>
        </button>

        <!-- Profit Background Color -->
        <button id="pt-btn-profit-color" class="pt-btn pt-btn-color" title="Profit background color">
          ${paintBucketSvg}
          <div id="pt-profit-color-bar" style="width:16px;height:4px;border-radius:2px;margin-top:2px;background:${topColor};"></div>
        </button>

        <!-- Stop Background Color -->
        <button id="pt-btn-stop-color" class="pt-btn pt-btn-color" title="Stop background color">
          ${paintBucketSvg}
          <div id="pt-stop-color-bar" style="width:16px;height:4px;border-radius:2px;margin-top:2px;background:${btmColor};"></div>
        </button>

        <!-- Settings -->
        <button id="pt-btn-settings" class="pt-btn" title="Settings">${settingsSvg}</button>

        ${commonEndHtml}
      `;
    } else if (isFibo) {
      _panel.innerHTML = `
        ${dragHtml}
        <!-- Template -->
        <button id="pt-btn-template" class="pt-btn" title="Templates">${templateSvg}</button>

        <!-- Line Color -->
        <button id="pt-btn-color" class="pt-btn pt-btn-color" title="Color">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="22" height="22" fill="none" stroke="currentColor">
            <path d="M8.5 20H5v-3.5L16.5 5.5l3.5 3.5L8.5 20z" stroke-width="1.5" stroke-linejoin="round"/>
          </svg>
          <div id="pt-line-color-bar" style="width:18px;height:4px;border-radius:2px;margin-top:2px;background:linear-gradient(to right, #8b5cf6, #3b82f6, #10b981, #eab308, #ef4444);"></div>
        </button>

        <!-- Line Width -->
        <button id="pt-btn-width" class="pt-btn" title="Line width" style="gap:4px;padding:4px 6px;min-width:60px;">
          <span id="pt-width-label" style="display:flex;align-items:center;gap:6px;">
            <svg width="24" height="16" viewBox="0 0 24 16">${dashSvgSmall}</svg>
            <span style="font-size:14px;color:#a3a6af;">${width}px</span>
          </span>
        </button>

        <!-- Settings -->
        <button id="pt-btn-settings" class="pt-btn" title="Settings">${settingsSvg}</button>

        ${commonEndHtml}
      `;
    } else if (_drawing.tool === 'texttool') {
      _panel.innerHTML = `
        ${dragHtml}

        <!-- Text Color -->
        <button id="pt-btn-textcolor" class="pt-btn pt-btn-color" title="Text color">
          ${textSvg}
          <div id="pt-text-color-bar" style="width:16px;height:4px;border-radius:1px;margin-top:1px;background:${s.textColor || '#a3a6af'};"></div>
        </button>

        <!-- Background Color -->
        <button id="pt-btn-fillcolor" class="pt-btn pt-btn-color" title="Background color">
          ${paintBucketSvg}
          <div id="pt-fill-color-bar" style="width:16px;height:4px;border-radius:1px;margin-top:1px;background:${s.fillColor || 'transparent'};"></div>
        </button>

        <!-- Font Size -->
        <button id="pt-btn-fontsize" class="pt-btn" title="Font Size" style="gap:4px;padding:4px 6px;min-width:40px;">
          <span id="pt-fontsize-label" style="font-size:14px;color:#a3a6af;">${s.fontSize || 16}</span>
        </button>

        <!-- Settings -->
        <button id="pt-btn-settings" class="pt-btn" title="Settings">${settingsSvg}</button>

        ${commonEndHtml}
      `;
    } else if (['note', 'pricenote', 'tableanno'].includes(_drawing.tool)) {
      _panel.innerHTML = `
        ${dragHtml}

        <!-- Line Color -->
        <button id="pt-btn-color" class="pt-btn pt-btn-color" title="Line color">
          ${pencilSvg}
          <div id="pt-line-color-bar" style="width:16px;height:4px;border-radius:1px;margin-top:1px;background:${s.color || s.borderColor || '#787b86'};"></div>
        </button>

        <!-- Background Color -->
        <button id="pt-btn-fillcolor" class="pt-btn pt-btn-color" title="Background color">
          ${paintBucketSvg}
          <div id="pt-fill-color-bar" style="width:16px;height:4px;border-radius:1px;margin-top:1px;background:${s.fillColor || 'transparent'};"></div>
        </button>

        <!-- Text Color -->
        <button id="pt-btn-textcolor" class="pt-btn pt-btn-color" title="Text color">
          ${textSvg}
          <div id="pt-text-color-bar" style="width:16px;height:4px;border-radius:1px;margin-top:1px;background:${s.textColor || '#a3a6af'};"></div>
        </button>

        <!-- Font Size -->
        <button id="pt-btn-fontsize" class="pt-btn" title="Font Size" style="gap:4px;padding:4px 6px;min-width:40px;">
          <span id="pt-fontsize-label" style="font-size:14px;color:#a3a6af;">${s.fontSize || 13}</span>
        </button>

        <!-- Settings -->
        <button id="pt-btn-settings" class="pt-btn" title="Settings">${settingsSvg}</button>

        ${_drawing.tool === 'tableanno' ? `
        <!-- Table Row/Col Controls -->
        <div style="width:1px;height:16px;background:#2a2e39;margin:0 4px;"></div>
        <button id="pt-btn-row-add" class="pt-btn" title="Add Row" style="font-size:16px;font-weight:bold;padding:0 6px;">+R</button>
        <button id="pt-btn-row-rem" class="pt-btn" title="Remove Row" style="font-size:16px;font-weight:bold;padding:0 6px;">-R</button>
        <button id="pt-btn-col-add" class="pt-btn" title="Add Col" style="font-size:16px;font-weight:bold;padding:0 6px;">+C</button>
        <button id="pt-btn-col-rem" class="pt-btn" title="Remove Col" style="font-size:16px;font-weight:bold;padding:0 6px;">-C</button>
        ` : ''}

        ${commonEndHtml}
      `;
    } else if (['callout', 'pricelabel'].includes(_drawing.tool)) {
      _panel.innerHTML = `
        ${dragHtml}

        <!-- Text Color -->
        <button id="pt-btn-textcolor" class="pt-btn pt-btn-color" title="Text color">
          ${textSvg}
          <div id="pt-text-color-bar" style="width:16px;height:4px;border-radius:1px;margin-top:1px;background:${s.textColor || '#a3a6af'};"></div>
        </button>

        <!-- Background Color -->
        <button id="pt-btn-fillcolor" class="pt-btn pt-btn-color" title="Background color">
          ${paintBucketSvg}
          <div id="pt-fill-color-bar" style="width:16px;height:4px;border-radius:1px;margin-top:1px;background:${s.fillColor || (_drawing.tool === 'pricelabel' ? '#2962ff' : 'transparent')};"></div>
        </button>

        <!-- Font Size -->
        <button id="pt-btn-fontsize" class="pt-btn" title="Font Size" style="gap:4px;padding:4px 6px;min-width:40px;">
          <span id="pt-fontsize-label" style="font-size:14px;color:#a3a6af;">${s.fontSize || 13}</span>
        </button>

        <!-- Settings -->
        <button id="pt-btn-settings" class="pt-btn" title="Settings">${settingsSvg}</button>

        ${commonEndHtml}
      `;
    } else if (_drawing.tool === 'channel') {
      _panel.innerHTML = `
        ${dragHtml}

        <!-- Template -->
        <button id="pt-btn-template" class="pt-btn" title="Templates">${templateSvg}</button>

        <!-- Line Color -->
        <button id="pt-btn-color" class="pt-btn pt-btn-color" title="Line color">
          ${pencilSvg}
          <div id="pt-line-color-bar" style="width:16px;height:4px;border-radius:1px;margin-top:1px;background:${hex};"></div>
        </button>

        <!-- Fill Color -->
        <button id="pt-btn-fillcolor" class="pt-btn pt-btn-color" title="Fill color">
          ${paintBucketSvg}
          <div id="pt-fill-color-bar" style="width:16px;height:4px;border-radius:1px;margin-top:1px;background:${s.fillColor || 'rgba(9, 105, 218, 0.2)'};"></div>
        </button>

        <!-- Text -->
        <button id="pt-btn-textcolor" class="pt-btn pt-btn-color" title="Text color">
          ${textSvg}
          <div id="pt-text-color-bar" style="width:16px;height:4px;border-radius:1px;margin-top:1px;background:${s.textColor || '#a3a6af'};"></div>
        </button>

        <!-- Line Width -->
        <button id="pt-btn-width" class="pt-btn" title="Line width" style="gap:4px;padding:4px 6px;min-width:60px;">
          <span id="pt-width-label" style="display:flex;align-items:center;gap:4px;">
            <svg width="28" height="16" viewBox="0 0 28 16">${dashSvg}</svg>
            <span style="font-size:12px;color:#a3a6af;">${width}px</span>
          </span>
        </button>

        <!-- Line Style -->
        <button id="pt-btn-style" class="pt-btn" title="Line style" style="padding:4px 6px;">
          <span id="pt-style-icon" style="display:flex;align-items:center;">
            <svg width="28" height="16" viewBox="0 0 28 16">${dashSvg}</svg>
          </span>
        </button>

        <!-- Settings -->
        <button id="pt-btn-settings" class="pt-btn" title="Settings">${settingsSvg}</button>

        ${commonEndHtml}
      `;
    } else if (_drawing.tool === 'flagmark') {
      _panel.innerHTML = `
        ${dragHtml}

        <!-- Flag Color -->
        <button id="pt-btn-fillcolor" class="pt-btn pt-btn-color" title="Flag color">
          ${paintBucketSvg}
          <div id="pt-fill-color-bar" style="width:16px;height:4px;border-radius:1px;margin-top:1px;background:${s.color || '#2962ff'};"></div>
        </button>

        <!-- Settings -->
        <button id="pt-btn-settings" class="pt-btn" title="Settings">${settingsSvg}</button>

        ${commonEndHtml}
      `;
    } else {
      _panel.innerHTML = `
        ${dragHtml}

        <!-- Template -->
        <button id="pt-btn-template" class="pt-btn" title="Templates">${templateSvg}</button>

        <!-- Line Color (pencil) — regression'da gösterme -->
        ${_drawing.tool !== 'regression' ? `
        <button id="pt-btn-color" class="pt-btn pt-btn-color" title="Line color">
          ${pencilSvg}
          <div id="pt-line-color-bar" style="width:16px;height:4px;border-radius:1px;margin-top:1px;background:${hex};"></div>
        </button>
        ` : ''}

        <!-- Fill Color -->
        ${hasFill ? `
        <button id="pt-btn-fillcolor" class="pt-btn pt-btn-color" title="Fill color">
          ${paintBucketSvg}
          <div id="pt-fill-color-bar" style="width:16px;height:4px;border-radius:1px;margin-top:1px;background:${s.fillColor || 'rgba(9, 105, 218, 0.2)'};"></div>
        </button>
        ` : ''}

        <!-- Background Color (flattopbottom) -->
        ${_drawing.tool === 'flattopbottom' ? `
        <button id="pt-btn-bgcolor" class="pt-btn pt-btn-color" title="Background color">
          ${paintBucketSvg}
          <div id="pt-bg-color-bar" style="width:16px;height:4px;border-radius:1px;margin-top:1px;background:${s.bgColor || s.color || '#FF9800'};opacity:${(s.bgOpacity ?? 15) / 100};"></div>
        </button>
        ` : ''}

        <!-- Text Color -->
        ${hasText ? `
        <button id="pt-btn-textcolor" class="pt-btn pt-btn-color" title="Text color">
          ${textSvg}
          <div id="pt-text-color-bar" style="width:16px;height:4px;border-radius:1px;margin-top:1px;background:${textColor};"></div>
        </button>
        ` : ''}

        <!-- Line Width — regression'da gösterme -->
        ${_drawing.tool !== 'regression' ? `
        <button id="pt-btn-width" class="pt-btn" title="Line width" style="gap:4px;padding:4px 6px;min-width:60px;">
          <span id="pt-width-label" style="display:flex;align-items:center;gap:4px;">
            <svg width="28" height="16" viewBox="0 0 28 16">${dashSvg}</svg>
            <span style="font-size:12px;color:#a3a6af;">${width}px</span>
          </span>
        </button>

        <!-- Line Style -->
        <button id="pt-btn-style" class="pt-btn" title="Line style" style="padding:4px 6px;">
          <span id="pt-style-icon" style="display:flex;align-items:center;">
            <svg width="28" height="16" viewBox="0 0 28 16">${dashSvg}</svg>
          </span>
        </button>
        ` : ''}

        <!-- Settings -->
        <button id="pt-btn-settings" class="pt-btn" title="Settings">${settingsSvg}</button>

        ${hasAlert ? `
        <!-- Alert -->
        <button id="pt-btn-alert" class="pt-btn" title="Add alert">${alertSvg}</button>
        ` : ''}

        ${commonEndHtml}
      `;
    }

    document.body.appendChild(_panel);

    // Position toolbar
    let savedPos = null;
    try {
      const saved = localStorage.getItem('pt_toolbar_pos');
      if (saved) savedPos = JSON.parse(saved);
    } catch(e) {}

    if (savedPos && savedPos.left !== undefined && savedPos.top !== undefined) {
      _panel.style.left = savedPos.left + 'px';
      _panel.style.top = savedPos.top + 'px';
      requestAnimationFrame(() => {
        let px_ = _panel.offsetLeft;
        let py_ = _panel.offsetTop;
        const pw = _panel.offsetWidth;
        const ph = _panel.offsetHeight;
        if (px_ + pw > window.innerWidth) px_ = window.innerWidth - pw - 8;
        if (py_ + ph > window.innerHeight) py_ = window.innerHeight - ph - 8;
        px_ = Math.max(8, px_);
        py_ = Math.max(8, py_);
        _panel.style.left = px_ + 'px';
        _panel.style.top  = py_ + 'px';
      });
    } else {
      const TOOLBAR_H = 40; // approximate toolbar height
      let px_ = Math.max(8, x - _panel.offsetWidth / 2);
      let py_ = Math.max(8, y - TOOLBAR_H - 12); // default: above click
      _panel.style.left = px_ + 'px';
      _panel.style.top  = py_ + 'px';
      requestAnimationFrame(() => {
        const pw = _panel.offsetWidth;
        const ph = _panel.offsetHeight;
        if (px_ + pw > window.innerWidth) px_ = window.innerWidth - pw - 8;
        if (py_ < 8) py_ = y + 12; // flip to below if too close to top
        if (py_ + ph > window.innerHeight) py_ = y - ph - 8;
        px_ = Math.max(8, px_);
        py_ = Math.max(8, py_);
        _panel.style.left = px_ + 'px';
        _panel.style.top  = py_ + 'px';
      });
    }

    // ── Drag ──
    const drag = _panel.querySelector('#pt-drag');
    if (drag) {
      drag.addEventListener('mousedown', e => {
        e.preventDefault();
        _closeAllMenus(); // Sürüklerken varsa menü kapatılsın
        const ox = e.clientX - _panel.offsetLeft;
        const oy = e.clientY - _panel.offsetTop;
        const mv = ev => { _panel.style.left=(ev.clientX-ox)+'px'; _panel.style.top=(ev.clientY-oy)+'px'; };
        const up = () => { 
          document.removeEventListener('mousemove',mv); 
          document.removeEventListener('mouseup',up); 
          try { localStorage.setItem('pt_toolbar_pos', JSON.stringify({ left: _panel.offsetLeft, top: _panel.offsetTop })); } catch(e){}
        };
        document.addEventListener('mousemove',mv); document.addEventListener('mouseup',up);
      });
      drag.addEventListener('mouseenter', () => drag.style.color='#a3a6af');
      drag.addEventListener('mouseleave', () => drag.style.color='#5d606b');
    }

    // Mousedown engellemesini UI butonlarına koy ki tıklandığında alttaki harita (canvas) deselect etmesin
    _panel.addEventListener('mousedown', e => e.stopPropagation());

    // ── EVENT BINDINGS ──
    const btnTemplate = _panel.querySelector('#pt-btn-template');
    if (btnTemplate) {
      btnTemplate.onclick = () => {
        _closeAllMenus();
        if (window.DrawingSettingsDialog && DrawingSettingsDialog.showTemplateMenu) {
          DrawingSettingsDialog.showTemplateMenu(btnTemplate, _drawing);
        }
      };
    }

    const btnColor = _panel.querySelector('#pt-btn-color');
    if (btnColor) {
      btnColor.onclick = e => {
        if (_openMenu && _openMenu.dataset.srcBtn === 'color') {
          _closeAllMenus();
          return;
        }
        const btn = e.currentTarget;
        const s = _drawing.style || {};
        const defaultStyle = (window.DrawingManager && DrawingManager._getToolStyle) ? (window.DrawingManager && window.DrawingManager._getToolStyle ? window.DrawingManager._getToolStyle(_drawing.tool) : {}) : {};
        const curLine = s.color || defaultStyle.color || '#2962ff';
        
        _openColorMenu(btn, curLine, newColor => {
          _drawing.style = _drawing.style || {};
          if (['note', 'pricenote'].includes(_drawing.tool)) {
            _drawing.style.color = newColor;
            _drawing.style.borderColor = newColor;
            _panel.querySelector('#pt-line-color-bar').style.background = newColor;
          } else if (_drawing.tool === 'tableanno') {
            _drawing.style.borderColor = newColor;
            _panel.querySelector('#pt-line-color-bar').style.background = newColor;
          } else {
            _drawing.style.color = newColor;
            if (!isFibo) {
              const {hex} = _parseColor(newColor);
              _panel.querySelector('#pt-line-color-bar').style.background = hex;
            } else {
              _drawing.style.useOneColor = newColor;
            }
          }
          _redraw();
        });
        if (_openMenu) _openMenu.dataset.srcBtn = 'color';
      };
    }

    const btnFillColor = _panel.querySelector('#pt-btn-fillcolor');
    if (btnFillColor) {
      btnFillColor.onclick = e => {
        if (_openMenu && _openMenu.dataset.srcBtn === 'fill') {
          _closeAllMenus();
          return;
        }
        const btn = e.currentTarget;
        const s = _drawing.style || {};
        const defaultStyle = (window.DrawingManager && window.DrawingManager._getToolStyle ? window.DrawingManager._getToolStyle(_drawing.tool) : {});

        // Decouple: Use own fillColor, then core default. Never fallback to line color.
        const curFill = s.fillColor || defaultStyle.fillColor || 'rgba(0,0,0,0)';
        
        _openColorMenu(btn, curFill, newColor => {
          _drawing.style = _drawing.style || {};
          if (_drawing.tool === 'flagmark') {
            _drawing.style.color = newColor;
          } else {
            _drawing.style.fillColor = newColor;
          }
          const bar = _panel.querySelector('#pt-fill-color-bar');
          if (bar) bar.style.background = newColor;
          _redraw();
        });
        if (_openMenu) _openMenu.dataset.srcBtn = 'fill';
      };
    }

    const btnTextColor = _panel.querySelector('#pt-btn-textcolor');
    if (btnTextColor) {
      btnTextColor.onclick = e => {
        if (_openMenu && _openMenu.dataset.srcBtn === 'textcolor') {
          _closeAllMenus();
          return;
        }
        const btn = e.currentTarget;
        const s = _drawing.style || {};
        const defaultStyle = (window.DrawingManager && window.DrawingManager._getToolStyle ? window.DrawingManager._getToolStyle(_drawing.tool) : {});

        const curColor = s.textColor || defaultStyle.textColor || '#ffffff';
        
        _openColorMenu(btn, curColor, newColor => {
          _drawing.style = _drawing.style || {};
          _drawing.style.textColor = newColor;
          const bar = _panel.querySelector('#pt-text-color-bar');
          if (bar) bar.style.background = newColor;
          _redraw();
        });
        if (_openMenu) _openMenu.dataset.srcBtn = 'textcolor';
      };
    }

    const btnBgColor = _panel.querySelector('#pt-btn-bgcolor');
    if (btnBgColor) {
      btnBgColor.onclick = e => {
        if (_openMenu && _openMenu.dataset.srcBtn === 'bgcolor') {
          _closeAllMenus();
          return;
        }
        const btn = e.currentTarget;
        const s = _drawing.style || {};
        const defaultStyle = (window.DrawingManager && window.DrawingManager._getToolStyle ? window.DrawingManager._getToolStyle(_drawing.tool) : {});

        // Decouple: Use own bgColor. Never fallback to line color (s.color).
        const curOpacity = s.bgOpacity ?? defaultStyle.bgOpacity ?? 15;
        const curHex     = s.bgColor || defaultStyle.bgColor || '#FF9800';
        const {r, g, b}  = _hexToRgb(curHex);
        const curColor   = `rgba(${r},${g},${b},${curOpacity / 100})`;

        _openColorMenu(btn, curColor, newColor => {
          _drawing.style = _drawing.style || {};

          if (newColor.startsWith('rgba') || newColor.startsWith('rgb')) {
            const m = newColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
            if (m) {
              _drawing.style.bgColor   = '#' + (+m[1]).toString(16).padStart(2,'0')
                                             + (+m[2]).toString(16).padStart(2,'0')
                                             + (+m[3]).toString(16).padStart(2,'0');
              _drawing.style.bgOpacity = m[4] != null ? Math.round(parseFloat(m[4]) * 100) : 100;
            }
          } else {
            _drawing.style.bgColor   = newColor;
            _drawing.style.bgOpacity = 100;
          }

          const bar = _panel.querySelector('#pt-bg-color-bar');
          if (bar) {
            bar.style.background = _drawing.style.bgColor;
            bar.style.opacity    = _drawing.style.bgOpacity / 100;
          }
          _redraw();
        });
        if (_openMenu) _openMenu.dataset.srcBtn = 'bgcolor';
      };
    }

    const btnProfitColor = _panel.querySelector('#pt-btn-profit-color');
    if (btnProfitColor) {
      btnProfitColor.onclick = e => {
        if (_openMenu && _openMenu.dataset.srcBtn === 'profitcolor') {
          _closeAllMenus();
          return;
        }
        const btn = e.currentTarget;
        const s = _drawing.style || {};
        _openColorMenu(btn, s.targetColor || 'rgba(8,153,129,0.2)', newColor => {
          _drawing.style = _drawing.style || {};
          _drawing.style.targetColor = newColor;
          _panel.querySelector('#pt-profit-color-bar').style.background = newColor;
          _redraw();
        });
        if (_openMenu) _openMenu.dataset.srcBtn = 'profitcolor';
      };
    }

    const btnStopColor = _panel.querySelector('#pt-btn-stop-color');
    if (btnStopColor) {
      btnStopColor.onclick = e => {
        if (_openMenu && _openMenu.dataset.srcBtn === 'stopcolor') {
          _closeAllMenus();
          return;
        }
        const btn = e.currentTarget;
        const s = _drawing.style || {};
        _openColorMenu(btn, s.stopColor || 'rgba(242,54,69,0.2)', newColor => {
          _drawing.style = _drawing.style || {};
          _drawing.style.stopColor = newColor;
          _panel.querySelector('#pt-stop-color-bar').style.background = newColor;
          _redraw();
        });
        if (_openMenu) _openMenu.dataset.srcBtn = 'stopcolor';
      };
    }

    const btnWidth = _panel.querySelector('#pt-btn-width');
    if (btnWidth) {
      btnWidth.onclick = e => {
        if (_openMenu && _openMenu.dataset.srcBtn === 'width') {
          _closeAllMenus();
          return;
        }
        const btn = e.currentTarget;
        const curW = _drawing.style?.width || 1;
        _openWidthMenu(btn, curW, newW => {
          _drawing.style = _drawing.style || {};
          _drawing.style.width = newW;
          const ds = _drawing.style?.lineStyle || 'solid';
          const dsvg = ds==='dashed'
            ? '<line x1="2" y1="8" x2="22" y2="8" stroke="#a3a6af" stroke-width="2" stroke-dasharray="5,3"/>'
            : ds==='dotted'
              ? '<line x1="2" y1="8" x2="22" y2="8" stroke="#a3a6af" stroke-width="2" stroke-dasharray="2,2"/>'
              : '<line x1="2" y1="8" x2="22" y2="8" stroke="#a3a6af" stroke-width="2"/>';
              
          const dsvgNormal = ds==='dashed'
            ? '<line x1="2" y1="8" x2="26" y2="8" stroke="#a3a6af" stroke-width="2" stroke-dasharray="5,3"/>'
            : ds==='dotted'
              ? '<line x1="2" y1="8" x2="26" y2="8" stroke="#a3a6af" stroke-width="2" stroke-dasharray="2,2"/>'
              : '<line x1="2" y1="8" x2="26" y2="8" stroke="#a3a6af" stroke-width="2"/>';

          if (isFibo) {
            _panel.querySelector('#pt-width-label').innerHTML = `
              <svg width="24" height="16" viewBox="0 0 24 16">${dsvg}</svg>
              <span style="font-size:14px;color:#a3a6af;">${newW}px</span>
            `;
          } else {
            _panel.querySelector('#pt-width-label').innerHTML = `
              <svg width="28" height="16" viewBox="0 0 28 16">${dsvgNormal}</svg>
              <span style="font-size:12px;color:#a3a6af;">${newW}px</span>
            `;
          }
          _redraw();
        });
        if (_openMenu) _openMenu.dataset.srcBtn = 'width';
      };
    }

    const btnStyle = _panel.querySelector('#pt-btn-style');
    if (btnStyle) {
      btnStyle.onclick = e => {
        if (_openMenu && _openMenu.dataset.srcBtn === 'style') {
          _closeAllMenus();
          return;
        }
        const btn = e.currentTarget;
        const curS = _drawing.style?.lineStyle || 'solid';
        _openStyleMenu(btn, curS, newS => {
          _drawing.style = _drawing.style || {};
          _drawing.style.lineStyle = newS;
          _drawing.style.dash = ''; // clear explicit dash from settings dialog
          const w2 = _drawing.style?.width || 1;
          const dsvgNormal = newS==='dashed'
            ? '<line x1="2" y1="8" x2="26" y2="8" stroke="#a3a6af" stroke-width="2" stroke-dasharray="5,3"/>'
            : newS==='dotted'
              ? '<line x1="2" y1="8" x2="26" y2="8" stroke="#a3a6af" stroke-width="2" stroke-dasharray="2,2"/>'
              : '<line x1="2" y1="8" x2="26" y2="8" stroke="#a3a6af" stroke-width="2"/>';
          
          _panel.querySelector('#pt-style-icon').innerHTML = `<svg width="28" height="16" viewBox="0 0 28 16">${dsvgNormal}</svg>`;
          _panel.querySelector('#pt-width-label').innerHTML = `
            <svg width="28" height="16" viewBox="0 0 28 16">${dsvgNormal}</svg>
            <span style="font-size:12px;color:#a3a6af;">${w2}px</span>
          `;
          _redraw();
        });
        if (_openMenu) _openMenu.dataset.srcBtn = 'style';
      };
    }

    const btnFontSize = _panel.querySelector('#pt-btn-fontsize');
    if (btnFontSize) {
      btnFontSize.onclick = e => {
        if (_openMenu && _openMenu.dataset.srcBtn === 'fontsize') {
          _closeAllMenus();
          return;
        }
        const btn = e.currentTarget;
        const curS = _drawing.style?.fontSize || 16;
        _openFontSizeMenu(btn, curS, newS => {
          _drawing.style = _drawing.style || {};
          _drawing.style.fontSize = newS;
          _panel.querySelector('#pt-fontsize-label').textContent = newS;
          _redraw();
        });
        if (_openMenu) _openMenu.dataset.srcBtn = 'fontsize';
      };
    }    // ── Table Controls ──
    const btnRowAdd = _panel.querySelector('#pt-btn-row-add');
    if (btnRowAdd) {
      btnRowAdd.onclick = () => {
        _drawing.style.rows = (_drawing.style.rows || 2) + 1;
        _saveTableData();
      };
    }
    const btnRowRem = _panel.querySelector('#pt-btn-row-rem');
    if (btnRowRem) {
      btnRowRem.onclick = () => {
        _drawing.style.rows = Math.max(1, (_drawing.style.rows || 2) - 1);
        _saveTableData();
      };
    }
    const btnColAdd = _panel.querySelector('#pt-btn-col-add');
    if (btnColAdd) {
      btnColAdd.onclick = () => {
        _drawing.style.cols = (_drawing.style.cols || 3) + 1;
        _saveTableData();
      };
    }
    const btnColRem = _panel.querySelector('#pt-btn-col-rem');
    if (btnColRem) {
      btnColRem.onclick = () => {
        _drawing.style.cols = Math.max(1, (_drawing.style.cols || 3) - 1);
        _saveTableData();
      };
    }

    function _saveTableData() {
      let data = (_drawing.text || '').split('\n').map(r => r.split('\t'));
      const rows = _drawing.style.rows || 2;
      const cols = _drawing.style.cols || 3;
      while (data.length < rows) data.push(Array(cols).fill(''));
      for (let r = 0; r < rows; r++) {
        while (data[r].length < cols) data[r].push('');
      }
      _drawing.text = data.slice(0, rows).map(r => r.slice(0, cols).join('\t')).join('\n');
      if (window.State) window.State.save();
      _redraw();
    }
    const btnSettings = _panel.querySelector('#pt-btn-settings');
    if (btnSettings) {
      btnSettings.onclick = (e) => {
        e.stopPropagation();
        _closeAllMenus();
        if (window.DrawingSettingsDialog) {
          // Hide the float toolbar while dialog is open; it will reappear on next selection
          document.getElementById('pt-toolbar')?.remove();
          // Attach current pane precision so Coordinates tab formats correctly
          if (window.DrawingManager && DrawingManager.getPanePrecision) {
            _drawing._panePrecision = DrawingManager.getPanePrecision(_drawing);
          }
          DrawingSettingsDialog.open(_drawing, {
            tab: 'style',
            onOk: (d) => {
              _redraw();
              // Re-show toolbar at same position after dialog closes
              if (_drawing) {
                const el = document.getElementById('pt-toolbar');
                if (!el) _buildToolbar(_lastX || window.innerWidth/2, _lastY || 100);
              }
            },
            onCancel: () => {
              if (_drawing) {
                const el = document.getElementById('pt-toolbar');
                if (!el) _buildToolbar(_lastX || window.innerWidth/2, _lastY || 100);
              }
            }
          });
        }
      };
    }

    const btnAlert = _panel.querySelector('#pt-btn-alert');
    if (btnAlert) {
      btnAlert.onclick = () => {
        _closeAllMenus();
        // gorevler2.md Görev 11.6 (2026-08-10) — artık anında oluşturmuyor,
        // Navbar'daki ⏰ Alert butonuyla AYNI TradingView-tarzı "Create Alert"
        // modalını açıyor (bkz. app.js _bindAlarmModal), bu çizgi önceden
        // seçili olarak.
        if (typeof EventBus !== 'undefined') EventBus.emit('modal:alarm:open', { drawing: _drawing });
      };
    }

    const btnLock = _panel.querySelector('#pt-btn-lock');
    if (btnLock) {
      btnLock.onclick = () => {
        _closeAllMenus();
        _drawing.locked = !_drawing.locked;
        btnLock.style.color = _drawing.locked ? '#f0b90b' : '';
        btnLock.title = _drawing.locked ? 'Unlock drawing' : 'Lock drawing';
        
        btnLock.querySelector('svg').innerHTML = _drawing.locked
          ? '<rect x="9" y="13" width="10" height="8" rx="1.5" stroke-width="1.5"/><path d="M11 13V9a3 3 0 0 1 6 0v4" stroke-width="1.5"/>'
          : '<rect x="9" y="13" width="10" height="8" rx="1.5" stroke-width="1.5"/><path d="M11 13V9a3 3 0 0 1 6 0" stroke-width="1.5"/>';
        
        State.save();
        _redraw();
      };
    }

    const btnDelete = _panel.querySelector('#pt-btn-delete');
    if (btnDelete) {
      btnDelete.onclick = () => {
        _closeAllMenus();
        if (_drawing.locked || window.DrawingManager.isGlobalLocked()) return; // kilitli çizim silinemez
        const sym = _symbol, id = _drawing.id;
        if (window.DrawingManager && window.DrawingManager.saveHistory) window.DrawingManager.saveHistory();
        State.removeDrawing(sym, id);
        EventBus.emit('drawing:deleted', { id });
        hide();
      };
    }

    const btnMore = _panel.querySelector('#pt-btn-more');
    if (btnMore) {
      btnMore.onclick = () => {
        _closeAllMenus();
        alert('Şablon olarak kaydet gibi diğer özellikler...');
      };
    }
}

  // ────────── PUBLIC API ──────────
  function show(x, y) {
    if (!_drawing) return;
    _lastX = x;
    _lastY = y;
    _buildToolbar(x, y);
  }

  function hide() {
    _closeAllMenus();
    document.getElementById('pt-toolbar')?.remove();
    _panel   = null;
    _drawing = null;
    _symbol  = null;
  }

  function init() {
    EventBus.on('drawing:selected', data => {
      if (data && data.id) {
        _symbol = data.symbol;
        const drawings = State.getDrawings(data.symbol);
        _drawing = drawings.find(d => d.id === data.id) || null;
        if (_drawing) {
          const isPos = ['longpos','shortpos'].includes(_drawing.tool);
          // For position tools: toolbar appears above the TOP edge of the shape
          let tx = data.x || window.innerWidth / 2;
          let ty = data.y || window.innerHeight / 2;
          if (isPos && data.topY != null) {
            ty = data.topY; // emit topY from drawing-core when pos tool selected
          }
          show(tx, ty);
        }
      } else {
        hide();
      }
    });

    EventBus.on('drawing:deleted', data => {
      if (_drawing && data && data.id === _drawing.id) hide();
    });
  }

  return { init, show, hide };
})();

// Auto-init
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => window.PropertyToolbar.init());
} else {
  window.PropertyToolbar.init();
}
