/**
 * PinTrade V2.4 - Drawing Fibonacci and Gann Tools Module
 * 
 * Handles the rendering of all tools in the "Gann and Fibonacci Tools" group.
 */

window.DrawingFibo = (() => {

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

  // Common Fib Levels helper - extracted from core if needed or replicated here
  function _getFibLevels(styleObj) {
    // Standard default levels if none provided
    const defaults = [
      { v: 0, color: '#787b86' },
      { v: 0.236, color: '#f44336' },
      { v: 0.382, color: '#81c784' },
      { v: 0.5, color: '#4caf50' },
      { v: 0.618, color: '#009688' },
      { v: 0.786, color: '#64b5f6' },
      { v: 1, color: '#787b86' }
    ];
    if (styleObj && styleObj.levels && Array.isArray(styleObj.levels)) {
      return styleObj.levels;
    }
    return defaults;
  }

  function _drawFibRet(ctx, d, pane) {
      if (!d.p1 || !d.p2) return;
      const p1 = _pt2xy(d.p1, pane);
      const p2 = _pt2xy(d.p2, pane);
      if (!p1 || !p2) return;
  
      const s = d.style || {};
  
      // ── Default levels ───────────────────────────────────────────
      const allLevels = _getFibLevels(s);
      const activeLevels = allLevels.filter(l => l.active !== false);
      // Sort by value
      const sorted = [...activeLevels].sort((a, b) => a.v - b.v);
      const reverse = !!s.fibReverse;
  
      const extendLeft  = !!s.extendLeft;
      const extendRight = !!s.extendRight;
      const W = pane.drawingCanvas.width  / (window.devicePixelRatio || 1);
      const H = pane.drawingCanvas.height / (window.devicePixelRatio || 1);
      const leftX  = extendLeft  ? 0 : Math.min(p1.x, p2.x);
      const rightX = extendRight ? W : Math.max(p1.x, p2.x);
  
      const yDiff = p2.y - p1.y;
      const priceDiff = d.p2.price - d.p1.price;
  
      const fibBg    = s.fibBg !== false;
      const bgAlpha  = s.fibBgAlpha !== undefined ? s.fibBgAlpha : 0.2;
      const fontSize = s.fibFontSize || 11;
      const labelsH  = s.fibLabelsH  || 'Left';
      const labelsV  = s.fibLabelsV  || 'Middle';
      const showPrices = s.fibPrices !== false;
      const levelMode  = s.fibLevelsMode || 'Values'; // 'Values' | 'Percents'
      const showLabels = s.fibLevelsType !== false;
  
      // ── Draw trend line (p1 → p2) ─────────────────────────────
      ctx.save();
      ctx.strokeStyle = s.trendLineActive !== false ? (s.trendLineColor || s.color || '#787b86') : 'transparent';
      ctx.lineWidth   = s.trendLineWidth || s.width || 1;
      const tlStyle   = s.trendLineStyle || 'dashed';
      ctx.setLineDash(tlStyle === 'dashed' ? [6, 4] : tlStyle === 'dotted' ? [2, 3] : []);
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
      ctx.restore();
  
      const effP1Y = reverse ? p2.y : p1.y;
      const effYDiff = reverse ? -yDiff : yDiff;
      const effP1Price = reverse ? d.p2.price : d.p1.price;
      const effPriceDiff = reverse ? -priceDiff : priceDiff;
  
      // ── Draw backgrounds between adjacent active levels ───────
      if (fibBg && sorted.length > 1) {
        ctx.save();
        for (let i = 1; i < sorted.length; i++) {
          const prevY = effP1Y + effYDiff * sorted[i-1].v;
          const thisY = effP1Y + effYDiff * sorted[i].v;
          ctx.fillStyle = (s.useOneColor && s.useOneColor !== false ? s.useOneColor : sorted[i].color) || '#4caf50';
          ctx.globalAlpha = bgAlpha;
          ctx.fillRect(leftX, Math.min(prevY, thisY), rightX - leftX, Math.abs(thisY - prevY));
        }
        ctx.restore();
      }
  
      // ── Level line style ─────────────────────────────────────
      const lvlWidth = s.levelsWidth || s.width || 1;
      const lvlStyle = s.levelsStyle || 'solid';
      const lvlDash  = Array.isArray(s.levelsDash) ? s.levelsDash
                     : lvlStyle === 'dashed' ? [8, 5]
                     : lvlStyle === 'dotted' ? [3, 3] : [];
  
      // ── Label alignment helpers ───────────────────────────────
      const textX = labelsH === 'Right' ? rightX - 4 : labelsH === 'Center' ? (leftX + rightX) / 2 : leftX + 4;
      const textAlign = labelsH === 'Right' ? 'right' : labelsH === 'Center' ? 'center' : 'left';
  
      ctx.save();
      ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, "Trebuchet MS", Roboto, Ubuntu, sans-serif`;
  
      // ── Draw each active level ────────────────────────────────
      for (const lvl of sorted) {
        const ly = effP1Y + effYDiff * lvl.v;
        if (ly < -20 || ly > H + 20) continue; // clip
  
        // Horizontal level line
        ctx.strokeStyle = (s.useOneColor && s.useOneColor !== false ? s.useOneColor : lvl.color) || '#787b86';
        ctx.lineWidth   = lvlWidth;
        ctx.setLineDash(lvlDash);
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.moveTo(leftX, ly);
        ctx.lineTo(rightX, ly);
        ctx.stroke();
  
        // Label
        if (showLabels || showPrices) {
          ctx.setLineDash([]);
          ctx.fillStyle = (s.useOneColor && s.useOneColor !== false ? s.useOneColor : lvl.color) || '#787b86';
          ctx.textAlign = textAlign;
  
          const valStr   = showLabels ? (levelMode === 'Percents' ? `${(lvl.v * 100).toFixed(1)}%` : lvl.v.toFixed(3)) : '';
          const priceAt  = effP1Price + effPriceDiff * lvl.v;
          const priceStr = showPrices ? (showLabels ? ` (${priceAt.toFixed(2)})` : priceAt.toFixed(2)) : '';
          const label    = valStr + priceStr;
  
          const textY = labelsV === 'Top'    ? ly - 3
                      : labelsV === 'Bottom' ? ly + fontSize + 2
                      :                        ly - 2; // Middle (baseline above line)
          ctx.textBaseline = labelsV === 'Bottom' ? 'top' : 'bottom';
          ctx.fillText(label, textX, textY);
        }
      }
      ctx.restore();
    }

  function _drawFibExt(ctx, d, pane) {
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
  
      const s = d.style || {};
      const allLevels = _getFibLevels(s);
      const activeLevels = allLevels.filter(l => l.active !== false);
      const sorted = [...activeLevels].sort((a, b) => a.v - b.v);
      const reverse = !!s.fibReverse;
  
      const extendLeft  = !!s.extendLeft;
      const extendRight = !!s.extendRight;
      const showLabels = s.fibLevelsType !== false;
      const showPrices = s.fibPrices !== false;
      const levelMode  = s.fibLevelsType === 'Percents' ? 'Percents' : 'Values';
      const fibBg    = s.fibBg !== false;
      const bgAlpha  = s.fibBgAlpha !== undefined ? s.fibBgAlpha : 0.2;
      const fontSize = s.fibFontSize || 11;
      const labelsH  = s.fibLabelsH  || 'Left';
      const labelsV  = s.fibLabelsV  || 'Middle';
      const W = pane.drawingCanvas.width / (window.devicePixelRatio || 1);
      const H = pane.drawingCanvas.height / (window.devicePixelRatio || 1);
      const leftX  = extendLeft ? 0 : Math.min(p1.x, p2.x, p3.x);
      const rightX = extendRight ? W : Math.max(p1.x, p2.x, p3.x) + 150;
  
      // Base lines
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.lineTo(p3.x, p3.y);
      ctx.strokeStyle = s.trendColor || '#787b86';
      ctx.lineWidth = s.trendWidth || 1;
      ctx.setLineDash(s.trendStyle === 'dashed' ? [5,5] : s.trendStyle === 'dotted' ? [2,2] : [4, 4]);
      ctx.stroke();
  
      const yDiff = p2.y - p1.y;
      const priceDiff = d.p2.price - d.p1.price;
      const effP3Y = reverse ? p3.y + yDiff : p3.y;
      const effYDiff = reverse ? -yDiff : yDiff;
      const effP3Price = reverse ? d.p3.price + priceDiff : d.p3.price;
      const effPriceDiff = reverse ? -priceDiff : priceDiff;
  
      if (fibBg && sorted.length > 1) {
        for (let i = 1; i < sorted.length; i++) {
          const prevY = effP3Y + effYDiff * sorted[i-1].v;
          const thisY = effP3Y + effYDiff * sorted[i].v;
          ctx.fillStyle = (s.useOneColor && s.useOneColor !== false ? s.useOneColor : sorted[i].color) || '#4caf50';
          ctx.globalAlpha = bgAlpha;
          ctx.fillRect(leftX, Math.min(prevY, thisY), rightX - leftX, Math.abs(thisY - prevY));
        }
      }
  
      const lvlWidth = s.levelsWidth || s.width || 1;
      const lvlStyle = s.levelsStyle || 'solid';
      const lvlDash  = Array.isArray(s.levelsDash) ? s.levelsDash : lvlStyle === 'dashed' ? [8, 5] : lvlStyle === 'dotted' ? [3, 3] : [];
      const textX = labelsH === 'Right' ? rightX - 4 : labelsH === 'Center' ? (leftX + rightX) / 2 : leftX + 4;
      const textAlign = labelsH === 'Right' ? 'right' : labelsH === 'Center' ? 'center' : 'left';
      ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, "Trebuchet MS", Roboto, Ubuntu, sans-serif`;
  
      for (const lvl of sorted) {
        const ly = effP3Y + effYDiff * lvl.v;
        if (ly < -20 || ly > H + 20) continue;
  
        ctx.strokeStyle = (s.useOneColor && s.useOneColor !== false ? s.useOneColor : lvl.color) || '#787b86';
        ctx.lineWidth   = lvlWidth;
        ctx.setLineDash(lvlDash);
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.moveTo(leftX, ly);
        ctx.lineTo(rightX, ly);
        ctx.stroke();
  
        if (showLabels || showPrices) {
          ctx.setLineDash([]);
          ctx.fillStyle = (s.useOneColor && s.useOneColor !== false ? s.useOneColor : lvl.color) || '#787b86';
          ctx.textAlign = textAlign;
          const valStr   = showLabels ? (levelMode === 'Percents' ? `${(lvl.v * 100).toFixed(1)}%` : lvl.v.toFixed(3)) : '';
          const priceAt  = effP3Price + effPriceDiff * lvl.v;
          const priceStr = showPrices ? (showLabels ? ` (${priceAt.toFixed(2)})` : priceAt.toFixed(2)) : '';
          const label    = valStr + priceStr;
          const textY = labelsV === 'Top' ? ly - 3 : labelsV === 'Bottom' ? ly + fontSize + 2 : ly - 2;
          ctx.textBaseline = labelsV === 'Bottom' ? 'top' : 'bottom';
          ctx.fillText(label, textX, textY);
        }
      }
      ctx.restore();
    }

  function _drawFibChannel(ctx, d, pane) {
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
  
      const s = d.style || {};
      const allLevels = _getFibLevels(s);
      const activeLevels = allLevels.filter(l => l.active !== false);
      const sorted = [...activeLevels].sort((a, b) => a.v - b.v);
      const reverse = !!s.fibReverse;
  
      const extendLeft  = !!s.extendLeft;
      const extendRight = !!s.extendRight;
      const fibBg    = s.fibBg !== false;
      const bgAlpha  = s.fibBgAlpha !== undefined ? s.fibBgAlpha : 0.2;
  
      ctx.save();
      
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
  
      // Vector from line(p1,p2) to p3
      // We treat p1 as origin for projection
      const px3 = p3.x - p1.x;
      const py3 = p3.y - p1.y;
  
      const effPx3 = reverse ? -px3 : px3;
      const effPy3 = reverse ? -py3 : py3;
  
      if (fibBg && sorted.length > 1) {
        for (let i = 1; i < sorted.length; i++) {
          const v1 = sorted[i-1].v;
          const v2 = sorted[i].v;
          ctx.fillStyle = (s.useOneColor && s.useOneColor !== false ? s.useOneColor : sorted[i].color) || '#4caf50';
          ctx.globalAlpha = bgAlpha;
          ctx.beginPath();
          ctx.moveTo(p1.x + effPx3*v1, p1.y + effPy3*v1);
          ctx.lineTo(p2.x + effPx3*v1, p2.y + effPy3*v1);
          ctx.lineTo(p2.x + effPx3*v2, p2.y + effPy3*v2);
          ctx.lineTo(p1.x + effPx3*v2, p1.y + effPy3*v2);
          ctx.closePath();
          ctx.fill();
        }
      }
  
      const lvlWidth = s.levelsWidth || s.width || 1;
      const lvlStyle = s.levelsStyle || 'solid';
      const lvlDash  = Array.isArray(s.levelsDash) ? s.levelsDash : lvlStyle === 'dashed' ? [8, 5] : lvlStyle === 'dotted' ? [3, 3] : [];
  
      for (const lvl of sorted) {
        const lx1 = p1.x + effPx3*lvl.v;
        const ly1 = p1.y + effPy3*lvl.v;
        const lx2 = p2.x + effPx3*lvl.v;
        const ly2 = p2.y + effPy3*lvl.v;
  
        ctx.globalAlpha = 1;
        ctx.strokeStyle = (s.useOneColor && s.useOneColor !== false ? s.useOneColor : lvl.color) || '#787b86';
        ctx.lineWidth = lvlWidth;
        ctx.setLineDash(lvlDash);
        ctx.beginPath();
        ctx.moveTo(lx1, ly1);
        ctx.lineTo(lx2, ly2);
        ctx.stroke();
  
        const showLabels = s.fibLabels !== false;
        if (showLabels) {
          ctx.setLineDash([]);
          ctx.fillStyle = (s.useOneColor && s.useOneColor !== false ? s.useOneColor : lvl.color) || '#787b86';
          const fontSize = s.fontSize || 12;
          ctx.font = `${fontSize}px 'JetBrains Mono', sans-serif`;
          const labelsPos = s.fibLabelsPos || 'Left';
          const labelsV = s.fibLabelsV || 'Bottom';
          
          ctx.textAlign = labelsPos === 'Right' ? 'right' : 'left';
          ctx.textBaseline = labelsV === 'Top' ? 'top' : labelsV === 'Middle' ? 'middle' : 'bottom';
          
          const valStr = s.fibLevelsType === 'Percents' ? `${Math.round(lvl.v * 100)}%` : lvl.v.toString();
          const textX = labelsPos === 'Right' ? lx2 : lx1;
          const textY = labelsV === 'Top' ? (labelsPos === 'Right' ? ly2 + 4 : ly1 + 4) : 
                        labelsV === 'Middle' ? (labelsPos === 'Right' ? ly2 : ly1) : 
                        (labelsPos === 'Right' ? ly2 - 2 : ly1 - 2);
                        
          ctx.fillText(valStr, textX, textY);
        }
      }
      
      ctx.restore();
    }

  function _drawFibTimezone(ctx, d, pane) {
      if (!d.p1 || !d.p2) return;
      const p1 = _pt2xy(d.p1, pane);
      const p2 = _pt2xy(d.p2, pane);
      if (!p1 || !p2) return;
  
      const s = d.style || {};
      const allLevels = _getFibLevels(s);
      const activeLevels = allLevels.filter(l => l.active !== false);
      const sorted = [...activeLevels].sort((a, b) => a.v - b.v);
      const reverse = !!s.fibReverse;
  
      const showLabels = s.fibLevelsType !== false;
      const levelMode  = s.fibLevelsType === 'Percents' ? 'Percents' : 'Values';
      const fibBg    = s.fibBg !== false;
      const bgAlpha  = s.fibBgAlpha !== undefined ? s.fibBgAlpha : 0.2;
      const fontSize = s.fibFontSize || 11;
      const labelsH  = s.fibLabelsH  || 'Left';
      const labelsV  = s.fibLabelsV  || 'Middle';
  
      const H = pane.drawingCanvas.height / (window.devicePixelRatio || 1);
      const yTop = 0;
      const yBottom = H;
  
      const dx = p2.x - p1.x;
      const effP1X = reverse ? p2.x : p1.x;
      const effDX = reverse ? -dx : dx;
      
      ctx.save();
      
      if (fibBg && sorted.length > 1) {
        for (let i = 1; i < sorted.length; i++) {
          const prevX = effP1X + effDX * sorted[i-1].v;
          const thisX = effP1X + effDX * sorted[i].v;
          ctx.fillStyle = (s.useOneColor && s.useOneColor !== false ? s.useOneColor : sorted[i].color) || '#4caf50';
          ctx.globalAlpha = bgAlpha;
          ctx.fillRect(Math.min(prevX, thisX), yTop, Math.abs(thisX - prevX), H);
        }
      }
  
      const lvlWidth = s.levelsWidth || s.width || 1;
      const lvlStyle = s.levelsStyle || 'solid';
      const lvlDash  = Array.isArray(s.levelsDash) ? s.levelsDash : lvlStyle === 'dashed' ? [8, 5] : lvlStyle === 'dotted' ? [3, 3] : [];
      ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, "Trebuchet MS", Roboto, Ubuntu, sans-serif`;
      
      for (const lvl of sorted) {
         const x = effP1X + effDX * lvl.v;
         
         ctx.globalAlpha = 1;
         ctx.strokeStyle = (s.useOneColor && s.useOneColor !== false ? s.useOneColor : lvl.color) || '#787b86';
         ctx.lineWidth = lvlWidth;
         ctx.setLineDash(lvlDash);
         ctx.beginPath();
         ctx.moveTo(x, yTop);
         ctx.lineTo(x, yBottom);
         ctx.stroke();
         
         if (showLabels) {
            ctx.setLineDash([]);
            ctx.fillStyle = (s.useOneColor && s.useOneColor !== false ? s.useOneColor : lvl.color) || '#787b86';
            const valStr = levelMode === 'Percents' ? `${(lvl.v * 100).toFixed(1)}%` : lvl.v.toFixed(3);
            
            ctx.textAlign = labelsH === 'Right' ? 'left' : labelsH === 'Center' ? 'center' : 'right';
            const textX = labelsH === 'Right' ? x + 4 : labelsH === 'Center' ? x : x - 4;
            const textY = labelsV === 'Top' ? yTop + fontSize + 4 : labelsV === 'Bottom' ? yBottom - 4 : (yTop + yBottom) / 2;
            ctx.textBaseline = labelsV === 'Bottom' ? 'bottom' : labelsV === 'Top' ? 'top' : 'middle';
            
            ctx.fillText(valStr, textX, textY);
         }
      }
      ctx.restore();
    }

  function _drawFibSpeedfan(ctx, d, pane) {
      if (!d.p1 || !d.p2) return;
      const p1 = _pt2xy(d.p1, pane);
      const p2 = _pt2xy(d.p2, pane);
      if (!p1 || !p2) return;
  
      const s = d.style || {};
      let priceLevels = s.priceLevels;
      let timeLevels = s.timeLevels;
      if (!priceLevels) {
        const allLevels = _getFibLevels(s);
        priceLevels = allLevels.slice(0, 7);
        timeLevels = allLevels.slice(0, 7);
      }
      const actPrice = priceLevels.filter(l => l && l.active !== false).sort((a,b)=>a.v-b.v);
      const actTime = timeLevels.filter(l => l && l.active !== false).sort((a,b)=>a.v-b.v);
      
      const reverse = !!s.fibReverse;
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const effP1Y = reverse ? p2.y : p1.y;
      const effDY = reverse ? -dy : dy;
  
      const showGrid = s.gridActive !== false;
      const w = pane.drawingCanvas.width / (window.devicePixelRatio || 1);
      const h = pane.drawingCanvas.height / (window.devicePixelRatio || 1);
  
      ctx.save();
      
      // Background fill
      const fibBg = s.fibBg !== false;
      const bgAlpha = s.fibBgAlpha !== undefined ? s.fibBgAlpha : 0.2;
      const bgColor = s.fibBgColor || '#2962ff';
  
      if (fibBg && actPrice.length > 1) {
        ctx.save();
        ctx.globalAlpha = bgAlpha;
        for (let i = 1; i < actPrice.length; i++) {
          const yPrev = effP1Y + effDY * actPrice[i-1].v;
          const yCur  = effP1Y + effDY * actPrice[i].v;
          ctx.fillStyle = s.useOneColor && s.useOneColor !== false ? s.useOneColor : actPrice[i].color || bgColor;
          ctx.fillRect(p1.x, Math.min(yPrev, yCur), w - p1.x, Math.abs(yCur - yPrev));
        }
        ctx.restore();
      }
      
      if (showGrid) {
         ctx.globalAlpha = 1;
         ctx.strokeStyle = s.gridColor || '#363c4e';
         const gridStyle = s.gridStyle || 'dashed';
         ctx.setLineDash(gridStyle === 'dashed' ? [8,5] : gridStyle === 'dotted' ? [3,3] : []);
         ctx.lineWidth = s.gridWidth || 1;
         for (const lvl of actPrice) {
            if (lvl.v === 0) continue;
            ctx.beginPath();
            ctx.moveTo(p1.x, effP1Y + effDY * lvl.v);
            ctx.lineTo(p2.x, effP1Y + effDY * lvl.v);
            ctx.stroke();
         }
         for (const lvl of actTime) {
            if (lvl.v === 0) continue;
            ctx.beginPath();
            ctx.moveTo(p1.x + dx * lvl.v, effP1Y);
            ctx.lineTo(p1.x + dx * lvl.v, p2.y);
            ctx.stroke();
         }
      }
      
      ctx.globalAlpha = 1;
      for (const lvl of actPrice) {
        ctx.strokeStyle = (s.useOneColor && s.useOneColor !== false ? s.useOneColor : lvl.color) || '#787b86';
        ctx.lineWidth = lvl.width || 1;
        const st = lvl.style || 'solid';
        ctx.setLineDash(st === 'dashed' ? [8,5] : st === 'dotted' ? [3,3] : []);
        
        let pricePoint = { x: p2.x, y: effP1Y + effDY * lvl.v };
        let extPrice = _extendToEdge(p1.x, effP1Y, pricePoint.x, pricePoint.y, w, h);
        ctx.beginPath();
        ctx.moveTo(p1.x, effP1Y);
        ctx.lineTo(extPrice.x, extPrice.y);
        ctx.stroke();
      }
      
      for (const lvl of actTime) {
        if (lvl.v === 0) continue;
        ctx.strokeStyle = (s.useOneColor && s.useOneColor !== false ? s.useOneColor : lvl.color) || '#787b86';
        ctx.lineWidth = lvl.width || 1;
        const st = lvl.style || 'solid';
        ctx.setLineDash(st === 'dashed' ? [8,5] : st === 'dotted' ? [3,3] : []);
  
        let timePoint = { x: p1.x + dx * lvl.v, y: p2.y };
        let extTime = _extendToEdge(p1.x, effP1Y, timePoint.x, timePoint.y, w, h);
        ctx.beginPath();
        ctx.moveTo(p1.x, effP1Y);
        ctx.lineTo(extTime.x, extTime.y);
        ctx.stroke();
      }
      
      ctx.globalAlpha = 1;
      ctx.setLineDash([]);
      ctx.font = `${s.fibFontSize || 11}px -apple-system, BlinkMacSystemFont, "Trebuchet MS", Roboto, Ubuntu, sans-serif`;
      
      const showLL = s.labelsLeft !== false;
      const showLR = s.labelsRight === true;
      for (const lvl of actPrice) {
        ctx.fillStyle = (s.useOneColor && s.useOneColor !== false ? s.useOneColor : lvl.color) || '#787b86';
        const valStr = lvl.v.toString();
        if (showLL) {
           ctx.textAlign = 'right';
           ctx.textBaseline = 'bottom';
           ctx.fillText(valStr, p1.x - 4, effP1Y + effDY * lvl.v - 2);
        }
        if (showLR) {
           ctx.textAlign = 'left';
           ctx.textBaseline = 'bottom';
           ctx.fillText(valStr, p2.x + 4, effP1Y + effDY * lvl.v - 2);
        }
      }
      
      const showLT = s.labelsTop === true;
      const showLB = s.labelsBottom !== false;
      for (const lvl of actTime) {
        if (lvl.v === 0) continue;
        ctx.fillStyle = (s.useOneColor && s.useOneColor !== false ? s.useOneColor : lvl.color) || '#787b86';
        const valStr = lvl.v.toString();
        if (showLB) {
           ctx.textAlign = 'left';
           ctx.textBaseline = 'top';
           ctx.fillText(valStr, p1.x + dx * lvl.v + 4, p2.y + 4);
        }
        if (showLT) {
           ctx.textAlign = 'left';
           ctx.textBaseline = 'bottom';
           ctx.fillText(valStr, p1.x + dx * lvl.v + 4, effP1Y - 4);
        }
      }
      
      ctx.restore();
    }

  function _drawFibTimebased(ctx, d, pane) {
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
  
      const s = d.style || {};
      const allLevels = _getFibLevels(s);
      const activeLevels = allLevels.filter(l => l.active !== false);
      const sorted = [...activeLevels].sort((a, b) => a.v - b.v);
      
      // p1 to p2 is the base length for X axis
      const dx = p2.x - p1.x; // base time distance
      
      const showLabels = s.fibLabels !== false;
      const labelsH  = s.fibLabelsH  || 'Right';
      const labelsV  = s.fibLabelsV  || 'Bottom';
      
      const H = pane.drawingCanvas.height / (window.devicePixelRatio || 1);
      const yTop = 0;
      const yBottom = H;
  
      const fibBg = s.fibBg !== false;
      const bgAlpha = s.fibBgAlpha !== undefined ? s.fibBgAlpha : 0.2;
      
      ctx.save();
      
      if (fibBg && sorted.length > 1) {
        for (let i = 1; i < sorted.length; i++) {
          const prevX = p3.x + dx * sorted[i-1].v;
          const thisX = p3.x + dx * sorted[i].v;
          ctx.fillStyle = (s.useOneColor && s.useOneColor !== false ? s.useOneColor : sorted[i].color) || '#4caf50';
          ctx.globalAlpha = bgAlpha;
          ctx.fillRect(Math.min(prevX, thisX), yTop, Math.abs(thisX - prevX), H);
        }
      }
      
      const tlActive = s.trendLineActive !== false;
      if (tlActive) {
        ctx.globalAlpha = 1;
        ctx.strokeStyle = s.trendLineColor || s.color || '#58a6ff';
        ctx.lineWidth = s.trendLineWidth || s.width || 1;
        const tlDash = s.trendLineDash || s.dash || [];
        ctx.setLineDash(Array.isArray(tlDash) ? tlDash : tlDash === 'dashed' ? [5,5] : tlDash === 'dotted' ? [2,2] : []);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.lineTo(p3.x, p3.y);
        ctx.stroke();
      }
  
      const lvlWidth = s.levelsWidth || s.width || 1;
      const lvlStyle = s.levelsStyle || 'solid';
      const lvlDash  = Array.isArray(s.levelsDash) ? s.levelsDash : lvlStyle === 'dashed' ? [8, 5] : lvlStyle === 'dotted' ? [3, 3] : [];
      ctx.font = `${s.fibFontSize || 11}px -apple-system, BlinkMacSystemFont, "Trebuchet MS", Roboto, Ubuntu, sans-serif`;
  
      for (const lvl of sorted) {
         const x = p3.x + dx * lvl.v;
         
         ctx.globalAlpha = 1;
         ctx.strokeStyle = (s.useOneColor && s.useOneColor !== false ? s.useOneColor : lvl.color) || '#787b86';
         ctx.lineWidth = lvlWidth;
         ctx.setLineDash(lvlDash);
         ctx.beginPath();
         ctx.moveTo(x, yTop);
         ctx.lineTo(x, yBottom);
         ctx.stroke();
         
         if (showLabels) {
            ctx.setLineDash([]);
            ctx.fillStyle = (s.useOneColor && s.useOneColor !== false ? s.useOneColor : lvl.color) || '#787b86';
            const valStr = lvl.v.toString();
            
            ctx.textAlign = labelsH === 'Right' ? 'left' : labelsH === 'Center' ? 'center' : 'right';
            const textX = labelsH === 'Right' ? x + 4 : labelsH === 'Center' ? x : x - 4;
            const textY = labelsV === 'Top' ? yTop + (s.fibFontSize || 11) + 4 : labelsV === 'Bottom' ? yBottom - 4 : (yTop + yBottom) / 2;
            ctx.textBaseline = labelsV === 'Bottom' ? 'bottom' : labelsV === 'Top' ? 'top' : 'middle';
            
            ctx.fillText(valStr, textX, textY);
         }
      }
      ctx.restore();
    }

  function _drawFibSpiral(ctx, d, pane) {
      if (!d.p1 || !d.p2) return;
      const p1 = _pt2xy(d.p1, pane);
      const p2 = _pt2xy(d.p2, pane);
      if (!p1 || !p2) return;
  
      const s = d.style || {};
      const baseRadius = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      if (baseRadius < 1) return;
      
      const startAngle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
  
      ctx.save();
      ctx.strokeStyle = s.color || '#58a6ff';
      ctx.lineWidth = s.width || 1;
      let dashArr = s.dash || [];
      if (s.lineStyle === 'dashed') dashArr = [8, 5];
      if (s.lineStyle === 'dotted') dashArr = [3, 3];
      ctx.setLineDash(dashArr);
      
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      
      for (let t = 0; t <= Math.PI * 6; t += 0.1) {
          const theta = startAngle + t;
          const r = baseRadius * Math.pow(1.618033988749895, t / (Math.PI / 2));
          const x = p1.x + r * Math.cos(theta);
          const y = p1.y + r * Math.sin(theta);
          ctx.lineTo(x, y);
      }
      ctx.stroke();
      
      const tlActive = s.trendLineActive !== false;
      if (tlActive) {
        ctx.strokeStyle = s.trendLineColor || s.color || '#58a6ff';
        ctx.lineWidth = s.trendLineWidth || s.width || 1;
        const tlDash = s.trendLineDash || s.dash || [];
        ctx.setLineDash(Array.isArray(tlDash) ? tlDash : tlDash === 'dashed' ? [5,5] : tlDash === 'dotted' ? [2,2] : []);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }
      
      ctx.restore();
    }

  function _drawGannFan() {}

  function _drawGannBox() {}

  function _drawGannSquare() {}

  function _drawFibCircles(ctx, d, pane) {
      if (!d.p1 || !d.p2) return;
      const p1 = _pt2xy(d.p1, pane);
      const p2 = _pt2xy(d.p2, pane);
      if (!p1 || !p2) return;
      
      const s = d.style || {};
      const allLevels = _getFibLevels(s);
      const activeLevels = allLevels.filter(l => l.active !== false);
      const sorted = [...activeLevels].sort((a, b) => a.v - b.v);
      
      const r = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const fibBg = s.fibBg !== false;
      const bgAlpha = s.fibBgAlpha !== undefined ? s.fibBgAlpha : 0.2;
      
      ctx.save();
      // Center point
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.strokeStyle = s.trendColor || '#787b86';
      ctx.lineWidth = s.trendWidth || 1;
      ctx.setLineDash(s.trendStyle === 'dashed' ? [5,5] : s.trendStyle === 'dotted' ? [2,2] : [4,4]);
      ctx.stroke();
      
      if (fibBg && sorted.length > 1) {
        // Draw from largest to smallest to avoid overdrawing
        const revSorted = [...sorted].reverse();
        for (let i = 0; i < revSorted.length - 1; i++) {
           const vOuter = revSorted[i].v;
           const vInner = revSorted[i+1].v;
           ctx.fillStyle = revSorted[i].color || '#4caf50';
           ctx.globalAlpha = bgAlpha;
           ctx.beginPath();
           ctx.arc(p1.x, p1.y, r * vOuter, 0, Math.PI * 2);
           ctx.arc(p1.x, p1.y, r * vInner, 0, Math.PI * 2, true); // counter-clockwise for cutout
           ctx.fill();
        }
      }
  
      const lvlWidth = s.levelsWidth || s.width || 1;
      const lvlStyle = s.levelsStyle || 'solid';
      const lvlDash  = Array.isArray(s.levelsDash) ? s.levelsDash : lvlStyle === 'dashed' ? [8, 5] : lvlStyle === 'dotted' ? [3, 3] : [];
  
      for (const lvl of sorted) {
         if (lvl.v <= 0) continue; // Circle radius cannot be 0 or negative
         ctx.globalAlpha = 1;
         ctx.strokeStyle = (s.useOneColor && s.useOneColor !== false ? s.useOneColor : lvl.color) || '#787b86';
         ctx.lineWidth = lvlWidth;
         ctx.setLineDash(lvlDash);
         ctx.beginPath();
         ctx.arc(p1.x, p1.y, r * lvl.v, 0, Math.PI * 2);
         ctx.stroke();
      }
      ctx.restore();
    }


  function _drawFibArcs(ctx, d, pane) {
    // Placeholder for Fib speed resistance arcs
  }

  function _drawFibWedge(ctx, d, pane) {
    // Placeholder for Fib wedge
  }

  function _drawPitchfan(ctx, d, pane) {
    // Placeholder for Pitchfan
  }

  return {
    drawFibRet: _drawFibRet,
    drawFibExt: _drawFibExt,
    drawFibChannel: _drawFibChannel,
    drawFibTimezone: _drawFibTimezone,
    drawFibSpeedfan: _drawFibSpeedfan,
    drawFibTimebased: _drawFibTimebased,
    drawFibSpiral: _drawFibSpiral,
    drawGannFan: _drawGannFan,
    drawGannBox: _drawGannBox,
    drawGannSquare: _drawGannSquare,
    drawFibCircles: _drawFibCircles,
    drawFibArcs: _drawFibArcs,
    drawFibWedge: _drawFibWedge,
    drawPitchfan: _drawPitchfan,
  };
})();
