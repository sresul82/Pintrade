# GÖREV: Screener Canlı Fiyat Güncellemesi — WebSocket Kaldır, REST Polling Ekle

## Proje Bağlamı

PinTrade V2.4 — Binance ve Bybit için ayrı screener sekmeleri var.
Her borsa tamamen bağımsız. **Bu düzeni bozma, hiçbir şeyi birleştirme.**

Bir Node.js proxy sunucusu var (`server.js`) ve şu endpoint'ler çalışıyor:
- `/api/binance/futures/fapi/v1/...` → Singapur IP'siyle `fapi.binance.com`'a proxy'liyor
- `/api/binance/spot/...` → `api.binance.com`'a proxy'liyor

Bu proxy Singapur'da (Railway) çalışıyor. Binance geo-block yok.

---

## Sorunun Tam Nedeni

`screener-core.js` içinde `_connectWS()` fonksiyonu var:

```javascript
function _connectWS() {
  _ws = new WebSocket('wss://fstream.binance.com/ws/!markPrice@arr@1s');
  // ...
}
```

Bu WebSocket **tarayıcıdan doğrudan** `fstream.binance.com`'a bağlanıyor.
Kullanıcı Avrupa IP'si kullandığı için Binance bağlantıyı kabul ediyor ama
**hiç veri göndermiyor** — geo-block bu şekilde çalışıyor.

Sonuç: Binance screener'da fiyatlar ilk yüklemeden sonra **hiç güncellenmiyor.**

Bybit screener da aynı şekilde statik — çünkü `_connectWS()` sadece Binance
stream'ini dinliyor, Bybit tab'ında ise `_activeTab.startsWith('bn')` koşulu
`false` olduğu için Bybit satırları hiçbir zaman güncellenmiyor.

---

## Çözüm: WebSocket'i Kaldır, REST Polling Ekle

WebSocket yerine her 5 saniyede bir REST isteği at.
REST istekleri zaten proxy üzerinden geçiyor → geo-block yok → her IP'den çalışır.

---

## Yapılacak Değişiklikler (Sadece `screener-core.js`)

### DEĞİŞİKLİK 1 — `_connectWS()` fonksiyonunu tamamen sil

Dosyada `_connectWS` **iki kez** tanımlı — ikisi de sil.
Ayrıca `init()` içindeki `_connectWS()` çağrısını da sil.

Sileceğin şeyler:
```javascript
// BU FONKSİYONU SİL (iki kez tanımlı, ikisini de sil):
function _connectWS() {
  if (_ws) _ws.close();
  _ws = new WebSocket('wss://fstream.binance.com/ws/!markPrice@arr@1s');
  ...
}

// init() içindeki bu çağrıyı da sil:
_connectWS();
```

Ayrıca `_ws` state değişkenini de sil:
```javascript
// BU SATIRI SİL:
let _ws = null;
```

---

### DEĞİŞİKLİK 2 — Binance için `_startBinancePolling()` ekle

`_connectWS` fonksiyonlarının olduğu yere şunu ekle:

```javascript
let _bnPollTimer = null;

function _startBinancePolling() {
  // Önceki timer varsa temizle
  if (_bnPollTimer) clearInterval(_bnPollTimer);

  // Hemen bir kez çalıştır, sonra her 5 saniyede tekrarla
  _pollBinancePrices();
  _bnPollTimer = setInterval(_pollBinancePrices, 5000);
}

async function _pollBinancePrices() {
  // Sadece Binance tab aktifken çalış
  if (!_activeTab.startsWith('bn')) return;

  try {
    // premiumIndex tüm coinlerin mark price + funding rate bilgisini verir
    const res = await fetch(`${AppConfig.API.binance.restFutures}/fapi/v1/premiumIndex`);
    if (!res.ok) return;
    const arr = await res.json();

    let changed = false;
    arr.forEach(d => {
      if (!d.symbol.endsWith('USDT')) return;
      const sym   = d.symbol.replace(/USDT$/, '');
      const price = parseFloat(d.markPrice);
      const fr    = parseFloat(d.lastFundingRate);

      _priceMap.set(sym, price);

      if (_frTracker) _frTracker.addFRValue(d.symbol, fr);

      const row = _rows.find(r => r.sym === sym);
      if (row) {
        row.price = price;
        row.fr    = fr;
        changed   = true;
      }
    });

    if (changed) _throttledRender();

  } catch (e) {
    // Sessiz hata — bir sonraki 5 saniyede tekrar dener
    console.warn('[ScreenerCore] Binance poll error:', e);
  }
}
```

**Neden `premiumIndex` kullanıyoruz?**
Çünkü `_loadBinanceScreener()` zaten bu endpoint'i kullanıyor ve
hem `markPrice` hem de `lastFundingRate` alanlarını aynı anda döndürüyor.
Yani tek istek ile hem fiyat hem funding rate güncelleniyor.

---

### DEĞİŞİKLİK 3 — Bybit için `_startBybitPolling()` ekle

```javascript
let _bbPollTimer = null;

function _startBybitPolling() {
  if (_bbPollTimer) clearInterval(_bbPollTimer);

  _pollBybitPrices();
  _bbPollTimer = setInterval(_pollBybitPrices, 5000);
}

async function _pollBybitPrices() {
  // Sadece Bybit tab aktifken çalış
  if (!_activeTab.startsWith('bb')) return;

  try {
    const res = await fetch('https://api.bybit.com/v5/market/tickers?category=linear');
    if (!res.ok) return;
    const json = await res.json();
    const list = json?.result?.list || [];

    let changed = false;
    list.forEach(d => {
      if (!d.symbol.endsWith('USDT')) return;
      const sym   = d.symbol.replace(/USDT$/, '');
      const price = parseFloat(d.lastPrice);
      const fr    = parseFloat(d.fundingRate);
      const pct   = parseFloat(d.price24hPcnt) * 100;

      _priceMap.set(sym, price);

      const row = _rows.find(r => r.sym === sym);
      if (row) {
        row.price = price;
        row.fr    = fr;
        row.pct   = pct;
        changed   = true;
      }
    });

    if (changed) _throttledRender();

  } catch (e) {
    console.warn('[ScreenerCore] Bybit poll error:', e);
  }
}
```

**Neden Bybit için proxy gerekmez?**
Bybit API'si Avrupa dahil her bölgeden erişilebilir — geo-block yok.
`api.bybit.com` doğrudan tarayıcıdan çağrılabilir.

---

### DEĞİŞİKLİK 4 — `init()` içine polling başlatmayı ekle

`init()` fonksiyonu içinde `_connectWS()` çağrısını sildiğin yere şunu ekle:

```javascript
// Eski: _connectWS();
// Yeni:
_startBinancePolling();  // Binance fiyat polling'i başlat
_startBybitPolling();    // Bybit fiyat polling'i başlat
```

---

### DEĞİŞİKLİK 5 — Tab değiştiğinde polling'i yönlendir

`_setTab()` fonksiyonu içine şunu ekle — tab değişince doğru polling hemen devreye girsin:

```javascript
function _setTab(tab) {
  _activeTab = tab;
  _rows = []; _filtered = [];

  // ... mevcut kod ...

  // Bunu ekle — tab değişince ilgili polling hemen bir kez çalışsın:
  if (tab.startsWith('bn')) _pollBinancePrices();
  if (tab.startsWith('bb')) _pollBybitPrices();
}
```

---

## Özet Tablo

| Yapılacak | Nerede |
|-----------|--------|
| `_connectWS()` fonksiyonunu **iki kez** tanımlı — **ikisini de sil** | `screener-core.js` |
| `let _ws = null;` satırını sil | `screener-core.js` |
| `init()` içindeki `_connectWS()` çağrısını sil | `screener-core.js` |
| `_startBinancePolling()` ve `_pollBinancePrices()` ekle | `screener-core.js` |
| `_startBybitPolling()` ve `_pollBybitPrices()` ekle | `screener-core.js` |
| `init()` içine `_startBinancePolling()` ve `_startBybitPolling()` ekle | `screener-core.js` |
| `_setTab()` içine tab değişim tetikleyicisi ekle | `screener-core.js` |

---

## Kesinlikle Yapılmayacaklar

- `chart-data.js` dosyasına **dokunma** — bu görevin kapsamı dışında
- Binance ve Bybit verilerini **birleştirme**
- `_loadBinanceScreener()` veya `_loadBybitScreener()` REST mantığını **değiştirme**
- 60 saniyelik `setInterval` yenileme döngüsünü **kaldırma**
- `server.js` dosyasına **dokunma**

---

## Test Adımları

1. Sayfayı yenile
2. Binance screener tab'ında 10 saniye bekle — fiyatlar değişiyor mu?
3. Bybit screener tab'ına geç — fiyatlar değişiyor mu?
4. Console'da hata var mı kontrol et
5. Her iki tab'da fiyatlar 5 saniyede bir güncelleniyorsa görev tamamdır
