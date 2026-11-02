import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseIndex, qaLabel, summarizeQa } from "./demos";
import { loadDemos } from "./demos-fs";

const entry = (over: Record<string, unknown> = {}) => ({
  id: "incident",
  title: "A checkout slowdown",
  type: "Incident replay",
  prompt: "Make an incident replay video from this postmortem.",
  summary: "A timeline.",
  video: "incident.mp4",
  poster: "poster.jpg",
  sources: ["video.json", "facts.md", "../secret"],
  ...over,
});
const report = (over: Record<string, unknown> = {}) =>
  JSON.stringify({
    ok: true,
    facts: { width: 1080, height: 1920, seconds: 35 },
    results: [
      { id: "a", level: "pass" },
      { id: "b", level: "warn" },
    ],
    ...over,
  });

describe("parseIndex", () => {
  it("keeps valid entries and drops bad ones without throwing", () => {
    const raw = JSON.stringify({
      demos: [
        entry(),
        entry({ id: "incident" }), // repeated id
        entry({ id: "Bad Id" }),
        entry({ id: "x", video: "../x.mp4" }),
        entry({ id: "y", title: 5 }),
        null,
      ],
      coming: [{ id: "story", title: "Story", why: "Needs a provider." }, { id: "z" }],
    });
    const { demos, coming } = parseIndex(raw);
    expect(demos.map((d) => d.id)).toEqual(["incident"]);
    expect(demos[0]?.sources).toEqual(["video.json", "facts.md"]); // path tricks removed
    expect(coming.map((c) => c.id)).toEqual(["story"]);
    expect(parseIndex("not json")).toEqual({ demos: [], coming: [] });
    expect(parseIndex("[]")).toEqual({ demos: [], coming: [] });
  });
});

describe("summarizeQa and qaLabel", () => {
  it("counts warnings and failures and words them plainly", () => {
    const q = summarizeQa(report())!;
    expect(q).toMatchObject({ ok: true, warnings: 1, failures: 0, seconds: 35, size: "1080x1920" });
    expect(qaLabel(q)).toBe("QA passed with 1 warning");
    expect(qaLabel({ ...q, warnings: 0 })).toBe("QA passed, no warnings");
    expect(qaLabel({ ...q, ok: false, warnings: 3 })).toBe("QA failed with 3 warnings");
    expect(qaLabel(null)).toBe("No QA report");
    expect(summarizeQa("nope")).toBeNull();
    expect(summarizeQa(JSON.stringify({ ok: true }))).toBeNull();
  });
});

describe("loadDemos", () => {
  const make = () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "demos-"));
    mkdirSync(path.join(dir, "incident", "qa"), { recursive: true });
    writeFileSync(path.join(dir, "incident", "incident.mp4"), "x");
    writeFileSync(path.join(dir, "incident", "video.json"), "{}");
    writeFileSync(path.join(dir, "incident", "qa", "report.json"), report());
    return dir;
  };
  it("lists only demos whose video exists, with QA and the source files that exist", () => {
    const dir = make();
    writeFileSync(
      path.join(dir, "index.json"),
      JSON.stringify({ demos: [entry(), entry({ id: "ghost", video: "ghost.mp4" })] }),
    );
    const { demos } = loadDemos(dir);
    expect(demos.map((d) => d.id)).toEqual(["incident"]);
    expect(demos[0]?.files).toEqual(["video.json"]); // facts.md is not there
    expect(demos[0]?.qa?.warnings).toBe(1);
  });
  it("survives a missing index, a missing report and a broken report", () => {
    expect(loadDemos(path.join(os.tmpdir(), "no-such-demos-dir"))).toEqual({
      demos: [],
      coming: [],
    });
    const dir = make();
    writeFileSync(path.join(dir, "incident", "qa", "report.json"), "{broken");
    writeFileSync(path.join(dir, "index.json"), JSON.stringify({ demos: [entry()] }));
    expect(loadDemos(dir).demos[0]?.qa).toBeNull();
  });
});
