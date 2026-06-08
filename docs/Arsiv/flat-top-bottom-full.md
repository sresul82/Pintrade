# Flat Top/Bottom — Tam Uygulama Talimatı

## Genel Mimari (Mevcut Durum Analizi)

| Dosya | Mevcut Durum | Yapılacak |
|---|---|---|
| `drawing-core.js` | `TWO_PT_TOOLS` listesinde ✅, default stil eksik | Default stil + `THREE_PT_TOOLS`'a taşı |
| `drawing-trend.js` | `_drawFlatTopBottom` var ama yanlış | Tamamen yeniden yaz |
| `drawing-settings-dialog.js` | `TOOL_CAPS` satırı var ama eksik | Caps güncelle |
| `dsd-standard-tabs.js` | `flattopbottom` için özel HTML yok | Özel Style sekmesi ekle |

---

## DEĞİŞİKLİK 1 — `drawing-core.js` : Araç 3 noktalıya taşı + default stil

### 1a. `TWO_PT_TOOLS` listesinden `flattopbottom`'u çıkar

`TWO_PT_TOOLS` listesinde şu parçayı bul:
```
'infoline', 'flattopbottom', 'regression',
```
Bunu şu şekilde değiştir (`flattopbottom` çıkar):
```
'infoline', 'regression',
```

### 1b. `THREE_PT_TOOLS` listesine `flattopbottom`'u ekle

`THREE_PT_TOOLS` listesinde şu parçayı bul:
```
'fib-ext', 'fib-channel', 'fib-timebased',
```
Bunu şu şekilde değiştir (başa `'flattopbottom'` ekle):
```
'flattopbottom', 'fib-ext', 'fib-channel', 'fib-timebased',
```

### 1c. Default stil ekle

`_getToolStyle` fonksiyonunda şu satırı bul:
```js
    if (tool === 'crossline') return { color: '#2962ff', width: 1, lineStyle: 'solid', priceLabel: true, timeLabel: true };
```
Hemen altına şunu ekle:
```js
    if (tool === 'flattopbottom') return { color: '#FF9800', width: 1, lineStyle: 'solid', extend: 'none', showPrices: true, priceColor: '#F44336', priceFontSize: 12, background: true, bgColor: '#FF9800' };
```

---

## DEĞİŞİKLİK 2 — `drawing-trend.js` : `_drawFlatTopBottom` tamamen yeniden yaz

Aşağıdaki bloğun tamamını (başından kapanış `}` dahil) yeni kodla değiştir.

### Eski blok (silinecek — başından sonuna kadar):
```js
  function _drawFlatTopBottom(ctx, d, pane) {
      const a = _pt2xy(d.p1, pane);
      const b = _pt2xy(d.p2, pane);
      if (!a || !b) return;
      const W = pane.drawingCanvas.width / (window.devicePixelRatio || 1);
      const color = d.style?.color || '#2962ff';
  
      // Main slanted line
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  
      // Flat band: horizontal at the "opposite" endpoint price
      const flatPrice = d.p2.price > d.p1.price ? d.p1.price : d.p2.price;
      const flatY = pane.series.priceToCoordinate(flatPrice);
      if (flatY === null) return;
  
      const leftX  = Math.min(a.x, b.x);
      const rightX = Math.max(a.x, b.x);
  
      ctx.save();
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(leftX, flatY); ctx.lineTo(rightX, flatY);
      ctx.stroke();
      ctx.setLineDash([]);
  
      // Thin fill between slant and flat side
      ctx.globalAlpha = 0.07;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
      ctx.lineTo(rightX, flatY); ctx.lineTo(leftX, flatY);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
```

### Yeni blok (yerine yazılacak):
```js
  function _drawFlatTopBottom(ctx, d, pane) {
    try {
      const a = _pt2xy(d.p1, pane);  // sol köşe (flat çizginin başlangıcı)
      const b = _pt2xy(d.p2, pane);  // eğimli çizginin sonu
      if (!a || !b) return;

      const s     = d.style || {};
      const color = s.color || '#FF9800';
      const W     = pane.drawingCanvas.width  / (window.devicePixelRatio || 1);
      const H     = pane.drawingCanvas.height / (window.devicePixelRatio || 1);

      // Dash array
      let dashArr = [];
      if (s.lineStyle === 'dashed') dashArr = [8, 5];
      else if (s.lineStyle === 'dotted') dashArr = [3, 3];

      // p3: yatay çizginin sağ anchor noktası
      // p3 yoksa (henüz çiziliyorsa) fallback: b ile aynı x, a ile aynı y
      let c = d.p3 ? _pt2xy(d.p3, pane) : { x: b.x, y: a.y };
      if (!c) c = { x: b.x, y: a.y };

      // Flat çizgi: a.x → p3.x, yükseklik sabit a.y (p1'in fiyat seviyesi)
      // p3 sadece x konumunu belirler — y koordinatı her zaman p1'in fiyatından gelir
      const flatY    = a.y;
      const flatLeft = a.x;
      const flatRight = c.x;

      // Extend
      const extend   = s.extend || 'none';
      let slantA = { ...a };
      let slantB = { ...b };
      let hLeft  = flatLeft;
      let hRight = flatRight;
      if (extend === 'left'  || extend === 'both') { slantA = _extendToEdge(b.x, b.y, a.x, a.y, W, H); hLeft = 0; }
      if (extend === 'right' || extend === 'both') { slantB = _extendToEdge(a.x, a.y, b.x, b.y, W, H); hRight = W; }

      // ── Background fill ───────────────────────────────
      if (s.background !== false) {
        const bgColor = s.bgColor || color;
        ctx.save();
        ctx.globalAlpha = 0.15;
        ctx.fillStyle = bgColor;
        ctx.beginPath();
        ctx.moveTo(slantA.x, slantA.y);
        ctx.lineTo(slantB.x, slantB.y);
        ctx.lineTo(hRight, flatY);
        ctx.lineTo(hLeft,  flatY);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      // ── Çizgiler ─────────────────────────────────────
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth   = s.width || 1;
      ctx.setLineDash(dashArr);

      // Eğimli çizgi (p1 → p2)
      ctx.beginPath();
      ctx.moveTo(slantA.x, slantA.y);
      ctx.lineTo(slantB.x, slantB.y);
      ctx.stroke();

      // Yatay (flat) çizgi (p1.x → p3.x, p1 fiyat seviyesi)
      ctx.beginPath();
      ctx.moveTo(hLeft,  flatY);
      ctx.lineTo(hRight, flatY);
      ctx.stroke();

      ctx.restore();

      // ── Fiyat etiketleri ─────────────────────────────
      if (s.showPrices !== false) {
        const labelColor = s.priceColor || color;
        // p1 fiyatı (flat çizginin sol ucu — sabit seviye)
        _drawPriceLabel(ctx, d.p1.price, flatY, pane, labelColor);
        // p2 fiyatı (eğimli çizginin sağ ucu)
        const p2y = pane.series.priceToCoordinate(d.p2.price);
        if (p2y != null && isFinite(p2y) && Math.abs(p2y - flatY) > 8) {
          _drawPriceLabel(ctx, d.p2.price, p2y, pane, labelColor);
        }
      }

    } catch(e) { /* render hatası diğer çizimleri etkilemesin */ }
  }
```

---

## DEĞİŞİKLİK 3 — `drawing-settings-dialog.js` : `TOOL_CAPS` güncelle

`TOOL_CAPS` tablosunda şu satırı bul:
```js
    flattopbottom:{ priceLabel:false, extend:false, midpoint:false, stats:false, capArrows:false, hasFill:false, coordsMode:'p2'       },
```
Bunu şu şekilde değiştir (`coordsMode:'p3'`, `hasFlatTopStyle:true`, `hasText:true` eklendi):
```js
    flattopbottom:{ priceLabel:false, extend:false, midpoint:false, stats:false, capArrows:false, hasFill:false, hasText:true, hasFlatTopStyle:true, coordsMode:'p3' },
```

---

## DEĞİŞİKLİK 4 — `dsd-standard-tabs.js` : `renderStyleTab`'a `flattopbottom` bloğu ekle

`renderStyleTab` fonksiyonunun başında `if (d.tool === 'channel')` bloğu var. Bunun **hemen üstüne** yeni bloğu ekle.

Şu parçayı bul:
```js
    if (d.tool === 'channel') {
```
Hemen önüne şu bloğu ekle:
```js
    if (d.tool === 'flattopbottom') {
      const ftColor    = s.color    || '#FF9800';
      const ftWidth    = s.width    || 1;
      const ftExtend   = s.extend   || 'none';
      const showPrices = s.showPrices !== false;
      const priceColor = s.priceColor || '#F44336';
      const showBg     = s.background !== false;
      const bgColor    = s.bgColor    || ftColor;
      const dashAttr   = s.lineStyle === 'dashed' ? 'stroke-dasharray="8,5"'
                       : s.lineStyle === 'dotted' ? 'stroke-dasharray="3,3"' : '';

      return `
      <div class="dsd-row">
        <label class="dsd-label">Line</label>
        <div class="dsd-row-controls">
          <div class="dsd-line-combo" id="dsd-line-combo" title="Color, thickness, style">
            <div class="dsd-color-swatch js-style-color" style="background:${ftColor}" data-color="${ftColor}"></div>
            <div class="dsd-combo-divider"></div>
            <div class="dsd-combo-preview" id="dsd-line-preview">
              <svg width="28" height="16" viewBox="0 0 28 16">
                <path stroke="${ftColor}" stroke-width="${ftWidth}" ${dashAttr} d="M0 8h28"/>
              </svg>
            </div>
          </div>
          <div class="dsd-cap-btn js-cap-btn" data-dir="left"  title="Extend left">
            <svg width="18" height="14" viewBox="0 0 18 14"><path d="M9 7H1m0 0 4-4M1 7l4 4" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>
          </div>
          <div class="dsd-cap-btn js-cap-btn" data-dir="right" title="Extend right">
            <svg width="18" height="14" viewBox="0 0 18 14"><path d="M9 7h8m0 0-4-4m4 4-4 4" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>
          </div>
        </div>
      </div>

      <div class="dsd-row">
        <label class="dsd-label">Extend</label>
        <div class="dsd-custom-select" id="dsd-ftextend-wrap">
          <div class="dsd-custom-select-header" id="dsd-ftextend-header" style="cursor:pointer;">
            <span id="dsd-ftextend-label">${
              ftExtend === 'both'  ? 'Both sides' :
              ftExtend === 'left'  ? 'Left'        :
              ftExtend === 'right' ? 'Right'        : "Don't extend"
            }</span>
            <svg width="10" height="10" viewBox="0 0 10 10"><path d="M2 3.5l3 3 3-3" stroke="currentColor" fill="none" stroke-width="1.5"/></svg>
          </div>
          <div class="dsd-custom-select-body hidden" id="dsd-ftextend-body">
            <div class="dsd-option" data-val="none"  style="padding:6px 8px;cursor:pointer;">Don't extend</div>
            <div class="dsd-option" data-val="left"  style="padding:6px 8px;cursor:pointer;">Left</div>
            <div class="dsd-option" data-val="right" style="padding:6px 8px;cursor:pointer;">Right</div>
            <div class="dsd-option" data-val="both"  style="padding:6px 8px;cursor:pointer;">Both sides</div>
          </div>
        </div>
      </div>

      <div class="dsd-row dsd-row-check">
        <label class="dsd-checkbox-label" style="width:104px; flex-shrink:0;">
          <input type="checkbox" id="dsd-showprices" ${showPrices ? 'checked' : ''}>
          Prices
        </label>
        <div class="dsd-row-controls" style="gap:6px; align-items:center;">
          <div class="dsd-color-swatch js-price-color" style="background:${priceColor}" data-color="${priceColor}" title="Price label color"></div>
          <select class="dsd-select dsd-select-sm" id="dsd-pricefontsize" style="width:62px;">
            ${[8,10,11,12,13,14,16,18,20].map(sz =>
              `<option value="${sz}" ${(s.priceFontSize||12)==sz?'selected':''}>${sz}</option>`
            ).join('')}
          </select>
          <button class="dsd-fmt-btn ${s.priceBold?'active':''}"   id="dsd-pricebold"   title="Bold"><b>B</b></button>
          <button class="dsd-fmt-btn ${s.priceItalic?'active':''}" id="dsd-priceitalic" title="Italic"><i>I</i></button>
        </div>
      </div>

      <div class="dsd-row dsd-row-check">
        <label class="dsd-checkbox-label" style="width:104px; flex-shrink:0;">
          <input type="checkbox" id="dsd-ftbg" ${showBg ? 'checked' : ''}>
          Background
        </label>
        <div class="dsd-row-controls">
          <div class="dsd-color-swatch js-ftbg-color" style="background:${bgColor}" data-color="${bgColor}" title="Background color"></div>
        </div>
      </div>
      `;
    }

```

---

## DEĞİŞİKLİK 5 — `drawing-settings-dialog.js` : Yeni style alanları için event listener'lar ekle

`_wireEvents` (veya `wireOverlayEvents`) fonksiyonunda `showBgCb` event listener bloğunun **hemen altına** şu bloğu ekle:

```js
    // ── Flat Top/Bottom özel alanları ────────────────────
    // Prices checkbox
    const showPricesCb = overlay.querySelector('#dsd-showprices');
    if (showPricesCb) {
      showPricesCb.addEventListener('change', () => {
        drawing.style.showPrices = showPricesCb.checked;
        EventBus.emit('drawing:settings:saved');
      });
    }

    // Price label rengi
    overlay.querySelectorAll('.dsd-color-swatch.js-price-color').forEach(sw => {
      sw.addEventListener('click', e => {
        e.stopPropagation();
        DSDColorPicker.showColorPalette(sw, sw.dataset.color || '#F44336', newColor => {
          sw.style.background = newColor;
          sw.dataset.color = newColor;
          drawing.style.priceColor = newColor;
          EventBus.emit('drawing:settings:saved');
        });
      });
    });

    // Price font size
    const priceFsEl = overlay.querySelector('#dsd-pricefontsize');
    if (priceFsEl) {
      priceFsEl.addEventListener('change', () => {
        drawing.style.priceFontSize = parseInt(priceFsEl.value, 10);
        EventBus.emit('drawing:settings:saved');
      });
    }

    // Price bold / italic
    const priceBoldBtn = overlay.querySelector('#dsd-pricebold');
    if (priceBoldBtn) {
      priceBoldBtn.addEventListener('click', () => {
        drawing.style.priceBold = !drawing.style.priceBold;
        priceBoldBtn.classList.toggle('active', !!drawing.style.priceBold);
        EventBus.emit('drawing:settings:saved');
      });
    }
    const priceItalicBtn = overlay.querySelector('#dsd-priceitalic');
    if (priceItalicBtn) {
      priceItalicBtn.addEventListener('click', () => {
        drawing.style.priceItalic = !drawing.style.priceItalic;
        priceItalicBtn.classList.toggle('active', !!drawing.style.priceItalic);
        EventBus.emit('drawing:settings:saved');
      });
    }

    // Background checkbox (flat top/bottom)
    const ftBgCb = overlay.querySelector('#dsd-ftbg');
    if (ftBgCb) {
      ftBgCb.addEventListener('change', () => {
        drawing.style.background = ftBgCb.checked;
        EventBus.emit('drawing:settings:saved');
      });
    }

    // Background rengi (flat top/bottom)
    overlay.querySelectorAll('.dsd-color-swatch.js-ftbg-color').forEach(sw => {
      sw.addEventListener('click', e => {
        e.stopPropagation();
        DSDColorPicker.showColorPalette(sw, sw.dataset.color || '#FF9800', newColor => {
          sw.style.background = newColor;
          sw.dataset.color = newColor;
          drawing.style.bgColor = newColor;
          EventBus.emit('drawing:settings:saved');
        });
      });
    });

    // Extend dropdown (flat top/bottom)
    const ftExtHeader = overlay.querySelector('#dsd-ftextend-header');
    const ftExtBody   = overlay.querySelector('#dsd-ftextend-body');
    if (ftExtHeader && ftExtBody) {
      ftExtHeader.addEventListener('click', () => ftExtBody.classList.toggle('hidden'));
      ftExtBody.querySelectorAll('.dsd-option').forEach(opt => {
        opt.addEventListener('click', () => {
          drawing.style.extend = opt.dataset.val;
          overlay.querySelector('#dsd-ftextend-label').textContent = opt.textContent.trim();
          ftExtBody.classList.add('hidden');
          EventBus.emit('drawing:settings:saved');
        });
      });
    }
    // ── /Flat Top/Bottom ─────────────────────────────────
```

---

## Özet — Hangi Dosyada Ne Değişti

| # | Dosya | Değişiklik Türü |
|---|---|---|
| 1a | `drawing-core.js` | `TWO_PT_TOOLS`'dan `'flattopbottom'` çıkar |
| 1b | `drawing-core.js` | `THREE_PT_TOOLS`'a `'flattopbottom'` ekle |
| 1c | `drawing-core.js` | `_getToolStyle`'a default stil satırı ekle |
| 2  | `drawing-trend.js` | `_drawFlatTopBottom` tamamen yeniden yazıldı |
| 3  | `drawing-settings-dialog.js` | `TOOL_CAPS`'taki `flattopbottom` satırını güncelle |
| 4  | `dsd-standard-tabs.js` | `renderStyleTab`'a `flattopbottom` özel HTML bloğu ekle |
| 5  | `drawing-settings-dialog.js` | Event listener'lar ekle |

> **Liste uyarısı:** 1a ve 1b değişikliklerinde tam satır verilmedi; "şu parçayı bul → şunu ekle/çıkar" yöntemi kullanıldı.
