# Görev 8 — Delist / Yeni Liste / En Yükselen Uyarısı (Tamamlandı)

**Tarih:** 2026-08-08

## Ek (kullanıcı isteğiyle, aynı gün): kayan bant (ticker/marquee)

İlk teslimde grafik altı bant dropdown'ı sadece Watchlist listesini
filtreliyordu. Kullanıcı ekran görüntüsüyle asıl beklediğinin **o bandın
kendisinde sağdan sola sürekli kayan bir coin şeridi** olduğunu belirtti —
Watchlist filtresine EK olarak istendi, onun yerine değil.

Eklenenler:
- `index.html` — `.cbb-spacer`'ın yanına `#cbb-ticker`/`#cbb-ticker-track`,
  CSS `@keyframes cbb-marquee` (`translateX(0)→translateX(-50%)`, içerik
  iki kez tekrarlanarak dikişsiz döngü).
- `js/screener/screener-core.js` — `_renderTicker(arr)`, `_applyFilterSort()`
  sonunda çağrılıyor. `_previewFilter==='none'` iken tamamen gizli (spacer
  geri gelir). En fazla **30 öğe** basılır (`TICKER_MAX`) — ilk denemede
  tüm listeyi (182 gainer) basınca tur süresi 455 saniyeye çıkıp bant
  pratikte donmuş gibi görünüyordu, test sırasında bulunup düzeltildi;
  süre artık öğe sayısıyla orantılı ama makul bir çarpanla (`1.2s/öğe`,
  min 12s).

**Doğrulama:** Ekran görüntüsü ile görsel olarak doğrulandı — bant gerçek
coinleri doğru renklerle gösteriyor, birkaç saniye arayla alınan iki
ekran görüntüsünde içerik gerçekten kaymış (yeni coin sağdan girmiş,
eskiler sola kaymış). `getComputedStyle().transform` ile otomasyon
üzerinden ölçüm hareketi yakalayamadı (muhtemelen headless ortamın CSS
animasyon render zamanlamasıyla ilgili, gerçek tarayıcıda sorun değil) —
ekran görüntüsü kanıtı yeterli görüldü. "None"a dönünce bant tamamen
gizleniyor, spacer geri geliyor, konsol hatasız.

## Çakışma kontrolü (görev talimatı gereği)

Görev talimatı, grafik altı banttaki boş "No Preview ▾" liste yer
tutucusuyla çakışma ihtimaline karşı önce oraya bakılmasını istiyordu.
Kontrol edildi: **`index.html`'de bu dropdown zaten "Top Gainers /
Delistings / New Listings" seçeneklerini içeriyordu** — `app.js`'deki
`_bindChartBottomBar()` sadece seçileni etiket olarak gösteriyor, gerçek
bir filtre uygulamıyordu (bkz. `2026-08-01-bant-duzeltmeleri-liste-ikonu.md`).
Bu, ayrı bir uyarı sistemi kurmak yerine **bu mevcut dropdown'ı gerçek bir
Watchlist filtresine bağlamanın** doğru yaklaşım olduğunu gösterdi — tekrar
iş yapılmadı, mevcut UI iskeleti dolduruldu.

## Sunucu tarafı — `server.js`

### Yeni koleksiyonlar

- **`SymbolStatus`** — her (borsa, market, sembol) için en son bilinen
  Binance `status` değerini tutan bir cache (upsert).
- **`SymbolStatusEvent`** — durum değişikliği tespit edildiğinde yazılan
  append-only olay kaydı (`category: 'delist_warning' | 'new_listing'`,
  30 gün TTL).

### Yeni toplayıcı — `collectSymbolStatusChanges()`

Binance'in `/fapi/v1/exchangeInfo` (futures) ve `/api/v3/exchangeInfo`
(spot) endpoint'lerini (**public, kimlik doğrulama gerekmez** — Görev 8'in
araştırma notunda doğrulanmıştı) çekip önceki turdaki `SymbolStatus` ile
karşılaştırıyor:

- Futures: `TRADING→SETTLING` = `delist_warning`, `PENDING_TRADING→TRADING`
  = `new_listing`
- Spot: `TRADING→BREAK` = `delist_warning`
- Her iki markette: önceden hiç görülmemiş bir sembolün ilk kez
  `TRADING` olarak görünmesi de `new_listing` sayılıyor
- **İlk tur (bootstrap) hiç olay üretmiyor** — sadece mevcut durumu
  kaydediyor, aksi hâlde her yeniden başlatmada ~2700 sembolün hepsi için
  sahte "yeni" olayı üretilirdi

Görev 1'in kademeli başlatma örüntüsüne (`_staggeredStart`, t=20s, 15dk
periyot) eklendi — 2 hafif istek (~40 weight), sık taramaya gerek yok
(delisting duyuruları günler/haftalar önceden gelir).

### Yeni endpoint

`GET /api/symbol-status/events?hours=168&market=futures|spot` — son N
saatteki olayları döndürür (varsayılan 7 gün, azami 30 gün).

## İstemci tarafı

### Yeni dosya — `js/data/symbol-alerts-store.js`

Sunucunun `/api/symbol-status/events`'ini 5 dakikada bir çeken merkezi
modül. **BotEngine kuyruğu kullanılmadı** — bu bizim kendi backend'imize
giden bir istek, Binance IP bütçesini etkilemiyor (mimari kural zaten
BotEngine'i sadece Binance'e giden isteklere zorunlu kılıyor). Sadece
Binance kapsıyor — Bybit için aynı public status mekanizması
araştırılmadı, `getAlert()` Bybit sembolleri için her zaman `null` döner
(yanlış/eksik veri göstermek yerine).

### `js/screener/screener-core.js`

- Satır rozetleri: `DELIST` (turuncu), `NEW` (yeşil) — `SymbolAlertsStore`'dan,
  sadece `_exchange==='binance'` iken. `🔥` (en yükselenlerden) — her iki
  borsada da, tamamen client-side `pct24h`'ten hesaplanıyor, yeni veri
  kaynağı gerekmiyor.
- **Rozetler hem SPOT hem FUTURES'ta çalışıyor** (görev şartı) — market
  parametresi `getAlert(sym, _market)`'e geçiliyor, doğru markete ait
  olayı gösteriyor.
- Grafik altı bant dropdown'ı artık `EventBus.emit('screener:previewFilter', ...)`
  ile gerçek bir filtre tetikliyor: "Delistings"/"New Listings" seçilince
  liste sadece o kategorideki coinlere daralıyor; "Top Gainers" pozitif
  coinleri en yükselenden sıralıyor.
- Bybit'te "Delistings"/"New Listings" seçilirse boş liste yerine **açık bir
  mesaj** gösteriliyor ("Not available for Bybit yet").

### `js/core/app.js`

`_bindChartBottomBar()` artık sadece etiket değiştirmiyor, gerçek filtre
event'ini yayınlıyor.

## Kapsam kararı — turuncu→kırmızı gradyan yapılmadı

Görev metni "turuncu→kırmızı (yaklaşan→kesin)" bir renk geçişi istiyordu.
Bu, delisting'in **tam kaldırılma tarihini** bilmeyi gerektirir — ama
`exchangeInfo`'nun `status` alanı sadece "şu an SETTLING/BREAK" bilgisini
veriyor, kesin kaldırılma zamanını vermiyor (resmi delist-schedule
endpoint'i kimlik doğrulaması istiyor, kullanılmadı — bkz. araştırma notu).
Bu yüzden **tek, sabit turuncu bir rozet** kullanıldı (`DELIST`) —
gerçekte sahip olmadığımız bir "ne kadar yakın" bilgisini uydurmaktansa,
dürüst bir tek-durumlu uyarı tercih edildi. İleride resmi endpoint için
kullanıcı kendi Binance API key'ini bağlamak isterse, gradyan o zaman
eklenebilir.

## Doğrulama (tarayıcıda, gerçek modüllerle, mock sadece `/api/symbol-status/events`)

1. **Veri katmanı:** `SymbolAlertsStore.refresh()` mock olaylarla çağrıldı
   — `getAlert('BTCUSDT','spot')` → `delist_warning`, `getAlert('ETHUSDT','spot')`
   → `new_listing`, `getAlert('SOLUSDT','futures')` → `delist_warning`,
   **`getAlert('BTCUSDT','futures')` → `null`** (market'e göre doğru
   ayrışıyor, spot'taki BTC delist uyarısı futures'a sızmıyor).
2. **Satır rozetleri:** SPOT listesinde BTC satırında gerçek `DELIST`
   rozeti, ETH satırında gerçek `NEW` rozeti DOM'da doğrulandı (doğru
   renk/tooltip).
3. **Grafik altı bant filtresi:**
   - "Delistings" → sadece BTC göründü (1 satır)
   - "New Listings" → sadece ETH göründü (1 satır)
   - "Top Gainers" → 205 satır, hepsi pozitif değişimli, en yükselenden
     sıralı, ilk 3'ünde 🔥 rozeti, 4.'de yok (TOP_N=3 doğru çalışıyor)
   - "No Preview" → normal listeye (396 satır) geri dönüldü
4. **Bybit'te delist/new-listing filtresi:** boş liste yerine "Not
   available for Bybit yet" mesajı gösterildi — sessizce yanlış/boş veri
   yerine açık bir uyarı.
5. **Konsol hataları:** Hiç yok (bu test turunda futures/Binance proxy
   çağrısına dokunulmadı, sandbox'ın bilinen 502 kısıtı devreye girmedi).

## Regresyon

- Mevcut sinyal/Combo rozetleri (Kom1/2/3) değişmedi, hâlâ sadece
  `_market==='futures'` iken gösteriliyor.
- Grafik altı bandın diğer elemanları (saat, timezone menüsü) dokunulmadı.

## Değişen dosyalar

- `server.js`
- `js/data/symbol-alerts-store.js` (yeni)
- `js/screener/screener-core.js`
- `js/core/app.js`
- `index.html`
