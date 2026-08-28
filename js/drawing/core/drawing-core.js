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
  // [2026-08-19] Kullanıcı bulgusu: mıknatıs açıkken RSI (veya başka bir
  // subpane) üzerinde çizim yapmaya çalışınca ana panelin mumlarına
  // yapışıyordu — çünkü tüm y→fiyat dönüşümü HER YERDE `pane.series`
  // (ana mum serisi) üzerinden yapılıyor, subpane'in kendi ölçeği hiç
  // kullanılmıyor (mimari kısıt — drawing-core.js çizim araçları sadece
  // ana panel için tasarlanmış). TAM düzeltme (subpane'in kendi fiyat
  // ölçeğine göre doğru y→fiyat eşlemesi) kapsamlı bir refactor gerektirir;
  // bu turda TV'nin asıl davranışı olan "subpane üzerindeyken mıknatıs
  // devre dışı kalır" kısmı hedeflendi — `onMouseDown`/`onMouseMove`
  // başında güncellenir, `_snapToCandle` bunu okur.
  let _cursorOverSubpane = false;
  function _updateSubpaneFlag(pane, y) {
    try {
      const mainPane = pane.chart.panes()[0];
      _cursorOverSubpane = !!mainPane && y > mainPane.getHeight();
    } catch (_) { _cursorOverSubpane = false; }
  }

  // [2026-08-19] Subpane (RSI vb.) fiyat ölçeği düzeltmesi — bir çizim
  // hangi panelde oluşturulduysa (d.paneKey: null=ana panel, indikatör id=
  // subpane) render/hit-test/anchor kodu HEP o panelin kendi serisini
  // kullanmalı, ana panelin `pane.series`'ini değil. `_pt2xy`/`_xy2pt`
  // bunu merkezi olarak çözer; hangi çizimin işlendiğini bilmek için
  // `_renderPaneKey` modül-seviyesi bayrağı kullanılır — _renderDrawing/
  // _hitTest/_renderAnchors/_openTrendlineTextEditor girişinde d.paneKey'e
  // ayarlanır (bkz. ilgili fonksiyonlar). Eski çizimlerde (veya ana panelde
  // oluşturulanlarda) paneKey yok/null → davranış eskisiyle BİREBİR aynı
  // (pane.series, offsetY 0).
  let _renderPaneKey = null;

  /** Verilen paneKey (indikatör id, null=ana panel) için render serisini ve
   *  o panelin canvas'taki dikey ofsetini (önceki panellerin toplam
   *  yüksekliği) döndürür. Seri bulunamazsa ana panele düşer. */
  function _paneSeriesInfo(pane, key) {
    if (key && pane && pane._indSeries && pane._indSeries[key]) {
      const series = pane._indSeries[key];
      const paneIndex = pane._indPaneIndex ? pane._indPaneIndex[key] : null;
      let offsetY = 0;
      if (paneIndex != null) {
        try {
          const panes = pane.chart.panes();
          for (let i = 0; i < paneIndex; i++) {
            if (panes[i]) offsetY += panes[i].getHeight();
          }
        } catch (_) { offsetY = 0; }
      }
      return { series, offsetY };
    }
    return { series: pane.series, offsetY: 0 };
  }

  /** Canvas'a göreli bir y koordinatının hangi subpane'e (indikatör id) denk
   *  geldiğini bulur; ana paneldeyse null döner. Yeni bir çizim başlatılırken
   *  (mousedown) hangi panelin serisinin kullanılacağını belirlemek için. */
  function _detectPaneKeyAtY(pane, y) {
    try {
      if (!pane._indPaneIndex) return null;
      const mainPane = pane.chart.panes()[0];
      if (!mainPane || y <= mainPane.getHeight()) return null;
      for (const key of Object.keys(pane._indPaneIndex)) {
        const idx = pane._indPaneIndex[key];
        const p = pane.chart.panes()[idx];
        if (!p) continue;
        const { offsetY } = _paneSeriesInfo(pane, key);
        if (y >= offsetY && y <= offsetY + p.getHeight()) return key;
      }
    } catch (_) {}
    return null;
  }
  // Tracks whether the last pointerdown was claimed by us.
  // Used in onMouseUp to claim (or not) the matching pointerup,
  // preventing LWC from receiving orphaned pointerup events that corrupt its pan state.
  let _lastPointerdownClaimed = false;
  let _globalLock = false;
  let _pendingTextEditTimer = null;
  let _settingsSavedDebounceTimer = null;

  let _toolStyles = {};

  function _getToolStyle(tool) {
    // Load from State if not in local cache
    if (!_toolStyles || Object.keys(_toolStyles).length === 0) {
      _toolStyles = State.get('drawingStyles') || {};
    }
    if (tool.startsWith('fib-')) {
      // BUG (2026-08-01): Fib araçları burada HER ZAMAN taze varsayılan
      // seviyelerle dönüyordu — diğer tüm araçların kullandığı "son
      // kullanılan ayarı hatırla" (_toolStyles) yoluna hiç uğramıyordu.
      // Kullanıcı Trend Line'da rengi değiştirip yeni bir Trend Line
      // çizdiğinde son ayar korunuyor ama Fibo'da hep sıfırlanıyordu —
      // artık aynı mekanizmayı kullanıyor: önce son kaydedilmiş ayar var mı
      // bak, yoksa (hiç kullanılmamışsa) DSDFiboTabs'ın varsayılanına düş.
      if (_toolStyles[tool]) return JSON.parse(JSON.stringify(_toolStyles[tool]));
      const fibLevels = window.DSDFiboTabs?.getDefaultLevels
        ? window.DSDFiboTabs.getDefaultLevels(tool)
        : [];
      return { fibLevels };
    }
    // If we have a saved style for this tool, clone it
    if (_toolStyles[tool]) return JSON.parse(JSON.stringify(_toolStyles[tool]));
    if (tool === 'texttool') return { fontSize: 16, textColor: '#ffffff', fillColor: 'rgba(0,0,0,0)', bold: false, italic: false, textWidth: 200, textWrap: true };
    if (tool === 'note') return { fontSize: 13, textColor: '#ffffff', fillColor: '#1e222d', borderColor: '#363c4e', bold: false, italic: false };
    if (tool === 'callout') return { fontSize: 13, textColor: '#ffffff', fillColor: '#1e222d', borderColor: '#363c4e', bold: false, italic: false };
    if (tool === 'pricenote') return { textColor: '#ffffff', fillColor: '#1e222d', borderColor: '#363c4e', fontSize: 13 };
    if (tool === 'pricelabel') return { textColor: '#a3a6af', fillColor: '#2962ff', fontSize: 12 };
    if (tool === 'flagmark') return { color: '#2962ff', textColor: '#ffffff', fontSize: 11 };
    if (tool === 'tableanno') return { textColor: '#ffffff', fillColor: '#1e222d', borderColor: '#363c4e', fontSize: 12, rows: 2, cols: 3 };
    if (tool === 'trendline') return { color: '#a3a6af', width: 1, lineStyle: 'solid', extendLeft: false, extendRight: false, textColor: '#ffffff', fillColor: 'rgba(41, 137, 255, 0.2)', textAlignH: 'center', textAlignV: 'top' };
    if (tool === 'ray') return { color: '#a3a6af', width: 1, lineStyle: 'solid', extendLeft: false, extendRight: true, textColor: '#ffffff', fillColor: 'rgba(41, 137, 255, 0.2)', textAlignH: 'center', textAlignV: 'top' };
    if (tool === 'extended') return { color: '#a3a6af', width: 1, lineStyle: 'solid', extendLeft: true, extendRight: true, textColor: '#ffffff', fillColor: 'rgba(41, 137, 255, 0.2)', textAlignH: 'center', textAlignV: 'top' };
    // Otherwise return a generic default
    if (tool === 'hray') return { color: '#2962ff', width: 1, lineStyle: 'solid', extendLeft: false, textColor: '#ffffff', fillColor: 'rgba(41, 137, 255, 0.2)', textAlignH: 'center', textAlignV: 'top' };
    if (tool === 'hline') return { color: '#2962ff', width: 1, lineStyle: 'solid', textColor: '#ffffff', fillColor: 'rgba(41, 137, 255, 0.2)', textAlignH: 'center', textAlignV: 'top' };
    // textAlignH: 'right' (Center kaldırıldı — inline metin düzenleme ve
    // çizgiyi sağa/sola sürükleme özellikleriyle çakışıyordu, bkz.
    // dsd-standard-tabs.js renderTextTab).
    if (tool === 'vline') return { color: '#2962ff', width: 1, lineStyle: 'solid', textOrientation: 'vertical', timeLabel: true, textColor: '#ffffff', fillColor: 'rgba(41, 137, 255, 0.2)', textAlignH: 'right', textAlignV: 'middle' };
    if (tool === 'crossline') return { color: '#2962ff', width: 1, lineStyle: 'solid', priceLabel: true, timeLabel: true, textColor: '#ffffff', fillColor: 'rgba(41, 137, 255, 0.2)' };
    if (tool === 'flattopbottom') return { color: '#FF9800', width: 1, lineStyle: 'solid', extendLeft: false, extendRight: false, capLeft: 'normal', capRight: 'normal', showPrices: true, priceColor: '#2962ff', priceFontSize: 12, priceBold: false, priceItalic: false, background: true, bgColor: '#FF9800', bgOpacity: 15, textColor: '#ffffff' };
    if (tool === 'regression') return {
      color: '#2962ff', width: 1, lineStyle: 'solid',
      upperDev: 2, lowerDev: 2,
      useUpperDev: true, useLowerDev: true,
      extendRight: false,
      source: 'close',
      textColor: '#ffffff',
      priceLabel: true,
      showPearson: true,
      upColor: '#2962ff', upWidth: 1, upStyle: 'dashed', upOpacity: 0.1,
      downColor: '#2962ff', downWidth: 1, downStyle: 'dashed',
      baseOpacity: 0.1,
      fillColor: 'rgba(41, 137, 255, 0.2)'
    };
    // textAlignV: 'middle' ("Inside") — kullanıcı isteğiyle varsayılan
    // TradingView'daki gibi kanalın 0.5 (orta) seviyesinin üzerinde.
    if (tool === 'channel') return { color: '#2962ff', width: 1, lineStyle: 'solid', fillColor: 'rgba(9, 105, 218, 0.2)', textColor: '#ffffff', priceLabel: true, textAlignH: 'center', textAlignV: 'middle' };
    if (['pricerange', 'daterange', 'datepricerange'].includes(tool)) {
      return { color: '#2962ff', width: 1, lineStyle: 'solid', fillColor: 'rgba(41, 98, 255, 0.15)', textColor: '#ffffff', fontSize: 12 };
    }
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
    _updateSubpaneFlag(pane, y);

    // Devam eden çok noktalı bir çizim varsa (ör. fib-channel'ın 2./3.
    // tıklaması) yeni nokta İLK tıklamada belirlenen panele sadık kalır —
    // imleç sınıra yakınsa bile aynı çizim yarı ana yarı subpane'de bölünmesin.
    const activePaneKey = (_inProgress && _inProgress.symbol === pane.symbol && !_inProgress.finished)
      ? (_inProgress.paneKey || null)
      : _detectPaneKeyAtY(pane, y);
    const { series: activeSeries, offsetY: activeOffsetY } = _paneSeriesInfo(pane, activePaneKey);

    const rawTime = pane.chart.timeScale().coordinateToTime(x);
    const rawPrice = activeSeries.coordinateToPrice(y - activeOffsetY);

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
      // Seçili çizimi önce kontrol et — altında başka çizim olsa bile kaçırma
      if (_selectedId) {
        const sel = drawings.find(d => d.id === _selectedId);
        if (sel) {
          const ht = _hitTest(x, y, sel, pane);
          if (ht) { hitId = sel.id; hitType = ht; hitDrawing = sel; }
        }
      }
      if (!hitId) {
        for (let i = drawings.length - 1; i >= 0; i--) {
          const d = drawings[i];
          const ht = _hitTest(x, y, d, pane);
          if (ht) { hitId = d.id; hitType = ht; hitDrawing = d; break; }
        }
      }

      if (hitId) {
        const isReClick = (hitId === _selectedId);
        _selectedId = hitId;
        // For position tools, calculate topY so toolbar can appear above the shape
        let topY = e.clientY;
        if (['longpos', 'shortpos'].includes(hitDrawing.tool)) {
          const _prevRPK = _renderPaneKey;
          _renderPaneKey = hitDrawing.paneKey || null;
          try {
            const a = _pt2xy(hitDrawing.p1, pane);
            const b = hitDrawing.p2 ? _pt2xy(hitDrawing.p2, pane) : null;
            const c = hitDrawing.p3 ? _pt2xy(hitDrawing.p3, pane) : null;
            if (a) {
              const ys = [a.y, b?.y, c?.y].filter(v => v != null);
              const rawTop = Math.min(...ys);
              const rect = pane.drawingCanvas.getBoundingClientRect();
              topY = rect.top + rawTop;
            }
          } finally {
            _renderPaneKey = _prevRPK;
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
        _inProgress = { tool: 'measure', symbol: pane.symbol, p1: pt, p2: { ...pt }, id: _uid(), paneKey: activePaneKey };
      
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
      _finishDrawing(pane.symbol, { tool: 'hline', price, id: _uid(), style: _getToolStyle('hline'), paneKey: activePaneKey });
      _lastPointerdownClaimed = true;
      return true;
    }
    if (_activeTool === 'vline') {
      if (time == null) return false;
      _finishDrawing(pane.symbol, { tool: 'vline', time, id: _uid(), style: _getToolStyle('vline'), paneKey: activePaneKey });
      _lastPointerdownClaimed = true;
      return true;
    }
    if (_activeTool === 'hray') {
      if (price == null || !isFinite(price) || time == null) return false;
      _finishDrawing(pane.symbol, { tool: 'hray', price, time, p1: { time, price }, id: _uid(), style: _getToolStyle('hray'), paneKey: activePaneKey });
      _lastPointerdownClaimed = true;
      return true;
    }
    if (_activeTool === 'crossline') {
      if (price == null || !isFinite(price) || time == null) return false;
      _finishDrawing(pane.symbol, { tool: 'crossline', price, time, id: _uid(), style: _getToolStyle('crossline'), paneKey: activePaneKey });
      _lastPointerdownClaimed = true;
      return true;
    }
    if (_activeTool === 'texttool') {
      const d = {
        tool: 'texttool',
        p1: pt,
        id: _uid(),
        text: 'Text',
        style: _getToolStyle('texttool') || { fontSize: 16, textColor: '#d1d4dc', fillColor: 'rgba(0,0,0,0)', bold: false, italic: false },
        paneKey: activePaneKey
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
      const d = { tool: _activeTool, p1: pt, id: _uid(), text: '', style: _getToolStyle(_activeTool), paneKey: activePaneKey };
      _finishDrawing(pane.symbol, d);
      _selectedId = d.id;
      EventBus.emit('drawing:selected', { id: d.id, symbol: pane.symbol, x: e.clientX, y: e.clientY });
      _lastPointerdownClaimed = true;
      return true;
    }

    // ── Single-point Markers ────────────────────────────
    if (['arrowmarker', 'arrowup', 'arrowdown'].includes(_activeTool)) {
      _finishDrawing(pane.symbol, { tool: _activeTool, p1: pt, id: _uid(), style: _getToolStyle(_activeTool), paneKey: activePaneKey });
      _lastPointerdownClaimed = true;
      return true;
    }

    // ── Two-point drawing tools (click-click) ──────────
    const TWO_PT_TOOLS = [
      'trendline', 'ray', 'extended', 'rect', 'arrowdraw', 'trendangle',
      'infoline', 'regression',
      'fib-ret', 'fib-timezone', 'fib-speedfan',
      'cyclic-lines',
      'circle', 'ellipse',
      'note', 'callout', 'pricenote',
      // gorevler: Forecast & Measurement Faz 2 — bunlar da rect gibi 2 köşe
      // noktasıyla tanımlanan bir kutu; yerleştirme/hit-test/drag'i rect ile
      // AYNI genel mekanizmadan geçiyor (bkz. _hitTestInner'daki rect bloğu),
      // sadece render (drawing-forecast.js) ve etiket içeriği farklı.
      'pricerange', 'daterange', 'datepricerange',
    ];
    if (TWO_PT_TOOLS.includes(_activeTool)) {
      if (!_inProgress) {
        _inProgress = { tool: _activeTool, symbol: pane.symbol, p1: pt, p2: pt, id: _uid(), style: _getToolStyle(_activeTool), paneKey: activePaneKey };
      } else if (!_inProgress.p3) {
        // Second click: finish drawing
        if (['note', 'callout', 'pricenote'].includes(_activeTool)) {
          _inProgress.p2 = { time: rawTime, price: rawPrice };
          } else if (e.shiftKey && ['trendline', 'ray', 'extended'].includes(_activeTool) && _inProgress.p1) {
          const p1x = _timeToX(pane, _inProgress.p1.time);
          const p1y = activeSeries.priceToCoordinate(_inProgress.p1.price);
          const rawX = pane.chart.timeScale().timeToCoordinate(pt.time);
          const dx = rawX - p1x;
          const dy = activeSeries.priceToCoordinate(pt.price) - p1y;
          if (Math.abs(dy) < Math.abs(dx)) {
            _inProgress.p2 = { time: pt.time, price: _inProgress.p1.price };
          } else {
            _inProgress.p2 = { time: _inProgress.p1.time, price: pt.price };
          }
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
      'flattopbottom', 'fib-ext', 'fib-channel',
      'rotatedrect', 'triangle', 'arc', 'channel'
    ];
    if (THREE_PT_TOOLS.includes(_activeTool)) {
      if (!_inProgress) {
        _inProgress = { tool: _activeTool, symbol: pane.symbol, p1: pt, p2: pt, p3: null, id: _uid(), style: _getToolStyle(_activeTool), paneKey: activePaneKey };
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

    // ── Multi-point drawing tools (click-click-...-click) ──
    const MULTI_PT_TOOLS = ['pathtool'];
    if (MULTI_PT_TOOLS.includes(_activeTool)) {
      if (!_inProgress) {
        _inProgress = { tool: _activeTool, symbol: pane.symbol, points: [pt, pt], id: _uid(), style: _getToolStyle(_activeTool), paneKey: activePaneKey };
      } else {
        const lastPt = _inProgress.points[_inProgress.points.length - 2];
        // If clicked on the exact same spot (double click), finish drawing
        if (lastPt && Math.abs(x - _timeToX(pane, lastPt.time)) < 5 && Math.abs(y - (activeOffsetY + activeSeries.priceToCoordinate(lastPt.price))) < 5) {
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

    if (['longpos', 'shortpos'].includes(_activeTool)) {
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
        style: _getToolStyle(_activeTool),
        paneKey: activePaneKey
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
    _updateSubpaneFlag(pane, y);

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
          if (['longpos', 'shortpos'].includes(d.tool)) {
            const _prevRPK = _renderPaneKey;
            _renderPaneKey = d.paneKey || null;
            try {
              const origA = _pt2xy(_dragState.origP1, pane);
              const origB = _pt2xy(_dragState.origP2, pane);
              const origC = _pt2xy(_dragState.origP3, pane);
              const newA = _xy2pt({ x: origA.x + dx, y: origA.y + dy }, pane);
              const newB = _xy2pt({ x: origB.x + dx, y: origB.y + dy }, pane);
              const newC = _xy2pt({ x: origC.x + dx, y: origC.y + dy }, pane);
              if (newA) { d.p1.time = newA.time; d.p1.price = newA.price; }
              if (newB) { d.p2.time = newB.time; d.p2.price = newB.price; }
              if (newC) { d.p3.time = newC.time; d.p3.price = newC.price; }
            } finally {
              _renderPaneKey = _prevRPK;
            }
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
        } else if (d.tool === 'flattopbottom' && _dragState.hitType === 'ftb_left') {
          // Sol yatay anchor: sadece Y (fiyat) hareket eder → p3.price güncelle
          // X sabit kalır (p1.x'e kilitli, zaten görsel olarak öyle)
          const { price } = _snapToCandle(pane, rawTime, rawPrice);
          d.p3 = { ...d.p3, price };

        } else if (d.tool === 'flattopbottom' && _dragState.hitType === 'ftb_right') {
          // Sağ yatay anchor: sadece Y (fiyat) hareket eder → p3.price güncelle
          // Her iki anchor aynı fiyatta olmalı, birlikte hareket eder
          const { price } = _snapToCandle(pane, rawTime, rawPrice);
          d.p3 = { ...d.p3, price };

        } else if (d.tool === 'flattopbottom' && _dragState.hitType === 'ftb_hline') {
          // Yatay çizginin gövdesine sürükleme: sadece Y hareket eder
          const { price } = _snapToCandle(pane, rawTime, rawPrice);
          d.p3 = { ...d.p3, price };
        } else if (_dragState.hitType === 'p3') {
          const { time, price } = _snapToCandle(pane, rawTime, rawPrice);
          d.p3 = { time, price };
        } else if (_dragState.hitType === 'p4') {
          const { time, price } = _snapToCandle(pane, rawTime, rawPrice);
          d.p4 = { time, price };
        } else if (d.tool === 'channel' && (_dragState.hitType === 'ch_p1' || _dragState.hitType === 'ch_p2')) {
          // Corner on top line: snap to candle, keep channel height (p3 offset from p1 preserved)
          const { time, price } = _snapToCandle(pane, rawTime, rawPrice);
          const isP1 = _dragState.hitType === 'ch_p1';
          const origA = _pt2xy(_dragState.origP1, pane);
          const origC = _pt2xy(_dragState.origP3, pane);
          const origB = _pt2xy(_dragState.origP2, pane);
          if (isP1) {
            d.p1 = { time, price };
            // Keep p3 at the same perpendicular offset from p1
            if (origA && origC && origB) {
              let m = 0;
              if (origB.x !== origA.x) m = (origB.y - origA.y) / (origB.x - origA.x);
              const origDy = origC.y - origA.y - m * (origC.x - origA.x);
              const newAX = pane.chart.timeScale().timeToCoordinate(time);
              const newAY = pane.series.priceToCoordinate(price);
              if (newAX !== null && newAY !== null) {
                const newBX = _timeToX(pane, d.p2.time);
                const newBY = pane.series.priceToCoordinate(d.p2.price);
                let nm = 0;
                if (newBX !== null && newAX !== null && newBX !== newAX) nm = (newBY - newAY) / (newBX - newAX);
                const p3PixelX = newAX;
                const p3PixelY = newAY + origDy;
                d.p3 = {
                  time: pane.chart.timeScale().coordinateToTime(p3PixelX),
                  price: pane.series.coordinateToPrice(p3PixelY)
                };
              }
            }
          } else {
            d.p2 = { time, price };
          }
        } else if (d.tool === 'channel' && (_dragState.hitType === 'ch_bot_p1' || _dragState.hitType === 'ch_bot_p2')) {
          // Corner on bottom line: snap to candle, update p3 to preserve perpendicular offset
          const { time, price } = _snapToCandle(pane, rawTime, rawPrice);
          const isBot1 = _dragState.hitType === 'ch_bot_p1';
          const aX = _timeToX(pane, d.p1.time);
          const aY = pane.series.priceToCoordinate(d.p1.price);
          const bX = _timeToX(pane, d.p2.time);
          const bY = pane.series.priceToCoordinate(d.p2.price);
          const newY = pane.series.priceToCoordinate(price);
          if (aX !== null && aY !== null && bX !== null && bY !== null && newY !== null) {
            let m = 0;
            if (bX !== aX) m = (bY - aY) / (bX - aX);
            const newX = isBot1 ? aX : bX;
            const dy = newY - (isBot1 ? aY : bY);
            const p3PxX = aX;
            const p3PxY = aY + dy;
            d.p3 = {
              time: pane.chart.timeScale().coordinateToTime(p3PxX),
              price: pane.series.coordinateToPrice(p3PxY)
            };
          }
        } else if (d.tool === 'channel' && _dragState.hitType === 'ch_mid_top') {
          // Middle of top line: adjust channel height without changing p1/p2 time (resize from top)
          const aX = _timeToX(pane, _dragState.origP1.time);
          const aY = pane.series.priceToCoordinate(_dragState.origP1.price);
          const bX = _timeToX(pane, _dragState.origP2.time);
          const bY = pane.series.priceToCoordinate(_dragState.origP2.price);
          if (aX !== null && aY !== null && bX !== null && bY !== null) {
            let m = 0;
            if (bX !== aX) {
              m = (bY - aY) / (bX - aX);
            }
            
            const { time, price } = _snapToCandle(pane, rawTime, rawPrice);
            const snapX = _timeToX(pane, time);
            const snapY = pane.series.priceToCoordinate(price);
            
            if (snapX !== null && snapY !== null) {
              const shiftY = snapY - (aY + m * (snapX - aX));
              
              // Only move p1 and p2 vertically to stick to snapped mouse. p3 stays the same!
              // Time is UNCHANGED so the channel doesn't slide left/right.
              d.p1.price = pane.series.coordinateToPrice(aY + shiftY);
              d.p2.price = pane.series.coordinateToPrice(bY + shiftY);
            }
          }

        } else if (d.tool === 'channel' && _dragState.hitType === 'ch_mid_bot') {
          // Middle of bottom line: just set p3 to the snapped point
          const { time, price } = _snapToCandle(pane, rawTime, rawPrice);
          d.p3.time = time;
          d.p3.price = price;
        } else if (/^p\d+$/.test(_dragState.hitType) && d.points) {
          const idx = parseInt(_dragState.hitType.slice(1)) - 1;
          if (idx >= 0 && idx < d.points.length) {
            const { time, price } = _snapToCandle(pane, rawTime, rawPrice);
            d.points[idx] = { time, price };
          }
        } else if (_dragState.hitType === 'targetPrice') {
          let usePrice = rawPrice;
          if (d.paneKey) {
            const _prevRPK = _renderPaneKey;
            _renderPaneKey = d.paneKey;
            try { usePrice = _xy2pt({ x, y }, pane)?.price ?? rawPrice; }
            finally { _renderPaneKey = _prevRPK; }
          }
          const { price } = _snapToCandle(pane, rawTime, usePrice);
          d.p2.price = price;
        } else if (_dragState.hitType === 'stopPrice') {
          let usePrice = rawPrice;
          if (d.paneKey) {
            const _prevRPK = _renderPaneKey;
            _renderPaneKey = d.paneKey;
            try { usePrice = _xy2pt({ x, y }, pane)?.price ?? rawPrice; }
            finally { _renderPaneKey = _prevRPK; }
          }
          const { price } = _snapToCandle(pane, rawTime, usePrice);
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
        } else if (_dragState.hitType === 'midpoint' && d.tool === 'hline') {
          const origY = pane.series.priceToCoordinate(_dragState.origPrice);
          const rawPrice = pane.series.coordinateToPrice(origY + dy);
          const rawTime = pane.chart.timeScale().coordinateToTime(_dragState.startX + (x - _dragState.startX));
          const { price } = _snapToCandle(pane, rawTime ?? d.time ?? rawTime, rawPrice);
          d.price = price;
          } else if (_dragState.hitType === 'vline_midpoint' && d.tool === 'vline') {
            if (_magnetMode !== 'off') {
              const { time } = _snapToCandle(pane, rawTime, rawPrice);
              d.time = time;
            } else {
              d.time = rawTime;
            }
        } else if (_dragState.hitType === 'hray_p1') {
          const origY = pane.series.priceToCoordinate(_dragState.origPrice);
          const origX = _timeToX(pane, _dragState.origTime);
          const rawPrice = pane.series.coordinateToPrice(origY + dy);
          const rawTime = pane.chart.timeScale().coordinateToTime(origX + dx);
          const { time, price } = _snapToCandle(pane, rawTime, rawPrice);
          d.price = price;
          d.time  = time;
          if (d.p1) { d.p1.price = price; d.p1.time = time; }
        } else if (_dragState.hitType === 'reg_p1' || _dragState.hitType === 'reg_p2') {
          const isP1 = _dragState.hitType === 'reg_p1';
          const candles = pane.candlesData || [];
          const toSec = t => typeof t === 'object'
            ? new Date(t.year, t.month-1, t.day, t.hour||0, t.minute||0).getTime()/1000 : t;
          const rawTimeNum = typeof rawTime === 'object'
            ? new Date(rawTime.year, rawTime.month-1, rawTime.day, rawTime.hour||0, rawTime.minute||0).getTime()/1000
            : rawTime;
          // En yakın mumu bul
          const nearestCdl = candles.reduce((a, b) =>
            Math.abs(toSec(b.time) - rawTimeNum) < Math.abs(toSec(a.time) - rawTimeNum) ? b : a, candles[0]);
          if (nearestCdl) {
            // En yakın OHLC fiyatını bul — her zaman snap, weak/strong fark etmez
            const ohlc = [nearestCdl.open, nearestCdl.high, nearestCdl.low, nearestCdl.close].filter(v => v != null);
            const snapPrice = ohlc.reduce((a, b) => Math.abs(b - rawPrice) < Math.abs(a - rawPrice) ? b : a);
            if (isP1) d.p1 = { time: nearestCdl.time, price: snapPrice };
            else      d.p2 = { time: nearestCdl.time, price: snapPrice };
          } else {
            if (isP1) d.p1 = { time: rawTime, price: rawPrice };
            else      d.p2 = { time: rawTime, price: rawPrice };
          }

        } else if (_dragState.hitType === 'reg_body') {
          // Sadece seçim — hareket yok
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
        // Seçili çizimi önce kontrol et
        if (_selectedId) {
          const sel = drawings.find(d => d.id === _selectedId);
          if (sel) {
            ht = _hitTest(x, y, sel, pane);
            if (ht) htDrawing = sel;
          }
        }
        if (!ht) {
          for (let i = drawings.length - 1; i >= 0; i--) {
            ht = _hitTest(x, y, drawings[i], pane);
            if (ht) { htDrawing = drawings[i]; break; }
          }
        }
        console.log('ht:', ht, htDrawing?.tool);
        if (_globalLock) {
          pane.cvs.style.cursor = 'crosshair';
        } else if (ht) {
          const tool = htDrawing ? htDrawing.tool : '';
          const isPos = ['longpos', 'shortpos'].includes(tool);
          if (ht === 'line' || ht === 'body' || ht === 'rect_body' || ht === 'midpoint' || ht === 'vline_midpoint') {
            // texttool/note/callout: always text cursor when selected; trendline/ray/extended/infoline: text only over hint area
            const hintTools = ['trendline', 'ray', 'extended', 'infoline', 'hline', 'hray'];
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
            } else if (htDrawing?.tool === 'vline' && ht === 'vline_midpoint') {
              pane.cvs.style.cursor = 'ew-resize';
            } else if (htDrawing?.tool === 'hray' && ht === 'hray_p1') {
              pane.cvs.style.cursor = 'default';
            } else if (tool === 'regression') {
              pane.cvs.style.cursor = 'grab';
            } else {
              pane.cvs.style.cursor = 'pointer';
            }
          } else if (ht === 'hray_p1') {
            pane.cvs.style.cursor = 'default';
          } else if (ht === 'text_resize_r') {
            pane.cvs.style.cursor = 'ew-resize';
          } else if ((ht === 'targetPrice' || ht === 'stopPrice') && isPos) {
            pane.cvs.style.cursor = 'ns-resize';
          } else if (ht === 'endTime' && isPos) {
            pane.cvs.style.cursor = 'ew-resize';
          } else if (['ftb_left', 'ftb_right', 'ftb_hline'].includes(ht) && htDrawing?.tool === 'flattopbottom') {
            const isSelected = htDrawing?.id === _selectedId;
            pane.cvs.style.cursor = isSelected ? 'ns-resize' : 'pointer';
          } else if (ht === 'line' && htDrawing?.tool === 'flattopbottom') {
            pane.cvs.style.cursor = 'pointer';
          } else if (tool === 'channel' && (ht === 'ch_p1' || ht === 'ch_p2' || ht === 'ch_bot_p1' || ht === 'ch_bot_p2')) {
            pane.cvs.style.cursor = 'default';
          } else if (tool === 'channel' && (ht === 'ch_mid_top' || ht === 'ch_mid_bot')) {
            pane.cvs.style.cursor = 'ns-resize';
          } else if (tool === 'channel' && ht === 'line') {
            pane.cvs.style.cursor = 'grab';
          } else if (ht === 'reg_body') {
            pane.cvs.style.cursor = 'pointer';
          } else if (ht === 'reg_p1' || ht === 'reg_p2') {
            pane.cvs.style.cursor = 'default';
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
    const inProgPaneKey = (_inProgress && _inProgress.symbol === pane.symbol && !_inProgress.finished)
      ? (_inProgress.paneKey || null)
      : _detectPaneKeyAtY(pane, y);
    const { series: inProgSeries, offsetY: inProgOffsetY } = _paneSeriesInfo(pane, inProgPaneKey);
    const rawTime = pane.chart.timeScale().coordinateToTime(x);
    const rawPrice = inProgSeries?.coordinateToPrice(y - inProgOffsetY);

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
          } else if (e.shiftKey && ['trendline', 'ray', 'extended'].includes(_inProgress.tool) && _inProgress.p1) {
            const p1x = _timeToX(pane, _inProgress.p1.time);
            const p1y = inProgSeries.priceToCoordinate(_inProgress.p1.price);
            const rawX = pane.chart.timeScale().timeToCoordinate(rawTime);
            const dx = rawX - p1x;
            const dy = (y - inProgOffsetY) - p1y;
            if (Math.abs(dy) < Math.abs(dx)) {
              _inProgress.p2 = { time, price: _inProgress.p1.price };
            } else {
              _inProgress.p2 = { time: _inProgress.p1.time, price };
            }
          } else {
            _inProgress.p2 = { time, price };
          }
        }
      }

      // Compute snap crosshair position (for custom rendering)
      const magnetMode = _getMagnetMode();
      if (!isNoMagnet && magnetMode && magnetMode !== 'off' && pane.candlesData?.length) {
        const snapX = pane.chart.timeScale().timeToCoordinate(time);
        const snapY = inProgOffsetY + inProgSeries.priceToCoordinate(price);
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
      if (!wasDragging && ds.isReClick && ['trendline', 'ray', 'extended', 'infoline', 'hline', 'hray', 'vline'].includes(ds.d.tool)) {
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
    const _prevRenderPaneKey = _renderPaneKey;
    _renderPaneKey = d.paneKey || null;
    try {
      return _openTrendlineTextEditorInner(d, pane, e);
    } finally {
      _renderPaneKey = _prevRenderPaneKey;
    }
  }

  function _openTrendlineTextEditorInner(d, pane, e) {
    const existing = document.getElementById('trendline-text-editor');
    if (existing) existing.remove();

    const s = d.style || {};
    const canvasRect = (pane.canvasContainer || pane.drawingCanvas || pane.cvs).getBoundingClientRect();

    // vline: dikey çizgi — zaman eksenine göre X, sabit canvas Y
    if (d.tool === 'vline') {
      if (d.time == null) return;
      const x = pane.chart.timeScale().timeToCoordinate(d.time);
      if (x == null || !isFinite(x)) return;
      const dpr = window.devicePixelRatio || 1;
      const cvsH = pane.drawingCanvas.height / dpr;
      const textAlignH = s.textAlignH || 'center';
      const textAlignV = s.textAlignV || 'middle';
      const orientation = s.textOrientation || 'vertical';

      let tx;
      if      (textAlignH === 'left')  tx = x - 6;
      else if (textAlignH === 'right') tx = x + 6;
      else                             tx = x;

      const rowH = (s.fontSize || 14) + 4;
      let ty;
      if      (textAlignV === 'bottom') ty = cvsH - rowH;
      else if (textAlignV === 'middle') ty = cvsH / 2;
      else                              ty = 10;

      let transformY, transformOrigin;
      if (orientation === 'vertical') {
        transformY = 'translate(-50%, -50%) rotate(-90deg)';
        transformOrigin = '50% 50%';
      } else {
        if      (textAlignH === 'left')  transformY = 'translate(-100%, 0%)';
        else if (textAlignH === 'right') transformY = 'translate(0%, 0%)';
        else                             transformY = 'translate(-50%, 0%)';
        transformOrigin = '0 0';
      }

      const anchorViewX = canvasRect.left + tx;
      const anchorViewY = canvasRect.top  + ty;
      const fontSize = s.fontSize || 13;

      const ta = document.createElement('textarea');
      ta.id = 'trendline-text-editor';
      ta.value = s.text || '';
      ta.placeholder = 'Add text…';
      ta.rows = 1;

      Object.assign(ta.style, {
        position:        'fixed',
        left:            anchorViewX + 'px',
        top:             anchorViewY + 'px',
        transform:       transformY,
        transformOrigin: transformOrigin,
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
      return; // vline için burada bitir
    }

    // hline: p1/p2 yok, price ve canvas genişliğinden anchor hesapla
    if (d.tool === 'hline' || d.tool === 'hray') {
      if (d.price == null || !isFinite(d.price)) return;
      const y = pane.series.priceToCoordinate(d.price);
      if (y == null || !isFinite(y)) return;
      const cvsW = pane.drawingCanvas.width / (window.devicePixelRatio || 1);
      const textAlignH = s.textAlignH || 'center';
      const textAlignV = s.textAlignV || 'top';

      // Price label genişliğini hesapla (çizginin bittiği yer)
      let labelW = 0;
      if (s.priceLabel !== false) {
        const tmpCtx = pane.drawingCanvas.getContext('2d');
        tmpCtx.font = '10px "JetBrains Mono", sans-serif';
        const priceStr = d.price != null ? d.price.toFixed(2) : '';
        labelW = tmpCtx.measureText(priceStr).width + 18;
      }
      const lineEndX = cvsW - labelW;

      // hray için startX, hline için 0
      let lineStartX = 0;
      if (d.tool === 'hray') {
        const rawX = pane.chart.timeScale().timeToCoordinate(d.time);
        lineStartX = (rawX != null && isFinite(rawX) && !s.extendLeft) ? rawX : 0;
      }

      let anchorX;
      if (textAlignH === 'left')       anchorX = lineStartX + 6;
      else if (textAlignH === 'right') anchorX = lineEndX - 6;
      else                             anchorX = (lineStartX + lineEndX) / 2;

      // textAlignV'e göre Y
      let anchorY, transformY;
      if (textAlignV === 'bottom')      { anchorY = y + 5;  transformY = 'translate(-50%, 0%)'; }
      else if (textAlignV === 'middle') { anchorY = y;       transformY = 'translate(-50%, -50%)'; }
      else                              { anchorY = y - 5;   transformY = 'translate(-50%, -100%)'; }

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
        top:             anchorViewY + 'px',
        transform:       transformY,
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

    // Fiyat cetveli veya zaman cetveli bölgesine tıklandıysa drawing hit-test yapma.
    // Bu bölgelerdeki çift tıklama fitContent() için LWC'ye bırakılmalı.
    const timeScaleH = 22;
    const priceScaleW = (pane.chart
      ? (pane.chart.priceScale(pane.priceSide === 'left' ? 'left' : 'right').width() || 65)
      : 65);
    const drawingW = rect.width - priceScaleW;
    const drawingH = rect.height - timeScaleH;
    const drawingOffsetX = pane.priceSide === 'left' ? priceScaleW : 0;
    if (x < drawingOffsetX || x > drawingOffsetX + drawingW || y > drawingH) {
      return false;
    }

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
      localStorage.removeItem('pintrade_remove_locked');

      const all = State.get('drawings') || {};
      const current = all[activeSym] || [];
      if (!removeLocked) {
        all[activeSym] = current.filter(d => d.locked);
      } else {
        all[activeSym] = [];
      }

      State.set('drawings', all);
      Storage.save('drawings', all);
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

    // gorevler2.md izleme listesi (2026-08-10) — ayar panelindeki slider/renk
    // seçicileri sürükleme sırasında bu event'i her ufak değişiklikte
    // (her 'input' tick'inde) tetikliyor, her seferinde tüm State'i
    // JSON.stringify edip localStorage'a yazıyordu. 300ms debounce ile
    // kullanıcı durduktan sonra tek bir kayıt tetiklenir — kaydedilen veri/
    // mantık aynı, sadece tetiklenme sıklığı azaltıldı.
    function _persistSettingsSaved() {
      if (_selectedId) {
        Object.values(State.get('drawings') || {}).forEach(list => {
          const d = (list || []).find(x => x.id === _selectedId);
          if (d && d.style) {
            // Fib araçları eskiden burada hariç tutuluyordu — bu yüzden
            // ayar panelinde yapılan hiçbir değişiklik "son kullanılan ayar"
            // olarak hatırlanmıyordu, her yeni Fib hep sıfırdan (varsayılan)
            // çiziliyordu. Trend Line ve diğer tüm araçlar zaten bu şekilde
            // çalışıyordu — Fib de artık aynı yolu kullanıyor.
            const styleToSave = JSON.parse(JSON.stringify(d.style));
            delete styleToSave.text;
            _toolStyles[d.tool] = styleToSave;
            State.set('drawingStyles', _toolStyles);
          }
        });
      }
      // BUG (2026-08-01): Ayar diyaloğundaki OK/tik/değer değişiklikleri
      // (dsd-apply.js → DSDApply.applyFromForm) `drawing` objesini YERİNDE
      // (mutate ederek) güncelliyor — bu obje `State`'in kendi `_state.drawings`
      // dizisiyle aynı referans olduğu için değişiklik aynı sekme/oturumda
      // hemen görünüyordu. Ama hiçbir yerde `State.set('drawings', ...)`
      // çağrılmadığı için `save()` (localStorage + bulut senkron) hiç tetiklenmiyordu
      // — yani sayfa yenilenince (veya başka bir cihazda açılınca) tüm
      // menü değişiklikleri kayboluyordu. Artık her ayar kaydında `drawings`
      // de açıkça persist ediliyor.
      State.set('drawings', State.get('drawings'));
    }

    EventBus.on('drawing:settings:saved', () => {
      // requestRedrawAll() anında çalışır — slider/renk sürüklerken chart'taki
      // çizim eskisi gibi anlık güncellenir. Sadece State.set (localStorage
      // yazımı) debounce'lanır (bkz. yukarıdaki _persistSettingsSaved notu).
      requestRedrawAll();
      if (_settingsSavedDebounceTimer) clearTimeout(_settingsSavedDebounceTimer);
      _settingsSavedDebounceTimer = setTimeout(() => {
        _settingsSavedDebounceTimer = null;
        _persistSettingsSaved();
      }, 300);
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

    // Ctrl+Z: Undo, Ctrl+Y / Ctrl+Shift+Z: Redo
    document.addEventListener('keydown', e => {
      const focused = document.activeElement;
      const isEditing = focused && (focused.tagName === 'INPUT' || focused.tagName === 'TEXTAREA' || focused.isContentEditable);
      if (isEditing) return;
      if (e.ctrlKey && !e.shiftKey && e.key === 'z') { e.preventDefault(); undo(); }
      if (e.ctrlKey && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) { e.preventDefault(); redo(); }
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
      if (_inProgress.tool === 'pathtool' && _inProgress.points && _inProgress.points.length > 2) {
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
    const noGenericAnchors = ['note', 'callout', 'pricenote', 'pricelabel', 'tableanno', 'texttool', 'regression'];
    if (noGenericAnchors.includes(d.tool)) return;

    const pts = [];
    if (['longpos', 'shortpos'].includes(d.tool)) {
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
    } else if (['rect', 'pricerange', 'daterange', 'datepricerange'].includes(d.tool)) {
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
    } else if (d.tool === 'channel') {
      const a = _pt2xy(d.p1, pane);
      const b = _pt2xy(d.p2, pane);
      if (a && b) {
        pts.push({ ...a, id: 'ch_p1' });
        pts.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, type: 'square', id: 'ch_mid_top' });
        pts.push({ ...b, id: 'ch_p2' });

        if (d.p3) {
          const c = _pt2xy(d.p3, pane);
          if (c) {
            let m = 0;
            if (b.x !== a.x) {
              m = (b.y - a.y) / (b.x - a.x);
            }
            const dy = c.y - a.y - m * (c.x - a.x);
            const botA = { x: a.x, y: a.y + dy };
            const botB = { x: b.x, y: b.y + dy };
            const botMid = { x: (botA.x + botB.x) / 2, y: (botA.y + botB.y) / 2 };
            pts.push({ ...botA, id: 'ch_bot_p1' });
            pts.push({ ...botMid, type: 'square', id: 'ch_mid_bot' });
            pts.push({ ...botB, id: 'ch_bot_p2' });
          }
        }
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
          pts.push({ x: W * 0.90, y });
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
    const _prevRenderPaneKey = _renderPaneKey;
    _renderPaneKey = d.paneKey || null;
    try {
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
    if (d.tool === 'vline') window.DrawingTrend.drawVLine(ctx, d, pane, selected);
    if (d.tool === 'hray') window.DrawingTrend.drawHRay(ctx, d, pane, selected);
    if (d.tool === 'crossline') window.DrawingTrend.drawCrossLine(ctx, d, pane);
    if (d.tool === 'trendline') window.DrawingTrend.drawTrendLine(ctx, d, pane, selected);
    if (d.tool === 'ray')       window.DrawingTrend.drawRay(ctx, d, pane, selected);
    if (d.tool === 'extended')  window.DrawingTrend.drawExtended(ctx, d, pane, selected);
    if (d.tool === 'trendangle') window.DrawingTrend.drawTrendAngle(ctx, d, pane, selected);
    if (d.tool === 'channel') window.DrawingTrend.drawChannel(ctx, d, pane);
    if (d.tool === 'infoline') window.DrawingTrend.drawInfoLine(ctx, d, pane, selected);
    if (d.tool === 'flattopbottom') window.DrawingTrend.drawFlatTopBottom(ctx, d, pane);
    if (d.tool === 'regression') window.DrawingTrend.drawRegressionTrend(ctx, d, pane);
    // ── Annotations ──
    if (d.tool === 'texttool') window.DrawingAnnotations.drawTextTool(ctx, d, pane, d.id === _hoverDrawingId, selected);
    if (d.tool === 'note') window.DrawingAnnotations.drawNote(ctx, d, pane, d.id === _hoverDrawingId, selected);
    if (d.tool === 'callout') window.DrawingAnnotations.drawCallout(ctx, d, pane, d.id === _hoverDrawingId, selected);
    if (d.tool === 'pricenote') window.DrawingAnnotations.drawPriceNote(ctx, d, pane, d.id === _hoverDrawingId, selected);
    if (d.tool === 'pricelabel') window.DrawingAnnotations.drawPriceLabel(ctx, d, pane, d.id === _hoverDrawingId, selected);
    if (d.tool === 'flagmark') window.DrawingAnnotations.drawFlagMark(ctx, d, pane, d.id === _hoverDrawingId, selected);
    if (d.tool === 'tableanno') window.DrawingAnnotations.drawTableAnno(ctx, d, pane, d.id === _hoverDrawingId, selected);
    if (d.tool === 'icon') window.DrawingAnnotations.drawIcon(ctx, d, pane, d.id === _hoverDrawingId, selected);
    // ── Fibonacci ──
    if (d.tool === 'fib-ret') window.DrawingFibo.drawFibRet(ctx, d, pane);
    if (d.tool === 'fib-ext') window.DrawingFibo.drawFibExt(ctx, d, pane);
    if (d.tool === 'fib-channel') window.DrawingFibo.drawFibChannel(ctx, d, pane);
    if (d.tool === 'fib-timezone') window.DrawingFibo.drawFibTimezone(ctx, d, pane, selected);
    if (d.tool === 'fib-speedfan') window.DrawingFibo.drawFibSpeedfan(ctx, d, pane);
    // ── Geometric Shapes & Arrows ──
    if (d.tool === 'brush') window.DrawingShapes.drawBrush(ctx, d, pane);
    if (d.tool === 'highlighter') window.DrawingShapes.drawHighlighter(ctx, d, pane);
    if (d.tool === 'rect') window.DrawingShapes.drawRect(ctx, d, pane);
    if (d.tool === 'rotatedrect') window.DrawingShapes.drawRotatedRect(ctx, d, pane);
    if (d.tool === 'circle') window.DrawingShapes.drawCircle(ctx, d, pane);
    if (d.tool === 'ellipse') window.DrawingShapes.drawEllipse(ctx, d, pane);
    if (d.tool === 'triangle') window.DrawingShapes.drawTriangle(ctx, d, pane);
    if (d.tool === 'arc') window.DrawingShapes.drawArc(ctx, d, pane);
    if (d.tool === 'pathtool') window.DrawingShapes.drawPathTool(ctx, d, pane);
    if (d.tool === 'arrowmarker') window.DrawingShapes.drawArrowMarker(ctx, d, pane);
    if (d.tool === 'arrowdraw') window.DrawingShapes.drawArrow(ctx, d, pane);
    if (d.tool === 'arrowup') window.DrawingShapes.drawArrowUp(ctx, d, pane);
    if (d.tool === 'arrowdown') window.DrawingShapes.drawArrowDown(ctx, d, pane);
    // ── Forecast & Measurement (Including Volume-based) ──
    if (d.tool === 'measure') window.DrawingForecast.drawMeasureTool(ctx, d, pane);
    if (d.tool === 'longpos') window.DrawingForecast.drawPosition(ctx, d, pane, 'long', d.id === _selectedId);
    if (d.tool === 'shortpos') window.DrawingForecast.drawPosition(ctx, d, pane, 'short', d.id === _selectedId);
    if (d.tool === 'pricerange') window.DrawingForecast.drawPriceRange(ctx, d, pane);
    if (d.tool === 'daterange') window.DrawingForecast.drawDateRange(ctx, d, pane);
    if (d.tool === 'datepricerange') window.DrawingForecast.drawDatePriceRange(ctx, d, pane);
    if (d.tool === 'fixedvolprof') window.DrawingForecast.drawFixedVolProf(ctx, d, pane);
    if (d.tool === 'anchvolprof') window.DrawingForecast.drawAnchVolProf(ctx, d, pane);

    // ── Patterns & Elliott Waves ──
    if (d.tool === 'cyclic-lines') window.DrawingPatterns.drawCyclicLines(ctx, d, pane);
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
    } finally {
      _renderPaneKey = _prevRenderPaneKey;
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
    const { series, offsetY } = _paneSeriesInfo(pane, _renderPaneKey);
    const yLocal = series.priceToCoordinate(pt.price);
    if (x === null || yLocal === null) return null;
    return { x, y: yLocal + offsetY };
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
    // TV: mıknatıs RSI/başka bir subpane üzerindeyken devre dışı kalır —
    // ana panelin mumlarına yapışmaz, serbest çizim yapılabilir.
    if (_cursorOverSubpane) {
      return { time: rawTime, price: rawPrice };
    }
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
    const _prevRenderPaneKey = _renderPaneKey;
    _renderPaneKey = d.paneKey || null;
    try {
    return _hitTestInner(x, y, d, pane);
    } finally {
      _renderPaneKey = _prevRenderPaneKey;
    }
  }

  function _hitTestInner(x, y, d, pane) {
    if (!_isDrawingVisible(d, pane)) return false;

    // BUG: fiyat/zaman cetveli şeridine yapılan tıklamalar burada
    // engellenmiyordu. `onMouseDown`'daki `rawTime === null || rawPrice ===
    // null` kontrolü bunu engellediğini varsayıyordu, ama
    // `series.coordinateToPrice(y)` geçerli aralığın dışında bile ASLA
    // null dönmüyor — sınırın ötesi için ekstrapole edilmiş (ama anlamsız)
    // bir fiyat veriyor. Sonuç: zaman cetveli şeridine (canvas'ın altındaki
    // ~22px) yapılan bir tıklama `rawPrice` dolu olduğu için null kontrolünü
    // atlatıp doğrudan hit-test'e ulaşıyordu — orada (ekranda görünmeyen,
    // cetvelin altında kalan) bir Fibonacci seviyesi varsa "görünmez"
    // biçimde seçilebiliyordu. Trend line'larda bu daha az fark ediliyordu
    // çünkü genelde daha az çizgi bu dar şeride denk geliyordu, ama altta
    // yatan kontrol eksikliği tüm araçlar için aynıydı. Çözüm: hit-test'in
    // TEK giriş noktasında, çizim alanının (drawingCanvas) gerçek
    // sınırlarının dışındaki her tıklamayı en baştan reddet.
    const _W = pane.drawingCanvas.width / (window.devicePixelRatio || 1);
    const _H = pane.drawingCanvas.height / (window.devicePixelRatio || 1);
    const _scaleW = pane.priceSide === 'left' ? (pane.chart.priceScale('left').width() || 0) : 0;
    if (x < _scaleW || x > _scaleW + _W || y < 0 || y > _H) return false;

    const tolerance = 10;

    if (d.p1 && d.p2 && ['trendline', 'ray', 'extended', 'arrowdraw', 'trendangle', 'infoline', 'fib-ret', 'fib-timezone', 'fib-speedfan', 'cyclic-lines', 'fib-ext', 'fib-channel', 'triangle', 'arc'].includes(d.tool)) {
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

    // ── Flat Top/Bottom özel hit test ────────────────────────────
    if (d.tool === 'flattopbottom' && d.p1 && d.p2) {
      const a = _pt2xy(d.p1, pane);
      const b = _pt2xy(d.p2, pane);
      if (!a || !b) return false;

      const ftbTolerance = 5;  // ← 10'dan 5'e düşürüldü

      // p1 anchor (eğimli çizgi sol ucu)
      if (Math.hypot(x - a.x, y - a.y) <= ftbTolerance) return 'p1';
      // p2 anchor (eğimli çizgi sağ ucu)
      if (Math.hypot(x - b.x, y - b.y) <= ftbTolerance) return 'p2';

      // Yatay çizginin anchor noktaları — sadece p3 varsa
      if (d.p3) {
        const flatY = pane.series.priceToCoordinate(d.p3.price);
        if (flatY != null && isFinite(flatY)) {
          const leftX  = a.x;   // p1.x
          const rightX = b.x;   // p2.x

          // Sol anchor (p1'in üstünde, p3 fiyatında)
          if (Math.hypot(x - leftX,  y - flatY) <= ftbTolerance) return 'ftb_left';
          // Sağ anchor (p2'nin üstünde, p3 fiyatında)
          if (Math.hypot(x - rightX, y - flatY) <= ftbTolerance) return 'ftb_right';

          // Yatay çizgiye tıklama
          const minX = Math.min(leftX, rightX);
          const maxX = Math.max(leftX, rightX);
          if (Math.abs(y - flatY) <= ftbTolerance && x >= minX - ftbTolerance && x <= maxX + ftbTolerance) {
            return 'ftb_hline';
          }
        }
      }

      // Eğimli çizgiye tıklama
      if (_distToSegment(x, y, a.x, a.y, b.x, b.y) <= ftbTolerance) return 'line';

      return false;
    }

    // ── Regression Trend özel hit test ───────────────
    if (d.tool === 'regression' && d.p1 && d.p2) {
      // Tek doğruluk kaynağı — çizim fonksiyonuyla (drawing-trend.js
      // _drawRegressionTrend) AYNI hesaplama. Burada ayrı bir kopya
      // YAZILMIYOR; iki bağımsız kopyanın birbirinden sapması (Fibonacci
      // araçlarında defalarca yaşandı) artık yapısal olarak imkânsız.
      const reg = window.DrawingTrend.computeRegression(d, pane);
      if (!reg) return false;
      const { n, slope, intercept, stdDev, points } = reg;

      const s = d.style || {};

      // Anchor noktaları: center line'ın başı ve sonu
      const p1pt = points[0];
      const p2pt = points[points.length - 1];
      const p1cy = pane.series.priceToCoordinate(p1pt.regPrice);
      const p2cy = pane.series.priceToCoordinate(p2pt.regPrice);

      if (p1cy != null && Math.hypot(x - p1pt.cx, y - p1cy) <= tolerance * 1.5) return 'reg_p1';
      if (p2cy != null && Math.hypot(x - p2pt.cx, y - p2cy) <= tolerance * 1.5) return 'reg_p2';

      // Çizgi hit: center, upper, lower band'ların herhangi birine yakın mı
      // BUG: burada sadece `useUpperDev`/`useLowerDev` (sapma DEĞERİNİN
      // hesaba katılıp katılmadığı) kontrol ediliyordu — çizim tarafı
      // (drawing-trend.js _drawRegressionTrend) ise `useUpper && showUp`
      // (yani ayrıca "Up"/"Down"/"Base" GÖRÜNÜRLÜK checkbox'ını da)
      // kontrol ediyor. Sonuç: kullanıcı "Up" (showUp) kutusunu kapatıp
      // çizgiyi görünmez yapsa bile, o görünmeyen çizgi hâlâ tıklanabilir
      // kalıyordu. Çizim fonksiyonuyla birebir aynı koşullar kullanıldı.
      const upperDev = s.upperDev ?? 2;
      const lowerDev = s.lowerDev ?? 2;
      const useUpper = s.useUpperDev !== false && s.showUp !== false;
      const useLower = s.useLowerDev !== false && s.showDown !== false;
      const useBase  = s.showBase !== false;

      for (let i = 0; i < points.length - 1; i++) {
        const pa = points[i], pb = points[i + 1];

        // Center line
        if (useBase) {
          const cya = pane.series.priceToCoordinate(pa.regPrice);
          const cyb = pane.series.priceToCoordinate(pb.regPrice);
          if (cya != null && cyb != null && _distToSegment(x, y, pa.cx, cya, pb.cx, cyb) <= tolerance) return 'reg_body';
        }

        // Upper band
        if (useUpper) {
          const uya = pane.series.priceToCoordinate(pa.regPrice + upperDev * stdDev);
          const uyb = pane.series.priceToCoordinate(pb.regPrice + upperDev * stdDev);
          if (uya != null && uyb != null && _distToSegment(x, y, pa.cx, uya, pb.cx, uyb) <= tolerance) return 'reg_body';
        }

        // Lower band
        if (useLower) {
          const lya = pane.series.priceToCoordinate(pa.regPrice - lowerDev * stdDev);
          const lyb = pane.series.priceToCoordinate(pb.regPrice - lowerDev * stdDev);
          if (lya != null && lyb != null && _distToSegment(x, y, pa.cx, lya, pb.cx, lyb) <= tolerance) return 'reg_body';
        }
      }

      // Extend Right: son noktadan canvas sağına kadar da hit
      if (s.extendRight && points.length >= 2) {
        const last  = points[points.length - 1];
        const prev  = points[points.length - 2];
        const W     = pane.drawingCanvas.width / (window.devicePixelRatio || 1);
        const pxPerBar = last.cx - prev.cx;
        if (pxPerBar > 0) {
          const extEndX  = W;
          const extBars  = (extEndX - last.cx) / pxPerBar;
          const extPrice = slope * ((n - 1) + extBars) + intercept;

          if (useBase) {
            const cya = pane.series.priceToCoordinate(last.regPrice);
            const cyb = pane.series.priceToCoordinate(extPrice);
            if (cya != null && cyb != null && _distToSegment(x, y, last.cx, cya, extEndX, cyb) <= tolerance) return 'reg_body';
          }

          if (useUpper) {
            const uya = pane.series.priceToCoordinate(last.regPrice + upperDev * stdDev);
            const uyb = pane.series.priceToCoordinate(extPrice + upperDev * stdDev);
            if (uya != null && uyb != null && _distToSegment(x, y, last.cx, uya, extEndX, uyb) <= tolerance) return 'reg_body';
          }
          if (useLower) {
            const lya = pane.series.priceToCoordinate(last.regPrice - lowerDev * stdDev);
            const lyb = pane.series.priceToCoordinate(extPrice - lowerDev * stdDev);
            if (lya != null && lyb != null && _distToSegment(x, y, last.cx, lya, extEndX, lyb) <= tolerance) return 'reg_body';
          }
        }
      }

      return false;
    }

    if (d.points && d.points.length > 0) {
      for (let i = 0; i < d.points.length; i++) {
        const ptXY = _pt2xy(d.points[i], pane);
        if (ptXY && Math.hypot(x - ptXY.x, y - ptXY.y) <= tolerance) return 'p' + (i + 1);
      }
    }

    if (['rect', 'pricerange', 'daterange', 'datepricerange'].includes(d.tool) && d.p1 && d.p2) {
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
    if (['longpos', 'shortpos'].includes(d.tool) && d.p1 && d.p2 && d.p3) {
      const a = _pt2xy(d.p1, pane);
      const b = _pt2xy(d.p2, pane);
      const tY = (_pt2xy(d.p2, pane) || {}).y;
      const sY = (_pt2xy(d.p3, pane) || {}).y;
      const eY = (_pt2xy(d.p1, pane) || {}).y;
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
    if (d.tool === 'hline' || d.tool === 'crossline' || d.tool === 'hray') {
      if (d.price != null && isFinite(d.price)) {
        const ly = pane.series.priceToCoordinate(d.price);
        if (ly != null && isFinite(ly) && Math.abs(y - ly) <= tolerance) {
          if (d.tool === 'hray') {
            if (d.time != null) {
              const lx = _timeToX(pane, d.time);
              if (lx != null && isFinite(lx) && x >= lx - tolerance) {
                if (Math.abs(x - lx) <= tolerance * 1.5) return 'hray_p1';
                return 'line';
              }
            }
          } else if (d.tool === 'hline') {
            const cvsW = pane.drawingCanvas.width / (window.devicePixelRatio || 1);
            if (x < 0 || x > cvsW) return null; // fiyat cetveli alanında hit verme
            if (Math.abs(x - cvsW * 0.90) <= tolerance * 2) return 'midpoint';
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
        if (lx != null && isFinite(lx) && Math.abs(x - lx) <= tolerance) {
          if (d.tool === 'vline') {
            return 'vline_midpoint';
          }
          return 'line';
        }
      }
    }

    if (['arrowmarker', 'arrowup', 'arrowdown'].includes(d.tool) && d.p1) {
      const a = _pt2xy(d.p1, pane);
      if (a && Math.hypot(x - a.x, y - a.y) <= 20) return 'p1'; // slightly larger hit area for markers
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

    if (d.tool === 'arc' && d.p1 && d.p2 && d.p3) {
      const a = _pt2xy(d.p1, pane);
      const b = _pt2xy(d.p2, pane);
      const c = _pt2xy(d.p3, pane);
      if (a && b && c) {
        if (_distToSegment(x, y, a.x, a.y, b.x, b.y) <= tolerance) return 'line';
        if (_distToSegment(x, y, b.x, b.y, c.x, c.y) <= tolerance) return 'line';
      }
    }

    if (d.tool === 'pathtool' && d.points && d.points.length >= 2) {
      const pts = d.points.map(pt => _pt2xy(pt, pane)).filter(Boolean);
      for (let i = 0; i < pts.length - 1; i++) {
        if (_distToSegment(x, y, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y) <= tolerance) return 'line';
      }
    }

    if (['trendline', 'ray', 'extended', 'channel', 'arrowdraw', 'trendangle', 'infoline', 'fib-ret', 'fib-ext', 'fib-channel', 'fib-timezone', 'fib-speedfan'].includes(d.tool)) {
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
      if (d.tool !== 'rect' && d.tool !== 'channel' && _distToSegment(x, y, p1.x, p1.y, p2.x, p2.y) <= hitTolerance) return 'line';
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
        const s = d.style || {};
        const extLeft = !!s.extendLeft;
        const extRight = !!s.extendRight;
        const wCanvas = pane.drawingCanvas.width / (window.devicePixelRatio || 1);
        const hCanvas = pane.drawingCanvas.height / (window.devicePixelRatio || 1);

        if (a && b) {
          if (Math.hypot(x - a.x, y - a.y) <= 8) return 'ch_p1';
          if (Math.hypot(x - b.x, y - b.y) <= 8) return 'ch_p2';
          const midTopX = (a.x + b.x) / 2, midTopY = (a.y + b.y) / 2;
          if (Math.hypot(x - midTopX, y - midTopY) <= 8) return 'ch_mid_top';
        }

        if (a && b && d.p3) {
          const c = _pt2xy(d.p3, pane);
          if (c) {
            let m = 0;
            if (b.x !== a.x) m = (b.y - a.y) / (b.x - a.x);
            const dy = c.y - a.y - m * (c.x - a.x);
            
            const botAx = a.x, botAy = a.y + dy;
            const botBx = b.x, botBy = b.y + dy;
            
            if (Math.hypot(x - botAx, y - botAy) <= 8) return 'ch_bot_p1';
            if (Math.hypot(x - botBx, y - botBy) <= 8) return 'ch_bot_p2';
            const midBotX = (botAx + botBx) / 2, midBotY = (botAy + botBy) / 2;
            if (Math.hypot(x - midBotX, y - midBotY) <= 8) return 'ch_mid_bot';

            // Check all active levels
            let levels = s.channelLevels;
            if (!levels || levels.length === 0) {
              levels = [{v: 0, active: true}, {v: 1, active: true}];
            }
            
            for (const lvl of levels) {
              if (!lvl.active) continue;
              let drawAx = a.x, drawAy = a.y + dy * lvl.v;
              let drawBx = b.x, drawBy = b.y + dy * lvl.v;
              
              if (extLeft) {
                const ext = _extendToEdge(drawBx, drawBy, drawAx, drawAy, wCanvas, hCanvas);
                drawAx = ext.x; drawAy = ext.y;
              }
              if (extRight) {
                const ext = _extendToEdge(drawAx, drawAy, drawBx, drawBy, wCanvas, hCanvas);
                drawBx = ext.x; drawBy = ext.y;
              }
              
              if (_distToSegment(x, y, drawAx, drawAy, drawBx, drawBy) <= tolerance) return 'line';
            }
          }
        } else if (a && b) {
          // If no p3 yet (still drawing)
          let drawAx = a.x, drawAy = a.y;
          let drawBx = b.x, drawBy = b.y;
          if (extLeft) {
            const ext = _extendToEdge(drawBx, drawBy, drawAx, drawAy, wCanvas, hCanvas);
            drawAx = ext.x; drawAy = ext.y;
          }
          if (extRight) {
            const ext = _extendToEdge(drawAx, drawAy, drawBx, drawBy, wCanvas, hCanvas);
            drawBx = ext.x; drawBy = ext.y;
          }
          if (_distToSegment(x, y, drawAx, drawAy, drawBx, drawBy) <= tolerance) return 'line';
        }
      }

      // Precise geometric line-hit testing for complex tools
      if (d.tool.startsWith('fib') || d.tool.includes('pitch')) {
        const s = d.style || {};
        const activeLevels = _getFibLevels(s).filter(l => l.active !== false);
        // "Reverse" varsayılan kapalı — çizim tarafıyla (drawing-fibo.js)
        // BİREBİR aynı varsayılan olmalı. Bu ikisi daha önce iki kez
        // birbirinden bağımsız kopya formüllerle hesaplandığı için
        // birbirinden sapmıştı (aynı hata sınıfı tekrar tekrar çıktı) —
        // artık ikisi de tek kaynağı (DrawingFibo.fibAxis) çağırıyor.
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
            // Tek doğruluk kaynağı (bkz. drawing-fibo.js _reverseSpan) — bu
            // dosyada ayrı bir "reverse ? -x : x" kopyası artık yazılmıyor.
            const effPx3 = window.DrawingFibo.reverseSpan(px3, reverse);
            const effPy3 = window.DrawingFibo.reverseSpan(py3, reverse);
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

        if (d.tool === 'fib-ext' && d.p3) {
          const c = _pt2xy(d.p3, pane);
          if (c) {
            const yDiff = b.y - a.y;
            // [2026-08-26, Görev-6.2 bulgusu] Burada çapa (c.y) reverse=true
            // iken hiç kaydırılmıyordu, ama çizim (drawing-fibo.js _drawFibExt)
            // `effP3Y = reverse ? p3.y + yDiff : p3.y` ile kaydırıyordu —
            // "Reverse" işaretliyken seviye çizgileri GÖRÜNDÜĞÜ yerde değil,
            // eski (kaydırılmamış) konumda tıklanabiliyordu. Artık BİREBİR
            // aynı hesap (render'daki gibi, tek doğruluk kaynağı: render'ın
            // kendisi — kullanıcı ne görüyorsa hit-test onu arar).
            const effYDiff = window.DrawingFibo.reverseSpan(yDiff, reverse);
            const effP3Y = reverse ? c.y + yDiff : c.y;
            if (_distToSegment(x, y, a.x, a.y, b.x, b.y) <= tolerance) return 'line';
            if (_distToSegment(x, y, b.x, b.y, c.x, c.y) <= tolerance) return 'line';

            const extendLeft = !!s.extendLeft;
            const extendRight = !!s.extendRight;
            const leftX = extendLeft ? -100 : Math.min(a.x, b.x, c.x);
            const rightX = extendRight ? W + 100 : Math.max(a.x, b.x, c.x) + 150;

            for (const lvl of activeLevels) {
              const ly = effP3Y + effYDiff * lvl.v;
              if (_distToSegment(x, y, leftX, ly, rightX, ly) <= tolerance) return 'line';
            }
          }
          return false;
        }

        if (d.tool === 'fib-ret') {
          // Tek doğruluk kaynağı — çizim fonksiyonuyla (drawing-fibo.js)
          // AYNI hesaplama. Burada ayrı bir kopya YAZILMIYOR; iki bağımsız
          // kopyanın birbirinden sapması (bu dosyada iki kez yaşandı) artık
          // yapısal olarak imkânsız.
          const yAxis = window.DrawingFibo.fibAxis(a.y, b.y, reverse);
          const effP1Y = yAxis.base;
          const effYDiff = yAxis.span;

          const extendLeft = !!s.extendLeft;
          const extendRight = !!s.extendRight;
          const leftX = extendLeft ? -100 : Math.min(a.x, b.x);
          const rightX = extendRight ? W + 100 : Math.max(a.x, b.x);

          for (const lvl of activeLevels) {
            const ly = effP1Y + effYDiff * lvl.v;
            if (_distToSegment(x, y, leftX, ly, rightX, ly) <= tolerance) return 'line';
          }
          return false;
        }

        if (d.tool === 'fib-timezone') {
          const dx = b.x - a.x;
          // [2026-08-26, Görev-6.2 bulgusu] Aynı sınıf hata (yukarıdaki
          // fib-ext'e bkz.): çapa reverse=true iken hep a.x kalıyordu, ama
          // çizim (`_drawFibTimezone`) `effP1X = reverse ? p2.x : p1.x` ile
          // b.x'e kaydırıyordu — "Reverse" işaretliyken çizgiler göründüğü
          // yerde tıklanamıyordu. Artık render'la birebir aynı.
          const effDX = window.DrawingFibo.reverseSpan(dx, reverse);
          const effP1X = reverse ? b.x : a.x;
          for (const lvl of activeLevels) {
            const lx = effP1X + effDX * lvl.v;
            if (Math.abs(x - lx) <= tolerance) return 'line';
          }
          return false;
        }

        if (d.tool === 'fib-speedfan') {
          // Çizimle (drawing-fibo.js _drawFibSpeedfan) BİREBİR aynı eksen
          // kuralı: ilk tıklanan nokta (a/p1 — fan'ın kaynağı) "1", ikinci
          // nokta (b/p2) "0". Fan'ın geometrik kaynağı her zaman a'da kalır.
          const yAxis = window.DrawingFibo.fibAxis(a.y, b.y, reverse);
          const xAxis = window.DrawingFibo.fibAxis(a.x, b.x, reverse);
          const priceYAt = (v) => yAxis.base + yAxis.span * v;
          const timeXAt  = (v) => xAxis.base + xAxis.span * v;

          let priceLevels = d.style.priceLevels;
          let timeLevels = d.style.timeLevels;
          if (!priceLevels) {
            priceLevels = activeLevels.slice(0, 7);
            timeLevels = activeLevels.slice(0, 7);
          }
          const actPrice = priceLevels.filter(l => l && l.active !== false);
          const actTime = timeLevels.filter(l => l && l.active !== false);

          for (const lvl of actPrice) {
            let pricePoint = { x: b.x, y: priceYAt(lvl.v) };
            let extPrice = _extendToEdge(a.x, a.y, pricePoint.x, pricePoint.y, W, H);
            if (_distToSegment(x, y, a.x, a.y, extPrice.x, extPrice.y) <= Math.max(tolerance, 5)) return 'line';
          }
          for (const lvl of actTime) {
            let timePoint = { x: timeXAt(lvl.v), y: b.y };
            let extTime = _extendToEdge(a.x, a.y, timePoint.x, timePoint.y, W, H);
            if (_distToSegment(x, y, a.x, a.y, extTime.x, extTime.y) <= Math.max(tolerance, 5)) return 'line';
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
    const { series, offsetY } = _paneSeriesInfo(pane, _renderPaneKey);
    const time = pane.chart.timeScale().coordinateToTime(xy.x);
    const price = series.coordinateToPrice(xy.y - offsetY);
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