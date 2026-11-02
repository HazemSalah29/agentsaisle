import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadScript } from "./load";

type Loose = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const scenes = () =>
  loadScript<{ renderScene: (s: Loose, c: Loose) => { html: string; plan: Loose[] } }>(
    "video-core",
    "assets/engine/hyperframes/scenes.mjs",
  );
const kn = () => loadScript<Loose>("video-core", "assets/engine/hyperframes/kinetic.mjs");
const wd = () => loadScript<Loose>("video-core", "scripts/words-data.mjs");
const W = (text: string, start: number, end: number, line = "l1") => ({ text, start, end, line });
const words = [
  W("Holy", 0.3, 0.6),
  W("moly.", 0.6, 1.0),
  W("You", 1.4, 1.6, "l2"),
  W("are", 1.6, 1.8, "l2"),
  W("not", 1.8, 2.0, "l2"),
  W("ready.", 2.0, 2.6, "l2"),
];
const ctx = (o: Loose = {}) => ({
  prefix: "sc-a",
  at: 5,
  seconds: 4,
  lines: [],
  lang: "en",
  first: false,
  rise: 24,
  assets: new Map(),
  words,
  ...o,
});
const scene = (props: Loose = {}) => ({ id: "s1", kind: "kinetic", props });

describe("words for scenes", () => {
  it("offsets each line's word times by where the line starts in the scene", async () => {
    const { sceneWords } = await wd();
    const timing = {
      scenes: [
        {
          seconds: 5,
          lines: [
            { id: "l1", start: 0 },
            { id: "l2", start: 2 },
          ],
        },
        { seconds: 3, lines: [] },
      ],
    };
    const json = {
      lines: [
        { id: "l1", words: [{ text: "Hi", start: 0.1, end: 0.4 }] },
        {
          id: "l2",
          approximate: true,
          words: [
            { text: "there", start: 0.5, end: 9 },
            { text: "bad", start: "x", end: 1 },
          ],
        },
      ],
    };
    const out = sceneWords(timing, json);
    expect(out[0]).toEqual([
      { text: "Hi", start: 0.1, end: 0.4, line: "l1", approximate: false },
      { text: "there", start: 2.5, end: 5, line: "l2", approximate: true }, // clamped to the scene
    ]);
    expect(out[1]).toEqual([]);
    expect(sceneWords(timing, null)).toEqual([[], []]);
  });
});

describe("kinetic scene", () => {
  it("pops every word in at the moment it is spoken, with key words burst and glow", async () => {
    const { renderScene } = await scenes();
    const { html, plan } = renderScene(scene({ emph: ["ready"] }), ctx());
    const at = (id: string) => plan.find((p) => p.id === id)!.at;
    expect(at("sc-a-w0")).toBeCloseTo(5 + 0.27);
    expect(at("sc-a-w3")).toBeCloseTo(5 + 1.57);
    expect(html).toContain("kn-emph");
    expect(plan.find((p) => p.id === "sc-a-b5")).toBeTruthy();
    expect(plan.find((p) => p.id === "sc-a-b0")).toBeUndefined();
    const pop = plan.find((p) => p.id === "sc-a-w0")!.frames;
    expect(pop[0].opacity).toBe(0);
    expect(pop.at(-1).opacity).toBe(1);
    expect(pop.at(-1).transform).toContain("scale(1)");
    expect(
      Math.max(...pop.map((f: Loose) => Number(/scale\(([\d.]+)\)/.exec(f.transform)![1]))),
    ).toBeGreaterThan(1); // overshoot
  });
  it("groups at punctuation, lets a phrase leave before the next one and keeps the last one on screen", async () => {
    const { renderScene } = await scenes();
    const { plan, html } = renderScene(scene(), ctx());
    expect(html.match(/class="kn-phrase"/g)).toHaveLength(2);
    const exit0 = plan.find((p) => p.id === "sc-a-p0")!;
    expect(exit0.at - 5).toBeGreaterThan(1.0); // after "moly." is said
    expect(exit0.at - 5).toBeLessThan(1.4); // before "You"
    expect(plan.find((p) => p.id === "sc-a-p1")).toBeUndefined(); // the last phrase stays for the transition
    expect(
      renderScene(scene({ holdLast: false }), ctx()).plan.find((p) => p.id === "sc-a-p1"),
    ).toBeTruthy();
    expect(
      renderScene(scene({ exit: "none" }), ctx()).plan.find((p) => p.id === "sc-a-p0"),
    ).toBeUndefined();
  });
  it("shatters a phrase into letters that fly apart, repeatably", async () => {
    const { renderScene } = await scenes();
    const a = renderScene(scene({ exit: "shatter" }), ctx());
    const b = renderScene(scene({ exit: "shatter" }), ctx());
    expect(a.html).toContain("kn-l");
    expect(a.plan.filter((p) => /^sc-a-l[01]-/.test(p.id)).length).toBe("HOLYMOLY.".length);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
  it("uses given phrases when they match the words, ignores them when they do not", async () => {
    const { groupWords } = await kn();
    expect(
      groupWords(words, ["Holy moly. You", "are not ready."]).map((g: Loose[]) => g.length),
    ).toEqual([3, 3]);
    expect(groupWords(words, ["only two"]).map((g: Loose[]) => g.length)).toEqual([2, 4]);
    const long = Array.from({ length: 9 }, (_, i) => W(`w${i}`, i, i + 0.5));
    expect(groupWords(long).map((g: Loose[]) => g.length)).toEqual([4, 4, 1]);
  });
  it("sizes type so a long word never runs off the frame", async () => {
    const { phraseSize } = await kn();
    expect(phraseSize(["HOLY"])).toBeGreaterThan(phraseSize(["HOLY", "MOLY", "YOU", "ARE"]));
    expect(phraseSize(["EXTRAORDINARILY"])).toBeLessThan(phraseSize(["HOLY"]));
    expect(phraseSize(["x".repeat(30)])).toBeGreaterThanOrEqual(6);
    expect(phraseSize(["NO."], true)).toBeGreaterThan(phraseSize(["NO."]));
  });
  it("shows a running caption, tilted cards with rows on spoken words, and a flow with a travelling dot", async () => {
    const { renderScene } = await scenes();
    const { html, plan } = renderScene(
      scene({
        caption: true,
        emph: ["ready"],
        cards: [
          {
            title: "Audit",
            rows: [{ text: "Grade A", tag: "ok", bind: 2 }, { text: "Grade B" }],
            tilt: [12, -14],
          },
        ],
        flow: { nodes: ["add", "audit", "install"] },
      }),
      ctx(),
    );
    expect(html).toContain("kn-cap");
    expect(html).toContain("kn-chip");
    expect(plan.find((p) => p.id === "sc-a-c0-r0")!.at).toBeCloseTo(5 + 1.4);
    expect(plan.find((p) => p.id === "sc-a-c0")!.frames[0].transform).toContain("rotateX(12deg)");
    const dot = plan.find((p) => p.id === "sc-a-f-dot")!.frames;
    expect(dot[0].top).toBe("0%");
    expect(dot.at(-1).top).toBe("100%");
    expect(plan.filter((p) => /^sc-a-f-n\d$/.test(p.id))).toHaveLength(3);
  });
  it("spreads text evenly when the scene has no voice, and escapes hostile text", async () => {
    const { renderScene } = await scenes();
    const r = renderScene(
      scene({
        text: "<img src=x onerror=alert(1)> now",
        cards: [{ title: "<b>x</b>", rows: [{ text: "<i>y</i>" }] }],
      }),
      ctx({ words: [] }),
    );
    expect(r.html).not.toContain("<img");
    expect(r.html).not.toContain("<b>x");
    expect(r.html).toContain("&lt;");
    const starts = r.plan.filter((p) => /^sc-a-w\d$/.test(p.id)).map((p) => p.at);
    expect(starts).toEqual([...starts].sort((a, b) => a - b));
    expect(starts.length).toBe(4);
  });
  it("lists problems", async () => {
    const { kineticProblems } = await kn();
    expect(kineticProblems({})).toEqual([]);
    expect(kineticProblems({ bg: "red" })[0]).toContain("bg");
    expect(kineticProblems({ exit: "explode" })[0]).toContain("exit");
    expect(kineticProblems({ phrases: ["one two three four five"] })[0]).toContain(
      "at most 4 words",
    );
    expect(kineticProblems({ cards: [{ title: "a", rows: [] }] })[0]).toContain("rows");
    expect(kineticProblems({ flow: { nodes: ["a"] } })[0]).toContain("flow.nodes");
    expect(kineticProblems({ y: 5 })[0]).toContain("y:");
  });
  it("ships the display font with its licence", () => {
    const dir = path.join(__dirname, "..", "official", "video-core", "assets", "fonts");
    expect(statSync(path.join(dir, "Anton-Regular.ttf")).size).toBeGreaterThan(50_000);
    expect(readFileSync(path.join(dir, "OFL.txt"), "utf8")).toContain(
      "SIL Open Font License, Version 1.1",
    );
  });
});
