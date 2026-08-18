# Görev Kuyruğu 4 — Eksik Kalanların Toplandığı Yeni Kuyruk

**Oluşturulma:** 2026-08-18. `gorevler-durum-ozeti.md` + `gorevler2.md` +
`gorevler3.md` + `siradaki-gorevler.md` taranarak, henüz kapatılmamış/
tamamlanmamış tüm maddeler tek bir yeni kuyrukta toplandı. Eski dosyalar
DEĞİŞTİRİLMEDİ — bu sadece yeni işin başlayacağı güncel liste.

---

## Görev-1 — Chart'ta RSI/WaveTrend/Regression Channel görselleştirmesi

**Durum: Başlanacak (şimdi).** Ön koşul (lightweight-charts v5 migrasyonu)
2026-08-15'te tamamlandı ve doğrulandı — `js/chart/chart-pane.js`'te
`addSeries(LightweightCharts.XSeries, ...)` birleşik API'si kullanılıyor.
Fazlı bir plan daha önce yazılmıştı (RSI/WaveTrend alt-panel, Regression
Channel overlay, TV-tarzı menü) — v4'te 3 kez denenip başarısız olmuştu,
yeni plan v5'in native pane API'sini kullanıyor, o üç yöntemi tekrarlamıyor.

**⭐ Kabul kriteri (unutulmamalı):** Kullanıcı "maksimum şekilde TVdeki gibi
olmalı" diyor — sadece "bir subpane var" yetmez, etiketli 0-100 ekseni,
doğru gridline/referans çizgileri, TV'nin kendi görsel dilini birebir
taklit eden bir sonuç şart. v4'te denenip REDDEDİLEN "yaklaşık/etiketsiz
RSI" sonucu tekrarlanmayacak.

---

## Görev-2 — Kom2 CloudFront/Binance blok olayı sonrası temizlik

**Durum: Blok açılmasını bekliyor.** 2026-08-17/18 gecesi Kom2'nin evren
taraması (ATR14≥%12, ~527 sembol) production'da tekrarlayan ban'lara yol
açtı, son aşamada canlı chart proxy'si de (`/api/binance/futures/*`)
CloudFront'tan 403 almaya başladı — tam detay: `dokumentasyon/raporlar/
2026-08-18-kom2-evren-taramasi-ve-cloudfront-blok-olayi.md`.

- 2.1 Blok açıldığında Kom2'nin evren taramasını güvenli şekilde yeniden
  tetiklemek (mevcut backoff 24 saat — manuel müdahale gerekebilir).
- 2.2 Uzun vadede: evren tarama durumunu Mongo'da kalıcı hale getirmek
  (her redeploy'da sıfırdan başlamasın) — bu gecenin "sık redeploy = istek
  patlaması birikimi" dersinin kalıcı çözümü.
- 2.3 Bu gecenin dersini `.claude/CLAUDE.md` "bot-architecture" bölümüne
  eklemek (kullanıcı onayıyla) — "bir rate-limit sorununu düzeltmeye
  çalışırken sık redeploy etmek sorunu büyütebilir".

---

## Görev-3 — `gorevler3.md` Görev 7'nin kalanı: fiyat alarmları (AlertStore)

**Durum: Açık, aktif iş bekliyor.** Kom1 sinyallerinin Telegram bildirimi
tamamlandı (2026-08-15, production'da doğrulandı) — kalan tek parça
`AlertStore`'un (fiyat alarmları, şu an localStorage-tabanlı) MongoDB'ye
taşınması + kendi sunucu-taraflı izleme döngüsü.

---

## Görev-4 — Kom1 Görev 6: tier3 rotasyon doğrulaması

**Durum: Sadece pasif gözlem gerekiyor, aktif iş yok.** Hacme göre 3
katmanlı rotasyonun (tier3 = en düşük hacimli ~200 coin, 3 saatte bir
taranmalı) fiilen çalıştığı henüz doğrulanmadı — birkaç saatlik gözlemle
`/api/kom1/status` üzerinden kontrol edilebilir.

---

## Görev-5 — Kom3 stratejisi tanımı

**Durum: Kullanıcı tanımı bekliyor.** Kom1 ve Kom2 tanımlı/production'da,
Kom3 hiç tanımlanmadı. Watchlist/Alarm UI'da placeholder olarak zaten
scaffold'lı (`KOM_BADGE_STYLE[3]`, "Combo 3", kesikli/soluk rozet).

---

## Görev-6 — `gorevler2.md`'den kalan küçük iyileştirmeler (izleme listesi)

Hiçbiri acil değil, birikmiş küçük borçlar:

- 6.1 `funding:loaded` event'i tüm Coin Detail panelini gereksiz yeniden
  yüklüyor (performans borcu).
- 6.2 Fib Extension/Channel/Time Zone araçları merkezi `_fibAxis`
  mimarisini kullanmıyor.
- 6.3 Sütun menüsü "1D Open" işlevsiz (`dayOpen` veri kaynağı yok).
- 6.4 `MiniFloatingWindow` OI Değişimi popout'u hâlâ boş.
- 6.5 Görev 11.3'ün kozmetik kalanı (Status line/Scales/Canvas kontrolleri).

---

## Görev-7 — Bot sağlık/izleme mekanizması

**Durum: Hiç başlanmadı.** Botların (Kom1/Kom2) gerçek zamanlı çalışır
durumda tutulması için izleme/health-check katmanı — şu an sadece konsol
logları var (ve Kom2 için 2026-08-18'de eklenen `lastError`/`scan`
teşhis alanları, bkz. Görev-2). Kom1'in kendi `kom1-daily-signal-check`
zamanlanmış görevi bu ihtiyacın bir kısmını zaten karşılıyor.

---

## Görev-8 — Bilinçli ertelenmiş kararlar (düşük öncelik, kullanıcı onayı gerekir)

- 8.1 Kom1 parametrelerinin yapılandırılabilir hale getirilmesi (WT eşiği,
  RC uzunluğu, TOLERANCE_BARS — şu an sabit kodlu).
- 8.2 Kom1'e Bybit desteği eklenmesi (şu an sadece Binance Futures).
- 8.3 Sinyal aktiflik süresinin (Kom1: 24h "Old" eşiği) hedef/stop bazlı
  bir kurala geçirilmesi.

---

## Not — bu dosyaya dahil edilmeyenler

- Kom1 ATR14 (%12-40) bandı filtresi: 2026-08-17'de deploy edildi,
  `kom1-daily-signal-check` görevine izleme eklendi — aktif bir iş değil,
  sadece gözlem sürüyor (bkz. `dokumentasyon/gorevler/gorevler3.md`).
- Kom2'nin backtest/train-test/production kodu: tamamlandı, sadece Görev-2
  (blok sonrası) kalanı var.
