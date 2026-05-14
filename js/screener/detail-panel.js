/**
 * DetailPanel
 * detail_panel.html'deki tüm JS mantığı burada.
 * Coin seçildiğinde (EventBus: 'symbol:change') paneli günceller.
 */
const DetailPanel = (() => {

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

  // ── Orderbook blink animation ─────────────────────
  let _obInterval = null;
  function _startObSim(buyPct) {
    if (_obInterval) clearInterval(_obInterval);
    let tick = 0;
    _obInterval = setInterval(() => {
      tick++;
      const buy = Math.min(85, Math.max(15, buyPct + Math.round(Math.sin(tick * 0.4) * 8)));
      const sell = 100 - buy;
      const buyEl  = document.getElementById('dp-ob-buy');
      const sellEl = document.getElementById('dp-ob-sell');
      if (buyEl)  { buyEl.style.width  = buy  + '%'; buyEl.textContent  = buy.toFixed(1)  + '%'; }
      if (sellEl) { sellEl.style.width = sell + '%'; sellEl.textContent = sell.toFixed(1) + '%'; }
    }, 1500);
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
        psEl.innerHTML = '<span title="Binance Spot pazarında işlem görmüyor" style="color:#f5a623;font-size:13px;">&#9888;</span>';
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
    _startObSim(Math.round(lsPct));

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
  }

  // ── Load data for a symbol ────────────────────────
  async function loadSymbol(sym, exchange) {
    if (!sym) return;
    sym = sym.replace(/USDT$/, '');

    const nameEl = document.getElementById('dp-coin-name');
    if (nameEl) nameEl.textContent = sym + 'USDT.P';

    // Forcing Binance fapi for these endpoints since Bybit doesn't have them on these paths
    const pairSym = sym + 'USDT';

    try {
      // ── 24hr ticker ─────────────────────────────
      let price = null, changePct = null, vol24h = null;
      try {
        const tk = await fetch(`${AppConfig.API.binance.restFutures}/fapi/v1/ticker/24hr?symbol=${pairSym}`);
        if (tk.ok) {
          const d = await tk.json();
          price     = parseFloat(d.lastPrice);
          changePct = parseFloat(d.priceChangePercent);
          vol24h    = parseFloat(d.quoteVolume);
        }
      } catch {}

      // ── Spot Price ──────────────────────────────
      let spotPrice = null;
      try {
        // Strip futures-only prefixes: 1000PEPE -> PEPE, 1000SATS -> SATS etc.
        const spotSym = pairSym
          .replace(/^1000000/, '')   // 1000000X -> X
          .replace(/^10000/, '')     // 10000X   -> X
          .replace(/^1000/, '');     // 1000X    -> X
        const spotResp = await fetch(`${AppConfig.API.binance.restSpot}/api/v3/ticker/price?symbol=${spotSym}`);
        if (spotResp.ok) {
          const d = await spotResp.json();
          if (d.price) spotPrice = parseFloat(d.price);
        }
        // If still null, the coin may not trade on spot (e.g. DRIFT, PIXEL)
      } catch {}

      // ── Funding rate & Time ─────────────────────────────
      let frPct = null, nextFundingTime = null, frIntervalText = '8h';
      try {
        const fr = await fetch(`${AppConfig.API.binance.restFutures}/fapi/v1/premiumIndex?symbol=${pairSym}`);
        if (fr.ok) {
          const d = await fr.json();
          frPct = parseFloat(d.lastFundingRate || 0) * 100;
          nextFundingTime = parseInt(d.nextFundingTime || 0);
        }
      } catch {}

      try {
         // Interval hesaplama: Son 2 gerçekleşmiş funding ödemesi aralığı
         const frHist = await fetch(`${AppConfig.API.binance.restFutures}/fapi/v1/fundingRate?symbol=${pairSym}&limit=2`);
         if(frHist.ok){
            const d = await frHist.json();
            if(d.length === 2){
               const diffMs = parseInt(d[1].fundingTime) - parseInt(d[0].fundingTime);
               const hours = Math.round(diffMs / 3600000);
               if(hours > 0) frIntervalText = hours + 'h';
            }
         }
      } catch {}

      // ── Open Interest history ────────────────────
      let oi = null, oiHistory = [];
      try {
        const oiResp = await fetch(`${AppConfig.API.binance.restFutures}/futures/data/openInterestHist?symbol=${pairSym}&period=5m&limit=8`);
        if (oiResp.ok) {
          const arr = await oiResp.json();
          oiHistory = arr.map(x => parseFloat(x.sumOpenInterestValue || x.openInterest || 0));
          if (oiHistory.length) oi = oiHistory[oiHistory.length - 1];
        }
      } catch {}

      // ── RSI (1m, 5m, 1h, 4h, 1d) ───────────────────
      let rsiData = {};
      try {
         const tfs = ['1m', '5m', '1h', '4h', '1d'];
         const calcRsi = (closes, period = 14) => {
            if (closes.length <= period) return null;
            let gains = 0, losses = 0;
            for (let i = 1; i <= period; i++) {
               let diff = closes[i] - closes[i - 1];
               if (diff >= 0) gains += diff;
               else losses -= diff;
            }
            let avgGain = gains / period;
            let avgLoss = losses / period;
            for (let i = period + 1; i < closes.length; i++) {
               let diff = closes[i] - closes[i - 1];
               if (diff >= 0) {
                  avgGain = (avgGain * (period - 1) + diff) / period;
                  avgLoss = (avgLoss * (period - 1)) / period;
               } else {
                  avgGain = (avgGain * (period - 1)) / period;
                  avgLoss = (avgLoss * (period - 1) - diff) / period;
               }
            }
            if (avgLoss === 0) return 100;
            return 100 - (100 / (1 + (avgGain / avgLoss)));
         };

         const fetchRsi = async (tf) => {
            const resp = await fetch(`${AppConfig.API.binance.restFutures}/fapi/v1/klines?symbol=${pairSym}&interval=${tf}&limit=100`);
            if (resp.ok) {
               const data = await resp.json();
               const closes = data.map(k => parseFloat(k[4])); 
               return calcRsi(closes);
            }
            return null;
         };
         
         const results = await Promise.all(tfs.map(tf => fetchRsi(tf)));
         tfs.forEach((tf, i) => rsiData[tf] = results[i]);
      } catch {}

      // ── Global L/S ratio ────────────────────────
      let lsRatio = 1;
      try {
        const lsResp = await fetch(`${AppConfig.API.binance.restFutures}/futures/data/globalLongShortAccountRatio?symbol=${pairSym}&period=5m&limit=1`);
        if (lsResp.ok) {
          const lsArr = await lsResp.json();
          lsRatio = parseFloat(lsArr[0]?.longShortRatio || 1);
        }
      } catch {}

      // ── Fundamental Info (CoinGecko) ────────────
      let cgData = null;
      try {
        let searchSym = sym.replace(/^10000?/, '').toLowerCase(); // Fix 1000PEPE -> pepe
        if (!window.cgSymbolCache) window.cgSymbolCache = {};
        let cgId = window.cgSymbolCache[searchSym];
        
        if (!cgId) {
          const searchResp = await fetch(`https://api.coingecko.com/api/v3/search?query=${searchSym}`);
          if (searchResp.ok) {
            const searchData = await searchResp.json();
            const match = searchData.coins.find(c => c.symbol.toLowerCase() === searchSym);
            if (match) {
              cgId = match.id;
              window.cgSymbolCache[searchSym] = cgId;
            }
          }
        }

        if (cgId) {
          const coinResp = await fetch(`https://api.coingecko.com/api/v3/coins/${cgId}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=false`);
          if (coinResp.ok) {
             cgData = await coinResp.json();
          }
        }
      } catch (e) {}

      update({ sym, price, changePct, spotPrice, frPct, nextFundingTime, frIntervalText, oi, oiHistory, vol24h, lsRatio, rsi: rsiData, cgData });

    } catch (e) {
      console.error('[DetailPanel] Load error:', e);
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
      });
    });

    // Popout button
    document.getElementById('detail-popout')?.addEventListener('click', () => {
      window.open('index.html#popout', 'DetailPanel', 'width=350,height=750,toolbar=no,menubar=no,scrollbars=yes');
    });

    // Listen for symbol change
    EventBus.on('symbol:change', ({ symbol, exchange }) => {
      if (symbol) loadSymbol(symbol.replace(/USDT$/, ''), exchange || 'binance');
    });

    // Listen to live price updates to sync perfectly with Top Strip
    EventBus.on('chart:price:update', ({ price }) => {
      const pfEl = document.getElementById('dp-price-futures');
      if (pfEl) pfEl.textContent = _fmt(price);
    });

    // Load default symbol
    const defaultSym = State.get('activeSymbol') || 'BTC';
    loadSymbol(defaultSym.replace(/USDT$/, ''), State.get('activeExchange') || 'binance');

    console.log('[DetailPanel] Initialized ✓');
  }

  return { init, update, loadSymbol };
})();
