/* ──────────────────────────────────────────────────────────
   binance-api.js  —  Binance Futures REST + WebSocket
   Global: BinanceAPI
────────────────────────────────────────────────────────── */
const BinanceAPI = (() => {

  const BASE = AppConfig.API.binance.restFutures;

  /* TF dönüşümü: uygulama içi ('1H') → Binance API ('1h') */
  function toApiTf(tf) {
    return AppConfig.TF_MAP[tf] || tf.toLowerCase();
  }

  /* ── REST: Kline (OHLCV) ─────────────────────────────── */
  /**
   * @param {string} symbol  - ör. 'BTCUSDT'
   * @param {string} tf      - ör. '1H'
   * @param {number} limit   - max 1500
   * @param {number|null} endTime - timestamp ms, geri gitmek için
   * @returns {Promise<Array>} — LW Charts uyumlu bar dizisi
   */
  async function fetchKlines(symbol, tf, limit = 500, endTime = null) {
    try {
      const params = new URLSearchParams({
        symbol: symbol.toUpperCase(),
        interval: toApiTf(tf),
        limit,
      });
      if (endTime) params.set('endTime', endTime);
      params.set('_t', Date.now());

      const url = `${BASE}/fapi/v1/klines?${params}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const raw = await res.json();
      // Binance kline formatı → LW Charts formatı
      return raw.map(k => ({
        time:   Math.floor(k[0] / 1000), // saniyeye çevir
        open:   parseFloat(k[1]),
        high:   parseFloat(k[2]),
        low:    parseFloat(k[3]),
        close:  parseFloat(k[4]),
        volume: parseFloat(k[5]),
      }));
    } catch (e) {
      console.error('[BinanceAPI] fetchKlines error:', e);
      return [];
    }
  }

  /* ── REST: Aktif Perpetual Kontrat Listesi ───────────── */
  async function fetchSymbols() {
    try {
      const res  = await fetch(`${BASE}/fapi/v1/exchangeInfo?_t=${Date.now()}`);
      const data = await res.json();
      return data.symbols
        .filter(s => s.status === 'TRADING' && s.contractType === 'PERPETUAL')
        .map(s => s.symbol);
    } catch (e) {
      console.error('[BinanceAPI] fetchSymbols error:', e);
      return [];
    }
  }

  /* ── REST: 24H Ticker ────────────────────────────────── */
  async function fetchTicker(symbol) {
    try {
      const res  = await fetch(`${BASE}/fapi/v1/ticker/24hr?symbol=${symbol}&_t=${Date.now()}`);
      return await res.json();
    } catch (e) {
      console.error('[BinanceAPI] fetchTicker error:', e);
      return null;
    }
  }

  console.log('[BinanceAPI] Ready ✓');

  return {
    fetchKlines,
    fetchSymbols,
    fetchTicker,
    toApiTf,
  };
})();
