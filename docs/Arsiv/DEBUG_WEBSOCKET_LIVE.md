# DEBUG GÖREVİ — BinanceFeed WebSocket `onmessage` Tetiklenmiyor

## Durum Özeti

WebSocket bağlantısı **OPEN** durumunda (`readyState = 1`), ancak `ws.onmessage` hiç tetiklenmiyor.  
Sonuç olarak chart canlı güncellenmiyor, screener fiyatları hareket etmiyor.

Console'dan tespit edilen kritik bulgu:

```
[BinanceFeed] connectLive initiated for BTCUSDT_1m     ← 1. çağrı
[BinanceFeed] WS OPEN successfully connected ...
[BinanceFeed] connectLive initiated for BTCUSDT_1m     ← 2. çağrı (ŞÜPHELI)
[BinanceFeed] WS OPEN successfully connected ...
```

`connectLive` **iki kez** çağrılıyor. Bu, eski WebSocket'in `disconnectLive()` ile kapatılıp  
yeni bir WebSocket açıldığını, ancak yeni WebSocket'e `onmessage` handler'ının  
düzgün atanmadığını gösteriyor.

---

## Şüpheli Senaryo (Büyük İhtimalle Olan Bu)

```
1. DataFeed.load() çağrılır
2. connectLive() → ws açılır, onmessage atanır
3. Hemen ardından DataFeed.load() TEKRAR çağrılır (farklı bir event'ten)
4. disconnectLive() → eski ws kapatılır
5. Yeni ws açılır — ama bu sefer onmessage ya atanmıyor ya da kaybolur
6. ws.readyState = 1 (OPEN) görünür ama mesaj gelmez
```

---

## Senden İstenenler

### Adım 1 — `onmessage` logunu doğrula

`chart-data.js` içindeki `ws.onmessage` handler'ının en üstüne şu logu ekle ve sayfayı yenile:

```javascript
ws.onmessage = (e) => {
    console.log('[BinanceFeed] raw msg:', e.data); // ← BU LOG GELİYOR MU?
    // ... mevcut kod
};
```

**Beklenen sonuç:** Bu log hiç gelmiyorsa `onmessage` handler atanmıyor veya kayboluyor demektir.

---

### Adım 2 — `chart-data.js` içinde şunları kontrol et

1. `connectLive(symbol, tf)` metodunda `_ws[key]` değişkenine yeni WebSocket **doğru** atanıyor mu?

```javascript
// Şöyle olmalı:
const ws = new WebSocket(url);
this._ws[key] = ws;         // ← bu satır var mı, doğru yerde mi?
ws.onmessage = (e) => { ... }; // ← this._ws[key] değil, ws üzerinden mi atanıyor?
```

2. `disconnectLive()` içinde `ws.onmessage = null` set ediliyor mu?  
   Eğer eski referansa `null` atanıyor ama yeni ws'e atama yapılmıyorsa handler kaybolur.

3. `connectLive()` içinde **race condition** var mı?  
   `ws.onopen` içinde mi `onmessage` atanıyor? Eğer öyleyse, `onopen` tetiklenmeden  
   ikinci `connectLive()` çağrılırsa handler hiç set edilmeden ws değişir.

---

### Adım 3 — `chart-pane.js` içinde `_loadData()` çağrı noktalarını listele

`_loadData()` fonksiyonunun **tüm çağrı noktalarını** bul:

- `setSymbol()` içinde mi çağrılıyor?
- `setTF()` içinde mi çağrılıyor?
- Herhangi bir `EventBus.on(...)` listener'ında mı tetikleniyor?
- Sayfa ilk yüklenirken kaç kez çağrılıyor?

Her çağrı noktasını listele ve hangisinin **çift tetiklenmeye** yol açabileceğini belirt.

---

### Adım 4 — Düzeltme Önerisi

Yukarıdaki analizden sonra `connectLive()` metoduna şu güvenlik önlemini ekle:

```javascript
connectLive(symbol, tf) {
    const key = `${symbol}_${tf}`;

    // Zaten açık bir bağlantı varsa önce kapat
    if (this._ws[key]) {
        console.warn(`[BinanceFeed] Existing WS found for ${key}, closing first.`);
        this._ws[key].onmessage = null; // handler'ı temizle
        this._ws[key].close();
        this._ws[key] = null;
    }

    const url = `wss://fstream.binance.com/ws/${symbol.toLowerCase()}@kline_${tf}`;
    const ws = new WebSocket(url);
    this._ws[key] = ws; // ← ÖNCE kaydet

    ws.onopen = () => {
        console.log(`[BinanceFeed] WS OPEN successfully connected to ${url}`);
    };

    ws.onmessage = (e) => {
        console.log('[BinanceFeed] raw msg:', e.data); // debug için
        // ... mevcut işleme kodu
    };

    ws.onerror = (err) => {
        console.error(`[BinanceFeed] WS ERROR for ${key}:`, err);
    };

    ws.onclose = () => {
        console.log(`[BinanceFeed] WS CLOSED for ${key}`);
        this._ws[key] = null;
    };
}
```

---

## Verilmesi Gereken Dosyalar

| Öncelik | Dosya | Neden |
|---------|-------|-------|
| 🔴 Kritik | `js/data/chart-data.js` | `connectLive`, `disconnectLive`, `_ws` yönetimi |
| 🔴 Kritik | `js/chart/chart-pane.js` | `_loadData()` çağrı noktaları |
| 🟡 Yardımcı | `js/core/event-bus.js` | EventBus handler'larının override edilip edilmediği |

---

## Beklenen Çıktı

1. `onmessage` neden tetiklenmediğinin kök nedeni (root cause)
2. `_loadData()` tüm çağrı noktaları listesi
3. Düzeltilmiş `connectLive()` metodu
4. Eğer `chart-pane.js`'de çift tetiklenme varsa, bunu önleyen guard kodu
