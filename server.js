require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const mongoose = require('mongoose');
const https   = require('https');
const path    = require('path');
const rateLimit = require('express-rate-limit');
const Kom1ServerWatcher = require('./js/screener/kom1-server-watcher.js');
const Kom2ServerWatcher = require('./js/screener/kom2-server-watcher.js');

const app  = express();
const PORT = process.env.PORT || 5500;

// ==========================================
// 1. Middleware
// ==========================================
app.use(cors());
app.use(express.json());

// gorevler2.md Görev 9.1 (2026-08-10) — eskiden express.static(__dirname)
// tüm proje kökünü servis ediyordu: server.js, package.json ve dokumentasyon/
// (strateji parametrelerini içeren gorevler3.md dahil) tarayıcıdan doğrudan
// indirilebiliyordu. Sadece frontend'in gerçekten ihtiyaç duyduğu index.html
// + css/ + js/ servis ediliyor.
// [DÜZELTME 2026-08-19] express.static varsayılanı Last-Modified/ETag
// gönderir ama açık bir Cache-Control vermez — bazı tarayıcılar (Chrome'un
// "heuristic freshness" mantığı) bunu normal F5'te SUNUCUYA HİÇ SORMADAN
// önbellekten sunabiliyor. Bu proje hızlı iterasyon gerektiren bir dev
// ortamı (JS/CSS aynı gün içinde defalarca değişiyor) — kullanıcı bir
// düzeltmeyi test ettiğinde eski dosyayı görmesi ("hâlâ düzelmemiş" gibi
// yanlış bug raporlarına yol açıyordu) kabul edilemez. `no-cache` tarayıcıyı
// HER İSTEKTE sunucuya sormaya zorluyor (dosya değişmediyse ucuz bir 304
// döner, ETag sayesinde bant genişliği kaybı yok) — "asla cache'leme" değil,
// "asla doğrulamadan kullanma".
const NO_CACHE_STATIC = { setHeaders: (res) => res.setHeader('Cache-Control', 'no-cache') };
app.use('/css', express.static(path.join(__dirname, 'css'), NO_CACHE_STATIC));
app.use('/js', express.static(path.join(__dirname, 'js'), NO_CACHE_STATIC));
app.get('/', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(path.join(__dirname, 'index.html'));
});
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

function printLocalModeBanner(reason) {
  console.warn('');
  console.warn('╔══════════════════════════════════════════════════════════════╗');
  console.warn('║  ⚠️  LOKAL MOD — veritabanı YOK                              ║');
  console.warn('╚══════════════════════════════════════════════════════════════╝');
  console.warn(`   Sebep: ${reason}`);
  console.warn('');
  console.warn('   ✅ ÇALIŞAN ÖZELLİKLER');
  console.warn('      • Grafik + çoklu panel + tüm çizim araçları');
  console.warn('      • Screener (canlı fiyat / değişim / FR / hacim)');
  console.warn('      • Coin detay paneli, bot sinyalleri, arama');
  console.warn('      • Çizimler tarayıcıda saklanır (localStorage)');
  console.warn('');
  console.warn('   ❌ ÇALIŞMAYAN ÖZELLİKLER (MongoDB gerektiriyor)');
  console.warn('      • Çizim bulut senkronu        /api/sync/drawings');
  console.warn('      • Funding Rate geçmişi        /api/history/fr');
  console.warn('      • OI + hacim geçmişi          /api/history/market');
  console.warn('      • Kayıtlı mum verisi          /api/history/candles');
  console.warn('      • Arka plan veri toplayıcı (FR/OI/mum)');
  console.warn('      → Tarayıcı konsolunda "Preload hatası" uyarıları normaldir.');
  console.warn('');
  console.warn('   Açmak için: .env.example dosyasını .env olarak kopyalayıp');
  console.warn('   MONGODB_URI değerini doldurun.');
  console.warn('');
}

if (MONGODB_URI) {
  mongoose.connect(MONGODB_URI)
    .then(() => console.log('✅ MongoDB Bağlantısı Başarılı — tüm özellikler aktif'))
    .catch(err => printLocalModeBanner(`MongoDB'ye bağlanılamadı — ${err.message}`));
} else {
  printLocalModeBanner('.env dosyasında MONGODB_URI tanımlı değil');
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

// ── L/S Metrikleri (Long/Short — 60 Saatlik TTL, MarketData ile aynı desen) ──
// NOT: takerlongshortRatio yanıtında "symbol" alanı YOKTUR (diğer 3 endpoint'te
// var) — server.js'in premiumIndex'te olmayan "openInterest" alanını okuyup
// sessizce 0 yazdığı geçmiş hataya (bkz. collectBinanceData) düşmemek için
// her alan gerçek Binance yanıtından doğrulanarak eşlendi.
const lsMetricsSchema = new mongoose.Schema({
  exchange:              { type: String, required: true },  // 'binance' (faz 2: 'bybit')
  symbol:                { type: String, required: true },  // 'BTCUSDT'
  timestamp:              { type: Date,   required: true },
  globalRatio:            { type: Number },   // globalLongShortAccountRatio — TÜM traderlar, hesap sayısı
  globalLongPct:          { type: Number },
  globalShortPct:         { type: Number },
  topPositionRatio:       { type: Number },   // topLongShortPositionRatio — TOP traderlar, pozisyon değeri
  topPositionLongPct:     { type: Number },
  topPositionShortPct:    { type: Number },
  topAccountRatio:        { type: Number },   // topLongShortAccountRatio — TOP traderlar, hesap sayısı
  topAccountLongPct:      { type: Number },
  topAccountShortPct:     { type: Number },
  takerBuySellRatio:      { type: Number },   // takerlongshortRatio — taker alım/satım hacim oranı
  takerBuyVol:            { type: Number },
  takerSellVol:           { type: Number },
  createdAt:              { type: Date,   default: Date.now }
});
lsMetricsSchema.index({ exchange: 1, symbol: 1, timestamp: -1 });
// TTL: 60 saat — MarketData'nın 48-72 saat aralığının ortası
lsMetricsSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 60 });
const LSMetrics = mongoose.model('LSMetrics', lsMetricsSchema);

// ── Sembol Durumu (Görev 8, 2026-08-08) — delist/yeni-listelenme algılama ──
// Binance'in exchangeInfo `status` alanı gerçek zamanlı bir sinyal
// (doğrulandı: SETTLING=delisting sürüyor, PENDING_TRADING=yakında
// listelenecek, spot'ta BREAK=işlem durmuş) ama sadece ANLIK durumu verir —
// "ne zaman değişti" bilgisi yok. Bu yüzden her turda mevcut durumu
// SymbolStatus'ta saklayıp önceki turla karşılaştırıyoruz; fark varsa
// SymbolStatusEvent'e bir olay yazıyoruz. Resmi "delist-schedule"
// endpoint'leri gerçek Binance API key gerektirdiği için (doğrulandı:
// -2008 Invalid Api-Key ID) kullanılmadı — bu, dolaylı ama public bir yöntem.
const symbolStatusSchema = new mongoose.Schema({
  exchange: { type: String, required: true },   // 'binance' | 'bybit' (2026-08-27)
  market:   { type: String, required: true },   // 'spot' | 'futures'
  symbol:   { type: String, required: true },
  status:   { type: String, required: true },   // TRADING/SETTLING/PENDING_TRADING/BREAK/...
  updatedAt:{ type: Date,   default: Date.now }
});
symbolStatusSchema.index({ exchange: 1, market: 1, symbol: 1 }, { unique: true });
const SymbolStatus = mongoose.model('SymbolStatus', symbolStatusSchema);

const symbolStatusEventSchema = new mongoose.Schema({
  exchange:   { type: String, required: true },
  market:     { type: String, required: true },   // 'spot' | 'futures'
  symbol:     { type: String, required: true },
  fromStatus: { type: String },                    // null = ilk kez görüldü
  toStatus:   { type: String, required: true },
  category:   { type: String, required: true },   // 'delist_warning' | 'new_listing'
  timestamp:  { type: Date,   required: true },
  createdAt:  { type: Date,   default: Date.now }
});
symbolStatusEventSchema.index({ exchange: 1, market: 1, timestamp: -1 });
// TTL: 30 gün — delist/yeni-listelenme uyarıları bu kadar süre "aktif" sayılır
symbolStatusEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });
const SymbolStatusEvent = mongoose.model('SymbolStatusEvent', symbolStatusEventSchema);

// ── Kom1 Sunucu Gözlemi (gorevler3.md Görev 5, 2026-08-11) ──────────
// js/screener/kom1-server-watcher.js'in bulduğu kesinleşmiş sinyaller —
// bkz. o dosyanın başlığındaki "shadow gözlemci, asıl motorun yerini
// tutmaz" notu. TTL: 30 gün (Candle koleksiyonunda TTL unutulup depolama
// dolduğu hatadan ders alındı, bkz. gorevler2.md Görev 12 — bu sefer
// baştan eklendi).
const kom1SignalSchema = new mongoose.Schema({
  symbol: { type: String, required: true },
  bigTf:  { type: String, required: true },
  rcMid: Number, wtVal: Number, wtPrev: Number, price: Number,
  haOpen: Number, haClose: Number, dema9: Number,
  atrPct: Number, // 2026-08-17 — sinyal anındaki ATR14/fiyat %, ATR bandı filtresiyle birlikte eklendi
  firedAt: Date, confirmedAt: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now },
});
kom1SignalSchema.index({ confirmedAt: -1 });
kom1SignalSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });
const Kom1SignalLog = mongoose.model('Kom1SignalLog', kom1SignalSchema);

// ── Kom1 Tarama Durumu (gorevler3.md Görev 6, 2026-08-12) ────────────
// Hacme göre katman (1/2/3) ve her sembolün son tarandığı zaman —
// kom1-server-watcher.js'in rotasyonunun sunucu yeniden başlasa da
// kaldığı yerden devam edebilmesi için (DB-agnostic modül tasarımı
// gereği watcher kendi Mongo'ya dokunmaz, bu kalıcılığı server.js yapar).
// TTL yok — bu "canlı durum" tablosu, geçmiş kayıt değil (upsert edilir).
const kom1ScanStateSchema = new mongoose.Schema({
  symbol: { type: String, required: true, unique: true },
  tier: Number,
  quoteVolume24h: Number,
  lastScannedAt: Date,
});
const Kom1ScanState = mongoose.model('Kom1ScanState', kom1ScanStateSchema);

// ── Kom2 Sunucu Gözlemi (2026-08-17, kullanıcı onayıyla, plan: robust-strolling-turtle) ──
// js/screener/kom2-server-watcher.js — OI-kalıcılık yolu (divergence YOK,
// backtest/train-test'te seyrelttiği görüldü), parametreler: eşik=%15,
// gün=7, pullback≤%10, ls=global_below_1. Kom1'den FARKLI: sinyaller
// süresiz değil, `expiresAt` (confirmedAt+6sa) sonrası "aktif değil"
// sayılır — kısa/orta vadeli karakter (backtest: +1g ufku tutarsız/negatif).
// Mevcut MarketData/LSMetrics koleksiyonları (48-60sa TTL, LSMetrics sadece
// 8 sabit coin) Kom2'nin 7 günlük kalıcılık penceresine YETMİYOR — bu yüzden
// Kom2 kendi bağımsız OI/L-S geçmiş koleksiyonlarına sahip (aşağıda).
//
// ── OI geçmişi (Kom2ServerWatcher'ın "sert coin" evreni, ~80 sembol) ──
const kom2OiHistorySchema = new mongoose.Schema({
  symbol: { type: String, required: true },
  timestamp: { type: Date, required: true },
  sumOpenInterest: Number,
  sumOpenInterestValue: Number,
  createdAt: { type: Date, default: Date.now },
});
kom2OiHistorySchema.index({ symbol: 1, timestamp: 1 });
kom2OiHistorySchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 }); // Binance'in kendi 30 günlük kısıtıyla aynı — daha uzun tutmanın faydası yok
const Kom2OiHistory = mongoose.model('Kom2OiHistory', kom2OiHistorySchema);

// ── Global L/S oranı geçmişi — SADECE global_below_1 varyantı için gerekli,
// top-trader alanları v1 kapsamı dışı (kolayca eklenebilir, bkz. plan). ──
const kom2LsHistorySchema = new mongoose.Schema({
  symbol: { type: String, required: true },
  timestamp: { type: Date, required: true },
  globalRatio: Number,
  globalLongPct: Number,
  globalShortPct: Number,
  createdAt: { type: Date, default: Date.now },
});
kom2LsHistorySchema.index({ symbol: 1, timestamp: 1 });
kom2LsHistorySchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });
const Kom2LsHistory = mongoose.model('Kom2LsHistory', kom2LsHistorySchema);

// ── Kesinleşmiş Kom2 sinyalleri ──────────────────────────────────────
const kom2SignalSchema = new mongoose.Schema({
  symbol: { type: String, required: true },
  oiGainPct: Number,
  daysHeld: Number,
  lsRatio: Number,
  price: Number,
  haOpen: Number, haClose: Number, dema9: Number,
  firedAt: Date,
  confirmedAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true }, // Kom1'in aksine — kısa/orta vadeli, 6 saat sonra "aktif değil"
  createdAt: { type: Date, default: Date.now },
});
kom2SignalSchema.index({ confirmedAt: -1 });
kom2SignalSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 }); // geçmiş kayıt olarak yine 30 gün, "aktiflik" (expiresAt) ayrı bir kavram
const Kom2SignalLog = mongoose.model('Kom2SignalLog', kom2SignalSchema);

// ── Kom2 Tarama Durumu — Kom1ScanState'in birebir aynısı ────────────
const kom2ScanStateSchema = new mongoose.Schema({
  symbol: { type: String, required: true, unique: true },
  tier: Number,
  quoteVolume24h: Number,
  lastScannedAt: Date,
});
const Kom2ScanState = mongoose.model('Kom2ScanState', kom2ScanStateSchema);

// ── Watchlist "1D Open" değişim tipi (2026-08-26, kullanıcı onayıyla) ──
// Ekstra Binance isteği YOK: collectBinanceData() zaten her 1 dakikada bir
// TÜM sembollerin ticker'ını çekiyor (bot sinyalleri için) — bu koleksiyon
// UTC gün başına en yakın turda o anki fiyatları bir kerelik kopyalıyor.
// Tarayıcı bunu tek seferlik çekip, zaten akan canlı WS fiyatıyla
// (`!miniTicker@arr`) kendi hesaplıyor — bkz. GET /api/market/day-open.
const dayOpenPriceSchema = new mongoose.Schema({
  symbol: { type: String, required: true, unique: true },
  price:  Number,
  day:    String, // UTC 'YYYY-MM-DD', bu fiyatın hangi gün için açılış olduğu
});
const DayOpenPrice = mongoose.model('DayOpenPrice', dayOpenPriceSchema);

// ── Fiyat Alarmları — Faz 1 (2026-08-26, gorevler4.md Görev-3, kullanıcı
// onaylı kapsam) ─────────────────────────────────────────────────────
// SADECE manuel (sabit fiyatlı) alarmlar — eğik çizgi kaynaklı alarmlar
// (State.getDrawings() sadece tarayıcıda yaşıyor, sunucunun erişimi yok)
// BİLİNÇLİ olarak kapsam dışı, ayrı bir Faz 2 gerektiriyor. İstemci
// (alert-store.js) hâlâ senkron/localStorage — bu koleksiyon sadece bir
// AYNA: tarayıcı kapalıyken de tetiklenip Telegram'a düşebilsinler diye.
// Bu proje tek kullanıcılı/kişisel (bkz. hafıza notu) — Kom1/Kom2 gibi
// kullanıcı bazlı bir scoping (syncKey vb.) BİLEREK eklenmedi.
const alertSchema = new mongoose.Schema({
  clientId: { type: String, required: true, unique: true }, // alert-store.js'in kendi ürettiği id (al_...)
  symbol: { type: String, required: true },
  exchange: { type: String, default: 'binance' },
  price: Number,
  condition: { type: String, default: 'crossing' }, // 'above' | 'below' | 'crossing'
  triggerMode: String,
  expiresAt: Number, // epoch ms | null
  message: String,
  notifyTelegram: { type: Boolean, default: false },
  tf: String,
  name: String,
  triggered: { type: Boolean, default: false },
  active: { type: Boolean, default: true },
  lastKnownPrice: Number,
  createdAt: { type: Number, default: () => Date.now() },
  triggeredAt: Number,
});
const Alert = mongoose.model('Alert', alertSchema);

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

// gorevler4.md Görev-3 (2026-08-26) — fiyat alarmları için EKSTRA istek
// YOK: collectBinanceData/collectBybitData zaten her 1dk'da tüm sembollerin
// güncel fiyatını çekiyor, bu iki satır o veriyi bir kerelik bellekte
// paylaşılan bir haritaya kopyalıyor. checkAlerts() sadece bunu okuyor.
const _latestPrices = {
  binance: new Map(), // symbol → fiyat
  bybit:   new Map(),
};

// gorevler4.md Görev-17 Madde B — Kom1ServerWatcher'ın evren/katman
// yenilemesi için ihtiyaç duyduğu hacim verisi. collectBinanceData zaten
// her 1 dakikada tüm sembollerin ticker/24hr'ını çekiyor; Kom1'in AYNI
// endpoint'e kendi başına ikinci bir istek atmaması için bu snapshot
// paylaşılıyor (bkz. kom1-server-watcher.js `_refreshUniverse` başlığı).
const _latestBinanceTickers = new Map(); // symbol → { quoteVolume24h }

// "1D Open" için UTC gün başı fiyatını hangi güne kadar zaten kaydettiğimiz
// (server.js açılışında Mongo'dan yüklenir — restart'ta yanlışlıkla o anki
// fiyatı "gün açılışı" sanıp üzerine yazmasın diye).
let _dayOpenCapturedDay = null;

/** UTC gün başı fiyatını, gün ilk kez görülüyorsa bir kerelik kaydeder. */
async function _maybeCaptureDayOpen(tkMap) {
  const today = new Date().toISOString().slice(0, 10); // UTC 'YYYY-MM-DD'
  if (_dayOpenCapturedDay === today) return;
  try {
    const ops = Object.keys(tkMap)
      .filter(symbol => symbol.endsWith('USDT'))
      .map(symbol => ({
        updateOne: {
          filter: { symbol },
          update: { $set: { price: parseFloat(tkMap[symbol].lastPrice) || 0, day: today } },
          upsert: true,
        },
      }));
    if (ops.length > 0) await DayOpenPrice.bulkWrite(ops);
    _dayOpenCapturedDay = today;
    console.log(`[DayOpenPrice] ${today} için ${ops.length} sembolün açılış fiyatı kaydedildi.`);
  } catch (e) {
    console.warn('[DayOpenPrice] Kayıt başarısız, bir sonraki turda tekrar denenecek:', e.message);
  }
}

// ── Binance: FR + OI + Volume (her 1dk) ─────────────────────────────
/**
 * Verilen semboller için gerçek Open Interest (adet, USD değil) çeker.
 * /fapi/v1/openInterest tek sembollük bir endpoint — toplu bir "tüm market"
 * karşılığı yok, bu yüzden batch'li çekiliyor (mevcut mum toplayıcısının
 * örüntüsüyle aynı: BATCH'li + aralarda kısa bekleme).
 * @returns {Promise<Map<string, number>>} symbol -> openInterest (adet)
 */
async function _fetchBinanceOIBatch(symbols) {
  const map = new Map();
  const BATCH = 10;
  for (let i = 0; i < symbols.length; i += BATCH) {
    const batch = symbols.slice(i, i + BATCH);
    await Promise.allSettled(batch.map(async (sym) => {
      try {
        const d = await fetchJson('fapi.binance.com', `/fapi/v1/openInterest?symbol=${sym}`);
        if (d?.openInterest) map.set(sym, parseFloat(d.openInterest));
      } catch { /* sessizce geç — tek sembol hatası turu durdurmasın */ }
    }));
    if (i + BATCH < symbols.length) await sleep(150);
  }
  return map;
}

async function collectBinanceData() {
  if (mongoose.connection.readyState !== 1) return;
  try {
    const [frResp, tkResp] = await Promise.all([
      fetchJson('fapi.binance.com', '/fapi/v1/premiumIndex'),
      fetchJson('fapi.binance.com', '/fapi/v1/ticker/24hr')
    ]);
    if (!Array.isArray(frResp) || !Array.isArray(tkResp)) return;

    const tkMap = {};
    tkResp.forEach(t => {
      tkMap[t.symbol] = t;
      const p = parseFloat(t.lastPrice);
      if (!isNaN(p)) _latestPrices.binance.set(t.symbol, p);
      const vol = parseFloat(t.quoteVolume);
      _latestBinanceTickers.set(t.symbol, { quoteVolume24h: isNaN(vol) ? 0 : vol });
    });

    await _maybeCaptureDayOpen(tkMap);

    const now       = new Date();
    const histDocs  = []; // MarketData'ya yazılacaklar (FR değişenler)
    const signalDocs = []; // FRSignal'e yazılacaklar (eşiği aşanlar)

    frResp
      .filter(f => f.symbol.endsWith('USDT'))
      .forEach(f => {
        const tk      = tkMap[f.symbol] || {};
        const price   = parseFloat(f.markPrice) || 0;
        const fr      = parseFloat(f.lastFundingRate) * 100;

        const prevFR  = _prevFR.binance.get(f.symbol);
        const changed = prevFR === undefined || fr !== prevFR;

        if (!changed) return; // FR değişmemişse atla

        _prevFR.binance.set(f.symbol, fr);

        // History için yaz. NOT: openInterest burada henüz doldurulmuyor —
        // /fapi/v1/premiumIndex yanıtında "openInterest" alanı YOK (eski kod
        // bunu okuyup sessizce 0 yazıyordu, Görev 10.1). Gerçek değer aşağıda
        // /fapi/v1/openInterest'ten ayrıca, sadece bu değişen semboller için
        // batch'li olarak çekilip histDocs'a sonradan işleniyor.
        histDocs.push({
          exchange:     'binance',
          symbol:       f.symbol,
          timestamp:    now,
          price,
          fundingRate:  fr,
          openInterest: null,
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

    // Gerçek OI — sadece bu turda değişen semboller için (tüm ~500'ü her
    // dakika çekmek gereksiz ağır olurdu, Görev 1'in bulgusuyla çelişirdi).
    // Batch'li + aralarda bekleme, mevcut mum toplayıcısının örüntüsüyle aynı.
    if (histDocs.length > 0) {
      const oiMap = await _fetchBinanceOIBatch(histDocs.map(d => d.symbol));
      histDocs.forEach(d => {
        const oiQty = oiMap.get(d.symbol);
        d.openInterest = oiQty != null ? oiQty * d.price : null;
      });
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
        // gorevler4.md Görev-3 — FR değişmemiş olsa bile (aşağıdaki erken
        // return'den ÖNCE) fiyat her turda güncellensin, alarm kontrolcüsü
        // taze veri bulsun.
        const lp = parseFloat(t.lastPrice);
        if (!isNaN(lp)) _latestPrices.bybit.set(t.symbol, lp);

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

// ── Binance: L/S Metrikleri (her 5dk, sabit coin listesi) ────────────
// Kom1/Kom2/Kom3 motorları henüz bu veriyi okumuyor ve şu an kimse tüm
// 526 USDT perpetual'i tarama ihtiyacı doğurmuyor — bu yüzden tam market
// taraması yerine backtest pipeline'ının izlediği sabit coin listesiyle
// sınırlandırıldı. Tam market taraması FAZ 2: Kom1/2/3 gerçekten watchlist
// tabanlı canlı tarama ihtiyacı doğurduğunda ele alınacak.
//
// NOT: Bu liste backtest pipeline'ının tam ~30 coin listesinin YERİNE
// GEÇMEZ — sadece kullanıcının verdiği 8 örnek coin (hepsi Binance
// futures'ta doğrulandı). "+ sonradan eklenenler" kısmı netleşince bu
// diziye eklenmesi yeterli.
const LS_COLLECTOR_SYMBOLS = [
  'BANKUSDT', 'AKEUSDT', 'DEXEUSDT', 'TUSDT', 'SOMIUSDT', 'GUNUSDT', 'ARXUSDT', 'ZORAUSDT',
];

async function collectLSData() {
  if (mongoose.connection.readyState !== 1) return;
  try {
    const symbols = LS_COLLECTOR_SYMBOLS;

    const now = new Date();
    const docs = [];

    const BATCH = 5;
    for (let i = 0; i < symbols.length; i += BATCH) {
      const batch = symbols.slice(i, i + BATCH);
      await Promise.allSettled(batch.map(async (sym) => {
        try {
          const [global, topPos, topAcc, taker] = await Promise.all([
            fetchJson('fapi.binance.com', `/futures/data/globalLongShortAccountRatio?symbol=${sym}&period=5m&limit=1`),
            fetchJson('fapi.binance.com', `/futures/data/topLongShortPositionRatio?symbol=${sym}&period=5m&limit=1`),
            fetchJson('fapi.binance.com', `/futures/data/topLongShortAccountRatio?symbol=${sym}&period=5m&limit=1`),
            fetchJson('fapi.binance.com', `/futures/data/takerlongshortRatio?symbol=${sym}&period=5m&limit=1`),
          ]);
          const g = Array.isArray(global) ? global[0] : null;
          const tp = Array.isArray(topPos) ? topPos[0] : null;
          const ta = Array.isArray(topAcc) ? topAcc[0] : null;
          const tk = Array.isArray(taker)  ? taker[0]  : null;
          if (!g && !tp && !ta && !tk) return;

          docs.push({
            exchange:  'binance',
            symbol:    sym,
            timestamp: now,
            globalRatio:         g  ? parseFloat(g.longShortRatio)  : null,
            globalLongPct:       g  ? parseFloat(g.longAccount)     : null,
            globalShortPct:      g  ? parseFloat(g.shortAccount)    : null,
            topPositionRatio:    tp ? parseFloat(tp.longShortRatio) : null,
            topPositionLongPct:  tp ? parseFloat(tp.longAccount)    : null,
            topPositionShortPct: tp ? parseFloat(tp.shortAccount)   : null,
            topAccountRatio:     ta ? parseFloat(ta.longShortRatio) : null,
            topAccountLongPct:   ta ? parseFloat(ta.longAccount)    : null,
            topAccountShortPct:  ta ? parseFloat(ta.shortAccount)   : null,
            takerBuySellRatio:   tk ? parseFloat(tk.buySellRatio)   : null,
            takerBuyVol:         tk ? parseFloat(tk.buyVol)         : null,
            takerSellVol:        tk ? parseFloat(tk.sellVol)        : null,
            createdAt: now
          });
        } catch { /* sessizce geç — tek sembol hatası turu durdurmasın */ }
      }));
      await sleep(250); // Rate limit koruması — 4 endpoint × batch eş zamanlı gidiyor
    }

    if (docs.length > 0) {
      await LSMetrics.insertMany(docs, { ordered: false }).catch(() => {});
    }
    console.log(`[Collector] L/S metrikleri: ${docs.length}/${symbols.length} sembol güncellendi`);
  } catch (e) {
    console.error('[Collector] L/S hatası:', e.message);
  }
}

// ── Kom2: OI + Global L/S Geçmişi (her 5dk, Kom2ServerWatcher'ın "sert
// coin" evreni — ~80 sembol, sabit liste DEĞİL, her turda güncel evrenden
// okunur). collectLSData'nın desenini taklit eder, ama FARKLI olarak canlı
// ileri-toplama (geriye sayfalama YOK — Kom2ServerWatcher'ın 7 günlük
// kalıcılık testi zamanla biriken bu geçmişi kullanacak, bkz. plan
// "soğuk başlangıç" notu: ilk ~7 gün Kom2 hiç sinyal ÜRETEMEZ, bu normal).
// [2026-08-18, kullanıcı sorusu üzerine düzeltme] limit=5 (ilk yazımda 15'ti):
// bu collector 5 dakikada bir çalışıyor ve period=5m veri çekiyor — yani her
// turda genelde SADECE ~1 yeni kayıt birikmiş olur. limit=15 seçilmiş olması
// her turda ÖNCEKİ turlarla ÇAKIŞAN ~14 kaydı da tekrar tekrar yazdırıyordu
// (tekilleştirme indeksi YOK, bkz. şema notu) — 80 sembol × 2 koleksiyon ×
// 15 kayıt × (günde 288 tur) ~= 691.200 kayıt/gün gibi büyük ölçüde gereksiz
// bir yazım hacmine yol açardı. limit=5, kaçırılan tek bir tur (~5dk) için
// hâlâ yeterli tampon bırakırken israfı ~3 kat azaltıyor. ──
async function collectKom2OiLsData() {
  if (mongoose.connection.readyState !== 1) return;
  try {
    const symbols = Kom2ServerWatcher.getUniverseSummary().symbols;
    if (!symbols.length) {
      console.log('[Collector] Kom2 OI/L-S: evren henüz yenilenmedi, bu tur atlandı.');
      return;
    }

    const now = new Date();
    const oiDocs = [];
    const lsDocs = [];

    const BATCH = 5;
    for (let i = 0; i < symbols.length; i += BATCH) {
      const batch = symbols.slice(i, i + BATCH);
      await Promise.allSettled(batch.map(async (sym) => {
        try {
          const [oiHist, lsHist] = await Promise.all([
            fetchJson('fapi.binance.com', `/futures/data/openInterestHist?symbol=${sym}&period=5m&limit=5`),
            fetchJson('fapi.binance.com', `/futures/data/globalLongShortAccountRatio?symbol=${sym}&period=5m&limit=5`),
          ]);
          if (Array.isArray(oiHist)) {
            for (const r of oiHist) {
              oiDocs.push({
                symbol: sym, timestamp: new Date(r.timestamp),
                sumOpenInterest: parseFloat(r.sumOpenInterest),
                sumOpenInterestValue: parseFloat(r.sumOpenInterestValue),
                createdAt: now,
              });
            }
          }
          if (Array.isArray(lsHist)) {
            for (const r of lsHist) {
              lsDocs.push({
                symbol: sym, timestamp: new Date(r.timestamp),
                globalRatio: parseFloat(r.longShortRatio),
                globalLongPct: parseFloat(r.longAccount),
                globalShortPct: parseFloat(r.shortAccount),
                createdAt: now,
              });
            }
          }
        } catch { /* sessizce geç — tek sembol hatası turu durdurmasın */ }
      }));
      await sleep(250);
    }

    if (oiDocs.length > 0) await Kom2OiHistory.insertMany(oiDocs, { ordered: false }).catch(() => {});
    if (lsDocs.length > 0) await Kom2LsHistory.insertMany(lsDocs, { ordered: false }).catch(() => {});
    console.log(`[Collector] Kom2 OI/L-S: ${symbols.length} sembol, ${oiDocs.length} OI + ${lsDocs.length} L/S kaydı eklendi.`);
  } catch (e) {
    console.error('[Collector] Kom2 OI/L-S hatası:', e.message);
  }
}

// ── Bybit: L/S Metrikleri (her 5dk, aynı sabit coin listesi) ────────
// Bybit'in public API'sinde Binance'in topPosition/topAccount/taker'ına
// karşılık gelen bir endpoint YOK — sadece /v5/market/account-ratio var
// (bkz. js/data/ls-data-store.js başlığındaki not). Bu yüzden Bybit
// kayıtlarında sadece globalRatio/globalLongPct/globalShortPct dolu olur,
// geri kalanı null kalır — bu eksik veri değil, gerçek bir kaynak kısıtı.
async function collectBybitLSData() {
  if (mongoose.connection.readyState !== 1) return;
  try {
    const symbols = LS_COLLECTOR_SYMBOLS;
    const now = new Date();
    const docs = [];

    const BATCH = 5;
    for (let i = 0; i < symbols.length; i += BATCH) {
      const batch = symbols.slice(i, i + BATCH);
      await Promise.allSettled(batch.map(async (sym) => {
        try {
          const json = await fetchJsonUrl(`https://api.bybit.com/v5/market/account-ratio?category=linear&symbol=${sym}&period=5min&limit=1`);
          if (json?.retCode !== 0) return;
          const d = json.result?.list?.[0];
          if (!d) return;

          const buyRatio  = parseFloat(d.buyRatio);
          const sellRatio = parseFloat(d.sellRatio);
          docs.push({
            exchange:  'bybit',
            symbol:    sym,
            timestamp: now,
            globalRatio:    sellRatio > 0 ? buyRatio / sellRatio : null,
            globalLongPct:  buyRatio,
            globalShortPct: sellRatio,
            createdAt: now
          });
        } catch { /* sessizce geç — tek sembol hatası turu durdurmasın */ }
      }));
      await sleep(250); // Rate limit koruması
    }

    if (docs.length > 0) {
      await LSMetrics.insertMany(docs, { ordered: false }).catch(() => {});
    }
    console.log(`[Collector] Bybit L/S metrikleri: ${docs.length}/${symbols.length} sembol güncellendi`);
  } catch (e) {
    console.error('[Collector] Bybit L/S hatası:', e.message);
  }
}

// ── Sembol Durum Taraması (Görev 8, 2026-08-27 Bybit'e genişletildi) ──
// delist/yeni-listelenme algılama. Binance (spot + futures) + Bybit
// (sadece futures/linear — bu projede Bybit SPOT hiç yok, bkz.
// SpotDataStore notu). Önceden "Bybit için aynı public status mekanizması
// araştırılmadı" deniyordu — araştırıldı: Bybit'in `instruments-info`
// endpoint'i de aynı şekilde bir `status` alanı döndürüyor (zaten
// screener-core.js:_getBybitSymbols bunu sembol filtrelemek için
// kullanıyordu), sadece değerler farklı string'ler ('Trading'/'PreLaunch'/
// 'Settling'/'Closed'/'Delivering' — Binance'in 'TRADING'/'PENDING_TRADING'/
// 'SETTLING'/'BREAK'ından farklı casing+kelime). Bu yüzden kategori mantığı
// artık borsaya özel bir `categoryFn(status, prevStatus)` callback'i ile
// parametrize edildi — iki borsa aynı fonksiyonu PAYLAŞMIYOR, kopya değil,
// gerçekten farklı sözlükler.
// Delisting duyuruları saatlerce/günlerce önceden gelir, bu yüzden 15dk'lık
// bir tarama periyodu fazlasıyla yeterli — ağırlık bütçesine etkisi ihmal
// edilebilir (3 istek: 2 Binance exchangeInfo + 1 Bybit instruments-info).
async function _processSymbolStatusMarket(exchange, market, symbolObjs, statusOf, isRelevant, categoryFn, events, now) {
  const relevant = symbolObjs.filter(isRelevant);
  const existing = await SymbolStatus.find({ exchange, market }).lean();
  const prevMap = new Map(existing.map(d => [d.symbol, d.status]));
  const isBootstrap = existing.length === 0; // ilk tur — geçmişi olmayan turda olay üretme

  const bulkOps = [];
  for (const s of relevant) {
    const symbol = s.symbol;
    const status = statusOf(s);
    const prevStatus = prevMap.get(symbol);

    if (!isBootstrap) {
      if (prevStatus === undefined) {
        events.push({ exchange, market, symbol, fromStatus: null, toStatus: status, category: 'new_listing', timestamp: now, createdAt: now });
      } else if (prevStatus !== status) {
        const category = categoryFn(status, prevStatus);
        if (category) {
          events.push({ exchange, market, symbol, fromStatus: prevStatus, toStatus: status, category, timestamp: now, createdAt: now });
        }
      }
    }

    bulkOps.push({
      updateOne: {
        filter: { exchange, market, symbol },
        update: { $set: { status, updatedAt: now } },
        upsert: true,
      }
    });
  }
  if (bulkOps.length > 0) await SymbolStatus.bulkWrite(bulkOps, { ordered: false });
}

const _binanceFuturesCategory = (status, prevStatus) => {
  if (status === 'SETTLING') return 'delist_warning';
  if (status === 'TRADING' && prevStatus === 'PENDING_TRADING') return 'new_listing';
  return null;
};
const _binanceSpotCategory = (status) => status === 'BREAK' ? 'delist_warning' : null;
// Bybit v5 instruments-info status değerleri: PreLaunch/Trading/Settling/Delivering/Closed.
const _bybitLinearCategory = (status, prevStatus) => {
  if (status === 'Settling' || status === 'Delivering' || status === 'Closed') return 'delist_warning';
  if (status === 'Trading' && prevStatus === 'PreLaunch') return 'new_listing';
  return null;
};

async function collectSymbolStatusChanges() {
  if (mongoose.connection.readyState !== 1) return;
  try {
    const [futuresInfo, spotInfo, bybitInfo] = await Promise.all([
      fetchJson('fapi.binance.com', '/fapi/v1/exchangeInfo'),
      fetchJson('api.binance.com', '/api/v3/exchangeInfo'),
      fetchJsonUrl('https://api.bybit.com/v5/market/instruments-info?category=linear&limit=1000'),
    ]);

    const now = new Date();
    const events = [];

    if (Array.isArray(futuresInfo?.symbols)) {
      await _processSymbolStatusMarket('binance', 'futures', futuresInfo.symbols,
        s => s.status,
        s => s.quoteAsset === 'USDT' && s.contractType === 'PERPETUAL',
        _binanceFuturesCategory, events, now);
    }
    if (Array.isArray(spotInfo?.symbols)) {
      await _processSymbolStatusMarket('binance', 'spot', spotInfo.symbols,
        s => s.status,
        s => s.quoteAsset === 'USDT',
        _binanceSpotCategory, events, now);
    }
    const bybitList = bybitInfo?.result?.list;
    if (Array.isArray(bybitList)) {
      await _processSymbolStatusMarket('bybit', 'futures', bybitList,
        s => s.status,
        s => s.quoteCoin === 'USDT' && s.contractType === 'LinearPerpetual',
        _bybitLinearCategory, events, now);
    }

    if (events.length > 0) {
      await SymbolStatusEvent.insertMany(events, { ordered: false }).catch(() => {});
    }
    console.log(`[Collector] Sembol durum taraması: ${events.length} yeni olay (BN futures ${futuresInfo?.symbols?.length || 0}, BN spot ${spotInfo?.symbols?.length || 0}, Bybit linear ${bybitList?.length || 0} sembol tarandı)`);
  } catch (e) {
    console.error('[Collector] Sembol durum tarama hatası:', e.message);
  }
}

// ── Fiyat Alarmları — sunucu taraflı kontrol (Faz 1, 2026-08-26) ─────
// gorevler4.md Görev-3: `_latestPrices`'ı (zaten çekilen ticker verisinden,
// EKSTRA istek YOK) alert-store.js'in checkPrice()'ıyla AYNI mantıkla
// (crossing/above/below) değerlendirir. Sadece manuel alarmlar burada —
// eğik çizgi alarmları hâlâ sadece tarayıcıda (bkz. Alert şeması notu).
async function checkAlerts() {
  if (mongoose.connection.readyState !== 1) return;
  try {
    const alerts = await Alert.find({ active: true, triggered: false });
    if (!alerts.length) return;
    const now = Date.now();
    for (const a of alerts) {
      if (a.expiresAt && now > a.expiresAt) {
        a.active = false;
        await a.save().catch(() => {});
        continue;
      }
      const price = _latestPrices[a.exchange]?.get(a.symbol);
      if (price == null) continue; // bu sembol için henüz fiyat gelmemiş

      if (a.lastKnownPrice == null) {
        a.lastKnownPrice = price;
        await a.save().catch(() => {});
        continue;
      }
      const crossedUp   = a.lastKnownPrice < a.price && price >= a.price;
      const crossedDown = a.lastKnownPrice > a.price && price <= a.price;
      const fires = a.condition === 'above' ? crossedUp
                  : a.condition === 'below' ? crossedDown
                  : (crossedUp || crossedDown);
      if (fires) {
        a.triggered = true;
        a.triggeredAt = now;
        if (a.notifyTelegram) {
          const msg = a.message ? a.message : `🔔 <b>${a.symbol}</b> ${a.price}'ı geçti (şu an: ${price})`;
          sendTelegramMessage(msg);
        }
      } else {
        a.lastKnownPrice = price;
      }
      await a.save().catch(() => {});
    }
  } catch (e) {
    console.error('[Collector] Alarm kontrolü hatası:', e.message);
  }
}

// ── Zamanlayıcılar ──────────────────────────────────────────────────
// DB bağlandıktan sonra başlat
// Tüm toplayıcılar açılışta aynı anda ateşlenirse (hepsi tek Binance IP'sinden
// neredeyse aynı milisaniyede istek atınca) ani bir istek/bağlantı patlaması
// oluşuyor — 2026-08-08'de bu yüzden production'da 11 saatlik bir Binance
// hız-limit ban'ı (code:-1003) yaşandı. Çözüm: her toplayıcının hem ilk
// çağrısını hem periyodik döngüsünü birkaç saniye arayla, art arda başlat.
// setInterval'i de aynı gecikmeli setTimeout içinde kaydettiğimiz için bu
// ofset sadece ilk turda değil, kalıcı olarak korunur — periyotlar bir daha
// asla aynı ana denk gelmez (mevcut OI poller'ın, market-data-store.js,
// kullandığı örüntüyle aynı fikir).
function _staggeredStart(fn, delayMs, intervalMs) {
  setTimeout(() => {
    fn();
    setInterval(fn, intervalMs);
  }, delayMs);
}

mongoose.connection.once('open', () => {
  console.log('[Collector] Arka plan toplayıcı başlatıldı! (art arda, kademeli)');

  // Sıralama, en hafiften en ağıra: binanceData (~50 weight) → bybitData
  // (ayrı borsa, Binance bütçesini etkilemez) → Binance L/S (8 sembol ×
  // 4 endpoint, ~32 weight) → Bybit L/S (ayrı borsa, kendi bütçesi, 8
  // sembol × 1 endpoint) → Kom1 (gorevler3.md Görev 6, ~527 sembol —
  // artık en ağır iş, eskiden burada olan collectBinanceCandles Görev 12'de
  // kaldırıldı: hiçbir frontend kodu Candle koleksiyonunu okumuyordu,
  // sadece Binance ağırlık bütçesi ve depolama harcıyordu).
  _staggeredStart(collectBinanceData,    0,      1 * 60 * 1000);  // 1 dakika — bot sinyalleri için
  _staggeredStart(collectBybitData,      5000,   1 * 60 * 1000);  // 1 dakika
  _staggeredStart(collectLSData,         10000,  5 * 60 * 1000);  // Binance L/S — sabit 8 coinlik liste
  _staggeredStart(collectBybitLSData,    12000,  5 * 60 * 1000);  // Bybit L/S — aynı liste, ayrı borsa
  _staggeredStart(collectSymbolStatusChanges, 20000, 15 * 60 * 1000); // Delist/yeni-liste taraması — hafif (2 istek), sık gerekmez

  // gorevler4.md Görev-3 (2026-08-26) — fiyat alarmları kontrolcüsü. Sıfır
  // Binance/Bybit isteği (sadece bellekteki _latestPrices'ı okur), bu yüzden
  // diğer toplayıcılarla zamanlama çakışması kaygısı yok. 25000ms: collectBinanceData
  // (delay=0) ve collectBybitData (delay=5000) ilk turlarını bitirip
  // _latestPrices'ı doldurmuş olsun diye küçük bir pay.
  _staggeredStart(checkAlerts, 25000, 60 * 1000);

  // "1D Open" gün açılış fiyatı hangi güne kadar zaten kaydedilmiş —
  // restart sonrası o anki fiyatı yanlışlıkla "yeni gün açılışı" sanıp
  // gerçek açılış anındaki değerin üzerine yazmasın diye.
  DayOpenPrice.findOne({}, { day: 1, _id: 0 }).lean()
    .then(doc => { if (doc) _dayOpenCapturedDay = doc.day; })
    .catch(err => console.warn('[DayOpenPrice] Kayıtlı gün bilgisi yüklenemedi (ilk çalıştırma olabilir):', err.message));

  // Kom1 sunucu gözlemi (gorevler3.md Görev 5, 2026-08-11 → Görev 6,
  // 2026-08-12): ~5 dakikada bir, o turda "sırası gelen" (katman aralığı
  // dolmuş) sembolleri tarar — artık sabit 11 değil, hacme göre 3 katmana
  // bölünmüş tüm USDT perpetual evreni (bkz. kom1-server-watcher.js başlığı).
  // Kalıcı rotasyon durumu: açılışta Kom1ScanState'ten yüklenir, her
  // tick sonrası geri yazılır — sunucu yeniden başlasa bile kaldığı
  // yerden devam eder.
  //
  // Gecikme hâlâ 40000ms: collectBinanceCandles kaldırıldı (Görev 12) ama
  // diğer toplayıcılarla çakışmayı önlemek için pay bırakan bu gecikme
  // korunuyor — değiştirmeye gerek yok, sadece artık daha rahat bir pencere.
  Kom1ScanState.find({}, { _id: 0, __v: 0 }).lean()
    .then(records => Kom1ServerWatcher.loadScanState(records))
    .catch(err => console.warn('[Kom1ServerWatcher] Kayıtlı tarama durumu yüklenemedi (ilk çalıştırma olabilir):', err.message));

  _staggeredStart(() => {
    // tick() bir Promise döner — yakalanmadan bırakılırsa (unhandled rejection)
    // Node bu sürümde process'i çökertebilir; _staggeredStart'ın diğer
    // toplayıcıları kendi içinde try/catch'li, burada da aynı güvenlik sağlanıyor.
    Kom1ServerWatcher.tick(async (confirmed) => {
      try {
        await Kom1SignalLog.create(confirmed);
        sendTelegramMessage(_kom1TelegramText(confirmed));
      }
      catch (err) { console.warn('[Kom1ServerWatcher] Sinyal kaydedilemedi:', err.message); }
    }, _latestBinanceTickers).then(async () => {
      // Tarama durumunu (katman/hacim/son-tarandı) kalıcı hale getir —
      // watcher kendi Mongo'ya dokunmaz (DB-agnostic), bu yüzden server.js yapıyor.
      const records = Kom1ServerWatcher.getScanStateForPersist();
      if (!records.length) return;
      try {
        await Kom1ScanState.bulkWrite(
          records.map(r => ({
            updateOne: { filter: { symbol: r.symbol }, update: { $set: r }, upsert: true }
          })),
          { ordered: false }
        );
      } catch (err) { console.warn('[Kom1ServerWatcher] Tarama durumu kaydedilemedi:', err.message); }
    }).catch(err => console.error('[Kom1ServerWatcher] tick hatası:', err.message));
  }, 40000, 5 * 60 * 1000);

  // ── Kom2 sunucu gözlemi (2026-08-17, kullanıcı onayıyla, plan: robust-
  // strolling-turtle) — OI-kalıcılık yolu. Collector (OI/L-S Mongo'ya
  // yazar) tick'ten (Mongo'dan okur) 5sn ÖNCE başlıyor ki aynı 5dk'lık
  // pencerede veri önce yazılmış olsun.
  //
  // [2026-08-18, DÖRDÜNCÜ DÜZELTME] 70000/75000ms de yetmedi — production'da
  // ban, Kom2'nin tick'i başlar başlamaz (deploy'dan ~74sn sonra) geldi.
  // Muhtemel sebep: bu gecenin çok sayıda arka arkaya redeploy'u Kom1'in
  // KENDİ tick'ini de her seferinde yeniden başlattı, bu da Kom1'in
  // "sırası gelen sembol" birikimini büyütüp tipik tick süresini
  // beklenenden çok uzatmış olabilir. Güvenlik payı çok daha büyütüldü:
  // 180000/185000ms (3dk/3dk5sn) — Kom1'in tick'inin (40000ms'de başlıyor)
  // ne kadar uzun sürerse sürsün bitmiş olacağı bir noktaya itildi. Hâlâ
  // aynı 5dk'lık tick periyodu içinde kalıyor.
  //
  // ⚠️ SOĞUK BAŞLAŞLANGIÇ: OI geçmişi sıfırdan birikmeye başlıyor, 7 günlük
  // kalıcılık penceresi dolmadan (yaklaşık 2026-08-25) Kom2 HİÇ sinyal
  // ÜRETEMEZ — bu bir hata/ban belirtisi DEĞİL, beklenen bir durum.
  console.log('[Kom2ServerWatcher] ⚠️ Soğuk başlangıç: OI/L-S geçmişi şimdi birikmeye başlıyor, 7 günlük kalıcılık penceresi dolmadan (yaklaşık 7 gün sonra) hiç sinyal üretilmeyecek. Bu normal, hata/ban değil.');

  Kom2ScanState.find({}, { _id: 0, __v: 0 }).lean()
    .then(records => Kom2ServerWatcher.loadScanState(records))
    .catch(err => console.warn('[Kom2ServerWatcher] Kayıtlı tarama durumu yüklenemedi (ilk çalıştırma olabilir):', err.message));

  _staggeredStart(collectKom2OiLsData, 180000, 5 * 60 * 1000);

  _staggeredStart(() => {
    const queryOiHistory = (symbol, sinceMs) =>
      Kom2OiHistory.find({ symbol, timestamp: { $gte: new Date(sinceMs) } }, { _id: 0, timestamp: 1, sumOpenInterest: 1 })
        .sort({ timestamp: 1 }).lean()
        .then(rows => rows.map(r => ({ timestamp: r.timestamp.getTime(), value: r.sumOpenInterest })));
    const queryLsHistory = (symbol, sinceMs) =>
      Kom2LsHistory.find({ symbol, timestamp: { $gte: new Date(sinceMs) } }, { _id: 0, timestamp: 1, globalRatio: 1 })
        .sort({ timestamp: 1 }).lean()
        .then(rows => rows.map(r => ({ timestamp: r.timestamp.getTime(), value: r.globalRatio })));

    Kom2ServerWatcher.tick(queryOiHistory, queryLsHistory, async (confirmed) => {
      // NOT: Telegram'a bilinçli olarak BAĞLANMADI (kullanıcı isteği,
      // 2026-08-17) — ayrı, ileri seviye bir iş olarak bekliyor.
      try {
        await Kom2SignalLog.create(confirmed);
      } catch (err) { console.warn('[Kom2ServerWatcher] Sinyal kaydedilemedi:', err.message); }
    }).then(async () => {
      const records = Kom2ServerWatcher.getScanStateForPersist();
      if (!records.length) return;
      try {
        await Kom2ScanState.bulkWrite(
          records.map(r => ({
            updateOne: { filter: { symbol: r.symbol }, update: { $set: r }, upsert: true }
          })),
          { ordered: false }
        );
      } catch (err) { console.warn('[Kom2ServerWatcher] Tarama durumu kaydedilemedi:', err.message); }
    }).catch(err => console.error('[Kom2ServerWatcher] tick hatası:', err.message));
  }, 185000, 5 * 60 * 1000);
});

// ==========================================
// 4. API Rotaları
// ==========================================

// ── Çizim Senkronizasyonu ───────────────────────────────────────────
// gorevler2.md Görev 9.2 (2026-08-10) — syncKey kullanıcı tarafından serbest
// metin olarak girilen bir değer (bkz. js/core/app.js:_bindSyncKey, js/core/state.js:getSyncKey),
// sunucu tarafında üretilmiyor/doğrulanmıyor — kısa/tahmin edilebilir bir
// syncKey seçen bir kullanıcının kaydını kaba kuvvetle bulmaya çalışmak
// teorik olarak mümkündü. Rate-limit bunu pratikte anlamsız hâle getiriyor
// (meşru kullanım: js/core/state.js:syncDrawingsCloud zaten 1sn debounce'lu,
// dakikada birkaç istekten fazlasına hiç ihtiyaç yok).
const syncLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Çok fazla istek, lütfen bir dakika sonra tekrar deneyin' },
});
app.use('/api/sync/drawings', syncLimiter);

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

// ── L/S Geçmiş Verisi ─────────────────────────────────────────────────
// GET /api/history/ls/:exchange/:symbol?hours=60
app.get('/api/history/ls/:exchange/:symbol', async (req, res) => {
  try {
    const { exchange, symbol } = req.params;
    const hours  = Math.min(parseInt(req.query.hours) || 48, 60);
    const since  = new Date(Date.now() - hours * 60 * 60 * 1000);
    const sym    = symbol.toUpperCase().endsWith('USDT') ? symbol.toUpperCase() : symbol.toUpperCase() + 'USDT';

    const records = await LSMetrics.find(
      { exchange, symbol: sym, timestamp: { $gte: since } },
      {
        timestamp: 1, _id: 0,
        globalRatio: 1, globalLongPct: 1, globalShortPct: 1,
        topPositionRatio: 1, topPositionLongPct: 1, topPositionShortPct: 1,
        topAccountRatio: 1, topAccountLongPct: 1, topAccountShortPct: 1,
        takerBuySellRatio: 1, takerBuyVol: 1, takerSellVol: 1,
      }
    ).sort({ timestamp: 1 }).lean();

    res.json(records);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Sembol Durum Olayları (Görev 8 — delist/yeni-liste uyarısı) ───────
// GET /api/symbol-status/events?hours=168&market=futures
app.get('/api/symbol-status/events', async (req, res) => {
  try {
    const hours  = Math.min(parseInt(req.query.hours) || 168, 720); // varsayılan 7 gün, azami 30 gün
    const since  = new Date(Date.now() - hours * 60 * 60 * 1000);
    const filter = { timestamp: { $gte: since } };
    if (req.query.market === 'spot' || req.query.market === 'futures') filter.market = req.query.market;

    const records = await SymbolStatusEvent.find(
      filter,
      { _id: 0, __v: 0 }
    ).sort({ timestamp: -1 }).limit(500).lean();

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

// ── Kom1 Sunucu Gözlemi (gorevler3.md Görev 5) ────────────────────────
// GET /api/kom1/signals — kesinleşmiş sinyaller (en yeni önce)
app.get('/api/kom1/signals', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const records = await Kom1SignalLog.find({}, { _id: 0, __v: 0 })
      .sort({ confirmedAt: -1 }).limit(limit).lean();
    res.json(records);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Kom1 Tarayıcı Motoru Yazımı (gorevler3.md Görev 7, 2026-08-14) ──────
// POST /api/kom1/signals — js/screener/kom1-scanner.js (tarayıcı, sabit 11
// coin, gerçek WS ile ANLIK tespit eden asıl/yetkili motor) bir sinyali
// kesinleştirdiğinde bunu doğrudan buraya yazar. Önceden bu kayıt sadece
// tarayıcı belleğinde tutuluyordu (sayfa kapanınca kaybolurdu) — artık
// kom1-server-watcher.js'in (REST, ~5dk'lık yaklaşık tarama) yakalamasını
// beklemeden ANINDA kalıcı hale geliyor. `kom1-server-watcher.js` bu 11
// coin'i kendi taramasından hariç tutuyor (bkz. CLIENT_SYMBOLS orada) —
// aynı sinyal iki kez (biri hızlı/burada, biri gecikmeli/orada) yazılmasın
// diye. Sembol + bigTf beyaz listeyle sınırlı (rastgele veri yazılmasın).
const KOM1_CLIENT_SYMBOLS = new Set([
  'ONDOUSDT', 'STRKUSDT', 'ENAUSDT', 'BIOUSDT', 'JUPUSDT',
  'TUSDT', 'AEVOUSDT', 'MOVEUSDT', 'VANRYUSDT', 'BERAUSDT', 'HYPEUSDT',
]);
const kom1SignalLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Çok fazla istek, lütfen bir dakika sonra tekrar deneyin' },
});
app.use('/api/kom1/signals', kom1SignalLimiter);

app.post('/api/kom1/signals', async (req, res) => {
  try {
    const b = req.body || {};
    if (!KOM1_CLIENT_SYMBOLS.has(b.symbol)) return res.status(400).json({ error: 'Bilinmeyen sembol' });
    if (b.bigTf !== '1h' && b.bigTf !== '4h') return res.status(400).json({ error: 'Geçersiz bigTf' });
    const numFields = ['rcMid', 'wtVal', 'wtPrev', 'price', 'haOpen', 'haClose', 'dema9'];
    if (numFields.some(f => typeof b[f] !== 'number' || !Number.isFinite(b[f]))) {
      return res.status(400).json({ error: 'Eksik/geçersiz sayısal alan' });
    }
    if (!b.confirmedAt || isNaN(new Date(b.confirmedAt).getTime())) {
      return res.status(400).json({ error: 'Geçersiz confirmedAt' });
    }
    const doc = await Kom1SignalLog.create({
      symbol: b.symbol, bigTf: b.bigTf,
      rcMid: b.rcMid, wtVal: b.wtVal, wtPrev: b.wtPrev, price: b.price,
      haOpen: b.haOpen, haClose: b.haClose, dema9: b.dema9,
      firedAt: b.firedAt ? new Date(b.firedAt) : undefined,
      confirmedAt: new Date(b.confirmedAt),
    });
    sendTelegramMessage(_kom1TelegramText({ symbol: b.symbol, bigTf: b.bigTf, price: b.price }));
    res.status(201).json({ ok: true, id: doc._id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/kom1/status — o an bekleyen (henüz kesinleşmemiş) büyük TF sinyalleri
// + evren/katman özeti (gorevler3.md Görev 6), izleyicinin gerçekten
// çalıştığını görmek için (tarayıcı hiç açılmasa bile).
app.get('/api/kom1/status', (req, res) => {
  res.json({
    pending: Kom1ServerWatcher.getPending(),
    universe: Kom1ServerWatcher.getUniverseSummary(),
    // gorevler4.md Görev-7 (2026-08-26) — botun sessizce çökmesi/takılması
    // ile "çalışıyor ama yeni sinyal/veri yok" durumunu ayırt etmek için.
    // Normal tick aralığı 5dk; bu değer belirgin şekilde daha eskiyse
    // (ör. >30dk) tick() döngüsünün bir yerde exception'la öldüğüne işarettir.
    lastTickAt: Kom1ServerWatcher.getLastTickAt(),
  });
});

// GET /api/market/day-open — Watchlist "1D Open" değişim tipi için UTC gün
// başı fiyat snapshot'ı (bkz. DayOpenPrice şeması yukarıda). Tarayıcı bunu
// bir kez çekip, zaten akan canlı WS fiyatıyla kendi hesaplıyor.
app.get('/api/market/day-open', async (req, res) => {
  try {
    const docs = await DayOpenPrice.find({}, { _id: 0, __v: 0 }).lean();
    const prices = {};
    let day = null;
    docs.forEach(d => { prices[d.symbol] = d.price; day = d.day; });
    res.json({ day, prices });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Fiyat Alarmları — Faz 1 (2026-08-26, gorevler4.md Görev-3) ───────
// alert-store.js'in "fire-and-forget" aynası — istemci akışını bloklamaz,
// hata olursa alarm yerel (localStorage) olarak çalışmaya devam eder.
app.post('/api/alerts', async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.id || !b.symbol) return res.status(400).json({ error: 'id ve symbol gerekli' });
    const doc = await Alert.create({
      clientId: b.id, symbol: b.symbol, exchange: b.exchange || 'binance',
      price: b.price, condition: b.condition, triggerMode: b.triggerMode,
      expiresAt: b.expiresAt ?? null, message: b.message,
      notifyTelegram: !!b.notifyTelegram, tf: b.tf, name: b.name,
      triggered: !!b.triggered, active: b.active !== false,
      lastKnownPrice: b.lastKnownPrice ?? null, createdAt: b.createdAt || Date.now(),
    });
    res.status(201).json({ _id: doc._id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.patch('/api/alerts/:id', async (req, res) => {
  try {
    const b = req.body || {};
    const ALLOWED = ['price', 'condition', 'triggerMode', 'expiresAt', 'message',
      'notifyTelegram', 'active', 'tf', 'name', 'triggered', 'triggeredAt', 'lastKnownPrice'];
    const update = {};
    ALLOWED.forEach(k => { if (b[k] !== undefined) update[k] = b[k]; });
    await Alert.updateOne({ _id: req.params.id }, { $set: update });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/alerts/:id', async (req, res) => {
  try {
    await Alert.deleteOne({ _id: req.params.id });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Kom2 Sunucu Gözlemi (2026-08-17, kullanıcı onayıyla) ─────────────
// GET /api/kom2/signals — kesinleşmiş sinyaller (en yeni önce). POST YOK
// — Kom2'nin Kom1'in 11-coin browser tarayıcısı gibi bir karşılığı yok,
// tamamen server-side.
app.get('/api/kom2/signals', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const records = await Kom2SignalLog.find({}, { _id: 0, __v: 0 })
      .sort({ confirmedAt: -1 }).limit(limit).lean();
    res.json(records);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/kom2/status — bekleyen adaylar + evren özeti (Kom1'in
// /api/kom1/status'üyle aynı şekil).
app.get('/api/kom2/status', (req, res) => {
  res.json({
    pending: Kom2ServerWatcher.getPending(),
    universe: Kom2ServerWatcher.getUniverseSummary(),
    // gorevler4.md Görev-7 (2026-08-26) — bkz. /api/kom1/status'taki AYNI not.
    lastTickAt: Kom2ServerWatcher.getLastTickAt(),
  });
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
app.get('/api/binance/futures/*splat', (req, res) => {
  const path = req.url.replace('/api/binance/futures', '');
  proxyRequest('fapi.binance.com', path, res);
});

app.get('/api/binance/spot/*splat', (req, res) => {
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
    // Upstream status kodu (418/429 ban dahil) client'a aynen aktarılmalı —
    // eskiden burası hep 200 dönüyordu, bu yüzden fetchKlines() gibi çağıranlar
    // res.status===429||418 kontrolüyle ban'ı hiç yakalayamıyor, ban gövdesini
    // ({code:-1003,...}) normal veri sanıp çöküyordu (bkz. 2026-08-10 gorev4
    // production doğrulaması, kl.map is not a function).
    res.statusCode = proxyRes.statusCode;
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

// ── Telegram bildirimi (gorevler3.md Görev 7'nin kalanı, 2026-08-15) ──
// TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID .env'de (Render dashboard, sır —
// koda gömülmez) tanımlı DEĞİLSE fonksiyon sessizce hiçbir şey yapmaz —
// özellik "kapalı" kalır, hata fırlatmaz. Kapsam şimdilik SADECE Kom1
// sinyalleri — fiyat alarmları (AlertStore) hâlâ localStorage'da, ayrı
// bir iş (server-side monitoring + DB taşıma gerektiriyor).
function sendTelegramMessage(text) {
  const token  = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return; // özellik yapılandırılmamış — no-op
  const body = JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' });
  const req = https.request({
    hostname: 'api.telegram.org',
    path: `/bot${token}/sendMessage`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
  }, (res) => {
    // Ateşle-unut: sinyal kaydını Telegram'ın çevrimiçi olup olmamasına
    // bağlı kılmıyoruz, sadece hata durumunda logluyoruz.
    if (res.statusCode >= 400) {
      let errBody = '';
      res.on('data', d => errBody += d);
      res.on('end', () => console.warn('[Telegram] sendMessage başarısız:', res.statusCode, errBody.slice(0, 200)));
    }
  });
  req.on('error', (err) => console.warn('[Telegram] sendMessage isteği atılamadı:', err.message));
  req.write(body);
  req.end();
}

function _kom1TelegramText(sig) {
  const tf = (sig.bigTf || '').toUpperCase();
  const price = typeof sig.price === 'number' ? sig.price : '—';
  return `🟢 <b>Kom1 sinyali</b>\n${sig.symbol} — ${tf}\nFiyat: ${price}`;
}

// ==========================================
// 7. Sunucuyu Başlat
// ==========================================
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Sunucu ${PORT} portunda yayında!`);
});
