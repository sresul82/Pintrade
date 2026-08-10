# gorevler2.md Görev 11 — Chart Settings Denetimi (11.1, 11.2, 11.3-kısmen, 11.4, 11.5, 11.5.1, 11.6 Tamamlandı)

**Tarih:** 2026-08-10

**Ek (aynı gün, 2 tur sonra):** Kullanıcı TradingView'ın gerçek "Create
Alert" modalının ekran görüntülerini paylaştı — 11.5'in ilk versiyonundaki
basit modal yerine, TV'ninkiyle hizalanan Condition/Trigger/Expiration/
Message/Notifications (Toast+Telegram) alanları eklendi (**11.6**, detay
aşağıda §11.6). Ayrıca kullanıcı, ilk 11.5 versiyonundaki "eğik çizgi
alarmı oluşturma anında sabitleniyor" basitleştirmesine haklı olarak itiraz
etti — düzeltildi, artık TradingView gibi çizgiyi canlı takip ediyor
(**11.5.1**, detay §11.5.1). Sunucu taraflı izleme (tarayıcı kapalıyken
Kom1+alarm çalışsın, Telegram gerçekten göndersin) kullanıcı isteğiyle
`gorevler3.md` Görev 7'ye kuyruğa eklendi, bu turda uygulanmadı — bkz.
gorevler2.md Görev 11'in "Doğrulama" bölümü ve gorevler3.md.

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

## 11.3 — Kullanıcı kararı geldi, kısmen uygulandı (2026-08-10)

- **Trading sekmesi (18 kontrol):** tamamen kaldırıldı — TradingView'ın Paper
  Trading entegrasyonundan geliyordu, bu projede karşılığı yok. `TABS`
  dizisinden, `tabTrading()` fonksiyonundan, render satırından silindi.
- **Events sekmesi (9 kontrol):** 6'sı kaldırıldı (Ideas, Economic events,
  Only future events, Events breaks, Latest news, News notification) —
  proje ayrı bir News sekmesine sahip, tekrarı gereksizdi. Sadece "Session
  breaks" kaldı (henüz `applySettings()`'e bağlı değil, ayrı iş).
- **Alerts sekmesi (5 kontrol):** gerçek bir özelliğe dönüştürüldü, bkz. 11.5.
- **Status line (6/7), Scales (~14), Canvas (4) kalan kozmetik kontroller:**
  kullanıcı bu tura dahil etmedi, izleme listesine taşındı.

## 11.5 — Çizim tabanlı fiyat alarmları (kullanıcı isteği, 2026-08-10) — YENİ

### Kapsam (kullanıcı onaylı)

- Alarm kaynağı: SADECE 7 çizim aracı — trendline, ray, extended, hline,
  hray, trendangle, infoline.
- Property toolbar'daki zil ikonu (`property-toolbar.js`, önceden sadece
  "yakında" `alert()`'i gösteriyordu — kod zaten vardı ama işlevsizdi) ve
  Navbar'ın ⏰ Alert butonu (önceden sadece "preview, kaydetmiyor" diyen bir
  modal) artık AYNI `AlertStore`'u paylaşıyor. İki ikon zaten AYNI SVG'ye
  sahipti (kontrol edildi, ek değişiklik gerekmedi).
- Tetikleme BU TURDA dahil: `MarketDataStore`'un zaten yayınladığı
  `mds:tick`'e abone olunuyor (kendi ayrı fiyat akışı AÇILMADI — mimari
  kural). Fiyat alarm seviyesini geçince: Toast + Web Audio beep + chart
  çizgisi güncellenir.
- Kalıcılık: localStorage (`pintrade_alerts` alarmlar, `pintrade_alert_prefs`
  görsel/bildirim tercihleri).
- Eğik çizgilerin tetik fiyatı **TradingView'daki gibi çizgiyi canlı
  takip eder** (bkz. aşağıdaki "İlk versiyon düzeltmesi" — ilk halinde
  yanlışlıkla oluşturma anında sabitleniyordu, kullanıcı geri bildirimiyle
  aynı gün düzeltildi).

### Mimari karar — alarm tercihleri neden pane'e değil AlertStore'a

Chart Settings > Alerts sekmesindeki ayarlar (renk, görünürlük, ses,
toast süresi) BİLEREK `chart-pane.js`'e değil `alert-store.js`'in global
tek tercih setine yazılıyor: bir alarm, o an aktif OLMAYAN bir pane/sembolde
de tetiklenebilir — "hangi pane'in ayarı geçerli" belirsizliği olmasın diye.

### Yeni dosya

`js/screener/alert-store.js` — `getAlerts/createFromDrawing/createManual/
removeAlert/getPrefs/setPrefs/checkPrice/computeDrawingPrice`.

### Değişen dosyalar (11.5 için)

- `js/drawing/ui/property-toolbar.js` — `hasAlert` artık sadece 7 desteklenen
  araçta true (önceden `!['rotatedrect','triangle','pathtool','circle','arc']`
  — yani hemen hemen HER araçta görünüyordu), `pt-btn-alert` tıklaması artık
  `AlertStore.createFromDrawing()` çağırıyor.
- `js/core/app.js` — Alarm modalı artık `AlertStore.createManual()` çağırıp
  gerçekten kaydediyor; seçili bir çizgi varsa (`drawing:selected` ile takip
  ediliyor) fiyatı önceden dolduruyor. `Toast.show()` opsiyonel `duration`
  parametresi aldı (varsayılan 3000ms, geriye dönük uyumlu).
- `js/chart/chart-pane.js` — yeni `_updateAlertLines()`, `feed:candles` ve
  `alert:created/removed/triggered/prefsChanged` event'lerinde çağrılıyor.
  `_buildSeries()`'te `_alertPriceLines` sıfırlanıyor (Görev 11.1'deki
  `_livePriceLine` bug'ıyla aynı sınıf — seri yeniden kurulunca eski
  referanslar geçersiz kalıyordu).
- `js/chart/ui/chart-settings.js` — Alerts sekmesi artık AlertStore'dan
  okuyor/yazıyor. `buildSlider()` opsiyonel `key` parametresi aldı — "Alert
  volume" sürgüsü önceden HİÇBİR `data-key`'e sahip değildi, `readFormState()`
  onu hiç okuyamıyordu, tamamen kayıp bir ayardı (Status line'daki "Background"
  sürgüsü de aynı durumda ama bu tur kapsamı dışında, dokunulmadı).

### ⚠️ Test sırasında bulunan kritik bug (kendi eklediğim kod, hemen düzeltildi)

Alerts sekmesinin AlertStore-senkron kodunu yanlışlıkla `if (pane) {...}`
bloğunun DIŞINA yazdım. O bloktaki `setCheck`/`setColor` yardımcı fonksiyonları
sadece o bloğa scope'lu — dışarıdan çağrılınca `ReferenceError: setCheck is
not defined` fırlatıyordu. `EventBus`'ın `settings:open` handler'ını
try/catch içine aldığı için hata sessizce yutuluyordu — ama bu, handler'ın
GERİ KALANININ (showTab kurulumu, `.tv-close`/`.tv-btn-cancel`/`.tv-btn-ok`
click listener'larının atanması) HİÇ ÇALIŞMAMASI anlamına geliyordu.
Sonuç: **TÜM Settings modalı** (sadece Alerts sekmesi değil — Cancel/Ok/X
butonlarının hiçbiri) kullanılamaz hale gelmişti.

**Nasıl yakalandı:** "Alert ayarları OK sonrası neden kaydedilmiyor" diye
test ederken, kontrol amaçlı Cancel butonunun bile modalı kapatmadığını fark
ettim — bu, sorunun Alerts'e özel değil TÜM modal için olduğunu gösterdi.
Konsolda `ReferenceError: setCheck is not defined` (chart-settings.js:597)
görüldü, kök neden netleşti.

**Düzeltme:** AlertStore-senkron bloğu `if (pane) {...}`'in İÇİNE, kapanış
`}`'inden hemen önce taşındı.

**Test (düzeltme sonrası):** Alerts sekmesinde renk/checkbox/slider değiştirip
Ok'a basınca `AlertStore.getPrefs()`'in doğru güncellendiği, modalın düzgün
kapandığı, VE diğer sekmelerdeki (Symbol > showVolume) ayarların da hâlâ
doğru çalıştığı (regresyon yok) doğrulandı.

### Doğrulama (11.5)

- `hline`(sabit) ve `trendline`(eğimden projekte, elle hesapla karşılaştırıldı:
  100+(20/3600)*3600=120 ✅) için doğru tetik fiyatı hesabı.
- Desteklenmeyen araç (`rect`) → `createFromDrawing` `null` döner, property
  toolbar'da zil ikonu hiç görünmez — ikisi de doğrulandı.
- Crossing tetikleme: taze bir sembolde önce alt seviyede tick, sonra üst
  seviyede tick → `triggered` doğru sırada `false`→`true` geçti (ilk testte
  gerçek BTCUSDT'nin arka planda akan canlı tick'i yanıltıcı sonuç verdi,
  uydurma bir sembolle temiz tekrar edildi).
- `onlyActiveAlerts` filtresi: 2 alarm → 2 çizgi, biri tetiklenince → 1
  çizgi, `onlyActiveAlerts=false` yapılınca → 2 çizgi (tetiklenen gri renkte).
- Navbar modalı: seçili çizgiden fiyat önceden doluyor, "Create" gerçekten
  `AlertStore`'a kaydediyor (2→3 alarm sayısı).
- Property toolbar zil ikonu: tıklanınca gerçekten alarm oluşturuyor (3→4),
  Toast doğru gösteriliyor.
- Ekran görüntüsüyle görsel doğrulama: chart üzerinde "Alert 106.500" yeşil
  kesikli çizgi (kullanıcının ayarladığı renk, localStorage'dan kalıcı
  şekilde geri geldi — sayfa/sekme değişse de korunuyor) High/Low ve fiyat
  etiketiyle birlikte sorunsuz render oluyor.

### İlk versiyon düzeltmesi — eğik çizgi alarmları artık gerçekten canlı takip ediyor

İlk implementasyonda (yukarıdaki testler o sürümle yapılmıştı) eğik çizgi
alarmlarının tetik fiyatı **oluşturma anında hesaplanıp sabitleniyordu** —
kullanıcı haklı olarak bunun eğik çizgi kullanmanın anlamını ortadan
kaldırdığını belirtti ("105'te sabit tutacaksan eğik çizginin ne anlamı
kalır"). Düzeltildi:

- Yeni `_resolveTriggerPrice(alert)`: `sourceDrawingId`'si olan alarmlarda
  kaynak çizim `State.getDrawings(symbol)`'dan HER fiyat kontrolünde TAZE
  okunup `computeDrawingPrice()` ile yeniden hesaplanıyor — hem zaman
  geçtikçe (eğim boyunca ilerler) hem kullanıcı çizgiyi sürükleyip
  düzenlerse (yeni p1/p2 okunur) alarm güncel kalıyor. Çizim silinmişse son
  bilinen sabit fiyata düşülüyor (makul bir yedek davranış).
- `checkPrice()` artık `a.price`'ı sabit okumak yerine her tick'te
  `_resolveTriggerPrice()` çağırıp güncelliyor — hem crossing kontrolü hem
  chart'taki görsel çizgi (`_updateAlertLines`, artık `_onFeedTick`/
  `_onLiveCandle`'da da çağrılıyor) güncel değeri kullanıyor.

**Test:** Bir trendline'dan alarm oluşturulup (t anında çizgi 100$'da, alarm
100$ ile başladı), sonra çizgi "sürüklenmiş" gibi p2.price State üzerinden
değiştirildi (130$'a) → bir sonraki fiyat kontrolünde alarmın `price`'ı
otomatik olarak 130$'a güncellendi (donmadı). Crossing testi de aynı
mekanizmayla (sabit bir hedefe karşı) doğrulandı.

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
- `js/chart/ui/chart-settings.js`
- `js/drawing/ui/property-toolbar.js`
- `js/core/app.js`
- `index.html` (yeni script etiketi: `js/screener/alert-store.js`)
- `dokumentasyon/gorevler/gorevler2.md`
- `dokumentasyon/gorevler/gorevler3.md` (Navbar Alert backlog notu güncellendi)

## Yeni dosyalar

- `js/screener/alert-store.js`
