# Backtest Pipeline Format Analizi ve MongoDB Şema Önerisi

_Tarih: 2026-08-07_
_Kaynak pipeline: `D:\_Egitim ve Gelistirme\Crypto\piyasa-rehberi\backtest-sistemi`_
_Amaç: `coklu-coin-raporu.md` çıktısının Pintrade (MongoDB) veritabanına nasıl haritalanabileceğine dair ön öneri. Henüz kod yazılmadı — sadece format analizi ve şema tasarımı._

---

## 1. Kaynak Veri (coin_data/{SYMBOL}.db — SQLite)

Her coin için ayrı SQLite dosyası, tablolar:

- `klines_5m / klines_1h / klines_4h / klines_1d`
  Kolonlar: `open_time (PK, epoch ms), open, high, low, close, volume, close_time, quote_volume, trade_count, taker_buy_base, taker_buy_quote`
- `metrics`
  Kolonlar: `create_time (PK, epoch ms), symbol, sum_open_interest, sum_open_interest_value, count_toptrader_long_short_ratio, sum_toptrader_long_short_ratio, count_long_short_ratio, sum_taker_long_short_vol_ratio`
  (5 dakikalık çözünürlük, son 60 gün)
- `downloaded_days`
  Kolonlar: `type, day` — hangi (veri tipi, gün) çiftlerinin indirildiğinin defteri (resume/idempotency için)

## 2. Sinyal Üretim Mantığı (sinyal.py)

**Kombinasyon 1 ("sakin/ideal" grup):**
- Büyük TF'de (1h veya 4h): fiyat regression-channel orta bandının altında/eşit + WaveTrend önceki barda oversold, şu barda cross-up
- 5m'de: Heikin-Ashi mumu yeşil (`ha_close >= ha_open`) ve `ha_close > dema9`
- Büyük TF sinyalinden sonra `TOLERANCE_BARS` (=3) büyük TF barı içinde 5m koşulu gerçekleşirse → LONG sinyali
- Çıktı alanları: `timestamp, price, big_tf_ts, big_tf, ha_close, dema9, wt1_big`

**Kombinasyon 2 ("sert" grup, sadece ATR14/fiyat ≥ %12 coinlere uygulanır):**
- Aynı 1H barda: RSI/fiyat bullish divergence (lookback=30 bar) + (TopTrader L/S oranı düşüyor VEYA Global L/S < 1.0) + hacim artışı (güncel > 20-bar ortalama)
- Combo label: `div+ls+vol` (metrics mevcutsa) veya `div+vol` (metrics yoksa)

## 3. coklu-coin-raporu.md — Bölüm Yapısı

1. **Coin Başına Backtest Sonuçları** — her coin × TF(1h/4h) satırı: sinyal sayısı, +1h/+4h/+1d ufuklarında pozitif oran, medyan brüt/net getiri (maliyet %0.14 düşülmüş), <10 sinyal ise ⚠️ düşük örneklem uyarısı
2. **Piyasa Profili Karşılaştırması** — coin başına: ort. günlük hacim (M$), volatilite (ATR14/fiyat %), ort. OI (M$)
3. **Kanal Karşılaştırması** — manuel çizilen kanal olayları (tarih, fiyat, not) ile en yakın sinyalin eşleştirilmesi (±72 saat pencere), pencere dışıysa etiketlenir
4. **Havuzlanmış İstatistik** — düşük örneklem hariç, tüm coinler toplamında ufuk başına poz. oran / medyan / ortalama getiri
5. **Özet Yorum** — ufuk seçimi önerisi (+1h/+4h önerilir, +1d önerilmez) + coin×TF ranklama tablosu (4h medyan net getiriye göre sıralı)
6. **Volatilite Grupları** — hareketsiz (<%3) / ideal (%3–12) / sert (≥%12) sınıflandırması + grup başına havuzlanmış istatistik
7. **Kombinasyon 2 — Sert Coin Sinyali** — sadece sert gruba uygulanan coinler, coin başına satır + havuzlanmış istatistik + Kombinasyon 1 vs 2 karşılaştırması
8. **Kombinasyon 2 Varyant Testleri** — RSI seviye filtresi, divergence sonrası tepki hızı, divergence büyüklüğü, hacim eşiği kırılımları + örnek coin (BANK) için sinyal-satırı detay tablosu

## 4. Pintrade Mevcut MongoDB Şeması (server.js)

Mevcut koleksiyonlar (hepsi canlı/kısa ömürlü veri amaçlı):

- `Drawing` — çizim senkronu (kalıcı)
- `MarketData` — FR/OI/hacim, 48 saat TTL
- `FRSignal` — FR sinyalleri, 7 gün TTL
- `Candle` — mum verisi (indikatörler için)

Bunlar backtest pipeline'ının **kalıcı, geriye dönük analiz** amacıyla örtüşmüyor — TTL'li ve canlı veri toplama için tasarlanmışlar. Bu yüzden aşağıda ayrı, yeni koleksiyonlar öneriliyor.

## 5. Önerilen Yeni MongoDB Koleksiyonları (ön taslak)

| Koleksiyon | Amaç | Anahtar Alanlar |
|---|---|---|
| `BacktestSignal` | Ham sinyal listesi (rapor §7 BANK detay tablosunun tüm coinlere genellemesi) | `symbol, combo (1\|2), bigTf, timestamp, price, comboMeta {ha_close, dema9, wt1_big} veya {rsiAtDiv, priceDropPct, rsiGainPt, volMult, reactionBar}, returns: {h1:{gross,net}, h4:{...}, d1:{...}}` |
| `BacktestSummary` | Rapor §1/§7 — coin × TF × kombinasyon özet satırı | `symbol, combo, tf, signalCount, horizons:[{horizon, posRate, medianGross, medianNet, avgGross?, avgNet?}], lowSample: boolean` |
| `CoinProfile` | Rapor §2 — coin başına piyasa profili | `symbol, avgDailyVolumeUsd, atr14Pct, avgOpenInterestUsd, volatilityGroup (hareketsiz\|ideal\|sert), listingDate` |
| `PooledStats` | Rapor §4/§6 — havuzlanmış istatistikler | `scope (all\|volatilityGroup\|combo2), scopeValue, signalCount, horizons:[...]` |
| `ChannelEvent` (opsiyonel) | Rapor §3 — manuel kanal olayları + eşleşen sinyal | `symbol, channelDate, channelPrice, note, matchedSignalId, hourDiff, priceDiffPct` |
| `Variant2Result` (opsiyonel) | Rapor §8 — varyant kırılımları | `variant (A\|B\|C\|D), group, signalCount, horizons:[...]` |

## 6. Açık Noktalar (karar bekleyen)

- Rapor her çalıştırmada yeniden üretiliyor (`rapor_yenile.py`) — Mongo'ya **her çalıştırmada upsert mi**, yoksa **versiyonlu/append mi** (`generatedAt` alanıyla tarihsel karşılaştırma isteniyorsa)?
- `BacktestSignal` seviyesinde tüm ham sinyaller mi (7000+ satır/coin seti) tutulacak, yoksa sadece `BacktestSummary` yeterli mi? Ham sinyal, Pintrade tarafında alarm/watchlist entegrasyonu için gerekliyse tutulmalı.
- Ham `klines`/`metrics` verisi (`coin_data/*.db`) Mongo'ya taşınacak mı, yoksa SQLite pipeline tarafında kalıp sadece **türetilmiş sonuçlar** mı senkronlanacak? (Veri boyutu nedeniyle ikinci seçenek öneriliyor.)

---

_Bu belge henüz kod içermez; alarm sekmesi / watchlist entegrasyon kararları netleştikten sonra şema kesinleştirilecek._
