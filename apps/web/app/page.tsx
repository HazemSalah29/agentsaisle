import type { Metadata } from "next";
import { InstallCommand } from "../components/InstallCommand";
import { Receipt } from "../components/Receipt";
import { Section } from "../components/Section";
import { SkillCard } from "../components/SkillCard";
import { getCatalog } from "../lib/catalog";
import { getRegistry } from "../lib/registry";
import { sortSkills } from "../lib/search";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: { absolute: "Agent Aisle: skills for your agent" },
  description:
    "Browse Agent Skills for Claude Code, Codex and Cursor, and install any of them with one command.",
};

const steps = [
  ["Find a skill", "Search the catalog by what you want your agent to do."],
  ["Copy the command", "Every skill page shows one line. Pick a version if you need an older one."],
  [
    "Use it",
    "The skill lands in your project's skills folder. Your agent picks it up on its next run.",
  ],
] as const;

export default async function Home() {
  const skills = await getCatalog();
  const featured = skills.filter((s) => s.source === "official");
  const newest = sortSkills(
    skills.filter((s) => s.source === "community"),
    "newest",
  ).slice(0, 3);
  const first = featured[0] ?? skills[0];
  const profile = getRegistry().profiles[0];
  const starter = (profile?.skills ?? skills.slice(0, 3).map((x) => x.name)).flatMap((name) => {
    const s = skills.find((x) => x.name === name);
    return s ? [{ name: s.name, version: s.latest }] : [];
  });

  return (
    <>
      <div className="grid gap-x-10 gap-y-8 px-4 py-14 sm:px-8 lg:grid-cols-[1.1fr_1fr] lg:items-end">
        <div>
          <p className="hud-label text-accent-ink">Agent Skills store</p>
          <h1 className="mt-4 max-w-3xl text-4xl">
            Find a skill.{" "}
            <span className="font-serif font-normal italic text-accent-ink">
              Install it in one line.
            </span>
          </h1>
          <p className="mt-5 max-w-xl text-md text-muted">
            Skills teach your agent one job each. Browse ours and the community&apos;s, then add
            them to Claude Code, Codex or Cursor.
          </p>
          <form action="/skills" method="get" role="search" className="mt-8 flex max-w-xl">
            <label htmlFor="home-search" className="sr-only">
              Search skills
            </label>
            <input
              id="home-search"
              name="q"
              type="search"
              placeholder="Search skills, for example git"
              className="h-12 min-w-0 flex-1 border border-line-strong bg-bg-raised px-4 text-base text-ink placeholder:text-muted"
            />
            <button
              type="submit"
              className="hud-label h-12 border border-invert-bg bg-invert-bg px-6 font-bold text-invert-fg hover:opacity-80"
            >
              Search
            </button>
          </form>
        </div>
        {first && (
          <InstallCommand name={first.name} versions={first.versions.map((v) => v.version)} />
        )}
      </div>

      <Section id="featured" number="01" title="Featured" intro="Made and checked by us.">
        <ul className="grid pl-px pt-px sm:grid-cols-2 xl:grid-cols-3">
          {featured.map((s) => (
            <li key={s.name} className="-ml-px -mt-px border border-line-strong bg-bg-raised">
              <SkillCard skill={s} href={`/skills/${s.name}`} stars={s.stars} />
            </li>
          ))}
        </ul>
        <a
          href="/skills"
          className="hud-label mt-6 inline-block text-accent-ink underline underline-offset-4"
        >
          Browse all {skills.length} skills
        </a>
      </Section>

      {newest.length > 0 && (
        <Section
          id="community"
          number="02"
          title="Newest from the community"
          intro="Submitted by their authors. Each one is labeled until we've read it."
        >
          <ul className="grid pl-px pt-px sm:grid-cols-2 xl:grid-cols-3">
            {newest.map((s) => (
              <li key={s.name} className="-ml-px -mt-px border border-line-strong bg-bg-raised">
                <SkillCard skill={s} href={`/skills/${s.name}`} stars={s.stars} />
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section id="how" number="03" title="How it works">
        <ol className="grid pl-px pt-px md:grid-cols-3">
          {steps.map(([title, body], i) => (
            <li key={title} className="-ml-px -mt-px border border-line-strong bg-bg-raised p-6">
              <p className="hud-label text-accent-ink">Step {i + 1}</p>
              <h3 className="mt-3 text-lg">{title}</h3>
              <p className="mt-2 text-sm text-muted">{body}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section
        id="profiles"
        number="04"
        title="Not sure where to start?"
        intro="Answer a few questions and get a bundle of skills with one command to install them all."
      >
        <div className="flex flex-wrap items-start gap-8">
          <Receipt items={starter} date="starter bundle" />
          <div className="max-w-sm">
            <p className="text-sm text-muted">
              This is the code starter bundle. The picker builds one to fit how you work.
            </p>
            <a
              href="/profiles"
              className="hud-label mt-4 inline-block text-accent-ink underline underline-offset-4"
            >
              Pick your bundle
            </a>
          </div>
        </div>
      </Section>
    </>
  );
}
