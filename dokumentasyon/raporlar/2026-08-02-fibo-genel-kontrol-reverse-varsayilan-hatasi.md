# Fibo Araçları Genel Kontrol — "Reverse" Varsayılan Tutarsızlığı — 2026-08-02

## İstek

> "şimdi sıradaki fibolar icin ayarlar durumunu ve genel kontrolunu yap
> dokumentasyonde kaydettiklerinede bakabilirsin fibo ile ilgili"

`2026-08-01-fib-seviye-listesi-kisaltma.md` raporunun sonundaki "Sıradaki
adım" maddesi takip edildi: *"Aynı `_fibAxis` mimarisinin fib-ext/
fib-channel/fib-timebased gibi diğer Fib araçlarına da uygulanması
gerekiyor — bu turda SADECE fib-ret merkezi fonksiyona taşındı."*

## Bulunan hata

`drawing-fibo.js`'te **4 araç** (Fib Extension, Fib Channel, Fib Time
Zone, Fib Speed Fan) hâlâ şu satırı kullanıyordu:

```js
const reverse = s.fibReverse !== false;   // varsayılan TRUE
```

Oysa:
- Ayar diyaloğu (`dsd-fibo-tabs.js`) "Reverse" checkbox'ını **varsayılan
  işaretsiz** gösteriyor (`!!s.fibReverse` → false).
- `drawing-core.js`'teki hit-test (tıklama algılama) de **tüm** fib
  araçları için paylaşılan tek bir `const reverse = !!s.fibReverse;`
  (varsayılan false) kullanıyor.

Yani: kullanıcı "Reverse" kutusuna hiç dokunmadan bu 4 aracı çizdiğinde,
**çizim** "reversed" (ters) pozisyonda çiziliyordu ama **tıklama
algılama** "ters olmayan" pozisyonu arıyordu. Sonuç: bu 4 aracın seviye
çizgileri varsayılan ayarlarla neredeyse hiç tıklanamıyordu — tam olarak
fib-ret'te 5./6. turda bulunup düzeltilen hata sınıfının bir tekrarı
(bkz. önceki rapor).

Fib Retracement zaten 6. turda düzeltilmişti (`!!s.fibReverse`,
varsayılan false, hem çizim hem hit-test `DrawingFibo.fibAxis` tek
kaynağını kullanıyor) — bu turda dokunulmadı.

## Düzeltme

`js/drawing/tools/drawing-fibo.js` — 4 fonksiyonda tek satır değişikliği:

| Fonksiyon | Önce | Sonra |
|---|---|---|
| `_drawFibExt` | `s.fibReverse !== false` | `!!s.fibReverse` |
| `_drawFibChannel` | `s.fibReverse !== false` | `!!s.fibReverse` |
| `_drawFibTimezone` | `s.fibReverse !== false` | `!!s.fibReverse` |
| `_drawFibSpeedfan` | `s.fibReverse !== false` | `!!s.fibReverse` |

Artık 5 fib aracının (ret, ext, channel, timezone, speedfan) hepsi aynı
varsayılanı kullanıyor ve ayar diyaloğu + hit-test ile birebir uyumlu.

## Doğrulama (gerçek tarayıcı, gerçek kod yolu)

Ekran görüntüsü tabanlı fare tıklamaları yerine — önceki raporda da not
edildiği gibi ekran görüntüsü→gerçek piksel dönüşümünde ölçek farkı
küçük hedefleri ıskalatıyor — `window.DrawingManager.onMouseDown/Up`
gerçek fonksiyonları gerçek `getBoundingClientRect()` koordinatlarıyla
doğrudan çağrıldı (chart-pane.js'in gerçek tıklamada çağırdığı
fonksiyonların ta kendisi):

1. **Fib Channel** gerçek 3 nokta ile çizildi (`EventBus.emit('drawing:tool:set', ...)` + `onMouseDown/onMouseUp`).
   `v=1.618` (aktif) seviyesinin çizim formülüyle hesaplanan orta noktasına
   tıklandı → `drawing:selected` event'i doğru `id` ile tetiklendi. ✅
2. **Fib Extension** gerçek 3 nokta ile çizildi. `v=1.618` seviyesinin
   uzatılmış (extend) bölgedeki konumuna tıklandı → doğru `id` ile
   seçildi. ✅
3. Her iki çizimde de `d.style.fibReverse` tanımsız (`undefined`) —
   yani "Reverse" kutusu hiç işaretlenmemiş varsayılan durumda test
   edildi (en yaygın senaryo).
4. Test çizimleri temizlendi (`State.set('drawings', {BTCUSDT: []})`),
   konsolda hata yok.

## Kapsam notu — çözülmeyen kalan durum

Bu düzeltme **varsayılan (Reverse kapalı) durumu** kapsıyor — bu en
yaygın senaryo. Kullanıcı "Reverse" kutusunu **elle işaretlerse**:

- **Fib Channel / Fib Speed Fan**: formül zaten simetrik
  (`effPx3=reverse?-px3:px3` tarzı), reverse=true'da da çizim ile
  hit-test birebir örtüşüyor — sorun yok.
- **Fib Extension / Fib Time Zone**: çizim tarafında taban nokta kayması
  var (`effP3Y = reverse ? p3.y+yDiff : p3.y` / `effP1X = reverse ?
  p2.x : p1.x`) ama hit-test tarafında bu taban kayması **yok** —
  reverse=true'da (kullanıcı kutuyu elle işaretlerse) bu iki aracın
  seviye çizgileri yine tıklanamayabilir. Bu, fib-ret'te 5. turda
  bulunup `effP1Y` eklenerek düzeltilen sorunun aynısı, sadece
  fib-ext/fib-timezone'da henüz yapılmadı. Düşük öncelikli (nadir
  kullanılan bir checkbox'a bağlı) ama bilinerek not düşülüyor.

## Diğer önceki "Sıradaki adım" maddelerinin durumu

- **Log-scale / Middle-label desteği diğer araçlarda**: Kontrol edildi,
  hâlâ SADECE `_drawFibRet`'te var; Channel/Extension/Circles/Speed Fan
  bunlardan yoksun (Middle-label zaten Channel/Circles/Speedfan'da
  önceden doğruydu, ama log-scale hiçbirinde yok). Değişiklik
  yapılmadı — kullanıcı istekli değilse kapsam dışı bırakıldı.
- **`drawing:settings:saved`'in her etkileşimde `State.set` tetiklemesi
  (debounce)**: Dokunulmadı, performans gözlemlenen bir sorun değil.
- **`funding:loaded` panel yenileme**: Bu konuyla ilgisiz, ayrı madde.

## Değişen dosyalar

| Dosya | Değişiklik |
|---|---|
| `js/drawing/tools/drawing-fibo.js` | `_drawFibExt`, `_drawFibChannel`, `_drawFibTimezone`, `_drawFibSpeedfan` — `reverse` varsayılanı `!!s.fibReverse` (false) olarak birleştirildi |

`node --check` geçti. Gerçek tarayıcıda iki araç (channel, ext) uçtan uca
doğrulandı, konsolda hata yok.
