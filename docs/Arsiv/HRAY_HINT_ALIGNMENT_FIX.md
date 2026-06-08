# PinTrade V2.4 — Add Text Hint & Inline Editör Hizalama Düzeltme Görevi

## Genel Sorun

`hline` ve `hray` araçlarında üç şey birbiriyle uyumsuz:

1. **Metin render** → `textAlignH` ayarını okuyor (doğru)
2. **Add Text hint** → her zaman sabit bir noktaya çiziliyor (`w/2` veya `startX+6`), `textAlignH`'e bakmıyor (yanlış)
3. **`_openTrendlineTextEditor` editör kutusu** → her zaman sabit `anchorX = cvsW / 2` kullanıyor, `textAlignH`'e bakmıyor (yanlış)

Sonuç: Kullanıcı Settings'ten `textAlignH = 'left'` seçse bile hint ortada, editör ortada açılıyor. Üçünün de aynı `textAlignH` bazlı konumu kullanması gerekiyor.

**Kural:** Yalnızca aşağıda belirtilen değişiklikleri yap. Başka hiçbir şeye dokunma.

---

## Değişiklik 1 — `drawing-trend.js`: `_drawHLine` içinde hint ve metin konumunu `textAlignH`'e bağla

`_drawHLine` fonksiyonu içindeki metin render, Add Text hint çizimi ve `_trendTextHintAreas` kaydının tamamını aşağıdaki kodla değiştir.

**Değiştirilecek blok** (yaklaşık satır 127–160, `// Metin` yorumundan `ctx.restore()` öncesine kadar):

```js
// Metin (Settings'ten veya inline editörden)
const hlineText = s.text || '';
const textAlignH = s.textAlignH || 'center';
const textAlignV = s.textAlignV || 'top';

// textAlignH'e göre X konumu hesapla
const endX = w - hlineLabelW;
let textX;
if (textAlignH === 'left')       textX = 6;
else if (textAlignH === 'right') textX = endX - 6;
else                             textX = endX / 2;

// textAlignV'e göre Y offset
let textY, textBaseline;
if (textAlignV === 'bottom')     { textY = y + 5;  textBaseline = 'top'; }
else if (textAlignV === 'middle'){ textY = y;       textBaseline = 'middle'; }
else                             { textY = y - 5;   textBaseline = 'bottom'; }

if (hlineText) {
  ctx.save();
  ctx.font = `${s.bold ? 'bold ' : ''}${s.italic ? 'italic ' : ''}${s.fontSize || 14}px "JetBrains Mono", sans-serif`;
  ctx.fillStyle = s.textColor || '#ffffff';
  ctx.textAlign = textAlignH === 'right' ? 'right' : textAlignH === 'left' ? 'left' : 'center';
  ctx.textBaseline = textBaseline;
  ctx.globalAlpha = 1;
  ctx.fillText(hlineText, textX, textY);
  ctx.restore();
}

// "Add Text" hint (seçili, metin yok)
if (selected && !hlineText) {
  const hintText = 'Add Text';
  ctx.save();
  ctx.font = '12px "JetBrains Mono", sans-serif';
  ctx.fillStyle = s.color || '#2962ff';
  ctx.globalAlpha = 0.6;
  ctx.textAlign = textAlignH === 'right' ? 'right' : textAlignH === 'left' ? 'left' : 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(hintText, textX, y - 5);
  const hintTextW = ctx.measureText(hintText).width;
  ctx.restore();

  if (!window._trendTextHintAreas) window._trendTextHintAreas = {};
  window._trendTextHintAreas[d.id] = { cx: textX, cy: y - 5, hw: hintTextW / 2 + 6, hh: 10, angle: 0 };
} else if (selected && hlineText) {
  ctx.save();
  ctx.font = `${s.fontSize || 14}px "JetBrains Mono", sans-serif`;
  const tw = ctx.measureText(hlineText).width;
  ctx.restore();
  if (!window._trendTextHintAreas) window._trendTextHintAreas = {};
  window._trendTextHintAreas[d.id] = { cx: textX, cy: textY, hw: tw / 2 + 6, hh: 10, angle: 0 };
} else {
  if (window._trendTextHintAreas) delete window._trendTextHintAreas[d.id];
}
```

---

## Değişiklik 2 — `drawing-trend.js`: `_drawHRay` içinde hint konumunu `textAlignH`'e bağla

`_drawHRay` fonksiyonu içindeki Add Text hint ve `_trendTextHintAreas` kaydını aşağıdaki kodla değiştir. Mevcut kodda `selected && !hrayText` bloğu ile `selected && hrayText` bloğu var; bunların tamamını değiştir:

```js
// "Add Text" hint — textAlignH'e göre konum
const textAlignH = s.textAlignH || 'left';
const textAlignV = s.textAlignV || 'top';

let hintX;
if (textAlignH === 'left')       hintX = startX + 6;
else if (textAlignH === 'right') hintX = endX - 6;
else                             hintX = (startX + endX) / 2;

let hintY, hintBaseline;
if (textAlignV === 'bottom')      { hintY = y + 5;  hintBaseline = 'top'; }
else if (textAlignV === 'middle') { hintY = y;       hintBaseline = 'middle'; }
else                              { hintY = y - 5;   hintBaseline = 'bottom'; }

if (selected && !hrayText) {
  const hintText = 'Add Text';
  ctx.save();
  ctx.font = '12px "JetBrains Mono", sans-serif';
  ctx.fillStyle = s.color || '#2962ff';
  ctx.globalAlpha = 0.6;
  ctx.textAlign = textAlignH === 'right' ? 'right' : textAlignH === 'left' ? 'left' : 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(hintText, hintX, y - 5);
  const hintTextW = ctx.measureText(hintText).width;
  ctx.restore();
  if (!window._trendTextHintAreas) window._trendTextHintAreas = {};
  window._trendTextHintAreas[d.id] = { cx: hintX, cy: y - 5, hw: hintTextW / 2 + 6, hh: 10, angle: 0 };
} else if (selected && hrayText) {
  ctx.save();
  ctx.font = `${s.fontSize || 14}px "JetBrains Mono", sans-serif`;
  const tw = ctx.measureText(hrayText).width;
  ctx.restore();
  if (!window._trendTextHintAreas) window._trendTextHintAreas = {};
  window._trendTextHintAreas[d.id] = { cx: hintX, cy: hintY, hw: tw / 2 + 6, hh: 10, angle: 0 };
} else {
  if (window._trendTextHintAreas) delete window._trendTextHintAreas[d.id];
}
```

> **Not:** `hrayText` render kısmı (mevcut `if (hrayText) { ... }` bloğu) dokunmadan kalır. Yalnızca hint kısmı değişiyor.

---

## Değişiklik 3 — `drawing-core.js`: `_openTrendlineTextEditor` içindeki `hline || hray` bloğunu `textAlignH`'e duyarlı yap

`if (d.tool === 'hline' || d.tool === 'hray')` bloğu içinde şu an `anchorX = cvsW / 2` sabit kullanılıyor. Bunu `textAlignH`'e göre hesaplayacak şekilde güncelle.

**Mevcut kod (~satır 1089–1092):**

```js
const cvsW = pane.drawingCanvas.width / (window.devicePixelRatio || 1);
const anchorX = cvsW / 2;
const anchorY = y;
const anchorViewX = canvasRect.left + anchorX;
const anchorViewY = canvasRect.top  + anchorY;
```

**Yeni kod:**

```js
const cvsW = pane.drawingCanvas.width / (window.devicePixelRatio || 1);
const textAlignH = s.textAlignH || (d.tool === 'hray' ? 'left' : 'center');
const textAlignV = s.textAlignV || 'top';

// Price label genişliğini hesapla (çizginin bittiği yer)
let labelW = 0;
if (s.priceLabel !== false) {
  const tmpCtx = pane.drawingCanvas.getContext('2d');
  tmpCtx.font = '10px "JetBrains Mono", sans-serif';
  const priceStr = d.price != null ? d.price.toFixed(2) : '';
  labelW = tmpCtx.measureText(priceStr).width + 18;
}
const lineEndX = cvsW - labelW;

// hray için startX, hline için 0
let lineStartX = 0;
if (d.tool === 'hray') {
  const rawX = pane.chart.timeScale().timeToCoordinate(d.time);
  lineStartX = (rawX != null && isFinite(rawX) && !s.extendLeft) ? rawX : 0;
}

let anchorX;
if (textAlignH === 'left')       anchorX = lineStartX + 6;
else if (textAlignH === 'right') anchorX = lineEndX - 6;
else                             anchorX = (lineStartX + lineEndX) / 2;

// textAlignV'e göre Y
let anchorY, transformY;
if (textAlignV === 'bottom')      { anchorY = y + 5;  transformY = 'translate(-50%, 0%)'; }
else if (textAlignV === 'middle') { anchorY = y;       transformY = 'translate(-50%, -50%)'; }
else                              { anchorY = y - 5;   transformY = 'translate(-50%, -100%)'; }

const anchorViewX = canvasRect.left + anchorX;
const anchorViewY = canvasRect.top  + anchorY;
```

**Aynı blok içinde `transform` satırını da güncelle:**

Mevcut:
```js
transform:       'translate(-50%, -100%)',
```

Yeni:
```js
transform:       transformY,
```

---

## Hangi araçları da kontrol etmen gerekiyor (Ek Görev)

Add Text hint içeren tüm araçlar için hint konumu, metin konumu ve editör açılış konumunun üçünün de `textAlignH`/`textAlignV` ayarına göre hesaplanıp hesaplanmadığını kontrol et:

| Araç | Hint render | Hint area kayıt | Editör anchor |
|---|---|---|---|
| `hline` | ✅ bu promptla düzeltildi | ✅ bu promptla düzeltildi | ✅ bu promptla düzeltildi |
| `hray` | ✅ bu promptla düzeltildi | ✅ bu promptla düzeltildi | ✅ bu promptla düzeltildi |
| `trendline` | ✅ zaten doğru | ✅ zaten doğru | ✅ zaten doğru |
| `ray` | `_drawTrendLine` ile aynı → kontrol et | kontrol et | kontrol et |
| `extended` | `_drawTrendLine` ile aynı → kontrol et | kontrol et | kontrol et |
| `infoline` | ✅ zaten doğru (`_drawChannelText`) | ✅ zaten doğru | kontrol et |
| `channel` | ✅ zaten doğru (`_drawChannelText`) | ✅ zaten doğru | kontrol et |

`ray`, `extended`, `infoline`, `channel` araçları için `_openTrendlineTextEditor` içinde p1/p2 bazlı anchor hesabında `textAlignH` kullanılıp kullanılmadığını kontrol et; `trendline` bloğu ile aynı mantıkta çalışıyorlarsa sorun yok.

---

## Özet

| # | Dosya | Yer | Değişiklik |
|---|---|---|---|
| 1 | `drawing-trend.js` | `_drawHLine` metin/hint bloğu | `textAlignH`/`textAlignV` bazlı `textX`, `textY`, hint konumu |
| 2 | `drawing-trend.js` | `_drawHRay` hint bloğu | `textAlignH`/`textAlignV` bazlı `hintX`, `hintY` |
| 3 | `drawing-core.js` | `_openTrendlineTextEditor` hline/hray bloğu | `anchorX` ve `transformY` `textAlignH`/`textAlignV`'e göre hesaplandı |

Bu üç değişiklik dışında hiçbir şeye dokunma.
