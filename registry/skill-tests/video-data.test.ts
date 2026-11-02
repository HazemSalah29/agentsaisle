import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadScript, skillFile } from "./load";

type Loose = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const src = () => loadScript<Loose>("video-data", "scripts/sources.mjs");
const live = () => loadScript<Loose>("video-data", "scripts/live.mjs");
const fch = () => loadScript<Loose>("video-data", "scripts/fetch.mjs");
const tmp = () => mkdtempSync(path.join(os.tmpdir(), "video-data-"));
const NOW = Date.parse("2026-11-03T10:00:00Z");
const day = (n: number) => new Date(NOW - 86_400_000 * n).toISOString().slice(0, 10);
const npmBody = (base: number) => ({
  downloads: Array.from({ length: 14 }, (_, i) => ({
    day: day(14 - i),
    downloads: base + (i >= 7 ? 100 : 0),
  })),
});
const resp = (body: unknown, status = 200, type = "application/json") => ({
  status,
  headers: { get: (k: string) => (k === "content-type" ? type : null) },
  text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
});
const run = (script: string, args: string[]) =>
  spawnSync(process.execPath, [skillFile("video-data", `scripts/${script}`), ...args], {
    encoding: "utf8",
    env: { ...process.env, GITHUB_TOKEN: "ghp_canary00000000000000000000000000000000" },
  });

describe("video-data copies", () => {
  it("keeps a byte-identical _lib.mjs", () => {
    expect(readFileSync(skillFile("video-data", "scripts/_lib.mjs"), "utf8")).toBe(
      readFileSync(skillFile("video-core", "scripts/_lib.mjs"), "utf8"),
    );
  });
});

describe("config and url rules", () => {
  it("accepts the starters and refuses bad names and hosts", async () => {
    const { configProblems, urlProblems } = await src();
    const npm = { id: "n", title: "T", source: "npm", items: ["react", "@scope/pkg"] };
    expect(configProblems(npm)).toEqual([]);
    expect(configProblems({ ...npm, items: ["react", "../x"] })[0]).toContain("not a valid");
    expect(configProblems({ ...npm, items: ["react"] })[0]).toContain("2 to 5");
    expect(
      configProblems({ id: "g", title: "T", source: "github", items: ["a/b", "c/.."] })[0],
    ).toContain("not a valid");
    const url = {
      id: "u",
      title: "T",
      source: "url",
      url: "https://data.example.org/x.csv",
      allowedHosts: ["data.example.org"],
      labelField: "a",
      valueField: "b",
    };
    expect(configProblems(url)).toEqual([]);
    expect(configProblems({ ...url, allowedHosts: ["localhost"] })[0]).toContain("allowedHosts");
    expect(urlProblems("http://data.example.org/x", ["data.example.org"])[0]).toContain("https");
    expect(urlProblems("https://user:pw@data.example.org/x", ["data.example.org"])[0]).toContain(
      "credentials",
    );
    expect(urlProblems("https://data.example.org:8443/x", ["data.example.org"])[0]).toContain(
      "ports",
    );
    expect(urlProblems("https://other.example.org/x", ["data.example.org"])[0]).toContain(
      "not in allowedHosts",
    );
    expect(urlProblems("https://127.0.0.1/x", ["127.0.0.1"])[0]).toContain("ports");
  });
});

describe("fetchData", () => {
  it("sums npm weeks and sends no credentials, only GET with redirect refused", async () => {
    const { fetchData } = await src();
    const seen: Loose[] = [];
    const fetchImpl = async (url: string, init: Loose) => {
      seen.push({ url, init });
      return resp(npmBody(url.endsWith("/react") ? 1000 : 200));
    };
    const d = await fetchData(
      { id: "n", title: "T", source: "npm", items: ["react", "vue"] },
      { fetchImpl, now: NOW },
    );
    expect(d.items[0]).toMatchObject({ label: "react", value: 7 * 1100, previous: 7 * 1000 });
    expect(d.asOf).toBe(day(1));
    for (const s of seen) {
      expect(s.url.startsWith("https://api.npmjs.org/downloads/range/")).toBe(true);
      expect(s.init.method).toBe("GET");
      expect(s.init.redirect).toBe("error");
      expect(JSON.stringify(s.init.headers)).not.toMatch(/authorization|token|ghp_/i);
    }
  });
  it("reads github stars and a latest release, tolerating no release", async () => {
    const { fetchData } = await src();
    const fetchImpl = async (url: string) =>
      url.endsWith("/releases/latest")
        ? url.includes("/a/")
          ? resp({ tag_name: "v1.2.0" })
          : resp({}, 404)
        : resp({ stargazers_count: url.endsWith("/o/a") ? 50 : 90 });
    const d = await fetchData(
      { id: "g", title: "T", source: "github", items: ["o/a", "o/b"] },
      { fetchImpl, now: NOW },
    );
    expect(d.items.map((i: Loose) => i.label)).toEqual(["b", "a"]);
    expect(d.items[1].detail).toBe("latest release v1.2.0");
  });
  it("reads CSV and JSON for url sources and refuses other types", async () => {
    const { fetchData } = await src();
    const cfg = {
      id: "u",
      title: "T",
      source: "url",
      url: "https://data.example.org/x",
      allowedHosts: ["data.example.org"],
      labelField: "name",
      valueField: "v",
      previousField: "p",
    };
    const csv = await fetchData(cfg, {
      fetchImpl: async () => resp('name,v,p\n"A, Inc",10,5\nB,20,20\n', 200, "text/csv"),
      now: NOW,
    });
    expect(csv.items[1]).toMatchObject({ label: "A, Inc", value: 10, previous: 5 });
    const js = await fetchData(cfg, {
      fetchImpl: async () =>
        resp([
          { name: "A", v: 1 },
          { name: "B", v: 2 },
        ]),
      now: NOW,
    });
    expect(js.items[0].label).toBe("B");
    await expect(
      fetchData(cfg, { fetchImpl: async () => resp("<html>", 200, "text/html"), now: NOW }),
    ).rejects.toThrow("JSON and CSV");
  });
  it("reports rate limits and missing data without retrying", async () => {
    const { fetchData } = await src();
    const cfg = { id: "n", title: "T", source: "npm", items: ["react", "vue"] };
    let calls = 0;
    await expect(
      fetchData(cfg, { fetchImpl: async () => (calls++, resp({}, 429)), now: NOW }),
    ).rejects.toThrow("rate limited");
    expect(calls).toBe(1);
    await expect(
      fetchData(cfg, { fetchImpl: async () => resp({ downloads: [] }), now: NOW }),
    ).rejects.toThrow("fewer than 14");
  });
  it("refuses an oversize answer", async () => {
    const { safeGet } = await src();
    const big = {
      status: 200,
      headers: { get: (k: string) => (k === "content-length" ? "2000000" : null) },
      text: async () => "",
    };
    await expect(safeGet("https://api.npmjs.org/x", async () => big)).rejects.toThrow("1 MB");
    const stream = {
      status: 200,
      headers: { get: () => null },
      body: {
        getReader: () => {
          let n = 0;
          return {
            read: async () =>
              n++ < 3 ? { done: false, value: new Uint8Array(500_000) } : { done: true },
            cancel: async () => undefined,
          };
        },
      },
    };
    await expect(safeGet("https://api.npmjs.org/x", async () => stream)).rejects.toThrow("1 MB");
  });
  it("carries the previous snapshot's values forward", async () => {
    const { withPrevious } = await fch();
    const data = {
      asOf: "2026-11-02",
      items: [
        { label: "a", value: 5 },
        { label: "b", value: 3, previous: 1 },
      ],
    };
    const old = {
      asOf: "2026-10-26",
      items: [
        { label: "a", value: 4 },
        { label: "b", value: 9 },
      ],
    };
    expect(withPrevious(data, old).items).toEqual([
      { label: "a", value: 5, previous: 4 },
      { label: "b", value: 3, previous: 1 },
    ]);
    expect(withPrevious(data, { ...old, asOf: "2026-11-02" })).toBe(data);
  });
});

describe("live.mjs", () => {
  const data = (o: Loose = {}) => ({
    id: "npm-weekly",
    source: "npm",
    urls: ["https://api.npmjs.org/downloads/range/a:b/react"],
    fetchedAt: new Date().toISOString(),
    asOf: new Date().toISOString().slice(0, 10),
    metric: "Weekly downloads",
    unit: "",
    items: [
      { label: "react", value: 7700, previous: 7000 },
      { label: "vue", value: 1500, previous: 1600 },
      { label: "svelte", value: 900 },
    ],
    ...o,
  });
  const config = {
    id: "npm-weekly",
    title: "This week in npm",
    source: "npm",
    items: ["react", "vue", "svelte"],
  };
  it("traces every spoken number to a fact with its source", async () => {
    const { buildLive } = await live();
    const r = buildLive(data(), config);
    const chart = r.video.scenes.find((s: Loose) => s.kind === "chart");
    expect(chart.props.title).toContain("npm");
    expect(chart.props.data[0]).toEqual({ label: "react", value: 7700 });
    const spoken = r.script.match(/\d[\d,]*\d/g) ?? [];
    for (const n of spoken) expect(r.facts + data().asOf).toContain(n);
    expect(r.facts).toContain("up 10%");
    expect(r.facts).toContain("down 6%");
    expect(r.facts).not.toContain("svelte is");
    expect(r.facts).toContain("https://api.npmjs.org");
  });
  it("refuses stale, thin and mismatched data", async () => {
    const { dataProblems } = await live();
    expect(dataProblems(data())).toEqual([]);
    expect(dataProblems(data({ fetchedAt: "2026-01-01T00:00:00Z" }))[0]).toContain(
      "older than 8 days",
    );
    expect(dataProblems(data({ items: [{ label: "a", value: 1 }] }))[0]).toContain("2 to 8");
    expect(dataProblems({ nope: 1 })[0]).toContain("not a data file");
  });
  it("init, build, no overwrite, and check.mjs accepts the project", async () => {
    const dir = tmp();
    const cfg = path.join(dir, "live.config.json");
    expect(run("live.mjs", ["init", "--out", cfg]).status).toBe(0);
    expect(run("live.mjs", ["init", "--out", cfg]).stderr).toContain("never overwritten");
    const d = data();
    writeFileSync(path.join(dir, "d.json"), JSON.stringify({ ...d, id: "npm-weekly" }));
    const out = path.join(dir, "p");
    const r = run("live.mjs", [
      "build",
      "--config",
      cfg,
      "--data",
      path.join(dir, "d.json"),
      "--out",
      out,
    ]);
    expect(r.status).toBe(0);
    expect(
      run("live.mjs", ["build", "--config", cfg, "--data", path.join(dir, "d.json"), "--out", out])
        .stderr,
    ).toContain("exists");
    const chk = spawnSync(process.execPath, [skillFile("video-core", "scripts/check.mjs"), out], {
      encoding: "utf8",
    });
    expect(chk.stdout + chk.stderr).toContain("OK");
    expect(r.stdout).not.toContain("Check before publishing");
    const { buildLive } = await live();
    const doubled = buildLive(
      data({
        items: [
          { label: "a", value: 300, previous: 100 },
          { label: "b", value: 5 },
        ],
      }),
      config,
    );
    expect(doubled.summary.big).toEqual(["a"]);
    expect(existsSync(path.join(out, "facts.md"))).toBe(true);
    const bad = run("fetch.mjs", ["--config", path.join(dir, "nope.json")]);
    expect(bad.status).toBe(2);
  });
});
