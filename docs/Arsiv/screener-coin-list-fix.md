# Screener Coin Listesi — Düzenleme Talimatları

## `watchlist.css` Değişiklikleri

### 1. Screener grid genişlikleri
```css
/* ESKİ */
grid-template-columns: 92px 64px 62px 60px 46px 52px 48px;

/* YENİ */
grid-template-columns: 100px 70px 58px 58px 44px 58px 52px;
```

### 2. Sağ hizalama
```css
/* ESKİ */
.wl-col-right { text-align: left; display: flex; align-items: center; justify-content: flex-start; gap: 2px; }

/* YENİ */
.wl-col-right { text-align: right; display: flex; align-items: center; justify-content: flex-end; gap: 2px; }
```

### 3. Yazı boyutları
```css
/* ESKİ */
.wl-row span, .wl-col-header span { font-size: 10px; }
.wl-sym   { font-size: 12px; font-weight: 700; }
.wl-price { font-size: 10px; }
.wl-pct   { font-size: 10px; }
.wl-fr    { font-size: 9px; }

/* YENİ */
.wl-row span, .wl-col-header span { font-size: 11px; }
.wl-sym   { font-size: 11px; font-weight: 600; }
.wl-price { font-size: 11px; }
.wl-pct   { font-size: 11px; }
.wl-fr    { font-size: 11px; }
```

### 4. Renkleri belirginleştir
```css
/* ESKİ */
.pos { color: var(--accent-green, #3fb950); }
.neg { color: var(--accent-red,   #f85149); }
.fr-trend-negative { color: #ff4444 !important; font-weight: 700; }
.fr-trend-positive { color: #00ff88 !important; }

/* YENİ */
.pos { color: #26d97f; }
.neg { color: #ff3b3b; }
.fr-trend-negative { color: #ff3b3b !important; font-weight: 700; }
.fr-trend-positive { color: #26d97f !important; }
```

---

## `screener-core.js` Değişiklikleri

### 5. Symbol formatı
`_buildRowScreener` ve `_buildRowAll` fonksiyonlarında:
```js
// ESKİ
<span class="wl-sym">${d.sym}USDT.P</span>

// YENİ
<span class="wl-sym">${d.sym}USDT</span>
```
