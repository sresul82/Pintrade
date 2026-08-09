# Sıradaki Görevler 3 — Kom1 Sinyal Motoru (Pintrade)

**Amaç:** Kullanıcı yokken (uyurken / limit dolu) Claude Code'un sırayla
ilerlemesi için hazır iş kuyruğu. Önceki kuyruk (`gorevler2.md`) 2026-08-09'da
Görev 10'a kadar tamamlandı, Görev 9 (güvenlik) ertelendi.

**Kaynak:** Bu kuyruk, `dokumentasyon/gorevler/sinyal-sistemi-pintrade-entegrasyon.md`'deki
Kombinasyon 1 kuralına dayanıyor. O dosyayı önce oku — burada sadece
uygulama adımları var, strateji gerekçesi orada.

## Kullanım (Claude Code için)

1. Bu dosyayı oku, önce `sinyal-sistemi-pintrade-entegrasyon.md`'yi de oku.
2. **Sırayla, yukarıdan aşağıya** ilerle. Bir görev bitmeden diğerine geçme.
3. Her görev bittiğinde: `[ ]` → `[x]`, rapor dosyasını "Rapor:" satırına yaz, sonraki göreve geç.
4. **Kritik hata çıkarsa DUR** — "⚠️ DURDU — sebep: ..." yaz, bekle.
5. **"⏸ DUR" yazan görevlerden ÖNCE DUR.** Kullanıcı açıkça "Görev N'e geç" demeden geçme.
6. **Bu kuyruk gerçek trading sinyalleri üretecek — normal bug-fix işlerinden daha yüksek risk taşır.** Şüpheye düşersen DUR ve sor, tahmin yürütme.

Her rapor için standart format: değişen dosyalar, ölçümler, doğrulama testleri, varsa regresyon uyarıları.

---

## 2026-08-09 kararları — seçilen VE seçilmeyen alternatifler

Her karar noktasında kullanıcıyla birlikte bir seçenek seçildi, diğerleri
**reddedilmedi — sadece şimdilik ertelendi.** İleride bu kuyruğa dönen
(insan veya Claude Code) kişi neyin neden seçilmediğini bilsin diye
buraya açıkça yazıldı. Kod, burada "Seçilen" yazan tarafa göre yazılacak.

| Karar noktası | ✅ Seçilen | ❌ Seçilmeyen (ileride değerlendirilebilir) |
|---|---|---|
| **Kom3 tanımı** | Henüz tanımlanmadı, bu kuyrukta hiç yok | Kullanıcının üçüncü bir strateji fikri paylaşıp Kom3'ü de bu turda tanımlaması |
| **Kom2 kapsamı** | Bu kuyrukta yok, sadece Kom1 | Kom2'yi bilinen zayıf/doğrulanmamış kuralla (divergence+L/S+hacim) yine de şimdi kurmak |
| **Kom1 parametreleri** (WT eşiği -53, RC 100 bar, TOLERANCE_BARS=3) | Sabit kodda, sabit değer | Bir ayar panelinden değiştirilebilir yapmak (örn. WT eşiğini -48 ile de denemek isterse) — **not:** kaynak doküman (`sinyal-sistemi-pintrade-entegrasyon.md` §9) aslında bunun yapılandırılabilir olmasını öneriyordu, kullanıcı şimdilik hız için sabit kodu tercih etti |
| **Coin evreni** | Küçük, sabit 11 coin (ONDO/STRK/ENA/BIO/JUP/T/AEVO/MOVE/VANRY/BERA/HYPE) | Tüm Binance USDT perpetual'ları dinamik ATR14/fiyat (%3-12) filtresiyle taramak — kaynak dokümanın **orijinal tasarımı buydu**, ama MarketDataStore'un 200-stream/bağlantı sınırı + ban riski nedeniyle Görev 6'ya (ayrı, en riskli adım) ertelendi |
| **Tarama mimarisi** | Önce küçük sabit kümede dene, ban riski yokluğu doğrulanınca genişlet (M1Hammer'ın izlediği yol) | İki katmanlı taramayı (hafif ATR REST taraması + hedefli WS) baştan, büyük ölçekte kurmak |
| **Borsa** | Sadece Binance FUTURES | Bybit'i de dahil etmek (L/S görevinde Bybit faz 2 olarak zaten eklenmişti, ama Kom1'in backtest verisi tamamen Binance'e dayanıyor — Bybit'te aynı kuralların işleyip işlemediği hiç test edilmedi) |
| **Büyük TF** | Hem 1H hem 4H, ikisi de bağımsız sinyal üretir | Sadece tek bir TF (örn. sadece 4H, "en güçlü" ufuk olduğu için — backtest'te +4h en yüksek net getiriyi verdi) |
| **İş bölümü** | `gorevler3.md` olarak 6 küçük adıma bölündü, DUR noktalarıyla | Planlamadan direkt tek seferde kodlamaya başlamak |

---

## [ ] Görev 1 — Paylaşılan indikatör motoru (DEMA9, Heikin Ashi, Regression Channel)

**Sebep:** Kom1'in ihtiyaç duyduğu indikatörlerden RSI ve WaveTrend zaten var (`js/screener/m1hammer-scanner.js` içinde, `calcRSI`/`calcWT` — WT_CH_LEN=10, WT_AVG_LEN=21, Kom1'in beklediğiyle birebir uyumlu). Ama **DEMA9, Heikin Ashi ve Regression Channel kod tabanında hiç yok** (grep ile doğrulandı — "heikinashi" sadece grafik menüsünde bir isim olarak geçiyor, hesaplama yok).

### Yapılacak

- Yeni bir paylaşılan modül oluştur, örn. `js/screener/indicator-engine.js` (chart ve scanner'ın ikisinin de kullanabileceği, DOM'a dokunmayan saf hesaplama modülü — `SISTEM-GENEL-DEGERLENDIRME.md`'nin "indikatör matematiği paylaşılmıyor" bulgusuna göre).
- `calcRSI`/`calcWT`'yi `m1hammer-scanner.js`'den bu yeni modüle **taşı** (kopyalama değil — tek kaynak, iki yerden çağrılsın). M1Hammer'ın kendi davranışını BOZMA, sadece fonksiyonları oraya taşıyıp `IndicatorEngine.calcRSI(...)` gibi çağır.
- Yeni fonksiyonlar ekle:
  - `calcDEMA(closes, period=9)` — standart DEMA: `DEMA = 2*EMA(close,period) - EMA(EMA(close,period),period)`
  - `calcHeikinAshi(opens, highs, lows, closes)` — standart HA dönüşümü (`ha_close=(o+h+l+c)/4`, `ha_open=(prevHaOpen+prevHaClose)/2`, ilk bar için `ha_open=(o+c)/2`)
  - `calcRegressionChannel(closes, length=100)` — `length` barlık lineer regresyon, orta bandı (`RC_mid`) döndür (üst/alt bant da hesaplanabilir ama Kom1 sadece orta bandı kullanıyor)

### Doğrulama

- Bilinen bir veri setiyle (örn. TradingView'da aynı sembol/TF'de görsel karşılaştırma, veya elle hesaplanmış küçük bir örnek dizi) her yeni fonksiyonun doğru sonuç verdiğini doğrula — **bu adımda hata yaparsan tüm Kom1 motoru yanlış sinyal üretir**, özenli ol.
- M1Hammer'ın taşınan `calcRSI`/`calcWT` çağrılarının hâlâ aynı sonucu verdiğini doğrula (regresyon yok).
- `node -c` ile syntax kontrolü, tarayıcıda M1Hammer'ın hâlâ çalıştığını doğrula.

**Rapor:** `2026-XX-XX-gorev1-indikator-motoru.md`

---

## [ ] Görev 2 — Büyük TF sinyali (1H/4H: RC + WaveTrend)

**Bağımlılık:** Görev 1 bitmeden başlanamaz.

### Yapılacak

- Yeni bir `Kom1Scanner` modülü (örn. `js/screener/kom1-scanner.js`), M1Hammer'ın mimari örüntüsünü referans al (BotEngine backfill + MarketDataStore.subscribeKlines, kendi WS'ini açma).
- 11 coin × (1H + 4H) = 22 kline stream'e abone ol.
- Her yeni bar kapanışında: `price <= RC_mid` (100 bar RC) VE WT1 önceki bar `< -53` VE bu barda WT1 WT2'yi yukarı kesti mi kontrol et.
- Koşul sağlanırsa: coin+TF için "büyük TF sinyali ateşlendi, TOLERANCE_BARS=3 penceresi açık" durumunu bir Map'te tut (henüz alarm/watchlist'e yazma — o Görev 4'te).
- Konsola/basit bir test arayüzüne (örn. `window.Kom1Scanner.getPendingSignals()`) logla — bu turda sadece büyük TF tespiti doğru çalışıyor mu görmek yeterli.

### Doğrulama

- Gerçek piyasada en az bir coin+TF kombinasyonunda RC_mid ve WT değerlerini elle (örn. TradingView'da aynı ayarlarla) karşılaştır.
- Ban riski yok mu (BotEngine kuyruğu, MarketDataStore paylaşılan bağlantı) — konsolda BAN_SIGNAL var mı kontrol et.

**Rapor:** `2026-XX-XX-gorev2-buyuk-tf-sinyali.md`

---

## [ ] Görev 3 — 5 dakikalık onay penceresi (Heikin Ashi + DEMA9)

**Bağımlılık:** Görev 2 bitmeden başlanamaz.

### Yapılacak

- Görev 2'de "büyük TF sinyali ateşlendi" durumu olan coinler için, **sadece o an** 5dk kline stream'ine abone ol (kalıcı değil — TOLERANCE_BARS=3 büyük TF barı geçince veya onay gelince abonelikten çık, mimari notundaki "iki katmanlı tarama" prensibi).
- Her yeni 5dk bar kapanışında: `ha_close >= ha_open` VE `ha_close > dema9` kontrol et.
- Koşul sağlanırsa VE hâlâ TOLERANCE_BARS penceresi içindeyse → **Long sinyali kesinleşti**.
- Pencere (3 büyük TF barı) geçerse ve onay gelmezse, o coin+TF için bekleyen durumu temizle, 5dk aboneliğini kapat.

### Doğrulama

- Bekleyen durumun doğru şekilde açılıp kapandığını (abonelik sızıntısı yok) doğrula — `MarketDataStore.unsubscribeKlines` her durumda (onay geldi / pencere geçti) çağrılıyor mu kontrol et.
- En az bir uçtan uca test: büyük TF sinyali + 5dk onayının birlikte gerçek/mock veriyle doğru "Long sinyali" ürettiğini doğrula.

**Rapor:** `2026-XX-XX-gorev3-5dk-onay-penceresi.md`

---

## [ ] ⏸ DUR — kullanıcı onayı bekle (Görev 4'ten önce)

Görev 3 bittikten sonra **DURACAKSIN**. Görev 4, sinyali gerçekten Watchlist'e ve alarm sekmesine yazıyor — yani bu noktadan sonra kullanıcı gerçek (sahte olmayan) sinyal bildirimleri görmeye başlayacak. Kullanıcı "Görev 4'e geç" demeden başlama.

---

## [ ] Görev 4 — Watchlist Kom1 grubuna yazma + alarm bildirimi

**Bağımlılık:** Görev 3 bitmeden başlanamaz.

### Yapılacak

- Görev 3'te "Long sinyali kesinleşti" olan coin, `WatchlistStore`'un `kom1` grubuna eklensin (şu an `getSignalGroups()` `AlarmSignalHistory.getActiveSignals()`'tan besleniyor — bu demo veri kaynağı, gerçek Kom1Scanner çıktısıyla değiştirilmeli, ama **`alarm-signal-history.js`'nin Kom2/Kom3 demo kartlarına DOKUNMA** — sadece Kom1 gerçek veriyle beslenecek).
- Sinyal geldiğinde alarm sekmesinde bildirim ("Kom1 listesine BANKUSDT eklendi" tarzı — bkz. tasarım dokümanı Bölüm 5).
- Coin, sinyal aktif olduğu sürece listede kalsın (ne zaman "aktifliği" biter — örn. X saat sonra otomatik mi düşer, yoksa manuel mi temizlenir — belirsizse DUR ve kullanıcıya sor, tahmin yürütme).

### Doğrulama

- Gerçek bir sinyal (veya test amaçlı tetiklenmiş bir mock sinyal) Watchlist'in "Sinyaller" listesinde Kom1 grubunda görünüyor mu?
- Alarm sekmesinde bildirim çıkıyor mu?
- Kom2/Kom3 demo kartları hâlâ eskisi gibi (bozulmadı) mı?

**Rapor:** `2026-XX-XX-gorev4-watchlist-alarm-entegrasyonu.md`

---

## [ ] ⏸ DUR — kullanıcı onayı bekle (Görev 5'ten önce)

Görev 4 bittikten sonra **DURACAKSIN**. Sistem artık gerçek sinyal üretiyor — bir süre canlıda gözlemleyip (yanlış pozitif var mı, ban riski var mı) kullanıcı memnun kalmadan sonraki adıma geçme.

---

## [ ] Görev 5 — Canlı gözlem + ince ayar

**Bağımlılık:** Görev 4'ten sonra, kullanıcı onayıyla.

Kapsamı kullanıcıyla o an netleştirilecek — muhtemelen: birkaç gün canlı gözlem sonrası bulunan sorunlar (yanlış sinyaller, performans, ban riski) varsa düzeltme. Bu görev şablonu şimdiden detaylandırılmadı çünkü Görev 4 canlıya çıkmadan neyin düzeltileceği bilinemez.

**Rapor:** `2026-XX-XX-gorev5-ince-ayar.md`

---

## [ ] ⏸ DUR — kullanıcı onayı bekle (Görev 6'dan önce)

Bu, en riskli adım — kullanıcı açıkça onaylamadan **kesinlikle** başlama.

---

## [ ] Görev 6 — Tüm piyasaya genişletme (dinamik ATR taraması)

**Bağımlılık:** Görev 5'ten sonra, ban riskinin 11 coinlik kümede sorunsuz olduğu doğrulanmadan başlanmaz.

`sinyal-sistemi-pintrade-entegrasyon.md`'nin orijinal tasarımı: sabit coin listesi değil, tüm Binance USDT perpetual'ları tarayıp ATR14/fiyat oranı %3-12 arasına düşenleri otomatik "sakin" (Kom1 adayı) grubuna almak.

### Yapılacak (kullanıcı onayı sonrası detaylandırılacak)

- Hafif bir ATR14 REST taraması (BotEngine kuyruğu üzerinden, örn. her 15-30dk'da bir tüm sembollerin 1D ATR'ini hesapla) — "sakin" grubu belirle.
- Bu grup için Görev 2-3'teki büyük TF + 5dk onay mantığını uygula — ama artık ~500 sembolün tamamına değil, sadece o an "sakin" kategorisine düşen alt kümeye (muhtemelen 50-150 arası, piyasaya göre değişir).
- **Stream limiti riski:** MarketDataStore'un tek kline WS bağlantısı ~200 stream sınırlı. "Sakin" grup + TOLERANCE_BARS'taki 5dk onay bekleyenler toplamı bu sınırı aşarsa, MarketDataStore'a çoklu-bağlantı desteği eklemek gerekebilir — bu, ayrı bir alt görev olarak ele alınmalı, hafife alınmamalı.

### Doğrulama

- Ban sinyali yok mu (uzun süreli gözlem)?
- Stream sayısı 200 sınırının altında mı, üstündeyse nasıl yönetiliyor?

**Rapor:** `2026-XX-XX-gorev6-tum-piyasa-genisletme.md`

---

## Kuyrukta olmayan, kullanıcı ayrıca planlayacak

- **Kom2** — zayıf/doğrulanmamış (Varyant B'nin look-ahead bias'ı netleşmeden), ayrı bir tur.
- **Kom3** — hiç tanımlanmadı, kullanıcı tanımlayınca ayrı bir kuyruk.
- **Sinyal önerisi + geri ölçüm** (`gorevler2.md` Görev 6 ile aynı konu, oradan zaten biliniyor) — Kom1 canlıya çıkıp veri birikince ele alınacak.
- **Parametrelerin yapılandırılabilir hâle getirilmesi** (WT eşiği, RC uzunluğu vb.) — şimdilik sabit kodlanmasına karar verildi, ileride istenirse ayrı bir iş.
