/* ──────────────────────────────────────────────────────────
   drawing-annotations.js — Text & Annotation Tools
   Contains rendering and logic for:
   - Text Tool, Note, Callout, Price Note, Price Label, Flag Mark, Table Annotation, Inline Text Editor
────────────────────────────────────────────────────────── */

window.DrawingAnnotations = (() => {

  function _pt2xy(pt, pane) {
    if (window.DrawingManager && window.DrawingManager.utils) {
      return window.DrawingManager.utils.pt2xy(pt, pane);
    }
    return null;
  }

  function requestRedrawAll() {
    if (window.DrawingManager) window.DrawingManager.requestRedrawAll();
  }

  function clearSelection() {
    if (window.DrawingManager && window.DrawingManager.utils) {
      window.DrawingManager.utils.clearSelection();
    }
  }

  function _openInlineTextEditor(d, pane, clickPt = null, cellStr = null) {
    // If an editor is already open for a DIFFERENT drawing, close it first
    const existing = document.getElementById('inline-text-editor');
    if (existing) {
      // Trigger save on the old editor before replacing
      existing.dispatchEvent(new Event('blur'));
      existing.remove();
    }
    const a = _pt2xy(d.p1, pane);
    if (!a) return;
    
    let targetPt = a;
    let initialText = d.text && d.text !== 'Text' ? d.text : '';
    let cellR = -1, cellC = -1;

    if (['note', 'callout', 'pricenote'].includes(d.tool) && d.p2) {
      targetPt = _pt2xy(d.p2, pane) || a;
    } else if (d.tool === 'tableanno' && cellStr) {
      const match = cellStr.match(/^table_cell_(\d+)_(\d+)$/);
      if (match) {
        cellR = parseInt(match[1]);
        cellC = parseInt(match[2]);
        const cellW = 64, cellH = 22;
        targetPt = { x: a.x + cellC * cellW, y: a.y + cellR * cellH };
        const data = (d.text || '').split('\n').map(r => r.split('\t'));
        initialText = (data[cellR] && data[cellR][cellC]) || '';
      }
    }

    // Use canvas bounding rect to convert canvas coords → viewport coords
    const canvasRect = (pane.canvasContainer || pane.drawingCanvas || pane.cvs).getBoundingClientRect();
    const viewX = canvasRect.left + targetPt.x;
    const viewY = canvasRect.top  + targetPt.y;

    const fontSize = d.style?.fontSize || 16;
    const showBg = d.style?.showBg !== false;
    const showBorder = d.style?.showBorder !== false;
    const bgColor = (showBg && d.style?.fillColor && d.style.fillColor !== 'transparent' && d.style.fillColor !== 'rgba(0,0,0,0)')
      ? d.style.fillColor : '#131722';
    const borderColor = (showBorder && d.style?.borderColor) ? d.style.borderColor : '#2962ff';

    const ta = document.createElement('textarea');
    ta.id = 'inline-text-editor';
    ta.value = initialText;
    ta.placeholder = 'Type text…';

    const paddingX = 6, paddingY = 4;
    const boxW = (d.style?.textWidth != null ? d.style.textWidth : 200) + paddingX * 2;

    Object.assign(ta.style, {
      position:    'fixed',
      left:        viewX + 'px',
      top:         viewY + 'px',
      zIndex:      '99999',
      background:  bgColor,
      color:       d.style?.textColor || '#d1d4dc',
      fontSize:    fontSize + 'px',
      fontFamily:  'Inter, -apple-system, sans-serif',
      fontWeight:  d.style?.bold   ? 'bold'   : 'normal',
      fontStyle:   d.style?.italic ? 'italic' : 'normal',
      border:      `1px solid ${borderColor}`,
      outline:     'none',
      padding:     `${paddingY}px ${paddingX}px`,
      borderRadius:'3px',
      width:       boxW + 'px',
      minHeight:   (fontSize * 1.2 + paddingY * 2) + 'px',
      lineHeight:  '1.2',
      resize:      'none',
      overflow:    'hidden',
      whiteSpace:  'pre-wrap', // matches wrap logic
      wordWrap:    'break-word',
      boxSizing:   'border-box',
      boxShadow:   '0 0 0 1px rgba(41,98,255,0.2)', // subtle hint it's active
    });

    // Hide original drawing while editing
    d._isEditing = true;
    requestRedrawAll();

    // Auto-resize as user types
    const resizeTa = () => {
      ta.style.height = 'auto';
      ta.style.height = (ta.scrollHeight) + 'px';
    };
    ta.addEventListener('input', resizeTa);

    
    // Prevent ALL mouse events from bubbling to canvas
    ta.addEventListener('mousedown',   e => e.stopPropagation());
    ta.addEventListener('pointerdown', e => e.stopPropagation());
    ta.addEventListener('pointerup',   e => e.stopPropagation());
    ta.addEventListener('click',       e => e.stopPropagation());

    document.body.appendChild(ta);

    const doFocus = () => {
      const el = document.getElementById('inline-text-editor');
      if (!el) return;
      el.focus({ preventScroll: true });
      resizeTa();
      // Caret position
      if (clickPt) {
        const font = `${d.style?.bold ? 'bold ' : ''}${d.style?.italic ? 'italic ' : ''}${fontSize}px Inter, -apple-system, sans-serif`;
        const c2 = document.createElement('canvas').getContext('2d');
        c2.font = font;
        const paddingX = 6;
        const lh = fontSize * 1.4;
        const lineIndex = Math.max(0, Math.floor((clickPt.y - a.y - 4) / lh));
        const lines = el.value.split('\n');
        const line = lines[Math.min(lineIndex, lines.length - 1)] || '';
        const relX = clickPt.x - a.x - paddingX;
        let charOffset = line.length;
        for (let i = 0; i <= line.length; i++) {
          if (c2.measureText(line.substring(0, i)).width >= relX) {
            const wPrev = i > 0 ? c2.measureText(line.substring(0, i - 1)).width : 0;
            charOffset = (relX - wPrev < c2.measureText(line.substring(0, i)).width - relX) ? Math.max(0, i - 1) : i;
            break;
          }
        }
        let absIdx = 0;
        for (let l = 0; l < lineIndex && l < lines.length; l++) absIdx += lines[l].length + 1;
        el.selectionStart = el.selectionEnd = absIdx + charOffset;
      } else {
        el.selectionStart = el.selectionEnd = el.value.length;
      }
    };

    // Focus hemen, rAF'ta, ve pointerup sonrası — LWC'nin focus çalmasını engeller
    doFocus();
    requestAnimationFrame(doFocus);
    window.addEventListener('pointerup', () => {
      setTimeout(doFocus, 50);
    }, { capture: true, once: true });

    let isSaving = false;
    const saveAndClose = () => {
      if (isSaving) return;
      isSaving = true;
      const val = ta.value.trim();
      
      if (d.tool === 'tableanno' && cellR >= 0 && cellC >= 0) {
        // Update specific cell
        let data = (d.text || '').split('\n').map(r => r.split('\t'));
        const rows = d.style?.rows || 2;
        const cols = d.style?.cols || 3;
        // Expand matrix if necessary
        while (data.length < rows) data.push(Array(cols).fill(''));
        for (let r = 0; r < rows; r++) {
          while (data[r].length < cols) data[r].push('');
        }
        data[cellR][cellC] = val;
        d.text = data.map(r => r.join('\t')).join('\n');
        State.save();
      } else {
        if (!val) {
          // If text was cleared for normal tools, remove drawing
          State.removeDrawing(pane.symbol, d.id);
        } else {
          d.text = val;
          State.save();
        }
      }

      ta.remove();
      d._isEditing = false;
      // Deselect after closing editor
      clearSelection();
    };

    // Attach blur AFTER current event loop so it doesn't fire immediately
    setTimeout(() => {
      ta.addEventListener('blur', saveAndClose);
    }, 200);

    ta.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        isSaving = true; // skip blur save
        ta.remove();
        clearSelection();
      }
      if (e.key === 'Enter' && e.ctrlKey) {
        saveAndClose();
      }
    });
  }

  // ── NOTE ─────────────────────────────────────────────────────────────────
  function _drawNote(ctx, d, pane, isHovered, isSelected) {
    if (d._isEditing) return;
    const a = _pt2xy(d.p1, pane);
    const b = d.p2 ? _pt2xy(d.p2, pane) : a;
    if (!a || !b) return;
    const text = d.text || 'Note';
    const fontSize = d.style?.fontSize || 13;
    const bold   = d.style?.bold   ? 'bold '   : '';
    const italic = d.style?.italic ? 'italic ' : '';
    ctx.font = `${italic}${bold}${fontSize}px Inter, -apple-system, sans-serif`;
    const lines = text.split('\n');
    let maxW = 0;
    for (const l of lines) maxW = Math.max(maxW, ctx.measureText(l).width);
    const lh = fontSize * 1.25;
    const padX = 8, padY = 3;
    const bw = Math.max(maxW + padX * 2, 30);
    const bh = (lines.length - 1) * lh + fontSize + padY * 2;
    const bx = b.x - bw / 2;
    const by = b.y - bh / 2;

    // Intersection: line stops at box edge
    function getIntersect(cx, cy, hw, hh, tx, ty) {
      const dx = tx - cx, dy = ty - cy;
      if (dx === 0 && dy === 0) return { x: cx, y: cy };
      return Math.abs(dx) / hw > Math.abs(dy) / hh
        ? { x: cx + (dx > 0 ? hw : -hw), y: cy + dy * (hw / Math.abs(dx)) }
        : { x: cx + dx * (hh / Math.abs(dy)), y: cy + (dy > 0 ? hh : -hh) };
    }
    const intersect = getIntersect(b.x, b.y, bw/2 + 1, bh/2 + 1, a.x, a.y);

    // Line from anchor to box edge
    const lineColor = d.style?.color || '#787b86';
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = d.style?.width || 1;
    let lineDash = [];
    if (d.style?.lineStyle === 'dashed') lineDash = [8, 5];
    else if (d.style?.lineStyle === 'dotted') lineDash = [3, 3];
    ctx.setLineDash(lineDash);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(intersect.x, intersect.y); ctx.stroke();

    // Background box
    const showFill = d.style?.showFill !== false;
    ctx.fillStyle = showFill ? (d.style?.fillColor || '#1e222d') : 'rgba(0,0,0,0)';
    _roundRect(ctx, bx, by, bw, bh, 4); ctx.fill();

    // Border
    const showBorder = d.style?.showBorder === true;
    ctx.strokeStyle = (isSelected || isHovered) ? '#2962ff'
      : showBorder ? (d.style?.borderColor || '#363c4e') : 'rgba(0,0,0,0)';
    ctx.lineWidth = d.style?.borderWidth || 1;
    let borderDash = [];
    if (d.style?.borderStyle === 'dashed') borderDash = [8, 5];
    else if (d.style?.borderStyle === 'dotted') borderDash = [3, 3];
    ctx.setLineDash(borderDash);
    _roundRect(ctx, bx, by, bw, bh, 4); ctx.stroke();
    ctx.setLineDash([]);

    // Text
    ctx.fillStyle = d.style?.textColor || '#d1d4dc';
    ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
    const startY = by + padY + fontSize / 2;
    lines.forEach((l, i) => ctx.fillText(l, b.x, startY + i * lh));

    // Anchor dots and Selection handles
    if (isSelected) {
      ctx.strokeStyle = '#2962ff'; ctx.lineWidth = 1; ctx.setLineDash([3, 2]);
      ctx.strokeRect(bx - 2, by - 2, bw + 4, bh + 4);
      ctx.setLineDash([]);
      ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#2962ff'; ctx.lineWidth = 2;
      [a, intersect].forEach(pt => {
        ctx.beginPath(); ctx.arc(pt.x, pt.y, 4, 0, Math.PI*2);
        ctx.fill(); ctx.stroke();
      });
    } else {
      ctx.fillStyle = lineColor;
      ctx.beginPath(); ctx.arc(a.x, a.y, 3, 0, Math.PI * 2); ctx.fill();
    }
  }

  // ── CALLOUT ──────────────────────────────────────────────────────────────
  function _drawCallout(ctx, d, pane, isHovered, isSelected) {
    if (d._isEditing) return;
    const a = _pt2xy(d.p1, pane);
    const b = d.p2 ? _pt2xy(d.p2, pane) : a;
    if (!a || !b) return;
    const text = d.text || 'Callout';
    
    const boldC = d.style?.bold ? 'bold ' : '';
    const italicC = d.style?.italic ? 'italic ' : '';
    const fontSize = d.style?.fontSize || 13;
    ctx.font = `${italicC}${boldC}${fontSize}px Inter, -apple-system, sans-serif`;
    
    const textWrap = d.style?.textWrap !== false; // default: wrap ON
    const wrapWidth = 160; // max wrap width in px

    // Build wrapped lines
    let lines = [];
    for (const rawLine of text.split('\n')) {
      if (textWrap) {
        const words = rawLine.split(' ');
        let cur = '';
        for (const w of words) {
          const test = cur ? cur + ' ' + w : w;
          if (ctx.measureText(test).width > wrapWidth && cur) {
            lines.push(cur);
            cur = w;
          } else {
            cur = test;
          }
        }
        if (cur) lines.push(cur);
      } else {
        lines.push(rawLine);
      }
    }
    if (!lines.length) lines = [''];

    let maxW = 0;
    for (const l of lines) maxW = Math.max(maxW, ctx.measureText(l).width);
    const lh = fontSize * 1.4, px = 7, py = 5; // compact padding
    const bw = Math.max(maxW + px * 2, 60);
    const bh = lines.length * lh + py * 2;
    
    const bx = b.x - bw / 2;
    const by = b.y - bh / 2;

    const dx = a.x - b.x;
    const dy = a.y - b.y;
    let edge = '';
    if (Math.abs(dx) / (bw/2) > Math.abs(dy) / (bh/2)) {
      edge = dx > 0 ? 'right' : 'left';
    } else {
      edge = dy > 0 ? 'bottom' : 'top';
    }
    
    const tw2 = 8; // half tail width
    const r = 5;

    ctx.beginPath();
    ctx.moveTo(bx + r, by);
    if (edge === 'top' && Math.abs(a.y - by) > 10) {
      ctx.lineTo(b.x - tw2, by); ctx.lineTo(a.x, a.y); ctx.lineTo(b.x + tw2, by);
    }
    ctx.lineTo(bx + bw - r, by); ctx.arcTo(bx + bw, by, bx + bw, by + r, r);
    
    if (edge === 'right' && Math.abs(a.x - (bx + bw)) > 10) {
      ctx.lineTo(bx + bw, b.y - tw2); ctx.lineTo(a.x, a.y); ctx.lineTo(bx + bw, b.y + tw2);
    }
    ctx.lineTo(bx + bw, by + bh - r); ctx.arcTo(bx + bw, by + bh, bx + bw - r, by + bh, r);
    
    if (edge === 'bottom' && Math.abs(a.y - (by + bh)) > 10) {
      ctx.lineTo(b.x + tw2, by + bh); ctx.lineTo(a.x, a.y); ctx.lineTo(b.x - tw2, by + bh);
    }
    ctx.lineTo(bx + r, by + bh); ctx.arcTo(bx, by + bh, bx, by + bh - r, r);
    
    if (edge === 'left' && Math.abs(a.x - bx) > 10) {
      ctx.lineTo(bx, b.y + tw2); ctx.lineTo(a.x, a.y); ctx.lineTo(bx, b.y - tw2);
    }
    ctx.lineTo(bx, by + r); ctx.arcTo(bx, by, bx + r, by, r);
    ctx.closePath();

    const showFillC = d.style?.showFill !== false;
    ctx.fillStyle = showFillC ? (d.style?.fillColor || '#1e222d') : 'rgba(0,0,0,0)';
    ctx.fill();
    const showBorderC = d.style?.showBorder !== false;
    ctx.strokeStyle = (isSelected || isHovered) ? '#2962ff'
      : showBorderC ? (d.style?.borderColor || '#363c4e') : 'transparent';
    ctx.lineWidth = d.style?.borderWidth || 1;
    let bDashC = [];
    if (d.style?.borderStyle === 'dashed') bDashC = [8, 5];
    else if (d.style?.borderStyle === 'dotted') bDashC = [3, 3];
    ctx.setLineDash(bDashC);
    ctx.stroke();
    ctx.setLineDash([]);

    // Text
    ctx.font = `${italicC}${boldC}${fontSize}px Inter, -apple-system, sans-serif`;
    ctx.fillStyle = d.style?.textColor || '#d1d4dc';
    ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
    const startY = by + (bh - (lines.length - 1) * lh) / 2;
    lines.forEach((l, i) => ctx.fillText(l, bx + bw / 2, startY + i * lh));

    // Selection handles
    if (isSelected) {
      ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#2962ff'; ctx.lineWidth = 2;
      [a, b].forEach(pt => {
        ctx.beginPath(); ctx.arc(pt.x, pt.y, 4, 0, Math.PI*2);
        ctx.fill(); ctx.stroke();
      });
    }
  }

  // ── PRICE NOTE ───────────────────────────────────────────────────────────
  function _drawPriceNote(ctx, d, pane, isHovered, isSelected) {
    if (d._isEditing) return;
    const a = _pt2xy(d.p1, pane);
    const b = d.p2 ? _pt2xy(d.p2, pane) : a;
    if (!a || !b) return;
    const priceStr = typeof d.p1.price === 'number' ? parseFloat(d.p1.price.toPrecision(8)).toString() : '';
    const label = priceStr;
    const fontSize = d.style?.fontSize || 13;
    ctx.font = `${fontSize}px Inter, -apple-system, sans-serif`;
    const tw = ctx.measureText(label).width;
    const px = 8, py = 3;
    const bw = tw + px * 2;
    const bh = fontSize * 1.25 + py * 2;
    const bx = b.x - bw/2;
    const by = b.y - bh/2;

    function getIntersect(cx, cy, hw, hh, px, py) {
      const dx = px - cx, dy = py - cy;
      if (dx === 0 && dy === 0) return { x: cx, y: cy };
      if (Math.abs(dx) / hw > Math.abs(dy) / hh) {
        return { x: cx + (dx > 0 ? hw : -hw), y: cy + dy * (hw / Math.abs(dx)) };
      } else {
        return { x: cx + dx * (hh / Math.abs(dy)), y: cy + (dy > 0 ? hh : -hh) };
      }
    }

    const intersect = getIntersect(b.x, b.y, bw/2 + 1, bh/2 + 1, a.x, a.y);

    // Draw line from a to intersect
    const pnLineColor = d.style?.color || '#787b86';
    ctx.strokeStyle = pnLineColor;
    ctx.lineWidth = d.style?.width || 1;
    let lineDash = [];
    if (d.style?.lineStyle === 'dashed') lineDash = [8, 5];
    else if (d.style?.lineStyle === 'dotted') lineDash = [3, 3];
    ctx.setLineDash(lineDash);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(intersect.x, intersect.y); ctx.stroke();

    // Box
    const showFillPN = d.style?.showFill !== false;
    ctx.fillStyle = showFillPN ? (d.style?.fillColor || '#1e222d') : 'rgba(0,0,0,0)';
    _roundRect(ctx, bx, by, bw, bh, 4); ctx.fill();
    const showBorderPN = d.style?.showBorder === true;
    ctx.strokeStyle = (isSelected || isHovered) ? '#2962ff'
      : showBorderPN ? (d.style?.borderColor || '#363c4e') : 'transparent';
    ctx.lineWidth = d.style?.borderWidth || 1;
    let borderDash = [];
    if (d.style?.borderStyle === 'dashed') borderDash = [8, 5];
    else if (d.style?.borderStyle === 'dotted') borderDash = [3, 3];
    ctx.setLineDash(borderDash);
    _roundRect(ctx, bx, by, bw, bh, 4); ctx.stroke();
    ctx.setLineDash([]);

    // Price Text
    const boldPN = d.style?.bold ? 'bold ' : '';
    const italicPN = d.style?.italic ? 'italic ' : '';
    const fsPN = d.style?.fontSize || 13;
    ctx.font = `${italicPN}${boldPN}${fsPN}px Inter, -apple-system, sans-serif`;
    ctx.fillStyle = d.style?.textColor || '#d1d4dc';
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.fillText(label, bx + px, b.y);

    // User Text (parallel to line)
    if (d.text) {
      const uBold = d.style?.userBold ? 'bold ' : '';
      const uItalic = d.style?.userItalic ? 'italic ' : '';
      const uFs = d.style?.userFontSize || 14;
      ctx.font = `${uItalic}${uBold}${uFs}px Inter, -apple-system, sans-serif`;
      ctx.fillStyle = d.style?.userTextColor || '#d1d4dc';
      const angle = Math.atan2(b.y - a.y, b.x - a.x);
      ctx.save();
      ctx.translate((a.x + intersect.x) / 2, (a.y + intersect.y) / 2);
      let rot = angle;
      if (rot > Math.PI/2 || rot < -Math.PI/2) {
         rot += Math.PI;
         ctx.rotate(rot);
         ctx.textBaseline = 'top';
         ctx.textAlign = 'center';
         ctx.fillText(d.text, 0, 5);
      } else {
         ctx.rotate(rot);
         ctx.textBaseline = 'bottom';
         ctx.textAlign = 'center';
         ctx.fillText(d.text, 0, -5);
      }
      ctx.restore();
    }

    // Selection handles
    if (isSelected) {
      ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#2962ff'; ctx.lineWidth = 2;
      [a, intersect].forEach(pt => {
        ctx.beginPath(); ctx.arc(pt.x, pt.y, 4, 0, Math.PI*2);
        ctx.fill(); ctx.stroke();
      });
    } else {
      ctx.fillStyle = pnLineColor;
      ctx.beginPath(); ctx.arc(a.x, a.y, 3, 0, Math.PI * 2); ctx.fill();
    }
  }

  // ── PRICE LABEL ────────────────────────────────────────────────────────────
  function _getPanePrecision(pane) {
    try {
      // 1. Try series priceFormat options
      const fmt = pane.series.options().priceFormat;
      if (fmt && typeof fmt.precision === 'number') return fmt.precision;
      
      // 2. Try priceScale options
      const pScale = pane.chart.priceScale(pane.priceSide || 'right');
      if (pScale && pScale.options().precision != null) return pScale.options().precision;
    } catch(e) {}

    try {
      // 3. Heuristic: Check the price difference of 1 pixel at the center
      const mid = pane.cvs.height / 2;
      const p1 = pane.series.coordinateToPrice(mid);
      const p2 = pane.series.coordinateToPrice(mid + 1);
      if (p1 != null && p2 != null) {
        const diff = Math.abs(p1 - p2);
        if (diff > 0) {
          // If 1px = 0.000123, -log10 is 3.9, ceil is 4.
          // We limit to 8 for crypto/forex sanity.
          return Math.min(Math.max(0, Math.ceil(-Math.log10(diff))), 8);
        }
      }
    } catch(e) {}
    return 2;
  }

  function _drawPriceLabel(ctx, d, pane, isHovered, isSelected) {
    if (d._isEditing) return;
    const a = _pt2xy(d.p1, pane);
    if (!a) return;
    const precision = _getPanePrecision(pane);
    const priceStr = typeof d.p1.price === 'number' ? d.p1.price.toFixed(precision) : '';
    const label = d.text || priceStr;
    const fontSize = d.style?.fontSize || 12;
    ctx.font = `bold ${fontSize}px Inter, -apple-system, sans-serif`;
    const tw = ctx.measureText(label).width;
    const px = 8, py = 5;
    const bw = tw + px * 2;
    const bh = fontSize * 1.5 + py * 2;
    const fill = d.style?.fillColor || '#2962ff';

    // Image reference logic:
    // Anchor dot at a
    // Dashed line passing horizontally through a.y
    // Bubble positioned slightly right and above a, with tail connecting bottom-left to a.

    // Dashed line
    ctx.strokeStyle = '#ffffff'; 
    ctx.lineWidth = 1; 
    ctx.setLineDash([5, 5]);
    ctx.beginPath(); ctx.moveTo(0, a.y); ctx.lineTo(pane.cvs.width, a.y); ctx.stroke();
    ctx.setLineDash([]);

    const bx = a.x + 15;
    const by = a.y - bh - 10;
    const r = 4;
    
    ctx.beginPath();
    ctx.moveTo(bx + r, by);
    ctx.lineTo(bx + bw - r, by); ctx.arcTo(bx + bw, by, bx + bw, by + r, r);
    ctx.lineTo(bx + bw, by + bh - r); ctx.arcTo(bx + bw, by + bh, bx + bw - r, by + bh, r);
    ctx.lineTo(bx + 12, by + bh);
    ctx.lineTo(a.x, a.y); // Tail tip
    ctx.lineTo(bx + 5, by + bh);
    ctx.lineTo(bx + r, by + bh); ctx.arcTo(bx, by + bh, bx, by + bh - r, r);
    ctx.lineTo(bx, by + r); ctx.arcTo(bx, by, bx + r, by, r);
    ctx.closePath();
    
    ctx.fillStyle = fill;
    ctx.fill();
    
    // Always draw border for pricelabel
    ctx.strokeStyle = (isSelected || isHovered) ? '#ffffff' : (d.style?.borderColor || '#2962ff');
    ctx.lineWidth = 1;
    ctx.stroke();

    // Anchor dot
    ctx.fillStyle = fill;
    ctx.beginPath(); ctx.arc(a.x, a.y, 3, 0, Math.PI * 2); ctx.fill();

    if (isSelected || isHovered) {
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; ctx.setLineDash([]);
      ctx.stroke();
    }
    
    // Text
    ctx.fillStyle = d.style?.textColor || '#ffffff';
    ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
    ctx.fillText(label, bx + bw / 2, by + bh / 2);
  }

  // ── FLAG MARK ────────────────────────────────────────────────────────────
  function _drawFlagMark(ctx, d, pane, isHovered, isSelected) {
    if (d._isEditing) return;
    const a = _pt2xy(d.p1, pane);
    if (!a) return;
    const flagW = 32, flagH = 20, poleH = 50;
    const color = d.style?.color || '#2962ff';
    // Pole
    ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(a.x, a.y - poleH); ctx.stroke();
    // Flag
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y - poleH);
    ctx.lineTo(a.x + flagW, a.y - poleH + flagH / 2);
    ctx.lineTo(a.x, a.y - poleH + flagH);
    ctx.closePath();
    ctx.fill();
    if (isSelected || isHovered) {
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1;
      ctx.stroke();
    }
    // Small text on flag
    const label = d.text || '';
    if (label) {
      const fs = d.style?.fontSize || 10;
      ctx.font = `bold ${fs}px Inter, -apple-system, sans-serif`;
      ctx.fillStyle = d.style?.textColor || '#ffffff';
      ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
      ctx.fillText(label, a.x + 4, a.y - poleH + flagH / 2);
    }
  }

  // ── TABLE ANNOTATION ─────────────────────────────────────────────────────
  function _drawTableAnno(ctx, d, pane, isHovered, isSelected) {
    if (d._isEditing) return;
    const a = _pt2xy(d.p1, pane);
    if (!a) return;
    const rows = d.style?.rows || 2;
    const cols = d.style?.cols || 3;
    const cellW = 64, cellH = 22;
    const bw = cols * cellW, bh = rows * cellH;
    const bx = a.x, by = a.y;
    // Background
    ctx.fillStyle = d.style?.fillColor || '#1e222d';
    ctx.fillRect(bx, by, bw, bh);
    // Grid lines
    ctx.strokeStyle = (isSelected || isHovered) ? '#2962ff' : (d.style?.borderColor || '#363c4e');
    ctx.lineWidth = 1; ctx.setLineDash([]);
    for (let r = 0; r <= rows; r++) {
      ctx.beginPath(); ctx.moveTo(bx, by + r * cellH); ctx.lineTo(bx + bw, by + r * cellH); ctx.stroke();
    }
    for (let c = 0; c <= cols; c++) {
      ctx.beginPath(); ctx.moveTo(bx + c * cellW, by); ctx.lineTo(bx + c * cellW, by + bh); ctx.stroke();
    }
    // Header row shading
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(bx, by, bw, cellH);
    // Parse text as TSV
    const data = (d.text || '').split('\n').map(r => r.split('\t'));
    const fs = d.style?.fontSize || 12;
    ctx.font = `${fs}px Inter, -apple-system, sans-serif`;
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.fillStyle = d.style?.textColor || '#d1d4dc';
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const val = (data[r] && data[r][c]) || '';
        ctx.fillText(val, bx + c * cellW + 4, by + r * cellH + cellH / 2);
      }
    }
    if (isSelected) {
      ctx.strokeStyle = '#2962ff'; ctx.lineWidth = 1.5;
      ctx.strokeRect(bx, by, bw, bh);
    }
  }

  // Helper for rounded rectangles
  function _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }

  function _drawTextTool(ctx, d, pane, isHovered, isSelected) {
    if (d._isEditing) return; // Skip drawing while inline editor is active
    const a = _pt2xy(d.p1, pane);
    if (!a) return;

    const s = d.style || {};
    const fontSize = s.fontSize || 16;
    ctx.font = `${s.bold ? 'bold ' : ''}${s.italic ? 'italic ' : ''}${fontSize}px Inter, -apple-system, sans-serif`;
    
    let rawText = d.text || 'Text';
    let lines = rawText.split('\n');
    
    const paddingX = 6;
    const paddingY = 4;
    const lh = fontSize * 1.2;

    // Handle Text Wrap
    if (s.textWrap !== false && s.textWidth != null) {
      const maxW = s.textWidth;
      let wrappedLines = [];
      lines.forEach(line => {
        let words = line.split(' ');
        let currentLine = '';
        words.forEach(word => {
          let testLine = currentLine ? currentLine + ' ' + word : word;
          if (ctx.measureText(testLine).width > maxW) {
            if (currentLine) wrappedLines.push(currentLine);
            currentLine = word;
          } else {
            currentLine = testLine;
          }
        });
        if (currentLine) wrappedLines.push(currentLine);
      });
      lines = wrappedLines;
    }

    let autoW = 0;
    for (const l of lines) autoW = Math.max(autoW, ctx.measureText(l).width);
    
    // Ensure box covers at least the specified textWidth AND the longest line (for long words)
    const specifiedW = (s.textWidth != null) ? s.textWidth : 200;
    const w = (s.textWrap !== false) 
      ? Math.max(specifiedW, autoW) + paddingX * 2 
      : autoW + paddingX * 2;
    const h = lines.length * lh + paddingY * 2;

    // Background
    if (s.showBg !== false && s.fillColor && s.fillColor !== 'transparent' && s.fillColor !== 'rgba(0,0,0,0)') {
       ctx.fillStyle = s.fillColor;
       ctx.fillRect(a.x, a.y, w, h);
    }
    
    // Persistent Border
    if (s.showBorder && s.borderColor) {
       ctx.strokeStyle = s.borderColor;
       ctx.lineWidth = 1;
       ctx.setLineDash([]);
       ctx.strokeRect(a.x, a.y, w, h);
    }

    // Selection/Hover Highlight
    if (isSelected || isHovered) {
       ctx.strokeStyle = isSelected ? '#2962ff' : '#6c8ebf';
       ctx.lineWidth = 1;
       ctx.setLineDash([]);
       ctx.strokeRect(a.x - 0.5, a.y - 0.5, w + 1, h + 1);
    }

    ctx.fillStyle = s.textColor || '#d1d4dc';
    ctx.textBaseline = 'middle';
    const by = a.y - bh - 10;
    const r = 4;
    
    ctx.beginPath();
    ctx.moveTo(bx + r, by);
    ctx.lineTo(bx + bw - r, by); ctx.arcTo(bx + bw, by, bx + bw, by + r, r);
    ctx.lineTo(bx + bw, by + bh - r); ctx.arcTo(bx + bw, by + bh, bx + bw - r, by + bh, r);
    ctx.lineTo(bx + 12, by + bh);
    ctx.lineTo(a.x, a.y); // Tail tip
    ctx.lineTo(bx + 5, by + bh);
    ctx.lineTo(bx + r, by + bh); ctx.arcTo(bx, by + bh, bx, by + bh - r, r);
    ctx.lineTo(bx, by + r); ctx.arcTo(bx, by, bx + r, by, r);
    ctx.closePath();
    
    ctx.fillStyle = fill;
    ctx.fill();
    
    // Always draw border for pricelabel
    ctx.strokeStyle = (isSelected || isHovered) ? '#ffffff' : (d.style?.borderColor || '#2962ff');
    ctx.lineWidth = 1;
    ctx.stroke();

    // Anchor dot
    ctx.fillStyle = fill;
    ctx.beginPath(); ctx.arc(a.x, a.y, 3, 0, Math.PI * 2); ctx.fill();

    if (isSelected || isHovered) {
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; ctx.setLineDash([]);
      ctx.stroke();
    }
    
    // Text
    ctx.fillStyle = d.style?.textColor || '#ffffff';
    ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
    ctx.fillText(label, bx + bw / 2, by + bh / 2);
  }

  // ── FLAG MARK ────────────────────────────────────────────────────────────
  function _drawFlagMark(ctx, d, pane, isHovered, isSelected) {
    if (d._isEditing) return;
    const a = _pt2xy(d.p1, pane);
    if (!a) return;
    const flagW = 32, flagH = 20, poleH = 50;
    const color = d.style?.color || '#2962ff';
    // Pole
    ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(a.x, a.y - poleH); ctx.stroke();
    // Flag
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y - poleH);
    ctx.lineTo(a.x + flagW, a.y - poleH + flagH / 2);
    ctx.lineTo(a.x, a.y - poleH + flagH);
    ctx.closePath();
    ctx.fill();
    if (isSelected || isHovered) {
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1;
      ctx.stroke();
    }
    // Small text on flag
    const label = d.text || '';
    if (label) {
      const fs = d.style?.fontSize || 10;
      ctx.font = `bold ${fs}px Inter, -apple-system, sans-serif`;
      ctx.fillStyle = d.style?.textColor || '#ffffff';
      ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
      ctx.fillText(label, a.x + 4, a.y - poleH + flagH / 2);
    }
  }

  // ── TABLE ANNOTATION ─────────────────────────────────────────────────────
  function _drawTableAnno(ctx, d, pane, isHovered, isSelected) {
    if (d._isEditing) return;
    const a = _pt2xy(d.p1, pane);
    if (!a) return;
    const rows = d.style?.rows || 2;
    const cols = d.style?.cols || 3;
    const cellW = 64, cellH = 22;
    const bw = cols * cellW, bh = rows * cellH;
    const bx = a.x, by = a.y;
    // Background
    ctx.fillStyle = d.style?.fillColor || '#1e222d';
    ctx.fillRect(bx, by, bw, bh);
    // Grid lines
    ctx.strokeStyle = (isSelected || isHovered) ? '#2962ff' : (d.style?.borderColor || '#363c4e');
    ctx.lineWidth = 1; ctx.setLineDash([]);
    for (let r = 0; r <= rows; r++) {
      ctx.beginPath(); ctx.moveTo(bx, by + r * cellH); ctx.lineTo(bx + bw, by + r * cellH); ctx.stroke();
    }
    for (let c = 0; c <= cols; c++) {
      ctx.beginPath(); ctx.moveTo(bx + c * cellW, by); ctx.lineTo(bx + c * cellW, by + bh); ctx.stroke();
    }
    // Header row shading
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(bx, by, bw, cellH);
    // Parse text as TSV
    const data = (d.text || '').split('\n').map(r => r.split('\t'));
    const fs = d.style?.fontSize || 12;
    ctx.font = `${fs}px Inter, -apple-system, sans-serif`;
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.fillStyle = d.style?.textColor || '#d1d4dc';
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const val = (data[r] && data[r][c]) || '';
        ctx.fillText(val, bx + c * cellW + 4, by + r * cellH + cellH / 2);
      }
    }
    if (isSelected) {
      ctx.strokeStyle = '#2962ff'; ctx.lineWidth = 1.5;
      ctx.strokeRect(bx, by, bw, bh);
    }
  }

  function _drawIcon(ctx, d, pane, isHover, selected) {
    // Placeholder implementation for Icon / Emoji Tool
  }

  // Helper for rounded rectangles
  function _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }

  function _drawTextTool(ctx, d, pane, isHovered, isSelected) {
    if (d._isEditing) return; // Skip drawing while inline editor is active
    const a = _pt2xy(d.p1, pane);
    if (!a) return;

    const s = d.style || {};
    const fontSize = s.fontSize || 16;
    ctx.font = `${s.bold ? 'bold ' : ''}${s.italic ? 'italic ' : ''}${fontSize}px Inter, -apple-system, sans-serif`;
    
    let rawText = d.text || 'Text';
    let lines = rawText.split('\n');
    
    const paddingX = 6;
    const paddingY = 4;
    const lh = fontSize * 1.2;

    // Handle Text Wrap
    if (s.textWrap !== false && s.textWidth != null) {
      const maxW = s.textWidth;
      let wrappedLines = [];
      lines.forEach(line => {
        let words = line.split(' ');
        let currentLine = '';
        words.forEach(word => {
          let testLine = currentLine ? currentLine + ' ' + word : word;
          if (ctx.measureText(testLine).width > maxW) {
            if (currentLine) wrappedLines.push(currentLine);
            currentLine = word;
          } else {
            currentLine = testLine;
          }
        });
        if (currentLine) wrappedLines.push(currentLine);
      });
      lines = wrappedLines;
    }

    let autoW = 0;
    for (const l of lines) autoW = Math.max(autoW, ctx.measureText(l).width);
    
    // Ensure box covers at least the specified textWidth AND the longest line (for long words)
    const specifiedW = (s.textWidth != null) ? s.textWidth : 200;
    const w = (s.textWrap !== false) 
      ? Math.max(specifiedW, autoW) + paddingX * 2 
      : autoW + paddingX * 2;
    const h = lines.length * lh + paddingY * 2;

    // Background
    if (s.showBg !== false && s.fillColor && s.fillColor !== 'transparent' && s.fillColor !== 'rgba(0,0,0,0)') {
       ctx.fillStyle = s.fillColor;
       ctx.fillRect(a.x, a.y, w, h);
    }
    
    // Persistent Border
    if (s.showBorder && s.borderColor) {
       ctx.strokeStyle = s.borderColor;
       ctx.lineWidth = 1;
       ctx.setLineDash([]);
       ctx.strokeRect(a.x, a.y, w, h);
    }

    // Selection/Hover Highlight
    if (isSelected || isHovered) {
       ctx.strokeStyle = isSelected ? '#2962ff' : '#6c8ebf';
       ctx.lineWidth = 1;
       ctx.setLineDash([]);
       ctx.strokeRect(a.x - 0.5, a.y - 0.5, w + 1, h + 1);
    }

    ctx.fillStyle = s.textColor || '#d1d4dc';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    lines.forEach((l, i) => {
       ctx.fillText(l, a.x + paddingX, a.y + paddingY + (i + 0.5) * lh);
    });

    // Right-edge resize handle (shown when selected and wrap is enabled)
    if (isSelected && s.textWrap !== false) {
      const hx = a.x + w;
      const hy = a.y + h / 2;
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#2962ff';
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      ctx.fillRect(hx - 4, hy - 4, 8, 8);
      ctx.strokeRect(hx - 4, hy - 4, 8, 8);
    }
  }


  return { 
    openInlineTextEditor: _openInlineTextEditor,
    drawNote: _drawNote,
    drawCallout: _drawCallout,
    drawPriceNote: _drawPriceNote,
    drawPriceLabel: _drawPriceLabel,
    drawFlagMark: _drawFlagMark,
    drawTableAnno: _drawTableAnno,
    drawIcon: _drawIcon,
    drawTextTool: _drawTextTool 
  };
})();
