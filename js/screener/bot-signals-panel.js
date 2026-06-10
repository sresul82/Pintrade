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
  let _chartOpen = true;          // grafik baslangicta acik
  let _extraContainers = [];      // Floating panel gibi ek render hedefleri

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
          EventBus.emit('symbol:change', { symbol: sym + 'USDT', exchange: ExchangeRouter.getActive() });
          render();
          return;
        }

        // 2) Chart titlebar toggle
        if (e.target.closest('#bsp-chart-titlebar')) {
          _chartOpen = !_chartOpen;
          const section = document.getElementById('bsp-chart-section');
          const arrow   = document.getElementById('bsp-chart-arrow');
          if (section) section.style.maxHeight = _chartOpen ? '200px' : '0';
          if (arrow)   arrow.style.transform   = _chartOpen ? 'rotate(0deg)' : 'rotate(-90deg)';
          return; // render() cagirma - sadece DOM guncelle
        }

        // 3) Button clickleri
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
    if (typeof scalpFRMonitor_bybit !== 'undefined') {
      scalpFRMonitor_bybit.maxSignals = 5000;
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
          height: 160px;
          padding: 8px 10px;
          background: var(--bg-primary);
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

  let _renderTimer = null;
  function render() {
    if (_renderTimer) clearTimeout(_renderTimer);
    _renderTimer = setTimeout(_renderSync, 50);
  }

  function _renderSync() {
    // Tum hedef container'lari topla
    const _allContainers = [
      document.getElementById('dp-signals-tab'),
      ..._extraContainers
    ].filter(Boolean);

    if (_allContainers.length === 0) return;

    // Clean up previous chart instance
    if (_chartInstance) {
      _chartInstance.destroy();
      _chartInstance = null;
    }

    // Reset container style for custom layout
    _allContainers.forEach(container => {
      container.style.padding = '0';
      container.style.textAlign = 'left';
    });

    if (typeof scalpFRMonitor === 'undefined') {
      _allContainers.forEach(container => {
        container.innerHTML = `
          <div style="padding:16px; text-align:center; color:var(--text-secondary); font-size:12px;">
            ScalpFR monitor çalışmıyor.
          </div>`;
      });
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
      _allContainers.forEach(c => { c.innerHTML = html; });
      return;
    }

    // Sinyaller her zaman son 24 saat için saklanır (UI filtresi kaldırıldı)
    const maxAge = 24 * 60 * 60 * 1000;
    const cutoff = Date.now() - maxAge;

    const mainExchange = _coinFilter === 'selected'
      ? ExchangeRouter.getActive()
      : 'binance';
    const altExchange = ExchangeRouter.getOpposite(mainExchange);

    const mainMonitor = ExchangeRouter.getMonitor(mainExchange);
    const altMonitor = ExchangeRouter.getMonitor(altExchange);

    // Combine signals from both monitors for the list
    const mainListSignals = mainMonitor ? mainMonitor.getSignals(5000) : [];
    // Only show main exchange signals in the list below to avoid interleaving and confusion
    const allSignals = [...mainListSignals];

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
    let mainSignals = [];
    let altSignals = [];
    if (_coinFilter === 'selected' && _selectedSymbol) {
      const mainTracker = window[`frTracker_${mainExchange}`];
      const altTracker = window[`frTracker_${altExchange}`];

      mainSignals = (mainTracker?.getHistory(_selectedSymbol + 'USDT') || [])
        .map(h => ({ timestamp: h.timestamp, currentFR: h.value }))
        .sort((a, b) => a.timestamp - b.timestamp);

      altSignals = (altTracker?.getHistory(_selectedSymbol + 'USDT') || [])
        .map(h => ({ timestamp: h.timestamp, currentFR: h.value }))
        .sort((a, b) => a.timestamp - b.timestamp);

      const hasAltData = altSignals.length > 0;

      if (mainSignals.length > 0 || hasAltData) {
        hasChart = true;
        html += `
          <div id="bsp-chart-titlebar" style="
            display:flex; align-items:center; justify-content:space-between;
            padding:5px 10px; cursor:pointer; user-select:none;
            background:var(--bg-secondary);
            border-bottom:0.5px solid var(--border-primary);
          ">
            <span style="font-size:10px; font-weight:600; color:var(--text-primary);">
              ${_selectedSymbol} FR — <span style="color:#f0b90b">${mainExchange.toUpperCase()}</span>${hasAltData ? ` <span style="color:var(--text-secondary)">+</span> <span style="color:#7b61ff">${altExchange.toUpperCase()}</span>` : ''}
            </span>
            <span id="bsp-chart-arrow" style="
              font-size:10px; color:var(--text-secondary);
              display:inline-block;
              transform: ${_chartOpen ? 'rotate(0deg)' : 'rotate(-90deg)'};
              transition: transform 0.22s ease;
            ">▼</span>
          </div>
          <div id="bsp-chart-section" style="
            overflow:hidden;
            max-height:${_chartOpen ? '200px' : '0'};
            transition: max-height 0.28s ease;
            border-bottom:0.5px solid var(--border-primary);
          ">
            <div class="bsp-chart-container">
              <canvas id="bsp-mini-chart"></canvas>
            </div>
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
          <span style="font-size:10px; opacity:0.6;">${mainMonitor?.windows?.size || 0} aktif pencere izleniyor</span>
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
        let remainingText = '-';
        const sigExchange = sig.exchange || 'binance';
        const nextFT = window.fundingIntervalManager?.getNextFundingTime(sig.symbol, sigExchange);
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
    
    // Her hedef container'a ayni HTML'i yaz
    _allContainers.forEach(c => { c.innerHTML = html; });

    // Chart sadece birinciye render edilir (ana panel)
    const container = _allContainers[0];

    // ── 7. Render Mini Chart ─────────────────────────
    if (hasChart) {
      const canvas = container.querySelector('#bsp-mini-chart');
      const ctx = canvas?.getContext('2d');
      if (ctx) {
        // Determine theme variables for chart
        const gridColor = getComputedStyle(document.documentElement).getPropertyValue('--border-primary').trim() || '#2a2e39';
        const textColor = getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim() || '#787b86';
        
        const signalGreen = getComputedStyle(document.documentElement).getPropertyValue('--signal-color-green').trim() || '#0d9488';
        const signalRed = getComputedStyle(document.documentElement).getPropertyValue('--signal-color-red').trim() || '#dc2626';

        const hasAltData = altSignals.length > 0;
        const datasets = [
          {
            label: mainExchange.charAt(0).toUpperCase() + mainExchange.slice(1),
            data:  mainSignals.map(s => ({ x: s.timestamp, y: s.currentFR })),
            borderColor:          '#f0b90b',   // sarı — ana
            backgroundColor:      'transparent',
            borderWidth:          1.5,
            pointBackgroundColor: mainSignals.map((s, i) => {
              if (i === 0) return signalGreen;
              return (mainSignals[i-1].currentFR - s.currentFR) > 0 ? signalGreen : signalRed;
            }),
            pointBorderColor: mainSignals.map((s, i) => {
              if (i === 0) return signalGreen;
              return (mainSignals[i-1].currentFR - s.currentFR) > 0 ? signalGreen : signalRed;
            }),
            pointStyle:  'triangle',
            pointRadius: 4,
            tension:     0.2,
            fill:        false,
          }
        ];

        if (hasAltData) {
          datasets.push({
            label: altExchange.charAt(0).toUpperCase() + altExchange.slice(1),
            data:  altSignals.map(s => ({ x: s.timestamp, y: s.currentFR })),
            borderColor:          '#7b61ff',   // mor — karşı exchange
            backgroundColor:      'transparent',
            borderWidth:          1.5,
            borderDash:           [4, 3],      // Chart.js 4.x için
            segment: {
              borderDash: () => [4, 3],        // Chart.js 3.x için fallback
            },
            pointBackgroundColor: altSignals.map((s, i) => {
              if (i === 0) return signalGreen;
              return (altSignals[i-1].currentFR - s.currentFR) > 0 ? signalGreen : signalRed;
            }),
            pointBorderColor: altSignals.map((s, i) => {
              if (i === 0) return signalGreen;
              return (altSignals[i-1].currentFR - s.currentFR) > 0 ? signalGreen : signalRed;
            }),
            pointStyle:  'circle',
            pointRadius: 3,
            tension:     0.2,
            fill:        false,
          });
        }

        _chartInstance = new Chart(ctx, {
          type: 'line',
          data: {
            datasets
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            plugins: {
              legend: {
                display: hasAltData,
                labels: {
                  font:      { size: 10 },
                  color:     textColor,
                  boxWidth:  12,
                  boxHeight: 2,
                }
              },
              tooltip: {
                mode: 'index',
                intersect: false,
                callbacks: {
                  title: (context) => {
                    if (!context || !context.length) return '';
                    const d = new Date(context[0].parsed.x);
                    return isNaN(d.getTime()) ? '' : d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                  },
                  label: ctx => ' ' + ctx.dataset.label + ': ' + ctx.parsed.y.toFixed(4) + '%'
                }
              }
            },
            scales: {
              x: {
                type: 'linear',
                grid: { color: gridColor },
                ticks: {
                  callback: (val) => {
                    const d = new Date(val);
                    // Geçerli timestamp değilse boş döndür
                    if (isNaN(d.getTime())) return '';
                    return d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
                  },
                  maxTicksLimit: 6,
                  color: textColor,
                  font: { size: 9 },
                },
                // Min/max otomatik hesaplansın — tüm datayı göster
                min: undefined,
                max: undefined,
              },
              y: {
                grid: { color: gridColor },
                ticks: {
                  color: textColor,
                  font: { size: 9 },
                  callback: v => v.toFixed(4) + '%'
                }
              }
            }
          }
        });
      }
    }

    // Auto-scroll logic based on _sortOrder
    _allContainers.forEach(c => {
        const listEl = c.querySelector('#bsp-signals-list');
        if (listEl) {
          if (_sortOrder === 'desc') {
            listEl.scrollTop = 0; // Yeni sinyaller ustte, en uste git
          } else {
            listEl.scrollTop = listEl.scrollHeight; // Yeni sinyaller altta, en alta git
          }
        }
    });

    // Floating panel açıksa sync et
    if (window.FloatingPanel) FloatingPanel.onPanelRender();
  }

  function addContainer(el) {
    if (el && !_extraContainers.includes(el)) {
      _extraContainers.push(el);
      render(); // Hemen guncelle
    }
  }

  function removeContainer(el) {
    _extraContainers = _extraContainers.filter(c => c !== el);
  }

  return { init, render, addContainer, removeContainer };
})();

window.BotSignalsPanel = BotSignalsPanel;
