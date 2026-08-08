# Screener — Türkçe Terimlerin İngilizceye Çevrilmesi — 2026-08-01

## İstek

Screener üzerindeki (arama kutusu, liste seçici, sütun seçici, boş
liste/yükleniyor/hata mesajları) tüm görünür Türkçe metinlerin İngilizceye
çevrilmesi.

## Kapsam

Sadece **kullanıcıya görünen** metinler çevrildi — kod yorumları ve
`console.log`/`console.warn` gibi geliştirici mesajları kapsam dışı bırakıldı
(bunlar ekranda görünmüyor, "Screener üzerindeki terimler" tanımına girmiyor).
Coin Detail paneli ve Bot Signals paneli bu işin kapsamında değil (ayrı
maddeler olarak ele alınıyor).

## Çevrilen metinler

| Dosya | Önce | Sonra |
|---|---|---|
| `index.html` | Ara... | Search... |
| | Temizle | Clear |
| | Liste Seç | Select List |
| | Sütunlar | Columns |
| | Borsa Değiştir | Change Exchange |
| | Tüm Coinler | All Coins |
| `js/screener/screener-core.js` | Ani Yükseliş / Hareketli | Rapid Rise / Active |
| | Eşleşen coin yok | No matching coins |
| | Sinyal listesi henüz boş... Kom1/Kom2/Kom3... | Signal list is empty... Combo 1/2/3... |
| | Bu liste boş... sağ tıklayın | This list is empty... right-click to add |
| | Yükleniyor... | Loading... |
| | Veri alınamadı | Failed to load data |
| `js/screener/watchlist-store.js` | Tüm Coinler / Sinyaller | All Coins / Signals |
| | Kom1 / Kom2 / Kom3 | Combo 1 / Combo 2 / Combo 3 |
| `js/screener/watchlist-menu.js` | Yeniden adlandır / Sil | Rename / Delete |
| | Henüz liste yok | No lists yet |
| | Liste adı... | List name... |
| | Yeni liste oluştur... | Create new list... |
| | LİSTELERİM / SİSTEM / SÜTUNLAR | MY LISTS / SYSTEM / COLUMNS |
| | Spot desteği henüz eklenmedi / yakında | Spot support not yet added / soon |
| | Symbol sütunu kapatılamaz | Symbol column cannot be hidden |
| | "X" listesi silinsin mi? | Delete list "X"? |
| | Önce bir liste oluşturun | Create a list first |

**Not — "Kom1/Kom2/Kom3" → "Combo 1/2/3":** Bu isimler henüz boş iskelet
(sinyal doldurma mantığı sonraki turda gelecek). "Kom" muhtemelen
"Kombinasyon" kısaltmasıydı (strateji dokümantasyonunda geçen "2 farklı
sinyal kombinasyonu" ifadesiyle uyumlu), bu yüzden "Combo" seçildi. İsterseniz
kolayca değiştirilebilir — henüz hiçbir yerde sabit kod bağımlılığı yok.

## Doğrulama

Bybit'te tarayıcıda test edildi:

| Test | Sonuç |
|---|---|
| Arama kutusu placeholder | ✅ "Search..." |
| Liste etiketi | ✅ "All Coins" |
| Tüm tooltip'ler (temizle/liste/sütun/borsa) | ✅ İngilizce |
| Liste menüsü bölüm başlıkları | ✅ "MY LISTS", "SYSTEM" |
| "Yeni liste oluştur" + input placeholder | ✅ "+ Create new list...", "List name..." |
| SPOT satırı | ✅ "SPOT soon" |
| Sütun menüsü | ✅ "COLUMNS", kilitli sütun tooltip'i İngilizce |
| Signals boş mesajı | ✅ "Signal list is empty. Combo 1 / Combo 2 / Combo 3 population logic will be added in a later step." |
| Kullanıcı listesi boş mesajı | ✅ "This list is empty. Right-click a coin in the list to add it." |
| Yeni konsol hatası | ✅ yok (mevcut CryptoCompare haber hatası ilgisiz) |

Test için oluşturulan geçici liste silindi, aktif liste "All Coins"a
döndürüldü.

## Değişen dosyalar

| Dosya |
|---|
| `index.html` |
| `js/screener/screener-core.js` |
| `js/screener/watchlist-store.js` |
| `js/screener/watchlist-menu.js` |

## Sıradaki adım

Aynı görevin 2., 3. ve 4. maddeleri (sütun menüsüne Change Type/Volume Type
ekleme, Bot Signals'taki filtre butonlarının search+snipe ikonlarıyla
değişimi, bot sekmelerinin dikey rayına taşınması) — kapsam netleşmeden
önce kullanıcıya sorular soruldu, ayrı bir raporda ele alınacak.
