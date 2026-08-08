/**
 * BotEngine — shared REST rate-limit queue for all scanner bots.
 *
 * Narrow scope (Görev 5, 2026-08-07): a single shared queue that ALL bots'
 * one-off REST requests go through, so N bots never sum to N independent
 * polling loops (see dokumentasyon/SISTEM-GENEL-DEGERLENDIRME.md §5.4).
 * Live/streaming data should go through MarketDataStore, not this queue —
 * this is only for REST calls (e.g. one-time backfills).
 *
 * A ban/rate-limit signal from ANY bot pauses the queue for ALL bots —
 * the shared budget is the point. Callers must reject with an Error whose
 * message starts with 'BAN_SIGNAL' when they detect a 429/418 response
 * (matches the existing convention in m1hammer-scanner.js).
 *
 * Common Signal envelope — for FUTURE bots (Kom1/Kom2/Kom3, MA/V3/4S) to
 * adopt, documented here as a forward-looking contract, not enforced by
 * code:
 *   {
 *     botId:      string,   // 'kom1' | 'kom2' | 'kom3' | ...
 *     symbol:     string,   // 'BTCUSDT'
 *     exchange:   'binance' | 'bybit',
 *     timestamp:  number,   // epoch ms
 *     signalType: string,   // bot-specific label
 *     payload:    object,   // bot-specific fields
 *   }
 * FR (scalpFRMonitor) and M1Hammer (window.m1HammerSignals) keep their
 * existing, already-working, UI-coupled shapes for now — both are already
 * ban-safe (FR is event-driven off MarketDataStore, M1Hammer's only REST
 * usage is the one-off backfill now routed through this queue). Migrating
 * their signal shape to the envelope above is a separate future cleanup,
 * not required for the ban-risk goal of Görev 5.
 */
const BotEngine = (() => {
  const MIN_DELAY_MS = 150; // matches m1hammer-scanner.js's previous backfill throttle

  let _queue     = [];
  let _draining  = false;
  let _paused    = false;
  let _pauseReason = null;

  function _emit(event, data) {
    if (typeof EventBus !== 'undefined') EventBus.emit(event, data);
  }

  /**
   * Queue a REST request through the shared budget.
   * @param {() => Promise<any>} fn
   * @returns {Promise<any>} resolves/rejects with fn's own result
   */
  function queueRestRequest(fn) {
    return new Promise((resolve, reject) => {
      if (_paused) { reject(new Error(_pauseReason || 'BAN_SIGNAL_PAUSED')); return; }
      _queue.push({ fn, resolve, reject });
      _drain();
    });
  }

  async function _drain() {
    if (_draining) return;
    _draining = true;
    while (_queue.length > 0 && !_paused) {
      const { fn, resolve, reject } = _queue.shift();
      try {
        const result = await fn();
        resolve(result);
      } catch (err) {
        if (String(err?.message).startsWith('BAN_SIGNAL')) {
          _pause(err.message);
          reject(err);
          break;
        }
        reject(err);
      }
      await new Promise(r => setTimeout(r, MIN_DELAY_MS));
    }
    _draining = false;
  }

  function _pause(reason) {
    _paused = true;
    _pauseReason = reason;
    // Drop remaining queued requests instead of silently hanging — every
    // caller gets a rejection and can decide what to do (mirrors
    // m1hammer-scanner.js stopping its own scan on a ban signal).
    const dropped = _queue.splice(0, _queue.length);
    dropped.forEach(({ reject }) => reject(new Error(reason)));
    console.error(`[BotEngine] ⛔ Kuyruk duraklatıldı — ban/rate-limit sinyali (${reason}). Bekleyen tüm istekler iptal edildi. Güvenli olduğunu doğrulamadan BotEngine.resume() çağırma.`);
    _emit('botengine:paused', { reason });
  }

  /** Manual resume after confirming it's safe (e.g. after a ban clears). */
  function resume() {
    if (!_paused) return;
    _paused = false;
    _pauseReason = null;
    console.log('[BotEngine] Devam ediliyor.');
    _drain();
  }

  function isPaused() { return _paused; }

  return { queueRestRequest, resume, isPaused };
})();

window.BotEngine = BotEngine;
