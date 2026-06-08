# FIX_CHANNEL_3BUGS

Bu dosya, Paralel Kanal (Parallel Channel) aracında yapılan üç kritik düzeltmeyi belgelemektedir.

## 1. Cursor (İmleç) Düzeltmesi
- `P1` ve `P2` köşe noktalarında `arrow` (ok) imleci artık doğru şekilde gösteriliyor.
- Orta ve alt noktalarda `ns-resize` (yukarı/aşağı) imleci; kanalın diğer bölgelerinde ve uzantılarda ise `grab` (el) imleci kullanılmaktadır.

## 2. Hit‑Test ve Uzantı (Extend) Desteği
- `_hitTest` fonksiyonu kanalı genel listeden çıkardı; kanal için özel hit‑test bloğu eklenerek:
  - Tüm aktif seviyeler (`channelLevels`) ve sol/sağ uzantılar (`extendLeft`, `extendRight`) artık fareyle seçilebiliyor.
  - `line` tipi hit‑testi, uzantılı çizgileri ve seviyeleri hesaba katıyor.

## 3. Metin (Text) Render Mantığı
- Kanalın üst çizgisine (`top`), orta seviyesine (`middle`) ve alt çizgisine (`bottom`) metin eklenebiliyor.
- Yatay hizalama (`textAlignH`: left/center/right) ve dikey hizalama (`textAlignV`: top/middle/bottom) tamamen destekleniyor.
- Seçili ama metin olmayan durumda “Add Text” ipucu gösteriliyor.

Bu değişiklikler, **Parallel Channel** aracının tam fonksiyonel ve görsel bütünlüğünü geri getirmektedir.
