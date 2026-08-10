# gorevler2.md Görev 9 — Güvenlik Açıkları (Tamamlandı)

**Tarih:** 2026-08-10

## Bağlam

Binance IP banı sürerken (dış API'ye bağımlı olmayan) bu ertelenmiş görev
ele alındı. Kapsam, `gorevler2.md`'de not düşülen iki madde ile sınırlı
tutuldu.

## 9.1 — `express.static` kapsamı

### Önce: mevcut durum incelemesi

`server.js:15` → `app.use(express.static(__dirname));` — proje kökünün
tamamını servis ediyordu. Production'da `curl` ile doğrudan test edildi:

| Yol | Önce | Not |
|---|---|---|
| `/server.js` | **200** | Tüm backend kaynak kodu (proxy mantığı, endpoint listesi) indirilebiliyordu |
| `/package.json` | **200** | Bağımlılık listesi |
| `/dokumentasyon/gorevler/gorevler3.md` | **200** | **En hassas bulgu** — Kom1 strateji parametreleri (WT eşiği, RC uzunluğu, TOLERANCE_BARS, 11 coin listesi) herkese açık okunabiliyordu |
| `/.env`, `/.env.example` | 404 | Express'in `static` middleware'i varsayılan olarak dotfile'ları (`.` ile başlayan) yoksayıyor — bu zaten güvendeydi |
| `/.git/config` | 404 | Aynı sebep + `.git` deploy klasöründe zaten yok |
| `/dokumentasyon/` (dizin listesi) | 404 | `express.static` dizin listelemesi yapmıyor, sadece bilinen dosya yollarını servis ediyor |

**Sonuç:** `.env` gibi gerçek sırlar zaten dotfile-ignore sayesinde korunuyordu,
ama `server.js`, `package.json` ve — en önemlisi — tüm `dokumentasyon/`
klasörü (stratejinin kendisi dahil) herkese açıktı.

### Düzeltme

`index.html`'in gerçekte neye ihtiyacı olduğu kontrol edildi (grep ile
`src=`/`href=` taraması) — sadece `css/` ve `js/` alt klasörleri
referans veriliyor, başka hiçbir root-level dosya/klasör kullanılmıyor.

`server.js`:
```js
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/js', express.static(path.join(__dirname, 'js')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
```
(`express.static(__dirname)` tamamen kaldırıldı.)

### Doğrulama (lokal, `node server.js` ile gerçek sunucuya karşı)

| Yol | Sonra |
|---|---|
| `/` (index.html) | 200 ✅ |
| `/css/base.css` | 200 ✅ |
| `/js/core/app.js` | 200 ✅ |
| `/server.js` | **404** ✅ |
| `/package.json` | **404** ✅ |
| `/dokumentasyon/gorevler/gorevler3.md` | **404** ✅ |
| `/.env.example` | 404 (değişmedi) |

Tarayıcıda site açılıp konsol kontrol edildi — statik dosya kaynaklı hiçbir
hata yok (görülen tek hatalar bu sandbox'ın bilinen, önceden dokümante
edilmiş ağ kısıtlaması — `HTTP 502`/`Failed to fetch`, Binance'e gerçek
DNS erişimi olmaması, bu değişiklikle ilgisiz).

## 9.2 — syncKey rate-limit

### Önce: mevcut durum incelemesi

`js/core/state.js:60-71` (`getSyncKey`/`setSyncKey`) ve `js/core/app.js:700-718`
(`_bindSyncKey`) incelendi: **syncKey tamamen kullanıcının kendi girdiği
serbest metin** — sunucu tarafında üretilmiyor, uzunluk/entropi doğrulaması
yok. Kısa/tahmin edilebilir bir syncKey seçen bir kullanıcının kaydını kaba
kuvvetle bulmaya çalışmak teorik olarak mümkündü, çünkü `/api/sync/drawings`
route'larında (`server.js:658-676`) **hiç rate-limit yoktu**.

**Not (kapsam dışı bırakıldı, bilgi amaçlı):** syncKey üretim şeklinin
kendisinin (örn. zorunlu UUID'e geçiş) değiştirilmesi bu görevin kapsamında
değildi — kullanıcı bu turda sadece rate-limit istedi. Kısa syncKey riski
hâlâ teorik olarak var, ama rate-limit brute-force'u pratikte anlamsız
hâle getiriyor.

Meşru kullanım sıklığı da ölçüldü: `js/core/state.js:112-117`
(`syncDrawingsCloud`) zaten 1 saniyelik debounce içeriyor — yani normal bir
kullanıcı çizim yaparken saniyede en fazla 1 istek üretir, dakikada birkaç
onlarca isteğin üzerine hiç çıkmaz.

### Düzeltme

`express-rate-limit` paketi eklendi (`npm install express-rate-limit`,
`package.json`/`package-lock.json` güncellendi). `server.js`'de
`/api/sync/drawings` (hem GET hem POST) için IP başına dakikada 60 istek
sınırı kondu:

```js
const syncLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Çok fazla istek, lütfen bir dakika sonra tekrar deneyin' },
});
app.use('/api/sync/drawings', syncLimiter);
```

Sadece bu path'e uygulandı — `/api/history/*`, `/api/binance/*` gibi diğer
sık çağrılan endpoint'ler etkilenmiyor.

### Doğrulama (lokal, `node server.js`)

- `RateLimit-*` header'ları doğru dönüyor ve istekler arasında azalıyor
  doğrulandı: 1. istek → `RateLimit-Remaining: 59`, 2. istek →
  `RateLimit-Remaining: 58` (limit=60, pencere=60sn). ✅
- Rate limiter'ın SADECE `/api/sync/drawings`'e uygulandığı doğrulandı —
  `/api/binance/futures/...` isteğinde `RateLimit-*` header'ı hiç yok. ✅
- **Not:** Bu sandbox'ta MongoDB bağlantısı yok (bilinen, önceden dokümante
  edilmiş kısıt) — bu yüzden `/api/sync/drawings` istekleri lokal ortamda
  `500` dönüyor (DB sorgusu başarısız oluyor), ama bu rate-limit'ten önce
  gerçekleşen, ayrı bir davranış; production'da MongoDB bağlı olduğu için
  istekler normal `200`/`400` dönecek, limit aşılınca `429`'a düşecek.
  60 gerçek isteği tek tek tüketip 429'u tetiklemek bu sandbox'ta pratik
  değildi (her istek DB timeout'u yüzünden ~10sn sürüyor) — bunun yerine
  header tabanlı doğrulama yapıldı, `express-rate-limit` paketinin kendisi
  yaygın kullanılan, test edilmiş bir kütüphane.

## Regresyon

- `/api/binance/*`, `/api/history/*`, `/api/signals/*` gibi diğer route'lara
  dokunulmadı.
- Frontend'in ihtiyaç duyduğu tüm statik dosyalar (`index.html`, `css/`,
  `js/`) hâlâ erişilebilir.
- `node -c server.js` ile syntax doğrulandı.

## Değişen dosyalar

- `server.js`
- `package.json`, `package-lock.json` (yeni bağımlılık: `express-rate-limit`)
