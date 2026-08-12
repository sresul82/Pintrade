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

## Düzeltme (2026-08-12) — RSI çizgisi ana chart'ın gerisinde kalıyordu

Kullanıcı ekran görüntüsüyle bildirdi: RSI çizgisi ana chart'ın son
mumuyla aynı x-koordinatında bitmiyordu, çok daha "geride" (saatler
önceki bir zamanda) bitiyordu; crosshair'in RSI panelindeki zaman
etiketi de bambaşka bir değer gösteriyordu. Kullanıcı ayrıca "bu acaba
Phantom kullandığımızdan mı" diye doğru teşhisi baştan işaret etti.

### Kök neden 1 — logical range senkronu phantom'dan etkileniyordu

Senkron `subscribeVisibleLogicalRangeChange`/`setVisibleLogicalRange`
(bar-INDEX bazlı) kullanıyordu. Ama ana chart'ta `ChartPhantom` (çizim
araçlarının sağa serbestçe sürüklenebilmesi için — TV'de mumlar
bittikten sonra da istediğin kadar sağa kaydırabiliyorsun, phantom
olmadan bu imkansız) görünmez 500 "hayalet" bar ekliyor. Bu, ana
chart'ın toplam bar sayısını RSI chart'tan (phantom'suz) çok daha
büyük yapıyor — aynı SAYISAL logical range iki chart'ta tamamen farklı
zaman dilimlerine denk geliyordu.

**Düzeltme:** senkron gerçek ZAMAN (timestamp) bazlı —
`subscribeVisibleTimeRangeChange`/`setVisibleRange` — phantom'un bar
sayısından etkilenmiyor.

### Kök neden 2 — ilk setData() senkronu eziyordu

Zaman bazlı senkrona geçtikten sonra bile ilk testte hâlâ eşleşmiyordu.
Sebep: RSI serisine İLK kez gerçek veri `setData()` ile yazılınca LWC
zaman eksenini kendi (çok dar) varsayılan görünümüne sıfırlıyor —
`_ensureRsiPane()`'deki İLK senkron denemesi bu veri henüz gelmeden
yapıldığı için, sonradan gelen `setData()` onu eziyordu.

**Düzeltme:** `_recomputeAllIndicators()`'a bir kerelik
(`_rsiRangeSynced` bayraklı) bir yeniden-senkron eklendi — RSI ilk
gerçek veriyle dolduktan HEMEN SONRA ana chart'ın o anki görünen
aralığı tekrar zorlanıyor. Sonraki `setData()` çağrıları (lazy-load
vb.) artık kullanıcının scroll/zoom'unu bozmuyor (tek seferlik).

### Doğrulama (tarayıcıda, gerçek modüllerle)

- Senkron sonrası `mainRange`/`rsiRange` (timestamp) birebir eşit. ✅
- Son mumun zamanı RSI'ın görünen aralığı içinde. ✅
- Ekran görüntüsü: RSI çizgisi artık ana chart'ın sağ kenarına kadar
  uzanıyor (önceki hatadaki gibi ortada kesilmiyor). ✅
- Manuel scroll/zoom simülasyonu sonrası RSI aralığı anında aynı
  değerlere güncellendi. ✅
- Konsol hatasız (bilinen sandbox 502 hariç). ✅

## Düzeltme 2 (2026-08-12) — tek zaman ekseni + sürüklenebilir ayırıcı + zoom/scroll kilitlenmesi

Kullanıcı iki ekran görüntüsü paylaştı: TV'de RSI eklenince zaman
cetveli sadece en altta (RSI'da) var, projede hem ana chart'ın hem
RSI'ın altında ayrı zaman cetveli vardı. Ayrıca kritik bir regresyon
bildirdi: "chartı eskisi gibi zoom in/out yapamıyorum ve sola
kaydıramıyorum, en son mum sağa doğru yapışmış."

### Kök neden (regresyon)

Düzeltme 1'deki zaman-bazlı senkron İKİ YÖNLÜYDÜ (main↔RSI). RSI
chart'ın phantom'u olmadığı için çok daha dar bir gösterim kapasitesi
var — main'in geniş (phantom'lu) aralığı RSI'a yazılınca RSI bunu
kendi kapasitesine göre kırpıyordu, kırpılmış değer RSI→main yönünde
geri yazılınca ana chart'ın kaydırma/zoom aralığı RSI'ın dar
kapasitesine kilitleniyordu.

### Düzeltmeler

1. Ana chart'ın kendi zaman ekseni RSI aktifken gizleniyor
   (`_destroyRsiPane()`'de geri açılıyor) — artık TV'deki gibi TEK
   zaman ekseni var.
2. RSI→main senkronu artık SADECE kullanıcının faresi gerçekten RSI
   alanının üzerindeyken (`_rsiHoverActive`) uygulanıyor — kendi
   programatik senkronumuzdan (main→RSI) kaynaklanan RSI değişiklikleri
   artık asla main'e geri yazılmıyor, kırpma/geri-besleme döngüsü kırıldı.
3. Ana chart ile RSI arasına sürüklenebilir bir ayırıcı eklendi
   (`.pane-rsi-splitter`) — yükseklik `rsiPaneHeight` olarak
   `getState()`'e kaydediliyor.

### Doğrulama (tarayıcıda, gecikmeli okumalarla — LWC'nin senkron
okuması `setVisibleLogicalRange()`'den hemen sonra bayat değer
döndürebiliyor)

- RSI varken `setVisibleLogicalRange({from:50,to:700})` artık set
  edilen değerde kalıyor, eskiden olduğu gibi `{from:0,to:1111}`'e
  geri dönmüyor (regresyon düzeltmesi doğrulandı). ✅
- Hover aktif değilken RSI'ın kendi range'i programatik değişince main
  etkilenmedi. ✅
- Ana chart'ın zaman ekseni RSI eklenince gizlendi, kaldırılınca geri
  açıldı. ✅
- Sürüklenebilir ayırıcı: sentetik pointerdown→pointermove(-40px)→
  pointerup sonrası `rsiPaneHeight` 120→160 doğru güncellendi, RSI
  penceresi ekranda gerçekten büyüdü. ✅
- Konsol hatasız (bilinen sandbox 502 hariç). ✅

**Bilinen sınır:** RSI alanı üzerinden doğrudan sürükleyerek pan/zoom
yapma bu sürümde garanti değil (LWC'nin kırpma davranışı programatik
testlerde tutarsız sonuç verdi) — ana riskli regresyon (ana chart'ın
KENDİ sürüklemesinin kilitlenmesi) kesin düzeltildi, bu ikincil UX
inceliği ileride ayrıca gözden geçirilebilir.

## Düzeltme 3 (2026-08-12) — KÖKTEN mimari değişikliği: RSI artık ayrı chart değil

Düzeltme 2 canlıda YİNE bozuldu — kullanıcı üç ekran görüntüsü (biri
projeden, ikisi TV referansı) paylaşıp "mum solda RSI sağda alt alta
değiller" dedi. İki BAĞIMSIZ `createChart()` motoru arasında senkron,
gerçek kullanımda tekrar tekrar farklı şekillerde bozuluyordu — mimari
düzeyde bir sorundu, kullanıcıya durumu anlatıp onay alındı (risk:
çizim aracı piksel-hassasiyeti sistemine de dokunmak gerekiyordu).

### Gerçek çözüm

RSI artık ikinci bir `createChart()` DEĞİL — AYNI chart'ın İKİNCİ
fiyat ekseninde (mumlar `right` kullanıyorsa RSI `left`) çiziliyor —
volume histogramının aynı chart'ta overlay çizilmesiyle aynı teknik.
Tek chart/tek zaman ekseni olduğu için hizasızlık ve zoom/scroll
kilitlenmesi YAPISAL OLARAK İMKANSIZ hâle geldi — senkron kodunun
tamamı (`fromMain`/`fromRsi`/crosshair-sync) silindi.

### Yapılanlar

- `_mainScaleId()`/`_rsiScaleId()`, `_applyScaleMargins()` (RSI'nin
  payını ana eksenin alt marjına ekliyor, kullanıcının kendi
  marginTop/marginBottom ayarı korunuyor).
- RSI artık EMA/DEMA ile AYNI kod yolu (`_recomputeAllIndicators`),
  ~80 satırlık RSI'ya özel kod (ayrı chart, 2-noktalı band-series
  hack'i, senkron abonelikleri) kalktı. 30/70 çizgileri artık gerçek
  `series.createPriceLine()` API'siyle.
- Sürüklenebilir ayırıcı artık piksel değil `rsiHeightFrac` (0-1 oran)
  sürüklüyor.
- `_syncDrawingCanvasClip()` (çizim araçlarının piksel-hassas
  konumlandığı fonksiyon) RSI'nin ikinci eksen genişliğini de kırpma
  hesabına katacak şekilde güncellendi.

### Bulunan LWC v4 kısıtı

RSI ekseni GÖRÜNÜR (0-100 etiketli) yapılınca sayı etiketleri ayrılan
banda sığmayıp tüm chart yüksekliğine "sızıyordu" (0-100 yerine 0-300+
gibi anlamsız değerler) — `scaleMargins` küçük bir üst-pay
ayırdığında LWC v4'ün tick-etiket üretiminin marja saygı göstermediği,
doğrulanmış bir kütüphane kısıtı (sabit `autoscaleInfoProvider` ile
de düzelmedi). **Çözüm:** RSI ekseni `visible:false` — veri/konumlama
yine doğru (test edildi), sadece sayı etiketleri gösterilmiyor; değer
zaten legend'de + 30/70 referans çizgilerinde görünür.

### Doğrulama (temiz sayfa yenilemesiyle)

- Zoom/scroll: `setVisibleLogicalRange({from:50,to:700})` RSI aktifken
  artık set edilen değerde kalıyor (başka bir motorun geri yazması
  diye bir şey artık yok). ✅
- Ekran görüntüsü: mumlar üstte, RSI altta, aynı x-koordinatlarında
  (aynı chart olduğu için matematiksel garanti), tek zaman ekseni,
  etiket sızıntısı yok. ✅
- Sürüklenebilir ayırıcı: `rsiHeightFrac` 0.25→0.30 doğru güncellendi. ✅
- Çizim katmanı boyut/konum hesabı doğrulandı (RSI ekseni gizliyken
  `width()` 0 dönüyor, kırpmayı etkilemiyor). ✅
- RSI kaldırılınca ana eksen marjı doğru eski hâline dönüyor. ✅
- Konsol tamamen hatasız. ✅

**Kalan bilinen sınır:** RSI ekseninde TV'deki 0/20/40/60/80/100 sayı
etiketleri yok (kütüphane kısıtı yüzünden bilinçli kapatıldı) — v5'e
geçilmeden tam çözülemeyecek kozmetik bir eksiklik, hizalama/zoom/
scroll doğruluğunu etkilemiyor.

## Düzeltme 4 (2026-08-12) — RSI subpane TAMAMEN KALDIRILDI

Kullanıcı Düzeltme 3'ün sonucunu reddetti: "sen fiyatın üzerine level
çiziyorsun. TVde bu şekilde mi? ... ne farkı var EMA/DEMA'dan" —
etiketsiz eksenli RSI'nin TV'nin gerçek subpane'inden ayırt edilemez
olduğunu, kabul edilebilir olmadığını belirtti.

**Dürüstlük:** Üç farklı yaklaşım (ayrı chart senkronu, ikinci fiyat
ekseni görünür, ikinci fiyat ekseni gizli) hepsi başarısız oldu — bu,
`lightweight-charts v4.1.3`'ün native subpane desteği OLMAMASINDAN
kaynaklanan gerçek bir kütüphane kısıtı. Kullanıcıya doğrudan söylendi.

**Kullanıcı kararı:** RSI subpane özelliği TAMAMEN kaldırıldı (EMA/DEMA
etkilenmedi). v5 migrasyonu ayrı, gelecekteki bir görev olarak
`gorevler3.md` izleme listesine eklendi — subpane gerektiren
indikatörlerin (RSI/MACD/Stochastic) ihtiyacı biriktiğinde TOPLU ele
alınacak. Kom1 canlı gözlem süreci aktif olduğu için şu an chart
tarafında büyük refactor riski alınmıyor.

### Yapılanlar

- `chart-pane.js`: `_ensureRsiPane`/`_destroyRsiPane`/
  `_applyScaleMargins`/`_buildRsiSplitter`/`_positionRsiSplitter`/
  `_rsiScaleId` tamamen silindi (~150 satır). `_rebuildIndicatorOverlays`/
  `_recomputeAllIndicators` sadeleştirildi (sadece EMA/DEMA).
  `_syncDrawingCanvasClip` orijinal (tek eksenli) hâline döndürüldü.
  Kayıtlı state'teki eski `type:'rsi'` girdileri restore sırasında
  sessizce filtreleniyor.
- `app.js`: "Indicators" arama kataloğundan `rsi` kaldırıldı.
- `chart.css`: kullanılmayan `.pane-rsi-splitter` kuralı silindi.

### Doğrulama

- `pane._ensureRsiPane`/`pane._rsiScaleId` artık `undefined`. ✅
- EMA(9)+DEMA(9) chart'ta doğru overlay olarak render oldu. ✅
- "Indicators" modalı artık sadece `["ema","dema"]` listeliyor. ✅
- Konsol hatasız (bilinen sandbox 502 hariç). ✅

**Bkz.** `gorevler3.md` → "İleri seviye — Kom1 gözlem sonrası ele
alınacak" bölümündeki v5 migrasyon notu.

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
