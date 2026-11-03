import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadScript, skillFile } from "./load";

type Loose = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const run = (args: string[]) =>
  spawnSync(
    process.execPath,
    [skillFile("video-calligraphy", "scripts/calligraphy.mjs"), ...args],
    {
      encoding: "utf8",
      env: { ...process.env, ANTHROPIC_API_KEY: "sk-canary-0000000000000000000000" },
    },
  );
const QUOTES =
  "# comment\nالعلم نور والجهل ظلام | Knowledge is light | مثل عربي\nخير الكلام ما قل ودل\n";
const make = (text = QUOTES) => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "video-calligraphy-"));
  writeFileSync(path.join(dir, "q.txt"), text);
  return dir;
};

describe("video-calligraphy copies", () => {
  it("keeps byte-identical copies of the text checks and helpers", () => {
    const same = (a: string, b: string) =>
      expect(readFileSync(skillFile("video-calligraphy", a), "utf8")).toBe(
        readFileSync(skillFile("video-core", b), "utf8"),
      );
    same("scripts/_text.mjs", "assets/calligraphy/text.mjs");
    same("scripts/_lib.mjs", "scripts/_lib.mjs");
  });
});

describe("calligraphy.mjs", () => {
  it("writes one scene per quote, unchanged, that video-core accepts", async () => {
    const dir = make();
    const out = path.join(dir, "o");
    const r = run(["--quotes", path.join(dir, "q.txt"), "--out", out, "--font", "Amiri-Regular"]);
    expect(r.status).toBe(0);
    const video = JSON.parse(readFileSync(path.join(out, "video.json"), "utf8")) as Loose;
    expect(video.scenes.map((s: Loose) => s.props.text)).toEqual([
      "العلم نور والجهل ظلام",
      "خير الكلام ما قل ودل",
    ]);
    expect(video.scenes[0].props).toMatchObject({
      translation: "Knowledge is light",
      by: "مثل عربي",
      font: "Amiri-Regular",
    });
    expect(video.meta).toMatchObject({ lang: "ar", dir: "rtl" });
    const { checkProject } = await loadScript<{
      checkProject: (v: unknown, d: string) => string[];
    }>("video-core", "scripts/check.mjs");
    expect(checkProject(video, out)).toEqual([]);
  });

  it("refuses text without Arabic, pre-shaped letters, too many words and overwriting", () => {
    const d1 = make("Hello world\n");
    expect(run(["--quotes", path.join(d1, "q.txt"), "--out", path.join(d1, "o")]).stderr).toContain(
      "no Arabic",
    );
    const d2 = make("ﺍﻣ\n");
    expect(run(["--quotes", path.join(d2, "q.txt"), "--out", path.join(d2, "o")]).stderr).toContain(
      "pre-shaped",
    );
    const d3 = make(`${"كلمة ".repeat(11)}\n`);
    expect(run(["--quotes", path.join(d3, "q.txt"), "--out", path.join(d3, "o")]).stderr).toContain(
      "words",
    );
    const d4 = make();
    const out = path.join(d4, "o");
    expect(run(["--quotes", path.join(d4, "q.txt"), "--out", out]).status).toBe(0);
    expect(run(["--quotes", path.join(d4, "q.txt"), "--out", out]).stderr).toContain("exists");
    expect(
      run(["--quotes", path.join(d4, "q.txt"), "--out", path.join(d4, "x"), "--font", "a;b"])
        .status,
    ).toBe(2);
  });
});
