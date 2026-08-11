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
 *     entegrasyonunun kaynağı budur, asıl/yetkili motor budur.
 *   - Bu modül: periyodik REST anlık görüntüleriyle (her 5 dakikada bir),
 *     AYNI kuralı (RC+WT büyük TF, HA+DEMA9 küçük TF onayı) yaklaşık olarak
 *     tekrar hesaplar — SADECE tarayıcı kapalıyken de bir kayıt/gözlem
 *     bırakmak için. TOLERANCE_BARS burada bar-sayısı değil, eşdeğer
 *     duvar-saati süresine çevrilerek (1h→3saat, 4h→12saat) uygulanıyor —
 *     bu yüzden iki motorun ürettiği sinyaller birebir aynı ANDA gelmeyebilir,
 *     küçük bir gecikme/sapma normaldir. Aynı matematiği (IndicatorEngine)
 *     kullanır — iki farklı hesaplama yolu YOK (FR'nin "3 kaynaktan
 *     tutarsız veri" hatasına düşülmesin diye).
 *
 * Parametreler kom1-scanner.js ile BİREBİR aynı (gorevler3.md'nin başındaki
 * "sabit kodda, sabit değer" kararına sadık kalındı, burada da değiştirilmedi).
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
const SYMBOLS = [
  'ONDOUSDT', 'STRKUSDT', 'ENAUSDT', 'BIOUSDT', 'JUPUSDT',
  'TUSDT', 'AEVOUSDT', 'MOVEUSDT', 'VANRYUSDT', 'BERAUSDT', 'HYPEUSDT',
];
const BARS = RC_LENGTH + 30;

// 1H bar × TOLERANCE_BARS(3) = 3 saat, 4H bar × 3 = 12 saat — bkz. modül başlığı notu.
const TF_MS = { '1h': 60 * 60 * 1000, '4h': 4 * 60 * 60 * 1000 };
function toleranceMs(tf) { return TF_MS[tf] * TOLERANCE_BARS; }

function fetchKlines(symbol, interval, limit) {
  return new Promise((resolve, reject) => {
    const path = `/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
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

function hlc3(highs, lows, closes) {
  return closes.map((c, i) => (highs[i] + lows[i] + c) / 3);
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

  const now = Date.now();
  _pending.set(key, {
    symbol, bigTf: tf, rcMid: rc.mid, wtVal: wt.val, wtPrev: wt.prev, price,
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

/** @param {(confirmed: object) => Promise<void>|void} onConfirmed */
async function tick(onConfirmed) {
  _sweepExpired();
  for (const symbol of SYMBOLS) {
    for (const tf of BIG_TFS) {
      try { await _checkBigTF(symbol, tf); }
      catch (err) {
        if (String(err.message).startsWith('BAN_SIGNAL')) { console.warn(`[Kom1ServerWatcher] ⛔ Ban sinyali (${symbol} ${tf}) — bu tur atlandı.`); return; }
        console.warn(`[Kom1ServerWatcher] Büyük TF kontrol hatası (${symbol} ${tf}):`, err.message);
      }
    }
  }
  for (const symbol of SYMBOLS) {
    try { await _checkSmallTFConfirmation(symbol, onConfirmed); }
    catch (err) {
      if (String(err.message).startsWith('BAN_SIGNAL')) { console.warn(`[Kom1ServerWatcher] ⛔ Ban sinyali (${symbol} 5m onay) — bu tur atlandı.`); return; }
      console.warn(`[Kom1ServerWatcher] Küçük TF onay hatası (${symbol}):`, err.message);
    }
  }
}

module.exports = { tick, getPending, SYMBOLS, BIG_TFS };
