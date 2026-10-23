import type { ReactNode } from "react";

/** A row of labels sitting on a shelf rail, with an aisle sign above. */
export function Shelf({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="pt-6">
      <h2 className="mb-8 inline-block rounded-label border-[1.5px] border-label-rule bg-label px-4 py-1 text-2xl font-black text-label-ink shadow-label">
        {title}
      </h2>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,19rem),1fr))] gap-x-6 gap-y-10 pb-5">
        {children}
      </div>
      <div aria-hidden="true" className="h-3 border-y-[3px] border-ink bg-ink/20" />
    </section>
  );
}
