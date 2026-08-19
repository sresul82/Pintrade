class ChartPane {
  constructor(idx, savedState = {}) {
    this.idx = idx;
    // ── per-pane settings ─────────────────────────────────
    const s = savedState;
    this.symbol       = s.symbol      ?? DEFAULTS.symbol;
    this.exchange     = s.exchange    ?? (window.State ? State.get('activeExchange') : 'binance');
    // Kaldırılan bir TF (45m/3H) eski localStorage pane state'inde kalmış
    // olabilir — TF_LIST'te yoksa varsayılana düş, yanlış borsa verisi
    // gösterilmesin (Bybit '45m' için sessizce 1H mumu çekiyordu).
    this.tf           = (s.tf && TF_LIST.includes(s.tf)) ? s.tf : DEFAULTS.tf;
    this.chartType    = s.chartType   ?? DEFAULTS.chartType;
    // Heikin Ashi (gorevler2.md izleme listesi, 2026-08-10) — series tipi hâlâ
    // 'candle' kalır (_buildSeries değişmez), sadece render'a giden OHLC verisi
    // IndicatorEngine.calcHeikinAshi ile dönüştürülür. _haPrevClosed, HA'nın
    // kayan hesabı için son KAPANMIŞ bar'ın ha_open/ha_close'unu tutar — bkz.
    // _rebuildHaBase()/_haTransformLive().
    this.useHeikinAshi = s.useHeikinAshi ?? false;
    this._haPrevClosed = null;
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

    // gorevler2.md Görev 11 (2026-08-10) — bu grup applySettings()'te canlı
    // uygulanıyordu ama constructor'da hiç okunmuyor, getState()'te hiç
    // kaydedilmiyordu — kullanıcı değiştirince anında çalışıyor gibi
    // görünüyordu ama sayfa yenilenince sessizce sıfırlanıyordu.
    this.hlValue = s.hlValue ?? true;    this.hlLine = s.hlLine ?? true;
    this.baValue = s.baValue ?? true;    this.baLine = s.baLine ?? true;
    this.pdValue = s.pdValue ?? false;   this.pdLine = s.pdLine ?? true;
    this.symName = s.symName ?? true;    this.symValue = s.symValue ?? true;    this.symLine = s.symLine ?? true;
    this.watermarkMode = s.watermarkMode ?? 'Ticker';
    // Varsayılanlar chart'ın kendi hardcoded scaleMargins'iyle (.05/.15) eşleşiyor
    // — böylece ayarı hiç değiştirmemiş kullanıcıların görünümü değişmez.
    this.marginTop = s.marginTop ?? 5;   this.marginBottom = s.marginBottom ?? 15;

    // Dummy tracking variables for new features
    this._lastPrice = null;
    this._priceLines = {}; // Store custom lines
    this._alertPriceLines = {}; // gorevler2.md Görev 11 — AlertStore çizgileri (id -> priceLine)

    this.chart      = null;
    this.series     = null;
    this.volSeries  = null;
    this.ro         = null;
    this.loaded     = false;
    this.syncing    = false;

    // gorevler2.md Görev 14 (2026-08-11) — Chart İndikatörleri (EMA/DEMA).
    // RSI subpane 2026-08-12'de kaldırılmıştı (v5 migrasyonu bekleniyordu) —
    // 2026-08-18'de v5 native pane API'siyle geri getirildi (bkz.
    // _rebuildIndicatorOverlays/SUBPANE_TYPES). Artık 'rsi' türü de normal
    // şekilde saklanıp geri yükleniyor, filtrelenmiyor.
    this.indicators   = Array.isArray(s.indicators) ? s.indicators.map(i => ({ ...i })) : [];
    this._indSeries   = {};    // id -> LWC line series (overlay: ema/dema aynı ölçek; subpane: rsi kendi pane'i)
    this._indLegendEl = null;
    this._indPaneIndex = {};  // id -> paneIndex (SADECE subpane türleri için, ör. rsi)
    this._indAuxSeries = {};  // id -> {ob, os} BaselineSeries (overbought/oversold gradient dolgu)
    this._indFillEl = {};     // id -> HTML div (bant-arası sabit dolgu overlay'i)
    this._indPriceLines = {}; // id -> [priceLine,...] (30/70 referans çizgileri)
    this._divSeries = {};        // id -> [LineSeries,...] (Regular Bullish/Bearish divergence bağlantı çizgileri)
    this._divMarkersHandle = {}; // id -> LightweightCharts.createSeriesMarkers() handle ("Bull"/"Bear" etiketleri)
    this._indTooltipEl = {};      // id -> HTML div (crosshair üzerindeyken değeri gösteren yüzen badge, OI/Volume panelindeki AYNI desen)
    this._indTooltipHandler = {}; // id -> subscribeCrosshairMove callback (temizlik için referans)

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

    // Watermark — kayıtlı watermarkMode'a göre (bkz. constructor'daki Görev 11 notu,
    // eskiden burası hep this.symbol'e sabitti, restore edilen mod hiç okunmuyordu)
    this.wm = document.createElement('div');
    this.wm.className = 'pane-wm';
    this.wm.textContent = this.watermarkMode === 'Interval' ? this.tf : this.symbol;
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
         if (claimed) {
           e.preventDefault(); e.stopPropagation();
           // Pointer capture: bir çizim sürüklenirken (özellikle "Extend
           // right/left" ile ekran kenarına uzayan Fib seviye çizgileri gibi
           // geniş hedeflerde) fare imleci `this.cvs` sınırlarının dışına
           // çıkarsa, capture olmadan bırakılan (pointerup) olay bu elemente
           // hiç ulaşmıyordu — `_dragState` hiç temizlenmiyor, çizim fareye
           // "yapışık" kalıyordu (bir sonraki tıklamaya kadar). Capture ile
           // imleç nereye giderse gitsin pointermove/pointerup bu elemente
           // teslim edilmeye devam ediyor.
           try { this.cvs.setPointerCapture(e.pointerId); } catch (_) {}
         }
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
      try { if (this.cvs.hasPointerCapture?.(e.pointerId)) this.cvs.releasePointerCapture(e.pointerId); } catch (_) {}
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
    this.rtBtn.innerHTML = ICONS.refreshCircle;
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
        scaleMargins: { top: this.marginTop / 100, bottom: this.marginBottom / 100 },
        visible: this.priceSide === 'right',
        mode: scaleModeMap[this.scaleMode] ?? 0,
        invertScale: this.invertScale,
      },
      leftPriceScale: {
        borderColor: this.scaleLinesColor,
        scaleMargins: { top: this.marginTop / 100, bottom: this.marginBottom / 100 },
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
      // 2026-08-18 (kullanıcı geri bildirimi, RSI subpane) — v5'in panel
      // ayırıcısının varsayılan rengi (#E0E3EB) chart'ın koyu arka fonunda
      // beyaz bir çizgi gibi görünüyordu. `enableResize` varsayılan zaten
      // true (native sürükle-boyutlandır).
      panes: { separatorColor: 'rgba(150,150,150,0.25)', separatorHoverColor: 'rgba(150,150,150,0.4)' },
    });
    
    // Issue #2: Main bottom Time Scale formatting uses dynamic tick types (Time vs Date)
    this.chart.timeScale().applyOptions({
      tickMarkFormatter: (time, tickMarkType, locale) => {
        return this._formatTimezone(time, true, tickMarkType); // dynamic tick mode
      }
    });

    this._buildSeries();

    // gorevler2.md Görev 14 — kayıtlı state'ten geri yüklenen indikatörlerin
    // series/alt-chart'ları burada kurulur (veri henüz gelmedi, değerler
    // _onFeedCandles gelince _recomputeAllIndicators() ile doldurulur).
    // [2026-08-18 DÜZELTME] RSI subpane'inin burada (chart hâlâ yer tutucu
    // width:100/height:100 boyutundayken, ResizeObserver henüz bağlanmadan)
    // kurulması, pane'in stretchFactor'ünün yanlış bir taban üzerinden
    // hesaplanmasına yol açıyordu — kullanıcı bulgusu: "sayfa yeni
    // yüklendiğinde RSI grafiği pencere dışında kalıyor". `_chartReady`
    // false olduğu sürece _rebuildIndicatorOverlays subpane türlerini
    // atlar (bkz. o fonksiyonun başı) — ResizeObserver'ın İLK gerçek
    // resize'ında tekrar çağrılıp o zaman kurulacaklar.
    this._chartReady = false;
    if (this.indicators.length) this._rebuildIndicatorOverlays();

    this.chart.subscribeCrosshairMove(p => {
      this._onCrosshairMove(p);
      this._syncDrawingCanvasClip(); // Fix Issue 1: dynamic scale width
      if (this.redrawDrawings) this.redrawDrawings();
    });
    // NOT (2026-08-18): RSI panelinde çift-tıkla ayar açma denendi ama LWC'nin
    // dblclick param'ının hangi pane'e denk geldiğini güvenilir şekilde
    // doğrulayamadım (otomatik test ortamında koordinat ölçekleme sorunu
    // yüzünden) — riskli/yarım bir özellik eklemek yerine ŞİMDİLİK atlandı.
    // Ayar penceresine erişim: sol-üst legend'deki ⚙ ikonu (zaten çalışıyor).
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
          // RSI bant-arası dolgu overlay'i pane yüksekliğine bağlı — resize'da yeniden konumlan.
          if (this.indicators.some(i => ChartPane.SUBPANE_TYPES.has(i.type))) this._repositionIndicatorFills();

          if (!this._chartReady) {
            // Chart artık GERÇEK boyutunda — daha önce (constructor'da, hâlâ
            // 100x100 yer tutucuyken) atlanan subpane türü göstergeleri
            // (RSI) şimdi doğru taban üzerinden kur.
            this._chartReady = true;
            if (this.indicators.some(i => ChartPane.SUBPANE_TYPES.has(i.type))) this._rebuildIndicatorOverlays();
          }
          if (!this.loaded) { this.loaded = true; this._loadData(); }
        }
      }
    });
    this.ro.observe(this.cvs);

    // [DÜZELTME 2026-08-19] LWC v5'in KENDİ pane-yükseklik ayırıcısını (ana
    // chart ile RSI alt paneli arasındaki bölücü çizgi) sürüklemek `this.cvs`'nin
    // TOPLAM boyutunu değiştirmez — sadece pane'ler arası dikey oranı — bu yüzden
    // yukarıdaki ResizeObserver HİÇ tetiklenmiyordu. Sonuç: RSI'nin bant-arası
    // dolgu overlay div'i (bkz. _repositionIndicatorFills) eski/yanlış konumda
    // kalıp pane'i kaplayan devasa bir bloğa dönüşebiliyordu (kullanıcı bulgusu).
    // Bölücüyü tespit etmeye çalışmak yerine (kırılgan) — cvs üzerinde herhangi
    // bir mouse-down sürdüğü sürece (RSI dahil pane sürükleme, çizim, vb.)
    // dolguyu her karede yeniden konumla; ucuz bir işlem (birkaç priceToCoordinate).
    this.cvs.addEventListener('mousedown', () => {
      if (!this.indicators.some(i => ChartPane.SUBPANE_TYPES.has(i.type))) return;
      let raf;
      const loop = () => { this._repositionIndicatorFills(); raf = requestAnimationFrame(loop); };
      raf = requestAnimationFrame(loop);
      const stop = () => { cancelAnimationFrame(raf); document.removeEventListener('mouseup', stop); };
      document.addEventListener('mouseup', stop);
    });

    // [DENEYSEL — kullanıcı isteği 2026-08-15, kullanışsız bulunursa bu blok +
    // dblclick handler'ındaki autoScale:true satırı silinerek eski davranışa
    // dönülebilir, başka hiçbir şeye bağımlı değil.] Fare tekerleğiyle zoom
    // yapılırken fiyat ekseni "auto-scale" olduğu için görünen mum sayısı
    // değişince dikey eksen de kendiliğinden yeniden ölçekleniyordu (ayrı bir
    // "dikey zoom" değil, autoScale'in yan etkisi). capture:true ile native
    // handleScale.mouseWheel işlemeden ÖNCE autoScale'i kapatıp dikey ekseni
    // sabitliyoruz — TV'nin manuel fiyat ölçeği moduyla aynı davranış, geri
    // dönüşü de aynı şekilde çift tıklama.
    this.cvs.addEventListener('wheel', () => {
      try {
        const ps = this.series?.priceScale();
        if (ps && ps.options().autoScale) ps.applyOptions({ autoScale: false });
      } catch(_) {}
    }, { capture: true, passive: true });

    // [FIX] Zaman cetveline çift tıklandığında fitContent() phantom'ın 500 barını
    // da ekrana sığdırır — mumlar sola kayar. Çift tıklamayı yakalayıp gerçek
    // mum aralığına geri döneriz.
    this.cvs.addEventListener('dblclick', () => {
      // Çift tıklama anında gerçek mumların logical range'ini hesapla
      const candles = this.candlesData;
      if (!candles || candles.length === 0) return;

      // Dikey eksen tekerlek-zoom'la kilitlenmiş olabilir (yukarıdaki deneysel
      // blok) — çift tıklama aynı zamanda fiyat ölçeğini de sıfırlasın.
      try { this.series?.priceScale().applyOptions({ autoScale: true }); } catch(_) {}

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

    // gorevler2.md Görev 11 (2026-08-10) — AlertStore çizgilerini canlı tut.
    const _onAlertChange = (a) => { if (!a || a.symbol === this.symbol) this._updateAlertLines(); };
    EventBus.on('alert:created',      _onAlertChange);
    EventBus.on('alert:removed',      () => this._updateAlertLines());
    EventBus.on('alert:triggered',    _onAlertChange);
    EventBus.on('alert:prefsChanged', () => this._updateAlertLines());
  }

  // ── Global Drawing Refresh ──────────────────────────────
  redrawDrawings() {
    if (window.DrawingManager) window.DrawingManager.renderPane(this);
  }

  _syncDrawingCanvasClip() {
    if (!this.drawingCanvas || !this.chart) return;
    try {
      const pScale     = this.chart.priceScale(this.priceSide === 'left' ? 'left' : 'right');
      const scaleW     = pScale.width() || 65;   // fallback 65px if not yet rendered
      const timeScaleH = 22;                      // LW Charts time scale is always ~22px at default font

      const dpr  = window.devicePixelRatio || 1;
      const rect = this.cvs.getBoundingClientRect();
      const canvasW = Math.max(1, Math.round((rect.width - scaleW) * dpr));
      const canvasH = Math.max(1, Math.round((rect.height - timeScaleH) * dpr));

      // Kırpma işlemi: Çizim alanı fiyat ve zaman cetvelinin üzerine taşmasın.
      this.drawingCanvas.style.width  = `${rect.width - scaleW}px`;
      this.drawingCanvas.style.height = `${rect.height - timeScaleH}px`;
      this.drawingCanvas.style.top = '0px';

      // Fiyat cetveli soldaysa çizim alanını sağa kaydır, sağdaysa sola yapıştır.
      if (this.priceSide === 'left') {
          this.drawingCanvas.style.left = `${scaleW}px`;
      } else {
          this.drawingCanvas.style.left = '0px';
      }

      // Update pixel buffer only if size actually changed (avoid unnecessary redraws)
      if (this.drawingCanvas.width !== canvasW || this.drawingCanvas.height !== canvasH) {
        this.drawingCanvas.width  = canvasW;
        this.drawingCanvas.height = canvasH;
      }
    } catch (_) {}
  }

  _buildSeries() {
    if (this.series)    try { this.chart.removeSeries(this.series);    } catch(_) {}
    if (this.volSeries) try { this.chart.removeSeries(this.volSeries); } catch(_) {}
    // Seri kaldırılınca ona bağlı price-line referansı da geçersiz olur —
    // sıfırlanmazsa _updateLivePriceLine() eski (artık var olmayan) seriye
    // applyOptions() çağırır, bu sessizce başarısız olur ve fiyat çizgisi
    // (mumdan fiyat cetveline uzanan noktalı çizgi) bir daha hiç görünmez.
    // 2026-08-10, Heikin Ashi açılışında keşfedildi ama her seri yeniden
    // kurulumunu (chart tipi/stil değişimi) etkileyen genel bir bug'dı.
    this._livePriceLine = null;
    this._alertPriceLines = {}; // aynı sebep — eski seriye bağlı referanslar geçersiz olur
    this.series = this.volSeries = null;

    const pScaleId = this.priceSide === 'left' ? 'left' : 'right';

    if (this.showVolume) {
      this.volSeries = this.chart.addSeries(LightweightCharts.HistogramSeries, {
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
        this.series = this.chart.addSeries(LightweightCharts.LineSeries, { color: COLORS.accent, lineWidth: 2, priceScaleId: pScaleId, priceFormat: _defaultPF });
        break;
      case 'area':
        this.series = this.chart.addSeries(LightweightCharts.AreaSeries, {
          topColor: 'rgba(0,184,196,.3)', bottomColor: 'rgba(0,184,196,.02)',
          lineColor: COLORS.accent, lineWidth: 2, priceScaleId: pScaleId, priceFormat: _defaultPF,
        });
        break;
      case 'bar':
        this.series = this.chart.addSeries(LightweightCharts.BarSeries, {
          upColor: up, downColor: down, priceScaleId: pScaleId, priceFormat: _defaultPF,
        });
        break;
      default: // candle
        this.series = this.chart.addSeries(LightweightCharts.CandlestickSeries, {
          upColor: up,   downColor: down,
          borderUpColor: bUp, borderDownColor: bDn,
          wickUpColor: wUp,   wickDownColor: wDn,
          priceScaleId: pScaleId, priceFormat: _defaultPF,
        });
    }

    if (this.series) {
      this.series.applyOptions({
        // Heikin Ashi'de TradingView'daki gibi İKİ fiyat gösterilir: serinin
        // kendi last-value etiketi (HA kapanışı, mumun kendi rengiyle) +
        // ayrıca _livePriceLine (ham/gerçek piyasa fiyatı, kesikli çizgi +
        // geri sayım). Normal mumda HA kapanışı=ham kapanış olduğu için
        // ikinci etiket gereksiz/yanıltıcı, bu yüzden sadece HA modunda
        // açılıyor (2026-08-10, kullanıcı isteği — TradingView karşılaştırması).
        lastValueVisible: this.useHeikinAshi === true,
        priceLineVisible: this.symLine !== false,
        title: '',
      });
    }

    // [ChartPhantom] Initialize the invisible phantom series that extends the time
    // axis to the right. Called every time the series is rebuilt (chart type change,
    // symbol change, TF change) so the extension is always in sync.
    if (window.ChartPhantom) ChartPhantom.init(this);
  }

  // ══════════════════════════════════════════════════════════════
  // gorevler2.md Görev 14 (2026-08-11) — Chart İndikatörleri (EMA/DEMA).
  // RSI subpane 2026-08-12'de KALDIRILDI: lightweight-charts v4.1.3'te
  // native "pane" desteği yok (v5'te geldi). İki ayrı deneme yapıldı —
  // (1) ikinci bir createChart() örneği + elle senkron: gerçek kullanımda
  // tekrar tekrar hizasızlık/kilitlenmeye yol açtı; (2) aynı chart'ın
  // ikinci fiyat ekseni (volume histogramıyla aynı teknik): hizalama
  // düzeldi ama LWC v4'ün küçük-marjlı ikinci eksende etiket sızdırma
  // kısıtı yüzünden 0-100 seviyeleri düzgün gösterilemedi. Kullanıcı
  // kararı: RSI (ve MACD/Stochastic gibi subpane gerektiren diğer
  // indikatörler) v5 migrasyonu ayrı bir görev olarak ele alınana kadar
  // eklenmeyecek (bkz. gorevler3.md izleme listesi). EMA/DEMA (mumlarla
  // aynı ölçekte overlay) etkilenmedi, çalışmaya devam ediyor.
  // indicator-engine.js'deki calcEMAFull/calcDEMAFull TV'nin ta.ema()'sıyla
  // birebir eşleşen SMA-seed matematiği kullanıyor.
  // ══════════════════════════════════════════════════════════════

  /** Mumların kullandığı ('right' veya 'left') asıl fiyat ekseninin ID'si. */
  _mainScaleId() { return this.priceSide === 'left' ? 'left' : 'right'; }

  /** indicators: [{id, type:'ema'|'dema'|'rsi', period, color}] eklenir/kaldırılır.
   *  'ema'/'dema': ana panelde overlay (mumlarla aynı ölçek).
   *  'rsi': v5 native pane API'siyle AYRI bir alt-panel (subpane) — TV'deki
   *  gibi sabit 0-100 eksen + 30/70 referans çizgileri. */
  addIndicator(type, opts = {}) {
    const DEFAULT_COLOR = { ema: '#2962ff', dema: '#ff9800', rsi: '#a855f7' };
    const DEFAULT_PERIOD = { ema: 20, dema: 9, rsi: 14 };
    const cfg = {
      id: 'ind_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      type,
      period: opts.period ?? DEFAULT_PERIOD[type] ?? 14,
      color: opts.color || DEFAULT_COLOR[type] || '#2962ff',
    };
    if (type === 'rsi') {
      // 2026-08-18 (kullanıcı geri bildirimi) — TV'nin RSI ayar penceresine
      // (Inputs/Style) karşılık gelen alanlar. `opts` ile açıkça verilenler
      // korunur, verilmeyenler ChartPane.RSI_DEFAULTS_APPLY'nin varsayılanlarına
      // düşer (eski/kayıtlı state'te de AYNI fonksiyon kullanılıyor, tek yerden).
      Object.assign(cfg, opts);
      ChartPane.RSI_DEFAULTS_APPLY(cfg);
    }
    this.indicators.push(cfg);
    this._rebuildIndicatorOverlays();
    this._recomputeAllIndicators();
    EventBus.emit('pane:indicatorsChanged', { paneIdx: this.idx });
    return cfg;
  }

  removeIndicator(id) {
    const idx = this.indicators.findIndex(i => i.id === id);
    if (idx === -1) return;
    this.indicators.splice(idx, 1);
    this._rebuildIndicatorOverlays();
    EventBus.emit('pane:indicatorsChanged', { paneIdx: this.idx });
  }

  updateIndicatorSettings(id, patch) {
    const cfg = this.indicators.find(i => i.id === id);
    if (!cfg) return;
    Object.assign(cfg, patch);
    this._rebuildIndicatorOverlays();
    this._recomputeAllIndicators();
    EventBus.emit('pane:indicatorsChanged', { paneIdx: this.idx });
  }

  // Subpane (ana panelden ayrı, kendi eksenli) gösterge türleri — şimdilik
  // sadece RSI (Faz 1). Faz 2'de WaveTrend eklenince kendi paneIndex'i
  // (2) alacak, RSI'nin sabit index=1'ine dokunmayacak.
  static SUBPANE_TYPES = new Set(['rsi']);
  static SUBPANE_INDEX = { rsi: 1 };

  /** Eski (Faz 1) kayıtlı state'te veya elle oluşturulan cfg'lerde eksik
   *  olabilecek RSI stil alanlarını cfg üzerine YAZAR (mutate) — addIndicator
   *  ile YENİ eklenenler zaten dolu gelir, bu sadece geriye dönük/eksik
   *  durumlar için güvenlik ağı. */
  static RSI_DEFAULTS_APPLY(cfg) {
    if (cfg.type !== 'rsi') return cfg;
    cfg.upperBand ??= 70;
    cfg.middleBand ??= 50;
    cfg.lowerBand ??= 30;
    cfg.bandColor ??= 'rgba(150,150,150,0.5)';
    cfg.fillColor ??= 'rgba(150,150,150,0.06)';
    cfg.obColor ??= 'rgba(34,197,94,0.35)';
    cfg.osColor ??= 'rgba(239,68,68,0.35)';
    cfg.markerColor ??= null;
    cfg.markerRadius ??= 2;
    cfg.divergenceEnabled ??= false;
    // 2026-08-18 — Visibility sekmesi (kullanıcı isteği, Trendline
    // ayar penceresindeki "Visibility" sekmesiyle aynı tasarım dili).
    cfg.showBandLines ??= true;
    cfg.showFill ??= true;
    cfg.showOB ??= true;
    cfg.showOS ??= true;
    // TV Inputs sekmesi paritesi — Source + RSI-based MA (Smoothing).
    cfg.source ??= 'close';
    cfg.maType ??= 'none'; // 'none' | 'sma' | 'ema' | 'smma' | 'wma'
    cfg.maLength ??= 14;
    cfg.maColor ??= '#f7c948';
    cfg.showMA ??= true;
    // TV Style sekmesi — Output/Input values.
    cfg.precision ??= null; // null = 'Default' (2 ondalık)
    cfg.showPriceLabels ??= true;
    cfg.showValuesInStatusLine ??= true;
    cfg.showInputsInStatusLine ??= true;
    // 2026-08-19 — TV Style sekmesinde HER satırın kendi göster/gizle
    // checkbox'ı var (RSI line, RSI-based MA, Regular Bullish/Bearish).
    // Band/Fill/OB/OS satırları BİLEREK ayrı bir alan açmıyor — Visibility
    // sekmesindeki showBandLines/showFill/showOB/showOS'un AYNISINI kullanıyor
    // (tek doğruluk kaynağı, iki giriş noktası — TV'nin kendi Visibility
    // sekmesi farklı bir amaca hizmet ettiği için burada basitleştirildi).
    cfg.showLine ??= true;
    // Regular Bullish/Bearish divergence — çizgi + etiket TEK anahtarla
    // (TV'deki ayrı "...Label" satırı BİLEREK birleştirildi, kapsam netleşti).
    cfg.showDivBullish ??= true;
    cfg.showDivBearish ??= true;
    cfg.bullColor ??= '#26a69a';
    cfg.bearColor ??= '#ef5350';
    // 2026-08-19 — TV'deki gibi her çizgi türünün kendi kalınlık+stili var
    // (proje genelinde kullanılan dsd-color-picker.js'in showCombinedLineSettings
    // combo'suyla ayarlanıyor — bkz. app.js).
    cfg.width ??= 2;         // RSI çizgisi
    cfg.lineStyle ??= 'solid';
    cfg.maWidth ??= 1;
    cfg.maStyle ??= 'solid';
    cfg.bullWidth ??= 1;
    cfg.bullStyle ??= 'solid';
    cfg.bearWidth ??= 1;
    cfg.bearStyle ??= 'solid';
    // 2026-08-19 (kullanıcı isteği #6) — Upper/Middle/Lower bandın rengi/
    // kalınlığı/stili artık BAĞIMSIZ (önceki turda tek paylaşılan
    // bandColor/bandWidth/bandStyle'a yazıyordu, kullanıcı ayrı ayrı
    // ayarlanabilmesini istedi). Eski `bandColor`/`bandWidth`/`bandStyle`
    // alanları (varsa) geriye dönük uyumluluk için İLK DEĞER olarak kullanılır.
    cfg.upperBandColor ??= cfg.bandColor ?? 'rgba(150,150,150,0.5)';
    cfg.upperBandWidth ??= cfg.bandWidth ?? 1;
    cfg.upperBandStyle ??= cfg.bandStyle ?? 'dashed';
    cfg.middleBandColor ??= cfg.bandColor ?? 'rgba(150,150,150,0.5)';
    cfg.middleBandWidth ??= cfg.bandWidth ?? 1;
    cfg.middleBandStyle ??= cfg.bandStyle ?? 'dashed';
    cfg.lowerBandColor ??= cfg.bandColor ?? 'rgba(150,150,150,0.5)';
    cfg.lowerBandWidth ??= cfg.bandWidth ?? 1;
    cfg.lowerBandStyle ??= cfg.bandStyle ?? 'dashed';
    // TV Inputs sekmesi — Calculation (Timeframe + Wait for timeframe closes).
    // ŞİMDİLİK sadece 'chart' fonksiyonel — kullanıcı farklı bir TF seçerse o
    // TF'in kendi mum akışını çekmek gerekir; bu, sunucunun paylaşılan Binance
    // ağırlık bütçesini büyütür (bkz. CLAUDE.md "paylaşılan IP bütçesi" notu),
    // o yüzden BİLEREK ayrı bir onaya bırakıldı — alan sadece saklanıyor.
    cfg.calcTimeframe ??= 'chart';
    cfg.waitForTfClose ??= true;
    return cfg;
  }

  /** cfg.precision (null=Default) → LWC priceFormat için ondalık sayısı. */
  static RSI_PRECISION_DECIMALS(cfg) {
    const p = parseInt(cfg.precision, 10);
    return Number.isFinite(p) && p >= 0 ? p : 2;
  }

  /** dsd-color-picker.js'in 'solid'/'dashed'/'dotted' string'lerini LWC'nin
   *  LineStyle enum'una çevirir. */
  static LWC_LINE_STYLE(styleKey) {
    return styleKey === 'dashed' ? LightweightCharts.LineStyle.Dashed
      : styleKey === 'dotted' ? LightweightCharts.LineStyle.Dotted
      : LightweightCharts.LineStyle.Solid;
  }

  /** cfg.source'a göre bar dizisinden RSI'nin çalışacağı kaynak diziyi üretir. */
  static RSI_SOURCE_SERIES(candles, source) {
    switch (source) {
      case 'open':  return candles.map(d => d.open);
      case 'high':  return candles.map(d => d.high);
      case 'low':   return candles.map(d => d.low);
      case 'hl2':   return candles.map(d => (d.high + d.low) / 2);
      case 'hlc3':  return candles.map(d => (d.high + d.low + d.close) / 3);
      case 'ohlc4': return candles.map(d => (d.open + d.high + d.low + d.close) / 4);
      default:      return candles.map(d => d.close); // 'close'
    }
  }

  /** Aktif `this.indicators`e göre series'leri (yeniden) kurar. */
  _rebuildIndicatorOverlays() {
    const wanted = new Set(this.indicators.map(i => i.id));

    // Artık listede olmayan series'leri kaldır — subpane türündeyse (ör. RSI)
    // ve o pane'de BAŞKA seri kalmadıysa, pane'in kendisini de kapat (TV'deki
    // gibi — gösterge silinince alt panel tamamen kaybolsun, boş şerit kalmasın).
    Object.keys(this._indSeries).forEach(id => {
      if (!wanted.has(id)) {
        const removedPaneIndex = this._indPaneIndex[id];
        // Divergence bağlantı çizgileri + "Bull"/"Bear" marker primitive'i —
        // ana RSI serisi silinmeden ÖNCE temizle (markers primitive o seriye tutunuyor).
        (this._divSeries[id] || []).forEach(s => { try { this.chart.removeSeries(s); } catch (_) {} });
        delete this._divSeries[id];
        try { this._divMarkersHandle[id]?.detach?.(); } catch (_) {}
        delete this._divMarkersHandle[id];
        try { this.chart.removeSeries(this._indSeries[id]); } catch (_) {}
        delete this._indSeries[id];
        delete this._indPaneIndex[id];
        // OB/OS yardımcı serileri + bant-arası dolgu div'i (bkz. aşağı) da temizle.
        const aux = this._indAuxSeries[id];
        if (aux) {
          try { this.chart.removeSeries(aux.ob); } catch (_) {}
          try { this.chart.removeSeries(aux.os); } catch (_) {}
          if (aux.ma) { try { this.chart.removeSeries(aux.ma); } catch (_) {} }
          delete this._indAuxSeries[id];
        }
        if (this._indFillEl[id]) { this._indFillEl[id].remove(); delete this._indFillEl[id]; }
        if (this._indTooltipHandler[id]) { try { this.chart.unsubscribeCrosshairMove(this._indTooltipHandler[id]); } catch (_) {} delete this._indTooltipHandler[id]; }
        if (this._indTooltipEl[id]) { this._indTooltipEl[id].remove(); delete this._indTooltipEl[id]; }
        if (removedPaneIndex != null) {
          const stillUsed = Object.values(this._indPaneIndex).includes(removedPaneIndex);
          if (!stillUsed) {
            try { this.chart.removePane(removedPaneIndex); } catch (_) {}
          }
        }
      }
    });

    this.indicators.forEach(cfg => {
      const isSubpane = ChartPane.SUBPANE_TYPES.has(cfg.type);
      // Chart hâlâ yer tutucu boyuttaysa (ilk gerçek resize olmadıysa) subpane
      // türü göstergeleri KURMA — bkz. constructor'daki `_chartReady` notu.
      // Overlay türleri (ema/dema) bundan etkilenmez, hemen kurulabilirler.
      if (isSubpane && !this._chartReady) return;
      if (this._indSeries[cfg.id]) {
        const decimals = isSubpane ? ChartPane.RSI_PRECISION_DECIMALS(cfg) : null;
        // TV Style sekmesi — "RSI" satırının checkbox'ı kapalıysa çizgiyi
        // saydam yap (band/fill/MA/divergence çizimleri etkilenmez).
        const lineColor = (isSubpane && cfg.showLine === false) ? 'rgba(0,0,0,0)' : cfg.color;
        this._indSeries[cfg.id].applyOptions({
          color: lineColor,
          ...(isSubpane ? {
            lineWidth: cfg.width,
            lineStyle: ChartPane.LWC_LINE_STYLE(cfg.lineStyle),
            crosshairMarkerRadius: cfg.markerRadius,
            crosshairMarkerBackgroundColor: cfg.markerColor || cfg.color,
            crosshairMarkerBorderColor: cfg.markerColor || cfg.color,
            lastValueVisible: cfg.showPriceLabels,
            priceFormat: { type: 'price', precision: decimals, minMove: 1 / Math.pow(10, decimals) },
          } : {}),
        });
        if (isSubpane) {
          this._rebuildSubpaneAux(cfg);
          // [DÜZELTME 2026-08-19] Stretch factor'ü SADECE ilk kurulumda değil,
          // HER rebuild'de yeniden uygula — kullanıcı bulgusu: sayfa yenilenince
          // (F5) RSI paneli bazen görünmez/yanlış boyutta kalıyor, sadece fiyat
          // eksenine çift tıklayınca (autoScale reset) geri geliyordu. Kesin kök
          // neden bu sandbox'ta (chart hiç compositing yapmıyor) doğrulanamadı —
          // bu, LWC'nin pane stretch factor'ünü reload/resize sırasında sıfırlama
          // ihtimaline karşı ucuz/zararsız bir savunma. Sorun devam ederse
          // raporla, kök nedeni ayrıca araştırmak gerekecek.
          const p = this.chart.panes()[this._indPaneIndex[cfg.id]];
          if (p) p.setStretchFactor(0.3);
        }
        return;
      }
      if (isSubpane) {
        const paneIndex = ChartPane.SUBPANE_INDEX[cfg.type];
        const decimals = ChartPane.RSI_PRECISION_DECIMALS(cfg);
        const lineColor = cfg.showLine === false ? 'rgba(0,0,0,0)' : cfg.color;
        const series = this.chart.addSeries(LightweightCharts.LineSeries, {
          color: lineColor, lineWidth: cfg.width, lineStyle: ChartPane.LWC_LINE_STYLE(cfg.lineStyle),
          priceScaleId: 'right', // OB/OS yardımcı serileriyle (bkz. _rebuildSubpaneAux) AYNI ölçek
          priceFormat: { type: 'price', precision: decimals, minMove: 1 / Math.pow(10, decimals) },
          lastValueVisible: cfg.showPriceLabels, priceLineVisible: false,
          // 2026-08-18 (kullanıcı geri bildirimi) — varsayılan yarıçap (4)
          // büyük geliyordu, ayrıca rengi ayarlardan değiştirilebilir olmalı.
          crosshairMarkerRadius: cfg.markerRadius,
          crosshairMarkerBackgroundColor: cfg.markerColor || cfg.color,
          crosshairMarkerBorderColor: cfg.markerColor || cfg.color,
          autoscaleInfoProvider: () => ({ priceRange: { minValue: 0, maxValue: 100 } }),
        }, paneIndex);
        // [DÜZELTME 2026-08-19, 4. tur — F5 sonrası RSI'nin GERÇEK kök nedeni]
        // Kullanıcının konsol çıktısıyla doğrulandı: F5 sonrası
        // `series.priceToCoordinate(cfg._lastValue)` **0** dönüyordu (fiyat
        // ekseni hiç kurulmamış demek) — fiyat eksenine çift tıklayınca
        // (LWC'nin dahili "autoScale'e sıfırla" davranışı) düzeliyordu ve
        // KALICI oluyordu. `autoScale:false` + sabit `autoscaleInfoProvider`
        // kombinasyonu, ölçeğin bazı ilk-kurulum sıralamalarında HİÇ
        // hesaplanmadan kalmasına yol açıyordu. OB/OS/MA yardımcı serileri
        // (bkz. _rebuildSubpaneAux) zaten SADECE `autoscaleInfoProvider`
        // kullanıyor, `autoScale:false` hiç YOK — ve onlarda bu sorun hiç
        // bildirilmedi. Ana RSI serisini de AYNI (daha güvenilir) desene
        // getiriyoruz: `autoScale:false` satırı TAMAMEN kaldırıldı,
        // `autoscaleInfoProvider` (sabit 0-100) tek başına aralığı zorluyor.
        series.priceScale().applyOptions({ borderVisible: true });
        this._indSeries[cfg.id] = series;
        this._indPaneIndex[cfg.id] = paneIndex;
        this._rebuildSubpaneAux(cfg);
        this._attachRsiTooltip(cfg);
        // Ana panele göre küçük bir şerit — TV'deki RSI alt panelinin oranına yakın.
        const pane = this.chart.panes()[paneIndex];
        if (pane) pane.setStretchFactor(0.3);
      } else {
        this._indSeries[cfg.id] = this.chart.addSeries(LightweightCharts.LineSeries, {
          color: cfg.color, lineWidth: 2, priceScaleId: this._mainScaleId(),
          priceFormat: { type: 'price', precision: 8, minMove: 0.00000001 },
          lastValueVisible: false, priceLineVisible: false,
        });
      }
    });

    this._updateIndicatorLegend();
  }

  /** RSI (subpane) için: 30/70 referans çizgileri (cfg.bandColor) + overbought/
   *  oversold gradient dolguları (iki BaselineSeries, custom-series/canvas
   *  yazmadan native LWC ile) + iki bant arasındaki sabit dolgu (HTML overlay,
   *  fiyat ekseni sabit 0-100 olduğu için sadece pane yüksekliği değişince
   *  yeniden konumlanması yeterli, bkz. _repositionIndicatorFills). Ayar
   *  değişikliğinde (updateIndicatorSettings) baştan kurulur — ucuz, seyrek. */
  _rebuildSubpaneAux(cfg) {
    const series = this._indSeries[cfg.id];
    if (!series) return;
    // [2026-08-18 DÜZELTME] Faz 1'de kaydedilmiş ESKİ persisted state'te
    // (localStorage `paneStates`) bu yeni alanlar yok — cfg'ye kalıcı olarak
    // (bir kereliğine) yaz, aksi halde her seferinde undefined'a düşüp
    // baseValue/priceToCoordinate NaN/null üretirdi (bkz. kullanıcı bulgusu:
    // dolgu overlay'i "display:none" kalıyordu).
    ChartPane.RSI_DEFAULTS_APPLY(cfg);
    const paneIndex = this._indPaneIndex[cfg.id];

    // Eski referans çizgilerini/yardımcı serileri temizle (renk/değer değişmiş olabilir).
    try { series.removePriceLine?.(); } catch (_) {}
    (this._indPriceLines?.[cfg.id] || []).forEach(l => { try { series.removePriceLine(l); } catch (_) {} });
    this._indPriceLines = this._indPriceLines || {};
    // Visibility sekmesi: "Show band lines" kapalıysa hiç çizme.
    // TV paritesi (2026-08-18) — Middle Band (50) da Upper/Lower ile aynı yerde.
    // 2026-08-19 (kullanıcı isteği #6) — üçü artık BAĞIMSIZ renk/kalınlık/stil.
    this._indPriceLines[cfg.id] = cfg.showBandLines
      ? [
          [cfg.lowerBand, cfg.lowerBandColor, cfg.lowerBandWidth, cfg.lowerBandStyle],
          [cfg.middleBand, cfg.middleBandColor, cfg.middleBandWidth, cfg.middleBandStyle],
          [cfg.upperBand, cfg.upperBandColor, cfg.upperBandWidth, cfg.upperBandStyle],
        ].map(([price, color, width, style]) => series.createPriceLine({
          price, color, lineWidth: width,
          lineStyle: ChartPane.LWC_LINE_STYLE(style), axisLabelVisible: true, title: '',
        }))
      : [];

    // Visibility sekmesi: OB/OS kapalıysa dolgu renklerini tamamen saydam yap
    // (seriyi silip pane'i yeniden düzenlemek yerine — daha ucuz/basit).
    const obFillTop1 = cfg.showOB ? cfg.obColor : 'rgba(0,0,0,0)';
    const obFillTop2 = cfg.showOB ? this._fadeColor(cfg.obColor) : 'rgba(0,0,0,0)';
    const osFillBottom1 = cfg.showOS ? this._fadeColor(cfg.osColor) : 'rgba(0,0,0,0)';
    const osFillBottom2 = cfg.showOS ? cfg.osColor : 'rgba(0,0,0,0)';

    const existingAux = this._indAuxSeries[cfg.id];
    if (existingAux) {
      existingAux.ob.applyOptions({ topFillColor1: obFillTop1, topFillColor2: obFillTop2 });
      existingAux.os.applyOptions({ bottomFillColor1: osFillBottom1, bottomFillColor2: osFillBottom2 });
      if (existingAux.ma) {
        const maVisible = cfg.maType !== 'none' && cfg.showMA;
        existingAux.ma.applyOptions({
          color: maVisible ? cfg.maColor : 'rgba(0,0,0,0)',
          lineWidth: cfg.maWidth, lineStyle: ChartPane.LWC_LINE_STYLE(cfg.maStyle),
        });
      }
    } else {
      const transparent = 'rgba(0,0,0,0)';
      // [2026-08-18 DÜZELTME] Ana RSI serisiyle AYNI price scale + sabit
      // 0-100 autoscale bilgisini AÇIKÇA paylaştır — aksi halde bu iki yeni
      // seri kendi bağımsız otomatik ölçeğine göre çizilip dolgu ya hiç
      // görünmüyor ya da yanlış hizada render oluyordu (kullanıcı bulgusu:
      // "overbuy dolgusunu göremiyorum"). LWC v5'te seriden scale ID'sini
      // OKUMANIN bir yolu yok (`priceScaleId()`/`.id` gibi bir getter mevcut
      // değil, doğrulandı) — bu yüzden hem ana RSI serisine hem buradaki iki
      // seriye AYNI sabit `'right'` ID'si açıkça veriliyor.
      const sharedScaleId = 'right';
      const sharedAutoscale = () => ({ priceRange: { minValue: 0, maxValue: 100 } });
      const ob = this.chart.addSeries(LightweightCharts.BaselineSeries, {
        baseValue: { type: 'price', price: cfg.upperBand },
        priceScaleId: sharedScaleId,
        autoscaleInfoProvider: sharedAutoscale,
        topLineColor: transparent, bottomLineColor: transparent,
        topFillColor1: obFillTop1, topFillColor2: obFillTop2,
        bottomFillColor1: transparent, bottomFillColor2: transparent,
        lineWidth: 1, lastValueVisible: false, priceLineVisible: false, crosshairMarkerVisible: false,
      }, paneIndex);
      const os = this.chart.addSeries(LightweightCharts.BaselineSeries, {
        baseValue: { type: 'price', price: cfg.lowerBand },
        priceScaleId: sharedScaleId,
        autoscaleInfoProvider: sharedAutoscale,
        topLineColor: transparent, bottomLineColor: transparent,
        topFillColor1: transparent, topFillColor2: transparent,
        bottomFillColor1: osFillBottom1, bottomFillColor2: osFillBottom2,
        lineWidth: 1, lastValueVisible: false, priceLineVisible: false, crosshairMarkerVisible: false,
      }, paneIndex);
      // TV paritesi (2026-08-18) — "RSI-based MA" çizgisi (Smoothing: SMA/EMA/SMMA/WMA).
      const maVisible = cfg.maType !== 'none' && cfg.showMA;
      const ma = this.chart.addSeries(LightweightCharts.LineSeries, {
        color: maVisible ? cfg.maColor : 'rgba(0,0,0,0)', lineWidth: cfg.maWidth, lineStyle: ChartPane.LWC_LINE_STYLE(cfg.maStyle),
        priceScaleId: sharedScaleId, autoscaleInfoProvider: sharedAutoscale,
        lastValueVisible: false, priceLineVisible: false, crosshairMarkerVisible: false,
      }, paneIndex);
      this._indAuxSeries[cfg.id] = { ob, os, ma };
    }

    // Bant-arası (lowerBand-upperBand) sabit dolgu — HTML overlay, cvs'nin
    // (tüm pane'leri kapsayan container) üzerine mutlak konumlu.
    if (!this._indFillEl[cfg.id]) {
      const el = document.createElement('div');
      el.style.cssText = 'position:absolute; left:0; right:0; pointer-events:none; z-index:1;';
      this.cvs.appendChild(el);
      this._indFillEl[cfg.id] = el;
    }
    this._indFillEl[cfg.id].style.background = cfg.fillColor;
    this._indFillEl[cfg.id].style.display = cfg.showFill ? '' : 'none';
    this._repositionIndicatorFills();
  }

  /** rgba(...) rengi aynı ton, alfa≈0'a yakın haliyle döner — BaselineSeries'in
   *  gradient dolgusunun taban(0'dan uzak)dan tepeye (0'a yakın) doğru
   *  soluklaşması için (TV'nin "gradient fill" hissi). */
  _fadeColor(rgba) {
    const m = /rgba?\(([^)]+)\)/.exec(rgba);
    if (!m) return rgba;
    const parts = m[1].split(',').map(s => s.trim());
    return `rgba(${parts[0]},${parts[1]},${parts[2]},0.02)`;
  }

  /** Kullanıcı isteği (2026-08-19, OI/Volume panelindeki AYNI desen —
   *  `js/screener/oi-volume-panel.js` `_attachTooltip()`) — imleç RSI
   *  çizgisinin üzerine geldiğinde, crosshair noktasının hemen üstünde o
   *  anki RSI değerini gösteren yüzen bir badge. Eksen etiketinden BAĞIMSIZ,
   *  fare imlecine yakın — chart'ın herhangi bir panelinde (ana panel dahil,
   *  TV'nin diğer indikatörlerdeki davranışı da böyle) crosshair hareket
   *  ettikçe güncellenir, sadece o zaman noktasında RSI değeri VARSA gösterilir.
   *  Sadece ilk kurulumda ÇAĞRILIR (bkz. `_rebuildIndicatorOverlays`) — tek
   *  bir `subscribeCrosshairMove` aboneliği yeter, ayar değişince yeniden
   *  bağlamaya gerek yok (closure `cfg`'yi referans olarak tutuyor).
   */
  _attachRsiTooltip(cfg) {
    if (this._indTooltipEl[cfg.id]) return; // zaten bağlı
    const tip = document.createElement('div');
    tip.style.cssText = 'position:absolute; display:none; pointer-events:none; background:var(--bg-secondary); border:1px solid var(--border-primary); border-radius:4px; padding:2px 6px; font-size:10px; font-family:"JetBrains Mono",monospace; color:var(--text-primary); z-index:6; white-space:nowrap;';
    this.cvs.appendChild(tip);
    this._indTooltipEl[cfg.id] = tip;
    const handler = (param) => {
      const series = this._indSeries[cfg.id];
      if (!series || !param.point || !param.time) { tip.style.display = 'none'; return; }
      const d = param.seriesData?.get(series);
      if (!d || d.value == null) { tip.style.display = 'none'; return; }
      const y = series.priceToCoordinate(d.value);
      if (y == null) { tip.style.display = 'none'; return; }
      const paneIndex = this._indPaneIndex[cfg.id];
      let offsetY = 0;
      for (let i = 0; i < paneIndex; i++) {
        const p = this.chart.panes()[i];
        if (p) offsetY += p.getHeight();
      }
      const decimals = ChartPane.RSI_PRECISION_DECIMALS(cfg);
      tip.textContent = d.value.toFixed(decimals);
      tip.style.display = 'block';
      let left = param.point.x + 10;
      left = Math.min(left, this.cvs.clientWidth - tip.offsetWidth - 4);
      tip.style.left = Math.max(4, left) + 'px';
      tip.style.top = (offsetY + y - tip.offsetHeight / 2) + 'px';
    };
    this._indTooltipHandler[cfg.id] = handler;
    this.chart.subscribeCrosshairMove(handler);
  }

  /** Bant-arası dolgu div'lerini, ilgili RSI serisinin `priceToCoordinate()`
   *  değerlerine göre yeniden konumlar. Fiyat ekseni sabit (autoscaleInfoProvider
   *  ile 0-100'e kilitli) olduğu için SADECE pane yüksekliği değişince (resize, stretch
   *  factor, pane ekle/kaldır) tekrar çağrılması yeterli — bkz. ResizeObserver
   *  callback'i ve _rebuildIndicatorOverlays/_rebuildSubpaneAux çağrı noktaları. */
  _repositionIndicatorFills() {
    this.indicators.forEach(cfg => {
      const el = this._indFillEl[cfg.id];
      const series = this._indSeries[cfg.id];
      if (!el || !series) return;
      const yTop = series.priceToCoordinate(cfg.upperBand);
      const yBottom = series.priceToCoordinate(cfg.lowerBand);
      if (yTop == null || yBottom == null) { el.style.display = 'none'; return; }
      // series.priceToCoordinate pane-içi koordinat döner; pane'in cvs
      // içindeki dikey ofsetini eklemek gerekiyor (RSI her zaman pane 1,
      // ana panelin altında).
      const paneIndex = this._indPaneIndex[cfg.id];
      let offsetY = 0;
      for (let i = 0; i < paneIndex; i++) {
        const p = this.chart.panes()[i];
        if (p) offsetY += p.getHeight();
      }
      el.style.display = 'block';
      el.style.top = `${offsetY + Math.min(yTop, yBottom)}px`;
      el.style.height = `${Math.abs(yBottom - yTop)}px`;
    });
  }

  /** `this.candlesData`'dan tüm aktif indikatörleri yeniden hesaplar.
   *  `tickOnly`: canlı tick'lerde (saniyede birkaç kez tetiklenebilir) tüm seriyi
   *  yeniden çizdirmek (`setData`) yerine sadece SON bar'ı `update()` ile
   *  günceller — matematik yine tam seriden hesaplanır (ucuz, O(n) döngü),
   *  ama LWC serisine sadece tek nokta yollanır (gereksiz tam redraw yok). */
  // `liveOverride` — feed:tick'ten (candlesData'yı kendi güncellemez) gelen henüz
  // kaydedilmemiş son close/time'ı geçici olarak seriye eklemek için (bkz. _onFeedTick).
  _recomputeAllIndicators(tickOnly = false, liveOverride = null) {
    if (!this.indicators.length || !this.candlesData || !this.candlesData.length) {
      this._updateIndicatorLegend();
      return;
    }
    const closes = this.candlesData.map(d => d.close);
    let times = this.candlesData.map(d => d.time);
    if (liveOverride) {
      const lastKnownTime = times[times.length - 1];
      if (liveOverride.time === lastKnownTime) {
        closes[closes.length - 1] = liveOverride.close;
      } else if (liveOverride.time > lastKnownTime) {
        closes.push(liveOverride.close);
        times.push(liveOverride.time);
      }
    }
    const lastTime = times[times.length - 1];

    this.indicators.forEach(cfg => {
      // RSI'de 'close' dışı bir Source seçiliyse (Open/High/Low/HL2/HLC3/OHLC4)
      // liveOverride'ı (sadece close taşır) UYGULAMADAN candlesData'dan üretir —
      // canlı tick'te tek bar geç güncellenmesi (bir sonraki tam candle'da düzelir)
      // yerinde bir basitleştirme, TV'nin çok küçük TF'lerdeki davranışına yakın.
      const rsiSource = cfg.type === 'rsi' && cfg.source && cfg.source !== 'close'
        ? ChartPane.RSI_SOURCE_SERIES(this.candlesData, cfg.source)
        : closes;
      const arr = cfg.type === 'ema' ? IndicatorEngine.calcEMAFull(closes, cfg.period)
        : cfg.type === 'dema' ? IndicatorEngine.calcDEMAFull(closes, cfg.period)
        : IndicatorEngine.calcRSIFull(rsiSource, cfg.period); // 'rsi'
      const points = [];
      for (let i = 0; i < arr.length; i++) {
        if (arr[i] == null) continue;
        points.push({ time: times[i], value: arr[i] });
      }
      const series = this._indSeries[cfg.id];
      if (series) {
        const lastPoint = points.length && points[points.length - 1].time === lastTime ? points[points.length - 1] : null;
        if (tickOnly && lastPoint) series.update(lastPoint);
        else series.setData(points);
      }
      // Overbought/oversold gradient dolgu serileri AYNI veri noktalarını
      // kullanır (BaselineSeries kendi baseValue'suna göre üst/alt renklerini
      // otomatik uyguluyor, bkz. _rebuildSubpaneAux).
      const aux = this._indAuxSeries[cfg.id];
      if (aux) {
        const lastPoint = points.length && points[points.length - 1].time === lastTime ? points[points.length - 1] : null;
        if (tickOnly && lastPoint) { aux.ob.update(lastPoint); aux.os.update(lastPoint); }
        else { aux.ob.setData(points); aux.os.setData(points); }
        // TV paritesi — RSI-based MA (Smoothing sekmesinde seçilen tip/uzunluk).
        if (aux.ma) {
          if (cfg.type === 'rsi' && cfg.maType !== 'none') {
            const maArr = IndicatorEngine.calcMAOfSeries(arr, cfg.maLength, cfg.maType);
            const maPoints = [];
            for (let i = 0; i < maArr.length; i++) {
              if (maArr[i] == null) continue;
              maPoints.push({ time: times[i], value: maArr[i] });
            }
            const maLastPoint = maPoints.length && maPoints[maPoints.length - 1].time === lastTime ? maPoints[maPoints.length - 1] : null;
            if (tickOnly && maLastPoint) aux.ma.update(maLastPoint);
            else aux.ma.setData(maPoints);
          } else if (!tickOnly) {
            aux.ma.setData([]);
          }
        }
      }
      cfg._lastValue = points.length ? points[points.length - 1].value : null;

      // TV paritesi — "Calculate Divergence" (Regular Bullish/Bearish).
      // Sadece TAM veri geçişinde (tickOnly değil, liveOverride ile uzatılmamış
      // seri) yeniden hesaplanır — pivot bulmak her tick'te gereksiz pahalı,
      // ayrıca son barın pivotu zaten `right` bar sonrasına kadar netleşmez.
      if (cfg.type === 'rsi') {
        if (cfg.divergenceEnabled && !tickOnly && times.length === this.candlesData.length) {
          const lows = this.candlesData.map(d => d.low);
          const highs = this.candlesData.map(d => d.high);
          const div = IndicatorEngine.calcRegularDivergence(arr, lows, highs);
          this._renderRsiDivergence(cfg, div, arr, times);
        } else if (!cfg.divergenceEnabled && !tickOnly) {
          this._clearRsiDivergence(cfg);
        }
      }
    });

    this._repositionIndicatorFills();
    this._updateIndicatorLegend(tickOnly);
  }

  /** Regular Bullish/Bearish divergence'ı RSI subpane'inde çizer: her pivot
   *  çiftini bağlayan kısa bir LineSeries (2 nokta) + "Bull"/"Bear" metin
   *  marker'ı (ana RSI serisine `createSeriesMarkers` ile iliştirilir).
   *  Her çağrıda ÖNCEKİ segment serileri silinip yeniden kurulur — ucuz
   *  (sadece tam veri geçişinde çalışır, bkz. çağrı noktası). */
  _renderRsiDivergence(cfg, div, rsiArr, times) {
    const series = this._indSeries[cfg.id];
    const paneIndex = this._indPaneIndex[cfg.id];
    if (!series || paneIndex == null) return;
    (this._divSeries[cfg.id] || []).forEach(s => { try { this.chart.removeSeries(s); } catch (_) {} });
    this._divSeries[cfg.id] = [];

    const MAX_PER_SIDE = 30; // performans/görsel karmaşa — sadece en yeni sinyaller
    const markers = [];
    const addSegments = (pairs, color, width, style, show, isBull) => {
      if (!show) return;
      pairs.slice(-MAX_PER_SIDE).forEach(({ aIdx, bIdx }) => {
        const ta = times[aIdx], tb = times[bIdx];
        if (ta == null || tb == null) return;
        const seg = this.chart.addSeries(LightweightCharts.LineSeries, {
          color, lineWidth: width, lineStyle: ChartPane.LWC_LINE_STYLE(style), priceScaleId: 'right',
          autoscaleInfoProvider: () => ({ priceRange: { minValue: 0, maxValue: 100 } }),
          lastValueVisible: false, priceLineVisible: false, crosshairMarkerVisible: false,
        }, paneIndex);
        seg.setData([{ time: ta, value: rsiArr[aIdx] }, { time: tb, value: rsiArr[bIdx] }]);
        this._divSeries[cfg.id].push(seg);
        markers.push({
          time: tb, position: isBull ? 'belowBar' : 'aboveBar', color,
          shape: isBull ? 'arrowUp' : 'arrowDown', text: isBull ? 'Bull' : 'Bear',
        });
      });
    };
    addSegments(div.bullish, cfg.bullColor, cfg.bullWidth, cfg.bullStyle, cfg.showDivBullish, true);
    addSegments(div.bearish, cfg.bearColor, cfg.bearWidth, cfg.bearStyle, cfg.showDivBearish, false);
    markers.sort((a, b) => a.time - b.time);

    if (this._divMarkersHandle[cfg.id]) {
      this._divMarkersHandle[cfg.id].setMarkers(markers);
    } else {
      this._divMarkersHandle[cfg.id] = LightweightCharts.createSeriesMarkers(series, markers);
    }
  }

  /** "Calculate Divergence" kapatıldığında çizgi+marker'ları temizler. */
  _clearRsiDivergence(cfg) {
    (this._divSeries[cfg.id] || []).forEach(s => { try { this.chart.removeSeries(s); } catch (_) {} });
    this._divSeries[cfg.id] = [];
    if (this._divMarkersHandle[cfg.id]) this._divMarkersHandle[cfg.id].setMarkers([]);
  }

  /** TV tarzı, chart'ın sol-üst köşesindeki basit indikatör listesi (isim/değer + düzenle/kaldır).
   *  `valuesOnly`: canlı tick'lerde DOM'u (ve hover listener'larını) yeniden kurmadan sadece
   *  değer metnini günceller — her tick'te tüm satırı yeniden inşa etmek hover'ı bozar/gereksiz. */
  _updateIndicatorLegend(valuesOnly = false) {
    const fmtValue = (cfg) => {
      if (cfg._lastValue == null) return '—';
      const decimals = cfg.type === 'rsi' ? ChartPane.RSI_PRECISION_DECIMALS(cfg) : 2;
      const mul = Math.pow(10, decimals);
      return (Math.round(cfg._lastValue * mul) / mul).toFixed(decimals);
    };
    if (valuesOnly && this._indLegendEl) {
      this.indicators.forEach(cfg => {
        const row = this._indLegendEl.querySelector(`.pane-ind-row[data-ind-id="${cfg.id}"] .pane-ind-val`);
        if (row) row.textContent = (cfg.type !== 'rsi' || cfg.showValuesInStatusLine !== false) ? fmtValue(cfg) : '';
      });
      return;
    }
    if (!this.indicators.length) {
      if (this._indLegendEl) this._indLegendEl.innerHTML = '';
      return;
    }
    if (!this._indLegendEl) {
      this._indLegendEl = document.createElement('div');
      this._indLegendEl.className = 'pane-ind-legend';
      this._indLegendEl.style.cssText = 'position:absolute; top:6px; left:8px; z-index:2; font-size:11px; font-family:"JetBrains Mono",monospace; pointer-events:auto;';
      this.cvs.appendChild(this._indLegendEl);
    }
    const NAME = { ema: 'EMA', dema: 'DEMA', rsi: 'RSI' };
    // TV paritesi — "Inputs in status line" / "Values in status line" (RSI Style sekmesi).
    this._indLegendEl.innerHTML = this.indicators.map(cfg => {
      const showInputs = cfg.type !== 'rsi' || cfg.showInputsInStatusLine !== false;
      const showValues = cfg.type !== 'rsi' || cfg.showValuesInStatusLine !== false;
      return `
      <div class="pane-ind-row" data-ind-id="${cfg.id}" style="display:flex; align-items:center; gap:5px; padding:1px 0; color:${cfg.color};">
        <span>${NAME[cfg.type]}${showInputs ? `(${cfg.period})` : ''}</span>
        <span class="pane-ind-val" style="color:var(--text-secondary);">${showValues ? fmtValue(cfg) : ''}</span>
        <span class="pane-ind-actions" style="display:none; gap:4px; margin-left:2px;">
          <button type="button" class="pane-ind-edit" title="Settings" style="background:none; border:none; color:var(--text-secondary); cursor:pointer; padding:0; font-size:11px; line-height:1;">⚙</button>
          <button type="button" class="pane-ind-remove" title="Remove" style="background:none; border:none; color:var(--text-secondary); cursor:pointer; padding:0; font-size:11px; line-height:1;">✕</button>
        </span>
      </div>`;
    }).join('');

    this._indLegendEl.querySelectorAll('.pane-ind-row').forEach(row => {
      const actions = row.querySelector('.pane-ind-actions');
      row.addEventListener('mouseenter', () => { actions.style.display = 'flex'; });
      row.addEventListener('mouseleave', () => { actions.style.display = 'none'; });
      row.querySelector('.pane-ind-remove').addEventListener('click', (e) => {
        e.stopPropagation();
        const ind = this.indicators.find(i => i.id === row.dataset.indId);
        const name = ind ? ind.type.toUpperCase() : 'this indicator';
        window.ConfirmModal.show(`Remove ${name} indicator? This cannot be undone.`).then((ok) => {
          if (ok) this.removeIndicator(row.dataset.indId);
        });
      });
      row.querySelector('.pane-ind-edit').addEventListener('click', (e) => {
        e.stopPropagation();
        EventBus.emit('indicator:editRequested', { paneIdx: this.idx, indicatorId: row.dataset.indId });
      });
    });
  }

  // ── Heikin Ashi dönüşümü (gorevler2.md izleme listesi, 2026-08-10) ──────
  // `candles` HAM OHLC (Binance/Bybit'ten geldiği gibi) — burada IndicatorEngine
  // ile HA'ya çevrilip candlestick-uyumlu {time,open,high,low,close} dizisine
  // dönüştürülür. `this.candlesData` (magnet mode, ChartPhantom, fiyat çizgileri)
  // ham veriyle kalmaya devam eder — sadece SERİYE giden veri HA'ya çevrilir.
  _haFullSeries(rawCandles) {
    const opens  = rawCandles.map(d => d.open);
    const highs  = rawCandles.map(d => d.high);
    const lows   = rawCandles.map(d => d.low);
    const closes = rawCandles.map(d => d.close);
    const ha = IndicatorEngine.calcHeikinAshi(opens, highs, lows, closes, true);
    if (!ha) return rawCandles;
    // Kayan hesabın tabanı: SON bar'ı değil, bir ÖNCEKİ (kesin kapanmış) bar'ı
    // baz alıyoruz — geçmiş yüklemesinin son bar'ı genelde hâlâ oluşuyor
    // olabilir (canlı), sonraki tick'ler bunu bu tabana göre yeniden hesaplar.
    // Tek bar varsa (ör. ilk yükleme) o bar'ın kendisi taban olur.
    const baseIdx = ha.series.length >= 2 ? ha.series.length - 2 : ha.series.length - 1;
    this._haPrevClosed = { haOpen: ha.series[baseIdx].haOpen, haClose: ha.series[baseIdx].haClose };
    return rawCandles.map((d, i) => ({
      time: d.time,
      open: ha.series[i].haOpen, high: ha.series[i].haHigh,
      low:  ha.series[i].haLow,  close: ha.series[i].haClose,
      volume: d.volume,
    }));
  }

  // Canlı/tekli bir HAM bar'ı, `_haPrevClosed` tabanına göre HA'ya çevirir.
  // Bar henüz kapanmadıysa (isClosed=false) taban SABİT kalır — sadece bu
  // bar'ın ha_close/ha_high/ha_low'u her tick'te yeniden hesaplanır (doğru
  // "kayan hesap" davranışı, bkz. modül başlığı notu). Bar kapandığında
  // (isClosed=true) az önce gösterilen HA değeri yeni taban olur.
  _haTransformLive(raw, isClosed) {
    if (!this._haPrevClosed) {
      // Taban hiç yok (ör. HA açılır açılmaz ilk canlı tick geldi, henüz
      // _onFeedCandles hiç çalışmadı) — bu bar'ı kendi tabanı say.
      this._haPrevClosed = { haOpen: (raw.open + raw.close) / 2, haClose: (raw.open + raw.high + raw.low + raw.close) / 4 };
    }
    const prev = this._haPrevClosed;
    const haOpen  = (prev.haOpen + prev.haClose) / 2;
    const haClose = (raw.open + raw.high + raw.low + raw.close) / 4;
    const haHigh  = Math.max(raw.high, haOpen, haClose);
    const haLow   = Math.min(raw.low, haOpen, haClose);
    const result = { time: raw.time, open: haOpen, high: haHigh, low: haLow, close: haClose, volume: raw.volume };
    if (isClosed) this._haPrevClosed = { haOpen, haClose };
    return result;
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
        : (this.useHeikinAshi ? this._haFullSeries(deduped) : deduped)
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
    this._updateAlertLines();
    this._recomputeAllIndicators();
    // [DÜZELTME 2026-08-19] Aşağıdaki fitContent/goToTime bloğu ile AYNI
    // kök neden ailesi: RSI paneli veri henüz yokken (constructor →
    // ResizeObserver → `_rebuildIndicatorOverlays`) kuruluyor ve o anda
    // `setStretchFactor(0.3)` uygulanıyor — ama LWC ilk GERÇEK veri
    // setData'sından sonra kendi iç layout'unu yeniden hesaplıyor gibi
    // görünüyor (kullanıcı bulgusu: F5 sonrası RSI paneli kaybolan/yanlış
    // boyutlu kalıyor, sadece fiyat eksenine çift tıklayınca düzeliyordu —
    // TAM olarak aşağıdaki phantom/fitContent hatasıyla aynı "ilk yüklemede
    // çift tıklamayı beklemeden düzelt" deseni). İlk gerçek veri geldiğinde
    // stretch factor'ü BİR KEZ DAHA uygula.
    if (this.indicators.some(i => ChartPane.SUBPANE_TYPES.has(i.type))) {
      requestAnimationFrame(() => {
        Object.entries(this._indPaneIndex).forEach(([id, paneIndex]) => {
          const p = this.chart.panes()[paneIndex];
          if (p) p.setStretchFactor(0.3);
        });
        // [DÜZELTME 2026-08-19, 3. tur] 2. turdaki `chart.resize(this.cvs.
        // clientWidth, this.cvs.clientHeight)` çağrısı YENİ bir bug'a yol
        // açtı: bu RAF, sayfanın geri kalanı (sidebar/watchlist/OI-LS paneli
        // vb.) henüz son boyutuna YERLEŞMEDEN tetiklenebiliyor — o anki
        // `cvs.clientHeight` GEÇİCİ/erken bir değer oluyor, chart o boyuta
        // SABİTLENİYOR (kullanıcı doğrulaması: `chart.panes()` toplamı
        // 837px iken konteynerin GERÇEK boyutu 867px'ti — 30px'lik kalıcı
        // bir fark). Kendi elle yazdığım resize mantığını GÜVENMEK yerine,
        // ZATEN doğru çalışan `ResizeObserver`'ı (bkz. constructor'daki
        // `this.ro`) yeniden gözlemleterek onun GÜNCEL, doğru `contentRect`
        // ile kendi (kanıtlanmış doğru) callback'ini tekrar çalıştırmasını
        // sağlıyoruz — tarayıcı `.observe()` çağrıldığında callback'i HER
        // ZAMAN mevcut boyutla bir kez daha tetikler.
        if (this.ro && this.cvs) {
          try { this.ro.unobserve(this.cvs); } catch (_) {}
          this.ro.observe(this.cvs);
        }
      });
    }
    requestAnimationFrame(() => this._positionCountdown());

    // [2026-08-15] Alarm kartından "zaman yolculuğu" bekleniyorsa (bkz.
    // goToTime()), varsayılan "son 150 bar'a sığdır" davranışını atla —
    // yoksa önce oraya sığdırır, hemen ardından goToTime tekrar kaydırır,
    // gözle görülür bir "zıplama" olurdu.
    if (this._pendingGoToTime) {
      this.goToTime(this._pendingGoToTime);
      this._pendingGoToTime = null;
      this._initialDataLoaded = true;
    } else if ((exchange === 'binance' || exchange === 'bybit') && !this._initialDataLoaded) {
      this._initialDataLoaded = true;
      // [FIX] fitContent() phantom'ın (ChartPhantom.update, yukarıda) sağa
      // uzattığı 1000 barlık görünmez seriyi de ekrana sığdırmaya çalışır —
      // gerçek mumlar görünmeyecek kadar sola sıkışır, sadece zaman/fiyat
      // cetveline çift tıklayınca (aşağıdaki dblclick handler'ı) düzeliyordu.
      // Aynı mantığı ilk yüklemede de doğrudan uygula — çift tıklamayı bekleme.
      try {
        const ts         = this.chart.timeScale();
        const totalBars  = this.candlesData.length;
        const visibleBars = 150;
        const toBar      = totalBars - 1;
        const fromBar    = Math.max(0, toBar - visibleBars);
        ts.setVisibleLogicalRange({ from: fromBar, to: toBar + 12 }); // +12 rightOffset
      } catch(_) {
        this.chart.timeScale().fitContent(); // beklenmedik hata olursa eski davranışa düş
      }
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

    const update = isLine
      ? { time: safe.time, value: safe.close }
      : (this.useHeikinAshi ? this._haTransformLive(safe, !!isClosed) : safe);

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
      this._updateLivePriceLine();
      this._updateAlertLines(); // eğik çizgiden gelen alarmların çizgisi canlı takip etsin
      if (this.indicators.length) this._recomputeAllIndicators(true, { time: safe.time, close: safe.close });
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
    const update = isLine
      ? { time: safe.time, value: safe.close }
      : (this.useHeikinAshi ? this._haTransformLive(safe, !!isClosed) : safe);

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
      this._updateLivePriceLine();
      this._updateAlertLines(); // eğik çizgiden gelen alarmların çizgisi canlı takip etsin

      // candlesData'yı güncelle
      if (lastExistingTime && safe.time === lastExistingTime) {
        this.candlesData[this.candlesData.length - 1] = safe; // Mevcut son mumu güncelle
      } else {
        this.candlesData.push(safe); // Yeni mum ekle
      }
      if (this.indicators.length) this._recomputeAllIndicators(true);
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
          : (this.useHeikinAshi ? this._haFullSeries(deduped) : deduped)
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
      this._recomputeAllIndicators(); // eski mumlar eklendi — indikatör serileri de baştan hesaplanmalı

      // Visible range'i geri yükle — kullanıcının baktığı yere geri dön
      if (savedRange) {
        try { this.chart.timeScale().setVisibleLogicalRange(savedRange); } catch(_) {}
      }
    } catch(err) {
      console.warn('[ChartPane] _onOlderCandles setData failed:', err);
    }
  }

  // Görünen zaman aralığındaki bar'ları döner (High/Low'un viewport'a göre
  // dinamik hesaplanması için, bkz. _updateVisualLines). Aralık alınamazsa
  // (chart henüz layout almamışsa) TÜM veriye düşer — hiç çizgi göstermemekten iyi.
  _visibleCandles(data) {
    if (!data || !data.length) return [];
    let range = null;
    try { range = this.chart.timeScale().getVisibleRange(); } catch (_) {}
    if (!range) return data;
    return data.filter(d => d.time >= range.from && d.time <= range.to);
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

    // gorevler2.md Görev 11.1 (2026-08-10) — iki hata düzeltildi:
    // 1) `data` boşken Math.max(...[])=-Infinity/Math.min(...[])=Infinity
    //    hesaplanıp geçersiz bir çizgi oluşturuluyordu (hata vermeden, sessizce
    //    hiç görünmüyordu).
    // 2) High/Low artık TÜM yüklü geçmişin sabit min/max'ı değil, TradingView'daki
    //    gibi o an GÖRÜNEN aralığın (viewport) bar'larından hesaplanıyor — bkz.
    //    _onRangeChange()'deki ek çağrı (scroll/zoom'da yeniden hesaplanır).
    if (this.lineHighLow) {
      const visible = this._visibleCandles(data);
      if (visible.length) {
        const showLine = this.hlLine !== false;
        const showVal  = this.hlValue !== false;
        const high = Math.max(...visible.map(d => d.high ?? d.close));
        const low  = Math.min(...visible.map(d => d.low ?? d.close));
        addLine('high', high, 'High', showLine ? '#f23645' : 'transparent', LightweightCharts.LineStyle.Dashed, showVal);
        addLine('low', low, 'Low', showLine ? '#2962ff' : 'transparent', LightweightCharts.LineStyle.Dashed, showVal);
      } else { removeLine('high'); removeLine('low'); }
    } else { removeLine('high'); removeLine('low'); }
    
    if (this.lineBidAsk && this._lastPrice) {
      const showLine = this.baLine !== false;
      const showVal  = this.baValue !== false;
      addLine('ask', this._lastPrice + 0.5, 'Ask', showLine ? '#f23645' : 'transparent', LightweightCharts.LineStyle.Solid, showVal);
      addLine('bid', this._lastPrice - 0.5, 'Bid', showLine ? '#2962ff' : 'transparent', LightweightCharts.LineStyle.Solid, showVal);
    } else { removeLine('ask'); removeLine('bid'); }
  }

  // gorevler2.md Görev 11 (2026-08-10) — AlertStore'daki (js/screener/alert-store.js)
  // bu pane'in sembolüne ait alarmları çizgi olarak render eder. Ayarlar
  // (renk/görünürlük/sadece-aktif) BİLEREK pane'e değil AlertStore'un global
  // tercihlerine bağlı — bkz. alert-store.js başlığı notu.
  _updateAlertLines() {
    if (!this.series || !window.AlertStore) return;
    const prefs  = window.AlertStore.getPrefs();
    const alerts = window.AlertStore.getAlerts(this.symbol);
    const wanted = new Set();

    if (prefs.alertLines) {
      alerts.forEach(a => {
        if (prefs.onlyActiveAlerts && a.triggered) return;
        wanted.add(a.id);
        const color = a.triggered ? 'rgba(120,123,134,0.6)' : (prefs.alertLinesColor || '#f23645');
        if (this._alertPriceLines[a.id]) {
          this._alertPriceLines[a.id].applyOptions({ price: a.price, color });
        } else {
          this._alertPriceLines[a.id] = this.series.createPriceLine({
            price: a.price, color, lineWidth: 1,
            lineStyle: LightweightCharts.LineStyle.Dashed,
            axisLabelVisible: true, title: 'Alert',
          });
        }
      });
    }

    Object.keys(this._alertPriceLines).forEach(id => {
      if (!wanted.has(id)) {
        try { this.series.removePriceLine(this._alertPriceLines[id]); } catch (_) {}
        delete this._alertPriceLines[id];
      }
    });
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
        if (this.series) {
          // Her scroll/zoom'da _buildSeries()'teki ile TUTARSIZ şekilde ikisini
          // de sabit false yapıyordu — HA modunda kapanış etiketini (lastValueVisible)
          // ilk kaydırmada geri söndürüyordu. _buildSeries()/applySettings()'teki
          // aynı mantıkla hizalandı (2026-08-10).
          this.series.applyOptions({
            priceLineVisible: this.symLine !== false,
            lastValueVisible: this.useHeikinAshi === true,
          });
        }
        this._updateLivePriceLine();
        // gorevler2.md Görev 11.1 — High/Low viewport'a göre dinamik, scroll/zoom'da yeniden hesapla.
        if (this.lineHighLow) this._updateVisualLines(this.candlesData || []);
      } catch(_) {}
      EventBus.emit('range:change', { sourceIdx: this.idx, range });
      this._positionCountdown();
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
    this.rtBtn.addEventListener('click', () => this.goToRealtime());

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
    if (this.watermarkMode !== 'Interval') this.wm.textContent = symbol;
    this.loaded = false; this._loadData(); this.loaded = true;
  }

  setTF(tf) {
    if (this.tf === tf) return; // Çift tetiklenme koruması
    this.tf = tf;
    if (this.watermarkMode === 'Interval') this.wm.textContent = tf;
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

  // gorevler2.md izleme listesi (2026-08-10) — Heikin Ashi'yi aç/kapat.
  // chartType'a DOKUNMAZ (series tipi hep 'candle' kalır) — sadece render'a
  // giden OHLC verisinin dönüştürülüp dönüştürülmeyeceğini belirler. Çağıran
  // (app.js selectStyle) ardından setChartType('candle') çağırarak asıl
  // _buildSeries()+_loadData() tetiklemesini yapar.
  setHeikinAshi(enabled) {
    this.useHeikinAshi = enabled;
    this._haPrevClosed = null; // sembol/stil değişti, kayan hesabı sıfırla
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
           title: '',
           lastValueVisible: this.useHeikinAshi === true, // bkz. _buildSeries() notu — HA kapanış etiketini burada da sıfırlama
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
      if (s.marginTop    != null) this.marginTop    = s.marginTop;
      if (s.marginBottom != null) this.marginBottom = s.marginBottom;
      const scaleId = this.priceSide === 'left' ? 'left' : 'right';
      this.chart.priceScale(scaleId).applyOptions({
        scaleMargins: { top: topPct ?? this.marginTop / 100, bottom: bottomPct ?? this.marginBottom / 100 }
      });
    }

    // ── WATERMARK (Canvas tab) ────────────────────────────────
    if (s.watermarkMode != null) {
      this.watermarkMode = s.watermarkMode;
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

  
  _updateLivePriceLine() {
    if (!this.series || this._lastPrice == null || this.symLine === false) return;
    const color = this._lastPriceIsUp ? (this.candleUpColor || '#26a69a') : (this.candleDownColor || '#ef5350');
    const label = this.symValue !== false ? String(this._lastPrice) : '';
    if (!this._livePriceLine) {
      this._livePriceLine = this.series.createPriceLine({
        price: this._lastPrice,
        color,
        lineWidth: 1,
        lineStyle: LightweightCharts.LineStyle.Dashed,
        axisLabelVisible: this.symValue !== false,
        title: '',
      });
    } else {
      this._livePriceLine.applyOptions({
        price: this._lastPrice,
        color,
        axisLabelVisible: this.symValue !== false,
        title: this.symName !== false ? (this.symbol || '') : '',
      });
    }
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

  // [FIX 2026-08-15] native scrollToRealTime() phantom'ın (1000 barlık
  // görünmez gelecek serisi) zaman aralığını da "gerçek" sayıp oraya kadar
  // kayıyordu — son gerçek mum ekranın çok solunda kalıp phantom'ın boş
  // alanı görünüyordu. fitContent/dblclick'teki AYNI mantık burada da
  // kullanılıyor: gerçek mum sayısına göre logical range hesapla.
  goToRealtime() {
    if (!this.chart || !this.candlesData || !this.candlesData.length) return;
    try {
      const ts = this.chart.timeScale();
      const totalBars = this.candlesData.length;
      const visibleBars = 150;
      const toBar = totalBars - 1;
      const fromBar = Math.max(0, toBar - visibleBars);
      ts.setVisibleLogicalRange({ from: fromBar, to: toBar + 12 });
    } catch (_) {}
  }

  // [2026-08-15, kullanıcı isteği] Alarm sekmesinde bir sinyal kartına
  // tıklayınca chart'ın "zamana gitmesi" — bar-index hesabına gerek yok,
  // syncRange() zaten aynı deseni (Unix-timestamp tabanlı setVisibleRange)
  // kullanıyor, aynısını burada da kullanıyoruz. timestampMs milisaniye
  // (sig.timestamp, JS Date formatı) — LWC saniye bekliyor, /1000 şart.
  goToTime(timestampMs) {
    if (!this.chart || !timestampMs) return;
    try {
      const ts = Math.floor(timestampMs / 1000);
      const tfSec = this._tfSeconds() || 3600;
      const halfWindow = tfSec * 37; // ~75 barlık pencere, goToRealtime'daki 150-bar oranının yarısı
      this.chart.timeScale().setVisibleRange({ from: ts - halfWindow, to: ts + halfWindow });
    } catch (_) {}
  }

  // [2026-08-15, kullanıcı isteği] Alarm sekmesindeki bir sinyal kartına
  // tıklanınca chart'ın o sinyalin ateşlendiği zamana "kaydırılması" — bkz.
  // chart-core.js'teki symbol:change bridge (targetTimestamp) ve
  // alarm-signal-history.js'teki kart tıklama handler'ı. Bar-index hesabı
  // yerine syncRange()'in de kullandığı zaman-tabanlı setVisibleRange
  // kullanılıyor — hangi TF'te kaç bar olduğunu bilmeye gerek kalmıyor.
  goToTime(timestampMs) {
    if (!this.chart || !timestampMs) return;
    try {
      const ts = Math.floor(timestampMs / 1000); // LWC saniye bekler, sig.timestamp ms
      const halfWindow = this._tfSeconds() * 75; // goToRealtime'daki ~150 bar'a denk
      this.chart.timeScale().setVisibleRange({ from: ts - halfWindow, to: ts + halfWindow });
    } catch (_) {}
  }

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
      useHeikinAshi: this.useHeikinAshi,
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
      // gorevler2.md Görev 11 (2026-08-10) — eskiden canlı uygulanıp hiç
      // kaydedilmeyen ayarlar (bkz. constructor'daki not).
      timezone: this.timezone,
      hlValue: this.hlValue, hlLine: this.hlLine,
      baValue: this.baValue, baLine: this.baLine,
      pdValue: this.pdValue, pdLine: this.pdLine,
      symName: this.symName, symValue: this.symValue, symLine: this.symLine,
      watermarkMode: this.watermarkMode,
      marginTop: this.marginTop, marginBottom: this.marginBottom,
      // gorevler2.md Görev 14 (2026-08-11) — Chart İndikatörleri
      indicators: this.indicators.map(({ _lastValue, ...cfg }) => cfg), // canlı değeri kaydetme, sadece yapılandırmayı
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




