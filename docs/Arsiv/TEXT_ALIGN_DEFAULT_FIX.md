# PinTrade V2.4 — Settings / Text Sekmesi Default Hizalama Düzeltmesi

## Sorun

`dsd-standard-tabs.js` içindeki `renderTextTab` fonksiyonunda Text alignment select'leri şöyle üretiliyor:

```js
<option value="top"    ${s.textAlignV==='top'   ?'selected':''}>Top</option>
<option value="middle" ${s.textAlignV==='middle' ?'selected':''}>Middle</option>
<option value="bottom" ${s.textAlignV==='bottom' ?'selected':''}>Bottom</option>

<option value="left"   ${s.textAlignH==='left'  ?'selected':''}>Left</option>
<option value="center" ${s.textAlignH==='center'?'selected':''}>Center</option>
<option value="right"  ${s.textAlignH==='right' ?'selected':''}>Right</option>
```

`s.textAlignV` veya `s.textAlignH` `undefined` olduğunda hiçbir koşul `true` olmuyor ve HTML'in **ilk `<option>`'ı** otomatik seçili kalıyor — bu da `top` ve `left`. Bu yüzden Settings açıldığında default **Left** görünüyor, kullanıcı istediği **Center** değil.

---

## Değişiklik — `dsd-standard-tabs.js` satır 455–463

Koşulları `|| !s.textAlignV` / `|| !s.textAlignH` ile genişlet; böylece değer `undefined` olduğunda da istenen default seçili gelsin.

**Mevcut (satır 455–463):**
```js
          <select class="dsd-select" id="dsd-textAlignV">
            <option value="top" ${s.textAlignV==='top'?'selected':''}>Top</option>
            <option value="middle" ${s.textAlignV==='middle'?'selected':''}>Middle</option>
            <option value="bottom" ${s.textAlignV==='bottom'?'selected':''}>Bottom</option>
          </select>
          <select class="dsd-select" id="dsd-textAlignH">
            <option value="left" ${s.textAlignH==='left'?'selected':''}>Left</option>
            <option value="center" ${s.textAlignH==='center'?'selected':''}>Center</option>
            <option value="right" ${s.textAlignH==='right'?'selected':''}>Right</option>
          </select>
```

**Yeni:**
```js
          <select class="dsd-select" id="dsd-textAlignV">
            <option value="top"    ${(s.textAlignV==='top'    || !s.textAlignV)?'selected':''}>Top</option>
            <option value="middle" ${s.textAlignV==='middle'                   ?'selected':''}>Middle</option>
            <option value="bottom" ${s.textAlignV==='bottom'                   ?'selected':''}>Bottom</option>
          </select>
          <select class="dsd-select" id="dsd-textAlignH">
            <option value="left"   ${s.textAlignH==='left'                     ?'selected':''}>Left</option>
            <option value="center" ${(s.textAlignH==='center' || !s.textAlignH)?'selected':''}>Center</option>
            <option value="right"  ${s.textAlignH==='right'                    ?'selected':''}>Right</option>
          </select>
```

---

## Açıklama

| Select | Eski default (`undefined` iken) | Yeni default |
|---|---|---|
| `textAlignV` | `top` (ilk option) | `top` ✅ zaten doğruydu, ama koşul explicit yapıldı |
| `textAlignH` | `left` (ilk option) ❌ | `center` ✅ |

`!s.textAlignH` kontrolü: değer `undefined`, `null` veya `''` ise `center` seçili gelir. Kullanıcı daha önce `left` veya `right` seçmişse o değer korunur.

**Bu değişiklik dışında hiçbir şeye dokunma.**
