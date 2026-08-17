# Kom1 ATR Filtresi x Sinyal Kalitesi — Çapraz Analiz (üretime GİRMEDİ)

⚠️ Metodoloji notu: bu, sabit-ufuklu bir backtest DEĞİL — önceki 'sinyal kalitesi' raporuyla aynı kaba yöntem (giriş fiyatı vs ŞU ANKİ fiyat). Farklı yaşta sinyaller farklı sürelerde 'olgunlaşmış' — istatistiksel olarak gürültülü, ama filtrenin genel yönünü göstermeye yeter.

## Grup karşılaştırması

| Grup | n | Kazanma Oranı | Ort. Getiri | Medyan Getiri |
|---|---|---|---|---|
| Tüm sinyaller | 200 | %45.5 | %+0.03 | %-0.21 |
| Filtreden GEÇEN (sakin) | 117 | %35.0 | %-0.27 | %-0.42 |
| ELENEN (toplam) | 83 | %60.2 | %+0.45 | %+1.22 |
|   - sadece sert | 78 | %59.0 | %+0.46 | %+1.31 |
|   - sadece hareketsiz | 5 | %80.0 | %+0.27 | %+0.16 |

## En çok sinyal üreten 3 elenen SERT coin

- LABUSDT (ATR=17.94%): n=13, win_rate=%15.4 avg_ret=%-3.58 median_ret=%-4.98
- BICOUSDT (ATR=61.87%): n=12, win_rate=%66.7 avg_ret=%+2.44 median_ret=%+5.85
- ALLOUSDT (ATR=12.79%): n=11, win_rate=%100.0 avg_ret=%+3.17 median_ret=%+3.60

## Elenen 4 HAREKETSİZ coin

- BTCDOMUSDT (ATR=0.87%): n=2, win_rate=%100.0 avg_ret=%+0.26 median_ret=%+0.26
- 1000FLOKIUSDT (ATR=3.00%): n=1, win_rate=%0.0 avg_ret=%-0.39 median_ret=%-0.39
- ANKRUSDT (ATR=2.94%): n=1, win_rate=%100.0 avg_ret=%+1.10 median_ret=%+1.10
- HBARUSDT (ATR=2.59%): n=1, win_rate=%100.0 avg_ret=%+0.11 median_ret=%+0.11
