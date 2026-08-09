# Görev 10 — Doğrulanmış Ölü Kod / Hesaplama Hataları (Tamamlandı)

**Tarih:** 2026-08-08

## 10.1 — Binance OI geçmişi hep 0 kaydediyordu

`server.js`'deki `collectBinanceData()`, `/fapi/v1/premiumIndex` yanıtında
**olmayan** bir `openInterest` alanını okuyordu (curl ile doğrulandı: bu
endpoint sadece `symbol, markPrice, indexPrice, estimatedSettlePrice,
lastFundingRate, interestRate, nextFundingTime, time` döndürüyor). Sonuç:
`NaN || 0 = 0` → `MarketData` koleksiyonundaki Binance OI geçmişi tamamen
sıfırdı. Bu, L/S görevinde (`takerlongshortRatio`'nun `symbol` alanı
olmaması) bulunup düzeltilen hatayla aynı sınıf.

### Düzeltme

- Yanlış `oi = parseFloat(f.openInterest) || 0` satırı kaldırıldı,
  `openInterest: null` olarak başlatılıyor.
- Yeni `_fetchBinanceOIBatch(symbols)` — `/fapi/v1/openInterest?symbol=...`'i
  (curl ile doğrulandı: gerçek alan burada var) **sadece bu turda FR'si
  değişen semboller için**, batch'li (10'lu, aralarda 150ms) çekip
  `Map<symbol, openInterest>` döndürüyor.
- `histDocs` oluşturulduktan sonra bu batch çağrılıp her doküman
  `openInterest = adet × price` ile dolduruluyor, sonra tek `insertMany`.

**Rate-limit notu:** Tüm ~500 sembolü her dakika çekmek yerine sadece
değişenler için çekiliyor — Görev 1'in "toplayıcıları hafiflet" bulgusuyla
çelişmiyor. Değişen sembol sayısı piyasa hareketliliğine göre değişir
(sakin dakikalarda birkaç, oynak dakikalarda yüzlerce olabilir) — batch'leme
+ aralardaki bekleme bu değişkenliği yumuşatıyor.

## 10.2 — İki ölü event düzeltildi

### Mum tipi değişimi

`js/chart/chart-pane.js`'de zaten hazır, hiç çağrılmayan bir
`setChartType(type)` metodu vardı. `js/core/app.js`'deki navbar mum-stili
menüsü sadece `EventBus.emit('chart:style:change', ...)` yayınlıyordu,
dinleyeni yoktu.

**Bulunan ek karmaşıklık:** Navbar menüsünde 11 stil seçeneği var
(`candlestick, heikinashi, hollow, volume, line, line_markers, area,
hlc_area, baseline, volume_footprint, session_volume`) ama
`chart-pane.js`'in `_buildSeries()`'i sadece 4'ünü destekliyor
(`candle/bar/line/area`). Kalan 7'si için ayrı bir seri implementasyonu
(Heikin Ashi hesaplaması, hollow candle, baseline vs.) yok — bu, "mum
stili" düzeltmesinin kapsamını aşan, ayrı bir özellik inşası.

**Düzeltme:** `CHART_TYPE_MAP` ile 4 desteklenen stil `LayoutManager.
getActivePane().setChartType()`'a bağlandı — artık gerçekten çalışıyor.
Desteklenmeyen 7 stil için sessizce hiçbir şey yapmak yerine, mevcut
SPOT/dayOpen "coming soon" örüntüsüyle tutarlı bir toast gösteriliyor
("X style is not implemented yet").

### Alarm butonu

`btn-alarm` tıklanınca `EventBus.emit('modal:alarm:open')` yayınlanıyordu,
dinleyeni yoktu — buton hiçbir şey açmıyordu. Görev talimatı gereği
("kapsamını netleştirmeden büyük bir özellik inşa etme, önce küçük bir
doğrulama modalıyla başla") **gerçek bir alarm kaydetme/tetikleme sistemi
kurulmadı** — `css/components.css`'te zaten var olan ama hiç kullanılmayan
genel `.modal-backdrop`/`.modal` şablonuyla küçük bir doğrulama modalı
eklendi: aktif sembol, fiyat girişi, üstünde/altında koşulu, "Create"
tıklanınca sadece bir toast gösterip kapanıyor — **hiçbir yere
kaydetmiyor**, modal içinde bu açıkça yazıyor ("alerts are not yet saved
or triggered"). Gerçek alarm sistemi (saklama, tetikleme, geçmiş) ayrı,
büyük bir iş olarak bırakıldı.

## Doğrulama (tarayıcıda, gerçek modüllerle)

1. **Mum tipi:** `nb-ms-item[data-style="line"]` tıklandı →
   `LayoutManager.getActivePane().chartType` gerçekten `"line"` oldu,
   `pane.series` yeniden oluşturuldu (daha önce hiç değişmiyordu).
2. **Desteklenmeyen stil:** `heikinashi`/`baseline` tıklanınca `chartType`
   değişmedi (beklenen), toast DOM'da doğrulandı: "Heikin Ashi style is
   not implemented yet...".
3. **Alarm modalı:** `btn-alarm` tıklanınca modal açıldı, başlıkta aktif
   sembol doğru (`Create Alert — BTCUSDT`). Fiyat girilip "Create"
   tıklanınca modal kapandı, doğru toast çıktı: "Preview only — BTCUSDT
   alert (65000) was not saved".
4. **10.1 (OI):** `node -c server.js` ile syntax doğrulandı,
   `/fapi/v1/openInterest?symbol=BTCUSDT` gerçek alan adı curl ile
   doğrulandı (`{"symbol":"BTCUSDT","openInterest":"106332.359",...}`).
   Gerçek toplayıcı çalışması bu sandbox'ta test edilemedi (Node işleminin
   dış DNS erişimi engelli — önceki görevlerde de karşılaşılan kısıt) —
   production'da deploy sonrası `/api/history/market/binance/BTCUSDT`
   ile doğrulanmalı.
5. **Konsol hataları:** Görülenler (`ScreenerCore`, `chart-data.js` —
   `HTTP 502`) bu sandbox'ın bilinen ağ kısıtından, değişikliklerle
   ilgisi yok.

## Regresyon

- FR toplama/sinyal mantığı değişmedi, sadece OI alanı ayrıca dolduruluyor.
- Mevcut favori mum stilleri (candlestick/heikinashi varsayılanları)
  bozulmadı — sadece artık tıklanınca gerçekten (desteklenenler için)
  uygulanıyor.

## Değişen dosyalar

- `server.js`
- `js/core/app.js`
