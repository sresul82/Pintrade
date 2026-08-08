# Bot Signals — Dikey Bot Rafı + Arama/Snipe İkonları — 2026-08-01

## İstek

Referans görsellere (Bot penceresi.jpg) göre:
1. Bot Signals sekmesindeki "Tüm Coinler / Seçili Coin" butonları kaldırılsın,
   yerine arama ikonu + "snipe" (sniper) ikonu + "SE" rozeti gelsin. Snipe
   açıkken screener'da seçili coinin bot detayları, kapalıyken tüm coinler
   gösterilsin.
2. Yatay bot sekmeleri (FR/M1 Hammer/M1-A/V3/4S) sol tarafa dikey ikon rafı
   olarak taşınsın.

## Kullanıcıyla netleşen kapsam

- **"SE" ne işe yarıyor:** Bir filtre/mod anahtarı olarak onaylandı, tam
  davranışı netleşmedi. **Benim yorumum** (açıkça işaretleniyor, yanlışsa
  kolay değiştirilir): SE rozeti, o an hangi bot'un sinyalleri gösteriliyorsa
  onun kısa kodunu gösteren salt bilgilendirici bir etiket (FR/M1/MA/V3/4S).
  Tıklanabilir değil — dikey raftaki aktif ikonla zaten aynı bilgiyi
  tekrarlıyor, header'da kompakt bir onay olarak duruyor.
- **Rozet sayıları (133, 157 vb.):** Kullanıcı "hayır, sadece ikon" dedi —
  eklenmedi.
- **Arama tüm botlara ortak olmalı** (kullanıcı geri bildirimi, uygulama
  sırasında geldi): Arama kutusu `.bsp-header-row`'da — yani hangi bot
  sekmesi aktifse aktif olsun, her zaman aynı yerde. `_searchQuery` tek bir
  paylaşılan durum, sekme değiştirince sıfırlanmıyor.

## Yapılan değişiklikler

### Mimari değişikliği
```
Önce: .bsp-container > .bsp-header-row (yatay tab'lar + filtreler) + içerik
Sonra: .bsp-container > .bsp-body > [.bsp-bot-rail (dikey), .bsp-main (header-row + içerik)]
```

### `.bsp-header-row`'un yeni içeriği
`[SE rozeti] [🔍 arama] [🎯 snipe] [↑/↓ sırala] [BN/BB rozeti — FR dışı botlarda]`

- **Arama** (🔍): tıklanınca yanında bir input açılır/kapanır, sembole göre
  anlık filtreler (case-insensitive substring). Hem FR hem M1 Hammer sinyal
  listelerine uygulanıyor — aynı `_searchQuery` değişkeni, ayrı ayrı değil.
- **Snipe** (🎯): eski "Seçili Coin / Tüm Coinler" iki-buton yapısının
  yerine tek toggle. Doğrudan var olan `_coinFilter` durumunu kullanıyor
  (`'selected'`/`'all'`) — filtreleme mantığının kendisi hiç değişmedi,
  sadece arayüz temsili değişti. Aktifken kırmızı vurgulu.
- **SE rozeti**: aktif bot'un kısa kodu (yukarıdaki yoruma bakın).

### `.bsp-bot-rail` (yeni, sol dikey raf)
Eski yatay `.bsp-bot-tabs`/`.bsp-tab-btn`'in yerini aldı. Her bot için
32×32px yuvarlak buton, 2 harfli kod (FR/M1/MA/V3/4S), aktif olan mavi
vurgulu. Rozet sayısı yok (kullanıcı kararı).

### Odak/imleç koruması
`innerHTML` ile tam yeniden çizim yapıldığı için, arama kutusuna yazarken
her tuş vuruşunda input'un focus'u kayboluyordu. `render()` fonksiyonuna,
yeniden çizimden önce imleç konumunu kaydedip sonrasında geri yükleyen bir
adım eklendi.

### Kaldırılan ölü CSS
`.bsp-bot-tabs`, `.bsp-tab-btn`, `.bsp-tab-btn:hover`, `.bsp-tab-btn.active`,
`.bsp-stacked-filters` — artık hiçbir yerde kullanılmıyordu, silindi.
(`.bsp-stacked-btn` sınıfının kendisi hâlâ BN/BB rozeti için kullanıldığı
için korundu.)

---

## Doğrulama

Bybit'te tarayıcıda test edildi.

| Test | Sonuç |
|---|---|
| Dikey raf render ediliyor | ✅ FR/M1/MA/V3/4S butonları, doğru sırada |
| Sekme değişimi (rail tıklama) | ✅ `_activeBot` güncelleniyor, SE rozeti değişiyor (FR→M1) |
| Eski `.bsp-tab-btn` / `.bsp-stacked-filters` kalktı mı | ✅ ikisi de DOM'da yok |
| Snipe aç/kapa | ✅ `_coinFilter` 'all'↔'selected' arası doğru geçiyor |
| Arama aç/kapa | ✅ input görünür/gizlenir, kapanınca sorgu sıfırlanır |
| Arama sekmeler arası korunuyor mu | ✅ FR'de açılan arama M1 Hammer'a geçince açık kalıyor |
| **Arama filtresi — gerçek kanıt** | ✅ 3 sahte sinyal (BTC/ETH/SOL) enjekte edildi: "BTC" araması → 1 sonuç (BTC), "ZZZ" araması → 0 sonuç + doğru boş mesaj, temizlenince → 3 sonuca dönüş |
| Arama sırasında input focus'u | ✅ korunuyor (her tuşta kaybolmuyor) |
| Görsel (ekran görüntüsü) | ✅ raf + header kontrolleri doğru konumda |
| Yeni konsol hatası | ✅ yok (mevcut CryptoCompare haber hatası ilgisiz) |

Test için enjekte edilen sahte `window.m1HammerSignals` verisi temizlendi.

## Değişen dosyalar

| Dosya |
|---|
| `js/screener/bot-signals-panel.js` |

## Sıradaki adım

"SE" rozetinin gerçek anlamı/işlevi netleşirse (şu an salt bilgilendirici
varsayımla ilerlendi) güncellenebilir. M1-A/V3/4S botları henüz aktif
olmadığı için arama/snipe onlarda görsel olarak duruyor ama filtrelenecek
veri yok — bu botlar ileride implemente edildiğinde ek kod gerekmeden aynı
mekanizmayı kullanacaklar.
