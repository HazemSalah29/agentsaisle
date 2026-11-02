import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadScript, skillFile } from "./load";
import { tmp } from "./video-edit-fixtures";

type Loose = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
type Cap = {
  checkUrl: (u: string, o?: Loose) => { origin: string; local: boolean; rights: string };
  sensitiveTarget: (s: Loose) => boolean;
  resolvePlaywright: (home: string, o: Loose) => { entry: string; version: string } | null;
  parseViewport: (v?: string) => { w: number; h: number };
};
type Run = { execute: (argv: string[], o: Loose) => Promise<string[]> };
const cap = () => loadScript<Cap>("video-showcase", "scripts/_capture.mjs");
const capture = () => loadScript<Run>("video-showcase", "scripts/capture.mjs");

describe("capture rules", () => {
  it("records only this machine unless it is your own site with a reason", async () => {
    const { checkUrl } = await cap();
    expect(checkUrl("http://localhost:3000/x?a=1").origin).toBe("http://localhost:3000");
    expect(checkUrl("http://127.0.0.1:5173").local).toBe(true);
    expect(() => checkUrl("https://example.com")).toThrow(/Refused example\.com.*--own-site/);
    expect(() => checkUrl("https://example.com", { own: true, rights: "short" })).toThrow(
      /15 characters/,
    );
    const ok = checkUrl("https://example.com", {
      own: true,
      rights: "I own this site, it is my product",
    });
    expect(ok).toMatchObject({ local: false, rights: "I own this site, it is my product" });
    expect(() => checkUrl("ftp://localhost")).toThrow(/http/);
    expect(() => checkUrl("http://user:pw@localhost:3000")).toThrow(/user name/);
    expect(() => checkUrl("nonsense")).toThrow(/full address/);
  });
  it("never types into secret fields", async () => {
    const { sensitiveTarget } = await cap();
    expect(sensitiveTarget({ css: "#password" })).toBe(true);
    expect(sensitiveTarget({ css: "input[name=card-number]" })).toBe(true);
    expect(sensitiveTarget({ text: "API key" })).toBe(true);
    expect(sensitiveTarget({ css: "#email" })).toBe(false);
  });
  it("looks for the library in ~/.aisle-video/node_modules and checks the package name", async () => {
    const { resolvePlaywright } = await cap();
    const home = "/home/u";
    const files: Loose = {
      "/home/u/.aisle-video/node_modules/playwright-core/package.json": {
        name: "playwright-core",
        version: "1.2.3",
        main: "index.js",
      },
    };
    const r = resolvePlaywright(home, {
      exists: (f: string) => f in files,
      readJson: (f: string) => files[f],
    });
    expect(r).toEqual({
      entry: "/home/u/.aisle-video/node_modules/playwright-core/index.js",
      version: "1.2.3",
    });
    files["/home/u/.aisle-video/node_modules/playwright-core/package.json"].name = "evil";
    expect(
      resolvePlaywright(home, {
        exists: (f: string) => f in files,
        readJson: (f: string) => files[f],
      }),
    ).toBeNull();
    expect(resolvePlaywright(home, { exists: () => false })).toBeNull();
  });
  it("checks the viewport", async () => {
    const { parseViewport } = await cap();
    expect(parseViewport()).toEqual({ w: 1280, h: 720 });
    expect(() => parseViewport("10x10")).toThrow();
    expect(() => parseViewport("wide")).toThrow();
  });
});

/** A stand-in for playwright-core that records what was asked of it. */
function fakePlaywright(calls: string[], opts: Loose = {}) {
  let ms = 0;
  const loc = (what: string) => ({
    first: () => loc(what),
    waitFor: async () => {
      if (opts.missing === what) throw new Error("timeout");
    },
    scrollIntoViewIfNeeded: async () => {},
    boundingBox: async () => ({ x: 640, y: 360, width: 200, height: 50 }),
    pressSequentially: async (t: string) => {
      calls.push(`type:${t}`);
      ms += t.length * 60;
    },
  });
  const page = {
    goto: async (u: string) => void calls.push(`goto:${u}`),
    locator: (c: string) => loc(c),
    getByText: (t: string) => loc(t),
    mouse: {
      move: async () => {},
      click: async () => void calls.push("click"),
      wheel: async (_x: number, y: number) => void calls.push(`wheel:${y}`),
    },
    waitForTimeout: async (n: number) => void (ms += n),
    video: () => ({ path: async () => opts.videoFile }),
  };
  return {
    chromium: {
      launch: async (o: Loose) => {
        calls.push(
          `launch:${Object.keys(o.env).some((k) => /KEY|TOKEN|SECRET/i.test(k)) ? "LEAK" : "clean"}`,
        );
        return {
          newContext: async (c: Loose) => {
            calls.push(`viewport:${c.viewport.width}x${c.viewport.height}`);
            return {
              route: async (_p: string, h: (r: Loose) => unknown) => {
                for (const u of [
                  "http://localhost:3000/app.js",
                  "https://cdn.example.net/x.js",
                  "data:text/plain,a",
                ]) {
                  await h({
                    request: () => ({ url: () => u }),
                    continue: () => calls.push(`allow:${u.slice(0, 13)}`),
                    abort: () => calls.push(`block:${u.slice(0, 13)}`),
                  });
                }
              },
              newPage: async () => page,
              close: async () => {
                // The real library finishes the video file when the context closes.
                mkdirSync(path.dirname(opts.videoFile), { recursive: true });
                writeFileSync(opts.videoFile, "webm");
              },
            };
          },
          close: async () => {},
        };
      },
    },
  };
}

const DEMO = `go /
say intro
click "Start free trial"
type #email "me@example.com"
scroll down 300
wait 1
`;

describe("capture run (with a stand-in browser library)", () => {
  const setup = (demo = DEMO) => {
    const dir = tmp("capture");
    const videoFile = path.join(dir, "out", ".capture-tmp", "v.webm");
    writeFileSync(path.join(dir, "demo.md"), demo);
    return { dir, videoFile };
  };
  const args = (dir: string, extra: string[] = []) => [
    "--url",
    "http://localhost:3000",
    "--script",
    path.join(dir, "demo.md"),
    "--out",
    path.join(dir, "out"),
    ...extra,
  ];

  it("plays the steps, blocks other origins, keeps secrets out of the browser and writes the log", async () => {
    const { dir, videoFile } = setup();
    const calls: string[] = [];
    process.env.TEST_API_KEY_CANARY = "sk-canary";
    const lines = await (
      await capture()
    ).execute(args(dir), { load: async () => fakePlaywright(calls, { videoFile }) });
    delete process.env.TEST_API_KEY_CANARY;
    expect(calls).toContain("launch:clean");
    expect(calls).toContain("viewport:1280x720");
    expect(calls).toContain("goto:http://localhost:3000/");
    expect(calls).toContain("type:me@example.com");
    expect(calls).toContain("wheel:120");
    expect(calls).toContain("allow:http://localh");
    expect(calls).toContain("block:https://cdn.e");
    expect(calls).toContain("allow:data:text/pla");
    expect(lines.join("\n")).not.toContain("sk-canary");
    const log = JSON.parse(readFileSync(path.join(dir, "out", "interaction-log.json"), "utf8"));
    expect(log.viewport).toEqual({ w: 1280, h: 720 });
    expect(log.rights).toMatch(/own work/);
    expect(log.events.map((e: Loose) => e.kind)).toEqual([
      "go",
      "say",
      "click",
      "type",
      "scroll",
      "wait",
    ]);
    expect(log.events[2]).toMatchObject({ kind: "click", x: 0.578, y: 0.535, w: 0.156, h: 0.069 });
    expect(log.events[3].chars).toBe(14);
    expect(log.events[3].end).toBeGreaterThan(log.events[3].t);
    expect(existsSync(path.join(dir, "out", "capture.webm"))).toBe(true);
    expect(existsSync(path.join(dir, "out", ".capture-tmp"))).toBe(false);
  });
  it("names the line when a target is not found and leaves no recording", async () => {
    const { dir, videoFile } = setup();
    await expect(
      (await capture()).execute(args(dir), {
        load: async () => fakePlaywright([], { videoFile, missing: "Start free trial" }),
      }),
    ).rejects.toThrow(/line 3: could not find "Start free trial"/);
    expect(existsSync(path.join(dir, "out", "capture.webm"))).toBe(false);
  });
  it("refuses a secret field, a bad script and a non-local address before opening a browser", async () => {
    const calls: string[] = [];
    const load = async () => fakePlaywright(calls, {});
    const a = setup('go /\ntype #password "x"');
    await expect((await capture()).execute(args(a.dir), { load })).rejects.toThrow(/secret field/);
    const b = setup("go https://evil.example");
    await expect((await capture()).execute(args(b.dir), { load })).rejects.toThrow(
      /demo script has problems/,
    );
    const c = setup();
    await expect(
      (await capture()).execute(
        [
          "--url",
          "https://example.com",
          "--script",
          path.join(c.dir, "demo.md"),
          "--out",
          path.join(c.dir, "out"),
        ],
        { load },
      ),
    ).rejects.toThrow(/Refused example\.com/);
    expect(calls.filter((x) => x.startsWith("launch"))).toEqual(["launch:clean"]); // only the secret-field case got as far as launching
  });
  it("does not replace an earlier capture without --force", async () => {
    const { dir, videoFile } = setup();
    const load = async () => fakePlaywright([], { videoFile });
    await (await capture()).execute(args(dir), { load });
    await expect((await capture()).execute(args(dir), { load })).rejects.toThrow(/already exists/);
  });
});

describe("capture.mjs as a program", () => {
  it("says how to install the library when it is missing, and installs nothing", () => {
    const dir = tmp("capture-home");
    writeFileSync(path.join(dir, "demo.md"), DEMO);
    const r = spawnSync(
      process.execPath,
      [
        skillFile("video-showcase", "scripts/capture.mjs"),
        "--url",
        "http://localhost:3000",
        "--script",
        path.join(dir, "demo.md"),
        "--out",
        path.join(dir, "o"),
      ],
      { encoding: "utf8", env: { ...process.env, HOME: dir, USERPROFILE: dir } },
    );
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/playwright-core is not installed/);
    expect(existsSync(path.join(dir, ".aisle-video"))).toBe(false);
  });
});
