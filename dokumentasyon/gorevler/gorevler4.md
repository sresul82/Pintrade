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

**Durum: Açık, aktif iş bekliyor.** Kom1 sinyallerinin Telegram bildirimi
tamamlandı (2026-08-15, production'da doğrulandı) — kalan tek parça
`AlertStore`'un (fiyat alarmları, şu an localStorage-tabanlı) MongoDB'ye
taşınması + kendi sunucu-taraflı izleme döngüsü.

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
  geliyor** — TV'nin ana chart üzerindeki sol-üst OHLC bindirmesi bu
  projede hiç inşa edilmemiş (mevcut `.pane-hdr`/`.ohlcv-row` kısmen
  benzer ama birebir değil). Bu "bağlamak" değil sıfırdan yeni bir UI
  özelliği inşa etmek demek — görsel doğrulama yapılamayan bu oturumda
  riskli, YAPILMADI. Ayrıca Scales/Canvas'taki bazı kontrollerin
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
  boşluğun değiştiğini, ve Scales > Time hours format'ı 12-hours yapıp
  crosshair/eksen saatlerinin "6:00pm" gibi göründüğünü doğrulamak (yerel
  sandbox'ta görsel test yapılamadı). Status Line'ın gerçek bir özellik
  olarak inşa edilip edilmeyeceği kullanıcıya sorulmalı — büyük, ayrı bir
  iş (RSI'nin aldığı gibi fazlı bir oturum gerekebilir).

---

## Görev-7 — Bot sağlık/izleme mekanizması

**Durum: Hiç başlanmadı.** Botların (Kom1/Kom2) gerçek zamanlı çalışır
durumda tutulması için izleme/health-check katmanı — şu an sadece konsol
logları var (ve Kom2 için 2026-08-18'de eklenen `lastError`/`scan`
teşhis alanları, bkz. Görev-2). Kom1'in kendi `kom1-daily-signal-check`
zamanlanmış görevi bu ihtiyacın bir kısmını zaten karşılıyor.

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
