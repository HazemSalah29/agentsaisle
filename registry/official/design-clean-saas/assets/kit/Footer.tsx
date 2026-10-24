import type { ReactNode } from "react";
import { Container } from "./Container";

export interface FooterColumn {
  title: string;
  links: ReadonlyArray<{ label: string; href: string }>;
}

export interface FooterProps {
  /** Product name or logo, top left. */
  logo: ReactNode;
  /** One line under the logo. */
  tagline?: string;
  /** Four columns of links. */
  columns: readonly FooterColumn[];
  /** Small print, such as "2026 Tidyline, Inc." */
  copyright: string;
  legal?: ReadonlyArray<{ label: string; href: string }>;
}

/** Four link columns, a tagline and the legal row. */
export function Footer({ logo, tagline, columns, copyright, legal }: FooterProps) {
  return (
    <footer className="border-t border-border bg-ground py-16">
      <Container>
        <div className="grid gap-12 md:grid-cols-6">
          <div className="md:col-span-2">
            <p className="text-lead font-semibold tracking-tight text-ink">{logo}</p>
            {tagline ? <p className="mt-3 max-w-xs text-body text-muted">{tagline}</p> : null}
          </div>
          {columns.map((c) => (
            <nav key={c.title} aria-label={c.title}>
              <h2 className="text-body font-semibold text-ink">{c.title}</h2>
              <ul className="mt-4 space-y-3">
                {c.links.map((l) => (
                  <li key={l.href + l.label}>
                    <a
                      href={l.href}
                      className="text-body text-muted transition-colors duration-(--duration-hover) hover:text-ink"
                    >
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="mt-16 flex flex-col justify-between gap-4 border-t border-border pt-8 text-caption text-muted sm:flex-row">
          <p>{copyright}</p>
          {legal && legal.length > 0 ? (
            <ul className="flex gap-6">
              {legal.map((l) => (
                <li key={l.label}>
                  <a
                    href={l.href}
                    className="transition-colors duration-(--duration-hover) hover:text-ink"
                  >
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </Container>
    </footer>
  );
}
