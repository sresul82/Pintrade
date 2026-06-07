/**
 * BotSignalsPanel Module
 * Handles UI, filtering, and chart for the Bot Signals tab.
 */
const BotSignalsPanel = (() => {
  // State
  let _activeBot = 'fr';          // 'fr' | 'm1hammer' | 'm1a' | 'v3' | '4s'
  let _activeFilter = '24s';      // '24s' | '3g' | '7g' | '30g'
  let _coinFilter = 'all';        // 'selected' | 'all'
  let _selectedSymbol = null;     // Symbol stripped of USDT suffix
  let _chartInstance = null;      // Chart.js instance for the mini graph
  let _sortOrder = 'desc';        // 'desc' = yeni yukari | 'asc' = yeni asagi

  const BOT_TABS = [
    { id: 'fr',        label: 'FR' },
    { id: 'm1hammer',  label: 'M1 Hammer' },
    { id: 'm1a',       label: 'M1-A' },
    { id: 'v3',        label: 'V3' },
    { id: '4s',        label: '4S' },
  ];

  // Public API
  function init() {
    // Set initial selected symbol
    const active = State.get('activeSymbol') || 'BTC';
    _selectedSymbol = active.replace(/USDT$/, '');

    // Listen for symbol changes
    EventBus.on('symbol:change', ({ symbol }) => {
      if (symbol) {
        _selectedSymbol = symbol.replace(/USDT$/, '');
        render();
      }
    });

    // Event delegation for our control buttons in the signals tab container
    const container = document.getElementById('dp-signals-tab');
    if (container) {
      container.addEventListener('click', (e) => {
        // Ticker link click → select coin, open chart, switch to Seçili Coin
        const tickerLink = e.target.closest('.bsp-ticker-link');
        if (tickerLink) {
          const sym = tickerLink.dataset.symbol; // e.g. 'BABY'
          _selectedSymbol = sym;
          _coinFilter = 'selected';
          EventBus.emit('symbol:change', { symbol: sym + 'USDT', exchange: 'binance' });
          render();
          return;
        }

        const btn = e.target.closest('button');
        if (!btn) return;

        if (btn.classList.contains('bsp-tab-btn')) {
          _activeBot = btn.dataset.bot;
          render();
        } else if (btn.classList.contains('bsp-filter-btn-time')) {
          _activeFilter = btn.dataset.filter;
          render();
        } else if (btn.classList.contains('bsp-filter-btn-coin')) {
          _coinFilter = btn.dataset.filter;
          render();
        } else if (btn.classList.contains('bsp-sort-btn')) {
          _sortOrder = _sortOrder === 'desc' ? 'asc' : 'desc';
          render();
        }
      });
    }

    // Increase max signals limit from default 200 to 5000 to keep all 24h signals
    if (typeof scalpFRMonitor !== 'undefined') {
      scalpFRMonitor.maxSignals = 5000;
    }

    // Insert styles dynamically
    if (!document.getElementById('bsp-styles')) {
      const style = document.createElement('style');
      style.id = 'bsp-styles';
      style.textContent = `
        .bsp-container {
          display: flex;
          flex-direction: column;
          height: 100%;
          font-family: var(--font-sans, 'Inter', sans-serif);
        }
        .bsp-header-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 6px 10px;
          border-bottom: 1px solid var(--border-primary);
          background: var(--bg-secondary);
        }
        .bsp-bot-tabs {
          display: flex;
          gap: 4px;
        }
        .bsp-tab-btn {
          width: 65px;
          padding: 5px 0;
          font-size: 10px;
          font-weight: 600;
          border: 1px solid var(--border-primary);
          background: var(--bg-tertiary);
          color: var(--text-active);
          border-radius: var(--radius-sm, 4px);
          cursor: pointer;
          transition: all 0.2s ease;
          text-align: center;
        }
        .bsp-tab-btn:hover {
          background: var(--bg-hover);
          color: var(--text-active);
        }
        .bsp-tab-btn.active {
          background: var(--accent-blue-bg, rgba(9, 105, 218, 0.1));
          color: var(--accent-blue, #0969da);
          border-color: var(--accent-blue, #0969da);
        }
        .bsp-stacked-filters {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }
        .bsp-stacked-btn {
          padding: 2px 6px;
          font-size: 8px;
          font-weight: 600;
          border: 1px solid var(--border-primary);
          background: var(--bg-tertiary);
          color: var(--text-active);
          border-radius: 3px;
          cursor: pointer;
          text-align: center;
          transition: all 0.15s ease;
        }
        .bsp-stacked-btn:hover {
          background: var(--bg-hover);
          color: var(--text-active);
        }
        .bsp-stacked-btn.active {
          background: var(--text-primary);
          color: var(--bg-primary);
          border-color: var(--text-primary);
        }
        .bsp-filters-row {
          display: flex;
          align-items: center;
          padding: 6px 10px;
          border-bottom: 1px solid var(--border-primary);
          background: var(--bg-secondary);
        }
        .bsp-filter-group {
          display: flex;
          gap: 3px;
        }
        .bsp-filter-btn {
          padding: 3px 6px;
          font-size: 9px;
          font-weight: 500;
          border: 1px solid var(--border-primary);
          background: var(--bg-tertiary);
          color: var(--text-active);
          border-radius: 3px;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .bsp-filter-btn:hover {
          background: var(--bg-hover);
          color: var(--text-active);
        }
        .bsp-filter-btn.active {
          background: var(--text-primary);
          color: var(--bg-primary);
          border-color: var(--text-primary);
        }
        .bsp-empty {
          padding: 32px 16px;
          text-align: center;
          color: var(--text-active);
          font-size: 11px;
        }
        .bsp-chart-container {
          padding: 8px 10px;
          background: var(--bg-primary);
          border-bottom: 1px solid var(--border-primary);
          height: 120px;
          position: relative;
        }
        .bsp-ticker-link:hover {
          color: var(--accent-blue, #3b82f6) !important;
          text-decoration-color: var(--accent-blue, #3b82f6) !important;
        }
        .bsp-sort-btn {
          width: 26px;
          height: 26px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          font-weight: 700;
          border: 1px solid var(--border-primary);
          background: var(--bg-tertiary);
          color: var(--text-active);
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.15s ease;
          flex-shrink: 0;
        }
        .bsp-sort-btn:hover {
          background: var(--bg-hover);
          color: var(--text-active);
          border-color: var(--accent-blue, #3b82f6);
        }
      `;
      document.head.appendChild(style);
    }

    render();
  }

  function render() {
    const container = document.getElementById('dp-signals-tab');
    if (!container) return;

    // Clean up previous chart instance
    if (_chartInstance) {
      _chartInstance.destroy();
      _chartInstance = null;
    }

    // Reset container style for custom layout
    container.style.padding = '0';
    container.style.textAlign = 'left';

    if (typeof scalpFRMonitor === 'undefined') {
      container.innerHTML = `
        <div style="padding:16px; text-align:center; color:var(--text-secondary); font-size:12px;">
          ScalpFR monitor çalışmıyor.
        </div>`;
      return;
    }

    // ── 1. Bot Tabs & Stacked Coin Filters ───────────
    let html = `<div class="bsp-container">`;
    html += `<div class="bsp-header-row">`;
    
    html += `<div class="bsp-bot-tabs">`;
    BOT_TABS.forEach(tab => {
      const activeClass = _activeBot === tab.id ? 'active' : '';
      html += `<button class="bsp-tab-btn ${activeClass}" data-bot="${tab.id}">${tab.label}</button>`;
    });
    html += `</div>`;

    // Sort toggle button (between bot tabs and stacked filters)
    const sortArrow = _sortOrder === 'desc' ? '↑' : '↓';
    const sortTitle = _sortOrder === 'desc' ? 'Yeni sinyaller yukarıda' : 'Yeni sinyaller aşağıda';
    html += `<button class="bsp-sort-btn" title="${sortTitle}">${sortArrow}</button>`;

    // Stacked Coin Filters
    html += `<div class="bsp-stacked-filters">`;
    [
      { id: 'selected', label: 'Seçili Coin' },
      { id: 'all',      label: 'Tüm Coinler' }
    ].forEach(f => {
      const activeClass = _coinFilter === f.id ? 'active' : '';
      html += `<button class="bsp-stacked-btn bsp-filter-btn-coin ${activeClass}" data-filter="${f.id}">${f.label}</button>`;
    });
    html += `</div>`;
    
    html += `</div>`; // .bsp-header-row



    // ── 3. Content Area ──────────────────────────────
    if (_activeBot !== 'fr') {
      html += `<div class="bsp-empty">Bu bot tipi henüz aktif değil.</div>`;
      html += `</div>`;
      container.innerHTML = html;
      return;
    }

    // Sinyaller her zaman son 24 saat için saklanır (UI filtresi kaldırıldı)
    const maxAge = 24 * 60 * 60 * 1000;
    const cutoff = Date.now() - maxAge;

    // Filter signals from scalpFRMonitor
    const allSignals = scalpFRMonitor.getSignals(5000);
    const signals = allSignals.filter(s => {
      if (s.timestamp < cutoff) return false;
      if (_coinFilter === 'selected' && _selectedSymbol) {
        const sigSym = s.symbol.replace(/USDT$/, '');
        if (sigSym !== _selectedSymbol) return false;
      }
      return true;
    });

    // Sort signals based on _sortOrder
    signals.sort((a, b) => _sortOrder === 'desc' ? b.timestamp - a.timestamp : a.timestamp - b.timestamp);

    // ── 4. Mini Chart (only for selected mode on 'fr' bot) ──
    let hasChart = false;
    if (_coinFilter === 'selected' && _selectedSymbol) {
      const tracker = window.frTrackerInstance;
      const history = tracker ? tracker.getHistory(_selectedSymbol + 'USDT') : [];
      const filteredHistory = history.filter(h => (Date.now() - h.timestamp) <= maxAge);

      if (filteredHistory.length > 0) {
        hasChart = true;
        html += `
          <div style="padding: 6px 10px; font-size:10px; font-weight:600; color:var(--text-primary); border-bottom:0.5px solid var(--border-primary);">
            ${_selectedSymbol} FR GEÇMİŞİ (son 24s)
          </div>
          <div class="bsp-chart-container">
            <canvas id="bsp-mini-chart"></canvas>
          </div>`;
      }
    }

    // ── 5. Column Headers ────────────────────────────
    html += `
      <div style="
        display:grid;
        grid-template-columns: 18px 72px 1fr 1fr 1fr 1fr 72px;
        font-size:10px;
        color: var(--text-active); font-weight:600;
        padding:6px 10px;
        border-bottom:1px solid var(--border-primary);
        gap:4px;
        background: var(--bg-secondary);
      ">
        <span></span>
        <span style="text-align:center;">Ticker</span>
        <span style="text-align:center;">Previous</span>
        <span style="text-align:center;">Current</span>
        <span style="text-align:center;">Delta</span>
        <span style="text-align:center;">Remaining</span>
        <span style="text-align:center;">Saat</span>
      </div>`;

    // ── 6. Signal Rows ───────────────────────────────
    if (!signals.length) {
      html += `
        <div style="padding:24px 16px; text-align:center; color: var(--text-active); font-size:12px;">
          Sinyal bekleniyor...<br>
          <span style="font-size:10px; opacity:0.6;">${scalpFRMonitor.windows.size} aktif pencere izleniyor</span>
        </div>`;
    } else {
      html += `<div id="bsp-signals-list" style="overflow-y:auto; max-height:calc(100vh - ${hasChart ? '460px' : '320px'}); flex:1;">`;

      signals.forEach(sig => {
        // Delta hesaplamasını kullanıcının mock-up formülüne göre yapıyoruz: Previous - Current
        const customDelta = sig.startFR - sig.currentFR;
        const isGreen = customDelta > 0;
        const isRed   = customDelta < 0;

        const accentColor = isGreen ? 'var(--signal-color-green)' : isRed ? 'var(--signal-color-red)' : 'var(--text-secondary)';
        const bgColor     = isGreen ? 'var(--signal-bg-green)' : isRed ? 'var(--signal-bg-red)' : 'transparent';
        const arrow       = isGreen ? '↑' : isRed ? '↓' : '─';
        const symDisplay  = sig.symbol.replace(/USDT$/, '');
        const displayDelta = (customDelta > 0 ? '+' : '') + customDelta.toFixed(4) + '%';

        // Remaining = bu coin icin bir sonraki FR odeme saatine kalan sure
        // Screener'dan o coine ait nextFundingTime'i al
        let remainingText = '—';
        const screenerRow = (typeof ScreenerCore !== 'undefined') ? ScreenerCore.getRow(sig.symbol) : null;
        const nextFT = screenerRow?.nextFundingTime;
        if (nextFT && nextFT > Date.now()) {
          const msLeft = nextFT - Date.now();
          const remH = Math.floor(msLeft / 3600000);
          const remM = Math.floor((msLeft % 3600000) / 60000);
          const remS = Math.floor((msLeft % 60000) / 1000);
          remainingText = `${String(remH).padStart(2,'0')}:${String(remM).padStart(2,'0')}:${String(remS).padStart(2,'0')}`;
        } else if (nextFT) {
          remainingText = '00:00:00';
        }

        // Opacity based on signal age
        const age = Date.now() - sig.timestamp;
        const opacity = age > 4 * 60 * 60 * 1000 ? 0.5 : 1;

        html += `
          <div style="
            display:grid;
            grid-template-columns: 18px 72px 1fr 1fr 1fr 1fr 72px;
            align-items:center;
            background:${bgColor};
            border-bottom:0.5px solid var(--border-primary);
            box-shadow:inset 3px 0 0 ${accentColor};
            padding:7px 10px;
            gap:4px;
            font-size:11px;
            opacity:${opacity};
          ">
            <span style="color:${accentColor}; font-size:13px; line-height:1; font-weight: bold;">${arrow}</span>
            <span class="bsp-ticker-link" data-symbol="${symDisplay}" style="color:var(--text-active); font-weight:600; cursor:pointer; text-decoration:underline; text-underline-offset:2px; text-decoration-color:rgba(255,255,255,0.25); transition:color 0.15s;" title="${symDisplay} grafiğini aç">${symDisplay}</span>
            <span style="color: var(--text-active); text-align:right;">${sig.display.startFR}</span>
            <span style="color:${accentColor}; text-align:right;">${sig.display.currentFR}</span>
            <span style="color:${accentColor}; font-weight:600; text-align:right;">${displayDelta}</span>
            <span style="color: var(--text-active); text-align:right;">${remainingText}</span>
            <span style="text-align:right; color: var(--text-active); font-size:10px;">${sig.display.time}</span>
          </div>`;
      });
      html += `</div>`;
    }

    // Footer
    html += `
      <div style="text-align:center; font-size:10px; color: var(--text-active); padding:6px; border-top:1px solid var(--border-primary); background: var(--bg-secondary);">
        son 24s · ${signals.length} sinyal
      </div>`;

    html += `</div>`; // bsp-container close
    container.innerHTML = html;

    // ── 7. Render Mini Chart ─────────────────────────
    if (hasChart) {
      const canvas = document.getElementById('bsp-mini-chart');
      const ctx = canvas?.getContext('2d');
      if (ctx) {
        const tracker = window.frTrackerInstance;
        const history = tracker ? tracker.getHistory(_selectedSymbol + 'USDT') : [];
        const filteredHistory = history.filter(h => (Date.now() - h.timestamp) <= maxAge);

        const labels = filteredHistory.map(h => new Date(h.timestamp).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }));
        const frValues = filteredHistory.map(h => h.value * 100);

        // Identify signals for point styles
        const signalPoints = frValues.map((val, idx) => {
          const entry = filteredHistory[idx];
          const hasSig = allSignals.some(s => Math.abs(s.timestamp - entry.timestamp) < 90000 && s.symbol.replace(/USDT$/, '') === _selectedSymbol);
          return hasSig ? val : null;
        });

        // Determine theme variables for chart
        const gridColor = getComputedStyle(document.documentElement).getPropertyValue('--border-primary').trim() || '#2a2e39';
        const textColor = getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim() || '#787b86';

        _chartInstance = new Chart(ctx, {
          data: {
            labels: labels,
            datasets: [
              {
                type: 'line',
                label: 'FR %',
                data: frValues,
                borderColor: 'var(--signal-color-green)',
                borderWidth: 1.5,
                pointRadius: 0,
                tension: 0.1,
                fill: false,
              },
              {
                type: 'bar',
                label: 'FR % Bar',
                data: frValues,
                backgroundColor: 'rgba(45, 212, 191, 0.15)',
                borderWidth: 0,
                barThickness: 'flex'
              },
              {
                type: 'scatter',
                label: 'Sinyaller',
                data: signalPoints,
                pointStyle: 'triangle',
                pointRadius: 6,
                pointHoverRadius: 8,
                pointBackgroundColor: function(context) {
                  const idx = context.dataIndex;
                  const entry = filteredHistory[idx];
                  if (!entry) return 'var(--text-secondary)';
                  const sig = allSignals.find(s => Math.abs(s.timestamp - entry.timestamp) < 90000 && s.symbol.replace(/USDT$/, '') === _selectedSymbol);
                  if (sig) {
                    const customDelta = sig.startFR - sig.currentFR;
                    return customDelta > 0 ? 'var(--signal-color-green)' : 'var(--signal-color-red)';
                  }
                  return 'var(--text-secondary)';
                },
                pointBorderColor: function(context) {
                  const idx = context.dataIndex;
                  const entry = filteredHistory[idx];
                  if (!entry) return 'var(--text-secondary)';
                  const sig = allSignals.find(s => Math.abs(s.timestamp - entry.timestamp) < 90000 && s.symbol.replace(/USDT$/, '') === _selectedSymbol);
                  if (sig) {
                    const customDelta = sig.startFR - sig.currentFR;
                    return customDelta > 0 ? 'var(--signal-color-green)' : 'var(--signal-color-red)';
                  }
                  return 'var(--text-secondary)';
                },
                pointRotation: function(context) {
                  const idx = context.dataIndex;
                  const entry = filteredHistory[idx];
                  if (!entry) return 0;
                  const sig = allSignals.find(s => Math.abs(s.timestamp - entry.timestamp) < 90000 && s.symbol.replace(/USDT$/, '') === _selectedSymbol);
                  if (sig) {
                    const customDelta = sig.startFR - sig.currentFR;
                    return customDelta > 0 ? 0 : 180; // Green points up (0), Red points down (180)
                  }
                  return 0;
                },
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: {
                mode: 'index',
                intersect: false,
                callbacks: {
                  label: function(context) {
                    return context.dataset.label + ': ' + context.parsed.y.toFixed(4) + '%';
                  }
                }
              }
            },
            scales: {
              x: {
                grid: { color: gridColor },
                ticks: { color: textColor, font: { size: 8 }, maxTicksLimit: 6 }
              },
              y: {
                grid: { color: gridColor },
                ticks: { color: textColor, font: { size: 8 } }
              }
            }
          }
        });
      }
    }

    // Auto-scroll logic based on _sortOrder
    const listEl = document.getElementById('bsp-signals-list');
    if (listEl) {
      if (_sortOrder === 'desc') {
        listEl.scrollTop = 0; // Yeni sinyaller ustte, en uste git
      } else {
        listEl.scrollTop = listEl.scrollHeight; // Yeni sinyaller altta, en alta git
      }
    }
  }

  return { init, render };
})();

window.BotSignalsPanel = BotSignalsPanel;
