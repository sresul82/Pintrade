# Kom2 Evren Taraması Sorunu + CloudFront Blok Olayı (2026-08-17/18 gecesi)

## Özet

Kom2 (OI-kalıcılık sinyal tarayıcısı) production'a deploy edildikten sonra
coin evrenini (ATR14≥%12 taraması, ~527 sembol) hiç tamamlayamadı — 4 ayrı
düzeltme denendi, her biri bir öncekinden daha temkinli hale getirdi ama
sorunu çözemedi. Son (4.) denemede, canlı sitenin GERÇEK kullanıcı-yüzü
proxy'sinin (`/api/binance/futures/klines`) de CloudFront'tan **403 "Request
blocked — too much traffic"** almaya başladığı doğrulandı — yani sorun artık
sadece Kom2'ye özgü değil, paylaşılan IP'nin kendisi engellenmiş durumda.
Bunun üzerine TÜM Kom2 debug/deploy döngüsü durduruldu.

## Kronoloji (UTC)

1. **~19:52** — Kom2 ilk kez deploy edildi (commit `c522723`). Evren taraması
   tek turda ~527 istek atıyordu, tempo yavaş olsa da (120ms) ban tetikledi.
2. **~20:45** — Backoff düzeltmesi deploy edildi (`681bc19`): ban/başarısız
   denemede de `_lastUniverseRefresh` damgalanıp 24 saatlik bekleme
   uygulanıyor. Sonsuz 5-dakikalık yeniden-deneme döngüsü durduruldu — ama
   evren hâlâ dolmadı (tek deneme yine banlandı).
3. **~21:53** — Tick-başına-parçalama deploy edildi (`ebc72a9`): 527 istek
   tek turda değil, tick başına 40 sembol, ~14 tick'e (~70dk) yayıldı. Yine
   ban (ONTUSDT'de, kullanıcı ekran görüntüsüyle doğruladı).
4. **~23:35** — Grup+bekleme deploy edildi (`f8e3589`): chunk kendi içinde
   20'lik gruplara bölündü, gruplar arası 1.5sn bekleme eklendi. Lokal test
   (30 gerçek sembol, ONTUSDT dahil) sıfır ban ile geçti. **Production'da
   yine ban** — deploy'dan ~74 saniye sonra, tick'in başladığı an.
5. **~23:47** — Teşhis alanları eklendi (`1e8be53`): `/api/kom2/status`'a
   `scan.active/processed/totalSymbols`, `lastError.message/at`,
   `nextAttemptAt` eklendi — artık Render log görüntüleyicisine (güvenilir
   çalışmadığı tespit edildi) bağımlı kalınmadan teşhis mümkün.
6. **~23:49** — Bu teşhisle, ban'ın deploy'dan ~74sn sonra, tick başlar
   başlamaz, İLK sembolde geldiği doğrulandı (`BAN_SIGNAL_418`).
7. **~23:52** — Tick gecikmesi 75sn'den 185sn'ye çekildi, grup boyutu
   20'den 10'a küçültüldü, bekleme 1.5sn'den 3sn'ye çıkarıldı (`1a6a861`).
8. **~23:55** — Yine ban — bu sefer **`BAN_SIGNAL_418 (BTCUSDT,
   0/527 sembol işlenmişken)`** — yani taramanın DAHA İLK isteğinde,
   deploy'dan 185 saniye sonra bile. Bu, sorunun artık Kom2'nin kendi istek
   temposu/zamanlamasından bağımsız olduğunu, IP'nin o anda ZATEN
   engellenmiş/sınırlanmış olduğunu gösteriyor.
9. **~00:41** — Canlı proxy testi (`/api/binance/futures/klines`, gerçek
   chart kullanıcılarının kullandığı YOL) **CloudFront'tan 403 "Request
   blocked... too much traffic"** döndürdü. Bu, sorunun Kom2'nin kendi
   ATR taraması ile sınırlı olmadığını, paylaşılan IP'nin CloudFront/Binance
   tarafında fiilen engellendiğini doğruluyor. **Bu noktada TÜM Kom2
   debug/deploy döngüsü durduruldu** — devam etmek engeli uzatabilir/
   ağırlaştırabilir (bkz. 2026-08-08'deki 11 saatlik ban olayı, CLAUDE.md
   "bot-architecture" notu).

## Kök neden değerlendirmesi (kesinleşmemiş, ama en olası açıklama)

Tek bir sebep değil, muhtemelen kümülatif: bu gece kısa aralıklarla **6+ kez
production'a deploy edildi** (her Kom2 düzeltmesi tam bir server restart'ı
gerektirdi). Her restart:
- Kom1'in tick'ini de sıfırdan başlattı (kendi "sırası gelen sembol"
  taramasıyla),
- `collectBinanceData`/`collectBybitData`/`collectLSData` gibi diğer
  toplayıcıları da sıfırdan başlattı,
- Kom2'nin kendi (o ana kadarki denemelerde hâlâ ağır olan) evren taramasını
  da tetikledi.

Bu kadar sık restart, "aynı anda başlayan birden fazla toplayıcı" durumunu
sürekli yeniden yarattı — normalde 5 dakikada bir olması gereken bu çakışma,
her redeploy'da yeniden sıfırdan tetiklendi. Kümülatif istek hacmi, Binance/
CloudFront'un IP'yi geçici olarak engellemesine yol açmış olabilir. Son
düzeltmedeki "0/527, ilk istekte ban" bulgusu, bu noktada IP'nin ZATEN
engelli olduğunu (yeni bir çakışma değil, önceden var olan bir blok)
destekliyor.

**Önemli ders:** Bir ban/rate-limit sorununu "düzeltmeye çalışırken" sık sık
redeploy etmek, sorunu çözmek yerine KÖTÜLEŞTİREBİLİR — her redeploy yeni bir
istek patlaması demektir. Bu gece tam olarak bu tuzağa düşüldü.

## Şu anki durum (2026-08-18 00:41 UTC itibarıyla)

- **Kom2**: evren hâlâ boş (`total:0`), son deneme banlandı, bir sonraki
  otomatik deneme ~24 saat sonra (mevcut backoff kuralı). Sinyal üretmiyor
  ama bu zaten soğuk-başlangıç nedeniyle bekleniyordu — ek bir zarar yok.
- **Kom1**: `/api/kom1/status` yanıt veriyor (bellekten, `total:527`) ama bu
  Kom1'in KENDİ canlı Binance isteklerinin şu an başarılı olduğunu KANITLAMIYOR
  — CloudFront blok'u muhtemelen Kom1'in tick'ini de etkiliyor, sessizce
  (Kom1'de Kom2'deki gibi bir `lastError` teşhis alanı yok).
- **Canlı chart/proxy** (`/api/binance/futures/*`, kullanıcıların gerçek
  kullanım yolu): CloudFront 403 ile engelleniyor. Bu, kullanıcı deneyimini
  etkileyebilir (chart/mum verisi yüklenemeyebilir) — kalıcı değilse
  (CloudFront blokları genelde dakikalar-saatler içinde kendiliğinden
  açılır) kendiliğinden düzelmesi beklenir.

## Alınan aksiyon

Daha fazla Kom2 düzeltmesi/deploy'u DURDURULDU. Kom1'e hiç dokunulmadı
(kullanıcının önceliği zaten buydu). Yeni bir istek atılmadı (blok'u
uzatmamak için). Kullanıcı sabah uyandığında bu raporla birlikte kısa bir
özet mesajı görecek.

## Önerilen sonraki adımlar (kullanıcı onayı gerekiyor, otomatik yapılmadı)

1. **Beklemek** — CloudFront/Binance blok'unun kendiliğinden açılıp
   açılmadığını birkaç saat sonra `/api/binance/futures/klines` testiyle
   kontrol et (bu rapor içindeki curl komutuyla).
2. Blok açıldıktan SONRA, Kom2'nin evren taramasını manuel tetiklemenin bir
   yolu yok şu an (backoff 24 saat) — istenirse `UNIVERSE_REFRESH_MS`'i
   geçici olarak kısaltıp TEK bir kontrollü deneme yapılabilir, ama bu YENİ
   bir deploy demek — blok tamamen açıldığından emin olunmadan YAPILMAMALI.
3. Uzun vadede: Kom2'nin evren taramasını, her redeploy'da sıfırdan
   başlamak yerine Mongo'da kalıcı bir "son tamamlanmış tarama" listesi
   olarak saklamak (yeni bir alan, `Kom2ScanState`'e benzer) — böylece bir
   redeploy, tamamlanmış bir evrenin sıfırdan taranmasını GEREKTİRMEZ, sadece
   restart-tetikli istek patlaması riski büyük ölçüde azalır. Bu turda
   yapılmadı, kapsam dışı bırakıldı.
4. Bu gecenin "sık redeploy = kümülatif risk" dersi ileride `.claude/CLAUDE.md`
   "bot-architecture" bölümüne eklenmeyi hak ediyor — kullanıcı onayıyla.

## Blok takibi (pasif, sık istek atılmadan)

- **00:41 UTC** — İlk doğrulama: `/api/binance/futures/klines` → CloudFront 403.
- **01:22 UTC** (45dk sonra, tek kontrol) — Hâlâ 403.
- **02:53 UTC** (~90dk sonra, tek kontrol) — Hâlâ 403. `/health` sorunsuz
  (server ayakta, DB bağlı, uptime ~3 saat — restart yok), sadece Binance
  proxy yolu engelli. ~2 saat 12 dakikadır blok sürüyor — 2026-08-08'deki
  11 saatlik olayla tutarlı bir süre aralığında, henüz açılmadı.
- Bundan sonra gece boyunca aktif/sık kontrol YAPILMAYACAK (blok'u
  uzatmamak için) — kullanıcı sabah uyandığında son durumu tek bir kontrolle
  netleştireceğim.

## Değiştirilen dosyalar (bu gece, hepsi push edildi)

- `js/screener/kom2-server-watcher.js` — backoff, tick-başına-parçalama,
  grup+bekleme, teşhis alanları (4 ayrı commit).
- `server.js` — Kom2 collector/tick gecikmesi 45000/50000 → 70000/75000 →
  180000/185000ms.

Son commit: `1a6a861` (tick gecikmesini 185sn'ye çekme + grup küçültme).
