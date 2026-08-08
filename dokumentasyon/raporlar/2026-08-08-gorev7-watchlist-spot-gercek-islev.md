# Görev 7 — Watchlist SPOT Placeholder'ının Gerçek İşlevi (Tamamlandı)

**Tarih:** 2026-08-08

## Kapsam kararı (kullanıcı onayıyla)

Görevin orijinal metni "grafik/fiyat/değişim gösterme" diyordu. Grafiği de
tam desteklemek `chart-data.js`'in (IndexedDB önbellek, borsa soyutlama,
canlı mum WS'i — 900+ satır) yeni bir "market" (spot/futures) boyutuyla
genişletilmesini gerektiriyordu — riskli, büyük bir değişiklik. Kullanıcıya
soruldu, **"sadece liste" (önerilen)** seçildi: SPOT gerçek, canlı bir coin
listesi gösterir (symbol/fiyat/değişim/hacim); bir satıra tıklanınca mevcut
(futures odaklı) chart pipeline'ı çalışır — futures'ı da olan coinlerde
grafik zaten çalışır, sadece-SPOT coinlerde boş/hatalı kalabilir. Tam SPOT
grafik desteği ayrı, gelecekte istenirse ele alınacak bir iş olarak
bırakıldı.

## Yeni dosya — `js/data/spot-data-store.js`

`MarketDataStore`'un futures ticker akışıyla **aynı desen**: tek WS
bağlantısı (`wss://stream.binance.com:9443/stream?streams=!miniTicker@arr`),
günlük sembol cache'i (delist koruması, `ScreenerCore`'un futures için
kullandığı örüntüyle birebir aynı). FR/OI/sinyal yok — Binance SPOT'ta bu
verilerin karşılığı yok, kapsam bilinçli olarak dar tutuldu.

**Önemli bulgu (test sırasında ortaya çıktı):** `!miniTicker@arr` her
mesajda TÜM sembolleri değil, o an fiyatı güncellenmiş olanları gönderiyor
— canlı gözlemlendi: ilk yüklemeden sonra bile ticker sayısı zamanla
artmaya devam ediyor (350 → 355, 2 saniyede). Bu, `spot:tick` dinleyicisinin
sadece mevcut satırları güncellemekle kalmayıp, satırı olmayan yeni gelen
sembolleri **satır olarak eklemesi** gerektiği anlamına geliyordu — ilk
implementasyonda bu eksikti (28 satırda donuk kalıyordu), test sırasında
bulunup düzeltildi (bkz. Doğrulama).

## Diğer değişiklikler

- **`js/screener/watchlist-store.js`** — `setMarketType()` artık `'spot'`i
  de kabul ediyor (önceden sadece `'futures'` kabul edip false dönüyordu).
- **`js/screener/watchlist-menu.js`** — Pazar filtresi bloğu: FUTURES ve
  SPOT ikisi de artık tıklanabilir (SPOT'un "soon" rozeti ve devre dışı
  toast'ı kaldırıldı), aktif olan `.active` sınıfıyla vurgulanıyor.
- **`css/watchlist.css`** — `.wl-lm-market-row.plain` yerine `.active`
  stili (her iki pazar da artık tıklanabilir olduğu için "plain/pasif"
  ayrımı anlamsızlaştı).
- **`js/screener/screener-core.js`** (en büyük değişiklik):
  - Yeni `_market` state'i (`'futures'|'spot'`), `WatchlistStore.getMarket()`
    ile başlatılıyor, `watchlist:marketChanged` event'ini dinliyor.
  - `_visibleCols()`/`_applyGridTemplate()`: SPOT modunda sabit dar sütun
    seti (`Symbol/Price/Chg%/Vol`) — kullanıcının FUTURES için özelleştirdiği
    sütun tercihleri SPOT'ta yok sayılıyor (FR/FRH/OI zaten veri kaynağı
    olarak yok).
  - `_buildRow`: sinyal rozeti ve Combo (Kom1/2/3) rozeti sadece
    `_market === 'futures'` iken hesaplanıyor/gösteriliyor.
  - Yeni `_loadSpotBinance()` (SpotDataStore üzerinden, kendi fetch'i yok)
    ve `_loadSpotBybit()` (Bybit `category=spot` REST poll, mevcut futures
    poll örüntüsüyle aynı disiplin).
  - `_reload()` — borsa (binance/bybit) × pazar (futures/spot) 4
    kombinasyonunun hepsini doğru loader'a yönlendiren tek nokta.
  - `mds:tick/fr/oi` dinleyicileri artık `_market==='futures'` koruması da
    taşıyor (SPOT modundayken futures WS verisi satırları ezmesin diye).
  - Periyodik 60sn tam-yenileme zamanlayıcısı da market-farkında hâle
    getirildi (önceden SPOT modundayken bile sürekli futures'a geri
    dönüyordu — bu potansiyel bir regresyon önceden fark edilip düzeltildi).
  - 1 saatlik funding-interval sıralama/ayraç mantığı SPOT'ta atlanıyor
    (anlamsız, funding SPOT'ta yok).
- **`index.html`** — `spot-data-store.js` script tag'i eklendi
  (`bybit-api.js`'den sonra, `MarketDataStore`/`BotEngine`'den önce —
  bağımsız bir modül, sıra kritik değil ama tutarlılık için data/ grubunda
  tutuldu).

## Doğrulama (tarayıcıda, gerçek modüllerle, gerçek Binance/Bybit WS/REST)

1. **SPOT menüsü artık tıklanabilir, "soon" değil** — doğrulandı.
2. **Binance SPOT canlı veri:** SPOT'a geçildi, sütunlar doğru daraldı
   (`Symbol Price Chg% Vol (USDT)`), gerçek fiyatlar aktı (örn. USDCUSDT
   1.00052, -0.01%). **Bulunan hata düzeltildikten sonra**: satır sayısı
   ticker sayısıyla eşleşti (299/300 — throttle gecikmesi dışında tam).
3. **FUTURES'a geri dönüş:** sütunlar doğru genişledi (FR%/FR(h)/OI geri
   geldi) — regresyon yok (FUTURES'ın kendisi bu sandbox'ta bilinen 502
   kısıtından dolayı veri çekemedi, ama bu **önceden de böyleydi**, benim
   değişikliğimle ilgisi yok — Node işleminin dış DNS erişimi engelli).
4. **Bybit SPOT:** borsa Bybit'e çevrildi, SPOT modunda kalındı — 410 satır,
   doğru sütunlar, gerçek veri (örn. BTCUSDT $65,000.70, +0.04%, 338.90M
   hacim).
5. **Sinyal/bot sütunları SPOT'ta yok:** header'da FR/FRH/OI hiç yok, satır
   HTML'inde 🚨/⚡/• rozetlerinden hiçbiri görünmüyor.
6. **Satıra tıklama çökmüyor** — `State.setSymbol()` çağrılıyor, konsolda
   yeni bir hata oluşmuyor.
7. **Konsol hataları:** SPOT/Bybit-spot kod yoluna ait hiçbir hata yok;
   görülen tüm hatalar (`ScreenerCore Binance ... 502`, `BinanceFeed ...
   502`) bu sandbox'ın önceden bilinen ağ kısıtından, FUTURES'a ait,
   benim değişikliğimle ilgisi yok.

## Regresyon

- FUTURES akışının kodu değişmedi (`_loadBinance`/`_loadBybit` aynı) —
  sadece etraflarındaki dispatch/guard mantığı eklendi.
- Mevcut sütun özelleştirme (⋮ menüsü), liste filtreleri, arama — FUTURES'ta
  aynen çalışmaya devam ediyor.

## Değişen dosyalar

- `js/data/spot-data-store.js` (yeni)
- `js/screener/screener-core.js`
- `js/screener/watchlist-store.js`
- `js/screener/watchlist-menu.js`
- `css/watchlist.css`
- `index.html`
