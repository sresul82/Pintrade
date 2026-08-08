# Vertical Line — Text Alignment'tan "Center" Kaldırıldı — 2026-08-03

## İstek

> "Vertikal Line menüsü içinde Text sekmesi içinde Text alignment →
> center seçeneğini kaldır, çünkü inline text edit ve Line sağa sola
> kaydırma özellikleri karışıyor"

## Yapılan

`js/drawing/ui/dsd-tabs/dsd-standard-tabs.js` — `renderTextTab()`
fonksiyonu (Text sekmesi tüm text-destekli araçlar arasında paylaşılıyor:
texttool, trendline, ray, vline, vb.) **sadece `d.tool === 'vline'`
olduğunda** yatay hizalama (`dsd-textAlignH`) select'inden "Center"
seçeneğini çıkaracak şekilde güncellendi — Left ve Right kalıyor.
Diğer araçlarda (trendline, ray, extended, vb.) Center hâlâ mevcut ve
varsayılan.

`js/drawing/core/drawing-core.js` — `_getToolStyle('vline')`'ın
varsayılan `textAlignH` değeri `'center'` → `'right'` yapıldı (artık
seçilemeyen bir değeri varsayılan olarak vermenin bir anlamı yoktu).

## Doğrulama

Gerçek tarayıcıda:
- Önceki test oturumlarından kalan `drawingStyles.vline` önbelleği
  ("son kullanılan ayarı hatırla" mekanizması) temizlendi ki taze
  varsayılan gerçekten test edilebilsin.
- Yeni bir Vertical Line çizildi → ayar diyaloğunun Text sekmesinde
  `dsd-textAlignH` select'inde sadece `["left","right"]` seçenekleri var,
  "right" varsayılan olarak seçili.
- Karşılaştırma için bir Trendline çizildi → aynı select'te hâlâ
  `["left","center","right"]` mevcut, "center" varsayılan — Vertical
  Line dışındaki araçlarda regresyon yok.

## Değişen dosyalar

| Dosya | Değişiklik |
|---|---|
| `js/drawing/ui/dsd-tabs/dsd-standard-tabs.js` | `renderTextTab()`'da vline için "Center" seçeneği kaldırıldı |
| `js/drawing/core/drawing-core.js` | `_getToolStyle('vline')` varsayılan `textAlignH`: `'center'` → `'right'` |

`node --check` her iki dosyada geçti, konsolda hata yok.
