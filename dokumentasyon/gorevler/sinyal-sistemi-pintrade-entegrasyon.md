# Sinyal Sistemi — Pintrade Entegrasyonu İçin Kapsamlı Referans

**Amaç:** Bu doküman, Claude.ai sohbetinde geliştirilen kripto piyasa okuma/backtest
stratejisinin tam güncel durumunu özetler. Pintrade'e entegre edilmeye **henüz hazır
değil** — hem strateji tarafında bekleyen doğrulamalar var hem de Pintrade'in veri
altyapısı (L/S oranı, indikatör motoru) henüz kurulmadı. Bu, o gün geldiğinde referans
alınacak bir **durum raporu ve kural seti**, şimdi uygulanacak bir görev listesi değil.

Sırası geldiğinde: bu dokümanı oku, hangi bölümün üstünde çalışacağımızı birlikte
kararlaştır, sonra ilgili kısmı Pintrade koduna uygula.

---

## 1. Genel Mimari — İki Kombinasyon + Tarama Sistemi

Strateji, coin'in volatilitesine göre **iki farklı sinyal seti** kullanıyor, artı
bunları besleyecek bir **tarama/filtreleme katmanı**.

### 1.1 Coin Sınıflandırması (Volatilite Bazlı)

| Grup | ATR14/Fiyat Oranı | Hangi Kombinasyon | Durum |
|------|-------------------|--------------------|-------|
| Hareketsiz | < %3 | Elenir, sinyal üretilmez | Kâr potansiyeli yok (günde %1 bile hareket etmiyor) |
| **İdeal/Sakin** | %3 – %12 | **Kombinasyon 1** | ✅ Kanıtlanmış, güvenilir |
| **Sert** | ≥ %12 | **Kombinasyon 2** | ⚠️ Hâlâ geliştiriliyor, güvenilirlik düşük |

Bu üç kategori sabit değil — **tüm coinler taranıp** hangi kategoriye düştüğü
otomatik hesaplanmalı (statik bir coin listesi değil, dinamik sınıflandırma).

---

## 2. Kombinasyon 1 — Sakin Coinler İçin (KANITLANMIŞ, kullanıma hazır)

### Kural

**Büyük zaman dilimi (1H veya 4H):**
- Fiyat, Regression Channel'ın orta bandının altında veya üstünde belirli bir
  konumda (`fiyat <= RC_mid`)
- WaveTrend (WT1) aşırı satım bölgesinden yukarı kesişim yapıyor (`cross-up`)
- Bir önceki bar aşırı satım bölgesindeydi (oversold eşiği: **WT1 < -53**)

**Küçük zaman dilimi (5 dakika):**
- Heikin Ashi mumu yeşil (`ha_close >= ha_open`)
- HA kapanışı DEMA9'un üzerinde (`ha_close > dema9`)

Üçü birleşince **Long sinyali**.

### Test Sonuçları (30 coin, ~6900 sinyal, komisyon+slipaj dahil %0.14 round-trip)

| Ufuk | Pozitif Oran | Medyan Net Getiri |
|------|-------------|-------------------|
| +1 saat | %62.2 | +%0.19 |
| +4 saat | %60.8 | **+%0.42** (en güçlü) |
| +1 gün | %53.5 | +%0.27 |

**Öne çıkan coinler (4H TF, +4h medyan net getiri):** ONDO (+%1.48), STRK (+%1.46),
ENA (+%1.32), BIO (+%0.97), JUP (+%0.96), TUSDT (+%0.91), AEVO/MOVE/VANRY/BERA/HYPE
(+%0.80-0.87).

**Önerilen ufuk: +1 saat ve +4 saat (scalp/kısa swing). +1 gün ufkunda edge zayıflıyor,
uzun tutmak önerilmez.**

### ⚠️ Bilinen sınır — henüz test edilmedi

- WaveTrend oversold eşiği (**-53**) tüm coinlerde sabit test edildi ama tek bir
  vakada (COTI, 31 Temmuz) eşiğe **5 puan** yaklaşıp geçemediği için sinyal kaçtı.
  Eşiğin -48 gibi bir değere çekilmesi durumunda tüm 30 coinde nasıl bir fark
  yaratacağı **henüz sistematik olarak taranmadı** — bu Pintrade'e sabit -53 olarak
  değil, **yapılandırılabilir bir parametre** olarak eklenmeli.

---

## 3. Kombinasyon 2 — Sert Coinler İçin (GELİŞTİRME AŞAMASINDA, güvenilmez)

### Temel Kural

**1 saatlik zaman dilimi:**
- Fiyat/RSI arasında bullish divergence (fiyat daha düşük dip yaparken RSI daha
  yüksek dip yapıyor)
- VE (TopTrader L/S oranı düşüyor VEYA Global L/S oranı < 1.0)
- VE hacim artışı (20 bar ortalamasının üzerinde)

### Test Sonuçları — Genel Olarak Zayıf

Havuzlanmış +4h net getiri: **-%0.08** (Kombinasyon 1'in +%0.31'inin çok altında).

### Denenen İyileştirme Varyantları

| Varyant | Sonuç |
|---------|-------|
| **A — RSI seviye filtresi** (divergency'nin oluştuğu RSI dibi < 30 / 30-40 / >40) | Kısmen doğru yönde ama tek başına yetersiz: RSI<30 grubu +4h net sadece +%0.02 |
| **B — Tepki hızı** (divergency sonrası 1-3 bar içinde fiyat tepkisi geldi mi) | **En umut verici** — Hızlı grup %82.2 pozitif, +4h net **+%1.52**. **⚠️ AMA henüz doğrulanmadı — look-ahead bias (gelecek veriyi kullanma hatası) içerip içermediği kontrol ediliyor, sonuç bekleniyor.** |
| **C — Divergence büyüklüğü** | Marjinal etki (+%0.02-0.08) |
| **D — Hacim eşiği kademeleri** (1x/1.5x/2x) | Marjinal etki |

### Bilinen Yapısal Zaaf

Kombinasyon 2, **BANK'ın 10-11 Temmuz'daki gerçek erken kurulumunu (OI sessizce
%20+ artıp kalıcı kalması) yakalayamadı** — çünkü o an fiyat aylardır yatay bir
kanaldaydı, "daha düşük dip" oluşmadığı için klasik divergency hiç tetiklenmedi.

**Sonuç:** Divergency mantığı, "birikim → ani kırılım" tipi kurulumları
**yapısal olarak kaçırıyor**. Bu paternin ayrı bir dedektörle (OI kalıcılık testi,
divergency'den bağımsız) yakalanması gerekiyor — henüz kurulmadı.

### Kombinasyon 2 İçin Kullanıcı Tercihi — Tarama Sistemi

Kullanıcı, sert coinler için tek tek coin filtrelemek yerine **tüm coinleri tarayıp
kritere tam uyan veya yakın gelenleri uyarı/takip sinyali** olarak almak istiyor.
Yani Kombinasyon 2/3, statik bir coin listesi değil, **dinamik bir puanlama/tarama**
sistemi olmalı (bkz. Bölüm 5).

---

## 4. Manuel Teknik — BANK Örneğinden Çıkarılan Ders (henüz kodlanmadı)

Kanalın (Telegram/Trader Club) gerçek BANK tekniği, basit bir sinyalden daha
karmaşık — **çok katmanlı, dinamik bir yönetim tarzı:**

1. Normal bir işlem gibi başlanır
2. Hacim arttıkça hedef yükseltilir (statik hedef yok)
3. Düzeltme/soluklanma anlarında kısa vadeli **short scalp** yapılır ("timsah kısa
   ısırır kaçar" tekniği) — ana trend bozulmadan karşı yönde hızlı giriş-çıkış
4. Veri (OI/hacim) artmaya devam ettikçe hedef tekrar Long'a çevrilir

Giriş noktası tespiti: **1 saatlik divergency + "Market Exposure" göstergesinde
short'ların baskın olması + hacim artışı**, düşük bir fiyat noktasından giriş.

**Bu, Kombinasyon 2'nin ilham kaynağı ama ondan daha gelişmiş** — şimdilik
otomatikleştirilmedi, ileri seviye bir katman olarak not edildi.

---

## 5. Watchlist / Sinyal Listesi Sistemi (Pintrade tarafı, TASARIM KARARI ALINDI)

Kullanıcı ile üzerinde anlaşılan yapı (henüz kodlanmadı, sadece tasarım netleşti):

### Liste Türleri

**Kullanıcı adlandırılmış listeler (manuel, sınırsız):**
- Kullanıcı yeni liste oluşturabilir, isim verebilir, rename/delete edebilir
- Bir coin, birden fazla manuel listeye eklenebilir (sınır yok)

**Sistem listesi — "Sinyaller" (isim değiştirilemez, silinemez):**
- **Tek bir liste**, ama içinde **yatay ayıraçlarla Kom1 / Kom2 / Kom3 grupları**
  var (üç ayrı liste değil — tek liste, puanlamaya göre gruplanmış görünüm)
- Bir coin **otomatik listelerde sadece bir grupta** görünür (en yüksek puanı aldığı
  grupta) — manuel listelerden farklı olarak çoklama yok
- Sinyal geldiği anda coin ilgili gruba eklenir + **alarm sekmesinde bildirim**
  çıkar ("Kom1 listesine BANKUSDT eklendi" gibi)

### Pazar Filtresi

- **FUTURES** — sinyaller sadece burada çalışır
- **SPOT** — menüde görünür ama şimdilik işlevsiz/placeholder ("yakında"),
  ileride sadece grafik/fiyat/değişim izleme için kullanılacak, sinyale dahil
  olmayacak
- USDC eklenmeyecek, sadece USDT paritesi

### Kom1/Kom2/Kom3 Puanlama Mantığı (detay henüz netleşmedi, kullanıcı ile konuşulacak)

Kullanıcının önerisi: divergency oversold bölgesinden biraz yukarıda oluşanlar
ayrıca işaretlensin, kullanıcı bunları ekstra inceleyip ek faktör arayabilsin.
Yani kesin eşik değil, **kademeli bir güç skoru** düşünülüyor.

---

## 6. Sinyal Önerisi + Geri Ölçüm (İLERİDE, henüz sıra gelmedi)

Kullanıcının özgün fikri: Alarm sekmesinde sinyal geldiğinde sadece bildirim değil,
**önerilen giriş fiyat seviyesi** de gösterilsin, ve bu **veritabanına kaydedilsin.**

**Amaç:** Kullanıcı sinyali kaçırsa bile (bakmadıysa), o sinyal "ne olurdu" diye
sonradan geri ölçülebilsin. Bu, canlı sistemin gerçek performansını (kullanıcının
işlem yapıp yapmamasından bağımsız) sürekli, otomatik olarak takip etmeyi sağlar.

**Başlangıç için en dürüst/basit model:** Öneri fiyatı = sinyalin oluştuğu barın
kapanış fiyatı (limit emir veya retest bekleme gibi daha akıllı modeller ileride,
ayrıca backtest edilerek eklenebilir — karmaşıklaştırmadan önce basit bir referans
noktası kurmak öncelik).

**Sıralama (bağımlılık zinciri):**
1. L/S verisi altyapısı (Pintrade'de şu an **hiç yok** — kritik eksik)
2. Sinyal üretim motoru (Kom1/Kom2 canlı çalışsın)
3. Alarm sistemi (şu an Pintrade'de **dead button**, arkasında mantık yok)
4. Alarm + öneri fiyatı + veritabanı kaydı (bu bölüm)

---

## 7. Pintrade'in Şu Anki Altyapı Durumu (strateji için ne eksik)

| İhtiyaç | Durum |
|---------|-------|
| Fiyat + hacim (kline) | ✅ Var (`js/data/chart-data.js` + sunucu toplayıcı) |
| Funding Rate geçmişi | ✅ Var (`js/screener/fr-tracker.js`) — ⚠️ ama 3 ayrı yoldan geliyor, bkz. 7.1 |
| Açık Pozisyon (OI) — anlık | ✅ Var (`js/screener/oi-api.js`) |
| OI geçmişi (sunucu tarafı) | ⚠️ Bozuk — `server.js` yanlış alan okuyor, DB'deki geçmiş tamamen 0 |
| **Long/Short oranı (global + top trader)** | ❌ **Hiç yok — stratejinin merkezindeki veri, en kritik eksik. 2026-08-01 genel sistem değerlendirmesinde de bu, öncelik listesine hiç girmemiş — temizlik turu bitince ayrıca eklenmesi gerekiyor.** |
| Grafik üstünde indikatör (RSI, DEMA9, HA, WaveTrend, Regresyon Kanalı) | ❌ Grafik katmanında indikatör motoru yok |
| İndikatör matematiği | ⚠️ Var ama `m1hammer-scanner.js` içine gömülü, paylaşılmıyor — chart bunu kullanamıyor |
| Backtest | ❌ Hiç yok (backtest hep Claude.ai/Python tarafında çalışıyor) |
| Alarm sistemi | ⚠️ Buton var, arkasında hiç mantık yok |

**Sonuç:** Pintrade şu an bu stratejiyi **çalıştıracak durumda değil.** Önce L/S
verisi + grafik indikatör motoru kurulmalı, ondan sonra Kom1/Kom2 canlı hale
getirilebilir.

### 7.1 2026-08-01 Genel Sistem Değerlendirmesinden Gelen Ek Bulgular

Pintrade'de ayrı bir "genel temizlik" turu (`SISTEM-GENEL-DEGERLENDIRME.md`)
yapıldı — 2. aşamaya (yeni özellik) geçmeden önce mevcut altyapının durumu
incelendi. Strateji entegrasyonunu doğrudan ilgilendiren bulgular:

- **Merkezi veri havuzu var ama tutarlı kullanılmıyor.** `MarketDataStore`
  (tek WebSocket havuzu) doğru tasarlanmış, ama `detail-panel.js`,
  `chart-data.js`, `screener-core.js` onu atlayıp doğrudan borsaya REST
  istekleri atıyor. Kural olması gereken: *"Hiçbir UI modülü doğrudan fetch
  yapmaz, sadece MarketDataStore'dan okur."* **L/S verisi eklenirken bu
  kurala uyulmalı** — yeni bir modül daha "kendi başına fetch atan" bir
  modül olmasın, MarketDataStore'un bir parçası olsun.
- **FR verisi 3 ayrı yoldan geliyor** (WS 3sn / screener REST 60sn / detay
  panel REST 10sn) — ekranda aynı anda iki farklı değer görünebiliyor.
  **L/S verisi eklenirken aynı hataya düşülmemeli** — tek kaynaktan
  (MarketDataStore) okunmalı, FR'deki gibi çoklanmamalı.
- **IP ban riski hâlâ gerçek** (grafik 2sn REST polling en kritik, M1Hammer
  şu an kapalı ama kodu hazır). **L/S verisi çekimi de bu bütçeye dahil
  edilmeli** — yeni bir polling döngüsü eklemek yerine, WS'e taşıma işi
  bitince (Bölüm 8'deki sıra) L/S de aynı merkezi akışın bir parçası
  olmalı, ayrı bir zamanlayıcı açılmamalı.
- **Ortak "bot altyapısı" kararı bekleniyor** — M1Hammer ve gelecekteki
  Kom1/Kom2 motorları için ortak bir arayüz (`scan()` → `Signal[]`, ortak
  format, ortak zamanlayıcı, ortak rate-limit bütçesi) önerildi. **Kom1/Kom2
  sinyal motoru da bu ortak altyapıyı kullanmalı** — kendi ayrı polling
  döngüsünü açmamalı.
- **Alarm sistemi kasıtlı olarak bekletiliyor** — genel değerlendirme raporu
  da aynı sonuca varmış: *"alarm sistemi, Claude.ai'daki strateji çalışması
  bitmeden başlanmamalı."* Bu, Bölüm 8'deki sıralamamızla birebir örtüşüyor.

**Genel değerlendirmenin kendi öncelik sırası (temizlik turu):**
`Grafik WS'e geçiş + Detay panel MarketDataStore'a bağlama` (birlikte) →
`ortak bot altyapısı` → `M1Hammer'ı güvenli açma` → `strateji netleşince
alarm sistemi` → `render optimizasyonu`.

**Önemli:** Bu sıralamada **L/S veri toplama hiçbir maddede yok** — kapsam
dışı bırakılmış (temizlik turu, yeni veri eklemiyor). Yani temizlik turu
bitince, bu dokümandaki Bölüm 8 sıralaması ile genel değerlendirmenin
sıralaması **birleştirilmeli**: temizlik + ortak bot altyapısı bittikten
hemen sonra, M1Hammer'dan önce ya da onunla birlikte, **L/S veri toplama
mutlaka ayrı bir madde olarak eklenmeli.**

---

## 8. Öneri — Entegrasyon Sırası (ne zaman gelirse)

**Not:** Aşağıdaki sıra, Pintrade'in kendi genel temizlik turuyla (7.1)
birleştirilerek okunmalı. Temizlik turu (WS'e geçiş, MarketDataStore'a
bağlama, ortak bot altyapısı) **önce** biter, sonra aşağıdaki adımlar
başlar — birbirini tekrar etmiyor, birbirini tamamlıyor.

1. **L/S verisi altyapısı** — Binance/Bybit'ten global + top trader long/short
   oranını çekip kaydetme. **MarketDataStore'un bir parçası olarak** kurulmalı
   (kendi ayrı fetch/polling döngüsü açmamalı — bkz. 7.1), ortak bot
   altyapısı kararından sonra
2. **Chart/screener ortak indikatör motoru** — RSI, DEMA9, Heikin Ashi, WaveTrend,
   Regression Channel matematiğini `m1hammer-scanner.js`'den çıkarıp paylaşılan bir
   modüle taşımak (hem chart hem screener aynı hesaplamayı kullansın, tutarsızlık
   riski olmasın — tıpkı FR'nin 3 kaynaklı hatasından ders çıkararak)
3. **Kombinasyon 1'i canlı sinyal olarak kur** — sadece "sakin" gruptaki coinler için,
   watchlist'teki Kom1 grubuna otomatik eklesin
4. **Alarm sistemini gerçek mantıkla doldur** — sinyal geldiğinde bildirim
5. **Kombinasyon 2 (henüz kanıtlanmamış)** — Varyant B doğrulaması ve BANK tipi
   birikim dedektörü netleşince, dikkatli şekilde eklenir
6. **Sinyal önerisi + geri ölçüm veritabanı** (Bölüm 6)

Bu sıralama, altyapısız üstyapı kurmamak için önemli — 3'e geçmeden önce 1 ve 2
şart.

---

## 9. Şu An Claude.ai Tarafında Bekleyen Açık Sorular

Bu dokümanı okuyan Claude Code, aşağıdaki soruların cevabının **henüz Claude.ai
sohbetinde netleşmediğini** bilmeli — Pintrade'e sabit değer olarak gömülmemeli:

- Varyant B (tepki hızı filtresi) gerçek bir bulgu mu, yoksa look-ahead bias mı?
- WaveTrend oversold eşiği (-53) tüm coinlerde optimum mu, yoksa -48 gibi bir
  değer daha mı iyi çalışıyor?
- BANK tipi "sessiz OI birikimi → ani kırılım" paterni için divergency'den bağımsız
  ayrı bir dedektör nasıl kurulmalı?
- Kom1/Kom2/Kom3 puanlama sisteminin kesin eşik/ağırlıkları ne olacak?

Bu sorular cevaplanmadan sabit parametre olarak koda gömülmesi, henüz doğrulanmamış
varsayımları kalıcı hale getirir — Pintrade'deki her parametre **yapılandırılabilir
(config'den değiştirilebilir)** olmalı, kod içine sabit yazılmamalı.
