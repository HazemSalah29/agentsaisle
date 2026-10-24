# Physical to logical CSS

Logical properties follow the element's writing direction (`dir`), so one rule serves LTR and RTL. `scripts/rtl-codemod.mjs` applies exactly the Tailwind rows below; `scripts/rtl-scan.mjs` suggests the CSS rows.

## Tailwind

| Physical                      | Logical                       | Notes                                                   |
| ----------------------------- | ----------------------------- | ------------------------------------------------------- |
| `ml-*` `mr-*`                 | `ms-*` `me-*`                 | verified in Tailwind 4.3 docs (margin-inline-start/end) |
| `pl-*` `pr-*`                 | `ps-*` `pe-*`                 |                                                         |
| `left-*` `right-*`            | `start-*` `end-*`             |                                                         |
| `text-left` `text-right`      | `text-start` `text-end`       |                                                         |
| `rounded-l-*` `rounded-r-*`   | `rounded-s-*` `rounded-e-*`   | verified                                                |
| `rounded-tl-*` `rounded-tr-*` | `rounded-ss-*` `rounded-se-*` | verified                                                |
| `rounded-bl-*` `rounded-br-*` | `rounded-es-*` `rounded-ee-*` | verified                                                |
| `border-l-*` `border-r-*`     | `border-s-*` `border-e-*`     | width verified; `border-s-<color>` TODO(verify)         |
| `scroll-ml-*` `scroll-mr-*`   | `scroll-ms-*` `scroll-me-*`   | TODO(verify)                                            |
| `scroll-pl-*` `scroll-pr-*`   | `scroll-ps-*` `scroll-pe-*`   | TODO(verify)                                            |
| `float-left` `float-right`    | `float-start` `float-end`     | verified                                                |
| `clear-left` `clear-right`    | `clear-start` `clear-end`     | verified                                                |

Handled by the codemod for any variant prefix (`md:`, `hover:`, `data-[open]:`), negatives (`-ml-2`), and important (`!ml-2` or `ml-2!`). Symmetric utilities (`mx-*`, `px-*`, `inset-x-*`) already work in both directions.

Version check: logical utilities need Tailwind 3.3 or newer (TODO(verify): the docs pages checked do not state the introducing version, so this comes from release notes). The codemod reads `package.json` and refuses to rewrite below 3.3. For older versions use `rtl:` and `ltr:` variants: `ltr:ml-3 rtl:mr-3` (documented in Tailwind's "hover, focus and other states" page, which also says to skip them for single-direction sites).

## Plain CSS

| Physical                         | Logical                                                                    |
| -------------------------------- | -------------------------------------------------------------------------- |
| `margin-left` / `margin-right`   | `margin-inline-start` / `margin-inline-end`                                |
| `padding-left` / `padding-right` | `padding-inline-start` / `padding-inline-end`                              |
| `border-left` / `border-right`   | `border-inline-start` / `border-inline-end`                                |
| `border-top-left-radius`         | `border-start-start-radius`                                                |
| `border-top-right-radius`        | `border-start-end-radius`                                                  |
| `border-bottom-left-radius`      | `border-end-start-radius`                                                  |
| `border-bottom-right-radius`     | `border-end-end-radius`                                                    |
| `left` / `right`                 | `inset-inline-start` / `inset-inline-end`                                  |
| `text-align: left` / `right`     | `text-align: start` / `end`                                                |
| `float: left` / `right`          | `float: inline-start` / `inline-end`                                       |
| `width`/`height`                 | leave as is unless the writing mode changes (`inline-size` / `block-size`) |

CSS-in-JS camelCase: `marginLeft` becomes `marginInlineStart`, `textAlign: "left"` becomes `"start"`.

## What logical properties do not fix

The scan lists these; fix them by hand.

- **`space-x-*`**: Tailwind 4 generates `margin-inline-start/end` for it (verified in the 4.3 docs), so it already follows direction; the scan only reports it on Tailwind 3 projects. Alternatives that work everywhere: `flex gap-*`, or `rtl:space-x-reverse` on Tailwind 3 with `flex-row-reverse` layouts.
- **`translate-x-*`**: a fixed physical offset, with no direction handling in the docs. Pair with the opposite sign: `translate-x-4 rtl:-translate-x-4`. `translate-x-0` is harmless.
- **Centering with `left-1/2 -translate-x-1/2`**: both halves flip together or neither does. Prefer `inset-x-0 mx-auto`, or `start-1/2 -translate-x-1/2 rtl:translate-x-1/2`.
- **Gradients** `bg-gradient-to-r` (`bg-linear-to-r` in v4): add `rtl:bg-gradient-to-l`.
- **Background position** `bg-left`, **transform origin** `origin-left`: add the `rtl:` opposite.
- **Absolutely positioned decorations** (corner ribbons, badges): use `start-*`/`end-*` and check the rotation direction.
- **Animations and keyframes** that move along x: provide an RTL variant or use a CSS variable `--dir: 1 / -1` multiplied into the transform.
- **`flex-row-reverse` and `order-*`**: they already follow direction; do not add `rtl:` on top.
- **Shadows** `shadow-[2px_0_...]` with a horizontal offset: flip under `rtl:`.
