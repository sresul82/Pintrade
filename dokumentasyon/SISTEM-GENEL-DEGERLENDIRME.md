# Pintrade — Genel Sistem Değerlendirmesi (Ara Kontrol) — 2026-08-01

> 2. aşamaya (işlev geliştirme) geçmeden önce yapılan genel durum tespiti.
> Kapsam: çalışma mantığı, veri kaynakları, veri tekrarı, IP ban riskleri,
> alarm/sinyal sistemi, coin işaretleri, FR eşikleri, performans.
> Çizim araçları bu rapora dahil değil (ayrı raporda incelendi).

---

## 1. Sistem çalışma mantığı — özet mimari

```
                    ┌─────────────────────────────────┐
                    │   BİNANCE WS (tek bağlantı)     │
                    │  !miniTicker@arr + !markPrice   │
                    └───────────────┬─────────────────┘
                                    │
                         MarketDataStore (merkezi havuz)
                         _tickers / _fr / _oi / _klines
                                    │
                    EventBus: mds:tick / mds:fr / mds:oi
                                    │
          ┌─────────────────────────┼──────────────────────┐
          ▼                         ▼                      ▼
   ScreenerCore              BinanceFRPoller          (diğer modüller)
   (coin listesi)                  │
          │                        ▼
          │                  FRDataBridge  ──► FRTracker (geçmiş)
          │                        │        └► ScalpFRMonitor (sinyal)
          ▼                        ▼
   Watchlist tablosu        BotSignalsPanel (FR sekmesi)
```

**Katmanlar:**
| Katman | Dosyalar | Görev |
|---|---|---|
| Veri toplama | `market-data-store.js`, `binance-api*.js`, `bybit-api*.js`, `chart-data.js` | Borsadan ham veri |
| Veri dağıtımı | `event-bus.js`, `fr-data-bridge.js`, `exchange-router.js` | Modüller arası dağıtım |
| Sinyal/analiz | `fr-tracker.js` (FRTracker + ScalpFRMonitor), `m1hammer-scanner.js` | Eşik aşımı tespiti |
| Arayüz | `screener-core.js`, `detail-panel.js`, `bot-signals-panel.js`, `chart-*.js` | Görselleştirme |
| Sunucu | `server.js` (Express + MongoDB) | Proxy, geçmiş kaydı, sync |

> **💡 Öneri — mimari:** Katman ayrımı doğru kurulmuş, ama "veri toplama"
> katmanı tek bir kapıdan geçmiyor: `MarketDataStore` merkezi havuz olarak
> tasarlanmış ama `detail-panel.js`, `chart-data.js` ve `screener-core.js`
> onu **atlayıp** doğrudan borsaya gidiyor. Kural şu olmalı: **"Hiçbir UI
> modülü doğrudan `fetch` yapmaz, sadece MarketDataStore'dan okur."**
> MarketDataStore'da olmayan bir veri gerekiyorsa, o veri MarketDataStore'a
> eklenmeli — UI'da ayrı fetch açılmamalı. Bu tek kural §3 ve §4'teki
> sorunların çoğunu kökten çözer.

---

## 2. Veri kaynakları haritası

### Binance
| Veri | Yöntem | Sıklık | Nerede |
|---|---|---|---|
| Fiyat / 24h değişim / hacim | **WebSocket** `!miniTicker@arr` | ~1 sn | `market-data-store.js` |
| Funding Rate / nextFundingTime | **WebSocket** `!markPrice@arr` | ~3 sn | `market-data-store.js` |
| Open Interest | REST `/fapi/v1/openInterest` (batch) | 60 sn | `market-data-store.js` |
| FR + ticker (tam liste) | REST `premiumIndex` + `ticker/24hr` | **60 sn** | `screener-core.js:320` |
| Funding aralığı (4h/8h) | REST `/fapi/v1/fundingInfo` | 5 dk | `funding-interval.js` |
| Coin detay (ticker/FR/OI/LS) | REST × 5 endpoint | **10 sn** | `detail-panel.js:756` |
| Navbar istatistikleri | REST × 3 endpoint | 30 sn | `app.js:664` |
| Grafik mumları (canlı) | **REST polling** | **2 sn** ⚠️ | `chart-data.js:374` |

### Bybit
| Veri | Yöntem | Sıklık | Nerede |
|---|---|---|---|
| Tüm ticker (fiyat+FR) | REST `/v5/market/tickers` | 5 sn | `screener-core.js:537` |
| Tam liste yenileme | REST | 60 sn | `screener-core.js:695` |
| Coin detay | REST × 5 endpoint | 10 sn | `detail-panel.js` |
| Grafik mumları | **WebSocket** | canlı | `chart-data.js:465` |

### Diğer
- **CryptoCompare** — haberler (News sekmesi, sadece sekmeye tıklayınca)
- **Google Translate** — haber çevirisi (resmi olmayan endpoint, kırılgan)
- **Kendi sunucumuz** (`server.js`) — FR geçmişi, sinyal kaydı, çizim sync,
  ve Binance için **proxy** (`/api/binance/futures/*`)

> **💡 Öneri — veri kaynakları:**
> 1. **Binance'te WS varken REST kullanılan her yer gözden geçirilmeli.**
>    Tabloda "REST" yazan ve WS karşılığı olan 3 satır var: grafik mumları
>    (2 sn), screener tam liste (60 sn), coin detay FR/fiyat (10 sn).
>    Üçü de WS'ten beslenebilir.
> 2. **Bybit'te tam tersi durum var:** grafikte WS kullanılıyor ama
>    screener/detay REST. Bybit de `!ticker` benzeri toplu WS stream'i
>    destekliyor — Binance'teki `MarketDataStore` deseni Bybit için de
>    kurulabilir (`BybitMarketDataStore` veya aynı modüle ikinci kanal).
> 3. **Google Translate** resmi olmayan bir endpoint (`translate_a/single`).
>    Her an kapanabilir. Ya kaldırılmalı ya da hata durumunda haberin
>    İngilizce hâlini gösterip sessizce devam etmeli (şu an ne olduğu
>    kontrol edilmeli).
> 4. **`server.js` proxy'si az kullanılıyor.** Sadece `chart-data.js` ve
>    `market-data-store.js` OI çekerken fallback olarak kullanıyor. Ban
>    riski yüksek isteklerin (özellikle bot tarayıcı) tamamı proxy üzerinden
>    geçirilirse kullanıcının kendi IP'si korunur.

---

## 3. ⚠️ Aynı verinin birden fazla yerden çekilmesi (SORULAN KONU)

**Cevap: Evet, FR verisi 3 ayrı yoldan geliyor ve bunlar birbirinden bağımsız.**

| # | Yol | Kaynak | Sıklık | Kullanan |
|---|---|---|---|---|
| 1 | WebSocket `!markPrice@arr` | Binance WS | 3 sn | Screener canlı güncelleme, FRDataBridge → sinyaller |
| 2 | REST `premiumIndex?limit=500` | Binance REST | 60 sn | Screener tam liste yenileme (`_loadBinance`) |
| 3 | REST `premiumIndex?symbol=X` | Binance REST | **10 sn** | Coin Detail paneli (tek coin) |

**Sonuç:** Screener'daki FR ile Coin Detail'deki FR **farklı kaynaklardan**
geliyor. İkisi de doğru veri veriyor ama:
- **Tutarsızlık riski:** WS 3 sn'de bir güncellenirken detay paneli 10 sn'de
  bir çekiyor → aynı anda ekranda iki farklı FR değeri görünebilir.
- **Gereksiz istek:** Detay panelindeki FR zaten `MarketDataStore.getFR(sym)`
  ile bedava alınabilirdi. Şu an ekstra REST isteği yapılıyor.

**Aynı durum OI ve fiyat için de geçerli:** MarketDataStore OI'yı 60 sn'de
batch çekiyor, detay paneli aynı coin için ayrıca 10 sn'de bir çekiyor.

> **💡 Öneri — veri tekrarı:**
> 1. **Detay panelini MarketDataStore'a bağla.** `detail-panel.js`'in Binance
>    kolunda FR / fiyat / 24h değişim / OI için yapılan REST çağrıları
>    `MarketDataStore.getFR(sym)` / `.getTicker(sym)` / `.getOI(sym)` ile
>    değiştirilmeli. Sadece MarketDataStore'da **olmayan** veriler
>    (Long/Short oranı, OI geçmişi/8 periyot, spot fiyat) REST'te kalmalı.
>    Detay panelindeki REST trafiğini ~%60 azaltır ve tutarsızlığı bitirir.
> 2. **Screener'ın 60 sn tam yenilemesi muhtemelen gereksiz.** WS zaten
>    fiyat + FR + hacim veriyor. Bu yenilemenin tek gerçek işlevi *yeni
>    listelenen coin'i yakalamak* — o da 60 sn yerine **5-10 dakikada bir**
>    yapılabilir. Ölçüp karar vermek gerekir: kapatınca listede eksik
>    kalan bir alan var mı?
> 3. **Tek doğruluk kaynağı ilkesi:** Aynı veri iki yerde gösteriliyorsa
>    (Screener FR ↔ Detay FR) ikisi de aynı `MarketDataStore` map'inden
>    okumalı. Böylece ekranda asla iki farklı değer görünmez.
> 4. **Sonraki adımda dikkat:** Bybit kolu ayrı bir kaynak kullandığı için
>    Binance'i MarketDataStore'a bağlarken Bybit kolu bozulmamalı —
>    `exchange-router.js` üzerinden koşullu okuma yapılmalı.

---

## 4. 🔴 IP Ban riski oluşturan durumlar

### Yüksek risk
| # | Durum | Neden riskli |
|---|---|---|
| 1 | **Grafik canlı akışı 2 sn REST polling** (`chart-data.js:374`) | Binance için WS varken REST kullanılıyor. Açık her grafik paneli ayrı timer açıyor. 4 panelli layout = **dakikada 120 istek** sadece grafikten. Bu, ban listesindeki 1 numaralı davranış. |
| 2 | **M1Hammer tarayıcı** (`m1hammer-scanner.js`) | Her coin için 5 timeframe'i **paralel** çekiyor (`Promise.all`). 400 coin × 5 = **2000 istek**, 5 dakikada bir. Şu an **kapalı** (`start()` hiçbir yerden çağrılmıyor) — açılırsa anında ban riski. |
| 3 | **Coin Detail 10 sn polling** | Her coin değişiminde 5 endpoint × 6 kez/dakika. Sekme arkaplandayken 30 sn'ye düşüyor (iyi), ama ön planda yüksek. |

### Orta risk
| # | Durum | Not |
|---|---|---|
| 4 | Screener 60 sn tam liste yenileme | `premiumIndex` + `ticker/24hr` ağır endpoint'ler (~500 coin). WS zaten aynı veriyi veriyor → bu yenileme muhtemelen gereksiz. |
| 5 | Bybit 5 sn ticker polling | Bybit'in limitleri daha gevşek, kabul edilebilir ama optimize edilebilir. |

### İyi yapılmış (risk azaltıcı) ✅
- **Merkezi WebSocket** (`MarketDataStore`) — tüm market tek bağlantıda,
  ban riskini büyük ölçüde azaltıyor. Kodda da bu niyet belirtilmiş.
- **Sunucu tarafı proxy** (`server.js` `/api/binance/futures/*`) — istekler
  sunucu IP'sinden gidebiliyor.
- **`sleep(300)` rate-limit koruması** sunucu tarafındaki toplu işlemlerde.
- **Reconnect backoff** (1 sn → max 30 sn) WS kopmalarında.

> **💡 Öneri — IP ban korunması:**
> 1. **Grafik akışını WS'e çevir (en acil).** Bybit tarafında zaten çalışan
>    bir WS implementasyonu var (`chart-data.js:465`) — Binance için aynı
>    desen `wss://fstream.binance.com/ws/<sym>@kline_<tf>` ile kurulabilir.
>    Bu tek değişiklik en büyük ban kaynağını ortadan kaldırır.
> 2. **M1Hammer'ı açmadan önce mutlaka yeniden yapılandır:**
>    - `Promise.all` ile 5 timeframe'i aynı anda çekmek yerine **sıralı** çek
>    - Coin'ler arasına **gecikme** koy (`sleep(200-300ms)`)
>    - Tüm coin'leri değil, **sadece screener'da görünen / filtreyi geçen**
>      coin'leri tara (400 → ~50 coin)
>    - İstekleri `server.js` proxy'si üzerinden geçir
>    - Ya da en temizi: **taramayı sunucuya taşı** (tarayıcı yerine backend
>      tarasın, sonucu WS/REST ile arayüze göndersin)
> 3. **Merkezi bir istek sayacı ekle.** Binance dakikalık ağırlık limiti
>    veriyor (`X-MBX-USED-WEIGHT-1M` header'ı). Bu header okunup bir yerde
>    biriktirilse, limite yaklaşınca sistem kendi kendini yavaşlatabilir —
>    ban yemeden önce fren yapmış olur.
> 4. **429 / 418 yanıtlarını yakala.** Şu an `fetch` hataları çoğu yerde
>    sessizce yutuluyor (`.catch(()=>null)`). Binance 429 (rate limit) veya
>    418 (ban) dönerse bu **fark edilmeli** ve kullanıcıya gösterilmeli,
>    ayrıca ilgili polling otomatik durdurulmalı.
> 5. **Sekme arkaplandayken tüm polling'ler yavaşlamalı.** Şu an sadece
>    detay paneli bunu yapıyor (10→30 sn). Aynı mantık grafik ve screener
>    için de uygulanmalı.

---

## 5. Alarm / uyarı sistemleri (şu ana kadar ne var)

### 5.1 ScalpFRMonitor — FR ani değişim sinyalleri (ANA SİSTEM)
`fr-tracker.js` içinde. Her FR güncellemesinde bir önceki değerle
karşılaştırıp **delta** hesaplıyor, eşiği aşarsa sinyal üretiyor.

**FR EŞİKLERİ (sorulan konu):**
| Eşik | Değer | Anlamı | Rozet |
|---|---|---|---|
| `THRESHOLD_NORMAL` | **0.01** (%0.01) | Normal hareket — kaydedilir, listeye girer | `•` (yeşil nokta) |
| `THRESHOLD_RAPID` | **0.02** (%0.02) | Ani yükseliş | `⚡ Ani` |
| `THRESHOLD_ALARM` | **0.03** (%0.03) | Global alarm | `🚨 Alarm` |

Aynı eşikler `FRTracker` sınıfında da tanımlı (`lowThreshold: 0.01`,
`rapidChangeThreshold: 0.02`, `globalAlarmThreshold: 0.03`).

**Mantık:** Bir "baseline" (başlangıç değeri) tutuluyor. Güncel FR ile
baseline arasındaki fark 0.01'i aşınca → geçmişe kaydediliyor,
`frRapidChange` event'i fırlatılıyor ve baseline güncelleniyor. Yani her
0.01'lik hareket yeni bir referans noktası oluşturuyor.

**Sinyaller nereye gidiyor:**
- Bot Signals paneli → FR sekmesi (tablo: Previous / Current / Delta / Remaining / Saat)
- Screener'daki coin isminin yanına rozet
- Sunucuya kaydediliyor (`POST /api/signals/fr` → MongoDB)

> **💡 Öneri — FR eşikleri ve sinyal mantığı:**
> 1. **Eşikler koda gömülü (hard-coded).** `THRESHOLD_NORMAL/RAPID/ALARM`
>    sabit. Farklı coin'ler farklı FR oynaklığına sahip — sakin bir coinde
>    %0.01 anlamlıyken, oynak bir coinde gürültü olabilir. **Öneri:** eşikler
>    en azından bir ayar panelinden değiştirilebilir olmalı; ideali ise
>    coin'in kendi geçmiş oynaklığına göre **dinamik eşik** (örn. son 24
>    saatlik FR standart sapmasının katı).
> 2. **Sadece deltanın büyüklüğüne bakılıyor, yönüne/süresine bakılmıyor.**
>    "%0.03 düştü" ile "%0.03 çıktı" aynı alarm. Ayrıca "5 dakikada %0.03"
>    ile "2 saatte %0.03" arasında fark yok. **Öneri:** sinyal nesnesine
>    `yön` (long/short baskısı) ve `süre` (kaç dakikada gerçekleşti) alanı
>    eklenmeli — strateji tarafında bu ikisi kritik olacak.
> 3. **Baseline mantığı "merdiven" kaçırabilir.** Her eşik aşımında baseline
>    sıfırlandığı için, FR yavaşça %0.009'luk adımlarla toplam %0.05 hareket
>    ederse **hiçbir sinyal üretilmez**. **Öneri:** baseline'ın yanında bir
>    de **zaman pencereli** kontrol olmalı (örn. "son 30 dakikadaki toplam
>    değişim" ayrıca izlensin).
> 4. **Sunucuya kayıt var ama geri okuma sınırlı.** `POST /api/signals/fr`
>    ile kaydediliyor, `GET` endpoint'i de var — ama arayüz sayfa
>    yenilendiğinde geçmiş sinyalleri geri yüklüyor mu, kontrol edilmeli.
>    Yüklemiyorsa her yenilemede sinyal geçmişi sıfırlanıyor demektir.

### 5.2 Coin yanındaki işaretler (sorulan konu)
`screener-core.js:160-168` — sinyal **son 30 dakika içinde** geldiyse gösteriliyor:

| İşaret | Anlamı | Koşul |
|---|---|---|
| 🚨 | Global Alarm | FR deltası ≥ %0.03 |
| ⚡ | Rapid Rise (Ani yükseliş) | FR deltası ≥ %0.02 |
| • (yeşil nokta) | Active (aktif hareket) | FR deltası ≥ %0.01 |

30 dakika geçince işaret kendiliğinden kayboluyor.

> **💡 Öneri — coin işaretleri:**
> 1. **İşaret sadece şiddeti gösteriyor, yönü göstermiyor.** FR yukarı mı
>    aşağı mı hareket etti belli değil. **Öneri:** rozete renk ekle
>    (yeşil = FR düştü/long lehine, kırmızı = FR çıktı/short lehine) ya da
>    ok işareti (⚡↑ / ⚡↓). Bakışta anlaşılır olur.
> 2. **30 dakika sabit.** Scalp için 30 dk çok uzun, swing için çok kısa
>    olabilir. **Öneri:** bu süre de ayarlanabilir olmalı, ya da rozet
>    **solarak** (opacity düşerek) yaşlandığını göstermeli — böylece "5 dk
>    önceki sinyal" ile "28 dk önceki sinyal" ayırt edilir.
> 3. **Tooltip'ler İngilizce ("Global Alarm", "Rapid Rise", "Active"),
>    diğer bazı yerler Türkçe.** Dil kuralı gereği yeni metinler İngilizce
>    olacak, ama tooltip'e **eşik değeri de yazılmalı**: örn.
>    "Rapid Rise — FR moved 0.024% in 12 min". Bilgi değeri çok artar.
> 4. **Sadece FR sinyali rozet üretiyor.** İleride M1Hammer/diğer botlar
>    açılınca aynı alanda çakışacak. **Öneri:** rozet alanı şimdiden
>    çok-sinyal destekleyecek şekilde tasarlanmalı (örn. en fazla 2 rozet,
>    fazlası "+2" olarak).

### 5.3 Diğer "alarm" arayüzleri — **henüz işlevsiz**
| Öğe | Durum |
|---|---|
| Sağ sidebar "Alarm" butonu (`#rsb-alarms`) | ⚠️ Tıklayınca sadece Bot Signals sekmesini açıyor. Gerçek bir alarm kurma paneli **yok**. |
| Navbar "Alert" butonu (`#btn-alarm`) | ⚠️ Aynı şekilde işlevsiz. |
| Fiyat alarmı / kullanıcı tanımlı alarm | ❌ Hiç yok. |
| Sesli/masaüstü bildirim | ❌ Hiç yok. |

**Yani:** Şu an tek gerçek alarm sistemi otomatik FR eşik takibi. Kullanıcının
kendi alarmını kurabileceği hiçbir mekanizma yok.

> **💡 Öneri — alarm sistemi:**
> 1. **Boş butonlar ya doldurulmalı ya kaldırılmalı.** Şu an iki buton
>    (`#rsb-alarms`, `#btn-alarm`) tıklanabiliyor ama hiçbir şey yapmıyor —
>    bu, kullanıcıda "bozuk" hissi yaratır. Kısa vadede en azından
>    "Yakında" etiketi ya da devre dışı görünüm verilmeli.
> 2. **Minimum uygulanabilir alarm sistemi** şunları içermeli:
>    - Alarm türü: fiyat (üstünde/altında), FR eşiği, OI değişimi
>    - Hedef: seçili coin veya tüm market
>    - Tetiklenince: sesli uyarı + tarayıcı bildirimi (`Notification API`)
>    + panelde liste
>    - `localStorage`'da kalıcı saklama (sayfa yenilenince kaybolmamalı)
> 3. **Tetikleme motorunun yeri önemli.** Alarmlar tarayıcıda çalışırsa
>    sekme kapalıyken çalışmaz. Gerçek fayda için **sunucu tarafında**
>    (`server.js` zaten FR verisi topluyor ve MongoDB'ye yazıyor)
>    çalışmalı — sonra Telegram/e-posta ile bildirim gönderilebilir.
>    Bu, "bilgisayar başında değilken de haberim olsun" ihtiyacını çözer.
> 4. **Mevcut FR sinyal sistemi zaten bir alarm motoru** — sıfırdan
>    yazmaya gerek yok. `ScalpFRMonitor`'ın ürettiği sinyallere kullanıcı
>    tanımlı filtre/bildirim katmanı eklemek en hızlı yol olur.
> 5. **Claude.ai'da geliştirilen strateji ile bağlantı:** Alarm sistemi
>    tasarlanırken oradaki "2 sinyal kombinasyonu" mantığı göz önünde
>    tutulmalı — alarm motoru tek koşul değil, **birden fazla koşulun
>    birlikte sağlanması** durumunu destekleyecek şekilde kurulmalı.
>    Sonradan eklemek çok daha zor olur.

### 5.4 Bot durumları
| Bot | Durum |
|---|---|
| **FR** | ✅ Çalışıyor (ScalpFRMonitor, canlı) |
| **M1 Hammer** | ⚠️ Kod yazılmış (RSI/StochRSI/WaveTrend hesaplıyor) ama `start()` **hiçbir yerden çağrılmıyor** → kapalı. Açılırsa IP ban riski (bkz. §4). |
| **MA (M1-A)** | ❌ Sadece buton var, kod yok |
| **V3** | ❌ Sadece buton var, kod yok |
| **4S** | ❌ Sadece buton var, kod yok |

> **💡 Öneri — botlar:**
> 1. **Boş bot butonları (MA/V3/4S) kafa karıştırıyor.** Tıklanınca boş
>    liste geliyor, kullanıcı "bozuk mu?" diye düşünüyor. **Öneri:** ya
>    "Yakında" mesajı gösterilmeli ya da tanımları netleşene kadar
>    butonlar gizlenmeli.
> 2. **M1Hammer'ın kodu hazır ve içinde ciddi iş var** (RSI, StochRSI,
>    WaveTrend, 5 timeframe, yıldız puanlama). Bunu çöpe atmak yerine
>    §4'teki güvenlik önerileriyle **açmak** en yüksek değerli işlerden
>    biri — yeni bot yazmaktan daha hızlı sonuç verir.
> 3. **Bot tanımları dokümante edilmemiş.** MA/V3/4S'in ne yapacağı hiçbir
>    yerde yazılı değil. Kod yazmadan önce her botun **girdi (hangi veri),
>    koşul (hangi eşik), çıktı (hangi sinyal)** tanımı yazılmalı — aksi
>    halde Claude.ai'daki strateji çalışmasıyla uyumsuz çıkar.
> 4. **Ortak bot altyapısı kurulmalı.** Şu an FR ve M1Hammer tamamen ayrı
>    yazılmış (farklı veri akışı, farklı sinyal formatı, farklı depolama).
>    3 bot daha eklenecekse önce **ortak bir "bot" arayüzü**
>    (`scan()` → `Signal[]`, ortak sinyal formatı, ortak zamanlayıcı,
>    ortak rate-limit bütçesi) tanımlanmalı. Yoksa 5 bot = 5 ayrı polling
>    döngüsü = kesin ban.

---

## 6. Performans değerlendirmesi

### İyi olanlar ✅
- Merkezi WS havuzu — mimari olarak doğru kurulmuş
- Screener render'ı `setTimeout` ile debounce ediliyor (1 sn)
- Sekme arkaplandayken detay polling 30 sn'ye düşüyor (`visibilitychange`)
- Sembol listesi günlük cache'leniyor (delist koruması var)
- Grafik lazy-load throttle'ı (3 sn)

### Sorunlar ⚠️
| # | Sorun | Etki |
|---|---|---|
| 1 | Grafik 2 sn REST polling (Binance) | En büyük performans + ban sorunu. Bybit'te WS kullanılıyor ama Binance'te kullanılmıyor — tutarsız. |
| 2 | Detay paneli MarketDataStore'u kullanmıyor | Gereksiz REST trafiği, veri tutarsızlığı |
| 3 | Screener 60 sn tam liste yenileme | WS zaten veriyi veriyor, muhtemelen gereksiz |
| 4 | `innerHTML` ile tam tablo yeniden çizimi | ~500 satırlık screener'da her render'da tüm DOM yeniden yaratılıyor |
| 5 | 5+ ayrı `setInterval` timer'ı | Merkezi bir scheduler yok |
| 6 | Google Translate resmi olmayan endpoint | Her an kırılabilir, hata yönetimi zayıf |

> **💡 Öneri — performans:**
> 1. **Screener render'ı en büyük DOM maliyeti.** ~500 satır her seferinde
>    `innerHTML` ile baştan yaratılıyor. **Öneri:** satır bazlı güncelleme
>    (sadece değişen hücrenin `textContent`'ini değiştir) veya sanal
>    kaydırma (virtual scroll — sadece görünen ~25 satırı çiz). İkincisi
>    hem render'ı hem bellek kullanımını dramatik düşürür.
> 2. **Merkezi zamanlayıcı yok.** En az 8 ayrı `setInterval` bağımsız
>    çalışıyor; hepsi aynı anda tetiklenirse ani yük oluşuyor. **Öneri:**
>    tek bir "tick" döngüsü (örn. saniyede 1) ve görevlerin bu döngüye
>    kaydolması. Böylece hem yük dağılır, hem "sekme arkaplanda → hepsini
>    yavaşlat" tek yerden yapılabilir.
> 3. **Ölçüm yok.** Şu an hiçbir yerde "kaç istek attık, render kaç ms
>    sürdü" bilgisi yok. **Öneri:** basit bir sayaç (dakikadaki istek
>    sayısı, son render süresi) geliştirici konsoluna yazılsın — optimizasyon
>    yaparken körlemesine gitmemek için.
> 4. **Bellek sızıntısı riski kontrol edilmeli.** `FRTracker` her sembol
>    için `Map`'te geçmiş tutuyor, `_klines` map'i büyüyor. Uzun süre açık
>    kalan sekmede bellek sürekli artıyor olabilir. **Öneri:** geçmiş
>    kayıtlarına üst sınır (örn. sembol başına son 100 kayıt) ve periyodik
>    temizlik eklenmeli.
> 5. **Hata yönetimi sessiz.** Çoğu `fetch` `.catch(()=>null)` ile
>    yutuluyor — veri gelmediğinde arayüz "—" gösteriyor ama **neden**
>    gelmediği belli olmuyor (ban mı, ağ mı, sembol mü yok?). **Öneri:**
>    en azından konsola sınıflandırılmış hata basılmalı, tekrarlayan
>    hatalarda kullanıcıya küçük bir uyarı gösterilmeli.

---

## 7. Öncelik sıralaması (2. aşama önerisi)

| Öncelik | İş | Neden |
|---|---|---|
| ~~🔴 0~~ | ~~`loadSymbol()` çoklu çağrı bug'ı~~ | ✅ **DÜZELTİLDİ** (bkz. §10.2.1) — istek sayısı 95→66 düştü |
| 🔴 1 | Grafik canlı akışını REST polling → **WebSocket**'e çevir (Binance) | En yüksek ban riski + en büyük performans kazancı. Bybit'te zaten WS var, örnek mevcut. |
| 🔴 2 | Coin Detail'i **MarketDataStore**'dan besle | Veri tutarsızlığını bitirir, REST trafiğini ~%60 azaltır |
| 🟡 3 | Gerçek **alarm sistemi** (kullanıcı tanımlı fiyat/FR alarmı + bildirim) | Arayüzde 2 buton var ama arkasında hiçbir şey yok |
| 🟡 4 | M1 Hammer tarayıcıyı **güvenli hale getirip** aç (batch + gecikme) | Kod hazır ama mevcut haliyle ban ettirir |
| 🟢 5 | Screener 60 sn tam yenilemeyi gözden geçir | WS varken gerekli mi? |
| 🟢 6 | Screener render'ı satır-bazlı güncellemeye çevir | 500 satırda DOM maliyeti |

> **💡 Öneri — sıralama gerekçesi:**
> İlk iki madde (grafik WS + detay MarketDataStore) **birbirini
> destekliyor** ve ikisi birlikte yapılırsa hem ban riski hem performans
> hem veri tutarsızlığı tek seferde çözülür — bu yüzden ilk turda birlikte
> ele alınmalı.
>
> 3. madde (alarm sistemi) **Claude.ai'daki strateji çalışması bitmeden
> başlanmamalı** — strateji, alarmın hangi koşulları desteklemesi
> gerektiğini belirleyecek. Şimdiden yapılırsa büyük ihtimalle yeniden
> yazılır.
>
> 4. madde (M1Hammer) ise §5.4'teki "ortak bot altyapısı" kararından
> **sonra** yapılmalı. Önce altyapı, sonra botlar.
>
> **Kısacası önerilen sıra:** `1+2 birlikte` → `ortak bot altyapısı` →
> `M1Hammer` → `strateji netleşince alarm sistemi` → `render optimizasyonu`.

---

## 8. Özet cevaplar (soru bazlı)

**S: Aynı veri birkaç yerden mi çekiliyor?**
Evet. FR verisi 3 ayrı yoldan (WS, screener REST, detay REST) geliyor.
Screener ile Coin Detail farklı kaynak kullanıyor → tutarsızlık riski var.

**S: IP ban riski nerede?**
En büyük: grafik 2 sn REST polling. Sonra: M1Hammer tarayıcı (kapalı ama
açılırsa tehlikeli), coin detay 10 sn polling.

**S: FR eşikleri ne?**
%0.01 normal (•), %0.02 ani (⚡), %0.03 alarm (🚨). Baseline mantığıyla
çalışıyor, her eşik aşımında referans sıfırlanıyor.

**S: Coinlerin yanındaki işaretler ne?**
Son 30 dakikadaki FR sinyalinin şiddeti: 🚨 / ⚡ / • (yukarıdaki eşiklere göre).

**S: Alarm sistemi var mı?**
Otomatik FR takibi var. Kullanıcı tanımlı alarm **yok** — Alarm/Alert
butonları şu an işlevsiz.

---

## 9. Genel değerlendirme ve kapanış önerisi

**Sistemin güçlü yanı:** Mimari doğru düşünülmüş. Merkezi veri havuzu,
event tabanlı dağıtım, exchange soyutlaması, sunucu tarafı proxy ve
geçmiş kaydı — hepsi doğru kararlar. İskelet sağlam.

**Sistemin zayıf yanı:** Bu mimari **tutarlı uygulanmamış**. Merkezi havuz
kurulmuş ama modüllerin yarısı onu atlıyor. Bu yüzden aynı veri 3 yerden
geliyor, gereksiz REST trafiği var ve ban riski oluşuyor. Yani sorun
tasarımda değil, **tasarıma uyumda**.

> **💡 Kapanış önerisi:** 2. aşamada yeni özellik eklemeden önce **bir tur
> "hizaya getirme" yapılması** en yüksek değerli iş olur: her modülü
> MarketDataStore'a bağlamak, REST polling'leri WS'e çevirmek ve ortak bot
> altyapısını kurmak. Bu yapılmadan yeni bot/alarm eklenirse, her yeni
> özellik mevcut dağınıklığı katlayarak büyütür ve ban riski hızla artar.
>
> Tersine, bu temizlik yapıldıktan sonra yeni bot eklemek çok daha hızlı
> ve güvenli olur — çünkü veri zaten hazır olacak, sadece "koşul yaz,
> sinyal üret" kalacak.

---

## 10. ÇALIŞIR HALDE ÖLÇÜM — gerçek veriler ve bulunan bug'lar

> Yukarıdaki §1-§9 kod okumasına dayalıydı. Bu bölüm uygulamayı **gerçekten
> çalıştırıp** ölçülen sonuçları içerir (tek grafik, BTCUSDT, kullanıcı
> etkileşimi olmadan, boşta).

### 10.1 Ölçülen istek trafiği

| Ölçüm | Sonuç |
|---|---|
| İlk 58 saniyede toplam istek | **95 istek** (açılış patlaması dahil) |
| Oturmuş durumda (boşta) | **43 saniyede 31 istek → dakikada ~44 istek** |
| En çok tekrarlayan (58 sn içinde) | `tickers` ×13, `klines?BTCUSDT` ×13, `ticker/24hr?BTCUSDT` ×11, `premiumIndex?BTCUSDT` ×11, `openInterestHist` ×9, `globalLongShortAccountRatio` ×9 |

**Tek coin, tek grafik, hiç dokunmadan dakikada 44 istek.** Kullanıcı coin
değiştirdikçe / grafik açtıkça bu katlanarak artar.

### 10.2 🔴 BULUNAN BUG — `loadSymbol()` açılışta 4 kez çalışıyor

**Kanıt:** `detail-panel.js:967`'deki `console.log('frIntervalText:', ...)`
satırı, sayfa açılışında konsola **4 kez** basılıyor. Ağ kaydında da aynı
istekler arka arkaya tekrarlanıyor (`premiumIndex` beklenen 6 yerine 11 kez,
`globalLongShortAccountRatio` beklenen 6 yerine 9 kez).

**Kök neden:** `loadSymbol()` birbirinden bağımsız **3 ayrı tetikleyiciden**
çağrılıyor ve hiçbir koruma yok:
1. `init()` → satır 1083 (varsayılan coin)
2. `EventBus.on('funding:loaded')` → satır 1089
3. `EventBus.on('symbol:change')` → satır 1042

`loadSymbol()` **async** olduğu için, içindeki `_startPolling()`'in eski
timer'ı temizlemesi işe yaramıyor — zaten uçuşta olan fetch grupları
iptal edilmiyor, hepsi tamamlanıyor. Yani her tetikleyici kendi ~12-15
isteklik paketini gönderiyor.

**Etkisi:** Açılışta ve her coin değişiminde **3-4 kat gereksiz REST
trafiği**. IP ban riskinin ölçülen en somut kaynağı bu.

### 10.2.1 ✅ DÜZELTİLDİ — uygulanan çözüm

`detail-panel.js`'e iki katmanlı koruma eklendi:

| Değişken | Görev |
|---|---|
| `_loadInFlightKey` | Aynı coin+borsa için yükleme sürerken ikinci çağrı **hiç başlatılmaz** (açılıştaki eşzamanlı çağrıları engeller) |
| `_loadToken` | Her yüklemeye sıra numarası verir. Yükleme biterken numara güncel değilse sonuç **ekrana yazılmaz** — bayat verinin yeni coinin üstüne binmesini engeller |

`loadSymbol()` sonuna `finally` bloğu eklendi; kilit sadece yüklemenin
hâlâ güncel olması durumunda bırakılıyor (daha yeni bir yükleme varsa
onun kilidi silinmiyor).

**Yan temizlik:** Aynı satırdaki hata ayıklama artığı
`console.log('frIntervalText:', ...)` kaldırıldı.

**Ölçülen sonuç (48-58 sn karşılaştırılabilir pencere, boşta):**

| Metrik | Önce | Sonra |
|---|---|---|
| Toplam istek | 95 (58 sn) | **66** (48 sn) |
| `premiumIndex` | 11 | **8** |
| `ticker/24hr` | 11 | **8** |
| `globalLongShortAccountRatio` | 9 | **6** |
| `openInterestHist` | 9 | **6** |
| Açılıştaki `loadSymbol` çalışması | **~4 kez** | **~2 kez** |

**Kararlı durum (boşta, 59 sn pencere):** dakikada **23 istek**
(önceki ölçüm: 44). ⚠️ *Bu iki ölçüm farklı oturumlarda alındığı için
tam kontrollü bir karşılaştırma değildir — güvenilir kanıt yukarıdaki
uç-nokta bazlı sayımlardır (11→8, 9→6).*

**Fonksiyonel doğrulama:** Hızlı coin geçişi testi (ETH→SOL→XRP, 150 ms
arayla) yapıldı — panelde **XRP** verisi kaldı, ETH/SOL'ün geç gelen
sonuçları üstüne binmedi. Konsolda hata yok, uygulama normal çalışıyor.

> **💡 Kalan öneri:** Açılışta hâlâ **2** yükleme oluyor. İkincisi
> `funding:loaded` event'inden geliyor ve ilk yükleme **bittikten sonra**
> tetiklendiği için çakışma korumasına takılmıyor — teknik olarak bug
> değil, tasarım israfı. Sadece `frIntervalText` alanını tazelemek için
> tüm paneli (12-15 istek) yeniden yüklüyor. **Öneri:** bu dinleyici tüm
> paneli yeniden yüklemek yerine sadece ilgili alanı güncellemeli. Bu
> yapılırsa açılış trafiği bir kat daha düşer. Riskli olmadığı için
> sonraki turda ele alınabilir.

### 10.3 🟡 BULUNAN SORUN — FR sinyal geçmişi geri yüklenmiyor

Konsolda açılışta 2 uyarı:
```
[ScalpFRMonitor:binance] Preload hatası: Failed to fetch
[ScalpFRMonitor:bybit]   Preload hatası: Failed to fetch
```

§5.1'de "kontrol edilmeli" dediğim madde **doğrulandı**: sinyal geçmişi
sunucudan geri yüklenemiyor. Yani **her sayfa yenilemesinde birikmiş FR
sinyalleri sıfırlanıyor**, Bot Signals paneli boş başlıyor.

> **💡 Öneri:** Bu lokal ortamda MongoDB bağlı olmadığı için de olabilir —
> önce sunucunun `/api/signals/fr` endpoint'i gerçekten çalışıyor mu
> doğrulanmalı. Çalışıyorsa hata istemci tarafında. Çalışmıyorsa sinyal
> kalıcılığı hiç yok demektir ve bu, "geçmişe dönüp sinyalleri incelemek"
> ihtiyacını tamamen engelliyor.

### 10.4 Envanterde eksik çıkan veri kaynağı — CoinGecko

`detail-panel.js:963` **CoinGecko API**'sine istek atıyor
(`api.coingecko.com/api/v3/coins/...` — market cap, arz bilgileri /
Fundamental Info kartları için). Bu kaynak §2'deki haritada yoktu.

> **💡 Öneri:** CoinGecko'nun ücretsiz katmanı **dakikada 10-30 istek**
> ile sınırlı ve aşılınca 429 döner. Coin değiştirdikçe çağrıldığı için
> hızlı coin gezinmede limit aşılabilir. Sonuç `try/catch {}` ile sessizce
> yutuluyor — kullanıcı verinin neden gelmediğini anlamıyor. En azından
> coin bazlı **önbellek** (aynı coin için 5-10 dk tekrar sorma) eklenmeli.

### 10.5 Genel sağlık durumu

| Kontrol | Sonuç |
|---|---|
| JavaScript hatası (console error) | ✅ **Yok** |
| Uyarı (warning) | 2 adet — ikisi de §10.3'teki preload hatası |
| Modül başlatma | ✅ Tüm modüller "Initialized ✓" veriyor |
| WebSocket bağlantısı | ✅ `[MarketDataStore] WS bağlandı ✓` |
| Veri yükleme | ✅ 743 Binance / 780 Bybit funding aralığı, 747 coin FR, 573+460 sembol |
| Sayfa açılışı | ✅ Sorunsuz, kırık görsel yok |

**Özet:** Uygulama **çalışıyor ve kararlı** — çökme, JS hatası, kırık
arayüz yok. Sorunlar işlevsellikte değil, **verimlilikte** (gereksiz
tekrarlanan istekler) ve **kalıcılıkta** (sinyal geçmişi).

---

## Notlar

- §1-§9 **kod okumasına dayalı statik inceleme**dir. §10 ise uygulamayı
  gerçekten çalıştırıp yapılan **ölçüme** dayanır.
- §10 bir **duman testi**dir (smoke test): ana sayfa açıldı, boşta ölçüm
  alındı, konsol ve ağ trafiği incelendi. **Sistematik bir bug avı
  değildir** — her ekran/buton/senaryo tek tek denenmemiştir. Coin
  değiştirme, çoklu grafik, borsa değiştirme, uzun süreli çalışma (bellek
  sızıntısı) gibi senaryolar test edilmemiştir.
- Ölçümler tek grafik + tek coin ile alınmıştır; çoklu panel senaryosunda
  rakamlar katlanır.
- Çizim araçları bu incelemeye dahil değildir — bkz.
  [`raporlar/2026-08-01-cizim-araclari-listesi-temizlik.md`](raporlar/2026-08-01-cizim-araclari-listesi-temizlik.md).
- Sunucu tarafı (`server.js`, MongoDB şemaları, veri saklama politikası)
  yüzeysel incelenmiştir; ayrı bir tur gerekebilir.
