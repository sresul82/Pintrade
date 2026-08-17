"""
run_grid_search.py — Kom2 parametre taraması + nihai rapor üretimi.

Adımlar:
  1. Sert coin evrenini keşfet (fetch_data.build_hard_coin_universe) — yoksa
     çeker, varsa cache'den (hard_coin_universe.json) okur.
  2. Her sert coin için tam veri setini çeker (fetch_data.fetch_symbol_full)
     — zaten indirilmişse (downloaded_ranges) atlar.
  3. YOL A grid: divergence lookback 5-20 (16 değer) — SADECE divergence yolu.
  4. YOL B grid: OI eşik (15/20/25) x gün (3/5/7) x pullback (10/20) x
     L/S varyantı (4) = 72 kombinasyon — SADECE OI kalıcılık yolu.
  5. BİRLEŞİK: en iyi divergence lookback + en iyi OI/L-S kombinasyonu
     birlikte (her iki yol da aktif) — kullanıcının "hem ayrı ayrı hem
     birleşik" isteği.
  6. `dokumentasyon/raporlar/kom2-backtest-sonuclari.md`'ye Kom1'in raporundaki
     formatla yazar (havuzlanmış istatistik, varyant karşılaştırma tablosu,
     örneklem sayıları, BANK doğrulama sonucu dahil).

Performans notu: her coin'in verisi (klines/OI/L-S) BİR KEZ SQLite'tan
belleğe yüklenir, tüm grid kombinasyonları bu bellek-içi veriyle çalışır
(tekrar tekrar disk/ağ erişimi yok).
"""
from __future__ import annotations

import json
import os
import sqlite3
import time

import numpy as np

import fetch_data as fd
import kom2_signal as sig
import backtest as bt
import bank_validation
import indicators as ind

REPORT_PATH = os.path.join(
    os.path.dirname(__file__), "..", "..", "dokumentasyon", "raporlar", "kom2-backtest-sonuclari.md"
)

DIVERGENCE_LOOKBACKS = list(range(5, 21))
OI_THRESHOLDS = [15, 20, 25]
OI_HOLD_DAYS = [3, 5, 7]
OI_PULLBACKS = [10, 20]
LS_VARIANTS = list(ind.LS_VARIANTS)


class CoinData:
    """Bir coin'in tüm verisini bellekte tutar — grid taraması boyunca tekrar
    SQLite okunmasın diye."""
    def __init__(self, symbol: str, conn: sqlite3.Connection):
        self.symbol = symbol
        self.klines = {tf: sig.load_klines(conn, tf) for tf in ("1h", "4h", "1d", "5m")}
        self.oi = sig.load_oi_series(conn)
        self.ls_global, self.ls_top = sig.load_ls_series(conn)
        self.quote_volume_24h = self._last_quote_volume()

    def _last_quote_volume(self) -> float:
        df = self.klines.get("1d")
        if df is None or df.empty:
            return 0.0
        return float(df["quote_volume"].iloc[-1])


def load_all_coin_data(symbols: list[str]) -> list[CoinData]:
    out = []
    for sym in symbols:
        path = fd._db_path(sym)
        if not os.path.exists(path):
            print(f"  [skip] {sym}: veri yok")
            continue
        conn = sqlite3.connect(path)
        try:
            cd = CoinData(sym, conn)
            if cd.klines["5m"].empty:
                print(f"  [skip] {sym}: 5m veri yok")
                continue
            out.append(cd)
        finally:
            conn.close()
    return out


def compute_signals_in_memory(
    cd: CoinData, divergence_lookback: int | None, oi_params: tuple | None,
    ls_variant: str | None, volume_tier_edges: list[float], paths: tuple[str, ...],
) -> list[sig.Kom2Signal]:
    """kom2_signal.compute_symbol_signals'ın bellek-içi (SQLite'sız) varyantı."""
    signals = []
    for big_tf in sig.BIG_TFS:
        df_big = cd.klines[big_tf]
        if df_big.empty:
            continue
        candidates = []
        if "divergence" in paths and divergence_lookback is not None:
            candidates += sig.scan_divergence_signals(df_big, divergence_lookback)
        if "oi_persistence" in paths and oi_params is not None:
            th, days, pb = oi_params
            candidates += sig.scan_oi_persistence_signals(
                df_big, cd.oi, cd.ls_global, cd.ls_top, th, days, pb, ls_variant,
            )
        for cand in candidates:
            confirmed = sig.confirm_small_tf_entry(cd.klines["5m"], cand["time"], big_tf)
            if confirmed is None:
                continue
            vol_row = df_big.iloc[cand["bar_idx"]]
            vtier = ind.volume_tier(float(vol_row["quote_volume"]), volume_tier_edges)
            signals.append(sig.Kom2Signal(
                symbol=cd.symbol, big_tf=big_tf, path=cand["path"],
                big_tf_time=cand["time"], entry_time=confirmed["entry_time"],
                entry_price=confirmed["entry_price"], volume_tier=vtier,
                meta={**cand["meta"], **confirmed},
            ))
    return signals


def backtest_signals_in_memory(signals: list[sig.Kom2Signal], coins_by_symbol: dict[str, CoinData]):
    all_returns = []
    for s in signals:
        cd = coins_by_symbol[s.symbol]
        df_1h = cd.klines["1h"]
        if df_1h.empty:
            continue
        for h_name, h_delta in bt.HORIZONS.items():
            target_time = s.entry_time + h_delta
            price = bt._price_at_or_after(df_1h, target_time)
            if price is None:
                continue
            gross = (price - s.entry_price) / s.entry_price * 100
            net = gross - bt.ROUND_TRIP_COST_PCT
            all_returns.append(bt.SignalReturn(s, h_name, gross, net))
    return all_returns


def main():
    print("=" * 60)
    print("Kom2 Grid Search — Aşama 1: Sert coin evreni")
    print("=" * 60)
    cache_path = os.path.join(fd.DATA_DIR, "hard_coin_universe.json")
    if os.path.exists(cache_path):
        with open(cache_path) as f:
            hard_coins = json.load(f)
        print(f"Cache'den yüklendi: {len(hard_coins)} sert coin")
    else:
        hard_coins = fd.build_hard_coin_universe()
        os.makedirs(fd.DATA_DIR, exist_ok=True)
        with open(cache_path, "w") as f:
            json.dump(hard_coins, f, indent=2)

    print()
    print("=" * 60)
    print("Aşama 2: Veri çekme")
    print("=" * 60)
    for i, symb in enumerate(hard_coins):
        print(f"({i+1}/{len(hard_coins)}) {symb}")
        try:
            fd.fetch_symbol_full(symb, verbose=False)
        except fd.BanSignal:
            print("Ban sinyali — veri çekme durduruldu, mevcut coinlerle devam edilecek.")
            break
        except Exception as e:
            print(f"  hata: {e}, atlanıyor")

    print()
    print("=" * 60)
    print("Aşama 3: Veriyi belleğe yükle")
    print("=" * 60)
    coins = load_all_coin_data(hard_coins)
    coins_by_symbol = {c.symbol: c for c in coins}
    print(f"{len(coins)} coin belleğe yüklendi (5m verisi olanlar)")

    volume_tier_edges = ind.compute_volume_tier_edges(
        [c.quote_volume_24h for c in coins if c.quote_volume_24h > 0]
    )
    print(f"Hacim tier eşikleri (33/66 persentil): {volume_tier_edges}")

    report_sections = []
    report_sections.append("# Kom2 Backtest Sonuçları\n")
    report_sections.append(
        f"_Sert coin evreni: {len(hard_coins)} sembol (ATR14/fiyat >= %{fd.ATR_THRESHOLD_PCT}), "
        f"veri yüklenen: {len(coins)}. Hacim tier eşikleri (33/66 persentil): "
        f"{volume_tier_edges[0]/1e6:.0f}M / {volume_tier_edges[1]/1e6:.0f}M._\n"
    )

    # ── YOL A: Divergence grid ──────────────────────────────────
    print()
    print("=" * 60)
    print("Aşama 4: YOL A — Divergence grid (lookback 5-20)")
    print("=" * 60)
    report_sections.append("## Yol A — Divergence (RSI/fiyat), lookback taraması\n")
    div_results = {}
    for lb in DIVERGENCE_LOOKBACKS:
        all_signals = []
        for cd in coins:
            all_signals += compute_signals_in_memory(cd, lb, None, None, volume_tier_edges, ("divergence",))
        returns = backtest_signals_in_memory(all_signals, coins_by_symbol)
        stats = bt.aggregate_returns(returns)
        div_results[lb] = (all_signals, stats)
        h4 = next(s for s in stats if s.horizon == "h4")
        print(f"  lookback={lb}: {len(all_signals)} sinyal, +4h medyan net={h4.median_net_pct}")

    best_lb = max(
        DIVERGENCE_LOOKBACKS,
        key=lambda lb: (div_results[lb][1][1].median_net_pct or -999) if div_results[lb][1][1].signal_count >= 5 else -999,
    )
    report_sections.append(f"**En iyi lookback (≥5 örneklemli, +4h medyan net getiriye göre): {best_lb}**\n")
    report_sections.append("| Lookback | Sinyal | " + " | ".join(f"+{h}" for h in ["1h", "4h", "1d"]) + " |")
    report_sections.append("|---" * 5 + "|")
    for lb in DIVERGENCE_LOOKBACKS:
        signals, stats = div_results[lb]
        cells = []
        for h in ("h1", "h4", "d1"):
            s = next(x for x in stats if x.horizon == h)
            cells.append(f"%{s.median_net_pct:+.2f}" if s.median_net_pct is not None else "—")
        report_sections.append(f"| {lb} | {len(signals)} | " + " | ".join(cells) + " |")
    report_sections.append("")

    # ── YOL B: OI kalıcılık + L/S grid ──────────────────────────
    print()
    print("=" * 60)
    print("Aşama 5: YOL B — OI kalıcılık + L/S grid (72 kombinasyon)")
    print("=" * 60)
    report_sections.append("## Yol B — OI Kalıcılık Testi + L/S Filtresi, parametre taraması\n")
    oi_results = {}
    combo_i = 0
    total_combos = len(OI_THRESHOLDS) * len(OI_HOLD_DAYS) * len(OI_PULLBACKS) * len(LS_VARIANTS)
    for th in OI_THRESHOLDS:
        for days in OI_HOLD_DAYS:
            for pb in OI_PULLBACKS:
                for ls_v in LS_VARIANTS:
                    combo_i += 1
                    key = (th, days, pb, ls_v)
                    all_signals = []
                    for cd in coins:
                        all_signals += compute_signals_in_memory(
                            cd, None, (th, days, pb), ls_v, volume_tier_edges, ("oi_persistence",)
                        )
                    returns = backtest_signals_in_memory(all_signals, coins_by_symbol)
                    stats = bt.aggregate_returns(returns)
                    oi_results[key] = (all_signals, stats)
                    if combo_i % 12 == 0 or len(all_signals) > 0:
                        print(f"  ({combo_i}/{total_combos}) th={th} days={days} pb={pb} ls={ls_v}: {len(all_signals)} sinyal")

    best_oi_key = max(
        oi_results.keys(),
        key=lambda k: (next(s for s in oi_results[k][1] if s.horizon == "h4").median_net_pct or -999)
        if next(s for s in oi_results[k][1] if s.horizon == "h4").signal_count >= 5 else -999,
    )
    report_sections.append(f"**En iyi kombinasyon (≥5 örneklemli, +4h medyan net getiriye göre): {best_oi_key}**\n")
    report_sections.append("| Eşik% | Gün | Pullback% | L/S Varyant | Sinyal | +1h | +4h | +1d |")
    report_sections.append("|---" * 8 + "|")
    for key, (signals, stats) in sorted(oi_results.items(), key=lambda kv: -len(kv[1][0])):
        if not signals:
            continue
        th, days, pb, ls_v = key
        cells = []
        for h in ("h1", "h4", "d1"):
            s = next(x for x in stats if x.horizon == h)
            cells.append(f"%{s.median_net_pct:+.2f}" if s.median_net_pct is not None else "—")
        report_sections.append(f"| {th} | {days} | {pb} | {ls_v} | {len(signals)} | " + " | ".join(cells) + " |")
    report_sections.append("")

    # ── BİRLEŞİK ─────────────────────────────────────────────────
    print()
    print("=" * 60)
    print("Aşama 6: BİRLEŞİK (en iyi divergence + en iyi OI/L-S)")
    print("=" * 60)
    report_sections.append("## Birleşik — En İyi Divergence + En İyi OI/L-S (aynı anda aktif)\n")
    best_th, best_days, best_pb, best_ls = best_oi_key
    combined_signals = []
    for cd in coins:
        combined_signals += compute_signals_in_memory(
            cd, best_lb, (best_th, best_days, best_pb), best_ls, volume_tier_edges,
            ("divergence", "oi_persistence"),
        )
    combined_returns = backtest_signals_in_memory(combined_signals, coins_by_symbol)
    combined_stats = bt.aggregate_returns(combined_returns)
    report_sections.append(bt.format_stats_table(combined_stats, "Havuzlanmış (her iki yol birlikte)"))
    report_sections.append("")

    div_only_in_combined = [s for s in combined_signals if s.path == "divergence"]
    oi_only_in_combined = [s for s in combined_signals if s.path == "oi_persistence"]
    report_sections.append(f"- Divergence-yolu sinyal sayısı: {len(div_only_in_combined)}")
    report_sections.append(f"- OI-kalıcılık-yolu sinyal sayısı: {len(oi_only_in_combined)}")
    report_sections.append("")

    # ── BANK doğrulama ──────────────────────────────────────────
    print()
    print("=" * 60)
    print("Aşama 7: BANK (10-11 Temmuz) doğrulaması")
    print("=" * 60)
    try:
        bank_report = bank_validation.run()
    except Exception as e:
        bank_report = f"BANK doğrulaması hata verdi: {e}"
    report_sections.append(bank_report)
    report_sections.append("")

    report_sections.append("## Kom1 ile Karşılaştırma İçin Not\n")
    report_sections.append(
        "Kom1'in orijinal doğrulaması: 30 coin, ~6900 sinyal, +4h medyan net **+%0.31** "
        "(bkz. `dokumentasyon/gorevler/sinyal-sistemi-pintrade-entegrasyon.md` §2). "
        "Yukarıdaki Kom2 sonuçları bu referansla karşılaştırılabilir — aynı ufuklar "
        "(+1h/+4h/+1d), aynı %0.14 round-trip maliyet varsayımı, aynı <10 örneklem "
        "uyarı eşiği kullanıldı."
    )

    os.makedirs(os.path.dirname(REPORT_PATH), exist_ok=True)
    with open(REPORT_PATH, "w", encoding="utf-8") as f:
        f.write("\n".join(report_sections))
    print()
    print(f"Rapor yazıldı: {REPORT_PATH}")


if __name__ == "__main__":
    main()
