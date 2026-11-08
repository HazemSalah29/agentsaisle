import type { RegistrySkill } from "@agentsaisle/registry-schema";
import type { ReactNode } from "react";
import { AuditBlock } from "../AuditBlock";
import { Badge } from "../Badge";
import { GradeBadge } from "../GradeBadge";
import {
  FactsTable,
  FooterLinks,
  ScriptsNotice,
  SetupSteps,
  SkillMdSection,
  UnverifiedNotice,
  VersionsTable,
} from "../skill-sections";
import { Hero } from "./Hero";
import { HowItWorks } from "./HowItWorks";
import { IdeaCards } from "./IdeaCards";
import { ManageSkill } from "./ManageSkill";
import { MoreDetails } from "./MoreDetails";
import { Reveal, SimpleMotion } from "./motion";

type Props = {
  skill: RegistrySkill;
  versions: Array<{ version: string; sha: string }>;
  latestSha: string;
  markdown: string | null | undefined;
  facts: Array<[string, ReactNode]>;
  parts: RegistrySkill[];
};

/** "Add the skill to Claude" in words anybody can follow. */
const stepsFor = (name: string, firstTime?: string) => [
  {
    title: "Add it",
    text: "Copy one line and paste it into Terminal. It takes about a minute.",
  },
  {
    title: "Ask for what you want",
    text: `Open Claude, type /${name}, then say what you want, like you would to a person.`,
  },
  {
    title: "Say yes, get your file",
    text: firstTime
      ? "Claude shows you the plan and a draft first. When you are happy, your finished file lands in a folder on your computer."
      : "Claude shows you the result first. When you are happy, you get your file.",
  },
];

function PlainSection({
  id,
  number,
  title,
  intro,
  children,
}: {
  id: string;
  number: string;
  title: string;
  intro?: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={`${id}-h`} id={id} className="border-t border-line-strong">
      <div className="px-4 py-12 sm:px-8 sm:py-16">
        <Reveal>
          <p className="hud-label text-accent-ink">Aisle {number}</p>
          <h2 id={`${id}-h`} className="mt-2 text-2xl">
            {title}
          </h2>
          {intro && <p className="mt-3 max-w-prose text-base text-muted">{intro}</p>}
        </Reveal>
        <div className="mt-8">{children}</div>
      </div>
    </section>
  );
}

/** The simple version of a skill page: big plain words, motion, three clear steps, details tucked away. */
export function SimpleSkillPage({ skill, versions, latestSha, markdown, facts, parts }: Props) {
  const friendly = skill.friendly!;
  const sentences = friendly.headline.split(/(?<=[.!?])\s+/).filter(Boolean);
  const accentLine = sentences.length > 1 ? sentences[sentences.length - 1]! : "";
  const lines = sentences.length > 1 ? sentences.slice(0, -1) : sentences;

  return (
    <SimpleMotion>
      <article>
        <Hero
          label={
            <>
              <a href="/skills" className="hover:underline">
                Skills
              </a>{" "}
              / {skill.name}
            </>
          }
          lines={lines}
          accentLine={accentLine}
          intro={friendly.intro}
          badges={
            <>
              <Badge
                kind={
                  skill.source === "official"
                    ? "official"
                    : skill.verified
                      ? "verified"
                      : "unverified"
                }
              />
              {skill.audit ? <GradeBadge grade={skill.audit.grade} /> : null}
            </>
          }
        />

        <PlainSection
          id="ideas"
          number="01"
          title="What you can ask for"
          intro={`Type /${skill.name}, then say it in your own words.`}
        >
          <IdeaCards ideas={friendly.ideas} />
        </PlainSection>

        <PlainSection id="how" number="02" title="How it works">
          <HowItWorks steps={stepsFor(skill.name, friendly.firstTime)} />
          {friendly.firstTime && (
            <Reveal
              delay={0.2}
              className="mt-10 max-w-prose border border-dashed border-line-strong bg-bg-raised p-5"
            >
              <p className="hud-label text-accent-ink">First time only</p>
              <p className="mt-2 text-sm">{friendly.firstTime}</p>
            </Reveal>
          )}
        </PlainSection>

        <PlainSection
          id="manage"
          number="03"
          title="Add, update or remove"
          intro="One line each. Copy it, paste it into Terminal, press Enter."
        >
          <Reveal>
            <ManageSkill name={skill.name} />
          </Reveal>
        </PlainSection>

        <PlainSection id="safe" number="04" title="Is it safe?">
          <Reveal className="grid gap-4 sm:grid-cols-3">
            {[
              [
                "Made by us",
                "This is an official skill, written and kept up by the Agent Aisle team.",
              ],
              [
                "Checked",
                "An automated check reads every file for risky patterns. It helps, but it is not a guarantee.",
              ],
              [
                "On your computer",
                "Your videos are made on your own computer, and nothing is posted for you.",
              ],
            ].map(([title, text]) => (
              <div key={title} className="border border-line-strong bg-bg-raised p-4">
                <h3 className="text-base">{title}</h3>
                <p className="mt-2 text-sm text-muted">{text}</p>
              </div>
            ))}
          </Reveal>
        </PlainSection>

        <section aria-labelledby="details-h" className="border-t border-line-strong">
          <div className="px-4 py-12 sm:px-8">
            <p className="hud-label text-accent-ink">Aisle 05</p>
            <h2 id="details-h" className="mt-2 text-xl">
              For technical readers
            </h2>
            <div className="mt-6 max-w-4xl">
              <MoreDetails
                tone="boxed"
                title="All the details"
                hint="Versions, the full safety report, the parts it is built from and the instructions Claude reads."
              >
                <div className="space-y-10 pt-4">
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
                  <UnverifiedNotice skill={skill} />
                  <SkillMdSection skill={skill} sha={latestSha} markdown={markdown} />
                  <VersionsTable skill={skill} versions={versions} />
                  <FooterLinks skill={skill} />
                </div>
              </MoreDetails>
            </div>
          </div>
        </section>
      </article>
    </SimpleMotion>
  );
}
