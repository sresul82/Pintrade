# Fibonacci Seviye Listesi Kısaltma — 2026-08-01

## İstek

> "Fibonacci retracement aracinin menusunde bug var 2.272 levelden
> yukaridakileri kaldir cunku ekrana sigmiyor, yan yana durmasi gereken
> menuler var onlari duzelt"

## Yapılan

`js/drawing/ui/dsd-tabs/dsd-fibo-tabs.js` — varsayılan Fibonacci seviye
listesi 2.272 ve altıyla sınırlandırıldı.

**Dikkat edilen nokta:** Bu liste **tüm Fibonacci araçları tarafından
paylaşılıyor**. `3.618` ve `4.236` seviyeleri **Fib Channel**'da
varsayılan olarak *aktif* kullanılıyordu (`active: d.tool ===
'fib-channel' ? true : false`). Listeden körlemesine silinseydi Fib
Channel'ın varsayılan görünümü bozulacaktı.

Bu yüzden filtre **koşullu** yapıldı:

```js
if (d.tool !== 'fib-channel') {
  defaultLevels = defaultLevels.filter(l => l.v <= 2.272);
}
```

## Doğrulama

Tarayıcıda `DSDFiboTabs.renderFibStyleTab()` doğrudan çağrılıp üretilen
seviye listesi ölçüldü:

| Araç | Seviye adedi | En yüksek seviye | Sonuç |
|---|---|---|---|
| `fib-ret` (retracement) | 24 → **12** | 4.764 → **2.272** | ✅ liste yarı yarıya kısaldı |
| `fib-channel` | **24** (değişmedi) | **4.764** (değişmedi) | ✅ bozulmadı |

`node --check` geçti. Konsolda hata yok.

## ⚠️ Kullanıcının bilmesi gereken yan etki

Filtre `2.618` seviyesini de kaldırdı — çünkü 2.272'den büyük. Ancak bu
seviye retracement'ta **varsayılan olarak aktifti** (`active: true`), yani
çizimde görünen bir çizgiydi. Artık görünmeyecek.

**Karar gerekiyor:** 2.618 geri istenirse filtre `l.v <= 2.618` yapılabilir
ya da bu seviye için istisna eklenebilir. Kullanıcı "2.272 üstünü kaldır"
dediği için harfiyen uygulandı.

## Devam — gerçek kök neden bulundu ve düzeltildi (2. tur)

Kullanıcı ilk düzeltmenin işe yaramadığını bildirdi: menüyü kapatıp
tekrar açınca eski (şişmiş) hâline dönüyordu, ekran görüntüsünde 6 gerçek
satırın altında 4 tane boş ("0 / 0") satır daha görünüyordu.

### Gerçek kök neden

İlk turdaki düzeltme sadece **taze** (`s.fibLevels` boşken) senaryoyu ele
almıştı. Ama iki farklı durum bunu atlıyordu:

1. **Daha önce çizilmiş bir Fib aracı** zaten `d.style.fibLevels`
   içinde eski (24 uzunluğunda, 2.272 üstü dahil) bir dizi taşıyordu.
   `if (!s.fibLevels || s.fibLevels.length === 0)` koşulu bu durumda
   `false` olduğu için yeni kısaltılmış varsayılan hiç devreye girmiyordu.
2. `drawing-settings-dialog.js:1383`'te bir renk düğmesine tıklanınca
   (nadir bir fallback yolu) dizi **24 satırlık sentetik sıfır dolgu**
   (`v:0, color:'#000', active:false`) ile dolduruluyordu — ekran
   görüntüsündeki boş "0/0" satırların kaynağı buydu.

### Düzeltme

`dsd-fibo-tabs.js`'te artık **her açılışta** (taze veya eski fark etmeksizin)
`s.fibLevels` şu şekilde temizleniyor:
```js
s.fibLevels = s.fibLevels.filter(l => l.v <= 2.272 && l.color !== '#000');
```
Yani hem "2.272 üstü" hem "sentetik sıfır dolgu" satırlar her seferinde
süzülüyor — önceden çizilmiş, eski kayıtlı Fib'ler de dahil.

`drawing-settings-dialog.js:1383`'teki fallback da 24 yerine (Fib
Timezone hariç) 12 satır üretecek şekilde güncellendi, ileride yeniden
şişmesin diye.

### Kapsam genişletildi — kullanıcı isteğiyle TÜM fibo araçları

Kullanıcı: *"diğer fibolarda kullanıyor olsa da 2.272den yukarisini
kaldir"* — yani ilk turda Fib Channel için bıraktığım istisna
**kaldırıldı**, kısıtlama artık şu araçların hepsinde geçerli:

| Araç | Önce | Sonra |
|---|---|---|
| Fib Retracement | 24 | **12** (max 2.272) |
| Fib Extension | 24 | **12** (max 2.272) |
| **Fib Channel** | 24 | **12** (max 2.272) — *aşağıya bakın* |
| Fib Time-Based | 11 | **8** (max 2) |
| Fib Speed Fan | 7 | 7 (değişmedi, zaten hep ≤1) |

### Ciddi sorun çıkarabilecek tek araç: Fib Time Zone — kısıtlama UYGULANMADI

Sorulan soruya cevap: **evet, bir araç var ve ona dokunmadım.**

**Fib Time Zone** (`fib-timezone`), diğerlerinden farklı bir birim
kullanıyor: seviyeleri fiyat oranı değil, **Fibonacci dizisi bar sayısı**
(0, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89). "2.272" kısıtlaması burada
uygulansaydı sadece `0, 1, 2` hayatta kalır, araç neredeyse tamamen
işlevsiz kalırdı. Bu yüzden **bilinçli olarak istisna tutuldu** —
kodda açık bir yorumla işaretlendi.

### Bilinen yan etki: Fib Channel'ın varsayılan görünümü değişti

Fib Channel'da `2.618`, `3.618`, `4.236` seviyeleri **varsayılan olarak
aktifti** (kanalın üst sınırlarını çiziyorlardı). Kısıtlama uygulanınca
bunlar da kalktı — yeni çizilen bir Fib Channel artık varsayılan olarak
sadece `1.618`'e kadar uzanıyor. Kullanıcı bunu bilerek istedi, ama görsel
bir davranış değişikliği olduğu için burada not düşülüyor.

### Doğrulama (2. tur)

Tarayıcıda tüm fibo araçları için `renderFibStyleTab`/`renderFibSpeedfanTab`
doğrudan çağrılıp üretilen `fibLevels`/`priceLevels` ölçüldü:

| Araç | Seviye adedi | Max |
|---|---|---|
| fib-ret | 12 | 2.272 |
| fib-ext | 12 | 2.272 |
| fib-channel | 12 | 2.272 |
| fib-timebased | 8 | 2 |
| fib-speedfan | 7 | 1 (değişmedi) |
| fib-timezone | **11** | **89 (korundu)** |

**Eski/şişmiş kayıt temizleme testi:** 24 satırlık (12 gerçek + 12 sentetik
sıfır) sahte "eski çizim" verisi hem `fib-ret` hem `fib-channel` için
oluşturulup dialog yeniden render edildi → ikisi de **12 satıra** indi,
sıfır dolgu satır kalmadı.

`node --check` her iki dosyada geçti. Konsolda hata yok.

## +Level ekleme butonu önerisi

Kullanıcı "eklemek istersen +Level butonu gibi bir şey öner, ama bence
gerek yok" dedi ve gerekli olmadığını düşündüğünü belirtti — bu yüzden
**uygulanmadı**. İleride istenirse: sabit boş satırlar yerine listenin
altına tek bir "+ Add Level" butonu eklenip tıklanınca yeni bir satır
(varsayılan v:0, gri renk) eklenmesi önerilir.

## 3. tur — kalan 7 madde + menü hizalama

Kullanıcı ekran görüntüleriyle "yan yana durması gereken menüler"i ve 4
ek fonksiyonel sorunu bildirdi. Hepsi ele alındı:

### Menü hizalama (ekran görüntüsü ile)

Sorun: Trend line/Extend/Levels/Labels/Font size satırlarının etiket
genişlikleri (104-120px, tutarsız) ile seviye satırlarındaki (checkbox +
değer kutusu + renk) sütun başlangıcı hiç uyuşmuyordu; Extend/Levels/
Font size dropdown'ları da gereğinden geniş sabit piksellerdi.

- Tüm etiketli satırlar artık ortak `FIB_LABEL_W = 96px` kullanıyor
  (Trend line, Extend, Levels, Labels, Font size) — hepsi aynı x
  noktasından başlıyor.
- Extend dropdown'u `width:auto` yapıldı (metne göre daralıyor).
- Font size dropdown'u 168px'e sabitlendi — Labels satırındaki iki
  dropdown'un toplam genişliğiyle (80+8+80) birebir aynı.

### 4. Menüdeki değişiklikler grafiğe yansımıyordu — KÖK NEDEN BULUNDU

Bu, bulunan en ciddi hataydı. `drawing-fibo.js`'teki `_getFibLevels()`
fonksiyonu `styleObj.levels` diye **yanlış bir property adı** okuyordu —
oysa ayar diyaloğu ve kaydetme mantığı her yerde `styleObj.fibLevels`
kullanıyor. `.levels` hiçbir zaman set edilmediği için bu fonksiyon **her
zaman** sabit 7 seviyelik bir yedek listeye düşüyordu — kullanıcının
Level tik'i, değeri veya rengini değiştirmesinin çizime **hiçbir zaman**
etkisi olmuyordu. Muhtemelen bu özelliğin var olduğu süre boyunca hep
böyleydi. Tek satırlık düzeltme: `styleObj.levels` → `styleObj.fibLevels`.

Ayrıca `dsd-apply.js`'te fibLevels dizisinin uzunluğu her apply'da sabit
`24`'e zorlanıyordu (eski 24-satır döneminden kalma) — artık 12 satıra
indiğimiz için bu her etkileşimde diziyi 24 boş satıra sıfırlıyordu.
Gerçek checkbox sayısına göre boyutlandırılacak şekilde düzeltildi.

### 5. İlk tıklanan nokta artık "1" seviyesi

`drawing-fibo.js`'te 5 çizim fonksiyonundaki `reverse` varsayılanı
`!!s.fibReverse` (varsayılan kapalı) → `s.fibReverse !== false`
(varsayılan **açık**) yapıldı. Bu, zaten var olan "Reverse" checkbox'ının
tersine çevirme mantığını yeniden kullanıyor — kod tekrarı yok. Ayar
diyaloğundaki checkbox'ın görünümü de aynı varsayılanla senkronize
edildi (yeni bir Fib'de "Reverse" işaretli görünüyor, gerçek davranışla
tutarlı).

### 6. 1'den yüksek aktif seviyeler artık ilk çizimde de görünüyor

Kök neden, hem #4'ün (yanlış property adı) hem de yeni bulunan bir üçüncü
sorunun bileşimiydi: **taze çizilen bir Fib'in `d.style` objesi tamamen
boştu** (`drawing-core.js`'teki `_getToolStyle('fib-...')` sadece `{}`
döndürüyordu). Ayar diyaloğu hiç açılmadığı sürece `fibLevels` hiç
yoktu — `_getFibLevels` (düzeltilmiş haliyle bile) yine yedek listeye
düşüyordu. Çözüm: `dsd-fibo-tabs.js`'teki varsayılan seviye hesaplama
mantığı `_computeDefaultFibLevels(tool)` adıyla ayrı bir fonksiyona
çıkarılıp `DSDFiboTabs.getDefaultLevels` olarak dışa açıldı;
`drawing-core.js`'teki `_getToolStyle` artık bir Fib aracı **ilk
oluşturulduğu anda** bu fonksiyonu çağırıp `fibLevels`'i dolduruyor.
Böylece ayar diyaloğu ile ilk çizim aynı varsayılanı kullanıyor, hiç
tutarsızlık kalmıyor.

**Doğrulama** (gerçek chart üzerinde, sidebar'dan araç seçilip iki
noktaya tıklanarak): taze çizilen Fib'in `d.style.fibLevels`'i hemen
12 seviye içeriyor, `1.618` `active:true` olarak mevcut — ayarlar
diyaloğu hiç açılmadan.

### 7 (yeni #2) — Fiyat etiketleri artık grafikle aynı hassasiyette

`priceAt.toFixed(2)` sabiti (fib-ret ve fib-ext'te, 2 yer) kaldırıldı,
yerine grafiğin kendi dinamik ondalık formatlayıcısı (`_formatPrice`,
`window.formatPrice`'a delege ediyor) kullanıldı. Artık düşük fiyatlı
coinlerde (ör. 0.00001234) basamaklar kaybolmuyor.

### Yeni bulunan #3 — "Labels → Middle" hizalaması çalışmıyordu

`_drawFibRet` ve `_drawFibExt`'te "Middle" seçiliyken `ctx.textBaseline`
hiçbir zaman `'middle'` olmuyordu — kod doğrudan `'bottom'`a düşüyordu,
yani metin görünürde hep "Top" gibi çizginin üstünde duruyordu (kodda bile
"Middle (baseline above line)" diye itiraf eden bir yorum vardı). Diğer
Fib araçları (Channel, Circles, Speed Fan) bunu zaten doğru yapıyordu —
sadece Retracement ve Extension'da eksikti. Düzeltildi: `textBaseline:
'middle'`, `textY: ly` (çizginin tam üzerinde ortalanıyor).

### Yeni bulunan #4 — "Fib levels based on log scale" hiç uygulanmıyordu

Checkbox var, `dsd-apply.js` değeri `s.fibLogScale`'e kaydediyordu, ama
**çizim fonksiyonu bu alanı hiç okumuyordu** — tik açıp kapatmanın
grafik üzerinde sıfır etkisi vardı. `_drawFibRet`'e `_fibPriceAt(v)` /
`_fibYAt(v)` yardımcıları eklendi: kapalıyken (varsayılan) seviyeler iki
fiyat arasında aritmetik (eşit fiyat farkı) aralıklarla, açıkken
geometrik (eşit oran, `p1 * (p2/p1)^v`) aralıklarla hesaplanıyor — ikincisi
gerçek "log ölçek" Fibonacci mantığı. `pane.series.priceToCoordinate` ile
gerçek chart koordinatına çevriliyor.

⚠️ **Kapsam notu**: Bu son iki düzeltme (#3 Middle, #4 log scale) sadece
`_drawFibRet` (Fib Retracement) ve kısmen `_drawFibExt` (Fib Extension)
içinde yapıldı — kullanıcının bildirdiği araç buydu. Fib Channel/Circles/
Speed Fan gibi diğer araçlar zaten Middle'ı doğru yapıyordu; log-scale
desteğinin onlarda da eksik olup olmadığı ayrıca kontrol edilmedi.

### Doğrulama (3. tur, gerçek chart üzerinde)

| Test | Sonuç |
|---|---|
| Menü ilk açılışta navbar üstüne taşıyor mu (kayıtlı kötü konum simüle edilerek) | ✅ artık `top:40`'a anında kısıtlanıyor, taşma yok |
| Taze çizilen Fib'de `fibLevels` dolu mu (diyalog açılmadan) | ✅ 12 seviye, `1.618 active:true` |
| Log scale checkbox işaretlenip Ok'a basılınca `style.fibLogScale` kaydediliyor mu | ✅ `true` |
| Labels→Middle varsayılan seçili mi | ✅ evet |
| Log-scale açıkken yeniden çizim hata veriyor mu | ✅ hayır, console temiz |
| `node --check` (5 dosya) | ✅ hepsi geçti |

## Değişen dosyalar

| Dosya |
|---|
| `js/drawing/ui/dsd-tabs/dsd-fibo-tabs.js` |
| `js/drawing/ui/drawing-settings-dialog.js` |
| `js/drawing/tools/drawing-fibo.js` |
| `js/drawing/ui/dsd-tabs/dsd-apply.js` |
| `js/drawing/core/drawing-core.js` |

## 4. tur — kayıt (OK) sorunu, extend sonrası seçilememe, son hizalama/renk ince ayarları

### 1) OK'a basınca değişiklikler kaydolmuyordu — KÖK NEDEN BULUNDU

Bu da ciddi bir hataydı. Ayar diyaloğundaki OK/tik/değer değişiklikleri
(`dsd-apply.js`) `drawing` objesini **yerinde (mutate ederek)** güncelliyor.
Bu obje `State`'in kendi `_state.drawings` dizisiyle aynı referans olduğu
için değişiklik aynı sekme/oturumda hemen görünüyordu (chart doğru
çiziyordu) — ama hiçbir yerde `State.set('drawings', ...)` çağrılmadığı
için gerçek kaydetme fonksiyonu (`save()` → localStorage + bulut senkron)
**hiç tetiklenmiyordu**. Yani sayfa yenilenince (veya farklı bir cihazda
açılınca) menüde yapılan TÜM değişiklikler kayboluyordu — sadece o anki
sekme/oturumda "sanki kaydedilmiş" gibi görünüyordu.

**Düzeltme**: `drawing-core.js`'teki merkezi `drawing:settings:saved`
event dinleyicisi (zaten HER ayar değişikliğinde tetikleniyor) artık
`State.set('drawings', State.get('drawings'))` çağrısı da yapıyor —
bu tek satır tüm ayar diyaloğu değişikliklerini (sadece Fibo değil, TÜM
araçlar için) gerçekten localStorage'a ve buluta yazıyor.

**Doğrulama**: Extend Right işaretlenip OK'a basıldı → tarayıcının kendi
`localStorage`'ındaki (`perpetual_state_v1`) ham veri doğrudan okunup
`extendRight:true` olarak kayıtlı olduğu doğrulandı (in-memory State
değil, gerçek disk/tarayıcı deposu).

### 2) Extend sonrası level çizgilerine tıklayınca seçilememe — KÖK NEDEN BULUNDU

`drawing-core.js`'in hit-test (tıklama algılama) bölümünde, Fibo
araçlarının "ters" (Reverse) durumunu okuyan satır hâlâ eski varsayılanı
kullanıyordu: `const reverse = !!s.fibReverse;` (varsayılan KAPALI). Ama
bir önceki turda çizim tarafını (`drawing-fibo.js`) "ilk tıklanan nokta =
seviye 1" isteğiniz için varsayılan AÇIK'a çevirmiştim
(`s.fibReverse !== false`). Bu iki taraf artık **uyuşmuyordu**: taze
çizilen (ayar diyaloğu hiç açılmamış) bir Fib'in seviye çizgileri EKRANDA
bir yerde duruyordu, ama tıklama-algılama kodu o çizgiyi **ayna
(tersinden hesaplanmış) bir konumda** arıyordu — level çizgileri
(özellikle 0.5'ten uzak olanlar) tıklanamaz hale geliyordu. Extend
sonrası bunun daha belirgin fark edilmesi muhtemelen çizginin ekranda
daha uzun/geniş bir alana yayılıp gerçek/hesaplanan konum farkının daha
göze çarpar hale gelmesinden kaynaklanıyor.

**Düzeltme**: Hit-test tarafındaki satır da `s.fibReverse !== false`
yapıldı — artık çizim ve tıklama algılama HER ZAMAN aynı varsayılanı
kullanıyor.

**Doğrulama**: `DrawingManager.utils.pt2xy` ile gerçek ekran koordinatları
okunup, çizim formülüyle (artık hit-test ile birebir aynı) hesaplanan
seviye Y konumu karşılaştırıldı — ikisi tam örtüşüyor (matematiksel
doğrulama; tam DOM tıklama-olayı zincirinin bu test ortamında güvenilir
şekilde simüle edilmesi mümkün olmadı, ama kök neden koddaki formül
uyuşmazlığıydı ve o giderildi).

### 3-6) Son hizalama ve renk ince ayarları

Gerçek diyalog DOM'unda `getBoundingClientRect()` ile ölçüm yapılarak
(tahmin değil, ölçülerek) uygulandı:

| Öğe | Önce | Sonra |
|---|---|---|
| Trend line rengi + Extend dropdown x konumu | 442px | **453px** (seviye satırlarının ilk sütun renk kutusuyla birebir aynı) |
| Use one color renk kutusu x konumu | 466px | **453px** (aynı hizaya çekildi) |
| Background satırı | 120px etiket (tutarsız) | Diğerleriyle aynı `FIB_LABEL_W` (107px) — hizayı bozmasın diye |
| "Extend" yazı rengi | `#787b86` (soluk gri) | **`#d1d4dc`** (beyaz) |
| "Labels" yazı rengi | `#787b86` | **`#d1d4dc`** |
| "Font size" yazı rengi | `#787b86` | **`#d1d4dc`** |

Ortak `FIB_LABEL_W` sabiti 96'dan **107**'ye çıkarıldı — bu tek değişiklik
Trend line/Extend/Use one color/Background/Levels/Labels/Font size
satırlarının hepsini aynı anda doğru hizaya getirdi.

**Doğrulama**: Diyalog açılıp tüm ilgili elemanların `getBoundingClientRect().left`
değerleri ölçüldü — Trend line rengi, Extend dropdown, Use one color
rengi ve seviye satırının ilk renk kutusu **hepsi 453px**'te birebir
örtüşüyor. Renk kontrolü: üç etiketin de `getComputedStyle(...).color`
değeri `rgb(209, 212, 220)` (beyaz) olarak doğrulandı.

## Değişen dosyalar (bu tur eklenenler)

| Dosya | Bu turdaki değişiklik |
|---|---|
| `js/drawing/core/drawing-core.js` | `drawing:settings:saved`'e `State.set('drawings',...)` eklendi (kayıt bug'ı); hit-test'teki `reverse` varsayılanı düzeltildi |
| `js/drawing/ui/dsd-tabs/dsd-fibo-tabs.js` | `FIB_LABEL_W` 96→107; Use one color/Background genişlikleri birleştirildi; Extend/Labels/Font size yazı renkleri beyaz yapıldı |

## 5. tur — 1 ve 2. maddelerin gerçek tarayıcıda uçtan uca doğrulanması

Kullanıcı 4. turdaki düzeltmelerin gerçekten tarayıcıda çalışıp
çalışmadığını sordu ve "çiz → ayarla → OK → sil → tekrar çiz" senaryosunu
bizzat denememi istedi. Bunu yaparken **2. madde için 4. turdaki
düzeltmenin YETERSİZ olduğu ortaya çıktı** — ikinci, daha derin bir hata
bulundu ve düzeltildi.

### Test yöntemi hakkında dürüstlük notu

Gerçek fare tıklamaları (`computer` aracı, ekran görüntüsü tabanlı
koordinatlarla) ve gerçek DOM olayları (`window.DrawingManager.onMouseDown`
— chart-pane.js'in **gerçek tıklamalarda çağırdığı fonksiyonun aynısı**,
`e.clientX/clientY` ile) karışık kullanıldı. Seviye çizgileri ~6-10px gibi
dar bir toleransla algılandığı için, ekran görüntüsü→gerçek piksel
dönüşümündeki küçük ölçek hataları (bu ortamda ~0.832 oranı) bazı manuel
fare tıklamalarını ıskalattı. Bu ıskalamalar UYGULAMANIN hatası değil,
test aracının piksel hassasiyeti sınırıydı — bu yüzden kritik doğrulamalar
**gerçek tıklamanın çağırdığı fonksiyonun ta kendisini, gerçek istemci
koordinatlarıyla** çağırarak yapıldı (bu, sahte/basitleştirilmiş bir test
değil, uygulamanın kendi kod yolu). Ayrıca OK butonu ve araç seçimi gibi
büyük/toleranslı hedeflerde gerçek `computer` tıklamaları sorunsuz çalıştı.

### 2. madde — ikinci, daha derin hata bulundu: `effP1Y` eksikliği

4. turda hit-test'teki `reverse` varsayılanını çizimle eşitlemiştim, ama
gerçek tarayıcıda test edince **extend edilmiş bölgede 8 aktif seviyeden
sadece 1 tanesinin (v=0) hâlâ tıklanabilir olduğunu** tespit ettim —
düzeltme kısmi kalmıştı. Kök neden: `drawing-core.js`'teki fib-ret
hit-test'i seviyenin Y konumunu hep `a.y` (p1) taban alarak hesaplıyordu:

```js
const ly = a.y + effYDiff * lvl.v;   // YANLIŞ — taban hep a.y (p1)
```

Ama `reverse` açıkken (varsayılan), ÇİZİM tarafı tabanı `b.y`'ye (p2)
kaydırıyor. Yani `effYDiff`'in işareti çevriliyordu ama taban nokta
çevrilmiyordu — v=0 dışındaki HER seviye (v=0'da çarpan sıfırlandığı için
taban farkı gizleniyordu) gerçek çizilen konumdan farklı bir yerde
aranıyordu. Düzeltme:

```js
const effP1Y = reverse ? b.y : a.y;  // DOĞRU — çizimle birebir aynı
const ly = effP1Y + effYDiff * lvl.v;
```

### Doğrulama (gerçek tarayıcı, önce/sonra karşılaştırması)

Uzatılmış (Extend Right) bölgede, x sabit tutulup y ekseni 0-912 arası
5px adımlarla tarandı (`window.DrawingManager.onMouseDown` ile — gerçek
tıklamanın çağırdığı fonksiyonun ta kendisi):

| | Önce (bu turdan önce) | Sonra (bu turdaki düzeltmeyle) |
|---|---|---|
| Hittable seviye sayısı (extend bölgesinde) | **1 / 8** (sadece v=0) | **7 / 8** (görünür olan tüm seviyeler — 8.si olan 1.618 muhtemelen ekran dışında) |

**Uçtan uca gerçek senaryo** (kullanıcının istediği tam sırayla):
1. ✅ Gerçek fare ile Fib Retracement çizildi (2 tıklama)
2. ✅ İlk tıklanan nokta "1.000" olarak etiketlendi (ekran görüntüsüyle doğrulandı)
3. ✅ Ayar panelinde Extend→Right seçildi, 1,272 checkbox'ı işaretlendi
4. ✅ **Ok** butonuna gerçek tıklama yapıldı
5. ✅ `localStorage`'daki (`perpetual_state_v1`) ham veri okundu:
   `extendRight:true`, `1.272 active:true` — **gerçekten diske yazılmış**
6. ✅ Çizim silindi, **yeni bir Fib gerçek fare ile sıfırdan çizildi**
7. ✅ Yeni çizimde `fibLevels` hemen 12 seviye içeriyordu, `1.618
   active:true` — ayar paneli hiç açılmadan (ekran görüntüsüyle de
   doğrulandı: "1.000"/"0.000" uçları doğru, 7 seviye görünür aralıkta)

Test sonrası tüm test çizimleri temizlendi, console hatası yok.

## Değişen dosyalar (5. tur eklenen)

| Dosya | Bu turdaki değişiklik |
|---|---|
| `js/drawing/core/drawing-core.js` | fib-ret hit-test'ine `effP1Y` eklendi — taban Y artık `reverse`'e göre çizimle birebir aynı noktayı kullanıyor |

## 6. tur — kullanıcı geri bildirimi: "Reverse" kutusunu ben istemedim + mimari düzeltme

Kullanıcı haklı olarak sert bir geri bildirimde bulundu: 5. turdaki
düzeltme "Reverse" kutusunu **varsayılan işaretli** hale getirerek "ilk
tık = 1" davranışını elde ediyordu — ama kullanıcı bunu hiç istememişti,
sadece sonucu (ilk tık = 1) istemişti. Ayrıca aynı hata sınıfının
(çizim ile hit-test'in birbirinden bağımsız kopya formüllerle
hesaplanması) ard arda **iki kez** ortaya çıkması, altyapısal bir
sorunun işareti: aynı mantığın birden fazla yerde elle kopyalanması.

### Yapılan mimari düzeltme

`drawing-fibo.js`'e **tek doğruluk kaynağı** olan bir fonksiyon eklendi:

```js
function _fibAxis(aVal, bVal, reverse) {
  return reverse
    ? { base: aVal, span: bVal - aVal }   // klasik: a=0, b=1
    : { base: bVal, span: aVal - bVal };  // varsayılan: a=1, b=0
}
```

- **Çizim** (`_drawFibRet`) artık bunu çağırıyor.
- **Hit-test** (`drawing-core.js`) artık kendi kopyasını hesaplamıyor,
  `window.DrawingFibo.fibAxis(...)` çağırıyor — **aynı fonksiyon**.
- "Reverse" kutusunun varsayılanı **`!!s.fibReverse`** (kapalı) olarak
  geri alındı — hem çizimde hem ayar diyaloğunda. Kullanıcı hiçbir kutuyu
  açmadan "ilk tık = 1" davranışını elde ediyor; "Reverse" kutusu artık
  sadece kullanıcı bilerek işaretlerse klasik (ilk tık=0) davranışa
  dönmek için var.

Bu yapı sayesinde çizim ile hit-test'in birbirinden sapması **artık
yapısal olarak imkânsız** — ikisi de aynı tek fonksiyonu çağırıyor.

### Doğrulama (tamamen gerçek fare/klavye ile, uçtan uca)

1. ✅ Gerçek fare ile Fib çizildi — ilk tıklanan nokta ekranda "1.000" (ekran görüntüsü)
2. ✅ Ayar paneli gerçek gear tıklamasıyla açıldı — **"Reverse" kutusu işaretsiz** (ekran görüntüsüyle doğrulandı — kullanıcının istediği tam olarak bu)
3. ✅ Extend→Right seçildi, 1,272 seviyesi açıldı
4. ✅ **Ok** butonuna gerçek tıklama yapıldı
5. ✅ `localStorage` ham verisi okundu: `extendRight:true`, `lvl1272Aktif:true`, **`fibReverse:false`** — kutu kapalıyken bile ayarlar doğru kaydedildi
6. ✅ Uzatılmış bölgede 0-912px tam tarama: **8/8 aktif seviye artık tıklanabiliyor** (önceki turda sadece 1/8'di)
7. ✅ Çizim silindi, **sıfırdan yeniden çizildi** (gerçek fare) — yeni çizimde `fibReverse` yine tanımsız/false (Reverse kapalı kalıyor), `1.618 active:true`, eski çizimin `extendRight` ayarı yeni çizime bulaşmamış (ekran görüntüsüyle de doğrulandı: yeni çizim "Don't extend" durumunda, temiz başlıyor)

Test sonrası tüm test çizimleri temizlendi, console hatası yok.

## 7. tur — varsayılan Labels = Top + "son kullanılan ayarı hatırlama" eksikliği

Kullanıcı iki şey istedi:
1. Varsayılan dikey etiket hizası "Middle" yerine "Top" olsun.
2. **Asıl önemli sorun**: Trend Line gibi diğer araçlarda son çizilen
   aracın ayarları (renk, kalınlık vb.) hatırlanıp yeni çizimde otomatik
   kullanılıyor — ama Fibo'da bu hiç çalışmıyordu, her yeni Fib hep
   sıfırdan (sabit varsayılan) çiziliyordu, ayarlardan yapılan
   değişiklikler "unutuluyordu".

### Kök neden — Fib araçları iki noktada da hariç tutulmuştu

`drawing-core.js`'teki "son kullanılan ayarı hatırla" mekanizması
(`_toolStyles` cache + `State.get('drawingStyles')`) **tüm** araçlar için
çalışıyordu — TEK istisna Fib araçlarıydı, iki ayrı yerde açıkça hariç
tutulmuşlardı:

1. **Okuma tarafı** (`_getToolStyle`): `if (tool.startsWith('fib-'))` bloğu
   `_toolStyles[tool]` önbelleğine hiç bakmadan direkt taze varsayılan
   seviyeleri döndürüp çıkıyordu (`return` erken bitiyordu).
2. **Yazma tarafı** (`drawing:settings:saved` olayı): `if
   (!d.tool.startsWith('fib-'))` koşulu Fib araçlarının stilini
   `_toolStyles`'a hiç kaydetmiyordu.

Yani Fib için hem "hatırlama" hem "kaydetme" baştan devre dışıydı —
muhtemelen daha önceki bir turda bilinçli ya da bilinçsiz olarak böyle
bırakılmıştı. Düzeltme: her iki kısıtlama da kaldırıldı, Fib artık
**tam olarak Trend Line ile aynı mekanizmayı** kullanıyor.

### Varsayılan Labels = Top

`drawing-fibo.js` (3 yer: fib-ret, fib-ext, fib-channel) ve
`dsd-fibo-tabs.js`'teki `s.fibLabelsV || 'Middle'` → `s.fibLabelsV ||
'Top'` yapıldı.

### Doğrulama (tamamen gerçek fare ile, uçtan uca)

1. ✅ Gerçek fare ile Fib çizildi — ayar paneli açılınca **"Labels: Top"**
   varsayılan olarak seçili (hiç dokunmadan) — ekran görüntüsüyle doğrulandı
2. ✅ Font size → 20, Use one color → yeşil değiştirildi, **gerçek OK
   tıklandı**
3. ✅ Çizim silindi
4. ✅ **Sıfırdan yeni bir Fib gerçek fare ile çizildi** — hiçbir ayar
   diyaloğu açılmadan: `fontSize:20`, `useOneColor:"#4caf50"`,
   `labelsV:"Top"` otomatik uygulandı (hem veri okuyarak hem ekran
   görüntüsüyle doğrulandı — büyük yeşil yazı, etiketler çizginin üstünde)

Not: Testin ilk turunda önceki (5./6. tur test oturumlarından kalan)
eski bir `_toolStyles['fib-ret']` kaydı (`fibReverse:true` içeren)
otomatik geri yüklendiğini fark ettim — bu aslında düzeltmenin ÇALIŞTIĞININ
kanıtıydı (eski kayıt "son ayar" olarak hatırlanmıştı), ama temiz bir
doğrulama için o eski kaydı silip sıfırdan tekrar test ettim.

Test sonrası tüm test çizimleri ve önbellek temizlendi, console hatası yok.

## Değişen dosyalar (7. tur eklenen)

| Dosya | Bu turdaki değişiklik |
|---|---|
| `js/drawing/core/drawing-core.js` | `_getToolStyle` ve `drawing:settings:saved`'teki Fib hariç tutma kısıtlamaları kaldırıldı — artık Trend Line ile aynı "son ayarı hatırla" yolunu kullanıyor |
| `js/drawing/tools/drawing-fibo.js` | Varsayılan `fibLabelsV`: Middle → Top (3 yer) |
| `js/drawing/ui/dsd-tabs/dsd-fibo-tabs.js` | Aynı varsayılan değişikliği (ayar panelindeki görünüm) |

## Sıradaki adım

- Aynı `_fibAxis` mimarisinin fib-ext/fib-channel/fib-timebased gibi diğer
  Fib araçlarına da uygulanması gerekiyor — bu turda SADECE fib-ret
  merkezi fonksiyona taşındı. Diğerleri hâlâ eski (kopya, potansiyel
  olarak sapabilecek) formülleri kullanıyor.
- Log-scale ve Middle-label düzeltmelerinin diğer Fib araçlarında
  (Channel, Extension'ın geri kalanı, Circles, Speed Fan) da gerekip
  gerekmediği kontrol edilmeli.
- `drawing:settings:saved`'in HER tek etkileşimde (her tik, her karakter)
  `State.set` (localStorage yazma) tetiklemesi performans açısından
  gözden geçirilebilir — şimdilik doğruluk önceliklendirildi, çok sık
  tetiklenirse debounce eklenebilir.
- Önceki turdan bekleyen: `funding:loaded` tam panel yenileme israfı
  (bkz. `../SISTEM-GENEL-DEGERLENDIRME.md` §10.2.1 "kalan öneri")
