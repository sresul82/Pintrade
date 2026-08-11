/**
 * AlertStore — Çizim tabanlı fiyat alarmları (gorevler2.md Görev 11, 2026-08-10).
 *
 * Kapsam (kullanıcı onaylı): Navbar'daki ⏰ Alert butonu + çizim özellik
 * menüsündeki zil ikonu, aynı kalıcı (localStorage) alarm deposunu paylaşır.
 * Alarm kaynağı SADECE şu 7 çizim aracı: trendline, ray, extended,
 * hline, hray, trendangle, infoline (kullanıcının belirlediği kapsam).
 *
 * Eğik çizgiler (trendline/ray/extended/trendangle/infoline) için tetik
 * fiyatı TradingView'daki gibi ÇİZGİYİ CANLI TAKİP EDER: her fiyat
 * kontrolünde (bkz. checkPrice → _resolveTriggerPrice) kaynak çizim
 * (`sourceDrawingId`) State'ten yeniden okunup o ANKİ eğim+zamana göre
 * fiyat yeniden hesaplanır — 12:00'de 105$'da oluşturulan bir alarm,
 * 14:00'te çizgi 110$'a çıkmışsa 110$'ı bekler, 105$'da donmaz. Kullanıcı
 * çizgiyi sürükleyip düzenlerse alarm da onunla birlikte güncellenir
 * (aynı `sourceDrawingId`'yi okuduğu için). Çizim silinirse son bilinen
 * sabit fiyata (`alert.price`) düşülür. (2026-08-10, kullanıcı: "Tviewdekinin
 * aynısını istiyorum" — ilk v1'deki sabit-fiyat basitleştirmesi düzeltildi.)
 *
 * Tetikleme: MarketDataStore'un zaten yayınladığı 'mds:tick' event'ine
 * (js/data/market-data-store.js, TÜM semboller için akıyor) abone olunur —
 * kendi ayrı bir fiyat akışı AÇILMAZ (proje mimari kuralı). Fiyat, alarm
 * seviyesini iki taraftan da (yukarı veya aşağı) geçtiğinde tetiklenir.
 *
 * Görsel/bildirim tercihleri (alertLines/alertLinesColor/onlyActiveAlerts/
 * alertVolume/autoHideToasts — Chart Settings > Alerts sekmesi) BİLEREK
 * pane'e değil buraya (global, tek kopya) kaydediliyor: bir alarm, o an
 * aktif olmayan bir pane/sembolde de tetiklenebilir, "hangi pane'in ayarı
 * geçerli" sorusu olmasın diye tek global tercih seti kullanılıyor.
 *
 * Public API:
 *   AlertStore.getAlerts(symbol?)
 *   AlertStore.createFromDrawing(symbol, exchange, drawing) -> alert|null
 *   AlertStore.createManual(symbol, exchange, price, condition) -> alert
 *   AlertStore.updateAlert(id, fields) -> alert|null (gorevler2.md Görev 13)
 *   AlertStore.removeAlert(id)
 *   AlertStore.getPrefs() / setPrefs({...})
 *   AlertStore.SUPPORTED_TOOLS
 */
const AlertStore = (() => {
  const LS_KEY = 'pintrade_alerts';
  const LS_PREFS_KEY = 'pintrade_alert_prefs';
  const SUPPORTED_TOOLS = ['trendline', 'ray', 'extended', 'hline', 'hray', 'trendangle', 'infoline'];

  function _load() {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch (_) { return []; }
  }
  let _alerts = _load();

  function _save() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(_alerts)); } catch (_) {}
  }

  // alertVolume = ses açık/kapalı (checkbox), alertVolumeLevel = ses düzeyi 0-100 (slider) — ayrı iki ayar
  // alertLinesColor varsayılanı gri-beyaz arası kesikli çizgi (TradingView'ın
  // kendi Alert çizgisi stili) — 2026-08-11, kullanıcı geri bildirimi:
  // önceki kırmızı (#f23645) "çocuksu/neon" görünüyordu.
  const DEFAULT_PREFS = { alertLines: true, alertLinesColor: '#9598a1', onlyActiveAlerts: true, alertVolume: true, alertVolumeLevel: 50, autoHideToasts: true };
  function _loadPrefs() {
    try { return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(LS_PREFS_KEY) || '{}') }; } catch (_) { return { ...DEFAULT_PREFS }; }
  }
  let _prefs = _loadPrefs();
  function getPrefs() { return { ..._prefs }; }
  function setPrefs(partial) {
    _prefs = { ..._prefs, ...partial };
    try { localStorage.setItem(LS_PREFS_KEY, JSON.stringify(_prefs)); } catch (_) {}
    _emit('alert:prefsChanged', getPrefs());
  }

  function _uid() { return 'al_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8); }

  function _emit(event, data) {
    if (typeof EventBus !== 'undefined') EventBus.emit(event, data);
  }

  function getAlerts(symbol) {
    return symbol ? _alerts.filter(a => a.symbol === symbol) : _alerts.slice();
  }

  /** Eğik çizgi araçlarının O ANKİ projekte fiyatı — bkz. modül başlığı notu. */
  function computeDrawingPrice(drawing) {
    if (drawing.tool === 'hline' || drawing.tool === 'hray') return drawing.price;
    const p1 = drawing.p1, p2 = drawing.p2;
    if (!p1 || !p2 || p1.price == null || p2.price == null) return null;
    if (p2.time === p1.time) return p2.price;

    // 2026-08-11 bug düzeltmesi (kullanıcı geri bildirimi) — "Trend Line"
    // aracıyla GÖRSEL OLARAK yatay çizilmiş bir çizgide bile p1.price ve
    // p2.price matematiksel olarak birebir eşit olmayabilir (fare/piksel
    // hassasiyeti, iki tık arasındaki sub-pixel yuvarlama farkı). Bu ÇOK
    // KÜÇÜK fark, alarm oluşturma anından (p1.time) UZAK bir "now"'a
    // ekstrapole edilirken (eğim × büyük zaman farkı) büyütülüp gerçek
    // dışı, gözle görülür bir sapmaya (%0.5+ gibi) yol açıyordu — "Horizontal
    // Line" aracı bu yüzden etkilenmiyordu (drawing.price'ı doğrudan
    // kullanıyor, hiç ekstrapolasyon yok), ama "Trend Line" aracı yatay
    // çizilse bile HER ZAMAN bu eğim formülünden geçiyordu. Fark göreceli
    // olarak ihmal edilebilir düzeydeyse (< %0.05) çizgi FİİLEN yatay
    // kabul edilip ekstrapolasyon YAPILMAZ, doğrudan son çizilen fiyat
    // (p2.price) döner.
    const relDiff = Math.abs(p2.price - p1.price) / Math.max(Math.abs(p1.price), 1e-12);
    if (relDiff < 0.0005) return p2.price;

    const slope = (p2.price - p1.price) / (p2.time - p1.time);
    const now = Math.floor(Date.now() / 1000);
    return p1.price + slope * (now - p1.time);
  }

  // 2026-08-11 — TEK ortak fiyat formatlama fonksiyonu (Create Alert modalı
  // VE Alerts listesi burayı kullanır). Önceki bug: modal sabit `.toFixed(4)`
  // kullanıyordu — HOMEUSDT gibi küçük fiyatlı bir coinde gerçek değer
  // (ör. 0.009256) 4 basamağa yuvarlanınca 0.0093 gibi görünüp kullanıcıya
  // "sapma" gibi görünüyordu; aslında ekstrapolasyon hatası değil, saf
  // gösterim/yuvarlama hatasıydı (relDiff düzeltmesi bunu ÇÖZMEDİ, ayrı bir
  // hataydı). Ondalık basamak sayısı artık fiyatın büyüklüğüne göre uyarlanıyor.
  function formatPrice(p) {
    if (p == null || isNaN(p)) return '—';
    const n = Number(p);
    const decimals = n >= 1000 ? 2 : n >= 1 ? 4 : n >= 0.01 ? 6 : 8;
    return n.toFixed(decimals).replace(/0+$/, '').replace(/\.$/, '');
  }

  /**
   * Bir alarmın O ANKİ (güncel) tetik fiyatı. `sourceDrawingId` varsa
   * çizim State'ten TAZE okunup yeniden hesaplanır (eğik çizgide çizginin
   * o anki değeri, çizgi sürüklenip düzenlendiyse de yeni hâli) — bkz.
   * modül başlığı notu. Kaynak çizim bulunamazsa (silinmiş) alarmın son
   * bilinen sabit `price`'ına düşülür.
   */
  function _resolveTriggerPrice(alert) {
    if (alert.sourceDrawingId && typeof State !== 'undefined') {
      const drawings = State.getDrawings(alert.symbol) || [];
      const d = drawings.find(x => x.id === alert.sourceDrawingId);
      if (d) {
        const live = computeDrawingPrice(d);
        if (live != null && !isNaN(live)) return live;
      }
    }
    return alert.price;
  }

  function _addAlert(fields) {
    const alert = {
      id: _uid(), createdAt: Date.now(), triggered: false, active: true,
      lastKnownPrice: null, condition: 'crossing',
      ...fields,
    };
    _alerts.push(alert);
    _save();
    _emit('alert:created', alert);
    return alert;
  }

  // gorevler2.md Görev 11.6 (2026-08-10) — TradingView "Create Alert" modalıyla
  // hizalanan ek alanlar. `triggerMode` UI'da seçilebilir ama şu an sadece
  // 'once' fiilen çalışıyor (bkz. checkPrice) — diğerleri (once_per_bar vb.)
  // sunucu taraflı izleme geldiğinde tamamlanacak, bkz. gorevler3.md Görev 7.
  function _extraOpts(opts = {}) {
    return {
      condition: opts.condition || 'crossing',
      triggerMode: opts.triggerMode || 'once',
      expiresAt: opts.expiresAt ?? null,
      message: opts.message || '',
      notifyToast: opts.notifyToast !== false,
      notifyTelegram: !!opts.notifyTelegram, // bkz. modül başlığı — henüz GÖNDERMİYOR, sadece tercih olarak kaydediliyor
      tf: opts.tf || '', // Görev 13 — alarm listesinde "SYMBOL, TF" gösterimi için, sadece görsel
      name: opts.name || '', // TV'nin "Alert name" alanı — henüz sadece kaydediliyor/gösteriliyor
    };
  }

  function createFromDrawing(symbol, exchange, drawing, opts = {}) {
    if (!drawing || !SUPPORTED_TOOLS.includes(drawing.tool)) return null;
    const price = computeDrawingPrice(drawing);
    if (price == null || isNaN(price)) return null;
    return _addAlert({ symbol, exchange: exchange || 'binance', price, sourceDrawingId: drawing.id, sourceTool: drawing.tool, ..._extraOpts(opts) });
  }

  /** condition: 'above' | 'below' | 'crossing' */
  function createManual(symbol, exchange, price, condition = 'crossing', opts = {}) {
    if (price == null || isNaN(price)) return null;
    return _addAlert({ symbol, exchange: exchange || 'binance', price: parseFloat(price), sourceTool: null, ..._extraOpts({ ...opts, condition }) });
  }

  function removeAlert(id) {
    const idx = _alerts.findIndex(a => a.id === id);
    if (idx === -1) return false;
    _alerts.splice(idx, 1);
    _save();
    _emit('alert:removed', { id });
    return true;
  }

  // gorevler2.md Görev 13 (2026-08-11) — Alarm listesi UI'ından düzenleme.
  // Sadece belirtilen alanlar güncellenir (kısmi patch). Manuel (çizim
  // kaynaksız) alarmda `price` de değiştirilebilir; çizim kaynaklı alarmda
  // fiyat zaten `_resolveTriggerPrice`'tan canlı geliyor, elle değiştirmek
  // bir sonraki `checkPrice()`'ta hemen ezilir — bu yüzden UI, kaynak
  // çizimi olan alarmlarda fiyat alanını göstermemeli (zaten Create Alert
  // modalı bunu yapıyor). Düzenlenince `triggered`/`lastKnownPrice` SIFIRLANIR
  // — kullanıcı bilinçli olarak alarmı yeniden "canlandırmış" sayılır.
  function updateAlert(id, fields = {}) {
    const alert = _alerts.find(a => a.id === id);
    if (!alert) return null;
    const ALLOWED = ['price', 'condition', 'triggerMode', 'expiresAt', 'message', 'notifyToast', 'notifyTelegram', 'active', 'tf', 'name'];
    ALLOWED.forEach(k => { if (fields[k] !== undefined) alert[k] = fields[k]; });
    alert.triggered = false;
    alert.lastKnownPrice = null;
    _save();
    _emit('alert:updated', alert);
    return alert;
  }

  function _beep(volumePct) {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.value = Math.max(0, Math.min(1, (volumePct ?? 50) / 100)) * 0.2;
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.18);
      osc.onended = () => ctx.close();
    } catch (_) {}
  }

  function checkPrice(symbol, price) {
    if (price == null || isNaN(price)) return;
    let changed = false;
    _alerts.forEach(a => {
      if (a.symbol !== symbol || a.triggered || !a.active) return;

      // Süresi dolmuşsa (Expiration — TradingView modalındaki alan) bir daha
      // hiç kontrol etmeden pasif işaretle.
      if (a.expiresAt && Date.now() > a.expiresAt) {
        a.active = false;
        changed = true;
        return;
      }

      // Eğik çizgiden gelen alarmlarda tetik seviyesi HER kontrolde yeniden
      // hesaplanır (bkz. _resolveTriggerPrice) — çizgi zamanla/sürüklenince
      // değişse de alarm onu takip eder. a.price, render/gösterim için
      // güncel tutulur.
      const triggerPrice = _resolveTriggerPrice(a);
      if (triggerPrice == null || isNaN(triggerPrice)) return;
      if (triggerPrice !== a.price) { a.price = triggerPrice; changed = true; }

      if (a.lastKnownPrice == null) { a.lastKnownPrice = price; changed = true; return; }
      const crossedUp   = a.lastKnownPrice < triggerPrice && price >= triggerPrice;
      const crossedDown = a.lastKnownPrice > triggerPrice && price <= triggerPrice;
      const fires = a.condition === 'above' ? crossedUp
                  : a.condition === 'below' ? crossedDown
                  : (crossedUp || crossedDown);
      if (fires) {
        // triggerMode: şu an sadece 'once' fiilen destekleniyor — tetiklenince
        // pasif olur. 'once_per_bar' vb. sunucu taraflı izleme gelince
        // tamamlanacak (bkz. gorevler3.md Görev 7), UI'da seçilebilir ama
        // seçilse de bu turda 'once' gibi davranır.
        a.triggered = true;
        a.triggeredAt = Date.now();
        changed = true;
        _emit('alert:triggered', a);
        const msg = a.message ? a.message : `Alert: ${a.symbol} crossed ${triggerPrice}`;
        if (a.notifyToast !== false && window.Toast) {
          const dur = _prefs.autoHideToasts === false ? 15000 : 3000;
          Toast.show(msg, 'info', dur);
        }
        if (_prefs.alertVolume !== false) _beep(_prefs.alertVolumeLevel);
        // Telegram: henüz göndermiyor (sunucu taraflı bot entegrasyonu bekleniyor,
        // bkz. gorevler3.md Görev 7) — tercih burada sadece işaretli kalıyor.
      } else {
        a.lastKnownPrice = price;
      }
    });
    if (changed) _save();
  }

  if (typeof EventBus !== 'undefined') {
    EventBus.on('mds:tick', ({ symbol, price }) => checkPrice(symbol, price));

    // Chart Settings > Alerts sekmesindeki ayarlar (chart-pane.js applySettings
    // yerine) buraya, global tek tercih setine yönlendiriliyor — bkz. modül
    // başlığı notu.
    EventBus.on('settings:apply', ({ state }) => {
      if (!state) return;
      const keys = ['alertLines', 'alertLinesColor', 'onlyActiveAlerts', 'alertVolume', 'alertVolumeLevel', 'autoHideToasts'];
      const partial = {};
      let has = false;
      keys.forEach(k => { if (state[k] != null) { partial[k] = state[k]; has = true; } });
      if (has) setPrefs(partial);
    });
  }

  return { getAlerts, createFromDrawing, createManual, updateAlert, removeAlert, getPrefs, setPrefs, checkPrice, computeDrawingPrice, formatPrice, SUPPORTED_TOOLS };
})();

window.AlertStore = AlertStore;
