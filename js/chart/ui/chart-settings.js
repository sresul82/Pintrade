/* --- sync-panel.js --- */
// ── Sync Panel UI ─────────────────────────────────────────────


function buildSyncPanel(syncManager) {
  const panel = document.getElementById('sync-panel');

  const rows = [
    { key: 'symbol',    label: 'Symbol',    info: 'Share the same symbol across all panes' },
    { key: 'interval',  label: 'Interval',  info: 'Share the same timeframe across all panes' },
    { key: 'crosshair', label: 'Crosshair', info: 'Sync crosshair position across all panes' },
    { key: 'time',      label: 'Time',      info: 'Share the same time position' },
    { key: 'dateRange', label: 'Date range', info: 'Share the same visible date range' },
    { key: 'chartType', label: 'Chart type', info: 'Share the same chart type (candle, line, etc) across all panes' },
  ];

  if (!panel) return;
  panel.innerHTML = `<div class="fp-title">Sync in Layout</div>` +
    rows.map(r => `
      <div class="fp-row">
        <span class="fp-label">
          ${r.label}
          <span class="fp-info" title="${r.info}">i</span>
        </span>
        <label class="tog">
          <input type="checkbox" data-sync="${r.key}" ${syncManager.opts[r.key] ? 'checked' : ''}/>
          <span class="tog-t"><span class="tog-h"></span></span>
        </label>
      </div>`).join('');

  // Wire toggles
  panel.querySelectorAll('[data-sync]').forEach(cb => {
    cb.addEventListener('change', e => {
      syncManager.set(cb.dataset.sync, e.target.checked);
    });
  });
}

/* --- menus.js --- */
// ── Context Menus ───────────────────────────────────────────


// ── helpers ───────────────────────────────────────────────────────────
function closeAllMenus() {
  document.querySelectorAll('.ctx-menu.open').forEach(m => m.classList.remove('open'));
}

function positionMenu(el, x, y) {
  el.style.left = '0px'; el.style.top = '0px'; el.style.display = 'block';
  
  // Enable scrolling for very tall menus
  el.style.maxHeight = 'calc(100vh - 8px)';
  el.style.overflowY = 'auto';
  
  const rect = el.getBoundingClientRect();
  el.style.left = Math.max(4, Math.min(x, window.innerWidth  - rect.width  - 4)) + 'px';
  el.style.top  = Math.max(4, Math.min(y, window.innerHeight - rect.height - 4)) + 'px';
  el.style.display = '';
}

function makeMenu(items) {
  const el = document.createElement('div');
  el.className = 'ctx-menu';
  items.forEach(spec => {
    if (spec === 'sep') {
      const s = document.createElement('div'); s.className = 'ctx-sep'; el.appendChild(s);
    } else {
      const row = document.createElement('div');
      row.className = 'ctx-row' + (spec.disabled ? ' disabled' : '');
      row.innerHTML =
        `<span class="ctx-check">${spec.checked ? ICONS.check : ''}</span>` +
        `<span class="ctx-label">${spec.label}</span>` +
        (spec.key  ? `<span class="ctx-key">${spec.key}</span>`      : '') +
        (spec.sub  ? `<span class="ctx-arrow">${ICONS.arrowChevron}</span>` : '');

      if (spec.sub) {
        // Build sub-menu but append to body to avoid overflow clipping!
        const sub = makeMenu(spec.sub);
        sub.className += ' ctx-submenu';
        
        // Wait until menu is actually opened before DOM insertion to avoid leaks
        // But for simplicity we append immediately and clean it up in contextmenu:show
        document.body.appendChild(sub);
        
        const openSub = () => {
          document.querySelectorAll('.ctx-submenu.open').forEach(s => s.classList.remove('open'));
          
          sub.classList.add('open');
          
          const rowRect = row.getBoundingClientRect();
          let left = rowRect.right;
          let top = rowRect.top - 5;
          
          sub.style.left = left + 'px';
          sub.style.top = top + 'px';
          
          // Smart positioning using sub bounds
          const subRect = sub.getBoundingClientRect();
          if (subRect.right > window.innerWidth) {
            left = rowRect.left - subRect.width;
            sub.style.left = left + 'px';
          }
          if (subRect.bottom > window.innerHeight) {
            top = Math.max(4, window.innerHeight - subRect.height - 4);
            sub.style.top = top + 'px';
          }
        };

        row.addEventListener('mouseenter', openSub);
        row.addEventListener('click', (e) => { e.stopPropagation(); openSub(); });
      } else {
        row.addEventListener('mouseenter', () => {
          if (!el.classList.contains('ctx-submenu')) {
            document.querySelectorAll('.ctx-submenu.open').forEach(s => s.classList.remove('open'));
          }
        });
        
        if (spec.action) {
          row.addEventListener('click', e => { 
            e.stopPropagation(); 
            document.querySelectorAll('.ctx-menu').forEach(m => m.remove()); 
            spec.action(); 
          });
        }
      }
      el.appendChild(row);
    }
  });
  return el;
}

// ── Chart area context menu ────────────────────────────────────────────
function buildChartMenu(pane, priceVal) {
  const priceStr = priceVal != null ? priceVal.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 5 }) : '...';
  const sym = pane.symbol || 'Symbol';

  return makeMenu([
    { label: 'Reset chart view',      key: 'Alt + R', action: () => pane.fitContent() },
    'sep',
    { label: 'Lock vertical cursor line by time' },
    'sep',
    { label: 'Table view' },
    { label: 'Chart template', sub: [
        { label: 'Save indicator template...' },
        { label: 'Apply default template' }
      ] 
    },
    'sep',
    { label: 'Settings...', action: () => EventBus.emit('settings:open', { pane, gearEl: pane.gearBtn }) },
  ]);
}

// ── Price scale context menu (TradingView style) ───────────────────────
function buildPriceScaleMenu(pane) {
  const toggle = (key) => () => pane.setOption(key, !pane[key]);
  return makeMenu([
    { label: 'Reset price scale',   key: 'Alt + R', action: () => pane.fitContent() },
    { label: 'Auto (fits data to screen)',          action: () => pane.fitContent() },
    { label: 'Lock price to bar ratio', checked: pane.lockPriceToBar, action: toggle('lockPriceToBar') },
    { label: 'Scale price chart only',  checked: pane.scalePriceChartOnly, action: toggle('scalePriceChartOnly') },
    { label: 'Invert scale',        key: 'Alt + I', checked: pane.invertScale, action: toggle('invertScale') },
    'sep',
    { label: 'Regular',     checked: pane.scaleMode === 'normal',       action: () => { pane.setScaleMode('normal'); } },
    { label: 'Percent',     checked: pane.scaleMode === 'percent',      key: 'Alt + P', action: () => { pane.setScaleMode('percent'); } },
    { label: 'Indexed to 100', disabled: true },
    { label: 'Logarithmic', checked: pane.scaleMode === 'logarithmic',  key: 'Alt + L', action: () => { pane.setScaleMode('logarithmic'); } },
    'sep',
    { label: pane.priceSide === 'right' ? 'Move scale to left' : 'Move scale to right',
                                                  action: () => pane.setPriceSide(pane.priceSide === 'right' ? 'left' : 'right') },
    'sep',
    { label: 'Labels', sub: [
        { label: 'Symbol name label', checked: pane.lblSymbolName, action: toggle('lblSymbolName') },
        { label: 'Symbol last price label', checked: pane.lblSymbolLastPrice, action: toggle('lblSymbolLastPrice') },
        { label: 'Symbol previous day close price label', checked: pane.lblPrevDayClose, action: toggle('lblPrevDayClose') },
        { label: 'Pre/post market price label', checked: pane.lblPrePost, action: toggle('lblPrePost') },
        { label: 'High and low price labels', checked: pane.lblHighLow, action: toggle('lblHighLow') },
        { label: 'Bid and ask labels', checked: pane.lblBidAsk, action: toggle('lblBidAsk') },
        { label: 'Indicators and financials name labels', checked: pane.lblIndName, action: toggle('lblIndName') },
        { label: 'Indicators and financials value labels', checked: pane.lblIndValue, action: toggle('lblIndValue') },
        'sep',
        { label: 'Countdown to bar close', checked: pane.lblCountdown, action: toggle('lblCountdown') },
        'sep',
        { label: 'No overlapping labels', checked: pane.lblNoOverlap, action: toggle('lblNoOverlap') },
      ]
    },
    { label: 'Lines', sub: [
        { label: 'Price line', checked: pane.priceLine, action: toggle('priceLine') },
        { label: 'Previous day close price line', checked: pane.linePrevDayClose, action: toggle('linePrevDayClose') },
        { label: 'Pre/post market price line', checked: pane.linePrePost, action: toggle('linePrePost') },
        { label: 'High and low price lines', checked: pane.lineHighLow, action: toggle('lineHighLow') },
        { label: 'Bid and ask lines', checked: pane.lineBidAsk, action: toggle('lineBidAsk') },
      ]
    },
    { label: 'Plus button', checked: pane.plusButton, action: toggle('plusButton') },
    'sep',
    { label: 'More settings...', action: () => EventBus.emit('settings:open', { pane, gearEl: pane.gearBtn, tab: 'scales' }) },
  ]);
}

function rebuildPriceScale(pane) {
  // Visual feedback: nothing extra needed, setScaleMode already applied
}

// ── Main export ────────────────────────────────────────────────────────
function initContextMenus() {
  EventBus.on('contextmenu:show', ({ e, pane, isPriceScale, priceVal }) => {
    e.preventDefault();
    document.querySelectorAll('.ctx-menu').forEach(m => m.remove());

    const menu = isPriceScale ? buildPriceScaleMenu(pane) : buildChartMenu(pane, priceVal);
    document.body.appendChild(menu);
    requestAnimationFrame(() => {
      menu.classList.add('open');
      positionMenu(menu, e.clientX ?? 0, e.clientY ?? 0);
    });
  });

  document.addEventListener('click', () => {
    document.querySelectorAll('.ctx-menu').forEach(m => m.remove());
  });

  // Prevent chart canvas right-click from bubbling to document hide
  document.addEventListener('contextmenu', e => {
    if (!e.target.closest('.pane-cvs')) {
      document.querySelectorAll('.ctx-menu').forEach(m => m.remove());
    }
  });
}

/* --- settings.js --- */
// ── TV Style Settings Modal ──────────────────────────────────────

// gorevler2.md Görev 11.3 (2026-08-10, kullanıcı kararı) — "Trading" sekmesi
// (Buy/sell buttons, one-click trading, brackets, positions vb.) TradingView'ın
// Paper Trading entegrasyonundan geliyordu, bu projede hiç karşılığı yok
// (gerçek bir order execution/broker terminali değiliz) — tamamen kaldırıldı.
const TABS = [
  { id: 'symbol',     label: 'Symbol',           icon: '<svg viewBox="0 0 18 18" width="18" height="18" fill="none" stroke="currentColor"><path d="M6 3v12M12 5v10M4 6h4M10 8h4"/></svg>' },
  { id: 'statusline', label: 'Status line',      icon: '<svg viewBox="0 0 18 18" width="18" height="18" fill="currentColor"><path d="M3 4h12v2H3zM3 8h12v2H3zM3 12h8v2H3z"/></svg>' },
  { id: 'scales',     label: 'Scales and lines', icon: '<svg viewBox="0 0 18 18" width="18" height="18" fill="none" stroke="currentColor"><path d="M4 2v14h12" stroke-width="1.5"/><circle cx="8" cy="10" r="1.5"/><circle cx="13" cy="6" r="1.5"/><path d="M8 10l5-4"/></svg>' },
  { id: 'canvas',     label: 'Canvas',           icon: '<svg viewBox="0 0 18 18" width="18" height="18" fill="none" stroke="currentColor"><path d="M12 4l2 2-7 7-3 1 1-3 7-7zM11 5l2 2"/></svg>' },
  { id: 'alerts',     label: 'Alerts',           icon: '<svg viewBox="0 0 18 18" width="18" height="18" fill="none" stroke="currentColor"><circle cx="9" cy="9" r="6"/><path d="M9 5v4l2 2M1 1l3 3M17 1l-3 3"/></svg>' },
  { id: 'events',     label: 'Events',           icon: '<svg viewBox="0 0 18 18" width="18" height="18" fill="none" stroke="currentColor"><rect x="3" y="4" width="12" height="11" rx="1"/><path d="M3 8h12M6 2v4M12 2v4"/></svg>' },
];

function buildSection(title) {
  return `<div class="tv-setting-section">${title}</div>`;
}

function buildCheck(label, checked = false, config = {}) {
  const { info, desc, nested, key } = config;
  const keyAttr = key ? `data-key="${key}" data-type="checkbox"` : '';
  let chk = `<label class="tv-check-label ${nested ? 'nested' : ''}">
    <input type="checkbox" class="tv-checkbox" ${keyAttr} ${checked ? 'checked' : ''}/>
    <span class="tv-check-box"></span>
    <span class="tv-check-text">${label}</span>
    ${info ? `<span class="tv-info-icon" title="${info}">?</span>` : ''}
  </label>`;
  if (desc) {
    chk += `<div class="tv-check-desc">${desc}</div>`;
  }
  return chk;
}

function buildSelect(options, selected, key = null) {
  const keyAttr = key ? `data-key="${key}" data-type="select"` : '';
  const opts = options.map(o => `<div class="tv-cselect-option ${o === selected ? 'selected':''}">${o}</div>`).join('');
  return `
    <div class="tv-cselect" tabindex="0" ${keyAttr}>
      <div class="tv-cselect-val">${selected}</div>
      <svg class="tv-cselect-arr" viewBox="0 0 16 16" width="16" height="16"><path d="M4 6l4 4 4-4" stroke="#787b86" fill="none" stroke-width="1.5"/></svg>
      <div class="tv-cselect-drop">${opts}</div>
    </div>
  `;
}

function buildMultiSelect(options) {
  // options = [{ label: 'Value', key: 'hlValue', checked: true }, ...]
  const opts = options.map(o => `
    <label class="tv-cselect-option multi-opt" style="display: flex; align-items: center;" onclick="event.stopPropagation()">
      <input type="checkbox" class="tv-checkbox" data-key="${o.key}" data-type="checkbox" ${o.checked ? 'checked' : ''} />
      <span class="tv-check-box"></span>
      <span class="tv-check-text" style="margin-left: 8px;">${o.label}</span>
    </label>
  `).join('');
  
  return `
    <div class="tv-cselect multi" tabindex="0" data-type="multiselect">
      <div class="tv-cselect-val" style="text-transform: capitalize;"></div>
      <svg class="tv-cselect-arr" viewBox="0 0 16 16" width="16" height="16"><path d="M4 6l4 4 4-4" stroke="#787b86" fill="none" stroke-width="1.5"/></svg>
      <div class="tv-cselect-drop" style="min-width: max-content;">${opts}</div>
    </div>
  `;
}


function buildSlider(val, max=100, key=null) {
  const keyAttr = key ? `data-key="${key}" data-type="number"` : '';
  return `<div class="tv-slider-wrap"><input type="range" class="tv-slider" value="${val}" max="${max}" ${keyAttr}/></div>`;
}

function buildRow(left, rightHtml, config = {}) {
  const { isNested, noRightAlign } = config;
  let rightCls = noRightAlign ? 'tv-row-right tv-align-left' : 'tv-row-right';
  return `<div class="tv-row ${isNested ? 'nested' : ''}">
    <div class="tv-row-left">${left}</div>
    <div class="${rightCls}">${rightHtml}</div>
  </div>`;
}

/* TABS BLOCKS */

function tabSymbol() {
  return `
    ${buildSection('CANDLES')}
    ${buildRow(buildCheck('Color bars based on previous close', false, {key:'colorBarsPrevClose'}), '')}
    ${buildRow(buildCheck('Body', true, {key:'candleBody'}), buildLineToolBtn('candleUpColor', '#089981', 1, 'solid', false) + buildLineToolBtn('candleDownColor', '#f23645', 1, 'solid', false))}
    ${buildRow(buildCheck('Borders', true, {key:'candleBorders'}), buildLineToolBtn('borderUpColor', '#089981', 1, 'solid', false) + buildLineToolBtn('borderDownColor', '#f23645', 1, 'solid', false))}
    ${buildRow(buildCheck('Wick', true, {key:'candleWick'}), buildLineToolBtn('wickUpColor', '#089981', 1, 'solid', false) + buildLineToolBtn('wickDownColor', '#f23645', 1, 'solid', false))}
    
    ${buildSection('DATA MODIFICATION')}
    ${buildRow('Precision', buildSelect(['Default', 'Integer', '1', '2', '3', '4', '5'], 'Default', 'precision'))}
    ${buildRow('Timezone', buildSelect(['UTC', 'UTC-5 Chicago', 'UTC-4 New York', 'UTC+1 London', 'UTC+2 Budapest', 'UTC+3 Istanbul', 'UTC+5 Ashkabat', 'UTC+9 Tokyo', 'Exchange'], 'UTC', 'timezone'))}
  `;
}

function tabStatusline() {
  return `
    ${buildSection('INSTRUMENT')}
    ${buildRow(buildCheck('Logo', true, {key:'statusLogo'}), '')}
    ${buildRow(buildCheck('Title', true, {key:'statusTitle'}), buildSelect(['Name', 'Symbol', 'Symbol and name'], 'Name', 'statusTitleFormat'))}
    ${buildRow(buildCheck('Open market status', true, {key:'statusMarket'}), '')}
    ${buildRow(buildCheck('Chart values', true, {key:'statusChartValues'}), '')}
    ${buildRow(buildCheck('Bar change values', true, {key:'statusBarChange'}), '')}
    ${buildRow(buildCheck('Volume', true, {key:'showVolume'}), '')}
    ${buildRow(buildCheck('Last day change values', false, {key:'statusLastDayChange'}), '')}
    ${buildRow(buildCheck('Background', true, {key:'statusBg'}), buildSlider(50))}
  `;
}

function tabScales() {
  let symbolOpts = buildMultiSelect([{label:'Name', key:'symName', checked:true}, {label:'Value', key:'symValue', checked:true}, {label:'Line', key:'symLine', checked:true}]) + buildLineToolBtn('symbolLabelColor', '#f23645', 1, 'solid', false);
  return `
    ${buildSection('PRICE SCALE')}
    ${buildRow('Currency and Unit', buildSelect(['Visible on mouse over', 'Always visible', 'Always invisible'], 'Always visible', 'currencyUnit'))}
    ${buildRow('Scale modes (A and L)', buildSelect(['Visible on mouse over', 'Always visible', 'Always invisible'], 'Visible on mouse over', 'scaleModeVisibility'))}
    ${buildRow(buildCheck('Lock price to bar ratio', false, {key:'lockPriceToBar'}), '<input type="text" disabled value="9.2795867" class="tv-input" />')}
    ${buildRow('Scales placement', buildSelect(['Stack on the left', 'Stack on the right', 'Auto'], 'Auto', 'scalesPlacement'))}
    
    ${buildSection('PRICE LABELS & LINES')}
    ${buildRow(buildCheck('No overlapping labels', true, {key:'noOverlapLabels'}), '')}
    ${buildRow(buildCheck('Plus button', false, {info: 'Click here to learn more', key:'plusButton'}), '')}
    ${buildRow(buildCheck('Countdown to bar close', true, {key:'countdown'}), '')}
    ${buildRow(buildCheck('Symbol', true, {key:'symbolLabel'}), symbolOpts)}
    <div class="tv-row-right-only">${buildSelect(['Price and percentage value', 'Value according to scale'], 'Value according to scale', 'symbolLabelStyle')}</div>
    ${buildSection('PRICE LINES')}
    ${buildRow(buildCheck('Previous day close', false, {key:'prevDayClose'}), buildMultiSelect([{label:'Value', key:'pdValue', checked:false}, {label:'Line', key:'pdLine', checked:true}]) + buildLineToolBtn('prevDayColor', '#787b86', 1, 'solid', false))}
    ${buildRow(buildCheck('High and low', false, {key:'highLow'}), buildMultiSelect([{label:'Value', key:'hlValue', checked: true}, {label:'Line', key:'hlLine', checked: true}]) + buildLineToolBtn('hlColor', '#f23645', 1, 'solid', false))}
    ${buildRow(buildCheck('Bid and ask', false, {key:'bidAsk'}), buildMultiSelect([{label:'Value', key:'baValue', checked: true}, {label:'Line', key:'baLine', checked: true}]) + buildLineToolBtn('bidColor', '#2962ff', 1, 'solid', false) + buildLineToolBtn('askColor', '#f23645', 1, 'solid', false))}

    ${buildSection('TIME SCALE')}
    ${buildRow(buildCheck('Day of week on labels', true, {key:'dayOfWeekLabels'}), '')}
    ${buildRow('Date format', buildSelect(["Mon 29 Sep '97", "YYYY-MM-DD"], "Mon 29 Sep '97", 'dateFormat'))}
    ${buildRow('Time hours format', buildSelect(['24-hours', '12-hours'], '24-hours', 'timeFormat'))}
    ${buildRow(buildCheck('Save chart left edge position when changing interval', false, {key:'saveLeftEdge'}), '')}
  `;
}

function tabCanvas() {
  return `
    ${buildSection('CHART BASIC STYLES')}
    ${buildRow('Background', buildSelect(['Solid', 'Gradient'], 'Solid', 'bgType') + buildLineToolBtn('bgColor1', '#131722', 1, 'solid', false) + buildLineToolBtn('bgColor2', '#2a2e39', 1, 'solid', false))}
    ${buildRow('Grid lines', buildSelect(['Vert and horz', 'Vert only', 'Horz only', 'None'], 'Vert and horz', 'gridType') + buildLineToolBtn('gridVertColor', '#363c4e', 1, 'solid', false) + buildLineToolBtn('gridHorzColor', '#363c4e', 1, 'solid', false))}
    ${buildRow('Crosshair', buildLineToolBtn('crosshairColor', '#787b86', 1, 'solid', false))}
    ${buildRow('Watermark', buildSelect(['Ticker', 'Interval', 'Description'], 'Ticker', 'watermarkMode') + buildLineToolBtn('watermarkColor', '#363c4e', 1, 'solid', false))}
    
    ${buildSection('SCALES')}
    ${buildRow('Text', buildLineToolBtn('scaleTextColor', '#d1d4dc', 1, 'solid', false) + buildSelect(['10', '12', '14', '16', '18', '20', '22', '24', '26', '28', '30', '32', '34', '36', '38', '40'], '12', 'scaleFontSize'))}
    ${buildRow('Lines', buildLineToolBtn('scaleLinesColor', '#363c4e', 1, 'solid', false))}
    
    ${buildSection('BUTTONS')}
    ${buildRow('Navigation', buildSelect(['Visible on mouse over', 'Always visible', 'Always invisible'], 'Visible on mouse over', 'navBtnVisibility'))}
    ${buildRow('Pane', buildSelect(['Visible on mouse over', 'Always visible', 'Always invisible'], 'Visible on mouse over', 'paneBtnVisibility'))}

    ${buildSection('MARGINS')}
    ${buildRow('Top', '<input type="number" class="tv-input-num" value="10" data-key="marginTop" data-type="number"/> <span class="tv-unit">%</span>', {noRightAlign:true})}
    ${buildRow('Bottom', '<input type="number" class="tv-input-num" value="8" data-key="marginBottom" data-type="number"/> <span class="tv-unit">%</span>', {noRightAlign:true})}
    ${buildRow('Right', '<input type="number" class="tv-input-num" value="10" data-key="marginRight" data-type="number"/> <span class="tv-unit">bars</span>', {noRightAlign:true})}
  `;
}

function tabAlerts() {
  const iconSound = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#787b86"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>';
  return `
    ${buildSection('CHART LINE VISIBILITY')}
    ${buildRow(buildCheck('Alert lines', true, {key:'alertLines'}), buildLineToolBtn('alertLinesColor', '#f23645', 1, 'solid', false))}
    ${buildRow(buildCheck('Only active alerts', true, {key:'onlyActiveAlerts'}), '')}

    ${buildSection('NOTIFICATIONS')}
    ${buildRow(buildCheck('Alert volume', true, {key:'alertVolume'}), iconSound + buildSlider(50, 100, 'alertVolumeLevel'))}
    ${buildRow(buildCheck('Automatically hide toasts', true, {info:'Click here to learn more', key:'autoHideToasts'}), '')}
  `;
}

function tabEvents() {
  // gorevler2.md Görev 11.3 (2026-08-10, kullanıcı kararı) — Ideas/Economic
  // events/Latest news/News notification kaldırıldı: proje ayrı bir News
  // sekmesine sahip, burada tekrarı gereksizdi. Session breaks kaldı (henüz
  // applySettings()'e bağlı değil — ayrı bir iş).
  return `
    ${buildSection('EVENTS')}
    ${buildRow(buildCheck('Session breaks', false, {key:'sessionBreaks'}), buildLineToolBtn('sessionBreaks', '#2962ff', 1, 'dashed', true))}
  `;
}

// ── Read current state from form ──────────────────────────────
function readFormState(overlay) {
  const state = {};

  // Checkboxes
  overlay.querySelectorAll('[data-type="checkbox"]').forEach(el => {
    state[el.dataset.key] = el.checked;
  });

  // Custom selects
  overlay.querySelectorAll('[data-type="select"]').forEach(el => {
    const selected = el.querySelector('.tv-cselect-option.selected');
    state[el.dataset.key] = selected ? selected.textContent.trim() : null;
  });

  // Color boxes
  overlay.querySelectorAll('[data-type="color"]').forEach(el => {
    state[el.dataset.key] = el.dataset.color;
  });

  // Number inputs
  overlay.querySelectorAll('[data-type="number"]').forEach(el => {
    state[el.dataset.key] = parseFloat(el.value);
  });

  // Line tools (Color, thickness and style combo)
  overlay.querySelectorAll('[data-type="linetool"]').forEach(el => {
    const isLineMode = el.dataset.linemode === 'true';
    if (isLineMode) {
      state[el.dataset.key + 'Color'] = el.dataset.color;
      state[el.dataset.key + 'Thick'] = parseInt(el.dataset.thickness);
      state[el.dataset.key + 'Style'] = el.dataset.style;
    } else {
      state[el.dataset.key] = el.dataset.color;
    }
  });

  return state;
}

// ── Modal Creation ──────────────────────────────────────────────
function initSettings() {
  EventBus.on('settings:open', ({ pane, tab = 'symbol' }) => {
    document.querySelector('.tv-settings-overlay')?.remove();

    const overlay = document.createElement('div');
    overlay.className = 'tv-settings-overlay';

    overlay.innerHTML = `
      <div class="tv-settings-modal">
        <div class="tv-header">
          <div class="tv-title">Settings</div>
          <button class="tv-close"><svg viewBox="0 0 18 18" width="18" height="18" stroke="currentColor" stroke-width="1.5"><path d="M4 4l10 10m0-10L4 14"/></svg></button>
        </div>
        <div class="tv-body">
          <div class="tv-sidebar">
            ${TABS.map(t => `
              <div class="tv-tab-item ${t.id === tab ? 'active':''}" data-tab="${t.id}">
                <div class="tv-tab-icon">${t.icon}</div> ${t.label}
              </div>
            `).join('')}
          </div>
          <div class="tv-content">
            <div class="tv-tab-pane" data-tab="symbol">${tabSymbol()}</div>
            <div class="tv-tab-pane" data-tab="statusline">${tabStatusline()}</div>
            <div class="tv-tab-pane" data-tab="scales">${tabScales()}</div>
            <div class="tv-tab-pane" data-tab="canvas">${tabCanvas()}</div>
            <div class="tv-tab-pane" data-tab="alerts">${tabAlerts()}</div>
            <div class="tv-tab-pane" data-tab="events">${tabEvents()}</div>
          </div>
        </div>
        <div class="tv-footer">
          <div class="tv-template">
            <select class="tv-select-template"><option>Template</option></select>
          </div>
          <div class="tv-actions">
            <button class="tv-btn tv-btn-cancel">Cancel</button>
            <button class="tv-btn tv-btn-ok">Ok</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Pre-fill from pane state if available (Fix #7: always reflect current state)
    if (pane) {
      const s = pane;
      const setCheck = (key, val) => {
        const el = overlay.querySelector(`[data-key="${key}"]`);
        if (el) el.checked = !!val;
      };
      const setSelect = (key, val) => {
        const el = overlay.querySelector(`[data-key="${key}"]`);
        if (!el || val == null) return;
        el.querySelectorAll('.tv-cselect-option').forEach(o => {
          const active = o.textContent.trim() === String(val);
          o.classList.toggle('selected', active);
        });
        const v = el.querySelector('.tv-cselect-val');
        if (v) v.textContent = val;
      };

      const setLineTool = (key, cStr, tNum, sStr) => {
        const el = overlay.querySelector(`[data-key="${key}"][data-type="linetool"]`);
        if (!el) return;
        if (cStr) { el.dataset.color = cStr; el.querySelector('.tv-linetool-color-preview').style.background = cStr; }
        if (tNum) el.dataset.thickness = tNum;
        if (sStr) el.dataset.style = sStr;
        const line = el.querySelector('line');
        if (line) {
          line.setAttribute('stroke-width', el.dataset.thickness);
          line.removeAttribute('stroke-dasharray');
          if (el.dataset.style === 'dashed') line.setAttribute('stroke-dasharray', '4,4');
          if (el.dataset.style === 'dotted') line.setAttribute('stroke-dasharray', '2,2');
        }
      };
      const setColor = (key, hex) => {
        const el = overlay.querySelector(`[data-key="${key}"]`);
        if (el && hex) { el.style.background = hex; el.dataset.color = hex; }
      };

      // Checkboxes
      setCheck('showVolume',      s.showVolume);
      setCheck('countdown',       s.lblCountdown);
      setCheck('noOverlapLabels', s.lblNoOverlap);
      setCheck('lockPriceToBar',  s.lockPriceToBar);
      setCheck('candleBody',      s.candleBodyVisible);
      setCheck('candleBorders',   s.candleBordersVisible);
      setCheck('candleWick',      s.candleWickVisible);

      // Candle colors
      setColor('candleUpColor',   s.candleUpColor);
      setColor('candleDownColor', s.candleDownColor);
      setColor('borderUpColor',   s.borderUpColor);
      setColor('borderDownColor', s.borderDownColor);
      setColor('wickUpColor',     s.wickUpColor);
      setColor('wickDownColor',   s.wickDownColor);

      // Canvas colors
      setColor('bgColor1',        s.bgColor1);
      setColor('bgColor2',        s.bgColor2);
      setColor('gridVertColor',   s.gridVertColor);
      setColor('gridHorzColor',   s.gridHorzColor);
      setColor('watermarkColor', s.watermarkColor);
      setColor('scaleTextColor', s.scaleTextColor);
      setColor('scaleLinesColor', s.scaleLinesColor);

      // Line tools
      setLineTool('sessionBreaks', s.sessionBreaksColor, s.sessionBreaksThick, s.sessionBreaksStyle);
      setLineTool('eventsBreaks', s.eventsBreaksColor, s.eventsBreaksThick, s.eventsBreaksStyle);

      // Selects
      if (s.bgType)          setSelect('bgType',          s.bgType);
      if (s.gridType)        setSelect('gridType',        s.gridType);
      if (s.scaleFontSize)   setSelect('scaleFontSize',   s.scaleFontSize);
      if (s.timezone)        setSelect('timezone',        s.timezone);
      if (s.priceSide === 'left')  setSelect('scalesPlacement', 'Stack on the left');
      if (s.priceSide === 'right') setSelect('scalesPlacement', 'Stack on the right');
      
      setCheck('prevDayClose', s.linePrevDayClose);
      setCheck('highLow', s.lineHighLow);
      setCheck('bidAsk', s.lineBidAsk);
      
      // Multi-select internal checkboxes
      setCheck('hlValue', s.hlValue ?? true);
      setCheck('hlLine',  s.hlLine  ?? true);
      setCheck('baValue', s.baValue ?? true);
      setCheck('baLine',  s.baLine  ?? true);
      setCheck('pdValue', s.pdValue ?? false);
      setCheck('pdLine',  s.pdLine  ?? true);
      setCheck('symName', s.symName ?? true);
      setCheck('symValue',s.symValue?? true);
      setCheck('symLine', s.symLine ?? true);

      // gorevler2.md Görev 11 (2026-08-10) — Alerts sekmesi pane'e değil
      // AlertStore'un global tercihlerine bağlı (bkz. alert-store.js başlığı),
      // bu yüzden pane state'inden değil oradan okunuyor. setCheck/setColor
      // bu bloğun kapsadığı `if (pane)` scope'una ait — DIŞINA taşınırsa
      // ReferenceError fırlatıp TÜM settings:open handler'ını (Cancel/Ok
      // butonları dahil) sessizce durdurur, bu yüzden burada, İÇERİDE kalmalı.
      if (window.AlertStore) {
        const ap = window.AlertStore.getPrefs();
        setCheck('alertLines', ap.alertLines);
        setColor('alertLinesColor', ap.alertLinesColor);
        setCheck('onlyActiveAlerts', ap.onlyActiveAlerts);
        setCheck('alertVolume', ap.alertVolume !== false);
        const volSlider = overlay.querySelector('[data-key="alertVolumeLevel"]');
        if (volSlider) volSlider.value = ap.alertVolumeLevel ?? 50;
        setCheck('autoHideToasts', ap.autoHideToasts);
      }
    }

    const showTab = id => {
      overlay.querySelectorAll('.tv-tab-item').forEach(i => i.classList.toggle('active', i.dataset.tab === id));
      overlay.querySelectorAll('.tv-tab-pane').forEach(p => p.classList.toggle('active', p.dataset.tab === id));
    };
    showTab(tab);

    overlay.querySelectorAll('.tv-tab-item').forEach(el => {
      el.addEventListener('click', () => showTab(el.dataset.tab));
    });

    // Custom select interaction logic
    overlay.addEventListener('click', e => {
      const isSelectClick = e.target.closest('.tv-cselect');
      
      // Close all selects first
      overlay.querySelectorAll('.tv-cselect.open').forEach(sel => {
        if (sel !== isSelectClick) sel.classList.remove('open');
      });

      if (isSelectClick) {
        const option = e.target.closest('.tv-cselect-option');
        if (option && !option.classList.contains('multi-opt')) { // Ignore multi-opt clicks so it stays open
          const valEl = isSelectClick.querySelector('.tv-cselect-val');
          valEl.textContent = option.textContent;
          isSelectClick.querySelectorAll('.tv-cselect-option').forEach(o => o.classList.remove('selected'));
          option.classList.add('selected');
          isSelectClick.classList.remove('open');
          return;
        }
        if (!option) isSelectClick.classList.toggle('open');
      }
    });

    // Update Multi-select text immediately when an inner checkbox is ticked
    const updateMultiSelectText = () => {
      overlay.querySelectorAll('.tv-cselect.multi').forEach(sel => {
        const texts = Array.from(sel.querySelectorAll('input:checked'))
                           .map(inp => inp.closest('.multi-opt').querySelector('.tv-check-text').textContent.trim());
        sel.querySelector('.tv-cselect-val').textContent = texts.length ? texts.join(', ') : '';
      });
    };
    overlay.addEventListener('change', e => {
      if (e.target.closest('.tv-cselect.multi')) updateMultiSelectText();
    });
    // Init the labels upon load
    updateMultiSelectText();

    // Color box click → open native color picker
    overlay.addEventListener('click', e => {
      const box = e.target.closest('.tv-color-box[data-type="color"]');
      if (!box) return;
      const input = document.createElement('input');
      input.type = 'color';
      input.value = box.dataset.color || '#131722';
      input.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
      document.body.appendChild(input);
      input.addEventListener('input', () => {
        box.style.background = input.value;
        box.dataset.color = input.value;
      });
      input.addEventListener('change', () => input.remove());
      input.click();
    });

    const settingsModal = overlay.querySelector('.tv-settings-modal');
    const header = overlay.querySelector('.tv-header');
    
    let isDragging = false;
    let dragStartX = 0, dragStartY = 0;
    let initialX = 0, initialY = 0;

    const onMouseDown = (e) => {
      if (e.target.closest('.tv-close')) return;
      isDragging = true;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      const rect = settingsModal.getBoundingClientRect();
      initialX = rect.left;
      initialY = rect.top;
      // Switch to pixel rendering immediately for smooth drag
      settingsModal.style.left = initialX + 'px';
      settingsModal.style.top = initialY + 'px';
    };

    const onMouseMove = (e) => {
      if (!isDragging) return;
      const dx = e.clientX - dragStartX;
      const dy = e.clientY - dragStartY;
      settingsModal.style.left = (initialX + dx) + 'px';
      settingsModal.style.top = (initialY + dy) + 'px';
    };

    const onMouseUp = () => { isDragging = false; };

    header.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    const close = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      overlay.remove();
    };
    
    overlay.querySelector('.tv-close').addEventListener('click', close);
    overlay.querySelector('.tv-btn-cancel').addEventListener('click', close);
    overlay.querySelector('.tv-btn-ok').addEventListener('click', () => {
      if (pane) {
        const state = readFormState(overlay);
        EventBus.emit('settings:apply', { pane, state });
      }
      close();
    });
  });
}

