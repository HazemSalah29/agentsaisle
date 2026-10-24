import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadScript, skillFile } from "./load";

interface Change {
  line: number;
  from: string;
  to: string;
}
interface Codemod {
  transform(src: string): {
    text: string;
    changes: Change[];
    manual: Array<{ from: string; rule: string }>;
  };
  run(
    root: string,
    o?: { write?: boolean },
  ): { refused?: string; files: Array<{ file: string; changes: Change[]; manual: unknown[] }> };
}
interface Finding {
  file: string;
  line: number;
  rule: string;
  severity: string;
}
interface Scan {
  scan(root: string): Finding[];
  scanText(
    src: string,
    ext: string,
    o?: { tracking?: boolean; spaceXLogical?: boolean },
  ): Array<{ line: number; rule: string; severity: string }>;
}
interface Cand {
  findCandidates(
    src: string,
    rel: string,
  ): Array<{ line: number; text: string; key: string; element: string }>;
  pageName(rel: string): string;
}
interface Tc {
  parseIcu(m: string): {
    args: Set<string>;
    tags: Set<string>;
    plurals: Array<{ selectors: string[] }>;
    error?: string;
  };
  compare(
    en: Record<string, string>,
    ar: Record<string, string>,
    g?: unknown,
  ): Array<{ severity: string; rule: string; key: string; message: string }>;
  flatten(o: unknown): Record<string, string>;
  parseGlossary(t: string): { brands: string[]; terms: Array<{ en: string; ar: string }> };
  missingArabicCategories(s: string[]): string[];
}
interface Shot {
  buildUrl(p: string, b: string, l: string, r: string): string;
  planShots(o: {
    routes: string[];
    locales: string[];
    base: string;
    pattern: string;
    outDir: string;
  }): Array<{ url: string; file: string; width: number }>;
  slug(r: string): string;
}

const S = "arabic-rtl";
const codemod = () => loadScript<Codemod>(S, "scripts/rtl-codemod.mjs");
const fixture = skillFile(S, "evals/fixture-app");

describe("rtl-codemod: variant matrix", () => {
  const cases: Array<[string, string]> = [
    ["ml-4", "ms-4"],
    ["mr-2", "me-2"],
    ["pl-6", "ps-6"],
    ["pr-0", "pe-0"],
    ["left-0", "start-0"],
    ["right-1/2", "end-1/2"],
    ["left-[10px]", "start-[10px]"],
    ["ml-auto", "ms-auto"],
    ["text-left", "text-start"],
    ["text-right", "text-end"],
    ["rounded-l", "rounded-s"],
    ["rounded-l-lg", "rounded-s-lg"],
    ["rounded-r-full", "rounded-e-full"],
    ["rounded-tl-xl", "rounded-ss-xl"],
    ["rounded-tr-md", "rounded-se-md"],
    ["rounded-bl-md", "rounded-es-md"],
    ["rounded-br-none", "rounded-ee-none"],
    ["border-l", "border-s"],
    ["border-r-2", "border-e-2"],
    ["border-l-red-500", "border-s-red-500"],
    ["scroll-ml-4", "scroll-ms-4"],
    ["scroll-pr-4", "scroll-pe-4"],
    ["float-left", "float-start"],
    ["clear-right", "clear-end"],
    ["md:ml-4", "md:ms-4"],
    ["hover:pr-2", "hover:pe-2"],
    ["md:hover:pl-2", "md:hover:ps-2"],
    ["-ml-2", "-ms-2"],
    ["md:-mr-2", "md:-me-2"],
    ["!ml-2", "!ms-2"],
    ["ml-2!", "ms-2!"],
    ["lg:!pr-4", "lg:!pe-4"],
    ["data-[open]:ml-4", "data-[open]:ms-4"],
  ];
  it.each(cases)("%s -> %s", async (from, to) => {
    const { transform } = await codemod();
    expect(transform(`const c = "flex ${from} p-1";`).text).toBe(`const c = "flex ${to} p-1";`);
  });

  it.each([
    "ms-4",
    "text-start",
    "rtl:ml-2",
    "ltr:pr-2",
    "mt-4",
    "mx-2",
    "left",
    "ml-",
    "ml-foo",
    "pl-bar",
  ])("leaves %s alone", async (cls) => {
    const { transform } = await codemod();
    const src = `const c = "${cls} a";`;
    expect(transform(src).text).toBe(src);
  });

  it("rewrites inside clsx, cn, cva, twMerge and template literals", async () => {
    const { transform } = await codemod();
    const src = [
      `clsx("ml-2", open && "pr-4", { "pl-1": a });`,
      "cn(`ml-2 ${x ? 'pr-2' : \"pl-2\"} text-left`);",
      `const v = cva("mr-1", { variants: { size: { sm: "pl-2 pr-2" } } });`,
      `twMerge("text-right", cond ? "left-0" : "right-0");`,
    ].join("\n");
    const out = transform(src).text;
    expect(out).toContain(`clsx("ms-2", open && "pe-4", { "ps-1": a })`);
    expect(out).toContain("cn(`ms-2 ${x ? 'pe-2' : \"ps-2\"} text-start`)");
    expect(out).toContain(`cva("me-1", { variants: { size: { sm: "ps-2 pe-2" } } })`);
    expect(out).toContain(`twMerge("text-end", cond ? "start-0" : "end-0")`);
  });

  it("does not touch tokens glued to an interpolation, comments or non-class prose", async () => {
    const { transform } = await codemod();
    const src = [
      "const a = `ml-${n} pr-${m}x ${p}pl-2 end`;",
      "// ml-4 in a comment",
      "/* pr-2 in a block comment */",
      `const note = "Turn left-hand side right now";`,
      `const id = marginLeft;`,
    ].join("\n");
    const out = transform(src);
    expect(out.text).toBe(src);
    expect(out.changes).toEqual([]);
  });

  it("lists unmappable classes for manual review without changing them", async () => {
    const { transform } = await codemod();
    const src = `x("space-x-4 bg-gradient-to-r bg-left origin-right -translate-x-1/2 ml-2");`;
    const r = transform(src);
    expect(r.text).toBe(
      `x("space-x-4 bg-gradient-to-r bg-left origin-right -translate-x-1/2 ms-2");`,
    );
    expect(r.manual.map((m) => m.rule).sort()).toEqual(
      [
        "background-position",
        "gradient-direction",
        "space-x",
        "transform-origin",
        "translate-x",
      ].sort(),
    );
  });

  it("does not report space-x that already has rtl:space-x-reverse", async () => {
    const { transform } = await codemod();
    expect(transform(`x("space-x-4 rtl:space-x-reverse");`).manual).toEqual([]);
  });

  it("keeps left/right next to translate-x (centering) for manual review", async () => {
    const { transform } = await codemod();
    const src = `x("absolute left-1/2 -translate-x-1/2");`;
    const r = transform(src);
    expect(r.text).toBe(src);
    expect(r.manual.map((m) => m.rule)).toContain("inset-with-translate");
  });

  it("is idempotent: a second pass changes nothing", async () => {
    const { transform } = await codemod();
    const src = [
      `clsx("md:-ml-2 !pr-4 text-left rounded-tl-lg border-r-2", a && "hover:pl-1");`,
      "cn(`mr-2 ${v ? 'left-0' : ''}`);",
    ].join("\n");
    const once = transform(src);
    expect(once.changes.length).toBeGreaterThan(5);
    const twice = transform(once.text);
    expect(twice.text).toBe(once.text);
    expect(twice.changes).toEqual([]);
  });
});

describe("rtl-codemod: files", () => {
  it("is a dry run by default and writes only with write: true", async () => {
    const { run } = await codemod();
    const dir = await mkdtemp(path.join(os.tmpdir(), "rtl-cm-"));
    await cp(fixture, dir, { recursive: true });
    const before = await readFile(path.join(dir, "app/page.tsx"), "utf8");
    const dry = run(dir);
    expect(dry.files.length).toBeGreaterThan(0);
    expect(await readFile(path.join(dir, "app/page.tsx"), "utf8")).toBe(before);
    run(dir, { write: true });
    const after = await readFile(path.join(dir, "app/page.tsx"), "utf8");
    expect(after).toContain("flex-1 md:ms-64 ps-6 pe-4 text-start");
    const second = run(dir, { write: true });
    expect(second.files.every((f) => f.changes.length === 0)).toBe(true);
    expect(await readFile(path.join(dir, "app/page.tsx"), "utf8")).toBe(after);
  });

  it("skips node_modules, build output and other skills' kit folders", async () => {
    const { run } = await codemod();
    const dir = await mkdtemp(path.join(os.tmpdir(), "rtl-skip-"));
    const body = `export const c = "ml-4";\n`;
    for (const sub of ["node_modules/x", ".next/server", "dist", "src/components/kit"]) {
      await mkdir(path.join(dir, sub), { recursive: true });
      await writeFile(path.join(dir, sub, "a.tsx"), body);
    }
    await mkdir(path.join(dir, "src"), { recursive: true });
    await writeFile(path.join(dir, "src/real.tsx"), body);
    const r = run(dir, { write: true });
    expect(r.files.map((f) => f.file)).toEqual([path.join("src", "real.tsx")]);
    expect(await readFile(path.join(dir, "src/components/kit/a.tsx"), "utf8")).toBe(body);
  });

  it("refuses a Tailwind version without logical utilities", async () => {
    const { run } = await codemod();
    const dir = await mkdtemp(path.join(os.tmpdir(), "rtl-tw-"));
    await writeFile(
      path.join(dir, "package.json"),
      JSON.stringify({ devDependencies: { tailwindcss: "^3.2.7" } }),
    );
    await writeFile(path.join(dir, "a.tsx"), `export const c = "ml-4";\n`);
    const r = run(dir, { write: true });
    expect(r.refused).toMatch(/3\.3/);
    expect(await readFile(path.join(dir, "a.tsx"), "utf8")).toContain("ml-4");
  });

  it("does not follow symlinks", async () => {
    const { run } = await codemod();
    const dir = await mkdtemp(path.join(os.tmpdir(), "rtl-sym-"));
    const outside = await mkdtemp(path.join(os.tmpdir(), "rtl-out-"));
    await writeFile(path.join(outside, "a.tsx"), `export const c = "ml-4";\n`);
    await symlink(outside, path.join(dir, "link"));
    expect(run(dir, { write: true }).files).toEqual([]);
    expect(await readFile(path.join(outside, "a.tsx"), "utf8")).toContain("ml-4");
  });

  it("runs as a process through a symlinked folder (entry-point regression)", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "rtl-link-"));
    const link = path.join(dir, "skill");
    await symlink(skillFile(S, "scripts"), link);
    const r = spawnSync(process.execPath, [path.join(link, "rtl-codemod.mjs"), fixture], {
      encoding: "utf8",
    });
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/dry run/);
  });
});

describe("rtl-scan", () => {
  it("finds exactly the seeded problems in the fixture app", async () => {
    const { scan } = await loadScript<Scan>(S, "scripts/rtl-scan.mjs");
    const seeded: Array<{ file: string; line: number; rule: string }> = JSON.parse(
      await readFile(skillFile(S, "evals/seeded.json"), "utf8"),
    );
    const key = (f: { file: string; line: number; rule: string }) =>
      `${f.file.split(path.sep).join("/")}:${f.line}:${f.rule}`;
    const found = new Set(scan(fixture).map(key));
    const want = new Set(seeded.map(key));
    expect([...want].filter((k) => !found.has(k))).toEqual([]); // nothing missed
    expect([...found].filter((k) => !want.has(k))).toEqual([]); // nothing unexpected
  });

  it("covers every rule family", async () => {
    const seeded: Array<{ rule: string }> = JSON.parse(
      await readFile(skillFile(S, "evals/seeded.json"), "utf8"),
    );
    const rules = new Set(seeded.map((s) => s.rule));
    for (const r of [
      "physical-class",
      "physical-css",
      "translate-x",
      "gradient-direction",
      "dir-ltr",
      "directional-icon",
      "locale-format",
      "concat-text",
      "letter-spacing",
    ])
      expect(rules.has(r), r).toBe(true);
  });

  it("does not flag logical, direction-aware or ignored code", async () => {
    const { scanText } = await loadScript<Scan>(S, "scripts/rtl-scan.mjs");
    const ok = [
      `x("ms-4 pe-2 text-start start-0 rounded-s-lg");`,
      `x("space-x-4 rtl:space-x-reverse");`,
      `x("translate-x-2 transition-transform");`,
      `x("rtl:ml-2 ltr:mr-2");`,
      `<input type="email" dir="ltr" />`,
      `<DirectionalIcon directional><ChevronRight /></DirectionalIcon>`,
      `// rtl-scan-ignore\nconst a = "ml-4";`,
      `const s = n.toLocaleString("ar-EG-u-nu-latn");`,
      `const f = new Intl.NumberFormat(locale);`,
      `<p className={\`mt-2 \${x}\`}>{t("cart.items", { count })}</p>`,
    ].join("\n");
    expect(scanText(ok, ".tsx")).toEqual([]);
  });

  it("reports space-x on Tailwind 3 but not on Tailwind 4 (logical margins)", async () => {
    const { scanText } = await loadScript<Scan>(S, "scripts/rtl-scan.mjs");
    const src = `x("flex space-x-4");`;
    expect(scanText(src, ".tsx").map((f) => f.rule)).toEqual(["space-x"]);
    expect(scanText(src, ".tsx", { spaceXLogical: true })).toEqual([]);
    const dir = await mkdtemp(path.join(os.tmpdir(), "rtl-v3-"));
    await writeFile(
      path.join(dir, "package.json"),
      JSON.stringify({ devDependencies: { tailwindcss: "^3.4.0" } }),
    );
    await writeFile(path.join(dir, "a.tsx"), `export const c = "space-x-4";\n`);
    const { scan } = await loadScript<Scan>(S, "scripts/rtl-scan.mjs");
    expect(scan(dir).map((f) => f.rule)).toEqual(["space-x"]);
  });

  it("accepts a global :lang(ar) letter-spacing reset", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "rtl-track-"));
    await writeFile(path.join(dir, "a.tsx"), `export const c = "tracking-wide";\n`);
    await writeFile(path.join(dir, "g.css"), `:lang(ar) { letter-spacing: normal; }\n`);
    const { scan } = await loadScript<Scan>(S, "scripts/rtl-scan.mjs");
    expect(scan(dir)).toEqual([]);
  });

  it("caps output at 40 lines and exits 1 on errors", () => {
    const r = spawnSync(process.execPath, [skillFile(S, "scripts/rtl-scan.mjs"), fixture], {
      encoding: "utf8",
    });
    expect(r.status).toBe(1);
    expect(r.stdout.trimEnd().split("\n").length).toBeLessThanOrEqual(40);
    expect(r.stdout).toMatch(/more \(use --json/);
    expect(r.stdout).toMatch(/\d+ error\(s\), \d+ warning\(s\)/);
  });
});

describe("i18n-candidates", () => {
  it("lists JSX text and attribute strings with suggested keys", async () => {
    const { findCandidates } = await loadScript<Cand>(S, "scripts/i18n-candidates.mjs");
    const src = [
      `export function A() {`,
      `  return (`,
      `    <form>`,
      `      <h1>Welcome to the shop</h1>`,
      `      <input placeholder="Your name" aria-label="Full name" />`,
      `      <img alt="Customer smiling" src="/a.jpg" />`,
      `      <button title="Send">Send message</button>`,
      `      <span>{count}</span>`,
      `      <i className="ml-2">42</i>`,
      `    </form>`,
      `  );`,
      `}`,
    ].join("\n");
    const c = findCandidates(src, "components/ContactForm.tsx");
    const texts = c.map((x) => x.text);
    expect(texts).toEqual(
      expect.arrayContaining([
        "Welcome to the shop",
        "Your name",
        "Full name",
        "Customer smiling",
        "Send",
        "Send message",
      ]),
    );
    expect(texts).not.toContain("42");
    expect(texts).not.toContain("/a.jpg");
    expect(c.find((x) => x.text === "Welcome to the shop")?.key).toBe(
      "contactForm.h1.welcomeToTheShop",
    );
    expect(c.find((x) => x.text === "Your name")?.key).toBe("contactForm.placeholder.yourName");
  });

  it("names pages from the route", async () => {
    const { pageName } = await loadScript<Cand>(S, "scripts/i18n-candidates.mjs");
    expect(pageName("app/[locale]/(shop)/cart/page.tsx")).toBe("cart");
    expect(pageName("components/NavBar.tsx")).toBe("navBar");
  });

  it("finds the fixture app's strings and never rewrites code", async () => {
    const before = await readFile(path.join(fixture, "app/page.tsx"), "utf8");
    const r = spawnSync(
      process.execPath,
      [skillFile(S, "scripts/i18n-candidates.mjs"), fixture, "--json"],
      { encoding: "utf8" },
    );
    const all = JSON.parse(r.stdout) as Array<{ text: string }>;
    expect(all.map((x) => x.text)).toEqual(
      expect.arrayContaining(["Welcome to the shop", "Shop now", "Previous slide"]),
    );
    expect(await readFile(path.join(fixture, "app/page.tsx"), "utf8")).toBe(before);
  });
});

describe("translate-check", () => {
  const msgs = (name: string) => skillFile(S, `evals/fixture-messages/${name}`);

  it("parses ICU: arguments, rich tags, quoting, nested plurals", async () => {
    const { parseIcu } = await loadScript<Tc>(S, "scripts/translate-check.mjs");
    const p = parseIcu(
      "Hi {name}, you have {n, plural, =0 {none} one {# <b>item</b>} other {# items}} '{literal}'",
    );
    expect(p.error).toBeUndefined();
    expect([...p.args].sort()).toEqual(["n", "name"]);
    expect([...p.tags]).toEqual(["b"]);
    expect(p.plurals[0]?.selectors).toEqual(["=0", "one", "other"]);
    expect(
      parseIcu("{gender, select, male {{n, plural, one {a} other {b}}} other {c}}").error,
    ).toBeUndefined();
  });

  it.each([
    ["Hello {name", "missing"],
    ["Hello name}", "unmatched"],
    ["{n, plural, one {a}}", "other"],
    ["{n, plural, lots {a} other {b}}", "selector"],
    ["{}", "placeholder"],
  ])("rejects invalid ICU %s", async (msg, err) => {
    const { parseIcu } = await loadScript<Tc>(S, "scripts/translate-check.mjs");
    expect(parseIcu(msg).error).toMatch(new RegExp(err));
  });

  it("catches every seeded problem in the broken fixture", async () => {
    const tc = await loadScript<Tc>(S, "scripts/translate-check.mjs");
    const read = async (f: string) => tc.flatten(JSON.parse(await readFile(msgs(f), "utf8")));
    const g = tc.parseGlossary(await readFile(msgs("glossary.ar.yaml"), "utf8"));
    const res = tc.compare(await read("en.json"), await read("ar.json"), g);
    const has = (rule: string, key: string) => res.some((r) => r.rule === rule && r.key === key);
    expect(has("missing", "common.save")).toBe(true);
    expect(has("missing", "errors.notFound")).toBe(true);
    expect(has("extra", "errors.unexpected")).toBe(true);
    expect(has("untranslated", "errors.required")).toBe(true);
    expect(has("placeholder", "cart.greeting")).toBe(true); // {name} vs {username}
    expect(has("placeholder", "cart.terms")).toBe(true); // rich tag lost
    expect(has("plural", "cart.items")).toBe(true);
    expect(res.find((r) => r.rule === "plural")?.message).toMatch(/zero, two, few, many/);
    expect(has("glossary", "nav.signIn")).toBe(true); // "Sign in" must be تسجيل الدخول
    expect(has("glossary", "cart.checkout")).toBe(true); // brand translated
  });

  it("passes a correct translation", async () => {
    const tc = await loadScript<Tc>(S, "scripts/translate-check.mjs");
    const read = async (f: string) => tc.flatten(JSON.parse(await readFile(msgs(f), "utf8")));
    const g = tc.parseGlossary(await readFile(msgs("glossary.ar.yaml"), "utf8"));
    expect(tc.compare(await read("en.json"), await read("ar-good.json"), g)).toEqual([]);
  });

  it("counts =0, =1 and =2 as zero, one and two", async () => {
    const { missingArabicCategories } = await loadScript<Tc>(S, "scripts/translate-check.mjs");
    expect(missingArabicCategories(["=0", "=1", "=2", "few", "many", "other"])).toEqual([]);
    expect(missingArabicCategories(["one", "other"])).toEqual(["zero", "two", "few", "many"]);
  });

  it("exits 1 on errors, 0 when it passes, 2 when files are missing", async () => {
    const run = (...a: string[]) =>
      spawnSync(process.execPath, [skillFile(S, "scripts/translate-check.mjs"), ...a], {
        encoding: "utf8",
      });
    const bad = run(
      "--en",
      msgs("en.json"),
      "--ar",
      msgs("ar.json"),
      "--glossary",
      msgs("glossary.ar.yaml"),
    );
    expect(bad.status).toBe(1);
    expect(bad.stdout.split("\n").length).toBeLessThanOrEqual(41);
    const good = run(
      "--en",
      msgs("en.json"),
      "--ar",
      msgs("ar-good.json"),
      "--glossary",
      msgs("glossary.ar.yaml"),
    );
    expect(good.status).toBe(0);
    expect(good.stdout).toMatch(/passes/);
    expect(run(os.tmpdir()).status).toBe(2);
  });
});

describe("screenshot-rtl helpers", () => {
  it("plans en and ar shots at 1440 and 390 for each route", async () => {
    const { planShots, buildUrl, slug } = await loadScript<Shot>(S, "scripts/screenshot-rtl.mjs");
    const shots = planShots({
      routes: ["/", "/pricing"],
      locales: ["en", "ar"],
      base: "http://localhost:3000/",
      pattern: "{base}/{locale}{route}",
      outDir: "/tmp/x",
    });
    expect(shots).toHaveLength(8);
    expect(shots.map((s) => s.width)).toEqual([1440, 390, 1440, 390, 1440, 390, 1440, 390]);
    expect(shots[0]?.url).toBe("http://localhost:3000/en");
    expect(shots[7]?.url).toBe("http://localhost:3000/ar/pricing");
    expect(shots[7]?.file).toBe(path.join("/tmp/x", "pricing.ar.390.png"));
    expect(buildUrl("{base}{route}?lang={locale}", "http://h", "ar", "/a/b")).toBe(
      "http://h/a/b?lang=ar",
    );
    expect(slug("/")).toBe("home");
    expect(slug("/a/b c/")).toBe("a-b-c");
  });

  it("exits 2 with an install hint when Playwright is missing", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "rtl-pw-"));
    await writeFile(path.join(dir, "package.json"), "{}");
    const r = spawnSync(process.execPath, [skillFile(S, "scripts/screenshot-rtl.mjs")], {
      cwd: dir,
      encoding: "utf8",
      // pnpm puts its store on NODE_PATH, which would let the script find a Playwright we did not install here.
      env: { ...process.env, NODE_PATH: "" },
    });
    expect(r.stderr).toMatch(/npm install -D playwright/);
    expect(r.status).toBe(2);
  });
});

describe("scripts stay safe", () => {
  it("make no network calls and never run project code", async () => {
    for (const f of [
      "rtl-scan",
      "rtl-codemod",
      "i18n-candidates",
      "translate-check",
      "i18n-config",
      "_lib",
      "_classmap",
    ]) {
      const src = await readFile(skillFile(S, `scripts/${f}.mjs`), "utf8");
      expect(src, f).not.toMatch(
        /\bfetch\(|node:https?|node:net|child_process|\beval\(|new Function/,
      );
    }
  });
});

describe("starter assets", () => {
  const assets = (rel: string) => skillFile(S, `assets/${rel}`);
  const readMessages = async (l: string) => {
    const tc = await loadScript<Tc>(S, "scripts/translate-check.mjs");
    return tc.flatten(JSON.parse(await readFile(assets(`messages/${l}.json`), "utf8")));
  };

  it("ships at least 150 UI strings that pass translate-check with the glossary", async () => {
    const tc = await loadScript<Tc>(S, "scripts/translate-check.mjs");
    const en = await readMessages("en");
    const ar = await readMessages("ar");
    expect(Object.keys(en).length).toBeGreaterThanOrEqual(150);
    const g = tc.parseGlossary(await readFile(assets("glossary.ar.yaml"), "utf8"));
    expect(g.terms.length).toBeGreaterThan(5);
    expect(tc.compare(en, ar, g)).toEqual([]);
  });

  it("covers all six plural categories in every Arabic plural", async () => {
    const tc = await loadScript<Tc>(S, "scripts/translate-check.mjs");
    const ar = await readMessages("ar");
    const plurals = Object.entries(ar).filter(([, v]) => tc.parseIcu(v).plurals.length > 0);
    expect(plurals.length).toBeGreaterThanOrEqual(5);
    for (const [key, v] of plurals)
      expect(tc.missingArabicCategories(tc.parseIcu(v).plurals[0]?.selectors ?? []), key).toEqual(
        [],
      );
  });

  it("has no RTL problems in its own components", async () => {
    const { scan } = await loadScript<Scan>(S, "scripts/rtl-scan.mjs");
    expect(scan(skillFile(S, "assets"))).toEqual([]);
  });

  it("DirectionalIcon flips only when asked", async () => {
    const src = await readFile(assets("DirectionalIcon.tsx"), "utf8");
    expect(src).toContain("rtl:-scale-x-100");
    expect(src).toMatch(/directional\s*=\s*false/);
    expect(src).toMatch(/directional \? "rtl:-scale-x-100" : ""/);
  });

  it("glossary accepts alternative forms and ignores placeholder names", async () => {
    const tc = await loadScript<Tc>(S, "scripts/translate-check.mjs");
    const g = tc.parseGlossary("terms:\n  - en: Email\n    ar: البريد الإلكتروني|بريد إلكتروني\n");
    expect(g.terms[0]?.ar).toBe("البريد الإلكتروني|بريد إلكتروني");
    const ok = tc.compare({ a: "Your Email" }, { a: "بريد إلكتروني" }, g);
    expect(ok).toEqual([]);
    const bad = tc.compare({ a: "Your Email" }, { a: "رسالة" }, g);
    expect(bad.map((r) => r.rule)).toEqual(["glossary"]);
    expect(tc.compare({ a: "Sent to {email}" }, { a: "أُرسل إلى {email}" }, g)).toEqual([]);
  });
});

describe("i18n-config", () => {
  interface Cfg {
    normalize(i: object): { config: Record<string, unknown>; errors: string[] };
    DEFAULTS: Record<string, unknown>;
  }
  const run = (...a: string[]) =>
    spawnSync(process.execPath, [skillFile(S, "scripts/i18n-config.mjs"), ...a], {
      encoding: "utf8",
    });

  it("fills defaults and validates choices", async () => {
    const { normalize, DEFAULTS } = await loadScript<Cfg>(S, "scripts/i18n-config.mjs");
    expect(normalize({}).config).toEqual(DEFAULTS);
    expect(normalize({}).errors).toEqual([]);
    expect(normalize({ locales: ["en", "fr"] }).errors.join()).toMatch(/Arabic/);
    expect(normalize({ defaultLocale: "de" }).errors.join()).toMatch(/not in locales/);
    expect(normalize({ digits: "roman" }).errors.join()).toMatch(/digits must be one of/);
    expect(normalize({ nope: 1 }).errors.join()).toMatch(/unknown key/);
  });

  it("writes once, refuses to overwrite, and reads back", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "rtl-cfg-"));
    expect(run(dir).status).toBe(2); // missing
    const init = run(dir, "--init", "--locales", "en,ar,fr", "--digits", "arab");
    expect(init.status).toBe(0);
    const saved = JSON.parse(await readFile(path.join(dir, "i18n.config.json"), "utf8"));
    expect(saved.locales).toEqual(["en", "ar", "fr"]);
    expect(saved.digits).toBe("arab");
    expect(run(dir, "--init").status).toBe(2);
    expect(run(dir, "--init", "--force", "--digits", "latn").status).toBe(0);
    const out = run(dir);
    expect(out.status).toBe(0);
    expect(out.stdout).toMatch(/digits: latn/);
    expect(run(dir, "--init", "--force", "--digits", "x").status).toBe(1);
  });

  it("reports an invalid file", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "rtl-cfg-bad-"));
    await writeFile(path.join(dir, "i18n.config.json"), "{ nope");
    expect(run(dir).status).toBe(1);
  });
});

describe("rtl-scan with several paths", () => {
  it("scans only the given files and supports --errors-only", () => {
    const run = (...a: string[]) =>
      spawnSync(process.execPath, [skillFile(S, "scripts/rtl-scan.mjs"), ...a], {
        encoding: "utf8",
      });
    const r = run(
      path.join(fixture, "components/ProductCard.tsx"),
      path.join(fixture, "components/ContactForm.tsx"),
      "--errors-only",
      "--json",
    );
    expect(r.status).toBe(1);
    const found = JSON.parse(r.stdout) as Finding[];
    expect(new Set(found.map((f) => f.file))).toEqual(
      new Set(["ProductCard.tsx", "ContactForm.tsx"]),
    );
    expect(found.every((f) => f.severity === "error")).toBe(true);
    expect(run("/definitely/not/here").status).toBe(2);
  });
});

describe("skill files", () => {
  it("keeps text free of bidi controls and stray zero-width characters", async () => {
    const { readdir } = await import("node:fs/promises");
    const root = skillFile(S, "");
    const walkDir = async (dir: string): Promise<string[]> =>
      (await readdir(dir, { withFileTypes: true })).flatMap((e) =>
        e.isDirectory() ? [] : [path.join(dir, e.name)],
      );
    const dirs = ["", "references", "assets", "assets/messages", "scripts"].map((d) =>
      path.join(root, d),
    );
    for (const dir of dirs)
      for (const file of await walkDir(dir)) {
        if (!/\.(md|ts|tsx|mjs|json|yaml)$/.test(file)) continue;
        const text = await readFile(file, "utf8");
        expect(text, file).not.toMatch(
          new RegExp("[\\u202A-\\u202E\\u2066-\\u2069\\u200B\\u2060\\uFEFF\\u200E\\u200F]"),
        );
        expect(text, file).not.toMatch(
          new RegExp(
            "(?<![\\u0600-\\u06FF])[\\u200C\\u200D]|[\\u200C\\u200D](?![\\u0600-\\u06FF])",
          ),
        );
      }
  });

  it("is a manual-only skill with the house sections", async () => {
    const skill = await readFile(skillFile(S, "SKILL.md"), "utf8");
    expect(skill).toMatch(/^disable-model-invocation: true$/m);
    expect(skill.split("\n").length).toBeLessThanOrEqual(150);
    for (const h of ["Use when", "Don't use when", "Steps", "Budget", "Output", "Done when"])
      expect(skill).toContain(`## ${h}`);
  });
});

describe("strings in props, objects and ternaries", () => {
  interface Props {
    findPropStrings(
      src: string,
      rel: string,
    ): Array<{ text: string; element: string; key: string }>;
  }
  const find = async (src: string) =>
    (await loadScript<Props>(S, "scripts/i18n-candidates.mjs"))
      .findPropStrings(src, "app/page.tsx")
      .map((c) => c.text);

  it("finds copy passed as props, object values, arrays and ternaries", async () => {
    const src = [
      `<Hero headline="Write the day up before you leave" cta={{ label: "Start free", href: "/p" }} />`,
      `const features = [{ title: "Notes in seconds", description: "Tap a template, add a line." }];`,
      `<List points={["Reusable templates", "Crew hours"]} />`,
      `<button aria-label={open ? "Close menu" : "Open menu"}>{price === 0 ? "Free" : "Paid"}</button>`,
    ].join("\n");
    expect(await find(src)).toEqual(
      expect.arrayContaining([
        "Write the day up before you leave",
        "Start free",
        "Notes in seconds",
        "Tap a template, add a line.",
        "Reusable templates",
        "Crew hours",
        "Close menu",
        "Open menu",
        "Free",
        "Paid",
      ]),
    );
  });

  it("skips class names, links, imports, comparisons and code-like keys", async () => {
    const src = [
      `import { Hero } from "@/components/Hero";`,
      `<div className="mt-4 flex items-center gap-2 text-muted" id="Main Section" />`,
      `<div className={open ? "bg-ground px-4" : "bg-subtle px-6"} />`,
      `<a href="/pricing/yearly" target="_blank" rel="noopener noreferrer">x</a>`,
      `if (e.key === "Escape") close();`,
      `<Foo variant="primary action" tone="subtle" size="Large" />`,
      `const url = "https://example.com/Docs";`,
    ].join("\n");
    expect(await find(src)).toEqual([]);
  });
});

describe("design kit folders", () => {
  const project = async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "rtl-kit-"));
    await mkdir(path.join(dir, "src/components/kit"), { recursive: true });
    await writeFile(
      path.join(dir, "src/components/kit/Card.tsx"),
      `export const C = () => <p className="ml-4 text-left">Hello there</p>;\n`,
    );
    await writeFile(
      path.join(dir, "src/page.tsx"),
      `export const P = () => <p className="mt-2">Plain</p>;\n`,
    );
    return dir;
  };
  const run = (script: string, ...a: string[]) =>
    spawnSync(process.execPath, [skillFile(S, `scripts/${script}`), ...a], { encoding: "utf8" });

  it("every script says when it stepped over a kit folder, and counts what is inside", async () => {
    const dir = await project();
    const scan = run("rtl-scan.mjs", dir);
    expect(scan.stdout).toMatch(
      /NOTE: skipped .*components\/kit.*\(2 error\(s\), 0 warning\(s\) inside\)/,
    );
    expect(scan.stdout).toContain("--include-kit");
    const codemod = run("rtl-codemod.mjs", dir);
    expect(codemod.stdout).toMatch(/NOTE: skipped .*\(2 class\(es\) inside\)/);
    const cand = run("i18n-candidates.mjs", dir);
    expect(cand.stdout).toMatch(/NOTE: skipped .*\(1 string\(s\) inside\)/);
  });

  it("--include-kit scans and rewrites the kit and drops the note", async () => {
    const dir = await project();
    const scan = run("rtl-scan.mjs", dir, "--include-kit");
    expect(scan.status).toBe(1);
    expect(scan.stdout).not.toContain("NOTE:");
    expect(scan.stdout).toContain("Card.tsx");
    run("rtl-codemod.mjs", dir, "--include-kit", "--write");
    expect(await readFile(path.join(dir, "src/components/kit/Card.tsx"), "utf8")).toContain(
      "ms-4 text-start",
    );
    expect(run("i18n-candidates.mjs", dir, "--include-kit").stdout).toContain("Hello there");
  });

  it("gives no note when there is no kit folder", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "rtl-nokit-"));
    await writeFile(
      path.join(dir, "a.tsx"),
      `export const A = () => <p className="mt-2">Plain</p>;\n`,
    );
    expect(run("rtl-scan.mjs", dir).stdout).not.toContain("NOTE:");
  });
});

describe("candidate false positives", () => {
  it("ignores code between JSX elements and ALL-CAPS codes", async () => {
    const { findCandidates } = await loadScript<Cand>(S, "scripts/i18n-candidates.mjs");
    const src = [
      `const rows = [feature(1, <A />), feature(2, <B />), feature(3, <C />)];`,
      `<Hero items={[<A />), x(2, <B />]} />`,
      `const f = new Intl.NumberFormat("en", { currency: "USD" });`,
      `<p>Real text for people</p>`,
    ].join("\n");
    expect(findCandidates(src, "a.tsx").map((c) => c.text)).toEqual(["Real text for people"]);
  });
});

describe("screenshot scrolling", () => {
  it("walks the page top to bottom in steps", async () => {
    const { scrollSteps } = await loadScript<{ scrollSteps(h: number, s: number): number[] }>(
      S,
      "scripts/screenshot-rtl.mjs",
    );
    expect(scrollSteps(2000, 800)).toEqual([0, 800, 1600, 2000]);
    expect(scrollSteps(0, 800)).toEqual([0]);
    expect(scrollSteps(500, 800)).toEqual([0, 500]);
  });
});
