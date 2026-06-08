# GÖREV: Uzun TF'lerde (1D, 1W vb.) Chart Mumları Görünmüyor — Polling Düzeltmesi

## Proje Bağlamı

PinTrade V2.4. Binance chart REST polling ile çalışıyor (WebSocket geo-block nedeniyle kaldırıldı).
**Sadece `chart-data.js` içindeki `BinanceFeed.connectLive()` metodunu değiştir.**
`chart-pane.js`, `BybitFeed`, `DataFeedManager`'a dokunma.

---

## Sorunun Tam Nedeni

### Mevcut polling mantığı:
```javascript
// Her 2 saniyede bir:
const url = `.../fapi/v1/klines?symbol=BTCUSDT&interval=1w&limit=2`
// Son 2 mumu çek → feed:tick ile series.update() çağır
```

### Neden 1m'de çalışıyor:
1m TF'de her mum 60 saniye sürer. Polling 2 saniyede bir çalışır.
`series.update()` aynı mumu günceller — sorun yok.

### Neden 1W, 1D, 4H'de çalışmıyor:
Lightweight Charts `series.update()` kuralı:
> **Gönderilen mumun `time` değeri, chart'taki son mumun `time` değerinden
> küçük veya eşit olamaz. Eşitse sadece günceller, küçükse hata fırlatır.**

1W TF'de bir mum 7 gün sürer. Polling 2 saniyede bir aynı `time` değerini gönderiyor.
İlk `update()` çalışıyor, ama ardından `fetchHistory()` tamamlanıp `setData()` çağrılıyor
ve chart yeniden kuruluyor. Sonraki `update()` çağrısında `time` değerleri çakışıyor,
Lightweight Charts hata fırlatıyor ve chart boş kalıyor.

### Kök neden:
`connectLive()` polling başladığında `fetchHistory()` henüz tamamlanmamış olabilir.
Polling `series.update()` çağırıyor, ama `series` henüz `setData()` almamış —
yani boş bir chart'a `update()` atılıyor. Bu `Value is null` hatasına yol açıyor.

---

## Çözüm

### İki Değişiklik Gerekiyor:

**1. Polling `feed:tick` yerine `feed:liveCandle` eventi kullanmalı**
`chart-pane.js` içinde `_onFeedTick` hem WebSocket hem polling için kullanılıyor.
Polling için ayrı bir event kullanarak `chart-pane.js` tarafında
"geçmiş veri yüklendi mi?" kontrolü yapılabilecek.

**2. `chart-pane.js` tarafında guard ekle**
`_initialDataLoaded` flag'i `true` olmadan polling eventine tepki verme.

---

## Yapılacak Değişiklik — `chart-data.js`

### `connectLive()` içinde `feed:tick` → `feed:liveCandle` olarak değiştir

```javascript
// ESKİ — prevCandle için:
EventBus.emit('feed:tick', {
  symbol, tf, exchange: 'binance',
  candle: prevCandle, isClosed: true,
});

// YENİ:
EventBus.emit('feed:liveCandle', {
  symbol, tf, exchange: 'binance',
  candle: prevCandle, isClosed: true,
});

// ESKİ — açık mum için:
EventBus.emit('feed:tick', {
  symbol, tf, exchange: 'binance',
  candle, isClosed: false,
});

// YENİ:
EventBus.emit('feed:liveCandle', {
  symbol, tf, exchange: 'binance',
  candle, isClosed: false,
});
```

**Dikkat:** Sadece `BinanceFeed.connectLive()` içindeki emit'leri değiştir.
`BybitFeed` içinde `feed:tick` kullanmaya devam ediyor — ona dokunma.

---

## Yapılacak Değişiklik — `chart-pane.js`

### 1. Yeni listener ekle

`EventBus.on('feed:tick', ...)` satırının hemen altına ekle:

```javascript
EventBus.on('feed:liveCandle', (payload) => this._onLiveCandle(payload));
```

### 2. `_onLiveCandle()` metodunu ekle

`_onFeedTick()` metodunun hemen altına ekle:

```javascript
// Binance polling'den gelen canlı mum güncellemesi
// feed:tick'ten farkı: geçmiş veri yüklenmeden önce series.update() çağırmaz
_onLiveCandle({ symbol, tf, exchange, candle, isClosed }) {
  if (this._destroyed) return;
  if (symbol !== this.symbol || tf !== this.tf) return;
  if (this.exchange && exchange !== this.exchange) return;
  if (!this.series) return;

  // Geçmiş veri henüz yüklenmediyse update() çağırma — Value is null hatası olur
  if (!this._initialDataLoaded) return;

  // candlesData boşsa update() çağırma
  if (!this.candlesData || !this.candlesData.length) return;

  // Sanitize
  const safe = {
    time:   typeof candle.time === 'number' ? candle.time : parseInt(candle.time),
    open:   parseFloat(candle.open),
    high:   parseFloat(candle.high),
    low:    parseFloat(candle.low),
    close:  parseFloat(candle.close),
    volume: parseFloat(candle.volume),
  };

  if (isNaN(safe.time) || isNaN(safe.close) || isNaN(safe.open) ||
      isNaN(safe.high) || isNaN(safe.low)) {
    return;
  }

  // Gelen mumun time değeri mevcut son mumdan KÜÇÜKSE update() çağırma
  // (Lightweight Charts bunu reddeder ve hata fırlatır)
  const lastExistingTime = this.candlesData[this.candlesData.length - 1]?.time;
  if (lastExistingTime && safe.time < lastExistingTime) return;

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

    this._lastPrice     = safe.close;
    this._lastPriceIsUp = safe.close >= safe.open;
    this._lastCandleTime = safe.time;

    // candlesData'yı güncelle
    if (lastExistingTime && safe.time === lastExistingTime) {
      // Mevcut son mumu güncelle
      this.candlesData[this.candlesData.length - 1] = safe;
    } else {
      // Yeni mum ekle
      this.candlesData.push(safe);
    }

  } catch(err) {
    console.warn('[ChartPane] _onLiveCandle update failed:', err);
  }
}
```

---

## Özet Tablo

| Değişiklik | Dosya | Ne Yapılacak |
|------------|-------|--------------|
| `feed:tick` → `feed:liveCandle` | `chart-data.js` | `connectLive()` içinde 2 yerdeki emit |
| Yeni listener | `chart-pane.js` | `feed:liveCandle` listener ekle |
| `_onLiveCandle()` ekle | `chart-pane.js` | `_onFeedTick` altına yeni metod |

---

## Kesinlikle Yapılmayacaklar

- `BybitFeed` içindeki `feed:tick` emit'lerine **dokunma**
- `_onFeedTick()` metodunu **silme veya değiştirme** — Bybit hala bunu kullanıyor
- `fetchHistory()` metoduna **dokunma**
- `_onFeedCandles()` metoduna **dokunma**
- `_onOlderCandles()` metoduna **dokunma**

---

## Test Adımları

1. Sayfayı yenile
2. Binance — BTCUSDT seç, 1m'de mumlar görünüyor mu? ✅
3. 1H'e geç — mumlar görünüyor mu? ✅
4. 4H'e geç — mumlar görünüyor mu? ✅
5. 1D'ye geç — mumlar görünüyor mu? ✅
6. 1W'ye geç — mumlar görünüyor mu? ✅
7. Her TF'de 10 saniye bekle — mumlar kayboluyor mu? ❌ (kaybolumamalı)
8. Bybit coininde aynı testleri yap — Bybit hala çalışıyor mu? ✅
9. Console'da `_onLiveCandle update failed` hatası var mı?
