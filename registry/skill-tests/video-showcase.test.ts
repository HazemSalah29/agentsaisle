import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync, utimesSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadScript, skillFile } from "./load";
import { tmp } from "./video-edit-fixtures";

type Loose = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
type Status = {
  showcaseState: (dir: string) => Array<{ id: string; status: string; next: string }>;
};

describe("showcase status", () => {
  const put = (dir: string, rel: string, text = "{}") => {
    mkdirp(path.dirname(path.join(dir, rel)));
    writeFileSync(path.join(dir, rel), text);
  };
  const mkdirp = (d: string) => spawnSync("mkdir", ["-p", d]);
  it("walks from the demo script to the render, naming what is next", async () => {
    const { showcaseState } = await loadScript<Status>("video-showcase", "scripts/status.mjs");
    const dir = tmp("showcase-status");
    expect(showcaseState(dir).map((s) => s.status)).toEqual([
      "todo",
      "todo",
      "todo",
      "todo",
      "todo",
    ]);
    put(dir, "demo.md", "go /");
    put(dir, "capture/capture.webm", "x");
    put(dir, "capture/interaction-log.json");
    expect(
      showcaseState(dir)
        .map((s) => s.status)
        .slice(0, 3),
    ).toEqual(["done", "done", "todo"]);
    put(dir, "video.json", JSON.stringify({ scenes: [{ kind: "screen", props: { zoom: [] } }] }));
    expect(showcaseState(dir)[2].status).toBe("done");
    // A newer demo script makes the capture stale.
    const later = new Date(Date.now() + 60_000);
    utimesSync(path.join(dir, "demo.md"), later, later);
    expect(showcaseState(dir)[1].status).toBe("stale");
  });
});

describe("the skill itself", () => {
  it("has no network code, byte-identical shared files, a short SKILL.md and no secrets read", () => {
    const meta = readFileSync(skillFile("video-showcase", "skill.meta.yaml"), "utf8");
    expect(meta).toContain("network: false");
    expect(meta).toContain("needs_api_keys: []");
    expect(
      readFileSync(skillFile("video-showcase", "SKILL.md"), "utf8").split("\n").length,
    ).toBeLessThanOrEqual(150);
    for (const [f, from] of [
      ["scripts/run.mjs", "video-core"],
      ["scripts/_lib.mjs", "video-core"],
      ["scripts/ffwrap.mjs", "video-edit"],
    ] as const)
      expect(readFileSync(skillFile("video-showcase", f), "utf8")).toBe(
        readFileSync(skillFile(from, f), "utf8"),
      );
    const dir = skillFile("video-showcase", "scripts");
    for (const f of readdirSync(dir).filter((n) => n.endsWith(".mjs"))) {
      const text = readFileSync(path.join(dir, f), "utf8");
      expect(text, f).not.toMatch(/\bfetch\s*\(|node:https?|node:net|\bcurl\b|\bwget\b/);
      expect(text, f).not.toMatch(
        /child_process/.source.replace("child_process", "exec(Sync)?\\("),
      ); // no shell strings
    }
  });
  it("lists the capture script as the only one that imports the browser library", () => {
    const dir = skillFile("video-showcase", "scripts");
    const users = readdirSync(dir).filter(
      (f) => f.endsWith(".mjs") && /playwright/.test(readFileSync(path.join(dir, f), "utf8")),
    );
    expect(users.sort()).toEqual(["_capture.mjs", "capture.mjs"]);
  });
  it("keeps the demo script reference in step with the parser's limits", async () => {
    const { LIMITS } = await loadScript<{ LIMITS: Loose }>("video-showcase", "scripts/_demo.mjs");
    const ref = readFileSync(skillFile("video-showcase", "references/demo-script.md"), "utf8");
    expect(ref).toContain(`At most ${LIMITS.steps} steps`);
    expect(ref).toContain(`up to ${LIMITS.text} characters`);
    expect(ref).toContain(`1 to ${LIMITS.scroll}`);
    expect(ref).toContain(`up to ${LIMITS.wait} s`);
  });
});
