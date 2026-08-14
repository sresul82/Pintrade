# Sıradaki Görevler 3 — Kom1 Sinyal Motoru (Pintrade)

**Amaç:** Kullanıcı yokken (uyurken / limit dolu) Claude Code'un sırayla
ilerlemesi için hazır iş kuyruğu. Önceki kuyruk (`gorevler2.md`) 2026-08-09'da
Görev 10'a kadar tamamlandı, Görev 9 (güvenlik) ertelendi.

**Kaynak:** Bu kuyruk, `dokumentasyon/gorevler/sinyal-sistemi-pintrade-entegrasyon.md`'deki
Kombinasyon 1 kuralına dayanıyor. O dosyayı önce oku — burada sadece
uygulama adımları var, strateji gerekçesi orada.

## Kullanım (Claude Code için)

1. Bu dosyayı oku, önce `sinyal-sistemi-pintrade-entegrasyon.md`'yi de oku.
2. **Sırayla, yukarıdan aşağıya** ilerle. Bir görev bitmeden diğerine geçme.
3. Her görev bittiğinde: `[ ]` → `[x]`, rapor dosyasını "Rapor:" satırına yaz, sonraki göreve geç.
4. **Kritik hata çıkarsa DUR** — "⚠️ DURDU — sebep: ..." yaz, bekle.
5. **"⏸ DUR" yazan görevlerden ÖNCE DUR.** Kullanıcı açıkça "Görev N'e geç" demeden geçme.
6. **Bu kuyruk gerçek trading sinyalleri üretecek — normal bug-fix işlerinden daha yüksek risk taşır.** Şüpheye düşersen DUR ve sor, tahmin yürütme.

Her rapor için standart format: değişen dosyalar, ölçümler, doğrulama testleri, varsa regresyon uyarıları.

---

## 2026-08-09 kararları — seçilen VE seçilmeyen alternatifler

Her karar noktasında kullanıcıyla birlikte bir seçenek seçildi, diğerleri
**reddedilmedi — sadece şimdilik ertelendi.** İleride bu kuyruğa dönen
(insan veya Claude Code) kişi neyin neden seçilmediğini bilsin diye
buraya açıkça yazıldı. Kod, burada "Seçilen" yazan tarafa göre yazılacak.

| Karar noktası | ✅ Seçilen | ❌ Seçilmeyen (ileride değerlendirilebilir) |
|---|---|---|
| **Kom3 tanımı** | Henüz tanımlanmadı, bu kuyrukta hiç yok | Kullanıcının üçüncü bir strateji fikri paylaşıp Kom3'ü de bu turda tanımlaması |
| **Kom2 kapsamı** | Bu kuyrukta yok, sadece Kom1 | Kom2'yi bilinen zayıf/doğrulanmamış kuralla (divergence+L/S+hacim) yine de şimdi kurmak |
| **Kom1 parametreleri** (WT eşiği -53, RC 100 bar, TOLERANCE_BARS=3) | Sabit kodda, sabit değer | Bir ayar panelinden değiştirilebilir yapmak (örn. WT eşiğini -48 ile de denemek isterse) — **not:** kaynak doküman (`sinyal-sistemi-pintrade-entegrasyon.md` §9) aslında bunun yapılandırılabilir olmasını öneriyordu, kullanıcı şimdilik hız için sabit kodu tercih etti |
| **Coin evreni** | Küçük, sabit 11 coin (ONDO/STRK/ENA/BIO/JUP/T/AEVO/MOVE/VANRY/BERA/HYPE) | Tüm Binance USDT perpetual'ları dinamik ATR14/fiyat (%3-12) filtresiyle taramak — kaynak dokümanın **orijinal tasarımı buydu**, ama MarketDataStore'un 200-stream/bağlantı sınırı + ban riski nedeniyle Görev 6'ya (ayrı, en riskli adım) ertelendi |
| **Tarama mimarisi** | Önce küçük sabit kümede dene, ban riski yokluğu doğrulanınca genişlet (M1Hammer'ın izlediği yol) | İki katmanlı taramayı (hafif ATR REST taraması + hedefli WS) baştan, büyük ölçekte kurmak |
| **Borsa** | Sadece Binance FUTURES | Bybit'i de dahil etmek (L/S görevinde Bybit faz 2 olarak zaten eklenmişti, ama Kom1'in backtest verisi tamamen Binance'e dayanıyor — Bybit'te aynı kuralların işleyip işlemediği hiç test edilmedi) |
| **Büyük TF** | Hem 1H hem 4H, ikisi de bağımsız sinyal üretir | Sadece tek bir TF (örn. sadece 4H, "en güçlü" ufuk olduğu için — backtest'te +4h en yüksek net getiriyi verdi) |
| **İş bölümü** | `gorevler3.md` olarak 6 küçük adıma bölündü, DUR noktalarıyla | Planlamadan direkt tek seferde kodlamaya başlamak |

---

## [x] Görev 1 — Paylaşılan indikatör motoru (DEMA9, Heikin Ashi, Regression Channel)

**Tamamlandı (2026-08-09).** Rapor: `dokumentasyon/raporlar/2026-08-09-gorev1-indikator-motoru.md`

**Sebep:** Kom1'in ihtiyaç duyduğu indikatörlerden RSI ve WaveTrend zaten var (`js/screener/m1hammer-scanner.js` içinde, `calcRSI`/`calcWT` — WT_CH_LEN=10, WT_AVG_LEN=21, Kom1'in beklediğiyle birebir uyumlu). Ama **DEMA9, Heikin Ashi ve Regression Channel kod tabanında hiç yok** (grep ile doğrulandı — "heikinashi" sadece grafik menüsünde bir isim olarak geçiyor, hesaplama yok).

### Yapılacak

- Yeni bir paylaşılan modül oluştur, örn. `js/screener/indicator-engine.js` (chart ve scanner'ın ikisinin de kullanabileceği, DOM'a dokunmayan saf hesaplama modülü — `SISTEM-GENEL-DEGERLENDIRME.md`'nin "indikatör matematiği paylaşılmıyor" bulgusuna göre).
- `calcRSI`/`calcWT`'yi `m1hammer-scanner.js`'den bu yeni modüle **taşı** (kopyalama değil — tek kaynak, iki yerden çağrılsın). M1Hammer'ın kendi davranışını BOZMA, sadece fonksiyonları oraya taşıyıp `IndicatorEngine.calcRSI(...)` gibi çağır.
- Yeni fonksiyonlar ekle:
  - `calcDEMA(closes, period=9)` — standart DEMA: `DEMA = 2*EMA(close,period) - EMA(EMA(close,period),period)`
  - `calcHeikinAshi(opens, highs, lows, closes)` — standart HA dönüşümü (`ha_close=(o+h+l+c)/4`, `ha_open=(prevHaOpen+prevHaClose)/2`, ilk bar için `ha_open=(o+c)/2`)
  - `calcRegressionChannel(closes, length=100)` — `length` barlık lineer regresyon, orta bandı (`RC_mid`) döndür (üst/alt bant da hesaplanabilir ama Kom1 sadece orta bandı kullanıyor)

### Doğrulama

- Bilinen bir veri setiyle (örn. TradingView'da aynı sembol/TF'de görsel karşılaştırma, veya elle hesaplanmış küçük bir örnek dizi) her yeni fonksiyonun doğru sonuç verdiğini doğrula — **bu adımda hata yaparsan tüm Kom1 motoru yanlış sinyal üretir**, özenli ol.
- M1Hammer'ın taşınan `calcRSI`/`calcWT` çağrılarının hâlâ aynı sonucu verdiğini doğrula (regresyon yok).
- `node -c` ile syntax kontrolü, tarayıcıda M1Hammer'ın hâlâ çalıştığını doğrula.

**Rapor:** `2026-08-09-gorev1-indikator-motoru.md`

---

## [x] Görev 2 — Büyük TF sinyali (1H/4H: RC + WaveTrend)

**Tamamlandı (2026-08-09).** Rapor: `dokumentasyon/raporlar/2026-08-09-gorev2-buyuk-tf-sinyali.md`

**Bağımlılık:** Görev 1 bitmeden başlanamaz.

### Yapılacak

- Yeni bir `Kom1Scanner` modülü (örn. `js/screener/kom1-scanner.js`), M1Hammer'ın mimari örüntüsünü referans al (BotEngine backfill + MarketDataStore.subscribeKlines, kendi WS'ini açma).
- 11 coin × (1H + 4H) = 22 kline stream'e abone ol.
- Her yeni bar kapanışında: `price <= RC_mid` (100 bar RC) VE WT1 önceki bar `< -53` VE bu barda WT1 WT2'yi yukarı kesti mi kontrol et.
- Koşul sağlanırsa: coin+TF için "büyük TF sinyali ateşlendi, TOLERANCE_BARS=3 penceresi açık" durumunu bir Map'te tut (henüz alarm/watchlist'e yazma — o Görev 4'te).
- Konsola/basit bir test arayüzüne (örn. `window.Kom1Scanner.getPendingSignals()`) logla — bu turda sadece büyük TF tespiti doğru çalışıyor mu görmek yeterli.

### Doğrulama

- Gerçek piyasada en az bir coin+TF kombinasyonunda RC_mid ve WT değerlerini elle (örn. TradingView'da aynı ayarlarla) karşılaştır.
- Ban riski yok mu (BotEngine kuyruğu, MarketDataStore paylaşılan bağlantı) — konsolda BAN_SIGNAL var mı kontrol et.

**Rapor:** `2026-08-09-gorev2-buyuk-tf-sinyali.md`

---

## [x] Görev 3 — 5 dakikalık onay penceresi (Heikin Ashi + DEMA9)

**Tamamlandı (2026-08-09).** Rapor: `dokumentasyon/raporlar/2026-08-09-gorev3-5dk-onay-penceresi.md`

**Bağımlılık:** Görev 2 bitmeden başlanamaz.

### Yapılacak

- Görev 2'de "büyük TF sinyali ateşlendi" durumu olan coinler için, **sadece o an** 5dk kline stream'ine abone ol (kalıcı değil — TOLERANCE_BARS=3 büyük TF barı geçince veya onay gelince abonelikten çık, mimari notundaki "iki katmanlı tarama" prensibi).
- Her yeni 5dk bar kapanışında: `ha_close >= ha_open` VE `ha_close > dema9` kontrol et.
- Koşul sağlanırsa VE hâlâ TOLERANCE_BARS penceresi içindeyse → **Long sinyali kesinleşti**.
- Pencere (3 büyük TF barı) geçerse ve onay gelmezse, o coin+TF için bekleyen durumu temizle, 5dk aboneliğini kapat.

### Doğrulama

- Bekleyen durumun doğru şekilde açılıp kapandığını (abonelik sızıntısı yok) doğrula — `MarketDataStore.unsubscribeKlines` her durumda (onay geldi / pencere geçti) çağrılıyor mu kontrol et.
- En az bir uçtan uca test: büyük TF sinyali + 5dk onayının birlikte gerçek/mock veriyle doğru "Long sinyali" ürettiğini doğrula.

**Rapor:** `2026-08-09-gorev3-5dk-onay-penceresi.md`

---

## [ ] ⏸ DUR — kullanıcı onayı bekle (Görev 4'ten önce)

Görev 3 bittikten sonra **DURACAKSIN**. Görev 4, sinyali gerçekten Watchlist'e ve alarm sekmesine yazıyor — yani bu noktadan sonra kullanıcı gerçek (sahte olmayan) sinyal bildirimleri görmeye başlayacak. Kullanıcı "Görev 4'e geç" demeden başlama.

---

## [x] Görev 4 — Watchlist Kom1 grubuna yazma + alarm bildirimi

**Tamamlandı (2026-08-10).** Rapor: `dokumentasyon/raporlar/2026-08-10-gorev4-watchlist-alarm-entegrasyonu.md`

**Bağımlılık:** Görev 3 bitmeden başlanamaz.

### Yapılacak

- Görev 3'te "Long sinyali kesinleşti" olan coin, `WatchlistStore`'un `kom1` grubuna eklensin (şu an `getSignalGroups()` `AlarmSignalHistory.getActiveSignals()`'tan besleniyor — bu demo veri kaynağı, gerçek Kom1Scanner çıktısıyla değiştirilmeli, ama **`alarm-signal-history.js`'nin Kom2/Kom3 demo kartlarına DOKUNMA** — sadece Kom1 gerçek veriyle beslenecek).
- Sinyal geldiğinde alarm sekmesinde bildirim ("Kom1 listesine BANKUSDT eklendi" tarzı — bkz. tasarım dokümanı Bölüm 5).
- Coin, sinyal aktif olduğu sürece listede kalsın (ne zaman "aktifliği" biter — örn. X saat sonra otomatik mi düşer, yoksa manuel mi temizlenir — belirsizse DUR ve kullanıcıya sor, tahmin yürütme).
  - **Kullanıcı kararı (2026-08-10):** mevcut 24 saatlik "Old" eşiğiyle aynı kural kullanılsın (yeni eşik icat edilmedi). **TODO (kullanıcı notu):** bu geçici bir karar — ileride sinyal önerisi + geri ölçüm işi (`gorevler2.md` Görev 6) tasarlanınca fiyat hedefi/stop bazlı bir "aktiflik" kuralına geçilecek.

### Doğrulama

- Gerçek bir sinyal (veya test amaçlı tetiklenmiş bir mock sinyal) Watchlist'in "Sinyaller" listesinde Kom1 grubunda görünüyor mu?
- Alarm sekmesinde bildirim çıkıyor mu?
- Kom2/Kom3 demo kartları hâlâ eskisi gibi (bozulmadı) mı?

**Rapor:** `2026-XX-XX-gorev4-watchlist-alarm-entegrasyonu.md`

---

## [x] ⏸ DUR — kullanıcı onayı bekle (Görev 5'ten önce)

**Geçildi (2026-08-10):** Kullanıcı "Push doğrulandıktan sonra Görev 5'e geçelim" dedi — açık onay.

---

## [x] Görev 5 — Canlı gözlem + ince ayar (2026-08-12, 9/10 sinyalle kullanıcı onayıyla kapatıldı)

**Bağımlılık:** Görev 4'ten sonra, kullanıcı onayıyla.

### ⚠️ Kritik bulgu (2026-08-10, Görev 4 production doğrulaması sırasında)

Push sonrası production'da (`pintrade-uwg9.onrender.com`) doğrulama yapılırken,
**Görev 4'ten bağımsız, önceden var olan bir `server.js` bug'ı** bulundu:
Binance proxy'si (`proxyRequest()`) upstream'in gerçek HTTP status kodunu
(418/429 ban dahil) hiç forward etmiyordu, her zaman 200 dönüyordu — bu yüzden
`fetchKlines()`'ın ban kontrolü (`res.status===429||418`) hiç tetiklenmiyor,
ban yanıtı normal veri sanılıp `kl.map is not a function` ile çöküyordu.
**Düzeltildi ve push edildi** (`server.js`, tek satır: `res.statusCode = proxyRes.statusCode`),
production'da doğrulandı — artık `BotEngine`/`Kom1Scanner`/`M1Hammer` ban
sinyalini doğru algılayıp çökmeden `stop()` oluyor. Detay:
`dokumentasyon/raporlar/2026-08-10-binance-proxy-status-forward-fix.md`.

**Ama bu düzeltme banı kaldırmaz** — Binance'in kendi IP banı (`74.220.51.139`,
~2026-08-11 07:13 UTC'ye kadar) Binance tarafında, koddan bağımsız. Ban
geçene kadar Kom1Scanner gerçek backfill yapamıyor, dolayısıyla **gerçek
sinyal üretimi ban sonrasına kalıyor** — Görev 5'in fiili gözlem süreci de
bu yüzden henüz başlamadı.

### Kapsam (kullanıcıyla 2026-08-10'da netleşti)

- **Gözlem süresi:** Sabit bir gün sayısı değil — **kesinleşen ilk 10 sinyal**
  toplanana kadar gözlemlenecek (ban geçtikten sonra, ~2026-08-11 07:13 UTC'den
  itibaren).
- **"İyi çalışıyor" metriği:**
  1. **Manuel gözlem** — otomatik istatistiksel eşik yok, gelen sinyaller tek
     tek elle "mantıklı mı" diye değerlendirilecek.
  2. **Ban/hata sıklığı (teknik sağlık)** — sinyal kalitesinden önce, sistemin
     kendisinin ban/çökme olmadan güvenilir çalıştığı doğrulanacak (artık
     yukarıdaki proxy fix'i sayesinde ban durumunda da güvenli davranıyor).
- **İnce ayar kapsamı:** **Hiçbir parametre bu aşamada oynanmayacak** — WT
  eşiği, RC uzunluğu, TOLERANCE_BARS hepsi sabit kalacak (gorevler3.md'nin
  başındaki karara sadık kalındı). Sorun çıkarsa doğrudan koda müdahale
  edilir, bir "ayar paneli" bu turda kurulmaz.

### [x] Ban kalktı, gözlem fiilen başladı (2026-08-11)

Production'da doğrulandı: backfill 22/22 istek başarılı, ban yok. Aynı gün
iki büyük TF sinyali gerçekten ateşlendi (ONDOUSDT 1h, BERAUSDT 1h — 5dk
onay penceresi açıldı).

### [x] Sunucu taraflı "shadow" gözlemci eklendi (2026-08-11, kullanıcı isteği)

Kullanıcı, çok saatlik/günlük gözlem süresini Claude Code oturumundan
bağımsız, herhangi bir bilgisayardan kontrol edebileceği bir mekanizma
istedi. **Bu, Görev 7'nin (tam sunucu taraflı izleme + Telegram/email) YERİNE
GEÇMİYOR** — sadece Görev 5'in gözlem ihtiyacını karşılayan, dar kapsamlı
bir parça:

- Yeni `js/screener/kom1-server-watcher.js` — `kom1-scanner.js`'in (asıl,
  yetkili motor) AYNI kuralını ve AYNI `IndicatorEngine` fonksiyonlarını
  kullanarak, periyodik REST anlık görüntüleriyle (5dk'da bir) yaklaşık
  olarak tekrar hesaplar. `IndicatorEngine` bu yüzden izomorfik hâle
  getirildi (`window.X` + Node `module.exports`, tek kaynak — iki ayrı
  hesaplama yolu YOK).
- Sunucuda yeni `Kom1SignalLog` koleksiyonu (30 gün TTL — Görev 12'nin
  Candle hatasından ders alınıp baştan eklendi).
- `GET /api/kom1/signals` (kesinleşmiş sinyaller) ve `GET /api/kom1/status`
  (o an bekleyen sinyaller — izleyicinin canlı olduğunu görmek için)
  endpoint'leri eklendi.
- **Bilinen fark:** TOLERANCE_BARS burada bar-sayısı değil, eşdeğer
  duvar-saati süresine çevrildi (1h→3sa, 4h→12sa) — periyodik REST anlık
  görüntüsü mimarisi, WS bar-sayacı mimarisiyle birebir aynı değil, küçük
  bir zamanlama sapması olabilir. Bu yüzden "shadow/gözlemci" — asıl kayıt
  kaynağı hâlâ tarayıcıdaki `kom1-scanner.js` + Watchlist/alarm entegrasyonu.
- Telegram/email gönderimi burada YOK — hâlâ Görev 7'ye bağlı.

**Doğrulama:** Lokal `node -c` ile syntax, `require()` ile Node'da
`IndicatorEngine` doğru yüklendi, `/api/kom1/status` endpoint'i lokal
sunucuda test edildi (doğru sembol/TF listesi döndü). `/api/kom1/signals`
lokalde MongoDB bağlı olmadığı için beklenen timeout hatasını verdi (proje
standardı, diğer tüm Mongo-bağımlı endpoint'lerle aynı davranış). Gerçek
ağ/DB testi ancak production'da yapılabilir (sandbox'ın bilinen DNS
kısıtı) — deploy sonrası orada doğrulanacak.

### [x] Tamamlandı (2026-08-12) — 9/10 sinyalle, kullanıcı onayıyla

Günlük 11:00 zamanlanmış kontrol (`kom1-daily-signal-check`) 2026-08-12
11:09'da (yerel) çalıştı, yeni sinyal bulamadı — toplam 9 kesinleşen
sinyalde kaldı (10. sinyal beklemede). Kullanıcıya durum bildirildi,
kullanıcı 10.yu beklemeden devam edilmesini onayladı: "1 sinyal eksikse
sorun değil, gelen sinyallerle devam edelim."

**Manuel değerlendirme:** Ban/çökme yaşanmadı (teknik sağlık ✅). 9
sinyalin 6'sı TUSDT'ye ait ve ~1 saatlik dar bir fiyat bandında
kümelenmiş — WaveTrend'in tek bir uzun süreli aşırı-satım durumunda
eşiği defalarca aşağı-yukarı geçmesinden kaynaklanan bir örüntü (hata
değil, gözlemlenmesi gereken bir davranış — ileride "aynı sembol kısa
sürede tekrar tetiklenmesin" filtresi ihtiyacı doğabilir, bu turda
**hiçbir parametre değiştirilmedi**). Detaylı sinyal listesi ve analiz:
`dokumentasyon/raporlar/2026-08-12-gorev5-canli-gozlem.md`.

**Kullanıcı açıkça belirtti:** Görev 5 burada kapansın, Görev 6 (tüm
piyasaya genişletme, en riskli adım) için AYRICA açık onay istenecek —
bu rapor Görev 6'ya geçiş onayı DEĞİLDİR, sadece Görev 5'in kapanışıdır.

**Rapor:** `2026-08-12-gorev5-canli-gozlem.md`

---

## [x] ⏸ DUR — kullanıcı onayı bekle (Görev 6'dan önce) — 2026-08-12, "Görev 6'ya geç" onayı alındı

---

## [~] Görev 6 — Tüm piyasaya genişletme (dinamik ATR taraması) — implementasyon tamamlandı (2026-08-12), gözlem sürüyor

**Bağımlılık:** Görev 5'ten sonra, ban riskinin 11 coinlik kümede sorunsuz olduğu doğrulanmadan başlanmaz.

`sinyal-sistemi-pintrade-entegrasyon.md`'nin orijinal tasarımı: sabit coin listesi değil, tüm Binance USDT perpetual'ları tarayıp ATR14/fiyat oranı %3-12 arasına düşenleri otomatik "sakin" (Kom1 adayı) grubuna almak.

### Yapılacak (kullanıcı onayı sonrası detaylandırılacak)

- Hafif bir ATR14 REST taraması (BotEngine kuyruğu üzerinden, örn. her 15-30dk'da bir tüm sembollerin 1D ATR'ini hesapla) — "sakin" grubu belirle.
- Bu grup için Görev 2-3'teki büyük TF + 5dk onay mantığını uygula — ama artık ~500 sembolün tamamına değil, sadece o an "sakin" kategorisine düşen alt kümeye (muhtemelen 50-150 arası, piyasaya göre değişir).
- **Stream limiti riski:** MarketDataStore'un tek kline WS bağlantısı ~200 stream sınırlı. "Sakin" grup + TOLERANCE_BARS'taki 5dk onay bekleyenler toplamı bu sınırı aşarsa, MarketDataStore'a çoklu-bağlantı desteği eklemek gerekebilir — bu, ayrı bir alt görev olarak ele alınmalı, hafife alınmamalı.

### Tarama tasarımı — hacme göre katmanlı, rotasyonlu (2026-08-12, kullanıcıyla netleşti)

500 sembolü HER turda taramak yerine, 24 saatlik USDT hacmine göre 3
katmana bölünüp farklı sıklıklarda taranacak — hem ağırlık yükünü
zamana yayar hem de düşük likiditeli/riskli coinlere gereksiz kaynak
harcanmasını önler. Hacim verisi zaten `exchangeInfo`/ticker'dan
geliyor, ekstra API maliyeti yok.

| Katman | Kapsam | Tarama sıklığı | Gerekçe |
|---|---|---|---|
| 1 — Yüksek hacim | İlk ~100 coin (24s USDT hacmine göre sıralı) | Her turda (~15-20dk) | En likit, en öncelikli |
| 2 — Orta hacim | Sonraki ~200 coin | 2 turda bir (~30-40dk) | Makul, acele gerektirmiyor |
| 3 — Düşük hacim | Kalan ~200 coin (en düşük hacimli) | Seyrek (~2-4 saatte bir) | Düşük likidite → slipaj riski yüksek, dahil ama düşük öncelikli |

Her sembol için "son tarandığı zaman" MongoDB'de tutulacak (Kom1SignalLog'daki
desene benzer) — sunucu yeniden başlasa bile rotasyon kaldığı yerden
devam edebilecek, hangi bilgisayardan bağlanılırsa bağlanılsın durum
kaybolmayacak.

**Kullanıcı onayı:** 100/200/200 katman boyutları ve 3. katmanın
"tamamen dışarıda bırakmak yerine seyrek taransın" seçeneği onaylandı.

### Mimari kararı — WS yerine REST-only sunucu gözlemcisi (2026-08-12)

İnceleme sırasında bulundu: Kom1'in ZATEN iki motoru var — tarayıcı
motoru (`kom1-scanner.js`, gerçek WebSocket abonelikleriyle, 200-stream
sınırına tabi) ve sunucu gölge gözlemcisi (`kom1-server-watcher.js`,
SADECE REST, WebSocket kullanmıyor). **Kullanıcı onayıyla:** tüm piyasa
taraması `kom1-scanner.js`'e DEĞİL, `kom1-server-watcher.js`'e eklendi
— REST'in "stream" kavramı olmadığı için 200-stream sınırı riski
TAMAMEN ortadan kalktı. `kom1-scanner.js` (tarayıcı, sabit 11 coin)
DEĞİŞMEDİ. Bunun bedeli: sunucu gözlemcisi zaten "yaklaşık" (5dk'lık
REST anlık görüntüleri) — bu artık daha da doğru bir seçim, çünkü 500
sembollik bir ön-tarama için hassasiyetten çok kapsam önemli.

### ⚠️ Kapsam notu — ATR14 filtresi UYGULANMADI, sadece hacim-bazlı rotasyon

Orijinal tasarımın "ATR14/fiyat oranı %3-12 → sakin grup" filtresi
(sembolleri VOLATİLİTEye göre eleyen bir ön-filtre) **bu turda
uygulanmadı**. Bunun yerine sadece HACME göre 3 katmanlı bir tarama
SIKLIĞI rotasyonu kuruldu — evrendeki TÜM ~500 USDT perpetual (ATR'si
ne olursa olsun) er ya da geç taranıyor, sadece ne kadar sık
taranacakları hacme göre değişiyor. Büyük TF kuralının kendisi (RC+WT,
"fiyat RC_mid altında VE WT aşırı-satımdan çıkıyor") zaten doğası
gereği aşırı volatil/trendli coinlerde nadiren tetiklenir, bu yüzden
ATR ön-filtresi olmadan da mantıksız sinyal üretmesi beklenmez — ama
bu, orijinal tasarımdan BİLİNÇLİ bir sadeleştirme, gözden kaçmış bir
eksiklik değil. İleride istenirse ATR14 filtresi ayrı bir ince ayar
olarak eklenebilir.

### Yapılanlar

- `js/screener/kom1-server-watcher.js`: hacme göre 3 katmanlı sembol
  evreni yönetimi eklendi — `_refreshUniverse()` (exchangeInfo +
  toplu 24hr ticker, saatte bir yenilenir), `_dueSymbols()` (katman
  aralığı dolmuş sembolleri seçer), `tick()` artık sabit `SYMBOLS`
  yerine dinamik evreni tarıyor. Küçük TF onay taraması SADECE
  gerçekten bekleyen sinyali olan sembollere daraltıldı (500 sembolü
  her turda boşuna 5m onay için taramak israf olurdu). Basit bir
  reentrancy kilidi eklendi (ilk turun ~500 sembolü aynı anda "sırası
  gelmiş" sayması yüzünden uzun sürebileceği, üst üste binmesin diye).
- `server.js`: yeni `Kom1ScanState` şeması (sembol→katman/hacim/son-tarandı,
  TTL yok, canlı durum tablosu) — açılışta yüklenir
  (`loadScanState`), her tick sonrası SADECE DEĞİŞEN kayıtlar
  `bulkWrite` ile geri yazılır (`getScanStateForPersist`, dirty-tracking).
  `/api/kom1/status` artık `universe: {total, tier1, tier2, tier3, lastRefreshedAt}`
  döndürüyor (eski `symbols`/`bigTfs` alanları kaldırıldı, artık anlamsız
  çünkü liste dinamik).
- `kom1-daily-signal-check` zamanlanmış görevi güncellendi — eski
  "10 sinyale ulaşınca Görev 5'i tamamla" mantığı kaldırıldı (zaten
  yapıldı), artık günlük olarak `universe` durumunu da raporluyor.

### Doğrulama (sandbox'ta ağ erişimi olmadığı için sentetik/mock verilerle)

- Katman ataması ve hacme göre sıralama mantığı, taklit edilmiş
  exchangeInfo/24hr ticker yanıtlarıyla doğrulandı (geçersiz semboller
  — TRADING olmayan, USDT olmayan — doğru elendi, hacme göre azalan
  sıralama doğru). ✅
- Ağ erişilemezken (`_refreshUniverse` hata verince) önceki listeye
  düşme davranışı doğrulandı, `tick()` çökmedi. ✅
- "Sırası gelmemiş" semboller için REST çağrısı YAPILMADIĞI doğrulandı
  (boş `due` listesi → sıfır ağ çağrısı). ✅
- Reentrancy kilidi: eşzamanlı iki `tick()` çağrısından biri anında
  atlandı, çökme olmadı. ✅
- `getScanStateForPersist()`'in sadece DEĞİŞEN kayıtları döndürdüğü
  (dirty-tracking) doğrulandı — `loadScanState`'ten gelen kayıtlar
  "dirty" değil, ilk `getScanStateForPersist()` çağrısı boş döndü. ✅
- `node -c` ile hem `kom1-server-watcher.js` hem `server.js` sözdizimi
  doğrulandı.
- **Gerçek Binance verisiyle canlı test bu sandbox'ta yapılamadı** (ağ
  kısıtı) — deploy sonrası production'da doğrulanacak: `universe.total`
  ~500 civarında mı, katman dağılımı mantıklı mı (tier1=100, tier2=200,
  tier3=kalan), ban sinyali var mı.

### Doğrulama (canlı, production'da — devam ediyor)

- Ban sinyali yok mu (uzun süreli gözlem)? — **izleniyor**, günlük
  zamanlanmış kontrol + kullanıcı gözlemiyle. İlk deploy sonrası
  (2026-08-12 ~18:03 UTC) doğrulandı: `universe.total=527`
  (tier1=100/tier2=200/tier3=227, matematik doğru), ilk gerçek sinyal
  (BIOUSDT 1h) yakalandı, `/api/binance/futures` proxy'si 200 dönmeye
  devam etti.
- Stream sayısı 200 sınırının altında mı? — **N/A**, REST-only mimari
  seçildi, stream kavramı yok.

### ⚠️ Bulunan ve düzeltilen ek risk (aynı gün) — toplayıcı çakışması

Kullanıcı "sitede coin analiz ederken ban riski var mı" diye sordu.
Bulundu: kullanıcının kendi tarayıcı istekleri de (`/api/binance/futures`
proxy) arka plan toplayıcılarıyla AYNI sunucu IP'sini paylaşıyor —
2026-08-08'deki 11 saatlik ban ile aynı sınıf risk. Somut çakışma:
`collectBinanceCandles` (en ağır, ~527 sembol, 15sn'de başlayıp
~31sn'de bitiyor) ile Kom1'in taraması (eskiden 25sn'de başlıyordu,
Görev 6 sonrası artık o da yüzlerce sembolü kapsıyor) ~6sn'lik bir
pencerede çakışıyordu. **Düzeltildi:** Kom1'in gecikmesi 25000ms→40000ms
(`server.js`, commit `fb9056c`), production'da doğrulandı (ban yok,
proxy sağlıklı). Detay: `2026-08-12-gorev6-tum-piyasa-genisletme.md`
"Bulunan ve düzeltilen ek risk" bölümü. Bu bulgu, kalıcı mimari kural
olarak `.claude/CLAUDE.md`'nin "bot-architecture" bölümüne de eklendi
(yeni toplayıcı/bot eklerken herkesin bilmesi gereken bir gerçek).

### Sonraki oturum için (özet — tam detay rapor dosyasında)

Görev **kapanmadı**, gözlem sürüyor, kod tarafında yapılacak bir şey
YOK. Kontrol: `GET /api/kom1/status`, `/api/kom1/signals`, `/health`
(`kom1-daily-signal-check` bunu her gün 11:00'de otomatik yapıyor).
Henüz doğrulanmadı: tier3'ün (3 saatte bir) gerçekten rotasyona girip
girmediği — bunun için en az 3 saatlik gözlem gerekiyor. ATR14
volatilite filtresi hâlâ uygulanmadı (bilinçli, kullanıcı net onay
vermedi). Tam detay ve "sonraki oturum için" checklist'i:
`2026-08-12-gorev6-tum-piyasa-genisletme.md`.

**Rapor:** `2026-08-12-gorev6-tum-piyasa-genisletme.md`

---

## [ ] Görev 7 — Sunucu taraflı izleme: Kom1 + fiyat alarmları + bildirim kanalları (2026-08-10, kullanıcı isteği — henüz başlanmadı)

**Not (2026-08-11):** Görev 5'in gözlem ihtiyacı için DAR kapsamlı bir
sunucu-taraflı Kom1 gözlemcisi zaten eklendi (`js/screener/kom1-server-watcher.js`,
detay Görev 5'te) — ama bu Görev 7'yi TAMAMLAMIYOR. Eksik kalanlar: fiyat
alarmlarının (`AlertStore`, hâlâ localStorage) sunucuya taşınması, Telegram/email
gönderimi, ve asıl Kom1Scanner'ın kendisinin (client-side) sunucuya taşınması/entegre
edilmesi (şimdiki gözlemci sadece yaklaşık bir "shadow" kopya, resmi/yetkili motor
değil). Bu görev hâlâ olduğu gibi kuyrukta duruyor.

### Sade dille — bu görev ne, neden hemen yapılmadı

**Sorun:** Şu an hem Kom1 sinyal motoru hem de fiyat alarmı sistemi
tamamen **tarayıcı içinde** (client-side) çalışıyor. Yani:
- Pintrade sekmesini açık tutman gerekiyor.
- Bilgisayarı kapatır/tarayıcıyı kapatırsan, o an hiçbir sinyal taranmıyor,
  hiçbir alarm kontrol edilmiyor.
- Kullanıcı "tarayıcı kapalıyken de alarm/sinyal almalıyım" dediği için bu
  bir sorun.

**Bu görevin çözmesi gereken şey:** Bu izlemeyi **sunucuya** (server.js'in
çalıştığı Render sunucusu) taşımak — yani sunucu 7/24 kendi başına
fiyatları izleyip, Kom1 sinyali oluştuğunda veya bir alarm tetiklendiğinde,
kullanıcı tarayıcıyı hiç açmasa bile bunu fark etsin ve **Telegram'a mesaj
göndersin**.

**Neden hemen yapılmadı, sadece kuyruğa eklendi:** Bu, gorevler2.md Görev
11'de yapılan işlerden çok daha büyük bir mimari değişiklik — şunları
gerektiriyor:
1. Sunucuda sürekli çalışan yeni bir fiyat/sinyal izleme döngüsü kurmak
   (mevcut arka plan toplayıcılarıyla aynı düzende, Binance rate-limit
   bütçesini paylaşarak).
2. Alarmları şu anki gibi tarayıcının localStorage'ında değil, MongoDB'de
   saklamak (sunucu okuyabilsin diye).
3. Kom1Scanner'ın (şu an tamamen tarayıcıda çalışan kod) bir kopyasını ya
   da eşdeğerini sunucuya taşımak — dikkatli yapılması gereken, riskli bir
   refactor.
4. Kullanıcının oluşturacağı bir Telegram botunun token'ını sunucuya
   (.env, gizli) tanımlamak, sunucunun tetiklenen her şeyde Telegram'a
   mesaj atmasını sağlamak.

Kısacası: "tarayıcı kapalıyken de çalışsın" isteği, aslında çok daha büyük
bir işe işaret ediyor — bu yüzden hemen koda girişmek yerine görev olarak
kaydedilip, kapsamı kullanıcıyla birlikte netleştirildikten sonra
başlanması planlandı.

---

**Bağlam:** Kullanıcı, Kom1 sinyallerinin VE `gorevler2.md` Görev 11.5/11.6'da
kurulan çizim tabanlı fiyat alarmlarının **tarayıcı kapalıyken de** çalışmasını
istiyor — şu an ikisi de tamamen client-side (tarayıcı sekmesi açıkken
çalışır, kapanınca durur). Ayrıca Alarm sekmesine gelen sinyallerin
(AlarmSignalHistory) ileride bildirim (notification) olarak da gelmesi
isteniyor. TradingView'ın "Create Alert" modalındaki Email/Telegram
bildirim seçenekleri de (bkz. Görev 11.6) bu sunucu taraflı altyapı
kurulana kadar fiilen göndermiyor, sadece tercih olarak kaydediliyor.

**Kapsam netleşmedi — büyük bir mimari iş, kullanıcı onayı ve ayrıca
detaylandırma gerekiyor.** Muhtemel parçalar:

- Sunucuda (server.js) yeni, sürekli çalışan bir fiyat/sinyal izleme
  döngüsü — mevcut `collectBinanceData`/`collectLSData` gibi periyodik
  toplayıcılarla AYNI mimari desende (BotEngine'in rate-limit bütçesini
  paylaşan, kendi ayrı REST döngüsünü açmayan).
- Alarmların (`pintrade_alerts`, şu an localStorage) MongoDB'ye taşınması
  — sunucunun izleyebilmesi için client-side localStorage yetersiz.
- Kom1Scanner'ın (şu an tamamen client-side, `js/screener/kom1-scanner.js`)
  sunucu tarafına taşınması ya da sunucuda paralel bir kopyasının kurulması
  — büyük bir refactor, dikkatli ele alınmalı (mevcut client-side davranış
  bozulmamalı).
- **Telegram:** Kullanıcı kendi botunu BotFather ile oluşturacak, bot
  token'ı `.env`'e eklenecek (koda gömülmeyecek, sır). Sunucu, tetiklenen
  alarm/sinyalde Telegram Bot API'nin `sendMessage` endpoint'ine POST atar.
- **Email:** Bu turda KAPSAM DIŞI bırakıldı (kullanıcı: "şimdilik atlayalım,
  sadece Toast kurulsun") — ileride istenirse SMTP/SendGrid gibi bir servis
  kararı gerekecek.
- Alarm sekmesindeki (AlarmSignalHistory) sinyallerin de bildirim
  kanallarına (Telegram vb.) bağlanması.

### Doğrulama (kapsam netleştikten sonra)

- Tarayıcı kapalıyken bir alarm/Kom1 sinyali gerçekten tetikleniyor mu?
- Telegram mesajı doğru sohbete, doğru içerikle geliyor mu?
- Mevcut client-side davranış (tarayıcı açıkken Toast/ses) bozulmadı mı?

**Rapor:** `2026-XX-XX-gorev7-sunucu-tarafli-izleme-bildirimler.md`

---

## [ ] Görev 8 — Git düzensizliğini temizle (main/master ayrışması + commit'lenmemiş iş)

**Bulundu (2026-08-14), Görev 7'nin keep-alive workflow'unu push ederken.**

### Sorun

- **`main` ve `master` birbirinden ayrışmış.** GitHub'ın varsayılan/gerçekte
  deploy edilen dalı `main` (son commit `fb9056c`, gorevler3.md Görev 6'nın
  toplayıcı çakışması düzeltmesiyle eşleşiyor — yani Render buradan deploy
  ediyor). `master` ise iki farklı makineden/oturumdan gelen ayrı "sync"
  commit'leriyle (`962e340`, `bda5b79`, `e150874` / local'in kendi
  `929dfa9`'u) ilerlemiş, `main`'deki Kom1 sistemini (scanner,
  server-watcher, indicator-engine, güvenlik düzeltmeleri, Görev 6-14 arası
  her şey) hiç içermiyor.
- **Bu makinedeki (F:\_Egitim ve Gelistirme\_Pintrade) local diskte,
  hiçbir dala commit'lenmemiş çok sayıda dosya var** — Kom1 dahil
  production'da zaten çalışan kod, sadece diskte duruyor, git geçmişinde
  yok. Bir sürücü arızası/kayıp olursa bu iş tamamen geri alınamaz.
- Görev 7'nin keep-alive dosyaları (`.github/workflows/keep-alive.yml`,
  `scripts/keep_alive.py`) bu yüzden geçici bir `git worktree` ile
  doğrudan `origin/main`'e eklendi — mevcut `master`/local karışıklığına
  hiç dokunulmadı, riskli bir merge'e girilmedi.

### Yapılacak (kapsam kullanıcıyla netleşecek)

- `main`'in gerçekten "doğru/güncel" dal olduğunu kullanıcıyla teyit et
  (Render'ın hangi daldan deploy ettiği kontrol edilerek).
- Bu makinedeki commit'lenmemiş çalışma kopyasının `main` ile ilişkisini
  çıkar — muhtemelen `main` zaten güncel ve local'deki "uncommitted" görünen
  dosyalar aslında `main`'in içeriğiyle aynı/üstünde (henüz karşılaştırılmadı).
- `master` dalının ne yapılacağına karar ver: silinsin mi (GitHub'da varsayılan
  dal değilse zararsız, ama içinde `main`'de olmayan hiçbir gerçek iş yok
  gibi görünüyor), yoksa arşiv olarak mı kalsın.
- Bundan sonraki tüm oturumlarda hangi dalın kullanılacağı netleşsin
  (muhtemelen sadece `main`) ve düzenli commit alışkanlığı kurulsun.

### ⚠️ Dikkat

Bu, kod/özellik değişikliği DEĞİL — git geçmişi/hijyeni işi. Yanlış
adımda (force-push, yanlış dal silme) gerçek iş kaybı riski var, dikkatli
ilerlenmeli, kullanıcı onayı olmadan destructive komut (force push, branch
silme) çalıştırılmamalı.

**Rapor:** `2026-XX-XX-gorev8-git-duzensizligi-temizligi.md`

---

## Kuyrukta olmayan, kullanıcı ayrıca planlayacak

- **Kom2** — zayıf/doğrulanmamış (Varyant B'nin look-ahead bias'ı netleşmeden), ayrı bir tur.
- **Kom3** — hiç tanımlanmadı, kullanıcı tanımlayınca ayrı bir kuyruk.
- **Sinyal önerisi + geri ölçüm** (`gorevler2.md` Görev 6 ile aynı konu, oradan zaten biliniyor) — Kom1 canlıya çıkıp veri birikince ele alınacak.
- **Parametrelerin yapılandırılabilir hâle getirilmesi** (WT eşiği, RC uzunluğu vb.) — şimdilik sabit kodlanmasına karar verildi, ileride istenirse ayrı bir iş.

---

## İleri seviye — Kom1 gözlem sonrası ele alınacak

**Not (2026-08-10):** Bu dört madde de Kom1'in Görev 5 (canlı gözlem)
sonucunda "güvenilir" sayılmasına bağlı — önkoşul olarak işaretlendi,
Görev 5 tamamlanıp kullanıcı memnun kalmadan bunlara başlanmaz.

- ~~Chart üzerinde indikatör görselleştirmesi~~ — **KISMEN tamamlandı
  (2026-08-12)**, bkz. `gorevler2.md` Görev 14.1/14.2: EMA/DEMA artık
  gerçek overlay olarak chart'a çiziliyor (ana fiyat ekseniyle aynı
  ölçek, `js/chart/chart-pane.js`), + Indicators sidebar sekmesi.
  **RSI (ve WT/RC gibi diğerleri) kaldırıldı/eklenmedi** — subpane
  (alt-pencere) gerektiriyorlar, `lightweight-charts v4.1.3`'te native
  pane desteği yok. İki farklı yaklaşım denendi (ayrı senkronize chart;
  aynı chart'ın ikinci fiyat ekseni), ikisi de gerçek kullanımda ya
  hizasızlık/kilitlenmeye ya da LWC'nin etiket-sızdırma kısıtına takıldı
  (bkz. `gorevler2.md` Görev 14.1'in "Düzeltme 1/2/3" bölümleri, rapor:
  `2026-08-11-gorev14-chart-indikatorleri-ema-dema-rsi.md`).
  **Karar (kullanıcı, 2026-08-12):** RSI/MACD/Stochastic gibi subpane
  gerektiren indikatörlerin ihtiyacı biriktiğinde **lightweight-charts
  v5 migrasyonu** (native pane desteği) ayrı, tek seferlik bir görev
  olarak toplu ele alınacak — tek bir indikatör için yapılmayacak. Kom1
  canlı gözlem süreci (Görev 5) aktif olduğu için şu an chart tarafında
  büyük refactor riski alınmıyor. v5'e geçildiğinde `chart-pane.js`'in
  `addLineSeries`/`addCandlestickSeries`/... çağrılarının tamamının
  v5'in birleşik `addSeries()` API'sine taşınması gerekecek.
  **⭐ Kabul kriteri (v5 işine başlarken UNUTULMAMALI, bkz.
  `gorevler2.md` Görev 14.1 başındaki "STANDART" notu):** kullanıcı
  "maksimum şekilde TVdeki gibi olmalı" diyor — "artık bir subpane var"
  yetmez, etiketli 0-100 ekseni, doğru gridline/referans çizgileri,
  TV'nin kendi görsel dilini birebir taklit eden bir sonuç şart. v4'te
  denenip kullanıcı tarafından REDDEDİLEN "yaklaşık/etiketsiz RSI"
  sonucunu v5'te TEKRARLAMA.
- **Manuel strateji kararları için botların gerçek zamanlı çalışır
  durumda tutulması** — izleme/health-check mekanizması (bot çöktü mü,
  abonelik sızıntısı var mı, backfill takıldı mı gibi durumları tespit
  edip bildiren bir katman; şu an sadece konsol logları var).
- ~~Navbar'daki Alert butonunun işlevsel hale getirilmesi~~ — **✅ Tamamlandı
  (2026-08-10)**, bkz. `gorevler2.md` Görev 11.5 — çizim tabanlı (trendline/
  ray/extended/hline/hray/trendangle/infoline) fiyat alarmları, gerçek
  tetikleme + kalıcı depolama ile. Kom1'den bağımsız, manuel.
- **Alert → Telegram bildirim entegrasyonu** — bot token/chat id
  yapılandırması gerekecek, kullanıcının Telegram tarafını ayrıca
  kurması gerekiyor.
