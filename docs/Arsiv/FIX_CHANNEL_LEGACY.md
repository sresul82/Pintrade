# GÖREV: drawing-trend.js — Eski Parallel Channel'ların Kaybolması Düzeltmesi

## Tek Dosya, Tek Değişiklik
**Etkilenen dosya:** `drawing-trend.js`
Başka hiçbir dosyaya dokunma.

---

## Sorunun Nedeni

`_drawChannel` fonksiyonunda 634. satırda şu kontrol var:

```javascript
if (!d.p3) {
  ctx.beginPath();
  ctx.moveTo(drawA.x, drawA.y);
  ctx.lineTo(drawB.x, drawB.y);
  ctx.stroke();
  return;
}
```

Daha önce kaydedilmiş channel'lar `p3` alanı yerine `channelOffset` (piksel) değeri taşıyor. Bu channel'larda `d.p3` yok, bu yüzden sadece tek çizgi çiziliyor ve kanal görünmüyor.

---

## Yapılacak Değişiklik

Şu bloğu bul:

```javascript
    // p3 sabitlenmemişse sadece üst çizgiyi çiz (çizim devam ediyor)
    if (!d.p3) {
      ctx.beginPath();
      ctx.moveTo(drawA.x, drawA.y);
      ctx.lineTo(drawB.x, drawB.y);
      ctx.stroke();
      return;
    }

    const c = _pt2xy(d.p3, pane);
    if (!c) return;

    // Kanal vektörü: p3'ün p1'e göre fiyat farkı kanal yüksekliğini belirler
    // Alt çizgi: üst çizginin eğimi (m) dikkate alınarak c'den geçen paralel çizgi bulunur
    let m = 0;
    if (b.x !== a.x) {
      m = (b.y - a.y) / (b.x - a.x);
    }
    const dy = c.y - a.y - m * (c.x - a.x);

    const botAx = drawA.x, botAy = drawA.y + dy;
    const botBx = drawB.x, botBy = drawB.y + dy;
```

Şununla değiştir:

```javascript
    // p3 yoksa eski channelOffset sistemiyle geriye dönük uyumluluk
    let dy;
    if (!d.p3) {
      if (d._placing) {
        // Çizim devam ediyor, sadece üst çizgiyi göster
        ctx.beginPath();
        ctx.moveTo(drawA.x, drawA.y);
        ctx.lineTo(drawB.x, drawB.y);
        ctx.stroke();
        return;
      }
      // Eski kayıtlı channel: channelOffset pikseli kullan
      dy = d.channelOffset || 40;
    } else {
      const c = _pt2xy(d.p3, pane);
      if (!c) return;

      // Kanal vektörü: p3'ün p1'e göre fiyat farkı kanal yüksekliğini belirler
      // Alt çizgi: üst çizginin eğimi (m) dikkate alınarak c'den geçen paralel çizgi bulunur
      let m = 0;
      if (b.x !== a.x) {
        m = (b.y - a.y) / (b.x - a.x);
      }
      dy = c.y - a.y - m * (c.x - a.x);
    }

    const botAx = drawA.x, botAy = drawA.y + dy;
    const botBx = drawB.x, botBy = drawB.y + dy;
```

---

## Ne Değişti

- `p3` yoksa ve çizim **devam ediyorsa** (`d._placing === true`): sadece üst çizgi gösterilir
- `p3` yoksa ve çizim **tamamlanmışsa** (eski kayıtlı channel): `channelOffset` ile alt çizgi hesaplanır, kanal görünür
- `p3` varsa: mevcut yeni sistem çalışır

---

## Kesinlikle Yapılmayacaklar
- `drawing-core.js` — dokunma
- `dsd-standard-tabs.js` — dokunma
- `dsd-apply.js` — dokunma
- `drawing-settings-dialog.js` — dokunma
- Başka hiçbir fonksiyona dokunma
