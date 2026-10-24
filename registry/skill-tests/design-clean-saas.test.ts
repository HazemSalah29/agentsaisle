import { spawnSync } from "node:child_process";
import { cpSync, existsSync, readFileSync, readdirSync } from "node:fs";
import { mkdir, mkdtemp, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import {
  submitContact,
  subscribeNewsletter,
} from "../official/design-clean-saas/assets/kit/actions";
import {
  initialFormState,
  validateContact,
  validateEmail,
} from "../official/design-clean-saas/assets/kit/validate";
import { loadScript, skillFile } from "./load";

const SKILL = "design-clean-saas";

interface Finding {
  file: string;
  line: number;
  rule: string;
  hint: string;
}
interface Lint {
  lintFile(rel: string, text: string): Finding[];
  format(findings: Finding[], checked: number): string;
}
interface Install {
  upsertBlock(text: string, block?: string): string;
  tokensImport(css: string, cwd?: string): string;
  addTokensImport(css: string, line: string): string | null;
  copyKit(
    from: string,
    to: string,
    o?: { force?: boolean; dryRun?: boolean },
  ): Array<{ rel: string; status: string }>;
  PERF_BUDGET_KB: number;
}

let lint: Lint;
let install: Install;
beforeAll(async () => {
  lint = await loadScript<Lint>(SKILL, "scripts/design-lint.mjs");
  install = await loadScript<Install>(SKILL, "scripts/install-kit.mjs");
});

const rules = (rel: string, text: string) => lint.lintFile(rel, text).map((f) => f.rule);
const WITH_KIT = `import { Section } from "@/components/kit";\n`;
const page = (code: string) => rules("src/app/a.tsx", WITH_KIT + code);

describe("design-lint: shared rules", () => {
  it("flags raw colors and default Tailwind palette colors, but not tokens or anchors", () => {
    expect(page('const c = "#fff";')).toContain("raw-color");
    expect(page("color: rgb(1, 2, 3);")).toContain("raw-color");
    expect(page('<p className="text-gray-500" />')).toContain("raw-color");
    expect(page('<p className="bg-blue-600 hover:bg-blue-700" />')).toContain("raw-color");
    expect(page('<p className="text-muted bg-brand-700 border-border" />')).toEqual([]);
    expect(page('<a href="#add">x</a>')).toEqual([]);
  });

  it("flags arbitrary values and inline styles", () => {
    expect(page('<div className="w-[437px]" />')).toContain("arbitrary-value");
    expect(page('<div className="data-[open]:flex w-[var(--x)]" />')).toEqual([]);
    expect(page("<div style={{ top: 1 }} />")).toContain("inline-style");
  });

  it("allows the one sans, flags a second family", () => {
    expect(page('<p className="font-sans font-semibold" />')).toEqual([]);
    expect(page('<p className="font-serif" />')).toContain("font");
    expect(page('<p className="font-mono" />')).toContain("font");
  });

  it("flags section-level markup and pages that skip the kit", () => {
    expect(rules("src/app/x.tsx", "export const X = () => <section>hi</section>;")).toContain(
      "no-kit",
    );
    expect(rules("src/app/work/page.tsx", "export default () => <main>x</main>;")).toContain(
      "no-kit",
    );
  });

  it("honours design-lint-ignore and skips comments", () => {
    expect(page('const c = "#ff0000"; // design-lint-ignore')).toEqual([]);
    expect(page("// color: #ff0000")).toEqual([]);
  });
});

describe("design-lint: minimal rules", () => {
  it.each([
    ['<div className="bg-gradient-to-r from-brand-50 to-brand-200" />', "gradient"],
    ['<div className="bg-linear-to-b" />', "gradient"],
    ["background: linear-gradient(red, blue);", "gradient"],
    ['<header className="backdrop-blur-md" />', "glass"],
    ["a { backdrop-filter: blur(8px); }", "glass"],
    ['<div className="blur-3xl rounded-full" />', "blob"],
    ["a { filter: blur(40px); }", "blob"],
    ['import { FaHome } from "react-icons/fa";', "icons"],
    ['import { HomeIcon } from "@heroicons/react/24/outline";', "icons"],
    ['<div className="shadow-lg" />', "shadow"],
    ['<div className="shadow-md" />', "shadow"],
    ['<div className="rounded-xl" />', "radius"],
    ['<div className="rounded-t-md" />', "radius"],
    ['import { motion } from "framer-motion";', "motion-lib"],
    ['import Lenis from "lenis";', "motion-lib"],
    ['import { gsap } from "gsap";', "motion-lib"],
    ['<div className="animate-bounce" />', "motion"],
    ['<div className="duration-300 ease-in-out" />', "motion"],
    ["transition={{ duration: 0.4 }}", "motion"],
    ["a { transition: color 200ms; }", "motion"],
  ])("flags %s as %s", (code, rule) => {
    expect(page(code)).toContain(rule);
  });

  it("allows what the kit allows", () => {
    const ok = [
      'import { Clock } from "lucide-react";',
      '<div className="shadow-soft rounded-2xl rounded-lg rounded-full border border-border" />',
      '<a className="transition-colors duration-(--duration-hover) ease-standard" />',
      '<div className="bg-subtle text-ink" />',
    ].join("\n");
    expect(page(ok)).toEqual([]);
  });

  it("gives a fix hint with each finding", () => {
    const [f] = lint.lintFile("src/app/a.tsx", WITH_KIT + '<div className="shadow-xl" />');
    expect(f).toMatchObject({ rule: "shadow", line: 2 });
    expect(f!.hint).toMatch(/shadow-soft/);
  });

  it("limits output to 40 lines", () => {
    const many = Array.from({ length: 90 }, (_, i) => ({
      file: "src/a.tsx",
      line: i + 1,
      rule: "gradient",
      hint: "x",
    }));
    const out = lint.format(many, 3).split("\n");
    expect(out.length).toBeLessThanOrEqual(40);
    expect(out.at(-1)).toMatch(/and \d+ more/);
  });

  it("exits 1 on a bad project and 0 on a clean one", async () => {
    const run = (dir: string) =>
      spawnSync(process.execPath, [skillFile(SKILL, "scripts/design-lint.mjs"), "--cwd", dir], {
        encoding: "utf8",
      });
    const bad = await mkdtemp(path.join(os.tmpdir(), "dcs-bad-"));
    await mkdir(path.join(bad, "src/app"), { recursive: true });
    await writeFile(
      path.join(bad, "src/app/page.tsx"),
      `${WITH_KIT}export default () => <Section className="bg-gradient-to-r shadow-lg" />;\n`,
    );
    const r = run(bad);
    expect(r.status).toBe(1);
    expect(r.stdout).toMatch(/page\.tsx:2\s+gradient/);

    const good = await mkdtemp(path.join(os.tmpdir(), "dcs-good-"));
    await mkdir(path.join(good, "src/app"), { recursive: true });
    await writeFile(
      path.join(good, "src/app/page.tsx"),
      `import { Section, Hero } from "@/components/kit";
export default () => (
  <main>
    <Hero headline="x" subtext="y" primaryCta={{ label: "Go", href: "#go" }} />
    <Section tone="subtle" className="shadow-soft">x</Section>
  </main>
);
`,
    );
    const g = run(good);
    expect(g.stdout).toMatch(/no problems/);
    expect(g.status).toBe(0);
  });

  it("the kit's own source follows the minimal rules", () => {
    const dir = skillFile(SKILL, "assets/kit");
    const strict = new Set([
      "gradient",
      "glass",
      "blob",
      "icons",
      "shadow",
      "radius",
      "motion-lib",
      "motion",
    ]);
    for (const f of readdirSync(dir).filter((x) => x.endsWith(".tsx") || x.endsWith(".ts"))) {
      const found = lint
        .lintFile(`kit/${f}`, readFileSync(path.join(dir, f), "utf8"))
        .filter((x) => strict.has(x.rule) || (x.rule === "raw-color" && /palette/.test(x.hint)));
      expect(found, `${f}: ${JSON.stringify(found)}`).toEqual([]);
    }
  });
});

describe("install-kit", () => {
  const kit = skillFile(SKILL, "assets/kit");

  it("upserts one pointer block, keeping text around it", () => {
    const once = install.upsertBlock("# Notes\n");
    expect(install.upsertBlock(once)).toBe(once);
    expect(once.match(/design-clean-saas:start/g)).toHaveLength(1);
    expect(once).toContain("DESIGN.md");
    expect(once).toContain("lucide-react");
  });

  it("adds the tokens import after the tailwind import, once", () => {
    const line = install.tokensImport("src/app/globals.css");
    expect(line).toBe('@import "../components/kit/tokens.css";');
    const next = install.addTokensImport('@import "tailwindcss";\n\nbody {}\n', line)!;
    expect(next).toBe(`@import "tailwindcss";\n${line}\n\nbody {}\n`);
    expect(install.addTokensImport(next, line)).toBe(next);
    expect(install.addTokensImport("body {}", line)).toBeNull();
  });

  it("copies every kit file, keeps edited files, and overwrites them with force", async () => {
    const to = path.join(await mkdtemp(path.join(os.tmpdir(), "dcs-kit-")), "kit");
    expect(install.copyKit(kit, to).every((r) => r.status === "written")).toBe(true);
    for (const f of ["tokens.css", "Hero.tsx", "PricingTable.tsx", "actions.ts", "validate.ts"])
      expect(existsSync(path.join(to, f)), f).toBe(true);
    expect(install.copyKit(kit, to).every((r) => r.status === "unchanged")).toBe(true);
    await writeFile(path.join(to, "FAQ.tsx"), "// my edit");
    expect(install.copyKit(kit, to).find((r) => r.rel === "FAQ.tsx")?.status).toBe("kept");
    expect(readFileSync(path.join(to, "FAQ.tsx"), "utf8")).toBe("// my edit");
    expect(install.copyKit(kit, to, { force: true }).find((r) => r.rel === "FAQ.tsx")?.status).toBe(
      "written",
    );
  });

  it("sets up a fresh project end to end, and a second run changes nothing", async () => {
    const proj = await mkdtemp(path.join(os.tmpdir(), "dcs-proj-"));
    await mkdir(path.join(proj, "src/app"), { recursive: true });
    await writeFile(path.join(proj, "src/app/globals.css"), '@import "tailwindcss";\n');
    await writeFile(
      path.join(proj, "package.json"),
      JSON.stringify({ dependencies: { next: "16" } }),
    );
    const run = () =>
      spawnSync(process.execPath, [skillFile(SKILL, "scripts/install-kit.mjs"), "--cwd", proj], {
        encoding: "utf8",
      });
    const a = run();
    expect(a.stdout).toContain("install these packages: lucide-react");
    expect(a.stdout).not.toContain("motion");
    expect(readFileSync(path.join(proj, "src/app/globals.css"), "utf8")).toContain("tokens.css");
    expect(existsSync(path.join(proj, "DESIGN.md"))).toBe(true);
    expect(JSON.parse(readFileSync(path.join(proj, "perf.config.json"), "utf8"))).toEqual({
      budgetKb: install.PERF_BUDGET_KB,
    });
    const css = readFileSync(path.join(proj, "src/app/globals.css"), "utf8");
    const claude = readFileSync(path.join(proj, "CLAUDE.md"), "utf8");
    const b = run();
    expect(b.stdout).toContain("written 0");
    expect(readFileSync(path.join(proj, "src/app/globals.css"), "utf8")).toBe(css);
    expect(readFileSync(path.join(proj, "CLAUDE.md"), "utf8")).toBe(claude);
  });

  it("does not install lucide-react when the project already has it", async () => {
    const proj = await mkdtemp(path.join(os.tmpdir(), "dcs-has-"));
    await writeFile(
      path.join(proj, "package.json"),
      JSON.stringify({ dependencies: { "lucide-react": "1.0.0" } }),
    );
    const r = spawnSync(
      process.execPath,
      [skillFile(SKILL, "scripts/install-kit.mjs"), "--cwd", proj],
      {
        encoding: "utf8",
      },
    );
    expect(r.stdout).not.toContain("install these packages");
  });
});

describe("form validation and the stub actions", () => {
  it("validates an email address", () => {
    expect(validateEmail("")).toMatch(/Enter your email/);
    expect(validateEmail("nope")).toMatch(/valid email/);
    expect(validateEmail("a@b")).toMatch(/valid email/);
    expect(validateEmail(" name@company.com ")).toBeUndefined();
  });

  it("validates the contact form field by field", () => {
    expect(validateContact({ name: "", email: "x", message: "hi" })).toEqual({
      ok: false,
      errors: {
        name: "Enter your name.",
        email: "Enter a valid email address, like name@company.com.",
        message: "Write at least a sentence (10 characters).",
      },
    });
    expect(
      validateContact({ name: "Ada", email: "ada@x.io", message: "I would like a demo please." }),
    ).toEqual({ ok: true, errors: {} });
  });

  const form = (o: Record<string, string>) => {
    const f = new FormData();
    for (const [k, v] of Object.entries(o)) f.set(k, v);
    return f;
  };

  it("submitContact returns field errors, then success", async () => {
    const bad = await submitContact(initialFormState, form({ name: "", email: "x", message: "" }));
    expect(bad.status).toBe("error");
    expect(Object.keys(bad.errors).sort()).toEqual(["email", "message", "name"]);
    const ok = await submitContact(
      initialFormState,
      form({ name: "Ada", email: "ada@x.io", message: "Tell me about pricing." }),
    );
    expect(ok.status).toBe("success");
    expect(ok.message).toMatch(/reply/);
  });

  it("subscribeNewsletter validates the address", async () => {
    expect(
      (await subscribeNewsletter(initialFormState, form({ email: "no" }))).errors.email,
    ).toBeTruthy();
    expect((await subscribeNewsletter(initialFormState, form({ email: "a@b.co" }))).status).toBe(
      "success",
    );
  });

  it("actions.ts exports only async functions, as a use-server file must", () => {
    const body = readFileSync(skillFile(SKILL, "assets/kit/actions.ts"), "utf8");
    expect(body.startsWith('"use server"')).toBe(true);
    expect(body).not.toMatch(/export (const|let|var) /);
  });
});

describe("scripts and kit files", () => {
  const scripts = ["design-lint", "install-kit", "screenshot"];

  it.each(scripts)("%s still runs when started through a symlinked path", async (name) => {
    const real = await mkdtemp(path.join(os.tmpdir(), "dcs-link-real-"));
    await mkdir(path.join(real, "scripts"), { recursive: true });
    cpSync(skillFile(SKILL, `scripts/${name}.mjs`), path.join(real, "scripts", `${name}.mjs`));
    cpSync(skillFile(SKILL, "assets"), path.join(real, "assets"), { recursive: true });
    const link = path.join(await mkdtemp(path.join(os.tmpdir(), "dcs-link-")), "linked");
    await symlink(real, link);
    const proj = await mkdtemp(path.join(os.tmpdir(), "dcs-link-proj-"));
    const r = spawnSync(
      process.execPath,
      [path.join(link, "scripts", `${name}.mjs`), "--url", "http://127.0.0.1:9"],
      { cwd: proj, encoding: "utf8" },
    );
    expect(r.stdout.trim().length, `${name} printed nothing: ${r.stderr}`).toBeGreaterThan(0);
  });

  it("never fetches remote code or uses the network", () => {
    for (const name of scripts) {
      const body = readFileSync(skillFile(SKILL, `scripts/${name}.mjs`), "utf8");
      expect(body).not.toMatch(/\bfetch\s*\(|https?\.get|XMLHttpRequest/);
    }
  });

  it("DESIGN.md names every kit component", () => {
    const design = readFileSync(skillFile(SKILL, "assets/DESIGN.md"), "utf8");
    const index = readFileSync(skillFile(SKILL, "assets/kit/index.ts"), "utf8");
    const components = [...index.matchAll(/export \{ ([A-Z]\w+)/g)].map((m) => m[1]!);
    expect(components.length).toBe(17 + 1); // the 14 components and 3 layout primitives in the brief, plus FadeUp
    for (const name of components) expect(design, `${name} missing from DESIGN.md`).toContain(name);
  });

  it("has all the components the brief lists", () => {
    const index = readFileSync(skillFile(SKILL, "assets/kit/index.ts"), "utf8");
    for (const name of [
      "Navbar",
      "Hero",
      "LogoCloud",
      "StatsBar",
      "FeatureGrid",
      "FeatureSplit",
      "ServiceCards",
      "Testimonials",
      "Team",
      "PricingTable",
      "FAQ",
      "ContactForm",
      "Newsletter",
      "Footer",
      "Section",
      "Container",
      "Grid",
    ])
      expect(index, name).toMatch(new RegExp(`export \\{\\s*${name}\\b`));
  });

  it("every kit component file starts with use client only when it needs state", () => {
    const dir = skillFile(SKILL, "assets/kit");
    const client = ["Navbar", "FadeUp", "PricingTable", "FAQ", "ContactForm", "Newsletter"];
    for (const f of readdirSync(dir).filter((x) => x.endsWith(".tsx"))) {
      const isClient = readFileSync(path.join(dir, f), "utf8").startsWith('"use client"');
      expect(isClient, f).toBe(client.includes(f.replace(".tsx", "")));
    }
  });
});
