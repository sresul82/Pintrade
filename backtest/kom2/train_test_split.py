"""
train_test_split.py — Kom2'nin OI-kalıcılık grid sonucunun overfitting'den
arındırılmış doğrulaması. Kullanıcı isteği, 2026-08-17.

Yöntem: veri KRONOLOJİK olarak ikiye bölünür (ilk %70 train, son %30 test —
sinyal SAYISINA göre değil, ZAMANA göre). 72 kombinasyonun tamamı SADECE
train'de çalıştırılıp en iyi (2. ve 3. en iyi dahil) bulunur, sonra bu
SEÇİLMİŞ parametreler (değiştirilmeden) test'te çalıştırılıp performansı
karşılaştırılır. Amaç: train'deki iyi sonucun test'te de tutup tutmadığını
görmek (data-snooping/overfitting kontrolü).

Ağa YENİ istek atmaz — mevcut cache'lenmiş SQLite verisini kullanır.
"""
from __future__ import annotations

import os

import pandas as pd

import fetch_data as fd
import kom2_signal as sig
import backtest as bt
import indicators as ind
import run_grid_search as rgs

OI_THRESHOLDS = rgs.OI_THRESHOLDS
OI_HOLD_DAYS = rgs.OI_HOLD_DAYS
OI_PULLBACKS = rgs.OI_PULLBACKS
LS_VARIANTS = rgs.LS_VARIANTS


def generate_all_oi_signal_rows(coins: list[rgs.CoinData], volume_tier_edges: list[float]) -> pd.DataFrame:
    """72 kombinasyonun HEPSİ için, her sinyali kendi combo etiketiyle birlikte
    tek bir DataFrame'e toplar (train/test'e göre daha sonra filtrelenebilsin diye)."""
    rows = []
    total = len(OI_THRESHOLDS) * len(OI_HOLD_DAYS) * len(OI_PULLBACKS) * len(LS_VARIANTS)
    i = 0
    for th in OI_THRESHOLDS:
        for days in OI_HOLD_DAYS:
            for pb in OI_PULLBACKS:
                for ls_v in LS_VARIANTS:
                    i += 1
                    combo = (th, days, pb, ls_v)
                    signals = []
                    for cd in coins:
                        signals += rgs.compute_signals_in_memory(
                            cd, None, (th, days, pb), ls_v, volume_tier_edges, ("oi_persistence",)
                        )
                    coins_by_symbol = {c.symbol: c for c in coins}
                    returns = rgs.backtest_signals_in_memory(signals, coins_by_symbol)
                    for r in returns:
                        rows.append({
                            "combo": combo, "symbol": r.signal.symbol,
                            "entry_time": r.signal.entry_time, "horizon": r.horizon,
                            "gross": r.gross_pct, "net": r.net_pct,
                        })
                    if i % 12 == 0:
                        print(f"  ({i}/{total}) combo={combo}: {len(signals)} sinyal")
    return pd.DataFrame(rows)


def rank_combos(df: pd.DataFrame, top_n: int = 3) -> list[tuple]:
    """+4h medyan net getiriye göre (>=5 örneklem şartıyla) sırala, en iyi top_n combo'yu döner."""
    results = []
    for combo, grp in df[df["horizon"] == "h4"].groupby("combo"):
        vals = grp["net"].dropna()
        if len(vals) < 5:
            continue
        results.append((combo, len(vals), float(vals.median())))
    results.sort(key=lambda x: -x[2])
    return results[:top_n]


def stats_for_combo_horizon(df: pd.DataFrame, combo: tuple, horizon: str) -> dict:
    sub = df[(df["combo"] == combo) & (df["horizon"] == horizon)]
    vals = sub["net"].dropna()
    gross = sub["gross"].dropna()
    n = len(vals)
    if n == 0:
        return {"n": 0, "win_rate": None, "median_net": None}
    wins = (gross > 0).sum()
    return {"n": n, "win_rate": float(wins / n * 100), "median_net": float(vals.median())}


def main():
    import json
    with open(os.path.join(fd.DATA_DIR, "hard_coin_universe.json")) as f:
        hard_coins = json.load(f)

    print("Coin verisi belleğe yükleniyor...")
    coins = rgs.load_all_coin_data(hard_coins)
    volume_tier_edges = ind.compute_volume_tier_edges(
        [c.quote_volume_24h for c in coins if c.quote_volume_24h > 0]
    )
    print(f"{len(coins)} coin yüklendi.\n")

    print("72 kombinasyon için TÜM sinyaller (train/test ayrımı öncesi) üretiliyor...")
    all_rows = generate_all_oi_signal_rows(coins, volume_tier_edges)
    print(f"\nToplam sinyal-ufuk satırı: {len(all_rows)}")

    if all_rows.empty:
        print("Hiç sinyal yok, çıkılıyor.")
        return

    # Kronolojik %70/%30 böl (sinyal SAYISINA değil, ZAMANA göre)
    min_t = all_rows["entry_time"].min()
    max_t = all_rows["entry_time"].max()
    cutoff = min_t + (max_t - min_t) * 0.7
    print(f"\nZaman aralığı: {min_t} -> {max_t}")
    print(f"Train/test kesim noktası (kronolojik %70): {cutoff}")

    train_df = all_rows[all_rows["entry_time"] <= cutoff]
    test_df = all_rows[all_rows["entry_time"] > cutoff]
    print(f"Train satır sayısı: {len(train_df)}, Test satır sayısı: {len(test_df)}")

    print("\nTrain'de en iyi 3 kombinasyon (+4h medyan net'e göre, >=5 örneklem):")
    top3 = rank_combos(train_df, top_n=3)
    for combo, n, median_net in top3:
        print(f"  {combo}: train n={n}, +4h medyan net=%{median_net:+.3f}")

    report_lines = []
    report_lines.append("# Kom2 OI-Kalıcılık Grid — Train/Test Overfitting Kontrolü\n")
    report_lines.append(
        f"Veri kronolojik olarak bölündü: **train** = {min_t} → {cutoff} (%70), "
        f"**test** = {cutoff} → {max_t} (%30). 72 kombinasyonun TAMAMI sadece "
        f"train'de sıralandı, en iyi 3 kombinasyon (parametre DEĞİŞTİRİLMEDEN) "
        f"test'te çalıştırıldı.\n"
    )
    report_lines.append(f"Train satır sayısı: {len(train_df)}, Test satır sayısı: {len(test_df)}\n")

    report_lines.append("## Train'de en iyi 3 — Test'te nasıl davranıyor?\n")
    report_lines.append("| Sıra | Combo (eşik,gün,pullback,ls) | Ufuk | TRAIN n | TRAIN Kazanma | TRAIN Medyan Net | TEST n | TEST Kazanma | TEST Medyan Net |")
    report_lines.append("|---|---|---|---|---|---|---|---|---|")

    for rank, (combo, train_n_h4, train_median_h4) in enumerate(top3, 1):
        for horizon, h_label in [("h1", "+1sa"), ("h4", "+4sa"), ("d1", "+1g")]:
            train_st = stats_for_combo_horizon(train_df, combo, horizon)
            test_st = stats_for_combo_horizon(test_df, combo, horizon)
            tr_win = f"%{train_st['win_rate']:.1f}" if train_st["n"] else "—"
            tr_med = f"%{train_st['median_net']:+.2f}" if train_st["n"] else "—"
            te_win = f"%{test_st['win_rate']:.1f}" if test_st["n"] else "—"
            te_med = f"%{test_st['median_net']:+.2f}" if test_st["n"] else "—"
            warn = " ⚠️" if test_st["n"] and test_st["n"] < 10 else ""
            print(f"  #{rank} {combo} [{h_label}]: TRAIN n={train_st['n']} win={tr_win} med={tr_med} "
                  f"| TEST n={test_st['n']}{warn} win={te_win} med={te_med}")
            report_lines.append(
                f"| {rank} | `{combo}` | {h_label} | {train_st['n']} | {tr_win} | {tr_med} | "
                f"{test_st['n']}{warn} | {te_win} | {te_med} |"
            )

    report_lines.append("\n## Yorum\n")
    report_lines.append(
        "Test sütunundaki medyan net getiri, train'e YAKIN kalıyorsa bulgu "
        "muhtemelen gerçek (overfitting değil). Test'te ÖNEMLİ ÖLÇÜDE düşüyorsa "
        "veya işaret değiştiriyorsa, train sonucu 72 kombinasyondan 'en iyisini "
        "seçmiş olmanın' (data-snooping) bir ürünü olabilir — bu durumda "
        "production kararı ERTELENMELİ.\n"
    )

    out_path = os.path.join(os.path.dirname(__file__), "..", "..", "dokumentasyon", "raporlar",
                             "2026-08-17-kom2-train-test-overfitting-kontrolu.md")
    with open(out_path, "w", encoding="utf-8") as f:
        f.write("\n".join(report_lines))
    print(f"\nRapor yazıldı: {out_path}")


if __name__ == "__main__":
    main()
