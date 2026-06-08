# Flat Top/Bottom — Renk & Opacity Senkron Düzeltmesi (`property-toolbar.js`)

## Kök Sorunlar

1. `_openColorMenu` 3 parametre alıyor `(anchorEl, currentColor, onSelect)` — 4. parametre gönderilse de kullanılmıyor, başlangıç opacity'si hiç okunmuyor
2. `onSelect` callback'i tek string `rgba(r,g,b,a)` döndürüyor — `btnBgColor` handler `(newColor, newOpacity)` olarak iki parametre bekliyor ama gelmiyor
3. `curColor` olarak sadece hex gönderiliyor — `_parseColor` hex görünce opacity'yi 100% yapıyor

---

## Düzeltme 1 — `btnBgColor` onclick handler (`property-toolbar.js`)

`curColor`'ı hex yerine `rgba` string olarak oluştur, böylece `_parseColor` opacity'yi doğru okusun.
Callback'ten gelen `rgba` string'i parse edip `bgColor` (hex) ve `bgOpacity` (int) olarak ayır.

### Mevcut `btnBgColor` onclick bloğunu tamamen şununla değiştir:

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

        // Mevcut bgColor + bgOpacity'yi rgba string olarak birleştir
        // _parseColor rgba string'i görünce opacity'yi doğru okur
        const curOpacity = s.bgOpacity ?? 15;
        const curHex     = s.bgColor || s.color || '#FF9800';
        const {r, g, b}  = _hexToRgb(curHex);
        const curColor   = `rgba(${r},${g},${b},${curOpacity / 100})`;

        _openColorMenu(btn, curColor, newColor => {
          _drawing.style = _drawing.style || {};

          // Gelen rgba string'i hex + opacity int'e ayır
          if (newColor.startsWith('rgba') || newColor.startsWith('rgb')) {
            const m = newColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
            if (m) {
              _drawing.style.bgColor   = '#' + (+m[1]).toString(16).padStart(2,'0')
                                             + (+m[2]).toString(16).padStart(2,'0')
                                             + (+m[3]).toString(16).padStart(2,'0');
              _drawing.style.bgOpacity = m[4] != null ? Math.round(parseFloat(m[4]) * 100) : 100;
            }
          } else {
            _drawing.style.bgColor   = newColor;
            _drawing.style.bgOpacity = 100;
          }

          // Bar görselini güncelle
          const bar = _panel.querySelector('#pt-bg-color-bar');
          if (bar) {
            bar.style.background = _drawing.style.bgColor;
            bar.style.opacity    = _drawing.style.bgOpacity / 100;
          }
          _redraw();
        });
        if (_openMenu) _openMenu.dataset.srcBtn = 'bgcolor';
      };
    }
```

---

## Düzeltme 2 — `pt-bg-color-bar` başlangıç rengi HTML'de düzelt

`flattopbottom` toolbar HTML'inde background renk bar'ı:

### Mevcut:
```js
<div id="pt-bg-color-bar" style="...; background:${s.bgColor || s.color || '#FF9800'}; opacity:${(s.bgOpacity ?? 15) / 100};"></div>
```

Bu zaten doğru — değişiklik yok.

---

## Düzeltme 3 — Default style'da opacity tutarlılığı (`drawing-core.js`)

Default `bgOpacity: 15` zaten var. Senkron sorunun kaynağı toolbar handler'daki rgba dönüşümüydü (Düzeltme 1 ile çözüldü).

Settings dialog da `bgOpacity`'yi `drawing.style.bgOpacity` olarak kaydediyor — aynı key. Toolbar da aynı key'i kullandığından ikisi artık senkron olacak.

**`drawing-core.js`'de değişiklik gerekmez.**

---

## Özet

| Dosya | Değişen yer |
|---|---|
| `property-toolbar.js` | `btnBgColor` onclick: `curColor`'ı rgba string yap, callback'ten gelen rgba'yı hex+int'e parse et |

Settings dialog değişmez. Drawing-core değişmez.
