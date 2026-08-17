"""
kom2_signal.py — Kom2 5 bileşenli sinyal mantığı.
(Dosya adı bilinçli olarak `signal.py` DEĞİL — Python'un stdlib `signal`
modülüyle çakışıp numpy/pandas'ın iç `subprocess` importunu bozuyordu,
circular-import hatasına yol açıyordu. Bkz. plan doğrulama notları.)

Büyük TF (1H/4H/1D) yön kararı:
  YOL A — Divergence: RSI(14)/fiyat arasında bullish divergence (pivot-tabanlı,
          lookback parametreli, 5-20 bar test edilecek).
  YOL B — OI kalıcılık testi + L/S filtresi (divergence'tan BAĞIMSIZ, YENİ).
Küçük TF (5m) girişi: Kom1'in AYNI kuralı — HA yeşil + HA_close > DEMA9,
  büyük TF sinyalinden sonra bir tolerans penceresi içinde.

Look-ahead bias'a karşı: divergence sinyali, ikinci pivot'un kendisinden
DEĞİL, o pivot'un `lookback` bar sonra "onaylandığı" andan itibaren
kullanılabilir kabul edilir (bkz. indicators.detect_bullish_divergence
docstring'i). OI kalıcılık testi zaten sadece `at_time`'a kadarki veriyle
çalışır (indicators.check_oi_persistence).
"""
from __future__ import annotations

import sqlite3
from dataclasses import dataclass, field
from datetime import timedelta
from typing import Optional

import numpy as np
import pandas as pd

import indicators as ind

RSI_PERIOD = 14
DEMA_PERIOD = 9
BIG_TFS = ("1h", "4h", "1d")
SMALL_TF = "5m"

# Kom1'in TOLERANCE_BARS=3 mantığıyla aynı ruh — büyük TF sinyalinden sonra
# küçük TF onayı için bekleme penceresi, TF'e göre duvar-saatine çevrilmiş
# (kom1-server-watcher.js:toleranceMs deseni).
TOLERANCE_BARS = 3
TF_HOURS = {"1h": 1, "4h": 4, "1d": 24}


@dataclass
class Kom2Signal:
    symbol: str
    big_tf: str
    path: str  # 'divergence' | 'oi_persistence'
    big_tf_time: pd.Timestamp
    entry_time: pd.Timestamp
    entry_price: float
    volume_tier: int
    meta: dict = field(default_factory=dict)


def load_klines(conn: sqlite3.Connection, tf: str) -> pd.DataFrame:
    df = pd.read_sql_query(f"SELECT * FROM klines_{tf} ORDER BY open_time ASC", conn)
    if df.empty:
        return df
    df["time"] = pd.to_datetime(df["open_time"], unit="ms", utc=True)
    return df


def _empty_dt_series() -> pd.Series:
    """[DÜZELTME, 2026-08-17] pd.Series(dtype=float) boş bir RangeIndex ile
    geliyor (DatetimeIndex değil) — sonra check_ls_filter/check_oi_persistence
    içinde `series.index <= at_time` (Timestamp) karşılaştırması
    'TypeError: <= not supported between ndarray and Timestamp' ile çöküyordu.
    Bazı coinlerde ls_metrics/oi_metrics tablosu gerçekten boş dönebiliyor
    (o coin için L/S verisi Binance'te hiç yoktu) — bu artık çökme değil,
    sessizce "veri yok" anlamına gelen boş bir DatetimeIndex seri döndürüyor."""
    return pd.Series(dtype=float, index=pd.DatetimeIndex([], tz="UTC"))


def load_oi_series(conn: sqlite3.Connection) -> pd.Series:
    df = pd.read_sql_query("SELECT * FROM oi_metrics ORDER BY create_time ASC", conn)
    if df.empty:
        return _empty_dt_series()
    idx = pd.to_datetime(df["create_time"], unit="ms", utc=True)
    return pd.Series(df["sum_open_interest"].values, index=idx)


def load_ls_series(conn: sqlite3.Connection) -> tuple[pd.Series, pd.Series]:
    df = pd.read_sql_query("SELECT * FROM ls_metrics ORDER BY create_time ASC", conn)
    if df.empty:
        return _empty_dt_series(), _empty_dt_series()
    idx = pd.to_datetime(df["create_time"], unit="ms", utc=True)
    global_ls = pd.Series(df["global_ls"].values, index=idx).dropna()
    top_ls = pd.Series(df["top_account_ls"].values, index=idx).dropna()
    if global_ls.empty:
        global_ls = _empty_dt_series()
    if top_ls.empty:
        top_ls = _empty_dt_series()
    return global_ls, top_ls


def _min_bars_needed(divergence_lookback: int) -> int:
    # RSI(14) + pivot penceresi (sol+sağ lookback) + biraz pay
    return RSI_PERIOD + 1 + divergence_lookback * 2 + 5


def scan_divergence_signals(
    df_big: pd.DataFrame, divergence_lookback: int,
) -> list[dict]:
    """YOL A — sadece kline/RSI kullanır, look-ahead güvenli (pivot onayı
    `divergence_lookback` bar gecikmeli uygulanır, bkz. indicators.py)."""
    if len(df_big) < _min_bars_needed(divergence_lookback):
        return []
    closes = df_big["close"].to_numpy()
    rsi_full = np.array(ind.calc_rsi_full(list(closes), RSI_PERIOD), dtype=object)

    pivot_bar_indices = ind.detect_bullish_divergence(closes, rsi_full, divergence_lookback)
    out = []
    for pivot_idx in pivot_bar_indices:
        confirm_idx = pivot_idx + divergence_lookback  # pivot ancak bu bar'da "bilinir"
        if confirm_idx >= len(df_big):
            continue
        out.append({
            "bar_idx": confirm_idx,
            "time": df_big["time"].iloc[confirm_idx],
            "price": float(df_big["close"].iloc[confirm_idx]),
            "path": "divergence",
            "meta": {"divergence_lookback": divergence_lookback, "pivot_bar_idx": int(pivot_idx)},
        })
    return out


def scan_oi_persistence_signals(
    df_big: pd.DataFrame,
    oi_series: pd.Series,
    ls_global: pd.Series,
    ls_top: pd.Series,
    oi_threshold_pct: float,
    oi_hold_days: float,
    oi_max_pullback_pct: float,
    ls_variant: str,
) -> list[dict]:
    """YOL B — OI/L-S geçmişi olan (Binance kısıtı: son ~30 gün) barlarla
    sınırlı. Sadece `at_time`'a kadarki OI/L-S verisiyle çalışır (look-ahead yok)."""
    if oi_series.empty or df_big.empty:
        return []
    oi_min_time = oi_series.index.min()
    out = []
    for i, row in df_big.iterrows():
        t = row["time"]
        if t < oi_min_time + timedelta(days=oi_hold_days):
            continue  # yeterli OI geçmişi henüz yok
        oi_res = ind.check_oi_persistence(oi_series, t, oi_threshold_pct, oi_hold_days, oi_max_pullback_pct)
        if not oi_res.triggered:
            continue
        if not ind.check_ls_filter(ls_global, ls_top, t, ls_variant):
            continue
        out.append({
            "bar_idx": i,
            "time": t,
            "price": float(row["close"]),
            "path": "oi_persistence",
            "meta": {
                "oi_threshold_pct": oi_threshold_pct, "oi_hold_days": oi_hold_days,
                "oi_max_pullback_pct": oi_max_pullback_pct, "ls_variant": ls_variant,
                "peak_gain_pct": oi_res.peak_gain_pct,
            },
        })
    return out


def confirm_small_tf_entry(
    df_5m: pd.DataFrame, big_tf_time: pd.Timestamp, big_tf: str,
) -> Optional[dict]:
    """Kom1'in AYNI küçük-TF onay kuralı: HA yeşil + HA_close > DEMA9,
    büyük TF sinyalinden sonraki tolerans penceresi içinde (ilk uygun 5m barında)."""
    tolerance = timedelta(hours=TF_HOURS[big_tf] * TOLERANCE_BARS)
    window = df_5m[(df_5m["time"] >= big_tf_time) & (df_5m["time"] <= big_tf_time + tolerance)]
    if window.empty:
        return None

    # DEMA9/HA hesabı için büyük TF sinyalinden ÖNCEKİ barları da içeren bir
    # bağlam gerekiyor (DEMA'nın seed'i) — pencereyi genişlet.
    start_idx = df_5m.index.get_indexer([window.index[0]], method="nearest")[0]
    context_start = max(0, start_idx - DEMA_PERIOD * 4)

    for idx in window.index:
        pos = df_5m.index.get_loc(idx)
        ctx = df_5m.iloc[context_start:pos + 1]
        if len(ctx) < DEMA_PERIOD * 2:
            continue
        opens = ctx["open"].tolist(); highs = ctx["high"].tolist()
        lows = ctx["low"].tolist(); closes = ctx["close"].tolist()
        ha = ind.calc_heikin_ashi(opens, highs, lows, closes)
        dema = ind.calc_dema(closes, DEMA_PERIOD)
        if ha is None or dema is None:
            continue
        if ha.ha_close >= ha.ha_open and ha.ha_close > dema:
            return {
                "entry_time": df_5m["time"].iloc[pos],
                "entry_price": float(df_5m["close"].iloc[pos]),
                "ha_close": ha.ha_close, "ha_open": ha.ha_open, "dema9": dema,
            }
    return None


def compute_symbol_signals(
    symbol: str,
    conn: sqlite3.Connection,
    divergence_lookback: int,
    oi_threshold_pct: float,
    oi_hold_days: float,
    oi_max_pullback_pct: float,
    ls_variant: str,
    volume_tier_edges: list[float],
    paths: tuple[str, ...] = ("divergence", "oi_persistence"),
) -> list[Kom2Signal]:
    """Bir sembol için tüm big-TF'lerde aday sinyalleri bulur, 5m'de onaylar.
    `paths`: ('divergence',) / ('oi_persistence',) / ikisi birden — kullanıcının
    "hem ayrı ayrı hem birleşik" test isteği için."""
    df_5m = load_klines(conn, SMALL_TF)
    oi_series = load_oi_series(conn)
    ls_global, ls_top = load_ls_series(conn)
    if df_5m.empty:
        return []

    signals: list[Kom2Signal] = []
    for big_tf in BIG_TFS:
        df_big = load_klines(conn, big_tf)
        if df_big.empty:
            continue

        candidates = []
        if "divergence" in paths:
            candidates += scan_divergence_signals(df_big, divergence_lookback)
        if "oi_persistence" in paths:
            candidates += scan_oi_persistence_signals(
                df_big, oi_series, ls_global, ls_top,
                oi_threshold_pct, oi_hold_days, oi_max_pullback_pct, ls_variant,
            )

        for cand in candidates:
            confirmed = confirm_small_tf_entry(df_5m, cand["time"], big_tf)
            if confirmed is None:
                continue
            vol_row = df_big.iloc[cand["bar_idx"]]
            vtier = ind.volume_tier(float(vol_row["quote_volume"]), volume_tier_edges)
            signals.append(Kom2Signal(
                symbol=symbol, big_tf=big_tf, path=cand["path"],
                big_tf_time=cand["time"], entry_time=confirmed["entry_time"],
                entry_price=confirmed["entry_price"], volume_tier=vtier,
                meta={**cand["meta"], **confirmed},
            ))
    return signals
