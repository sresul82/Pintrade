/**
 * Kom2ServerWatcher — server-side "OI kalıcılık" sinyal tarayıcısı.
 *
 * gorevler3.md'ye ek (2026-08-17, kullanıcı isteği): Kom2'nin backtest'i
 * (bkz. backtest/kom2/, dokumentasyon/raporlar/kom2-backtest-sonuclari.md)
 * ve train/test overfitting kontrolü (dokumentasyon/raporlar/
 * 2026-08-17-kom2-train-test-overfitting-kontrolu.md) tamamlandı. Üretime
 * SADECE OI-kalıcılık yolu gidiyor (divergence YOK — train/test'te sinyali
 * seyrelttiği görüldü). Parametreler kullanıcı onaylı: eşik=%15, gün=7,
 * pullback≤%10, ls=global_below_1.
 *
 * kom1-server-watcher.js'in DB-agnostic mimarisini birebir taklit eder:
 * bu modül mongoose'a hiç dokunmaz, OI/L-S geçmiş sorguları ve kalıcı
 * durum (universe/tier rotasyonu) server.js'ten callback/argüman olarak
 * geçirilir (bkz. loadScanState/getScanStateForPersist).
 *
 * Kom1'den FARKLARI:
 *   - Büyük tetikleyici RC+WaveTrend değil, OI-kalıcılık testi + Global L/S
 *     filtresi (checkOiPersistence/checkLsFilter, backtest/kom2/indicators.py
 *     check_oi_persistence/check_ls_filter'ın birebir portu).
 *   - Coin evreni ATR14/fiyat ≥ %12 ("sert coin", ÜST SINIRSIZ) — Kom1'e
 *     2026-08-17'de eklenen %12-40 BANDIYLA KARIŞTIRILMASIN, farklı filtre.
 *   - Kom1'in aksine sabit bir "browser tarayıcı" karşılığı (CLIENT_SYMBOLS
 *     gibi) yok — evrenin tamamı bu modülden taranıyor.
 *   - Kesinleşen sinyal Kom1 gibi süresiz değil: SIGNAL_VALIDITY_MS (6 saat)
 *     sonra "expired" sayılır (kısa/orta vadeli karakter, backtest'te +1g
 *     ufkunun tutarsız/negatif çıkması nedeniyle).
 *
 * Küçük TF (5m) giriş onayı Kom1 ile BİREBİR AYNI kural (HA yeşil +
 * HA_close > DEMA9) — aynı IndicatorEngine kullanılır.
 */
const https = require('https');
const IndicatorEngine = require('./indicator-engine.js');

// ── Kullanıcı onaylı parametreler (bkz. backtest/kom2/) ─────────────────
const OI_THRESHOLD_PCT  = 15;
const HOLD_DAYS         = 7;
const MAX_PULLBACK_PCT  = 10;
const LS_VARIANT        = 'global_below_1';

const ATR_MIN_PCT = 12; // "sert coin" — üst sınırsız (Kom1'in [12,40) bandından FARKLI)
const ATR_TF = '1d';
const ATR_KLINE_LIMIT = 20;
const ATR_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const SMALL_TF      = '5m';
const DEMA_PERIOD   = 9;
const SMALL_TF_BARS = 40;

// Büyük tetikleyici (OI adayı) ile 5m onayı arasındaki bekleme penceresi —
// Kom1'in bar-sayısı tabanlı TOLERANCE_BARS'ının aksine burada doğrudan
// süre: OI-kalıcılık "bar"a bağlı bir kavram değil.
const CONFIRM_TOLERANCE_MS = 3 * 60 * 60 * 1000; // 3 saat

// Kesinleşen sinyalin "aktif" sayıldığı süre — Kom1'in süresiz kuralından
// FARKLI, Kom2'nin kısa/orta vadeli karakteri nedeniyle (backtest: +1g
// ufku tutarsız/negatif, +1sa/+4sa güvenilir).
const SIGNAL_VALIDITY_MS = 6 * 60 * 60 * 1000; // 6 saat

// Kom1 ile aynı REST bütçesi kaygıları — aynı değerler.
const TIER_SIZES = { 1: 100, 2: 200 };
const TIER_INTERVAL_MS = {
  1: 15 * 60 * 1000,
  2: 35 * 60 * 1000,
  3: 3 * 60 * 60 * 1000,
};
// Kom1'in aksine bu yenileme TÜM evrenin ATR14'ünü yeniden hesaplıyor
// (per-symbol klines isteği, ~527 istek × SCAN_PACE_MS ≈ 60 saniye) — Kom1'in
// ucuz (2 toplu istek) evren yenilemesinden ÇOK daha pahalı. Bu yüzden Kom1'in
// 1 saatlik değerini KOPYALAMADIK: 24 saate çıkarıldı (ATR zaten günlük mumdan
// hesaplanıyor, saatlik tazelemenin faydası yok — kom1-server-watcher.js'teki
// ATR_CACHE_TTL_MS ile aynı ritimde, tutarlı).
const UNIVERSE_REFRESH_MS = 24 * 60 * 60 * 1000;
const SCAN_PACE_MS = 120;
// [2026-08-18 EKLENDİ] _refreshUniverse'ün 527 sembollük ATR taraması için
// ayrı, daha yavaş bir tempo — SCAN_PACE_MS'in (Kom1'den miras, küçük/nadir
// istek grupları için düşünülmüş) bu kadar büyük bir toplu istek grubunda
// paylaşılan IP ağırlık bütçesini riske attığı gerçek bir olayla görüldü.
const UNIVERSE_SCAN_PACE_MS = 300;
// [2026-08-18, ÜÇÜNCÜ DÜZELTME — kullanıcı isteği, Kom1'in Görev 1'deki
// staggered-start çözümüyle aynı felsefe] Tek bir chunk'ı (40 sembol) bile
// düz 300ms aralıkla art arda göndermek production'da ban tetikledi. Artık
// chunk kendi içinde GRUP_SIZE'lık alt gruplara bölünüyor, gruplar arasına
// istekler-arası tempodan (300ms) çok daha BELİRGİN bir bekleme konuyor.
// [2026-08-18, DÖRDÜNCÜ DÜZELTME] Ban, deploy'dan ~74 saniye sonra — Kom2'nin
// tick'inin BAŞLADIĞI an — geldi (yeni eklenen teşhisle doğrulandı:
// lastError=BAN_SIGNAL_418, ilk grubun daha ilk sembolünde). Bu, grup
// boyutu/temposundan çok, o anki paylaşılan IP çakışmasına (muhtemelen
// Kom1'in tick'i, server.js'teki 40000ms gecikmeyle bu sırada hâlâ
// çalışıyor olabilir) işaret ediyor. Ek güvenlik payı: grup küçültüldü,
// gruplar arası bekleme artırıldı; asıl düzeltme server.js'teki tick
// başlangıç gecikmesinin çok daha ileri itilmesi (bkz. o dosyadaki not).
const UNIVERSE_SCAN_GROUP_SIZE = 10;
const UNIVERSE_SCAN_GROUP_PAUSE_MS = 3000;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function fetchJson(path) {
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname: 'fapi.binance.com', path, method: 'GET', headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        if (res.statusCode === 429 || res.statusCode === 418) { reject(new Error(`BAN_SIGNAL_${res.statusCode}`)); return; }
        // [2026-08-26, gorevler4.md Görev-2.4 araştırması] Önceden 429/418
        // dışındaki HER şey (CloudFront 403 blok sayfası, Binance'in kendi
        // JSON hata gövdesi {code:-1003,...} vb.) sessizce yutulup dışarıya
        // sadece anlamsız bir "beklenmeyen yanıt" mesajı sızıyordu —
        // _lastError'a bakıp gerçek sebebi anlamak imkansızdı (bkz. 2026-08-20
        // production bulgusu: universe 84'te sıkışmış, lastError bilgisiz).
        // Artık gerçek status kodu + gövdenin ilk 200 karakteri hataya
        // ekleniyor.
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}: ${body.slice(0, 200)}`));
          return;
        }
        try { resolve(JSON.parse(body)); }
        catch (e) { reject(new Error(`JSON parse hatası (HTTP ${res.statusCode}): ${body.slice(0, 200)}`)); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function fetchKlines(symbol, interval, limit) {
  return fetchJson(`/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`);
}

// ════════════════════════════════════════════════════════════════
// Adım 1 — Saf mantık fonksiyonları (backtest/kom2/indicators.py'nin
// check_oi_persistence / check_ls_filter'ının birebir portu).
// ════════════════════════════════════════════════════════════════

/**
 * OI kalıcılık testi. `oiSeries`: [{timestamp:number(ms), value:number}, ...]
 * ZATEN ARTAN sırada, `atTime`'a kadarki (dahil) veriyle sınırlı olmalı
 * (look-ahead yok — çağıran taraf zaten kesmiş olmalı, backtest/kom2/
 * indicators.py:check_oi_persistence'daki `at_time` kısıtıyla aynı).
 *
 * Python referansı (backtest/kom2/indicators.py:250-287):
 *   window = oi_series[(index<=at_time) & (index>=at_time-hold_days)]
 *   base = window.iloc[0]; running_peak takip edilir; her noktada
 *   gain_pct = (running_peak-base)/base*100, pullback_pct = (running_peak-val)/running_peak*100.
 *   Eğer gain_pct>=threshold VE pullback_pct>max_pullback -> kalıcılık BOZULDU (triggered=false, erken dön).
 *   Aksi halde triggered = (final peak_gain_pct >= threshold).
 */
function checkOiPersistence(oiSeries, atTime, thresholdPct, holdDays, maxPullbackPct) {
  const lookbackStart = atTime - holdDays * 24 * 60 * 60 * 1000;
  const window = oiSeries.filter(p => p.timestamp <= atTime && p.timestamp >= lookbackStart);
  if (window.length < 2) return { triggered: false, peakGainPct: 0, daysHeld: 0 };

  const base = window[0].value;
  if (!(base > 0)) return { triggered: false, peakGainPct: 0, daysHeld: 0 };

  let runningPeak = window[0].value;
  let peakGainPct = 0;
  for (const p of window) {
    runningPeak = Math.max(runningPeak, p.value);
    const gainPct = (runningPeak - base) / base * 100;
    peakGainPct = Math.max(peakGainPct, gainPct);
    const pullbackPct = runningPeak > 0 ? (runningPeak - p.value) / runningPeak * 100 : 0;
    if (gainPct >= thresholdPct && pullbackPct > maxPullbackPct) {
      // eşik geçildi ama sonrasında izin verilenden fazla geri çekildi — kalıcılık bozuldu
      return { triggered: false, peakGainPct, daysHeld: holdDays };
    }
  }
  return { triggered: peakGainPct >= thresholdPct, peakGainPct, daysHeld: holdDays };
}

/**
 * L/S filtresi — SADECE `global_below_1` varyantı (üretim parametresi).
 * `globalLsSeries`: [{timestamp, value}, ...] artan sırada.
 * Python referansı (indicators.py:294-317, variant='global_below_1'):
 *   g = global_ls[global_ls.index <= at_time]; return g.iloc[-1] < 1.0
 */
function checkLsFilter(globalLsSeries, atTime) {
  const upTo = globalLsSeries.filter(p => p.timestamp <= atTime);
  if (upTo.length === 0) return false;
  return upTo[upTo.length - 1].value < 1.0;
}

// backtest/kom2/fetch_data.py:compute_atr14_pct / kom1-server-watcher.js:computeAtr14Pct
// ile BİREBİR AYNI formül (basit ortalama son 14 TR, Wilder smoothing değil).
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

// ════════════════════════════════════════════════════════════════
// Adım 2 — Evren yönetimi + tick orkestrasyonu (kom1-server-watcher.js'in
// _refreshUniverse/_dueSymbols/loadScanState/getScanStateForPersist/
// _sweepExpired/tick deseninin birebir aynısı, farklı içerikle).
// ════════════════════════════════════════════════════════════════

function hlc3(highs, lows, closes) {
  return closes.map((c, i) => (highs[i] + lows[i] + c) / 3);
}

// symbol -> { atrPct, computedAt } — evren yenilemesi sırasında TÜM adaylar
// için doldurulur (Kom1'deki gibi "sadece aday oluştuğunda" değil — çünkü
// burada ATR evrene GİRİŞ şartı, Kom1'de ise sinyale dönüşüm şartıydı).
const _atrCache = new Map();

async function _getAtrPct(symbol) {
  const cached = _atrCache.get(symbol);
  if (cached && Date.now() - cached.computedAt < ATR_CACHE_TTL_MS) return cached.atrPct;
  const kl = await fetchKlines(symbol, ATR_TF, ATR_KLINE_LIMIT);
  const atrPct = computeAtr14Pct(kl);
  _atrCache.set(symbol, { atrPct, computedAt: Date.now() });
  return atrPct;
}

// [2026-08-18, İKİNCİ DÜZELTME — kullanıcı bulgusu] TEK bir tick içinde
// ~527 isteği art arda göndermek (pace'i ne kadar yavaşlatırsak yavaşlatalım)
// paylaşılan IP ağırlık bütçesinde Kom1'in tick'i/diğer toplayıcılarla
// çakışıp ban tetikleyebiliyor (gerçek olay: tek bir tam-taramada bile
// "Ban sinyali evren taramasında (ONTUSDT)"). Kom1'in kendi çözümü aynı
// mantık: TÜM evreni tek turda taramaz, katmanlara böler, her tick'te
// sadece "sırası gelen" küçük bir alt kümeyi tarar. Kom2'nin ATR sınıflama
// taraması burada AYNI FELSEFEYLE parçalara bölündü: tek seferde tüm evreni
// DEĞİL, her tick'te en fazla UNIVERSE_SCAN_CHUNK_SIZE sembolü işler,
// `_universeScanState` ile tick'ler arasında kaldığı yerden devam eder.
// ~527 sembol / 40 sembol-tick ≈ 14 tick × 5dk ≈ ~70 dakikada bir tam tur
// tamamlanır — her tick'te sadece ~12 saniyelik REST aktivitesi (40×300ms).
const UNIVERSE_SCAN_CHUNK_SIZE = 40;

// symbol -> { tier, quoteVolume24h, lastScannedAt } — SADECE ATR14>=%12
// ("sert coin") olan semboller burada yer alır.
const _universe = new Map();
let _lastUniverseRefresh = 0; // en son TAMAMLANMIŞ (başarılı ya da başarısız) taramanın bitiş zamanı
let _volumeTierEdges = [0, 0]; // [p33, p66] — compute_volume_tier_edges portu
const _dirty = new Set();

// Devam eden parçalı tarama durumu — null: tarama yok. Doluysa bir sonraki
// tick'te kaldığı yerden devam eder (bkz. _advanceUniverseScan).
let _universeScanState = null;

// [2026-08-18, teşhis alanları — kullanıcı isteği] Render log görüntüleyicisi
// yeni satırları güvenilir şekilde göstermediği için, /api/kom2/status'un
// kendisi tanı koymaya yetecek bilgiyi taşısın diye eklendi.
let _lastError = null; // { message: string, at: number(ms) } | null

/**
 * Devam eden bir tarama yoksa exchangeInfo+24hr ticker çekip YENİ bir tarama
 * başlatır (state'i sıfırdan kurar); varsa doğrudan kaldığı yerden devam
 * eder. Her çağrıda SADECE UNIVERSE_SCAN_CHUNK_SIZE kadar sembolün ATR'sini
 * hesaplar — tam tur için ÇOK KEZ çağrılması gerekir (bkz. _maybeRefreshUniverse).
 * Tur tamamlanınca (cursor sembol listesinin sonuna ulaşınca) sonucu uygular:
 * ATR>=%12 olanları evrene alır, hacme göre 3 katmana böler.
 */
async function _advanceUniverseScan() {
  if (!_universeScanState) {
    const [info, tickers] = await Promise.all([
      fetchJson('/fapi/v1/exchangeInfo'),
      fetchJson('/fapi/v1/ticker/24hr'),
    ]);
    if (!info || !Array.isArray(info.symbols) || !Array.isArray(tickers)) {
      throw new Error('exchangeInfo/24hr ticker beklenmeyen yanıt');
    }
    const symbols = info.symbols
      .filter(s => s.status === 'TRADING' && s.contractType === 'PERPETUAL' && s.symbol.endsWith('USDT'))
      .map(s => s.symbol);
    const volumeBySymbol = new Map();
    for (const t of tickers) volumeBySymbol.set(t.symbol, parseFloat(t.quoteVolume) || 0);
    _universeScanState = { symbols, volumeBySymbol, cursor: 0, hard: [] };
    console.log(`[Kom2ServerWatcher] Yeni evren taraması başladı: ${symbols.length} sembol, ${UNIVERSE_SCAN_CHUNK_SIZE}/tick ile parçalı taranacak.`);
  }

  const state = _universeScanState;
  const chunk = state.symbols.slice(state.cursor, state.cursor + UNIVERSE_SCAN_CHUNK_SIZE);

  // [2026-08-18, ÜÇÜNCÜ DÜZELTME — kullanıcı isteği] Tek bir chunk'ı (40
  // sembol) düz 300ms aralıklarla art arda göndermek bile production'da ban
  // tetikledi — Kom1'in Görev 1'de staggered-start ile çözdüğü sorunun aynısı.
  // Aynı yaklaşım: chunk'ı da kendi içinde GRUP_SIZE'lık (20) alt gruplara
  // böl, her grup arasına BELİRGİN bir bekleme (GROUP_PAUSE_MS, 1.5sn) koy —
  // sadece istekler arası 300ms değil, gruplar arası gerçek bir "nefes payı".
  for (let g = 0; g < chunk.length; g += UNIVERSE_SCAN_GROUP_SIZE) {
    const group = chunk.slice(g, g + UNIVERSE_SCAN_GROUP_SIZE);
    for (const symbol of group) {
      let atrPct;
      try {
        atrPct = await _getAtrPct(symbol);
        await sleep(UNIVERSE_SCAN_PACE_MS);
      } catch (err) {
        if (String(err.message).startsWith('BAN_SIGNAL')) {
          // [2026-08-18, teşhis iyileştirmesi] Ne kadar ilerlemişken banlandığı
          // _lastError'a yazılsın — state null'lanmadan ÖNCE, aksi halde bu
          // bilgi kayboluyordu (bkz. kullanıcının "processed/totalSymbols
          // görünmüyor" bulgusu).
          const processedSoFar = state.cursor + g + group.indexOf(symbol);
          console.warn(`[Kom2ServerWatcher] ⛔ Ban sinyali evren taramasında (${symbol}, ${processedSoFar}/${state.symbols.length} sembol işlenmişti) — tüm tarama iptal edildi, ${Math.round(UNIVERSE_REFRESH_MS / 3600000)} saat sonra baştan denenecek.`);
          _universeScanState = null; // yarım kalan turu tamamen at, baştan başla
          const enriched = new Error(`${err.message} (${symbol}, ${processedSoFar}/${state.symbols.length} sembol işlenmişken)`);
          throw enriched; // _maybeRefreshUniverse backoff'u uygulasın
        }
        continue; // tekil sembol hatası bu grubu durdurmasın
      }
      if (atrPct !== null && atrPct >= ATR_MIN_PCT) {
        state.hard.push({ symbol, quoteVolume24h: state.volumeBySymbol.get(symbol) || 0 });
      }
    }
    if (g + UNIVERSE_SCAN_GROUP_SIZE < chunk.length) await sleep(UNIVERSE_SCAN_GROUP_PAUSE_MS);
  }
  state.cursor += chunk.length;
  console.log(`[Kom2ServerWatcher] Evren taraması ilerledi: ${state.cursor}/${state.symbols.length} sembol işlendi (${state.hard.length} "sert coin" bulundu şimdiye kadar).`);

  if (state.cursor < state.symbols.length) return; // tur bitmedi, bir sonraki tick'te devam

  // Tur tamamlandı — sonucu uygula.
  const hard = state.hard;
  _universeScanState = null;

  if (hard.length === 0) {
    _lastError = { message: 'Tam tur tamamlandı ama hiç "sert coin" (ATR>=%12) bulunamadı', at: Date.now() };
    console.warn(`[Kom2ServerWatcher] Tam tur tamamlandı ama hiç "sert coin" bulunamadı (${_universe.size > 0 ? 'önceki liste korunuyor' : 'evren boş kalıyor'}) — bir sonraki tam tarama ~${Math.round(UNIVERSE_REFRESH_MS / 3600000)} saat sonra.`);
    return;
  }

  _lastError = null; // başarılı tur — önceki hata artık geçerli değil

  const volumes = hard.map(h => h.quoteVolume24h).filter(v => v > 0).sort((a, b) => a - b);
  _volumeTierEdges = volumes.length
    ? [_percentile(volumes, 33), _percentile(volumes, 66)]
    : [0, 0];

  const ranked = [...hard].sort((a, b) => b.quoteVolume24h - a.quoteVolume24h);
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
  for (const symbol of [..._universe.keys()]) {
    if (!seen.has(symbol)) _universe.delete(symbol);
  }

  const s = getUniverseSummary();
  console.log(`[Kom2ServerWatcher] ✅ Evren tam turu tamamlandı: ${s.total} "sert coin" (ATR>=%${ATR_MIN_PCT}), Katman1=${s.tier1}, Katman2=${s.tier2}, Katman3=${s.tier3}.`);
}

function _percentile(sortedArr, p) {
  const idx = Math.min(sortedArr.length - 1, Math.floor(sortedArr.length * p / 100));
  return sortedArr[idx];
}

async function _maybeRefreshUniverse() {
  // Devam eden bir parçalı tarama varsa, 24 saatlik bekleme şartından
  // BAĞIMSIZ olarak her tick'te bir sonraki parçayı işlemeye devam et —
  // aksi halde tur asla tamamlanamaz.
  if (_universeScanState) {
    try {
      await _advanceUniverseScan();
    } catch (err) {
      // BAN_SIGNAL burada yakalanır (_advanceUniverseScan zaten state'i
      // temizleyip fırlattı) — backoff'u burada uygula.
      _lastUniverseRefresh = Date.now();
      _lastError = { message: err.message, at: Date.now() };
      console.warn('[Kom2ServerWatcher] Evren taraması başarısız, önceki liste kullanılmaya devam:', err.message);
    }
    return;
  }

  // Yeni bir tur başlatma şartı: en son TAMAMLANMIŞ turdan bu yana
  // UNIVERSE_REFRESH_MS (24sa) geçmiş olmalı — evrenin dolu/boş olmasından
  // bağımsız (2026-08-18'de düzeltilen kritik hata: eskiden `_universe.size>0`
  // şartına bağlıydı, evren boş kaldığı sürece hiç beklemeden tekrar
  // deniyordu, banlı IP'yi sürekli yeniden dövüyordu).
  if (Date.now() - _lastUniverseRefresh < UNIVERSE_REFRESH_MS) return;
  try {
    await _advanceUniverseScan(); // turun İLK parçası
  } catch (err) {
    _lastUniverseRefresh = Date.now();
    _lastError = { message: err.message, at: Date.now() };
    console.warn('[Kom2ServerWatcher] Evren taraması başlatılamadı, önceki liste kullanılmaya devam:', err.message);
  }
}

function _dueSymbols() {
  const now = Date.now();
  const due = [];
  for (const [symbol, state] of _universe) {
    const interval = TIER_INTERVAL_MS[state.tier];
    if (now - state.lastScannedAt >= interval) due.push(symbol);
  }
  return due;
}

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
  console.log(`[Kom2ServerWatcher] Kayıtlı tarama durumu yüklendi: ${_universe.size} sembol.`);
}

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

function getUniverseSummary() {
  const counts = { 1: 0, 2: 0, 3: 0 };
  for (const s of _universe.values()) counts[s.tier] = (counts[s.tier] || 0) + 1;
  const nextAttemptAt = _universeScanState
    ? null // aktif taramanın kendisi zaten "sıradaki deneme" — ayrı bir gelecek zaman yok
    : (_lastUniverseRefresh ? _lastUniverseRefresh + UNIVERSE_REFRESH_MS : Date.now());
  return {
    total: _universe.size, tier1: counts[1], tier2: counts[2], tier3: counts[3],
    lastRefreshedAt: _lastUniverseRefresh || null,
    symbols: [..._universe.keys()], // collectKom2OiLsData'nın OI/L-S çekeceği sembol listesi
    volumeTierEdges: _volumeTierEdges,
    // [2026-08-18, teşhis alanları — kullanıcı isteği, log görüntüleyicisine
    // güvenilir erişim olmadığı için eklendi]
    scan: {
      active: _universeScanState !== null,
      processed: _universeScanState ? _universeScanState.cursor : null,
      totalSymbols: _universeScanState ? _universeScanState.symbols.length : null,
      hardFoundSoFar: _universeScanState ? _universeScanState.hard.length : null,
    },
    lastError: _lastError, // { message, at } | null
    nextAttemptAt, // ms epoch — bir sonraki YENİ tur denemesinin planlandığı an (aktif tarama varken null)
  };
}

function volumeTier(quoteVolume24h) {
  let stars = 1;
  for (const edge of _volumeTierEdges) if (quoteVolume24h >= edge) stars++;
  return Math.min(stars, 3);
}

// "SYMBOL" -> { symbol, oiGainPct, daysHeld, lsRatio, price, firedAt, expiresAt }
const _pending = new Map();

/**
 * OI-kalıcılık + L/S filtresi kontrolü — `queryOiHistory`/`queryLsHistory`
 * server.js'ten enjekte edilen Mongo sorgu callback'leri (bu modül
 * mongoose'a hiç dokunmaz, Kom1'deki loadScanState deseniyle aynı ruh).
 * Binance'e HİÇ istek atmaz — sadece enjekte edilen veriyle çalışır.
 */
async function _checkOiPersistence(symbol, queryOiHistory, queryLsHistory) {
  if (_pending.has(symbol)) return; // zaten bekleyen bir aday var

  const now = Date.now();
  const since = now - (HOLD_DAYS + 1) * 24 * 60 * 60 * 1000;
  const [oiSeries, lsSeries] = await Promise.all([
    queryOiHistory(symbol, since),
    queryLsHistory(symbol, since),
  ]);
  if (!Array.isArray(oiSeries) || oiSeries.length < 2) return;

  const oiResult = checkOiPersistence(oiSeries, now, OI_THRESHOLD_PCT, HOLD_DAYS, MAX_PULLBACK_PCT);
  if (!oiResult.triggered) return;

  const lsPassed = Array.isArray(lsSeries) && lsSeries.length > 0 && checkLsFilter(lsSeries, now);
  if (!lsPassed) return;

  const lastLs = lsSeries[lsSeries.length - 1].value;

  // Bu aşamada Binance'e istek atılmadığı için (sadece Mongo sorgusu) güncel
  // fiyat elde YOK — gerçek giriş fiyatı, 5m onayı sırasında (_checkSmallTFConfirmation)
  // o barın kapanışından alınır.
  _pending.set(symbol, {
    symbol, oiGainPct: oiResult.peakGainPct, daysHeld: oiResult.daysHeld,
    lsRatio: lastLs, price: null,
    firedAt: now, expiresAt: now + CONFIRM_TOLERANCE_MS,
  });
  console.log(`[Kom2ServerWatcher] OI-kalıcılık adayı ateşlendi: ${symbol} — OI artışı=%${oiResult.peakGainPct.toFixed(1)} (${oiResult.daysHeld}g), Global L/S=${lastLs.toFixed(3)}.`);
}

async function _checkSmallTFConfirmation(symbol, onConfirmed) {
  if (!_pending.has(symbol)) return;

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

  const entry = _pending.get(symbol);
  const now = Date.now();
  if (now > entry.expiresAt) return; // pencere kapanmış, sweep'e bırak
  _pending.delete(symbol);

  const confirmed = {
    ...entry,
    price: entry.price ?? closes[closes.length - 1],
    haOpen: ha.haOpen, haClose: ha.haClose, dema9: dema,
    confirmedAt: now, expiresAt: now + SIGNAL_VALIDITY_MS, // artık "sinyal aktiflik" süresi
  };
  console.log(`[Kom2ServerWatcher] ✅ KOM2 SİNYALİ KESİNLEŞTİ: ${symbol} — OI artışı=%${entry.oiGainPct.toFixed(1)}, ${SIGNAL_VALIDITY_MS / 3600000} saat geçerli.`);
  onConfirmed(confirmed);
}

function _sweepExpired() {
  const now = Date.now();
  for (const [symbol, entry] of [..._pending.entries()]) {
    if (now > entry.expiresAt) {
      _pending.delete(symbol);
      console.log(`[Kom2ServerWatcher] Onay penceresi kapandı: ${symbol} — iptal.`);
    }
  }
}

function getPending() { return [..._pending.values()]; }

let _ticking = false;

/**
 * @param {(symbol:string, sinceMs:number) => Promise<{timestamp:number,value:number}[]>} queryOiHistory
 * @param {(symbol:string, sinceMs:number) => Promise<{timestamp:number,value:number}[]>} queryLsHistory
 * @param {(confirmed: object) => Promise<void>|void} onConfirmed
 */
async function tick(queryOiHistory, queryLsHistory, onConfirmed) {
  if (_ticking) { console.warn('[Kom2ServerWatcher] Önceki tur hâlâ sürüyor, bu tur atlandı.'); return; }
  _ticking = true;
  try {
    await _tick(queryOiHistory, queryLsHistory, onConfirmed);
  } finally {
    _ticking = false;
  }
}

async function _tick(queryOiHistory, queryLsHistory, onConfirmed) {
  _sweepExpired();
  await _maybeRefreshUniverse();

  // OI-kalıcılık taraması: Binance'e istek ATMAZ (sadece Mongo sorgusu),
  // bu yüzden SCAN_PACE_MS ile ARALIKLI ÇALIŞMASINA gerek yok.
  const due = _dueSymbols();
  for (const symbol of due) {
    try {
      await _checkOiPersistence(symbol, queryOiHistory, queryLsHistory);
    } catch (err) {
      console.warn(`[Kom2ServerWatcher] OI-kalıcılık kontrol hatası (${symbol}):`, err.message);
    }
    const state = _universe.get(symbol);
    if (state) { state.lastScannedAt = Date.now(); _dirty.add(symbol); }
  }

  // Küçük TF onayı — GERÇEK Binance isteği, Kom1'deki gibi paced + ban-aware.
  const pendingSymbols = [..._pending.keys()];
  for (const symbol of pendingSymbols) {
    try {
      await _checkSmallTFConfirmation(symbol, onConfirmed);
      await sleep(SCAN_PACE_MS);
    } catch (err) {
      if (String(err.message).startsWith('BAN_SIGNAL')) { console.warn(`[Kom2ServerWatcher] ⛔ Ban sinyali (${symbol} 5m onay) — bu tur atlandı.`); return; }
      console.warn(`[Kom2ServerWatcher] Küçük TF onay hatası (${symbol}):`, err.message);
    }
  }
}

module.exports = {
  // Adım 1 — saf fonksiyonlar (doğrulama script'i tarafından da kullanılıyor).
  checkOiPersistence,
  checkLsFilter,
  computeAtr14Pct,
  // Adım 2 — tick orkestrasyonu.
  tick,
  getPending,
  loadScanState,
  getScanStateForPersist,
  getUniverseSummary,
  volumeTier,
  fetchJson,
  fetchKlines,
  sleep,
  OI_THRESHOLD_PCT, HOLD_DAYS, MAX_PULLBACK_PCT, LS_VARIANT,
  ATR_MIN_PCT, ATR_TF, ATR_KLINE_LIMIT, ATR_CACHE_TTL_MS,
  SMALL_TF, DEMA_PERIOD, SMALL_TF_BARS,
  CONFIRM_TOLERANCE_MS, SIGNAL_VALIDITY_MS,
  TIER_SIZES, TIER_INTERVAL_MS, UNIVERSE_REFRESH_MS, SCAN_PACE_MS,
  UNIVERSE_SCAN_PACE_MS, UNIVERSE_SCAN_CHUNK_SIZE, UNIVERSE_SCAN_GROUP_SIZE, UNIVERSE_SCAN_GROUP_PAUSE_MS,
};
