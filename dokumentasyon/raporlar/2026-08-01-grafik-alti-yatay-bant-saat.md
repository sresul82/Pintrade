# Grafik Altı Yatay Bant + Saat Taşıma — 2026-08-01

## İstek

3 aşamalı arayüz değişikliğinin **2. adımı**. Kullanıcı önceki adımdan
sonra netleştirdi:

> "biraz dikkatli ol, yatay bant olusmadi, saat hala sag sidebarda. yatay
> bantimiz tam chartin uzunlugu kadar olcak, saat ise bu yatay bantin sag
> tarafina hizalancak"

Yani: grafiğin zaman çizelgesinin (time axis) altına, **chart alanının tam
genişliği kadar** (sağ panel/sidebar dahil değil) yeni bir yatay bant;
saat bu bandın **sağına** hizalı; sol tarafında (bir sonraki işte
işlevlendirilecek) bir liste yer tutucusu.

## Yapılan değişiklikler

### `index.html`

- **Yeni bant**: `.main-area` içine, `#chart-root`'un hemen altına
  `#chart-bottom-bar` eklendi. Genişliği otomatik olarak `.main-area`'nın
  genişliğine eşit (main-area = sol araç çubuğu ile sağ panel arasındaki
  chart alanı, sidebar/right-panel'i kapsamıyor).
- **Yükseklik**: 22px — rastgele değil, `js/chart/chart-pane.js`'teki
  `const timeScaleH = 22; // LW Charts time scale is always ~22px` sabitiyle
  birebir eşleşiyor (kullanıcının "zaman çizelgesi yüksekliği kadar" isteği).
- `#chart-root`'a `flex:1; min-height:0` eklendi ki yeni bant için yer açsın
  ve grafiğin kendi `ResizeObserver`'ı (chart-pane.js) otomatik olarak yeni
  boyuta göre yeniden çizsin.
- **Saat** (`#rsb-clock-btn`) sağ sidebar'dan çıkarılıp bandın sağına
  taşındı (`.cbb-spacer` ile sola itiliyor). Yatay tek satır görünüm için
  `.chart-bottom-bar .rsb-clock-btn` override'ı eklendi (dikey ikon-raf
  düzeni yerine yatay `HH:MM:SS UTC±N` görünümü — bkz. örnek görsel).
- **Liste yer tutucusu** solda: `.cbb-list-placeholder` ("No Preview ▾") —
  önceki turda netleşen kapsam gereği **tamamen görsel**, tıklanabilir
  değil, işlevi yok.
- **Timezone dropdown** (`#rsb-tz-menu`) saatle birlikte taşındı;
  `position:fixed; right:44px` (eski sidebar konumuna göre sabit) yerine
  `.main-area`'ya göre `position:absolute; right:0; bottom:22px` yapıldı —
  artık saatin yeni konumunun tam üstünde açılıyor.
- Eski, sağ sidebar'daki tekil `#rsb-clock-btn` ve `#rsb-tz-menu` blokları
  kaldırıldı (id çakışması olmasın diye — aynı id iki yerde olamazdı).

### CSS (aynı dosyada, `<style>` bloğu)
- `.chart-bottom-bar`, `.cbb-list-placeholder`, `.cbb-arrow`, `.cbb-spacer`
  yeni sınıflar eklendi.
- `.rsb-tz-menu`'nün konumlandırması `fixed`'ten `absolute`'a çevrildi.

## Doğrulama

Tarayıcıda gerçek DOM üzerinde ölçüldü (1400×760 görünümde, banda net
görünürlük için).

| Test | Sonuç |
|---|---|
| Bant genişliği = main-area (chart alanı) genişliği | ✅ ikisi de 385px, birebir eşit |
| Bant yüksekliği | ✅ 22px (timeScaleH sabitiyle eşleşiyor) |
| Chart alt kenarı ile bant üst kenarı arasında boşluk/çakışma | ✅ yok (0px — tam bitişik) |
| Saat bandın sağında mı | ✅ (`right:429` / bant `right:437`, 8px padding ile kenara yaslı) |
| Sağ sidebar'da saat kaldı mı (regresyon) | ✅ hayır, tamamen taşındı |
| Saat her saniye güncelleniyor mu | ✅ |
| Saat tıklanınca tz menüsü açılıyor mu, doğru konumda mı | ✅ açılıyor, menünün alt kenarı = bandın üst kenarı, sağ kenarları hizalı |
| Timezone seçimi (Istanbul) çalışıyor mu | ✅ "UTC+3" olarak güncellendi, menü kapandı |
| Liste yer tutucusu ("No Preview ▾") görünüyor mu | ✅ solda, tıklanamaz (istenen davranış) |
| Console hatası | ✅ yok |

Test sonrası saat dilimi varsayılan (UTC) durumuna döndürüldü.

## Değişen dosyalar

| Dosya |
|---|
| `index.html` |

## Sıradaki adım

Liste yer tutucusuna ("No Preview ▾") gerçek işlev eklemek — kullanıcı
şimdilik istemedi, ileride ayrı bir işte ele alınacak. Bu işin kapsamı
tamamlandı.
