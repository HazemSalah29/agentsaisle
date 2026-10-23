import { spawnSync } from "node:child_process";
import { cpSync, existsSync, readFileSync } from "node:fs";
import { mkdir, mkdtemp, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { loadScript, skillFile } from "./load";

const SKILL = "design-motion-portfolio";

interface Finding {
  file: string;
  line: number;
  rule: string;
  hint: string;
}
interface Lint {
  lintFile(rel: string, text: string): Finding[];
  format(findings: Finding[], checked: number): string;
  listSources(cwd: string): string[];
  MAX_LINES: number;
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
  CLAUDE_BLOCK: string;
}
interface Shot {
  routesFromPages(files: string[]): string[];
  shotName(route: string, viewport: string): string;
  parseArgs(argv: string[]): {
    url: string;
    out: string;
    routes: string[] | null;
    reduced: boolean;
  };
}

let lint: Lint;
let install: Install;
let shot: Shot;
beforeAll(async () => {
  lint = await loadScript<Lint>(SKILL, "scripts/design-lint.mjs");
  install = await loadScript<Install>(SKILL, "scripts/install-kit.mjs");
  shot = await loadScript<Shot>(SKILL, "scripts/screenshot.mjs");
});

const rules = (rel: string, text: string) => lint.lintFile(rel, text).map((f) => f.rule);
const WITH_KIT = `import { Section } from "@/components/kit";\n`;

describe("design-lint", () => {
  it.each([
    ['<p className="text-[#123456]">x</p>', "raw-color"],
    ['const c = "#fff";', "raw-color"],
    ["color: rgb(10, 20, 30);", "raw-color"],
    ["background: hsla(0 0% 0% / .5);", "raw-color"],
  ])("flags a raw color: %s", (code, rule) => {
    expect(rules("src/app/a.tsx", WITH_KIT + code)).toContain(rule);
  });

  it("does not mistake an anchor link for a color", () => {
    expect(rules("src/app/a.tsx", WITH_KIT + '<a href="#add">x</a>')).not.toContain("raw-color");
    expect(rules("src/app/a.tsx", WITH_KIT + '<a href="#">x</a>')).toEqual([]);
  });

  it("flags arbitrary Tailwind values but allows data/aria variants and var()", () => {
    expect(rules("src/a.tsx", WITH_KIT + '<div className="w-[437px]" />')).toContain(
      "arbitrary-value",
    );
    expect(rules("src/a.tsx", WITH_KIT + '<div className="mt-[3rem]" />')).toContain(
      "arbitrary-value",
    );
    expect(rules("src/a.tsx", WITH_KIT + '<div className="data-[open]:flex" />')).toEqual([]);
    expect(rules("src/a.tsx", WITH_KIT + '<div className="w-[var(--x)]" />')).toEqual([]);
  });

  it("flags inline styles", () => {
    expect(rules("src/a.tsx", WITH_KIT + "<div style={{ top: 1 }} />")).toContain("inline-style");
    expect(rules("src/a.tsx", WITH_KIT + '<div style="top:1px" />')).toContain("inline-style");
  });

  it("flags fonts that are not from tokens", () => {
    expect(rules("src/a.tsx", WITH_KIT + '<p className="font-serif" />')).toContain("font");
    expect(rules("src/a.css", "p { font-family: Georgia, serif; }")).toContain("font");
    expect(rules("src/a.css", "p { font-family: var(--font-display); }")).toEqual([]);
    expect(rules("src/a.tsx", WITH_KIT + '<p className="font-display" />')).toEqual([]);
  });

  it.each([
    '<div className="duration-300" />',
    '<div className="ease-in-out" />',
    "transition={{ duration: 0.3 }}",
    'transition={{ ease: "easeOut" }}',
    "a { transition: opacity 300ms; }",
    "a { animation: spin 2s linear; }",
  ])("flags a motion value that is not a token: %s", (code) => {
    expect(rules("src/a.tsx", WITH_KIT + code)).toContain("motion");
  });

  it("allows motion taken from tokens", () => {
    const ok = [
      '<div className="duration-(--duration-slow) ease-out-expo" />',
      "transition={{ duration: duration.base, ease: ease.outExpo }}",
      "a { transition: opacity var(--duration-base); }",
    ].join("\n");
    expect(rules("src/a.tsx", WITH_KIT + ok)).toEqual([]);
  });

  it("flags section-level markup in a file that does not import the kit", () => {
    expect(rules("src/app/x.tsx", "export const X = () => <section>hi</section>;")).toContain(
      "no-kit",
    );
    expect(
      rules("src/app/x.tsx", WITH_KIT + "export const X = () => <section>hi</section>;"),
    ).toEqual([]);
  });

  it("flags a page that imports nothing from the kit", () => {
    expect(rules("src/app/work/page.tsx", "export default () => <main>x</main>;")).toContain(
      "no-kit",
    );
    expect(
      rules("src/app/work/page.tsx", WITH_KIT + "export default () => <main>x</main>;"),
    ).toEqual([]);
  });

  it("skips comments and honours design-lint-ignore on the line or the one above", () => {
    expect(rules("src/a.tsx", WITH_KIT + "// color: #ff0000")).toEqual([]);
    expect(rules("src/a.tsx", WITH_KIT + 'const c = "#ff0000"; // design-lint-ignore')).toEqual([]);
    expect(rules("src/a.tsx", WITH_KIT + '// design-lint-ignore\nconst c = "#ff0000";')).toEqual(
      [],
    );
  });

  it("reports file, line, rule and a fix hint", () => {
    const [f] = lint.lintFile("src/app/a.tsx", WITH_KIT + '\n<div className="w-[10px]" />');
    expect(f).toMatchObject({ file: "src/app/a.tsx", line: 3, rule: "arbitrary-value" });
    expect(f!.hint).toMatch(/scale/);
  });

  it("limits its output to 40 lines and says how many were left out", () => {
    const many = Array.from({ length: 80 }, (_, i) => ({
      file: "src/a.tsx",
      line: i + 1,
      rule: "raw-color",
      hint: "x",
    }));
    const out = lint.format(many, 3).split("\n");
    expect(out.length).toBeLessThanOrEqual(lint.MAX_LINES);
    expect(out.at(-1)).toMatch(/and \d+ more/);
    expect(lint.format([], 4)).toBe("design-lint: 4 files checked, no problems.");
  });

  it("checks src but never the kit folder", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "dmp-lint-"));
    for (const f of ["src/app/page.tsx", "src/components/kit/Hero.tsx", "src/lib/a.ts"]) {
      await mkdir(path.dirname(path.join(dir, f)), { recursive: true });
      await writeFile(path.join(dir, f), "x");
    }
    const found = lint.listSources(dir).map((f) => path.relative(dir, f).split(path.sep).join("/"));
    expect(found.sort()).toEqual(["src/app/page.tsx", "src/lib/a.ts"]);
  });

  it("passes on the demo site, which is built only from the kit", () => {
    const r = spawnSync(
      process.execPath,
      [
        skillFile(SKILL, "scripts/design-lint.mjs"),
        "--cwd",
        path.resolve(__dirname, "../../demos/motion-portfolio"),
      ],
      { encoding: "utf8" },
    );
    expect(r.stdout).toMatch(/no problems/);
    expect(r.status).toBe(0);
  });

  it("exits 1 and names the problem for a bad project", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "dmp-bad-"));
    await mkdir(path.join(dir, "src/app"), { recursive: true });
    await writeFile(
      path.join(dir, "src/app/page.tsx"),
      `${WITH_KIT}<p className="w-[9px] text-[#abc]" />`,
    );
    const r = spawnSync(
      process.execPath,
      [skillFile(SKILL, "scripts/design-lint.mjs"), "--cwd", dir],
      {
        encoding: "utf8",
      },
    );
    expect(r.status).toBe(1);
    expect(r.stdout).toContain("src/app/page.tsx:2");
  });
});

describe("install-kit", () => {
  const kit = skillFile(SKILL, "assets/kit");

  it("upserts one pointer block, however many times it runs", () => {
    const once = install.upsertBlock("# Notes\n");
    expect(install.upsertBlock(once)).toBe(once);
    expect(once.match(/design-motion-portfolio:start/g)).toHaveLength(1);
    expect(once.startsWith("# Notes\n")).toBe(true);
    expect(install.upsertBlock("")).toContain("DESIGN.md");
  });

  it("replaces an outdated block in place and keeps text around it", () => {
    const old = `before\n<!-- design-motion-portfolio:start -->\nold\n<!-- design-motion-portfolio:end -->\nafter\n`;
    const next = install.upsertBlock(old);
    expect(next).not.toContain("old");
    expect(next.startsWith("before\n")).toBe(true);
    expect(next.endsWith("after\n")).toBe(true);
  });

  it("builds a relative tokens import for the stylesheet", () => {
    expect(install.tokensImport("src/app/globals.css")).toBe(
      '@import "../components/kit/tokens.css";',
    );
    expect(install.tokensImport("app/globals.css")).toBe(
      '@import "../src/components/kit/tokens.css";',
    );
  });

  it("adds the import after the tailwind import, once", () => {
    const line = '@import "../components/kit/tokens.css";';
    const css = '@import "tailwindcss";\n\nbody { margin: 0; }\n';
    const next = install.addTokensImport(css, line)!;
    expect(next).toBe(`@import "tailwindcss";\n${line}\n\nbody { margin: 0; }\n`);
    expect(install.addTokensImport(next, line)).toBe(next);
    expect(install.addTokensImport("body {}", line)).toBeNull();
  });

  it("copies every kit file, keeps edited files, and overwrites them with force", async () => {
    const to = path.join(await mkdtemp(path.join(os.tmpdir(), "dmp-kit-")), "kit");
    const first = install.copyKit(kit, to);
    expect(first.every((r) => r.status === "written")).toBe(true);
    expect(existsSync(path.join(to, "tokens.css"))).toBe(true);
    expect(existsSync(path.join(to, "HeroKinetic.tsx"))).toBe(true);

    expect(install.copyKit(kit, to).every((r) => r.status === "unchanged")).toBe(true);

    await writeFile(path.join(to, "Marquee.tsx"), "// my edit");
    const second = install.copyKit(kit, to);
    expect(second.find((r) => r.rel === "Marquee.tsx")?.status).toBe("kept");
    expect(readFileSync(path.join(to, "Marquee.tsx"), "utf8")).toBe("// my edit");

    const forced = install.copyKit(kit, to, { force: true });
    expect(forced.find((r) => r.rel === "Marquee.tsx")?.status).toBe("written");
  });

  it("writes nothing on a dry run", async () => {
    const to = path.join(await mkdtemp(path.join(os.tmpdir(), "dmp-dry-")), "kit");
    const r = install.copyKit(kit, to, { dryRun: true });
    expect(r.every((x) => x.status === "would write")).toBe(true);
    expect(existsSync(to)).toBe(false);
  });

  it("sets up a fresh project end to end, and a second run changes nothing", async () => {
    const proj = await mkdtemp(path.join(os.tmpdir(), "dmp-proj-"));
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
    expect(a.stdout).toContain("install_kit".replace("_", "-"));
    expect(a.stdout).toContain("install these packages: motion lenis");
    expect(readFileSync(path.join(proj, "src/app/globals.css"), "utf8")).toContain(
      '@import "../components/kit/tokens.css";',
    );
    expect(existsSync(path.join(proj, "DESIGN.md"))).toBe(true);
    expect(readFileSync(path.join(proj, "CLAUDE.md"), "utf8")).toContain("DESIGN.md");

    const css = readFileSync(path.join(proj, "src/app/globals.css"), "utf8");
    const claude = readFileSync(path.join(proj, "CLAUDE.md"), "utf8");
    const b = run();
    expect(b.stdout).toContain("written 0");
    expect(JSON.parse(readFileSync(path.join(proj, "perf.config.json"), "utf8"))).toEqual({
      budgetKb: 220,
    });
    expect(readFileSync(path.join(proj, "src/app/globals.css"), "utf8")).toBe(css);
    expect(readFileSync(path.join(proj, "CLAUDE.md"), "utf8")).toBe(claude);
  });

  it("tells you where to put the import when it cannot find a stylesheet", async () => {
    const proj = await mkdtemp(path.join(os.tmpdir(), "dmp-nocss-"));
    const r = spawnSync(
      process.execPath,
      [skillFile(SKILL, "scripts/install-kit.mjs"), "--cwd", proj],
      {
        encoding: "utf8",
      },
    );
    expect(r.stdout).toMatch(/no global stylesheet found/);
  });
});

describe("screenshot", () => {
  it("lists static routes from page files and skips dynamic ones", () => {
    expect(
      shot.routesFromPages([
        "src/app/page.tsx",
        "src/app/work/page.tsx",
        "src/app/work/[slug]/page.tsx",
        "src/app/(marketing)/about/page.tsx",
        "app/blog/page.mdx",
      ]),
    ).toEqual(["/", "/about", "/blog", "/work"]);
  });

  it("names files by route and viewport", () => {
    expect(shot.shotName("/", "1440")).toBe("home-1440.png");
    expect(shot.shotName("/work/harbour-bank", "390")).toBe("work-harbour-bank-390.png");
  });

  it("parses arguments with defaults", () => {
    expect(shot.parseArgs([])).toMatchObject({
      url: "http://localhost:3000",
      out: ".agent-aisle/screens",
      routes: null,
      reduced: false,
    });
    expect(
      shot.parseArgs(["--url", "http://x:1/", "--routes", "/a,/b", "--reduced-motion"]),
    ).toMatchObject({ url: "http://x:1", routes: ["/a", "/b"], reduced: true });
  });
});

describe("scripts and kit files", () => {
  const scripts = ["design-lint", "install-kit", "screenshot"];

  // Regression: a script reached through a symlinked folder must still run.
  it.each(scripts)("%s still runs when started through a symlinked path", async (name) => {
    const real = await mkdtemp(path.join(os.tmpdir(), "dmp-link-real-"));
    await mkdir(path.join(real, "scripts"), { recursive: true });
    cpSync(skillFile(SKILL, `scripts/${name}.mjs`), path.join(real, "scripts", `${name}.mjs`));
    cpSync(skillFile(SKILL, "assets"), path.join(real, "assets"), { recursive: true });
    const link = path.join(await mkdtemp(path.join(os.tmpdir(), "dmp-link-")), "linked");
    await symlink(real, link);
    const proj = await mkdtemp(path.join(os.tmpdir(), "dmp-link-proj-"));
    const r = spawnSync(
      process.execPath,
      [path.join(link, "scripts", `${name}.mjs`), "--url", "http://127.0.0.1:9"],
      {
        cwd: proj,
        encoding: "utf8",
      },
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
    const exported = [...index.matchAll(/export \{ ([A-Z]\w+)/g)].map((m) => m[1]!);
    expect(exported.length).toBeGreaterThanOrEqual(15);
    for (const name of exported) expect(design, `${name} missing from DESIGN.md`).toContain(name);
  });

  it("the skill's own tokens use no raw colors in kit components", () => {
    for (const f of ["HeroKinetic", "RevealText", "NavOverlay", "WorkGallery", "ServiceList"]) {
      const body = readFileSync(skillFile(SKILL, `assets/kit/${f}.tsx`), "utf8");
      expect(body, f).not.toMatch(/#[0-9a-f]{6}\b/i);
    }
  });
});
