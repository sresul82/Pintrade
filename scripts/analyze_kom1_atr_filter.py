"""
analyze_kom1_atr_filter.py — Kom1'in coin evrenine ATR14/fiyat filtresi
eklenmesi ÖNCESİ doğrulama raporu (kullanıcı isteği, 2026-08-16).

Bu script SADECE ANALİZ yapar — kom1-server-watcher.js'e HİÇBİR DOKUNUŞ
YOK, production'a hiçbir değişiklik girmiyor. Kullanıcı onayı gelmeden
gerçek filtre kodu yazılmayacak.

Yöntem: production'daki son 200 Kom1 sinyalini çeker, her sembol için
GÜNLÜK (1D) klines'tan ATR14/fiyat yüzdesini hesaplar (aynı formül,
backtest/kom2/fetch_data.py'deki compute_atr14_pct ile birebir aynı —
tutarlılık için), "sakin" aralığı (%3-12) içinde/dışında sayar.
"""
from __future__ import annotations

import json
import os
import time

import requests

BASE = "https://fapi.binance.com"
SIGNALS_PATH = os.path.join(
    os.path.dirname(__file__), "..", "backtest", "kom2", "data", "kom1_signals_for_atr.json"
)

CALM_LOW = 3.0
CALM_HIGH = 12.0


def fetch_daily_klines(symbol: str, days: int = 30) -> list:
    end = int(time.time() * 1000)
    start = end - days * 24 * 60 * 60 * 1000
    resp = requests.get(
        f"{BASE}/fapi/v1/klines",
        params={"symbol": symbol, "interval": "1d", "startTime": start, "endTime": end, "limit": days + 5},
        headers={"User-Agent": "Mozilla/5.0"}, timeout=15,
    )
    resp.raise_for_status()
    return resp.json()


def compute_atr14_pct(daily_klines: list) -> float | None:
    """backtest/kom2/fetch_data.py:compute_atr14_pct ile BİREBİR AYNI formül."""
    if len(daily_klines) < 15:
        return None
    highs = [float(k[2]) for k in daily_klines]
    lows = [float(k[3]) for k in daily_klines]
    closes = [float(k[4]) for k in daily_klines]
    trs = []
    for i in range(1, len(closes)):
        tr = max(
            highs[i] - lows[i],
            abs(highs[i] - closes[i - 1]),
            abs(lows[i] - closes[i - 1]),
        )
        trs.append(tr)
    atr14 = sum(trs[-14:]) / 14
    last_close = closes[-1]
    if last_close <= 0:
        return None
    return atr14 / last_close * 100


def classify(atr_pct: float) -> str:
    if atr_pct < CALM_LOW:
        return "hareketsiz"
    if atr_pct <= CALM_HIGH:
        return "sakin (FİLTRE GEÇER)"
    return "sert"


def main():
    with open(SIGNALS_PATH, encoding="utf-8") as f:
        signals = json.load(f)

    symbols = sorted({s["symbol"] for s in signals})
    signal_count_by_symbol: dict[str, int] = {}
    for s in signals:
        signal_count_by_symbol[s["symbol"]] = signal_count_by_symbol.get(s["symbol"], 0) + 1

    print(f"Toplam sinyal: {len(signals)}, benzersiz sembol: {len(symbols)}")
    print()

    results = []
    for i, sym in enumerate(symbols):
        try:
            kl = fetch_daily_klines(sym)
            atr = compute_atr14_pct(kl)
            time.sleep(0.15)
        except Exception as e:
            print(f"  [{i+1}/{len(symbols)}] {sym}: HATA ({e})")
            continue
        if atr is None:
            print(f"  [{i+1}/{len(symbols)}] {sym}: yetersiz veri")
            continue
        cls = classify(atr)
        n_signals = signal_count_by_symbol[sym]
        results.append((sym, atr, cls, n_signals))
        print(f"  [{i+1}/{len(symbols)}] {sym}: ATR14={atr:.2f}% -> {cls} ({n_signals} sinyal)")

    print()
    print("=" * 70)
    print("ÖZET")
    print("=" * 70)

    total_signals_kept = sum(r[3] for r in results if "GEÇER" in r[2])
    total_signals_dropped = sum(r[3] for r in results if "GEÇER" not in r[2])
    total_symbols_kept = sum(1 for r in results if "GEÇER" in r[2])
    total_symbols_dropped = sum(1 for r in results if "GEÇER" not in r[2])

    print(f"Sembol: {total_symbols_kept} filtreden geçer, {total_symbols_dropped} elenir "
          f"(toplam {len(results)})")
    print(f"Sinyal: {total_signals_kept} filtreden geçer, {total_signals_dropped} elenir "
          f"(toplam {total_signals_kept+total_signals_dropped})")
    print()

    print("Elenen semboller (ATR dışında kalanlar), sinyal sayısına göre sıralı:")
    dropped = sorted([r for r in results if "GEÇER" not in r[2]], key=lambda r: -r[3])
    for sym, atr, cls, n in dropped:
        print(f"  {sym}: ATR={atr:.2f}% ({cls}) — {n} sinyal")

    print()
    beat = [r for r in results if r[0] == "BEATUSDT"]
    if beat:
        sym, atr, cls, n = beat[0]
        print(f"BEATUSDT kontrolü: ATR14={atr:.2f}% -> {cls} ({n} sinyal)")
    else:
        print("BEATUSDT bu 200 sinyal içinde yok veya veri alınamadı.")

    # Rapor dosyasına da yaz
    out_path = os.path.join(os.path.dirname(__file__), "..", "dokumentasyon", "raporlar",
                             "2026-08-16-kom1-atr-filtre-analizi.md")
    with open(out_path, "w", encoding="utf-8") as f:
        f.write("# Kom1 ATR Filtresi — Ön Doğrulama Analizi (üretime GİRMEDİ)\n\n")
        f.write(f"Son {len(signals)} Kom1 sinyali, {len(symbols)} benzersiz sembol üzerinden "
                f"günlük (1D) ATR14/fiyat yüzdesi hesaplandı.\n\n")
        f.write(f"**Filtre aralığı: %{CALM_LOW}–%{CALM_HIGH} (\"sakin\") — bu aralık DIŞINDAKİLER "
                f"sinyal üretmeyecek (ama taranmaya devam edecek).**\n\n")
        f.write(f"- Sembol: {total_symbols_kept} geçer / {total_symbols_dropped} elenir "
                f"(toplam {len(results)})\n")
        f.write(f"- Sinyal: {total_signals_kept} geçer / {total_signals_dropped} elenir "
                f"(toplam {total_signals_kept+total_signals_dropped})\n\n")
        f.write("## Elenen semboller\n\n")
        f.write("| Sembol | ATR14% | Sınıf | Sinyal Sayısı |\n|---|---|---|---|\n")
        for sym, atr, cls, n in dropped:
            f.write(f"| {sym} | {atr:.2f} | {cls} | {n} |\n")
        f.write("\n## Filtreden geçen semboller\n\n")
        f.write("| Sembol | ATR14% | Sinyal Sayısı |\n|---|---|---|\n")
        for sym, atr, cls, n in sorted([r for r in results if "GEÇER" in r[2]], key=lambda r: -r[3]):
            f.write(f"| {sym} | {atr:.2f} | {n} |\n")
    print(f"\nRapor yazıldı: {out_path}")


if __name__ == "__main__":
    main()
