# Parallel Channel Text Hizalaması + Regression Trend İncelemesi — 2026-08-03

## 1) Parallel Channel — Text alignment "TradingView gibi"

### İstek

- "Inside" (mevcut kodda "Middle") varsayılan olsun.
- Inside: her zaman kanalın 0.5 (orta) seviyesinin ÜZERİNDE.
- Top: her zaman o an AKTİF olan seviyelerin EN ÜSTTEKİNİN üzerinde.
- Bottom: her zaman o an AKTİF olan seviyelerin EN ALTTAKİNİN altında.
- Yani üst/alt seviyeler açılıp kapandıkça metnin konumu da değişmeli.

### Kök durum

`drawing-trend.js` `_drawChannelText()` fonksiyonu Top/Bottom'u sabit
`v=0` / `v=1`'e bağlıyordu — kullanıcı üst çizgiyi (v=0) kapatıp sadece
`v=0.25`'i aktif bıraksa bile "Top" hep eski v=0 konumunda kalıyordu
(artık orada çizgi bile yokken).

### Düzeltme

- `levelV` hesaplaması artık **aktif seviyelerin** `Math.min`/`Math.max`'ı
  ile dinamik: `Top` → en küçük aktif `v`, `Bottom` → en büyük aktif `v`.
  Aktif seviye yoksa eski varsayılana (`0`/`1`) düşüyor.
- "Inside" (Middle) hep sabit `v=0.5` — ama artık `Top` ile aynı offset/
  baseline davranışını kullanıyor (metin çizginin ÜZERİNDE, ortasında
  değil) — kullanıcı isteği "0.5 çizgisi üstünde olsun" ile birebir.
- `dsd-standard-tabs.js`: Parallel Channel için orta seçeneğin etiketi
  "Middle" → **"Inside"** yapıldı (sadece `d.tool==='channel'` için —
  diğer araçlarda "Middle" kalıyor), varsayılan seçim `top` → `middle`
  oldu.
- `drawing-core.js`: `_getToolStyle('channel')`'ın varsayılan
  `textAlignV: 'top'` → `'middle'` yapıldı.

### Doğrulama (gerçek tarayıcı)

- Yeni bir Parallel Channel çizildi, ayar diyaloğunda Text sekmesinde
  dropdown'da `Top / Inside / Bottom` seçenekleri ve **Inside**
  varsayılan seçili göründü.
- Sadece `v=0` ve `v=1` seviyeleri aktifken metin üst çizginin (v=0)
  üzerinde durdu; `v=0` kapatılıp `v=0.25` aktif edilince metin **aşağı
  kayıp yeni en-üst-aktif-seviyenin (0.25) üzerine** oturdu — ekran
  görüntüsüyle doğrulandı.

### Değişen dosyalar

| Dosya |
|---|
| `js/drawing/tools/drawing-trend.js` |
| `js/drawing/ui/dsd-tabs/dsd-standard-tabs.js` |
| `js/drawing/core/drawing-core.js` |

---

## 2) Regression Trend — genel inceleme

İstendiği gibi tüm çalışma mantığını (OLS regresyon matematiği, sapma
bantları, extend, hit-test, ayar diyaloğu) satır satır inceledim. İki
**gerçek, doğrulanmış bug** buldum ve düzelttim; matematik ve genel
mimari sağlam.

### Bulunan ve düzeltilen buglar

**a) Ayar diyaloğunda Base/Up/Down checkbox'ları HER ZAMAN işaretli
görünüyordu (gerçek değerden bağımsız)**

`drawing-settings-dialog.js`'teki `_renderRegressionStyleTab`'ın `row()`
yardımcısı, checkbox'ın başlangıç durumunu şöyle hesaplıyordu:
```js
cbId.replace('reg-show-', 'show' + (...))
```
Bu bir "replace" değil, yanlışlıkla bir "prepend" gibi davranıyordu:
`'reg-show-up'.replace('reg-show-', 'showUp')` → **`'showUpup'`**
(hiç var olmayan bir property adı). `s['showUpup']` hep `undefined`
olduğundan `!== false` hep `true` çıkıyor — yani bu checkbox'lar
**gerçek kayıtlı değerden tamamen bağımsız olarak hep işaretli
gösteriliyordu**. Kaydetme tarafı (`change` event handler'ları) doğru
çalışıyordu (çizim gerçekten gizleniyordu), sadece diyalog HER
YENİDEN AÇILIŞTA checkbox'ı yanlışlıkla işaretli gösteriyordu.

Gerçek tarayıcıda doğrulandı: `d.style.showUp = false` kaydedilmiş bir
çizim için diyalog açıldığında checkbox `checked:true` gösteriyordu
(bug doğrulandı) → düzeltmeden sonra `checked:false` (doğru).

**Düzeltme**: `row()` artık doğru style-key'i parametre olarak alıyor
(`'showBase'`/`'showUp'`/`'showDown'`), string manipülasyonu kaldırıldı.

**b) Hit-test, "Up"/"Down"/"Base" görünürlük checkbox'larını hiç kontrol
etmiyordu — gizli bantlar hâlâ tıklanabiliyordu**

Çizim tarafı (`drawing-trend.js`) bir bandı sadece
`useUpperDev && showUp` (hem "sapma kullan" HEM "göster" işaretliyse)
çiziyor. Ama `drawing-core.js`'teki hit-test SADECE `useUpperDev`'i
kontrol ediyordu — `showUp`'ı hiç bilmiyordu. Sonuç: kullanıcı "Up"
kutusunu kapatıp üst bandı görünmez yapsa bile (Use Upper Deviation
işaretli kaldığı sürece), o görünmeyen bant hâlâ tıklanıp seçilebiliyordu
— tam olarak bir önceki turlarda Fibonacci araçlarında bulduğumuz "çizim
ile hit-test'in bağımsız kopyalar olarak sapması" hata sınıfının aynısı.

**Düzeltme**: Hit-test artık `useUpper = useUpperDev !== false &&
showUp !== false` (ve Lower/Base için aynısı) kullanıyor — çizim
fonksiyonuyla birebir aynı koşul.

Gerçek tarayıcıda doğrulandı: `showUp:false, showDown:false` yapılan bir
regresyonda üst bandın bulunması gereken bölgeye 5px aralıklarla
tıklandı (13 nokta) — hiçbiri artık seçmiyor; base çizgisi (gerçek
regresyon formülüyle hesaplanan tam konumunda) hâlâ doğru şekilde
tıklanabiliyor (regresyon yok).

### Kontrol edilip SORUN OLMADIĞI doğrulanan nokta

`toSec()` fonksiyonu `{year,month,day}` (BusinessDay) formatındaki
zamanları `new Date(...)` (TARAYICI YEREL saat dilimi) ile saniyeye
çeviriyor — ilk bakışta bir UTC/yerel saat dilimi tutarsızlığı gibi
görünebilir. Ama kontrol ettim: `d.p1.time`/`d.p2.time` VE
`candle.time` **aynı grafik/aynı zaman dilimi periyodunda hep aynı
formatı** kullanıyor (1D+ periyotlarda ikisi de BusinessDay, intraday'de
ikisi de UTC timestamp sayısı) — yani karşılaştırma her zaman
"elma-elma" oluyor, çapraz format karışması yok. Gerçek bir bug değil.

### Genel değerlendirme (matematik/mimari)

- OLS regresyon (slope/intercept), standart sapma (n-2 serbestlik
  derecesi) ve Pearson's R hesapları standart ve doğru.
- Extend (sağa uzatma) mantığı piksel-başına-bar yaklaşımıyla makul bir
  yaklaşıklık; sadece sağa uzatma var (sola yok) — bu kasıtlı, ayar
  panelinde de tek yönlü "Extend lines" checkbox'ı var, eksik değil.
### Ek — regresyon hesabı tek doğruluk kaynağına çıkarıldı

Kullanıcı isteğiyle, yukarıda "yapısal not" olarak bahsedilen kopya
sorunu da giderildi. `drawing-trend.js`'e OLS hesabının (candle
filtreleme, slope/intercept/stdDev/Pearson's R/points) TEK kopyasını
içeren `_computeRegression(d, pane)` fonksiyonu eklendi ve
`DrawingTrend.computeRegression` olarak dışa açıldı (fib-ret'teki
`DrawingFibo.fibAxis` ile aynı desen). Hem `_drawRegressionTrend`
(çizim) hem `drawing-core.js`'teki hit-test artık SADECE bu fonksiyonu
çağırıyor — iki bağımsız kopyanın birbirinden sapması artık yapısal
olarak imkânsız.

**Doğrulama**: Gerçek tarayıcıda yeni bir regresyon çizildi;
`computeRegression` çağrılıp gerçek `n`/`slope` değerleri okundu, base
çizgisi hesaplanan tam konumundan tıklanıp seçilebildiği doğrulandı;
`showUp:false, showDown:false` yapılıp üst bandın hâlâ tıklanamadığı ve
ayar panelinin checkbox'ları doğru gösterdiği (refactor sonrası
regresyon yok) tekrar test edildi. Konsolda hata yok.

### Değişen dosyalar

| Dosya | Değişiklik |
|---|---|
| `js/drawing/ui/drawing-settings-dialog.js` | `_renderRegressionStyleTab`'daki checkbox `checked` hesaplama bug'ı düzeltildi |
| `js/drawing/core/drawing-core.js` | Regression hit-test'i `showBase`/`showUp`/`showDown` bayraklarını kontrol ediyor; kendi regresyon kopyasını hesaplamak yerine `DrawingTrend.computeRegression`'ı çağırıyor |
| `js/drawing/tools/drawing-trend.js` | `_computeRegression()` çıkarıldı ve dışa açıldı; `_drawRegressionTrend` artık onu çağırıyor |

`node --check` üç dosyada da geçti. Gerçek tarayıcıda tüm bulgular
`DrawingManager`'ın gerçek fonksiyonlarıyla doğrulandı, konsolda hata
yok, test çizimleri temizlendi.
