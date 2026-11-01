import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadLib, skillFile } from "./load";

type Lib = {
  ArchExport: {
    slug: (n: unknown) => string;
    fileName: (p: string, e: string, s?: string) => string;
    xmlEscape: (t: unknown) => string;
    svgDocument: (o: {
      width: number;
      height: number;
      background?: string;
      title: string;
      note: string;
      lang?: string;
      dir?: string;
      body: string;
    }) => string;
    scaleFor: (w: number, h: number, wanted: number) => number;
    STYLE_PROPS: string[];
    FOOTER_H: number;
  };
};
const { ArchExport: X } = loadLib<Lib>("arch-visualize", ["assets/lib/export.js"]);
const hostile = JSON.parse(
  readFileSync(skillFile("arch-visualize", "evals/hostile-model.json"), "utf8"),
) as { project: string; nodes: { label: string }[] };

describe("arch-visualize export helpers", () => {
  it("makes safe ASCII file names", () => {
    expect(X.slug("Shop API")).toBe("shop-api");
    expect(X.slug("../../etc/passwd")).toBe("etc-passwd");
    expect(X.slug("نظام المتجر")).toBe("architecture");
    expect(X.slug("")).toBe("architecture");
    expect(X.slug(undefined)).toBe("architecture");
    expect(X.slug("a".repeat(100)).length).toBeLessThanOrEqual(40);
    expect(X.slug(".hidden")).toBe("hidden");
    expect(X.fileName("Shop", "svg")).toBe("shop.architecture.svg");
    expect(X.fileName("Shop", "png", "@2x")).toBe("shop.architecture@2x.png");
    for (const p of ["a/b", "..", "C:\\x", hostile.project])
      expect(X.fileName(p, "svg")).toMatch(/^[a-z0-9.@-]+$/);
  });

  it("escapes XML and drops characters XML cannot hold", () => {
    expect(X.xmlEscape(`<a href="x" b='y'>&</a>`)).toBe(
      "&lt;a href=&quot;x&quot; b=&apos;y&apos;&gt;&amp;&lt;/a&gt;",
    );
    expect(X.xmlEscape("a\u0000b\u0008c\u000Bd\u001Fe")).toBe("abcde");
    expect(X.xmlEscape("tab\tnewline\nok")).toBe("tab\tnewline\nok");
    expect(X.xmlEscape(undefined)).toBe("");
    for (const text of [hostile.project, ...hostile.nodes.map((n) => n.label)])
      expect(X.xmlEscape(text)).not.toMatch(/[<>"']/);
  });

  it("builds a standalone SVG with the title and the honesty line escaped", () => {
    const svg = X.svgDocument({
      width: 400,
      height: 200,
      background: "#ffffff",
      title: hostile.project,
      note: "Generated from code; not live traffic.",
      body: "<g/>",
    });
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
    expect(svg).toContain(`viewBox="0 0 400 ${200 + X.FOOTER_H}"`);
    expect(svg).toContain("Generated from code; not live traffic.");
    expect(svg.match(/<svg/g)).toHaveLength(1);
    expect(svg.match(/<\/svg>/g)).toHaveLength(1);
    // only our own tags exist: the hostile text came out as escaped text
    const tags = [...svg.matchAll(/<\/?([a-zA-Z][\w:-]*)/g)].map((m) => m[1]);
    expect([...new Set(tags)].sort()).toEqual(["g", "rect", "svg", "text", "title"]);
    expect(svg.replace(/xmlns="[^"]*"/, "")).not.toMatch(/https?:\/\//);
    // the project name is data: no raw angle bracket survives outside our own tags
    const inner = svg.slice(svg.indexOf("<title>") + 7, svg.indexOf("</title>"));
    expect(inner).not.toMatch(/[<>]/);
  });

  it("puts the footer on the reading side in right-to-left", () => {
    const rtl = X.svgDocument({
      width: 400,
      height: 100,
      title: "t",
      note: "n",
      body: "",
      dir: "rtl",
      lang: "ar",
    });
    expect(rtl).toContain('lang="ar"');
    expect(rtl).toContain('direction="rtl"');
    expect(rtl).toContain('x="384"');
    const ltr = X.svgDocument({ width: 400, height: 100, title: "t", note: "n", body: "" });
    expect(ltr).toContain('x="16"');
  });

  it("limits the PNG scale to what a canvas can hold", () => {
    expect(X.scaleFor(1000, 500, 3)).toBe(3);
    expect(X.scaleFor(1000, 500, 1)).toBe(1);
    expect(X.scaleFor(10000, 500, 3)).toBeLessThan(2); // 16,000 px side limit
    const big = X.scaleFor(9000, 9000, 3);
    expect(9000 * big * 9000 * big).toBeLessThanOrEqual(100000000);
    for (const [w, h] of [
      [100, 100],
      [8000, 3000],
      [20000, 20000],
    ] as const) {
      const s = X.scaleFor(w, h, 3);
      expect(w * s).toBeLessThanOrEqual(16000);
      expect(h * s).toBeLessThanOrEqual(16000);
      expect(s).toBeGreaterThan(0);
    }
    expect(X.scaleFor(1000, 500, 2)).toBeLessThanOrEqual(X.scaleFor(1000, 500, 3));
  });

  it("copies only style properties that cannot load anything", () => {
    for (const p of X.STYLE_PROPS)
      expect(p, p).not.toMatch(/image|content|filter|mask|clip|cursor|src|url|marker|font-face/);
    expect(new Set(X.STYLE_PROPS).size).toBe(X.STYLE_PROPS.length);
    expect(X.STYLE_PROPS).toContain("fill");
    expect(X.STYLE_PROPS).toContain("stroke-dasharray");
  });
});
