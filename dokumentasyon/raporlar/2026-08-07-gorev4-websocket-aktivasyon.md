# Görev 4 — Bot Tarayıcıyı WebSocket'e Taşıma: Aktivasyon ve İlk Doğrulama

_Tarih: 2026-08-07_
_Durum: Kısmen tamamlandı — kod hazır ve sandbox'ta ban sinyali gözlenmedi, ama gerçek (VPN'li) ortamda kullanıcı doğrulaması gerekiyor._

---

## 1. Bağlam

Önceki bir oturumda (yarım kalan) `js/screener/m1hammer-scanner.js` zaten REST polling'den WebSocket'e taşınmıştı:

- `TEST_SYMBOLS`: sabit 8 sembol (BTC, ETH, SOL, BNB, XRP, DOGE, ADA, LINK) — tüm markete (~500 sembol) genişletilmedi
- Backfill (geçmiş veri) tek seferlik REST, aralarda 150ms bekleme, 429/418 görürse (`BAN_SIGNAL_*`) otomatik durur
- Backfill sonrası canlı veri sadece Binance kline WebSocket'inden (`wss://fstream.binance.com`) geliyor, REST'e dönülmüyor

Ama etkinleştirme satırı hâlâ yorumdaydı: [js/screener/detail-panel.js:1097](js/screener/detail-panel.js:1097) — `M1HammerScanner.start()`.

Kullanıcı bu turda **"Görev 4'e başla — küçük alt kümeyle (5-10 coin) başlayıp adım adım genişlet, her adımda IP ban kontrolü yap"** onayını verdi. Önemli ek bağlam: kullanıcı VPN üzerinden bağlanıyor (paylaşımlı IP havuzu riski), bu yüzden ban testleri normalden daha temkinli değerlendirilmeli.

## 2. Yapılan değişiklik

**Dosya:** [js/screener/detail-panel.js](js/screener/detail-panel.js)

`M1HammerScanner.start()` çağrısındaki yorum satırı geri açıldı. Kod tarafında (TEST_SYMBOLS=8, ban-sinyali koruması) hiçbir değişiklik yapılmadı — sadece devre dışı bırakılmış çağrı etkinleştirildi.

## 3. Sandbox doğrulaması

Yerel sunucu (`node server.js`, port 5500) üzerinden tarayıcı önizlemesinde ~35 saniye izlendi:

| Kontrol | Sonuç |
|---|---|
| `BAN_SIGNAL_429` / `BAN_SIGNAL_418` konsol mesajı | ❌ Yok |
| WS bağlantısı | ✅ `[M1Hammer] WS bağlandı ✓ (40 stream, BTCUSDT, ETHUSDT, SOLUSDT, BNBUSDT, XRPUSDT, DOGEUSDT, ADAUSDT, LINKUSDT)` |
| WS kapanma/reconnect döngüsü | ❌ Yok (stabil kaldı) |
| REST backfill | ⚠️ **0/40 istek başarılı** — hepsi `HTTP 502` |

### 502 hatası — ban değil, ayrı bir sorun

Backfill'deki 502 hataları **Binance ban sinyali değil**. Sebebi doğrulandı:

- Kod, 429/418'i ayrıca `BAN_SIGNAL_*` olarak işaretleyip backfill'i durduruyor — bu tetiklenmedi
- Aynı 502, bu sandbox ortamında **bu görevden önce de** vardı (`ScreenerCore`'un `exchangeInfo` REST çağrısı, ilgisiz bir modül, aynı hatayı veriyordu)
- Doğrudan `curl` ile sunucunun proxy rotasını (`/api/binance/futures/fapi/v1/klines`) test ettim — orada da anında 502 döndü, ban gecikmesi/mesajı yok
- Yani bu, **sandbox'ın kendi çıkış ağı** ile ilgili bir kısıt (Node sunucu süreci Binance'e REST üzerinden ulaşamıyor), Binance'in bizi banlamasıyla ilgisi yok. İlginç olan: tarayıcıdan doğrudan giden WebSocket bağlantısı (Node proxy'sini atlıyor) sorunsuz kuruldu — yani sandbox'ta "bir yönün" (WS) çalışıp diğerinin (sunucu REST proxy'si) çalışmaması, muhtemelen bu ortama özgü bir ağ kuralı.

**Sonuç:** Backfill başarısız olduğu için tarayıcı arabellekleri (`_buf`) şu an boş — `window.m1HammerSignals.length === 0`. Bu beklenen bir durum: yeterli bar biriktirmeden (5m için ~71 bar, yani WS'ten organik olarak ~6 saat) sinyal hesaplanamaz. Ban riskiyle **ilgisi yok**, sadece backfill'in bu sandbox'ta çalışmamasının bir sonucu.

## 4. Neden "tam tamamlandı" değil

Görev dosyasındaki (`siradaki-gorevler.md`) kritik doğrulama maddeleri:

- ✅ ~35 saniyede ban sinyali yok (ama görev **5 dakika** istiyor — sandbox'ta bu kadar uzun gözlemlemedim, kısa pencerede risk düşük görünse de tam koşulu karşılamıyor)
- ❌ "Bot Signals sekmesi doluyor mu?" — hayır, backfill'in sandbox'a özgü 502 sorunu yüzünden şu an boş (yukarıda açıklandığı gibi ban değil, ayrı bir engel)
- Kullanıcının **gerçek VPN ortamında** REST backfill'in çalışıp çalışmadığını ve birkaç dakika boyunca ban sinyali gelip gelmediğini görmesi gerekiyor — bu sandbox o senaryoyu tam simüle edemiyor

## 5. Kullanıcıdan istenen (sıradaki adım)

Kendi ortamında (VPN açıkken) sayfayı aç, birkaç dakika bekle, tarayıcı konsolunda şunları ara:

- `[M1Hammer] Backfill tamam — X/40 istek başarılı` — X sayısı 0'dan büyükse REST backfill çalışıyor demektir (sandbox'ta çalışmayan kısım)
- `BAN_SIGNAL` geçen herhangi bir satır — görürsen **hemen bildir**, kod otomatik durur ama yine de haber ver
- `[M1Hammer] WS kapandı` tekrar tekrar görünüyorsa (reconnect döngüsü) — bağlantı kararsız demektir, bildir
- Bot Signals sekmesinde (Watch → Bot Signals → M1 Hammer rafı) birkaç dakika sonra sinyal görünmeye başlıyor mu

Sorun yoksa, `siradaki-gorevler.md`'deki Görev 4 satırını `[x]` yapıp Görev 5'in DUR bloğuna geçebiliriz. Sorun (özellikle ban) görülürse hemen `detail-panel.js:1097`'deki satırı tekrar yoruma alıp durdurabilirim.

## 6. Genişletme hatırlatması

`TEST_SYMBOLS` (8 sembol) genişletilmedi ve **ayrı bir kullanıcı onayı olmadan genişletilmemeli** — bu hem kod içi yorumlarda hem görev dosyasında böyle kayıtlı. Kullanıcı yukarıdaki doğrulamayı onayladıktan sonra, "adım adım genişlet" talimatının bir sonraki adımı (örn. 8 → 15-20 sembol) ayrıca konuşulmalı.
