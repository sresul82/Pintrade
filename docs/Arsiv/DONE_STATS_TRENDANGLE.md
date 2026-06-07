# RAPOR: FIX_STATS_TRENDANGLE.md Uygulandı

**Tarih:** 2026-05-17

---

## Sorun

TrendAngle (Açı Çizgisi) ve diğer çizgilerde istatistiklerin (Stats) görünebilmesi için altyapı mevcuttu fakat bazı yerlerde veriler doğru bağlanmamıştı. `TrendAngle` çizimlerinde istatistik fonksiyonu çağrılmıyor, ayarlar kutusundaki Stats onay kutuları (checkbox) olay dinleyicilerine (event listener) sahip değildi ve varsayılan olarak tüm statların değil boş bir stat listesinin gelmesinden ötürü hatalı çalışıyordu.

---

## Yapılan Değişiklikler

Belirtilen **4 dosyada** toplam **7 değişiklik** eksiksiz ve sırasıyla uygulandı:

### 1. `drawing-trend.js` (Satır ~149)
`_drawTrendAngle` fonksiyonunun imzasına `selected` parametresi eklendi ve bu parametre bir alt çağrı olan `_drawTrendLine`'a da aktarıldı.

### 2. `drawing-trend.js` (Satır ~185)
`_drawTrendAngle` içine, açı derecesi basıldıktan sonra çalışacak şekilde istatistik kutusunu (`_drawTrendStats`) render eden şu kod bloğu eklendi:
```javascript
      if (selected || !!d.style?.alwaysStats) {
        _drawTrendStats(ctx, d, pane, a, b);
      }
```

### 3. `drawing-trend.js` (Satır ~192)
`_drawTrendStats` fonksiyonu içerisinde `activeStats` değişkeni, sadece kullanıcı kaydetmişse değil, varsayılan (default) olarak da sistemdeki tüm istatistik alanlarını (Price, Percent, Bars, Date/time, Angle) barındıracak şekilde güncellendi.
```javascript
      const ALL_STAT_FIELDS = ['Price range','Percent change','Bars range','Date/time range','Angle'];
      const activeStats = s.statsFields ?? ALL_STAT_FIELDS;
```

### 4. `drawing-core.js` (Satır ~1486)
`DrawingManager` döngüsü çizimleri yaparken `trendangle`'a da `selected` değişkenini (kullanıcının o an çizimi seçip seçmediği bilgisi) parametre olarak geçecek şekilde güncellendi.

### 5. `dsd-standard-tabs.js` (Satır ~26)
Ayarlar penceresinde, istatistik onay kutularının dolu (checked) gelebilmesi için `activeStats` dizisine varsayılan (default) olarak tüm istatistik alanları atandı.

### 6. `dsd-standard-tabs.js` (Satır ~208)
"Stats on/off" genel onay kutusu, mantık hatası olmaması ve sadece kesin olarak açık bırakıldığında aktif olması için `${s.statsOn === true ? 'checked' : ''}` kuralıyla değiştirildi.

### 7. `drawing-settings-dialog.js` (Satır ~916)
Ayarlar penceresinde Stats aç/kapa (`#dsd-stats-on`) ve Her zaman göster (`#dsd-alwaysstats`) onay kutuları için (checkbox) `change` (tıklama/değişme) dinleyicileri eklendi. Bu sayede ayarlardan yapacağınız değişiklikler çizime anında yansıyacaktır.

---

## Dokunulmayan Dosyalar/Özellikler
- Görev kağıdında belirtilmeyen başka hiçbir fonksiyona, HTML öğesine veya dosyaya dokunulmadı.
- Yorum satırları ve `Bold / Italic` ayarları gibi kısımlar tamamen korundu.

---

## Push Edilen Dosyalar

1. `js/drawing/tools/drawing-trend.js`
2. `js/drawing/core/drawing-core.js`
3. `js/drawing/ui/dsd-tabs/dsd-standard-tabs.js`
4. `js/drawing/ui/drawing-settings-dialog.js`

---

## Test Adımları

1. Sayfayı yenile.
2. **TrendAngle** aracını seç ve grafiğe çiz.
3. Çizgiyi seç (üzerine tıkla) → Seçiliyken istatistik (Stats) penceresi çıkıyor mu? ✅
4. Ayarlar menüsüne gir (Settings).
5. "Stats on/off" kutusunu aç/kapa → Kapattığında anında gizleniyor, açtığında geri geliyor mu? ✅
6. "Always show" kutusunu aç ve çizgideki seçimini (focus) kaldır → Seçili olmasa bile istatistikler grafikte asılı kalmaya devam ediyor mu? ✅
7. Console'da hata var mı? ❌ (Olmamalı)
