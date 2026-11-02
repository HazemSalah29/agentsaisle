import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { skillFile } from "./load";

type Loose = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const run = (args: string[]) =>
  spawnSync(process.execPath, [skillFile("video-doc", "scripts/doc.mjs"), ...args], {
    encoding: "utf8",
    env: { ...process.env, ANTHROPIC_API_KEY: "sk-canary-0000000000000000000000" },
  });
const DOC = `# Pipeline Tool

Fast builds for small teams.

## Why

- Caches every step
- Runs <b>offline</b> by default
- This bullet is much longer than seventy characters so it is skipped whole, never cut short

## Speed

The cold build takes a while. Warm builds are quick.

| Mode | Seconds |
| --- | --- |
| cold | 120 |
| warm | 8 |
| cached | 1 |

\`\`\`
- not a bullet in a fence
\`\`\`
`;
const make = (text = DOC) => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "video-doc-"));
  writeFileSync(path.join(dir, "d.md"), text);
  return dir;
};

describe("video-doc copies", () => {
  it("keeps a byte-identical _lib.mjs", () => {
    expect(readFileSync(skillFile("video-doc", "scripts/_lib.mjs"), "utf8")).toBe(
      readFileSync(skillFile("video-core", "scripts/_lib.mjs"), "utf8"),
    );
  });
});

describe("doc.mjs", () => {
  it("uses whole items only and cites the line of each", () => {
    const dir = make();
    const out = path.join(dir, "o");
    expect(run(["--doc", path.join(dir, "d.md"), "--out", out]).status).toBe(0);
    const facts = readFileSync(path.join(out, "facts.md"), "utf8");
    expect(facts).toContain("Caches every step. Source: d.md:7");
    expect(facts).toContain("Runs offline by default.");
    expect(facts).not.toContain("never cut");
    expect(facts).not.toContain("fence");
    const video = JSON.parse(readFileSync(path.join(out, "video.json"), "utf8")) as Loose;
    for (const s of video.scenes)
      for (const l of s.narration)
        expect(readFileSync(path.join(out, "script.md"), "utf8")).toContain(`[${l}]`);
  });

  it("turns a number table into a chart that names its line", () => {
    const dir = make();
    const out = path.join(dir, "o");
    run(["--doc", path.join(dir, "d.md"), "--out", out]);
    const video = JSON.parse(readFileSync(path.join(out, "video.json"), "utf8")) as Loose;
    const chart = video.scenes.find((s: Loose) => s.kind === "chart");
    expect(chart.props.data).toEqual([
      { label: "cold", value: 120 },
      { label: "warm", value: 8 },
      { label: "cached", value: 1 },
    ]);
    expect(chart.props.title).toMatch(/line \d+/);
  });

  it("refuses PDFs, empty documents and overwriting", () => {
    expect(run(["--doc", "x.pdf", "--out", "/tmp/never"]).stderr).toContain("PDF");
    const dir = make("# Only a title\n");
    expect(run(["--doc", path.join(dir, "d.md"), "--out", path.join(dir, "o")]).status).toBe(2);
    const ok = make();
    const out = path.join(ok, "o");
    run(["--doc", path.join(ok, "d.md"), "--out", out]);
    expect(run(["--doc", path.join(ok, "d.md"), "--out", out]).stderr).toContain("exists");
  });
});
