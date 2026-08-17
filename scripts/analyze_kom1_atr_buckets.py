"""
analyze_kom1_atr_buckets.py — İnce ATR bantlarıyla (bucket) sabit-ufuklu
backtest. Kullanıcı hipotezi: doğrusal olmayan ilişki (aşırı sakin kötü,
orta-sert iyi, aşırı sert yine kötü). Kullanıcı isteği, 2026-08-16.

Önceki script'in (analyze_kom1_atr_backtest.py) ürettiği, sinyal-anı
(look-ahead'siz) ATR + sabit-ufuklu getiri verisini (atr_backtest_results.json)
YENİDEN KULLANIR — Binance'e tekrar istek atmaz.
"""
from __future__ import annotations

import json
import os

import numpy as np
import pandas as pd

DATA_PATH = os.path.join(os.path.dirname(__file__), "..", "backtest", "kom2", "data", "atr_backtest_results.json")

BUCKETS = [
    (0, 3, "%0-3 (hareketsiz)"),
    (3, 12, "%3-12 (mevcut 'sakin')"),
    (12, 30, "%12-30"),
    (30, 70, "%30-70"),
    (70, 150, "%70-150"),
    (150, float("inf"), "%150+ (BEATUSDT bölgesi)"),
]

LOW_SAMPLE_THRESHOLD = 10


def bucket_for(atr: float) -> str:
    for lo, hi, label in BUCKETS:
        if lo <= atr < hi:
            return label
    return BUCKETS[-1][2]


def stats_for(df: pd.DataFrame, gross_col: str, net_col: str) -> dict:
    gross = df[gross_col].dropna()
    net = df[net_col].dropna()
    n = len(gross)
    if n == 0:
        return {"n": 0, "win_rate": None, "avg_net": None, "median_net": None, "avg_gross": None, "median_gross": None}
    wins = (gross > 0).sum()
    return {
        "n": n,
        "win_rate": float(wins / n * 100),
        "avg_net": float(net.mean()),
        "median_net": float(net.median()),
        "avg_gross": float(gross.mean()),
        "median_gross": float(gross.median()),
    }


def main():
    with open(DATA_PATH, encoding="utf-8") as f:
        rows = json.load(f)
    df = pd.DataFrame(rows)
    df["bucket"] = df["atr_at_signal"].apply(bucket_for)
    bucket_order = [b[2] for b in BUCKETS]
    df["bucket"] = pd.Categorical(df["bucket"], categories=bucket_order, ordered=True)

    print("Sembol/sinyal sayısı bant başına (benzersiz sinyal, ATR sınıflandırması sinyal-anı):")
    print(df.groupby("bucket", observed=True).size())
    print()

    report_lines = []
    report_lines.append("# Kom1 ATR — İnce Bant Analizi (Sabit Ufuklu, Look-ahead'siz)\n")
    report_lines.append(
        "Hipotez: doğrusal olmayan ilişki — aşırı sakin kötü, orta-sert iyi, aşırı "
        "sert yine kötü olabilir. `analyze_kom1_atr_backtest.py`'nin ürettiği "
        "sinyal-anı ATR + sabit-ufuklu getiri verisi yeniden kullanıldı (Binance'e "
        "tekrar istek atılmadı).\n"
    )
    report_lines.append(f"**Toplam sinyal: {len(df)}**\n")

    for horizon, gross_col, net_col, h_label in [
        ("h1", "h1_gross", "h1_net", "+1 saat"),
        ("h4", "h4_gross", "h4_net", "+4 saat"),
        ("d1", "d1_gross", "d1_net", "+1 gün"),
    ]:
        print("=" * 90)
        print(f"UFUK: {h_label}")
        print("=" * 90)
        report_lines.append(f"## Ufuk: {h_label}\n")
        report_lines.append("| Bant | n | Kazanma Oranı | Ort. Net | Medyan Net | Ort. Brüt |")
        report_lines.append("|---|---|---|---|---|---|")
        for lo, hi, label in BUCKETS:
            sub = df[df["bucket"] == label]
            st = stats_for(sub, gross_col, net_col)
            warn = " ⚠️ DÜŞÜK ÖRNEKLEM" if st["n"] and st["n"] < LOW_SAMPLE_THRESHOLD else ""
            if st["n"]:
                line = (f"{label:30s} n={st['n']:4d} win=%{st['win_rate']:5.1f} "
                        f"ort_net=%{st['avg_net']:+6.2f} medyan_net=%{st['median_net']:+6.2f}{warn}")
                print(line)
                report_lines.append(
                    f"| {label} | {st['n']}{warn} | %{st['win_rate']:.1f} | %{st['avg_net']:+.2f} | "
                    f"%{st['median_net']:+.2f} | %{st['avg_gross']:+.2f} |"
                )
            else:
                print(f"{label:30s} n=0 (veri yok)")
                report_lines.append(f"| {label} | 0 | — | — | — | — |")
        print()

    # Hangi coinler hangi bantta — özellikle uç bantlar için içerik listesi
    report_lines.append("\n## Bant içerikleri (hangi coin/sinyal hangi bantta)\n")
    for lo, hi, label in BUCKETS:
        sub = df[df["bucket"] == label]
        if sub.empty:
            continue
        symbols_in_bucket = sub.groupby("symbol", observed=True).size().sort_values(ascending=False)
        report_lines.append(f"**{label}** ({len(sub)} sinyal, {len(symbols_in_bucket)} sembol): " +
                             ", ".join(f"{s}({n})" for s, n in symbols_in_bucket.items()))
        report_lines.append("")

    out_path = os.path.join(os.path.dirname(__file__), "..", "dokumentasyon", "raporlar",
                             "2026-08-16-kom1-atr-ince-bant-analizi.md")
    with open(out_path, "w", encoding="utf-8") as f:
        f.write("\n".join(report_lines))
    print(f"\nRapor yazıldı: {out_path}")


if __name__ == "__main__":
    main()
