# FR Sinyal — Delta Formülü Düzeltmesi ve Mimari Güncelleme

## Görev
Mevcut `ScalpFRMonitor` sınıfındaki delta hesaplama mantığını,
Telegram bot verisinden çıkarılan doğru formüle uyacak şekilde güncelle.

---

## 1. Mevcut Durum (Yanlış)

Önceki `.md` dosyasında delta şu şekilde hesaplanıyordu:

```js
const delta = Math.abs(currentFR - previousFR);
```

Bu formül **yönü kaybediyor** — sinyalin negatife mi gittiğini, yoksa
pozitife mi döndüğünü ayırt edemiyoruz.

---

## 2. Doğru Formül (Telegram bot verisinden çıkarılan)

Telegram bot örnek verileri:

| Durum | Previous | Current | Difference | Renk |
|---|---|---|---|---|
| Pozitife dönüyor | -1.2918 | -1.2811 | **-0.010737** | 🔴 Kırmızı |
| Daha negatife gidiyor | -0.0199 | -0.0301 | **+0.010215** | 🟢 Yeşil |

Formül:
```js
const delta = previousFR - currentFR;  // Math.abs KULLANMA
```

Yorumlama:
- `delta > 0` → FR daha negatife gitti → **yeşil** (`more_negative`) → long fırsatı
- `delta < 0` → FR pozitife yaklaştı → **kırmızı** (`less_negative`) → fırsat azalıyor

---

## 3. Mimari Uyumluluk Kontrolü

### ✅ Değişmeyen şeyler (dokunma)
- `BinanceFRPoller` ve `BybitFRPoller` — ham FR'ı `scalpFRMonitor.onFRUpdate(symbol, frPct, now)` ile doğru iletiyor
- `detail-panel.js` — `sig.direction` ve `sig.display.delta` değerlerini doğru renklendiriyor
- EventBus olayları: `scalp:frSignal`, `scalpFRSignal` — doğru bağlı

### ⚠️ Sadece ScalpFRMonitor'da değişecek yer

`ScalpFRMonitor` sınıfının `onFRUpdate()` veya delta hesaplama bloğunu bul.
Şu anda büyük ihtimalle şöyle bir şey var:

```js
// ESKİ — yanlış
const delta = Math.abs(frPct - prev);
const direction = frPct < prev ? 'more_negative' : 'less_negative';
```

Şu şekilde değiştir:

```js
// YENİ — doğru
const delta = prev - frPct;          // previousFR - currentFR
const direction = delta > 0 ? 'more_negative'   // daha negatife gitti → yeşil
                : delta < 0 ? 'less_negative'   // pozitife yaklaştı  → kırmızı
                :             'flat';
```

`display.delta` string olarak formatlanıyorsa işaret korunmalı:

```js
// display için
const sign = delta > 0 ? '+' : '';
display.delta = `${sign}${delta.toFixed(4)}%`;
```

---

## 4. Eşik (Threshold) Kontrolü

`detail-panel.js` header'ında sabit olarak gösteriliyor:
```js
threshold: <span>0.001</span>
```

`ScalpFRMonitor`'daki eşik değerini kontrol et:
- CSV analizinden çıkan minimum değişim: `0.0001` (% cinsinden `0.01%`)
- Mevcut gösterilen: `0.001`

**Bu 10x fark** — hangisi doğru olduğunu kendi test verilerinle doğrula.
Eğer çok az sinyal geliyorsa eşiği `0.0001`'e düşür.
Eğer çok fazla gürültü varsa `0.001` doğrudur, bırak.

---

## 5. Özet — Yapılacaklar

```
[ ] ScalpFRMonitor dosyasını aç
[ ] onFRUpdate() içindeki delta hesabını bul
[ ] Math.abs kaldır, delta = prev - current yap
[ ] direction mantığını: delta > 0 → more_negative olacak şekilde güncelle
[ ] display.delta'ya işaret (+/-) ekle
[ ] Threshold değerini test et: 0.001 mi yoksa 0.0001 mi daha iyi?
```

---

## 6. Test Senaryosu

Değişiklik sonrası şu iki durumu elle doğrula:

**Senaryo A — Daha negatife:**
```
prev = -0.0199,  current = -0.0301
delta = -0.0199 - (-0.0301) = +0.0102  ✅ pozitif → more_negative → yeşil
```

**Senaryo B — Pozitife dönüyor:**
```
prev = -1.2918,  current = -1.2811
delta = -1.2918 - (-1.2811) = -0.0107  ✅ negatif → less_negative → kırmızı
```
