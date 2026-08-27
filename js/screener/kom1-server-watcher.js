/**
 * Kom1ServerWatcher — sunucu taraflı "shadow" Kom1 sinyal gözlemcisi.
 *
 * gorevler3.md Görev 5 (2026-08-11, kullanıcı isteği): "tarayıcı kapalıyken
 * de yeni kesinleşen Kom1 sinyallerini görebileceğim bir mekanizma kur."
 *
 * ÖNEMLİ — bu, `js/screener/kom1-scanner.js`'in (tarayıcıda çalışan,
 * gerçek/asıl Kom1 motoru) YERİNİ TUTMAZ, onu DEĞİŞTİRMEZ:
 *   - kom1-scanner.js: canlı WS bar akışıyla, bar-sayacı bazlı TOLERANCE_BARS
 *     penceresiyle, olay-güdümlü (event-driven) çalışır — Watchlist/alarm
 *     entegrasyonunun kaynağı budur, asıl/yetkili motor budur. Sabit 11
 *     coin listesinde kaldı, DEĞİŞMEDİ (bkz. modülün kendi başlığı).
 *   - Bu modül: periyodik REST anlık görüntüleriyle (her 5 dakikada bir),
 *     AYNI kuralı (RC+WT büyük TF, HA+DEMA9 küçük TF onayı) yaklaşık olarak
 *     tekrar hesaplar. TOLERANCE_BARS burada bar-sayısı değil, eşdeğer
 *     duvar-saati süresine çevrilerek (1h→3saat, 4h→12saat) uygulanıyor —
 *     bu yüzden iki motorun ürettiği sinyaller birebir aynı ANDA gelmeyebilir,
 *     küçük bir gecikme/sapma normaldir. Aynı matematiği (IndicatorEngine)
 *     kullanır — iki farklı hesaplama yolu YOK.
 *
 * gorevler3.md Görev 6 (2026-08-12, kullanıcı onayıyla): sabit 11 coin
 * yerine TÜM Binance USDT perpetual evrenini (o an ~526 sembol) hacme göre
 * 3 katmana bölüp rotasyonlu tarıyor. REST-ONLY olduğu için (WebSocket
 * kullanmıyor) MarketDataStore'un ~200 stream sınırına HİÇ dokunmuyor —
 * bu yüzden "tüm piyasa taraması" bilinçli olarak burada, kom1-scanner.js'te
 * DEĞİL burada yapılıyor (bkz. gorevler3.md Görev 6, "Tarama tasarımı").
 *   - Katman 1 (en yüksek hacimli ~100 sembol): en geç 15dk'da bir taranır.
 *   - Katman 2 (sonraki ~200): en geç 35dk'da bir.
 *   - Katman 3 (kalan ~200, en düşük hacimli): en geç 3 saatte bir.
 *   Katman ataması 24 saatlik USDT hacmine göre, saatte bir yenilenir.
 *   Rotasyon durumu (`lastScannedAt` her sembol için) Mongo'da kalıcı
 *   tutulur (`Kom1ScanState`, server.js) — sunucu yeniden başlasa bile
 *   kaldığı yerden devam eder, hangi bilgisayardan bağlanılırsa bağlanılsın
 *   durum kaybolmaz.
 *   Bu modül kendisi Mongo'ya DOKUNMAZ (DB-agnostic kalması için) — kalıcılık
 *   `getScanStateForPersist()`/`loadScanState()` ile server.js'e devrediliyor,
 *   tıpkı sinyallerin `onConfirmed` callback'iyle devredilmesi gibi.
 *
 * Parametreler kom1-scanner.js ile BİREBİR aynı (gorevler3.md'nin başındaki
 * "sabit kodda, sabit değer" kararına sadık kalındı — WT eşiği, RC uzunluğu,
 * TOLERANCE_BARS bu turda da DEĞİŞMEDİ, sadece sembol evreni genişledi).
 *
 * Bulunan sinyaller `Kom1SignalLog` koleksiyonuna (30 gün TTL) yazılır,
 * `GET /api/kom1/signals` ve `GET /api/kom1/status` ile okunabilir.
 */
const https = require('https');
const IndicatorEngine = require('./indicator-engine.js');

const WT_THRESHOLD  = -53;
const RC_LENGTH      = 100;
const TOLERANCE_BARS = 3;
const SMALL_TF        = '5m';
const DEMA_PERIOD     = 9;
const SMALL_TF_BARS   = 40;
const BIG_TFS = ['1h', '4h'];
const BARS = RC_LENGTH + 30;

// ── ATR14 volatilite bandı filtresi (2026-08-17, kullanıcı onayıyla deploy) ──
// backtest/kom2/ altındaki ayrı Python backtest ortamında doğrulandı: günlük
// ATR14/fiyat %12-40 arası bandı, tam coin evreninde (526 sembol, o an ~70
// coin bu bantta) sabit-ufuklu (+1sa/+4sa/+1g) getiride en iyi sonucu verdi
// (bkz. dokumentasyon/raporlar/2026-08-16-kom1-atr-ince-bant-analizi.md,
// 2026-08-17-kom1-atr-dagilim-ve-genis-bant-analizi.md). Bağımsız/eski bir
// zaman penceresinde ayrıca doğrulanamadı (Kom1SignalLog geçmişi ~2.3 gün,
// API 200 sinyalle sınırlı, bu makineden production Mongo'ya erişim yok) —
// kullanıcı bu riski bilerek kabul edip deploy kararı verdi.
// Kapsam: evren/katman taraması (RC+WT büyük TF kontrolü) DEĞİŞMEDİ, tüm
// semboller eskisi gibi taranmaya devam ediyor ("taransın ama sinyal
// üretmesin") — filtre SADECE bir big-TF adayı (_pending'e girmeden hemen
// önce) oluştuğunda, o sembolün ATR'si bandın dışındaysa sinyali eler.
const ATR_BAND_LOW_PCT  = 12;
const ATR_BAND_HIGH_PCT = 40;
const ATR_TF = '1d';
const ATR_KLINE_LIMIT = 20; // 14 TR + pay
const ATR_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // günlük veriye dayanıyor, sık yenilenmesine gerek yok

// ── gorevler3.md Görev 6 — hacme göre 3 katman + rotasyon aralıkları ────
const TIER_SIZES = { 1: 100, 2: 200 }; // 3. katman: kalan her şey
const TIER_INTERVAL_MS = {
  1: 15 * 60 * 1000,       // ~15 dk
  2: 35 * 60 * 1000,       // ~35 dk
  3: 3 * 60 * 60 * 1000,   // ~3 saat
};
const UNIVERSE_REFRESH_MS = 60 * 60 * 1000; // hacim/katman ataması saatte bir yenilenir
const SCAN_PACE_MS = 120; // ardışık kline isteği arasında bekleme (ağırlık patlamasını önler)

// gorevler3.md Görev 7 (2026-08-14) — bu 11 coin `kom1-scanner.js`'in (tarayıcı,
// WS ile ANLIK tespit eden asıl/yetkili motor) sabit listesiyle BİREBİR AYNI.
// Buradaki (server) taramadan bilinçli olarak HARİÇ TUTULUYOR: tarayıcı bu
// coinleri kesinleştirdiği anda doğrudan Kom1SignalLog'a yazıyor (POST
// /api/kom1/signals) — burada da taranırsa aynı sinyal ~15dk gecikmeyle
// İKİNCİ KEZ (yaklaşık/REST versiyonuyla) kaydedilir. Sorumluluk ayrımı:
// tarayıcı bu 11'i hızlı/WS ile, sunucu kalan ~516'yı REST ile tarar —
// ikisi birlikte tüm evreni, duplikasyonsuz kapsar. Liste değişirse HER
// İKİ dosyada da güncellenmeli (aynı anda tutulan iki sabit kod kopyası,
// paylaşılan bir modüle taşımak bu turun kapsamı dışında bırakıldı).
const CLIENT_SYMBOLS = new Set([
  'ONDOUSDT', 'STRKUSDT', 'ENAUSDT', 'BIOUSDT', 'JUPUSDT',
  'TUSDT', 'AEVOUSDT', 'MOVEUSDT', 'VANRYUSDT', 'BERAUSDT', 'HYPEUSDT',
]);

// 1H bar × TOLERANCE_BARS(3) = 3 saat, 4H bar × 3 = 12 saat — bkz. modül başlığı notu.
const TF_MS = { '1h': 60 * 60 * 1000, '4h': 4 * 60 * 60 * 1000 };
function toleranceMs(tf) { return TF_MS[tf] * TOLERANCE_BARS; }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function fetchJson(path) {
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname: 'fapi.binance.com', path, method: 'GET', headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        if (res.statusCode === 429 || res.statusCode === 418) { reject(new Error(`BAN_SIGNAL_${res.statusCode}`)); return; }
        try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function fetchKlines(symbol, interval, limit) {
  return fetchJson(`/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`);
}

function hlc3(highs, lows, closes) {
  return closes.map((c, i) => (highs[i] + lows[i] + c) / 3);
}

// backtest/kom2/fetch_data.py:compute_atr14_pct ile BİREBİR AYNI formül
// (basit ortalama son 14 TR, Wilder smoothing değil) — tutarlılık için.
function computeAtr14Pct(klines) {
  if (!Array.isArray(klines) || klines.length < 15) return null;
  const highs  = klines.map(k => parseFloat(k[2]));
  const lows   = klines.map(k => parseFloat(k[3]));
  const closes = klines.map(k => parseFloat(k[4]));
  const trs = [];
  for (let i = 1; i < closes.length; i++) {
    trs.push(Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1]),
    ));
  }
  const last14 = trs.slice(-14);
  const atr14 = last14.reduce((a, b) => a + b, 0) / 14;
  const lastClose = closes[closes.length - 1];
  if (!(lastClose > 0)) return null;
  return atr14 / lastClose * 100;
}

// symbol -> { atrPct, computedAt } — sadece BİR big-TF adayı oluştuğunda
// doldurulur (bkz. _checkBigTF), evrenin tamamı için ayrı bir tarama YOK.
const _atrCache = new Map();

async function _getAtrPct(symbol) {
  const cached = _atrCache.get(symbol);
  if (cached && Date.now() - cached.computedAt < ATR_CACHE_TTL_MS) return cached.atrPct;
  try {
    const kl = await fetchKlines(symbol, ATR_TF, ATR_KLINE_LIMIT);
    const atrPct = computeAtr14Pct(kl);
    _atrCache.set(symbol, { atrPct, computedAt: Date.now() });
    return atrPct;
  } catch (err) {
    if (String(err.message).startsWith('BAN_SIGNAL')) throw err;
    console.warn(`[Kom1ServerWatcher] ATR hesaplanamadı (${symbol}):`, err.message);
    return cached ? cached.atrPct : null; // eski değer varsa kullan, yoksa "bilinmiyor"
  }
}

// ── Sembol evreni + katman ataması (in-memory, server.js Mongo ile besler/kalıcı tutar) ──
// symbol -> { tier, quoteVolume24h, lastScannedAt }
const _universe = new Map();
let _lastUniverseRefresh = 0;
// Her tick'te 500 kaydın TAMAMINI değil, sadece o turda gerçekten
// değişenleri (tier/hacim yenilendi VEYA tarandı) Mongo'ya yazmak için —
// 500 sembolü her 5dk'da bir tekrar upsert etmek gereksiz DB yükü olurdu.
const _dirty = new Set();

/**
 * exchangeInfo (TRADING+PERPETUAL+USDT filtresi) + toplu 24hr ticker (hacim)
 * ile tüm sembol evrenini çeker, hacme göre sıralayıp 3 katmana böler.
 * Var olan `lastScannedAt` değerleri (rotasyon durumu) KORUNUR — sadece
 * tier/hacim güncellenir, sembol ilk kez görülüyorsa lastScannedAt=0 (hemen taransın).
 *
 * gorevler4.md Görev-17 Madde B: `ticker/24hr` artık BURADA ayrıca çekilmiyor —
 * `server.js`'teki `collectBinanceData`'nın zaten her 1 dakikada tuttuğu aynı
 * veri `tickerSnapshot` (Map<symbol, {quoteVolume24h}>) olarak parametreyle
 * geçiriliyor (bkz. server.js `_latestBinanceTickers`). Snapshot henüz boşsa
 * (ör. Mongo henüz bağlanmadıysa — `collectBinanceData` bu durumda hiç
 * çalışmıyor) mevcut REST çağrısına AYNEN düşülüyor, yani evren yenilemesi
 * paylaşılan veri geçici olarak yoksa kesintiye uğramıyor.
 * @param {Map<string, {quoteVolume24h: number}>} [tickerSnapshot]
 */
async function _refreshUniverse(tickerSnapshot) {
  const info = await fetchJson('/fapi/v1/exchangeInfo');
  if (!info || !Array.isArray(info.symbols)) {
    throw new Error('exchangeInfo beklenmeyen yanıt');
  }

  const tradingUsdtPerp = new Set(
    info.symbols
      .filter(s => s.status === 'TRADING' && s.contractType === 'PERPETUAL' && s.symbol.endsWith('USDT'))
      .map(s => s.symbol)
      .filter(symbol => !CLIENT_SYMBOLS.has(symbol)) // bkz. CLIENT_SYMBOLS notu — tarayıcı zaten kapsıyor
  );

  const volumeBySymbol = new Map();
  if (tickerSnapshot && tickerSnapshot.size > 0) {
    for (const [symbol, t] of tickerSnapshot) {
      if (!tradingUsdtPerp.has(symbol)) continue;
      volumeBySymbol.set(symbol, t.quoteVolume24h || 0);
    }
  } else {
    // Paylaşılan snapshot henüz hazır değil — mevcut REST fallback
    const tickers = await fetchJson('/fapi/v1/ticker/24hr');
    if (!Array.isArray(tickers)) throw new Error('ticker/24hr beklenmeyen yanıt (fallback)');
    for (const t of tickers) {
      if (!tradingUsdtPerp.has(t.symbol)) continue;
      volumeBySymbol.set(t.symbol, parseFloat(t.quoteVolume) || 0);
    }
  }

  // Hacme göre azalan sırala → katman sınırlarını uygula
  const ranked = [...tradingUsdtPerp]
    .map(symbol => ({ symbol, quoteVolume24h: volumeBySymbol.get(symbol) || 0 }))
    .sort((a, b) => b.quoteVolume24h - a.quoteVolume24h);

  const seen = new Set();
  ranked.forEach((entry, idx) => {
    const tier = idx < TIER_SIZES[1] ? 1 : idx < TIER_SIZES[1] + TIER_SIZES[2] ? 2 : 3;
    const prev = _universe.get(entry.symbol);
    _universe.set(entry.symbol, {
      tier,
      quoteVolume24h: entry.quoteVolume24h,
      lastScannedAt: prev ? prev.lastScannedAt : 0,
    });
    seen.add(entry.symbol);
    _dirty.add(entry.symbol);
  });

  // Artık evrende olmayan (delisted/perpetual olmaktan çıkmış) sembolleri temizle
  for (const symbol of [..._universe.keys()]) {
    if (!seen.has(symbol)) _universe.delete(symbol);
  }

  _lastUniverseRefresh = Date.now();
  const s = getUniverseSummary();
  console.log(`[Kom1ServerWatcher] Evren yenilendi: ${s.total} USDT perpetual, Katman1=${s.tier1}, Katman2=${s.tier2}, Katman3=${s.tier3}.`);
}

async function _maybeRefreshUniverse(tickerSnapshot) {
  if (_universe.size > 0 && Date.now() - _lastUniverseRefresh < UNIVERSE_REFRESH_MS) return;
  try {
    await _refreshUniverse(tickerSnapshot);
  } catch (err) {
    console.warn('[Kom1ServerWatcher] Evren yenileme başarısız, önceki liste kullanılmaya devam:', err.message);
  }
}

/** Bu turda taranması gereken sembolleri (katman aralığı dolmuş olanları) döner. */
function _dueSymbols() {
  const now = Date.now();
  const due = [];
  for (const [symbol, state] of _universe) {
    const interval = TIER_INTERVAL_MS[state.tier];
    if (now - state.lastScannedAt >= interval) due.push(symbol);
  }
  return due;
}

// server.js başlangıçta Kom1ScanState'ten (Mongo) yükler — sunucu yeniden
// başlasa bile rotasyon sıfırdan başlamaz.
function loadScanState(records) {
  if (!Array.isArray(records)) return;
  for (const r of records) {
    if (!r || !r.symbol) continue;
    _universe.set(r.symbol, {
      tier: r.tier || 3,
      quoteVolume24h: r.quoteVolume24h || 0,
      lastScannedAt: r.lastScannedAt ? new Date(r.lastScannedAt).getTime() : 0,
    });
  }
  console.log(`[Kom1ServerWatcher] Kayıtlı tarama durumu yüklendi: ${_universe.size} sembol.`);
}

/** server.js her tick sonrası bunu Mongo'ya (bulkWrite upsert) yazar —
 *  sadece bu tick'te DEĞİŞEN kayıtları döner (bkz. `_dirty`), sonra temizler. */
function getScanStateForPersist() {
  const out = [];
  for (const symbol of _dirty) {
    const s = _universe.get(symbol);
    if (!s) continue;
    out.push({ symbol, tier: s.tier, quoteVolume24h: s.quoteVolume24h, lastScannedAt: new Date(s.lastScannedAt) });
  }
  _dirty.clear();
  return out;
}

// Her tier için EN SON taranan sembolün ne kadar önce tarandığını (ms) döner
// — rotasyonun fiilen çalıştığını (özellikle tier3'ün 3 saatlik aralığa
// uyup uymadığını) log/gözlem beklemeden tek istekle doğrulamak için.
function _tierScanAgeMs() {
  const now = Date.now();
  const mostRecent = { 1: 0, 2: 0, 3: 0 };
  for (const s of _universe.values()) {
    if (s.lastScannedAt > mostRecent[s.tier]) mostRecent[s.tier] = s.lastScannedAt;
  }
  const ageMs = {};
  for (const tier of [1, 2, 3]) {
    ageMs[tier] = mostRecent[tier] ? now - mostRecent[tier] : null; // null = bu tier'da hiç tarama olmamış
  }
  return ageMs;
}

function getLastTickAt() { return _lastTickAt; }

function getUniverseSummary() {
  const counts = { 1: 0, 2: 0, 3: 0 };
  for (const s of _universe.values()) counts[s.tier] = (counts[s.tier] || 0) + 1;
  const ageMs = _tierScanAgeMs();
  return {
    total: _universe.size, tier1: counts[1], tier2: counts[2], tier3: counts[3],
    lastRefreshedAt: _lastUniverseRefresh || null,
    tierLastScanAgoMs: ageMs,
  };
}

// "SYM_tf" -> { symbol, bigTf, rcMid, wtVal, wtPrev, price, firedAt, expiresAt }
const _pending = new Map();

async function _checkBigTF(symbol, tf) {
  const key = `${symbol}_${tf}`;
  if (_pending.has(key)) return; // zaten bekleyen bir sinyal var, tekrar ateşleme

  const kl = await fetchKlines(symbol, tf, BARS);
  if (!Array.isArray(kl) || kl.length < RC_LENGTH + 5) return;

  const highs  = kl.map(k => parseFloat(k[2]));
  const lows   = kl.map(k => parseFloat(k[3]));
  const closes = kl.map(k => parseFloat(k[4]));

  const rc = IndicatorEngine.calcRegressionChannel(closes, RC_LENGTH);
  if (!rc) return;
  const wt = IndicatorEngine.calcWT(hlc3(highs, lows, closes));
  if (!wt || wt.dir !== 'bull' || wt.prev >= WT_THRESHOLD) return;

  const price = closes[closes.length - 1];
  if (price > rc.mid) return;

  // ATR bandı kapısı — nadiren tetiklenir (sadece burada, gerçek bir aday
  // oluştuğunda), evrenin tamamını her tick'te taramaz.
  const atrPct = await _getAtrPct(symbol);
  if (atrPct === null || atrPct < ATR_BAND_LOW_PCT || atrPct >= ATR_BAND_HIGH_PCT) {
    console.log(`[Kom1ServerWatcher] ATR bandı dışı (${symbol}: ATR=${atrPct === null ? 'bilinmiyor' : atrPct.toFixed(2) + '%'}), aday elendi.`);
    return;
  }

  const now = Date.now();
  _pending.set(key, {
    symbol, bigTf: tf, rcMid: rc.mid, wtVal: wt.val, wtPrev: wt.prev, price, atrPct,
    firedAt: now, expiresAt: now + toleranceMs(tf),
  });
  console.log(`[Kom1ServerWatcher] Büyük TF sinyali ateşlendi: ${symbol} ${tf} — fiyat=${price}, RC_mid=${rc.mid.toFixed(4)}, WT ${wt.prev}→${wt.val}.`);
}

async function _checkSmallTFConfirmation(symbol, onConfirmed) {
  const symbolPending = [..._pending.entries()].filter(([, v]) => v.symbol === symbol);
  if (!symbolPending.length) return;

  const kl = await fetchKlines(symbol, SMALL_TF, SMALL_TF_BARS);
  if (!Array.isArray(kl) || kl.length < DEMA_PERIOD * 2) return;

  const opens  = kl.map(k => parseFloat(k[1]));
  const highs  = kl.map(k => parseFloat(k[2]));
  const lows   = kl.map(k => parseFloat(k[3]));
  const closes = kl.map(k => parseFloat(k[4]));

  const ha   = IndicatorEngine.calcHeikinAshi(opens, highs, lows, closes);
  const dema = IndicatorEngine.calcDEMA(closes, DEMA_PERIOD);
  if (!ha || dema === null) return;
  if (!(ha.haClose >= ha.haOpen && ha.haClose > dema)) return;

  const now = Date.now();
  for (const [key, entry] of symbolPending) {
    if (now > entry.expiresAt) continue; // pencere zaten kapanmış, sweep'e bırak
    _pending.delete(key);
    const confirmed = { ...entry, haOpen: ha.haOpen, haClose: ha.haClose, dema9: dema, confirmedAt: now };
    console.log(`[Kom1ServerWatcher] ✅ LONG SİNYALİ KESİNLEŞTİ (sunucu gözlemi): ${symbol} (${entry.bigTf})`);
    onConfirmed(confirmed);
  }
}

function _sweepExpired() {
  const now = Date.now();
  for (const [key, entry] of [..._pending.entries()]) {
    if (now > entry.expiresAt) {
      _pending.delete(key);
      console.log(`[Kom1ServerWatcher] Pencere kapandı, onay gelmedi: ${entry.symbol} ${entry.bigTf} — iptal.`);
    }
  }
}

function getPending() { return [..._pending.values()]; }

// gorevler3.md Görev 6 — ilk çalıştırmada TÜM evren (lastScannedAt=0)
// aynı anda "sırası gelmiş" sayılır, ilk tur 500 sembol × 2 TF'i taramaya
// çalışabilir (~2dk sürebilir). server.js'teki 5dk'lık _staggeredStart
// bir önceki tick() bitmeden yenisini başlatabilir (setInterval await
// etmez) — bu, tur üst üste binip aynı sembollerin aynı anda iki kez
// taranmasına (ve ağırlık israfına) yol açardı. Basit bir reentrancy
// kilidi bunu engelliyor.
let _ticking = false;

// gorevler4.md Görev-7 (2026-08-26) — botun sessizce çökmesi/takılması ile
// "çalışıyor ama yeni sinyal/veri yok" durumunu ayırt edebilmek için: her
// tur BAŞLADIĞINDA (bitmesini beklemeden) damgalanır. Günlük zamanlanmış
// kontrol bunu okuyup "son tur X dakika önceydi, beklenen ~5dk" diye
// karşılaştırabilir — normalde hep taze kalması gerekir, çok eskiyse
// (örn. >30dk) tick() döngüsünün bir yerde exception'la öldüğüne işarettir.
let _lastTickAt = null;

/**
 * @param {(confirmed: object) => Promise<void>|void} onConfirmed
 * @param {Map<string, {quoteVolume24h: number}>} [tickerSnapshot] — bkz. _refreshUniverse başlığı
 */
async function tick(onConfirmed, tickerSnapshot) {
  if (_ticking) { console.warn('[Kom1ServerWatcher] Önceki tur hâlâ sürüyor, bu tur atlandı.'); return; }
  _ticking = true;
  _lastTickAt = Date.now();
  try {
    await _tick(onConfirmed, tickerSnapshot);
  } finally {
    _ticking = false;
  }
}

async function _tick(onConfirmed, tickerSnapshot) {
  _sweepExpired();
  await _maybeRefreshUniverse(tickerSnapshot);

  // ── Büyük TF taraması: SADECE bu turda "sırası gelen" (katman aralığı
  // dolmuş) semboller. Evren boşsa (ilk yenileme başarısız olduysa) sessizce
  // hiçbir şey yapmadan geç — bir sonraki tick'te tekrar dener. ──────────
  const due = _dueSymbols();
  for (const symbol of due) {
    let banned = false;
    for (const tf of BIG_TFS) {
      try {
        await _checkBigTF(symbol, tf);
        await sleep(SCAN_PACE_MS);
      } catch (err) {
        if (String(err.message).startsWith('BAN_SIGNAL')) {
          console.warn(`[Kom1ServerWatcher] ⛔ Ban sinyali (${symbol} ${tf}) — bu tur atlandı.`);
          banned = true;
          break;
        }
        console.warn(`[Kom1ServerWatcher] Büyük TF kontrol hatası (${symbol} ${tf}):`, err.message);
      }
    }
    if (banned) return; // BotEngine'deki "shared budget" mantığıyla tutarlı — tüm turu durdur
    const state = _universe.get(symbol);
    if (state) { state.lastScannedAt = Date.now(); _dirty.add(symbol); }
  }

  // ── Küçük TF onayı: sadece GERÇEKTEN bekleyen sinyali olan semboller —
  // 500 sembolün tamamını her turda 5m onay için taramak (çoğunda pending
  // yokken) gereksiz ağırlık harcardı (Görev 6 öncesi 11 sembolde sorun
  // değildi, 500'de olurdu). ──────────────────────────────────────────
  const pendingSymbols = [...new Set([..._pending.values()].map(v => v.symbol))];
  for (const symbol of pendingSymbols) {
    try {
      await _checkSmallTFConfirmation(symbol, onConfirmed);
      await sleep(SCAN_PACE_MS);
    } catch (err) {
      if (String(err.message).startsWith('BAN_SIGNAL')) { console.warn(`[Kom1ServerWatcher] ⛔ Ban sinyali (${symbol} 5m onay) — bu tur atlandı.`); return; }
      console.warn(`[Kom1ServerWatcher] Küçük TF onay hatası (${symbol}):`, err.message);
    }
  }
}

module.exports = {
  tick, getPending,
  loadScanState, getScanStateForPersist, getUniverseSummary, getLastTickAt,
};
