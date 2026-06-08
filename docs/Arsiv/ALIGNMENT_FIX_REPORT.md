# PinTrade V2.4 — Hizalama Düzeltmeleri Raporu

Bu raporda, `hline` ve `hray` çizim araçlarında metin hizalama ayarlarının (`textAlignH` / `textAlignV`) görsel render, "Add Text" ipucu alanı ve çift tıklama ile açılan inline metin editörüne yansıtılmasına yönelik yapılan değişiklikler özetlenmiştir.

## Sorunun Tanımı

Daha önce `hline` ve `hray` araçlarında şu üç unsur birbiriyle uyumsuz çalışmaktaydı:
1. **Metin render** → Settings panelinden seçilen `textAlignH` ve `textAlignV` değerlerine göre çiziliyordu.
2. **"Add Text" hint** → Seçili ancak metinsiz çizimlerde, her zaman sabit bir konuma (`w/2` veya `startX + 6`) çiziliyor ve `textAlignH`/`textAlignV` ayarlarını göz ardı ediyordu.
3. **Inline Metin Editörü** → Çift tıklama veya ipucuna tıklandığında açılan textarea editör kutusu her zaman canvas'ın ortasına (`cvsW / 2`) göre konumlanıyor ve hizalama ayarlarını yansıtmıyordu.

---

## Yapılan Değişiklikler

### 1. [drawing-trend.js](file:///i:/_Egitim%20ve%20Gelistirme/Kodlama/_V2.4/Sidebarlar/js/drawing/tools/drawing-trend.js) — `_drawHLine` Güncellemesi
`_drawHLine` fonksiyonu içerisinde metin ve ipucu (hint) alanının render koordinatları `textAlignH` ve `textAlignV` ayarlarına bağlandı:
* `textX` yatay koordinatı; `left` için `6px`, `right` için `endX - 6px`, `center` için ise çizgi ortasına gelecek şekilde dinamikleştirildi.
* İpucu metninin (Add Text) basıldığı alan ve tıklama algılaması için kaydedilen `window._trendTextHintAreas[d.id]` alanı bu koordinatlarla senkronize edildi.

### 2. [drawing-trend.js](file:///i:/_Egitim%20ve%20Gelistirme/Kodlama/_V2.4/Sidebarlar/js/drawing/tools/drawing-trend.js) — `_drawHRay` Güncellemesi
`_drawHRay` fonksiyonunda:
* İpucu konumu `textAlignH` ve `textAlignV` parametrelerine göre hesaplanarak `hintX` ve `hintY` değişkenlerine bağlandı.
* Seçili durumdaki metinsiz ipucu ("Add Text") ve metinli ipucu alanları bu yeni dinamik koordinatlara göre render edilip global ipucu haritasına kaydedildi.

### 3. [drawing-core.js](file:///i:/_Egitim%20ve%20Gelistirme/Kodlama/_V2.4/Sidebarlar/js/drawing/core/drawing-core.js) — `_openTrendlineTextEditor` Güncellemesi
`_openTrendlineTextEditor` fonksiyonu içinde `hline` veya `hray` araçları için inline editör açıldığında:
* Editörün yatay konumu (`anchorX`), `hray` için `startX`, `hline` için `0` baz alınarak ve price label genişliği (`labelW`) hesaba katılarak dinamik olarak belirlendi.
* Dikey konum (`anchorY`) ve CSS `transformY` özelliği `textAlignV` ayarına göre (`top`, `middle`, `bottom`) ayarlandı.

---

## Doğrulama ve Test Sonuçları

* **Çalışma Durumu**: Kod derleme ve sunucu çalıştırma testi başarıyla tamamlandı. `npm run dev` komutu ile sunucu lokal modda 5500 portunda sorunsuz ayağa kalkmaktadır.
* **Hizalama Tutarlılığı**: Yapılan değişiklikler neticesinde metnin çizildiği konum, "Add Text" ipucunun göründüğü yer ve editörün açıldığı konum tamamen aynı koordinatlara senkronize edilmiştir.
