# L/S Popout Çakışması + Renk/Font Düzeltmeleri — 2026-08-01

## İstek

> "1. L/S gostergesi popup butonunun ustune cikmis durumda
> 2. popup ikonlarnin rengini, Bot signal popup butonuyla ayni beyazlikta yap
> 3. En alttaki yatay bant uzerine yerlestirdigin soldaki yeni buton
> rengini, Sistem saat gosterge rengini, ve sag sidebar uzerindeki 3 buton
> rengini, yukaridaki Navbar uzerindeki ikonlarin rengi gibi beyaz yap,
> cunku okumak zorlasiyor. ve alt banttaki yazilari hafif buyut"

## Düzeltmeler

### 1) L/S bar'ı popout ikonunun üstüne çıkıyordu

**Kök neden**: Önceki turda barın genişliğini `width: calc(100% - 20px)`
yaparak küçültmeye çalışmıştım, ama bu flexbox'ta işe yaramadı — satırda
`L/S` başlığı (26px, shrink:0) + bar aynı anda yer alıyor, flex-shrink
algoritması barın nihai genişliğini zaten container genişliği eksi başlık
genişliği olarak hesaplıyordu; benim `calc(100% - 20px)` değerim bu
hesaba hiç girmiyordu (basis olarak kullanılıp shrink ile eziliyordu),
yani pratikte hiçbir şey değişmemişti.

**Düzeltme**: Bar'ı eski haline (`width:100%`) döndürüp, bunun yerine
bar'ı saran **satırın kendisine** (`.dp-split-row`, sadece L/S satırında)
`padding-right: 24px` eklendi. Bu, flex-shrink hesabına doğrudan giren
bir kısıtlama olduğu için bar artık gerçekten 24px daha dar hesaplanıyor
ve ikonun altına/üstüne binmiyor. Tahta satırı bu padding'i almadı (ikon
sadece L/S satırıyla aynı hizada, Tahta'nın buna ihtiyacı yok).

### 2) Popout ikonlarının rengi

`.dp-card-popout` (L/S ve OI Değişimi kartlarındaki ikonlar) rengi
`var(--text-secondary)` (#787b86, soluk gri) idi → `var(--text-primary)`
(#d1d4dc, Bot Signals'ın `#detail-popout` butonuyla ve navbar
ikonlarıyla aynı beyazlık) yapıldı.

### 3) Alt bant + sidebar renkleri ve font büyütme

Aşağıdaki elemanların rengi `var(--text-secondary)` → `var(--text-primary)`
olarak değiştirildi (hepsi navbar ikonlarının kullandığı renkle aynı):
- `.cbb-list-trigger` (alt banttaki link ikonu + "No Preview" etiketi)
- `.rsb-clock-btn` (sistem saati — hem eski sidebar tanımı hem alt
  banttaki hali aynı sınıfı paylaştığı için tek yerden düzeldi)
- `#rsb-clock-tz` (saat dilimi etiketi, önceden ayrıca `var(--text-muted)` idi)
- `.rsb-icon-btn` (sağ sidebar'daki snapshot/theme/settings 3 buton)

Font büyütme ("alt banttaki yazıları hafif büyüt"):
- `.cbb-list-trigger`: 10px → 11px
- `.cbb-arrow`: 9px → 10px
- `.chart-bottom-bar #rsb-clock-time`: 9px → 11px
- `.chart-bottom-bar #rsb-clock-tz`: 8px → 10px

## Doğrulama

Tarayıcıda gerçek DOM üzerinde ölçüldü.

| Test | Sonuç |
|---|---|
| L/S bar sağ kenarı vs popout ikonu sol kenarı | ✅ bar:640px, ikon:650px → 10px boşluk, çakışma yok |
| `dp-card-popout` rengi | ✅ `rgb(209,212,220)` (= `--text-primary`) |
| `cbb-list-trigger` rengi | ✅ `rgb(209,212,220)` |
| `rsb-clock-btn` rengi | ✅ `rgb(209,212,220)` |
| `btn-snapshot`/`btn-theme`/`btn-settings` rengi | ✅ üçü de `rgb(209,212,220)` |
| Alt bant yazıları büyüdü mü (görsel) | ✅ ekran görüntüsüyle doğrulandı |
| Console hatası | ✅ yok |

## Değişen dosyalar

| Dosya |
|---|
| `index.html` |
| `css/watchlist.css` |

## Sıradaki adım

Kullanıcı onayı bekleniyor — sorun bildirilmezse arayüz turu tamamlanmış
sayılacak ve araçlara (drawing tools) geçilecek.
