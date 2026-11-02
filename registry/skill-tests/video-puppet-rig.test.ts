import { describe, expect, it } from "vitest";
import { loadScript } from "./load";
import { SHAPE, sampleRig } from "./video-puppet-fixtures";

type Loose = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
type Rig = {
  VISEMES: string[];
  REQUIRED: string[];
  fragmentProblems: (s: unknown) => string[];
  rigProblems: (r: unknown) => string[];
  partTree: (r: Loose) => Loose[];
};
type Rig2 = Rig & {
  fragmentProblems: (s: unknown, g?: Set<string>) => string[];
  gradientDefs: (g: Loose, p: string) => string;
  bindGradients: (s: string, p: string) => string;
};
const rigMod2 = () => loadScript<Rig2>("video-core", "assets/puppet/rig.mjs");
const rigMod = () => loadScript<Rig>("video-core", "assets/puppet/rig.mjs");

describe("puppet rig SVG fragments", () => {
  it("accepts plain shapes and groups", async () => {
    const { fragmentProblems } = await rigMod();
    expect(
      fragmentProblems(
        '<g transform="translate(5, 5) rotate(10)"><path d="M0 0 L10 10 Z" fill="#fff" stroke="none"/><rect x="1" y="2" width="3" height="4"/><line x1="1" y1="2" x2="3" y2="4" stroke="#000" stroke-width="2"/></g>',
      ),
    ).toEqual([]);
  });
  it.each([
    ["a script", "<script>alert(1)</script>"],
    ["an image", '<image href="https://example.invalid/a.png"/>'],
    ["a foreign object", "<foreignObject><div/></foreignObject>"],
    ["an event handler", '<circle cx="1" cy="1" r="1" onload="x()"/>'],
    ["a link", '<path d="M0 0" href="https://example.invalid"/>'],
    ["a url() paint", '<circle cx="1" cy="1" r="1" fill="url(#a)"/>'],
    ["a style attribute", '<circle cx="1" cy="1" r="1" style="fill:red"/>'],
    ["a javascript transform", '<g transform="javascript:alert(1)"/>'],
    ["a comment", "<!-- hi --><circle cx='1' cy='1' r='1'/>"],
    ["text outside tags", 'hello<circle cx="1" cy="1" r="1"/>'],
    ["an unclosed group", '<g><circle cx="1" cy="1" r="1"/>'],
    ["an entity", '<circle cx="1" cy="1" r="1" fill="&#35;fff"/>'],
    ["a bad number in a digit attribute", '<line x1="a" y1="2" x2="3" y2="4"/>'],
    [
      "an attribute written twice",
      '<circle cx="1" cy="1" r="1" stroke-width="2" stroke-width="3"/>',
    ],
    ["a gradient the rig does not define", '<circle cx="1" cy="1" r="1" fill="url(#g:nope)"/>'],
    ["a non-number size", '<circle cx="1" cy="1" r="big"/>'],
    ["an empty string", ""],
    ["a non-string", 5],
  ])("rejects %s", async (_n, svg) => {
    const { fragmentProblems } = await rigMod();
    expect(fragmentProblems(svg).length).toBeGreaterThan(0);
  });
  it("rejects a fragment that is too long", async () => {
    const { fragmentProblems } = await rigMod();
    expect(fragmentProblems(SHAPE.repeat(100))[0]).toMatch(/longer than/);
  });
});

describe("puppet rig", () => {
  it("accepts a complete rig and builds the part tree", async () => {
    const { rigProblems, partTree, REQUIRED, VISEMES } = await rigMod();
    expect(rigProblems(sampleRig())).toEqual([]);
    expect(REQUIRED).toHaveLength(8 + VISEMES.length);
    const tree = partTree(sampleRig());
    expect(tree.map((t) => t.id)).toEqual(["body"]);
    expect(tree[0].children.map((c: Loose) => c.id)).toContain("head");
  });
  it("names each missing required part", async () => {
    const { rigProblems } = await rigMod();
    const rig = sampleRig();
    rig.parts = rig.parts.filter((p: Loose) => p.id !== "mouth-o" && p.id !== "leg-l");
    const out = rigProblems(rig).join("\n");
    expect(out).toContain('"mouth-o" is missing');
    expect(out).toContain('"leg-l" is missing');
  });
  it("rejects bad palettes, boxes, pivots, ids and parents", async () => {
    const { rigProblems } = await rigMod();
    expect(rigProblems(sampleRig({ palette: ["#fff", "#000"] })).join()).toMatch(/palette/);
    expect(rigProblems(sampleRig({ palette: ["red", "#000", "#fff"] })).join()).toMatch(/palette/);
    expect(rigProblems(sampleRig({ box: { w: 10, h: 10 } })).join()).toMatch(/box/);
    const outside = sampleRig();
    outside.parts[0].pivot = [999, 0];
    expect(rigProblems(outside).join()).toMatch(/pivot/);
    const dup = sampleRig();
    dup.parts[1].id = "body";
    expect(rigProblems(dup).join()).toMatch(/used twice/);
    const orphan = sampleRig();
    orphan.parts[2].parent = "nope";
    expect(rigProblems(orphan).join()).toMatch(/not a part/);
    const loop = sampleRig();
    loop.parts[0].parent = "head";
    expect(rigProblems(loop).join()).toMatch(/loop/);
  });
  it("names the part whose SVG is hostile", async () => {
    const { rigProblems } = await rigMod();
    const rig = sampleRig();
    rig.parts[3].svg = "<script>x</script>";
    expect(rigProblems(rig).join()).toMatch(/arm-r.*<script>/);
  });
  it("is not fooled by non-objects", async () => {
    const { rigProblems } = await rigMod();
    expect(rigProblems(null)).toHaveLength(1);
    expect(rigProblems({ ...sampleRig(), parts: "x" }).join()).toMatch(/parts/);
  });
});

describe("puppet rig gradients", () => {
  const grad = {
    type: "radial",
    stops: [
      { o: 0, c: "#ffffff" },
      { o: 1, c: "#000000", a: 0.5 },
    ],
  };
  it("accepts a defined gradient and builds ids that cannot collide", async () => {
    const { rigProblems, fragmentProblems, gradientDefs, bindGradients } = await rigMod2();
    const rig = sampleRig({ gradients: { skin: grad } });
    rig.parts[0].svg = '<circle cx="10" cy="10" r="5" fill="url(#g:skin)"/>';
    expect(rigProblems(rig)).toEqual([]);
    expect(
      fragmentProblems('<circle cx="1" cy="1" r="1" fill="url(#g:skin)"/>', new Set(["skin"])),
    ).toEqual([]);
    expect(gradientDefs(rig.gradients, "c0")).toContain('<radialGradient id="c0-g-skin">');
    expect(gradientDefs(rig.gradients, "c0")).toContain('stop-opacity="0.5"');
    expect(bindGradients('fill="url(#g:skin)"', "c1")).toBe('fill="url(#c1-g-skin)"');
  });
  it("refuses undefined or malformed gradients", async () => {
    const { rigProblems } = await rigMod2();
    const missing = sampleRig();
    missing.parts[0].svg = '<circle cx="10" cy="10" r="5" fill="url(#g:skin)"/>';
    expect(rigProblems(missing).join()).toMatch(/does not define/);
    expect(rigProblems(sampleRig({ gradients: { Bad: grad } })).join()).toMatch(
      /name is lower-case/,
    );
    expect(
      rigProblems(sampleRig({ gradients: { a: { type: "conic", stops: [] } } })).join(),
    ).toMatch(/type/);
    expect(
      rigProblems(sampleRig({ gradients: { a: { ...grad, stops: [grad.stops[0]] } } })).join(),
    ).toMatch(/stops/);
    expect(
      rigProblems(
        sampleRig({
          gradients: {
            a: {
              ...grad,
              stops: [
                { o: 0.8, c: "#fff" },
                { o: 0.2, c: "#000" },
              ],
            },
          },
        }),
      ).join(),
    ).toMatch(/rising/);
    expect(rigProblems(sampleRig({ gradients: { a: { ...grad, cx: 99 } } })).join()).toMatch(/cx/);
  });
});
