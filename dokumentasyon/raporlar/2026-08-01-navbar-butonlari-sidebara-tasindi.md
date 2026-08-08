# Navbar Butonları (Snapshot/Theme/Settings) Sağ Sidebar'a Taşındı — 2026-08-01

## İstek

Bu, kullanıcının 3 aşamalı bir arayüz değişikliği isteğinin **1. adımı**:

> "Navbardaki bu 3 butonu sag sideBar uzerinde, en alta sistem saati yerine
> yerlestirelim, sistem saatini ise en altta zaman cizelgesinin altina,
> zaman cizelgesi yuksekligi kadar bir yatay bant olusturalim ve oraya
> yerlestirelim... olusturdugmuz yatay bottom barin solunda ornekteki gibi
> liste yerlestircez."

Adım adım ilerlenmesi netleştirildi: önce buton taşıma, sonra (ayrı bir
işte) grafik altına yeni yatay bant + saat + liste. Bu rapor sadece 1.
adımı kapsıyor.

## Netleşen kapsam

- Yeni alt bandın solundaki liste (örnekte "No Preview/Top Gainers/
  Delistings/New Listings") **şimdilik sadece görsel yer tutucu** olacak,
  gerçek filtreleme işlevi sonraki bir işte eklenecek.
- Bu iş **sadece** 3 butonun taşınmasını kapsıyor; yeni alt bant + saat
  taşıma + liste ayrı bir işte yapılacak.

## Yapılan değişiklikler

### `index.html`
- Navbar'daki "Settings & Tools" grubu (`#btn-snapshot`, `#btn-theme`,
  `#btn-settings` — kamera/tema/ayarlar ikonları) `#nb-responsive-menu`
  içinden tamamen kaldırıldı.
- Sağ sidebar'a (`.right-sidebar`) yeni bir grup eklendi: `#rsb-tools-group`,
  saat butonunun (`#rsb-clock-btn`) hemen altında, sidebar'ın en altında.
  Aynı 3 buton (`#btn-snapshot`, `#btn-theme`, `#btn-settings`) — id'leri
  korunduğu için `app.js`'teki mevcut event listener'lar değişiklik
  gerektirmeden çalışmaya devam ediyor.
- Yeni `.rsb-icon-btn` CSS sınıfı eklendi (32×32px, sade ikon buton).
  `.rsb-btn` sınıfı kullanılmadı çünkü o sınıf ikon+etiket çiftleri için
  `min-height:80px` zorluyor (`css/chart.css`) — 3 yeni buton etiketsiz
  olduğu için bu, gereksiz yere 3 kat yer kaplardı.
- Saat (`#rsb-clock-btn`) **geçici olarak** aynı yerde (sidebar altında,
  yeni buton grubunun hemen üstünde) bırakıldı — kalıcı yeri olan "grafik
  altı yatay bant" henüz yok, 2. adımda oraya taşınacak.

## Doğrulama

Tarayıcıda gerçek DOM üzerinde test edildi (masaüstü görünüm, ~961×918).

| Test | Sonuç |
|---|---|
| Navbar'da `#btn-snapshot`/`#btn-theme`/`#btn-settings` var mı | ✅ yok (sadece sidebar'da, tekil `id`) |
| Sidebar'daki 3 buton görünür ve viewport içinde mi | ✅ en alt buton (`#btn-settings`) 909px, viewport 918px — taşma yok |
| Tema değiştirme (`#btn-theme` tıklama) | ✅ dark→light→dark doğrulandı |
| Ayarlar penceresi (`#btn-settings` tıklama) | ✅ "Settings" modalı açıldı, ekran görüntüsüyle doğrulandı |
| Saat/timezone menüsü (`#rsb-clock-btn`) hâlâ çalışıyor mu (regresyon) | ✅ açılıp kapanıyor |
| Dar ekran (1200px, responsive dropdown modu) | ✅ `#nb-responsive-menu` tek grupla (Indicators/Alert/Undo/Redo) düzgün açılıyor, boş ikinci grup kalmamış |
| Console hatası | ✅ yok |

## Değişen dosyalar

| Dosya |
|---|
| `index.html` |

## Sıradaki adım

2. adım: Grafiğin zaman çizelgesinin (time axis) altına, onun yüksekliği
kadar yeni bir yatay bant eklemek; saati (`#rsb-clock-btn`) sidebar'dan bu
banda taşımak; bandın soluna görsel yer tutucu bir liste (No Preview/Top
Gainers/Delistings/New Listings örneği) yerleştirmek. Kullanıcı onayı
bekleniyor — henüz başlanmadı.
