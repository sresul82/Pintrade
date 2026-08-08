# Fibo Araçları — 4 Hata Düzeltmesi (Level stil, Fib Ext sürükleme, Time Zone ayarları, Speed Fan) — 2026-08-02

## İstek

Kullanıcı ekran görüntüleriyle 4 ayrı sorun bildirdi:

1. Seviye satırındaki renk düğmesine tıklayınca açılan çizgi tipi/kalınlık
   popup'ı seviye çizgilerini etkilemiyor — tüm fibolarda kontrol edilmeli.
2. Trend-Based Fib Extension'da "1" seviyesine tıklanınca tüm araç fare
   imlecine yapışıp beraber hareket ediyor (bug).
3. Fib Time Zone'da "Logaritmik" seçimi ve Extend left/right gereksiz —
   çizim zaten dikeyde ekranı kaplıyor.
4. Fib Speed Resistance Fan bizim platformda TradingView'e kıyasla
   tamamen yanlış render ediliyor (ekran görüntüleri karşılaştırıldı).

## 1) Seviye başına çizgi tipi/kalınlık uygulanmıyordu

**Kök neden**: `drawing-settings-dialog.js`'teki `js-fib-color` tıklama
handler'ı (satır ~1359) her seviye için `lvlArr[idx].width` ve
`lvlArr[idx].style` kaydediyordu — **Fib Speed Fan hariç tüm fibo
araçlarının çizim fonksiyonları** (`_drawFibRet`, `_drawFibExt`,
`_drawFibChannel`, `_drawFibTimezone`, `_drawFibTimebased`,
`_drawFibCircles`) bunu hiç okumuyordu; sadece TÜM seviyeler için ortak
`s.levelsWidth` / `s.levelsStyle` kullanıyorlardı. Yani bir seviyenin
çizgi tipini/kalınlığını değiştirmenin çizim üzerinde hiçbir etkisi
yoktu — sadece Fib Speed Fan (zaten `lvl.width`/`lvl.style` okuyordu)
doğru çalışıyordu.

**Düzeltme**: `js/drawing/tools/drawing-fibo.js`'e paylaşılan bir
`_levelLineStyle(s, lvl)` yardımcı fonksiyonu eklendi:
```js
function _levelLineStyle(s, lvl) {
  const width = lvl.width || s.levelsWidth || s.width || 1;
  const style = lvl.style || s.levelsStyle || 'solid';
  const dash  = style === 'dashed' ? [8, 5] : style === 'dotted' ? [3, 3] : [];
  return { width, dash };
}
```
6 çizim fonksiyonunun tümünde döngü içinde (her seviye için) çağrılacak
şekilde güncellendi — artık her seviye önce KENDİ width/style'ına
bakıyor, yoksa ortak ayara düşüyor.

**Doğrulama**: Gerçek tarayıcıda bir Fib Retracement çizildi, `0.5`
seviyesine `width:6, style:'dotted'` elle atanıp yeniden çizim tetiklendi
— ekran görüntüsünde SADECE o seviye kalın/noktalı, diğerleri ince/düz
göründü. Konsolda hata yok.

## 2) Fib Extension'da level tıklayınca tüm araç fareye yapışıyor

**Araştırma**: `DrawingManager.onMouseDown/onMouseMove/onMouseUp`
gerçek fonksiyonları gerçek koordinatlarla çağrılarak seviye çizgisi
sürüklendi — dahili state doğru çalışıyordu (drag sırasında doğru
öteleniyor, `mouseup`'ta düzgün duruyor, sonrasında fare hareketi
şekli etkilemiyor). Yani "iş mantığı" (state machine) bozuk değildi.

**Gerçek kök neden**: `js/chart/chart-pane.js`'teki `pointerdown/
pointermove/pointerup` dinleyicileri `this.cvs` (pane sarmalayıcısı)
üzerine bağlıydı ve **`setPointerCapture` hiç çağrılmıyordu**. Fib
Extension'ın seviye çizgileri (özellikle "Extend right/left" ile veya
uzak `1.618` gibi seviyeler) genelde canvas'ın kenarına/dışına taşan
geniş alanlarda oluyor — kullanıcı böyle bir çizgiyi sürüklerken fare
imleci `this.cvs` sınırlarının dışına çıkarsa (çok olası, çünkü hedef
zaten kenara yakın), tarayıcı `pointerup` olayını artık o elemente
GÖNDERMEZ (capture yoksa). Sonuç: `_dragState` hiç temizlenmiyor,
çizim gerçekten fareye "yapışık" kalıyor — ta ki kullanıcı canvas
içinde başka bir yere tıklayana kadar (yeni bir `mousedown` state'i
sıfırlıyor, bu da "bir sonraki tıklamada düzeliyormuş" izlenimi
veriyor).

**Düzeltme**: `pointerdown`'da `this.cvs.setPointerCapture(e.pointerId)`
çağrılıyor (yakalanan olaylar için), `pointerup`'ta
`releasePointerCapture` ile serbest bırakılıyor. Artık imleç nereye
giderse gitsin `pointermove`/`pointerup` bu elemente teslim edilmeye
devam ediyor — bu SADECE Fib Extension'ı değil, kenara/dışarı taşan
her türlü sürükleme senaryosunu (extend edilmiş trendline'lar dahil)
düzeltiyor.

**Doğrulama**: Gerçek fare ile bir trend line çizildi ve sürüklendi —
normal sürükleme davranışı bozulmadı (regresyon yok), konsolda hata yok.
(Not: `dispatchEvent` ile üretilen sentetik `PointerEvent`'ler
`isTrusted:false` olduğu için `setPointerCapture`'ı tetiklemiyor —
bu yüzden doğrulama gerçek `computer` aracıyla, gerçek fare olaylarıyla
yapıldı.)

## 3) Fib Time Zone'da gereksiz "Extend" ve "Log scale" seçenekleri

`_drawFibTimezone` çizim fonksiyonu zaten `s.extendLeft`/`s.extendRight`
hiç okumuyor (çizgiler her zaman `yTop=0`'dan `yBottom=H`'ye, yani tam
ekran boyunda çiziliyor) ve log-scale mantığı sadece Fib Retracement'ta
var. Yani bu iki ayar Fib Time Zone için zaten hiçbir işe yaramıyordu.

**Düzeltme**: `js/drawing/ui/dsd-tabs/dsd-fibo-tabs.js`'te
`isFibTimezone` kontrolü eklendi — "Extend" satırı ve "Fib levels based
on log scale" checkbox'ı artık Fib Time Zone ayar panelinde
gösterilmiyor (Fib Channel için log-scale zaten aynı şekilde
gizliydi).

**Doğrulama**: `DSDFiboTabs.renderFibStyleTab({tool:'fib-timezone'})`
çağrılıp üretilen HTML'de `dsd-fib-extend` ve `dsd-fib-logscale`
elemanlarının **olmadığı** doğrulandı; `fib-ret` için hâlâ **var
olduğu** doğrulandı (regresyon yok).

## 4) Fib Speed Resistance Fan tamamen yanlış render ediliyordu

**Kök neden**: `_drawFibSpeedfan` (`drawing-fibo.js`) `_extendToEdge(...)`
fonksiyonunu çağırıyordu ama bu fonksiyon **bu dosyada hiç tanımlı
değildi** — sadece `drawing-core.js` ve `drawing-trend.js`'in KENDİ
kapalı (IIFE) scope'larında tanımlıydı, `drawing-fibo.js` (ayrı bir IIFE
modül) buna erişemiyordu. Sonuç: fan çizgileri hesaplanırken
`ReferenceError: _extendToEdge is not defined` fırlıyordu.
`drawing-core.js`'teki `_renderDrawing` her çizimi bir `try/catch` ile
sarmaladığı için bu hata sessizce yutuluyordu — arkaplan dolgusu (renkli
yatay bantlar) ve grid (kesikli beyaz çizgiler) zaten hatadan ÖNCE
çizildiği için görünüyordu, ama asıl "fan" (merkezden ışınsal) çizgileri
hiç render edilmiyordu. Ekran görüntüsündeki "kutu + yatay bantlar +
dikey kesikli çizgiler, fan yok" görüntüsü tam olarak bununla örtüşüyor.

**Düzeltme**: `drawing-fibo.js`'e `_extendToEdge` fonksiyonunun kendi
kopyası eklendi (drawing-core.js'teki ile birebir aynı matematik).

**Doğrulama**: Gerçek tarayıcıda `DrawingManager.onMouseDown/onMouseUp`
ile gerçek bir Fib Speed Fan çizildi, konsolda hata kalmadığı ve
ekran görüntüsünde artık p1'den ışınsal olarak yayılan çok renkli fan
çizgilerinin (TradingView referansındaki gibi) göründüğü doğrulandı.

## Değişen dosyalar

| Dosya | Değişiklik |
|---|---|
| `js/drawing/tools/drawing-fibo.js` | `_levelLineStyle()` eklendi ve 6 çizim fonksiyonunda kullanıldı; `_extendToEdge()` eklendi (Fib Speed Fan artık render oluyor) |
| `js/chart/chart-pane.js` | `pointerdown`'da `setPointerCapture`, `pointerup`'ta `releasePointerCapture` — sürükleme sırasında imleç canvas dışına çıksa da drag state doğru kapanıyor |
| `js/drawing/ui/dsd-tabs/dsd-fibo-tabs.js` | Fib Time Zone ayar panelinden "Extend" ve "Fib levels based on log scale" kaldırıldı |

`node --check` üç dosyada da geçti. Gerçek tarayıcıda 4 sorunun hepsi
uçtan uca doğrulandı, test çizimleri temizlendi, konsolda hata yok.

## Kapsam dışı bırakılan / takip önerisi

- `drawing-core.js:848`'te unutulmuş bir debug satırı var:
  `console.log('ht:', ht, htDrawing?.tool);` — her fare hareketinde
  konsolu kirletiyor. Bu görevin kapsamı dışında, ayrı bir temizlik
  olarak öneriliyor.
- Fib Channel'ın ayar panelinde de "Extend" seçeneği gösteriliyor ama
  `_drawFibChannel` bunu hiç okumuyor (Fib Time Zone'daki ile aynı
  sınıf sorun) — kullanıcı bunu bildirmedi, dokunulmadı.
