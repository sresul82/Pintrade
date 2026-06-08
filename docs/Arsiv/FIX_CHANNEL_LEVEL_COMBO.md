# GÖREV: Parallel Channel — Settings Level Satırları Yapısal Düzeltme

---

## Proje Bağlamı

- **Etkilenen dosya:** `js/drawing/ui/dsd-tabs/dsd-standard-tabs.js`
- **Diğer tüm dosyalar — kesinlikle dokunma.**

---

## Sorunun Tam Nedeni

`drawing-settings-dialog.js` içindeki event binding şunu arıyor:

```javascript
overlay.querySelectorAll('.js-ch-level-combo').forEach(combo => { ... })
```

Ama `dsd-standard-tabs.js`'deki channel bloğunda her level satırı şu yapıda:

```html
<div class="dsd-color-swatch js-ch-level-color" ...></div>
<svg ...></svg>
```

Yani `js-ch-level-combo` class'ına sahip bir element **hiç yok** — bu yüzden tıklanınca hiçbir şey açılmıyor.

Ayrıca:
- Level dizisinde `-0.25` ve `1.25` seviyeleri eksik
- 0 ve 1 satırları için checkbox `disabled` olmalı (bunlar zorunlu kenar çizgiler)

---

## Yapılacak Değişiklik — `dsd-standard-tabs.js`

`if (d.tool === 'channel') {` bloğunun tamamını (40. satırdan `return html;`'e kadar) aşağıdakiyle değiştir:

### ESKİ (satır 40–97 arası, tamamı):
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

### YENİ (tamamıyla değiştir):
```javascript
    if (d.tool === 'channel') {
      const defaultLevels = [
        { v: -0.25, active: false, color: '#787b86',             style: 'solid',  width: 1 },
        { v: 0,     active: true,  color: s.color || '#2962ff', style: 'solid',  width: s.width || 1 },
        { v: 0.25,  active: false, color: '#787b86',             style: 'dashed', width: 1 },
        { v: 0.5,   active: false, color: '#787b86',             style: 'dashed', width: 1 },
        { v: 0.75,  active: false, color: '#787b86',             style: 'dashed', width: 1 },
        { v: 1,     active: true,  color: s.color || '#2962ff', style: 'solid',  width: s.width || 1 },
        { v: 1.25,  active: false, color: '#787b86',             style: 'solid',  width: 1 },
      ];
      const channelLevels = s.channelLevels || defaultLevels;

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
            ${isEdge
              ? `<input type="checkbox" class="js-ch-level-active" data-idx="${i}" checked disabled>`
              : `<input type="checkbox" class="js-ch-level-active" data-idx="${i}" ${lvl.active ? 'checked' : ''}>`
            }
            ${lvl.v}
          </label>
          <div class="dsd-row-controls">
            <div class="dsd-line-combo js-ch-level-combo" data-idx="${i}" title="Color, thickness, style" style="cursor:pointer;">
              <div class="dsd-color-swatch js-ch-level-color"
                data-idx="${i}" data-color="${lvl.color}"
                style="background:${lvl.color};"></div>
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

| Sorun | Eski | Yeni |
|---|---|---|
| Combo tıklaması çalışmıyor | `js-ch-level-combo` class'ı yok | `dsd-line-combo js-ch-level-combo` class'lı wrapper div eklendi |
| Combo yapısı | Ayrı swatch + SVG | `dsd-line-combo` içinde swatch + divider + preview — diğer araçlarla aynı |
| Eksik seviyeler | 5 level (0–1 arası) | 7 level: -0.25, 0, 0.25, 0.5, 0.75, 1, 1.25 |
| 0 ve 1 checkbox | Normal checkbox | `disabled` — zorunlu kenar çizgiler |

---

## Kesinlikle Yapılmayacaklar

- `drawing-settings-dialog.js` — dokunma (event binding zaten `js-ch-level-combo` arıyor, bu değişiklikle çalışacak)
- `drawing-core.js` — dokunma
- `drawing-trend.js` — dokunma
- `property-toolbar.js` — dokunma
- Diğer araçların bloklarına dokunma

---

## Test Adımları

1. Grafik üzerinde Parallel Channel seç → Settings → Style sekmesi.
2. 7 level satırı görünmeli: -0.25, 0, 0.25, 0.5, 0.75, 1, 1.25.
3. 0 ve 1 satırlarının checkbox'ları gri/disabled olmalı — tıklanamaz.
4. Herhangi bir level satırının sağındaki combo kutusuna tıklanınca renk/kalınlık/stil popover'ı açılmalı.
5. Popover'dan değer seçince combo içindeki renk ve çizgi preview anında güncellenmeli.
