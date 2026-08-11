# gorevler2.md Görev 14.1 — Chart İndikatörleri: EMA/DEMA/RSI (Tamamlandı)

**Tarih:** 2026-08-11

## Kapsam

Kullanıcı isteği: "RSI EMA ve DEMA indikatorlerinden başlayalım,
indikatorler TVde oldugu gibi, bazilari chart uzerinde yer alcak,
bazilari ise altta ayri pencere olarak acilcak sekilde." Ayrıca alt
pencere mekanizmasını bilip bilmediğim ve TV ile aynı sonucu verip
vermeyeceği soruldu.

## Teknik kısıtlar ve kararlar

### Kütüphane sürümü

Proje `lightweight-charts v4.1.3` kullanıyor (`js/lightweight-charts.min.js`
başlığından doğrulandı). Bu sürümde TV'nin native "pane" (chart'ı yatay
bölüp gerçek alt panel açma) desteği **yok** — bu özellik v5.0'da geldi.
v5'e geçmek `chart-pane.js`'in `addLineSeries`/`addHistogramSeries`/
`addCandlestickSeries` gibi TÜM v4 API çağrılarını yeniden yazmayı
gerektirir — bu görevin kapsamı dışında, riski yüksek bir iş.

**Karar:** v4.1.3 korundu. RSI için v4-döneminin standart çözümü
kullanıldı: ikinci, senkronize bir `createChart()` örneği.

### TV ile aynı sonuç — EMA seed düzeltmesi

TradingView'in `ta.ema()` fonksiyonu ilk EMA değerini SMA (ilk `period`
bar'ın basit ortalaması) ile başlatır, sonra üzerine EMA formülünü
işletir. Projenin mevcut `_emaSeries` (indicator-engine.js, botlar
tarafından kullanılıyor) ilk değeri doğrudan ilk kapanış fiyatı yapıyordu
— TV ile eşleşmiyor.

**Bot-architecture kuralı** (mevcut sinyal davranışı değişmemeli)
gereği botların kullandığı `_emaSeries`/`calcRSI`/`calcDEMA`'ya
DOKUNULMADI. Bunun yerine chart için YENİ, ayrı bir fonksiyon ailesi
eklendi (`calcEMAFull`, `calcDEMAFull`, `calcRSIFull` —
`indicator-engine.js`), SMA-seed EMA kullanıyor, TV ile birebir eşleşiyor.

## Yapılanlar

### `js/screener/indicator-engine.js`

- `_smaSeedEmaSeries(values, period)` — TV'nin `ta.ema()` davranışı,
  tam seri döner.
- `calcEMAFull(closes, period=20)` — chart overlay için.
- `calcDEMAFull(closes, period=9)` — DEMA = 2×EMA1 − EMA(EMA1), tam seri.
- `calcRSIFull(closes, period=14)` — Wilder RSI, yuvarlanmamış, tam seri
  (mevcut `calcRSI`'nin O(n²) olan `calcSRSI`'sinden farklı — bu O(n)).

### `js/chart/chart-pane.js` — `ChartPane` sınıfına eklenenler

- `this.indicators` dizisi (`{id, type, period, color}`), constructor'da
  kayıtlı state'ten geri yükleniyor (`getState()`'e de eklendi —
  sayfa yenilendiğinde indikatörler kalıcı).
- `addIndicator(type, opts)` / `removeIndicator(id)` /
  `updateIndicatorSettings(id, patch)` — public API.
- `_rebuildIndicatorOverlays()` — EMA/DEMA için `addLineSeries()`,
  RSI varsa `_ensureRsiPane()` çağırır.
- `_ensureRsiPane()` / `_destroyRsiPane()` — ikinci `createChart()`
  örneği (120px sabit yükseklik, `.pane-wrap`'in altına flex ile
  eklenir). Zaman ekseni İKİ YÖNLÜ senkron
  (`subscribeVisibleLogicalRangeChange`, sonsuz döngüye karşı `syncing`
  bayrağıyla korunuyor), crosshair de iki yönlü senkron
  (`subscribeCrosshairMove` + `setCrosshairPosition`/`clearCrosshairPosition`).
  30/70 referans çizgileri (`_rsiBand70`/`_rsiBand30`).
- `_recomputeAllIndicators(tickOnly, liveOverride)` — `this.candlesData`'dan
  hesaplar. `tickOnly=true` iken (canlı tick) tüm seri yine hesaplanır
  (ucuz döngü) ama LWC serisine sadece SON nokta `.update()` ile
  yollanır — her tick'te tüm seriyi `.setData()` ile yeniden çizmek
  yerine (gereksiz redraw'dan kaçınma). `liveOverride` — `_onFeedTick`
  `candlesData`'yı kendi güncellemediği için (`_onLiveCandle`'ın
  aksine), henüz kaydedilmemiş son close/time'ı geçici olarak hesaba
  ekler.
- `_updateIndicatorLegend(valuesOnly)` — chart'ın sol-üst köşesinde TV
  tarzı bir legend (`EMA(9) 43210.5`, indikatör renginde). `valuesOnly`
  modu canlı tick'lerde DOM'u (ve hover listener'larını) yeniden
  kurmadan sadece değer metnini günceller.
- Legend satırı hover → ⚙ (Settings, `indicator:editRequested` event'i
  emit eder) / ✕ (doğrudan `removeIndicator`).
- `_onFeedCandles`/`_onFeedTick`/`_onLiveCandle`/`_onOlderCandles`
  içine `_recomputeAllIndicators()` çağrıları eklendi.
- ResizeObserver callback'i genişletildi — RSI alt-chart'ı ana chart'la
  aynı genişlikte kalıyor.
- `destroy()` içine `_destroyRsiPane()` eklendi (bellek sızıntısı yok).

### `js/core/app.js` — `_bindIndicatorsModal()` (yeni)

- Navbar'daki "Indicators" butonu (`btn-indicators`, önceden hiçbir
  click handler'ı yoktu — sadece yanındaki ok favoriler menüsünü
  açıyordu) artık TV'ye benzer bir arama/ekleme modalı açıyor: arama
  kutusu + EMA/DEMA/RSI listesi (isim + kısa açıklama). Tıklanınca
  `LayoutManager.getActivePane().addIndicator(type)` çağrılır.
- `EventBus.on('indicator:editRequested', ...)` — legend'in ⚙ ikonundan
  gelen event'i dinler, minimal bir ayar popup'ı açar (Length + Color +
  Remove/Cancel/Apply), `pane.updateIndicatorSettings()` /
  `pane.removeIndicator()` çağırır.
- İkisi de mevcut Alarm modalının `.modal-backdrop`/`.modal`/
  `.modal-header`/`.modal-body`/`.modal-footer`/`.form-input`/`.btn`
  CSS sınıflarını kullanıyor — yeni CSS eklenmedi, görsel dil tutarlı.

## Doğrulama

Sandbox'ın Binance API erişimi 502 döndüğü için gerçek canlı veri
yüklenemedi — bunun yerine tarayıcıda gerçek modüllerle, sentetik mum
verisiyle uçtan uca test edildi (`javascript_exec`):

1. `IndicatorEngine.calcEMAFull` — bilinen 9-periyotluk referans veriyle
   ilk değerin SMA(ilk 9 close)'a birebir eşit olduğu doğrulandı
   (22.2133...). ✅
2. `IndicatorEngine.calcRSIFull` — StockCharts.com'un klasik Wilder RSI
   örnek verisiyle 14. barda RSI=70.46 (referans ≈70.5) — uyumlu. ✅
3. 100 barlık sentetik mum verisiyle pane'e EMA(9)+DEMA(9)+RSI(14)
   eklendi: overlay çizgileri (mavi/turuncu) chart'ta doğru render oldu,
   RSI için ayrı senkron alt-chart açıldı, legend üç satırı da doğru
   değerlerle gösterdi (ekran görüntüsüyle görsel doğrulama). ✅
4. Canlı tick simülasyonu (`_onFeedTick`, forming bar'a +5 fiyat) —
   EMA/RSI değerleri VE legend metni anında (DOM yeniden kurulmadan)
   güncellendi. ✅
5. "Indicators" modalı: arama filtresi ("rsi" yazınca sadece RSI
   listede kalıyor) doğru çalıştı, öğeye tıklayınca aktif pane'e
   ekleniyor. ✅
6. Legend hover → ⚙/✕ ikonları doğru açılıp kapandı. ⚙ → Settings
   popup'ı açıldı, period 9→21 değiştirilip Apply'a basılınca indikatör
   doğru yeniden hesaplandı. ✅
7. Remove: indikatör kaldırılınca series/legend satırı kayboldu; son
   RSI kaldırılınca alt-chart tamamen yok edildi. ✅
8. `getState()`: `indicators` dizisi runtime `_lastValue` sızdırmadan
   temiz `{id,type,period,color}` şeklinde döndü. ✅
9. Konsol hatasız (bilinen sandbox 502/Binance ağ hataları hariç). ✅

## Bilinen sınır

RSI alt-chart'ının fiyat ekseni (y-axis) piksel genişliği ana chart'la
MATEMATİKSEL OLARAK garanti eşit değil — iki ayrı `createChart()`
örneği kullanıldığı için (v4'te ortak genişlik zorlaması API'si yok,
bu v5'in native pane'lerinde çözülmüş bir sorun). Pratikte aynı font/
boyut kullanıldığından fark birkaç piksel, gözle ayırt edilmiyor.
Gerçek Binance/Bybit canlı veriyle (bu sandbox'ta erişilemedi) bir kez
daha görsel kontrol önerilir.

## Sırada

**Görev 14.2** (henüz başlanmadı, kullanıcı onayı bekliyor): Indicators
sidebar sekmesi — artık gerçek veri var (`ChartPane.indicators`),
Alerts sekmesine benzer bir liste + edit/delete paneli eklenebilir.

## Değişen/yeni dosyalar

- `js/screener/indicator-engine.js` (`calcEMAFull`/`calcDEMAFull`/
  `calcRSIFull` eklendi, mevcut bot fonksiyonlarına dokunulmadı)
- `js/chart/chart-pane.js` (indikatör alt-sistemi: overlay series, RSI
  alt-chart, legend, canlı güncelleme, kalıcılık)
- `js/core/app.js` (`_bindIndicatorsModal()` — arama/ekleme modalı +
  ayar popup'ı)
