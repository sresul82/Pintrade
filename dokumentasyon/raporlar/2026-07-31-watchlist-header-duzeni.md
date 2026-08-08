# Watchlist Header Düzeni + Navbar Hizalaması — 2026-07-31

**İstek:** Watchlist header'ındaki "Screener" yazısını kaldırıp yerine arama kutusu
koymak; eleman sırasını `arama → watchlist → borsa seçimi` yapmak; navbar'daki coin
bilgi kutusunun genişliğini watchlist paneliyle aynı hale getirmek.

**Durum:** Arama kutusu ve hizalama tamamlandı. **Watchlist liste seçici yapılmadı** —
sebebi aşağıda.

---

## 1. "Screener" başlığı → arama kutusu

**Önce:** Başlık header'ın içinde, arama kutusu header'ın **altında** ayrı bir tam
genişlik satırıydı.

```
[✕]  Screener              [Binance ▾]
[ Ara...                              ]     ← ayrı satır
```

**Sonra:** Arama kutusu başlığın yerine, header'ın içine alındı. Alttaki satır kalktı
→ listeye bir satır daha fazla dikey alan.

```
[✕]  [ Ara...          ]   [Binance ▾]
```

### Değişiklikler

| Dosya | Değişiklik |
|---|---|
| `index.html` | `.wl-title` ("Screener") silindi; `<input id="wl-search">` header'ın içine taşındı |
| `css/watchlist.css` | `.wl-search` yeniden biçimlendirildi: `flex:1`, 24px yükseklik, kenarlık + köşe yuvarlama, focus durumu |

`id="wl-search"` **değişmedi**, bu yüzden `screener-core.js:562`'deki bağlantı ve
arama işlevi olduğu gibi çalışıyor. `app.js:735`'teki göster/gizle listesi de
etkilenmedi (`display:''` / `display:'none'` kullanıyor).

---

## 2. Navbar coin bilgi kutusu ↔ watchlist hizalaması

### Tespit edilen iki ayrı sorun

**a) Kutu watchlist'ten dardı.** `max-width: 560px` tanımlıydı ama `max-width` bir
başlangıç genişliği vermez — kutu içeriği kadar (≈430px) kalıyordu, watchlist ise
480px. Sol kenarlar 433px kayıktı.

**b) Sağ kenar 4px kayıktı.** `margin-right: var(--sidebar-width)` = 40px kullanıyordu,
ama sağdaki dikey ikon çubuğu gerçekte **44px**. Sebep: `index.html` içindeki satır içi
`<style>` bloğu `.right-sidebar { width: 44px }` ile `css/chart.css`'teki
`width: var(--sidebar-width)` kuralını eziyordu.

Ek olarak navbar'ın kendi `padding-right: 8px`'i de hesaba katılmamıştı.

### Değişiklikler

| Dosya | Değişiklik |
|---|---|
| `css/variables.css` | `--coin-detail-width` artık `var(--panel-width-right)` — ikisi birlikte hareket ediyor |
| `css/variables.css` | `--right-sidebar-width: 44px` eklendi (sabit 44px yerine) |
| `css/variables.css` | `--navbar-padding-x: 8px` eklendi |
| `index.html` | Satır içi `.right-sidebar { width: 44px }` → `var(--right-sidebar-width)` |
| `css/navbar.css` | `.navbar` padding'i `var(--navbar-padding-x)` kullanıyor |
| `css/navbar.css` | `.nb-coin-details`: `max-width` → `width: var(--coin-detail-width)`; `margin-right: calc(var(--right-sidebar-width) - var(--navbar-padding-x))` |
| `css/navbar.css` | `.nb-cd-item:first-child` → `flex: 1 1 auto`, sola hizalı: artan genişliği SYMBOL emiyor |

**Bundan sonra:** Genişliği değiştirmek isterseniz sadece `--panel-width-right`
değerini değiştirmeniz yeterli, bilgi kutusu otomatik takip eder.

### Ölçümler (1600×900)

| | Önce | Sonra |
|---|---|---|
| Bilgi kutusu genişliği | 430px | **480px** |
| Watchlist genişliği | 480px | 480px |
| Sol kenar farkı | −433px | **0px** |
| Sağ kenar farkı | −4px | **0px** |
| SYMBOL alanı genişliği | 54px | **104px** |

---

## 3. Yol açtığı regresyon ve çözümü

Genişliği sabitleyince **dar ekranda navbar taştı**. 1024px'te ölçüldü:

| | Kutu genişliği | Navbar taşması |
|---|---|---|
| Eski kod | 322px (sıkışıyor) | yok |
| İlk düzeltme (`flex-shrink: 0`) | 480px | **1134px > 1024px — taşıyor** |
| Son hâl | 326px (sıkışıyor) | yok |

**Çözüm:** `@media (max-width: 1299px)` altında kutu eski esnek davranışına dönüyor
(`width: auto`). Hizalama sadece yer olduğunda uygulanıyor. 1299px eşiği, `navbar.css`
içinde zaten var olan responsive breakpoint ile aynı tutuldu.

---

## 4. Watchlist liste seçici — YAPILMADI

İstenen sıra `arama → watchlist → borsa seçimi` idi. Ortadaki **watchlist liste
seçici eklenmedi**, çünkü kapsamı hakkındaki sorular yanıtlanmadı ve verilecek karar
yapılacak işi kökten değiştiriyor.

### Neden basit bir görsel iş değil

Pintrade'de **"watchlist" diye bir kavram yok**. Sağ panel bir *screener* — borsadaki
tüm coinleri (678 tane) listeliyor. Kullanıcının kendi listesi, favori coini yok.
Koddaki tek "favori" sistemi çizim araçları için (`js/ui/sidebar.js`).

Referans görseldeki menünün her satırının karşılığı:

| Menüdeki öğe | Pintrade'de |
|---|---|
| Adlandırılmış listeler | ❌ Liste kavramı yok |
| Rename / Create new list | ❌ Yok |
| **FUTURES** | ✅ Var — zaten sadece bu çekiliyor |
| **SPOT** | ❌ Spot sembol listesi hiç çekilmiyor (`restSpot` sadece tek coin fiyat karşılaştırmasında kullanılıyor — `detail-panel.js:706`) |
| **USDT** | ✅ Var |
| **USDC** | ❌ Kodun her yerinde `endsWith('USDT')` filtresi var; USDC hiç gelmiyor (tüm projede tek geçtiği yer bir yorum satırı) |
| RECENTLY USED | ❌ Yok |

### Bekleyen kararlar

1. **Watchlist ne olacak?** (a) kendi seçtiğim adlandırılmış coin listeleri,
   (b) sadece pazar filtresi (FUTURES/SPOT, USDT/USDC), (c) ikisi birden
2. **SPOT ve USDC kapsamda mı?** İkisi de veri katmanında yeni iş demek

Header'da yeri hazır — `index.html` içine yorum olarak işaretlendi.

---

## 5. Doğrulama

Lokal sunucuda tarayıcıda test edildi.

| Test | Sonuç |
|---|---|
| Arama kutusu header'ın içinde | ✅ |
| "Screener" başlığı kalktı | ✅ |
| Arama işlevi | ✅ 678 satır → "BTC" yazınca 3 satır |
| Screener listesi doluyor | ✅ 678 coin |
| Hizalama 1600px | ✅ sol 0px, sağ 0px, ikisi de 480px |
| Hizalama 1280px | ✅ sol 0px, sağ 0px, taşma yok |
| Dar ekran 1024px | ✅ taşma yok, kutu sıkışıyor |
| Yeni konsol hatası | ✅ yok (mevcut CryptoCompare haber hatası ilgisiz, önceden vardı) |

---

## Değişen dosyalar

| Dosya | Ne yapıldı |
|---|---|
| `index.html` | Header yeniden düzenlendi; `.right-sidebar` genişliği değişkene bağlandı |
| `css/variables.css` | `--coin-detail-width` türetildi; `--right-sidebar-width`, `--navbar-padding-x` eklendi |
| `css/navbar.css` | Bilgi kutusu genişlik/margin düzeltmesi, SYMBOL esnek, dar ekran media query |
| `css/watchlist.css` | `.wl-search` header içi biçimlendirme |

## Sıradaki adım

Watchlist liste seçicinin kapsamı netleşince eklenecek (yukarıdaki 2 karar).
