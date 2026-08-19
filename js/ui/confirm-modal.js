/**
 * ConfirmModal — merkezde (viewport ortası) açılan, projenin kendi
 * .modal-backdrop/.modal (css/components.css) diline birebir uyan onay
 * penceresi. Native window.confirm() Chrome'da sayfanın EN ÜSTÜNDE bir
 * bar olarak açılıyor (kullanıcı bulgusu, 2026-08-19) — bunun yerine
 * kullanılır. Tüm metinler İngilizce (coding-conventions kuralı).
 */
window.ConfirmModal = (() => {
  function show(message, { title = 'Confirm', confirmLabel = 'Remove', cancelLabel = 'Cancel', danger = true } = {}) {
    return new Promise((resolve) => {
      document.getElementById('confirm-modal-backdrop')?.remove();
      const backdrop = document.createElement('div');
      backdrop.id = 'confirm-modal-backdrop';
      backdrop.className = 'modal-backdrop';
      backdrop.innerHTML = `
        <div class="modal" style="max-width:340px;">
          <div class="modal-header"><span>${title}</span></div>
          <div class="modal-body" style="font-size:12px; color:var(--text-primary);">${message}</div>
          <div class="modal-footer">
            <button class="btn" id="confirm-modal-cancel">${cancelLabel}</button>
            <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" id="confirm-modal-ok">${confirmLabel}</button>
          </div>
        </div>`;
      document.body.appendChild(backdrop);
      const finish = (result) => { backdrop.remove(); resolve(result); };
      backdrop.addEventListener('click', (e) => { if (e.target === backdrop) finish(false); });
      document.getElementById('confirm-modal-cancel').addEventListener('click', () => finish(false));
      document.getElementById('confirm-modal-ok').addEventListener('click', () => finish(true));
      document.getElementById('confirm-modal-ok').focus();
    });
  }
  return { show };
})();
