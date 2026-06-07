# RAPOR: CHECK_PHANTOM_CALLS.md Kontrolü

**Tarih:** 2026-05-17

---

## KONTROL 1 — `_buildSeries()` sonu

**VAR ✅**

**Satır numarası:** 464

```javascript
    if (window.ChartPhantom) ChartPhantom.init(this);
```

---

## KONTROL 2 — `_onFeedCandles()` içi

**VAR ✅**

**Satır numarası:** 565

```javascript
    if (window.ChartPhantom) ChartPhantom.update(this);
```

---

## KONTROL 3 — `destroy()` içi

**VAR ✅**

**Satır numarası:** 1387

```javascript
    if (window.ChartPhantom) ChartPhantom.destroy(this);
```

---

## Özet

Üç kontrol noktası da dosyada mevcut ve doğru konumlarda:

| Kontrol | Durum | Satır |
|---------|-------|-------|
| `ChartPhantom.init(this)` — `_buildSeries()` sonu | ✅ VAR | 464 |
| `ChartPhantom.update(this)` — `_onFeedCandles()` içi | ✅ VAR | 565 |
| `ChartPhantom.destroy(this)` — `destroy()` içi | ✅ VAR | 1387 |
