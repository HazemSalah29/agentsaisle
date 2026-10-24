import type { Metadata } from "next";
import { getCatalog } from "../../lib/catalog";
import { groupAisles, summarizeAisle } from "../../lib/aisles";
import { getRegistry } from "../../lib/registry";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Aisles",
  description:
    "Skills grouped by what they are for: baseline habits, web design, frontend, database, testing and debugging, and media.",
};

export default async function AislesPage() {
  await getCatalog(); // keeps the same ISR behavior as the catalog pages
  const groups = groupAisles(getRegistry());
  return (
    <>
      <div className="px-4 py-12 sm:px-8">
        <p className="hud-label text-accent-ink">Aisles</p>
        <h1 className="mt-3 text-3xl">Browse by aisle</h1>
        <p className="mt-3 max-w-prose text-muted">
          Each aisle shelves our own skills first, then community skills, then skills by other
          authors that we link to but do not host.
        </p>
      </div>
      <ul className="grid border-t border-line-strong pl-px pt-px md:grid-cols-2 lg:grid-cols-3">
        {groups.map((g) => (
          <li key={g.aisle.id} className="-ml-px -mt-px border border-line-strong">
            <a
              href={`/aisles/${g.aisle.id}`}
              className="group flex h-full flex-col gap-3 bg-bg-raised p-6 hover:bg-bg-sunken"
            >
              <h2 className="text-xl group-hover:text-accent-ink">{g.aisle.name}</h2>
              <p className="text-sm text-muted">{g.aisle.description}</p>
              <p className="hud-label mt-auto pt-3 text-ink">{summarizeAisle(g)}</p>
            </a>
          </li>
        ))}
      </ul>
    </>
  );
}
