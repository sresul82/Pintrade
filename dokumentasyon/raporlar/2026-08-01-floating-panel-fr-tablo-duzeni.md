# Floating Panel — FR Sinyal Tablosu Sütun Düzeni — 2026-08-01

## İstek

> "Float window FR altindaki veriler duzgun oturmamis, sutun absliklari
> merkezde deil ve saat sutunu altindaki veriler disariya tasmis. hemde
> veriler bir birine cok yakin, karisiklik oluyor bakarken"

Floating panel'de (Bot Signals → FR) sütun hizaları tutarsızdı, "Saat"
sütunu panelin dışına taşıyordu ve satırlar sıkışık görünüyordu.

## Kök neden

Üç sorun üst üste binmişti:

1. Başlık hücreleri `text-align:center`, veri hücreleri `text-align:right`
   kullanıyordu — görsel hizasızlığa yol açıyordu.
2. Grid şablonu 420px'lik dar panelde 4 tane sınırsız `1fr` sütun
   kullanıyordu → her sütun ~53px'e düşüyordu, "-1.5483%" veya "00:39:01"
   gibi 8 karakterlik değerler için yetersizdi.
3. `#fp-signals-content`'te `overflow-x:hidden` açıkça set edilmişti —
   içerik konteyner genişliğini aşınca en sağdaki "Saat" sütununu sessizce
   kırpıyordu.

## Yapılan değişiklikler

### `js/screener/floating-panel.js`
- `PANEL_WIDTH`: `420` → `460`.
- `#fp-signals-content` stili: `overflow-x:hidden` → `overflow-x:auto`
  (bir şey yine de taşarsa artık sessizce kaybolmak yerine yatay
  kaydırılabiliyor).

### `js/screener/bot-signals-panel.js`
- FR tablosunun başlık ve veri satırı `grid-template-columns`'u ortak hale
  getirildi: `16px 58px minmax(54px,1fr) minmax(54px,1fr) minmax(60px,1fr)
  minmax(58px,1fr) minmax(50px,1fr)` (öncekinden farklı olarak her sayısal
  sütunun bir taban genişliği var, artık sıkışamıyor).
- Başlık hücrelerinin hizası veri hücreleriyle eşleştirildi: Ticker → sol,
  diğer 5 sütun (Previous/Current/Delta/Remaining/Saat) → sağ.
- `gap` 4px'ten 6px'e çıkarıldı, padding `6-7px 8px` olarak sabitlendi
  (satırlar arası nefes payı).
- Ticker hücresine güvenlik amaçlı `overflow:hidden; text-overflow:ellipsis;
  white-space:nowrap;` eklendi (çok uzun sembol isimleri sığmazsa kesilip
  "..." ile gösterilsin, taşmasın).

Bu şablon hem docked görünümde (`#dp-signals-tab`) hem floating panelde
(`#fp-signals-content`) aynı kod yolundan render edildiği için tek
düzeltme her ikisini de kapsıyor.

## Doğrulama

`node --check` ile her iki dosyada sözdizimi doğrulandı, sonra tarayıcıda
gerçek Floating Panel açılıp ölçüldü.

| Test | Sonuç |
|---|---|
| `node --check bot-signals-panel.js` / `floating-panel.js` | ✅ hata yok |
| Panel genişliği | ✅ 460px (istenen) |
| İçerik konteyneri `overflow-x` | ✅ `auto` |
| Gerçek zamanlı FR sinyali (bu ortamda yok — WS/canlı veri gerekiyor) | Test satırı en kötü senaryo değerleriyle (`1000PEPE`, `-1.5483%`, `07:59:59` gibi 8 karakterlik değerler) elle enjekte edilip ölçüldü |
| En kötü senaryo satırının sağ kenarı vs panel sağ kenarı | ✅ satır: 512px, panel: 513px → **taşma yok** |
| "Saat" sütunu görünürlüğü | ✅ tam görünür, kırpılmıyor |
| Başlık/veri sütun hizası | ✅ ekran görüntüsüyle doğrulandı, Ticker solda diğerleri sağda tutarlı |
| Console hatası | ✅ yok |
| Docked görünümde regresyon | Aynı şablon kullanıldığı için etkilenmedi, ayrıca kod incelemesiyle teyit edildi |

Ekran görüntüsü: Floating panel'de başlık satırı (Ticker/Previous/
Current/Delta/Remaining/Saat) ile enjekte edilen test verisi satırı yan
yana, düzgün hizalı ve panel sınırları içinde görüldü.

## Değişen dosyalar

| Dosya |
|---|
| `js/screener/floating-panel.js` |
| `js/screener/bot-signals-panel.js` |

## Sıradaki adım

Yok — bu iş tamamlandı. Gerçek canlı FR sinyalleri geldiğinde (bu ortamda
üretilemiyor, sadece elle test verisiyle doğrulandı) görsel olarak bir kez
daha göz atmanız faydalı olur, ama kod tarafında taşma/hizasızlık riski
kapatıldı.
