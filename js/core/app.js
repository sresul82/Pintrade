/* ──────────────────────────────────────────────────────────
   app.js  —  Uygulama başlatıcı (chart'sız versiyon)
   Navbar, Sidebar toggle, Clock, Theme
────────────────────────────────────────────────────────── */

window.Toast = {
  show(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span style="font-size: 14px; margin-right: 6px;">${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}</span> ${message}`;
    
    container.appendChild(toast);
    
    // Trigger reflow for animation
    void toast.offsetWidth;
    toast.classList.add('show');
    
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(8px)';
      toast.addEventListener('transitionend', () => toast.remove());
    }, 3000);
  }
};

const App = {
  async init() {
    State.init();
    if (window.DrawingManager) window.DrawingManager.init();
    if (window.Sidebar) window.Sidebar.init();

    // ── FR Sistemi — sıra kritik, değiştirme ──
    if (window.FRDataBridge)    FRDataBridge.init();       // 1. önce bridge başlat
    if (window.bybitFRPoller)   bybitFRPoller.start();     // 2. bybit poller
    if (window.binanceFRPoller) binanceFRPoller.start();   // 3. binance poller

    // ── Visibility API — poller'ları arka planda yavaşlat ───────────
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        // Arka plan: FR poller'ları 2 dakikaya düşür
        window.bybitFRPoller?._setInterval(120000);
        window.binanceFRPoller?._setInterval(120000);
      } else {
        // Ön plan: normal hıza dön + hemen bir poll yap
        window.bybitFRPoller?._setInterval(60000);
        window.binanceFRPoller?._setInterval(60000);
        window.bybitFRPoller?._poll();
        window.binanceFRPoller?._poll();
      }
    });

    // Initialize chart if present
    if (window.initChartCore) {
      window.initChartCore();
      // Grafik container boyutlanmasi icin 1 frame bekle, sonra resize tetikle
      requestAnimationFrame(() => {
        if (window.LayoutManager) {
          window.LayoutManager.panes.forEach(p => p.resize && p.resize());
        }

        // ── Bridge: TF buttons → active pane ─────────────────────
        EventBus.on('tf:change', ({ tf }) => {
          if (!window.LayoutManager) return;
          // Only handle the bare {tf} call from navbar (no sourceIdx)
          const active = window.LayoutManager.getActivePane();
          if (active && typeof active.setTF === 'function') {
            active.setTF(tf);
          }
        });

        // ── Bridge: HTML sync toggles → SyncManager ──────────────
        const sm = window.SyncManagerInstance;
        if (sm) {
          document.querySelectorAll('.sync-row input[data-sync]').forEach(cb => {
            const key = cb.dataset.sync;
            if (!key || !(key in sm.opts)) return;

            const slider = cb.nextElementSibling;
            const circle = slider?.querySelector('.toggle-circle');

            const applyVisual = (checked) => {
              if (slider) slider.style.backgroundColor = checked ? 'var(--accent-teal)' : 'var(--bg-tertiary)';
              if (circle) {
                circle.style.transform     = checked ? 'translateX(14px)' : 'translateX(0px)';
                circle.style.backgroundColor = checked ? 'var(--bg-primary)' : 'var(--text-muted)';
              }
            };

            // Sync initial visual from SyncManager (source of truth)
            cb.checked = sm.opts[key];
            applyVisual(cb.checked);

            cb.addEventListener('change', () => {
              sm.set(key, cb.checked);
              applyVisual(cb.checked);
            });
          });
        }
      });
    }

    this._bindNavbar();
    this._bindSidebar();
    this._bindClock();
    this._bindTheme();
    this._bindSyncKey();

    EventBus.on('feed:price', data => {
      if (data.symbol === State.get('activeSymbol')) {
        const pSymbol = document.getElementById('cd-symbol');
        const pPrice  = document.getElementById('cd-price');
        
        if (pSymbol && pSymbol.textContent !== data.symbol) {
          pSymbol.textContent = data.symbol;
        }
        if (pPrice && typeof data.price === 'number') {
          pPrice.textContent = data.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 });
        }
      }
    });

    console.log('[App] Initialized — symbol:', State.get('activeSymbol'));
  },

  _bindNavbar() {
    // ── TF Dropdown ──────────────────────────────────
    const tfTrigger = document.getElementById('nb-tf-trigger');
    const tfMenu    = document.getElementById('nb-tf-menu');
    const tfCurrent = document.getElementById('nb-tf-current');
    const tfFavsBar = document.getElementById('nb-tf-favs');

    // Canonical order — favs always render in this sequence
    const TF_ORDER = ['1m','3m','5m','15m','30m','45m','1H','2H','3H','4H','6H','12H','1D','3D','1W','1M'];
    const DEFAULT_FAVS = ['5m','15m','1H','4H','1D'];
    let favTfs = JSON.parse(localStorage.getItem('perpetual_fav_tfs') || 'null') || [...DEFAULT_FAVS];

    const saveFavs = () => localStorage.setItem('perpetual_fav_tfs', JSON.stringify(favTfs));

    // Always sort favs by canonical TF_ORDER before rendering
    const sortedFavs = () => favTfs.slice().sort((a, b) => TF_ORDER.indexOf(a) - TF_ORDER.indexOf(b));

    const renderFavBar = () => {
      tfFavsBar.innerHTML = '';
      const activeTf = State.get('activeTf');
      sortedFavs().forEach(tf => {
        const btn = document.createElement('button');
        btn.className = 'nb-tf-fav-btn';
        btn.dataset.tf = tf;
        btn.textContent = tf;
        if (activeTf === tf) btn.classList.add('active');
        btn.addEventListener('click', () => selectTf(tf));
        tfFavsBar.appendChild(btn);
      });
    };

    const updateMenuActive = (tf) => {
      document.querySelectorAll('.nb-tf-item').forEach(b => {
        b.classList.toggle('active', b.dataset.tf === tf);
      });
    };

    const selectTf = (tf) => {
      if (tfCurrent) tfCurrent.textContent = tf;
      updateMenuActive(tf);
      document.querySelectorAll('.nb-tf-fav-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.tf === tf);
      });
      
      State.setTf(tf); // Her hâlükârda hafızaya (localStorage) kaydet!

      // Always apply to the active pane regardless of idx
      if (typeof LayoutManager !== 'undefined') {
        const active = LayoutManager.getActivePane();
        if (active) {
          active.setTF(tf);
          EventBus.emit('tf:change', { sourceIdx: active.idx, tf });
        }
      } else {
        EventBus.emit('tf:change', { tf });
      }
      closeTfMenu();
    };

    const openTfMenu  = () => { tfMenu.classList.add('open'); tfTrigger.classList.add('open'); };
    const closeTfMenu = () => { tfMenu.classList.remove('open'); tfTrigger.classList.remove('open'); };

    tfTrigger?.addEventListener('click', (e) => {
      e.stopPropagation();
      const wasOpen = tfMenu.classList.contains('open');
      // Close all other dropdowns
      document.querySelectorAll('.nb-dropdown-menu.open, .nb-dropdown-trigger.open, .nb-tf-menu.open, .nb-tf-trigger.open, #indicator-fav-menu.open').forEach(el => el.classList.remove('open'));
      if (!wasOpen) openTfMenu();
    });

    // Accordion toggle logic
    document.querySelectorAll('.nb-tf-acc-header').forEach(header => {
      header.addEventListener('click', (e) => {
        e.stopPropagation();
        const section = header.closest('.nb-tf-acc-section');
        if (section) section.classList.toggle('active');
      });
    });

    // Build star toggle + click on each TF item
    document.querySelectorAll('.nb-tf-item').forEach(btn => {
      const tf = btn.dataset.tf;

      if (favTfs.includes(tf)) btn.classList.add('fav');
      if (State.get('activeTf') === tf) btn.classList.add('active');

      const star = btn.querySelector('.tf-star');
      star.addEventListener('click', e => {
        e.stopPropagation();
        if (favTfs.includes(tf)) {
          favTfs = favTfs.filter(f => f !== tf);
          btn.classList.remove('fav');
        } else {
          favTfs.push(tf);
          btn.classList.add('fav');
        }
        saveFavs();
        renderFavBar();
      });

      btn.addEventListener('click', e => {
        if (e.target === star) return;
        selectTf(tf);
      });
    });

    // Init
    const initTf = State.get('activeTf') || '1H';
    if (tfCurrent) tfCurrent.textContent = initTf;
    updateMenuActive(initTf);
    renderFavBar();

    // ── Bridge: Sync navbar visuals when a different pane is clicked ──────
    EventBus.on('pane:activated', ({ tf, chartType }) => {
      if (tf) {
         if (tfCurrent) tfCurrent.textContent = tf;
         updateMenuActive(tf);
         document.querySelectorAll('.nb-tf-fav-btn').forEach(b => b.classList.toggle('active', b.dataset.tf === tf));
      }
    });

    // ── Candle Style Dropdown ────────────────────────
    const msTrigger  = document.getElementById('nb-ms-trigger');
    const msMenu     = document.getElementById('nb-ms-menu');
    const msCurrent  = document.getElementById('nb-ms-current');
    const msIcon     = document.getElementById('nb-ms-icon');
    const msFavsBar  = document.getElementById('nb-ms-favs');

    // Canonical style order
    const MS_ORDER = ['candlestick','heikinashi','hollow','volume','bar','line','area','baseline'];
    const DEFAULT_MS_FAVS = ['candlestick', 'heikinashi'];
    let favStyles = JSON.parse(localStorage.getItem('perpetual_fav_styles') || 'null') || [...DEFAULT_MS_FAVS];

    const saveMsFavs = () => localStorage.setItem('perpetual_fav_styles', JSON.stringify(favStyles));
    const sortedMsFavs = () => favStyles.slice().sort((a, b) => MS_ORDER.indexOf(a) - MS_ORDER.indexOf(b));

    const getMsMeta = (style) => {
      const el = document.querySelector(`.nb-ms-item[data-style="${style}"]`);
      if (!el) return { icon: '🕯', label: style };
      const iconSpan = el.querySelector('.nb-ms-item-icon');
      const icon = iconSpan ? iconSpan.innerHTML : (el.dataset.icon || '🕯');
      return { icon, label: el.dataset.label || style };
    };

    const renderMsFavBar = () => {
      const favsList = document.getElementById('nb-ms-favs');
      if (!favsList) return;
      favsList.innerHTML = '';
      favStyles.forEach(style => {
        const meta = getMsMeta(style);
        const btn = document.createElement('button');
        btn.className = 'nb-ms-fav-btn';
        if (style === State.get('candleStyle')) btn.classList.add('active');
        btn.dataset.style = style;
        btn.innerHTML = meta.icon; // SVG ekleneceği için innerHTML kullanıyoruz
        btn.title = meta.label;
        btn.addEventListener('click', () => selectStyle(style));
        favsList.appendChild(btn);
      });
    };

    const selectStyle = (style) => {
      const { icon, label } = getMsMeta(style);
      if (msCurrent) msCurrent.textContent = label;
      if (msIcon) msIcon.textContent = icon;
      document.querySelectorAll('.nb-ms-item').forEach(b => b.classList.toggle('active', b.dataset.style === style));
      document.querySelectorAll('.nb-ms-fav-btn').forEach(b => b.classList.toggle('active', b.dataset.style === style));
      State.set('candleStyle', style);
      EventBus.emit('chart:style:change', { style });
      closeMsMenu();
    };

    const openMsMenu  = () => { msMenu.classList.add('open'); msTrigger.classList.add('open'); };
    const closeMsMenu = () => { msMenu.classList.remove('open'); msTrigger.classList.remove('open'); };

    msTrigger?.addEventListener('click', e => {
      e.stopPropagation();
      const wasOpen = msMenu.classList.contains('open');
      document.querySelectorAll('.nb-dropdown-menu.open, .nb-dropdown-trigger.open, .nb-tf-menu.open, .nb-tf-trigger.open, #indicator-fav-menu.open').forEach(el => el.classList.remove('open'));
      if (!wasOpen) openMsMenu();
    });

    document.querySelectorAll('.nb-ms-item').forEach(btn => {
      const style = btn.dataset.style;
      if (favStyles.includes(style)) btn.classList.add('fav');
      if ((State.get('candleStyle') || 'candlestick') === style) btn.classList.add('active');

      btn.querySelector('.item-star')?.addEventListener('click', e => {
        e.stopPropagation();
        if (favStyles.includes(style)) {
          favStyles = favStyles.filter(f => f !== style);
          btn.classList.remove('fav');
        } else {
          favStyles.push(style);
          btn.classList.add('fav');
        }
        saveMsFavs();
        renderMsFavBar();
      });

      btn.addEventListener('click', e => {
        const star = btn.querySelector('.item-star');
        if (e.target === star) return;
        selectStyle(style);
      });
    });

    const initStyle = State.get('candleStyle') || 'candlestick';
    const initialMeta = getMsMeta(initStyle);
    if (msCurrent) msCurrent.textContent = initialMeta.label;
    if (msIcon) msIcon.innerHTML = initialMeta.icon;
    document.querySelectorAll('.nb-ms-item').forEach(b => b.classList.toggle('active', b.dataset.style === initStyle));
    renderMsFavBar();

    // ── Info Modals vb... ──────────────────────────────
    const lyTrigger = document.getElementById('nb-ly-trigger');
    const lyMenu    = document.getElementById('nb-ly-menu');
    const lyIcon = document.getElementById('nb-ly-icon');
    const lyCurrent = document.getElementById('nb-ly-current');

    const selectLayout = (layout, btnElement) => {
      if (lyCurrent) lyCurrent.style.display = 'none';
      const svg = btnElement.querySelector('svg');
      if (lyIcon && svg) lyIcon.innerHTML = svg.outerHTML;

      document.querySelectorAll('.ly-item').forEach(b => b.classList.toggle('active', b.dataset.layout === layout));
      State.setLayout(layout);      
      EventBus.emit('chart:layout:change', { layout });
      closeLyMenu();
    };

    const openLyMenu  = () => { lyMenu.classList.add('open'); lyTrigger.classList.add('open'); };
    const closeLyMenu = () => { lyMenu.classList.remove('open'); lyTrigger.classList.remove('open'); };

    lyTrigger?.addEventListener('click', e => {
      e.stopPropagation();
      const wasOpen = lyMenu.classList.contains('open');
      document.querySelectorAll('.nb-dropdown-menu.open, .nb-dropdown-trigger.open, .nb-tf-menu.open, .nb-tf-trigger.open, #indicator-fav-menu.open').forEach(el => el.classList.remove('open'));
      if (!wasOpen) openLyMenu();
    });

    // Default map old layouts to 1 if needed
    let currentLy = State.get('chartLayout') || '1';
    if (currentLy === '1.1') currentLy = '1'; // backward-compat

    document.querySelectorAll('.ly-item').forEach(btn => {
      if (currentLy === btn.dataset.layout) {
        btn.classList.add('active');
        // Başlangıçta da iconu navbar'a set et
        const svg = btn.querySelector('svg');
        if (lyIcon && svg) lyIcon.innerHTML = svg.outerHTML;
        if (lyCurrent) lyCurrent.style.display = 'none';
      }
      btn.addEventListener('click', () => selectLayout(btn.dataset.layout, btn));
    });

    // ── Global click-outside closes all dropdowns ────
    document.addEventListener('click', (e) => {
      // Eğer tıklanan yer dropdown'un ta kendisi veya trigger ise kapatma!
      if (e.target.closest('.nb-dropdown-menu') || e.target.closest('.nb-dropdown-trigger') || e.target.closest('.nb-tf-menu') || e.target.closest('.nb-tf-trigger') || e.target.closest('.ctx-menu') || e.target.closest('.nb-profile-dropdown')) {
        return;
      }
      document.querySelectorAll('.nb-dropdown-menu.open, .nb-dropdown-trigger.open, .nb-tf-menu.open, .nb-tf-trigger.open').forEach(el => el.classList.remove('open'));
      document.getElementById('nb-profile-menu')?.classList.remove('open');
      // Also close clock / TZ menu
      if (!e.target.closest('#rsb-tz-menu') && !e.target.closest('#rsb-clock-btn')) {
        document.getElementById('rsb-tz-menu')?.classList.remove('open');
      }
    });

    // Responsive Tools Menu toggle
    const respTrigger = document.getElementById('btn-responsive-tools');
    const respMenu = document.getElementById('nb-responsive-menu');
    respTrigger?.addEventListener('click', (e) => {
      e.stopPropagation();
      const wasOpen = respMenu?.classList.contains('open');
      document.querySelectorAll('.nb-dropdown-menu.open, .nb-dropdown-trigger.open, .nb-tf-menu.open, .nb-tf-trigger.open, #indicator-fav-menu.open').forEach(el => el.classList.remove('open'));
      if (!wasOpen) {
        respMenu?.classList.add('open');
        respTrigger.classList.add('open');
      }
    });

    // Indicators arrow dropdown
    const indArrow = document.getElementById('btn-indicators-arrow');
    const indMenu = document.getElementById('indicator-fav-menu');
    indArrow?.addEventListener('click', (e) => {
      e.stopPropagation();
      const wasOpen = indMenu?.classList.contains('open');
      document.querySelectorAll('.nb-dropdown-menu.open, .nb-dropdown-trigger.open, .nb-tf-menu.open, .nb-tf-trigger.open, #indicator-fav-menu.open').forEach(el => el.classList.remove('open'));
      if (!wasOpen) indMenu?.classList.add('open');
    });

    // Symbol search
    const symSearch = document.getElementById('nb-sym-search');
    if (symSearch) {
      symSearch.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
          const val = symSearch.value.trim().toUpperCase();
          if (val) {
            State.setSymbol(val);
            symSearch.placeholder = val;
            symSearch.value = '';
            symSearch.blur();
          }
        }
      });
      // Update placeholder from saved state on init
      const savedSym = State.get('activeSymbol');
      if (savedSym) symSearch.placeholder = savedSym;
    }

    // Profile Menu Toggle
    const btnMenu = document.getElementById('btn-menu');
    const profileMenu = document.getElementById('nb-profile-menu');
    btnMenu?.addEventListener('click', (e) => {
      e.stopPropagation();
      const wasOpen = profileMenu.classList.contains('open');
      document.querySelectorAll('.nb-dropdown-menu.open, .nb-dropdown-trigger.open, .nb-tf-menu.open, .nb-tf-trigger.open, #indicator-fav-menu.open').forEach(el => el.classList.remove('open'));
      if (!wasOpen) profileMenu.classList.add('open');
    });

    // Profile Menu Dark Theme Sync
    const profileThemeBtn = document.getElementById('btn-profile-theme');
    const profileThemeToggle = document.getElementById('profile-theme-toggle');
    const profileThemeSlider = document.getElementById('profile-theme-slider');
    const profileThemeCircle = document.getElementById('profile-theme-circle');
    
    const updateProfileThemeVisual = () => {
       const isDark = State.get('theme') !== 'light';
       if(profileThemeToggle) profileThemeToggle.checked = isDark;
       if(profileThemeSlider) profileThemeSlider.style.backgroundColor = isDark ? 'var(--accent-blue)' : 'var(--bg-tertiary)';
       if(profileThemeCircle) {
         profileThemeCircle.style.transform = isDark ? 'translateX(14px)' : 'translateX(0px)';
         profileThemeCircle.style.backgroundColor = isDark ? 'var(--bg-primary)' : 'var(--text-muted)';
       }
    };
    profileThemeBtn?.addEventListener('click', (e) => {
       e.stopPropagation();
       State.toggleTheme();
       updateProfileThemeVisual();
    });
    // Link to main theme button
    document.getElementById('btn-theme')?.addEventListener('click', () => {
      State.toggleTheme();
      updateProfileThemeVisual();
    });
    EventBus.on('theme:change', ({ theme }) => {
      const btn = document.getElementById('btn-theme');
      if (btn) btn.textContent = theme === 'dark' ? '☀' : '◑';
      updateProfileThemeVisual();
    });
    updateProfileThemeVisual();

    // Alarm button
    document.getElementById('btn-alarm')?.addEventListener('click', () => {
      EventBus.emit('modal:alarm:open');
    });

    // Snapshot
    document.getElementById('btn-snapshot')?.addEventListener('click', () => {
      EventBus.emit('chart:snapshot');
    });



    // Settings
    document.getElementById('btn-settings')?.addEventListener('click', () => {
      if (window.LayoutManager) {
        const activePane = window.LayoutManager.getActivePane();
        if (activePane) {
          EventBus.emit('settings:open', { pane: activePane, gearEl: document.getElementById('btn-settings') });
        }
      }
    });

    // Undo / Redo buttons
    document.getElementById('btn-undo')?.addEventListener('click', () => {
       if (window.DrawingManager && window.DrawingManager.undo) window.DrawingManager.undo();
    });
    document.getElementById('btn-redo')?.addEventListener('click', () => {
       if (window.DrawingManager && window.DrawingManager.redo) window.DrawingManager.redo();
    });

    // ── Navbar Veri Senkronizasyonu (Funding, OI, 24h) ──────
    const formatNbNum = (v) => {
      if (v == null) return '--';
      if (v >= 1e9) return (v / 1e9).toFixed(2) + 'B';
      if (v >= 1e6) return (v / 1e6).toFixed(2) + 'M';
      if (v >= 1e3) return (v / 1e3).toFixed(2) + 'K';
      return Math.round(v).toString();
    };
    const fmtRemaining = (ms) => {
      if (!ms || ms <= 0) return '...';
      const totalMins = Math.floor(ms / 60000);
      const hrs  = Math.floor(totalMins / 60);
      const mins = totalMins % 60;
      return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
    };

    // ── Screener satır verisinden Navbar DOM'u güncelle (sıfır HTTP) ────
    const _applyRowToNavbar = (row, exchange) => {
      const isBN = exchange.toLowerCase() === 'binance';
      const el  = (id) => document.getElementById(id);
      const set = (id, v) => { const e = el(id); if (e && v != null) e.textContent = v; };
      const col = (id, v, c) => { const e = el(id); if (e) { if (v != null) e.textContent = v; if (c) e.style.color = c; } };

      set('lbl-fr-pct',  isBN ? 'BN Fr(%)' : 'BB Fr(%)');
      set('lbl-fr-time', isBN ? 'BN Fr(h)' : 'BB Fr(h)');
      if (row.pct != null) {
        const chg = parseFloat(row.pct);
        col('cd-change', `${chg > 0 ? '+' : ''}${chg.toFixed(2)}%`,
          chg > 0 ? 'var(--accent-teal)' : chg < 0 ? 'var(--accent-red)' : 'var(--text-primary)');
      }
      if (row.vol != null) set('cd-vol', formatNbNum(row.vol));
      if (row.fr  != null) {
        const fr = parseFloat(row.fr) * 100;
        col('cd-fr-pct', `${fr.toFixed(4)}%`, fr > 0 ? 'var(--accent-red)' : 'var(--accent-teal)');
      }
      if (row.nextFundingTime) set('cd-fr-time', fmtRemaining(parseInt(row.nextFundingTime) - Date.now()));
      if (row.oi  != null) set('cd-oi', formatNbNum(row.oi));
    };

    // ── Önce screener'dan oku, bulunamazsa HTTP fallback ─────────────
    const fetchNavbarStats = async (symbol, exchange = 'binance') => {
      if (window.ScreenerCore) {
        const row = ScreenerCore.getRow(symbol);
        if (row) { _applyRowToNavbar(row, exchange); return; }
      }
      // Fallback: All sekmesi veya ilk açılış
      try {
        const sym = (symbol || '').replace(/\.P$/, '').replace(/USDT$/, '') + 'USDT';
        const isBN = exchange.toLowerCase() === 'binance';
        const el  = (id) => document.getElementById(id);
        const set = (id, v) => { const e = el(id); if (e && v != null) e.textContent = v; };
        const col = (id, v, c) => { const e = el(id); if (e) { if (v != null) e.textContent = v; if (c) e.style.color = c; } };
        set('lbl-fr-pct',  isBN ? 'BN Fr(%)' : 'BB Fr(%)');
        set('lbl-fr-time', isBN ? 'BN Fr(h)' : 'BB Fr(h)');
        if (isBN) {
          const [tickR, frR, oiR] = await Promise.all([
            fetch(`${AppConfig.API.binance.restFutures}/fapi/v1/ticker/24hr?symbol=${sym}`).catch(()=>null),
            fetch(`${AppConfig.API.binance.restFutures}/fapi/v1/premiumIndex?symbol=${sym}`).catch(()=>null),
            fetch(`${AppConfig.API.binance.restFutures}/fapi/v1/openInterest?symbol=${sym}`).catch(()=>null),
          ]);
          if (tickR?.ok) { const d = await tickR.json(); const chg = parseFloat(d.priceChangePercent); col('cd-change', `${chg>0?'+':''}${chg.toFixed(2)}%`, chg>0?'var(--accent-teal)':chg<0?'var(--accent-red)':'var(--text-primary)'); set('cd-vol', formatNbNum(parseFloat(d.quoteVolume))); }
          if (frR?.ok)   { const d = await frR.json(); if (d?.lastFundingRate!=null) { const fr=parseFloat(d.lastFundingRate)*100; col('cd-fr-pct',`${fr.toFixed(4)}%`,fr>0?'var(--accent-red)':'var(--accent-teal)'); if(d.nextFundingTime) set('cd-fr-time',fmtRemaining(parseInt(d.nextFundingTime)-Date.now())); } }
          if (oiR?.ok)   { const d = await oiR.json(); if (d?.openInterest) { const px=parseFloat(el('cd-price')?.textContent?.replace(/,/g,'')||'0')||1; set('cd-oi',formatNbNum(parseFloat(d.openInterest)*px)); } }
        } else {
          const r = await fetch(`https://api.bybit.com/v5/market/tickers?category=linear&symbol=${sym}`).catch(()=>null);
          if (r?.ok) { const d=await r.json(); const item=d?.result?.list?.[0]; if(item){const chg=parseFloat(item.price24hPcnt||'0')*100;col('cd-change',`${chg>0?'+':''}${chg.toFixed(2)}%`,chg>0?'var(--accent-teal)':chg<0?'var(--accent-red)':'var(--text-primary)');set('cd-vol',formatNbNum(parseFloat(item.turnover24h||'0')));const fr=parseFloat(item.fundingRate||'0')*100;col('cd-fr-pct',`${fr.toFixed(4)}%`,fr>0?'var(--accent-red)':'var(--accent-teal)');const ft=parseInt(item.nextFundingTime||'0');if(ft>Date.now())set('cd-fr-time',fmtRemaining(ft-Date.now()));set('cd-oi',formatNbNum(parseFloat(item.openInterestValue||'0')));} }
        }
      } catch(e) {}
    };

    let _lastExchange = 'binance';
    let _nbTickerInterval;
    EventBus.on('symbol:change', ({ symbol, exchange }) => {
        if (exchange) _lastExchange = exchange;
        if (_nbTickerInterval) clearInterval(_nbTickerInterval);
        fetchNavbarStats(symbol, _lastExchange);
        _nbTickerInterval = setInterval(() => fetchNavbarStats(symbol, _lastExchange), 30000);
    });

    const initialSym = State.get('activeSymbol');
    _lastExchange = State.get('activeExchange') || 'binance';
    if (initialSym) {
      fetchNavbarStats(initialSym, _lastExchange);
      _nbTickerInterval = setInterval(() => fetchNavbarStats(initialSym, _lastExchange), 30000);
    }
  },

  _bindTheme() {
    EventBus.on('theme:change', ({ theme }) => {
      const btn = document.getElementById('btn-theme');
      if (btn) btn.textContent = theme === 'dark' ? '☀' : '◑';
    });
  },

  _bindSyncKey() {
    const input = document.getElementById('sync-key-input');
    const btn = document.getElementById('btn-sync-key-save');
    const msg = document.getElementById('sync-status-msg');
    if (!input || !btn) return;

    // Load existing
    input.value = State.getSyncKey();

    btn.addEventListener('click', () => {
      const val = input.value.trim();
      State.setSyncKey(val);
      if (msg) {
        msg.style.display = 'block';
        msg.textContent = val ? 'Saved. Syncing...' : 'Cleared. Local mode.';
        setTimeout(() => msg.style.display = 'none', 3000);
      }
    });
  },

  _bindSidebar() {
    const btns = ['rsb-watchlist', 'rsb-alarms', 'rsb-news'];
    
    btns.forEach(id => {
      const btn = document.getElementById(id);
      if (!btn) return;
      btn.addEventListener('click', () => {
        const panel = document.getElementById('right-panel');
        const isCurrentlyOpen = panel?.classList.contains('open');
        const isCurrentlyActive = btn.classList.contains('active');
        
        if (isCurrentlyOpen && isCurrentlyActive) {
          // Close if clicking the already active tab
          State.set('watchlistOpen', false, true);
          EventBus.emit('watchlist:toggle', { open: false, tab: id });
        } else {
          // Open or switch tab without closing
          State.set('watchlistOpen', true, true);
          EventBus.emit('watchlist:toggle', { open: true, tab: id });
        }
      });
    });

    EventBus.on('watchlist:toggle', ({ open, tab }) => {
      const panel = document.getElementById('right-panel');
      panel?.classList.toggle('open', open);
      
      // Remove active from all
      btns.forEach(bId => {
        const b = document.getElementById(bId);
        if(b) b.classList.remove('active');
      });
      // Add active to the requested tab
      if (open && tab) {
        const activeBtn = document.getElementById(tab);
        if(activeBtn) activeBtn.classList.add('active');
        
        // Link to detail-panel tabs
        const detailTab = document.getElementById('dp-detail-tab');
        const signalsTab = document.getElementById('dp-signals-tab');
        const newsTab = document.getElementById('dp-news-tab');
        
        if (detailTab) detailTab.style.display = 'none';
        if (signalsTab) signalsTab.style.display = 'none';
        if (newsTab) newsTab.style.display = 'none';
        
        // Hide/Show Watchlist components based on active tab
        const wlEls = document.querySelectorAll('.wl-header, #wl-search, #wl-col-header, #wl-list, #detail-resize, .detail-tabs');
        const gnpPanel = document.getElementById('global-news-panel');
        const dpPanel  = document.getElementById('detail-panel');
        
        if (tab === 'rsb-watchlist') {
          wlEls.forEach(el => el.style.display = ''); // restore default
          if(dpPanel) {
            dpPanel.style.display = 'flex';
            dpPanel.style.flex = 'none'; // Revert to normal
            dpPanel.style.height = '40%'; // approximate original
            dpPanel.style.background = 'transparent';
          }
          if(gnpPanel) gnpPanel.style.display = 'none';
          if (detailTab) detailTab.style.display = 'block';
        } else if (tab === 'rsb-news') {
          wlEls.forEach(el => el.style.display = 'none');
          if(dpPanel) dpPanel.style.display = 'none';
          if(gnpPanel) {
            gnpPanel.style.display = 'flex';
          }
        } else {
          wlEls.forEach(el => el.style.display = 'none');
          if(gnpPanel) gnpPanel.style.display = 'none';
          if(dpPanel) {
            dpPanel.style.display = 'flex';
            dpPanel.style.flex = '1';
            dpPanel.style.height = '100%';
            dpPanel.style.background = 'var(--bg-secondary)'; // Make sure it has a background if taking full height
          }
          
          if (tab === 'rsb-alarms' && signalsTab) signalsTab.style.display = 'block';
        }
      }
    });

    if (State.get('watchlistOpen')) {
      document.getElementById('right-panel')?.classList.add('open');
      document.getElementById('rsb-watchlist')?.classList.add('active'); // fallback
    }
  },

  _bindClock() {
    const clockBtn  = document.getElementById('rsb-clock-btn');
    const clockMenu = document.getElementById('rsb-tz-menu');
    const clockTime = document.getElementById('rsb-clock-time');
    const clockTz   = document.getElementById('rsb-clock-tz');
    if (!clockBtn) return;

    let currentTz = localStorage.getItem('pintrade_tz') || 'Etc/UTC';

    const updateClock = () => {
      try {
        const now = new Date();
        const str = now.toLocaleTimeString('en-US', { timeZone: currentTz, hour12: false });
        if (clockTime) clockTime.textContent = str;
      } catch(e) {
        if (clockTime) clockTime.textContent = '00:00:00';
      }
    };
    setInterval(updateClock, 1000);
    updateClock();

    const applyTz = (tz) => {
      currentTz = tz;
      localStorage.setItem('pintrade_tz', tz);
      State.set('timezone', tz);

      const nameMatch = document.querySelector(`.rsb-tz-item[data-tz="${tz}"]`);
      if (nameMatch && clockTz) {
        const txt = nameMatch.textContent;
        if (txt.includes('(UTC')) {
          const offset = txt.match(/\(UTC[^)]*\)/)?.[0]?.replace('(','')?.replace(')','');
          clockTz.textContent = offset || 'UTC';
        } else {
          clockTz.textContent = 'UTC';
        }
      }

      document.querySelectorAll('.rsb-tz-item').forEach(el =>
        el.classList.toggle('active', el.dataset.tz === tz)
      );
      clockMenu?.classList.remove('open');
      EventBus.emit('timezone:change', { tz });

      // Update chart time axis for all panes if chart is loaded
      if (window.LayoutManager) {
        // Map IANA tz to chart-core offset format expected by _formatTimezone
        const tzToOffset = {
          'Etc/UTC': 'UTC', 'exchange': 'Exchange',
          'Pacific/Honolulu': 'UTC-10', 'America/Anchorage': 'UTC-8',
          'America/Los_Angeles': 'UTC-7', 'America/Denver': 'UTC-6',
          'America/Chicago': 'UTC-5', 'America/New_York': 'UTC-4',
          'America/Sao_Paulo': 'UTC-3', 'Europe/London': 'UTC+0',
          'Europe/Paris': 'UTC+1', 'Europe/Berlin': 'UTC+1',
          'Europe/Istanbul': 'UTC+3', 'Asia/Dubai': 'UTC+4',
          'Asia/Tehran': 'UTC+3', 'Asia/Ashgabat': 'UTC+5',
          'Asia/Kolkata': 'UTC+5', 'Asia/Bangkok': 'UTC+7',
          'Asia/Singapore': 'UTC+8', 'Asia/Shanghai': 'UTC+8',
          'Asia/Tokyo': 'UTC+9', 'Australia/Sydney': 'UTC+9',
          'Pacific/Auckland': 'UTC+10',
        };
        const chartTz = tzToOffset[tz] || 'UTC';
        window.LayoutManager.panes.forEach(p => {
          if (typeof p.applySettings === 'function') {
            p.applySettings({ timezone: chartTz });
          }
        });
      }
    };

    clockBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      clockMenu?.classList.toggle('open');
    });

    document.querySelectorAll('.rsb-tz-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        applyTz(item.dataset.tz);
      });
    });

    applyTz(currentTz);
  },

  _bindTheme() {
    EventBus.on('theme:change', ({ theme }) => {
      const btn = document.getElementById('btn-theme');
      if (btn) btn.textContent = theme === 'dark' ? '☀' : '◑';
    });
  },
};
