# RAPOR: FIX_DUPLICATE_CANDLES.md Uygulandı

**Tarih:** 2026-05-16

---

## Yapılan Değişiklikler

### DEĞİŞİKLİK 1 — `chart-data.js` → `CandleStore.append()`

**Satır:** 84–98

**Eski kod:**
```javascript
async append(symbol, tf, exchange, candle) {
  const existing = await this.get(symbol, tf, exchange);
  if (!existing || existing.length === 0) {
    await this.set(symbol, tf, exchange, [candle]);
    return;
  }
  const last = existing[existing.length - 1];
  if (last.time === candle.time) {
    // Update the open bar in place
    existing[existing.length - 1] = candle;
  } else {
    existing.push(candle); // ← Ortadaki duplicate'i yakalamıyordu
  }
  await this.set(symbol, tf, exchange, existing);
}
```

**Yeni kod:**
```javascript
async append(symbol, tf, exchange, candle) {
  const existing = await this.get(symbol, tf, exchange);
  if (!existing || existing.length === 0) {
    await this.set(symbol, tf, exchange, [candle]);
    return;
  }

  // Önce son elemana bak (hızlı yol — çoğu durumda yeterli)
  const last = existing[existing.length - 1];
  if (last.time === candle.time) {
    existing[existing.length - 1] = candle;
    await this.set(symbol, tf, exchange, existing);
    return;
  }

  // Son eleman değilse tüm dizide ara (duplicate koruması)
  const idx = existing.findIndex(c => c.time === candle.time);
  if (idx !== -1) {
    // Zaten var — güncelle
    existing[idx] = candle;
  } else {
    // Yeni mum — ekle
    existing.push(candle);
  }

  await this.set(symbol, tf, exchange, existing);
}
```

---

### DEĞİŞİKLİK 2 — `chart-pane.js` → `_onFeedCandles()` içinde deduplication

**Satır:** ~508 (clean array oluşturulduktan hemen sonra)

**Eklenen kod:**
```javascript
// Duplicate time değerlerini temizle (son gelen kazanır)
const seen = new Map();
clean.forEach(d => seen.set(d.time, d));
const deduped = Array.from(seen.values()).sort((a, b) => a.time - b.time);

const last = deduped[deduped.length - 1];
```

**`clean` → `deduped` olarak değiştirilen yerler:**

| Satır | Değişiklik |
|-------|-----------|
| `series.setData(...)` | `clean` → `deduped` |
| `volSeries.setData(...)` | `clean` → `deduped` |
| `this.candlesData = clean` | → `this.candlesData = deduped` |
| `this._updateVisualLines(clean)` | → `this._updateVisualLines(deduped)` |

---

## Push Edilecek Dosyalar

```
js/data/chart-data.js
js/chart/chart-pane.js
```

---

## Test

```javascript
// Console'da çalıştır:
const pane = LayoutManager.panes[0];
const times = pane.candlesData.map(d => d.time);
const dups = times.filter((t, i) => times.indexOf(t) !== i);
console.log('Duplicate:', dups.length); // 0 olmalı
```
