import { compareSemver } from "@agentsaisle/registry-schema";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AuditBlock } from "../../../components/AuditBlock";
import { Badge } from "../../../components/Badge";
import { DemoEmbed } from "../../../components/DemoEmbed";
import { GradeBadge } from "../../../components/GradeBadge";
import { PreviewPairs } from "../../../components/PreviewPairs";
import { InstallCommand } from "../../../components/InstallCommand";
import { SimpleSkillPage } from "../../../components/simple/SimpleSkillPage";
import {
  FactsTable,
  FooterLinks,
  ScriptsNotice,
  SetupSteps,
  SkillMdSection,
  UnverifiedNotice,
  VersionsTable,
} from "../../../components/skill-sections";
import { getRepoMeta, getSkillMarkdown, githubTreeUrl } from "../../../lib/github";
import { libraryOfPart, partsOfLibrary } from "../../../lib/library";
import { getRegistry, getSkill } from "../../../lib/registry";
import { pairPreviews, previewCaption, previewSrc } from "../../../lib/links";

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

  const registry = getRegistry();
  const parts = partsOfLibrary(registry, skill);
  const library = libraryOfPart(registry, skill);
  if (skill.friendly) {
    return (
      <SimpleSkillPage
        skill={skill}
        versions={versions}
        latestSha={latest.sha}
        markdown={markdown}
        facts={facts}
        parts={parts}
      />
    );
  }
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
        <FactsTable facts={facts} />
      </header>

      <div className="space-y-10 border-t border-line-strong px-4 py-10 sm:px-8">
        <section aria-labelledby="install" className="space-y-4">
          <h2 id="install" className="text-xl">
            Install
          </h2>
          {library ? (
            <>
              <p className="max-w-prose text-sm text-muted">
                <b className="text-ink">{skill.name}</b> is a part of the{" "}
                <a href={`/skills/${library.name}`} className="underline underline-offset-4">
                  {library.name}
                </a>{" "}
                library. You do not run it yourself: you type{" "}
                <code className="font-mono">/{library.name}</code> and describe what you want, and
                Claude uses this part when it is needed. Installing the library installs this part
                too.
              </p>
              <InstallCommand name={library.name} versions={[library.latest]} />
            </>
          ) : (
            <>
              <InstallCommand name={skill.name} versions={versions.map((v) => v.version)} />
              <p className="text-sm text-muted">
                Installs into your project&apos;s skills folder. Add{" "}
                <code className="font-mono">--global</code> to install it for every project.
              </p>
            </>
          )}
        </section>

        <SetupSteps skill={skill} />

        {(skill.canDo?.length ?? 0) > 0 && (
          <section aria-labelledby="can-do" className="space-y-4">
            <h2 id="can-do" className="text-xl">
              What it can do
            </h2>
            {parts.length > 0 && (
              <p className="max-w-prose text-sm text-muted">
                Type <code className="font-mono">/{skill.name}</code> and say what you want. Claude
                picks the tools your request needs.
              </p>
            )}
            <ul className="list-[square] space-y-2 pl-5 text-sm">
              {skill.canDo!.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            {parts.length > 0 && (
              <details className="text-sm text-muted">
                <summary className="cursor-pointer hover:text-ink">
                  Built from {parts.length} parts, each audited on its own
                </summary>
                <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 font-mono">
                  {parts.map((p) => (
                    <li key={p.name}>
                      <a href={`/skills/${p.name}`} className="underline underline-offset-4">
                        {p.name}
                      </a>
                      {p.audit ? ` ${p.audit.grade}` : ""}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </section>
        )}

        {skill.demo?.embed && skill.demo.url && (
          <DemoEmbed
            url={skill.demo.url}
            title={`${skill.name} example: the page it generated for a real project`}
            caption={skill.demo.caption}
            steps={skill.demo.steps}
          />
        )}

        {skill.demo && !skill.demo.embed && skill.demo.screenshots.length > 0 && (
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

        <ScriptsNotice skill={skill} sha={latest.sha} />

        <AuditBlock name={skill.name} version={skill.latest} />

        <UnverifiedNotice skill={skill} />

        <SkillMdSection skill={skill} sha={latest.sha} markdown={markdown} />

        <VersionsTable skill={skill} versions={versions} />

        <FooterLinks skill={skill} />
      </div>
    </article>
  );
}
