import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadScript } from "./load";

type Adopt = { adopt: (o: Record<string, unknown>) => { id: string; path: string; kind: string } };
const tmp = () => mkdtempSync(path.join(os.tmpdir(), "video-adopt-"));
const mp4 = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from("ftypisom"), Buffer.alloc(40)]);

describe("video-generate adopt", () => {
  it("lists a real clip as aiGenerated and logs the credits as reported", async () => {
    const { adopt } = await loadScript<Adopt>("video-generate", "scripts/adopt.mjs");
    const dir = tmp();
    writeFileSync(path.join(dir, "video.json"), JSON.stringify({ assets: [] }));
    const f = path.join(tmp(), "clip.mp4");
    writeFileSync(f, mp4);
    const r = adopt({ dir, file: f, id: "hero", tool: "higgsfield", credits: "12" });
    expect(r.kind).toBe("video");
    const v = JSON.parse(readFileSync(path.join(dir, "video.json"), "utf8"));
    expect(v.assets[0]).toMatchObject({ id: "hero", aiGenerated: true, source: "generated" });
    const log = JSON.parse(readFileSync(path.join(dir, "generation-log.jsonl"), "utf8").trim());
    expect(log).toMatchObject({ provider: "connector", costUsd: 0, credits: 12 });
  });

  it("refuses links, fake files, odd ids and a missing tool", async () => {
    const { adopt } = await loadScript<Adopt>("video-generate", "scripts/adopt.mjs");
    const dir = tmp();
    const bad = path.join(tmp(), "x.mp4");
    writeFileSync(bad, "not a video at all, just text");
    expect(() => adopt({ dir, file: bad, id: "a", tool: "t" })).toThrow(/not a real/);
    expect(() => adopt({ dir, file: "https://example.com/a.mp4", id: "a", tool: "t" })).toThrow(
      /not a link/,
    );
    expect(() => adopt({ dir, file: bad, id: "../a", tool: "t" })).toThrow(/--id/);
    expect(() => adopt({ dir, file: bad, id: "a" })).toThrow(/--tool/);
  });
});
