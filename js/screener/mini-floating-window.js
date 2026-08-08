/**
 * MiniFloatingWindow
 * L/S ve OI kartlarındaki popout ikonları için genel amaçlı, sürüklenebilir
 * küçük pencere. İçerik şimdilik yer tutucu — düzenlemesi sonraki bir işte.
 */
const MiniFloatingWindow = (() => {
  const _panels = {}; // id -> { el, contentEl }

  function _createEl(id, title) {
    const div = document.createElement('div');
    div.className = 'mfw-panel';
    div.setAttribute('role', 'dialog');
    div.setAttribute('aria-label', title);
    div.style.cssText = `
      position: fixed;
      top: 90px;
      right: 480px;
      width: 320px;
      max-height: 360px;
      display: flex;
      flex-direction: column;
      background: var(--bg-primary);
      border: 1px solid var(--border-primary);
      border-radius: 8px;
      box-shadow: 0 12px 40px rgba(0,0,0,0.55);
      z-index: 9985;
      overflow: hidden;
      user-select: none;
    `;

    const tb = document.createElement('div');
    tb.style.cssText = `
      display:flex; align-items:center; justify-content:space-between;
      padding:7px 10px; background:var(--bg-secondary);
      border-bottom:1px solid var(--border-primary);
      cursor:grab; flex-shrink:0;
    `;
    tb.innerHTML = `
      <span style="font-size:10px;font-weight:600;color:var(--text-secondary);letter-spacing:0.5px;">${title}</span>
      <button class="mfw-close" aria-label="Kapat" style="background:transparent;border:none;color:var(--text-secondary);font-size:15px;cursor:pointer;line-height:1;padding:0 2px;">✕</button>
    `;

    const content = document.createElement('div');
    content.className = 'mfw-content';
    content.style.cssText = 'flex:1; overflow:auto; padding:16px; font-size:11px; color:var(--text-secondary); text-align:center;';
    content.textContent = 'İçerik yakında eklenecek...';

    div.appendChild(tb);
    div.appendChild(content);
    document.body.appendChild(div);

    tb.querySelector('.mfw-close').addEventListener('click', () => hide(id));

    let dragging = false, offX = 0, offY = 0;
    tb.addEventListener('mousedown', e => {
      if (e.target.classList.contains('mfw-close')) return;
      dragging = true;
      const r = div.getBoundingClientRect();
      offX = e.clientX - r.left;
      offY = e.clientY - r.top;
      tb.style.cursor = 'grabbing';
      e.preventDefault();
    });
    document.addEventListener('mousemove', e => {
      if (!dragging) return;
      const x = Math.max(0, Math.min(e.clientX - offX, window.innerWidth - div.offsetWidth));
      const y = Math.max(0, Math.min(e.clientY - offY, window.innerHeight - div.offsetHeight));
      div.style.left = x + 'px';
      div.style.top = y + 'px';
      div.style.right = 'auto';
    });
    document.addEventListener('mouseup', () => {
      if (!dragging) return;
      dragging = false;
      tb.style.cursor = 'grab';
    });

    return { el: div, contentEl: content };
  }

  function show(id, title) {
    if (!_panels[id]) _panels[id] = _createEl(id, title);
    _panels[id].el.style.display = 'flex';
  }

  function hide(id) {
    if (_panels[id]) _panels[id].el.style.display = 'none';
  }

  function toggle(id, title) {
    const p = _panels[id];
    const isOpen = p && p.el.style.display !== 'none';
    if (isOpen) hide(id); else show(id, title);
  }

  return { show, hide, toggle };
})();

window.MiniFloatingWindow = MiniFloatingWindow;
