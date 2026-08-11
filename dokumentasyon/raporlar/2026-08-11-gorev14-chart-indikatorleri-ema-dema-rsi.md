# gorevler2.md Görev 14.1/14.2 — Chart İndikatörleri: EMA/DEMA/RSI + Sidebar Sekmesi (Tamamlandı)

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

## Görev 14.2 — Indicators sidebar sekmesi

**Kullanıcı geri bildirimi:** "matematik olarak calisiyor olabilir, ama
fonksiyon olarak daha tam TVdeki gibi deil. simdilik sidebar sekmesi
eklemeye devam et" — TV parity'sindeki eksikler (eye-toggle,
görünürlük, daha fazla stil ayarı) bilinen bir borç olarak bırakıldı,
kullanıcı sidebar sekmesine geçilmesini istedi.

### Yapılanlar

- `js/screener/indicator-list-panel.js` (yeni) — `AlertListPanel`'in
  aynı görsel dilini (liste + edit/delete, TV tarzı) kullanıyor ama
  veri kaynağı global bir store DEĞİL, AKTİF pane'in
  `ChartPane.indicators` dizisi. Header'da aktif pane'in "SYMBOL, TF"'i
  + "+" ekle butonu (mevcut navbar arama modalını tetikler, modal
  tekrar inşa edilmedi). Her satır: renkli nokta + isim + "Length N ·
  değer" + ⚙ (mevcut Görev 14.1 settings popup'ını açar) + 🗑
  (`removeIndicator`).
- `index.html`: `rsb-indicators` sidebar butonu + `dp-indicators-tab` +
  script tag.
- `js/core/app.js` `_bindSidebar()`: yeni sekme için standart
  göster/gizle deseni eklendi.
- `js/chart/chart-pane.js`: `addIndicator`/`removeIndicator`/
  `updateIndicatorSettings` artık `EventBus.emit('pane:indicatorsChanged',
  {paneIdx})` yayınlıyor (önceden bu event yoktu) — liste panelinin
  canlı güncellenmesi için. Ayrıca mevcut `pane:activated` event'i de
  dinleniyor (aktif chart değişince liste yenilensin diye).

### Doğrulama

- Sayfa yenilendikten sonra (localStorage restore) önceki turdan kalan
  2 indikatör + yeni eklenen 2 indikatör TOPLAM 4 satır doğru
  listelendi — bu aynı zamanda 14.1'in kalıcılığının da dolaylı
  doğrulaması. ✅
- Listeden 🗑 → satır ve `pane.indicators`'dan kayboldu (4→3). ✅
- Listeden ⚙ → 14.1'in settings popup'ı doğru açıldı. ✅
- "+" → Add Indicator arama modalını doğru açtı. ✅
- Ekran görüntüsü: header "BTCUSDT, 1H" + "+", satırlar (nokta, isim,
  Length+değer, ⚙/🗑) TV'ye yakın bir liste görünümünde render oldu. ✅
- Konsol hatasız (bilinen sandbox 502 hariç). ✅

## Değişen/yeni dosyalar

- `js/screener/indicator-engine.js` (`calcEMAFull`/`calcDEMAFull`/
  `calcRSIFull` eklendi, mevcut bot fonksiyonlarına dokunulmadı)
- `js/chart/chart-pane.js` (indikatör alt-sistemi: overlay series, RSI
  alt-chart, legend, canlı güncelleme, kalıcılık, `pane:indicatorsChanged`
  event'i — 14.2)
- `js/core/app.js` (`_bindIndicatorsModal()` — arama/ekleme modalı +
  ayar popup'ı; `_bindSidebar()`'a `rsb-indicators` eklendi — 14.2)
- `js/screener/indicator-list-panel.js` (yeni — 14.2)
- `index.html` (`rsb-indicators` butonu + `dp-indicators-tab` + script
  tag — 14.2)
