# gorevler2.md Görev 13 — Alarm Listesi UI (Tamamlandı)

**Tarih:** 2026-08-11

## Kapsam

Kullanıcı isteği: "Görev 13 başla. Pencere düzeni ve görselleri, ok
butonlarının şekilleri bire bir TV benzer olsun." Sonra netleştirme:
"navbardaki ikonu değiştirme, menüleri TV benzeri yap" — navbar'ın mevcut
Alert ikonuna dokunulmadı, yeni panel/menünün kendisi TV tarzında tasarlandı.

## Yapılanlar

### Yeni sidebar sekmesi: `rsb-alerts`

`index.html`'de sağ sidebar'a Watchlist/Alarm'ın yanına yeni bir "Alerts"
butonu + `dp-alerts-tab` içerik alanı eklendi. **AlarmSignalHistory**'nin
(`dp-alarm-tab`, Kom1/2/3 strateji sinyal kartları) içeriğinden TAMAMEN
ayrı — bu, `AlertStore`'daki (Görev 11.5/11.6) kullanıcı tarafından
oluşturulan fiyat alarmlarının listesi.

### `js/screener/alert-list-panel.js` (yeni)

TradingView'ın Alerts panel düzenine yakın:
- **Filtre segmentleri:** All / Active / Triggered.
- **Arama kutusu:** sembole göre filtreler.
- **Her satırda:** condition ikonu (Crossing=X, Crossing Up=↗, Crossing
  Down=↘ — TV'nin kendi SVG kaynağına erişimimiz olmadığı için aynı
  kavramsal anlamda kendi çizdiğimiz glyph'ler), sembol, condition+fiyat,
  kaynak (çizim aracı adı veya "Manual") + mesaj, durum rozeti
  (Active=yeşil, Triggered=sarı, Expired=soluk), düzenle (kalem) ve sil
  (çöp) ikon butonları.
- Satıra tıklayınca `symbol:change` emit edilir, chart o sembole gider.
- `AlertStore`'un `alert:created/removed/updated/triggered` event'lerini
  dinler, panel açıkken canlı güncellenir.

### `AlertStore.updateAlert(id, fields)` (yeni)

Kısmi patch — sadece verilen alanlar güncellenir. Düzenlenince
`triggered`/`lastKnownPrice` sıfırlanır (alarm yeniden aktif sayılır).

### Create Alert modalı → düzenleme modu

`js/core/app.js` `_bindAlarmModal`, `EventBus.emit('modal:alarm:open', {editAlertId})`
ile açılınca AYNI modalı düzenleme moduna çeviriyor: başlık "Edit alert on
{symbol}", tüm alanlar mevcut değerlerle önceden dolu, buton "Save",
tıklanınca `createFromDrawing`/`createManual` yerine `updateAlert` çağırıyor.

## Bulunan ve düzeltilen kritik bug

Test sırasında (edit akışını doğrularken) fiyat/condition/mesaj
değişikliklerinin **hiç kaydedilmediği** fark edildi. Kök neden: hem
CREATE hem EDIT click handler'ında `close()` (modalın `backdrop.remove()`'u)
form alanlarını (özellikle `#alarm-modal-price`) okumadan ÖNCE
çağrılıyordu — `close()` DOM'dan elementi kaldırdığı için sonraki
`document.getElementById('alarm-modal-price')?.value` her zaman
`undefined` dönüyor, `if (!price) return;` ile SESSİZCE (hatasız) hiçbir
şey yapmadan çıkılıyordu. Bu, manuel (çizim kaynaksız) alarmlarda hem
create hem update için geçerliydi — sadece çizim-kaynaklı alarmlar
(fiyat input'u hiç yok, DOM'a bağımlı değil) etkilenmiyordu, bu yüzden
önceki turlarda (Görev 11.6) fark edilmemişti (o zaman sadece çizim
kaynaklı senaryolar test edilmişti).

**Düzeltme:** Form değerleri artık `close()`'dan ÖNCE okunuyor.

## 2. tur (aynı gün) — kullanıcı TV ekran görüntüleri paylaştı

Kullanıcı 6 ekran görüntüsü paylaştı (Create Alert modalı, alarm listesi,
hover tooltip, silme onayı, alarm çizgisi) ve şu geri bildirimi verdi:
çizgi kırmızı/dolgun değil TV'deki gibi gri-beyaz kesikli olmalı; liste
rozetleri "çocuksu/neon" görünüyor; silme öncesi onay olmalı; satır
üzerinde detay balonu olmalı; "navbardaki ikonu değiştirme."

### Çizgi rengi

`AlertStore.DEFAULT_PREFS.alertLinesColor`: `#f23645` → `#9598a1`.
Chart Settings → Alerts sekmesindeki renk seçicisi zaten bu tercihe
bağlıydı (doğrulandı) — sadece varsayılan renk yanlıştı, mekanizmanın
kendisi zaten çalışıyordu. Çizgi stili zaten `Dashed` idi (kod incelemesiyle
doğrulandı), sadece rengi kırmızıydı.

### Liste paneli — TV'ye hizalama

`js/screener/alert-list-panel.js` büyük ölçüde yeniden yazıldı:
- Rozet/pill'ler kaldırıldı, TV'deki gibi düz renkli durum metni:
  "Live" (`#4caf7d`), "Stopped — Triggered" (`#e0a030`), "Stopped —
  Expired" (`#e05c5c`).
- İki satırlı satır düzeni: üst satır başlık ("{Symbol}, {TF}, {Condition}
  {Kaynak/Fiyat}"), alt satır sembol+TF+durum.
- Play/pause (⏸/▶), düzenle (kalem), sil (çöp) ikonları sağda; tarih en
  sağda.
- Hover'da (`mouseover`/`mouseout`) TV'ninkine yakın bir detay balonu:
  başlık, durum, Created/Last triggered/Expires zamanları, mesaj.
- Silme artık `_confirmDelete()` ile TV'nin "Delete this alert?"
  diyaloğuyla aynı düzende onay istiyor.

### Yeni `tf` alanı

`AlertStore._extraOpts`'a `tf` eklendi — Create Alert modalı açıldığında
zaten hesaplanan `window.LayoutManager.getActivePane().tf` değeri artık
alarma da kaydediliyor, liste/başlık/tooltip "SYMBOL, TF" gösterebiliyor
(TV'nin kendi liste satırlarındaki gibi).

### Bulunan ve düzeltilen 2. bug: Play/Pause ters çalışıyordu

Test sırasında (tetikle → restart → durdur sırası) fark edildi: "Restart"
(duraklatılmış/tetiklenmiş bir alarmı yeniden aktif etme) butonu bazen
alarmı **durdurmuş** hâle getiriyordu. Kök neden: `active: !a.active`
kullanılıyordu, ama tetiklenmiş bir alarmda `a.active` zaten `true`
kalıyordu (sadece `a.triggered` `true` oluyordu) — `!true = false`,
yani "Restart" YANLIŞ YÖNE gidiyordu. **Düzeltme:** hedef durum artık
gösterilen ikonun (`isPaused`) anlamına göre AÇIKÇA belirleniyor —
duraklatılmışsa her zaman `{active:true, triggered:false}`, aktifse
her zaman `{active:false}`.

### Doğrulama (2. tur, tarayıcıda gerçek modüllerle)

- Ekran görüntüsü: rozet/pill yok, düz renkli durum metni doğru render
  oluyor (Live yeşil, Stopped — Triggered turuncu). ✅
- Silme onay diyaloğu: "Delete this alert?" + açıklama + Cancel/Delete
  (kırmızı) — TV ekran görüntüsüyle karşılaştırıldı, aynı düzen. Delete'e
  basınca gerçekten siliyor, Cancel/X kapatıp silmiyor. ✅
- Hover tooltip: doğru sembol/TF/durum/Created/Last triggered içeriğiyle
  açılıyor. ✅
- Play/Pause: temiz bir test senaryosuyla (tetikle→restart→durdur) her
  adımda `active`/`triggered` doğru değerlere ulaştığı doğrulandı (bug
  düzeltmesi sonrası — düzeltmeden önce hatalı davranış canlı olarak
  gözlemlenip doğrulandı, sonra düzeltilip yeniden test edildi). ✅
- Konsol hatasız (bilinen sandbox ağ hataları hariç). ✅

## Doğrulama (1. tur, tarayıcıda, gerçek modüllerle)

1. Manuel create (fiyat=150, condition='below') → `AlertStore`'da doğru
   kaydedildiği doğrulandı (bug düzeltmesi sonrası). ✅
2. Edit: mevcut bir alarmın fiyatı 65000→70000, condition crossing→above,
   mesaj değiştirildi, "Save" sonrası `AlertStore`'da gerçekten güncellendi. ✅
3. Silme: `AlertListPanel`'den silinen alarm listeden ve `AlertStore`'dan
   kayboldu (1→0). ✅
4. Filtreler: 5 test alarmıyla All=5, Active=4, Triggered=1 doğru sayıldı. ✅
5. Satır tıklama: `symbol:change` doğru sembolle tetiklendi. ✅
6. Ekran görüntüsüyle görsel doğrulama — filtre segmentleri, condition
   ikonları, durum rozetleri, edit/sil ikonları düzgün render oluyor. ✅
7. Konsol hatasız (bilinen sandbox ağ hataları hariç). ✅

## Regresyon

- Navbar'ın mevcut Alert ikonuna/davranışına dokunulmadı.
- AlarmSignalHistory (Kom1/2/3 kartları) etkilenmedi.
- Property toolbar zil ikonu ve Navbar Alert butonu hâlâ aynı modalı
  paylaşıyor (create modu, değişmedi).

## Değişen/yeni dosyalar

- `index.html` (yeni sidebar butonu + `dp-alerts-tab` + script tag)
- `js/screener/alert-list-panel.js` (yeni, 2. turda TV'ye hizalanacak
  şekilde büyük ölçüde yeniden yazıldı)
- `js/screener/alert-store.js` (`updateAlert` eklendi; 2. tur: `tf` alanı,
  `alertLinesColor` varsayılanı gri-beyaza çevrildi)
- `js/chart/ui/chart-settings.js` (2. tur: Alerts sekmesindeki gösterilen
  varsayılan renk swatch'ı güncellendi)
- `js/core/app.js` (`_bindSidebar` genişletildi, `_bindAlarmModal` edit
  moduna + kritik bug düzeltmesine kavuştu; 2. tur: `tf` alarma geçiliyor)
