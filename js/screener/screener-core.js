/**
 * ScreenerCore — BN/BB Screener + BN All / BB All
 * 
 * Screener tabs : Symbol | Price | Chg% | FR% | FR(h) | Vol(USD) | OI
 *   → En negatif FR'li 20 coin listelenir
 * All tabs      : Symbol | Price | Chg% | Vol(USD)
 *   → Tüm coinler hacme göre sıralı
 * 
 * Günlük sembol listesi güncellenir, delist olan coinler çıkarılır.
 */
const ScreenerCore = (() => {

  /* ── Kolon tanımları ──────────────────────────────── */
  const COLS_SCREENER = [
    { key: 'sym',   label: 'Symbol',  cls: 'wl-col-sym',   sort: 'sym'   },
    { key: 'price', label: 'Price',   cls: 'wl-col-right',  sort: 'price' },
    { key: 'pct',   label: 'Chg%',   cls: 'wl-col-right',  sort: 'pct'   },
    { key: 'fr',    label: 'FR%',     cls: 'wl-col-right',  sort: 'fr'    },
    { key: 'frh',   label: 'FR(h)',   cls: 'wl-col-right',  sort: 'frh'   },
    { key: 'vol',   label: 'Vol(USD)',cls: 'wl-col-right',  sort: 'vol'   },
    { key: 'oi',    label: 'OI',      cls: 'wl-col-right',  sort: 'oi'    },
  ];

  const COLS_ALL = [
    { key: 'sym',   label: 'Symbol',  cls: 'wl-col-sym',   sort: 'sym'   },
    { key: 'price', label: 'Price',   cls: 'wl-col-right',  sort: 'price' },
    { key: 'pct',   label: 'Chg%',   cls: 'wl-col-right',  sort: 'pct'   },
    { key: 'fr',    label: 'FR%',     cls: 'wl-col-right',  sort: 'fr'    },
    { key: 'frh',   label: 'FR(h)',   cls: 'wl-col-right',  sort: 'frh'   },
    { key: 'vol',   label: 'Vol(USD)',cls: 'wl-col-right',  sort: 'vol'   },
    { key: 'oi',    label: 'OI',      cls: 'wl-col-right',  sort: 'oi'    },
  ];

  /* ── State ────────────────────────────────────────── */
  let _list      = null;
  let _colHeader = null;
  let _searchEl  = null;
  let _panel     = null;   // #right-panel — mode attribute için

  let _rows     = [];
  let _filtered = [];
  let _sortKey  = 'fr';
  let _sortDir  = 'asc';
  let _activeTab = 'bn-screener';
  let _selected  = null;
  let _priceMap    = new Map();
  let _frTracker   = null;
  let _oiManager   = null;
  let _renderTimer = null;

  // Günlük sembol cache: { binance: [...], bybit: [...], date: 'YYYY-MM-DD' }
  let _symCache = _loadSymCache();

  function _today() { return new Date().toISOString().slice(0, 10); }

  function _loadSymCache() {
    try {
      const s = localStorage.getItem('pintrade_sym_cache');
      if (s) return JSON.parse(s);
    } catch(e) {}
    return { binance: [], bybit: [], date: '' };
  }

  function _saveSymCache() {
    try { localStorage.setItem('pintrade_sym_cache', JSON.stringify(_symCache)); } catch(e) {}
  }

  /* ── Sayı formatları ──────────────────────────────── */
  function _fmtPrice(v) {
    if (v === null || v === undefined) return '—';
    return parseFloat(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 });
  }

  function _fmtPct(v) {
    if (v === null || v === undefined) return '—';
    const n = parseFloat(v);
    return (n >= 0 ? '+' : '') + n.toFixed(2) + '%';
  }

  function _fmtFR(v) {
    if (v === null || v === undefined) return '—';
    return (parseFloat(v) * 100).toFixed(4) + '%';
  }

  function _fmtVol(v) {
    if (v === null || v === undefined) return '—';
    if (v >= 1e9) return (v / 1e9).toFixed(2) + 'B';
    if (v >= 1e6) return (v / 1e6).toFixed(2) + 'M';
    if (v >= 1e3) return (v / 1e3).toFixed(1) + 'K';
    return v.toFixed(0);
  }

  function _fmtOI(v) {
    if (v === null || v === undefined) return '—';
    if (v >= 1e9) return '$' + (v / 1e9).toFixed(2) + 'B';
    if (v >= 1e6) return '$' + (v / 1e6).toFixed(1) + 'M';
    if (v >= 1e3) return '$' + (v / 1e3).toFixed(0) + 'K';
    return '$' + v.toFixed(0);
  }


  function _pctCls(v) {
    if (v === null || v === undefined) return '';
    return v > 0 ? 'pos' : v < 0 ? 'neg' : 'neu';
  }

  /* ── Col header render ────────────────────────────── */
  function _renderHeader(cols) {
    if (!_colHeader) return;
    _colHeader.innerHTML = cols.map(c => `
      <span class="${c.cls}" data-sort="${c.sort}">
        ${c.label} <span class="wl-sort-arrow"></span>
      </span>`).join('');
    _colHeader.querySelectorAll('[data-sort]').forEach(th => {
      th.addEventListener('click', () => _sort(th.dataset.sort));
    });
    _updateSortArrows();
  }

  /* ── Row render ───────────────────────────────────── */
  function _buildRowScreener(d) {
    const row = document.createElement('div');
    row.className = 'wl-row';
    row.dataset.sym = d.sym;
    if (d.sym === _selected) row.classList.add('selected');

    const frCls = d.fr !== null ? (d.fr < 0 ? 'neg' : 'pos') : '';
    const trendCls = _frTracker ? _frTracker.getFRTrendType(d.sym + 'USDT') : 'neutral';

    // FR countdown warning: < 15 minutes remaining
    const secsLeft = d.nextFundingTime ? Math.max(0, (d.nextFundingTime - Date.now()) / 1000) : Infinity;
    const frhCls = secsLeft < 15 * 60 ? 'frh-ending' : '';
    const exc = _activeTab.startsWith('bn') ? 'binance' : 'bybit';

    // Sinyal kontrolü (ScalpFRMonitor)
    const monitor = window[`scalpFRMonitor_${exc}`] || window.scalpFRMonitor;
    let signalBadge = '';
    if (monitor) {
        const lastSig = monitor.getLastSignal(d.sym + 'USDT');
        // Sinyal son 30 dakika içinde geldiyse göster
        if (lastSig && (Date.now() - lastSig.timestamp) < 30 * 60 * 1000) {
            if (lastSig.severity === 'alarm') signalBadge = '<span title="Global Alarm" style="margin-left:2px; font-size:10px">🚨</span>';
            else if (lastSig.severity === 'rapid') signalBadge = '<span title="Ani Yükseliş" style="margin-left:2px; font-size:10px">⚡</span>';
            else signalBadge = '<span title="Hareketli" style="margin-left:2px; font-size:10px; color:var(--signal-color-green)">•</span>';
        }
    }

    row.innerHTML = `
      <span class="wl-sym">${d.sym}USDT${signalBadge}</span>
      <span class="wl-price wl-col-right ${_pctCls(d.pct)}">${_fmtPrice(d.price)}</span>
      <span class="wl-pct wl-col-right ${_pctCls(d.pct)}">${_fmtPct(d.pct)}</span>
      <span class="wl-fr wl-col-right ${frCls} fr-trend-${trendCls}">${_fmtFR(d.fr)}</span>
      <span class="wl-frh wl-col-right ${frhCls}">${window.fundingIntervalManager?.get(d.sym + 'USDT', exc) ?? '—'}</span>
      <span class="wl-vol wl-col-right">${_fmtVol(d.vol)}</span>
      <span class="wl-oi wl-col-right ${d.oiDir === 'up' ? 'pos' : d.oiDir === 'down' ? 'neg' : ''}">${_fmtOI(d.oi)}</span>
    `;
    const symSpan = row.querySelector('.wl-sym');
    if (symSpan) {
      symSpan.addEventListener('click', () => _selectRow(d.sym));
    }
    return row;
  }

  function _buildRowAll(d) {
    const row = document.createElement('div');
    row.className = 'wl-row';
    row.dataset.sym = d.sym;
    if (d.sym === _selected) row.classList.add('selected');

    const frCls = d.fr !== null ? (d.fr < 0 ? 'neg' : 'pos') : '';
    const trendCls = _frTracker ? _frTracker.getFRTrendType(d.sym + 'USDT') : 'neutral';
    const exc = _activeTab.startsWith('bn') ? 'binance' : 'bybit';
    
    row.innerHTML = `
      <span class="wl-sym">${d.sym}USDT</span>
      <span class="wl-price wl-col-right ${_pctCls(d.pct)}">${_fmtPrice(d.price)}</span>
      <span class="wl-pct wl-col-right ${_pctCls(d.pct)}">${_fmtPct(d.pct)}</span>
      <span class="wl-fr wl-col-right ${frCls} fr-trend-${trendCls}">${_fmtFR(d.fr)}</span>
      <span class="wl-frh wl-col-right">${window.fundingIntervalManager?.get(d.sym + 'USDT', exc) ?? '—'}</span>
      <span class="wl-vol wl-col-right">${_fmtVol(d.vol)}</span>
      <span class="wl-oi wl-col-right ${d.oiDir === 'up' ? 'pos' : d.oiDir === 'down' ? 'neg' : ''}">${_fmtOI(d.oi)}</span>
    `;
    const symSpan = row.querySelector('.wl-sym');
    if (symSpan) {
      symSpan.addEventListener('click', () => _selectRow(d.sym));
    }
    return row;
  }

  function _selectRow(sym) {
    _selected = sym;
    _list.querySelectorAll('.wl-row').forEach(r =>
      r.classList.toggle('selected', r.dataset.sym === sym));
    const exchange = _activeTab.startsWith('bn') ? 'binance' : 'bybit';
    const fullSym = sym.endsWith('USDT') ? sym : sym + 'USDT';
    State.setSymbol(fullSym, exchange);
  }

  /* ── List render ──────────────────────────────────── */
  function _renderList() {
    if (!_list) return;
    const isAll = _activeTab.endsWith('-all');
    const frag = document.createDocumentFragment();
    let separatorAdded = false;
    const exc = _activeTab.startsWith('bn') ? 'binance' : 'bybit';

    _filtered.forEach((d, i) => {
      const is1h = window.fundingIntervalManager?.get(d.sym + 'USDT', exc) === '1h';
      if (!isAll && !separatorAdded && !is1h && i > 0) {
        const prev = _filtered[i - 1];
        if (window.fundingIntervalManager?.get(prev.sym + 'USDT', exc) === '1h') {
          const sep = document.createElement('div');
          sep.className = 'wl-interval-separator';
          frag.appendChild(sep);
          separatorAdded = true;
        }
      }
      frag.appendChild(isAll ? _buildRowAll(d) : _buildRowScreener(d));
    });

    _list.innerHTML = '';
    _list.appendChild(frag);
  }

  /* ── Sort & filter ────────────────────────────────── */
  function _sort(key) {
    _sortDir = (_sortKey === key && _sortDir === 'asc') ? 'desc' : 'asc';
    _sortKey = key;
    _applyFilterSort();
    _updateSortArrows();
  }

  function _updateSortArrows() {
    if (!_colHeader) return;
    _colHeader.querySelectorAll('.wl-sort-arrow').forEach(el => el.className = 'wl-sort-arrow');
    const el = _colHeader.querySelector(`[data-sort="${_sortKey}"] .wl-sort-arrow`);
    if (el) el.classList.add(_sortDir);
  }  

  function _applyFilterSort() {
    const q = (_searchEl?.value || '').trim().toUpperCase();
    let arr = q ? _rows.filter(d => d.sym.includes(q)) : [..._rows];

    arr.sort((a, b) => {
      let av = a[_sortKey], bv = b[_sortKey];
      if (av === null || av === undefined) av = _sortDir === 'asc' ? Infinity : -Infinity;
      if (bv === null || bv === undefined) bv = _sortDir === 'asc' ? Infinity : -Infinity;
      if (typeof av === 'string') return _sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      return _sortDir === 'asc' ? av - bv : bv - av;
    });

    // 1h interval coinleri üste taşı
    if (window.fundingIntervalManager) {
      const exc = _activeTab.startsWith('bn') ? 'binance' : 'bybit';
      const coins1h = arr.filter(d => fundingIntervalManager.get(d.sym + 'USDT', exc) === '1h');
      const coinsOther = arr.filter(d => fundingIntervalManager.get(d.sym + 'USDT', exc) !== '1h');
      arr = [...coins1h, ...coinsOther];
    }

    _filtered = arr;
    _renderList();
  }

  // OI çek
  if (_oiManager) {
    const syms = _rows.map(r => r.sym);
    _oiManager.fetchAllOI(syms, _priceMap).then(() => {
      _rows.forEach(r => {
        const oi = _oiManager.get(r.sym);
        if (oi) r.oi = oi.oiUSD;
      });
      _applyFilterSort();
    });
  }

  /* ── Binance Screener (en negatif FR 20) ──────────── */
  async function _loadBinanceScreener() {
    _setLoading();
    try {
      // 1) Sembol listesini güncelle (günlük cache)
      const symbols = await _getBinanceSymbols();

      // 2) Funding rates
      const frResp = await fetch(`${AppConfig.API.binance.restFutures}/fapi/v1/premiumIndex?limit=500&_t=${Date.now()}`);
      const frData = await frResp.json();
      if (!Array.isArray(frData)) {
        console.warn('[ScreenerCore] Binance premiumIndex API hatasi:', frData);
        return;
      }

      // 3) 24h ticker (toplu)
      const tkResp = await fetch(`${AppConfig.API.binance.restFutures}/fapi/v1/ticker/24hr?_t=${Date.now()}`);
      const tkData = await tkResp.json();
      const tkMap = {};
      tkData.forEach(t => { tkMap[t.symbol] = t; });

      // 4) Sadece cache'deki sembolleri filtrele → delist koruması
      const validSet = new Set(symbols);
      const rows = frData
        .filter(f => f.symbol.endsWith('USDT') && validSet.has(f.symbol))
        .map(f => {
          if (window.FRDataBridge) {
            FRDataBridge.feed('binance', f.symbol, parseFloat(f.lastFundingRate) * 100, Date.now());
          }
          const tk = tkMap[f.symbol] || {};
          return {
            sym:   f.symbol.replace(/USDT$/, ''),
            price: parseFloat(f.markPrice) || null,
            pct:   tk.priceChangePercent ? parseFloat(tk.priceChangePercent) : null,
            fr:    parseFloat(f.lastFundingRate) || null,
            frh:   _frInterval(window.fundingIntervalManager?.getNextFundingTime(f.symbol, 'binance') || f.nextFundingTime),
            nextFundingTime: window.fundingIntervalManager?.getNextFundingTime(f.symbol, 'binance') || parseInt(f.nextFundingTime) || 0,
            vol:   tk.quoteVolume ? parseFloat(tk.quoteVolume) : null,
            oi:    null,  // OI ayrı endpoint — ileride eklenecek
          };
        });

      // En negatif FR 20 coin
      rows.sort((a, b) => (a.fr ?? 0) - (b.fr ?? 0));
      _rows = rows.slice(0, 20);
      _sortKey = 'fr'; _sortDir = 'asc';
      _applyFilterSort(); // İlk render (OI'siz)

      // 5) OI batch çek — Anlık v1/openInterest ile
      const fetchOI = async (sym, price, oldOi) => {
        try {
          const r = await fetch(`${AppConfig.API.binance.restFutures}/fapi/v1/openInterest?symbol=${sym}USDT&_t=${Date.now()}`);
          if (!r.ok) return null;
          const d = await r.json();
          if (!d?.openInterest) return null;
          
          let current = parseFloat(d.openInterest);
          if (price) current *= price; // USD'ye çevir
          
          // Anlık değer olduğu için yönü elimizdeki eski OI ile kıyaslıyoruz
          const oiDir = oldOi ? (current >= oldOi ? 'up' : 'down') : 'up';
          return { oi: current, oiDir };
        } catch { return null; }
      };

      const batchSize = 5;
      for (let i = 0; i < _rows.length; i += batchSize) {
        const batch = _rows.slice(i, i + batchSize);
        const results = await Promise.allSettled(batch.map(r => fetchOI(r.sym, r.price, r.oi)));
        results.forEach((res, j) => {
          if (res.status === 'fulfilled' && res.value !== null) {
            _rows[i + j].oi    = res.value.oi;
            _rows[i + j].oiDir = res.value.oiDir;
          }
        });
      }
      _applyFilterSort(); // OI ile yeniden render
      if (typeof EventBus !== 'undefined') {
        EventBus.emit('screener:loaded');
      }


    } catch(e) {
      console.error('[ScreenerCore] BN Screener error:', e);
      _setError();
    }
  }

  /* ── Binance All ──────────────────────────────────── */
  async function _loadBinanceAll() {
    _setLoading();
    try {
      const symbols = await _getBinanceSymbols();
      const tkResp = await fetch(`${AppConfig.API.binance.restFutures}/fapi/v1/ticker/24hr?_t=${Date.now()}`);
      const tkData = await tkResp.json();
      const validSet = new Set(symbols);

      _rows = tkData
        .filter(t => t.symbol.endsWith('USDT') && validSet.has(t.symbol))
        .map(t => ({
          sym:   t.symbol.replace(/USDT$/, ''),
          price: parseFloat(t.lastPrice) || null,
          pct:   parseFloat(t.priceChangePercent) || null,
          vol:   parseFloat(t.quoteVolume) || null,
        }))
        .filter(r => r.price > 0);

      _sortKey = 'vol'; _sortDir = 'desc';
      _applyFilterSort();
    } catch(e) {
      console.error('[ScreenerCore] BN All error:', e);
      _setError();
    }
  }

  /* ── Bybit Screener (en negatif FR 20) ───────────── */
  async function _loadBybitScreener() {
    _setLoading();
    try {
      const symbols = await _getBybitSymbols();
      const resp = await fetch('https://api.bybit.com/v5/market/tickers?category=linear');
      const data = await resp.json();
      const validSet = new Set(symbols);

      const rows = (data?.result?.list || [])
        .filter(t => t.symbol.endsWith('USDT') && validSet.has(t.symbol))
        .map(t => {
          if (window.FRDataBridge) {
            FRDataBridge.feed('bybit', t.symbol, parseFloat(t.fundingRate) * 100, Date.now());
          }
          return {
            sym:   t.symbol.replace(/USDT$/, ''),
            price: parseFloat(t.lastPrice) || null,
            pct:   parseFloat(t.price24hPcnt) * 100 || null,
            fr:    parseFloat(t.fundingRate) || null,
            frh:   _frInterval(window.fundingIntervalManager?.getNextFundingTime(t.symbol, 'bybit') || parseInt(t.nextFundingTime) || 0),
            nextFundingTime: window.fundingIntervalManager?.getNextFundingTime(t.symbol, 'bybit') || parseInt(t.nextFundingTime) || 0,
            vol:   parseFloat(t.turnover24h) || null,
            oi:    parseFloat(t.openInterestValue) || null,
            oiDir: null,
          };
        });

      rows.sort((a, b) => (a.fr ?? 0) - (b.fr ?? 0));
      _rows = rows.slice(0, 20);
      _sortKey = 'fr'; _sortDir = 'asc';
      _applyFilterSort(); // İlk render (oiDir'siz)

      // Bybit OI trend: son 2 snapshot karşılaştır
      const fetchBybitOI = async (sym) => {
        try {
          const r = await fetch(`https://api.bybit.com/v5/market/open-interest?category=linear&symbol=${sym}USDT&intervalTime=5min&limit=2`);
          if (!r.ok) return null;
          const d = await r.json();
          const list = d?.result?.list || [];
          if (list.length < 2) return null;
          const current  = parseFloat(list[0].openInterestValue || 0);
          const previous = parseFloat(list[1].openInterestValue || 0);
          return current >= previous ? 'up' : 'down';
        } catch { return null; }
      };

      const batchSize = 5;
      for (let i = 0; i < _rows.length; i += batchSize) {
        const batch = _rows.slice(i, i + batchSize);
        const results = await Promise.allSettled(batch.map(r => fetchBybitOI(r.sym)));
        results.forEach((res, j) => {
          if (res.status === 'fulfilled' && res.value !== null) {
            _rows[i + j].oiDir = res.value;
          }
        });
      }
      _applyFilterSort(); // oiDir ile yeniden render
      if (typeof EventBus !== 'undefined') {
        EventBus.emit('screener:loaded');
      }

    } catch(e) {
      console.error('[ScreenerCore] BB Screener error:', e);
      _setError();
    }
  }

  /* ── Bybit All ────────────────────────────────────── */
  async function _loadBybitAll() {
    _setLoading();
    try {
      const symbols = await _getBybitSymbols();
      const resp = await fetch('https://api.bybit.com/v5/market/tickers?category=linear');
      const data = await resp.json();
      const validSet = new Set(symbols);

      _rows = (data?.result?.list || [])
        .filter(t => t.symbol.endsWith('USDT') && validSet.has(t.symbol))
        .map(t => ({
          sym:   t.symbol.replace(/USDT$/, ''),
          price: parseFloat(t.lastPrice) || null,
          pct:   parseFloat(t.price24hPcnt) * 100 || null,
          vol:   parseFloat(t.turnover24h) || null,
        }))
        .filter(r => r.price > 0);

      _sortKey = 'vol'; _sortDir = 'desc';
      _applyFilterSort();
    } catch(e) {
      console.error('[ScreenerCore] BB All error:', e);
      _setError();
    }
  }

  /* ── Sembol cache (günlük) ────────────────────────── */
  async function _getBinanceSymbols() {
    if (_symCache.date === _today() && _symCache.binance.length > 0) {
      return _symCache.binance;
    }
    const resp = await fetch(`${AppConfig.API.binance.restFutures}/fapi/v1/exchangeInfo?_t=${Date.now()}`);
    if (!resp.ok) throw new Error(`exchangeInfo HTTP ${resp.status}`);
    const data = await resp.json();
    if (!data || !Array.isArray(data.symbols)) throw new Error('exchangeInfo: symbols dizisi yok');
    const syms = data.symbols
      .filter(s => s.status === 'TRADING' && s.symbol.endsWith('USDT'))
      .map(s => s.symbol);
    _symCache.binance = syms;
    _symCache.date    = _today();
    _saveSymCache();
    return syms;
  }

  async function _getBybitSymbols() {
    if (_symCache.date === _today() && _symCache.bybit.length > 0) {
      return _symCache.bybit;
    }
    const resp = await fetch('https://api.bybit.com/v5/market/instruments-info?category=linear&limit=1000');
    const data = await resp.json();
    const syms = (data?.result?.list || [])
      .filter(s => s.status === 'Trading' && s.symbol.endsWith('USDT'))
      .map(s => s.symbol);
    _symCache.bybit = syms;
    _symCache.date  = _today();
    _saveSymCache();
    return syms;
  }

  /* ── FR countdown ─────────────────────────────────── */
  function _frInterval(nextFundingTime) {
    if (!nextFundingTime) return '—';
    const diff = nextFundingTime - Date.now();
    if (diff <= 0) return '0m';
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  /* ── UI helpers ───────────────────────────────────── */
  function _setLoading() {
    if (_list) _list.innerHTML = '<div style="color:var(--text-secondary);font-size:11px;text-align:center;padding:24px">Yükleniyor...</div>';
  }

  function _throttledRender() {
    if (_renderTimer) return;
    _renderTimer = setTimeout(() => { _applyFilterSort(); _renderTimer = null; }, 1000);
  }

  // ── MarketDataStore'dan Binance anlık güncellemelerini dinle ──
  // Artık 5 saniyelik REST poll yok — MDS WebSocket'ten her 1-3sn'de push eder.
  function _startMDSListeners() {
    // Fiyat + hacim güncellemesi
    EventBus.on('mds:tick', ({ symbol, price, pct24h, volume24h }) => {
      if (!_activeTab.startsWith('bn')) return;
      const sym = symbol.replace(/USDT$/, '');
      _priceMap.set(sym, price);

      const row = _rows.find(r => r.sym === sym);
      if (row) {
        row.price = price;
        row.pct   = pct24h;
        row.vol   = volume24h;
        _throttledRender();
      }
    });

    // Funding Rate güncellemesi
    EventBus.on('mds:fr', ({ symbol, rate, nextFundingTime }) => {
      if (!_activeTab.startsWith('bn')) return;
      const sym = symbol.replace(/USDT$/, '');

      // FRTracker'a besle
      if (_frTracker) _frTracker.addFRValue(symbol, rate);

      const row = _rows.find(r => r.sym === sym);
      if (row) {
        row.fr = rate / 100; // screener ham değer bekliyor (0.0001 formatı)
        row.nextFundingTime = nextFundingTime;
        row.frh = _frInterval(nextFundingTime);
        _throttledRender();
      }
    });

    // OI güncellemesi
    EventBus.on('mds:oi', ({ symbol, value, dir }) => {
      if (!_activeTab.startsWith('bn')) return;
      const sym = symbol.replace(/USDT$/, '');
      const row = _rows.find(r => r.sym === sym);
      if (row) {
        row.oi    = value;
        row.oiDir = dir;
        _throttledRender();
      }
    });
  }

  // Bybit polling — Bybit ban riski düşük, REST kullanmaya devam
  let _bbPollTimer = null;

  function _startBybitPolling() {
    if (_bbPollTimer) clearInterval(_bbPollTimer);
    _pollBybitPrices();
    _bbPollTimer = setInterval(_pollBybitPrices, 5000);
  }

  async function _pollBybitPrices() {
    if (!_activeTab.startsWith('bb')) return;

    try {
      const res = await fetch(`https://api.bybit.com/v5/market/tickers?category=linear&_t=${Date.now()}`);
      if (!res.ok) return;
      const json = await res.json();
      const list = json?.result?.list || [];

      let changed = false;
      list.forEach(d => {
        if (!d.symbol.endsWith('USDT')) return;
        const sym   = d.symbol.replace(/USDT$/, '');
        const price = parseFloat(d.lastPrice);
        const fr    = parseFloat(d.fundingRate);
        const pct   = parseFloat(d.price24hPcnt) * 100;

        _priceMap.set(sym, price);

        if (window.FRDataBridge) {
          FRDataBridge.feed('bybit', d.symbol, fr * 100, Date.now());
        }

        const row = _rows.find(r => r.sym === sym);
        if (row) {
          row.price = price;
          row.fr    = fr;
          row.pct   = pct;
          changed   = true;
        }
      });

      if (changed) _throttledRender();

    } catch (e) {
      console.warn('[ScreenerCore] Bybit poll error:', e);
    }
  }

  function _setError() {
    if (_list) _list.innerHTML = '<div style="color:var(--accent-red);font-size:11px;text-align:center;padding:24px">Veri alınamadı</div>';
  }

  /* ── Tab switch ───────────────────────────────────── */
  function _setTab(tab) {
    _activeTab = tab;
    _rows = []; _filtered = [];

    const isScreener = tab.endsWith('-screener');
    const cols = isScreener ? COLS_SCREENER : COLS_ALL;

    // Panel mode attribute → CSS grid değişsin
    if (_panel) _panel.setAttribute('data-wl-mode', isScreener ? 'screener' : 'all');

    _renderHeader(cols);

    if (tab === 'bn-screener') _loadBinanceScreener();
    else if (tab === 'bb-screener') _loadBybitScreener();
    else if (tab === 'bn-all')  _loadBinanceAll();
    else if (tab === 'bb-all')  _loadBybitAll();

    // ── YENİ: Sekme değişince görünen coinleri preload et ────────
    setTimeout(_preloadVisibleCoins, 1500); // Yeni sekme yüklensin
  }

  // Screener ilk yüklenince tüm görünen coinler için FR geçmişini preload et
  async function _preloadVisibleCoins() {
    const exchange = ExchangeRouter.getActive();
    const monitor  = ExchangeRouter.getMonitor(exchange);
    if (!monitor?.preloadFromServer) return;

    const isAllTab = _activeTab.endsWith('-all');

    let coins;
    if (isAllTab) {
      // All sekmesinde sadece aktif seçili coini preload et
      // (tüm borsayı preload etmek anlamsız ve yavaş)
      const activeSym = window.State?.get('activeSymbol');
      coins = activeSym ? [activeSym] : [];
    } else {
      // BN Screener / BB Screener — görünen negatif FR listesi
      // _rows zaten sıralanmış ve filtrelenmiş (negatif FR'ye göre)
      coins = _rows.map(r => r.sym + 'USDT');
    }

    if (coins.length === 0) return;

    for (const symbol of coins) {
      await monitor.preloadFromServer(symbol, exchange, 2); // Son 2 saat
      await new Promise(r => setTimeout(r, 100)); // Rate limit koruması
    }
    console.log(`[ScreenerCore] ${coins.length} coin FR preload edildi (${_activeTab})`);
  }

  /* ── Init ─────────────────────────────────────────── */
  function init() {
    _list      = document.getElementById('wl-list');
    _colHeader = document.getElementById('wl-col-header');
    _searchEl  = document.getElementById('wl-search');
    _panel     = document.getElementById('right-panel');

    if (!_list) return;

    document.querySelectorAll('.wl-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.wl-tab').forEach(t => t.classList.toggle('active', t === tab));
        _setTab(tab.dataset.tab);
      });
    });

    _searchEl?.addEventListener('input', () => _applyFilterSort());

    // Aktif fiyat güncellemeleri (aktif coin strip'ten)
    EventBus.on('chart:price:update', ({ symbol, price }) => {
      const row = _list?.querySelector(`[data-sym="${symbol.replace(/USDT$/, '')}"]`);
      if (!row) return;
      const el = row.querySelector('.wl-price');
      if (el) el.textContent = _fmtPrice(price);
    });

    if (window.FRTracker) {
      _frTracker = new FRTracker();
      window.frTrackerInstance = _frTracker;
    }
    if (window.OIManager) _oiManager = new OIManager();
    // MarketDataStore başlat (tek WS bağlantısı — Binance IP ban riski ortadan kalkar)
    if (typeof MarketDataStore !== 'undefined') {
      MarketDataStore.start();
      _startMDSListeners();
    }
    // Bybit: ban riski düşük, REST poll devam ediyor
    _startBybitPolling();
    setInterval(() => {
      if (_activeTab === 'bn-screener') _loadBinanceScreener();
      else if (_activeTab === 'bb-screener') _loadBybitScreener();
    }, 60000);

    _setTab('bn-screener');
    console.log('[ScreenerCore] Initialized ✓');

    EventBus.on('screener:loaded', () => {
      setTimeout(_preloadVisibleCoins, 3000); // Screener yüklendikten 3sn sonra
    });
  }



  // Public: seçili coin'in screener satırını döndür (Navbar için)
  function getRow(sym) {
    const s = sym.replace(/USDT(\.P)?$/, '');
    return _rows.find(r => r.sym === s) || null;
  }

  return { init, getRow };
})();