# Sıradaki Görevler 2 — Pintrade

**Amaç:** Kullanıcı yokken (uyurken / limit dolu) Claude Code'un
sırayla ilerlemesi için hazır iş kuyruğu. Önceki kuyruk
(`siradaki-gorevler.md`) 2026-08-07'de tamamlandı (5/5 görev).

## Kullanım (Claude Code için)

1. Bu dosyayı oku.
2. **Sırayla, yukarıdan aşağıya** ilerle. Bir görev bitmeden diğerine geçme.
3. Her görev bittiğinde:
   - Görevin başlığındaki `[ ]` işaretini `[x]` yap
   - Görevin altındaki "Rapor" bölümüne, kaydettiğin `.md` rapor dosyasının adını yaz
   - Sonraki göreve geç
4. **Kritik hata çıkarsa DUR.** Bu dosyaya "⚠️ DURDU — sebep: ..." yaz ve bekle.
5. **"⏸ DUR — kullanıcı onayı bekle" yazan görevlerden ÖNCE DUR.** Yaptığın işlerin özetini bırak, kullanıcı gelip devam de-yene kadar bekle.
6. Görevler arası bağlam penceresi çok dolarsa, kullanıcıya "yeni chat açman önerilir" notu bırak — kendi kendine yeni chat açamazsın, ama kullanıcı geldiğinde okusun.

Her rapor için standart format: değişen dosyalar listesi, ölçümler, doğrulama testleri, varsa regresyon uyarıları.

---

## [x] Görev 1 — Toplayıcı açılış zamanlamasını yay (ACİL, onay gerekmez, hemen başla)

**Tamamlandı (2026-08-08).** Rapor: `dokumentasyon/raporlar/2026-08-08-gorev1-toplayici-zamanlama-tamamlanma.md`

**Sebep (2026-08-08):** Sunucu her açıldığında `mongoose.connection.once('open', ...)` içindeki FR, Bybit, mum (526 sembol) ve şimdi L/S toplayıcılarının hepsi **aynı anda** ateşleniyor. Bu ani yük Binance'in geçici hız-limitine (`code:-1003 "Way too many requests"`) takılıp gerçek üretim ortamında (`pintrade-uwg9.onrender.com`) **11 saatlik IP ban**'a yol açtı. Bu, L/S toplayıcısından önce de var olan bir risk (mum toplayıcısı zaten 526 sembol tarıyordu), L/S eklenince ölçülür hâle geldi.

### Yapılacak

- `server.js`'deki `mongoose.connection.once('open', ...)` bloğu içinde art arda çağrılan `collectBinanceData()`, `collectBybitData()`, `collectBinanceCandles()`, `collectLSData()` ilk çağrılarını, aralarında birkaç saniye (5-10sn) gecikmeyle sıraya diz — hepsi aynı anda değil, art arda ateşlensin.
- `setInterval` ile kurulan periyodik tekrarlar da aynı mantıkla düşünülmeli: hepsi aynı andan (`t=0`) başlarsa, her periyodun tam katında (örn. her 5 dakikada bir) yine üst üste binebilirler. Mümkünse periyodik başlangıçları da birbirinden kaydır (örn. `setTimeout` ile ilk tetiklemeyi farklı gecikmelerle başlatıp sonra `setInterval`'a geç — mevcut OI poller'ın (`market-data-store.js`) zaten kullandığı örüntüye benzer).
- Binance ağırlık bütçesini kabaca hesapla (hangi toplayıcı ne kadar weight harcıyor, art arda dizilince tepe yük nasıl değişiyor) ve rapora yaz.

### Doğrulama

- Sunucuyu yeniden başlatıp log sırasını gözlemle — toplayıcılar gerçekten art arda mı tetikleniyor?
- Mümkünse gerçek ortamda (Render) bir yeniden başlatma sonrası birkaç dakika `code:-1003` hatası görülmediğini doğrula (loglardan veya `/api/history/*` endpoint'lerinin veri üretmeye devam ettiğini kontrol ederek).
- Mevcut FR/OI/mum/L/S toplayıcılarının işlevselliğinde regresyon olmadığını doğrula.

**Rapor:** `2026-08-08-gorev1-toplayici-zamanlama-tamamlanma.md`

---

## [ ] ⏸ DUR — kullanıcı onayı bekle (Görev 2'den önce)

Görev 1 bittikten sonra **DURACAKSIN**. Görev 2 (L/S verisini görsel arayüze bağlama) kullanıcının açıkça "Görev 2'ye geç" demesini bekliyor.

Bu bloğu geçmek için kullanıcı açıkça "Görev 2'ye geç" demeli. Aksi halde bekle.

Bu bloğun `[x]` işareti sadece kullanıcının onayı geldikten sonra kaldırılır.

---

## [x] Görev 2 — L/S verisini görsel arayüze bağlama

**Tamamlandı (2026-08-08).** Rapor: `dokumentasyon/raporlar/2026-08-08-gorev2-ls-detail-panel-entegrasyonu.md`

**Kapsam:** Coin Detail panelindeki mevcut L/S kartını, artık gerçek veri sağlayan `/api/history/ls/:exchange/:symbol` endpoint'inden (ve/veya canlı `LSDataStore.subscribe()`'dan) besle. **Sadece görüntüleme** — yeni hesaplama/mantık ekleme, mevcut kartın tasarımını/yerleşimini değiştirme.

- `js/screener/detail-panel.js`'deki mevcut L/S kartını (`dp-ls-buy`/`dp-ls-sell` vb.) bul.
- Şu an kartın doğrudan `fetch(...globalLongShortAccountRatio...)` yaptığı yerleri, `LSDataStore.subscribe()`/`LSDataStore.get()` üzerinden okumaya çevir (mimari kural: kimse kendi fetch'ini atmasın, bkz. `js/data/ls-data-store.js` başlığı).
- Kartta sadece global L/S oranı mı gösteriliyor, yoksa top trader oranlarını (topPosition/topAccount) da eklemek mi isteniyor — kullanıcıya danışmadan kapsam genişletme, mevcut kart neyi gösteriyorsa onu doğru veriyle besle.

### Doğrulama

- Detail panel açıldığında kart gerçek, güncel veriyle doluyor mu?
- Panel kapatılıp açıldığında (veya sembol değiştiğinde) `LSDataStore.subscribe`/`unsubscribe` doğru tetikleniyor mu (bellek sızıntısı / birikmiş abonelik yok)?
- Konsol hatası yok mu?

**Rapor:** `2026-08-08-gorev2-ls-detail-panel-entegrasyonu.md`

---

## [ ] ⏸ DUR — kullanıcı onayı bekle (Görev 3'ten önce)

Görev 2 bittikten sonra **DURACAKSIN**. Görev 3 (Bybit L/S faz 2) ayrı, kullanıcı onayı gerektiren bir genişleme.

Bu bloğu geçmek için kullanıcı açıkça "Görev 3'e geç" demeli. Aksi halde bekle.

Bu bloğun `[x]` işareti sadece kullanıcının onayı geldikten sonra kaldırılır.

---

## [x] Görev 3 — Bybit L/S (faz 2)

**Tamamlandı (2026-08-08).** Rapor: `dokumentasyon/raporlar/2026-08-08-gorev3-ls-bybit-faz2.md`

`js/data/ls-data-store.js`'deki `exchange` parametresi zaten hazır iskelet (`'binance'` dışında bir değer verilirse şu an hata fırlatıyor). Bybit'in eşdeğer endpoint'lerini entegre et:

- `GET /v5/market/account-ratio?category=linear&symbol=...&period=...` (Bybit'in L/S oran karşılığı — Binance'in 4 endpoint'inden hangisine/hangilerine denk geldiğini doğrula, Bybit dokümantasyonunu kontrol et)
- Order book için Bybit'in WS depth stream'i (`js/data/market-data-store.js`'deki `subscribeDepth` örüntüsünü genişlet veya paralel bir Bybit yolu ekle — mimari kural: yine tek merkezi kaynak, kimse kendi WS'ini açmasın)
- `LSMetrics` şemasındaki `exchange` alanı zaten `'binance'|'bybit'` için hazır — Bybit kayıtları da aynı koleksiyona yazılsın.
- Rate-limit etkisini ölç ve rapora yaz (Bybit'in kendi ağırlık limitleri farklı olabilir).

### Doğrulama

- `LSDataStore.subscribe(symbol, cb, 'bybit')` gerçek veri döndürüyor mu?
- Binance tarafında regresyon yok mu?

**Rapor:** `2026-08-08-gorev3-ls-bybit-faz2.md`

---

## [x] Görev 4 — fr-tracker.js'in yanlış backend'e gitmesi (bug, düşük öncelik ama gerçek)

**Tamamlandı (2026-08-08).** Rapor: `dokumentasyon/raporlar/2026-08-08-gorev4-fr-tracker-backend-duzeltmesi.md`

**Sebep:** `fr-tracker.js`'in bazı istekleri `AppConfig.BACKEND_URL` yerine doğrudan eski/hardcoded `pintrade.onrender.com` adresine gidiyor, bu da CORS hatasına yol açıyor. Backend adresi `pintrade-uwg9`'a güncellendiği için (bkz. `js/core/app-config.js`, 2026-08-08 düzeltmesi) bu URL'in de tamamen `AppConfig.BACKEND_URL`'e (veya `AppConfig.API.binance.restFutures`'e, bağlama göre) bağlanması gerekiyor.

### Yapılacak

- `js/screener/fr-tracker.js` içinde `pintrade.onrender.com` veya başka hardcoded backend URL'i geçen tüm yerleri bul (`grep -n "pintrade" js/screener/fr-tracker.js` veya `pintrade\.onrender\.com` deseniyle tüm `js/` klasöründe genel bir tarama da yap — başka dosyalarda da aynı hata olabilir).
- Bulunanları `AppConfig.API.binance.restFutures` / `AppConfig.SYNC_API` gibi doğru merkezi sabitlere bağla.
- Aynı taramayı `js/screener/fr-tracker.js:263` ve `:459` civarındaki `AppConfig?.API?.binance?.restFutures?.replace(...)` gibi kırılgan fallback örüntülerine de uygula — bunlar da hardcoded string içeriyor olabilir, kontrol et.

### Doğrulama

- CORS hatası konsolda görünmüyor mu?
- FR tracker normal çalışıyor mu (sinyaller, geçmiş)?

**Rapor:** `2026-08-08-gorev4-fr-tracker-backend-duzeltmesi.md`

---

## [ ] ⏸ DUR — kullanıcı onayı bekle (Görev 5'ten önce)

Görev 4 bittikten sonra **DURACAKSIN**. Görev 5 (alarm → chart zaman yolculuğu) UI/UX kararları içeren bir özellik, kullanıcı onayı gerekiyor.

Bu bloğu geçmek için kullanıcı açıkça "Görev 5'e geç" demeli. Aksi halde bekle.

---

## [ ] Görev 5 — Alarm kartına tıklayınca chart'ın sinyalin tarihine gitmesi ("zaman yolculuğu")

**Ertelendi (2026-08-08):** Kullanıcı "zor iş olabilir, şimdilik atlayalım" dedi — iptal değil, ertelendi. Sırada beklemeye devam ediyor, ne zaman istenirse ele alınır.

**Bağlam:** Alarm demo kartları çalışırken bilinçli olarak ertelenmişti (o zamanki not: "kolaydan başlayalım, sonra bu eklenir" — bkz. `dokumentasyon/raporlar/2026-08-07-alarm-sekmesi-sinyal-gecmisi-kartlari-demo.md`). Şimdi sırası.

### Yapılacak

- Alarm kartına tıklanınca chart sadece coin'e değil, **sinyalin oluştuğu tarihe/saate de atlasın**, o mumu işaretlesin (görsel vurgulama — ok, dikey çizgi, veya highlight, mevcut çizim araçlarındaki bir örüntüyü referans al).
- `js/screener/alarm-signal-history.js`'deki kart tıklama handler'ını bul, chart'ın zaman ekseni navigasyon API'sini (`chart-core.js`/`chart-pane.js`) kullanarak ilgili timeframe + zaman aralığına scroll/zoom et.
- Sinyal timeframe'i (5m/15m/1h/4h/1d) ile chart'ın o an açık olduğu timeframe farklıysa ne olacağına karar ver (otomatik timeframe değiştir mi, yoksa sadece mevcut timeframe'de en yakın zamana mı git) — makul bir varsayılan seç, rapora yaz.

### Doğrulama

- Karta tıklandığında chart doğru coin + doğru zamana gidiyor mu?
- İşaretleme görsel olarak net mi, mevcut çizimlerle çakışmıyor mu?
- Farklı timeframe'lerde test edildi mi?

**Rapor:** `2026-XX-XX-alarm-zaman-yolculugu.md`

---

## [ ] ⏸ DUR — kullanıcı onayı bekle (Görev 6'dan önce)

Görev 5 bittikten sonra **DURACAKSIN**. Görev 6 (önerilen giriş fiyatı + geri ölçüm) yeni bir veri modeli/şema kararı içeriyor, kullanıcı onayı gerekiyor.

Bu bloğu geçmek için kullanıcı açıkça "Görev 6'ya geç" demeli. Aksi halde bekle.

---

## [ ] Görev 6 — Alarm'a "önerilen giriş fiyatı" + geri ölçüm kaydı

**Kullanıcının fikri:** Sinyal geldiğinde sadece bildirim değil, önerilen giriş fiyatı da gösterilsin ve veritabanına kaydedilsin — kaçırılan sinyaller sonradan geri ölçülebilsin.

**Başlangıç modeli (en basit):** öneri fiyatı = sinyalin oluştuğu barın kapanış fiyatı.

### Yapılacak

- Yeni bir MongoDB koleksiyonu (örn. `AlarmSuggestion` veya mevcut sinyal kaydına alan ekleme — hangisi daha uygun karar ver) — `symbol, kom, timestamp, suggestedEntryPrice, barCloseTime` gibi alanlar.
- Sinyal üretildiği anda (şu an alarm kartları demo/placeholder veri kullanıyor — gerçek sinyal üretim mantığı henüz yok, bkz. Kom1/2/3 notu) bu kaydın nereden tetikleneceğini netleştir. **Eğer gerçek sinyal motoru henüz yoksa**, bu görev sadece veri modelini ve UI gösterimini hazırlayıp, gerçek veriyle beslenmeyi Kom1/2/3 motoru geldiğinde bağlamak üzere DUR ve kullanıcıya bunu bildir — sahte/placeholder sinyal verisine gerçek fiyat kaydı üretme.
- UI: alarm kartında "Önerilen giriş: $X" gibi bir gösterim ekle.
- Geri ölçüm: önerilen fiyat ile şu anki (veya belirli bir süre sonraki) fiyat arasındaki farkı hesaplayıp gösterecek basit bir görünüm (bu turda sadece kayıt + ham fark gösterimi yeterli, gelişmiş backtest istatistikleri kapsam dışı).

### Doğrulama

- Kayıt gerçekten MongoDB'ye yazılıyor mu (gerçek sinyal akışı varsa)?
- UI'da öneri fiyatı doğru gösteriliyor mu?

**Rapor:** `2026-XX-XX-alarm-oneri-fiyati-geri-olcum.md`

---

## [ ] ⏸ DUR — kullanıcı onayı bekle (Görev 7'den önce)

Görev 6 bittikten sonra **DURACAKSIN**. Görev 7 (Watchlist SPOT gerçek işlevi) kullanıcı onayı gerekiyor.

Bu bloğu geçmek için kullanıcı açıkça "Görev 7'ye geç" demeli. Aksi halde bekle.

---

## [x] Görev 7 — Watchlist SPOT placeholder'ının gerçek işlevi

**Tamamlandı (2026-08-08).** Rapor: `dokumentasyon/raporlar/2026-08-08-gorev7-watchlist-spot-gercek-islev.md`
**Kapsam notu:** Kullanıcı onayıyla sadece liste (symbol/fiyat/değişim/hacim, canlı) yapıldı — tam grafik desteği (chart-data.js'e market boyutu eklemek) kasıtlı olarak dışarıda bırakıldı, ayrı bir iş olarak istenirse ele alınabilir. `dayOpen` sütunu da bu turda doldurulmadı (SPOT rolling 24h kullanıyor, futures ile aynı), izleme listesinde kalmaya devam ediyor.

**Bağlam:** SPOT şu an menüde var ama tıklanınca "yakında" mesajı veriyor (bkz. `siradaki-gorevler.md` Görev 1.2). Gerçek işlevi: **sadece** USDT çiftli coin listesi + grafik/fiyat/değişim gösterme — **sinyal katılmayacak**.

### Yapılacak

- `js/screener/watchlist-menu.js`/`watchlist-store.js`'deki SPOT filtresini gerçek bir veri kaynağına bağla — `js/data/binance-api.js`/`js/data/bybit-api.js`'deki spot REST/WS'i kullan (mevcut merkezi mimari kuralına uy: yeni bir fetch döngüsü açma, mevcut `MarketDataStore` örüntüsünü SPOT için de genişlet veya ayrı bir `SpotDataStore` gerekiyorsa BotEngine/MarketDataStore ile aynı disiplinde kur).
- SPOT listesinde sinyal/alarm/bot sütunları hiç görünmesin — sadece symbol, price, chg%, hacim gibi temel sütunlar.
- Watchlist'teki mevcut "dayOpen" (UTC gün başı fiyatına göre değişim) sütun seçeneğinin veri kaynağı da yok (bkz. `watchlist-store.js:237,247,254` — "henüz veri kaynağı yok" notu) — SPOT işi kapsamında bu veri kaynağı zaten eklenecekse `dayOpen`'ı da doldurmayı değerlendir, değilse ayrı not düş.

### Doğrulama

- SPOT filtresi seçildiğinde gerçek USDT spot coin listesi geliyor mu?
- FUTURES'a dönüldüğünde eski davranış korunuyor mu?
- Sinyal/bot sütunları SPOT'ta gizli mi?

**Rapor:** `2026-08-08-gorev7-watchlist-spot-gercek-islev.md`

---

## [ ] ⏸ DUR — kullanıcı onayı bekle (Görev 8'den önce)

Görev 7 bittikten sonra **DURACAKSIN**. Görev 8, Görev 7'ye bağımlı (SPOT verisi olmadan yapılamaz) ve kullanıcı onayı gerekiyor.

Bu bloğu geçmek için kullanıcı açıkça "Görev 8'e geç" demeli. Aksi halde bekle.

---

## [x] Görev 8 — Visivero'dan alınan delist/yeni liste/en yükselen uyarısı özelliği

**Tamamlandı (2026-08-08).** Rapor: `dokumentasyon/raporlar/2026-08-08-gorev8-delist-uyarisi.md`
**Kapsam notu:** Sadece Binance (spot+futures) kapsandı, Bybit için aynı public status mekanizması araştırılmadı — faz 2. Turuncu→kırmızı gradyan yapılmadı (kesin kaldırılma tarihi verisi yok, kimlik doğrulama gerektiren resmi endpoint kullanılmadı) — tek, sabit turuncu rozet kullanıldı. Grafik altı banttaki mevcut "No Preview ▾" dropdown'ı (Top Gainers/Delistings/New Listings) gerçek filtreye bağlandı, ayrı bir UI kurulmadı.

**Bağımlılık:** Görev 7 (SPOT verisi) tamamlanmadan bu görev başlayamaz.

**Araştırma (2026-08-08, tamamlandı — kullanıcı isteğiyle):**

**Delist SADECE spot'ta olmuyor, hem spot'ta hem futures'ta ayrı ayrı (bazen aynı anda, bazen farklı tarihlerde) oluyor.** Gerçek örnekler bulundu: bazı coinler sadece futures'tan (`"Delistings impact only futures trading without affecting spot markets"`), bazıları sadece spot'tan, bazıları ikisinden birlikte ama farklı tarihlerde kaldırılıyor (örn. futures pozisyonları önce kapatılıyor, spot işlem birkaç gün/hafta sonra duruyor). Bu yüzden Görev 7'nin SPOT verisine bağımlı olması **yeterli değil** — FUTURES tarafında da ayrıca izlenmesi gerekiyor (zaten screener FUTURES verisini çekiyor, ek bir kaynak gerekmiyor).

**Kullanılabilir, PUBLIC (kimlik doğrulama GEREKMEYEN) sinyaller bulundu — resmi "delist-schedule" endpoint'leri (`/sapi/v1/spot/delist-schedule`, `/sapi/v1/margin/delist-schedule`) gerçek bir Binance API key/imza gerektiriyor (test edildi: `-2008 Invalid Api-Key ID`) — kullanıcının kendi Binance hesabına bağlanmak anlamına gelir, bu ayrı bir onay gerektirir, şimdilik ÖNERİLMİYOR.** Bunun yerine, zaten çektiğimiz `exchangeInfo` endpoint'lerinin (ekstra istek gerekmez, mevcut `screener-core.js`/`server.js` akışının parçası) `status` alanı gerçek zamanlı sinyal olarak doğrulandı:

| Kaynak | Alan | Anlamı | Doğrulandı mı |
|---|---|---|---|
| `fapi.binance.com/fapi/v1/exchangeInfo` (futures, public) | `status: "SETTLING"` | Perpetual sözleşme kapatılma sürecinde — **delisting sinyali** | ✅ canlı örnekler bulundu (OMGUSDT, WAVESUSDT, MKRUSDT, DEFIUSDT, ...) |
| aynı | `status: "PENDING_TRADING"` | Yakında listelenecek — **yeni liste sinyali** | ✅ canlı örnek (GAIBUSDT) |
| aynı | `onboardDate` | Sembolün ilk listelenme tarihi | ✅ en yeni 8 sembol doğru sıralandı (en yenisi GRVTUSDT, 2026-07-31) |
| `api.binance.com/api/v3/exchangeInfo` (spot, public) | `status: "BREAK"` | Spot işlem durdurulmuş — delisting/askıya alma | ✅ WAVESUSDT hem futures'ta SETTLING hem spot'ta BREAK (tutarlı) |

**Kısıt:** `exchangeInfo` sadece ANLIK durumu verir, "ne zaman TRADING'den SETTLING'e geçti" bilgisini vermez — "yeni duyuruldu" ile "aylardır SETTLING" ayrımı için **periyodik polling ile durum geçişini biz kendimiz tespit etmemiz** gerekiyor (zaten periyodik çekilen exchangeInfo'yu önceki turla karşılaştırıp `TRADING→SETTLING/BREAK`, `PENDING_TRADING→TRADING` gibi geçişleri MongoDB'ye kaydetmek yeterli — yeni bir dış kaynağa gerek yok).

**"Günün en yükseleni" için ek kaynağa gerek yok** — `pct24h` zaten `MarketDataStore`/screener üzerinden akıyor, sadece sıralama/filtreleme UI'da.

### Yapılacak (araştırma sonrası güncellendi)

- Watchlist'te hem SPOT hem FUTURES modunda, etkilenen coin satırında kategoriye göre rozet göster: **delist** (turuncu→kırmızı, SETTLING/BREAK durum geçişinden), **yeni listelenen** (yeşil/mavi, PENDING_TRADING→TRADING geçişi veya `onboardDate` yakınlığından), **günün en yükseleni** (mevcut `pct24h`'ten, yeni veri kaynağı gerekmez).
- Durum geçişlerini tespit edip saklamak için küçük bir sunucu-taraflı iz (örn. yeni bir Mongo koleksiyonu veya mevcut bir koleksiyona alan ekleme) gerekebilir — tasarım kararı, uygulamaya geçmeden önce netleştirilmeli.
- Grafik altı banttaki mevcut boş "No Preview ▾" liste yer tutucusuyla (bkz. `2026-08-01-bant-duzeltmeleri-liste-ikonu.md` — "Sıradaki adım") bu işin çakışıp çakışmadığını kontrol et; aynı UI alanı paylaşılıyor olabilir, tekrar iş yapmamak için önce oraya bak.

### Doğrulama

- Uyarı gerçek/güncel verilerle mi çalışıyor, yoksa statik bir liste mi (statikse açıkça belirt)?
- Delist rozeti hem SPOT hem FUTURES'ta doğru görünüyor mu (ikisi ayrı ayrı olabildiği için)?
- Yeni listelenen ve en yükselen kategorileri doğru veriyle çalışıyor mu?

**Rapor:** `2026-08-08-gorev8-delist-uyarisi.md`

---

## [ ] ⏸ DUR — kullanıcı onayı bekle (Görev 9'dan önce)

Görev 8 bittikten sonra **DURACAKSIN**. Görev 9 güvenlik odaklı, kullanıcı onayı gerekiyor (özellikle `express.static` kapsamının daraltılması davranış değişikliği yaratabilir).

Bu bloğu geçmek için kullanıcı açıkça "Görev 9'a geç" demeli. Aksi halde bekle.

---

## [x] Görev 9 — Güvenlik açıkları (2026-08-08 taramasında doğrulandı, henüz kuyrukta değildi)

**Tamamlandı (2026-08-10).** Rapor: `dokumentasyon/raporlar/2026-08-10-gorev9-guvenlik-duzeltmeleri.md`

Kod taraması sırasında (bu dosyanın hazırlanışı, 2026-08-08) `dokumentasyon/raporlar/2026-07-31-kod-incelemesi.md`'de daha önce tespit edilmiş ama hâlâ düzeltilmemiş iki güvenlik maddesi bulundu:

### 9.1 — Sunucu kök dizini tamamen herkese açık

`server.js:15` → `app.use(express.static(__dirname));` — bu, `server.js`, `package.json`, `.env.example`, `dokumentasyon/` klasörü gibi her şeyi tarayıcıdan doğrudan indirilebilir hâle getiriyor (`https://.../server.js` gibi).

**Yapılacak:** `express.static` kapsamını sadece gerçekten servis edilmesi gereken statik dosyalarla (örn. `index.html`, `css/`, `js/`, `assets/` gibi) sınırla — ya bir `public/` klasörüne taşı ya da `express.static` çağrısına açık bir dosya/klasör listesi ver. Kapsamı daraltırken mevcut sitenin bozulmadığından emin ol (tüm CSS/JS/asset path'leri hâlâ çalışmalı).

### 9.2 — Çizim senkronunda kimlik doğrulama yok

`server.js` (`/api/sync/drawings` route'ları) → `syncKey` var ama doğrulanmıyor, anahtarı bilen/tahmin eden başkasının çizimlerini okuyup yazabilir. Ayrıca bu route'ta rate limit de yok.

**Yapılacak:** En azından basit bir rate-limit ekle (örn. `express-rate-limit`). `syncKey`'in nasıl üretildiğini/paylaşıldığını incele — eğer kullanıcıya özel, tahmin edilemez bir değer olarak zaten üretiliyorsa (UUID gibi) bu risk düşük olabilir, kod tabanında nasıl üretildiğini bul ve rapora yaz; tahmin edilebilir bir değerse (kısa/sıralı) güçlendir.

### Doğrulama

- Site normal çalışmaya devam ediyor mu (statik dosyalar, çizim senkronu)?
- `server.js` artık tarayıcıdan indirilemiyor mu?

**Rapor:** `2026-08-10-gorev9-guvenlik-duzeltmeleri.md`

---

## [x] ⏸ DUR — kullanıcı onayı bekle (Görev 10'dan önce)

**Not (2026-08-08):** Kullanıcı Görev 9'u (güvenlik) ERTELEDİ (iptal değil —
"önce sitenin doğru/fonksiyonel çalışması" önceliğiyle), Görev 10'a
sıra dışı geçildi. Görev 9 hâlâ bekliyor, kullanıcı "Görev 9'a geç" dediğinde
ele alınacak.

Bu bloğu geçmek için kullanıcı açıkça "Görev 10'a geç" demeli. Aksi halde bekle.

---

## [x] Görev 10 — Doğrulanmış ölü kod / hesaplama hataları (2026-08-08 taramasında bulundu)

**Tamamlandı (2026-08-08).** Rapor: `dokumentasyon/raporlar/2026-08-08-gorev10-olu-event-ve-oi-duzeltmeleri.md`
**Bulgu:** Mum tipi menüsünde 11 seçenek var ama chart motoru sadece 4'ünü destekliyor (candlestick/bar/line/area) — kalan 7'si (heikinashi, hollow, baseline vb.) için ayrı seri implementasyonu yok, ayrı bir özellik işi. Şimdilik "henüz desteklenmiyor" toast'ı gösteriliyor.

Kod taraması sırasında koda bakılarak doğrulanmış, henüz hiçbir kuyrukta olmayan somut hatalar:

### 10.1 — Binance OI (açık pozisyon) geçmişi hep 0 kaydediyor

`server.js`'deki `collectBinanceData()` içinde `oi = parseFloat(f.openInterest) || 0` satırı, `/fapi/v1/premiumIndex` yanıtında **olmayan** bir alanı okuyor (bu endpoint sadece `symbol, markPrice, indexPrice, estimatedSettlePrice, lastFundingRate, interestRate, nextFundingTime, time` döndürüyor — doğrulandı, `2026-07-31-kod-incelemesi.md`'de tespit edilmiş). Sonuç: `NaN || 0 = 0` → `MarketData` koleksiyonundaki Binance OI geçmişi tamamen sıfır, `/api/history/market` bu alan için kullanılamaz. Bybit tarafı doğru çalışıyor.

**Not:** Bu, bu projede (L/S görevinde) `takerlongshortRatio`'nun `symbol` alanı olmadığını bulup düzelttiğim hatayla **aynı sınıf hata** — yanlış/var olmayan alan okuma. Gerçek OI değeri için `/fapi/v1/openInterest?symbol=...` endpoint'i ayrıca çağrılmalı (client tarafında `js/screener/oi-api.js` bunu zaten doğru yapıyor — aynı örüntü sunucu tarafına da taşınmalı).

**Yapılacak:** `collectBinanceData()`'ya OI için ayrı bir `/fapi/v1/openInterest` çağrısı ekle (batch'li, mevcut mum toplayıcısının batch örüntüsünü referans al — rate-limit bütçesini de hesapla, Görev 1'in bulgusuyla çelişmesin).

### 10.2 — İki ölü event (hiç dinlenmiyor)

- `js/core/app.js:368` → `EventBus.emit('chart:style:change', { style })` yayınlanıyor ama hiçbir yerde `.on('chart:style:change', ...)` yok — navbar'dan mum tipi (candle style) değiştirmek grafiğe yansımıyor.
- `js/core/app.js:560` → `EventBus.emit('modal:alarm:open')` yayınlanıyor, dinleyeni yok — Alarm/Alert butonu hâlâ hiçbir modal açmıyor (temel alarm kurma paneli, alarm kartlarından farklı bir şey — bu buton manuel alarm/uyarı kurma içindir).

**Yapılacak:** İkisi için de gerçek dinleyiciyi bul/ekle. Mum tipi değişimi muhtemelen `chart-core.js`/`chart-pane.js`'deki `type:change` benzeri bir mekanizmaya bağlanmalı (kodda `type:change` de hiçbir yerde yayınlanmıyor — hangi ismin doğru olduğuna karar ver, tutarlı hâle getir). Alarm modalı için: bu, Görev 6'daki (önerilen giriş fiyatı) alarm sisteminden farklı, kullanıcının manuel fiyat alarmı kurduğu klasik bir özellik olabilir — kapsamını netleştirmeden büyük bir özellik inşa etme, önce küçük bir doğrulama modalıyla başla, kullanıcıya göster.

### 10.3 — `calcSRSI` hâlâ O(n²)

`js/screener/m1hammer-scanner.js:23-25`'te kendi yorumunda "TEST_SYMBOLS tüm markete genişlerse (Faz 2) önce bu optimize edilmeli" diye not düşülmüş. Görev 4'ün (WebSocket taşıma) "Yapılacak" listesinde bu düzeltme vardı ama fiilen yapılmadı, sadece "8 sembolde önemsiz" diye ertelendi.

**Yapılacak:** `TEST_SYMBOLS` genişletilmeden önce (böyle bir görev gelirse) bu mutlaka önce yapılmalı — şimdilik sadece bu notu burada tut, `TEST_SYMBOLS` genişletme görevi gelmeden bu görevi ayrıca yapmaya gerek yok. **Bu alt madde bilgi amaçlı, aksiyon gerektirmiyor** — TEST_SYMBOLS genişletme görevi kuyruğa girdiğinde ön koşul olarak hatırlat.

### Doğrulama (10.1 ve 10.2 için)

- OI geçmişi artık gerçek değerler mi kaydediyor (`/api/history/market` ile kontrol et)?
- Mum tipi değişimi grafiğe yansıyor mu?
- Alarm butonu bir şey açıyor mu (en azından placeholder bir modal)?

**Rapor:** `2026-08-08-gorev10-olu-event-ve-oi-duzeltmeleri.md`

---

## Kuyrukta olmayan, kullanıcı ayrıca planlayacak (değişmedi)

- **Kom1/Kom2/Kom3 sinyal motoru** — büyük iş, L/S artık hazır olduğu için önü açık, ama ayrı, kendi turunda ele alınacak.
- **Çizim araçları temizliği** — kullanıcı doğrudan Claude Code ile yürütüyor.
- **Heikin Ashi ve diğer 6 mum stili doldurulmalı** (2026-08-09, kullanıcı isteği): Görev 10.2'de mum stili menüsü 4 stile (candlestick/bar/line/area) bağlandı, kalan 7'si (heikinashi, hollow, volume, line_markers, hlc_area, baseline, volume_footprint, session_volume) menüde duruyor ama tıklanınca "henüz desteklenmiyor" diyor — silinmedi. **Heikin Ashi öncelikli** — gerçek Heikin Ashi hesaplaması (`chart-pane.js`'in `_buildSeries()`'ine yeni bir case) ve grafiğe çizilmesi ayrı bir iş olarak ele alınacak.

## İzleme listesi — küçük/örtüşme riski taşıyan, henüz görev olarak açılmamış notlar

Bunlar 2026-08-08 taramasında bulundu ama ya çok küçük, ya yukarıdaki görevlerle örtüşme riski taşıyor, ya da tek başına bir görev açmaya değecek kadar netleşmemiş. Yeni bir görev planlanırken önce buraya bakılmalı:

- **`funding:loaded` event'i tüm Coin Detail panelini gereksiz yere yeniden yüklüyor** (sadece `frIntervalText` tazelenmesi gerekirken 12-15 istek atıyor). İki ayrı raporda tekrarlanmış (`SISTEM-GENEL-DEGERLENDIRME.md` §10.2.1, `2026-08-01-fib-seviye-listesi-kisaltma.md`). Küçük ama net bir performans borcu — Görev 2 (L/S → detail panel) yapılırken aynı dosyaya dokunulacağı için o sırada değerlendirilebilir.
- **Fib Extension/Channel/Time Zone araçları** hâlâ `_fibAxis` merkezi mimarisini kullanmıyor, kopya/sapma riski taşıyan eski formülleri kullanıyorlar (`2026-08-01-fib-seviye-listesi-kisaltma.md`). Çizim araçları temizliği kapsamına girebilir — kullanıcı o işi yürütürken hatırlatılmalı.
- **`drawing:settings:saved` her tek etkileşimde localStorage yazıyor**, debounce yok (aynı rapor). Küçük performans notu.
- **Sütun menüsündeki "1D Open" alanı işlevsiz** (`2026-08-01-sutun-menusu-change-volume-type.md`) — Görev 7 (SPOT gerçek işlevi) kapsamında `dayOpen` veri kaynağı eklenirse bu da çözülebilir, aynı kökten geliyor.
- **`MiniFloatingWindow`'un OI Değişimi popout'u hâlâ boş placeholder** (`2026-08-01-liste-ikonu-ls-oi-popout.md`) — L/S popout'u Görev 2'de dolduruluyor olacak, OI Değişimi popout'u ayrı, unutulmasın.
- **Grafik altı bandın "No Preview ▾" liste yer tutucusuna gerçek filtreleme işlevi yok** (`2026-08-01-bant-duzeltmeleri-liste-ikonu.md`) — Görev 8 (delist uyarısı) ile aynı UI alanını paylaşıyor olabilir, Görev 8'e başlarken önce buraya bakılmalı, tekrar iş yapılmasın.
- **Grafik üstünde indikatör motoru yok** (RSI/DEMA9/Heikin Ashi/WaveTrend/regresyon kanalı sadece `m1hammer-scanner.js` içinde gömülü matematik olarak var, grafik katmanında görselleştirilmiyor). Backtest sisteminden ayrı, büyük bir mimari boşluk — ayrı bir iş olarak kullanıcıya sorulmalı, bu dosyaya görev olarak eklenmedi çünkü kapsamı netleşmemiş.
- **Grafik ayarları penceresindeki saat dilimi değişikliğinin uygulanmadığından şüpheleniliyor** (event şekli uyuşmazlığı: `{pane, state}` yayınlanıyor, dinleyici `{paneIdx, settings}` bekliyor gibi görünüyor — kodda yeniden doğrulanmadı, sadece işaret var). Doğrulanıp gerçekten bozuksa Görev 10'a benzer bir "ölü event" maddesi olarak eklenebilir.
- **Top trader L/S oranı eksikliği** (`2026-07-31-kod-incelemesi.md`'de "stratejinin en değerli sinyali eksik" diye not düşülmüştü) — **bu artık ÇÖZÜLDÜ**, bu oturumdaki L/S veri katmanı (`js/data/ls-data-store.js`) hem `topLongShortPositionRatio` hem `topLongShortAccountRatio`'yu zaten içeriyor. Eski rapor güncel değil, referans verilirse bu not eklensin.
- **İlk REST yüklemesi başarısız olursa screener toparlanmıyor** (retry mekanizması yok) — koda bakılarak doğrulanmadı, sadece eski bir gözlem. Gerçekten hâlâ geçerli mi kontrol edilmeli.

---

**Not (2026-08-08):** Bu kuyruk, aynı gün içinde Render deploy sürecinde ortaya çıkan iki büyük bulguyla eş zamanlı hazırlandı: (1) production'ın gerçek backend'i `pintrade-uwg9.onrender.com` (eski `pintrade-0sb6` terk edilmiş bir hesaptan kalma), (2) `main` branch'i Render'ın izlediği branch, `master` değil. Görev 4 (fr-tracker backend düzeltmesi) bu bulgunun doğrudan bir sonucu.
