/**
 * DSD Color Picker
 * Renk paleti ve çizgi ayarları için ortak UI bileşenleri.
 * Kullanım: window.DSDColorPicker.showColorPalette(...)
 */
window.DSDColorPicker = (() => {

  const TV_PALETTE = [
    ['#ffffff','#e1e3e6','#c1c4cd','#a3a6af','#787b86','#5d606b','#434651','#2a2e39','#1e222d','#131722','#000000'],
    ['#f23645','#ff9800','#ffeb3b','#4caf50','#089981','#00bcd4','#2962ff','#311b92','#9c27b0','#e91e63','#f8bbd0'],
    ['#fcccd0','#ffe0b2','#fff9c4','#c8e6c9','#b2dfdb','#b2ebf2','#bbdefb','#d1c4e9','#e1bee7','#f48fb1','#fce4ec'],
    ['#ef5350','#ffa726','#ffee58','#66bb6a','#26a69a','#26c6da','#42a5f5','#7e57c2','#ab47bc','#ec407a','#f06292'],
    ['#e53935','#f57c00','#fbc02d','#43a047','#00897b','#00acc1','#1e88e5','#5e35b1','#8e24aa','#d81b60','#e91e63'],
    ['#b71c1c','#e65100','#f57f17','#1b5e20','#004d40','#006064','#0d47a1','#311b92','#4a148c','#880e4f','#ad1457'],
  ];
  const NEON = ['#39ff14','#ccff00','#df00ff','#00ffff','#ff0000','#5c4033','#00e5ff','#ffaa00'];

  // ── Ortak yardımcı fonksiyonlar ───────────────────
  function hexToRgb(h) {
    let c = h.slice(1);
    if (c.length === 3) c = c[0]+c[0]+c[1]+c[1]+c[2]+c[2];
    return { r: parseInt(c.slice(0,2),16), g: parseInt(c.slice(2,4),16), b: parseInt(c.slice(4,6),16) };
  }

  function parseC(c) {
    if (!c) return { hex: '#2962ff', op: 100 };
    if (c.startsWith('#')) return { hex: c, op: 100 };
    const m = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if (m) return {
      hex: '#' + [+m[1],+m[2],+m[3]].map(x => x.toString(16).padStart(2,'0')).join(''),
      op: m[4] != null ? Math.round(parseFloat(m[4]) * 100) : 100
    };
    return { hex: '#2962ff', op: 100 };
  }

  function buildC(hex, op) {
    if (op >= 100) return hex;
    const { r, g, b } = hexToRgb(hex);
    return `rgba(${r},${g},${b},${(op/100).toFixed(2)})`;
  }

  // ── 1. Sadece Renk Paleti ─────────────────────────
  function showColorPalette(anchorEl, currentColor, onSelect) {
    const existing = document.getElementById('dsd-color-pal');
    if (existing) {
      existing.remove();
      if (existing._anchorEl === anchorEl) return;
    }
    document.getElementById('dsd-line-pop')?.remove();

    const { hex: baseHex, op: baseOp } = parseC(currentColor);
    const { r: cr, g: cg, b: cb } = hexToRgb(baseHex);
    let activeHex = baseHex, activeOp = baseOp;

    const pop = document.createElement('div');
    pop.id = 'dsd-color-pal';
    pop._anchorEl = anchorEl;
    pop.style.cssText = `position:fixed;z-index:99999;background:#1e222d;border:1px solid #363c4e;border-radius:6px;padding:10px;box-shadow:0 6px 20px rgba(0,0,0,0.5);width:242px;`;

    const mainRows = TV_PALETTE.map(row =>
      `<div style="display:flex;gap:2px;margin-bottom:2px;">${
        row.map(c => `<div class="dsd-pc" data-c="${c}" style="background:${c};width:18px;height:18px;border-radius:2px;cursor:pointer;box-sizing:border-box;border:1px solid rgba(255,255,255,0.1);${c.toLowerCase()===baseHex.toLowerCase()?'outline:2px solid #fff;outline-offset:1px;':''}"></div>`).join('')
      }</div>`
    ).join('');

    const neonRow = NEON.map(c =>
      `<div class="dsd-pc" data-c="${c}" style="background:${c};width:18px;height:18px;border-radius:2px;cursor:pointer;box-sizing:border-box;border:1px solid rgba(255,255,255,0.1);"></div>`
    ).join('');

    pop.innerHTML = `
      <div>${mainRows}</div>
      <div style="height:1px;background:#2a2e39;margin:6px -10px;"></div>
      <div style="display:flex;align-items:center;gap:2px;flex-wrap:wrap;">${neonRow}
        <div id="dsd-pc-add" style="width:18px;height:18px;border-radius:2px;cursor:pointer;border:1px solid #363c4e;display:flex;align-items:center;justify-content:center;color:#787b86;">
          <svg viewBox="0 0 10 10" width="10" height="10" stroke="currentColor"><path d="M5 1v8M1 5h8" stroke-width="1.5"/></svg>
        </div>
      </div>
      <div style="height:1px;background:#2a2e39;margin:6px -10px;"></div>
      <div style="margin-top:4px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;">
          <span style="font-size:11px;color:#787b86;">Opacity</span>
          <span id="dsd-pc-opval" style="font-size:11px;color:#d1d4dc;background:#131722;border:1px solid #363c4e;padding:2px 6px;border-radius:3px;min-width:38px;text-align:center;">${baseOp}%</span>
        </div>
        <div style="position:relative;height:12px;border-radius:6px;overflow:hidden;background:repeating-conic-gradient(#363c4e 0% 25%,#2a2e39 0% 50%) 50%/10px 10px;cursor:pointer;" id="dsd-pc-track">
          <div style="position:absolute;inset:0;background:linear-gradient(to right,rgba(${cr},${cg},${cb},0),rgba(${cr},${cg},${cb},1));pointer-events:none;"></div>
          <div id="dsd-pc-thumb" style="position:absolute;top:50%;width:14px;height:14px;border-radius:50%;background:#fff;border:2px solid #d1d4dc;box-shadow:0 1px 4px rgba(0,0,0,0.5);transform:translate(-50%,-50%);pointer-events:none;left:${baseOp}%;"></div>
        </div>
      </div>
    `;

    document.body.appendChild(pop);

    // Pozisyon
    requestAnimationFrame(() => {
      const rect = anchorEl.getBoundingClientRect();
      const popH = pop.offsetHeight, popW = pop.offsetWidth;
      const spaceBelow = window.innerHeight - rect.bottom - 8;
      const spaceAbove = rect.top - 8;
      pop.style.top = spaceBelow >= popH
        ? (rect.bottom + 4) + 'px'
        : spaceAbove >= popH
          ? (rect.top - popH - 4) + 'px'
          : (spaceBelow >= spaceAbove ? (rect.bottom + 4) : Math.max(8, rect.top - popH - 4)) + 'px';
      let left = rect.left;
      if (left + popW > window.innerWidth) left = window.innerWidth - popW - 8;
      pop.style.left = Math.max(8, left) + 'px';
    });

    const emit = () => onSelect(buildC(activeHex, activeOp));

    pop.addEventListener('click', e => {
      const cell = e.target.closest('.dsd-pc');
      if (cell) { 
        activeHex = cell.dataset.c; 
        emit(); 
        pop.querySelectorAll('.dsd-pc').forEach(c => c.style.outline = 'none');
        cell.style.outline = '2px solid #fff';
        cell.style.outlineOffset = '1px';
        return; 
      }
      if (e.target.closest('#dsd-pc-add')) {
        showAdvancedColorPicker(anchorEl, newHex => { activeHex = newHex; emit(); pop.remove(); });
      }
    });

    const track = pop.querySelector('#dsd-pc-track');
    const thumb = pop.querySelector('#dsd-pc-thumb');
    const valEl = pop.querySelector('#dsd-pc-opval');
    let dragging = false;
    const updateOp = ev => {
      const r2 = track.getBoundingClientRect();
      activeOp = Math.round(Math.max(0, Math.min(100, ((ev.clientX - r2.left) / r2.width) * 100)));
      thumb.style.left = activeOp + '%';
      valEl.textContent = activeOp + '%';
      emit();
    };
    track.addEventListener('mousedown', ev => { dragging = true; updateOp(ev); });
    const gMove = ev => { if (dragging) updateOp(ev); };
    const gUp   = () => { dragging = false; };
    window.addEventListener('mousemove', gMove);
    window.addEventListener('mouseup', gUp);

    const outsideHandler = ev => {
      if (!pop.contains(ev.target) && !anchorEl.contains(ev.target)) {
        pop.remove();
        window.removeEventListener('mousemove', gMove);
        window.removeEventListener('mouseup', gUp);
        document.removeEventListener('mousedown', outsideHandler);
      }
    };
    setTimeout(() => document.addEventListener('mousedown', outsideHandler), 0);
  }

  // ── 2. Renk + Kalınlık + Stil ────────────────────
  function showCombinedLineSettings(anchorEl, currentColor, curW, curS, hasColor, onApply) {
    const existing = document.getElementById('dsd-combined-pop');
    if (existing) {
      existing.remove();
      if (existing._anchorEl === anchorEl) return;
    }

    const widths = [1, 2, 3, 4];
    const styles = [
      { key: 'solid',  label: 'Solid',  dash: '' },
      { key: 'dashed', label: 'Dashed', dash: 'stroke-dasharray="8,5"' },
      { key: 'dotted', label: 'Dotted', dash: 'stroke-dasharray="3,3"' },
    ];

    let { hex: activeHex, op: activeOp } = parseC(currentColor);
    let selW = curW, selS = curS;

    const pop = document.createElement('div');
    pop.id = 'dsd-combined-pop';
    pop._anchorEl = anchorEl;
    pop.style.cssText = `position:fixed;z-index:99999;background:#1e222d;border:1px solid #363c4e;border-radius:6px;padding:8px;box-shadow:0 6px 24px rgba(0,0,0,0.6);width:196px;`;

    const emit = () => onApply({ color: buildC(activeHex, activeOp), width: selW, style: selS });

    const renderPop = () => {
      let html = '';

      if (hasColor) {
        html += `<div style="display:flex;flex-direction:column;gap:2px;margin-bottom:8px;">`;
        TV_PALETTE.forEach(row => {
          html += `<div style="display:flex;gap:2px;">`;
          row.forEach(c => {
            const isActive = c.toLowerCase() === activeHex.toLowerCase();
            html += `<div class="dsd-cmb-c" data-c="${c}" style="background:${c};width:16px;height:16px;border-radius:2px;cursor:pointer;box-sizing:border-box;border:1px solid rgba(255,255,255,0.1);${isActive?'outline:2px solid #fff;outline-offset:1px;':''}"></div>`;
          });
          html += `</div>`;
        });
        html += `</div>`;

        const { r: cr, g: cg, b: cb } = hexToRgb(activeHex);
        html += `
        <div style="margin-bottom:12px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;">
            <span style="font-size:11px;color:#787b86;">Opacity</span>
            <span id="dsd-cmb-opval" style="font-size:11px;color:#d1d4dc;background:#131722;border:1px solid #363c4e;padding:2px 6px;border-radius:3px;">${activeOp}%</span>
          </div>
          <div style="position:relative;height:12px;border-radius:6px;overflow:hidden;background:repeating-conic-gradient(#363c4e 0% 25%,#2a2e39 0% 50%) 50%/10px 10px;cursor:pointer;" id="dsd-cmb-track">
            <div style="position:absolute;inset:0;background:linear-gradient(to right,rgba(${cr},${cg},${cb},0),rgba(${cr},${cg},${cb},1));pointer-events:none;"></div>
            <div id="dsd-cmb-thumb" style="position:absolute;top:50%;width:14px;height:14px;border-radius:50%;background:#fff;border:2px solid #d1d4dc;transform:translate(-50%,-50%);pointer-events:none;left:${activeOp}%;"></div>
          </div>
        </div>
        <div style="height:1px;background:#2a2e39;margin:8px -8px;"></div>`;
      }

      html += `<div style="padding:2px 0 6px;font-size:11px;color:#5d606b;letter-spacing:0.5px;text-transform:uppercase;">Thickness</div>
               <div style="display:flex;gap:2px;margin-bottom:8px;">`;
      widths.forEach(w => {
        html += `<div class="dsd-cmb-w" data-w="${w}" style="flex:1;height:24px;display:flex;align-items:center;justify-content:center;cursor:pointer;background:${w===selW?'#2a2e39':'#131722'};border:1px solid ${w===selW?'#2962ff':'#363c4e'};border-radius:3px;">
                   <svg width="24" height="${w+1}"><line x1="0" y1="${(w+1)/2}" x2="24" y2="${(w+1)/2}" stroke="#d1d4dc" stroke-width="${w}"/></svg>
                 </div>`;
      });
      html += `</div>`;

      html += `<div style="padding:2px 0 6px;font-size:11px;color:#5d606b;letter-spacing:0.5px;text-transform:uppercase;">Style</div>
               <div style="display:flex;gap:2px;">`;
      styles.forEach(st => {
        html += `<div class="dsd-cmb-s" data-s="${st.key}" style="flex:1;height:24px;display:flex;align-items:center;justify-content:center;cursor:pointer;background:${st.key===selS?'#2a2e39':'#131722'};border:1px solid ${st.key===selS?'#2962ff':'#363c4e'};border-radius:3px;" title="${st.label}">
                   <svg width="24" height="2"><line x1="0" y1="1" x2="24" y2="1" stroke="#d1d4dc" stroke-width="2" ${st.dash}/></svg>
                 </div>`;
      });
      html += `</div>`;

      pop.innerHTML = html;

      pop.querySelectorAll('.dsd-cmb-c').forEach(el => el.onclick = () => { activeHex = el.dataset.c; emit(); renderPop(); });
      pop.querySelectorAll('.dsd-cmb-w').forEach(el => el.onclick = () => { selW = parseInt(el.dataset.w); emit(); renderPop(); });
      pop.querySelectorAll('.dsd-cmb-s').forEach(el => el.onclick = () => { selS = el.dataset.s; emit(); renderPop(); });

      const track = pop.querySelector('#dsd-cmb-track');
      if (track) {
        let dragging = false;
        const thumb = pop.querySelector('#dsd-cmb-thumb');
        const valEl = pop.querySelector('#dsd-cmb-opval');
        const updateOp = ev => {
          const r2 = track.getBoundingClientRect();
          activeOp = Math.round(Math.max(0, Math.min(100, ((ev.clientX - r2.left) / r2.width) * 100)));
          thumb.style.left = activeOp + '%';
          valEl.textContent = activeOp + '%';
          emit();
        };
        track.onmousedown = ev => { dragging = true; updateOp(ev); };
        const gMove = ev => { if (dragging) updateOp(ev); };
        const gUp   = () => { dragging = false; };
        window.addEventListener('mousemove', gMove);
        window.addEventListener('mouseup', gUp);
        pop._gMove = gMove;
        pop._gUp   = gUp;
      }
    };

    renderPop();
    document.body.appendChild(pop);

    requestAnimationFrame(() => {
      const rect = anchorEl.getBoundingClientRect();
      const popH = pop.offsetHeight, popW = pop.offsetWidth;
      const spaceBelow = window.innerHeight - rect.bottom - 8;
      pop.style.top = spaceBelow >= popH
        ? (rect.bottom + 4) + 'px'
        : Math.max(8, rect.top - popH - 4) + 'px';
      let left = rect.left;
      if (left + popW > window.innerWidth) left = window.innerWidth - popW - 8;
      pop.style.left = Math.max(8, left) + 'px';
    });

    const outsideHandler = ev => {
      if (!pop.contains(ev.target) && !anchorEl.contains(ev.target)) {
        if (pop._gMove) window.removeEventListener('mousemove', pop._gMove);
        if (pop._gUp)   window.removeEventListener('mouseup',   pop._gUp);
        pop.remove();
        document.removeEventListener('mousedown', outsideHandler);
      }
    };
    setTimeout(() => document.addEventListener('mousedown', outsideHandler), 0);
  }

  // ── 3. Sadece Kalınlık + Stil ─────────────────────
  function showLineSettingsPopover(anchorEl, drawing, overlay,
      propW = 'width', propS = 'lineStyle', propD = 'dash', previewSel = '#dsd-line-preview') {
    const existing = document.getElementById('dsd-line-pop');
    if (existing) {
      const isSame = existing._anchorEl === anchorEl;
      existing.remove();
      if (isSame) return;
    }

    const s = drawing.style || {};
    let selW = s[propW] || 1;
    let selS = s[propS] || 'solid';

    const widths = [1, 2, 3, 4];
    const styles = [
      { key: 'solid',  label: 'Solid',  dash: '' },
      { key: 'dashed', label: 'Dashed', dash: 'stroke-dasharray="8,5"' },
      { key: 'dotted', label: 'Dotted', dash: 'stroke-dasharray="3,3"' },
    ];

    const pop = document.createElement('div');
    pop.id = 'dsd-line-pop';
    pop._anchorEl = anchorEl;
    pop.style.cssText = `position:fixed;z-index:99999;background:#1e222d;border:1px solid #363c4e;border-radius:6px;padding:8px 0;box-shadow:0 6px 24px rgba(0,0,0,0.6);min-width:160px;`;

    const renderPop = () => {
      pop.innerHTML = `
        <div style="padding:2px 12px 6px;font-size:11px;color:#5d606b;letter-spacing:0.5px;text-transform:uppercase;">Thickness</div>
        ${widths.map(w => `
          <div class="dsd-lp-w" data-w="${w}" style="display:flex;align-items:center;gap:10px;padding:6px 14px;cursor:pointer;background:${w===selW?'#2a2e39':'transparent'};color:${w===selW?'#f0b90b':'#d1d4dc'};font-size:13px;">
            <svg width="34" height="${Math.max(2,w+1)}" viewBox="0 0 34 ${Math.max(2,w+1)}" style="flex-shrink:0;">
              <line x1="0" y1="${Math.max(2,w+1)/2}" x2="34" y2="${Math.max(2,w+1)/2}" stroke="${w===selW?'#f0b90b':'#d1d4dc'}" stroke-width="${w}"/>
            </svg>
            <span>${w}px</span>
          </div>`).join('')}
        <div style="height:1px;background:#2a2e39;margin:6px 0;"></div>
        <div style="padding:2px 12px 6px;font-size:11px;color:#5d606b;letter-spacing:0.5px;text-transform:uppercase;">Style</div>
        ${styles.map(st => `
          <div class="dsd-lp-s" data-s="${st.key}" style="display:flex;align-items:center;gap:10px;padding:6px 14px;cursor:pointer;background:${st.key===selS?'#2a2e39':'transparent'};color:${st.key===selS?'#f0b90b':'#d1d4dc'};font-size:13px;">
            <svg width="34" height="2" viewBox="0 0 34 2" style="flex-shrink:0;">
              <line x1="0" y1="1" x2="34" y2="1" stroke="${st.key===selS?'#f0b90b':'#d1d4dc'}" stroke-width="2" ${st.dash}/>
            </svg>
            <span>${st.label}</span>
          </div>`).join('')}
      `;

      pop.querySelectorAll('.dsd-lp-w').forEach(item => {
        item.addEventListener('click', () => {
          selW = parseInt(item.dataset.w);
          drawing.style = drawing.style || {};
          drawing.style[propW] = selW;
          const prevPath = overlay?.querySelector(`${previewSel} path`);
          if (prevPath) prevPath.setAttribute('stroke-width', selW);
          const span = overlay?.querySelector(`${previewSel} span`);
          if (span) span.textContent = selW + 'px';
          if (propW === 'width') updateComboPreview(overlay, drawing);
          EventBus.emit('drawing:settings:saved');
          renderPop();
        });
      });

      pop.querySelectorAll('.dsd-lp-s').forEach(item => {
        item.addEventListener('click', () => {
          selS = item.dataset.s;
          drawing.style = drawing.style || {};
          drawing.style[propS] = selS;
          drawing.style[propD] = selS === 'dashed' ? [8,5] : selS === 'dotted' ? [3,3] : [];
          const prevPath = overlay?.querySelector(`${previewSel} path`);
          if (prevPath) prevPath.setAttribute('stroke-dasharray', selS==='dashed'?'8,5':selS==='dotted'?'3,3':'');
          if (propS === 'lineStyle') updateComboPreview(overlay, drawing);
          EventBus.emit('drawing:settings:saved');
          renderPop();
        });
      });
    };

    renderPop();
    document.body.appendChild(pop);

    const rect = anchorEl.getBoundingClientRect();
    pop.style.top  = (rect.bottom + 4) + 'px';
    pop.style.left = rect.left + 'px';
    requestAnimationFrame(() => {
      if (parseFloat(pop.style.left) + pop.offsetWidth > window.innerWidth)
        pop.style.left = (window.innerWidth - pop.offsetWidth - 8) + 'px';
    });

    const outsideHandler = ev => {
      if (!pop.contains(ev.target) && !anchorEl.contains(ev.target)) {
        pop.remove();
        document.removeEventListener('mousedown', outsideHandler);
      }
    };
    setTimeout(() => document.addEventListener('mousedown', outsideHandler), 0);
  }

  // ── 4. Combo Önizleme Güncelle ────────────────────
  function updateComboPreview(overlay, drawing) {
    const preview = overlay.querySelector('#dsd-line-preview');
    if (!preview) return;
    const s = drawing.style || {};
    const color = s.color || '#58a6ff';
    const width = s.width || 1;
    const ls    = s.lineStyle || 'solid';
    const dashAttr = ls === 'dashed' ? 'stroke-dasharray="8,5"' : ls === 'dotted' ? 'stroke-dasharray="3,3"' : '';
    preview.innerHTML = `
      <svg width="28" height="16" viewBox="0 0 28 16">
        <path stroke="${color}" stroke-width="${width}" ${dashAttr} d="M0 8h28"/>
      </svg>
      <span style="font-size:11px;color:#787b86;margin-left:4px;">${width}px</span>
    `;
  }

  // ── 5. Gelişmiş Renk Seçici (HSV) ────────────────
  function showAdvancedColorPicker(anchorEl, onColor) {
    document.getElementById('dsd-adv-picker')?.remove();
    const pEl = document.createElement('div');
    pEl.id = 'dsd-adv-picker';
    pEl.style.cssText = `position:absolute;z-index:99999;background:#1e222d;border:1px solid #434651;border-radius:6px;padding:12px;box-shadow:0 4px 12px rgba(0,0,0,0.5);`;

    const rect = anchorEl.getBoundingClientRect();
    pEl.style.left = rect.left + 'px';
    pEl.style.top  = (rect.bottom + 4) + 'px';

    let baseHex = anchorEl.dataset.color || '#58a6ff';
    if (!baseHex.startsWith('#')) baseHex = '#ffffff';

    const rgbToHsv = (r, g, b) => {
      r /= 255; g /= 255; b /= 255;
      const v = Math.max(r,g,b), n = v - Math.min(r,g,b);
      const h = n === 0 ? 0 : n && v === r ? (g-b)/n : v === g ? 2+(b-r)/n : 4+(r-g)/n;
      return { h: 60*(h<0?h+6:h)/360, s: v&&n/v, v };
    };
    const hsvToRgb = (h, s, v) => {
      const f = (n, k=(n+h*360/60)%6) => v - v*s*Math.max(Math.min(k,4-k,1),0);
      return { r: Math.round(f(5)*255), g: Math.round(f(3)*255), b: Math.round(f(1)*255) };
    };
    const colorToRgb = hex => {
      let c = hex.substring(1);
      if (c.length === 3) c = c[0]+c[0]+c[1]+c[1]+c[2]+c[2];
      return { r: parseInt(c.slice(0,2),16), g: parseInt(c.slice(2,4),16), b: parseInt(c.slice(4,6),16) };
    };
    const rgbToHex = (r,g,b) => '#' + [r,g,b].map(x=>x.toString(16).padStart(2,'0')).join('');
    const getHex = (h,s,v) => { const c = hsvToRgb(h,s,v); return rgbToHex(c.r,c.g,c.b); };
    const getHue = h => { const c = hsvToRgb(h,1,1); return rgbToHex(c.r,c.g,c.b); };

    const rgb = colorToRgb(baseHex);
    const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
    let aH = hsv.h, aS = hsv.s, aV = hsv.v;

    pEl.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
        <div id="adv-preview" style="width:24px;height:24px;background:${baseHex};border:1px solid #363c4e;border-radius:4px;"></div>
        <input id="adv-hex" type="text" value="${baseHex.toUpperCase()}" style="width:70px;background:#131722;border:1px solid #2962ff;color:#d1d4dc;padding:4px;border-radius:4px;font-family:'JetBrains Mono',monospace;outline:none;font-size:12px;">
      </div>
      <div style="display:flex;gap:12px;">
        <div id="adv-sv" style="position:relative;width:150px;height:150px;background:${getHue(aH)};cursor:crosshair;border-radius:4px;overflow:hidden;">
          <div style="position:absolute;inset:0;background:linear-gradient(to right,#fff,rgba(255,255,255,0));pointer-events:none;"></div>
          <div style="position:absolute;inset:0;background:linear-gradient(to top,#000,rgba(0,0,0,0));pointer-events:none;"></div>
          <div id="adv-sv-thumb" style="position:absolute;width:10px;height:10px;border:2px solid #fff;border-radius:50%;box-shadow:0 0 2px #000;top:${(1-aV)*150}px;left:${aS*150}px;transform:translate(-50%,-50%);pointer-events:none;"></div>
        </div>
        <div id="adv-hue" style="position:relative;width:16px;height:150px;cursor:pointer;border-radius:4px;overflow:hidden;background:linear-gradient(to bottom,#f00 0%,#ff0 17%,#0f0 33%,#0ff 50%,#00f 67%,#f0f 83%,#f00 100%);">
          <div id="adv-hue-thumb" style="position:absolute;width:100%;height:4px;border:1px solid #000;background:#fff;top:${aH*150}px;left:0;transform:translateY(-50%);pointer-events:none;"></div>
        </div>
      </div>
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px;border-top:1px solid #363c4e;padding-top:12px;">
        <button id="adv-cancel" style="background:transparent;border:1px solid #363c4e;color:#d1d4dc;padding:6px 16px;border-radius:4px;cursor:pointer;">Cancel</button>
        <button id="adv-ok" style="background:#2962ff;color:#fff;border:none;padding:6px 16px;border-radius:4px;cursor:pointer;font-weight:500;">Ok</button>
      </div>
    `;

    document.body.appendChild(pEl);

    const pv = pEl.querySelector('#adv-preview');
    const hx = pEl.querySelector('#adv-hex');
    const sv = pEl.querySelector('#adv-sv');
    const svT = pEl.querySelector('#adv-sv-thumb');
    const hue = pEl.querySelector('#adv-hue');
    const hueT = pEl.querySelector('#adv-hue-thumb');

    const upd = () => {
      const h = getHex(aH,aS,aV);
      sv.style.background = getHue(aH);
      pv.style.background = h;
      hx.value = h.toUpperCase();
      svT.style.left = (aS*150)+'px'; svT.style.top = ((1-aV)*150)+'px';
      hueT.style.top = (aH*150)+'px';
    };

    let dragSV = false, dragH = false;
    sv.addEventListener('mousedown', e => { dragSV = true; const r=sv.getBoundingClientRect(); aS=Math.max(0,Math.min(150,e.clientX-r.left))/150; aV=1-Math.max(0,Math.min(150,e.clientY-r.top))/150; upd(); });
    hue.addEventListener('mousedown', e => { dragH = true; const r=hue.getBoundingClientRect(); aH=Math.max(0,Math.min(150,e.clientY-r.top))/150; upd(); });
    const gMove = e => {
      if (dragSV) { const r=sv.getBoundingClientRect(); aS=Math.max(0,Math.min(150,e.clientX-r.left))/150; aV=1-Math.max(0,Math.min(150,e.clientY-r.top))/150; upd(); }
      if (dragH)  { const r=hue.getBoundingClientRect(); aH=Math.max(0,Math.min(150,e.clientY-r.top))/150; upd(); }
    };
    const gUp = () => { dragSV = false; dragH = false; };
    window.addEventListener('mousemove', gMove);
    window.addEventListener('mouseup', gUp);

    hx.addEventListener('input', e => {
      if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) {
        const c = colorToRgb(e.target.value);
        const h = rgbToHsv(c.r,c.g,c.b);
        aH=h.h; aS=h.s; aV=h.v; upd();
      }
    });

    const cleanup = () => { window.removeEventListener('mousemove',gMove); window.removeEventListener('mouseup',gUp); pEl.remove(); };
    pEl.querySelector('#adv-cancel').addEventListener('click', cleanup);
    pEl.querySelector('#adv-ok').addEventListener('click', () => { onColor(getHex(aH,aS,aV)); cleanup(); });
  }

  return {
    showColorPalette,
    showCombinedLineSettings,
    showLineSettingsPopover,
    updateComboPreview,
    showAdvancedColorPicker,
  };

})();
