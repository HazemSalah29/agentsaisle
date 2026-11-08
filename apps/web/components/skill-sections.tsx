import type { RegistrySkill } from "@agentsaisle/registry-schema";
import type { ReactNode } from "react";
import { githubTreeUrl } from "../lib/github";
import { REPO_URL, reportUrl } from "../lib/site";
import { Badge } from "./Badge";
import { SkillMarkdown } from "./SkillMarkdown";

type Version = { version: string; sha: string };

/** The key facts about a skill: author, version, aisle, clients, source, stars. */
export function FactsTable({ facts }: { facts: Array<[string, ReactNode]> }) {
  return (
    <dl className="self-start border border-line-strong bg-bg-raised text-sm">
      {facts.map(([k, v]) => (
        <div
          key={k}
          className="flex justify-between gap-4 border-b border-line px-4 py-2.5 last:border-b-0"
        >
          <dt className="hud-label text-muted">{k}</dt>
          <dd className="text-right [&_a]:text-accent-ink [&_a]:underline [&_a]:underline-offset-4">
            {v}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** "Before you start": numbered setup steps from skill.meta.yaml. */
export function SetupSteps({
  skill,
  heading = "h2",
}: {
  skill: RegistrySkill;
  heading?: "h2" | "h3";
}) {
  if (!skill.setup?.length) return null;
  const Heading = heading;
  return (
    <section aria-labelledby="setup" className="space-y-4">
      <Heading id="setup" className="text-xl">
        Before you start
      </Heading>
      <ol className="max-w-prose list-decimal space-y-4 pl-5 text-sm">
        {skill.setup.map((step) => (
          <li key={step.title}>
            <b className="text-ink">{step.title}</b>
            <p className="mt-1 whitespace-pre-line text-muted">{step.text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** The notice that a skill includes scripts, with a link to read them. */
export function ScriptsNotice({ skill, sha }: { skill: RegistrySkill; sha: string }) {
  if (!skill.runsScripts) return null;
  return (
    <section aria-labelledby="scripts" className="border border-invert-bg bg-bg-raised p-5">
      <h2 id="scripts" className="flex items-center gap-3 text-lg">
        <Badge kind="scripts" />
        This skill includes scripts
      </h2>
      <p className="mt-3 text-sm">
        {skill.source === "official" && skill.verified
          ? "Your agent may run these scripts on your machine. A maintainer has read every one in full, and the CLI lists the files when you install. You can read them on GitHub first."
          : "Your agent may run these scripts on your machine. The CLI lists the files and asks you to confirm before it installs. Read them on GitHub first."}
      </p>
      <a
        href={githubTreeUrl(skill, sha)}
        rel="noopener noreferrer"
        className="hud-label mt-4 inline-block text-accent-ink underline underline-offset-4"
      >
        Read the files on GitHub
      </a>
    </section>
  );
}

/** Shown on community skills nobody here has read yet. */
export function UnverifiedNotice({ skill }: { skill: RegistrySkill }) {
  if (skill.verified) return null;
  return (
    <section
      aria-labelledby="unverified"
      className="border border-dashed border-line-strong bg-bg-raised p-5"
    >
      <h2 id="unverified" className="flex items-center gap-3 text-lg">
        <Badge kind="unverified" />
        Not reviewed by Agents Aisle
      </h2>
      <p className="mt-3 text-sm">
        This skill was submitted by its author. The version you install is pinned to one commit, so
        it can&apos;t change later, but nobody here has read it yet.
      </p>
    </section>
  );
}

/** The rendered SKILL.md, or a link to read it on GitHub when it could not be loaded. */
export function SkillMdSection({
  skill,
  sha,
  markdown,
}: {
  skill: RegistrySkill;
  sha: string;
  markdown: string | null | undefined;
}) {
  return (
    <section aria-labelledby="skillmd" className="space-y-4">
      <h2 id="skillmd" className="text-xl">
        SKILL.md
      </h2>
      {markdown ? (
        <>
          <p className="hud-label text-muted">Rendered from commit {sha.slice(0, 7)}</p>
          <SkillMarkdown source={markdown} skill={skill} sha={sha} />
        </>
      ) : (
        <p className="border border-line-strong bg-bg-raised p-5 text-sm">
          We could not load SKILL.md right now.{" "}
          <a
            href={githubTreeUrl(skill, sha)}
            rel="noopener noreferrer"
            className="text-accent-ink underline underline-offset-4"
          >
            Read it on GitHub
          </a>
          .
        </p>
      )}
    </section>
  );
}

/** Every released version with its commit and install command. */
export function VersionsTable({ skill, versions }: { skill: RegistrySkill; versions: Version[] }) {
  return (
    <section aria-labelledby="versions" className="space-y-4">
      <h2 id="versions" className="text-xl">
        Version history
      </h2>
      <div className="overflow-x-auto border border-line-strong">
        <table className="w-full text-left text-sm">
          <thead className="bg-bg-sunken">
            <tr>
              <th scope="col" className="hud-label px-4 py-2.5 text-muted">
                Version
              </th>
              <th scope="col" className="hud-label px-4 py-2.5 text-muted">
                Commit
              </th>
              <th scope="col" className="hud-label px-4 py-2.5 text-muted">
                Install
              </th>
            </tr>
          </thead>
          <tbody>
            {versions.map((v) => (
              <tr key={v.version} className="border-t border-line">
                <td className="px-4 py-2.5 font-mono">
                  {v.version}
                  {v.version === skill.latest ? (
                    <span className="hud-label ml-2 text-accent-ink">latest</span>
                  ) : null}
                </td>
                <td className="px-4 py-2.5 font-mono">
                  <a
                    href={githubTreeUrl(skill, v.sha)}
                    rel="noopener noreferrer"
                    className="text-accent-ink underline underline-offset-4"
                  >
                    {v.sha.slice(0, 7)}
                  </a>
                </td>
                <td className="px-4 py-2.5 font-mono text-muted">
                  add {skill.name}
                  {v.version === skill.latest ? "" : `@${v.version}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** Report this skill, and the project on GitHub. */
export function FooterLinks({ skill }: { skill: RegistrySkill }) {
  return (
    <p className="flex flex-wrap gap-x-6 gap-y-2 border-t border-line pt-6 text-sm">
      <a
        href={reportUrl(skill.name)}
        rel="noopener noreferrer"
        className="text-accent-ink underline underline-offset-4"
      >
        Report this skill
      </a>
      <a
        href={REPO_URL}
        rel="noopener noreferrer"
        className="text-muted underline underline-offset-4"
      >
        Agents Aisle on GitHub
      </a>
    </p>
  );
}
