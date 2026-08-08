# Detay Panel Esnek Yükseklik + Küçük Watchlist Menü Düzeltmeleri — 2026-07-31

## 1. Watchlist menüsü — iki küçük düzeltme

| İstek | Durum |
|---|---|
| "Tüm Coinler" menüsünün altındaki USDT etiketi kaldırılsın | ✅ `.wl-lm-chips` bloğu silindi |
| FUTURES yazısı beyaz olsun ama tıklanabilir olmasın | ✅ `.wl-lm-market-row.plain` — `cursor: default`, `color: var(--text-primary)`, tıklama olay dinleyicisi kaldırıldı |

FUTURES artık salt bilgilendirici bir etiket — SPOT'un aksine (griye alınmış,
tıklanınca "yakında" bildirimi çıkıyor), tek aktif pazar olduğu için
tıklanacak bir şeyi yok, düz beyaz metin olarak duruyor. Test edildi: rengi
`rgb(209,212,220)` (= `--text-primary`), `cursor: default`, tıklama
`WatchlistStore`'daki pazar tipini değiştirmiyor.

Ayrıca dokunulmayan `WatchlistStore.setMarketType()` fonksiyonu API'de
kalıyor — Spot desteği eklendiğinde kullanılacak.

**Not — dil kuralı:** Bu turdan itibaren yeni yazılan arayüz metni ve kod
İngilizce olacak (kullanıcı talimatı). Var olan Türkçe menü metinleri
("Tüm Coinler", "Sinyaller" vb.) geriye dönük çevrilmedi — talimat "bundan
sonra" için, mevcut ekranları kapsamıyordu. Hafızaya kaydedildi.

---

## 2. Coin Detay Paneli — içeriğe göre esnek yükseklik

### İstek

Coin Detay penceresi açıkken sadece ihtiyacı kadar yer kaplasın (screener'dan
alsın), hem sabit hem ekran çözünürlüğüne göre esnek olsun. Bot Signals
sekmesine geçilince tam tersi: screener'da **20 satır** görünecek şekilde
panel yukarı çekilsin, çünkü Bot sekmelerinde bilgi çok, yüksek alan faydalı.

### Bulunan mevcut durum

`#detail-resize` (sürükleme tutamacı) HTML/CSS'te vardı ama **arkasında hiç
JS yoktu** — dekoratif bir `cursor: row-resize` dışında işlevsizdi. Panel
yüksekliği tamamen `js/core/app.js`'teki sabit `dpPanel.style.height = '40%'`
ile belirleniyordu — içerikle hiç ilgisi yoktu.

### Karşılaşılan ve çözülen iki CSS hatası

**a) `.detail-body { flex: 1 }` → `flex-basis: 0%`, `auto` değil.**
`.detail-panel`'e JS'ten inline yükseklik verilmeyip CSS'in kendi haline
bırakılması denendiğinde panel **0 yüksekliğe çöktü** (ölçüldü:
`dpDetailTab_height: 0` ama `scrollHeight: 398` — içerik var, kutu çökmüş).
Sebep: `.detail-body`'nin `flex:1` kısayolu `flex-basis:0%` anlamına geliyor;
üst öğenin (`.detail-panel`) yüksekliği "auto" bırakılınca büyüyecek boş alan
olmuyor, `min-height:0` da tabanı sıfıra izin veriyor.

→ Çözüm: Saf CSS ile "içeriğe sığdırma" yerine, **JS ile gerçek içerik
yüksekliğini ölçüp** panele `px` cinsinden açık yükseklik veriliyor. Panel
artık "tanımlı yükseklik"e sahip olduğu için içindeki `flex:1`'ler doğru
çalışıyor.

**b) `#wl-list { flex: 1 1 auto }` → 676 satırın TAM yüksekliği taban alınıyor.**
İlk düzeltmeden sonra panel bu sefer **20px'e** çöktü (441px inline height
verilmesine rağmen). Sebep: `#wl-list`'in flex-basis'i `auto`, ve tüm 676
coin satırı gerçek DOM elemanı olarak render edildiği için (`overflow-y:auto`
sadece görsel kırpma yapıyor, boyut hesabını etkilemiyor) tarayıcı bu öğenin
"içerik boyutunu" ~14.000px hesaplıyor. Bu devasa taban, flex-shrink
dağıtımında panel'i neredeyse sıfıra eziyor.

→ Çözüm: `#wl-list`'e de `.detail-body`'de zaten kullanılan güvenli deseni
uyguladım: `flex: 1 1 0%` (taban 0, `flex-grow` doğru şekilde kalan alanı
dolduruyor).

### Yeni davranış

`js/screener/detail-panel.js`'e `_applyDetailLayout(tabId)` eklendi:

- **Coin Detail / News sekmesi:** `#dp-detail-tab` veya `#dp-news-tab`'ın
  gerçek `scrollHeight`'i + sekme çubuğu + sürükleme tutamacı yüksekliği
  ölçülüp `.detail-panel`'e `px` olarak veriliyor. Screener (`#wl-list`)
  kalan tüm alanı dolduruyor.
- **Bot Signals sekmesi:** `#wl-list` tam olarak **20 satır** yüksekliğe
  sabitleniyor (`flex-shrink: 0` — küçük ekranda bile asla daha az satır
  göstermez), `.detail-panel` kalan yüksekliğin tamamını alıyor
  (`flex: 1 1 auto`).
- Sekme değişiminde (`detail-tab` tıklamaları) otomatik uygulanıyor.
  Sayfa yüklenince varsayılan olarak `detail` modu uygulanıyor.
- `js/core/app.js`'teki eski sabit `dpPanel.style.height = '40%'` satırı
  kaldırıldı; sağ raydaki "Watch" ikonuna tıklanınca artık
  `DetailPanel.applyLayout('detail')` çağrılıyor (aynı ölçüm mantığı).

### Doğrulama (Bybit, ölçümlerle)

| Ekran yüksekliği | Sekme | Panel yüksekliği | Screener yüksekliği | Screener satır sayısı |
|---|---|---|---|---|
| 682px (test penceresi) | Coin Detail | **484px** (içerik: 398px) | 142px | ~7 |
| 682px | Bot Signals | 206px | **420px** | **20** (tam) |
| 682px | News | 82px (kısa placeholder) | 544px | ~26 |
| 800px (1200 pencere) | Coin Detail | **441px** (sabit — içerik değişmedi) | 665px | 32 |
| 800px (1200 pencere) | Bot Signals | 686px | **420px** (sabit — yine tam 20) | **20** |

**Yorum:** Coin Detail ve Bot Signals'ta screener satır sayısı **ekran
yüksekliğine göre değişiyor** (7→32 satır, 682px→1200px arası), ama Bot
Signals'ta screener **her zaman tam 20 satırda sabit kalıyor** — tam istenen
"hem sabit hem ekrana göre esnek" davranışı iki modda ayrı ayrı sağlanıyor.

**Küçük ekran güvenliği:** 500px yükseklikte test edildi — negatif değer
yok, taşma yok, screener `min-height:20%` tabanına düzgünce küçülüyor
(462px container'da 92px = tam %20).

**Görsel doğrulama:** Coin Detail sekmesinde fundamental info dahil tüm
içerik kırpılmadan görünüyor; Bot Signals sekmesinde tam 20 satır screener +
büyük bot paneli (FR/M1 Hammer/M1-A/V3/4S sekmeleri) ekran görüntüsüyle
teyit edildi.

**Konsol:** Yeni hata yok (mevcut CryptoCompare haber hatası ilgisiz, ortamın
dış ağa erişememesinden kaynaklanıyor, önceden de vardı).

---

## Değişen dosyalar

| Dosya | Ne yapıldı |
|---|---|
| `js/screener/watchlist-menu.js` | USDT etiketi kaldırıldı, FUTURES tıklanamaz/beyaz yapıldı, `market` değişkeni ve ölü `data-act="futures"` handler'ı temizlendi |
| `css/watchlist.css` | `.wl-lm-chip*` kuralları silindi, `.wl-lm-market-row.plain` eklendi, **`#wl-list` flex-basis `auto`→`0%`** (kök sebep düzeltmesi) |
| `js/screener/detail-panel.js` | `_applyDetailLayout()` + `_measureRowHeight()` eklendi, sekme tıklamasına ve init'e bağlandı, `applyLayout` public API'ye eklendi |
| `js/core/app.js` | Sabit `40%` yükseklik kaldırıldı, yerine `DetailPanel.applyLayout('detail')` çağrısı |

## Sıradaki adım

Yok — bu iş tamamlandı. Kuyrukta bekleyen 5 görev (bot tarayıcı WS, 45m/3H,
çizim araçları temizliği, indikatör modülü, chart WS) duruyor.
