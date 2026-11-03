import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadScript, skillFile } from "./load";

type Loose = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
type Msg = { level: "error" | "warn"; message: string };
type Brand = {
  DEFAULT_BRAND: Loose;
  BUNDLED_FONTS: string[];
  luminance: (h: string) => number;
  contrast: (a: string, b: string) => number;
  checkBrand: (b: unknown, o?: Loose) => Msg[];
};
const load = () => loadScript<Brand>("video-brand", "scripts/brand.mjs");
const errors = (m: Msg[]) => m.filter((x) => x.level === "error").map((x) => x.message);
const warns = (m: Msg[]) => m.filter((x) => x.level === "warn").map((x) => x.message);
const studio = () => mkdtempSync(path.join(os.tmpdir(), "video-brand-"));
const cli = (...a: string[]) =>
  spawnSync("node", [skillFile("video-brand", "scripts/brand.mjs"), ...a], { encoding: "utf8" });

describe("video-brand contrast", () => {
  it("matches known WCAG values", async () => {
    const { contrast, luminance } = await load();
    expect(luminance("#000")).toBe(0);
    expect(luminance("#ffffff")).toBeCloseTo(1, 5);
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 3);
    expect(contrast("#ffffff", "#ffffff")).toBeCloseTo(1, 5);
    expect(contrast("#767676", "#ffffff")).toBeCloseTo(4.54, 2); // the classic AA threshold grey
    expect(contrast("#fff", "#000")).toBeCloseTo(contrast("#000000", "#ffffff"), 5); // order and short form do not matter
  });
});

describe("video-brand check", () => {
  it("accepts the default brand with no errors and no warnings", async () => {
    const { checkBrand, DEFAULT_BRAND } = await load();
    expect(checkBrand(DEFAULT_BRAND)).toEqual([]);
  });

  it("keeps the same defaults as video-core and the studio template", async () => {
    const { DEFAULT_BRAND } = await load();
    const core = await loadScript<{ DEFAULT_BRAND: Loose }>("video-core", "scripts/project.mjs");
    expect(DEFAULT_BRAND.colors).toEqual(core.DEFAULT_BRAND.colors);
    expect(DEFAULT_BRAND.font).toBe(core.DEFAULT_BRAND.font);
    const template = JSON.parse(
      readFileSync(skillFile("video", "assets/studio/brand/brand.json"), "utf8"),
    );
    expect(template.colors).toEqual(DEFAULT_BRAND.colors);
    expect(template.font).toBe(DEFAULT_BRAND.font);
  });

  it("rejects colours that are not hex and says which one", async () => {
    const { checkBrand } = await load();
    const out = errors(
      checkBrand({ colors: { bg: "red", fg: "#GGG", accent: "rgb(1,2,3)", muted: 5 } }),
    );
    expect(out).toHaveLength(4);
    expect(out[0]).toMatch(/colors\.bg must be a hex colour/);
  });

  it("fails low-contrast text and accent, and only warns for muted text", async () => {
    const { checkBrand } = await load();
    const base = { bg: "#FFFFFF", fg: "#000000", accent: "#FF5A1F", muted: "#767676" };
    expect(errors(checkBrand({ colors: { ...base, fg: "#AAAAAA" } })).join()).toMatch(
      /fg on bg has contrast 2\.\d+:1; text needs at least 4\.5:1/,
    );
    expect(errors(checkBrand({ colors: { ...base, accent: "#FFFF99" } })).join()).toMatch(
      /accent on bg has contrast .*at least 3:1/,
    );
    const muted = checkBrand({ colors: { ...base, muted: "#BBBBBB" } });
    expect(errors(muted)).toEqual([]);
    expect(warns(muted).join()).toMatch(/muted on bg has contrast/);
  });

  it("warns about missing, extra and not-yet-built keys, and alpha channels", async () => {
    const { checkBrand } = await load();
    const w = warns(
      checkBrand({ colors: { bg: "#000000CC", fg: "#fff", extra: "#123" }, intro: "x", banana: 1 }),
    ).join("\n");
    expect(w).toMatch(/"intro" is not built yet/);
    expect(w).toMatch(/unknown key "banana"/);
    expect(w).toMatch(/colors\.accent is not set/);
    expect(w).toMatch(/colors\.bg has an alpha channel/);
    expect(w).toMatch(/colors\.extra is not a brand colour/);
  });

  it("needs a font that HyperFrames ships or a file in brand/fonts", async () => {
    const { checkBrand, BUNDLED_FONTS } = await load();
    expect(BUNDLED_FONTS).toContain("Inter");
    expect(errors(checkBrand({ font: "Cairo" }, { fontFiles: [] })).join()).toMatch(
      /font "Cairo" is not bundled .* no Cairo\.woff2/,
    );
    expect(errors(checkBrand({ font: "Cairo" }, { fontFiles: ["cairo.ttf"] }))).toEqual([]);
    expect(errors(checkBrand({ font: "Poppins" }))).toEqual([]);
    expect(errors(checkBrand({ font: "x';}</style>" })).join()).toMatch(/plain family name/);
  });

  it("warns about more than two typefaces and about Arabic without an Arabic font", async () => {
    const { checkBrand } = await load();
    expect(warns(checkBrand({ font: "Inter" }, { fontFiles: ["A.ttf", "B.otf"] })).join()).toMatch(
      /3 typefaces in use/,
    );
    expect(warns(checkBrand({}, { lang: "ar" })).join()).toMatch(/Arabic needs an Arabic font/);
    expect(
      warns(checkBrand({ font: "Cairo" }, { lang: "ar", fontFiles: ["Cairo.ttf"] })).join(),
    ).not.toMatch(/Arabic/);
  });

  it("checks the logo path and file", async () => {
    const { checkBrand } = await load();
    for (const logo of ["../x.png", "/etc/x.png", "logo.exe", 5])
      expect(errors(checkBrand({ logo })).join()).toMatch(/logo must be a relative path/);
    expect(errors(checkBrand({ logo: "logo.svg" }, { logoExists: () => false })).join()).toMatch(
      /logo file "logo.svg" is missing/,
    );
    expect(errors(checkBrand({ logo: "logo.svg" }, { logoExists: () => true }))).toEqual([]);
  });

  it("checks the caption block", async () => {
    const { checkBrand } = await load();
    const bad = errors(
      checkBrand({ captions: { style: "neon", maxWordsPerLine: 1, size: 0.5, weight: 50 } }),
    ).join("\n");
    expect(bad).toMatch(/captions\.style must be one of karaoke, pop, clean/);
    expect(bad).toMatch(/maxWordsPerLine must be a whole number from 2 to 8/);
    expect(bad).toMatch(/captions\.size must be a fraction/);
    expect(bad).toMatch(/captions\.weight must be a whole number from 100 to 900/);
    expect(warns(checkBrand({ captions: { size: 0.03 } })).join()).toMatch(/below 0\.045/);
    expect(checkBrand("nope")[0]!.message).toMatch(/must be an object/);
  });
});

describe("video-brand command", () => {
  it("writes brand/brand.json and brand/fonts, then refuses to overwrite", () => {
    const dir = studio();
    const a = cli("init", dir);
    expect(a.status).toBe(0);
    expect(
      JSON.parse(readFileSync(path.join(dir, "brand", "brand.json"), "utf8")).colors.accent,
    ).toBe("#FF5A1F");
    expect(existsSync(path.join(dir, "brand", "fonts"))).toBe(true);
    expect(cli("init", dir).status).toBe(2);
    expect(cli("init", dir, "--force", "--accent", "#00AA66").status).toBe(0);
    expect(
      JSON.parse(readFileSync(path.join(dir, "brand", "brand.json"), "utf8")).colors.accent,
    ).toBe("#00AA66");
  });

  it("refuses bad colours or a missing font and writes nothing", () => {
    const dir = studio();
    expect(cli("init", dir, "--fg", "#222222").status).toBe(1); // fg on the dark default bg
    expect(cli("init", dir, "--accent", "blue").status).toBe(1);
    expect(cli("init", dir, "--font", "Cairo").status).toBe(1);
    expect(existsSync(path.join(dir, "brand", "brand.json"))).toBe(false);
    mkdirSync(path.join(dir, "brand", "fonts"), { recursive: true });
    writeFileSync(path.join(dir, "brand", "fonts", "Cairo.ttf"), "x");
    expect(cli("init", dir, "--font", "Cairo").status).toBe(0);
  });

  it("checks a studio folder or a file, with exit codes and capped output", () => {
    const dir = studio();
    cli("init", dir);
    const ok = cli("check", dir);
    expect(ok.status).toBe(0);
    expect(ok.stdout).toMatch(/OK: brand\.json is valid/);
    writeFileSync(
      path.join(dir, "brand", "brand.json"),
      JSON.stringify({ colors: { fg: "#111111" }, font: "Nope", logo: "gone.png" }),
    );
    const bad = cli("check", path.join(dir, "brand", "brand.json"));
    expect(bad.status).toBe(1);
    expect(bad.stdout).toMatch(/ERROR fg on bg/);
    expect(bad.stdout.split("\n").length).toBeLessThanOrEqual(41);
    writeFileSync(path.join(dir, "brand", "brand.json"), "{nope");
    expect(cli("check", dir).status).toBe(1);
    expect(cli("check", studio()).status).toBe(2);
    expect(cli().status).toBe(2);
  });
});
