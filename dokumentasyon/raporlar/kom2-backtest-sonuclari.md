# Kom2 Backtest Sonuçları

_Sert coin evreni: 80 sembol (ATR14/fiyat >= %12.0), veri yüklenen: 80. Hacim tier eşikleri (33/66 persentil): 5M / 14M._

## Yol A — Divergence (RSI/fiyat), lookback taraması

**En iyi lookback (≥5 örneklemli, +4h medyan net getiriye göre): 20**

| Lookback | Sinyal | +1h | +4h | +1d |
|---|---|---|---|---|
| 5 | 1896 | %-0.19 | %-0.30 | %-0.18 |
| 6 | 1724 | %-0.14 | %-0.14 | %-0.21 |
| 7 | 1559 | %-0.23 | %-0.19 | %-0.25 |
| 8 | 1411 | %-0.26 | %-0.20 | %-0.28 |
| 9 | 1317 | %-0.25 | %-0.20 | %-0.07 |
| 10 | 1225 | %-0.14 | %-0.14 | %-0.27 |
| 11 | 1187 | %-0.20 | %-0.24 | %-0.39 |
| 12 | 1110 | %-0.14 | %-0.24 | %-0.32 |
| 13 | 1049 | %-0.17 | %-0.30 | %-0.21 |
| 14 | 993 | %-0.14 | %-0.27 | %-0.45 |
| 15 | 937 | %-0.35 | %-0.24 | %-0.47 |
| 16 | 895 | %-0.20 | %-0.25 | %+0.05 |
| 17 | 867 | %-0.17 | %-0.14 | %-0.07 |
| 18 | 840 | %-0.22 | %-0.20 | %-0.30 |
| 19 | 798 | %-0.18 | %-0.22 | %-0.20 |
| 20 | 750 | %-0.24 | %-0.11 | %-0.03 |

## Yol B — OI Kalıcılık Testi + L/S Filtresi, parametre taraması

**En iyi kombinasyon (≥5 örneklemli, +4h medyan net getiriye göre): (20, 7, 10, 'global_below_1')**

| Eşik% | Gün | Pullback% | L/S Varyant | Sinyal | +1h | +4h | +1d |
|---|---|---|---|---|---|---|---|
| 15 | 7 | 20 | top_above_1 | 9134 | %-0.26 | %-0.30 | %-0.68 |
| 15 | 5 | 20 | top_above_1 | 8581 | %-0.24 | %-0.30 | %-0.83 |
| 15 | 3 | 20 | top_above_1 | 7469 | %-0.29 | %-0.41 | %-1.51 |
| 20 | 7 | 20 | top_above_1 | 7056 | %-0.29 | %-0.40 | %-1.35 |
| 20 | 5 | 20 | top_above_1 | 6303 | %-0.30 | %-0.42 | %-1.33 |
| 15 | 7 | 20 | global_declining | 5859 | %-0.19 | %-0.20 | %-0.74 |
| 25 | 7 | 20 | top_above_1 | 5823 | %-0.30 | %-0.47 | %-1.59 |
| 15 | 5 | 20 | global_declining | 5692 | %-0.15 | %-0.18 | %-0.95 |
| 20 | 3 | 20 | top_above_1 | 5410 | %-0.38 | %-0.62 | %-2.35 |
| 25 | 5 | 20 | top_above_1 | 5218 | %-0.32 | %-0.50 | %-1.67 |
| 15 | 3 | 20 | global_declining | 5167 | %-0.14 | %-0.22 | %-1.33 |
| 15 | 7 | 20 | combined | 4958 | %-0.24 | %-0.23 | %-0.65 |
| 20 | 7 | 20 | global_declining | 4631 | %-0.16 | %-0.23 | %-1.27 |
| 15 | 5 | 20 | combined | 4627 | %-0.19 | %-0.23 | %-0.78 |
| 25 | 3 | 20 | top_above_1 | 4411 | %-0.45 | %-0.74 | %-2.81 |
| 15 | 5 | 10 | top_above_1 | 4317 | %-0.16 | %-0.30 | %-0.49 |
| 20 | 5 | 20 | global_declining | 4311 | %-0.14 | %-0.19 | %-1.17 |
| 15 | 7 | 10 | top_above_1 | 4215 | %-0.15 | %-0.19 | %-0.29 |
| 15 | 3 | 20 | combined | 4151 | %-0.21 | %-0.30 | %-1.08 |
| 15 | 3 | 10 | top_above_1 | 4000 | %-0.18 | %-0.31 | %-0.99 |
| 20 | 7 | 20 | combined | 3861 | %-0.23 | %-0.31 | %-1.19 |
| 25 | 7 | 20 | global_declining | 3812 | %-0.14 | %-0.23 | %-1.58 |
| 20 | 3 | 20 | global_declining | 3788 | %-0.17 | %-0.30 | %-2.39 |
| 25 | 5 | 20 | global_declining | 3591 | %-0.14 | %-0.20 | %-1.47 |
| 20 | 5 | 20 | combined | 3420 | %-0.20 | %-0.32 | %-1.11 |
| 20 | 7 | 10 | top_above_1 | 3363 | %-0.18 | %-0.30 | %-1.17 |
| 25 | 7 | 20 | combined | 3181 | %-0.19 | %-0.31 | %-1.46 |
| 25 | 3 | 20 | global_declining | 3120 | %-0.17 | %-0.39 | %-3.06 |
| 20 | 5 | 10 | top_above_1 | 3074 | %-0.22 | %-0.36 | %-0.96 |
| 15 | 3 | 20 | global_below_1 | 2992 | %-0.10 | %+0.02 | %-0.50 |
| 20 | 3 | 20 | combined | 2940 | %-0.29 | %-0.43 | %-2.07 |
| 15 | 5 | 10 | global_declining | 2914 | %-0.07 | %-0.08 | %-0.48 |
| 15 | 5 | 20 | global_below_1 | 2898 | %-0.14 | %-0.02 | %-1.22 |
| 15 | 7 | 10 | global_declining | 2830 | %-0.08 | %+0.03 | %-0.02 |
| 25 | 5 | 20 | combined | 2824 | %-0.22 | %-0.37 | %-1.52 |
| 15 | 3 | 10 | global_declining | 2813 | %-0.02 | %-0.06 | %-0.74 |
| 20 | 3 | 10 | top_above_1 | 2723 | %-0.14 | %-0.32 | %-1.79 |
| 25 | 7 | 10 | top_above_1 | 2655 | %-0.23 | %-0.44 | %-1.73 |
| 15 | 7 | 20 | global_below_1 | 2518 | %-0.05 | %+0.25 | %-0.62 |
| 25 | 3 | 20 | combined | 2403 | %-0.29 | %-0.52 | %-2.62 |
| 25 | 5 | 10 | top_above_1 | 2379 | %-0.20 | %-0.47 | %-1.65 |
| 15 | 5 | 10 | combined | 2309 | %-0.14 | %-0.22 | %-0.39 |
| 20 | 7 | 10 | global_declining | 2291 | %-0.02 | %+0.02 | %-0.83 |
| 20 | 5 | 20 | global_below_1 | 2288 | %-0.10 | %-0.01 | %-0.81 |
| 15 | 7 | 10 | combined | 2287 | %-0.14 | %-0.10 | %-0.07 |
| 20 | 7 | 20 | global_below_1 | 2204 | %-0.02 | %+0.33 | %-0.67 |
| 20 | 5 | 10 | global_declining | 2200 | %-0.02 | %+0.04 | %-0.45 |
| 20 | 3 | 20 | global_below_1 | 2193 | %-0.13 | %-0.34 | %-2.39 |
| 15 | 3 | 10 | combined | 2178 | %-0.11 | %-0.20 | %-0.49 |
| 25 | 3 | 10 | top_above_1 | 2115 | %-0.24 | %-0.46 | %-2.42 |
| 20 | 3 | 10 | global_declining | 1971 | %+0.07 | %+0.18 | %-1.33 |
| 25 | 5 | 20 | global_below_1 | 1854 | %-0.12 | %-0.02 | %-0.54 |
| 25 | 7 | 10 | global_declining | 1842 | %+0.03 | %+0.02 | %-1.30 |
| 20 | 7 | 10 | combined | 1799 | %-0.14 | %-0.14 | %-0.80 |
| 25 | 7 | 20 | global_below_1 | 1766 | %-0.02 | %+0.14 | %-0.73 |
| 25 | 3 | 20 | global_below_1 | 1748 | %-0.14 | %-0.42 | %-3.27 |
| 25 | 5 | 10 | global_declining | 1722 | %+0.02 | %+0.11 | %-1.03 |
| 20 | 5 | 10 | combined | 1650 | %-0.14 | %-0.18 | %-0.47 |
| 15 | 3 | 10 | global_below_1 | 1600 | %+0.09 | %+0.20 | %-0.99 |
| 25 | 3 | 10 | global_declining | 1562 | %+0.09 | %+0.09 | %-2.12 |
| 15 | 5 | 10 | global_below_1 | 1484 | %-0.02 | %+0.30 | %-1.35 |
| 20 | 3 | 10 | combined | 1420 | %-0.07 | %-0.09 | %-1.22 |
| 25 | 7 | 10 | combined | 1393 | %-0.08 | %-0.22 | %-1.28 |
| 15 | 7 | 10 | global_below_1 | 1286 | %+0.08 | %+0.75 | %-0.40 |
| 25 | 5 | 10 | combined | 1244 | %-0.11 | %-0.19 | %-1.17 |
| 20 | 3 | 10 | global_below_1 | 1154 | %+0.37 | %+0.21 | %-2.11 |
| 20 | 5 | 10 | global_below_1 | 1134 | %+0.19 | %+0.33 | %-1.21 |
| 20 | 7 | 10 | global_below_1 | 1123 | %+0.26 | %+0.86 | %-0.90 |
| 25 | 3 | 10 | combined | 1101 | %-0.11 | %-0.25 | %-1.55 |
| 25 | 7 | 10 | global_below_1 | 914 | %+0.40 | %+0.83 | %-1.22 |
| 25 | 5 | 10 | global_below_1 | 905 | %+0.29 | %+0.56 | %-0.19 |
| 25 | 3 | 10 | global_below_1 | 887 | %+0.43 | %+0.48 | %-2.60 |

## Birleşik — En İyi Divergence + En İyi OI/L-S (aynı anda aktif)

### Havuzlanmış (her iki yol birlikte)

| Ufuk | Örneklem | Pozitif Oran | Medyan Net | Medyan Brüt |
|---|---|---|---|---|
| +1 saat | 1870 | %51.4 | %-0.07 | %+0.07 |
| +4 saat | 1864 | %54.7 | %+0.32 | %+0.46 |
| +1 gün | 1800 | %48.7 | %-0.43 | %-0.29 |

- Divergence-yolu sinyal sayısı: 750
- OI-kalıcılık-yolu sinyal sayısı: 1123

# BANK (10-11 Temmuz 2026) — Kom2 Doğrulama Sonucu

**Kısıt:** OI/L-S geçmişi Binance'te sadece son ~30 gün tutuluyor, 10-11 Temmuz bu pencerenin dışında — **sadece divergence-yolu test edildi**, OI kalıcılık-yolu bu tarih için hiç test edilemedi (veri yok).

- BANKUSDT 1h: 2929 bar çekildi (2026-04-01 → 2026-08-01)
- BANKUSDT 4h: 733 bar çekildi (2026-04-01 → 2026-08-01)
- BANKUSDT 1d: 123 bar çekildi (2026-04-01 → 2026-08-01)

## Sonuç

✅ **9 divergence sinyali 10-11 Temmuz penceresinde (2026-07-08–2026-07-13) bulundu:**

| Lookback | TF | Zaman | Fiyat |
|---|---|---|---|
| 5 | 1h | 2026-07-08 23:00:00+00:00 | 0.03466 |
| 13 | 4h | 2026-07-10 16:00:00+00:00 | 0.03676 |
| 14 | 4h | 2026-07-10 20:00:00+00:00 | 0.03648 |
| 15 | 4h | 2026-07-11 00:00:00+00:00 | 0.03622 |
| 16 | 4h | 2026-07-11 04:00:00+00:00 | 0.03669 |
| 17 | 4h | 2026-07-11 08:00:00+00:00 | 0.03769 |
| 18 | 4h | 2026-07-11 12:00:00+00:00 | 0.04228 |
| 19 | 4h | 2026-07-11 16:00:00+00:00 | 0.04087 |
| 20 | 4h | 2026-07-11 20:00:00+00:00 | 0.04138 |

## Genel bağlam — BANK'ın tüm dönemdeki (Nisan-Ağustos) divergence sinyalleri

Toplam 409 aday divergence sinyali bulundu (tüm lookback/TF kombinasyonları toplamı, çakışmalı sayım).

Bu, BANK'ın divergence-yolu için TAMAMEN sinyalsiz olmadığını gösteriyor — sadece TAM OLARAK 10-11 Temmuz'daki kurulumu kaçırıyor (spesifik zaaf, genel değil).

## Kom1 ile Karşılaştırma İçin Not

Kom1'in orijinal doğrulaması: 30 coin, ~6900 sinyal, +4h medyan net **+%0.31** (bkz. `dokumentasyon/gorevler/sinyal-sistemi-pintrade-entegrasyon.md` §2). Yukarıdaki Kom2 sonuçları bu referansla karşılaştırılabilir — aynı ufuklar (+1h/+4h/+1d), aynı %0.14 round-trip maliyet varsayımı, aynı <10 örneklem uyarı eşiği kullanıldı.