# GÖREV: BinanceFeed.connectLive() — WebSocket → REST Polling

## Proje Bağlamı

PinTrade V2.4. Binance ve Bybit için **tamamen bağımsız** chart sistemi var.
**Bu dosyada sadece `BinanceFeed` sınıfını değiştir. `BybitFeed` ve `DataFeedManager`'a dokunma.**

Bir Node.js proxy sunucusu var (Railway - Singapur):
- `/api/binance/futures/fapi/v1/...` → proxy üzerinden `fapi.binance.com`'a gidiyor
- Bu proxy Singapur IP'si kullandığı için Binance geo-block yok

---

## Sorunun Nedeni

`BinanceFeed.connectLive()` şu an tarayıcıdan doğrudan şu adrese WebSocket açıyor:

```
wss://fstream.binance.com/ws/btcusdt@kline_1m
```

Kullanıcı Avrupa IP'si kullanıyor. Binance bu bölgeden WebSocket bağlantısını
**kabul ediyor ama hiç veri göndermiyor.** `ws.readyState = 1 (OPEN)` görünüyor
ama `onmessage` hiç tetiklenmiyor. Bu Binance'in geo-block mekanizması.

Sonuç: Binance chart'ta mum grafiği hiç güncellenmiyor, donmuş görünüyor.

---

## Çözüm: connectLive() → REST Polling

WebSocket yerine her 2 saniyede bir Binance Futures klines endpoint'ini çağır.
Bu REST isteği proxy üzerinden geçiyor → Singapur IP → geo-block yok.

Kullanılacak endpoint:
```
/api/binance/futures/fapi/v1/klines?symbol=BTCUSDT&interval=1m&limit=2
```
`limit=2` → sadece son 2 mumu çek (mevcut açık mum + bir önceki kapalı mum).
Bu son derece hafif bir istek, band genişliği sorunu yok.

---

## Yapılacak Değişiklikler (Sadece `BinanceFeed` sınıfı)

### DEĞİŞİKLİK 1 — `connectLive()` metodunu tamamen değiştir

Mevcut `connectLive()` metodunu **tamamen sil** ve yerine şunu yaz:

```javascript
connectLive(symbol, tf) {
  const key      = `${symbol}_${tf}`;
  const interval = BINANCE_TF[tf];
  if (!interval) return;

  // Zaten çalışan bir poll varsa durdur
  if (this._ws[key]) {
    clearInterval(this._ws[key]);
    this._ws[key] = null;
  }

  console.log(`[BinanceFeed] connectLive (polling) started for ${key}`);
  EventBus.emit('feed:status', { exchange: 'binance', status: 'open' });

  // Son kapalı mumu takip etmek için
  let lastClosedTime = null;

  const poll = async () => {
    try {
      const url = `${AppConfig.API.binance.restFutures}/fapi/v1/klines` +
        `?symbol=${symbol.toUpperCase()}&interval=${interval}&limit=2&_t=${Date.now()}`;

      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) return;

      // Son eleman = şu an açık olan mum
      const raw = data[data.length - 1];
      const candle = {
        time:   Math.floor(raw[0] / 1000),
        open:   parseFloat(raw[1]),
        high:   parseFloat(raw[2]),
        low:    parseFloat(raw[3]),
        close:  parseFloat(raw[4]),
        volume: parseFloat(raw[5]),
      };

      // Bir önceki eleman = kapanmış mum (eğer yeniyse ekle)
      if (data.length >= 2) {
        const prevRaw  = data[data.length - 2];
        const prevTime = Math.floor(prevRaw[0] / 1000);
        if (prevTime !== lastClosedTime) {
          lastClosedTime = prevTime;
          const prevCandle = {
            time:   prevTime,
            open:   parseFloat(prevRaw[1]),
            high:   parseFloat(prevRaw[2]),
            low:    parseFloat(prevRaw[3]),
            close:  parseFloat(prevRaw[4]),
            volume: parseFloat(prevRaw[5]),
          };
          try { await candleStore.append(symbol, tf, 'binance', prevCandle); } catch(e) {}
          EventBus.emit('feed:tick', {
            symbol, tf, exchange: 'binance',
            candle: prevCandle, isClosed: true,
          });
        }
      }

      // Mevcut açık mumu güncelle
      try { await candleStore.append(symbol, tf, 'binance', candle); } catch(e) {}

      EventBus.emit('feed:tick', {
        symbol, tf, exchange: 'binance',
        candle, isClosed: false,
      });

      EventBus.emit('feed:price', {
        symbol, exchange: 'binance', price: candle.close,
      });

    } catch(e) {
      console.warn('[BinanceFeed] poll error:', e);
    }
  };

  // Hemen bir kez çalıştır, sonra her 2 saniyede tekrarla
  poll();
  this._ws[key] = setInterval(poll, 2000);
}
```

---

### DEĞİŞİKLİK 2 — `disconnectLive()` metodunu güncelle

```javascript
// ESKİ:
disconnectLive(symbol, tf) {
  const key = `${symbol}_${tf}`;
  const ws  = this._ws[key];
  if (ws) {
    ws.onmessage = null;
    ws.onerror   = null;
    ws.onclose   = null;
    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
      ws.close(1000, 'TF change');
    }
    delete this._ws[key];
  }
}

// YENİ:
disconnectLive(symbol, tf) {
  const key = `${symbol}_${tf}`;
  if (this._ws[key]) {
    clearInterval(this._ws[key]);
    delete this._ws[key];
    console.log(`[BinanceFeed] polling stopped for ${key}`);
  }
}
```

---

### DEĞİŞİKLİK 3 — `disconnectAll()` metodunu güncelle

```javascript
// ESKİ:
disconnectAll() {
  Object.keys(this._ws).forEach(k => {
    const ws = this._ws[k];
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) ws.close();
  });
  this._ws = {};
}

// YENİ:
disconnectAll() {
  Object.keys(this._ws).forEach(k => {
    clearInterval(this._ws[k]);
  });
  this._ws = {};
}
```

---

## Özet Tablo

| Değişiklik | Ne Yapılacak |
|------------|--------------|
| `connectLive()` | Tamamen sil, REST polling versiyonunu yaz |
| `disconnectLive()` | `ws.close()` → `clearInterval()` |
| `disconnectAll()` | `ws.close()` → `clearInterval()` |
| `BybitFeed` | **Dokunma** |
| `DataFeedManager` | **Dokunma** |
| `CandleStore` | **Dokunma** |

---

## Kesinlikle Yapılmayacaklar

- `BybitFeed` sınıfına **dokunma** — Bybit WebSocket zaten çalışıyor
- `DataFeedManager` sınıfına **dokunma**
- `fetchHistory()` metoduna **dokunma**
- `normBinance()` fonksiyonuna **dokunma**
- Poll interval'ını 2 saniyenin altına **indirme** — Binance rate limit var

---

## Test Adımları

1. Sayfayı yenile
2. Binance sembolü seç (örn: BTCUSDT)
3. Console'da şunu ara: `[BinanceFeed] connectLive (polling) started`
4. 5 saniye bekle — chart mumu hareket ediyor mu?
5. TF değiştir (1m → 5m) — eski polling duruyor mu, yeni başlıyor mu?
6. Console'da `[BinanceFeed] polling stopped` logu geliyor mu?
7. Her şey tamam ise görev tamamdır
