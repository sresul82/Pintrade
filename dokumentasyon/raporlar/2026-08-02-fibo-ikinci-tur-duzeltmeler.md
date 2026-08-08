# Fibo Araçları — İkinci Tur Düzeltmeler (Time Zone, Channel, Speed Fan, Trend Line, Araç Kaldırma) — 2026-08-02

## İstek

Kullanıcı ekran görüntüleriyle 5 madde bildirdi:

1. Fib Time Zone'da trend çizgisi görünmüyor; araç seçilince zaman ekseninde çizgilerin denk geldiği saatler gösterilsin (Vertical Line aracındaki gibi).
2. Fib Channel'da Extend gereksiz; Price açık olsa da gözükmüyor; Labels'ta Left/Center/Right ve Top/Middle/Bottom çalışmıyor.
3. Fib Speed Fan ayar penceresinde seviyeler arası boşluk çok fazla.
4. Genel: "Trend line" renk düğmesinde kesikli seçili olsa da bazı araçlarda düz çizgi çiziliyor — hepsinde kontrol edilmeli. İlk tıklanan nokta hep "1" olmalı.
5. Trend-based fib time, Fib circles, Fib spiral araçlarını tamamen kaldır.

## 5) Üç aracın tamamen kaldırılması

`fib-timebased`, `fib-circles`, `fib-spiral` şu dosyalardan tamamen silindi:

- `js/ui/sidebar.js` — araç listesi (Gann & Fibonacci grubu) ve icon sözlüğünden 3 giriş kaldırıldı.
- `js/drawing/tools/drawing-fibo.js` — `_drawFibTimebased`, `_drawFibSpiral`, `_drawFibCircles` fonksiyonları ve export'ları silindi.
- `js/drawing/core/drawing-core.js` — çizim dispatch'i, iki farklı araç-listesi dizisi (TWO_PT_TOOLS/THREE_PT_TOOLS), hit-test'teki tool listeleri ve 3 ayrı precise-hit-test bloğu (fib-timebased/circles/spiral) kaldırıldı.
- `js/drawing/ui/drawing-settings-dialog.js` — başlık sözlüğü ve `coordsMode` sözlüğünden kaldırıldı.
- `js/drawing/ui/dsd-tabs/dsd-fibo-tabs.js` — `_computeDefaultFibLevels`'teki `fib-timebased` dalı kaldırıldı.

`grep -rn "fib-timebased|fib-circles|fib-spiral"` artık `js/` altında **sıfır sonuç** veriyor — tamamen temiz.

## 1) Fib Time Zone — trend çizgisi + zaman ekseni etiketleri

**Trend çizgisi**: `_drawFibTimezone` hiçbir zaman p1→p2 arası bir taban çizgisi çizmiyordu (sadece dikey seviye çizgileri vardı) — "Trend line" checkbox'ı ayar panelinde vardı ama hiçbir etkisi yoktu. Eklendi: `s.trendLineActive/trendLineColor/trendLineWidth/trendLineStyle` okuyan standart bir taban çizgisi.

**Zaman ekseni etiketleri**: Vertical Line aracının (`drawing-trend.js _drawVLine`) yaptığı gibi, her aktif seviye çizgisinin altına (chart tabanına yakın) gerçek tarih/saat gösteren küçük renkli kutular eklendi — **sadece araç seçiliyken** (çok seviyeli bir araçta sürekli görünse ekranı kirletir). Bunun için:
- `drawing-core.js`'teki çağrı `window.DrawingFibo.drawFibTimezone(ctx, d, pane, selected)` olarak güncellendi (daha önce `selected` hiç geçilmiyordu).
- `_drawFibTimezone` artık 4. parametre olarak `selected` alıyor.
- `_formatTimeLabel()` yardımcı fonksiyonu eklendi (vline'daki tarih formatlama mantığının aynısı — ayrı bir modül olduğu için kod paylaşılamıyor, küçük bir kopya yeterli).

Ayrıca fark edilen bir yan bug da düzeltildi: `levelMode` (Values/Percents) `s.fibLevelsType` (bir boolean, "Levels" checkbox'ı) okuyordu — olması gereken `s.fibLevelsMode` (Values/Percents select'i). Percents modu bu yüzden hiç çalışmıyordu.

**Doğrulama**: Gerçek tarayıcıda `DrawingManager.onMouseDown/onMouseUp` ile bir Fib Time Zone çizildi, üzerine tıklanıp seçildi (gerçek hit-test yoluyla) — ekran görüntüsünde hem beyaz kesikli trend çizgisi hem de alt kısımda "Wed 22 Jul '26", "Fri 31 Jul '26" gibi renkli tarih kutuları göründü.

## 2) Fib Channel — Extend kaldırıldı, Price ve Labels düzeltildi

**Extend kaldırıldı**: `_drawFibChannel` zaten `extendLeft/extendRight`'ı hiç okumuyordu (ölü ayar, tıpkı Fib Time Zone'daki gibi) — kullanıcı fark etti. `dsd-fibo-tabs.js`'te Extend satırı artık Fib Channel için de gizleniyor (`isFibTimezone` kontrolüne `isFibChannel` eklendi). Dead `extendLeft`/`extendRight` değişkenleri de çizim fonksiyonundan temizlendi.

**Price gözükmüyordu**: `_drawFibChannel` `s.fibPrices`'ı hiç okumuyordu — "Prices" işaretliyken bile hiçbir fiyat gösterilmiyordu. `pane.series.coordinateToPrice(...)` ile seviyenin gerçek fiyatı hesaplanıp etikete ekleniyor artık.

**Labels çalışmıyordu — kök neden bulundu**: Kod `s.fibLabelsPos` okuyordu ama ayar diyaloğu ve DİĞER TÜM fib araçları `s.fibLabelsH` kullanıyor — `fibLabelsPos` hiçbir zaman set edilmediği için Left/Right seçimi hep sabit "Left" davranışına düşüyordu, "Center" için ise hiç kod yolu bile yoktu. Ayrıca "Levels" checkbox'ı (`dsd-fib-levels-active` → `s.fibLevelsType`) okunmuyordu, yanlışlıkla hiç var olmayan `s.fibLabels`'a bakılıyordu. Hepsi düzeltildi: artık `s.fibLabelsH` (Left/Center/Right — Center dahil) ve `s.fibLevelsType` kullanılıyor, `s.fibLevelsMode` ile Percents modu da çalışıyor.

**Trend line eklendi**: Fib Channel'da da "Trend line" ayarı vardı ama hiçbir çizgi çizilmiyordu — Fib Time Zone ile aynı sınıf eksiklik. p1→p2 taban çizgisi eklendi.

**Doğrulama**: Gerçek tarayıcıda bir Fib Channel çizildi, `fibPrices:true, fibLabelsH:'Center', fibLabelsV:'Middle'` ayarlandı — ekran görüntüsünde her seviyenin yanında hem değer hem fiyat (`0.618 (64516.52)` gibi) ortalanmış olarak göründü. Level 0 kapatılıp `trendLineColor:'#fff', trendLineWidth:3` verildiğinde ayrı, kalın beyaz bir taban çizgisi göründü (trend line artık gerçekten çiziliyor).

## 3) Fib Speed Fan — ayar penceresi boşluğu

**Kök neden**: Seviye satırları `.dsd-row-inline` class'ını kullanıyordu; bu class `css/drawing-toolbar.css`'te (metin aracı sekmesi için) `margin-bottom:12px` tanımlıyor. Seviye satırları zaten bir CSS grid içinde (`gap: 8px 16px`) olduğu için bu 12px'lik ekstra margin, grid boşluğunun ÜSTÜNE binip satırlar arası boşluğu ~20px'e çıkarıyordu.

**Düzeltme**: `dsd-fibo-tabs.js`'te seviye satırlarına `margin-bottom:0` inline stili eklendi (paylaşılan CSS class'ı değiştirmedik, sadece bu satırlarda override ettik — text aracı sekmesindeki kullanım etkilenmedi).

**Doğrulama**: Gerçek ayar diyaloğu açılıp ekran görüntüsü alındı — satırlar artık belirgin şekilde daha sık, kullanıcının paylaştığı TradingView referansına çok daha yakın.

## 4) Trend line ayarları — property adı uyuşmazlıkları (tüm araçlarda kontrol edildi)

Denetim sonucu: `js-tl-color` (Trend line renk düğmesi) `trendLineActive/trendLineColor/trendLineWidth/trendLineStyle` kaydediyor (bkz. `drawing-settings-dialog.js:~1433`). Bu isimlerle okuyup okumadığı her fib aracında tek tek kontrol edildi:

| Araç | Önce | Sonra |
|---|---|---|
| Fib Retracement | Doğru (`trendLineActive/Color/Width/Style`) | Değişmedi |
| **Fib Extension** | **Yanlış** (`trendColor/trendWidth/trendStyle` — hiç set edilmeyen adlar) + `trendLineActive` hiç kontrol edilmiyordu (çizgi her zaman çiziliyordu) | Düzeltildi — doğru adlar + Active kontrolü |
| **Fib Channel** | **Hiç çizilmiyordu** (trend line kodu yoktu) | Eklendi |
| **Fib Time Zone** | **Hiç çizilmiyordu** | Eklendi |
| Fib Speed Fan | Ayar panelinde "Trend line" seçeneği zaten yok | Etkilenmedi |

Fib Extension'da eskiden `trendStyle` hep `undefined` olduğu için düşen varsayılan `[4,4]` (kesikli benzeri) idi — kullanıcı "dashed" ile "solid" arasında fark göremiyordu çünkü seçim hiç okunmuyordu. Artık gerçek seçim uygulanıyor (doğrulandı: `trendLineStyle:'solid'` verilince gerçekten düz çizgi çiziliyor).

**"İlk nokta hep 1 olmalı" — tekrar denetlendi**: Bu kural sadece **iki noktalı, p1→p2 arası 0–1 fiyat oranı okuyan** araçlarda anlamlı (Fib Retracement) — orada zaten `!!s.fibReverse` (varsayılan kapalı) ile düzeltilmişti. Diğer kalan araçlar bu geometriyi paylaşmıyor:
- **Fib Extension / Fib Channel**: 3 noktalı, seviye değeri p1-p2 farkının p3'e göre ötelenmesiyle hesaplanıyor — "ilk tık = 1" kavramı yok.
- **Fib Time Zone**: seviyeler fiyat oranı değil Fibonacci bar sayısı (0,1,2,3,5,8,...) — "ilk tık = 0" (sayımın başlangıcı) burada zaten doğru/beklenen davranış, tersine çevirmek aracı anlamsızlaştırır.
- **Fib Speed Fan**: p1 her zaman "fan"ın merkezi/kaynağı — seviye kavramı p1-p2 ekseni değil.

Yani kural zaten sadece uygulanabildiği tek yerde (fib-ret) uygulanmıştı; diğerlerine zorla uygulanmadı çünkü geometrik olarak karşılığı yok.

## Değişen dosyalar

| Dosya |
|---|
| `js/drawing/tools/drawing-fibo.js` |
| `js/drawing/core/drawing-core.js` |
| `js/drawing/ui/dsd-tabs/dsd-fibo-tabs.js` |
| `js/drawing/ui/drawing-settings-dialog.js` |
| `js/ui/sidebar.js` |

`node --check` tüm dosyalarda geçti. Gerçek tarayıcıda Fib Channel, Fib Time Zone, Fib Extension ve Fib Speed Fan uçtan uca test edildi (gerçek `DrawingManager` fonksiyonları + gerçek ayar diyaloğu), konsolda hata yok, test çizimleri temizlendi.
