import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadScript, skillFile } from "./load";
import { GOOD } from "./video-puppet-fixtures";

type Loose = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
type Bible = {
  parseBible: (t: string) => Loose;
  bibleProblems: (b: Loose, folder: string, raw?: string) => string[];
  contrast: (a: string, b: string) => number;
};
const mod = () => loadScript<Bible>("video-kids", "scripts/bible-check.mjs");

describe("bible", () => {
  it("reads keys, the palette and the never list", async () => {
    const { parseBible } = await mod();
    const b = parseBible(GOOD);
    expect(b.name).toBe("Nour");
    expect(b["shape-language"]).toBe("round");
    expect(b.colours).toHaveLength(4);
    expect(b.never).toHaveLength(2);
  });
  it("accepts a complete original bible (the never list may name what to avoid)", async () => {
    const { parseBible, bibleProblems } = await mod();
    expect(bibleProblems(parseBible(GOOD), "nour", GOOD)).toEqual([]);
  });
  it.each([
    ["no palette", GOOD.replace(/- Palette:.*\n/, ""), /Palette/],
    ["two colours", GOOD.replace(/- Palette:.*\n/, "- Palette: #111111, #ffffff\n"), /Palette/],
    ["a non-hex colour", GOOD.replace("#3f9f6b", "green"), /Palette/],
    [
      "colours too alike",
      GOOD.replace(/- Palette:.*\n/, "- Palette: #777777, #787878, #797979\n"),
      /contrast/,
    ],
    ["an unknown shape", GOOD.replace("round", "blobby"), /Shape language/],
    ["one never item", GOOD.replace(/- Never looks.*\n/, ""), /Never/],
    ["no catchphrase", GOOD.replace(/- Catchphrase:.*\n/, ""), /Catchphrase/],
    [
      "a known character",
      GOOD.replace("Nour the turtle", "Bluey's friend").replace(
        "Gentle,",
        "Like Peppa Pig, gentle,",
      ),
      /known character/,
    ],
  ])("refuses %s", async (_n, text, re) => {
    const { parseBible, bibleProblems } = await mod();
    expect(bibleProblems(parseBible(text), "nour", text).join("\n")).toMatch(re);
  });
  it("refuses a bad folder name", async () => {
    const { parseBible, bibleProblems } = await mod();
    expect(bibleProblems(parseBible(GOOD), "Nour Turtle", GOOD).join()).toMatch(/folder name/);
  });
  it("measures contrast like WCAG", async () => {
    const { contrast } = await mod();
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 0);
    expect(contrast("#777", "#777")).toBeCloseTo(1, 5);
  });
});

describe("bible-check.mjs and puppet.mjs", () => {
  const dirWith = (text: string | null) => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "kids-bible-"));
    mkdirSync(path.join(dir, "characters", "nour"), { recursive: true });
    if (text !== null) writeFileSync(path.join(dir, "characters", "nour", "bible.md"), text);
    return dir;
  };
  const run = (script: string, ...a: string[]) =>
    spawnSync("node", [skillFile("video-kids", `scripts/${script}`), ...a], { encoding: "utf8" });
  it("bible-check passes a good bible and names each problem in a bad one", () => {
    const ok = run("bible-check.mjs", dirWith(GOOD));
    expect(ok.status).toBe(0);
    expect(ok.stdout).toContain("Every bible is ready");
    const bad = run("bible-check.mjs", dirWith(GOOD.replace(/- Palette:.*\n/, "")));
    expect(bad.status).toBe(1);
    expect(bad.stdout).toMatch(/ERROR nour: Palette/);
    expect(run("bible-check.mjs", mkdtempSync(path.join(os.tmpdir(), "kids-none-"))).status).toBe(
      1,
    );
  });
  it("scaffold writes a rig that passes its own check and never overwrites", () => {
    const dir = dirWith(GOOD);
    const make = run("puppet.mjs", "scaffold", dir, "--character", "nour");
    expect(make.status).toBe(0);
    const file = path.join(dir, "characters", "nour", "puppet.json");
    const rig = JSON.parse(readFileSync(file, "utf8"));
    expect(rig.name).toBe("nour");
    expect(rig.parts.map((p: Loose) => p.id)).toContain("shell");
    expect(run("puppet.mjs", "check", dir, "--character", "nour").status).toBe(0);
    const again = run("puppet.mjs", "scaffold", dir, "--character", "nour");
    expect(again.status).toBe(1);
    expect(again.stderr).toMatch(/never overwritten/);
    expect(run("puppet.mjs", "scaffold", dir, "--character", "nour", "--force").status).toBe(0);
  });
  it("scaffold draws a shaded rig by default and a flat one with --flat", () => {
    const dir = dirWith(GOOD);
    expect(run("puppet.mjs", "scaffold", dir, "--character", "nour").status).toBe(0);
    const file = path.join(dir, "characters", "nour", "puppet.json");
    const shaded = JSON.parse(readFileSync(file, "utf8"));
    expect(Object.keys(shaded.gradients)).toEqual(
      expect.arrayContaining(["skin", "shadow", "gloss", "eye"]),
    );
    expect(shaded.parts.map((p: Loose) => p.id)).toContain("shadow");
    expect(shaded.parts.find((p: Loose) => p.id === "arm-l").svg).not.toContain("<line");
    for (const shape of ["round", "square", "triangle"]) {
      const d = dirWith(GOOD.replace("round", shape));
      expect(run("puppet.mjs", "scaffold", d, "--character", "nour").status).toBe(0);
      expect(run("puppet.mjs", "check", d, "--character", "nour").status).toBe(0);
      expect(run("puppet.mjs", "sheet", d, "--character", "nour").status).toBe(0);
    }
    expect(
      run("puppet.mjs", "scaffold", dir, "--character", "nour", "--force", "--flat").status,
    ).toBe(0);
    expect(JSON.parse(readFileSync(file, "utf8")).gradients).toBeUndefined();
  });
  it("scaffold varies with the shape language and species", () => {
    const sq = dirWith(
      GOOD.replace("round", "square").replace("Species: turtle", "Species: rabbit"),
    );
    expect(run("puppet.mjs", "scaffold", sq, "--character", "nour").status).toBe(0);
    const rig = JSON.parse(
      readFileSync(path.join(sq, "characters", "nour", "puppet.json"), "utf8"),
    );
    const ids = rig.parts.map((p: Loose) => p.id);
    expect(ids).toContain("ears");
    expect(ids).not.toContain("shell");
    expect(rig.parts.find((p: Loose) => p.id === "body").svg).toContain("<rect");
    const tri = dirWith(GOOD.replace("round", "triangle"));
    expect(run("puppet.mjs", "scaffold", tri, "--character", "nour").status).toBe(0);
  });
  it("scaffold refuses a bad bible; check refuses a hostile rig; sheet draws every mouth", () => {
    const bad = dirWith(GOOD.replace(/- Palette:.*\n/, ""));
    expect(run("puppet.mjs", "scaffold", bad, "--character", "nour").status).toBe(1);
    const dir = dirWith(GOOD);
    run("puppet.mjs", "scaffold", dir, "--character", "nour");
    const file = path.join(dir, "characters", "nour", "puppet.json");
    const rig = JSON.parse(readFileSync(file, "utf8"));
    const sheet = run("puppet.mjs", "sheet", dir, "--character", "nour");
    expect(sheet.status).toBe(0);
    const svg = readFileSync(path.join(dir, "characters", "nour", "sheet.svg"), "utf8");
    for (const v of ["rest", "mbp", "fv", "blink"]) expect(svg).toContain(`>${v}</text>`);
    rig.parts[3].svg = '<image href="https://example.invalid/a.png"/>';
    writeFileSync(file, JSON.stringify(rig));
    const hostile = run("puppet.mjs", "check", dir, "--character", "nour");
    expect(hostile.status).toBe(1);
    expect(hostile.stdout).toMatch(/<image>/);
    expect(run("puppet.mjs", "sheet", dir, "--character", "nour").status).toBe(1);
    expect(existsSync(path.join(dir, "characters", "nour", "puppet.json"))).toBe(true);
  });
  it("usage errors exit 2", () => {
    expect(run("puppet.mjs", "scaffold", ".").status).toBe(2);
    expect(run("puppet.mjs", "scaffold", ".", "--character", "../x").status).toBe(2);
  });
});
