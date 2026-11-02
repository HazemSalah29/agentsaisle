import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadScript, skillFile } from "./load";

type Loose = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const run = (args: string[]) =>
  spawnSync(process.execPath, [skillFile("video-batch", "scripts/batch.mjs"), ...args], {
    encoding: "utf8",
    env: { ...process.env, ANTHROPIC_API_KEY: "sk-canary-0000000000000000000000" },
  });
const setup = (
  csv: string,
  video: Loose | string = {
    version: 1,
    meta: { title: "Hi {{name}}" },
    scenes: [{ id: "s1", kind: "title", props: { text: "Welcome {{name}}" }, narration: ["l1"] }],
  },
) => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "video-batch-"));
  const t = path.join(dir, "t");
  mkdirSync(path.join(t, "assets"), { recursive: true });
  mkdirSync(path.join(t, "voice"));
  writeFileSync(
    path.join(t, "video.json"),
    typeof video === "string" ? video : JSON.stringify(video),
  );
  writeFileSync(path.join(t, "script.md"), "# T\n\n[l1] Hello {{name}} from {{team}}.\n");
  writeFileSync(path.join(t, "assets", "logo.txt"), "logo");
  writeFileSync(path.join(t, "voice", "l1.wav"), "audio");
  writeFileSync(path.join(dir, "d.csv"), csv);
  return { dir, t, csv: path.join(dir, "d.csv"), out: path.join(dir, "out") };
};
const CSV = 'name,team,secret\nAda,"Ops, Core",x1\nGrace,Dev,x2\n';

describe("video-batch copies", () => {
  it("keeps a byte-identical _lib.mjs", () => {
    expect(readFileSync(skillFile("video-batch", "scripts/_lib.mjs"), "utf8")).toBe(
      readFileSync(skillFile("video-core", "scripts/_lib.mjs"), "utf8"),
    );
  });
});

describe("batch.mjs", () => {
  it("does a dry run by default and prints no cell values", () => {
    const s = setup(CSV);
    const r = run(["--template", s.t, "--csv", s.csv, "--out", s.out]);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("Dry run");
    expect(r.stdout).toContain("Unused columns: secret");
    for (const v of ["Ada", "Grace", "x1", "Ops"]) expect(r.stdout).not.toContain(v);
    expect(existsSync(s.out)).toBe(false);
  });

  it("writes one project per row, fills text only, copies assets but not voice or the CSV", () => {
    const s = setup(CSV);
    const r = run(["--template", s.t, "--csv", s.csv, "--out", s.out, "--apply"]);
    expect(r.status).toBe(0);
    const v1 = JSON.parse(readFileSync(path.join(s.out, "row-001", "video.json"), "utf8")) as Loose;
    expect(v1.scenes[0].props.text).toBe("Welcome Ada");
    expect(readFileSync(path.join(s.out, "row-001", "script.md"), "utf8")).toContain(
      "Hello Ada from Ops, Core.",
    );
    expect(readFileSync(path.join(s.out, "row-002", "script.md"), "utf8")).toContain(
      "Hello Grace from Dev.",
    );
    expect(existsSync(path.join(s.out, "row-001", "assets", "logo.txt"))).toBe(true);
    expect(existsSync(path.join(s.out, "row-001", "voice"))).toBe(false);
    expect(existsSync(path.join(s.out, "d.csv"))).toBe(false);
  });

  it("cannot be broken out of by a cell", () => {
    const s = setup('name,team\n"Eve"",""id"":""x","a"\n');
    run(["--template", s.t, "--csv", s.csv, "--out", s.out, "--apply"]);
    const v = JSON.parse(readFileSync(path.join(s.out, "row-001", "video.json"), "utf8")) as Loose;
    expect(Object.keys(v.scenes[0].props)).toEqual(["text"]);
  });

  it("refuses bad input", () => {
    const s = setup("name\nAda\n");
    expect(run(["--template", s.t, "--csv", s.csv, "--out", s.out]).stderr).toContain("team");
    const e = setup("name,team\nAda,\n");
    expect(run(["--template", e.t, "--csv", e.csv, "--out", e.out]).stderr).toContain("empty");
    const n = setup(CSV, { version: 1, scenes: [] });
    writeFileSync(path.join(n.t, "script.md"), "# plain\n");
    expect(run(["--template", n.t, "--csv", n.csv, "--out", n.out]).stderr).toContain(
      "no {{column}}",
    );
    const b = setup("Name,team\nAda,x\n");
    expect(run(["--template", b.t, "--csv", b.csv, "--out", b.out]).status).toBe(2);
  });

  it("cleans only folders it made", () => {
    const s = setup(CSV);
    run(["--template", s.t, "--csv", s.csv, "--out", s.out, "--apply"]);
    expect(run(["--clean", s.t]).status).toBe(2);
    expect(existsSync(s.t)).toBe(true);
    expect(run(["--clean", s.out]).status).toBe(0);
    expect(existsSync(s.out)).toBe(false);
  });

  it("parses quoted CSV", async () => {
    const { parseCsv } = await loadScript<{ parseCsv: (t: string) => string[][] }>(
      "video-batch",
      "scripts/batch.mjs",
    );
    expect(parseCsv('a,b\r\n"x, ""y""",z\r\n\r\n')).toEqual([
      ["a", "b"],
      ['x, "y"', "z"],
    ]);
    expect(() => parseCsv('a\n"open')).toThrow("quote");
  });
});
