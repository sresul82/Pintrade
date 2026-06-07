# GÖREV: drawing-core.js — 2 Satır Değişiklik

Sadece aşağıdaki 2 satırı değiştir. Başka hiçbir şeye dokunma.

---

## DEĞİŞİKLİK 1

Dosya: `drawing-core.js`

Şu satırı bul (tek bir satır, dosyada yalnızca bir kez geçiyor):

```javascript
        pts.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, id: 'ch_mid_top' });
```

Şununla değiştir:

```javascript
        pts.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, type: 'square', id: 'ch_mid_top' });
```

---

## DEĞİŞİKLİK 2

Aynı dosyada şu satırı bul (tek bir satır, dosyada yalnızca bir kez geçiyor):

```javascript
            pts.push({ ...botMid, id: 'ch_mid_bot' });
```

Şununla değiştir:

```javascript
            pts.push({ ...botMid, type: 'square', id: 'ch_mid_bot' });
```

---

## KURAL

Bu 2 satırın dışında dosyada tek bir karakter bile değişmeyecek.
Değiştirilen satırların üstündeki ve altındaki satırlar aynen kalacak.
Başka hiçbir dosyaya dokunulmayacak.
