/* ──────────────────────────────────────────────────────────
   watchlist-menu.js  —  Header'daki iki dropdown
   Global: WatchlistMenu

   1) Liste seçici  (#wl-list-picker)   → kullanıcı listeleri + Sinyaller + pazar filtresi
   2) Sütun seçici  (#wl-cols-picker)   → hangi sütunlar görünsün (⋮)

   Veri için WatchlistStore'a sorar, kendi başına localStorage'a dokunmaz.
────────────────────────────────────────────────────────── */
const WatchlistMenu = (() => {

  const WS = () => window.WatchlistStore;

  let _listPicker = null, _listMenu = null, _listLabel = null;
  let _colsPicker = null, _colsMenu = null;
  let _pendingCreate = false;   // "yeni liste" satırı açık mı
  let _renamingId    = null;    // hangi liste yeniden adlandırılıyor

  /* ── Yardımcılar ──────────────────────────────────── */
  function _esc(s) {
    return String(s).replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function _closeAll() {
    _listMenu?.classList.remove('open');
    _colsMenu?.classList.remove('open');
    _pendingCreate = false;
    _renamingId = null;
  }

  /* ══════════════════════════════════════════════════
     1) LİSTE SEÇİCİ
  ══════════════════════════════════════════════════ */
  function _renderListMenu() {
    if (!_listMenu) return;
    const store  = WS();
    const active = store.getActiveId();
    const lists  = store.getLists();

    const row = (id, name, opts = {}) => `
      <div class="wl-lm-item${id === active ? ' active' : ''}${opts.system ? ' system' : ''}"
           data-list-id="${_esc(id)}">
        <span class="wl-lm-dot"></span>
        <span class="wl-lm-name">${_esc(name)}</span>
        ${opts.system ? '' : `
          <span class="wl-lm-actions">
            <button class="wl-lm-act" data-act="rename" data-id="${_esc(id)}" title="Rename">✎</button>
            <button class="wl-lm-act" data-act="delete" data-id="${_esc(id)}" title="Delete">🗑</button>
          </span>`}
      </div>`;

    // ── Kullanıcı listeleri ──
    let userHtml = lists.map(l =>
      _renamingId === l.id
        ? `<div class="wl-lm-item editing">
             <input class="wl-lm-input" id="wl-lm-rename-input" type="text"
                    value="${_esc(l.name)}" data-id="${_esc(l.id)}" maxlength="40">
           </div>`
        : row(l.id, `${l.name}${l.symbols.length ? ` (${l.symbols.length})` : ''}`)
    ).join('');

    if (!lists.length && !_pendingCreate) {
      userHtml = `<div class="wl-lm-empty">No lists yet</div>`;
    }

    const createHtml = _pendingCreate
      ? `<div class="wl-lm-item editing">
           <input class="wl-lm-input" id="wl-lm-create-input" type="text"
                  placeholder="List name..." maxlength="40">
         </div>`
      : `<div class="wl-lm-action-row" data-act="create-open">
           <span class="wl-lm-plus">+</span> Create new list...
         </div>`;

    // ── Signals (system) — Combo 1/2/3 skeleton ──
    const groups = store.getSignalGroups();
    const signalsHtml = `
      ${row(store.SIGNALS_ID, 'Signals', { system: true })}
      <div class="wl-lm-groups">
        ${groups.map(g => `
          <div class="wl-lm-group">
            <div class="wl-lm-group-sep"><span>${_esc(g.name)}</span></div>
            ${g.symbols.length
              ? g.symbols.map(s => `<div class="wl-lm-group-sym">${_esc(s)}</div>`).join('')
              : '<div class="wl-lm-group-empty">—</div>'}
          </div>`).join('')}
      </div>`;

    _listMenu.innerHTML = `
      <div class="wl-lm-section">
        ${row(store.ALL_ID, 'All Coins', { system: true })}
      </div>

      <div class="wl-lm-sep-line"></div>
      <div class="wl-lm-label">MY LISTS</div>
      <div class="wl-lm-section">
        ${userHtml}
        ${createHtml}
      </div>

      <div class="wl-lm-sep-line"></div>
      <div class="wl-lm-label">SYSTEM</div>
      <div class="wl-lm-section">
        ${signalsHtml}
      </div>

      <div class="wl-lm-sep-line"></div>
      <div class="wl-lm-market">
        <div class="wl-lm-market-row disabled" data-act="spot" title="Spot support not yet added">
          SPOT <span class="wl-lm-soon">soon</span>
        </div>
        <div class="wl-lm-market-row plain">
          FUTURES
        </div>
      </div>`;

    // Rename / create input odakla
    const ri = _listMenu.querySelector('#wl-lm-rename-input');
    if (ri) { ri.focus(); ri.select(); }
    const ci = _listMenu.querySelector('#wl-lm-create-input');
    if (ci) ci.focus();
  }

  function _updateListLabel() {
    if (_listLabel) _listLabel.textContent = WS().getListName(WS().getActiveId());
  }

  function _onListMenuClick(e) {
    e.stopPropagation();
    const store = WS();

    // ── Liste satırı eylemleri (✎ / 🗑) ──
    const actBtn = e.target.closest('.wl-lm-act');
    if (actBtn) {
      const id = actBtn.dataset.id;
      if (actBtn.dataset.act === 'rename') {
        _renamingId = id; _pendingCreate = false; _renderListMenu();
      } else if (actBtn.dataset.act === 'delete') {
        const name = store.getList(id)?.name || '';
        if (confirm(`Delete list "${name}"?`)) {
          store.deleteList(id);
          _renderListMenu(); _updateListLabel();
        }
      }
      return;
    }

    // ── "Yeni liste oluştur..." ──
    if (e.target.closest('[data-act="create-open"]')) {
      _pendingCreate = true; _renamingId = null; _renderListMenu();
      return;
    }

    // ── Pazar filtresi ──
    const spot = e.target.closest('[data-act="spot"]');
    if (spot) {
      if (window.Toast) Toast.show('SPOT support coming soon', 'info');
      return;
    }

    // Input'a tıklandıysa menüyü kapatma
    if (e.target.closest('.wl-lm-input')) return;

    // ── Liste seçimi ──
    const item = e.target.closest('.wl-lm-item[data-list-id]');
    if (item) {
      store.setActive(item.dataset.listId);
      _updateListLabel();
      _closeAll();
    }
  }

  function _onListMenuKey(e) {
    const store = WS();

    if (e.target.id === 'wl-lm-create-input') {
      if (e.key === 'Enter') {
        const name = e.target.value.trim();
        if (name) {
          const list = store.createList(name);
          store.setActive(list.id);
          _updateListLabel();
        }
        _pendingCreate = false;
        _renderListMenu();
      } else if (e.key === 'Escape') {
        _pendingCreate = false; _renderListMenu();
      }
    }

    if (e.target.id === 'wl-lm-rename-input') {
      if (e.key === 'Enter') {
        store.renameList(e.target.dataset.id, e.target.value);
        _renamingId = null;
        _renderListMenu(); _updateListLabel();
      } else if (e.key === 'Escape') {
        _renamingId = null; _renderListMenu();
      }
    }
  }

  /* ══════════════════════════════════════════════════
     2) SÜTUN SEÇİCİ (⋮)
  ══════════════════════════════════════════════════ */
  const CHANGE_TYPES = [
    { id: 'rolling24h', label: '24h Rolling' },
    { id: 'dayOpen',    label: '1D Open', soon: true },
  ];
  const VOLUME_TYPES = [
    { id: 'usd',      label: 'USD' },
    { id: 'standard', label: 'Standard' },
  ];

  function _radioRow(id, label, checked, soon) {
    return `
      <div class="wl-cm-radio${soon ? ' soon' : ''}" data-radio-id="${id}" ${soon ? 'title="Coming soon"' : ''}>
        <span class="wl-cm-radio-dot${checked ? ' on' : ''}"></span>
        <span class="wl-cm-name">${_esc(label)}</span>
        ${soon ? '<span class="wl-lm-soon">soon</span>' : ''}
      </div>`;
  }

  function _renderColsMenu() {
    if (!_colsMenu) return;
    const store = WS();
    const changeType = store.getChangeType();
    const volumeType = store.getVolumeType();

    _colsMenu.innerHTML = `
      <div class="wl-lm-label">CUSTOMIZE COLUMNS</div>
      ${store.getAllColumns().map(c => {
        const on = store.isColumnVisible(c.key);
        return `
          <div class="wl-cm-item${c.locked ? ' locked' : ''}" data-col="${c.key}"
               ${c.locked ? 'title="Symbol column cannot be hidden"' : ''}>
            <span class="wl-cm-check${on ? ' on' : ''}">${on ? '✓' : ''}</span>
            <span class="wl-cm-name">${_esc(c.label)}</span>
            ${c.locked ? '<span class="wl-cm-lock">🔒</span>' : ''}
          </div>`;
      }).join('')}

      <div class="wl-lm-sep-line"></div>
      <div class="wl-lm-label">CHANGE TYPE (BETA)</div>
      <div data-group="change">
        ${CHANGE_TYPES.map(t => _radioRow(t.id, t.label, changeType === t.id, t.soon)).join('')}
      </div>

      <div class="wl-lm-sep-line"></div>
      <div class="wl-lm-label">VOLUME TYPE</div>
      <div data-group="volume">
        ${VOLUME_TYPES.map(t => _radioRow(t.id, t.label, volumeType === t.id, t.soon)).join('')}
      </div>`;
  }

  function _onColsMenuClick(e) {
    e.stopPropagation();
    const store = WS();

    const item = e.target.closest('.wl-cm-item');
    if (item) {
      const key = item.dataset.col;
      if (!store.setColumnVisible(key, !store.isColumnVisible(key))) return; // locked
      _renderColsMenu();
      return;
    }

    const radio = e.target.closest('.wl-cm-radio');
    if (radio) {
      const group = radio.closest('[data-group]')?.dataset.group;
      const id = radio.dataset.radioId;
      if (group === 'change') {
        if (!store.setChangeType(id)) {
          if (window.Toast) Toast.show('1D Open coming soon — still showing 24h Rolling', 'info');
          return;
        }
      } else if (group === 'volume') {
        if (!store.setVolumeType(id)) return;
      }
      _renderColsMenu();
    }
  }

  /* ══════════════════════════════════════════════════
     3) SATIR SAĞ TIK — coin'i listelere ekle/çıkar
     Bir coin birden fazla listede olabilir (kasıtlı).
  ══════════════════════════════════════════════════ */
  let _ctxEl = null;

  function _closeCtx() { _ctxEl?.remove(); _ctxEl = null; }

  function _openCtx(symbol, x, y) {
    _closeCtx();
    const store = WS();
    const lists = store.getLists();

    _ctxEl = document.createElement('div');
    _ctxEl.className = 'wl-ctx-menu';
    _ctxEl.innerHTML = `
      <div class="wl-ctx-title">${_esc(symbol)}</div>
      ${lists.length
        ? lists.map(l => {
            const on = store.hasSymbol(l.id, symbol);
            return `<div class="wl-ctx-item" data-list="${_esc(l.id)}">
              <span class="wl-cm-check${on ? ' on' : ''}">${on ? '✓' : ''}</span>
              <span class="wl-cm-name">${_esc(l.name)}</span>
            </div>`;
          }).join('')
        : '<div class="wl-lm-empty">Create a list first</div>'}`;

    document.body.appendChild(_ctxEl);

    // Ekran dışına taşmasın
    const r = _ctxEl.getBoundingClientRect();
    _ctxEl.style.left = Math.min(x, window.innerWidth  - r.width  - 8) + 'px';
    _ctxEl.style.top  = Math.min(y, window.innerHeight - r.height - 8) + 'px';

    _ctxEl.addEventListener('click', (e) => {
      e.stopPropagation();
      const item = e.target.closest('.wl-ctx-item');
      if (!item) return;
      const id = item.dataset.list;
      if (store.hasSymbol(id, symbol)) store.removeSymbol(id, symbol);
      else store.addSymbol(id, symbol);
      _openCtx(symbol, x, y);   // durumu tazele, menü açık kalsın
    });
  }

  function _initRowContextMenu() {
    const list = document.getElementById('wl-list');
    if (!list) return;
    list.addEventListener('contextmenu', (e) => {
      const row = e.target.closest('.wl-row');
      if (!row) return;
      e.preventDefault();
      const sym = row.dataset.sym;
      if (sym) _openCtx(sym.endsWith('USDT') ? sym : sym + 'USDT', e.clientX, e.clientY);
    });
    document.addEventListener('click', _closeCtx);
    document.addEventListener('scroll', _closeCtx, true);
  }

  /* ══════════════════════════════════════════════════
     Init
  ══════════════════════════════════════════════════ */
  function init() {
    if (!window.WatchlistStore) {
      console.warn('[WatchlistMenu] WatchlistStore yok — atlanıyor');
      return;
    }

    _listPicker = document.getElementById('wl-list-picker');
    _listMenu   = document.getElementById('wl-list-menu');
    _listLabel  = document.getElementById('wl-list-label');
    _colsPicker = document.getElementById('wl-cols-picker');
    _colsMenu   = document.getElementById('wl-cols-menu');

    if (!_listPicker || !_colsPicker) {
      console.warn('[WatchlistMenu] header elemanları bulunamadı');
      return;
    }

    // Liste seçici
    _listPicker.addEventListener('click', (e) => {
      if (e.target.closest('.wl-list-menu')) return;  // menü içi tıklama
      e.stopPropagation();
      const willOpen = !_listMenu.classList.contains('open');
      _closeAll();
      if (willOpen) { _renderListMenu(); _listMenu.classList.add('open'); }
    });
    _listMenu.addEventListener('click', _onListMenuClick);
    _listMenu.addEventListener('keydown', _onListMenuKey);

    // Sütun seçici
    _colsPicker.addEventListener('click', (e) => {
      if (e.target.closest('.wl-cols-menu')) return;
      e.stopPropagation();
      const willOpen = !_colsMenu.classList.contains('open');
      _closeAll();
      if (willOpen) { _renderColsMenu(); _colsMenu.classList.add('open'); }
    });
    _colsMenu.addEventListener('click', _onColsMenuClick);

    // Dışarı tıklayınca kapat
    document.addEventListener('click', _closeAll);

    // Etiket olay tabanlı güncellensin — setActive nereden çağrılırsa çağrılsın
    // (menüden, kod içinden, ileride sinyal motorundan) başlık doğru kalsın.
    EventBus.on('watchlist:activeChanged', _updateListLabel);
    EventBus.on('watchlist:listsChanged',  _updateListLabel);

    _initRowContextMenu();
    _updateListLabel();
    console.log('[WatchlistMenu] Initialized ✓');
  }

  return { init };
})();

window.WatchlistMenu = WatchlistMenu;
