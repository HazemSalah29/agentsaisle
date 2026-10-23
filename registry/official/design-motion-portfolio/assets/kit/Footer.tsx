"use client";

import { Container } from "./Container";
import { scrollToTop, useLenis } from "./SiteShell";
import { useMotionOk } from "./use-motion-ok";

export interface FooterProps {
  /** Left side, such as the studio name and year. */
  note: string;
  socials: ReadonlyArray<{ label: string; href: string }>;
}

/** Social links and a back-to-top button that scrolls smoothly. */
export function Footer({ note, socials }: FooterProps) {
  const lenis = useLenis();
  const motionOk = useMotionOk();
  return (
    <footer className="border-t border-line py-10">
      <Container className="flex flex-wrap items-center justify-between gap-6">
        <p className="text-muted">{note}</p>
        <ul className="flex flex-wrap gap-6">
          {socials.map((s) => (
            <li key={s.href}>
              <a href={s.href} className="text-ink transition-colors hover:text-accent">
                {s.label}
              </a>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => scrollToTop(lenis, motionOk)}
          className="rounded-full border border-ink px-5 py-2 text-sm font-medium text-ink"
        >
          Back to top
        </button>
      </Container>
    </footer>
  );
}
