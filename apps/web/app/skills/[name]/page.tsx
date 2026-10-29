import { compareSemver } from "@agentsaisle/registry-schema";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AuditBlock } from "../../../components/AuditBlock";
import { Badge } from "../../../components/Badge";
import { GradeBadge } from "../../../components/GradeBadge";
import { PreviewPairs } from "../../../components/PreviewPairs";
import { InstallCommand } from "../../../components/InstallCommand";
import { SkillMarkdown } from "../../../components/SkillMarkdown";
import { getRepoMeta, getSkillMarkdown, githubTreeUrl } from "../../../lib/github";
import { getRegistry, getSkill } from "../../../lib/registry";
import { pairPreviews, previewCaption, previewSrc } from "../../../lib/links";
import { REPO_URL, reportUrl } from "../../../lib/site";

export const revalidate = 3600;
export const dynamicParams = false;

type Props = { params: Promise<{ name: string }> };

export function generateStaticParams() {
  return getRegistry().skills.map((s) => ({ name: s.name }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const skill = getSkill((await params).name);
  if (!skill) return {};
  return {
    title: skill.name,
    description: skill.description,
    openGraph: { title: `${skill.name} on Agent Aisle`, description: skill.description },
  };
}

const clientNames: Record<string, string> = {
  "claude-code": "Claude Code",
  codex: "Codex",
  cursor: "Cursor",
};

export default async function SkillPage({ params }: Props) {
  const skill = getSkill((await params).name);
  if (!skill) notFound();

  const versions = [...skill.versions].sort((a, b) => compareSemver(b.version, a.version));
  const latest = versions[0]!;
  const owner = skill.repo.split("/")[0]!;
  const [markdown, meta] = await Promise.all([
    getSkillMarkdown(skill, latest.sha),
    getRepoMeta(skill.repo),
  ]);

  const facts: Array<[string, React.ReactNode]> = [
    [
      "Author",
      <a key="a" href={`https://github.com/${owner}`} rel="noopener noreferrer">
        {skill.author}
      </a>,
    ],
    ["Latest", `v${skill.latest}`],
    ["Aisle", skill.category.join(", ")],
    ["Works with", skill.clients.map((c) => clientNames[c] ?? c).join(", ")],
    [
      "Source",
      <a key="s" href={githubTreeUrl(skill, latest.sha)} rel="noopener noreferrer">
        {skill.repo}
      </a>,
    ],
    ...(meta ? ([["Stars", meta.stars.toLocaleString("en-US")]] as Array<[string, string]>) : []),
  ];

  const shots = skill.demo?.screenshots ?? [];
  const phoneShots = shots.filter((f) => /phone/i.test(f));
  const desktopShots = shots.filter((f) => !/phone/i.test(f));
  // English/Arabic pairs ("01-home-en.jpg" and "01-home-ar.jpg") are shown side by side.
  const desktopPairs = pairPreviews(desktopShots);
  const phonePairs = pairPreviews(phoneShots);
  const paired = Boolean(desktopPairs) && (phoneShots.length === 0 || Boolean(phonePairs));

  return (
    <article>
      <header className="grid gap-x-10 gap-y-8 px-4 py-12 sm:px-8 lg:grid-cols-[1fr_20rem]">
        <div>
          <p className="hud-label text-accent-ink">
            <a href="/skills" className="hover:underline">
              Skills
            </a>{" "}
            / {skill.name}
          </p>
          <h1 className="mt-3 text-3xl">{skill.name}</h1>
          <p className="mt-4 text-md text-muted">{skill.description}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Badge
              kind={
                skill.source === "official"
                  ? "official"
                  : skill.verified
                    ? "verified"
                    : "unverified"
              }
            />
            {skill.runsScripts ? <Badge kind="scripts" /> : null}
            {skill.audit ? <GradeBadge grade={skill.audit.grade} /> : null}
          </div>
        </div>
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
      </header>

      <div className="space-y-10 border-t border-line-strong px-4 py-10 sm:px-8">
        <section aria-labelledby="install" className="space-y-4">
          <h2 id="install" className="text-xl">
            Install
          </h2>
          <InstallCommand name={skill.name} versions={versions.map((v) => v.version)} />
          <p className="text-sm text-muted">
            Installs into your project&apos;s skills folder. Add{" "}
            <code className="font-mono">--global</code> to install it for every project.
          </p>
        </section>

        {skill.demo && skill.demo.screenshots.length > 0 && (
          <section aria-labelledby="preview" className="space-y-4">
            <h2 id="preview" className="text-xl">
              Preview
            </h2>
            <p className="text-sm text-muted">
              {skill.demo.caption
                ? skill.demo.caption
                : paired
                  ? "The same demo site before and after this skill: English on the left, Arabic on the right. The Arabic text is a machine-written draft that no native speaker has reviewed yet. These screenshots show a result, not a measured number."
                  : "Screenshots of a demo site built only from this skill's kit. They show the style, not a measured result."}
              {skill.demo.url && (
                <>
                  {" "}
                  <a
                    href={skill.demo.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent-ink underline underline-offset-4"
                  >
                    Open the live demo
                  </a>
                  .
                </>
              )}
            </p>
            {paired && desktopPairs && (
              <PreviewPairs
                skill={skill.name}
                pairs={desktopPairs}
                className="grid gap-4"
                imageClass="aspect-[3/4] object-top"
              />
            )}
            {paired && phonePairs && phonePairs.length > 0 && (
              <PreviewPairs
                skill={skill.name}
                pairs={phonePairs}
                className="grid gap-4 sm:grid-cols-2"
                imageClass="aspect-[9/16] object-top"
              />
            )}
            {(paired
              ? []
              : [
                  {
                    shots: desktopShots,
                    list: "grid gap-4 sm:grid-cols-2",
                    img: "aspect-[8/5] object-top",
                  },
                  {
                    shots: phoneShots,
                    list: "grid max-w-xl grid-cols-3 gap-4",
                    img: "aspect-[9/19] object-top",
                  },
                ]
            ).map(({ shots, list, img }) =>
              shots.length === 0 ? null : (
                <ul key={list} className={list}>
                  {shots.map((file) => (
                    <li key={file} className="border border-line-strong bg-bg-raised">
                      <img
                        src={previewSrc(skill.name, file)}
                        alt={previewCaption(file)}
                        loading="lazy"
                        className={`block w-full object-cover ${img}`}
                      />
                      <p className="hud-label px-3 py-2 text-muted">{previewCaption(file)}</p>
                    </li>
                  ))}
                </ul>
              ),
            )}
          </section>
        )}

        {skill.runsScripts && (
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
              href={githubTreeUrl(skill, latest.sha)}
              rel="noopener noreferrer"
              className="hud-label mt-4 inline-block text-accent-ink underline underline-offset-4"
            >
              Read the files on GitHub
            </a>
          </section>
        )}

        <AuditBlock name={skill.name} version={skill.latest} />

        {!skill.verified && (
          <section
            aria-labelledby="unverified"
            className="border border-dashed border-line-strong bg-bg-raised p-5"
          >
            <h2 id="unverified" className="flex items-center gap-3 text-lg">
              <Badge kind="unverified" />
              Not reviewed by Agent Aisle
            </h2>
            <p className="mt-3 text-sm">
              This skill was submitted by its author. The version you install is pinned to one
              commit, so it can&apos;t change later, but nobody here has read it yet.
            </p>
          </section>
        )}

        <section aria-labelledby="skillmd" className="space-y-4">
          <h2 id="skillmd" className="text-xl">
            SKILL.md
          </h2>
          {markdown ? (
            <>
              <p className="hud-label text-muted">Rendered from commit {latest.sha.slice(0, 7)}</p>
              <SkillMarkdown source={markdown} skill={skill} sha={latest.sha} />
            </>
          ) : (
            <p className="border border-line-strong bg-bg-raised p-5 text-sm">
              We could not load SKILL.md right now.{" "}
              <a
                href={githubTreeUrl(skill, latest.sha)}
                rel="noopener noreferrer"
                className="text-accent-ink underline underline-offset-4"
              >
                Read it on GitHub
              </a>
              .
            </p>
          )}
        </section>

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
            Agent Aisle on GitHub
          </a>
        </p>
      </div>
    </article>
  );
}
