/**
 * DSD Volume Profile Tabs
 * Fixed Range / Anchored Volume Profile araçları icin sekme render fonksiyonları.
 * gorevler: Forecast & Measurement Faz 3 (2026-08-28) — alan adları ve
 * varsayılanlar gerçek TV ayarlar penceresinden (kullanıcı login oldu,
 * canlı hesapta doğrulandı) birebir okundu: Rows Layout/Row Size/Volume/
 * Value Area Volume (Inputs), Width%/Placement/Up-Down renkleri/POC/VAH/VAL
 * (Style). "Value Area Up/Down" ayrı renk çiftı TV'de var ama burada
 * BİLİNÇLİ olarak basitleştirildi — Value Area dışı satırlar aynı renklerin
 * düşük opaklıklı hali olarak çiziliyor (bkz. drawing-forecast.js:_drawVolumeProfile),
 * 4 yerine 2 renk alanı yeterli görüldü. "Values"/"Developing POC"/
 * "Developing VA"/"Histogram Box" TV'de var ama ikincil/nadir kullanılan
 * özellikler — bu turda BİLİNÇLİ olarak atlandı (kapsam netleşmesi).
 */
window.DSDVolProfTabs = (() => {

  const row = (label, controlHtml) => `
    <div class="dsd-row" style="margin-bottom:12px;">
      <label class="dsd-label" style="width:120px;">${label}</label>
      <div class="dsd-row-controls" style="flex:1;">${controlHtml}</div>
    </div>`;

  const swatchRow = (label, id, cls, color) => `
    <div class="dsd-row" style="margin-bottom:12px; align-items:center;">
      <label class="dsd-label" style="width:120px;">${label}</label>
      <div class="dsd-color-swatch ${cls}" id="${id}" style="background:${color}" data-color="${color}"></div>
    </div>`;

  const checkRow = (id, label, checked) => `
    <div class="dsd-row" style="margin-bottom:8px;">
      <label class="dsd-checkbox-label">
        <input type="checkbox" id="${id}" ${checked ? 'checked' : ''}> ${label}
      </label>
    </div>`;

  function renderVolProfInputsTab(d) {
    const s = d.style || {};
    const rowsMode = s.rowsMode || 'rows';
    const rowSize = s.rowSize != null ? s.rowSize : 24;
    const volumeMode = s.volumeMode || 'updown';
    const vaPct = s.valueAreaPct != null ? s.valueAreaPct : 70;
    const isFixed = d.tool === 'fixedvolprof';

    return `
      ${row('Rows Layout', `
        <select class="dsd-select" id="dsd-vp-rowsmode" style="width:100%;">
          <option value="rows" ${rowsMode === 'rows' ? 'selected' : ''}>Number of Rows</option>
          <option value="ticks" ${rowsMode === 'ticks' ? 'selected' : ''}>Ticks Per Row</option>
        </select>`)}
      ${row('Row Size', `<input type="number" class="dsd-input" id="dsd-vp-rowsize" min="1" step="1" value="${rowSize}"/>`)}
      ${row('Volume', `
        <select class="dsd-select" id="dsd-vp-volmode" style="width:100%;">
          <option value="updown" ${volumeMode === 'updown' ? 'selected' : ''}>Up/Down</option>
          <option value="total"  ${volumeMode === 'total'  ? 'selected' : ''}>Total</option>
          <option value="delta"  ${volumeMode === 'delta'  ? 'selected' : ''}>Delta</option>
        </select>`)}
      ${row('Value Area Volume', `<input type="number" class="dsd-input" id="dsd-vp-vapct" min="1" max="100" step="1" value="${vaPct}"/>`)}
      ${isFixed ? checkRow('dsd-vp-extendright', 'Extend Right', s.extendRight === true) : ''}
    `;
  }

  function renderVolProfStyleTab(d) {
    const s = d.style || {};
    const upColor = s.upColor || '#089981';
    const downColor = s.downColor || '#f23645';
    const pocColor = s.pocColor || '#d1d4dc';
    const vahColor = s.vahColor || '#787b86';
    const valColor = s.valColor || '#787b86';
    const widthPct = s.widthPct != null ? s.widthPct : 30;
    const placement = s.placement || 'left';

    return `
      ${checkRow('dsd-vp-showbars', 'Volume profile', s.showBars !== false)}
      ${row('Width (% of box)', `<input type="number" class="dsd-input" id="dsd-vp-width" min="1" max="100" step="1" value="${widthPct}"/>`)}
      ${row('Placement', `
        <select class="dsd-select" id="dsd-vp-placement" style="width:100%;">
          <option value="left"  ${placement === 'left'  ? 'selected' : ''}>Left</option>
          <option value="right" ${placement === 'right' ? 'selected' : ''}>Right</option>
        </select>`)}
      ${swatchRow('Up Volume', 'dsd-vp-up', 'js-vp-up', upColor)}
      ${swatchRow('Down Volume', 'dsd-vp-down', 'js-vp-down', downColor)}
      <div class="dsd-section-title" style="margin:10px 0 6px; font-size:10px; text-transform:uppercase; color:var(--text-muted);">Levels</div>
      <div class="dsd-row" style="margin-bottom:12px; align-items:center; gap:8px;">
        <input type="checkbox" id="dsd-vp-showpoc" ${s.showPOC !== false ? 'checked' : ''} style="width:14px;height:14px;cursor:pointer;accent-color:#2962ff;flex-shrink:0;"/>
        <label class="dsd-label" style="width:104px;">POC</label>
        <div class="dsd-color-swatch js-vp-poc" id="dsd-vp-poc" style="background:${pocColor}" data-color="${pocColor}"></div>
      </div>
      <div class="dsd-row" style="margin-bottom:12px; align-items:center; gap:8px;">
        <input type="checkbox" id="dsd-vp-showvah" ${s.showVAH === true ? 'checked' : ''} style="width:14px;height:14px;cursor:pointer;accent-color:#2962ff;flex-shrink:0;"/>
        <label class="dsd-label" style="width:104px;">VAH</label>
        <div class="dsd-color-swatch js-vp-vah" id="dsd-vp-vah" style="background:${vahColor}" data-color="${vahColor}"></div>
      </div>
      <div class="dsd-row" style="margin-bottom:12px; align-items:center; gap:8px;">
        <input type="checkbox" id="dsd-vp-showval" ${s.showVAL === true ? 'checked' : ''} style="width:14px;height:14px;cursor:pointer;accent-color:#2962ff;flex-shrink:0;"/>
        <label class="dsd-label" style="width:104px;">VAL</label>
        <div class="dsd-color-swatch js-vp-val" id="dsd-vp-val" style="background:${valColor}" data-color="${valColor}"></div>
      </div>
    `;
  }

  return { renderVolProfInputsTab, renderVolProfStyleTab };
})();
