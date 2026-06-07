# GÖREV: chart-pane.js Kontrolü — Phantom Çağrıları Var mı?

## Proje Bağlamı

PinTrade V2.4. `js/chart/chart-pane.js` dosyasında 3 satır eklenmiş olması gerekiyor.
Bu satırların gerçekten eklenip eklenmediğini kontrol et ve rapor et.
**Hiçbir değişiklik yapma — sadece oku ve rapor et.**

---

## Yapılacak Tek Şey: Dosyayı Oku, 3 Noktayı Kontrol Et

`js/chart/chart-pane.js` dosyasını aç ve şu üç soruyu yanıtla:

---

### KONTROL 1 — `_buildSeries()` metodunun sonu

`_buildSeries()` metodunu bul.
Metodun en sonunda (kapanış `}` parantezinden hemen önce) şu satır var mı?

```javascript
ChartPhantom.init(this);
```

**Raporda yaz:**
- VAR mı / YOK mu?
- Varsa: tam olarak hangi satır numarasında?
- Yoksa: `_buildSeries()` metodunun son 5 satırını olduğu gibi yapıştır.

---

### KONTROL 2 — `_onFeedCandles()` metodunun içi

`_onFeedCandles()` metodunu bul.
İçinde şu satır var mı?

```javascript
ChartPhantom.update(this);
```

**Raporda yaz:**
- VAR mı / YOK mu?
- Varsa: tam olarak hangi satır numarasında?
- Yoksa: `_onFeedCandles()` metodunun son 5 satırını olduğu gibi yapıştır.

---

### KONTROL 3 — `destroy()` metodunun içi

`destroy()` metodunu bul.
İçinde şu satır var mı?

```javascript
ChartPhantom.destroy(this);
```

**Raporda yaz:**
- VAR mı / YOK mu?
- Varsa: tam olarak hangi satır numarasında?
- Yoksa: `destroy()` metodunun tüm içeriğini olduğu gibi yapıştır.

---

## Rapor Formatı

Şu formatta yanıtla, başka hiçbir şey yapma:

```
KONTROL 1 — _buildSeries() sonu:
[VAR / YOK]
[Satır numarası VEYA son 5 satır]

KONTROL 2 — _onFeedCandles() içi:
[VAR / YOK]
[Satır numarası VEYA son 5 satır]

KONTROL 3 — destroy() içi:
[VAR / YOK]
[Satır numarası VEYA tüm içerik]
```

---

## Kesinlikle Yapılmayacaklar

- Dosyada **hiçbir değişiklik yapma**
- Başka dosyalara **bakma**
- Kod önerisi **sunma**
- Sadece oku ve rapor et
