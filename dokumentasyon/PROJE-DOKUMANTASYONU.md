# Proje Dokümantasyonu — Piyasa Okuma Sistemi & Kişisel Platform

Bu doküman, bir Claude.ai sohbetinde geliştirilen kripto piyasa okuma
çerçevesinin ve bunun kişisel bir trading platformuna (Visivero
tarzı) dönüştürülmesi hedefinin özetidir. Yeni bir sohbette veya
Claude Code oturumunda bağlam vermek için kullanılabilir.

## 1. Amaç

Kullanıcı, Binance perpetual futures üzerinde kaldıraçlı işlem
yapıyor ve kendi trading platformunu geliştiriyor (görsel/stil
olarak "Visivero" adlı mevcut bir üçüncü parti platformu referans
alıyor). Yol haritası: **önce mevcut araçları (Visivero, Bybit
TradeGPT) kullanmaya devam et, bu süreçte kendi okuma çerçevesini ve
veri altyapısını geliştir, zamanla kendi platformuna geçiş yap.**

Bu çalışma iki paralel parçadan oluşuyor:
- **İçerik/analiz** — Claude.ai sohbetinde yürütülüyor (piyasa okuma
  ansiklopedisi, vaka analizleri, veri yorumlama).
- **Platform/kod** — Claude Code ile ayrı bir proje klasöründe
  yürütülüyor (HTML siteler, ileride gerçek platform kodu).

## 2. Çekirdek okuma çerçevesi

Ansiklopedi (`piyasa-okuma-rehberi.html`) şu bölümlerden oluşuyor:

1. **Temel kavramlar** — Hacim, Açık Pozisyon (OI), Funding Rate (FR)
   basit tanımlarla.
2. **Trend bölgeleri** — Wyckoff'un 4 evresi: Birikim → Markup →
   Dağıtım → Markdown. Kritik nokta: aynı veri paterni (örn. sessiz
   OI artışı), trendin **neresinde** gerçekleştiğine göre tamamen
   farklı yorumlanır.
3. **Fiyat × OI matrisi** — Fiyat yönü (↑/↓/range) ile OI artışı/
   azalışının 6 kombinasyonu (sağlam yükseliş, short covering, sağlam
   düşüş, long tasfiyesi, sıkışma/birikim, ilgi azalması).
4. **Hacim × OI matrisi** — Fiyat range'deyken hacim ve OI'nin 9
   kombinasyonu (en güçlü sinyal: "taze giriş" — hacim VE OI aynı
   anda artıyor).
5. **Funding Rate okuma** — Pozitif/nötr/negatif FR'nin kalabalık
   taraf ve squeeze riski açısından yorumu.
6. **Sık gözden kaçan noktalar** — kısa zaman aralığı yanıltıcılığı,
   OI'nin yön belirtmemesi, order book duvarlarının kalıcı olmaması,
   küçük/düşük likiditeli coinlerde volatilitenin yüksekliği vb.
7. **Kanal stratejisi özeti** — Bir Telegram topluluğunun (Trader
   Club/Visivero) arşivinden çıkarılan, pazarlama dilinden arındırılmış
   strateji: "kalabalık taraf avlanır" tezi, bot kullanımı (Hammer
   Pro + 4S Sniper — sinyal kör kullanılmıyor, veriyle teyit ediliyor),
   risk kuralları ("nalına da mıhına da" tekniği, short'ta asla
   ekleme yok, ~%10 zarar sınırı).
8. **Long giriş checklist'i** — Yukarıdaki her şeyi birleştiren,
   6 kategorili (trend bölgesi → akıllı para/kalabalık ayrışması →
   hacim×OI → FR → fiyat/momentum teyidi → makro bağlam) kontrol
   listesi + kırmızı bayraklar + giriş sonrası kurallar.
9. **Hızlı özet tablosu**

## 3. Vaka analizi metodolojisi (`vaka-analizleri.html`)

Telegram arşivinden ve gerçek borsa verisinden çıkarılan somut
örnekler. Her vaka şu yapıyı izliyor:

- **Kuruluş tezi** — o anki canlı yorum/tez.
- **Zaman çizelgesi** — kaynak etiketli satırlar: **🗣️ Kanal**
  (topluluğun o anki yorumu) vs **📊 Veri** (gerçek borsa verisinden
  çıkarılan objektif okuma). Bu ayrım kritik — ikisi çelişmiyor,
  birbirini tamamlıyor: kanal "ne zaman dikkatli ol" diyor, veri
  "hangi günün davranışı gerçekten tehlikeli" diyor.
- **Görsel galeri** — orijinal ekran görüntüleri + üretilen çoklu
  panel grafikler, tıklanınca sayfa içi lightbox'ta açılıyor (yeni
  sekme yok, ileri/geri gezinme var).
- **Ders kutusu** — tez doğrulandı mı, ve varsa standart dışı bulgu
  ayrı, görsel olarak belirgin bir alt kutuda vurgulanıyor.

**Önemli ilke:** Her vakanın aynı kalıba girmesi beklenmiyor.
Örnek: BANK'ta "akıllı para" (Top Trader L/S oranı) squeeze boyunca
long kaldı; AKE'de ise zirveden birkaç gün önce short tarafa geçti.
Bu farkları gizlemek yerine ayrı ayrı işaretlemek, ileride "hangi
sinyale ne kadar güvenilir" sorusuna daha isabetli cevap vermeyi
sağlıyor.

## 4. Veri kaynakları ve çekme yöntemi (teknik — platform için kritik)

Şu ana kadar kullanılan tüm nicel veri, Binance'in **halka açık,
API-key gerektirmeyen** arşivinden (`data.binance.vision`) manuel
indirilip Claude'a yüklendi. Bu, ileride platformun otomatik veri
çekme katmanının temelini oluşturabilir.

### a) Fiyat + Hacim (klines)
```
https://data.binance.vision/data/futures/um/daily/klines/{SYMBOL}/{interval}/{SYMBOL}-{interval}-{YYYY-MM-DD}.zip
```
İçindeki CSV sütunları: `open_time, open, high, low, close, volume,
close_time, quote_volume, count, taker_buy_volume,
taker_buy_quote_volume, ignore`

**Dikkat:** `open_time` bazı dosyalarda mikrosaniye (16 haneli),
bazılarında milisaniye (13 haneli) — parse ederken büyüklüğe göre
otomatik tespit gerekiyor. Bazı yeni dosyalarda header satırı var,
eskilerde yok — kontrol gerekiyor.

### b) OI + Long/Short oranı (metrics)
```
https://data.binance.vision/data/futures/um/daily/metrics/{SYMBOL}/{SYMBOL}-metrics-{YYYY-MM-DD}.zip
```
İçindeki CSV, **5 dakikalık** çözünürlükte şu sütunları içeriyor:
`create_time, symbol, sum_open_interest, sum_open_interest_value,
count_toptrader_long_short_ratio, sum_toptrader_long_short_ratio,
count_long_short_ratio, sum_taker_long_short_vol_ratio`

Kullanılan alanlar:
- `sum_open_interest_value` → OI, USDT cinsinden
- `count_long_short_ratio` → **Global (herkes) L/S oranı**
- `sum_toptrader_long_short_ratio` → **Top Trader (büyük hesaplar)
  L/S oranı** — bu ikisi arasındaki ayrışma/yakınsama en değerli
  sinyal.

5 dakikalık veriyi daha kaba bir çözünürlüğe (örn. 4 saatlik)
indirgerken **ortalama değil, o pencerenin son (en güncel) değeri**
alınıyor — çünkü OI bir "stok" değişkeni, ortalamak yanıltıcı olur.

### c) Funding Rate
```
https://data.binance.vision/data/futures/um/monthly/fundingRate/{SYMBOL}/{SYMBOL}-fundingRate-{YYYY-MM}.zip
```
Aylık dosya olarak yayınlanıyor, ay bitmeden mevcut olmuyor. Bu
yüzden içinde bulunulan ay için FR paneli şu an **şematik/placeholder**
olarak bırakılıyor, ay tamamlanınca gerçek veriyle değiştiriliyor.

### d) Neden bu yöntem
Bu ortamda (Claude.ai sohbeti) Binance'in sunucularına doğrudan ağ
erişimi yok (güvenlik kısıtı) — bu yüzden kullanıcı dosyaları
manuel indirip yüklüyor. **Kendi platformunda (sunucu tarafında)
bu kısıt olmayacak** — yani bu üç endpoint'i otomatik, zamanlanmış
şekilde çekip aynı analiz pipeline'ını (klines + metrics birleştirme,
RSI hesaplama, OI/L-S grafiği) sunucu tarafında çalıştırmak teknik
olarak mümkün. Bu doküman o pipeline'ın manuel/prototip halidir.

### e) Hesaplanan (türetilmiş) veri
- **RSI(14)** — ham veride yok, günlük kapanışlardan standart
  Wilder's smoothing formülüyle hesaplanıyor. Not: bir seride hiç
  düşüş günü yoksa (ilk birkaç gün gibi) formül matematiksel olarak
  tanımsız kalır, 50 ile dolduruluyor — bu bir veri eksikliği değil,
  formülün doğal bir sınırı.

## 5. Site mimarisi

```
proje-klasörü/
  piyasa-okuma-rehberi.html   (ansiklopedi — 9 bölüm)
  vaka-analizleri.html        (vaka analizleri + coin karşılaştırma tablosu)
  photos/                     (Telegram arşivinden seçilmiş görseller)
  user-charts/                (kullanıcının TradingView ekran görüntüleri)
  charts/                     (Claude'un ürettiği çoklu panel Python grafikleri)
```

Tasarım sistemi: koyu tema, amber/yeşil/kırmızı/mor/teal/gri renk
kodlaması (her rengin sabit bir anlamı var: yeşil=doğrulayıcı,
kırmızı=risk/uyarı, mor=nötr veya erken sinyal, teal=yön değişimi,
gri=önemsiz/nötr), Space Grotesk/Inter/JetBrains Mono fontları.

Özellikler: sayfa içi lightbox (görsel galerisi, ileri/geri gezinme,
yeni sekme açmıyor), accordion (belirli teknik terimler için
tıklanınca açılan kısa açıklama paneli).

## 6. İş akışı notu

- **Analiz/içerik üretimi** → Claude.ai sohbeti (bu doküman gibi
  şeyler, vaka analizleri, veri okuma, coin karşılaştırmaları).
- **Dosya organizasyonu, kod değişiklikleri, görsel/klasör taşıma** →
  Claude Code (Claude.ai sohbeti buraya hazır prompt yazıyor).
- **Ham sayısal veri** → dosyaların kendi içinde kalıcı olarak duruyor,
  ayrıca hafızada tutulmasına gerek yok; karşılaştırma gerektiğinde
  ilgili dosya/bölüm tekrar paylaşılıyor.

## 7. Platform için sıradaki adımlar (öneri, henüz uygulanmadı)

1. Visivero'yu (veya benzer bir mevcut aracı) kullanmaya devam
   ederek veri okuma pratiğini derinleştirmek.
2. Yukarıdaki 3 endpoint'i (klines/metrics/fundingRate) otomatik
   çeken, birleştiren ve RSI hesaplayan bir arka uç (backend) servisi
   tasarlamak — şu ana kadar manuel yapılan pipeline'ın
   otomatikleştirilmiş hali.
3. Bu ansiklopedideki matrisleri/checklist'i canlı veriyle otomatik
   değerlendiren bir "sinyal skoru" katmanı eklemek (opsiyonel,
   ileri aşama).
4. Vaka analizi formatını (kaynak etiketli timeline + ders kutusu)
   platformun kendi "geçmiş işlemler" görünümüne uyarlamak.
