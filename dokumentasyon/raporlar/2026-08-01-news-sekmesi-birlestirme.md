# News Sekmesi Birleştirme — Genel Panel Kaldırıldı — 2026-08-01

## İstek

- Sniper ve sıralama ok işaretini News sekmesine de ekle.
- Sağ sidebar'daki "Alarm"ın altındaki News (genel haberler paneli) kaldırılsın.
- Bağlam: alttaki News sekmesi (Coin Detail/Bot Signals/News içinde) coin
  bazlıydı, sidebar'daki üst News genel haberler içindi.

## Kullanıcıyla netleşen davranış

Snipe **açık** → sadece seçili coinin haberleri (mevcut davranış).
Snipe **kapalı** → genel piyasa haberleri (kaldırılan sidebar panelinin
yerini alıyor). Exchange News kategorisi kullanılmıyor. Ok işareti haber
sırasını (yeni↔eski) ters çeviriyor.

## Yol boyunca bulunan, önceden fark edilmemiş bir hata

`news-api.js` coin haberlerini **`symbol:changed`** (geçmiş zaman ekli)
olayını dinleyerek güncelliyordu — ama projenin **hiçbir yerinde** bu isimde
bir olay yayınlanmıyor, her yerde `symbol:change` kullanılıyor. Yani coin
değiştirildiğinde News sekmesi **hiçbir zaman** güncellenmiyordu — sessiz,
uzun süredir var olan bir hata. Bu yeniden yazımda düzeltildi.

## Yapılan değişiklikler

### `index.html`
- Sağ sidebar'dan `#rsb-news` butonu kaldırıldı (Watch/Alarm iki buton kaldı).
- `#global-news-panel` (Global News / Exchange News sekmeli panel) tamamen
  kaldırıldı.
- `.detail-tabs-right`'a `#news-tabbar-controls` eklendi (snipe + sırala
  için, Bot Signals'ın `#bsp-tabbar-controls`'una paralel).

### `js/core/app.js` (`_bindSidebar`)
- `btns` dizisinden `'rsb-news'` çıkarıldı.
- `tab === 'rsb-news'` dalı ve `gnpPanel` referansları kaldırıldı.

### `js/screener/detail-panel.js`
- Sekme tıklama handler'ına: `tabId === 'news'` iken `#news-tabbar-controls`
  gösterilir + `NewsAPI.onTabActivated()` çağrılır (aynı desen Bot Signals
  için zaten vardı).

### `js/data/news-api.js` — yeniden yazıldı
- `_snipe` (varsayılan `true`) + `_sortOrder` state'i eklendi.
- `fetchGeneralNews()` (yeni) — eski `fetchGlobalNews`'un yerini alıyor,
  `dp-news-tab`'a yazıyor (eskiden `gnp-global`'a yazıyordu).
- `fetchCoinNews()` korundu, artık `_lastNewsData` önbelleğe alınıyor
  (sıralama API'ye tekrar gitmeden çalışsın diye).
- `onTabActivated()` — **lazy load**: sayfa açılır açılmaz otomatik haber
  çekmiyor, sadece kullanıcı News sekmesine ilk kez tıkladığında (`_loadedOnce`
  bayrağı). Önceki davranışta `init()` sayfa yüklenir yüklenmez otomatik
  `fetchGlobalNews()` çağırıyordu — gereksiz bir dış istek daha az.
- `symbol:changed` → `symbol:change` düzeltildi (yukarıdaki hata).
- `fetchExchangeNews`, `.gnp-tab` click delegasyonu, `rsb-news`'e özel
  `watchlist:toggle` dinleyicisi kaldırıldı (artık ihtiyaç yok).

---

## Doğrulama

Bybit'te tarayıcıda test edildi. CryptoCompare API'sine bu ortamdan ağ
erişimi yok (önceden de böyleydi) — bu yüzden fonksiyonel testler
`fetchCryptoCompare`'i sahte veriyle değiştirerek izole yapıldı.

| Test | Sonuç |
|---|---|
| `#rsb-news` DOM'da var mı | ✅ yok |
| `#global-news-panel` DOM'da var mı | ✅ yok |
| Sidebar'da kalan butonlar | ✅ sadece `rsb-watchlist`, `rsb-alarms` |
| News sekmesi kontrolleri | ✅ sadece snipe + sırala (SE/arama yok — istenen buydu) |
| Snipe varsayılan durumu | ✅ açık (coin bazlı) |
| **Snipe açık → kategori** | ✅ "BTC" (coin bazlı, sahte veriyle doğrulandı) |
| **Snipe kapalı → kategori** | ✅ "Market,Trading,Blockchain" (genel) |
| **Sıralama tersine çevirme** | ✅ "Haber A"↔"Haber B" sırası değişti |
| Snipe tekrar açılınca coin haberine dönüş | ✅ |
| Bot Signals kontrolleri etkilendi mi (regresyon) | ✅ hayır — SE/arama/snipe/sırala hâlâ doğru |
| Floating panel kontrolleri etkilendi mi | ✅ hayır — aynı 4 kontrol hâlâ doğru render ediliyor |

### Bulunan ve düzeltilen ek hata

İlk implementasyonda `#news-tabbar-controls`'a yanlışlıkla
`bsp-tabbar-controls-target` sınıfı eklenmişti — bu sınıf
`BotSignalsPanel._renderTabbarControls()`'un TARADIĞI bir sorgu
(`document.querySelectorAll('.bsp-tabbar-controls-target')`), yani Bot
Signals kendi SE/arama/snipe/sırala içeriğini News konteynerine de yazıyordu.
Yeni bir CSS sınıfı (`.tabbar-controls-group`) ile görsel stil (gap:6px)
ayrıldı, JS render hedefleme sınıfı (`.bsp-tabbar-controls-target`) sadece
Bot Signals'ın kendi iki hedefine (docked+floating) özel bırakıldı. Test
edilip doğrulandı (yukarıdaki tablo).

### Konsol

Görülen tek hatalar CryptoCompare'e ağ erişimi olmadığı için ("Haberler
alınamadı: TypeError: Failed to fetch") — stack trace'ler kodun doğru
akışta çalıştığını (onTabActivated→_refetch→fetchCoinNews/fetchGeneralNews)
gösteriyor, kodda hata yok.

Test sonrası snipe varsayılan (açık) duruma döndürüldü.

## Değişen dosyalar

| Dosya |
|---|
| `index.html` |
| `css/watchlist.css` |
| `js/core/app.js` |
| `js/screener/detail-panel.js` |
| `js/data/news-api.js` |

## Sıradaki adım

Yok — bu iş tamamlandı. Gerçek ortamda (CryptoCompare'e erişimi olan bir
makinede) haberlerin gerçekten yüklendiğini görsel olarak kontrol etmeniz
faydalı olur — burada sadece sahte veriyle mantık doğrulandı.
