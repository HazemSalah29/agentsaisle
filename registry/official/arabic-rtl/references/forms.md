# Forms in RTL

## Layout

- Labels sit above the field, or on the start side for inline forms (`flex` follows direction automatically). Keep the label and field in source order: label first.
- Required marker: put `*` after the label text in markup; it lands at the end side. Do not position it with `left`/`right`; use `ms-1`.
- Error text appears below the field, aligned to the start. Associate it with `aria-describedby`.

## Inputs

- Direction: `dir="auto"` for free text; `dir="ltr"` plus `text-start` for email, URL, password, phone, code (see `bidi.md`).
- Icons inside inputs: padding and position use logical utilities. Leading icon: `ps-10` on the input and `start-3` on the icon. Trailing (clear, show-password): `pe-10` and `end-3`.
- Select arrow: native selects flip automatically. Custom arrows built as a background image need `bg-left` / `bg-right` flipped under `rtl:` (the scan reports `background-position`).
- Number inputs: browsers keep digits Western or follow the locale; test with `inputmode="numeric"`. Accept both digit systems on input (normalize `٠-٩` to `0-9` before validating):

  ```ts
  const toLatinDigits = (s: string) => s.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
  ```

- Checkboxes and radios: the box is on the start side of the label automatically.

## Date pickers

Use a picker that supports RTL and the locale's first day of week (Saturday in much of the Arab world; Sunday in others). If it has no RTL option, a native `<input type="date">` is the safe fallback. TODO(verify) the picker library's `dir` or `rtl` prop.

## Validation messages

Translate the whole message with placeholders, never concatenate:

```json
"errors": { "minLength": "يجب ألا يقل {field} عن {min} أحرف" }
```

Field names also need translations; pass the translated name as `{field}`, and mind grammatical gender (see `translation.md`). With zod, map issue codes to message keys and format them with `t(key, values)`.

## Buttons

Primary actions sit at the end side (`justify-end` follows direction). Do not hand-reverse button order with `flex-row-reverse` in RTL; it would double-reverse.

## Check

Tab order follows DOM order, which should match reading order. Do not use positive `tabindex`.
