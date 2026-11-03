import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, utimesSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ffPath, haveFF, makeClip, tmp } from "./video-edit-fixtures";
import { loadScript, skillFile } from "./load";

type Loose = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
type Copy = {
  copyProblems: (c: Loose, p: Loose, s: string) => string[];
  chapterList: (v: Loose, t: Loose) => { chapters: Loose[]; text?: string; note?: string };
  sceneName: (s: Loose) => string | null;
  kidsAnswer: (b: Loose) => string;
  disclosureNote: (o: Loose) => string;
};
type Pub = {
  gateProblems: (d: string, n: string, o?: string) => string[];
  aspectName: (w: number, h: number) => string | null;
  loadPlatforms: () => Loose;
};
const copy = () => loadScript<Copy>("video-publish", "scripts/copycheck.mjs");
const pub = () => loadScript<Pub>("video-publish", "scripts/publish.mjs");
const platforms = JSON.parse(
  readFileSync(skillFile("video-publish", "assets/platforms.json"), "utf8"),
).platforms as Loose;
const SRC =
  "Ten requests got through a limit of five. A fixed window of 5 requests a second lets 10 through. 0.2 s apart.";

describe("publish text checks", () => {
  it("passes good copy and counts YouTube descriptions in bytes", async () => {
    const { copyProblems } = await copy();
    const ok = {
      title: "How a rate limit works",
      description: "Ten requests got through a limit of five.",
      hashtags: ["#ratelimit", "#api"],
    };
    expect(copyProblems(ok, platforms.shorts, SRC)).toEqual([]);
    const arabic = { ...ok, description: "ا".repeat(2600) }; // 2,600 characters, 5,200 bytes
    expect(copyProblems(arabic, platforms.youtube, SRC).join()).toContain("5200 bytes");
    expect(copyProblems(arabic, platforms.linkedin, SRC)).toEqual([]);
  });

  it("refuses a long title, angle brackets, placeholders, bad and repeated hashtags", async () => {
    const { copyProblems } = await copy();
    const bad = {
      title: "x".repeat(101),
      description: "see <b>this</b> TODO",
      hashtags: ["tag", "#ok", "#OK", "#a b"],
    };
    const p = copyProblems(bad, platforms.shorts, SRC).join("\n");
    for (const part of [
      "title: 101 characters",
      "< and >",
      'placeholder "TODO"',
      "not a hashtag",
      "used twice",
    ])
      expect(p).toContain(part);
    expect(
      copyProblems(
        { title: "t", description: "d", hashtags: Array.from({ length: 31 }, (_, i) => `#t${i}`) },
        platforms.reels,
        SRC,
      ).join(),
    ).toContain("at most 30");
    expect(copyProblems({ title: "", description: "d" }, platforms.youtube, SRC).join()).toContain(
      "title: required",
    );
    expect(copyProblems(null as unknown as Loose, platforms.youtube, SRC)).toHaveLength(1);
  });

  it("never lets an invented number through, but allows numbers from the script and chapter times", async () => {
    const { copyProblems } = await copy();
    const base = { title: "t", hashtags: [] };
    expect(
      copyProblems(
        { ...base, description: "Ten of 5 requests, 0.2 s apart" },
        platforms.shorts,
        SRC,
      ),
    ).toEqual([]);
    expect(
      copyProblems({ ...base, description: "Cuts load by 40%" }, platforms.shorts, SRC).join(),
    ).toContain("number 40 does not appear");
    expect(
      copyProblems(
        { ...base, description: "Intro\n\n0:00 Start\n1:30 Next" },
        platforms.youtube,
        SRC,
      ),
    ).toEqual([]);
    expect(
      copyProblems({ ...base, description: "1,000 users" }, platforms.shorts, "we said 1000 users"),
    ).toEqual([]);
  });

  it("makes chapters of at least 10 s, first at 0:00, at least three, or none", async () => {
    const { chapterList } = await copy();
    const video = {
      scenes: [
        { props: { text: "Hook" } },
        { props: { heading: "Idea" } },
        { props: { title: "Proof" } },
        { props: { items: ["x"] } },
      ],
    };
    const timing = (starts: number[], total: number) => ({
      totalSeconds: total,
      scenes: starts.map((start) => ({ start })),
    });
    const ok = chapterList(video, timing([0, 12, 25, 40], 55));
    expect(ok.text).toBe("0:00 Hook\n0:12 Idea\n0:25 Proof\n0:40 Part 4");
    expect(chapterList(video, timing([0, 5, 12, 26], 40)).text).toBe(
      "0:00 Hook\n0:12 Proof\n0:26 Part 3",
    );
    const few = chapterList(video, timing([0, 4, 8, 12], 16));
    expect(few.chapters).toEqual([]);
    expect(few.note).toMatch(/needs 3/);
  });

  it("answers the kids question from the audience, and writes the disclosure note with the override", async () => {
    const { kidsAnswer, disclosureNote } = await copy();
    expect(kidsAnswer({ audience: "kids 6-9" })).toBe("yes");
    expect(kidsAnswer({ audience: "developers who install skills" })).toBe("no");
    expect(kidsAnswer({ audience: "everyone" })).toBe("ask");
    expect(kidsAnswer({})).toBe("ask");
    const n = disclosureNote({
      platform: platforms.shorts,
      credits: { guidance: ["The narration is a computer-generated voice."] },
      kids: "ask",
      override: "loudness is fine, checked by ear",
    });
    expect(n).toContain("# Disclosure for YouTube Shorts");
    expect(n).toContain("Decide: the audience");
    expect(n).toContain("computer-generated voice");
    expect(n).toContain("QA override");
    expect(disclosureNote({ platform: platforms.reels, credits: null, kids: "no" })).not.toContain(
      "Made for kids",
    );
  });

  it("says the platform numbers are unverified and uses the smaller of disagreeing limits", () => {
    const j = JSON.parse(readFileSync(skillFile("video-publish", "assets/platforms.json"), "utf8"));
    expect(j.verified).toBe(false);
    expect(j.note).toContain("TODO(verify)");
    expect(j.platforms.reels.maxSeconds).toBe(90);
    for (const p of Object.values(j.platforms) as Loose[])
      expect(p.unverified.length).toBeGreaterThan(0);
  });
});

/** A finished-looking project: 9:16 render, passing QA, credits, text. */
function project(
  over: {
    qa?: boolean | null;
    staleQa?: boolean;
    noCredits?: boolean;
    copy?: Loose | null;
    format?: string;
    size?: string;
  } = {},
) {
  const dir = path.join(tmp("pub"), "demo");
  mkdirSync(path.join(dir, "out"), { recursive: true });
  mkdirSync(path.join(dir, "qa"));
  mkdirSync(path.join(dir, "publish"));
  const size = over.size ?? "360x640";
  makeClip(
    path.join(dir, "out", "demo.mp4"),
    [
      { color: "0x303030", seconds: 2 },
      { color: "0x606060", seconds: 2 },
    ],
    { size },
  );
  const t = 1_800_000_000;
  const put = (rel: string, body: string | Loose, at: number) => {
    writeFileSync(path.join(dir, rel), typeof body === "string" ? body : JSON.stringify(body));
    utimesSync(path.join(dir, rel), at, at);
  };
  put(
    "video.json",
    {
      version: 1,
      meta: {
        title: "Demo",
        type: "explainer",
        format: over.format ?? "reel-9x16",
        fps: 30,
        lang: "en",
      },
      scenes: [
        { id: "a", kind: "title", props: { text: "Hook" } },
        { id: "b", kind: "title", props: { text: "Idea" } },
      ],
    },
    t,
  );
  put("timing.json", { totalSeconds: 4, scenes: [{ start: 0 }, { start: 2 }] }, t);
  utimesSync(path.join(dir, "out", "demo.mp4"), t + 10, t + 10);
  if (!over.noCredits)
    put("credits.json", { guidance: ["No synthetic-content label needed."] }, t + 5);
  if (over.qa !== null)
    put("qa/report.json", { ok: over.qa ?? true, results: [] }, over.staleQa ? t + 5 : t + 20);
  put(
    "brief.json",
    { title: "Demo", audience: "developers", promise: "Five requests, ten through." },
    t,
  );
  put("script.md", "[l1] Ten requests got through a limit of five.", t);
  put("facts.md", "- [f1] 5 requests a second.", t);
  put("captions.srt", "1\n00:00:00,000 --> 00:00:02,000\nHello\n", t);
  put("CREDITS.txt", "Credits: Demo", t);
  if (over.copy !== null)
    put(
      "publish/copy.json",
      over.copy ?? {
        title: "Ten through a limit of five",
        description: "Ten requests got through a limit of five, 5 a second.",
        hashtags: ["#api", "#ratelimit"],
      },
      t,
    );
  return dir;
}

describe("publish gate", () => {
  it("refuses without QA, with a failed or stale QA, and without credits", async () => {
    const { gateProblems } = await pub();
    expect(gateProblems(project({ qa: null }), "demo")[0]).toContain("qa/report.json is missing");
    expect(gateProblems(project({ qa: false }), "demo").join()).toContain("QA failed");
    expect(gateProblems(project({ staleQa: true }), "demo").join()).toContain(
      "newer than the last QA",
    );
    expect(gateProblems(project({ noCredits: true }), "demo").join()).toContain(
      "credits.json is missing",
    );
    expect(gateProblems(project(), "demo")).toEqual([]);
    expect(gateProblems(tmp("empty"), "x")[0]).toContain("no final render");
  });

  it("lets a failed QA through only with a reason of 15 characters or more", async () => {
    const { gateProblems } = await pub();
    const d = project({ qa: false });
    expect(gateProblems(d, "demo", "ok")).toEqual([
      "--override-qa needs a reason of at least 15 characters",
    ]);
    expect(gateProblems(d, "demo", "reviewed by hand, loudness is fine")).toEqual([]);
    expect(
      gateProblems(project({ noCredits: true }), "demo", "a long enough reason here")[0],
    ).toContain("credits.json"); // credits cannot be overridden
  });

  it("names the shape of a picture", async () => {
    const { aspectName } = await pub();
    expect(aspectName(1080, 1920)).toBe("9:16");
    expect(aspectName(1920, 1080)).toBe("16:9");
    expect(aspectName(1000, 1000)).toBe("1:1");
    expect(aspectName(1000, 700)).toBeNull();
  });
});

describe.skipIf(!haveFF)("publish on a real project", () => {
  const cli = (dir: string, ...args: string[]) =>
    spawnSync(process.execPath, [skillFile("video-publish", "scripts/publish.mjs"), dir, ...args], {
      encoding: "utf8",
      env: { ...process.env, PATH: ffPath, ANTHROPIC_API_KEY: "sk-canary-0000000000000000000000" },
    });

  it("writes a pack per platform with hashes that match, and says nothing was uploaded", () => {
    const dir = project();
    const r = cli(dir, "--platforms", "shorts,reels", "--no-card");
    expect(r.status, r.stdout + r.stderr).toBe(0);
    expect(r.stdout).toContain("Nothing was uploaded");
    expect(r.stdout.split("\n").length).toBeLessThanOrEqual(40);
    expect(r.stdout + r.stderr).not.toContain("sk-canary");
    const manifest = JSON.parse(readFileSync(path.join(dir, "exports", "publish.json"), "utf8"));
    expect(manifest.uploaded).toBe(false);
    expect(manifest.platforms.map((p: Loose) => p.platform)).toEqual(["shorts", "reels"]);
    for (const p of manifest.platforms)
      for (const f of p.files)
        expect(
          createHash("sha256")
            .update(readFileSync(path.join(dir, "exports", f.path)))
            .digest("hex"),
        ).toBe(f.sha256);
    const names = manifest.platforms[0].files.map((f: Loose) => path.basename(f.path));
    for (const n of [
      "video.mp4",
      "thumbnail-1.jpg",
      "thumbnail-2.jpg",
      "thumbnail-3.jpg",
      "copy.json",
      "captions.srt",
      "CREDITS.txt",
      "disclosure.md",
    ])
      expect(names).toContain(n);
    expect(readFileSync(path.join(dir, "exports", "shorts", "disclosure.md"), "utf8")).toContain(
      "Made for kids",
    );
  });

  it("refuses the wrong shape, bad text, an existing pack, and unknown platforms, writing nothing", () => {
    const dir = project();
    const wrong = cli(dir, "--platforms", "youtube", "--no-card");
    expect(wrong.status).toBe(1);
    expect(wrong.stdout).toContain("takes 16:9");
    const unknown = cli(dir, "--platforms", "myspace");
    expect(unknown.stdout).toContain("unknown platform");
    const badCopy = project({
      copy: { title: "Cuts latency by 73%", description: "d", hashtags: [] },
    });
    const b = cli(badCopy, "--platforms", "shorts", "--no-card");
    expect(b.status).toBe(1);
    expect(b.stdout).toContain("number 73 does not appear");
    expect(existsSync(path.join(badCopy, "exports"))).toBe(false);
    expect(cli(dir, "--platforms", "shorts", "--no-card").status).toBe(0);
    const again = cli(dir, "--platforms", "shorts", "--no-card");
    expect(again.status).toBe(1);
    expect(again.stdout).toContain("--force");
    expect(cli(dir, "--platforms", "shorts", "--no-card", "--force").status).toBe(0);
    expect(cli(project({ copy: null }), "--platforms", "shorts").stdout).toContain(
      "publish/copy.json is missing",
    );
    expect(cli(tmp("none"), "--platforms", "shorts").status).toBe(1);
  });

  it("records an override in the manifest and the disclosure note", () => {
    const dir = project({ qa: false });
    expect(cli(dir, "--platforms", "shorts", "--no-card").status).toBe(1);
    const r = cli(
      dir,
      "--platforms",
      "shorts",
      "--no-card",
      "--override-qa",
      "checked the loudness by ear, fine",
    );
    expect(r.status, r.stdout + r.stderr).toBe(0);
    expect(r.stdout).toContain("QA was overridden");
    expect(
      JSON.parse(readFileSync(path.join(dir, "exports", "publish.json"), "utf8")).qa.overridden,
    ).toBe("checked the loudness by ear, fine");
    expect(readFileSync(path.join(dir, "exports", "shorts", "disclosure.md"), "utf8")).toContain(
      "QA override",
    );
  });
});

describe("the skill itself", () => {
  it("has no network access, byte-identical runner and file guard, and a short SKILL.md", () => {
    expect(readFileSync(skillFile("video-publish", "skill.meta.yaml"), "utf8")).toContain(
      "network: false",
    );
    expect(
      readFileSync(skillFile("video-publish", "SKILL.md"), "utf8").split("\n").length,
    ).toBeLessThanOrEqual(150);
    for (const [f, from] of [
      ["scripts/run.mjs", "video-core"],
      ["scripts/_lib.mjs", "video-core"],
      ["scripts/ffwrap.mjs", "video-showcase"],
    ] as const)
      expect(readFileSync(skillFile("video-publish", f), "utf8")).toBe(
        readFileSync(skillFile(from, f), "utf8"),
      );
  });
});
