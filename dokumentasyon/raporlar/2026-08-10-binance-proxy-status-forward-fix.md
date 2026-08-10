# Kritik Üretim Bulgusu — Binance Proxy Status Kodu Forward Edilmiyordu (Düzeltildi)

**Tarih:** 2026-08-10

## Bağlam

gorevler3.md Görev 4 (Kom1Scanner canlıya alma) production'a push edilip
`pintrade-uwg9.onrender.com` üzerinde doğrulanırken (Görev 1'deki gibi kısa
süreli log izleme), konsolda beklenmeyen bir hata görüldü:

```
[Kom1Scanner] Backfill hata (ONDOUSDT 1h): kl.map is not a function
```

Bu, Görev 4'ün kendi kodunun hatası değil — inceleme sonucu daha önce hiç
fark edilmemiş, **önceden var olan** bir `server.js` bug'ı ortaya çıktı.

## Kök neden

`curl -i` ile doğrudan proxy endpoint'i test edildi:

```
GET /api/binance/futures/fapi/v1/klines?symbol=ONDOUSDT&interval=1h&limit=5
→ HTTP/1.1 200 OK
{"code":-1003,"msg":"Way too many requests; IP(74.220.51.139) banned until ..."}
```

Binance gerçekte `418`/`429` dönüyor ama `server.js:842` `proxyRequest()`
fonksiyonu upstream'in (`proxyRes.statusCode`) hiç `res`'e aktarmıyordu —
sadece header'ları set edip `proxyRes.pipe(res)` yapıyordu, Express bu
durumda varsayılan olarak **200** dönüyor. Sonuç: `kom1-scanner.js` ve
`m1hammer-scanner.js`'deki `fetchKlines()`'ın `res.status === 429 || 418`
kontrolü **hiçbir zaman tetiklenmiyordu** — ban gövdesi normal veri sanılıp
`kl.map()` çağrılınca çöküyordu.

**Bu neden şimdiye kadar fark edilmedi?** M1Hammer aylardır çalışıyor ama
muhtemelen bu üretim ortamında (Render, datacenter IP) hiç gerçek bir
418/429 ban'ı ile karşılaşmamıştı (veya karşılaştıysa sessizce backfill
hatası olarak loglanıp kimse fark etmedi — `console.warn` seviyesinde).
Kom1Scanner'ın ek 22 isteği + IP zaten banlı olduğu bir anda deploy edilmesi,
bug'ı ilk kez gözle görülür hâle getirdi.

## Düzeltme

`server.js`, `proxyRequest()`:

```js
const proxyReq = https.request(options, (proxyRes) => {
  res.statusCode = proxyRes.statusCode;   // ← eklendi
  res.setHeader('Access-Control-Allow-Origin', '*');
  ...
```

Kapsam kontrolü: `proxyRequest()` sadece `/api/binance/futures/*` ve
`/api/binance/spot/*` route'larında kullanılıyor (grep ile doğrulandı,
başka proxy yolu bu fonksiyonu paylaşmıyor). Bu iki endpoint'i çağıran
tüm client kodları (`chart-data.js`, `market-data-store.js`,
`kom1-scanner.js`, `m1hammer-scanner.js`, `fr-tracker.js`,
`ls-data-store.js`, `symbol-alerts-store.js`) zaten `res.ok`/`res.status`
kontrolü yapıp hatayı düzgün ele alıyor (`throw`, `return []`, `return`) —
yani düzeltme sadece gizli kalmış bir hatayı görünür/doğru hâle getiriyor,
regresyon riski taşımıyor.

## Doğrulama (production, gerçek — Binance IP hâlâ banlıyken test edildi)

1. `curl -i` → artık gerçek `418` status kodu dönüyor (önceden 200'dü). ✅
2. Production frontend (`pintrade.mooo.com`) konsolu izlendi:
   - `[BinanceAPI] exchangeInfo HTTP 418` (artık doğru status görünüyor)
   - `[BotEngine] ⛔ Kuyruk duraklatıldı — ban/rate-limit sinyali (BAN_SIGNAL_418)`
   - `[Kom1Scanner] ⛔⛔⛔ BAN/RATE-LIMIT sinyali (BAN_SIGNAL_418) — backfill DURDURULDU` → `[Kom1Scanner] Durduruldu.`
   - `[M1Hammer] ⛔⛔⛔ BAN/RATE-LIMIT sinyali (BAN_SIGNAL_418) — backfill DURDURULDU` → `[M1Hammer] Durduruldu.`
   - Önceki `kl.map is not a function` çökmesi bir daha görülmedi. ✅

Sistem artık hem normal hem ban durumunda doğru/güvenli davranıyor. Ancak
**Binance IP banı kendisi Binance tarafında, koddan bağımsız** — yaklaşık
2026-08-11 ~07:13 UTC'ye kadar sürecek (curl ile doğrulanan `banned until`
zaman damgasından). Ban geçene kadar Kom1Scanner/M1Hammer gerçek backfill
yapamayacak, dolayısıyla gerçek/canlı sinyal üretimi de ban sonrasına kalıyor.

## Değişen dosyalar

- `server.js`
