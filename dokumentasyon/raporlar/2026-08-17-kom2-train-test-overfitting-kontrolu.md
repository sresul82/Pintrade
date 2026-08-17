# Kom2 OI-Kalıcılık Grid — Train/Test Overfitting Kontrolü

Veri kronolojik olarak bölündü: **train** = 2026-07-20 20:05:00+00:00 → 2026-08-08 19:01:30+00:00 (%70), **test** = 2026-08-08 19:01:30+00:00 → 2026-08-16 22:00:00+00:00 (%30). 72 kombinasyonun TAMAMI sadece train'de sıralandı, en iyi 3 kombinasyon (parametre DEĞİŞTİRİLMEDEN) test'te çalıştırıldı.

Train satır sayısı: 422223, Test satır sayısı: 249038

## Train'de en iyi 3 — Test'te nasıl davranıyor?

| Sıra | Combo (eşik,gün,pullback,ls) | Ufuk | TRAIN n | TRAIN Kazanma | TRAIN Medyan Net | TEST n | TEST Kazanma | TEST Medyan Net |
|---|---|---|---|---|---|---|---|---|
| 1 | `(25, 7, 10, 'global_below_1')` | +1sa | 581 | %57.3 | %+0.43 | 331 | %54.4 | %+0.26 |
| 1 | `(25, 7, 10, 'global_below_1')` | +4sa | 581 | %59.2 | %+1.20 | 328 | %51.8 | %+0.03 |
| 1 | `(25, 7, 10, 'global_below_1')` | +1g | 581 | %44.6 | %-1.56 | 304 | %49.0 | %-0.49 |
| 2 | `(20, 7, 10, 'global_below_1')` | +1sa | 664 | %55.3 | %+0.25 | 457 | %54.3 | %+0.40 |
| 2 | `(20, 7, 10, 'global_below_1')` | +4sa | 664 | %59.5 | %+1.08 | 454 | %55.1 | %+0.49 |
| 2 | `(20, 7, 10, 'global_below_1')` | +1g | 664 | %43.7 | %-1.79 | 392 | %52.3 | %+0.27 |
| 3 | `(15, 7, 10, 'global_below_1')` | +1sa | 739 | %53.6 | %+0.05 | 545 | %54.1 | %+0.14 |
| 3 | `(15, 7, 10, 'global_below_1')` | +4sa | 739 | %58.7 | %+0.83 | 537 | %56.4 | %+0.63 |
| 3 | `(15, 7, 10, 'global_below_1')` | +1g | 739 | %44.8 | %-1.33 | 480 | %56.5 | %+1.47 |

## Yorum

Test sütunundaki medyan net getiri, train'e YAKIN kalıyorsa bulgu muhtemelen gerçek (overfitting değil). Test'te ÖNEMLİ ÖLÇÜDE düşüyorsa veya işaret değiştiriyorsa, train sonucu 72 kombinasyondan 'en iyisini seçmiş olmanın' (data-snooping) bir ürünü olabilir — bu durumda production kararı ERTELENMELİ.

## Sentez (2026-08-17, sonuç değerlendirmesi)

**#1 (eşik=%25) — klasik overfitting örneği:** Train'de en iyi görünen kombinasyon
(+4h medyan %+1.20) test'te neredeyse sıfıra düşüyor (%+0.03, n=328) — işaret
aynı kalıyor ama pratik olarak anlamsızlaşıyor. "72 kombinasyondan en iyisini
seçmenin" tam olarak beklendiği gibi ürettiği bir sonuç — bu kombinasyon
production'a ASLA bu haliyle konulmamalı.

**#2 (eşik=%20, gün=7, pullback=%10, ls=global_below_1) — orijinal "manşet"
kombinasyon:** Train +4h medyan %+1.08 → test %+0.49 (n=454, düşük-örneklem
eşiğinin çok üzerinde). Düşüş belirgin (~%55 rölatif azalma) ama işaret
DEĞİŞMİYOR, hâlâ anlamlı pozitif. +1sa ufkunda test train'den DAHA İYİ
(%+0.40 vs %+0.25) — bu, saf overfitting değil, gerçek ama train'de biraz
şişirilmiş bir etkiye işaret ediyor.

**#3 (eşik=%15, gün=7, pullback=%10, ls=global_below_1) — en sağlam:** Train
+4h %+0.83 → test %+0.63 (n=537) — üçü arasında en KÜÇÜK düşüş. +1sa'da da
test train'e yakın/hafif üstün (%+0.14 vs %+0.05). Bu kombinasyon, train'de
#2/#1'den daha düşük görünmesine rağmen out-of-sample en TUTARLI davranan.

**+1g (günlük) ufku tutarsız/gürültülü** her üç kombinasyonda da (işaret
değişimleri var) — bu ufuktaki sonuçlara güvenilmemeli, +1sa/+4h daha
güvenilir.

**Önemli bağlam:** Bu train/test SADECE OI-kalıcılık yolunu (divergence'sız)
test etti — ana raporun ("kom2-backtest-sonuclari.md") manşet rakamı olan
"+4h %+0.32" ise divergence + OI-kalıcılık'ın BİRLEŞTİRİLMİŞ halinden
geliyordu. Saf OI-kalıcılık yolu izole edildiğinde çok daha güçlü çıkıyor
(#2: train %+1.08/test %+0.49) — divergence yolunun (kendi başına tüm
lookback'lerde negatif olduğu zaten biliniyordu) birleşik sinyali
SEYRELTTİĞİ/aşağı çektiği anlaşılıyor.

**Sonuç önerisi:** #1 (eşik=%25) kesinlikle elenmeli — saf data-snooping.
#2 ve #3, özellikle #3, +1sa/+4h ufuklarında train/test arasında makul bir
tutarlılık gösteriyor ve production değerlendirmesi için #1'den çok daha
güvenilir adaylar — ama yine de TEK bir 27 günlük pencerenin (train 20
gün + test 8 gün) train/test ayrımına dayanıyor, daha uzun/başka bir
dönemde tekrar doğrulanmadan tam güvenilir sayılmamalı. Divergence yolunun
sinyali seyreltmesi nedeniyle, üretime gidilecekse SADECE OI-kalıcılık
yolunun (#2 veya #3) kullanılması, "birleşik" (divergence+OI) yoldan daha
mantıklı görünüyor.
