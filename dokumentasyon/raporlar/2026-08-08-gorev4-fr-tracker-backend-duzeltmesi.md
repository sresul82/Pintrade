# Görev 4 — fr-tracker.js'in Yanlış Backend'e Gitmesi (Tamamlandı)

**Tarih:** 2026-08-08

## Sebep

`fr-tracker.js` ve birkaç başka dosyada, `AppConfig` yüklenemezse diye
bırakılmış **fallback** URL'ler, tamamen ölü/eski adreslere işaret ediyordu.
`AppConfig.API.binance.restFutures`'ün kendisi zaten Görev'den önceki
düzeltmeyle (bkz. `2026-08-08` app-config.js commit'i) `pintrade-uwg9`'a
güncellenmişti, ama bu **fallback string'ler** unutulmuştu.

## Bulunanlar ve düzeltilenler

`grep -rn "pintrade\.onrender\.com\|onrender\.com" js/` ile tüm proje
tarandı, 6 yer bulundu (hepsi normal akışta `AppConfig` zaten yüklü
olduğu için tetiklenmeyen, ama `AppConfig` başarısız olursa devreye
girecek kırılgan fallback'ler):

| Dosya | Eski (ölü) fallback | Yeni |
|---|---|---|
| `js/screener/fr-tracker.js:264` (preloadSignals) | `'https://pintrade.onrender.com'` | `'https://pintrade-uwg9.onrender.com'` |
| `js/screener/fr-tracker.js:460` (sinyal POST) | `'https://pintrade.onrender.com'` | `'https://pintrade-uwg9.onrender.com'` |
| `js/data/chart-data.js:617` | `'https://pintrade.onrender.com/api/binance/futures'` | `'https://pintrade-uwg9.onrender.com/api/binance/futures'` |
| `js/data/market-data-store.js:169` (OI poller) | aynı | aynı düzeltme |
| `js/data/ls-data-store.js:94` (`_restBase`) | aynı | aynı düzeltme |
| `js/screener/m1hammer-scanner.js:154` | `'https://fapi.binance.com/api/binance/futures'` (host+path karışık, tamamen geçersiz bir URL — proxy path'i yanlışlıkla ham Binance host'una eklenmiş) | `'https://pintrade-uwg9.onrender.com/api/binance/futures'` |

Son madde (`m1hammer-scanner.js`) görev metninde belirtilenden farklı bir
hata ama **aynı sınıf** — "kırılgan fallback örüntülerine de uygula"
talimatı gereği kontrol edilip düzeltildi.

## Doğrulama

- `node -c` ile 5 dosyanın tamamının syntax'ı doğrulandı.
- Tarayıcıda site açılıp konsol tarandı: `CORS`, `pintrade.onrender.com`
  veya `fapi.binance.com/api` geçen hiçbir hata/uyarı yok.
- Görülen tüm hatalar (`ScreenerCore`, `chart-data.js` — `Failed to fetch` /
  `HTTP 502`) bu sandbox'ın önceden bilinen ağ kısıtından (Node işleminin
  dış DNS erişiminin engelli olması), değişiklikle ilgisi yok — aynı
  hatalar bu düzeltmeden ÖNCE de aynı şekilde görülüyordu.

**Not:** Bu fallback'ler normal koşulda hiç tetiklenmiyor çünkü
`app-config.js` her zaman ilk yüklenen script (`index.html`'de en üstte).
Yani bu düzeltme ölçülebilir bir davranış değişikliği yaratmadı — sadece
`AppConfig` bir şekilde başarısız olursa (örn. gelecekte script sırası
bozulursa) devreye girecek bir savunma hattını güncel tuttu.

## Regresyon

Yok — fallback path'ler zaten tetiklenmiyordu, sadece string değeri
güncellendi.

## Değişen dosyalar

- `js/screener/fr-tracker.js`
- `js/data/chart-data.js`
- `js/data/market-data-store.js`
- `js/data/ls-data-store.js`
- `js/screener/m1hammer-scanner.js`
