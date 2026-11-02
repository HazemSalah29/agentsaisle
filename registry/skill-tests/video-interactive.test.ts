import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadLib, loadScript, skillFile } from "./load";

type Loose = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
type Br = {
  branchProblems: (d: unknown, ids: string[]) => string[];
  resolveBranches: (d: Loose, scenes: Loose[]) => Loose[];
};
const br = () => loadScript<Br>("video-core", "assets/interactive/branches.mjs");
const IDS = ["s1", "s2", "s3", "s4", "s5", "s6", "s7"];
const good = (): Loose => ({
  version: 1,
  branches: [
    {
      id: "pick",
      after: "s2",
      question: "Which one?",
      options: [
        { label: "A", from: "s3", to: "s4" },
        { label: "B", from: "s5", to: "s6" },
      ],
      then: "s7",
    },
  ],
});
const scenes = IDS.map((id, i) => ({ id, start: i * 4, end: i * 4 + 4 }));

describe("video-interactive copies", () => {
  it("keeps byte-identical copies of the branch checks and helpers", () => {
    const same = (a: string, b: string) =>
      expect(readFileSync(skillFile("video", a), "utf8")).toBe(
        readFileSync(skillFile("video-core", b), "utf8"),
      );
    same("scripts/_branches.mjs", "assets/interactive/branches.mjs");
    same("scripts/_lib.mjs", "scripts/_lib.mjs");
  });
});

describe("branch checks", () => {
  it("accepts the layout after, answer 1, answer 2, then", async () => {
    const { branchProblems, resolveBranches } = await br();
    expect(branchProblems(good(), IDS)).toEqual([]);
    const [b] = resolveBranches(good(), scenes);
    expect(b).toMatchObject({ gate: 8, then: 24 });
    expect(b.options.map((o: Loose) => [o.start, o.end])).toEqual([
      [8, 16],
      [16, 24],
    ]);
  });

  it("names what is wrong", async () => {
    const { branchProblems } = await br();
    const edit = (f: (b: Loose) => void) => {
      const d = good();
      f(d.branches[0]);
      return branchProblems(d, IDS).join("|");
    };
    expect(edit((b) => (b.options[1].from = "s6"))).toContain('must be "s5"');
    expect(edit((b) => (b.then = "s6"))).toContain('must be "s7"');
    expect(edit((b) => (b.after = "zz"))).toContain("no scene");
    expect(edit((b) => (b.options = [b.options[0]]))).toContain("2 to 4");
    expect(edit((b) => (b.question = "x‮y"))).toContain("question");
    expect(edit((b) => (b.options[0].to = "s3"))).toContain("must be");
    expect(branchProblems({ version: 2 }, IDS)[0]).toContain("version");
    const dup = good();
    dup.branches.push({ ...dup.branches[0] });
    expect(branchProblems(dup, IDS).join("|")).toContain("twice");
  });

  it("lets a branch end the film with then = end", async () => {
    const { branchProblems, resolveBranches } = await br();
    const d = good();
    d.branches[0].options[1].to = "s7";
    d.branches[0].then = "end";
    expect(branchProblems(d, IDS)).toEqual([]);
    expect(resolveBranches(d, scenes)[0].then).toBeNull();
  });
});

describe("player engine", () => {
  type Eng = {
    state: () => Loose;
    play: () => void;
    pause: () => void;
    seek: (t: number) => void;
    choose: (i: number) => void;
    setRate: (r: number) => void;
    tick: (dt: number) => void;
  };
  const make = async () => {
    const { resolveBranches } = await br();
    const ctx = loadLib<{ VP: { create: (o: Loose) => Eng } }>("video-core", [
      "assets/lib/player.js",
    ]);
    const log: Loose = { branch: [], end: 0 };
    const eng = ctx.VP.create({
      duration: 28,
      branches: resolveBranches(good(), scenes),
      onBranch: (b: Loose | null) => log.branch.push(b ? b.id : null),
      onEnd: () => log.end++,
    });
    return { eng, log };
  };
  const run = (eng: Eng, seconds: number) => {
    for (let i = 0; i < seconds * 10; i++) eng.tick(0.1);
  };

  it("plays, holds at the question just before its gate, and waits for an answer", async () => {
    const { eng, log } = await make();
    eng.play();
    run(eng, 9);
    const st = eng.state();
    expect(st.playing).toBe(false);
    expect(st.branch.id).toBe("pick");
    expect(st.t).toBeGreaterThan(7.99);
    expect(st.t).toBeLessThan(8);
    run(eng, 3);
    expect(eng.state().t).toBe(st.t);
    expect(log.branch).toEqual(["pick"]);
  });

  it("plays the chosen answer, then continues at then, from either answer", async () => {
    for (const [i, start] of [
      [0, 8],
      [1, 16],
    ] as const) {
      const { eng, log } = await make();
      eng.play();
      run(eng, 9);
      eng.choose(i);
      expect(eng.state().t).toBe(start);
      run(eng, 7.5);
      expect(eng.state().t).toBeLessThan(start + 8);
      run(eng, 1);
      expect(eng.state().t).toBeGreaterThanOrEqual(24);
      run(eng, 10);
      expect(eng.state().playing).toBe(false);
      expect(log.end).toBe(1);
      expect(log.branch).toEqual(["pick", null]);
    }
  });

  it("scales the clock by the speed and clamps it", async () => {
    const { eng } = await make();
    eng.setRate(0.5);
    eng.play();
    run(eng, 4);
    expect(eng.state().t).toBeCloseTo(2, 5);
    eng.setRate(9);
    expect(eng.state().rate).toBe(2);
    eng.setRate(0);
    expect(eng.state().rate).toBe(0.25);
  });

  it("scrubbing into an answer plays it and continues; scrubbing past the question skips it", async () => {
    const { eng } = await make();
    eng.seek(17);
    eng.play();
    run(eng, 7.5);
    expect(eng.state().t).toBeGreaterThanOrEqual(24);
    const other = await make();
    other.eng.seek(25);
    other.eng.play();
    run(other.eng, 5);
    expect(other.eng.state().t).toBe(28);
    expect(other.eng.state().branch).toBeNull();
  });

  it("replays from the start after the end and ignores play while a question is open", async () => {
    const { eng } = await make();
    eng.seek(28);
    eng.play();
    expect(eng.state().t).toBe(0);
    run(eng, 9);
    eng.play();
    expect(eng.state().playing).toBe(false);
  });
});

describe("export-html.mjs", () => {
  const run = (args: string[]) =>
    spawnSync(process.execPath, [skillFile("video-core", "scripts/export-html.mjs"), ...args], {
      encoding: "utf8",
      env: { ...process.env, ANTHROPIC_API_KEY: "sk-canary-0000000000000000000000" },
    });
  const project = (inter: Loose | null = good(), over: Loose = {}) => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "video-interactive-"));
    const sc = IDS.map((id, i) => ({
      id,
      kind: i % 2 ? "list" : "title",
      durationFrom: "fixed",
      seconds: 4,
      props: i % 2 ? { heading: `H${i}`, items: ["a", "b <i>x</i>"] } : { text: `T${i} <b>` },
    }));
    writeFileSync(
      path.join(dir, "video.json"),
      JSON.stringify({
        version: 1,
        meta: {
          title: "Pick <one>",
          type: "explainer",
          format: "youtube-16x9",
          fps: 30,
          lang: "en",
        },
        scenes: sc,
        ...over,
      }),
    );
    if (inter) writeFileSync(path.join(dir, "interactive.json"), JSON.stringify(inter));
    return dir;
  };

  it("writes one page that loads nothing from the network and escapes project text", () => {
    const dir = project();
    const out = path.join(dir, "site");
    const r = run([dir, "--out", out]);
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toContain("1 branch point");
    const html = readFileSync(path.join(out, "index.html"), "utf8");
    expect(html).toContain("Content-Security-Policy");
    expect(html).toContain("default-src 'none'");
    expect(html).not.toMatch(/(src|href)="https?:/);
    expect(html).not.toContain("<b>");
    expect(html).not.toContain("<title>Pick <one>");
    expect(html).toContain('"gate":8');
    expect(html).toContain('id="rate"');
    expect(html.match(/<script/g)!.length).toBe(5);
    expect(existsSync(path.join(out, ".aisle-interactive"))).toBe(true);
  });

  it("works without branches, copies audio and refuses a bad --out", () => {
    const dir = project(null);
    const audio = path.join(dir, "mix.wav");
    writeFileSync(audio, "RIFF");
    const out = path.join(dir, "site");
    const r = run([dir, "--out", out, "--audio", audio]);
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toContain("with audio");
    expect(readFileSync(path.join(out, "index.html"), "utf8")).toContain('src="assets/audio.wav"');
    expect(existsSync(path.join(out, "assets", "audio.wav"))).toBe(true);
    expect(run([dir, "--out", out]).status).toBe(0); // its own folder can be rebuilt
    const other = path.join(dir, "keep");
    mkdirSync(other);
    writeFileSync(path.join(other, "mine.txt"), "x");
    expect(run([dir, "--out", other]).status).toBe(2);
    expect(existsSync(path.join(other, "mine.txt"))).toBe(true);
    expect(run([dir, "--audio", "/etc/passwd"]).status).toBe(2);
  });

  it("refuses bad branches and video media", () => {
    const bad = good();
    bad.branches[0].then = "s6";
    const r = run([project(bad)]);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("then");
    const dir = project(null);
    const vj = JSON.parse(readFileSync(path.join(dir, "video.json"), "utf8")) as Loose;
    vj.assets = [{ id: "rec", path: "rec.mp4", source: "user", licence: "own" }];
    vj.scenes[0] = {
      id: "s1",
      kind: "screen",
      durationFrom: "fixed",
      seconds: 4,
      props: { asset: "rec" },
    };
    writeFileSync(path.join(dir, "video.json"), JSON.stringify(vj));
    writeFileSync(path.join(dir, "rec.mp4"), "x");
    const v = run([dir]);
    expect(v.status).toBe(1);
    expect(v.stderr).toContain("video media");
  });
});

describe("branches.mjs", () => {
  const run = (args: string[]) =>
    spawnSync(process.execPath, [skillFile("video", "scripts/branches.mjs"), ...args], {
      encoding: "utf8",
    });
  it("writes an example that passes its own check, and never overwrites", () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "video-interactive-"));
    writeFileSync(
      path.join(dir, "video.json"),
      JSON.stringify({
        version: 1,
        meta: { title: "t", type: "explainer", format: "reel-9x16", fps: 30, lang: "en" },
        scenes: IDS.slice(0, 5).map((id) => ({
          id,
          kind: "title",
          durationFrom: "fixed",
          seconds: 3,
          props: { text: id },
        })),
      }),
    );
    expect(run([dir]).stdout).toContain("No interactive.json");
    expect(run([dir, "--init"]).status).toBe(0);
    const r = run([dir]);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("valid");
    expect(run([dir, "--init"]).status).toBe(2);
    const data = JSON.parse(readFileSync(path.join(dir, "interactive.json"), "utf8")) as Loose;
    data.branches[0].then = "s9";
    writeFileSync(path.join(dir, "interactive.json"), JSON.stringify(data));
    expect(run([dir]).status).toBe(2);
  });
});
