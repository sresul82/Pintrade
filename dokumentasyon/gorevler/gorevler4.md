# Görev Kuyruğu 4 — Eksik Kalanların Toplandığı Yeni Kuyruk

**Oluşturulma:** 2026-08-18. `gorevler-durum-ozeti.md` + `gorevler2.md` +
`gorevler3.md` + `siradaki-gorevler.md` taranarak, henüz kapatılmamış/
tamamlanmamış tüm maddeler tek bir yeni kuyrukta toplandı. Eski dosyalar
DEĞİŞTİRİLMEDİ — bu sadece yeni işin başlayacağı güncel liste.

---

## Görev-1 — Chart'ta RSI görselleştirmesi

**Durum: RSI kısmı TAMAMLANDI (2026-08-18/20, çok turlu bir oturum
dizisinde).** WaveTrend/Regression Channel HENÜZ yapılmadı (bkz. Görev-1b
aşağıda) — bu madde sadece RSI'ı kapsıyor.

**Ne yapıldı (özet — detaylı rapor: `dokumentasyon/raporlar/
2026-08-18-rsi-inputs-style-tv-paritesi.md`, 5 tur):**
- RSI subpane, TV'nin Inputs/Style/Visibility sekmeleriyle BİREBİR eşleşen
  gerçek bir ayar penceresi: Source, Smoothing (RSI-based MA: SMA/EMA/
  SMMA/WMA), Calculate Divergence (gerçek pivot algoritması + Bull/Bear
  ok+etiket), Middle Band, bağımsız Upper/Middle/Lower band renk+kalınlık+
  stil, Output/Input values (precision, price-scale label, status line).
- Calculation → Timeframe alanı UI'da var ve kaydediliyor ama SADECE
  "Chart" (mevcut TF) fonksiyonel — kullanıcı onayıyla diğer TF'ler
  bilinçli olarak yapılmadı (paylaşılan Binance ağırlık bütçesi riski).
- Ayar penceresi artık başlığından sürüklenebilir (`DSDUtils.makeDraggable`,
  projenin kendi çizim araçları deseni) VE taşan içerikte kaydırılabilir
  (`.dsd-body` scroll + görünür scrollbar).
- RSI çizgisine (SADECE çizgiye, birkaç piksel toleransla — subpane'in
  geri kalanına değil) çift tıklayınca ayar penceresi açılıyor.
- Checkbox'lar projenin kendi neon-olmayan `.dsd-checkbox-label` desenine
  çevrildi (`.tv-checkbox` dolu `--accent-blue` neon arka fon kullanıyordu
  — proje genelindeki "neon buton arka fon yasağı" kuralının ihlaliydi).
- İndikatör silme (Remove + sidebar çöp kutusu) artık ortada açılan
  `ConfirmModal` ile onay istiyor (`js/ui/confirm-modal.js`, yeni dosya).
- Mıknatıs, RSI/subpane üzerindeyken devre dışı kalıyor (TV davranışı) —
  daha önce ana panelin mumlarına yapışıyordu.
- Crosshair RSI çizgisi üzerindeyken imlecin yanında yüzen bir değer
  badge'i (OI/Volume panelindeki aynı desen).
- **Kök neden bulunup düzeltilen kritik bug'lar:**
  - Renk swatch'ları alfayı siliyordu (`_toHex`) → ayarlara her giriş/
    çıkışta düşük-alfa dolgu renkleri opak griye dönüşüp RSI panelini
    kaplıyordu. `data-color` artık HAM (alfa dahil) tutuluyor.
  - F5 sonrası RSI paneli bozuk kalıyordu (defalarca yanlış teşhis edildi
    — stretch factor, ResizeObserver, hepsi yanlış yönlendi) — GERÇEK kök
    neden: RSI ana çizgi serisinde TEK BAŞINA `priceScale().applyOptions(
    {autoScale:false})` vardı, OB/OS/MA serilerinde YOKTU. Kullanıcının
    konsol çıktısıyla kanıtlandı (`priceToCoordinate` = 0, çift tıklayınca
    ~49'a düzeliyordu). O satır kaldırıldı.
  - `server.js` statik dosyaları (css/js/index.html) hiç `Cache-Control`
    göndermiyordu → Chrome F5'te sunucuya sormadan eski dosyaları
    sunabiliyordu (birçok "düzelttim ama hâlâ bozuk" raporunun kök nedeni
    muhtemelen buydu). Artık `no-cache`.
  - **RSI (ve genel olarak subpane) üzerine çizilen trendline/fibo vb.
    çizimler, panel büyütülüp/panlanınca birlikte hareket etmiyordu** —
    kök neden: `drawing-core.js`'teki `_pt2xy`/`_xy2pt` HER ZAMAN ana mum
    serisini kullanıyordu, hangi panelde çizildiğine bakmadan. Düzeltme:
    her çizime `d.paneKey` (null=ana panel, indikatör id=subpane) eklendi,
    render/hit-test `_renderPaneKey` bayrağıyla doğru paneli/seriyi
    kullanıyor. Geriye dönük uyumlu (eski çizimler ana panel gibi davranır).
    **Kullanıcı tarafından production'da doğrulandı (2026-08-26) — RSI'ye
    çizilen trendline, panel büyütülüp/panlanınca birlikte hareket ediyor.**

**Bilinçli ertelenen/basitleştirilen alt-madde:**
- TV'nin "SMA + Bollinger Bands" smoothing seçeneği + BB StdDev — YOK,
  kullanıcı onayıyla ("buna da gerek yok").
- Divergence'ta TV'nin ayrı "...Label" satırı + Color0/Color1 gradyanı —
  YOK, tek checkbox+tek renk yeterli bulundu (Bullish=yeşil yukarı ok,
  Bearish=kırmızı aşağı ok zaten böyle).

---

## Görev-1b — Chart'ta WaveTrend/Regression Channel görselleştirmesi

**Durum: Başlanacak, henüz hiç yapılmadı.** RSI'nin (Görev-1) altyapısını
(subpane sistemi, `ChartPane.SUBPANE_TYPES`/`SUBPANE_INDEX`, ayar penceresi
deseni) örnek al — RSI için kurulan mimari (Inputs/Style/Visibility
sekmeleri, draggable+scrollable dialog, ConfirmModal, neon-olmayan
checkbox deseni) buraya da BİREBİR uygulanmalı, sıfırdan icat edilmemeli.

**⭐ Kabul kriteri (unutulmamalı):** Kullanıcı "maksimum şekilde TVdeki gibi
olmalı" diyor — sadece "bir subpane var" yetmez, etiketli eksen, doğru
gridline/referans çizgileri, TV'nin kendi görsel dilini birebir taklit
eden bir sonuç şart.

---

## Görev-2 — Kom2 CloudFront/Binance blok olayı sonrası temizlik

**Durum: Blok açılmasını bekliyor.** 2026-08-17/18 gecesi Kom2'nin evren
taraması (ATR14≥%12, ~527 sembol) production'da tekrarlayan ban'lara yol
açtı, son aşamada canlı chart proxy'si de (`/api/binance/futures/*`)
CloudFront'tan 403 almaya başladı — tam detay: `dokumentasyon/raporlar/
2026-08-18-kom2-evren-taramasi-ve-cloudfront-blok-olayi.md`.

- 2.1 Blok açıldığında Kom2'nin evren taramasını güvenli şekilde yeniden
  tetiklemek (mevcut backoff 24 saat — manuel müdahale gerekebilir).
- 2.2 Uzun vadede: evren tarama durumunu Mongo'da kalıcı hale getirmek
  (her redeploy'da sıfırdan başlamasın) — bu gecenin "sık redeploy = istek
  patlaması birikimi" dersinin kalıcı çözümü.
- 2.3 Bu gecenin dersini `.claude/CLAUDE.md` "bot-architecture" bölümüne
  eklemek (kullanıcı onayıyla) — "bir rate-limit sorununu düzeltmeye
  çalışırken sık redeploy etmek sorunu büyütebilir".

**⚠ 2.4 — 2026-08-20'de canlıda DOĞRULANDI, hâlâ açık:** `GET https://
pintrade-0sb6.onrender.com/api/kom2/status` çağrıldığında `universe.total:
84` (normal ~500+ yerine) ve `lastError: {"message":"exchangeInfo/24hr
ticker beklenmeyen yanıt"}` görüldü, `nextAttemptAt` çok ileri bir tarihe
ayarlı (yeniden deneme uzun süre olmayacak). Yani evren taraması hâlâ
kısıtlı/bozuk kalmış durumda — sinyal üretimi (PORTALUSDT/DODOXUSDT/
MAGMAUSDT/HEMIUSDT üzerinde tekrar tekrar ateşleniyor, ama sadece 84
sembollük dar bir evrende) çalışıyor ama muhtemelen çoğu sembolü hiç
görmüyor. **Bir sonraki oturumda önce bu 84/exchangeInfo hatasını
araştır** — 2.1/2.2 ile aynı kök nedene (CloudFront/rate-limit blok)
bağlı olabilir ya da ayrı bir regresyon olabilir, `kom2-server-watcher.js`
`_maybeRefreshUniverse()`/`fetchJson()` çağrılarından başla.

**⚠ 2.5 — 2026-08-26'da canlıda DOĞRULANDI, hâlâ açık:** `GET https://
pintrade-uwg9.onrender.com/api/kom2/status` (backend adresi artık bu,
`0sb6` terk edildi — bkz. pintrade-yapisi.md) çağrıldığında `universe.total:
87` (hâlâ ~500+ değil, tier1=87/tier2=0/tier3=0 — evren hâlâ tek katmanda
sıkışık) ve `lastError: {"message":"BAN_SIGNAL_418","at":1787747466886}`
(2026-08-26 12:31 UTC — bu OTURUM SIRASINDA, taze) görüldü, `nextAttemptAt`
24 saat sonrası (2026-08-27 12:31 UTC). Bu sefer hata net (gerçek ban,
2026-08-20'deki gizemli "beklenmeyen yanıt" değil) — sistem doğru teşhis
edip doğru şekilde 24 saat geri çekildi, bu KISIM zaten doğru çalışıyor.

Zamanlama incelendi (`server.js`'teki `_staggeredStart` gecikmeleri):
Kom1=40000ms, Kom2 OI/LS=180000ms, Kom2 evren taraması=185000ms, hepsi
5dk'lık interval'in katları olduğu için faz ilişkisi her turda SABİT.
Kom2'nin evren taraması tek seferde ~500 sembolü değil, her tick'te
sadece `UNIVERSE_SCAN_CHUNK_SIZE=40` sembollük bir parçayı (~20-35 saniye)
işliyor (`kom2-server-watcher.js` `_advanceUniverseScan`) — bariz bir
zamanlama çakışması bu incelemede bulunamadı. Pacing sabitlerini (`UNIVERSE_
SCAN_GROUP_SIZE`/`_PACE_MS`/`_PAUSE_MS`) kanıt olmadan tahminle değiştirmek
riskli (`.claude/CLAUDE.md` bot-architecture kuralı — "sık redeploy sorunu
büyütebilir" dersi tam bu senaryo için yazılmıştı).

**Yapılan tek güvenli iyileştirme:** `fetchJson()` artık 429/418 dışındaki
HER hatada (CloudFront 403, farklı şekilli JSON hata gövdesi vb.) gerçek
HTTP status kodunu + gövdenin ilk 200 karakterini hataya ekliyor —
2026-08-20'deki gibi anlamsız "beklenmeyen yanıt" mesajları artık
gelmeyecek, bir sonraki başarısız denemede (yarın veya sonrasında)
`/api/kom2/status`'un `lastError` alanı gerçek sebebi gösterecek.

**Sonraki oturumda ilk iş:** `nextAttemptAt` (2026-08-27 12:31 UTC)
geçtikten sonra `/api/kom2/status`'a tekrar bak — eğer yine
`BAN_SIGNAL_418` ise bu KALICI bir pacing sorunu demektir (pacing
sabitleri gözden geçirilmeli); eğer farklı bir hata mesajı görünüyorsa
(artık detaylı) yeni bir ipucu demektir; eğer başarılıysa ve
`universe.total` gerçekten ~500'e çıkıyorsa sorun kendiliğinden çözülmüş
olabilir (IP'nin genel ban geçmişi zamanla iyileşiyor olabilir).

**Görev-7'nin (bot sağlık/izleme) bir parçası artık KALICI çözüldü:**
Kullanıcının "her gün 11'de Kom2 kontrol edilip raporlanacaktı" beklentisi
daha önce `CronCreate` (session-only, oturum/makine değişince kayboluyor
— tam bu yüzden sessizce durmuştu, bkz. `2026-08-14-kom1-uyku-kaybi-ve-
sinyal-analizi.md`'deki AYNI bulgu) ile kurulmuştu. 2026-08-20'de bunun
yerine **kalıcı bir cloud routine** kuruldu (`RemoteTrigger`/`/schedule`,
oturuma bağlı değil): `trig_01VgVBbSCSctroyujARwGxR7`, her gün Tashkent
saatiyle 11:00'de (`0 6 * * *` UTC) `/api/kom2/status`+`/signals`+`/health`
kontrol edip Türkçe özet rapor üretiyor — universe.total düşükse veya
lastError doluysa açıkça uyarıyor. Detay/düzenleme: https://claude.ai/
code/routines/trig_01VgVBbSCSctroyujARwGxR7 (Kom1 için de aynısı istenirse
aynı yöntemle ayrı bir routine kurulmalı — henüz kurulmadı).

---

## Görev-3 — `gorevler3.md` Görev 7'nin kalanı: fiyat alarmları (AlertStore)

**Durum: ⏳ Faz 1 tamamlandı (2026-08-26) — production'da henüz
doğrulanmadı.** Kapsam araştırıldığında tam migrasyonun (`createFromDrawing`/
`createManual`/`updateAlert`/`removeAlert`'i asenkron yapıp TÜM çağıran
UI kodunu değiştirmek + eğik çizgi alarmlarının canlı geometrisi için
çizimleri de sunucuya senkronize etmek) çok büyük/riskli olduğu görüldü —
kullanıcı onayıyla **kullanıcı-onaylı aşamalı kapsam** seçildi:

**Faz 1 (bu turda yapıldı) — SADECE manuel (sabit fiyatlı) alarmlar:**
- İstemci (`alert-store.js`) BİLEREK senkron/localStorage kalmaya devam
  ediyor — hiçbir çağıran kod değişmedi, mevcut davranış/UI etkilenmedi.
- Manuel alarmlar artık arka planda (fire-and-forget, hataya toleranslı)
  sunucuya "aynalanıyor": yeni `Alert` Mongo şeması + `POST/PATCH/DELETE
  /api/alerts` endpoint'leri.
- Yeni `checkAlerts()` sunucu kontrolcüsü (`_staggeredStart`, 1dk'da bir,
  **sıfır ek Binance/Bybit isteği** — zaten `collectBinanceData`/
  `collectBybitData`'nın çektiği ticker verisinden paylaşılan
  `_latestPrices` haritasını okuyor) tetiklenen alarmları Telegram'a
  düşürüyor (`notifyTelegram` işaretliyse, `sendTelegramMessage` — Kom1
  ile aynı fonksiyon).
- Tarayıcı alarmı ÖNCE kendi yakalarsa (`checkPrice`), sunucuya "zaten
  tetiklendi" diye PATCH atıyor — mükerrer Telegram bildirimi önlendi.
- Eğik çizgi alarmları (trendline/ray/extended/trendangle/infoline)
  BİLEREK kapsam dışı bırakıldı — tetik fiyatları `State.getDrawings()`'e
  (sadece tarayıcıda) bağlı, sunucunun erişimi yok. Bunlar hâlâ SADECE
  tarayıcı açıkken çalışıyor, önceki davranıştan regresyon YOK.

**Yan bulgu:** `window.AppConfig` her zaman `undefined` — `app-config.js`
`AppConfig`'i hiçbir yerde `window`'a atamıyor (sadece top-level `const`).
Kod tabanındaki birçok dosya (`fr-tracker.js`, `oi-volume-panel.js`,
`kom1-scanner.js`, `alarm-signal-history.js` vb.) `window.AppConfig?.X ||
sabit_url` deseniyle bunu fark etmeden sessizce hep sabit fallback URL'e
düşüyor — üretimde zararsız (fallback'ler gerçek URL'lerle eşleşiyor) ama
"config-driven" görünen kod aslında hiç config okumuyor. Düzeltilmedi
(geniş, ilgisiz bir refactor olurdu), sadece not düşüldü — yeni yazılan
`alert-store.js` kodu bare `AppConfig` (doğru kapsam) + fallback kullanıyor.

**Faz 2 (ayrı, gelecekte):** Çizimlerin sunucuya senkronizasyonu + eğik
çizgi alarmlarının da sunucu tarafında izlenmesi.

**Sonraki oturumda ilk iş:** production'da manuel bir alarm oluşturup
(Telegram bildirimi işaretli), tarayıcıyı kapatıp fiyatın seviyeyi
geçmesini bekleyip Telegram'a gerçekten düştüğünü doğrulamak (yerel
sandbox'ta test edilemedi — hem MongoDB hem gerçek fiyat hareketi
gerektiriyor).

---

## Görev-4 — Kom1 Görev 6: tier3 rotasyon doğrulaması

**Durum: Sadece pasif gözlem gerekiyor, aktif iş yok.** Hacme göre 3
katmanlı rotasyonun (tier3 = en düşük hacimli ~200 coin, 3 saatte bir
taranmalı) fiilen çalıştığı henüz doğrulanmadı — birkaç saatlik gözlemle
`/api/kom1/status` üzerinden kontrol edilebilir.

---

## Görev-5 — Kom3 stratejisi tanımı

**Durum: Kullanıcı tanımı bekliyor.** Kom1 ve Kom2 tanımlı/production'da,
Kom3 hiç tanımlanmadı. Watchlist/Alarm UI'da placeholder olarak zaten
scaffold'lı (`KOM_BADGE_STYLE[3]`, "Combo 3", kesikli/soluk rozet).

---

## Görev-10 — 2026-08-20: Screener'daki boş bot sekmelerinin doldurulması (M1-A/V3/4S + Kom3)

**Durum: Kullanıcı isteği, henüz kapsam netleşmedi — bir sonraki oturumda
kullanıcıyla konuşulmalı.** Kullanıcı: "Screener içinde botlarımız
bulunmakta ama altı boş, doldurmamız lazım — botlar manuel sinyal
yakalama için önemli."

**Tespit edilen boş/placeholder bot sekmeleri:**
- `js/screener/bot-signals-panel.js` `BOT_TABS`: **FR** ve **M1 Hammer**
  gerçek/canlı (DOKUNULMAZ — bkz. `.claude/CLAUDE.md` bot-architecture
  kuralı). **M1-A, V3, 4S** UI'da sekme/rozet olarak SCAFFOLD'LI ama
  arkalarında gerçek sinyal mantığı/veri YOK (`_activeBot` state'inde
  'm1a'/'v3'/'4s' değerleri var ama besleyen bir watcher/strateji yok).
- Ayrıca **Kom3** (Görev-5, yukarıda) da aynı şekilde boş — muhtemelen
  kullanıcı bu ikisini (M1-A/V3/4S rafı + Kom3) birlikte kastediyor,
  netleştirilmeli.

**⚠ ZORUNLU kısıt (kullanıcının kendi sözleriyle vurguladığı):** Bu
botların veri çekme şekli, Binance BAN riskini göz önünde bulundurarak
tasarlanmalı. Proje zaten bunun için mimari kurmuş durumda — YENİDEN
İCAT EDİLMEMELİ:
- `.claude/CLAUDE.md` "bot-architecture" bölümü: hiçbir bot doğrudan REST
  isteği atamaz, HEPSİ `BotEngine.queueRestRequest()` (`js/screener/
  bot-engine.js`) üzerinden geçmeli — tüm trafik tek IP'den çıkıyor,
  Binance ağırlık limiti IP başına. Kline için de `MarketDataStore.
  subscribeKlines()`/`unsubscribeKlines()` (`js/data/market-data-store.js`)
  kullanılmalı, kendi WebSocket'ini AÇMAMALI.
- Sunucu-taraflı yeni bir toplayıcı (Kom1/Kom2 gibi) eklenecekse,
  `server.js`'teki `_staggeredStart()` ile MEVCUT tüm toplayıcıların
  açılış gecikmelerine bakıp çakışmayacak bir pencere seçilmeli (2026-08-12
  gecesi tam bu yüzden bir çakışma yaşanmıştı, bkz. CLAUDE.md).
- **Taze/somut bir uyarı örneği:** 2026-08-17/18 gecesi Kom2'nin evren
  taraması (~527 sembol) tekrar eden ban'lara ve CloudFront 403 blokuna
  yol açmıştı (Görev-2, yukarıda) — HÂLÂ tam açılmadı (evren 84 sembolde
  sıkışık kalmış durumda, 2026-08-20'de doğrulandı). Yeni bot(lar)ı
  tasarlarken bu olay ders olarak alınmalı: küçük evren + kademeli
  genişleme + paylaşılan ağırlık bütçesine saygı.

**Not (kullanıcı isteği, 2026-08-20):** Bu görevin dokümantasyonu SADECE
bu yerel `dokumentasyon/gorevler/` klasöründeki dosyalara işlenecek —
kullanıcı SSD üzerinden çalışıyor ve dosyaları kendisiyle taşıyor, cloud
tabanlı bir görev takibine (ör. bu oturumun kendi TaskCreate listesi)
YAZILMAYACAK/eklenmeyecek.

---

## Görev-6 — `gorevler2.md`'den kalan küçük iyileştirmeler (izleme listesi)

Hiçbiri acil değil, birikmiş küçük borçlar:

- 6.1 ✅ (2026-08-26, kod tamamlandı — production'da henüz doğrulanmadı)
  `funding:loaded` event'i artık tüm `loadSymbol()`'ü (~12-15 istek) tekrar
  çağırmıyor. Kök neden: Binance'in `frIntervalText`'i zaten kendi ayrı
  `frHist` fetch'inden geliyor (bu event'e bağımlı değil) — SADECE Bybit
  tarafı `ExchangeRouter.getFundingInterval` ile bu cache'i okuyordu. Yeni
  davranış: sadece aktif borsa Bybit ise, `#dp-funding-label` metnini
  doğrudan cache'ten (sıfır ek istek) güncelliyor; Binance'te hiçbir şey
  yapmıyor (zaten doğru). **Sonraki oturumda ilk iş:** production'da Bybit
  bir coin açıp Network sekmesinden `funding:loaded` sonrası gerçekten
  ekstra istek gitmediğini ve "(Xh)" etiketinin doğru güncellendiğini
  doğrulamak (yerel sandbox'ta ekran görüntüsü/otomasyon araçları
  yanıt vermedi, sadece kod/sözdizimi doğrulandı).
- 6.2 ✅ (2026-08-26, kod tamamlandı — production'da henüz doğrulanmadı)
  fib-ext/fib-channel/fib-timezone iki nokta değil üçüncü bir çapa
  noktasından (p3/vektör) projekte ettiği için `_fibAxis`'in iki-değerli
  imzasına birebir sığmıyordu — bu üçü kendi `reverse ? -x : x`
  kopyalarını kullanıyordu (drawing-fibo.js render VE drawing-core.js
  hit-test'te AYRI AYRI). Ortak parça (`_reverseSpan`) tek yere taşındı,
  hem render hem hit-test artık aynı fonksiyonu çağırıyor.
  **Bu incelemede gerçek bir bug bulundu:** fib-ext ve fib-timezone'da
  "Reverse" işaretliyken render çapayı kaydırıyordu
  (`effP3Y = reverse ? p3.y+yDiff : p3.y`) ama hit-test kaydırmıyordu
  (`c.y` sabit kullanıyordu) — yani Reverse açıkken seviye çizgileri
  GÖRÜNDÜĞÜ yerde tıklanamıyordu (fib-channel'da bu sorun yoktu, ikisi
  zaten eşleşiyordu). Düzeltme: hit-test artık render'la BİREBİR aynı
  çapa hesabını kullanıyor — çizim hiç değişmedi, sadece tıklama kutusu
  çizimle eşleşti, mevcut kayıtlı çizimlerin görünümü etkilenmez.
  **Sonraki oturumda ilk iş:** production'da bir Fib Extension VE bir Fib
  Time Zone çiz, "Reverse" işaretle, seviye çizgilerine tıklayıp
  seçilebildiğini doğrula (öncesinde muhtemelen seçilemiyordu).
- 6.3 ✅ (2026-08-26, kod tamamlandı — production'da henüz doğrulanmadı)
  Sütun menüsü "1D Open" artık işlevsel. Kullanıcının önerisiyle EKSTRA
  BINANCE İSTEĞİ YOK: `server.js`'in zaten her 1dk'da çektiği ticker
  verisinden (`collectBinanceData`), UTC gün başına en yakın turda bir
  kerelik `DayOpenPrice` koleksiyonuna snapshot alınıyor
  (`_maybeCaptureDayOpen`). Yeni endpoint: `GET /api/market/day-open`.
  Tarayıcı bunu bir kez çekip zaten akan canlı `!miniTicker@arr` WS
  fiyatıyla kendi hesaplıyor (`watchlist-store.js getDayOpenPrice` +
  `screener-core.js _changePct`, sadece Binance FUTURES — SPOT/Bybit
  kapsam dışı, mevcut karar korundu). **Sonraki oturumda ilk iş:**
  production'da menüden "1D Open" seçilip değerlerin makul göründüğünü
  ve `DayOpenPrice` koleksiyonunun UTC gece yarısında gerçekten
  yenilendiğini doğrulamak.
- 6.4 ✅ Aslında zaten 2026-08-15'te `OiVolumePanel` ile dolduruldu (bu
  dosyadaki/`gorevler2.md`/`gorevler-durum-ozeti.md`'deki not 2026-08-01
  tarihli ilk boş implementasyondan kalma, güncellenmemiş). 2026-08-26'da
  ek iyileştirme: görünür nokta sayısı artık pencere genişliği/resize/TF'den
  bağımsız SABİT 12 (`VISIBLE_POINTS`, önceki piksel-genişliğine-göre-
  bar-sayısı yaklaşımı öngörülemez zaman pencerelerine yol açıyordu) +
  zaman eksenine her noktanın saatini gösteren `tickMarkFormatter` eklendi.
  **Sonraki oturumda ilk iş:** production'da OI popup'ı açıp TF değiştirip
  hem 12 nokta sabit kalıyor mu hem zaman etiketleri görünüyor mu doğrulamak
  (yerel sandbox'ın bilinen ağ kısıtı yüzünden bu turda test edilemedi).
- 6.5 ⏳ (2026-08-26, kısmen tamamlandı — production'da henüz doğrulanmadı)
  Kapsam araştırıldığında ilk göründüğünden büyük çıktı: **Status Line
  sekmesi (Logo/Title/Market status/Chart values/Bar change/Volume/
  Background) bu projede HİÇ VAR OLMAYAN bir arayüz özelliğine karşılık
  geliyordu** — TV'nin ana chart üzerindeki sol-üst OHLC bindirmesi bu
  projede hiç inşa edilmemiş (mevcut `.pane-hdr`/`.ohlcv-row` kısmen
  benzer ama birebir değil). Bağlamak yerine sıfırdan yeni bir UI özelliği
  inşa etmek gerekiyordu — görsel doğrulama yapılamayan bu oturumda riskli
  bulundu, **kullanıcı kararıyla (2026-08-26) sekmenin tamamı kaldırıldı**
  ("pek ihtiyaç duyulabilecek bir özellik değil şimdilik"). Tek gerçekten
  çalışan kontrolü (`showVolume` — hacim histogramı aç/kapa) Canvas
  sekmesine (`CHART BASIC STYLES` altına, Watermark'ın hemen altına)
  taşındı, kaybolmadı. `TABS` dizisinden, render satırından, `tabStatusline()`
  fonksiyonundan tamamen silindi — RSI'nin kendi ayrı "status line"
  özelliğiyle (Values/Inputs in status line) karıştırılmasın, ona
  dokunulmadı. **Ek (aynı gün, kullanıcı takibi):** "Volume'u indikatörler
  içine taşısak doğru olmaz mı" sorusuna — gerçek indikatör mimarisine
  (`this.indicators[]`, `addIndicator`/`removeIndicator`) taşımak
  `_buildSeries()`'e derinlemesine bağlı olduğu için orta-büyüklükte bir
  refactor olurdu (geriye dönük uyumluluk + görsel doğrulama gerektirir).
  Kullanıcı bunun yerine **"kısayol" yaklaşımını** istedi: checkbox tek
  doğruluk kaynağı olarak KALDI, ama artık Indicators arama modalında
  ("Volume" arayıp tıklayınca `setVolume(true)`) VE sağ sidebar'daki
  indikatör listesinde (showVolume açıkken sentetik bir satır, çöp
  kutusuna tıklayınca `setVolume(false)`) de görünüyor/kaldırılabiliyor —
  üçü de (checkbox/modal/sidebar) aynı `pane.showVolume`/`setVolume()`'a
  yazıp okuyor, ayrı bir veri modeli YOK.
  (Values/Inputs in status line) özelliğiyle karıştırılmasın, o ayrı ve
  dokunulmadı.

  Ayrıca Scales/Canvas'taki bazı kontrollerin
  (Lock price to bar ratio, No overlapping labels, Plus button, Currency/
  Unit visibility, Scale mode visibility, Navigation/Pane button
  visibility, Save left edge, Symbol label style) lightweight-charts'ta
  net bir native karşılığı bulunamadı veya projede karşılık gelen bir UI
  elemanı yok — bunlar da YAPILMADI, ayrı bir araştırma gerektiriyor.

  **Güvenle bağlanan, net 1:1 kütüphane/UI karşılığı olan kısım:**
  - Canvas: `watermarkColor` (renk seçici vardı, hiç okunmuyordu — artık
    `this.wm.style.color`'a uygulanıyor, varsayılan `null` = CSS'in
    kendi rengi (`rgba(255,255,255,0.03)`) korunuyor, kullanıcı hiç
    dokunmadıysa görünüm DEĞİŞMEZ).
  - Canvas: `marginRight` ("bar cinsinden sağ boşluk" — LWC'nin native
    `timeScale().rightOffset`'ine bağlandı). **Yan bulgu:** `_initChart()`
    bunu hardcoded `12` ile ayarlıyordu, restore edilen bir değer sessizce
    eziliyordu — marginTop/marginBottom'da 2026-08-10'da düzeltilen AYNI
    hata sınıfı, önlendi.
  - Scales > TIME SCALE: `dayOfWeekLabels`/`dateFormat`/`timeFormat` artık
    merkezi `_formatTimezone()`'a bağlı (hem crosshair tooltip hem eksen
    tick etiketleri).
  - **Yan düzeltme:** `marginTop`/`marginBottom`/`marginRight` number
    input'ları ayarlar penceresi her açılışta HTML'deki sabit değerleri
    (10/8/10) gösteriyordu, pane'in gerçek kayıtlı değerini DEĞİL — küçük
    bir `setNumber` pre-fill helper'ı eklenerek düzeltildi.

  **Sonraki oturumda ilk iş:** production'da watermark rengini değiştirip
  görünüp görünmediğini, marj-sağ değerini değiştirip mumların sağındaki
  boşluğun değiştiğini, Scales > Time hours format'ı 12-hours yapıp
  crosshair/eksen saatlerinin "6:00pm" gibi göründüğünü, ve ayarlar
  penceresinde artık "Status line" sekmesinin hiç görünmediğini ama
  "Volume" checkbox'ının Canvas sekmesinde çalışır durumda olduğunu
  doğrulamak (yerel sandbox'ta görsel test yapılamadı).

---

## Görev-7 — Bot sağlık/izleme mekanizması

**Durum: ⏳ Kısmen ilerledi (2026-08-26) — production'da henüz doğrulanmadı.**
İlk incelemede bu maddenin "hiç başlanmadı" olmadığı, sanıldığından daha
ileride olduğu ortaya çıktı:
- **Kom1:** `kom1-daily-signal-check` zamanlanmış görevi (bu makinede,
  `C:\Users\PC\.claude\scheduled-tasks\`) canlı olarak doğrulandı — her
  gün 11:00'de çalışıyor, bir sonraki çalışma 2026-08-27T06:09 UTC.
- **Kom2:** ayrı bir cloud routine var (`trig_01VgVBbSCSctroyujARwGxR7`,
  bkz. Görev-2), her gün Tashkent 11:00'de `/api/kom2/status` kontrol
  ediyor.

Yani "günlük özet + anomali uyarısı" katmanı ikisi için de zaten mevcut.
Gerçekten eksik olan tek şey: hiçbir yerde **"bot en son ne zaman
gerçekten bir tur attı"** bilgisi tutulmuyordu — yani bot `tick()` içinde
bir exception'la sessizce ölse (döngü bir daha hiç çalışmasa), bunu ancak
ertesi günkü rapor (ve o da dolaylı olarak, "yeni sinyal yok" ile
karıştırılarak) gösterebilirdi.

**Eklenen (2026-08-26):** Hem `kom1-server-watcher.js` hem
`kom2-server-watcher.js`'e `_lastTickAt` (her `tick()` BAŞLADIĞINDA
damgalanır, bitmesini beklemez) + `getLastTickAt()` eklendi, `/api/kom1/
status` ve `/api/kom2/status`'a `lastTickAt` (epoch ms) alanı olarak
yansıtıldı. `kom1-daily-signal-check` görevinin talimatı güncellendi:
artık `lastTickAt` şu andan **>20 dakika** eskiyse (normal tur aralığı
~5dk) kullanıcıya hemen bildiriyor — botun tick döngüsünün sessizce
öldüğünün en erken işareti bu olacak.

**Sonraki oturumda ilk iş:**
1. Production'da `/api/kom1/status` ve `/api/kom2/status`'un artık
   `lastTickAt` döndürdüğünü doğrula.
2. Kom2'nin cloud routine'ine (yukarıdaki link) AYNI heartbeat kontrolünü
   elle eklemek gerekiyor — bu oturumda o routine'i düzenleyecek bir araç
   yoktu, sadece Kom1'in yerel zamanlanmış görevi güncellenebildi.

---

## Görev-8 — Bilinçli ertelenmiş kararlar (düşük öncelik, kullanıcı onayı gerekir)

- 8.1 Kom1 parametrelerinin yapılandırılabilir hale getirilmesi (WT eşiği,
  RC uzunluğu, TOLERANCE_BARS — şu an sabit kodlu).
- 8.2 Kom1'e Bybit desteği eklenmesi (şu an sadece Binance Futures).
- 8.3 Sinyal aktiflik süresinin (Kom1: 24h "Old" eşiği) hedef/stop bazlı
  bir kurala geçirilmesi.

---

## Not — bu dosyaya dahil edilmeyenler

- Kom1 ATR14 (%12-40) bandı filtresi: 2026-08-17'de deploy edildi,
  `kom1-daily-signal-check` görevine izleme eklendi — aktif bir iş değil,
  sadece gözlem sürüyor (bkz. `dokumentasyon/gorevler/gorevler3.md`).
- Kom2'nin backtest/train-test/production kodu: tamamlandı, sadece Görev-2
  (blok sonrası) kalanı var.

---

## Görev-9 — 2026-08-20: MongoDB Atlas free tier (512MB) doluluk krizi — ÇÖZÜLDÜ

**Durum: Acil kısmı kapandı, kalıcı bir aksiyon gerekmiyor (izleme
dışında).** Atlas "Data Size 444MB/512MB (%87)" uyarısı verdi. İncelendi:
- `candles` koleksiyonu (server.js `candleSchema`) TAMAMEN ölü/kullanılmayan
  veriydi — onu YAZAN toplayıcı (`collectBinanceCandles`) zaten 2026-08-14'te
  kaldırılmıştı ama koleksiyonun kendisi ve TTL'siz olan şeması hiç
  silinmemişti. Kullanıcı Atlas UI'dan `candles` koleksiyonunu sildi.
- `frsignals` ve `marketdatas` koleksiyonları BÜYÜK (169MB+137MB) ama
  ÖLÜ DEĞİL — TTL'leri (48s/7g) gerçek endpoint'lerin (`/api/history/
  market`, `/api/signals/fr`) maksimum sorgu penceresiyle (48s/7g)
  BİREBİR eşleşiyor, yani bunlar TV'deki geçmiş grafik/sinyal listesi
  özelliklerinin gerçek verisi — kısaltmak özellik kaybı demek, kullanıcı
  bunu istemedi (`frsignals`'ı manuel sildi, TTL koda dokunulmadı).
- Sonuç: `test` veritabanı 329MB → 191MB'a düştü, kriz geçti. **Yeniden
  büyüyecek** (marketdatas/frsignals sürekli yazılıyor) — birkaç haftada
  bir Atlas Data Explorer'dan tekrar kontrol edilmeli, kalıcı bir kod
  çözümü (TTL kısaltma vb.) kullanıcı onayı olmadan YAPILMAMALI (özellik
  kaybı riski).
- **ÖNEMLİ kullanıcı kuralı, hafızaya kaydedildi:** proje satılmıyor,
  kişisel geliştirme aşamasında — ücretli bir servise/yükseltmeye (Atlas
  paid tier vb.) kullanıcı SORMADIKÇA ASLA önerilmeyecek.

---

## Görev-12 — 2026-08-26: Çizim araçları — boş/placeholder olanların doldurulması

**Durum: ⏳ Kısmen ilerledi — production'da henüz doğrulanmadı.**
Kullanıcı isteği: sidebar'daki çizim araçları arasında altı boş (render
fonksiyonu boş VEYA tıklayınca hiçbir nokta toplanmadığı için hiçbir şey
çizmeyen) araçları doldurmaya devam et.

**Düzeltme (aynı gün, ikinci tur):** Kullanıcı "Gann & Fibonacci" menüsünün
ekran görüntüsünü paylaştı — Fib Arcs/Fib Wedge/Pitchfan **menüde zaten
hiç yok** (kullanıcının önceki bir çizim araçları temizliğinde bilerek
kaldırılmışlar, `js/ui/sidebar.js`'deki menü listesinde sadece 5 Fib aracı
var: ret/ext/channel/timezone/speedfan). Yani bu üçü "boş placeholder"
değil, **artık kullanıcıya hiç gösterilmeyen ölü kod** — bu turda önce
Fib Arcs'ı doldurup sonra bunu fark edip GERİ ALDIM (render fonksiyonu +
`drawing-core.js`'teki `TWO_PT_TOOLS`/hit-test/dispatch eklentileri
tamamen silindi, `js`'de bu üç isme (`fib-arcs`/`fib-wedge`/`pitchfan`)
sıfır referans kaldığı doğrulandı). Elliott Wave'lerin 5'i ve Cyclic
Lines/Brush/Highlighter menüde HÂLÂ VAR (sidebar.js'de doğrulandı) —
bunlar gerçekten "boş görünüp menüde duran" araçlar, aşağıdaki analiz
onlar için geçerli.

**Tam envanter (bu turda çıkarıldı, menüde GERÇEKTEN var olanlar):**

| Araç | Kategori | Durum önce | Bu turda |
|---|---|---|---|
| Cyclic Lines | Patterns | Render boş, nokta toplama VARDI (`TWO_PT_TOOLS`) | ✅ Dolduruldu |
| Elliott Impulse/Correction/Triangle/Double/Triple (5 araç) | Patterns | Render boş, nokta toplama YOKTU | ❌ Yapılmadı |
| Brush | Geometric Shapes | Render boş, nokta toplama YOKTU | ❌ Yapılmadı |
| Highlighter | Geometric Shapes | Render boş, nokta toplama YOKTU | ❌ Yapılmadı |

**Menüde OLMAYAN, bu yüzden dokunulmaması gereken (ölü kod, temizlendi):**
Fib Arcs, Fib Wedge, Pitchfan — `drawing-fibo.js`'den render fonksiyonları,
`drawing-core.js`'den TÜM referansları (dispatch + `TWO_PT_TOOLS` +
hit-test) silindi.

**Yapılanlar:**
- `js/drawing/tools/drawing-patterns.js` `_drawCyclicLines` — p1→p2 arası
  x-eksenindeki aralık, görünür alanın tamamına (sağa VE sola) tekrarlanan
  dikey çizgiler olarak çiziliyor (TradingView'ın Cyclic Lines'ıyla aynı
  davranış). Nokta toplama zaten vardı (`drawing-core.js` `TWO_PT_TOOLS`
  içinde `cyclic-lines` mevcuttu), sadece render eksikti.
- **Bilinçli sınırlama:** çizginin gövdesine tıklayarak seçme henüz yok —
  sadece p1/p2 tutamaçları (handle) tıklanıp sürüklenebiliyor. `fib-ret`
  gibi araçlarda olduğu gibi tam bir hit-test eklemek ayrı, daha büyük bir
  iş; bu turda kapsam dışı bırakıldı, mevcut çizimin silinmesi/taşınması
  hâlâ mümkün (handle'lardan).

**Neden geri kalanlar YAPILMADI (kasıtlı, kör ilerlemek riskli):**
- **Elliott Wave araçları (5 tanesi):** TradingView'de her biri 3-13 nokta
  arası, dalga numaralandırma/etiketleme kuralları (1-2-3-4-5, A-B-C vb.)
  olan, bu projenin şimdiye kadar yaptığı hiçbir araçtan çok daha karmaşık
  bir kategori — RSI'nin bile 5 tur sürdüğü düşünülürse, bu 5 aracın
  hepsi muhtemelen kendi başına ayrı, fazlı bir oturum gerektirir. Kör
  ilerlemek yerine kullanıcıyla önce kapsam (kaç tanesi gerçekten
  isteniyor, hangi TV davranışı referans alınacak) netleştirilmeli.
- **Brush, Highlighter:** Bu ikisi TEK bir sürükleme hareketiyle (mousedown
  → mousemove'da SÜREKLİ nokta ekleme → mouseup'ta bitirme) çizilen gerçek
  serbest-el araçları — mevcut `pathtool`'un "tıkla-tıkla-tıkla" çoklu-nokta
  mekanizmasından (`MULTI_PT_TOOLS`) TAMAMEN FARKLI, YENİ bir girdi modu
  gerektiriyor. Bu, TÜM çizim araçlarının paylaştığı ortak mouse event
  state machine'ine (`drawing-core.js`) dokunmak demek — buradaki bir hata
  HER ARACI (trendline, fib, rect, hepsi) bozabilir. Görsel test
  yapılamayan bu ortamda bu riski almadım.

**Sonraki oturumda ilk iş:** production'da Cyclic Lines'ı gerçek fare ile
çizip görsel olarak makul göründüğünü doğrulamak. Sonra kullanıcıyla
Elliott Wave'lerin gerçekten isteniyor mu / hangi kapsamda isteniyor
konuşulmalı — büyük bir iş, RSI gibi kendi fazlı planını hak ediyor.

---

## Görev-13 — 2026-08-27: Chart Settings'te iki gerçek bug (kullanıcı bulgusu)

**Durum: ✅ Kod tamamlandı — production'da henüz doğrulanmadı.**

**13.1 — Scales sekmesindeki renk seçiciler (High/Low, Bid/Ask, Previous
day close) hiç uygulanmıyordu.** `chart-settings.js`'te renk swatch'ları
(`hlColor`/`bidColor`/`askColor`/`prevDayColor`) vardı ama `chart-pane.js`
`_updateVisualLines()` bunları HİÇ okumuyordu — High/Low çizgisi her zaman
hardcoded kırmızı(high)/mavi(low), Bid her zaman mavi, Ask her zaman
kırmızı, Prev Close her zaman gri çiziliyordu. Kullanıcı OK'a bassa da
renk değişmiyordu, ayarlara geri dönünce de swatch hep varsayılana
dönüyordu (ÇİFT hata — hem uygulama hem pre-fill eksikti). Düzeltildi:
- `chart-pane.js`: `prevDayColor`/`hlColor`/`bidColor`/`askColor` artık
  constructor'da okunuyor, `applySettings()`'te güncelleniyor,
  `getState()`'te kalıcı hale geliyor, `_updateVisualLines()` hardcoded
  hex'ler yerine bunları kullanıyor. (Not: `hlColor` TEK bir swatch —
  hem High hem Low AYNI rengi kullanıyor, ayarlar penceresindeki tasarımla
  birebir eşleşiyor; eskiden High/Low farklı hardcoded renklerdeydi ki bu
  zaten UI'da hiç seçilebilir değildi.)
- `chart-settings.js`: pre-fill'de `setColor()` yerine `setLineTool()`
  kullanılmaya başlandı — bu dört swatch `buildLineToolBtn()` ile
  kuruluyor (`setColor`'ın hedeflediği dış sarmalayıcı değil, iç
  `.tv-linetool-color-preview` div'i asıl görünen rengi taşıyor,
  `setColor` onu hiç güncellemiyordu).

**13.2 — Settings > OK sonrası mumlar solda/phantom içinde kalıyordu.**
Kök neden: `chart-data.js` `_fetchAndEmit()` tek bir `DataFeed.load()`
çağrısı için `'feed:candles'`ı İKİ KEZ yayınlıyor (önce IndexedDB
önbelleğinden anında varsa, sonra taze ağ verisiyle tekrar) ama
`chart-pane.js`'teki phantom-kaçırma görünüm düzeltmesi (`_onFeedCandles`,
"son 150 gerçek bar + 12 rightOffset") `!this._initialDataLoaded` (bir
kerelik) şartına bağlıydı — SADECE ilk (genelde önbellek, farklı bar
sayılı) gelişte çalışıyordu, ikinci (asıl, taze, farklı bar sayılı) veri
gelince görünüm bir daha hiç düzeltilmiyordu. `setVolume()` gibi
zaten-yüklü bir sembolü yeniden isteyen HER ayar değişikliğinde (Settings
OK) bu iki-emisyon deseni tetikleniyordu. Düzeltildi: `_loadData()` artık
8 saniyelik bir `_pendingRangeFixUntil` penceresi açıyor,
`_onFeedCandles` bu pencere içindeki HER `'feed:candles'` gelişinde
(cache + taze, ikisi de) düzeltmeyi yeniden uyguluyor. Pencere dışında
gelen `'feed:candles'` (ör. sekme arka planda uzun süre kaldıysa eksik
mumları tamamlayan "gap fill", `chart-data.js:630`) görünümü SIFIRLAMIYOR
— kullanıcı o an geçmişte bir yere bakıyor olabilir, bilerek korundu.

**Sonraki oturumda ilk iş:** production'da (1) High/Low rengini gri/beyaz
yapıp OK'a basıp hem grafikte hem ayarlara geri dönünce doğru göründüğünü,
(2) herhangi bir Settings ayarını değiştirip OK'a basınca mumların
ekranın sağında kalıp phantom'a kaymadığını doğrulamak.

**13.3 — "Bid and ask" tamamen kaldırıldı (kullanıcı kararı, 2026-08-27):**
bu platformda kullanışsız bir özellik bulundu. Scales sekmesindeki satır
(checkbox + Value/Line multiselect + iki renk swatch'ı) ve gear-menüsündeki
"Bid and ask lines" toggle'ı `chart-settings.js`'den, `lineBidAsk`/
`baValue`/`baLine`/`bidColor`/`askColor` (constructor/applySettings/
getState) ve `_updateVisualLines()`'taki Ask/Bid çizgi çizim bloğu
`chart-pane.js`'den tamamen silindi. `js/` genelinde bu isimlere sıfır
referans kaldığı doğrulandı (order book'taki AYRI/ilgisiz `bidAskRatio`
alanına dokunulmadı — o L/S verisiyle ilgili, farklı bir özellik).

---

## Görev-14 — 2026-08-27: İndikatörlerin altını tek tek doldurma — DEMA (ilk tur)

**Durum: ⏳ Kod tamamlandı — production'da henüz doğrulanmadı.** Kullanıcı
isteği: EMA/DEMA/RSI'dan sonra kalan indikatörlerin (şimdilik EMA/DEMA)
gerçek TV-parite ayar penceresine kavuşması. Önceden EMA/DEMA sadece
"Length + Color" gösteren çok basit bir modaldi — `cfg`'de source/offset/
width/lineStyle/precision/visibility hiç yoktu, seri kurulumunda
(`_rebuildIndicatorOverlays`) da hardcoded değerler (`lineWidth:2`,
`precision:8`, `lastValueVisible:false`) kullanılıyordu, hiçbiri ayardan
okunmuyordu.

**Kullanıcı TV'nin gerçek Pine kodunu (`//@version=6 indicator("Double
EMA"...)`, `dema = 2*ta.ema(src,length) - ta.ema(ta.ema(src,length),length)`)
VE ayar penceresi ekran görüntülerini (Inputs/Style/Visibility sekmeleri)
paylaştı** — tahminle değil, bu referanslarla dolduruldu.

**Yapılanlar (RSI'nin kurduğu AYNI mimari tekrar kullanıldı, sıfırdan
icat edilmedi):**
- `ChartPane.MA_DEFAULTS_APPLY(cfg)` (yeni static method, `RSI_DEFAULTS_APPLY`
  ile AYNI desen) — `source`/`offset`/`width`/`lineStyle`/`showLine`/
  `precision`/`showPriceLabels`/`showValuesInStatusLine`/
  `showInputsInStatusLine`/`calcTimeframe`/`waitForTfClose` alanlarını
  eksikse doldurur. Her `_rebuildIndicatorOverlays` turunda çağrılır (RSI'daki
  AYNI "eski kayıtlı state'te yeni alan yok" güvenlik ağı).
- `ChartPane.RSI_SOURCE_SERIES` artık EMA/DEMA ile de PAYLAŞILIYOR (adı
  RSI_ ile başlıyor ama kopya yazılmadı) + yeni `hlcc4` ((H+L+C+C)/4,
  TV'nin DEMA ekran görüntüsünde RSI'da olmayan bir seçenek) case'i eklendi.
- `_recomputeAllIndicators`: artık `cfg.source` her tür için (sadece RSI
  değil) uygulanıyor; TV'nin "Offset" alanı (çizilen değeri N bar sağa/sola
  kaydırır) `points` dizisi kurulurken uygulanıyor (ekranın açık ucuna
  taşan offsetler BİLEREK atlanıyor — TV'nin gelecek bar projeksiyonu
  desteklenmiyor, kapsam dışı bırakıldı).
- `_rebuildIndicatorOverlays`: hem update hem creation yolunda artık
  `cfg.width`/`lineStyle`/`showLine`(saydamlaştırma)/`precision`
  uygulanıyor. Yeni `ChartPane.MA_PRECISION_DECIMALS(cfg, priceHint)` —
  `RSI_PRECISION_DECIMALS`'tan FARKLI: RSI'da 'Default' sabit 2 ondalığa
  düşer (0-100 skalası), MA'da 'Default' sembolün kendi dinamik
  hassasiyetine (`_getDynamicDecimals`) düşüyor — aksi halde düşük fiyatlı
  coinlerde DEMA değeri 0.00'a yuvarlanırdı.
- `js/core/app.js` — yeni `_openMovingAverageSettings(pane, cfg, indicatorId)`,
  RSI'nın `_openRsiSettings`'iyle AYNI yardımcı fonksiyonları (`_rsiRow`/
  `_rsiCheck`/`_rsiSelect`/`_rsiLineCombo`/`_rsiToggleRow`) kullanıyor.
  **2 sekme** (Inputs, Style) — TV'nin 3. sekmesi (Visibility, çözünürlük
  bazlı göster/gizle: Ticks/Seconds/.../Months) bu projede hiçbir yerde
  karşılığı olmayan bir mekanizma, Status Line'da olduğu gibi BİLEREK sahte
  bir sekme eklenmedi.
  - Inputs: Length, Source (MA_SOURCE_OPTIONS = RSI_SOURCE_OPTIONS + hlcc4),
    Offset, Calculation > Timeframe/Wait for timeframe closes (RSI'daki
    AYNI bilinçli sınırlama — SADECE 'Chart' fonksiyonel, paylaşılan
    Binance bütçesi riski yüzünden diğer TF'ler yapılmadı).
  - Style: çizgi combo (renk/kalınlık/stil) + göster/gizle checkbox'ı,
    Precision, Labels on price scale, Values/Inputs in status line.
- Eski bare-bones "Length + Color" modal tamamen kaldırıldı.

**Ortak davranışlar (kullanıcı takibi, aynı gün) — RSI'yla BİREBİR eşitlendi:**
- **Sidebar (Indicators listesi) Edit/Delete + silme onayı:** zaten GENEL
  yazılmıştı (`js/screener/indicator-list-panel.js` `_attachDelegation` —
  `.il-edit`/`.il-delete` tüm türler için AYNI, `ConfirmModal` ile onay
  isteniyor), RSI'ya özel bir kısıtlama yoktu — EMA/DEMA zaten baştan bu
  davranışa sahipti, ek iş gerekmedi.
- **Çizgiye çift tıklayınca ayar penceresi açma:** buldum ki bu **SADECE
  RSI'nin subpane'i için** vardı (`chart-pane.js`'teki `dblclick` handler'ı,
  `y > panes[0].getHeight()` şartıyla sadece alt-panelleri kontrol
  ediyordu) — ana paneldeki EMA/DEMA çizgilerine çift tıklamanın HİÇBİR
  etkisi yoktu, sadece sidebar'daki kalem ikonundan açılabiliyordu. RSI'nın
  AYNI deseni (en yakın zamandaki değeri bul → koordinata çevir → 6px
  toleransla karşılaştır) ana panel için de eklendi — bir çizgiye isabet
  edince grafiğin normal çift-tık davranışına (fitContent sıfırlama) hiç
  düşmeden erken çıkılıyor (RSI'daki AYNI early-return). "Fiyat/zaman
  cetveli altındaki alanlar tıklanamasın" için AYRI bir kod gerekmedi —
  tolerans+çizgi-yakınlığı kontrolü zaten sadece çizginin GERÇEKTEN
  geçtiği pikselleri kabul ediyor, eksen bölgelerinde hiçbir çizgi verisi
  olmadığı için doğal olarak tetiklenmiyor (RSI'da da aynı, ayrı bir eksen-
  hariç-tutma kodu hiç yoktu).

**Sonraki oturumda ilk iş:** production'da bir DEMA ekle, ayarlarını aç,
Source'u değiştirip (ör. Open) çizginin gerçekten değiştiğini, Offset
verip çizginin kaydığını, renk/kalınlık/stil combo'sunun çalıştığını,
Precision'ı değiştirip ondalık sayısının değiştiğini, VE DEMA çizgisine
ana panelde çift tıklayınca ayar penceresinin açıldığını (ama grafiğin
başka bir yerine çift tıklayınca normal fitContent-sıfırlama davranışının
bozulmadığını) doğrulamak (yerel sandbox'ta test edilemedi). Sonra
kullanıcıyla birlikte **EMA**'ya geçilecek
— bu turda `MA_DEFAULTS_APPLY`/`_openMovingAverageSettings` zaten EMA/DEMA
ikisini de kapsayacak şekilde genel yazıldığı için EMA'nın kendi payı
muhtemelen çok küçük kalacak (aynı Length/Period varsayılanı DEFAULT_PERIOD.ema=20
zaten doğru, TV'nin EMA'sı da aynı formülü/ayar setini kullanıyor).

**14.1 — Phantom/mumlar-sola-kayması bug'ı DEMA ayarlarında da bulundu
(kullanıcı bulgusu, aynı gün):** Görev-13.2'de düzeltilen "Settings > OK
sonrası mumlar sola kayıp phantom görünür oluyor" hatası, indikatör ayar
penceresinde (RSI/EMA/DEMA, `updateIndicatorSettings`) VE genel Chart
Settings'te (`applySettings`) TEKRAR ortaya çıktı. Kök neden: Görev-13.2'nin
düzeltmesi SADECE `_loadData()`→`_onFeedCandles` akışına (8sn'lik pencere)
bağlıydı — ama `updateIndicatorSettings`/`applySettings` çoğu durumda veri
YENİDEN ÇEKMEDEN (`_loadData()`'ya hiç uğramadan) çalışıyor, bu yüzden o
pencere hiç açılmıyordu. Düzeltme: görünüm-düzeltme mantığı `_onFeedCandles`
içinden **`_restoreCandleView()`** adlı ayrı bir metoda çıkarıldı ("son 150
gerçek bar + sağ marj"), hem `_onFeedCandles` (eskisi gibi) hem
`updateIndicatorSettings` hem `applySettings`'in SONUNDA doğrudan çağrılıyor
— artık HANGİ akıştan gelirse gelsin (veri yeniden çekilsin ya da
çekilmesin) Settings/OK sonrası görünüm düzeltiliyor. Yan bulgu: eski kod
sağ marjı hep hardcoded `+12` kullanıyordu, Görev-6.5'te eklenen
`this.marginRight` ayarını hiç okumuyordu — artık onu okuyor (ayarlamayan
kullanıcılar için varsayılan yine 12, davranış değişmiyor).

**Sonraki oturumda ilk iş (ek):** production'da DEMA ekle/düzenle, OK'a
bas — mumların sağ kenarda kaldığını, phantom'ın görünmediğini doğrula.
Aynısını genel Chart Settings'te de (herhangi bir ayarı değiştirip OK)
tekrarla.
