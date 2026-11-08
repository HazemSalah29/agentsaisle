import type { Metadata } from "next";
import { BundleCard } from "../../components/BundleCard";
import { ProfilePicker } from "../../components/ProfilePicker";
import { Section } from "../../components/Section";
import { CardGrid, CardItem } from "../../components/simple/Cards";
import { PageIntro } from "../../components/simple/PageIntro";
import { getRegistry } from "../../lib/registry";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Profiles",
  description:
    "Answer a few questions and get a bundle of skills with one command to install them all.",
};

export default function ProfilesPage() {
  const { skills, questions, profiles } = getRegistry();
  return (
    <>
      <PageIntro
        size="lg"
        eyebrow="Profiles"
        lines={["Pick your bundle"]}
        accent="in a few clicks."
        intro="Answer a few questions. You get one line that installs everything on your list."
      />

      <Section id="picker" number="01" title="Answer a few questions">
        {questions.length > 0 ? (
          <ProfilePicker
            questions={questions}
            skills={skills.map((s) => ({ name: s.name, version: s.latest }))}
          />
        ) : (
          <p className="text-muted">
            The picker has no questions yet. Browse the catalog to install skills one at a time.
          </p>
        )}
      </Section>

      {profiles.length > 0 && (
        <Section
          id="starter"
          number="02"
          title="Starter bundles"
          intro="Skip the questions. One command installs a whole bundle."
        >
          <CardGrid className="md:grid-cols-3" label="Starter bundles">
            {profiles.map((p) => (
              <CardItem key={p.id}>
                <BundleCard profile={p} />
              </CardItem>
            ))}
          </CardGrid>
        </Section>
      )}
    </>
  );
}
