"""
analyze_kom1_atr_backtest.py — ATR filtresinin DOĞRU (look-ahead'siz, sabit
ufuklu) backtest'i. Kullanıcı isteği, 2026-08-16 — önceki analizin "bugünkü
ATR'yi geçmiş sinyale uygulama" hatasını düzeltir.

Düzeltmeler:
  1. Her sinyal için ATR14, O SİNYALİN ZAMANINDAKİ günlük mumlardan hesaplanır
     (confirmedAt'ten SONRAKİ hiçbir veri kullanılmaz).
  2. Getiri, Kom2 backtest.py ile AYNI sabit-ufuklu yöntemle (+1h/+4h/+1d,
     %0.14 round-trip maliyet) ölçülür — "şu anki fiyat" değil.
  3. Örneklem penceresi: API'nin verdiği en fazla 200 sinyal (server.js'in
     kendi limiti — bunun ötesi için sunucu değişikliği gerekir, bu script
     production'a dokunmadığı için genişletilemiyor, bkz. rapor notu).

Performans: sembol başına TEK bir geniş klines penceresi çekilir (o sembolün
TÜM sinyallerini kapsayacak şekilde), sonra her sinyal bu bellek-içi veriden
noktasal olarak hesaplanır — 200 sinyal için 400 ayrı istek yerine ~79 sembol
için ~158 istek.
"""
from __future__ import annotations

import json
import os
import sys
import time
from datetime import timedelta

import numpy as np
import pandas as pd
import requests

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backtest", "kom2"))
import fetch_data as fd  # noqa: E402
import backtest as bt  # noqa: E402

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "backtest", "kom2", "data")
SIGNALS_PATH = os.path.join(DATA_DIR, "kom1_signals_for_atr.json")

CALM_LOW = 3.0
CALM_HIGH = 12.0
ATR_LOOKBACK_DAYS = 40  # ATR14 + pay


def classify(atr_pct: float) -> str:
    if atr_pct < CALM_LOW:
        return "hareketsiz"
    if atr_pct <= CALM_HIGH:
        return "sakin"
    return "sert"


def klines_to_df(klines: list) -> pd.DataFrame:
    df = pd.DataFrame(klines, columns=[
        "open_time", "open", "high", "low", "close", "volume", "close_time",
        "quote_volume", "trades", "taker_base", "taker_quote", "ignore",
    ])
    for c in ("open", "high", "low", "close"):
        df[c] = df[c].astype(float)
    df["time"] = pd.to_datetime(df["open_time"], unit="ms", utc=True)
    return df


def compute_atr14_at(daily_df: pd.DataFrame, at_time: pd.Timestamp) -> float | None:
    """SADECE at_time'dan ÖNCEKİ (open_time < at_time) günlük mumları kullanır —
    look-ahead güvenli."""
    hist = daily_df[daily_df["time"] < at_time]
    if len(hist) < 15:
        return None
    highs = hist["high"].to_numpy()[-15:]
    lows = hist["low"].to_numpy()[-15:]
    closes = hist["close"].to_numpy()[-15:]
    trs = []
    for i in range(1, len(closes)):
        trs.append(max(highs[i] - lows[i], abs(highs[i] - closes[i - 1]), abs(lows[i] - closes[i - 1])))
    atr14 = sum(trs[-14:]) / 14
    last_close = closes[-1]
    if last_close <= 0:
        return None
    return atr14 / last_close * 100


def main():
    with open(SIGNALS_PATH, encoding="utf-8") as f:
        signals = json.load(f)
    for s in signals:
        s["confirmedAt_ts"] = pd.Timestamp(s["confirmedAt"], tz="UTC")

    by_symbol: dict[str, list] = {}
    for s in signals:
        by_symbol.setdefault(s["symbol"], []).append(s)

    print(f"Toplam sinyal: {len(signals)}, benzersiz sembol: {len(by_symbol)}")
    print("Sinyal zamanındaki ATR hesaplanıyor + sabit-ufuklu getiri ölçülüyor...")
    print()

    results = []  # her biri: symbol, atr_at_signal, cls, confirmedAt, price, returns{h1,h4,d1}

    for i, (sym, sig_list) in enumerate(sorted(by_symbol.items())):
        min_t = min(s["confirmedAt_ts"] for s in sig_list)
        max_t = max(s["confirmedAt_ts"] for s in sig_list)

        daily_start = int((min_t - timedelta(days=ATR_LOOKBACK_DAYS)).timestamp() * 1000)
        daily_end = int(max_t.timestamp() * 1000) + 1
        h1_start = int(min_t.timestamp() * 1000)
        h1_end = int((max_t + timedelta(hours=26)).timestamp() * 1000)

        try:
            daily_kl = fd.fetch_klines(sym, "1d", daily_start, daily_end)
            time.sleep(0.1)
            h1_kl = fd.fetch_klines(sym, "1h", h1_start, h1_end)
            time.sleep(0.1)
        except Exception as e:
            print(f"  [{i+1}/{len(by_symbol)}] {sym}: veri hatası ({e}), atlanıyor")
            continue

        if not daily_kl or not h1_kl:
            print(f"  [{i+1}/{len(by_symbol)}] {sym}: veri yok, atlanıyor")
            continue

        daily_df = klines_to_df(daily_kl)
        h1_df = klines_to_df(h1_kl)

        for s in sig_list:
            t = s["confirmedAt_ts"]
            entry_price = s.get("price")
            if not entry_price:
                continue
            atr = compute_atr14_at(daily_df, t)
            if atr is None:
                continue
            cls = classify(atr)

            row = {"symbol": sym, "atr_at_signal": atr, "cls": cls, "confirmedAt": t, "entry_price": entry_price}
            for h_name, h_delta in bt.HORIZONS.items():
                target = t + h_delta
                price = bt._price_at_or_after(h1_df, target)
                if price is None:
                    row[f"{h_name}_gross"] = None
                    row[f"{h_name}_net"] = None
                else:
                    gross = (price - entry_price) / entry_price * 100
                    row[f"{h_name}_gross"] = gross
                    row[f"{h_name}_net"] = gross - bt.ROUND_TRIP_COST_PCT
            results.append(row)

        print(f"  [{i+1}/{len(by_symbol)}] {sym}: {len(sig_list)} sinyal işlendi")

    print()
    print(f"Toplam işlenen sinyal: {len(results)}")

    df = pd.DataFrame(results)
    if df.empty:
        print("Hiç sonuç yok, çıkılıyor.")
        return

    def group_stats(subset: pd.DataFrame, horizon: str):
        col_net = f"{horizon}_net"
        col_gross = f"{horizon}_gross"
        vals = subset[col_net].dropna()
        vals_gross = subset[col_gross].dropna()
        n = len(vals)
        if n == 0:
            return {"n": 0, "win_rate": None, "median_net": None, "median_gross": None}
        wins = (vals_gross > 0).sum()
        return {
            "n": n,
            "win_rate": float(wins / n * 100),
            "median_net": float(vals.median()),
            "median_gross": float(vals_gross.median()),
        }

    print()
    print("=" * 80)
    print("SABİT UFUKLU SONUÇLAR (look-ahead'siz, sinyal-anı ATR sınıfına göre)")
    print("=" * 80)

    report_lines = []
    report_lines.append("# Kom1 ATR Filtresi — DOĞRU (Sabit Ufuklu, Look-ahead'siz) Backtest\n")
    report_lines.append(
        "Önceki analizin düzeltilmiş hali: ATR14 artık her sinyal için O SİNYALİN "
        "ZAMANINDAKİ günlük mumlardan hesaplanıyor (bugünkü ATR değil), getiri "
        "+1h/+4h/+1d sabit ufuklarla (Kom1/Kom2 ile aynı metodoloji, %0.14 "
        "round-trip maliyet) ölçülüyor.\n"
    )
    report_lines.append(
        f"**Örneklem kısıtı:** API en fazla 200 sinyal veriyor (server.js limiti, "
        f"pencereyi genişletmek sunucu değişikliği gerektirir — bu script production'a "
        f"dokunmuyor). İşlenen: {len(results)}/{len(signals)} sinyal "
        f"({df['confirmedAt'].min()} → {df['confirmedAt'].max()}).\n"
    )

    report_lines.append("## Grup karşılaştırması\n")
    report_lines.append("| Grup | Ufuk | n | Kazanma Oranı | Medyan Net | Medyan Brüt |")
    report_lines.append("|---|---|---|---|---|---|")
    for grp_name, grp_df in [
        ("Tüm sinyaller", df),
        ("Filtreden GEÇEN (sakin %3-12)", df[df["cls"] == "sakin"]),
        ("ELENEN (sert >%12)", df[df["cls"] == "sert"]),
        ("ELENEN (hareketsiz <%3)", df[df["cls"] == "hareketsiz"]),
    ]:
        for h in ("h1", "h4", "d1"):
            st = group_stats(grp_df, h)
            h_label = {"h1": "+1sa", "h4": "+4sa", "d1": "+1g"}[h]
            if st["n"]:
                print(f"{grp_name:35s} {h_label:5s} n={st['n']:4d} win=%{st['win_rate']:5.1f} "
                      f"medyan_net=%{st['median_net']:+.2f}")
                report_lines.append(
                    f"| {grp_name} | {h_label} | {st['n']} | %{st['win_rate']:.1f} | "
                    f"%{st['median_net']:+.2f} | %{st['median_gross']:+.2f} |"
                )
            else:
                report_lines.append(f"| {grp_name} | {h_label} | 0 | — | — | — |")

    print()
    print("=" * 80)
    print("TEK TEK — LABUSDT / BICOUSDT / ALLOUSDT (sinyal-anı ATR'leri)")
    print("=" * 80)
    report_lines.append("\n## Tek tek — sınır civarındaki coinler (sinyal-anı ATR)\n")
    for target in ["LABUSDT", "BICOUSDT", "ALLOUSDT"]:
        sub = df[df["symbol"] == target]
        if sub.empty:
            print(f"{target}: veri yok")
            continue
        print(f"\n{target} — {len(sub)} sinyal, sinyal-anı ATR değerleri:")
        report_lines.append(f"\n### {target} ({len(sub)} sinyal)\n")
        report_lines.append("| Zaman | ATR (sinyal anı) | Sınıf | +1h net | +4h net | +1d net |")
        report_lines.append("|---|---|---|---|---|---|")
        for _, r in sub.sort_values("confirmedAt").iterrows():
            h1 = f"%{r['h1_net']:+.2f}" if pd.notna(r["h1_net"]) else "—"
            h4 = f"%{r['h4_net']:+.2f}" if pd.notna(r["h4_net"]) else "—"
            d1 = f"%{r['d1_net']:+.2f}" if pd.notna(r["d1_net"]) else "—"
            print(f"  {r['confirmedAt']} ATR={r['atr_at_signal']:.2f}% ({r['cls']}) "
                  f"+1h={h1} +4h={h4} +1d={d1}")
            report_lines.append(f"| {r['confirmedAt']} | {r['atr_at_signal']:.2f}% | {r['cls']} | {h1} | {h4} | {d1} |")
        for h in ("h1", "h4", "d1"):
            st = group_stats(sub, h)
            if st["n"]:
                print(f"    [{h}] n={st['n']} win=%{st['win_rate']:.1f} medyan_net=%{st['median_net']:+.2f}")

    out_path = os.path.join(os.path.dirname(__file__), "..", "dokumentasyon", "raporlar",
                             "2026-08-16-kom1-atr-filtre-sabit-ufuklu-backtest.md")
    with open(out_path, "w", encoding="utf-8") as f:
        f.write("\n".join(report_lines))
    print(f"\n\nRapor yazıldı: {out_path}")

    # Ham veriyi de sonraki analizler için sakla
    df.to_json(os.path.join(DATA_DIR, "atr_backtest_results.json"), orient="records", date_format="iso")


if __name__ == "__main__":
    main()
