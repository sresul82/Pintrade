/**
 * MiniFloatingWindow
 * L/S ve OI kartlarındaki popout ikonları için genel amaçlı, sürüklenebilir
 * küçük pencere. İçerik şimdilik yer tutucu — düzenlemesi sonraki bir işte.
 */
const MiniFloatingWindow = (() => {
  const _panels = {}; // id -> { el, contentEl }

  // [2026-08-15, kullanıcı geri bildirimi] Önceden TÜM panellerin ölçüsü tek
  // bir paylaşılan stil bloğundan geliyordu — L/S için "daralt" isteği
  // yanlışlıkla OI/Volume'u da etkiledi, ve OI/Volume'un kendi resize'ı da
  // dış sarmalayıcının (mfw-panel) SABİT genişliği + overflow:hidden'ı
  // yüzünden görünmez/işe yaramaz kalıyordu (içerik resize edilse bile dışarı
  // taşan kısmı kırpılıyordu). Artık her panel kendi genişlik/resize
  // ayarına sahip — biri değişince diğeri ETKİLENMEZ. Yeni bir panel eklenirken
  // buraya kendi satırını ekle.
  const _PANEL_OPTS = {
    ls: { width: 280, height: null, resizable: false },       // içerik kendi boyunu belirler (auto-height)
    oi: { width: 340, height: 400, resizable: true },          // kullanıcı elle büyütüp küçültebilir (hem dikey hem yatay)
  };

  function _createEl(id, title) {
    const opts = _PANEL_OPTS[id] || { width: 280, height: null, resizable: false };
    const div = document.createElement('div');
    div.className = 'mfw-panel';
    div.setAttribute('role', 'dialog');
    div.setAttribute('aria-label', title);
    div.style.cssText = `
      position: fixed;
      top: 90px;
      right: 480px;
      width: ${opts.width}px;
      ${opts.height ? `height: ${opts.height}px;` : 'max-height: 80vh;'}
      ${opts.resizable ? `resize: both; min-width: 260px; min-height: 220px;` : ''}
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
    // [2026-08-15, kullanıcı geri bildirimi] --text-secondary koyu zeminde
    // okunaksızdı — başlık --text-primary'ye çekildi (kapatma ikonu görsel
    // hiyerarşi gereği hâlâ soluk kalabilir, metin değil).
    tb.innerHTML = `
      <span style="font-size:10px;font-weight:600;color:var(--text-primary);letter-spacing:0.5px;">${title}</span>
      <button class="mfw-close" aria-label="Kapat" style="background:transparent;border:none;color:var(--text-secondary);font-size:15px;cursor:pointer;line-height:1;padding:0 2px;">✕</button>
    `;

    const content = document.createElement('div');
    content.className = 'mfw-content';
    if (opts.resizable) {
      // Resize artık DIŞ sarmalayıcıda (div) — içerik sadece kalan alanı
      // dolduruyor. min-height:0 flex sütununda gerekli (yoksa içerik kendi
      // intrinsic boyutunun altına küçülemez, resize küçültme yönünde çalışmaz).
      content.style.cssText = 'flex:1 1 auto; min-height:0; overflow:hidden; padding:0;';
    } else {
      // [2026-08-15, kullanıcı isteği] Sabit height + overflow:auto scrollbar
      // yaratıyordu (L/S 4 karta çıkınca taştı). height:auto — pencere
      // içeriğine göre kendi boyunu alır, hiçbir zaman scroll oluşmaz.
      content.style.cssText = 'flex:0 0 auto; height:auto; overflow:visible; resize:none; padding:14px; font-size:11px; color:var(--text-primary); text-align:center;';
    }
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

  /** Panel içeriğini (HTML) doldurur — henüz açılmamışsa (show() hiç
   *  çağrılmamışsa) paneli önce oluşturur, ama görünür yapmaz. */
  function setContent(id, html, title) {
    if (!_panels[id]) _panels[id] = _createEl(id, title || id);
    _panels[id].contentEl.innerHTML = html;
  }

  function isVisible(id) {
    return !!(_panels[id] && _panels[id].el.style.display !== 'none');
  }

  /** Ham içerik div'ini döner (henüz yoksa oluşturur) — setContent()'in HTML
   *  string'i yerine grafik gibi DOM/canvas kuran çağıranlar için (bkz.
   *  js/screener/oi-volume-panel.js). */
  function getContentEl(id, title) {
    if (!_panels[id]) _panels[id] = _createEl(id, title || id);
    return _panels[id].contentEl;
  }

  return { show, hide, toggle, setContent, isVisible, getContentEl };
})();

window.MiniFloatingWindow = MiniFloatingWindow;
