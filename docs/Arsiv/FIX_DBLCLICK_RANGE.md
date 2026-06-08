# GÖREV: Çift Tıklamada Phantom 500 Bar Göz Ardı Edilsin

## Proje Bağlamı

PinTrade V2.4. `js/chart/chart-pane.js` dosyasında bir düzeltme yapılacak.
Başka hiçbir dosyaya dokunma.

---

## Sorunun Tam Nedeni

Zaman cetveline çift tıklandığında Lightweight Charts `fitContent()` çalıştırıyor.
Phantom serinin 500 bar geleceği olduğu için chart bu 500 barı da ekrana sığdırıyor —
mumlar 500 bar sola kayıyor, ekranın dışında kalıyor.

`overlay: true` veya `autoscaleInfoProvider: () => null` zaman eksenini etkiliyor —
Lightweight Charts bu bar'ları zaman hesabına dahil ediyor.

**Çözüm:** Zaman cetveli üzerindeki çift tıklamayı yakalayıp
`fitContent()` çalışmadan hemen önce gerçek mumların logical range'ini hesapla,
küçük bir `setTimeout` ile geri yükle.
Böylece `fitContent()` kendi hesabını yapıp bitirdikten sonra
biz gerçek mum alanına geri döneriz.

---

## Yapılacak Değişiklik

**Dosya:** `js/chart/chart-pane.js`
**Metod:** `_initChart()`

`this.ro.observe(this.cvs);` satırından hemen **sonrasına** şu bloğu ekle:

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

## Özet

| Dosya | Metod | Değişiklik |
|-------|-------|------------|
| `js/chart/chart-pane.js` | `_initChart()` | `dblclick` listener eklendi — `fitContent()` sonrası gerçek mum aralığına geri döner |

---

## Kesinlikle Yapılmayacaklar

- `chart-phantom.js`'e **dokunma**
- `chart-data.js`'e **dokunma**
- Mevcut `dblclick` listener'a (`DrawingManager.onDoubleClick`) **dokunma** — o farklı bir listener, bu yenisi
- `subscribeVisibleLogicalRangeChange` bloğuna **dokunma**
- `_onOlderCandles()` veya `_onFeedCandles()`'a **dokunma**

---

## Test Adımları

1. Sayfayı yenile, mumlar yüklensin
2. Zaman cetveline çift tıkla — mumlar ekranda kalıyor mu, sola kaymıyor mu?
3. Chart'ı sola kaydır, eski mumlar yüklensin — çalışıyor mu?
4. Fiyat cetveline çift tıkla — bozuluyor mu?
5. Son mumun ötesine trend çizgisi çiz — görünüyor mu?
6. Console'da hata var mı?
