/**
 * PinTrade V2.4 - Drawing Forecast and Measurement Tools Module
 *
 * Handles rendering for:
 *   - FORECASTING (Long/Short Position)
 *   - PRICE & DATE (Price Range, Date Range, Date & Price Range)
 *   - VOLUME-BASED (Fixed Range Vol Profile, Anchored Vol Profile)
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

  // gorevler: Forecast & Measurement TV parity, Faz 1 (Long/Short Position).
  // İstatistik formülleri TV'nin iç matematiğinden ters mühendislikle değil,
  // gerçek TV hesabında gözlemlenen render'dan çıkarıldı — "en iyi çaba"
  // yaklaşımı, TV ile sayısal olarak birebir garantili DEĞİL.
  function _fmtPrice(v) {
    if (!isFinite(v)) return '0';
    return Math.abs(v) < 1 ? v.toFixed(5) : v.toFixed(3);
  }
  function _fmtAmt(v) {
    if (!isFinite(v)) return '0';
    return (v >= 0 ? '' : '-') + Math.abs(v).toFixed(2);
  }
  function _isStatOn(stats, key) {
    const DEFAULT_ON = window.DSDPositionTabs ? window.DSDPositionTabs.DEFAULT_ON : null;
    if (stats && stats[key] !== undefined) return stats[key];
    return DEFAULT_ON ? DEFAULT_ON.has(key) : true;
  }
  function _roundRectPath(ctx, x, y, w, h, r) {
    if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
    else { ctx.beginPath(); ctx.rect(x, y, w, h); }
  }
  function _calloutHeight(lines, fontSize) {
    if (!lines.length) return 0;
    const padY = 4, lineH = fontSize + 5;
    return lines.length * lineH + padY * 2 - (lineH - fontSize);
  }
  function _drawCallout(ctx, x, y, lines, bg, fontSize, align) {
    if (!lines.length) return 0;
    ctx.font = `${fontSize}px -apple-system, Arial, sans-serif`;
    const padX = 6, padY = 4, lineH = fontSize + 5;
    const textW = Math.max(...lines.map(l => ctx.measureText(l).width));
    const w = textW + padX * 2;
    const h = lines.length * lineH + padY * 2 - (lineH - fontSize);
    const boxX = align === 'right' ? x - w : x;
    _roundRectPath(ctx, boxX, y, w, h, 3);
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    lines.forEach((l, i) => ctx.fillText(l, boxX + padX, y + padY + i * lineH));
    return h;
  }
  function _drawHandle(ctx, x, y, shape, color) {
    ctx.fillStyle = color;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    if (shape === 'circle') {
      ctx.beginPath(); ctx.arc(x, y, 4.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    } else {
      ctx.fillRect(x - 4, y - 4, 8, 8);
      ctx.strokeRect(x - 4, y - 4, 8, 8);
    }
  }

  function _drawPosition(ctx, d, pane, type, isSelected) {
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
      const py = (_pt2xy(d.p2, pane) || {}).y ?? (a.y - 50);
      const sy = (_pt2xy(d.p3, pane) || {}).y ?? (a.y + 50);
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

      // ── TV-tarzı yüzen callout'lar (tam-genişlik bar DEĞİL) ──────────
      const alwaysShow = s.alwaysShowStats !== false;
      if (showPriceLabels !== false && w > 40 && (alwaysShow || isSelected)) {
        const ep = d.p1.price, tp = d.p2.price, sp = d.p3.price;
        const targetDist = Math.abs(tp - ep);
        const stopDist   = Math.abs(ep - sp);
        const pctTgt = (targetDist / Math.max(1e-8, ep)) * 100;
        const pctStop = (stopDist / Math.max(1e-8, ep)) * 100;
        const priceToTicks = window.DSDPositionTabs
          ? window.DSDPositionTabs.priceToTicks
          : (diff) => Math.round(Math.abs(diff) * 1000);
        const ticksTgt = priceToTicks(tp - ep);
        const ticksStop = priceToTicks(ep - sp);
        const rr = stopDist === 0 ? 0 : targetDist / stopDist;

        const accSize = s.accSize !== undefined ? s.accSize : 10000;
        const riskType = s.riskType || '%';
        const riskInput = s.risk !== undefined ? s.risk : 1;
        const riskAmount = riskType === '%' ? accSize * (riskInput / 100) : riskInput;
        const qty = stopDist > 0 ? riskAmount / stopDist : 0;
        const tpAmount = qty * targetDist;
        const slAmount = riskAmount;
        const qtyPrec = s.qtyPrec && s.qtyPrec !== 'Default' ? parseInt(s.qtyPrec, 10) : 2;
        const qtyStr = qty.toFixed(isFinite(qtyPrec) ? qtyPrec : 2);

        const stats = s.stats || {};
        const on = (k) => _isStatOn(stats, k);
        const compact = s.compactStats === true;

        // ── Target callout (yeşil, hedef çizgisinin üstünde, sol-hizalı) ──
        const tParts = [];
        if (on('tpPriceOffset')) tParts.push(`Target: ${_fmtPrice(tp)}`);
        if (on('tpPercentOffset')) tParts.push(`(${pctTgt.toFixed(2)}%)`);
        if (!compact && on('tpTickOffset')) tParts.push(`${ticksTgt}`);
        let tLine1 = tParts.join(' ');
        if (!compact && on('tpAmount') && tLine1) tLine1 += `, Amount: ${_fmtAmt(tpAmount)}`;
        const tLines = [];
        if (tLine1) tLines.push(tLine1);
        if (!compact && on('tpPL')) tLines.push(`TP PL: ${_fmtAmt(tpAmount)}`);
        if (tLines.length) {
          const tLineY = ey + diffTarget;
          const h = _calloutHeight(tLines, fontSize);
          _drawCallout(ctx, a.x + 4, tLineY - h - 4, tLines, 'rgba(8,153,129,0.9)', fontSize, 'left');
        }

        // ── Entry callout (mavi, entry çizgisinin ortasında) ─────────────
        const eLines = [];
        const pnlParts = [];
        if (on('openClosedPL')) {
          const lastClose = pane.candlesData && pane.candlesData.length
            ? pane.candlesData[pane.candlesData.length - 1].close : ep;
          const closedPL = qty * (type === 'short' ? (ep - lastClose) : (lastClose - ep));
          pnlParts.push(`Closed PnL: ${_fmtAmt(closedPL)}`);
        }
        if (on('qty')) pnlParts.push(`Qty: ${qtyStr}`);
        if (pnlParts.length) eLines.push(pnlParts.join(', '));
        if (on('rrRatio')) eLines.push(`Risk/reward ratio: ${rr.toFixed(2)}`);
        if (eLines.length) {
          const midX = (a.x + rightX) / 2;
          ctx.font = `${fontSize}px -apple-system, Arial, sans-serif`;
          const boxW = Math.max(...eLines.map(l => ctx.measureText(l).width)) + 12;
          _drawCallout(ctx, midX - boxW / 2, ey + 6, eLines, 'rgba(41,98,255,0.9)', fontSize, 'left');
        }

        // ── Stop callout (kırmızı, stop çizgisinin altında, sol-hizalı) ──
        const sParts = [];
        if (on('slPriceOffset')) sParts.push(`Stop: ${_fmtPrice(sp)}`);
        if (on('slPercentOffset')) sParts.push(`(${pctStop.toFixed(2)}%)`);
        if (!compact && on('slTickOffset')) sParts.push(`${ticksStop}`);
        let sLine1 = sParts.join(' ');
        if (!compact && on('slAmount') && sLine1) sLine1 += `, Amount: ${_fmtAmt(slAmount)}`;
        const sLines = [];
        if (sLine1) sLines.push(sLine1);
        if (!compact && on('slPL')) sLines.push(`SL PL: ${_fmtAmt(-slAmount)}`);
        if (sLines.length) {
          const sLineY = ey + diffStop;
          _drawCallout(ctx, a.x + 4, sLineY + 4, sLines, 'rgba(242,54,69,0.9)', fontSize, 'left');
        }
      }

      // ── Seçiliyken TV-tarzı tutamaç işaretçileri (görsel; hit-test
      // geometrisi core.js:_hitTest'te ayrıca tanımlı, burası sadece çizim) ──
      if (isSelected) {
        _drawHandle(ctx, a.x, ey, 'circle', color);              // entry — sol (tüm şekli taşı)
        _drawHandle(ctx, rightX, ey, 'square', color);           // entry — sağ (genişlik resize)
        _drawHandle(ctx, a.x, ey + diffTarget, 'square', color); // target — sol köşe
        _drawHandle(ctx, a.x, ey + diffStop, 'square', color);   // stop — sol köşe
      }
    }

  // ── PRICE & DATE (Aralıklar) ─────────────────────────────

  function _drawPriceRange(ctx, d, pane)     { /* Placeholder */ }
  function _drawDateRange(ctx, d, pane)      { /* Placeholder */ }
  function _drawDatePriceRange(ctx, d, pane) { /* Placeholder */ }

  // ── VOLUME-BASED (Hacim Tabanlı) ─────────────────────────

  function _drawFixedVolProf(ctx, d, pane)   { /* Placeholder */ }
  function _drawAnchVolProf(ctx, d, pane)    { /* Placeholder */ }

  return {
    drawMeasureTool:    _drawMeasureTool,
    drawPosition:       _drawPosition,
    drawPriceRange:     _drawPriceRange,
    drawDateRange:      _drawDateRange,
    drawDatePriceRange: _drawDatePriceRange,
    drawFixedVolProf:   _drawFixedVolProf,
    drawAnchVolProf:    _drawAnchVolProf,
  };
})();
