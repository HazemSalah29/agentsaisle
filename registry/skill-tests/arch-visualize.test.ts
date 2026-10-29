import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadScript, skillFile } from "./load";

type Evidence = { file: string; line: number; note?: string };
type Node = { id: string; role: string; tech: string; tier: string; evidence: Evidence[] };
type Model = {
  version: 1;
  project: string;
  nodes: Node[];
  edges: { id: string; from: string; to: string; evidence?: Evidence[] }[];
  flows: unknown[];
  risks: unknown[];
  inferred?: string[];
};
type Check = {
  checkModel: (m: unknown, o?: { draft?: boolean }) => string[];
  loadSchema: () => { $defs: { role: { enum: string[] }; tier: { enum: string[] } } };
};
type Discover = { TIER_OF_ROLE: Record<string, string> };

const FIXTURE = skillFile("arch-visualize", "evals/fixture-app");
const expected = JSON.parse(
  readFileSync(skillFile("arch-visualize", "evals/expected.json"), "utf8"),
);
const script = (n: string) => skillFile("arch-visualize", `scripts/${n}`);
const CANARY = "CANARY-SECRET-DO-NOT-READ";

const tmp = () => mkdtempSync(path.join(tmpdir(), "arch-viz-"));
const run = (file: string, args: string[], cwd?: string) =>
  spawnSync(process.execPath, [script(file), ...args], { encoding: "utf8", cwd });

/** A copy of the fixture with real-looking secret files that discovery must never open. */
function fixtureWithSecrets() {
  const root = path.join(tmp(), "app");
  cpSync(FIXTURE, root, { recursive: true });
  for (const f of [".env", ".env.local", ".env.production.local", "apps/api/.env", "server.pem"])
    writeFileSync(path.join(root, f), `DATABASE_URL=${CANARY}\nSTRIPE_SECRET_KEY=${CANARY}\n`);
  return root;
}

const discover = (root: string, out: string) => {
  const r = run("discover.mjs", ["--root", root, "--out", out]);
  return { ...r, model: existsSync(out) ? (JSON.parse(readFileSync(out, "utf8")) as Model) : null };
};

describe("arch-visualize discovery", () => {
  const out = path.join(tmp(), "draft.json");
  const result = discover(FIXTURE, out);
  const model = result.model!;

  it("exits 0 and writes a draft model", () => {
    expect(result.status).toBe(0);
    expect(model.version).toBe(1);
    expect(model.project).toBe("shop");
    expect(model.flows).toEqual([]);
  });

  it("finds every expected node with its role, tech and evidence lines", () => {
    expect(model.nodes.map((n) => n.id).sort()).toEqual(
      expected.nodes.map((n: { id: string }) => n.id).sort(),
    );
    for (const want of expected.nodes) {
      const got = model.nodes.find((n) => n.id === want.id)!;
      expect(got.role, want.id).toBe(want.role);
      expect(got.tech, want.id).toBe(want.tech);
      for (const ev of want.evidence)
        expect(
          got.evidence.some((e) => e.file === ev.file && e.line === ev.line),
          `${want.id} evidence ${ev.file}:${ev.line}`,
        ).toBe(true);
    }
  });

  it("drafts edges from depends_on", () => {
    expect(model.edges.map((e) => e.id).sort()).toEqual([...expected.edges].sort());
    expect(model.edges.every((e) => e.evidence?.[0]?.file === "docker-compose.yml")).toBe(true);
  });

  it("passes model-check as a draft", () => {
    const r = run("model-check.mjs", ["--model", out, "--draft"]);
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/model ok: 9 nodes, 5 edges/);
  });

  it("is deterministic", () => {
    const again = path.join(tmp(), "draft.json");
    discover(FIXTURE, again);
    expect(readFileSync(again, "utf8")).toBe(readFileSync(out, "utf8"));
  });

  it("keeps stdout within 40 lines", () => {
    expect(result.stdout.trimEnd().split("\n").length).toBeLessThanOrEqual(40);
  });

  it("never opens secret files: the canary appears nowhere", () => {
    const root = fixtureWithSecrets();
    const o = path.join(tmp(), "draft.json");
    const r = discover(root, o);
    expect(r.status).toBe(0);
    expect(r.stdout + r.stderr).not.toContain(CANARY);
    expect(readFileSync(o, "utf8")).not.toContain(CANARY);
    expect(r.stdout).toMatch(/5 secret-named file\(s\) never opened/);
    // Same model as the clean fixture: the secret files change nothing.
    expect(readFileSync(o, "utf8")).toBe(readFileSync(out, "utf8"));
  });

  it("reads env example key names only", () => {
    const root = path.join(tmp(), "app");
    mkdirSync(root);
    writeFileSync(path.join(root, ".env.example"), `REDIS_URL=${CANARY}\n`);
    const o = path.join(tmp(), "d.json");
    const r = discover(root, o);
    expect(r.model!.nodes.map((n) => n.tech)).toEqual(["redis"]);
    expect(readFileSync(o, "utf8")).not.toContain(CANARY);
  });

  it("works when started through a symlinked skill folder", () => {
    const link = path.join(tmp(), "skill-link");
    symlinkSync(skillFile("arch-visualize", "."), link);
    const o = path.join(tmp(), "d.json");
    const r = spawnSync(
      process.execPath,
      [path.join(link, "scripts/discover.mjs"), "--root", FIXTURE, "--out", o],
      {
        encoding: "utf8",
      },
    );
    expect(r.status).toBe(0);
    expect(readFileSync(o, "utf8")).toBe(readFileSync(out, "utf8"));
  });

  it("caps the files it visits", () => {
    const root = path.join(tmp(), "big");
    mkdirSync(root);
    for (let i = 0; i < 2100; i++) writeFileSync(path.join(root, `f${i}.txt`), "x");
    const r = discover(root, path.join(tmp(), "d.json"));
    expect(r.stdout).toMatch(/stopped at 2,000 files/);
  });
});

describe("arch-visualize model-check", () => {
  const valid = (): Model => ({
    version: 1,
    project: "shop",
    nodes: [
      {
        id: "api",
        label: "API",
        role: "backend",
        tech: "express",
        tier: "backend",
        evidence: [{ file: "a.json", line: 1 }],
      },
      {
        id: "db",
        label: "DB",
        role: "database",
        tech: "postgresql",
        tier: "data",
        evidence: [{ file: "b.yml", line: 2 }],
      },
    ],
    edges: [{ id: "api-db", from: "api", to: "db", evidence: [{ file: "src/db.ts", line: 3 }] }],
    flows: [
      {
        id: "f",
        name: "Load",
        steps: [
          { edge: "api-db", label: "SELECT" },
          { edge: "api-db", reverse: true },
        ],
      },
    ],
    risks: [],
  });
  let check: Check;
  const problems = async (mutate: (m: Model) => void, o?: { draft?: boolean }) => {
    check ??= await loadScript<Check>("arch-visualize", "scripts/model-check.mjs");
    const m = valid();
    mutate(m);
    return check.checkModel(m, o);
  };

  it("accepts a valid model", async () => expect(await problems(() => {})).toEqual([]));

  it("catches a dangling edge", async () =>
    expect((await problems((m) => (m.edges[0].to = "cache"))).join("\n")).toMatch(
      /to "cache" is not a node/,
    ));

  it("catches a flow step that points at a missing edge", async () =>
    expect(
      (
        await problems(
          (m) => ((m.flows as { steps: { edge: string }[] }[])[0].steps[0].edge = "nope"),
        )
      ).join("\n"),
    ).toMatch(/edge "nope" does not exist/));

  it("catches missing evidence unless the item is inferred", async () => {
    expect((await problems((m) => (m.nodes[0].evidence = []))).join("\n")).toMatch(
      /needs evidence/,
    );
    expect(
      await problems((m) => {
        m.nodes[0].evidence = [];
        m.inferred = ["node:api"];
      }),
    ).toEqual([]);
  });

  it("catches an inferred entry that points at nothing", async () =>
    expect((await problems((m) => (m.inferred = ["edge:ghost"]))).join("\n")).toMatch(
      /does not exist/,
    ));

  it("catches an unknown role and an unknown tech", async () => {
    expect((await problems((m) => (m.nodes[0].role = "gateway"))).join("\n")).toMatch(/not one of/);
    expect((await problems((m) => (m.nodes[0].tech = "cobol-db"))).join("\n")).toMatch(
      /unknown tech/,
    );
  });

  it("catches credential-looking strings without echoing them", async () => {
    const secret = "sk_live_" + "a1b2c3d4e5f6g7h8i9j0";
    const out = (await problems((m) => (m.nodes[0].label = `Key ${secret}`))).join("\n");
    expect(out).toMatch(/looks like a credential/);
    expect(out).not.toContain(secret);
    expect(
      (await problems((m) => (m.edges[0].protocol = "postgres://admin:hunter22@db/x"))).join("\n"),
    ).toMatch(/credential/);
  });

  it("rejects absolute or parent-relative evidence paths", async () => {
    expect(
      (await problems((m) => (m.nodes[0].evidence[0].file = "/etc/passwd"))).join("\n"),
    ).toMatch(/relative/);
    expect((await problems((m) => (m.nodes[0].evidence[0].file = "../x"))).join("\n")).toMatch(
      /relative/,
    );
  });

  it("needs a flow unless the model is a draft", async () => {
    expect((await problems((m) => (m.flows = []))).join("\n")).toMatch(/at least one request flow/);
    expect(await problems((m) => (m.flows = []), { draft: true })).toEqual([]);
  });

  it("allows hostile label text (it is escaped by the viewer, not rejected here)", async () =>
    expect(
      await problems((m) => (m.nodes[0].label = "</script><img src=x onerror=alert(1)>")),
    ).toEqual([]));

  it("keeps the schema enums in step with discover's tier map", async () => {
    const c = await loadScript<Check>("arch-visualize", "scripts/model-check.mjs");
    const d = await loadScript<Discover>("arch-visualize", "scripts/discover.mjs");
    const s = c.loadSchema();
    expect(Object.keys(d.TIER_OF_ROLE).sort()).toEqual([...s.$defs.role.enum].sort());
    expect(
      [...new Set(Object.values(d.TIER_OF_ROLE))].every((t) => s.$defs.tier.enum.includes(t)),
    ).toBe(true);
  });

  it("exits 1 with a capped list on a bad model and 2 on a missing file", () => {
    const bad = path.join(tmp(), "m.json");
    const m = valid();
    m.edges = Array.from({ length: 80 }, (_, i) => ({ id: `e${i}`, from: "x", to: "y" }));
    writeFileSync(bad, JSON.stringify(m));
    const r = run("model-check.mjs", ["--model", bad]);
    expect(r.status).toBe(1);
    expect(r.stdout.trimEnd().split("\n").length).toBeLessThanOrEqual(40);
    expect(run("model-check.mjs", ["--model", path.join(tmp(), "none.json")]).status).toBe(2);
  });
});

describe("arch-visualize files", () => {
  it("keeps every script small enough to read and prints nothing outside the cap", () => {
    const dir = skillFile("arch-visualize", "scripts");
    for (const f of readdirSync(dir)) expect(statSync(path.join(dir, f)).size).toBeLessThan(40_000);
  });

  it("has no network or process APIs in the scripts", () => {
    const dir = skillFile("arch-visualize", "scripts");
    for (const f of readdirSync(dir)) {
      const src = readFileSync(path.join(dir, f), "utf8");
      expect(src, f).not.toMatch(
        /node:(http|https|net|child_process|dns|worker_threads)|\bfetch\(|\beval\(|require\(/,
      );
    }
  });
});

type Render = {
  renderPage: (m: unknown) => string;
  parseIcon: (svg: string, name?: string) => { viewBox: string; paths: string[] };
  iconFor: (tech: string, role: string) => { viewBox: string; paths: string[] };
  safeJson: (v: unknown) => string;
  MARKER: string;
};
const readJson = (rel: string) =>
  JSON.parse(readFileSync(skillFile("arch-visualize", rel), "utf8"));
const renderCli = (model: string, out: string, extra: string[] = []) =>
  run("render.mjs", ["--model", model, "--out", out, ...extra]);
const dataBlock = (html: string, id: string) => {
  const m = new RegExp(`<script type="application/json" id="${id}">([\\s\\S]*?)</script>`).exec(
    html,
  );
  return m ? m[1] : null;
};

describe("arch-visualize render", () => {
  const fixtureModel = skillFile("arch-visualize", "evals/fixture-model.json");
  const hostileModel = skillFile("arch-visualize", "evals/hostile-model.json");
  const dir = tmp();
  const fixtureOut = path.join(dir, "fixture.html");
  const hostileOut = path.join(dir, "hostile.html");
  const first = renderCli(fixtureModel, fixtureOut);
  renderCli(hostileModel, hostileOut);
  const fixtureHtml = readFileSync(fixtureOut, "utf8");
  const hostileHtml = readFileSync(hostileOut, "utf8");
  const viewer = readFileSync(skillFile("arch-visualize", "assets/viewer.html"), "utf8");
  const viewerCode = /<script>([\s\S]*?)<\/script>/.exec(viewer)![1];

  it("renders the fixture model and says where the file is", () => {
    expect(first.status).toBe(0);
    expect(first.stdout).toMatch(/Wrote .*fixture\.html .*9 components, 3 flows/);
    expect(first.stdout.trimEnd().split("\n").length).toBeLessThanOrEqual(40);
    expect(fixtureHtml.startsWith("<!doctype html>")).toBe(true);
    expect(fixtureHtml).toContain("<!-- arch-visualize viewer v1 -->");
  });

  it("embeds the model so it parses back unchanged", () => {
    expect(JSON.parse(dataBlock(fixtureHtml, "model")!)).toEqual(
      readJson("evals/fixture-model.json"),
    );
    expect(JSON.parse(dataBlock(hostileHtml, "model")!)).toEqual(
      readJson("evals/hostile-model.json"),
    );
  });

  it("escaping canary: hostile text cannot leave the data block", () => {
    // Only the three real script tags exist: model, icons, viewer code.
    expect(hostileHtml.match(/<\/script/gi)).toHaveLength(3);
    expect(hostileHtml.match(/<script/gi)).toHaveLength(3);
    const data = dataBlock(hostileHtml, "model")! + dataBlock(hostileHtml, "icons")!;
    expect(data).not.toMatch(new RegExp("[<>&" + String.fromCharCode(0x2028, 0x2029) + "]"));
    expect(hostileHtml).not.toContain("<img src=x");
    expect(hostileHtml).not.toContain("<svg onload");
  });

  it("the viewer never writes model text as HTML", () => {
    expect(viewerCode).not.toMatch(
      /innerHTML|outerHTML|insertAdjacentHTML|document\.write|\beval\(|new Function|srcdoc|setAttribute\(\s*["']on/i,
    );
    // Whole file too, so a comment cannot hide one.
    expect(viewer).not.toMatch(/innerHTML|outerHTML|insertAdjacentHTML/);
  });

  it("is offline: no remote resources and no network APIs", () => {
    for (const html of [fixtureHtml, hostileHtml]) {
      const urls = html.match(/https?:\/\/[^\s"'<>)]+/g) ?? [];
      expect(urls.every((u) => u === "http://www.w3.org/2000/svg")).toBe(true);
      expect(html).not.toMatch(/\s(src|href|poster|action)\s*=\s*["']?(https?:)?\/\//i);
      expect(html).not.toMatch(/url\(\s*["']?(https?:)?\/\//i);
      expect(html).not.toMatch(/@import|<link\b|<iframe|<object|<embed|<form/i);
    }
    expect(viewerCode).not.toMatch(
      /\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon|\bimport\s*\(|importScripts|navigator\.serviceWorker|localStorage|sessionStorage|document\.cookie/,
    );
  });

  it("stays small", () => {
    expect(viewer.length).toBeLessThan(300 * 1024);
    expect(fixtureHtml.length).toBeLessThan(300 * 1024);
  });

  it("is deterministic", () => {
    const again = path.join(tmp(), "again.html");
    renderCli(fixtureModel, again);
    expect(readFileSync(again, "utf8")).toBe(fixtureHtml);
  });

  it("refuses to overwrite a file that is not its page, unless forced", () => {
    const foreign = path.join(tmp(), "index.html");
    writeFileSync(foreign, "<h1>my own page</h1>");
    expect(renderCli(fixtureModel, foreign).status).toBe(2);
    expect(readFileSync(foreign, "utf8")).toBe("<h1>my own page</h1>");
    expect(renderCli(fixtureModel, foreign, ["--force"]).status).toBe(0);
    expect(readFileSync(foreign, "utf8")).toContain("arch-visualize viewer v1");
    // Its own page can be replaced without --force.
    expect(renderCli(fixtureModel, foreign).status).toBe(0);
  });

  it("refuses an invalid model and lists the problems", () => {
    const bad = path.join(tmp(), "bad.json");
    const m = readJson("evals/fixture-model.json");
    m.edges[0].to = "ghost";
    writeFileSync(bad, JSON.stringify(m));
    const out = path.join(tmp(), "bad.html");
    const r = renderCli(bad, out);
    expect(r.status).toBe(1);
    expect(r.stdout).toMatch(/ghost/);
    expect(existsSync(out)).toBe(false);
  });

  it("works when started through a symlinked skill folder", () => {
    const link = path.join(tmp(), "skill-link");
    symlinkSync(skillFile("arch-visualize", "."), link);
    const out = path.join(tmp(), "link.html");
    const r = spawnSync(
      process.execPath,
      [path.join(link, "scripts/render.mjs"), "--model", fixtureModel, "--out", out],
      { encoding: "utf8" },
    );
    expect(r.status).toBe(0);
    expect(readFileSync(out, "utf8")).toBe(fixtureHtml);
  });

  it("carries a flow for each one in the model and a risk badge source", () => {
    const m = JSON.parse(dataBlock(fixtureHtml, "model")!);
    expect(m.flows).toHaveLength(3);
    expect(m.risks.length).toBeGreaterThan(0);
  });
});

describe("arch-visualize icons", () => {
  const iconDir = skillFile("arch-visualize", "assets/icons");
  const svgs = ["brand", "generic"].flatMap((k) =>
    readdirSync(path.join(iconDir, k)).map((f) => path.join(iconDir, k, f)),
  );

  it("are plain SVG paths: no scripts, styles, links or handlers", async () => {
    const { parseIcon } = await loadScript<Render>("arch-visualize", "scripts/render.mjs");
    expect(svgs.length).toBeGreaterThan(40);
    for (const f of svgs) {
      const icon = parseIcon(readFileSync(f, "utf8"), path.basename(f));
      expect(icon.paths.length, f).toBeGreaterThan(0);
    }
  });

  it("rejects an unsafe icon", async () => {
    const { parseIcon } = await loadScript<Render>("arch-visualize", "scripts/render.mjs");
    expect(() => parseIcon('<svg viewBox="0 0 1 1"><script>x</script></svg>')).toThrow();
    expect(() =>
      parseIcon('<svg viewBox="0 0 1 1"><path d="M0 0" onclick="x()"/></svg>'),
    ).toThrow();
    expect(() => parseIcon('<svg viewBox="0 0 1 1"><image href="x"/></svg>')).toThrow();
  });

  it("has an icon for every technology in the catalog, and a generic one for every role", async () => {
    const { iconFor } = await loadScript<Render>("arch-visualize", "scripts/render.mjs");
    const { knownTech } = await loadScript<{ knownTech: (c: unknown) => Set<string> }>(
      "arch-visualize",
      "scripts/model-check.mjs",
    );
    const schema = readJson("assets/model.schema.json");
    for (const role of schema.$defs.role.enum as string[])
      expect(iconFor(`generic-${role}`, role).paths.length).toBeGreaterThan(0);
    for (const tech of knownTech(readJson("assets/tech-catalog.json")))
      expect(iconFor(tech, "backend").paths.length, tech).toBeGreaterThan(0);
  });

  it("credits the brand icons and their license", () => {
    const notice = readFileSync(path.join(iconDir, "NOTICE.md"), "utf8");
    expect(notice).toMatch(/CC0/);
    expect(notice).toMatch(/trademark/i);
  });
});

type Step = {
  kind: string;
  edge?: string;
  reverse?: boolean;
  label: string;
  from: string;
  to: string;
  node?: string;
};
type State = { index: number; t: number; playing: boolean; once: boolean };
type Engine = {
  buildSteps: (
    flow: unknown,
    edges: Record<string, unknown>,
    nodes: Record<string, unknown>,
  ) => Step[];
  newState: () => State;
  play: (s: State, steps: Step[]) => State;
  pause: (s: State) => State;
  stepForward: (s: State, steps: Step[], instant: boolean) => State;
  stepBack: (s: State) => State;
  jump: (s: State, i: number, steps: Step[]) => State;
  advance: (s: State, dt: number, steps: Step[], speed: number) => State;
  dotAt: (step: Step, t: number) => number;
  atEnd: (s: State, steps: Step[]) => boolean;
  stepMs: (step: Step, speed: number) => number;
};

describe("arch-visualize flow engine", () => {
  const viewer = readFileSync(skillFile("arch-visualize", "assets/viewer.html"), "utf8");
  const block = /\/\/ <flow-engine>([\s\S]*?)\/\/ <\/flow-engine>/.exec(viewer);
  // The engine is our own code and has no DOM access, so the test can run it on its own.
  const E = new Function(
    `${block![1]}; return { buildSteps, newState, play, pause, stepForward, stepBack, jump, advance, dotAt, atEnd, stepMs };`,
  )() as Engine;
  const model = readJson("evals/fixture-model.json");
  const byId = (xs: { id: string }[]) => Object.fromEntries(xs.map((x) => [x.id, x]));
  const edges = byId(model.edges);
  const nodes = byId(model.nodes);
  const steps = E.buildSteps(model.flows[0], edges, nodes);
  const run = (s: State, ms: number, list = steps, speed = 1) => {
    let x = s;
    for (let t = 0; t < ms; t += 16) x = E.advance(x, 16, list, speed);
    return x;
  };

  it("expands a flow into steps with real directions", () => {
    expect(steps).toHaveLength(7);
    expect(steps[0]).toMatchObject({ kind: "edge", from: "web", to: "api", reverse: false });
    expect(steps[2]).toMatchObject({ kind: "event", node: "cache" });
    expect(steps[4]).toMatchObject({
      kind: "edge",
      edge: "api-db",
      reverse: true,
      from: "db",
      to: "api",
    });
    expect(E.dotAt(steps[0], 0.25)).toBe(0.25);
    expect(E.dotAt(steps[4], 0.25)).toBe(0.75);
  });

  it("drops steps that point at nothing", () => {
    const flow = { steps: [{ edge: "ghost" }, { event: "x", node: "ghost" }, { edge: "web-api" }] };
    expect(E.buildSteps(flow, edges, nodes)).toHaveLength(1);
    expect(E.buildSteps(undefined, edges, nodes)).toEqual([]);
  });

  it("times each step: 1000 ms per edge and 800 ms per event, scaled by speed", () => {
    expect(E.stepMs(steps[0], 1)).toBe(1000);
    expect(E.stepMs(steps[2], 1)).toBe(800);
    expect(E.stepMs(steps[0], 2)).toBe(500);
    expect(E.stepMs(steps[0], 0.5)).toBe(2000);
  });

  it("plays through every step in order and stops at the end", () => {
    let s = E.play(E.newState(), steps);
    const seen: number[] = [];
    for (let i = 0; i < 700; i++) {
      s = E.advance(s, 16, steps, 1);
      if (seen[seen.length - 1] !== s.index) seen.push(s.index);
      if (!s.playing) break;
    }
    expect(seen).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(s).toMatchObject({ index: 6, t: 1, playing: false });
    expect(E.atEnd(s, steps)).toBe(true);
  });

  it("is deterministic and never mutates its input", () => {
    const a = E.play(E.newState(), steps);
    const frozen = JSON.stringify(a);
    expect(JSON.stringify(run(a, 3000))).toBe(JSON.stringify(run(a, 3000)));
    expect(JSON.stringify(a)).toBe(frozen);
  });

  it("2x speed finishes in half the time", () => {
    const ms = (speed: number) => {
      let s = E.play(E.newState(), steps);
      let t = 0;
      while (s.playing) {
        s = E.advance(s, 10, steps, speed);
        t += 10;
      }
      return t;
    };
    expect(ms(2)).toBeLessThan(ms(1) * 0.6);
    expect(ms(0.5)).toBeGreaterThan(ms(1) * 1.6);
  });

  it("caps a long frame so a background tab does not jump ahead", () => {
    const s = E.advance(E.play(E.newState(), steps), 60_000, steps, 1);
    expect(s.index).toBe(0);
    expect(s.t).toBeLessThanOrEqual(0.11);
  });

  it("pause keeps the place and does not advance", () => {
    const s = E.pause(run(E.play(E.newState(), steps), 1200));
    expect(s.playing).toBe(false);
    expect(E.advance(s, 500, steps, 1)).toEqual(s);
  });

  it("Step runs one step and stops; Step mid-step finishes it", () => {
    let s = E.stepForward(E.newState(), steps, false);
    expect(s).toMatchObject({ index: 0, t: 0, playing: true, once: true });
    s = run(s, 2000);
    expect(s).toMatchObject({ index: 0, t: 1, playing: false });
    s = E.stepForward(s, steps, false);
    s = E.advance(s, 50, steps, 1);
    s = E.stepForward(s, steps, false);
    expect(s).toMatchObject({ index: 1, t: 1, playing: false });
  });

  it("instant Step (reduced motion) never plays", () => {
    let s = E.newState();
    for (let i = 0; i < 3; i++) s = E.stepForward(s, steps, true);
    expect(s).toMatchObject({ index: 2, t: 1, playing: false });
    expect(E.advance(s, 1000, steps, 1)).toEqual(s);
  });

  it("Step stays on the last step; Back walks back to not started", () => {
    let s = E.jump(E.newState(), 99, steps);
    expect(s.index).toBe(6);
    expect(E.stepForward(s, steps, false)).toMatchObject({ index: 6, t: 1, playing: false });
    s = E.stepBack(s);
    expect(s).toMatchObject({ index: 5, t: 1 });
    s = E.stepBack(E.jump(E.newState(), 0, steps));
    expect(s).toMatchObject({ index: -1, t: 0 });
    expect(E.stepBack(s).index).toBe(-1);
  });

  it("Play at the end starts again from the first step", () => {
    const done = E.jump(E.newState(), 6, steps);
    expect(E.play(done, steps)).toMatchObject({ index: 0, t: 0, playing: true });
  });

  it("an empty flow does nothing", () => {
    const s = E.newState();
    expect(E.play(s, [])).toEqual(s);
    expect(E.stepForward(s, [], false)).toEqual(s);
    expect(E.advance({ ...s, playing: true }, 100, [], 1)).toEqual({ ...s, playing: true });
  });

  it("the engine block touches no DOM, network or timers", () => {
    expect(block![1]).not.toMatch(
      /document|window|fetch|setTimeout|requestAnimationFrame|localStorage/,
    );
  });

  it("starts nothing on load and honours reduced motion in the page code", () => {
    expect(viewer).toMatch(/prefers-reduced-motion: reduce/);
    expect(viewer).toMatch(/Play \(uses motion\)/);
    // The only place a loop starts is a click handler through kick().
    expect(viewer.match(/requestAnimationFrame\(/g)).toHaveLength(2);
    expect(viewer).toMatch(/@media \(prefers-reduced-motion: no-preference\)[\s\S]*?pulse/);
  });
});

type Risk = {
  id: string;
  title?: string;
  severity: string;
  nodes: string[];
  evidence: { file: string; line: number; note?: string }[];
  why: string;
  check: string;
  source?: string;
};

describe("arch-visualize risk-check", () => {
  const riskIds = [
    "AV-R01",
    "AV-R02",
    "AV-R03",
    "AV-R04",
    "AV-R05",
    "AV-R06",
    "AV-R07",
    "AV-R08",
    "AV-R09",
    "AV-R10",
  ];
  const json = (v: unknown) => JSON.stringify(v, null, 2);
  const pkg = (deps: string[], name = "app") =>
    json({ name, dependencies: Object.fromEntries(deps.map((d) => [d, "1.0.0"])) });

  /** Write a small project, run discover then risk-check, and return the rule risks. */
  function check(files: Record<string, string>, opts: { keepAgent?: boolean } = {}) {
    const root = path.join(tmp(), "proj");
    for (const [f, text] of Object.entries(files)) {
      mkdirSync(path.dirname(path.join(root, f)), { recursive: true });
      writeFileSync(path.join(root, f), text);
    }
    const draft = path.join(tmp(), "model.json");
    expect(run("discover.mjs", ["--root", root, "--out", draft]).status).toBe(0);
    if (opts.keepAgent) {
      const m = JSON.parse(readFileSync(draft, "utf8"));
      m.risks.push({
        id: "agent-1",
        severity: "info",
        nodes: [],
        why: "w",
        check: "c",
        source: "agent",
        evidence: [{ file: "a", line: 1 }],
      });
      writeFileSync(draft, JSON.stringify(m));
    }
    const r = run("risk-check.mjs", ["--model", draft, "--root", root]);
    expect(r.status, r.stderr).toBe(0);
    const model = JSON.parse(readFileSync(draft, "utf8")) as { risks: Risk[] };
    return {
      risks: model.risks.filter((x) => x.source === "rule"),
      model,
      stdout: r.stdout,
      draft,
      root,
    };
  }
  const ids = (files: Record<string, string>) => check(files).risks.map((r) => r.id);

  const express = pkg(["express"]);
  const redisApp = pkg(["express", "ioredis"]);
  const route = (body: string) =>
    `import express from "express";\nconst app = express();\n${body}\napp.listen(3000);\n`;
  const redis = (body: string) =>
    `import Redis from "ioredis";\nconst redis = new Redis();\nexport async function f() {\n${body}\n}\n`;
  const healthy = route(
    `app.get("/health", (_q, r) => r.send("ok"));\napp.get("/x", (_q, r) => r.send("x"));`,
  );

  type Case = { rule: string; name: string; files: Record<string, string>; fires: boolean };
  const compose = (services: string) => `services:\n${services}`;
  const cases: Case[] = [
    // AV-R01
    {
      rule: "AV-R01",
      name: "one postgres service",
      fires: true,
      files: { "docker-compose.yml": compose("  db:\n    image: postgres:16\n") },
    },
    {
      rule: "AV-R01",
      name: "a replica service exists",
      fires: false,
      files: {
        "docker-compose.yml": compose(
          "  db:\n    image: postgres:16\n  db-replica:\n    image: postgres:16\n",
        ),
      },
    },
    {
      rule: "AV-R01",
      name: "a managed database dependency",
      fires: false,
      files: { "package.json": pkg(["pg", "@neondatabase/serverless"]) },
    },
    {
      rule: "AV-R01",
      name: "two database nodes (postgres and mongo)",
      fires: false,
      files: {
        "docker-compose.yml": compose(
          "  db:\n    image: postgres:16\n  docs:\n    image: mongo:7\n",
        ),
      },
    },
    // AV-R02
    {
      rule: "AV-R02",
      name: "set without an expiry",
      fires: true,
      files: { "package.json": redisApp, "src/a.ts": redis(`  await redis.set("k", "v");`) },
    },
    {
      rule: "AV-R02",
      name: "hset without expire",
      fires: true,
      files: { "package.json": redisApp, "src/a.ts": redis(`  await redis.hset("h", "a", "1");`) },
    },
    {
      rule: "AV-R02",
      name: 'set with "EX"',
      fires: false,
      files: {
        "package.json": redisApp,
        "src/a.ts": redis(`  await redis.set("k", "v", "EX", 60);`),
      },
    },
    {
      rule: "AV-R02",
      name: "set with { ex }",
      fires: false,
      files: {
        "package.json": redisApp,
        "src/a.ts": redis(`  await redis.set("k", "v", { ex: 60 });`),
      },
    },
    {
      rule: "AV-R02",
      name: "setex",
      fires: false,
      files: { "package.json": redisApp, "src/a.ts": redis(`  await redis.setex("k", 60, "v");`) },
    },
    {
      rule: "AV-R02",
      name: "hset followed by expire",
      fires: false,
      files: {
        "package.json": redisApp,
        "src/a.ts": redis(`  await redis.hset("h", "a", "1");\n  await redis.expire("h", 60);`),
      },
    },
    {
      rule: "AV-R02",
      name: "a Map set in a redis file",
      fires: false,
      files: {
        "package.json": redisApp,
        "src/a.ts": redis(`  const m = new Map();\n  m.set("a", 1);`),
      },
    },
    {
      rule: "AV-R02",
      name: "set only in a comment",
      fires: false,
      files: { "package.json": redisApp, "src/a.ts": redis(`  // await redis.set("k", "v");`) },
    },
    // AV-R03
    {
      rule: "AV-R03",
      name: "routes and no limiter",
      fires: true,
      files: {
        "package.json": express,
        "src/server.ts": route(`app.get("/x", (_q, r) => r.send("x"));`),
      },
    },
    {
      rule: "AV-R03",
      name: "express-rate-limit dependency",
      fires: false,
      files: {
        "package.json": pkg(["express", "express-rate-limit"]),
        "src/server.ts": route(`app.get("/x", (_q, r) => r.send("x"));`),
      },
    },
    {
      rule: "AV-R03",
      name: "a rateLimit() call",
      fires: false,
      files: {
        "package.json": express,
        "src/server.ts": route(
          `app.use(rateLimit({ max: 5 }));\napp.get("/x", (_q, r) => r.send("x"));`,
        ),
      },
    },
    {
      rule: "AV-R03",
      name: "a backend with no routes",
      fires: false,
      files: { "package.json": express, "src/lib.ts": `export const x = 1;\n` },
    },
    // AV-R04
    {
      rule: "AV-R04",
      name: "fetch to an outside host",
      fires: true,
      files: {
        "package.json": express,
        "src/a.ts": `export const f = () => fetch("https://api.example.com/v1");\n`,
      },
    },
    {
      rule: "AV-R04",
      name: "axios without timeout",
      fires: true,
      files: {
        "package.json": express,
        "src/a.ts": `import axios from "axios";\nexport const f = () => axios.get("https://api.example.com/v1");\n`,
      },
    },
    {
      rule: "AV-R04",
      name: "fetch with AbortSignal.timeout",
      fires: false,
      files: {
        "package.json": express,
        "src/a.ts": `export const f = () => fetch("https://api.example.com/v1", { signal: AbortSignal.timeout(5000) });\n`,
      },
    },
    {
      rule: "AV-R04",
      name: "axios with a timeout",
      fires: false,
      files: {
        "package.json": express,
        "src/a.ts": `import axios from "axios";\nexport const f = () => axios.get("https://api.example.com/v1", { timeout: 3000 });\n`,
      },
    },
    {
      rule: "AV-R04",
      name: "internal service and relative urls",
      fires: false,
      files: {
        "package.json": express,
        "src/a.ts": `export const f = () => fetch("http://api:4000/me");\nexport const g = () => fetch("/api/me");\nexport const h = () => fetch("https://localhost:3000/x");\n`,
      },
    },
    {
      rule: "AV-R04",
      name: "a fetch inside a comment",
      fires: false,
      files: {
        "package.json": express,
        "src/a.ts": `// fetch("https://api.example.com/v1")\nexport const x = 1;\n`,
      },
    },
    // AV-R05
    {
      rule: "AV-R05",
      name: "query inside a for loop",
      fires: true,
      files: {
        "package.json": express,
        "src/a.ts": `export async function f(ids: number[]) {\n  for (const id of ids) {\n    await prisma.user.findUnique({ where: { id } });\n  }\n}\n`,
      },
    },
    {
      rule: "AV-R05",
      name: "query inside map(async)",
      fires: true,
      files: {
        "package.json": express,
        "src/a.ts": `export const f = (ids: number[]) => Promise.all(ids.map(async (id) => {\n  return await prisma.user.findUnique({ where: { id } });\n}));\n`,
      },
    },
    {
      rule: "AV-R05",
      name: "sql query inside while",
      fires: true,
      files: {
        "package.json": express,
        "src/a.ts": `export async function f() {\n  while (more) {\n    const r = await pool.query("select 1");\n  }\n}\n`,
      },
    },
    {
      rule: "AV-R05",
      name: "one batched query",
      fires: false,
      files: {
        "package.json": express,
        "src/a.ts": `export async function f(ids: number[]) {\n  const rows = await prisma.user.findMany({ where: { id: { in: ids } } });\n  for (const r of rows) { console.log(r); }\n}\n`,
      },
    },
    {
      rule: "AV-R05",
      name: "a loop that awaits something else",
      fires: false,
      files: {
        "package.json": express,
        "src/a.ts": `export async function f(ids: number[]) {\n  for (const id of ids) {\n    await sleep(10);\n  }\n}\n`,
      },
    },
    {
      rule: "AV-R05",
      name: "a loop and a query only in a comment",
      fires: false,
      files: {
        "package.json": express,
        "src/a.ts": `export async function f(ids: number[]) {\n  for (const id of ids) {\n    // await prisma.user.findUnique({ where: { id } });\n  }\n}\n`,
      },
    },
    // AV-R06
    {
      rule: "AV-R06",
      name: "email sent in a route and no queue",
      fires: true,
      files: {
        "package.json": express,
        "src/routes/mail.ts": `export async function send(req, res) {\n  await resend.emails.send({ to: "a@example.com" });\n  res.end();\n}\n`,
      },
    },
    {
      rule: "AV-R06",
      name: "the same call with a queue present",
      fires: false,
      files: {
        "package.json": pkg(["express", "bullmq"]),
        "src/routes/mail.ts": `export async function send(req, res) {\n  await resend.emails.send({ to: "a@example.com" });\n  res.end();\n}\n`,
      },
    },
    {
      rule: "AV-R06",
      name: "the call lives in a worker, not a route",
      fires: false,
      files: {
        "package.json": express,
        "src/jobs/mail.ts": `export async function send() {\n  await resend.emails.send({ to: "a@example.com" });\n}\n`,
      },
    },
    // AV-R07
    {
      rule: "AV-R07",
      name: "NEXT_PUBLIC secret key in the env example",
      fires: true,
      files: { ".env.example": "NEXT_PUBLIC_STRIPE_SECRET_KEY=\n" },
    },
    {
      rule: "AV-R07",
      name: "VITE token in code",
      fires: true,
      files: {
        "package.json": express,
        "src/a.ts": `export const t = import.meta.env.VITE_API_TOKEN;\n`,
      },
    },
    {
      rule: "AV-R07",
      name: "publishable, anon and plain names",
      fires: false,
      files: {
        ".env.example":
          "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=\nNEXT_PUBLIC_SUPABASE_ANON_KEY=\nNEXT_PUBLIC_SITE_URL=\nSTRIPE_SECRET_KEY=\n",
      },
    },
    // AV-R08
    {
      rule: "AV-R08",
      name: "routes and no health route",
      fires: true,
      files: {
        "package.json": express,
        "src/server.ts": route(`app.get("/x", (_q, r) => r.send("x"));`),
      },
    },
    {
      rule: "AV-R08",
      name: "a /health route",
      fires: false,
      files: { "package.json": express, "src/server.ts": healthy },
    },
    {
      rule: "AV-R08",
      name: "a healthz file",
      fires: false,
      files: {
        "package.json": express,
        "src/server.ts": route(`app.get("/x", (_q, r) => r.send("x"));`),
        "src/routes/healthz.ts": `export const ok = true;\n`,
      },
    },
    // AV-R09
    {
      rule: "AV-R09",
      name: "vercel at the root with pg",
      fires: true,
      files: { "vercel.json": "{}", "package.json": pkg(["next", "pg"]) },
    },
    {
      rule: "AV-R09",
      name: "vercel in a folder with no database client",
      fires: false,
      files: {
        "apps/web/vercel.json": "{}",
        "apps/web/package.json": pkg(["next"], "web"),
        "apps/api/package.json": pkg(["pg"], "api"),
      },
    },
    {
      rule: "AV-R09",
      name: "a serverless driver",
      fires: false,
      files: {
        "vercel.json": "{}",
        "package.json": pkg(["next", "pg", "@neondatabase/serverless"]),
      },
    },
    {
      rule: "AV-R09",
      name: "a pooled variable name",
      fires: false,
      files: {
        "vercel.json": "{}",
        "package.json": pkg(["next", "pg"]),
        ".env.example": "DATABASE_URL_POOLED=\n",
      },
    },
    // AV-R10
    {
      rule: "AV-R10",
      name: "redis published with no password",
      fires: true,
      files: {
        "docker-compose.yml": compose(
          '  cache:\n    image: redis:7\n    ports:\n      - "6379:6379"\n',
        ),
      },
    },
    {
      rule: "AV-R10",
      name: "postgres published on all interfaces",
      fires: true,
      files: {
        "docker-compose.yml": compose(
          '  db:\n    image: postgres:16\n    ports:\n      - "5432:5432"\n',
        ),
      },
    },
    {
      rule: "AV-R10",
      name: "redis with a password and no published port",
      fires: false,
      files: {
        "docker-compose.yml": compose(
          '  cache:\n    image: redis:7\n    command: ["redis-server", "--requirepass", "x"]\n',
        ),
      },
    },
    {
      rule: "AV-R10",
      name: "ports bound to 127.0.0.1",
      fires: false,
      files: {
        "docker-compose.yml": compose(
          '  db:\n    image: postgres:16\n    ports:\n      - "127.0.0.1:5432:5432"\n',
        ),
      },
    },
  ];

  it("has a seeded case and a benign case for every rule", () => {
    for (const id of riskIds) {
      expect(
        cases.some((c) => c.rule === id && c.fires),
        `${id} seeded`,
      ).toBe(true);
      expect(
        cases.some((c) => c.rule === id && !c.fires),
        `${id} benign`,
      ).toBe(true);
    }
  });

  it.each(cases)("$rule: $name", ({ rule, files, fires }) => {
    const got = ids(files);
    if (fires) expect(got).toContain(rule);
    else expect(got).not.toContain(rule);
  });

  describe("on the fixture app", () => {
    const fixtureRoot = skillFile("arch-visualize", "evals/fixture-app");
    const start = () => {
      const m = path.join(tmp(), "m.json");
      writeFileSync(m, JSON.stringify(readJson("evals/fixture-model.json")));
      return m;
    };
    const model = start();
    const first = run("risk-check.mjs", ["--model", model, "--root", fixtureRoot]);
    const risks = (JSON.parse(readFileSync(model, "utf8")).risks as Risk[]).filter(
      (r) => r.source === "rule",
    );
    const want = readJson("evals/expected.json").risks;

    it("finds the seeded risks and stays silent on the look-alikes", () => {
      expect(first.status).toBe(0);
      expect(risks.map((r) => r.id)).toEqual(Object.keys(want.fire));
      for (const id of want.silent) expect(risks.map((r) => r.id)).not.toContain(id);
      for (const r of risks) {
        const w = want.fire[r.id];
        expect(r.nodes, r.id).toEqual(w.nodes);
        for (const e of w.evidence)
          expect(
            r.evidence.some((x) => x.file === e.file && x.line === e.line),
            `${r.id} ${e.file}:${e.line}`,
          ).toBe(true);
      }
    });

    it("reports saveSession but not the Redis set that has EX", () => {
      const r = risks.find((x) => x.id === "AV-R02")!;
      expect(r.evidence.map((e) => e.line)).toEqual([10]);
    });

    it("gives every risk evidence, a check, a why and an allowed severity", () => {
      for (const r of risks) {
        expect(["info", "warn"]).toContain(r.severity);
        expect(r.evidence.length).toBeGreaterThan(0);
        expect(r.evidence.length).toBeLessThanOrEqual(5);
        expect(r.check.length).toBeGreaterThan(20);
        expect(r.title).toBeTruthy();
        expect(r.source).toBe("rule");
      }
      for (const id of ["AV-R02", "AV-R03", "AV-R04", "AV-R05", "AV-R08"])
        expect(risks.find((r) => r.id === id)!.why).toMatch(/^Heuristic:/);
    });

    it("keeps the model valid and the agent risk, and prints under 40 lines", () => {
      const m = JSON.parse(readFileSync(model, "utf8"));
      expect(m.risks.some((r: Risk) => r.source === "agent")).toBe(true);
      expect(run("model-check.mjs", ["--model", model]).status).toBe(0);
      expect(first.stdout.trimEnd().split("\n").length).toBeLessThanOrEqual(40);
      expect(first.stdout).toMatch(/not verdicts/);
    });

    it("is idempotent: a second run changes nothing and duplicates nothing", () => {
      const before = readFileSync(model, "utf8");
      expect(run("risk-check.mjs", ["--model", model, "--root", fixtureRoot]).status).toBe(0);
      expect(readFileSync(model, "utf8")).toBe(before);
    });

    it("is deterministic across separate runs", () => {
      const other = start();
      run("risk-check.mjs", ["--model", other, "--root", fixtureRoot]);
      expect(readFileSync(other, "utf8")).toBe(readFileSync(model, "utf8"));
    });

    it("the committed fixture model carries the same rule risks", () => {
      const committed = (readJson("evals/fixture-model.json").risks as Risk[]).filter(
        (r) => r.source === "rule",
      );
      expect(committed.map((r) => r.id)).toEqual(risks.map((r) => r.id));
    });

    it("rule risks are replaced, not duplicated, and agent risks survive", () => {
      const r = check(
        { "docker-compose.yml": compose("  db:\n    image: postgres:16\n") },
        { keepAgent: true },
      );
      expect(r.model.risks.filter((x) => x.source === "agent")).toHaveLength(1);
      run("risk-check.mjs", ["--model", r.draft, "--root", r.root]);
      const again = JSON.parse(readFileSync(r.draft, "utf8")) as { risks: Risk[] };
      expect(again.risks.filter((x) => x.id === "AV-R01")).toHaveLength(1);
    });
  });

  it("never opens secret files: the canary appears nowhere", () => {
    const root = fixtureWithSecrets();
    const draft = path.join(tmp(), "d.json");
    run("discover.mjs", ["--root", root, "--out", draft]);
    const r = run("risk-check.mjs", ["--model", draft, "--root", root]);
    expect(r.stdout + r.stderr).not.toContain(CANARY);
    expect(readFileSync(draft, "utf8")).not.toContain(CANARY);
    expect(r.stdout).toMatch(/5 secret-named file\(s\) never opened/);
  });

  it("works through a symlinked skill folder and fails cleanly without a model", () => {
    const link = path.join(tmp(), "skill-link");
    symlinkSync(skillFile("arch-visualize", "."), link);
    const m = path.join(tmp(), "m.json");
    writeFileSync(m, JSON.stringify(readJson("evals/fixture-model.json")));
    const r = spawnSync(
      process.execPath,
      [path.join(link, "scripts/risk-check.mjs"), "--model", m, "--root", FIXTURE],
      { encoding: "utf8" },
    );
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/possible risk/);
    expect(run("risk-check.mjs", ["--model", path.join(tmp(), "none.json")]).status).toBe(2);
  });

  it("documents every rule, and says which are heuristics", () => {
    const doc = readFileSync(skillFile("arch-visualize", "references/risks.md"), "utf8");
    for (const id of riskIds) expect(doc, id).toMatch(new RegExp(`## ${id} `));
    for (const id of ["AV-R02", "AV-R03", "AV-R04", "AV-R05", "AV-R06", "AV-R08", "AV-R09"])
      expect(doc, id).toMatch(new RegExp(`## ${id} [^\\n]*_heuristic_`));
    expect(doc).toMatch(/possible risk to check/i);
    expect(doc).toMatch(/names only|env \*\*names\*\*/);
  });

  it("keeps rule texts honest: no verdict words, a check for each", async () => {
    const { RULES } = await loadScript<{
      RULES: Record<string, { why: string; check: string; severity: string; title: string }>;
    }>("arch-visualize", "scripts/risk-check.mjs");
    expect(Object.keys(RULES).sort()).toEqual(riskIds);
    for (const r of Object.values(RULES)) {
      expect(["info", "warn"]).toContain(r.severity);
      expect(r.why + r.check).not.toMatch(
        /\b(vulnerable|insecure|broken|bad architecture|must fix|critical)\b/i,
      );
      expect(r.check.length).toBeGreaterThan(30);
    }
  });
});

describe("arch-visualize house standard", () => {
  const dir = skillFile("arch-visualize", ".");
  const skillText = readFileSync(path.join(dir, "SKILL.md"), "utf8");
  const fm = /^---\n([\s\S]*?)\n---\n/.exec(skillText)![1];
  const meta = readFileSync(path.join(dir, "skill.meta.yaml"), "utf8");

  it("keeps SKILL.md within 150 lines with the six sections in order", () => {
    expect(skillText.replace(/\n$/, "").split("\n").length).toBeLessThanOrEqual(150);
    const headings = [...skillText.matchAll(/^## (.+)$/gm)].map((m) => m[1]);
    expect(headings).toEqual([
      "Use when",
      "Don't use when",
      "Steps",
      "Budget",
      "Output",
      "Done when",
    ]);
    expect(skillText).not.toContain("<!-- include:");
  });

  it("is started on purpose, is read and write only, and has no network tools", () => {
    expect(fm).toMatch(/^name: arch-visualize$/m);
    expect(fm).toMatch(/^disable-model-invocation: true$/m);
    expect(fm).toMatch(/^allowed-tools: Read Write Glob Grep Bash\(node \*\)$/m);
    expect(fm).not.toMatch(/WebFetch|WebSearch|curl|mcp__/);
    const description = /^description: (.*)$/m.exec(fm)![1];
    expect(description).not.toContain(": ");
    expect(description).toMatch(/Don't use/);
    expect(description.length).toBeLessThanOrEqual(1024);
  });

  it("declares what it does in skill.meta.yaml", () => {
    expect(meta).toMatch(/^niche: arch$/m);
    expect(meta).toMatch(/^kind: quality$/m);
    expect(meta).toMatch(/^tier: specialty$/m);
    expect(meta).toMatch(/network: false/);
    expect(meta).toMatch(/writes_files: true/);
    expect(meta).toMatch(/runs_scripts: true/);
  });

  it("points at scripts and references that exist, one level deep", () => {
    for (const m of skillText.matchAll(/<skill>\/scripts\/([\w-]+\.mjs)/g))
      expect(existsSync(path.join(dir, "scripts", m[1])), m[1]).toBe(true);
    for (const m of skillText.matchAll(/references\/([\w-]+\.md)/g))
      expect(existsSync(path.join(dir, "references", m[1])), m[1]).toBe(true);
    for (const e of readdirSync(path.join(dir, "references"), { withFileTypes: true }))
      expect(e.isDirectory()).toBe(false);
    for (const f of ["discover", "model-check", "risk-check", "render"])
      expect(skillText).toContain(`scripts/${f}.mjs`);
  });

  it("lists a preview for every screenshot and each file exists and is small", () => {
    const shots = [...meta.matchAll(/^\s+- (\S+\.jpg)$/gm)].map((m) => m[1]);
    expect(shots.length).toBeGreaterThanOrEqual(6);
    for (const s of shots) {
      expect(existsSync(path.join(dir, "preview", s)), s).toBe(true);
      expect(statSync(path.join(dir, "preview", s)).size, s).toBeLessThan(250_000);
    }
  });

  it("passes the security audit with no critical or high findings", async () => {
    const { auditSkill } = (await import("@agentsaisle/audit")) as {
      auditSkill: (
        f: string,
        o: object,
      ) => Promise<{
        findings: { severity: string; rule: string; message: string }[];
        grade: string;
      }>;
    };
    const report = await auditSkill(dir, {
      skill: "arch-visualize",
      folderName: "arch-visualize",
      includeUninstalled: true,
    });
    const bad = report.findings.filter((f) => f.severity === "critical" || f.severity === "high");
    expect(bad, JSON.stringify(bad)).toEqual([]);
    expect(["A", "B"]).toContain(report.grade);
  });
});
