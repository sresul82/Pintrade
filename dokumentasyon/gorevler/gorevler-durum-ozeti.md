# Görev Kuyrukları — Birleşik Durum Özeti

**Son güncelleme:** 2026-08-14. Üç ayrı kuyruk dosyası var (`siradaki-gorevler.md`,
`gorevler2.md`, `gorevler3.md`) — bu dosya onları **değiştirmiyor**, sadece
"neredeyiz, ne bitti, ne bekliyor" sorusuna tek bakışta cevap vermek için bir
özet/dizin. Görev detayları/raporları hâlâ kendi orijinal dosyalarında.

---

## 1. `siradaki-gorevler.md` — İlk kuyruk (2026-08-01 → 2026-08-07)

**Durum: 5/5 tamamlandı. Kuyruk kapandı.**

| # | Görev | Durum |
|---|---|---|
| 1 | Watchlist header + sistem listeleri iskelet | ✅ |
| 2 | 45m/3H TF temizliği | ✅ |
| 3 | Ölü kod dosyalarını sil | ✅ |
| 4 | Bot tarayıcıyı WebSocket'e taşı | ✅ |
| 5 | Ortak bot altyapısı (dar kapsam) | ✅ |

**Bu kuyruktan doğan, henüz ayrıca ele alınmamış notlar:**
- Çizim araçları temizliği — kullanıcı kendi yürütüyor, bu kuyruklarda değil.
- Deploy'da datacenter IP riski notu — deploy tarafında zaten `pintrade-uwg9.onrender.com`'a geçilerek aşıldı (sonraki oturumlarda doğrulandı).

---

## 2. `gorevler2.md` — İkinci kuyruk (2026-08-08)

**Durum: Görev 1-4, 6, 7, 8, 9, 10, 11, 12 tamamlandı. Görev 5 ertelendi.**

| # | Görev | Durum |
|---|---|---|
| 1 | Toplayıcı açılış zamanlamasını yay (ban riski) | ✅ |
| 2 | L/S verisini görsel arayüze bağlama | ✅ |
| 3 | Bybit L/S (faz 2) | ✅ |
| 4 | fr-tracker.js yanlış backend düzeltmesi | ✅ |
| 5 | Alarm kartı → chart zaman yolculuğu | ✅ (2026-08-15) — production'da doğrulandı |
| 6 | Alarm'a "önerilen giriş fiyatı" + geri ölçüm kaydı | ✅ (2026-08-14) — Alarm sekmesi artık `/api/kom1/signals`'tan (kalıcı, tüm evren) besleniyor, kartlarda "Giriş Fiyatı" chip'i + canlı %fark var |
| 7 | Watchlist SPOT gerçek işlevi (sadece liste) | ✅ |
| 8 | Delist/yeni liste/en yükselen uyarısı | ✅ |
| 9 | Güvenlik açıkları (`express.static` kapsamı, syncKey rate-limit) | ✅ (2026-08-10), production'da doğrulandı |
| 10 | Doğrulanmış ölü kod / OI hesap hatası | ✅ |
| 11 | Chart Settings denetimi (High/Low bug, ölü `settings:apply` dinleyicisi) | ✅ (2026-08-10) — 11.1/11.2/11.4/11.5/11.5.1/11.6 tamamlandı, 11.3'ün kozmetik kalanı izleme listesinde |
| 12 | `Candle` koleksiyonuna TTL / MongoDB depolama riski | ✅ (2026-08-14) — TTL yerine toplayıcı (`collectBinanceCandles`) tamamen durduruldu, hiç kullanılmayan veriydi |

**Bu kuyruktan kalan, henüz görev olarak açılmamış notlar ("izleme listesi"):**
- `funding:loaded` event'i tüm Coin Detail panelini gereksiz yeniden yüklüyor (performans borcu)
- Fib Extension/Channel/Time Zone araçları merkezi `_fibAxis` mimarisini kullanmıyor
- Sütun menüsü "1D Open" işlevsiz (`dayOpen` veri kaynağı yok)
- `MiniFloatingWindow` OI Değişimi popout'u hâlâ boş
- Görev 11.3'ün kozmetik kalanı (Status line/Scales/Canvas kontrolleri)
- Grafik üzerinde RSI/WT/RC görselleştirmesi yok (EMA/DEMA/Heikin Ashi artık chart'a bağlı, bkz. aşağıda — v5 migrasyonu bekliyor)

---

## 3. `gorevler3.md` — Üçüncü kuyruk, Kom1 sinyal motoru (2026-08-09 → devam ediyor)

**Durum: Görev 1-6 tamamlandı/canlı gözlemde. Görev 7 kısmen yapıldı. Görev 8 tamamlandı.**

| # | Görev | Durum |
|---|---|---|
| 1 | Paylaşılan indikatör motoru (DEMA9, HA, RC) | ✅ |
| 2 | Büyük TF sinyali (1H/4H: RC + WaveTrend) | ✅ |
| 3 | 5 dakikalık onay penceresi (HA + DEMA9) | ✅ |
| 4 | Watchlist Kom1 grubuna yazma + alarm bildirimi | ✅ (2026-08-10) |
| 5 | Canlı gözlem + ince ayar | ✅ (2026-08-12) — 9/10 sinyalle kullanıcı onayıyla kapatıldı |
| 6 | Tüm piyasaya genişletme (hacme göre 3 katman rotasyon) | ⏳ İmplementasyon tamamlandı (2026-08-12), gözlem sürüyor — tier3'ün (3sa) rotasyona girdiği henüz doğrulanmadı |
| 7 | Sunucu taraflı izleme + Telegram bildirimi | ⏳ Kısmen tamamlandı: keep-alive (2026-08-14) + Kom1 tespit birleştirmesi (2026-08-14) + **Kom1 → Telegram bildirimi (2026-08-15, production'da doğrulandı)**. **Kalan:** `AlertStore`'un (fiyat alarmları) MongoDB'ye taşınması + kendi izleme döngüsü |
| 8 | Git düzensizliğini temizle (main/master ayrışması) | ✅ (2026-08-14) — `master` silindi, tek dal (`main`) kaldı, kayıp iş yoktu |

**Bilinen kritik bulgu (2026-08-14):** Render'ın ücretsiz katmanı inaktiflikte
uyuyup Kom1'in sunucu taraması durunca, geriye dönük taramada ~44 saatte
~112 sinyalin muhtemelen kaçırıldığı bulundu — bu, Görev 7'nin keep-alive
parçasının doğrudan gerekçesi oldu. Detay: `2026-08-14-kom1-uyku-kaybi-ve-sinyal-analizi.md`.

**Bu kuyrukta bilinçli olarak ERTELENEN/YAPILMAYAN kararlar** (detaylı tablo `gorevler3.md`'nin başında):
- Kom2 — bilinen zayıf/doğrulanmamış kural, bu kuyrukta yok
- Kom3 — hiç tanımlanmadı
- Kom1 parametreleri (WT eşiği, RC uzunluğu, TOLERANCE_BARS) sabit kodlu, yapılandırılabilir değil
- ATR14 volatilite ön-filtresi uygulanmadı (sadece hacme göre rotasyon var)
- Sadece Binance FUTURES, Bybit yok
- Sinyal aktiflik süresi geçici olarak 24h ("Old" eşiğiyle aynı) — TODO: ileride hedef/stop bazlı kurala geçilecek

**İleri seviye — Kom1 gözlem sonrası:**
- Chart üzerinde RSI/WT/RC görselleştirmesi — `lightweight-charts v5` migrasyonu
  **tamamlandı (2026-08-15)**, ön koşul artık hazır. Detaylı fazlı plan yazıldı
  (RSI/WaveTrend alt-panel, Regression Channel overlay, TV-tarzı menü) — geçmişte
  v4'te 3 kez denenip başarısız olmuştu, yeni plan o üç yöntemi tekrarlamıyor,
  v5'in native pane API'sini kullanıyor. **Henüz kodlanmadı**, sonraki oturumda
  tam zamanla fazlı olarak ele alınacak.
- Botların gerçek zamanlı çalışır durumda tutulması — izleme/health-check mekanizması (şu an sadece konsol logları var)
- Alert → Telegram bildirim entegrasyonu — **Kom1 kısmı tamamlandı (2026-08-15,
  production'da doğrulandı)**, fiyat alarmları (AlertStore) hâlâ bekliyor

---

## Şu an nerede duruyoruz — özet (2026-08-15 güncellemesi)

**Bugün tamamlanan ve production'da doğrulanan işler:**
- `lightweight-charts` v4.1.3 → v5.2.1 migration (tüm chart tipleri, indikatörler, çizim araçları, OI/Volume popup regresyonsuz)
- `gorevler2.md` Görev 5 — alarm kartı → chart zaman yolculuğu
- `gorevler3.md` Görev 7'nin Telegram parçası — Kom1 sinyalleri artık Telegram'a düşüyor (fiyat alarmları hariç)
- Çeşitli UI tutarlılık düzeltmeleri (L/S, OI/Volume, Alarm sekmesi buton/renk standardı, mooo.com backend-URL hatası)

**Kalanlar:**
1. **Büyük, planı hazır iş:** Chart'ta RSI/WaveTrend (alt-panel)/Regression Channel
   (overlay) indikatörleri — fazlı plan yazıldı (`~/.claude/plans/robust-strolling-turtle.md`
   Part C), v4'te 3 kez başarısız olduğu için sonraki oturumda tam zamanla,
   dikkatli/fazlı ele alınacak.
2. **Açık, aktif iş bekleyen:** `gorevler3.md` Görev 7'nin kalanı — `AlertStore`'un
   (fiyat alarmları) DB'ye taşınması + kendi sunucu izleme döngüsü.
3. **Kullanıcı tanımı bekleyen:** Kom2/Kom3 stratejileri (hiç tanımlanmadı).
4. **Sadece gözlem gerektiren (aktif iş yok):** `gorevler3.md` Görev 6 —
   tier3 rotasyonunun (3 saatte bir) fiilen çalıştığını doğrulamak için
   birkaç saatlik pasif gözlem yeterli.
