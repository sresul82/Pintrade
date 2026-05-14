class PaneManager {
  constructor(rootEl) {
    this.root       = rootEl;
    this.panes      = [];      // active ChartPane instances
    // Fix: Load saved pane configs (TF, symbol, etc) from State
    this.savedStates = (typeof State !== 'undefined' ? State.get('paneStates') : null) || {};
    this.activeIdx  = 0;
    this.layoutKey  = '1';

    EventBus.on('pane:activate', ({ idx }) => this._setActive(idx));
  }

  // ── Apply layout ──────────────────────────────────────────
  applyLayout(key) {
    // Save all current states
    this.panes.forEach(p => { this.savedStates[p.idx] = p.getState(); });

    // Destroy existing panes
    this.panes.forEach(p => p.destroy());
    this.panes    = [];
    this.root.innerHTML = '';
    this.layoutKey = key;

    const cfg = LAYOUTS[key];
    this.root.style.gridTemplateColumns = `repeat(${cfg.cols}, 1fr)`;
    this.root.style.gridTemplateRows    = `repeat(${cfg.rows}, 1fr)`;
    this.root.style.gap = cfg.count > 1 ? '3px' : '0';

    // Eğer sembol senkronizasyonu genel olarak açıksa, yeni açılan tüm ekranların aktif sembol ile başlamasını garantile
    const syncActiveSym = (window.SyncManagerInstance && window.SyncManagerInstance.opts.symbol) 
                            ? (State.get('activeSymbol') || 'BTCUSDT') 
                            : null;

    for (let i = 0; i < cfg.count; i++) {
      const sState = this.savedStates[i] ?? {};

      // ── Normalize any saved symbol: strip ".P" perpetual suffix ─────
      if (sState.symbol) {
        sState.symbol = sState.symbol.replace(/\.P$/i, '').replace(/USDT\.P$/i, 'USDT');
      }

      if (syncActiveSym && !sState.symbol) {
        sState.symbol = syncActiveSym;
      } else if (!sState.symbol && i === 0) {
        sState.symbol = State.get('activeSymbol') || 'BTCUSDT';
      }
      
      // Global timezone injection on start
      if (!sState.timezone) {
         const savedTzIana = localStorage.getItem('pintrade_tz') || 'Etc/UTC';
         const tzToOffset = {
           'Etc/UTC': 'UTC',
           'Europe/Istanbul': 'UTC+3 Istanbul',
           'America/New_York': 'UTC-4 New York',
           'Europe/London': 'UTC+1 London',
           'Asia/Tokyo': 'UTC+9 Tokyo',
           'Asia/Ashgabat': 'UTC+5 Ashkabat',
           'America/Chicago': 'UTC-5 Chicago'
         };
         sState.timezone = tzToOffset[savedTzIana] || 'UTC';
      }

      // Timeframe fallback & sync injection on start
      const syncActiveTf = (window.SyncManagerInstance && window.SyncManagerInstance.opts.interval)
                            ? (State.get('activeTf') || '1H')
                            : null;
      if (syncActiveTf && !sState.tf) {
        sState.tf = syncActiveTf;
      } else if (!sState.tf && i === 0) {
        sState.tf = State.get('activeTf') || '1H';
      }

      const pane = new ChartPane(i, sState);
      this.panes.push(pane);
      this.root.appendChild(pane.wrap);
    }

    if (this.panes.length) this._setActive(0);

    // Build resize handles after layout paint
    requestAnimationFrame(() => this._buildHandles());
  }

  // ── Active pane ───────────────────────────────────────────
  _setActive(idx) {
    this.activeIdx = idx;
    this.panes.forEach(p => p.wrap.classList.toggle('pane-active', p.idx === idx));
    
    // Update global top nav icon
    const active = this.getActivePane();
    if (active) {
      const navBtn = document.getElementById('nav-chart-type');
      if (navBtn) navBtn.innerHTML = ICONS[active.chartType] ?? ICONS.candle;
      
      const navTfBtn = document.getElementById('nav-tf');
      if (navTfBtn) navTfBtn.textContent = active.tf;
      
      // Navbar menüsü vb. gibi app.js tarafındaki componentleri güncelle
      EventBus.emit('pane:activated', { tf: active.tf, chartType: active.chartType });
    }
  }

  getActivePane() {
    return this.panes[this.activeIdx] ?? this.panes[0];
  }

  // ── Resize handles ────────────────────────────────────────
  _buildHandles() {
    document.querySelectorAll('.resize-handle').forEach(h => h.remove());
    const cfg = LAYOUTS[this.layoutKey];
    if (cfg.cols < 2) return;

    for (let row = 0; row < cfg.rows; row++) {
      for (let col = 0; col < cfg.cols - 1; col++) {
        const pane = this.panes[row * cfg.cols + col];
        if (!pane) continue;
        const handle = document.createElement('div');
        handle.className = 'resize-handle';
        document.body.appendChild(handle);
        this._positionHandle(handle, pane);
        this._bindHandle(handle, col, cfg);
      }
    }
  }

  _positionHandle(handle, pane) {
    const r = pane.wrap.getBoundingClientRect();
    handle.style.cssText = `
      position:fixed;
      left:${r.right}px; /* Tam olarak boşluğun başladığı sağ sınıra oturtuyoruz */
      top:${r.top}px;
      height:${r.height}px;
      width:3px;
    `;
  }

  _bindHandle(handle, col, cfg) {
    let startX, startWidths;

    handle.addEventListener('mousedown', e => {
      e.preventDefault();
      handle.classList.add('dragging');
      startX = e.clientX;
      startWidths = this.panes
        .filter((_, i) => i < cfg.cols)
        .map(p => p.wrap.offsetWidth);

      const onMove = ev => {
        const dx = ev.clientX - startX;
        const widths = [...startWidths];
        widths[col]     = Math.max(80, startWidths[col]     + dx);
        widths[col + 1] = Math.max(80, startWidths[col + 1] - dx);
        this.root.style.gridTemplateColumns = widths.map(w => w + 'px').join(' ');
        this.panes.forEach(p => p.resize());
        this._buildHandles();
      };

      const onUp = () => {
        handle.classList.remove('dragging');
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup',   onUp);
      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup',   onUp);
    });
  }

  refreshHandles() {
    this._buildHandles();
    this.panes.forEach(p => p.resize());
  }
}

/* --- sync-manager.js --- */
// ── Sync Manager — inter-pane synchronization ───────────────

class SyncManager {
  constructor(paneManager) {
    this.pm = paneManager;

    // ── Default sync state ─────────────────────────────────
    this.opts = {
      symbol:    true,
      interval:  false,
      crosshair: true,
      time:      false,
      dateRange: false,
      chartType: false,
    };

    this._subscribe();
  }

  // ── Set individual sync option ─────────────────────────────
  set(key, value) { this.opts[key] = value; }

  // ── Subscriptions ──────────────────────────────────────────
  _subscribe() {
    // Crosshair synchronization
    // Fix: Use hasPoint (not time) to decide when to clear crosshair.
    // In CrosshairMode.Normal, param.time is undefined between bars even when the
    // mouse is still on the chart — causing rapid clear/set oscillation (the "zip").
    // hasPoint=true means mouse IS on chart canvas; only clear when hasPoint=false.
    let _crosshairRaf = null;
    EventBus.on('crosshair:move', ({ sourceIdx, time, hasPoint }) => {
      if (!this.opts.crosshair) return;
      if (_crosshairRaf) cancelAnimationFrame(_crosshairRaf);
      _crosshairRaf = requestAnimationFrame(() => {
        _crosshairRaf = null;
        this.pm.panes.forEach(p => {
          if (p.idx === sourceIdx) return;
          if (!hasPoint) {
            // Mouse left the chart area entirely — clear crosshair in other panes
            try { if (p.chart) p.chart.clearCrosshairPosition(); } catch(e) {}
          } else if (time) {
            // Mouse is on the chart and on a bar — sync position
            p.syncCrosshair(time);
          }
          // else: hasPoint=true but time=undefined → mouse between bars, keep last position
        });
      });
    });

    // Time range synchronization
    EventBus.on('range:change', ({ sourceIdx, range }) => {
      if (!this.opts.time && !this.opts.dateRange) return;
      if (!range) return;
      this.pm.panes.forEach(p => {
        if (p.idx === sourceIdx) return;
        p.syncRange(range);
      });
    });

    // Symbol synchronization
    EventBus.on('symbol:change', ({ sourceIdx, symbol }) => {
      if (sourceIdx === undefined) return; // Handled by initChartCore bridge above
      const sourcePm = this.pm.panes.find(p => p.idx === sourceIdx);
      if (sourcePm) sourcePm.setSymbol(symbol);

      if (!this.opts.symbol) return;
      this.pm.panes.forEach(p => {
        if (p.idx === sourceIdx) return;
        p.setSymbol(symbol);
      });
    });

    // Timeframe synchronization
    EventBus.on('tf:change', ({ sourceIdx, tf }) => {
      // If no sourceIdx, this is a navbar emit handled by app.js bridge — skip
      if (sourceIdx === undefined) return;

      const sourcePm = this.pm.panes.find(p => p.idx === sourceIdx);
      if (sourcePm) sourcePm.setTF(tf);

      if (!this.opts.interval) return;
      this.pm.panes.forEach(p => {
        if (p.idx === sourceIdx) return;
        p.setTF(tf);
      });
    });

    // Chart Type synchronization
    EventBus.on('type:change', ({ sourceIdx, type }) => {
      const sourcePm = this.pm.panes.find(p => p.idx === sourceIdx);
      if (sourcePm) sourcePm.setChartType(type);

      if (!this.opts.chartType) return;
      this.pm.panes.forEach(p => {
        if (p.idx === sourceIdx) return;
        p.setChartType(type);
      });
    });
  }
}

