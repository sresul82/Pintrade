# Kom1 ATR Filtresi — Tam Evren Dağılımı + Geniş Bant Alternatifleri (üretime GİRMEDİ)

Kullanıcı sorusu: %12-30 bandının ürettiği coin sayısı (daha önce "16" olarak
akılda kalmıştı) bugüne mi özgü, yoksa yapısal mı? Ve %10-35 / %12-40 gibi
daha geniş bantlar nasıl performans gösteriyor?

## 1. "16 coin" rakamı düzeltmesi

Bu tarama (527 sembolün 526'sı sınıflandırıldı — sadece 1 hata/veri yok)
%12-30 bandında **65 coin (%12.4)** buldu, 16 değil. "16" rakamı muhtemelen
daha önceki, ban sinyaliyle erken kesilmiş kısmi bir taramadan (yalnızca
~290 coin sınıflandırılabilmiş bir çalıştırma) kalma bir izlenimdi. Bu
çalıştırma taramayı ban'a takılmadan sonuna kadar tamamladı — **65 coin
gerçek/güncel rakam**, önceki %12-30 raporundaki sayıyla (dokumentasyon/raporlar/2026-08-16-kom1-atr-band-evren-kapsami.md)
birebir tutarlı.

Yani mevcut filtre (%3-12, 408 coin) → %12-30'a geçişte kayıp **%84** (408→65),
"93%" değil — yine de büyük bir daralma, ama başta düşünülenden az.

## 2. Tam evren ATR dağılımı (526 coin, günlük ATR14/fiyat, son 30 gün)

| Persentil | ATR% |
|---|---|
| p5 | 2.74 |
| p10 | 3.15 |
| p25 | 4.16 |
| p33 | 4.66 |
| p50 (medyan) | 5.87 |
| p66 | 7.94 |
| p75 | 9.15 |
| p90 | 15.12 |
| p95 | 21.50 |
| p99 | 57.66 |

Ortalama %8.99, medyan %5.87 (ortalamanın altı → sağa çarpık dağılım, birkaç
aşırı-volatil coin ortalamayı yukarı çekiyor).

### Histogram

| Bant | Coin | % |
|---|---|---|
| %0-3 | 38 | 7.2 |
| %3-6 | 233 | 44.3 |
| %6-9 | 115 | 21.9 |
| %9-12 | 60 | 11.4 |
| %12-15 | 24 | 4.6 |
| %15-20 | 24 | 4.6 |
| %20-25 | 12 | 2.3 |
| %25-30 | 5 | 1.0 |
| %30-40 | 5 | 1.0 |
| %40-50 | 2 | 0.4 |
| %50-70 | 5 | 1.0 |
| %70-100 | 0 | 0.0 |
| %100-150 | 2 | 0.4 |
| %150-300 | 1 | 0.2 |

**Yorum — yapısal mı, güne mi özgü?** Dağılım tek-tepeli (unimodal) ve
monoton azalan bir sağa-çarpık kuyruk şeklinde — çoğu coin %3-9 aralığında
yığılmış, oradan itibaren düzgün biçimde azalarak seyrelen bir kuyruk var.
Bu, "sakin coinler" ve "sert coinler" diye ayrı iki küme (bimodal, ortada
boşluk) YOK demek — %12+ bölgesinin az coin içermesi bir anomali değil,
coin evreninin ATR dağılımının doğal kuyruğu. Tek bir günün ATR taramasıyla
"bugün piyasa sakin miydi" sorusuna kesin cevap veremeyiz (geçmiş günlerin
evren-geneli dağılımı elimizde yok, karşılaştırma yapılamıyor) — ama şeklin
düzgün/monoton olması, %12-30'un az coin içermesinin günlük bir dalgalanma
değil, volatilite dağılımının yapısal (log-normal benzeri) kuyruk-daralması
olduğuna işaret ediyor.

## 3. Geniş bant alternatifleri — mevcut point-in-time ATR backtest verisiyle (200 sinyal, `atr_backtest_results.json`)

Aynı sabit-ufuklu (+1sa/+4sa/+1g) backtest, aynı yöntem (sinyal anındaki
ATR14, look-ahead güvenli), farklı bant filtreleriyle:

| Bant | Evren kapsamı | Sinyal n | +1sa win/medyan | +4sa win/medyan | +1g win/medyan |
|---|---|---|---|---|---|
| mevcut %3-12 | 408 coin (%77.6) | 119 | %33.3 / -%0.24 | %39.1 / -%0.37 | %43.6 / -%0.32 |
| **%12-30** | 65 coin (%12.4) | 56 | %51.8 / +%0.22 | %62.5 / +%0.59 | %56.7 / +%0.52 |
| %10-35 | 100 coin (%19.0) | 66 | %48.5 / -%0.01 | %60.6 / +%0.46 | %52.9 / +%0.22 |
| %12-40 | 70 coin (%13.3) | 60 | %48.3 / -%0.07 | %58.3 / +%0.46 | %59.4 / +%0.71 |

(+1g örneklem tüm bantlarda 30-34 arası, düşük-örneklem eşiğinin (<10)
üzerinde ama yine de temkinli okunmalı; +1g ortalama getiriler tüm bantlarda
1-2 aşırı-negatif outlier'dan dolayı medyandan çok daha kötü — medyan daha
güvenilir gösterge.)

### Yorum

- **%12-30 hâlâ en güçlü sonuç** — 3 ufukta da en yüksek kazanma oranı ve
  medyan net getiri.
- **%10-35 ve %12-40, %12-30'u biraz daha fazla coin (66-70 vs 56 sinyal,
  70-100 vs 65 coin) karşılığında biraz seyreltiyor** — +1sa'da hafif negatife
  dönüyor, +4sa'da benzer ama biraz düşük, +1g'de %12-40 en iyisi çıkıyor
  (ama n=32, dikkatli okunmalı).
- Alt sınırı %10'a indirmek (%10-35) faydadan çok coin sayısını artırıyor
  gibi görünmüyor — asıl coin kazancı (%12-30'un 65'i → %10-35'in 100'ü,
  +35 coin) daha çok üst sınırı değil ALT sınırı düşürmekten geliyor, ve bu
  tam da performansın zayıfladığı yer.
- Üst sınırı %30'dan %40'a genişletmek (%12-40) neredeyse aynı coin sayısını
  (65→70) veriyor ve performans neredeyse aynı kalıyor — bu yönde genişleme
  daha "ucuz" (az risk, az coin kaybı/kazancı).

**Sonuç önerisi (üretime GİRMEDİ, kullanıcı onayı gerekiyor):** %12-30 mevcut
en iyi kanıtlanmış bant. Coin sayısını artırmak isteniyorsa %12-40 (70 coin,
+5 coin, performans kaybı minimal) %10-35'e (100 coin, daha belirgin
performans kaybı) göre daha iyi bir takas gibi görünüyor. Yine de tüm bu
sonuçlar tek bir nokta-zamanlı taramaya (bugünkü coin evrenine) dayanıyor —
Kom2 tarafında olduğu gibi burada da bir train/test veya farklı zaman
dilimlerinde tekrar doğrulama yapılmadan production kararı önerilmez.

## 4. Ayrı/bağımsız zaman penceresi kontrolü — VERİ YETERSİZ (2026-08-17)

Kullanıcı, %12-40'ı üretime koymadan önce yukarıdaki 200-sinyallik pencereden
BAĞIMSIZ, daha eski bir zaman diliminde de doğrulama istedi. Bunu araştırdım:

- Yukarıdaki 200 sinyalin ({backtest/kom2/data/kom1_signals_for_atr.json})
  kapsadığı gerçek tarih aralığı: **2026-08-14 13:40 → 2026-08-16 17:50 UTC,
  yaklaşık 2.3 gün.** Yani "200 sinyal" aslında geniş bir zaman dilimi değil,
  çok yoğun/kısa bir pencere.
- Bu veri `server.js`'teki `GET /api/kom1/signals` uç noktasından geliyor ve
  bu uç nokta `limit` parametresini **sunucu tarafında 200 ile sabitliyor**
  (`Math.min(parseInt(req.query.limit) || 50, 200)`, server.js:880) — daha
  fazla istense bile 200'ün ötesi dönmüyor. Bu limiti aşmak için MongoDB'ye
  (`Kom1SignalLog` koleksiyonu) doğrudan bağlanmayı denedim, ancak bu
  makinede `.env` dosyası / `MONGODB_URI` YOK — üretim veritabanına bu
  makineden doğrudan erişim mümkün değil.
- Sonuç: **elimde bağımsız, daha eski bir GERÇEK Kom1-sinyal penceresi yok**
  ve bu makineden şu an elde etme yolu da yok (ne API limiti aşılabiliyor ne
  de DB'ye erişim var).

**Alternatif (denenmedi, ekstra efor gerektirir):** Kom1'in gerçek geçmiş
sinyal kaydına değil, Kom1'in giriş kuralının (büyük TF tetikleyici + küçük
TF HA/DEMA9 onayı, `kom1-server-watcher.js`) ham fiyat verisi üzerinde
SENTETİK olarak yeniden üretilmesiyle daha eski bir dönem (ör. Haziran-Temmuz
2026) için bağımsız bir sinyal seti oluşturulabilir — klines'ın retention
sınırı yok. Bunun riski: Kom1'in gerçek canlı mantığını (tüm kenar
durumlarıyla) birebir yeniden üretmek gerekiyor, küçük bir sapma bile
sonuçları gerçek Kom1 davranışından farklılaştırabilir — bu yüzden şu ana
kadar yapılmadı, sadece bir seçenek olarak not düşüldü.

**Karar kullanıcıda:** Mevcut haliyle %12-40 bulgusu SADECE bu tek
~2.3 günlük pencereye dayanıyor; bağımsız bir zaman diliminde doğrulanmadı.
Kullanıcı bu riski bilerek kabul edip üretime koyma kararı verebilir, ya da
yukarıdaki sentetik-yeniden-üretim yaklaşımının yapılmasını isteyebilir
(ekstra efor + doğruluk riski var).
