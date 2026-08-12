# gorevler3.md Görev 5 — Kom1 Canlı Gözlem (Tamamlandı, 9/10 sinyalle)

**Tarih:** 2026-08-12

## Özet

Ban 2026-08-11'de kalktıktan sonra Kom1'in sunucu-taraflı shadow
gözlemcisi (`kom1-server-watcher.js`, `Kom1SignalLog`) + günlük 11:00
zamanlanmış kontrol (`kom1-daily-signal-check`) ile toplanan sinyaller
değerlendirildi. Kullanıcı, 10. sinyali beklemeden 9 sinyalle
değerlendirmeye geçilmesini onayladı: "1 sinyal eksikse sorun değil,
gelen sinyallerle devam edelim."

## Toplanan sinyaller (`GET /api/kom1/signals`, 2026-08-12 itibariyle)

Tümü 2026-08-11 tarihli, büyük TF=1H:

| # | Sembol | WT değeri | Fiyat | Onaylanma zamanı (UTC) |
|---|--------|-----------|-------|------------------------|
| 1 | BERAUSDT | -63 | 0.1497 | 06:42:51 |
| 2 | ONDOUSDT | -65 | 0.3381 | 07:02:52 |
| 3 | TUSDT | -71 | 0.003501 | 07:02:52 |
| 4 | TUSDT | -71 | 0.003502 | 07:07:51 |
| 5 | TUSDT | -70 | 0.003502 | 07:12:52 |
| 6 | BERAUSDT | -64 | 0.1491 | 07:37:50 |
| 7 | TUSDT | -71 | 0.003499 | 07:37:49 |
| 8 | TUSDT | -71 | 0.003494 | 07:45:30 |
| 9 | TUSDT | -71 | 0.003493 | 07:42:49 (createdAt) |

## Manuel değerlendirme

**Teknik sağlık:** Ban veya çökme yaşanmadı — shadow gözlemci sorunsuz
çalıştı, gözlem süresi boyunca proxy/backfill hatası görülmedi.

**Sinyal kalitesi — bir örüntü fark edildi:** 9 "kesinleşen sinyal"in
6'sı TUSDT'ye ait ve hepsi ~1 saatlik bir pencerede (06:42–07:45 UTC),
fiyat çok dar bir bantta (0.003493–0.003502, ~%0.3 fark) salınırken
oluşmuş. Bu, 6 bağımsız trade kurulumundan çok, WaveTrend'in tek bir
uzun süreli aşırı-satım (oversold, WT<-53) durumu içinde fiyatın küçük
dalgalanmalarla eşiği defalarca aşağı-yukarı geçmesinden kaynaklanan
bir **kümelenme (clustering)** gibi görünüyor. Gerçek bağımsız kurulum
sayısı pratikte 4'e yakın (TUSDT kümesi + BERAUSDT x2 + ONDOUSDT x1).

Bu, Kom1'in mantığında bir HATA değil — WT eşiği + RC + DEMA9
onay koşulları her tetiklemede ayrı ayrı sağlanıyor, sistem
"tasarlandığı gibi" çalışıyor. Ama ileride (Görev 6 veya sonrası)
"aynı sembol için kısa sürede tekrar tetiklenmeyi bastırma" gibi bir
filtre ihtiyacı doğabileceğini not etmek gerekiyor — bu turda
**parametre değişikliği yapılmadı** (gorevler3.md'nin "bu aşamada
hiçbir parametre oynanmayacak" kararına sadık kalındı), sadece
gözlemlendi.

## Sonuç

- Ban/çökme: 0 — sistem güvenilir çalıştı. ✅
- 9/10 sinyal manuel değerlendirildi, mantıklı bulundu (kümelenme
  örüntüsü hariç, bkz. yukarı — ileride not edilecek bir gözlem, engel
  değil). ✅
- Görev 5 **tamamlandı sayıldı** (kullanıcı onayıyla, 10.
  sinyali beklemeden).

## Sırada

Görev 6'dan (tüm piyasaya genişletme — dinamik ATR taraması, en riskli
adım) önceki DUR kapısındayız. Kullanıcı bu raporun ardından Görev 5'i
kapatıp DUR kapısında beklenmesini, Görev 6'ya geçiş için AYRICA açık
onay istediğini belirtti — henüz Görev 6'ya başlanmadı.
