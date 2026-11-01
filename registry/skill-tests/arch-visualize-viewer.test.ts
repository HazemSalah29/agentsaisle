import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadLib, skillFile } from "./load";

const viewerDir = skillFile("arch-visualize", "assets/viewer");
const read = (rel: string) => readFileSync(path.join(viewerDir, rel), "utf8");
const srcFiles = readdirSync(path.join(viewerDir, "src"))
  .filter((f) => f.endsWith(".js"))
  .sort();
const code = srcFiles.map((f) => read(`src/${f}`)).join("\n");
const markup = read("index.html");
const strings = JSON.parse(read("i18n.json")) as Record<"en" | "ar", Record<string, string>>;
const fixture = skillFile("arch-visualize", "evals/fixture-model.json");
const hostile = skillFile("arch-visualize", "evals/hostile-model.json");

const render = (model: string, extra: string[] = []) => {
  const out = path.join(mkdtempSync(path.join(tmpdir(), "arch-viewer-")), "page.html");
  const r = spawnSync(
    process.execPath,
    [skillFile("arch-visualize", "scripts/render.mjs"), "--model", model, "--out", out, ...extra],
    { encoding: "utf8" },
  );
  return { ...r, html: r.status === 0 ? readFileSync(out, "utf8") : "" };
};

const PLURAL = /\.(zero|one|two|few|many|other)$/;
const base = (key: string) => key.replace(PLURAL, "");
const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!).sort();
// Keys that code builds from a prefix and a model value (a tier, a role, a severity).
const DYNAMIC = ["tier.", "role.", "sev.", "search.kind."];

describe("arch-visualize text (i18n)", () => {
  it("has the same keys in English and Arabic, with an .other form for every plural", () => {
    const keys = (l: "en" | "ar") => new Set(Object.keys(strings[l]).map(base));
    expect([...keys("ar")].sort()).toEqual([...keys("en")].sort());
    for (const l of ["en", "ar"] as const)
      for (const k of Object.keys(strings[l]))
        if (PLURAL.test(k)) expect(strings[l][`${base(k)}.other`], `${l} ${k}`).toBeDefined();
  });

  it("uses the same {slots} in both languages", () => {
    for (const [k, en] of Object.entries(strings.en)) {
      const ar = strings.ar[k];
      if (ar === undefined) continue; // an Arabic-only plural form such as .two
      expect(
        placeholders(ar).filter((p) => p !== "n"),
        k,
      ).toEqual(placeholders(en).filter((p) => p !== "n"));
    }
  });

  it("defines every key the code and the markup use, and uses every key it defines", () => {
    const used = new Set<string>();
    for (const m of code.matchAll(/\bt\(\s*"([\w.]+)"/g)) used.add(m[1]!);
    for (const m of code.matchAll(/\btn\(\s*"([\w.]+)"/g)) used.add(`${m[1]}.other`);
    for (const m of markup.matchAll(/\{\{([\w.]+)\}\}/g)) used.add(m[1]!);
    for (const key of [...used].filter((k) => !k.endsWith("."))) {
      expect(strings.en[key], `en ${key}`).toBeDefined();
      expect(
        strings.ar[key] ?? strings.ar[key.replace(/\.other$/, ".few")],
        `ar ${key}`,
      ).toBeDefined();
    }
    const usedBases = new Set([...used].map(base));
    for (const key of Object.keys(strings.en)) {
      if (DYNAMIC.some((p) => key.startsWith(p))) continue;
      const quoted = code.includes(`"${key}"`) || code.includes(`"${base(key)}"`);
      expect(usedBases.has(base(key)) || used.has(key) || quoted, `unused key ${key}`).toBe(true);
    }
  });

  it("keeps every tier, role and severity the model can hold translated", () => {
    const schema = JSON.parse(
      readFileSync(skillFile("arch-visualize", "assets/model.schema.json"), "utf8"),
    );
    for (const role of schema.$defs.role.enum as string[])
      for (const l of ["en", "ar"] as const) expect(strings[l][`role.${role}`], role).toBeDefined();
    for (const tier of schema.$defs.tier.enum as string[])
      for (const l of ["en", "ar"] as const) expect(strings[l][`tier.${tier}`], tier).toBeDefined();
    for (const l of ["en", "ar"] as const) {
      expect(strings[l]["sev.info"]).toBeDefined();
      expect(strings[l]["sev.warn"]).toBeDefined();
    }
  });

  it("writes the Arabic strings in Arabic letters", () => {
    const arabic = /[؀-ۿ]/;
    const plain = Object.entries(strings.ar).filter(
      ([, v]) => !arabic.test(v) && v.replace(/\{\w+\}|[\s.,:;()·←→«»-]/g, "") !== "",
    );
    expect(plain.map(([k]) => k)).toEqual([]);
  });

  it("puts no bidi control characters in code, markup or text", () => {
    const bidi = /[؜‎‏‪-‮⁦-⁩]/;
    for (const [name, text] of [
      ["i18n.json", read("i18n.json")],
      ["index.html", markup],
      ["styles.css", read("styles.css")],
      ...srcFiles.map((f) => [f, read(`src/${f}`)] as const),
    ] as const)
      expect(bidi.test(text), name).toBe(false);
  });
});

describe("arch-visualize languages and direction", () => {
  const en = render(fixture);
  const ar = render(fixture, ["--lang", "ar"]);

  it("renders English left to right by default", () => {
    expect(en.status).toBe(0);
    expect(en.html).toContain('<html lang="en" dir="ltr" data-flow="ltr" data-lens="system">');
    expect(en.html).toContain(strings.en["btn.theme"]);
    expect(en.html).not.toMatch(/\{\{|__LANG__|__DIR__|__FLOW__|__I18N_JSON__/);
  });

  it("renders Arabic right to left with Arabic text", () => {
    expect(ar.status).toBe(0);
    expect(ar.html).toContain('<html lang="ar" dir="rtl" data-flow="ltr" data-lens="system">');
    expect(ar.html).toContain(strings.ar["btn.theme"]);
    expect(ar.html).not.toContain(strings.en["btn.theme"]);
  });

  it("keeps the diagram direction separate: --flow-dir rtl on an English page", () => {
    const r = render(fixture, ["--flow-dir", "rtl"]);
    expect(r.html).toContain('<html lang="en" dir="ltr" data-flow="rtl" data-lens="system">');
  });

  it("embeds the chosen text table once, with English underneath", () => {
    const block = /<script type="application\/json" id="i18n">([\s\S]*?)<\/script>/.exec(ar.html);
    const table = JSON.parse(block![1]!) as {
      lang: string;
      dir: string;
      strings: Record<string, string>;
    };
    expect(table.lang).toBe("ar");
    expect(table.dir).toBe("rtl");
    expect(table.strings["btn.theme"]).toBe(strings.ar["btn.theme"]);
  });

  it("is deterministic in each language", () => {
    for (const extra of [[], ["--lang", "ar"], ["--lang", "ar", "--flow-dir", "rtl"]]) {
      expect(render(fixture, [...extra, "--force"]).html).toBe(
        render(fixture, [...extra, "--force"]).html,
      );
    }
  });

  it("refuses an unknown language or direction with exit 2", () => {
    expect(render(fixture, ["--lang", "xx"]).status).toBe(2);
    expect(render(fixture, ["--flow-dir", "up"]).status).toBe(2);
  });

  it("never lets hostile labels into markup or text in either language", () => {
    for (const lang of ["en", "ar"]) {
      const { html } = render(hostile, ["--lang", lang]);
      expect(html).not.toContain("<img src=x");
      expect(html).not.toContain("<svg onload");
    }
  });
});

// ---- colours: every pair that is drawn on top of another must pass WCAG 2.1 AA
type Tokens = Record<string, string>;
const css = read("styles.css");
const tokensOf = (block: string): Tokens =>
  Object.fromEntries(
    [...block.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)].map((m) => [m[1]!, m[2]!]),
  );
const lightBlock = /:root\s*\{([\s\S]*?)\n\}/.exec(css)![1]!;
const darkBlock = /:root\[data-theme="dark"\]\s*\{([\s\S]*?)\n\}/.exec(css)![1]!;
const mediaDarkBlock = /:root:not\(\[data-theme="light"\]\)\s*\{([\s\S]*?)\n\s*\}/.exec(css)![1]!;
const channel = (v: number) => {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
};
const luminance = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * channel(n >> 16) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
};
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
};

describe("arch-visualize colours", () => {
  const themes: Record<string, Tokens> = {
    light: tokensOf(lightBlock),
    dark: tokensOf(darkBlock),
  };
  it("defines the same tokens for the dark theme chosen by the system and by the button", () => {
    expect(tokensOf(mediaDarkBlock)).toEqual(themes.dark);
    expect(Object.keys(themes.dark!).sort()).toEqual(
      Object.keys(themes.light!)
        .filter((k) => !["fs-s", "fs-m", "fs-l"].includes(k) || k in themes.dark!)
        .sort(),
    );
  });

  // [foreground, background, minimum ratio]: 4.5 for text, 3 for lines and focus rings
  const pairs: [string, string, number][] = [
    ["text", "bg", 4.5],
    ["text", "surface", 4.5],
    ["text", "surface-2", 4.5],
    ["muted", "bg", 4.5],
    ["muted", "surface", 4.5],
    ["muted", "surface-2", 4.5],
    ["muted", "band", 4.5],
    ["text", "warn-bg", 4.5],
    ["muted", "warn-bg", 4.5],
    ["warn-text", "warn", 4.5],
    ["accent-text", "accent-system", 4.5],
    ["accent-text", "accent-flows", 4.5],
    ["accent-system", "surface", 4.5],
    ["accent-flows", "surface", 4.5],
    ["accent-system", "surface-2", 4.5],
    ["accent-flows", "surface-2", 4.5],
    ["accent-system", "band", 3],
    ["accent-flows", "band", 3],
    ["focus", "bg", 3],
    ["focus", "surface", 3],
    ["edge", "bg", 3],
    ["edge", "band", 3],
    ["edge", "surface", 3],
    ["warn", "bg", 3],
  ];
  for (const [theme, tokens] of Object.entries(themes))
    for (const [fg, bg, min] of pairs)
      it(`${theme}: ${fg} on ${bg} is at least ${min}:1`, () => {
        expect(tokens[fg], fg).toBeDefined();
        expect(tokens[bg], bg).toBeDefined();
        expect(contrast(tokens[fg]!, tokens[bg]!)).toBeGreaterThanOrEqual(min);
      });

  it("uses three type sizes and no other font size", () => {
    const sizes = new Set(
      [...css.matchAll(/--fs-([sml]):\s*(\d+)px/g)].map((m) => `${m[1]}${m[2]}`),
    );
    expect([...sizes].sort()).toEqual(["l18", "m14", "s12"]);
    const fontLines = css.split("\n").filter((l) => /font-size:|^\s+\d+ ?(px|rem)/.test(l));
    for (const l of fontLines) expect(l, l).toMatch(/var\(--fs-[sml]\)/);
  });
});

describe("arch-visualize level of detail and minimap", () => {
  const { ArchLod } = loadLib<{
    ArchLod: { level: (k: number) => string; FAR: number; NEAR: number };
  }>("arch-visualize", ["assets/lib/lod.js"]);

  it("maps zoom to far, mid and near at the documented thresholds", () => {
    expect(ArchLod.level(0.2)).toBe("far");
    expect(ArchLod.level(ArchLod.FAR - 0.001)).toBe("far");
    expect(ArchLod.level(ArchLod.FAR)).toBe("mid");
    expect(ArchLod.level(ArchLod.NEAR - 0.001)).toBe("mid");
    expect(ArchLod.level(ArchLod.NEAR)).toBe("near");
    expect(ArchLod.level(3)).toBe("near");
    expect(ArchLod.FAR).toBeLessThan(ArchLod.NEAR);
  });

  it("hides text, badges and labels in the styles as the zoom goes out", () => {
    const css = read("styles.css");
    expect(css).toMatch(/\[data-lod="far"\] \.node \.name/);
    expect(css).toMatch(/\[data-lod="mid"\] \.node \.sub/);
    expect(css).toMatch(/\[data-lod="mid"\] \.edge-label/);
    expect(code).toMatch(/canvas\.setAttribute\("data-lod", ArchLod\.level\(view\.k\)\)/);
  });

  it("has a minimap that can be reached by keyboard and does not start a pan", () => {
    expect(markup).toMatch(/id="minimap" tabindex="0"/);
    expect(code).toMatch(/closest\("#zoom, #minimap"\)/);
    expect(code).toMatch(/\$\("minimap"\)\.addEventListener\("keydown"/);
  });

  it("draws connection labels with text only", () => {
    expect(code).toMatch(/class: "edge-label"/);
    expect(code).not.toMatch(/innerHTML/);
  });
});

describe("arch-visualize search, trace and links in the page", () => {
  it("writes results, paths and link text only as text", () => {
    for (const f of ["60-search.js", "65-trace.js", "70-links.js"]) {
      const src = read(`src/${f}`);
      expect(src, f).not.toMatch(/innerHTML|outerHTML|insertAdjacentHTML|document\.write/);
    }
    expect(read("src/60-search.js")).toMatch(/h\(\s*"li"/);
  });

  it("only touches the address through the validated link module and tolerates refusal", () => {
    const src = read("src/70-links.js");
    expect(src).toMatch(/ArchHash\.buildHash/);
    expect(src).toMatch(/ArchHash\.parseHash\(location\.hash\)/);
    expect(src).toMatch(/try \{[\s\S]*history\.replaceState[\s\S]*\} catch/);
    expect(src).not.toMatch(/location\.hash\s*=/);
  });

  it("does not write the address before the reader has done something", () => {
    expect(read("src/70-links.js")).toMatch(/if \(!userTouched\) return;/);
  });

  it("builds the page with the three finding libraries inlined once", () => {
    const { html } = render(fixture);
    for (const name of ["ArchSearch", "ArchPaths", "ArchHash", "ArchLod"])
      expect(html.match(new RegExp(`root\\.${name} = `, "g")), name).toHaveLength(1);
  });
});

describe("arch-visualize lenses", () => {
  it("starts in the System lens and carries the lens on the page element", () => {
    expect(render(fixture).html).toContain('data-lens="system"');
    expect(render(fixture, ["--lens", "flows"]).html).toContain('data-lens="flows"');
  });

  it("accepts the names of the lenses planned for later and refuses anything else", () => {
    for (const lens of ["security", "failure", "ai", "diff"])
      expect(render(fixture, ["--lens", lens]).status, lens).toBe(0);
    expect(render(fixture, ["--lens", "party"]).status).toBe(2);
  });

  it("only offers the lenses that exist and falls back to System for the rest", () => {
    const src = read("src/55-lens.js");
    expect(src).toMatch(/LENS_ORDER\.indexOf\(name\) >= 0 \? name : "system"/);
    expect(src).toMatch(/\["system"\]\.concat\(flows\.length \? \["flows"\] : \[\]\)/);
  });

  it("has a scrubbable timeline, a focus toggle and a live caption", () => {
    expect(markup).toMatch(/id="fscrub"/);
    expect(markup).toMatch(/id="ffocus" aria-pressed="true"/);
    expect(markup).toMatch(/id="caption" class="caption" aria-live="polite"/);
    expect(code).toMatch(/\$\("fscrub"\)\.addEventListener\("input"/);
  });

  it("describes together in the schema and in the flows reference", () => {
    const schema = JSON.parse(
      readFileSync(skillFile("arch-visualize", "assets/model.schema.json"), "utf8"),
    );
    expect(schema.$defs.flowStep.properties.together.type).toBe("boolean");
    expect(readFileSync(skillFile("arch-visualize", "references/flows.md"), "utf8")).toContain(
      "together",
    );
  });
});
