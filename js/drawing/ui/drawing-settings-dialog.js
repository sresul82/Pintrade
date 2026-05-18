/**
 * DrawingSettingsDialog
 * Full-featured settings modal for drawing tools (TradingView-style)
 * Tabs: Style | Text | Coordinates | Visibility
 */
const DrawingSettingsDialog = (() => {

  let _currentDrawing = null;
  let _activeTab = 'style';
  let _dialogEl = null;
  let _onOk = null;
  let _onCancel = null;

  // ── Tool display names ────────────────────────────
  const TOOL_NAMES = {
    trendline:     'Trendline',
    hline:         'Horizontal Line',
    vline:         'Vertical Line',
    ray:           'Ray',
    hray:          'Horizontal Ray',
    crossline:     'Cross Line',
    extended:      'Extended Line',
    arrowdraw:     'Arrow',
    trendangle:    'Trend Angle',
    rect:          'Rectangle',
    channel:       'Parallel Channel',
    infoline:      'Info Line',
    flattopbottom: 'Flat Top/Bottom',
    regression:    'Regression Trend',
    vwap:          'Anchored VWAP',
    'fib-ret':     'Fib Retracement',
    'fib-ext':     'Fib Extension',
    'fib-channel': 'Fib Channel',
    'fib-timezone':'Fib Time Zone',
    'fib-circles': 'Fib Circles',
    'fib-speedfan':'Fib Speed Resistance Fan',
    'fib-timebased':'Trend-Based Fib Time',
    'fib-spiral':  'Fib Spiral',
    pitchfork:     'Pitchfork',
    schiffpitch:   'Schiff Pitchfork',
    modschiff:     'Modified Schiff',
    insidepitch:   'Inside Pitchfork',
    longpos:       'Long Position',
    shortpos:      'Short Position',
    posforecast:   'Forecast',
    rotatedrect:   'Rotated Rectangle',
    circle:        'Circle',
    ellipse:       'Ellipse',
    arrowmarker:   'Arrow Marker',
    arrowup:       'Arrow Up',
    arrowdown:     'Arrow Down',
    triangle:      'Triangle',
    arc:           'Arc',
    curve:         'Curve',
    doublecurve:   'Double Curve',
    polyline:      'Polyline',
    pathtool:      'Path',
    note:          'Note',
    callout:       'Callout',
    pricenote:     'Price Note',
    pricelabel:    'Price Label',
    tableanno:     'Table',
    flagmark:      'Flag',
    texttool:      'Text',
  };

  // ── Per-tool capabilities ─────────────────────────
  // priceLabel : show "Price Label" toggle
  // extend     : show "Extend Left/Right" dropdown
  // midpoint   : show "Middle Point" checkbox
  // stats      : show Stats multi-select + position
  // capArrows  : show left/right arrow-cap buttons
  // hasFill    : show background fill row
  // coordsMode : 'p2'=two points | 'p1only'=one point | 'priceOnly'=price only | 'timeOnly'=time only
  const TOOL_CAPS = {
    hline:        { priceLabel:true,  extend:false, midpoint:false, stats:false, capArrows:false, hasFill:false, hasText:true, coordsMode:'priceOnly' },
    hray:         { priceLabel:true,  extend:false, midpoint:false, stats:false, capArrows:false, hasFill:false, coordsMode:'p1only'   },
    vline:        { priceLabel:false, extend:false, midpoint:false, stats:false, capArrows:false, hasFill:false, coordsMode:'timeOnly'  },
    crossline:    { priceLabel:true,  extend:false, midpoint:false, stats:false, capArrows:false, hasFill:false, coordsMode:'p1only'   },
    trendline:    { priceLabel:true,  extend:true,  midpoint:true,  stats:true,  capArrows:true,  hasFill:false, hasText:true, coordsMode:'p2' },
    ray:          { priceLabel:true,  extend:true,  midpoint:true,  stats:true,  capArrows:true,  hasFill:false, hasText:true, coordsMode:'p2' },
    extended:     { priceLabel:true,  extend:true,  midpoint:true,  stats:true,  capArrows:true,  hasFill:false, hasText:true, coordsMode:'p2' },
    infoline:     { priceLabel:true,  extend:true,  midpoint:true,  stats:true,  capArrows:true,  hasFill:false, hasText:true, coordsMode:'p2' },
    trendangle:   { priceLabel:true,  extend:true,  midpoint:true,  stats:true,  capArrows:true,  hasFill:false, hasText:false, coordsMode:'p2' },
    arrowdraw:    { priceLabel:false, extend:false, midpoint:false, stats:false, capArrows:true,  hasFill:false, coordsMode:'p2'       },
    channel:      { priceLabel:false, extend:false, midpoint:false, stats:false, capArrows:false, hasFill:true, hasText:true, coordsMode:'p2' },
    regression:   { priceLabel:false, extend:false, midpoint:false, stats:false, capArrows:false, hasFill:false, coordsMode:'p2'       },
    flattopbottom:{ priceLabel:false, extend:false, midpoint:false, stats:false, capArrows:false, hasFill:false, coordsMode:'p2'       },
    rect:         { priceLabel:false, extend:true,  midpoint:true, stats:false, capArrows:false, hasFill:true, hasText:true, coordsMode:'p2'       },
    vwap:         { priceLabel:true,  extend:false, midpoint:false, stats:false, capArrows:false, hasFill:false, coordsMode:'p1only'   },
    // Fibo
    'fib-ret':    { isFibo:true, coordsMode:'p2' },
    'fib-ext':    { isFibo:true, coordsMode:'p3' },
    'fib-channel':{ isFibo:true, coordsMode:'p3' },
    'fib-timezone':{ isFibo:true, coordsMode:'p2' },
    'fib-circles':{ isFibo:true, coordsMode:'p2' },
    'fib-speedfan': { isFibo:true, coordsMode:'p2' },
    'fib-timebased': { isFibo:true, coordsMode:'p3' },
    'fib-spiral':  { isFibo:true, coordsMode:'p2' },
    // Pitchfork
    'pitchfork':  { priceLabel:false, extend:false, midpoint:false, stats:false, capArrows:false, hasFill:true, coordsMode:'p3' },
    'schiffpitch':{ priceLabel:false, extend:false, midpoint:false, stats:false, capArrows:false, hasFill:true, coordsMode:'p3' },
    'modschiff':  { priceLabel:false, extend:false, midpoint:false, stats:false, capArrows:false, hasFill:true, coordsMode:'p3' },
    'insidepitch':{ priceLabel:false, extend:false, midpoint:false, stats:false, capArrows:false, hasFill:true, coordsMode:'p3' },
    // Positions
    'longpos':    { isPos:true, coordsMode:'p3' },
    'shortpos':   { isPos:true, coordsMode:'p3' },
    'posforecast':{ isPos:true, coordsMode:'p3' },
    'rotatedrect':{ priceLabel:false, extend:false, midpoint:false, stats:false, capArrows:false, hasFill:true, hasText:false, coordsMode:'p3' },
    'circle':     { priceLabel:false, extend:false, midpoint:false, stats:false, capArrows:false, hasFill:true, hasText:false, coordsMode:'p2' },
    'ellipse':    { priceLabel:false, extend:false, midpoint:false, stats:false, capArrows:false, hasFill:true, hasText:false, coordsMode:'p2' },
    'arrowmarker':{ priceLabel:false, extend:false, midpoint:false, stats:false, capArrows:false, hasFill:false, hasText:false, coordsMode:'p1only' },
    'arrowup':    { priceLabel:false, extend:false, midpoint:false, stats:false, capArrows:false, hasFill:false, hasText:false, coordsMode:'p1only' },
    'arrowdown':  { priceLabel:false, extend:false, midpoint:false, stats:false, capArrows:false, hasFill:false, hasText:false, coordsMode:'p1only' },
    'triangle':   { priceLabel:false, extend:false, midpoint:false, stats:false, capArrows:false, hasFill:true, hasText:false, coordsMode:'p3' },
    'arc':        { priceLabel:false, extend:false, midpoint:false, stats:false, capArrows:false, hasFill:true, hasText:false, coordsMode:'p3' },
    'curve':      { priceLabel:false, extend:false, midpoint:false, stats:false, capArrows:true, hasFill:false, hasText:false, coordsMode:'p3' },
    'doublecurve':{ priceLabel:false, extend:false, midpoint:false, stats:false, capArrows:true, hasFill:false, hasText:false, coordsMode:'p4' },
    'polyline':   { priceLabel:false, extend:false, midpoint:false, stats:false, capArrows:true, hasFill:false, hasText:false, coordsMode:'multi' },
    'pathtool':   { priceLabel:false, extend:false, midpoint:false, stats:false, capArrows:true, hasFill:false, hasText:false, coordsMode:'multi' },
    'texttool':   { isTextTool:true, hasText:true, coordsMode:'p1only' },
    'note':       { isAnnotation:true, hasText:true, coordsMode:'p2' },
    'callout':    { isAnnotation:true, hasText:true, coordsMode:'p2' },
    'pricenote':  { isAnnotation:true, hasText:true, coordsMode:'p2' },
    'pricelabel': { isAnnotation:true, hasText:true, coordsMode:'p1only' },
    'tableanno':  { isAnnotation:true, hasText:false, coordsMode:'p1only' },
    'flagmark':   { isAnnotation:true, hasText:true, coordsMode:'p1only' },
  };
  const _getCaps = (tool) => TOOL_CAPS[tool] || { priceLabel:true, extend:true, midpoint:true, stats:true, capArrows:true, hasFill:false, hasText:true, coordsMode:'p2' };

  // ── Template menu ─────────────────────────────────
  function showTemplateMenu(anchorEl, drawingItem = null) {
    const d = drawingItem || _currentDrawing;
    if (!d || !d.tool) return;
    
    document.getElementById('dsb-template-menu')?.remove();
    const menu = document.createElement('div');
    menu.id = 'dsb-template-menu';
    menu.className = 'dsd-template-menu';
    
    // Default styling for menu to match others
    menu.style.cssText = 'position:fixed; z-index:999999; background:#1e222d; border:1px solid #363c4e; border-radius:6px; box-shadow:0 6px 24px rgba(0,0,0,0.6); min-width:200px; padding:4px 0; color:#d1d4dc; font-size:13px;';

    const toolKey = `dsb-templates-${d.tool}`;
    const templates = JSON.parse(localStorage.getItem(toolKey) || '{}');
    const templateNames = Object.keys(templates);

    let html = `
      <div class="dsd-tmpl-item" data-tmpl-action="save" style="padding:8px 16px; cursor:pointer; transition:background 0.2s;">
        Save Drawing Template As...
      </div>
      <div class="dsd-tmpl-item" data-tmpl-action="apply-default" style="padding:8px 16px; cursor:pointer; transition:background 0.2s;">
        Apply Default Drawing Template
      </div>
    `;

    if (templateNames.length > 0) {
      html += `<div style="height:1px; background:#363c4e; margin:4px 0;"></div>`;
      templateNames.forEach(name => {
        html += `
          <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 16px; cursor:pointer; transition:background 0.2s;" class="dsd-tmpl-item" data-tmpl-action="apply-custom" data-tmpl-name="${name}">
            <span>${name}</span>
            <div data-tmpl-action="delete-custom" data-tmpl-name="${name}" style="padding:2px; color:#f44336; cursor:pointer; display:flex; align-items:center; justify-content:center; border-radius:3px;" title="Delete">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M18 6L6 18M6 6l12 12" stroke-width="2" stroke-linecap="round"/></svg>
            </div>
          </div>
        `;
      });
    }

    menu.innerHTML = html;
    
    // Add hover effects dynamically
    menu.querySelectorAll('.dsd-tmpl-item').forEach(item => {
      item.addEventListener('mouseenter', () => item.style.background = '#2a2e39');
      item.addEventListener('mouseleave', () => item.style.background = 'transparent');
    });

    menu.addEventListener('click', (ev) => {
      const btn = ev.target.closest('[data-tmpl-action]');
      if (!btn) return;
      
      const action = btn.dataset.tmplAction;
      const tmplName = btn.dataset.tmplName;

      if (action === 'save') {
        const name = prompt('Template name:', 'My Template');
        if (name) {
          const tmpls = JSON.parse(localStorage.getItem(toolKey) || '{}');
          if (tmpls[name]) {
            if (!confirm(`Şablon "${name}" zaten var. Üzerine kaydetmek istiyor musunuz?`)) {
              return;
            }
          }
          tmpls[name] = JSON.parse(JSON.stringify(d.style || {}));
          localStorage.setItem(toolKey, JSON.stringify(tmpls));
          DSDUtils.showToast(`Template "${name}" saved.`);
        }
        menu.remove();
      }
      else if (action === 'apply-default') {
        d.style = {}; // Clear style to revert to factory defaults
        EventBus.emit('drawing:settings:saved');
        if (_dialogEl) {
          _dialogEl.querySelector('#dsd-body').innerHTML = _renderTab(_activeTab, d);
          _bindBodyEvents(_dialogEl, d);
        }
        DSDUtils.showToast('Applied default template.');
        menu.remove();
      }
      else if (action === 'apply-custom') {
        const tmpls = JSON.parse(localStorage.getItem(toolKey) || '{}');
        if (tmpls[tmplName]) {
          Object.assign(d.style, tmpls[tmplName]);
          EventBus.emit('drawing:settings:saved');
          if (_dialogEl) {
             _dialogEl.querySelector('#dsd-body').innerHTML = _renderTab(_activeTab, d);
             _bindBodyEvents(_dialogEl, d);
          }
          DSDUtils.showToast(`Applied template "${tmplName}".`);
        }
        menu.remove();
      }
      else if (action === 'delete-custom') {
        ev.stopPropagation(); // Don't trigger the row click
        const tmpls = JSON.parse(localStorage.getItem(toolKey) || '{}');
        if (confirm(`Delete template "${tmplName}"?`)) {
           delete tmpls[tmplName];
           localStorage.setItem(toolKey, JSON.stringify(tmpls));
           menu.remove();
           showTemplateMenu(anchorEl, drawingItem); // Refresh menu
           DSDUtils.showToast(`Deleted template "${tmplName}".`);
        }
      }
    });

    document.body.appendChild(menu);

    // Smart Positioning (flip up if overflows bottom)
    const rect = anchorEl.getBoundingClientRect();
    requestAnimationFrame(() => {
      const mh = menu.offsetHeight;
      const mw = menu.offsetWidth;
      let top = rect.bottom + 4;
      let left = rect.left;
      
      if (top + mh > window.innerHeight) {
        top = Math.max(4, rect.top - mh - 4); // Flip up
      }
      if (left + mw > window.innerWidth) {
        left = window.innerWidth - mw - 4; // Shift left
      }
      menu.style.top = top + 'px';
      menu.style.left = left + 'px';
    });

    setTimeout(() => {
      document.addEventListener('mousedown', function outsideH(e) {
        if (!menu.contains(e.target)) {
          menu.remove();
          document.removeEventListener('mousedown', outsideH);
        }
      });
    }, 0);
  }

  // ── Main dialog ───────────────────────────────────
  function open(drawing, opts = {}) {
    _currentDrawing = drawing;
    const caps = _getCaps(drawing.tool);
    // Callout and Text tools always open on Text tab
    const effectiveTab = (drawing.tool === 'callout' || drawing.tool === 'texttool') ? 'text' : opts.tab;
    _activeTab = effectiveTab || (caps.isPos ? 'inputs' : (caps.isTextTool ? 'text' : 'style'));
    _onOk = opts.onOk;
    _onCancel = opts.onCancel;
    // Save snapshot for cancel
    const snapshot = JSON.parse(JSON.stringify(drawing));

    document.getElementById('dsd-overlay')?.remove();

    const overlay = document.createElement('div');
    overlay.id = 'dsd-overlay';
    overlay.className = 'dsd-overlay';

    const toolName = TOOL_NAMES[drawing.tool] || 'Drawing';

    const dialogWidth = drawing.tool === 'texttool' ? '260px' : '320px';

    overlay.innerHTML = `
      <div class="dsd-dialog" id="dsd-dialog" style="width:${dialogWidth}">
        <div class="dsd-header">
          <span class="dsd-title">${toolName}</span>
          <button class="dsd-header-icon" id="dsd-rename-btn" title="Rename">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="14" height="14">
              <path fill="currentColor" d="M10.62.72a2.47 2.47 0 0 1 3.5 0l1.16 1.16c.96.97.96 2.54 0 3.5l-.58.58-8.9 8.9-1 1-.14.14H0v-4.65l.14-.15 1-1 8.9-8.9.58-.58Z"/>
            </svg>
          </button>
          <button class="dsd-close-btn" id="dsd-close-btn" title="Close">✕</button>
        </div>

        <div class="dsd-tabs">
          ${_getCaps(drawing.tool).isPos ? `<button class="dsd-tab ${_activeTab==='inputs'?'active':''}" data-tab="inputs">Inputs</button>` : ''}
          ${!_getCaps(drawing.tool).isTextTool && drawing.tool !== 'callout' ? `<button class="dsd-tab ${_activeTab==='style'?'active':''}" data-tab="style">Style</button>` : ''}
          ${((!_getCaps(drawing.tool).isFibo && !_getCaps(drawing.tool).isPos && _getCaps(drawing.tool).hasText !== false) || drawing.tool === 'callout') && drawing.tool !== 'pricelabel' ? `<button class="dsd-tab ${_activeTab==='text'?'active':''}" data-tab="text">Text</button>` : ''}
          ${(!_getCaps(drawing.tool).isAnnotation && !_getCaps(drawing.tool).isTextTool) || ['callout', 'pricelabel'].includes(drawing.tool) ? `<button class="dsd-tab ${_activeTab==='coords'?'active':''}" data-tab="coords">Coordinates</button>` : ''}
          <button class="dsd-tab ${_activeTab==='visibility'?'active':''}" data-tab="visibility">Visibility</button>
        </div>

        <div class="dsd-body" id="dsd-body">
          ${_renderTab(_activeTab, drawing)}
        </div>

        <div class="dsd-footer">
          <div class="dsd-footer-left">
            <button class="dsd-tmpl-btn" id="dsd-tmpl-btn">Template <span class="dsd-tmpl-arrow">▾</span></button>
          </div>
          <div class="dsd-footer-right">
            <button class="dsd-btn-cancel" id="dsd-btn-cancel">Cancel</button>
            <button class="dsd-btn-ok"     id="dsd-btn-ok">Ok</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    _dialogEl = overlay;

    // Make dialog draggable by header
    const dialog = overlay.querySelector('#dsd-dialog');
    const header = overlay.querySelector('.dsd-header');
    
    // Load saved position
    try {
      const savedStr = localStorage.getItem('dsd_dialog_pos');
      if (savedStr) {
        const savedPos = JSON.parse(savedStr);
        dialog.style.position = 'fixed';
        dialog.style.margin = '0';
        dialog.style.left = savedPos.left + 'px';
        dialog.style.top = savedPos.top + 'px';
        
        requestAnimationFrame(() => {
          let px = dialog.offsetLeft;
          let py = dialog.offsetTop;
          const pw = dialog.offsetWidth;
          const ph = dialog.offsetHeight;
          if (px + pw > window.innerWidth) px = window.innerWidth - pw - 4;
          if (py + ph > window.innerHeight) py = window.innerHeight - ph - 4;
          px = Math.max(4, px);
          py = Math.max(4, py);
          dialog.style.left = px + 'px';
          dialog.style.top = py + 'px';
        });
      }
    } catch(e) {}

    DSDUtils.makeDraggable(dialog, header);

    // Tab switching
    overlay.querySelectorAll('.dsd-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        _activeTab = tab.dataset.tab;
        overlay.querySelectorAll('.dsd-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === _activeTab));
        overlay.querySelector('#dsd-body').innerHTML = _renderTab(_activeTab, drawing);
        _bindBodyEvents(overlay, drawing);
      });
    });

    // Bind body events for initial tab
    _bindBodyEvents(overlay, drawing);

    // Footer
    overlay.querySelector('#dsd-tmpl-btn').addEventListener('click', (e) => {
      showTemplateMenu(e.currentTarget, drawing);
    });
    overlay.querySelector('#dsd-btn-cancel').addEventListener('click', () => {
      try {
        Object.assign(drawing, JSON.parse(JSON.stringify(snapshot)));
        EventBus.emit('drawing:settings:saved');
        overlay.remove();
        if (_onCancel) _onCancel();
      } catch (e) {
        alert('Cancel Error: ' + e.message);
      }
    });
    overlay.querySelector('#dsd-btn-ok').addEventListener('click', () => {
      DSDApply.applyFromForm(overlay, drawing);
      EventBus.emit('drawing:settings:saved');
      overlay.remove();
      if (_onOk) _onOk(drawing);
    });
    overlay.querySelector('#dsd-close-btn').addEventListener('click', () => {
      try {
        Object.assign(drawing, JSON.parse(JSON.stringify(snapshot)));
        EventBus.emit('drawing:settings:saved');
        overlay.remove();
      } catch (e) {
        alert('Close Error: ' + e.message);
      }
    });

    // Click on overlay backdrop (chart area) → apply & close (TradingView behaviour)
    overlay.addEventListener('mousedown', (e) => {
      if (e.target === overlay) {
        DSDApply.applyFromForm(overlay, drawing);
        EventBus.emit('drawing:settings:saved');
        overlay.remove();
        if (_onOk) _onOk(drawing);
      }
    });
  }

  // ── Tab renderers ─────────────────────────────────
  function _renderTab(tab, d) {
    if (tab === 'inputs') {
      if (_getCaps(d.tool).isPos) return DSDPositionTabs.renderPositionInputsTab(d);
    }
    if (tab === 'style') {
      if (_getCaps(d.tool).isFibo) return DSDFiboTabs.renderFibStyleTab(d);
      if (_getCaps(d.tool).isPos)  return DSDPositionTabs.renderPositionStyleTab(d);
      if (_getCaps(d.tool).isAnnotation) return DSDAnnotationTabs.renderAnnotationStyleTab(d);
      return DSDStandardTabs.renderStyleTab(d);
    }
    if (tab === 'text') {
      return _getCaps(d.tool).isAnnotation ? DSDAnnotationTabs.renderAnnotationTextTab(d) : DSDStandardTabs.renderTextTab(d);
    }
    if (tab === 'coords')     return DSDStandardTabs.renderCoordsTab(d);
    if (tab === 'visibility') return DSDStandardTabs.renderVisibilityTab(d);
    return '';
  }  // end _renderTab

  // ── Event binding per tab ─────────────────────────
  function _bindBodyEvents(overlay, drawing) {
    // Textarea auto-grow (for Callout and any tool with a #dsd-text textarea)
    const taEl = overlay.querySelector('#dsd-text');
    if (taEl) {
      const autoGrow = () => {
        taEl.style.height = 'auto';
        taEl.style.height = taEl.scrollHeight + 'px';
      };
      taEl.addEventListener('input', autoGrow);
      // Run once on init to size correctly for existing content
      requestAnimationFrame(autoGrow);
    }

    // Text alignment handlers
    const alignV = overlay.querySelector('#dsd-textAlignV');
    if (alignV) {
      alignV.addEventListener('change', () => {
        drawing.style = drawing.style || {};
        drawing.style.textAlignV = alignV.value;
        EventBus.emit('drawing:settings:saved');
      });
    }
    const alignH = overlay.querySelector('#dsd-textAlignH');
    if (alignH) {
      alignH.addEventListener('change', () => {
        drawing.style = drawing.style || {};
        drawing.style.textAlignH = alignH.value;
        EventBus.emit('drawing:settings:saved');
      });
    }

    // Line color swatch (js-style-color)
    overlay.querySelectorAll('.dsd-color-swatch.js-style-color').forEach(swatch => {
      swatch.addEventListener('click', (e) => {
        e.stopPropagation();
        if (swatch.classList.contains('js-combined-line')) {
           DSDColorPicker.showCombinedLineSettings(swatch, swatch.dataset.color || '#58a6ff', drawing.style?.width || 1, drawing.style?.lineStyle || 'solid', true, (res) => {
              swatch.style.background = res.color;
              swatch.dataset.color = res.color;
              drawing.style = drawing.style || {};
              drawing.style.color = res.color;
              drawing.style.width = res.width;
              drawing.style.lineStyle = res.style;
              EventBus.emit('drawing:settings:saved');
           });
        } else {
           DSDColorPicker.showColorPalette(swatch, swatch.dataset.color || '#58a6ff', (newColor) => {
             swatch.style.background = newColor;
             swatch.dataset.color = newColor;
             drawing.style = drawing.style || {};
             drawing.style.color = newColor;
             const prevPath = overlay.querySelector('#dsd-line-preview path, #dsd-line-preview line');
             if (prevPath) prevPath.setAttribute('stroke', newColor);
             EventBus.emit('drawing:settings:saved');
           });
        }
      });
    });

    // Text color swatch
    overlay.querySelectorAll('.dsd-color-swatch.js-text-color').forEach(swatch => {
      swatch.addEventListener('click', (e) => {
        e.stopPropagation();
        DSDColorPicker.showColorPalette(swatch, swatch.dataset.color || '#ffffff', (newColor) => {
          swatch.style.background = newColor;
          swatch.dataset.color = newColor;
          drawing.style = drawing.style || {};
          if (drawing.tool === 'pricenote') {
            drawing.style.userTextColor = newColor;
          } else {
            drawing.style.textColor = newColor;
          }
          EventBus.emit('drawing:settings:saved');
        });
      });
    });

    // Fill / background color swatch (channel, rect, texttool)
    overlay.querySelectorAll('.dsd-color-swatch.js-fill-color').forEach(swatch => {
      swatch.addEventListener('click', (e) => {
        e.stopPropagation();
        DSDColorPicker.showColorPalette(swatch, swatch.dataset.color || 'rgba(41,98,255,0.1)', (newColor) => {
          swatch.style.background = newColor;
          swatch.dataset.color = newColor;
          drawing.style = drawing.style || {};
          drawing.style.fillColor = newColor;
          EventBus.emit('drawing:settings:saved');
        });
      });
    });

    // Border color swatch (texttool)
    overlay.querySelectorAll('.dsd-color-swatch.js-border-color').forEach(swatch => {
      swatch.addEventListener('click', (e) => {
        e.stopPropagation();
        DSDColorPicker.showColorPalette(swatch, swatch.dataset.color || '#363c4e', (newColor) => {
          swatch.style.background = newColor;
          swatch.dataset.color = newColor;
          drawing.style = drawing.style || {};
          drawing.style.borderColor = newColor;
          EventBus.emit('drawing:settings:saved');
        });
      });
    });

    // Annotation label background swatch (.js-anno-bg)
    overlay.querySelectorAll('.dsd-color-swatch.js-anno-bg').forEach(swatch => {
      swatch.addEventListener('click', (e) => {
        e.stopPropagation();
        DSDColorPicker.showColorPalette(swatch, swatch.dataset.color || '#2a2e39', (newColor) => {
          swatch.style.background = newColor;
          swatch.dataset.color = newColor;
          drawing.style = drawing.style || {};
          drawing.style.fillColor = newColor;
          EventBus.emit('drawing:settings:saved');
        });
      });
    });

    // Annotation border color swatch (.js-anno-border)
    overlay.querySelectorAll('.dsd-color-swatch.js-anno-border').forEach(swatch => {
      swatch.addEventListener('click', (e) => {
        e.stopPropagation();
        DSDColorPicker.showColorPalette(swatch, swatch.dataset.color || '#363c4e', (newColor) => {
          swatch.style.background = newColor;
          swatch.dataset.color = newColor;
          drawing.style = drawing.style || {};
          drawing.style.borderColor = newColor;
          const prevPath = overlay.querySelector('#dsd-anno-border-preview path');
          if (prevPath) prevPath.setAttribute('stroke', newColor);
          EventBus.emit('drawing:settings:saved');
        });
      });
    });

    // Annotation line color swatch (.js-anno-line)
    overlay.querySelectorAll('.dsd-color-swatch.js-anno-line').forEach(swatch => {
      swatch.addEventListener('click', (e) => {
        e.stopPropagation();
        DSDColorPicker.showColorPalette(swatch, swatch.dataset.color || '#d1d4dc', (newColor) => {
          swatch.style.background = newColor;
          swatch.dataset.color = newColor;
          drawing.style = drawing.style || {};
          drawing.style.color = newColor;
          const prevPath = overlay.querySelector('#dsd-anno-line-preview path');
          if (prevPath) prevPath.setAttribute('stroke', newColor);
          EventBus.emit('drawing:settings:saved');
        });
      });
    });

    // Annotation text color swatch (.js-anno-text-color)
    overlay.querySelectorAll('.dsd-color-swatch.js-anno-text-color').forEach(swatch => {
      swatch.addEventListener('click', (e) => {
        e.stopPropagation();
        DSDColorPicker.showColorPalette(swatch, swatch.dataset.color || '#d1d4dc', (newColor) => {
          swatch.style.background = newColor;
          swatch.dataset.color = newColor;
          drawing.style = drawing.style || {};
          drawing.style.textColor = newColor;
          EventBus.emit('drawing:settings:saved');
        });
      });
    });

    const annoBold = overlay.querySelector('#dsd-anno-bold');
    if (annoBold) {
      annoBold.addEventListener('click', () => {
        annoBold.classList.toggle('active');
        drawing.style = drawing.style || {};
        drawing.style.bold = annoBold.classList.contains('active');
        EventBus.emit('drawing:settings:saved');
      });
    }
    const annoItalic = overlay.querySelector('#dsd-anno-italic');
    if (annoItalic) {
      annoItalic.addEventListener('click', () => {
        annoItalic.classList.toggle('active');
        drawing.style = drawing.style || {};
        drawing.style.italic = annoItalic.classList.contains('active');
        EventBus.emit('drawing:settings:saved');
      });
    }
    const annoFs = overlay.querySelector('#dsd-anno-fontsize');
    if (annoFs) {
      annoFs.addEventListener('change', () => {
        drawing.style = drawing.style || {};
        drawing.style.fontSize = parseInt(annoFs.value);
        EventBus.emit('drawing:settings:saved');
      });
    }

    const textWrapCb = overlay.querySelector('#dsd-text-wrap');
    if (textWrapCb) {
      textWrapCb.addEventListener('change', () => {
        drawing.style = drawing.style || {};
        drawing.style.textWrap = textWrapCb.checked;
        EventBus.emit('drawing:settings:saved');
      });
    }

    const annoLineCombo = overlay.querySelector('#dsd-anno-line-combo');
    if (annoLineCombo) {
      annoLineCombo.addEventListener('click', (e) => {
        if (e.target.closest('.js-anno-line')) return;
        DSDColorPicker.showLineSettingsPopover(annoLineCombo, drawing, overlay, 'width', 'lineStyle', 'dash', '#dsd-anno-line-preview');
      });
    }

    const annoBorderCombo = overlay.querySelector('#dsd-anno-border-combo');
    if (annoBorderCombo) {
      annoBorderCombo.addEventListener('click', (e) => {
        if (e.target.closest('.js-anno-border')) return;
        DSDColorPicker.showLineSettingsPopover(annoBorderCombo, drawing, overlay, 'borderWidth', 'borderStyle', 'borderDash', '#dsd-anno-border-preview');
      });
    }

    // Callout Text tab — Background color swatch
    overlay.querySelectorAll('.dsd-color-swatch.js-callout-bg').forEach(swatch => {
      swatch.addEventListener('click', (e) => {
        e.stopPropagation();
        DSDColorPicker.showColorPalette(swatch, swatch.dataset.color || 'rgba(41,98,255,0.2)', (newColor) => {
          swatch.style.background = newColor;
          swatch.dataset.color = newColor;
          drawing.style = drawing.style || {};
          drawing.style.fillColor = newColor;
          EventBus.emit('drawing:settings:saved');
        });
      });
    });

    // Callout Text tab — Border color swatch
    overlay.querySelectorAll('.dsd-color-swatch.js-callout-border').forEach(swatch => {
      swatch.addEventListener('click', (e) => {
        e.stopPropagation();
        DSDColorPicker.showColorPalette(swatch, swatch.dataset.color || '#2962ff', (newColor) => {
          swatch.style.background = newColor;
          swatch.dataset.color = newColor;
          drawing.style = drawing.style || {};
          drawing.style.borderColor = newColor;
          const svgPath = overlay.querySelector('#dsd-callout-border-svg-path');
          if (svgPath) svgPath.setAttribute('stroke', newColor);
          EventBus.emit('drawing:settings:saved');
        });
      });
    });

    // Callout Text tab — Border combo button (line style & width)
    const calloutBorderCombo = overlay.querySelector('#dsd-callout-border-combo');
    if (calloutBorderCombo) {
      calloutBorderCombo.addEventListener('click', (e) => {
        if (e.target.closest('.js-callout-border')) return;
        DSDColorPicker.showLineSettingsPopover(calloutBorderCombo, drawing, overlay, 'borderWidth', 'borderStyle', 'borderDash', '#dsd-callout-border-svg-path');
      });
    }

    // Annotation checkbox live update (bg-on, border-on)
    const annoBgOnCb = overlay.querySelector('#dsd-anno-bg-on');
    if (annoBgOnCb) {
      annoBgOnCb.addEventListener('change', () => {
        drawing.style = drawing.style || {};
        drawing.style.showFill = annoBgOnCb.checked;
        EventBus.emit('drawing:settings:saved');
      });
    }
    const annoBorderOnCb = overlay.querySelector('#dsd-anno-border-on');
    if (annoBorderOnCb) {
      annoBorderOnCb.addEventListener('change', () => {
        drawing.style = drawing.style || {};
        drawing.style.showBorder = annoBorderOnCb.checked;
        EventBus.emit('drawing:settings:saved');
      });
    }


    // Position tool color swatches (Lines, Stop, Target, Text)
    [
      { selector: '.js-pos-color',  styleKey: 'color',       fallback: '#2962ff' },
      { selector: '.js-pos-stop',   styleKey: 'stopColor',   fallback: 'rgba(242,54,69,0.2)' },
      { selector: '.js-pos-target', styleKey: 'targetColor', fallback: 'rgba(8,153,129,0.2)' },
      { selector: '.js-pos-text',   styleKey: 'textColor',   fallback: '#ffffff' },
    ].forEach(({ selector, styleKey, fallback }) => {
      const sw = overlay.querySelector(selector);
      if (!sw) return;
      sw.addEventListener('click', (e) => {
        e.stopPropagation();
        DSDColorPicker.showColorPalette(sw, sw.dataset.color || fallback, (newColor) => {
          sw.style.background = newColor;
          sw.dataset.color = newColor;
          drawing.style = drawing.style || {};
          drawing.style[styleKey] = newColor;
          EventBus.emit('drawing:settings:saved');
        });
      });
    });

    // Line combo — renk swatchı kendi handler'ını aldı yukarıda.
    // Combo'nun geri kalanına (preview alanına) tıklayınca kalınlık+stil dropdown açılsın
    const combo = overlay.querySelector('#dsd-line-combo');
    if (combo) {
      combo.addEventListener('click', (e) => {
        // Eğer renk swatchına tıklandıysa — zaten yukarıda handle edildi
        if (e.target.closest('.js-style-color')) return;
        DSDColorPicker.showLineSettingsPopover(combo, drawing, overlay);
      });
    }

    // Midline color swatch
    const midlineSwatch = overlay.querySelector('.js-midline-color');
    if (midlineSwatch) {
      midlineSwatch.addEventListener('click', (e) => {
        e.stopPropagation();
        if (midlineSwatch.classList.contains('js-combined-line')) {
           DSDColorPicker.showCombinedLineSettings(midlineSwatch, midlineSwatch.dataset.color || '#787b86', drawing.style?.midlineWidth || 1, drawing.style?.midlineStyle || 'dashed', true, (res) => {
              midlineSwatch.style.background = res.color;
              midlineSwatch.dataset.color = res.color;
              drawing.style = drawing.style || {};
              drawing.style.midlineColor = res.color;
              drawing.style.midlineWidth = res.width;
              drawing.style.midlineStyle = res.style;
              EventBus.emit('drawing:settings:saved');
           });
        } else {
           DSDColorPicker.showColorPalette(midlineSwatch, midlineSwatch.dataset.color || '#787b86', (newColor) => {
             midlineSwatch.style.background = newColor;
             midlineSwatch.dataset.color = newColor;
             drawing.style = drawing.style || {};
             drawing.style.midlineColor = newColor;
             const prevPath = overlay.querySelector('#dsd-midline-preview path');
             if (prevPath) prevPath.setAttribute('stroke', newColor);
             EventBus.emit('drawing:settings:saved');
           });
        }
      });
    }

    // Middle line checkbox (rect)
    const midlineCb = overlay.querySelector('#dsd-midline');
    if (midlineCb) {
      midlineCb.addEventListener('change', () => {
        drawing.style = drawing.style || {};
        drawing.style.showMidline = midlineCb.checked;
        EventBus.emit('drawing:settings:saved');
      });
    }

    // Show background checkbox (rect, texttool)
    const showBgCb = overlay.querySelector('#dsd-showbg');
    if (showBgCb) {
      showBgCb.addEventListener('change', () => {
        drawing.style = drawing.style || {};
        drawing.style.showBg = showBgCb.checked;
        EventBus.emit('drawing:settings:saved');
      });
    }

    // Show border checkbox (texttool)
    const showBorderCb = overlay.querySelector('#dsd-showborder');
    if (showBorderCb) {
      showBorderCb.addEventListener('change', () => {
        drawing.style = drawing.style || {};
        drawing.style.showBorder = showBorderCb.checked;
        EventBus.emit('drawing:settings:saved');
      });
    }

    // Caps dropdowns
    const capLabels = {
      normal: `<svg width="24" height="12" viewBox="0 0 24 12"><circle cx="3" cy="6" r="2.5" fill="none" stroke="currentColor" stroke-width="1.5"/><line x1="5.5" y1="6" x2="22" y2="6" stroke="currentColor" stroke-width="1.5"/></svg>`,
      arrow:  `<svg width="24" height="12" viewBox="0 0 24 12"><line x1="2" y1="6" x2="18" y2="6" stroke="currentColor" stroke-width="1.5"/><polyline points="12,2 18,6 12,10" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>`
    };
    const capOptions = [
      { key: 'normal', svgIcon: capLabels.normal, label: 'Normal' },
      { key: 'arrow',  svgIcon: capLabels.arrow,  label: 'Arrow'  }
    ];

    overlay.querySelectorAll('.dsd-cap-drop-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        document.getElementById('dsd-cap-menu')?.remove();

        const rect = btn.getBoundingClientRect();
        const side = btn.dataset.side;
        const menu = document.createElement('div');
        menu.id = 'dsd-cap-menu';
        menu.style.cssText = `position:fixed;z-index:99999;background:#1e222d;border:1px solid #363c4e;border-radius:6px;padding:4px 0;box-shadow:0 6px 20px rgba(0,0,0,0.55);min-width:130px;top:${rect.bottom+2}px;left:${rect.left}px;`;

        capOptions.forEach(opt => {
          const item = document.createElement('div');
          item.style.cssText = `display:flex;align-items:center;gap:10px;padding:7px 14px;cursor:pointer;font-size:13px;color:#d1d4dc;`;
          // Flip icon if it's the left cap
          const finalSvg = side === 'left' ? `<div style="transform:scaleX(-1);display:flex;">${opt.svgIcon}</div>` : opt.svgIcon;
          item.innerHTML = `${finalSvg}<span>${opt.label}</span>`;
          item.addEventListener('mouseenter', () => item.style.background = '#2a2e39');
          item.addEventListener('mouseleave', () => item.style.background = '');
          item.addEventListener('click', () => {
            drawing.style = drawing.style || {};
            if (side === 'left') {
              drawing.style.capLeft = opt.key;
            } else {
              drawing.style.capRight = opt.key;
            }
            const iconEl = btn.querySelector('.dsd-cap-icon');
            if (iconEl) iconEl.innerHTML = opt.svgIcon;
            menu.remove();
            EventBus.emit('drawing:settings:saved');
          });
          menu.appendChild(item);
        });

        document.body.appendChild(menu);
        setTimeout(() => {
          document.addEventListener('mousedown', function closeMenu(ev) {
            if (!menu.contains(ev.target)) {
              menu.remove();
              document.removeEventListener('mousedown', closeMenu);
            }
          });
        }, 0);
      });
    });

    // Extend checkboxes
    ['dsd-ext-left', 'dsd-ext-right'].forEach(id => {
      const cb = overlay.querySelector('#' + id);
      if (cb) {
        cb.addEventListener('change', () => {
          DSDApply.applyFromForm(overlay, drawing);
          EventBus.emit('drawing:settings:saved');
        });
      }
    });

    // Custom select: Stats dropdown (position tools)
    const statsHeader = overlay.querySelector('#dsd-stats-header');
    const statsBody   = overlay.querySelector('#dsd-stats-body');
    if (statsHeader && statsBody) {
      statsHeader.addEventListener('click', (e) => {
        e.stopPropagation();
        statsBody.classList.toggle('hidden');
      });
      // Close on outside click
      const statsCloseOutside = (ev) => {
        if (!statsHeader.closest('#dsd-stats-dd')?.contains(ev.target) && !statsHeader.closest('#dsd-stats-wrap')?.contains(ev.target)) {
          statsBody.classList.add('hidden');
          document.removeEventListener('mousedown', statsCloseOutside);
        }
      };
      document.addEventListener('mousedown', statsCloseOutside);

      // Trendline vb. standard Stats checkbox'ları (.js-stat-field)
      statsBody.querySelectorAll('.js-stat-field').forEach(cb => {
        cb.addEventListener('change', () => {
          drawing.style = drawing.style || {};
          drawing.style.statsFields = [...statsBody.querySelectorAll('.js-stat-field:checked')].map(c => c.dataset.field);
          const summaryEl = overlay.querySelector('#dsd-stats-label');
          if (summaryEl) {
             const labels = drawing.style.statsFields;
             summaryEl.textContent = labels.length === 0 ? 'Hidden'
               : labels.length === 1 ? labels[0]
               : labels[0] + ', ...';
          }
          EventBus.emit('drawing:settings:saved');
        });
      });

      // Position tools stats checkbox'ları (.dsd-stats-cb)
      statsBody.querySelectorAll('.dsd-stats-cb').forEach(cb => {
        cb.addEventListener('change', () => {
          drawing.style = drawing.style || {};
          drawing.style.stats = drawing.style.stats || {};
          drawing.style.stats[cb.dataset.key] = cb.checked;
          const summaryEl = overlay.querySelector('#dsd-stats-summary');
          if (summaryEl) {
            const labels = [...statsBody.querySelectorAll('.dsd-stats-cb:checked')]
              .map(c => c.nextElementSibling?.textContent || '');
            summaryEl.textContent = labels.length === 0 ? 'None'
              : labels.length <= 2 ? labels.join(', ')
              : labels.slice(0,2).join(', ') + ', …';
          }
          EventBus.emit('drawing:settings:saved');
        });
      });
    }

    // Stats on/off checkbox
    const statsOnCb = overlay.querySelector('#dsd-stats-on');
    if (statsOnCb) {
      statsOnCb.addEventListener('change', () => {
        drawing.style = drawing.style || {};
        drawing.style.statsOn = statsOnCb.checked;
        EventBus.emit('drawing:settings:saved');
      });
    }

    // Always show checkbox
    const alwaysStatsCb = overlay.querySelector('#dsd-alwaysstats');
    if (alwaysStatsCb) {
      alwaysStatsCb.addEventListener('change', () => {
        drawing.style = drawing.style || {};
        drawing.style.alwaysStats = alwaysStatsCb.checked;
        EventBus.emit('drawing:settings:saved');
      });
    }

    // Bold / Italic from Text tab
    const boldBtn   = overlay.querySelector('#dsd-bold');
    const italicBtn = overlay.querySelector('#dsd-italic');
    if (boldBtn) {
      boldBtn.addEventListener('click', () => {
        const isActive = !boldBtn.classList.contains('active');
        boldBtn.classList.toggle('active', isActive);
        if (drawing.tool === 'pricenote') drawing.style.userBold = isActive;
        else drawing.style.bold = isActive;
        EventBus.emit('drawing:settings:saved');
      });
    }
    if (italicBtn) {
      italicBtn.addEventListener('click', () => {
        const isActive = !italicBtn.classList.contains('active');
        italicBtn.classList.toggle('active', isActive);
        if (drawing.tool === 'pricenote') drawing.style.userItalic = isActive;
        else drawing.style.italic = isActive;
        EventBus.emit('drawing:settings:saved');
      });
    }

    const textFsEl = overlay.querySelector('#dsd-fontsize');
    if (textFsEl) {
      textFsEl.addEventListener('change', () => {
        if (drawing.tool === 'pricenote') drawing.style.userFontSize = parseInt(textFsEl.value);
        else drawing.style.fontSize = parseInt(textFsEl.value);
        EventBus.emit('drawing:settings:saved');
      });
    }


    // Coordinate inputs sync
    const coordInputs = overlay.querySelectorAll('#dsd-p1price, #dsd-p1bar, #dsd-p2price, #dsd-p2bar, #dsd-p3price, #dsd-p3bar');
    coordInputs.forEach(input => {
      input.addEventListener('input', () => {
        DSDApply.applyFromForm(overlay, drawing);
        EventBus.emit('drawing:settings:saved');
      });
    });
  
    // Fibo Events
    if (_getCaps(drawing.tool).isFibo) {
      overlay.querySelectorAll('.dsd-color-swatch.js-fib-onecolor').forEach(swatch => {
        swatch.addEventListener('click', (e) => {
          e.stopPropagation();
          DSDColorPicker.showColorPalette(swatch, swatch.dataset.color || '#4caf50', (newColor) => {
            swatch.style.background = newColor;
            swatch.dataset.color = newColor;
            drawing.style.useOneColor = newColor;
            
            const useOneCb = overlay.querySelector('.js-fib-useone-cb');
            if (useOneCb) useOneCb.checked = true;            
            
            DSDApply.applyFromForm(overlay, drawing);
            EventBus.emit('drawing:settings:saved');
          });
        });
      });

      const useOneCbs = overlay.querySelectorAll('.js-fib-useone-cb');
      useOneCbs.forEach(cb => {
         cb.addEventListener('change', () => {
            if (cb.checked) {
               const swatch = overlay.querySelector('.js-fib-onecolor');
               drawing.style.useOneColor = swatch ? swatch.dataset.color : '#58a6ff';
            } else {
               drawing.style.useOneColor = false;
            }
            DSDApply.applyFromForm(overlay, drawing);
            EventBus.emit('drawing:settings:saved');
         });
      });

      const bgSwatches = overlay.querySelectorAll('.js-fib-bg-color');
      bgSwatches.forEach(swatch => {
         swatch.addEventListener('click', (e) => {
            e.stopPropagation();
            DSDColorPicker.showColorPalette(swatch, swatch.dataset.color || '#2962ff', (newColor) => {
               swatch.style.background = newColor;
               swatch.dataset.color = newColor;
               drawing.style.fibBgColor = newColor;
               
               let bg_r = 41, bg_g = 98, bg_b = 255;
               if (newColor.startsWith('#') && newColor.length === 7) {
                  bg_r = parseInt(newColor.slice(1,3), 16);
                  bg_g = parseInt(newColor.slice(3,5), 16);
                  bg_b = parseInt(newColor.slice(5,7), 16);
               }
               const slider = overlay.querySelector('.dsd-fib-opacity-slider');
               if (slider) {
                  slider.style.setProperty('--bg-rgb', `${bg_r},${bg_g},${bg_b}`);
               }
               
               const bgCb = overlay.querySelector('#dsd-fib-bg');
               if (bgCb) bgCb.checked = true;
               
               DSDApply.applyFromForm(overlay, drawing);
               EventBus.emit('drawing:settings:saved');
            });
         });
      });

      overlay.querySelectorAll('.dsd-color-swatch.js-fib-color').forEach(swatch => {
        swatch.addEventListener('mousedown', (e) => e.stopPropagation());
        swatch.addEventListener('click', (e) => {
          e.stopPropagation();
          let lvlArr = drawing.style.fibLevels;
          let idx = parseInt(swatch.dataset.idx);          

          if (drawing.tool === 'fib-speedfan') {
            if (swatch.classList.contains('js-sf-price-col')) {
              drawing.style.priceLevels = drawing.style.priceLevels || new Array(7).fill(null).map((_,i) => ({v:[0,0.25,0.382,0.5,0.618,0.75,1][i], color:['#787b86','#f44336','#ff9800','#4caf50','#00bcd4','#2962ff','#9c27b0'][i], active:true, width:1, style:'solid'}));
              lvlArr = drawing.style.priceLevels;
            } else if (swatch.classList.contains('js-sf-time-col')) {
              drawing.style.timeLevels = drawing.style.timeLevels || new Array(7).fill(null).map((_,i) => ({v:[0,0.25,0.382,0.5,0.618,0.75,1][i], color:['#787b86','#f44336','#ff9800','#4caf50','#00bcd4','#2962ff','#9c27b0'][i], active:true, width:1, style:'solid'}));
              lvlArr = drawing.style.timeLevels;
            }
          }
          
          const lvl = lvlArr && lvlArr[idx] ? lvlArr[idx] : { v:0, color: swatch.dataset.color || '#4caf50' };
          const curC = lvl.color || swatch.dataset.color || '#4caf50';
          const curW = lvl.width || drawing.style.levelsWidth || 1;
          const curS = lvl.style || drawing.style.levelsStyle || 'solid';

          DSDColorPicker.showCombinedLineSettings(swatch, curC, curW, curS, true, ({ color: newColor, width: newWidth, style: newStyle }) => {
            swatch.style.background = newColor;
            swatch.dataset.color = newColor;
            
            drawing.style = drawing.style || {};
            if (!lvlArr || lvlArr.length === 0) {
              if (drawing.tool === 'fib-speedfan') {
                 if (swatch.classList.contains('js-sf-price-col')) lvlArr = drawing.style.priceLevels = new Array(7).fill(null).map(()=>({v:0,color:'#000',active:false,width:1,style:'solid'}));
                 else lvlArr = drawing.style.timeLevels = new Array(7).fill(null).map(()=>({v:0,color:'#000',active:false,width:1,style:'solid'}));
              } else {
                 lvlArr = drawing.style.fibLevels = new Array(24).fill(null).map(()=>({v:0,color:'#000',active:false,width:1,style:'solid'}));
              }
            }
            lvlArr[idx].color = newColor;
            lvlArr[idx].width = newWidth;
            lvlArr[idx].style = newStyle;
            
            DSDApply.applyFromForm(overlay, drawing);
            EventBus.emit('drawing:settings:saved');
          });
        });
      });

      // Add instant apply to all Fibo checkboxes, selects, and inputs
      const fibInputs = overlay.querySelectorAll('.js-fib-active, .js-fib-val, #dsd-tl-active, #dsd-fib-bg, #dsd-fib-bgalph, #dsd-fib-reverse, #dsd-fib-prices, #dsd-fib-levels-active, #dsd-fib-extend, #dsd-fib-levels-mode, #dsd-fib-labels-h, #dsd-fib-labels-v, #dsd-fib-fontsize, #dsd-fib-logscale, #dsd-sf-labels-left, #dsd-sf-labels-right, #dsd-sf-labels-top, #dsd-sf-labels-bottom, #dsd-sf-grid-active');
      fibInputs.forEach(inp => {
        inp.addEventListener('change', () => {
          if (inp.classList.contains('js-fib-active')) {
             const row = inp.closest('.dsd-row-inline');
             if (row) row.style.opacity = inp.checked ? '1' : '0.4';
          }
          DSDApply.applyFromForm(overlay, drawing);
          EventBus.emit('drawing:settings:saved');
        });
        if (inp.type === 'range' || inp.classList.contains('js-fib-val')) {
          inp.addEventListener('input', () => {
            DSDApply.applyFromForm(overlay, drawing);
            EventBus.emit('drawing:settings:saved');
          });
        }
      });


      /* js-tl-color removed, managed by combined popover */
      
      
      const tlSwatch = overlay.querySelector('.js-tl-color');
      if (tlSwatch) {
        tlSwatch.addEventListener('click', (e) => {
          e.stopPropagation();
          if (tlSwatch.classList.contains('js-combined-line')) {
             DSDColorPicker.showCombinedLineSettings(tlSwatch, tlSwatch.dataset.color || '#58a6ff', drawing.style?.trendLineWidth || 1, drawing.style?.trendLineStyle || 'dashed', true, (res) => {
                tlSwatch.style.background = res.color;
                tlSwatch.dataset.color = res.color;
                drawing.style = drawing.style || {};
                drawing.style.trendLineColor = res.color;
                drawing.style.trendLineWidth = res.width;
                drawing.style.trendLineStyle = res.style;
                drawing.style.trendLineDash = res.style === 'dashed' ? [8,5] : res.style === 'dotted' ? [3,3] : [];
                EventBus.emit('drawing:settings:saved');
             });
          }
        });
      }

      const gridSwatch = overlay.querySelector('.js-grid-color');
      if (gridSwatch) {
        gridSwatch.addEventListener('click', (e) => {
          e.stopPropagation();
          if (gridSwatch.classList.contains('js-combined-line')) {
             DSDColorPicker.showCombinedLineSettings(gridSwatch, gridSwatch.dataset.color || '#363c4e', drawing.style?.gridWidth || 1, drawing.style?.gridStyle || 'dashed', true, (res) => {
                gridSwatch.style.background = res.color;
                gridSwatch.dataset.color = res.color;
                drawing.style = drawing.style || {};
                drawing.style.gridColor = res.color;
                drawing.style.gridWidth = res.width;
                drawing.style.gridStyle = res.style;
                EventBus.emit('drawing:settings:saved');
             });
          }
        });
      }



    }
  }

  // ── Apply form values to drawing on OK ───────────


  return { open, showTemplateMenu, getCaps: _getCaps };

})();


window.DrawingSettingsDialog = DrawingSettingsDialog;
