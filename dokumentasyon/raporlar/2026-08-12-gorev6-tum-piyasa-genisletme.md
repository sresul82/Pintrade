# gorevler3.md Görev 6 — Tüm Piyasaya Genişletme (İmplementasyon Tamamlandı)

**Tarih:** 2026-08-12

## Kapsam

Kullanıcı "Görev 6'ya geç" onayı verdikten sonra, Kom1'in sabit 11
coin'lik listesi yerine tüm Binance USDT perpetual evrenini (o an
~526 sembol) hacme göre 3 katmana bölüp rotasyonlu şekilde tarayan bir
sistem kuruldu.

## Kararlar (kullanıcıyla sırayla netleşti)

1. **Katman boyutları:** 100/200/200, hacme göre azalan sıralı.
2. **3. katman (düşük hacim):** dışarıda bırakılmadı, seyrek (3 saatte
   bir) taranıyor.
3. **Mimari:** tüm piyasa taraması `kom1-scanner.js`'e (tarayıcı,
   gerçek WebSocket) DEĞİL, `kom1-server-watcher.js`'e (sunucu,
   REST-only) eklendi — bu, gorevler3.md'nin en riskli olarak
   işaretlediği "200-stream limiti aşılırsa MarketDataStore'a
   çoklu-bağlantı desteği eklemek gerekebilir" riskini TAMAMEN ortadan
   kaldırdı, çünkü REST'in stream kavramı yok.

## Bilinçli kapsam sadeleştirmesi

Orijinal tasarımın ATR14/fiyat %3-12 "sakin grup" filtresi (volatiliteye
göre eleme) bu turda **uygulanmadı**. Bunun yerine sadece hacme göre
tarama SIKLIĞI rotasyonu kuruldu — evrendeki her sembol er ya da geç
taranıyor, sadece sıklığı değişiyor. Büyük TF kuralı (RC+WT) zaten
doğası gereği aşırı volatil coinlerde nadiren tetiklendiği için bu
sadeleştirme mantıksız sinyal riski yaratmıyor, ama gözden kaçmış bir
eksiklik değil, bilinçli bir karar — ileride ayrı bir ince ayar olarak
eklenebilir.

## Yapılanlar

### `js/screener/kom1-server-watcher.js`

- `_refreshUniverse()` — exchangeInfo (TRADING+PERPETUAL+USDT filtresi)
  + toplu 24hr ticker (hacim) çekip hacme göre azalan sıralayıp 3
  katmana bölüyor. Saatte bir yenileniyor (`UNIVERSE_REFRESH_MS`).
  Var olan `lastScannedAt` değerleri (rotasyon durumu) korunuyor,
  sadece tier/hacim güncelleniyor.
- `_dueSymbols()` — o an katman aralığı (15dk/35dk/3sa) dolmuş
  sembolleri döner. `tick()` artık sadece BUNLARI büyük TF için
  kontrol ediyor.
- Küçük TF (5dk) onay taraması artık SADECE gerçekten `_pending`'de
  kaydı olan sembollere daralttı — önceden sabit 11 sembolün hepsi
  her turda taranırdı, 500 sembolde bu israf olurdu.
- `_ticking` reentrancy kilidi — ilk turda ~500 sembolün tamamı aynı
  anda "sırası gelmiş" sayılabileceği için (tüm `lastScannedAt=0`),
  ilk tur normalden uzun sürebilir; bu, 5dk'lık periyodik tetiklemeyle
  üst üste binmesin diye eklendi.
- `loadScanState()`/`getScanStateForPersist()` — modül DB-agnostic
  kalıyor (mevcut mimariyle tutarlı), kalıcılığı server.js'e devrediyor.
  `getScanStateForPersist()` sadece DEĞİŞEN kayıtları döner (dirty-tracking)
  — her tick'te 500 kaydın tamamını yazmak gereksiz DB yükü olurdu.
- Eski sabit `SYMBOLS`/`BIG_TFS` export'ları kaldırıldı (artık anlamsız,
  liste dinamik) — `getUniverseSummary()` ile değiştirildi.

### `server.js`

- Yeni `Kom1ScanState` şeması (symbol unique index, TTL yok — canlı
  durum tablosu, geçmiş kayıt değil).
- Açılışta `Kom1ScanState.find()` ile önceki rotasyon durumu yükleniyor.
- Her tick sonrası `getScanStateForPersist()`'in döndürdüğü (sadece
  değişen) kayıtlar `bulkWrite` upsert ile geri yazılıyor.
- `/api/kom1/status` artık `{ pending, universe: {total, tier1, tier2,
  tier3, lastRefreshedAt} }` döndürüyor.

### `kom1-daily-signal-check` (zamanlanmış görev)

Eski "10 sinyale ulaşınca Görev 5'i tamamla, Görev 6'ya geçme" mantığı
kaldırıldı (Görev 5 zaten 2026-08-12'de kapandı). Artık günlük olarak
yeni sinyalleri VE `universe` durumunu (toplam sembol, katman dağılımı,
son evren yenilenme zamanı) raporluyor; ban/erişilemezlik veya
`universe.total`'ın anormal düşük olması durumunda kullanıcıyı hemen
uyarıyor.

## Doğrulama

**Sandbox'ta (ağ erişimi yok — bilinen kısıt):** Katman ataması/sıralama
mantığı taklit edilmiş Binance yanıtlarıyla doğrulandı (geçersiz
semboller doğru elendi, hacme göre sıralama doğru). Ağ hatası
durumunda önceki listeye düşme, boş `due` listesinde sıfır REST
çağrısı, reentrancy kilidi, dirty-tracking — hepsi sentetik testlerle
doğrulandı. `node -c` ile sözdizimi doğrulandı.

**Production'da (deploy sonrası, devam eden gözlem):** Gerçek Binance
verisiyle `universe.total`'ın ~500 civarında olup olmadığı, katman
dağılımının mantıklı olup olmadığı (tier1=100, tier2=200, tier3=kalan),
ve ban sinyali olup olmadığı izlenecek — `kom1-daily-signal-check`
görevi ve kullanıcı gözlemiyle.

**İlk canlı doğrulama anlık görüntüsü (2026-08-12, ~18:03 UTC):**
```json
{"pending":[{"symbol":"BIOUSDT","bigTf":"1h","rcMid":0.02550,"wtVal":-64,"wtPrev":-66,...}],
 "universe":{"total":527,"tier1":100,"tier2":200,"tier3":227,"lastRefreshedAt":1786539814211}}
```
— `universe.total=527` gerçek Binance USDT perpetual sayısıyla birebir
eşleşti, katman toplamı doğru (100+200+227=527), sistem deploy
edildikten kısa süre sonra gerçek bir büyük TF sinyali (BIOUSDT 1h)
yakaladı, 5dk onay penceresi açtı. `/api/binance/futures` proxy'si
200 dönmeye devam etti (ban YOK).

## ⚠️ Bulunan ve düzeltilen ek risk (aynı gün, kullanıcının sorusu üzerine)

Kullanıcı "sitede coin açıp rahatça analiz yapabilecek miyim, bu bana
sebep olur mu" diye sordu. Araştırırken şu bulundu: kullanıcının
TARAYICI istekleri de (`js/core/app-config.js` → `/api/binance/futures/*`
proxy'si, `server.js:941`) arka plan toplayıcılarıyla AYNI sunucu/IP'yi
paylaşıyor — bu, 2026-08-08'deki 11 saatlik ban olayıyla aynı sınıf
risk. Somut çakışma: `collectBinanceCandles` (en ağır toplayıcı, ~527
sembol, sunucu açılışından 15sn sonra başlayıp ~31sn'de bitiyor) ile
Kom1'in taraması (eskiden 25sn'de başlıyordu, Görev 6 sonrası artık o
da yüzlerce sembolü kapsıyor) ~6 saniyelik bir pencerede ÇAKIŞIYORDU.

**Düzeltme:** Kom1'in `_staggeredStart` gecikmesi `server.js`'te
25000ms'den 40000ms'ye çıkarıldı — artık mum toplayıcısı bittikten
(~31sn) sonra, güvenli bir marjla (9sn) başlıyor. Ayrı commit
(`fb9056c`) ile deploy edildi, production'da doğrulandı (proxy hâlâ
200, uptime kesintisiz).

## Bilinen sınırlar

- ATR14 volatilite filtresi yok (yukarıda açıklandı, bilinçli).
- Sunucu gözlemcisi hâlâ "yaklaşık" (REST anlık görüntüleri,
  TOLERANCE_BARS duvar-saatine çevrilmiş) — tarayıcı motoruyla
  birebir aynı anda sinyal üretmeyebilir, bu Görev 5'ten beri bilinen
  bir fark.
- İlk tur (sunucu her yeniden başladığında değil, sadece HİÇ
  `Kom1ScanState` kaydı yokken) ~500 sembolü aynı anda taramaya
  çalışabilir (~2dk sürebilir) — reentrancy kilidiyle güvenli ama
  yavaş bir başlangıç.

## Değişen/yeni dosyalar

- `js/screener/kom1-server-watcher.js` (büyük ölçüde yeniden yazıldı)
- `server.js` (`Kom1ScanState` şeması, açılış yükleme, tick-sonrası
  kalıcılık, `/api/kom1/status` güncellendi, `_staggeredStart`
  gecikmesi 25s→40s)

## Sonraki oturum için — nereden devam edilecek

Bu görev **kapanmadı**, `[~]` (gözlem sürüyor) durumunda. Farklı bir
bilgisayardan/oturumdan devam edecek biri (insan veya Claude Code)
şunları bilmeli:

1. **Implementasyon TAMAMLANDI ve production'da çalışıyor** — kod
   tarafında yapılacak bir şey YOK, sadece GÖZLEM aşamasındayız.
2. Kontrol için: `GET /api/kom1/status` (`universe` + `pending`),
   `GET /api/kom1/signals` (kesinleşmiş sinyaller), `GET /health`.
   `kom1-daily-signal-check` zamanlanmış görevi her gün 11:00'de bunu
   otomatik yapıp rapor ediyor — önce onun çıktısına bakılabilir.
3. **Beklenen davranış:** `universe.total` her zaman ~500-530 civarı
   olmalı (o anki gerçek Binance USDT perpetual sayısı), `tier1=100`
   sabit, `tier2=200` sabit, `tier3`=kalan. `lastRefreshedAt` saatte
   bir güncellenmelidir — eğer saatler/günlerdir aynı zaman damgasında
   donmuşsa, evren yenileme sürekli başarısız oluyor demektir (ağ
   hatası vb.) — araştırılmalı.
4. **Henüz doğrulanmamış:** tier3'ün (en düşük hacimli ~227 sembol,
   3 saatte bir taranıyor) gerçekten rotasyona girip girmediği — bunun
   için en az 3 saatlik bir gözlem penceresi gerekiyor, implementasyon
   günü bu kadar uzun sürmedi. `Kom1ScanState` koleksiyonunda tier=3
   olan kayıtların `lastScannedAt` alanlarının zamanla ilerleyip
   ilerlemediği kontrol edilerek doğrulanabilir.
5. **Bilinçli eksik:** ATR14 volatilite filtresi (orijinal tasarımın
   parçasıydı) uygulanmadı — sadece hacim-bazlı SIKLIK rotasyonu var.
   Kullanıcı bunu net onaylamadı, sadece bilgilendirildi. İleride
   sorulabilir/eklenebilir.
6. **Genel mimari not:** `.claude/CLAUDE.md`'deki "bot-architecture"
   bölümüne bu görev sırasında bulunan önemli bir gerçek eklendi —
   kullanıcının kendi tarayıcı istekleri de arka plan toplayıcılarıyla
   aynı IP'yi paylaşıyor, izole bir "sadece botlar" bütçesi yok. Yeni
   bir toplayıcı/bot eklerken bu MUTLAKA göz önünde bulundurulmalı
   (zamanlama çakışması → ban → kullanıcının kendi site kullanımı da
   etkilenir).
