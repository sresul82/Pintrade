# Lokal Geliştirme Ortamı Kurulumu — 2026-07-31

**Amaç:** Lokal ortamı kullanılabilir hâle getirmek — kullanıcının kendi
değişikliklerini `http://localhost:5500` üzerinde görebilmesi.

---

## 1. Express sürüm çelişkisi düzeltildi

**Sorun:** `package.json` `express: ^4.19.2` diyordu, ama kurulu ve kilitli sürüm
**5.2.1**'di ve kod Express 5 sözdizimi kullanıyor:

```js
app.get('/api/binance/futures/*splat', ...)   // server.js:445 — Express 5 sözdizimi
```

Temiz bir makinede `npm install` Express 4 kurar ve **proxy tamamen çöker**;
`npm ci` ise hiç çalışmaz (lock ile package.json çeliştiği için `EUSAGE`).

**Değişiklik:**

| Dosya | Değişiklik |
|---|---|
| `package.json:21` | `"express": "^4.19.2"` → `"^5.2.1"` |
| `package-lock.json:14` | `npm install` ile otomatik hizalandı |

---

## 2. `.env.example` oluşturuldu

Yeni dosya: `.env.example`

- `MONGODB_URI` placeholder + Atlas ve lokal MongoDB örnek adresleri
- `PORT` (varsayılan 5500)
- Hangi özelliklerin MongoDB gerektirdiği yorum satırlarında açıklandı
- Nasıl kullanılacağı yazılı: `copy .env.example .env`

---

## 3. "Lokal mod" mesajı netleştirildi

**Sorun:** `.env` yokken sunucu sadece tek satır yazıyordu
(`⚠️ MONGODB_URI tanımlı değil`) — hangi özelliğin çalışıp çalışmadığı belli değildi.

**Değişiklik:** `server.js` — `printLocalModeBanner()` eklendi. Artık açılışta:

```
╔══════════════════════════════════════════════════════════════╗
║  ⚠️  LOKAL MOD — veritabanı YOK                              ║
╚══════════════════════════════════════════════════════════════╝
   Sebep: .env dosyasında MONGODB_URI tanımlı değil

   ✅ ÇALIŞAN ÖZELLİKLER
      • Grafik + çoklu panel + tüm çizim araçları
      • Screener (canlı fiyat / değişim / FR / hacim)
      • Coin detay paneli, bot sinyalleri, arama
      • Çizimler tarayıcıda saklanır (localStorage)

   ❌ ÇALIŞMAYAN ÖZELLİKLER (MongoDB gerektiriyor)
      • Çizim bulut senkronu        /api/sync/drawings
      • Funding Rate geçmişi        /api/history/fr
      • OI + hacim geçmişi          /api/history/market
      • Kayıtlı mum verisi          /api/history/candles
      • Arka plan veri toplayıcı (FR/OI/mum)
      → Tarayıcı konsolunda "Preload hatası" uyarıları normaldir.

   Açmak için: .env.example dosyasını .env olarak kopyalayıp
   MONGODB_URI değerini doldurun.
```

Bağlantı başarısız olursa da aynı banner "Sebep: MongoDB'ye bağlanılamadı — ..." ile çıkıyor.
`baslat.bat` penceresinin codepage'i 65001 (UTF-8) olduğu için karakterler düzgün görünüyor —
kontrol edildi, ek düzeltme gerekmedi.

---

## 4. Bot tarayıcı geçici olarak kapatıldı (kullanıcı onayıyla)

**Sorun:** M1 Hammer tarayıcısı Binance'e IP ban attırıyor ve chart hiç çalışmıyor
(ayrıntı: `2026-07-31-kod-incelemesi.md` madde 11).

**Kullanıcı kararı:** "Tarayıcıyı geçici kapat (1 satır)" — kalıcı WebSocket çözümü
kuyrukta (görev #1) kalsın.

**Değişiklik:** `js/screener/detail-panel.js:844` — `M1HammerScanner.start()` yoruma
alındı, üstüne sebebi ve geri açma talimatı yazıldı.

**Ölçülen etki:** Doğrudan `fapi.binance.com` istek sayısı **~2.500 → 0**.

**Yan etki:** Bot Signals sekmesindeki M1 Hammer listesi boş kalır.
FR sinyalleri etkilenmez, çalışmaya devam eder.

---

## 5. Doğrulama

### Temiz makine kurulum testi

Proje bir kenara kopyalanıp sıfırdan kuruldu:

```bash
npm ci
```

| Test | Sonuç |
|---|---|
| `npm ci` (lock ↔ package.json katı uyum kontrolü) | ✅ exit 0, 86 paket, 2 sn |
| Kurulan sürümler | ✅ express 5.2.1, cors 2.8.6, dotenv 16.6.1, mongoose 8.24.2 |
| `node server.js` temiz başlıyor mu | ✅ hata yok |
| `GET /health` | ✅ `{"status":"ok","db":"disconnected"}` |
| `GET /api/binance/futures/fapi/v1/ping` (`*splat` rotası) | ✅ HTTP 200 |
| `GET /api/yok` (olmayan rota) | ✅ 404 |

`npm ci` düzeltmeden önce çalışmıyordu. `*splat` testi de Express 5'in gerçekten
kurulu olduğunu kanıtlıyor — Express 4 olsaydı o istek 404 dönerdi.

### Uygulama testi (lokal, tarayıcı)

| Test | Sonuç |
|---|---|
| `http://localhost:5500` açılıyor | ✅ |
| Tüm JS modülleri yükleniyor | ✅ `AppConfig, State, EventBus, ScreenerCore, DetailPanel, SearchCore, Storage, BinanceAPI, BybitAPI` |
| Sidebar / çizim araçları | ✅ `[Sidebar] Initialized ✓` |
| IndexedDB | ✅ `[Storage] IndexedDB ready ✓` |
| Screener listesi | ✅ **678 coin** (fiyat, değişim, FR, funding periyodu, hacim) |
| Chart mum yükleme | ✅ **1500 mum** |
| Chart canlı fiyat akışı | ✅ `feed:price` olayları akıyor, `_lastPrice` güncelleniyor |
| Navbar coin detayı | ✅ PRICE 63,799.10 · OI 6.73B · VOL 8.88B |
| Doğrudan `fapi.binance.com` isteği | ✅ 0 (düzeltme öncesi ~2.500) |

### ⚠️ Doğrulanamayan

**Tek seferde, kesintisiz bir tam sayfa yüklemesi doğrulanamadı.** Sebep: test
sırasında yapılan tekrarlı sayfa yenilemeleri + uygulamanın kendi 2 saniyelik REST
polling'i (madde 12) IP'yi Binance nezdinde ceza durumunda tuttu; kısa ban'lar
(~2 dk) tekrarladı.

Yukarıdaki chart ve screener sonuçları **ban olmayan pencerelerde ölçüldü** — yani
kod sağlam, sorun istek hacmi. Görev #5 (chart'ı WebSocket'e çevirme) tamamlanınca
bu tamamen ortadan kalkar.

**Kullanıcı için not:** Lokali açarken sayfayı arka arkaya yenilemeyin.
Birkaç dakika ara verip tek seferde açın.

---

## Değişen dosyalar özeti

| Dosya | Ne yapıldı |
|---|---|
| `package.json` | express `^4.19.2` → `^5.2.1` |
| `package-lock.json` | otomatik hizalandı |
| `.env.example` | **yeni** |
| `server.js` | lokal mod banner'ı eklendi |
| `js/screener/detail-panel.js` | M1HammerScanner.start() geçici yoruma alındı |
| `dokumentasyon/pintrade-yapisi.md` | **yeni** — dosya/klasör hiyerarşisi |

---

## Sıradaki adım

Kullanıcı watchlist tarafındaki değişikliklerini (BN Screener / BB Screener /
BN All / BB All sekmeleri, dropdown menü) lokalde gösterecek.

Kuyrukta bekleyen görevler (hiçbiri başlatılmadı):

1. Bot tarayıcıyı WebSocket'e taşı (IP ban riski)
2. 45m ve 3H zaman dilimlerini kaldır
3. Sidebar'dan çalışmayan çizim araçlarını temizle
4. İndikatör matematiğini ortak modüle çıkar
5. Chart canlı verisini 2sn REST polling'den WebSocket'e çevir
