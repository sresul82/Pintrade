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

## [x] Görev 11 — Chart Settings denetiminde bulunan hatalar (2026-08-10 taramasında doğrulandı)

**Durum:** 11.1, 11.2, 11.3(kısmen — Events/Trading/Alerts kullanıcı kararıyla), 11.4, 11.5, 11.5.1, 11.6 tamamlandı (2026-08-10). Sunucu taraflı izleme + Telegram/Email gönderimi `gorevler3.md` Görev 7'ye kuyruğa eklendi (kullanıcı isteğiyle, bu turda uygulanmadı). 11.3'ün geri kalanı (Status line/Scales/Canvas'taki kozmetik kontroller) izleme listesinde.

**Bağlam:** Kullanıcı Heikin Ashi'yi TradingView ile karşılaştırırken `chart-settings.js`'deki "High and low" fiyat çizgisinin çalışmadığını fark etti. Kök nedeni ararken tüm Chart Settings modalının (`js/chart/ui/chart-settings.js`, 731 satır) sistematik bir denetimi yapıldı.

### [x] 11.1 — "High and low" fiyat çizgisi (2 ayrı hata) — Tamamlandı (2026-08-10)

`js/chart/chart-pane.js` `_updateVisualLines()`:
1. `this.candlesData` boşken (veri henüz yüklenmemiş/ban gibi bir sebeple boşsa) `Math.max(...[].map(...))` = `-Infinity` hesaplanıyor, `createPriceLine({price:-Infinity})` hata vermeden görünmez bir çizgi oluşturuyordu.
2. High/Low, yüklenmiş TÜM geçmişin **statik** min/max'ıydı — TradingView'da ise görünen aralığa göre **dinamik** (scroll/zoom'da yeniden) hesaplanır.

**Düzeltme:** Yeni `_visibleCandles(data)` yardımcı fonksiyonu — `chart.timeScale().getVisibleRange()` ile filtreleyip sadece görünen bar'lardan high/low hesaplıyor, boş sonuç varsa çizgiyi kaldırıyor. `_onRangeChange()`'e `if (this.lineHighLow) this._updateVisualLines(...)` eklendi — scroll/zoom'da yeniden hesaplanıyor. Test: mock range ile dar/geniş aralıkta doğru high/low doğrulandı (`102/98` vs `102/26`), gerçek sayfada zoom sonrası ekran görüntüsüyle de doğrulandı.

### [x] 11.2 — `settings:apply` event'i için 2 ayrı, çakışan dinleyici (`chart-core.js`) — Tamamlandı (2026-08-10)

- Satır ~16: `EventBus.on('settings:apply', ({ state }) => {...})` — doğru, tüm pane'lere `applySettings(state)` uyguluyor.
- Satır ~113: `EventBus.on('settings:apply', ({ paneIdx, settings }) => {...})` — saat dilimi köprüleme kodu (Chart Settings'teki timezone → sidebar'daki global saat göstergesi/`rsb-clock-tz`). Event her zaman `{pane, state}` ile emit ediliyor, yani bu ikinci dinleyicideki `settings` HER ZAMAN `undefined` idi — tamamen ölü kod.

**Düzeltme:** Dinleyici `{ state }` okuyacak şekilde düzeltildi. Test: `EventBus.emit('settings:apply', {pane, state:{timezone:'UTC+9 Tokyo'}})` sonrası `#rsb-clock-tz` metni `UTC` → `UTC+9` olarak doğrulandı.

### [x] 11.4 — Değiştirilip kaydedilmeyen ayarlar (kullanıcı sorusu üzerine bulundu) — Tamamlandı (2026-08-10)

`applySettings()`'te canlı uygulanan ama `getState()`'te hiç yer almayan (sayfa yenilenince sessizce sıfırlanan) alanlar: `timezone`, `hlValue`/`hlLine`/`baValue`/`baLine`/`pdValue`/`pdLine`, `symName`/`symValue`/`symLine`, `watermarkMode`, `marginTop`/`marginBottom`. Bazıları (`watermarkMode`, `marginTop/Bottom`) constructor'da hiç okunmuyordu bile — sadece `applySettings()`'in kendi parametresinden anlık kullanılıp atılıyordu.

**Düzeltme:** Constructor'a hepsi için `s.X ?? default` init eklendi (varsayılanlar mevcut sabit davranışla birebir eşleşecek şekilde seçildi — görsel değişiklik yok), `getState()`'e eklendi, ayrıca watermark'ın chart ilk kurulumunda/sembol-TF değişiminde de `watermarkMode`'a göre doğru metni göstermesi sağlandı (`_build()`, `setSymbol()`, `setTF()`). Test: `applySettings({...})` sonrası `getState()`'te tüm alanların doğru round-trip ettiği doğrulandı.

**Bonus — ikinci fiyat etiketi (kullanıcı isteği):** Heikin Ashi modunda artık TradingView'daki gibi İKİ fiyat gösteriliyor — serinin kendi last-value etiketi (HA kapanışı, `lastValueVisible: this.useHeikinAshi===true`) + mevcut `_livePriceLine` (ham fiyat, geri sayımlı). Normal mumda ikinci etiket kapalı kalıyor (gereksiz/yanıltıcı olmasın diye). `_onRangeChange()`'in her scroll'da `lastValueVisible`'ı sabit `false` yapan tutarsız kodu da aynı anda düzeltildi (aksi halde HA etiketi ilk kaydırmada sönerdi).

### [x] 11.3 — Chart Settings modalının ~%60-65'i tamamen kozmetik — kullanıcı kararı geldi, kısmen uygulandı (2026-08-10)

Tam denetim (`js/chart/ui/chart-settings.js` her `data-key` × `chart-pane.js applySettings()` çapraz kontrolü):

- **Trading sekmesi** — 18 kontrolün TAMAMI `applySettings`'e hiç bağlı değildi. **Kullanıcı kararı: TAMAMEN KALDIRILDI** — TradingView'ın Paper Trading entegrasyonundan geliyor, bu projede karşılığı yok. `TABS` dizisinden, `tabTrading()` fonksiyonundan ve render satırından silindi.
- **Alerts sekmesi** — **kullanıcı kararı: GERÇEK bir özelliğe dönüştürüldü**, bkz. aşağıdaki 11.5.
- **Events sekmesi** — 9 kontrolün tamamı bağlı değildi. **Kullanıcı kararı: sadece "Session breaks" kaldı**, diğer 6'sı (Ideas, Economic events, Only future events, Events breaks, Latest news, News notification) kaldırıldı — proje ayrı bir News sekmesine sahip, tekrarı gereksizdi. Session breaks henüz `applySettings()`'e bağlı değil (ayrı, küçük bir iş — davranışa bağlanmadan sadece UI'da bırakıldı).
- **Status line sekmesi** — kullanıcı bu tura dahil etmedi, hâlâ 6/7 kontrol bağlı değil (izleme listesine taşındı, aşağıda).
- **Scales and lines sekmesi** — ~14 kontrol hâlâ bağlı değil (renk seçicilerin çoğu, `lockPriceToBar`/`noOverlapLabels`) — kullanıcı bu tura dahil etmedi.
- **Canvas sekmesi** — `watermarkColor`, `navBtnVisibility`, `paneBtnVisibility`, `marginRight` hâlâ bağlı değil — kullanıcı bu tura dahil etmedi.
- **Symbol sekmesi** — zaten tam çalışıyordu, dokunulmadı.

### [x] 11.5 — Çizim tabanlı fiyat alarmları (kullanıcı isteği, 2026-08-10) — YENİ, büyük özellik

**Kapsam (kullanıcı onaylı):**
- Alarm kaynağı: SADECE 7 çizim aracı — `trendline, ray, extended, hline, hray, trendangle, infoline`.
- Çizim özellik menüsündeki zil ikonu (`property-toolbar.js`, önceden sadece "yakında" `alert()`'i gösteriyordu) artık gerçekten alarm oluşturuyor — ikon zaten Navbar'ın ⏰ Alert ikonuyla birebir aynıydı (aynı SVG path), ek değişiklik gerekmedi.
- Navbar ⏰ Alert butonu (önceden sadece "preview, kaydetmiyor" diyen bir modal) artık gerçekten kaydediyor; bir çizgi seçiliyse fiyatı önceden dolduruyor.
- Tetikleme BU TURDA dahil: canlı fiyat (MarketDataStore'un zaten yayınladığı `mds:tick`, kendi ayrı akış AÇILMADI) alarm seviyesini geçince Toast bildirimi + Web Audio beep + chart'ta çizgi güncellenir (tetiklenen alarm `onlyActiveAlerts=true` iken gizlenir).
- Kalıcılık: localStorage (`pintrade_alerts` + `pintrade_alert_prefs`).
- Eğik çizgilerin (trendline/ray/extended/trendangle/infoline) tetik fiyatı **TradingView'daki gibi çizgiyi canlı takip eder** — her fiyat kontrolünde kaynak çizim State'ten taze okunup o anki eğim+zamana göre yeniden hesaplanır; kullanıcı çizgiyi sürükleyip düzenlerse alarm da onunla birlikte güncellenir. (İlk versiyonda yanlışlıkla "oluşturma anında sabitlenip donuyor" şeklinde basitleştirilmişti — kullanıcı bunun eğik çizginin anlamını ortadan kaldırdığını belirtti, aynı gün düzeltildi, bkz. rapor.)

**Yeni dosya:** `js/screener/alert-store.js` — `getAlerts/createFromDrawing/createManual/removeAlert/getPrefs/setPrefs/checkPrice/computeDrawingPrice`.

**Değişen dosyalar:**
- `js/drawing/ui/property-toolbar.js` — `hasAlert` artık sadece 7 desteklenen araçta true, `pt-btn-alert` tıklaması `AlertStore.createFromDrawing()` çağırıyor.
- `js/core/app.js` — Alarm modalı gerçekten `AlertStore.createManual()` çağırıyor, seçili çizgi varsa fiyatı önceden dolduruyor. `Toast.show()` opsiyonel `duration` parametresi aldı (geriye dönük uyumlu).
- `js/chart/chart-pane.js` — yeni `_updateAlertLines()` (AlertStore'daki bu pane'in sembolüne ait alarmları çizgi olarak render eder), `_buildSeries()`'te seri yeniden kurulunca `_alertPriceLines` sıfırlanıyor (Görev 11.1'deki `_livePriceLine` bug'ıyla aynı sınıf hata, önceden önlendi).
- `js/chart/ui/chart-settings.js` — Alerts sekmesindeki ayarlar (renk/görünürlük/ses/toast süresi) artık pane'e değil **AlertStore'un global tercihlerine** yazılıyor (bir alarm, o an aktif olmayan bir pane/sembolde de tetiklenebildiği için "hangi pane'in ayarı geçerli" belirsizliği olmasın diye bilinçli mimari karar). `buildSlider()` opsiyonel `key` parametresi aldı (ses düzeyi slider'ı önceden hiçbir `data-key`'e sahip değildi, tamamen kayıp bir ayardı — bu da ayrıca düzeltildi).

**⚠️ Test sırasında bulunan KRİTİK bug (kendi eklediğim kod, hemen düzeltildi):** Alerts sekmesi senkron kodunu yanlışlıkla `if (pane) {...}` bloğunun DIŞINA yazdım — `setCheck`/`setColor` o bloğa scope'lu olduğu için `ReferenceError` fırlatıp **TÜM Settings modalının** (sadece Alerts değil — Cancel/Ok/X butonları dahil TÜMÜ) sessizce çalışmaz hale gelmesine yol açıyordu. Test sırasında (Cancel butonunun bile modalı kapatmadığını fark ederek) yakalandı ve düzeltildi — bkz. rapor.

### [x] 11.5.1 — Eğik çizgi alarmları canlı takip düzeltmesi (kullanıcı geri bildirimi, 2026-08-10)

11.5'in ilk sürümünde eğik çizgi alarmlarının tetik fiyatı **oluşturma
anında hesaplanıp sabitleniyordu** — kullanıcı bunun eğik çizgi kullanmanın
anlamını ortadan kaldırdığını belirtti. Düzeltildi: `_resolveTriggerPrice()`
artık `sourceDrawingId`'si olan alarmlarda kaynak çizimi HER fiyat
kontrolünde State'ten taze okuyup yeniden hesaplıyor — TradingView'daki
gibi çizgiyi (ve kullanıcı sürükleyip düzenlerse yeni hâlini) canlı takip
ediyor. `chart-pane.js`'teki görsel çizgi de artık her canlı tick'te
(`_onFeedTick`/`_onLiveCandle`) yeniden çiziliyor.

### [x] 11.6 — TradingView tarzı "Create Alert" modalı (kullanıcı isteği, 2026-08-10)

Kullanıcı TradingView'ın gerçek "Create alert on {symbol}" diyaloğunun
ekran görüntülerini paylaşıp "buradan faydalı olanları al" dedi.

**Eklenen alanlar** (`js/core/app.js`, `_bindAlarmModal`):
- **Condition:** Crossing / Crossing Up / Crossing Down (mevcut `condition`
  alanına birebir eşleniyor).
- **Trigger:** Once only / Once per bar / Once per bar close / Once per
  minute — UI'da seçilebilir, kaydediliyor (`triggerMode`), ama şu an
  SADECE "Once only" fiilen çalışıyor. Diğerleri sunucu taraflı izleme
  gerektiriyor — kullanıcı onayıyla **Görev 7**'ye (aşağıda, gorevler3.md'de)
  kuyruğa eklendi, bu turda uygulanmadı.
- **Expiration:** Open-ended / End of day / 1 week / 1 month — FİİLEN
  çalışıyor, `checkPrice()` süresi dolan alarmı sessizce pasif işaretliyor.
- **Message:** özel alarm metni, Toast'ta gösteriliyor.
- **Notifications:** Toast (fiilen çalışıyor) + **Telegram** (checkbox var,
  tercih kaydediliyor, ama HENÜZ GÖNDERMİYOR — sunucu taraflı bot
  entegrasyonu Görev 7'ye bağlı). Email kullanıcı kararıyla bu turda hiç
  eklenmedi.

**Mimari birleştirme:** Property toolbar'daki zil ikonu artık anında
alarm oluşturmuyor — Navbar'daki ⏰ Alert butonuyla AYNI bu modalı açıyor
(`EventBus.emit('modal:alarm:open', { drawing })`), seçili çizgi önceden
dolu olarak. Manuel (çizim kaynaksız) alarmlarda fiyat input'u; çizim
kaynaklı alarmlarda salt-okunur "{Araç adı} ~{canlı fiyat}" satırı gösteriliyor.

**Test:** Tüm alanlar (Condition/Trigger/Expiration/Message/Notifications)
doldurulup "Create"e basılınca `AlertStore`'daki alarm nesnesinde hepsinin
doğru kaydedildiği doğrulandı (`condition:'above', triggerMode:'once_per_bar',
expiresAt` set, `message`, `notifyToast:true, notifyTelegram:true`).
Süresi geçmiş bir alarmın `checkPrice()`'ta sessizce pasif olduğu (`active:false,
triggered:false`) ayrıca doğrulandı. Property toolbar zil ikonunun artık
anında oluşturmadığı, aynı modalı açtığı doğrulandı. Ekran görüntüsüyle
görsel doğrulama yapıldı.

### Doğrulama

- 11.1/11.2/11.4/11.5/11.5.1/11.6: kapsamlı kod içi testlerle doğrulandı (yukarıda özetlendi + rapor), lokal sunucuda konsol hatasız. hline/trendline'dan doğru fiyat hesabı, crossing tetikleme, onlyActiveAlerts filtresi, Chart Settings round-trip, property-toolbar + navbar entegrasyonu, eğik çizgi canlı takibi, yeni modal alanları ayrı ayrı test edildi.
- 11.3 kalan kısmı (Status line, Scales, Canvas'taki kalan kozmetik kontroller): kullanıcı bu tura dahil etmedi, izleme listesine taşındı.
- Sunucu taraflı izleme + Telegram/Email gönderimi: kullanıcı isteğiyle `gorevler3.md` Görev 7'ye kuyruğa eklendi, bu turda uygulanmadı.

**Rapor:** `2026-08-10-gorev11-chart-settings-denetimi.md`

---

## [ ] Görev 12 — `Candle` koleksiyonuna TTL eklenmesi (2026-08-10, MongoDB Atlas uyarısı üzerine bulundu)

**Bağlam:** MongoDB Atlas'tan "Logical Size 440MB'ı geçti" uyarısı geldi
(free tier M0 limiti 512MB, ölçüm anında 477MB/512MB — ~%93 dolu).
İncelendi: `server.js`'deki 7 koleksiyondan 6'sında TTL (otomatik silinme)
var (`MarketData` 48s, `FRSignal` 7g, `LSMetrics` 60s, `SymbolStatusEvent`
30g) — **`Candle` koleksiyonunda YOK**. `collectBinanceCandles()` her 5
dakikada ~500 Binance sembolünün 5dk mumunu yazıyor, hiç silinmiyor —
aylardır sınırsız birikiyor, dolan alanın ana kaynağı bu.

**Ek bulgu:** `Candle`'ı okuyan tek endpoint (`GET /api/history/candles/...`)
**hiçbir frontend kodu tarafından çağrılmıyor** (grep ile doğrulandı, `js/`
altında sıfır kullanım) — yani bu koleksiyon şu an TAMAMEN ölü/kullanılmayan
bir veri. Chart'taki mumlar canlı Binance REST/WS'ten geliyor, bu kayıttan
değil.

**Geçici çözüm (2026-08-10'da kullanıcı tarafından MongoDB Atlas Data
Explorer üzerinden manuel uygulandı):**
- `sample_mflix` veritabanı tamamen silindi (Atlas'ın kendi demo/örnek
  veri seti — Pintrade ile hiç ilgisi yok, ~147MB boşalttı, sıfır risk).
- `test` veritabanındaki `candles` koleksiyonu boşaltıldı/silindi.
- **Sonuç:** `test` veritabanı 103.10MB/296.23MB'tan (7 koleksiyon)
  22.91MB/63.92MB'a (6 koleksiyon, `candles` artık listede bile yok) düştü.
  512MB limitinin çok altına inildi, acil kriz geçti.
- Chart üzerinde hiçbir görsel etki olmadı doğrulandı (mumlar zaten
  Binance'ten canlı geliyor, bu silinen kayıttan değil).

**Kalıcı çözüm HÂLÂ YAPILMADI** — koleksiyon toplayıcı (`collectBinanceCandles`,
`server.js:649`) hâlâ her 5 dakikada yazmaya devam ediyor, bu yüzden sorun
zamanla TEKRAR birikecek. Kullanıcı: "ileride detaylıca bakarız" dedi —
şimdilik sadece bu not bırakıldı, TTL/toplayıcı durdurma kararı ertelendi.

### Yapılacak (kalıcı çözüm, henüz uygulanmadı)

- `candleSchema`'ya diğer koleksiyonlarla tutarlı bir TTL index eklenmeli
  (örn. `candleSchema.index({ openTime: 1 }, { expireAfterSeconds: 72*60*60 })`
  — 72 saat, `/api/history/candles`'ın maksimum `limit=5000` × 5dk ≈ 17 gün
  teorik pencereden çok daha az ama gerçek kullanım paternine göre yeterli).
- Alternatif/ek karar: madem endpoint hiç kullanılmıyor, `collectBinanceCandles()`
  toplayıcısının kendisini tamamen DURDURMAK da bir seçenek (gereksiz
  Binance rate-limit bütçesi + depolama harcıyor, hiçbir özelliğe hizmet
  etmiyor) — TTL eklemek yerine bu daha kökten bir çözüm olabilir, kullanıcıyla
  netleştirilmeli: gelecekte bu geçmiş mum verisi kullanılacak bir özellik
  planlanıyor mu (örn. backtest), yoksa tamamen kaldırılabilir mi?

### Doğrulama

- TTL eklendiyse: birkaç gün sonra koleksiyon boyutu büyümeyi durdurdu mu?
- Toplayıcı durdurulduysa: `/api/history/candles` (zaten kullanılmıyor)
  hâlâ hata vermeden boş dönüyor mu, başka hiçbir yer bozulmadı mı?

**Rapor:** `2026-XX-XX-gorev12-candle-ttl.md`

---

## [x] Görev 13 — Alarm listesi görünümü + düzenleme/silme (2026-08-11 tamamlandı)

**Bağlam:** Görev 11.5/11.6'da çizim tabanlı fiyat alarmı sistemi kuruldu
(`js/screener/alert-store.js`) — alarm oluşturmak (Navbar ⏰ Alert butonu
veya property toolbar zil ikonu) çalışıyor, chart üzerinde çizgi olarak
gösteriliyor, ama **oluşturulan tüm alarmları TEK bir yerde listeleyip
görebileceğin, silebileceğin veya düzenleyebileceğin bir arayüz henüz
yok**. `AlertStore.getAlerts()`/`removeAlert()` fonksiyonları zaten var
(veri katmanı hazır) — eksik olan sadece UI.

TradingView'da bu, sağ kenar çubuğundaki ayrı bir "Alerts" sekmesi/paneli
— tüm aktif/tetiklenmiş alarmları liste hâlinde gösterir, her satırda
düzenle/sil/aktif-pasif yap seçenekleri olur.

### Yapıldı

- Sağ sidebar'a yeni bağımsız sekme: **`rsb-alerts`** ("Alerts") —
  mevcut Watchlist/Alarm sekmeleriyle aynı desende, ama AlarmSignalHistory'nin
  (Kom1/2/3 strateji sinyal kartları, `dp-alarm-tab`) içeriğinden TAMAMEN
  ayrı — kullanıcı kararı: "navbardaki ikonu değiştirme, menüleri TV
  benzeri yap" (navbar'ın mevcut Alert ikonuna dokunulmadı).
- Yeni `js/screener/alert-list-panel.js` (`AlertListPanel`): TradingView'ın
  Alerts panel düzenine yakın liste — All/Active/Triggered filtre
  segmentleri, arama, her satırda condition ikonu (Crossing/Up/Down —
  TV'nin kendi asset kaynağına erişimimiz olmadığı için aynı kavramsal
  anlamda kendi çizdiğimiz SVG'ler), sembol, fiyat, kaynak/mesaj, durum
  rozeti (Active/Triggered/Expired), düzenle (kalem) ve sil (çöp) ikonları.
  Satıra tıklayınca chart o sembole gidiyor.
- `AlertStore.updateAlert(id, fields)` eklendi — kısmi patch, düzenlenince
  `triggered`/`lastKnownPrice` sıfırlanır (alarm "yeniden canlandırılmış" sayılır).
- `js/core/app.js` `_bindAlarmModal`: AYNI Create Alert modalı artık
  `{editAlertId}` payload'ıyla açılınca DÜZENLEME moduna geçiyor — tüm
  alanlar mevcut alarmın değerleriyle önceden dolu, buton "Save", kaynak
  çizimi varsa fiyat hâlâ salt-okunur/canlı gösteriliyor.
- **Bulunan ve düzeltilen kritik bug (aynı turda):** Hem create hem edit
  akışında `close()` (modalı DOM'dan kaldırma) form değerlerini (özellikle
  fiyat input'unu) okumadan ÖNCE çağrılıyordu — bu yüzden manuel (çizim
  kaynaksız) alarm oluşturma/düzenleme SESSİZCE başarısız oluyordu. Form
  değerleri artık `close()`'dan önce okunuyor.

### 2. tur (2026-08-11, aynı gün) — kullanıcı TV ekran görüntüleri paylaştı

Kullanıcı geri bildirimi: (1) alarm çizgisi kırmızı/dolgun görünüyordu,
TV'de gri-beyaz kesikli; (2) liste panelindeki rozet/pill'ler "çocuksu/neon"
görünüyordu, TV düz renkli metin kullanıyor; (3) TV'de silme öncesi onay
diyaloğu var; (4) TV'de satır üzerine gelince zengin bir detay balonu
çıkıyor.

- `AlertStore` `alertLinesColor` varsayılanı `#f23645` (kırmızı) →
  `#9598a1` (gri-beyaz) — zaten var olan Chart Settings → Alerts sekmesi
  renk seçicisi üzerinden de değiştirilebilir (doğrulandı, önceden de
  bağlıydı, sadece varsayılan renk kötüydü).
- `AlertListPanel` satırları rozet/pill kullanmayı bıraktı — TV'deki gibi
  iki satırlı düzen: üst satır başlık ("{Symbol}, {TF}, {Condition}
  {Kaynak}"), alt satır düz renkli durum metni ("Live" yeşil, "Stopped —
  Triggered" turuncu, "Stopped — Expired" kırmızımsı — pill/arkaplan yok).
- Play/pause (durdur/yeniden başlat), düzenle, sil ikonları satırda sağda;
  tarih en sağda.
- Satır üzerine gelince (`mouseover`) TV'ninkine yakın bir detay balonu:
  tam başlık, durum, oluşturulma/son tetiklenme/süre dolma zamanları, mesaj.
- Silme artık TV'nin "Delete this alert?" diyaloğuyla birebir aynı düzende
  onay istiyor (açıklama metni + Cancel + kırmızı Delete butonu) — önceden
  tek tıkla anında siliniyordu.
- Alarm nesnesine `tf` (zaman dilimi) alanı eklendi (`AlertStore`,
  `_extraOpts`) — liste/başlık/tooltip'te "SYMBOL, TF" gösterimi için,
  Create Alert modalından otomatik dolduruluyor.
- **Bulunan ve düzeltilen 2. bug (aynı turda):** Play/pause butonunun
  "yeniden başlat" davranışı `active: !a.active` kullanıyordu — ama
  tetiklenmiş bir alarmda `active` zaten `true` kalıyordu (sadece
  `triggered` `true` oluyordu), bu yüzden "Restart" tıklanınca alarm
  YANLIŞ YÖNE (durdurulmuşa) gidiyordu. Düzeltme: hedef durum artık
  gösterilen ikonun anlamına göre açıkça belirleniyor (duraklatılmışsa
  her zaman `{active:true, triggered:false}`, aktifse her zaman
  `{active:false}`).

### Doğrulama

- Manuel create: fiyat/condition/mesaj doğru kaydedildi (bug düzeltmesi
  sonrası doğrulandı).
- Düzenleme: mevcut bir alarmın fiyatı/condition'ı/mesajı değiştirilip
  "Save" ile kaydedildiğinde `AlertStore`'da gerçekten güncellendiği
  doğrulandı.
- Silme: `AlertListPanel`'den silinen alarm `AlertStore.getAlerts()`'ten
  gerçekten kayboldu.
- Filtreler: All/Active/Triggered segmentleri doğru sayıda satır gösterdi
  (5 toplam, 4 aktif, 1 tetiklenmiş — test verisiyle doğrulandı).
- Satıra tıklama: `symbol:change` event'i doğru sembolle tetiklendi.
- Ekran görüntüsüyle görsel doğrulama yapıldı, konsol hatasız (bilinen
  sandbox ağ hataları hariç).
- **2. tur:** Silme onay diyaloğu ekran görüntüsüyle TV'ninkiyle karşılaştırıldı
  (metin/düzen birebir). Play/pause: tetikle→restart→durdur sırası test
  edilip her adımda `active`/`triggered` doğru değerlere ulaştığı
  doğrulandı (bug düzeltmesi sonrası — önce yanlış yöne gittiği görülüp
  düzeltildi). Hover tooltip doğru içerikle açıldığı doğrulandı. Ekran
  görüntüsüyle rozet/pill'lerin kalktığı, düz renkli durum metninin
  (Live/Stopped — Triggered/Expired) doğru render olduğu doğrulandı.

**Rapor:** `2026-08-11-gorev13-alarm-listesi-ui.md`

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
- ~~Grafik ayarları penceresindeki saat dilimi değişikliğinin uygulanmadığından şüpheleniliyor~~ — **2026-08-10'da kesinleşti ve Görev 11.2'ye taşındı** (kod okunarak doğrulandı: ikinci `settings:apply` dinleyicisi gerçekten ölü).
- **Top trader L/S oranı eksikliği** (`2026-07-31-kod-incelemesi.md`'de "stratejinin en değerli sinyali eksik" diye not düşülmüştü) — **bu artık ÇÖZÜLDÜ**, bu oturumdaki L/S veri katmanı (`js/data/ls-data-store.js`) hem `topLongShortPositionRatio` hem `topLongShortAccountRatio`'yu zaten içeriyor. Eski rapor güncel değil, referans verilirse bu not eklensin.
- **İlk REST yüklemesi başarısız olursa screener toparlanmıyor** (retry mekanizması yok) — koda bakılarak doğrulanmadı, sadece eski bir gözlem. Gerçekten hâlâ geçerli mi kontrol edilmeli.

---

**Not (2026-08-08):** Bu kuyruk, aynı gün içinde Render deploy sürecinde ortaya çıkan iki büyük bulguyla eş zamanlı hazırlandı: (1) production'ın gerçek backend'i `pintrade-uwg9.onrender.com` (eski `pintrade-0sb6` terk edilmiş bir hesaptan kalma), (2) `main` branch'i Render'ın izlediği branch, `master` değil. Görev 4 (fr-tracker backend düzeltmesi) bu bulgunun doğrudan bir sonucu.
