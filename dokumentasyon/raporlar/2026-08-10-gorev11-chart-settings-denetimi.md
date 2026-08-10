# gorevler2.md Görev 11 — Chart Settings Denetimi (11.1, 11.2, 11.4 Tamamlandı)

**Tarih:** 2026-08-10

## Bağlam

Kullanıcı Heikin Ashi'yi TradingView ile karşılaştırırken iki şey fark etti:
1. TradingView'da iki fiyat gösteriliyor (HA kapanışı + gerçek fiyat), Pintrade'de sadece biri.
2. "High and low" fiyat çizgisi ayarı işaretli ama chart'ta görünmüyor.

Kök nedeni ararken tüm Chart Settings modalının (`js/chart/ui/chart-settings.js`,
731 satır) sistematik denetimi yapıldı, ayrıca kullanıcı "değiştirilip
kaydedilmeyen bir şey var mı" diye sordu — o soru da ayrıca araştırıldı.

## İkinci fiyat etiketi (Heikin Ashi)

TradingView, HA modunda İKİ fiyat gösterir çünkü HA mumu sentetik/yumuşatılmış
bir değerdir, gerçek fiyat farklı olabilir:
- Serinin kendi last-value etiketi = HA kapanışı (mumun kendi rengiyle)
- Ayrı bir çizgi + etiket = gerçek/ham piyasa fiyatı (geri sayımlı)

Pintrade sadece ikincisini (`_livePriceLine`, ham fiyat) gösteriyordu çünkü
`_buildSeries()` hep `lastValueVisible: false` set ediyordu.

**Düzeltme:** `lastValueVisible: this.useHeikinAshi === true` — sadece HA
modunda serinin kendi etiketi açılıyor, normal mumda kapalı kalıyor (HA
kapanışı=ham kapanış olduğu için ikinci etiket gereksiz/yanıltıcı olurdu).

**Yan bulgu:** `_onRangeChange()` her scroll/zoom'da `lastValueVisible`'ı
sabit `false` yapıyordu (muhtemelen eski bir "duplicate line'ı önle"
tedbiri) — bu, yeni HA etiketini ilk kaydırmada söndürürdü. `_buildSeries()`
ile tutarlı hâle getirildi.

## 11.1 — "High and low" fiyat çizgisi (2 hata)

1. `this.candlesData` boşken `Math.max(...[])=-Infinity` hesaplanıp geçersiz
   bir çizgi oluşturuluyordu (hata vermeden, sessizce görünmüyordu).
2. High/Low, yüklenmiş TÜM geçmişin sabit min/max'ıydı — TradingView'da
   görünen aralığa göre dinamik hesaplanır.

**Düzeltme:** Yeni `_visibleCandles(data)` — `chart.timeScale().getVisibleRange()`
ile filtreleyip sadece görünen bar'lardan hesaplıyor, boşsa çizgiyi
kaldırıyor. `_onRangeChange()`'e `if (this.lineHighLow) this._updateVisualLines(...)`
eklendi.

**Test:** Mock range ile doğrulandı — dar aralık (5 bar, hepsi high=102/low=98)
→ `102/98`; geniş aralık (tüm 20 bar) → `102/26` (gerçek min/max). Gerçek
sayfada `setVisibleRange` + ekran görüntüsüyle de doğrulandı: "High 102.000"/
"Low 98.000" çizgileri tam olarak ekrandaki bar'ların üstüne/altına oturdu.

## 11.2 — `settings:apply` için 2 çakışan dinleyici

`chart-core.js`'de saat dilimi köprüleme dinleyicisi `{paneIdx, settings}`
bekliyordu ama event her zaman `{pane, state}` ile emit ediliyor — `settings`
her zaman `undefined`, kod tamamen ölüydü. Bu bridge, Chart Settings'teki
timezone seçimini sidebar'daki global saat göstergesine (`#rsb-clock-tz`)
yansıtmak için var.

**Düzeltme:** `{ state }` okuyacak şekilde düzeltildi.

**Test:** `EventBus.emit('settings:apply', {pane, state:{timezone:'UTC+9 Tokyo'}})`
sonrası `#rsb-clock-tz` metni `UTC` → `UTC+9` oldu.

## 11.4 — Değiştirilip kaydedilmeyen ayarlar

Kullanıcının "başka kaydedilmeyen bir şey var mı" sorusu üzerine bulundu:
`applySettings()`'te canlı uygulanan ama `getState()`'te hiç yer almayan
(sayfa yenilenince sessizce sıfırlanan) alanlar:

- `timezone` — constructor'da okunuyordu ama `getState()`'te eksikti.
- `hlValue`/`hlLine`/`baValue`/`baLine`/`pdValue`/`pdLine` — sadece
  `applySettings()`'te set ediliyordu, constructor'da hiç init yoktu.
- `symName`/`symValue`/`symLine` — aynı.
- `watermarkMode`, `marginTop`/`marginBottom` — hiçbir yerde `this.X`'e
  yazılmıyordu, sadece `applySettings()`'in kendi parametresinden anlık
  kullanılıp atılıyordu (en ciddi durum — `this.watermarkMode` diye bir
  property fiilen yoktu).

**Düzeltme:**
- Constructor'a hepsi için `s.X ?? default` init eklendi — varsayılanlar
  MEVCUT sabit davranışla birebir eşleşecek şekilde seçildi (örn.
  `marginTop ?? 5, marginBottom ?? 15` — chart'ın eski hardcoded
  `scaleMargins:{top:.05,bottom:.15}`'ine eşit — görsel değişiklik yok).
- `getState()`'e hepsi eklendi.
- `applySettings()`'teki margin/watermark blokları artık `this.X`'e de
  yazıyor (öncesinde sadece parametreden okuyup atıyordu).
- Chart ilk kurulumu (`_build()`, `rightPriceScale`/`leftPriceScale`
  `scaleMargins`) artık hardcoded `.05`/`.15` yerine `this.marginTop`/`this.marginBottom`
  okuyor — restore edilen bir marj değeri artık gerçekten görünüyor.
- `setSymbol()`/`setTF()` artık `watermarkMode==='Interval'` ise watermark
  metnini sembol yerine TF ile güncelliyor (öncesinde hep sembole sabitti).

**Test:** `applySettings({timezone, symName, hlValue, watermarkMode, marginTop, marginBottom})`
sonrası `getState()`'te tüm alanların doğru round-trip ettiği doğrulandı
(hepsi `true`).

## 11.3 — HENÜZ YAPILMADI (kullanıcı kararı bekliyor)

Chart Settings modalının ~%60-65'i (Trading sekmesinin tamamı — 18 kontrol,
Alerts'in tamamı — 5, Events'in tamamı — 9, Status line'ın 6/7'si, Scales'in
~14 kontrolü, Canvas'ın 4 kontrolü) `applySettings()`'e hiç bağlı değil,
tamamen kozmetik. Bu büyük bir kapsam kararı gerektiriyor:
(a) gerçek işleve bağlamak, (b) UI'dan kaldırmak, (c) olduğu gibi bırakmak.
Kullanıcı hangisini istediğini belirtmeden dokunulmadı.

## Regresyon

- Normal (HA olmayan) mum modunda ikinci fiyat etiketi açılmıyor — davranış
  değişmedi.
- Marj varsayılanları eski hardcoded değerlerle birebir eşleştirildi —
  ayarı hiç değiştirmemiş kullanıcıların görünümü aynı kalıyor.
- Konsolda test boyunca sadece bilinen sandbox ağ hataları (502/Failed to
  fetch), yeni hata yok.

## Değişen dosyalar

- `js/chart/chart-pane.js`
- `js/chart/chart-core.js`
- `dokumentasyon/gorevler/gorevler2.md`
