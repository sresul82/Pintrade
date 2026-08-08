# Bot Signals Kontrolleri Sekme Çubuğuna Taşındı — 2026-08-01

## Bağlam

Önceki turda eklenen SE rozeti + arama + snipe + sıralama kontrolleri,
Bot Signals içeriğinin İÇİNDE ayrı bir `.bsp-header-row` satırındaydı.
Kullanıcı ekran görüntüsü üzerinde kırmızı işaretlerle şunu belirtti:

## İstek

1. Arama, snipe ve sıralama ok işaretini **Coin Detail / Bot Signals / News
   sekmelerinin bulunduğu satıra**, en sağdaki "ayrı pencerede aç" (⧉)
   butonunun **soluna** taşı.
2. Rail butonu (FR/M1/MA/V3/4S) zaten seçili olanı gösterdiği için, ayrıca
   "FR"/"Hammer" yazan bir rozete gerek yok.
3. **FR botu seçilince "SE" butonu eklensin** (sadece FR'de).
4. Diğer botlardaki **BB (borsa) rozetini kaldır**.

## Yapılan değişiklikler

### `index.html`
`.detail-tabs` içine yeni bir `.detail-tabs-right` sarmalayıcı eklendi —
`#bsp-tabbar-controls` (boş, JS dolduruyor) + `#detail-popout` birlikte,
her zaman sekme çubuğunun en sağında, aralarında boşluk olmadan bitişik.

### `css/watchlist.css`
`margin-left:auto` artık `#detail-popout`'ta değil, `.detail-tabs-right`'ta
— böylece popout ile yanına eklenen kontroller birlikte sağa yaslanıyor,
Coin Detail/News sekmelerinde kontroller gizliyken de popout doğru konumda
kalıyor.

### `js/screener/bot-signals-panel.js`
- Eski `.bsp-header-row` (SE rozeti + arama + snipe + sıralama + BB rozeti)
  içerik alanından tamamen kaldırıldı.
- Yeni `_buildTabbarControlsHTML()`: 
  - **SE rozeti sadece `_activeBot === 'fr'` iken** render ediliyor (metin
    sabit "SE", aktif bot koduna göre değişmiyor — talep buydu).
  - Arama + snipe + sıralama her bot için görünür (değişmedi).
  - **BB (borsa) rozeti tamamen kaldırıldı** — hiçbir botta artık yok.
- Yeni `_renderTabbarControls()`: bu HTML'i `#bsp-tabbar-controls`'a yazıyor
  — `_allContainers`'tan bağımsız, tek ve paylaşılan bir hedef.
- `init()`'e `#bsp-tabbar-controls` için ayrı event delegasyonu eklendi.
- Artık kullanılmayan `.bsp-header-row` ve `.bsp-stacked-btn*` CSS blokları
  silindi (dead code).

### `js/screener/detail-panel.js`
Sekme tıklama handler'ına: `#bsp-tabbar-controls`'ı sadece `tabId==='signals'`
iken göster (`display:flex`/`none`), o ana geçilirken `BotSignalsPanel.render()`
tetiklenir (ilk açılışta içerik boşsa doldurulsun diye).

---

## Doğrulama

Bybit'te tarayıcıda test edildi.

| Test | Sonuç |
|---|---|
| Coin Detail aktifken kontroller | ✅ gizli (`display:none`) |
| Bot Signals'a geçince kontroller | ✅ görünür, popout'un hemen solunda (DOM'da bitişik kardeş) |
| Eski `.bsp-header-row` DOM'da var mı | ✅ yok |
| Eski konumda (`#dp-signals-tab` içinde) arama butonu var mı | ✅ yok — sadece sekme çubuğunda |
| FR aktifken SE rozeti | ✅ "SE" metni görünüyor |
| M1 Hammer'a geçince SE rozeti | ✅ kayboluyor (null) |
| M1 Hammer'da BB rozeti | ✅ hiç yok (null) |
| FR'ye geri dönünce SE rozeti | ✅ geri geliyor |
| Coin Detail'e dönünce kontroller | ✅ tekrar gizleniyor |
| Snipe aç/kapa (yeni konumda) | ✅ `active` sınıfı doğru geçiyor |
| Arama aç/kapa (yeni konumda) | ✅ input açılıyor/kapanıyor |
| Sıralama butonu (yeni konumda) | ✅ ↑/↓ arası değişiyor |
| Görsel (ekran görüntüsü) | ✅ istenen düzen: sekme çubuğunda sağda arama+snipe+sırala+popout |
| Yeni konsol hatası | ✅ yok |

---

## Bilinen sınırlama — Floating Panel

`FloatingPanel` (Bot Signals'ı ayrı, sürüklenebilir bir pencerede açan
özellik), kendi başlık çubuğuna sahip ve dış "Coin Detail/Bot Signals/News"
sekme satırına erişimi yok. Kontroller artık sadece o satırda yaşadığı için,
**floating panel açıldığında arama/snipe/sıralama/SE görünmüyor** — sadece
dikey bot rafı + sinyal listesi kalıyor.

Bu bir regresyon ama kapsam dışıydı (siz sadece docked/ana görünümü işaret
ettiniz). İsterseniz floating panel'in kendi başlık çubuğuna (şu an sadece
"BOT SIGNALS" yazısı + kapat butonu var) küçük bir versiyonunu ekleyebilirim.

## Değişen dosyalar

| Dosya |
|---|
| `index.html` |
| `css/watchlist.css` |
| `js/screener/bot-signals-panel.js` |
| `js/screener/detail-panel.js` |

## Sıradaki adım

Floating panel'e kontrol eklenmesi (isterseniz). Yoksa bu iş tamamlandı.
