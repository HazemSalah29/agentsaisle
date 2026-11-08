import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadScript, skillFile } from "./load";

type Studio = {
  templateFiles: () => string[];
  initStudio: (t: string) => { created: string[]; kept: string[] };
  doctor: (c: Array<[string, string, () => boolean]>) => Array<{ name: string; fix: string }>;
};
const load = () => loadScript<Studio>("animate-reel", "scripts/studio.mjs");
const tmp = () => mkdtempSync(path.join(os.tmpdir(), "animate-reel-"));
const official = path.dirname(skillFile("animate-reel", "SKILL.md"));
const root = path.dirname(official);

describe("animate-reel studio", () => {
  it("creates the studio from the template and never overwrites", async () => {
    const { initStudio, templateFiles } = await load();
    expect(templateFiles()).toEqual(
      expect.arrayContaining([
        "CLAUDE.md",
        "00 - notes/context/declared/brand.md",
        "03 - export/.keep",
      ]),
    );
    const dir = tmp();
    const a = initStudio(dir);
    expect(a.kept).toEqual([]);
    writeFileSync(path.join(dir, "00 - notes/context/declared/brand.md"), "mine");
    const b = initStudio(dir);
    expect(b.created).toEqual([]);
    expect(readFileSync(path.join(dir, "00 - notes/context/declared/brand.md"), "utf8")).toBe(
      "mine",
    );
  });

  it("the template holds no personal data and no leftover kit paths", async () => {
    const { templateFiles } = await load();
    for (const f of templateFiles()) {
      const t = readFileSync(path.join(official, "assets/studio", f), "utf8");
      expect(t, f).not.toMatch(/\.kit\/|SETUP\.md|barakahraaz/);
    }
    const brand = readFileSync(
      path.join(official, "assets/studio/00 - notes/context/declared/brand.md"),
      "utf8",
    );
    expect(brand).toMatch(/page_name:\s*(#.*)?\n/);
  });

  it("doctor lists only the probes that fail", async () => {
    const { doctor } = await load();
    const r = doctor([
      ["a", "fix a", () => true],
      ["b", "fix b", () => false],
    ]);
    expect(r).toEqual([{ name: "b", fix: "fix b" }]);
  });

  it("runs when started through a symlinked folder", () => {
    const base = tmp();
    const link = path.join(base, "linked");
    symlinkSync(official, link);
    const target = path.join(base, "studio");
    const r = spawnSync("node", [path.join(link, "scripts/studio.mjs"), "init", target], {
      encoding: "utf8",
    });
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/studio: \d+ created/);
    expect(existsSync(path.join(target, "CLAUDE.md"))).toBe(true);
  });

  it("usage error exits 2", () => {
    const r = spawnSync("node", [skillFile("animate-reel", "scripts/studio.mjs")], {
      encoding: "utf8",
    });
    expect(r.status).toBe(2);
  });
});

describe("animate-reel packs", () => {
  it("every SFX Kit sound in sounds.json is in exactly one pack", () => {
    const sounds = JSON.parse(
      readFileSync(path.join(official, "assets/sfx-kit/sounds.json"), "utf8"),
    ).sounds as Array<{
      id: string;
      file: string;
    }>;
    expect(sounds).toHaveLength(320);
    for (const s of sounds) {
      const hits = [1, 2, 3, 4].filter((n) =>
        existsSync(path.join(root, `animate-reel-sfx-${n}`, "assets", "sfx-kit", s.file)),
      );
      expect(hits, s.id).toHaveLength(1);
    }
  });

  it("every pack stays under the CLI's 20 MB archive limit and ships the CC0 licence", () => {
    const size = (d: string): number =>
      readdirSync(d, { withFileTypes: true }).reduce(
        (n, e) =>
          n +
          (e.isDirectory() ? size(path.join(d, e.name)) : readFileSyncSize(path.join(d, e.name))),
        0,
      );
    const readFileSyncSize = (p: string) => readFileSync(p).length;
    for (const name of [
      "animate-reel",
      "animate-reel-sounds",
      "animate-reel-sfx-1",
      "animate-reel-sfx-2",
      "animate-reel-sfx-3",
      "animate-reel-sfx-4",
    ]) {
      expect(size(path.join(root, name)), name).toBeLessThan(20 * 1024 * 1024);
    }
    for (const n of [1, 2, 3, 4])
      expect(
        readFileSync(path.join(root, `animate-reel-sfx-${n}`, "assets/sfx-kit/LICENSE"), "utf8"),
      ).toMatch(/CC0/);
  });

  it("mix.py finds sounds in the packs and the download script is gone", () => {
    const mix = readFileSync(path.join(official, "scripts/mix.py"), "utf8");
    expect(mix).toContain("animate-reel-sfx-");
    expect(mix).toContain("animate-reel-sounds");
    expect(existsSync(path.join(official, "scripts/get-sounds.py"))).toBe(false);
  });

  it("the reel skills reference each other by their new names only", () => {
    mkdirSync(tmp(), { recursive: true });
    const walk = (d: string): string[] =>
      readdirSync(d, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory()
          ? e.name === "sfx-kit" || e.name === "vendor"
            ? []
            : walk(path.join(d, e.name))
          : [path.join(d, e.name)],
      );
    for (const name of readdirSync(root).filter(
      (n) => n.startsWith("animate-reel") && !/-sfx-/.test(n),
    )) {
      for (const f of walk(path.join(root, name)).filter((p) =>
        /\.(md|mjs|py|sh|js|html)$/.test(p),
      )) {
        expect(readFileSync(f, "utf8"), f).not.toMatch(
          /mg-reel|mg-carousel|barakahraaz|\.kit\/creator/,
        );
      }
    }
  });
});
