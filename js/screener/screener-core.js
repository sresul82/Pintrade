/**
 * ScreenerCore — Tek liste Screener (Binance / Bybit)
 *
 * Kolonlar: Symbol | Price | Chg% | FR% | FR(h) | Vol(USD) | OI
 * Borsa seçimi wl-header'daki dropdown ile yapılır (State.screenerExchange).
 * Liste artık tüm USDT perpetual coinleri gösterir (top-20 sınırı kaldırıldı),
 * varsayılan sıralama en negatif FR üstte olacak şekildedir.
 *
 * Günlük sembol listesi güncellenir, delist olan coinler çıkarılır.
 */
const ScreenerCore = (() => {

  /* ── Kolon tanımları ──────────────────────────────────
     Hangi sütunun görüneceğini WatchlistStore belirler (kullanıcı ⋮
     menüsünden açıp kapatır, seçim localStorage'da saklanır).
     Buradaki tablo sadece etiket/hizalama/sıralama bilgisini tutar. */
  const COL_META = {
    sym:   { cls: 'wl-col-sym',   sort: 'sym'   },
    price: { cls: 'wl-col-right', sort: 'price' },
    pct:   { cls: 'wl-col-right', sort: 'pct'   },
    fr:    { cls: 'wl-col-right', sort: 'fr'    },
    frh:   { cls: 'wl-col-right', sort: 'frh'   },
    vol:   { cls: 'wl-col-right', sort: 'vol'   },
    oi:    { cls: 'wl-col-right', sort: 'oi'    },
  };

  // SPOT'ta FR/OI/sinyal yok (Binance SPOT'ta veri kaynağı yok) — bu yüzden
  // SPOT modunda kullanıcının FUTURES için özelleştirdiği sütun tercihleri
  // yok sayılır, sabit dar bir küme gösterilir.
  const SPOT_COLS = [
    { key: 'sym',   label: 'Symbol',     width: 'minmax(80px, 1fr)', locked: true },
    { key: 'price', label: 'Price',      width: '74px' },
    { key: 'pct',   label: 'Chg%',       width: '62px' },
    { key: 'vol',   label: 'Vol (USDT)', width: '62px' },
  ];

  /** Görünür sütunlar — store yoksa hepsini göster (geriye dönük güvenli). */
  function _visibleCols() {
    if (_market === 'spot') return SPOT_COLS.map(c => ({ ...c }));
    if (window.WatchlistStore) return WatchlistStore.getVisibleColumns();
    return Object.keys(COL_META).map(k => ({ key: k, label: k, width: '70px' }));
  }

  /** Görünür sütunlara göre grid şablonunu satırlara ve başlığa uygula. */
  function _applyGridTemplate() {
    const tpl = _market === 'spot'
      ? SPOT_COLS.map(c => c.width).join(' ')
      : (window.WatchlistStore
          ? WatchlistStore.getGridTemplate()
          : 'minmax(80px, 1fr) 74px 62px 68px 48px 62px 56px');
    if (_panel) _panel.style.setProperty('--wl-cols', tpl);
  }

  /* ── State ────────────────────────────────────────── */
  let _list      = null;
  let _colHeader = null;
  let _searchEl  = null;
  let _panel     = null;   // #right-panel — mode attribute için
  let _excPicker  = null;
  let _excMenu    = null;
  let _excLabel   = null;

  let _rows     = [];
  let _filtered = [];
  let _sortKey  = 'fr';
  let _sortDir  = 'asc';
  let _exchange  = 'binance'; // 'binance' | 'bybit' — tek kaynak: State.screenerExchange
  let _market    = 'futures'; // 'futures' | 'spot' — tek kaynak: WatchlistStore.getMarket()
  let _previewFilter = 'none'; // 'none' | 'gainers' | 'delistings' | 'new' — grafik altı bant (Görev 8)
  let _topGainers = new Set(); // her render'da yeniden hesaplanır — rozet için
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

  /** Watchlist Volume Type ayarına göre USD (quote) veya coin (base) hacmini formatlar.
   *  d — satır objesi ({ vol, volBase, sym }); volBase yoksa (henüz WS'ten
   *  gelmediyse) USD'ye düşer, "—" flaşına düşmemek için. */
  function _fmtVol(d) {
    const standard = window.WatchlistStore?.getVolumeType() === 'standard';
    const v = standard && d.volBase != null ? d.volBase : d.vol;
    if (v === null || v === undefined) return '—';
    let out;
    if (v >= 1e9) out = (v / 1e9).toFixed(2) + 'B';
    else if (v >= 1e6) out = (v / 1e6).toFixed(2) + 'M';
    else if (v >= 1e3) out = (v / 1e3).toFixed(1) + 'K';
    else out = v.toFixed(0);
    return (standard && d.volBase != null) ? `${out} ${d.sym}` : out;
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
  function _renderHeader() {
    if (!_colHeader) return;
    _applyGridTemplate();
    const volStandard = window.WatchlistStore?.getVolumeType() === 'standard';
    _colHeader.innerHTML = _visibleCols().map(c => {
      const m = COL_META[c.key] || { cls: 'wl-col-right', sort: c.key };
      const label = (c.key === 'vol' && volStandard) ? 'Vol (Coin)' : c.label;
      return `
      <span class="${m.cls}" data-sort="${m.sort}">
        ${label} <span class="wl-sort-arrow"></span>
      </span>`;
    }).join('');
    _colHeader.querySelectorAll('[data-sort]').forEach(th => {
      th.addEventListener('click', () => _sort(th.dataset.sort));
    });
    _updateSortArrows();
  }

  /* ── Signals listesi Combo rozeti ─────────────────────
     Sadece aktif liste "Signals" iken gösterilir — hangi Combo
     grubundan geldiğini watchlist-menu.js'teki gruplarla aynı renklerle işaretler. */
  const KOM_BADGE_STYLE = {
    1: { label: 'Combo 1', bg: 'rgba(59,130,246,0.15)',  color: '#3b82f6', border: '#3b82f6' },
    2: { label: 'Combo 2', bg: 'rgba(249,115,22,0.15)',  color: '#f97316', border: '#f97316' },
    3: { label: 'Combo 3', bg: 'rgba(148,163,184,0.12)', color: '#94a3b8', border: '#94a3b8', dashed: true },
  };

  function _komBadgeHtml(sym) {
    const store = window.WatchlistStore;
    if (!store || store.getActiveId() !== store.SIGNALS_ID) return '';
    const full = sym + 'USDT';
    const groups = store.getSignalGroups();
    const idx = groups.findIndex(g => g.symbols.includes(full));
    if (idx === -1) return '';
    const b = KOM_BADGE_STYLE[idx + 1];
    if (!b) return '';
    return `<span style="margin-left:4px; flex-shrink:0; font-size:8px; font-weight:700; padding:1px 5px; border-radius:8px; background:${b.bg}; color:${b.color}; border:${b.dashed ? '1px dashed' : '1px solid'} ${b.border};">${b.label}</span>`;
  }

  /* ── Delist / Yeni Liste / En Yükselen rozetleri (Görev 8) ─────────
     Delist ve yeni-liste sadece Binance için veri kaynağı var
     (SymbolAlertsStore, server.js'in sembol durum taramasından besleniyor).
     En yükselen borsa fark etmeksizin, mevcut pct24h'ten client-side
     hesaplanıyor (bkz. _computeTopGainers). Hem SPOT hem FUTURES'ta çalışır. */
  function _alertBadgeHtml(sym) {
    let html = '';
    if (_exchange === 'binance' && typeof SymbolAlertsStore !== 'undefined') {
      const alert = SymbolAlertsStore.getAlert(sym + 'USDT', _market);
      if (alert === 'delist_warning') {
        html += '<span title="Delisting sinyali algılandı (Binance durum değişimi)" style="margin-left:3px; flex-shrink:0; font-size:8px; font-weight:700; padding:1px 5px; border-radius:8px; background:rgba(249,115,22,0.15); color:#f97316; border:1px solid #f97316;">DELIST</span>';
      } else if (alert === 'new_listing') {
        html += '<span title="Yakın zamanda listelendi" style="margin-left:3px; flex-shrink:0; font-size:8px; font-weight:700; padding:1px 5px; border-radius:8px; background:rgba(34,197,94,0.15); color:#22c55e; border:1px solid #22c55e;">NEW</span>';
      }
    }
    if (_topGainers.has(sym)) {
      html += '<span title="Günün en yükselenlerinden" style="margin-left:3px; flex-shrink:0; font-size:10px;">🔥</span>';
    }
    return html;
  }

  /** _filtered üzerinden top-N pozitif kazananı hesaplar (rozet için). */
  function _computeTopGainers(arr) {
    const TOP_N = 3;
    const gainers = arr
      .filter(d => d.pct !== null && d.pct !== undefined && d.pct > 0)
      .slice() // arr zaten sıralı olabilir, kopyala
      .sort((a, b) => b.pct - a.pct)
      .slice(0, TOP_N)
      .map(d => d.sym);
    _topGainers = new Set(gainers);
  }

  /* ── Row render ───────────────────────────────────── */
  function _buildRow(d) {
    const row = document.createElement('div');
    row.className = 'wl-row';
    row.dataset.sym = d.sym;
    if (d.sym === _selected) row.classList.add('selected');

    const frCls = d.fr !== null ? (d.fr < 0 ? 'neg' : 'pos') : '';
    const trendCls = _frTracker ? _frTracker.getFRTrendType(d.sym + 'USDT') : 'neutral';

    // FR countdown warning: < 15 minutes remaining
    const secsLeft = d.nextFundingTime ? Math.max(0, (d.nextFundingTime - Date.now()) / 1000) : Infinity;
    const frhCls = secsLeft < 15 * 60 ? 'frh-ending' : '';
    const exc = _exchange;

    // Sinyal kontrolü (ScalpFRMonitor) — SPOT'ta sinyal yok (futures'a özgü)
    const monitor = _market === 'futures' ? (window[`scalpFRMonitor_${exc}`] || window.scalpFRMonitor) : null;
    let signalBadge = '';
    if (monitor) {
        const lastSig = monitor.getLastSignal(d.sym + 'USDT');
        // Sinyal son 30 dakika içinde geldiyse göster
        if (lastSig && (Date.now() - lastSig.timestamp) < 30 * 60 * 1000) {
            if (lastSig.severity === 'alarm') signalBadge = '<span title="Global Alarm" style="margin-left:2px; font-size:10px">🚨</span>';
            else if (lastSig.severity === 'rapid') signalBadge = '<span title="Rapid Rise" style="margin-left:2px; font-size:10px">⚡</span>';
            else signalBadge = '<span title="Active" style="margin-left:2px; font-size:10px; color:var(--signal-color-green)">•</span>';
        }
    }

    // Sütun hücreleri — sadece görünür olanlar basılır (⋮ menüsü)
    const CELL = {
      sym:   () => `<span class="wl-sym">${d.sym}USDT${signalBadge}${_market === 'futures' ? _komBadgeHtml(d.sym) : ''}${_alertBadgeHtml(d.sym)}</span>`,
      price: () => `<span class="wl-price wl-col-right ${_pctCls(d.pct)}">${_fmtPrice(d.price)}</span>`,
      pct:   () => `<span class="wl-pct wl-col-right ${_pctCls(d.pct)}">${_fmtPct(d.pct)}</span>`,
      fr:    () => `<span class="wl-fr wl-col-right ${frCls} fr-trend-${trendCls}">${_fmtFR(d.fr)}</span>`,
      frh:   () => `<span class="wl-frh wl-col-right ${frhCls}">${window.fundingIntervalManager?.get(d.sym + 'USDT', exc) ?? '—'}</span>`,
      vol:   () => `<span class="wl-vol wl-col-right">${_fmtVol(d)}</span>`,
      oi:    () => `<span class="wl-oi wl-col-right ${d.oiDir === 'up' ? 'pos' : d.oiDir === 'down' ? 'neg' : ''}">${_fmtOI(d.oi)}</span>`,
    };
    row.innerHTML = _visibleCols().map(c => (CELL[c.key] ? CELL[c.key]() : '')).join('');

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
    const fullSym = sym.endsWith('USDT') ? sym : sym + 'USDT';
    State.setSymbol(fullSym, _exchange);
  }

  /* ── List render ──────────────────────────────────── */
  function _renderList() {
    if (!_list) return;

    // Boş liste → ne yapılacağını anlatan mesaj (boş ekran bırakma)
    if (_filtered.length === 0 && _rows.length > 0) {
      const store = window.WatchlistStore;
      const id = store?.getActiveId();
      let msg = 'No matching coins';
      if (_previewFilter === 'delistings' || _previewFilter === 'new') {
        msg = _exchange !== 'binance'
          ? 'Not available for Bybit yet.<br><span style="opacity:.7">Delisting/new-listing detection currently only covers Binance.</span>'
          : (_previewFilter === 'delistings'
              ? 'No delisting warnings right now.'
              : 'No recent new listings.');
      } else if (_previewFilter === 'gainers') {
        msg = 'No coins are up right now.';
      } else if (id === store?.SIGNALS_ID) {
        msg = 'No active signals right now.<br><span style="opacity:.7">Combo 1 / Combo 2 / Combo 3 will appear here once a live signal fires.</span>';
      } else if (id && id !== store?.ALL_ID) {
        msg = 'This list is empty.<br><span style="opacity:.7">Right-click a coin in the list to add it.</span>';
      }
      _list.innerHTML = `<div style="color:var(--text-secondary);font-size:11px;text-align:center;padding:24px;line-height:1.6">${msg}</div>`;
      return;
    }

    const frag = document.createDocumentFragment();
    let separatorAdded = false;
    const exc = _exchange;

    _filtered.forEach((d, i) => {
      const is1h = _market === 'futures' && window.fundingIntervalManager?.get(d.sym + 'USDT', exc) === '1h';
      if (_market === 'futures' && !separatorAdded && !is1h && i > 0) {
        const prev = _filtered[i - 1];
        if (window.fundingIntervalManager?.get(prev.sym + 'USDT', exc) === '1h') {
          const sep = document.createElement('div');
          sep.className = 'wl-interval-separator';
          frag.appendChild(sep);
          separatorAdded = true;
        }
      }
      frag.appendChild(_buildRow(d));
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

  /** Aktif watchlist'e göre satırları süz.
   *  Tüm Coinler → hepsi.  Kullanıcı listesi → sadece o listedekiler.
   *  Sinyaller    → Kom1/2/3 henüz boş (doldurma mantığı sonraki turda). */
  function _applyListFilter(arr) {
    const store = window.WatchlistStore;
    if (!store) return arr;
    const id = store.getActiveId();
    if (id === store.ALL_ID) return arr;
    if (id === store.SIGNALS_ID) {
      const syms = new Set(store.getSignalGroups().flatMap(g => g.symbols));
      return arr.filter(d => syms.has(d.sym + 'USDT'));
    }
    const list = store.getList(id);
    if (!list) return arr;
    const syms = new Set(list.symbols);
    return arr.filter(d => syms.has(d.sym + 'USDT'));
  }

  /** Grafik altı bandın önizleme filtresi (Görev 8) — normal sıralamanın
   *  üzerine biner. 'delistings'/'new' Binance dışı borsalarda veri
   *  olmadığı için boş sonuç döner (yanlış/eksik veri göstermek yerine). */
  function _applyPreviewFilter(arr) {
    if (_previewFilter === 'delistings' || _previewFilter === 'new') {
      const category = _previewFilter === 'delistings' ? 'delist_warning' : 'new_listing';
      if (_exchange !== 'binance' || typeof SymbolAlertsStore === 'undefined') return [];
      return arr.filter(d => SymbolAlertsStore.getAlert(d.sym + 'USDT', _market) === category);
    }
    if (_previewFilter === 'gainers') {
      return arr.filter(d => d.pct !== null && d.pct !== undefined && d.pct > 0);
    }
    return arr;
  }

  function _applyFilterSort() {
    const q = (_searchEl?.value || '').trim().toUpperCase();
    let arr = q ? _rows.filter(d => d.sym.includes(q)) : [..._rows];
    arr = _applyListFilter(arr);
    arr = _applyPreviewFilter(arr);

    if (_previewFilter === 'gainers') {
      arr.sort((a, b) => b.pct - a.pct); // en yükselen üstte, sabit sıralama
    } else {
      arr.sort((a, b) => {
        let av = a[_sortKey], bv = b[_sortKey];
        if (av === null || av === undefined) av = _sortDir === 'asc' ? Infinity : -Infinity;
        if (bv === null || bv === undefined) bv = _sortDir === 'asc' ? Infinity : -Infinity;
        if (typeof av === 'string') return _sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
        return _sortDir === 'asc' ? av - bv : bv - av;
      });
    }

    // 1h interval coinleri üste taşı (sadece FUTURES, önizleme filtresi
    // yokken — kullanıcı bilinçli bir önizleme seçtiyse sıralamasını korusun)
    if (_previewFilter === 'none' && _market === 'futures' && window.fundingIntervalManager) {
      const exc = _exchange;
      const coins1h = arr.filter(d => fundingIntervalManager.get(d.sym + 'USDT', exc) === '1h');
      const coinsOther = arr.filter(d => fundingIntervalManager.get(d.sym + 'USDT', exc) !== '1h');
      arr = [...coins1h, ...coinsOther];
    }

    _computeTopGainers(arr);
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

  /* ── Binance — tüm USDT perpetual listesi ─────────── */
  // OI değerleri burada eagerly çekilmez: MarketDataStore zaten tüm market için
  // her 60sn'de bir batch halinde OI çekip 'mds:oi' event'iyle yayınlıyor
  // (bkz. market-data-store.js). _startMDSListeners() bu event'i dinleyip
  // _rows üzerindeki ilgili satırı günceller.
  async function _loadBinance() {
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
      // Önceki OI değerlerini koru (reload sonrası "—" flaşına düşmesin)
      const prevRows = new Map(_rows.map(r => [r.sym, r]));

      const rows = frData
        .filter(f => f.symbol.endsWith('USDT') && validSet.has(f.symbol))
        .map(f => {
          if (window.FRDataBridge) {
            FRDataBridge.feed('binance', f.symbol, parseFloat(f.lastFundingRate) * 100, Date.now());
          }
          const tk = tkMap[f.symbol] || {};
          const sym = f.symbol.replace(/USDT$/, '');
          const prev = prevRows.get(sym);
          return {
            sym,
            price: parseFloat(f.markPrice) || null,
            pct:   tk.priceChangePercent ? parseFloat(tk.priceChangePercent) : null,
            fr:    parseFloat(f.lastFundingRate) || null,
            frh:   _frInterval(window.fundingIntervalManager?.getNextFundingTime(f.symbol, 'binance') || f.nextFundingTime),
            nextFundingTime: window.fundingIntervalManager?.getNextFundingTime(f.symbol, 'binance') || parseInt(f.nextFundingTime) || 0,
            vol:     tk.quoteVolume ? parseFloat(tk.quoteVolume) : null,
            volBase: tk.volume ? parseFloat(tk.volume) : null,
            oi:    prev?.oi ?? null,
            oiDir: prev?.oiDir ?? null,
          };
        });

      // Varsayılan sıralama: en negatif FR üstte
      rows.sort((a, b) => (a.fr ?? 0) - (b.fr ?? 0));
      _rows = rows;
      _sortKey = 'fr'; _sortDir = 'asc';
      _applyFilterSort();

      if (typeof EventBus !== 'undefined') {
        EventBus.emit('screener:loaded');
      }
    } catch(e) {
      console.error('[ScreenerCore] Binance screener error:', e);
      _setError();
    }
  }

  /* ── Bybit — tüm USDT perpetual listesi ───────────── */
  // Bybit ticker endpoint'i openInterestValue'yu doğrudan döndürüyor,
  // bu yüzden ayrı bir OI isteği gerekmiyor. oiDir, önceki değerle
  // karşılaştırılarak hesaplanır (ekstra API çağrısı yok).
  async function _loadBybit() {
    _setLoading();
    try {
      const symbols = await _getBybitSymbols();
      const resp = await fetch(`https://api.bybit.com/v5/market/tickers?category=linear&_t=${Date.now()}`);
      const data = await resp.json();
      const validSet = new Set(symbols);
      const prevRows = new Map(_rows.map(r => [r.sym, r]));

      const rows = (data?.result?.list || [])
        .filter(t => t.symbol.endsWith('USDT') && validSet.has(t.symbol))
        .map(t => {
          if (window.FRDataBridge) {
            FRDataBridge.feed('bybit', t.symbol, parseFloat(t.fundingRate) * 100, Date.now());
          }
          const sym  = t.symbol.replace(/USDT$/, '');
          const oi   = parseFloat(t.openInterestValue) || null;
          const prev = prevRows.get(sym);
          const oiDir = (prev?.oi != null && oi != null)
            ? (oi >= prev.oi ? 'up' : 'down')
            : (prev?.oiDir ?? null);
          return {
            sym,
            price: parseFloat(t.lastPrice) || null,
            pct:   parseFloat(t.price24hPcnt) * 100 || null,
            fr:    parseFloat(t.fundingRate) || null,
            frh:   _frInterval(window.fundingIntervalManager?.getNextFundingTime(t.symbol, 'bybit') || parseInt(t.nextFundingTime) || 0),
            nextFundingTime: window.fundingIntervalManager?.getNextFundingTime(t.symbol, 'bybit') || parseInt(t.nextFundingTime) || 0,
            vol:     parseFloat(t.turnover24h) || null,
            volBase: parseFloat(t.volume24h) || null,
            oi,
            oiDir,
          };
        });

      rows.sort((a, b) => (a.fr ?? 0) - (b.fr ?? 0));
      _rows = rows;
      _sortKey = 'fr'; _sortDir = 'asc';
      _applyFilterSort();

      if (typeof EventBus !== 'undefined') {
        EventBus.emit('screener:loaded');
      }
    } catch(e) {
      console.error('[ScreenerCore] Bybit screener error:', e);
      _setError();
    }
  }

  /* ── SPOT — Binance (SpotDataStore üzerinden, kendi fetch'i yok) ──
     Kapsam dar: sadece symbol/price/pct/vol (Görev 7). Sinyal/FR/OI yok —
     Binance SPOT'ta bu verilerin karşılığı yok. */
  async function _loadSpotBinance() {
    _setLoading();
    try {
      if (typeof SpotDataStore === 'undefined') { _setError(); return; }
      SpotDataStore.start(); // idempotent — zaten çalışıyorsa ikinci WS açmaz
      if (!SpotDataStore.isReady()) {
        await new Promise(resolve => {
          EventBus.once('spot:ready', resolve);
          setTimeout(resolve, 5000); // güvenlik: 5sn'de vazgeç, o ana kadar gelen ne varsa göster
        });
      }
      const tickers = SpotDataStore.getAllTickers();
      const rows = [...tickers.entries()].map(([symbol, t]) => ({
        sym:     symbol.replace(/USDT$/, ''),
        price:   t.price,
        pct:     t.pct24h,
        vol:     t.volume24h,
        volBase: t.volumeBase24h,
      }));
      rows.sort((a, b) => (b.vol ?? 0) - (a.vol ?? 0)); // varsayılan: hacme göre
      _rows = rows;
      _sortKey = 'vol'; _sortDir = 'desc';
      _applyFilterSort();
      if (typeof EventBus !== 'undefined') EventBus.emit('screener:loaded');
    } catch (e) {
      console.error('[ScreenerCore] Spot (Binance) screener error:', e);
      _setError();
    }
  }

  /* ── SPOT — Bybit (REST poll, mevcut futures poll örüntüsüyle aynı) ── */
  async function _loadSpotBybit() {
    _setLoading();
    try {
      const resp = await fetch(`https://api.bybit.com/v5/market/tickers?category=spot&_t=${Date.now()}`);
      const data = await resp.json();
      const rows = (data?.result?.list || [])
        .filter(t => t.symbol.endsWith('USDT'))
        .map(t => ({
          sym:     t.symbol.replace(/USDT$/, ''),
          price:   parseFloat(t.lastPrice) || null,
          pct:     (parseFloat(t.price24hPcnt) || 0) * 100,
          vol:     parseFloat(t.turnover24h) || null,
          volBase: parseFloat(t.volume24h) || null,
        }));
      rows.sort((a, b) => (b.vol ?? 0) - (a.vol ?? 0));
      _rows = rows;
      _sortKey = 'vol'; _sortDir = 'desc';
      _applyFilterSort();
      if (typeof EventBus !== 'undefined') EventBus.emit('screener:loaded');
    } catch (e) {
      console.error('[ScreenerCore] Spot (Bybit) screener error:', e);
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
    if (_list) _list.innerHTML = '<div style="color:var(--text-secondary);font-size:11px;text-align:center;padding:24px">Loading...</div>';
  }

  function _throttledRender() {
    if (_renderTimer) return;
    _renderTimer = setTimeout(() => { _applyFilterSort(); _renderTimer = null; }, 1000);
  }

  // ── MarketDataStore'dan Binance anlık güncellemelerini dinle ──
  // Artık 5 saniyelik REST poll yok — MDS WebSocket'ten her 1-3sn'de push eder.
  function _startMDSListeners() {
    // Fiyat + hacim güncellemesi
    EventBus.on('mds:tick', ({ symbol, price, pct24h, volume24h, volumeBase24h }) => {
      if (_exchange !== 'binance' || _market !== 'futures') return;
      const sym = symbol.replace(/USDT$/, '');
      _priceMap.set(sym, price);

      const row = _rows.find(r => r.sym === sym);
      if (row) {
        row.price   = price;
        row.pct     = pct24h;
        row.vol     = volume24h;
        row.volBase = volumeBase24h;
        _throttledRender();
      }
    });

    // Funding Rate güncellemesi
    EventBus.on('mds:fr', ({ symbol, rate, nextFundingTime }) => {
      if (_exchange !== 'binance' || _market !== 'futures') return;
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

    // OI güncellemesi (MarketDataStore — tüm market için 60sn'de bir batch)
    EventBus.on('mds:oi', ({ symbol, value, dir }) => {
      if (_exchange !== 'binance' || _market !== 'futures') return;
      const sym = symbol.replace(/USDT$/, '');
      const row = _rows.find(r => r.sym === sym);
      if (row) {
        row.oi    = value;
        row.oiDir = dir;
        _throttledRender();
      }
    });

    // SPOT (Binance) canlı güncelleme — SpotDataStore üzerinden.
    // !miniTicker@arr her mesajda TÜM sembolleri değil, o an güncellenmiş
    // olanları gönderiyor (canlı doğrulandı: ilk yüklemeden sonra bile
    // ticker sayısı zamanla artmaya devam ediyor) — bu yüzden satır yoksa
    // sadece güncelleme değil, YENİ satır olarak eklenmesi gerekiyor.
    EventBus.on('spot:tick', ({ symbol, price, pct24h, volume24h, volumeBase24h }) => {
      if (_exchange !== 'binance' || _market !== 'spot') return;
      const sym = symbol.replace(/USDT$/, '');
      const row = _rows.find(r => r.sym === sym);
      if (row) {
        row.price   = price;
        row.pct     = pct24h;
        row.vol     = volume24h;
        row.volBase = volumeBase24h;
      } else {
        _rows.push({ sym, price, pct: pct24h, vol: volume24h, volBase: volumeBase24h });
      }
      _throttledRender();
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
    if (_exchange !== 'bybit' || _market !== 'futures') return;

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
        const oi    = parseFloat(d.openInterestValue) || null;

        _priceMap.set(sym, price);

        if (window.FRDataBridge) {
          FRDataBridge.feed('bybit', d.symbol, fr * 100, Date.now());
        }

        const row = _rows.find(r => r.sym === sym);
        if (row) {
          row.price = price;
          row.fr    = fr;
          row.pct   = pct;
          if (oi != null) {
            row.oiDir = row.oi != null ? (oi >= row.oi ? 'up' : 'down') : row.oiDir;
            row.oi    = oi;
          }
          changed   = true;
        }
      });

      if (changed) _throttledRender();

    } catch (e) {
      console.warn('[ScreenerCore] Bybit poll error:', e);
    }
  }

  // Bybit SPOT polling — futures poll ile aynı örüntü, ayrı zamanlayıcı
  // (farklı endpoint/category, farklı sembol evreni).
  let _bbSpotPollTimer = null;

  function _startBybitSpotPolling() {
    if (_bbSpotPollTimer) clearInterval(_bbSpotPollTimer);
    _pollBybitSpotPrices();
    _bbSpotPollTimer = setInterval(_pollBybitSpotPrices, 5000);
  }

  async function _pollBybitSpotPrices() {
    if (_exchange !== 'bybit' || _market !== 'spot') return;
    try {
      const res = await fetch(`https://api.bybit.com/v5/market/tickers?category=spot&_t=${Date.now()}`);
      if (!res.ok) return;
      const json = await res.json();
      const list = json?.result?.list || [];

      let changed = false;
      list.forEach(d => {
        if (!d.symbol.endsWith('USDT')) return;
        const sym = d.symbol.replace(/USDT$/, '');
        const row = _rows.find(r => r.sym === sym);
        if (row) {
          row.price = parseFloat(d.lastPrice) || row.price;
          row.pct   = (parseFloat(d.price24hPcnt) || 0) * 100;
          row.vol   = parseFloat(d.turnover24h) || row.vol;
          changed   = true;
        }
      });

      if (changed) _throttledRender();
    } catch (e) {
      console.warn('[ScreenerCore] Bybit spot poll error:', e);
    }
  }

  function _setError() {
    if (_list) _list.innerHTML = '<div style="color:var(--accent-red);font-size:11px;text-align:center;padding:24px">Failed to load data</div>';
  }

  /* ── Borsa / pazar değişimi ──────────────────────────
     İkisi de aynı yeniden-yükleme akışını paylaşır — hangi kombinasyon
     olursa olsun (binance/bybit × futures/spot) doğru loader çağrılır. */
  function _reload() {
    _rows = []; _filtered = [];
    if (_panel) _panel.setAttribute('data-wl-mode', 'screener');
    _renderHeader();
    _updateExchangeUI();

    if (_market === 'spot') {
      if (_exchange === 'binance') _loadSpotBinance();
      else _loadSpotBybit();
    } else {
      if (_exchange === 'binance') _loadBinance();
      else _loadBybit();
    }

    // FR geçmişi preload'u sadece FUTURES'ta anlamlı (sinyal/trend rozeti için)
    if (_market === 'futures') setTimeout(_preloadVisibleCoins, 1500);
  }

  function _setExchange(exchange) {
    _exchange = exchange;
    State.set('screenerExchange', exchange, true); // silent — zaten UI kendi güncelliyor
    _reload();
  }

  function _setMarket(type) {
    if (_market === type) return;
    _market = type;
    _reload();
  }

  function _updateExchangeUI() {
    if (_excLabel) _excLabel.textContent = _exchange === 'binance' ? 'Binance' : 'Bybit';
    document.querySelectorAll('.wl-exchange-item').forEach(el =>
      el.classList.toggle('active', el.dataset.exchange === _exchange));
  }

  // Liste yüklenince ilk N coin için FR geçmişini preload et (trend rozeti için).
  // Tüm listeyi (300+ coin) preload etmek performans/rate-limit açısından
  // gereksiz — sadece en üstteki (en negatif FR'li) coinler önceliklidir.
  async function _preloadVisibleCoins() {
    const monitor = ExchangeRouter.getMonitor(_exchange);
    if (!monitor?.preloadFromServer) return;

    const coins = _rows.slice(0, 40).map(r => r.sym + 'USDT');
    if (coins.length === 0) return;

    for (const symbol of coins) {
      await monitor.preloadFromServer(symbol, _exchange, 2); // Son 2 saat
      await new Promise(r => setTimeout(r, 100)); // Rate limit koruması
    }
    console.log(`[ScreenerCore] ${coins.length} coin FR preload edildi (${_exchange})`);
  }

  /* ── Init ─────────────────────────────────────────── */
  function init() {
    _list      = document.getElementById('wl-list');
    _colHeader = document.getElementById('wl-col-header');
    _searchEl  = document.getElementById('wl-search');
    _panel     = document.getElementById('right-panel');
    _excPicker = document.getElementById('wl-exchange-picker');
    _excMenu   = document.getElementById('wl-exchange-menu');
    _excLabel  = document.getElementById('wl-exchange-label');

    if (!_list) return;

    // Borsa dropdown — tek seçim, hem Screener hem Bot Signals paneli bunu izler
    _excPicker?.addEventListener('click', (e) => {
      e.stopPropagation();
      _excMenu?.classList.toggle('open');
    });
    document.querySelectorAll('.wl-exchange-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        _excMenu?.classList.remove('open');
        if (item.dataset.exchange !== _exchange) _setExchange(item.dataset.exchange);
      });
    });
    document.addEventListener('click', () => _excMenu?.classList.remove('open'));

    // Arama + temizleme (✕) — ✕ sadece kutuda yazı varken görünür
    const _clearBtn = document.getElementById('wl-search-clear');
    const _syncClear = () => {
      if (_clearBtn) _clearBtn.classList.toggle('visible', !!_searchEl?.value);
    };
    _searchEl?.addEventListener('input', () => { _syncClear(); _applyFilterSort(); });
    _clearBtn?.addEventListener('click', () => {
      if (!_searchEl) return;
      _searchEl.value = '';
      _syncClear();
      _applyFilterSort();
      _searchEl.focus();
    });
    _syncClear();

    // Watchlist menüsü değişiklikleri
    EventBus.on('watchlist:columnsChanged',   () => { _renderHeader(); _renderList(); });
    EventBus.on('watchlist:activeChanged',    () => _applyFilterSort());
    EventBus.on('watchlist:listsChanged',     () => _applyFilterSort());
    EventBus.on('watchlist:volumeTypeChanged',() => { _renderHeader(); _renderList(); });
    // Pazar filtresi (FUTURES/SPOT) — Görev 7
    EventBus.on('watchlist:marketChanged', ({ type }) => _setMarket(type));
    // Grafik altı bant önizleme filtresi (No Preview/Top Gainers/Delistings/New Listings) — Görev 8
    EventBus.on('screener:previewFilter', ({ type }) => {
      _previewFilter = type || 'none';
      _applyFilterSort();
    });
    // Delist/yeni-liste verisi periyodik yenilendiğinde rozetleri tazele
    EventBus.on('symbolAlerts:updated', () => _renderList());

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
    // Delist/yeni-liste uyarı verisi (Görev 8) — kendi backend'imiz, 5dk'da bir
    if (typeof SymbolAlertsStore !== 'undefined') SymbolAlertsStore.start();
    // Bybit: ban riski düşük, REST poll devam ediyor
    _startBybitPolling();
    _startBybitSpotPolling(); // kendi içinde _market/_exchange kontrolü yapar, no-op kalır
    setInterval(() => {
      if (_market === 'spot') {
        if (_exchange === 'binance') _loadSpotBinance(); else _loadSpotBybit();
      } else {
        if (_exchange === 'binance') _loadBinance(); else _loadBybit();
      }
    }, 60000);

    _exchange = State.get('screenerExchange') || 'binance';
    _market   = window.WatchlistStore?.getMarket()?.type || 'futures';
    _setExchange(_exchange); // _reload() zaten güncel _market'e göre doğru loader'ı çağırır
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