/**
 * PinTrade V2.4 - Drawing Trend Tools Module
 * 
 * Handles the rendering of all tools in the "Lines", "Channels", and "Pitchforks" groups.
 */

window.DrawingTrend = (() => {

  function _extendToEdge(x1, y1, x2, y2, w, h) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    if (dx === 0 && dy === 0) return { x: x2, y: y2 };

    let tMin = Infinity;

    if (dx > 0) tMin = Math.min(tMin, (w - x1) / dx);
    else if (dx < 0) tMin = Math.min(tMin, (0 - x1) / dx);

    if (dy > 0) tMin = Math.min(tMin, (h - y1) / dy);
    else if (dy < 0) tMin = Math.min(tMin, (0 - y1) / dy);

    return {
      x: x1 + dx * tMin,
      y: y1 + dy * tMin
    };
  }

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

  // Bir zaman değerini canvas X koordinatına çevirir
  function _timeToX(pane, t) {
    if (t == null) return null;
    try {
      const x = pane.chart.timeScale().timeToCoordinate(t);
      return (x == null || !isFinite(x)) ? null : x;
    } catch(_) { return null; }
  }

  function _formatPrice(price) {
    if (typeof window.formatPrice === 'function') {
      return window.formatPrice(price);
    }
    if (window.DrawingManager && window.DrawingManager.utils && typeof window.DrawingManager.utils.formatPrice === 'function') {
      return window.DrawingManager.utils.formatPrice(price);
    }
    const num = Number(price);
    return isNaN(num) ? '' : num.toFixed(2);
  }

  function _drawPriceLabel(ctx, price, y, pane) {
    if (price == null || y == null) return;
    const w = pane.drawingCanvas.width / (window.devicePixelRatio || 1);
    const text = _formatPrice(price);
    
    ctx.save();
    ctx.font = '12px "JetBrains Mono", sans-serif';
    const pad = 4;
    const txtW = ctx.measureText(text).width;
    const boxW = txtW + pad * 2;
    const boxH = 20;
    
    // Y ekseni (sağ kenar) üzerinde yeşil etiket (Binance yeşili)
    ctx.fillStyle = '#26a69a';
    ctx.fillRect(w - boxW, y - boxH/2, boxW, boxH);
    
    // Sol tarafa küçük bir ok şeklinde girinti yapmak istersen (isteğe bağlı)
    ctx.beginPath();
    ctx.moveTo(w - boxW, y - boxH/2);
    ctx.lineTo(w - boxW - 5, y);
    ctx.lineTo(w - boxW, y + boxH/2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, w - boxW/2, y);
    ctx.restore();
  }

  function _drawHLine(ctx, d, pane) {
      try {
        if (d.price == null || !isFinite(d.price)) return;
        const y = pane.series.priceToCoordinate(d.price);
        if (y == null || !isFinite(y)) return;
        const w = pane.drawingCanvas.width / (window.devicePixelRatio || 1);
        const s = d.style || {};
        ctx.save();
        ctx.strokeStyle = s.color || '#2962ff';
        ctx.lineWidth   = s.width || 1;
        let dashArr = [];
        if (s.lineStyle === 'dashed') dashArr = [8, 5];
        else if (s.lineStyle === 'dotted') dashArr = [3, 3];
        ctx.setLineDash(dashArr);
        if (s.priceLabel) _drawPriceLabel(ctx, d.price, y, pane);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
        ctx.restore();
      } catch(e) { /* render hatası diğer çizimleri etkilemesin */ }
    }

  function _drawVLine(ctx, d, pane) {
      try {
        if (d.time == null) return;
        const x = _timeToX(pane, d.time);
        if (x == null || !isFinite(x)) return;
        const h = pane.drawingCanvas.height / (window.devicePixelRatio || 1);
        const s = d.style || {};
        ctx.save();
        ctx.strokeStyle = s.color || '#2962ff';
        ctx.lineWidth   = s.width || 1;
        let dashArr = [];
        if (s.lineStyle === 'dashed') dashArr = [8, 5];
        else if (s.lineStyle === 'dotted') dashArr = [3, 3];
        ctx.setLineDash(dashArr);
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
        ctx.restore();
      } catch(e) { /* render hatası diğer çizimleri etkilemesin */ }
    }

  function _drawHRay(ctx, d, pane) {
      try {
        if (d.price == null || !isFinite(d.price)) return;
        if (d.time == null) return;
        const y = pane.series.priceToCoordinate(d.price);
        const x = _timeToX(pane, d.time);
        if (y == null || !isFinite(y) || x == null || !isFinite(x)) return;
        const w = pane.drawingCanvas.width / (window.devicePixelRatio || 1);
        const s = d.style || {};
        ctx.save();
        ctx.strokeStyle = s.color || '#2962ff';
        ctx.lineWidth   = s.width || 1;
        let dashArr = [];
        if (s.lineStyle === 'dashed') dashArr = [8, 5];
        else if (s.lineStyle === 'dotted') dashArr = [3, 3];
        ctx.setLineDash(dashArr);
        if (s.priceLabel) _drawPriceLabel(ctx, d.price, y, pane);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(w, y);
        ctx.stroke();
        ctx.restore();
      } catch(e) { /* render hatası diğer çizimleri etkilemesin */ }
    }

  function _drawCrossLine(ctx, d, pane) {
      try {
        if (d.price == null || !isFinite(d.price)) return;
        if (d.time == null) return;
        const y = pane.series.priceToCoordinate(d.price);
        const x = _timeToX(pane, d.time);
        if (y == null || !isFinite(y) || x == null || !isFinite(x)) return;
        const w = pane.drawingCanvas.width / (window.devicePixelRatio || 1);
        const h = pane.drawingCanvas.height / (window.devicePixelRatio || 1);
        const s = d.style || {};
        ctx.save();
        ctx.strokeStyle = s.color || '#2962ff';
        ctx.lineWidth   = s.width || 1;
        let dashArr = [];
        if (s.lineStyle === 'dashed') dashArr = [8, 5];
        else if (s.lineStyle === 'dotted') dashArr = [3, 3];
        ctx.setLineDash(dashArr);
        ctx.beginPath();
        ctx.moveTo(0, y); ctx.lineTo(w, y);
        ctx.moveTo(x, 0); ctx.lineTo(x, h);
        ctx.stroke();
        ctx.restore();
      } catch(e) { /* render hatası diğer çizimleri etkilemesin */ }
    }

  function _drawArrowHead(ctx, a, b) {
      const headLen = 14; 
      const angle = Math.atan2(b.y - a.y, b.x - a.x);
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x - headLen * Math.cos(angle - Math.PI / 6), b.y - headLen * Math.sin(angle - Math.PI / 6));
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x - headLen * Math.cos(angle + Math.PI / 6), b.y - headLen * Math.sin(angle + Math.PI / 6));
      ctx.stroke();
    }

  function _drawCircleCap(ctx, pt) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#131722';
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

  function _drawRayArrow(ctx, d, pane) {
      const a = _pt2xy(d.p1, pane);
      const b = _pt2xy(d.p2, pane);
      if (!a || !b) return;
      const w = pane.drawingCanvas.width / (window.devicePixelRatio || 1);
      const h = pane.drawingCanvas.height / (window.devicePixelRatio || 1);
      const endPt = _extendToEdge(a.x, a.y, b.x, b.y, w, h);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(endPt.x, endPt.y); ctx.stroke();
      _drawArrowHead(ctx, a, endPt);
    }

  function _drawTrendAngle(ctx, d, pane, selected) {
      _drawTrendLine(ctx, d, pane, selected);
      const a = _pt2xy(d.p1, pane);
      const b = _pt2xy(d.p2, pane);
      if (!a || !b) return;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      if (dx === 0 && dy === 0) return;
      
      const angleRad = Math.atan2(-dy, dx);
      const angleDeg = (angleRad * 180 / Math.PI).toFixed(0);
  
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1;
      const arcRadius = 40;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(a.x + arcRadius + 15, a.y);
      ctx.stroke();
      
      ctx.setLineDash([]);
      ctx.beginPath();
      const startAngle = 0;
      const endAngle = Math.atan2(dy, dx); 
      ctx.arc(a.x, a.y, arcRadius, startAngle, endAngle, dy < 0);
      ctx.stroke();
  
      ctx.fillStyle = ctx.strokeStyle;
      ctx.font = '11px Arial';
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      
      const midAngle = endAngle / 2;
      const tx = a.x + (arcRadius + 5) * Math.cos(midAngle);
      const ty = a.y + (arcRadius + 5) * Math.sin(midAngle);
      ctx.fillText(`${angleDeg}°`, tx, ty);
      ctx.restore();

      if (d.style?.statsOn === true && (selected || !!d.style?.alwaysStats)) {
        _drawTrendStats(ctx, d, pane, a, b);
      }
    }

  function _drawTrendStats(ctx, d, pane, a, b) {
      const s = d.style || {};
      if (s.statsOn !== true) return;
      const ALL_STAT_FIELDS = ['Price range','Percent change','Bars range','Date/time range','Angle'];
      const activeStats = s.statsFields ?? ALL_STAT_FIELDS;
      if (activeStats.length === 0) return;

      const priceDiff = d.p2.price - d.p1.price;
      const pricePct  = d.p1.price ? (priceDiff / d.p1.price) * 100 : 0;
      const angleRad  = Math.atan2(-(b.y - a.y), b.x - a.x);
      const angleDeg  = (angleRad * 180 / Math.PI).toFixed(2);

      let barCount = 0;
      let timeDiffMs = 0;
      const candles = pane.candlesData;
      
      const toSec = t => typeof t === 'object' ? new Date(t.year, t.month - 1, t.day).getTime() / 1000 : t;
      const t1 = toSec(d.p1.time);
      const t2 = toSec(d.p2.time);
      const tMin = Math.min(t1, t2);
      const tMax = Math.max(t1, t2);
      
      timeDiffMs = (tMax - tMin) * 1000;
      
      if (candles && candles.length) {
        barCount = candles.filter(c => { const ct = toSec(c.time); return ct >= tMin && ct <= tMax; }).length - 1; // Başlangıç mumunu sayma
        if (barCount < 0) barCount = 0;
      }
      
      const days = Math.floor(timeDiffMs / (1000 * 60 * 60 * 24));
      const hours = Math.floor((timeDiffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const timeStr = days > 0 ? `${days}d ${hours}h` : `${hours}h`;

      const lines = [];
      const icons = [];
      
      let priceLine = '';
      if (activeStats.includes('Price range')) priceLine += `${_formatPrice(Math.abs(priceDiff))} `;
      if (activeStats.includes('Percent change')) priceLine += `(${pricePct.toFixed(2)}%)`;
      if (priceLine) {
         lines.push(priceLine.trim());
         icons.push('price');
      }

      let barLine = '';
      if (activeStats.includes('Bars range')) barLine += `${barCount} bars `;
      if (activeStats.includes('Date/time range')) barLine += `(${timeStr})`;
      if (barLine) {
         lines.push(barLine.trim());
         icons.push('bars');
      }

      if (activeStats.includes('Angle')) {
         lines.push(`${angleDeg}°`);
         icons.push('angle');
      }

      if (lines.length === 0) return;

      ctx.save();
      ctx.font = '12px "JetBrains Mono", sans-serif';
      
      const padX = 10, padY = 8, lh = 22, iconW = 16;
      let maxTextW = 0;
      lines.forEach(l => { maxTextW = Math.max(maxTextW, ctx.measureText(l).width); });
      
      const boxW = maxTextW + iconW + padX * 3;
      const boxH = lines.length * lh + padY * 2;
      
      const padOffset = 15;
      let bx, by, refY;

      const statsPos = s.statsPos || 'right';

      if (statsPos === 'left') {
         bx = a.x - boxW - padOffset;
         refY = a.y;
      } else if (statsPos === 'center') {
         bx = ((a.x + b.x) / 2) - (boxW / 2);
         refY = (a.y + b.y) / 2;
      } else {
         bx = b.x + padOffset;
         refY = b.y;
      }
      
      if (a.y > b.y) {
         by = refY + padOffset;
      } else {
         by = refY - boxH - padOffset;
      }

      // Arkaplan
      ctx.fillStyle = 'rgba(42, 46, 57, 0.9)'; // Koyu tema arka plan (hafif saydam)
      ctx.strokeStyle = '#363c4e';
      ctx.lineWidth = 1;
      
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(bx, by, boxW, boxH, 6);
      else ctx.rect(bx, by, boxW, boxH);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#d1d4dc';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.strokeStyle = '#d1d4dc';

      lines.forEach((text, i) => {
         const y = by + padY + i * lh + lh/2;
         const x = bx + padX;
         
         ctx.beginPath();
         const type = icons[i];
         if (type === 'price') {
             ctx.moveTo(x + 4, y - 6); ctx.lineTo(x + 4, y + 6);
             ctx.moveTo(x + 1, y - 3); ctx.lineTo(x + 4, y - 6); ctx.lineTo(x + 7, y - 3);
             ctx.moveTo(x + 1, y + 3); ctx.lineTo(x + 4, y + 6); ctx.lineTo(x + 7, y + 3);
             ctx.moveTo(x - 1, y - 8); ctx.lineTo(x + 9, y - 8);
             ctx.moveTo(x - 1, y + 8); ctx.lineTo(x + 9, y + 8);
         } else if (type === 'bars') {
             ctx.moveTo(x, y); ctx.lineTo(x + 12, y);
             ctx.moveTo(x + 3, y - 3); ctx.lineTo(x, y); ctx.lineTo(x + 3, y + 3);
             ctx.moveTo(x + 9, y - 3); ctx.lineTo(x + 12, y); ctx.lineTo(x + 9, y + 3);
             ctx.moveTo(x - 2, y - 5); ctx.lineTo(x - 2, y + 5);
             ctx.moveTo(x + 14, y - 5); ctx.lineTo(x + 14, y + 5);
         } else if (type === 'angle') {
             ctx.moveTo(x + 12, y + 4); ctx.lineTo(x, y + 4); ctx.lineTo(x + 8, y - 6);
             ctx.moveTo(x + 4, y + 4); ctx.arc(x, y + 4, 4, 0, -Math.PI/3, true);
         }
         ctx.stroke();

         ctx.fillText(text, x + iconW + padX, y);
      });

      ctx.restore();
  }

  function _drawTrendLine(ctx, d, pane, selected) {
      const a = _pt2xy(d.p1, pane);
      const b = _pt2xy(d.p2, pane);
      if (!a || !b) return;

      const s = d.style || {};
      const capLeft = s.capLeft || 'normal';
      const capRight = s.capRight || 'normal';
      const midpoint = s.midpoint !== false;
      const priceLabel = s.priceLabel !== false;
      const extendLeft = !!s.extendLeft;
      const extendRight = !!s.extendRight;

      let drawA = a;
      let drawB = b;
      
      if (extendLeft || extendRight) {
        const w = pane.drawingCanvas.width / (window.devicePixelRatio || 1);
        const h = pane.drawingCanvas.height / (window.devicePixelRatio || 1);
        if (extendLeft) drawA = _extendToEdge(b.x, b.y, a.x, a.y, w, h);
        if (extendRight) drawB = _extendToEdge(a.x, a.y, b.x, b.y, w, h);
      }

      ctx.beginPath(); ctx.moveTo(drawA.x, drawA.y); ctx.lineTo(drawB.x, drawB.y); ctx.stroke();
      
      // Arrow / Circle Caps (Her zaman orijinal a ve b noktalarında)
      if (capLeft === 'arrow') {
        _drawArrowHead(ctx, b, a); // b'den a'ya doğru
      }

      if (capRight === 'arrow') {
        _drawArrowHead(ctx, a, b); // a'dan b'ye doğru
      }

      // Midpoint
      if (midpoint) {
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        ctx.save();
        ctx.beginPath();
        ctx.arc(mx, my, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#131722'; // Koyu arkaplan rengi (içi boş görünsün diye)
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }

      // Price Labels (Sağ eksen üzerine başlangıç ve bitiş fiyatlarını yeşil yazdır)
      if (priceLabel) {
        if (d.p1.price != null) _drawPriceLabel(ctx, d.p1.price, a.y, pane);
        if (d.p2.price != null) _drawPriceLabel(ctx, d.p2.price, b.y, pane);
      }
      
      // Text (s.text from settings or inline edit) — drawn parallel to the line
      const trendText = s.text || '';
      const hasText = !!trendText;
      
      const lineAngle = Math.atan2(b.y - a.y, b.x - a.x);
      // Normalize angle so text is never upside-down
      let drawAngle = lineAngle;
      let isFlipped = false;
      if (drawAngle > Math.PI / 2 || drawAngle < -Math.PI / 2) {
        drawAngle += Math.PI;
        isFlipped = true;
      }

      function _drawParallelText(ctx, text, alpha) {
        const textAlignH = s.textAlignH || 'center';
        const textAlignV = s.textAlignV || 'top';

        // 1. Determine anchor point along the line segment
        let anchorX, anchorY;
        if (textAlignH === 'left') {
          // "Left" in trendline context is p1 (start), "Right" is p2 (end)
          anchorX = a.x; anchorY = a.y;
        } else if (textAlignH === 'right') {
          anchorX = b.x; anchorY = b.y;
        } else {
          anchorX = (a.x + b.x) / 2;
          anchorY = (a.y + b.y) / 2;
        }

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(anchorX, anchorY);
        ctx.rotate(drawAngle);

        // 2. Set horizontal alignment
        // If line is flipped (p2 is to the left of p1), we swap left/right alignment 
        // so that "Left" always points towards p1 and "Right" towards p2.
        let canvasAlign = 'center';
        if (textAlignH === 'left')  canvasAlign = isFlipped ? 'right' : 'left';
        if (textAlignH === 'right') canvasAlign = isFlipped ? 'left'  : 'right';
        if (textAlignH === 'center') canvasAlign = 'center';
        ctx.textAlign = canvasAlign;

        // 3. Set vertical alignment (Above, Middle, Below the line)
        // Offset the text vertically from the anchor
        const offsetDist = 6; 
        let yOffset = 0;
        if (textAlignV === 'top') {
          yOffset = -offsetDist;
          ctx.textBaseline = 'bottom';
        } else if (textAlignV === 'bottom') {
          yOffset = offsetDist;
          ctx.textBaseline = 'top';
        } else {
          yOffset = 0;
          ctx.textBaseline = 'middle';
        }

        const xShift = (canvasAlign === 'left') ? 4 : (canvasAlign === 'right') ? -4 : 0;
        ctx.fillText(text, xShift, yOffset);
        ctx.restore();
      }

      if (hasText) {
        ctx.save();
        ctx.font = `${s.italic ? 'italic ' : ''}${s.bold ? 'bold ' : ''}${s.fontSize || 13}px "JetBrains Mono", sans-serif`;
        ctx.fillStyle = s.textColor || '#d1d4dc';
        _drawParallelText(ctx, trendText, 1);
        ctx.restore();
      }

      // "Add Text" hint — shown when selected but no text yet (not for trendangle)
      if (selected && !hasText && d.tool !== 'trendangle') {
        ctx.save();
        ctx.font = '12px "JetBrains Mono", sans-serif';
        ctx.fillStyle = '#d1d4dc';
        _drawParallelText(ctx, 'Add Text', 0.35);
        ctx.restore();
      }

      // Hint alanı koordinatlarını her zaman yaz (text varsa da beam cursor çalışsın)
      if (selected && d.tool !== 'trendangle') {
        const textAlignH = s.textAlignH || 'center';
        let hcx, hcy;
        if (textAlignH === 'left')       { hcx = a.x; hcy = a.y; }
        else if (textAlignH === 'right') { hcx = b.x; hcy = b.y; }
        else                             { hcx = (a.x + b.x) / 2; hcy = (a.y + b.y) / 2; }

        if (!window._trendTextHintAreas) window._trendTextHintAreas = {};
        ctx.save();
        ctx.font = '12px "JetBrains Mono", sans-serif';
        const hintTextW = ctx.measureText(hasText ? trendText : 'Add Text').width;
        ctx.restore();
        window._trendTextHintAreas[d.id] = { cx: hcx, cy: hcy, hw: hintTextW / 2 + 4, hh: 8, angle: lineAngle };
      } else {
        if (window._trendTextHintAreas) delete window._trendTextHintAreas[d.id];
      }

      if (s.statsOn === true && (selected || !!s.alwaysStats)) {
        _drawTrendStats(ctx, d, pane, a, b);
      }
    }

  function _drawRay(ctx, d, pane, selected) {
      d.style = d.style || {};
      if (d.style.extendRight === undefined) d.style.extendRight = true;
      if (d.style.extendLeft  === undefined) d.style.extendLeft  = false;
      d.style.extendRight = true;   // Ray her zaman sağa uzar — override
      d.style.extendLeft  = false;  // Ray hiçbir zaman sola uzamaz — override
      _drawTrendLine(ctx, d, pane, selected);
  }

  function _drawExtended(ctx, d, pane, selected) {
      d.style = d.style || {};
      if (d.style.extendRight === undefined) d.style.extendRight = true;
      if (d.style.extendLeft  === undefined) d.style.extendLeft  = true;
      _drawTrendLine(ctx, d, pane, selected);
  }

  function _drawChannel(ctx, d, pane) {
      const a = _pt2xy(d.p1, pane);
      const b = _pt2xy(d.p2, pane);
      if (!a || !b) return;
      ctx.strokeStyle = d.style?.color || '#0969da';
      ctx.lineWidth = d.style?.width || 1;
      let dashArr = d.style?.dash || [];
      if (d.style?.lineStyle === 'dashed') dashArr = [8,5];
      if (d.style?.lineStyle === 'dotted') dashArr = [3,3];
      ctx.setLineDash(dashArr);
      
      const offset = d.channelOffset || 40;
      
      // Fill
      ctx.globalAlpha = 1;
      ctx.fillStyle = d.style?.fillColor || 'rgba(9, 105, 218, 0.2)';
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineTo(b.x, b.y + offset);
      ctx.lineTo(a.x, a.y + offset);
      ctx.closePath();
      ctx.fill();
  
      // Borders
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(a.x, a.y + offset); ctx.lineTo(b.x, b.y + offset); ctx.stroke();
      ctx.setLineDash([]);
    }

  function _drawInfoLine(ctx, d, pane, selected) {
      d.style = d.style || {};
      if (d.style.statsOn === undefined) d.style.statsOn = true;
      if (d.style.alwaysStats === undefined) d.style.alwaysStats = true;
      _drawTrendLine(ctx, d, pane, selected);
    }

  function _drawFlatTopBottom(ctx, d, pane) {
      const a = _pt2xy(d.p1, pane);
      const b = _pt2xy(d.p2, pane);
      if (!a || !b) return;
      const W = pane.drawingCanvas.width / (window.devicePixelRatio || 1);
      const color = d.style?.color || '#2962ff';
  
      // Main slanted line
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  
      // Flat band: horizontal at the "opposite" endpoint price
      const flatPrice = d.p2.price > d.p1.price ? d.p1.price : d.p2.price;
      const flatY = pane.series.priceToCoordinate(flatPrice);
      if (flatY === null) return;
  
      const leftX  = Math.min(a.x, b.x);
      const rightX = Math.max(a.x, b.x);
  
      ctx.save();
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(leftX, flatY); ctx.lineTo(rightX, flatY);
      ctx.stroke();
      ctx.setLineDash([]);
  
      // Thin fill between slant and flat side
      ctx.globalAlpha = 0.07;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
      ctx.lineTo(rightX, flatY); ctx.lineTo(leftX, flatY);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }

  function _drawRegressionTrend(ctx, d, pane) {
      const a = _pt2xy(d.p1, pane);
      const b = _pt2xy(d.p2, pane);
      if (!a || !b) return;
  
      const candles = pane.candlesData;
      if (!candles || candles.length === 0) {
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        return;
      }
  
      const toSec = t => typeof t === 'object'
        ? new Date(t.year, t.month - 1, t.day).getTime() / 1000 : t;
      const tMin = Math.min(toSec(d.p1.time), toSec(d.p2.time));
      const tMax = Math.max(toSec(d.p1.time), toSec(d.p2.time));
      const inRange = candles.filter(c => { const ct = toSec(c.time); return ct >= tMin && ct <= tMax; });
  
      if (inRange.length < 2) {
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        return;
      }
  
      const n = inRange.length;
      let sx = 0, sy = 0, sxy = 0, sx2 = 0;
      inRange.forEach((c, i) => { sx += i; sy += c.close; sxy += i * c.close; sx2 += i * i; });
      const slope     = (n * sxy - sx * sy) / (n * sx2 - sx * sx);
      const intercept = (sy - slope * sx) / n;
  
      let sqDev = 0;
      inRange.forEach((c, i) => { const r = slope * i + intercept; sqDev += (c.close - r) ** 2; });
      const stdDev = Math.sqrt(sqDev / n);
  
      const startX = Math.min(a.x, b.x);
      const endX   = Math.max(a.x, b.x);
      const spanX  = endX - startX || 1;
  
      const drawBand = (stdMult) => {
        ctx.beginPath();
        let first = true;
        for (let px = startX; px <= endX; px += 1) {
          const idx   = ((px - startX) / spanX) * (n - 1);
          const price = slope * idx + intercept + stdMult * stdDev;
          const py    = pane.series.priceToCoordinate(price);
          if (py === null) { first = true; continue; }
          first ? (ctx.moveTo(px, py), first = false) : ctx.lineTo(px, py);
        }
        ctx.stroke();
      };
  
      // Centre line (solid, already set by caller)
      drawBand(0);
  
      // ±1 std-dev bands (dashed, slightly transparent)
      ctx.save();
      ctx.setLineDash([5, 4]);
      ctx.globalAlpha = ((d.style?.opacity ?? 100) / 100) * 0.75;
      drawBand(1);
      drawBand(-1);
      ctx.restore();
    }

  function _drawPitchfork(ctx, d, pane, type) {
      if (!d.p1 || !d.p2) return;
      const p1 = _pt2xy(d.p1, pane);
      const p2 = _pt2xy(d.p2, pane);
      if (!p1 || !p2) return;
      if (!d.p3) {
        ctx.save();
        ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y);
        ctx.strokeStyle = '#787b86'; ctx.lineWidth = 1; ctx.setLineDash([5, 5]); ctx.stroke();
        ctx.restore();
        return;
      }
      const p3 = _pt2xy(d.p3, pane);
      if (!p3) return;
  
      const W = pane.drawingCanvas.width / (window.devicePixelRatio || 1);
      const H = pane.drawingCanvas.height / (window.devicePixelRatio || 1);
  
      // Calculate origins based on pitchfork type
      let originX = p1.x, originY = p1.y;
      const midX = (p2.x + p3.x) / 2;
      const midY = (p2.y + p3.y) / 2;
  
      if (type === 'schiff') {
        originX = (p1.x + p2.x) / 2;
        originY = (p1.y + p2.y) / 2;
      } else if (type === 'modschiff') {
        originX = (p1.x + midX) / 2;
        originY = (p1.y + midY) / 2;
      } else if (type === 'inside') {
        originX = midX;
        originY = midY;
        // p2 and p3 become the median vectors instead of outer limits
      }
  
      // Median line extending from origin through midpoint
      const medianEnd = _extendToEdge(originX, originY, midX, midY, W, H);
      
      ctx.save();
      
      // Draw base line connecting p2 and p3
      ctx.beginPath();
      ctx.moveTo(p2.x, p2.y);
      ctx.lineTo(p3.x, p3.y);
      ctx.stroke();
  
      // Draw median line
      ctx.beginPath();
      ctx.moveTo(originX, originY);
      ctx.lineTo(medianEnd.x, medianEnd.y);
      ctx.stroke();
  
      // Vector for parallel lines
      const dx = midX - originX;
      const dy = midY - originY;
  
      // Extend p2 parallel to median
      const p2End = _extendToEdge(p2.x, p2.y, p2.x + dx, p2.y + dy, W, H);
      ctx.beginPath();
      ctx.moveTo(p2.x, p2.y);
      ctx.lineTo(p2End.x, p2End.y);
      ctx.stroke();
  
      // Extend p3 parallel to median
      const p3End = _extendToEdge(p3.x, p3.y, p3.x + dx, p3.y + dy, W, H);
      ctx.beginPath();
      ctx.moveTo(p3.x, p3.y);
      ctx.lineTo(p3End.x, p3End.y);
      ctx.stroke();
      
      // Background Fill
      ctx.globalAlpha = 0.1;
      ctx.beginPath();
      ctx.moveTo(p2.x, p2.y);
      ctx.lineTo(p2End.x, p2End.y);
      ctx.lineTo(p3End.x, p3End.y);
      ctx.lineTo(p3.x, p3.y);
      ctx.closePath();
      ctx.fill();
  
      ctx.restore();
    }

  function _drawDisjointChannel() {}


  return {
    drawHLine: _drawHLine,
    drawVLine: _drawVLine,
    drawHRay: _drawHRay,
    drawCrossLine: _drawCrossLine,
    drawTrendAngle: _drawTrendAngle,
    drawTrendLine: _drawTrendLine,
    drawRay: _drawRay,
    drawExtended: _drawExtended,
    drawChannel: _drawChannel,
    drawInfoLine: _drawInfoLine,
    drawFlatTopBottom: _drawFlatTopBottom,
    drawRegressionTrend: _drawRegressionTrend,
    drawPitchfork: _drawPitchfork,
    drawDisjointChannel: _drawDisjointChannel
  };
})();