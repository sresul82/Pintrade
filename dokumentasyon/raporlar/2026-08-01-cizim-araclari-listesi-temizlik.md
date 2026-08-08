# Çizim Araçları — Liste Temizliği + Eksik Araç Envanteri — 2026-08-01

## İstek

Kullanıcı 4 menü ekran görüntüsünde (Gann & Fibonacci, Patterns, Forecast
& Measurement, Geometric Shapes) kırmızı çizgiyle işaretlediği araçların
listeden kaldırılmasını ve kodda ait parçalarının temizlenmesini istedi:
"resimlerde yanina kirmizi cizgi attigim araclari listeden kaldir, ve
kodda ait olan parcalari varsa temizle. simdilik listeyi duzenleyelim,
sonra isleve gececez". Ayrıca kalan araçlardan altı boş/tam bitmemiş
olanların listelenmesi istendi.

## Kaldırılan araçlar

| Grup | Kaldırılan |
|---|---|
| Gann & Fibonacci | Gann box, Gann square fixed, Gann square, Gann fan (GANN bölümü tamamen) |
| Patterns | XABCD pattern, Cypher pattern, Head & shoulders, ABCD pattern, Triangle pattern, Three drives (CHART PATTERNS bölümü tamamen); Time cycles, Sine line (CYCLES'tan sadece bu ikisi, Cyclic lines kaldı) |
| Forecast & Measurement | Position forecast, Bar pattern, Ghost feed, Sector (Long/Short position kaldı); Anchored VWAP (Fixed/Anchored volume profile kaldı) |
| Geometric Shapes | Polyline, Curve, Double curve (Brush/Highlighter/Rectangle/.../Arc ve tüm Arrows kaldı) |

**Dikkat edilen id çakışması**: `triangle` (Shapes → düz üçgen şekli)
`trianglepat` (Patterns → Triangle pattern) ile karıştırılmadı — sadece
ikincisi kaldırıldı, `triangle` dokunulmadan kaldı.

## Yapılan değişiklikler

### `js/ui/sidebar.js`
- `GROUPS` menü tanımından yukarıdaki tüm öğeler kaldırıldı; tamamen
  boşalan bölümler (GANN, CHART PATTERNS) komple silindi.
- `TI` ikon haritasından artık kullanılmayan 20 ikon girdisi kaldırıldı
  (gannBox, gannSquareFixed, gannSquare, gannFan, xabcd, cypherPattern,
  headShoulders, abcdPattern, trianglePattern, threeDrives, timeCycles,
  sineLine, posForecast, barPattern, ghostFeed, sector, vwap, polyline,
  curve, doubleCurve) — her biri silmeden önce başka yerde kullanılmadığı
  doğrulandı.

### `js/drawing/core/drawing-core.js`
- Nokta-sayısı bazlı araç dispatch dizilerinden (`TWO_PT_TOOLS`,
  `THREE_PT_TOOLS`, `MULTI_PT_TOOLS`) kaldırılan id'ler çıkarıldı.
- `FOUR_PT_TOOLS` dizisi tamamen kaldırıldı (tek üyesi `doublecurve` idi).
- VWAP'a özel tek-nokta çizim bloğu tamamen silindi.
- Çizim dispatch zincirinden (`if (d.tool === '...') window.DrawingXxx...`)
  ilgili 16 satır kaldırıldı.
- Stil uygulanabilirlik dizisinden ve hit-test/sürükleme bloklarından
  (vwap özel p1 hit-test, curve/doublecurve/polyline hit-test) ilgili
  girdiler çıkarıldı; `arc` ve `pathtool` gibi paylaşılan mantığa
  dokunulmadı.

### `js/drawing/tools/drawing-fibo.js`
- `_drawGannFan`, `_drawGannBox`, `_drawGannSquare` (üçü de boş
  placeholder'dı) ve export'ları kaldırıldı.

### `js/drawing/tools/drawing-patterns.js`
- `_drawXABCD`, `_drawCypher`, `_drawHeadShoulders`, `_drawABCD`,
  `_drawTrianglePattern`, `_drawThreeDrives`, `_drawTimeCycles`,
  `_drawSineLine` (hepsi boş placeholder) ve export'ları kaldırıldı.
  Elliott Wave fonksiyonları ve Cyclic Lines (kalan araçlar) dokunulmadan
  bırakıldı — bunlar da placeholder ama kapsamda değiller (bkz. aşağıdaki
  envanter).

### `js/drawing/tools/drawing-forecast.js`
- `_drawPosForecast`, `_drawBarPattern`, `_drawGhostFeed`, `_drawSector`
  (placeholder) kaldırıldı.
- `_drawAnchoredVWAP` — **gerçek, dolu implementasyonluydu** (candle
  verisinden kümülatif VWAP hesaplayıp çiziyordu) ama kullanıcı açıkça
  kaldırılmasını istediği için silindi.

### `js/drawing/tools/drawing-shapes.js`
- `_drawCurve`, `_drawDoubleCurve`, `_drawPolyline` (üçü de dolu
  implementasyonluydu) ve export'ları kaldırıldı. `_drawArrowHead` gibi
  paylaşılan yardımcı fonksiyon (hâlâ ok araçlarınca kullanılıyor)
  dokunulmadan bırakıldı.

### `js/drawing/ui/drawing-settings-dialog.js`, `property-toolbar.js`, `dsd-tabs/dsd-apply.js`, `dsd-tabs/dsd-standard-tabs.js`
- Kaldırılan araçların ayar diyaloğu başlıkları, `TOOL_CAPS` girdileri ve
  özellik-toolbar'daki hariç tutma dizilerinden (`hasText`, `hasAlert`,
  `isPosition`) ilgili id'ler çıkarıldı.

## Doğrulama

Sözdizimi (`node --check`) her değişen dosyada geçti. Tarayıcıda gerçek
DOM üzerinden her 4 flyout menüsü açılıp içeriği doğrulandı:

| Menü | Sonuç |
|---|---|
| Gann & Fibonacci | ✅ sadece FIBONACCI (8 araç), GANN bölümü yok |
| Patterns | ✅ ELLIOTT WAVES (5) + CYCLES (sadece Cyclic lines) |
| Forecast & Measurement | ✅ FORECASTING (Long/Short), PRICE & DATE (3), VOLUME-BASED (Fixed/Anchored, VWAP yok) |
| Geometric Shapes | ✅ BRUSHES (2), SHAPES (Polyline/Curve/Double curve yok), ARROWS (4) |
| Kalan bir aracın seçimi (Arc) hâlâ çalışıyor mu (regresyon) | ✅ `activeTool: 'arc'` |
| Console hatası | ✅ yok |

## Ek: Kalan araçlardan eksik/yarım kalmış olanlar (envanter)

Ayrı bir araştırma turunda kalan (kaldırılmayan) tüm araçlar tarandı.
Aşağıdakiler **menüde duruyor ama seçilse bile hiçbir şey çizmiyor**
(boş placeholder fonksiyon):

| Araç | Not |
|---|---|
| Elliott impulse/correction/triangle/double/triple combo (5 araç) | `drawing-patterns.js` — hepsi boş |
| Cyclic lines | `drawing-patterns.js` — boş |
| Price range / Date range / Date & price range (3 araç) | `drawing-forecast.js` — boş |
| Fixed range volume profile / Anchored volume profile | `drawing-forecast.js` — boş |
| Brush / Highlighter | `drawing-shapes.js` — boş (serbest çizim mantığı hiç yazılmamış) |
| Emoji smile | Menüde var ama `drawing-core.js`'te hiç dispatch edilmiyor; genel `icon` aracı da boş placeholder — uçtan uca çalışmıyor |

Long position / Short position tam çalışıyor (gerçek implementasyon).
Geri kalan tüm kontrol edilen araçlar (trendline, fib grubu, temel
şekiller, ok araçları, metin/not araçları vb.) gerçek, tam implementasyonlu.

## Değişen dosyalar

| Dosya |
|---|
| `js/ui/sidebar.js` |
| `js/drawing/core/drawing-core.js` |
| `js/drawing/tools/drawing-fibo.js` |
| `js/drawing/tools/drawing-patterns.js` |
| `js/drawing/tools/drawing-forecast.js` |
| `js/drawing/tools/drawing-shapes.js` |
| `js/drawing/ui/drawing-settings-dialog.js` |
| `js/drawing/ui/property-toolbar.js` |
| `js/drawing/ui/dsd-tabs/dsd-apply.js` |
| `js/drawing/ui/dsd-tabs/dsd-standard-tabs.js` |

## Sıradaki adım

Kullanıcı onayı bekleniyor. Onaylanırsa sırada: yukarıdaki envanterdeki
boş araçlardan hangilerinin gerçek işlevle doldurulacağı, hangilerinin de
ayrıca kaldırılacağı kararlaştırılacak (kullanıcının notu: "simdilik
listeyi duzenleyelim, sonra isleve gececez").
