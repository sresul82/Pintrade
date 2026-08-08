# Görev 2 — 45m ve 3H Zaman Dilimlerini Kaldırma — 2026-08-01

## Sebep

Binance ve Bybit API'lerinde 45m ve 3H standart aralık yok:
- **45m:** Binance reddediyor → grafik boş kalırdı; Bybit sessizce **60m
  (1H)** çekip 45m etiketiyle gösteriyordu.
- **3H:** Bybit sessizce **180m (3H)** — aslında bu doğruydu ama Binance'te
  hiç yok, grafik boş kalıyordu.

Bunlar sessiz hatalardı — kullanıcı yanlış veriye bakarak işlem açma riski
taşıyordu.

## Yapılan değişiklikler

| Dosya | Değişiklik |
|---|---|
| `index.html` | `data-tf="45m"` ve `data-tf="3H"` butonları TF dropdown menüsünden kaldırıldı |
| `js/data/bybit-api.js` | `TF_MAP_BYBIT`'ten `'45m': '60'` ve `'3H': '180'` girdileri silindi |
| `js/core/app.js` | Yerel `TF_ORDER` dizisinden `45m`/`3H` çıkarıldı; `favTfs` yüklenirken artık `TF_ORDER.includes()` ile süzülüyor (eski localStorage'da kalmış favoriler temizlenir); `initTf` artık `TF_ORDER`'da yoksa `1H`'ye düşüp `State.set` ile kalıcı olarak düzeltiliyor |
| `js/chart/chart-pane.js` | `this.tf` artık `TF_LIST.includes(s.tf)` kontrolünden geçiyor — eski pane state'inde kalmış 45m/3H varsa `DEFAULTS.tf` (1H)'ye düşer |

`js/core/chart-config.js` (`TF_LIST`) ve `js/core/app-config.js`
(`AppConfig.TF_MAP`/`TF_ORDER`/`TF_TTL`) zaten temizdi — 45m/3H hiç
içermiyorlardı, değişiklik gerekmedi.

**Kapsam dışı bırakılan, bilinen bir ilişkili hata:** `bybit-api.js`'de
`'3D': 'W'` eşlemesi de yanlış (3 gün yerine haftalık mum çekiyor). Bu görev
sadece 45m/3H'yi kapsıyordu, 3D'ye dokunulmadı — ayrı bir görev olarak ele
alınmalı.

---

## Doğrulama

Bybit'te tarayıcıda test edildi.

| Test | Sonuç |
|---|---|
| 45m butonu DOM'da var mı | ✅ yok |
| 3H butonu DOM'da var mı | ✅ yok |
| Kalan TF listesi | ✅ 14 aralık: 1m,3m,5m,15m,30m,1H,2H,4H,6H,12H,1D,3D,1W,1M |
| Diğer TF butonları çalışıyor mu (4H test edildi) | ✅ seçim doğru uygulanıyor |
| Eski favori TF listesinde 45m/3H varsa | ✅ sayfa yüklenince süzülüyor (test: `['5m','45m','3H','1H']` → `['5m','1H']`) |
| Guard mantığı (izole test) | ✅ `'3H'→'1H'`, `'45m'→'1H'`, `'1H'→'1H'`, `'4H'→'4H'`, `undefined/null→'1H'` |
| Yeni konsol hatası | ✅ yok (mevcut CryptoCompare haber hatası ilgisiz) |

### Test metodolojisi notu

İlk denemede tarayıcıda `localStorage`'a doğrudan bozuk bir `paneStates`
yazıp `location.reload()` ile test etmeye çalıştım, ama `chart-core.js`'teki
`beforeunload` handler'ı (`pm.savedStates[p.idx] = p.getState()`) reload
anında pane'in **o anki canlı** TF'ini localStorage'a geri yazıp benim
enjekte ettiğim test verisini eziyordu — bu bir kod hatası değil, test
metodolojimin sayfa içi reload ile uyumsuzluğuydu. Guard ifadesini
(`chart-pane.js:8-10`'daki birebir mantık) doğrudan izole çalıştırarak kesin
doğrulama yapıldı (yukarıdaki tablo).

localStorage temizlendi, kullanıcı temiz `activeTf: '1H'` durumunda
başlıyor.

## Değişen dosyalar

| Dosya |
|---|
| `index.html` |
| `js/data/bybit-api.js` |
| `js/core/app.js` |
| `js/chart/chart-pane.js` |

## Sıradaki adım

Görev 3 — ölü kod dosyalarını sil.
