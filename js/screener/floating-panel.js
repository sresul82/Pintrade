/**
 * FloatingPanel
 * DetailPanel içeriğini sürüklenebilir bir overlay penceresinde gösterir.
 */
const FloatingPanel = (() => {
  let _el = null;          // floating window DOM elementi
  let _isDragging = false;
  let _dragOffsetX = 0;
  let _dragOffsetY = 0;
  let _visible = false;

  // Panel genişliği — ana panel ile aynı
  const PANEL_WIDTH = 420; // px, projenin detail panel genişliğiyle eşleştir

  function _createEl() {
    const div = document.createElement('div');
    div.id = 'floating-detail-panel';
    div.setAttribute('role', 'dialog');
    div.setAttribute('aria-label', 'Detay Paneli - Taşınabilir Pencere');
    div.style.cssText = `
      position: fixed;
      top: 60px;
      right: 440px;
      width: ${PANEL_WIDTH}px;
      max-height: 90vh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      background: var(--bg-primary);
      border: 1px solid var(--border-primary);
      border-radius: 8px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.45);
      z-index: 9999;
      user-select: none;
    `;

    // Titlebar (sürükleme tutacağı)
    const titlebar = document.createElement('div');
    titlebar.id = 'floating-panel-titlebar';
    titlebar.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 12px;
      background: var(--bg-secondary);
      border-bottom: 1px solid var(--border-primary);
      cursor: grab;
      border-radius: 8px 8px 0 0;
      flex-shrink: 0;
    `;
    titlebar.innerHTML = `
      <span style="font-size:11px; font-weight:600; color:var(--text-primary);">
        ⠿ Detay Paneli
      </span>
      <button id="floating-panel-close" aria-label="Kapat" style="
        background: transparent;
        border: none;
        color: var(--text-secondary);
        font-size: 16px;
        cursor: pointer;
        line-height: 1;
        padding: 0 2px;
      ">✕</button>
    `;

    // Content area — mevcut dp-signals-tab içeriğini yansıtır
    const content = document.createElement('div');
    content.id = 'floating-panel-content';
    content.style.cssText = `
      flex: 1;
      overflow-y: auto;
      overflow-x: hidden;
    `;

    div.appendChild(titlebar);
    div.appendChild(content);
    document.body.appendChild(div);

    // Drag events
    titlebar.addEventListener('mousedown', _onMouseDown);
    document.addEventListener('mousemove', _onMouseMove);
    document.addEventListener('mouseup', _onMouseUp);

    // Close button
    document.getElementById('floating-panel-close')
      .addEventListener('click', hide);

    return div;
  }

  function _onMouseDown(e) {
    if (e.target.id === 'floating-panel-close') return;
    _isDragging = true;
    const rect = _el.getBoundingClientRect();
    _dragOffsetX = e.clientX - rect.left;
    _dragOffsetY = e.clientY - rect.top;
    _el.style.cursor = 'grabbing';
    document.getElementById('floating-panel-titlebar').style.cursor = 'grabbing';
    e.preventDefault();
  }

  function _onMouseMove(e) {
    if (!_isDragging || !_el) return;
    let newX = e.clientX - _dragOffsetX;
    let newY = e.clientY - _dragOffsetY;

    // Ekran sınırlarına hapset (isteğe bağlı — kaldırılabilir)
    newX = Math.max(0, Math.min(newX, window.innerWidth  - _el.offsetWidth));
    newY = Math.max(0, Math.min(newY, window.innerHeight - _el.offsetHeight));

    _el.style.left = newX + 'px';
    _el.style.top  = newY + 'px';
    _el.style.right = 'auto';
  }

  function _onMouseUp() {
    if (!_isDragging) return;
    _isDragging = false;
    if (_el) _el.style.cursor = '';
    const tb = document.getElementById('floating-panel-titlebar');
    if (tb) tb.style.cursor = 'grab';
  }

  function show() {
    if (!_el) _el = _createEl();
    _el.style.display = 'flex';
    _visible = true;
    _syncContent();
  }

  function hide() {
    if (_el) _el.style.display = 'none';
    _visible = false;
  }

  function toggle() {
    _visible ? hide() : show();
  }

  // Ana panelin içeriğini kopyala (veya EventBus ile sync et)
  function _syncContent() {
    const source = document.getElementById('dp-signals-tab');
    const dest   = document.getElementById('floating-panel-content');
    if (!source || !dest) return;

    // Derin kopyalama — event listener'lar kopyalanmaz, delegation çalışmaz
    // Bu yüzden content'i iframe değil doğrudan mirror edeceğiz:
    // BotSignalsPanel.render() floating modda da çalışmalı.
    // Bunun için BotSignalsPanel'e ikincil bir container desteği eklenecek (aşağıya bak).
    dest.innerHTML = source.innerHTML;
  }

  // EventBus'tan her render'da sync et
  function onPanelRender() {
    if (_visible) _syncContent();
  }

  return { show, hide, toggle, onPanelRender, syncAll: onPanelRender };
})();

window.FloatingPanel = FloatingPanel;
