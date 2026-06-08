# GÖREV: Zaman Eksenini Sağa Uzat — Phantom Series

## Proje Bağlamı

PinTrade V2.4. Lightweight Charts kullanılıyor.
Şu an zaman ekseni (x ekseni) sadece mum verisi olan aralıkta gösteriliyor.
Mumların ötesine çizim yapılamıyor veya yapılan çizim görünmüyor.

**Bu görevi sadece yeni bir dosya oluşturarak çöz.**
`chart-pane.js`, `chart-data.js` veya başka hiçbir dosyaya dokunma.
Tek istisna: `chart-pane.js` içinde sadece yeni dosyayı çağıran **1 satır** eklenecek.

---

## Çözüm Yaklaşımı

Lightweight Charts'ta zaman ekseni, chart'a eklenen serilerin
en büyük `time` değerine göre belirleniyor.

Çözüm: Chart'a **görünmez (phantom) bir LineSeries** ekle.
Bu seri gelecekteki 500 zaman noktasını içeriyor ama `visible: false` olduğu için
kullanıcı görmüyor. Sadece zaman eksenini sağa uzatıyor.

Böylece:
- Kullanıcı mumların ötesine çizim yapabilir ✅
- Yapılan çizimler o alanda görünür kalır ✅
- Screener, detail panel, fiyat hesaplamaları etkilenmez ✅
- Ana seri (`this.series`) ve `candlesData` kirlenmez ✅

---

## Adım 1 — Yeni Dosya Oluştur: `js/chart/chart-phantom.js`

```javascript
/* ──────────────────────────────────────────────────────────
   chart-phantom.js  —  Zaman eksenini sağa uzatan phantom seri
   
   Amacı: Lightweight Charts'ta zaman ekseni sadece mum verisi
   olan aralıkta görünür. Bu modül görünmez (opacity=0) bir
   LineSeries ekleyerek zaman eksenini gelecekteki 500 bara
   kadar uzatır. Çizim araçları bu alanda çalışabilir hale gelir.
   
   Kullanım: ChartPhantom.init(chartPane) — chart hazır olduktan sonra
────────────────────────────────────────────────────────── */

const ChartPhantom = (() => {

  // TF → saniye cinsinden bar süresi
  const TF_SECONDS = {
    '1m':  60,
    '3m':  180,
    '5m':  300,
    '15m': 900,
    '30m': 1800,
    '1H':  3600,
    '2H':  7200,
    '4H':  14400,
    '6H':  21600,
    '12H': 43200,
    '1D':  86400,
    '3D':  259200,
    '1W':  604800,
    '1M':  2592000,
  };

  const PHANTOM_BARS = 500; // Sağa uzatılacak bar sayısı

  /**
   * Verilen ChartPane'e phantom seri ekler.
   * @param {ChartPane} pane — ChartPane instance
   */
  function init(pane) {
    if (!pane || !pane.chart) return;

    // Önceki phantom seriyi temizle
    destroy(pane);

    try {
      // Görünmez LineSeries oluştur
      pane._phantomSeries = pane.chart.addLineSeries({
        color:       'rgba(0,0,0,0)',   // Tamamen şeffaf
        lineWidth:   1,
        priceScaleId: 'phantom_scale',  // Ayrı scale — fiyat eksenini etkilemez
        lastValueVisible: false,
        priceLineVisible: false,
        crosshairMarkerVisible: false,
      });

      // Phantom scale'i gizle
      pane.chart.priceScale('phantom_scale').applyOptions({
        visible:       false,
        scaleMargins:  { top: 0, bottom: 0 },
        borderVisible: false,
      });

      // Phantom veriyi oluştur ve set et
      _updatePhantom(pane);

    } catch(e) {
      console.warn('[ChartPhantom] init failed:', e);
    }
  }

  /**
   * Phantom seriyi güncelle — son mum değiştiğinde çağır
   * @param {ChartPane} pane
   */
  function _updatePhantom(pane) {
    if (!pane._phantomSeries) return;

    const tf       = pane.tf;
    const barSec   = TF_SECONDS[tf] || 3600;
    const candles  = pane.candlesData;

    if (!candles || !candles.length) return;

    // Son mumun zamanından başla
    const lastTime = candles[candles.length - 1].time;
    // Fiyat olarak son kapanış fiyatını kullan (görünmez ama gerekli)
    const lastClose = candles[candles.length - 1].close;

    const phantomData = [];
    for (let i = 1; i <= PHANTOM_BARS; i++) {
      phantomData.push({
        time:  lastTime + (barSec * i),
        value: lastClose, // Görünmez ama null olamaz
      });
    }

    try {
      pane._phantomSeries.setData(phantomData);
    } catch(e) {
      console.warn('[ChartPhantom] setData failed:', e);
    }
  }

  /**
   * Phantom seriyi temizle
   * @param {ChartPane} pane
   */
  function destroy(pane) {
    if (!pane || !pane.chart) return;
    if (pane._phantomSeries) {
      try { pane.chart.removeSeries(pane._phantomSeries); } catch(_) {}
      pane._phantomSeries = null;
    }
  }

  /**
   * Son mum değiştiğinde phantom'ı güncelle
   * ChartPane._onFeedCandles() ve _onLiveCandle() sonrası çağrılabilir
   */
  function update(pane) {
    _updatePhantom(pane);
  }

  return { init, update, destroy };

})();
```

---

## Adım 2 — `index.html`'e Script Ekle

`chart-pane.js`'den **önce** şu satırı ekle.
Satırın hemen üstüne İngilizce yorum yaz:

```html
<!-- [ChartPhantom] Invisible phantom series that extends the time axis 500 bars
     to the right of the last candle. Enables drawing tools to work and remain
     visible beyond the last real bar. Must load before chart-pane.js. -->
<script src="js/chart/chart-phantom.js"></script>
```

---

## Adım 3 — `chart-pane.js`'e Sadece 3 Satır Ekle

Her eklenen satırın **hemen üstüne** İngilizce açıklama yorumu yaz.
Bu yorumlar ileride kodun neden eklendiğini açıklamalı.

### 3a — `_onFeedCandles()` metodunun sonuna ekle

`_onFeedCandles()` içinde `this.candlesData = deduped;` satırından sonra:

```javascript
// [ChartPhantom] After candle data is set, update the invisible phantom series
// so the time axis extends 500 bars into the future. This allows drawing tools
// to work beyond the last real candle without disappearing.
ChartPhantom.update(this);
```

### 3b — `_buildSeries()` metodunun sonuna ekle

`_buildSeries()` metodunun en sonuna (return'den önce):

```javascript
// [ChartPhantom] Initialize the invisible phantom series that extends the time
// axis to the right. Called every time the series is rebuilt (chart type change,
// symbol change, TF change) so the extension is always in sync.
ChartPhantom.init(this);
```

### 3c — `destroy()` metoduna ekle

`destroy()` metodu içinde, `this.chart.remove()` satırından önce:

```javascript
// [ChartPhantom] Clean up the phantom series before destroying the chart pane
// to avoid memory leaks and stale series references.
ChartPhantom.destroy(this);
```

---

## Özet

| Yapılacak | Nerede |
|-----------|--------|
| `chart-phantom.js` dosyası oluştur | `js/chart/chart-phantom.js` |
| Script tag ekle | `index.html` — `chart-pane.js`'den önce |
| `ChartPhantom.update(this)` ekle | `chart-pane.js` → `_onFeedCandles()` sonu |
| `ChartPhantom.init(this)` ekle | `chart-pane.js` → `_buildSeries()` sonu |
| `ChartPhantom.destroy(this)` ekle | `chart-pane.js` → `destroy()` içi |

---

## Kesinlikle Yapılmayacaklar

- `chart-data.js`'e **dokunma**
- `candlesData` dizisine **dokunma**
- Ana `this.series`'e **dokunma**
- `screener-core.js`'e **dokunma**
- `_buildSeries()` içindeki mevcut koda **dokunma** — sadece en sona ekle

---

## Test Adımları

1. Sayfayı yenile
2. Chart yüklendi — sağ tarafa doğru zaman ekseni uzuyor mu?
3. En son mumun ötesine bir trend çizgisi çiz — görünüyor mu?
4. O çizgiyi sola sürükle, geri sağa sürükle — kayboluyor mu?
5. Bybit chart'ta da aynı testi yap — çalışıyor mu?
6. Console'da `[ChartPhantom]` hatası var mı?
7. Fiyat skalası bozuldu mu? (Phantom fiyatı göstermemeli)
