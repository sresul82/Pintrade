class ChartPane {
  constructor(idx, savedState = {}) {
    this.idx = idx;
    // ── per-pane settings ─────────────────────────────────
    const s = savedState;
    this.symbol       = s.symbol      ?? DEFAULTS.symbol;
    this.exchange     = s.exchange    ?? (window.State ? State.get('activeExchange') : 'binance');
    this.tf           = s.tf          ?? DEFAULTS.tf;
    this.chartType    = s.chartType   ?? DEFAULTS.chartType;
    this.scaleMode    = s.scaleMode   ?? DEFAULTS.scaleMode;
    this.priceSide    = s.priceSide   ?? DEFAULTS.priceSide;
    this.showGrid     = s.showGrid    ?? DEFAULTS.showGrid;
    this.showVolume   = s.showVolume  ?? DEFAULTS.showVolume;
    this.invertScale  = s.invertScale ?? DEFAULTS.invertScale;

    // ── Stored candle/chart colors (persists across series rebuild) ──
    this.candleUpColor   = s.candleUpColor   ?? COLORS.green;
    this.candleDownColor = s.candleDownColor ?? COLORS.red;
    this.borderUpColor   = s.borderUpColor   ?? COLORS.green;
    this.borderDownColor = s.borderDownColor ?? COLORS.red;
    this.wickUpColor     = s.wickUpColor     ?? COLORS.green;
    this.wickDownColor   = s.wickDownColor   ?? COLORS.red;
    this.candleBodyVisible    = s.candleBodyVisible    ?? true;
    this.candleBordersVisible = s.candleBordersVisible ?? true;
    this.candleWickVisible    = s.candleWickVisible    ?? true;

    const isGlobalDark = (typeof State !== 'undefined') ? State.get('theme') === 'dark' : true;
    
    // Sistem arkaplan renklerini çok daha geniş çapta (hem dark hem saf siyah) test ediyoruz
    const isStandardBg = (bg) => {
        if (!bg) return true;
        const b = bg.toLowerCase();
        return b.includes('131722') || b.includes('fff') || b.includes('000') || b.includes('f0f3') || b.includes('1e22');
    };

    if (isStandardBg(s.bgColor1)) {
        this.bgColor1 = isGlobalDark ? '#131722' : '#ffffff';
        this.bgType = 'Solid'; // Çift renkli gradient kullanıldıysa dark rengi silinsin diye force
    } else {
        this.bgColor1 = s.bgColor1;
        this.bgType = s.bgType ?? 'Solid';
    }

    this.bgColor2      = s.bgColor2      ?? COLORS.bgPanel;
    this.gridVertColor = s.gridVertColor ?? COLORS.grid;
    this.gridHorzColor = s.gridHorzColor ?? COLORS.grid;
    this.gridType      = s.gridType      ?? 'Vert and horz';
    this.crosshairColor= s.crosshairColor?? COLORS.crosshair;
    this.scaleTextColor= (!s.scaleTextColor || ['#d1d4dc', '#131722'].includes(s.scaleTextColor)) 
                             ? (isGlobalDark ? '#d1d4dc' : '#131722') : s.scaleTextColor;
    this.scaleFontSize = s.scaleFontSize ?? '11';
    this.scaleLinesColor= s.scaleLinesColor ?? COLORS.border;

    // Lines & Labels specific options
    this.lockPriceToBar = s.lockPriceToBar ?? false;
    this.scalePriceChartOnly = s.scalePriceChartOnly ?? true;

    // Labels
    this.lblSymbolName = s.lblSymbolName ?? true;
    this.lblSymbolLastPrice = s.lblSymbolLastPrice ?? true;
    this.lblPrevDayClose = s.lblPrevDayClose ?? false;
    this.lblPrePost = s.lblPrePost ?? true;
    this.lblHighLow = s.lblHighLow ?? true;
    this.lblBidAsk = s.lblBidAsk ?? false;
    this.lblIndName = s.lblIndName ?? false;
    this.lblIndValue = s.lblIndValue ?? false;
    this.lblCountdown = s.lblCountdown ?? true;
    this.lblNoOverlap = s.lblNoOverlap ?? true;

    // Line & Label Visibilities
    this.lblCountdown = s.lblCountdown ?? true;
    this.linePrevDayClose = s.linePrevDayClose ?? false; // Issue #5
    this.lineHighLow = s.lineHighLow ?? false; // Issue #6
    this.lineBidAsk = s.lineBidAsk ?? false; // Issue #7
    
    // Timezone & Formatting (Issue: Timezone change)
    this.timezone  = s.timezone  ?? 'UTC';
    this.precision = s.precision ?? 'Default'; // fiyat ekseni hassasiyeti

    // Dummy tracking variables for new features
    this._lastPrice = null;
    this._priceLines = {}; // Store custom lines 

    this.chart      = null;
    this.series     = null;
    this.volSeries  = null;
    this.ro         = null;
    this.loaded     = false;
    this.syncing    = false;

    this._build();
    this._initChart();
    this._bindEvents();
  }

  // ── DOM ───────────────────────────────────────────────────
  _build() {
    this.wrap = document.createElement('div');
    this.wrap.className = 'pane-wrap';

    // Header
    this.hdr = document.createElement('div');
    this.hdr.className = 'pane-hdr';
    this.hdr.innerHTML = `
      <button class="pane-sym" title="Change symbol">${this.symbol}</button>
      <div class="pane-sep"></div>
      <span class="ohlcv-row">
        <span class="ohlcv-g"><span class="ohlcv-l">O</span><span class="ohlcv-v" data-v="o">—</span></span>
        <span class="ohlcv-g"><span class="ohlcv-l">H</span><span class="ohlcv-v" data-v="h">—</span></span>
        <span class="ohlcv-g"><span class="ohlcv-l">L</span><span class="ohlcv-v" data-v="l">—</span></span>
        <span class="ohlcv-g"><span class="ohlcv-l">C</span><span class="ohlcv-v" data-v="c">—</span></span>
        <span class="ohlcv-g"><span class="ohlcv-l">V</span><span class="ohlcv-v" data-v="v">—</span></span>
      </span>`;

    // TF dropdown was moved globally
    // Chart type dropdown was moved globally

    // Canvas wrapper
    this.cvs = document.createElement('div');
    this.cvs.className = 'pane-cvs';

    // Watermark
    this.wm = document.createElement('div');
    this.wm.className = 'pane-wm';
    this.wm.textContent = this.symbol;
    this.cvs.appendChild(this.wm);

    // Gear button (axis intersection)
    this.gearBtn = document.createElement('button');
    this.gearBtn.className = 'pane-gear';
    this.gearBtn.title = 'Chart settings';
    this.gearBtn.innerHTML = ICONS.gear;
    this.cvs.appendChild(this.gearBtn);

    // Çizim tuvali (Drawing Overlay Layer)
    // Drawing canvas overlay
    this.drawingCanvas = document.createElement('canvas');
    this.drawingCanvas.className = 'pane-drawing-canvas';
    // Fix Issue 1: Drawing canvas starts full-size; actual clipping is done dynamically
    // via _syncDrawingCanvasClip() which reads pScale.width() at runtime.
    this.drawingCanvas.style.cssText = 'position:absolute; top:0; left:0; pointer-events:none; z-index:3;';
    this.drawingCtx = this.drawingCanvas.getContext('2d');
    this.cvs.appendChild(this.drawingCanvas);

    // Intercept pointer events for drawing (capture phase to override LWC)
    // Only left-clicks (button=0) go to DrawingManager — right-clicks go to contextmenu handler
    this.cvs.addEventListener('pointerdown', e => {
      if (e.button !== 0) return; // Right-click / middle-click: skip, let contextmenu handle it
      if (window.DrawingManager) {
         const claimed = window.DrawingManager.onMouseDown(this, e);
         if (claimed) { e.preventDefault(); e.stopPropagation(); }
      }
    }, { capture: true });

    this.cvs.addEventListener('pointermove', e => {
      if (window.DrawingManager) {
         const claimed = window.DrawingManager.onMouseMove(this, e);
         if (claimed) { e.preventDefault(); e.stopPropagation(); }
      }
    }, { capture: true });

    this.cvs.addEventListener('pointerup', e => {
      if (e.button !== 0) return;
      if (window.DrawingManager && window.DrawingManager.onMouseUp) {
        const claimed = window.DrawingManager.onMouseUp(this, e);
        // If the matching pointerdown was claimed by us, also claim the pointerup.
        // This stops LWC from receiving an orphaned pointerup that would corrupt
        // its panning state machine (pan breaks until page reload).
        if (claimed) { e.preventDefault(); e.stopPropagation(); }
      }
    }, { capture: true });

    this.cvs.addEventListener('dblclick', e => {
      if (e.button !== 0) return;
      if (window.DrawingManager && window.DrawingManager.onDoubleClick) {
        const claimed = window.DrawingManager.onDoubleClick(this, e);
        if (claimed) { e.preventDefault(); e.stopPropagation(); }
      }
    }, { capture: true });

    // Right-click on chart: cancel active drawing tool
    this.cvs.addEventListener('contextmenu', e => {
      if (window.DrawingManager) {
        const cancelled = window.DrawingManager.cancelDrawing();
        if (cancelled) {
          e.preventDefault();
          e.stopImmediatePropagation();
          e.stopPropagation();
        }
      }
    }, { capture: true });

    // Go-to-realtime button
    this.rtBtn = document.createElement('button');
    this.rtBtn.className = 'pane-rt-btn';
    this.rtBtn.title = 'Go to realtime (End)';
    this.rtBtn.innerHTML = ICONS.arrowRight;
    this.cvs.appendChild(this.rtBtn);

    // Countdown to bar close label (Issue #3)
    this.countdownEl = document.createElement('div');
    this.countdownEl.className = 'pane-countdown';
    this.countdownEl.style.display = this.lblCountdown ? '' : 'none';
    this.cvs.appendChild(this.countdownEl);

    this.wrap.appendChild(this.hdr);
    this.wrap.appendChild(this.cvs);
  }

  // ── LW Chart init ─────────────────────────────────────────
  _initChart() {
    const scaleModeMap = {
      normal:       LightweightCharts.PriceScaleMode.Normal,
      percent:      LightweightCharts.PriceScaleMode.Percentage,
      logarithmic:  LightweightCharts.PriceScaleMode.Logarithmic,
    };

    const showVert = ['Vert and horz', 'Vert only'].includes(this.gridType);
    const showHorz = ['Vert and horz', 'Horz only'].includes(this.gridType);

    this.chart = LightweightCharts.createChart(this.cvs, {
      width: 100, height: 100,
      layout: {
        background: { type: 'solid', color: this.bgColor1 },
        textColor: this.scaleTextColor,
        fontSize: parseInt(this.scaleFontSize, 10) || 11,
        fontFamily: "'JetBrains Mono', monospace",
      },
      grid: {
        vertLines: { color: (this.showGrid && showVert) ? this.gridVertColor : 'transparent' },
        horzLines: { color: (this.showGrid && showHorz) ? this.gridHorzColor : 'transparent' },
      },
      crosshair: {
        mode: LightweightCharts.CrosshairMode.Normal,
        vertLine: { color: this.crosshairColor, labelBackgroundColor: COLORS.crosshairLbl },
        horzLine: { color: this.crosshairColor, labelBackgroundColor: COLORS.crosshairLbl },
      },
      rightPriceScale: {
        borderColor: this.scaleLinesColor,
        scaleMargins: { top: .05, bottom: .15 },
        visible: this.priceSide === 'right',
        mode: scaleModeMap[this.scaleMode] ?? 0,
        invertScale: this.invertScale,
      },
      leftPriceScale: {
        borderColor: this.scaleLinesColor,
        scaleMargins: { top: .05, bottom: .15 },
        visible: this.priceSide === 'left',
      },
      timeScale: {
        borderColor: this.scaleLinesColor,
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 12,       
        fixRightEdge: false,
        fixLeftEdge: false,
      },
      localization: {
        // Issue #1: Crosshair time formatting
        timeFormatter: (businessDayOrTimestamp) => {
          if (!businessDayOrTimestamp) return '';
          return this._formatTimezone(businessDayOrTimestamp);
        }
      },
      handleScroll: { mouseWheel: true, pressedMouseMove: true },
      handleScale:  { mouseWheel: true, pinch: true },
    });
    
    // Issue #2: Main bottom Time Scale formatting uses dynamic tick types (Time vs Date)
    this.chart.timeScale().applyOptions({
      tickMarkFormatter: (time, tickMarkType, locale) => {
        return this._formatTimezone(time, true, tickMarkType); // dynamic tick mode
      }
    });

    this._buildSeries();

    this.chart.subscribeCrosshairMove(p => {
      this._onCrosshairMove(p);
      this._syncDrawingCanvasClip(); // Fix Issue 1: dynamic scale width
      if (this.redrawDrawings) this.redrawDrawings();
    });
    this.chart.timeScale().subscribeVisibleTimeRangeChange(r => {
      this._onRangeChange(r);
      this._syncDrawingCanvasClip(); // Fix Issue 1: dynamic scale width
      if (this.redrawDrawings) this.redrawDrawings();
    });

    // ── Scroll-based lazy history loading ─────────────────────
    // When user scrolls left and approaches the first bar, fetch more historical candles.
    this._lazyLoadThrottle = false;
    this.chart.timeScale().subscribeVisibleLogicalRangeChange(range => {
      if (!range) return;
      if (this._lazyLoadThrottle) return;
      // [FIX] Eğer range.from çok negatifse (< -100) bu fitContent() tetiklemesidir,
      // gerçek kullanıcı scroll'u değil. loadOlderCandles çağırma — mumlar kaybolur.
      if (range.from < -100) return;
      // If the left edge of the visible range is within 50 bars of the data start, load more
      if (range.from < 50) {
        this._lazyLoadThrottle = true;
        // Find the oldest bar time we currently hold
        const oldestBar = this.candlesData?.[0];
        if (oldestBar) {
          DataFeed.loadOlderCandles(`pane_${this.idx}`, oldestBar.time * 1000);
        }
        // Throttle: prevent repeated calls for 3 seconds
        setTimeout(() => { this._lazyLoadThrottle = false; }, 3000);
      }
    });

    // ResizeObserver → load data once pane has real size
    this.ro = new ResizeObserver(entries => {
      for (const e of entries) {
        const { width, height } = e.contentRect;
        if (width > 0 && height > 0) {
          this.chart.resize(width, height);
          
          // Fix Issue 1: Sync drawing canvas to dynamic price/time scale sizes
          this._syncDrawingCanvasClip();
          if (this.redrawDrawings) this.redrawDrawings();

          if (!this.loaded) { this.loaded = true; this._loadData(); }
        }
      }
    });
    this.ro.observe(this.cvs);

    // [FIX] Zaman cetveline çift tıklandığında fitContent() phantom'ın 500 barını
    // da ekrana sığdırır — mumlar sola kayar. Çift tıklamayı yakalayıp gerçek
    // mum aralığına geri döneriz.
    this.cvs.addEventListener('dblclick', () => {
      // Çift tıklama anında gerçek mumların logical range'ini hesapla
      const candles = this.candlesData;
      if (!candles || candles.length === 0) return;

      // fitContent() çalışıp bittikten sonra geri yükle
      setTimeout(() => {
        if (!this.chart || !this.candlesData || !this.candlesData.length) return;
        try {
          const ts         = this.chart.timeScale();
          const totalBars  = this.candlesData.length;
          // Ekranda görünür bar sayısını koru — varsayılan olarak son 150 bar
          const visibleBars = 150;
          const toBar      = totalBars - 1;          // son mum
          const fromBar    = Math.max(0, toBar - visibleBars);
          ts.setVisibleLogicalRange({ from: fromBar, to: toBar + 12 }); // +12 rightOffset
        } catch(_) {}
      }, 50);
    });

    // Start countdown if enabled
    if (this.lblCountdown) this._updateCountdown();

    // Listen for global theme changes → update chart colors
    const applyTheme = (isDark) => {
      this.chart.applyOptions({
        layout: {
          background: { type: 'solid', color: isDark ? '#131722' : '#ffffff' },
          textColor:  isDark ? '#d1d4dc' : '#131722',
        },
        grid: {
          vertLines: { color: isDark ? '#1e2130' : '#dce0ea' },
          horzLines: { color: isDark ? '#1e2130' : '#dce0ea' },
        },
        crosshair: {
          vertLine: { color: isDark ? '#758696' : '#9ca3af', labelBackgroundColor: isDark ? '#1a2035' : '#dde3ee' },
          horzLine: { color: isDark ? '#758696' : '#9ca3af', labelBackgroundColor: isDark ? '#1a2035' : '#dde3ee' },
        },
        rightPriceScale: { borderColor: isDark ? '#2a2e39' : '#c9d0e0' },
        leftPriceScale:  { borderColor: isDark ? '#2a2e39' : '#c9d0e0' },
        timeScale:       { borderColor: isDark ? '#2a2e39' : '#c9d0e0' },
      });
    };

    EventBus.on('theme:change', ({ theme }) => applyTheme(theme === 'dark'));
    
    // Sayfa baştan yüklenirse geçerli global temayı zorla (Light moda geçince siyah chart kalmasını engeller)
    if (typeof State !== 'undefined') {
       // Canvas çizildikten hemen sonra uygulamanın temasını garantiye almak için 2 adımlı uygulama
       applyTheme(State.get('theme') === 'dark');
       setTimeout(() => applyTheme(State.get('theme') === 'dark'), 50);
    }

    // Listen for real candle data and live ticks from DataFeed
    EventBus.on('feed:candles',      (payload) => this._onFeedCandles(payload));
    EventBus.on('feed:olderCandles', (payload) => this._onOlderCandles(payload));
    EventBus.on('feed:tick',         (payload) => this._onFeedTick(payload));
    EventBus.on('feed:liveCandle',   (payload) => this._onLiveCandle(payload));
  }

  // ── Global Drawing Refresh ──────────────────────────────
  redrawDrawings() {
    if (window.DrawingManager) window.DrawingManager.renderPane(this);
  }

  // ── Fix Issue 1: Sync drawing canvas to dynamic price/time scale sizes ──
  // LightweightCharts price scale width varies with price precision (e.g. DENT
  // has 8 decimal places → wider scale than BTC). This reads the real runtime
  // width from pScale.width() so the canvas never overlaps the axes.
  _syncDrawingCanvasClip() {
    if (!this.drawingCanvas || !this.chart) return;
    try {
      const dpr  = window.devicePixelRatio || 1;
      const rect = this.cvs.getBoundingClientRect();

      // Çizim canvas'ı tam pane boyutunda olmalı ki extend edilen çizgiler
      // fiyat ekseni ve zaman ekseni alanlarında kesilmesin.
      const canvasW = Math.max(1, Math.round(rect.width  * dpr));
      const canvasH = Math.max(1, Math.round(rect.height * dpr));

      // CSS boyutunu tam pane'e eşitle
      this.drawingCanvas.style.width  = `${rect.width}px`;
      this.drawingCanvas.style.height = `${rect.height}px`;

      // Piksel buffer'ı sadece boyut değiştiyse güncelle (gereksiz yeniden çizimi önler)
      if (this.drawingCanvas.width !== canvasW || this.drawingCanvas.height !== canvasH) {
        this.drawingCanvas.width  = canvasW;
        this.drawingCanvas.height = canvasH;        
      }
    } catch (_) {}
  }


  _buildSeries() {
    if (this.series)    try { this.chart.removeSeries(this.series);    } catch(_) {}
    if (this.volSeries) try { this.chart.removeSeries(this.volSeries); } catch(_) {}
    this.series = this.volSeries = null;

    const pScaleId = this.priceSide === 'left' ? 'left' : 'right';

    if (this.showVolume) {
      this.volSeries = this.chart.addHistogramSeries({
        color: 'rgba(70,130,100,.35)',
        priceFormat: { type: 'volume' },
        priceScaleId: '', // Özel axis yerine overlay axis olmak zorunda! Yoksa ekranı kaplar.
      });
      this.chart.priceScale('').applyOptions({
        scaleMargins: { top: 0.85, bottom: 0 }, borderVisible: false,
      });
    }

    // Use stored colors for all series (Issue #1 - preserve across type change & split)
    const up   = this.candleBodyVisible    ? this.candleUpColor   : 'transparent';
    const down = this.candleBodyVisible    ? this.candleDownColor : 'transparent';
    const bUp  = this.candleBordersVisible ? this.borderUpColor   : 'transparent';
    const bDn  = this.candleBordersVisible ? this.borderDownColor : 'transparent';
    const wUp  = this.candleWickVisible    ? this.wickUpColor     : 'transparent';
    const wDn  = this.candleWickVisible    ? this.wickDownColor   : 'transparent';

    // Başlangıç priceFormat: geniş tutuyoruz ki LightweightCharts
    // default precision:2 / minMove:0.01 kilidi oluşturmasın.
    // Gerçek değerler veri gelince _onFeedCandles içinde applyOptions ile atanır.
    const _defaultPF = { type: 'price', precision: 8, minMove: 0.00000001 };

    switch (this.chartType) {
      case 'line':
        this.series = this.chart.addLineSeries({ color: COLORS.accent, lineWidth: 2, priceScaleId: pScaleId, priceFormat: _defaultPF });
        break;
      case 'area':
        this.series = this.chart.addAreaSeries({
          topColor: 'rgba(0,184,196,.3)', bottomColor: 'rgba(0,184,196,.02)',
          lineColor: COLORS.accent, lineWidth: 2, priceScaleId: pScaleId, priceFormat: _defaultPF,
        });
        break;
      case 'bar':
        this.series = this.chart.addBarSeries({
          upColor: up, downColor: down, priceScaleId: pScaleId, priceFormat: _defaultPF,
        });
        break;
      default: // candle
        this.series = this.chart.addCandlestickSeries({
          upColor: up,   downColor: down,
          borderUpColor: bUp, borderDownColor: bDn,
          wickUpColor: wUp,   wickDownColor: wDn,
          priceScaleId: pScaleId, priceFormat: _defaultPF,
        });
    }

    if (this.series) {
      this.series.applyOptions({
        lastValueVisible: this.symValue !== false,
        priceLineVisible: this.symLine !== false,
        title: this.symName !== false ? (this.symbol || 'USD') : '',
      });
    }

    // [ChartPhantom] Initialize the invisible phantom series that extends the time
    // axis to the right. Called every time the series is rebuilt (chart type change,
    // symbol change, TF change) so the extension is always in sync.
    if (window.ChartPhantom) ChartPhantom.init(this);
  }

  _loadData() {
    if (!this.series) return;
    
    // Debounce: art arda gelen yükleme taleplerini tekilleştir (race condition engelleme)
    if (this._loadTimer) clearTimeout(this._loadTimer);
    
    this._loadTimer = setTimeout(() => {
      // Reset the initial-load flag so fitContent() fires for this new symbol/TF
      this._initialDataLoaded = false;
      // Request real data from DataFeedManager
      // DataFeed will emit 'feed:candles' which we handle below
      DataFeed.load(`pane_${this.idx}`, this.symbol, this.tf, this.exchange);
    }, 150); // 50ms'den 150ms'ye çıkarıldı
  }

  // Called when feed:candles arrives for our symbol+tf
  _onFeedCandles({ symbol, tf, exchange, candles }) {
    if (this._destroyed) return;
    if (symbol !== this.symbol || tf !== this.tf) return;
    if (this.exchange && exchange !== this.exchange) return; // Sadece pane'nin borsasını kabul et
    if (!this.series) return;
    
    // Eğer REST API'den hiç veri gelmemişse (ör. lokalde CORS hatası), 
    // chart'ı boş olarak başlat ki en azından WebSocket'ten gelen canlı veriler çizilebilsin.
    if (!candles || !candles.length) {      
      return;
    }

    // ── Sanitize: null/NaN içeren mumları filtrele ──────────
    const clean = candles
      .map(d => ({
        time:   typeof d.time === 'number' ? d.time : parseInt(d.time),
        open:   parseFloat(d.open),
        high:   parseFloat(d.high),
        low:    parseFloat(d.low),
        close:  parseFloat(d.close),
        volume: parseFloat(d.volume ?? 0),
      }))
      .filter(d =>
        !isNaN(d.time) && d.time > 0 &&
        !isNaN(d.open)  && d.open  > 0 &&
        !isNaN(d.high)  && d.high  > 0 &&
        !isNaN(d.low)   && d.low   > 0 &&
        !isNaN(d.close) && d.close > 0
      );

    if (!clean.length) return; // Temiz veri yoksa chart'a dokunma

    // Duplicate time değerlerini temizle (son gelen kazanır)
    const seen = new Map();
    clean.forEach(d => seen.set(d.time, d));
    const deduped = Array.from(seen.values()).sort((a, b) => a.time - b.time);

    const last = deduped[deduped.length - 1];

    // ── Precision: setData'dan ÖNCE uygula ──────────────────────
    if (last && last.close != null) {
      let decimals = 2; // Fallback
      if (this.precision === 'Default' || this.precision == null) {
        decimals = _getDynamicDecimals(Math.abs(last.close));
      } else if (this.precision === 'Integer') {
        decimals = 0;
      } else {
        decimals = parseInt(this.precision, 10);
      }
      
      if (!isNaN(decimals)) {
        const minMove = parseFloat((1 / Math.pow(10, decimals)).toFixed(decimals));
        try {
          this.series.applyOptions({
            priceFormat: { type: 'price', precision: decimals, minMove }
          });
        } catch(_) {}
      }
    }

    const isLine = ['line', 'area'].includes(this.chartType);

    this.series.setData(
      isLine
        ? deduped.map(d => ({ time: d.time, value: d.close }))
        : deduped
    );

    if (this.volSeries) {
      this.volSeries.setData(deduped.map(d => ({
        time:  d.time,
        value: d.volume,
        color: d.close >= d.open ? 'rgba(8,153,129,.4)' : 'rgba(242,54,69,.4)',
      })));
    }

    // Cache candle data for magnet mode snap calculations
    this.candlesData = deduped;

    // [ChartPhantom] After candle data is set, update the invisible phantom series
    // so the time axis extends 500 bars into the future. This allows drawing tools
    // to work beyond the last real candle without disappearing.
    if (window.ChartPhantom) ChartPhantom.update(this);

    this._lastPrice      = last?.close ?? null;
    this._lastPriceIsUp  = last && (last.close >= (last.open ?? last.close));
    this._lastCandleTime = last?.time ?? null;

    this._updateVisualLines(deduped);
    requestAnimationFrame(() => this._positionCountdown());

    if ((exchange === 'binance' || exchange === 'bybit') && !this._initialDataLoaded) {
      this._initialDataLoaded = true;
      this.chart.timeScale().fitContent();
    }

  }

  // Called when feed:tick arrives (live candle update)
  _onFeedTick({ symbol, tf, exchange, candle, isClosed }) {
    if (this._destroyed) return;
    if (symbol !== this.symbol || tf !== this.tf) return;
    if (!this.series) return;
    if (this.exchange && exchange !== this.exchange) return; // sadece bilinen ve bu pane'ye ait borsalar

    const isLine = ['line', 'area'].includes(this.chartType);

    // ── Sanitize: tüm alanları sayıya zorla ──────────────────
    const safe = {
      time:   typeof candle.time === 'number' ? candle.time : parseInt(candle.time),
      open:   parseFloat(candle.open),
      high:   parseFloat(candle.high),
      low:    parseFloat(candle.low),
      close:  parseFloat(candle.close),
      volume: parseFloat(candle.volume),
    };

    // Geçersiz veri varsa güncelleme yapma
    if (isNaN(safe.time) || isNaN(safe.close) || isNaN(safe.open) ||
        isNaN(safe.high) || isNaN(safe.low)) {
      console.warn('[ChartPane] _onFeedTick: geçersiz candle verisi, atlandı:', candle);
      return;
    }

    const update = isLine ? { time: safe.time, value: safe.close } : safe;

    try {
      this.series.update(update);

      if (this.volSeries) {
        this.volSeries.update({
          time:  safe.time,
          value: safe.volume,
          color: safe.close >= safe.open ? 'rgba(8,153,129,.4)' : 'rgba(242,54,69,.4)',
        });
      }

      this._lastPrice      = safe.close;
      this._lastPriceIsUp  = safe.close >= safe.open;
      this._lastCandleTime = safe.time;
    } catch (err) {
      console.warn('[ChartPane] _onFeedTick update failed:', err);
      // Lightweight-charts rejects updates older than last bar — safe to ignore
      // This can happen briefly after setData() before WS sync catches up
    }
  }

  // Binance polling'den gelen canlı mum güncellemesi
  // feed:tick'ten farkı: geçmiş veri yüklenmeden önce series.update() çağırmaz
  _onLiveCandle({ symbol, tf, exchange, candle, isClosed }) {
    if (this._destroyed) return;
    if (symbol !== this.symbol || tf !== this.tf) return;
    if (this.exchange && exchange !== this.exchange) return;
    if (!this.series) return;

    // Geçmiş veri henüz yüklenmedişse update() çağırma — Value is null hatası olur
    if (!this._initialDataLoaded) return;

    // candlesData boşsa update() çağırma
    if (!this.candlesData || !this.candlesData.length) return;

    const safe = {
      time:   typeof candle.time === 'number' ? candle.time : parseInt(candle.time),
      open:   parseFloat(candle.open),
      high:   parseFloat(candle.high),
      low:    parseFloat(candle.low),
      close:  parseFloat(candle.close),
      volume: parseFloat(candle.volume),
    };

    if (isNaN(safe.time) || isNaN(safe.close) || isNaN(safe.open) ||
        isNaN(safe.high) || isNaN(safe.low)) return;

    // Gelen mumun time değeri mevcut son mumdan KÜÇÜKSE update() çağırma
    const lastExistingTime = this.candlesData[this.candlesData.length - 1]?.time;
    if (lastExistingTime && safe.time < lastExistingTime) return;

    const isLine = ['line', 'area'].includes(this.chartType);
    const update = isLine ? { time: safe.time, value: safe.close } : safe;

    try {
      this.series.update(update);

      if (this.volSeries) {
        this.volSeries.update({
          time:  safe.time,
          value: safe.volume,
          color: safe.close >= safe.open ? 'rgba(8,153,129,.4)' : 'rgba(242,54,69,.4)',
        });
      }

      this._lastPrice      = safe.close;
      this._lastPriceIsUp  = safe.close >= safe.open;
      this._lastCandleTime = safe.time;

      // candlesData'yı güncelle
      if (lastExistingTime && safe.time === lastExistingTime) {
        this.candlesData[this.candlesData.length - 1] = safe; // Mevcut son mumu güncelle
      } else {
        this.candlesData.push(safe); // Yeni mum ekle
      }
    } catch(err) {
      console.warn('[ChartPane] _onLiveCandle update failed:', err);
    }
  }

  // Called when feed:olderCandles arrives (scroll-triggered lazy load)
  _onOlderCandles({ symbol, tf, exchange, candles }) {
    if (this._destroyed) return;
    if (symbol !== this.symbol || tf !== this.tf) return;
    if (this.exchange && exchange !== this.exchange) return;
    if (!this.series) return;

    // Boş veri gelirse hiçbir şey yapma — chart'a dokunma
    if (!candles || !candles.length) return;

    // Sanitize
    const clean = candles
      .map(d => ({
        time:   typeof d.time === 'number' ? d.time : parseInt(d.time),
        open:   parseFloat(d.open),
        high:   parseFloat(d.high),
        low:    parseFloat(d.low),
        close:  parseFloat(d.close),
        volume: parseFloat(d.volume ?? 0),
      }))
      .filter(d =>
        !isNaN(d.time) && d.time > 0 &&
        !isNaN(d.open)  && d.open  > 0 &&
        !isNaN(d.high)  && d.high  > 0 &&
        !isNaN(d.low)   && d.low   > 0 &&
        !isNaN(d.close) && d.close > 0
      );

    // Temizlendikten sonra hâlâ boşsa dokunma
    if (!clean.length) return;

    // Mevcut veriden daha eski mumlar geldi mi kontrol et
    const firstExisting = this.candlesData?.[0]?.time ?? Infinity;
    const firstNew      = clean[0].time;

    // Eğer gelen veri mevcut veriden daha eski değilse işlem yapma
    if (firstNew >= firstExisting) return;

    // Visible range'i kaydet — setData sonrası geri yükleyeceğiz
    let savedRange = null;
    try { savedRange = this.chart.timeScale().getVisibleLogicalRange(); } catch(_) {}

    const isLine = ['line', 'area'].includes(this.chartType);

    try {
      // Eski mumları mevcut mumlarla birleştir — mevcut mumları kaybetme
      const existing    = this.candlesData ?? [];
      const existingSet = new Set(existing.map(d => d.time));
      const onlyNew     = clean.filter(d => !existingSet.has(d.time));
      const merged      = [...onlyNew, ...existing].sort((a, b) => a.time - b.time);

      // Duplicate time değerlerini temizle (son gelen kazanır)
      const dedupeMap = new Map();
      merged.forEach(d => dedupeMap.set(d.time, d));
      const deduped = Array.from(dedupeMap.values()).sort((a, b) => a.time - b.time);

      this.series.setData(
        isLine
          ? deduped.map(d => ({ time: d.time, value: d.close }))
          : deduped
      );

      if (this.volSeries) {
        this.volSeries.setData(deduped.map(d => ({
          time:  d.time,
          value: d.volume,
          color: d.close >= d.open ? 'rgba(8,153,129,.4)' : 'rgba(242,54,69,.4)',
        })));
      }

      this.candlesData = deduped;

      // Phantom'ı güncelle — birleşik veriyle zaman eksenini yenile
      if (window.ChartPhantom) ChartPhantom.update(this);

      // Visible range'i geri yükle — kullanıcının baktığı yere geri dön
      if (savedRange) {
        try { this.chart.timeScale().setVisibleLogicalRange(savedRange); } catch(_) {}
      }
    } catch(err) {
      console.warn('[ChartPane] _onOlderCandles setData failed:', err);
    }
  }

  // Visual Chart Elements (Issues 4,5,6)
  _updateVisualLines(data) {
    if (!this.series) return;
    
    const removeLine = (key) => {
      if (this._priceLines[key]) { this.series.removePriceLine(this._priceLines[key]); delete this._priceLines[key]; }
    };

    const addLine = (key, price, title, color, style, showLabel = true) => {
      removeLine(key);
      this._priceLines[key] = this.series.createPriceLine({
        price: price, color: color, lineWidth: 1, lineStyle: style, axisLabelVisible: showLabel, title: title,
      });
    };

    if (this.linePrevDayClose && this._lastPrice) {
      const showLine = this.pdLine !== false;
      const showVal  = this.pdValue !== false;
      addLine('prev', this._lastPrice * 0.995, 'Prev Close', showLine ? '#787b86' : 'transparent', LightweightCharts.LineStyle.Dotted, showVal);
    } else removeLine('prev');

    if (this.lineHighLow) {
      const showLine = this.hlLine !== false;
      const showVal  = this.hlValue !== false;
      const high = Math.max(...data.map(d => d.high ?? d.close));
      const low  = Math.min(...data.map(d => d.low ?? d.close));
      addLine('high', high, 'High', showLine ? '#f23645' : 'transparent', LightweightCharts.LineStyle.Dashed, showVal);
      addLine('low', low, 'Low', showLine ? '#2962ff' : 'transparent', LightweightCharts.LineStyle.Dashed, showVal);
    } else { removeLine('high'); removeLine('low'); }
    
    if (this.lineBidAsk && this._lastPrice) {
      const showLine = this.baLine !== false;
      const showVal  = this.baValue !== false;
      addLine('ask', this._lastPrice + 0.5, 'Ask', showLine ? '#f23645' : 'transparent', LightweightCharts.LineStyle.Solid, showVal);
      addLine('bid', this._lastPrice - 0.5, 'Bid', showLine ? '#2962ff' : 'transparent', LightweightCharts.LineStyle.Solid, showVal);
    } else { removeLine('ask'); removeLine('bid'); }
  }

  // ── Crosshair move ────────────────────────────────────────
  _onCrosshairMove(param) {
    if (param?.time && param.seriesData) {
      const d = param.seriesData.get(this.series);
      if (d) {
        this._setOHLCV(
          d.open  ?? d.value,
          d.high  ?? d.value,
          d.low   ?? d.value,
          d.close ?? d.value,
          d.close >= (d.open ?? d.close) ?? true,
          param.seriesData.get(this.volSeries)?.value,
        );
      }
    }
    // Update countdown position when price scale scrolls
    this._positionCountdown();
    // Emit for SyncManager if not already syncing.
    // Fix: param.time can be undefined between bars in CrosshairMode.Normal even when
    // the mouse IS on the chart — use param.point to distinguish 'on chart' vs 'off chart'.
    if (!this.syncing) {
      const hasPoint = param?.point?.x != null; // true = mouse is on the chart canvas
      EventBus.emit('crosshair:move', { sourceIdx: this.idx, time: param?.time, hasPoint });
    }
  }

  _setOHLCV(o, h, l, c, up, v) {
    const set = (key, text, color) => {
      const el = this.hdr.querySelector(`[data-v="${key}"]`);
      if (el) { el.textContent = text; if (color !== undefined) el.style.color = color; }
    };
    set('o', formatPrice(o));
    set('h', formatPrice(h));
    set('l', formatPrice(l));
    set('c', formatPrice(c), up ? COLORS.green : COLORS.red);
    set('v', formatVolume(v));
  }

  // ── Time range change ─────────────────────────────────────
  _onRangeChange(range) {
    if (!this.syncing && range) {
      try {
        const pos = this.chart.timeScale().scrollPosition();
        this.rtBtn.classList.toggle('visible', pos < -5);
      } catch(_) {}
      EventBus.emit('range:change', { sourceIdx: this.idx, range });
    }
  }

  // ── Events ────────────────────────────────────────────────
  _bindEvents() {
    // Activate pane on click
    this.wrap.addEventListener('mousedown', () => EventBus.emit('pane:activate', { idx: this.idx }));

    // Symbol click
    this.hdr.querySelector('.pane-sym').addEventListener('click', e => {
      e.stopPropagation();
      const s = prompt('Symbol (e.g. ETHUSDT):', this.symbol);
      if (s?.trim()) EventBus.emit('symbol:change', { sourceIdx: this.idx, symbol: s.trim().toUpperCase() });
    });

    // TF button listeners were removed since it's global now
    // Removed chart type dropdown listener, it is handled globally

    // Realtime button
    this.rtBtn.addEventListener('click', () => this.chart.timeScale().scrollToRealTime());

    // Gear button → open TradingView right-click menu
    this.gearBtn.addEventListener('click', e => {
      e.stopPropagation();
      const rect = this.gearBtn.getBoundingClientRect();
      // Emulate event properties for positioning
      const fakeEvent = {
        preventDefault: () => {},
        clientX: rect.right,
        clientY: rect.top
      };
      EventBus.emit('contextmenu:show', { e: fakeEvent, pane: this, isPriceScale: true });
    });

    // Price scale right-click (right ~65px of canvas)
    this.cvs.addEventListener('contextmenu', e => {
      e.preventDefault();
      e.stopPropagation();
      const rect = this.cvs.getBoundingClientRect();
      const isPriceScale = (rect.right - e.clientX) < 70;
      
      let priceVal = null;
      try {
        const y = e.clientY - rect.top;
        priceVal = this.series.coordinateToPrice(y);
      } catch (err) {}
      
      EventBus.emit('contextmenu:show', { e, pane: this, isPriceScale, priceVal });
    });

    // Close dropdowns on outside click
    document.addEventListener('click', () => {
      document.querySelectorAll('.pane-dd.open').forEach(d => d.classList.remove('open'));
    });
  }

  _closeAllDropdowns(keep) {
    document.querySelectorAll('.pane-dd.open').forEach(d => { if (d !== keep) d.classList.remove('open'); });
  }

  _positionDd(dd, anchor) {
    const r = anchor.getBoundingClientRect();
    dd.style.position = 'fixed';
    dd.style.left = r.left + 'px';
    dd.style.top  = (r.bottom + 4) + 'px';
  }

  // ── Public API ────────────────────────────────────────────
  setSymbol(symbol, exchange) {
    if (this.symbol === symbol && (!exchange || this.exchange === exchange)) return; // Çift tetiklenme koruması
    this.symbol = symbol;
    if (exchange) this.exchange = exchange;
    this.hdr.querySelector('.pane-sym').textContent = symbol;
    this.wm.textContent = symbol;
    this.loaded = false; this._loadData(); this.loaded = true;
  }

  setTF(tf) {
    if (this.tf === tf) return; // Çift tetiklenme koruması
    this.tf = tf;
    this.loaded = false; this._loadData(); this.loaded = true;

    // Restart countdown with new TF interval
    if (this.lblCountdown) this._updateCountdown();

    // Update global nav icon if this pane is active
    if (this.wrap.classList.contains('pane-active')) {
      const navBtn = document.getElementById('nav-tf');
      if (navBtn) navBtn.textContent = tf;
    }
  }

  setChartType(type) {
    this.chartType = type;
    this._buildSeries();
    this.loaded = false; this._loadData(); this.loaded = true;
    
    // Update global nav icon if this pane is active
    if (this.wrap.classList.contains('pane-active')) {
      const navBtn = document.getElementById('nav-chart-type');
      if (navBtn) navBtn.innerHTML = ICONS[type] ?? ICONS.candle;
    }
  }

  setScaleMode(mode) {
    this.scaleMode = mode;
    const modeMap = {
      normal:       LightweightCharts.PriceScaleMode.Normal,
      percent:      LightweightCharts.PriceScaleMode.Percentage,
      logarithmic:  LightweightCharts.PriceScaleMode.Logarithmic,
    };
    const scaleId = this.priceSide === 'left' ? 'left' : 'right';
    this.chart.priceScale(scaleId).applyOptions({ mode: modeMap[mode] ?? 0 });
  }

  setPriceSide(side) {
    this.priceSide = side;
    this.chart.applyOptions({
      rightPriceScale: { visible: side === 'right' },
      leftPriceScale:  { visible: side === 'left'  },
    });
    this._buildSeries();
    this.loaded = false; this._loadData(); this.loaded = true;
  }

  setGrid(show) {
    this.showGrid = show;
    const showVert = ['Vert and horz', 'Vert only'].includes(this.gridType);
    const showHorz = ['Vert and horz', 'Horz only'].includes(this.gridType);
    this.chart.applyOptions({
      grid: {
        vertLines: { color: (show && showVert) ? this.gridVertColor : 'transparent' },
        horzLines: { color: (show && showHorz) ? this.gridHorzColor : 'transparent' },
      }
    });
  }

  setVolume(show) {
    this.showVolume = show;
    this._buildSeries();
    this.loaded = false; this._loadData(); this.loaded = true;
  }

  setInvert(invert) {
    this.invertScale = invert;
    const scaleId = this.priceSide === 'left' ? 'left' : 'right';
    this.chart.priceScale(scaleId).applyOptions({ invertScale: invert });
  }

  setPriceLine(show) {
    this.priceLine = show;
    if (this.series) this.series.applyOptions({ lastValueVisible: show, priceLineVisible: show });
  }

  setOption(key, value) {
    this[key] = value;
    if (key === 'priceLine') {
      if (this.series) this.series.applyOptions({ lastValueVisible: value, priceLineVisible: value });
    }
  }

  // ── Apply Settings from modal ─────────────────────────────
  applySettings(s) {
    // ── CANDLES (Symbol tab) ─────────────────────────────────
    // First persist all color/visibility values into pane state
    if (s.candleUpColor   != null) this.candleUpColor   = s.candleUpColor;
    if (s.candleDownColor != null) this.candleDownColor = s.candleDownColor;
    if (s.borderUpColor   != null) this.borderUpColor   = s.borderUpColor;
    if (s.borderDownColor != null) this.borderDownColor = s.borderDownColor;
    if (s.wickUpColor     != null) this.wickUpColor     = s.wickUpColor;
    if (s.wickDownColor   != null) this.wickDownColor   = s.wickDownColor;
    if (s.candleBody      != null) this.candleBodyVisible    = s.candleBody;
    if (s.candleBorders   != null) this.candleBordersVisible = s.candleBorders;
    if (s.candleWick      != null) this.candleWickVisible    = s.candleWick;

    // Apply to existing series if candle type
    if (this.series && this.chartType === 'candle') {
      this.series.applyOptions({
        upColor:         this.candleBodyVisible    ? this.candleUpColor   : 'transparent',
        downColor:       this.candleBodyVisible    ? this.candleDownColor : 'transparent',
        borderUpColor:   this.candleBordersVisible ? this.borderUpColor   : 'transparent',
        borderDownColor: this.candleBordersVisible ? this.borderDownColor : 'transparent',
        wickUpColor:     this.candleWickVisible    ? this.wickUpColor     : 'transparent',
        wickDownColor:   this.candleWickVisible    ? this.wickDownColor   : 'transparent',
      });
    }

    // ── BACKGROUND (Canvas tab) ──────────────────────────────
    if (s.bgType   != null) this.bgType   = s.bgType;
    if (s.bgColor1 != null) this.bgColor1 = s.bgColor1;
    if (s.bgColor2 != null) this.bgColor2 = s.bgColor2;
    if (s.bgColor1 != null || s.bgType != null) {
      if (this.bgType === 'Solid') {
        this.chart.applyOptions({ layout: { background: { type: 'solid', color: this.bgColor1 } } });
      } else {
        this.chart.applyOptions({ layout: { background: { type: 'gradient', topColor: this.bgColor1, bottomColor: this.bgColor2 } } });
      }
    }

    // ── GRID (Canvas tab) ────────────────────────────────────
    if (s.gridType      != null) this.gridType      = s.gridType;
    if (s.gridVertColor != null) this.gridVertColor = s.gridVertColor;
    if (s.gridHorzColor != null) this.gridHorzColor = s.gridHorzColor;
    if (s.gridType != null || s.gridVertColor != null || s.gridHorzColor != null) {
      const showVert = ['Vert and horz', 'Vert only'].includes(this.gridType);
      const showHorz = ['Vert and horz', 'Horz only'].includes(this.gridType);
      this.showGrid = showVert || showHorz;
      this.chart.applyOptions({
        grid: {
          vertLines: { color: showVert ? this.gridVertColor : 'transparent' },
          horzLines: { color: showHorz ? this.gridHorzColor : 'transparent' },
        }
      });
    }

    // ── CROSSHAIR COLOR (Canvas tab) ─────────────────────────
    if (s.crosshairColor != null) {
      this.crosshairColor = s.crosshairColor;
      this.chart.applyOptions({
        crosshair: {
          vertLine: { color: this.crosshairColor, labelBackgroundColor: COLORS.crosshairLbl },
          horzLine: { color: this.crosshairColor, labelBackgroundColor: COLORS.crosshairLbl },
        }
      });
    }

    // ── SCALE TEXT COLOR + FONT SIZE (Canvas tab) ─────────────
    if (s.scaleTextColor != null) this.scaleTextColor = s.scaleTextColor;
    if (s.scaleFontSize  != null) this.scaleFontSize  = s.scaleFontSize;
    if (s.scaleTextColor != null || s.scaleFontSize != null) {
      this.chart.applyOptions({ layout: {
        textColor: this.scaleTextColor,
        fontSize:  parseInt(this.scaleFontSize, 10) || 11,
      }});
    }

    // ── SCALE BORDER LINES COLOR (Canvas tab) ────────────────
    if (s.scaleLinesColor != null) {
      this.scaleLinesColor = s.scaleLinesColor;
      this.chart.applyOptions({
        rightPriceScale: { borderColor: this.scaleLinesColor },
        leftPriceScale:  { borderColor: this.scaleLinesColor },
        timeScale:       { borderColor: this.scaleLinesColor },
      });
    }

    // ── SCALES PLACEMENT (Scales tab) ────────────────────────
    if (s.scalesPlacement != null) {
      const side = s.scalesPlacement === 'Stack on the left' ? 'left' : 'right';
      if (side !== this.priceSide) this.setPriceSide(side);
    }

    // ── COUNTDOWN / LABELS / LINES (Scales tab) ───────────────
    if (s.countdown      != null) {
      this.lblCountdown = s.countdown;
      this._updateCountdown();
    }
    
    // Checkboxes array configuration
    if (s.hlValue != null) this.hlValue = s.hlValue;
    if (s.hlLine  != null) this.hlLine  = s.hlLine;
    if (s.baValue != null) this.baValue = s.baValue;
    if (s.baLine  != null) this.baLine  = s.baLine;
    if (s.pdValue != null) this.pdValue = s.pdValue;
    if (s.pdLine  != null) this.pdLine  = s.pdLine;
    if (s.symName != null) this.symName = s.symName;
    if (s.symValue != null) this.symValue = s.symValue;
    if (s.symLine != null) this.symLine = s.symLine;
    
    // Check if we need to apply Symbol Label Settings immediately
    if (s.symName != null || s.symValue != null || s.symLine != null) {
       if (this.series) {
         this.series.applyOptions({
           title: this.symName !== false ? (this.symbol || 'USD') : '',
           lastValueVisible: this.symValue !== false,
           priceLineVisible: this.symLine !== false,
         });
       }
    }
    
    // Fix Issue 3: Update visual price lines WITHOUT reloading data (which would reset scroll)
    if (s.prevDayClose != null) { this.linePrevDayClose = s.prevDayClose; this._updateVisualLines(this.candlesData || []); }
    if (s.highLow != null)      { this.lineHighLow = s.highLow;           this._updateVisualLines(this.candlesData || []); }
    if (s.bidAsk != null)       { this.lineBidAsk = s.bidAsk;             this._updateVisualLines(this.candlesData || []); }
    
    if (s.timezone != null) {
      this.timezone = s.timezone;
      this.chart.applyOptions({
         localization: { timeFormatter: (t) => t ? this._formatTimezone(t) : '' }
      });
    }

    if (s.noOverlapLabels!= null) this.lblNoOverlap  = s.noOverlapLabels;
    if (s.lockPriceToBar != null) this.lockPriceToBar = s.lockPriceToBar;
    
    // ── PRECISION (Data Modification Tab) ──────────────────────
    if (s.precision != null) {
      if (this.precision !== s.precision) {
        this.precision = s.precision;
        // Yeniden price formatı hesaplamak için verinin tekrar yüklenmesini tetikleyebiliriz
        // veya elimizde varsa _lastPrice üzerinden hemen uygulayabiliriz
        if (this._lastPrice != null && this.series) {
          let decimals = 2; // Default fallback
          const p = Math.abs(this._lastPrice);
          if (this.precision === 'Default') decimals = _getDynamicDecimals(p);
          else if (this.precision === 'Integer') decimals = 0;
          else decimals = parseInt(this.precision, 10);
          
          if (!isNaN(decimals)) {
             const minMove = parseFloat((1 / Math.pow(10, decimals)).toFixed(decimals));
             try {
                this.series.applyOptions({
                   priceFormat: { type: 'price', precision: decimals, minMove }
                });
             } catch(_) {}
          }
        }
      }
    }

    // ── VOLUME (Status line tab) ──────────────────────────────
    if (s.showVolume != null && s.showVolume !== this.showVolume) {
      this.setVolume(s.showVolume);
    }

    // ── MARGINS (Canvas tab) ─────────────────────────────────
    const topPct    = s.marginTop    != null ? s.marginTop    / 100 : null;
    const bottomPct = s.marginBottom != null ? s.marginBottom / 100 : null;
    if (topPct !== null || bottomPct !== null) {
      const scaleId = this.priceSide === 'left' ? 'left' : 'right';
      this.chart.priceScale(scaleId).applyOptions({
        scaleMargins: { top: topPct ?? 0.05, bottom: bottomPct ?? 0.15 }
      });
    }

    // ── WATERMARK (Canvas tab) ────────────────────────────────
    if (s.watermarkMode != null) {
      const wmText = s.watermarkMode === 'Ticker'      ? this.symbol
                   : s.watermarkMode === 'Interval'    ? this.tf
                   : s.watermarkMode === 'Description' ? this.symbol
                   : '';
      if (this.wm) this.wm.textContent = wmText;
    }
  }

  // ── Timezone Formatter ────────────────────────────────────
  _formatTimezone(timeObj, isTickMark = false, tickMarkType = null) {
    if (!timeObj) return '';
    
    // LightweightCharts converts 1D+ bars into {year, month, day} BusinessDay objects internally.
    // Convert it back to a pure numeric UTC timestamp before math.
    let numericTime = timeObj;
    if (typeof timeObj === 'object' && timeObj.year !== undefined) {
      numericTime = Date.UTC(timeObj.year, timeObj.month - 1, timeObj.day) / 1000;
    }

    // Use manual offset mapped from selected string instead of relying on Javascript Intl DST bugs
    // Example: "UTC-5 Chicago", "UTC+5 Ashkabat", "UTC"
    let offsetHours = 0;
    if (this.timezone && this.timezone.startsWith('UTC')) {
      const match = this.timezone.match(/UTC([+-]\d+)/);
      if (match) offsetHours = parseInt(match[1], 10);
    }
    
    // Shift timestamp using mathematical offset guaranteeing 100% exact TZ
    const shiftedTimeMs = (numericTime + (offsetHours * 3600)) * 1000;
    const date = new Date(shiftedTimeMs);
    
    if (isTickMark && tickMarkType != null) {
      const yyyy = date.getUTCFullYear();
      const dd   = String(date.getUTCDate()); // No leading zero
      const h    = String(date.getUTCHours()).padStart(2, '0');
      const m    = String(date.getUTCMinutes()).padStart(2, '0');
      const s    = String(date.getUTCSeconds()).padStart(2, '0');

      // TickMarkType:
      // Year = 0, Month = 1, DayOfMonth = 2, Time = 3, TimeWithSeconds = 4
      switch (tickMarkType) {
        case 0: return String(yyyy); // 2026
        case 1: return date.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }); // "Apr"
        case 2: return dd; // "5", "12"
        case 3: return `${h}:${m}`;  // "18:00", "03:00"
        case 4: return `${h}:${m}:${s}`; 
        default: return `${h}:${m}`;
      }
    }

    // ── Crosshair (Tooltip) String Formatting (Mimic TradingView perfectly)
    const dowOptions = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const monthOptions = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    const dow = dowOptions[date.getUTCDay()];
    const dd = String(date.getUTCDate()).padStart(2, '0');
    const mmm = monthOptions[date.getUTCMonth()];
    const yy = String(date.getUTCFullYear()).slice(-2);
    const hh = String(date.getUTCHours()).padStart(2, '0');
    const mmFormat = String(date.getUTCMinutes()).padStart(2, '0');
    const ss = String(date.getUTCSeconds()).padStart(2, '0');

    const tfSecs = this._tfSeconds();
    if (tfSecs < 60) return `${dow} ${dd} ${mmm} '${yy} ${hh}:${mmFormat}:${ss}`;  // Sub-minute includes seconds
    if (tfSecs >= 86400) return `${dow} ${dd} ${mmm} '${yy}`;                  // Daily and above omits time
    return `${dow} ${dd} ${mmm} '${yy} ${hh}:${mmFormat}`;                             // Normal intraday format
  }

  // ── Countdown to bar close ────────────────────────────────
  _tfSeconds() {
    const map = {
      '1m':1*60,'3m':3*60,'5m':5*60,'15m':15*60,'30m':30*60,
      '1H':60*60,'2H':2*60*60,'4H':4*60*60,'6H':6*60*60,'12H':12*60*60,
      '1D':24*60*60,'1W':7*24*60*60,'1M':30*24*60*60,
      // numeric forms
      '1':60,'5':5*60,'15':15*60,
    };
    return map[this.tf] ?? 60*60; // default 1H
  }

  _updateCountdown() {
    if (this._countdownTimer) clearInterval(this._countdownTimer);
    if (!this.lblCountdown) {
      if (this.countdownEl) this.countdownEl.style.display = 'none';
      return;
    }
    if (this.countdownEl) this.countdownEl.style.display = '';
    const tick = () => {
      const tfSec = this._tfSeconds();
      const now   = Math.floor(Date.now() / 1000);
      const rem   = tfSec - (now % tfSec);
      const h   = Math.floor(rem / 3600);
      const m   = Math.floor((rem % 3600) / 60);
      const sec = rem % 60;
      const pad = n => String(n).padStart(2, '0');
      if (this.countdownEl) {
        this.countdownEl.textContent = h > 0
          ? `${h}:${pad(m)}:${pad(sec)}`
          : `${pad(m)}:${pad(sec)}`;
        this._positionCountdown();
      }
    };
    tick();
    this._countdownTimer = setInterval(tick, 1000);
  }

  // Position countdown label directly below the last price label on the price scale
  _positionCountdown() {
    if (!this.countdownEl) return;
    if (!this.lblCountdown || !this.series || this._lastPrice == null) {
      this.countdownEl.style.display = 'none';
      return;
    }
    
    try {
      // Find the y-coordinate of the last price
      const y = this.series.priceToCoordinate(this._lastPrice);
      if (y == null || isNaN(y)) return;
      
      const pScale = this.chart.priceScale(this.priceSide === 'left' ? 'left' : 'right');
      const scaleWidth = pScale.width();

      // Ensure the countdown element is rendered within the cvs container properly,
      // right aligned specifically referencing the scale container width
      this.countdownEl.style.display = '';
      this.countdownEl.style.top  = `${y + 11}px`;  // Move immediately below the active price label 
      this.countdownEl.style.bottom = 'auto';
      this.countdownEl.style.right = '0px';         // Pin to the right extreme edge
      this.countdownEl.style.width = `${scaleWidth}px`; // Match price scale exact width
      this.countdownEl.style.textAlign = 'center';      // Center the text inside the bounds
      this.countdownEl.style.border = 'none';           // Make it look seamless
      this.countdownEl.style.borderTop = '1px solid #2a2e39';
      this.countdownEl.style.borderRadius = '0';
      
      // Match the text color to the exact price background
      this.countdownEl.style.color = '#ffffff';
      
      // Use cached _lastPriceIsUp (from _loadData or realtime updates)
      this.countdownEl.style.background = this._lastPriceIsUp ? this.candleUpColor : this.candleDownColor;
    } catch (_) {}
  }  

  fitContent() { this.chart?.timeScale().fitContent(); }
  goToRealtime() { this.chart?.timeScale().scrollToRealTime(); }

  syncCrosshair(time) {
    if (!this.series || !this.chart || !time) return;
    this.syncing = true;
    try {
      // Fix: Pass time directly — LWC snaps to the nearest bar internally.
      // Removed expensive series.data() call + O(n) linear search (1500 candles each mouse move).
      this.chart.setCrosshairPosition(NaN, time, this.series);
    } catch(_) {}
    this.syncing = false;
  }

  syncRange(range) {
    this.syncing = true;
    try { this.chart.timeScale().setVisibleRange(range); } catch(_) {}
    this.syncing = false;
  }

  resize() {
    if (!this.chart) return;
    const { width, height } = this.cvs.getBoundingClientRect();
    if (width > 0 && height > 0) this.chart.resize(width, height);
  }

  getState() {
    return {
      idx: this.idx,
      symbol: this.symbol, exchange: this.exchange, tf: this.tf, chartType: this.chartType,
      scaleMode: this.scaleMode, priceSide: this.priceSide,
      showGrid: this.showGrid, showVolume: this.showVolume,
      invertScale: this.invertScale,
      // Candle colors
      candleUpColor: this.candleUpColor, candleDownColor: this.candleDownColor,
      borderUpColor: this.borderUpColor, borderDownColor: this.borderDownColor,
      wickUpColor: this.wickUpColor, wickDownColor: this.wickDownColor,
      candleBodyVisible: this.candleBodyVisible, candleBordersVisible: this.candleBordersVisible,
      candleWickVisible: this.candleWickVisible,
      // Canvas colors
      bgType: this.bgType, bgColor1: this.bgColor1, bgColor2: this.bgColor2,
      gridType: this.gridType, gridVertColor: this.gridVertColor, gridHorzColor: this.gridHorzColor,
      crosshairColor: this.crosshairColor, scaleTextColor: this.scaleTextColor,
      scaleFontSize: this.scaleFontSize, scaleLinesColor: this.scaleLinesColor,
      // Labels & lines
      lockPriceToBar: this.lockPriceToBar, scalePriceChartOnly: this.scalePriceChartOnly,
      lblSymbolName: this.lblSymbolName, lblSymbolLastPrice: this.lblSymbolLastPrice,
      lblPrevDayClose: this.lblPrevDayClose, lblPrePost: this.lblPrePost,
      lblHighLow: this.lblHighLow, lblBidAsk: this.lblBidAsk,
      lblIndName: this.lblIndName, lblIndValue: this.lblIndValue,
      lblCountdown: this.lblCountdown, lblNoOverlap: this.lblNoOverlap,
      priceLine: this.priceLine, linePrevDayClose: this.linePrevDayClose,
      linePrePost: this.linePrePost, lineHighLow: this.lineHighLow,
      lineBidAsk: this.lineBidAsk, plusButton: this.plusButton,
    };
  }

  destroy() {
    this._destroyed = true;
    if (this._countdownTimer) clearInterval(this._countdownTimer);
    if (this.ro) this.ro.disconnect();
    // Disconnect live WebSocket feed for this pane
    DataFeed.unload(`pane_${this.idx}`);
    // [ChartPhantom] Clean up the phantom series before destroying the chart pane
    // to avoid memory leaks and stale series references.
    if (window.ChartPhantom) ChartPhantom.destroy(this);
    if (this.chart) { try { this.chart.remove(); } catch(_) {} }
    if (this.wrap?.parentNode) this.wrap.parentNode.removeChild(this.wrap);
  }
}

/* --- pane-manager.js --- */
// ── Pane Manager — layout + resize handles ──────────────────




