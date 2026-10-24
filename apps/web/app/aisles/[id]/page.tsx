import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { BundleCard } from "../../../components/BundleCard";
import { ElsewhereCard } from "../../../components/ElsewhereCard";
import { SkillCard } from "../../../components/SkillCard";
import { groupAisle } from "../../../lib/aisles";
import { getCatalog } from "../../../lib/catalog";
import { getRegistry } from "../../../lib/registry";

export const revalidate = 3600;
export const dynamicParams = false;

export function generateStaticParams() {
  return getRegistry().aisles.map((a) => ({ id: a.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const aisle = getRegistry().aisles.find((a) => a.id === id);
  return aisle
    ? { title: `${aisle.name} aisle`, description: aisle.description }
    : { title: "Aisle not found" };
}

function Shelf({
  id,
  title,
  intro,
  children,
}: {
  id: string;
  title: string;
  intro?: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="border-t border-line-strong px-4 py-10 sm:px-8">
      <h2 id={id} className="text-xl">
        {title}
      </h2>
      {intro && <p className="mt-2 max-w-prose text-sm text-muted">{intro}</p>}
      <div className="mt-6">{children}</div>
    </section>
  );
}

const grid = "grid pl-px pt-px sm:grid-cols-2 lg:grid-cols-3";
const cell = "-ml-px -mt-px border border-line-strong";

export default async function AislePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const index = getRegistry();
  const aisle = index.aisles.find((a) => a.id === id);
  if (!aisle) notFound();
  const group = groupAisle(aisle, index);
  const stars = new Map((await getCatalog()).map((s) => [s.name, s.stars]));
  const card = (s: (typeof group.official)[number]) => (
    <li key={s.name} className={cell}>
      <SkillCard skill={s} href={`/skills/${s.name}`} stars={stars.get(s.name)} />
    </li>
  );

  return (
    <>
      <div className="px-4 py-12 sm:px-8">
        <p className="hud-label text-muted">
          <a href="/aisles" className="text-accent-ink underline underline-offset-4">
            Aisles
          </a>{" "}
          / {aisle.name}
        </p>
        <h1 className="mt-3 text-3xl">{aisle.name}</h1>
        <p className="mt-3 max-w-prose text-muted">{aisle.description}</p>
      </div>

      {group.comingSoon && (
        <Shelf id="soon" title="Coming soon">
          <p className="max-w-prose border border-dashed border-line-strong bg-bg-raised p-5 text-sm">
            There are no skills in this aisle yet. A skill only goes on the shelf after it has been
            built and tested, so this one stays empty until then.
          </p>
        </Shelf>
      )}

      {group.kits.length > 0 && (
        <Shelf
          id="kits"
          title="Kits"
          intro="A kit installs the skills that work together, with one command."
        >
          <ul className={grid}>
            {group.kits.map((k) => (
              <li key={k.id} className={cell}>
                <BundleCard profile={k} />
              </li>
            ))}
          </ul>
        </Shelf>
      )}

      {group.official.length > 0 && (
        <Shelf id="official" title="Official">
          <ul className={grid}>{group.official.map(card)}</ul>
        </Shelf>
      )}
      {group.verified.length > 0 && (
        <Shelf
          id="verified"
          title="Verified"
          intro="Community skills that a maintainer has read in full."
        >
          <ul className={grid}>{group.verified.map(card)}</ul>
        </Shelf>
      )}
      {group.community.length > 0 && (
        <Shelf
          id="community"
          title="Community"
          intro="Submitted by their authors. Nobody here has read these yet."
        >
          <ul className={grid}>{group.community.map(card)}</ul>
        </Shelf>
      )}
      {group.elsewhere.length > 0 && (
        <Shelf
          id="elsewhere"
          title="Elsewhere"
          intro="Skills by other authors. We link to them and show their license. We do not host them and our CLI does not install them."
        >
          <ul className={grid}>
            {group.elsewhere.map((e) => (
              <li key={`${e.repo}/${e.path}`} className={cell}>
                <ElsewhereCard entry={e} />
              </li>
            ))}
          </ul>
        </Shelf>
      )}
    </>
  );
}
