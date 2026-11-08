import type { ReactNode } from "react";
import { Reveal } from "./simple/motion";

/** A numbered, hairline-ruled section of the page: label, plain title, one sentence, then the content. */
export function Section({
  id,
  number,
  title,
  intro,
  children,
}: {
  id: string;
  number: string;
  title: string;
  intro?: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="border-t border-line-strong">
      <div className="px-4 py-12 sm:px-8 sm:py-16">
        <Reveal>
          <p className="hud-label text-accent-ink">Aisle {number}</p>
          <h2 id={id} className="mt-2 scroll-mt-20 text-2xl [overflow-wrap:anywhere]">
            {title}
          </h2>
          {intro && <p className="mt-3 max-w-prose text-base text-muted">{intro}</p>}
        </Reveal>
        <div className="mt-8 min-w-0">{children}</div>
      </div>
    </section>
  );
}
