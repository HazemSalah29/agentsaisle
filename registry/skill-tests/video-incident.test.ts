import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadScript, skillFile } from "./load";

type Loose = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const run = (args: string[]) =>
  spawnSync(process.execPath, [skillFile("video", "scripts/incident.mjs"), ...args], {
    encoding: "utf8",
    env: { ...process.env, ANTHROPIC_API_KEY: "sk-canary-0000000000000000000000" },
  });
const tmp = () => mkdtempSync(path.join(os.tmpdir(), "video-incident-"));
const POST = `# Post

## Timeline

- 14:02 UTC [action] Deploy 2.3 rolled out | api
- 14:05 [failure] Checkout returns 500
- 14:09 [alert] Error rate above 5%
- 14:31 [fix] Rolled back

## Cause

- not a timeline line
`;
const write = (text: string) => {
  const dir = tmp();
  writeFileSync(path.join(dir, "p.md"), text);
  return dir;
};

describe("video-incident copies", () => {
  it("keeps a byte-identical _lib.mjs", () => {
    expect(readFileSync(skillFile("video", "scripts/_lib.mjs"), "utf8")).toBe(
      readFileSync(skillFile("video-core", "scripts/_lib.mjs"), "utf8"),
    );
  });
});

describe("incident.mjs", () => {
  it("builds a timeline with one narration line per event and computed minutes", () => {
    const dir = write(POST);
    const out = path.join(dir, "o");
    const r = run(["--postmortem", path.join(dir, "p.md"), "--out", out, "--title", "Outage"]);
    expect(r.status).toBe(0);
    const video = JSON.parse(readFileSync(path.join(out, "video.json"), "utf8")) as Loose;
    const tl = video.scenes.find((s: Loose) => s.kind === "timeline");
    expect(tl.props.events).toHaveLength(4);
    expect(tl.narration).toHaveLength(4);
    expect(tl.props.events[0]).toMatchObject({ at: "14:02 UTC", type: "action", where: "api" });
    const facts = readFileSync(path.join(out, "facts.md"), "utf8");
    expect(facts).toContain("4 minutes from the first failure to the alert");
    expect(facts).toContain("26 minutes from the first failure to the fix");
  });

  it("refuses events without a time, times going backwards and unknown types", async () => {
    const { parseTimeline } = await loadScript<{ parseTimeline: (t: string) => Loose }>(
      "video",
      "scripts/incident.mjs",
    );
    expect(parseTimeline("## Timeline\n- Checkout broke\n- 10:00 ok\n").problems[0]).toContain(
      "No time",
    );
    expect(parseTimeline("## Timeline\n- 10:30 a\n- 10:10 b\n").problems[0]).toContain("forward");
    expect(parseTimeline("## Timeline\n- 10:30 [oops] a\n").problems[0]).toContain("Unknown type");
    expect(parseTimeline("## Timeline\n- 25:30 a\n").problems[0]).toContain("valid time");
    const dir = write("## Timeline\n- 10:00 only one\n");
    const r = run(["--postmortem", path.join(dir, "p.md"), "--out", path.join(dir, "o")]);
    expect(r.status).toBe(2);
  });

  it("never overwrites", () => {
    const dir = write(POST);
    const out = path.join(dir, "o");
    expect(run(["--postmortem", path.join(dir, "p.md"), "--out", out]).status).toBe(0);
    expect(run(["--postmortem", path.join(dir, "p.md"), "--out", out]).stderr).toContain("exists");
  });
});
