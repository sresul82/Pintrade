# Coin Detail Alt Boşluğu Düzeltmesi — 2026-08-01

## İstek

Ekran görüntüsünde: Coin Detail sekmesinde "Fundamental Info" kutularının
altında fazla boş alan kalıyordu. İstenen: bu boşluk, kutuların sağ
kenarındaki boşluk kadar (görsel olarak dengeli) küçültülsün.

## Kök sebep

CSS'te `.dp-spot-info`'nun alt dolgusu (`padding: 6px 12px 12px`) zaten
sağ/sol ile aynı (12px) — yani basit bir dolgu (padding) sorunu değildi.

Gerçek sebep: panel yüksekliği `_applyDetailLayout('detail')` ile içerik
ölçülerek (`scrollHeight`) hesaplanıyor, ama bu ölçüm sadece **iki noktada**
yapılıyordu:
1. Sayfa yüklenirken (`init()` içinde) — bu an, coin verisi henüz gelmeden
   ("— Coin seç" placeholder haldeyken) gerçekleşiyor.
2. Kullanıcı "Coin Detail" sekmesine elle tıkladığında.

Veri asenkron geldiğinde (`loadSymbol` → `update()`) ölçüm **hiç
tazelenmiyordu**. Ayrıca sayfadaki fontlar (`JetBrains Mono` vb.)
`display:swap` ile asenkron yükleniyor — ilk ölçüm anında tarayıcı geçici
bir yedek (fallback) fontla render ediyor olabilir, gerçek font yüklenince
metin metrikleri değişip içerik kısalabiliyor, ama panelin sabit piksel
yüksekliği bu değişikliği yakalamıyordu. Sonuç: panel, içeriğin gerçekte
ihtiyaç duyduğundan biraz daha büyük kalıp altında boşluk bırakıyordu.

## Yapılan değişiklik

`js/screener/detail-panel.js`:

1. **Veri geldiğinde yeniden ölç** — `update(data)` fonksiyonunun sonuna,
   Coin Detail sekmesi aktifse `_applyDetailLayout('detail')`'i tekrar
   çağıran bir satır eklendi. Kullanıcı elle sürüklediyse
   (`_loadManualHeight()` dolu) bu çağrı otomatik ölçüm yerine yine
   kullanıcının sürüklediği değeri uygular — sürüklenmiş boyut bozulmaz.
2. **Fontlar hazır olduğunda yeniden ölç** — `init()`'e
   `document.fonts.ready.then(...)` ile tek seferlik bir yeniden ölçüm
   eklendi.

Her iki hook da aynı, zaten var olan `_applyDetailLayout()` mekanizmasını
kullanıyor — yeni bir hesaplama yolu eklenmedi, sadece bu mekanizmanın doğru
zamanlarda tekrar tetiklenmesi sağlandı.

---

## Doğrulama

Sayfa tam yüklenip veri + fontlar oturduktan sonra ölçüldü:

| Ölçüm | Sonuç |
|---|---|
| Panel yüksekliği (`detail-panel`) | 441px |
| İçerik yüksekliği (`dp-detail-tab`, `scrollHeight`) | 398px |
| `.detail-body` içinde içerik altında kalan boşluk | **0px** |
| Fundamental Info kutularının alt kenarı vs. içerik konteynerinin alt kenarı | **aynı** (800px) |

### Mekanizmanın kesin kanıtı

Bu ortamda font-yükleme gecikmesini gerçek zamanlı yakalamak güvenilir
olmadığından (test sırasında fontlar zaten yüklenmiş oluyordu), daha kesin
bir test yapıldı: panel yüksekliği yapay olarak 100px büyütülüp ("eski/yanlış
ölçüm" durumu simüle edildi), sonra düzeltmenin kullandığı **aynı** genel
fonksiyon (`DetailPanel.applyLayout('detail')`) çağrıldı:

| Adım | Panel yüksekliği | Boşluk |
|---|---|---|
| Normal (doğru) durum | 441px | 0px |
| Yapay olarak 100px büyütüldü | 541px | 100px |
| `applyLayout('detail')` çağrıldıktan sonra | **441px** | **0px** |

Bu, `fonts.ready` ve `update()` sonu hook'larının tetiklediği mekanizmanın,
panel her ne sebeple içerikten büyük kalırsa kalsın onu doğru boyuta
düzelttiğini kanıtlıyor.

### Konsol

Yeni hata yok (mevcut CryptoCompare haber hatası ilgisiz).

---

## Değişen dosyalar

| Dosya | Ne yapıldı |
|---|---|
| `js/screener/detail-panel.js` | `update()` sonuna ve `init()`'e `_applyDetailLayout('detail')` yeniden tetikleme çağrıları eklendi (veri geldiğinde + fontlar hazır olduğunda) |

## Sıradaki adım

Yok — bu iş tamamlandı. Kullanıcının kendi ekranında görsel olarak
doğrulaması faydalı olur (font yükleme zamanlaması ortama göre değişebilir).
