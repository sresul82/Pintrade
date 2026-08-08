# Kod İnceleme Raporu — 2026-07-31

**Kapsam:** Pintrade kod tabanının tamamı (statik inceleme + lokalde canlı test)
**Yöntem:** Kaynak kod okuma, tüm JS dosyalarında sözdizimi kontrolü, EventBus olay
eşleşme analizi, lokal sunucuda tarayıcı testi, Binance API'ye canlı doğrulama isteği.

> Bu rapor bir **tespit** raporudur — aşağıdaki maddelerin çoğu HENÜZ DÜZELTİLMEDİ.
> Yapılan düzeltmeler için bkz. `2026-07-31-lokal-ortam-kurulumu.md`.

---

## 🔴 Kullanıcının doğrudan hissedeceği hatalar

### 1. `45m` ve `3H` zaman dilimleri bozuk — Bybit'te sessizce YANLIŞ veri
`index.html`'de `data-tf="45m"` ve `data-tf="3H"` butonları var, ama bu iki aralık
ne Binance futures ne Bybit V5 API'sinde mevcut, `AppConfig.TF_MAP`'te de tanımlı değil.

- **Binance:** `toApiTf` fallback'e düşüyor, Binance reddediyor → grafik boş kalır.
- **Bybit** (`js/data/bybit-api.js:12`): `'45m'` → `'60'` yani **1 saatlik mum çiziliyor,
  üstünde 45m yazıyor**. Hata vermiyor, sadece yanlış veri gösteriyor.
- Aynı satırda `'3D'` → `'W'` eşlemesi de yanlış: **3 gün yerine 1 hafta**.

→ Kuyrukta: görev #2

### 2. Navbar'dan mum tipi değiştirmek grafiğe yansımıyor
`js/core/app.js:358` `chart:style:change` yayınlıyor — **dinleyeni yok**.
Grafiğin gerçek yolu `type:change` (`js/chart/chart-layout.js:264`) — **onu da kimse yayınlamıyor**.
İki farklı isimlendirme çakışıyor: `candleStyle`/`'candlestick'` ile `chartType`/`'candle'`.

### 3. Alert (Alarm) butonu ölü
`js/core/app.js:546` `modal:alarm:open` yayınlıyor, dinleyeni yok.
`State.alarms` dizisi tanımlı ama hiç kullanılmıyor. Uyarı sistemi henüz mevcut değil.

### 4. Grafik ayarları penceresindeki saat dilimi değişikliği uygulanmıyor
Olay `{ pane, state }` ile yayınlanıyor (`js/chart/ui/chart-settings.js:725`),
dinleyici `{ paneIdx, settings }` bekliyor (`js/chart/chart-core.js:142`)
→ `settings` hep `undefined` → blok hiç çalışmıyor.

### 5. Bazı çizim araçları seçiliyor ama hiçbir şey çizmiyor
Boş iskelet halindekiler:
- `drawing-patterns.js` — **tüm dosya**: harmonik formasyonlar (XABCD, Cypher, ABCD,
  OBO, Üçgen, Three Drives), Elliott dalgaları, döngü araçları
- `drawing-fibo.js:780-788` — Fib arc, Fib wedge, Pitchfan
- `drawing-shapes.js:651-655` — brush, highlighter
- `drawing-annotations.js:873` — ikon/emoji
- `drawing-forecast.js:184-185` — position forecast, bar pattern
- Hacim profili (fixed range / anchored)

→ Kuyrukta: görev #3

---

## 🟠 Sunucu ve veri hataları

### 6. Binance açık pozisyon (OI) toplayıcısı hep `0` kaydediyor — DOĞRULANDI
`server.js:128` `f.openInterest` okuyor, ama Binance `/fapi/v1/premiumIndex` yanıtında
**öyle bir alan yok**. Canlı istekle doğrulandı — dönen alanlar:

```
symbol, markPrice, indexPrice, estimatedSettlePrice,
lastFundingRate, interestRate, nextFundingTime, time
```

`parseFloat(undefined)` → `NaN` → `|| 0` → `0` → `0 * price = 0`.
Sonuç: veritabanındaki **Binance OI geçmişi tamamen sıfır**. Bybit tarafı doğru.
Ön yüz OI'yi ayrı endpoint'ten canlı çektiği için ekranda fark edilmiyor,
ama `/api/history/market` verisi kullanılamaz durumda.

### 7. `Candle` koleksiyonunda TTL yok → veritabanı sınırsız büyüyor
Diğer üç şemada TTL var (48 saat / 7 gün), mumlarda yok (`server.js:78-91`).
Günde ~500 coin × 288 mum = **~144.000 kayıt/gün**.
Ücretsiz MongoDB Atlas (512 MB) birkaç haftada dolar.

### 8. `package.json` ile kurulu Express sürümü çelişiyordu — ✅ DÜZELTİLDİ
Ayrıntı için bkz. `2026-07-31-lokal-ortam-kurulumu.md`.

### 9. Bir modül farklı backend'e gidiyor
`js/screener/fr-tracker.js:179` göreli `/api/history/fr/...` kullanıyor (= sitenin kendi adresi),
geri kalan her şey `AppConfig.BACKEND_URL` (= Render) kullanıyor.
pintrade.mooo.com'dan açıldığında bu ikisi farklı sunuculara gider.

### 10. İlk REST yüklemesi başarısız olursa screener bir daha toparlanmıyor
Binance ban'ı sırasında gözlendi:
`[BinanceAPI] exchangeInfo: symbols dizisi yok` → `[SearchCore] Loaded 0 Binance` →
`[ScreenerCore] Binance screener error: tkData.forEach is not a function`
Yeniden deneme (retry) mekanizması yok — liste kalıcı olarak boş kalıyor.

---

## 🟡 Performans ve IP ban riski

### 11. Bot tarayıcı kendi IP'den dakikada yüzlerce istek atıyor — DOĞRULANDI, ÖLÇÜLDÜ
`js/screener/m1hammer-scanner.js:11` proxy'yi atlayıp `https://fapi.binance.com`'a
**doğrudan** bağlanıyor. Her 5 dakikada ~500 coin × 5 timeframe = **~2.500 istek**,
aralarda bekleme yok.

**Lokal testte iki kez tekrarlandı:**

| Ölçüm | Sonuç |
|---|---|
| Ban'a kadar geçen süre | Sayfa yüklendikten **~34 saniye** sonra |
| Hata | `code -1003: Way too many requests; IP(...) banned` |
| Ban süresi (1. kez) | 11 dakika |
| Ban süresi (2. kez) | 20 dakika — **her tekrarda uzuyor** |
| Ban sırasında chart | Hiç mum çekemiyor, navbar PRICE alanı `--` |
| Ban sırasında screener | İlk dolum REST istediği için boş kalıyor |

Projenin başka yerinde (`js/data/binance-api-fr.js:2`) tam bu risk için özellikle
WebSocket'e geçilmiş — bu modül o kuralı deliyor.

→ Kuyrukta: görev #1. **Geçici önlem uygulandı** (bkz. kurulum raporu).

### 12. Chart'ın "canlı" verisi aslında 2 saniyelik REST polling — DOĞRULANDI
`js/data/chart-data.js:374` — fonksiyon adı `connectLive`, ama içi:

```js
setInterval(poll, 2000);   // /fapi/v1/klines?...&limit=2&_t=...
```

Pane başına dakikada 30 istek. 2×2 layout'ta 4 pane = dakikada 120 istek,
sadece mum güncellemesi için. Buna `detail-panel.js:583`'ün 10 saniyelik
5 endpoint'lik poll'u ekleniyor.

Görev #1 uygulandıktan sonra bile bu yük **~2 dakikalık kısa ban'lara** yol açtı.
Binance'in kendi hata mesajı da bunu söylüyor:
*"Please use the websocket for live updates to avoid bans."*

→ Kuyrukta: görev #5

### 13. `calcSRSI` O(n²)
`m1hammer-scanner.js:44` her adımda RSI'yi baştan hesaplıyor.
2.500 çağrıda tarayıcıyı yorar. → Kuyrukta: görev #4

---

## 🔵 Güvenlik

### 14. Sunucu tüm kök dizini yayınlıyor
`server.js:15` `express.static(__dirname)` → `server.js`, `package.json`,
`dokumentasyon/`, `tmp/`, `out.txt` herkese açık.

### 15. Çizim senkronunda kimlik doğrulama yok
`syncKey` ile korunuyor ama doğrulama yok — anahtarı bilen/tahmin eden
başkasının çizimlerini okuyup yazabilir. Proxy'de de rate limit yok
(başkası sizin sunucunuz üzerinden Binance'i yorup IP'nizi bandırabilir).

---

## ⚪ Temizlik

- **Ölü dosyalar** (hiçbir yerden yüklenmiyor):
  `js/drawing/tools/drawing-advanced.js`, `js/drawing/ui/settings-modal.js`
- `js/chart/chart-core.js` satır **81-115 ile 169-203 birebir aynı** (kopya blok)
- `js/chart/chart-core.js:26-52` — `#nav-tf` handler'ı içinde tanımsız `setType` ve
  `navChartTypeBtn` var. O element artık `index.html`'de olmadığı için patlamıyor,
  ama ölü + bozuk kod.
- `out.txt` (37 KB debug dökümü) ve `tmp/` (tek seferlik onarım betikleri)
  → `.gitignore`'a eklenmeli
- Git "dubious ownership" uyarısı veriyor (F: sürücüsü sahiplik kaydetmiyor)

---

## Strateji açısından eksikler

Claude.ai sohbetindeki strateji çalışması bittiğinde gerekecek olanlar:

| İhtiyaç | Durum |
|---|---|
| Long/Short oranı — global, anlık | ✅ `detail-panel.js` (`globalLongShortAccountRatio`, `limit=1`) |
| Long/Short oranı — **Top Trader** | ❌ Yok — "global vs top trader ayrışması" stratejinin en değerli sinyali, bu yarısı eksik |
| Long/Short **geçmişi** (zaman serisi) | ❌ Yok — sadece o anki tek değer |
| Grafik üstünde indikatör (RSI, DEMA9, Heikin Ashi, WaveTrend, Regresyon kanalı) | ❌ Grafik katmanında indikatör motoru yok |
| İndikatör matematiği | ⚠️ Var ama `m1hammer-scanner.js` içine gömülü — grafik kullanamıyor |
| Backtest | ❌ Yok |
| OI geçmişi (sunucu tarafı) | ⚠️ Bozuk — madde 6 |

---

## Öncelik önerisi

1. **Madde 11 + 12 (IP ban)** — aktif olarak lokal geliştirmeyi bozuyor
2. **Madde 1 (45m/3H)** — yanlış veriye bakarak işlem açma riski, düzeltmesi kolay
3. **Madde 7 (Candle TTL)** — sessizce veritabanını dolduruyor
