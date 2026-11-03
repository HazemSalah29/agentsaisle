import { describe, expect, it } from "vitest";
import { loadScript } from "./load";

type Loose = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const scenes = () =>
  loadScript<{ renderScene: (s: Loose, c: Loose) => { html: string; plan: Loose[] } }>(
    "video-core",
    "assets/engine/hyperframes/scenes.mjs",
  );
const shared = () => loadScript<Loose>("video-core", "assets/engine/hyperframes/shared.mjs");
const W = (text: string, start: number, end = start + 0.3) => ({ text, start, end, line: "l1" });
const ctx = (o: Loose = {}) => ({
  prefix: "sc-a",
  at: 10,
  seconds: 8,
  lines: [],
  lang: "en",
  first: false,
  rise: 24,
  assets: new Map(),
  words: [],
  ...o,
});
const said = [
  W("First", 0.2),
  W("we", 0.5),
  W("check", 0.7),
  W("the", 1.0),
  W("limits,", 1.1),
  W("then", 2.5),
  W("we", 2.8),
  W("block", 3.0),
  W("bots", 3.4),
  W("and", 3.9),
  W("finally", 5.0),
  W("we", 5.3),
  W("log", 5.5),
];
const at = (plan: Loose[], id: string) => plan.find((p) => p.id === id)!.at;

describe("word cursor", () => {
  it("matches in order, skips joining words and returns film time", async () => {
    const { wordCursor, contentWords } = await shared();
    expect(contentWords("Check the limits")).toEqual(["check", "limits"]);
    const c = wordCursor(ctx({ words: said }));
    expect(c.find("Check the limits")).toBeCloseTo(10.7);
    expect(c.find("Block bots")).toBeCloseTo(13.0);
    expect(c.find("Check again")).toBeNull(); // "check" was already passed; the search only moves on
    expect(wordCursor(ctx()).find("anything")).toBeNull();
    expect(wordCursor(ctx({ words: said })).find("the")).toBeNull(); // only joining words
  });
  it("matches accents and case", async () => {
    const { wordCursor } = await shared();
    expect(wordCursor(ctx({ words: [W("Café", 1)] })).find("cafe")).toBeCloseTo(11);
  });
});

describe("list, chart and timeline enter on the word that names them", () => {
  it("brings each list item in on its word, in order, a little early", async () => {
    const { renderScene } = await scenes();
    const { plan } = renderScene(
      {
        id: "s",
        kind: "list",
        props: { heading: "Plan", items: ["Check limits", "Block bots", "Log everything"] },
      },
      ctx({ words: said }),
    );
    expect(at(plan, "sc-a-i0")).toBeCloseTo(10.7 - 0.06);
    expect(at(plan, "sc-a-i1")).toBeCloseTo(13.0 - 0.06);
    expect(at(plan, "sc-a-i2")).toBeCloseTo(15.5 - 0.06); // "log" (everything is never said)
  });
  it("uses `on` when given, and the old spacing when there is no voice", async () => {
    const { renderScene } = await scenes();
    const props = { heading: "Plan", items: ["One", "Two"], on: ["bots", "finally"] };
    const { plan } = renderScene({ id: "s", kind: "list", props }, ctx({ words: said }));
    expect(at(plan, "sc-a-i0")).toBeCloseTo(11); // its word is at 13.4, but the first item comes in within a second
    expect(at(plan, "sc-a-i1")).toBeCloseTo(15.0 - 0.06);
    const none = renderScene(
      { id: "s", kind: "list", props: { items: ["A one", "B two"] } },
      ctx(),
    );
    expect(at(none.plan, "sc-a-i0")).toBeCloseTo(10.4);
    expect(at(none.plan, "sc-a-i1")).toBeGreaterThan(at(none.plan, "sc-a-i0"));
  });
  it("never leaves a list without a heading empty while it waits for a late word", async () => {
    const { renderScene } = await scenes();
    const { plan } = renderScene(
      { id: "s", kind: "list", props: { items: ["Finally done", "Log it"] } },
      ctx({ words: said }),
    );
    expect(at(plan, "sc-a-i0")).toBeLessThanOrEqual(10.3);
  });
  it("brings chart bars and timeline events in on their words", async () => {
    const { renderScene } = await scenes();
    const bars = renderScene(
      {
        id: "s",
        kind: "chart",
        props: {
          type: "bar",
          data: [
            { label: "Bots", value: 3 },
            { label: "Logs", value: 5, on: "log" },
          ],
        },
      },
      ctx({ words: said }),
    );
    expect(at(bars.plan, "sc-a-b0")).toBeCloseTo(13.4 - 0.06);
    expect(at(bars.plan, "sc-a-b1")).toBeCloseTo(15.5 - 0.06);
    const tl = renderScene(
      {
        id: "s",
        kind: "timeline",
        props: {
          events: [
            { at: "9:00", label: "Limits checked" },
            { at: "9:05", label: "Bots blocked" },
          ],
        },
      },
      ctx({ words: said }),
    );
    expect(at(tl.plan, "sc-a-e0")).toBeCloseTo(11.1 - 0.06); // "checked" is never said; "limits" is
    expect(at(tl.plan, "sc-a-e1")).toBeGreaterThan(at(tl.plan, "sc-a-e0"));
  });
  it("still escapes hostile text", async () => {
    const { renderScene } = await scenes();
    const { html } = renderScene(
      { id: "s", kind: "list", props: { items: ["<img src=x onerror=1> bots"] } },
      ctx({ words: said }),
    );
    expect(html).not.toContain("<img");
  });
});

describe("spoken focus on lists", () => {
  it("fills a rail under each item for exactly as long as the voice is on it, and dims the item once it is said", async () => {
    const { renderScene } = await scenes();
    const { html, plan } = renderScene(
      {
        id: "s",
        kind: "list",
        props: { heading: "Plan", items: ["Check limits", "Block bots", "Log everything"] },
      },
      ctx({ words: said }),
    );
    const rail = (i: number) => plan.find((p) => p.id === `sc-a-i${i}-r`)!;
    expect(html).toContain('id="sc-a-i0-r" class="rail"');
    expect(rail(0).at).toBeCloseTo(at(plan, "sc-a-i0"));
    expect(rail(0).at + rail(0).dur).toBeCloseTo(at(plan, "sc-a-i1"), 1); // until the next item
    expect(rail(1).at + rail(1).dur).toBeCloseTo(at(plan, "sc-a-i2"), 1);
    expect(rail(2).at + rail(2).dur).toBeCloseTo(10 + 8 - 0.15, 1); // the last one runs to the scene end
    expect(rail(0).frames[0].transform).toBe("scaleX(0)");
    expect(rail(0).frames[1].transform).toBe("scaleX(1)");
    expect(rail(0).ease).toBe("linear");
    const dim = plan.filter((p) => p.frames.some((f: Loose) => f.opacity === 0.45));
    expect(dim.map((p) => p.id)).toEqual(["sc-a-i0", "sc-a-i1"]); // the last item stays bright
  });
  it("can be turned off", async () => {
    const { renderScene } = await scenes();
    const { html, plan } = renderScene(
      { id: "s", kind: "list", props: { items: ["Check limits", "Block bots"], focus: false } },
      ctx({ words: said }),
    );
    expect(html).not.toContain("rail");
    expect(plan.every((p) => !/-r$/.test(p.id))).toBe(true);
  });
});

describe("something moves early", () => {
  const late = [W("then", 0.2), W("finally", 5.0), W("block", 6.0)];
  const props = (title?: string) => ({
    ...(title ? { title } : {}),
    steps: [{ label: "Block" }, { label: "Finally" }],
  });
  it("brings the first item in at once when no heading is on screen, within a second when one is", async () => {
    const { renderScene } = await scenes();
    const bare = renderScene({ id: "s", kind: "steps", props: props() }, ctx({ words: late }));
    expect(at(bare.plan, "sc-a-s0")).toBeCloseTo(10.3); // not 15.94 (its word)
    const titled = renderScene(
      { id: "s", kind: "steps", props: props("How") },
      ctx({ words: late }),
    );
    expect(at(titled.plan, "sc-a-s0")).toBeCloseTo(11);
    expect(at(titled.plan, "sc-a-s1")).toBeGreaterThan(at(titled.plan, "sc-a-s0")!);
  });
  it("starts a number counting at once", async () => {
    const { renderScene } = await scenes();
    const { plan } = renderScene(
      { id: "s", kind: "number", props: { value: 20, from: 27, label: "parts left", on: "block" } },
      ctx({ words: late }),
    );
    expect(at(plan, "sc-a-box")).toBeCloseTo(10.3);
  });
});
