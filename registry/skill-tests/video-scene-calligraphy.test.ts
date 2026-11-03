import { describe, expect, it } from "vitest";
import { loadScript } from "./load";

type Loose = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
type Scenes = { renderScene: (scene: Loose, ctx: Loose) => { html: string; plan: Loose[] } };
type Cal = { calligraphyProblems: (p: Loose) => string[]; dirOf: (t: string) => string };
const scenes = () => loadScript<Scenes>("video-core", "assets/engine/hyperframes/scenes.mjs");
const cal = () => loadScript<Cal>("video-core", "assets/engine/hyperframes/calligraphy.mjs");
const ctx = (o: Loose = {}) => ({
  prefix: "sc-a",
  at: 1,
  seconds: 8,
  lines: [],
  lang: "ar",
  first: false,
  rise: 24,
  assets: new Map(),
  ...o,
});
const TEXT = "العلم نور والجهل ظلام";

describe("calligraphy scene", () => {
  it("keeps every word whole, in order, with the text's direction", async () => {
    const { renderScene } = await scenes();
    const { html, plan } = renderScene(
      { id: "s1", kind: "calligraphy", props: { text: TEXT } },
      ctx(),
    );
    expect(html).toContain('dir="rtl"');
    expect(html).toContain('lang="ar"');
    const words = [...html.matchAll(/class="cal-w">([^<]*)</g)].map((m) => m[1]);
    expect(words).toEqual(TEXT.split(" "));
    expect(plan.filter((p) => p.id.includes("-w")).map((p) => p.at)).toEqual(
      [...plan.filter((p) => p.id.includes("-w")).map((p) => p.at)].sort((a, b) => a - b),
    );
  });

  it("wipes from the right for Arabic and from the left for Latin text", async () => {
    const { renderScene } = await scenes();
    const first = (text: string) =>
      renderScene({ id: "s1", kind: "calligraphy", props: { text } }, ctx()).plan[0]!.frames[0]
        .clipPath;
    expect(first(TEXT)).toMatch(/100%\)$/);
    expect(first("Hello world")).toMatch(/^inset\(-40% 100%/);
  });

  it("follows narration lines when there is one per word and escapes text", async () => {
    const { renderScene } = await scenes();
    const lines = [{ start: 0 }, { start: 1 }];
    const { html, plan } = renderScene(
      { id: "s1", kind: "calligraphy", props: { text: "<i>x</i> y", translation: "<b>t</b>" } },
      ctx({ lines }),
    );
    expect(html).not.toContain("<i>");
    expect(html).not.toContain("<b>");
    expect(plan.filter((p) => p.id.includes("-w")).map((p) => p.at)).toEqual([1, 2]);
  });

  it("refuses control marks, pre-shaped letters, long text and bad options; accepts joiners", async () => {
    const { calligraphyProblems, dirOf } = await cal();
    expect(calligraphyProblems({ text: TEXT, reveal: "rise", font: "Amiri-Regular" })).toEqual([]);
    expect(calligraphyProblems({ text: "می‌خواهم" })).toEqual([]);
    expect(calligraphyProblems({ text: `a‮b` })[0]).toContain("control");
    expect(calligraphyProblems({ text: "ﺍﻣ" })[0]).toContain("pre-shaped");
    expect(calligraphyProblems({ text: "كلمة ".repeat(11) })[0]).toContain("words");
    expect(calligraphyProblems({ text: TEXT, font: "x;}body{" })[0]).toContain("font");
    expect(calligraphyProblems({ text: TEXT, reveal: "spin" })[0]).toContain("reveal");
    expect(dirOf(TEXT)).toBe("rtl");
    expect(dirOf("Hello")).toBe("ltr");
  });
});
