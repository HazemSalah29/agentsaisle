import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadScript, skillFile } from "./load";
import { writerFiles } from "./video-fixtures";

type Loose = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
type Finding = { level: "error" | "warn"; file: string; line: number; message: string };
type Check = {
  checkWriting: (f: Loose) => Finding[];
  BUILT_KINDS: string[];
  itemCount: (k: string, p?: Loose) => number;
  paceNote: (o: Loose) => string | null;
};
type Parse = {
  parseScript: (t: string) => { lines: Loose[]; problems: Loose[] };
  parseFacts: (t: string) => Loose[];
  parseStoryboard: (t: string) => { rows: Loose[]; problems: Loose[] };
  parseHooks: (t: string) => string[];
  splitRow: (r: string) => string[];
  speechSeconds: (t: string, l?: string) => number;
};
type Story = {
  buildVideo: (b: Loose, t: string, e?: Loose) => { video: Loose; problems: string[] };
};

const check = () => loadScript<Check>("video-write", "scripts/write-check.mjs");
const parse = () => loadScript<Parse>("video-write", "scripts/script-parse.mjs");
const errors = (f: Finding[]) => f.filter((x) => x.level === "error").map((x) => x.message);
const warns = (f: Finding[]) => f.filter((x) => x.level === "warn").map((x) => x.message);

describe("video-write parsers", () => {
  it("reads script lines with their indented attributes and flags stray text", async () => {
    const { parseScript } = await parse();
    const r = parseScript(
      "# Title\n[a] Hello there.\n  beat: hook\n  on-screen: Hi\n\nstray words\n[a] again\n[b]\n",
    );
    expect(r.lines.map((l) => [l.id, l.text, l.attrs])).toEqual([
      ["a", "Hello there.", { beat: "hook", "on-screen": "Hi" }],
      ["a", "again", {}],
      ["b", "", {}],
    ]);
    expect(r.problems.map((p) => p.message).join("|")).toMatch(
      /not a script line.*used twice.*has no text/,
    );
  });

  it("reads facts with their sources", async () => {
    const { parseFacts } = await parse();
    expect(
      parseFacts("- [f1] A claim. Source: https://example.com/a\n- [f2] No source here\ntext"),
    ).toEqual([
      { id: "f1", claim: "A claim.", source: "https://example.com/a", line: 1 },
      { id: "f2", claim: "No source here", source: "", line: 2 },
    ]);
  });

  it("splits table rows around pipes inside backticks and parses props as JSON", async () => {
    const { splitRow, parseStoryboard } = await parse();
    expect(splitRow('| a | `{"x":"p|q"}` | c |')).toEqual(["a", '`{"x":"p|q"}`', "c"]);
    const r = parseStoryboard(
      '| scene | kind | props |\n| --- | --- | --- |\n| s1 | title | `{"text":"a|b"}` |\n| s2 | title | `[1]` |\n',
    );
    expect(r.rows[0]!.props).toEqual({ text: "a|b" });
    expect(r.problems).toHaveLength(1);
    expect(r.problems[0]!.message).toMatch(/props must be a JSON object/);
    expect(parseStoryboard("no table").problems[0]!.message).toMatch(/no storyboard table/);
  });

  it("accepts any separator row, including single dashes and alignment colons", async () => {
    const { parseStoryboard } = await parse();
    for (const sep of ["| - | - |", "|---|---|", "| :-- | --: |", "|:-:|:-:|"]) {
      const r = parseStoryboard(`| scene | kind |\n${sep}\n| a | title |\n`);
      expect(
        r.rows.map((x) => x.scene),
        sep,
      ).toEqual(["a"]);
    }
  });

  it("counts speech time, slower for Arabic, and reads hook options", async () => {
    const { speechSeconds, parseHooks } = await parse();
    expect(speechSeconds("one two three four five", "en")).toBe(2);
    expect(speechSeconds("one two three four five", "ar")).toBeGreaterThan(2);
    expect(parseHooks("1. a\n2) b\n- c\ntext\n* d")).toEqual(["a", "b", "c", "d"]);
  });
});

describe("video-write check", () => {
  it("accepts a complete explain project", async () => {
    const { checkWriting } = await check();
    expect(errors(checkWriting(writerFiles()))).toEqual([]);
  });

  it("fails on a bad or missing brief", async () => {
    const { checkWriting } = await check();
    const f = writerFiles();
    expect(errors(checkWriting({ ...f, brief: undefined }))).toContain("missing");
    expect(errors(checkWriting({ ...f, brief: "{nope" })).join()).toMatch(/not valid JSON/);
    expect(
      errors(checkWriting({ ...f, brief: JSON.stringify({ title: "x", mode: "poem" }) })).join(),
    ).toMatch(/\$\.mode.*not one of/);
  });

  it("requires the hook first and the explain beats in order", async () => {
    const { checkWriting } = await check();
    const f = writerFiles();
    const noHook = f.script.replace("beat: hook", "beat: misconception");
    expect(errors(checkWriting({ ...f, script: noHook })).join("\n")).toMatch(
      /first line must be the hook/,
    );
    const noEdge = f.script.replace("beat: edge", "beat: step");
    expect(errors(checkWriting({ ...f, script: noEdge })).join("\n")).toMatch(/no "edge" beat/);
    const swapped = f.script
      .replace("beat: analogy", "beat: takeaway")
      .replace("beat: takeaway\n[l8]", "beat: analogy\n[l8]");
    expect(errors(checkWriting({ ...f, script: swapped })).join("\n")).toMatch(
      /comes before the beat it should follow/,
    );
    const badBeat = f.script.replace("beat: edge", "beat: climax");
    expect(errors(checkWriting({ ...f, script: badBeat })).join("\n")).toMatch(
      /"climax" is not a explain beat/,
    );
  });

  it("puts the call to action after the payoff", async () => {
    const { checkWriting } = await check();
    const f = writerFiles();
    const early = f.script.replace(
      "[l2] Most people think blocking extra requests is the whole job.\n  beat: misconception",
      "[l2] Follow for more.\n  beat: cta\n[l2b] Most people think blocking extra requests is the whole job.\n  beat: misconception",
    );
    expect(errors(checkWriting({ ...f, script: early })).join("\n")).toMatch(
      /call to action must come after the payoff/,
    );
  });

  it("makes every step, edge case and statistic carry a sourced fact", async () => {
    const { checkWriting } = await check();
    const f = writerFiles();
    const noFact = f.script.replace("  beat: step\n  fact: f1\n[l5]", "  beat: step\n[l5]");
    expect(errors(checkWriting({ ...f, script: noFact })).join("\n")).toMatch(
      /line "l4" makes a technical claim/,
    );
    const stat = f.script.replace("Follow for the next one.", "Over 90% of teams get this wrong.");
    expect(errors(checkWriting({ ...f, script: stat })).join("\n")).toMatch(
      /line "l8" makes a technical claim or states a number/,
    );
    const unknown = f.script.replace("fact: f2", "fact: f9");
    expect(errors(checkWriting({ ...f, script: unknown })).join("\n")).toMatch(
      /fact "f9" is not in facts.md/,
    );
    const noSource = f.facts.replace(" Source: https://example.com/http-429", "");
    expect(errors(checkWriting({ ...f, facts: noSource })).join("\n")).toMatch(
      /fact "f2" has no "Source:"/,
    );
    expect(errors(checkWriting({ ...f, facts: undefined })).join("\n")).toMatch(
      /facts.md.*missing|missing/,
    );
  });

  it("blocks [needs-source] markers", async () => {
    const { checkWriting } = await check();
    const f = writerFiles();
    const marked = f.script.replace("Follow for the next one.", "Experts love it [needs-source]");
    expect(errors(checkWriting({ ...f, script: marked })).join("\n")).toMatch(/\[needs-source\]/);
  });

  it("warns about weak openers and long lines but does not fail", async () => {
    const { checkWriting } = await check();
    const f = writerFiles();
    const weak = f.script.replace(
      "Your API needs a speed limit.",
      "You won't believe what this API does to every single request that arrives.",
    );
    const found = checkWriting({ ...f, script: weak });
    expect(warns(found).join("\n")).toMatch(/weak opener/);
    expect(warns(found).join("\n")).toMatch(/hook takes more than 4 s/);
    expect(errors(found)).toEqual([]);
  });

  it("warns when the speech length is far from the brief", async () => {
    const { checkWriting } = await check();
    const f = writerFiles();
    const brief = JSON.parse(f.brief);
    brief.lengthSeconds = 90;
    expect(warns(checkWriting({ ...f, brief: JSON.stringify(brief) })).join()).toMatch(
      /of speech against a 90 s brief/,
    );
  });

  it("needs five hook options", async () => {
    const { checkWriting } = await check();
    const f = writerFiles();
    expect(errors(checkWriting({ ...f, hooks: "1. one\n2. two\n" })).join()).toMatch(
      /has 2 options; the brief asks for 5/,
    );
    expect(errors(checkWriting({ ...f, hooks: undefined })).join()).toMatch(
      /missing \(5 alternative/,
    );
  });

  it("requires numbers as words in Arabic lines, including Arabic-Indic digits", async () => {
    const { checkWriting } = await check();
    const f = writerFiles();
    const brief = JSON.stringify({ ...JSON.parse(f.brief), lang: "ar" });
    for (const digit of ["3", "٣", "۳"]) {
      const script = f.script.replace(
        "Your API needs a speed limit.",
        `واجهتك تحتاج ${digit} حدود`,
      );
      expect(errors(checkWriting({ ...f, brief, script })).join("\n")).toMatch(
        /line "l1" has digits/,
      );
    }
    const ok = f.script
      .replace("Your API needs a speed limit.", "واجهتك تحتاج حدا للسرعة")
      .replace("429 error", "error");
    expect(errors(checkWriting({ ...f, brief, script: ok })).join("\n")).not.toMatch(/digits/);
  });

  it("checks story beats", async () => {
    const { checkWriting } = await check();
    const brief = JSON.stringify({ ...JSON.parse(writerFiles().brief), mode: "story" });
    const script = `[s1] A fox found a door.\n  beat: hook\n[s2] It lived alone in a quiet wood.\n  beat: setup\n[s3] The door opened by itself.\n  beat: turn\n[s4] Inside was a whole city of lamps.\n  beat: climax\n[s5] The fox lit one and went home.\n  beat: button\n`;
    const files = { brief, script, hooks: writerFiles().hooks };
    expect(errors(checkWriting(files))).toEqual([]);
    expect(
      errors(checkWriting({ ...files, script: script.replace("beat: turn", "beat: edge") })).join(
        "\n",
      ),
    ).toMatch(/"edge" is not a story beat|no "turn" beat/);
  });

  it("counts what a scene brings in one by one, for every kind that does", async () => {
    const { itemCount } = await check();
    expect(itemCount("list", { items: ["a", "b", "c"] })).toBe(3);
    expect(itemCount("steps", { steps: [{}, {}] })).toBe(2);
    expect(itemCount("versus", { left: { points: ["a"] }, right: { points: ["b", "c"] } })).toBe(3);
    expect(itemCount("cycle", { nodes: ["a", "b", "c"] })).toBe(3);
    expect(itemCount("title", { text: "x" })).toBe(0);
    expect(itemCount("number", { value: 1 })).toBe(0);
    expect(itemCount("list", {})).toBe(0); // missing props never throw
  });

  it("warns when a scene has a lot of narration for few items, and when one scene runs long", async () => {
    const { paceNote } = await check();
    const three = { kind: "list", props: { items: ["a", "b", "c"] } };
    expect(paceNote({ ...three, seconds: 9 })).toBeNull(); // 3 s an item
    expect(paceNote({ ...three, seconds: 12 })).toMatch(/spotlight/); // 4 s an item
    const one = { kind: "list", props: { items: ["a"] } };
    expect(paceNote({ ...one, seconds: 8 })).toMatch(/spotlight/);
    expect(
      paceNote({ ...one, props: { items: ["a"], layout: "spotlight" }, seconds: 8 }),
    ).toBeNull();
    expect(paceNote({ kind: "title", props: {}, seconds: 7 })).toBeNull();
    expect(paceNote({ kind: "title", props: {}, seconds: 10 })).toMatch(/split/);
    expect(
      paceNote({ ...three, props: { ...three.props, layout: "spotlight" }, seconds: 10 }),
    ).toMatch(/split/);
    expect(paceNote({ ...three, seconds: 0 })).toBeNull();
  });

  it("reports the pace of a scene by name from the storyboard", async () => {
    const { checkWriting } = await check();
    const f = writerFiles();
    const slow = f.storyboard.replace(
      '"items":["Take a token","Refill slowly","Reject when empty"]',
      '"items":["Take a token"]',
    );
    expect(warns(checkWriting({ ...f, storyboard: slow })).join("\n")).toMatch(
      /scene "bucket": about \d+ s of narration for 1 item/,
    );
    expect(warns(checkWriting(f)).join("\n")).not.toMatch(/the picture would wait/);
  });

  it("checks the storyboard against the script and the built kinds", async () => {
    const { checkWriting } = await check();
    const f = writerFiles();
    const unbuilt = f.storyboard.replace("| title | l1 |", "| diagram | l1 |");
    expect(errors(checkWriting({ ...f, storyboard: unbuilt })).join("\n")).toMatch(
      /kind "diagram" is not built yet/,
    );
    const unknownLine = f.storyboard.replace("l3,l4,l5", "l3,l4,l5,l99");
    expect(errors(checkWriting({ ...f, storyboard: unknownLine })).join("\n")).toMatch(
      /narration line "l99" is not in script.md/,
    );
    const dropped = f.storyboard.replace("l7,l8", "l7");
    expect(errors(checkWriting({ ...f, storyboard: dropped })).join("\n")).toMatch(
      /script line "l8" is not used by any scene/,
    );
    expect(warns(checkWriting({ ...f, storyboard: undefined })).join()).toMatch(
      /approves the storyboard/,
    );
  });

  it("runs as a process with capped output and the right exit codes", () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "video-write-"));
    const f = writerFiles();
    for (const [k, v] of Object.entries({
      "brief.json": f.brief,
      "script.md": f.script,
      "facts.md": f.facts,
      "storyboard.md": f.storyboard,
      "hooks.md": f.hooks,
    }))
      writeFileSync(path.join(dir, k), v);
    const run = () =>
      spawnSync("node", [skillFile("video-write", "scripts/write-check.mjs"), dir], {
        encoding: "utf8",
      });
    expect(run().status).toBe(0);
    writeFileSync(path.join(dir, "script.md"), f.script.replace("beat: hook", "beat: step"));
    const bad = run();
    expect(bad.status).toBe(1);
    expect(bad.stdout.split("\n").length).toBeLessThanOrEqual(41);
    expect(
      spawnSync("node", [skillFile("video-write", "scripts/write-check.mjs")], { encoding: "utf8" })
        .status,
    ).toBe(2);
  });

  it("keeps its helper files identical to video-core's", () => {
    for (const f of ["scripts/_lib.mjs", "scripts/schema-check.mjs"])
      expect(readFileSync(skillFile("video-write", f), "utf8")).toBe(
        readFileSync(skillFile("video-core", f), "utf8"),
      );
  });
});

describe("video-write storyboard", () => {
  const story = () => loadScript<Story>("video-write", "scripts/storyboard.mjs");

  it("builds a video.json skeleton video-core accepts", async () => {
    const { buildVideo } = await story();
    const f = writerFiles();
    const { video, problems } = buildVideo(JSON.parse(f.brief), f.storyboard);
    expect(problems).toEqual([]);
    expect(video.meta).toMatchObject({
      title: "Rate limiting",
      type: "explainer",
      format: "reel-9x16",
      fps: 30,
      lang: "en",
      audience: "devs",
    });
    expect(video.script).toBe("script.md");
    expect(video.scenes.map((s: Loose) => s.id)).toEqual([
      "intro",
      "myth",
      "bucket",
      "fail",
      "wrap",
    ]);
    expect(video.scenes[2]).toMatchObject({
      kind: "list",
      narration: ["l3", "l4", "l5"],
      transitionIn: "fade",
    });
    expect(video.scenes[4]).toMatchObject({ narration: ["l7", "l8"], seconds: 1 });
    const check = loadScript<{ checkProject: (v: unknown, dir: string) => string[] }>(
      "video-core",
      "scripts/check.mjs",
    );
    const dir = mkdtempSync(path.join(os.tmpdir(), "video-sb-"));
    writeFileSync(path.join(dir, "script.md"), f.script);
    expect((await check).checkProject(video, dir)).toEqual([]);
  });

  it("sets rtl for Arabic and keeps what the user already set", async () => {
    const { buildVideo } = await story();
    const f = writerFiles();
    const ar = buildVideo({ ...JSON.parse(f.brief), lang: "ar" }, f.storyboard).video;
    expect(ar.meta.dir).toBe("rtl");
    const kept = buildVideo(JSON.parse(f.brief), f.storyboard, {
      voice: { provider: "kokoro" },
      assets: [{ id: "a" }],
      meta: { fps: 60 },
    }).video;
    expect(kept.voice).toEqual({ provider: "kokoro" });
    expect(kept.assets).toEqual([{ id: "a" }]);
    expect(kept.meta.fps).toBe(60);
  });

  it("refuses unbuilt kinds, bad ids, and scenes with no length", async () => {
    const { buildVideo } = await story();
    const brief = JSON.parse(writerFiles().brief);
    const table =
      "| scene | kind | narration | seconds | transition | props |\n| - | - | - | - | - | - |\n| Bad Id | diagram | | | wipe | `{}` |\n";
    const { problems } = buildVideo(brief, table);
    const text = problems.join("\n");
    expect(text).toMatch(/scene id must be lowercase/);
    expect(text).toMatch(/kind "diagram" is not built yet/);
    expect(text).toMatch(/needs narration lines or seconds/);
    expect(text).toMatch(/transition "wipe"/);
  });

  it("writes video.json once and only overwrites with --force", () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "video-sb-"));
    const f = writerFiles();
    writeFileSync(path.join(dir, "brief.json"), f.brief);
    writeFileSync(path.join(dir, "storyboard.md"), f.storyboard);
    const run = (...a: string[]) =>
      spawnSync("node", [skillFile("video-write", "scripts/storyboard.mjs"), dir, ...a], {
        encoding: "utf8",
      });
    expect(run().status).toBe(0);
    expect(JSON.parse(readFileSync(path.join(dir, "video.json"), "utf8")).scenes).toHaveLength(5);
    expect(run().status).toBe(2);
    expect(run("--force").status).toBe(0);
  });
});
