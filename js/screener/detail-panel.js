/**
 * DetailPanel
 * detail_panel.html'deki tüm JS mantığı burada.
 * Coin seçildiğinde (EventBus: 'symbol:change') paneli günceller.
 */
const DetailPanel = (() => {

  // ── Detail panel yüksekliği ─────────────────────────
  // Model: screener (#wl-list) her zaman SABİT bir yüksekliğe (px) kilitlenir,
  //   detail-panel geri kalan alanı doldurur (flex:1). Bu tek mekanizma hem
  //   otomatik varsayılanlar hem de kullanıcının fare ile sürüklemesi için
  //   kullanılıyor — sürükleme sırasında sadece bu px değeri değişiyor.
  //
  // Otomatik varsayılan (kullanıcı hiç sürüklememişse):
  //   • "Coin Detail" / "News": içerik yüksekliği JS ile ölçülüp
  //     (borderTop+resizeBar+tabsBar+içerik) screener'ın NE KADAR ALMAMASI
  //     gerektiği hesaplanır, geri kalanı screener'a verilir.
  //     Not: .detail-body { flex:1 1 0% } olduğu için parent'ın height'ı
  //     "auto" bırakılırsa içerik 0'a çöküyor — bu yüzden saf CSS flex
  //     yerine JS ölçümü kullanılıyor.
  //   • "Bot Signals": tam SCREENER_ROWS_ON_BOT satır (içerik uzun, daha
  //     fazla alandan faydalanıyor).
  //
  // Kullanıcı #detail-resize'ı sürüklerse TEK bir ortak yükseklik olarak
  // kaydedilir (sekmeye göre değil) — hangi sekmede sürüklenirse sürüklensin,
  // diğer sekmelere geçince aynı hizadan açılır. Tutamaca çift tıklamak bu
  // ortak kaydı siler, her sekme kendi otomatik değerine döner.
  const SCREENER_ROWS_ON_BOT = 20;
  const CONTENT_EL_ID = { detail: 'dp-detail-tab', news: 'dp-news-tab' };
  const LS_MANUAL_HEIGHT = 'pintrade_dp_wl_height';
  const MIN_WL_ROWS = 3;      // screener sürüklenirken bu kadar satırın altına inmesin
  const MIN_DP_BUFFER = 4;    // Coin Detail içeriğinin altında bırakılan pay (px) — 3-5px arası

  function _measureRowHeight() {
    const row = document.querySelector('.wl-row');
    if (row) return row.getBoundingClientRect().height;
    return 22; // henüz hiç satır render edilmemişse makul bir varsayılan
  }

  function _loadManualHeight() {
    const v = parseFloat(localStorage.getItem(LS_MANUAL_HEIGHT));
    return isNaN(v) ? null : v;
  }
  function _saveManualHeight(px) {
    try { localStorage.setItem(LS_MANUAL_HEIGHT, String(Math.round(px))); } catch (e) {}
  }
  function _clearManualHeight() {
    try { localStorage.removeItem(LS_MANUAL_HEIGHT); } catch (e) {}
  }

  /** screener'ı tam olarak wlHeightPx'e sabitler, detail-panel kalanı alır. */
  function _lockWlHeight(wlHeightPx) {
    const dpPanel = document.getElementById('detail-panel');
    const wlList  = document.getElementById('wl-list');
    if (!dpPanel || !wlList) return;
    wlList.style.flex       = `0 0 ${Math.round(wlHeightPx)}px`;
    dpPanel.style.height    = '';
    dpPanel.style.flex      = '1 1 auto';
    dpPanel.style.maxHeight = 'none';
  }

  // Coin Detail'in TAM sığdığı yükseklik (borderTop+resize+tabsBar+içerik).
  // Sürükleme sınırı bunu kullanıyor — hangi sekmede olursanız olun, panel bu
  // değerin altına inemez, yani Coin Detail'e geçince içerik asla kırpılmaz.
  // Not: #dp-detail-tab display:none iken scrollHeight 0 döner, bu yüzden
  // sadece Coin Detail GÖRÜNÜRKEN ölçülüp önbelleğe alınıyor; diğer
  // sekmelerdeki sürüklemeler bu önbellekteki son bilinen değeri kullanır.
  let _coinDetailFitHeightCache = null;

  function _measureCoinDetailFitHeight() {
    const tabsBar   = document.querySelector('.detail-tabs');
    const resizeBar = document.getElementById('detail-resize');
    const contentEl = document.getElementById('dp-detail-tab');
    const borderTop = 2; // .detail-panel { border-top: 2px } — box-sizing:border-box
    const contentH  = contentEl ? contentEl.scrollHeight : 0;
    const tabsH     = tabsBar   ? tabsBar.getBoundingClientRect().height   : 0;
    const resizeH   = resizeBar ? resizeBar.getBoundingClientRect().height : 0;
    return Math.ceil(borderTop + resizeH + tabsH + contentH);
  }

  function _applyDetailLayout(tabId) {
    const dpPanel   = document.getElementById('detail-panel');
    const wlList    = document.getElementById('wl-list');
    const tabsBar   = document.querySelector('.detail-tabs');
    const resizeBar = document.getElementById('detail-resize');
    if (!dpPanel || !wlList) return;

    // Coin Detail her göründüğünde taze ölç + önbelleğe al (sürükleme
    // sınırı diğer sekmelerdeyken de bu önbelleği kullanacak).
    if (tabId === 'detail') {
      _coinDetailFitHeightCache = _measureCoinDetailFitHeight();
    }

    // Kullanıcı daha önce sürükleyip kaydettiyse (sekmeden bağımsız, ortak) onu kullan.
    const manual = _loadManualHeight();
    if (manual !== null) {
      _lockWlHeight(manual);
      return;
    }

    if (tabId === 'signals') {
      _lockWlHeight(_measureRowHeight() * SCREENER_ROWS_ON_BOT);
      return;
    }

    // Coin Detail / News: içeriği ölç, panele o kadar yükseklik ver,
    // screener kalanı doldursun (CSS varsayılanı: flex:1 1 0%).
    wlList.style.flex = '';

    const contentEl = document.getElementById(CONTENT_EL_ID[tabId] || CONTENT_EL_ID.detail);
    const borderTop = 2; // .detail-panel { border-top: 2px } — box-sizing:border-box
    const contentH  = contentEl ? contentEl.scrollHeight : 0;
    const tabsH     = tabsBar   ? tabsBar.getBoundingClientRect().height   : 0;
    const resizeH   = resizeBar ? resizeBar.getBoundingClientRect().height : 0;

    dpPanel.style.flex      = '0 1 auto';
    dpPanel.style.maxHeight = ''; // CSS'teki %80 tavan güvenlik ağı olarak kalsın
    dpPanel.style.height    = Math.ceil(borderTop + resizeH + tabsH + contentH) + 'px';
  }

  // ── Fare ile sürükleme ───────────────────────────────
  let _drag = null; // { startY, startWlHeight, minH, maxH }

  function _activeTabId() {
    return document.querySelector('.detail-tab.active')?.dataset.tab || 'detail';
  }

  function _initResizeDrag() {
    const resizeBar = document.getElementById('detail-resize');
    const wlList    = document.getElementById('wl-list');
    const dpPanel   = document.getElementById('detail-panel');
    if (!resizeBar || !wlList || !dpPanel) return;

    resizeBar.addEventListener('mousedown', (e) => {
      e.preventDefault();
      const wlHeaderH  = document.querySelector('.wl-header')?.getBoundingClientRect().height || 0;
      const colHeaderH = document.getElementById('wl-col-header')?.getBoundingClientRect().height || 0;
      const rightPanel = document.getElementById('right-panel');
      const available  = (rightPanel?.getBoundingClientRect().height || 0) - wlHeaderH - colHeaderH;
      // Aşağı sürüklemenin sınırı: Coin Detail içeriği + küçük bir pay.
      // Önbellek hiç dolmadıysa (çok erken bir tıklama) makul bir varsayılana düş.
      const minDpSpace = (_coinDetailFitHeightCache ?? 300) + MIN_DP_BUFFER;

      _drag = {
        startY:        e.clientY,
        startWlHeight: wlList.getBoundingClientRect().height,
        minH:          _measureRowHeight() * MIN_WL_ROWS,
        maxH:          Math.max(0, available - minDpSpace),
      };
      document.body.classList.add('dp-resizing');
    });

    document.addEventListener('mousemove', (e) => {
      if (!_drag) return;
      const delta = e.clientY - _drag.startY;
      const h = Math.min(_drag.maxH, Math.max(_drag.minH, _drag.startWlHeight + delta));
      _lockWlHeight(h);
    });

    document.addEventListener('mouseup', () => {
      if (!_drag) return;
      _saveManualHeight(wlList.getBoundingClientRect().height);
      document.body.classList.remove('dp-resizing');
      _drag = null;
    });

    // Çift tıklama: ortak manuel yüksekliği unut, her sekme kendi otomatik değerine döner.
    resizeBar.addEventListener('dblclick', () => {
      _clearManualHeight();
      _applyDetailLayout(_activeTabId());
    });
  }

  // ── Helpers ───────────────────────────────────────
  function _fmt(v) {
    if (v == null || isNaN(v)) return '—';
    const num = parseFloat(v);
    if (num < 1) return num.toFixed(5);
    if (num < 10) return num.toFixed(4);
    if (num < 100) return num.toFixed(3);
    if (num < 1000) return num.toFixed(2);
    return num.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  }

  function _fmtOI(n) {
    if (!n || isNaN(n)) return '—';
    if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(2) + 'K';
    return Math.floor(n).toLocaleString('en-US');
  }

  function _fmtBig(n) {
    if (!n) return '—';
    if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(2) + 'K';
    return n.toFixed(2);
  }

  function _fmtString(n) {
    if (!n) return '—';
    if (n >= 1e9) return (n / 1e9).toFixed(2) + ' B';
    if (n >= 1e6) return (n / 1e6).toFixed(2) + ' M';
    if (n >= 1e3) return (n / 1e3).toFixed(2) + ' K';
    return parseFloat(n).toLocaleString('en-US');
  }

  function _rsiClass(v) {
    if (v >= 70) return 'overbought';
    if (v <= 30) return 'oversold';
    return 'neutral';
  }

  function _setRsi(tfId, val) {
    const card = document.getElementById(`dp-rsi-${tfId}`);
    const valEl = document.getElementById(`dp-rsi-${tfId}-val`);
    if (!card || !valEl) return;
    const cls = val !== null ? _rsiClass(val) : 'neutral';
    card.className = `dp-rsi-card ${cls}`;
    valEl.className = `dp-rsi-val ${cls}`;
    valEl.textContent = val !== null ? val.toFixed(1) : '—';
  }

  // ── OI bar chart ──────────────────────────────────
  function _buildOiBars(data) {
    const el = document.getElementById('dp-oi-bars');
    if (!el) return;
    el.innerHTML = '';
    if (!data || !data.length) return;
    const max = Math.max(...data), min = Math.min(...data);
    data.forEach((v, i) => {
      const pct = min === max ? 0.5 : (v - min) / (max - min);
      const h = 15 + pct * 85;
      const isUp = i === 0 || v >= data[i - 1];
      const bar = document.createElement('div');
      bar.className = 'dp-oi-bar';
      bar.style.cssText = `height:${h}%;background:${isUp ? 'var(--dp-green)' : 'var(--dp-red)'};opacity:0.75;`;
      el.appendChild(bar);
    });
  }

  // ── FR countdown timer ────────────────────────────
  let _frInterval = null;
  let _pollTimer = null;
  let _currentSym = null;
  let _currentExchange = 'binance';
  let _pollCount = 0; // Her 10sn artir, RSI kadansini kontrol etmek icin

  // ── L/S kartı — LSDataStore üzerinden (kendi fetch'ini atmaz) ─────
  // Sadece Binance için (LSDataStore şu an tek borsayı destekliyor, bkz.
  // js/data/ls-data-store.js). Bybit L/S hâlâ kendi doğrudan fetch'ini
  // kullanıyor (ayrı görev, faz 2).
  let _lsSub = null; // { symbol, callback } — sembol değişince eski abonelik bırakılır

  function _applyLsMetrics(metrics) {
    const lsRatio = metrics?.global?.ratio;
    if (lsRatio != null && isFinite(lsRatio)) {
      const lsPct = (lsRatio / (1 + lsRatio)) * 100;
      const lsBuyEl  = document.getElementById('dp-ls-buy');
      const lsSellEl = document.getElementById('dp-ls-sell');
      if (lsBuyEl && lsSellEl) {
        lsBuyEl.style.width  = lsPct.toFixed(1) + '%';
        lsSellEl.style.width = (100 - lsPct).toFixed(1) + '%';
        document.getElementById('dp-ls-buy-pct').textContent  = lsPct.toFixed(1) + '%';
        document.getElementById('dp-ls-sell-pct').textContent = (100 - lsPct).toFixed(1) + '%';
      }
      const lsRatioEl = document.getElementById('dp-ls-ratio');
      if (lsRatioEl) lsRatioEl.textContent = lsRatio.toFixed(2);
      const lsDomEl = document.getElementById('dp-ls-dom');
      if (lsDomEl) lsDomEl.textContent = lsPct > 50 ? 'Uzun hakimiyeti' : 'Kısa hakimiyeti';
    }

    // "Tahta" — gerçek emir defteri (LSDataStore zaten WS'ten çekiyor,
    // subscribe() otomatik abone ediyor). Önceden burası L/S yüzdesini
    // rastgele bir sinüs dalgasıyla titreştiren sahte bir animasyondu
    // (_startObSim) — gerçek veriye bağlandı.
    const ob = metrics?.orderBook;
    if (ob && ob.bidVol != null && ob.askVol != null) {
      const total = ob.bidVol + ob.askVol;
      const bidPct = total > 0 ? (ob.bidVol / total) * 100 : 50;
      const obBuyEl  = document.getElementById('dp-ob-buy');
      const obSellEl = document.getElementById('dp-ob-sell');
      if (obBuyEl && obSellEl) {
        obBuyEl.style.width  = bidPct.toFixed(1) + '%';
        obSellEl.style.width = (100 - bidPct).toFixed(1) + '%';
        obBuyEl.textContent  = bidPct.toFixed(1) + '%';
        obSellEl.textContent = (100 - bidPct).toFixed(1) + '%';
      }
    }

    _renderLsPopupContent(metrics);
  }

  /** L/S popup'unun (MiniFloatingWindow 'ls') içeriği — Visivero'nun 4
   *  göstergesinden ana kartta yer bulmayan ikisi (Trader Positioning,
   *  Market Exposure) + bonus bir üçüncüsü (Top Accounts). Veri zaten
   *  LSDataStore'da hazır (bkz. js/data/ls-data-store.js başlığı), sadece
   *  arayüze bağlanıyor. Popup kapalıyken de (ucuz DOM güncellemesi)
   *  taze tutuluyor ki açıldığı an güncel görünsün. */
  function _ratioRow(label, m) {
    if (!m || m.ratio == null || !isFinite(m.ratio)) return '';
    const pct = (m.ratio / (1 + m.ratio)) * 100;
    return `<div class="dp-split-row">
      <span class="dp-split-title" style="width:auto;min-width:60px;">${label}</span>
      <div class="dp-split-bar" style="width:100%;">
        <div class="dp-split-buy" style="width:${pct.toFixed(1)}%">${pct.toFixed(1)}%</div>
        <div class="dp-split-sell" style="width:${(100 - pct).toFixed(1)}%">${(100 - pct).toFixed(1)}%</div>
      </div>
    </div>`;
  }

  function _renderLsPopupContent(metrics) {
    if (typeof MiniFloatingWindow === 'undefined') return;
    const rows = [
      _ratioRow('Trader Pos.', metrics?.topPosition),
      _ratioRow('Exposure', _takerAsRatio(metrics?.taker)),
      _ratioRow('Top Accts', metrics?.topAccount),
    ].filter(Boolean).join('');
    const html = rows
      ? `<div class="dp-bars-block" style="gap:12px; text-align:left;">${rows}</div>`
      : `<div style="text-align:center;">Veri yükleniyor...</div>`;
    MiniFloatingWindow.setContent('ls', html, 'LONG / SHORT');
  }

  /** taker.buyVol/sellVol (hacim) → _ratioRow'un beklediği {ratio} şekline çevirir. */
  function _takerAsRatio(taker) {
    if (!taker || taker.buyVol == null || taker.sellVol == null || !(taker.sellVol > 0)) return null;
    return { ratio: taker.buyVol / taker.sellVol };
  }

  function _lsUnsubscribe() {
    if (_lsSub && typeof LSDataStore !== 'undefined') {
      LSDataStore.unsubscribe(_lsSub.symbol, _lsSub.callback);
    }
    _lsSub = null;
  }

  function _lsSubscribe(pairSym) {
    _lsUnsubscribe();
    if (typeof LSDataStore === 'undefined') return;
    const callback = (metrics) => _applyLsMetrics(metrics);
    _lsSub = { symbol: pairSym, callback };
    LSDataStore.subscribe(pairSym, callback);
  }

  // ── loadSymbol çakışma koruması ───────────────────────────────────
  // loadSymbol() birbirinden bağımsız 3 yerden tetikleniyor: init(),
  // 'funding:loaded' ve 'symbol:change' event'leri. Fonksiyon async
  // olduğu için üçü de kendi fetch paketini (~12-15 istek) gönderiyordu
  // ve açılışta 4 kata kadar gereksiz REST trafiği oluşuyordu.
  //  - _loadInFlightKey : aynı coin+borsa için yükleme sürerken ikinci
  //                       çağrı hiç başlatılmaz.
  //  - _loadToken       : farklı bir coin istendiğinde eski (bayat)
  //                       yüklemenin sonucu ekrana yazılmaz.
  let _loadInFlightKey = null;
  let _loadToken = 0;

  // ── Paylasilan RSI hesaplayici ─────────────────────
  function _calcRsi(closes, period = 14) {
    if (closes.length <= period) return null;
    let gains = 0, losses = 0;
    for (let i = 1; i <= period; i++) {
      const diff = closes[i] - closes[i - 1];
      if (diff >= 0) gains += diff; else losses -= diff;
    }
    let avgGain = gains / period, avgLoss = losses / period;
    for (let i = period + 1; i < closes.length; i++) {
      const diff = closes[i] - closes[i - 1];
      if (diff >= 0) { avgGain = (avgGain * (period - 1) + diff) / period; avgLoss = (avgLoss * (period - 1)) / period; }
      else { avgGain = (avgGain * (period - 1)) / period; avgLoss = (avgLoss * (period - 1) - diff) / period; }
    }
    if (avgLoss === 0) return 100;
    return 100 - (100 / (1 + avgGain / avgLoss));
  }

  // tf: '1m' | '5m' | '1h'
  async function _fetchRsiForTf(tf) {
    if (!_currentSym) return;
    const pairSym  = _currentSym + 'USDT';
    const exchange = _currentExchange;
    try {
      if (exchange === 'bybit') {
        // Bybit: REST devam ediyor (ban riski düşük)
        const tfMap = { '1m': '1', '5m': '5', '1h': '60' };
        const interval = tfMap[tf];
        if (!interval) return;
        const resp = await fetch(`https://api.bybit.com/v5/market/kline?category=linear&symbol=${pairSym}&interval=${interval}&limit=100`);
        if (resp.ok) {
          const data = (await resp.json())?.result?.list || [];
          const closes = data.map(k => parseFloat(k[4])).reverse();
          _setRsi(tf, _calcRsi(closes));
        }
      } else {
        // Binance: Önce MarketDataStore klines cache'ine bak
        const mdsKlines = typeof MarketDataStore !== 'undefined'
          ? MarketDataStore.getKlines(pairSym, tf) : null;

        if (mdsKlines && mdsKlines.length >= 20) {
          // Cache'den hesapla — REST atmaya gerek yok
          const closes = mdsKlines.map(k => k.close);
          _setRsi(tf, _calcRsi(closes));
        } else {
          // Cache yok/yetersiz — tek seferlik REST, sonucu Store'a kaydet
          const resp = await fetch(`${AppConfig.API.binance.restFutures}/fapi/v1/klines?symbol=${pairSym}&interval=${tf}&limit=100`);
          if (resp.ok) {
            const data = await resp.json();
            if (typeof MarketDataStore !== 'undefined') {
              // Normalize edip Store'a kaydet — bir daha REST atmaz
              const candles = data.map(k => ({
                time:   Math.floor(k[0] / 1000),
                open:   parseFloat(k[1]),
                high:   parseFloat(k[2]),
                low:    parseFloat(k[3]),
                close:  parseFloat(k[4]),
                volume: parseFloat(k[5]),
              }));
              MarketDataStore.setKlines(pairSym, tf, candles);
            }
            _setRsi(tf, _calcRsi(data.map(k => parseFloat(k[4]))));
          }
        }
      }
    } catch {}
  }
  function _startFrTimer(nextTimeMs) {
    if (_frInterval) clearInterval(_frInterval);
    const el = document.getElementById('dp-fr-timer');
    if (!el) return;

    if (!nextTimeMs) {
      el.textContent = '—';
      return;
    }

    const updateTimer = () => {
      const now = Date.now();
      let secs = Math.floor((nextTimeMs - now) / 1000);
      if (secs < 0) secs = 0;
      
      const h = String(Math.floor(secs / 3600)).padStart(2, '0');
      const m = String(Math.floor((secs % 3600) / 60)).padStart(2, '0');
      const s = String(secs % 60).padStart(2, '0');
      if (el) el.textContent = `${h}:${m}:${s}`;
    };

    updateTimer(); // Initial call
    _frInterval = setInterval(updateTimer, 1000);
  }

  // ── Populate panel with data ──────────────────────
  function update(data) {
    // data: { sym, price, changePct, spotPrice, fr, frPct, rsi, lsRatio, oi, vol24h, liqVol }

    // Coin name
    const nameEl = document.getElementById('dp-coin-name');
    if (nameEl) nameEl.textContent = (data.sym || '—') + 'USDT.P';

    // Futures price
    const pfEl = document.getElementById('dp-price-futures');
    if (pfEl) pfEl.textContent = _fmt(data.price, 2);

    // % change
    const pcEl = document.getElementById('dp-price-change');
    if (pcEl) {
      const pct = parseFloat(data.changePct || 0);
      pcEl.textContent = (pct >= 0 ? '+' : '') + pct.toFixed(2) + '%';
      pcEl.className = 'dp-price-change ' + (pct >= 0 ? 'pos-chg' : 'neg-chg');
    }

    // Spot price
    const psEl = document.getElementById('dp-price-spot');
    if (psEl) {
      if (data.spotPrice) {
        psEl.textContent = _fmt(data.spotPrice);
        psEl.title = '';
      } else {
        psEl.innerHTML = '<span title="Spot pazarında işlem görmüyor" style="color:#f5a623;font-size:13px;">&#9888;</span>';
      }
    }

    // Funding
    const frEl = document.getElementById('dp-funding');
    if (frEl && data.frPct !== undefined) {
      const fr = parseFloat(data.frPct || 0);
      frEl.textContent = (fr >= 0 ? '+' : '') + fr.toFixed(4) + '%';
      frEl.className = 'dp-info-value ' + (fr >= 0 ? 'green' : 'red');
    }
    const frLabelEl = document.getElementById('dp-funding-label');
    if (frLabelEl) {
      frLabelEl.innerHTML = `Funding (<span style="color:var(--dp-amber)">${data.frIntervalText || '8h'}</span>)`;
    }

    // RSI cards (pass pre-calculated values or null)
    const rsiData = data.rsi || {};
    _setRsi('1m', rsiData['1m'] ?? null);
    _setRsi('5m', rsiData['5m'] ?? null);
    _setRsi('1h', rsiData['1h'] ?? null);
    _setRsi('4h', rsiData['4h'] ?? null);
    _setRsi('1d', rsiData['1d'] ?? null);

    // L/S ratio
    const lsRatio = parseFloat(data.lsRatio || 1);
    const lsPct   = (lsRatio / (1 + lsRatio)) * 100;
    const lsBuyEl  = document.getElementById('dp-ls-buy');
    const lsSellEl = document.getElementById('dp-ls-sell');
    if (lsBuyEl && lsSellEl) {
      lsBuyEl.style.width  = lsPct.toFixed(1) + '%';
      lsSellEl.style.width = (100 - lsPct).toFixed(1) + '%';
      document.getElementById('dp-ls-buy-pct').textContent  = lsPct.toFixed(1) + '%';
      document.getElementById('dp-ls-sell-pct').textContent = (100 - lsPct).toFixed(1) + '%';
    }
    const lsRatioEl = document.getElementById('dp-ls-ratio');
    if (lsRatioEl) lsRatioEl.textContent = lsRatio.toFixed(2);
    const lsDomEl = document.getElementById('dp-ls-dom');
    if (lsDomEl) lsDomEl.textContent = lsPct > 50 ? 'Uzun hakimiyeti' : 'Kısa hakimiyeti';

    // OI
    const oiEl = document.getElementById('dp-oi-val');
    if (oiEl) {
       let isOiUp = true;
       if (data.oiHistory && data.oiHistory.length > 1) {
          isOiUp = data.oiHistory[data.oiHistory.length - 1] >= data.oiHistory[data.oiHistory.length - 2];
       }
       const color = isOiUp ? 'var(--dp-green)' : 'var(--dp-red)';
       const arrow = isOiUp ? '↗' : '↘';
       const trendHtml = `<span style="font-size:11px; margin-left:3px; font-weight: bold;">${arrow}</span>`;
       oiEl.style.color = color;
       oiEl.innerHTML = `${Math.floor(data.oi).toLocaleString('en-US')}${trendHtml}`;
    }
    _buildOiBars(data.oiHistory || []);

    // Volume
    const volEl = document.getElementById('dp-vol-val');
    if (volEl) {
       const isVolUp = parseFloat(data.changePct || 0) >= 0;
       const color = isVolUp ? 'var(--dp-green)' : 'var(--dp-red)';
       const arrow = isVolUp ? '↗' : '↘';
       const trendHtml = `<span style="font-size:11px; margin-left:3px; font-weight: bold;">${arrow}</span>`;
       volEl.style.color = color;
       volEl.innerHTML = `${Math.floor(data.vol24h).toLocaleString('en-US')}${trendHtml}`;
    }

    // Liquidation
    const liqEl = document.getElementById('dp-liq-val');
    if (liqEl) liqEl.textContent = _fmtBig(data.liqVol);
    const liqSideEl = document.getElementById('dp-liq-side');
    if (liqSideEl) liqSideEl.textContent = data.liqSide || '—';

    // Start animations
    _startFrTimer(data.nextFundingTime);

    // Fundamental Spot Info
    if (data.cgData && data.cgData.market_data) {
       const md = data.cgData.market_data;
       const mcap = md.market_cap?.usd;
       const vol = md.total_volume?.usd;
       const circ = md.circulating_supply;
       const maxSupply = md.max_supply;
       const total = md.total_supply;
       const fdv = md.fully_diluted_valuation?.usd;
       
       const elMcapId = document.getElementById('dp-mcap-val');
       if(elMcapId) elMcapId.innerHTML = mcap ? `$${_fmtString(mcap)}` : '—';
       const elVolMcap = document.getElementById('dp-vol-mcap-val');
       if(elVolMcap && mcap && vol) elVolMcap.textContent = ((vol / mcap) * 100).toFixed(2) + '%';
       const elCirc = document.getElementById('dp-circ-val');
       if(elCirc) elCirc.innerHTML = circ ? `${_fmtString(circ)} <span class="dp-val-sub" style="color:var(--text-secondary)">${data.sym}</span>` : '—';
       const elMax = document.getElementById('dp-max-val');
       if(elMax) elMax.innerHTML = maxSupply ? `${_fmtString(maxSupply)} <span class="dp-val-sub" style="color:var(--text-secondary)">${data.sym}</span>` : '∞';
       const elTotal = document.getElementById('dp-total-val');
       if(elTotal) elTotal.innerHTML = total ? `${_fmtString(total)} <span class="dp-val-sub" style="color:var(--text-secondary)">${data.sym}</span>` : '—';
       const elFdv = document.getElementById('dp-fdv-val');
       if(elFdv) elFdv.innerHTML = fdv ? `$${_fmtString(fdv)}` : '—';
       
       // Calculate Market Cap % change
       const mcapPct = md.market_cap_change_percentage_24h;
       const mcapPctEl = document.getElementById('dp-mcap-pct');
       if(mcapPctEl) {
         if(mcapPct != null) {
            mcapPctEl.textContent = (mcapPct >= 0 ? '+' : '') + mcapPct.toFixed(2) + '%';
            mcapPctEl.className = 'dp-val-sub ' + (mcapPct >= 0 ? 'green' : 'red');
         } else {
            mcapPctEl.textContent = '';
         }
       }
    } else {
       // Reset to — 
       ['dp-mcap-val','dp-vol-mcap-val','dp-circ-val','dp-max-val','dp-total-val','dp-fdv-val'].forEach(id => {
          const el = document.getElementById(id);
          if(el) el.textContent = '—';
       });
       const pctEl = document.getElementById('dp-mcap-pct');
       if(pctEl) pctEl.textContent = '';
    }

    if (window.FloatingPanel) FloatingPanel.syncAll();

    // Coin Detail içeriği ilk panel yüksekliği hesaplanırken (init sırasında)
    // henüz placeholder ("—") haldeydi; gerçek veri geldikten sonra ölçümü
    // tazeliyoruz. Kullanıcı elle sürüklediyse (_loadManualHeight() dolu)
    // _applyDetailLayout zaten o değeri kullanır, otomatik ölçüm devreye
    // girmez — mevcut sürüklenmiş boyut bozulmaz.
    if (_activeTabId() === 'detail') _applyDetailLayout('detail');
  }

  // ── Load data for a symbol ────────────────────────
  async function _pollDetailData() {
    if (!_currentSym) return;
    const sym = _currentSym;
    const exchange = _currentExchange;
    const pairSym = sym + 'USDT';

    try {
      if (exchange === 'bybit') {
        const tk = await fetch(`https://api.bybit.com/v5/market/tickers?category=linear&symbol=${pairSym}`);
        if (tk.ok) {
          const d = (await tk.json())?.result?.list?.[0];
          if (d) {
            const price     = parseFloat(d.lastPrice);
            const changePct = parseFloat(d.price24hPcnt) * 100;
            const vol24h    = parseFloat(d.turnover24h);
            const rawFR  = window.FRDataBridge?.getLastFR('bybit', pairSym);
            const frPct = rawFR !== null && rawFR !== undefined ? rawFR : parseFloat(d.fundingRate) * 100;

            const pfEl = document.getElementById('dp-price-futures');
            if (pfEl) pfEl.textContent = _fmt(price);

            const pcEl = document.getElementById('dp-price-change');
            if (pcEl) {
              pcEl.textContent = (changePct >= 0 ? '+' : '') + changePct.toFixed(2) + '%';
              pcEl.className = 'dp-price-change ' + (changePct >= 0 ? 'pos-chg' : 'neg-chg');
            }

            const volEl = document.getElementById('dp-vol-val');
            if (volEl) {
              const isVolUp = changePct >= 0;
              const arrow = isVolUp ? '↗' : '↘';
              volEl.style.color = isVolUp ? 'var(--dp-green)' : 'var(--dp-red)';
              volEl.innerHTML = `${Math.floor(vol24h).toLocaleString('en-US')}<span style="font-size:11px;margin-left:3px;font-weight:bold;">${arrow}</span>`;
            }

            // Bridge'e besle + karşı borsa volume göster
            window.FRDataBridge?.feedVol('bybit', pairSym, vol24h);
            const altVol = window.FRDataBridge?.getLastVol('binance', pairSym);
            const altVolEl = document.getElementById('dp-vol-alt');
            if (altVolEl) {
              altVolEl.textContent = altVol ? `BN: ${_fmtOI(altVol.value)}` : '';
            }

            const frEl = document.getElementById('dp-funding');
            if (frEl) {
              frEl.textContent = (frPct >= 0 ? '+' : '') + frPct.toFixed(4) + '%';
              frEl.className = 'dp-info-value ' + (frPct >= 0 ? 'green' : 'red');
            }

            const nextFT = ExchangeRouter.getNextFundingTime(pairSym, 'bybit') || parseInt(d.nextFundingTime) || 0;
            if (nextFT) _startFrTimer(nextFT);
          }
        }

        const oiResp = await fetch(`https://api.bybit.com/v5/market/open-interest?category=linear&symbol=${pairSym}&intervalTime=5min&limit=8`);
        if (oiResp.ok) {
          const arr = (await oiResp.json())?.result?.list || [];
          const tkPrice = parseFloat((await (await fetch(`https://api.bybit.com/v5/market/tickers?category=linear&symbol=${pairSym}`)).json())?.result?.list?.[0]?.lastPrice || 0);
          const oiHistory = arr.map(x => parseFloat(x.openInterest) * (tkPrice || 1)).reverse();
          if (oiHistory.length) {
            const oi = oiHistory[oiHistory.length - 1];
            const isOiUp = oiHistory.length > 1 ? oiHistory[oiHistory.length - 1] >= oiHistory[oiHistory.length - 2] : true;

            // Bridge'e besle
            window.FRDataBridge?.feedOI('bybit', pairSym, oi);

            // Ana OI göster
            const oiEl = document.getElementById('dp-oi-val');
            if (oiEl) {
              oiEl.style.color = isOiUp ? 'var(--dp-green)' : 'var(--dp-red)';
              oiEl.innerHTML = `${Math.floor(oi).toLocaleString('en-US')}<span style="font-size:11px;margin-left:3px;font-weight:bold;">${isOiUp ? '↗' : '↘'}</span>`;
            }

            // Karşı borsa OI (Binance) — cache'den oku
            const altOI = window.FRDataBridge?.getLastOI('binance', pairSym);
            const altOIEl = document.getElementById('dp-oi-alt');
            if (altOIEl) {
              altOIEl.textContent = altOI ? `BN: ${_fmtOI(altOI.value)}` : '';
            }

            _buildOiBars(oiHistory);
          }
        }

        const lsResp = await fetch(`https://api.bybit.com/v5/market/account-ratio?category=linear&symbol=${pairSym}&period=5min&limit=1`);
        if (lsResp.ok) {
          const d = (await lsResp.json())?.result?.list?.[0];
          if (d) {
            const lsRatio = parseFloat(d.buyRatio) / parseFloat(d.sellRatio);
            const lsPct = (lsRatio / (1 + lsRatio)) * 100;
            const lsBuyEl  = document.getElementById('dp-ls-buy');
            const lsSellEl = document.getElementById('dp-ls-sell');
            if (lsBuyEl && lsSellEl) {
              lsBuyEl.style.width  = lsPct.toFixed(1) + '%';
              lsSellEl.style.width = (100 - lsPct).toFixed(1) + '%';
              document.getElementById('dp-ls-buy-pct').textContent  = lsPct.toFixed(1) + '%';
              document.getElementById('dp-ls-sell-pct').textContent = (100 - lsPct).toFixed(1) + '%';
            }
            const lsRatioEl = document.getElementById('dp-ls-ratio');
            if (lsRatioEl) lsRatioEl.textContent = lsRatio.toFixed(2);
          }
        }

      } else {
        // ── BİNANCE — Ticker ve FR: MarketDataStore'dan oku (REST atmaz) ──
        const mdsTicker = typeof MarketDataStore !== 'undefined'
          ? MarketDataStore.getTicker(pairSym) : null;
        const mdsFR     = typeof MarketDataStore !== 'undefined'
          ? MarketDataStore.getFR(pairSym)     : null;

        // ─ Ticker (fiyat, değişim, hacim) ─
        if (mdsTicker) {
          const price     = mdsTicker.price;
          const changePct = mdsTicker.pct24h;
          const vol24h    = mdsTicker.volume24h;

          const pfEl = document.getElementById('dp-price-futures');
          if (pfEl) pfEl.textContent = _fmt(price);

          const pcEl = document.getElementById('dp-price-change');
          if (pcEl) {
            pcEl.textContent = (changePct >= 0 ? '+' : '') + changePct.toFixed(2) + '%';
            pcEl.className = 'dp-price-change ' + (changePct >= 0 ? 'pos-chg' : 'neg-chg');
          }

          const volEl = document.getElementById('dp-vol-val');
          if (volEl) {
            const isVolUp = changePct >= 0;
            const arrow = isVolUp ? '↗' : '↘';
            volEl.style.color = isVolUp ? 'var(--dp-green)' : 'var(--dp-red)';
            volEl.innerHTML = `${Math.floor(vol24h).toLocaleString('en-US')}<span style="font-size:11px;margin-left:3px;font-weight:bold;">${arrow}</span>`;
          }

          window.FRDataBridge?.feedVol('binance', pairSym, vol24h);
          const altVol = window.FRDataBridge?.getLastVol('bybit', pairSym);
          const altVolEl = document.getElementById('dp-vol-alt');
          if (altVolEl) altVolEl.textContent = altVol ? `BY: ${_fmtOI(altVol.value)}` : '';
        } else {
          // MDS henüz hazır değilse (sayfa ilk yüklenmesi) — tek seferlik REST fallback
          const tk = await fetch(`${AppConfig.API.binance.restFutures}/fapi/v1/ticker/24hr?symbol=${pairSym}`);
          if (tk.ok) {
            const d = await tk.json();
            const pfEl = document.getElementById('dp-price-futures');
            if (pfEl) pfEl.textContent = _fmt(parseFloat(d.lastPrice));
            const pcEl = document.getElementById('dp-price-change');
            if (pcEl) {
              const c = parseFloat(d.priceChangePercent);
              pcEl.textContent = (c >= 0 ? '+' : '') + c.toFixed(2) + '%';
              pcEl.className = 'dp-price-change ' + (c >= 0 ? 'pos-chg' : 'neg-chg');
            }
          }
        }

        // ─ Funding Rate ─
        if (mdsFR) {
          const frPct = mdsFR.rate; // MarketDataStore zaten % cinsinden tutuyor
          const frEl = document.getElementById('dp-funding');
          if (frEl) {
            frEl.textContent = (frPct >= 0 ? '+' : '') + frPct.toFixed(4) + '%';
            frEl.className = 'dp-info-value ' + (frPct >= 0 ? 'green' : 'red');
          }
          const nextFT = mdsFR.nextFundingTime ||
            ExchangeRouter.getNextFundingTime(pairSym, 'binance');
          if (nextFT) _startFrTimer(nextFT);
        } else {
          // MDS hazir degilse fallback REST
          const fr = await fetch(`${AppConfig.API.binance.restFutures}/fapi/v1/premiumIndex?symbol=${pairSym}`);
          if (fr.ok) {
            const d = await fr.json();
            const frPct = parseFloat(d.lastFundingRate || 0) * 100;
            const frEl = document.getElementById('dp-funding');
            if (frEl) {
              frEl.textContent = (frPct >= 0 ? '+' : '') + frPct.toFixed(4) + '%';
              frEl.className = 'dp-info-value ' + (frPct >= 0 ? 'green' : 'red');
            }
            const nextFT = ExchangeRouter.getNextFundingTime(pairSym, 'binance') || parseInt(d.nextFundingTime || 0);
            if (nextFT) _startFrTimer(nextFT);
          }
        }

        // ─ OI Tarihi — WebSocket yok, REST zorunlu ─
        const oiResp = await fetch(`${AppConfig.API.binance.restFutures}/futures/data/openInterestHist?symbol=${pairSym}&period=5m&limit=8`);
        if (oiResp.ok) {
          const arr = await oiResp.json();
          const oiHistory = arr.map(x => parseFloat(x.sumOpenInterestValue || x.openInterest || 0));
          if (oiHistory.length) {
            const oi = oiHistory[oiHistory.length - 1];
            const isOiUp = oiHistory.length > 1 ? oiHistory[oiHistory.length - 1] >= oiHistory[oiHistory.length - 2] : true;
            window.FRDataBridge?.feedOI('binance', pairSym, oi);
            const oiEl = document.getElementById('dp-oi-val');
            if (oiEl) {
              oiEl.style.color = isOiUp ? 'var(--dp-green)' : 'var(--dp-red)';
              oiEl.innerHTML = `${Math.floor(oi).toLocaleString('en-US')}<span style="font-size:11px;margin-left:3px;font-weight:bold;">${isOiUp ? '↗' : '↘'}</span>`;
            }
            const altOI = window.FRDataBridge?.getLastOI('bybit', pairSym);
            const altOIEl = document.getElementById('dp-oi-alt');
            if (altOIEl) altOIEl.textContent = altOI ? `BY: ${_fmtOI(altOI.value)}` : '';
            _buildOiBars(oiHistory);
          }
        }

        // L/S artık burada ayrıca çekilmiyor — loadSymbol() içinde kurulan
        // LSDataStore aboneliği (_lsSubscribe) kendi 30sn döngüsüyle
        // _applyLsMetrics'i tetikleyip DOM'u zaten canlı tutuyor.
      }
    } catch (e) {
      console.warn('[DetailPanel] Poll error:', e);
    }

    // ── RSI Kadansi ─────────────────────────────────
    // _pollCount her 10sn artiyor:
    // 1m  → her 60sn  → _pollCount % 6 === 0
    // 5m  → her 300sn → _pollCount % 30 === 0
    // 1h  → her 900sn → _pollCount % 90 === 0
    // 4h ve 1d sadece coin seciminde (loadSymbol) guncellenir
    if (_pollCount % 6 === 0)  _fetchRsiForTf('1m');
    if (_pollCount % 30 === 0) _fetchRsiForTf('5m');
    if (_pollCount % 90 === 0) _fetchRsiForTf('1h');

    _pollCount++;
  }

  function _startPolling() {
    if (_pollTimer) clearInterval(_pollTimer);
    _pollCount = 0; // Sayaci sifirla, yeni coin icin
    _pollDetailData(); // Aninda bir kere calistir
    _pollTimer = setInterval(_pollDetailData, 10000); // Her 10 saniyede guncelle
  }

  function _stopPolling() {
    if (_pollTimer) { clearInterval(_pollTimer); _pollTimer = null; }
  }

  async function loadSymbol(sym, exchange = 'binance') {
    const loadKey = `${sym.replace(/USDT$/, '')}|${exchange}`;

    // Aynı coin+borsa için zaten bir yükleme sürüyorsa ikinciyi başlatma.
    // (Açılışta init/funding:loaded/symbol:change üçü de aynı coini istiyor.)
    if (_loadInFlightKey === loadKey) return;

    _loadInFlightKey = loadKey;
    const myToken = ++_loadToken;   // bu yüklemenin sıra numarası

    _currentSym = sym.replace(/USDT$/, '');
    _currentExchange = exchange;
    sym = sym.replace(/USDT$/, '');
    const nameEl = document.getElementById('dp-coin-name');
    if (nameEl) nameEl.textContent = sym + 'USDT.P';
    const pairSym = sym + 'USDT';

    // ── Sunucudan geçmiş FR verisini preload et (her iki borsa için) ──
    // Sayfa yeni açılmış olsa bile grafik 48 saatlik geçmiş veriye sahip olur.
    // Fire-and-forget: UI'yi bloklamaz, arka planda yüklenir.
    try {
      const binTr = window['frTracker_binance'];
      const bbtTr = window['frTracker_bybit'];
      if (binTr?.preloadFromServer) binTr.preloadFromServer(pairSym, 'binance', 48);
      if (bbtTr?.preloadFromServer) bbtTr.preloadFromServer(pairSym, 'bybit',   48);
    } catch {}

    try {
      let price = null, changePct = null, vol24h = null;
      let frPct = null, nextFundingTime = null, frIntervalText = '8h';
      let oi = null, oiHistory = [];
      let lsRatio = 1;
      let spotPrice = null;
      let rsiData = {};

      if (exchange === 'bybit') {
        // LSDataStore şu an sadece Binance'i destekliyor — Bybit'e geçerken
        // eski (Binance) aboneliği bırak, Bybit tarafı kendi doğrudan
        // fetch'ini kullanmaya devam eder (faz 2'de LSDataStore'a taşınacak).
        _lsUnsubscribe();

        // ── Ticker (fiyat, chg, vol, funding) ──
        try {
          const tk = await fetch(`https://api.bybit.com/v5/market/tickers?category=linear&symbol=${pairSym}`);
          if (tk.ok) {
            const d = (await tk.json())?.result?.list?.[0];
            if (d) {
              price      = parseFloat(d.lastPrice);
              changePct  = parseFloat(d.price24hPcnt) * 100;
              vol24h     = parseFloat(d.turnover24h);
              frPct      = parseFloat(d.fundingRate) * 100;
              oi         = parseFloat(d.openInterestValue || 0);
              nextFundingTime = ExchangeRouter.getNextFundingTime(pairSym, 'bybit') || parseInt(d.nextFundingTime) || 0;
              frIntervalText  = ExchangeRouter.getFundingInterval(pairSym, 'bybit');
            }
          }
        } catch {}

        // ── Spot ──
        try {
          const sp = await fetch(`https://api.bybit.com/v5/market/tickers?category=spot&symbol=${pairSym}`);
          if (sp.ok) {
            const d = (await sp.json())?.result?.list?.[0];
            if (d) spotPrice = parseFloat(d.lastPrice);
          }
        } catch {}

        // ── OI history ──
        try {
          const oiResp = await fetch(`https://api.bybit.com/v5/market/open-interest?category=linear&symbol=${pairSym}&intervalTime=5min&limit=8`);
          if (oiResp.ok) {
            const arr = (await oiResp.json())?.result?.list || [];
            oiHistory = arr.map(x => parseFloat(x.openInterest) * (price || 1)).reverse();
          }
        } catch {}

        // ── L/S ratio ──
        try {
          const lsResp = await fetch(`https://api.bybit.com/v5/market/account-ratio?category=linear&symbol=${pairSym}&period=5min&limit=1`);
          if (lsResp.ok) {
            const d = (await lsResp.json())?.result?.list?.[0];
            if (d) lsRatio = parseFloat(d.buyRatio) / parseFloat(d.sellRatio);
          }
        } catch {}

        // ── RSI ──
        try {
          const tfMap = { '1m': '1', '5m': '5', '1h': '60', '4h': '240', '1d': 'D' };
          const calcRsi = (closes, period = 14) => {
            if (closes.length <= period) return null;
            let gains = 0, losses = 0;
            for (let i = 1; i <= period; i++) {
              const diff = closes[i] - closes[i - 1];
              if (diff >= 0) gains += diff; else losses -= diff;
            }
            let avgGain = gains / period, avgLoss = losses / period;
            for (let i = period + 1; i < closes.length; i++) {
              const diff = closes[i] - closes[i - 1];
              if (diff >= 0) { avgGain = (avgGain * (period-1) + diff) / period; avgLoss = (avgLoss * (period-1)) / period; }
              else { avgGain = (avgGain * (period-1)) / period; avgLoss = (avgLoss * (period-1) - diff) / period; }
            }
            if (avgLoss === 0) return 100;
            return 100 - (100 / (1 + avgGain / avgLoss));
          };
          const results = await Promise.all(Object.entries(tfMap).map(async ([tf, interval]) => {
            const resp = await fetch(`https://api.bybit.com/v5/market/kline?category=linear&symbol=${pairSym}&interval=${interval}&limit=100`);
            if (resp.ok) {
              const data = (await resp.json())?.result?.list || [];
              const closes = data.map(k => parseFloat(k[4])).reverse();
              return [tf, calcRsi(closes)];
            }
            return [tf, null];
          }));
          results.forEach(([tf, val]) => rsiData[tf] = val);
        } catch {}

      } else {
        // ── BINANCE ──
        try {
          const tk = await fetch(`${AppConfig.API.binance.restFutures}/fapi/v1/ticker/24hr?symbol=${pairSym}`);
          if (tk.ok) {
            const d = await tk.json();
            price     = parseFloat(d.lastPrice);
            changePct = parseFloat(d.priceChangePercent);
            vol24h    = parseFloat(d.quoteVolume);
          }
        } catch {}

        try {
          const spotSym = pairSym.replace(/^1000000/, '').replace(/^10000/, '').replace(/^1000/, '');
          const sp = await fetch(`${AppConfig.API.binance.restSpot}/api/v3/ticker/price?symbol=${spotSym}`);
          if (sp.ok) { const d = await sp.json(); if (d.price) spotPrice = parseFloat(d.price); }
        } catch {}

        try {
          const fr = await fetch(`${AppConfig.API.binance.restFutures}/fapi/v1/premiumIndex?symbol=${pairSym}`);
          if (fr.ok) {
            const d = await fr.json();
            frPct = parseFloat(d.lastFundingRate || 0) * 100;
            nextFundingTime = ExchangeRouter.getNextFundingTime(pairSym, 'binance') || parseInt(d.nextFundingTime || 0);
          }
        } catch {}

        try {
          const frHist = await fetch(`${AppConfig.API.binance.restFutures}/fapi/v1/fundingRate?symbol=${pairSym}&limit=2`);
          if (frHist.ok) {
            const d = await frHist.json();
            if (d.length === 2) {
              const hours = Math.round((parseInt(d[1].fundingTime) - parseInt(d[0].fundingTime)) / 3600000);
              if (hours > 0) frIntervalText = hours + 'h';
            }
          }
        } catch {}

        try {
          const oiLive = await fetch(`${AppConfig.API.binance.restFutures}/fapi/v1/openInterest?symbol=${pairSym}`);
          if (oiLive.ok) {
            const data = await oiLive.json();
            oi = parseFloat(data.openInterest) * (price || 1);
          }
        } catch {}

        try {
          const oiResp = await fetch(`${AppConfig.API.binance.restFutures}/futures/data/openInterestHist?symbol=${pairSym}&period=5m&limit=8`);
          if (oiResp.ok) {
            const arr = await oiResp.json();
            oiHistory = arr.map(x => parseFloat(x.sumOpenInterestValue || x.openInterest || 0));
          }
        } catch {}

        try {
          const tfs = ['1m', '5m', '1h', '4h', '1d'];
          const calcRsi = (closes, period = 14) => {
            if (closes.length <= period) return null;
            let gains = 0, losses = 0;
            for (let i = 1; i <= period; i++) { const diff = closes[i] - closes[i-1]; if (diff >= 0) gains += diff; else losses -= diff; }
            let avgGain = gains / period, avgLoss = losses / period;
            for (let i = period + 1; i < closes.length; i++) {
              const diff = closes[i] - closes[i-1];
              if (diff >= 0) { avgGain = (avgGain*(period-1)+diff)/period; avgLoss = (avgLoss*(period-1))/period; }
              else { avgGain = (avgGain*(period-1))/period; avgLoss = (avgLoss*(period-1)-diff)/period; }
            }
            if (avgLoss === 0) return 100;
            return 100 - (100 / (1 + avgGain / avgLoss));
          };
          const results = await Promise.all(tfs.map(async tf => {
            const resp = await fetch(`${AppConfig.API.binance.restFutures}/fapi/v1/klines?symbol=${pairSym}&interval=${tf}&limit=100`);
            if (resp.ok) { const data = await resp.json(); return calcRsi(data.map(k => parseFloat(k[4]))); }
            return null;
          }));
          tfs.forEach((tf, i) => rsiData[tf] = results[i]);
        } catch {}

        // L/S — LSDataStore'dan (kendi fetch'ini atmaz, BotEngine kuyruğu üzerinden
        // gider). Önbellekte varsa anında kullan, yoksa subscribe kendi backfill'ini
        // tetikleyip _applyLsMetrics üzerinden DOM'u ayrıca güncelleyecek.
        try {
          const cached = typeof LSDataStore !== 'undefined' ? LSDataStore.get(pairSym) : null;
          if (cached?.global?.ratio != null) lsRatio = cached.global.ratio;
          _lsSubscribe(pairSym);
        } catch {}
      }

      // ── CoinGecko (ortak) ──
      let cgData = null;
      try {
        let searchSym = sym.replace(/^10000?/, '').toLowerCase();
        if (!window.cgSymbolCache) window.cgSymbolCache = {};
        let cgId = window.cgSymbolCache[searchSym];
        if (!cgId) {
          const searchResp = await fetch(`https://api.coingecko.com/api/v3/search?query=${searchSym}`);
          if (searchResp.ok) {
            const searchData = await searchResp.json();
            const match = searchData.coins.find(c => c.symbol.toLowerCase() === searchSym);
            if (match) { cgId = match.id; window.cgSymbolCache[searchSym] = cgId; }
          }
        }
        if (cgId) {
          const coinResp = await fetch(`https://api.coingecko.com/api/v3/coins/${cgId}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=false`);
          if (coinResp.ok) cgData = await coinResp.json();
        }
      } catch {}

      // Bu yükleme sürerken kullanıcı başka bir coine geçtiyse sonuç bayat —
      // ekrana yazma, yoksa yeni coinin verisinin üstüne eskisi biner.
      if (myToken !== _loadToken) return;

      update({ sym, price, changePct, spotPrice, frPct, nextFundingTime, frIntervalText, oi, oiHistory, vol24h, lsRatio, rsi: rsiData, cgData, exchange });
      _startPolling();
    } catch (e) {
      console.error('[DetailPanel] Load error:', e);
    } finally {
      // Sadece bu yükleme hâlâ güncel olanıysa kilidi bırak; aksi halde
      // daha yeni bir loadSymbol çalışıyordur, onun kilidini silme.
      if (myToken === _loadToken) _loadInFlightKey = null;
    }
  }



  // ── Init ──────────────────────────────────────────
  function init() {
    // Tab switching inside detail
    document.querySelectorAll('.detail-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        document.querySelectorAll('.detail-tab').forEach(t => t.classList.toggle('active', t === tab));
        const tabId = tab.dataset.tab;
        
        const detailTab = document.getElementById('dp-detail-tab');
        const signalsTab = document.getElementById('dp-signals-tab');
        const newsTab = document.getElementById('dp-news-tab');
        
        if (detailTab) detailTab.style.display = tabId === 'detail' ? 'block' : 'none';
        if (signalsTab) signalsTab.style.display = tabId === 'signals' ? 'block' : 'none';
        if (newsTab) newsTab.style.display = tabId === 'news' ? 'block' : 'none';

        // Bot Signals'ın SE/arama/snipe/sırala kontrolleri sekme çubuğunda
        // yaşıyor (bkz. bot-signals-panel.js) — sadece o sekme aktifken görünür.
        const tabbarControls = document.getElementById('bsp-tabbar-controls');
        if (tabbarControls) {
          tabbarControls.style.display = tabId === 'signals' ? 'flex' : 'none';
          if (tabId === 'signals' && window.BotSignalsPanel) BotSignalsPanel.render();
        }

        // News'in snipe/sırala kontrolleri de aynı yerde yaşıyor (bkz. news-api.js).
        const newsControls = document.getElementById('news-tabbar-controls');
        if (newsControls) {
          newsControls.style.display = tabId === 'news' ? 'flex' : 'none';
          if (tabId === 'news' && window.NewsAPI) NewsAPI.onTabActivated();
        }

        _applyDetailLayout(tabId);
      });
    });
    _applyDetailLayout('detail'); // sayfa yüklenince varsayılan sekme
    _initResizeDrag();

    // Web fontlar (JetBrains Mono vb.) display:swap ile asenkron yükleniyor.
    // İlk ölçüm genelde fallback font metrikleriyle (biraz daha uzun) alınıyor;
    // gerçek font yüklenince metin kısalabiliyor ve panelin altında boşluk
    // kalıyordu. Fontlar hazır olunca tek seferlik yeniden ölçüyoruz.
    document.fonts?.ready?.then(() => {
      if (_activeTabId() === 'detail') _applyDetailLayout('detail');
    });

    // Popout button (floating panel toggle)
    document.getElementById('detail-popout')?.addEventListener('click', () => {
      if (window.FloatingPanel) FloatingPanel.toggle();
    });

    // L/S popup'u — Trader Positioning/Exposure/Top Accounts (bkz. yukarıdaki
    // _renderLsPopupContent). OI Değişimi popup'u hâlâ boş, ayrı bir iş.
    document.getElementById('dp-ls-popout')?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (window.MiniFloatingWindow) MiniFloatingWindow.toggle('ls', 'LONG / SHORT');
    });
    document.getElementById('dp-oi-popout')?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (window.MiniFloatingWindow) MiniFloatingWindow.toggle('oi', 'OI DEĞİŞİMİ');
    });

    // Listen for symbol change
    EventBus.on('symbol:change', ({ symbol, exchange }) => {
      if (symbol) {
        _stopPolling(); // Eski coin icin polling durdur
        loadSymbol(symbol.replace(/USDT$/, ''), exchange || 'binance');
      }
    });

    // Listen to live price updates to sync perfectly with Top Strip
    EventBus.on('chart:price:update', ({ price }) => {
      const pfEl = document.getElementById('dp-price-futures');
      if (pfEl) pfEl.textContent = _fmt(price);
    });

    // ── ScalpFR Signals Tab ───────────────────────────────────────────
    if (typeof BotSignalsPanel !== 'undefined') {
      BotSignalsPanel.init();

      // ── FAZ 1 (Görev 4, 2026-08-07) — küçük sabit alt kümeyle yeniden açıldı ──
      // Eski REST polling (2026-07-31'de burada kapatılmıştı — ~2500 istek/5dk,
      // 34 saniyede ban) artık m1hammer-scanner.js'de WebSocket'e taşındı.
      // TEST_SYMBOLS sadece 8 sembolle sınırlı, backfill tek seferlik ve
      // 429/418 (BAN_SIGNAL) görürse otomatik durur. Genişletme ayrı onay ister
      // (bkz. m1hammer-scanner.js başlığı ve dokumentasyon/gorevler/siradaki-gorevler.md).
      if (window.M1HammerScanner) M1HammerScanner.start();

      // Kom1Scanner (gorevler3.md Görev 4, 2026-08-10) — gerçek sinyal üretimi
      // canlıya alındı. Kendi ayrı BotEngine kuyruğu/backfill akışı var (11 coin
      // × 1H/4H, bkz. kom1-scanner.js başlığı) — M1Hammer'ınkinden bağımsız.
      if (window.Kom1Scanner) Kom1Scanner.start();
    }

    // New signal arrived → re-render
    EventBus.on('scalp:frSignal', () => {
      if (typeof BotSignalsPanel !== 'undefined') BotSignalsPanel.render();
    });

    // Also catch native event (fired by ScalpFRMonitor)
    window.addEventListener('scalpFRSignal', () => {
      if (typeof BotSignalsPanel !== 'undefined') BotSignalsPanel.render();
    });

    // Load default symbol
    const defaultSym = State.get('activeSymbol') || 'BTC';
    loadSymbol(defaultSym.replace(/USDT$/, ''), State.get('activeExchange') || 'binance');

    console.log('[DetailPanel] Initialized ✓');
    EventBus.on('funding:loaded', () => {
      const sym = State.get('activeSymbol') || 'BTC';
      const exchange = State.get('activeExchange') || 'binance';
      loadSymbol(sym.replace(/USDT$/, ''), exchange);
    });

    // ── Visibility API — arka plan / ön plan geçişi ──────────────────
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        // Sayfa arka plana geçti — polling'i yavaşlat (pil/bant genişliği tasarrufu)
        _stopPolling();
        _pollTimer = setInterval(_pollDetailData, 30000); // 30sn'ye düşür
      } else {
        // Sayfa öne geldi — hemen güncelle, normal hıza dön
        _stopPolling();
        _pollDetailData(); // Anında bir kere çalıştır
        _pollTimer = setInterval(_pollDetailData, 10000); // 10sn'ye geri al
      }
    });
  }

  return { init, update, loadSymbol, applyLayout: _applyDetailLayout };
})();
