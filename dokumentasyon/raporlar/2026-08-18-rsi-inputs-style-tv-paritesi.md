# RSI ayar penceresi — Inputs/Style sekmelerinde TV paritesi (2026-08-18)

## Bağlam

Önceki işte (`e5c9380`) RSI için Inputs/Style/Visibility sekmeli gerçek bir
ayar penceresi eklenmişti ama kullanıcı TV'nin RSI ayar penceresinden (Inputs/
Style ekran görüntüleri) çok sayıda alanın hâlâ eksik olduğunu belirtti:
Source, Calculate Divergence, Smoothing (RSI-based MA), Middle Band, band
renkleri, Output/Input values (precision, price scale label, status line
toggle'ları).

Kapsam kullanıcıyla netleştirildi: **Divergence'ın pivot tespiti/etiketleme
algoritması** (Regular Bullish/Bearish çizgileri) ayrı, sonraki bir işe
bırakıldı — bu iş sadece "basit" Inputs/Style alanlarını kapsıyor.

## Yapılanlar

**`js/screener/indicator-engine.js`** — `calcMAOfSeries(series, period, type)`
eklendi: `sma`/`ema`/`smma` (RMA)/`wma` — RSI gibi baştan null'lu bir seri
üzerinde çalışabiliyor (ilk geçerli değerden itibaren hesaplar).

**`js/chart/chart-pane.js`**:
- `RSI_DEFAULTS_APPLY`: `source`, `maType`/`maLength`/`maColor`/`showMA`,
  `middleBand`, `precision`, `showPriceLabels`, `showValuesInStatusLine`,
  `showInputsInStatusLine` varsayılanları eklendi.
- `RSI_PRECISION_DECIMALS(cfg)` / `RSI_SOURCE_SERIES(candles, source)` yeni
  static yardımcılar.
- Subpane RSI serisi artık `cfg.precision`'a göre `priceFormat.precision` ve
  `cfg.showPriceLabels`'a göre `lastValueVisible` kullanıyor (önceden 2
  ondalık + `false` sabitti).
- `_rebuildSubpaneAux`: Middle Band (50) üçüncü bir referans çizgisi olarak
  Upper/Lower ile birlikte çiziliyor; RSI-based MA için üçüncü bir
  `LineSeries` (`aux.ma`) eklendi — `cfg.maType==='none'` veya
  `showMA===false` iken rengi saydam yapılıyor (seriyi silip yeniden
  kurmak yerine).
- `_recomputeAllIndicators`: `cfg.source !== 'close'` ise RSI, closes yerine
  `RSI_SOURCE_SERIES` çıktısı üzerinden hesaplanıyor (Open/High/Low/HL2/HLC3/
  OHLC4). RSI dizisi üzerinden `calcMAOfSeries` ile MA hattı besleniyor.
- `_updateIndicatorLegend`: `showValuesInStatusLine`/`showInputsInStatusLine`
  toggle'larına göre legend satırındaki değer/`(period)` kısmı gizlenebiliyor;
  değer artık `cfg.precision`'a göre yuvarlanıyor.

**`js/core/app.js`** (`_bindIndicatorsModal` içindeki RSI ayar penceresi):
- Inputs sekmesi: Length + **Source** (dropdown) + **Calculate Divergence**
  (checkbox, şimdilik sadece `cfg.divergenceEnabled`'ı saklıyor — pivot
  algoritması yok) + **Smoothing** bölümü (Type: None/SMA/EMA/SMMA (RMA)/WMA,
  Length).
- Style sekmesi: RSI line + **RSI-based MA** rengi + **Upper/Middle/Lower
  Band** satırları (TV gibi swatch + değer aynı satırda; üç bandın rengi
  paylaşılan `cfg.bandColor`'a yazılıyor, biri değişince diğer ikisi görsel
  olarak senkron güncelleniyor) + mevcut fill/OB/OS/crosshair + yeni
  **Output values** (Precision, Labels on price scale, Values in status
  line) ve **Input values** (Inputs in status line) bölümleri.
- Modal genişliği 320px → 340px (yeni dropdown'lar için).

## Bilinçli kapsam dışı bırakılanlar

- **Divergence pivot tespiti + Regular Bullish/Bearish çizgi/etiketleri** —
  ayrı algoritma gerektiriyor, kullanıcı onayıyla sonraki işe bırakıldı.
- **Smoothing: SMA + Bollinger Bands seçeneği ve BB StdDev alanı** — bant
  render'ı ek karmaşıklık; TV'nin "basit alanlar" kapsamına girmiyor.
- **Calculation: Timeframe / Wait for timeframe closes** — çoklu zaman
  dilimi hesaplaması ayrı veri kaynağı gerektiriyor, kapsam dışı.

## Doğrulama

- `node --check` üç dosya için de temiz.
- `IndicatorEngine.calcMAOfSeries` (ema/smma/wma) Node'da manuel örnek
  veriyle test edildi, sonuçlar sayısal ve makul aralıkta.
- Tarayıcıda (Browser pane) ayar penceresi açılıp Inputs/Style sekmeleri
  `get_page_text` ile TV ekran görüntüsündeki alanlarla karşılaştırıldı —
  birebir eşleşiyor. `updateIndicatorSettings` çağrısı sonrası `cfg.maType`/
  `cfg.source` doğru şekilde kaydedildi (JS ile doğrulandı).
- **Görsel doğrulama yapılamadı**: bu oturumdaki Browser pane compositing
  yapmıyor (`screenshot` "pane not displayed" hatası verdi), bu yüzden LWC'nin
  `ResizeObserver`'ı hiç tetiklenmedi ve chart `_chartReady=false` kaldı
  (subpane serileri hiç kurulmadı). Bu ortamın kısıtı — kodda `_chartReady`
  mantığı önceki işten değişmedi. Kullanıcının kendi tarayıcısında normal
  kullanımda bu sorun yaşanmaz (bkz. önceki raporlardaki resize akışı).

## 2. tur (2026-08-19) — Neon checkbox düzeltmesi + Divergence

Kullanıcı sert bir şekilde iki şeye takıldı: (1) Style sekmesinde `.tv-check-box`
işaretliyken **DOLU `--accent-blue` (#00f3ff, neon camgöbeği) arka fon**
kullanıyordu — bu, `[[pintrade-neon-buton-arka-fon-yasak]]` hafızasındaki
"aktif butonlarda asla dolu neon arka fon yok" kuralının checkbox'lara da
uygulanmamış hali. (2) TV'nin Style sekmesindeki HER satırın solunda kendi
göster/gizle checkbox'ı var, bizimkinde hiç yoktu.

**Checkbox düzeltmesi** — proje genelinde zaten var olan, kullanıcının
ONAYLADIĞI, neon OLMAYAN checkbox deseni bulundu: `css/drawing-toolbar.css`
`.dsd-checkbox-label` (düz native `<input type="checkbox">` + `accent-color:
#2962ff` — TV mavisi, dolu neon arka fon yok) — regression channel, Fibonacci,
annotation gibi TÜM çizim araçları ayar pencerelerinde zaten kullanılıyordu.
Yeni bir tasarım İCAT EDİLMEDİ, `js/core/app.js`'teki `_rsiCheck()` (Inputs/
Output-Input/Visibility checkbox'ları) bu deseni kullanacak şekilde değiştirildi.

**Style sekmesinde satır-başı checkbox'lar** — `_rsiToggleRow()` (yeni
yardımcı) her satırın soluna aynı `accent-color:#2962ff` checkbox'ı ekliyor:
RSI (çizgi), RSI-based MA, Regular Bullish, Regular Bearish, RSI Upper/
Middle/Lower Band (üçü `cfg.showBandLines`'a birlikte yazıyor — renkler gibi),
Background/Overbought/Oversold fill. Crosshair marker satırında TV'de de
checkbox yok, o yüzden eklenmedi. Yeni cfg alanları: `showLine`,
`showDivBullish`, `showDivBearish`, `bullColor` (#26a69a), `bearColor`
(#ef5350). Visibility sekmesi (showBandLines/showFill/showOB/showOS) BİLEREK
dokunulmadan bırakıldı — aynı alanlara ikinci bir erişim noktası, çakışma yok.

**Divergence (Regular Bullish/Bearish) — artık TAM çalışıyor:**
- `IndicatorEngine.calcRegularDivergence(rsiArr, lowArr, highArr, opts)`
  (yeni) — TV'nin RSI script'indeki AYNI mantık: `ta.pivotlow`/`ta.pivothigh`
  (lbL=5, lbR=5) ile RSI üzerinde pivot bul, ardışık iki pivot-low arasında
  RSI yükselirken fiyatın (low) düşmesi = Regular Bullish; ardışık iki
  pivot-high arasında RSI düşerken fiyatın (high) yükselmesi = Regular
  Bearish. Pivot arası bar sayısı [5,60] dışındaysa (rangeLower/rangeUpper)
  sinyal sayılmıyor — TV'nin sabit varsayılanları.
- `chart-pane.js`: `_recomputeAllIndicators` içinde `cfg.divergenceEnabled`
  açıkken (ve sadece TAM veri geçişinde, tick'te değil — pivot son `right`
  bar'a kadar netleşmiyor) `calcRegularDivergence` çağrılıp
  `_renderRsiDivergence(cfg, div, rsiArr, times)` ile RSI subpane'inde
  çiziliyor: her pivot çifti için 2 noktalı kısa bir `LineSeries` (bağlantı
  çizgisi, `cfg.bullColor`/`cfg.bearColor`) + `LightweightCharts.
  createSeriesMarkers()` ile ana RSI serisine "Bull"/"Bear" metin+ok
  marker'ı. Divergence kapatılınca `_clearRsiDivergence` çizgileri siler,
  marker'ları boşaltır. İndikatör tamamen kaldırılınca (`_rebuildIndicatorOverlays`
  temizlik bloğu) segment serileri + marker handle'ı da siliniyor.
- Performans: en fazla son 30 bullish + 30 bearish sinyal render ediliyor
  (`MAX_PER_SIDE`).

**Bilinçli basitleştirme** (kullanıcıya açıkça belirtildi): TV'nin "Regular
Bullish"/"Regular Bearish" için AYRI "...Label" satırı, Color0/Color1
gradyanı ve etiket "Absolute" pozisyon dropdown'ı YOK — tek checkbox + tek
renk, çizgi ve etiket birlikte açılıp kapanıyor. Fonksiyonel olarak divergence
tespiti ve görselleştirmesi TAM çalışıyor, sadece bu ince stil alt-kontrolleri
kapsam dışı bırakıldı.

**Doğrulama (2. tur):** `node --check` üç dosyada da temiz.
`calcRegularDivergence` Node'da yapay bullish-divergence senaryosuyla test
edildi (4 sinyal doğru bulundu). Tarayıcıda: Style sekmesi metni TV
ekran görüntüsüyle satır satır karşılaştırıldı (birebir eşleşiyor); tüm
checkbox'ların `accentColor`'ı `rgb(41, 98, 255)` (#2962ff, TV mavisi)
olarak doğrulandı — neon YOK. `pane._chartReady` zorla `true` yapılıp seriler
gerçekten kurdurularak (bu ortamda ResizeObserver hâlâ tetiklenmiyor)
`aux.ma`/`aux.ob`/`aux.os` serilerinin oluştuğu, `_renderRsiDivergence`'ın
yapay pivot verisiyle 3 segment + marker handle ürettiği, `_clearRsiDivergence`
ve indikatör kaldırmanın hatasız temizlik yaptığı JS ile doğrulandı — konsolda
hiç hata yok. Gerçek piyasa verisiyle uçtan uca görsel doğrulama yine bu
ortamın ağ erişimi olmaması + Browser pane'in compositing yapmaması yüzünden
yapılamadı (candlesData bu sandbox'ta hiç dolmuyor, `Failed to fetch`).

## 3. tur (2026-08-19) — Kritik bug: opak gri kaplama + 6 kullanıcı bulgusu

Kullanıcı 7 madde bildirdi: (1) ayar penceresinde HERHANGİ bir değişiklik
sonrası RSI panelinde 30-70 arası dev, opak gri bir blok oluşuyor, (2) F5
sonrası RSI paneli kayboluyor/kaydırılamıyor, sadece fiyat eksenine çift
tıklayınca geri geliyor, (3) Remove/Delete önce onay sormalı, (4) Calculation
bölümü (Timeframe + Wait for timeframe closes) eksik, (5) çizgi renk
paletleri projedeki mevcut renk+kalınlık+stil combo'sunu kullanmalı, (6) aynı
gri kaplama bölücü çizgiyi sürükleyince de oluşuyor, (7) RSI-based MA açık
olduğu halde grafikte görünmüyor.

**Kök neden bulundu (1, 6, 7 — TEK bug):** `js/core/app.js`'teki `_rsiSwatch()`
her zaman `_toHex(cfg.fillColor)` gibi **alfası SİLİNMİŞ** bir hex'i
`data-color`'a yazıyordu. `_rsiSyncDraftFromDom()` ise HER sekme geçişinde/
Ok'ta kullanıcı dokunsun dokunmasın swatch'ın `dataset.color`'ını cfg'ye geri
yazıyordu — yani `fillColor`/`obColor`/`osColor` gibi düşük-alfa (%6-35)
renkler ayarlara her girişte SESSİZCE opak hale geliyordu. Dolgu div'i
(`_indFillEl`) chart canvas'ının ÜSTÜNDE (`z-index:1`) durduğu için opak
hale gelince altındaki RSI çizgisini, MA'yı, band çizgilerini TAMAMEN
görünmez yapıyordu — kullanıcının "MA yok" (7) ve "dev gri blok" (1)
bulguları AYNI kökten. **Düzeltme:** `_rsiSwatch` artık HAM (alfa dahil)
rengi `data-color`'a yazıyor, `_toHex` SADECE swatch'ın görsel önizlemesi
için kullanılıyor. Node/tarayıcı testiyle doğrulandı: sekme geçişi + Ok
sonrası `fillColor`/`obColor`/`osColor`/`bandColor` artık aynı alfayla
korunuyor.

**(6) Bölücü çizgi sürüklemesi — ayrı ama ilişkili kök neden:**
`_repositionIndicatorFills()` sadece `this.cvs`'nin TOPLAM boyutu değişince
(ResizeObserver) çağrılıyordu. LWC v5'in KENDİ ana-chart/RSI-paneli bölücüsünü
sürüklemek `cvs`'nin toplam boyutunu DEĞİŞTİRMEZ — sadece pane'ler arası
oranı — yani dolgu div'i hiç yeniden konumlanmıyordu. **Düzeltme:**
`this.cvs`'e `mousedown` dinleyicisi eklendi; herhangi bir sürükleme
sırasında (RSI dahil) `requestAnimationFrame` ile dolgu her karede yeniden
konumlanıyor, `mouseup`'ta durduruluyor.

**(3) Silme onayı:** Hem RSI ayar penceresindeki "Remove" hem de sol-üst
legend'daki ✕ butonu artık `window.confirm('Remove RSI indicator? This
cannot be undone.')` (İngilizce) ile onay istiyor, reddedilirse silmiyor —
JS ile hem kabul hem red senaryosu test edildi.

**(5) Çizgi renk/kalınlık/stil combo'su:** RSI/RSI-based MA/Regular Bullish/
Regular Bearish/Upper-Middle-Lower Band satırlarındaki düz renk swatch'ları
kaldırıldı, yerine projede Trendline/Regression Channel gibi araçlarda
ZATEN kullanılan `DSDColorPicker.showCombinedLineSettings()` +
`.dsd-reg-line-combo`/`.dsd-reg-swatch` deseni (renk paleti + opacity +
Thickness [1-4] + Style [Solid/Dashed/Dotted], tek popover) BİREBİR
taşındı — yeni bir picker icat edilmedi. Yeni cfg alanları: `width`/
`lineStyle` (RSI çizgisi), `maWidth`/`maStyle`, `bullWidth`/`bullStyle`,
`bearWidth`/`bearStyle`, `bandWidth`/`bandStyle` — hepsi ilgili LWC
serisine/`createPriceLine`'a işleniyor (`ChartPane.LWC_LINE_STYLE()` yeni
static yardımcı, dsd-color-picker'ın 'solid'/'dashed'/'dotted' string'lerini
LWC'nin `LineStyle` enum'una çeviriyor). Band'ların üçü (Upper/Middle/Lower)
tek paylaşılan renk+kalınlık+stile yazıyor (renklerdeki gibi, tek bant
setinin parçaları). Tarayıcıda: combo tıklanıp genişlik=3/stil=dashed
seçildi, Ok'a basıldı, `cfg.width===3 && cfg.lineStyle==='dashed'` doğrulandı.

**(4) Calculation bölümü:** Inputs sekmesine TV'deki gibi **Timeframe**
(Chart + 1m…1M sabit liste) ve **Wait for timeframe closes** checkbox'ı
eklendi (`cfg.calcTimeframe`, `cfg.waitForTfClose`). **Bilinçli kısmi
kapsam:** sadece `calcTimeframe==='chart'` (varsayılan) fonksiyonel — farklı
bir TF seçilirse o TF'in kendi mum akışının ayrıca çekilmesi gerekir, bu da
`CLAUDE.md`'de özellikle işaretlenen **paylaşılan Binance ağırlık bütçesini**
büyütür (chart'ın kendi mum çekme trafiği zaten botlarla aynı sunucu IP'sini
paylaşıyor). Bu yüzden alan şimdilik sadece SAKLANIYOR, gerçek çoklu-TF
hesaplaması ayrı bir onay/iş olarak bırakıldı — "Calculate Divergence"
checkbox'ının ilk turda algoritmasız eklenmesiyle AYNI kalıp.

**(2) F5 sonrası RSI paneli kaybolması — KESİN kök neden DOĞRULANAMADI.**
Bu sandbox'ta Browser pane hiç compositing yapmadığı için (`_chartReady`
gerçek bir resize olmadan asla `true` olmuyor) sorunu birebir yeniden
üretip gözlemleyemedim. Bulgu: `pane.setStretchFactor(0.3)` şu ana kadar
SADECE ilk kurulumda (`_indSeries[cfg.id]` henüz yokken) çağrılıyordu; artık
`_rebuildIndicatorOverlays()` her çalıştığında (var olan RSI için de)
yeniden uygulanıyor — LWC'nin stretch factor'ü reload/resize sırasında
sıfırlama ihtimaline karşı ucuz/zararsız bir savunma olarak eklendi. **Bu
düzeltme doğrulanamadı** — sorun devam ederse (özellikle tam olarak hangi
adımda kaybolduğu: F5'ten hemen sonra mı, yoksa TF/sembol değiştirince mi)
kesin tekrar üretim adımlarıyla ayrı bir iş olarak ele alınmalı.

**Doğrulama:** `node --check` üç dosyada da temiz. Tarayıcıda gerçek
BTCUSDT verisiyle (bu turda sunucu+ağ çalışıyordu) test edildi: fillColor/
obColor/osColor/bandColor'ın sekme geçişi+Ok sonrası alfası korundu; combo
picker açılıp width/style değişikliği `cfg`'ye doğru yazıldı; Calculation
bölümü render kontrolü yapıldı; her iki Remove/Delete noktasında onay
diyaloğu doğru mesajla açılıp reddedilince silmediği doğrulandı; konsolda
ilgisiz `Failed to fetch` (Binance, bu spesifik sandbox oturumunun ağ
kısıtı) dışında hata yok.

## 4. tur (2026-08-19) — 8 madde: dialog scroll, mıknatıs, silme onayı merkezi, band bağımsızlığı

- **(1+2) Dialog kaydırma:** `.dsd-overlay`/`.dsd-dialog`/`.dsd-body`
  (`css/drawing-toolbar.css`) — dialog artık `max-height: calc(100vh - 19vh)`
  ile sınırlı, `.dsd-body` `overflow-y:auto` + `min-height:0` (flex child'ın
  taşmasını engelleyen standart flexbox deseni). Bu SADECE RSI'a özgü değil,
  `.dsd-dialog`/`.dsd-body` TÜM çizim araçları ayar pencerelerinde ortak
  olduğu için genel bir düzeltme — düşük çözünürlüklü monitörlerde herhangi
  bir uzun ayar penceresi artık taşmıyor, kayıyor. Tarayıcıda doğrulandı:
  `bodyScrollHeight(685) > bodyClientHeight(433)`, `overflow-y:auto`.

- **(3) Mıknatıs subpane'de devre dışı:** Kök neden bulundu —
  `js/drawing/core/drawing-core.js`'te TÜM y→fiyat dönüşümü HER YERDE
  `pane.series` (ana mum serisi) üzerinden yapılıyor; subpane'in (RSI) kendi
  ölçeği hiç kullanılmıyor — bu, çizim araçlarının mimari olarak SADECE ana
  panel için tasarlandığını gösteriyor (~30 çağrı noktası). **Bilinçli kısmi
  kapsam:** subpane'in kendi 0-100 ölçeğine göre TAM doğru y→fiyat eşlemesi
  kapsamlı bir refactor gerektirir (tüm `pane.series.coordinateToPrice`
  çağrılarının pane-farkında hale getirilmesi). Bu turda TV'nin asıl istenen
  davranışı hedeflendi: `onMouseDown`/`onMouseMove` başında imlecin ana
  panelin (`pane.chart.panes()[0]`) yüksekliğini aşıp aşmadığı (`_cursorOverSubpane`)
  hesaplanıyor, `_snapToCandle()` bu bayrak true'yken mıknatısı (mod ne
  olursa olsun) devre dışı bırakıp ham koordinatları döndürüyor — TV'deki
  "subpane'de mıknatıs kaybolur, serbest çizim" davranışına eşdeğer.

- **(4) Silme onayı artık MERKEZDE:** Native `window.confirm()` Chrome'da
  sayfanın EN ÜSTÜNDE bir bar olarak açılıyordu (kullanıcı bulgusu) — yeni
  `js/ui/confirm-modal.js` (`window.ConfirmModal.show(message)`, Promise
  döner) projenin kendi `.modal-backdrop`/`.modal` (css/components.css,
  zaten `display:flex; align-items:center; justify-content:center` ile
  viewport ortasına oturan, Indicators arama modalında da kullanılan aynı
  desen) ile merkezde açılıyor. **Üç ayrı silme noktası** güncellendi (ikisi
  önceki turda `window.confirm` ile eklenmişti, ÜÇÜNCÜSÜ hiç dokunulmamıştı
  ve onaysız direkt siliyordu): RSI ayar penceresi "Remove" (`app.js`),
  legend'daki ✕ (`chart-pane.js`), VE sağ sidebar "Ind." sekmesindeki çöp
  kutusu ikonu (`js/screener/indicator-list-panel.js` — `.il-delete`, bu
  turda YENİ bulundu). Tarayıcıda doğrulandı: modal merkezde
  (`display:flex/center/center`) açılıyor, Cancel'a basınca silmiyor.

- **(5) RSI-based MA — kod tarafında yeniden doğrulandı, çözülemedi/net
  değil:** Gerçek dialog akışıyla (Inputs→Type:SMA→Style sekmesi→Ok) uçtan
  uca tekrar test edildi: `cfg.maType`, `cfg.showMA`, seri `options()`
  (`color:'#f7c948'`, `visible:true`, `lineVisible:true`) ve `data()`
  (1473 nokta, gerçek RSI-ölçeğinde değerler) HEPSİ doğru. Koddan/veriden
  bir sorun bulunamadı. Bu sandbox'ta piksel-doğrulama (screenshot)
  yapılamadığı için kesin teşhis konamadı. **Kullanıcıdan istenen:** sert
  yenileme (Ctrl+Shift+R) — bu projenin `index.html`'indeki `<script>`
  etiketlerinde cache-busting yok, tarayıcı eski `chart-pane.js`/`app.js`'i
  önbellekten sunuyor olabilir. Hâlâ görünmüyorsa ekran görüntüsüyle
  bildirilmesi gerekiyor (hangi ayarlarla, hangi sırayla).

- **(6) Upper/Middle/Lower Band artık BAĞIMSIZ:** Önceki turda "tek bant
  seti" mantığıyla BİLEREK tek `bandColor`/`bandWidth`/`bandStyle`'a
  bağlanmıştı — kullanıcı ayrı ayrı istedi. `RSI_DEFAULTS_APPLY`'da
  `upperBandColor/Width/Style`, `middleBandColor/Width/Style`,
  `lowerBandColor/Width/Style` (eski `bandColor`/`bandWidth`/`bandStyle`
  varsa geriye dönük uyumluluk için İLK DEĞER olarak kullanılıyor).
  `_rebuildSubpaneAux`'ta üç `createPriceLine` çağrısı artık kendi
  renk/kalınlık/stiliyle. `app.js`'te 3 combo artık birbirinden bağımsız
  (önceki "biri değişince üçü de değişir" senkronizasyon mantığı kaldırıldı).
  Tarayıcıda doğrulandı: Upper Band kırmızıya çevrildi, Middle/Lower gri
  kaldı, Ok sonrası `cfg.upperBandColor`/`middleBandColor`/`lowerBandColor`
  bağımsız doğrulandı.

- **(7) "Values/Inputs in status line" ne işe yarıyor:** RSI panelinin
  sol-üst köşesindeki küçük yazıyı ("RSI(14) 54.51") kontrol ediyor —
  "Inputs" kapalıyken "(14)" kısmı, "Values" kapalıyken sayısal değer
  kaybolur. Kod yeniden okunup doğru bağlı olduğu doğrulandı
  (`_updateIndicatorLegend`, `showInputs`/`showValues` koşulları) — etkisi
  küçük/subtle bir metin farkı olduğu için fark edilmemiş olabilir.

- **(8) Crosshair üzerinde level badge'i — netleştirme gerekiyor, henüz
  yapılmadı:** LWC'nin kendi "crosshair fiyat ekseni etiketi" (imleç
  hangi seviyedeyse sağ kenardaki eksende otomatik gösterilen küçük kutu)
  RSI panelinde zaten AÇIK olmalı (hiçbir yerde `labelVisible:false`
  yapılmamış) — bu muhtemelen istenen şey. Eğer bunun yerine imlecin/noktanın
  TAM ÜSTÜNDE, ekseninden bağımsız YÜZEN bir badge isteniyorsa (TV'de
  standart olmayan, özel bir özellik) bu ayrı bir iş — hangisini
  kastettiğini netleştirirsen (mevcut eksen etiketi mi yetersiz, yoksa
  gerçekten imlecin üstünde float eden bir şey mi) ona göre yaparım.

## 5. tur (2026-08-19) — Cache kök nedeni + F5 pane + floating badge + band-leak araştırması

Kullanıcı 4. turdaki düzeltmelerin bir kısmının (dialog scroll, RSI-based MA)
GÖRÜNMÜYOR gibi davrandığını bildirdi — bu turda kanıtlanan gerçek kök neden
bulundu: **`server.js`'in statik dosya sunumunda (`express.static('/css')`,
`express.static('/js')`, `res.sendFile('/index.html')`) hiçbir açık
`Cache-Control` yoktu.** Chrome'un "heuristic freshness" davranışı, aynı gün
içinde defalarca değişen JS/CSS dosyalarını normal F5'te SUNUCUYA HİÇ
SORMADAN önbellekten sunabiliyor — kullanıcı bir düzeltmeyi test ettiğinde
GERÇEKTEN eski kodu çalıştırıyor olabilirdi (bu, önceki turlarda "hâlâ
düzelmedi" şeklindeki tekrarlayan raporların en az bir kısmını açıklıyor).
**Düzeltme:** `/css`, `/js` ve `/` için `Cache-Control: no-cache` eklendi —
tarayıcı artık HER İSTEKTE sunucuya sorar (dosya değişmediyse ucuz bir 304,
ETag sayesinde bant genişliği kaybı yok). Tarayıcıda `fetch(..., {cache:
'no-store'})` ile doğrulandı: hem JS hem `/` için `Cache-Control: no-cache`
dönüyor.

- **(1) F5 sonrası RSI paneli — YENİ bir ipucu bulundu, ek savunma eklendi:**
  Kod tabanında AYNI bug ailesinden, ZATEN ÇÖZÜLMÜŞ bir emsal bulundu
  (`_onFeedCandles` içindeki phantom/fitContent yorumu): "mumlar sola
  sıkışıyordu, sadece zaman/fiyat cetveline çift tıklayınca düzeliyordu" —
  çözüm çift tıklamayı beklemeden aynı düzeltmeyi ilk veri geldiğinde
  doğrudan uygulamaktı. Aynı deseni RSI'nin stretch factor'üne uyguladım:
  `pane.setStretchFactor(0.3)` artık HEM ilk kurulumda HEM her rebuild'de
  (önceki tur) HEM DE **ilk gerçek mum verisi geldiğinde bir kez daha**
  (`_onFeedCandles`, `requestAnimationFrame` ile) uygulanıyor — teoriye göre
  LWC ilk `setData()`'dan sonra kendi iç pane layout'unu yeniden hesaplayıp
  daha önce ayarlanmış stretch factor'ü es geçiyor olabilir. **Bu turda da
  KESİN doğrulanamadı** — bu sandbox'ta `_chartReady` (ResizeObserver'a
  bağlı) sayfa GERÇEK boyutlara sahip olsa bile (`1183x632` doğrulandı)
  hiçbir zaman kendiliğinden `true` olmuyor, yani F5 sonrası akışı ADIM
  ADIM organik olarak yeniden üretemedim. Cache düzeltmesiyle birlikte
  şimdi test edip hâlâ oluyorsa: sorunun TAM olarak ne zaman göründüğü (F5
  hemen sonrası mı, ilk mum verisi geldikten sonra mı, TF değiştirince mi)
  ve panelin TAMAMEN mi kayboluyor yoksa çok mu inceliyor önemli — buna göre
  kök nedeni daraltabilirim.

- **(2) Crosshair üzerinde yüzen değer badge'i — eklendi:**
  `js/screener/oi-volume-panel.js`'teki `_attachTooltip()` ile AYNI desen
  (`chart.subscribeCrosshairMove`, `param.seriesData.get(series)`, imlecin
  sağına/üstüne konumlanan bir `<div>`) `ChartPane._attachRsiTooltip(cfg)`
  olarak RSI'ya taşındı — yeni bir mekanizma icat edilmedi. İmleç grafiğin
  HERHANGİ bir noktasında (ana panel dahil, TV'nin diğer indikatörlerdeki
  davranışı) o zaman noktasındaki RSI değerini gösteren bir badge, crosshair
  noktasının hemen sağında/üstünde. İndikatör kaldırılınca
  `unsubscribeCrosshairMove` ile temizleniyor. Tarayıcıda: handler kayıtlı
  olduğu, sahte bir `priceToCoordinate` ile beslenince doğru metni/pozisyonu
  ürettiği doğrulandı (bu sandbox'ta gerçek pane yüksekliği hep 0 olduğu
  için gerçek koordinatla test edilemedi, ama fonksiyon doğru şekilde
  `display:none` ile "henüz konumlanamıyor" durumunu ele alıyor — güvenli
  başarısızlık).

- **(4) Band çizgisi "sızıntısı" — kod tarafında bulunamadı:** `_indPriceLines`
  takibi tekrar tekrar test edildi (aynı RSI üzerinde art arda 4 farklı band
  rengi değişikliği `updateIndicatorSettings` ile uygulandı) — dizi uzunluğu
  HER SEFERİNDE tam 3 kaldı, hiç büyümedi. Eski çizgiler `removePriceLine`
  ile doğru siliniyor. **En olası açıklama: yukarıda bulunan cache bug'ı** —
  kullanıcı muhtemelen ESKİ (2 tur önceki, "3 bandın TEK paylaşılan rengi"
  mantığındaki) JS'i çalıştırıyordu, o kodda renk değişince eski/yeni renk
  karışımı görsel olarak daha olası bir senaryo. Cache düzeltmesinden sonra
  tekrar test edilmesi gerekiyor — hâlâ oluyorsa ekran görüntüsüyle bildir,
  bu kez `_indPriceLines[id].length`'i konsoldan da isteyebilirim.

- **(5) RSI-based MA — kod tarafında (3. kez) doğru bulundu, en olası
  açıklama yine cache:** Değişmedi, önceki turlarki veri/seri doğrulaması
  hâlâ geçerli. Cache düzeltmesinden sonra tekrar denenmesi gerekiyor.

- **(3) Ayarlar penceresi kaydırma — kod tarafında doğru, muhtemelen yine
  cache:** CSS düzeltmesi (`max-height`/`overflow-y:auto`) tarayıcıda tekrar
  doğrulandı (`scrollHeight(685) > clientHeight(433)`, `overflow-y:auto`).
  CSS dosyaları da artık `no-cache` ile sunuluyor.

**Genel not:** Bu turun EN BÜYÜK bulgusu muhtemelen cache düzeltmesi —
4. ve 5. turdaki "hâlâ düzelmedi" raporlarının çoğu, kodun DEĞİL, tarayıcının
eski dosyaları sunmasının sonucu olabilir. Kullanıcıdan istenen: sayfayı bir
kez daha açıp (artık normal F5 bile yeterli olmalı, ama emin olmak için
Ctrl+Shift+R önerilir) 1, 3, 4, 5 numaralı maddeleri TEKRAR test etmesi —
hangileri gerçekten hâlâ bozuksa (cache DIŞINDA gerçek bir bug varsa) o
zaman kesin kalanlar üzerinde derinleşeceğim.
