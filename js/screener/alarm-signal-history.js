/**
 * AlarmSignalHistory Module
 * Sağ sidebar → Alarm sekmesi (rsb-alarms) içeriği.
 * Bot Signals (FR/M1 Hammer/M1-A/V3/4S rafı, bot-signals-panel.js) ile HİÇ
 * ilişkisi yok — kendi başına, tüm panel alanını kaplayan kart listesi.
 *
 * Şu an demo/statik veri: gerçek bir sinyal motoru yok (bkz.
 * dokumentasyon/gorevler/sinyal-sistemi-pintrade-entegrasyon.md). Kom1/Kom2/Kom3
 * puanlama sistemi kurulunca bu modül gerçek veriyle beslenecek.
 */
const AlarmSignalHistory = (() => {
  // Combo 3 henüz tanımlanmadığı için placeholder (kesikli kenarlık) olarak işaretlenir.
  const KOM_BADGE_STYLE = {
    1: { label: 'Combo 1', bg: 'rgba(59,130,246,0.15)',  color: '#3b82f6', border: '#3b82f6' },
    2: { label: 'Combo 2', bg: 'rgba(249,115,22,0.15)',  color: '#f97316', border: '#f97316' },
    3: { label: 'Combo 3', bg: 'rgba(148,163,184,0.12)', color: '#94a3b8', border: '#94a3b8', dashed: true },
  };

  // Watchlist'teki BN/BB kısaltmalarıyla ve mevcut Binance sarı/Bybit mor
  // renk kodlarıyla (bkz. bot-signals-panel.js mini chart) tutarlı.
  const EXCHANGE_BADGE_STYLE = {
    binance: { label: 'BN', bg: 'rgba(240,185,11,0.15)', color: '#f0b90b', border: '#f0b90b' },
    bybit:   { label: 'BB', bg: 'rgba(123,97,255,0.15)', color: '#7b61ff', border: '#7b61ff' },
  };

  function _esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function _demoSignals() {
    const now = Date.now();
    return [
      {
        symbol: 'STRKUSDT', kom: 1, exchange: 'binance',
        timestamp: now - 12 * 60 * 1000,
        priceChangePct: 1.8,
        chips: [
          { label: 'OI',            value: '+12% (2g kalıcı)', color: '#16a34a' },
          { label: 'Global L/S',    value: '0.91',             color: '#16a34a' },
          { label: 'TopTrader L/S', value: '1.24',              color: 'var(--text-primary)' },
          { label: 'RSI(1H)',       value: '41.6',              color: 'var(--text-primary)' },
          { label: 'WT1',           value: '-58.2',             color: '#16a34a' },
        ],
        rule: 'RC_mid altı + WT cross-up + önceki bar oversold',
      },
      {
        // Taşma testi: çok uzun coin adı + fazla kutucuk
        symbol: '1000RATSFLOKIBABYDOGEUSDT', kom: 1, exchange: 'bybit',
        timestamp: now - 40 * 60 * 1000,
        priceChangePct: 0.6,
        chips: [
          { label: 'OI',            value: '+7% (1g kalıcı)', color: '#16a34a' },
          { label: 'Global L/S',    value: '0.88',            color: '#16a34a' },
          { label: 'TopTrader L/S', value: '1.05',            color: 'var(--text-primary)' },
          { label: 'RSI(1H)',       value: '38.9',            color: 'var(--text-primary)' },
          { label: 'RSI(4H)',       value: '45.2',            color: 'var(--text-primary)' },
          { label: 'WT1',           value: '-56.4',           color: '#16a34a' },
          { label: 'WT4H',          value: '-49.1',           color: 'var(--text-primary)' },
          { label: 'Hacim',         value: '1.9x',            color: '#f59e0b' },
        ],
        rule: 'RC_mid altı + WT cross-up + önceki bar oversold',
      },
      {
        symbol: 'BANKUSDT', kom: 2, exchange: 'bybit',
        timestamp: now - 3 * 60 * 60 * 1000,
        priceChangePct: -2.4,
        chips: [
          { label: 'Fiyat Düşüş',  value: '-1.6%',  color: '#dc2626' },
          { label: 'RSI Kazanç',   value: '+3.2pt', color: '#16a34a' },
          { label: 'Global L/S',   value: '0.74',   color: '#16a34a' },
          { label: 'RSI(1H)',      value: '28.4',   color: '#16a34a' },
          { label: 'Hacim Çarp.',  value: '2.1x',   color: '#f59e0b' },
        ],
        rule: '1H bullish divergence + Global L/S < 1.0 + hacim artışı (div+ls+vol)',
      },
      {
        // Kom3 henüz tanımlanmadı — placeholder rozet + placeholder açıklama
        symbol: 'ARXUSDT', kom: 3, exchange: 'binance',
        timestamp: now - 90 * 60 * 1000,
        priceChangePct: 0.3,
        chips: [
          { label: 'OI',    value: '+8% (izleniyor)',   color: '#f59e0b' },
          // Kom3 için henüz gerçek bir puanlama mantığı yok — bu kutucuk
          // sadece görsel örnek, kesikli/soluk stille (dashed: true) diğer
          // gerçek kutucuklardan bilinçli olarak ayrıştırılıyor.
          { label: 'Puan',  value: '62/100 (örnek)', color: 'var(--text-secondary)', dashed: true },
        ],
        rule: 'Kom3 kriterleri henüz tanımlanmadı — bu kart yalnızca yer tutucu',
        placeholder: true,
      },
      {
        // Eski sinyal — "geçmiş" görünümü (soluk kart + rozet)
        symbol: 'TIAUSDT', kom: 1, exchange: 'binance',
        timestamp: now - (3 * 24 * 60 * 60 * 1000 + 5 * 60 * 60 * 1000),
        priceChangePct: -0.4,
        chips: [
          { label: 'OI',            value: '+5% (1g kalıcı)', color: '#16a34a' },
          { label: 'Global L/S',    value: '1.05',            color: 'var(--text-primary)' },
          { label: 'TopTrader L/S', value: '0.98',            color: 'var(--text-primary)' },
          { label: 'RSI(1H)',       value: '52.1',            color: 'var(--text-primary)' },
          { label: 'WT1',           value: '-61.4',           color: '#16a34a' },
        ],
        rule: 'RC_mid altı + WT cross-up + önceki bar oversold',
        isOld: true,
      },
      {
        // Filtre/arama testi: aynı coin (TIAUSDT) farklı zamanda farklı Kom'dan
        // sinyal almış — Kom1 kaydından daha eski, ayrı bir Kom2 kaydı.
        // Tümü + arama'da bu iki kart asla birleştirilmeden ayrı görünmeli.
        symbol: 'TIAUSDT', kom: 2, exchange: 'bybit',
        timestamp: now - (6 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000),
        priceChangePct: -1.1,
        chips: [
          { label: 'Fiyat Düşüş',  value: '-2.0%',  color: '#dc2626' },
          { label: 'RSI Kazanç',   value: '+2.6pt', color: '#16a34a' },
          { label: 'Global L/S',   value: '0.81',   color: '#16a34a' },
          { label: 'RSI(1H)',      value: '31.7',   color: '#16a34a' },
          { label: 'Hacim Çarp.',  value: '1.6x',   color: '#f59e0b' },
        ],
        rule: '1H bullish divergence + Global L/S < 1.0 + hacim artışı (div+ls+vol)',
        isOld: true,
      },
    ];
  }

  // Toolbar state: active Combo filter + exchange filter + search term (uppercase).
  const _state = { komFilter: 'all', exchangeFilter: 'all', searchTerm: '' };

  const KOM_SEGMENTS = [
    { key: 'all', label: 'All' },
    { key: '1',   label: 'Combo 1' },
    { key: '2',   label: 'Combo 2' },
    { key: '3',   label: 'Combo 3' },
  ];

  const EXCHANGE_SEGMENTS = [
    { key: 'all',     label: 'All Exchanges' },
    { key: 'binance', label: 'Binance' },
    { key: 'bybit',   label: 'Bybit' },
  ];

  function _isOldVisual(sig) {
    return sig.isOld || (Date.now() - sig.timestamp) > 24 * 60 * 60 * 1000;
  }

  /** Watchlist'in "Signals" sistem listesini beslemek için — sadece güncel
   *  (Geçmiş etiketli olmayan) sinyaller, { symbol, kom } şeklinde. */
  function getActiveSignals() {
    return _demoSignals()
      .filter(sig => !_isOldVisual(sig))
      .map(sig => ({ symbol: sig.symbol, kom: sig.kom }));
  }

  function _getFilteredSignals() {
    const all = _demoSignals();
    let filtered = _state.komFilter === 'all'
      ? all
      : all.filter(s => String(s.kom) === _state.komFilter);
    if (_state.exchangeFilter !== 'all') {
      filtered = filtered.filter(s => s.exchange === _state.exchangeFilter);
    }
    if (_state.searchTerm) {
      filtered = filtered.filter(s => s.symbol.toUpperCase().includes(_state.searchTerm));
    }
    return filtered;
  }

  function _segBtnStyle(active) {
    return active
      ? 'background:var(--accent-blue); color:#fff; opacity:1;'
      : 'background:transparent; color:var(--text-secondary); opacity:0.7;';
  }

  function _buildToolbarHTML() {
    const segsHtml = KOM_SEGMENTS.map(seg => `
      <button type="button" class="alarm-kom-seg" data-kom="${seg.key}" style="
        padding:4px 10px; font-size:11px; font-weight:600; border:none; border-radius:5px;
        cursor:pointer; white-space:nowrap; transition:background 0.15s ease, color 0.15s ease;
        ${_segBtnStyle(_state.komFilter === seg.key)}
      ">${seg.label}</button>`).join('');

    const excSegsHtml = EXCHANGE_SEGMENTS.map(seg => `
      <button type="button" class="alarm-exc-seg" data-exc="${seg.key}" style="
        padding:4px 10px; font-size:11px; font-weight:600; border:none; border-radius:5px;
        cursor:pointer; white-space:nowrap; transition:background 0.15s ease, color 0.15s ease;
        ${_segBtnStyle(_state.exchangeFilter === seg.key)}
      ">${seg.label}</button>`).join('');

    return `
      <div id="alarm-filter-bar" style="
        display:flex; flex-direction:column; gap:6px; padding:8px;
        border-bottom:0.5px solid var(--border-primary); flex-shrink:0;
      ">
        <div style="display:flex; align-items:center; gap:8px;">
          <div id="alarm-kom-segments" style="
            display:flex; align-items:center; gap:2px; padding:2px; flex-shrink:0;
            background:var(--bg-tertiary); border-radius:7px;
          ">${segsHtml}</div>
          <div style="position:relative; flex:1; min-width:0;">
            <input id="alarm-search-input" type="text" placeholder="Search coin..." value="${_esc(_state.searchTerm)}" style="
              width:100%; box-sizing:border-box; font-size:12px; padding:5px 24px 5px 8px; border-radius:6px;
              border:0.5px solid var(--border-primary); background:var(--bg-primary);
              color:var(--text-primary); outline:none;
            ">
            <button type="button" id="alarm-search-clear" title="Clear" style="
              position:absolute; right:4px; top:50%; transform:translateY(-50%);
              width:16px; height:16px; border:none; background:transparent; cursor:pointer;
              color:var(--text-secondary); font-size:12px; line-height:1; padding:0;
              display:${_state.searchTerm ? 'flex' : 'none'}; align-items:center; justify-content:center;
            ">✕</button>
          </div>
        </div>
        <div id="alarm-exc-segments" style="
          display:flex; align-items:center; gap:2px; padding:2px; align-self:flex-start;
          background:var(--bg-tertiary); border-radius:7px;
        ">${excSegsHtml}</div>
      </div>`;
  }

  function _buildShellHTML() {
    return `<div style="display:flex; flex-direction:column; height:100%;">
      ${_buildToolbarHTML()}
      <div id="alarm-signal-list" style="overflow-y:auto; flex:1; padding:8px; display:flex; flex-direction:column; gap:8px; box-sizing:border-box;"></div>
    </div>`;
  }

  function _buildCardsHTML(demoSignals) {
    let html = '';
    if (!demoSignals.length) {
      html += `<div style="padding:16px 8px; text-align:center; font-size:11px; color:var(--text-secondary);">No results.</div>`;
    }

    demoSignals.forEach(sig => {
      const badge      = KOM_BADGE_STYLE[sig.kom] || KOM_BADGE_STYLE[3];
      const excBadge   = EXCHANGE_BADGE_STYLE[sig.exchange] || EXCHANGE_BADGE_STYLE.binance;
      const priceColor = sig.priceChangePct > 0 ? '#16a34a' : sig.priceChangePct < 0 ? '#dc2626' : 'var(--text-primary)';
      const priceSign  = sig.priceChangePct > 0 ? '+' : '';
      const dt         = new Date(sig.timestamp);
      const dateStr    = dt.toLocaleString('en-US', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
      const isOldVisual = _isOldVisual(sig);
      const cardOpacity = isOldVisual ? 0.55 : 1;
      const oldTag = isOldVisual
        ? `<span style="font-size:9px; color:var(--text-secondary); margin-left:6px; padding:1px 5px; border:0.5px solid var(--border-primary); border-radius:3px;">Old</span>`
        : '';

      // Etiket-değer grid'i: her metrik "auto 1fr" çifti, satır başına iki
      // çift (4 sütun) — label soluk gri kalır (hiyerarşi için), değer beyaz
      // (renkli olanlar hariç — pozitif/negatif anlam taşıyanlar kendi rengini korur).
      // c.dashed olanlar (henüz gerçek veriye dayanmayan placeholder, bkz.
      // Kom3/ARXUSDT) soluk/kesiksiz metinle ayrıştırılır.
      const metricsHtml = sig.chips.map(c => `
        <span style="color:var(--text-secondary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${_esc(c.label)}</span>
        <span style="color:${c.dashed ? 'var(--text-secondary)' : c.color}; ${c.dashed ? 'opacity:0.75;' : ''} overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${_esc(c.value)}</span>`
      ).join('');

      html += `
        <div class="kom-alarm-card" data-symbol="${sig.symbol.replace(/USDT$/, '')}" data-exchange="${sig.exchange}" style="
          background:var(--bg-secondary); border:0.75px solid rgba(200,200,205,0.85);
          border-radius:10px; padding:10px 12px; cursor:pointer; opacity:${cardOpacity};
          transition: opacity 0.15s ease;
        " title="Go to chart: ${_esc(sig.symbol)}">
          <div style="display:flex; align-items:baseline; gap:6px; margin-bottom:2px; flex-wrap:wrap;">
            <span style="font-weight:600; font-size:14px; color:#ffffff; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:100%;" title="${_esc(sig.symbol)}">${_esc(sig.symbol)}</span>
            <span style="flex-shrink:0; font-size:10px; font-weight:700; padding:2px 7px; border-radius:10px; background:${badge.bg}; color:${badge.color}; border:${badge.dashed ? '1px dashed' : '1px solid'} ${badge.border};">${badge.label}</span>
            <span style="flex-shrink:0; font-size:10px; font-weight:700; padding:2px 6px; border-radius:10px; background:${excBadge.bg}; color:${excBadge.color}; border:1px solid ${excBadge.border};" title="${sig.exchange === 'bybit' ? 'Bybit' : 'Binance'}">${excBadge.label}</span>
            <span style="flex-shrink:0; margin-left:auto; font-size:13px; font-weight:600; color:${priceColor};">${priceSign}${sig.priceChangePct.toFixed(1)}%</span>
          </div>
          <div style="font-size:10px; color:var(--text-secondary); margin-bottom:8px;">
            ${dateStr}${oldTag}
          </div>
          <div style="display:grid; grid-template-columns:auto 1fr auto 1fr; column-gap:6px; row-gap:6px; padding:8px 0; border-top:0.5px solid var(--border-primary); border-bottom:0.5px solid var(--border-primary); margin-bottom:8px; font-size:12px;">
            ${metricsHtml}
          </div>
          <div style="font-size:11px; color:var(--text-secondary); display:flex; align-items:flex-start; gap:5px;">
            <span style="flex-shrink:0; opacity:0.6;">→</span><span>${_esc(sig.rule)}</span>
          </div>
        </div>`;
    });

    return html;
  }

  function _renderList() {
    const listEl = document.getElementById('alarm-signal-list');
    if (!listEl) return;
    listEl.innerHTML = _buildCardsHTML(_getFilteredSignals());
  }

  function _updateSegmentStyles() {
    document.querySelectorAll('#alarm-kom-segments .alarm-kom-seg').forEach(btn => {
      btn.setAttribute('style', btn.getAttribute('style').replace(
        /background:[^;]+;\s*color:[^;]+;\s*opacity:[^;]+;/,
        _segBtnStyle(btn.dataset.kom === _state.komFilter)
      ));
    });
    document.querySelectorAll('#alarm-exc-segments .alarm-exc-seg').forEach(btn => {
      btn.setAttribute('style', btn.getAttribute('style').replace(
        /background:[^;]+;\s*color:[^;]+;\s*opacity:[^;]+;/,
        _segBtnStyle(btn.dataset.exc === _state.exchangeFilter)
      ));
    });
  }

  function _updateClearButtonVisibility() {
    const clearBtn = document.getElementById('alarm-search-clear');
    if (clearBtn) clearBtn.style.display = _state.searchTerm ? 'flex' : 'none';
  }

  /** Programatik state değişikliklerinden sonra (kart tıklama, X ile temizleme)
   *  toolbar'ı yeniden oluşturmadan (odak kaybetmemek için) DOM'u state'e senkronlar. */
  function _syncToolbarUI() {
    const input = document.getElementById('alarm-search-input');
    if (input) input.value = _state.searchTerm;
    _updateClearButtonVisibility();
    _updateSegmentStyles();
  }

  function _attachDelegation(el) {
    el.addEventListener('click', (e) => {
      const seg = e.target.closest('.alarm-kom-seg');
      if (seg) {
        _state.komFilter = seg.dataset.kom;
        _updateSegmentStyles();
        _renderList();
        return;
      }

      const excSeg = e.target.closest('.alarm-exc-seg');
      if (excSeg) {
        _state.exchangeFilter = excSeg.dataset.exc;
        _updateSegmentStyles();
        _renderList();
        return;
      }

      const clearBtn = e.target.closest('#alarm-search-clear');
      if (clearBtn) {
        _state.searchTerm     = '';
        _state.komFilter      = 'all';
        _state.exchangeFilter = 'all';
        _syncToolbarUI();
        _renderList();
        return;
      }

      const card = e.target.closest('.kom-alarm-card');
      if (!card) return;
      const sym = card.dataset.symbol;
      const cardExchange = card.dataset.exchange || ExchangeRouter.getActive();
      // Kartın kendi borsasına geç — aktif borsa dropdown'undan bağımsız
      // çalışıyoruz, o coin gerçekte hangi borsada sinyal verdiyse oraya gidilir.
      EventBus.emit('symbol:change', { symbol: sym + 'USDT', exchange: cardExchange });

      // Karta tıklayınca arama kutusu o coin'e dolar, Kom ve Borsa filtreleri
      // "All"a döner — böylece aynı coin'in farklı Kom/borsa kombinasyonlarındaki
      // tüm kartları görünür.
      _state.searchTerm     = sym.toUpperCase();
      _state.komFilter      = 'all';
      _state.exchangeFilter = 'all';
      _syncToolbarUI();
      _renderList();
    });

    el.addEventListener('input', (e) => {
      const input = e.target.closest('#alarm-search-input');
      if (!input) return;
      _state.searchTerm = input.value.trim().toUpperCase();
      _updateClearButtonVisibility();
      _renderList();
    });
  }

  let _inited = false;

  function render() {
    const container = document.getElementById('dp-alarm-tab');
    if (!container) return;
    container.innerHTML = _buildShellHTML();
    _renderList();
  }

  function init() {
    const container = document.getElementById('dp-alarm-tab');
    if (!container) return;
    if (!_inited) {
      _attachDelegation(container);
      _inited = true;
    }
    render();
  }

  return { init, render, getActiveSignals };
})();

window.AlarmSignalHistory = AlarmSignalHistory;
