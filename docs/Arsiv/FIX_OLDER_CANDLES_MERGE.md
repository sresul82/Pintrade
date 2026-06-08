# GÖREV: Çift Tıklamada Mumların Kaybolması — _onOlderCandles Düzeltmesi

## Proje Bağlamı

PinTrade V2.4. `js/chart/chart-pane.js` dosyasında bir düzeltme yapılacak.
Başka hiçbir dosyaya dokunma.

---

## Sorunun Tam Nedeni

Zaman cetveline çift tıklandığında şu zincir tetikleniyor:

1. `fitContent()` çalışıyor → chart tüm veriyi ekrana sığdırıyor
2. Bu sırada `subscribeVisibleLogicalRangeChange` ateşleniyor
3. `range.from < 50` koşulu sağlanıyor (sol kenara yakın)
4. `DataFeed.loadOlderCandles()` çağrılıyor
5. `feed:olderCandles` event'i geliyor → `_onOlderCandles()` tetikleniyor
6. `_onOlderCandles()` içinde **`this.series.setData(clean)`** çağrılıyor

**Sorun:** `clean` değişkeni sadece eski mumları içeriyor.
`setData()` tüm chart'ı bu eski mumlarla **sıfırdan yazıyor** —
mevcut (yeni) mumlar kayboluyor, chart boş görünüyor.

**Doğru davranış:** Eski mumlar ile mevcut mumlar **birleştirilmeli**,
sonra `setData()` birleşik veriyle çağrılmalı.

---

## Yapılacak Değişiklik

**Dosya:** `js/chart/chart-pane.js`
**Metod:** `_onOlderCandles()`

`_onOlderCandles()` metodunu bul. İçinde şu bloğu bul:

### ESKİ KOD (satır ~733–748):
```javascript
    try {
      this.series.setData(
        isLine
          ? clean.map(d => ({ time: d.time, value: d.close }))
          : clean
      );

      if (this.volSeries) {
        this.volSeries.setData(clean.map(d => ({
          time:  d.time,
          value: d.volume,
          color: d.close >= d.open ? 'rgba(8,153,129,.4)' : 'rgba(242,54,69,.4)',
        })));
      }

      this.candlesData = clean;

      // Visible range'i geri yükle — kullanıcının baktığı yere geri dön
      if (savedRange) {
        try { this.chart.timeScale().setVisibleLogicalRange(savedRange); } catch(_) {}
      }
    } catch(err) {
      console.warn('[ChartPane] _onOlderCandles setData failed:', err);
    }
```

### YENİ KOD:
```javascript
    try {
      // Eski mumları mevcut mumlarla birleştir — mevcut mumları kaybetme
      const existing     = this.candlesData ?? [];
      const existingSet  = new Set(existing.map(d => d.time));
      const onlyNew      = clean.filter(d => !existingSet.has(d.time));
      const merged       = [...onlyNew, ...existing].sort((a, b) => a.time - b.time);

      // Duplicate time değerlerini temizle (son gelen kazanır)
      const dedupeMap = new Map();
      merged.forEach(d => dedupeMap.set(d.time, d));
      const deduped = Array.from(dedupeMap.values()).sort((a, b) => a.time - b.time);

      this.series.setData(
        isLine
          ? deduped.map(d => ({ time: d.time, value: d.close }))
          : deduped
      );

      if (this.volSeries) {
        this.volSeries.setData(deduped.map(d => ({
          time:  d.time,
          value: d.volume,
          color: d.close >= d.open ? 'rgba(8,153,129,.4)' : 'rgba(242,54,69,.4)',
        })));
      }

      this.candlesData = deduped;

      // Phantom'ı güncelle — birleşik veriyle zaman eksenini yenile
      if (window.ChartPhantom) ChartPhantom.update(this);

      // Visible range'i geri yükle — kullanıcının baktığı yere geri dön
      if (savedRange) {
        try { this.chart.timeScale().setVisibleLogicalRange(savedRange); } catch(_) {}
      }
    } catch(err) {
      console.warn('[ChartPane] _onOlderCandles setData failed:', err);
    }
```

---

## Özet

| Dosya | Metod | Değişiklik |
|-------|-------|------------|
| `js/chart/chart-pane.js` | `_onOlderCandles()` | `setData(clean)` → `setData(deduped)` — eski+mevcut mumlar birleştirildi |

---

## Kesinlikle Yapılmayacaklar

- `chart-data.js`'e **dokunma**
- `chart-phantom.js`'e **dokunma**
- `_onFeedCandles()` metoduna **dokunma**
- `_onFeedTick()` metoduna **dokunma**
- `_onOlderCandles()` metodunun başındaki guard kontrolleri ve `savedRange` koduna **dokunma** — sadece `try { }` bloğunun içini değiştir

---

## Test Adımları

1. Sayfayı yenile, mumlar yüklensin
2. Zaman cetveline çift tıkla — mumlar ekranda kalıyor mu?
3. Chart'ı sola kaydır, eski mumlar yüklensin — mevcut mumlar kayboluyor mu?
4. TF değiştir (örn. 1H → 15m → 1H) — mumlar korunuyor mu?
5. Console'da hata var mı?
