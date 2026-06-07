# RAPOR: FIX_OLDER_CANDLES_MERGE.md Uygulandı

**Tarih:** 2026-05-17

---

## Sorun

Zaman cetveline çift tıklandığında şu zincir tetikleniyordu:

1. `fitContent()` → chart sola kayıyor
2. `subscribeVisibleLogicalRangeChange` → `range.from < 50`
3. `DataFeed.loadOlderCandles()` çağrılıyor
4. `feed:olderCandles` → `_onOlderCandles()` tetikleniyor
5. `this.series.setData(clean)` çağrılıyor — sadece **eski** mumlar geçiyor

**Sonuç:** `setData(clean)` tüm chart'ı eski mumlarla sıfırlıyordu,
mevcut (yeni) mumlar yok oluyordu ve chart boş görünüyordu.

---

## Yapılan Değişiklik

**Dosya:** `js/chart/chart-pane.js`  
**Metod:** `_onOlderCandles()`  
**Değiştirilen alan:** `try { }` bloğunun içi (satır ~733–756)

### Diff:
```diff
  try {
+   // Eski mumları mevcut mumlarla birleştir — mevcut mumları kaybetme
+   const existing    = this.candlesData ?? [];
+   const existingSet = new Set(existing.map(d => d.time));
+   const onlyNew     = clean.filter(d => !existingSet.has(d.time));
+   const merged      = [...onlyNew, ...existing].sort((a, b) => a.time - b.time);
+
+   // Duplicate time değerlerini temizle (son gelen kazanır)
+   const dedupeMap = new Map();
+   merged.forEach(d => dedupeMap.set(d.time, d));
+   const deduped = Array.from(dedupeMap.values()).sort((a, b) => a.time - b.time);

    this.series.setData(
      isLine
-       ? clean.map(d => ({ time: d.time, value: d.close }))
-       : clean
+       ? deduped.map(d => ({ time: d.time, value: d.close }))
+       : deduped
    );

    if (this.volSeries) {
-     this.volSeries.setData(clean.map(d => ({...})));
+     this.volSeries.setData(deduped.map(d => ({...})));
    }

-   this.candlesData = clean;
+   this.candlesData = deduped;
+
+   // Phantom'ı güncelle — birleşik veriyle zaman eksenini yenile
+   if (window.ChartPhantom) ChartPhantom.update(this);

    if (savedRange) { ... }
  }
```

---

## Nasıl Çalışıyor

| Adım | Açıklama |
|------|----------|
| `existingSet` | Mevcut mum `time` değerlerini Set'e alır |
| `onlyNew` | Gelen mumlar içinden sadece yeni (mevcut olmayan) olanları alır |
| `merged` | Yeni + mevcut mumları birleştirir, zamana göre sıralar |
| `deduped` | Map ile duplicate `time`'ları temizler |
| `setData(deduped)` | Birleşik veriyle chart güncellenir, mevcut mumlar korunur |
| `ChartPhantom.update(this)` | Phantom zaman eksenini yeni birleşik veriye göre günceller |

---

## Dokunulmayan Kısımlar

- `_onOlderCandles()` başındaki guard kontrolleri ✅
- `savedRange` kaydet/geri yükle kodu ✅
- `_onFeedCandles()` ✅
- `_onFeedTick()` ✅
- `chart-data.js` ✅
- `chart-phantom.js` ✅

---

## Push Edilecek Dosya

```
js/chart/chart-pane.js
```

---

## Test Adımları

1. Sayfayı yenile, mumlar yüklensin
2. Zaman cetveline çift tıkla — mumlar ekranda kalıyor mu? ✅
3. Chart'ı sola kaydır, eski mumlar yüklensin — mevcut mumlar kayboluyor mu? ❌ (kaybolmamalı)
4. TF değiştir (1H → 15m → 1H) — mumlar korunuyor mu? ✅
5. Console'da hata var mı? ❌ (olmamalı)
