import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadScript, skillFile } from "./load";

type Loose = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const CANARY = "sk-canary-0000000000000000000000";
const run = (args: string[]) =>
  spawnSync(process.execPath, [skillFile("video-session", "scripts/session.mjs"), ...args], {
    encoding: "utf8",
    env: { ...process.env, ANTHROPIC_API_KEY: CANARY },
  });
const tmp = () => mkdtempSync(path.join(os.tmpdir(), "video-session-"));
const line = (o: Loose) => JSON.stringify(o);
const T = (s: number) => new Date(Date.UTC(2026, 0, 5, 10, 0, 0) + s * 1000).toISOString();
const asst = (s: number, content: Loose[]) =>
  line({ type: "assistant", timestamp: T(s), message: { role: "assistant", content } });
const usr = (s: number, content: string | Loose[]) =>
  line({ type: "user", timestamp: T(s), message: { role: "user", content } });
const JSONL = [
  line({ type: "ai-title", aiTitle: "ignored" }),
  usr(0, `Build a todo app. My key is ${CANARY} ok`),
  asst(5, [{ type: "thinking", thinking: "SECRET THOUGHT", signature: "x" }]),
  asst(10, [
    {
      type: "tool_use",
      id: "w1",
      name: "Write",
      input: { file_path: "/Users/jane/app/a.ts", content: "x" },
    },
  ]),
  asst(20, [
    {
      type: "tool_use",
      id: "e1",
      name: "Edit",
      input: {
        file_path: "/Users/jane/app/a.ts",
        old_string: "const a = 1;",
        new_string: "const a = 2;",
      },
    },
  ]),
  asst(30, [{ type: "tool_use", id: "b1", name: "Bash", input: { command: "pnpm vitest run" } }]),
  usr(40, [
    {
      type: "tool_result",
      tool_use_id: "b1",
      is_error: true,
      content: "FAIL leaked body jane@example.com",
    },
  ]),
  asst(50, [{ type: "tool_use", id: "b2", name: "Bash", input: { command: "pnpm vitest run" } }]),
  usr(60, [{ type: "tool_result", tool_use_id: "b2", content: "ok" }]),
  asst(2000, [{ type: "text", text: "All tests pass. The app is ready." }]),
].join("\n");
const write = (text: string) => {
  const dir = tmp();
  writeFileSync(path.join(dir, "s.log"), text);
  return dir;
};

describe("video-session copies", () => {
  it("keeps a byte-identical _lib.mjs", () => {
    expect(readFileSync(skillFile("video-session", "scripts/_lib.mjs"), "utf8")).toBe(
      readFileSync(skillFile("video-core", "scripts/_lib.mjs"), "utf8"),
    );
  });
  it("redacts at least the patterns check.mjs scans for", async () => {
    const src = readFileSync(skillFile("video-core", "scripts/check.mjs"), "utf8");
    const block = /const SECRET_RES = \[([\s\S]*?)\n\];/.exec(src)![1];
    const { SECRET_RES } = await loadScript<{ SECRET_RES: RegExp[] }>(
      "video-session",
      "scripts/session.mjs",
    );
    const sources = (t: string) => [...t.matchAll(/^\s*\/(.*)\/[a-z]*,$/gm)].map((m) => m[1]);
    expect(SECRET_RES.map((r) => r.source)).toEqual(sources(block));
  });
});

describe("session.mjs", () => {
  it("builds moments, collapses idle time and never leaks secrets, paths or tool output", () => {
    const dir = write(JSONL);
    const out = path.join(dir, "o");
    const r = run(["--log", path.join(dir, "s.log"), "--out", out, "--title", "Todo app"]);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("Redacted");
    const all = ["video.json", "script.md", "facts.md"]
      .map((f) => readFileSync(path.join(out, f), "utf8"))
      .join("\n");
    for (const bad of [CANARY, "SECRET THOUGHT", "jane", "leaked body", "/Users"])
      expect(all).not.toContain(bad);
    const video = JSON.parse(readFileSync(path.join(out, "video.json"), "utf8")) as Loose;
    const tl = video.scenes.find((s: Loose) => s.kind === "timeline");
    expect(tl.narration).toHaveLength(tl.props.events.length);
    expect(tl.props.events.length).toBeLessThanOrEqual(8);
    expect(tl.props.events.map((e: Loose) => e.type)).toEqual(
      expect.arrayContaining(["failure", "fix"]),
    );
    expect(tl.props.events.at(-1).at).toBe("01:01");
  });

  it("counts a long idle gap as one second", async () => {
    const { parseSession, activeClock } = await loadScript<{
      parseSession: (t: string) => Loose;
      activeClock: (e: Loose[]) => Loose;
    }>("video-session", "scripts/session.mjs");
    const { events } = parseSession(JSONL);
    const c = activeClock(events);
    expect(c.active).toBe(61);
    expect(c.removed).toBeGreaterThan(1900);
  });

  it("makes a code scene from a small edit and reads a plain log", async () => {
    const dir = write(JSONL);
    const out = path.join(dir, "o");
    run(["--log", path.join(dir, "s.log"), "--out", out]);
    const video = JSON.parse(readFileSync(path.join(out, "video.json"), "utf8")) as Loose;
    expect(video.scenes.find((s: Loose) => s.kind === "code").props).toMatchObject({
      language: "typescript",
    });
    const plain = write(
      "10:00:00 Starting\n10:00:10 $ npm test\n10:00:20 error: 2 failed\n10:00:40 $ npm test\n10:00:50 all passed\n10:01:00 Done, all green.\n",
    );
    const o2 = path.join(plain, "o");
    expect(run(["--log", path.join(plain, "s.log"), "--out", o2]).status).toBe(0);
  });

  it("skips unknown lines and refuses short, untimed, oversized logs and overwrites", () => {
    const dir = write(`${line({ type: "mystery" })}\nnot json\n${usr(0, "Hi")}\n`);
    const r = run(["--log", path.join(dir, "s.log"), "--out", path.join(dir, "o")]);
    expect(r.status).toBe(2);
    const big = write("x".repeat(100 * 1024 * 1024 + 1));
    expect(run(["--log", path.join(big, "s.log"), "--out", path.join(big, "o")]).stderr).toContain(
      "100 MB",
    );
    const ok = write(JSONL);
    const out = path.join(ok, "o");
    expect(run(["--log", path.join(ok, "s.log"), "--out", out]).status).toBe(0);
    expect(run(["--log", path.join(ok, "s.log"), "--out", out]).stderr).toContain("exists");
  });

  it("names checks (vitest), never shows raw commands, and drops repeated passes", async () => {
    const { parseSession, pickMoments } = await loadScript<{
      parseSession: (t: string) => Loose;
      pickMoments: (e: Loose[]) => Loose[];
    }>("video-session", "scripts/session.mjs");
    const log = [
      "10:00:00 Start",
      "10:00:05 $ cd ~/secret-project && sed -n 1,5p notes.txt",
      "10:00:10 $ pnpm vitest run",
      "10:00:20 passed",
      "10:00:30 $ pnpm vitest run",
      "10:00:40 passed",
      "10:00:50 Done, all green.",
    ].join("\n");
    const moments = pickMoments(parseSession(log).events);
    const labels = moments.map((m) => m.label).join("|");
    expect(labels).toContain("Passes: vitest");
    expect(labels.match(/Passes: vitest/g)).toHaveLength(1);
    expect(labels).not.toContain("sed");
    expect(labels).not.toContain("secret-project");
  });

  it("keeps long file names out of the captions", async () => {
    const { pickMoments } = await loadScript<{ pickMoments: (e: Loose[]) => Loose[] }>(
      "video-session",
      "scripts/session.mjs",
    );
    const ev = [
      { t: 0, kind: "prompt", text: "Build it" },
      { t: 1000, kind: "create", file: "glimmering-zooming-acorn.md" },
      { t: 2000, kind: "create", file: "a.ts" },
      { t: 3000, kind: "say", text: "Done." },
    ];
    const labels = pickMoments(ev).map((m) => m.label);
    expect(labels).toContain("Wrote 2 files");
    expect(pickMoments(ev.slice(0, 2).concat(ev.slice(3))).map((m) => m.label)).toContain(
      "Wrote a file",
    );
  });
});
