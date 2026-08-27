/**
 * IndicatorListPanel — sağ sidebar → Indicators sekmesi (rsb-indicators) içeriği.
 * gorevler2.md Görev 14.2 (2026-08-11). AlertListPanel'in aynı düzenini
 * (liste + edit/delete, TV tarzı görsel dil) kullanır, ama veri kaynağı
 * global bir Store DEĞİL — AKTİF pane'in `ChartPane.indicators` dizisi
 * (Görev 14.1). Aktif pane değiştikçe (multi-symbol grid layout) veya o
 * pane'in indikatörleri değiştikçe liste kendini yeniler.
 */
const IndicatorListPanel = (() => {
  const NAME = { ema: 'Moving Average Exponential', dema: 'Double EMA', rsi: 'Relative Strength Index', linreg: 'Linear Regression Channel' };
  const SHORT = { ema: 'EMA', dema: 'DEMA', rsi: 'RSI', linreg: 'LinReg' };

  function _esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  const ICON_EDIT   = '<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M11 2.5 13.5 5 5 13.5H2.5V11L11 2.5Z"/></svg>';
  const ICON_DELETE = '<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4.5h10M6 4.5V3h4v1.5M4.5 4.5 5 13.5h6l.5-9"/></svg>';
  const ICON_EMPTY  = '<svg viewBox="0 0 16 16" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12l3.5-5 3 3L14 4"/><circle cx="14" cy="4" r="1.3" fill="currentColor" stroke="none"/></svg>';

  function _activePane() {
    return window.LayoutManager?.getActivePane?.() || null;
  }

  function _fmtVal(v) {
    return v != null ? (Math.round(v * 100) / 100) : '—';
  }

  function _buildHeaderHTML(pane) {
    const label = pane ? `${_esc(pane.symbol)}${pane.tf ? ', ' + _esc(pane.tf) : ''}` : '—';
    return `
      <div id="il-toolbar" style="
        display:flex; align-items:center; justify-content:space-between; gap:8px; padding:8px;
        border-bottom:0.5px solid var(--border-primary); flex-shrink:0;
      ">
        <span style="font-size:11px; color:var(--text-secondary); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${label}</span>
        <button type="button" id="il-add-btn" title="Add indicator" style="
          flex-shrink:0; background:#2962ff; border:none; color:#fff; cursor:pointer;
          width:22px; height:22px; border-radius:5px; display:flex; align-items:center; justify-content:center; font-size:15px; line-height:1;
        ">+</button>
      </div>`;
  }

  function _buildRowHTML(cfg) {
    return `
      <div class="il-row" data-id="${cfg.id}" style="
        display:flex; align-items:center; gap:8px; padding:8px 10px;
        border-radius:6px; position:relative;
      ">
        <span style="flex-shrink:0; width:8px; height:8px; border-radius:50%; background:${cfg.color};"></span>
        <div style="flex:1; min-width:0;">
          <div style="font-size:12px; color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${NAME[cfg.type] || cfg.type} (${SHORT[cfg.type] || cfg.type})</div>
          <div style="font-size:11px; margin-top:1px; color:var(--text-secondary);">Length ${cfg.period} &middot; ${_fmtVal(cfg._lastValue)}</div>
        </div>
        <div class="il-row-actions" style="flex-shrink:0; display:flex; align-items:center; gap:1px;">
          <button type="button" class="il-edit" data-id="${cfg.id}" title="Settings" style="
            background:transparent; border:none; color:var(--text-secondary); cursor:pointer;
            padding:4px; border-radius:4px; display:flex; align-items:center;
          ">${ICON_EDIT}</button>
          <button type="button" class="il-delete" data-id="${cfg.id}" title="Remove" style="
            background:transparent; border:none; color:var(--text-secondary); cursor:pointer;
            padding:4px; border-radius:4px; display:flex; align-items:center;
          ">${ICON_DELETE}</button>
        </div>
      </div>`;
  }

  // [2026-08-26, kullanıcı isteği] Volume, gerçek indikatör mimarisine
  // (this.indicators[]) TAŞINMADI — hâlâ Settings > Canvas'taki checkbox'a
  // (pane.showVolume/setVolume()) bağlı, tek doğruluk kaynağı o. Burası
  // sadece bir "kısayol": showVolume açıkken listede sentetik bir satır
  // gösterir, çöp kutusuna tıklanınca gerçek indikatör gibi silinmez,
  // setVolume(false) çağrılıp checkbox'ı da otomatik kapatır.
  function _buildVolumeRowHTML() {
    return `
      <div class="il-row" data-id="__volume__" style="
        display:flex; align-items:center; gap:8px; padding:8px 10px;
        border-radius:6px; position:relative;
      ">
        <span style="flex-shrink:0; width:8px; height:8px; border-radius:50%; background:rgba(70,130,100,.9);"></span>
        <div style="flex:1; min-width:0;">
          <div style="font-size:12px; color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">Volume</div>
        </div>
        <div class="il-row-actions" style="flex-shrink:0; display:flex; align-items:center; gap:1px;">
          <button type="button" class="il-delete-volume" title="Remove" style="
            background:transparent; border:none; color:var(--text-secondary); cursor:pointer;
            padding:4px; border-radius:4px; display:flex; align-items:center;
          ">${ICON_DELETE}</button>
        </div>
      </div>`;
  }

  function _buildListHTML(pane) {
    if (!pane) {
      return `<div style="padding:40px 16px; text-align:center; color:var(--text-secondary); font-size:12px;">No active chart</div>`;
    }
    const volumeRow = pane.showVolume ? _buildVolumeRowHTML() : '';
    if (!pane.indicators.length && !pane.showVolume) {
      return `
        <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; padding:40px 16px; color:var(--text-secondary);">
          ${ICON_EMPTY}
          <div style="font-size:12px; text-align:center;">No indicators on this chart yet.<br>Click + above to add one.</div>
        </div>`;
    }
    return volumeRow + pane.indicators.map(_buildRowHTML).join('');
  }

  function _renderHeader() {
    const el = document.getElementById('il-header');
    if (el) el.innerHTML = _buildHeaderHTML(_activePane());
  }

  function _renderList() {
    const el = document.getElementById('il-list');
    if (el) el.innerHTML = _buildListHTML(_activePane());
  }

  function _renderAll() {
    _renderHeader();
    _renderList();
  }

  function _attachDelegation(container) {
    container.addEventListener('click', (e) => {
      const addBtn = e.target.closest('#il-add-btn');
      if (addBtn) {
        document.getElementById('btn-indicators')?.click();
        return;
      }

      const deleteVolBtn = e.target.closest('.il-delete-volume');
      if (deleteVolBtn) {
        const pane = _activePane();
        window.ConfirmModal.show('Remove Volume from chart? This cannot be undone.').then((ok) => {
          if (ok) pane?.setVolume(false);
        });
        return;
      }

      const editBtn = e.target.closest('.il-edit');
      if (editBtn) {
        const pane = _activePane();
        if (pane && typeof EventBus !== 'undefined') {
          EventBus.emit('indicator:editRequested', { paneIdx: pane.idx, indicatorId: editBtn.dataset.id });
        }
        return;
      }

      const deleteBtn = e.target.closest('.il-delete');
      if (deleteBtn) {
        const pane = _activePane();
        const cfg = pane?.indicators.find(i => i.id === deleteBtn.dataset.id);
        const name = cfg ? (SHORT[cfg.type] || cfg.type) : 'this indicator';
        window.ConfirmModal.show(`Remove ${name} indicator? This cannot be undone.`).then((ok) => {
          if (ok) pane?.removeIndicator(deleteBtn.dataset.id);
        });
        return;
      }
    });
  }

  let _inited = false;

  function render() {
    const container = document.getElementById('dp-indicators-tab');
    if (!container) return;
    container.innerHTML = `<div style="display:flex; flex-direction:column; height:100%;">
      <div id="il-header"></div>
      <div id="il-list" style="overflow-y:auto; flex:1; padding:4px; display:flex; flex-direction:column; gap:0; box-sizing:border-box;"></div>
    </div>`;
    _renderAll();
  }

  function init() {
    const container = document.getElementById('dp-indicators-tab');
    if (!container) return;
    if (!_inited) {
      _attachDelegation(container);
      if (typeof EventBus !== 'undefined') {
        // Aktif pane'in indikatörleri değişince (ekle/kaldır/ayarla) VEYA
        // aktif pane değişince (multi-symbol grid'de başka bir chart'a
        // tıklanınca) listeyi yenile.
        EventBus.on('pane:indicatorsChanged', () => { if (document.getElementById('dp-indicators-tab')?.offsetParent) _renderAll(); });
        EventBus.on('pane:activated', () => { if (document.getElementById('dp-indicators-tab')?.offsetParent) _renderAll(); });
      }
      _inited = true;
    }
    render();
  }

  return { init, render };
})();

window.IndicatorListPanel = IndicatorListPanel;
