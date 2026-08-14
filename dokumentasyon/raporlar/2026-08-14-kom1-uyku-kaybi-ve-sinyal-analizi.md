# Kom1 — Sunucu Uyku Kaybı Tespiti ve Kaçırılan Sinyal Analizi — 2026-08-14

**Bağlam:** Kullanıcı, günlük 11:00 (UTC+5) zamanlanmış Kom1 kontrolünün durumunu ve
o zamana kadar ne kadar veri/sinyal biriktiğini sordu. İnceleme sırasında production
sunucusunun beklenmedik şekilde uykuda olduğu ve bunun sonucunda ciddi miktarda
sinyalin kaçırılmış olabileceği bulundu.

## 1. Günlük 11:00 kontrolü — sunucuda değil, Claude Code görevi

`server.js`'de cron/node-cron/scheduleJob araması yapıldı, `render.yaml` da yok —
sunucu tarafında zamanlanmış bir mekanizma kodda hiç bulunmuyor. `gorevler3.md`'de
geçen `kom1-daily-signal-check`, önceki bir oturumda kurulmuş bir **Claude Code
zamanlanmış görevi**ydi (rapor metnindeki "yerel saatte çalıştı" ifadesi bunu
doğruluyor). Bu oturumda `list_scheduled_tasks` çağrıldığında **liste boş** döndü —
görev muhtemelen makine/oturum değişiminde kaybolmuş. Henüz yeniden kurulmadı.

## 2. Sunucu uyku bulgusu

İlk `GET /api/kom1/status` çağrısında:
```json
{"pending":[],"universe":{"total":0,"tier1":0,"tier2":0,"tier3":0,"lastRefreshedAt":null}}
```
ve `GET /health` → `uptime: 13.69` saniye — sunucunun az önce (muhtemelen benim
isteğimle) uyandığını gösteriyor. Render'ın ücretsiz katmanı, inaktiflikte sunucuyu
uykuya alıyor; bu süre boyunca Kom1ServerWatcher'ın `tick()`'i hiç çalışmıyor,
dolayısıyla ne evren yenileniyor ne de sinyal taranıyor.

8 saniye sonra tekrar kontrol edildiğinde evren doldu:
```json
{"universe":{"total":527,"tier1":100,"tier2":200,"tier3":227,"lastRefreshedAt":1786692150631}}
```
(`lastRefreshedAt` = 2026-08-14T07:22:30Z — yani sunucu bugün sabaha kadar uykudaydı.)

`GET /api/kom1/signals?limit=200` production'daki tüm kayıtlı sinyalleri döndürdü:
**toplam 16 sinyal**, en yenisi **2026-08-12T13:12:30Z** (INUSDT). Yani production'da
son ~44 saattir hiç yeni kesinleşmiş sinyal yok.

## 3. Geriye dönük "replay" ile doğrulama

Tek seferlik, lokal bir Node script'i (`kom1-backfill-check.js`, production'a
dokunmadan sadece Binance'ten geçmiş kline okuyor) yazıldı. Script, `kom1-server-watcher.js`
ile **aynı `IndicatorEngine` fonksiyonlarını ve aynı kuralı** (RC 100-bar + WT eşik
-53 + bull cross → 1h/4h; sonrasında 5dk HA+DEMA9 onayı, TOLERANCE_BARS=3 eşdeğeri
duvar-saati) kullanarak, tier1+tier2 kapsamındaki (~300 sembol, hacme göre en yüksek/
orta) geçmiş 1h/4h/5m mumlarını 2026-08-12T13:12:30Z'den (son bilinen kayıt)
bugüne kadar bar-bar tarayıp aynı koşulları kontrol etti.

**Sonuç: 112 ek kesinleşmiş sinyal bulundu** — production'daki 16'nın **7 katından
fazlası**, hepsi sunucunun uyuduğu pencerede (2026-08-12 15:34 UTC → 2026-08-14
07:39 UTC).

**Metodolojik not:** Bu script, canlı motorun "aynı sembol+TF için bir sinyal
beklerken ikincisini ateşleme" (`_pending.has(key)` guard) kuralını tam
uygulamıyor — basitleştirilmiş bir replay. Bu yüzden art arda gelen bazı
aynı-sembol tekrarları gerçek sistemde biraz daha az sayıda olabilirdi. Ayrıca
tarama sadece tier1+tier2'yi (300/527 sembol) kapsadı, tier3 dahil değil — gerçek
kayıp muhtemelen daha da yüksek. Yine de onlarca sinyalin kaçırıldığı kesin.

## 4. Kaçırılan sinyallerin dağılımı

- TF: 69 × 1h, 43 × 4h.
- 80 farklı sembol, 24 sembol birden fazla kez tetiklenmiş.
- Tekrarlar arası süre 1.9–30 saat — 2026-08-12 gözleminde görülen TUSDT
  "whipsaw" (dakikalar içinde defalarca tetiklenme) örüntüsünden farklı, daha
  makul/ayrık tetiklenmeler.
- RC_mid'e göre iskonto: medyan %4.9 (tipik "hafif geri çekilme"), ama 9 sinyal
  %15'in üzerinde iskontoyla geldi (en yükseği EPICUSDT %49.2).

## 5. Şüpheli grup (>%15 iskonto) — sinyal sonrası fiyat kontrolü

| Sembol | TF | Giriş sonrası en yüksek | en düşük | şu an (rapor anı) | Değerlendirme |
|---|---|---|---|---|---|
| EPICUSDT | 4h | +14.1% | -0.1% | +0.6% | ✅ iyi |
| USUSDT | 4h | +46.4% | -12.6% | -6.1% | ⚠️ çok oynak |
| BICOUSDT | 4h | +3.7% | -15.0% | -10.5% | ❌ kötü |
| HEIUSDT | 4h | +4.1% | -2.2% | +0.5% | 🟡 nötr |
| SKYAIUSDT | 4h | +5.7% | -7.9% | -7.3% | ❌ kötü |
| MOVRUSDT | 4h | +7.3% | -8.0% | -7.4% | ❌ kötü |
| CYSUSDT | 1h | +23.4% | -3.9% | +3.7% | ✅ iyi (henüz sadece 2sa) |
| BSBUSDT | 4h | +4.3% | -0.2% | +1.7% | ✅ iyi |
| KAITOUSDT | 1h | +9.8% | -9.4% | -6.6% | ❌ kötü |

**4/9 (BICOUSDT, SKYAIUSDT, MOVRUSDT, KAITOUSDT) sinyal sonrası dönmek yerine
düşmeye devam etti** — yani "dipten dönüş" değil, trendi kırılmış bir coin'de
aşırı-satım göstergesinin yanıltıcı sinyali. 3/9 hafif pozitif/nötr, USUSDT çok
oynak (önce +%46, sonra geri düşüş — muhtemelen haber/likidasyon kaynaklı), CYSUSDT
henüz erken ama pozitif.

**Çıkarım:** Büyük RC iskontosu (>%15) güçlü bir alım sinyali değil, tam tersine
kural açısından bir risk göstergesi. İleride (kullanıcı parametre değişikliğine
açık onay verirse) basit bir "iskonto tavanı" filtresi bu 4 kötü sinyali elerken
iyi olanları (EPICUSDT, CYSUSDT gibi) etkilemezdi. **Bu turda hiçbir parametre
değiştirilmedi** — gorevler3.md'nin "sabit kodda, sabit değer" kararına sadık
kalındı, bu sadece bir gözlem/bulgu.

## 6. Sonraki adım

Bu bulgu, `gorevler3.md` Görev 7'nin (sunucu taraflı sürekli izleme + Telegram
bildirimi) gerekliliğini somut sayılarla doğruladı — Render'ın ücretsiz katmanının
uyku döngüsü, sistemin asıl amacını (kesintisiz sinyal takibi) fiilen engelliyor.
Kullanıcı onayıyla Görev 7'ye geçildi (bu rapordan hemen sonra).

**Ayrıca açık kalan, henüz çözülmeyen:** Günlük 11:00 (UTC+5) Claude Code
zamanlanmış görevi (`kom1-daily-signal-check`) şu an sistemde kayıtlı değil,
yeniden kurulması gerekiyor (bu sunucu uyku sorununu çözmez, sadece günlük rapor
sağlar).

**Kullanılan/oluşturulan dosyalar (geçici, repoya dahil değil):**
- `kom1-backfill-check.js` — tek seferlik replay script'i (scratchpad'te, silinebilir)
- `check-suspicious.js` — 9 şüpheli sinyalin sonraki fiyat hareketini kontrol eden script (scratchpad'te, silinebilir)
