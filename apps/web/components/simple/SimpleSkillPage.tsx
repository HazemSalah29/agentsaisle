import type { RegistrySkill } from "@agentsaisle/registry-schema";
import type { ReactNode } from "react";
import { githubTreeUrl } from "../../lib/github";
import { firstSentence, splitHeadline } from "../../lib/headline";
import { AuditBlock } from "../AuditBlock";
import { Badge } from "../Badge";
import { GradeBadge } from "../GradeBadge";
import { InstallCommand } from "../InstallCommand";
import { Section } from "../Section";
import { hasPreviews, SkillPreviews } from "../skill-previews";
import {
  FactsTable,
  FooterLinks,
  ScriptsNotice,
  SetupSteps,
  SkillMdSection,
  UnverifiedNotice,
  VersionsTable,
} from "../skill-sections";
import { Plate } from "../SkillCard";
import { CardGrid, CardItem } from "./Cards";
import { HowItWorks } from "./HowItWorks";
import { IdeaCards } from "./IdeaCards";
import { ManageSkill } from "./ManageSkill";
import { MoreDetails } from "./MoreDetails";
import { PageIntro, PrimaryLink, SecondaryLink } from "./PageIntro";
import { VideoScreen } from "./VideoScreen";

type Props = {
  skill: RegistrySkill;
  versions: Array<{ version: string; sha: string }>;
  latestSha: string;
  markdown: string | null | undefined;
  facts: Array<[string, ReactNode]>;
  parts: RegistrySkill[];
  library: RegistrySkill | undefined;
};

/** The three steps, in words anybody can follow. */
function stepsFor(skill: RegistrySkill) {
  const friendly = skill.friendly;
  return [
    { title: "Add it", text: "Copy one line and paste it into Terminal. It takes about a minute." },
    {
      title: "Ask for what you want",
      text: friendly
        ? `Open Claude, type /${skill.name}, then say what you want, like you would to a person.`
        : "Describe the job to your agent in plain words. It picks the skill up on its own when it fits.",
    },
    {
      title: friendly ? "Say yes, get your file" : "Check and keep it",
      text: friendly
        ? "Claude shows you the plan and a draft first. When you are happy, your finished file lands in a folder on your computer."
        : "Look over what it did before you keep it. You can remove the skill any time.",
    },
  ];
}

/** Who made it, what was checked, and whether it runs programs: three short cards, always visible. */
function SafetyCards({ skill, sha }: { skill: RegistrySkill; sha: string }) {
  const official = skill.source === "official";
  const cards: Array<{ title: string; text: ReactNode; dashed?: boolean }> = [
    official
      ? {
          title: "Made by us",
          text: "This is an official skill, written and kept up by the Agent Aisle team.",
        }
      : skill.verified
        ? {
            title: "Read by a maintainer",
            text: "A maintainer read this skill, and any scripts, in full.",
          }
        : {
            title: "Not read yet",
            text: "Its author submitted it and nobody here has read it yet. The version you get is fixed, so it cannot change later.",
            dashed: true,
          },
    skill.audit
      ? {
          title: `Safety check: grade ${skill.audit.grade}`,
          text: "An automated check read every file for risky patterns. It helps, but it is not a guarantee.",
        }
      : {
          title: "Not checked yet",
          text: "No automated safety check has been run on this skill yet.",
          dashed: true,
        },
    skill.runsScripts
      ? {
          title: "Runs small programs",
          text:
            official && skill.verified
              ? "Your agent may run helper programs on your computer. A maintainer read every one."
              : "Your agent may run helper programs on your computer. The installer lists them and asks you first.",
        }
      : {
          title: "Instructions only",
          text: "It is made of instructions. It has no programs to run.",
        },
  ];
  return (
    <CardGrid className="sm:grid-cols-3" label="Safety summary">
      {cards.map((c) => (
        <CardItem key={c.title} plain>
          <div
            className={`h-full p-4 ${c.dashed ? "border-l-2 border-dashed border-line-strong" : ""}`}
          >
            <h3 className="text-base">{c.title}</h3>
            <p className="mt-2 text-sm text-muted">{c.text}</p>
          </div>
        </CardItem>
      ))}
      <li className="sm:col-span-3">
        <a
          href={githubTreeUrl(skill, sha)}
          rel="noopener noreferrer"
          className="hud-label text-accent-ink underline underline-offset-4"
        >
          Read the files on GitHub
        </a>
      </li>
    </CardGrid>
  );
}

/** One page for every skill: big plain words, motion, a few clear steps, and the technical parts tucked away. */
export function SimpleSkillPage({
  skill,
  versions,
  latestSha,
  markdown,
  facts,
  parts,
  library,
}: Props) {
  const friendly = skill.friendly;
  const { lines, accent } = friendly
    ? splitHeadline(friendly.headline)
    : { lines: [skill.name], accent: "" };
  const installName = library?.name ?? skill.name;
  const previews = hasPreviews(skill);
  const canDo = skill.canDo ?? [];
  let n = 0;
  const next = () => String(++n).padStart(2, "0");

  return (
    <article>
      <PageIntro
        size={friendly ? "xl" : "lg"}
        eyebrow={
          <>
            <a href="/skills" className="hover:underline">
              Skills
            </a>{" "}
            / {skill.name}
          </>
        }
        lines={lines}
        accent={accent}
        intro={friendly?.intro ?? firstSentence(skill.description)}
        actions={
          <>
            <PrimaryLink href="#manage">Add it</PrimaryLink>
            {friendly && <SecondaryLink href="#ideas">See what it makes</SecondaryLink>}
            <div className="flex flex-wrap gap-2">
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
          </>
        }
        aside={
          friendly && skill.category.includes("video") ? (
            <VideoScreen />
          ) : (
            <div className="mx-auto w-full max-w-60 border border-line-strong">
              <Plate skill={skill} />
            </div>
          )
        }
      />

      {friendly ? (
        <Section
          id="ideas"
          number={next()}
          title="What you can ask for"
          intro={`Type /${skill.name}, then say it in your own words.`}
        >
          <IdeaCards ideas={friendly.ideas} />
        </Section>
      ) : (
        canDo.length > 0 && (
          <Section id="can-do" number={next()} title="What it does">
            <CardGrid className="sm:grid-cols-2" label="What it does">
              {canDo.map((line, i) => (
                <CardItem key={line}>
                  <div className="p-5">
                    <span className="hud-label text-accent-ink">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <p className="mt-2 text-sm">{line}</p>
                  </div>
                </CardItem>
              ))}
            </CardGrid>
          </Section>
        )
      )}

      {previews && (
        <div className="border-t border-line-strong px-4 py-12 sm:px-8 sm:py-16">
          <SkillPreviews skill={skill} />
        </div>
      )}

      <Section id="how" number={next()} title="How it works">
        <HowItWorks steps={stepsFor(skill)} />
        {friendly?.firstTime && (
          <div className="mt-10 max-w-prose border border-dashed border-line-strong bg-bg-raised p-5">
            <p className="hud-label text-accent-ink">First time only</p>
            <p className="mt-2 text-sm">{friendly.firstTime}</p>
          </div>
        )}
      </Section>

      <Section
        id="manage"
        number={next()}
        title="Add, update or remove"
        intro={
          library
            ? `${skill.name} is a part of the ${library.name} skill. You add ${library.name} and this part comes with it.`
            : "One line each. Copy it, paste it into Terminal, press Enter."
        }
      >
        <ManageSkill name={installName} />
        {!library && versions.length > 1 && (
          <div className="mt-4">
            <MoreDetails
              tone="boxed"
              title="Need an older version?"
              hint="Pick one and copy the line"
            >
              <section aria-labelledby="install" className="pt-2">
                <h3 id="install" className="sr-only">
                  Install
                </h3>
                <InstallCommand name={skill.name} versions={versions.map((v) => v.version)} />
              </section>
            </MoreDetails>
          </div>
        )}
      </Section>

      <Section id="safe" number={next()} title="Is it safe?">
        <SafetyCards skill={skill} sha={latestSha} />
        {!skill.verified && (
          <div className="mt-6">
            <UnverifiedNotice skill={skill} />
          </div>
        )}
      </Section>

      <section aria-labelledby="details" className="border-t border-line-strong">
        <div className="px-4 py-12 sm:px-8">
          <p className="hud-label text-accent-ink">Aisle {next()}</p>
          <h2 id="details" className="mt-2 text-xl">
            For technical readers
          </h2>
          <div className="mt-6 max-w-4xl">
            <MoreDetails
              tone="boxed"
              title="All the details"
              hint="Versions, the full safety report, the parts and the instructions your agent reads."
            >
              <div className="space-y-10 pt-4">
                <p className="max-w-prose text-sm text-muted">{skill.description}</p>
                <FactsTable facts={facts} />
                <SetupSteps skill={skill} heading="h3" />
                {parts.length > 0 && (
                  <section aria-labelledby="parts" className="space-y-3">
                    <h3 id="parts" className="text-xl">
                      Built from {parts.length} parts
                    </h3>
                    <ul className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-sm">
                      {parts.map((p) => (
                        <li key={p.name}>
                          <a href={`/skills/${p.name}`} className="underline underline-offset-4">
                            {p.name}
                          </a>
                          {p.audit ? ` ${p.audit.grade}` : ""}
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
                <ScriptsNotice skill={skill} sha={latestSha} />
                <AuditBlock name={skill.name} version={skill.latest} />
                <SkillMdSection skill={skill} sha={latestSha} markdown={markdown} />
                <VersionsTable skill={skill} versions={versions} />
                <FooterLinks skill={skill} />
              </div>
            </MoreDetails>
          </div>
        </div>
      </section>
    </article>
  );
}
