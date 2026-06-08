# GÖREV: Trend Angle Aracından Text Özelliğini Kaldır (Flyout + Settings)

## Proje Bağlamı

İki dosyada birer satır değişikliği yapılacak:
- `js/drawing/ui/property-toolbar.js`
- `js/drawing/ui/drawing-settings-dialog.js`

Başka hiçbir dosyaya dokunma.

---

## Sorunun Tam Nedeni

`trendangle` aracında şu an hem Flyout toolbar'da hem de Settings penceresinde
Text yazma / text renk değiştirme özellikleri görünüyor. Bu araçta text özelliği
olmamalı — sadece açı göstergesi ve TrendLine ile aynı diğer özellikler olacak.

---

## Yapılacak Değişiklikler

### Değişiklik 1 — `property-toolbar.js` — Flyout'ta text renk butonu gizlensin

**Dosya:** `js/drawing/ui/property-toolbar.js`  
**Satır:** ~443

`hasText` değişkeni, hangi araçlarda text renk butonunun **gösterilmeyeceğini**
belirleyen bir liste. `trendangle` bu listeye eklenince flyout'ta text renk butonu
gösterilmez.

**ESKİ KOD:**
```javascript
    const hasText = !['vline', 'arrowdraw', 'channel', 'regression', 'flattopbottom', 'pitchfork', 'schiffpitch', 'modschiff', 'insidepitch', 'rotatedrect', 'circle', 'ellipse', 'arrowmarker', 'arrowup', 'arrowdown', 'triangle', 'arc', 'curve', 'doublecurve', 'polyline', 'pathtool'].includes(_drawing.tool);
```

**YENİ KOD:**
```javascript
    const hasText = !['vline', 'arrowdraw', 'channel', 'regression', 'flattopbottom', 'pitchfork', 'schiffpitch', 'modschiff', 'insidepitch', 'rotatedrect', 'circle', 'ellipse', 'arrowmarker', 'arrowup', 'arrowdown', 'triangle', 'arc', 'curve', 'doublecurve', 'polyline', 'pathtool', 'trendangle'].includes(_drawing.tool);
```

**Ne değişti:** Listenin sonuna `'trendangle'` eklendi.

---

### Değişiklik 2 — `drawing-settings-dialog.js` — Settings'te Text tab gizlensin

**Dosya:** `js/drawing/ui/drawing-settings-dialog.js`  
**Satır:** ~84

Bu dosyada her araç için bir "caps" (capabilities) objesi tanımlı.
`hasText: false` olan araçlarda Settings penceresinde Text sekmesi gösterilmiyor.
`trendangle` caps'ında şu an `hasText` tanımlı değil — `undefined` döndüğü için
Text tab gösteriliyor. `hasText: false` eklemek yeterli.

**ESKİ KOD:**
```javascript
    trendangle:    { priceLabel:true,  extend:true,  midpoint:false, stats:false, capArrows:false, hasFill:false, coordsMode:'p2'       },
```

**YENİ KOD:**
```javascript
    trendangle:    { priceLabel:true,  extend:true,  midpoint:false, stats:false, capArrows:false, hasFill:false, hasText:false, coordsMode:'p2' },
```

**Ne değişti:** `hasText:false` eklendi.

---

## Özet Tablo

| Dosya | Satır | Değişiklik |
|-------|-------|------------|
| `js/drawing/ui/property-toolbar.js` | ~443 | `hasText` listesine `'trendangle'` eklendi |
| `js/drawing/ui/drawing-settings-dialog.js` | ~84 | `trendangle` caps'ına `hasText:false` eklendi |

---

## Kesinlikle Yapılmayacaklar

- `_drawTrendAngle()` fonksiyonuna **dokunma** — açı gösterme özelliği korunacak
- `drawing-trend.js` dosyasına **dokunma**
- Başka hiçbir aracın caps objesine **dokunma**
- Başka hiçbir fonksiyona **dokunma**

---

## Test Adımları

1. Sayfayı yenile
2. Trend Angle aracını seç ve bir çizgi çiz
3. Çizgiyi seç — Flyout toolbar'da text renk butonu (T ikonu) görünüyor mu? ❌ (Görünmemeli)
4. Flyout'tan Settings butonuna tıkla — Settings penceresinde "Text" sekmesi var mı? ❌ (Olmamalı)
5. Açı göstergesi (derece) chart üzerinde görünüyor mu? ✅ (Görünmeli)
6. TrendLine aracını seç — Text renk butonu ve Text sekmesi hâlâ var mı? ✅ (Olmalı — dokunulmadı)
