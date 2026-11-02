import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadScript, skillFile } from "./load";

type Loose = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
type Finding = { level: "error" | "warn"; file: string; line: number; message: string };
type Check = {
  checkWriting: (f: Loose) => Finding[];
  BUILT_KINDS: string[];
  KIDS_PRESSURE: string[];
  KIDS_BANDS: Record<string, Loose>;
};
type Story = {
  buildVideo: (b: Loose, t: string, e?: Loose) => { video: Loose; problems: string[] };
};
const check = () => loadScript<Check>("video-write", "scripts/write-check.mjs");
const story = () => loadScript<Story>("video-write", "scripts/storyboard.mjs");
const errors = (f: Finding[]) => f.filter((x) => x.level === "error").map((x) => x.message);
const warns = (f: Finding[]) => f.filter((x) => x.level === "warn").map((x) => x.message);

const brief = (over: Loose = {}) =>
  JSON.stringify({
    title: "Nour learns to share",
    mode: "kids",
    lang: "en",
    format: "reel-9x16",
    audience: "kids-3-5",
    goal: "Show that sharing feels good",
    promise: "A turtle shares her leaf",
    lengthSeconds: 24,
    tone: "gentle",
    learningGoal: "Sharing makes friends happy",
    ...over,
  });
const line = (id: string, text: string, beat: string) => `[${id}] ${text}\n  beat: ${beat}\n`;
const script = [
  line("k1", "Hello! I am Nour.", "hook"),
  line("k2", "I have one big leaf.", "setup"),
  line("k3", "Can I keep it all? No.", "try"),
  line("k4", "Can I keep it all? Still no.", "try"),
  line("k5", "I will share it with you.", "turn"),
  line("k6", "Sharing makes friends happy.", "lesson"),
  line("k7", "Slow and steady, side by side.", "button"),
].join("");
const hooks = "1. a\n2. b\n3. c\n4. d\n5. e\n";
const board = (rig = "nour") =>
  [
    "| scene | kind | narration | props |",
    "| --- | --- | --- | --- |",
    `| meet | puppet | k1,k2,k3,k4,k5,k6,k7 | \`{"cast":[{"rig":"${rig}","x":0.5,"y":0.8,"height":0.4}]}\` |`,
  ].join("\n");
const files = (o: Loose = {}) => ({
  brief: brief(),
  script,
  hooks,
  storyboard: board(),
  characters: ["nour"],
  ...o,
});

describe("video-write kids mode", () => {
  it("accepts a complete kids project", async () => {
    const { checkWriting } = await check();
    const f = checkWriting(files());
    expect(errors(f)).toEqual([]);
    expect(warns(f)).toEqual([]);
  });
  it("needs an age band and one learning goal", async () => {
    const { checkWriting } = await check();
    expect(errors(checkWriting(files({ brief: brief({ audience: "kids" }) }))).join()).toMatch(
      /age band/,
    );
    const noGoal = JSON.parse(brief());
    delete noGoal.learningGoal;
    expect(errors(checkWriting(files({ brief: JSON.stringify(noGoal) }))).join()).toMatch(
      /learningGoal/,
    );
  });
  it("follows the kids beat order", async () => {
    const { checkWriting } = await check();
    const swapped = script.replace("beat: lesson", "beat: turn");
    expect(errors(checkWriting(files({ script: swapped }))).join("\n")).toMatch(
      /no "lesson" beat|comes before/,
    );
    expect(
      errors(checkWriting(files({ script: script.replace("beat: try", "beat: climax") }))).join(
        "\n",
      ),
    ).toMatch(/not a kids beat|no "try" beat/);
  });
  it("refuses like-and-subscribe pressure and warns about frightening words", async () => {
    const { checkWriting } = await check();
    const pressure = script + line("k8", "Please like and subscribe!", "cta");
    expect(errors(checkWriting(files({ script: pressure }))).join()).toMatch(
      /asks children to act/,
    );
    const scary = script.replace("I have one big leaf.", "A scary monster might die.");
    expect(warns(checkWriting(files({ script: scary }))).join("\n")).toMatch(/can frighten/);
  });
  it("warns about long sentences by age band and about missing repetition", async () => {
    const { checkWriting } = await check();
    const long = script.replace(
      "I have one big leaf.",
      "I have one big green leaf that I found by the old river.",
    );
    expect(warns(checkWriting(files({ script: long }))).join("\n")).toMatch(
      /sentence of \d+ words \(at most 9 for ages 3-5\)/,
    );
    expect(
      warns(checkWriting(files({ script: long, brief: brief({ audience: "kids-6-9" }) }))).join(
        "\n",
      ),
    ).not.toMatch(/sentence of/);
    const once = script
      .replace("beat: try\n[k4]", "beat: setup\n[k4]")
      .replace("  beat: try\n[k5]", "  beat: setup\n[k5]");
    expect(warns(checkWriting(files({ script: once }))).join("\n")).toMatch(/fewer than 2 "try"/);
  });
  it("measures length at a child's pace", async () => {
    const { checkWriting } = await check();
    // About 38 words at 2.0 words a second is 19 s, near the 24 s brief; a 60 s brief is far off.
    expect(warns(checkWriting(files({ brief: brief({ lengthSeconds: 90 }) }))).join("\n")).toMatch(
      /against a 90 s brief/,
    );
  });
  it("needs a bible for each puppet character in the storyboard", async () => {
    const { checkWriting, BUILT_KINDS } = await check();
    expect(BUILT_KINDS).toContain("puppet");
    expect(errors(checkWriting(files({ storyboard: board("mimi") }))).join()).toMatch(
      /character "mimi" has no characters\/mimi\/bible\.md/,
    );
  });
  it("writes video.json as a kids video with big captions", async () => {
    const { buildVideo } = await story();
    const { video, problems } = buildVideo(JSON.parse(brief()), board());
    expect(problems).toEqual([]);
    expect(video.meta).toMatchObject({ type: "kids", audience: "kids-3-5" });
    expect(video.captions).toEqual({ style: "kids", burn: true, safeZone: "reel" });
    expect(video.scenes[0]).toMatchObject({
      kind: "puppet",
      narration: ["k1", "k2", "k3", "k4", "k5", "k6", "k7"],
    });
    // An existing choice is kept.
    const kept = buildVideo(JSON.parse(brief()), board(), { captions: { style: "pop" } });
    expect(kept.video.captions.style).toBe("pop");
  });
  it("uses the same pressure phrases as video-qa and the same age bands", async () => {
    const { KIDS_PRESSURE, KIDS_BANDS } = await check();
    const rules = JSON.parse(readFileSync(skillFile("video-qa", "assets/rules.json"), "utf8"));
    for (const p of KIDS_PRESSURE) expect(rules.kids.pressure).toContain(p);
    for (const band of Object.keys(KIDS_BANDS))
      expect(KIDS_BANDS[band].sentenceWords).toBe(rules.kids.sentenceWords[band]);
  });
});
