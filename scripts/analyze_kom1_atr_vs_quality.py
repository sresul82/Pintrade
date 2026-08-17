"""
analyze_kom1_atr_vs_quality.py — ATR filtresinin GERÇEKTEN kaliteyi artırıp
artırmadığını (yoksa sadece hacmi mi azalttığını) test eder. Kullanıcı isteği,
2026-08-16. SADECE ANALİZ — production'a hiçbir dokunuş yok.

Yöntem: her Kom1 sinyali için (giriş fiyatı -> şu anki fiyat) getirisini
hesaplar (önceki "sinyal kalitesi" raporuyla AYNI, kaba yöntem — ⚠️ bu sabit
ufuklu bir backtest DEĞİL, sinyalin ne zaman geldiğine göre çok değişken bir
"o andan bugüne kadarki getiri" ölçümü, aynı önceki raporda belirtilen
metodoloji kısıtları geçerli), sonra ATR sınıfına göre gruplar.
"""
from __future__ import annotations

import json
import os
import time

import requests

BASE = "https://fapi.binance.com"
DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "backtest", "kom2", "data")
SIGNALS_PATH = os.path.join(DATA_DIR, "kom1_signals_for_atr.json")
PRICES_PATH = os.path.join(DATA_DIR, "current_prices.json")

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
    if len(daily_klines) < 15:
        return None
    highs = [float(k[2]) for k in daily_klines]
    lows = [float(k[3]) for k in daily_klines]
    closes = [float(k[4]) for k in daily_klines]
    trs = []
    for i in range(1, len(closes)):
        trs.append(max(highs[i] - lows[i], abs(highs[i] - closes[i - 1]), abs(lows[i] - closes[i - 1])))
    atr14 = sum(trs[-14:]) / 14
    last_close = closes[-1]
    if last_close <= 0:
        return None
    return atr14 / last_close * 100


def classify(atr_pct: float) -> str:
    if atr_pct < CALM_LOW:
        return "hareketsiz"
    if atr_pct <= CALM_HIGH:
        return "sakin"
    return "sert"


def main():
    with open(SIGNALS_PATH, encoding="utf-8") as f:
        signals = json.load(f)
    with open(PRICES_PATH, encoding="utf-8") as f:
        price_list = json.load(f)
    price_map = {p["symbol"]: float(p["price"]) for p in price_list}

    symbols = sorted({s["symbol"] for s in signals})
    atr_by_symbol: dict[str, tuple[float, str]] = {}
    for i, sym in enumerate(symbols):
        try:
            kl = fetch_daily_klines(sym)
            atr = compute_atr14_pct(kl)
            time.sleep(0.15)
        except Exception as e:
            print(f"  {sym}: ATR hatası ({e})")
            continue
        if atr is None:
            continue
        atr_by_symbol[sym] = (atr, classify(atr))

    # Her sinyal için getiri hesapla
    rows = []
    for s in signals:
        sym = s["symbol"]
        cur = price_map.get(sym)
        entry = s.get("price")
        if cur is None or not entry or sym not in atr_by_symbol:
            continue
        ret_pct = (cur - entry) / entry * 100
        atr, cls = atr_by_symbol[sym]
        rows.append({"symbol": sym, "ret_pct": ret_pct, "atr": atr, "cls": cls})

    def group_stats(items):
        n = len(items)
        if n == 0:
            return {"n": 0, "win_rate": None, "avg_ret": None, "median_ret": None}
        rets = sorted(r["ret_pct"] for r in items)
        wins = sum(1 for r in rets if r > 0.1)
        return {
            "n": n,
            "win_rate": wins / n * 100,
            "avg_ret": sum(rets) / n,
            "median_ret": rets[n // 2] if n % 2 else (rets[n // 2 - 1] + rets[n // 2]) / 2,
        }

    passed = [r for r in rows if r["cls"] == "sakin"]
    sert = [r for r in rows if r["cls"] == "sert"]
    hareketsiz = [r for r in rows if r["cls"] == "hareketsiz"]
    dropped = sert + hareketsiz

    print("=" * 70)
    print(f"TÜM SİNYALLER (n={len(rows)})")
    print("=" * 70)
    print(group_stats(rows))
    print()
    print(f"FİLTREDEN GEÇEN (sakin, %3-12 ATR) — n={len(passed)}")
    print(group_stats(passed))
    print()
    print(f"ELENEN (TOPLAM: sert + hareketsiz) — n={len(dropped)}")
    print(group_stats(dropped))
    print()
    print(f"  ELENEN — sadece SERT (>%12 ATR) — n={len(sert)}")
    print(group_stats(sert))
    print()
    print(f"  ELENEN — sadece HAREKETSİZ (<%3 ATR) — n={len(hareketsiz)}")
    print(group_stats(hareketsiz))
    print()

    print("=" * 70)
    print("TEK TEK — En çok sinyal üreten 3 elenen SERT coin")
    print("=" * 70)
    lines_out = []
    for target in ["LABUSDT", "BICOUSDT", "ALLOUSDT"]:
        items = [r for r in rows if r["symbol"] == target]
        stats = group_stats(items)
        atr = atr_by_symbol.get(target, (None, None))[0]
        line = f"{target} (ATR={atr:.2f}%): n={stats['n']}, win_rate=%{stats['win_rate']:.1f} avg_ret=%{stats['avg_ret']:+.2f} median_ret=%{stats['median_ret']:+.2f}" if stats['n'] else f"{target}: veri yok"
        print(line)
        lines_out.append(line)
        for it in items:
            print(f"    -> ret={it['ret_pct']:+.2f}%")

    print()
    print("=" * 70)
    print("TEK TEK — Elenen 4 HAREKETSİZ coin")
    print("=" * 70)
    lines_out2 = []
    for target in ["BTCDOMUSDT", "1000FLOKIUSDT", "ANKRUSDT", "HBARUSDT"]:
        items = [r for r in rows if r["symbol"] == target]
        stats = group_stats(items)
        atr = atr_by_symbol.get(target, (None, None))[0]
        if stats['n']:
            line = f"{target} (ATR={atr:.2f}%): n={stats['n']}, win_rate=%{stats['win_rate']:.1f} avg_ret=%{stats['avg_ret']:+.2f} median_ret=%{stats['median_ret']:+.2f}"
        else:
            line = f"{target}: veri yok"
        print(line)
        lines_out2.append(line)
        for it in items:
            print(f"    -> ret={it['ret_pct']:+.2f}%")

    # Rapor dosyası
    out_path = os.path.join(os.path.dirname(__file__), "..", "dokumentasyon", "raporlar",
                             "2026-08-16-kom1-atr-filtre-kalite-capraz-analiz.md")
    with open(out_path, "w", encoding="utf-8") as f:
        f.write("# Kom1 ATR Filtresi x Sinyal Kalitesi — Çapraz Analiz (üretime GİRMEDİ)\n\n")
        f.write(
            "⚠️ Metodoloji notu: bu, sabit-ufuklu bir backtest DEĞİL — önceki 'sinyal kalitesi' "
            "raporuyla aynı kaba yöntem (giriş fiyatı vs ŞU ANKİ fiyat). Farklı yaşta sinyaller "
            "farklı sürelerde 'olgunlaşmış' — istatistiksel olarak gürültülü, ama filtrenin genel "
            "yönünü göstermeye yeter.\n\n"
        )
        f.write("## Grup karşılaştırması\n\n")
        f.write("| Grup | n | Kazanma Oranı | Ort. Getiri | Medyan Getiri |\n|---|---|---|---|---|\n")
        for name, items in [
            ("Tüm sinyaller", rows), ("Filtreden GEÇEN (sakin)", passed),
            ("ELENEN (toplam)", dropped), ("  - sadece sert", sert), ("  - sadece hareketsiz", hareketsiz),
        ]:
            st = group_stats(items)
            if st["n"]:
                f.write(f"| {name} | {st['n']} | %{st['win_rate']:.1f} | %{st['avg_ret']:+.2f} | %{st['median_ret']:+.2f} |\n")
            else:
                f.write(f"| {name} | 0 | — | — | — |\n")
        f.write("\n## En çok sinyal üreten 3 elenen SERT coin\n\n")
        for line in lines_out:
            f.write(f"- {line}\n")
        f.write("\n## Elenen 4 HAREKETSİZ coin\n\n")
        for line in lines_out2:
            f.write(f"- {line}\n")
    print(f"\nRapor yazıldı: {out_path}")


if __name__ == "__main__":
    main()
