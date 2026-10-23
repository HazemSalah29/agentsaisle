import { RegistryIndex, type RegistrySkill } from "@agentsaisle/registry-schema";
import type { Metadata } from "next";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { Badge } from "../../components/Badge";
import { InstallCommand } from "../../components/InstallCommand";
import { Section } from "../../components/Section";
import { SiteFooter } from "../../components/SiteFooter";
import { SiteHeader } from "../../components/SiteHeader";
import { SkillCard } from "../../components/SkillCard";
import { aisleColor } from "../../lib/plate";
import { FilterBarDemo, ReceiptDemo } from "./Demos";

export const metadata: Metadata = {
  title: "Design system",
  robots: { index: false, follow: false },
};

const swatches: Array<{ token: string; name: string; role: string }> = [
  { token: "bg", name: "Bg", role: "Page" },
  { token: "bg-raised", name: "Raised", role: "Cards, panels" },
  { token: "bg-sunken", name: "Sunken", role: "Code, plates" },
  { token: "ink", name: "Ink", role: "Text" },
  { token: "muted", name: "Muted", role: "Secondary text" },
  { token: "line-strong", name: "Line", role: "Hairlines, controls" },
  { token: "accent", name: "Accent", role: "Signal orange" },
  { token: "invert-bg", name: "Invert", role: "Buttons, hover" },
  { token: "aisle-code", name: "Code", role: "Aisle ink" },
  { token: "aisle-design", name: "Design", role: "Aisle ink" },
  { token: "aisle-git", name: "Git", role: "Aisle ink" },
  { token: "aisle-writing", name: "Writing", role: "Aisle ink" },
  { token: "aisle-video", name: "Video", role: "Aisle ink" },
];

const scale = [
  ["text-4xl", "4xl"],
  ["text-3xl", "3xl"],
  ["text-2xl", "2xl"],
  ["text-xl", "xl"],
  ["text-lg", "lg"],
  ["text-md", "md"],
  ["text-base", "base"],
  ["text-sm", "sm"],
] as const;

const spacing = [1, 2, 3, 4, 6, 8, 12, 16, 24];

const fixtures: RegistrySkill[] = [
  {
    name: "reel-scriptwriter",
    description:
      "Turns a rough idea into a short-form video script with a hook, beats and an on-screen text track. Asks for your audience and tone first, then writes three variants you can compare side by side.",
    source: "community",
    author: "reel-lab",
    repo: "reel-lab/video-skills",
    path: "skills/reel-scriptwriter",
    latest: "1.1.0",
    versions: [{ version: "1.1.0", sha: "3f9c2e1".padEnd(40, "0") }],
    category: ["video", "social"],
    clients: ["claude-code", "codex", "cursor"],
    runsScripts: true,
    verified: false,
  },
  {
    name: "changelog",
    description: "Drafts release notes from merged pull requests.",
    source: "community",
    author: "dev-notes",
    repo: "dev-notes/skills",
    path: "changelog",
    latest: "0.4.2",
    versions: [{ version: "0.4.2", sha: "a81b77d".padEnd(40, "0") }],
    category: ["writing"],
    clients: ["claude-code"],
    runsScripts: false,
    verified: true,
  },
];

function Palette({ theme }: { theme: "light" | "dark" }) {
  return (
    <div
      data-theme={theme}
      className="border border-line-strong"
      style={{ background: "var(--bg)", color: "var(--ink)" }}
    >
      <p
        className="hud-label border-b px-4 py-3"
        style={{ borderColor: "var(--line)", color: "var(--muted)" }}
      >
        {theme}
      </p>
      <ul className="grid grid-cols-2 sm:grid-cols-3">
        {swatches.map((s) => (
          <li key={s.token} className="border-b border-r" style={{ borderColor: "var(--line)" }}>
            <div className="h-12" style={{ background: `var(--${s.token})` }} aria-hidden="true" />
            <div className="px-3 py-2">
              <p className="text-sm font-semibold">{s.name}</p>
              <p className="text-xs" style={{ color: "var(--muted)" }}>
                {s.role}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default async function DesignPage() {
  const raw = await readFile(path.join(process.cwd(), "public", "registry.json"), "utf8");
  const real = RegistryIndex.parse(JSON.parse(raw)).skills;
  const lineup = [...real, ...fixtures];

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-[1200px] border-x border-line">
        <div className="grid gap-x-10 gap-y-8 px-4 py-14 sm:px-8 lg:grid-cols-[1.1fr_1fr] lg:items-end">
          <div>
            <p className="hud-label text-accent-ink">Aisle 00 / Design system</p>
            <h1 className="mt-4 max-w-3xl text-4xl">
              Skills for your agent.{" "}
              <span className="font-serif font-normal italic text-accent-ink">One command.</span>
            </h1>
            <p className="mt-5 max-w-xl text-md text-muted">
              Every token and component the site is built from: a hairline grid, sharp corners, mono
              labels and one signal-orange accent.
            </p>
          </div>
          <InstallCommand name="explore" versions={["1.2.0", "1.1.0", "1.0.0"]} />
        </div>

        <Section
          id="color"
          number="01"
          title="Color"
          intro="Warm neutrals, one accent, and a text-safe ink for each aisle. Every text pair is checked for AA contrast in a test."
        >
          <div className="grid gap-6 xl:grid-cols-2">
            <Palette theme="light" />
            <Palette theme="dark" />
          </div>
        </Section>

        <Section
          id="type"
          number="02"
          title="Type"
          intro="Archivo for headings, Instrument Serif for one phrase, IBM Plex Sans for reading, Geist Mono for commands and labels."
        >
          <div className="grid gap-10 lg:grid-cols-2">
            <div className="space-y-6">
              <div>
                <p className="hud-label text-muted">Display, Archivo 500</p>
                <p className="mt-1 font-display text-3xl font-medium tracking-[-0.03em] text-ink-strong">
                  Thirteen skills on the shelf
                </p>
              </div>
              <div>
                <p className="hud-label text-muted">Accent, Instrument Serif italic</p>
                <p className="mt-1 font-serif text-3xl italic">One command.</p>
              </div>
              <div>
                <p className="hud-label text-muted">Body, IBM Plex Sans</p>
                <p className="mt-1 text-base">
                  A skill is a folder with a SKILL.md that teaches your agent one job. Pick the ones
                  you need and install them with a single command.
                </p>
              </div>
              <div>
                <p className="hud-label text-muted">Command, Geist Mono</p>
                <p className="mt-1 font-mono text-sm">npx @agentsaisle/cli add explore</p>
              </div>
            </div>
            <ul className="border border-line-strong">
              {scale.map(([cls, label]) => (
                <li
                  key={label}
                  className="flex items-baseline gap-4 border-b border-line px-4 py-2 last:border-b-0"
                >
                  <span className="hud-label w-12 shrink-0 text-muted">{label}</span>
                  <span
                    className={`font-display font-medium leading-tight tracking-[-0.03em] ${cls}`}
                  >
                    Skill name
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Section>

        <Section
          id="shape"
          number="03"
          title="Spacing and shape"
          intro="A 4px base. Corners are square; structure comes from 1px hairlines."
        >
          <div className="grid gap-10 md:grid-cols-2">
            <ul className="space-y-2">
              {spacing.map((n) => (
                <li key={n} className="flex items-center gap-3">
                  <span className="hud-label w-14 text-muted">{n * 4}px</span>
                  <span className="block h-3 bg-accent" style={{ width: n * 4 }} />
                </li>
              ))}
            </ul>
            <div className="grid grid-cols-2 gap-px border border-line-strong bg-line-strong">
              <div className="bg-bg-raised p-4">
                <p className="hud-label text-muted">Hairline</p>
                <p className="mt-1 text-sm">1px, 16% ink</p>
              </div>
              <div className="bg-bg-raised p-4">
                <p className="hud-label text-muted">Control line</p>
                <p className="mt-1 text-sm">1px, 40% ink</p>
              </div>
              <div className="bg-invert-bg p-4 text-invert-fg">
                <p className="hud-label">Inverted</p>
                <p className="mt-1 text-sm">Hover and primary</p>
              </div>
              <div className="bg-accent p-4 text-on-accent">
                <p className="hud-label">Accent</p>
                <p className="mt-1 text-sm">Official, copied</p>
              </div>
            </div>
          </div>
        </Section>

        <Section
          id="badge"
          number="04"
          title="Badge"
          intro="Four states. Each differs in shape or fill as well as color, so none relies on color alone."
        >
          <div className="flex flex-wrap gap-3">
            <Badge kind="official" />
            <Badge kind="verified" />
            <Badge kind="unverified" />
            <Badge kind="scripts" />
          </div>
        </Section>

        <Section
          id="install"
          number="05"
          title="InstallCommand"
          intro="Pick a version and the command follows. Copy confirms in place."
        >
          <div className="flex flex-col gap-6">
            <InstallCommand name="explore" versions={["1.2.0", "1.1.0", "1.0.0"]} />
            <InstallCommand name="commit" versions={["1.0.0"]} />
          </div>
        </Section>

        <Section
          id="filter"
          number="06"
          title="FilterBar"
          intro="Search, aisles, clients, source, trust filters and sort. The filtering logic arrives with the catalog."
        >
          <FilterBarDemo />
        </Section>

        <Section
          id="lineup"
          number="07"
          title="The lineup"
          intro="Real skills from the registry, then harder cases: a long description and a community skill that runs scripts."
        >
          <ul
            className="mb-6 flex flex-wrap border-l border-t border-line-strong"
            aria-label="Skills"
          >
            {lineup.map((s) => (
              <li key={s.name} className="border-b border-r border-line-strong bg-bg-raised">
                <a
                  href="#lineup"
                  title={s.name}
                  aria-label={s.name}
                  className="flex size-12 items-center justify-center font-mono text-md hover:bg-invert-bg hover:text-invert-fg"
                  style={{ color: aisleColor(s.category) }}
                >
                  {s.name[0]}
                </a>
              </li>
            ))}
          </ul>
          <ul className="grid border-l border-t border-line-strong sm:grid-cols-2 xl:grid-cols-3">
            {lineup.map((s, i) => (
              <li key={s.name} className="border-b border-r border-line-strong bg-bg-raised">
                <SkillCard skill={s} index={i + 1} href="#lineup" />
              </li>
            ))}
          </ul>
        </Section>

        <Section
          id="receipt"
          number="08"
          title="Bundle"
          intro="A bundle from the profile picker. Adding a skill flashes the new line."
        >
          <ReceiptDemo date="23 Oct 2026" />
        </Section>

        <div className="border-t border-line-strong bg-bg-sunken px-4 py-14 sm:px-8">
          <h2 className="max-w-2xl text-3xl">Have a skill? Put it on the shelf.</h2>
          <p className="mt-3 text-muted">
            Submit it with a pull request. Listing is free and versions are pinned to a commit.
          </p>
          <a
            href="/submit"
            className="hud-label mt-6 inline-flex h-11 items-center bg-invert-bg px-6 font-bold text-invert-fg hover:opacity-80"
          >
            Submit a skill
          </a>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
