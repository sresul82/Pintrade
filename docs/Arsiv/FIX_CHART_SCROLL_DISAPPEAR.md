# GÖREV: Chart Mumları Kaydırma/Çift Tıklamada Kayboluyor — Düzeltme

## Proje Bağlamı

PinTrade V2.4. Binance REST polling ve Bybit WebSocket ile çalışıyor.
**Sadece belirtilen dosya ve metodları değiştir. Başka hiçbir şeye dokunma.**

---

## Sorunun Tam Nedeni

### Senaryo:
1. Chart açılıyor, mumlar geliyor ✅
2. Kullanıcı chart'ı sağa sola kaydırıyor veya zaman cetveline çift tıklıyor
3. `subscribeVisibleLogicalRangeChange` tetikleniyor
4. Sol kenara yaklaşıldığında `DataFeed.loadOlderCandles()` çağrılıyor
5. `loadOlderCandles` tamamlanınca şunu emit ediyor:
   ```javascript
   EventBus.emit('feed:candles', { symbol, tf, exchange: feedName, candles: merged });
   ```
6. `chart-pane.js` içindeki `_onFeedCandles` bu event'i yakalıyor
7. `_onFeedCandles` içinde `this.series.setData(clean)` çağrılıyor
8. Eğer `merged` boş veya hatalıysa → chart tamamen siliniyor ❌

### Neden `merged` bazen boş geliyor:
`loadOlderCandles` içindeki şu guard yanlış çalışıyor:
```javascript
if (oldestTime && endTimeMs > oldestTime * 1000) { return; }
```
Bu koşul bazen erken `return` yapmıyor, fetch yapıyor ama boş sonuç dönüyor.
Boş `candles` ile `mergeHistory` çağrılınca `merged` mevcut verileri koruyor ama
bazen IndexedDB'den beklenmedik format geliyor.

---

## Çözüm: İki Ayrı Event Kullan

`feed:candles` eventi **ilk yükleme** için tasarlanmış — `setData()` çağırıyor ve
tüm chart'ı sıfırlıyor. Eski candle yüklemesi için bu event **yanlış.**

Eski candle yüklemesi için `setData()` değil, mevcut verinin **başına ekleme**
yapılmalı — Lightweight Charts'ta bu `series.setData()` ile tüm veriyi tekrar
vermekle yapılır ama bu sefer veri **kesinlikle dolu ve doğru** olmalı.

### DEĞİŞİKLİK 1 — `chart-data.js` → `loadOlderCandles` içinde yeni event kullan

`loadOlderCandles` metodunda `EventBus.emit('feed:candles', ...)` satırını
**`feed:olderCandles`** olarak değiştir:

```javascript
// ESKİ:
EventBus.emit('feed:candles', { symbol, tf, exchange: feedName, candles: merged });

// YENİ:
EventBus.emit('feed:olderCandles', { symbol, tf, exchange: feedName, candles: merged });
```

Bu değişiklik `_onFeedCandles`'ın tetiklenmesini engeller — eski candle yüklemesi
artık kendi özel handler'ına gidecek.

---

### DEĞİŞİKLİK 2 — `chart-pane.js` → `feed:olderCandles` handler ekle

`chart-pane.js` içinde EventBus listener'larının kurulduğu yere
(`feed:candles` listener'ının hemen altına) şunu ekle:

```javascript
EventBus.on('feed:olderCandles', (payload) => this._onOlderCandles(payload));
```

---

### DEĞİŞİKLİK 3 — `chart-pane.js` → `_onOlderCandles` metodunu ekle

`_onFeedCandles` metodunun hemen altına şu metodu ekle:

```javascript
_onOlderCandles({ symbol, tf, exchange, candles }) {
  if (this._destroyed) return;
  if (symbol !== this.symbol || tf !== this.tf) return;
  if (this.exchange && exchange !== this.exchange) return;
  if (!this.series) return;

  // Boş veri gelirse hiçbir şey yapma — chart'a dokunma
  if (!candles || !candles.length) return;

  // Sanitize
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

  // Temizlendikten sonra hala boşsa dokunma
  if (!clean.length) return;

  // Mevcut veriden daha eski mumlar geldi mi kontrol et
  const firstExisting = this.candlesData?.[0]?.time ?? Infinity;
  const firstNew      = clean[0].time;

  // Eğer gelen veri mevcut veriden daha eski değilse işlem yapma
  if (firstNew >= firstExisting) return;

  // Visible range'i kaydet — setData sonrası geri yükleyeceğiz
  let savedRange = null;
  try {
    savedRange = this.chart.timeScale().getVisibleLogicalRange();
  } catch(_) {}

  const isLine = ['line', 'area'].includes(this.chartType);

  try {
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

    this.candlesData = clean;

    // Visible range'i geri yükle — kullanıcının baktığı yere geri dön
    if (savedRange) {
      try {
        this.chart.timeScale().setVisibleLogicalRange(savedRange);
      } catch(_) {}
    }

  } catch(err) {
    console.warn('[ChartPane] _onOlderCandles setData failed:', err);
  }
}
```

**Neden visible range kaydedip geri yüklüyoruz:**
`setData()` çağrısı chart'ın görünür alanını sıfırlıyor — kullanıcı sola kaydırarak
eski verilere bakıyorken ani bir zıplama yaşanır. Range'i kaydedip geri yükleyince
kullanıcı baktığı yerde kalmaya devam eder.

---

### DEĞİŞİKLİK 4 — `chart-data.js` → `loadOlderCandles` guard'ını güçlendir

`loadOlderCandles` içindeki erken return koşulunu güçlendir:

```javascript
// ESKİ:
if (oldestTime && endTimeMs > oldestTime * 1000) { return; }

// YENİ:
if (oldestTime && endTimeMs >= oldestTime * 1000) { return; } // > yerine >=
```

Ve fetch sonrası boş veri kontrolü ekle:

```javascript
// ESKİ:
if (!Array.isArray(data) || !data.length) return;

// YENİ — zaten var, ama merged kontrolü ekle:
if (!Array.isArray(data) || !data.length) return;
const candles = data.map(normFn).sort((a, b) => a.time - b.time);
if (!candles.length) return; // normFn sonrası da boş olabilir
const merged  = await candleStore.mergeHistory(symbol, tf, feedName, candles);
if (!merged || !merged.length) return; // merged boşsa emit etme
EventBus.emit('feed:olderCandles', { symbol, tf, exchange: feedName, candles: merged });
```

---

## Özet Tablo

| Değişiklik | Dosya | Ne Yapılacak |
|------------|-------|--------------|
| `feed:candles` → `feed:olderCandles` | `chart-data.js` | `loadOlderCandles` içinde emit değiştir |
| `>=` guard düzelt | `chart-data.js` | `>` → `>=` |
| Boş `merged` kontrolü | `chart-data.js` | emit öncesi `if (!merged.length) return` |
| `feed:olderCandles` listener ekle | `chart-pane.js` | EventBus.on satırı ekle |
| `_onOlderCandles()` metodu ekle | `chart-pane.js` | `_onFeedCandles` altına ekle |

---

## Kesinlikle Yapılmayacaklar

- `_onFeedCandles` metoduna **dokunma**
- `_onFeedTick` metoduna **dokunma**
- `BybitFeed` sınıfına **dokunma**
- `fetchHistory` metoduna **dokunma**
- `connectLive` polling koduna **dokunma**

---

## Test Adımları

1. Sayfayı yenile, bir Binance coini seç
2. Chart'ı mouse ile sola kaydır — mumlar kayboluyor mu?
3. Zaman cetveline çift tıkla — mumlar kayboluyor mu?
4. Bybit coininde aynı testleri yap — Bybit chart hala çalışıyor mu?
5. Console'da `_onOlderCandles setData failed` hatası var mı?
6. Hiçbir kaybolma yoksa görev tamamdır
