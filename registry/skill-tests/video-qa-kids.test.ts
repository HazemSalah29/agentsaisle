import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadScript, skillFile } from "./load";

type Loose = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
type Kids = {
  isKids: (v: Loose) => boolean;
  ageBand: (a?: string) => string | null;
  scriptLines: (s: string) => Array<{ id: string; words: number; longest: number }>;
  kidsChecks: (i: Loose, rules: Loose) => Array<{ id: string; level: string; text: string }>;
};
const mod = () => loadScript<Kids>("video-qa", "scripts/_kids.mjs");
const rules = () => JSON.parse(readFileSync(skillFile("video-qa", "assets/rules.json"), "utf8"));

const video = (over: Loose = {}): Loose => ({
  meta: {
    title: "Nour",
    type: "kids",
    format: "reel-9x16",
    fps: 30,
    lang: "en",
    audience: "kids-3-5",
  },
  scenes: [
    {
      id: "s1",
      kind: "puppet",
      props: { cast: [{ rig: "nour", x: 0.5, y: 0.8, height: 0.4 }] },
    },
  ],
  ...over,
});
const script =
  "[l1] Nour likes to share.\n  beat: setup\n[l2] She gives a leaf to her friend.\n  beat: turn\n";
const timing = (secs = [3, 3.5]) => ({
  scenes: [
    {
      id: "s1",
      start: 0,
      seconds: 8,
      lines: [
        { id: "l1", start: 0, seconds: secs[0] },
        { id: "l2", start: 3, seconds: secs[1] },
      ],
    },
  ],
});
const run = async (o: Loose = {}) => {
  const { kidsChecks } = await mod();
  const out = kidsChecks(
    {
      video: video(),
      script,
      timing: timing(),
      captions: { style: { size: 0.065 } },
      bibles: new Set(["nour"]),
      ...o,
    },
    rules(),
  );
  return Object.fromEntries(out.map((r) => [r.id, r]));
};

describe("kids detection", () => {
  it("knows kids videos by type or audience, and the age band", async () => {
    const { isKids, ageBand } = await mod();
    expect(isKids(video())).toBe(true);
    expect(isKids({ meta: { type: "explainer", audience: "kids-6-9" } })).toBe(true);
    expect(isKids({ meta: { type: "explainer", audience: "devs" } })).toBe(false);
    expect(ageBand("kids-3-5")).toBe("3-5");
    expect(ageBand("kids-6-9")).toBe("6-9");
    expect(ageBand("kids")).toBeNull();
  });
  it("counts words and the longest sentence per script line", async () => {
    const { scriptLines } = await mod();
    expect(scriptLines("[a] One two three. Four five!\n  beat: x\n[b-2] Six.\n")).toEqual([
      { id: "a", words: 5, longest: 3 },
      { id: "b-2", words: 1, longest: 1 },
    ]);
  });
});

describe("kids checks", () => {
  it("passes a gentle, readable project", async () => {
    const r = await run();
    for (const [id, c] of Object.entries(r)) expect(c.level, `${id}: ${c.text}`).toBe("pass");
    expect(r["kids-audience"].text).toMatch(/made-for-kids answer is "yes"/);
  });
  it("needs an age band", async () => {
    const r = await run({ video: video({ meta: { ...video().meta, audience: "kids" } }) });
    expect(r["kids-audience"].level).toBe("fail");
  });
  it("catches speech that is too fast, then far too fast", async () => {
    // l1 has 4 words: 4 / 1.7 s = 2.4 wps is over the 2.0 limit for 3 to 5 (warn); 4 / 1.4 s = 2.9 is far over (fail).
    expect((await run({ timing: timing([1.7, 3.5]) }))["kids-pace"].level).toBe("warn");
    expect((await run({ timing: timing([1.4, 3.5]) }))["kids-pace"].level).toBe("fail");
    // The same line is fine for ages 6 to 9 (limit 2.6).
    const older = video({ meta: { ...video().meta, audience: "kids-6-9" } });
    expect((await run({ video: older, timing: timing([1.7, 3.5]) }))["kids-pace"].level).toBe(
      "pass",
    );
  });
  it("warns about a long sentence", async () => {
    const long = "[l1] Nour walks to the big green hill and then she climbs up it slowly.\n";
    expect((await run({ script: long }))["kids-sentences"].level).toBe("warn");
  });
  it("fails like-and-subscribe pressure, in the script or on screen", async () => {
    const r = await run({ script: script + "[l3] Please like and subscribe!\n" });
    expect(r["kids-pressure"].level).toBe("fail");
    const onScreen = video({
      scenes: [{ id: "s1", kind: "title", props: { text: "Smash that like button" } }],
    });
    expect((await run({ video: onScreen }))["kids-pressure"].level).toBe("fail");
    expect((await run({ script: "[l1] Arabic: اشترك الآن\n" }))["kids-pressure"].level).toBe(
      "fail",
    );
  });
  it("warns about unkind or frightening words but not inside other words", async () => {
    expect((await run({ script: "[l1] You are stupid.\n" }))["kids-language"].level).toBe("warn");
    expect(
      (await run({ script: "[l1] A scary night, the blood moon.\n" }))["kids-language"].level,
    ).toBe("warn");
    expect((await run({ script: "[l1] A diet of deadlines.\n" }))["kids-language"].level).toBe(
      "pass",
    );
  });
  it("warns about scenes shorter than three seconds", async () => {
    const t = timing();
    t.scenes.push({ id: "s2", start: 8, seconds: 1.5, lines: [] });
    expect((await run({ timing: t }))["kids-cuts"].level).toBe("warn");
  });
  it("needs big captions, and says so when there are none", async () => {
    expect((await run({ captions: { style: { size: 0.05 } } }))["kids-caption-size"].level).toBe(
      "fail",
    );
    expect((await run({ captions: null }))["kids-caption-size"].level).toBe("warn");
  });
  it("needs a bible for each puppet character, and notes real footage", async () => {
    expect((await run({ bibles: new Set() }))["kids-characters"].level).toBe("fail");
    const withBroll = video();
    withBroll.scenes.push({ id: "b", kind: "broll", props: { asset: "x" } });
    expect((await run({ video: withBroll }))["kids-footage"].level).toBe("warn");
  });
});

describe("qa.mjs uses the kids rules", () => {
  const src = readFileSync(skillFile("video-qa", "scripts/qa.mjs"), "utf8");
  it("applies the stricter flash, caption and contrast numbers and skips puppet scenes in the margin check", () => {
    expect(src).toContain("rules.kids.flash");
    expect(src).toContain("rules.kids.captionMinSize");
    expect(src).toContain("rules.kids.contrastMin");
    expect(src).toContain('["broll", "puppet"]');
    expect(src).toContain("kidsChecks(");
  });
  it("has kids numbers that are stricter than the general ones", () => {
    const r = rules();
    expect(r.kids.flash.maxPerSecond).toBeLessThan(r.flash.maxPerSecond);
    expect(r.kids.captionMinSize).toBeGreaterThan(r.captionMinSize);
    expect(r.kids.contrastMin).toBeGreaterThan(r.contrastMin);
  });
});
