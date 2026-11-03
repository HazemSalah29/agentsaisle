import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadScript, skillFile } from "./load";

type Init = {
  DIRS: string[];
  GITIGNORE: string[];
  templateFiles: () => string[];
  initStudio: (t: string) => { created: string[]; kept: string[]; ignored: string[] };
};
const load = () => loadScript<Init>("video", "scripts/init.mjs");
const tmp = () => mkdtempSync(path.join(os.tmpdir(), "video-init-"));

describe("video init", () => {
  it("creates the layout, the templates and the .gitignore lines", async () => {
    const { initStudio, DIRS, templateFiles } = await load();
    const dir = tmp();
    const r = initStudio(dir);
    for (const d of DIRS) expect(existsSync(path.join(dir, d))).toBe(true);
    for (const f of ["CLAUDE.md", "brand/brand.json"])
      expect(existsSync(path.join(dir, f))).toBe(true);
    expect(templateFiles()).toEqual(expect.arrayContaining(["CLAUDE.md", "brand/brand.json"]));
    expect(r.kept).toEqual([]);
    expect(readFileSync(path.join(dir, ".gitignore"), "utf8")).toBe(
      "projects/*/cache/\nprojects/*/out/\nexports/\n",
    );
    expect(JSON.parse(readFileSync(path.join(dir, "brand/brand.json"), "utf8")).colors.bg).toMatch(
      /^#/,
    );
  });

  it("is idempotent and never overwrites a file the user edited", async () => {
    const { initStudio } = await load();
    const dir = tmp();
    initStudio(dir);
    writeFileSync(path.join(dir, "CLAUDE.md"), "my own rules\n");
    const second = initStudio(dir);
    expect(second.created).toEqual([]);
    expect(second.ignored).toEqual([]);
    expect(second.kept).toContain("CLAUDE.md");
    expect(readFileSync(path.join(dir, "CLAUDE.md"), "utf8")).toBe("my own rules\n");
    expect(readFileSync(path.join(dir, ".gitignore"), "utf8").match(/exports\//g)).toHaveLength(1);
  });

  it("adds only the missing .gitignore lines and keeps the existing ones", async () => {
    const { initStudio } = await load();
    const dir = tmp();
    writeFileSync(path.join(dir, ".gitignore"), "node_modules\nexports/");
    initStudio(dir);
    expect(readFileSync(path.join(dir, ".gitignore"), "utf8")).toBe(
      "node_modules\nexports/\nprojects/*/cache/\nprojects/*/out/\n",
    );
  });

  it("ships a studio CLAUDE.md that bans keys in the folder", () => {
    const md = readFileSync(skillFile("video", "assets/studio/CLAUDE.md"), "utf8");
    expect(md).toMatch(/Never put API keys in this folder/);
  });

  it("keeps its helper file identical to video-core's", () => {
    const read = (skill: string) => readFileSync(skillFile(skill, "scripts/_lib.mjs"), "utf8");
    expect(read("video")).toBe(read("video-core"));
  });

  it("runs as a process, prints a short summary and exits 0 twice", () => {
    const dir = tmp();
    const run = () =>
      spawnSync("node", [skillFile("video", "scripts/init.mjs"), dir], { encoding: "utf8" });
    const a = run();
    expect(a.status).toBe(0);
    expect(a.stdout).toMatch(/Studio ready in .*created, 0 kept/);
    expect(a.stdout.split("\n").length).toBeLessThanOrEqual(41);
    expect(run().stdout).toMatch(/0 created/);
  });
});
