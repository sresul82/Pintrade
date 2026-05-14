const EventBus = (() => {
  const listeners = new Map();

  function on(event, callback) {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event).add(callback);
    return () => off(event, callback);
  }

  function once(event, callback) {
    const wrapper = (data) => { callback(data); off(event, wrapper); };
    return on(event, wrapper);
  }

  function off(event, callback) {
    if (!listeners.has(event)) return;
    listeners.get(event).delete(callback);
  }

  function emit(event, data) {
    if (!listeners.has(event)) return;
    listeners.get(event).forEach(cb => {
      try { cb(data); }
      catch (e) { console.error(`[EventBus] Error in "${event}" handler:`, e); }
    });
  }

  function clear(event) {
    if (event) listeners.delete(event);
    else listeners.clear();
  }

  return { on, once, off, emit, clear };
})();

/*
  EVENTS REFERENCE
  ─────────────────────────────────────────────────────
  symbol:change       { symbol, exchange, prevSymbol }
  symbol:search       { query }

  chart:tf:change     { tf }           — timeframe changed
  chart:style:change  { style }        — candle style changed
  chart:price:update  { symbol, price, change, changePct }
  chart:bar:update    { bar }          — latest OHLCV bar
  chart:layout:change { layout }       — 1/2h/2v/2+1/4

  drawing:start       { tool }
  drawing:complete    { drawing }
  drawing:select      { id }
  drawing:delete      { id }
  drawing:update      { id, props }

  indicator:add       { type, options }
  indicator:remove    { id }
  indicator:update    { id, options }

  watchlist:tab:change { tab }         — bn-screener/bb-screener/bn-all/bb-all
  watchlist:toggle    { open }
  watchlist:select    { symbol, exchange }

  detail:tab:change   { tab }          — detail/signals/news
  detail:popout       { tab }

  alarm:triggered     { alarm }
  alarm:created       { alarm }
  alarm:deleted       { id }

  ws:connected        { exchange }
  ws:disconnected     { exchange }
  ws:error            { exchange, error }

  signal:new          { category, signal }
  coinlist:updated    { added, removed, exchange }
  theme:change        { theme }        — dark/light
*/
