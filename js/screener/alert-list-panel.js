/**
 * AlertListPanel — sağ sidebar → Alerts sekmesi (rsb-alerts) içeriği.
 * gorevler2.md Görev 13 (2026-08-11).
 *
 * AlertStore'daki (js/screener/alert-store.js) kullanıcı tarafından
 * oluşturulan fiyat alarmlarını TradingView'ın Alerts panel düzenine
 * yakın bir listede gösterir: durum filtresi (All/Active/Triggered),
 * her satırda condition ikonu + sembol + fiyat + durum + düzenle/sil.
 *
 * AlarmSignalHistory (dp-alarm-tab, Kom1/2/3 strateji sinyal kartları) ile
 * KARIŞTIRILMASIN — tamamen ayrı bir modül/kavram, kendi verisi.
 */
const AlertListPanel = (() => {
  const _state = { filter: 'all', searchTerm: '' };

  const SEGMENTS = [
    { key: 'all',       label: 'All' },
    { key: 'active',    label: 'Active' },
    { key: 'triggered', label: 'Triggered' },
  ];

  function _esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // ── TradingView'daki Condition ikonlarına yakın, kendi çizdiğimiz
  //    SVG glyph'ler (TV'nin kendi asset kaynağına erişimimiz yok — aynı
  //    kavramsal anlamı, aynı stroke/viewBox diliyle karşılıyoruz). ──────
  const CONDITION_ICON = {
    crossing: '<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M3 3l10 10M13 3 3 13"/></svg>',
    above:    '<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 13 13 3M6 3h7v7"/></svg>',
    below:    '<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l10 10M13 6v7H6"/></svg>',
  };
  const CONDITION_LABEL = { crossing: 'Crossing', above: 'Crossing Up', below: 'Crossing Down' };

  const ICON_EDIT   = '<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M11 2.5 13.5 5 5 13.5H2.5V11L11 2.5Z"/></svg>';
  const ICON_DELETE = '<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4.5h10M6 4.5V3h4v1.5M4.5 4.5 5 13.5h6l.5-9"/></svg>';
  const ICON_BELL_SLASH = '<svg viewBox="0 0 16 16" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"><path d="M4.5 11V7a3.5 3.5 0 0 1 7 0v4l1 1.5h-9L4.5 11ZM6.7 13.5a1.3 1.3 0 0 0 2.6 0M2 2l12 12"/></svg>';

  function _statusOf(a) {
    if (a.triggered) return 'triggered';
    if (!a.active) return 'expired';
    return 'active';
  }

  const STATUS_STYLE = {
    active:    { label: 'Active',    color: '#26a69a', bg: 'rgba(38,166,154,0.12)' },
    triggered: { label: 'Triggered', color: '#f0b90b', bg: 'rgba(240,185,11,0.12)' },
    expired:   { label: 'Expired',   color: 'var(--text-secondary)', bg: 'rgba(148,163,184,0.10)' },
  };

  function _fmtPrice(p) {
    if (p == null || isNaN(p)) return '—';
    const n = Number(p);
    const decimals = n >= 100 ? 2 : n >= 1 ? 4 : 6;
    return n.toFixed(decimals).replace(/0+$/, '').replace(/\.$/, '');
  }

  function _filtered() {
    const all = (window.AlertStore?.getAlerts() || []).slice()
      .sort((a, b) => b.createdAt - a.createdAt);
    let list = _state.filter === 'all' ? all : all.filter(a => _statusOf(a) === _state.filter);
    if (_state.searchTerm) {
      list = list.filter(a => a.symbol.toUpperCase().includes(_state.searchTerm));
    }
    return list;
  }

  function _segBtnStyle(active) {
    return active
      ? 'background:var(--accent-blue); color:#fff; opacity:1;'
      : 'background:transparent; color:var(--text-secondary); opacity:0.7;';
  }

  function _buildToolbarHTML() {
    const segsHtml = SEGMENTS.map(seg => `
      <button type="button" class="al-seg" data-key="${seg.key}" style="
        padding:4px 10px; font-size:11px; font-weight:600; border:none; border-radius:5px;
        cursor:pointer; white-space:nowrap; transition:background 0.15s ease, color 0.15s ease;
        ${_segBtnStyle(_state.filter === seg.key)}
      ">${seg.label}</button>`).join('');

    return `
      <div id="al-toolbar" style="
        display:flex; align-items:center; gap:8px; padding:8px;
        border-bottom:0.5px solid var(--border-primary); flex-shrink:0;
      ">
        <div id="al-segments" style="
          display:flex; align-items:center; gap:2px; padding:2px; flex-shrink:0;
          background:var(--bg-tertiary); border-radius:7px;
        ">${segsHtml}</div>
        <div style="position:relative; flex:1; min-width:0;">
          <input id="al-search" type="text" placeholder="Search coin..." value="${_esc(_state.searchTerm)}" style="
            width:100%; box-sizing:border-box; font-size:12px; padding:5px 8px; border-radius:6px;
            border:0.5px solid var(--border-primary); background:var(--bg-primary);
            color:var(--text-primary); outline:none;
          ">
        </div>
      </div>`;
  }

  function _buildRowHTML(a) {
    const status = _statusOf(a);
    const st = STATUS_STYLE[status];
    const icon = CONDITION_ICON[a.condition] || CONDITION_ICON.crossing;
    const condLabel = CONDITION_LABEL[a.condition] || 'Crossing';
    const srcLabel = a.sourceTool ? a.sourceTool : 'Manual';

    return `
      <div class="al-row" data-id="${a.id}" data-symbol="${a.symbol.replace(/USDT$/, '')}" style="
        display:flex; align-items:center; gap:8px; padding:9px 10px;
        border-radius:8px; background:var(--bg-secondary); border:0.75px solid var(--border-primary);
        cursor:pointer; opacity:${status === 'expired' ? 0.55 : 1};
      " title="Go to chart: ${_esc(a.symbol)}">
        <span style="flex-shrink:0; color:var(--text-secondary); display:flex; align-items:center;" title="${condLabel}">${icon}</span>
        <div style="flex:1; min-width:0;">
          <div style="display:flex; align-items:baseline; gap:6px; flex-wrap:wrap;">
            <span style="font-weight:600; font-size:13px; color:var(--text-primary);">${_esc(a.symbol)}</span>
            <span style="font-size:11px; color:var(--text-secondary);">${condLabel} ${_fmtPrice(a.price)}</span>
          </div>
          <div style="font-size:10px; color:var(--text-secondary); margin-top:2px;">
            ${_esc(srcLabel)}${a.message ? ' · ' + _esc(a.message) : ''}
          </div>
        </div>
        <span style="flex-shrink:0; font-size:9px; font-weight:700; padding:2px 7px; border-radius:9px; background:${st.bg}; color:${st.color};">${st.label}</span>
        <div style="flex-shrink:0; display:flex; align-items:center; gap:2px;">
          <button type="button" class="al-edit" data-id="${a.id}" title="Edit" style="
            background:transparent; border:none; color:var(--text-secondary); cursor:pointer;
            padding:4px; border-radius:4px; display:flex; align-items:center;
          ">${ICON_EDIT}</button>
          <button type="button" class="al-delete" data-id="${a.id}" title="Delete" style="
            background:transparent; border:none; color:var(--text-secondary); cursor:pointer;
            padding:4px; border-radius:4px; display:flex; align-items:center;
          ">${ICON_DELETE}</button>
        </div>
      </div>`;
  }

  function _buildListHTML(alerts) {
    if (!alerts.length) {
      return `
        <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; padding:40px 16px; color:var(--text-secondary);">
          ${ICON_BELL_SLASH}
          <div style="font-size:12px; text-align:center;">No alerts yet.<br>Draw a line and click the bell icon, or use the Navbar Alert button.</div>
        </div>`;
    }
    return alerts.map(_buildRowHTML).join('<div style="height:6px;"></div>');
  }

  function _renderList() {
    const listEl = document.getElementById('al-list');
    if (!listEl) return;
    listEl.innerHTML = _buildListHTML(_filtered());
  }

  function _updateSegmentStyles() {
    document.querySelectorAll('#al-segments .al-seg').forEach(btn => {
      btn.setAttribute('style', btn.getAttribute('style').replace(
        /background:[^;]+;\s*color:[^;]+;\s*opacity:[^;]+;/,
        _segBtnStyle(btn.dataset.key === _state.filter)
      ));
    });
  }

  function _attachDelegation(container) {
    container.addEventListener('click', (e) => {
      const seg = e.target.closest('.al-seg');
      if (seg) {
        _state.filter = seg.dataset.key;
        _updateSegmentStyles();
        _renderList();
        return;
      }

      const editBtn = e.target.closest('.al-edit');
      if (editBtn) {
        e.stopPropagation();
        if (typeof EventBus !== 'undefined') EventBus.emit('modal:alarm:open', { editAlertId: editBtn.dataset.id });
        return;
      }

      const deleteBtn = e.target.closest('.al-delete');
      if (deleteBtn) {
        e.stopPropagation();
        window.AlertStore?.removeAlert(deleteBtn.dataset.id);
        return;
      }

      const row = e.target.closest('.al-row');
      if (!row) return;
      const sym = row.dataset.symbol;
      if (typeof EventBus !== 'undefined') EventBus.emit('symbol:change', { symbol: sym + 'USDT' });
    });

    container.addEventListener('input', (e) => {
      const input = e.target.closest('#al-search');
      if (!input) return;
      _state.searchTerm = input.value.trim().toUpperCase();
      _renderList();
    });
  }

  let _inited = false;

  function render() {
    const container = document.getElementById('dp-alerts-tab');
    if (!container) return;
    container.innerHTML = `<div style="display:flex; flex-direction:column; height:100%;">
      ${_buildToolbarHTML()}
      <div id="al-list" style="overflow-y:auto; flex:1; padding:8px; display:flex; flex-direction:column; gap:0; box-sizing:border-box;"></div>
    </div>`;
    _renderList();
  }

  function init() {
    const container = document.getElementById('dp-alerts-tab');
    if (!container) return;
    if (!_inited) {
      _attachDelegation(container);
      if (typeof EventBus !== 'undefined') {
        ['alert:created', 'alert:removed', 'alert:updated', 'alert:triggered'].forEach(ev => {
          EventBus.on(ev, () => { if (document.getElementById('dp-alerts-tab')?.offsetParent) _renderList(); });
        });
      }
      _inited = true;
    }
    render();
  }

  return { init, render };
})();

window.AlertListPanel = AlertListPanel;
