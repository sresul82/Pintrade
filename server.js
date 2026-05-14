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
app.use(cors()); // En basit CORS ayarı
app.use(express.json());

// İstekleri logla (Sorunu görmek için)
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// ==========================================
// 2. MongoDB Bağlantısı & Şema (Cloud Sync)
// ==========================================
const MONGODB_URI = process.env.MONGODB_URI;

if (MONGODB_URI) {
  mongoose.connect(MONGODB_URI)
    .then(() => console.log('✅ MongoDB Bağlantısı Başarılı'))
    .catch(err => console.error('❌ MongoDB Bağlantı Hatası:', err));
} else {
  console.warn('⚠️ MONGODB_URI tanımlı değil, lokal modda çalışılıyor.');
}

const drawingSchema = new mongoose.Schema({
  syncKey: { type: String, required: true, index: true },
  symbol:  { type: String, required: true },
  drawings: { type: Array, default: [] }
}, { timestamps: true });

drawingSchema.index({ syncKey: 1, symbol: 1 }, { unique: true });
const Drawing = mongoose.model('Drawing', drawingSchema);

// ==========================================
// 3. API Rotaları (Çizim Senkronizasyonu)
// ==========================================

app.get('/api/sync/drawings', async (req, res) => {
  try {
    const { syncKey } = req.query;
    if (!syncKey) return res.status(400).json({ error: 'syncKey gerekli' });
    const records = await Drawing.find({ syncKey });
    const result = {};
    records.forEach(r => { result[r.symbol] = r.drawings; });
    res.json(result);
  } catch (err) { res.status(500).json({ error: 'Sunucu hatası' }); }
});

app.post('/api/sync/drawings', async (req, res) => {
  try {
    const { syncKey, symbol, drawings } = req.body;
    if (!syncKey || !symbol) return res.status(400).json({ error: 'Eksik parametre' });
    await Drawing.findOneAndUpdate({ syncKey, symbol }, { drawings }, { upsert: true });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Sunucu hatası' }); }
});

app.get('/health', (req, res) => { res.json({ status: 'ok' }); });

// ==========================================
// 4. Binance Proxy Rotaları (Daha Basit)
// ==========================================

app.get('/api/binance/futures/:path*', (req, res) => {
  const path = req.url.replace('/api/binance/futures', '');
  proxyRequest('fapi.binance.com', path, res);
});

app.get('/api/binance/spot/:path*', (req, res) => {
  const path = req.url.replace('/api/binance/spot', '');
  proxyRequest('api.binance.com', path, res);
});

function proxyRequest(targetHost, targetPath, res) {
  const options = {
    hostname: targetHost,
    path:     targetPath,
    method:   'GET',
    headers:  { 'User-Agent': 'Mozilla/5.0' }
  };

  const proxyReq = https.request(options, (proxyRes) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    res.status(502).json({ error: 'Proxy error' });
  });

  proxyReq.end();
}

// ==========================================
// 5. Sunucuyu Başlat
// ==========================================
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Sunucu ${PORT} portunda yayında!`);
});
