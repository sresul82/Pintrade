# Pintrade — Proje Yapısı (Dosya/Klasör Hiyerarşisi)

Bu doküman, **yeni bir sohbete hızlı bağlam vermek** için hazırlandı.
Amaç: "Pintrade neye benziyor, hangi kod nerede duruyor?" sorusuna
kod okumadan cevap verebilmek.

- **Tarih:** 2026-07-31
- **Kök dizin:** `F:\_Egitim ve Gelistirme\_Pintrade`
- **Canlı adres:** pintrade.mooo.com (GitHub Pages'te barınıyor) · **Backend (prod):** `pintrade-uwg9.onrender.com` (2026-08-08'de eski/terk edilmiş `pintrade-0sb6.onrender.com`'dan geçildi)
- **Mimari özeti:** Build aracı YOK. Vanilla JS (ES5/ES6, modül sistemi yok —
  her dosya global bir isim tanımlar), `index.html` içinde sırayla `<script>`
  etiketleriyle yükleniyor. Backend tek dosya (`server.js`, Express + MongoDB).
- **Dışarıda tutulanlar:** `node_modules/`, `.git/`

---

## 1. Ağaç

```
_Pintrade/
│
├── index.html ................... Tek sayfalık uygulama (~62 KB): navbar, watchlist,
│                                  coin detay paneli, haber paneli + tüm <script> sırası
├── server.js .................... Backend: Express API, MongoDB şemaları, Binance proxy,
│                                  arka plan veri toplayıcı (FR/OI/mum)
├── package.json ................. Bağımlılıklar (express, cors, dotenv, mongoose) + npm start
├── package-lock.json ............ Kilitlenmiş bağımlılık sürümleri
├── .gitignore ................... node_modules, .env, .DS_Store
├── baslat.bat ................... Windows'ta lokal sunucuyu tek tıkla başlatan kısayol
├── out.txt ...................... ⚠️ Geçici debug dökümü (bot-signals-panel.js çıktısı) — silinebilir
│
├── .claude/
│   └── launch.json .............. Claude Code dev-server tanımı (node server.js, port 5500)
│
├── css/  ........................ Tüm stiller (7 dosya, build/derleme yok)
│   ├── variables.css ............ Renk/font CSS değişkenleri (TradingView koyu tema paleti)
│   ├── base.css ................. Reset, gövde stili, scrollbar, yardımcı sınıflar
│   ├── navbar.css ............... Üst bar: sembol arama, TF, layout, indikatör menüleri
│   ├── sidebar.css .............. Sol çizim araçları çubuğu ve flyout menüleri
│   ├── chart.css ................ Grafik alanı, çoklu pane ızgarası, grafik ayar modalı
│   ├── watchlist.css ............ Sağ panel: screener listesi, coin detay, bot sinyalleri
│   ├── components.css ........... Ortak parçalar: buton, dropdown, toast, tooltip
│   └── drawing-toolbar.css ...... Çizim seçiliyken çıkan üst özellik çubuğu
│
├── js/  ......................... Tüm ön yüz mantığı (~1 MB kaynak kod)
│   ├── lightweight-charts.min.js  TradingView'ın açık kaynak grafik motoru (dış kütüphane)
│   │
│   ├── core/  ................... Uygulama iskeleti ve durum yönetimi
│   │   ├── app.js ............... Uygulama başlatıcı: navbar, tema, saat, coin detay üst kısmı
│   │   ├── app-config.js ........ Merkezi sabitler: API adresleri, TF listesi, tema renkleri
│   │   ├── state.js ............. Kalıcı uygulama durumu (aktif sembol/TF/borsa) + localStorage
│   │   ├── session.js ........... Layout ve pane durumunu kaydet/geri yükle (F5 dayanıklılığı)
│   │   ├── storage.js ........... Birleşik depolama: localStorage + IndexedDB (OHLCV önbelleği)
│   │   ├── event-bus.js ......... Modüller arası yayın/dinleme (ör. 'symbol:change')
│   │   └── chart-config.js ...... Grafik varsayılanları, TF listesi, layout şemaları (1, 2x2 vb.)
│   │
│   ├── data/  ................... Veri çekme ve önbellekleme katmanı
│   │   ├── market-data-store.js . Merkezi WebSocket havuzu — fiyat/hacim/FR/OI tek bağlantıdan
│   │   ├── binance-api.js ....... Binance Futures REST + WebSocket sarmalayıcı
│   │   ├── bybit-api.js ......... Bybit V5 REST + WebSocket sarmalayıcı
│   │   ├── binance-api-fr.js .... Binance funding rate akışını FR izleyiciye besler
│   │   ├── bybit-api-fr.js ...... Bybit funding rate akışını FR izleyiciye besler
│   │   ├── chart-data.js ........ Mum verisi yöneticisi: kline çekme, sayfalama, IndexedDB cache
│   │   └── news-api.js .......... CryptoCompare haberleri + Türkçe çeviri
│   │
│   ├── chart/  .................. Grafik motoru sarmalayıcısı
│   │   ├── chart-core.js ........ Grafik sistemini kurar, pane ve senkron yöneticilerini bağlar
│   │   ├── chart-pane.js ........ Tek bir grafik paneli: seri, ölçek, canlı tick, ayarlar
│   │   ├── chart-layout.js ...... Çoklu panel düzeni (1 / 1+1 / 2x2) ve panolar arası senkron
│   │   ├── chart-phantom.js ..... Zaman eksenini son mumun 500 bar sağına uzatan görünmez seri
│   │   └── ui/
│   │       └── chart-settings.js  Grafik ayar modalı + senkronizasyon paneli arayüzü
│   │
│   ├── drawing/  ................ Çizim araçları sistemi (projenin en büyük parçası)
│   │   ├── core/
│   │   │   └── drawing-core.js .. Çizim yöneticisi: canvas overlay, seçim, mıknatıs, kaydetme
│   │   ├── tools/  .............. Her araç ailesinin çizim mantığı
│   │   │   ├── drawing-trend.js .... Çizgiler, kanallar, pitchfork'lar
│   │   │   ├── drawing-fibo.js ..... Fibonacci ve Gann araçları
│   │   │   ├── drawing-shapes.js ... Geometrik şekiller ve oklar
│   │   │   ├── drawing-annotations.js  Metin, not, balon, fiyat etiketi
│   │   │   ├── drawing-forecast.js .. Long/Short pozisyon, fiyat/tarih aralığı, cetvel
│   │   │   ├── drawing-patterns.js .. Harmonik/Elliott/döngü araçları — ⚠️ çoğu boş iskelet
│   │   │   └── drawing-advanced.js .. VWAP/hacim profili iskeleti — ⚠️ hiç yüklenmiyor (ölü dosya)
│   │   └── ui/  ................. Çizim ayar arayüzleri
│   │       ├── property-toolbar.js .... Çizim seçilince çıkan TradingView tarzı üst çubuk
│   │       ├── drawing-settings-dialog.js  Tam ayar penceresi (Stil/Metin/Koordinat/Görünürlük)
│   │       ├── dsd-color-picker.js .... Renk paleti ve çizgi stili seçici
│   │       ├── settings-modal.js ...... ⚠️ Eski ayar modalı — hiç yüklenmiyor (ölü dosya)
│   │       └── dsd-tabs/  ......... Ayar penceresinin sekme içerikleri
│   │           ├── dsd-standard-tabs.js .. Ortak sekmeler (Stil, Metin, Koordinat, Görünürlük)
│   │           ├── dsd-fibo-tabs.js ...... Fibonacci araçlarına özel sekmeler
│   │           ├── dsd-position-tabs.js .. Long/Short pozisyon aracına özel sekmeler
│   │           ├── dsd-annotation-tabs.js  Not/metin araçlarına özel sekmeler
│   │           ├── dsd-apply.js .......... Formdaki değerleri çizime uygulama
│   │           └── dsd-utils.js .......... Ortak küçük yardımcılar (tarih/sayı biçimleme)
│   │
│   ├── screener/  ............... Tarama, sinyal ve coin detay paneli
│   │   ├── screener-core.js ..... Ana coin listesi (Sembol|Fiyat|Chg%|FR%|Vol|OI), sıralama/filtre
│   │   ├── search-core.js ....... Akıllı sembol arama kutusu ve dropdown
│   │   ├── exchange-router.js ... Borsa seçimi karar merkezi (Binance/Bybit)
│   │   ├── fr-tracker.js ........ Funding rate geçmişi + değişim/sinyal tespiti
│   │   ├── fr-data-bridge.js .... İki borsanın FR akışını doğru izleyiciye yönlendirir
│   │   ├── funding-interval.js .. Coin başına funding periyodunu (4h/8h) çeker ve önbellekler
│   │   ├── oi-api.js ............ Binance açık pozisyon (OI) verisi çekici
│   │   ├── m1hammer-scanner.js .. Bot tarayıcı: RSI/StochRSI/WaveTrend ile 5m sinyal üretir
│   │   ├── bot-signals-panel.js . Bot sinyalleri sekmesi: liste, filtre, mini grafik
│   │   ├── floating-panel.js .... Bot sinyallerini sürüklenebilir ayrı pencerede gösterir
│   │   └── detail-panel.js ...... Seçili coin detay paneli: fiyat, FR, OI, L/S, hacim, haber
│   │
│   └── ui/  ..................... Genel arayüz parçaları
│       ├── sidebar.js ........... Sol çizim araçları çubuğu (en büyük tek dosya, ~114 KB)
│       ├── chart-popovers.js .... Çizgi kalınlığı/stili gibi küçük açılır seçiciler
│       └── icons.js ............. SVG ikon kütüphanesi (string olarak)
│
├── dokumentasyon/  .............. Proje notları (kod değil)
│   ├── PROJE-DOKUMANTASYONU.md .. Genel amaç, piyasa okuma çerçevesi, veri kaynakları
│   ├── BACKTEST-SISTEMI.md ...... Backtest/indikatör alt projesi ve 5 katmanlı mimari planı
│   ├── pintrade-yapisi.md ....... Bu dosya
│   └── raporlar/  ............... Yapılan her işin tarihli raporu
│       ├── README.md ............ Rapor indeksi (en yeni en üstte)
│       └── YYYY-AA-GG-*.md ...... Tek tek iş raporları
│
└── tmp/  ........................ ⚠️ Tek seferlik onarım betikleri — projeye dahil değil
    ├── fix_renderer.js
    ├── fix_trend.py
    ├── fix_trend_v2.py
    ├── fix_toolbar_refs.py
    └── repair_dsd.py
```

---

## 2. Nasıl çalışıyor? (30 saniyelik özet)

**Ön yüz (tarayıcı):**
`index.html` → CSS'ler → `lightweight-charts.min.js` → sonra ~45 JS dosyası
belirli bir sırayla yükleniyor. Sıra önemli, çünkü modül sistemi yok:
her dosya `window` üzerinde global bir isim tanımlıyor
(`AppConfig`, `State`, `EventBus`, `ScreenerCore`, `DetailPanel` …).
En sonda `App.init()` çalışıyor, o da grafiği (`initChartCore`) ayağa kaldırıyor.

**Veri akışı:**
- Canlı fiyat/hacim/FR → `market-data-store.js` üzerinden **tek bir Binance
  WebSocket** bağlantısı; diğer modüller buradan okuyor (REST spam'i önlemek için).
- Geçmiş mum verisi → `chart-data.js`, IndexedDB'de önbelleklenerek.
- CORS gerektiren REST istekleri → kendi sunucumuzdaki `/api/binance/...` proxy'si.

**Arka uç (`server.js`):**
1. Statik dosya sunucusu (site kendisi buradan yayınlanıyor).
2. Binance REST proxy'si (CORS çözümü).
3. MongoDB: çizimler (kalıcı), piyasa verisi (48 saat TTL), FR sinyalleri
   (7 gün TTL), 5m mumlar (TTL yok).
4. Arka plan toplayıcı: her 1 dk FR+OI+hacim, her 5 dk 5m mumlar.

**Veritabanı olmadan:** `.env` / `MONGODB_URI` yoksa sunucu "lokal mod"da
çalışır — grafik ve screener çalışır, ama **çizim senkronu ve geçmiş
FR/OI/mum API'leri boş döner**. Şu an bu klasörde `.env` yok.

---

## 3. Strateji çalışması için önemli notlar

Claude.ai sohbetindeki strateji (OI kalıcılığı, hacim/L-S sinyalleri,
scalp vs swing kriterleri) Pintrade'e taşınacağı zaman bakılacak yerler:

| İhtiyaç | Şu an nerede / var mı |
|---|---|
| Fiyat + hacim (kline) | ✅ `js/data/chart-data.js` + `server.js` mum toplayıcı |
| Funding Rate geçmişi | ✅ `js/screener/fr-tracker.js` + `/api/history/fr` |
| Açık Pozisyon (OI) — anlık | ✅ `js/screener/oi-api.js`, `detail-panel.js` |
| OI geçmişi (5m/48h) | ⚠️ Sunucu tarafı bozuk (bkz. hata raporu), ön yüz Binance'ten canlı çekiyor |
| Long/Short oranı — global, anlık | ✅ `detail-panel.js` (`globalLongShortAccountRatio`, `limit=1`) |
| Long/Short oranı — **Top Trader** | ❌ Yok — stratejinin en değerli sinyali "global vs top trader ayrışması", bu yarısı eksik |
| Long/Short **geçmişi** (zaman serisi) | ❌ Yok — sadece o anki tek değer çekiliyor |
| Grafik üstünde indikatör (RSI, DEMA, HA, WaveTrend) | ❌ Grafik katmanında indikatör motoru yok |
| İndikatör matematiği | ⚠️ Var ama `m1hammer-scanner.js` içine gömülü, paylaşılmıyor |
| Backtest / geçmişe dönük test | ❌ Hiç yok |
| Uyarı (alert) sistemi | ⚠️ Navbar'da buton var, arkasında mantık yok |
