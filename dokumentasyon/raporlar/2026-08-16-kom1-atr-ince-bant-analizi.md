# Kom1 ATR — İnce Bant Analizi (Sabit Ufuklu, Look-ahead'siz)

Hipotez: doğrusal olmayan ilişki — aşırı sakin kötü, orta-sert iyi, aşırı sert yine kötü olabilir. `analyze_kom1_atr_backtest.py`'nin ürettiği sinyal-anı ATR + sabit-ufuklu getiri verisi yeniden kullanıldı (Binance'e tekrar istek atılmadı).

**Toplam sinyal: 200**

## Ufuk: +1 saat

| Bant | n | Kazanma Oranı | Ort. Net | Medyan Net | Ort. Brüt |
|---|---|---|---|---|---|
| %0-3 (hareketsiz) | 3 ⚠️ DÜŞÜK ÖRNEKLEM | %33.3 | %-0.17 | %-0.28 | %-0.03 |
| %3-12 (mevcut 'sakin') | 117 | %41.9 | %-0.32 | %-0.24 | %-0.18 |
| %12-30 | 56 | %55.4 | %+0.10 | %+0.22 | %+0.24 |
| %30-70 | 18 | %38.9 | %-0.57 | %-0.55 | %-0.43 |
| %70-150 | 1 ⚠️ DÜŞÜK ÖRNEKLEM | %0.0 | %-1.93 | %-1.93 | %-1.79 |
| %150+ (BEATUSDT bölgesi) | 3 ⚠️ DÜŞÜK ÖRNEKLEM | %33.3 | %-1.71 | %-1.22 | %-1.57 |
## Ufuk: +4 saat

| Bant | n | Kazanma Oranı | Ort. Net | Medyan Net | Ort. Brüt |
|---|---|---|---|---|---|
| %0-3 (hareketsiz) | 3 ⚠️ DÜŞÜK ÖRNEKLEM | %33.3 | %-0.17 | %-0.19 | %-0.03 |
| %3-12 (mevcut 'sakin') | 115 | %40.0 | %-0.43 | %-0.37 | %-0.29 |
| %12-30 | 56 | %62.5 | %+0.14 | %+0.59 | %+0.28 |
| %30-70 | 18 | %16.7 | %-5.09 | %-6.00 | %-4.95 |
| %70-150 | 1 ⚠️ DÜŞÜK ÖRNEKLEM | %0.0 | %-2.14 | %-2.14 | %-2.00 |
| %150+ (BEATUSDT bölgesi) | 3 ⚠️ DÜŞÜK ÖRNEKLEM | %33.3 | %-9.56 | %-10.95 | %-9.42 |
## Ufuk: +1 gün

| Bant | n | Kazanma Oranı | Ort. Net | Medyan Net | Ort. Brüt |
|---|---|---|---|---|---|
| %0-3 (hareketsiz) | 2 ⚠️ DÜŞÜK ÖRNEKLEM | %100.0 | %+0.11 | %+0.11 | %+0.25 |
| %3-12 (mevcut 'sakin') | 55 | %43.6 | %-0.38 | %-0.32 | %-0.24 |
| %12-30 | 30 | %56.7 | %-1.77 | %+0.52 | %-1.63 |
| %30-70 | 14 | %71.4 | %+1.25 | %+5.15 | %+1.39 |
| %70-150 | 0 | — | — | — | — |
| %150+ (BEATUSDT bölgesi) | 2 ⚠️ DÜŞÜK ÖRNEKLEM | %0.0 | %-28.98 | %-28.98 | %-28.84 |

## Bant içerikleri (hangi coin/sinyal hangi bantta)

**%0-3 (hareketsiz)** (3 sinyal, 2 sembol): BTCDOMUSDT(2), HBARUSDT(1)

**%3-12 (mevcut 'sakin')** (119 sinyal, 54 sembol): 1000PEPEUSDT(10), ADAUSDT(8), BABYUSDT(7), ARBUSDT(6), APTUSDT(5), BILLUSDT(5), SOONUSDT(4), ZAMAUSDT(4), EDGEUSDT(4), AAVEUSDT(3), FETUSDT(3), BANDUSDT(3), STABLEUSDT(3), PEOPLEUSDT(3), GMTUSDT(3), INJUSDT(3), ZROUSDT(3), DASHUSDT(2), PUMPUSDT(2), UNIUSDT(2), VELODROMEUSDT(2), AUSDT(2), DATAIPUSDT(1), BARDUSDT(1), ARXUSDT(1), ALICEUSDT(1), ALCHUSDT(1), AKTUSDT(1), ANKRUSDT(1), 1MBABYDOGEUSDT(1), 1000CHEEMSUSDT(1), 1000FLOKIUSDT(1), 1000SHIBUSDT(1), 1000000MOGUSDT(1), FLOWUSDT(1), FLUIDUSDT(1), ESPUSDT(1), EVAAUSDT(1), ORCAUSDT(1), MASKUSDT(1), LINEAUSDT(1), LAUSDT(1), KAIAUSDT(1), GENIUSUSDT(1), FLUXUSDT(1), FORMUSDT(1), SQDUSDT(1), SAFEUSDT(1), RAVEUSDT(1), PYTHUSDT(1), PUMPBTCUSDT(1), UMAUSDT(1), YFIUSDT(1), ZKPUSDT(1)

**%12-30** (56 sinyal, 17 sembol): LABUSDT(13), ALLOUSDT(11), BSBUSDT(7), HOMEUSDT(5), HOLOUSDT(4), KAITOUSDT(2), TAGUSDT(2), SCRTUSDT(2), GIGGLEUSDT(2), JCTUSDT(1), GWEIUSDT(1), GRVTUSDT(1), KGENUSDT(1), MAGMAUSDT(1), SIRENUSDT(1), UAIUSDT(1), ZBTUSDT(1)

**%30-70** (18 sinyal, 5 sembol): BICOUSDT(12), ACEUSDT(2), SKYAIUSDT(2), BLESSUSDT(1), EPICUSDT(1)

**%70-150** (1 sinyal, 1 sembol): BLESSUSDT(1)

**%150+ (BEATUSDT bölgesi)** (3 sinyal, 1 sembol): BEATUSDT(3)
