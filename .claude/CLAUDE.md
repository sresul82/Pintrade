# graphify
- **graphify** (`.claude/skills/graphify/SKILL.md`) - any input to knowledge graph. Trigger: `/graphify`
When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

# coding-conventions
- **coding-conventions** (`.claude/skills/coding-conventions/SKILL.md`) - dil kuralı: proje (kod VE tüm kullanıcıya gösterilen UI metinleri) tamamen İngilizce, sadece kullanıcıyla sohbet/yazışma Türkçe.
Bu kural her kod yazma/düzenleme işleminde otomatik olarak geçerlidir — ayrıca `.claude/skills/` altına eklenecek gelecekteki tekrarlayan proje kurallarının/tercihlerinin de toplanacağı yerdir.

# bot-architecture
Ortak bot altyapısı kuralları (Görev 5, 2026-08-07) — yeni bot eklerken veya mevcut botlara (FR, M1Hammer, ileride Kom1/Kom2/Kom3, MA/V3/4S) dokunurken zorunlu:
- Hiçbir bot doğrudan REST isteği atmaz. Tüm istekler `BotEngine.queueRestRequest()` üzerinden geçer (`js/screener/bot-engine.js`). Sebep: tüm trafik tek IP'den çıkıyor, Binance ağırlık limiti IP başına.
- Hiçbir bot kendi kline WebSocket'ini açmaz. `MarketDataStore.subscribeKlines()`/`unsubscribeKlines()` kullanılır (`js/data/market-data-store.js`).
- Ban sinyali gelirse BotEngine tüm botları duraklatır; bu davranış bot bazında bypass edilmez.
- FR ve M1Hammer'ın mevcut UI/sinyal formatına DOKUNULMAZ. Ortak Signal zarf formatı sadece yeni botlar için geçerlidir.
- Yeni bot eklerken referans: `dokumentasyon/raporlar/2026-08-07-gorev5-ortak-bot-altyapisi.md`

**ÖNEMLİ — paylaşılan IP bütçesi tarayıcı bot'larıyla SINIRLI DEĞİL (2026-08-12, gorevler3.md Görev 6 sırasında bulundu):**
- Kullanıcının kendi tarayıcı istekleri de (chart açma, mum çekme —
  `js/core/app-config.js`'teki `restFutures`/`restSpot` → `server.js`'teki
  `/api/binance/futures/*`, `/api/binance/spot/*` proxy'leri) AYNI sunucu
  IP'sini, dolayısıyla AYNI Binance ağırlık bütçesini paylaşıyor. İzole
  bir "sadece botlar/toplayıcılar" bütçesi YOK — arka planda bir yerde
  ban tetiklenirse kullanıcının kendi canlı site kullanımı (chart, coin
  analizi) da bundan etkilenir (bkz. 2026-08-08'deki 11 saatlik ban olayı).
- `server.js`'teki SUNUCU-TARAFLI toplayıcılar (`collectBinanceData`,
  `collectBinanceCandles`, `Kom1ServerWatcher` vb.) Node'da çalışır,
  `BotEngine`'i (tarayıcı modülü, `window`/`EventBus`'a bağımlı) KULLANAMAZ
  — bu bir eksiklik değil, farklı bir çalışma ortamı. Bunun yerine kendi
  ayrı pacing/staggering mekanizmaları var: `server.js`'teki
  `_staggeredStart(fn, delayMs, intervalMs)` (her toplayıcının açılış
  gecikmesini birbirinden ayırır) + her toplayıcının kendi iç
  sleep/pace'i (ör. `kom1-server-watcher.js`'teki `SCAN_PACE_MS`).
  **Yeni bir sunucu-taraflı toplayıcı eklerken, mevcut TÜM
  `_staggeredStart` gecikmelerini (`server.js`, `mongoose.connection.once('open', ...)`
  bloğu) kontrol et — ağır iki iş birbirinin çalışma penceresine denk
  gelmesin.** 2026-08-12'de tam bu yüzden bir çakışma bulundu (Kom1'in
  genişletilmiş taraması ile mum toplayıcısı ~6sn'lik pencerede
  çakışıyordu) ve düzeltildi — detay: `dokumentasyon/raporlar/2026-08-12-gorev6-tum-piyasa-genisletme.md`.
