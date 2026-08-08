/**
 * PinTrade V2.4 - Drawing Geometric Shapes and Arrows Module
 * 
 * Handles the rendering of all tools in the "Geometric Shapes" and "Arrows" groups.
 */

window.DrawingShapes = (() => {

  function _pt2xy(pt, pane) {
    if (window.DrawingManager && window.DrawingManager.utils) {
      return window.DrawingManager.utils.pt2xy(pt, pane);
    }
    return null;
  }

  function _xy2pt(xy, pane) {
    if (window.DrawingManager && window.DrawingManager.utils) {
      return window.DrawingManager.utils.xy2pt(xy, pane);
    }
    return null;
  }

  function _formatPrice(price) {
    if (window.DrawingManager && window.DrawingManager.utils) {
      return window.DrawingManager.utils.formatPrice(price);
    }
    return price.toFixed(2);
  }

  function _drawRect(ctx, d, pane) {
      const a = _pt2xy(d.p1, pane);
      const b = _pt2xy(d.p2, pane);
      if (!a || !b) return;
      
      const s = d.style || {};
      const extL = !!s.extendLeft;
      const extR = !!s.extendRight;
      const showBg = s.showBg !== false;
      const showMid = s.showMidline !== false;
      
      let x1 = Math.min(a.x, b.x);
      let x2 = Math.max(a.x, b.x);
      const y1 = Math.min(a.y, b.y);
      const y2 = Math.max(a.y, b.y);
      
      const cw = pane.drawingCanvas.width / (window.devicePixelRatio || 1);
      
      if (extL) x1 = 0;
      if (extR) x2 = cw;
      
      const w = x2 - x1;
      const h = y2 - y1;
      
      // Fill
      if (showBg) {
        ctx.globalAlpha = 1;
        ctx.fillStyle = s.fillColor || 'rgba(9, 105, 218, 0.2)';
        ctx.fillRect(x1, y1, w, h);
      }
      
      // Border
      ctx.strokeStyle = s.color || '#0969da';
      ctx.lineWidth = s.width || 1;
      let dashArr = s.dash || [];
      if (s.lineStyle === 'dashed') dashArr = [8,5];
      if (s.lineStyle === 'dotted') dashArr = [3,3];
      ctx.setLineDash(dashArr);
      
      ctx.beginPath();
      ctx.moveTo(x1, y1); ctx.lineTo(x2, y1);
      ctx.moveTo(x1, y2); ctx.lineTo(x2, y2);
      if (!extL) { ctx.moveTo(x1, y1); ctx.lineTo(x1, y2); }
      if (!extR) { ctx.moveTo(x2, y1); ctx.lineTo(x2, y2); }
      ctx.stroke();
      
      // Midline
      if (showMid) {
        ctx.strokeStyle = s.midlineColor || s.color || '#0969da';
        ctx.lineWidth = s.midlineWidth || 1;
        let midDash = s.midlineDash || [];
        if (s.midlineStyle === 'dashed') midDash = [8,5];
        if (s.midlineStyle === 'dotted') midDash = [3,3];
        ctx.setLineDash(midDash);
        
        const midY = y1 + h / 2;
        ctx.beginPath();
        ctx.moveTo(x1, midY);
        ctx.lineTo(x2, midY);
        ctx.stroke();
      }
      
      ctx.setLineDash([]);
      
      // Text
      if (s.text && s.text.trim().length > 0) {
        ctx.fillStyle = s.textColor || '#ffffff';
        const size = s.fontSize || 14;
        const fontStr = `${s.italic ? 'italic ' : ''}${s.bold ? 'bold ' : ''}${size}px sans-serif`;
        ctx.font = fontStr;
        
        const alignV = s.textAlignV || 'middle';
        const alignH = s.textAlignH || 'center';
        
        ctx.textAlign = alignH;
        ctx.textBaseline = alignV;
        
        let tx = x1 + w/2;
        if (alignH === 'left') tx = x1 + 5;
        if (alignH === 'right') tx = x2 - 5;
        
        let ty = y1 + h/2;
        if (alignV === 'top') ty = y1 + 5;
        if (alignV === 'bottom') ty = y2 - 5;
        
        ctx.fillText(s.text, tx, ty);
      }
    }

  function _drawRotatedRect(ctx, d, pane) {
      if (!d.p1 || !d.p2) return;
      const a = _pt2xy(d.p1, pane);
      const b = _pt2xy(d.p2, pane);
      if (!a || !b) return;
  
      const s = d.style || {};
      const showBg = s.showBg !== false;
  
      const lineWidth = parseInt(s.width) || 1;
      ctx.lineWidth = lineWidth;
      ctx.strokeStyle = s.color || '#0969da';
      
      const style = s.lineStyle || 'solid';
      const lineDash = style === 'dashed' ? [6 * lineWidth, 6 * lineWidth] : style === 'dotted' ? [2 * lineWidth, 4 * lineWidth] : [];
      ctx.setLineDash(lineDash);
      ctx.globalAlpha = ((s.opacity ?? 100) / 100);
  
      if (!d.p3) {
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        return;
      }
  
      const c = _pt2xy(d.p3, pane);
      if (!c) return;
  
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const L = Math.hypot(dx, dy);
      if (L === 0) return;
  
      const Nx = -dy / L;
      const Ny = dx / L;
      const H = (c.x - a.x) * Nx + (c.y - a.y) * Ny;
  
      const corners = [
        { x: a.x + Nx * H, y: a.y + Ny * H },
        { x: b.x + Nx * H, y: b.y + Ny * H },
        { x: b.x - Nx * H, y: b.y - Ny * H },
        { x: a.x - Nx * H, y: a.y - Ny * H }
      ];
  
      if (showBg) {
        ctx.globalAlpha = 1; 
        ctx.fillStyle = s.fillColor || 'rgba(9, 105, 218, 0.2)';
        ctx.beginPath();
        ctx.moveTo(corners[0].x, corners[0].y);
        ctx.lineTo(corners[1].x, corners[1].y);
        ctx.lineTo(corners[2].x, corners[2].y);
        ctx.lineTo(corners[3].x, corners[3].y);
        ctx.closePath();
        ctx.fill();
      }
  
      ctx.globalAlpha = ((s.opacity ?? 100) / 100);
      ctx.beginPath();
      ctx.moveTo(corners[0].x, corners[0].y);
      ctx.lineTo(corners[1].x, corners[1].y);
      ctx.lineTo(corners[2].x, corners[2].y);
      ctx.lineTo(corners[3].x, corners[3].y);
      ctx.closePath();
      ctx.stroke();
  
      if (s.showMidline !== false) {
        ctx.strokeStyle = s.midlineColor || s.color || '#0969da';
        ctx.lineWidth = s.midlineWidth || 1;
        let midDash = s.midlineDash || [];
        if (s.midlineStyle === 'dashed') midDash = [8,5];
        if (s.midlineStyle === 'dotted') midDash = [3,3];
        ctx.setLineDash(midDash);
        
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }

  function _drawCircle(ctx, d, pane) {
      const a = _pt2xy(d.p1, pane);
      const b = _pt2xy(d.p2, pane);
      if (!a || !b) return;
      const s = d.style || {};
      const radius = Math.hypot(b.x - a.x, b.y - a.y);
      if (radius < 1) return;
  
      const lineWidth = parseInt(s.width) || 1;
      ctx.lineWidth = lineWidth;
      ctx.strokeStyle = s.color || '#0969da';
      const style = s.lineStyle || 'solid';
      ctx.setLineDash(style === 'dashed' ? [6*lineWidth, 6*lineWidth] : style === 'dotted' ? [2*lineWidth, 4*lineWidth] : []);
  
      if (s.showBg !== false) {
        ctx.globalAlpha = 1;
        ctx.fillStyle = s.fillColor || 'rgba(9,105,218,0.2)';
        ctx.beginPath();
        ctx.arc(a.x, a.y, radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = ((s.opacity ?? 100) / 100);
      ctx.beginPath();
      ctx.arc(a.x, a.y, radius, 0, Math.PI * 2);
      ctx.stroke();
  
      if (s.showMidline !== false) {
        ctx.strokeStyle = s.midlineColor || s.color || '#0969da';
        ctx.lineWidth = s.midlineWidth || 1;
        const ms = s.midlineStyle || 'solid';
        ctx.setLineDash(ms === 'dashed' ? [8,5] : ms === 'dotted' ? [3,3] : []);
        ctx.beginPath();
        ctx.moveTo(a.x - radius, a.y);
        ctx.lineTo(a.x + radius, a.y);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }

  function _drawEllipse(ctx, d, pane) {
      const a = _pt2xy(d.p1, pane);
      const b = _pt2xy(d.p2, pane);
      if (!a || !b) return;
      const s = d.style || {};
      const cx = (a.x + b.x) / 2;
      const cy = (a.y + b.y) / 2;
      const rx = Math.abs(b.x - a.x) / 2;
      const ry = Math.abs(b.y - a.y) / 2;
      if (rx < 1 || ry < 1) return;
  
      const lineWidth = parseInt(s.width) || 1;
      ctx.lineWidth = lineWidth;
      ctx.strokeStyle = s.color || '#0969da';
      const style = s.lineStyle || 'solid';
      ctx.setLineDash(style === 'dashed' ? [6*lineWidth, 6*lineWidth] : style === 'dotted' ? [2*lineWidth, 4*lineWidth] : []);
  
      if (s.showBg !== false) {
        ctx.globalAlpha = 1;
        ctx.fillStyle = s.fillColor || 'rgba(9,105,218,0.2)';
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = ((s.opacity ?? 100) / 100);
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
  
      if (s.showMidline !== false) {
        ctx.strokeStyle = s.midlineColor || s.color || '#0969da';
        ctx.lineWidth = s.midlineWidth || 1;
        const ms = s.midlineStyle || 'solid';
        ctx.setLineDash(ms === 'dashed' ? [8,5] : ms === 'dotted' ? [3,3] : []);
        ctx.beginPath();
        ctx.moveTo(cx - rx, cy);
        ctx.lineTo(cx + rx, cy);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }

  function _drawTriangle(ctx, d, pane) {
      if (!d.p1 || !d.p2 || !d.p3) return;
      const a = _pt2xy(d.p1, pane);
      const b = _pt2xy(d.p2, pane);
      const c = _pt2xy(d.p3, pane);
      if (!a || !b || !c) return;
  
      const s = d.style || {};
      const showBg = s.showBg !== false;
  
      const lineWidth = parseInt(s.width) || 1;
      ctx.lineWidth = lineWidth;
      ctx.strokeStyle = s.color || '#0969da';
      
      const style = s.lineStyle || 'solid';
      const lineDash = style === 'dashed' ? [6 * lineWidth, 6 * lineWidth] : style === 'dotted' ? [2 * lineWidth, 4 * lineWidth] : [];
      ctx.setLineDash(lineDash);
      
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineTo(c.x, c.y);
      ctx.closePath();
  
      if (showBg) {
        ctx.globalAlpha = 1;
        ctx.fillStyle = s.fillColor || 'rgba(9, 105, 218, 0.2)';
        ctx.fill();
      }
      
      ctx.globalAlpha = ((s.opacity ?? 100) / 100);
      ctx.stroke();
      ctx.setLineDash([]);
    }

  function _drawArc(ctx, d, pane) {
      if (!d.p1 || !d.p2 || !d.p3) return;
      const a = _pt2xy(d.p1, pane);
      const b = _pt2xy(d.p2, pane); // mid point on arc
      const c = _pt2xy(d.p3, pane);
      if (!a || !b || !c) return;
  
      const s = d.style || {};
      const lineWidth = parseInt(s.width) || 1;
      ctx.lineWidth = lineWidth;
      ctx.strokeStyle = s.color || '#0969da';
      
      const style = s.lineStyle || 'solid';
      const lineDash = style === 'dashed' ? [6 * lineWidth, 6 * lineWidth] : style === 'dotted' ? [2 * lineWidth, 4 * lineWidth] : [];
      ctx.setLineDash(lineDash);
      
      ctx.globalAlpha = ((s.opacity ?? 100) / 100);
  
      // Calculate center of circle passing through a, b, c
      const d1 = b.x * b.x + b.y * b.y - a.x * a.x - a.y * a.y;
      const d2 = c.x * c.x + c.y * c.y - a.x * a.x - a.y * a.y;
      const det = 2 * ((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x));
      
      if (Math.abs(det) < 0.1) {
        // points are collinear, draw a line
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(c.x, c.y);
        ctx.stroke();
      } else {
        const cx = (d1 * (c.y - a.y) - d2 * (b.y - a.y)) / det + a.x;
        const cy = (d2 * (b.x - a.x) - d1 * (c.x - a.x)) / det + a.y;
        const r = Math.hypot(a.x - cx, a.y - cy);
        
        let startAngle = Math.atan2(a.y - cy, a.x - cx);
        let endAngle = Math.atan2(c.y - cy, c.x - cx);
        const midAngle = Math.atan2(b.y - cy, b.x - cx);
        
        // Determine if arc is clockwise or counter-clockwise by checking if midAngle is between start and end
        // Simple way: angle differences
        let diffEnd = endAngle - startAngle;
        if (diffEnd < 0) diffEnd += 2 * Math.PI;
        let diffMid = midAngle - startAngle;
        if (diffMid < 0) diffMid += 2 * Math.PI;
        
        const counterclockwise = diffMid > diffEnd;
  
        ctx.beginPath();
        ctx.arc(cx, cy, r, startAngle, endAngle, counterclockwise);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }

  function _drawPathTool(ctx, d, pane) {
      if (!d.points || d.points.length < 2) return;
      const pts = d.points.map(pt => _pt2xy(pt, pane)).filter(Boolean);
      if (pts.length < 2) return;
  
      const s = d.style || {};
      const lineWidth = parseInt(s.width) || 1;
      ctx.lineWidth = lineWidth;
      ctx.strokeStyle = s.color || '#0969da';
      
      const style = s.lineStyle || 'solid';
      const lineDash = style === 'dashed' ? [6 * lineWidth, 6 * lineWidth] : style === 'dotted' ? [2 * lineWidth, 4 * lineWidth] : [];
      ctx.setLineDash(lineDash);
      
      ctx.globalAlpha = ((s.opacity ?? 100) / 100);
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i].x, pts[i].y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
  
      // Draw end caps
      if (pts.length > 1) {
        // For pathtool default is usually right arrow
        const capLeft = s.capLeft || 'normal';
        const capRight = s.capRight || (s.capRight === undefined ? 'arrow' : 'normal');
        
        const pFirst = pts[0];
        const pSecond = pts[1];
        const pLast = pts[pts.length - 1];
        const pPrev = pts[pts.length - 2];
        const r = Math.max(3, lineWidth * 2);
  
        // Left cap
        if (capLeft === 'arrow') {
          _drawArrowHead(ctx, pSecond, pFirst);
        } else {
          ctx.beginPath();
          ctx.arc(pFirst.x, pFirst.y, r, 0, Math.PI * 2);
          ctx.fillStyle = s.color || '#0969da';
          ctx.fill();
        }
  
        // Right cap
        if (capRight === 'arrow') {
          _drawArrowHead(ctx, pPrev, pLast);
        } else {
          ctx.beginPath();
          ctx.arc(pLast.x, pLast.y, r, 0, Math.PI * 2);
          ctx.fillStyle = s.color || '#0969da';
          ctx.fill();
        }
      }
    }

  function _drawArrowMarker(ctx, d, pane) {
      if (!d.p1) return;
      const a = _pt2xy(d.p1, pane);
      if (!a) return;
      const s = d.style || {};
      ctx.fillStyle = s.color || '#0969da';
      ctx.globalAlpha = ((s.opacity ?? 100) / 100);
      // Draw an angled arrow marker (like a cursor arrow) pointing top-right
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(a.x - 10, a.y + 20);
      ctx.lineTo(a.x - 3, a.y + 16);
      ctx.lineTo(a.x - 3, a.y + 26);
      ctx.lineTo(a.x + 3, a.y + 26);
      ctx.lineTo(a.x + 3, a.y + 16);
      ctx.lineTo(a.x + 10, a.y + 20);
      ctx.closePath();
      ctx.fill();
      
      // Add border to marker for visibility
      ctx.lineWidth = 1;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
    }

/**
 * Ok başı çizer — `from` noktasından `to` noktasına doğru.
 * @param {CanvasRenderingContext2D} ctx
 * @param {{x:number, y:number}} from  — ok gövdesinin başlangıcı (yön için)
 * @param {{x:number, y:number}} to    — ok başının ucu
 */
function _drawArrowHead(ctx, from, to) {
  const dx     = to.x - from.x;
  const dy     = to.y - from.y;
  const len    = Math.hypot(dx, dy);
  if (len < 1) return; // Sıfır uzunlukta ok — çizme

  const angle  = Math.atan2(dy, dx);
  const size   = Math.max(8, (ctx.lineWidth || 1) * 4); // Ok başı boyutu
  const spread = Math.PI / 6; // 30 derece açıklık

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(
    to.x - size * Math.cos(angle - spread),
    to.y - size * Math.sin(angle - spread)
  );
  ctx.lineTo(
    to.x - size * Math.cos(angle + spread),
    to.y - size * Math.sin(angle + spread)
  );
  ctx.closePath();
  ctx.fillStyle = ctx.strokeStyle || '#0969da';
  ctx.fill();
  ctx.restore();
}

  function _drawArrow(ctx, d, pane) {
      const a = _pt2xy(d.p1, pane);
      const b = _pt2xy(d.p2, pane);
      if (!a || !b) return;
      // Skip degenerate (zero-length) arrows during preview first-click
      if (Math.hypot(b.x - a.x, b.y - a.y) < 2) return;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      _drawArrowHead(ctx, a, b);
      // Optional text label (from settings dialog)
      if (d.style && d.style.text) {
        ctx.save();
        ctx.font = `${d.style.fontSize || 12}px 'JetBrains Mono', sans-serif`;
        ctx.fillStyle = d.style.textColor || ctx.strokeStyle;
        ctx.textAlign = 'center';
        ctx.fillText(d.style.text, (a.x + b.x) / 2, (a.y + b.y) / 2 - 8);
        ctx.restore();
      }
    }

  function _drawArrowUp(ctx, d, pane) {
      if (!d.p1) return;
      const a = _pt2xy(d.p1, pane);
      if (!a) return;
      const s = d.style || {};
      ctx.fillStyle = s.color || '#4caf50';
      ctx.globalAlpha = ((s.opacity ?? 100) / 100);
      // Draw a thick up arrow pointing to a.y
      ctx.beginPath();
      ctx.moveTo(a.x, a.y); // Tip
      ctx.lineTo(a.x - 12, a.y + 12);
      ctx.lineTo(a.x - 6, a.y + 12);
      ctx.lineTo(a.x - 6, a.y + 24);
      ctx.lineTo(a.x + 6, a.y + 24);
      ctx.lineTo(a.x + 6, a.y + 12);
      ctx.lineTo(a.x + 12, a.y + 12);
      ctx.closePath();
      ctx.fill();
    }

  function _drawArrowDown(ctx, d, pane) {
      if (!d.p1) return;
      const a = _pt2xy(d.p1, pane);
      if (!a) return;
      const s = d.style || {};
      ctx.fillStyle = s.color || '#f23645';
      ctx.globalAlpha = ((s.opacity ?? 100) / 100);
      // Draw a thick down arrow pointing to a.y
      ctx.beginPath();
      ctx.moveTo(a.x, a.y); // Tip
      ctx.lineTo(a.x - 12, a.y - 12);
      ctx.lineTo(a.x - 6, a.y - 12);
      ctx.lineTo(a.x - 6, a.y - 24);
      ctx.lineTo(a.x + 6, a.y - 24);
      ctx.lineTo(a.x + 6, a.y - 12);
      ctx.lineTo(a.x + 12, a.y - 12);
      ctx.closePath();
      ctx.fill();
    }


  function _drawBrush(ctx, d, pane) {
    // Placeholder for Brush tool
  }

  function _drawHighlighter(ctx, d, pane) {
    // Placeholder for Highlighter tool
  }

  return {
    drawRect: _drawRect,
    drawRotatedRect: _drawRotatedRect,
    drawCircle: _drawCircle,
    drawEllipse: _drawEllipse,
    drawTriangle: _drawTriangle,
    drawArc: _drawArc,
    drawPathTool: _drawPathTool,
    drawArrowMarker: _drawArrowMarker,
    drawArrow: _drawArrow,
    drawArrowUp: _drawArrowUp,
    drawArrowDown: _drawArrowDown,
    drawBrush: _drawBrush,
    drawHighlighter: _drawHighlighter,
  };
})();
