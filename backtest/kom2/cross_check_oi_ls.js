// cross_check_oi_ls.js — cross_check_oi_ls.py'nin ürettiği cases.json'u
// okur, js/screener/kom2-server-watcher.js'teki checkOiPersistence/
// checkLsFilter'ı aynı girdide çalıştırır, Python sonuçlarıyla karşılaştırır.
const fs = require('fs');
const path = require('path');
const watcher = require('../../js/screener/kom2-server-watcher.js');

const casesPath = path.join(__dirname, 'cross_check_cases.json');
const cases = JSON.parse(fs.readFileSync(casesPath, 'utf-8'));

const OI_THRESHOLD_PCT = 15;
const HOLD_DAYS = 7;
const MAX_PULLBACK_PCT = 10;

let pass = 0, fail = 0;

for (const c of cases) {
  const jsOi = watcher.checkOiPersistence(c.oi_series, c.at_time_ms, OI_THRESHOLD_PCT, HOLD_DAYS, MAX_PULLBACK_PCT);
  const jsLs = c.ls_series.length ? watcher.checkLsFilter(c.ls_series, c.at_time_ms) : null;

  const oiTriggeredMatch = jsOi.triggered === c.py_oi_triggered;
  const oiPeakMatch = Math.abs(jsOi.peakGainPct - c.py_oi_peak_gain_pct) < 1e-6;
  const lsMatch = (jsLs === null && c.py_ls === null) || (jsLs === c.py_ls);

  const ok = oiTriggeredMatch && oiPeakMatch && lsMatch;
  if (ok) {
    pass++;
  } else {
    fail++;
    console.log(`MISMATCH ${c.symbol} @${c.at_time_ms}:`);
    console.log(`  OI  py=(triggered=${c.py_oi_triggered}, peak=${c.py_oi_peak_gain_pct}) js=(triggered=${jsOi.triggered}, peak=${jsOi.peakGainPct})`);
    console.log(`  LS  py=${c.py_ls} js=${jsLs}`);
  }
}

console.log(`\n${pass} eşleşti, ${fail} eşleşmedi (toplam ${cases.length})`);
process.exit(fail > 0 ? 1 : 0);
