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

  function _drawPriceLabel(ctx, price, y, pane, color) {
    if (price == null || y == null) return;
    const w = pane.drawingCanvas.width / (window.devicePixelRatio || 1);
    const text = _formatPrice(price);
    
    ctx.save();
    ctx.font = '10px "JetBrains Mono", sans-serif';
    const pad = 4;
    const txtW = ctx.measureText(text).width;
    const boxW = txtW + pad * 2;
    const boxH = 16;
    
    const bgColor = color || 'rgba(80, 80, 90, 0.85)';
    ctx.fillStyle = bgColor;
    ctx.fillRect(w - boxW, y - boxH/2, boxW, boxH);
    
    ctx.beginPath();
    ctx.moveTo(w - boxW, y - boxH/2);
    ctx.lineTo(w - boxW - 5, y);
    ctx.lineTo(w - boxW, y + boxH/2);
    ctx.fill();

    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, w - boxW/2, y);
    ctx.restore();
  }

  function _drawHLine(ctx, d, pane, selected) {
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

        // Çizgiyi çiz
        // Price label (sağ kenar)
        const showHlineLabel = s.priceLabel !== false;
        let hlineLabelW = 0;
        if (showHlineLabel) {
          ctx.save();
          ctx.font = '10px "JetBrains Mono", sans-serif';
          hlineLabelW = ctx.measureText(_formatPrice(d.price)).width + 8 + 5 + 5; // pad*2 + ok + boşluk
          ctx.restore();
        }

        // Çizgiyi çiz (label varsa önünde dur)
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w - hlineLabelW, y);
        ctx.stroke();

        if (showHlineLabel) _drawPriceLabel(ctx, d.price, y, pane, s.color || '#2962ff');

        // Metin (Settings'ten veya inline editörden)
        const hlineText = s.text || '';
        const textAlignH = s.textAlignH || 'center';
        const textAlignV = s.textAlignV || 'top';

        // textAlignH'e göre X konumu hesapla
        const endX = w - hlineLabelW;
        let textX;
        if (textAlignH === 'left')       textX = 6;
        else if (textAlignH === 'right') textX = endX - 6;
        else                             textX = endX / 2;

        // textAlignV'e göre Y offset
        let textY, textBaseline;
        if (textAlignV === 'bottom')     { textY = y + 5;  textBaseline = 'top'; }
        else if (textAlignV === 'middle'){ textY = y;       textBaseline = 'middle'; }
        else                             { textY = y - 5;   textBaseline = 'bottom'; }

        if (hlineText) {
          ctx.save();
          ctx.font = `${s.bold ? 'bold ' : ''}${s.italic ? 'italic ' : ''}${s.fontSize || 14}px "JetBrains Mono", sans-serif`;
          ctx.fillStyle = s.textColor || '#ffffff';
          ctx.textAlign = textAlignH === 'right' ? 'right' : textAlignH === 'left' ? 'left' : 'center';
          ctx.textBaseline = textBaseline;
          ctx.globalAlpha = 1;
          ctx.fillText(hlineText, textX, textY);
          ctx.restore();
        }

        // "Add Text" hint (seçili, metin yok)
        if (selected && !hlineText) {
          const hintText = 'Add Text';
          ctx.save();
          ctx.font = '12px "JetBrains Mono", sans-serif';
          ctx.fillStyle = s.color || '#2962ff';
          ctx.globalAlpha = 0.6;
          ctx.textAlign = textAlignH === 'right' ? 'right' : textAlignH === 'left' ? 'left' : 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillText(hintText, textX, y - 5);
          const hintTextW = ctx.measureText(hintText).width;
          ctx.restore();

          if (!window._trendTextHintAreas) window._trendTextHintAreas = {};
          window._trendTextHintAreas[d.id] = { cx: textX, cy: y - 5, hw: hintTextW / 2 + 6, hh: 10, angle: 0 };
        } else if (selected && hlineText) {
          ctx.save();
          ctx.font = `${s.fontSize || 14}px "JetBrains Mono", sans-serif`;
          const tw = ctx.measureText(hlineText).width;
          ctx.restore();
          if (!window._trendTextHintAreas) window._trendTextHintAreas = {};
          window._trendTextHintAreas[d.id] = { cx: textX, cy: textY, hw: tw / 2 + 6, hh: 10, angle: 0 };
        } else {
          if (window._trendTextHintAreas) delete window._trendTextHintAreas[d.id];
        }

        ctx.restore();
      } catch(e) { console.warn('[HLine] render error', e); }
    }

  function _drawVLine(ctx, d, pane, selected) {
      try {
        if (d.time == null) return;
        const x = _timeToX(pane, d.time);
        if (x == null || !isFinite(x)) return;
        const dpr = window.devicePixelRatio || 1;
        const allPanes = window.PaneManagerInstance?.panes || [];
        const hasIndicatorPane = allPanes.length > 1;
        const extendAll = !!(d.style && d.style.extendAll);

        // Çizginin boyu: extend açıksa tüm pane'leri kapsar, değilse sadece mevcut pane
        let lineH = pane.drawingCanvas.height / dpr;
        if (extendAll && hasIndicatorPane) {
          lineH = allPanes.reduce((sum, p) => sum + (p.drawingCanvas?.height || 0) / dpr, 0) || lineH;
        } else if (!hasIndicatorPane) {
          lineH = allPanes.reduce((sum, p) => sum + (p.drawingCanvas?.height || 0) / dpr, 0) || lineH;
        }

        // Yazının dikey referans noktası: extend'den bağımsız
        // - indicator yoksa → ana pane'in altı
        // - indicator varsa → indicator pane'inin altı (extend olsa da olmasa da)
        let textBaseH = pane.drawingCanvas.height / dpr;
        if (hasIndicatorPane) {
          textBaseH = allPanes.reduce((sum, p) => sum + (p.drawingCanvas?.height || 0) / dpr, 0) || textBaseH;
        }

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
        ctx.lineTo(x, lineH);
        ctx.stroke();
        // Time label
        if (s.timeLabel !== false) {
          const t = d.time;
          let dateObj;
          if (t && typeof t === 'object' && t.year) {
            dateObj = new Date(t.year, t.month - 1, t.day, t.hour || 0, t.minute || 0);
          } else {
            dateObj = new Date(typeof t === 'number' ? t * 1000 : t);
          }
          const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
          const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
          const dd = days[dateObj.getDay()];
          const d2 = String(dateObj.getDate()).padStart(2, '0');
          const mo = months[dateObj.getMonth()];
          const yr = String(dateObj.getFullYear()).slice(2);
          const hh = String(dateObj.getHours()).padStart(2, '0');
          const mm = String(dateObj.getMinutes()).padStart(2, '0');
          const label = `${dd} ${d2} ${mo} '${yr}  ${hh}:${mm}`;
          const fontSize = 11;
          ctx.save();
          ctx.font = `${fontSize}px "JetBrains Mono", sans-serif`;
          const pad = 6;
          const tw = ctx.measureText(label).width;
          const boxW = tw + pad * 2;
          const boxH = fontSize + 8;
          const dpr = window.devicePixelRatio || 1;
          const canvasH = pane.drawingCanvas.height / dpr;
          const bx = x - boxW / 2;
          const by = canvasH - boxH;
          ctx.fillStyle = s.color || '#2962ff';
          ctx.beginPath();
          ctx.roundRect(bx, by, boxW, boxH, 3);
          ctx.fill();
          ctx.fillStyle = '#000000';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(label, x, by + boxH / 2);
          ctx.restore();
        }
        const vlineText = s.text || '';
        
        const textAlignH  = s.textAlignH    || 'center';
        const textAlignV  = s.textAlignV    || 'middle';
        const orientation = s.textOrientation || 'vertical';
        const fontSize    = s.fontSize || 14;
        const rowH        = fontSize + 4;
        
        // textAlignH → çizginin solunda / üzerinde / sağında
        let tx, canvasTextAlign;
        if      (textAlignH === 'left')  { tx = x - 6; canvasTextAlign = 'right';  }
        else if (textAlignH === 'right') { tx = x + 6; canvasTextAlign = 'left';   }
        else                             { tx = x;      canvasTextAlign = 'center'; }

        // textAlignV → çizgi boyunca yukarı / orta / aşağı
        let ty;
        if      (textAlignV === 'top')    ty = 10;
        else if (textAlignV === 'bottom') ty = textBaseH - rowH;
        else                              ty = textBaseH / 2;

        if (vlineText) {
          ctx.save();
          ctx.font      = `${s.bold ? 'bold ' : ''}${s.italic ? 'italic ' : ''}${fontSize}px "JetBrains Mono", sans-serif`;
          ctx.fillStyle = s.textColor || '#ffffff';
          ctx.globalAlpha = 1;

          if (orientation === 'vertical') {
            ctx.translate(tx, ty);
            ctx.rotate(-Math.PI / 2);
            ctx.textAlign    = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(vlineText, 0, 0);
          } else {
            ctx.textAlign    = canvasTextAlign;
            ctx.textBaseline = 'top';
            ctx.fillText(vlineText, tx, ty);
          }
          ctx.restore();
        }

        // "Add Text" hint — seçili ve metin yok
        if (selected && !vlineText) {
          const hintText = 'Add Text';
          ctx.save();
          ctx.font = '12px "JetBrains Mono", sans-serif';
          ctx.fillStyle = s.color || '#2962ff';
          ctx.globalAlpha = 0.6;
          
          let hw, hh, cx, cy, angle;
          if (orientation === 'vertical') {
            ctx.translate(tx, ty);
            ctx.rotate(-Math.PI / 2);
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(hintText, 0, 0);
            hw = ctx.measureText(hintText).width / 2 + 6;
            hh = 10;
            cx = tx;
            cy = ty;
            angle = -Math.PI / 2;
          } else {
            ctx.textAlign = canvasTextAlign;
            ctx.textBaseline = 'top';
            ctx.fillText(hintText, tx, ty);
            hw = ctx.measureText(hintText).width / 2 + 6;
            hh = 10;
            // tx is not the center if canvasTextAlign is left or right
            cx = canvasTextAlign === 'right' ? tx - hw + 6 : canvasTextAlign === 'center' ? tx : tx + hw - 6;
            cy = ty + hh;
            angle = 0;
          }
          ctx.restore();
          
          if (!window._trendTextHintAreas) window._trendTextHintAreas = {};
          window._trendTextHintAreas[d.id] = { cx, cy, hw, hh, angle };
        } else if (selected && vlineText) {
          ctx.save();
          ctx.font = `${fontSize}px "JetBrains Mono", sans-serif`;
          const tw = ctx.measureText(vlineText).width;
          ctx.restore();
          
          let hw = tw / 2 + 6;
          let hh = 10;
          let cx, cy, angle;
          
          if (orientation === 'vertical') {
            cx = tx;
            cy = ty;
            angle = -Math.PI / 2;
          } else {
            cx = canvasTextAlign === 'right' ? tx - hw + 6 : canvasTextAlign === 'center' ? tx : tx + hw - 6;
            cy = ty + hh;
            angle = 0;
          }
          
          if (!window._trendTextHintAreas) window._trendTextHintAreas = {};
          window._trendTextHintAreas[d.id] = { cx, cy, hw, hh, angle };
        } else {
          if (window._trendTextHintAreas) delete window._trendTextHintAreas[d.id];
        }
        ctx.restore();
      } catch(e) { /* render hatası diğer çizimleri etkilemesin */ }
    }

  function _drawHRay(ctx, d, pane, selected) {
    try {
      if (d.price == null || !isFinite(d.price)) return;
      if (d.time == null) return;
      const y = pane.series.priceToCoordinate(d.price);
      if (y == null || !isFinite(y)) return;

      const w = pane.drawingCanvas.width / (window.devicePixelRatio || 1);
      const s = d.style || {};

      // Başlangıç X'ini hesapla; görünür alan dışına çıkmışsa 0'a sabitle
      const extendLeft = !!s.extendLeft;
      const rawX = _timeToX(pane, d.time);
      const startX = extendLeft ? 0 : ((rawX != null && isFinite(rawX)) ? rawX : 0);

      ctx.save();
      ctx.strokeStyle = s.color || '#2962ff';
      ctx.lineWidth   = s.width || 1;
      let dashArr = [];
      if (s.lineStyle === 'dashed') dashArr = [8, 5];
      else if (s.lineStyle === 'dotted') dashArr = [3, 3];
      ctx.setLineDash(dashArr);

      // Price label genişliği
      const showLabel = s.priceLabel !== false;
      let hrayLabelW = 0;
      if (showLabel) {
        ctx.save();
        ctx.font = '10px "JetBrains Mono", sans-serif';
        hrayLabelW = ctx.measureText(_formatPrice(d.price)).width + 8 + 5 + 5;
        ctx.restore();
      }

      const endX = w - hrayLabelW;

      // Başlangıç noktası bitiş noktasının sağına geçmişse çizgiyi gösterme
      // (zaman henüz chart'a girmemiş demektir — sağda bekliyor)
      if (startX < endX) {
        ctx.beginPath();
        ctx.moveTo(startX, y);
        ctx.lineTo(endX, y);
        ctx.stroke();
      }

      if (showLabel) _drawPriceLabel(ctx, d.price, y, pane, s.color || '#2962ff');

      // Metin
      const hrayText = s.text || '';
      if (hrayText) {
        ctx.save();
        ctx.font = `${s.bold ? 'bold ' : ''}${s.italic ? 'italic ' : ''}${s.fontSize || 14}px "JetBrains Mono", sans-serif`;
        ctx.fillStyle = s.textColor || '#ffffff';
        ctx.textBaseline = 'bottom';
        ctx.globalAlpha = 1;
        const textAlignH = s.textAlignH || 'center';
        const textAlignV = s.textAlignV || 'top';
        let tx, ty;
        if (textAlignH === 'left')        { ctx.textAlign = 'left';   tx = startX + 6; }
        else if (textAlignH === 'center') { ctx.textAlign = 'center'; tx = (startX + w) / 2; }
        else if (textAlignH === 'right')  { ctx.textAlign = 'right';  tx = w - 6; }
        if (textAlignV === 'top')         { ctx.textBaseline = 'bottom'; ty = y - 5; }
        else if (textAlignV === 'middle') { ctx.textBaseline = 'middle'; ty = y; }
        else if (textAlignV === 'bottom') { ctx.textBaseline = 'top';    ty = y + 5; }
        ctx.fillText(hrayText, tx, ty);
        ctx.restore();
      }

      // "Add Text" hint — textAlignH'e göre konum
      const textAlignH = s.textAlignH || 'center';
      const textAlignV = s.textAlignV || 'top';

      let hintX;
      if (textAlignH === 'left')       hintX = startX + 6;
      else if (textAlignH === 'right') hintX = endX - 6;
      else                             hintX = (startX + endX) / 2;

      let hintY, hintBaseline;
      if (textAlignV === 'bottom')      { hintY = y + 5;  hintBaseline = 'top'; }
      else if (textAlignV === 'middle') { hintY = y;       hintBaseline = 'middle'; }
      else                              { hintY = y - 5;   hintBaseline = 'bottom'; }

      if (selected && !hrayText) {
        const hintText = 'Add Text';
        ctx.save();
        ctx.font = '12px "JetBrains Mono", sans-serif';
        ctx.fillStyle = s.color || '#2962ff';
        ctx.globalAlpha = 0.6;
        ctx.textAlign = textAlignH === 'right' ? 'right' : textAlignH === 'left' ? 'left' : 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(hintText, hintX, y - 5);
        const hintTextW = ctx.measureText(hintText).width;
        ctx.restore();
        if (!window._trendTextHintAreas) window._trendTextHintAreas = {};
        window._trendTextHintAreas[d.id] = { cx: hintX, cy: y - 5, hw: hintTextW / 2 + 6, hh: 10, angle: 0 };
      } else if (selected && hrayText) {
        ctx.save();
        ctx.font = `${s.fontSize || 14}px "JetBrains Mono", sans-serif`;
        const tw = ctx.measureText(hrayText).width;
        ctx.restore();
        if (!window._trendTextHintAreas) window._trendTextHintAreas = {};
        window._trendTextHintAreas[d.id] = { cx: hintX, cy: hintY, hw: tw / 2 + 6, hh: 10, angle: 0 };
      } else {
        if (window._trendTextHintAreas) delete window._trendTextHintAreas[d.id];
      }

      ctx.restore();
    } catch(e) { console.warn('[HRay] render error', e); }
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

        // Price label genişliği — varsa yatay çizgi label'in önünde durur
        const showPriceLabel = s.priceLabel !== false;
        let priceLabelW = 0;
        if (showPriceLabel) {
          ctx.save();
          ctx.font = '10px "JetBrains Mono", sans-serif';
          priceLabelW = ctx.measureText(_formatPrice(d.price)).width + 18;
          ctx.restore();
        }

        // Yatay çizgi
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w - priceLabelW, y);
        ctx.stroke();

        // Dikey çizgi
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();

        ctx.restore();

        // Price label (sağ kenar — HLine ile aynı mantık)
        if (showPriceLabel) {
          _drawPriceLabel(ctx, d.price, y, pane, s.color || '#2962ff');
        }

        // Time label (alt kenar — VLine ile aynı mantık)
        if (s.timeLabel !== false) {
          const t = d.time;
          let dateObj;
          if (t && typeof t === 'object' && t.year) {
            dateObj = new Date(t.year, t.month - 1, t.day, t.hour || 0, t.minute || 0);
          } else {
            dateObj = new Date(typeof t === 'number' ? t * 1000 : t);
          }
          const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
          const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
          const dd = days[dateObj.getDay()];
          const d2 = String(dateObj.getDate()).padStart(2, '0');
          const mo = months[dateObj.getMonth()];
          const yr = String(dateObj.getFullYear()).slice(2);
          const hh = String(dateObj.getHours()).padStart(2, '0');
          const mm = String(dateObj.getMinutes()).padStart(2, '0');
          const label = `${dd} ${d2} ${mo} '${yr}  ${hh}:${mm}`;
          const fontSize = 11;
          ctx.save();
          ctx.font = `${fontSize}px "JetBrains Mono", sans-serif`;
          const pad = 6;
          const tw = ctx.measureText(label).width;
          const boxW = tw + pad * 2;
          const boxH = fontSize + 8;
          const dpr = window.devicePixelRatio || 1;
          const canvasH = pane.drawingCanvas.height / dpr;
          const bx = x - boxW / 2;
          const by = canvasH - boxH;
          ctx.fillStyle = s.color || '#2962ff';
          ctx.beginPath();
          ctx.roundRect(bx, by, boxW, boxH, 3);
          ctx.fill();
          ctx.fillStyle = '#000000';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(label, x, by + boxH / 2);
          ctx.restore();
        }

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

      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.strokeStyle = '#ffffff';

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
        if (d.p1.price != null) _drawPriceLabel(ctx, d.p1.price, a.y, pane, s.color || '#2962ff');
        if (d.p2.price != null) _drawPriceLabel(ctx, d.p2.price, b.y, pane, s.color || '#2962ff');
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
        ctx.fillStyle = s.textColor || '#ffffff';
        _drawParallelText(ctx, trendText, 1);
        ctx.restore();
      }

      // "Add Text" hint — shown when selected but no text yet (not for trendangle)
      if (selected && !hasText && d.tool !== 'trendangle') {
        ctx.save();
        ctx.font = '12px "JetBrains Mono", sans-serif';
        ctx.fillStyle = '#ffffff';
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

    const s = d.style || {};
    
    const extendLeft = !!s.extendLeft;
    const extendRight = !!s.extendRight;
    let drawA = { x: a.x, y: a.y };
    let drawB = { x: b.x, y: b.y };

    if (extendLeft || extendRight) {
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      if (dx !== 0 || dy !== 0) {
        const len = Math.sqrt(dx * dx + dy * dy);
        const ux = dx / len;
        const uy = dy / len;
        // Sınırlarla kırpmak yerine 100.000 piksel sonsuz uzatıyoruz.
        // Böylece ekran sınırına değen çizgilerin diğer paralel kopyaları ekran ortasında dikey kesilmez.
        const EXT = 100000;
        if (extendLeft) {
          drawA = { x: a.x - ux * EXT, y: a.y - uy * EXT };
        }
        if (extendRight) {
          drawB = { x: b.x + ux * EXT, y: b.y + uy * EXT };
        }
      }
    }

    // p3 yoksa eski channelOffset sistemiyle geriye dönük uyumluluk
    let dy;
    if (!d.p3) {
      if (d._placing) {
        // Çizim devam ediyor, sadece üst çizgiyi göster
        ctx.beginPath();
        ctx.moveTo(drawA.x, drawA.y);
        ctx.lineTo(drawB.x, drawB.y);
        ctx.stroke();
        return;
      }
      // Eski kayıtlı channel: channelOffset pikseli kullan
      dy = d.channelOffset || 40;
    } else {
      const c = _pt2xy(d.p3, pane);
      if (!c) return;

      // Kanal vektörü: p3'ün p1'e göre fiyat farkı kanal yüksekliğini belirler
      // Alt çizgi: üst çizginin eğimi (m) dikkate alınarak c'den geçen paralel çizgi bulunur
      let m = 0;
      if (b.x !== a.x) {
        m = (b.y - a.y) / (b.x - a.x);
      }
      dy = c.y - a.y - m * (c.x - a.x);
    }

    const botAx = drawA.x, botAy = drawA.y + dy;
    const botBx = drawB.x, botBy = drawB.y + dy;

    // Level tanımları — varsayılan (settings'ten gelen varsa kullan)
    const defaultLevels = [
      { v: -0.25, active: false, color: '#787b86', style: 'dashed', width: 1 },
      { v: 0,     active: true,  color: s.color || '#2962ff', style: 'solid', width: s.width || 1 },
      { v: 0.25,  active: false, color: '#787b86', style: 'dashed', width: 1 },
      { v: 0.5,   active: false, color: '#787b86', style: 'dashed', width: 1 },
      { v: 0.75,  active: false, color: '#787b86', style: 'dashed', width: 1 },
      { v: 1,     active: true,  color: s.color || '#2962ff', style: 'solid', width: s.width || 1 },
      { v: 1.25,  active: false, color: '#787b86', style: 'dashed', width: 1 },
    ];
    let levels = s.channelLevels;
    if (!levels || levels.length === 0) {
      levels = defaultLevels;
    } else {
      // Merge missing default levels
      defaultLevels.forEach(dl => {
        if (!levels.find(cl => cl != null && cl.v === dl.v)) levels.push({...dl});
      });
      // Sort by value (referansı koparmamak için in-place null silme)
      for (let i = levels.length - 1; i >= 0; i--) {
        if (levels[i] == null) levels.splice(i, 1);
      }
      levels.sort((a,b) => a.v - b.v);
      // Remove duplicate levels (by v) and ignore undefined entries
      const uniqueLevels = [];
      levels.forEach(cl => {
        if (!cl) return;
        if (!uniqueLevels.find(u => u.v === cl.v)) {
          uniqueLevels.push(cl);
        }
      });
      levels.length = 0;
      levels.push(...uniqueLevels);
    }

    // Background fill (en dış aktif leveller arasını doldur)
    if (s.showBg !== false) {
      let minV = 0, maxV = 1;
      const activeLevels = levels.filter(l => l.active);
      if (activeLevels.length > 0) {
        minV = Math.min(...activeLevels.map(l => l.v));
        maxV = Math.max(...activeLevels.map(l => l.v));
      }
      const bgTopAy = drawA.y + dy * minV;
      const bgTopBy = drawB.y + dy * minV;
      const bgBotAy = drawA.y + dy * maxV;
      const bgBotBy = drawB.y + dy * maxV;

      ctx.save();
      ctx.fillStyle = s.fillColor || 'rgba(9, 105, 218, 0.2)';
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.moveTo(drawA.x, bgTopAy);
      ctx.lineTo(drawB.x, bgTopBy);
      ctx.lineTo(drawB.x, bgBotBy);
      ctx.lineTo(drawA.x, bgBotAy);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Her level çizgisini render et
    for (const lvl of levels) {
      if (!lvl.active) continue;

      const ly1 = drawA.y + dy * lvl.v;
      const ly2 = drawB.y + dy * lvl.v;

      ctx.save();
      ctx.strokeStyle = lvl.color || s.color || '#2962ff';
      ctx.lineWidth   = lvl.width || 1;

      let dash = [];
      if (lvl.style === 'dashed') dash = [8, 5];
      else if (lvl.style === 'dotted') dash = [3, 3];
      ctx.setLineDash(dash);

      ctx.beginPath();
      ctx.moveTo(drawA.x, ly1);
      ctx.lineTo(drawB.x, ly2);
      ctx.stroke();
      ctx.restore();
    }


      // Price labels for Parallel Channel
      if (s.priceLabel !== false) {
        if (d.p1.price != null) _drawPriceLabel(ctx, d.p1.price, a.y, pane, s.color || '#2962ff');
        if (d.p2.price != null) _drawPriceLabel(ctx, d.p2.price, b.y, pane, s.color || '#2962ff');
      }

    // Text rendering logic for Parallel Channel
    const trendText = s.text || '';
    const hasText = !!trendText;
    
    // Check if selected safely (it's not passed as an argument by default in drawing-core.js)
    // We will just assume false for now to avoid the crash, or safely check if arguments[3] is true.
    const isSelected = arguments.length > 3 ? arguments[3] : false;

    if (hasText || isSelected) {
      const lineAngle = Math.atan2(b.y - a.y, b.x - a.x);
      let drawAngle = lineAngle;
      let isFlipped = false;
      if (drawAngle > Math.PI / 2 || drawAngle < -Math.PI / 2) {
        drawAngle += Math.PI;
        isFlipped = true;
      }

      function _drawChannelText(ctx, text, alpha) {
        const textAlignH = s.textAlignH || 'center';
        const textAlignV = s.textAlignV || 'top';
        
        let anchorX, anchorY;
        if (textAlignH === 'left') {
          anchorX = a.x; anchorY = a.y;
        } else if (textAlignH === 'right') {
          anchorX = b.x; anchorY = b.y;
        } else {
          anchorX = (a.x + b.x) / 2;
          anchorY = (a.y + b.y) / 2;
        }

        // "Top"/"Bottom" artık v=0/v=1'e sabit değil — o an AKTİF olan
        // seviyelerin en üsttekine/en, alttakine göre uyarlanıyor (kullanıcı
        // üst/alt seviyeleri açıp kapadıkça metnin konumu da değişiyor).
        // "Inside" (Middle) her zaman kanalın matematiksel ortası olan
        // v=0.5'e göre — bu, 0.5 seviyesinin çizgisi görünür olsun ya da
        // olmasın sabit bir referans.
        let levelV;
        if (textAlignV === 'top' || textAlignV === 'bottom') {
          const activeLs = levels.filter(l => l.active);
          const vs = activeLs.length > 0 ? activeLs.map(l => l.v) : [0, 1];
          levelV = textAlignV === 'top' ? Math.min(...vs) : Math.max(...vs);
        } else {
          levelV = 0.5;
        }

        anchorY += dy * levelV;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(anchorX, anchorY);
        ctx.rotate(drawAngle);

        let canvasAlign = 'center';
        if (textAlignH === 'left')  canvasAlign = isFlipped ? 'right' : 'left';
        if (textAlignH === 'right') canvasAlign = isFlipped ? 'left'  : 'right';
        if (textAlignH === 'center') canvasAlign = 'center';
        ctx.textAlign = canvasAlign;

        const offsetDist = 6;
        let yOffset;
        if (textAlignV === 'bottom') {
          yOffset = offsetDist;
          ctx.textBaseline = 'top';
        } else {
          // "Top" ve "Inside" (Middle) aynı davranışı paylaşıyor: metin
          // referans çizginin (sırasıyla en üst aktif seviye / v=0.5)
          // ÜZERİNDE duruyor — kullanıcı isteği: "0.5 çizgisi üstünde olsun".
          yOffset = -offsetDist;
          ctx.textBaseline = 'bottom';
        }

        const xShift = (canvasAlign === 'left') ? 4 : (canvasAlign === 'right') ? -4 : 0;
        ctx.fillText(text, xShift, yOffset);
        ctx.restore();
      }

      if (hasText) {
        ctx.save();
        ctx.font = `${s.italic ? 'italic ' : ''}${s.bold ? 'bold ' : ''}${s.fontSize || 13}px "JetBrains Mono", sans-serif`;
        ctx.fillStyle = s.textColor || '#ffffff';
        _drawChannelText(ctx, trendText, 1);
        ctx.restore();
      }

      if (isSelected && !hasText) {
        ctx.save();
        ctx.font = '12px "JetBrains Mono", sans-serif';
        ctx.fillStyle = '#ffffff';
        _drawChannelText(ctx, 'Add Text', 0.35);
        ctx.restore();
      }

      const textAlignH = s.textAlignH || 'center';
      const textAlignV = s.textAlignV || 'top';
      let hcx, hcy;
      if (textAlignH === 'left')       { hcx = a.x; hcy = a.y; }
      else if (textAlignH === 'right') { hcx = b.x; hcy = b.y; }
      else                             { hcx = (a.x + b.x) / 2; hcy = (a.y + b.y) / 2; }
      
      let levelV = 0;
      if (textAlignV === 'middle') levelV = 0.5;
      if (textAlignV === 'bottom') levelV = 1;
      hcy += dy * levelV;

      if (!window._trendTextHintAreas) window._trendTextHintAreas = {};
      ctx.save();
      ctx.font = '12px "JetBrains Mono", sans-serif';
      const hintTextW = ctx.measureText(hasText ? trendText : 'Add Text').width;
      ctx.restore();
      window._trendTextHintAreas[d.id] = { cx: hcx, cy: hcy, hw: hintTextW / 2 + 4, hh: 8, angle: lineAngle };
    } else {
      if (window._trendTextHintAreas) delete window._trendTextHintAreas[d.id];
    }
  }

  function _drawInlineLabel(ctx, price, x, y, color, bold, italic, fontSize) {
    if (price == null || x == null || y == null) return;
    const text = _formatPrice(price);
    if (!text) return;
    const fs = fontSize || 10;
    const fontStr = `${italic ? 'italic ' : ''}${bold ? 'bold ' : ''}${fs}px "JetBrains Mono", sans-serif`;

    ctx.save();
    ctx.globalAlpha = 1;
    ctx.font = fontStr;

    const pad  = 4;
    const txtW = ctx.measureText(text).width;
    const boxW = txtW + pad * 2;
    const boxH = fs + 6;
    const bx   = x - boxW / 2;
    const by   = y - boxH - 6;

    // Arka plan kutusu
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(bx, by, boxW, boxH, 3);
    else ctx.rect(bx, by, boxW, boxH);
    ctx.fillStyle = color || '#505060';
    ctx.fill();

    // Metin (arka plana göre kontrast: açık renk üstüne koyu, koyu üstüne açık)
    // Basit luminance hesabı
    let textColor = '#ffffff';
    if (color && color.startsWith('#') && color.length >= 7) {
      const r = parseInt(color.slice(1,3), 16);
      const g = parseInt(color.slice(3,5), 16);
      const b = parseInt(color.slice(5,7), 16);
      const lum = (0.299*r + 0.587*g + 0.114*b) / 255;
      textColor = lum > 0.55 ? '#000000' : '#ffffff';
    }
    ctx.fillStyle    = textColor;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, by + boxH / 2);

    ctx.restore();
  }

  function _drawInfoLine(ctx, d, pane, selected) {
      d.style = d.style || {};
      if (d.style.statsOn === undefined) d.style.statsOn = true;
      if (d.style.alwaysStats === undefined) d.style.alwaysStats = true;
      _drawTrendLine(ctx, d, pane, selected);
    }

  function _drawFlatTopBottom(ctx, d, pane) {
    try {
      const a = _pt2xy(d.p1, pane);  // sol köşe (flat çizginin başlangıcı)
      const b = _pt2xy(d.p2, pane);  // eğimli çizginin sonu
      if (!a || !b) return;

      const s     = d.style || {};
      const color = s.color || '#FF9800';
      const W     = pane.drawingCanvas.width  / (window.devicePixelRatio || 1);
      const H     = pane.drawingCanvas.height / (window.devicePixelRatio || 1);

      // Dash array
      let dashArr = [];
      if (s.lineStyle === 'dashed') dashArr = [8, 5];
      else if (s.lineStyle === 'dotted') dashArr = [3, 3];

      // p3 yoksa fallback: b ile aynı y (çizim henüz tamamlanmadı)
      let c = d.p3 ? _pt2xy(d.p3, pane) : { x: b.x, y: b.y };
      if (!c) c = { x: b.x, y: b.y };

      // Flat çizgi:
      //   - Sol ucu  → p1.x (a.x) — p1'in tam üstünde
      //   - Sağ ucu  → p2.x (b.x) — p2'nin tam üstünde
      //   - Yükseklik → p3'ün fiyat seviyesi (c.y)
      const flatY    = c.y;   // p3'ün y koordinatı
      const flatLeft = a.x;   // p1'in x koordinatı (değişmedi)
      const flatRight = b.x;  // p2'nin x koordinatı (eskiden c.x idi — düzeltildi)

      // Extend — extendLeft/extendRight boolean'ları kullan (trendline ile aynı mantık)
      const extendLeft  = !!s.extendLeft;
      const extendRight = !!s.extendRight;
      let slantA = { ...a };
      let slantB = { ...b };
      let hLeft  = flatLeft;
      let hRight = flatRight;
      if (extendLeft)  { slantA = _extendToEdge(b.x, b.y, a.x, a.y, W, H); hLeft  = 0; }
      if (extendRight) { slantB = _extendToEdge(a.x, a.y, b.x, b.y, W, H); hRight = W; }

      // ── Background fill ───────────────────────────────
      if (s.background !== false) {
        const bgColor   = s.bgColor || '#FF9800';
        const bgOpacity = (s.bgOpacity != null) ? s.bgOpacity / 100 : 0.15;
        ctx.save();
        ctx.globalAlpha = bgOpacity;
        ctx.fillStyle   = bgColor;
        ctx.beginPath();

        // Sol üst: slantA (extend açıksa INF'a uzuyor)
        ctx.moveTo(slantA.x, slantA.y);

        // Sağ üst: slantB (extend açıysa INF'a uzuyor)
        ctx.lineTo(slantB.x, slantB.y);

        // Extend right açıysa: slantB ile flatY arasındaki köşeyi kapat
        if (extendRight) ctx.lineTo(hRight, slantB.y);

        // Sağ alt: yatay çizginin sağ ucu
        ctx.lineTo(hRight, flatY);

        // Sol alt: yatay çizginin sol ucu
        ctx.lineTo(hLeft, flatY);

        // Extend left açıysa: hLeft ile slantA arasındaki köşeyi kapat
        if (extendLeft) ctx.lineTo(hLeft, slantA.y);

        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      // ── Çizgiler ─────────────────────────────────────
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth   = s.width || 1;
      ctx.setLineDash(dashArr);

      // Eğimli çizgi (p1 → p2)
      ctx.beginPath();
      ctx.moveTo(slantA.x, slantA.y);
      ctx.lineTo(slantB.x, slantB.y);
      ctx.stroke();

      // Yatay (flat) çizgi (p1.x → p3.x, p1 fiyat seviyesi)
      ctx.beginPath();
      ctx.moveTo(hLeft,  flatY);
      ctx.lineTo(hRight, flatY);
      ctx.stroke();

      // Arrow caps — trendline ile aynı _drawArrowHead helper'ı kullanılır
      const capLeft  = s.capLeft  || 'normal';
      const capRight = s.capRight || 'normal';

      // Eğimli çizgi uçları: slantA = p1 tarafı, slantB = p2 tarafı
      if (capLeft  === 'arrow') _drawArrowHead(ctx, slantB, slantA); // p1 yönüne ok
      if (capRight === 'arrow') _drawArrowHead(ctx, slantA, slantB); // p2 yönüne ok

      // Yatay çizgi uçları: hLeft = p1.x tarafı, hRight = p2.x tarafı
      const hLeftPt  = { x: hLeft,  y: flatY };
      const hRightPt = { x: hRight, y: flatY };
      if (capLeft  === 'arrow') _drawArrowHead(ctx, hRightPt, hLeftPt);  // sol uca ok
      if (capRight === 'arrow') _drawArrowHead(ctx, hLeftPt,  hRightPt); // sağ uca ok

      ctx.restore();

      // ── Fiyat etiketleri ─────────────────────────────
      if (s.showPrices !== false) {
        const labelColor  = s.priceColor  || '#2962ff';
        const labelFs     = s.priceFontSize || 10;
        const labelBold   = !!s.priceBold;
        const labelItalic = !!s.priceItalic;

        // p1 etiketi — eğimli çizginin sol noktasının üstünde
        _drawInlineLabel(ctx, d.p1.price, a.x, a.y, labelColor, labelBold, labelItalic, labelFs);

        // p2 etiketi — eğimli çizginin sağ noktasının üstünde
        _drawInlineLabel(ctx, d.p2.price, b.x, b.y, labelColor, labelBold, labelItalic, labelFs);

        // p3 etiketi — yatay çizginin sağ ucunun üstünde (p2.x'te, p3 fiyatında)
        if (d.p3) {
          _drawInlineLabel(ctx, d.p3.price, b.x, flatY, labelColor, labelBold, labelItalic, labelFs);
        }
      }

      // ── Text label ──────────────────────────────────
      const ftbText = s.text || '';
      const hasText = !!ftbText;

      if (hasText) {
        const textAlignH = s.textAlignH || 'center';
        const textAlignV = s.textAlignV || 'top';

        // Her zaman orijinal p1(a) ve p2(b) — slantA/B değil, extend'den etkilenmez
        const tH = textAlignH === 'left' ? 0.05 : textAlignH === 'right' ? 0.95 : 0.5;

        // Eğimli çizgi: a → b (extend edilmemiş orijinal noktalar)
        const slantPt = {
          x: a.x + (b.x - a.x) * tH,
          y: a.y + (b.y - a.y) * tH
        };

        // Yatay çizgi: flatLeft → flatRight (hLeft/hRight değil, extend edilmemiş)
        const flatPt = {
          x: flatLeft + (flatRight - flatLeft) * tH,
          y: flatY
        };

        let anchorX, anchorY, rawAngle;

        if (textAlignV === 'top') {
          anchorX  = flatPt.x;
          anchorY  = flatPt.y;
          rawAngle = 0;
        } else if (textAlignV === 'bottom') {
          anchorX  = slantPt.x;
          anchorY  = slantPt.y;
          rawAngle = Math.atan2(b.y - a.y, b.x - a.x);  // a/b kullan
        } else {
          anchorX  = (flatPt.x + slantPt.x) / 2;
          anchorY  = (flatPt.y + slantPt.y) / 2;
          rawAngle = Math.atan2(b.y - a.y, b.x - a.x) / 2;  // a/b kullan
        }

        let drawAngle = rawAngle;
        if (drawAngle > Math.PI / 2 || drawAngle < -Math.PI / 2) drawAngle += Math.PI;

        ctx.save();
        ctx.globalAlpha = 1;
        ctx.font      = `${s.italic ? 'italic ' : ''}${s.bold ? 'bold ' : ''}${s.fontSize || 13}px "JetBrains Mono", sans-serif`;
        ctx.fillStyle = s.textColor || '#ffffff';
        ctx.translate(anchorX, anchorY);
        ctx.rotate(drawAngle);
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(ftbText, 0, -4);
        ctx.restore();
      }

    } catch(e) { /* render hatası diğer çizimleri etkilemesin */ }
  }

  // ── TEK DOĞRULUK KAYNAĞI: Regression Trend'in OLS hesabı ────────────
  // Daha önce bu hesap (candle filtreleme, slope/intercept/stdDev/points)
  // hem burada (çizim) hem drawing-core.js'in hit-test'inde BAĞIMSIZ birer
  // kopya olarak yazılıydı — Fibonacci araçlarında defalarca yaşadığımız
  // "iki kopya birbirinden sapar" riskiyle aynı desen. Artık ikisi de
  // SADECE bu fonksiyonu çağırıyor.
  function _computeRegression(d, pane) {
    if (!d.p1 || !d.p2) return null;
    const s = d.style || {};

    const candles = pane.candlesData;
    if (!candles || candles.length === 0) return null;

    const toSec = t => typeof t === 'object'
      ? new Date(t.year, t.month - 1, t.day, t.hour || 0, t.minute || 0).getTime() / 1000
      : t;

    const tMin = Math.min(toSec(d.p1.time), toSec(d.p2.time));
    const tMax = Math.max(toSec(d.p1.time), toSec(d.p2.time));
    const inRange = candles.filter(c => {
      const ct = toSec(c.time);
      return ct >= tMin && ct <= tMax;
    });
    if (inRange.length < 3) return null;

    // — Source seçimi —
    const src = s.source || 'close';
    const getPrice = c => {
      if (src === 'open')  return c.open;
      if (src === 'high')  return c.high;
      if (src === 'low')   return c.low;
      if (src === 'hl2')   return (c.high + c.low) / 2;
      if (src === 'hlc3')  return (c.high + c.low + c.close) / 3;
      if (src === 'ohlc4') return (c.open + c.high + c.low + c.close) / 4;
      return c.close;
    };

    const n = inRange.length;

    // — OLS Linear Regression —
    let sx = 0, sy = 0, sxy = 0, sx2 = 0;
    inRange.forEach((c, i) => {
      const p = getPrice(c);
      sx  += i;
      sy  += p;
      sxy += i * p;
      sx2 += i * i;
    });
    const denom    = n * sx2 - sx * sx;
    if (denom === 0) return null;
    const slope     = (n * sxy - sx * sy) / denom;
    const intercept = (sy - slope * sx) / n;

    // — Standart Sapma (degrees of freedom = n-2) —
    let sqDev = 0;
    inRange.forEach((c, i) => {
      const res = getPrice(c) - (slope * i + intercept);
      sqDev += res * res;
    });
    const stdDev = Math.sqrt(sqDev / (n - 2));

    // — Pearson's R —
    const pearsonR = (() => {
      const meanX = sx / n;
      const meanY = sy / n;
      let num = 0, dx2 = 0, dy2 = 0;
      inRange.forEach((c, i) => {
        const p  = getPrice(c);
        const dx = i - meanX;
        const dy = p - meanY;
        num += dx * dy;
        dx2 += dx * dx;
        dy2 += dy * dy;
      });
      const div = Math.sqrt(dx2 * dy2);
      return div === 0 ? 0 : num / div;
    })();

    // — Her mum için regression fiyatını x koordinatına çevir —
    // Sadece inRange.length kadar nokta — pixel döngüsü yok
    const points = inRange.map((c, i) => {
      const regPrice = slope * i + intercept;
      const cx = _timeToX(pane, c.time);
      return { i, cx, regPrice };
    }).filter(p => p.cx != null && isFinite(p.cx));

    if (points.length < 2) return null;

    return { inRange, n, slope, intercept, stdDev, pearsonR, points };
  }

  function _drawRegressionTrend(ctx, d, pane) {
    try {
      if (!d.p1 || !d.p2) return;
      const s = d.style || {};

      const reg = _computeRegression(d, pane);
      if (!reg) return;
      const { n, slope, intercept, stdDev, pearsonR, points } = reg;

      const upperDev = s.upperDev ?? 2;
      const lowerDev = s.lowerDev ?? 2;
      const useUpper = s.useUpperDev !== false;
      const useLower = s.useLowerDev !== false;

      const W = pane.drawingCanvas.width  / (window.devicePixelRatio || 1);
      const H = pane.drawingCanvas.height / (window.devicePixelRatio || 1);

      // Extend Right: son noktadan sağa doğru regression çizgisini uzat
      let extPoints = [...points];
      if (s.extendRight) {
        // Son indeksten canvas sağ kenarına kadar
        const last = points[points.length - 1];
        // Sağ kenara karşılık gelen "idx" değerini bul
        // Son mum indeksi = n-1, sağ kenar x = W
        // idx lineer interpolasyon: her mum arası pixel farkı sabit değil
        // O yüzden sadece görsel olarak son noktadan slope'u uzatıyoruz
        const first = points[0];
        const pxPerBar = (last.cx - first.cx) / (n - 1);
        if (pxPerBar > 0) {
          const extraBars = Math.ceil((W - last.cx) / pxPerBar);
          for (let e = 1; e <= extraBars; e++) {
            const ei = (n - 1) + e;
            const ex = last.cx + e * pxPerBar;
            if (ex > W) break;
            extPoints.push({ i: ei, cx: ex, regPrice: slope * ei + intercept });
          }
        }
      }

      // — Çizim yardımcısı: fiyat offsetiyle çizgi çiz —
      const drawLine = (pts, offset) => {
        ctx.beginPath();
        let started = false;
        for (const p of pts) {
          const py = pane.series.priceToCoordinate(p.regPrice + offset);
          if (py == null || !isFinite(py)) { started = false; continue; }
          if (!started) { ctx.moveTo(p.cx, py); started = true; }
          else ctx.lineTo(p.cx, py);
        }
        ctx.stroke();
      };

      // — Fill yardımcısı —
      const drawFill = (pts, offsetTop, offsetBot, fillColor) => {
        ctx.save();
        ctx.beginPath();
        let started = false;
        for (const p of pts) {
          const py = pane.series.priceToCoordinate(p.regPrice + offsetTop);
          if (py == null || !isFinite(py)) { started = false; continue; }
          if (!started) { ctx.moveTo(p.cx, py); started = true; }
          else ctx.lineTo(p.cx, py);
        }
        for (let j = pts.length - 1; j >= 0; j--) {
          const p  = pts[j];
          const py = pane.series.priceToCoordinate(p.regPrice + offsetBot);
          if (py == null || !isFinite(py)) continue;
          ctx.lineTo(p.cx, py);
        }
        ctx.closePath();
        ctx.fillStyle = fillColor;
        ctx.fill();
        ctx.restore();
      };

      ctx.save();
      ctx.strokeStyle = s.color || '#2962ff';
      ctx.lineWidth   = s.width  || 1;
      const dashArr = s.lineStyle === 'dashed' ? [8, 5]
                    : s.lineStyle === 'dotted' ? [3, 3] : [];
      ctx.setLineDash(dashArr);

      const showBase = s.showBase !== false;
      const showUp   = s.showUp   !== false;
      const showDown = s.showDown !== false;

      // Fill — önce çiz ki çizgiler üstüne gelsin
      const hexToRgba = (hex, opacity) => {
        const h = hex.replace('#', '');
        const r = parseInt(h.substring(0,2),16);
        const g = parseInt(h.substring(2,4),16);
        const b = parseInt(h.substring(4,6),16);
        return `rgba(${r},${g},${b},${opacity})`;
      };
      const toRgba = (color, opacity) => {
        if (!color) return `rgba(41,98,255,${opacity})`;
        if (color.startsWith('#')) return hexToRgba(color, opacity);
        if (color.startsWith('rgba')) return color.replace(/[\d.]+\)$/, `${opacity})`);
        return color;
      };

      // Up fill: center → upper band arası (upColor + upOpacity)
      const upOpacity   = s.upOpacity   ?? 0.1;
      const fillUp      = toRgba(s.upColor   || '#2962ff', upOpacity);

      // Base fill: center → lower band arası (color + baseOpacity)
      const baseOpacity = s.baseOpacity ?? 0.1;
      const fillBase    = toRgba(s.color || '#2962ff', baseOpacity);

      if (useUpper && showUp)   drawFill(extPoints,  upperDev * stdDev, 0, fillUp);
      if (useLower && showDown) drawFill(extPoints, 0, -lowerDev * stdDev, fillBase);

      // Center line (Base)
      if (showBase) {
        ctx.strokeStyle = s.color     || '#2962ff';
        ctx.lineWidth   = s.width     || 1;
        const bd = s.lineStyle === 'dashed' ? [8,5] : s.lineStyle === 'dotted' ? [3,3] : [];
        ctx.setLineDash(bd);
        drawLine(extPoints, 0);
      }

      // Upper band
      if (useUpper && showUp) {
        ctx.strokeStyle = s.upColor   || '#2962ff';
        ctx.lineWidth   = s.upWidth   || 1;
        const ud = s.upStyle === 'dashed' ? [8,5] : s.upStyle === 'dotted' ? [3,3] : [5,4];
        ctx.setLineDash(ud);
        drawLine(extPoints, upperDev * stdDev);
      }

      // Lower band
      if (useLower && showDown) {
        ctx.strokeStyle = s.downColor || '#2962ff';
        ctx.lineWidth   = s.downWidth || 1;
        const dd = s.downStyle === 'dashed' ? [8,5] : s.downStyle === 'dotted' ? [3,3] : [];
        ctx.setLineDash(dd);
        drawLine(extPoints, -lowerDev * stdDev);
      }

      ctx.restore();

      // — Anchor noktaları: P1 ve P2 center line üzerinde —
      const p1pt  = points[0];
      const p2pt  = points[points.length - 1];
      const p1py  = pane.series.priceToCoordinate(p1pt.regPrice);
      const p2py  = pane.series.priceToCoordinate(p2pt.regPrice);

      if (p1py != null && isFinite(p1py)) {
        ctx.save();
        ctx.strokeStyle = s.color || '#2962ff';
        ctx.lineWidth = 2;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.arc(p1pt.cx, p1py, 3, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      if (p2py != null && isFinite(p2py)) {
        ctx.save();
        ctx.strokeStyle = s.color || '#2962ff';
        ctx.lineWidth = 2;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.arc(p2pt.cx, p2py, 3, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }


      // Price labels for Regression Trend
      if (s.priceLabel !== false) {
        if (p1pt.regPrice != null) _drawPriceLabel(ctx, p1pt.regPrice, p1py, pane, s.color || '#2962ff');
        if (p2pt.regPrice != null) _drawPriceLabel(ctx, p2pt.regPrice, p2py, pane, s.color || '#2962ff');
      }

      // — Pearson's R metni —
      if (s.showPearson !== false) {
        const rText = `R: ${pearsonR.toFixed(4)}`;
        ctx.save();
        ctx.font      = '11px "JetBrains Mono", sans-serif';
        ctx.fillStyle = s.color || '#2962ff';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        const labelX = p1pt.cx + 4;
        const labelY = (p1py ?? 20) - 4;
        ctx.fillText(rText, labelX, labelY);
        ctx.restore();
      }

    } catch(e) { /* render hatasının diğer çizimleri etkilememesi için */ }
  }


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
    // Tek doğruluk kaynağı — drawing-core.js'in hit-test'i de BUNU
    // çağırır, kendi kopyasını hesaplamaz.
    computeRegression: _computeRegression
  };
})();