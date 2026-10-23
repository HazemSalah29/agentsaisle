# Design system: motion portfolio

Dark, editorial, motion-led. Everything comes from `src/components/kit/`. Do not restyle it, and do not write one-off sections.

## Rules

1. Build pages only from kit components and the layout primitives (`Section`, `Container`, `Grid`).
2. A missing component is a new file in `src/components/kit/` that uses tokens only. See `references/extending-the-kit.md` in the skill. Never a one-off styled section in a page.
3. Colors: only token classes (`bg-ground`, `bg-raised`, `text-ink`, `text-muted`, `text-accent`, `border-line`). No hex, rgb or hsl.
4. Type: `font-display` for headlines (always uppercase), `font-body` for text. Sizes: `text-display`, `text-title`, `text-lead`.
5. Spacing is an 8 px scale: `p-3` is 24 px. No arbitrary values such as `w-[437px]`.
6. Motion: durations and easings come from the kit (`duration.fast|base|slow|epic`, `ease.outExpo|inOutQuart`). Animate only `transform` and `opacity`.
7. Every animated component has a still version for reduced motion. Keep that true for new ones.
8. No inline `style=`. No second animation library.
9. Check with `node <skill>/scripts/design-lint.mjs`. Fix findings; do not silence them.

## Tokens

| Token       | Value           | Use                                      |
| ----------- | --------------- | ---------------------------------------- |
| `ground`    | near-black      | page background                          |
| `raised`    | dark brown-grey | cards, image frames                      |
| `ink`       | warm off-white  | main text                                |
| `muted`     | grey            | secondary text                           |
| `line`      | dark grey       | hairlines                                |
| `accent`    | violet          | one vivid color; buttons, hover, markers |
| `on-accent` | near-black      | text on accent                           |

Motion: `fast` 200 ms, `base` 450 ms, `slow` 900 ms, `epic` 1400 ms. Stagger: 40 ms per word, 80 ms per item.

## Components (import from `src/components/kit`)

- `SiteShell` `{ cursor? }`: wrap the app once. Smooth scroll, optional cursor dot. `useLenis()`, `scrollToTop()`.
- `PageEnter`: route fade-in. Use in `app/template.tsx`.
- `NavOverlay` `{ brand, links[{label,href}], available? }`: top bar plus full-screen menu.
- `HeroKinetic` `{ lines[string | {text, width: "narrow"|"normal"|"wide"}], intro, actions?, media? }`
- `RevealText` `{ text: string | lines[], as?, className?, delay?, immediate? }`: string reveals by word, array by line.
- `StatCounter` `{ value, label, suffix? }`
- `Marquee` `{ children, speed: "slow"|"base"|"fast", direction?, pauseOnHover? }`
- `ServiceList` `{ services[{title, description, image?}] }`
- `WorkGallery` `{ projects[] }`: pinned sideways scroll; a stack on phones and reduced motion.
- `ProjectCard` `{ project: {title, client, year, category, href, image} }`
- `BlogGrid` `{ posts[{title, excerpt, date, category, href, image}], cols? }`
- `MagneticButton` `{ children, href?, onClick?, variant: "solid"|"outline", strength? }`
- `ContactCTA` `{ label, href, note? }`
- `Footer` `{ note, socials[{label,href}] }`
- `Section` `{ pad?: "default"|"hero" }`, `Container`, `Grid` `{ cols: 2|3|4 }`

Details and examples: `references/components.md` in the skill folder.
