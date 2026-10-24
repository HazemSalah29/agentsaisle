# Kit components

Import everything from `src/components/kit`. Props are listed in `DESIGN.md`; this file shows how they fit together.

## Page skeleton

```tsx
import { Section, Container, HeroKinetic, MagneticButton } from "@/components/kit";

export default function Page() {
  return (
    <main>
      <Section pad="hero" className="min-h-svh">
        <Container>
          <HeroKinetic
            lines={[
              { text: "Make it", width: "normal" },
              { text: "move", width: "wide" },
            ]}
            intro="One sentence about the work."
            actions={<MagneticButton href="/work">See the work</MagneticButton>}
            media={
              <img
                src="/art/plate.jpg"
                width={1200}
                height={900}
                alt="..."
                className="block h-auto w-full"
              />
            }
          />
        </Container>
      </Section>
    </main>
  );
}
```

Use `pad="hero"` for the first section of a page; every other section uses the default.

## Root layout

```tsx
<SiteShell cursor>
  <NavOverlay brand="Name" links={NAV} available="Booking from May" />
  {children}
  <Footer note="Name, 2026" socials={SOCIALS} />
</SiteShell>
```

Add `app/template.tsx` that renders `<PageEnter>{children}</PageEnter>` for route transitions. Load two `next/font` fonts as CSS variables `--f-display` (a font with a width axis works best) and `--f-body`.

## Choosing a component

| Need                                            | Component                                                                     |
| ----------------------------------------------- | ----------------------------------------------------------------------------- |
| First screen of a page                          | `HeroKinetic` (home) or a `RevealText as="h1"` with `immediate` (inner pages) |
| A statement or paragraph that reveals on scroll | `RevealText`                                                                  |
| Proof in numbers                                | `StatCounter` in a `Container` with a 4-column grid                           |
| Client names or keywords drifting by            | `Marquee`                                                                     |
| A list of offers                                | `ServiceList` (give each an `image` for the hover card)                       |
| Featured projects, sideways                     | `WorkGallery` (needs 3 or more projects)                                      |
| All projects                                    | `Grid cols={2}` of `ProjectCard`                                              |
| Articles                                        | `BlogGrid`                                                                    |
| The closing call to action                      | `ContactCTA`                                                                  |

## Behavior to know

- Reveals run once, when the element is 10% inside the viewport. `immediate` runs on load.
- `WorkGallery` pins and scrolls sideways from tablet width up. Below that, and with reduced motion, it is a stack.
- Images: pass real `width` and `height` so nothing shifts. Below the fold, `loading="lazy"` is already set by the cards.
- `Marquee` is pure CSS and stops for reduced motion.
- The cursor dot and smooth scroll turn off on touch screens and for reduced motion.
