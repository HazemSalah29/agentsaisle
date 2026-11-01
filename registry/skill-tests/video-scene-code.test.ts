import { describe, expect, it } from "vitest";
import { loadScript } from "./load";

type Loose = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
type Scenes = { renderScene: (scene: Loose, ctx: Loose) => { html: string; plan: Loose[] } };
type Code = {
  codeProblems: (props: Loose, narration?: number) => string[];
  diffRows: (a: string, b: string) => { type: string; text: string }[];
};
const scenes = () => loadScript<Scenes>("video-core", "assets/engine/hyperframes/scenes.mjs");
const mod = () => loadScript<Code>("video-core", "assets/engine/hyperframes/code.mjs");

const ctx = (o: Record<string, unknown> = {}) => ({
  prefix: "sc-a",
  at: 1,
  seconds: 8,
  lines: [{ start: 0.5 }, { start: 3 }],
  lang: "en",
  first: false,
  rise: 24,
  assets: new Map(),
  ...o,
});
const SRC = "function allow(n) {\n  if (n < 1) return false;\n  return true;\n}";

describe("code scene", () => {
  it("highlights with real colours, one row per line, and numbers the lines", async () => {
    const { renderScene } = await scenes();
    const r = renderScene(
      { kind: "code", props: { language: "js", code: SRC, file: "a.js" } },
      ctx(),
    );
    expect(r.html.match(/class="ln /g)).toHaveLength(4);
    expect(r.html).toMatch(/style="color:#[0-9A-Fa-f]{6}">function</);
    expect(r.html).toContain('<span class="no">4</span>');
    expect(r.html).toContain("a.js");
    expect(r.html).not.toContain("<script");
  });

  it("shows hostile code, title and file name as text", async () => {
    const { renderScene } = await scenes();
    const bad = `</script><img src=x onerror=alert(1)>`;
    const r = renderScene(
      {
        kind: "code",
        props: { language: "js", code: `const a = "${bad}";`, title: bad, file: bad },
      },
      ctx(),
    );
    expect(r.html).not.toContain("<img");
    expect(r.html).not.toContain("</script");
    expect(r.html).toContain("&lt;img");
  });

  it("is identical for the same props", async () => {
    const { renderScene } = await scenes();
    const run = () =>
      JSON.stringify(
        renderScene(
          { kind: "code", props: { language: "python", code: "x = 1\nprint(x)" } },
          ctx(),
        ),
      );
    expect(run()).toBe(run());
  });

  it("dims everything outside the focused lines from the narration line's start", async () => {
    const { renderScene } = await scenes();
    const r = renderScene(
      { kind: "code", props: { language: "js", code: SRC, focus: [{ lines: [2, 2], line: 1 }] } },
      ctx(),
    );
    const dim = (i: number) => r.plan.find((p) => p.id === `sc-a-l${i}-t`);
    expect(dim(1)).toBeUndefined(); // the focused line never dims
    const f = dim(0)!.frames;
    expect(f[1]).toMatchObject({ offset: 3 / 8, opacity: 1 });
    expect(f[f.length - 1]).toMatchObject({ offset: 1, opacity: 0.28 });
    const offs = f.map((x: Loose) => x.offset);
    expect(offs).toEqual([...offs].sort((a, b) => a - b));
  });

  it("makes a diff: removed rows, added rows, shared rows in order", async () => {
    const { diffRows } = await mod();
    const rows = diffRows("a\nb\nc", "a\nB\nc\nd");
    expect(rows.map((r) => `${r.type}:${r.text}`)).toEqual([
      "same:a",
      "del:b",
      "add:B",
      "same:c",
      "add:d",
    ]);
    const { renderScene } = await scenes();
    const r = renderScene(
      {
        kind: "code",
        props: {
          language: "js",
          diff: { before: "let a = 1;\nlet b = 2;", after: "let a = 1;\nlet b = 3;" },
        },
      },
      ctx(),
    );
    expect(r.html).toContain("ln del");
    expect(r.html).toContain("ln add");
    expect(r.html).toContain('<span class="no">-</span>');
    expect(r.html).toContain('<span class="no">+</span>');
  });

  it("explains what is wrong with the props", async () => {
    const { codeProblems } = await mod();
    const p = codeProblems(
      {
        language: "cobol",
        code: "x".repeat(70),
        diff: { before: "a", after: "b" },
        focus: [
          { lines: [3, 1], at: 1, line: 0 },
          { lines: [1, 9], line: 5 },
        ],
      },
      2,
    ).join("\n");
    for (const part of ["language", "not both", "[first, last]", "either", "narration line"])
      expect(p).toContain(part);
    expect(codeProblems({ language: "js", code: "x".repeat(70) }).join()).toContain(
      "longer than 60",
    );
    expect(codeProblems({ language: "js", code: "a\n".repeat(25) }).join()).toContain(
      "more than 20 lines",
    );
    expect(
      codeProblems({ language: "js", code: "a\nb", focus: [{ lines: [1, 5], at: 1 }] }).join(),
    ).toContain("past the end");
    expect(codeProblems({ language: "ts", code: SRC })).toEqual([]);
  });

  it("an unknown language is refused by check", async () => {
    const { checkProject } = await loadScript<{
      checkProject: (v: unknown, d: string) => string[];
    }>("video-core", "scripts/check.mjs");
    const video = {
      version: 1,
      meta: { title: "t", type: "explainer", format: "reel-9x16", fps: 30, lang: "en" },
      scenes: [
        {
          id: "s1",
          kind: "code",
          durationFrom: "fixed",
          seconds: 6,
          props: { language: "cobol", code: "x" },
        },
      ],
    };
    expect(checkProject(video, ".").join()).toContain("props.language");
  });
});
