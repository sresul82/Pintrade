# gorevler3.md Görev 3 — 5 Dakikalık Onay Penceresi (Tamamlandı)

**Tarih:** 2026-08-09

## Kapsam

Görev 2'de "büyük TF sinyali ateşlendi" durumu olan coinler için, sadece
o an 5dk kline stream'ine hedefli abone olunması, Heikin Ashi + DEMA9
onay kuralının kontrol edilmesi, ve TOLERANCE_BARS penceresi kapanınca
(onay gelmeden) hem pending kaydının hem 5dk aboneliğinin temizlenmesi.

## `js/screener/kom1-scanner.js` genişletmesi

- **Hedefli 5dk abonelik** (`_ensureSmallTFSubscription`): bir coin+bigTf
  `_pending`'e ilk kez eklendiğinde, o coin için (henüz aktif değilse)
  kısa bir backfill (`SMALL_TF_BARS=40`, BotEngine kuyruğu üzerinden) +
  `MarketDataStore.subscribeKlines(sym, '5m', ...)` tetiklenir. Aynı
  coin'in hem 1H hem 4H'i aynı anda pending olabilir — 5dk aboneliği
  coin başına tek (Set ile tekilleştirildi), TF başına değil.
- **Onay kontrolü** (`_checkSmallTFConfirmation`): her yeni final 5dk
  bar'da `IndicatorEngine.calcHeikinAshi` + `calcDEMA(9)` çağrılır.
  `ha.haClose >= ha.haOpen && ha.haClose > dema9` sağlanırsa, o coin için
  pending olan **TÜM** büyük TF girişleri (1H ve/veya 4H) tek seferde
  onaylanıp `_confirmed` listesine taşınır, `_pending`'den silinir.
- **Hedefli abonelik kapatma** (`_releaseSmallTFSubscription`): bir coin
  için onay geldiğinde VEYA son pending'i de süresi dolup silindiğinde
  (`_sweepExpired` içine eklendi), o coin için başka pending kalmadıysa
  5dk aboneliği (`MarketDataStore.unsubscribeKlines`) kapatılır — kalıcı
  değil, mimari karar (gorevler3.md "iki katmanlı tarama").
- `stop()` artık açık kalmış tüm 5dk aboneliklerini de temizliyor
  (sızıntı koruması, M1Hammer'ın `stop()` örüntüsüyle tutarlı).
- Yeni dışa açık `getConfirmedSignals()`.

## Doğrulama (tarayıcıda, gerçek modüllerle — `IndicatorEngine` + `MarketDataStore.subscribeKlines/unsubscribeKlines` + `BotEngine.queueRestRequest` kontrollü mock'landı)

**Not — test ortamı bulgusu:** İlk denemelerde `M1HammerScanner`'ın
sayfa açılışında otomatik başlayıp aynı paylaşılan `BotEngine` kuyruğunu
(40 istek, gerçek ağa gidiyor, sandbox'ta yavaş) meşgul ettiği ortaya
çıktı — bu, Kom1Scanner'ın kendi backfill'inin çok geç tamamlanmasına
yol açtı (kod hatası değil, paylaşılan kaynak/test ortamı etkileşimi).
`BotEngine.queueRestRequest`'i de geçici olarak bypass ederek (`fn()`)
testi izole edip hızlandırdım.

1. **Ateşleme + hedefli abonelik açılışı:** Büyük TF koşulu tüm 11 coin
   için "sağlanıyor" mock'landı → `pending: 22` (11×2), **`smallCallbacks: 11`**
   — coin başına tam bir 5dk aboneliği (22 değil, doğru tekilleştirme). ✅
2. **Onay YOK senaryosu:** ONDOUSDT'ye kırmızı HA mumu (`haClose<haOpen`)
   ile sahte final 5dk bar gönderildi → `pending` değişmedi (`ondoStillPending:2`,
   hem 1h hem 4h hâlâ bekliyor), `confirmed:0`. ✅
3. **Onay VAR senaryosu:** Aynı coin'e yeşil HA mumu (`haClose>haOpen`,
   `haClose>dema9`) ile tekrar tetiklendi → **hem 1h hem 4h girişi aynı
   anda** `_confirmed`'e taşındı (doğru `haOpen/haClose/dema9/confirmedAt`
   alanlarıyla), `pending` 22→20'ye düştü, **`ondoSmallStillActive:false`**,
   **`unsubCalledFor` içinde `ONDOUSDT_5m`** — hedefli abonelik doğru
   kapatıldı. ✅
4. **Pencere süresi dolma senaryosu:** STRKUSDT için yeni sinyal
   ateşlenmesin diye RC koşulu "sağlanmıyor" yapıldı, mevcut pending'in
   büyük TF bar'ı `TOLERANCE_BARS(3)`'ü aşacak şekilde (4 final bar) elle
   tetiklendi → `beforeCount:2 → afterCount:0` (onay gelmeden pencere
   kapandı, iptal edildi), **`smallStillActive:false`**, `unsubCalledFor`
   içinde `STRKUSDT_5m` de eklendi. ✅
5. **Konsol hataları:** Görülen tüm hatalar (`ScreenerCore exchangeInfo`)
   testin kendi `fetch` mock'unun yan etkisi — `Kom1Scanner`/
   `IndicatorEngine` ile ilgisi yok.

## Regresyon

- M1HammerScanner'a dokunulmadı.
- Görev 2'nin büyük TF mantığı (`_checkBigTF`, `_sweepExpired`)
  değişmedi, sadece ateşleme anında `_ensureSmallTFSubscription`
  çağrısı eklendi ve pencere kapanmasında `_releaseSmallTFSubscription`
  eklendi.

## Değişen dosyalar

- `js/screener/kom1-scanner.js`
