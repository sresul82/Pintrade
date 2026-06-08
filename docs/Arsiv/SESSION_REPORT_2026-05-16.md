# PinTrade V2.4 — Oturum Raporu
**Tarih:** 2026-05-16  
**Kapsam:** Chart veri katmanı kararlılık düzeltmeleri + Çizim araçları iyileştirmeleri

---

## Yapılan Değişiklikler

---

### 1. Çizim Araçları — Varsayılan Çizgi Kalınlığı (1px)

**Dosya:** `js/drawing/core/drawing-core.js`  
**Satır:** ~1472

**Sorun:**  
`TrendLine`, `Ray` ve `ExtendedLine` araçlarının Settings/Flyout menüsünde `1px` gösterilmesine rağmen canvas üzerinde daha kalın çiziliyordu. `_renderDrawing` fonksiyonundaki fallback değer `2` olarak kodlanmıştı.

**Düzeltme:**
```diff
- ctx.lineWidth = d.style?.width || 2;
+ ctx.lineWidth = d.style?.width || 1;
```

---

### 2. Çizim Araçları — Uç Nokta Daire Gösterimi

**Dosya:** `js/drawing/tools/drawing-trend.js`  
**Satır:** ~350

**Sorun:**  
`TrendLine`, `Ray`, `ExtendedLine` araçlarında cap tipi `normal` (daire) seçildiğinde çizgi seçili olmasa dahi her zaman iki uçta daire çiziyordu. Beklenen davranış: daireler yalnızca çizgi **seçiliyken** mavi anchor noktaları olarak görünmeli, seçili değilken uçta hiçbir işaret olmamalı.

**Düzeltme:**  
`_drawTrendLine` içindeki `capLeft === 'normal'` ve `capRight === 'normal'` dallarındaki `_drawCircleCap()` çağrıları kaldırıldı. Seçim anchor'ları zaten `_renderAnchors()` tarafından yönetiliyor.

```diff
- } else if (capLeft === 'normal') {
-   _drawCircleCap(ctx, a);
  }
- } else if (capRight === 'normal') {
-   _drawCircleCap(ctx, b);
  }
```

---

### 3. Kaydırma / Çift Tıklama — Chart Mumları Kayboluyor

**Dosyalar:** `js/data/chart-data.js`, `js/chart/chart-pane.js`  
**Kaynak:** `FIX_CHART_SCROLL_DISAPPEAR.md`

**Sorun:**  
Kullanıcı chart'ı sola kaydırdığında veya zaman cetveline çift tıkladığında `loadOlderCandles()` tetikleniyordu. Bu fonksiyon `feed:candles` eventi emitliyordu ve `_onFeedCandles` içindeki `setData()` tüm chart'ı sıfırlıyordu. Eğer `merged` boş veya hatalıysa chart tamamen siliniyordu.

**Düzeltmeler:**

| Değişiklik | Dosya | Detay |
|------------|-------|-------|
| Guard `>` → `>=` | `chart-data.js` | `endTimeMs >= oldestTime * 1000` |
| Boş candles/merged kontrolü | `chart-data.js` | `if (!candles.length) return` ve `if (!merged.length) return` |
| Event değişikliği | `chart-data.js` | `feed:candles` → `feed:olderCandles` |
| Yeni listener | `chart-pane.js` | `EventBus.on('feed:olderCandles', ...)` |
| `_onOlderCandles()` metodu | `chart-pane.js` | Sanitize + `firstNew >= firstExisting` kontrolü + visible range kaydet/geri yükle |

---

### 4. Uzun TF'lerde (1D/1W/4H) Mumlar Görünmüyor — Polling Sorunu

**Dosyalar:** `js/data/chart-data.js`, `js/chart/chart-pane.js`  
**Kaynak:** `FIX_POLLING_LONG_TF.md`

**Sorun:**  
Binance polling her 2 saniyede `feed:tick` emitliyordu. `fetchHistory()` henüz tamamlanmadan `series.update()` çağrılıyordu. Uzun TF'lerde (1W, 1D, 4H) `_initialDataLoaded` flag'i `false` olduğunda `series.update()` "Value is null" hatasına yol açıyor ve chart boş kalıyordu.

**Düzeltmeler:**

| Değişiklik | Dosya | Detay |
|------------|-------|-------|
| Event değişikliği | `chart-data.js` | `BinanceFeed.connectLive()` içinde 2 yerdeki `feed:tick` → `feed:liveCandle` |
| Yeni listener | `chart-pane.js` | `EventBus.on('feed:liveCandle', ...)` |
| `_onLiveCandle()` metodu | `chart-pane.js` | `_initialDataLoaded` kontrolü, `candlesData` boş kontrolü, `safe.time < lastExistingTime` kontrolü, in-memory `candlesData` güncelleme |

> **Not:** `BybitFeed` içindeki `feed:tick` emit'lerine dokunulmadı — Bybit hâlâ `_onFeedTick` üzerinden çalışıyor.

---

### 5. Duplicate Mum Sorunu — CandleStore.append()

**Dosyalar:** `js/data/chart-data.js`, `js/chart/chart-pane.js`  
**Kaynak:** `FIX_DUPLICATE_CANDLES.md`

**Sorun:**  
Polling her 2 saniyede `prevCandle` ve `candle` için `candleStore.append()` çağırıyordu. `append()` yalnızca son elemana bakıyordu. `prevCandle` kapandıktan sonra yeni mum açıldığında `prevCandle` tekrar geldiğinde `son_eleman.time !== prevCandle.time` olduğu için `push()` yapılıyor ve 42'ye varan duplicate `time` değeri oluşuyordu. Lightweight Charts `setData()` duplicate `time` kabul etmez → crash.

**Düzeltmeler:**

#### `chart-data.js` — `CandleStore.append()`
```diff
- const last = existing[existing.length - 1];
- if (last.time === candle.time) {
-   existing[existing.length - 1] = candle;
- } else {
-   existing.push(candle);
- }

+ // Önce son elemana bak (hızlı yol)
+ if (last.time === candle.time) {
+   existing[existing.length - 1] = candle;
+   await this.set(...); return;
+ }
+ // Tüm dizide ara (duplicate koruması)
+ const idx = existing.findIndex(c => c.time === candle.time);
+ if (idx !== -1) { existing[idx] = candle; }
+ else { existing.push(candle); }
```

#### `chart-pane.js` — `_onFeedCandles()`
`clean` array'inden sonra, `setData`'dan önce deduplication eklendi:
```javascript
const seen = new Map();
clean.forEach(d => seen.set(d.time, d));
const deduped = Array.from(seen.values()).sort((a, b) => a.time - b.time);
```
`clean` → `deduped`: `setData`, `volSeries.setData`, `candlesData`, `_updateVisualLines`

---

## Değiştirilen Dosyalar (Push Listesi)

| Dosya | Değişiklik Sayısı |
|-------|-------------------|
| `js/drawing/core/drawing-core.js` | 1 |
| `js/drawing/tools/drawing-trend.js` | 1 |
| `js/data/chart-data.js` | 3 (guard, event, append) |
| `js/chart/chart-pane.js` | 4 (olderCandles, liveCandle, deduped, listener) |

---

## Test Kontrol Listesi

- [ ] Binance BTCUSDT → 1m mumlar görünüyor mu?
- [ ] 1H → 4H → 1D → 1W geçişte mumlar kayboluyor mu?
- [ ] Chart'ı sola kaydır → mumlar kayboluyor mu?
- [ ] Zaman cetveline çift tıkla → mumlar kayboluyor mu?
- [ ] 10 dakika bekle → mumlar hâlâ duruyor mu?
- [ ] Bybit coini test et → çalışıyor mu?
- [ ] TrendLine çiz → seçisiz iken uçlarda daire yok mu?
- [ ] TrendLine seç → mavi anchor daireler görünüyor mu?
- [ ] TrendLine kalınlığı 1px mi?
- [ ] Console'da duplicate kontrolü: `dups.length === 0`

---

## Korunması Gereken Kısıtlamalar

- `BybitFeed` içindeki `feed:tick` emit'lerine dokunulmadı
- `_onFeedTick()` silindi veya değiştirilmedi
- `mergeHistory()` metoduna dokunulmadı
- `storage.js` dosyasına dokunulmadı
- `fetchHistory()` metoduna dokunulmadı
