# Grafik Altı Bant — 3 Düzeltme (Saat Hizası, Sidebar Çerçeveleri, Liste İkonu) — 2026-08-01

## İstek

Önceki işin (grafik altı yatay bant + saat taşıma) ardından kullanıcı 3 sorun bildirdi:

> "saat niye yatay bantta dikey duruyor, banta gore hizalaman gerekmezmi?
> ... sag altta yerlestirdigin 3 butonun ve ustte yerlesen watch, Alarm
> cekmelernon cercevesini hafif kucult, dis cerceveyle cakismakta, gorsel
> olarak kotu gozukuyor ... ayrica yeni olusturdugun bantin sol kosesinde
> visiverodaki gibi bir ikon olusturman gerekiyordu, ve tiklayinca liste
> acilmasi gerekiyordu"

## Kök nedenler ve düzeltmeler

### 1) Saat bantta dikey duruyordu

**Kök neden**: `css/chart.css`'te sağ sidebar'daki ESKİ dikey saat konumu
için yazılmış bir kural vardı: `.rsb-clock-btn { writing-mode: vertical-rl;
transform: rotate(180deg); ... }`. Saati yeni yatay banda taşırken bu
kuralı override etmemiştim — `flex-direction:row` yazmak yetmedi çünkü
`writing-mode` ayrı bir CSS özelliği, metnin kendisini döndürüyordu.

**Düzeltme**: `.chart-bottom-bar .rsb-clock-btn` seçicisine
`writing-mode: horizontal-tb; transform: none; white-space: nowrap;`
eklendi.

### 2) Sidebar'daki grupların çerçevesi dış kenarla çakışıyordu

**Kök neden**: Sağ sidebar sadece 44px genişliğinde; içindeki grup
kutuları (`Watch/Alarm` ve `snapshot/theme/settings`) `width:100%`
kullanıyordu, yani kutunun kendi border'ı doğrudan sidebar'ın kendi
kenarına bitişik oturuyordu — nefes payı yoktu.

**Düzeltme**: Grup kutularının genişliği `100%` yerine, içindeki
butonların gerçek genişliğine sabitlendi (üst grup 36px, alt grup 32px —
button genişlikleriyle birebir). Sidebar'ın kendi `align-items:center`
özelliği sayesinde bu dar kutular artık sidebar içinde ortalanıyor ve
sağda/solda ~3-5px boşluk bırakıyor.

### 3) Liste yer tutucusu ikonsuz ve tıklanamazdı

Önceki turda kullanıcı listenin **işlevinin** (gerçek filtreleme) şimdilik
gerekmediğini söylemişti, ama bandın kendisinin Visivero örneğindeki gibi
bir ikonla tetiklenip açılıp kapanması gerekiyormuş — bunu atlamıştım.

**Düzeltme**:
- `#cbb-list-trigger`: küçük bir ayarlar/gear ikonu + "No Preview" etiketi
  + ok işareti, tıklanabilir buton.
- `#cbb-list-menu`: tıklayınca bandın hemen üstünde açılan, 4 statik
  seçenekli (No Preview/Top Gainers/Delistings/New Listings) dropdown.
- `js/core/app.js`'e `_bindChartBottomBar()` eklendi: tıklamayla aç/kapa,
  bir öğe seçilince etiketi günceller ve menüyü kapatır, dışarı tıklayınca
  kapanır (mevcut global "dışarı tıklayınca kapat" listener'ına eklendi).
- **Önemli**: Bu hâlâ sadece görsel/UI kabuğu — seçim gerçek bir veri
  filtresi tetiklemiyor (önceki turda netleşen kapsam gereği).

## Doğrulama

Tarayıcıda gerçek DOM üzerinde test edildi.

| Test | Sonuç |
|---|---|
| Saat `writing-mode` | ✅ `horizontal-tb` (önceden `vertical-rl` miras alıyordu) |
| Saat ve tz etiketi aynı satırda mı | ✅ ikisi de `top:744`, yan yana |
| Üst grup (Watch/Alarm) kutu genişliği vs sidebar genişliği | ✅ 36px kutu / 44px sidebar → sağda-solda boşluk var |
| Alt grup (snapshot/theme/settings) kutu genişliği vs sidebar | ✅ 32px kutu / 44px sidebar → boşluk var |
| Liste ikonu tıklanınca menü açılıyor mu | ✅ bandın hemen üstünde, sol kenardan hizalı |
| Öğe seçimi etiketi güncelliyor mu | ✅ "Top Gainers" seçildi, etiket değişti, menü kapandı |
| Dışarı tıklayınca menü kapanıyor mu | ✅ (mevcut global listener'a eklendi) |
| Console hatası | ✅ yok |

Test sonrası liste varsayılan "No Preview" durumuna döndürüldü.

## Değişen dosyalar

| Dosya |
|---|
| `index.html` |
| `js/core/app.js` |

## Sıradaki adım

Yok — bildirilen 3 sorun da giderildi. Liste seçeneklerine gerçek işlev
(coin filtreleme) eklemek istenirse ayrı bir iş olarak ele alınmalı.
