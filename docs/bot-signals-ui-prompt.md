# Bot Sinyalleri UI — `detail-panel.js` Güncelleme Talimatları

## Hedef
`_renderSignalsTab()` fonksiyonunu yeniden yaz. Mevcut "START → NOW" formatını kaldır,
yerine `fr_signal_ui_v2.html`'deki temiz satır formatını uygula.

---

## `detail-panel.js` — `_renderSignalsTab()` fonksiyonunu tamamen değiştir

### Fonksiyonu bul (454. satır civarı):
```js
function _renderSignalsTab() {
```

### Tüm fonksiyonu şununla değiştir:

```js
function _renderSignalsTab() {
  const container = document.getElementById('dp-signals-tab');
  if (!container) return;

  if (typeof scalpFRMonitor === 'undefined') {
    container.innerHTML = `
      <div style="padding:16px; text-align:center; color:var(--text-secondary); font-size:12px;">
        ScalpFR monitor çalışmıyor.
      </div>`;
    return;
  }

  // Son 24 saat filtresi
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const signals = scalpFRMonitor.getSignals(200).filter(s => s.timestamp >= cutoff);

  // ── Header ───────────────────────────────────────
  let html = `
    <div style="padding:8px 10px 6px; border-bottom:1px solid var(--border-primary);">
      <div style="display:flex; align-items:center; justify-content:space-between;">
        <span style="font-size:11px; font-weight:600; color:var(--text-primary); letter-spacing:0.04em;">
          SCALP FR SİNYALLERİ
        </span>
        <span style="font-size:10px; color:var(--text-secondary);">
          eşik: <span style="color:var(--accent-yellow);">0.001</span>
        </span>
      </div>
      <div style="display:flex; gap:8px; font-size:10px; margin-top:4px; color:var(--text-secondary);">
        <span style="color:#26a69a;">▼ daha negatif = long fırsatı</span>
        <span style="color:#ef5350;">▲ pozitife dönüş</span>
      </div>
    </div>`;

  // ── Kolon başlıkları ───────────────────────────────
  html += `
    <div style="
      display:grid;
      grid-template-columns: 18px 72px 1fr 1fr 1fr 1fr 72px;
      font-size:10px;
      color:var(--text-secondary);
      padding:4px 10px;
      border-bottom:1px solid var(--border-primary);
      gap:4px;
    ">
      <span></span>
      <span>Ticker</span>
      <span>Previous</span>
      <span>Current</span>
      <span>Delta</span>
      <span>Remaining</span>
      <span style="text-align:right;">Saat</span>
    </div>`;

  // ── Empty state ───────────────────────────────────
  if (!signals.length) {
    html += `
      <div style="padding:24px 16px; text-align:center; color:var(--text-secondary); font-size:12px;">
        Sinyal bekleniyor...<br>
        <span style="font-size:10px; opacity:0.6;">${scalpFRMonitor.windows.size} aktif pencere izleniyor</span>
      </div>`;
    container.innerHTML = html;
    return;
  }

  // ── Sinyal satırları ─────────────────────────────
  html += `<div style="overflow-y:auto; max-height:calc(100vh - 320px);">`;

  signals.forEach((sig, idx) => {
    const isGreen = sig.direction === 'more_negative';
    const isRed   = sig.direction === 'less_negative';

    const accentColor = isGreen ? '#26a69a' : isRed ? '#ef5350' : 'var(--text-secondary)';
    const bgColor     = isGreen ? 'rgba(38,166,154,0.04)' : isRed ? 'rgba(239,83,80,0.04)' : 'transparent';
    const arrow       = isGreen ? '▼' : isRed ? '▲' : '─';

    const symDisplay  = sig.symbol.replace(/USDT$/, '');

    // Remaining — funding interval - penceredeki geçen süre
    const win = scalpFRMonitor.getWindowStatus(sig.symbol);
    const remainingText = win
      ? String(Math.floor(win.remainingMin)).padStart(2,'0') + ':00'
      : '—';

    // Opacity: eski sinyaller soluklaşsın
    const age = Date.now() - sig.timestamp;
    const opacity = age > 4 * 60 * 60 * 1000 ? 0.5 : 1;

    html += `
      <div style="
        display:grid;
        grid-template-columns: 18px 72px 1fr 1fr 1fr 1fr 72px;
        align-items:center;
        background:${bgColor};
        border-bottom:0.5px solid var(--border-primary);
        box-shadow:inset 3px 0 0 ${accentColor};
        padding:7px 10px;
        gap:4px;
        font-size:11px;
        opacity:${opacity};
        font-family:'Inter', sans-serif;
      ">
        <span style="color:${accentColor}; font-size:13px; line-height:1;">${arrow}</span>
        <span style="color:var(--text-primary); font-weight:600;">${symDisplay}</span>
        <span style="color:var(--text-secondary);">${sig.display.startFR}</span>
        <span style="color:${accentColor}; font-weight:600;">${sig.display.currentFR}</span>
        <span style="color:${accentColor}; font-weight:600;">${sig.display.delta}</span>
        <span style="color:var(--text-secondary);">${remainingText}</span>
        <span style="text-align:right; color:var(--text-secondary); font-size:10px;">${sig.display.time}</span>
      </div>`;
  });

  html += `</div>`;
  html += `
    <div style="text-align:center; font-size:10px; color:var(--text-secondary); padding:6px;">
      son 24s · ${signals.length} sinyal
    </div>`;

  container.innerHTML = html;
}
```

---

## Notlar

- `sig.display.startFR` → Previous kolonu
- `sig.display.currentFR` → Current kolonu  
- `sig.display.delta` → Delta kolonu
- `sig.display.time` → Saat kolonu
- `remainingText` → `scalpFRMonitor.getWindowStatus()` ile aktif pencereden alınıyor
- Sol kenar bant: `box-shadow:inset 3px 0 0 ${accentColor}`
- Yeşil: `#26a69a` (daha negatif = long fırsatı)
- Kırmızı: `#ef5350` (pozitife dönüş)
- 4 saatten eski sinyaller `opacity:0.5` ile soluklaşıyor
