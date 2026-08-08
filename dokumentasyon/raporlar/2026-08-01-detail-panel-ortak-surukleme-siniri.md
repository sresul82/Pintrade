# Detay Panel — Ortak Sürükleme Değeri + İçerik Bazlı Alt Sınır — 2026-08-01

## İstek

Önceki turda eklenen sürükleme özelliğinde iki eksik vardı:

1. Her sekme (Coin Detail / Bot Signals / News) kendi sürüklenmiş yüksekliğini
   ayrı ayrı hatırlıyordu. İstenen: **tek, ortak** bir değer — hangi sekmede
   sürüklenirse sürüklensin, diğer sekmelere geçince aynı hizadan açılsın.
2. Yukarı sürüklemenin bir sınırı vardı (screener 3 satırın altına inemiyordu),
   ama **aşağı sürüklemenin sınırı yoktu** — tutamaç sonuna kadar aşağı
   çekilebiliyor, Coin Detail içeriği kırpılıp kaybolabiliyordu. İstenen:
   aşağı sürükleme, Coin Detail içeriğinin **tam sığdığı noktada** (birkaç
   piksel pay bırakarak) dursun.

## Yapılan değişiklik

### 1. Ortak sürükleme değeri

`localStorage` anahtarı `pintrade_dp_wl_heights` (sekme başına obje) →
`pintrade_dp_wl_height` (**tek sayı**) olarak değiştirildi. Artık hangi
sekmede sürüklerseniz sürükleyin, sonuç tüm sekmelere uygulanıyor. Otomatik
varsayılanlar (Coin Detail = içeriğe sığdır, Bot Signals = 20 satır) sadece
**hiç sürükleme yapılmamışsa** geçerli — ilk sürüklemeden sonra hepsi bu tek
ortak değeri kullanıyor. Çift tıklama bu ortak kaydı siler, tüm sekmeler
kendi otomatik değerlerine döner.

### 2. Aşağı sürükleme sınırı — Coin Detail içeriğine bağlı

Yeni `_measureCoinDetailFitHeight()` fonksiyonu, Coin Detail'in ihtiyaç
duyduğu tam yüksekliği (border + sürükleme çubuğu + sekme başlığı + içerik)
ölçüyor ve `_coinDetailFitHeightCache` değişkeninde saklıyor. Bu ölçüm, Coin
Detail sekmesi her görüntülendiğinde tazeleniyor (`display:none` iken
`scrollHeight` sıfır döndüğü için, sadece görünürken ölçülüp önbelleğe
alınması gerekiyor — diğer sekmelerdeki sürüklemeler bu önbellekteki son
bilinen değeri kullanıyor).

Sürükleme sırasında alt sınır artık bu değer + **4px pay**
(`MIN_DP_BUFFER`, kullanıcının önerdiği 3-5px aralığının ortası) olarak
hesaplanıyor — panel bu noktanın altına asla inemiyor, yani Coin Detail'e
geçildiğinde içerik hiçbir zaman kırpılmıyor.

---

## Doğrulama

Gerçek fare girdisi bu ortamda kullanılamadığı için (tarayıcı bileşimi
mevcut değil), sentetik `MouseEvent` ile `#detail-resize` üzerinde gerçek
`mousedown`/`mousemove`/`mouseup` tetiklenerek test edildi.

### Ortak değer (1000px pencere)

| Adım | wl (screener) | dp (panel) |
|---|---|---|
| Bot Signals'ta 100px yukarı sürükle | 420 → 461 | 486 → 445 |
| Coin Detail'e geç | **461** (aynı) | **445** (aynı) |
| News'e geç | **461** (aynı) | **445** (aynı) |

Üç sekme de artık aynı sınırdan açılıyor — istenen davranış doğrulandı.

### Aşağı sürükleme sınırı (1000px pencere)

| | wl | dp | İçerik kırpıldı mı |
|---|---|---|---|
| Bot Signals auto-default | 420 | 486 | — |
| Aşırı aşağı sürükleme (3000px) sonrası | 461 | **445** | — |
| Coin Detail'e dönüş | 461 | 445 | **Hayır** — 398px içerik, 398px görünür alan |

`dp` tam olarak **445px**'te durdu — bu, ölçülen içerik-sığdırma yüksekliği
(441px) + 4px pay ile birebir örtüşüyor. Coin Detail'e dönüldüğünde içerik
(`scrollHeight: 398`) tamamen görünür kaldı, hiç kırpılmadı.

### Kenar durum — küçük pencere (682px, önceki test penceresi)

Bu boyutta, Bot Signals'ın kendi "tam 20 satır" **otomatik** varsayılanı bile
Coin Detail'in içerik sınırından fazla yer istiyor (ekran o kadar kısa ki
ikisi aynı anda rahat sığmıyor). Sürükleme sınırı bu durumda devreye girip
screener'ın büyümesini 181px'te durdurdu — içerik yine kırpılmadı, ama Bot
Signals'a normalde ayrılan "tam 20 satır" bu ekranda sürükleyerek elde
edilemedi. Bu, güvenlik sınırının doğru çalıştığının kanıtı; **otomatik**
20-satır varsayılanının kendisi bu sınırı hesaba katmıyor (kapsam dışı
bırakıldı — kullanıcı sadece sürükleme sınırını istedi). Gerçek kullanım
büyük ihtimalle daha uzun bir pencerede olacağı için pratik bir sorun
oluşturmuyor; isterseniz otomatik varsayılana da aynı sınırı uygulayabilirim.

### Üstteki sınır (değiştirilmedi, hâlâ çalışıyor)

Aşırı yukarı sürüklemede screener 192px'te durdu — bu, JS'teki 3-satır
hesabından (63px) değil, CSS'teki `#wl-list { min-height: 20% }` kuralından
geliyor (bu kuralın tabanı daha büyük olduğu için o kazanıyor). Davranış
önceki turdan beri aynı, kullanıcı bunu zaten onaylamıştı, dokunulmadı.

### Konsol

Yeni hata yok (mevcut CryptoCompare haber hatası ilgisiz, ortamın dış ağa
erişememesinden kaynaklanıyor).

Test kayıtları (`pintrade_dp_wl_height`) temizlendi.

---

## Değişen dosyalar

| Dosya | Ne yapıldı |
|---|---|
| `js/screener/detail-panel.js` | `LS_MANUAL_HEIGHTS` (obje) → `LS_MANUAL_HEIGHT` (tek değer); `_measureCoinDetailFitHeight` + `_coinDetailFitHeightCache` eklendi; drag'in `maxH`'i artık bu önbelleğe dayanıyor |

## Sıradaki adım

Yok — bu iş tamamlandı. Not: kenar durumda bahsedilen "otomatik 20-satır
varsayılanının da içerik sınırına tabi olması" isterseniz ayrı bir iş
olarak eklenebilir.
