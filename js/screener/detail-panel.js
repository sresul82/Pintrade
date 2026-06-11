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
    const pairSym = _currentSym + 'USDT';
    const exchange = _currentExchange;
    try {
      if (exchange === 'bybit') {
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
        const resp = await fetch(`${AppConfig.API.binance.restFutures}/fapi/v1/klines?symbol=${pairSym}&interval=${tf}&limit=100`);
        if (resp.ok) {
          const data = await resp.json();
          _setRsi(tf, _calcRsi(data.map(k => parseFloat(k[4]))));
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

    if (window.FloatingPanel) FloatingPanel.syncAll();
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
        // ── BINANCE ──
        const tk = await fetch(`${AppConfig.API.binance.restFutures}/fapi/v1/ticker/24hr?symbol=${pairSym}`);
        if (tk.ok) {
          const d = await tk.json();
          const price     = parseFloat(d.lastPrice);
          const changePct = parseFloat(d.priceChangePercent);
          const vol24h    = parseFloat(d.quoteVolume);

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
          window.FRDataBridge?.feedVol('binance', pairSym, vol24h);
          const altVol = window.FRDataBridge?.getLastVol('bybit', pairSym);
          const altVolEl = document.getElementById('dp-vol-alt');
          if (altVolEl) {
            altVolEl.textContent = altVol ? `BY: ${_fmtOI(altVol.value)}` : '';
          }
        }

        const fr = await fetch(`${AppConfig.API.binance.restFutures}/fapi/v1/premiumIndex?symbol=${pairSym}`);
        if (fr.ok) {
          const d = await fr.json();
          const rawFR = window.FRDataBridge?.getLastFR('binance', pairSym);
          const frPct = rawFR !== null && rawFR !== undefined ? rawFR : parseFloat(d.lastFundingRate || 0) * 100;
          const frEl = document.getElementById('dp-funding');
          if (frEl) {
            frEl.textContent = (frPct >= 0 ? '+' : '') + frPct.toFixed(4) + '%';
            frEl.className = 'dp-info-value ' + (frPct >= 0 ? 'green' : 'red');
          }
          const nextFT = ExchangeRouter.getNextFundingTime(pairSym, 'binance') || parseInt(d.nextFundingTime || 0);
          if (nextFT) _startFrTimer(nextFT);
        }

        const oiResp = await fetch(`${AppConfig.API.binance.restFutures}/futures/data/openInterestHist?symbol=${pairSym}&period=5m&limit=8`);
        if (oiResp.ok) {
          const arr = await oiResp.json();
          const oiHistory = arr.map(x => parseFloat(x.sumOpenInterestValue || x.openInterest || 0));
          if (oiHistory.length) {
            const oi = oiHistory[oiHistory.length - 1];
            const isOiUp = oiHistory.length > 1 ? oiHistory[oiHistory.length - 1] >= oiHistory[oiHistory.length - 2] : true;

            // Bridge'e besle
            window.FRDataBridge?.feedOI('binance', pairSym, oi);

            // Ana OI göster
            const oiEl = document.getElementById('dp-oi-val');
            if (oiEl) {
              oiEl.style.color = isOiUp ? 'var(--dp-green)' : 'var(--dp-red)';
              oiEl.innerHTML = `${Math.floor(oi).toLocaleString('en-US')}<span style="font-size:11px;margin-left:3px;font-weight:bold;">${isOiUp ? '↗' : '↘'}</span>`;
            }

            // Karşı borsa OI (Bybit) — cache'den oku
            const altOI = window.FRDataBridge?.getLastOI('bybit', pairSym);
            const altOIEl = document.getElementById('dp-oi-alt');
            if (altOIEl) {
              altOIEl.textContent = altOI ? `BY: ${_fmtOI(altOI.value)}` : '';
            }

            _buildOiBars(oiHistory);
          }
        }

        const lsResp = await fetch(`${AppConfig.API.binance.restFutures}/futures/data/globalLongShortAccountRatio?symbol=${pairSym}&period=5m&limit=1`);
        if (lsResp.ok) {
          const arr = await lsResp.json();
          const lsRatio = parseFloat(arr[0]?.longShortRatio || 1);
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

        try {
          const lsResp = await fetch(`${AppConfig.API.binance.restFutures}/futures/data/globalLongShortAccountRatio?symbol=${pairSym}&period=5m&limit=1`);
          if (lsResp.ok) { const arr = await lsResp.json(); lsRatio = parseFloat(arr[0]?.longShortRatio || 1); }
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
      console.log('frIntervalText:', frIntervalText);
      update({ sym, price, changePct, spotPrice, frPct, nextFundingTime, frIntervalText, oi, oiHistory, vol24h, lsRatio, rsi: rsiData, cgData, exchange });
      _startPolling();
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

    // Popout button (floating panel toggle)
    document.getElementById('detail-popout')?.addEventListener('click', () => {
      if (window.FloatingPanel) FloatingPanel.toggle();
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

  return { init, update, loadSymbol };
})();
