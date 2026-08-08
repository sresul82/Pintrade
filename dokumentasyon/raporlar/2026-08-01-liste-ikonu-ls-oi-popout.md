# Liste İkonu (Link) + L/S ve OI Kartlarına Popout İkonu — 2026-08-01

## İstek

> "1. resimdeki ikonu cizemiyormusun SVG olarak yatay bantin soluna
> yerlestirdigin chark ikonunun yerine ... 1. Long/Short oranini gosteren
> bar uzunlugnu kucuk ikon sigacak kadar sola kucultcez, ve containerin sag
> ust kosesine, L/S gostergesinin hizasina 4. resimdeki ikonu yerlestircez.
> 2. Volume/ OI gostergeleri var ... OI containerinin icine 4. resimdeki
> ikonu yerlestircez, ve tiklayinca floating window acilacak, ic
> duzenlemesini sonra yapariz"

Kullanıcıya sorulan netleştirme sorusuna göre L/S ikonu da OI ile aynı
mantıkla çalışacak: tıklayınca boş bir floating window açılacak, iç
düzenlemesi sonraki bir işte yapılacak.

## Yapılan değişiklikler

### 1) Grafik altı banttaki "çark" ikonu → link ikonu
`#cbb-list-trigger` içindeki ayarlar/gear SVG'si kaldırılıp yerine bir
zincir/link ikonu (iki iç içe geçmiş halka) SVG'si kondu — kullanıcının
verdiği görseldeki ikonla eşleşiyor. Dropdown açma/kapama işlevi
(`_bindChartBottomBar`) değişmedi, sadece ikon değişti.

### 2) L/S kartı
- `js/screener/detail-panel.js` render'ında **değişmedi** — sadece
  `index.html`'deki statik şablonda:
  - L/S satırının bar'ı (`#dp-ls-bar`) `width:100%` yerine
    `width:calc(100% - 20px)` yapıldı — sadece L/S satırı küçüldü, Tahta
    satırının bar'ı aynı kaldı (kullanıcı sadece L/S'i istemişti).
  - Kartın (`.dp-oi-card`) üst sağ köşesine `#dp-ls-popout` butonu
    eklendi (`position:absolute; top:6px; right:6px` — `.dp-card-popout`
    sınıfı, `css/watchlist.css`), L/S satırıyla aynı hizada (kart'ın ilk
    satırı zaten L/S).

### 3) OI Değişimi kartı
- "OI Değişimi (8 periyot)" başlık satırı zaten `justify-content:
  space-between` bir flex satırıydı — `#dp-oi-popout` butonu oraya,
  başlığın sağına eklendi (`position:static` ile absolute override
  edildi, çünkü zaten doğru flex satırında).

### 4) Yeni bileşen: `js/screener/mini-floating-window.js`
Genel amaçlı, sürüklenebilir, kapatılabilir küçük pencere —
`FloatingPanel`'in (Bot Signals'a özel) aksine herhangi bir id/başlıkla
çağrılabiliyor: `MiniFloatingWindow.toggle('ls', 'LONG / SHORT')` /
`MiniFloatingWindow.toggle('oi', 'OI DEĞİŞİMİ')`. İçerik şimdilik
"İçerik yakında eklenecek..." yer tutucusu — kullanıcının "iç
düzenlemesini sonra yaparız" notuna göre kasıtlı olarak boş bırakıldı.
`index.html`'e `<script src="js/screener/mini-floating-window.js">`
eklendi.

### 5) Tıklama bağlamaları
`js/screener/detail-panel.js`'te, mevcut `#detail-popout` bağlamasının
hemen altına `#dp-ls-popout` ve `#dp-oi-popout` için click listener'ları
eklendi.

## Doğrulama

Tarayıcıda gerçek DOM üzerinde test edildi.

| Test | Sonuç |
|---|---|
| Bant ikonu artık link/zincir SVG'si mi | ✅ eski gear path'i kaldırıldı, yeni link path'i DOM'da |
| L/S bar genişliği küçüldü mü | ✅ 172px (öncesinde tam genişlik, ~192px'ti) |
| Tahta bar'ı etkilendi mi (regresyon) | ✅ hayır, hâlâ `width:100%` |
| `#dp-ls-popout` L/S satırıyla aynı hizada mı | ✅ kartın üst sağ köşesinde, ilk satır (L/S) hizasında |
| `#dp-oi-popout` OI Değişimi başlığının yanında mı | ✅ başlık satırının sağında |
| L/S ikonuna tıklayınca floating window açılıyor mu | ✅ "LONG / SHORT" başlıklı pencere açıldı |
| OI ikonuna tıklayınca floating window açılıyor mu | ✅ "OI DEĞİŞİMİ" başlıklı, L/S'ten bağımsız ayrı pencere açıldı |
| Pencere kapatma (✕) çalışıyor mu | ✅ |
| Console hatası | ✅ yok |

## Değişen / eklenen dosyalar

| Dosya |
|---|
| `index.html` |
| `css/watchlist.css` |
| `js/screener/detail-panel.js` |
| `js/screener/mini-floating-window.js` (yeni) |

## Sıradaki adım

`MiniFloatingWindow`'un L/S ve OI Değişimi pencerelerinin iç içeriği
şimdilik boş yer tutucu — kullanıcı bunu ayrı bir işte dolduracağını
belirtti. Sonrasında araçlar (drawing tools) üzerinde çalışmaya
geçilecek: bazıları kaldırılacak, bazılarının eksikleri giderilecek,
bazılarının işlevselliği iyileştirilecek — henüz kapsam netleşmedi.
