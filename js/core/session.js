/* --- session.js --- */
// ── session.js ───────────────────────────────────────────────────
// Saves and restores the full application state to/from localStorage.
// Stored keys:
//   pt_layout    →  "1" | "1+1" | "1+1+1" | "2x2"
//   pt_theme     →  "dark" | "light"       (already used by app.js)
//   pt_panes     →  JSON array of pane state objects
//
// Each pane state:
//   { idx, symbol, tf, chartType, scaleMode, priceSide,
//     showGrid, showVolume, invertScale }
//
// Usage:
//   Session.save(layoutKey, panesArray)
//   Session.load()  → { layoutKey, panes[] }

const SESSION_KEY_LAYOUT = 'pt_layout';
const SESSION_KEY_PANES  = 'pt_panes';

const Session = {

  // ── Save current state ────────────────────────────────────
  save(layoutKey, panes) {
    try {
      localStorage.setItem(SESSION_KEY_LAYOUT, layoutKey);
      const states = panes.map(p => p.getState ? p.getState() : p);
      localStorage.setItem(SESSION_KEY_PANES, JSON.stringify(states));
    } catch (e) {
      console.warn('[Session] save failed:', e);
    }
  },

  // ── Load saved state ──────────────────────────────────────
  load() {
    try {
      const layoutKey = localStorage.getItem(SESSION_KEY_LAYOUT) || '1';
      const raw       = localStorage.getItem(SESSION_KEY_PANES);
      const panes     = raw ? JSON.parse(raw) : [];
      return { layoutKey, panes };
    } catch (e) {
      console.warn('[Session] load failed:', e);
      return { layoutKey: '1', panes: [] };
    }
  },

  // ── Clear all session data ────────────────────────────────
  clear() {
    localStorage.removeItem(SESSION_KEY_LAYOUT);
    localStorage.removeItem(SESSION_KEY_PANES);
  },
};

/* --- line-picker.js --- */
const TV_PALETTE = [
  // Row 1: Grayscale
  ['#ffffff','#e1e3e6','#c1c4cd','#a3a6af','#787b86','#5d606b','#434651','#2a2e39','#1e222d','#131722','#000000'],
  // Row 2: Base Colors
  ['#f23645','#ff9800','#ffeb3b','#4caf50','#089981','#00bcd4','#2962ff','#311b92','#9c27b0','#e91e63','#f8bbd0'],
  // Row 3: Lightest
  ['#fcccd0','#ffe0b2','#fff9c4','#c8e6c9','#b2dfdb','#b2ebf2','#bbdefb','#d1c4e9','#e1bee7','#f48fb1','#fce4ec'],
  // Row 4: Lighter
  ['#ef5350','#ffa726','#ffee58','#66bb6a','#26a69a','#26c6da','#42a5f5','#7e57c2','#ab47bc','#ec407a','#f06292'],
  // Row 5: Darker
  ['#e53935','#f57c00','#fbc02d','#43a047','#00897b','#00acc1','#1e88e5','#5e35b1','#8e24aa','#d81b60','#e91e63'],
  // Row 6: Darkest
  ['#b71c1c','#e65100','#f57f17','#1b5e20','#004d40','#006064','#0d47a1','#311b92','#4a148c','#880e4f','#ad1457']
];

const NEON_PALETTE = [
  '#39ff14','#ccff00','#df00ff','#00ffff','#ff0000','#5c4033','#00e5ff','#ffaa00','#2962ff'
];

const CUSTOM_PALETTE = [];

/**
 * Helper to build the trigger button
 */
function buildLineToolBtn(key, color, thickness = 1, style = 'solid', isLineMode = true) {
  // SVG drawing based on style
  let svg = '';
  if (isLineMode) {
    const strokeDash = style === 'dashed' ? 'stroke-dasharray="4,4"' : style === 'dotted' ? 'stroke-dasharray="2,2"' : '';
    svg = `<svg width="20" height="20" viewBox="0 0 20 20" style="margin-left:4px; opacity:0.8"><line x1="2" y1="10" x2="18" y2="10" stroke="#d1d4dc" stroke-width="${thickness}" ${strokeDash}/></svg>`;
  }
  
  return `
    <div class="tv-linetool-btn" data-key="${key}" data-type="linetool" data-color="${color}" data-thickness="${thickness}" data-style="${style}" data-linemode="${isLineMode}" style="display:flex; align-items:center; justify-content:center; cursor:pointer; border:1px solid #363c4e; border-radius:4px; ${isLineMode ? 'padding:3px 4px;' : 'width:24px; height:24px;'}">
      <div class="tv-linetool-color-preview" style="${isLineMode ? 'width:14px; height:14px;' : 'width:18px; height:18px;'} background:${color}; border-radius:3px;"></div>
      ${svg}
    </div>
  `;
}

// Global popover management
let currentPopover = null;
