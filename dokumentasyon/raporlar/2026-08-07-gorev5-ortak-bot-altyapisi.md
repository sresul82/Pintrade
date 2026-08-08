# Görev 5 — Ortak Bot Altyapısı (Dar Kapsam)

_Tarih: 2026-08-07_
_Durum: Tamamlandı — kullanıcı onayıyla "dar kapsam" seçildi (FR/M1Hammer'ın mevcut sinyal formatı değiştirilmedi)._

---

## 1. Kapsam kararı

`dokumentasyon/SISTEM-GENEL-DEGERLENDIRME.md` §5.4'teki tam öneri (ortak `scan()`→`Signal[]` formatı, merkezi tick scheduler, gerçek zamanlı rate-limit bütçe göstergesi) geniş bir refactor. FR ve M1Hammer (Görev 4'te az önce ban-güvenli hale getirilmiş) ikisi de çalışan, hassas sistemler olduğu için kullanıcıya iki seçenek sunuldu: **dar kapsam** (sadece somut risk/tekrar noktalarını düzelt) ve **tam kapsam** (FR/M1Hammer'ı da migrate et). Kullanıcı **dar kapsamı** seçti.

## 2. Yapılan değişiklikler

### 2.1 Yeni: `js/screener/bot-engine.js` — ortak REST rate-limit kuyruğu

`BotEngine.queueRestRequest(fn)`:
- Tek bir FIFO kuyruk, istekler arasında 150ms minimum gecikme (M1Hammer'ın eski backfill throttle'ıyla aynı değer)
- `fn`, mesajı `BAN_SIGNAL` ile başlayan bir `Error` fırlatırsa (429/418 tespiti — mevcut `m1hammer-scanner.js` konvansiyonu), kuyruk **duraklar** ve bekleyen TÜM istekler (hangi bottan gelirse gelsin) reddedilir. Bu, "paylaşılan bütçe" fikrinin özü — bir bot'un ban sinyali diğerlerini de durdurmalı.
- `BotEngine.resume()` — manuel devam (güvenli olduğu doğrulandıktan sonra çağrılmalı)
- `BotEngine.isPaused()` — durum sorgusu

Dosyanın başında, gelecek botlar (Kom1/Kom2/Kom3, MA/V3/4S) için önerilen ortak Signal zarf formatı **dokümante edildi** (kod olarak zorlanmıyor):

```js
{ botId, symbol, exchange, timestamp, signalType, payload }
```

FR (`scalpFRMonitor`) ve M1Hammer (`window.m1HammerSignals`) bu zarfa **migrate edilmedi** — ikisi de kendi UI render kodlarına (`fr-tracker.js`, `bot-signals-panel.js`) sıkı bağlı, çalışan formatlarını koruyor. Bu ayrı, gelecekteki bir temizlik.

### 2.2 `js/data/market-data-store.js` — paylaşılan kline stream

Yeni: `subscribeKlines(symbol, interval, callback)` / `unsubscribeKlines(symbol, interval, callback)`.

- Tek bir WS bağlantısı (`wss://fstream.binance.com/stream`), Binance'in dinamik `SUBSCRIBE`/`UNSUBSCRIBE` mesaj protokolüyle yönetiliyor — yeni bir sembol×tf abone olunduğunda bağlantı yeniden kurulmuyor, sadece `SUBSCRIBE` mesajı gönderiliyor.
- Aynı sembol×tf'e birden fazla bot abone olabilir (`Set<callback>` ile) — WS'e sadece bir stream isteği gider.
- Reconnect/backoff mantığı (1sn → max 30sn) `MarketDataStore`'un mevcut ana WS'iyle aynı desende.
- `stop()` artık kline WS'ini de kapatıyor.

**Neden ayrı bağlantı (mevcut `!miniTicker@arr`/`!markPrice@arr` firehose'undan):** O ikisi "tüm market" stream'i, kline'lar sembol×tf başına ayrı stream adı istiyor (`btcusdt@kline_5m`) — farklı bir abonelik modeli, karıştırmak yerine ayrı bir bağlantıda yönetildi.

### 2.3 `js/screener/m1hammer-scanner.js` — migrasyon

- Kendi özel `_ws`/`_connect()`/`_wsUrl()`/`_reconnectMs` kodu tamamen kaldırıldı.
- Backfill artık `BotEngine.queueRestRequest(() => fetchKlines(...))` üzerinden — kendi 150ms `setTimeout` döngüsü kaldırıldı, merkezi kuyruk bunu zaten yapıyor.
- Canlı veri artık `MarketDataStore.subscribeKlines(sym, tf, _onKlineBar)` ile — `start()`/`stop()` sırasıyla abone olup/oluyor.
- Davranış korundu: sadece kapanan bar işleniyor (`isFinal` kontrolü, eski `k.x` kontrolünün karşılığı), ban sinyalinde `stop()` çağrısı aynı.

### 2.4 `index.html`

`js/screener/bot-engine.js` script etiketi eklendi — `market-data-store.js`'den sonra, `m1hammer-scanner.js`'den (ve diğer tüm bot'lardan) önce.

## 3. Yapılmayanlar (bilinçli, dar kapsam kararı gereği)

- FR ve M1Hammer'ın sinyal formatı ortak zarfa migrate edilmedi
- Merkezi "tick" tabanlı scheduler kurulmadı — çünkü mevcut botların (FR, M1Hammer) **hiçbiri** şu an kendi `setInterval`'ını açmıyor (ikisi de WS/event-driven), yani düzeltilecek somut bir ihlal yok. MA/V3/4S kodlanınca, eğer polling gerekiyorsa, o zaman gerçek ihtiyaca göre eklenecek.
- `X-MBX-USED-WEIGHT-1M` header takibi eklenmedi (ayrı, isteğe bağlı iyileştirme, bu görevin "dar kapsam" tanımının dışında)

## 4. Doğrulama

Yerel sunucu üzerinden tarayıcıda test edildi:

| Kontrol | Sonuç |
|---|---|
| `node --check` (3 değişen/yeni dosya) | ✅ Sözdizimi hatası yok |
| `BAN_SIGNAL` konsol mesajı | ❌ Yok |
| `BotEngine.isPaused()` | `false` |
| `[MarketDataStore] Kline WS bağlandı ✓` | ✅ Göründü |
| `[M1Hammer] MarketDataStore kline stream'ine abone olundu (40 stream, ...)` | ✅ Göründü |
| `[M1Hammer] Backfill tamam — X/40` | ✅ Log çalıştı (X=0, sandbox'a özgü 502 nedeniyle — bkz. `2026-08-07-gorev4-tamamlanma-datacenter-ip-bulgusu.md`, kod hatası değil) |
| Watch → Bot Signals → M1 Hammer rafı | ✅ Hatasız render oluyor ("Waiting for M1 Hammer signals..." boş durumu, backfill boş olduğu için beklenen) |
| Yeni JS hatası (konsol) | ❌ Yok — sadece önceden bilinen, ilgisiz 502 hataları |

## 5. Sonraki botlar için not

MA/V3/4S veya Kom1/Kom2/Kom3 yazıldığında:
- REST çağrıları varsa `BotEngine.queueRestRequest()` üzerinden geçmeli
- Kline verisi gerekiyorsa `MarketDataStore.subscribeKlines()` kullanılmalı, kendi WS bağlantısını açmamalı
- Sinyal formatı için `bot-engine.js` başlığındaki zarfı referans alabilir (zorunlu değil, ama tutarlılık için önerilir)
