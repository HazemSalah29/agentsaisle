import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadLib, skillFile } from "./load";

type View = { x: number; y: number; k: number };
type Plan = {
  stage: number[];
  size: number[];
  inset: number;
  c: number[];
  m0: number;
  k0: number;
  c0: number[];
  end: View;
};
type Frame = View & { m: number; overview: number; detail: number };
type Rect = { x: number; y: number; w: number; h: number };
type Sym = {
  id: string;
  name: string;
  kind: string;
  file: string;
  line: number;
  calls: { to: string; name: string; line: number; in: string | null }[];
  renders: { to?: string; name: string; line: number; in?: string | null }[];
  fetches: { url: string; method: string; line: number; to?: string; in?: string | null }[];
  rpc: {
    path: string;
    kind: string;
    line: number;
    to?: string;
    inferred?: boolean;
    in?: string | null;
  }[];
  calledBy: string[];
  loops: number;
  branches: number;
};
type Node = { id: string; detail?: { scope: string; symbols: Sym[] } };
type Model = {
  nodes: Node[];
  edges: { id: string; from: string; to: string; via?: unknown[] }[];
} & Record<string, unknown>;
type Lib = {
  ArchZoom: {
    ease: (t: number) => number;
    smoothstep: (a: number, b: number, x: number) => number;
    logLerp: (a: number, b: number, t: number) => number;
    fitInner: (stage: number[], size: number[], c: number[], o?: Record<string, number>) => View;
    plan: (o: Record<string, unknown>) => Plan;
    frame: (p: Plan, e: number) => Frame;
    reverse: (p: Plan, cur: View, e: number) => Frame;
    innerTransform: (p: Plan, m: number) => string;
    worldOf: (p: Plan, pos: Rect) => number[];
  };
  ArchDetail: {
    index: (m: Model) => { byId: Record<string, Sym>; nodeOf: Record<string, string> };
    refs: (
      x: Sym,
    ) => { to: string; kind: string; label: string; in: string | null; inferred?: boolean }[];
    build: (
      n: Node,
      labels: Record<string, string>,
    ) => {
      layoutModel: {
        nodes: { id: string; tier: string; group: string }[];
        edges: { id: string; from: string; to: string; protocol: string }[];
        groups: { id: string; label: string }[];
      };
      edges: {
        id: string;
        from: string;
        to: string;
        kind: string;
        in: string | null;
        label: string;
        inferred: boolean;
      }[];
      depth: Record<string, number>;
    };
    links: (
      m: Model,
      id: string,
    ) => {
      out: { to: string; kind: string; node: string }[];
      in: { from: string; kind: string; node: string }[];
    };
  };
  ArchHash: {
    parseHash: (s: string) => Record<string, string | number>;
    buildHash: (s: Record<string, unknown>) => string;
  };
  ArchLayout: {
    layout: (
      m: unknown,
      o?: Record<string, unknown>,
    ) => {
      pos: Record<string, Rect>;
      routes: Record<string, { d: string }>;
      size: { w: number; h: number };
    };
    layoutHash: (r: unknown) => string;
  };
  ArchGeometry: { rectsOverlap: (a: Rect, b: Rect, gap?: number) => boolean };
};

const lib = loadLib<Lib>("arch-visualize", [
  "assets/lib/geometry.js",
  "assets/lib/layout.js",
  "assets/lib/hash.js",
  "assets/lib/zoom.js",
  "assets/lib/detail.js",
]);
const Z = lib.ArchZoom;
const D = lib.ArchDetail;
const near = (a: number, b: number, eps = 1e-6) => expect(Math.abs(a - b)).toBeLessThan(eps);

describe("zoom: camera path", () => {
  const stage = [1000, 700];
  const node = { x: 400, y: 300, w: 190, h: 64 };
  const view = { x: 40, y: 20, k: 1.25 };
  const p = () => Z.plan({ stage, size: [900, 600], node, view, inset: 60 });
  const boxCentre = (v: View) => [
    v.x + v.k * (node.x + node.w / 2),
    v.y + v.k * (node.y + node.h / 2),
  ];

  it("eases in and out and stays inside 0..1", () => {
    expect(Z.ease(0)).toBe(0);
    expect(Z.ease(1)).toBe(1);
    expect(Z.ease(0.5)).toBeCloseTo(0.5, 6);
    let last = -1;
    for (let i = 0; i <= 20; i++) {
      const v = Z.ease(i / 20);
      expect(v).toBeGreaterThanOrEqual(last);
      last = v;
    }
    expect(Z.ease(-3)).toBe(0);
    expect(Z.ease(9)).toBe(1);
  });

  it("starts exactly on the system diagram, with the inner diagram sitting inside the box", () => {
    const f = p();
    const a = Z.frame(f, 0);
    near(a.x, view.x);
    near(a.y, view.y);
    near(a.k, view.k);
    expect(a.overview).toBe(1);
    expect(a.detail).toBe(0);
    expect(a.m).toBeLessThan(0.3);
    // the inner diagram's middle is the box's middle, so the eye sees the box open up
    const tr = Z.innerTransform(f, a.m);
    expect(tr).toMatch(/^translate\(.+\) scale\(.+\)$/);
    expect(f.m0 * 900).toBeLessThanOrEqual(node.w);
    expect(f.m0 * 600).toBeLessThanOrEqual(node.h);
  });

  it("ends on the finished camera with only the inner diagram visible", () => {
    const f = p();
    const b = Z.frame(f, 1);
    near(b.x, f.end.x);
    near(b.y, f.end.y);
    near(b.k, f.end.k);
    near(b.m, 1);
    expect(b.overview).toBe(0);
    expect(b.detail).toBe(1);
  });

  it("keeps the box centre travelling in a straight line while the zoom speed stays even", () => {
    const f = p();
    const c0 = boxCentre(Z.frame(f, 0));
    const c1 = boxCentre(Z.frame(f, 1));
    for (const e of [0.25, 0.5, 0.75]) {
      const c = boxCentre(Z.frame(f, e));
      near(c[0]!, c0[0]! + (c1[0]! - c0[0]!) * e, 1e-6);
      near(c[1]!, c0[1]! + (c1[1]! - c0[1]!) * e, 1e-6);
    }
    // log interpolation: equal steps multiply the scale by the same factor
    const k = [0, 1 / 3, 2 / 3, 1].map((e) => Z.frame(f, e).k);
    near(k[1]! / k[0]!, k[2]! / k[1]!, 1e-9);
    near(k[2]! / k[1]!, k[3]! / k[2]!, 1e-9);
  });

  it("fades one layer out while the other fades in, never both fully on at the middle", () => {
    const f = p();
    let o = 2;
    let d = -1;
    for (let i = 0; i <= 20; i++) {
      const fr = Z.frame(f, i / 20);
      expect(fr.overview).toBeLessThanOrEqual(o + 1e-12);
      expect(fr.detail).toBeGreaterThanOrEqual(d - 1e-12);
      o = fr.overview;
      d = fr.detail;
    }
    const mid = Z.frame(f, 0.5);
    expect(mid.overview + mid.detail).toBeLessThan(1.4);
  });

  it("goes back from wherever the camera has been moved to the exact view it left", () => {
    const f = p();
    const panned = { x: -300, y: 90, k: 0.8 };
    const start = Z.reverse(f, panned, 0);
    near(start.x, panned.x);
    near(start.y, panned.y);
    near(start.k, panned.k);
    near(start.m, 1);
    expect(start.detail).toBe(1);
    const end = Z.reverse(f, panned, 1);
    near(end.x, view.x);
    near(end.y, view.y);
    near(end.k, view.k);
    expect(end.overview).toBe(1);
    expect(end.detail).toBe(0);
  });

  it("keeps text readable on a tall diagram: top-aligned at the floor zoom instead of shrinking to fit", () => {
    const tall = Z.fitInner(stage, [800, 3000], [500, 400], { inset: 60, minK: 0.65 });
    near(tall.k, 0.65);
    // the top of the diagram (centre y minus half the height) sits just under the inset
    near(tall.y + tall.k * (400 - 1500), 60 + 14, 1e-6);
    const small = Z.fitInner(stage, [400, 300], [500, 400], { inset: 60, minK: 0.65 });
    expect(small.k).toBeGreaterThan(0.65);
    // small diagrams are centred in the room below the inset
    near(small.x + small.k * 500, stage[0]! / 2);
    near(small.y + small.k * 400, 60 + (stage[1]! - 60) / 2);
    const all = Z.fitInner(stage, [800, 3000], [500, 400], { inset: 60 });
    expect(all.k).toBeLessThan(0.65);
  });

  it("finds a card's place in diagram coordinates once the inner diagram is full size", () => {
    const f = p();
    const w = Z.worldOf(f, { x: 100, y: 50, w: 210, h: 84 });
    near(w[0]!, f.c[0]! - 450 + 100 + 105);
    near(w[1]!, f.c[1]! - 300 + 50 + 42);
  });
});

const call = (to: string, name: string, inCtx: string | null = null) => ({
  to,
  name,
  line: 1,
  in: inCtx,
});
const sym = (id: string, extra: Partial<Sym> = {}): Sym => ({
  id,
  name: id.split("#")[1]!,
  kind: "function",
  file: id.split("#")[0]!,
  line: 3,
  calls: [],
  renders: [],
  fetches: [],
  rpc: [],
  calledBy: [],
  loops: 0,
  branches: 0,
  ...extra,
});
const labels = { loop: "in a loop", branch: "if", render: "renders", fetch: "HTTP", rpc: "tRPC" };

describe("detail: the inner diagram's model", () => {
  const A = "a.ts#a",
    B = "b.ts#b",
    C = "b.ts#c",
    E = "c.ts#e";
  const node: Node = {
    id: "n",
    detail: {
      scope: "x",
      symbols: [
        sym(A, { calls: [call(B, "b", "branch"), call(C, "c"), call(C, "c", "loop")] }),
        sym(B, { calls: [call(E, "e")] }),
        sym(C, { renders: [{ to: E, name: "E", line: 2 }] }),
        sym(E),
      ],
    },
  };

  it("puts entry points first and every step of a call chain one column on", () => {
    const d = D.build(node, labels);
    expect(d.depth).toEqual({ [A]: 0, [B]: 1, [C]: 1, [E]: 2 });
    const tier = Object.fromEntries(d.layoutModel.nodes.map((n) => [n.id, n.tier]));
    expect(tier[A]).toBe("clients");
    expect(tier[B]).toBe("edge");
    expect(tier[E]).toBe("frontend");
  });

  it("groups symbols by file, one box per file", () => {
    const d = D.build(node, labels);
    expect(d.layoutModel.groups.map((g) => g.label)).toEqual(["a.ts", "b.ts", "c.ts"]);
    const g = Object.fromEntries(d.layoutModel.nodes.map((n) => [n.id, n.group]));
    expect(g[B]).toBe(g[C]);
    expect(g[A]).not.toBe(g[B]);
  });

  it("draws one link per pair and kind, and a loop beats a branch beats nothing", () => {
    const d = D.build(node, labels);
    const ac = d.edges.filter((e) => e.from === A && e.to === C);
    expect(ac).toHaveLength(1);
    expect(ac[0]!.in).toBe("loop");
    expect(ac[0]!.label).toBe("in a loop");
    expect(d.edges.find((e) => e.from === A && e.to === B)!.label).toBe("if");
    expect(d.edges.find((e) => e.from === C && e.to === E)!.label).toBe("renders");
    expect(d.edges.find((e) => e.from === B && e.to === E)!.label).toBe("");
  });

  it("copes with a cycle (a recursive pair) and with a symbol that calls itself", () => {
    const cyc: Node = {
      id: "n",
      detail: {
        scope: "x",
        symbols: [
          sym("a.ts#a", { calls: [call("a.ts#b", "b"), call("a.ts#a", "a")] }),
          sym("a.ts#b", { calls: [call("a.ts#a", "a")] }),
        ],
      },
    };
    const d = D.build(cyc, labels);
    expect(Object.keys(d.depth).sort()).toEqual(["a.ts#a", "a.ts#b"]);
    expect(d.edges).toHaveLength(2);
    expect(d.edges.every((e) => e.from !== e.to)).toBe(true);
  });

  it("ignores links to symbols that are not in this node and builds an empty node without failing", () => {
    const one: Node = {
      id: "n",
      detail: { scope: "x", symbols: [sym(A, { calls: [call("zzz.ts#gone", "gone")] })] },
    };
    expect(D.build(one, labels).edges).toEqual([]);
    expect(D.build({ id: "n" }, labels).layoutModel.nodes).toEqual([]);
  });

  it("lays out with the shared layout module: no overlapping cards and a route for every link", () => {
    const many: Sym[] = [];
    for (let i = 0; i < 40; i++)
      many.push(
        sym(`f${i % 6}.ts#s${i}`, {
          calls:
            i < 39 ? [call(`f${(i + 1) % 6}.ts#s${i + 1}`, "x", i % 5 === 0 ? "loop" : null)] : [],
        }),
      );
    const d = D.build({ id: "n", detail: { scope: "x", symbols: many } }, labels);
    const L = lib.ArchLayout.layout(d.layoutModel, {
      nodeW: 210,
      nodeH: 84,
      labelText: (e: { protocol?: string }) => e.protocol || "",
    });
    const ids = Object.keys(L.pos);
    expect(ids).toHaveLength(40);
    for (let i = 0; i < ids.length; i++)
      for (let j = i + 1; j < ids.length; j++)
        expect(lib.ArchGeometry.rectsOverlap(L.pos[ids[i]!]!, L.pos[ids[j]!]!, 0)).toBe(false);
    for (const e of d.edges) expect(L.routes[e.id]?.d).toMatch(/^M/);
    const again = lib.ArchLayout.layout(
      D.build({ id: "n", detail: { scope: "x", symbols: many } }, labels).layoutModel,
      { nodeW: 210, nodeH: 84, labelText: (e: { protocol?: string }) => e.protocol || "" },
    );
    expect(lib.ArchLayout.layoutHash(again)).toBe(lib.ArchLayout.layoutHash(L));
  });
});

describe("detail: links across components", () => {
  const model: Model = {
    nodes: [
      {
        id: "web",
        detail: {
          scope: "w",
          symbols: [
            sym("w.tsx#Page", {
              rpc: [{ path: "x.get", kind: "query", line: 1, to: "s.ts#get", inferred: true }],
            }),
          ],
        },
      },
      {
        id: "api",
        detail: {
          scope: "s",
          symbols: [sym("s.ts#get", { calls: [call("s.ts#h", "h")] }), sym("s.ts#h")],
        },
      },
    ],
    edges: [],
  };

  it("finds what a symbol goes to and what goes to it, with the component each one belongs to", () => {
    const out = D.links(model, "w.tsx#Page");
    expect(out.out).toEqual([
      expect.objectContaining({ to: "s.ts#get", kind: "rpc", node: "api", inferred: true }),
    ]);
    const into = D.links(model, "s.ts#get");
    expect(into.in).toEqual([
      expect.objectContaining({ from: "w.tsx#Page", kind: "rpc", node: "web" }),
    ]);
    expect(into.out[0]!.to).toBe("s.ts#h");
    expect(D.links(model, "nope")).toEqual({ out: [], in: [] });
  });

  it("indexes every symbol of every node", () => {
    const idx = D.index(model);
    expect(Object.keys(idx.byId).sort()).toEqual(["s.ts#get", "s.ts#h", "w.tsx#Page"]);
    expect(idx.nodeOf["s.ts#h"]).toBe("api");
  });
});

describe("deep links to the inside of a component", () => {
  const H = lib.ArchHash;
  it("round-trips the open component and the selected symbol", () => {
    const id = "packages/trpc/server/routers/viewer/calendars/_router.tsx#setDestinationCalendar";
    const hash = H.buildHash({ in: "api", sym: id, k: 0.65, x: 12, y: 30 });
    expect(hash).toBe(`#in=api&sym=${encodeURIComponent(id)}&x=12&y=30&k=0.65`);
    expect(H.parseHash(hash)).toEqual({ in: "api", sym: id, x: 12, y: 30, k: 0.65 });
  });

  it("handles Next.js route folders in a symbol id and drops anything unsafe", () => {
    const ok = "apps/web/app/(auth)/api/[id]/route.ts#GET";
    expect(H.parseHash(`#sym=${encodeURIComponent(ok)}`).sym).toBe(ok);
    for (const bad of [
      "a.ts",
      "a b.ts#x",
      "<script>#x",
      'a.ts#"x',
      "a.ts#x y",
      `${"a".repeat(300)}#x`,
      "a\\b.ts#x",
    ])
      expect(H.parseHash(`#sym=${encodeURIComponent(bad)}`)).toEqual({});
    expect(H.parseHash("#in=Not%20An%20Id")).toEqual({});
    expect(H.buildHash({ sym: "<bad>#x" })).toBe("");
  });

  it("keeps the order of the older keys, so existing links are unchanged", () => {
    expect(H.buildHash({ lens: "flows", node: "redis", k: 1.2 })).toBe(
      "#lens=flows&node=redis&k=1.2",
    );
  });
});

describe("the page with an inside view", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "zoom-"));
  const build = () => {
    const model = JSON.parse(
      readFileSync(skillFile("arch-visualize", "evals/fixture-model.json"), "utf8"),
    ) as Model;
    const owner = model.nodes[0] as Node & Record<string, unknown>;
    const a = sym("src/a.ts#a", {
      calls: [call("src/a.ts#b", "b", "loop")],
      doc: "Starts the work.",
    } as Partial<Sym>);
    const b = sym("src/a.ts#b");
    owner.detail = { scope: "src", symbols: [a, b] };
    (model as Record<string, unknown>).version = 3;
    const file = path.join(dir, "m.json");
    writeFileSync(file, JSON.stringify(model));
    const out = path.join(dir, "page.html");
    const r = spawnSync(
      process.execPath,
      [skillFile("arch-visualize", "scripts/render.mjs"), "--model", file, "--out", out],
      { encoding: "utf8" },
    );
    return { r, html: r.status === 0 ? readFileSync(out, "utf8") : "" };
  };

  it("renders, still as one offline file with six script blocks and no network use", () => {
    const { r, html } = build();
    expect(r.status, r.stderr + r.stdout).toBe(0);
    expect(html.match(/<\/script/gi)).toHaveLength(6);
    expect(html).toContain('id="crumbs"');
    expect(html).toContain("ArchZoom");
    expect(html).toContain("ArchDetail");
    expect(html).not.toMatch(
      /\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon)\s*\(|https?:\/\/(?!www\.w3\.org)/,
    );
  });

  it("carries the inside of the component as data, with text that is escaped", () => {
    const { html } = build();
    const model = JSON.parse(
      /<script type="application\/json" id="model">\s*([\s\S]*?)\s*<\/script>/.exec(html)![1]!,
    ) as Model;
    expect(model.nodes[0]!.detail!.symbols.map((s) => s.name)).toEqual(["a", "b"]);
  });
});

describe("the viewer code for the inside view", () => {
  const read = (rel: string) =>
    readFileSync(skillFile("arch-visualize", `assets/viewer/${rel}`), "utf8");
  const detail = read("src/35-detail.js");

  it("only builds text from model data as text nodes, never as markup", () => {
    expect(detail).not.toMatch(/innerHTML|outerHTML|insertAdjacentHTML|document\.write|\beval\(/);
  });

  it("zooms only into a component that has symbols, and leaves the stage alone when it is hidden", () => {
    expect(detail).toMatch(/if \(!n \|\| !n\.detail \|\| !n\.detail\.symbols\.length\) return;/);
    expect(detail).toMatch(/if \(!size\[0\] \|\| !size\[1\]\)/);
  });

  it("draws the inside inside the viewport so pan and zoom keep working, and exports the system diagram", () => {
    expect(detail).toMatch(/vp\.append\(detailLayer\)/);
    expect(read("src/75-export.js")).toMatch(/systemViewForExport\(\)/);
    expect(read("styles.css")).toMatch(/@media print[\s\S]*?#detail/);
  });

  it("goes back with Esc, the Back button and a lens tab, and the Fit button fits the inside", () => {
    expect(detail).toMatch(/ev\.key !== "Escape" \|\| !dState\.open/);
    expect(detail).toMatch(/\$\("crumb-back"\)\.addEventListener/);
    expect(read("src/55-lens.js")).toMatch(/if \(dState\.open\) closeDetail\(true\)/);
    expect(read("src/20-camera.js")).toMatch(/if \(dState && dState\.open\) return fitDetail\(\)/);
  });

  it("keeps card text readable in Arabic: no text-anchor on the main lines, only the x position changes", () => {
    // SVG text-anchor follows the reading direction, so "end" would push Arabic text out of its card
    expect(detail).toMatch(/var side = RTL \? DETAIL_W - 12 : 12;/);
    const cardText = detail.slice(detail.indexOf('class: "kind"'), detail.indexOf('class: "doc"'));
    expect(cardText).not.toMatch(/text-anchor/);
  });

  it("offers the list instead of a dead Zoom button when the diagram is hidden (phone width)", () => {
    expect(detail).toMatch(/var canZoom = stageSize\(\)\[0\] > 0;/);
    expect(detail).toMatch(/if \(canZoom && dState\.open !== n\.id\)/);
  });

  it("opens from a double-click, the Z key, the panel button and a deep link", () => {
    const draw = read("src/10-layout-draw.js");
    expect(draw).toMatch(/addEventListener\("dblclick"/);
    expect(draw).toMatch(/ev\.key === "z"/);
    expect(detail).toMatch(/t\("detail\.open"\)/);
    expect(read("src/70-links.js")).toMatch(/openDetail\(want\.in, want\.sym, true\)/);
  });
});

// A real browser run of the animated zoom. It needs Chrome and a machine that allows a headless browser, so it is
// skipped where there is none (CI). The page gets a timer in place of requestAnimationFrame, which headless Chrome
// fires only once under virtual time; the viewer code itself is untouched.
const chrome = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
].find((p) => existsSync(p));
describe.skipIf(!chrome || Boolean(process.env.CI))("the zoom in a real browser", () => {
  it("zooms in, selects a function, steps back out, and returns to the exact starting view", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "zoom-chrome-"));
    const model = JSON.parse(
      readFileSync(skillFile("arch-visualize", "evals/fixture-model.json"), "utf8"),
    ) as Model;
    const owner = model.nodes[0] as Node & Record<string, unknown>;
    owner.detail = {
      scope: "src",
      symbols: [sym("src/a.ts#a", { calls: [call("src/a.ts#b", "b", "loop")] }), sym("src/a.ts#b")],
    };
    (model as Record<string, unknown>).version = 3;
    const file = path.join(dir, "m.json");
    writeFileSync(file, JSON.stringify(model));
    const out = path.join(dir, "page.html");
    expect(
      spawnSync(process.execPath, [
        skillFile("arch-visualize", "scripts/render.mjs"),
        "--model",
        file,
        "--out",
        out,
      ]).status,
    ).toBe(0);
    const id = owner.id;
    const probe = `<script>(function(){
      function st(t){var vp=document.getElementById('viewport');var d=document.getElementById('detail');
        document.body.setAttribute('data-'+t,JSON.stringify({detail:document.documentElement.getAttribute('data-detail'),vp:vp.getAttribute('transform'),dop:d.getAttribute('opacity'),crumbs:!document.getElementById('crumbs').hidden,h2:(document.querySelector('#body h2')||{}).textContent||''}));}
      setTimeout(function(){st('s0');document.querySelector('[data-node="${id}"]').dispatchEvent(new MouseEvent('dblclick',{bubbles:true}));},300);
      setTimeout(function(){st('s1');},600);
      setTimeout(function(){st('s2');document.querySelector('[data-sym]').dispatchEvent(new MouseEvent('click',{bubbles:true}));st('s3');},2500);
      setTimeout(function(){document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));st('s4');},2700);
      setTimeout(function(){document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));},2900);
      setTimeout(function(){st('s5');},4500);
    })();</script></body>`;
    const shim =
      "<script>window.requestAnimationFrame=function(c){return setTimeout(function(){c(performance.now());},16);};window.cancelAnimationFrame=function(i){clearTimeout(i);};</script>";
    const probed = path.join(dir, "probe.html");
    writeFileSync(
      probed,
      readFileSync(out, "utf8").replace("<head>", `<head>${shim}`).replace("</body>", probe),
    );
    const r = spawnSync(
      chrome!,
      [
        "--headless=new",
        "--disable-gpu",
        "--window-size=1440,900",
        "--virtual-time-budget=9000",
        "--dump-dom",
        `file://${probed}`,
      ],
      { encoding: "utf8", timeout: 60_000 },
    );
    const get = (k: string) => {
      const m = new RegExp(`data-${k}="([^"]*)"`).exec(r.stdout);
      expect(m, `state ${k}`).toBeTruthy();
      return JSON.parse(m![1]!.replace(/&quot;/g, '"').replace(/&amp;/g, "&")) as {
        detail: string | null;
        vp: string;
        dop: string | null;
        crumbs: boolean;
        h2: string;
      };
    };
    const s0 = get("s0");
    const s1 = get("s1");
    const s2 = get("s2");
    const s4 = get("s4");
    const s5 = get("s5");
    expect(s0.detail).toBeNull();
    expect(s1.detail).toBe(id);
    expect(s1.vp).not.toBe(s0.vp); // the camera is moving
    expect(s2.crumbs).toBe(true);
    expect(s2.dop).toBe("1");
    expect(get("s3").h2).toBe("a");
    expect(s4.detail).toBe(id); // the first Esc only cleared the selection
    expect(s5.detail).toBeNull();
    expect(s5.vp).toBe(s0.vp); // exactly where it started
    expect(s5.crumbs).toBe(false);
  }, 90_000);
});
