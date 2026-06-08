# PinTrade — Servis Hesapları ve Deployment Özeti

## Aktif Servisler

| Servis | URL | Ne için | Durum |
|--------|-----|---------|-------|
| GitHub | github.com/sresul82 | Kod deposu + Frontend (GitHub Pages) | ✅ Aktif |
| Render | render.com | Backend (Node.js proxy + MongoDB sync) | ✅ Aktif |
| MongoDB Atlas | mongodb.com | Veritabanı (çizim sync) | ✅ Aktif |
| UptimeRobot | uptimerobot.com | Render'ı uyanık tutar (5 dk ping) | ✅ Aktif |
| Railway | railway.app | Eski backend — devre dışı | ⛔ Kullanılmıyor |

---

## Frontend
**GitHub Pages** → `https://sresul82.github.io/Pintrade`
- Ücretsiz, sınırsız
- Her `main` push'ta otomatik güncellenir

## Backend
**Render.com** → `https://pintrade.onrender.com`
- Ücretsiz Free tier
- Frankfurt (EU) — Binance API erişimi için
- Uyku modu: 15 dk hareketsizlikte uyur → UptimeRobot ile çözüldü

---

## Railway Hakkında
Railway artık kullanılmıyor. Silmesen de sorun olmaz ama repo bağlantısını kesmek için:
- Railway dashboard → Pintrade servisi → Settings → Delete Service

---

## Ücretli Versiyona Geçiş Planı

### Senin ihtiyaçların:
- 7/24 ayakta backend (OI/Funding geçmiş veri kaydı için)
- Sürekli veri toplama (tarayıcı kapalıyken bile)
- Düşük maliyet

### Seçenekler:

| Servis | Fiyat | Avantaj | Dezavantaj |
|--------|-------|---------|------------|
| **Render Starter** | $7/ay | Uyku yok, aynı platform, kolay geçiş | Sadece 512MB RAM |
| **Fly.io** | ~$2-3/ay | En ucuz 7/24, Frankfurt mevcut | Kurulum biraz daha karmaşık |
| **Railway Hobby** | $5 kredi/ay | Tanıdık platform | Kredi bitince duruyor (yaşadığımız sorun) |
| **VPS (Hetzner)** | €4/ay | Tam kontrol, 2GB RAM, kalıcı disk | Sunucu yönetimi gerektirir |

### Tavsiye:
Geliştirme aşaması bitince **Render Starter ($7/ay)** en mantıklısı:
- Mevcut kurulumu aynen korursun, sadece instance type değiştirirsin
- Uyku modu kalkar, UptimeRobot'a gerek kalmaz
- 7/24 veri toplama yapılabilir
- Frankfurt bölgesi korunur
