---
name: coding-conventions
description: "Proje boyunca uyulacak dil kuralı. Proje (kod: değişken/fonksiyon/dosya adları VE kullanıcıya gösterilen tüm UI metinleri — buton, label, tooltip, mesaj, placeholder) tamamen İngilizce olmalı. Sadece kullanıcıyla sohbet/yazışma Türkçe kalır. Her kod yazma/düzenleme işleminde geçerli — bilgisayar değişse bile tekrar anlatmaya gerek kalmasın diye buraya yazıldı."
---

# Coding Conventions — Language

## Kural: Proje tamamen İngilizce, sadece sohbet Türkçe

- **Proje İngilizce**: değişken, fonksiyon, class/method, dosya/klasör adları, CSS class/id, event adları, DOM `id`/`data-*` attribute'ları — VE kullanıcıya gösterilen tüm UI metinleri (buton, label, tooltip, hata/boş durum mesajı, placeholder, başlık, tarih/sayı formatı locale'i).
- **Sohbet Türkçe**: Claude ile kullanıcı arasındaki mesajlaşma, açıklamalar, özetler Türkçe kalır. Kod yorumları da proje diliyle (İngilizce) tutarlı olsun; kök `CLAUDE.md`'deki "default olarak yorum yazma" kuralına tabi.
- Yeni yazılan veya düzenlenen her UI metni İngilizce olmalı. Mevcut kod tabanında hâlâ Türkçe UI string'leri varsa (örn. "Sinyal bekleniyor...", "Coin ara...", "Tümü/Kom1/Kom2/Kom3", "SONRAKİ FR", "TAHTA") bunlar kademeli olarak İngilizce'ye çevrilmeli — bir dosyaya dokunurken o dosyadaki Türkçe UI string'lerini de İngilizce'ye çevir.
- İstisna yok: sayı/tarih locale'i (`toLocaleString('tr-TR', ...)` gibi) de İngilizce/uluslararası formata (`en-US` vb.) çevrilmeli, aksi belirtilmedikçe.

## Örnek

```js
// Doğru: hem kod hem UI metni İngilizce
function _getFilteredSignals() { ... }
const komFilter = 'all';
button.textContent = 'All'; // 'Tümü' değil
placeholder = 'Search coin...'; // 'Coin ara...' değil
```

## Neden

Kullanıcı bilgisayar değiştirdiğinde bu kuralı her seferinde tekrar anlatmak istemiyor. Proje genelinde tek dil (İngilizce) standardı benimsendi; Türkçe yalnızca Claude ile yapılan sohbette kullanılır.
