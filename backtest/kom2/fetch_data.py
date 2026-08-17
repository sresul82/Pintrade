"""
fetch_data.py — Kom2 backtest veri çekme.

Binance Futures public API'den (API key gerekmez):
  - USDT perpetual evrenini çeker, ATR14/fiyat >= %12 olanları filtreler
    ("sert coin" listesi, kullanıcı onaylı ön-filtre).
  - Sert coinler için klines (1D/4H/1H/5m — retention sınırı yok, aylarca
    geriye gidilir) + OI history + Global/TopTrader L/S ratio (Binance'in
    kendi kısıtı: SADECE SON 30 GÜN, bkz. plan §3).
  - Her coin için ayrı SQLite dosyası (data/coin_data/{SYMBOL}.db),
    eski pipeline'ın şemasına benzer (bkz.
    dokumentasyon/raporlar/2026-08-07-backtest-pipeline-format-analizi-mongo-sema-onerisi.md).
  - Idempotent: `downloaded_ranges` tablosu hangi (tip, aralık) çiftlerinin
    zaten indirildiğini tutar, tekrar çalıştırmada sadece eksikleri çeker.

Ban riskine karşı: kom1-server-watcher.js'teki SCAN_PACE_MS deseniyle aynı
mantık — istekler arası bekleme + 429/418'de tüm turu durdurma.
"""
from __future__ import annotations

import json
import os
import sqlite3
import time
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

import requests

BASE = "https://fapi.binance.com"
DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
COIN_DATA_DIR = os.path.join(DATA_DIR, "coin_data")

# ── Kullanıcı onaylı parametreler (bkz. plan) ──────────────────────────
ATR_THRESHOLD_PCT = 12.0          # "sert coin" eşiği (ATR14/fiyat)
OI_LS_DAYS = 30                    # Binance'in kendi kısıtı — değiştirilemez
SCAN_PACE_S = 0.15                 # istekler arası bekleme (kom1-server-watcher.js SCAN_PACE_MS ile aynı ruh)

HISTORY_DAYS = {
    "1d": 730,   # ~2 yıl — retention sınırı yok, geniş tutulabilir
    "4h": 365,
    "1h": 180,
    "5m": 120,   # BANK'ın 10-11 Temmuz'unu (bugünden ~37 gün önce) kapsayacak kadar geniş
}
KLINE_LIMIT = 1500  # Binance max


class BanSignal(Exception):
    pass


def _get(path: str, params: dict) -> object:
    url = f"{BASE}{path}"
    resp = requests.get(url, params=params, headers={"User-Agent": "Mozilla/5.0"}, timeout=15)
    if resp.status_code in (429, 418):
        raise BanSignal(f"HTTP {resp.status_code} on {path}")
    resp.raise_for_status()
    return resp.json()


def fetch_exchange_info() -> dict:
    return _get("/fapi/v1/exchangeInfo", {})


def fetch_24hr_tickers() -> list:
    return _get("/fapi/v1/ticker/24hr", {})


def fetch_usdt_perpetual_universe() -> list[str]:
    info = fetch_exchange_info()
    return [
        s["symbol"] for s in info["symbols"]
        if s["status"] == "TRADING" and s["contractType"] == "PERPETUAL" and s["symbol"].endswith("USDT")
    ]


def fetch_klines(symbol: str, interval: str, start_ms: int, end_ms: int) -> list:
    """Tek bir aralığı (start_ms..end_ms) sayfalayarak çeker, 1500'lük dilimler halinde."""
    out = []
    cursor = start_ms
    while cursor < end_ms:
        batch = _get("/fapi/v1/klines", {
            "symbol": symbol, "interval": interval,
            "startTime": cursor, "endTime": end_ms, "limit": KLINE_LIMIT,
        })
        if not batch:
            break
        out.extend(batch)
        last_open_time = batch[-1][0]
        if last_open_time <= cursor:
            break  # ilerleme yok, sonsuz döngüyü önle
        cursor = last_open_time + 1
        time.sleep(SCAN_PACE_S)
        if len(batch) < KLINE_LIMIT:
            break  # son sayfa
    return out


def fetch_oi_history(symbol: str, period: str, start_ms: int, end_ms: int) -> list:
    """/futures/data/openInterestHist — Binance'in kendi kısıtı: SADECE SON 30 GÜN.

    [DÜZELTME, 2026-08-17] Bu endpoint klines gibi startTime'dan ileriye doğru
    sayfalanmıyor — her istekte `endTime`'a en yakın (en GÜNCEL) `limit` kadar
    kayıt döndürüyor, `startTime` parametresi sayfalama için güvenilir değil.
    Eski kod startTime'ı ilerletmeye çalışıyordu ama her seferinde aynı "en
    güncel 500 kayıt"ı alıp cursor'ı `now`'a sıçratıyordu — sonuç: gerçekte
    sadece ~1.7 günlük (500 kayıt × 5dk) veri iniyordu, istenen 30 gün değil.
    Doğru yöntem: `endTime`'ı GERİYE doğru ilerletmek (her sayfanın en eski
    kaydından biraz öncesine)."""
    out = []
    cursor_end = end_ms
    while cursor_end > start_ms:
        batch = _get("/futures/data/openInterestHist", {
            "symbol": symbol, "period": period,
            "startTime": start_ms, "endTime": cursor_end, "limit": 500,
        })
        if not batch:
            break
        out.extend(batch)
        first_ts = batch[0]["timestamp"]
        if first_ts >= cursor_end:
            break  # ilerleme yok, sonsuz döngüyü önle
        cursor_end = first_ts - 1
        time.sleep(SCAN_PACE_S)
        if len(batch) < 500:
            break  # bu sayfa zaten aralığın başına ulaştı
    # tekilleştir + zaman sırasına diz (sayfalar geriye doğru geldiği için)
    seen = {r["timestamp"]: r for r in out}
    return sorted(seen.values(), key=lambda r: r["timestamp"])


def fetch_ls_ratio(symbol: str, endpoint: str, period: str, start_ms: int, end_ms: int) -> list:
    """endpoint: 'globalLongShortAccountRatio' | 'topLongShortAccountRatio' | 'topLongShortPositionRatio'.
    Aynı 30-günlük Binance kısıtına tabi. [DÜZELTME, 2026-08-17] fetch_oi_history
    ile AYNI sebepten AYNI geriye-doğru-sayfalama düzeltmesi uygulandı."""
    out = []
    cursor_end = end_ms
    while cursor_end > start_ms:
        batch = _get(f"/futures/data/{endpoint}", {
            "symbol": symbol, "period": period,
            "startTime": start_ms, "endTime": cursor_end, "limit": 500,
        })
        if not batch:
            break
        out.extend(batch)
        first_ts = batch[0]["timestamp"]
        if first_ts >= cursor_end:
            break
        cursor_end = first_ts - 1
        time.sleep(SCAN_PACE_S)
        if len(batch) < 500:
            break
    seen = {r["timestamp"]: r for r in out}
    return sorted(seen.values(), key=lambda r: r["timestamp"])


# ── ATR14 hesaplama (ön-filtre için, sadece son 30 günlük 1D mumla) ────

def compute_atr14_pct(daily_klines: list) -> float | None:
    """daily_klines: Binance kline formatı (liste-of-liste). ATR14/son-fiyat yüzdesi döner."""
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


# ── SQLite depolama (eski pipeline şemasına benzer) ────────────────────

KLINE_COLUMNS = (
    "open_time INTEGER PRIMARY KEY, open REAL, high REAL, low REAL, close REAL, "
    "volume REAL, close_time INTEGER, quote_volume REAL, trade_count INTEGER, "
    "taker_buy_base REAL, taker_buy_quote REAL"
)


def _db_path(symbol: str) -> str:
    os.makedirs(COIN_DATA_DIR, exist_ok=True)
    return os.path.join(COIN_DATA_DIR, f"{symbol}.db")


def _connect(symbol: str) -> sqlite3.Connection:
    conn = sqlite3.connect(_db_path(symbol))
    for tf in ("5m", "1h", "4h", "1d"):
        conn.execute(f"CREATE TABLE IF NOT EXISTS klines_{tf} ({KLINE_COLUMNS})")
    conn.execute(
        "CREATE TABLE IF NOT EXISTS oi_metrics ("
        "create_time INTEGER PRIMARY KEY, sum_open_interest REAL, sum_open_interest_value REAL)"
    )
    conn.execute(
        "CREATE TABLE IF NOT EXISTS ls_metrics ("
        "create_time INTEGER PRIMARY KEY, global_ls REAL, top_account_ls REAL, top_position_ls REAL)"
    )
    conn.execute(
        "CREATE TABLE IF NOT EXISTS downloaded_ranges (type TEXT, start_ms INTEGER, end_ms INTEGER, "
        "PRIMARY KEY (type, start_ms))"
    )
    conn.commit()
    return conn


def _save_klines(conn: sqlite3.Connection, tf: str, klines: list) -> None:
    rows = [
        (k[0], float(k[1]), float(k[2]), float(k[3]), float(k[4]), float(k[5]),
         k[6], float(k[7]), int(k[8]), float(k[9]), float(k[10]))
        for k in klines
    ]
    conn.executemany(
        f"INSERT OR REPLACE INTO klines_{tf} VALUES (?,?,?,?,?,?,?,?,?,?,?)", rows
    )
    conn.commit()


def _save_oi(conn: sqlite3.Connection, oi_rows: list) -> None:
    rows = [(r["timestamp"], float(r["sumOpenInterest"]), float(r["sumOpenInterestValue"])) for r in oi_rows]
    conn.executemany("INSERT OR REPLACE INTO oi_metrics VALUES (?,?,?)", rows)
    conn.commit()


def _save_ls(conn: sqlite3.Connection, global_rows: list, top_acct_rows: list, top_pos_rows: list) -> None:
    by_ts: dict[int, dict] = {}
    for r in global_rows:
        by_ts.setdefault(r["timestamp"], {})["global_ls"] = float(r["longShortRatio"])
    for r in top_acct_rows:
        by_ts.setdefault(r["timestamp"], {})["top_account_ls"] = float(r["longShortRatio"])
    for r in top_pos_rows:
        by_ts.setdefault(r["timestamp"], {})["top_position_ls"] = float(r["longShortRatio"])
    rows = [
        (ts, v.get("global_ls"), v.get("top_account_ls"), v.get("top_position_ls"))
        for ts, v in by_ts.items()
    ]
    conn.executemany("INSERT OR REPLACE INTO ls_metrics VALUES (?,?,?,?)", rows)
    conn.commit()


def _is_downloaded(conn: sqlite3.Connection, dtype: str, start_ms: int, end_ms: int) -> bool:
    row = conn.execute(
        "SELECT 1 FROM downloaded_ranges WHERE type=? AND start_ms<=? AND end_ms>=?",
        (dtype, start_ms, end_ms),
    ).fetchone()
    return row is not None


def _mark_downloaded(conn: sqlite3.Connection, dtype: str, start_ms: int, end_ms: int) -> None:
    conn.execute("INSERT OR REPLACE INTO downloaded_ranges VALUES (?,?,?)", (dtype, start_ms, end_ms))
    conn.commit()


# ── Ana akış ─────────────────────────────────────────────────────────

def now_ms() -> int:
    return int(datetime.now(tz=timezone.utc).timestamp() * 1000)


def days_ago_ms(days: float) -> int:
    return int((datetime.now(tz=timezone.utc) - timedelta(days=days)).timestamp() * 1000)


def build_hard_coin_universe(verbose: bool = True) -> list[str]:
    """USDT perpetual evrenini tarar, ATR14/fiyat >= %12 olanları döner."""
    symbols = fetch_usdt_perpetual_universe()
    if verbose:
        print(f"[fetch_data] USDT perpetual evreni: {len(symbols)} sembol")
    hard = []
    for i, sym in enumerate(symbols):
        try:
            daily = fetch_klines(sym, "1d", days_ago_ms(30), now_ms())
            atr_pct = compute_atr14_pct(daily)
            time.sleep(SCAN_PACE_S)
            if atr_pct is not None and atr_pct >= ATR_THRESHOLD_PCT:
                hard.append(sym)
                if verbose:
                    print(f"  [{i+1}/{len(symbols)}] {sym}: ATR14={atr_pct:.1f}% -> SERT")
        except BanSignal as e:
            print(f"[fetch_data] ⛔ Ban sinyali ({sym}), evren taraması durduruldu: {e}")
            break
        except Exception as e:
            if verbose:
                print(f"  [{i+1}/{len(symbols)}] {sym}: hata ({e}), atlanıyor")
    if verbose:
        print(f"[fetch_data] Sert coin sayısı: {len(hard)}")
    return hard


def fetch_symbol_full(symbol: str, verbose: bool = True) -> None:
    conn = _connect(symbol)
    end = now_ms()

    for tf, days in HISTORY_DAYS.items():
        start = days_ago_ms(days)
        if _is_downloaded(conn, f"klines_{tf}", start, end):
            continue
        try:
            kl = fetch_klines(symbol, tf, start, end)
            _save_klines(conn, tf, kl)
            _mark_downloaded(conn, f"klines_{tf}", start, end)
            if verbose:
                print(f"    {symbol} klines_{tf}: {len(kl)} bar")
        except BanSignal as e:
            print(f"[fetch_data] ⛔ Ban sinyali ({symbol} {tf}): {e}")
            conn.close()
            raise

    # OI/L-S — Binance'in 30 günlük kısıtı
    oi_start = days_ago_ms(OI_LS_DAYS)
    if not _is_downloaded(conn, "oi", oi_start, end):
        try:
            oi = fetch_oi_history(symbol, "5m", oi_start, end)
            _save_oi(conn, oi)
            _mark_downloaded(conn, "oi", oi_start, end)
            if verbose:
                print(f"    {symbol} OI: {len(oi)} kayıt")
        except BanSignal as e:
            print(f"[fetch_data] ⛔ Ban sinyali ({symbol} OI): {e}")
            conn.close()
            raise

    if not _is_downloaded(conn, "ls", oi_start, end):
        try:
            g = fetch_ls_ratio(symbol, "globalLongShortAccountRatio", "5m", oi_start, end)
            ta = fetch_ls_ratio(symbol, "topLongShortAccountRatio", "5m", oi_start, end)
            tp = fetch_ls_ratio(symbol, "topLongShortPositionRatio", "5m", oi_start, end)
            _save_ls(conn, g, ta, tp)
            _mark_downloaded(conn, "ls", oi_start, end)
            if verbose:
                print(f"    {symbol} L/S: global={len(g)} topAcct={len(ta)} topPos={len(tp)}")
        except BanSignal as e:
            print(f"[fetch_data] ⛔ Ban sinyali ({symbol} L/S): {e}")
            conn.close()
            raise

    conn.close()


def main():
    os.makedirs(DATA_DIR, exist_ok=True)
    hard_coins = build_hard_coin_universe()
    with open(os.path.join(DATA_DIR, "hard_coin_universe.json"), "w") as f:
        json.dump(hard_coins, f, indent=2)

    for i, sym in enumerate(hard_coins):
        print(f"[fetch_data] ({i+1}/{len(hard_coins)}) {sym} veri çekiliyor...")
        try:
            fetch_symbol_full(sym)
        except BanSignal:
            print("[fetch_data] Ban sinyali nedeniyle tüm işlem durduruldu.")
            break


if __name__ == "__main__":
    main()
