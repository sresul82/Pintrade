// ── Text label ──────────────────────────────────
      const ftbText = s.text || '';
      const hasText = !!ftbText;

      if (hasText) {
        const textAlignH = s.textAlignH || 'center';
        const textAlignV = s.textAlignV || 'top';

        // Her zaman orijinal p1(a) ve p2(b) — slantA/B değil, extend'den etkilenmez
        const tH = textAlignH === 'left' ? 0.05 : textAlignH === 'right' ? 0.95 : 0.5;

        // Eğimli çizgi: a → b (extend edilmemiş orijinal noktalar)
        const slantPt = {
          x: a.x + (b.x - a.x) * tH,
          y: a.y + (b.y - a.y) * tH
        };

        // Yatay çizgi: flatLeft → flatRight (hLeft/hRight değil, extend edilmemiş)
        const flatPt = {
          x: flatLeft + (flatRight - flatLeft) * tH,
          y: flatY
        };

        let anchorX, anchorY, rawAngle;

        if (textAlignV === 'top') {
          anchorX  = flatPt.x;
          anchorY  = flatPt.y;
          rawAngle = 0;
        } else if (textAlignV === 'bottom') {
          anchorX  = slantPt.x;
          anchorY  = slantPt.y;
          rawAngle = Math.atan2(b.y - a.y, b.x - a.x);  // a/b kullan
        } else {
          anchorX  = (flatPt.x + slantPt.x) / 2;
          anchorY  = (flatPt.y + slantPt.y) / 2;
          rawAngle = Math.atan2(b.y - a.y, b.x - a.x) / 2;  // a/b kullan
        }

        let drawAngle = rawAngle;
        if (drawAngle > Math.PI / 2 || drawAngle < -Math.PI / 2) drawAngle += Math.PI;

        ctx.save();
        ctx.globalAlpha = 1;
        ctx.font      = `${s.italic ? 'italic ' : ''}${s.bold ? 'bold ' : ''}${s.fontSize || 13}px "JetBrains Mono", sans-serif`;
        ctx.fillStyle = s.textColor || '#d1d4dc';
        ctx.translate(anchorX, anchorY);
        ctx.rotate(drawAngle);
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(ftbText, 0, -4);
        ctx.restore();
      }