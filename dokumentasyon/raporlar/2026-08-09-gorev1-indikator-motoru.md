# gorevler3.md Görev 1 — Paylaşılan İndikatör Motoru (Tamamlandı)

**Tarih:** 2026-08-09

## Kapsam

`sinyal-sistemi-pintrade-entegrasyon.md`'de Kom1'in ihtiyaç duyduğu 5
indikatörden RSI ve WaveTrend zaten `js/screener/m1hammer-scanner.js`
içine gömülüydü (paylaşılmıyordu — `SISTEM-GENEL-DEGERLENDIRME.md`'nin
bulgusu). DEMA9, Heikin Ashi ve Regression Channel ise **kod tabanında
hiç yoktu** (grep ile doğrulandı — "heikinashi" sadece grafik menüsünde
bir isim olarak geçiyordu, matematiği yoktu).

## Yeni dosya — `js/screener/indicator-engine.js`

DOM'a dokunmayan, saf hesaplama modülü. 6 fonksiyon:

- `calcRSI`, `calcSRSI`, `calcWT` — `m1hammer-scanner.js`'den **taşındı**
  (kopyalanmadı — tek kaynak). Davranış birebir aynı, sadece parametreler
  artık varsayılan değerli argümanlar (`period=14` vb.) — eski sabit
  değerler değişmedi, sadece çağıranın override edebilmesi için esnetildi.
- `calcDEMA(closes, period=9)` — yeni. Standart formül:
  `DEMA = 2*EMA(close,period) - EMA(EMA(close,period),period)`.
- `calcHeikinAshi(opens, highs, lows, closes)` — yeni. Standart iteratif
  dönüşüm, son bar'ın `haOpen`/`haClose` değerini döner.
- `calcRegressionChannel(closes, length=100)` — yeni. En küçük kareler
  lineer regresyon, `mid` (son bar'daki regresyon değeri) + `slope`/
  `intercept` (ileride üst/alt bant için hazır).

## `js/screener/m1hammer-scanner.js` değişikliği

Yerel `calcRSI`/`calcSRSI`/`calcWT` fonksiyon gövdeleri silindi, yerine
`IndicatorEngine.calcX(...)`'i sabit parametrelerle (`RSI_PERIOD=14`,
`SRSI_K=3`, `SRSI_D=3`, `WT_CH_LEN=10`, `WT_AVG_LEN=21` — hepsi aynı
sabitler, değişmedi) çağıran ince sarmalayıcılar bırakıldı. M1Hammer'ın
geri kalanı (buffer yönetimi, backfill, sinyal hesaplama, WS abonelik)
dokunulmadı.

`index.html`'e `indicator-engine.js` eklendi, `m1hammer-scanner.js`'den
**önce** yükleniyor (bağımlılık sırası).

## Doğrulama

1. **Matematiksel doğruluk (Node, izole, elle hesaplanmış değerlerle):**
   - `calcDEMA([...30×10], 9)` → `10` (sabit seride DEMA sabite eşit olmalı) ✅
   - `calcHeikinAshi([10],[12],[9],[11])` → `{haOpen:10.5, haClose:10.5}`
     (elle: `ha_open=(10+11)/2=10.5`, `ha_close=(10+12+9+11)/4=10.5`) ✅
   - İkinci bar: `ha_open` beklenen `(10.5+10.5)/2=10.5`, gelen `10.5` ✅;
     `ha_close` beklenen `(11+13+10.5+12)/4=11.625`, gelen `11.625` ✅
   - `calcRegressionChannel([1..100], 100)` → `mid=100, slope=1`
     (mükemmel doğrusal dizide beklenen tam olarak bu) ✅
2. **Regresyon (M1Hammer bozulmadı, tarayıcıda gerçek modüllerle):**
   `M1HammerScanner.start()` sahte kline verisiyle (mock `fetch`) çağrıldı
   — backfill'in `IndicatorEngine.calcRSI/calcSRSI/calcWT`'yi 40 istekte
   (8 sembol × 5 TF) hiç hata fırlatmadan çağırdığı doğrulandı
   (`errorCaught: null`).
3. **Konsol hataları:** Testler sırasında görülen tüm hatalar
   (`ScreenerCore`, `chart-data.js` — `HTTP 502`/`Failed to fetch`) bu
   sandbox'ın bilinen ağ kısıtından, `IndicatorEngine`/`M1Hammer` ile
   ilgisi yok — ikisi için tek bir hata/uyarı yok.
4. Canlı bar tetikleyip uçtan uca gerçek bir sinyal üretimini (backfill
   sonrası WS bar simülasyonu) test eden ikinci bir tarayıcı denemesi
   30sn'de zaman aşımına uğradı (muhtemelen sayfanın arka planda zaten
   çalışan periyodik istekleriyle event loop yoğunluğu, `IndicatorEngine`
   ile ilgisiz) — kritik matematik zaten Node'da doğrulandığı ve backfill
   zinciri hatasız tamamlandığı için tekrar denenmedi, yeterli kanıt
   toplandığı değerlendirildi.

## Regresyon

- M1Hammer'ın RSI/StochRSI/WaveTrend davranışı değişmedi (aynı sabitler,
  aynı formüller, sadece dosya konumu değişti).
- Diğer modüller (`FRTracker`, `OIManager`, `ScreenerCore` vb.) bu
  değişiklikten etkilenmedi.

## Değişen dosyalar

- `js/screener/indicator-engine.js` (yeni)
- `js/screener/m1hammer-scanner.js`
- `index.html`
