# RAPOR: FIX_DBLCLICK_RANGE.md Uygulandı

**Tarih:** 2026-05-17

---

## Sorun

Lightweight Charts'ta zaman cetveline çift tıklandığında `fitContent()` fonksiyonu çalışır. 
Sisteme zaman eksenini sağa uzatmak için 500 barlık bir Phantom seri (`chart-phantom.js`) eklediğimizden dolayı, `fitContent()` bu 500 barı da ekrana sığdırmaya çalışıyor ve grafiği aşırı derecede sıkıştırıp sola kaydırıyordu. Mumlar ekranın dışında, çok küçük bir alana hapsoluyordu.

---

## Yapılan Değişiklik

**Dosya:** `js/chart/chart-pane.js`  
**Metod:** `_initChart()`  
**Satır:** ~328 (`this.ro.observe(this.cvs);` satırının hemen sonrasına)

### Eklenen Kod Bloğu:
```javascript
    // [FIX] Zaman cetveline çift tıklandığında fitContent() phantom'ın 500 barını
    // da ekrana sığdırır — mumlar sola kayar. Çift tıklamayı yakalayıp gerçek
    // mum aralığına geri döneriz.
    this.cvs.addEventListener('dblclick', () => {
      // Çift tıklama anında gerçek mumların logical range'ini hesapla
      const candles = this.candlesData;
      if (!candles || candles.length === 0) return;

      // fitContent() çalışıp bittikten sonra geri yükle
      setTimeout(() => {
        if (!this.chart || !this.candlesData || !this.candlesData.length) return;
        try {
          const ts         = this.chart.timeScale();
          const totalBars  = this.candlesData.length;
          // Ekranda görünür bar sayısını koru — varsayılan olarak son 150 bar
          const visibleBars = 150;
          const toBar      = totalBars - 1;          // son mum
          const fromBar    = Math.max(0, toBar - visibleBars);
          ts.setVisibleLogicalRange({ from: fromBar, to: toBar + 12 }); // +12 rightOffset
        } catch(_) {}
      }, 50);
    });
```

---

## Nasıl Çalışıyor

Çift tıklama (`dblclick`) olayı tetiklendiğinde Lightweight Charts kendi içinde `fitContent()` komutunu çalıştırır.
Biz bu olayı `canvas` üzerinden yakalayarak, `setTimeout(..., 50)` sayesinde `fitContent()`'in kendi iç işlemini tamamlamasını bekliyoruz.
`fitContent()` işlemi bitip grafik sola kaydıktan milisaniyeler sonra, bizim kodumuz devreye giriyor ve grafiğin sadece asıl verileri (`this.candlesData`) gösterecek şekilde (son 150 bar ve 12 bar sağ boşluk kalacak biçimde) odaklanmasını sağlıyor.
Bu sayede Phantom serisinin yarattığı sola kayma ve ezilme engellenmiş oluyor.

---

## Dokunulmayan Dosyalar/Metodlar

- `chart-phantom.js` ✅
- `chart-data.js` ✅
- `DrawingManager.onDoubleClick` (diğer dblclick listener'ı) ✅
- `subscribeVisibleLogicalRangeChange` ✅
- `_onOlderCandles()` ve `_onFeedCandles()` ✅

---

## Push Edilecek Dosya

```
js/chart/chart-pane.js
```

---

## Test Adımları

1. Sayfayı yenile, mumlar yüklensin
2. Zaman cetveline çift tıkla — mumlar ekranda kalıyor mu, sola kaymıyor mu? ✅
3. Chart'ı sola kaydır, eski mumlar yüklensin — çalışıyor mu? ✅
4. Fiyat cetveline çift tıkla — bozuluyor mu? ❌ (Bozulmamalı)
5. Son mumun ötesine trend çizgisi çiz — görünüyor mu? ✅
6. Console'da hata var mı? ❌ (Olmamalı)
