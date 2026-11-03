import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadLib, loadScript, skillFile } from "./load";

type Loose = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

type Scenes = {
  KINDS: string[];
  esc: (s: unknown) => string;
  renderScene: (scene: Loose, ctx: Loose) => { html: string; plan: Loose[] };
};
const load = () => loadScript<Scenes>("video-core", "assets/engine/hyperframes/scenes.mjs");

const ctx = (o: Record<string, unknown> = {}) => ({
  prefix: "sc-a",
  at: 2,
  seconds: 4,
  lines: [],
  lang: "en",
  first: false,
  rise: 24,
  assets: new Map([
    ["pic", { file: "pic.jpg" }],
    ["clip", { file: "clip.mp4" }],
  ]),
  ...o,
});
const HOSTILE = `<img src=x onerror=alert(1)> "q" 'a' & </script><script>alert(2)</script>`;

describe("video-core scenes", () => {
  it("builds the kinds", async () => {
    const { KINDS } = await load();
    expect(KINDS).toEqual([
      "title",
      "quote",
      "list",
      "chart",
      "broll",
      "rate-limit",
      "code",
      "sequence",
      "request-flow",
      "screen",
      "timeline",
      "calligraphy",
      "shot",
      "kinetic",
      "number",
      "callout",
      "versus",
      "steps",
      "cycle",
      "funnel",
      "matrix",
      "nodes",
      "ranking",
      "checklist",
      "terminal",
      "compare-table",
      "stack",
      "gauge",
    ]);
  });

  it("lists exactly the built kinds (and custom) in the schema, with props for each", async () => {
    const { KINDS } = await load();
    const schema = JSON.parse(
      readFileSync(skillFile("video-core", "assets/video.schema.json"), "utf8"),
    );
    expect(schema.definitions.scene.properties.kind.enum).toEqual([...KINDS, "custom"]);
    for (const k of KINDS) expect(schema.definitions.props[k], k).toBeTruthy();
  });

  it("shows hostile strings as text in every kind, never as markup", async () => {
    const { renderScene } = await load();
    const scenes = [
      { kind: "title", props: { text: HOSTILE, subtitle: HOSTILE } },
      { kind: "quote", props: { text: HOSTILE, by: HOSTILE, source: HOSTILE } },
      { kind: "list", props: { heading: HOSTILE, items: [HOSTILE] } },
      {
        kind: "chart",
        props: {
          type: "bar",
          title: HOSTILE,
          unit: HOSTILE,
          data: [
            { label: HOSTILE, value: 1 },
            { label: "b", value: 2 },
          ],
        },
      },
      {
        kind: "chart",
        props: {
          type: "line",
          data: [
            { label: HOSTILE, value: 1 },
            { label: "b", value: 2 },
          ],
        },
      },
      { kind: "broll", props: { asset: "pic", caption: HOSTILE } },
    ];
    for (const s of scenes) {
      const { html } = renderScene(s, ctx());
      expect(html).not.toMatch(/<img src=x/);
      expect(html).not.toMatch(/<script/i);
      expect(html).not.toContain("onerror=alert(1)>");
      expect(html).toContain("&lt;");
    }
  });

  it("escapes the characters that matter", async () => {
    const { esc } = await load();
    expect(esc(`<a href="x">'&'</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;",
    );
    expect(esc(undefined)).toBe("");
  });

  it("gives the same output for the same input", async () => {
    const { renderScene } = await load();
    const s = {
      kind: "chart",
      props: {
        type: "bar",
        data: [
          { label: "a", value: 3 },
          { label: "b", value: -1 },
        ],
      },
    };
    expect(JSON.stringify(renderScene(s, ctx()))).toBe(JSON.stringify(renderScene(s, ctx())));
  });

  it("title: the first scene is visible at frame 0, later scenes fade in", async () => {
    const { renderScene } = await load();
    const s = { kind: "title", props: { text: "Hi", subtitle: "there" } };
    const first = renderScene(s, ctx({ first: true, at: 0 }));
    const later = renderScene(s, ctx());
    expect(first.plan[0]?.frames[0]).not.toHaveProperty("opacity");
    expect(later.plan[0]?.frames[0]).toHaveProperty("opacity", 0);
    expect(later.plan.map((p) => p.at)).toEqual([2, 2.25]);
    expect(later.html).toContain('id="sc-a-t"');
  });

  it("list: items follow their narration lines when there is one per item, else spread out", async () => {
    const { renderScene } = await load();
    const s = { kind: "list", props: { items: ["a", "b", "c"], numbered: true } };
    const lines = [{ start: 0.2 }, { start: 1.5 }, { start: 2.8 }];
    // the first plan entry of each item is its entrance (later ones are its rail and its dimming)
    const enters = (plan: { id: string; at: number }[]) => {
      const seen = new Map<string, number>();
      for (const p of plan) if (/-i\d$/.test(p.id) && !seen.has(p.id)) seen.set(p.id, p.at);
      return [...seen.values()];
    };
    expect(enters(renderScene(s, ctx({ lines })).plan)).toEqual([2.2, 3.5, 4.8]);
    const spread = enters(renderScene(s, ctx({ seconds: 6 })).plan);
    expect(spread[0]).toBeLessThan(spread[1]!);
    expect(spread[2]).toBeLessThanOrEqual(2 + 6 - 0.5);
    expect(renderScene(s, ctx()).html).toMatch(/^<ol class="items">.*<\/ol>$/);
  });

  it("chart: one animated bar per value on a shared baseline, negatives drop below it", async () => {
    const { renderScene } = await load();
    const r = renderScene(
      {
        kind: "chart",
        props: {
          type: "bar",
          unit: "%",
          data: [
            { label: "a", value: 10 },
            { label: "b", value: -5 },
          ],
        },
      },
      ctx(),
    );
    expect(r.plan).toHaveLength(2);
    expect(r.html.match(/class="bar"/g)).toHaveLength(2);
    const ys = [
      ...r.html.matchAll(/class="bar" x="[\d.]+" y="([\d.]+)" width="[\d.]+" height="([\d.]+)"/g),
    ];
    const base = Number(r.html.match(/class="axis" x1="4" x2="96" y1="([\d.]+)"/)![1]);
    expect(Number(ys[0]![1]) + Number(ys[0]![2])).toBeCloseTo(base, 1); // up-bar ends on the baseline
    expect(Number(ys[1]![1])).toBeCloseTo(base, 1); // down-bar starts on it
    expect(r.html).toContain("10%");
  });

  it("chart: a line draws itself with a stroke offset", async () => {
    const { renderScene } = await load();
    const r = renderScene(
      {
        kind: "chart",
        props: {
          type: "line",
          data: [
            { label: "a", value: 1 },
            { label: "b", value: 3 },
          ],
        },
      },
      ctx(),
    );
    expect(r.plan[0]?.frames).toEqual([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }]);
    expect(r.html).toContain('pathLength="1"');
  });

  it("broll: images and videos use the right tag; the path stays under assets/media", async () => {
    const { renderScene } = await load();
    expect(renderScene({ kind: "broll", props: { asset: "pic" } }, ctx()).html).toMatch(
      /<img [^>]*src="assets\/media\/pic\.jpg"/,
    );
    const v = renderScene({ kind: "broll", props: { asset: "clip", fit: "contain" } }, ctx()).html;
    expect(v).toMatch(/<video [^>]*src="assets\/media\/clip\.mp4" muted playsinline/);
    expect(v).toContain("object-fit:contain");
  });

  it("refuses a kind that is not built", async () => {
    const { renderScene } = await load();
    expect(() => renderScene({ kind: "diagram", props: {} }, ctx())).toThrow(/not built yet/);
  });
});

describe("video-core tween helper", () => {
  type VT = { VT: { run: (plan: Loose[], o: Loose) => Loose; easing: (n: string) => string } };
  const stubDoc = () => {
    const made: Loose[] = [];
    const el = (id: string) => ({
      animate: (frames: Loose, opts: Loose) => {
        const a = {
          id,
          frames,
          opts,
          paused: false,
          currentTime: -1,
          pause() {
            a.paused = true;
          },
        };
        made.push(a);
        return a;
      },
    });
    return { made, doc: { getElementById: (id: string) => (id === "missing" ? null : el(id)) } };
  };

  it("places every animation paused at its absolute time, with fill both", () => {
    const { VT } = loadLib<VT>("video-core", ["assets/lib/tween.js"]);
    const { made, doc } = stubDoc();
    const win: Loose = {};
    VT.run(
      [
        { id: "a", frames: [{ opacity: 0 }, { opacity: 1 }], at: 1.5, dur: 0.5, ease: "out" },
        { id: "missing", frames: [], at: 0, dur: 1, ease: "out" },
      ],
      { id: "main", duration: 4, doc, win },
    );
    expect(made).toHaveLength(1);
    expect(made[0]?.opts).toMatchObject({ duration: 500, delay: 1500, fill: "both" });
    expect(made[0]?.paused).toBe(true);
    expect(win.__timelines.main.duration()).toBe(4);
  });

  it("seeks every animation when the timeline is asked to", () => {
    const { VT } = loadLib<VT>("video-core", ["assets/lib/tween.js"]);
    const { made, doc } = stubDoc();
    const win: Loose = {};
    const tl = VT.run([{ id: "a", frames: [], at: 0, dur: 1, ease: "linear" }], {
      id: "m",
      duration: 1,
      doc,
      win,
    });
    tl.seek(0.25);
    expect(made[0]?.currentTime).toBe(250);
    expect(tl.paused()).toBe(true);
  });

  it("falls back to the default easing for unknown names", () => {
    const { VT } = loadLib<VT>("video-core", ["assets/lib/tween.js"]);
    expect(VT.easing("nope")).toBe(VT.easing("out"));
  });
});
