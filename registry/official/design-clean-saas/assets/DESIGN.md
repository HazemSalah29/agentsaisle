# Design system: clean SaaS

Light, quiet, minimal. Everything comes from `src/components/kit/`. Do not restyle it, and do not write one-off sections.

## Rules

1. Build pages only from kit components and the layout primitives (`Section`, `Container`, `Grid`).
2. A missing component is a new file in `src/components/kit/` that uses tokens only. See `references/extending-the-kit.md` in the skill. Never a one-off styled section in a page.
3. Colors: token classes only (`bg-ground`, `bg-subtle`, `text-ink`, `text-muted`, `border-border`, `bg-brand-700`, `text-brand-700`). No hex, rgb or hsl, and no default Tailwind palette (`text-gray-500`, `bg-blue-600`).
4. Whitespace before decoration. At most one accent (brand color) use per section: one button or the icons, not both plus a colored heading.
5. No gradients, no glass (`backdrop-blur`), no decorative blobs or blurred shapes, one shadow only (`shadow-soft`).
6. Icons from `lucide-react` only. Size 16 to 24, stroke as drawn.
7. One font (`font-sans`). Type steps: `text-caption` 14, `text-body` 16, `text-lead` 18, `text-h4` 24, `text-h3` 32, `text-h2` 48, `text-h1` 64 (the large ones shrink on phones). Headlines use `font-semibold`.
8. Radius: `rounded-lg` (12 px) for controls, `rounded-2xl` (20 px) for cards and images, `rounded-full` for pills and avatars.
9. Motion: only `FadeUp` (300 ms, once, on enter) and 150 ms hover transitions via `duration-(--duration-hover)`. No parallax, no animation or smooth-scroll library, never animate layout.
10. Write copy for the user's real product. Never invent customers, ratings, logos or numbers: use `[PLACEHOLDER]`.
11. Check with `node <skill>/scripts/design-lint.mjs`. Fix findings; do not silence them.

## Tokens

| Token                     | Use                                                                          |
| ------------------------- | ---------------------------------------------------------------------------- |
| `ground`                  | page background (white)                                                      |
| `subtle`                  | alternate sections, inputs, tiles                                            |
| `ink`                     | main text                                                                    |
| `muted`                   | secondary text                                                               |
| `border`                  | 1 px borders                                                                 |
| `brand-50` to `brand-900` | the one brand color; `brand-700` for buttons and links, `brand-800` on hover |
| `success`, `warning`      | states only (form feedback, status text), never decoration                   |

## Components (import from `src/components/kit`)

- `Navbar` `{ logo, links[{label,href}], cta }`: sticky, border on scroll, sheet on phones.
- `Hero` `{ eyebrow?, headline, subtext, primaryCta, secondaryCta?, ratings?[{score,label}], media? }`
- `LogoCloud` `{ title?, logos[{name, src?}] }`: grey wordmarks or images.
- `StatsBar` `{ stats[{value,label}] (3 to 4), tone? }`
- `FeatureGrid` `{ title, intro?, features[{icon,title,description}] (3 or 6), tone? }`
- `FeatureSplit` `{ title, description, points?, link?, media, reverse?, tone? }`: alternate `reverse` down the page.
- `ServiceCards` `{ title, intro?, services[{icon,title,description,href,linkLabel?}], tone? }`
- `Testimonials` `{ title, items[{quote,name,role,avatar?,rating?}], tone? }`
- `Team` `{ title, intro?, people[{name,role,photo?,bio?}], tone? }`
- `PricingTable` `{ title, intro?, tiers[{name,description,monthly,yearly,features,cta,popular?}] (2 or 3), currency?, yearlyNote?, tone? }`
- `FAQ` `{ title, items[{question,answer}], tone? }`
- `ContactForm` `{ title, intro?, action?, tone? }`: the default action in `actions.ts` is a stub; replace its body.
- `Newsletter` `{ title, description?, action?, tone? }`
- `Footer` `{ logo, tagline?, columns[{title,links}] (4), copyright, legal? }`
- `FadeUp` `{ immediate?, delay? }`, `Section` `{ tone? }`, `Container`, `Grid` `{ cols: 2|3|4 }`

Details and examples: `references/components.md` in the skill folder.
