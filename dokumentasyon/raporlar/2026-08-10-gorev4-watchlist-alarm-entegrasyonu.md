# gorevler3.md Görev 4 — Watchlist Kom1 Grubuna Yazma + Alarm Bildirimi (Tamamlandı)

**Tarih:** 2026-08-10

## Kapsam

Görev 3'te "Long sinyali kesinleşti" olan coinlerin gerçek Kom1Scanner
çıktısıyla Watchlist'in "Sinyaller" listesindeki `kom1` grubuna ve alarm
sekmesine yazılması. Kom2/Kom3'ün demo kartlarına dokunulmadı.

## Kullanıcı kararı — sinyal aktiflik süresi

Görevin kendi metni, "aktiflik" ne zaman biter sorusu belirsizse tahmin
yürütmeden DUR deyip sormayı zorunlu kılıyordu. Kullanıcıya soruldu, cevap:
**mevcut 24 saatlik "Old" eşiğiyle aynı kural kullanılsın** (yeni bir eşik
icat edilmedi). Kullanıcı ayrıca not düştü: bu geçici bir karar — ileride
sinyal önerisi + geri ölçüm işi (`gorevler2.md` Görev 6) tasarlanınca fiyat
hedefi/stop bazlı bir "aktiflik" kuralına geçilecek. Bu TODO,
`js/screener/alarm-signal-history.js`'de `_kom1LiveSignals()`'ın üstüne
yorum olarak eklendi.

## Değişiklikler

### `js/screener/alarm-signal-history.js`

- Yeni `_kom1LiveSignals()`: `Kom1Scanner.getConfirmedSignals()`'ı okuyup
  her girişi kart formatına (`symbol, kom:1, exchange:'binance', timestamp,
  priceChangePct, chips[], rule`) çeviriyor.
  - `priceChangePct`: `MarketDataStore.getTicker(symbol)`'dan anlık fiyat
    alınıp sinyalin tetiklendiği fiyata (`entry.price`) göre hesaplanıyor
    (ticker yoksa 0).
  - `chips`: Büyük TF, RC_mid, WT1 (önceki→şimdiki), HA Close, DEMA9.
  - `rule`: büyük TF + küçük TF kuralını özetleyen tek satır.
- Yeni `_kom23DemoSignals()`: `_demoSignals()`'tan sadece `kom !== 1`
  kayıtları döner (Kom1'in eski demo kartları — STRKUSDT, uzun-isim taşma
  testi, eski TIAUSDT — artık gerçek veriyle değiştiği için süzülüyor,
  ama `_demoSignals()` fonksiyonunun kendisi silinmedi, sadece Kom1 kayıtları
  bu yeni fonksiyonla filtreleniyor).
- Yeni `_allSignals()`: `[..._kom1LiveSignals(), ..._kom23DemoSignals()]`.
- `getActiveSignals()` ve `_getFilteredSignals()` artık `_demoSignals()`
  yerine `_allSignals()` okuyor.
- Modül yüklenirken (bir kere) `EventBus.on('kom1:signalConfirmed', ...)`
  kaydediliyor: `Toast.show('Kom1 listesine XUSDT eklendi', 'success')` +
  (alarm sekmesi açıksa) `render()` + `EventBus.emit('watchlist:listsChanged')`
  (Watchlist'in Sinyaller grubu tazelensin diye).

### `js/screener/kom1-scanner.js`

- `_checkSmallTFConfirmation()` içinde, bir sinyal `_confirmed`'e taşınınca
  `EventBus.emit('kom1:signalConfirmed', { symbol, bigTf, confirmedAt })`
  eklendi.
- Dosya başlığındaki "henüz Watchlist/alarm'a yazmaz (Görev 4)" notu
  güncellendi.

### `js/screener/detail-panel.js`

- `M1HammerScanner.start()`'ın hemen altına `Kom1Scanner.start()` eklendi —
  motor artık gerçekten canlıya alındı (önceden sadece script olarak
  yükleniyordu, hiç `start()` edilmiyordu).

## Doğrulama (tarayıcıda, gerçek modüllerle — sadece `Kom1Scanner.getConfirmedSignals` mock'landı)

1. **Kom1 gerçek veri, Kom2/Kom3 demo korunuyor:** `Kom1Scanner.getConfirmedSignals`
   sahte bir ONDOUSDT (1H) sinyali dönecek şekilde mock'landı →
   `AlarmSignalHistory.getActiveSignals()` → `[{ONDOUSDT,kom:1},{BANKUSDT,kom:2},{ARXUSDT,kom:3}]`,
   `WatchlistStore.getSignalGroups()` → kom1 grubu `["ONDOUSDT"]`, kom2
   grubu `["BANKUSDT"]` (değişmedi), kom3 grubu `["ARXUSDT"]` (değişmedi). ✅
2. **Alarm sekmesi kartı:** `rsb-alarms` sekmesi açılıp `kom1:signalConfirmed`
   event'i tetiklendi → `Toast.show` `"Kom1 listesine ONDOUSDT eklendi"`
   (`success`) ile çağrıldı, `.kom-alarm-card[data-symbol="ONDO"]` DOM'da
   doğru chip'lerle (Büyük TF, RC_mid, WT1, HA Close, DEMA9) render edildi,
   ekran görüntüsüyle görsel olarak da doğrulandı — BANKUSDT (Combo 2) ve
   ARXUSDT (Combo 3) kartları eskisi gibi duruyor. ✅
3. **Watchlist Sinyaller listesi:** `rsb-watchlist` sekmesi açılıp
   `WatchlistStore.getSignalGroups()` tekrar okundu → aynı sonuç (kom1:
   ONDOUSDT). ✅

## Regresyon

- `_demoSignals()` fonksiyonu silinmedi/değiştirilmedi — Kom2/Kom3 kartları
  (BANKUSDT, ARXUSDT) ve eski TIAUSDT (kom2, "Old" test kartı) hâlâ aynı
  veriyle geliyor.
- M1HammerScanner'a dokunulmadı.
- Kom1'in eski demo kartları (STRKUSDT, uzun-isim taşma testi,
  eski/"Old" TIAUSDT-kom1) artık listede görünmüyor — bilinçli, çünkü
  görev metni Kom1'in gerçek veriyle değişmesini istiyordu. Bu, o demo
  kartların test ettiği görsel senaryoları (çok uzun coin adı taşması,
  "Old" soluk kart stili) artık canlıda organik olarak (gerçek eski bir
  Kom1 sinyaliyle) doğrulanana kadar görünür bir örneği kalmadığı anlamına
  geliyor — kod/CSS tarafında bir kayıp yok, sadece demo veri kaldırıldı.

## Değişen dosyalar

- `js/screener/alarm-signal-history.js`
- `js/screener/kom1-scanner.js`
- `js/screener/detail-panel.js`
