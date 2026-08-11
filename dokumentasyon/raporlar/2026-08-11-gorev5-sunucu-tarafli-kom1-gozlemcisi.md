# gorevler3.md Görev 5 — Ban Kalktı + Sunucu Taraflı Kom1 Gözlemcisi

**Tarih:** 2026-08-11

## Ban durumu

Binance IP banı kalktı. Production'da doğrulandı: Kom1Scanner backfill'i
22/22 istek başarılı tamamladı, konsol logunda **iki büyük TF sinyali
gerçekten ateşlendi** (ONDOUSDT 1h, BERAUSDT 1h) — 5dk onay penceresi açık,
kesinleşme bekleniyor.

## Sunucu taraflı "shadow" gözlemci (kullanıcı isteği)

**Kullanıcı sorusu:** İlk 10 sinyali toplamak saatler/günler sürebilir —
bu süreyi, Claude Code oturumundan bağımsız, herhangi bir bilgisayardan
kontrol edilebilecek şekilde nasıl takip edelim?

**Kapsam netleştirmesi:** Kullanıcı açıkça sunucu tarafında çalışan bir
mekanizma istedi (oturuma bağlı değil). Bu, Görev 7'nin (tam sunucu taraflı
izleme + Telegram/email) küçük, DAR kapsamlı bir alt kümesi olarak
uygulandı — Telegram/email YOK, sadece "sinyal oldu mu, ne zaman" kaydı.

### Yapılan değişiklikler

**`js/screener/indicator-engine.js`** — izomorfik hâle getirildi:
```js
if (typeof window !== 'undefined') window.IndicatorEngine = IndicatorEngine;
if (typeof module !== 'undefined' && module.exports) module.exports = IndicatorEngine;
```
Böylece hem tarayıcı hem Node aynı hesaplama kaynağını kullanıyor — iki
ayrı implementasyon YOK (FR'nin "3 kaynaktan tutarsız veri" hatasına
düşülmedi).

**Yeni `js/screener/kom1-server-watcher.js`** — `kom1-scanner.js` ile AYNI
kural ve parametreler (WT eşiği -53, RC 100, TOLERANCE_BARS=3, aynı 11
coin, aynı 1h/4h+5m yapısı), ama periyodik REST anlık görüntüsü mimarisiyle:
- Her 5 dakikada, 11 coin × 2 TF için büyük TF kuralı kontrol edilir
  (`RC_mid` + `WT` cross).
- Ateşlenen sinyaller bellekte (`_pending` Map) tutulur, süresi
  TOLERANCE_BARS'ın duvar-saati eşdeğerine göre (1h→3sa, 4h→12sa) dolar.
- Bekleyen sinyali olan coinler için 5dk mumlarında HA+DEMA9 onayı
  kontrol edilir; onaylanırsa `onConfirmed` callback'i çağrılır.
- Ban sinyali (418/429) algılanırsa o turu sessizce atlar (server.js'in
  kendi mevcut hata toleransı deseniyle tutarlı).

**`server.js`:**
- Yeni `Kom1SignalLog` koleksiyonu, **30 gün TTL** (Candle koleksiyonunun
  TTL'siz kalıp depolamayı doldurduğu hatadan ders alınıp baştan eklendi,
  bkz. gorevler2.md Görev 12).
- `_staggeredStart` zincirine eklendi (25sn gecikme, 5dk periyot — mum
  toplayıcıyla aynı sıklık, ağırlığı çok daha hafif: 22 istek + birkaç
  onay isteği).
- `GET /api/kom1/signals` — kesinleşmiş sinyaller (en yeni önce, max 200).
- `GET /api/kom1/status` — o an bekleyen sinyaller + izlenen sembol/TF
  listesi (izleyicinin canlı olduğunu doğrulamak için).
- **Güvenlik düzeltmesi:** `tick()` bir Promise döndürüyor, `_staggeredStart`
  içinde `.catch()` ile yakalanmazsa yakalanmamış bir reddetme (unhandled
  rejection) sunucu process'ini çökertebilirdi — eklendi.

### Bilinen fark (kasıtlı, dokümante edildi)

Bu gözlemci **asıl/yetkili motorun yerini tutmuyor** — `kom1-scanner.js`
(tarayıcı, WS bar-akışı, olay-güdümlü) hâlâ Watchlist/alarm entegrasyonunun
tek kaynağı. Sunucu gözlemcisi periyodik REST anlık görüntüsü kullandığı
için TOLERANCE_BARS'ı bar-sayısı yerine duvar-saatine çevirmek zorunda
kaldı — iki motorun ürettiği sinyaller birebir aynı anda gelmeyebilir,
küçük bir sapma normal ve beklenen.

## Doğrulama

- `node -c` ile üç dosyada da (server.js, kom1-server-watcher.js,
  indicator-engine.js) syntax doğrulandı.
- `node -e "require('./js/screener/indicator-engine.js')"` ile Node'da
  doğru yüklendiği doğrulandı (4 fonksiyon da `function` tipinde döndü).
- Lokal sunucuda `GET /api/kom1/status` test edildi — doğru sembol/TF
  listesi döndü.
- `GET /api/kom1/signals` lokalde beklenen MongoDB-yok hatasını verdi
  (diğer tüm Mongo-bağımlı endpoint'lerle aynı, bilinen sandbox kısıtı).
- Gerçek ağ/DB testi sandbox'ın DNS kısıtı yüzünden burada yapılamadı —
  deploy sonrası production'da doğrulanacak.

## Değişen/yeni dosyalar

- `js/screener/indicator-engine.js` (izomorfik export eklendi)
- `js/screener/kom1-server-watcher.js` (yeni)
- `server.js` (Kom1SignalLog şeması, zamanlayıcı, 2 endpoint)
