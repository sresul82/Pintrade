# Watchlist Header — Tamamlanma Raporu — 2026-07-31

**Kapsam:** Header bar'ın nihai düzeni + liste altyapısının arayüz iskeleti.
**Test borsası:** Bybit (Binance'te IP ban sorunu sürüyor — bkz. görev #1).
**Sinyal üretimi / alarm entegrasyonu / Kom1-2-3 doldurma:** bilinçli olarak
YAPILMADI, sonraki tura bırakıldı.

---

## 1. Header Bar Düzeni

**Sonuç sırası:** `[Arama] [Liste Seçici] [Sütun ⋮] [Borsa Seçici]`

| İstenen | Durum |
|---|---|
| Soldaki "✕" kaldırılsın | ✅ `wl-close-btn` HTML'den ve CSS'ten silindi |
| Aramaya yazınca sağında ✕ belirsin | ✅ `.wl-search-clear`, JS `.visible` sınıfıyla |
| Symbol başlığı coin isimleriyle hizalı olsun | ✅ 8px kayma düzeltildi |
| Borsa seçici en sağa | ✅ |

### Symbol hizalama — kök sebep

`.wl-row`'da `padding: 3px 8px` vardı ama `.wl-col-header`'da hiç padding yoktu,
bu yüzden başlık 8px sola kaymış görünüyordu.

İkinci bir kayma daha çıktı: liste (`#wl-list`) kaydırma çubuğu yüzünden satırlar
3px dar, başlık ise çubuğun dışında. Başlığa çubuk genişliği kadar ek sağ padding
verildi (`calc(8px + var(--scrollbar-width))`).

| Ölçüm | Önce | Sonra |
|---|---|---|
| Symbol başlığı ↔ coin ismi (sol) | 8px kayık | **0px** |
| Son sütun sağ kenarı | 3px kayık | **0px** |

---

## 2. Liste Seçici Menüsü

Yeni dosya: **`js/screener/watchlist-store.js`** (veri) +
**`js/screener/watchlist-menu.js`** (arayüz). Veri katmanı DOM'a hiç dokunmuyor.

### Menü yapısı

```
● Tüm Coinler                    ← sistem, varsayılan
─────────────────────────
LİSTELERİM
  ● Scalp adayları (3)    ✎ 🗑   ← hover'da eylemler
  + Yeni liste oluştur...
─────────────────────────
SİSTEM
  ● Sinyaller                     ← sistem, silinemez
      ── Kom1 ──  —
      ── Kom2 ──  —                ← boş iskelet (kasıtlı)
      ── Kom3 ──  —
─────────────────────────
SPOT              [yakında]        ← gri, tıklanınca bilgi
FUTURES                            ← aktif
  [USDT]
```

### Çalışan işlevler

| İşlev | Test sonucu |
|---|---|
| Yeni liste oluştur | ✅ `Scalp adaylari` → listede + localStorage |
| Aynı isimle ikinci liste | ✅ otomatik `Swing (2)` oldu |
| Yeniden adlandır (✎) | ✅ `Scalp adaylari` → `Scalp (yeni ad)` |
| Sil (🗑, onay sorar) | ✅ listeden + localStorage'dan gitti |
| Aktif liste silinirse | ✅ otomatik "Tüm Coinler"e döner |
| Liste seçince filtre | ✅ 676 satır → sadece listedeki 3 coin |
| Sunucu yeniden başlatma sonrası | ✅ listeler ve içerikleri korundu |
| Boş liste mesajı | ✅ "Bu liste boş. Coin eklemek için..." |
| Sinyaller listesi | ✅ görünüyor, Kom1/2/3 ayıraçları var, içerik boş |
| SPOT tıklama | ✅ "SPOT desteği yakında eklenecek" bildirimi, FUTURES aktif kalıyor |
| FUTURES / USDT | ✅ aktif işaretli |

### Coin ekleme (kapsam dışıydı, eklendi)

Boş liste mesajı "coine sağ tıklayın" diyordu ama o özellik yoktu — arayüzün
yapmadığı bir şeyi vaat etmemesi için **satır sağ tık menüsü** de eklendi:

| Test | Sonuç |
|---|---|
| Satıra sağ tık → menü | ✅ başlıkta coin adı, altında listeler |
| Listeye ekle / çıkar | ✅ tik işareti anında güncelleniyor |
| **Bir coin birden fazla listede** | ✅ COTIUSDT iki listeye birden eklendi |
| Dışarı tıklayınca kapanma | ✅ |

---

## 3. Sütun Aç/Kapa (⋮)

| Test | Sonuç |
|---|---|
| Menü açılıyor | ✅ 7 sütun listeleniyor |
| Symbol kilitli | ✅ 🔒 işaretli, tıklayınca kapanmıyor |
| Vol + OI kapatma | ✅ başlık 7→5, satır hücresi 7→5 |
| Grid şablonu güncelleniyor | ✅ `minmax(80px,1fr) 74px 62px 68px 48px` |
| localStorage | ✅ `["oi","vol"]` |
| Sayfa yenilemesinden sonra kalıcı | ✅ |

Sütun genişlikleri artık CSS'te sabit değil, JS'ten `--wl-cols` ile geliyor —
sütun sayısı değiştiğinde şablon da değişiyor. Symbol sütunu `minmax(80px, 1fr)`
olduğu için kapatılan sütunların yerini o alıyor.

---

## 4. Borsa Seçici

Dokunulmadı, sadece bar sırasında en sağa alındı. Bybit'te 676 coin listeleniyor.

---

## 5. Yol boyunca çıkan iki hata

**a) Menüler hiç açılmıyordu.** `const WatchlistStore = ...` şeklinde tanımlanan
üst seviye değişkenler klasik script'te `window`'a eklenmiyor. `WatchlistMenu.init()`
içindeki `if (!window.WatchlistStore) return;` kontrolü bu yüzden hep erken çıkıyordu.
Her iki modülün sonuna açık `window.X = X` ataması eklendi.

> Not: Bu, kod tabanında yaygın bir kalıp — `AppConfig`, `State`, `EventBus` de
> `window` üzerinde değil. Yeni modül yazarken dikkat edilmeli.

**b) Liste etiketi bayat kalıyordu.** Başlık sadece menüden tıklayınca
güncelleniyordu; `setActive` başka yerden çağrılınca eski isim kalıyordu.
`watchlist:activeChanged` olayına bağlandı — ileride sinyal motoru listeyi
değiştirdiğinde de başlık doğru kalacak.

---

## 6. Değişen / eklenen dosyalar

| Dosya | Ne yapıldı |
|---|---|
| `js/screener/watchlist-store.js` | **YENİ** — listeler, sütunlar, pazar filtresi, localStorage |
| `js/screener/watchlist-menu.js` | **YENİ** — liste menüsü, sütun menüsü, sağ tık menüsü |
| `index.html` | Header yeniden düzenlendi; iki yeni script; `WatchlistMenu.init()` |
| `js/screener/screener-core.js` | Dinamik sütun render, liste filtresi, arama ✕, boş liste mesajı |
| `css/watchlist.css` | Menü stilleri, arama ✕, hizalama düzeltmeleri |

---

## 7. Doğrulama özeti

Bybit / 1600×900 / lokal sunucu.

| | Sonuç |
|---|---|
| Header eleman sırası | ✅ `wl-search-wrap, wl-list-picker, wl-cols-picker, wl-exchange-picker` |
| Screener satır sayısı | ✅ 676 (Bybit) |
| Arama filtresi | ✅ "BTC" → 2 satır, ✕ ile 676'ya dönüş |
| Symbol hizalama | ✅ 0px |
| Son sütun sağ kenar | ✅ 0px |
| Yeni konsol hatası | ✅ yok (mevcut CryptoCompare haber hatası ilgisiz, önceden vardı) |
| Test artıkları | ✅ temizlendi, kullanıcı sıfır listeyle başlıyor |

---

## 8. Bu turda BİLİNÇLİ olarak yapılmayanlar

- Sinyal üretim mantığı
- Alarm sekmesi entegrasyonu ("Kom1 listesine BANKUSDT eklendi")
- Kom1 / Kom2 / Kom3 doldurma ve puanlama
- SPOT veri katmanı (sembol listesi, fiyat, değişim)
- Binance ile doğrulama (IP ban — görev #1 çözülünce)

`WatchlistStore.getSignalGroups()` şu an her grup için boş dizi dönüyor;
sinyal motoru geldiğinde sadece bu fonksiyonun içi doldurulacak, arayüz
tarafında değişiklik gerekmeyecek.

---

## Sıradaki adım

Sinyal üretimi + alarm entegrasyonu + Kom1/2/3 doldurma. Ayrıca Binance ban
sorunu (görev #1) çözülünce header ve liste altyapısı Binance'te de test edilmeli.
