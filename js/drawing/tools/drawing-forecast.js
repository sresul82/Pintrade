/**
 * PinTrade V2.4 - Drawing Forecast and Measurement Tools Module
 *
 * Handles rendering for:
 *   - FORECASTING (Long/Short Position, Position Forecast, Bar Pattern, Ghost Feed, Sector)
 *   - PRICE & DATE (Price Range, Date Range, Date & Price Range)
 *   - VOLUME-BASED (Anchored VWAP, Fixed Range Vol Profile, Anchored Vol Profile)
 *   - Measurement (Measure Tool / Cetvel)
 */

window.DrawingForecast = (() => {

  function _pt2xy(pt, pane) {
    if (window.DrawingManager && window.DrawingManager.utils) {
      return window.DrawingManager.utils.pt2xy(pt, pane);
    }
    return null;
  }

  // ── MEASUREMENT (Cetvel) ──────────────────────────────────

  function _drawMeasureTool(ctx, d, pane) {
      if (!d.p1 || !d.p2) return;
      const a = _pt2xy(d.p1, pane);
      const b = _pt2xy(d.p2, pane);
      if (!a || !b) return;
  
      const x1 = Math.min(a.x, b.x), x2 = Math.max(a.x, b.x);
      const y1 = Math.min(a.y, b.y), y2 = Math.max(a.y, b.y);
      const w = x2 - x1;
      const h = y2 - y1;
  
      ctx.save();
      ctx.fillStyle = 'rgba(41, 98, 255, 0.2)';
      ctx.fillRect(x1, y1, w, h);
  
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2;
      ctx.strokeStyle = '#2962ff';
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(x1, my); ctx.lineTo(x2, my);
      ctx.moveTo(mx, y1); ctx.lineTo(mx, y2);
      ctx.stroke();
  
      const drawArrow = (fromX, fromY, toX, toY) => {
        ctx.beginPath();
        ctx.moveTo(fromX, fromY); ctx.lineTo(toX, toY);
        ctx.stroke();
        const angle = Math.atan2(toY - fromY, toX - fromX);
        ctx.beginPath();
        ctx.moveTo(toX, toY);
        ctx.lineTo(toX - 5 * Math.cos(angle - Math.PI/6), toY - 5 * Math.sin(angle - Math.PI/6));
        ctx.moveTo(toX, toY);
        ctx.lineTo(toX - 5 * Math.cos(angle + Math.PI/6), toY - 5 * Math.sin(angle + Math.PI/6));
        ctx.stroke();
      };
      
      if (w > 20) drawArrow(a.x > b.x ? x2 : x1, my, a.x > b.x ? x1 : x2, my);
      if (h > 20) drawArrow(mx, a.y > b.y ? y2 : y1, mx, a.y > b.y ? y1 : y2);
  
      const priceDiff = d.p2.price - d.p1.price;
      const pctDiff = (priceDiff / d.p1.price) * 100;
      
      let vol = 0, barsCount = 0, tDiffText = '';
      
      if (pane.candlesData) {
        const t1 = Math.min(d.p1.time, d.p2.time);
        const t2 = Math.max(d.p1.time, d.p2.time);
        for (const c of pane.candlesData) {
          if (c.time >= t1 && c.time <= t2) {
            barsCount++;
            if (c.volume) vol += c.volume;
          }
        }
        const secDiff = t2 - t1;
        if (secDiff > 0) {
          const d_ = Math.floor(secDiff / 86400);
          const h_ = Math.floor((secDiff % 86400) / 3600);
          const m_ = Math.floor((secDiff % 3600) / 60);
          if (d_ > 0) tDiffText = `${d_}d ${h_}h`;
          else if (h_ > 0) tDiffText = `${h_}h ${m_}m`;
          else tDiffText = `${m_}m`;
        }
      }
      
      const formatVol = (v) => {
        if (v >= 1e9) return (v/1e9).toFixed(2) + ' B';
        if (v >= 1e6) return (v/1e6).toFixed(2) + ' M';
        if (v >= 1e3) return (v/1e3).toFixed(2) + ' K';
        return v.toFixed(2);
      };
  
      const textLines = [
        `${priceDiff > 0 ? '+' : ''}${priceDiff.toFixed(2)} (${priceDiff > 0 ? '+' : ''}${pctDiff.toFixed(2)}%)`,
        `${barsCount} bars${tDiffText ? ', ' + tDiffText : ''}`,
        `Vol ${formatVol(vol)}`
      ];
  
      ctx.font = '12px Inter, sans-serif';
      const textW = Math.max(...textLines.map(l => ctx.measureText(l).width)) + 24;
      const textH = textLines.length * 18 + 16;
      let lblX = mx - textW / 2;
      let lblY = y1 - textH - 12;
      if (lblY < 0) lblY = y2 + 12;
  
      ctx.fillStyle = '#2962ff';
      if (ctx.roundRect) {
        ctx.beginPath(); ctx.roundRect(lblX, lblY, textW, textH, 6); ctx.fill();
      } else {
        ctx.fillRect(lblX, lblY, textW, textH);
      }
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      textLines.forEach((l, i) => ctx.fillText(l, mx, lblY + 12 + i * 18 + 6));
      ctx.restore();
    }

  // ── FORECASTING (Pozisyonlar ve Tahmin) ───────────────────

  function _drawPosition(ctx, d, pane, type) {
      if (!d.p1 || !d.p2 || !d.p3) return;
      const a = _pt2xy(d.p1, pane);
      const b = _pt2xy(d.p2, pane);
      if (!a) return;
      let rightX = b ? b.x : a.x + 50;
      const s = d.style || {};
      const color = s.color || '#2962ff';
      const targetColor = s.targetColor || 'rgba(8,153,129,0.2)';
      const stopColor = s.stopColor || 'rgba(242,54,69,0.2)';
      const fontSize = s.fontSize || 11;
      const showPriceLabels = s.priceLabels !== false;
      const ey = a.y;
      const py = pane.series.priceToCoordinate(d.p2.price) || a.y - 50;
      const sy = pane.series.priceToCoordinate(d.p3.price) || a.y + 50;
      const diffTarget = py - ey;
      const diffStop = sy - ey;
      const w = rightX - a.x;
      if (w > 0) {
        if (diffTarget !== 0) { ctx.fillStyle = targetColor; ctx.fillRect(a.x, ey, w, diffTarget); }
        if (diffStop !== 0)   { ctx.fillStyle = stopColor;   ctx.fillRect(a.x, ey, w, diffStop);   }
      }
      ctx.lineWidth = s.width || 1;
      const lineStyle = s.lineStyle || 'solid';
      if (lineStyle === 'dashed') ctx.setLineDash([5,5]);
      else if (lineStyle === 'dotted') ctx.setLineDash([2,2]);
      else ctx.setLineDash([]);
      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.moveTo(a.x, ey); ctx.lineTo(rightX, ey);
      ctx.moveTo(a.x, ey + diffTarget); ctx.lineTo(rightX, ey + diffTarget);
      ctx.moveTo(a.x, ey + diffStop);   ctx.lineTo(rightX, ey + diffStop);
      ctx.stroke();
      ctx.setLineDash([]);
      if (showPriceLabels !== false && w > 60) {
        const ep = d.p1.price, tp = d.p2.price, sp = d.p3.price;
        const profitPx  = Math.abs(tp - ep);
        const stopPx    = Math.abs(ep - sp);
        const profitPct = (profitPx / Math.max(0.00000001, ep) * 100).toFixed(2);
        const stopPct   = (stopPx   / Math.max(0.00000001, ep) * 100).toFixed(2);
        const rr        = stopPx === 0 ? '0.00' : (profitPx / stopPx).toFixed(2);
        const labelH = fontSize + 8;
        ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
        const tLineY = ey + diffTarget;
        ctx.fillStyle = 'rgba(8,153,129,0.85)';
        ctx.fillRect(a.x, tLineY - labelH, w, labelH);
        ctx.font = `bold ${fontSize}px -apple-system, Arial, sans-serif`;
        ctx.fillStyle = '#ffffff';
        ctx.fillText(`Target: ${tp.toFixed(3)}  (${profitPct}%)   R:R ${rr}`, a.x + 6, tLineY - labelH / 2);
        ctx.font = `${fontSize - 1}px -apple-system, Arial, sans-serif`;
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.fillText(`Entry: ${ep.toFixed(3)}`, a.x + 6, ey - labelH / 2 - 2);
        const sLineY = ey + diffStop;
        ctx.fillStyle = 'rgba(242,54,69,0.85)';
        ctx.fillRect(a.x, sLineY, w, labelH);
        ctx.font = `bold ${fontSize}px -apple-system, Arial, sans-serif`;
        ctx.fillStyle = '#ffffff';
        ctx.fillText(`Stop: ${sp.toFixed(3)}  (${stopPct}%)`, a.x + 6, sLineY + labelH / 2);
      }
    }

  function _drawPosForecast(ctx, d, pane)    { /* Placeholder */ }
  function _drawBarPattern(ctx, d, pane)     { /* Placeholder */ }
  function _drawGhostFeed(ctx, d, pane)      { /* Placeholder */ }
  function _drawSector(ctx, d, pane)         { /* Placeholder */ }

  // ── PRICE & DATE (Aralıklar) ─────────────────────────────

  function _drawPriceRange(ctx, d, pane)     { /* Placeholder */ }
  function _drawDateRange(ctx, d, pane)      { /* Placeholder */ }
  function _drawDatePriceRange(ctx, d, pane) { /* Placeholder */ }

  // ── VOLUME-BASED (Hacim Tabanlı) ─────────────────────────

  function _drawAnchoredVWAP(ctx, d, pane) {
      const candles = pane.candlesData;
      if (!candles || candles.length === 0) return;
      const toSec = t => typeof t === 'object'
        ? new Date(t.year, t.month - 1, t.day).getTime() / 1000 : t;
      const anchorT = toSec(d.p1.time);
      let cumVol = 0, cumVP = 0;
      const pts = [];
      for (const c of candles) {
        if (toSec(c.time) < anchorT) continue;
        const tp  = (c.high + c.low + c.close) / 3;
        const vol = c.volume || 1;
        cumVol += vol; cumVP += tp * vol;
        const vwap = cumVP / cumVol;
        const px = pane.chart.timeScale().timeToCoordinate(c.time);
        const py = pane.series.priceToCoordinate(vwap);
        if (px !== null && py !== null) pts.push({ x: px, y: py });
      }
      if (pts.length < 2) return;
      ctx.save();
      ctx.strokeStyle = d.style?.color || '#2962ff';
      ctx.lineWidth = d.style?.width || 2;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(pts[0].x, pts[0].y, 4, 0, Math.PI * 2);
      ctx.fillStyle = d.style?.color || '#2962ff';
      ctx.fill();
      ctx.restore();
    }

  function _drawFixedVolProf(ctx, d, pane)   { /* Placeholder */ }
  function _drawAnchVolProf(ctx, d, pane)    { /* Placeholder */ }

  return {
    drawMeasureTool:    _drawMeasureTool,
    drawPosition:       _drawPosition,
    drawPosForecast:    _drawPosForecast,
    drawBarPattern:     _drawBarPattern,
    drawGhostFeed:      _drawGhostFeed,
    drawSector:         _drawSector,
    drawPriceRange:     _drawPriceRange,
    drawDateRange:      _drawDateRange,
    drawDatePriceRange: _drawDatePriceRange,
    drawAnchoredVWAP:   _drawAnchoredVWAP,
    drawFixedVolProf:   _drawFixedVolProf,
    drawAnchVolProf:    _drawAnchVolProf,
  };
})();
