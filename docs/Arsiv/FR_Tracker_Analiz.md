# FR Tracker — Kod Analizi ve Durum Raporu

## Sonuç: Delta formülü DOĞRU çalışıyor

Senin bulduğun `prev - current` formülü ile kodun `current - prev` formülü
**aynı sonucu üretiyor** — çünkü yön ataması da buna göre ters:

```js
// Kodun şu anki hali:
const d = currentFR - startFR;

// d < 0 → more_negative (yeşil) ✅
// d > 0 → less_negative (kırmızı) ✅
```

Test:
```
prev=-0.0199, current=-0.0301
d = -0.0301 - (-0.0199) = -0.0102 → d < 0 → more_negative → yeşil ✅

prev=-1.2918, current=-1.2811
d = -1.2811 - (-1.2918) = +0.0107 → d > 0 → less_negative → kırmızı ✅
```

**Delta formülüne dokunma.**

---

## Asıl Sorun: Threshold Uyumsuzluğu

Kodda iki farklı threshold sistemi var ve birimleri çelişiyor.

### ScalpFRMonitor (sinyal üreten kısım)
```js
static SCALP_THRESHOLD = 0.001;
// Yorum: "Ham veri olarak 0.001 (borsada 0.001% görünür)"
```

### FRTracker (geçmiş kayıt kısmı)
```js
this.lowThreshold     = 0.00014;
this.mediumThreshold  = 0.0002;
this.cumulativeThreshold = 0.00015;
this.rapidChangeThreshold = 0.0005;
```

### Birim karışıklığı

Poller dosyaları FR'ı şu şekilde iletiyor:
```js
// binance-api-fr.js ve bybit-api-fr.js:
const frPct = parseFloat(rawFR) * 100;
// Örnek: "0.00021300" → 0.0213  (yani 0.0213% anlamında)
```

Bu durumda ScalpFRMonitor'a gelen değer **% cinsinden** (0.0213 gibi).

`SCALP_THRESHOLD = 0.001` ise bu **0.001%** demek.

CSV analizinden çıkan minimum değişim ise **0.0001** (% cinsinden 0.0001%).

| Kaynak | Threshold | Karşılık |
|---|---|---|
| CSV analizi (Telegram bot) | 0.0001 | çok az sinyal geçer |
| SCALP_THRESHOLD (mevcut) | 0.001 | 10x daha katı |
| FRTracker.lowThreshold | 0.00014 | CSV ile uyumlu |

---

## Yapılacaklar

### Seçenek A — Mevcut threshold doğrudur
Eğer ekranda **makul sayıda sinyal** geliyorsa (ne çok az ne çok fazla),
`SCALP_THRESHOLD = 0.001` doğrudur, bırak.

### Seçenek B — Çok az sinyal geliyor
Threshold'u CSV analizindeki seviyeye düşür:
```js
// fr-tracker.js, ScalpFRMonitor sınıfı
static SCALP_THRESHOLD = 0.0001;  // 0.001'den 0.0001'e
```

### Seçenek C — Çok fazla gürültü var
Threshold'u yükselt:
```js
static SCALP_THRESHOLD = 0.005;
```

---

## Özet

| Bileşen | Durum | Aksiyon |
|---|---|---|
| `BinanceFRPoller` | ✅ Doğru | Dokunma |
| `BybitFRPoller` | ✅ Doğru | Dokunma |
| `delta` formülü | ✅ Doğru | Dokunma |
| `direction` mantığı | ✅ Doğru | Dokunma |
| `detail-panel.js` render | ✅ Doğru | Dokunma |
| `SCALP_THRESHOLD` değeri | ⚠️ Test et | Sinyal sayısına göre ayarla |

---

## Bir Sonraki Adım

`ScalpFRMonitor` ayrı bir dosya değil, **`fr-tracker.js` içinde** tanımlı.
Sınıf 210. satır civarında başlıyor.

Threshold testi için:
1. Konsolu aç (F12)
2. `scalpFRMonitor.signals.length` yaz — kaç sinyal birikmiş?
3. `scalpFRMonitor.windows.size` yaz — kaç coin izleniyor?
4. Sonuca göre yukarıdaki A/B/C seçeneklerinden birini uygula
