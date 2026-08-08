window.initChartCore = function() {

  const root = document.getElementById('chart-root');

  // ── Core systems ────────────────────────────────────────
  const pm = window.LayoutManager = new PaneManager(root);
  const sm = window.SyncManagerInstance = new SyncManager(pm);

  // ── UI systems ──────────────────────────────────────────
  initContextMenus();
  initSettings();
  initLinePicker();
  buildSyncPanel(sm);

  // ── Settings apply handler ───────────────────────────────
  EventBus.on('settings:apply', ({ state }) => {
    // Geneli etkilemesi için (Issue: "settingste degistirilen seyler geneli etkilemeli")
    pm.panes.forEach(p => {
      if (typeof p.applySettings === 'function') {
        p.applySettings(state);
      }
    });
  });

  // ── Bridge: symbol:change from navbar / State.setSymbol ──────
  // When sourceIdx is missing (navbar search), update the active pane
  EventBus.on('symbol:change', ({ sourceIdx, symbol, exchange }) => {
    if (sourceIdx !== undefined) return; // SyncManager handles pane-level changes
    const active = pm.getActivePane();
    if (!active) return;
    const sym = (symbol || '').toUpperCase();
    if (!sym) return;
    active.setSymbol(sym, exchange);
    // Update search placeholder to reflect the new symbol
    const input = document.getElementById('nb-sym-search');
    if (input) input.placeholder = sym;
    // Propagate to OTHER panes only (symbol sync from SyncManager opts)
    if (sm.opts.symbol) {
      pm.panes.forEach(p => {
        if (p.idx !== active.idx) p.setSymbol(sym, exchange);
      });
    }
  });

  // ── Bridge: chart:layout:change from app.js ─────────────
  EventBus.on('chart:layout:change', ({ layout }) => {
    if (layout && LAYOUTS[layout]) {
      pm.applyLayout(layout);
    }
  });

  // ── Bridge: index.html static sync toggles → SyncManager ───────
  // The layout menu in index.html has: input[data-sync="symbol|interval|crosshair|time"]
  // Wire them directly to sm.set() so they actually control sync state
  {
    const syncMap = { symbol: 'symbol', interval: 'interval', crosshair: 'crosshair', time: 'time' };
    document.querySelectorAll('input[data-sync]').forEach(cb => {
      const key = syncMap[cb.dataset.sync];
      if (!key) return;
      // Set initial visual state from current sm.opts
      _applyToggleVisual(cb, sm.opts[key]);
      // Wire change
      cb.addEventListener('change', () => {
        sm.set(key, cb.checked);
        _applyToggleVisual(cb, cb.checked);
      });
    });
  }

  // ── Helper: update the custom toggle-slider visual ──────────────
  function _applyToggleVisual(cb, checked) {
    cb.checked = !!checked;
    const slider = cb.nextElementSibling; // .toggle-slider span
    if (!slider) return;
    if (checked) {
      slider.style.backgroundColor = 'var(--accent-blue)';
      slider.style.boxShadow = '0 0 8px rgba(0,243,255,0.6)'; // Parlama efekti eklendi!
      const circle = slider.querySelector('.toggle-circle');
      if (circle) circle.style.transform = 'translateX(14px)';
    } else {
      slider.style.backgroundColor = 'var(--bg-tertiary)';
      slider.style.boxShadow = 'none'; // Kapalıyken gölge yok
      const circle = slider.querySelector('.toggle-circle');
      if (circle) circle.style.transform = 'translateX(0)';
    }
  }

  // ── Bridge: timezone change from app.js ───────────────────────
  EventBus.on('timezone:change', ({ tz }) => {
    const tzToOffset = {
      'Etc/UTC': 'UTC',
      'Europe/Istanbul': 'UTC+3 Istanbul',
      'America/New_York': 'UTC-4 New York',
      'Europe/London': 'UTC+1 London',
      'Asia/Tokyo': 'UTC+9 Tokyo',
      'Asia/Ashgabat': 'UTC+5 Ashkabat',
      'America/Chicago': 'UTC-5 Chicago'
    };
    const mappedTz = tzToOffset[tz] || tz;
    pm.panes.forEach(p => {
      if (p.timezone !== mappedTz) {
        p.timezone = mappedTz;
        if (p.chart) {
            p.chart.applyOptions({
              localization: { timeFormatter: (t) => t ? p._formatTimezone(t) : '' }
            });
        }
      }
    });
  });

  // ── Bridge: timezone change from chart settings modal ─────────
  EventBus.on('settings:apply', ({ paneIdx, settings }) => {
    if (settings && settings.timezone) {
      const offsetToTz = {
         'UTC': 'Etc/UTC',
         'UTC+3 Istanbul': 'Europe/Istanbul',
         'UTC-4 New York': 'America/New_York',
         'UTC+1 London': 'Europe/London',
         'UTC+9 Tokyo': 'Asia/Tokyo',
         'UTC+5 Ashkabat': 'Asia/Ashgabat',
         'UTC-5 Chicago': 'America/Chicago'
      };
      const iana = offsetToTz[settings.timezone] || settings.timezone;
      if (window.State) State.set('timezone', iana, true); // silent set
      localStorage.setItem('pintrade_tz', iana);
      
      const menuMatch = document.querySelector(`.rsb-tz-item[data-tz="${iana}"]`);
      if (menuMatch) {
         document.querySelectorAll('.rsb-tz-item').forEach(el => el.classList.remove('active'));
         menuMatch.classList.add('active');
         const txt = menuMatch.textContent;
         const offset = txt.match(/\(UTC[^)]*\)/)?.[0]?.replace('(','')?.replace(')','');
         const clockTz = document.getElementById('rsb-clock-tz');
         if (clockTz) clockTz.textContent = offset || 'UTC';
      }
    }
  });

  // Restore saved layout from State (F5 persistence)
  let savedLayout = '1';
  if (typeof State !== 'undefined') {
    const ls = State.get('chartLayout');
    savedLayout = (ls && LAYOUTS[ls]) ? ls : '1';
  }
  
  pm.applyLayout(savedLayout);

  // Fix: Save all individual pane states on page refresh/close so TF and symbols are kept
  window.addEventListener('beforeunload', () => {
    pm.panes.forEach(p => { pm.savedStates[p.idx] = p.getState(); });
    if (typeof State !== 'undefined') {
      State.set('paneStates', pm.savedStates, true);
    }
  });

  console.log('[PinTrade] Chart system ready.');
  
  // F5/Light mode senkronizasyonu için tüm paneller çizildikten sonra global temayı tetikle
  setTimeout(() => {
     if (window.EventBus && typeof State !== 'undefined' && State.get('theme')) {
         window.EventBus.emit('theme:change', { theme: State.get('theme') });
     }
  }, 100);
};
