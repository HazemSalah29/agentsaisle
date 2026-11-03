import { describe, expect, it } from "vitest";
import { loadScript } from "./load";

type Loose = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
type Scenes = { renderScene: (scene: Loose, ctx: Loose) => { html: string; plan: Loose[] } };
type Tl = { timelineProblems: (p: Loose) => string[] };
const scenes = () => loadScript<Scenes>("video-core", "assets/engine/hyperframes/scenes.mjs");
const tl = () => loadScript<Tl>("video-core", "assets/engine/hyperframes/timeline.mjs");
const ctx = (o: Loose = {}) => ({
  prefix: "sc-a",
  at: 1,
  seconds: 10,
  lines: [],
  lang: "en",
  first: false,
  rise: 24,
  assets: new Map(),
  ...o,
});
const props = () => ({
  title: "Outage",
  events: [
    { at: "14:02", label: "Deploy 2.3 rolled out", type: "action", where: "api" },
    { at: "14:09", label: "Error rate above 5%", type: "alert" },
    { at: "14:31", label: "Rolled back", type: "fix" },
  ],
});

describe("timeline scene", () => {
  it("shows each event with its type word, in order", async () => {
    const { renderScene } = await scenes();
    const { html, plan } = renderScene({ id: "s1", kind: "timeline", props: props() }, ctx());
    expect(html.indexOf("Deploy 2.3")).toBeLessThan(html.indexOf("Rolled back"));
    expect(html).toContain("ACTION");
    expect(html).toContain("FIXED");
    const times = plan.filter((p) => p.id.includes("-e")).map((p) => p.at);
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });

  it("reveals event i with narration line i", async () => {
    const { renderScene } = await scenes();
    const lines = [0, 2, 5].map((start) => ({ start }));
    const { plan } = renderScene({ id: "s1", kind: "timeline", props: props() }, ctx({ lines }));
    expect(plan.filter((p) => p.id.includes("-e")).map((p) => p.at)).toEqual([1, 3, 6]);
  });

  it("escapes hostile text", async () => {
    const { renderScene } = await scenes();
    const p = props();
    p.events[0]!.label = "<img src=x onerror=alert(1)>";
    const { html } = renderScene({ id: "s1", kind: "timeline", props: p }, ctx());
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });

  it("lists problems", async () => {
    const { timelineProblems } = await tl();
    expect(timelineProblems(props())).toEqual([]);
    expect(timelineProblems({ events: [{ at: "1", label: "x" }] })[0]).toContain("2 to 10");
    expect(
      timelineProblems({
        events: [
          { at: "x".repeat(20), label: "a", type: "boom" },
          { at: "1", label: "b" },
        ],
      }),
    ).toHaveLength(2);
  });

  it("uses a denser layout above 6 events so a tall list stays inside the safe area", async () => {
    const { renderScene } = await scenes();
    const many = props();
    (many as Loose).events = Array.from({ length: 8 }, (_, i) => ({
      at: `1${i}:00`,
      label: `Event ${i}`,
    }));
    expect(renderScene({ id: "s1", kind: "timeline", props: many }, ctx()).html).toContain(
      'class="tl tl-dense"',
    );
    expect(renderScene({ id: "s1", kind: "timeline", props: props() }, ctx()).html).toContain(
      'class="tl"',
    );
  });
});
