# GÖREV: CandleStore.append() — Duplicate Mum Sorunu Düzeltmesi

## Proje Bağlamı

PinTrade V2.4. Binance chart REST polling ile çalışıyor.
**Sadece `chart-data.js` içindeki `CandleStore.append()` metodunu değiştir.**
Başka hiçbir şeye dokunma.

---

## Sorunun Tam Nedeni

Polling her 2 saniyede şunu yapıyor:
1. Son 2 mumu çek (`limit=2`)
2. `prevCandle` (kapanmış mum) → `candleStore.append()` çağır
3. `candle` (açık mum) → `candleStore.append()` çağır

Mevcut `append()` metodu sadece **son elemanla** karşılaştırıyor:

```javascript
const last = existing[existing.length - 1];
if (last.time === candle.time) {
  // güncelle
} else {
  existing.push(candle); // ← SORUN: ortadaki duplicate'i yakalamıyor
}
```

**Senaryo:**
- IndexedDB'de: `[...mum_A, mum_B(açık)]`
- Yeni mum kapandı: polling `prevCandle=mum_B(kapandı)` gönderiyor
- `mum_B.time === last.time` → güncellendi ✅
- Sonra `candle=mum_C(açık)` → push edildi ✅
- 2 saniye sonra tekrar: `prevCandle=mum_B` tekrar geliyor
- `mum_B.time !== mum_C.time` → **push edildi** ❌ — DUPLICATE!

Sonuç: 42 duplicate `time` değeri oluşuyor.
Lightweight Charts `setData()` duplicate `time` değeri kabul etmiyor → `Value is null` hatası.

---

## Çözüm — `append()` Metodunu Güncelle

Sadece son eleman yerine **tüm dizide** `time` değerini ara.
Varsa güncelle, yoksa push et:

```javascript
// ESKİ:
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
    existing.push(candle);
  }
  await this.set(symbol, tf, exchange, existing);
}

// YENİ:
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

## Ek Düzeltme — `_onFeedCandles` içinde duplicate temizle

`chart-pane.js` içindeki `_onFeedCandles` metodunda `clean` array
oluşturulduktan sonra, `setData()` çağrısından önce duplicate `time`
değerlerini de filtrele:

```javascript
// clean array oluşturulduktan sonra, setData'dan ÖNCE ekle:
// Duplicate time değerlerini temizle (son gelen kazanır)
const seen = new Map();
clean.forEach(d => seen.set(d.time, d));
const deduped = Array.from(seen.values()).sort((a, b) => a.time - b.time);
```

Sonra `setData` ve `volSeries.setData` çağrılarında `clean` yerine `deduped` kullan:

```javascript
// ESKİ:
this.series.setData(
  isLine ? clean.map(d => ({ time: d.time, value: d.close })) : clean
);
if (this.volSeries) {
  this.volSeries.setData(clean.map(d => ({ ... })));
}
this.candlesData = clean;
const last = clean[clean.length - 1];

// YENİ:
this.series.setData(
  isLine ? deduped.map(d => ({ time: d.time, value: d.close })) : deduped
);
if (this.volSeries) {
  this.volSeries.setData(deduped.map(d => ({
    time:  d.time,
    value: d.volume,
    color: d.close >= d.open ? 'rgba(8,153,129,.4)' : 'rgba(242,54,69,.4)',
  })));
}
this.candlesData = deduped;
const last = deduped[deduped.length - 1];
```

---

## Özet Tablo

| Değişiklik | Dosya | Ne Yapılacak |
|------------|-------|--------------|
| `append()` güncelle | `chart-data.js` | Tüm dizide `findIndex` ile duplicate kontrolü |
| `_onFeedCandles` güncelle | `chart-pane.js` | `clean` → `deduped` Map ile duplicate temizle |

---

## Kesinlikle Yapılmayacaklar

- `mergeHistory()` metoduna **dokunma**
- `BybitFeed` sınıfına **dokunma**
- `_onFeedTick()` ve `_onLiveCandle()` metodlarına **dokunma**
- `_onOlderCandles()` metoduna **dokunma**
- `storage.js` dosyasına **dokunma**

---

## Test Adımları

1. IndexedDB'yi temizle: `indexedDB.deleteDatabase('CandleStore')` → F5
2. Binance — BTCUSDT seç, 1H'de mumlar görünüyor mu? ✅
3. 1D'ye geç — mumlar görünüyor mu? ✅
4. 4H'e geç — mumlar görünüyor mu? ✅
5. 1W'ye geç — mumlar görünüyor mu? ✅
6. 10 dakika bekle, mumlar kayboluyor mu? ❌ (kaybolumamalı)
7. Duplicate kontrolü:
```javascript
const pane = LayoutManager.panes[0];
const times = pane.candlesData.map(d => d.time);
const dups = times.filter((t, i) => times.indexOf(t) !== i);
console.log('Duplicate:', dups.length); // 0 olmalı
```
