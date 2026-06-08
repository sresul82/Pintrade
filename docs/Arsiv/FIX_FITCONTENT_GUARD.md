# GÖREV: Çift Tıklamada Mumların Kaybolması — loadOlderCandles Yanlış Tetikleniyor

## Proje Bağlamı

PinTrade V2.4. `js/chart/chart-pane.js` dosyasında bir düzeltme yapılacak.
Başka hiçbir dosyaya dokunma.

---

## Sorunun Tam Nedeni

`chart-pane.js` içinde `subscribeVisibleLogicalRangeChange` ile bir scroll listener var.
Bu listener sol kenara yaklaşıldığında (`range.from < 50`) eski mumları yüklüyor.

**Sorun:** Zaman cetveline çift tıklandığında `fitContent()` tetikleniyor.
Phantom serinin 500 bar geleceği olduğu için chart tüm veriyi ekrana sığdırmaya çalışıyor.
Bu sırada `range.from` çok negatif bir değere düşüyor (örn. -480).
`-480 < 50` koşulu sağlanıyor → `loadOlderCandles` yanlışlıkla tetikleniyor.
`_onOlderCandles` → `setData()` çalışıyor → mumlar kayboluyor.

**Çözüm:** `range.from < 50` koşuluna ek bir guard ekle:
`range.from` çok negatif bir değerdeyse (örn. -100'den küçükse)
bu bir `fitContent()` tetiklemesidir, gerçek scroll değil — yükleme yapma.

---

## Yapılacak Değişiklik

**Dosya:** `js/chart/chart-pane.js`
**Satır:** ~292–306 (`subscribeVisibleLogicalRangeChange` bloğu)

### ESKİ KOD:
```javascript
    this._lazyLoadThrottle = false;
    this.chart.timeScale().subscribeVisibleLogicalRangeChange(range => {
      if (!range) return;
      if (this._lazyLoadThrottle) return;
      // If the left edge of the visible range is within 50 bars of the data start, load more
      if (range.from < 50) {
        this._lazyLoadThrottle = true;
        // Find the oldest bar time we currently hold
        const oldestBar = this.candlesData?.[0];
        if (oldestBar) {
          DataFeed.loadOlderCandles(`pane_${this.idx}`, oldestBar.time * 1000);
        }
        // Throttle: prevent repeated calls for 3 seconds
        setTimeout(() => { this._lazyLoadThrottle = false; }, 3000);
      }
    });
```

### YENİ KOD:
```javascript
    this._lazyLoadThrottle = false;
    this.chart.timeScale().subscribeVisibleLogicalRangeChange(range => {
      if (!range) return;
      if (this._lazyLoadThrottle) return;
      // [FIX] Eğer range.from çok negatifse (< -100) bu fitContent() tetiklemesidir,
      // gerçek kullanıcı scroll'u değil. loadOlderCandles çağırma — mumlar kaybolur.
      if (range.from < -100) return;
      // If the left edge of the visible range is within 50 bars of the data start, load more
      if (range.from < 50) {
        this._lazyLoadThrottle = true;
        // Find the oldest bar time we currently hold
        const oldestBar = this.candlesData?.[0];
        if (oldestBar) {
          DataFeed.loadOlderCandles(`pane_${this.idx}`, oldestBar.time * 1000);
        }
        // Throttle: prevent repeated calls for 3 seconds
        setTimeout(() => { this._lazyLoadThrottle = false; }, 3000);
      }
    });
```

---

## Özet

| Dosya | Satır | Değişiklik |
|-------|-------|------------|
| `js/chart/chart-pane.js` | ~294 | `subscribeVisibleLogicalRangeChange` içine `range.from < -100` guard eklendi |

---

## Kesinlikle Yapılmayacaklar

- `chart-phantom.js`'e **dokunma**
- `chart-data.js`'e **dokunma**
- `_onOlderCandles()` metoduna **dokunma**
- `_onFeedCandles()` metoduna **dokunma**
- Throttle süresini **değiştirme**
- Başka hiçbir metoda **dokunma**

---

## Test Adımları

1. Sayfayı yenile, mumlar yüklensin
2. Zaman cetveline çift tıkla — mumlar ekranda kalıyor mu?
3. Chart'ı sola kaydır (eski mumlar yüklensin) — mumlar korunuyor mu?
4. Fiyat cetvelini fare ile aşağı/yukarı çek — grid bozuluyor mu?
5. TF değiştir (1H → 15m → 1H) — mumlar korunuyor mu?
6. Console'da hata var mı?
