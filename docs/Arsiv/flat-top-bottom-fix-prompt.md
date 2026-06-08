# Flat Top/Bottom — Property Toolbar Background & Text Butonları (`property-toolbar.js`)

## Değişiklik 1 — `hasText` listesinden `flattopbottom`'u çıkar

Satır ~443:

```js
// Mevcut:
const hasText = !['arrowdraw', 'regression', 'flattopbottom', 'rotatedrect', ...].includes(_drawing.tool);

// Yeni (flattopbottom listeden çıkarıldı):
const hasText = !['arrowdraw', 'regression', 'rotatedrect', 'circle', 'ellipse', 'arrowmarker', 'arrowup', 'arrowdown', 'triangle', 'arc', 'curve', 'doublecurve', 'polyline', 'pathtool', 'trendangle', 'crossline'].includes(_drawing.tool);
```

---

## Değişiklik 2 — `else` bloğuna `flattopbottom` için Background butonu ekle

`else` bloğundaki `<!-- Fill Color -->` kısmı `hasFill` ile kontrol ediliyor — `flattopbottom` orada yok.
`<!-- Text Color -->` kısmı ise artık `hasText` ile görünecek (Değişiklik 1 sonrası).

`<!-- Fill Color -->` bloğundan hemen **sonra**, `<!-- Text Color -->` bloğundan **önce** ekle:

```js
        <!-- Background Color (flattopbottom) -->
        ${_drawing.tool === 'flattopbottom' ? `
        <button id="pt-btn-bgcolor" class="pt-btn pt-btn-color" title="Background color">
          ${paintBucketSvg}
          <div id="pt-bg-color-bar" style="width:16px;height:4px;border-radius:1px;margin-top:1px;background:${s.bgColor || s.color || '#FF9800'};opacity:${(s.bgOpacity ?? 15) / 100};"></div>
        </button>
        ` : ''}
```

---

## Değişiklik 3 — `pt-btn-bgcolor` event handler ekle

`btnTextColor` handler bloğundan **sonra** ekle:

```js
    const btnBgColor = _panel.querySelector('#pt-btn-bgcolor');
    if (btnBgColor) {
      btnBgColor.onclick = e => {
        if (_openMenu && _openMenu.dataset.srcBtn === 'bgcolor') {
          _closeAllMenus();
          return;
        }
        const btn = e.currentTarget;
        const s = _drawing.style || {};
        const curOpacity = s.bgOpacity ?? 15;
        const curColor   = s.bgColor || s.color || '#FF9800';
        _openColorMenu(btn, curColor, (newColor, newOpacity) => {
          _drawing.style = _drawing.style || {};
          _drawing.style.bgColor   = newColor;
          if (newOpacity !== undefined) _drawing.style.bgOpacity = newOpacity;
          const bar = _panel.querySelector('#pt-bg-color-bar');
          if (bar) {
            bar.style.background = newColor;
            bar.style.opacity = (_drawing.style.bgOpacity ?? 15) / 100;
          }
          _redraw();
        }, { opacity: curOpacity });
        if (_openMenu) _openMenu.dataset.srcBtn = 'bgcolor';
      };
    }
```

---

## Değişiklik 4 — `pt-btn-textcolor` handler'ını `flattopbottom` için güncelle

Mevcut `btnTextColor` handler'ında renk `drawing.style.textColor`'a kaydediliyor.
`flattopbottom` text label için de `s.textColor` kullanıldığından bu handler zaten çalışır — ekstra değişiklik gerekmez.

Sadece `curColor` satırını şöyle güncelle (fallback ekle):

```js
// Mevcut:
const curColor = s.textColor || '#d1d4dc';

// Yeni:
const curColor = s.textColor || (_drawing.tool === 'flattopbottom' ? '#d1d4dc' : '#d1d4dc');
```

*(Bu satır aslında değişmiyor — sadece flattopbottom'un da aynı handler'ı kullandığını teyit et.)*

---

## Özet

| Değişiklik | Etki |
|---|---|
| `hasText` listesinden `flattopbottom` çıkar | Text renk butonu toolbar'da görünür |
| `pt-btn-bgcolor` HTML ekle | Background renk butonu toolbar'da görünür |
| `pt-btn-bgcolor` event handler ekle | Tıklayınca `bgColor`/`bgOpacity` güncellenir, çizim yeniden çizilir |

Sadece `property-toolbar.js` değişir.
