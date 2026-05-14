require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 5500;

// ==========================================
// 1. Middleware
// ==========================================
app.use(cors({
  origin: '*' // Canlıya alırken ['https://siteniz.pages.dev'] ile kısıtlayın
}));
app.use(express.json());

// ==========================================
// 2. MongoDB Bağlantısı & Şema (Cloud Sync)
// ==========================================
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/pintrade';

mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ MongoDB Bağlantısı Başarılı'))
  .catch(err => console.error('❌ MongoDB Bağlantı Hatası:', err));

const drawingSchema = new mongoose.Schema({
  syncKey: { type: String, required: true, index: true },
  symbol:  { type: String, required: true },
  drawings: { type: Array, default: [] }
}, { timestamps: true });

// Aynı (syncKey, symbol) ikilisi için tek bir kayıt olsun:
drawingSchema.index({ syncKey: 1, symbol: 1 }, { unique: true });
const Drawing = mongoose.model('Drawing', drawingSchema);

// ==========================================
// 3. API Rotaları (Çizim Senkronizasyonu)
// ==========================================

// Bütün çizimleri getir
app.get('/api/sync/drawings', async (req, res) => {
  try {
    const { syncKey } = req.query;
    if (!syncKey) return res.status(400).json({ error: 'syncKey gerekli' });

    const records = await Drawing.find({ syncKey });
    
    // Frontend'in beklediği format: { "BTCUSDT": [...], "ETHUSDT": [...] }
    const result = {};
    records.forEach(r => {
      result[r.symbol] = r.drawings;
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// Çizimleri kaydet/güncelle
app.post('/api/sync/drawings', async (req, res) => {
  try {
    const { syncKey, symbol, drawings } = req.body;
    if (!syncKey || !symbol) return res.status(400).json({ error: 'Eksik parametre' });

    await Drawing.findOneAndUpdate(
      { syncKey, symbol },
      { drawings },
      { upsert: true, new: true }
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// Uyku Önleme (Health Check)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date() });
});

// ==========================================
// 4. Binance Proxy Rotaları
// ==========================================

function proxyRequest(targetHost, targetPath, res) {
  const options = {
    hostname: targetHost,
    path:     targetPath,
    method:   'GET',
    headers:  { 'User-Agent': 'Node.js-Proxy' }
  };

  const proxyReq = https.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*'
    });
    proxyRes.pipe(res, { end: true });
  });

  proxyReq.on('error', (err) => {
    console.error(`[PROXY ERROR] ${targetHost}${targetPath} ->`, err.message);
    res.status(502).json({ error: 'Proxy hatasi: ' + err.message });
  });

  proxyReq.end();
}

app.get('/api/binance/futures/(.*)', (req, res) => {
  const binancePath = req.originalUrl.replace('/api/binance/futures', '');
  console.log(`[PROXY Futures] -> https://fapi.binance.com${binancePath}`);
  proxyRequest('fapi.binance.com', binancePath, res);
});

app.get('/api/binance/spot/(.*)', (req, res) => {
  const binancePath = req.originalUrl.replace('/api/binance/spot', '');
  console.log(`[PROXY Spot] -> https://api.binance.com${binancePath}`);
  proxyRequest('api.binance.com', binancePath, res);
});

// ==========================================
// 5. Sunucuyu Başlat
// ==========================================
app.listen(PORT, () => {
  console.log('\n========================================');
  console.log(`🚀 PinTrade API Proxy & Sync Server (Express) Başlatıldı!`);
  console.log(`📍 Port: ${PORT}`);
  console.log('========================================');
});
