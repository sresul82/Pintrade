# Görev 3 — Ölü Kod Dosyalarını Silme — 2026-08-01

## Yapılan değişiklikler

### Silinen dosyalar

| Dosya | Doğrulama |
|---|---|
| `js/drawing/tools/drawing-advanced.js` | Kod içinde sıfır referans (sadece dokümantasyonda anılıyordu); silindikten sonra sunucudan `404` |
| `js/drawing/ui/settings-modal.js` | Kod içinde sıfır referans (`.tv-settings-modal` adlı FARKLI bir CSS sınıfı vardı, karıştırılmadı); silindikten sonra `404` |
| `out.txt` | 37 KB debug dökümü, silindikten sonra `404` |
| `tmp/` (5 dosya) | `fix_renderer.js`, `fix_trend.py`, `fix_trend_v2.py`, `fix_toolbar_refs.py`, `repair_dsd.py` — tek seferlik onarım betikleri, hepsi silindi |

### `chart-core.js` — kopya blok + bozuk ölü kod

- Satır 81-115 ile 169-203 **birebir aynıydı** ("index.html static sync
  toggles → SyncManager" bridge'i + `_applyToggleVisual` fonksiyonu). İkinci
  kopya silindi.
- Satır 26-52'deki `#nav-tf` click handler'ı: `index.html`'de `#nav-tf` diye
  bir eleman **hiç yok** (doğrulandı), yani `if (navTfBtn)` koşulu asla
  doğru olmuyordu — kod hiç çalışmıyordu. İçinde de tanımsız `setType`
  (satır 40-43) ve `navChartTypeBtn` (satır 48) referansları vardı — hem
  ölü hem bozuk. Tamamı kaldırıldı.

### `.gitignore`
`out.txt` ve `tmp/` eklendi (`.env`, `.DS_Store` zaten vardı).

---

## Doğrulama

Bybit'te tarayıcıda test edildi.

| Test | Sonuç |
|---|---|
| `chart-core.js` syntax | ✅ `node --check` geçti |
| Silinen dosyalar sunucudan 404 dönüyor mu | ✅ `out.txt`, `tmp/fix_renderer.js`, `drawing-advanced.js` — üçü de 404 |
| Site tarayıcıda açılıyor mu | ✅ |
| Chart yükleniyor mu | ✅ `LayoutManager.panes` dolu, aktif pane TF gösteriyor |
| Screener çalışıyor mu | ✅ 676 satır (Bybit) |
| Sidebar / çizim araçları | ✅ 16 buton render ediliyor |
| Coin Detail paneli | ✅ fiyat verisi geliyor |
| Yeni konsol hatası | ✅ yok (mevcut CryptoCompare haber hatası ilgisiz) |

Test sırasında oluşan `paneStates` kalıntısı temizlendi, `activeTf: '1H'`
varsayılanına döndürüldü.

## Değişen/silinen dosyalar

| Dosya | İşlem |
|---|---|
| `js/drawing/tools/drawing-advanced.js` | silindi |
| `js/drawing/ui/settings-modal.js` | silindi |
| `out.txt` | silindi |
| `tmp/` | silindi (5 dosya) |
| `js/chart/chart-core.js` | kopya blok + bozuk ölü kod temizlendi (233 satır → 165 satır) |
| `.gitignore` | `out.txt`, `tmp/` eklendi |

## Sıradaki adım

Kuyrukta ⏸ **DUR — kullanıcı onayı bekle** bloğu var. Görev 4 (bot
tarayıcıyı WebSocket'e taşıma) daha büyük ve riskli — kullanıcı açıkça
"Görev 4'e geç" demeden başlanmayacak.
