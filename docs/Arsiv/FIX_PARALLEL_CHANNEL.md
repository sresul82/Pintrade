# GÖREV: Parallel Channel — Float Menü Text Butonu + Settings Penceresi Yeniden Yapılandırması

---

## Proje Bağlamı

- **Proje:** PinTrade V2.4 — Vanilla JS, framework yok
- **Etkilenen dosyalar:** `property-toolbar.js`, `dsd-standard-tabs.js`, `drawing-settings-dialog.js`
- **Araç adı:** `channel` (tool key)
- **Mevcut durum:** `channel` aracı float menüde Text butonu içermiyor. Settings penceresinde ise Extend seçeneği dropdown olarak geliyor ve Background satırı bir checkbox yerine sadece renk picker ile gösteriliyor.

---

## İstenen Değişiklikler (3 Ayrı Madde)

---

### DEĞİŞİKLİK 1 — `property-toolbar.js`: `channel` aracına Text butonu eklenmesi

#### Neden değişiyor?
`drawing_tool_specs.md` Grup 2'ye göre Text desteği olan çizgi araçlarında float menü sıralaması:
**Template → Renk → Text → Genişlik → Stil → Settings → Lock → Trash**

`channel` aracı şu anda `hasText` kontrolü dışında bırakılmış çünkü `hasText` değişkeninin içinde `channel` açıkça hariç tutulmuş.

#### Nerede? `property-toolbar.js` — `_buildToolbar` fonksiyonu içinde yaklaşık 443. satır:

```javascript
// ESKİ:
const hasText = !['vline', 'arrowdraw', 'channel', 'regression', ...].includes(_drawing.tool);
```

```javascript
// YENİ: 'channel' bu listeden çıkarılır
const hasText = !['vline', 'arrowdraw', 'regression', 'flattopbottom', 'pitchfork', 'schiffpitch', 'modschiff', 'insidepitch', 'rotatedrect', 'circle', 'ellipse', 'arrowmarker', 'arrowup', 'arrowdown', 'triangle', 'arc', 'curve', 'doublecurve', 'polyline', 'pathtool', 'trendangle'].includes(_drawing.tool);
```

**Açıklama:** `channel` bu listeden çıkarılınca `hasText` değişkeni `true` olur. `_buildToolbar`'ın `else` bloğunda zaten şu yapı mevcuttur:
```html
<!-- Text Color -->
${hasText ? `
<button id="pt-btn-textcolor" ...>...</button>
` : ''}
```
Bu blok otomatik olarak float menüde Text butonunu gösterecektir. Sıralama zaten doğru: Template → Renk → (hasText ise) Text → Genişlik → Stil → Settings → Lock → Trash.

#### Dikkat
Float menüdeki Text butonu (`pt-btn-textcolor`) `_drawing.style.textColor` alanını günceller. Bu alan `_drawChannel` render fonksiyonunda henüz kullanılmıyor. Bu Değişiklik 3'te ele alınacak.

---

### DEĞİŞİKLİK 2 — `dsd-standard-tabs.js`: `channel` için Settings penceresini yeniden yapılandır

#### Neden değişiyor?
Şu anda `channel` aracı `renderStyleTab` fonksiyonundaki genel `else` bloğuna düşüyor. Orada `caps.extend` true olduğu için Extend satırı gösteriliyor, ama bu satır `dsd-ext-right` / `dsd-ext-left` checkbox'larını bir `EXTEND LINE` section başlığı altında TrendLine ile aynı biçimde render ediyor.

İstenen: Extend bölümü `EXTEND LINE` başlığı altında iki ayrı checkbox olarak kalacak — TrendLine'daki gibi. Ek olarak:

**Resme göre Settings penceresinde olması gerekenler:**

```
[✓] 0        [beyaz ——]        ← Ana çizgi (üst kenar) — checkbox aktif, düzenlenemez
[□] -0.25    [gri  ——]         ← Orta seviye 1 — checkbox pasif, çizgi gri
[□] 0.25     [gri  ----]       ← Orta seviye 2
[□] 0.5      [gri  ----]
[□] 0.75     [gri  ----]
[✓] 1        [beyaz ——]        ← Alt kenar (kanal çizgisi) — checkbox aktif, düzenlenemez

Extend
  [□] Extend right line
  [□] Extend left line

[✓] Background  [renk-picker]
```

Bu yapı **kanal çizgilerinin seviyelerini** yönetiyor: 0 = üst kenar, 1 = alt kenar, aradakiler isteğe bağlı orta çizgiler. Resimde görüldüğü gibi her satırda: aktiflik checkbox'ı + seviye değeri (input) + renk+stil combo.

#### `renderStyleTab` fonksiyonunda yapılacak değişiklik

`renderStyleTab` fonksiyonu içinde, `d.tool === 'rect' || ...` bloğundan **önce** yeni bir `channel`-özel blok eklenir:

```javascript
// ESKİ: (böyle bir blok yok, channel genel else'e düşüyor)
```

```javascript
// YENİ: rect bloğundan hemen önce ekle
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

**Bu blok `if (d.tool === 'rect' || ...)` satırından hemen önce yerleştirilmeli — `return html;` ile bittiği için genel bloğa düşmeyecek.**

---

### DEĞİŞİKLİK 3 — `drawing-settings-dialog.js`: `channel` için `TOOL_CAPS` ve `hasText` güncellenmesi

#### Neden değişiyor?
`channel` aracında Text desteği ekleniyor. `TOOL_CAPS` içinde `hasText: true` eklenmezse Settings penceresinde Text sekmesi görünmez.

#### Nerede? `drawing-settings-dialog.js` — `TOOL_CAPS` objesi içinde `channel` satırı (~86. satır):

```javascript
// ESKİ:
channel: { priceLabel:false, extend:true,  midpoint:false, stats:false, capArrows:false, hasFill:true,  coordsMode:'p2' },
```

```javascript
// YENİ:
channel: { priceLabel:false, extend:false, midpoint:false, stats:false, capArrows:false, hasFill:true, hasText:true, coordsMode:'p2' },
```

**Açıklama:**
- `extend: false` yapıldı — Extend artık channel'a özel blokta `dsd-standard-tabs.js` içinde render ediliyor. `caps.extend` true kalırsa genel `EXTEND LINE` bloğu bir daha render edilir ve çift görünür.
- `hasText: true` eklendi — Settings penceresinde **Text** sekmesini aktif eder.

---

## Özet Tablo

| Dosya | Bölüm | Ne yapılıyor |
|---|---|---|
| `property-toolbar.js` | `hasText` değişkeni | `'channel'` listeden çıkarılır → float menüde Text butonu görünür |
| `dsd-standard-tabs.js` | `renderStyleTab` | `channel` için özel blok eklenir: seviye satırları + Extend checkboxları + Background checkbox |
| `drawing-settings-dialog.js` | `TOOL_CAPS.channel` | `extend: false`, `hasText: true` yapılır |

---

## Kesinlikle Yapılmayacaklar

- `drawing-core.js` dosyasına **dokunulmayacak**
- `drawing-trend.js` içindeki `_drawChannel` fonksiyonuna **dokunulmayacak** (render güncellemesi ayrı bir görev)
- `dsd-apply.js` dosyasına **dokunulmayacak** — mevcut `applyFromForm` fonksiyonu `dsd-ext-right`, `dsd-ext-left`, `dsd-showbg`, `js-fill-color` gibi standart ID/class'ları zaten okuyor
- Diğer araçların (`trendline`, `rect`, `pitchfork` vb.) mevcut davranışlarına **dokunulmayacak**
- `index.html` dosyasına **dokunulmayacak**

---

## Test Adımları

1. Grafik üzerinde **Parallel Channel** aracı çiz ve seç.
2. Float menüde sıralama kontrol edilir: **Template → Renk → Text (T ikonu) → Genişlik → Stil → Settings (dişli) → Lock → Trash**
3. Text butonuna tıklanınca renk seçici açılmalı, seçilen renk `_drawing.style.textColor` alanına yazılmalı.
4. **Settings** (dişli) butonuna tıkla → modal açılır.
5. **Style** sekmesinde seviye satırları (0, 0.25, 0.5, 0.75, 1) görünmeli. 0 ve 1 satırlarının checkbox'ları disabled (gri) olmalı.
6. Orta seviyelerin (0.25, 0.5, 0.75) checkbox'larına tıklanınca aktif/pasif toggle etmeli.
7. **EXTEND** bölümü altında "Extend right line" ve "Extend left line" checkbox'ları görünmeli.
8. **Background** checkbox'ı ve yanındaki renk picker çalışmalı.
9. **Text** sekmesi Settings penceresinde görünmeli ve text girişi çalışmalı.
10. `Ok` ile kapatınca değişiklikler grafiğe yansımalı.
