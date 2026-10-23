import type { Metadata } from "next";
import { BundleCard } from "../../components/BundleCard";
import { ProfilePicker } from "../../components/ProfilePicker";
import { Section } from "../../components/Section";
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
      <div className="px-4 py-12 sm:px-8">
        <p className="hud-label text-accent-ink">Profiles</p>
        <h1 className="mt-3 text-3xl">Pick your bundle</h1>
        <p className="mt-3 text-muted">
          Answer a few questions. Your bundle prints as a receipt, with one command that installs
          everything on it.
        </p>
      </div>

      <section
        aria-label="Profile picker"
        className="border-t border-line-strong px-4 py-10 sm:px-8"
      >
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
      </section>

      {profiles.length > 0 && (
        <Section
          id="starter"
          number="02"
          title="Starter bundles"
          intro="Skip the questions. The CLI can install a whole profile with aisle init."
        >
          <ul className="grid pl-px pt-px md:grid-cols-3">
            {profiles.map((p) => (
              <li key={p.id} className="-ml-px -mt-px border border-line-strong">
                <BundleCard profile={p} />
              </li>
            ))}
          </ul>
        </Section>
      )}
    </>
  );
}
