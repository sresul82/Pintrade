# Görev 1 — Toplayıcı Açılış Zamanlamasını Yayma (Tamamlandı)

**Tarih:** 2026-08-08

## Sebep

Sunucu her açıldığında `mongoose.connection.once('open', ...)` içindeki 4
toplayıcı (`collectBinanceData`, `collectBybitData`, `collectBinanceCandles`,
`collectLSData`) hepsi **aynı anda** ateşleniyordu. Bu, aynı gün içinde
production'da (`pintrade-uwg9.onrender.com`) Binance'in geçici hız-limitine
(`code:-1003 "Way too many requests"`) takılıp **11 saatlik IP ban**'a yol
açmıştı.

## Değişiklik — `server.js`

Yeni bir `_staggeredStart(fn, delayMs, intervalMs)` yardımcı fonksiyonu:
ilk çağrıyı `delayMs` sonra yapar, **`setInterval`'i de o gecikmeli
callback'in içinde kaydeder** — bu sayede ofset sadece ilk turda değil,
tüm sonraki periyotlarda da kalıcı olarak korunur (periyotlar bir daha asla
aynı ana denk gelmez).

Sıralama, en hafiften en ağıra:

| Toplayıcı | Gecikme | Periyot | Kaba weight tahmini |
|---|---|---|---|
| `collectBinanceData` | 0s | 1dk | ~50 (premiumIndex w10 + ticker/24hr w40) |
| `collectBybitData` | 5s | 1dk | Binance bütçesini etkilemez (ayrı borsa) |
| `collectLSData` | 10s | 5dk | ~32 (8 sembol × 4 endpoint × w1) |
| `collectBinanceCandles` | 15s | 5dk | ~530 (526 sembol × w1, en ağır) |

Eski hâlde bu ~600+ weight'lik istek, sunucu açılışının ilk birkaç
saniyesinde (candles'ın kendi iç batch'lemesi dışında) neredeyse eş zamanlı
patlıyordu. Yeni hâlde en ağır toplayıcı (mumlar), diğer üçü tamamlandıktan
sonra, 15 saniye gecikmeyle başlıyor.

## Doğrulama

1. **Mantık testi (izole Node betiği):** 4 sahte fonksiyonla `_staggeredStart`
   simüle edildi — hem ilk tetiklenme hem sonraki tüm periyodik tekrarlar
   kalıcı olarak birbirinden ayrışmış, hiç çakışma yok (log: `+3ms, +511ms,
   +1005ms, +1513ms, +2006ms, +2517ms, ...`).
2. **Yerel ortam:** `node -c server.js` ile syntax doğrulandı. Yerel
   sandbox'ta `MONGODB_URI` tanımlı olmadığı için toplayıcılar gerçekten
   tetiklenmedi (mevcut "lokal mod" kısıtı) — bu yüzden gerçek zamanlamayı
   sadece production'da doğrulamak mümkündü.
3. **Production (`pintrade-uwg9.onrender.com`, `main` branch):** Değişiklik
   push edildi (`906e8dd`), Render ~13 saniye içinde deploy etti (uptime
   1210s → 14s düşüşüyle doğrulandı). Deploy sonrası ~110 saniye boyunca
   izlendi:
   - `/health` → `db: connected`, hatasız
   - `/api/history/ls/binance/BANKUSDT?hours=1` → 6 kayıt, en yenisi taze
     (L/S toplayıcısı — 10sn gecikmeli slot — çalışıyor)
   - `/api/history/fr/binance/BTCUSDT?hours=1` → 8 kayıt (FR toplayıcısı —
     0sn slot — çalışıyor)
   - Hiçbir `code:-1003` / ban belirtisi görülmedi

**Not:** Bu, tek bir yeniden başlatma sonrası kısa süreli bir gözlem — kalıcı
olarak ban riskinin tamamen ortadan kalktığını iddia etmiyorum, ama açılış
anındaki ani patlama artık yok ve ilk test temiz geçti.

## Regresyon

Toplayıcıların işlevselliğinde değişiklik yok — sadece **ne zaman**
tetiklendikleri değişti, **ne** yaptıkları aynı kaldı. FR ve L/S verisinin
deploy sonrası kesintisiz akmaya devam ettiği doğrulandı.

## Değişen dosyalar

- `server.js` — `_staggeredStart` helper eklendi, `mongoose.connection.once('open', ...)` bloğu buna göre yeniden yazıldı.
