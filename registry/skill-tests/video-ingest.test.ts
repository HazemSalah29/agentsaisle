import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadScript, skillFile } from "./load";

type Loose = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
type Rights = {
  rightsProblems: (o: Loose) => string[];
  urlProblems: (u: string, blocked?: string[]) => string[];
  ytdlpArgs: (o: Loose) => string[];
  verifyLedger: (rows: Loose[], read: (f: string) => string | null) => string[];
};
type Ingest = {
  ingest: (o: Loose) => Loose;
  verify: (dir: string) => Loose;
};
type Runner = { assertAllowed: (c: string, a: string[]) => void };

const proj = (video = true) => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "video-ingest-"));
  if (video)
    writeFileSync(path.join(dir, "video.json"), JSON.stringify({ assets: [], scenes: [] }));
  return dir;
};
const NOW = new Date("2026-11-02T10:00:00Z");
/** A fake yt-dlp: writes the file named by -o, never touches the network. */
const fakeRun =
  (calls: Loose[], { fail = false, version = "2026.01.01" } = {}) =>
  (cmd: string, args: string[]) => {
    calls.push({ cmd, args });
    if (args[0] === "--version") return { status: 0, stdout: `${version}\n`, stderr: "" };
    if (fail) return { status: 1, stdout: "", stderr: "ERROR: boom\n" };
    const tpl = args[args.indexOf("-o") + 1]!.replace("%(ext)s", "mp4");
    writeFileSync(tpl, "FAKE VIDEO BYTES");
    return { status: 0, stdout: "", stderr: "" };
  };
const URL_OK = "https://example.com/watch?v=1";

describe("video-ingest rules", () => {
  it("needs a rights basis, and a note for all but own", async () => {
    const r = await loadScript<Rights>("video-ingest", "scripts/rights.mjs");
    expect(r.rightsProblems({})[0]).toMatch(/required/);
    expect(r.rightsProblems({ rights: "none" })[0]).toMatch(/not accepted/);
    expect(r.rightsProblems({ rights: "own" })).toEqual([]);
    expect(r.rightsProblems({ rights: "cc", note: "short" })[0]).toMatch(/15 characters/);
    expect(r.rightsProblems({ rights: "cc", note: "CC BY 4.0 https://x.example/l" })).toEqual([]);
  });
  it("refuses unsafe and blocked URLs", async () => {
    const r = await loadScript<Rights>("video-ingest", "scripts/rights.mjs");
    const blocked = ["netflix.com"];
    expect(r.urlProblems(URL_OK, blocked)).toEqual([]);
    for (const bad of [
      "http://example.com/a",
      "https://user:pw@example.com/a",
      "https://localhost/a",
      "https://127.0.0.1/a",
      "https://example.com:8443/a",
      "https://www.netflix.com/title/1",
      "file:///etc/passwd",
      "not a url",
    ])
      expect(r.urlProblems(bad, blocked).length, bad).toBeGreaterThan(0);
  });
  it("builds a fixed argument list with the URL last after --", async () => {
    const r = await loadScript<Rights>("video-ingest", "scripts/rights.mjs");
    const a = r.ytdlpArgs({ url: URL_OK, outTemplate: "/p/ingest/clip-1.%(ext)s" });
    expect(a.slice(0, 3)).toEqual(["--ignore-config", "--no-exec", "--no-playlist"]);
    expect(a.slice(-2)).toEqual(["--", URL_OK]);
    expect(a).toContain("--max-filesize");
    const run = await loadScript<Runner>("video-ingest", "scripts/run.mjs");
    expect(() => run.assertAllowed("yt-dlp", a)).not.toThrow();
  });
  it("the ingest runner refuses yt-dlp without the safety flags or with exec/cookies options", async () => {
    const run = await loadScript<Runner>("video-ingest", "scripts/run.mjs");
    const r = await loadScript<Rights>("video-ingest", "scripts/rights.mjs");
    const ok = r.ytdlpArgs({ url: URL_OK, outTemplate: "/p/x.%(ext)s" });
    expect(() => run.assertAllowed("yt-dlp", ["--", URL_OK])).toThrow(/needs/);
    expect(() =>
      run.assertAllowed("yt-dlp", [...ok.slice(0, -2), "--exec", "id", "--", URL_OK]),
    ).toThrow(/not allowed/);
    expect(() =>
      run.assertAllowed("yt-dlp", [...ok.slice(0, -2), "--cookies", "c", "--", URL_OK]),
    ).toThrow(/not allowed/);
    expect(() => run.assertAllowed("yt-dlp", [...ok.slice(0, -1), "http://example.com/"])).toThrow(
      /https/,
    );
  });
});

describe("video-ingest ledger", () => {
  it("records a download, lists the asset and verifies the hash", async () => {
    const m = await loadScript<Ingest>("video-ingest", "scripts/ingest.mjs");
    const dir = proj();
    const calls: Loose[] = [];
    const r = m.ingest({ dir, url: URL_OK, rights: "own", run: fakeRun(calls), now: NOW });
    expect(r.ok, r.problems?.join()).toBe(true);
    expect(r.entry.id).toBe("clip-1");
    expect(r.entry.tool).toBe("yt-dlp 2026.01.01");
    expect(r.entry.date).toBe("2026-11-02T10:00:00.000Z");
    expect(calls.filter((c) => c.args[0] !== "--version")).toHaveLength(1);
    const video = JSON.parse(readFileSync(path.join(dir, "video.json"), "utf8"));
    expect(video.assets[0]).toMatchObject({ id: "clip-1", source: "download", kind: "video" });
    expect(video.assets[0].licence).toMatch(/own work/);
    expect(m.verify(dir).problems).toEqual([]);
    writeFileSync(path.join(dir, "ingest", "clip-1.mp4"), "EDITED");
    expect(m.verify(dir).problems[0]).toMatch(/changed/);
  });
  it("marks analysis-only assets and check.mjs refuses them in scenes", async () => {
    const m = await loadScript<Ingest>("video-ingest", "scripts/ingest.mjs");
    const dir = proj();
    const r = m.ingest({
      dir,
      url: URL_OK,
      rights: "cc",
      note: "CC BY 4.0 https://x.example/l",
      analysisOnly: true,
      run: fakeRun([]),
      now: NOW,
    });
    expect(r.ok).toBe(true);
    const video = JSON.parse(readFileSync(path.join(dir, "video.json"), "utf8"));
    expect(video.assets[0].analysisOnly).toBe(true);
    expect(video.assets[0].attribution).toMatch(/CC BY/);
    const { checkProject } = await loadScript<Loose>("video-core", "scripts/check.mjs");
    video.scenes = [{ id: "s1", kind: "broll", props: { asset: "clip-1" }, narration: "hi" }];
    const problems: string[] = checkProject(video, dir);
    expect(problems.join("\n")).toMatch(/analysisOnly/);
  });
  it("refuses with no rights, a blocked host, a duplicate id or a failed download, writing nothing", async () => {
    const m = await loadScript<Ingest>("video-ingest", "scripts/ingest.mjs");
    const dir = proj();
    const calls: Loose[] = [];
    expect(m.ingest({ dir, url: URL_OK, run: fakeRun(calls) }).ok).toBe(false);
    expect(
      m.ingest({ dir, url: "https://www.netflix.com/x", rights: "own", run: fakeRun(calls) }).ok,
    ).toBe(false);
    expect(calls).toHaveLength(0);
    const bad = m.ingest({ dir, url: URL_OK, rights: "own", run: fakeRun(calls, { fail: true }) });
    expect(bad.ok).toBe(false);
    expect(readdirSync(path.join(dir, "ingest"))).toEqual([]);
    expect(existsSync(path.join(dir, "rights-ledger.json"))).toBe(false);
    expect(
      m.ingest({ dir, url: URL_OK, rights: "own", id: "a", run: fakeRun([]), now: NOW }).ok,
    ).toBe(true);
    expect(
      m.ingest({ dir, url: URL_OK, rights: "own", id: "a", run: fakeRun([]), now: NOW })
        .problems[0],
    ).toMatch(/already used/);
  });
  it("copies a local file with the same ledger and no program run", async () => {
    const m = await loadScript<Ingest>("video-ingest", "scripts/ingest.mjs");
    const dir = proj(false);
    const src = path.join(mkdtempSync(path.join(os.tmpdir(), "src-")), "a.MP4");
    writeFileSync(src, "BYTES");
    const calls: Loose[] = [];
    const r = m.ingest({
      dir,
      file: src,
      rights: "own",
      id: "mine",
      run: fakeRun(calls),
      now: NOW,
    });
    expect(r.ok).toBe(true);
    expect(r.listed).toBe(false);
    expect(calls).toHaveLength(0);
    expect(existsSync(path.join(dir, "ingest", "mine.mp4"))).toBe(true);
    expect(m.ingest({ dir, file: src + ".exe", rights: "own", run: fakeRun([]) }).ok).toBe(false);
  });
  it("the CLI refuses without --rights (exit 2) before any network", () => {
    const dir = proj();
    const r = spawnSync("node", [skillFile("video-ingest", "scripts/ingest.mjs"), dir, URL_OK], {
      encoding: "utf8",
    });
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/--rights is required/);
  });
  it("differs from the shared runner only by the yt-dlp additions, and uses the shared helpers", () => {
    const core = readFileSync(skillFile("video-core", "scripts/run.mjs"), "utf8");
    const mine = readFileSync(skillFile("video-ingest", "scripts/run.mjs"), "utf8");
    expect(mine).toContain('"yt-dlp"');
    expect(core).not.toContain("yt-dlp");
    expect(readFileSync(skillFile("video-ingest", "scripts/_lib.mjs"), "utf8")).toBe(
      readFileSync(skillFile("video-core", "scripts/_lib.mjs"), "utf8"),
    );
  });
});
