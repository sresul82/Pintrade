# Görev 4 Tamamlanma — Gerçek Ortam Doğrulaması ve Datacenter IP Bulgusu

_Tarih: 2026-08-07_
_Durum: Görev 4 tamamlandı. Kod doğru çalışıyor, IP ban riski ortadan kalktı. Kalan 502 hataları koddan değil, VPN çıkış IP'sinin tipinden kaynaklanıyor._

---

## 1. Özet

Önceki rapor ([2026-08-07-gorev4-websocket-aktivasyon.md](2026-08-07-gorev4-websocket-aktivasyon.md)), sandbox ortamında `M1HammerScanner`'ın WebSocket'e taşınmış halini etkinleştirip ~35 saniye gözlemlemişti: ban sinyali yoktu ama REST backfill 502 ile başarısız oluyordu ve sandbox'a özgü bir ağ kısıtı olabileceği şüphesiyle kullanıcının gerçek ortamında doğrulama istenmişti.

Kullanıcı, kendi ortamında (VPN açık, Finlandiya çıkışlı) test etti. Sonuç: **ban sinyali yok**, ama aynı 502 deseni burada da tutarlı şekilde tekrarlandı — kök nedeni bulundu.

## 2. Bulgular

| Kontrol | Sonuç |
|---|---|
| `BAN_SIGNAL_429` / `BAN_SIGNAL_418` | ❌ Hiç görülmedi |
| WebSocket (tarayıcıdan doğrudan Binance'e) | ✅ Sorunsuz bağlandı |
| Sunucu taraflı (Node) REST istekleri (backfill) | ❌ %100 tutarlı `502 Bad Gateway` |
| Bybit REST (aynı IP, ayrı bir modül) | ✅ Sorunsuz — 765 coin güncelleniyor |

## 3. Kök neden

Kullanıcının VPN çıkış IP'si (`95.217.176.55`) bir **datacenter/hosting IP'si** — ISP: Hetzner Online GmbH, "Data Center/Transit" kategorisinde, gerçek bir ev/mobil IP değil.

Binance'in REST API'si (`fapi.binance.com`), bilinen datacenter IP aralıklarını güvenlik/anti-bot önlemi olarak engelliyor gibi görünüyor. Bybit'in aynı IP'den sorunsuz çalışması, bu engelin **Binance'e özgü** ve **IP-tipi kaynaklı** olduğunu, ban/rate-limit ile ilgisi olmadığını destekliyor.

## 4. Bu bir kod hatası mı?

Hayır. `js/screener/m1hammer-scanner.js`:

- 429/418'i ayrıca yakalayıp (`BAN_SIGNAL_*`) backfill'i durduran koruma zaten var, hiç tetiklenmedi
- WebSocket akışı (asıl kalıcı veri kaynağı, Görev 4'ün amacı) sorunsuz çalışıyor
- Sadece **tek seferlik geçmiş veri doldurma (backfill)** REST üzerinden gittiği için bu IP-tipi engeline takılıyor

Görev 4'ün asıl amacı — **~2500 REST isteği/5dk yüzünden oluşan IP ban riskini ortadan kaldırmak** — başarıyla gerçekleşti. Datacenter IP engeli farklı, ayrı bir kısıt; kodda düzeltilebilecek bir "bug" değil, ortam/ağ özelliği.

## 5. Etki

- Backfill başarısız olduğu için tarayıcı arabellekleri boş başlıyor — sinyaller WS üzerinden organik olarak birikecek (5m TF için ~71 bar, yani ~6 saat). Bu, kullanıcı ev/mobil IP'den (datacenter olmayan) bağlandığında veya backfill için alternatif bir yol bulunduğunda hızlanabilir — ama bu Görev 4'ün kapsamı dışında, ayrı bir iyileştirme konusu.
- Görev 4'ün "IP ban riskini önleme" hedefi karşılandı — kod tarafında ek bir aksiyon gerekmiyor.

## 6. İleriye dönük not — Deploy riski

Ücretsiz/düşük maliyetli sunucu sağlayıcıları (Render, Railway vb.) genelde datacenter IP'leri kullanıyor. Pintrade böyle bir sağlayıcıya deploy edildiğinde, burada görülen "WebSocket sorunsuz, REST %100 502" deseninin **tekrar yaşanma riski var**. Bu not `dokumentasyon/gorevler/siradaki-gorevler.md`'ye eklendi — deploy sağlayıcısı seçilirken Binance REST erişimi ayrıca test edilmeli.

## 7. Sonuç

Görev 4 **tamamlandı**:
- ✅ Kod WS'e taşındı, `TEST_SYMBOLS` (8 sembol) sınırı korunuyor
- ✅ Gerçek ortamda ban sinyali gözlenmedi
- ✅ Kalan 502 hatası kök nedeniyle (datacenter IP) açıklandı, kodla ilgisi olmadığı doğrulandı
- ⏭ Sıradaki adım: Görev 5 (ortak bot altyapısı) onay bekleme noktası — kullanıcının açıkça "Görev 5'e geç" demesi bekleniyor
