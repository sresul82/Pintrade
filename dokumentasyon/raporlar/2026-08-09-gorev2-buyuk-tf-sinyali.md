# gorevler3.md Görev 2 — Büyük TF Sinyali (1H/4H: RC + WaveTrend) (Tamamlandı)

**Tarih:** 2026-08-09

## Kapsam

Sadece büyük TF (1H/4H) tespiti — kural sağlandığında sonucu bir Map'te
tutar (`_pending`), henüz Watchlist/alarm'a yazmaz (Görev 4), henüz 5dk
onayını kontrol etmez (Görev 3).

## Yeni dosya — `js/screener/kom1-scanner.js`

M1HammerScanner'ın mimari örüntüsüyle birebir aynı: `BotEngine.
queueRestRequest()` ile tek seferlik backfill (11 coin × 2 TF = 22
istek), sonra `MarketDataStore.subscribeKlines()` paylaşılan WS'i —
kendi ayrı fetch/WS döngüsü açmıyor.

**Kural (her yeni kapanan 1H/4H bar'da):**
- `IndicatorEngine.calcRegressionChannel(closes, 100)` → `rc.mid`
- `IndicatorEngine.calcWT(hlc3)` → `wt.dir === 'bull'` VE `wt.prev < -53`
- `price <= rc.mid`

Üçü birden sağlanırsa `_pending` Map'ine yazılır: `{ symbol, bigTf,
direction, rcMid, wtVal, wtPrev, price, firedAtBarCount,
expiresAtBarCount, firedAt }`. `expiresAtBarCount = firedAtBarCount +
TOLERANCE_BARS(3)` — Görev 3'ün 5dk onay penceresi bu alanı kullanacak.
Her yeni final bar geldiğinde `_sweepExpired()` süresi geçmiş (3 büyük
TF barı içinde onay gelmemiş) kayıtları temizler.

`getPendingSignals()` dışa açık — basit test/gözlem arayüzü (görev
talimatındaki "konsola/basit bir test arayüzüne logla" isteği).

## `js/screener/indicator-engine.js` küçük genişletme

`calcWT`'nin dönüş değerine `prev` alanı eklendi (önceki bar'ın WT1
değeri, yuvarlanmış) — Kom1'in "önceki bar oversold muydu" (`WT1 < -53`)
kontrolü için gerekliydi, `calcWT` öncesinde sadece `val`/`dir`
döndürüyordu. **Geriye uyumlu** — M1Hammer'ın `calcWT` kullanımı
sadece `.val` okuyor (grep ile doğrulandı), yeni alan onu etkilemedi.

`index.html`'e `kom1-scanner.js` eklendi (`indicator-engine.js` ve
`m1hammer-scanner.js`'den sonra) — **henüz `start()` çağrılmıyor**,
sadece modül tanımlı, sonraki görevlerde (test/entegrasyon) tetiklenecek.

## Doğrulama (tarayıcıda, gerçek modüllerle, `IndicatorEngine` kontrollü mock'landı)

`_checkBigTF`'in gerçek indikatör matematiğinden bağımsız olarak
**karar mantığının** doğru çalıştığını izole test etmek için
`IndicatorEngine.calcRegressionChannel`/`calcWT` geçici olarak sabit
değerler döndürecek şekilde override edildi (gerçek matematik zaten
Görev 1'de ayrıca doğrulanmıştı):

1. **Pozitif senaryo:** `rc.mid` çok yüksek (fiyat hep altında kalsın) +
   `wt.dir='bull'` + `wt.prev=-60` (< -53 eşiği) → **22/22 kombinasyon**
   (11 coin × 2 TF) `_pending`'e yazıldı. ✅
2. **Negatif senaryo:** `rc.mid` çok düşük (fiyat hep üstünde kalsın),
   diğerleri aynı → **0/22** pending — fiyat koşulu tek başına yeterli
   olmadığında sinyal ateşlenmedi. ✅
3. **Konsol hataları:** Testler sırasında görülen hatalar (`ScreenerCore
   exchangeInfo: symbols dizisi yok`, `502`) testin kendi `fetch` mock'unun
   yan etkisi (mock, ScreenerCore'un exchangeInfo isteğini de yakalayıp
   yanlış format döndürdü) — `Kom1Scanner`/`IndicatorEngine`'e özgü
   hiçbir hata/uyarı yok.

**Not — test edilmeyen kısım:** `_sweepExpired`'ın canlı bar akışıyla
(gerçek `MarketDataStore.subscribeKlines` callback'i üzerinden, birden
fazla final bar simülasyonuyla) uçtan uca pencere kapanmasını tetiklediği
bu turda ayrıca test edilmedi — mantığı basit bir sayısal karşılaştırma
(`barCount > expiresAtBarCount`), kod okumasıyla doğruluğu teyit edildi.
Görev 3, 5dk onay penceresini eklerken bu mekanizmayı zaten fiilen
kullanacağı için orada daha kapsamlı test edilecek.

## Regresyon

- M1HammerScanner'a dokunulmadı (ayrı dosya, ayrı sembol kümesi, ayrı
  buffer'lar — `_buf`/`_pending` Map'leri Kom1Scanner'a özel).
- `calcWT`'nin `prev` alanı eklenmesi M1Hammer'ı etkilemedi (yukarıda
  doğrulandı).

## Değişen dosyalar

- `js/screener/kom1-scanner.js` (yeni)
- `js/screener/indicator-engine.js` (`calcWT`'ye `prev` alanı eklendi)
- `index.html`
