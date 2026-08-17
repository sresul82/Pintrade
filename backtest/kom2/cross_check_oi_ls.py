"""
cross_check_oi_ls.py — check_oi_persistence / check_ls_filter (Python) ile
js/screener/kom2-server-watcher.js'teki checkOiPersistence/checkLsFilter
(JS) portunun AYNI girdide AYNI çıktıyı verdiğini doğrular.

Yöntem: birkaç "sert coin"in gerçek SQLite verisinden birkaç zaman noktası
seç, Python fonksiyonlarını çalıştır, aynı ham veriyi JSON'a dök, Node ile
JS fonksiyonlarını aynı girdide çalıştır, sonuçları karşılaştır.
"""
from __future__ import annotations

import json
import os
import sqlite3
import subprocess
import sys

import pandas as pd

sys.path.insert(0, os.path.dirname(__file__))
import indicators as ind

DATA_DIR = os.path.join(os.path.dirname(__file__), "data", "coin_data")
OI_THRESHOLD_PCT = 15.0
HOLD_DAYS = 7
MAX_PULLBACK_PCT = 10.0

TEST_SYMBOLS = ["ALLOUSDT", "LABUSDT", "BICOUSDT", "BANKUSDT", "COTIUSDT"]


def load_oi_series(conn) -> pd.Series:
    df = pd.read_sql_query("SELECT * FROM oi_metrics ORDER BY create_time ASC", conn)
    if df.empty:
        return pd.Series(dtype=float, index=pd.DatetimeIndex([], tz="UTC"))
    idx = pd.to_datetime(df["create_time"], unit="ms", utc=True)
    return pd.Series(df["sum_open_interest"].values, index=idx)


def load_global_ls_series(conn) -> pd.Series:
    df = pd.read_sql_query("SELECT * FROM ls_metrics ORDER BY create_time ASC", conn)
    if df.empty:
        return pd.Series(dtype=float, index=pd.DatetimeIndex([], tz="UTC"))
    idx = pd.to_datetime(df["create_time"], unit="ms", utc=True)
    return pd.Series(df["global_ls"].values, index=idx).dropna()


def main():
    cases = []  # her biri: {symbol, at_time_ms, py_oi, py_ls, oi_series_js, ls_series_js}

    for sym in TEST_SYMBOLS:
        db_path = os.path.join(DATA_DIR, f"{sym}.db")
        if not os.path.exists(db_path):
            print(f"  {sym}: db yok, atlanıyor")
            continue
        conn = sqlite3.connect(db_path)
        oi_series = load_oi_series(conn)
        ls_series = load_global_ls_series(conn)
        conn.close()

        if oi_series.empty:
            print(f"  {sym}: OI verisi yok, atlanıyor")
            continue

        # Test noktaları: OI serisinin %30/%60/%90'ı (en az hold_days kadar geçmişi olsun diye ortadan/sondan seç)
        n = len(oi_series)
        sample_idxs = sorted(set(int(n * f) for f in (0.3, 0.6, 0.9) if int(n * f) < n))

        for idx in sample_idxs:
            at_time = oi_series.index[idx]

            oi_window = oi_series[oi_series.index <= at_time]
            py_oi = ind.check_oi_persistence(oi_window, at_time, OI_THRESHOLD_PCT, HOLD_DAYS, MAX_PULLBACK_PCT)

            ls_window = ls_series[ls_series.index <= at_time] if not ls_series.empty else ls_series
            py_ls = ind.check_ls_filter(ls_window, ls_window, at_time, "global_below_1") if not ls_series.empty else None

            # JS'e geçirilecek ham seriler: at_time'a kadarki (hold_days+pay) pencere yeterli
            lookback_start = at_time - pd.Timedelta(days=HOLD_DAYS + 2)
            oi_js = [
                {"timestamp": int(t.timestamp() * 1000), "value": float(v)}
                for t, v in oi_window[oi_window.index >= lookback_start].items()
            ]
            ls_js = []
            if not ls_series.empty:
                ls_js = [
                    {"timestamp": int(t.timestamp() * 1000), "value": float(v)}
                    for t, v in ls_window.items()
                ]

            cases.append({
                "symbol": sym,
                "at_time_ms": int(at_time.timestamp() * 1000),
                "py_oi_triggered": bool(py_oi.triggered),
                "py_oi_peak_gain_pct": round(py_oi.peak_gain_pct, 6),
                "py_oi_days_held": py_oi.days_held,
                "py_ls": (bool(py_ls) if py_ls is not None else None),
                "oi_series": oi_js,
                "ls_series": ls_js,
            })

    cases_path = os.path.join(os.path.dirname(__file__), "cross_check_cases.json")
    with open(cases_path, "w", encoding="utf-8") as f:
        json.dump(cases, f)
    print(f"{len(cases)} test durumu üretildi -> {cases_path}")

    # Node tarafını çalıştır
    node_script = os.path.join(os.path.dirname(__file__), "cross_check_oi_ls.js")
    result = subprocess.run(["node", node_script], capture_output=True, text=True, cwd=os.path.dirname(__file__))
    print(result.stdout)
    if result.returncode != 0:
        print("NODE HATA:", result.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
