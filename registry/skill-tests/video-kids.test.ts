import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadScript, skillFile } from "./load";
import { GOOD } from "./video-puppet-fixtures";

type State = { name: string; bible: string; rig: string; sheet: boolean; next: string | null };
type Status = { characterState: (dir: string) => State[] };

describe("kids status", () => {
  const put = (dir: string, rel: string, text: string) => {
    mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    writeFileSync(path.join(dir, rel), text);
  };
  it("walks a character from bible to rig to contact sheet", async () => {
    const { characterState } = await loadScript<Status>("video-kids", "scripts/status.mjs");
    const dir = mkdtempSync(path.join(os.tmpdir(), "kids-status-"));
    expect(characterState(dir)).toEqual([]);
    put(dir, "characters/nour/notes.txt", "x");
    expect(characterState(dir)[0]).toMatchObject({ bible: "missing", rig: "missing" });
    put(dir, "characters/nour/bible.md", GOOD);
    const s = characterState(dir)[0];
    expect(s).toMatchObject({ bible: "ok", rig: "missing" });
    expect(s.next).toMatch(/puppet\.mjs scaffold/);
    put(dir, "characters/nour/puppet.json", "not json");
    expect(characterState(dir)[0].rig).toBe("not valid JSON");
    put(dir, "characters/nour/puppet.json", "{}");
    expect(characterState(dir)[0].next).toMatch(/puppet\.mjs check/);
  });
});

describe("the skill itself", () => {
  it("has no network or process code, a short SKILL.md and shared files that match video-core", () => {
    const meta = readFileSync(skillFile("video-kids", "skill.meta.yaml"), "utf8");
    expect(meta).toContain("network: false");
    expect(meta).toContain("needs_api_keys: []");
    expect(
      readFileSync(skillFile("video-kids", "SKILL.md"), "utf8").split("\n").length,
    ).toBeLessThanOrEqual(150);
    expect(readFileSync(skillFile("video-kids", "scripts/_lib.mjs"), "utf8")).toBe(
      readFileSync(skillFile("video-core", "scripts/_lib.mjs"), "utf8"),
    );
    expect(readFileSync(skillFile("video-kids", "scripts/run.mjs"), "utf8")).toBe(
      readFileSync(skillFile("video-core", "scripts/run.mjs"), "utf8"),
    );
    expect(readFileSync(skillFile("video-kids", "scripts/_rig.mjs"), "utf8")).toBe(
      readFileSync(skillFile("video-core", "assets/puppet/rig.mjs"), "utf8"),
    );
    const dir = skillFile("video-kids", "scripts");
    for (const f of readdirSync(dir).filter((n) => n.endsWith(".mjs"))) {
      const text = readFileSync(path.join(dir, f), "utf8");
      expect(text, f).not.toMatch(/\bfetch\s*\(|node:https?|node:net|\bcurl\b|\bwget\b/);
      expect(text, f).not.toMatch(/shell:\s*true|\beval\s*\(|new Function/);
      // Only run.mjs (the allow-listed runner, a copy of video-core's) may start programs.
      if (f !== "run.mjs") expect(text, f).not.toMatch(/node:child_process/);
    }
  });
  it("keeps the rig reference in step with the required parts and mouth shapes", async () => {
    const { REQUIRED, VISEMES } = await loadScript<{ REQUIRED: string[]; VISEMES: string[] }>(
      "video-core",
      "assets/puppet/rig.mjs",
    );
    const ref = readFileSync(skillFile("video-kids", "references/puppet-rig.md"), "utf8");
    for (const id of REQUIRED) expect(ref).toContain(`\`${id}\``);
    const vis = await loadScript<{ VISEMES: string[] }>("video-kids", "scripts/visemes.mjs");
    expect(vis.VISEMES).toEqual(VISEMES);
  });
  it("keeps the acting reference in step with the acts, moods and backdrops", async () => {
    const { ACTS, MOODS } = await loadScript<{ ACTS: string[]; MOODS: string[] }>(
      "video-core",
      "assets/engine/hyperframes/puppet.mjs",
    );
    const { PRESETS } = await loadScript<{ PRESETS: string[] }>(
      "video-core",
      "assets/engine/hyperframes/backdrop.mjs",
    );
    const ref = readFileSync(skillFile("video-kids", "references/acting.md"), "utf8");
    for (const a of ACTS) expect(ref).toContain(`\`${a}\``);
    for (const m of MOODS) expect(ref).toContain(m);
    for (const p of PRESETS) expect(ref).toContain(`\`${p}\``);
  });
});
