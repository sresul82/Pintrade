# RAPOR: FIX_FITCONTENT_GUARD.md Uygulandı

**Tarih:** 2026-05-17

---

## Sorun

`chart-pane.js` içindeki `subscribeVisibleLogicalRangeChange` listener'ı, sol kenara yaklaşıldığında (`range.from < 50`) eski mumları yüklemeyi tetikliyordu. Ancak zaman cetveline çift tıklandığında (veya grafik ilk yüklendiğinde) `fitContent()` çalışır ve phantom serisindeki 500 bar geleceği ekrana sığdırmak için `range.from` değeri aşırı negatif bir değere (örn. `-480`) düşebilir. 

Bu durumda `-480 < 50` koşulu sağlandığından sistem yanlışlıkla bunu kullanıcının geçmişe doğru sola kaydırması zannedip `loadOlderCandles`'ı tetikliyordu. Bu da ekrandaki mevcut mumların geçici olarak kaybolmasına yol açıyordu.

---

## Yapılan Değişiklik

**Dosya:** `js/chart/chart-pane.js`  
**Metod:** `subscribeVisibleLogicalRangeChange` bloğu içi  
**Satır:** ~294

### Eklenen Satır:
```javascript
      // [FIX] Eğer range.from çok negatifse (< -100) bu fitContent() tetiklemesidir,
      // gerçek kullanıcı scroll'u değil. loadOlderCandles çağırma — mumlar kaybolur.
      if (range.from < -100) return;
```

### Diff:
```diff
    this._lazyLoadThrottle = false;
    this.chart.timeScale().subscribeVisibleLogicalRangeChange(range => {
      if (!range) return;
      if (this._lazyLoadThrottle) return;
+     // [FIX] Eğer range.from çok negatifse (< -100) bu fitContent() tetiklemesidir,
+     // gerçek kullanıcı scroll'u değil. loadOlderCandles çağırma — mumlar kaybolur.
+     if (range.from < -100) return;
      // If the left edge of the visible range is within 50 bars of the data start, load more
      if (range.from < 50) {
```

---

## Nasıl Çalışıyor

`range.from < -100` kontrolü, `range.from`'un aşırı negatif değerler aldığı durumları yakalar. Bu gibi değerler sadece `fitContent()` fonksiyonu zaman cetvelini mevcut mumlardan öteye sıkıştırdığında oluşur. Kullanıcı gerçekte sola kaydırdığında `range.from` tipik olarak `0` ile `50` arasında pozitif bir değerdir. Bu `return` sayesinde gereksiz `loadOlderCandles` çağrısı engellenir ve mumlar ekranda kalmaya devam eder.

---

## Dokunulmayan Dosyalar

- `chart-phantom.js` ✅
- `chart-data.js` ✅
- `_onOlderCandles()` fonksiyonu ✅
- `_onFeedCandles()` fonksiyonu ✅
- Throttle süresi `3000ms` ✅

---

## Push Edilecek Dosya

```
js/chart/chart-pane.js
```

---

## Test Adımları

1. Sayfayı yenile, mumlar yüklensin
2. Zaman cetveline çift tıkla — mumlar ekranda kalıyor mu? ✅
3. Chart'ı sola kaydır (eski mumlar yüklensin) — mumlar korunuyor mu? ✅
4. Fiyat cetvelini fare ile aşağı/yukarı çek — grid bozuluyor mu? ✅ (Etkilenmemeli)
5. TF değiştir (1H → 15m → 1H) — mumlar korunuyor mu? ✅
6. Console'da hata var mı? ❌ (Olmamalı)
