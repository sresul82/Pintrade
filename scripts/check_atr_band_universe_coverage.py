"""
check_atr_band_universe_coverage.py — %12-30 ATR bandını Kom1'in TAM coin
evrenine uygulayınca kaç coin fiilen bu aralığa düşüyor? Kullanıcı isteği,
2026-08-16. SADECE ANALİZ — production'a dokunmaz.
"""
from __future__ import annotations

import os
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backtest", "kom2"))
import fetch_data as fd  # noqa: E402

BANDS = [
    (0, 3, "hareketsiz (<%3)"),
    (3, 12, "eski 'sakin' (%3-12)"),
    (12, 30, "YENİ ÖNERİLEN (%12-30)"),
    (30, 70, "%30-70"),
    (70, 150, "%70-150"),
    (150, float("inf"), "%150+"),
]


def band_for(atr: float) -> str:
    for lo, hi, label in BANDS:
        if lo <= atr < hi:
            return label
    return BANDS[-1][2]


def main():
    symbols = fd.fetch_usdt_perpetual_universe()
    print(f"USDT perpetual evreni: {len(symbols)} sembol")
    print("ATR14 (günlük) hesaplanıyor, tüm evren için...")
    print()

    counts = {label: 0 for _, _, label in BANDS}
    errors = 0
    raw_atr: dict[str, float] = {}  # [2026-08-17 eklendi] histogram/persentil + geniş bant testleri için ham veri
    for i, sym in enumerate(symbols):
        try:
            kl = fd.fetch_klines(sym, "1d", fd.days_ago_ms(30), fd.now_ms())
            atr = fd.compute_atr14_pct(kl)
            time.sleep(0.12)
        except fd.BanSignal as e:
            print(f"⛔ Ban sinyali: {e} — taramayı durduruyorum, şu ana kadarki sonuçla devam.")
            break
        except Exception:
            errors += 1
            continue
        if atr is None:
            continue
        raw_atr[sym] = atr
        band = band_for(atr)
        counts[band] += 1
        if (i + 1) % 50 == 0:
            print(f"  ({i+1}/{len(symbols)}) işlendi...")

    import json as _json
    raw_path = os.path.join(os.path.dirname(__file__), "..", "backtest", "kom2", "data", "universe_atr_raw.json")
    with open(raw_path, "w", encoding="utf-8") as f:
        _json.dump(raw_atr, f, indent=2)
    print(f"Ham ATR verisi kaydedildi: {raw_path}")

    total_classified = sum(counts.values())
    print()
    print("=" * 60)
    print("SONUÇ — Tam evrende bant dağılımı")
    print("=" * 60)
    for _, _, label in BANDS:
        n = counts[label]
        pct = n / total_classified * 100 if total_classified else 0
        print(f"  {label:30s} {n:4d} coin (%{pct:.1f})")
    print(f"\n  Toplam sınıflandırılan: {total_classified} (hata/veri yok: {errors})")
    print()
    new_band_n = counts["YENİ ÖNERİLEN (%12-30)"]
    old_band_n = counts["eski 'sakin' (%3-12)"]
    print(f"Mevcut filtre (%3-12): {old_band_n} coin taranmaya devam eder")
    print(f"Yeni önerilen (%12-30): {new_band_n} coin taranmaya devam eder")
    print(f"Fark: {new_band_n - old_band_n:+d} coin ({(new_band_n/old_band_n-1)*100 if old_band_n else 0:+.1f}%)")

    out_path = os.path.join(os.path.dirname(__file__), "..", "dokumentasyon", "raporlar",
                             "2026-08-16-kom1-atr-band-evren-kapsami.md")
    with open(out_path, "w", encoding="utf-8") as f:
        f.write("# Kom1 ATR Bandı — Tam Evren Kapsam Analizi (üretime GİRMEDİ)\n\n")
        f.write(f"USDT perpetual evreni: {len(symbols)} sembol, sınıflandırılan: {total_classified}\n\n")
        f.write("| Bant | Coin Sayısı | Yüzde |\n|---|---|---|\n")
        for _, _, label in BANDS:
            n = counts[label]
            pct = n / total_classified * 100 if total_classified else 0
            f.write(f"| {label} | {n} | %{pct:.1f} |\n")
        f.write(f"\n**Mevcut filtre (%3-12): {old_band_n} coin** taranmaya devam eder.\n")
        f.write(f"**Yeni önerilen (%12-30): {new_band_n} coin** taranmaya devam eder.\n")
    print(f"\nRapor yazıldı: {out_path}")


if __name__ == "__main__":
    main()
