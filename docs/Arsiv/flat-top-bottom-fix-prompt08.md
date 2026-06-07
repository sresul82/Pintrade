if (d.tool === 'flattopbottom' && d.p1 && d.p2) {
  const a = _pt2xy(d.p1, pane);
  const b = _pt2xy(d.p2, pane);
  if (!a || !b) return false;

  const ftbTolerance = 5;  // ← 10'dan 5'e düşürüldü

  if (Math.hypot(x - a.x, y - a.y) <= ftbTolerance) return 'p1';
  if (Math.hypot(x - b.x, y - b.y) <= ftbTolerance) return 'p2';

  if (d.p3) {
    const flatY = pane.series.priceToCoordinate(d.p3.price);
    if (flatY != null && isFinite(flatY)) {
      const leftX  = a.x;
      const rightX = b.x;
      const minX   = Math.min(leftX, rightX);
      const maxX   = Math.max(leftX, rightX);

      if (Math.hypot(x - leftX,  y - flatY) <= ftbTolerance) return 'ftb_left';
      if (Math.hypot(x - rightX, y - flatY) <= ftbTolerance) return 'ftb_right';
      if (Math.abs(y - flatY) <= ftbTolerance && x >= minX - ftbTolerance && x <= maxX + ftbTolerance) {
        return 'ftb_hline';
      }
    }
  }

  if (_distToSegment(x, y, a.x, a.y, b.x, b.y) <= ftbTolerance) return 'line';

  return false;
}