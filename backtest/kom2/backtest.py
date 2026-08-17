"""
backtest.py — Sabit ufuklu (+1h/+4h/+1d) ölçüm, Kom1'in ORİJİNAL
metodolojisiyle birebir aynı (bkz. dokumentasyon/gorevler/sinyal-sistemi-pintrade-entegrasyon.md
§2 — Kombinasyon 1 test sonuçları): brüt/net getiri (net = brüt - %0.14
round-trip maliyet), pozitif oran, medyan, <10 örneklem uyarısı.
"""
from __future__ import annotations

import sqlite3
from dataclasses import dataclass

import numpy as np
import pandas as pd

from kom2_signal import Kom2Signal, load_klines

HORIZONS = {"h1": pd.Timedelta(hours=1), "h4": pd.Timedelta(hours=4), "d1": pd.Timedelta(days=1)}
ROUND_TRIP_COST_PCT = 0.14
LOW_SAMPLE_THRESHOLD = 10


@dataclass
class SignalReturn:
    signal: Kom2Signal
    horizon: str
    gross_pct: float | None
    net_pct: float | None


def _price_at_or_after(df: pd.DataFrame, t: pd.Timestamp) -> float | None:
    """df: 'time'/'close' sütunlu, zaman sırasına göre sıralı. t'den sonraki
    (veya eşit) ilk bar'ın kapanışını döner — sinyal anındaki bilgiyle asla
    çelişmez (sadece GELECEKTEKİ bir noktanın fiyatını ölçüyoruz, bu
    ölçümün kendisi look-ahead değil, backtest'in amacı zaten bu)."""
    idx = df["time"].searchsorted(t, side="left")
    if idx >= len(df):
        return None
    return float(df["close"].iloc[idx])


def measure_signal_returns(sig: Kom2Signal, conn: sqlite3.Connection) -> list[SignalReturn]:
    """Bir sinyal için +1h/+4h/+1d ufuklarında brüt/net getiriyi ölçer.
    Fiyat kaynağı: 1h klines (yeterli çözünürlük, tüm ufuklar için tek
    kaynaktan tutarlı ölçüm)."""
    df_1h = load_klines(conn, "1h")
    if df_1h.empty:
        return []
    out = []
    for h_name, h_delta in HORIZONS.items():
        target_time = sig.entry_time + h_delta
        price = _price_at_or_after(df_1h, target_time)
        if price is None:
            out.append(SignalReturn(sig, h_name, None, None))
            continue
        gross = (price - sig.entry_price) / sig.entry_price * 100
        net = gross - ROUND_TRIP_COST_PCT
        out.append(SignalReturn(sig, h_name, gross, net))
    return out


@dataclass
class HorizonStats:
    horizon: str
    signal_count: int
    positive_rate: float | None
    median_gross_pct: float | None
    median_net_pct: float | None
    mean_gross_pct: float | None
    mean_net_pct: float | None
    low_sample: bool


def aggregate_returns(returns: list[SignalReturn]) -> list[HorizonStats]:
    """Kom1'in raporundaki AYNI özet istatistikleri üretir (bkz. §1 tablo formatı)."""
    out = []
    for h_name in HORIZONS:
        subset = [r for r in returns if r.horizon == h_name and r.gross_pct is not None]
        n = len(subset)
        if n == 0:
            out.append(HorizonStats(h_name, 0, None, None, None, None, None, True))
            continue
        gross = np.array([r.gross_pct for r in subset])
        net = np.array([r.net_pct for r in subset])
        out.append(HorizonStats(
            horizon=h_name,
            signal_count=n,
            positive_rate=float((gross > 0).mean() * 100),
            median_gross_pct=float(np.median(gross)),
            median_net_pct=float(np.median(net)),
            mean_gross_pct=float(np.mean(gross)),
            mean_net_pct=float(np.mean(net)),
            low_sample=n < LOW_SAMPLE_THRESHOLD,
        ))
    return out


def format_stats_table(stats: list[HorizonStats], title: str = "") -> str:
    lines = []
    if title:
        lines.append(f"### {title}")
        lines.append("")
    lines.append("| Ufuk | Örneklem | Pozitif Oran | Medyan Net | Medyan Brüt |")
    lines.append("|---|---|---|---|---|")
    horizon_label = {"h1": "+1 saat", "h4": "+4 saat", "d1": "+1 gün"}
    for s in stats:
        warn = " ⚠️" if s.low_sample else ""
        if s.signal_count == 0:
            lines.append(f"| {horizon_label[s.horizon]} | 0 | — | — | — |{warn}")
            continue
        lines.append(
            f"| {horizon_label[s.horizon]} | {s.signal_count}{warn} | "
            f"%{s.positive_rate:.1f} | %{s.median_net_pct:+.2f} | %{s.median_gross_pct:+.2f} |"
        )
    return "\n".join(lines)
