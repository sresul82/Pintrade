/**
 * PinTrade V2.4 - Drawing Advanced Technical Tools Module
 *
 * Handles rendering for technical/volume based tools:
 *   - Anchored VWAP
 *   - Volume Profiles (Fixed Range, Anchored)
 */

window.DrawingAdvanced = (() => {

  function _pt2xy(pt, pane) {
    if (window.DrawingManager && window.DrawingManager.utils) {
      return window.DrawingManager.utils.pt2xy(pt, pane);
    }
    return null;
  }

  // ── Technical & Volume Tools ──────────────────────────────

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
      
      // Anchor marker
      ctx.beginPath();
      ctx.arc(pts[0].x, pts[0].y, 4, 0, Math.PI * 2);
      ctx.fillStyle = d.style?.color || '#2962ff';
      ctx.fill();
      ctx.restore();
    }

  function _drawFixedVolProf(ctx, d, pane)   { /* Placeholder for fixedvolprof */ }
  function _drawAnchVolProf(ctx, d, pane)    { /* Placeholder for anchvolprof */ }

  return {
    drawAnchoredVWAP:   _drawAnchoredVWAP,
    drawFixedVolProf:   _drawFixedVolProf,
    drawAnchVolProf:    _drawAnchVolProf,
  };
})();
