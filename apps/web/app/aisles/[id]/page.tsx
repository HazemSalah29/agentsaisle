import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BundleCard } from "../../../components/BundleCard";
import { ElsewhereCard } from "../../../components/ElsewhereCard";
import { Section } from "../../../components/Section";
import { SkillCard } from "../../../components/SkillCard";
import { CardGrid, CardItem } from "../../../components/simple/Cards";
import { PageIntro } from "../../../components/simple/PageIntro";
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

export default async function AislePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const index = getRegistry();
  const aisle = index.aisles.find((a) => a.id === id);
  if (!aisle) notFound();
  const group = groupAisle(aisle, index);
  const stars = new Map((await getCatalog()).map((s) => [s.name, s.stars]));
  const card = (s: (typeof group.official)[number]) => (
    <CardItem key={s.name}>
      <SkillCard skill={s} href={`/skills/${s.name}`} stars={stars.get(s.name)} />
    </CardItem>
  );
  let n = 0;
  const num = () => String(++n).padStart(2, "0");

  return (
    <>
      <PageIntro
        size="lg"
        eyebrow={
          <>
            <a href="/aisles" className="underline underline-offset-4">
              Aisles
            </a>{" "}
            / {aisle.name}
          </>
        }
        lines={[aisle.name]}
        intro={aisle.description}
      />

      {group.comingSoon && (
        <Section id="soon" number={num()} title="Coming soon">
          <p className="max-w-prose border border-dashed border-line-strong bg-bg-raised p-5 text-sm">
            There are no skills in this aisle yet. A skill only goes on the shelf after it has been
            built and tested, so this one stays empty until then.
          </p>
        </Section>
      )}

      {group.kits.length > 0 && (
        <Section
          id="kits"
          number={num()}
          title="Kits"
          intro="Skills that work together. One command installs them all."
        >
          <CardGrid label="Kits">
            {group.kits.map((k) => (
              <CardItem key={k.id}>
                <BundleCard profile={k} />
              </CardItem>
            ))}
          </CardGrid>
        </Section>
      )}

      {group.official.length > 0 && (
        <Section id="official" number={num()} title="Official" intro="Made and kept up by us.">
          <CardGrid label="Official skills">{group.official.map(card)}</CardGrid>
        </Section>
      )}
      {group.verified.length > 0 && (
        <Section
          id="verified"
          number={num()}
          title="Verified"
          intro="Community skills that a maintainer has read in full."
        >
          <CardGrid label="Verified skills">{group.verified.map(card)}</CardGrid>
        </Section>
      )}
      {group.community.length > 0 && (
        <Section
          id="community"
          number={num()}
          title="Community"
          intro="Sent in by their authors. Nobody here has read these yet."
        >
          <CardGrid label="Community skills">{group.community.map(card)}</CardGrid>
        </Section>
      )}
      {group.elsewhere.length > 0 && (
        <Section
          id="elsewhere"
          number={num()}
          title="Elsewhere"
          intro="Skills by other authors. We link to them and show their license. We do not host them and our CLI does not install them."
        >
          <CardGrid label="Skills elsewhere">
            {group.elsewhere.map((e) => (
              <CardItem key={`${e.repo}/${e.path}`}>
                <ElsewhereCard entry={e} />
              </CardItem>
            ))}
          </CardGrid>
        </Section>
      )}
    </>
  );
}
