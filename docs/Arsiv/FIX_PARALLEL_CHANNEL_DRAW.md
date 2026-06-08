# GÖREV: Parallel Channel — 3 Noktalı Çizim, Anchor'lar, Cursor'lar, Level Render

---

## Proje Bağlamı

- **Proje:** PinTrade V2.4 — Vanilla JS, framework yok
- **Etkilenen dosyalar:** `drawing-core.js`, `drawing-trend.js`
- **`dsd-standard-tabs.js`**, **`property-toolbar.js`**, **`drawing-settings-dialog.js`** — kesinlikle dokunma

---

## MEVCUT DURUM

`channel` şu an `TWO_PT_TOOLS` listesinde. Render'ı `_drawChannel` yapar:
- p1 → p2 üst çizgi
- Alttaki çizgi: `d.channelOffset || 40` piksel aşağı — tamamen piksel bazlı, koordinat değil
- Level yok, 3. nokta yok

---

## YAPILACAK DEĞİŞİKLİKLER — 5 MADDE, SIRASINI BOZMA

---

### MADDE 1 — `drawing-core.js`: `channel`'ı `TWO_PT_TOOLS`'tan çıkar, `THREE_PT_TOOLS`'a ekle

#### Nerede: `_onMouseDown` fonksiyonu içindeki `TWO_PT_TOOLS` dizisi (~275. satır)

```javascript
// ESKİ:
const TWO_PT_TOOLS = [
  'trendline', 'ray', 'extended', 'rect', 'channel', 'arrowdraw', 'trendangle',
  ...
];
```

```javascript
// YENİ: 'channel' bu diziden çıkarılır
const TWO_PT_TOOLS = [
  'trendline', 'ray', 'extended', 'rect', 'arrowdraw', 'trendangle',
  ...
];
```

#### Nerede: `THREE_PT_TOOLS` dizisi (~315. satır)

```javascript
// ESKİ:
const THREE_PT_TOOLS = [
  'fib-ext', 'fib-channel', 'fib-timebased',
  'pitchfork', 'schiffpitch', 'modschiff', 'insidepitch',
  'rotatedrect', 'triangle', 'arc', 'curve'
];
```

```javascript
// YENİ: 'channel' eklenir
const THREE_PT_TOOLS = [
  'fib-ext', 'fib-channel', 'fib-timebased',
  'pitchfork', 'schiffpitch', 'modschiff', 'insidepitch',
  'rotatedrect', 'triangle', 'arc', 'curve', 'channel'
];
```

**Açıklama:** Böylece çizim akışı şöyle olur:
- 1. tık → p1 sabitlenir
- 2. tık → p2 sabitlenir, p3 fare ile takip etmeye başlar
- 3. tık → p3 sabitlenir, çizim tamamlanır

---

### MADDE 2 — `drawing-core.js`: `_renderAnchors` içinde `channel` için özel anchor noktaları

`_renderAnchors` fonksiyonunda channel şu an genel `else` bloğuna düşüyor — p1, p2, p3 üç nokta push'lanır. Bu yanlış.

Şu an `else if (d.tool === 'rect')` bloğundan sonra (yaklaşık 1502. satır), `else if (d.tool === 'rotatedrect')` bloğundan önce yeni bir `channel` bloğu ekle:

```javascript
// YENİ BLOK — rotatedrect bloğundan hemen önce ekle:
} else if (d.tool === 'channel') {
  const a = _pt2xy(d.p1, pane);
  const b = _pt2xy(d.p2, pane);
  if (a && b) {
    // Üst çizgi: p1 (sol), midpoint üst (orta), p2 (sağ)
    pts.push({ ...a, id: 'ch_p1' });
    pts.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, type: 'square', id: 'ch_mid_top' });
    pts.push({ ...b, id: 'ch_p2' });

    if (d.p3) {
      const c = _pt2xy(d.p3, pane);
      if (c) {
        // Alt çizgi p3'ün yatay offseti: p1 ile aynı x, p3'ün y'si
        // Alt çizgi: p1 konumundan p3 offset kadar aşağı (paralel)
        const dy = c.y - a.y; // kanal yüksekliği piksel
        const botA = { x: a.x, y: a.y + dy };
        const botB = { x: b.x, y: b.y + dy };
        const botMid = { x: (botA.x + botB.x) / 2, y: (botA.y + botB.y) / 2 };
        pts.push({ ...botA, id: 'ch_bot_p1' });
        pts.push({ ...botMid, type: 'square', id: 'ch_mid_bot' });
        pts.push({ ...botB, id: 'ch_bot_p2' });
      }
    }
  }
```

**Açıklama:**
- `ch_p1`, `ch_p2`, `ch_bot_p1`, `ch_bot_p2` → daire anchor (köşeler) — **mavi dolgu daire**
- `ch_mid_top`, `ch_mid_bot` → kare anchor (orta noktalar) — **kare şekil, ns-resize cursor**
- p3 henüz sabitlenmemişse (çizim devam ederken) sadece üst çizgi anchor'ları gösterilir

---

### MADDE 3 — `drawing-core.js`: Cursor mantığına `channel` ekle

`onMouseMove` içindeki cursor atama bloğunda (~695. satır), `ht === 'p1' || ht === 'p2' || ht === 'p3'` koşulunun **öncesine** channel-özel cursor bloğu ekle:

```javascript
// ESKİ (bu satırdan önce ekle):
} else if (ht === 'p1' || ht === 'p2' || ht === 'p3') {
```

```javascript
// YENİ — channel anchor cursor'ları:
} else if (tool === 'channel' && (ht === 'ch_p1' || ht === 'ch_p2' || ht === 'ch_bot_p1' || ht === 'ch_bot_p2')) {
  pane.cvs.style.cursor = 'default'; // arrow (köşe noktaları)
} else if (tool === 'channel' && (ht === 'ch_mid_top' || ht === 'ch_mid_bot')) {
  pane.cvs.style.cursor = 'ns-resize'; // dikey yeniden boyutlandırma (orta noktalar)
} else if (tool === 'channel' && ht === 'line') {
  pane.cvs.style.cursor = 'pointer'; // hand (gövde ve level çizgileri)
} else if (ht === 'p1' || ht === 'p2' || ht === 'p3') {
```

---

### MADDE 4 — `drawing-core.js`: Hit-test içindeki `channel` bloğunu güncelle

`_hitTest` fonksiyonunda `if (d.tool === 'channel')` bloğu (~2327. satır):

```javascript
// ESKİ:
if (d.tool === 'channel') {
  const offset = d.channelOffset || 40;
  if (_distToSegment(x, y, p1.x, p1.y + offset, p2.x, p2.y + offset) <= tolerance) return 'line';
}
```

```javascript
// YENİ:
if (d.tool === 'channel') {
  // Üst çizgi zaten yukarıda kontrol edildi (p1→p2 segment)
  // Anchor hit-test
  const a = _pt2xy(d.p1, pane);
  const b = _pt2xy(d.p2, pane);
  if (a && b) {
    if (Math.hypot(x - a.x, y - a.y) <= 8) return 'ch_p1';
    if (Math.hypot(x - b.x, y - b.y) <= 8) return 'ch_p2';
    const midTopX = (a.x + b.x) / 2, midTopY = (a.y + b.y) / 2;
    if (Math.hypot(x - midTopX, y - midTopY) <= 8) return 'ch_mid_top';
  }
  if (d.p3) {
    const c = _pt2xy(d.p3, pane);
    if (c && a && b) {
      const dy = c.y - a.y;
      const botAx = a.x, botAy = a.y + dy;
      const botBx = b.x, botBy = b.y + dy;
      const midBotX = (botAx + botBx) / 2, midBotY = (botAy + botBy) / 2;
      if (Math.hypot(x - botAx, y - botAy) <= 8) return 'ch_bot_p1';
      if (Math.hypot(x - botBx, y - botBy) <= 8) return 'ch_bot_p2';
      if (Math.hypot(x - midBotX, y - midBotY) <= 8) return 'ch_mid_bot';
      // Alt çizgi gövdesi
      if (_distToSegment(x, y, botAx, botAy, botBx, botBy) <= tolerance) return 'line';
    }
  }
  return false;
}
```

---

### MADDE 5 — `drawing-trend.js`: `_drawChannel` fonksiyonunu yeniden yaz

Mevcut `_drawChannel` fonksiyonunun tamamını aşağıdakiyle değiştir:

```javascript
// ESKİ — tüm _drawChannel fonksiyonu:
function _drawChannel(ctx, d, pane) {
    const a = _pt2xy(d.p1, pane);
    const b = _pt2xy(d.p2, pane);
    if (!a || !b) return;
    ctx.strokeStyle = d.style?.color || '#0969da';
    ctx.lineWidth = d.style?.width || 1;
    let dashArr = d.style?.dash || [];
    if (d.style?.lineStyle === 'dashed') dashArr = [8,5];
    if (d.style?.lineStyle === 'dotted') dashArr = [3,3];
    ctx.setLineDash(dashArr);
    
    const offset = d.channelOffset || 40;
    
    // Fill
    ctx.globalAlpha = 1;
    ctx.fillStyle = d.style?.fillColor || 'rgba(9, 105, 218, 0.2)';
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(b.x, b.y + offset);
    ctx.lineTo(a.x, a.y + offset);
    ctx.closePath();
    ctx.fill();

    // Borders
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(a.x, a.y + offset); ctx.lineTo(b.x, b.y + offset); ctx.stroke();
    ctx.setLineDash([]);
  }
```

```javascript
// YENİ:
function _drawChannel(ctx, d, pane) {
    const a = _pt2xy(d.p1, pane);
    const b = _pt2xy(d.p2, pane);
    if (!a || !b) return;

    const s = d.style || {};

    // p3 sabitlenmemişse sadece üst çizgiyi çiz (çizim devam ediyor)
    if (!d.p3) {
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      return;
    }

    const c = _pt2xy(d.p3, pane);
    if (!c) return;

    // Kanal vektörü: p3'ün p1'e göre fiyat farkı kanal yüksekliğini belirler
    // Alt çizgi: üst çizginin her noktasına aynı dy eklenir (paralel)
    const dy = c.y - a.y;

    const botAx = a.x, botAy = a.y + dy;
    const botBx = b.x, botBy = b.y + dy;

    // Level tanımları — varsayılan (settings'ten gelen varsa kullan)
    const defaultLevels = [
      { v: -0.25, active: false, color: '#787b86', style: 'solid',  width: 1 },
      { v: 0,     active: true,  color: s.color || '#2962ff', style: 'solid', width: s.width || 1 },
      { v: 0.25,  active: false, color: '#787b86', style: 'dashed', width: 1 },
      { v: 0.5,   active: false, color: '#787b86', style: 'dashed', width: 1 },
      { v: 0.75,  active: false, color: '#787b86', style: 'dashed', width: 1 },
      { v: 1,     active: true,  color: s.color || '#2962ff', style: 'solid', width: s.width || 1 },
      { v: 1.25,  active: false, color: '#787b86', style: 'solid',  width: 1 },
    ];
    const levels = s.channelLevels || defaultLevels;

    // Background fill (level 0 ile 1 arasını doldur)
    if (s.showBg !== false) {
      ctx.save();
      ctx.fillStyle = s.fillColor || 'rgba(9, 105, 218, 0.2)';
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineTo(botBx, botBy);
      ctx.lineTo(botAx, botAy);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Her level çizgisini render et
    for (const lvl of levels) {
      if (!lvl.active) continue;

      const ly1 = a.y + dy * lvl.v;
      const ly2 = b.y + dy * lvl.v;

      ctx.save();
      ctx.strokeStyle = lvl.color || s.color || '#2962ff';
      ctx.lineWidth   = lvl.width || 1;

      let dash = [];
      if (lvl.style === 'dashed') dash = [8, 5];
      else if (lvl.style === 'dotted') dash = [3, 3];
      ctx.setLineDash(dash);

      ctx.beginPath();
      ctx.moveTo(a.x, ly1);
      ctx.lineTo(b.x, ly2);
      ctx.stroke();
      ctx.restore();
    }
  }
```

**Açıklama:**
- `dy = c.y - a.y` fiyat bazlı kanal yüksekliği — piksel değil koordinat interpolasyonu
- Her level `v` değeri: 0 = üst çizgi, 1 = alt çizgi, 0.5 = orta, -0.25 / 1.25 = dışarıya uzanan
- `lvl.active === false` olan level'lar çizilmez
- 0 ve 1 level'ları her zaman `active: true` — bunlar ana kenarlardır

---

## Özet Tablo

| Dosya | Bölüm | Ne yapılıyor |
|---|---|---|
| `drawing-core.js` | `TWO_PT_TOOLS` | `channel` çıkarılır |
| `drawing-core.js` | `THREE_PT_TOOLS` | `channel` eklenir |
| `drawing-core.js` | `_renderAnchors` | channel için 6 anchor: 4 daire köşe + 2 kare orta |
| `drawing-core.js` | cursor mantığı | ch_p1/ch_p2/ch_bot_p1/ch_bot_p2 → `default`, ch_mid_top/ch_mid_bot → `ns-resize`, line → `pointer` |
| `drawing-core.js` | `_hitTest` channel bloğu | p3 bazlı alt çizgi + anchor hit-test |
| `drawing-trend.js` | `_drawChannel` | Tamamen yeniden yazılır — 3 nokta, level sistemi, background |

---

## Kesinlikle Yapılmayacaklar

- `dsd-standard-tabs.js` — dokunma
- `property-toolbar.js` — dokunma
- `drawing-settings-dialog.js` — dokunma
- `dsd-apply.js` — dokunma
- Diğer araçların (`trendline`, `pitchfork`, `rect` vb.) mevcut bloklarına dokunma

---

## Test Adımları

1. Channel aracını seç, grafik üzerine **1. tık** → p1 sabitlenir.
2. **2. tık** → p2 sabitlenir, fare hareketiyle alt çizgi takip eder (p3 mouse'a bağlı).
3. **3. tık** → p3 sabitlenir, kanal tamamlanır.
4. Kanalı seç → **6 anchor** görünmeli: üst çizginin iki ucu (daire), üst çizginin ortası (kare), alt çizginin iki ucu (daire), alt çizginin ortası (kare).
5. Üst/alt köşe anchor'larına fare gelince cursor → **ok (default/arrow)**.
6. Orta kare anchor'larına fare gelince cursor → **ns-resize**.
7. Kanal gövdesine (çizgiler dahil) fare gelince cursor → **pointer (el)**.
8. Settings'ten bir level (0.25, 0.5 vb.) aktif edilince o çizgi kanalın içinde doğru konumda render edilmeli.
9. Background checkbox kapalıysa fill görünmemeli.
