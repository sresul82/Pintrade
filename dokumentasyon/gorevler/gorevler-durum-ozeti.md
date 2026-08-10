# Görev Kuyrukları — Birleşik Durum Özeti

**Tarih:** 2026-08-10. Üç ayrı kuyruk dosyası var (`siradaki-gorevler.md`,
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

**Durum: Görev 1-4, 7, 8, 9, 10 tamamlandı. Görev 5, 6 ertelendi. Görev 11 sadece belgelendi (henüz başlanmadı).**

| # | Görev | Durum |
|---|---|---|
| 1 | Toplayıcı açılış zamanlamasını yay (ban riski) | ✅ |
| 2 | L/S verisini görsel arayüze bağlama | ✅ |
| 3 | Bybit L/S (faz 2) | ✅ |
| 4 | fr-tracker.js yanlış backend düzeltmesi | ✅ |
| 5 | Alarm kartı → chart zaman yolculuğu | ⏸ **Ertelendi** (kullanıcı: "zor iş olabilir, şimdilik atlayalım") |
| 6 | Alarm'a "önerilen giriş fiyatı" + geri ölçüm kaydı | ⏸ **Yapılmadı, bekliyor** — Kom1 artık canlı sinyal ürettiği için (bkz. gorevler3.md Görev 4) bu görevin önkoşulu artık var, istenirse başlanabilir |
| 7 | Watchlist SPOT gerçek işlevi (sadece liste) | ✅ |
| 8 | Delist/yeni liste/en yükselen uyarısı | ✅ |
| 9 | Güvenlik açıkları (`express.static` kapsamı, syncKey rate-limit) | ✅ (2026-08-10), production'da doğrulandı |
| 10 | Doğrulanmış ölü kod / OI hesap hatası | ✅ |
| 11 | Chart Settings denetimi (High/Low bug, ölü `settings:apply` dinleyicisi, modalın ~%60-65'i kozmetik) | 📋 **Sadece belgelendi** (2026-08-10) — henüz kod değişikliği yok, kapsam netleşince "Görev 11'e geç" onayı gerekir |

**Bu kuyruktan kalan, henüz görev olarak açılmamış notlar ("izleme listesi"):**
- `funding:loaded` event'i tüm Coin Detail panelini gereksiz yeniden yüklüyor (performans borcu)
- Fib Extension/Channel/Time Zone araçları merkezi `_fibAxis` mimarisini kullanmıyor
- ~~`drawing:settings:saved` debounce yok~~ — **✅ Düzeltildi (2026-08-10)**, production'da doğrulandı: redraw anlık, kayıt 300ms debounce'lu.
- Sütun menüsü "1D Open" işlevsiz (`dayOpen` veri kaynağı yok)
- `MiniFloatingWindow` OI Değişimi popout'u hâlâ boş
- Grafik altı "No Preview" filtre işlevi kısmen dolduruldu (Görev 8), tam kapsam kontrol edilmedi
- Grafik üzerinde indikatör motoru görselleştirmesi yok (RSI/DEMA9/WT/RC — **Heikin Ashi hariç, o artık chart'a bağlı**, bkz. aşağıda)
- ~~Grafik ayarları saat dilimi değişikliğinin uygulanıp uygulanmadığından şüpheleniliyor~~ — **kesinleşti, Görev 11.2'ye taşındı** (iki çakışan `settings:apply` dinleyicisi, ikincisi ölü kod)
- İlk REST yüklemesi başarısız olursa screener toparlanmıyor (doğrulanmadı)
- ~~Heikin Ashi ve 6 diğer mum stili menüde duruyor ama hesaplanmıyor~~ — **Heikin Ashi ✅ Düzeltildi (2026-08-10)**, production'da doğrulandı (`IndicatorEngine.calcHeikinAshi` artık `chart-pane.js`'e bağlı, canlı veride kayan hesap doğru çalışıyor). Kalan 6 stil (hollow, volume, line_markers, hlc_area, baseline, volume_footprint, session_volume) hâlâ "henüz desteklenmiyor".

---

## 3. `gorevler3.md` — Üçüncü kuyruk, Kom1 sinyal motoru (2026-08-09 → devam ediyor)

**Durum: Görev 1-4 tamamlandı ve CANLI. Görev 5'ten önce DUR kapısındayız.**

| # | Görev | Durum |
|---|---|---|
| 1 | Paylaşılan indikatör motoru (DEMA9, HA, RC) | ✅ |
| 2 | Büyük TF sinyali (1H/4H: RC + WaveTrend) | ✅ |
| 3 | 5 dakikalık onay penceresi (HA + DEMA9) | ✅ |
| 4 | Watchlist Kom1 grubuna yazma + alarm bildirimi | ✅ (2026-08-10), production'a push edildi ve doğrulandı |
| — | ⏸ DUR (Görev 5'ten önce) | ✅ Geçildi (2026-08-10, kullanıcı onayı) |
| 5 | Canlı gözlem + ince ayar | Kapsamı netleşti (ilk 10 sinyal, manuel değerlendirme + ban/hata sıklığı, parametreler sabit) — **fiili gözlem, Binance IP banı geçene kadar (~2026-08-11 07:13 UTC) başlayamıyor**, bkz. aşağıdaki kritik bulgu |
| — | ⏸ DUR (Görev 6'dan önce) | Geçilmedi |
| 6 | Tüm piyasaya genişletme (dinamik ATR taraması) | En riskli adım, henüz başlanmadı |

**Push edildi ve doğrulandı (2026-08-10).** İki ayrı push yapıldı:
1. Görev 4'ün kendi kodu (Kom1Scanner canlıya alma, Watchlist/alarm entegrasyonu).
2. Doğrulama sırasında bulunan, Görev 4'ten bağımsız kritik bir `server.js`
   bug'ının düzeltmesi: Binance proxy'si upstream ban status kodunu (418/429)
   hiç forward etmiyordu, `kl.map is not a function` çökmesine yol açıyordu.
   Düzeltildi, production'da doğrulandı (artık ban durumunda çökme yok, temiz
   `stop()`). Detay: `2026-08-10-binance-proxy-status-forward-fix.md`.

**Şu an aktif durum:** Binance'in kendi IP banı (~2026-08-11 07:13 UTC'ye kadar,
koddan bağımsız) yüzünden Kom1Scanner henüz gerçek backfill yapamıyor — gerçek
sinyal üretimi ban geçtikten sonra başlayacak.

**Bu kuyrukta bilinçli olarak ERTELENEN/YAPILMAYAN kararlar** (detaylı tablo `gorevler3.md`'nin başında):
- Kom2 — bilinen zayıf/doğrulanmamış kural, bu kuyrukta yok
- Kom3 — hiç tanımlanmadı
- Kom1 parametreleri (WT eşiği, RC uzunluğu, TOLERANCE_BARS) sabit kodlu, yapılandırılabilir değil
- Coin evreni sabit 11 coin, dinamik ATR taraması yok (Görev 6'ya ertelendi)
- Sadece Binance FUTURES, Bybit yok
- Sinyal aktiflik süresi geçici olarak 24h ("Old" eşiğiyle aynı) — TODO: ileride hedef/stop bazlı kurala geçilecek

**İleri seviye — Kom1 gözlem sonrası (2026-08-10 eklendi, Görev 5 sonucuna bağlı önkoşul):**
- Chart üzerinde indikatör görselleştirmesi (RSI/DEMA9/HA/WT/RC) — `indicator-engine.js` hazır ama chart'a çizilmiyor
- Botların gerçek zamanlı çalışır durumda tutulması — izleme/health-check mekanizması
- Navbar Alert butonunun işlevsel hale getirilmesi
- Alert → Telegram bildirim entegrasyonu

---

## Şu an nerede duruyoruz — özet

1. **gorevler3.md Görev 4 tamamlandı, kod hazır, test edildi, push edilmedi.**
2. Görev 5'ten önceki DUR kapısındayız — kapsamı henüz netleşmedi.
3. Açıkta kalan, kuyruğa hiç girmemiş ama bilinen büyük konular:
   - **gorevler2.md Görev 9** (güvenlik) — ertelendi, hâlâ açık
   - **gorevler2.md Görev 6** (önerilen giriş fiyatı + geri ölçüm) — artık Kom1 canlı olduğu için önkoşulu var, istenirse şimdi ele alınabilir
   - **gorevler2.md Görev 5** (alarm → chart zaman yolculuğu) — ertelendi
   - Grafik üzerinde indikatör görselleştirmesi yok (izleme listesi maddesi)
