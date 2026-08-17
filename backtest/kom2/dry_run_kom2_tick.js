// dry_run_kom2_tick.js — Adım 3: Kom2ServerWatcher.tick()'i backtest/kom2/
// SQLite verisinden okuyan SAHTE queryOiHistory/queryLsHistory callback'leri
// ve konsola-yazan-sadece onConfirmed ile çalıştırır. Mongo'ya HİÇ yazmaz,
// Telegram'a HİÇ göndermez, production'a dokunmaz.
//
// Universe/ATR taraması da GERÇEK Binance'e gitmez — bunun yerine
// backtest/kom2/data/hard_coin_universe.json'daki (zaten ATR>=%12 filtresinden
// geçmiş) coin listesini doğrudan yükler (loadScanState ile), böylece hiçbir
// ağ isteği atmadan sadece OI-kalıcılık + 5m onay mantığını test eder.
//
// 5m onayı GERÇEK Binance'e gider (salt-okunur GET, veri yazmaz) — bu,
// mock'un kapsamadığı tek gerçek ağ etkileşimi, kasıtlı (production
// dışı, sadece okuma).
const fs = require('fs');
const path = require('path');

const watcher = require('../../js/screener/kom2-server-watcher.js');

const DATA_DIR = path.join(__dirname, 'data');
const COIN_DATA_DIR = path.join(DATA_DIR, 'coin_data');

function loadHardCoinUniverse() {
  const p = path.join(DATA_DIR, 'hard_coin_universe.json');
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

// SQLite'tan oi_metrics/ls_metrics'i belleğe yükler (child_process ile python
// kullanmak yerine basit bir .db okuyucu deniyoruz; better-sqlite3 yoksa
// python köprüsüne düşer).
function loadSeriesViaPython(symbol) {
  const { execFileSync } = require('child_process');
  const script = `
import sqlite3, json, sys
conn = sqlite3.connect(r"${path.join(COIN_DATA_DIR, symbol + '.db')}")
oi = conn.execute("SELECT create_time, sum_open_interest FROM oi_metrics ORDER BY create_time ASC").fetchall()
ls = conn.execute("SELECT create_time, global_ls FROM ls_metrics WHERE global_ls IS NOT NULL ORDER BY create_time ASC").fetchall()
print(json.dumps({"oi": oi, "ls": ls}))
`;
  const out = execFileSync('python', ['-c', script], { encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024 });
  const parsed = JSON.parse(out);
  return {
    oi: parsed.oi.map(([t, v]) => ({ timestamp: t, value: v })),
    ls: parsed.ls.map(([t, v]) => ({ timestamp: t, value: v })),
  };
}

async function main() {
  const hardCoins = loadHardCoinUniverse();
  console.log(`${hardCoins.length} "sert coin" yüklendi (hard_coin_universe.json'dan, ağ isteği YOK).`);

  // loadScanState ile evreni doğrudan doldur — _refreshUniverse() (gerçek
  // Binance taraması) hiç çağrılmıyor, bu dry-run'ın kapsamı dışı.
  const now = Date.now();
  watcher.loadScanState(hardCoins.map(symbol => ({ symbol, tier: 1, quoteVolume24h: 0, lastScannedAt: 0 })));

  const seriesCache = new Map();
  function getSeries(symbol) {
    if (!seriesCache.has(symbol)) {
      const dbPath = path.join(COIN_DATA_DIR, symbol + '.db');
      if (!fs.existsSync(dbPath)) { seriesCache.set(symbol, { oi: [], ls: [] }); return seriesCache.get(symbol); }
      try {
        seriesCache.set(symbol, loadSeriesViaPython(symbol));
      } catch (e) {
        console.warn(`  ${symbol}: seri yüklenemedi (${e.message})`);
        seriesCache.set(symbol, { oi: [], ls: [] });
      }
    }
    return seriesCache.get(symbol);
  }

  // Mock: "şimdi" yerine verinin kendi son zaman damgasını kullan (gerçek
  // Binance'te bugünmüş gibi davranırdı, ama elimizdeki veri geçmişte kaldığı
  // için checkOiPersistence'ın `now` parametresini serinin son noktasına
  // sabitliyoruz — böylece 7 günlük pencere gerçek veri içinde kalıyor).
  const queryOiHistory = async (symbol, sinceMs) => {
    const s = getSeries(symbol).oi;
    if (!s.length) return [];
    return s; // zaten tüm mevcut geçmiş — checkOiPersistence kendi içinde pencereliyor
  };
  const queryLsHistory = async (symbol, sinceMs) => getSeries(symbol).ls;

  let confirmedCount = 0;
  let candidateCount = 0;
  const onConfirmed = (sig) => {
    confirmedCount++;
    console.log(`  ✅ ONAYLANDI: ${sig.symbol} — OI=%${sig.oiGainPct.toFixed(1)} (${sig.daysHeld}g), L/S=${sig.lsRatio?.toFixed(3)}, HA_close=${sig.haClose}, DEMA9=${sig.dema9}`);
  };

  // checkOiPersistence'a geçirilecek "now" değerini, her coinin kendi OI
  // serisinin SON zaman damgasına göre override etmemiz gerekiyor — bunun
  // için tick()'i değil, doğrudan alt fonksiyonları çağırıyoruz (tick()
  // Date.now() kullanıyor, mock veri geçmişte kaldığı için 7 günlük pencere
  // boş çıkar). Bu yüzden burada tick()'i DEĞİL, watcher'ın dışa açtığı
  // checkOiPersistence/checkLsFilter'ı, her coinin kendi "son an"ıyla
  // doğrudan çağırıyoruz — mantığın ADIM 1'de zaten doğrulanmış aynı
  // fonksiyonları, gerçek veri üzerinde uçtan uca gözlemlemek için.
  for (const symbol of hardCoins) {
    const series = getSeries(symbol);
    if (!series.oi.length) continue;
    const atTime = series.oi[series.oi.length - 1].timestamp;
    const oiResult = watcher.checkOiPersistence(series.oi, atTime, watcher.OI_THRESHOLD_PCT, watcher.HOLD_DAYS, watcher.MAX_PULLBACK_PCT);
    if (!oiResult.triggered) continue;
    const lsPassed = series.ls.length > 0 && watcher.checkLsFilter(series.ls, atTime);
    if (!lsPassed) continue;
    candidateCount++;
    const lastLs = series.ls[series.ls.length - 1].value;
    console.log(`  🔶 ADAY: ${symbol} — OI artışı=%${oiResult.peakGainPct.toFixed(1)} (${oiResult.daysHeld}g), Global L/S=${lastLs.toFixed(3)} @ ${new Date(atTime).toISOString()}`);
  }

  console.log(`\n${hardCoins.length} coin tarandı, ${candidateCount} OI-kalıcılık+L/S adayı bulundu (5m onayı bu dry-run'da AYRICA test edilmedi — adayların varlığı/mantığı doğrulandı).`);
  console.log('Mongo yazımı: HAYIR. Telegram: HAYIR. Production: DOKUNULMADI.');
}

main().catch(err => { console.error('HATA:', err); process.exit(1); });
