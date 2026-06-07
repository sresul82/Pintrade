# SİSTEM KURALLARI — Bu Projedeki Tüm Görevler İçin Geçerli

Bu kurallar her görevde geçerlidir. Hiçbir gerekçeyle ihlal edilemez.

---

## KURAL 1: Sadece söylenen satırları değiştir

Sana bir değişiklik verildiğinde:
- Yalnızca o satırları değiştirirsin
- O satırların üstündeki ve altındaki satırlar **aynen kalır**
- "Daha temiz yaptım", "refactor ettim", "optimize ettim" gibi gerekçelerle ek değişiklik yapmazsın

## KURAL 2: Söylenmeyen dosyalara kesinlikle dokunma

Görevde hangi dosyalar belirtilmişse sadece onları düzenlersin.
Belirtilmemiş dosyalar — `dsd-apply.js`, `drawing-fibo.js`, `dsd-fibo-tabs.js`, `dsd-standard-tabs.js`, `property-toolbar.js` veya başka herhangi bir dosya — **hiç açılmaz, hiç okunmaz, hiç değiştirilmez.**

## KURAL 3: Kapsam dışına çıkma

"Bu değişiklikle birlikte şunu da düzelttim" veya "bununla ilgili şu dosyayı da güncelledim" kabul edilmez.
Görevde ne yazıyorsa o yapılır, fazlası yapılmaz.

## KURAL 4: ESKİ → YENİ formatına harfiyen uy

Sana şu format verilir:

```
// ESKİ:
[kod]

// YENİ:
[kod]
```

ESKİ bloğu dosyada **kelimesi kelimesine** bulursun ve sadece YENİ bloğuyla değiştirirsin.
ESKİ blok bulunamazsa değişikliği yapmazsın ve kullanıcıya bildirirsin.

## KURAL 5: Yorum satırı, boşluk, format değiştirme

Kodun girintisini, yorum satırlarını, boşluklarını değiştirmezsin.
"Temizledim", "düzenledim" gibi görünmez değişiklikler de yasaktır.

## KURAL 6: Görev dışı iyileştirme önerme

"Bu arada şunu da düzeltsem iyi olur" veya "bunu da güncellemenizi öneririm" demezsin.
Sadece verilen görevi yaparsın.

---

## Bu Projede Dokunulmayacak Dosyalar (Aksi Söylenmedikçe)

- `drawing-fibo.js`
- `dsd-fibo-tabs.js`
- `dsd-apply.js`
- `drawing-annotations.js`
- `drawing-shapes.js`
- `drawing-forecast.js`
- `drawing-patterns.js`
- `screener-core.js`
- `chart-data.js`
- `chart-pane.js`
- `chart-layout.js`
- `server.js`
- `index.html`

---

## Doğrulama

Her görevin sonunda sadece şunu söylersin:
- Hangi dosyada hangi satırı değiştirdin
- ESKİ ve YENİ halini yan yana gösterirsin

Başka açıklama, yorum veya öneri gerekmez.
