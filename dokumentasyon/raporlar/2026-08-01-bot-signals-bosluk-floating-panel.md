# Bot Signals — Buton Aralığı + Floating Panel Kontrolleri — 2026-08-01

## İstek

1. Yeni eklenen SE/arama/snipe butonları birbirine çok bitişik duruyor,
   aralarında az miktar boşluk açılsın.
2. "Open in floating window" butonuna tıklanınca açılan Floating Panel'de
   yeni eklenen butonlar (SE/arama/snipe/sırala) yerleştirilmemiş —
   önceki raporda bilinen sınırlama olarak not edilmişti, şimdi eklendi.

## Kök sebep (madde 1)

`#bsp-tabbar-controls`'a hiç `gap` tanımlanmamıştı — sadece dış sarmalayıcı
`.detail-tabs-right`'ın `gap:6px`'i vardı (kontrol grubu ile popout butonu
arasındaki boşluk), grubun İÇİNDEKİ elemanlar arasında (SE↔arama↔snipe↔sırala)
hiç boşluk yoktu.

## Yapılan değişiklikler

### `css/watchlist.css`
Yeni `.bsp-tabbar-controls-target { display:flex; align-items:center; gap:6px; }`
— hem docked hem floating panel kontrol gruplarının paylaştığı ortak sınıf.

### `js/screener/bot-signals-panel.js`
- `_renderTabbarControls()` artık **tek bir ID** yerine
  `.bsp-tabbar-controls-target` sınıflı **tüm** elemanlara yazıyor — docked
  (`#bsp-tabbar-controls`) ve floating (`#fp-tabbar-controls`) aynı anda
  güncelleniyor.
- Yeni `attachTabbarTarget(el)`: bir hedefi delegasyona bağlar + hemen
  içeriğini doldurur. Hem `init()`'te (docked) hem floating panel ilk
  açıldığında (floating) kullanılıyor.
- `return` ifadesine `attachTabbarTarget` eklendi (public API).

### `js/screener/floating-panel.js`
- Başlık çubuğuna (`#fp-titlebar`) `#fp-tabbar-controls` (class
  `bsp-tabbar-controls-target`) eklendi — "BOT SIGNALS" yazısı ile kapatma
  (✕) butonu arasında.
- `show()`: panel **ilk kez** oluşturulduğunda (`isFirstCreate`)
  `BotSignalsPanel.attachTabbarTarget(...)` çağrılıyor — `#fp-tabbar-controls`
  panel hiç açılmadan DOM'da olmadığı için `init()` sırasında bağlanamıyordu,
  bu yüzden ayrı bir tetikleyiciye ihtiyaç vardı.

### `index.html`
`#bsp-tabbar-controls`'a `bsp-tabbar-controls-target` sınıfı eklendi.

---

## Doğrulama

Bybit'te tarayıcıda test edildi.

| Test | Sonuç |
|---|---|
| Docked kontrol grubu `gap` | ✅ 6px — SE/arama/snipe/sırala arası tutarlı 6px |
| Floating panel açılınca `#fp-tabbar-controls` DOM'da mı | ✅ evet |
| Floating panel'de SE/arama/snipe/sırala render ediliyor mu | ✅ dördü de var |
| Floating panel `gap` | ✅ 6px (docked ile aynı) |
| Floating panel'de snipe toggle çalışıyor mu | ✅ `active` sınıfı doğru geçiyor |
| **Snipe floating'de değişince docked'ta da senkron mu** | ✅ evet — aynı `_coinFilter` state, her iki hedef de aynı anda güncelleniyor |
| Floating panel'de arama aç/kapa | ✅ çalışıyor |
| Floating panel kapat butonu | ✅ çalışıyor |
| Görsel (ekran görüntüsü) | ✅ başlık çubuğunda SE+arama+ayar+ok+kapat, docked'takiyle tutarlı |
| Yeni konsol hatası | ✅ yok — bir "Bybit screener error: Failed to fetch" görüldü ama bu oturumda `screener-core.js`'e hiç dokunulmadı; canlı test ile Bybit API'sinin o an 200 OK döndüğü doğrulandı, geçici ağ dalgalanması, bu değişiklikle ilgisiz |

Test sonrası snipe kapalı duruma döndürüldü.

## Değişen dosyalar

| Dosya |
|---|
| `css/watchlist.css` |
| `js/screener/bot-signals-panel.js` |
| `js/screener/floating-panel.js` |
| `index.html` |

## Sıradaki adım

Yok — bu iş tamamlandı. Önceki raporda ("Bot Signals — kontroller sekme
çubuğunda") "bilinen sınırlama" olarak işaretlenen floating panel eksikliği
giderildi.
