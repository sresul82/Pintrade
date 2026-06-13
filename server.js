require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const mongoose = require('mongoose');
const https   = require('https');

const app  = express();
const PORT = process.env.PORT || 5500;

// ==========================================
// 1. Middleware
// ==========================================
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));
app.use((req, res, next) => {
  if (!req.url.startsWith('/api/history') && !req.url.startsWith('/api/signals')) { // Suppress noisy history logs
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  }
  next();
});

// ==========================================
// 2. MongoDB Bağlantısı & Şemalar
// ==========================================
const MONGODB_URI = process.env.MONGODB_URI;

if (MONGODB_URI) {
  mongoose.connect(MONGODB_URI)
    .then(() => console.log('✅ MongoDB Bağlantısı Başarılı'))
    .catch(err => console.error('❌ MongoDB Bağlantı Hatası:', err));
} else {
  console.warn('⚠️ MONGODB_URI tanımlı değil, lokal modda çalışılıyor.');
}

// ── Çizimler (Kalıcı) ───────────────────────────────────────────────
const drawingSchema = new mongoose.Schema({
  syncKey: { type: String, required: true, index: true },
  symbol:  { type: String, required: true },
  drawings: { type: Array, default: [] }
}, { timestamps: true });
drawingSchema.index({ syncKey: 1, symbol: 1 }, { unique: true });
const Drawing = mongoose.model('Drawing', drawingSchema);

// ── Piyasa Verisi: FR, OI, Volume — 48 Saatlik TTL ──────────────────
const marketDataSchema = new mongoose.Schema({
  exchange:     { type: String, required: true },    // 'binance' | 'bybit'
  symbol:       { type: String, required: true },    // 'BTCUSDT'
  timestamp:    { type: Date,   required: true },
  price:        { type: Number },
  fundingRate:  { type: Number },                    // % cinsinden (örn: -0.5571)
  openInterest: { type: Number },                    // USD
  volume24h:    { type: Number },                    // USD
  createdAt:    { type: Date,   default: Date.now }
});
// Bileşik index: sorgular hızlı çalışsın
marketDataSchema.index({ exchange: 1, symbol: 1, timestamp: -1 });
// TTL index: 48 saatten eski kayıtlar MongoDB tarafından otomatik silinir
marketDataSchema.index({ createdAt: 1 }, { expireAfterSeconds: 48 * 60 * 60 });
const MarketData = mongoose.model('MarketData', marketDataSchema);

// ── FR Sinyalleri (Kalıcı — 7 günlük TTL) ──────────────────────────
const frSignalSchema = new mongoose.Schema({
  exchange:    { type: String, required: true },   // 'binance' | 'bybit'
  symbol:      { type: String, required: true },   // 'HOMEUSDT'
  timestamp:   { type: Date,   required: true },   // Sinyal zamanı
  direction:   { type: String },                   // 'more_negative' | 'less_negative'
  startFR:     { type: Number },                   // Pencere başlangıç FR
  currentFR:   { type: Number },                   // Sinyal anındaki FR
  delta:       { type: Number },                   // currentFR - startFR
  createdAt:   { type: Date, default: Date.now }
});
frSignalSchema.index({ exchange: 1, symbol: 1, timestamp: -1 });
frSignalSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 }); // 7 gün TTL
const FRSignal = mongoose.model('FRSignal', frSignalSchema);

// ── Mum Verisi (Kalıcı — indikatörler için) ─────────────────────────
const candleSchema = new mongoose.Schema({
  exchange:  { type: String, required: true },
  symbol:    { type: String, required: true },
  interval:  { type: String, required: true },       // '5m', '1h', vs.
  openTime:  { type: Date,   required: true },
  open:      { type: Number },
  high:      { type: Number },
  low:       { type: Number },
  close:     { type: Number },
  volume:    { type: Number }
});
// Unique index: aynı mum iki kez yazılmasın
candleSchema.index({ exchange: 1, symbol: 1, interval: 1, openTime: 1 }, { unique: true });
const Candle = mongoose.model('Candle', candleSchema);

// ==========================================
// 3. Arka Plan Veri Toplayıcı (Background Collector)
// ==========================================

// ── FR Sinyal Eşiği ──────────────────────────────────────────────────
const FR_SIGNAL_THRESHOLD = 0.001; // % — bu değeri aşan değişim sinyal üretir

// Önceki FR değerlerini bellekte tut (değişim tespiti için)
const _prevFR = {
  binance: new Map(), // symbol → fr değeri
  bybit:   new Map(),
};

// ── Binance: FR + OI + Volume (her 1dk) ─────────────────────────────
async function collectBinanceData() {
  if (mongoose.connection.readyState !== 1) return;
  try {
    const [frResp, tkResp] = await Promise.all([
      fetchJson('fapi.binance.com', '/fapi/v1/premiumIndex'),
      fetchJson('fapi.binance.com', '/fapi/v1/ticker/24hr')
    ]);
    if (!Array.isArray(frResp) || !Array.isArray(tkResp)) return;

    const tkMap = {};
    tkResp.forEach(t => { tkMap[t.symbol] = t; });

    const now       = new Date();
    const histDocs  = []; // MarketData'ya yazılacaklar (FR değişenler)
    const signalDocs = []; // FRSignal'e yazılacaklar (eşiği aşanlar)

    frResp
      .filter(f => f.symbol.endsWith('USDT'))
      .forEach(f => {
        const tk      = tkMap[f.symbol] || {};
        const price   = parseFloat(f.markPrice) || 0;
        const oi      = parseFloat(f.openInterest) || 0;
        const fr      = parseFloat(f.lastFundingRate) * 100;

        const prevFR  = _prevFR.binance.get(f.symbol);
        const changed = prevFR === undefined || fr !== prevFR;

        if (!changed) return; // FR değişmemişse atla

        _prevFR.binance.set(f.symbol, fr);

        // History için yaz
        histDocs.push({
          exchange:     'binance',
          symbol:       f.symbol,
          timestamp:    now,
          price,
          fundingRate:  fr,
          openInterest: oi * price,
          volume24h:    tk.quoteVolume ? parseFloat(tk.quoteVolume) : null,
          createdAt:    now
        });

        // Eşik kontrolü — sinyal üret
        if (prevFR !== undefined) {
          const delta = fr - prevFR;
          if (Math.abs(delta) >= FR_SIGNAL_THRESHOLD) {
            signalDocs.push({
              exchange:  'binance',
              symbol:    f.symbol,
              timestamp: now,
              direction: delta < 0 ? 'more_negative' : 'less_negative',
              startFR:   prevFR,
              currentFR: fr,
              delta,
            });
          }
        }
      });

    // MarketData — sadece değişenler
    if (histDocs.length > 0) {
      await MarketData.insertMany(histDocs, { ordered: false }).catch(() => {});
    }

    // FRSignal — sadece eşiği aşanlar
    if (signalDocs.length > 0) {
      await FRSignal.insertMany(signalDocs, { ordered: false }).catch(() => {});
    }

    console.log(`[Collector] Binance: ${histDocs.length} FR değişti, ${signalDocs.length} sinyal üretildi`);

  } catch (e) {
    console.error('[Collector] Binance hatası:', e.message);
  }
}

// ── Bybit: FR + OI + Volume (her 1dk) ──────────────────────────────
async function collectBybitData() {
  if (mongoose.connection.readyState !== 1) return;
  try {
    const data = await fetchJsonUrl('https://api.bybit.com/v5/market/tickers?category=linear');
    const list = data?.result?.list;
    if (!Array.isArray(list)) return;

    const now        = new Date();
    const histDocs   = [];
    const signalDocs = [];

    list
      .filter(t => t.symbol.endsWith('USDT'))
      .forEach(t => {
        const fr     = parseFloat(t.fundingRate) * 100;
        const prevFR = _prevFR.bybit.get(t.symbol);
        const changed = prevFR === undefined || fr !== prevFR;

        if (!changed) return;

        _prevFR.bybit.set(t.symbol, fr);

        histDocs.push({
          exchange:     'bybit',
          symbol:       t.symbol,
          timestamp:    now,
          price:        parseFloat(t.lastPrice) || 0,
          fundingRate:  fr,
          openInterest: parseFloat(t.openInterestValue) || null,
          volume24h:    parseFloat(t.turnover24h) || null,
          createdAt:    now
        });

        if (prevFR !== undefined) {
          const delta = fr - prevFR;
          if (Math.abs(delta) >= FR_SIGNAL_THRESHOLD) {
            signalDocs.push({
              exchange:  'bybit',
              symbol:    t.symbol,
              timestamp: now,
              direction: delta < 0 ? 'more_negative' : 'less_negative',
              startFR:   prevFR,
              currentFR: fr,
              delta,
            });
          }
        }
      });

    if (histDocs.length > 0) {
      await MarketData.insertMany(histDocs, { ordered: false }).catch(() => {});
    }

    if (signalDocs.length > 0) {
      await FRSignal.insertMany(signalDocs, { ordered: false }).catch(() => {});
    }

    console.log(`[Collector] Bybit: ${histDocs.length} FR değişti, ${signalDocs.length} sinyal üretildi`);

  } catch (e) {
    console.error('[Collector] Bybit hatası:', e.message);
  }
}

// ── Binance Mumlar: USDT perpetual 5m (her 5dk) ─────────────────────
async function collectBinanceCandles() {
  if (mongoose.connection.readyState !== 1) return;
  try {
    const frResp = await fetchJson('fapi.binance.com', '/fapi/v1/premiumIndex');
    if (!Array.isArray(frResp)) return;
    const symbols = frResp.filter(f => f.symbol.endsWith('USDT')).map(f => f.symbol);

    const BATCH = 10;
    for (let i = 0; i < symbols.length; i += BATCH) {
      const batch = symbols.slice(i, i + BATCH);
      await Promise.allSettled(batch.map(async (sym) => {
        try {
          const candles = await fetchJson('fapi.binance.com', `/fapi/v1/klines?symbol=${sym}&interval=5m&limit=3`);
          if (!Array.isArray(candles)) return;
          const docs = candles.map(c => ({
            exchange: 'binance', symbol: sym, interval: '5m',
            openTime: new Date(c[0]),
            open: parseFloat(c[1]), high: parseFloat(c[2]),
            low:  parseFloat(c[3]), close: parseFloat(c[4]),
            volume: parseFloat(c[5])
          }));
          await Candle.bulkWrite(
            docs.map(d => ({
              updateOne: {
                filter: { exchange: d.exchange, symbol: d.symbol, interval: d.interval, openTime: d.openTime },
                update: { $set: d },
                upsert: true
              }
            })),
            { ordered: false }
          );
        } catch {}
      }));
      await sleep(300); // Rate limit koruması
    }
    console.log(`[Collector] Binance mumları güncellendi`);
  } catch (e) {
    console.error('[Collector] Binance mum hatası:', e.message);
  }
}

// ── Zamanlayıcılar ──────────────────────────────────────────────────
// DB bağlandıktan sonra başlat
mongoose.connection.once('open', () => {
  console.log('[Collector] Arka plan toplayıcı başlatıldı!');

  // İlk veriyi hemen topla
  collectBinanceData();
  collectBybitData();
  collectBinanceCandles();

  // Her 1 veya 5 dakikada bir tekrarla
  setInterval(collectBinanceData,   1 * 60 * 1000); // 1 dakika — bot sinyalleri için
  setInterval(collectBybitData,     1 * 60 * 1000); // 1 dakika
  setInterval(collectBinanceCandles, 5 * 60 * 1000); // Mumlar 5dk yeterli
});

// ==========================================
// 4. API Rotaları
// ==========================================

// ── Çizim Senkronizasyonu ───────────────────────────────────────────
app.get('/api/sync/drawings', async (req, res) => {
  try {
    const { syncKey } = req.query;
    if (!syncKey) return res.status(400).json({ error: 'syncKey gerekli' });
    const records = await Drawing.find({ syncKey });
    const result = {};
    records.forEach(r => { result[r.symbol] = r.drawings; });
    res.json(result);
  } catch { res.status(500).json({ error: 'Sunucu hatası' }); }
});

app.post('/api/sync/drawings', async (req, res) => {
  try {
    const { syncKey, symbol, drawings } = req.body;
    if (!syncKey || !symbol) return res.status(400).json({ error: 'Eksik parametre' });
    await Drawing.findOneAndUpdate({ syncKey, symbol }, { drawings }, { upsert: true });
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Sunucu hatası' }); }
});

// ── FR Geçmiş Verisi ─────────────────────────────────────────────────
// GET /api/history/fr/:exchange/:symbol?hours=48
app.get('/api/history/fr/:exchange/:symbol', async (req, res) => {
  try {
    const { exchange, symbol } = req.params;
    const hours  = Math.min(parseInt(req.query.hours) || 48, 48);
    const since  = new Date(Date.now() - hours * 60 * 60 * 1000);
    const sym    = symbol.toUpperCase().endsWith('USDT') ? symbol.toUpperCase() : symbol.toUpperCase() + 'USDT';

    const records = await MarketData.find(
      { exchange, symbol: sym, timestamp: { $gte: since }, fundingRate: { $ne: null } },
      { timestamp: 1, fundingRate: 1, _id: 0 }
    ).sort({ timestamp: 1 }).lean();

    res.json(records);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── FR Sinyalleri: Kaydet ────────────────────────────────────────────
// POST /api/signals/fr
app.post('/api/signals/fr', async (req, res) => {
  try {
    const { exchange, symbol, timestamp, direction, startFR, currentFR, delta } = req.body;
    if (!exchange || !symbol) return res.status(400).json({ error: 'Eksik parametre' });

    await FRSignal.create({
      exchange, symbol,
      timestamp: timestamp ? new Date(timestamp) : new Date(),
      direction, startFR, currentFR, delta
    });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── FR Sinyalleri: Son N sinyali getir ──────────────────────────────
// GET /api/signals/fr?exchange=binance&limit=200&hours=24
app.get('/api/signals/fr', async (req, res) => {
  try {
    const exchange = req.query.exchange; // opsiyonel — yoksa her iki borsa
    const limit    = Math.min(parseInt(req.query.limit) || 200, 1000);
    const hours    = Math.min(parseInt(req.query.hours)  || 24,  168); // max 7 gün
    const since    = new Date(Date.now() - hours * 60 * 60 * 1000);

    const filter = { timestamp: { $gte: since } };
    if (exchange) filter.exchange = exchange;

    const records = await FRSignal.find(filter)
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();

    res.json(records.reverse()); // Eskiden yeniye sırala
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── OI + Volume Geçmiş Verisi ────────────────────────────────────────
// GET /api/history/market/:exchange/:symbol?hours=48
app.get('/api/history/market/:exchange/:symbol', async (req, res) => {
  try {
    const { exchange, symbol } = req.params;
    const hours  = Math.min(parseInt(req.query.hours) || 48, 48);
    const since  = new Date(Date.now() - hours * 60 * 60 * 1000);
    const sym    = symbol.toUpperCase().endsWith('USDT') ? symbol.toUpperCase() : symbol.toUpperCase() + 'USDT';

    const records = await MarketData.find(
      { exchange, symbol: sym, timestamp: { $gte: since } },
      { timestamp: 1, price: 1, fundingRate: 1, openInterest: 1, volume24h: 1, _id: 0 }
    ).sort({ timestamp: 1 }).lean();

    res.json(records);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Mum Verisi ───────────────────────────────────────────────────────
// GET /api/history/candles/:exchange/:symbol?interval=5m&limit=500
app.get('/api/history/candles/:exchange/:symbol', async (req, res) => {
  try {
    const { exchange, symbol } = req.params;
    const interval = req.query.interval || '5m';
    const limit    = Math.min(parseInt(req.query.limit) || 500, 5000);
    const sym      = symbol.toUpperCase().endsWith('USDT') ? symbol.toUpperCase() : symbol.toUpperCase() + 'USDT';

    const records = await Candle.find(
      { exchange, symbol: sym, interval },
      { _id: 0, openTime: 1, open: 1, high: 1, low: 1, close: 1, volume: 1 }
    ).sort({ openTime: -1 }).limit(limit).lean();

    res.json(records.reverse()); // Tarih sırasına çevir
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Sağlık Kontrolü ─────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    uptime: process.uptime()
  });
});

// ==========================================
// 5. Binance Proxy Rotaları
// ==========================================
app.get('/api/binance/futures/*', (req, res) => {
  const path = req.url.replace('/api/binance/futures', '');
  proxyRequest('fapi.binance.com', path, res);
});

app.get('/api/binance/spot/*', (req, res) => {
  const path = req.url.replace('/api/binance/spot', '');
  proxyRequest('api.binance.com', path, res);
});

// ==========================================
// 6. Yardımcı Fonksiyonlar
// ==========================================

function proxyRequest(targetHost, targetPath, res) {
  const separator   = targetPath.includes('?') ? '&' : '?';
  const noCachePath = `${targetPath}${separator}_t=${Date.now()}`;
  const options = {
    hostname: targetHost, path: noCachePath, method: 'GET',
    headers: { 'User-Agent': 'Mozilla/5.0' }
  };
  const proxyReq = https.request(options, (proxyRes) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    proxyRes.pipe(res);
  });
  proxyReq.on('error', () => res.status(502).json({ error: 'Proxy error' }));
  proxyReq.end();
}

// HTTPS isteği atıp JSON döndüren yardımcı
function fetchJson(host, path) {
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname: host, path, method: 'GET', headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch { reject(new Error('JSON parse error')); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

// Harici URL'e istek atan yardımcı
function fetchJsonUrl(url) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const req = https.request({
      hostname: parsedUrl.hostname, path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET', headers: { 'User-Agent': 'Mozilla/5.0' }
    }, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch { reject(new Error('JSON parse error')); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ==========================================
// 7. Sunucuyu Başlat
// ==========================================
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Sunucu ${PORT} portunda yayında!`);
});
