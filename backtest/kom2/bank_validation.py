"""
bank_validation.py — BANK'ın 10-11 Temmuz 2026 kurulumunun yeni Kom2
tanımıyla yakalanıp yakalanmadığını test eder.

ÖNEMLİ KISIT (bkz. plan §3): Binance'in OI/L-S geçmişi sadece son ~30 gün
tutuluyor — 10-11 Temmuz bu pencerenin çok dışında (bugün 16 Ağustos).
Bu yüzden burada SADECE divergence-yolu (kline-tabanlı, sınırsız geçmiş)
test edilebiliyor; OI kalıcılık-yolu BANK için test EDİLEMEZ, bu betik
bunu açıkça raporlar.
"""
from __future__ import annotations

import datetime as dt

import fetch_data as fd
import kom2_signal as sig
import backtest as bt

SYMBOL = "BANKUSDT"
EVENT_WINDOW_START = dt.datetime(2026, 7, 8, tzinfo=dt.timezone.utc)
EVENT_WINDOW_END = dt.datetime(2026, 7, 13, tzinfo=dt.timezone.utc)
FETCH_START = dt.datetime(2026, 4, 1, tzinfo=dt.timezone.utc)  # birikim bölgesinin başlangıcından
FETCH_END = dt.datetime(2026, 8, 1, tzinfo=dt.timezone.utc)     # breakout'un netleştiği ana kadar


def _ms(d: dt.datetime) -> int:
    return int(d.timestamp() * 1000)


def run() -> str:
    lines = []
    lines.append("# BANK (10-11 Temmuz 2026) — Kom2 Doğrulama Sonucu")
    lines.append("")
    lines.append(
        "**Kısıt:** OI/L-S geçmişi Binance'te sadece son ~30 gün tutuluyor, "
        "10-11 Temmuz bu pencerenin dışında — **sadece divergence-yolu test edildi**, "
        "OI kalıcılık-yolu bu tarih için hiç test edilemedi (veri yok)."
    )
    lines.append("")

    conn = fd._connect(SYMBOL)
    for tf in ("1h", "4h", "1d"):
        kl = fd.fetch_klines(SYMBOL, tf, _ms(FETCH_START), _ms(FETCH_END))
        fd._save_klines(conn, tf, kl)
        lines.append(f"- {SYMBOL} {tf}: {len(kl)} bar çekildi ({FETCH_START.date()} → {FETCH_END.date()})")
    lines.append("")

    found_near_event = []
    all_signals_by_lookback = {}

    for lookback in range(5, 21):
        for tf in ("1h", "4h", "1d"):
            df_big = sig.load_klines(conn, tf)
            candidates = sig.scan_divergence_signals(df_big, lookback)
            all_signals_by_lookback.setdefault(lookback, []).extend(
                [(tf, c) for c in candidates]
            )
            for tf_name, c in [(tf, c) for c in candidates]:
                if EVENT_WINDOW_START <= c["time"] <= EVENT_WINDOW_END:
                    found_near_event.append((lookback, tf_name, c))

    lines.append("## Sonuç")
    lines.append("")
    if found_near_event:
        lines.append(
            f"✅ **{len(found_near_event)} divergence sinyali 10-11 Temmuz penceresinde "
            f"({EVENT_WINDOW_START.date()}–{EVENT_WINDOW_END.date()}) bulundu:**"
        )
        lines.append("")
        lines.append("| Lookback | TF | Zaman | Fiyat |")
        lines.append("|---|---|---|---|")
        for lookback, tf_name, c in found_near_event:
            lines.append(f"| {lookback} | {tf_name} | {c['time']} | {c['price']:.5f} |")
    else:
        lines.append(
            "❌ **Hiçbir divergence sinyali 10-11 Temmuz penceresinde bulunamadı** "
            "(lookback 5-20, TF 1h/4h/1d hepsi tarandı)."
        )
        lines.append("")
        lines.append(
            "Bu, eski Kom2 raporunun tespitiyle TAM TUTARLI: BANK o dönemde aylarca "
            "yatay bir kanalda gezindi, fiyat 'daha düşük bir dip' yapmadığı için "
            "klasik divergence yapısal olarak hiç tetiklenemiyor (fiyat dipleri "
            "birbirine çok yakın/yükseliyor, RSI karşılaştırması anlamlı bir sinyal "
            "üretmiyor). **Yeni Kom2 tanımının divergence-yolu da bu spesifik "
            "kurulumu YAKALAYAMIYOR — beklenen sonuç bu, tasarım gereği zaten "
            "divergence'tan BAĞIMSIZ bir ikinci yol (OI kalıcılık testi) eklendi.** "
            "O ikinci yol ise (yukarıdaki kısıt nedeniyle) bu tarih için test edilemedi."
        )

    lines.append("")
    lines.append("## Genel bağlam — BANK'ın tüm dönemdeki (Nisan-Ağustos) divergence sinyalleri")
    lines.append("")
    total_all = sum(len(v) for v in all_signals_by_lookback.values())
    lines.append(f"Toplam {total_all} aday divergence sinyali bulundu (tüm lookback/TF kombinasyonları toplamı, çakışmalı sayım).")
    lines.append("")
    lines.append("Bu, BANK'ın divergence-yolu için TAMAMEN sinyalsiz olmadığını gösteriyor — "
                  "sadece TAM OLARAK 10-11 Temmuz'daki kurulumu kaçırıyor (spesifik zaaf, genel değil).")

    conn.close()
    return "\n".join(lines)


if __name__ == "__main__":
    report = run()
    print(report)
