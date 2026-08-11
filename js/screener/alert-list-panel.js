/**
 * AlertListPanel — sağ sidebar → Alerts sekmesi (rsb-alerts) içeriği.
 * gorevler2.md Görev 13 (2026-08-11, 2. tur — kullanıcı TV ekran görüntüleri
 * paylaşıp ilk versiyonun rozet/pill tarzının "çocuksu/neon" göründüğünü,
 * TV'nin düz renkli metin + iki satırlı satır düzenini istediğini belirtti).
 *
 * AlertStore'daki (js/screener/alert-store.js) kullanıcı tarafından
 * oluşturulan fiyat alarmlarını TradingView'ın Alerts panel düzenine
 * yakın gösterir: filtre segmentleri, iki satırlı satır (başlık + durum),
 * play/pause (aktif/durdur), düzenle, sil (onaylı), hover'da detay balonu.
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
    crossing: '<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M3 3l10 10M13 3 3 13"/></svg>',
    above:    '<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 13 13 3M6 3h7v7"/></svg>',
    below:    '<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l10 10M13 6v7H6"/></svg>',
  };
  const CONDITION_LABEL = { crossing: 'Crossing', above: 'Crossing Up', below: 'Crossing Down' };
  const TOOL_LABELS = { trendline: 'Trend Line', ray: 'Ray', extended: 'Extended Line', hline: 'Horizontal Line', hray: 'Horizontal Ray', trendangle: 'Trend Angle', infoline: 'Info Line' };

  const ICON_EDIT   = '<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M11 2.5 13.5 5 5 13.5H2.5V11L11 2.5Z"/></svg>';
  const ICON_DELETE = '<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4.5h10M6 4.5V3h4v1.5M4.5 4.5 5 13.5h6l.5-9"/></svg>';
  const ICON_PLAY   = '<svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor"><path d="M4.5 3v10l8-5-8-5Z"/></svg>';
  const ICON_PAUSE  = '<svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor"><rect x="4" y="3" width="3" height="10" rx="0.5"/><rect x="9" y="3" width="3" height="10" rx="0.5"/></svg>';
  const ICON_BELL_SLASH = '<svg viewBox="0 0 16 16" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"><path d="M4.5 11V7a3.5 3.5 0 0 1 7 0v4l1 1.5h-9L4.5 11ZM6.7 13.5a1.3 1.3 0 0 0 2.6 0M2 2l12 12"/></svg>';

  function _statusOf(a) {
    if (a.triggered) return 'triggered';
    if (!a.active) return 'expired';
    return 'active';
  }

  // TradingView'ın kendi ekranlarındaki gibi düz RENKLİ METİN — rozet/pill
  // yok (kullanıcı geri bildirimi: pill'ler "çocuksu/neon" görünüyordu).
  const STATUS_STYLE = {
    active:    { text: 'Live', color: '#4caf7d' },
    triggered: { text: 'Stopped — Triggered', color: '#e0a030' },
    expired:   { text: 'Stopped — Expired',   color: '#e05c5c' },
  };

  function _fmtPrice(p) {
    if (p == null || isNaN(p)) return '—';
    const n = Number(p);
    const decimals = n >= 100 ? 2 : n >= 1 ? 4 : 6;
    return n.toFixed(decimals).replace(/0+$/, '').replace(/\.$/, '');
  }

  function _fmtDate(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: '2-digit' });
  }

  function _fmtDateTime(ts) {
    if (!ts) return '—';
    const d = new Date(ts);
    return d.toLocaleString('en-US', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  function _symbolTf(a) {
    return `${a.symbol}${a.tf ? ', ' + a.tf : ''}`;
  }

  function _titleOf(a) {
    const cond = CONDITION_LABEL[a.condition] || 'Crossing';
    const tool = a.sourceTool ? TOOL_LABELS[a.sourceTool] || a.sourceTool : null;
    return `${_symbolTf(a)}, ${cond}${tool ? ' ' + tool : ' ' + _fmtPrice(a.price)}`;
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
    const title = _titleOf(a);
    const isPaused = status !== 'active';

    return `
      <div class="al-row" data-id="${a.id}" data-symbol="${a.symbol.replace(/USDT$/, '')}" style="
        display:flex; align-items:flex-start; gap:8px; padding:8px 10px;
        border-radius:6px; cursor:pointer; position:relative;
      " title="${_esc(a.symbol)}">
        <span style="flex-shrink:0; margin-top:2px; color:var(--text-secondary); display:flex; align-items:center;">${icon}</span>
        <div style="flex:1; min-width:0;">
          <div style="font-size:12px; color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${_esc(title)}</div>
          <div style="font-size:11px; margin-top:1px; display:flex; align-items:center; gap:4px; flex-wrap:wrap;">
            <span style="color:var(--text-secondary);">${_esc(_symbolTf(a))}</span>
            <span style="color:var(--text-secondary);">·</span>
            <span style="color:${st.color};">${st.text}</span>
          </div>
        </div>
        <div class="al-row-actions" style="flex-shrink:0; display:flex; align-items:center; gap:1px;">
          <button type="button" class="al-toggle" data-id="${a.id}" title="${isPaused ? 'Restart' : 'Stop'}" style="
            background:transparent; border:none; color:var(--text-secondary); cursor:pointer;
            padding:4px; border-radius:4px; display:flex; align-items:center;
          ">${isPaused ? ICON_PLAY : ICON_PAUSE}</button>
          <button type="button" class="al-edit" data-id="${a.id}" title="Edit" style="
            background:transparent; border:none; color:var(--text-secondary); cursor:pointer;
            padding:4px; border-radius:4px; display:flex; align-items:center;
          ">${ICON_EDIT}</button>
          <button type="button" class="al-delete" data-id="${a.id}" title="Delete" style="
            background:transparent; border:none; color:var(--text-secondary); cursor:pointer;
            padding:4px; border-radius:4px; display:flex; align-items:center;
          ">${ICON_DELETE}</button>
        </div>
        <span style="flex-shrink:0; font-size:10px; color:var(--text-secondary); margin-top:2px; white-space:nowrap;">${_fmtDate(a.createdAt)}</span>
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
    return alerts.map(_buildRowHTML).join('');
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

  // ── Hover detay balonu (TV'nin satır tooltip'ine yakın) ─────────────
  let _tooltipEl = null;
  function _showTooltip(row, a) {
    _hideTooltip();
    const status = _statusOf(a);
    const st = STATUS_STYLE[status];
    const title = _titleOf(a);
    const tip = document.createElement('div');
    tip.id = 'al-tooltip';
    tip.style.cssText = `
      position:fixed; z-index:10000; width:260px; padding:10px 12px;
      background:#1a1e27; border:1px solid var(--border-primary); border-radius:8px;
      box-shadow:0 8px 24px rgba(0,0,0,0.45); font-size:11px; color:var(--text-secondary);
      pointer-events:none;
    `;
    tip.innerHTML = `
      <div style="font-size:12px; color:var(--text-primary); font-weight:600; margin-bottom:4px;">${_esc(title)}</div>
      <div style="margin-bottom:6px; color:${st.color};">${_esc(_symbolTf(a))} &middot; ${st.text}</div>
      <div>Created: ${_fmtDateTime(a.createdAt)}</div>
      ${a.triggeredAt ? `<div>Last triggered: ${_fmtDateTime(a.triggeredAt)}</div>` : ''}
      ${a.expiresAt ? `<div>Expires: ${_fmtDateTime(a.expiresAt)}</div>` : ''}
      ${a.message ? `<div style="margin-top:4px; color:var(--text-primary);">${_esc(a.message)}</div>` : ''}
    `;
    document.body.appendChild(tip);
    const r = row.getBoundingClientRect();
    let left = r.left - tip.offsetWidth - 10;
    if (left < 8) left = r.right + 10;
    let top = Math.min(r.top, window.innerHeight - tip.offsetHeight - 8);
    tip.style.left = Math.max(8, left) + 'px';
    tip.style.top = Math.max(8, top) + 'px';
    _tooltipEl = tip;
  }
  function _hideTooltip() {
    if (_tooltipEl) { _tooltipEl.remove(); _tooltipEl = null; }
  }

  // ── Silme onayı (TV'deki "Delete this alert?" diyaloğuyla aynı düzen) ──
  function _confirmDelete(alert) {
    if (document.getElementById('al-delete-confirm')) return;
    const backdrop = document.createElement('div');
    backdrop.id = 'al-delete-confirm';
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `
      <div class="modal" style="width:320px;">
        <div class="modal-header">
          <span>Delete this alert?</span>
          <button id="al-dc-close" style="background:none; border:none; color:var(--text-secondary); cursor:pointer; font-size:16px; line-height:1;">✕</button>
        </div>
        <div class="modal-body">
          <p style="font-size:12px; color:var(--text-secondary); margin:0;">Doing this will permanently delete your "${_esc(_titleOf(alert))}" alert.</p>
        </div>
        <div class="modal-footer">
          <button class="btn" id="al-dc-cancel">Cancel</button>
          <button class="btn" id="al-dc-delete" style="background:#e05c5c; color:#fff; border:none;">Delete</button>
        </div>
      </div>`;
    document.body.appendChild(backdrop);
    const close = () => backdrop.remove();
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });
    document.getElementById('al-dc-close')?.addEventListener('click', close);
    document.getElementById('al-dc-cancel')?.addEventListener('click', close);
    document.getElementById('al-dc-delete')?.addEventListener('click', () => {
      window.AlertStore?.removeAlert(alert.id);
      close();
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

      const toggleBtn = e.target.closest('.al-toggle');
      if (toggleBtn) {
        e.stopPropagation();
        const a = window.AlertStore?.getAlerts().find(x => x.id === toggleBtn.dataset.id);
        // !a.active YANLIŞTI: tetiklenmiş bir alarmda a.active zaten true
        // kalıyor (sadece a.triggered true oluyor) — "Restart" butonu bu
        // yüzden bazen alarmı YANLIŞ YÖNE (durdurulmuşa) çeviriyordu. Doğru
        // hedef durum, gösterilen ikonun anlamına (isPaused) göre AÇIKÇA
        // belirlenmeli: duraklatılmışsa her zaman yeniden başlat (active:true,
        // triggered:false), aktifse her zaman durdur (active:false).
        if (a) {
          const isPaused = _statusOf(a) !== 'active';
          window.AlertStore.updateAlert(a.id, isPaused ? { active: true, triggered: false } : { active: false });
        }
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
        const a = window.AlertStore?.getAlerts().find(x => x.id === deleteBtn.dataset.id);
        if (a) _confirmDelete(a);
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

    container.addEventListener('mouseover', (e) => {
      const row = e.target.closest('.al-row');
      if (!row || row.dataset.tooltipBound === '1') return;
      const a = window.AlertStore?.getAlerts().find(x => x.id === row.dataset.id);
      if (a) _showTooltip(row, a);
    });
    container.addEventListener('mouseout', (e) => {
      const row = e.target.closest('.al-row');
      if (!row) return;
      if (row.contains(e.relatedTarget)) return;
      _hideTooltip();
    });
    container.addEventListener('scroll', _hideTooltip, true);
  }

  let _inited = false;

  function render() {
    const container = document.getElementById('dp-alerts-tab');
    if (!container) return;
    container.innerHTML = `<div style="display:flex; flex-direction:column; height:100%;">
      ${_buildToolbarHTML()}
      <div id="al-list" style="overflow-y:auto; flex:1; padding:4px; display:flex; flex-direction:column; gap:0; box-sizing:border-box;"></div>
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
