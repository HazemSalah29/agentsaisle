# Visual design of the page

The page is drawn from tokens in `assets/viewer/styles.css`. Light and dark themes define the same tokens; the dark theme follows the system until the theme button is used.

- **Background**: a calm warm gray (`--bg`), white cards (`--surface`), a slightly darker tint behind each tier (`--band`) so the columns read at a glance.
- **Accent**: one colour per lens. System uses a slate blue (`--accent-system`), Flows uses orange (`--accent-flows`). `data-lens` on the page element picks which one `--accent` points to; selection, hover, focus-adjacent highlights and links follow it.
- **Type**: three sizes only, as tokens: 12 px (labels, technology lines, notes), 14 px (body, node names), 18 px (headings). Labels, navigation and badges may use uppercase; sentences never do.
- **Node card**: an icon on a soft tile, the label, then the technology line. The risk badge sits in the top corner on the right (the same corner in both directions); the top-left corner is reserved for the AI badge.
- **Evidence**: a solid outline or line means a file shows it. A dashed outline or line means it is inferred.
- **Groups**: a hairline box with a label chip, drawn behind the edges. Nested groups sit inside their parent.
- **Direction**: logical CSS properties throughout, so the panel and toolbar mirror in right-to-left. The diagram's own direction is a separate setting (`--flow-dir`).
- **Contrast**: every text and line colour pair is checked at WCAG 2.1 AA (4.5:1 for text, 3:1 for lines and focus rings) in both themes by the tests.
