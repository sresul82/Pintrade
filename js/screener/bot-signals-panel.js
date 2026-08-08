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
  let _chartHourOffset = 0;       // 0 = now, -1 = 1 hour ago
  let _extraContainers = [];      // Floating panel gibi ek render hedefleri
  let _allContainers = [];        // Tüm render hedef container'ları
  let _searchOpen = false;        // Sembol arama kutusu açık mı
  let _searchQuery = '';          // Arama metni (büyük harfe çevrilip symbol'e karşı test edilir)

  // FR dışı botlar (M1Hammer vb.) artık kendi BN/BB toggle'ına sahip değil —
  // borsa her zaman ExchangeRouter.getActive() (= seçili coinin borsası) üzerinden
  // belirlenir. Böylece Screener'dan bir coin seçildiğinde bot paneli otomatik
  // doğru borsaya döner (önceki manuel toggle senkron kalmıyordu).
  function _activeBotExchange() {
    return ExchangeRouter.getActive() === 'binance' ? 'bn' : 'bb';
  }

  function _esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // code: sol dikey rafta ve header'daki SE rozetinde gösterilen kısa etiket.
  const BOT_TABS = [
    { id: 'fr',        label: 'FR',        code: 'FR' },
    { id: 'm1hammer',  label: 'M1 Hammer', code: 'M1' },
    { id: 'm1a',       label: 'M1-A',      code: 'MA' },
    { id: 'v3',        label: 'V3',        code: 'V3' },
    { id: '4s',        label: '4S',        code: '4S' },
  ];

  const ICON_SEARCH = `<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="7" cy="7" r="5"/><path d="M11 11l3.5 3.5" stroke-linecap="round"/></svg>`;
  const ICON_SNIPE = `<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="8" cy="8" r="6"/><circle cx="8" cy="8" r="2.2"/><path d="M8 1v2.4M8 12.6V15M1 8h2.4M12.6 8H15" stroke-linecap="round"/></svg>`;

  /** Sol dikey bot rafı — eski yatay .bsp-bot-tabs'in yerine geçti. */
  function _buildBotRailHTML() {
    let html = `<div class="bsp-bot-rail">`;
    BOT_TABS.forEach(tab => {
      const activeClass = _activeBot === tab.id ? 'active' : '';
      html += `<button class="bsp-rail-btn ${activeClass}" data-bot="${tab.id}" title="${_esc(tab.label)}">
        <span class="bsp-rail-code">${_esc(tab.code)}</span>
      </button>`;
    });
    html += `</div>`;
    return html;
  }

  /** Coin Detail/Bot Signals/News sekme çubuğunda, popout butonunun solunda
   *  gösterilen kontroller: SE rozeti (sadece FR botunda), arama, snipe,
   *  sıralama. Rail butonu zaten hangi bot'un seçili olduğunu gösterdiği
   *  için burada ayrıca bot adı/kısaltması tekrarlanmıyor — BB (borsa)
   *  rozeti de kaldırıldı (borsa zaten Screener'dan seçiliyor). */
  function _buildTabbarControlsHTML() {
    let html = '';

    if (_activeBot === 'fr') {
      html += `<div class="bsp-se-badge" title="FR">SE</div>`;
    }

    html += `<div class="bsp-search-wrap${_searchOpen ? ' open' : ''}">`;
    html += `<input class="bsp-search-input" type="text" placeholder="Symbol..." value="${_esc(_searchQuery)}" ${_searchOpen ? '' : 'tabindex="-1"'}>`;
    html += `<button class="bsp-icon-btn bsp-search-btn" title="Search by symbol">${ICON_SEARCH}</button>`;
    html += `</div>`;

    // Snipe — eski "Seçili Coin / Tüm Coinler" ikilisinin yerine tek toggle.
    // Açıkken: sadece screener'da seçili coin'in sinyalleri gösterilir.
    // Kapalıyken: tüm coinlerin (alarm seviyesindeki) sinyalleri gösterilir.
    html += `<button class="bsp-icon-btn bsp-snipe-btn ${_coinFilter === 'selected' ? 'active' : ''}"
                      data-filter="${_coinFilter === 'selected' ? 'all' : 'selected'}"
                      title="${_coinFilter === 'selected' ? 'Snipe: showing selected coin only — click to show all' : 'Snipe: showing all coins — click to lock to selected coin'}">${ICON_SNIPE}</button>`;

    const sortArrow = _sortOrder === 'desc' ? '↑' : '↓';
    const sortTitle = _sortOrder === 'desc' ? 'Newest signals on top' : 'Newest signals on bottom';
    html += `<button class="bsp-sort-btn" title="${sortTitle}">${sortArrow}</button>`;

    return html;
  }

  /** Kontrolleri, .bsp-tabbar-controls-target sınıflı TÜM hedeflere yazar —
   *  hem docked (#bsp-tabbar-controls, statik sekme çubuğunda) hem floating
   *  panel (#fp-tabbar-controls, sadece panel açıkken DOM'da var) aynı anda
   *  güncelleniyor. _allContainers'tan bağımsız. */
  function _renderTabbarControls() {
    document.querySelectorAll('.bsp-tabbar-controls-target').forEach(el => {
      el.innerHTML = _buildTabbarControlsHTML();
    });
  }

  /** Yeni bir tabbar-controls hedefi (örn. floating panel ilk açıldığında
   *  oluşan #fp-tabbar-controls) delegasyona bağlanır + hemen doldurulur. */
  function attachTabbarTarget(el) {
    if (!el) return;
    _attachDelegation(el);
    el.innerHTML = _buildTabbarControlsHTML();
  }

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
    if (container) _attachDelegation(container);

    // Tabbar kontrolleri (SE/arama/snipe/sırala) dış sekme çubuğunda —
    // ayrı bir DOM ağacı, kendi delegasyonunu istiyor. Floating panel'in
    // kendi hedefi (#fp-tabbar-controls) panel ilk açıldığında oluştuğu
    // için floating-panel.js kendi attachTabbarTarget() çağrısını yapıyor.
    attachTabbarTarget(document.getElementById('bsp-tabbar-controls'));

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
        /* .bsp-body: dikey rafı (.bsp-bot-rail) ve içeriği (.bsp-main) yan yana yerleştirir */
        .bsp-body {
          display: flex;
          flex: 1;
          min-height: 0;
        }
        .bsp-main {
          display: flex;
          flex-direction: column;
          flex: 1;
          min-width: 0;
        }
        /* ── Sol dikey bot rafı — eski yatay .bsp-bot-tabs'in yerine geçti ── */
        .bsp-bot-rail {
          display: flex;
          flex-direction: column;
          gap: 4px;
          padding: 8px 6px;
          border-right: 1px solid var(--border-primary);
          background: var(--bg-secondary);
          flex-shrink: 0;
        }
        .bsp-rail-btn {
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid var(--border-primary);
          background: var(--bg-tertiary);
          color: var(--text-secondary);
          border-radius: 50%;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .bsp-rail-btn:hover {
          background: var(--bg-hover);
          color: var(--text-active);
        }
        .bsp-rail-btn.active {
          background: var(--accent-blue-bg, rgba(9, 105, 218, 0.1));
          color: var(--accent-blue, #0969da);
          border-color: var(--accent-blue, #0969da);
        }
        .bsp-rail-code {
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.02em;
        }
        /* ── SE rozeti (aktif bot'un kısa kodu) ── */
        .bsp-se-badge {
          padding: 3px 7px;
          font-size: 9px;
          font-weight: 700;
          border-radius: 3px;
          background: var(--bg-tertiary);
          color: var(--text-secondary);
          flex-shrink: 0;
        }
        /* ── Arama ikonu / genişleyen input ── */
        .bsp-search-wrap {
          display: flex;
          align-items: center;
          flex: 0 0 auto;
        }
        .bsp-search-input {
          width: 0;
          padding: 0;
          border: none;
          background: var(--bg-tertiary);
          color: var(--text-active);
          font-size: 10px;
          border-radius: 3px;
          opacity: 0;
          transition: width 0.15s ease, opacity 0.15s ease, padding 0.15s ease;
        }
        .bsp-search-wrap.open .bsp-search-input {
          width: 90px;
          padding: 4px 6px;
          opacity: 1;
          margin-right: 4px;
        }
        /* ── Ortak küçük ikon buton (arama, snipe) ── */
        .bsp-icon-btn {
          width: 26px;
          height: 26px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid var(--border-primary);
          background: var(--bg-tertiary);
          color: var(--text-secondary);
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.15s ease;
          flex-shrink: 0;
        }
        .bsp-icon-btn:hover {
          background: var(--bg-hover);
          color: var(--text-active);
        }
        /* Snipe aktifken (sadece seçili coin gösteriliyor) vurgulu */
        .bsp-snipe-btn.active {
          background: var(--accent-red-bg, rgba(248, 81, 73, 0.12));
          color: var(--accent-red, #f85149);
          border-color: var(--accent-red, #f85149);
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
        .bsp-chip {
          background: var(--bg-tertiary);
          border: 0.5px solid var(--border-primary);
          border-radius: 3px;
          padding: 1px 5px;
          font-size: 10px;
          display: flex;
          gap: 2px;
          align-items: center;
        }
        .bsp-tf {
          color: var(--text-secondary);
          font-size: 9px;
        }
        .bsp-row-label {
          font-size: 9px;
          color: var(--text-secondary);
          width: 28px;
          flex-shrink: 0;
        }
      `;
      document.head.appendChild(style);
    }

    render();
  }

  // Floating panel container için event delegation — addContainer() tarafından çağrılır
  function _attachDelegation(el) {
    el.addEventListener('click', (e) => {
      const tickerLink = e.target.closest('.bsp-ticker-link');
      if (tickerLink) {
        const sym = tickerLink.dataset.symbol;
        _selectedSymbol = sym;
        _coinFilter = 'selected';
        EventBus.emit('symbol:change', { symbol: sym + 'USDT', exchange: ExchangeRouter.getActive() });
        render();
        return;
      }
      if (e.target.closest('.bsp-time-nav')) {
        e.stopPropagation();
        const navEl = e.target.closest('.bsp-time-nav');
        const dir = parseInt(navEl.dataset.dir);
        if (dir === 1 && _chartHourOffset >= 0) return;
        if (dir === -1 && navEl.style.opacity === '0.3') return;
        _chartHourOffset += dir;
        render();
        return;
      }
      if (e.target.closest('#bsp-chart-titlebar')) {
        _chartOpen = !_chartOpen;
        _allContainers.forEach(c => {
          const section = c.querySelector('#bsp-chart-section');
          const arrow   = c.querySelector('#bsp-chart-arrow');
          if (section) section.style.maxHeight = _chartOpen ? '200px' : '0';
          if (arrow)   arrow.style.transform   = _chartOpen ? 'rotate(0deg)' : 'rotate(-90deg)';
        });
        return;
      }
      const btn = e.target.closest('button');
      if (!btn) return;
      if (btn.classList.contains('bsp-rail-btn'))        { _activeBot    = btn.dataset.bot;    render(); }
      else if (btn.classList.contains('bsp-filter-btn-time')) { _activeFilter = btn.dataset.filter; render(); }
      else if (btn.classList.contains('bsp-snipe-btn'))  { _coinFilter   = btn.dataset.filter; render(); }
      else if (btn.classList.contains('bsp-search-btn')) {
        _searchOpen = !_searchOpen;
        if (!_searchOpen) _searchQuery = '';
        render();
      }
      else if (btn.classList.contains('bsp-sort-btn'))      { _sortOrder = _sortOrder === 'desc' ? 'asc' : 'desc'; render(); }
    });

    // Arama kutusu — input olayı click delegasyonundan ayrı dinleniyor
    el.addEventListener('input', (e) => {
      if (!e.target.classList.contains('bsp-search-input')) return;
      _searchQuery = e.target.value.trim().toUpperCase();
      // Render() innerHTML'i yeniden yazıp input'un focus'unu kaybettirir —
      // burada sadece filtreyi tetikleyip listeyi güncelliyoruz, input'a
      // dokunmuyoruz (aşağıdaki _renderSync input'u yeniden odaklıyor).
      render();
    });
  }

  let _renderTimer = null;
  function render() {
    if (_renderTimer) clearTimeout(_renderTimer);
    _renderTimer = setTimeout(() => {
      // innerHTML tüm içeriği değiştirdiği için arama kutusundaki focus/imleç
      // konumu kayboluyor — render sonrası geri yüklüyoruz (her tuş vuruşunda
      // input'tan dışarı atılmasın diye).
      const active = document.activeElement;
      const wasSearchFocused = active?.classList?.contains('bsp-search-input');
      const caretPos = wasSearchFocused ? active.selectionStart : null;

      _renderSync();

      if (wasSearchFocused) {
        const input = document.querySelector('.bsp-search-input');
        if (input) {
          input.focus();
          if (caretPos != null) input.setSelectionRange(caretPos, caretPos);
        }
      }
    }, 50);
  }

  function _buildM1HammerHTML() {
    const allSignals = Array.isArray(window.m1HammerSignals) ? window.m1HammerSignals : [];
    const exFilter = _activeBotExchange();
    const signals = allSignals.filter(s => s.exchange === exFilter);

    if (!signals.length) {
      // M1 Hammer şu an sadece Binance verisiyle taranıyor — Bybit seçiliyken
      // liste her zaman boş gelir, bu bir hata değil.
      const excLabel = exFilter === 'bn' ? 'Binance' : 'Bybit';
      return `<div class="bsp-empty">Waiting for M1 Hammer signals on ${excLabel}...</div>`;
    }

    let filtered = _coinFilter === 'selected' && _selectedSymbol
      ? signals.filter(s => s.symbol.replace(/USDT$/, '') === _selectedSymbol)
      : signals;

    if (_searchQuery) {
      filtered = filtered.filter(s => s.symbol.toUpperCase().includes(_searchQuery));
    }

    if (!filtered.length) {
      return `<div class="bsp-empty">${_searchQuery ? 'No signals match "' + _esc(_searchQuery) + '".' : 'No signal for the selected coin.'}</div>`;
    }

    const sorted = [...filtered].sort((a, b) =>
      _sortOrder === 'desc' ? b.timestamp - a.timestamp : a.timestamp - b.timestamp
    );

    // Yıldız hesaplama: Boost value'ya göre
    function getStars(boost) {
      const b = Math.abs(boost || 0);
      if (b >= 4) return '⭐⭐⭐';
      if (b >= 2) return '⭐⭐';
      if (b >= 1) return '⭐';
      return '';
    }

    // RSI renk: <30 yeşil, >70 kırmızı
    const rsiColor = v => v < 30 ? '#16a34a' : v > 70 ? '#dc2626' : 'var(--text-primary)';
    // SRSI renk: <20 yeşil, >80 kırmızı
    const srsiColor = v => v < 20 ? '#16a34a' : v > 80 ? '#dc2626' : 'var(--text-primary)';

    // WT chip: sadece cross olan timeframe gösterilir
    // bull: -53/-60 arası → yeşil, -60 altı → yeşil + 🟢
    // bear: +53/+60 arası → kırmızı, +60 üstü → kırmızı + 🔴
    // -53/+53 arası → nötr (beyaz)
    // cross yoksa (null) → chip hiç render edilmez
    function wtChip(tf, val, dir) {
      if (val == null) return '';
      // Eşik dışı (nötr bölge) ise chip hiç render edilmez
      const inBullZone = dir === 'bull' && val <= -53;
      const inBearZone = dir === 'bear' && val >= 53;
      if (!inBullZone && !inBearZone) return '';
      let color = inBullZone ? '#16a34a' : '#dc2626';
      let dot = '';
      if (inBullZone && val < -60) dot = '🟢';
      if (inBearZone && val > 60) dot = '🔴';
      return `<div class="bsp-chip"><span class="bsp-tf">${tf}</span><span style="color:${color};font-weight:500;">${val}${dot}</span></div>`;
    }

    let html = `<div id="bsp-signals-list" style="overflow-y:auto; flex:1; padding:6px 8px; display:flex; flex-direction:column; gap:6px;">`;

    sorted.forEach(sig => {
      const wtBull = sig.wtDirection === 'bull';
      const borderColor = wtBull ? '#16a34a' : '#dc2626';

      const priceColor = sig.currentPrice > sig.prevPrice ? '#16a34a'
                       : sig.currentPrice < sig.prevPrice ? '#dc2626'
                       : 'var(--text-primary)';

      const frVal = sig.fr != null ? Number(sig.fr).toFixed(4) + '%' : '—';
      const frColor = Math.abs(sig.fr || 0) > 0.1 ? '#f59e0b' : 'var(--text-primary)';
      const frWarn = Math.abs(sig.fr || 0) > 0.1 ? ' ⚠' : '';

      const stars = getStars(sig.boostValue);

      // WT chip'lerini oluştur — sadece cross olan timeframe'ler
      const wtChips = [
        wtChip('5m',  sig.wt5m,  sig.wtDirection),
        wtChip('15m', sig.wt15m, sig.wtDirection),
        wtChip('1h',  sig.wt1h,  sig.wtDirection),
        wtChip('4h',  sig.wt4h,  sig.wtDirection),
        wtChip('1D',  sig.wt1d,  sig.wtDirection),
      ].filter(Boolean).join('');

      // 1D RSI uyarısı
      const dailyWarn = (sig.rsi1d != null && (sig.rsi1d < 30 || sig.rsi1d > 70))
        ? `<div style="margin-top:6px; padding:3px 6px; background:rgba(245,158,11,0.1); border:0.5px solid rgba(245,158,11,0.3); border-radius:4px; font-size:9px; color:#f59e0b;">
             ⚠ 1D RSI ${sig.rsi1d < 30 ? 'oversold' : 'overbought'} bölgesinde (${sig.rsi1d})
           </div>`
        : '';

      html += `
        <div style="background:var(--bg-secondary); border:0.5px solid var(--border-primary); border-radius:8px; padding:8px 10px; border-left:3px solid ${borderColor};">
          
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:6px;">
            <span class="bsp-ticker-link" data-symbol="${sig.symbol.replace(/USDT$/, '')}"
              style="font-weight:500; font-size:13px; color:var(--text-primary); cursor:pointer; text-decoration:underline; text-underline-offset:2px; text-decoration-color:rgba(255,255,255,0.25);">
              #${sig.symbol} ${stars}
            </span>
            <span style="font-size:12px; font-weight:500; color:${sig.boostValue >= 0 ? '#16a34a' : '#dc2626'};">
              ${sig.boostValue >= 0 ? '+' : ''}${Number(sig.boostValue).toFixed(2)}%
            </span>
          </div>

          <div style="display:flex; gap:10px; font-size:10px; margin-bottom:6px;">
            <span style="color:var(--text-secondary);">Current:<span style="color:${priceColor}; font-weight:500; margin-left:3px;">${sig.currentPrice}</span></span>
            <span style="color:var(--text-secondary);">Prev:<span style="color:var(--text-primary); font-weight:500; margin-left:3px;">${sig.prevPrice}</span></span>
            <span style="color:var(--text-secondary);">FR:<span style="color:${frColor}; font-weight:500; margin-left:3px;">${frVal}${frWarn}</span></span>
          </div>

          <div style="display:flex; flex-direction:column; gap:3px;">
            <div style="display:flex; align-items:center; gap:4px;">
              <span class="bsp-row-label">RSI</span>
              <div class="bsp-chip"><span class="bsp-tf">5m</span><span style="color:${rsiColor(sig.rsi5m)};font-weight:500;">${sig.rsi5m ?? '—'}</span></div>
              <div class="bsp-chip"><span class="bsp-tf">15m</span><span style="color:${rsiColor(sig.rsi15m)};font-weight:500;">${sig.rsi15m ?? '—'}</span></div>
              <div class="bsp-chip"><span class="bsp-tf">1h</span><span style="color:${rsiColor(sig.rsi1h)};font-weight:500;">${sig.rsi1h ?? '—'}</span></div>
              <div class="bsp-chip"><span class="bsp-tf">4h</span><span style="color:${rsiColor(sig.rsi4h)};font-weight:500;">${sig.rsi4h ?? '—'}</span></div>
            </div>
            <div style="display:flex; align-items:center; gap:4px;">
              <span class="bsp-row-label">SRSI</span>
              <div class="bsp-chip"><span class="bsp-tf">5m</span><span style="color:${srsiColor(sig.srsi5m)};font-weight:500;">${sig.srsi5m ?? '—'}</span></div>
              <div class="bsp-chip"><span class="bsp-tf">15m</span><span style="color:${srsiColor(sig.srsi15m)};font-weight:500;">${sig.srsi15m ?? '—'}</span></div>
              <div class="bsp-chip"><span class="bsp-tf">1h</span><span style="color:${srsiColor(sig.srsi1h)};font-weight:500;">${sig.srsi1h ?? '—'}</span></div>
              <div class="bsp-chip"><span class="bsp-tf">4h</span><span style="color:${srsiColor(sig.srsi4h)};font-weight:500;">${sig.srsi4h ?? '—'}</span></div>
            </div>
            ${wtChips ? `<div style="display:flex; align-items:center; gap:4px;"><span class="bsp-row-label">WT</span>${wtChips}</div>` : ''}
          </div>

          ${dailyWarn}
        </div>`;
    });

    html += `</div>`;
    return html;
  }

  function _renderSync() {
    // Tum hedef container'lari topla
    _allContainers = [
      document.getElementById('dp-signals-tab'),
      ..._extraContainers
    ].filter(Boolean);

    if (_allContainers.length === 0) return;

    // Dış sekme çubuğundaki kontroller (SE/arama/snipe/sırala) — içerik
    // dalından bağımsız, her render'da tazelenir.
    _renderTabbarControls();

    // Clean up previous chart instance
    if (_chartInstance) {
      if (Array.isArray(_chartInstance)) {
        _chartInstance.forEach(c => c?.destroy());
      } else {
        _chartInstance.destroy();
      }
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
            ScalpFR monitor is not running.
          </div>`;
      });
      return;
    }

    // ── 1. Vertical Bot Rail ──────────────────────────
    // Layout: .bsp-container > .bsp-body > [.bsp-bot-rail, .bsp-main]
    // Üst kontroller (SE/arama/snipe/sırala) artık burada değil — dış
    // Coin Detail/Bot Signals/News sekme çubuğuna taşındı, bkz.
    // _buildTabbarControlsHTML() ve _renderTabbarControls().
    let html = `<div class="bsp-container">`;
    html += `<div class="bsp-body">`;
    html += _buildBotRailHTML();
    html += `<div class="bsp-main">`;

    // ── 3. Content Area ──────────────────────────────
    if (_activeBot === 'm1hammer') {
      html += _buildM1HammerHTML();
      html += `</div></div></div>`; // .bsp-main / .bsp-body / .bsp-container
      _allContainers.forEach(c => { c.innerHTML = html; });
      return;
    }

    if (_activeBot !== 'fr') {
      html += `<div class="bsp-empty">This bot type is not active yet.</div>`;
      html += `</div></div></div>`; // .bsp-main / .bsp-body / .bsp-container
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

    // ── 4. Mini Chart Variables & Time Window ──
    let hasChart = false;
    let mainSignals = [];
    let altSignals = [];
    let chartStartTs = 0;
    let chartEndTs = 0;
    let timeRangeText = '';

    if (_coinFilter === 'selected' && _selectedSymbol) {
      const now = new Date();
      const startHour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + _chartHourOffset, 0, 0, 0);
      const endHour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + _chartHourOffset + 1, 0, 0, 0);
      
      chartStartTs = startHour.getTime();
      chartEndTs = endHour.getTime();

      const formatTime = (d) => d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
      timeRangeText = `${formatTime(startHour)} - ${formatTime(endHour)}`;
    }

    const signals = allSignals.filter(s => {
      if (_searchQuery && !s.symbol.toUpperCase().includes(_searchQuery)) return false;
      if (_coinFilter === 'selected' && _selectedSymbol) {
        const sigSym = s.symbol.replace(/USDT$/, '');
        if (sigSym !== _selectedSymbol) return false;
        // Seçili coin görünümünde sadece grafikteki saat dilimine ait sinyalleri göster
        if (s.timestamp < chartStartTs || s.timestamp > chartEndTs) return false;
        return true;
      } else if (_coinFilter === 'all') {
        if (s.timestamp < cutoff) return false;
        // Tüm coinler görünümünde sadece alarm (0.03+) seviyesindeki sinyaller gösterilir.
        if (s.severity !== 'alarm') return false;
        return true;
      }
      return true;
    });

    // Sort signals based on _sortOrder
    signals.sort((a, b) => _sortOrder === 'desc' ? b.timestamp - a.timestamp : a.timestamp - b.timestamp);

    if (_coinFilter === 'selected' && _selectedSymbol) {

      const filterWindow = (arr) => arr.filter(s => s.timestamp >= chartStartTs && s.timestamp <= chartEndTs);

      const mainTracker = window[`frTracker_${mainExchange}`];
      const altTracker = window[`frTracker_${altExchange}`];

      // Calculate earliest timestamp in tracker to know how far back we can go
      const allMainHistory = (mainTracker?.getHistory(_selectedSymbol + 'USDT') || []);
      const allAltHistory  = (altTracker?.getHistory(_selectedSymbol + 'USDT') || []);
      const allTimestamps  = [...allMainHistory, ...allAltHistory].map(h => h.timestamp);
      const earliestTs     = allTimestamps.length ? Math.min(...allTimestamps) : Date.now();
      const earliestHour   = new Date(earliestTs);
      earliestHour.setMinutes(0, 0, 0);
      const canGoBack = chartStartTs > earliestHour.getTime();

      mainSignals = filterWindow(allMainHistory.map(h => ({ timestamp: h.timestamp, currentFR: h.value })))
        .sort((a, b) => a.timestamp - b.timestamp);

      altSignals = filterWindow(allAltHistory.map(h => ({ timestamp: h.timestamp, currentFR: h.value })))
        .sort((a, b) => a.timestamp - b.timestamp);

      const hasAltData = altSignals.length > 0;

      // Always render chart titlebar when in selected mode (for navigation even if window is empty)
      hasChart = true;
      html += `
          <div id="bsp-chart-titlebar" style="
            display:flex; align-items:center; justify-content:space-between;
            padding:5px 10px; cursor:pointer; user-select:none;
            background:var(--bg-secondary);
            border-bottom:0.5px solid var(--border-primary);
          ">
            <span style="font-size:10px; font-weight:600; color:var(--text-primary);">
              ${_selectedSymbol} FR — <span style="color:#f0b90b">${mainExchange.toUpperCase()}</span>${hasAltData || altSignals.length === 0 && allAltHistory.length > 0 ? ` <span style="color:var(--text-secondary)">+</span> <span style="color:#7b61ff">${altExchange.toUpperCase()}</span>` : ''}
            </span>
            <div style="display:flex; align-items:center; gap:8px;">
              <span class="bsp-time-nav" data-dir="-1" style="font-size:10px; padding:2px 6px; background:var(--bg-tertiary); border-radius:3px; color:${canGoBack ? 'var(--text-active)' : 'var(--text-secondary)'}; opacity:${canGoBack ? 1 : 0.3}; cursor:${canGoBack ? 'pointer' : 'not-allowed'};">◀</span>
              <span style="font-size:10px; color:var(--text-secondary); font-variant-numeric:tabular-nums;">[${timeRangeText}]</span>
              <span class="bsp-time-nav" data-dir="1" style="font-size:10px; padding:2px 6px; background:var(--bg-tertiary); border-radius:3px; color:${_chartHourOffset >= 0 ? 'var(--text-secondary)' : 'var(--text-active)'}; opacity:${_chartHourOffset >= 0 ? 0.3 : 1}; cursor:${_chartHourOffset >= 0 ? 'not-allowed' : 'pointer'};">▶</span>
              <span id="bsp-chart-arrow" style="
                margin-left:4px;
                font-size:10px; color:var(--text-secondary);
                display:inline-block;
                transform: ${_chartOpen ? 'rotate(0deg)' : 'rotate(-90deg)'};
                transition: transform 0.22s ease;
              ">▼</span>
            </div>
          </div>
          <div id="bsp-chart-section" style="
            overflow:hidden;
            max-height:${_chartOpen ? '200px' : '0'};
            transition: max-height 0.28s ease;
            border-bottom:0.5px solid var(--border-primary);
          ">
            <div class="bsp-chart-container">
              ${mainSignals.length === 0 && altSignals.length === 0
                ? `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-secondary);font-size:10px;opacity:0.6;">No data for this hour</div>`
                : `<canvas id="bsp-mini-chart"></canvas>`
              }
            </div>
          </div>`;
    }

    // Orta bölüm (header + satırlar/boş mesaj) flex:1 alır — böylece
    // altındaki "son 24s" footer'ı her zaman panelin gerçek alt kenarına
    // yapışık kalır ve panel dikey resize edildiğinde onunla birlikte hareket eder.
    html += `<div style="display:flex; flex-direction:column; flex:1; min-height:0;">`;

    // ── 5. Column Headers ────────────────────────────
    html += `
      <div style="
        display:grid;
        grid-template-columns: 16px 58px minmax(54px,1fr) minmax(54px,1fr) minmax(60px,1fr) minmax(58px,1fr) minmax(50px,1fr);
        font-size:10px;
        color: var(--text-active); font-weight:600;
        padding:6px 8px;
        border-bottom:1px solid var(--border-primary);
        gap:6px;
        background: var(--bg-secondary);
      ">
        <span></span>
        <span style="text-align:left;">Ticker</span>
        <span style="text-align:right;">Previous</span>
        <span style="text-align:right;">Current</span>
        <span style="text-align:right;">Delta</span>
        <span style="text-align:right;">Remaining</span>
        <span style="text-align:right;">Time</span>
      </div>`;

    // ── 6. Signal Rows ───────────────────────────────
    if (!signals.length) {
      html += `
        <div style="padding:24px 16px; text-align:center; color: var(--text-active); font-size:12px;">
          Waiting for signal...<br>
          <span style="font-size:10px; opacity:0.6;">${mainMonitor?.windows?.size || 0} active windows being watched</span>
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
            grid-template-columns: 16px 58px minmax(54px,1fr) minmax(54px,1fr) minmax(60px,1fr) minmax(58px,1fr) minmax(50px,1fr);
            align-items:center;
            background:${bgColor};
            border-bottom:0.5px solid var(--border-primary);
            box-shadow:inset 3px 0 0 ${accentColor};
            padding:7px 8px;
            gap:6px;
            font-size:11px;
            opacity:${opacity};
          ">
            <span style="color:${accentColor}; font-size:13px; line-height:1; font-weight: bold;">${arrow}</span>
            <span class="bsp-ticker-link" data-symbol="${symDisplay}" style="color:var(--text-active); font-weight:600; cursor:pointer; text-decoration:underline; text-underline-offset:2px; text-decoration-color:rgba(255,255,255,0.25); transition:color 0.15s; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="Open ${symDisplay} chart">${symDisplay}</span>
            <span style="color: var(--text-active); text-align:right;">${sig.display.startFR}</span>
            <span style="color:${accentColor}; text-align:right;">${sig.display.currentFR}</span>
            <span style="color:${accentColor}; font-weight:600; text-align:right;">${displayDelta}</span>
            <span style="color: var(--text-active); text-align:right;">${remainingText}</span>
            <span style="text-align:right; color: var(--text-active); font-size:10px;">${sig.display.time}</span>
          </div>`;
      });
      html += `</div>`;
    }

    html += `</div>`; // orta bölüm (header + satırlar/boş mesaj) flex:1 wrapper kapanışı

    // Footer
    html += `
      <div style="text-align:center; font-size:10px; color: var(--text-active); padding:6px; border-top:1px solid var(--border-primary); background: var(--bg-secondary);">
        last 24h · ${signals.length} signals
      </div>`;

    html += `</div></div></div>`; // .bsp-main / .bsp-body / .bsp-container

    // Her hedef container'a ayni HTML'i yaz
    _allContainers.forEach(c => { c.innerHTML = html; });

    // Önceki chart instance'larını temizleyip dizi olarak yeniden başlatalım
    _chartInstance = [];

    // ── 7. Render Mini Chart ─────────────────────────
    if (hasChart) {
      _allContainers.forEach((container) => {
        const canvas = container.querySelector('#bsp-mini-chart');
        const ctx = canvas?.getContext('2d');
        if (!ctx) return;

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
            pointBackgroundColor: mainSignals.map((s, i) =>
              i === 0 ? signalGreen : (mainSignals[i-1].currentFR - s.currentFR) > 0 ? signalGreen : signalRed
            ),
            pointBorderColor: mainSignals.map((s, i) =>
              i === 0 ? signalGreen : (mainSignals[i-1].currentFR - s.currentFR) > 0 ? signalGreen : signalRed
            ),
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
            pointBackgroundColor: altSignals.map((s, i) =>
              i === 0 ? signalGreen : (altSignals[i-1].currentFR - s.currentFR) > 0 ? signalGreen : signalRed
            ),
            pointBorderColor: altSignals.map((s, i) =>
              i === 0 ? signalGreen : (altSignals[i-1].currentFR - s.currentFR) > 0 ? signalGreen : signalRed
            ),
            pointStyle:  'circle',
            pointRadius: 3,
            tension:     0.2,
            fill:        false,
          });
        }

        const instance = new Chart(ctx, {
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
                min: chartStartTs,
                max: chartEndTs,
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

        _chartInstance.push(instance);
      });
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
    if (!el || _extraContainers.includes(el)) return;
    _extraContainers.push(el);
    _attachDelegation(el); // Event delegation ekle
    render(); // Hemen render et
  }

  function removeContainer(el) {
    _extraContainers = _extraContainers.filter(c => c !== el);
  }

  return { init, render, addContainer, removeContainer, attachTabbarTarget };
})();

window.BotSignalsPanel = BotSignalsPanel;
