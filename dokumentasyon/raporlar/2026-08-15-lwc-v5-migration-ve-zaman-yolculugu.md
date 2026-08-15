# lightweight-charts v5 Migration + Alarm Zaman Yolculuğu + Kom1 Telegram Bildirimi — 2026-08-15

## Bağlam

Kom1 sinyal motoru gerçek veri üretmeye başladı (bu oturumda 160 kayıt bulundu,
2026-08-11'den beri). Kullanıcının asıl hedefi chart üzerinde RSI/WaveTrend/
Regression Channel gibi indikatörleri TradingView'daki gibi (RSI/WT ayrı alt
panelde, kendi fiyat ekseniyle) göstermek — bu, `lightweight-charts v4.1.3`'ün
native pane (alt-panel) desteği olmadığı için 2026-08-12'de üç kez denenip
başarısız olmuş ve tamamen kaldırılmıştı (bkz. `2026-08-11-gorev14-chart-indikatorleri-ema-dema-rsi.md`,
"Düzeltme 4"). O rapor v5 migrasyonunu bilinçli olarak ertelemişti — bugün o
gün geldi.

Sıra: (1) v5 migration → (2) alarm kartı zaman yolculuğu → (3) indikatör planı
(kod değil, sadece plan) → ayrıca kullanıcının paralel isteğiyle (4) Kom1 → Telegram.

## 1. lightweight-charts v4.1.3 → v5.2.1 migration

**Neden:** v5'in native `chart.panes()`/`paneIndex` API'si, RSI/WT için gerekli
gerçek alt-panel desteğini sağlıyor — v4'te bu, iki senkronlu `createChart()`
veya gizli/görünür ikinci fiyat ekseni gibi workaround'larla taklit edilmeye
çalışılmış, üçü de gerçek kullanımda bozulmuştu.

**Yapılan:**
- `js/lightweight-charts.min.js` → v5.2.1 standalone build ile değiştirildi
  (`unpkg.com/lightweight-charts@5.2.1`, sürüm pinlendi).
- 9 seri oluşturma çağrısı (`chart.addAreaSeries(opts)` tarzı v4 API'si) →
  `chart.addSeries(LightweightCharts.XSeries, opts)` v5 API'sine dönüştürüldü:
  `js/chart/chart-pane.js` (6 site — hacim histogramı, line/area/bar/candle
  fiyat serisi, indikatör legend çizgisi), `js/screener/oi-volume-panel.js`
  (2 site — OI/Volume mini chart'lar), `js/chart/chart-phantom.js` (1 site).
- Enum'lar (`PriceScaleMode`, `CrosshairMode`, `LineStyle`), `timeScale()`/
  `priceScale()` metodları, `subscribeCrosshairMove`, `createPriceLine` — hepsi
  v5'te imza-uyumlu, kod değişikliği gerekmedi.
- `setMarkers`/native `watermark`/`drawTicks` — proje kodunda hiç kullanılmıyor
  (grep ile doğrulandı), bu üç v5 breaking-change kategorisi etkilemedi.
- Çizim araçları (`js/drawing/**`) kütüphaneye doğrudan dokunmuyor, sadece
  `pane.chart`/`pane.series` üzerinden koordinat dönüşümü çağırıyor — bu
  metodların imzası v5'te değişmedi.

**Doğrulama (production, Bybit üzerinde):** candlestick/bar/line/area chart
tipleri, hacim histogramı, EMA indikatör çizgisi, OI/Volume popup'ın iki mini
grafiği, çizim/ölçüm aracı (koordinat dönüşümü) — hepsi test edildi, konsol
hatasız (yalnızca migration'la ilgisiz, önceden var olan bir Binance screener
hatası bulundu, ayrı görev olarak flag'lendi).

## 2. Alarm kartı → chart zaman yolculuğu (gorevler2.md Görev 5)

**Mevcut altyapı:** Kart tıklama zaten `EventBus.emit('symbol:change', {symbol,
exchange})` atıyordu (`alarm-signal-history.js`), `chart-core.js`'teki bridge
`ChartPane.setSymbol()`'ü çağırıyordu — ama sinyalin zamanı hiç taşınmıyordu.

**Yapılan:**
- Karta `data-timestamp` eklendi, emit'e `targetTimestamp` katıldı.
- `chart-core.js`'teki bridge: sembol zaten aktifse `goToTime()`'ı DOĞRUDAN
  çağırıyor (veri zaten yüklü); farklı bir sembolse (asenkron veri yüklemesi
  bitmeden kaydırma yapılamaz) `_pendingGoToTime` olarak ChartPane üzerinde
  bekletiyor, `_onFeedCandles`'da (yeni mumlar gelince) tetikleniyor.
- Yeni `ChartPane.goToTime(timestampMs)`: bar-index hesabı yapmadan, `syncRange()`'in
  de kullandığı zaman-tabanlı `timeScale().setVisibleRange({from, to})` deseniyle,
  TF'e göre ölçeklenen bir pencere (±75 bar) açıp sinyalin ateşlendiği ana
  ortalıyor.

**Doğrulama:** HOMEUSDT Combo 1 kartına tıklandı → chart doğru sembole geçti,
görünür aralık merkezi sinyalin gerçek zamanından sadece 34 dakika sapmalı (tek
bir 1H bar içinde). Aynı karta ikinci kez tıklanınca (senkron yol, zaten açık
sembol) da doğru kaldı. Konsol hatasız.

## 3. İndikatör planı (RSI/WaveTrend/Regression Channel) — SADECE PLAN, kod yazılmadı

Kullanıcı bunu "çok kapsamlı ve ciddi bir konu" olarak tanımladı, kalan süre
kısıtlıyken (ve geçmişte 3 kez başarısız olmuş bir özellik olduğu için) acele
etmemeye karar verildi — detaylı, fazlı bir plan yazılıp onaylandı, kod
sonraki oturuma bırakıldı.

**Plan dosyası:** `C:\Users\User\.claude\plans\robust-strolling-turtle.md`
(kullanıcı makinesinde, proje reposunun dışında).

**Plan özeti:**
- RSI, WaveTrend → alt-panel (subpane), v5'in native `paneIndex` API'siyle
- Regression Channel → ana panel overlay (EMA/DEMA gibi, kanalın kendisi fiyat
  etrafında olduğu için ayrı eksene gerek yok)
- Matematik motoru büyük ölçüde hazır (`indicator-engine.js` — RSI zaten
  `calcRSIFull` ile chart-hazır; WaveTrend ve Regression Channel için "Full"
  seri varyantları yazılması gerekiyor, mevcut bot mantığına dokunulmadan)
- 4 fazlı uygulama: Faz 1 (v5 subpane altyapısı + RSI, en riskli parça önce),
  Faz 2 (WaveTrend), Faz 3 (Regression Channel), Faz 4 (opsiyonel, ayar
  dialogu zenginleştirme)
- Varsayılan parametreler TV/topluluk standartları (kullanıcı onayladı): WT
  10/21 length, ±53 eşik; RC 100 bar, 2 std-dev

## 4. Kom1 sinyalleri → Telegram bildirimi (gorevler3.md Görev 7, kısmi)

Kullanıcının paralel isteği (bot oluşturma sırasında zaman kazanmak için) —
Görev 7'nin tam kapsamından (server-side price-alert monitoring + AlertStore
DB migration + Telegram) sadece Kom1 parçası alındı, çünkü Kom1'in sunucu
tarafı izlemesi (`kom1-server-watcher.js`) zaten 7/24 çalışıyordu, eksik olan
tek şey Telegram'a mesaj atmaktı.

**Yapılan:** `server.js`'e `sendTelegramMessage(text)` eklendi — `TELEGRAM_BOT_TOKEN`/
`TELEGRAM_CHAT_ID` env değişkenleri yoksa sessizce no-op (özellik "kapalı"
kalır, hata vermez). Hem `Kom1ServerWatcher.tick()`'in confirm callback'ine
hem `POST /api/kom1/signals`'a (11 coin'lik hızlı tarayıcı yolu) bağlandı,
ateşle-unut (Telegram hatası sinyal kaydını asla engellemez).

**Kullanıcı tarafı:** BotFather ile `@pinsignal_bot` oluşturuldu, chat ID
`getUpdates` ile bulundu, ikisi Render dashboard'una (Environment sekmesi)
eklendi.

**Doğrulama:** Production'da uçtan uca test edildi — ilk gerçek Kom1 sinyali
(1000PEPEUSDT, 4H) Telegram'a otomatik düştü.

**Kalan:** Fiyat alarmlarının (`AlertStore`, hâlâ localStorage) Telegram'a
bağlanması — kendi DB taşıması + sunucu izleme döngüsü gerektiren ayrı, büyük
bir iş, bu turda YAPILMADI.

## 5. Yan bulgular / küçük düzeltmeler (aynı oturumda)

- `pintrade.mooo.com`'un aslında GitHub Pages'te barındığı, `pintrade-uwg9.onrender.com`'un
  ise ayrı bir Render backend olduğu bulundu — 4 dosyadaki göreli `/api/...`
  fetch çağrısı (mooo.com'da backend'e değil GitHub Pages'in kendisine gidip
  404 dönüyordu) `AppConfig.BACKEND_URL` üzerinden mutlak adrese çevrildi.
  Bu, "Alarm sekmesinde Combo 1 hep boş" şikayetinin gerçek kök sebebiydi.
- Neon buton kuralı (`pintrade-neon-buton-arka-fon-yasak` memory) `alarm-signal-history.js`'nin
  segment butonlarında (Combo 1/2/3, Exchange filtreleri) da uygulanmamıştı —
  düzeltildi, ayrıca glow/font-size/opacity tutarlılığı tüm "aktif buton"
  implementasyonlarında (sidebar, OI/Volume TF butonları, Alarm segmentleri)
  standardize edildi.
- `.detail-panel { max-height: 80% }` CSS kuralı Watchlist dışındaki sekmelerde
  (Alarm/Alerts/News) de geçerli kalıyordu, panel gerçek yüksekliğin sadece
  %80'inde kesiliyordu — `app.js`'teki tab-switch mantığına düzeltme eklendi.

## Değişen dosyalar (özet)

- `js/lightweight-charts.min.js` — v5.2.1
- `js/chart/chart-pane.js` — seri oluşturma v5 API'si, `goToTime()`, subpane hazırlığı için mevcut yapı doğrulandı
- `js/chart/chart-phantom.js`, `js/screener/oi-volume-panel.js` — seri oluşturma v5 API'si
- `js/chart/chart-core.js` — `symbol:change` bridge, `targetTimestamp`
- `js/screener/alarm-signal-history.js` — `data-timestamp`, neon buton düzeltmesi, backend URL fix, fetch hardening
- `js/screener/kom1-scanner.js`, `js/screener/fr-tracker.js` — backend URL fix
- `js/core/app-config.js` — `BACKEND_URL` export edildi
- `js/core/app.js` — `.detail-panel` max-height fix
- `server.js` — `sendTelegramMessage()`, Kom1 signal-create call site'larına bağlandı
- `js/screener/mini-floating-window.js`, `js/screener/detail-panel.js` — (önceki turlardan, L/S/OI-Volume popup düzeltmeleri, bu raporun kapsamı dışında ama aynı oturumda)

## Doğrulama

Tüm değişiklikler production'da (`pintrade-uwg9.onrender.com` ve `pintrade.mooo.com`)
Bybit borsası üzerinden `mcp__Claude_Browser__*` ile canlı test edildi — ekran
görüntüleri, konsol log kontrolü, DOM/computed-style doğrulaması. Binance'e
dokunulmadı (paylaşılan IP ban riski). Her commit sonrası `graphify update .`
çalıştırıldı.
