/* ──────────────────────────────────────────────────────────
   drawing-core.js — Multi-Pane Drawing Manager
   Overlays canvas on LightweightCharts panes and coordinates drawings.
   
   Magnet Mode (TradingView style):
   - Does NOT change cursor or crosshair visuals
   - Only affects WHERE the drawing anchor point is placed
   - Weak:  snaps to nearest OHLC only when cursor is close (~20px)
   - Strong: always snaps to nearest OHLC regardless of distance
────────────────────────────────────────────────────────── */
window.DrawingManager = (() => {
  let _activeTool = 'pointer';
  let _inProgress = null;
  let _selectedId = null;
  let _dragState = null; // { d, hitType, startX, startY, origP1, origP2, origPrice, origTime }
  let _snapCrosshair = null;
  let _hoverPt = null; // { drawingId, ptId } — hovered rect anchor
  let _hoverDrawingId = null; // id of drawing mouse is hovering over
  let _hoverHitType = null; // hit type of hovered drawing
  let _allHideStates = {}; // tracks hide_drawings, hide_indicators, etc.
  let _magnetMode = 'off'; // Authoritative value — updated via drawing:magnet EventBus
  // Tracks whether the last pointerdown was claimed by us.
  // Used in onMouseUp to claim (or not) the matching pointerup,
  // preventing LWC from receiving orphaned pointerup events that corrupt its pan state.
  let _lastPointerdownClaimed = false;
  let _globalLock = false;
  let _pendingTextEditTimer = null;

  let _toolStyles = {};

  function _getToolStyle(tool) {
    if (tool.startsWith('fib-')) return {};
    // Load from State if not in local cache
    if (!_toolStyles || Object.keys(_toolStyles).length === 0) {
      _toolStyles = State.get('drawingStyles') || {};
    }
    // If we have a saved style for this tool, clone it
    if (_toolStyles[tool]) return JSON.parse(JSON.stringify(_toolStyles[tool]));
    if (tool === 'texttool') return { fontSize: 16, textColor: '#d1d4dc', fillColor: 'rgba(0,0,0,0)', bold: false, italic: false, textWidth: 200, textWrap: true };
    if (tool === 'note') return { fontSize: 13, textColor: '#d1d4dc', fillColor: '#1e222d', borderColor: '#363c4e', bold: false, italic: false };
    if (tool === 'callout') return { fontSize: 13, textColor: '#d1d4dc', fillColor: '#1e222d', borderColor: '#363c4e', bold: false, italic: false };
    if (tool === 'pricenote') return { textColor: '#d1d4dc', fillColor: '#1e222d', borderColor: '#363c4e', fontSize: 13 };
    if (tool === 'pricelabel') return { textColor: '#d1d4dc', fillColor: '#2962ff', fontSize: 12 };
    if (tool === 'flagmark') return { color: '#2962ff', textColor: '#ffffff', fontSize: 11 };
    if (tool === 'tableanno') return { textColor: '#d1d4dc', fillColor: '#1e222d', borderColor: '#363c4e', fontSize: 12, rows: 2, cols: 3 };
    if (tool === 'trendline') return { color: '#d1d4dc', width: 1, lineStyle: 'solid', extendLeft: false, extendRight: false };
    if (tool === 'ray') return { color: '#d1d4dc', width: 1, lineStyle: 'solid', extendLeft: false, extendRight: true };
    if (tool === 'extended') return { color: '#d1d4dc', width: 1, lineStyle: 'solid', extendLeft: true, extendRight: true };
    // Otherwise return a generic default
    return { color: '#2962ff', width: 1, lineStyle: 'solid' };
  }

  let _undoStack = [];
  let _redoStack = [];

  function _saveHistory() {
    const currentDrawings = JSON.stringify(State.get('drawings') || {});
    if (_undoStack.length > 0 && _undoStack[_undoStack.length - 1] === currentDrawings) return;
    _undoStack.push(currentDrawings);
    _redoStack = [];
    if (_undoStack.length > 50) _undoStack.shift();
  }

  function undo() {
    if (_undoStack.length === 0) return;
    _redoStack.push(JSON.stringify(State.get('drawings') || {}));
    const prevState = _undoStack.pop();
    State.set('drawings', JSON.parse(prevState), true);
    requestRedrawAll();
  }

  function redo() {
    if (_redoStack.length === 0) return;
    _undoStack.push(JSON.stringify(State.get('drawings') || {}));
    const nextState = _redoStack.pop();
    State.set('drawings', JSON.parse(nextState), true);
    requestRedrawAll();
  }

  // ── Helper: Normalized TimeFrame visibility check ────────────────────
  function _normalizeVizTf(tf) {
    if (!tf) return '';
    return tf.toLowerCase().replace(/m|h|d|w|M/, (m) => m.toLowerCase());
  }

  function _isDrawingVisible(d, pane) {
    if (!d || !pane || !pane.tf) return true; // Default to visible
    if (!d.style || !d.style.visibility) return true;
    const normActiveTf = _normalizeVizTf(pane.tf);
    const matchKey = Object.keys(d.style.visibility).find(k => _normalizeVizTf(k) === normActiveTf);
    if (matchKey !== undefined && d.style.visibility[matchKey] === false) {
      return false;
    }
    return true;
  }

  // ── Mouse Events (called from ChartPane) ────────────────────────
  function onMouseDown(pane, e) {
    const series = pane.series;
    if (!series) return false;

    const rect = pane.cvs.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const rawTime = pane.chart.timeScale().coordinateToTime(x);
    const rawPrice = series.coordinateToPrice(y);

    if (rawTime === null || rawPrice === null) {
      _lastPointerdownClaimed = false;
      return false;
    }

    // Magnet snap — only affects the anchor point, NOT the cursor
    const { time, price } = _snapToCandle(pane, rawTime, rawPrice);
    const pt = { time, price };

    if (_activeTool === 'pointer') {
      const drawings = getDrawingsForPane(pane.symbol);
      let hitId = null, hitType = null, hitDrawing = null;
      for (let i = drawings.length - 1; i >= 0; i--) {
        const d = drawings[i];
        const ht = _hitTest(x, y, d, pane);
        if (ht) { hitId = d.id; hitType = ht; hitDrawing = d; break; }
      }

      if (hitId) {
        const isReClick = (hitId === _selectedId);
        _selectedId = hitId;
        // For position tools, calculate topY so toolbar can appear above the shape
        let topY = e.clientY;
        if (['longpos', 'shortpos', 'posforecast'].includes(hitDrawing.tool)) {
          const a = _pt2xy(hitDrawing.p1, pane);
          const b = hitDrawing.p2 ? { y: pane.series.priceToCoordinate(hitDrawing.p2.price) } : null;
          const c = hitDrawing.p3 ? { y: pane.series.priceToCoordinate(hitDrawing.p3.price) } : null;
          if (a) {
            const ys = [a.y, b?.y, c?.y].filter(v => v != null);
            const rawTop = Math.min(...ys);
            const rect = pane.drawingCanvas.getBoundingClientRect();
            topY = rect.top + rawTop;
          }
        }
        EventBus.emit('drawing:selected', { id: hitId, symbol: pane.symbol, x: e.clientX, y: e.clientY, topY });
        if (!hitDrawing.locked && !_globalLock) {
          _saveHistory();
          _dragState = {
            d: hitDrawing, hitType,
            startX: x, startY: y,
            isReClick, // track for single-click edit
            origP1: hitDrawing.p1 ? { ...hitDrawing.p1 } : null,
            origP2: hitDrawing.p2 ? { ...hitDrawing.p2 } : null,
            origP3: hitDrawing.p3 ? { ...hitDrawing.p3 } : null,
            origP4: hitDrawing.p4 ? { ...hitDrawing.p4 } : null,
            origPoints: hitDrawing.points ? hitDrawing.points.map(p => ({ ...p })) : null,
            origPrice: hitDrawing.price, origTime: hitDrawing.time
          };
        }
        requestRedrawAll();
        _lastPointerdownClaimed = true;
        return true;
      } else {
        if (_selectedId) {
          _selectedId = null;
          EventBus.emit('drawing:selected', { id: null });
          requestRedrawAll();
        }
      }
      _lastPointerdownClaimed = false;
      return false;
    }

    // ── Measure Tool ──────────────────────────────────────────
    if (_activeTool === 'measure') {
      if (_inProgress && _inProgress.tool === 'measure' && _inProgress.finished) {
        _inProgress = null;
        EventBus.emit('drawing:tool:set', { tool: 'pointer' });

        // Reset sidebar UI highlight
        document.querySelectorAll('.sidebar__btn[data-id="measure"]').forEach(b => b.classList.remove('active'));

        requestRedrawAll();
        _lastPointerdownClaimed = true;
        return true;
      }

      if (!_inProgress || _inProgress.tool !== 'measure') {
        _inProgress = { tool: 'measure', symbol: pane.symbol, p1: pt, p2: { ...pt }, id: _uid() };
      } else {
        _inProgress.p2 = pt;
        _inProgress.finished = true;
      }
      _lastPointerdownClaimed = true;
      requestRedrawAll();
      return true;
    }

    if (_activeTool === 'hline') {
      if (price == null || !isFinite(price)) return false;
      _finishDrawing(pane.symbol, { tool: 'hline', price, id: _uid(), style: _getToolStyle('hline') });
      _lastPointerdownClaimed = true;
      return true;
    }
    if (_activeTool === 'vline') {
      if (time == null) return false;
      _finishDrawing(pane.symbol, { tool: 'vline', time, id: _uid(), style: _getToolStyle('vline') });
      _lastPointerdownClaimed = true;
      return true;
    }
    if (_activeTool === 'hray') {
      if (price == null || !isFinite(price) || time == null) return false;
      _finishDrawing(pane.symbol, { tool: 'hray', price, time, p1: { time, price }, id: _uid(), style: _getToolStyle('hray') });
      _lastPointerdownClaimed = true;
      return true;
    }
    if (_activeTool === 'crossline') {
      if (price == null || !isFinite(price) || time == null) return false;
      _finishDrawing(pane.symbol, { tool: 'crossline', price, time, id: _uid(), style: _getToolStyle('crossline') });
      _lastPointerdownClaimed = true;
      return true;
    }
    if (_activeTool === 'texttool') {
      const d = {
        tool: 'texttool',
        p1: pt,
        id: _uid(),
        text: 'Text',
        style: _getToolStyle('texttool') || { fontSize: 16, textColor: '#d1d4dc', fillColor: 'rgba(0,0,0,0)', bold: false, italic: false }
      };
      _finishDrawing(pane.symbol, d, pane);
      _selectedId = d.id;

      // Emit drawing:selected so float/property toolbar opens immediately
      EventBus.emit('drawing:selected', { id: d.id, symbol: pane.symbol, x: e.clientX, y: e.clientY });

      // Open inline editor after paint; refocus after pointerup so canvas doesn't steal it
      requestAnimationFrame(() => {
        window.DrawingAnnotations.openInlineTextEditor(d, pane, null);
        // Re-grab focus after the pointerup that will fire on the canvas
        window.addEventListener('pointerup', () => {
          const ta = document.getElementById('inline-text-editor');
          if (ta) { ta.focus(); ta.selectionStart = ta.selectionEnd = ta.value.length; }
        }, { capture: true, once: true });
      });

      _lastPointerdownClaimed = true;
      return true;
    }

    // ── Single-point Text annotation tools ───────────────────
    if (['pricelabel', 'flagmark', 'tableanno'].includes(_activeTool)) {
      const d = { tool: _activeTool, p1: pt, id: _uid(), text: '', style: _getToolStyle(_activeTool) };
      _finishDrawing(pane.symbol, d);
      _selectedId = d.id;
      EventBus.emit('drawing:selected', { id: d.id, symbol: pane.symbol, x: e.clientX, y: e.clientY });
      _lastPointerdownClaimed = true;
      return true;
    }

    // ── Single-point VWAP anchor ────────────────────────
    if (_activeTool === 'vwap') {
      _finishDrawing(pane.symbol, { tool: 'vwap', p1: pt, id: _uid(), style: { ..._lastDrawingStyle } });
      _lastPointerdownClaimed = true;
      return true;
    }

    // ── Single-point Markers ────────────────────────────
    if (['arrowmarker', 'arrowup', 'arrowdown'].includes(_activeTool)) {
      _finishDrawing(pane.symbol, { tool: _activeTool, p1: pt, id: _uid(), style: _getToolStyle(_activeTool) });
      _lastPointerdownClaimed = true;
      return true;
    }

    // ── Two-point drawing tools (click-click) ──────────
    const TWO_PT_TOOLS = [
      'trendline', 'ray', 'extended', 'rect', 'channel', 'arrowdraw', 'trendangle',
      'infoline', 'flattopbottom', 'regression',
      'fib-ret', 'fib-timezone', 'fib-circles', 'fib-speedfan', 'fib-spiral',
      'gann-fan', 'gann-box', 'gann-sq', 'gann-sqfixed',
      'cyclic-lines', 'time-cycles', 'sine-line',
      'disjointch', 'circle', 'ellipse',
      'note', 'callout', 'pricenote'
    ];
    if (TWO_PT_TOOLS.includes(_activeTool)) {
      if (!_inProgress) {
        _inProgress = { tool: _activeTool, symbol: pane.symbol, p1: pt, p2: pt, id: _uid(), style: _getToolStyle(_activeTool) };
      } else if (!_inProgress.p3) {
        // Second click: finish drawing
        if (['note', 'callout', 'pricenote'].includes(_activeTool)) {
          _inProgress.p2 = { time: rawTime, price: rawPrice };
        } else {
          _inProgress.p2 = pt;
        }
        const finished = { ..._inProgress };
        _inProgress = null;
        _finishDrawing(pane.symbol, finished);

        if (['note', 'callout'].includes(finished.tool)) {
          _selectedId = finished.id;
          EventBus.emit('drawing:selected', { id: finished.id, symbol: pane.symbol, x: e.clientX, y: e.clientY });
          requestAnimationFrame(() => {
            window.DrawingAnnotations.openInlineTextEditor(finished, pane);
            window.addEventListener('pointerup', () => {
              const ta = document.getElementById('inline-text-editor');
              if (ta) { ta.focus(); ta.selectionStart = ta.selectionEnd = ta.value.length; }
            }, { capture: true, once: true });
          });
        }
      }
      requestRedrawAll();
      _lastPointerdownClaimed = true;
      return true;
    }

    // ── Three-point drawing tools (click-click-click) ───
    const THREE_PT_TOOLS = [
      'fib-ext', 'fib-channel', 'fib-timebased',
      'pitchfork', 'schiffpitch', 'modschiff', 'insidepitch',
      'rotatedrect', 'triangle', 'arc', 'curve'
    ];
    if (THREE_PT_TOOLS.includes(_activeTool)) {
      if (!_inProgress) {
        _inProgress = { tool: _activeTool, symbol: pane.symbol, p1: pt, p2: pt, p3: null, id: _uid(), style: _getToolStyle(_activeTool) };
      } else if (!_inProgress.p3) {
        _inProgress.p2 = pt;
        _inProgress.p3 = pt; // p3 will follow mouse until next click
      } else {
        _inProgress.p3 = pt;
        const finished = { ..._inProgress };
        _inProgress = null;
        _finishDrawing(pane.symbol, finished);
      }
      requestRedrawAll();
      _lastPointerdownClaimed = true;
      return true;
    }

    // ── Four-point drawing tools (click-click-click-click) ───
    const FOUR_PT_TOOLS = ['doublecurve'];
    if (FOUR_PT_TOOLS.includes(_activeTool)) {
      if (!_inProgress) {
        _inProgress = { tool: _activeTool, symbol: pane.symbol, p1: pt, p2: pt, p3: null, p4: null, id: _uid(), style: _getToolStyle(_activeTool) };
      } else if (!_inProgress.p3) {
        _inProgress.p2 = pt;
        _inProgress.p3 = pt;
      } else if (!_inProgress.p4) {
        _inProgress.p3 = pt;
        _inProgress.p4 = pt;
      } else {
        _inProgress.p4 = pt;
        const finished = { ..._inProgress };
        _inProgress = null;
        _finishDrawing(pane.symbol, finished);
      }
      requestRedrawAll();
      _lastPointerdownClaimed = true;
      return true;
    }

    // ── Multi-point drawing tools (click-click-...-click) ──
    const MULTI_PT_TOOLS = ['polyline', 'pathtool'];
    if (MULTI_PT_TOOLS.includes(_activeTool)) {
      if (!_inProgress) {
        _inProgress = { tool: _activeTool, symbol: pane.symbol, points: [pt, pt], id: _uid(), style: _getToolStyle(_activeTool) };
      } else {
        const lastPt = _inProgress.points[_inProgress.points.length - 2];
        // If clicked on the exact same spot (double click), finish drawing
        if (lastPt && Math.abs(x - _timeToX(pane, lastPt.time)) < 5 && Math.abs(y - series.priceToCoordinate(lastPt.price)) < 5) {
          _inProgress.points.pop(); // remove the following cursor point
          if (_inProgress.points.length > 1) {
            const finished = { ..._inProgress };
            _inProgress = null;
            _finishDrawing(pane.symbol, finished);
          } else {
            _inProgress = null; // not enough points
          }
        } else {
          // Add new point
          _inProgress.points[_inProgress.points.length - 1] = pt; // lock previous point
          _inProgress.points.push(pt); // add new following cursor point
        }
      }
      requestRedrawAll();
      _lastPointerdownClaimed = true;
      return true;
    }

    if (['longpos', 'shortpos', 'posforecast'].includes(_activeTool)) {
      const candles = pane.candlesData || [];
      let p2Time = pt.time;
      if (candles.length > 1) {
        const avgInterval = (candles[candles.length - 1].time - candles[0].time) / candles.length;
        p2Time = pt.time + (avgInterval > 0 ? avgInterval * 25 : 3600 * 25); // bigger initial width
      } else {
        p2Time = pt.time + 3600 * 25;
      }

      // Larger initial size — 5% target, 2.5% stop
      const gap = rawPrice * 0.05;
      const stopGap = rawPrice * 0.025;
      const targetP = _activeTool === 'shortpos' ? rawPrice - gap : rawPrice + gap;
      const stopP = _activeTool === 'shortpos' ? rawPrice + stopGap : rawPrice - stopGap;

      const finished = {
        tool: _activeTool,
        symbol: pane.symbol,
        p1: pt,
        p2: { time: p2Time, price: targetP },
        p3: { time: p2Time, price: stopP },
        id: _uid(),
        style: _getToolStyle(_activeTool)
      };
      _finishDrawing(pane.symbol, finished);
      requestRedrawAll();

      _lastPointerdownClaimed = true;
      return true;
    }

    _lastPointerdownClaimed = false;
    return false;
  }

  function onMouseMove(pane, e) {
    const rect = pane.cvs.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (_activeTool === 'pointer' || _activeTool.startsWith('cursor-')) {
      _snapCrosshair = null;

      // Handle dragging
      if (_dragState) {
        const d = _dragState.d;
        const rawTime = pane.chart.timeScale().coordinateToTime(x);
        const rawPrice = pane.series?.coordinateToPrice(y);
        if (rawTime === null || rawPrice === null) return true;

        const dx = x - _dragState.startX;
        const dy = y - _dragState.startY;

        if (_dragState.hitType === 'p1') {
          if (['longpos', 'shortpos', 'posforecast'].includes(d.tool)) {
            const origP1X = _timeToX(pane, _dragState.origP1.time);
            const origP1Y = pane.series.priceToCoordinate(_dragState.origP1.price);
            const origP2X = _timeToX(pane, _dragState.origP2.time);
            const origP2Y = pane.series.priceToCoordinate(_dragState.origP2.price);
            const origP3X = _timeToX(pane, _dragState.origP3.time);
            const origP3Y = pane.series.priceToCoordinate(_dragState.origP3.price);

            d.p1.time = pane.chart.timeScale().coordinateToTime(origP1X + dx);
            d.p1.price = pane.series.coordinateToPrice(origP1Y + dy);
            d.p2.time = pane.chart.timeScale().coordinateToTime(origP2X + dx);
            d.p2.price = pane.series.coordinateToPrice(origP2Y + dy);
            d.p3.time = pane.chart.timeScale().coordinateToTime(origP3X + dx);
            d.p3.price = pane.series.coordinateToPrice(origP3Y + dy);
          } else {
            const { time, price } = _snapToCandle(pane, rawTime, rawPrice);
            d.p1 = { time, price };
          }
        } else if (_dragState.hitType === 'p2') {
          const noMagnetP2 = ['note', 'callout', 'pricenote', 'pricelabel', 'tableanno', 'texttool'];
          if (noMagnetP2.includes(d.tool)) {
            d.p2 = { time: rawTime, price: rawPrice };
          } else {
            const { time, price } = _snapToCandle(pane, rawTime, rawPrice);
            d.p2 = { time, price };
          }
        } else if (_dragState.hitType === 'p3') {
          const { time, price } = _snapToCandle(pane, rawTime, rawPrice);
          d.p3 = { time, price };
        } else if (_dragState.hitType === 'p4') {
          const { time, price } = _snapToCandle(pane, rawTime, rawPrice);
          d.p4 = { time, price };
        } else if (/^p\d+$/.test(_dragState.hitType) && d.points) {
          const idx = parseInt(_dragState.hitType.slice(1)) - 1;
          if (idx >= 0 && idx < d.points.length) {
            const { time, price } = _snapToCandle(pane, rawTime, rawPrice);
            d.points[idx] = { time, price };
          }
        } else if (_dragState.hitType === 'targetPrice') {
          const { price } = _snapToCandle(pane, rawTime, rawPrice);
          d.p2.price = price;
        } else if (_dragState.hitType === 'stopPrice') {
          const { price } = _snapToCandle(pane, rawTime, rawPrice);
          d.p3.price = price;
        } else if (_dragState.hitType === 'endTime') {
          const { time } = _snapToCandle(pane, rawTime, rawPrice);
          d.p2.time = time;
          d.p3.time = time;
        } else if (_dragState.hitType.startsWith('ell_')) {
          const side = _dragState.hitType; // 'ell_l','ell_r','ell_t','ell_b'
          const origP1X = _timeToX(pane, _dragState.origP1.time);
          const origP2X = _timeToX(pane, _dragState.origP2.time);
          const origP1Y = pane.series.priceToCoordinate(_dragState.origP1.price);
          const origP2Y = pane.series.priceToCoordinate(_dragState.origP2.price);
          const origCX = (origP1X + origP2X) / 2;
          const origCY = (origP1Y + origP2Y) / 2;
          if (side === 'ell_l' || side === 'ell_r') {
            const newRx = Math.abs(x - origCX);
            d.p1.time = pane.chart.timeScale().coordinateToTime(origCX - newRx);
            d.p2.time = pane.chart.timeScale().coordinateToTime(origCX + newRx);
          } else if (side === 'ell_t' || side === 'ell_b') {
            const newRy = Math.abs(y - origCY);
            d.p1.price = pane.series.coordinateToPrice(origCY - newRy);
            d.p2.price = pane.series.coordinateToPrice(origCY + newRy);
          }
        } else if (_dragState.hitType.startsWith('rect_')) {
          const { time, price } = _snapToCandle(pane, rawTime, rawPrice);
          const suffix = _dragState.hitType.replace('rect_', ''); // 'tl','tm','tr','ml','mr','bl','bm','br'

          if (d.tool === 'rotatedrect') {
            const p1Pixel = { x: _timeToX(pane, _dragState.origP1.time), y: pane.series.priceToCoordinate(_dragState.origP1.price) };
            const p2Pixel = { x: _timeToX(pane, _dragState.origP2.time), y: pane.series.priceToCoordinate(_dragState.origP2.price) };
            if (p1Pixel && p2Pixel) {
              const dx = p2Pixel.x - p1Pixel.x;
              const dy = p2Pixel.y - p1Pixel.y;
              const L = Math.hypot(dx, dy);
              if (L > 0) {
                const ux = dx / L;
                const uy = dy / L;

                if (suffix === 'tr' || suffix === 'br') {
                  // Dragging a right corner updates p2's position along the spine and p3 for height
                  const proj = (x - p1Pixel.x) * ux + (y - p1Pixel.y) * uy;
                  const nx = p1Pixel.x + ux * proj;
                  const ny = p1Pixel.y + uy * proj;
                  d.p2.time = pane.chart.timeScale().coordinateToTime(nx);
                  d.p2.price = pane.series.coordinateToPrice(ny);
                  d.p3.time = time;
                  d.p3.price = price;
                } else if (suffix === 'tl' || suffix === 'bl') {
                  // Dragging a left corner updates p1's position along the spine and p3 for height
                  const proj = (x - p2Pixel.x) * (-ux) + (y - p2Pixel.y) * (-uy);
                  const nx = p2Pixel.x - ux * proj;
                  const ny = p2Pixel.y - uy * proj;
                  d.p1.time = pane.chart.timeScale().coordinateToTime(nx);
                  d.p1.price = pane.series.coordinateToPrice(ny);
                  d.p3.time = time;
                  d.p3.price = price;
                }
              }
            }
          } else {
            const origP1X = _timeToX(pane, _dragState.origP1.time);
            const origP2X = _timeToX(pane, _dragState.origP2.time);
            const origP1Y = pane.series.priceToCoordinate(_dragState.origP1.price);
            const origP2Y = pane.series.priceToCoordinate(_dragState.origP2.price);

            const p1IsLeft = origP1X <= origP2X;
            const p1IsTop = origP1Y <= origP2Y;

            if (suffix.includes('l')) {
              if (p1IsLeft) d.p1.time = time; else d.p2.time = time;
            }
            if (suffix.includes('r')) {
              if (!p1IsLeft) d.p1.time = time; else d.p2.time = time;
            }
            if (suffix.includes('t')) {
              if (p1IsTop) d.p1.price = price; else d.p2.price = price;
            }
            if (suffix.includes('b')) {
              if (!p1IsTop) d.p1.price = price; else d.p2.price = price;
            }
          }
        } else if (_dragState.hitType === 'rect_body') {
          // Translate entire rect by dragging interior
          const origP1X = _timeToX(pane, _dragState.origP1.time);
          const origP1Y = pane.series.priceToCoordinate(_dragState.origP1.price);
          const origP2X = _timeToX(pane, _dragState.origP2.time);
          const origP2Y = pane.series.priceToCoordinate(_dragState.origP2.price);
          d.p1.time = pane.chart.timeScale().coordinateToTime(origP1X + dx);
          d.p1.price = pane.series.coordinateToPrice(origP1Y + dy);
          d.p2.time = pane.chart.timeScale().coordinateToTime(origP2X + dx);
          d.p2.price = pane.series.coordinateToPrice(origP2Y + dy);
        } else if (_dragState.hitType === 'text_resize_r') {
          // Resize text width by dragging right edge
          const a = _pt2xy(d.p1, pane);
          if (a) {
            const ctx = pane.drawingCanvas.getContext('2d');
            ctx.save();
            const fontSize = d.style?.fontSize || 16;
            ctx.font = `${d.style?.bold ? 'bold ' : ''}${d.style?.italic ? 'italic ' : ''}${fontSize}px Inter, -apple-system, sans-serif`;
            const lines = (d.text || 'Text').split('\n');
            let autoW = 0;
            for (const l of lines) autoW = Math.max(autoW, ctx.measureText(l).width);
            ctx.restore();
            const paddingX = 6;
            const newW = Math.max(20, x - a.x - paddingX);
            d.style = d.style || {};
            d.style.textWidth = newW;
          }
        } else if (_dragState.hitType === 'line' || _dragState.hitType === 'body' || _dragState.hitType?.startsWith('table_cell_')) {
          // Prevent whole-shape dragging by the line for text annotations
          if (_dragState.hitType === 'line' && ['note', 'callout', 'pricenote'].includes(d.tool)) {
            // Do nothing (line can be clicked to select, but not dragged to move)
          } else {
            // Translate entire shape
            if (d.tool === 'hline') {
              const origY = pane.series.priceToCoordinate(_dragState.origPrice);
              d.price = pane.series.coordinateToPrice(origY + dy);
            } else if (d.tool === 'hray') {
              const origY = pane.series.priceToCoordinate(_dragState.origPrice);
              const origX = _timeToX(pane, _dragState.origTime);
              d.price = pane.series.coordinateToPrice(origY + dy);
              d.time  = pane.chart.timeScale().coordinateToTime(origX + dx);
              if (d.p1) {
                d.p1.price = d.price;
                d.p1.time  = d.time;
              }
            } else if (d.tool === 'vline') {
              const origX = _timeToX(pane, _dragState.origTime);
              d.time = pane.chart.timeScale().coordinateToTime(origX + dx);
            } else if (d.tool === 'crossline') {
              const origX = _timeToX(pane, _dragState.origTime);
              const origY = pane.series.priceToCoordinate(_dragState.origPrice);
              d.time  = pane.chart.timeScale().coordinateToTime(origX + dx);
              d.price = pane.series.coordinateToPrice(origY + dy);
            } else {
              if (d.p1 && _dragState.origP1) {
                const origP1X = _timeToX(pane, _dragState.origP1.time);
                const origP1Y = pane.series.priceToCoordinate(_dragState.origP1.price);
                d.p1.time = pane.chart.timeScale().coordinateToTime(origP1X + dx);
                d.p1.price = pane.series.coordinateToPrice(origP1Y + dy);
              }
              if (d.p2 && _dragState.origP2) {
                const origP2X = _timeToX(pane, _dragState.origP2.time);
                const origP2Y = pane.series.priceToCoordinate(_dragState.origP2.price);
                d.p2.time = pane.chart.timeScale().coordinateToTime(origP2X + dx);
                d.p2.price = pane.series.coordinateToPrice(origP2Y + dy);
              }
              if (d.p3 && _dragState.origP3) {
                const origP3X = _timeToX(pane, _dragState.origP3.time);
                const origP3Y = pane.series.priceToCoordinate(_dragState.origP3.price);
                d.p3.time = pane.chart.timeScale().coordinateToTime(origP3X + dx);
                d.p3.price = pane.series.coordinateToPrice(origP3Y + dy);
              }
              if (d.p4 && _dragState.origP4) {
                const origP4X = _timeToX(pane, _dragState.origP4.time);
                const origP4Y = pane.series.priceToCoordinate(_dragState.origP4.price);
                d.p4.time = pane.chart.timeScale().coordinateToTime(origP4X + dx);
                d.p4.price = pane.series.coordinateToPrice(origP4Y + dy);
              }
              if (d.points && _dragState.origPoints) {
                d.points = _dragState.origPoints.map(pt => {
                  const ox = _timeToX(pane, pt.time);
                  const oy = pane.series.priceToCoordinate(pt.price);
                  return {
                    time: pane.chart.timeScale().coordinateToTime(ox + dx),
                    price: pane.series.coordinateToPrice(oy + dy)
                  };
                });
              }
            }
          }
        }
        requestRedrawAll();
        return true; // Claim event
      }

      if (_activeTool === 'pointer') {
        const drawings = getDrawingsForPane(pane.symbol);
        let ht = false;
        let htDrawing = null;
        for (const d of drawings) {
          ht = _hitTest(x, y, d, pane);
          if (ht) { htDrawing = d; break; }
        }
        if (_globalLock) {
          pane.cvs.style.cursor = 'crosshair';
        } else if (ht) {
          const tool = htDrawing ? htDrawing.tool : '';
          const isPos = ['longpos', 'shortpos', 'posforecast'].includes(tool);
          if (ht === 'line' || ht === 'body' || ht === 'rect_body' || ht === 'midpoint') {
            // texttool/note/callout: always text cursor when selected; trendline/ray/extended/infoline: text only over hint area
            const hintTools = ['trendline', 'ray', 'extended', 'infoline', 'hline'];
            const isSelected = htDrawing?.id === _selectedId;
            const isOverHint = isSelected && hintTools.includes(htDrawing?.tool)
              && _isOverTrendTextHint(x, y, htDrawing?.id);
            if (['texttool', 'note', 'callout'].includes(htDrawing?.tool) && isSelected) {
              pane.cvs.style.cursor = 'text';
            } else if (isOverHint) {
              const hintAngle = window._trendTextHintAreas?.[htDrawing.id]?.angle ?? 0;
              pane.cvs.style.cursor = _makeBeamCursor(hintAngle);
            } else if (htDrawing?.tool === 'hline' && ht === 'midpoint') {
              pane.cvs.style.cursor = 'ns-resize';
            } else {
              pane.cvs.style.cursor = 'pointer';
            }
          } else if (ht === 'text_resize_r') {
            pane.cvs.style.cursor = 'ew-resize';
          } else if ((ht === 'targetPrice' || ht === 'stopPrice') && isPos) {
            pane.cvs.style.cursor = 'ns-resize';
          } else if (ht === 'endTime' && isPos) {
            pane.cvs.style.cursor = 'ew-resize';
          } else if (ht === 'p1' || ht === 'p2' || ht === 'p3') {
            if (tool === 'rotatedrect' && (ht === 'p1' || ht === 'p2')) {
              pane.cvs.style.cursor = 'default';
            } else if (ht === 'p1' && ['note', 'callout', 'pricenote'].includes(tool)) {
              pane.cvs.style.cursor = 'default';
            } else {
              pane.cvs.style.cursor = 'pointer';
            }
          } else if (ht === 'rect_tl' || ht === 'rect_br') {
            pane.cvs.style.cursor = 'nwse-resize';
          } else if (ht === 'rect_tr' || ht === 'rect_bl') {
            pane.cvs.style.cursor = 'nesw-resize';
          } else if (ht === 'rect_tm' || ht === 'rect_bm') {
            pane.cvs.style.cursor = 'ns-resize';
          } else if (ht === 'rect_ml' || ht === 'rect_mr') {
            pane.cvs.style.cursor = 'ew-resize';
          } else if (ht === 'ell_l' || ht === 'ell_r') {
            pane.cvs.style.cursor = 'ew-resize';
          } else if (ht === 'ell_t' || ht === 'ell_b') {
            pane.cvs.style.cursor = 'ns-resize';
          } else {
            pane.cvs.style.cursor = 'pointer';
          }
        } else {
          pane.cvs.style.cursor = 'crosshair';
        }
        // Hover tracking for rect anchor highlights
        const newHoverPt = (ht && ht.startsWith('rect_') && !ht.startsWith('rect_body'))
          ? { drawingId: htDrawing?.id, ptId: ht } : null;

        const ptChanged = JSON.stringify(newHoverPt) !== JSON.stringify(_hoverPt);
        _hoverPt = newHoverPt;

        const newHoverDrawingId = htDrawing ? htDrawing.id : null;
        const hoverDrawingChanged = newHoverDrawingId !== _hoverDrawingId;
        _hoverDrawingId = newHoverDrawingId;
        _hoverHitType = ht || null;

        if (ptChanged || hoverDrawingChanged) requestRedrawAll();
      }
      return false;
    }

    // Drawing tool active
    const rawTime = pane.chart.timeScale().coordinateToTime(x);
    const rawPrice = pane.series?.coordinateToPrice(y);

    if (rawTime !== null && rawPrice !== null) {
      const { time, price } = _snapToCandle(pane, rawTime, rawPrice);
      const noMagnetP2 = ['note', 'callout', 'pricenote', 'pricelabel', 'tableanno', 'texttool'];
      let isNoMagnet = false;

      if (_inProgress && _inProgress.symbol === pane.symbol && !_inProgress.finished) {
        if (_inProgress.points) {
          // Multi-point tool: last point tracks mouse
          _inProgress.points[_inProgress.points.length - 1] = { time, price };
        } else if (_inProgress.p4 !== undefined && _inProgress.p4 !== null) {
          // 4-point tool, 4th point follows mouse
          _inProgress.p4 = { time, price };
        } else if (_inProgress.p3 !== undefined && _inProgress.p3 !== null) {
          // 3-point tool, 3rd point follows mouse
          _inProgress.p3 = { time, price };
        } else {
          if (noMagnetP2.includes(_inProgress.tool)) {
            _inProgress.p2 = { time: rawTime, price: rawPrice };
            isNoMagnet = true;
          } else {
            _inProgress.p2 = { time, price };
          }
        }
      }

      // Compute snap crosshair position (for custom rendering)
      const magnetMode = _getMagnetMode();
      if (!isNoMagnet && magnetMode && magnetMode !== 'off' && pane.candlesData?.length) {
        const snapX = pane.chart.timeScale().timeToCoordinate(time);
        const snapY = pane.series.priceToCoordinate(price);
        if (snapX !== null && snapY !== null) {
          _snapCrosshair = { pane, x: snapX, y: snapY };
        }
      } else {
        _snapCrosshair = null;
      }

      requestRedrawAll();
      return false;
    }
    return false;
  }

  function onMouseUp(pane, e) {
    const ds = _dragState;
    const wasDragging = !!ds && (Math.abs(e.clientX - (pane.cvs.getBoundingClientRect().left + ds.startX)) > 3 || Math.abs(e.clientY - (pane.cvs.getBoundingClientRect().top + ds.startY)) > 3);

    if (ds) {
      // If single click on an already selected text tool -> open inline editor
      const textTools = ['texttool', 'note', 'callout', 'pricenote', 'pricelabel', 'tableanno'];
      if (!wasDragging && ds.isReClick && textTools.includes(ds.d.tool)) {
        window.DrawingAnnotations.openInlineTextEditor(ds.d, pane, { x: e.clientX - pane.cvs.getBoundingClientRect().left, y: e.clientY - pane.cvs.getBoundingClientRect().top });
      }

      // If single click on already selected trendline/hline AND over the "Add Text" hint -> open inline editor
      // Double-click koruması: 280ms sonra aç, bu sürede dblclick gelirse iptal et
      if (!wasDragging && ds.isReClick && ['trendline', 'ray', 'extended', 'infoline', 'hline'].includes(ds.d.tool)) {
        const cx = e.clientX - pane.cvs.getBoundingClientRect().left;
        const cy = e.clientY - pane.cvs.getBoundingClientRect().top;
        if (_isOverTrendTextHint(cx, cy, ds.d.id)) {
          const capturedD = ds.d;
          const capturedPane = pane;
          const capturedE = e;
          _pendingTextEditTimer = setTimeout(() => {
            _pendingTextEditTimer = null;
            _openTrendlineTextEditor(capturedD, capturedPane, capturedE);
          }, 280);
        }
      }

      _dragState = null;
      State.save();
      requestRedrawAll();
    }
  }

  // Farenin "Add Text" hint alanı üzerinde olup olmadığını kontrol eder
  function _isOverTrendTextHint(x, y, drawingId) {
    const area = window._trendTextHintAreas?.[drawingId];
    if (!area) return false;
    // Hint alanı döndürülmüş — fareyi hint'in lokal koordinat sistemine çevir
    const dx = x - area.cx;
    const dy = y - area.cy;
    const cos = Math.cos(-area.angle);
    const sin = Math.sin(-area.angle);
    const lx = dx * cos - dy * sin;
    const ly = dx * sin + dy * cos;
    return Math.abs(lx) <= area.hw && Math.abs(ly) <= area.hh;
  }

  // Hint açısına göre döndürülmüş SVG beam cursor üretir
  function _makeBeamCursor(angleRad) {
    const deg = Math.round(angleRad * 180 / Math.PI);
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'>
      <g transform='rotate(${deg}, 12, 12)'>
        <line x1='12' y1='2' x2='12' y2='22' stroke='white' stroke-width='1.5'/>
        <line x1='8'  y1='2' x2='16' y2='2'  stroke='white' stroke-width='1.5'/>
        <line x1='8'  y1='22' x2='16' y2='22' stroke='white' stroke-width='1.5'/>
        <line x1='12' y1='2' x2='12' y2='22' stroke='black' stroke-width='0.5' stroke-dasharray='1,2'/>
      </g>
    </svg>`;
    const encoded = `url("data:image/svg+xml,${encodeURIComponent(svg)}") 12 12, text`;
    return encoded;
  }

  // ── TrendLine inline text editor ──────────────────────────────────────────
  function _openTrendlineTextEditor(d, pane, e) {
    const existing = document.getElementById('trendline-text-editor');
    if (existing) existing.remove();

    const s = d.style || {};
    const canvasRect = (pane.canvasContainer || pane.drawingCanvas || pane.cvs).getBoundingClientRect();

    // hline: p1/p2 yok, price ve canvas genişliğinden anchor hesapla
    if (d.tool === 'hline') {
      if (d.price == null || !isFinite(d.price)) return;
      const y = pane.series.priceToCoordinate(d.price);
      if (y == null || !isFinite(y)) return;
      const cvsW = pane.drawingCanvas.width / (window.devicePixelRatio || 1);
      const anchorX = cvsW / 2;
      const anchorY = y;
      const anchorViewX = canvasRect.left + anchorX;
      const anchorViewY = canvasRect.top  + anchorY;
      const fontSize = s.fontSize || 13;

      const ta = document.createElement('textarea');
      ta.id = 'trendline-text-editor';
      ta.value = s.text || '';
      ta.placeholder = 'Add text…';
      ta.rows = 1;

      Object.assign(ta.style, {
        position:        'fixed',
        left:            anchorViewX + 'px',
        top:             (anchorViewY - 5) + 'px',
        transform:       'translate(-50%, -100%)',
        transformOrigin: '0 0',
        zIndex:          '99999',
        background:      'rgba(19,23,34,0.92)',
        color:           s.textColor || '#d1d4dc',
        fontSize:        fontSize + 'px',
        fontFamily:      '"JetBrains Mono", monospace',
        fontWeight:      s.bold   ? 'bold'   : 'normal',
        fontStyle:       s.italic ? 'italic' : 'normal',
        border:          '1px solid #2962ff',
        outline:         'none',
        padding:         '3px 6px',
        minWidth:        '80px',
        maxWidth:        '300px',
        resize:          'none',
        overflow:        'hidden',
        borderRadius:    '3px',
        cursor:          'text',
        caretColor:      '#fff',
      });

      document.body.appendChild(ta);
      ta.focus();
      ta.select();

      const commit = () => {
        const val = ta.value.trim();
        d.style = d.style || {};
        d.style.text = val || '';
        ta.remove();
        EventBus.emit('drawing:updated', d);
        EventBus.emit('drawing:redraw');
      };

      ta.addEventListener('keydown', ev => {
        if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); commit(); }
        if (ev.key === 'Escape') { ta.remove(); }
      });
      ta.addEventListener('blur', commit);
      return; // hline için burada bitir
    }

    // Use the internal _pt2xy (not the public utils wrapper)
    const a = _pt2xy(d.p1, pane);
    const b = _pt2xy(d.p2, pane);
    if (!a || !b) return;

    const textAlignH = s.textAlignH || 'center';
    const textAlignV = s.textAlignV || 'top';
    const lineAngle  = Math.atan2(b.y - a.y, b.x - a.x);
    
    // Normalize angle (same as drawing-trend.js)
    let drawAngle = lineAngle;
    let isFlipped = false;
    if (drawAngle > Math.PI / 2 || drawAngle < -Math.PI / 2) {
      drawAngle += Math.PI;
      isFlipped = true;
    }

    // Anchor point on the line (matching drawing-trend.js)
    let anchorX, anchorY;
    if (textAlignH === 'left') {
      anchorX = a.x; anchorY = a.y;
    } else if (textAlignH === 'right') {
      anchorX = b.x; anchorY = b.y;
    } else {
      anchorX = (a.x + b.x) / 2;
      anchorY = (a.y + b.y) / 2;
    }

    const anchorViewX = canvasRect.left + anchorX;
    const anchorViewY = canvasRect.top  + anchorY;
    const fontSize = s.fontSize || 13;

    // Alignment logic for transform
    let xPercent = -50;
    if (textAlignH === 'left')  xPercent = isFlipped ? -100 : 0;
    if (textAlignH === 'right') xPercent = isFlipped ? 0 : -100;

    let yPercent = -50;
    if (textAlignV === 'top')    yPercent = -100;
    if (textAlignV === 'bottom') yPercent = 0;

    // Vertical offset (matches offsetDist in drawing-trend.js)
    const vOffset = (textAlignV === 'top') ? -6 : (textAlignV === 'bottom') ? 6 : 0;

    const ta = document.createElement('textarea');
    ta.id = 'trendline-text-editor';
    ta.value = s.text || '';
    ta.placeholder = 'Add text…';
    ta.rows = 1;

    Object.assign(ta.style, {
      position:        'fixed',
      left:            anchorViewX + 'px',
      top:             anchorViewY + 'px',
      transform:       `rotate(${drawAngle}rad) translate(${xPercent}%, ${yPercent}%) translateY(${vOffset}px)`,
      transformOrigin: '0 0',
      zIndex:          '99999',
      background:      'rgba(19,23,34,0.92)',
      color:           s.textColor || '#d1d4dc',
      fontSize:        fontSize + 'px',
      fontFamily:      '"JetBrains Mono", monospace',
      fontWeight:      s.bold   ? 'bold'   : 'normal',
      fontStyle:       s.italic ? 'italic' : 'normal',
      border:          '1px solid #2962ff',
      outline:         'none',
      padding:         '3px 6px',
      borderRadius:    '3px',
      width:           '160px',
      minHeight:       (fontSize + 10) + 'px',
      lineHeight:      '1.4',
      resize:          'none',
      overflow:        'hidden',
      boxSizing:       'border-box',
      boxShadow:       '0 0 0 1px rgba(41,98,255,0.4)',
      textAlign:       (textAlignH === 'right' && !isFlipped) || (textAlignH === 'left' && isFlipped) ? 'right' : (textAlignH === 'center' ? 'center' : 'left'),
      cursor:          'text',
    });

    const autoH = () => { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; };
    ta.addEventListener('input', autoH);
    ['mousedown','pointerdown','pointerup','click','keydown'].forEach(ev => ta.addEventListener(ev, e2 => e2.stopPropagation()));

    document.body.appendChild(ta);
    requestAnimationFrame(() => {
      ta.focus({ preventScroll: true });
      ta.selectionStart = ta.selectionEnd = ta.value.length;
      autoH();
    });
    // Also re-focus after any pointerup that could steal focus
    window.addEventListener('pointerup', () => {
      setTimeout(() => { const el = document.getElementById('trendline-text-editor'); if (el) el.focus({ preventScroll: true }); }, 50);
    }, { capture: true, once: true });

    let saved = false;
    const commit = () => {
      if (saved) return; saved = true;
      const val = ta.value.trim();
      d.style = d.style || {};
      d.style.text = val;
      State.save();
      ta.remove();
      requestRedrawAll();
    };
    const cancel = () => {
      if (saved) return; saved = true;
      ta.remove();
      requestRedrawAll();
    };

    setTimeout(() => ta.addEventListener('blur', commit), 250);
    ta.addEventListener('keydown', ev => {
      if (ev.key === 'Escape')              { saved = true; cancel(); }
      if (ev.key === 'Enter' && ev.ctrlKey) { commit(); }
    });
  }

  function onDoubleClick(pane, e) {
    // Bekleyen inline text editörünü iptal et — double-click'te sadece settings açılır
    if (_pendingTextEditTimer) {
      clearTimeout(_pendingTextEditTimer);
      _pendingTextEditTimer = null;
    }

    const rect = pane.cvs.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const drawings = getDrawingsForPane(pane.symbol);
    for (let i = drawings.length - 1; i >= 0; i--) {
      const d = drawings[i];
      const ht = _hitTest(x, y, d, pane);
      if (ht) {
        // Double click always opens settings modal
        if (window.DrawingSettingsDialog) {
          DrawingSettingsDialog.open(d, {
            symbol: pane.symbol,
            onOk: (updated) => {
              _updateToolStyle(updated.tool, updated.style);
              requestRedrawAll();
            }
          });
        }
        return true;
      }
    }
    return false;
  }

  function _updateToolStyle(tool, style) {
    if (!tool || !style) return;
    _toolStyles[tool] = JSON.parse(JSON.stringify(style));
    State.set('drawingStyles', _toolStyles);
  }

  function _getMagnetMode() {
    return State._magnetOverride || _magnetMode;
  }

  // Show/hide LWC native crosshair based on magnet + tool state
  function _updateCrosshairVisibility() {
    if (!window.LayoutManager) return;
    const magnetMode = _getMagnetMode();
    const isDrawing = _activeTool !== 'pointer' && !_activeTool.startsWith('cursor-');
    const magnetActive = magnetMode && magnetMode !== 'off';
    const hideNative = isDrawing && magnetActive;

    window.LayoutManager.panes.forEach(p => {
      if (!p.chart) return;
      if (_activeTool === 'cursor-arrow') {
        p.chart.applyOptions({ crosshair: { vertLine: { visible: false, labelVisible: false }, horzLine: { visible: false, labelVisible: false } } });
      } else if (hideNative) {
        // Hide LWC crosshair — we draw our own at the snap point
        p.chart.applyOptions({ crosshair: { vertLine: { visible: false, labelVisible: false }, horzLine: { visible: false, labelVisible: false } } });
      } else {
        p.chart.applyOptions({ crosshair: { vertLine: { visible: true, labelVisible: true }, horzLine: { visible: true, labelVisible: true } } });
      }
    });
  }

  function init() {
    EventBus.on('drawing:tool:set', ({ tool }) => {
      _activeTool = tool;
      _inProgress = null;
      _snapCrosshair = null;

      const isDrawing = (tool !== 'pointer' && !tool.startsWith('cursor-'));

      document.querySelectorAll('.pane-wrap').forEach(el => {
        el.classList.toggle('drawing-active', isDrawing);
        el.classList.remove('cursor-cross', 'cursor-dot', 'cursor-arrow', 'cursor-drawing');
        if (tool.startsWith('cursor-')) el.classList.add(tool);
        else if (isDrawing) el.classList.add('cursor-drawing');
      });

      _updateCrosshairVisibility();
      requestRedrawAll();
    });

    // Load persisted styles on startup
    _toolStyles = State.get('drawingStyles') || {};

    EventBus.on('chart:tf:change', ({ tf }) => {
      // If the currently-selected drawing is hidden on the new TF, deselect it
      if (_selectedId) {
        const normNew = _normalizeVizTf(tf || '');
        let foundHidden = false;
        Object.values(State.get('drawings') || {}).forEach(list => {
          if (foundHidden) return;
          const d = (list || []).find(x => x.id === _selectedId);
          if (d && d.style?.visibility) {
            const matchKey = Object.keys(d.style.visibility).find(k => _normalizeVizTf(k) === normNew);
            if (matchKey !== undefined && d.style.visibility[matchKey] === false) {
              foundHidden = true;
            }
          }
        });
        if (foundHidden) {
          _selectedId = null;
          EventBus.emit('drawing:selected', { id: null });
        }
      }
      requestRedrawAll();
    });
    EventBus.on('chart:data:loaded', requestRedrawAll);

    // Magnet mode changed — update local var + crosshair visibility
    EventBus.on('drawing:magnet', ({ mode }) => {
      _magnetMode = mode || 'off';
      console.log('[DrawingManager] Magnet mode:', _magnetMode);
      _updateCrosshairVisibility();
    });

    // Apply initial magnet from State on startup (before Sidebar emits)
    const storedMagnet = State.get('magnetMode');
    console.log('[DrawingManager] Startup: State magnetMode =', storedMagnet, '| type:', typeof storedMagnet);
    if (storedMagnet && storedMagnet !== false) _magnetMode = storedMagnet;
    console.log('[DrawingManager] Startup: _magnetMode set to =', _magnetMode);

    // Setup event listeners for new property-toolbar and settings-modal
    EventBus.on('drawing:deleted', (data) => {
      if (data && data.id === _selectedId) {
        _selectedId = null;
      }
      requestRedrawAll();
    });

    EventBus.on('drawing:deselect', () => {
      if (_selectedId) {
        _selectedId = null;
        EventBus.emit('drawing:selected', { id: null });
        requestRedrawAll();
      }
    });

    EventBus.on('drawing:toggle', ({ id, active }) => {
      if (id === 'lockAllDrawings') {
        _globalLock = active;
        // Do not deselect drawings. TradingView allows selecting locked drawings to change properties.
        requestRedrawAll();
      }
    });

    EventBus.on('drawing:hide', (data) => {
      _allHideStates = data.allStates || {};
      if (_allHideStates.hide_drawings || _allHideStates.hide_all) {
        _selectedId = null;
        EventBus.emit('drawing:deselect'); // Hide property toolbar
      }
      requestRedrawAll();
    });

    function _clearDrawings() {
      const activeSym = State.get('activeSymbol');
      if (!activeSym) return;
      const removeLocked = localStorage.getItem('pintrade_remove_locked') === 'true';

      const all = State.get('drawings') || {};
      const current = all[activeSym] || [];
      if (!removeLocked) {
        all[activeSym] = current.filter(d => d.locked);
      } else {
        all[activeSym] = [];
      }

      _saveState(all);
      _selectedId = null;
      requestRedrawAll();
      EventBus.emit('drawing:deleted', null); // Trigger UI updates
    }

    function _clearIndicators() {
      // Basic implementation for clearing indicators
      if (Array.isArray(State.get('indicators'))) {
        State.set('indicators', []);
      }
      EventBus.emit('indicator:clear:all');
      requestRedrawAll();
    }

    EventBus.on('drawing:clear:drawings', _clearDrawings);
    EventBus.on('drawing:clear:indicators', _clearIndicators);
    EventBus.on('drawing:clear:all', () => {
      _clearDrawings();
      _clearIndicators();
    });

    EventBus.on('drawing:settings:saved', () => {
      if (_selectedId) {
        Object.values(State.get('drawings') || {}).forEach(list => {
          const d = (list || []).find(x => x.id === _selectedId);
          if (d && d.style) {
            if (!d.tool.startsWith('fib-')) {
              const styleToSave = JSON.parse(JSON.stringify(d.style));
              delete styleToSave.text;
              _toolStyles[d.tool] = styleToSave;
              State.set('drawingStyles', _toolStyles);
            }
          }
        });
      }
      requestRedrawAll();
    });

    // Delete/Backspace key listener
    document.addEventListener('keydown', e => {
      const focused = document.activeElement;
      const isEditing = focused && (focused.tagName === 'INPUT' || focused.tagName === 'TEXTAREA' || focused.isContentEditable);
      if ((e.key === 'Delete' || e.key === 'Backspace') && _selectedId && !isEditing) {
        if (_globalLock) return;
        Object.keys(State.get('drawings') || {}).forEach(symbol => {
          const drawings = State.getDrawings(symbol);
          const drawing = drawings.find(d => d.id === _selectedId);
          if (drawing) {
            if (drawing.locked) return; // kilitli çizim silinemez
            _saveHistory(); // Kaydet
            State.removeDrawing(symbol, _selectedId);
            const deletedId = _selectedId;
            _selectedId = null;
            EventBus.emit('drawing:selected', { id: null });
            EventBus.emit('drawing:deleted', { id: deletedId });
            requestRedrawAll();
          }
        });
      }
    });

    // Ctrl key: temporarily toggle magnet mode while drawing
    document.addEventListener('keydown', e => {
      if (e.key === 'Control') {
        const current = State.get('magnetMode');
        // Ctrl held: if magnet is off → temp enable strong, if on → temp disable
        State._magnetOverride = current && current !== 'off' ? 'off' : 'strong';
      } else if (e.key === 'Shift') {
        State._magnetOverride = 'off';
      }
    });
    document.addEventListener('keyup', e => {
      if (e.key === 'Control' || e.key === 'Shift') {
        State._magnetOverride = null;
      }
    });

    // Right-click (contextmenu) cancel — hard cancel regardless of keep drawing
    document.addEventListener('contextmenu', e => {
      const isDrawing = _activeTool !== 'pointer' && !_activeTool.startsWith('cursor-');
      if (isDrawing) {
        e.preventDefault();
        // Force switch to pointer even if keep drawing is on
        _inProgress = null;
        _snapCrosshair = null;
        requestRedrawAll();
        EventBus.emit('drawing:tool:set', { tool: 'pointer' });
      }
    });

    // Escape key cancel
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') cancelDrawing();
    });

    // Double click to edit texttool and other text annotations
    document.addEventListener('dblclick', e => {
      if (_hoverDrawingId) {
        const d = _getDrawingById(_hoverDrawingId);
        if (d && ['texttool', 'note', 'callout', 'pricenote', 'pricelabel', 'flagmark', 'tableanno'].includes(d.tool)) {
          if (window.LayoutManager && window.LayoutManager.panes) {
            const pane = window.LayoutManager.panes.find(p => p.symbol === d.symbol);
            if (pane) {
              const cellStr = _hoverHitType?.startsWith('table_cell_') ? _hoverHitType : null;
              window.DrawingAnnotations.openInlineTextEditor(d, pane, null, cellStr);
            }
          }
        }
      }
    });
  }

  function _getDrawingById(id) {
    const drawings = State.get('drawings') || {};
    for (const p in drawings) {
      const found = drawings[p].find(d => d.id === id);
      if (found) return found;
    }
    return null;
  }

  // Cancel active drawing / reset to pointer — returns true if something was cancelled
  function cancelDrawing() {
    const wasActive = (_activeTool !== 'pointer' && !_activeTool.startsWith('cursor-')) || !!_inProgress;
    if (!wasActive) return false;

    if (_inProgress) {
      // For multi-point tools: if we have enough points, finish instead of discard
      if (['polyline', 'pathtool'].includes(_inProgress.tool) && _inProgress.points && _inProgress.points.length > 2) {
        _inProgress.points.pop(); // remove the tracking cursor point
        const finished = { ..._inProgress };
        _inProgress = null;
        _finishDrawing(finished.symbol, finished);
        _snapCrosshair = null;
        return true;
      }
      _inProgress = null;
      _snapCrosshair = null;
      requestRedrawAll();
    }
    EventBus.emit('drawing:tool:set', { tool: 'pointer' });
    return true;
  }

  function _finishDrawing(symbol, d, pane = null) {
    _saveHistory(); // Kaydet
    State.addDrawing(symbol, d);
    _selectedId = d.id;
    requestRedrawAll();

    const keepDrawing = window.Sidebar?.getKeepDrawing?.() === true;

    if (keepDrawing) {
      // Stay on the same tool — just reset _inProgress so a new one can begin
      const toolToKeep = _activeTool;
      _inProgress = null;
      _snapCrosshair = null;
      // Don't emit tool:set — keep the current tool active
      requestRedrawAll();
    } else {
      EventBus.emit('drawing:tool:set', { tool: 'pointer' });

      // Visually reset active tool in sidebar
      document.querySelectorAll('.lt-btn[data-tool]').forEach(b => {
        b.classList.toggle('active', b.dataset.tool === 'pointer');
      });

      // Auto-select so property toolbar opens immediately
      const centerX = window.innerWidth ? window.innerWidth / 2 : 400;
      const centerY = window.innerHeight ? window.innerHeight / 2 : 300;
      if (d.tool !== 'texttool') {
        EventBus.emit('drawing:selected', { id: d.id, symbol: symbol, x: centerX, y: centerY });
      }
    }
  }

  let _redrawAF = null;
  function requestRedrawAll() {
    if (_redrawAF) return;
    _redrawAF = requestAnimationFrame(() => {
      _redrawAF = null;
      if (window.LayoutManager) {
        window.LayoutManager.panes.forEach(p => {
          if (typeof p.redrawDrawings === 'function') p.redrawDrawings();
        });
      }
    });
  }

  function getDrawingsForPane(symbol) {
    const drawings = State.getDrawings(symbol);
    if (_inProgress && _inProgress.symbol === symbol) {
      return [...drawings, _inProgress];
    }
    return drawings;
  }

  // ── Renderer ────────────────────────────────────────────────
  function renderPane(pane) {
    if (!pane.drawingCanvas || !pane.drawingCtx || !pane.series) return;
    const ctx = pane.drawingCtx;
    const canvas = pane.drawingCanvas;
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.width / dpr;
    const H = canvas.height / dpr;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.scale(dpr, dpr);

    if (_allHideStates && (_allHideStates.hide_drawings || _allHideStates.hide_all)) {
      ctx.restore();
      return;
    }

    const drawings = getDrawingsForPane(pane.symbol);
    // Get active TF for visibility filtering
    const activeTf = _normalizeVizTf(State.get('activeTf') || '');
    // Draw unselected first, selected last (on top)
    const sortedDrawings = [...drawings].sort((a, b) => (a.id === _selectedId ? 1 : b.id === _selectedId ? -1 : 0));
    sortedDrawings.forEach(d => {
      // Skip if this TF is hidden for this drawing (never hide inProgress drawings)
      const isInProgress = _inProgress && d.id === _inProgress.id;
      if (!isInProgress && activeTf && d.style?.visibility) {
        const vis = d.style.visibility;
        // Find a matching key (case-insensitive)
        const matchKey = Object.keys(vis).find(k => _normalizeVizTf(k) === activeTf);
        if (matchKey !== undefined && vis[matchKey] === false) return; // hidden on this TF
      }
      const isSelected = d.id === _selectedId;
      try {
        _renderDrawing(ctx, d, pane, isSelected, isInProgress);
      } catch (e) {
        console.warn('[DrawingManager] Render error for tool:', d.tool, d.id, e);
      }
    });

    // ── Custom magnet crosshair (replaces hidden LWC crosshair) ──
    if (_snapCrosshair && _snapCrosshair.pane === pane) {
      const { x, y } = _snapCrosshair;
      ctx.save();
      ctx.strokeStyle = '#9598a1';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.globalAlpha = 0.9;

      // Vertical line
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();

      // Horizontal line
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();

      ctx.restore();
    }

    ctx.restore(); // restore dpr scale
  }

  function _renderAnchors(ctx, d, pane) {
    const noGenericAnchors = ['note', 'callout', 'pricenote', 'pricelabel', 'tableanno', 'texttool'];
    if (noGenericAnchors.includes(d.tool)) return;

    const pts = [];
    if (['longpos', 'shortpos', 'posforecast'].includes(d.tool)) {
      if (d.p1 && d.p2 && d.p3) {
        const a = _pt2xy(d.p1, pane);
        const b = _pt2xy(d.p2, pane);
        const c = _pt2xy(d.p3, pane);
        if (a && b && c) {
          pts.push(a); // middle left (P1)
          pts.push({ x: a.x, y: b.y }); // top left (target price)
          pts.push({ x: a.x, y: c.y }); // bottom left (stop price)
          pts.push({ x: b.x, y: a.y }); // middle right (end time)
        }
      }
    } else if (d.tool === 'rect') {
      const a = _pt2xy(d.p1, pane);
      const b = _pt2xy(d.p2, pane);
      if (a && b) {
        const x1 = Math.min(a.x, b.x), x2 = Math.max(a.x, b.x);
        const y1 = Math.min(a.y, b.y), y2 = Math.max(a.y, b.y);
        const mx = (x1 + x2) / 2;
        const my = (y1 + y2) / 2;
        pts.push({ x: x1, y: y1, id: 'rect_tl' });
        pts.push({ x: mx, y: y1, type: 'square', id: 'rect_tm' });
        pts.push({ x: x2, y: y1, id: 'rect_tr' });
        pts.push({ x: x1, y: my, type: 'square', id: 'rect_ml' });
        pts.push({ x: x2, y: my, type: 'square', id: 'rect_mr' });
        pts.push({ x: x1, y: y2, id: 'rect_bl' });
        pts.push({ x: mx, y: y2, type: 'square', id: 'rect_bm' });
        pts.push({ x: x2, y: y2, id: 'rect_br' });
      }
    } else if (d.tool === 'rotatedrect') {
      const a = _pt2xy(d.p1, pane);
      const b = _pt2xy(d.p2, pane);
      if (a && b) {
        pts.push({ ...a, id: 'p1' });
        pts.push({ ...b, id: 'p2' });
        if (d.p3) {
          const c = _pt2xy(d.p3, pane);
          if (c) {
            const dx = b.x - a.x; const dy = b.y - a.y;
            const L = Math.hypot(dx, dy);
            if (L > 0) {
              const Nx = -dy / L; const Ny = dx / L;
              const H = (c.x - a.x) * Nx + (c.y - a.y) * Ny;
              pts.push({ x: a.x + Nx * H, y: a.y + Ny * H, type: 'square', id: 'rect_tl' });
              pts.push({ x: b.x + Nx * H, y: b.y + Ny * H, type: 'square', id: 'rect_tr' });
              pts.push({ x: b.x - Nx * H, y: b.y - Ny * H, type: 'square', id: 'rect_br' });
              pts.push({ x: a.x - Nx * H, y: a.y - Ny * H, type: 'square', id: 'rect_bl' });
            }
          }
        }
      }
    } else if (d.tool === 'ellipse') {
      // 4 cardinal anchor points at the ellipse edge midpoints
      const a = _pt2xy(d.p1, pane);
      const b = _pt2xy(d.p2, pane);
      if (a && b) {
        const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
        const rx = Math.abs(b.x - a.x) / 2, ry = Math.abs(b.y - a.y) / 2;
        pts.push({ x: cx - rx, y: cy, type: 'square', id: 'ell_l' });
        pts.push({ x: cx + rx, y: cy, type: 'square', id: 'ell_r' });
        pts.push({ x: cx, y: cy - ry, type: 'square', id: 'ell_t' });
        pts.push({ x: cx, y: cy + ry, type: 'square', id: 'ell_b' });
      }
    } else if (d.points && d.points.length > 0) {
      d.points.forEach((pt, i) => {
        const xy = _pt2xy(pt, pane);
        if (xy) pts.push({ ...xy, id: 'p' + (i + 1) });
      });
    } else {
      if (d.p1) pts.push(_pt2xy(d.p1, pane));
      if (d.p2) pts.push(_pt2xy(d.p2, pane));
      if (d.p3) pts.push(_pt2xy(d.p3, pane));
      if (d.p4) pts.push(_pt2xy(d.p4, pane));
    }

    const W = pane.drawingCanvas.width / (window.devicePixelRatio || 1);
    const H = pane.drawingCanvas.height / (window.devicePixelRatio || 1);

    if (d.tool === 'hline' || d.tool === 'hray' || d.tool === 'crossline') {
      const y = pane.series.priceToCoordinate(d.price);
      if (y !== null) {
        if (d.tool === 'hray') {
          const x = _timeToX(pane, d.time);
          if (x !== null) pts.push({ x, y });
        } else if (d.tool === 'hline') {
          pts.push({ x: W / 2, y });
        }
      }
    }
    if (d.tool === 'vline' || d.tool === 'crossline') {
      const x = _timeToX(pane, d.time);
      if (x !== null) {
        if (d.tool === 'crossline') {
          const y = pane.series.priceToCoordinate(d.price);
          if (y !== null && !pts.some(p => p.x === x && p.y === y)) pts.push({ x, y });
        } else {
          pts.push({ x, y: H / 2 });
        }
      }
    }

    ctx.fillStyle = '#1e222d';
    ctx.strokeStyle = '#2962ff';
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    for (const pt of pts) {
      if (!pt) continue;
      const isHovered = _hoverPt && _hoverPt.drawingId === d.id && _hoverPt.ptId === pt.id;
      const r = isHovered ? 6 : 4;

      ctx.beginPath();
      if (pt.type === 'square') {
        if (ctx.roundRect) ctx.roundRect(pt.x - r, pt.y - r, r * 2, r * 2, 2);
        else ctx.rect(pt.x - r, pt.y - r, r * 2, r * 2);
      } else {
        ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
      }

      if (isHovered) {
        ctx.fillStyle = '#2962ff';
        ctx.strokeStyle = '#ffffff';
      } else {
        ctx.fillStyle = '#1e222d';
        ctx.strokeStyle = '#2962ff';
      }
      ctx.fill();
      ctx.stroke();
      // Reset to defaults for next pt
      ctx.fillStyle = '#1e222d';
      ctx.strokeStyle = '#2962ff';
    }
  }

  function _renderDrawing(ctx, d, pane, selected, inProgress) {
    ctx.save();
    try {
      ctx.globalAlpha = inProgress ? 0.7 : ((d.style?.opacity ?? 100) / 100);
      ctx.strokeStyle = d.style?.color || '#0969da';
      ctx.lineWidth = d.style?.width || 1;

      let dashArr = d.style?.dash || [];
      if (d.style?.lineStyle === 'dashed') dashArr = [8, 5];
      if (d.style?.lineStyle === 'dotted') dashArr = [3, 3];
      ctx.setLineDash(dashArr);

    if (d.tool === 'hline') window.DrawingTrend.drawHLine(ctx, d, pane, selected);
    if (d.tool === 'vline') window.DrawingTrend.drawVLine(ctx, d, pane);
    if (d.tool === 'hray') window.DrawingTrend.drawHRay(ctx, d, pane);
    if (d.tool === 'crossline') window.DrawingTrend.drawCrossLine(ctx, d, pane);
    if (d.tool === 'trendline') window.DrawingTrend.drawTrendLine(ctx, d, pane, selected);
    if (d.tool === 'ray')       window.DrawingTrend.drawRay(ctx, d, pane, selected);
    if (d.tool === 'extended')  window.DrawingTrend.drawExtended(ctx, d, pane, selected);
    if (d.tool === 'trendangle') window.DrawingTrend.drawTrendAngle(ctx, d, pane, selected);
    if (d.tool === 'channel') window.DrawingTrend.drawChannel(ctx, d, pane);
    if (d.tool === 'infoline') window.DrawingTrend.drawInfoLine(ctx, d, pane, selected);
    if (d.tool === 'flattopbottom') window.DrawingTrend.drawFlatTopBottom(ctx, d, pane);
    if (d.tool === 'regression') window.DrawingTrend.drawRegressionTrend(ctx, d, pane);
    if (d.tool === 'pitchfork') window.DrawingTrend.drawPitchfork(ctx, d, pane, 'standard');
    if (d.tool === 'schiffpitch') window.DrawingTrend.drawPitchfork(ctx, d, pane, 'schiff');
    if (d.tool === 'modschiff') window.DrawingTrend.drawPitchfork(ctx, d, pane, 'modschiff');
    if (d.tool === 'insidepitch') window.DrawingTrend.drawPitchfork(ctx, d, pane, 'inside');
    if (d.tool === 'disjointch') window.DrawingTrend.drawDisjointChannel(ctx, d, pane);
    // ── Annotations ──
    if (d.tool === 'texttool') window.DrawingAnnotations.drawTextTool(ctx, d, pane, d.id === _hoverDrawingId, selected);
    if (d.tool === 'note') window.DrawingAnnotations.drawNote(ctx, d, pane, d.id === _hoverDrawingId, selected);
    if (d.tool === 'callout') window.DrawingAnnotations.drawCallout(ctx, d, pane, d.id === _hoverDrawingId, selected);
    if (d.tool === 'pricenote') window.DrawingAnnotations.drawPriceNote(ctx, d, pane, d.id === _hoverDrawingId, selected);
    if (d.tool === 'pricelabel') window.DrawingAnnotations.drawPriceLabel(ctx, d, pane, d.id === _hoverDrawingId, selected);
    if (d.tool === 'flagmark') window.DrawingAnnotations.drawFlagMark(ctx, d, pane, d.id === _hoverDrawingId, selected);
    if (d.tool === 'tableanno') window.DrawingAnnotations.drawTableAnno(ctx, d, pane, d.id === _hoverDrawingId, selected);
    if (d.tool === 'icon') window.DrawingAnnotations.drawIcon(ctx, d, pane, d.id === _hoverDrawingId, selected);
    // ── Fibonacci & Gann ──
    if (d.tool === 'fib-ret') window.DrawingFibo.drawFibRet(ctx, d, pane);
    if (d.tool === 'fib-ext') window.DrawingFibo.drawFibExt(ctx, d, pane);
    if (d.tool === 'fib-channel') window.DrawingFibo.drawFibChannel(ctx, d, pane);
    if (d.tool === 'fib-timezone') window.DrawingFibo.drawFibTimezone(ctx, d, pane);
    if (d.tool === 'fib-circles') window.DrawingFibo.drawFibCircles(ctx, d, pane);
    if (d.tool === 'fib-speedfan') window.DrawingFibo.drawFibSpeedfan(ctx, d, pane);
    if (d.tool === 'fib-timebased') window.DrawingFibo.drawFibTimebased(ctx, d, pane);
    if (d.tool === 'fib-spiral') window.DrawingFibo.drawFibSpiral(ctx, d, pane);
    if (d.tool === 'fib-arcs') window.DrawingFibo.drawFibArcs(ctx, d, pane);
    if (d.tool === 'fib-wedge') window.DrawingFibo.drawFibWedge(ctx, d, pane);
    if (d.tool === 'pitchfan') window.DrawingFibo.drawPitchfan(ctx, d, pane);
    if (d.tool === 'gann-fan') window.DrawingFibo.drawGannFan(ctx, d, pane);
    if (d.tool === 'gann-box') window.DrawingFibo.drawGannBox(ctx, d, pane);
    if (d.tool === 'gann-sq' || d.tool === 'gann-sqfixed') window.DrawingFibo.drawGannSquare(ctx, d, pane);
    // ── Geometric Shapes & Arrows ──
    if (d.tool === 'brush') window.DrawingShapes.drawBrush(ctx, d, pane);
    if (d.tool === 'highlighter') window.DrawingShapes.drawHighlighter(ctx, d, pane);
    if (d.tool === 'rect') window.DrawingShapes.drawRect(ctx, d, pane);
    if (d.tool === 'rotatedrect') window.DrawingShapes.drawRotatedRect(ctx, d, pane);
    if (d.tool === 'circle') window.DrawingShapes.drawCircle(ctx, d, pane);
    if (d.tool === 'ellipse') window.DrawingShapes.drawEllipse(ctx, d, pane);
    if (d.tool === 'triangle') window.DrawingShapes.drawTriangle(ctx, d, pane);
    if (d.tool === 'curve') window.DrawingShapes.drawCurve(ctx, d, pane);
    if (d.tool === 'doublecurve') window.DrawingShapes.drawDoubleCurve(ctx, d, pane);
    if (d.tool === 'arc') window.DrawingShapes.drawArc(ctx, d, pane);
    if (d.tool === 'polyline') window.DrawingShapes.drawPolyline(ctx, d, pane);
    if (d.tool === 'pathtool') window.DrawingShapes.drawPathTool(ctx, d, pane);
    if (d.tool === 'arrowmarker') window.DrawingShapes.drawArrowMarker(ctx, d, pane);
    if (d.tool === 'arrowdraw') window.DrawingShapes.drawArrow(ctx, d, pane);
    if (d.tool === 'arrowup') window.DrawingShapes.drawArrowUp(ctx, d, pane);
    if (d.tool === 'arrowdown') window.DrawingShapes.drawArrowDown(ctx, d, pane);
    // ── Forecast & Measurement (Including Volume-based) ──
    if (d.tool === 'measure') window.DrawingForecast.drawMeasureTool(ctx, d, pane);
    if (d.tool === 'longpos') window.DrawingForecast.drawPosition(ctx, d, pane, 'long');
    if (d.tool === 'shortpos') window.DrawingForecast.drawPosition(ctx, d, pane, 'short');
    if (d.tool === 'posforecast') window.DrawingForecast.drawPosForecast(ctx, d, pane);
    if (d.tool === 'barpattern') window.DrawingForecast.drawBarPattern(ctx, d, pane);
    if (d.tool === 'ghostfeed') window.DrawingForecast.drawGhostFeed(ctx, d, pane);
    if (d.tool === 'sector') window.DrawingForecast.drawSector(ctx, d, pane);
    if (d.tool === 'pricerange') window.DrawingForecast.drawPriceRange(ctx, d, pane);
    if (d.tool === 'daterange') window.DrawingForecast.drawDateRange(ctx, d, pane);
    if (d.tool === 'datepricerange') window.DrawingForecast.drawDatePriceRange(ctx, d, pane);
    if (d.tool === 'vwap') window.DrawingForecast.drawAnchoredVWAP(ctx, d, pane);
    if (d.tool === 'fixedvolprof') window.DrawingForecast.drawFixedVolProf(ctx, d, pane);
    if (d.tool === 'anchvolprof') window.DrawingForecast.drawAnchVolProf(ctx, d, pane);

    // ── Patterns & Elliott Waves ──
    if (d.tool === 'cyclic-lines') window.DrawingPatterns.drawCyclicLines(ctx, d, pane);
    if (d.tool === 'time-cycles') window.DrawingPatterns.drawTimeCycles(ctx, d, pane);
    if (d.tool === 'sine-line') window.DrawingPatterns.drawSineLine(ctx, d, pane);
    if (d.tool === 'xabcd') window.DrawingPatterns.drawXABCD(ctx, d, pane);
    if (d.tool === 'cypher') window.DrawingPatterns.drawCypher(ctx, d, pane);
    if (d.tool === 'headshoulders') window.DrawingPatterns.drawHeadShoulders(ctx, d, pane);
    if (d.tool === 'abcdpat') window.DrawingPatterns.drawABCD(ctx, d, pane);
    if (d.tool === 'trianglepat') window.DrawingPatterns.drawTrianglePattern(ctx, d, pane);
    if (d.tool === 'threedrives') window.DrawingPatterns.drawThreeDrives(ctx, d, pane);
    if (d.tool === 'elliott-impulse') window.DrawingPatterns.drawElliottImpulse(ctx, d, pane);
    if (d.tool === 'elliott-correct') window.DrawingPatterns.drawElliottCorrect(ctx, d, pane);
    if (d.tool === 'elliott-tri') window.DrawingPatterns.drawElliottTriangle(ctx, d, pane);
    if (d.tool === 'elliott-double') window.DrawingPatterns.drawElliottDouble(ctx, d, pane);
    if (d.tool === 'elliott-triple') window.DrawingPatterns.drawElliottTriple(ctx, d, pane);

    } finally {
      ctx.restore();
    }

    if (selected) {
      ctx.save();
      _renderAnchors(ctx, d, pane);
      ctx.restore();
    } else if (d.id === _hoverDrawingId) {
      // Show dim anchor preview on hover (unselected)
      ctx.save();
      ctx.globalAlpha = 0.5;
      _renderAnchors(ctx, d, pane);
      ctx.restore();
    }
  }

  // ── TF Visibility Helper ────────────────────────────────────
  // Normalize TF strings for case-insensitive comparison with visibility keys
  // e.g. '1H' → '1h', '1D' → '1D' (as saved by dialog), '60' → '1h'
  function _normalizeVizTf(tf) {
    if (!tf) return '';
    // Map numeric minute strings to label form (how dialog saves them)
    const map = {
      '1': '1m', '3': '3m', '5': '5m', '15': '15m', '30': '30m',
      '60': '1h', '120': '2h', '240': '4h', '480': '8h', '720': '12h',
      '1440': '1D', 'D': '1D',
      '10080': '1W', 'W': '1W',
      '43200': '1M', 'M': '1M',
    };
    // Uppercase single-letter shortcuts
    const upper = tf.toUpperCase();
    if (map[tf]) return map[tf];
    // Already labelled: normalise case to match dialog (1m/5m/1h/4h/1D/1W/1M)
    return tf
      .replace(/^(\d+)(H)$/i, (_, n) => `${n}h`)   // 1H → 1h
      .replace(/^(\d+)(M)$/, (_, n) => `${n}m`)   // 1M (month) stays; but 5M → 5m
      .replace(/^(\d+)(m)$/i, (_, n) => `${n}m`);  // already lowercase
  }

  // ── Shape Drawing & Coordinate Conversion ──────────────────

  function _timeToX(pane, time) {
    let x = pane.chart.timeScale().timeToCoordinate(time);
    if (x !== null) return x;

    // If exact time doesn't exist (e.g. cross timeframe), interpolate
    const data = pane.candlesData;
    if (!data || data.length === 0) return null;
    if (time <= data[0].time) return pane.chart.timeScale().timeToCoordinate(data[0].time);
    if (time >= data[data.length - 1].time) return pane.chart.timeScale().timeToCoordinate(data[data.length - 1].time);

    let i = 0;
    let left = 0, right = data.length - 1;
    while (left <= right) {
      let mid = Math.floor((left + right) / 2);
      if (data[mid].time === time) { i = mid; break; }
      else if (data[mid].time < time) { i = mid; left = mid + 1; }
      else { right = mid - 1; }
    }

    if (i < data.length - 1) {
      const x1 = pane.chart.timeScale().timeToCoordinate(data[i].time);
      const x2 = pane.chart.timeScale().timeToCoordinate(data[i + 1].time);
      if (x1 !== null && x2 !== null) {
        const ratio = (time - data[i].time) / (data[i + 1].time - data[i].time);
        return x1 + (x2 - x1) * ratio;
      }
    }
    return pane.chart.timeScale().timeToCoordinate(data[i].time);
  }

  function _pt2xy(pt, pane) {
    if (!pt || pt.price === null || pt.time === null) return null;
    const x = _timeToX(pane, pt.time);
    const y = pane.series.priceToCoordinate(pt.price);
    if (x === null || y === null) return null;
    return { x, y };
  }





















































  // ── Info Line ─────────────────────────────────────────────
  // Like a trendline but shows a stat box: Δprice, %, bar count, angle


  // ── Flat Top/Bottom Channel ────────────────────────────────
  // Slanted line from p1→p2, plus a horizontal (flat) band line.
  // The flat side sits at the price of whichever endpoint is "outer"
  // (lower if p2 > p1 → flat bottom; higher if p2 < p1 → flat top).


  // ── Regression Trend ─────────────────────────────────────
  // Linear regression on close prices in the p1→p2 time range.
  // Draws centre line + ±1 std-dev channel bands.


  // ── Anchored VWAP ─────────────────────────────────────────
  // Cumulative VWAP starting from the anchor candle (p1.time) to the end of data.
  // Single-point tool — only p1 is used (the anchor).


  // ── New Drawing Implementations ───────────────────────────


  function _getFibLevels(s) {
    if (s && s.fibLevels && s.fibLevels.length > 0) return s.fibLevels;
    return [
      { v: 0, color: '#787b86', active: true },
      { v: 0.236, color: '#f44336', active: true },
      { v: 0.382, color: '#ff9800', active: true },
      { v: 0.5, color: '#4caf50', active: true },
      { v: 0.618, color: '#00bcd4', active: true },
      { v: 0.786, color: '#2962ff', active: true },
      { v: 1, color: '#787b86', active: true },
      { v: 1.618, color: '#9c27b0', active: true },
      { v: 2.618, color: '#e91e63', active: true }
    ];
  }































  function _extendToEdge(x1, y1, x2, y2, w, h) {
    const dx = x2 - x1, dy = y2 - y1;
    if (dx === 0 && dy === 0) return { x: x2, y: y2 };
    let t = Infinity;
    if (dx > 0) t = Math.min(t, (w - x1) / dx);
    if (dx < 0) t = Math.min(t, -x1 / dx);
    if (dy > 0) t = Math.min(t, (h - y1) / dy);
    if (dy < 0) t = Math.min(t, -y1 / dy);
    return { x: x1 + dx * t, y: y1 + dy * t };
  }

  // ── Magnet Snap (TradingView behavior) ─────────────────────
  //
  // How it works:
  //   - Does NOT change cursor icon or crosshair lines
  //   - Only affects the coordinates where the drawing point is PLACED
  //   - Weak:  snap to nearest candle OHLC only when cursor is within ~20px
  //   - Strong: ALWAYS snap to nearest candle OHLC, regardless of distance
  //   - Ctrl key temporarily inverts: if magnet off → temp strong, if on → temp off
  //
  function _snapToCandle(pane, rawTime, rawPrice) {
    let mode = _getMagnetMode();
    if (!mode || mode === 'off') {
      return { time: rawTime, price: rawPrice };
    }

    const candles = pane.candlesData;
    if (!candles || candles.length === 0) {
      return { time: rawTime, price: rawPrice };
    }

    // Convert rawTime to number for comparison
    const rawTimeNum = typeof rawTime === 'object'
      ? new Date(rawTime.year, rawTime.month - 1, rawTime.day).getTime() / 1000
      : rawTime;

    // Binary-search-like: find nearest candle by time
    let nearestCdl = null;
    let minDT = Infinity;

    for (const c of candles) {
      if (!c.time) continue;
      const cTime = typeof c.time === 'object'
        ? new Date(c.time.year, c.time.month - 1, c.time.day).getTime() / 1000
        : c.time;
      const dt = Math.abs(cTime - rawTimeNum);
      if (dt < minDT) {
        minDT = dt;
        nearestCdl = c;
      }
    }

    if (!nearestCdl) return { time: rawTime, price: rawPrice };

    // Find nearest OHLC value on the nearest candle
    let closestPrice = rawPrice;
    let minPriceDist = Infinity;
    const ohlc = [nearestCdl.open, nearestCdl.high, nearestCdl.low, nearestCdl.close];

    for (const p of ohlc) {
      if (p === undefined || p === null) continue;
      const dp = Math.abs(p - rawPrice);
      if (dp < minPriceDist) {
        minPriceDist = dp;
        closestPrice = p;
      }
    }

    if (mode === 'weak') {
      // Weak magnet: only snap price if cursor is within ~20px of the OHLC value
      const rawY = pane.series.priceToCoordinate(rawPrice);
      const snapY = pane.series.priceToCoordinate(closestPrice);
      if (rawY === null || snapY === null) {
        return { time: nearestCdl.time, price: rawPrice };
      }
      const pixelDist = Math.abs(rawY - snapY);

      if (pixelDist > 20) {
        // Too far from OHLC — snap time but NOT price
        // console.log(`[Magnet WEAK] Fiyat mesafesi çok uzak (${Math.round(pixelDist)}px > 20px). Sadece zaman hizalandı.`);
        return { time: nearestCdl.time, price: rawPrice };
      }

      // Close enough — snap both
      console.log(`[Magnet WEAK] Yapıştı! Mesafe: ${Math.round(pixelDist)}px. (OHLC noktasına kilitlendi)`);
      return { time: nearestCdl.time, price: closestPrice };
    }

    // Strong magnet: always snap both time and price
    console.log(`[Magnet STRONG] Mesafe önemsiz, direkt en yakın OHLC noktasına kilitlendi!`);
    return { time: nearestCdl.time, price: closestPrice };
  }

  function _uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  // ── Hit Testing ────────────────────────────────────────────
  function _hitTest(x, y, d, pane) {
    if (!_isDrawingVisible(d, pane)) return false;

    const tolerance = 10;

    if (d.p1 && d.p2 && ['trendline', 'ray', 'extended', 'channel', 'arrowdraw', 'trendangle', 'infoline', 'flattopbottom', 'regression', 'fib-ret', 'fib-timezone', 'fib-circles', 'fib-speedfan', 'fib-spiral', 'gann-fan', 'gann-box', 'gann-sq', 'gann-sqfixed', 'cyclic-lines', 'time-cycles', 'sine-line', 'disjointch', 'fib-ext', 'fib-channel', 'fib-timebased', 'pitchfork', 'schiffpitch', 'modschiff', 'insidepitch', 'triangle', 'arc', 'curve', 'doublecurve'].includes(d.tool)) {
      const a = _pt2xy(d.p1, pane);
      const b = _pt2xy(d.p2, pane);
      if (a && Math.hypot(x - a.x, y - a.y) <= tolerance) return 'p1';
      if (b && Math.hypot(x - b.x, y - b.y) <= tolerance) return 'p2';
      if (d.p3) {
        const c = _pt2xy(d.p3, pane);
        if (c && Math.hypot(x - c.x, y - c.y) <= tolerance) return 'p3';
      }
      if (d.p4) {
        const p4 = _pt2xy(d.p4, pane);
        if (p4 && Math.hypot(x - p4.x, y - p4.y) <= tolerance) return 'p4';
      }
    }

    if (d.points && d.points.length > 0) {
      for (let i = 0; i < d.points.length; i++) {
        const ptXY = _pt2xy(d.points[i], pane);
        if (ptXY && Math.hypot(x - ptXY.x, y - ptXY.y) <= tolerance) return 'p' + (i + 1);
      }
    }

    if (d.tool === 'rect' && d.p1 && d.p2) {
      const a = _pt2xy(d.p1, pane);
      const b = _pt2xy(d.p2, pane);
      if (!a || !b) return false;
      const x1 = Math.min(a.x, b.x), x2 = Math.max(a.x, b.x);
      const y1 = Math.min(a.y, b.y), y2 = Math.max(a.y, b.y);
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2;
      const isSelected = (d.id === _selectedId);
      const isHovered = (d.id === _hoverDrawingId);

      // Anchor noktaları: seçili VEYA hover ediliyorken aktif (cursor değişimi için)
      if (isSelected || isHovered) {
        const pts = [
          { id: 'rect_tl', x: x1, y: y1 },
          { id: 'rect_tm', x: mx, y: y1 },
          { id: 'rect_tr', x: x2, y: y1 },
          { id: 'rect_ml', x: x1, y: my },
          { id: 'rect_mr', x: x2, y: my },
          { id: 'rect_bl', x: x1, y: y2 },
          { id: 'rect_bm', x: mx, y: y2 },
          { id: 'rect_br', x: x2, y: y2 }
        ];
        for (const pt of pts) {
          if (Math.hypot(x - pt.x, y - pt.y) <= tolerance * 1.5) return pt.id;
        }
      }

      const onTop = Math.abs(y - y1) <= tolerance && x >= x1 - tolerance && x <= x2 + tolerance;
      const onBottom = Math.abs(y - y2) <= tolerance && x >= x1 - tolerance && x <= x2 + tolerance;
      const onLeft = Math.abs(x - x1) <= tolerance && y >= y1 - tolerance && y <= y2 + tolerance;
      const onRight = Math.abs(x - x2) <= tolerance && y >= y1 - tolerance && y <= y2 + tolerance;
      const onMid = Math.abs(y - my) <= tolerance && x >= x1 - tolerance && x <= x2 + tolerance;
      if (onTop || onBottom || onLeft || onRight || onMid) return 'line';

      // İç alan: sadece seçiliyken sürüklenebilir
      if (isSelected && x > x1 && x < x2 && y > y1 && y < y2) return 'rect_body';
      return false;
    }

    if (d.tool === 'rotatedrect' && d.p1 && d.p2 && d.p3) {
      const a = _pt2xy(d.p1, pane);
      const b = _pt2xy(d.p2, pane);
      const c = _pt2xy(d.p3, pane);
      if (!a || !b || !c) return false;

      const isSelected = (d.id === _selectedId);
      const isHovered = (d.id === _hoverDrawingId);

      const dx = b.x - a.x, dy = b.y - a.y;
      const L = Math.hypot(dx, dy);
      if (L > 0) {
        const Nx = -dy / L, Ny = dx / L;
        const H = (c.x - a.x) * Nx + (c.y - a.y) * Ny;

        const tl = { x: a.x + Nx * H, y: a.y + Ny * H };
        const tr = { x: b.x + Nx * H, y: b.y + Ny * H };
        const br = { x: b.x - Nx * H, y: b.y - Ny * H };
        const bl = { x: a.x - Nx * H, y: a.y - Ny * H };
        const corners = [tl, tr, br, bl];

        if (isSelected || isHovered) {
          if (Math.hypot(x - tl.x, y - tl.y) <= tolerance * 1.5) return 'rect_tl';
          if (Math.hypot(x - tr.x, y - tr.y) <= tolerance * 1.5) return 'rect_tr';
          if (Math.hypot(x - bl.x, y - bl.y) <= tolerance * 1.5) return 'rect_bl';
          if (Math.hypot(x - br.x, y - br.y) <= tolerance * 1.5) return 'rect_br';
          if (Math.hypot(x - a.x, y - a.y) <= tolerance * 1.5) return 'p1';
          if (Math.hypot(x - b.x, y - b.y) <= tolerance * 1.5) return 'p2';
        }

        // Check if inside polygon using ray-casting
        let inside = false;
        for (let i = 0, j = corners.length - 1; i < corners.length; j = i++) {
          const xi = corners[i].x, yi = corners[i].y;
          const xj = corners[j].x, yj = corners[j].y;
          const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / ((yj - yi) || 1) + xi);
          if (intersect) inside = !inside;
        }

        // Check edges
        let onEdge = false;
        for (let i = 0; i < corners.length; i++) {
          const j = (i + 1) % corners.length;
          if (_distToSegment(x, y, corners[i].x, corners[i].y, corners[j].x, corners[j].y) <= tolerance) {
            onEdge = true; break;
          }
        }

        if (onEdge) return 'line';
        if (isSelected && inside) return 'line'; // Treat body as 'line' to move whole shape
      }
    }

    // Circle hit test
    if (d.tool === 'circle' && d.p1 && d.p2) {
      const a = _pt2xy(d.p1, pane);
      const b = _pt2xy(d.p2, pane);
      if (a && b) {
        const isSelected = (d.id === _selectedId);
        const isHovered = (d.id === _hoverDrawingId);
        const radius = Math.hypot(b.x - a.x, b.y - a.y);
        const dist = Math.hypot(x - a.x, y - a.y);
        if (isSelected || isHovered) {
          if (Math.hypot(x - a.x, y - a.y) <= tolerance * 1.5) return 'p1';
          if (Math.hypot(x - b.x, y - b.y) <= tolerance * 1.5) return 'p2';
        }
        if (Math.abs(dist - radius) <= tolerance) return 'line';
        if (isSelected && dist < radius) return 'line';
      }
    }

    // Ellipse hit test
    if (d.tool === 'ellipse' && d.p1 && d.p2) {
      const a = _pt2xy(d.p1, pane);
      const b = _pt2xy(d.p2, pane);
      if (a && b) {
        const isSelected = (d.id === _selectedId);
        const isHovered = (d.id === _hoverDrawingId);
        const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
        const rx = Math.abs(b.x - a.x) / 2, ry = Math.abs(b.y - a.y) / 2;
        // Cardinal anchor hit-test (shown when selected or hovered)
        if (isSelected || isHovered) {
          if (Math.hypot(x - (cx - rx), y - cy) <= tolerance * 1.5) return 'ell_l';
          if (Math.hypot(x - (cx + rx), y - cy) <= tolerance * 1.5) return 'ell_r';
          if (Math.hypot(x - cx, y - (cy - ry)) <= tolerance * 1.5) return 'ell_t';
          if (Math.hypot(x - cx, y - (cy + ry)) <= tolerance * 1.5) return 'ell_b';
        }
        if (rx > 0 && ry > 0) {
          const nx = (x - cx) / rx, ny = (y - cy) / ry;
          const ellVal = nx * nx + ny * ny;
          const edgeTol = tolerance / Math.min(rx, ry);
          if (Math.abs(ellVal - 1) <= edgeTol * 2) return 'line';
          if (isSelected && ellVal < 1) return 'line';
        }
      }
    }

    // Position tools — anchor lines take priority over body
    if (['longpos', 'shortpos', 'posforecast'].includes(d.tool) && d.p1 && d.p2 && d.p3) {
      const a = _pt2xy(d.p1, pane);
      const b = _pt2xy(d.p2, pane);
      const tY = pane.series?.priceToCoordinate(d.p2.price);
      const sY = pane.series?.priceToCoordinate(d.p3.price);
      const eY = pane.series?.priceToCoordinate(d.p1.price);
      const rX = b ? b.x : null;
      if (a && tY != null && sY != null) {
        const minX = a.x - tolerance;
        // p1 entry anchor (left edge, entry Y)
        if (Math.hypot(x - a.x, y - (eY ?? a.y)) <= tolerance) return 'p1';
        // target price line (horizontal, across box width)
        if (Math.abs(y - tY) <= tolerance && x >= minX && (rX == null || x <= rX + tolerance)) return 'targetPrice';
        // stop price line
        if (Math.abs(y - sY) <= tolerance && x >= minX && (rX == null || x <= rX + tolerance)) return 'stopPrice';
        // right edge (vertical, full height of box)
        if (rX != null && Math.abs(x - rX) <= tolerance) {
          const lo = Math.min(tY, sY) - tolerance;
          const hi = Math.max(tY, sY) + tolerance;
          if (y >= lo && y <= hi) return 'endTime';
        }
        // body (interior of box)
        if (rX != null && x >= a.x && x <= rX) {
          const lo = Math.min(tY, sY);
          const hi = Math.max(tY, sY);
          if (y >= lo && y <= hi) return 'body';
        }
      }
    }
    if (d.p1 && d.tool === 'vwap') {
      const a = _pt2xy(d.p1, pane);
      if (a && Math.hypot(x - a.x, y - a.y) <= tolerance * 1.5) return 'p1';
    }

    if (d.tool === 'hline' || d.tool === 'crossline' || d.tool === 'hray') {
      if (d.price != null && isFinite(d.price)) {
        const ly = pane.series.priceToCoordinate(d.price);
        if (ly != null && isFinite(ly) && Math.abs(y - ly) <= tolerance) {
          if (d.tool === 'hray') {
            if (d.time != null) {
              const lx = _timeToX(pane, d.time);
              if (lx != null && isFinite(lx) && x >= lx - tolerance) return 'line';
            }
          } else if (d.tool === 'hline') {
            const cvsW = pane.drawingCanvas.width / (window.devicePixelRatio || 1);
            if (Math.abs(x - cvsW / 2) <= tolerance * 2) return 'midpoint';
            return 'line';
          } else {
            return 'line';
          }
        }
      }
    }

    if (d.tool === 'vline' || d.tool === 'crossline') {
      if (d.time != null) {
        const lx = _timeToX(pane, d.time);
        if (lx != null && isFinite(lx) && Math.abs(x - lx) <= tolerance) return 'line';
      }
    }

    if (['vwap', 'arrowmarker', 'arrowup', 'arrowdown'].includes(d.tool) && d.p1) {
      const a = _pt2xy(d.p1, pane);
      if (a) {
        if (d.tool === 'vwap' && Math.hypot(x - a.x, y - a.y) <= tolerance * 1.5) return 'p1';
        if (d.tool !== 'vwap' && Math.hypot(x - a.x, y - a.y) <= 20) return 'p1'; // slightly larger hit area for markers
      }
    }

    if (d.tool === 'triangle' && d.p1 && d.p2 && d.p3) {
      const a = _pt2xy(d.p1, pane);
      const b = _pt2xy(d.p2, pane);
      const c = _pt2xy(d.p3, pane);
      if (a && b && c) {
        if (_distToSegment(x, y, a.x, a.y, b.x, b.y) <= tolerance) return 'line';
        if (_distToSegment(x, y, b.x, b.y, c.x, c.y) <= tolerance) return 'line';
        if (_distToSegment(x, y, c.x, c.y, a.x, a.y) <= tolerance) return 'line';

        // Triangle point in polygon test for body hit
        const sign = (p1, p2, p3) => (p1.x - p3.x) * (p2.y - p3.y) - (p2.x - p3.x) * (p1.y - p3.y);
        const pt = { x, y };
        const d1 = sign(pt, a, b);
        const d2 = sign(pt, b, c);
        const d3 = sign(pt, c, a);
        const has_neg = (d1 < 0) || (d2 < 0) || (d3 < 0);
        const has_pos = (d1 > 0) || (d2 > 0) || (d3 > 0);
        if (!(has_neg && has_pos)) return 'body';
      }
    }

    if (['curve', 'arc'].includes(d.tool) && d.p1 && d.p2 && d.p3) {
      const a = _pt2xy(d.p1, pane);
      const b = _pt2xy(d.p2, pane);
      const c = _pt2xy(d.p3, pane);
      if (a && b && c) {
        if (_distToSegment(x, y, a.x, a.y, b.x, b.y) <= tolerance) return 'line';
        if (_distToSegment(x, y, b.x, b.y, c.x, c.y) <= tolerance) return 'line';
      }
    }

    if (d.tool === 'doublecurve' && d.p1 && d.p2 && d.p3 && d.p4) {
      const a = _pt2xy(d.p1, pane);
      const b = _pt2xy(d.p2, pane);
      const c = _pt2xy(d.p3, pane);
      const p4 = _pt2xy(d.p4, pane);
      if (a && b && c && p4) {
        if (_distToSegment(x, y, a.x, a.y, b.x, b.y) <= tolerance) return 'line';
        if (_distToSegment(x, y, b.x, b.y, c.x, c.y) <= tolerance) return 'line';
        if (_distToSegment(x, y, c.x, c.y, p4.x, p4.y) <= tolerance) return 'line';
      }
    }

    if (['polyline', 'pathtool'].includes(d.tool) && d.points && d.points.length >= 2) {
      const pts = d.points.map(pt => _pt2xy(pt, pane)).filter(Boolean);
      for (let i = 0; i < pts.length - 1; i++) {
        if (_distToSegment(x, y, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y) <= tolerance) return 'line';
      }
    }

    if (['trendline', 'ray', 'extended', 'channel', 'arrowdraw', 'trendangle', 'infoline', 'flattopbottom', 'regression', 'fib-ret', 'fib-ext', 'fib-channel', 'fib-timezone', 'fib-circles', 'fib-speedfan', 'fib-timebased', 'fib-spiral', 'pitchfork', 'schiffpitch', 'modschiff', 'insidepitch'].includes(d.tool)) {
      const a = _pt2xy(d.p1, pane);
      const b = _pt2xy(d.p2, pane);
      if (!a || !b) return false;

      let p1 = a, p2 = b;
      if (['trendline', 'ray', 'extended'].includes(d.tool)) {
        const w = pane.drawingCanvas.width / (window.devicePixelRatio || 1);
        const h = pane.drawingCanvas.height / (window.devicePixelRatio || 1);
        if (d.style && d.style.extendLeft) {
          p1 = _extendToEdge(b.x, b.y, a.x, a.y, w, h);
        }
        if (d.style && d.style.extendRight) {
          p2 = _extendToEdge(a.x, a.y, b.x, b.y, w, h);
        }
      }

      const isSelected = d.id === _selectedId;
      const hitTolerance = (isSelected && ['trendline', 'ray', 'extended'].includes(d.tool)) ? 20 : tolerance;
      if (d.tool !== 'rect' && _distToSegment(x, y, p1.x, p1.y, p2.x, p2.y) <= hitTolerance) return 'line';
      if (d.tool === 'rect') {
        const x1 = Math.min(a.x, b.x), x2 = Math.max(a.x, b.x);
        const y1 = Math.min(a.y, b.y), y2 = Math.max(a.y, b.y);
        // 4 kenar
        const onTop = Math.abs(y - y1) <= tolerance && x >= x1 - tolerance && x <= x2 + tolerance;
        const onBottom = Math.abs(y - y2) <= tolerance && x >= x1 - tolerance && x <= x2 + tolerance;
        const onLeft = Math.abs(x - x1) <= tolerance && y >= y1 - tolerance && y <= y2 + tolerance;
        const onRight = Math.abs(x - x2) <= tolerance && y >= y1 - tolerance && y <= y2 + tolerance;
        // orta çizgi (yatay)
        const midY = (y1 + y2) / 2;
        const onMid = Math.abs(y - midY) <= tolerance && x >= x1 - tolerance && x <= x2 + tolerance;
        if (onTop || onBottom || onLeft || onRight || onMid) return 'line';
        return false;
      }

      if (d.tool === 'channel') {
        const offset = d.channelOffset || 40;
        if (_distToSegment(x, y, p1.x, p1.y + offset, p2.x, p2.y + offset) <= tolerance) return 'line';
      }

      // Precise geometric line-hit testing for complex tools
      if (d.tool.startsWith('fib') || d.tool.includes('pitch')) {
        const s = d.style || {};
        const activeLevels = _getFibLevels(s).filter(l => l.active !== false);
        const reverse = !!s.fibReverse;
        const extendLeft = !!s.extendLeft;
        const extendRight = !!s.extendRight;
        const W = pane.drawingCanvas.width / (window.devicePixelRatio || 1);
        const H = pane.drawingCanvas.height / (window.devicePixelRatio || 1);

        if (d.tool === 'fib-channel' && d.p3) {
          const c = _pt2xy(d.p3, pane);
          if (c) {
            const px3 = c.x - a.x;
            const py3 = c.y - a.y;
            const effPx3 = reverse ? -px3 : px3;
            const effPy3 = reverse ? -py3 : py3;
            for (const lvl of activeLevels) {
              let lx1 = a.x + effPx3 * lvl.v;
              let ly1 = a.y + effPy3 * lvl.v;
              let lx2 = b.x + effPx3 * lvl.v;
              let ly2 = b.y + effPy3 * lvl.v;
              if (extendLeft) { const ext = _extendToEdge(lx2, ly2, lx1, ly1, W, H); lx1 = ext.x; ly1 = ext.y; }
              if (extendRight) { const ext = _extendToEdge(lx1, ly1, lx2, ly2, W, H); lx2 = ext.x; ly2 = ext.y; }
              if (_distToSegment(x, y, lx1, ly1, lx2, ly2) <= tolerance) return 'line';
            }
          }
          return false;
        }

        if (d.tool === 'fib-timebased') {
          if (_distToSegment(x, y, a.x, a.y, b.x, b.y) <= tolerance) return 'line';
          if (d.p3) {
            const c = _pt2xy(d.p3, pane);
            if (c) {
              if (_distToSegment(x, y, b.x, b.y, c.x, c.y) <= tolerance) return 'line';
              const dx = b.x - a.x;
              for (const lvl of activeLevels) {
                const lx = c.x + dx * lvl.v;
                if (Math.abs(x - lx) <= tolerance) return 'line';
              }
            }
          }
          return false;
        }

        if (d.tool === 'fib-ext' && d.p3) {
          const c = _pt2xy(d.p3, pane);
          if (c) {
            const yDiff = b.y - a.y;
            const effYDiff = reverse ? -yDiff : yDiff;
            if (_distToSegment(x, y, a.x, a.y, b.x, b.y) <= tolerance) return 'line';
            if (_distToSegment(x, y, b.x, b.y, c.x, c.y) <= tolerance) return 'line';
            
            const extendLeft = !!s.extendLeft;
            const extendRight = !!s.extendRight;
            const leftX = extendLeft ? -100 : Math.min(a.x, b.x, c.x);
            const rightX = extendRight ? W + 100 : Math.max(a.x, b.x, c.x) + 150;

            for (const lvl of activeLevels) {
              const ly = c.y + effYDiff * lvl.v;
              if (_distToSegment(x, y, leftX, ly, rightX, ly) <= tolerance) return 'line';
            }
          }
          return false;
        }

        if (d.tool === 'fib-ret') {
          const yDiff = b.y - a.y;
          const effYDiff = reverse ? -yDiff : yDiff;
          
          const extendLeft = !!s.extendLeft;
          const extendRight = !!s.extendRight;
          const leftX = extendLeft ? -100 : Math.min(a.x, b.x);
          const rightX = extendRight ? W + 100 : Math.max(a.x, b.x);

          for (const lvl of activeLevels) {
            const ly = a.y + effYDiff * lvl.v;
            if (_distToSegment(x, y, leftX, ly, rightX, ly) <= tolerance) return 'line';
          }
          return false;
        }

        if (d.tool === 'fib-timezone') {
          const dx = b.x - a.x;
          const effDX = reverse ? -dx : dx;
          for (const lvl of activeLevels) {
            const lx = a.x + effDX * lvl.v;
            if (Math.abs(x - lx) <= tolerance) return 'line';
          }
          return false;
        }

        if (d.tool === 'fib-speedfan') {
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const effP1Y = reverse ? b.y : a.y;
          const effDY = reverse ? -dy : dy;

          let priceLevels = d.style.priceLevels;
          let timeLevels = d.style.timeLevels;
          if (!priceLevels) {
            priceLevels = activeLevels.slice(0, 7);
            timeLevels = activeLevels.slice(0, 7);
          }
          const actPrice = priceLevels.filter(l => l && l.active !== false);
          const actTime = timeLevels.filter(l => l && l.active !== false);

          for (const lvl of actPrice) {
            let pricePoint = { x: b.x, y: effP1Y + effDY * lvl.v };
            let extPrice = _extendToEdge(a.x, effP1Y, pricePoint.x, pricePoint.y, W, H);
            if (_distToSegment(x, y, a.x, effP1Y, extPrice.x, extPrice.y) <= Math.max(tolerance, 5)) return 'line';
          }
          for (const lvl of actTime) {
            if (lvl.v === 0) continue;
            let timePoint = { x: a.x + dx * lvl.v, y: b.y };
            let extTime = _extendToEdge(a.x, effP1Y, timePoint.x, timePoint.y, W, H);
            if (_distToSegment(x, y, a.x, effP1Y, extTime.x, extTime.y) <= Math.max(tolerance, 5)) return 'line';
          }
          return false;
        }

        if (d.tool === 'fib-circles') {
          const baseRadius = Math.hypot(b.x - a.x, b.y - a.y);
          const dist = Math.hypot(x - a.x, y - a.y);
          if (_distToSegment(x, y, a.x, a.y, b.x, b.y) <= tolerance) return 'line';
          for (const lvl of activeLevels) {
            const r = baseRadius * lvl.v;
            if (Math.abs(dist - r) <= tolerance) return 'line';
          }
          return false;
        }

        if (d.tool === 'fib-spiral') {
          if (_distToSegment(x, y, a.x, a.y, b.x, b.y) <= tolerance) return 'line';

          const baseRadius = Math.hypot(b.x - a.x, b.y - a.y);
          if (baseRadius < 1) return false;

          const startAngle = Math.atan2(b.y - a.y, b.x - a.x);
          const dx = x - a.x;
          const dy = y - a.y;
          const dist = Math.hypot(dx, dy);

          let angle = Math.atan2(dy, dx);
          let t = angle - startAngle;
          while (t < 0) t += Math.PI * 2;

          for (let k = 0; k <= 3; k++) {
            const currentT = t + k * Math.PI * 2;
            if (currentT > Math.PI * 6) break;
            const r = baseRadius * Math.pow(1.618033988749895, currentT / (Math.PI / 2));
            if (Math.abs(dist - r) <= Math.max(tolerance, 10)) return 'line';
          }
          return false;
        }

        // Generic catch-all for pitchforks etc. that fall through
        let minX = Math.min(a.x, b.x), maxX = Math.max(a.x, b.x);
        let minY = Math.min(a.y, b.y), maxY = Math.max(a.y, b.y);
        if (d.p3) {
          const c = _pt2xy(d.p3, pane);
          if (c) {
            minX = Math.min(minX, c.x); maxX = Math.max(maxX, c.x);
            minY = Math.min(minY, c.y); maxY = Math.max(maxY, c.y);
          }
        }
        minX -= 20; maxX += 20; minY -= 20; maxY += 20;
        if (x >= minX && x <= maxX && y >= minY && y <= maxY) return 'line';
      }

      return false;
    }

    // longpos/shortpos body is now handled in the anchor block above

    if (d.tool === 'texttool') {
      const a = _pt2xy(d.p1, pane);
      if (a) {
        const ctx = pane.drawingCanvas.getContext('2d');
        ctx.save();
        const s = d.style || {};
        const fontSize = s.fontSize || 16;
        ctx.font = `${s.bold ? 'bold ' : ''}${s.italic ? 'italic ' : ''}${fontSize}px Inter, -apple-system, sans-serif`;
        let rawText = d.text || 'Text';
        let lines = rawText.split('\n');

        // Account for wrap in hit-test too
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
        ctx.restore();
        const paddingX = 6, paddingY = 4, lh = fontSize * 1.2;

        // Ensure box covers at least the specified textWidth AND the longest line (for long words)
        const specifiedW = (s.textWidth != null) ? s.textWidth : 200;
        const w = (s.textWrap !== false)
          ? Math.max(specifiedW, autoW) + paddingX * 2
          : autoW + paddingX * 2;
        const h = lines.length * lh + paddingY * 2;

        if (d.id === _selectedId && s.textWrap !== false) {
          const hx = a.x + w;
          const hy = a.y + h / 2;
          if (Math.hypot(x - hx, y - hy) <= 10) return 'text_resize_r';
        }
        if (x >= a.x && x <= a.x + w && y >= a.y && y <= a.y + h) return 'body';
      }
    }

    if (d.tool === 'note') {
      const a = _pt2xy(d.p1, pane);
      const b = d.p2 ? _pt2xy(d.p2, pane) : a;
      if (a && b) {
        const ctx = pane.drawingCanvas.getContext('2d');
        ctx.save();
        const fontSize = d.style?.fontSize || 13;
        ctx.font = `${fontSize}px Inter, -apple-system, sans-serif`;
        const lines = (d.text || 'Note').split('\n');
        let maxW = 0;
        for (const l of lines) maxW = Math.max(maxW, ctx.measureText(l).width);
        ctx.restore();
        const lh = fontSize * 1.4, px = 8, py = 6;
        const bw = Math.max(maxW + px * 2, 60);
        const bh = lines.length * lh + py * 2;
        const bx = b.x - bw / 2;
        const by = b.y - bh / 2;
        if (x >= bx && x <= bx + bw && y >= by && y <= by + bh) return 'p2';
        if (Math.hypot(x - a.x, y - a.y) <= 10) return 'p1';
        if (_distToSegment(x, y, a.x, a.y, b.x, b.y) <= tolerance) return 'line';
      }
    }

    if (d.tool === 'callout') {
      const a = _pt2xy(d.p1, pane);
      const b = d.p2 ? _pt2xy(d.p2, pane) : a;
      if (a && b) {
        const ctx = pane.drawingCanvas.getContext('2d');
        ctx.save();
        const fontSize = d.style?.fontSize || 13;
        ctx.font = `${fontSize}px Inter, -apple-system, sans-serif`;
        const lines = (d.text || 'Callout').split('\n');
        let maxW = 0;
        for (const l of lines) maxW = Math.max(maxW, ctx.measureText(l).width);
        ctx.restore();
        const lh = fontSize * 1.4, px = 8, py = 6;
        const bw = Math.max(maxW + px * 2, 60);
        const bh = lines.length * lh + py * 2;
        const bx = b.x - bw / 2;
        const by = b.y - bh / 2;
        if (x >= bx && x <= bx + bw && y >= by && y <= by + bh) return 'p2';
        if (Math.hypot(x - a.x, y - a.y) <= 10) return 'p1';
        if (_distToSegment(x, y, a.x, a.y, b.x, b.y) <= tolerance) return 'line';
      }
    }

    if (d.tool === 'pricenote') {
      const a = _pt2xy(d.p1, pane);
      const b = d.p2 ? _pt2xy(d.p2, pane) : a;
      if (a && b) {
        const ctx = pane.drawingCanvas.getContext('2d');
        ctx.save();
        const priceStr = typeof d.p1.price === 'number' ? d.p1.price.toFixed(2) : '';
        const label = d.text ? `${d.text}  ${priceStr}` : priceStr;
        const fontSize = d.style?.fontSize || 13;
        ctx.font = `${fontSize}px Inter, -apple-system, sans-serif`;
        const tw = ctx.measureText(label).width;
        ctx.restore();
        const px = 8, py = 5;
        const bw = tw + px * 2;
        const bh = fontSize * 1.4 + py * 2;
        const bx = b.x;
        const by = b.y - bh / 2;
        if (x >= bx && x <= bx + bw && y >= by && y <= by + bh) return 'p2';
        if (Math.hypot(x - a.x, y - a.y) <= 10) return 'p1';
        if (_distToSegment(x, y, a.x, a.y, b.x, b.y) <= tolerance) return 'line';
      }
    }

    if (d.tool === 'pricelabel') {
      const a = _pt2xy(d.p1, pane);
      if (a) {
        const ctx = pane.drawingCanvas.getContext('2d');
        ctx.save();
        const priceStr = typeof d.p1.price === 'number' ? d.p1.price.toFixed(2) : '';
        const label = d.text || priceStr;
        const fontSize = d.style?.fontSize || 12;
        ctx.font = `bold ${fontSize}px Inter, -apple-system, sans-serif`;
        const tw = ctx.measureText(label).width;
        ctx.restore();
        const px = 8, py = 5;
        const bw = tw + px * 2;
        const bh = fontSize * 1.5 + py * 2;
        const arrowW = 8;
        const bx = a.x + arrowW;
        const by = a.y - bh / 2;
        if (x >= bx && x <= bx + bw && y >= by && y <= by + bh) return 'body';
        if (x >= a.x && x <= bx && Math.abs(y - a.y) <= 10) return 'body';
        if (x >= 0 && x <= a.x && Math.abs(y - a.y) <= 10) return 'line';
      }
    }

    if (d.tool === 'flagmark') {
      const a = _pt2xy(d.p1, pane);
      if (a) {
        const flagW = 32, flagH = 20, poleH = 50;
        if (x >= a.x && x <= a.x + flagW && y >= a.y - poleH && y <= a.y - poleH + flagH) return 'body';
        if (Math.abs(x - a.x) <= 5 && y >= a.y - poleH && y <= a.y) return 'line';
      }
    }

    if (d.tool === 'tableanno') {
      const a = _pt2xy(d.p1, pane);
      if (a) {
        const rows = d.style?.rows || 2;
        const cols = d.style?.cols || 3;
        const cellW = 64, cellH = 22;
        const bw = cols * cellW, bh = rows * cellH;
        if (x >= a.x && x <= a.x + bw && y >= a.y && y <= a.y + bh) {
          const r = Math.floor((y - a.y) / cellH);
          const c = Math.floor((x - a.x) / cellW);
          if (r >= 0 && r < rows && c >= 0 && c < cols) {
            return `table_cell_${r}_${c}`;
          }
          return 'body';
        }
      }
    }

    if (d.tool === 'rect' || d.tool === 'rotatedrect') {
      const a = _pt2xy(d.p1, pane);
      const b = _pt2xy(d.p2, pane);
      if (!a || !b) return false;
      const rx = Math.min(a.x, b.x), ry = Math.min(a.y, b.y);
      const w = Math.abs(b.x - a.x), h = Math.abs(b.y - a.y);
      const hitTop = _distToSegment(x, y, rx, ry, rx + w, ry) <= tolerance;
      const hitBottom = _distToSegment(x, y, rx, ry + h, rx + w, ry + h) <= tolerance;
      const hitLeft = _distToSegment(x, y, rx, ry, rx, ry + h) <= tolerance;
      const hitRight = _distToSegment(x, y, rx + w, ry, rx + w, ry + h) <= tolerance;
      const hitInside = x >= rx && x <= rx + w && y >= ry && y <= ry + h;
      return hitTop || hitBottom || hitLeft || hitRight || hitInside ? 'line' : false;
    }

    return false;
  }

  function _distToSegment(px, py, x1, y1, x2, y2) {
    const l2 = (x2 - x1) ** 2 + (y2 - y1) ** 2;
    if (l2 === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
    t = Math.max(0, Math.min(1, t));
    const cx = x1 + t * (x2 - x1);
    const cy = y1 + t * (y2 - y1);
    return Math.hypot(px - cx, py - cy);
  }

  function _getPanePrecision(pane) {
    try {
      const fmt = pane.series.options().priceFormat;
      if (fmt && typeof fmt.precision === 'number') return fmt.precision;
      const pScale = pane.chart.priceScale(pane.priceSide || 'right');
      if (pScale && pScale.options().precision != null) return pScale.options().precision;
    } catch (e) { }
    try {
      const mid = pane.cvs.height / 2;
      const p1 = pane.series.coordinateToPrice(mid);
      const p2 = pane.series.coordinateToPrice(mid + 1);
      if (p1 != null && p2 != null) {
        const diff = Math.abs(p1 - p2);
        if (diff > 0) return Math.min(Math.max(0, Math.ceil(-Math.log10(diff))), 8);
      }
    } catch (e) { }
    return 2;
  }

  function getPanePrecision(drawing) {
    // 1. Use the actual active panes from LayoutManager
    const panes = (window.LayoutManager && LayoutManager.panes) || [];

    // 2. Search for the pane that owns this drawing instance
    for (const pane of panes) {
      if (!pane || !pane.series) continue;

      // Check if this drawing object is currently managed by this pane
      if (pane.drawings && pane.drawings.some(d => d.id === drawing.id)) {
        return _getPanePrecision(pane);
      }

      // Also check State as a backup
      const drawings = (window.State && State.get('drawings')) || {};
      const key = pane.symbol || '';
      if (drawings[key] && drawings[key].some(d => d.id === drawing.id)) {
        return _getPanePrecision(pane);
      }
    }

    // 3. Fallback: If not found, use the active pane
    const active = window.LayoutManager && LayoutManager.getActivePane();
    if (active && active.series) return _getPanePrecision(active);

    // 4. Final fallback
    if (panes[0] && panes[0].series) return _getPanePrecision(panes[0]);
    return 2;
  }

  function _xy2pt(xy, pane) {
    if (!xy || xy.x === undefined || xy.y === undefined) return null;
    if (!pane || !pane.chart || !pane.series) return null;
    const time = pane.chart.timeScale().coordinateToTime(xy.x);
    const price = pane.series.coordinateToPrice(xy.y);
    if (time === null || price === null) return null;
    return { time, price };
  }

  function _formatPrice(price) {
    if (typeof window.formatPrice === 'function') {
      return window.formatPrice(price);
    }
    const num = Number(price);
    return isNaN(num) ? '' : num.toFixed(2);
  }

  function _clearSelection() {
    if (_selectedId) {
      _selectedId = null;
      if (window.EventBus) window.EventBus.emit('drawing:deselected');
      requestRedrawAll();
    }
  }

  const utils = {
    pt2xy: _pt2xy,
    xy2pt: _xy2pt,
    timeToX: _timeToX,
    formatPrice: _formatPrice,
    clearSelection: _clearSelection
  };

  return { 
    init, 
    onMouseDown, 
    onMouseMove, 
    onMouseUp, 
    onDoubleClick, 
    requestRedrawAll, 
    renderPane, 
    cancelDrawing, 
    saveHistory: _saveHistory,
    isGlobalLocked: () => _globalLock,
    undo,
    redo,
    getPanePrecision,
    utils
  };
})();