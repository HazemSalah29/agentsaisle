import type { Metadata } from "next";
import { Section } from "../../components/Section";
import { CardGrid, CardItem } from "../../components/simple/Cards";
import { HowItWorks } from "../../components/simple/HowItWorks";
import { PageIntro, PrimaryLink } from "../../components/simple/PageIntro";
import { YamlGenerator } from "../../components/YamlGenerator";
import { REPO_URL } from "../../lib/site";

export const metadata: Metadata = {
  title: "Submit a skill",
  description:
    "List your Agent Skill in the registry with a pull request. A form writes the YAML entry for you.",
};

const requirements = [
  <>
    A public GitHub repository with a folder that contains{" "}
    <code className="font-mono">SKILL.md</code>.
  </>,
  <>
    <code className="font-mono">SKILL.md</code> starts with frontmatter that has a{" "}
    <code className="font-mono">name</code> and a <code className="font-mono">description</code>.
    The name is lowercase kebab-case and matches the registry name.
  </>,
  <>
    Every version points at a full commit SHA, so a later push can&apos;t change what people
    install.
  </>,
  <>
    If the skill has a <code className="font-mono">scripts/</code> folder, say so with{" "}
    <code className="font-mono">runs_scripts: true</code>. Users are warned before install and
    reviewers read every script.
  </>,
  <>The name isn&apos;t already taken by another skill.</>,
];

const stepList: Array<[string, string]> = [
  ["Pick a commit", "Choose the tag or branch you want to publish and note its full commit SHA."],
  ["Fill in the form", "It writes the YAML entry and checks it as you type."],
  [
    "Open the pull request",
    "GitHub opens a new-file page with the entry filled in and forks the repository for you if needed.",
  ],
  [
    "Wait for the check",
    "An automatic check confirms your repository, commit, SKILL.md and scripts. A maintainer then reviews it.",
  ],
];

const review: React.ReactNode[] = [
  <>
    Your skill is labeled <strong>unverified</strong> until a maintainer has read it, and any
    scripts, in full.
  </>,
  <>
    Only maintainers set <code className="font-mono">verified</code>. The check rejects entries that
    try to.
  </>,
  <>
    Questions or problems? Open an issue on{" "}
    <a href={REPO_URL} className="text-accent-ink underline underline-offset-4">
      GitHub
    </a>
    .
  </>,
];

export default function SubmitPage() {
  return (
    <>
      <PageIntro
        size="lg"
        eyebrow="Submit"
        lines={["List your skill"]}
        accent="in four steps."
        intro={
          <>
            Skills are added with a pull request that creates one file in{" "}
            <code className="font-mono">registry/community/</code>. Listing is free.
          </>
        }
        actions={<PrimaryLink href="#generator">Write your entry</PrimaryLink>}
      />

      <Section
        id="requirements"
        number="01"
        title="Before you start"
        intro="Five things to have ready."
      >
        <CardGrid className="sm:grid-cols-2 xl:grid-cols-3" label="Requirements">
          {requirements.map((r, i) => (
            <CardItem key={i} plain>
              <div className="p-5">
                <span className="hud-label text-accent-ink">{String(i + 1).padStart(2, "0")}</span>
                <p className="mt-2 text-sm">{r}</p>
              </div>
            </CardItem>
          ))}
        </CardGrid>
      </Section>

      <Section id="how" number="02" title="How it works">
        <HowItWorks steps={stepList.map(([title, text]) => ({ title, text }))} cols={4} />
      </Section>

      <Section
        id="generator"
        number="03"
        title="Write your entry"
        intro="Nothing is sent anywhere until you open the pull request."
      >
        <YamlGenerator />
      </Section>

      <Section id="review" number="04" title="After you submit">
        <CardGrid className="md:grid-cols-3" label="After you submit">
          {review.map((r, i) => (
            <CardItem key={i} plain>
              <p className="p-5 text-sm">{r}</p>
            </CardItem>
          ))}
        </CardGrid>
      </Section>
    </>
  );
}
