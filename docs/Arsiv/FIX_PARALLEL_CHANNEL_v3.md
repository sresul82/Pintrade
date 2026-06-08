# GÖREV: Parallel Channel — Settings Style Sekmesi Görsel Yeniden Yapılandırması

---

## Proje Bağlamı

- **Proje:** PinTrade V2.4 — Vanilla JS, framework yok
- **Etkilenen dosya:** `js/drawing/ui/dsd-tabs/dsd-standard-tabs.js`
- **Diğer tüm dosyalar (`property-toolbar.js`, `drawing-settings-dialog.js`, `drawing-core.js`, `drawing-trend.js`, `dsd-apply.js`) — kesinlikle dokunma.**

---

## Sorunun Tam Nedeni

`dsd-standard-tabs.js` içindeki `renderStyleTab` fonksiyonunda `channel` bloğu mevcut ama görsel düzen TradingView standardına uymuyor:

1. Her level satırındaki renk kutusu ve çizgi stili SVG'si ayrı ayrı duruyor — diğer araçlardaki gibi `dsd-line-combo` çerçevesi içinde birleştirilmemiş.
2. Background renk swatchi sola yapışık — sağa kaymalı ve üst satırdaki `dsd-row-controls` bloğunun hizasında olmalı.

---

## Referans: Mevcut Proje Standardı (Rect aracından)

Projedeki diğer araçlarda her çizgi satırı şu yapıyı kullanıyor:

```html
<div class="dsd-row">
  <label class="dsd-label">Border</label>
  <div class="dsd-row-controls">
    <div class="dsd-line-combo" id="dsd-line-combo" title="Color, thickness, style">
      <div class="dsd-color-swatch js-style-color" style="background:${color}" data-color="${color}"></div>
      <div class="dsd-combo-divider"></div>
      <div class="dsd-combo-preview" id="dsd-line-preview">
        <svg width="28" height="16" viewBox="0 0 28 16">
          <path stroke="${color}" stroke-width="${width}" d="M0 8h28"/>
        </svg>
      </div>
    </div>
  </div>
</div>
```

Background satırı şu yapıyı kullanıyor:
```html
<div class="dsd-row dsd-row-check">
  <label class="dsd-checkbox-label" style="width:104px; flex-shrink:0;">
    <input type="checkbox" id="dsd-showbg" ${showBg?'checked':''}> Background
  </label>
  <div class="dsd-row-controls">
    <div class="dsd-color-swatch js-fill-color" style="background:${fillColor}" data-color="${fillColor}" title="Fill color"></div>
  </div>
</div>
```

---

## Yapılacak Değişiklik — `dsd-standard-tabs.js`

`renderStyleTab` fonksiyonundaki `if (d.tool === 'channel') { ... return html; }` bloğunun tamamını aşağıdaki ile değiştir:

### ESKİ (tüm channel bloğu — satır 40'tan `return html;`'e kadar):
```javascript
if (d.tool === 'channel') {
  const channelLevels = s.channelLevels || [
    { v: 0,     active: true,  color: s.color || '#2962ff', style: 'solid',  width: s.width || 1 },
    { v: 0.25,  active: false, color: '#787b86',             style: 'dashed', width: 1 },
    { v: 0.5,   active: false, color: '#787b86',             style: 'dashed', width: 1 },
    { v: 0.75,  active: false, color: '#787b86',             style: 'dashed', width: 1 },
    { v: 1,     active: true,  color: s.color || '#2962ff', style: 'solid',  width: s.width || 1 },
  ];

  const extRight = s.extendRight !== undefined ? !!s.extendRight : false;
  const extLeft  = s.extendLeft  !== undefined ? !!s.extendLeft  : false;
  const showBg   = s.showBg !== false;
  const fillColor = s.fillColor || 'rgba(9,105,218,0.2)';

  const levelsHtml = channelLevels.map((lvl, i) => {
    const isEdge = (lvl.v === 0 || lvl.v === 1);
    const dashAttr = lvl.style === 'dashed' ? 'stroke-dasharray="8,5"' : lvl.style === 'dotted' ? 'stroke-dasharray="3,3"' : '';
    return `
    <div class="dsd-row dsd-row-inline" style="gap:8px; align-items:center; margin-bottom:4px;">
      <input type="checkbox" class="js-ch-level-active" data-idx="${i}" ${lvl.active ? 'checked' : ''} ${isEdge ? 'disabled' : ''} style="flex-shrink:0;">
      <input type="number" class="dsd-input js-ch-level-val" data-idx="${i}" value="${lvl.v}" step="0.05" style="width:64px; ${!lvl.active && !isEdge ? 'opacity:0.4;' : ''}">
      <div class="dsd-color-swatch js-ch-level-color" data-idx="${i}" data-color="${lvl.color}" style="background:${lvl.color}; width:24px; height:24px; border-radius:4px; cursor:pointer; flex-shrink:0;"></div>
      <svg width="28" height="10" viewBox="0 0 28 10" style="flex-shrink:0;${!lvl.active && !isEdge ? 'opacity:0.4;' : ''}">
        <line x1="0" y1="5" x2="28" y2="5" stroke="${lvl.color}" stroke-width="${lvl.width}" ${dashAttr}/>
      </svg>
    </div>`;
  }).join('');

  html += `
  ${levelsHtml}

  <div class="dsd-section-label" style="margin-top:12px;">EXTEND</div>
  <div class="dsd-row dsd-row-check">
    <label class="dsd-checkbox-label">
      <input type="checkbox" id="dsd-ext-right" ${extRight ? 'checked' : ''}>
      Extend right line
    </label>
  </div>
  <div class="dsd-row dsd-row-check">
    <label class="dsd-checkbox-label">
      <input type="checkbox" id="dsd-ext-left" ${extLeft ? 'checked' : ''}>
      Extend left line
    </label>
  </div>

  <div class="dsd-row dsd-row-check" style="margin-top:8px;">
    <label class="dsd-checkbox-label" style="width:104px; flex-shrink:0;">
      <input type="checkbox" id="dsd-showbg" ${showBg ? 'checked' : ''}>
      Background
    </label>
    <div class="dsd-row-controls">
      <div class="dsd-color-swatch js-fill-color" style="background:${fillColor}" data-color="${fillColor}" title="Fill color"></div>
    </div>
  </div>
  `;

  return html;
}
```

### YENİ (tüm channel bloğunu bununla değiştir):
```javascript
if (d.tool === 'channel') {
  const channelLevels = s.channelLevels || [
    { v: 0,    active: true,  color: s.color || '#2962ff', style: 'solid',  width: s.width || 1 },
    { v: 0.25, active: false, color: '#787b86',             style: 'dashed', width: 1 },
    { v: 0.5,  active: false, color: '#787b86',             style: 'dashed', width: 1 },
    { v: 0.75, active: false, color: '#787b86',             style: 'dashed', width: 1 },
    { v: 1,    active: true,  color: s.color || '#2962ff', style: 'solid',  width: s.width || 1 },
  ];

  const extRight  = s.extendRight !== undefined ? !!s.extendRight : false;
  const extLeft   = s.extendLeft  !== undefined ? !!s.extendLeft  : false;
  const showBg    = s.showBg !== false;
  const fillColor = s.fillColor || 'rgba(9,105,218,0.2)';

  const levelsHtml = channelLevels.map((lvl, i) => {
    const isEdge   = (lvl.v === 0 || lvl.v === 1);
    const dashAttr = lvl.style === 'dashed' ? 'stroke-dasharray="8,5"'
                   : lvl.style === 'dotted' ? 'stroke-dasharray="3,3"' : '';
    const dimStyle = (!lvl.active && !isEdge) ? 'opacity:0.4;' : '';
    return `
    <div class="dsd-row dsd-row-check" style="${dimStyle}">
      <label class="dsd-checkbox-label" style="width:104px; flex-shrink:0;">
        <input type="checkbox" class="js-ch-level-active" data-idx="${i}"
          ${lvl.active ? 'checked' : ''} ${isEdge ? 'disabled' : ''}>
        ${lvl.v}
      </label>
      <div class="dsd-row-controls">
        <div class="dsd-line-combo" title="Color, thickness, style">
          <div class="dsd-color-swatch js-ch-level-color"
            data-idx="${i}" data-color="${lvl.color}"
            style="background:${lvl.color}; cursor:pointer;"></div>
          <div class="dsd-combo-divider"></div>
          <div class="dsd-combo-preview">
            <svg width="28" height="16" viewBox="0 0 28 16">
              <path stroke="${lvl.color}" stroke-width="${lvl.width}" ${dashAttr} d="M0 8h28"/>
            </svg>
          </div>
        </div>
      </div>
    </div>`;
  }).join('');

  html += `
  ${levelsHtml}

  <div class="dsd-section-label">EXTEND LINE</div>
  <div class="dsd-row dsd-row-check">
    <label class="dsd-checkbox-label">
      <input type="checkbox" id="dsd-ext-right" ${extRight ? 'checked' : ''}>
      Extend right line
    </label>
  </div>
  <div class="dsd-row dsd-row-check">
    <label class="dsd-checkbox-label">
      <input type="checkbox" id="dsd-ext-left" ${extLeft ? 'checked' : ''}>
      Extend left line
    </label>
  </div>

  <div class="dsd-row dsd-row-check">
    <label class="dsd-checkbox-label" style="width:104px; flex-shrink:0;">
      <input type="checkbox" id="dsd-showbg" ${showBg ? 'checked' : ''}>
      Background
    </label>
    <div class="dsd-row-controls">
      <div class="dsd-color-swatch js-fill-color"
        style="background:${fillColor}" data-color="${fillColor}" title="Fill color"></div>
    </div>
  </div>
  `;

  return html;
}
```

---

## Özet: Ne Değişti

| Alan | Eski | Yeni |
|---|---|---|
| Level satırları | Checkbox + input + swatch + SVG ayrı ayrı | `dsd-row-check` + `dsd-line-combo` çerçevesi içinde swatch + divider + SVG — diğer araçlarla aynı |
| Level label | Sadece sayı inputu | Checkbox label içinde sayı metni (`width:104px`) |
| Background | Sol yapışık swatch | `dsd-row-controls` içinde sağa hizalı — üst satırlarla aynı hizada |
| Extend başlığı | `EXTEND` | `EXTEND LINE` — TrendLine ile tutarlı |

---

## Kesinlikle Yapılmayacaklar

- `property-toolbar.js` — dokunma
- `drawing-settings-dialog.js` — dokunma
- `drawing-core.js` — dokunma
- `drawing-trend.js` — dokunma
- `dsd-apply.js` — dokunma
- Diğer araçların (`rect`, `trendline` vb.) mevcut bloklarına dokunma

---

## Test Adımları

1. Parallel Channel seç → Settings aç → Style sekmesi.
2. Her level satırı: **checkbox + sayı** solda, **renk kutusu + divider + çizgi preview** sağda tek çerçeve içinde görünmeli.
3. 0 ve 1 satırlarının checkbox'ları disabled (gri, tıklanamaz) olmalı.
4. Background satırı: checkbox solda, renk kutusu sağda — üst satırlarla aynı sağ hizada.
5. EXTEND LINE başlığı altında iki checkbox görünmeli.
