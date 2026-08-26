/**
 * PinTrade V2.4 - Drawing Fibonacci and Gann Tools Module
 * 
 * Handles the rendering of all tools in the "Gann and Fibonacci Tools" group.
 */

window.DrawingFibo = (() => {

  function _pt2xy(pt, pane) {
    if (window.DrawingManager && window.DrawingManager.utils) {
      return window.DrawingManager.utils.pt2xy(pt, pane);
    }
    return null;
  }

  function _xy2pt(xy, pane) {
    if (window.DrawingManager && window.DrawingManager.utils) {
      return window.DrawingManager.utils.xy2pt(xy, pane);
    }
    return null;
  }

  function _formatPrice(price) {
    if (window.DrawingManager && window.DrawingManager.utils) {
      return window.DrawingManager.utils.formatPrice(price);
    }
    return price.toFixed(2);
  }

  // BUG: _drawFibSpeedfan bu fonksiyonu tanımsız bir global olarak
  // çağırıyordu — `_extendToEdge` sadece drawing-core.js ve
  // drawing-trend.js'in KENDİ kapalı (IIFE) scope'larında tanımlıydı, bu
  // dosyanın (ayrı bir IIFE) erişimi yoktu. Sonuç: fan çizgileri
  // hesaplanırken `ReferenceError` fırlıyordu, render döngüsündeki try/catch
  // bunu yutuyordu — arkaplan dolgusu ve grid çiziliyordu ama asıl "fan"
  // (merkezden ışınsal) çizgileri hiç çizilmiyordu (bkz. kullanıcı ekran
  // görüntüsü: sadece renkli yatay bantlar + beyaz kesikli grid görünüyordu).
  function _extendToEdge(x1, y1, x2, y2, w, h) {
    const dx = x2 - x1, dy = y2 - y1;
    if (dx === 0 && dy === 0) return { x: x2, y: y2 };
    let t = Infinity;
    if (dx > 0) t = Math.min(t, (w - x1) / dx);
    if (dx < 0) t = Math.min(t, -x1 / dx);
    if (dy > 0) t = Math.min(t, (h - y1) / dy);
    if (dy < 0) t = Math.min(t, -y1 / dy);
    return { x: x1 + dx * t, y: y1 + dy * t };
  }

  // ── TEK DOĞRULUK KAYNAĞI: "ilk tıklanan nokta hangi seviyede?" ──────────
  // Bu projede İKİ KEZ aynı hata sınıfı yaşandı: çizim (bu dosya) ile
  // tıklama-algılama (drawing-core.js) birbirinden BAĞIMSIZ kopya formüllerle
  // hesaplanıyordu, biri güncellenince diğeri unutuluyordu. Artık İKİSİ DE
  // SADECE bu fonksiyonu çağırıyor — aralarında sapma fiziksel olarak
  // mümkün değil.
  //
  // Varsayılan (reverse=false, yani "Reverse" kutusu İŞARETLİ DEĞİLKEN):
  //   İLK tıklanan nokta (a) = seviye 1
  //   İKİNCİ tıklanan nokta (b) = seviye 0
  // Kullanıcı "Reverse" kutusunu işaretlerse klasik/ters okumaya döner:
  //   a = seviye 0, b = seviye 1
  //
  // NOT: Bu davranış "Reverse" adlı kullanıcıya açık bir ayarı AÇMADAN elde
  // ediliyor — checkbox varsayılan olarak kapalı kalır (kullanıcı bunu hiç
  // istemedi, sadece "ilk tık = 1" istedi).
  function _fibAxis(aVal, bVal, reverse) {
    return reverse
      ? { base: aVal, span: bVal - aVal }   // klasik: a=0, b=1
      : { base: bVal, span: aVal - bVal };  // varsayılan: a=1, b=0
  }

  // fib-ext/fib-channel/fib-timezone iki-nokta değil, ÜÇÜNCÜ bir çapa
  // noktasından (p3, vektör vb.) projekte ediyor — _fibAxis'in iki-değerli
  // imzasına birebir sığmıyor, o yüzden bu üçü kendi "reverse ? -x : x"
  // formüllerini kullanıyordu. Bu ortak parçayı (fark değerinin işaretini
  // çevirme) tek yere taşıyoruz — çapa kaymasının kendisi (varsa) her
  // araca özgü kalır, aşağıdaki her kullanım yerinde ayrıca belirtilir.
  function _reverseSpan(diffVal, reverse) {
    return reverse ? -diffVal : diffVal;
  }

  // Seviye satırındaki renk düğmesine tıklanınca açılan popup (bkz.
  // drawing-settings-dialog.js js-fib-color handler) her seviye için
  // `lvl.width`/`lvl.style` kaydediyordu, ama çizim fonksiyonları (Fib
  // Speed Fan hariç) bunu HİÇ okumuyordu — sadece tüm seviyeler için
  // ortak `s.levelsWidth`/`s.levelsStyle` kullanılıyordu. Yani bir
  // seviyenin çizgi tipini/kalınlığını değiştirmenin çizim üzerinde
  // hiçbir etkisi olmuyordu. Artık her seviye kendi width/style'ını
  // (varsa) kullanıyor, yoksa ortak ayara düşüyor.
  function _levelLineStyle(s, lvl) {
    const width = lvl.width || s.levelsWidth || s.width || 1;
    const style = lvl.style || s.levelsStyle || 'solid';
    const dash  = style === 'dashed' ? [8, 5] : style === 'dotted' ? [3, 3] : [];
    return { width, dash };
  }

  // Common Fib Levels helper - extracted from core if needed or replicated here
  function _getFibLevels(styleObj) {
    // Standard default levels if none provided
    const defaults = [
      { v: 0, color: '#787b86' },
      { v: 0.236, color: '#f44336' },
      { v: 0.382, color: '#81c784' },
      { v: 0.5, color: '#4caf50' },
      { v: 0.618, color: '#009688' },
      { v: 0.786, color: '#64b5f6' },
      { v: 1, color: '#787b86' }
    ];
    // BUG (2026-08-01): burada yanlışlıkla `styleObj.levels` okunuyordu ama
    // ayar diyaloğu (dsd-fibo-tabs.js) ve kaydetme mantığı (dsd-apply.js)
    // her yerde `styleObj.fibLevels` kullanıyor. `.levels` hiçbir zaman
    // set edilmediği için bu fonksiyon HER ZAMAN aşağıdaki sabit 7 seviyeye
    // düşüyordu — kullanıcının menüde yaptığı hiçbir Level değişikliği
    // (tik/değer/renk) grafiğe hiç yansımıyordu.
    if (styleObj && styleObj.fibLevels && Array.isArray(styleObj.fibLevels)) {
      return styleObj.fibLevels;
    }
    return defaults;
  }

  function _drawFibRet(ctx, d, pane) {
      if (!d.p1 || !d.p2) return;
      const p1 = _pt2xy(d.p1, pane);
      const p2 = _pt2xy(d.p2, pane);
      if (!p1 || !p2) return;
  
      const s = d.style || {};
  
      // ── Default levels ───────────────────────────────────────────
      const allLevels = _getFibLevels(s);
      const activeLevels = allLevels.filter(l => l.active !== false);
      // Sort by value
      const sorted = [...activeLevels].sort((a, b) => a.v - b.v);
      // "Reverse" kutusu varsayılan KAPALI — kapalıyken bile ilk tıklanan
      // nokta seviye 1 olur (bkz. _fibAxis üstteki açıklama).
      const reverse = !!s.fibReverse;

      const extendLeft  = !!s.extendLeft;
      const extendRight = !!s.extendRight;
      const W = pane.drawingCanvas.width  / (window.devicePixelRatio || 1);
      const H = pane.drawingCanvas.height / (window.devicePixelRatio || 1);
      const leftX  = extendLeft  ? 0 : Math.min(p1.x, p2.x);
      const rightX = extendRight ? W : Math.max(p1.x, p2.x);

      const fibBg    = s.fibBg !== false;
      const bgAlpha  = s.fibBgAlpha !== undefined ? s.fibBgAlpha : 0.2;
      const fontSize = s.fibFontSize || 11;
      const labelsH  = s.fibLabelsH  || 'Left';
      const labelsV  = s.fibLabelsV  || 'Top';
      const showPrices = s.fibPrices !== false;
      const levelMode  = s.fibLevelsMode || 'Values'; // 'Values' | 'Percents'
      const showLabels = s.fibLevelsType !== false;
  
      // ── Draw trend line (p1 → p2) ─────────────────────────────
      ctx.save();
      ctx.strokeStyle = s.trendLineActive !== false ? (s.trendLineColor || s.color || '#787b86') : 'transparent';
      ctx.lineWidth   = s.trendLineWidth || s.width || 1;
      const tlStyle   = s.trendLineStyle || 'dashed';
      ctx.setLineDash(tlStyle === 'dashed' ? [6, 4] : tlStyle === 'dotted' ? [2, 3] : []);
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
      ctx.restore();
  
      const yAxis = _fibAxis(p1.y, p2.y, reverse);
      const priceAxis = _fibAxis(d.p1.price, d.p2.price, reverse);
      const effP1Y = yAxis.base;
      const effYDiff = yAxis.span;
      const effP1Price = priceAxis.base;
      const effPriceDiff = priceAxis.span;

      // ── "Fib levels based on log scale" ───────────────────────
      // Eskiden bu ayar (s.fibLogScale) hiç okunmuyordu — checkbox işaretini
      // değiştirmenin çizim üzerinde HİÇBİR etkisi yoktu. Şimdi: kapalıyken
      // seviyeler iki fiyat arasında ARİTMETİK (eşit fiyat farkı) aralıklarla,
      // açıkken GEOMETRİK (eşit yüzde/oran) aralıklarla hesaplanıyor — ikinci
      // yöntem düşük fiyatlı/log ölçekli grafiklerde daha anlamlı sonuç verir.
      const logScale = !!s.fibLogScale;
      const effP2Price = effP1Price + effPriceDiff;
      function _fibPriceAt(v) {
        if (logScale && effP1Price > 0 && effP2Price > 0) {
          return effP1Price * Math.pow(effP2Price / effP1Price, v);
        }
        return effP1Price + effPriceDiff * v;
      }
      function _fibYAt(v) {
        if (logScale && effP1Price > 0 && effP2Price > 0) {
          const py = pane.series?.priceToCoordinate?.(_fibPriceAt(v));
          if (py != null && isFinite(py)) return py;
        }
        return effP1Y + effYDiff * v;
      }

      // ── Draw backgrounds between adjacent active levels ───────
      if (fibBg && sorted.length > 1) {
        ctx.save();
        for (let i = 1; i < sorted.length; i++) {
          const prevY = _fibYAt(sorted[i-1].v);
          const thisY = _fibYAt(sorted[i].v);
          ctx.fillStyle = (s.useOneColor && s.useOneColor !== false ? s.useOneColor : sorted[i].color) || '#4caf50';
          ctx.globalAlpha = bgAlpha;
          ctx.fillRect(leftX, Math.min(prevY, thisY), rightX - leftX, Math.abs(thisY - prevY));
        }
        ctx.restore();
      }
  
      // ── Label alignment helpers ───────────────────────────────
      const textX = labelsH === 'Right' ? rightX - 4 : labelsH === 'Center' ? (leftX + rightX) / 2 : leftX + 4;
      const textAlign = labelsH === 'Right' ? 'right' : labelsH === 'Center' ? 'center' : 'left';

      ctx.save();
      ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, "Trebuchet MS", Roboto, Ubuntu, sans-serif`;

      // ── Draw each active level ────────────────────────────────
      for (const lvl of sorted) {
        const ly = _fibYAt(lvl.v);
        if (ly < -20 || ly > H + 20) continue; // clip

        // Horizontal level line — her seviye kendi width/style'ını kullanır
        const { width: lvlWidth, dash: lvlDash } = _levelLineStyle(s, lvl);
        ctx.strokeStyle = (s.useOneColor && s.useOneColor !== false ? s.useOneColor : lvl.color) || '#787b86';
        ctx.lineWidth   = lvlWidth;
        ctx.setLineDash(lvlDash);
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.moveTo(leftX, ly);
        ctx.lineTo(rightX, ly);
        ctx.stroke();
  
        // Label
        if (showLabels || showPrices) {
          ctx.setLineDash([]);
          ctx.fillStyle = (s.useOneColor && s.useOneColor !== false ? s.useOneColor : lvl.color) || '#787b86';
          ctx.textAlign = textAlign;
  
          const valStr   = showLabels ? (levelMode === 'Percents' ? `${(lvl.v * 100).toFixed(1)}%` : lvl.v.toFixed(3)) : '';
          const priceAt  = _fibPriceAt(lvl.v);
          // Eskiden .toFixed(2) sabitti — düşük fiyatlı coinlerde (ör.
          // 0.00001234) neredeyse tüm anlamlı basamakları siliyordu ve
          // fiyat grafikteki gerçek fiyatı yansıtmıyormuş gibi görünüyordu.
          // Artık grafiğin kendi dinamik ondalık formatlayıcısı kullanılıyor.
          const priceStr = showPrices ? (showLabels ? ` (${_formatPrice(priceAt)})` : _formatPrice(priceAt)) : '';
          const label    = valStr + priceStr;

          // Eskiden "Middle" seçili olsa bile metin her zaman çizginin
          // ÜSTÜNDE duruyordu (aynı Top gibi davranıyordu, textBaseline hiç
          // 'middle' olmuyordu) — artık çizginin tam üzerinde ortalanıyor.
          const textY = labelsV === 'Top'    ? ly - 3
                      : labelsV === 'Bottom' ? ly + fontSize + 2
                      :                        ly; // Middle — çizginin üzerinde ortalanır
          ctx.textBaseline = labelsV === 'Bottom' ? 'top' : labelsV === 'Middle' ? 'middle' : 'bottom';
          ctx.fillText(label, textX, textY);
        }
      }
      ctx.restore();
    }

  function _drawFibExt(ctx, d, pane) {
      if (!d.p1 || !d.p2) return;
      const p1 = _pt2xy(d.p1, pane);
      const p2 = _pt2xy(d.p2, pane);
      if (!p1 || !p2) return;
      if (!d.p3) {
        ctx.save();
        ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y);
        ctx.strokeStyle = '#787b86'; ctx.lineWidth = 1; ctx.setLineDash([5, 5]); ctx.stroke();
        ctx.restore();
        return;
      }
      const p3 = _pt2xy(d.p3, pane);
      if (!p3) return;
  
      const s = d.style || {};
      const allLevels = _getFibLevels(s);
      const activeLevels = allLevels.filter(l => l.active !== false);
      const sorted = [...activeLevels].sort((a, b) => a.v - b.v);
      // "Reverse" kutusu varsayılan KAPALI (bkz. dosya başındaki _fibAxis/
      // _reverseSpan açıklaması — dsd-fibo-tabs.js ve drawing-core.js
      // hit-test'iyle aynı varsayılan olmalı).
      const reverse = !!s.fibReverse;

      const extendLeft  = !!s.extendLeft;
      const extendRight = !!s.extendRight;
      const showLabels = s.fibLevelsType !== false;
      const showPrices = s.fibPrices !== false;
      const levelMode  = s.fibLevelsMode === 'Percents' ? 'Percents' : 'Values';
      const fibBg    = s.fibBg !== false;
      const bgAlpha  = s.fibBgAlpha !== undefined ? s.fibBgAlpha : 0.2;
      const fontSize = s.fibFontSize || 11;
      const labelsH  = s.fibLabelsH  || 'Left';
      const labelsV  = s.fibLabelsV  || 'Top';
      const W = pane.drawingCanvas.width / (window.devicePixelRatio || 1);
      const H = pane.drawingCanvas.height / (window.devicePixelRatio || 1);
      const leftX  = extendLeft ? 0 : Math.min(p1.x, p2.x, p3.x);
      const rightX = extendRight ? W : Math.max(p1.x, p2.x, p3.x) + 150;
  
      // Base lines — "Trend line" checkbox/renk düğmesi `trendLineActive/
      // trendLineColor/trendLineWidth/trendLineStyle` kaydediyordu
      // (bkz. drawing-settings-dialog.js ~1433), ama burada yanlış
      // property adları (`trendColor/trendWidth/trendStyle`) okunuyordu —
      // hiçbiri hiç set edilmediği için ayardan bağımsız hep aynı sabit
      // (kesikli, gri) çizgi çiziliyordu.
      ctx.save();
      const tlActive = s.trendLineActive !== false;
      ctx.strokeStyle = tlActive ? (s.trendLineColor || s.color || '#787b86') : 'transparent';
      ctx.lineWidth = s.trendLineWidth || s.width || 1;
      const tlStyle = s.trendLineStyle || 'dashed';
      ctx.setLineDash(tlStyle === 'dashed' ? [6, 4] : tlStyle === 'dotted' ? [2, 3] : []);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.lineTo(p3.x, p3.y);
      ctx.stroke();

      const yDiff = p2.y - p1.y;
      const priceDiff = d.p2.price - d.p1.price;
      const effYDiff = _reverseSpan(yDiff, reverse);
      const effP3Y = reverse ? p3.y + yDiff : p3.y;
      const effPriceDiff = _reverseSpan(priceDiff, reverse);
      const effP3Price = reverse ? d.p3.price + priceDiff : d.p3.price;
  
      if (fibBg && sorted.length > 1) {
        for (let i = 1; i < sorted.length; i++) {
          const prevY = effP3Y + effYDiff * sorted[i-1].v;
          const thisY = effP3Y + effYDiff * sorted[i].v;
          ctx.fillStyle = (s.useOneColor && s.useOneColor !== false ? s.useOneColor : sorted[i].color) || '#4caf50';
          ctx.globalAlpha = bgAlpha;
          ctx.fillRect(leftX, Math.min(prevY, thisY), rightX - leftX, Math.abs(thisY - prevY));
        }
      }
  
      const textX = labelsH === 'Right' ? rightX - 4 : labelsH === 'Center' ? (leftX + rightX) / 2 : leftX + 4;
      const textAlign = labelsH === 'Right' ? 'right' : labelsH === 'Center' ? 'center' : 'left';
      ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, "Trebuchet MS", Roboto, Ubuntu, sans-serif`;

      for (const lvl of sorted) {
        const ly = effP3Y + effYDiff * lvl.v;
        if (ly < -20 || ly > H + 20) continue;

        const { width: lvlWidth, dash: lvlDash } = _levelLineStyle(s, lvl);
        ctx.strokeStyle = (s.useOneColor && s.useOneColor !== false ? s.useOneColor : lvl.color) || '#787b86';
        ctx.lineWidth   = lvlWidth;
        ctx.setLineDash(lvlDash);
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.moveTo(leftX, ly);
        ctx.lineTo(rightX, ly);
        ctx.stroke();
  
        if (showLabels || showPrices) {
          ctx.setLineDash([]);
          ctx.fillStyle = (s.useOneColor && s.useOneColor !== false ? s.useOneColor : lvl.color) || '#787b86';
          ctx.textAlign = textAlign;
          const valStr   = showLabels ? (levelMode === 'Percents' ? `${(lvl.v * 100).toFixed(1)}%` : lvl.v.toFixed(3)) : '';
          const priceAt  = effP3Price + effPriceDiff * lvl.v;
          const priceStr = showPrices ? (showLabels ? ` (${_formatPrice(priceAt)})` : _formatPrice(priceAt)) : '';
          const label    = valStr + priceStr;
          const textY = labelsV === 'Top' ? ly - 3 : labelsV === 'Bottom' ? ly + fontSize + 2 : ly;
          ctx.textBaseline = labelsV === 'Bottom' ? 'top' : labelsV === 'Middle' ? 'middle' : 'bottom';
          ctx.fillText(label, textX, textY);
        }
      }
      ctx.restore();
    }

  function _drawFibChannel(ctx, d, pane) {
      if (!d.p1 || !d.p2) return;
      const p1 = _pt2xy(d.p1, pane);
      const p2 = _pt2xy(d.p2, pane);
      if (!p1 || !p2) return;
      if (!d.p3) {
        ctx.save();
        ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y);
        ctx.strokeStyle = '#787b86'; ctx.lineWidth = 1; ctx.setLineDash([5, 5]); ctx.stroke();
        ctx.restore();
        return;
      }
      const p3 = _pt2xy(d.p3, pane);
      if (!p3) return;
  
      const s = d.style || {};
      const allLevels = _getFibLevels(s);
      const activeLevels = allLevels.filter(l => l.active !== false);
      const sorted = [...activeLevels].sort((a, b) => a.v - b.v);
      // "Reverse" kutusu varsayılan KAPALI (bkz. dosya başındaki _fibAxis/
      // _reverseSpan açıklaması — dsd-fibo-tabs.js ve drawing-core.js
      // hit-test'iyle aynı varsayılan olmalı).
      const reverse = !!s.fibReverse;

      const fibBg    = s.fibBg !== false;
      const bgAlpha  = s.fibBgAlpha !== undefined ? s.fibBgAlpha : 0.2;
      const showPrices = s.fibPrices !== false;

      ctx.save();

      // Trend line (p1→p2) — "Trend line" checkbox/renk düğmesi
      // `trendLineActive/trendLineColor/trendLineWidth/trendLineStyle`
      // kaydediyordu ama bu fonksiyon hiçbir zaman bir taban çizgisi
      // çizmiyordu — ayar hiçbir şeye etki etmiyordu.
      const tlActive = s.trendLineActive !== false;
      if (tlActive) {
        ctx.strokeStyle = s.trendLineColor || s.color || '#787b86';
        ctx.lineWidth = s.trendLineWidth || s.width || 1;
        const tlStyle = s.trendLineStyle || 'dashed';
        ctx.setLineDash(tlStyle === 'dashed' ? [6, 4] : tlStyle === 'dotted' ? [2, 3] : []);
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }

      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;

      // Vector from line(p1,p2) to p3
      // We treat p1 as origin for projection
      const px3 = p3.x - p1.x;
      const py3 = p3.y - p1.y;

      const effPx3 = _reverseSpan(px3, reverse);
      const effPy3 = _reverseSpan(py3, reverse);

      if (fibBg && sorted.length > 1) {
        for (let i = 1; i < sorted.length; i++) {
          const v1 = sorted[i-1].v;
          const v2 = sorted[i].v;
          ctx.fillStyle = (s.useOneColor && s.useOneColor !== false ? s.useOneColor : sorted[i].color) || '#4caf50';
          ctx.globalAlpha = bgAlpha;
          ctx.beginPath();
          ctx.moveTo(p1.x + effPx3*v1, p1.y + effPy3*v1);
          ctx.lineTo(p2.x + effPx3*v1, p2.y + effPy3*v1);
          ctx.lineTo(p2.x + effPx3*v2, p2.y + effPy3*v2);
          ctx.lineTo(p1.x + effPx3*v2, p1.y + effPy3*v2);
          ctx.closePath();
          ctx.fill();
        }
      }
  
      for (const lvl of sorted) {
        const lx1 = p1.x + effPx3*lvl.v;
        const ly1 = p1.y + effPy3*lvl.v;
        const lx2 = p2.x + effPx3*lvl.v;
        const ly2 = p2.y + effPy3*lvl.v;

        const { width: lvlWidth, dash: lvlDash } = _levelLineStyle(s, lvl);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = (s.useOneColor && s.useOneColor !== false ? s.useOneColor : lvl.color) || '#787b86';
        ctx.lineWidth = lvlWidth;
        ctx.setLineDash(lvlDash);
        ctx.beginPath();
        ctx.moveTo(lx1, ly1);
        ctx.lineTo(lx2, ly2);
        ctx.stroke();
  
        // BUG: burada `s.fibLabels`/`s.fibLabelsPos` okunuyordu — ayar
        // diyaloğu ve diğer tüm fib araçları `s.fibLevelsType` (Levels
        // checkbox) ve `s.fibLabelsH` (Left/Center/Right) kullanıyor. Bu
        // yüzden Labels satırındaki Left/Center/Right hiç etkili
        // olmuyordu ("Center" için hiç kod yolu bile yoktu), Percents
        // modu da hiç çalışmıyordu (`fibLevelsType` bir boolean, string
        // 'Percents'e hiç eşit olamaz). `s.fibPrices` de hiç okunmuyordu
        // — "Prices" işaretliyken bile fiyat hiç gösterilmiyordu.
        const showLabels = s.fibLevelsType !== false;
        if (showLabels || showPrices) {
          ctx.setLineDash([]);
          ctx.fillStyle = (s.useOneColor && s.useOneColor !== false ? s.useOneColor : lvl.color) || '#787b86';
          const fontSize = s.fontSize || 12;
          ctx.font = `${fontSize}px 'JetBrains Mono', sans-serif`;
          const labelsH = s.fibLabelsH || 'Left';

          // Yatay konum (Left/Center/Right): çizginin hangi ucunda/orta
          // noktasında duracağı — hem X hem Y bu noktaya göre birlikte
          // hesaplanmalı. Eskiden "Center" için X ortalanıyordu ama Y hâlâ
          // `ly1`'e (Left ucu) sabitti — sonuç, çizginin ortasında değil,
          // Left'in altında/üstünde (çizgi eğimli olduğu için) yanlış bir
          // noktada duran bir etiketti.
          const onRight = labelsH === 'Right';
          const onCenter = labelsH === 'Center';
          const refX = onRight ? lx2 : onCenter ? (lx1 + lx2) / 2 : lx1;
          const refY = onRight ? ly2 : onCenter ? (ly1 + ly2) / 2 : ly1;
          ctx.textAlign = onRight ? 'right' : onCenter ? 'center' : 'left';

          const valStr = showLabels ? (s.fibLevelsMode === 'Percents' ? `${Math.round(lvl.v * 100)}%` : lvl.v.toString()) : '';
          const priceAt = pane.series?.coordinateToPrice ? pane.series.coordinateToPrice(refY) : null;
          const priceStr = showPrices && priceAt != null ? (showLabels ? ` (${_formatPrice(priceAt)})` : _formatPrice(priceAt)) : '';
          const label = valStr + priceStr;

          // Dikey konum (Top/Middle/Bottom) seçeneği kaldırıldı — eğimli
          // çizgilerde doğru şekilde konumlandırılamadı (kullanıcı
          // isteğiyle). Etiket her zaman çizginin tam üzerinde duruyor.
          ctx.textBaseline = 'middle';

          ctx.fillText(label, refX, refY);
        }
      }

      ctx.restore();
    }

  // Vline aracının zaman ekseni etiketiyle aynı biçim (bkz.
  // drawing-trend.js _drawVLine) — ayrı bir IIFE modülde olduğu için
  // oradaki kodu paylaşamıyoruz, aynı küçük fonksiyon burada tekrarlanıyor.
  function _formatTimeLabel(t) {
    let dateObj;
    if (t && typeof t === 'object' && t.year) {
      dateObj = new Date(t.year, t.month - 1, t.day, t.hour || 0, t.minute || 0);
    } else {
      dateObj = new Date(typeof t === 'number' ? t * 1000 : t);
    }
    const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const dd = days[dateObj.getDay()];
    const d2 = String(dateObj.getDate()).padStart(2, '0');
    const mo = months[dateObj.getMonth()];
    const yr = String(dateObj.getFullYear()).slice(2);
    const hh = String(dateObj.getHours()).padStart(2, '0');
    const mm = String(dateObj.getMinutes()).padStart(2, '0');
    return `${dd} ${d2} ${mo} '${yr}  ${hh}:${mm}`;
  }

  function _drawFibTimezone(ctx, d, pane, selected) {
      if (!d.p1 || !d.p2) return;
      const p1 = _pt2xy(d.p1, pane);
      const p2 = _pt2xy(d.p2, pane);
      if (!p1 || !p2) return;

      const s = d.style || {};
      const allLevels = _getFibLevels(s);
      const activeLevels = allLevels.filter(l => l.active !== false);
      const sorted = [...activeLevels].sort((a, b) => a.v - b.v);
      // "Reverse" kutusu varsayılan KAPALI (bkz. dosya başındaki _fibAxis/
      // _reverseSpan açıklaması — dsd-fibo-tabs.js ve drawing-core.js
      // hit-test'iyle aynı varsayılan olmalı).
      const reverse = !!s.fibReverse;

      const showLabels = s.fibLevelsType !== false;
      const levelMode  = s.fibLevelsMode === 'Percents' ? 'Percents' : 'Values';
      const fibBg    = s.fibBg !== false;
      const bgAlpha  = s.fibBgAlpha !== undefined ? s.fibBgAlpha : 0.2;
      const fontSize = s.fibFontSize || 11;
      const labelsH  = s.fibLabelsH  || 'Left';
      const labelsV  = s.fibLabelsV  || 'Top';

      const H = pane.drawingCanvas.height / (window.devicePixelRatio || 1);
      const yTop = 0;
      const yBottom = H;

      const dx = p2.x - p1.x;
      const effDX = _reverseSpan(dx, reverse);
      const effP1X = reverse ? p2.x : p1.x;

      ctx.save();

      // Trend line (p1→p2) — daha önce "Trend line" checkbox/renk düğmesi
      // ayarları kaydediyordu ama hiçbir şey çizilmiyordu (grafik üzerinde
      // hiç görünmüyordu).
      const tlActive = s.trendLineActive !== false;
      if (tlActive) {
        ctx.strokeStyle = s.trendLineColor || s.color || '#787b86';
        ctx.lineWidth = s.trendLineWidth || s.width || 1;
        const tlStyle = s.trendLineStyle || 'dashed';
        ctx.setLineDash(tlStyle === 'dashed' ? [6, 4] : tlStyle === 'dotted' ? [2, 3] : []);
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }

      if (fibBg && sorted.length > 1) {
        for (let i = 1; i < sorted.length; i++) {
          const prevX = effP1X + effDX * sorted[i-1].v;
          const thisX = effP1X + effDX * sorted[i].v;
          ctx.fillStyle = (s.useOneColor && s.useOneColor !== false ? s.useOneColor : sorted[i].color) || '#4caf50';
          ctx.globalAlpha = bgAlpha;
          ctx.fillRect(Math.min(prevX, thisX), yTop, Math.abs(thisX - prevX), H);
        }
      }
  
      ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, "Trebuchet MS", Roboto, Ubuntu, sans-serif`;

      for (const lvl of sorted) {
         const x = effP1X + effDX * lvl.v;

         const { width: lvlWidth, dash: lvlDash } = _levelLineStyle(s, lvl);
         ctx.globalAlpha = 1;
         ctx.strokeStyle = (s.useOneColor && s.useOneColor !== false ? s.useOneColor : lvl.color) || '#787b86';
         ctx.lineWidth = lvlWidth;
         ctx.setLineDash(lvlDash);
         ctx.beginPath();
         ctx.moveTo(x, yTop);
         ctx.lineTo(x, yBottom);
         ctx.stroke();
         
         if (showLabels) {
            ctx.setLineDash([]);
            ctx.fillStyle = (s.useOneColor && s.useOneColor !== false ? s.useOneColor : lvl.color) || '#787b86';
            const valStr = levelMode === 'Percents' ? `${(lvl.v * 100).toFixed(1)}%` : lvl.v.toFixed(3);
            
            ctx.textAlign = labelsH === 'Right' ? 'left' : labelsH === 'Center' ? 'center' : 'right';
            const textX = labelsH === 'Right' ? x + 4 : labelsH === 'Center' ? x : x - 4;
            const textY = labelsV === 'Top' ? yTop + fontSize + 4 : labelsV === 'Bottom' ? yBottom - 4 : (yTop + yBottom) / 2;
            ctx.textBaseline = labelsV === 'Bottom' ? 'bottom' : labelsV === 'Top' ? 'top' : 'middle';
            
            ctx.fillText(valStr, textX, textY);
         }
      }

      // Araç seçiliyken, her aktif çizginin zaman ekseninde denk geldiği
      // saati göster (bkz. Vertical Line aracının zaman etiketi) —
      // seçili değilken çok sayıda seviye ekranı kirletmesin diye sadece
      // seçili olduğunda çiziliyor.
      if (selected) {
        ctx.setLineDash([]);
        ctx.font = `11px "JetBrains Mono", sans-serif`;
        for (const lvl of sorted) {
          const x = effP1X + effDX * lvl.v;
          const pt = _xy2pt({ x, y: 0 }, pane);
          if (!pt || pt.time == null) continue;
          const label = _formatTimeLabel(pt.time);
          const pad = 6;
          const tw = ctx.measureText(label).width;
          const boxW = tw + pad * 2;
          const boxH = 11 + 8;
          const bx = x - boxW / 2;
          const by = yBottom - boxH;
          const color = (s.useOneColor && s.useOneColor !== false ? s.useOneColor : lvl.color) || '#787b86';
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.roundRect(bx, by, boxW, boxH, 3);
          ctx.fill();
          ctx.fillStyle = '#000000';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(label, x, by + boxH / 2);
        }
      }
      ctx.restore();
    }

  function _drawFibSpeedfan(ctx, d, pane) {
      if (!d.p1 || !d.p2) return;
      const p1 = _pt2xy(d.p1, pane);
      const p2 = _pt2xy(d.p2, pane);
      if (!p1 || !p2) return;
  
      const s = d.style || {};
      let priceLevels = s.priceLevels;
      let timeLevels = s.timeLevels;
      if (!priceLevels) {
        const allLevels = _getFibLevels(s);
        priceLevels = allLevels.slice(0, 7);
        timeLevels = allLevels.slice(0, 7);
      }
      const actPrice = priceLevels.filter(l => l && l.active !== false).sort((a,b)=>a.v-b.v);
      const actTime = timeLevels.filter(l => l && l.active !== false).sort((a,b)=>a.v-b.v);
      
      // "Reverse" kutusu varsayılan KAPALI. Kullanıcı isteği: ilk tıklanan
      // nokta (p1 — fan'ın birleştiği köşe) her zaman "1" seviyesi, ikinci
      // nokta (p2) "0" seviyesi olsun (Fib Retracement'ta da aynı kural
      // uygulanmıştı — bkz. `_fibAxis`). Eskiden burada p1 sabit olarak
      // "0", p2 "1" idi. Fan'ın GEOMETRİK kaynağı (moveTo) her zaman p1'de
      // kalır — sadece hangi v-değerinin hangi noktaya denk geldiği
      // (etiketleme) değişiyor. Bu, hem fiyat (Y) hem zaman (X) ekseni
      // için ayrı ayrı uygulanıyor.
      const reverse = !!s.fibReverse;
      const yAxis = _fibAxis(p1.y, p2.y, reverse);
      const xAxis = _fibAxis(p1.x, p2.x, reverse);
      const priceYAt = (v) => yAxis.base + yAxis.span * v;
      const timeXAt  = (v) => xAxis.base + xAxis.span * v;
      // v=1 artık p1'in kendisi (fan'ın kaynağı) — bu seviyede grid/etiket
      // çizmek anlamsız (zaten orijin orada), eskiden bu amaçla v===0
      // atlanıyordu.
      const originV = 1;

      const showGrid = s.gridActive !== false;
      const w = pane.drawingCanvas.width / (window.devicePixelRatio || 1);
      const h = pane.drawingCanvas.height / (window.devicePixelRatio || 1);

      ctx.save();

      // Background fill
      const fibBg = s.fibBg !== false;
      const bgAlpha = s.fibBgAlpha !== undefined ? s.fibBgAlpha : 0.2;
      const bgColor = s.fibBgColor || '#2962ff';

      if (fibBg && actPrice.length > 1) {
        ctx.save();
        ctx.globalAlpha = bgAlpha;
        for (let i = 1; i < actPrice.length; i++) {
          const yPrev = priceYAt(actPrice[i-1].v);
          const yCur  = priceYAt(actPrice[i].v);
          ctx.fillStyle = s.useOneColor && s.useOneColor !== false ? s.useOneColor : actPrice[i].color || bgColor;
          ctx.fillRect(p1.x, Math.min(yPrev, yCur), w - p1.x, Math.abs(yCur - yPrev));
        }
        ctx.restore();
      }

      if (showGrid) {
         ctx.globalAlpha = 1;
         ctx.strokeStyle = s.gridColor || '#363c4e';
         const gridStyle = s.gridStyle || 'dashed';
         ctx.setLineDash(gridStyle === 'dashed' ? [8,5] : gridStyle === 'dotted' ? [3,3] : []);
         ctx.lineWidth = s.gridWidth || 1;
         for (const lvl of actPrice) {
            if (lvl.v === originV) continue;
            const y = priceYAt(lvl.v);
            ctx.beginPath();
            ctx.moveTo(p1.x, y);
            ctx.lineTo(p2.x, y);
            ctx.stroke();
         }
         for (const lvl of actTime) {
            const x = timeXAt(lvl.v);
            ctx.beginPath();
            ctx.moveTo(x, p1.y);
            ctx.lineTo(x, p2.y);
            ctx.stroke();
         }
      }

      ctx.globalAlpha = 1;
      for (const lvl of actPrice) {
        ctx.strokeStyle = (s.useOneColor && s.useOneColor !== false ? s.useOneColor : lvl.color) || '#787b86';
        ctx.lineWidth = lvl.width || 1;
        const st = lvl.style || 'solid';
        ctx.setLineDash(st === 'dashed' ? [8,5] : st === 'dotted' ? [3,3] : []);

        let pricePoint = { x: p2.x, y: priceYAt(lvl.v) };
        let extPrice = _extendToEdge(p1.x, p1.y, pricePoint.x, pricePoint.y, w, h);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(extPrice.x, extPrice.y);
        ctx.stroke();
      }

      for (const lvl of actTime) {
        ctx.strokeStyle = (s.useOneColor && s.useOneColor !== false ? s.useOneColor : lvl.color) || '#787b86';
        ctx.lineWidth = lvl.width || 1;
        const st = lvl.style || 'solid';
        ctx.setLineDash(st === 'dashed' ? [8,5] : st === 'dotted' ? [3,3] : []);

        let timePoint = { x: timeXAt(lvl.v), y: p2.y };
        let extTime = _extendToEdge(p1.x, p1.y, timePoint.x, timePoint.y, w, h);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(extTime.x, extTime.y);
        ctx.stroke();
      }

      ctx.globalAlpha = 1;
      ctx.setLineDash([]);
      ctx.font = `${s.fibFontSize || 11}px -apple-system, BlinkMacSystemFont, "Trebuchet MS", Roboto, Ubuntu, sans-serif`;

      const showLL = s.labelsLeft !== false;
      const showLR = s.labelsRight === true;
      for (const lvl of actPrice) {
        ctx.fillStyle = (s.useOneColor && s.useOneColor !== false ? s.useOneColor : lvl.color) || '#787b86';
        const valStr = lvl.v.toString();
        const y = priceYAt(lvl.v);
        if (showLL) {
           ctx.textAlign = 'right';
           ctx.textBaseline = 'bottom';
           ctx.fillText(valStr, p1.x - 4, y - 2);
        }
        if (showLR) {
           ctx.textAlign = 'left';
           ctx.textBaseline = 'bottom';
           ctx.fillText(valStr, p2.x + 4, y - 2);
        }
      }

      const showLT = s.labelsTop === true;
      const showLB = s.labelsBottom !== false;
      for (const lvl of actTime) {
        ctx.fillStyle = (s.useOneColor && s.useOneColor !== false ? s.useOneColor : lvl.color) || '#787b86';
        const valStr = lvl.v.toString();
        const x = timeXAt(lvl.v);
        if (showLB) {
           ctx.textAlign = 'left';
           ctx.textBaseline = 'top';
           ctx.fillText(valStr, x + 4, p2.y + 4);
        }
        if (showLT) {
           ctx.textAlign = 'left';
           ctx.textBaseline = 'bottom';
           ctx.fillText(valStr, x + 4, p1.y - 4);
        }
      }

      ctx.restore();
    }

  return {
    drawFibRet: _drawFibRet,
    drawFibExt: _drawFibExt,
    drawFibChannel: _drawFibChannel,
    drawFibTimezone: _drawFibTimezone,
    drawFibSpeedfan: _drawFibSpeedfan,
    // Tek doğruluk kaynağı — drawing-core.js'in hit-test'i de BUNU çağırır,
    // kendi kopyasını hesaplamaz (bkz. yukarıdaki _fibAxis açıklaması).
    fibAxis: _fibAxis,
    // fib-ext/fib-channel/fib-timezone için aynı prensip (bkz. _reverseSpan
    // yukarıdaki açıklama) — Görev-6.2, 2026-08-26.
    reverseSpan: _reverseSpan,
  };
})();
