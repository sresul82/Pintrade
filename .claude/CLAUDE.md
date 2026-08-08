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
