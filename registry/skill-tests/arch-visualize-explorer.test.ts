import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadLib, skillFile } from "./load";

type Ref = { to: string; name: string; line: number; in: string | null };
type Sym = {
  id: string;
  name: string;
  kind: string;
  file: string;
  line: number;
  doc?: string;
  route?: { path: string; method: string };
  procedure?: { kind: string; path?: string };
  calls: Ref[];
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
type Node = { id: string; label?: string; detail?: { scope: string; symbols: Sym[] } };
type Model = { nodes: Node[]; edges: unknown[] } & Record<string, unknown>;
type Step = {
  n: number;
  from: string;
  to: string;
  kind: string;
  label: string;
  in: string | null;
  line: number;
  inferred: boolean;
  depth: number;
  again: boolean;
};
type Lib = {
  ArchDetail: {
    trace: (
      m: Model,
      id: string,
      o?: { maxDepth?: number; maxSteps?: number },
    ) => { steps: Step[]; truncated: boolean };
    filter: (s: Sym[], q: string, tab: string) => Sym[];
    kindCounts: (s: Sym[]) => Record<string, number>;
  };
  ArchSearch: {
    search: (
      m: Model,
      q: string,
      n?: number,
    ) => {
      kind: string;
      id: string;
      field: string;
      score: number;
      nodes: string[];
      node?: string;
    }[];
  };
  ArchZoom: {
    fitInner: (
      stage: number[],
      size: number[],
      c: number[],
      o?: Record<string, unknown>,
    ) => { k: number; x: number; y: number };
    regionOf: (
      stage: number[],
      o?: Record<string, unknown>,
    ) => { x0: number; y0: number; x1: number; y1: number };
  };
};
const lib = loadLib<Lib>("arch-visualize", [
  "assets/lib/search.js",
  "assets/lib/zoom.js",
  "assets/lib/detail.js",
]);
const D = lib.ArchDetail;

const sym = (id: string, extra: Partial<Sym> = {}): Sym => ({
  id,
  name: id.split("#")[1]!,
  kind: "function",
  file: id.split("#")[0]!,
  line: 1,
  calls: [],
  renders: [],
  fetches: [],
  rpc: [],
  calledBy: [],
  loops: 0,
  branches: 0,
  ...extra,
});
const call = (to: string, line: number, inCtx: string | null = null): Ref => ({
  to,
  name: to.split("#")[1]!,
  line,
  in: inCtx,
});

describe("trace: the calls of one function, in order", () => {
  const A = "a.ts#a",
    B = "b.ts#b",
    C = "c.ts#c",
    E = "e.ts#e",
    F = "f.ts#f";
  const model: Model = {
    nodes: [
      {
        id: "n",
        detail: {
          scope: "x",
          symbols: [
            // line order, not list order: c is called on line 4, b on line 9
            sym(A, { calls: [call(B, 9), call(C, 4, "loop")] }),
            sym(B, { calls: [call(E, 2)] }),
            sym(C, {
              calls: [call(E, 3, "branch")],
              rpc: [{ path: "x.y", kind: "query", line: 1, to: F, inferred: true }],
            }),
            sym(E),
          ],
        },
      },
      { id: "m", detail: { scope: "y", symbols: [sym(F)] } },
    ],
    edges: [],
  };

  it("follows what the code does first, one level at a time, depth first", () => {
    const { steps } = D.trace(model, A);
    expect(steps.map((s) => `${s.from.split("#")[1]}>${s.to.split("#")[1]}`)).toEqual([
      "a>c", // line 4
      "c>f", // rpc on line 1 comes first inside c
      "c>e",
      "a>b", // line 9
      "b>e",
    ]);
    expect(steps.map((s) => s.n)).toEqual([1, 2, 3, 4, 5]);
    expect(steps.map((s) => s.depth)).toEqual([1, 2, 2, 1, 2]);
  });

  it("keeps the loop, branch and inferred marks, and crosses into another component", () => {
    const { steps } = D.trace(model, A);
    expect(steps[0]).toMatchObject({ kind: "call", in: "loop" });
    expect(steps[1]).toMatchObject({ kind: "rpc", inferred: true, to: F });
    expect(steps[2]).toMatchObject({ in: "branch" });
  });

  it("lists a repeated target again, but does not repeat its own steps", () => {
    const { steps } = D.trace(model, A);
    // e is reached through c first (its steps, none, are listed there) and again through b
    expect(steps.find((s) => s.from === C && s.to === E)!.again).toBe(false);
    expect(steps.find((s) => s.from === B && s.to === E)!.again).toBe(true);
  });

  it("ends on a cycle and ignores a self-call", () => {
    const cyc: Model = {
      nodes: [
        {
          id: "n",
          detail: {
            scope: "x",
            symbols: [sym(A, { calls: [call(B, 1), call(A, 2)] }), sym(B, { calls: [call(A, 1)] })],
          },
        },
      ],
      edges: [],
    };
    const { steps } = D.trace(cyc, A);
    expect(steps).toHaveLength(1);
    expect(steps[0]).toMatchObject({ from: A, to: B });
  });

  it("stops at the step limit and says it was cut, and stops at the depth limit", () => {
    const many: Sym[] = [
      sym("r.ts#r", { calls: Array.from({ length: 40 }, (_, i) => call(`t.ts#t${i}`, i + 1)) }),
    ];
    for (let i = 0; i < 40; i++) many.push(sym(`t.ts#t${i}`));
    const big = D.trace(
      { nodes: [{ id: "n", detail: { scope: "x", symbols: many } }], edges: [] },
      "r.ts#r",
    );
    expect(big.steps).toHaveLength(30);
    expect(big.truncated).toBe(true);
    const chain: Sym[] = [];
    for (let i = 0; i < 10; i++)
      chain.push(sym(`c.ts#s${i}`, { calls: i < 9 ? [call(`c.ts#s${i + 1}`, 1)] : [] }));
    const deep = D.trace(
      { nodes: [{ id: "n", detail: { scope: "x", symbols: chain } }], edges: [] },
      "c.ts#s0",
      { maxDepth: 3 },
    );
    expect(deep.steps).toHaveLength(3);
    expect(deep.truncated).toBe(false);
  });

  it("is empty for a function that calls nothing shown, and for an unknown id", () => {
    expect(D.trace(model, E).steps).toEqual([]);
    expect(D.trace(model, "nope#x").steps).toEqual([]);
  });
});

describe("explorer list: filter and tabs", () => {
  const syms = [
    sym("src/b.tsx#Booking", { kind: "component", line: 5, doc: "Shows one booking." }),
    sym("src/a.ts#getBooking", { kind: "function", line: 9, doc: "Loads a booking by id." }),
    sym("src/a.ts#cancel", {
      kind: "procedure",
      line: 3,
      procedure: { kind: "mutation", path: "viewer.bookings.cancel" },
    }),
    sym("src/h.ts#useSlots", { kind: "hook", line: 1 }),
    sym("app/api/x/route.ts#GET", {
      kind: "route",
      line: 2,
      route: { path: "/api/x", method: "GET" },
    }),
    sym("src/a.ts#Svc.run", { kind: "method", line: 20 }),
  ];

  it("counts what each tab holds", () => {
    expect(D.kindCounts(syms)).toEqual({
      all: 6,
      components: 1,
      functions: 2,
      routes: 2,
      hooks: 1,
    });
  });

  it("orders by file then line when there is no query, and by match quality when there is", () => {
    expect(D.filter(syms, "", "all").map((x) => x.name)).toEqual([
      "GET",
      "cancel",
      "getBooking",
      "Svc.run",
      "Booking",
      "useSlots",
    ]);
    // a name that starts with the word beats one that only contains it
    expect(D.filter(syms, "booking", "all").map((x) => x.name)).toEqual([
      "Booking",
      "getBooking",
      "cancel",
    ]);
  });

  it("needs every word, and matches the file, the description, the route and the tRPC path", () => {
    expect(D.filter(syms, "loads id", "all").map((x) => x.name)).toEqual(["getBooking"]);
    expect(D.filter(syms, "api/x", "all").map((x) => x.name)).toEqual(["GET"]);
    expect(D.filter(syms, "viewer.bookings", "all").map((x) => x.name)).toEqual(["cancel"]);
    expect(D.filter(syms, "a.ts cancel", "all").map((x) => x.name)).toEqual(["cancel"]);
    expect(D.filter(syms, "zzz", "all")).toEqual([]);
  });

  it("limits to one tab, and an unknown tab shows everything", () => {
    expect(D.filter(syms, "", "routes").map((x) => x.name)).toEqual(["GET", "cancel"]);
    expect(D.filter(syms, "", "functions").map((x) => x.name)).toEqual(["getBooking", "Svc.run"]);
    expect(D.filter(syms, "", "nonsense")).toHaveLength(6);
  });

  it("does not change the list it is given", () => {
    const before = syms.map((x) => x.id);
    D.filter(syms, "booking", "all");
    expect(syms.map((x) => x.id)).toEqual(before);
  });
});

describe("search finds functions too", () => {
  const model: Model = {
    nodes: [
      {
        id: "web",
        label: "Web app",
        detail: {
          scope: "w",
          symbols: [
            sym("w.tsx#BookingList", { kind: "component", doc: "Lists upcoming bookings." }),
          ],
        },
      },
      {
        id: "api",
        label: "API",
        detail: {
          scope: "s",
          symbols: [
            sym("s.ts#cancel", {
              kind: "procedure",
              procedure: { kind: "mutation", path: "viewer.bookings.cancel" },
            }),
          ],
        },
      },
    ],
    edges: [],
    risks: [],
  };
  const S = lib.ArchSearch;

  it("returns a symbol with the component that holds it", () => {
    const r = S.search(model, "bookinglist");
    expect(r[0]).toMatchObject({
      kind: "symbol",
      id: "w.tsx#BookingList",
      node: "web",
      nodes: ["web"],
    });
  });

  it("finds by description and by tRPC path", () => {
    expect(S.search(model, "upcoming")[0]).toMatchObject({ kind: "symbol", field: "doc" });
    expect(S.search(model, "viewer.bookings")[0]).toMatchObject({
      id: "s.ts#cancel",
      field: "procedure",
    });
  });

  it("puts a component ahead of a function with the same name, and leaves models without detail alone", () => {
    const m2: Model = {
      ...model,
      nodes: [
        { id: "x", label: "booking", detail: { scope: "", symbols: [sym("q.ts#booking")] } },
      ] as Node[],
    };
    expect(S.search(m2, "booking").map((r) => r.kind)).toEqual(["node", "symbol"]);
    const plain = S.search(
      {
        nodes: [{ id: "x", label: "Web", tech: "nextjs", role: "frontend" }],
        edges: [],
        risks: [],
      } as unknown as Model,
      "web",
    );
    expect(plain.map((r) => r.kind)).toEqual(["node"]);
  });
});

describe("zoom: the free part of the stage", () => {
  const Z = lib.ArchZoom;
  const stage = [1100, 700];

  it("fits the diagram into a region beside the list and above the trace", () => {
    const region = { x0: 300, y0: 80, x1: 1100, y1: 460 };
    const v = Z.fitInner(stage, [400, 200], [500, 400], { region });
    // the diagram's centre sits at the middle of the region
    expect(v.x + v.k * 500).toBeCloseTo(700, 6);
    expect(v.y + v.k * 400).toBeCloseTo(270, 6);
    expect(v.k).toBeLessThanOrEqual(1.5);
  });

  it("keeps a tall diagram readable inside a region and starts at its top", () => {
    const region = { x0: 0, y0: 100, x1: 800, y1: 600 };
    const v = Z.fitInner(stage, [600, 4000], [300, 2000], { region, minK: 0.65 });
    expect(v.k).toBeCloseTo(0.65, 6);
    expect(v.y + v.k * (2000 - 2000)).toBeCloseTo(100 + 14, 6);
  });

  it("treats an inset alone as a free top strip, and never lets a region shrink to nothing", () => {
    expect(Z.regionOf(stage, { inset: 60 })).toEqual({ x0: 0, y0: 60, x1: 1100, y1: 700 });
    const tiny = Z.regionOf(stage, { region: { x0: 900, y0: 600, x1: 910, y1: 590 } });
    expect(tiny.x1 - tiny.x0).toBeGreaterThanOrEqual(60);
    expect(tiny.y1 - tiny.y0).toBeGreaterThanOrEqual(60);
  });
});

describe("the explorer markup and code", () => {
  const read = (rel: string) =>
    readFileSync(skillFile("arch-visualize", `assets/viewer/${rel}`), "utf8");
  const markup = read("index.html");
  const code = read("src/38-explorer.js");

  it("uses every id once, and every id the code looks up exists", () => {
    const ids = [...markup.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]!);
    expect(ids.filter((id, i) => ids.indexOf(id) !== i)).toEqual([]);
    for (const f of ["src/35-detail.js", "src/38-explorer.js"])
      for (const m of read(f).matchAll(/\$\("([\w-]+)"\)/g))
        expect(ids, `${f} looks up #${m[1]}`).toContain(m[1]!);
  });

  it("keeps clicks, drags and scrolling inside the list and the trace away from the diagram", () => {
    expect(code).toMatch(/\[exEl, trEl\]\.forEach/);
    expect(code).toMatch(/"pointerdown", "click"/);
    expect(code).toMatch(/"wheel"/);
  });

  it("starts nothing by itself: playback begins only from the button or the P key", () => {
    expect(code).toMatch(/Nothing plays until the reader asks/);
    expect(code).not.toMatch(/requestAnimationFrame|setInterval/);
    expect(code.match(/setTimeout\(/g)!.length).toBeLessThanOrEqual(2);
    expect(code).toMatch(/reduceMotion \? t\("flow\.playMotion"\)/);
  });

  it("is keyboard friendly: arrows in the list, Esc in the filter, bracket keys for steps", () => {
    expect(code).toMatch(/ev\.key === "ArrowDown"/);
    expect(code).toMatch(/ev\.key === "Escape"/);
    expect(code).toMatch(/ev\.key === "\]"/);
    expect(code).toMatch(/ev\.key === "\["/);
    expect(read("src/35-detail.js")).toMatch(/ev\.target\.id === "ex-q"/);
  });

  it("keeps the step counter's digits in order in Arabic", () => {
    expect(markup).toMatch(/id="tr-counter"[^>]*dir="ltr"/);
  });

  it("builds the list and table from text nodes only, never markup", () => {
    expect(code).not.toMatch(/innerHTML|outerHTML|insertAdjacentHTML|document\.write/);
  });

  it("hides itself on a phone and in print, and the diagram avoids it through the free region", () => {
    const css = read("styles.css");
    expect(css).toMatch(/@media \(max-width: 700px\)[\s\S]*?\.explorer/);
    expect(css).toMatch(/@media print[\s\S]*?\.explorer/);
    expect(read("src/35-detail.js")).toMatch(/region: freeRegion\(\)/);
  });
});

// Real browser run of the explorer (skipped without Chrome and in CI, like the zoom test): filter, select, step,
// the keyboard, play and pause, and the way back out. requestAnimationFrame is shimmed with a timer.
const chrome = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
].find((p) => existsSync(p));
describe.skipIf(!chrome || Boolean(process.env.CI))("the explorer in a real browser", () => {
  it("filters, selects, steps through a trace, plays, pauses and leaves", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "explorer-chrome-"));
    const model = JSON.parse(
      readFileSync(skillFile("arch-visualize", "evals/fixture-model.json"), "utf8"),
    ) as Model;
    const owner = model.nodes[0]!;
    owner.detail = {
      scope: "src",
      symbols: [
        sym("src/a.ts#start", {
          kind: "component",
          calls: [call("src/a.ts#alpha", 3), call("src/a.ts#beta", 5, "loop")],
        }),
        sym("src/a.ts#alpha", { calls: [call("src/a.ts#beta", 2)] }),
        sym("src/a.ts#beta", { doc: "Does the second thing." }),
      ],
    };
    model.version = 3;
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
    const shim =
      "<script>window.requestAnimationFrame=function(c){return setTimeout(function(){c(performance.now());},16);};window.cancelAnimationFrame=function(i){clearTimeout(i);};</script>";
    const probe = `<script>(function(){
      function q(s){return document.querySelector(s);} function all(s){return document.querySelectorAll(s);}
      function key(k){document.dispatchEvent(new KeyboardEvent('keydown',{key:k,bubbles:true}));}
      function st(t){document.body.setAttribute('data-'+t,JSON.stringify({items:all('.ex-item').length,status:q('#ex-status').textContent,lit:all('.sym.match').length,h2:(q('#body h2')||{}).textContent||'',counter:q('#tr-counter').textContent,rows:all('#tr-body tr[data-step]').length,cur:!!q('#tr-body tr.current'),from:all('.sym.play-from').length,edge:all('.dedge.playing').length,trail:all('.dedge.trail').length,play:q('#tr-play').textContent,trace:!q('#calltrace').hidden,list:!q('#explorer').classList.contains('collapsed'),detail:document.documentElement.getAttribute('data-detail')}));}
      setTimeout(function(){q('[data-node="${owner.id}"]').dispatchEvent(new MouseEvent('dblclick',{bubbles:true}));},300);
      setTimeout(function(){st('a');var i=q('#ex-q');i.value='beta';i.dispatchEvent(new Event('input',{bubbles:true}));st('b');},2300);
      setTimeout(function(){i2();},2400);
      function i2(){var i=q('#ex-q');i.value='';i.dispatchEvent(new Event('input',{bubbles:true}));q('.ex-item[data-sym="src/a.ts#start"]').click();st('c');}
      setTimeout(function(){q('#tr-step').click();st('d');},2600);
      setTimeout(function(){key(']');st('e');},2800);
      setTimeout(function(){key('p');},3000);
      setTimeout(function(){st('f');},3100);
      setTimeout(function(){key('p');st('g');},3150);
      setTimeout(function(){key('l');st('h');},5900);
      setTimeout(function(){key('Escape');st('i');},6100);
      setTimeout(function(){key('Escape');},6300);
      setTimeout(function(){st('j');},8500);
    })();</script></body>`;
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
        "--virtual-time-budget=12000",
        "--dump-dom",
        `file://${probed}`,
      ],
      { encoding: "utf8", timeout: 60_000 },
    );
    type S = {
      items: number;
      status: string;
      lit: number;
      h2: string;
      counter: string;
      rows: number;
      cur: boolean;
      from: number;
      edge: number;
      trail: number;
      play: string;
      trace: boolean;
      list: boolean;
      detail: string | null;
    };
    const get = (k: string): S => {
      const m = new RegExp(`data-${k}="([^"]*)"`).exec(r.stdout);
      expect(m, `state ${k}`).toBeTruthy();
      return JSON.parse(m![1]!.replace(/&quot;/g, '"').replace(/&amp;/g, "&")) as S;
    };
    expect(get("a").items).toBe(3);
    expect(get("b")).toMatchObject({ items: 1, status: "1 of 3", lit: 1 });
    const c = get("c");
    expect(c.h2).toBe("start"); // the click on a list item was not undone by the stage
    expect(c.trace).toBe(true);
    expect(c.rows).toBe(3); // start>alpha, alpha>beta, start>beta
    expect(get("d").counter).toBe("01 / 03");
    expect(get("d").edge).toBe(1);
    expect(get("e").counter).toBe("02 / 03");
    expect(get("e").trail).toBe(1);
    expect(get("f").play).toBe("Pause"); // playing, and only because P was pressed
    expect(get("g").play).toBe("Play");
    expect(get("h").list).toBe(false);
    expect(get("i").trace).toBe(false);
    expect(get("i").detail).not.toBeNull(); // the first Esc clears the selection, the detail view stays
    expect(get("j").detail).toBeNull();
  }, 90_000);
});
