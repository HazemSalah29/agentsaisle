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
