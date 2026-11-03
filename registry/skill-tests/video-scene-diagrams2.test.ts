import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadScript } from "./load";

type Loose = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const scenes = () =>
  loadScript<{
    renderScene: (s: Loose, c: Loose) => { html: string; plan: Loose[] };
    KINDS: string[];
  }>("video-core", "assets/engine/hyperframes/scenes.mjs");
const d2 = () => loadScript<Loose>("video-core", "assets/engine/hyperframes/diagrams2.mjs");
const W = (text: string, start: number) => ({ text, start, end: start + 0.3, line: "l1" });
const words = [W("cache", 0.5), W("disk", 2.5), W("network", 4.5), W("done", 6.5)];
const ctx = (o: Loose = {}) => ({
  prefix: "sc-a",
  at: 10,
  seconds: 8,
  lines: [],
  lang: "en",
  first: false,
  rise: 24,
  assets: new Map(),
  size: [1080, 1920],
  words,
  ...o,
});
const at = (plan: Loose[], id: string) => plan.find((p) => p.id === id)?.at;

const GOOD: Record<string, Loose> = {
  ranking: {
    unit: "ms",
    items: [
      { label: "Cache", value: 12 },
      { label: "Disk", value: 48.5 },
      { label: "Network", value: 120 },
    ],
  },
  checklist: {
    title: "Ship it",
    items: [
      { text: "Cache warm" },
      { text: "Disk synced", state: "todo" },
      { text: "Network fine", state: "fail" },
    ],
  },
  terminal: {
    lines: [
      { text: "npm run build", kind: "cmd" },
      { text: "built in 4.1 s", kind: "out" },
      { text: "done", kind: "out" },
    ],
  },
  "compare-table": {
    columns: ["Free", "Pro"],
    rows: [
      { label: "Cache", cells: ["small", "large"] },
      { label: "Disk", cells: ["1 GB", "100 GB"] },
      { label: "Network", cells: ["shared", "private"] },
    ],
  },
  stack: {
    layers: [{ label: "Cache" }, { label: "Disk", detail: "slow but big" }, { label: "Network" }],
  },
  gauge: { value: 87, unit: "%", label: "of disk is full", on: "disk" },
};

describe("second-batch idea scenes", () => {
  it("are registered and their example props are valid", async () => {
    const { KINDS } = await scenes();
    const { diagram2Problems, DIAGRAM2_KINDS } = await d2();
    expect(DIAGRAM2_KINDS).toHaveLength(6);
    for (const k of DIAGRAM2_KINDS) {
      expect(KINDS).toContain(k);
      expect(diagram2Problems(k, GOOD[k]), k).toEqual([]);
    }
  });
  it("draw with every animation pointing at an element, unique ids, inside the scene", async () => {
    const { renderScene } = await scenes();
    for (const [kind, props] of Object.entries(GOOD)) {
      const { html, plan } = renderScene({ id: "s", kind, props }, ctx());
      const ids = [...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]);
      expect(new Set(ids).size, `${kind}: duplicate ids`).toBe(ids.length);
      for (const p of plan) {
        expect(html, `${kind}: ${p.id}`).toContain(`id="${p.id}"`);
        expect(p.at, `${kind}: ${p.id}`).toBeGreaterThanOrEqual(10);
        expect(p.at, `${kind}: ${p.id}`).toBeLessThanOrEqual(18);
      }
    }
  });
  it("keep moving while the voice runs: no stretch over 1.3 s without an animation", async () => {
    const { renderScene } = await scenes();
    const longestStill = (plan: Loose[]) => {
      const spans = plan
        .map((p) => [p.at, p.at + p.dur] as [number, number])
        .filter(([a, b]) => b - a >= 0.3)
        .sort((x, y) => x[0] - y[0]);
      let cursor = 10;
      let worst = 0;
      for (const [a, b] of spans) {
        worst = Math.max(worst, a - cursor);
        cursor = Math.max(cursor, b);
      }
      return Math.max(worst, 17.5 - cursor);
    };
    for (const [kind, props] of Object.entries(GOOD)) {
      const { plan } = renderScene({ id: "s", kind, props }, ctx());
      expect(longestStill(plan), kind).toBeLessThanOrEqual(1.3);
    }
  });
  it("ranking sorts by the author's values, highlights the largest and times bars by the spoken order", async () => {
    const { renderScene } = await scenes();
    const { html, plan } = renderScene({ id: "s", kind: "ranking", props: GOOD.ranking }, ctx());
    const labels = [...html.matchAll(/class="rk-l">([^<]+)</g)].map((m) => m[1]);
    expect(labels).toEqual(["Network", "Disk", "Cache"]);
    expect(html.match(/rk-top/g)).toHaveLength(1);
    expect(html).toContain("48.5"); // the decimals the author wrote, for every value
    expect(html).toContain("12.0");
    expect(at(plan, "sc-a-k0")).toBeCloseTo(10.3); // "cache" is said at 0.5 s; no heading, so it comes in at once
    expect(at(plan, "sc-a-k2")).toBeCloseTo(14.44); // "network" at 4.5 s, though it is shown first
    const bar = plan.find((p) => p.id === "sc-a-k0-b")!;
    expect(bar.at + bar.dur).toBeCloseTo(12.44, 1); // grows until the next item ("disk", 2.5 s) is named
  });
  it("checklist draws a tick or a cross on the word, and nothing for a todo", async () => {
    const { renderScene } = await scenes();
    const { html, plan } = renderScene(
      { id: "s", kind: "checklist", props: GOOD.checklist },
      ctx(),
    );
    expect(html).toContain("M4 12.5");
    expect(html).toContain("M6 6 L18 18");
    expect(plan.find((p) => p.id === "sc-a-c0-t")).toBeTruthy();
    expect(plan.find((p) => p.id === "sc-a-c1-t")).toBeUndefined(); // todo: an empty box
    expect(at(plan, "sc-a-c0-t")).toBeGreaterThan(at(plan, "sc-a-c0")!);
  });
  it("terminal types at a steady rate, never past the next line, and never claims to run anything", async () => {
    const { renderScene } = await scenes();
    const { TYPE_RATE } = await d2();
    const { html, plan } = renderScene({ id: "s", kind: "terminal", props: GOOD.terminal }, ctx());
    const l0 = plan.find((p) => p.id === "sc-a-l0")!;
    expect(l0.dur).toBeLessThanOrEqual("npm run build".length / TYPE_RATE + 1e-9);
    expect(l0.at + l0.dur).toBeLessThanOrEqual(at(plan, "sc-a-l1")!);
    expect(l0.frames[0].clipPath).toBe("inset(0 100% 0 0)");
    expect(html).toContain("<b>$</b>");
    expect(html).not.toMatch(/<script|onerror|href=/);
    const c0 = plan.find((p) => p.id === "sc-a-l0-c")!; // a cursor blinks on the active line only
    expect(c0.frames[0].opacity).toBe(0); // hidden before its line starts...
    expect(c0.frames.at(-1).opacity).toBe(0); // ...and once the next line has started
    expect(c0.frames.some((f: Loose) => f.opacity === 1)).toBe(true);
    const offs = c0.frames.map((f: Loose) => f.offset);
    expect(offs).toEqual([...offs].sort((a: number, b: number) => a - b));
    expect(c0.at).toBeCloseTo(at(plan, "sc-a-l0")!);
    expect(c0.at + c0.dur).toBeCloseTo(at(plan, "sc-a-l1")!, 1);
    expect(
      plan.find((p) => p.id === "sc-a-l2-c")!.at + plan.find((p) => p.id === "sc-a-l2-c")!.dur,
    ).toBeCloseTo(18 - 0.15, 1);
  });
  it("compare-table reveals rows on their words under a header that is on screen from the start", async () => {
    const { renderScene } = await scenes();
    const { html, plan } = renderScene(
      { id: "s", kind: "compare-table", props: GOOD["compare-table"] },
      ctx(),
    );
    expect(html).toContain("Pro");
    expect(at(plan, "sc-a-th")).toBeCloseTo(10);
    expect(at(plan, "sc-a-r1")).toBeCloseTo(12.44);
  });
  it("stack slides layers in from alternating sides", async () => {
    const { renderScene } = await scenes();
    const { plan } = renderScene({ id: "s", kind: "stack", props: GOOD.stack }, ctx());
    const x = (i: number) => plan.find((p) => p.id === `sc-a-y${i}`)!.frames[0].transform as string;
    expect(x(0)).toContain("translateX(-");
    expect(x(1)).not.toContain("translateX(-");
  });
  it("gauge fills its ring to exactly the value and counts to it", async () => {
    const { renderScene } = await scenes();
    const { html, plan } = renderScene({ id: "s", kind: "gauge", props: GOOD.gauge }, ctx());
    const arc = plan.find((p) => p.id === "sc-a-arc")!;
    const circ = 2 * Math.PI * 42;
    expect(arc.frames[0].strokeDashoffset).toBeCloseTo(circ, 1); // starts empty
    expect(arc.frames[1].strokeDashoffset).toBeCloseTo(circ * 0.13, 0); // 87%
    const shown = [...html.matchAll(/class="num-step">([^<]*)</g)].map((m) => m[1]);
    expect(shown.at(-1)).toBe("87");
    expect(plan.find((p) => p.id === "sc-a-g12w")).toBeUndefined(); // the last value is never hidden
  });
  it("rejects bad props with a readable reason", async () => {
    const { diagram2Problems } = await d2();
    expect(
      diagram2Problems("ranking", {
        items: [
          { label: "a", value: "5" },
          { label: "b", value: 1 },
        ],
      })[0],
    ).toContain("value");
    expect(
      diagram2Problems("checklist", { items: [{ text: "a", state: "maybe" }, { text: "b" }] })[0],
    ).toContain("state");
    expect(diagram2Problems("terminal", { lines: [{ text: "x".repeat(65) }] })[0]).toContain(
      "lines[0].text",
    );
    expect(
      diagram2Problems("compare-table", {
        columns: ["a", "b"],
        rows: [
          { label: "r", cells: ["only one"] },
          { label: "s", cells: ["x", "y"] },
        ],
      })[0],
    ).toContain("one text per column");
    expect(diagram2Problems("stack", { layers: [{ label: "one" }] })[0]).toContain("layers");
    expect(diagram2Problems("gauge", { value: 140, label: "x" })[0]).toContain("0 to 100");
    expect(diagram2Problems("gauge", { value: 50, label: "x", focus: "yes" })).toContain(
      "focus: true or false",
    );
  });
  it("escapes hostile text in every kind", async () => {
    const { renderScene } = await scenes();
    const bad = "<img src=x onerror=alert(1)>";
    const hostile: Record<string, Loose> = {
      ranking: {
        items: [
          { label: bad, value: 1 },
          { label: bad, value: 2 },
        ],
      },
      checklist: { title: bad, items: [{ text: bad }, { text: bad }] },
      terminal: { prompt: "<", lines: [{ text: bad }] },
      "compare-table": {
        columns: [bad, "b"],
        rows: [
          { label: bad, cells: [bad, bad] },
          { label: "x", cells: ["1", "2"] },
        ],
      },
      stack: { layers: [{ label: bad, detail: bad }, { label: bad }] },
      gauge: { value: 5, label: bad, unit: "<b>" },
    };
    for (const [kind, props] of Object.entries(hostile)) {
      const { html } = renderScene({ id: "s", kind, props }, ctx());
      expect(html, kind).not.toContain("<img");
      expect(html, kind).not.toContain("<b>%");
    }
  });
  it("are documented in the schema, scene-kinds.md, the catalog and video-write", async () => {
    const { DIAGRAM2_KINDS } = await d2();
    const read = (...p: string[]) =>
      readFileSync(path.join(__dirname, "..", "official", ...p), "utf8");
    const cat = JSON.parse(read("video-core", "assets", "scene-catalog.json"));
    for (const k of DIAGRAM2_KINDS) {
      expect(read("video-core", "assets", "video.schema.json"), k).toContain(`"${k}"`);
      expect(read("video-core", "references", "scene-kinds.md"), k).toContain(`\`${k}\``);
      expect(read("video-write", "scripts", "write-check.mjs"), k).toContain(`"${k}"`);
      expect(cat.kinds[k].use_when.length, k).toBeGreaterThanOrEqual(3);
    }
  });
});
