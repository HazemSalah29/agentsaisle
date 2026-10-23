# Extending the kit

Add a component only when no kit component fits. Never style a section inside a page instead.

1. Check `DESIGN.md` and `references/components.md` first. Combining two kit components is usually enough.
2. Create `src/components/kit/<Name>.tsx` and export it from `src/components/kit/index.ts`.
3. Use tokens only:
   - Colors: `bg-ground`, `text-ink`, `text-muted`, `text-accent`, `border-line`.
   - Spacing: the 8 px scale (`p-3`, `gap-6`). Section rhythm comes from `Section` and `Container`.
   - Type: `font-display`, `font-body`, `text-display|title|lead`.
4. Animate with `motion/react`, taking timings from `./tokens` (`duration`, `ease`, `stagger`):
   ```tsx
   transition={{ duration: duration.base, ease: ease.outExpo }}
   ```
   Animate only `transform` and `opacity`. Never width, height, top, left or box-shadow.
5. Respect reduced motion:
   - Read it with `useMotionOk()` from `./use-motion-ok`.
   - Put `data-kit-motion` on any element whose resting state is its visible state. A CSS rule in `tokens.css` then forces it visible and still.
   - Put `data-kit-curtain` on decoration that only exists to be animated away; reduced motion hides it.
6. Accessibility: a real `<button>` or `<a>` for anything clickable, visible focus (the global outline already applies), `aria-hidden` on decoration, readable text with the full sentence for screen readers when you split text.
7. Add the component to the table in `DESIGN.md` with its props.
8. Run `design-lint` and the project's checks. The kit folder itself is not linted, so review your own file against these rules.
