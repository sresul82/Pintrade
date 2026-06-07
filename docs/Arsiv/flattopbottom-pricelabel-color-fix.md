# Color Bug Fix — flattopbottom & pricelabel

---

## Dosya: `js/drawing/ui/property-toolbar.js`

### Fix 1 — flattopbottom: Line color değişince background rengi de değişiyor

**Sebep:** `pt-btn-color` onclick handler'ında `else` branchi `s.color`'ı günceller. `drawing-core.js`'teki default'a bakılırsa `bgColor` başlangıçta `s.color` ile aynı (`#FF9800`). Kullanıcı bg'yi hiç değiştirmediyse ikisi eşit kalır, dolayısıyla line rengi değişince bg de birlikte değişiyor gibi görünür — aslında `bgColor` değişmiyor, sadece `s.color`'a bağlı render kodu var. Bağımsız çalışmaları için `pt-btn-color` handler'ında flattopbottom için `bgColor`'a **dokunulmamalı**, zaten dokunulmuyor — ama `dsd-apply.js`'te Settings'ten OK basınca `s.color` swatch'ı `js-combined-line` class'lı swatch'tan okunuyor ve bu swatch `bgColor`'u da override ediyor olabilir. Asıl sorun `dsd-standard-tabs.js`'te flattopbottom için line swatch class'ı `js-combined-line` olarak işaretlenmiş; `drawing-settings-dialog.js`'te bu class'a bağlı combined picker hem `s.color`'ı hem `s.bgColor`'ı aynı anda güncelliyor olabilir.

**Kontrol edilecek yer:** `drawing-settings-dialog.js` içinde `js-combined-line` class'ını handle eden blok. Aşağıdaki fix bu dosyada.

---

### Fix 2 — pricelabel: Flyout fillColor default `'transparent'`, chart'ta `'#2962ff'`

**Sebep:** `drawing-core.js` line 43: `pricelabel` default → `fillColor: '#2962ff'`. Ama toolbar render'da (line ~654): `s.fillColor || 'transparent'`. Ve `pt-btn-fillcolor` handler'ında (line ~914-916): `s.fillColor || 'rgba(0,0,0,0)'`. `s.fillColor` initialize edilmeden önce toolbar açılırsa picker `rgba(0,0,0,0)` ile açılır, chart `#2962ff` çizer.

**Mevcut (satır ~654):**
```js
<div id="pt-fill-color-bar" style="width:16px;height:4px;border-radius:1px;margin-top:1px;background:${s.fillColor || 'transparent'};"></div>
```

**Yeni:**
```js
<div id="pt-fill-color-bar" style="width:16px;height:4px;border-radius:1px;margin-top:1px;background:${s.fillColor || (_drawing.tool === 'pricelabel' ? '#2962ff' : 'transparent')};"></div>
```

---

**Mevcut (satır ~914-916):**
```js
        const curFill = _drawing.tool === 'texttool' || ['note', 'pricenote', 'tableanno', 'callout', 'pricelabel'].includes(_drawing.tool)
          ? (_drawing.style?.fillColor || 'rgba(0,0,0,0)')
          : (_drawing.tool === 'flagmark' ? (_drawing.style?.color || '#2962ff') : (_drawing.style?.fillColor || 'rgba(9, 105, 218, 0.2)'));
```

**Yeni:**
```js
        const curFill = _drawing.tool === 'texttool' || ['note', 'pricenote', 'tableanno', 'callout'].includes(_drawing.tool)
          ? (_drawing.style?.fillColor || 'rgba(0,0,0,0)')
          : _drawing.tool === 'pricelabel'
            ? (_drawing.style?.fillColor || '#2962ff')
            : (_drawing.tool === 'flagmark' ? (_drawing.style?.color || '#2962ff') : (_drawing.style?.fillColor || 'rgba(9, 105, 218, 0.2)'));
```

---

## Dosya: `js/drawing/ui/drawing-settings-dialog.js`

### Fix 3 — flattopbottom: Settings'ten OK basınca line rengi bgColor'u override ediyor

`js-combined-line` class'lı swatch'a tıklandığında açılan combined picker, hem `s.color` hem `s.bgColor`'u aynı anda güncelliyor. flattopbottom'da bu davranış yanlış — line ve background bağımsız olmalı.

**`drawing-settings-dialog.js` dosyasında `js-combined-line` handler'ını bul.** Görünüm şuna benzer:

```js
overlay.querySelectorAll('.js-combined-line').forEach(swatch => {
  swatch.addEventListener('click', ...
    // picker callback içinde:
    swatch.style.background = newColor;
    swatch.dataset.color = newColor;
    // preview svg güncelleme
    // SORUN: bgColor da burada güncelleniyor veya
    // apply sırasında js-style-color + js-combined-line aynı swatch olduğu için
    // hem color hem bgColor yazılıyor
  });
});
```

**Bulunduğunda:** callback içinde `flattopbottom` tool için `bgColor`'u güncelleme satırını kaldır ya da `if (drawing.tool !== 'flattopbottom')` koşuluna al.

> **Not:** `drawing-settings-dialog.js` paylaşılmadı, exact satır numarası verilemedi. Dosyayı paylaşırsan kesin satır yazılır.

---

## Dosya: `js/drawing/ui/dsd-apply.js`

### Fix 4 — flattopbottom: Settings OK'da tüm alanlar yazılmıyor

`applyFromForm` içinde flattopbottom'a özgü hiçbir alan okunmuyor. Aşağıdaki bloğu ekle.

**Yerleştirme:** `const midlineSwatch = ...` satırından hemen sonra (yaklaşık satır 44):

```js
    // ── FlatTopBottom specific apply ────────────────────────────────
    if (drawing.tool === 'flattopbottom') {
      const ftBgCb = get('dsd-ftbg');
      if (ftBgCb) s.background = ftBgCb.checked;

      const ftBgSwatch = overlay.querySelector('.js-ftbg-color');
      if (ftBgSwatch && ftBgSwatch.dataset.color) s.bgColor = ftBgSwatch.dataset.color;

      const ftShowPricesCb = get('dsd-showprices');
      if (ftShowPricesCb) s.showPrices = ftShowPricesCb.checked;

      const ftPriceSwatch = overlay.querySelector('.js-price-color');
      if (ftPriceSwatch && ftPriceSwatch.dataset.color) s.priceColor = ftPriceSwatch.dataset.color;

      const ftPriceBoldBtn = get('dsd-pricebold');
      if (ftPriceBoldBtn) s.priceBold = ftPriceBoldBtn.classList.contains('active');

      const ftPriceItalicBtn = get('dsd-priceitalic');
      if (ftPriceItalicBtn) s.priceItalic = ftPriceItalicBtn.classList.contains('active');

      const ftPriceFsEl = get('dsd-pricefontsize');
      if (ftPriceFsEl) s.priceFontSize = parseInt(ftPriceFsEl.value);
    }
```

**Önemli:** `js-ftbg-color` swatch'ı `dsd-standard-tabs.js`'te `data-color="${bgColor}"` olarak render ediliyor (hex değer). `bgOpacity` ayrı tutulduğu için burada `bgOpacity`'ye dokunmuyoruz — opacity sadece `pt-btn-bgcolor` handler'ı üzerinden (flyout) değiştirilmeli.

---

## Dosya: `js/drawing/ui/dsd-standard-tabs.js`

### Fix 5 — flattopbottom: `js-style-color` ve `js-combined-line` class'larını ayır

`renderStyleTab` içinde flattopbottom line swatch'ı şu an şöyle:

```js
<div class="dsd-color-swatch js-style-color js-combined-line"
```

`js-combined-line` class'ı `drawing-settings-dialog.js`'te combined picker (renk + kalınlık + stil) açmak için kullanılıyor ve muhtemelen `bgColor`'u da güncelliyor. flattopbottom'da line swatch'ından `bgColor` güncellenmemeli.

**Mevcut:**
```js
        <div class="dsd-color-swatch js-style-color js-combined-line"
             style="background:${ftColor}; width:24px; height:24px; border-radius:4px; cursor:pointer;"
             data-color="${ftColor}" title="Color, thickness, style"></div>
```

**Yeni:**
```js
        <div class="dsd-color-swatch js-style-color js-ftb-line-combo"
             style="background:${ftColor}; width:24px; height:24px; border-radius:4px; cursor:pointer;"
             data-color="${ftColor}" title="Color, thickness, style"></div>
```

Sonra `drawing-settings-dialog.js`'te `js-ftb-line-combo` için ayrı bir handler ekle — `js-combined-line` ile aynı combined picker davranışını ver ama callback'te sadece `s.color`'ı güncelle, `s.bgColor`'a dokunma.

> **Not:** `drawing-settings-dialog.js` paylaşılmadığı için handler kodu verilemedi. Dosyayı paylaşırsan tamamlanır.
