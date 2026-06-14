/**
 * FloatingPanel
 * Bot Signals içeriğini sürüklenebilir bir overlay penceresinde gösterir.
 * Floating açıkken Detail Panel dp-signals-tab kilitlenir.
 */
const FloatingPanel = (() => {
  let _el          = null;
  let _isDragging  = false;
  let _dragOffsetX = 0;
  let _dragOffsetY = 0;
  let _visible     = false;
  let _fpContent   = null; // floating içerik container'ı

  const PANEL_WIDTH = 420;

  function _createEl() {
    const div = document.createElement('div');
    div.id = 'floating-detail-panel';
    div.setAttribute('role', 'dialog');
    div.setAttribute('aria-label', 'Taşınabilir Bot Signals Paneli');
    div.style.cssText = `
      position: fixed;
      top: 60px;
      right: 448px;
      width: ${PANEL_WIDTH}px;
      max-height: calc(100vh - 80px);
      display: flex;
      flex-direction: column;
      background: var(--bg-primary);
      border: 1px solid var(--border-primary);
      border-radius: 8px;
      box-shadow: 0 12px 40px rgba(0,0,0,0.55);
      z-index: 9990;
      overflow: hidden;
      user-select: none;
    `;

    // Titlebar
    const tb = document.createElement('div');
    tb.id = 'fp-titlebar';
    tb.style.cssText = `
      display:flex; align-items:center; justify-content:space-between;
      padding:7px 10px; background:var(--bg-secondary);
      border-bottom:1px solid var(--border-primary);
      cursor:grab; flex-shrink:0;
    `;
    tb.innerHTML = `
      <span style="font-size:10px;font-weight:600;color:var(--text-secondary);letter-spacing:0.5px;">
        ⠿ &nbsp;BOT SIGNALS
      </span>
      <button id="fp-close" aria-label="Kapat" style="
        background:transparent;border:none;color:var(--text-secondary);
        font-size:15px;cursor:pointer;line-height:1;padding:0 2px;
      ">✕</button>
    `;

    // İçerik alanı — BotSignalsPanel buraya render edecek
    const content = document.createElement('div');
    content.id = 'fp-signals-content';
    content.style.cssText = 'flex:1; overflow-y:auto; overflow-x:hidden;';

    div.appendChild(tb);
    div.appendChild(content);
    document.body.appendChild(div);

    _fpContent = content;

    // Kapat butonu
    document.getElementById('fp-close').addEventListener('click', hide);

    // Drag
    tb.addEventListener('mousedown', e => {
      if (e.target.id === 'fp-close') return;
      _isDragging = true;
      const r = div.getBoundingClientRect();
      _dragOffsetX = e.clientX - r.left;
      _dragOffsetY = e.clientY - r.top;
      tb.style.cursor = 'grabbing';
      e.preventDefault();
    });
    document.addEventListener('mousemove', e => {
      if (!_isDragging) return;
      let x = Math.max(0, Math.min(e.clientX - _dragOffsetX, window.innerWidth  - div.offsetWidth));
      let y = Math.max(0, Math.min(e.clientY - _dragOffsetY, window.innerHeight - div.offsetHeight));
      div.style.left  = x + 'px';
      div.style.top   = y + 'px';
      div.style.right = 'auto';
    });
    document.addEventListener('mouseup', () => {
      if (!_isDragging) return;
      _isDragging = false;
      tb.style.cursor = 'grab';
    });

    return div;
  }

  function _lockDetailPanel() {
    const signalsTab = document.getElementById('dp-signals-tab');
    if (signalsTab) {
      signalsTab.style.opacity       = '0.35';
      signalsTab.style.pointerEvents = 'none';
      signalsTab.style.userSelect    = 'none';
    }
    // Floating açık ikeni detail tab butonunu da soluklaştır
    const detailPopout = document.getElementById('detail-popout');
    if (detailPopout) detailPopout.style.opacity = '0.5';
  }

  function _unlockDetailPanel() {
    const signalsTab = document.getElementById('dp-signals-tab');
    if (signalsTab) {
      signalsTab.style.opacity       = '';
      signalsTab.style.pointerEvents = '';
      signalsTab.style.userSelect    = '';
    }
    const detailPopout = document.getElementById('detail-popout');
    if (detailPopout) detailPopout.style.opacity = '';
  }

  function show() {
    if (!_el) _el = _createEl();
    _el.style.display = 'flex';
    _visible = true;

    // Detail panel'i kilitle
    _lockDetailPanel();

    // BotSignalsPanel'e floating container'ı bildir → oraya render eder
    if (window.BotSignalsPanel?.addContainer) {
      BotSignalsPanel.addContainer(_fpContent);
    }
  }

  function hide() {
    if (_el) _el.style.display = 'none';
    _visible = false;

    // Detail panel kilidini aç
    _unlockDetailPanel();

    // BotSignalsPanel'den floating container'ı çıkar
    if (window.BotSignalsPanel?.removeContainer && _fpContent) {
      BotSignalsPanel.removeContainer(_fpContent);
    }

    // Detail panel'i tekrar render et
    if (window.BotSignalsPanel) BotSignalsPanel.render();
  }

  function toggle() { _visible ? hide() : show(); }

  // Geriye dönük uyumluluk
  function onPanelRender() {}
  function syncAll() {}

  return { show, hide, toggle, onPanelRender, syncAll };
})();

window.FloatingPanel = FloatingPanel;
