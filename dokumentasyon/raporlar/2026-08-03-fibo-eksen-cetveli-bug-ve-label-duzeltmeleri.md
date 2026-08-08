# Fibo — Eksen Cetveli Seçim Hatası, Fib Channel Label ve Fib Speed Fan Yön Düzeltmesi — 2026-08-03

## İstek

1. **En büyük sorun**: Zaman/fiyat cetveli altında kalan (o bölgeye taşan) Fibonacci çizgileri, cetvel üzerine tıklanınca da seçilebiliyor. Trend çizgilerinde bu doğru çalışıyor.
2. Fib Channel'da Labels → Center, çizginin merkezine değil Left'ten daha aşağıya konumlanıyor; Top/Middle/Bottom tamamen yanlış.
3. Fib Speed Fan'da ilk tıklama hâlâ "0" ile başlıyor, "1" ile başlaması isteniyor (TradingView örneği tekrar gönderildi).

## 1) Eksen cetveli tıklaması — kök neden bulundu (platform geneli bug)

**Araştırma**: `onMouseDown`'da şu koruma var:
```js
const rawTime = pane.chart.timeScale().coordinateToTime(x);
const rawPrice = series.coordinateToPrice(y);
if (rawTime === null || rawPrice === null) return false;
```
Bunun **fiyat cetveli (sağ/sol) VE zaman cetveli (alt) şeridine yapılan tüm
tıklamaları engellediği varsayılıyordu**. Tarayıcıda doğrudan test edildi:

```js
pane.chart.timeScale().coordinateToTime(W + 5)  // → null  (fiyat cetveli şeridi: DOĞRU engelleniyor)
pane.series.coordinateToPrice(H + 100)          // → 60069.5...  (null DEĞİL!)
```

**`coordinateToPrice` geçerli aralığın dışında bile ASLA null dönmüyor** —
ekstrapole edilmiş (ekranda karşılığı olmayan) ama geçerli görünen bir
fiyat veriyor. Sonuç: **zaman cetveli şeridine (canvas altındaki ~22px)**
yapılan bir tıklamada `rawTime` (x hâlâ ana grafik aralığında olduğu için)
geçerli, `rawPrice` de (asla null olmadığı için) geçerli görünüyor —
koruma hiç devreye girmiyor, tıklama doğrudan `_hitTest`'e ulaşıyor.

Orada, o (ekranda görünmeyen, cetvelin altında kalan) y-koordinatına denk
gelen bir Fibonacci seviyesi varsa (çok seviyeli bir Fibonacci aracında
bu sık rastlanan bir durum — geniş bir fiyat aralığına yayılan pek çok
seviye var), o seviye "görünmez" biçimde seçilebiliyordu. Trend
çizgilerinde bu daha az fark ediliyordu çünkü tek bir çizgileri var ve
genelde bu dar şeride denk gelmiyordu — ama altta yatan eksiklik (fiyat
cetveli/zaman cetveli sınırının hit-test'te hiç kontrol edilmemesi)
**tüm araçlar için aynı derecede eksikti**.

**Düzeltme**: `drawing-core.js`'teki **tek** `_hitTest(x, y, d, pane)`
giriş noktasının en başına, çizim alanının (`drawingCanvas`) gerçek
sınırlarının dışındaki HER tıklamayı reddeden bir koruma eklendi:
```js
const _W = pane.drawingCanvas.width / (window.devicePixelRatio || 1);
const _H = pane.drawingCanvas.height / (window.devicePixelRatio || 1);
const _scaleW = pane.priceSide === 'left' ? (pane.chart.priceScale('left').width() || 0) : 0;
if (x < _scaleW || x > _scaleW + _W || y < 0 || y > _H) return false;
```
Tek bir yerde olduğu için **tüm araçları** (fib dahil, trend line dahil,
hepsi) aynı anda kapsıyor — araç bazlı bir yama değil, platformun
hit-test giriş noktasındaki eksik bir kontrolün tamamlanması.

**Doğrulama** (gerçek tarayıcı, gerçek `onMouseDown`/`onMouseUp`):
- Canvas alt sınırına çok yakın (`H-3`) bir yatay çizgi (`hline`) çizildi.
- Zaman cetveli şeridi içinde (`H+12`) bir noktaya tıklandı → **seçilmedi**
  (`null`) — düzeltmeden önce bu senaryoda `coordinateToPrice` geçerli bir
  fiyat üretip hit-test'i tetikleyebiliyordu.
- Aynı çizginin gerçek konumuna (`H-3`, sınırlar içinde) tıklandığında
  **normal şekilde seçildi** — regresyon yok.

## 2) Fib Channel — Labels Center/Top/Middle/Bottom düzeltmesi

**Kök neden (Center)**: X ekseni `(lx1+lx2)/2` ile doğru ortalanıyordu,
ama Y ekseni hâlâ `ly1`'e (Left ucu) sabitti. Çizgi eğimli olduğu için
"ortalanmış X, ama Left'in Y'si" kombinasyonu etiketi çizginin dışına
(Left'ten aşağıda/yukarıda) düşürüyordu. Düzeltme: referans noktası
artık **X ve Y birlikte** hesaplanıyor — Left→`(lx1,ly1)`,
Right→`(lx2,ly2)`, Center→`((lx1+lx2)/2, (ly1+ly2)/2)` (çizginin gerçek
orta noktası).

**Kök neden (Top/Middle/Bottom)**: Top ve Bottom'un `textBaseline` ve
offset yönü **ters** atanmıştı — "Top" seçiliyken metin çizginin
ALTINDA, "Bottom" seçiliyken ÜSTÜNDE görünüyordu. Fib Retracement'taki
(doğru çalışan) kalıpla birebir aynı hale getirildi:
```js
const textY = labelsV === 'Top' ? refY - 3 : labelsV === 'Bottom' ? refY + fontSize + 2 : refY;
ctx.textBaseline = labelsV === 'Bottom' ? 'top' : labelsV === 'Middle' ? 'middle' : 'bottom';
```

**Doğrulama**: Gerçek bir Fib Channel çizilip `fibLabelsH:'Center'`
verildiğinde her seviyenin etiketi (örn. `0.618 (65689.15)`) tam olarak
kendi diyagonal çizgisinin ÜZERİNDE (Middle) göründü; `fibLabelsV:'Top'`
yapıldığında etiketler çizginin hemen ÜSTÜNE kaydı (önce Middle'la aynı
konumdaydı, şimdi belirgin şekilde yukarı taşındı) — ekran görüntüleriyle
doğrulandı.

## 3) Fib Speed Fan — ilk tıklama artık "1"

**Kök neden**: Fan'ın Y (fiyat) ekseni `effP1Y = reverse ? p2.y : p1.y`
(varsayılan `p1.y`) kullanıyordu — yani p1 (ilk tıklanan, fan'ın
birleştiği köşe) hep "0" seviyesindeydi, p2 "1"di. Ayrıca X (zaman)
ekseni bu "reverse" mantığını **hiç kullanmıyordu** (`p1.x + dx*v` sabit) —
Fib Retracement'ta uygulanan "ilk tık = 1" kuralı Speed Fan'ın ne fiyat
ne de zaman eksenine hiç taşınmamıştı.

**Düzeltme**: Fan'ın **geometrik kaynağı** (çizgilerin başladığı nokta)
her zaman p1'de sabit kalacak şekilde, ama v→konum eşlemesi Fib
Retracement'taki `_fibAxis` fonksiyonunun AYNISI kullanılarak hem Y hem
X ekseni için yeniden yazıldı:
```js
const yAxis = _fibAxis(p1.y, p2.y, reverse);
const xAxis = _fibAxis(p1.x, p2.x, reverse);
const priceYAt = (v) => yAxis.base + yAxis.span * v;
const timeXAt  = (v) => xAxis.base + xAxis.span * v;
```
Artık varsayılan (reverse kapalı) durumda `priceYAt(1) === p1.y` ve
`timeXAt(1) === p1.x` — yani **ilk tıklanan nokta her iki eksende de
"1"**. `drawing-core.js`'teki hit-test de `window.DrawingFibo.fibAxis`
çağrısıyla birebir aynı hesaplamayı kullanacak şekilde güncellendi (tek
doğruluk kaynağı ilkesi — fib-ret'te olduğu gibi).

**Doğrulama**: Gerçek bir Fib Speed Fan çizilip matematik doğrudan
kontrol edildi:
```
a (p1, ilk tık) y=800  →  priceYAt(1) = 800  ✓
b (p2, ikinci tık) y=30 →  priceYAt(0) = 30   ✓
a.x=29.75 → timeXAt(1)=29.75 ✓ ; b.x=599.75 → timeXAt(0)=599.75 ✓
```
Ayrıca `0.618` seviyesinin çizgisine gerçek tıklama ile seçilebildiği
doğrulandı (hit-test regresyonu yok).

## Değişen dosyalar

| Dosya | Değişiklik |
|---|---|
| `js/drawing/core/drawing-core.js` | `_hitTest`'e sınır (fiyat/zaman cetveli) koruması eklendi; Fib Speed Fan hit-test'i `fibAxis` ile yeniden yazıldı |
| `js/drawing/tools/drawing-fibo.js` | `_drawFibChannel` label konumlandırma düzeltildi (Center/Top/Bottom); `_drawFibSpeedfan` her iki eksen de `_fibAxis` ile yeniden yazıldı (ilk tık = 1) |

`node --check` her iki dosyada geçti. Gerçek tarayıcıda 3 madde de gerçek
`DrawingManager` fonksiyonlarıyla uçtan uca doğrulandı, konsolda hata
yok, test çizimleri temizlendi.

## Ek düzeltmeler (aynı gün, devam turu)

Kullanıcı yukarıdaki 2. maddenin (Fib Channel Labels) düzeltmesini yeterli
bulmadı ve ayrıca Fib Speed Fan ayar panelinde bir hizalama sorunu daha
bildirdi:

### Fib Channel — Top/Middle/Bottom tamamen kaldırıldı

Kullanıcı isteği: "bunu doğru ayarlayamadın, kaldır". Eğimli çizgilerde
dikey (Top/Middle/Bottom) konumlandırmayı güvenilir şekilde çözmek yerine,
**seçenek tamamen kaldırıldı**:
- `dsd-fibo-tabs.js`: Fib Channel için Labels satırındaki dikey
  (Top/Middle/Bottom) select artık render edilmiyor (`isFibChannel`
  kontrolü eklendi) — sadece yatay (Left/Center/Right) select kalıyor.
- `drawing-fibo.js` `_drawFibChannel`: `s.fibLabelsV` okunması tamamen
  kaldırıldı, etiket her zaman `textBaseline:'middle'` ile çizginin TAM
  ÜZERİNDE duruyor (eskiden saklı kalan bir `fibLabelsV` değeri varsa bile
  artık hiç okunmuyor, davranış sabit).

Doğrulama: `renderFibStyleTab({tool:'fib-channel'})` çıktısında
`dsd-fib-labels-v` artık yok; `fib-ret` için hâlâ var (regresyon yok).

### Fib Speed Fan ayar paneli — "Background" satırı hizasızlığı

**Kök neden**: `Use one color`, `Background`, `Grid` satırlarının
etiketleri (`<label>`) hepsi `style="width:120px;"` ile aynı genişliği
istiyordu, ama gerçek tarayıcıda ölçüldüğünde **Background** etiketi
sadece **105.78px** render ediyordu (diğer ikisi tam 120px). Kök neden:
`.dsd-row` flex konteynerinde Background satırının içinde daha FAZLA
içerik var (renk kutusu + 150px'lik opacity slider + inline `<style>`
etiketi) — label'da `flex-shrink:0` olmadığı için flex algoritması, satır
sıkışınca ilk küçülecek elemanı (etiket) diğerlerinden farklı oranda
sıkıştırıyordu. Bu da rengi 14px sola kaydırıyordu.

**Düzeltme**: Background satırının etiketine ve renk kutusuna
`flex-shrink:0` eklendi — artık üçü de gerçekten 120px'te sabit,
`getBoundingClientRect().left` ile ölçüldüğünde üçü de **465.5px**'te
birebir hizalı.

### Değişen dosyalar (ek tur)

| Dosya | Değişiklik |
|---|---|
| `js/drawing/ui/dsd-tabs/dsd-fibo-tabs.js` | Fib Channel'da Labels dikey select'i kaldırıldı; Fib Speed Fan Background satırına `flex-shrink:0` |
| `js/drawing/tools/drawing-fibo.js` | `_drawFibChannel`'de `fibLabelsV` kaldırıldı, etiket sabit `middle` |

`node --check` geçti. Gerçek tarayıcıda: Fib Speed Fan ayar paneli açılıp
üç renk kutusunun `getBoundingClientRect().left` değerleri ölçüldü (üçü
de 465.5px), ekran görüntüsüyle de doğrulandı. Fib Channel için
`renderFibStyleTab` çıktısı kontrol edildi.

## Ek düzeltme — Fib Speed Fan'da "1" noktasından çıkan dikey çizgi eksikti

Kullanıcı ekran görüntüsüyle bildirdi: fan'ın kaynağı olan "1" noktasından
yukarı doğru çıkması gereken dikey referans çizgisi hiç görünmüyordu; Time
Levels altındaki "1" seviyesi kapatılınca bu çizginin de kapanması
gerekiyordu.

**Kök neden**: Önceki turda (ilk tık = 1 ekseni düzeltmesi sırasında)
zaman ekseni döngülerine (grid, fan ışını, etiket — 3 yer) şu koruma
eklenmişti: `if (lvl.v === originV) continue;` (originV=1). Bu, ESKİ
kuralda (v=0 kaynaktaydı) "kaynakta dejenere/gereksiz bir çizgi çizmeyi
atla" amacıyla vardı, ama matematiksel olarak bu asla dejenere değildi —
kaynağın (`p1`) zaman değerindeki dikey çizgi tamamen geçerli bir
referans çizgisiydi (TradingView'de de var). Yeni eksende bu koruma
yanlışlıkla **"1" seviyesinin kendisini** atlar hale geldi — yani tam da
kullanıcının görmek istediği çizgiyi gizliyordu.

**Düzeltme**: `drawing-fibo.js`'teki 3 zaman döngüsünden (`grid`,
`fan ışını`, `etiket`) ve `drawing-core.js`'teki hit-test'ten
`if (lvl.v === originV) continue;` satırları kaldırıldı — artık zaman
seviyesi "1" de diğer seviyeler gibi normal şekilde çiziliyor ve
`active:false` yapıldığında normal şekilde kapanıyor.

**Doğrulama**: Gerçek tarayıcıda bir Fib Speed Fan çizildi — "1" noktasından
yukarı çıkan dikey çizgi (ve üstteki "1" etiketi) göründü. `timeLevels`
içindeki `v:1` seviyesi `active:false` yapılıp yeniden çizim tetiklendiğinde
hem çizgi hem etiket kayboldu, diğer tüm çizgiler etkilenmedi.

### Değişen dosyalar (bu ek tur)

| Dosya | Değişiklik |
|---|---|
| `js/drawing/tools/drawing-fibo.js` | Zaman ekseni grid/fan-ışını/etiket döngülerindeki `originV` atlama kaldırıldı |
| `js/drawing/core/drawing-core.js` | Fib Speed Fan hit-test'indeki aynı `originV` atlaması kaldırıldı |

`node --check` geçti, gerçek tarayıcıda doğrulandı, konsolda hata yok.
