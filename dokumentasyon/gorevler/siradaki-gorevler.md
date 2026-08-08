# Sıradaki Görevler — Pintrade

**Amaç:** Kullanıcı yokken (uyurken / limit dolu) Claude Code'un
sırayla ilerlemesi için hazır iş kuyruğu.

## Kullanım (Claude Code için)

1. Bu dosyayı oku.
2. **Sırayla, yukarıdan aşağıya** ilerle. Bir görev bitmeden diğerine geçme.
3. Her görev bittiğinde:
   - Görevin başlığındaki `[ ]` işaretini `[x]` yap
   - Görevin altındaki "Rapor" bölümüne, kaydettiğin `.md` rapor dosyasının adını yaz
   - Sonraki göreve geç
4. **Kritik hata çıkarsa DUR.** Bu dosyaya "⚠️ DURDU — sebep: ..." yaz ve bekle.
5. **"⏸ DUR — kullanıcı onayı bekle" yazan görevlerden ÖNCE DUR.** Yaptığın işlerin özetini bırak, kullanıcı gelip devam de-yene kadar bekle.
6. Görevler arası bağlam penceresi çok dolarsa (özellikle Görev 3'ten sonra), kullanıcıya "yeni chat açman önerilir" notu bırak — kendi kendine yeni chat açamazsın, ama kullanıcı geldiğinde okusun.

Her rapor için standart format: değişen dosyalar listesi, ölçümler, doğrulama testleri, varsa regresyon uyarıları.

---

## [x] Görev 1 — Watchlist header + sistem listeleri iskelet

**Tamamlandı (2026-08-01), önceki oturumda.** Raporlar:
- `dokumentasyon/raporlar/2026-07-31-watchlist-header-duzeni.md`
- `dokumentasyon/raporlar/2026-07-31-watchlist-header-tamamlanma.md`
- `dokumentasyon/raporlar/2026-08-01-detail-panel-ortak-surukleme-siniri.md`
- `dokumentasyon/raporlar/2026-08-01-detail-panel-altbosluk-duzeltmesi.md`
- `dokumentasyon/raporlar/2026-08-01-screener-ingilizce-ceviri.md`
- `dokumentasyon/raporlar/2026-08-01-sutun-menusu-change-volume-type.md`
- `dokumentasyon/raporlar/2026-08-01-bot-signals-header-rail.md`
- `dokumentasyon/raporlar/2026-08-01-bot-signals-kontroller-sekme-cubugu.md`

Watchlist header'ının üstündeki bar'ın nihai düzeni ve sistem içi liste altyapısı.

**Not:** Şu an Binance'e bağlanmakta sorun var, arayüz geliştirme için **Bybit borsası listesini kullan**. Binance sonra tekrar test edilecek.

### 1.1 Header Bar Düzeni

Şu sırada 4 eleman: **[Arama kutusu] [Watchlist Seçici] [Sütun Aç/Kapa (3 nokta)] [Borsa Seçici]**

- Soldaki mevcut "✕" işaretini kaldır
- Arama kutusuna coin yazıldığında **kutunun sağında ✕ ikonu** belirsin (kutuyu temizler, listeye döner)
- Symbol sütun başlığı, altındaki coin isimleriyle aynı hizada olsun (şu an kaymış görünüyor)

### 1.2 Watchlist Seçici (menü)

Referans görseldeki gibi bir dropdown menü. İçinde:

**Kullanıcı adlandırılmış listeleri (sınırsız):**
- Kullanıcı yeni liste oluşturabilir ("Create new list")
- İsim verebilir, "Rename" ile ismi değiştirebilir, silebilir
- Bir coin manuel olarak birden fazla listeye eklenebilir

**Sistem listeleri (isim değiştirilemez, silinemez):**
- **Sinyaller** — tek bir liste ama içinde yatay ayıraçlarla **Kom1 / Kom2 / Kom3** grupları var
- Bir coin sadece BİR grupta görünür (puanlamaya göre en yüksek olan hangisiyse)
- Sinyal geldiği anda coin listeye eklenir + alarm sekmesinde uyarı çıkar ("Kom1 listesine BANKUSDT eklendi" gibi)
- Kom1/Kom2/Kom3'ün detay mantığı ileride netleşecek, şimdi sadece **boş iskelet** olarak dursun

**Pazar filtresi (menünün altında):**
- FUTURES ✅ (mevcut, sinyaller sadece burada çalışır)
- SPOT ⚠️ (menüde görünsün ama işlevsiz/griye almış olsun — ileride altını dolduracağız; sadece USDT çiftli coin listesi + grafik/fiyat/değişim gösterebilecek, sinyal katılmayacak)
- USDT ✅ (varsayılan, USDC eklenmeyecek)

### 1.3 Sütun Aç/Kapa (3 nokta menüsü)

Watchlist'teki sütunları kullanıcının açıp kapatabilmesi için 3 nokta menüsü. Referans: Visivero'nun sütun ayarı menüsüne bak. Sütun listesi:
- Symbol (kapatılamaz, hep açık)
- Price
- Chg% (değişim yüzdesi)
- FR% (funding rate yüzdesi)
- FR(h) (funding rate saati)
- Vol (USDT) (hacim)
- OI (açık pozisyon)

Kullanıcının seçimi kalıcı olsun (localStorage'a kaydedilsin).

### 1.4 Borsa Seçici

Zaten var, dokunma. Yerini sadece bar sırasına göre en sağa al.

### 1.5 Kapsam ve öncelik

**Bu turda yalnızca arayüz iskeleti kur.** Yani:
- Menüler tıklanabilir, açılabilir olsun
- Yeni liste oluştur / rename / delete gerçekten çalışsın (kullanıcı listeleri localStorage'a kaydedilsin)
- Sistem listeleri "Sinyaller" görünsün ama Kom1/Kom2/Kom3 grupları boş dursun
- SPOT butonu görünsün ama tıklanınca "Yakında" tarzı basit bir bilgi göstersin
- Sinyal üretim mantığı, alarm entegrasyonu, gerçek Kom1/2/3 doldurma **BU TURDA YAPMA** — sonraki turda ele alacağız

**Rapor:** `2026-XX-XX-watchlist-header-tamamlanma.md` (dosya adına gerçek tarihi yaz)

---

## [x] Görev 2 — 45m ve 3H zaman dilimlerini kaldır

**Tamamlandı (2026-08-01).** Rapor: `dokumentasyon/raporlar/2026-08-01-tf-temizlik-tamamlanma.md`

**Sebep:** Binance ve Bybit API'lerinde 45m ve 3H standart aralık **yok**.
- 45m: Binance reddediyor → grafik boş kalır; Bybit yanlış olarak 60m (1H) çekiyor → 45m etiketi altında 1H mumu gösteriyor
- 3H: Bybit yanlış olarak W (haftalık) çekiyor → 3H etiketi altında haftalık mum gösteriyor

Bu **sessiz hatalar** — kullanıcı yanlış veriye bakarak işlem açma riski taşır.

### Yapılacak

- `index.html`'den 45m ve 3H butonlarını kaldır
- İlgili event handler ve TF listesi entry'lerini temizle
- `AppConfig.TF_MAP`, `bybit-api.js` gibi yerlerde bu değerlere referans kalmadığından emin ol
- Kullanıcının aktif TF'i 45m veya 3H ise, güvenli bir varsayılana (1H) düşür (localStorage kontrolü)

### Doğrulama

- Butonlar navbar'dan kalktı mı?
- Kalan TF butonları çalışıyor mu (1m/5m/15m/30m/1h/4h/1D)?
- Konsol hatası yok mu?
- Yeni yüklenen sayfada varsayılan TF makul mu?

**Rapor:** `2026-XX-XX-tf-temizlik-tamamlanma.md`

---

## [x] Görev 3 — Ölü kod dosyalarını sil

**Tamamlandı (2026-08-01).** Rapor: `dokumentasyon/raporlar/2026-08-01-olu-kod-temizlik-tamamlanma.md`

Hiçbir yerden çağrılmayan / kullanılmayan dosyaları temizle. Kullanıcı deneyimini değiştirmez ama kod tabanını sadeleştirir.

### Silinecekler

- `js/drawing/tools/drawing-advanced.js` — hiç yüklenmiyor
- `js/drawing/ui/settings-modal.js` — hiç yüklenmiyor
- `chart-core.js` içindeki **kopya blok** (satır 81-115 ile 169-203 birebir aynı — birini sil, birini bırak). Ayrıca satır 26-52'deki `#nav-tf` handler'ı içinde tanımsız `setType` ve `navChartTypeBtn` referansları var — o element artık `index.html`'de yok. Ölü ama bozuk kod, temizle.
- `out.txt` — 37 KB debug dökümü, silinsin
- `tmp/` klasörü — tek seferlik onarım betikleri (`fix_renderer.js`, `fix_trend.py`, `fix_trend_v2.py`, `fix_toolbar_refs.py`, `repair_dsd.py`). Projeye dahil değil, gitmeli.

### Ek işler

- `.gitignore`'a şunları ekle: `out.txt`, `tmp/`, `.env`, `.DS_Store` (zaten yoksa)
- Silmeden önce her dosyanın gerçekten hiçbir yerden import/yüklenmediğini doğrula (`grep -r "drawing-advanced" .`, `grep -r "settings-modal" .` gibi)

### Doğrulama

- Site tarayıcıda hâlâ açılıyor mu, tüm modüller yükleniyor mu?
- Konsol hatası yok mu?
- Chart, screener, çizim araçları çalışıyor mu?

**Rapor:** `2026-XX-XX-olu-kod-temizlik-tamamlanma.md`

---

## [x] ⏸ DUR — kullanıcı onayı bekle (Görev 4'ten önce)

**Not (2026-08-01):** Kullanıcı açıkça "Görev 4'e şimdilik geçme" dedi.
Bu işaret **"Görev 4'e geç" onayı DEĞİL** — sadece bu DUR noktasının
görüldüğünü ve kullanıcının bilinçli olarak burada beklettiğini gösteriyor.
Görev 4'e başlamak için kullanıcının ayrıca ve açıkça "Görev 4'e geç"
demesi gerekiyor.

Görev 3 bittikten sonra **DURACAKSIN**. Görev 4 (bot tarayıcıyı WebSocket'e taşıma) daha büyük ve riskli bir iş — kullanıcı sabah gelip "Görev 4'e devam" onayı vermeden başlama.

Bu bloğu geçmek için kullanıcı açıkça "Görev 4'e geç" demeli. Aksi halde bekle.

Bu bloğun `[x]` işareti sadece kullanıcının onayı geldikten sonra kaldırılır.

---

## [x] Görev 4 — Bot tarayıcıyı WebSocket'e taşı

**Tamamlandı (2026-08-07).** Raporlar:
- `dokumentasyon/raporlar/2026-08-07-gorev4-websocket-aktivasyon.md` (sandbox doğrulaması)
- `dokumentasyon/raporlar/2026-08-07-gorev4-tamamlanma-datacenter-ip-bulgusu.md` (gerçek ortam doğrulaması + kök neden bulgusu)

**Sebep:** Şu an `js/screener/m1hammer-scanner.js` proxy'yi atlayıp doğrudan `fapi.binance.com`'a bağlanıyor. Her 5 dakikada ~500 coin × 5 zaman dilimi = ~2500 REST isteği, hepsi tarayıcıdan. IP ban riski gerçek — bugün 34 saniyede banladı, ban süresi 11 dk → 20 dk'ya çıktı.

Şu an geçici çözüm: `detail-panel.js:844`'te `M1HammerScanner.start()` yoruma alınmış. Bu görev bunu kalıcı çözüp geri açar.

**Sonuç (2026-08-07):** Kod WS'e taşındı, `M1HammerScanner.start()` etkinleştirildi. Kullanıcının gerçek (VPN, Finlandiya çıkışı) ortamında test edildi: **BAN_SIGNAL hiç görülmedi**, WebSocket sorunsuz bağlandı. Sunucu taraflı REST istekleri (backfill) %100 tutarlı 502 dönüyor ama bu bir ban değil — kök neden: VPN çıkış IP'si (95.217.176.55, Hetzner Online GmbH) bir **datacenter IP**, Binance REST API'si bunu engelliyor gibi görünüyor (Bybit aynı IP'den sorunsuz çalışıyor — sorun Binance'e özgü). Kodun kendisi doğru ve IP ban riski ortadan kalktı; kalan 502 tamamen ağ/ortam kısıtı, kod hatası değil. Detay: aşağıdaki rapor.

### Yapılacak

- Bot tarayıcıyı Binance WebSocket akışına taşı (`binance-api-fr.js` içindeki mevcut FR WebSocket örüntüsünü referans al)
- `calcSRSI` fonksiyonundaki O(n²) hesaplamayı düzelt (her adımda RSI'yi baştan hesaplıyor — 2500 çağrıda tarayıcıyı yorar)
- Geçici olarak yorumlanmış `M1HammerScanner.start()` satırını (`detail-panel.js:844`) geri aç
- İşlemin ilk versiyonu çalışırken **rate limit güvenli sınırların içinde** olduğunu ölç

### Doğrulama (kritik)

- Sayfa açıldıktan 5 dakika içinde IP ban var mı?
- Bot Signals sekmesi doluyor mu?
- Chart, screener, FR sinyalleri normal çalışıyor mu?
- Tarayıcı CPU kullanımı makul mü (calcSRSI düzelmesi sonrası)?

### ⚠️ Kritik uyarı

Bu görev diğerlerinden farklı — hata yaparsan IP ban etkisi kalıcı olabilir. Test için:
- Önce küçük bir alt kümede dene (5-10 coin, tüm listede değil)
- Her adımda ölç, sonra genişlet
- Şüpheye düşersen DUR ve kullanıcıya sor

**Rapor:** `2026-XX-XX-websocket-tasima-tamamlanma.md`

---

## [x] ⏸ DUR — kullanıcı onayı bekle (Görev 5'ten önce)

Görev 4 bittikten sonra **DURACAKSIN**. Görev 5 (ortak bot altyapısı) M1Hammer'ın WebSocket'e taşınmasından ayrı, bağımsız bir adım — ikisini aynı anda yapmak riskli. Kullanıcı "Görev 5'e geç" onayı vermeden başlama.

Bu bloğu geçmek için kullanıcı açıkça "Görev 5'e geç" demeli. Aksi halde bekle.

Bu bloğun `[x]` işareti sadece kullanıcının onayı geldikten sonra kaldırılır.

---

## [x] Görev 5 — Ortak bot altyapısı (dar kapsam)

**Tamamlandı (2026-08-07).** Rapor: `dokumentasyon/raporlar/2026-08-07-gorev5-ortak-bot-altyapisi.md`

**Sebep:** M1Hammer ve gelecekteki Kom1/Kom2/Kom3 sinyal motorları için ortak bir temel kurulmalı — her biri kendi ayrı polling döngüsü/veri kaynağı açmasın (FR'nin 3 ayrı kaynaktan gelme hatasına düşmeyelim, bkz. `dokumentasyon/SISTEM-GENEL-DEGERLENDIRME.md` §5.4 ve §7).

### Kapsam — kullanıcı onayıyla "dar kapsam" seçildi

Tam kapsamdan (FR/M1Hammer'ın mevcut sinyal formatını da migrate etmek, gerçek zamanlı X-MBX-USED-WEIGHT-1M takibi) farklı olarak, sadece somut risk/kod-tekrarı olan kısımlar yapıldı:

- ✅ **Ortak rate-limit bütçesi:** yeni `js/screener/bot-engine.js` — `BotEngine.queueRestRequest()`, tüm botların REST isteklerinin geçtiği tek kuyruk (150ms min. gecikme, ban sinyali gelirse TÜM botlar için duraklıyor). M1Hammer'ın backfill'i buraya taşındı.
- ✅ **MarketDataStore entegrasyonu (kline):** `js/data/market-data-store.js`'e `subscribeKlines()`/`unsubscribeKlines()` eklendi — paylaşılan, dinamik SUBSCRIBE/UNSUBSCRIBE'lı tek kline WS bağlantısı. M1Hammer kendi özel WS bağlantısını tamamen kaldırıp buna taşındı.
- ✅ **Ortak Signal zarf formatı:** `bot-engine.js` başlığında gelecek botlar (Kom1/2/3, MA/V3/4S) için dokümante edildi — FR ve M1Hammer'ın mevcut, çalışan, UI'a bağlı formatları **değiştirilmedi** (ayrı, riskli bir migrasyon, şimdilik gerekmiyor).
- ⏭ **Merkezi "tick" scheduler:** yapılmadı — mevcut botların (FR, M1Hammer) hiçbiri zaten kendi `setInterval`'ını açmıyor (ikisi de event/WS-driven), yani şu an ihlal eden bir şey yok. MA/V3/4S kodlandığında gerekirse eklenir.

### Doğrulama

Tarayıcıda test edildi: BotEngine kuyruğu çalışıyor (ban sinyali yok, `isPaused()` false), MarketDataStore'un paylaşılan kline WS'i bağlanıyor, M1Hammer ona abone oluyor, Bot Signals paneli hatasız render oluyor. Detay: yukarıdaki rapor.

---

## 🎉 Kuyruk tamamlandı — 2026-08-07

Tüm 5 görev bitti. Özet:

| Görev | Sonuç | Rapor |
|---|---|---|
| 1 — Watchlist header + sistem listeleri iskelet | ✅ | `2026-07-31-watchlist-header-*.md` + Görev 1 altındaki liste |
| 2 — 45m/3H TF temizliği | ✅ | `2026-08-01-tf-temizlik-tamamlanma.md` |
| 3 — Ölü kod temizliği | ✅ | `2026-08-01-olu-kod-temizlik-tamamlanma.md` |
| 4 — Bot tarayıcıyı WebSocket'e taşı | ✅ | `2026-08-07-gorev4-websocket-aktivasyon.md`, `2026-08-07-gorev4-tamamlanma-datacenter-ip-bulgusu.md` |
| 5 — Ortak bot altyapısı (dar kapsam) | ✅ | `2026-08-07-gorev5-ortak-bot-altyapisi.md` |

**Dikkat edilecek notlar:**
- Deploy sağlayıcısı seçilirken Binance REST erişimi test edilmeli — datacenter IP engeli riski var (yukarıdaki deploy notuna bkz.)
- `TEST_SYMBOLS` (M1Hammer, 8 sembol) genişletilmedi — ayrı kullanıcı onayı gerekiyor
- FR ve M1Hammer'ın sinyal formatı ortak Signal zarfına migrate edilmedi (Görev 5 dar kapsam kararı) — gelecekte istenirse ayrı bir iş

Sırada kuyrukta olmayan, kullanıcının ayrıca vereceği işler var (aşağıda).

**Deploy notu (2026-08-07, Görev 4 bulgusu):** Deploy sağlayıcısı seçilirken Binance REST erişiminin
test edilmesi gerekiyor — datacenter IP engeli riski var. Ücretsiz sunucu sağlayıcıları (Render, Railway
vb.) genelde datacenter IP'leri kullanıyor; kullanıcının VPN'inde (Hetzner Online GmbH çıkışı) görülen
"WebSocket sorunsuz, REST %100 502" deseni tekrar yaşanabilir (bkz. `2026-08-07-gorev4-tamamlanma-datacenter-ip-bulgusu.md`).
Deploy aşamasında ayrıca değerlendirilecek — şimdilik sadece not olarak düşülüyor.

**Kuyrukta OLMAYAN, kullanıcı ayrıca vereceği görevler:**
- Çizim araçları temizliği (kullanıcı hangi araçların silineceğini kendi listeleyecek)
- L/S verisi altyapısı (asıl büyük iş, ayrıca planlanacak)
- Kom1/Kom2/Kom3 sinyal üretim mantığı + alarm entegrasyonu + sinyal öneri kaydı
  - **Not (2026-08-07):** İlk versiyon **sadece Binance**'i taramalı. Sebep: backtest verisi Binance'e dayanıyor (Bybit'te aynı kuralların işleyip işlemediği hiç test edilmedi) ve Görev 4/5'in rate-limit bütçesini büyütmemek için. Bybit desteği ayrı bir **faz 2** olarak eklenecek.
