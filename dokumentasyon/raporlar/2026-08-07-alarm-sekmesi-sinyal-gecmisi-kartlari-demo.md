# Alarm Sekmesi — Sinyal Geçmişi Kartları (Demo/Statik)

_Tarih: 2026-08-07_
_Kapsam: Sağ sidebar → Alarm sekmesi içine, kart tabanlı bir "Sinyal Geçmişi" görsel dili eklendi. Bu tur tamamen demo/statik veriyle — gerçek sinyal motoru, filtreleme veya veritabanı bağlantısı yok. Amaç sadece kart tasarımını netleştirmek._

---

## 0. Düzeltme notu

İlk uygulamada bu özellik yanlışlıkla `BotSignalsPanel`'in FR/M1 Hammer/M1-A/V3/4S bot rafına **altıncı bir bot sekmesi** olarak eklenmişti. Bu yanlıştı — Alarm, Bot Signals'tan (Watch görünümündeki "Bot Signals" mini-sekmesi) tamamen bağımsız olmalı. Aşağıdaki doküman **düzeltilmiş, doğru mimariyi** anlatıyor (bkz. Bölüm 1 ve 5).

## 1. Nereye eklendi

Sağ sidebar'da iki üst düzey sekme var: **Watch** (`rsb-watchlist`) ve **Alarm** (`rsb-alarms`). Bunlar birbirinden bağımsız, `app.js` → `_bindSidebar` tarafından yönetilen tam ayrı görünümler:

- **Watch** seçiliyken: screener listesi + altında Coin Detail / Bot Signals / News mini-sekmeleri görünür. "Bot Signals" mini-sekmesi `BotSignalsPanel` modülünü (`dp-signals-tab` içinde, FR/M1 Hammer/M1-A/V3/4S dikey rafıyla) gösterir — **bu tura hiç dokunulmadı.**
- **Alarm** seçiliyken: tamamen ayrı bir container (`dp-alarm-tab`) tüm panel alanını kaplar. Bot rafı burada **hiç render edilmez** — `BotSignalsPanel`'in `_activeBot` state'i bu görünümde devreye girmiyor.

Yeni/değişen dosyalar:

- **Yeni:** [js/screener/alarm-signal-history.js](js/screener/alarm-signal-history.js) — `AlarmSignalHistory` modülü, kart üretimi + tıklama davranışı burada, `BotSignalsPanel`'den tamamen bağımsız
- [index.html](index.html) — `detail-body` içine `#dp-alarm-tab` div'i eklendi, yeni script dahil edildi
- [js/core/app.js](js/core/app.js) — `_bindSidebar`'daki `watchlist:toggle` handler'ı, `rsb-alarms` seçiliyken `dp-signals-tab` yerine `dp-alarm-tab`'ı gösterecek ve `AlarmSignalHistory.init()`'i çağıracak şekilde güncellendi
- [js/screener/bot-signals-panel.js](js/screener/bot-signals-panel.js) — ilk (yanlış) turda eklenen `kom-alarm` bot sekmesi tamamen geri alındı, dosya orijinal haline döndü

## 2. Kart yapısı

Her kart üç bölümden oluşuyor (M1 Hammer'ın kompakt kutucuklu diline benzer, farklı veri alanlarıyla):

- **Üst satır:** `#COINUSDT` + Kom rozeti (Kom1/Kom2/Kom3, renk kodlu) + sağda fiyat değişim yüzdesi (yeşil/kırmızı)
- **Tarih satırı:** sinyal zamanı (`gg Ay ss:dd` formatı, `tr-TR` locale). 24 saatten eski sinyallerde veya `isOld` işaretliyse ek bir **"Geçmiş"** etiketi + kart opaklığı %55'e düşürülüyor
- **Kutucuklar (chips):** `.bsp-chip` sınıfı (bot-signals-panel.js'in global stil bloğuyla paylaşılan, sayfa yüklenince bir kez enjekte ediliyor), esnek `flex-wrap` ile taşan alanlarda alt satıra geçiyor
- **Alt bant:** turuncu (kural tetiklendi) veya gri (Kom3 gibi henüz tanımlanmamış placeholder) arka planlı açıklama satırı

### Kom rozeti renkleri

| Rozet | Renk | Anlam |
|---|---|---|
| Kom1 | Mavi (#3b82f6) | Kanıtlanmış/sakin grup sinyali |
| Kom2 | Turuncu (#f97316) | Sert/riskli grup sinyali |
| Kom3 | Gri, **kesikli kenarlık** | Henüz tanımlanmamış — placeholder |

## 3. 5 Demo Kart

1. **STRKUSDT — Kom1, normal:** OI/L-S/RSI/WT1 kutucukları, standart görünüm
2. **1000RATSFLOKIBABYDOGEUSDT — Kom1, taşma testi:** çok uzun coin adı + 8 kutucuk (RSI 1H/4H, WT1/4H, Hacim). `flex-wrap` ile kutucuklar sorunsuz alt satıra geçiyor, coin adı `text-overflow:ellipsis` ile korumaya alındı
3. **BANKUSDT — Kom2, farklı rozet rengi:** divergence temelli kutucuklar (Fiyat Düşüş, RSI Kazanç, Hacim Çarpanı), alt bant Kombinasyon 2 kuralını yazıyor
4. **ARXUSDT — Kom3, placeholder rozet:** kesikli kenarlıklı gri rozet + gri (turuncu değil) açıklama bandı: *"Kom3 kriterleri henüz tanımlanmadı — bu kart yalnızca yer tutucu"*
5. **TIAUSDT — Kom1, eski sinyal:** 3 gün önce, "Geçmiş" etiketi + %55 opaklık ile soluk görünüm

## 4. Tıklama davranışı

Karta tıklanınca mevcut `symbol:change` event'i tetikleniyor (`EventBus.emit('symbol:change', { symbol, exchange })`) ve grafik o coin'e geçiyor. Sinyalin tarihine "zaman yolculuğu" **yapılmıyor** — bu ayrı bir iş olarak bırakıldı (görev talimatına uygun).

## 5. Doğrulama sırasında bulunan ve düzeltilen yan hata

Kart tıklamasını canlı ortamda test ederken **karta tıklayınca Alarm panelinin yüksekliğinin çöktüğü** görüldü — bu yeni kartlara özgü değil, önceden var olan bir mimari tutarsızlıktı:

- **Kök neden:** `detail-panel.js` içindeki `_activeTabId()` fonksiyonu, panel içi `.detail-tab.active` sınıfına bakıyor ("Coin Detail" / "Bot Signals" / "News" mini sekmeleri). Ama sağ sidebar'ın Watchlist/Alarm butonları (`app.js` → `_bindSidebar`) bu iç `.active` sınıfını hiç güncellemiyordu.
- Sonuç: Alarm sekmesi açıkken (`.detail-tabs` çubuğu gizli ama DOM'da hâlâ "Coin Detail" `.active` işaretli), her `symbol:change` sonrası `DetailPanel` yanlışlıkla "Coin Detail sekmesi aktif" sanıp yüksekliği `dp-detail-tab`'ın (gizli, `scrollHeight:0`) içeriğine göre yeniden hesaplıyor ve paneli ~2px'e çöktürüyordu.
- Bu hata yeni kartlarla sınırlı değildi — mevcut M1 Hammer sekmesindeki ticker tıklaması da aynı `symbol:change` event'ini kullandığı için aynı çökmeye açıktı.
- **Düzeltme** ([js/core/app.js](js/core/app.js), `_bindSidebar` içindeki `watchlist:toggle` handler'ı): sidebar sekmesi değiştiğinde `.detail-tab[data-tab="detail"]` / `[data-tab="signals"]` / `[data-tab="news"]` üzerindeki `.active` sınıfı da senkron güncelleniyor artık (Alarm'da `signals` işaretleniyor — sadece bu korumayı tetiklemek için, `dp-signals-tab`'ın kendisi Alarm'da hiç gösterilmiyor). Böylece `_activeTabId()` doğru değeri döndürüyor ve Alarm sekmesindeyken gereksiz yeniden-layout tetiklenmiyor.

## 6. Tarayıcıda doğrulama

Yerel sunucu (`node server.js`, port 5500) üzerinden test edildi:

- Alarm sekmesine tıklanınca 5 kart doğru render oluyor (`#dp-alarm-tab .kom-alarm-card` sayısı = 5) ve **FR/M1 Hammer/M1-A/V3/4S rafı DOM'da hiç görünür değil** (`getBoundingClientRect()` → 0, `offsetParent` → `null`, çünkü `dp-signals-tab` gizli)
- Kom1 (mavi), Kom2 (turuncu), Kom3 (kesikli gri) rozetleri görsel olarak birbirinden ayrışıyor
- Uzun coin adı + 8 kutucuklu kart taşmadan düzgün sarıyor
- "Geçmiş" kart soluk görünüyor ve etiketi doğru gösteriliyor
- BANKUSDT kartına tıklanınca üstteki sembol `BANKUSDT.P` olarak değişti (grafik geçişi çalışıyor), Alarm paneli yüksekliği korunuyor, çökme yok
- Watch → Bot Signals mini-sekmesine geri dönüldüğünde rafın 5 doğru butonu (`fr, m1hammer, m1a, v3, 4s`) sağlam ve görünür — Alarm değişikliği bu görünümü hiç etkilemedi

_Not: Chart alanının kendisi boş görünüyordu çünkü bu ortamda Binance REST'ten `exchangeInfo HTTP 502` hatası alınıyor (test ortamının ağ/IP kısıtı, bu değişiklikle ilgisiz, mevcut bir durum)._

## 7. Bu turda yapılmayanlar (talimata uygun)

- Kom'a göre / coin'e göre filtreleme
- Gerçek sinyal üretimi (veriler tamamen hardcoded)
- Veritabanı bağlantısı
- Sinyal tarihine "zaman yolculuğu"

Bu üçü ayrı işler olarak bekliyor.
