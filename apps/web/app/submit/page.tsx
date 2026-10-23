import type { Metadata } from "next";
import { Section } from "../../components/Section";
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

const steps: Array<[string, string]> = [
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

export default function SubmitPage() {
  return (
    <>
      <div className="px-4 py-12 sm:px-8">
        <p className="hud-label text-accent-ink">Submit</p>
        <h1 className="mt-3 text-3xl">List your skill</h1>
        <p className="mt-3 text-muted">
          Skills are added with a pull request that creates one YAML file in{" "}
          <code className="font-mono">registry/community/</code>. Listing is free.
        </p>
      </div>

      <Section id="requirements" number="01" title="Requirements">
        <ul className="list-[square] space-y-3 pl-5 text-sm">
          {requirements.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      </Section>

      <Section id="how" number="02" title="How it works">
        <ol className="grid pl-px pt-px md:grid-cols-2">
          {steps.map(([title, body], i) => (
            <li key={title} className="-ml-px -mt-px border border-line-strong bg-bg-raised p-5">
              <p className="hud-label text-accent-ink">Step {i + 1}</p>
              <h3 className="mt-2 text-lg">{title}</h3>
              <p className="mt-2 text-sm text-muted">{body}</p>
            </li>
          ))}
        </ol>
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
        <ul className="list-[square] space-y-3 pl-5 text-sm">
          <li>
            Your skill is labeled <strong>unverified</strong> until a maintainer has read it, and
            any scripts, in full.
          </li>
          <li>
            Only maintainers set <code className="font-mono">verified</code>. The check rejects
            entries that try to.
          </li>
          <li>
            Questions or problems? Open an issue on{" "}
            <a href={REPO_URL} className="text-accent-ink underline underline-offset-4">
              GitHub
            </a>
            .
          </li>
        </ul>
      </Section>
    </>
  );
}
