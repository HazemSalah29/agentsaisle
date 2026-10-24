# What mirrors and what never does

Rule of thumb: mirror things that express **direction of reading or flow**; keep things that depict the real world or carry a fixed meaning.

## Mirror

- Back/forward arrows and chevrons, "next" and "previous" buttons, breadcrumb separators.
- Progress bars and steppers (fill from the start side), sliders and range inputs (handled by the browser with `dir`), timelines.
- Carousels and their swipe direction; the first slide is on the start side.
- List bullets, indentation, blockquote bars, sidebar placement (start side), drawers that slide in from the start.
- Text-alignment icons and "reply", "undo/redo", "indent/outdent" icons.
- Table column order follows the document direction automatically; do not reverse data by hand.
- Search and "send" icons that point in a direction (paper plane).

## Never mirror

- Logos, brand marks, and any image of real things (photos, product shots, maps).
- Media transport controls: play, pause, fast-forward, rewind keep their meaning (timelines of audio and video run left to right).
- Clocks and anything that rotates clockwise (a loading spinner may keep clockwise).
- Checkmarks, plus/minus, close (x), question marks (use the Arabic question mark in text, not in icons).
- Numbers, phone numbers, code, URLs, math, and charts' numeric axes (unless the chart library supports RTL properly; then mirror the layout but not the number direction).
- Icons of objects with a real orientation: a handset, a magnifier with its handle, a bicycle.
- Slashes inside content (`and/or`, dates `24/10/2026`).

## Component: DirectionalIcon

Wrap only icons that express direction:

```tsx
<DirectionalIcon directional>
  <ChevronRight />
</DirectionalIcon>
```

It renders the child in a wrapper and adds `rtl:-scale-x-100` only when `directional` is true. Without the prop it changes nothing, so a wrong guess is easy to spot in review. The scan warns on `ArrowLeft`, `ArrowRight`, `ChevronLeft`, `ChevronRight`, `CaretLeft`, `CaretRight`, `MoveLeft`, `MoveRight` and similar when no `DirectionalIcon` is nearby. Tailwind's `-scale-x-100` utility exists in v3 and v4 (TODO(verify) for the installed version).

## Icon naming trap

`ArrowLeft` means "the arrow points physically left", so in RTL you want it to point right: that is exactly what the flip does. Prefer semantic icons when the library has them (`ArrowBack`, `ChevronStart`, `ChevronEnd`), and do not flip those twice.

## Carousels and swipe

Libraries differ: many need an explicit `dir="rtl"` or `rtl` option (for example Embla's `direction: "rtl"`, Swiper's `rtl` handling). TODO(verify) the option for the library in use. Test by dragging: the next slide must enter from the end side.
