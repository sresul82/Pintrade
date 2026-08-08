# Detay Panel — Fare ile Sürüklenebilir Ayraç — 2026-07-31

## İstek

Önceki turda eklenen otomatik boyutlandırma (Coin Detail = içeriğe sığdır,
Bot Signals = screener'da sabit 20 satır) gerçek kullanımda iki sekmede de
benzer yükseklik veriyordu — kullanıcı bunun yerine `#detail-resize`
tutamacının **gerçekten fare ile sürüklenebilir** olmasını istedi: Bot
Signals için mevcut alan yetersiz kalıyordu, Coin Detail için ise fazlaydı.

## Bulunan durum

`#detail-resize` HTML/CSS'te `cursor: row-resize` ile tanımlıydı ama
**arkasında hiç JavaScript yoktu** — tamamen dekoratifti (bu, önceki bir
kod incelemesinde de tespit edilmişti).

## Yapılan değişiklik

### Tek mekanizma, iki kullanım

`js/screener/detail-panel.js`'e gerçek sürükleme eklendi. Model basitleştirildi:
screener (`#wl-list`) her zaman **sabit bir piksel yüksekliğe** kilitleniyor,
detay paneli kalan alanı dolduruyor (`flex: 1 1 auto`). Bu tek mekanizma hem
otomatik varsayılanlar hem de kullanıcının sürüklemesi için kullanılıyor —
sürüklerken sadece bu piksel değeri değişiyor.

**Otomatik varsayılan** (kullanıcı o sekmeyi hiç sürüklememişse — değişmedi):
- Coin Detail / News → içerik yüksekliği ölçülüp panele verilir, screener kalanı alır.
- Bot Signals → screener tam 20 satır, panel kalanı alır.

**Yeni — sürükleme:**
- `mousedown` (`#detail-resize`) → başlangıç Y ve o anki screener
  yüksekliği kaydedilir, `body`'ye `dp-resizing` sınıfı eklenir (metin
  seçimini engeller, imleç panel dışında da `row-resize` kalır).
- `mousemove` (document üzerinde) → fare hareketine göre canlı önizleme.
- `mouseup` → sonuç **o an aktif olan sekme için ayrı ayrı** `localStorage`'a
  kaydedilir (`pintrade_dp_wl_heights = { detail, news, signals }`) —
  Coin Detail ve Bot Signals'ın farklı boyut istediği senaryoyu karşılıyor.
- **Çift tıklama** → o sekme için kaydı siler, otomatik değere döner
  (kullanıcı istemedi ama düşük maliyetli, faydalı bir kaçış yolu olduğu
  için eklendi).
- Sınırlar: en az 3 satırlık screener yüksekliği, en fazla panelin en az
  60px'lik bir alanı (sekme çubuğu + biraz içerik) koruyacak kadar —
  ikisi de ekran yüksekliğine göre dinamik hesaplanıyor.

### CSS

`.detail-resize:hover/:active` artık mavi vurgu ile "tutulabilir" hissi
veriyor. `body.dp-resizing` sürükleme sırasında metin seçimini ve imleç
değişimini engelliyor.

---

## Doğrulama

Gerçek fare girdisi bu ortamda mevcut olmadığı için (tarayıcı bileşimi
kullanılamıyordu), `#detail-resize` üzerinde gerçek `mousedown`/`mousemove`/
`mouseup` olaylarını sentetik `MouseEvent` ile tetikleyip eklenen dinleyicileri
birebir test ettim.

| Test | Sonuç |
|---|---|
| Bot Signals'ta tutamacı 100px yukarı sürükle | ✅ screener 420→320px, panel 286→386px |
| Sürükleme sırasında `dp-resizing` sınıfı | ✅ mousedown'da eklendi, mouseup'ta kaldırıldı |
| Bırakınca localStorage'a kaydedilme | ✅ `{ signals: 320 }` |
| Sayfa yenilemesinden sonra kalıcılık | ✅ Bot Signals'a geçince 320px geri geldi |
| Coin Detail sekmesi etkilendi mi | ✅ Hayır — hâlâ otomatik/içeriğe-sığdır (441px) |
| Coin Detail'i 80px aşağı sürükle | ✅ screener 265→345px, panel 441→361px, **ayrı** kaydedildi (`detail: 345`) |
| Bu sürükleme Bot Signals'ı etkiledi mi | ✅ Hayır — hâlâ 320/386 |
| Çift tıklama → otomatiğe dönüş | ✅ Coin Detail 441/265'e döndü, sadece `detail` kaydı silindi, `signals` (320) korundu |
| Aşırı yukarı sürükleme (2000px) | ✅ screener 152px'de durdu, panel 554px, negatif/taşma yok |
| Aşırı aşağı sürükleme (2000px) | ✅ panel 60px'de durdu (minimum), screener 646px, negatif/taşma yok |
| Yeni konsol hatası | ✅ yok (mevcut CryptoCompare haber hatası ilgisiz) |

Test kayıtları (`pintrade_dp_wl_heights`) temizlendi — kullanıcı temiz
durumda başlıyor.

---

## Değişen dosyalar

| Dosya | Ne yapıldı |
|---|---|
| `js/screener/detail-panel.js` | `_lockWlHeight`, `_loadManualHeights`, `_saveManualHeight`, `_clearManualHeight`, `_initResizeDrag` eklendi; `_applyDetailLayout` önce manuel kayda bakacak şekilde güncellendi |
| `css/watchlist.css` | `.detail-resize:hover/:active` mavi vurgu, `body.dp-resizing` (seçim engelleme) |

## Sıradaki adım

Yok — bu iş tamamlandı. Not: Bu turda ayrıca `graphify` adlı bir aracın
kurulup çalıştırılması istendi; paketin istatistikleri (YC S26 şirketi
olmasına rağmen 99.7k yıldız) ve README'sindeki isim-karışıklığı uyarısı
güven vermediği için **kurulmadı/çalıştırılmadı** — bu konu ayrı bir karar
gerektiriyor, dokümante ediliyor ama bu raporun kapsamı dışında.
