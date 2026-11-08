import type { Metadata } from "next";
import { CardGrid, CardItem } from "../../components/simple/Cards";
import { PageIntro } from "../../components/simple/PageIntro";
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
      <PageIntro
        size="lg"
        eyebrow="Aisles"
        lines={["Browse by aisle"]}
        accent="like shelves in a store."
        intro="Skills are grouped by what they are for. Pick an aisle and look around."
      />
      <div className="border-t border-line-strong px-4 py-12 sm:px-8">
        <CardGrid className="md:grid-cols-2 lg:grid-cols-3" label="Aisles">
          {groups.map((g) => (
            <CardItem key={g.aisle.id}>
              <a href={`/aisles/${g.aisle.id}`} className="group flex h-full flex-col gap-3 p-6">
                <h2 className="text-xl group-hover:text-accent-ink">{g.aisle.name}</h2>
                <p className="text-sm text-muted">{g.aisle.description}</p>
                <p className="hud-label mt-auto pt-3 text-ink">{summarizeAisle(g)}</p>
              </a>
            </CardItem>
          ))}
        </CardGrid>
      </div>
    </>
  );
}
