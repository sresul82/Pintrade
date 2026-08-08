# Backtest & İnteraktif Chart Sistemi — Ek Dokümantasyon

Bu dosya, PROJE-DOKUMANTASYONU.md'yi tamamlayan, spesifik olarak
**geçmiş veriye dayalı, nesnel giriş/çıkış noktası tespiti** (backtest)
ve bunu gösteren **interaktif chart** alt projesini kapsar.

## 1. Neden bu proje?

Şu ana kadarki vaka analizleri (BANK, AKE), Telegram kanalının o anki
**öznel yorumuna** dayanıyordu. Ama kombinasyon doğru oluşsa bile,
işlemi açan kişi geç kalmış, yanlış yorumlamış veya paniklemiş olabilir
— yani "kanalın işlemi kazandı" ile "sinyal gerçekten sağlamdı" farklı
şeyler. Bu proje, **insan faktörünü devre dışı bırakıp**, sadece
veri kombinasyonunun kendisini geçmişe dönük olarak nesnel şekilde
test etmeyi hedefliyor.

## 2. Ana strateji tetikleyicisi

**Kurulum:** Bir coin uzun süre düşük/yatay bir bölgede "gezinir"
(birikim bölgesi), sonra ani bir "baş kaldırma" (breakout) hareketi
yapar. **Giriş:** Bu baş kaldırma anında, **5 dakikalık** zaman
diliminde Long açılır. Bu, ansiklopedideki "Birikim → Markup" geçişinin
(bkz. piyasa-okuma-rehberi.html, Trend Bölgeleri) çok kısa zaman
dilimindeki bir uygulaması.

## 3. Kullanılacak indikatörler (standart tanımlar)

Aşağıdakiler bilinen, standart formüllerdir — geçmiş fiyat (OHLC)
verisinden hesaplanır, ayrıca canlı/harici veri gerektirmez:

- **DEMA9 + Heikin Ashi** — Heikin Ashi mumları normal OHLC'den
  türetilir (düzleştirilmiş mum gövdeleri), üzerine 9 periyotluk
  Double EMA çizilir. Trend yönü ve gücünü daha az gürültüyle gösterir.
- **Regression Channel** — belirli bir pencerede lineer regresyon
  çizgisi + üstünde/altında standart sapma bantları. Fiyatın "normal"
  aralığın neresinde olduğunu gösterir.
- **WaveTrend (WT) cross** — popüler bir osilatör, iki çizginin
  kesişimi (yukarı/aşağı) momentum dönüşü sinyali sayılır.
- **Divergence (uyumsuzluk)** — fiyat ile osilatör (RSI/WT) arasında
  zirve/dip uyumsuzluğu. BANK vaka analizinde manuel tespit ettiğimiz
  RSI ayrışmasının otomatikleştirilmiş hali.
- **RSI'nin kendi ortalamasını yukarı kesmesi** — momentumun
  hızlanmaya başladığının bir işareti.

**Not:** Bu indikatörlerin TAM OLARAK hangi kombinasyonda "giriş
sinyali" sayıldığı henüz netleşmedi — ilk versiyon standart/mantıklı
varsayımlarla kurulacak, kullanıcı geri bildirimiyle kesinleştirilecek.

## 4. Veri derinliği gereksinimi

İki farklı zaman ölçeği, iki farklı amaç için gerekli:

| Zaman dilimi | Amaç | Önerilen derinlik |
|---|---|---|
| 1D / 4H | "Uzun süre düşükte gezinme" bağlamını (birikim bölgesi) tespit etmek | En az 6-12 ay |
| 5m | Kesin giriş tetikleyicisini test etmek | En az 3-6 ay, ideali birden fazla coin |

**Kritik ölçek sorunu:** 5 dakikalık veri, günlük veriden ~288 kat
daha kalabalık. 6 aylık 5m veri, coin başına ~180 günlük dosya demek.
Bu ölçekte **manuel dosya indirip yükleme yöntemi pratik değil** —
bu noktadan itibaren **otomatik veri çekme** (kullanıcının kendi
sunucusu/platformu üzerinden, API-key gerektirmeyen
data.binance.vision endpoint'lerinden — bkz.
PROJE-DOKUMANTASYONU.md §4) gerekiyor.

## 5. Look-ahead bias uyarısı (kritik)

Backtest kurarken en hassas nokta: bir mumun "tepe" ya da "dip"
olduğu ancak birkaç bar SONRA kesinleşir. İndikatörler ve sinyal
mantığı, hesaplama anında henüz mevcut olmayan/gelecekteki veriyi
kullanmayacak şekilde (sadece o ana kadarki barlarla) kodlanmalı.
Aksi halde backtest sonuçları gerçekte olduğundan çok daha başarılı
görünür ama gerçek zamanlı kullanımda tutmaz.

## 6. Mimari (5 katman)

1. **Veri katmanı** — klines + metrics + funding rate (bkz. ana
   dokümantasyon §4), artık 5m/1m çözünürlükte ve otomatik çekilen.
2. **İndikatör katmanı** — §3'teki indikatörlerin OHLC'den hesaplanması.
3. **Sinyal/kombinasyon katmanı** — checklist kurallarının
   ("Long giriş checklist'i" + yeni indikatörler) kodlu koşullara
   çevrilmesi.
4. **Backtest/işaretleme katmanı** — geçmişteki her noktada kural
   kontrol edilir, sinyal oluşan yerler işaretlenir, sonrasında
   fiyatın gerçekte ne yaptığı (kaç gün sonra %kaç değişti) ölçülür.
5. **Çıktı katmanı** — interaktif chart (bkz. §7) + istatistik özeti
   (kaç kez oluştu, kazanma oranı, ortalama getiri).

## 7. İnteraktif chart gereksinimleri

- **Zoom YOK** — zaman dilimi seçici (5m / 1H / 4H / 1D butonları)
  ile değiştirilir.
- **Yatay kaydırma (pan)** — sağa/sola scroll ile geçmişe gidilebilir.
- **İndikatör panelleri açılır/kapanır** (toggle/checkbox listesi).
- Önerilen teknik temel: `lightweight-charts` (TradingView'ın açık
  kaynak, ücretsiz JS kütüphanesi) — çoklu pane, zaman dilimi
  değişimi ve pan özelliklerini doğal olarak destekliyor. Bu, bir
  Claude Code görevi olarak uygulanmalı (canlı/etkileşimli bir
  platform bileşeni, statik HTML değil).

## 8. Sıradaki adımlar (öneri)

1. Standart indikatör tanımlarıyla küçük bir prototip (örn. sadece
   RSI + Heikin Ashi/DEMA9, tek coin — BANK üzerinde, elimizde zaten
   veri var) kurup mantığı doğrulamak.
2. Kullanıcıdan gerçek kombinasyon kurallarını (hangi indikatör
   hangi diğeriyle birlikte ne anlama geliyor) almak, prototipi
   düzeltmek.
3. Veri çekmeyi otomatikleştirmek (manuel yükleme yönteminden
   çıkmak).
4. İnteraktif chart arayüzünü Claude Code ile inşa etmek.
5. Ölçeği 10 coin'e ve tam 3-6 aylık pencereye çıkarmak.
