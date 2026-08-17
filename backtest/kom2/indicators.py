"""
indicators.py — Kom2 backtest indicator math.

Kom1'in `js/screener/indicator-engine.js`'teki formülleriyle BİREBİR aynı
matematiği kullanan Python portları (RSI/DEMA/Heikin Ashi/Regression
Channel/WaveTrend) + Kom2'ye özel yeni indikatörler (divergence dedektörü,
OI kalıcılık testi, L/S trend/eşik varyantları, hacim derece sistemi).

Tutarlılık kuralı: calc_rsi/calc_dema/calc_heikin_ashi/calc_regression_channel/
calc_wt fonksiyonları JS'teki karşılıklarıyla AYNI algoritma/AYNI formülü
kullanır (satır satır port) — iki dilde farklı RSI hesabı backtest sonucunu
bozar. Bkz. plan doğrulama adımı: cross_check.py bu eşitliği test eder.
"""
from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Optional

import numpy as np
import pandas as pd


# ════════════════════════════════════════════════════════════════
# Kom1 ile birebir aynı temel indikatörler
# (js/screener/indicator-engine.js'in doğrudan portu)
# ════════════════════════════════════════════════════════════════

def _ema_last(arr: list[float], period: int) -> float:
    """indicator-engine.js:_emaLast — ilk değeri seed alıp EMA'yı son bara kadar ilerletir."""
    k = 2 / (period + 1)
    e = arr[0]
    for i in range(1, len(arr)):
        e = arr[i] * k + e * (1 - k)
    return e


def _ema_series(arr: list[float], period: int) -> list[float]:
    """indicator-engine.js:_emaSeries — tam EMA serisi (DEMA'nın ihtiyacı)."""
    k = 2 / (period + 1)
    out = [arr[0]]
    for i in range(1, len(arr)):
        out.append(arr[i] * k + out[i - 1] * (1 - k))
    return out


def calc_rsi(closes: list[float], period: int = 14) -> Optional[float]:
    """indicator-engine.js:calcRSI — Wilder yöntemi, son bar'ın yuvarlanmış değeri."""
    if len(closes) < period + 1:
        return None
    gains = 0.0
    losses = 0.0
    for i in range(1, period + 1):
        d = closes[i] - closes[i - 1]
        if d > 0:
            gains += d
        else:
            losses -= d
    avg_gain = gains / period
    avg_loss = losses / period
    for i in range(period + 1, len(closes)):
        d = closes[i] - closes[i - 1]
        avg_gain = (avg_gain * (period - 1) + max(d, 0)) / period
        avg_loss = (avg_loss * (period - 1) + max(-d, 0)) / period
    if avg_loss == 0:
        return 100.0
    rs = avg_gain / avg_loss
    return round(100 - 100 / (1 + rs))


def calc_rsi_full(closes: list[float], period: int = 14) -> list[Optional[float]]:
    """indicator-engine.js:calcRSIFull — tam seri, yuvarlanmamış (divergence pivot tespiti için)."""
    out: list[Optional[float]] = [None] * len(closes)
    if len(closes) < period + 1:
        return out
    gains = 0.0
    losses = 0.0
    for i in range(1, period + 1):
        d = closes[i] - closes[i - 1]
        if d > 0:
            gains += d
        else:
            losses -= d
    avg_gain = gains / period
    avg_loss = losses / period
    out[period] = 100.0 if avg_loss == 0 else 100 - 100 / (1 + avg_gain / avg_loss)
    for i in range(period + 1, len(closes)):
        d = closes[i] - closes[i - 1]
        avg_gain = (avg_gain * (period - 1) + max(d, 0)) / period
        avg_loss = (avg_loss * (period - 1) + max(-d, 0)) / period
        out[i] = 100.0 if avg_loss == 0 else 100 - 100 / (1 + avg_gain / avg_loss)
    return out


def calc_dema(closes: list[float], period: int = 9) -> Optional[float]:
    """indicator-engine.js:calcDEMA — DEMA = 2*EMA1 - EMA(EMA1)."""
    if len(closes) < period * 2:
        return None
    ema1 = _ema_series(closes, period)
    ema2 = _ema_series(ema1, period)
    return 2 * ema1[-1] - ema2[-1]


@dataclass
class HeikinAshi:
    ha_open: float
    ha_close: float
    ha_high: float
    ha_low: float


def calc_heikin_ashi(opens, highs, lows, closes) -> Optional[HeikinAshi]:
    """indicator-engine.js:calcHeikinAshi — standart iteratif dönüşüm, son bar'ı döner."""
    if not opens or len(opens) != len(closes):
        return None
    ha_open = (opens[0] + closes[0]) / 2
    ha_close = (opens[0] + highs[0] + lows[0] + closes[0]) / 4
    ha_high = max(highs[0], ha_open, ha_close)
    ha_low = min(lows[0], ha_open, ha_close)
    for i in range(1, len(closes)):
        new_ha_close = (opens[i] + highs[i] + lows[i] + closes[i]) / 4
        new_ha_open = (ha_open + ha_close) / 2
        new_ha_high = max(highs[i], new_ha_open, new_ha_close)
        new_ha_low = min(lows[i], new_ha_open, new_ha_close)
        ha_open, ha_close, ha_high, ha_low = new_ha_open, new_ha_close, new_ha_high, new_ha_low
    return HeikinAshi(ha_open, ha_close, ha_high, ha_low)


@dataclass
class RegressionChannel:
    mid: float
    slope: float
    intercept: float


def calc_regression_channel(closes: list[float], length: int = 100) -> Optional[RegressionChannel]:
    """indicator-engine.js:calcRegressionChannel — length-bar'lık basit lineer regresyon (OLS)."""
    if len(closes) < length:
        return None
    sl = closes[-length:]
    n = len(sl)
    sum_x = sum(range(n))
    sum_y = sum(sl)
    sum_xy = sum(i * sl[i] for i in range(n))
    sum_xx = sum(i * i for i in range(n))
    denom = n * sum_xx - sum_x * sum_x
    if denom == 0:
        return None
    slope = (n * sum_xy - sum_x * sum_y) / denom
    intercept = (sum_y - slope * sum_x) / n
    mid = slope * (n - 1) + intercept
    return RegressionChannel(mid, slope, intercept)


@dataclass
class WTResult:
    val: float
    direction: str  # 'bull' | 'bear'
    prev: float


def calc_wt(hlc3_arr: list[float], ch_len: int = 10, avg_len: int = 21) -> Optional[WTResult]:
    """indicator-engine.js:calcWT — WaveTrend, son bar'da cross var mı."""
    if len(hlc3_arr) < ch_len + avg_len + 4:
        return None

    needed = ch_len + avg_len + 5
    sl = hlc3_arr[-needed:]
    wt1_arr = []
    for i in range(ch_len, len(sl)):
        window = sl[i - ch_len:i + 1]
        esa = _ema_last(window, ch_len)
        d_arr = [abs(v - esa) for v in window]
        d = _ema_last(d_arr, ch_len)
        ci = (sl[i] - esa) / (0.015 * d) if d != 0 else 0
        wt1_arr.append(ci)

    if len(wt1_arr) < avg_len + 2:
        return None

    wt1_prev = _ema_last(wt1_arr[-avg_len - 1:-1], avg_len)
    wt1_curr = _ema_last(wt1_arr[-avg_len:], avg_len)
    wt2_prev = sum(wt1_arr[-5:-1]) / 4
    wt2_curr = sum(wt1_arr[-4:]) / 4

    bull_cross = wt1_prev <= wt2_prev and wt1_curr > wt2_curr
    bear_cross = wt1_prev >= wt2_prev and wt1_curr < wt2_curr
    if not bull_cross and not bear_cross:
        return None

    return WTResult(
        val=round(wt1_curr),
        direction='bull' if bull_cross else 'bear',
        prev=round(wt1_prev),
    )


# ════════════════════════════════════════════════════════════════
# Kom2'ye özel — YENİ indikatörler (Kom1'in bot mantığına dokunmaz)
# ════════════════════════════════════════════════════════════════

def find_pivot_lows(closes: np.ndarray, lookback: int) -> np.ndarray:
    """Bir bar'ın kendi etrafındaki `lookback` bar içinde en düşük close'a sahip
    olup olmadığını (yerel dip/pivot) boolean dizi olarak döner. Look-ahead bias'a
    KARŞI: bir pivot ancak `lookback` bar SONRASI da geçtikten sonra "onaylanmış"
    sayılabilir — bu fonksiyon ham pivot konumunu bulur, sinyal üretiminde
    onay gecikmesi ayrıca uygulanmalı (bkz. signal.py)."""
    n = len(closes)
    is_pivot = np.zeros(n, dtype=bool)
    for i in range(lookback, n - lookback):
        window = closes[i - lookback:i + lookback + 1]
        if closes[i] == window.min():
            is_pivot[i] = True
    return is_pivot


def detect_bullish_divergence(
    closes: np.ndarray, rsi_full: np.ndarray, lookback: int, confirm_bars: int = 0,
) -> list[int]:
    """Fiyat daha düşük bir dip yaparken RSI daha yüksek bir dip yapıyorsa
    (klasik bullish divergence), İKİNCİ (daha yeni) pivot'un index'ini döner.
    `lookback`: pivot tanımı için sağ/sol pencere (5-20 bar arası test edilecek,
    bkz. plan). Sadece ARDIŞIK iki pivot dip karşılaştırılır — daha karmaşık
    çoklu-pivot taraması v1 kapsamı dışında.

    Look-ahead bias notu: bir pivot'un "pivot olduğu", ancak sağındaki
    `lookback` bar geçtikten SONRA bilinebilir (find_pivot_lows'un tanımı
    gereği). Bu yüzden divergence, ikinci pivot'un kendisinden `lookback`
    bar SONRA (confirm edildiği an) sinyale dönüştürülmeli — signal.py bu
    gecikmeyi ayrıca uyguluyor, burada sadece pivot konumları ham olarak
    bulunuyor.
    """
    pivots = np.where(find_pivot_lows(closes, lookback))[0]
    signals = []
    for a, b in zip(pivots[:-1], pivots[1:]):
        price_lower_low = closes[b] < closes[a]
        rsi_higher_low = rsi_full[b] is not None and rsi_full[a] is not None and rsi_full[b] > rsi_full[a]
        if price_lower_low and rsi_higher_low:
            signals.append(int(b))
    return signals


@dataclass
class OiPersistenceResult:
    triggered: bool
    peak_gain_pct: float
    days_held: float


def check_oi_persistence(
    oi_series: pd.Series,  # datetime index, OI value
    at_time: pd.Timestamp,
    threshold_pct: float,
    hold_days: float,
    max_pullback_pct: float,
) -> OiPersistenceResult:
    """OI kalıcılık testi (Kom2'nin YENİ, divergence'tan BAĞIMSIZ tetikleyici
    yolu — eski Kom2'nin BANK'ın sessiz OI birikimini kaçırmasının çözümü).

    Kural (kullanıcı tanımı): OI, `threshold_pct` kadar artıp, `hold_days`
    gün boyunca zirveden `max_pullback_pct`'ten fazla geri çekilmeden kalıyorsa
    tetiklenir. `at_time` öncesindeki veriyle SINIRLI çalışır (look-ahead yok)
    — `oi_series` çağıran tarafından zaten `at_time`'a kadar kesilmiş olmalı.
    """
    window = oi_series[oi_series.index <= at_time]
    lookback_start = at_time - pd.Timedelta(days=hold_days)
    window = window[window.index >= lookback_start]
    if len(window) < 2:
        return OiPersistenceResult(False, 0.0, 0.0)

    base = window.iloc[0]
    if base <= 0:
        return OiPersistenceResult(False, 0.0, 0.0)

    running_peak = window.iloc[0]
    peak_gain_pct = 0.0
    for val in window:
        running_peak = max(running_peak, val)
        gain_pct = (running_peak - base) / base * 100
        peak_gain_pct = max(peak_gain_pct, gain_pct)
        pullback_pct = (running_peak - val) / running_peak * 100 if running_peak > 0 else 0
        if gain_pct >= threshold_pct and pullback_pct > max_pullback_pct:
            # eşik geçildi ama sonrasında izin verilenden fazla geri çekildi — kalıcılık bozuldu
            return OiPersistenceResult(False, peak_gain_pct, hold_days)

    triggered = peak_gain_pct >= threshold_pct
    return OiPersistenceResult(triggered, peak_gain_pct, hold_days)


# ── L/S filtresi — kullanıcının 4 varyantı ─────────────────────
LS_VARIANTS = ('global_below_1', 'global_declining', 'top_above_1', 'combined')


def check_ls_filter(
    global_ls: pd.Series, top_ls: pd.Series, at_time: pd.Timestamp, variant: str, trend_bars: int = 10,
) -> bool:
    """Kullanıcının 4 L/S varyantı — hem ayrı ayrı hem birleşik test edilecek.
    `combined` = (global_below_1 VEYA global_declining) VE top_above_1 —
    kullanıcının tam tanımı."""
    g = global_ls[global_ls.index <= at_time]
    t = top_ls[top_ls.index <= at_time]
    if g.empty or t.empty:
        return False

    global_below_1 = g.iloc[-1] < 1.0
    global_declining = len(g) >= trend_bars and g.iloc[-1] < g.iloc[-trend_bars:].mean()
    top_above_1 = t.iloc[-1] > 1.0

    if variant == 'global_below_1':
        return global_below_1
    if variant == 'global_declining':
        return global_declining
    if variant == 'top_above_1':
        return top_above_1
    if variant == 'combined':
        return (global_below_1 or global_declining) and top_above_1
    raise ValueError(f'Bilinmeyen L/S varyantı: {variant}')


def volume_tier(quote_volume_24h: float, tier_edges: list[float]) -> int:
    """Hacim derece sistemi — eşik değil, sinyal gücü skoru (1-3 yıldız).
    `tier_edges` veri dağılımından türetilir (bkz. compute_volume_tier_edges),
    kullanıcının 100M/250M/500M örneği sadece başlangıç noktası."""
    stars = 1
    for edge in tier_edges:
        if quote_volume_24h >= edge:
            stars += 1
    return min(stars, 3)


def compute_volume_tier_edges(quote_volumes: list[float]) -> list[float]:
    """Test edilen coin evreninin GERÇEK hacim dağılımından 2 eşik (33/66
    persentil) türetir — kullanıcının "eşikleri veri dağılımına göre öner"
    talebi. 100M/250M/500M kullanıcı örneği sadece referans/sanity-check
    için kullanılır, kör kopyalanmaz."""
    arr = np.array(quote_volumes)
    return [float(np.percentile(arr, 33)), float(np.percentile(arr, 66))]
