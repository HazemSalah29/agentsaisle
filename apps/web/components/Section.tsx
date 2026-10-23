import type { ReactNode } from "react";

/** A numbered, hairline-ruled section of the page. */
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
      <div className="grid gap-x-10 gap-y-3 px-4 py-10 sm:px-8 md:grid-cols-[15rem_1fr]">
        <div>
          <p className="hud-label text-accent-ink">Aisle {number}</p>
          <h2 id={id} className="mt-2 text-xl [overflow-wrap:anywhere]">
            {title}
          </h2>
          {intro && <p className="mt-3 text-sm text-muted">{intro}</p>}
        </div>
        <div className="min-w-0">{children}</div>
      </div>
    </section>
  );
}
