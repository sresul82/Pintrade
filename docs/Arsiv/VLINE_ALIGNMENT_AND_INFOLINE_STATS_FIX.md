# PinTrade V2.4 — VLine Metin Hizalama Mantığı ve InfoLine Stats Default Düzeltmesi

## Kural
Yalnızca aşağıda belirtilen satırları değiştir. Başka hiçbir şeye dokunma.

---

## Sorun 1 — `dsd-standard-tabs.js`: InfoLine `statsOn` ve `alwaysStats` checkbox'larının default'u

Settings açıldığında `s.statsOn` ve `s.alwaysStats` henüz `undefined` olabilir.
`s.statsOn === true` strict karşılaştırması `undefined` için `false` döner → checkbox işaretsiz görünür.

**1a — `alwaysStats` değişken tanımını bul ve değiştir:**

```js
// Mevcut:
const alwaysStats = !!s.alwaysStats;

// Yeni:
const alwaysStats = s.alwaysStats !== false;
```

**1b — `statsOn` checkbox koşulunu değiştir:**

```js
// Mevcut:
<input type="checkbox" id="dsd-stats-on" ${s.statsOn === true ? 'checked' : ''}>

// Yeni:
<input type="checkbox" id="dsd-stats-on" ${s.statsOn !== false ? 'checked' : ''}>
```

**Sonuç:** `undefined` iken her iki checkbox da işaretli gelir (default açık). Kullanıcı kapattıysa (`false`) işaretsiz kalır.

---

## Sorun 2 — `drawing-trend.js`: `_drawVLine` içindeki metin koordinat mantığı

VLine **dikey** bir çizgidir. Metin koordinat mantığı şöyle olmalı:

- `textAlignH` (`left` / `center` / `right`) → metnin çizgiye göre **yatay konumu**: solunda mı, üzerinde mi (x ekseni üstünde ortalanmış), sağında mı
- `textAlignV` (`top` / `middle` / `bottom`) → metnin çizgi **boyunca dikey konumu**: yukarı mı, orta mı, aşağı mı

Mevcut kodda `textAlignH = 'left'` iken `tx = x + 6` yapılıyor — bu çizginin **sağına** koyuyor, oysa `left` çizginin **soluna** koymalı. Aynı şekilde `right` iken `tx = x - 6` yapılıyor — bu da soluna koyuyor, oysa sağına koymalı. Mantık ters.

Ayrıca default `|| 'left'` → `|| 'center'` ve default `textOrientation` `'vertical'` olmalı.

**Mevcut blok (`_drawVLine` içinde, `const vlineText = s.text || '';` ile başlayıp `ctx.restore();` ile biten kısım):**

```js
        const vlineText = s.text || '';
        if (vlineText) {
          const textAlignH = s.textAlignH || 'left';
          const textAlignV = s.textAlignV || 'top';
          const orientation = s.textOrientation || 'horizontal';
          ctx.save();
          ctx.font = `${s.bold ? 'bold ' : ''}${s.italic ? 'italic ' : ''}${s.fontSize || 14}px "JetBrains Mono", sans-serif`;
          ctx.fillStyle = s.textColor || '#ffffff';
          ctx.globalAlpha = 1;
          let tx, ty;
          if (textAlignH === 'left')        tx = x + 6;
          else if (textAlignH === 'center') tx = x;
          else if (textAlignH === 'right')  tx = x - 6;
          const rowH = (s.fontSize || 14) + 4;
          if (textAlignV === 'top')         ty = 10;
          else if (textAlignV === 'middle') ty = textBaseH / 2;
          else if (textAlignV === 'bottom') ty = textBaseH - rowH;
          if (orientation === 'vertical') {
            ctx.translate(tx, ty);
            ctx.rotate(-Math.PI / 2);
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(vlineText, 0, 0);
          } else {
            ctx.textAlign = textAlignH === 'right' ? 'right' : textAlignH === 'center' ? 'center' : 'left';
            ctx.textBaseline = 'top';
            ctx.fillText(vlineText, tx, ty);
          }
          ctx.restore();
        }
```

**Yeni blok:**

```js
        const vlineText = s.text || '';
        if (vlineText) {
          const textAlignH  = s.textAlignH    || 'center';
          const textAlignV  = s.textAlignV    || 'top';
          const orientation = s.textOrientation || 'vertical';
          const fontSize    = s.fontSize || 14;
          const rowH        = fontSize + 4;
          ctx.save();
          ctx.font      = `${s.bold ? 'bold ' : ''}${s.italic ? 'italic ' : ''}${fontSize}px "JetBrains Mono", sans-serif`;
          ctx.fillStyle = s.textColor || '#ffffff';
          ctx.globalAlpha = 1;

          // textAlignH → çizginin solunda / üzerinde / sağında
          let tx, canvasTextAlign;
          if      (textAlignH === 'left')  { tx = x - 6; canvasTextAlign = 'right';  }
          else if (textAlignH === 'right') { tx = x + 6; canvasTextAlign = 'left';   }
          else                             { tx = x;      canvasTextAlign = 'center'; }

          // textAlignV → çizgi boyunca yukarı / orta / aşağı
          let ty;
          if      (textAlignV === 'top')    ty = 10;
          else if (textAlignV === 'bottom') ty = textBaseH - rowH;
          else                              ty = textBaseH / 2;

          if (orientation === 'vertical') {
            ctx.translate(tx, ty);
            ctx.rotate(-Math.PI / 2);
            ctx.textAlign    = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(vlineText, 0, 0);
          } else {
            ctx.textAlign    = canvasTextAlign;
            ctx.textBaseline = 'top';
            ctx.fillText(vlineText, tx, ty);
          }
          ctx.restore();
        }
```

**Değişen mantık özeti:**

| Ayar | Eski (yanlış) | Yeni (doğru) |
|---|---|---|
| `textAlignH = 'left'`   | `tx = x + 6` → çizginin sağına | `tx = x - 6`, `textAlign = 'right'` → çizginin soluna |
| `textAlignH = 'center'` | `tx = x` → ortalanmış | `tx = x`, `textAlign = 'center'` → ortalanmış ✅ |
| `textAlignH = 'right'`  | `tx = x - 6` → çizginin soluna | `tx = x + 6`, `textAlign = 'left'` → çizginin sağına |
| default `textAlignH`    | `'left'` | `'center'` |
| default `textOrientation` | `'horizontal'` | `'vertical'` |

---

## Sorun 3 — `dsd-standard-tabs.js`: VLine Settings'teki default text orientation `vertical` olmalı

**Mevcut:**
```js
<option value="horizontal" ${(s.textOrientation||'horizontal')==='horizontal'?'selected':''}>Horizontal</option>
<option value="vertical"   ${s.textOrientation==='vertical'?'selected':''}>Vertical</option>
```

**Yeni:**
```js
<option value="horizontal" ${s.textOrientation==='horizontal'                       ?'selected':''}>Horizontal</option>
<option value="vertical"   ${(s.textOrientation==='vertical' || !s.textOrientation) ?'selected':''}>Vertical</option>
```

---

## Özet

| # | Dosya | Yer | Değişiklik |
|---|---|---|---|
| 1a | `dsd-standard-tabs.js` | `const alwaysStats = !!s.alwaysStats;` | `s.alwaysStats !== false` yapıldı |
| 1b | `dsd-standard-tabs.js` | `statsOn` checkbox | `=== true` → `!== false` yapıldı |
| 2  | `drawing-trend.js` | `_drawVLine` metin bloğu | `textAlignH` yön mantığı düzeltildi, default `center` / `vertical` yapıldı |
| 3  | `dsd-standard-tabs.js` | `textOrientation` select | Default `vertical` yapıldı |

**Bu dört değişiklik dışında hiçbir şeye dokunma.**
