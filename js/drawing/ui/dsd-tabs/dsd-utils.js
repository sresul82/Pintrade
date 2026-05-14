/**
 * DSD Utils
 * Ortak yardımcı fonksiyonlar
 */
window.DSDUtils = (() => {

function formatTime(t) {
    if (t == null || t === '') return '';
    if (typeof t === 'object' && t.year) {
      return `${t.year}-${String(t.month).padStart(2, '0')}-${String(t.day).padStart(2, '0')}`;
    }
    return String(t);
  }

function getStep(val, precision) {
    if (typeof precision === 'number' && precision >= 0) {
      return parseFloat(Math.pow(10, -precision).toFixed(precision));
    }
    if (typeof val !== 'number') {
      val = parseFloat(val);
      if (isNaN(val)) return 'any';
    }
    const s = val.toString();
    if (!s.includes('.')) return '1';
    return Math.pow(10, -(s.split('.')[1].length)).toFixed(s.split('.')[1].length);
  }

function fmtPrice(val, precision) {
    if (typeof val !== 'number') return val;
    if (typeof precision === 'number' && precision >= 0) return val.toFixed(precision);
    return parseFloat(val.toPrecision(8)).toString();
  }

function makeDraggable(el, handle) {
    handle.style.cursor = 'move';
    handle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      const startX = e.clientX - el.offsetLeft;
      const startY = e.clientY - el.offsetTop;
      el.style.position = 'fixed';
      const move = (ev) => {
        // Clamp so dialog can never go above the top of viewport or off screen edges
        const newLeft = ev.clientX - startX;
        const newTop  = ev.clientY - startY;
        const maxLeft = window.innerWidth  - el.offsetWidth  - 4;
        const maxTop  = window.innerHeight - el.offsetHeight - 4;
        el.style.left = Math.max(50, Math.min(newLeft, maxLeft)) + 'px';
        el.style.top  = Math.max(40, Math.min(newTop,  maxTop))  + 'px';
      };
      const up = () => {
        document.removeEventListener('mousemove', move);
        document.removeEventListener('mouseup', up);
        try {
          localStorage.setItem('dsd_dialog_pos', JSON.stringify({ left: el.offsetLeft, top: el.offsetTop }));
        } catch(e) {}
      };
      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup', up);
    });
  }

function showToast(msg) {
    const t = document.createElement('div');
    t.className = 'dsd-toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2500);
  }

  return {
    formatTime,
    getStep,
    fmtPrice,
    makeDraggable,
    showToast
  };
})();
