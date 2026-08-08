# Görev 2 — L/S Verisini Görsel Arayüze Bağlama (Tamamlandı)

**Tarih:** 2026-08-08

## Kapsam

Coin Detail panelindeki mevcut L/S kartı (Binance için), artık `js/data/ls-data-store.js`
üzerinden besleniyor — kendi doğrudan `fetch(...globalLongShortAccountRatio...)`
çağrılarını atmıyor. Sadece görüntüleme değişti, kartın tasarımı/yerleşimi ve
hesaplama formülü (`lsPct = ratio/(1+ratio)*100`) aynen korundu.

## Değişiklikler — `js/screener/detail-panel.js`

1. **Yeni yardımcılar:** `_applyLsMetrics(metrics)` (LSDataStore'un `metrics.global.ratio`
   alanını okuyup mevcut DOM elemanlarını — `dp-ls-buy`, `dp-ls-sell`, `dp-ls-buy-pct`,
   `dp-ls-sell-pct`, `dp-ls-ratio`, `dp-ls-dom` — güncelleyen fonksiyon, eski koddan
   birebir formül), `_lsSubscribe(pairSym)` / `_lsUnsubscribe()` (abonelik yaşam
   döngüsü, `_lsSub` modül değişkeninde tutuluyor).
2. **`loadSymbol()` — Binance dalı:** Eski `await fetch(...globalLongShortAccountRatio...)`
   kaldırıldı. Yerine: `LSDataStore.get(pairSym)` önbellekte varsa anlık ilk boya için
   kullanılıyor, ardından `_lsSubscribe(pairSym)` çağrılıyor — bu hem anında bir
   backfill tetikliyor hem de canlı order book akışını başlatıyor, hem de 30sn'de
   bir REST'i tazeliyor (LSDataStore'un kendi merkezi mantığı, `BotEngine` kuyruğu
   üzerinden).
3. **`loadSymbol()` — Bybit dalı:** Başına `_lsUnsubscribe()` eklendi — borsa
   Bybit'e geçtiğinde eski (Binance) abonelik bırakılıyor. Bybit'in kendisi
   LSDataStore'da henüz desteklenmediği için (faz 2, Görev 3) o taraf hâlâ kendi
   doğrudan fetch'ini kullanıyor, dokunulmadı.
4. **`_pollDetailData()` — Binance dalı:** 10 saniyede bir tekrar eden L/S REST
   fetch'i tamamen kaldırıldı — artık gereksiz, çünkü `loadSymbol()`'da kurulan
   LSDataStore aboneliği zaten kendi döngüsüyle (30sn REST + canlı WS order book)
   `_applyLsMetrics`'i tetikleyip DOM'u güncel tutuyor.

## Mimari kurala uyum

Görev talimatındaki "kimse kendi fetch'ini atmasın" kuralı sağlandı — L/S için
artık tek merkezi kaynak `LSDataStore`, detail panel sadece ona abone oluyor.
Aynı sembole tekrar `loadSymbol()` çağrıldığında (örn. `funding:loaded` event'i
her tetiklendiğinde, mevcut bilinen bir davranış — bkz. `gorevler2.md` izleme
listesi) eski abonelik her seferinde bırakılıp yenisi kuruluyor, **sızıntı yok**.

## Doğrulama (tarayıcıda, gerçek modüllerle, mock sadece `fetch` katmanında)

1. **Abonelik yaşam döngüsü:** `LSDataStore.subscribe`/`unsubscribe` sarmalandı,
   sırasıyla `loadSymbol('ETH')` → `loadSymbol('ETH')` (aynı sembol tekrar,
   funding:loaded senaryosu) → `loadSymbol('SOL')` (sembol değişimi) çağrıldı.
   Sonuç: `unsubscribe(BTCUSDT)→subscribe(ETHUSDT)→unsubscribe(ETHUSDT)→
   subscribe(ETHUSDT)→unsubscribe(ETHUSDT)→subscribe(SOLUSDT)` — her adımda
   tam olarak bir unsubscribe + bir subscribe, hiç birikme yok.
2. **DOM güncellemesi:** `LSDataStore.backfill('SOLUSDT')` gerçek modüllerle
   (mock sadece Binance yanıtlarında) çağrıldı, dönen `metrics.global.ratio=1.5`
   için `dp-ls-buy-pct` → `60.0%`, `dp-ls-sell-pct` → `40.0%`, `dp-ls-buy` bar
   genişliği → `60%` — beklenen formülle birebir eşleşti.
3. **Canlı order book:** Aynı test sırasında `LSDataStore.get('SOLUSDT')` gerçek
   Binance WS'inden gelen `orderBook` verisini (bidVol/askVol/bidAskRatio) de
   içeriyordu — depth stream'in bağımsız olarak, gerçek zamanlı çalıştığı
   doğrulandı.
4. **Konsol hataları:** Test sırasında görülen tüm hatalar (`ScreenerCore`,
   `chart-data.js` — `HTTP 502` / `Failed to fetch`) bu sandbox ortamının
   önceden bilinen ağ kısıtından kaynaklanıyor (Node işleminin `fapi.binance.com`
   DNS'ini çözememesi), `detail-panel.js` veya `ls-data-store.js` ile ilgisi yok.

## Regresyon

- Bybit L/S akışı dokunulmadı, aynı şekilde çalışmaya devam ediyor.
- Kartın görsel tasarımı, formülü, element ID'leri aynen korundu.
- `dp-ls-ratio` ve `dp-ls-dom` elementlerinin index.html'de şu an **var olmadığı**
  fark edildi — bu Görev 2'den önce de böyleydi (eski kod da bu ID'lere yazmaya
  çalışıyordu, `if (el)` ile sessizce no-op oluyordu), yeni bir regresyon değil,
  sadece görüldüğü için not düşülüyor.

## Değişen dosyalar

- `js/screener/detail-panel.js`
