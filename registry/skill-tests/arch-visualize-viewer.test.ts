import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { skillFile } from "./load";

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
const DYNAMIC = ["tier.", "role.", "sev."];

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
    expect(en.html).toContain('<html lang="en" dir="ltr" data-flow="ltr">');
    expect(en.html).toContain(strings.en["btn.theme"]);
    expect(en.html).not.toMatch(/\{\{|__LANG__|__DIR__|__FLOW__|__I18N_JSON__/);
  });

  it("renders Arabic right to left with Arabic text", () => {
    expect(ar.status).toBe(0);
    expect(ar.html).toContain('<html lang="ar" dir="rtl" data-flow="ltr">');
    expect(ar.html).toContain(strings.ar["btn.theme"]);
    expect(ar.html).not.toContain(strings.en["btn.theme"]);
  });

  it("keeps the diagram direction separate: --flow-dir rtl on an English page", () => {
    const r = render(fixture, ["--flow-dir", "rtl"]);
    expect(r.html).toContain('<html lang="en" dir="ltr" data-flow="rtl">');
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
