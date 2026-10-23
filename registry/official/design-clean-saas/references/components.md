# Kit components

Import everything from `src/components/kit`. Props are listed in `DESIGN.md`; this file shows how they fit together.

## Root layout

```tsx
import { Figtree } from "next/font/google";
import { Navbar, Footer } from "@/components/kit";

const sans = Figtree({ subsets: ["latin"], variable: "--f-sans" });

<html lang="en" className={sans.variable}>
  <body>
    <Navbar logo="Product" links={LINKS} cta={{ label: "Start free", href: "/signup" }} />
    {children}
    <Footer logo="Product" columns={COLUMNS} copyright="2026 Product, Inc." />
  </body>
</html>;
```

`tokens.css` needs `--f-sans` on `<html>`: load any one sans family with `next/font` into that variable.

## A landing page, top to bottom

`Hero`, `LogoCloud`, `StatsBar`, `FeatureGrid`, one or two `FeatureSplit` (alternate `reverse`), `Testimonials`, `PricingTable` or a link to it, `FAQ`, `Newsletter`. Alternate `tone="subtle"` between neighbors so sections separate without borders or decoration.

## Choosing a component

| Need                                    | Component                                                                                  |
| --------------------------------------- | ------------------------------------------------------------------------------------------ |
| First screen                            | `Hero`, with a real product image as `media`                                               |
| Social proof                            | `LogoCloud` (real customers only), `Testimonials` (real quotes), `StatsBar` (real numbers) |
| What it does, at a glance               | `FeatureGrid` (3 or 6)                                                                     |
| One thing explained with an image       | `FeatureSplit`                                                                             |
| Several offers that each link somewhere | `ServiceCards`                                                                             |
| Plans                                   | `PricingTable` (set `popular: true` on one tier only)                                      |
| Objections                              | `FAQ`                                                                                      |
| People                                  | `Team`                                                                                     |
| Talk to us                              | `ContactForm` (replace the stub action)                                                    |
| Email capture                           | `Newsletter`                                                                               |

## Behavior to know

- `FadeUp` reveals once, 10% into view. Pass `immediate` for the first screen (CSS only, no JavaScript). It stays visible with reduced motion and without JavaScript.
- Pages that use `PricingTable`, `FAQ`, `ContactForm`, `Newsletter` or `Navbar` ship a little client JavaScript; the rest is server-rendered.
- `ContactForm` and `Newsletter` call server actions in `actions.ts`. They are stubs that validate and say "thanks" without sending anything. Replace the marked `TODO` with real delivery.
- Pass real `width` and `height` on every image so nothing shifts.
- Brand color appears on primary buttons, check marks and icons. Keep it to one use per section.
