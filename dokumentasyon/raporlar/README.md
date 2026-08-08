# Raporlar

Yapılan her işin raporu buraya tarihli `.md` dosyası olarak kaydedilir.
En yeni en üstte.

**Dosya adı kuralı:** `YYYY-AA-GG-konu-slug.md`

| Tarih | Rapor | Özet |
|---|---|---|
| 2026-08-01 | [Fibonacci — liste kısaltma + 9 hata düzeltmesi (4 tur)](2026-08-01-fib-seviye-listesi-kisaltma.md) | 3 turluk çalışma. En kritik bulgu: `_getFibLevels()` yanlış property adı (`styleObj.levels` vs `.fibLevels`) okuduğu için menüdeki Level değişiklikleri **hiçbir zaman** grafiğe yansımıyordu — düzeltildi. Ayrıca: menü navbar üstüne taşma, taze çizimde varsayılan seviyelerin (1.618 dahil) hiç görünmemesi, ilk tıklanan noktanın 0 değil 1 olarak işaretlenmesi, fiyat basamak hassasiyeti, "Labels→Middle" hizalaması ve "log scale" seçeneğinin hiç çalışmaması — hepsi bulunup düzeltildi ve gerçek chart üzerinde doğrulandı. |
| 2026-08-01 | [**Sistem genel değerlendirmesi**](../SISTEM-GENEL-DEGERLENDIRME.md) | 2. aşamaya geçmeden önce genel durum tespiti: veri kaynakları haritası, FR verisinin 3 ayrı yoldan geldiği tespiti, IP ban riskleri (grafik 2sn REST polling en kritik), alarm sistemi envanteri, FR eşikleri (%0.01/%0.02/%0.03), coin rozetleri, performans ve öncelik sıralaması. |
| 2026-08-01 | [Çizim araçları listesi temizliği + eksik araç envanteri](2026-08-01-cizim-araclari-listesi-temizlik.md) | Kullanıcının işaretlediği 20 araç (4 Gann, 6 harmonic pattern, 2 cycle, 4 forecast, VWAP, 3 shape) menüden ve kodundan (sidebar.js, drawing-core.js, tool dosyaları, ayar diyaloğu) temizlendi. Kalan araçlardan 6 tanesinin (Elliott dalgaları, Cyclic lines, Price/Date range'ler, Volume profile'lar, Brush/Highlighter, Emoji) hiçbir şey çizmediği (boş placeholder) tespit edilip listelendi. |
| 2026-08-01 | [Popout çakışması + renk/font düzeltmeleri](2026-08-01-popout-cakisma-renk-duzeltme.md) | L/S bar'ının popout ikonuyla çakışması (flex-shrink hesaplama hatası) düzeltildi; popout ikonları, alt bant kontrolleri, saat ve sidebar 3 butonu navbar ile aynı beyazlığa (`--text-primary`) çekildi; alt bant yazıları büyütüldü. |
| 2026-08-01 | [Liste ikonu (link) + L/S ve OI popout](2026-08-01-liste-ikonu-ls-oi-popout.md) | Alt bantın gear ikonu link/zincir ikonuyla değiştirildi; L/S kartının barı küçültülüp üst sağ köşeye, OI Değişimi kartının başlığına popout ikonu eklendi — ikisi de tıklayınca boş bir floating window açıyor (içerik sonraya bırakıldı). |
| 2026-08-01 | [Bant düzeltmeleri — saat hizası, sidebar çerçeveleri, liste ikonu](2026-08-01-bant-duzeltmeleri-liste-ikonu.md) | Saatin dikey görünmesine sebep olan eski `writing-mode:vertical-rl` kuralı override edildi; sidebar grup kutuları küçültülüp dış kenarla çakışması giderildi; grafik altı bandın soluna tıklanabilir ikon+dropdown (No Preview/Top Gainers/Delistings/New Listings) eklendi. |
| 2026-08-01 | [Grafik altı yatay bant + saat taşıma](2026-08-01-grafik-alti-yatay-bant-saat.md) | Chart alanının tam genişliğinde, zaman çizelgesiyle aynı yükseklikte (22px) yeni bir bant eklendi; saat sağ sidebar'dan bu bandın sağına taşındı, solda görsel liste yer tutucusu ("No Preview ▾") var. |
| 2026-08-01 | [Navbar butonları sidebar'a taşındı](2026-08-01-navbar-butonlari-sidebara-tasindi.md) | Snapshot/Theme/Settings navbar'dan sağ sidebar'ın altına (saatin altına) taşındı. 3 aşamalı alt-bant planının 1. adımı; saat henüz geçici konumda, kalıcı yeri (grafik altı yeni yatay bant) 2. adımda gelecek. |
| 2026-08-01 | [Floating panel FR tablo düzeni](2026-08-01-floating-panel-fr-tablo-duzeni.md) | FR sinyal tablosunda sütun hizasızlığı ve "Saat" sütununun taşıp kırpılması düzeltildi; panel 420→460px genişletildi, `overflow-x:hidden`→`auto` yapıldı, sütunlara taban genişlik (minmax) verildi. |
| 2026-08-01 | [News sekmesi birleştirme](2026-08-01-news-sekmesi-birlestirme.md) | Sidebar'daki ayrı "News" paneli kaldırıldı; News sekmesine snipe (coin/genel haber) + sıralama eklendi. Yol boyunca `symbol:changed`/`symbol:change` uyuşmazlığı ve bir sınıf çakışması hatası bulunup düzeltildi. |
| 2026-08-01 | [Bot Signals — boşluk + floating panel](2026-08-01-bot-signals-bosluk-floating-panel.md) | SE/arama/snipe/sırala arasına 6px boşluk eklendi; floating panel'e de aynı kontroller eklendi, docked ile senkron çalışıyor. |
| 2026-08-01 | [Ölü kod temizlik tamamlanma](2026-08-01-olu-kod-temizlik-tamamlanma.md) | Hiç yüklenmeyen 2 dosya, `out.txt`, `tmp/` silindi; `chart-core.js`'teki kopya blok ve bozuk `#nav-tf` handler'ı kaldırıldı. |
| 2026-08-01 | [TF temizlik tamamlanma](2026-08-01-tf-temizlik-tamamlanma.md) | 45m/3H zaman dilimleri kaldırıldı (Bybit'te sessizce yanlış mum çekiyorlardı). Eski localStorage/pane state'lerinde kalmış değerler güvenli varsayılana (1H) düşürülüyor. |
| 2026-08-01 | [Bot Signals — kontroller sekme çubuğunda](2026-08-01-bot-signals-kontroller-sekme-cubugu.md) | Arama/snipe/sıralama Coin Detail-Bot Signals-News sekme satırına, popout'un soluna taşındı. SE rozeti sadece FR'de görünüyor, BB rozeti tamamen kaldırıldı. |
| 2026-08-01 | [Bot Signals — dikey raf + arama/snipe](2026-08-01-bot-signals-header-rail.md) | Yatay bot sekmeleri sol dikey rafa taşındı; "Tüm Coinler/Seçili Coin" butonları arama+snipe ikonlarına ve SE rozetine dönüştürüldü. Arama sahte veriyle test edilip kanıtlandı. |
| 2026-08-01 | [Sütun menüsü — Change/Volume Type](2026-08-01-sutun-menusu-change-volume-type.md) | ⋮ menüsüne Change Type (BETA, arayüz only) ve Volume Type (USD/Standard, tam işlevsel — coin cinsinden hacim) eklendi. |
| 2026-08-01 | [Screener İngilizce çevirisi](2026-08-01-screener-ingilizce-ceviri.md) | Screener'daki tüm görünür Türkçe metinler (arama, liste menüsü, sütun menüsü, boş liste mesajları) İngilizceye çevrildi. |
| 2026-08-01 | [Coin Detail alt boşluğu düzeltmesi](2026-08-01-detail-panel-altbosluk-duzeltmesi.md) | Panel yüksekliği artık veri geldiğinde ve fontlar yüklendiğinde yeniden ölçülüyor — önceden ilk (placeholder/fallback-font) ölçüme takılı kalıp altında boşluk bırakıyordu. |
| 2026-08-01 | [Detay panel ortak sürükleme sınırı](2026-08-01-detail-panel-ortak-surukleme-siniri.md) | Sürüklenen yükseklik artık sekmeler arasında ortak (tek değer); aşağı sürükleme Coin Detail içeriğinin tam sığdığı noktada (+4px pay) sınırlandı, içerik asla kırpılmıyor. |
| 2026-07-31 | [Detay panel sürükleme](2026-07-31-detail-panel-surukleme.md) | `#detail-resize` tutamacı gerçek fare sürüklemesiyle çalışır hale getirildi; Coin Detail ve Bot Signals için ayrı ayrı hatırlanıyor (localStorage), çift tıklama otomatiğe döndürüyor. |
| 2026-07-31 | [Detay panel esnek yükseklik](2026-07-31-detail-panel-flexible-yukseklik.md) | Coin Detay paneli içeriğe göre sığıyor, Bot Signals'ta screener tam 20 satırda sabitleniyor; iki flex-basis hatası (huge content-basis) bulunup düzeltildi. Watchlist menüsünde USDT kaldırıldı, FUTURES tıklanamaz yapıldı. |
| 2026-07-31 | [Watchlist header tamamlanma](2026-07-31-watchlist-header-tamamlanma.md) | Header bar nihai düzeni (arama/liste/sütun/borsa), liste oluştur-adlandır-sil altyapısı, sütun aç-kapa menüsü, Sinyaller iskeleti. Sinyal üretimi sonraki turda. |
| 2026-07-31 | [Watchlist header düzeni](2026-07-31-watchlist-header-duzeni.md) | "Screener" başlığı kaldırılıp yerine arama kutusu kondu; navbar coin bilgi kutusu watchlist ile birebir hizalandı. Watchlist liste seçici kapsam kararı bekliyor. |
| 2026-07-31 | [Lokal ortam kurulumu](2026-07-31-lokal-ortam-kurulumu.md) | Express sürüm çelişkisi düzeltildi, `.env.example` eklendi, lokal mod mesajı netleştirildi, bot tarayıcı geçici kapatıldı; temiz makine kurulumu doğrulandı. |
| 2026-07-31 | [Kod incelemesi](2026-07-31-kod-incelemesi.md) | Kod tabanının tam incelemesi — 15 hata/eksik tespit edildi (bozuk zaman dilimleri, ölü butonlar, Binance OI toplayıcı hatası, IP ban riski, güvenlik notları). |

---

## İlgili dokümanlar

- [`../pintrade-yapisi.md`](../pintrade-yapisi.md) — dosya/klasör hiyerarşisi, mimari özeti
- [`../PROJE-DOKUMANTASYONU.md`](../PROJE-DOKUMANTASYONU.md) — genel amaç, piyasa okuma çerçevesi, veri kaynakları
- [`../BACKTEST-SISTEMI.md`](../BACKTEST-SISTEMI.md) — backtest/indikatör alt projesi planı
