# GÖREV: chart-pane.js — _onFeedTick İki Hata Düzeltmesi

## Proje Bağlamı

PinTrade V2.4. Binance chart artık REST polling ile çalışıyor.
Polling çalışıyor ama console'da iki hata var.
**Sadece `chart-pane.js` dosyasını değiştir. `chart-data.js`'e dokunma.**

---

## Hata 1 — `Cannot update oldest data, last time=[object Object], new time=[object Object]`

**Nerede:** `chart-pane.js` → `_onFeedTick` metodu → `this.series.update(update)` satırı

**Neden oluyor:**

Lightweight Charts kütüphanesi `series.update()` fonksiyonuna gönderilen
objedeki `time` alanının **sayı (unix timestamp, saniye cinsinden)** olmasını bekliyor.

Eski WebSocket'te `k.t / 1000` ile gelen veri zaten parse edilmiş sayıydı.
Yeni REST polling'de `candleStore`'dan veya farklı bir kaynaktan gelen
`candle.time` bazen **obje** olarak geliyor — muhtemelen IndexedDB'den
deserialize edilirken tip kayması oluyor.

**Çözüm:**

`_onFeedTick` metodunda `series.update()` çağrısından önce
candle'ın tüm alanlarını sayıya zorla (sanitize et):

```javascript
_onFeedTick({ symbol, tf, exchange, candle, isClosed }) {
  if (this._destroyed) return;
  if (symbol !== this.symbol || tf !== this.tf) return;
  if (!this.series) return;
  if (this.exchange && exchange !== this.exchange) return;

  // ── Sanitize: tüm alanları sayıya zorla ──────────────────
  const safe = {
    time:   typeof candle.time === 'number' ? candle.time : parseInt(candle.time),
    open:   parseFloat(candle.open),
    high:   parseFloat(candle.high),
    low:    parseFloat(candle.low),
    close:  parseFloat(candle.close),
    volume: parseFloat(candle.volume),
  };

  // Geçersiz veri varsa güncelleme yapma
  if (isNaN(safe.time) || isNaN(safe.close) || isNaN(safe.open) ||
      isNaN(safe.high) || isNaN(safe.low)) {
    console.warn('[ChartPane] _onFeedTick: geçersiz candle verisi, atlandı:', candle);
    return;
  }

  const isLine = ['line', 'area'].includes(this.chartType);
  const update = isLine ? { time: safe.time, value: safe.close } : safe;

  try {
    this.series.update(update);

    if (this.volSeries) {
      this.volSeries.update({
        time:  safe.time,
        value: safe.volume,
        color: safe.close >= safe.open ? 'rgba(8,153,129,.4)' : 'rgba(242,54,69,.4)',
      });
    }

    this._lastPrice      = safe.close;
    this._lastPriceIsUp  = safe.close >= safe.open;
    this._lastCandleTime = safe.time;
  } catch (err) {
    console.warn('[ChartPane] _onFeedTick update failed:', err);
  }
}
```

**Dikkat:** Mevcut kodda `candle` objesi doğrudan kullanılıyordu.
Yeni kodda `safe` objesi kullanılıyor — her yerde `candle.` yerine `safe.` olduğuna emin ol.

---

## Hata 2 — `Uncaught Error: Value is null` (lightweight-charts)

**Nerede:** `chart-pane.js` → `_onFeedCandles` metodu → `this.series.setData(candles)` satırı

**Neden oluyor:**

REST polling ile gelen veya IndexedDB'den yüklenen candle dizisinin içinde
`open`, `high`, `low`, `close` veya `time` alanı `null` olan elemanlar var.
Lightweight Charts bu durumda `Value is null` hatası fırlatıyor.

**Çözüm:**

`_onFeedCandles` metodunda `setData` çağrısından önce
candle dizisini filtrele ve sanitize et:

```javascript
// _onFeedCandles içinde, setData çağrısından ÖNCE şunu ekle:

// ── Sanitize: null/NaN içeren mumları filtrele ──────────
const clean = candles
  .map(d => ({
    time:   typeof d.time === 'number' ? d.time : parseInt(d.time),
    open:   parseFloat(d.open),
    high:   parseFloat(d.high),
    low:    parseFloat(d.low),
    close:  parseFloat(d.close),
    volume: parseFloat(d.volume ?? 0),
  }))
  .filter(d =>
    !isNaN(d.time) && d.time > 0 &&
    !isNaN(d.open)  && d.open  > 0 &&
    !isNaN(d.high)  && d.high  > 0 &&
    !isNaN(d.low)   && d.low   > 0 &&
    !isNaN(d.close) && d.close > 0
  );

if (!clean.length) return; // Temiz veri yoksa chart'a dokunma
```

Ardından mevcut `this.series.setData(candles)` satırlarını `clean` ile değiştir:

```javascript
// ESKİ:
this.series.setData(
  isLine
    ? candles.map(d => ({ time: d.time, value: d.close }))
    : candles
);

if (this.volSeries) {
  this.volSeries.setData(candles.map(d => ({
    time: d.time,
    value: d.volume,
    color: d.close >= d.open ? 'rgba(8,153,129,.4)' : 'rgba(242,54,69,.4)',
  })));
}

// ...

const last = candles[candles.length - 1];

// YENİ:
this.series.setData(
  isLine
    ? clean.map(d => ({ time: d.time, value: d.close }))
    : clean
);

if (this.volSeries) {
  this.volSeries.setData(clean.map(d => ({
    time:  d.time,
    value: d.volume,
    color: d.close >= d.open ? 'rgba(8,153,129,.4)' : 'rgba(242,54,69,.4)',
  })));
}

// ...

const last = clean[clean.length - 1];
```

**Dikkat:** `_onFeedCandles` içinde `candles` değişkenine yapılan diğer referansları
(`this.candlesData = candles` gibi) da `clean` ile değiştir ki
magnet mode ve diğer özellikler de temiz veri kullansın.

---

## Özet — Ne Değişecek

| Metod | Değişiklik |
|-------|-----------|
| `_onFeedTick` | `candle` → `safe` objesi, NaN/null guard ekle |
| `_onFeedCandles` | `setData` öncesi `clean` filtresi ekle, tüm `candles` → `clean` |

---

## Kesinlikle Yapılmayacaklar

- `chart-data.js` dosyasına **dokunma**
- `BybitFeed` ile ilgili hiçbir şeye **dokunma**
- `_onFeedCandles` içindeki precision/decimal hesaplama mantığına **dokunma**
- `_updateVisualLines`, `_positionCountdown` gibi diğer metodlara **dokunma**

---

## Test Adımları

1. Sayfayı yenile
2. Console'da `Cannot update oldest data` hatası hala geliyor mu?
3. Console'da `Value is null` hatası hala geliyor mu?
4. Binance chart mumu hareket ediyor mu?
5. Bybit chart hala çalışıyor mu? (bozulmadığını doğrula)
6. Hata yoksa ve her iki chart çalışıyorsa görev tamamdır
