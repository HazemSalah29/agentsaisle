# Mixed-direction text

The browser's bidi algorithm orders runs of text; problems appear at the boundaries (punctuation, numbers, parentheses). Fix them with markup and CSS, **never** by inserting invisible bidi control characters into source (they are hard to review, and `aisle audit` flags them as a Trojan Source risk).

## User-generated content

Unknown direction: let the browser detect it from the first strong character.

```html
<p dir="auto">{comment.body}</p>
```

For a list of items, put `dir="auto"` on each item, not on the list. Align with `text-start` (follows the detected direction), not `text-left`.

## Embedded opposite-direction runs

An English product name, email, URL or code inside Arabic text (or the reverse):

```html
<p>اشتريت <bdi>iPhone 15 Pro</bdi> من المتجر</p>
<span style="unicode-bidi: isolate; direction: ltr">order-4821/B</span>
```

`<bdi>` isolates its content and detects direction itself. Use `dir="ltr"` on a `<span>` when you know it is always LTR (phone, code, ID). In React: `<bdi>{name}</bdi>`.

## Inputs

- Free text (comments, names, search): `dir="auto"`.
- Email, URL, password, phone, code, card number: force `dir="ltr"` and align to the start: `<input type="email" dir="ltr" className="text-start" />`. In RTL the text then sits at the right edge but reads correctly.
- `placeholder` follows the input's direction.

The scan intentionally does not flag `dir="ltr"` on inputs; it flags it on layout containers (`div`, `section`, `main`, `nav` ...) where it blocks mirroring.

## Punctuation and parentheses

A line like `اسم المنتج (Pro)` can show the parenthesis on the wrong side when the neutral characters sit between runs of different direction. Isolating the Latin run with `<bdi>` fixes it. Trailing punctuation after a Latin run in an Arabic sentence (`...مع <bdi>React</bdi>.`) stays correct when the run is isolated.

## Numbers

Digits are weak LTR: a range such as `10-20` or a phone number can reorder. Wrap in `<bdi>` or `dir="ltr"`, or format through `Intl` (see `numbers-dates.md`).

## ZWNJ and ZWJ

Arabic and Persian text legitimately contains U+200C (ZWNJ) and U+200D (ZWJ) between letters to control joining. Leave them. `aisle audit` ignores them next to Arabic-script letters. Do not add them to Latin text.

## CSS

- `unicode-bidi: isolate` for inline runs, `plaintext` for user content blocks as an alternative to `dir="auto"`.
- `direction` should come from the `dir` attribute, not CSS, so assistive tech and the browser agree.
- Avoid `text-align: left`; use `start`.
