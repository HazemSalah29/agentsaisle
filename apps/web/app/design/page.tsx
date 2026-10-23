import { RegistryIndex, type RegistrySkill } from "@agentsaisle/registry-schema";
import type { Metadata } from "next";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { Badge } from "../../components/Badge";
import { InstallCommand } from "../../components/InstallCommand";
import { Shelf } from "../../components/Shelf";
import { SkillCard } from "../../components/SkillCard";
import { ThemeToggle } from "../../components/ThemeToggle";
import { FilterBarDemo, ReceiptDemo } from "./Demos";

export const metadata: Metadata = {
  title: "Design system",
  robots: { index: false, follow: false },
};

const swatches: Array<{ token: string; name: string; role: string }> = [
  { token: "bag", name: "Bag", role: "Page ground" },
  { token: "ink", name: "Ink", role: "Text, rules" },
  { token: "ink-soft", name: "Ink soft", role: "Secondary text" },
  { token: "label", name: "Label", role: "Cards, panels" },
  { token: "sticker", name: "Sticker", role: "The one accent" },
  { token: "thermal", name: "Thermal", role: "Receipt paper" },
];

const scale = [
  ["text-4xl", "4xl"],
  ["text-3xl", "3xl"],
  ["text-2xl", "2xl"],
  ["text-xl", "xl"],
  ["text-lg", "lg"],
  ["text-md", "md"],
  ["text-sm", "sm"],
  ["text-xs", "xs"],
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

function Section({
  id,
  title,
  intro,
  children,
}: {
  id: string;
  title: string;
  intro?: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="border-t-[6px] border-ink pt-6">
      <h2 id={id} className="text-3xl font-black">
        {title}
      </h2>
      {intro && <p className="mt-2 text-ink-soft">{intro}</p>}
      <div className="mt-8">{children}</div>
    </section>
  );
}

function Palette({ theme }: { theme: "light" | "dark" }) {
  return (
    <div
      data-theme={theme}
      className="rounded-label border-[1.5px] border-ink p-4"
      style={{ background: "var(--bag)", color: "var(--ink)" }}
    >
      <p className="mb-3 font-display text-xl font-bold">{theme === "light" ? "Light" : "Dark"}</p>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {swatches.map((s) => (
          <li key={s.token}>
            <div
              className="h-14 rounded-label border-[1.5px]"
              style={{ background: `var(--${s.token})`, borderColor: "var(--ink)" }}
              aria-hidden="true"
            />
            <p className="mt-1 text-xs font-bold">{s.name}</p>
            <p className="text-xs" style={{ color: "var(--ink-soft)" }}>
              {s.role}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default async function DesignPage() {
  const raw = await readFile(path.join(process.cwd(), "public", "registry.json"), "utf8");
  const real = RegistryIndex.parse(JSON.parse(raw)).skills;

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-16 px-4 pb-24 pt-6 sm:px-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <p className="font-display text-2xl font-black">Agent Aisle</p>
        <ThemeToggle />
      </header>

      <div>
        <h1 className="text-4xl font-black">Design system</h1>
        <p className="mt-4 text-md">
          Skills are shelf labels. The page is bag paper, labels are card stock, and the one bright
          thing is the price sticker. This page shows every token and component the site is built
          from.
        </p>
      </div>

      <Section
        id="color"
        title="Color"
        intro="Labels, the receipt and the sticker stay light in both themes, like printed objects. Every text pair is checked for AA contrast in a test."
      >
        <div className="grid gap-6 md:grid-cols-2">
          <Palette theme="light" />
          <Palette theme="dark" />
        </div>
      </Section>

      <Section
        id="type"
        title="Type"
        intro="Big Shoulders for signage, Source Serif for reading, DM Mono for anything you type or copy."
      >
        <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr]">
          <div className="space-y-6">
            <div>
              <p className="text-xs text-ink-soft">Display: Big Shoulders, 700 to 900</p>
              <p className="font-display text-4xl font-black">Fresh on the shelf</p>
            </div>
            <div>
              <p className="text-xs text-ink-soft">Body: Source Serif 4</p>
              <p className="text-sm">
                A skill is a folder with a SKILL.md that teaches your agent one job. Pick the ones
                you need and install them with a single command.{" "}
                <em>Italic is for emphasis only.</em>
              </p>
            </div>
            <div>
              <p className="text-xs text-ink-soft">Command: DM Mono</p>
              <p className="font-mono text-sm">npx @agentsaisle/cli add explore</p>
            </div>
          </div>
          <ul className="divide-y divide-ink/30 border-y border-ink/30">
            {scale.map(([cls, label]) => (
              <li key={label} className="flex items-baseline gap-4 py-2">
                <span className="w-10 shrink-0 font-mono text-xs text-ink-soft">{label}</span>
                <span className={`font-display font-extrabold leading-tight ${cls}`}>
                  Skill name
                </span>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      <Section
        id="shape"
        title="Spacing and shape"
        intro="A 4px base. Corners are chosen per object: die-cut labels, pill stickers, a torn receipt."
      >
        <div className="grid gap-10 md:grid-cols-2">
          <ul className="space-y-2">
            {spacing.map((n) => (
              <li key={n} className="flex items-center gap-3">
                <span className="w-16 font-mono text-xs text-ink-soft">{n * 4}px</span>
                <span className="block h-4 bg-ink" style={{ width: n * 4 }} />
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-start gap-6">
            <div className="rounded-label border-[1.5px] border-label-rule bg-label px-5 py-4 text-label-ink shadow-label">
              <p className="font-display text-xl font-bold">Label</p>
              <p className="text-xs">2px corners, hard shadow</p>
            </div>
            <div className="rounded-sticker border-[1.5px] border-label-rule bg-sticker px-6 py-3 font-display text-lg font-extrabold text-on-sticker">
              Sticker
            </div>
            <div className="torn-edge bg-thermal px-6 pb-8 pt-4 font-mono text-xs text-thermal-ink">
              Receipt edge
            </div>
          </div>
        </div>
      </Section>

      <Section
        id="badge"
        title="Badge"
        intro="Four states. Each has a shape cue as well as a color, so none relies on color alone."
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
        title="InstallCommand"
        intro="Pick a version and the command follows. Copy stamps the label."
      >
        <div className="flex flex-col gap-8">
          <InstallCommand name="explore" versions={["1.2.0", "1.1.0", "1.0.0"]} />
          <InstallCommand name="commit" versions={["1.0.0"]} />
        </div>
      </Section>

      <Section
        id="filter"
        title="FilterBar"
        intro="Search, aisles, clients, source, trust filters and sort. Filtering logic arrives with the catalog."
      >
        <FilterBarDemo />
      </Section>

      <Section
        id="card"
        title="SkillCard and Shelf"
        intro="Real skills from the registry first, then the harder cases: a long description and a community skill that runs scripts."
      >
        <div className="flex flex-col gap-4">
          <Shelf title="From the registry">
            {real.map((s) => (
              <SkillCard key={s.name} skill={s} href="#card" />
            ))}
          </Shelf>
          <Shelf title="Edge cases">
            {fixtures.map((s) => (
              <SkillCard key={s.name} skill={s} href="#card" />
            ))}
          </Shelf>
        </div>
      </Section>

      <Section
        id="receipt"
        title="Receipt"
        intro="A bundle from the profile picker. Adding a skill slides the new line on."
      >
        <ReceiptDemo date="23 Oct 2026" />
      </Section>
    </div>
  );
}
