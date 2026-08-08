# Sütun Menüsüne Change Type + Volume Type Eklendi — 2026-08-01

## İstek

Referans görseldeki gibi, screener'ın ⋮ (sütun) menüsüne **Change Type**
ve **Volume Type** bölümleri eklensin.

## Kullanıcıyla netleşen kapsam

- **Change Type (24h Rolling / 1D Open):** "1D Open" günlük açılış fiyatına
  göre değişim hesaplamak için 500+ coin'e günlük mum verisi çekmeyi
  gerektiriyor — yeni bir veri kaynağı + rate-limit riski. Kullanıcı bunu
  bilinçli olarak erteledi: arayüzde görünsün/seçilebilsin ama tıklanınca
  bilgi mesajı çıksın (SPOT ile aynı kalıp), gerçek hesaplama ayrı bir
  "veri katmanı" turuna bırakılsın.
- **Volume Type (USD / Standard):** "Standard" (coin cinsinden hacim) için
  yeni bir veri kaynağı gerekmiyor — Binance/Bybit zaten `volume`/
  `volume24h` alanlarını dönüyor, sadece kullanılmıyordu. Bu yüzden **tam
  işlevsel** yapıldı.

## Yapılan değişiklikler

### Veri katmanı — `js/screener/watchlist-store.js`
`getChangeType/setChangeType` ve `getVolumeType/setVolumeType` eklendi
(ikisi de `localStorage`'a kalıcı, `watchlist:changeTypeChanged` /
`watchlist:volumeTypeChanged` olayı yayınlıyor). `setChangeType('dayOpen')`
bilinçli olarak `false` dönüyor — henüz desteklenmediğini belirtmek için.

### Arayüz — `js/screener/watchlist-menu.js` + `css/watchlist.css`
⋮ menüsüne iki yeni bölüm: "CHANGE TYPE (BETA)" ve "VOLUME TYPE", radio
buton stiliyle (referans görseldeki gibi). "1D Open" satırı görünüşte
soluk ("soon" rozetiyle), tıklanınca `Toast` ile bilgi veriyor.

### Coin cinsinden hacim — üç dosyada plumbing
Base-asset hacmi (`volBase`) üç veri yoluna eklendi:
- `screener-core.js` — Binance (`tk.volume`) ve Bybit (`t.volume24h`) REST
  yanıtlarından okunuyor.
- `market-data-store.js` — Binance WebSocket `!miniTicker@arr` akışının
  `d.v` alanı (`volumeBase24h` olarak) `mds:tick` olayına eklendi.
- `screener-core.js`'in `mds:tick` dinleyicisi bu yeni alanı satıra
  (`row.volBase`) yazıyor.

`_fmtVol()` artık `WatchlistStore.getVolumeType()`'a bakıp USD (`d.vol`)
veya coin (`d.volBase` + sembol soneki, örn. "2.97B COTI") gösteriyor.
Sütun başlığı da otomatik "Vol (USDT)" ↔ "Vol (Coin)" arası değişiyor.

---

## Doğrulama

Bybit'te tarayıcıda test edildi (676 coin).

| Test | Sonuç |
|---|---|
| Menü bölümleri | ✅ "CUSTOMIZE COLUMNS", "CHANGE TYPE (BETA)", "VOLUME TYPE" |
| Change Type seçenekleri | ✅ "24h Rolling", "1D Open" ("soon" rozetli) |
| Volume Type seçenekleri | ✅ "USD", "Standard" |
| "1D Open" tıklanınca | ✅ değişmiyor (hâlâ `rolling24h`), bilgi bildirimi çıkıyor |
| "Standard" seçilince — sütun başlığı | ✅ "Vol (USDT)" → "Vol (Coin)" |
| "Standard" seçilince — örnek değer | ✅ "48.46M" (USD) → "2.97B COTI" (coin) |
| "USD"ye geri dönünce | ✅ başlık ve değerler eski haline döndü |
| Sayfa yenilemesinden sonra kalıcılık | ✅ "standard" seçimi korundu |
| Yeni konsol hatası | ✅ yok (mevcut CryptoCompare haber hatası ilgisiz) |

Test sonrası Volume Type "USD"ye geri alındı (kullanıcı varsayılan durumda
başlasın diye).

## Değişen dosyalar

| Dosya |
|---|
| `js/screener/watchlist-store.js` |
| `js/screener/watchlist-menu.js` |
| `css/watchlist.css` |
| `js/screener/screener-core.js` |
| `js/data/market-data-store.js` |

## Sıradaki adım

"1D Open" gerçek işlevselliği — kuyrukta bekleyen Görev 5 (chart WebSocket'e
taşıma, IP ban riskini bitiriyor) tamamlandıktan sonra, ayrı bir "veri
katmanı genişletme" turunda ele alınması öneriliyor (kullanıcı onayladı).
