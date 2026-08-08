# Görev 3 — Bybit L/S (Faz 2) (Tamamlandı)

**Tarih:** 2026-08-08

## Kapsam

`js/data/ls-data-store.js`'deki `exchange` iskeleti Bybit için dolduruldu.
Mimari kural korundu: REST çağrıları yine `BotEngine.queueRestRequest()`
üzerinden, order book yine kendi WS'ini açmadan (bu kez `BybitAPI` üzerinden)
geliyor.

## Veri kaynağı kısıtı — önemli, hata değil

Binance'in 4 endpoint'ine (global/topPosition/topAccount/taker) karşılık,
**Bybit'in public API'sinde sadece 1 endpoint var:** `/v5/market/account-ratio`
(`buyRatio`/`sellRatio`). Top trader pozisyon/hesap ayrımı ve taker alım-satım
hacim oranı için Bybit'te herkese açık bir karşılığı yok. Bu yüzden Bybit
için `metrics.topPosition`, `metrics.topAccount`, `metrics.taker` **hep
null** kalıyor — sadece `metrics.global` doluyor (`ratio = buyRatio/sellRatio`).
Bu durum kodda ve şemada açıkça yorumlandı, sessiz bir eksiklik değil.

## Değişiklikler

### `js/data/ls-data-store.js`
- `_restBase(exchange)`: artık `'binance'` ve `'bybit'` için ayrı base URL
  döndürüyor (üçüncü borsa istenirse tek değişecek yer).
- `_fetchRestMetrics` iki alt fonksiyona bölündü: `_fetchBinanceRestMetrics`
  (aynı, değişmedi) ve yeni `_fetchBybitRestMetrics` (`/v5/market/account-ratio`,
  `BotEngine` kuyruğu üzerinden, Bybit'in retCode-tabanlı hız-limit sinyalini
  — `retCode 10006/10018` — `BAN_SIGNAL` olarak BotEngine'e iletiyor; sadece
  HTTP status koduna bakmak yetmezdi, Bybit rate-limit'i çoğunlukla HTTP 200
  içinde retCode ile döner).
- `_depthAdapterFor(exchange)`: order book aboneliğini borsaya göre
  `MarketDataStore.subscribeDepth` (Binance) veya `BybitAPI.subscribeDepth`
  (Bybit) arasında yönlendiren tek nokta.
- `_refreshSubscribed()`'daki `if (exchange !== 'binance') continue` filtresi
  kaldırıldı — artık tüm abone olunmuş borsalar için döngü çalışıyor.

### `js/data/bybit-api.js`
- Yeni `subscribeDepth(symbol, callback)` / `unsubscribeDepth(...)` — mevcut
  `subscribeKline` ile aynı çoklu-abone WS örüntüsü (`wss://stream.bybit.com/v5/public/linear`,
  tek bağlantı, dinamik SUBSCRIBE/UNSUBSCRIBE).
- **Önemli fark:** Bybit'in `orderbook.50.<symbol>` stream'i Binance'in
  partial depth'inin aksine `snapshot` + `delta` gönderiyor (tam liste değil,
  artımlı güncelleme). Bu yüzden Binance'teki gibi "her mesaj zaten tam"
  yaklaşımı kullanılamadı — sembol başına yerel bir `{bids: Map, asks: Map}`
  book state tutulup delta'lar (`qty:"0"` = seviyeyi sil) üzerine uygulanıyor,
  her mesajdan sonra sıralanıp top-20 + toplam hacim hesaplanıyor.

### `server.js`
- Yeni `collectBybitLSData()` — aynı `LS_COLLECTOR_SYMBOLS` (8 coin) listesini
  Bybit'in `account-ratio` endpoint'inden çekip `LSMetrics` koleksiyonuna
  `exchange:'bybit'` olarak yazıyor (sadece `globalRatio`/`globalLongPct`/
  `globalShortPct` dolu, diğerleri null — yukarıdaki kısıt nedeniyle).
- Görev 1'in kademeli başlatma örüntüsüne (`_staggeredStart`) uyularak
  `t=12000ms` gecikmeyle, 5dk periyotla eklendi (Binance L/S'ten hemen sonra,
  mumlardan önce).
- `/api/history/ls/:exchange/:symbol` zaten `exchange`'i URL parametresi
  olarak alıyordu, kod değişikliği gerekmedi — Bybit kayıtları otomatik
  sorgulanabilir hâlde.

## Doğrulama (tarayıcıda, gerçek modüllerle, mock sadece Bybit REST yanıtında)

1. **REST eşleme:** `LSDataStore.backfill('BTCUSDT', 'bybit')` mock
   (`buyRatio:0.62, sellRatio:0.38`) ile çağrıldı → `global.ratio = 1.6316`
   (0.62/0.38), `topPosition/topAccount/taker = null` — beklenen şekilde.
2. **Canlı order book (gerçek Bybit WS, mock YOK):** `BybitAPI.subscribeDepth('BTCUSDT', cb)`
   4 saniyede **349 mesaj** aldı, gerçek BTC fiyatlarıyla (`~64993`),
   `bidVol`/`askVol`/`bidAskRatio` doğru hesaplandı — snapshot+delta merge
   mantığının doğru çalıştığı kanıtlandı.
3. **subscribe/unsubscribe + event:** `LSDataStore.subscribe('ETHUSDT', cb, 'bybit')`
   → `get()` doğru veriyi döndü, `ls:update` event'i `exchange:'bybit'` ile
   ateşlendi, `unsubscribe` sorunsuz.
4. **Desteklenmeyen borsa:** `LSDataStore.backfill('BTCUSDT', 'okx')` hâlâ
   net bir hata fırlatıyor (`"exchange 'okx' desteklenmiyor..."`) — sessizce
   yanlış veri dönmüyor.
5. **Konsol hataları:** Görülen tüm hatalar (`ScreenerCore`, `chart-data.js`
   — `HTTP 502`) bu sandbox'ın önceden bilinen ağ kısıtından, benim
   değişikliklerimle ilgisi yok.
6. **Server-side (`collectBybitLSData`):** `node -c server.js` ile syntax
   doğrulandı; gerçek ağ çağrısı bu sandbox'ta test edilemedi (Node işleminin
   dış DNS erişimi engelli — önceki görevlerde de karşılaşılan, koddan
   kaynaklanmayan bir kısıt). Production'da (`main`) deploy sonrası
   `[Collector] Bybit L/S metrikleri: X/8` log satırıyla doğrulanmalı.

## Regresyon

- Binance L/S akışı (Görev 2'de bağlanan detail panel dahil) dokunulmadı,
  `_fetchBinanceRestMetrics` aynen korundu.
- `MarketDataStore.subscribeDepth` (Binance) değişmedi.

## Değişen dosyalar

- `js/data/ls-data-store.js`
- `js/data/bybit-api.js`
- `server.js`
