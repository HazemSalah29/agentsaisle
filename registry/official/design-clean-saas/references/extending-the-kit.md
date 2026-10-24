# Extending the kit

Add a component only when no kit component fits. Never style a section inside a page instead.

1. Check `DESIGN.md` and `references/components.md` first. Combining two kit components is usually enough.
2. Create `src/components/kit/<Name>.tsx` and export it from `src/components/kit/index.ts`.
3. Use tokens only:
   - Colors: `bg-ground`, `bg-subtle`, `text-ink`, `text-muted`, `border-border`, `bg-brand-700`.
   - Radius: `rounded-lg`, `rounded-2xl`. Shadow: `shadow-soft` only.
   - Type: `text-caption|body|lead|h4|h3|h2|h1`.
   - Layout: wrap it in `Section` and `Container`; separate neighbors with `tone="subtle"`.
4. Motion: wrap content in `FadeUp`. Hovers use `transition-colors duration-(--duration-hover)`. Nothing else moves. Never animate width, height, top or left.
5. Keep it minimal: no gradients, glass, blobs or second icon set. One brand-color use per section.
6. Accessibility: a real `<button>` or `<a>` for anything clickable, labels on every input, visible focus (the global outline applies), `aria-hidden` on decorative icons, errors tied to inputs with `aria-describedby`.
7. Server component by default. Add `"use client"` only for state or browser APIs.
8. Add the component to the table in `DESIGN.md` with its props.
9. Run `design-lint` and the project's checks. The kit folder itself is not linted, so review your own file against these rules.
