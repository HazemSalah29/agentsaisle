import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadScript, skillFile } from "./load";

type Loose = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
type Cost = {
  parseProviders: (t: string) => Loose;
  quote: (o: Loose) => Loose;
  overCap: (o: Loose) => string | null;
  spentThisMonth: (rows: Loose[], now: Date) => number;
  approvalText: (n: number) => string;
};
type Gen = {
  generateOne: (o: Loose) => Promise<Loose>;
  resolveProvider: (id: string, c: Loose) => Loose;
};

const YAML = `monthlyCapUsd: 5
providers:
  - id: gem
    adapter: gemini-image
    kind: image
    model: m1
    keyEnv: GEMINI_API_KEY
    usdPerImage: 0.04 # price
  - id: vv
    adapter: veo
    kind: video
    model: m2
    usdPerSecond: 0.1
`;
const KEY = "AIzaSyCANARY0123456789abcdefghijklmnop";
const proj = () => mkdtempSync(path.join(os.tmpdir(), "video-generate-"));
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==",
  "base64",
);
const gen = (dir: string, ...a: string[]) =>
  spawnSync(
    "node",
    [skillFile("video-generate", "scripts/generate.mjs"), ...a.slice(0, 1), dir, ...a.slice(1)],
    { encoding: "utf8" },
  );

describe("video-generate cost guard", () => {
  it("parses providers.yaml and prices a run", async () => {
    const c = await loadScript<Cost>("video-generate", "scripts/cost.mjs");
    const cfg = c.parseProviders(YAML);
    expect(cfg.monthlyCapUsd).toBe(5);
    expect(cfg.providers.map((p: Loose) => p.id)).toEqual(["gem", "vv"]);
    expect(c.quote({ entry: cfg.providers[1], kind: "video", count: 3, seconds: 4 }).totalUsd).toBe(
      1.2,
    );
    expect(c.approvalText(1.2)).toBe("1.2000");
    expect(() => c.quote({ entry: { id: "x" }, kind: "image", count: 1 })).toThrow(
      /no usdPerImage/,
    );
  });
  it("refuses at $0 budget, $0 cap, over budget and over the monthly cap", async () => {
    const c = await loadScript<Cost>("video-generate", "scripts/cost.mjs");
    const now = new Date("2026-11-10T00:00:00Z");
    const base = { totalUsd: 1, monthlyCapUsd: 5, budgetUsd: 3, ledger: [], now };
    expect(c.overCap(base)).toBeNull();
    expect(c.overCap({ ...base, budgetUsd: 0 })).toMatch(/budget is \$0/);
    expect(c.overCap({ ...base, monthlyCapUsd: 0 })).toMatch(/monthlyCapUsd/);
    expect(c.overCap({ ...base, ledger: [{ costUsd: 2.5, at: "2026-11-01T00:00:00Z" }] })).toMatch(
      /over its \$3 budget/,
    );
    expect(
      c.overCap({ ...base, budgetUsd: 99, ledger: [{ costUsd: 4.5, at: "2026-11-01T00:00:00Z" }] }),
    ).toMatch(/monthly cap/);
    expect(
      c.overCap({ ...base, budgetUsd: 99, ledger: [{ costUsd: 4.5, at: "2026-10-01T00:00:00Z" }] }),
    ).toBeNull();
    expect(c.overCap({ ...base, totalUsd: 0, budgetUsd: 0 })).toBeNull();
  });
});

describe("video-generate generateOne", () => {
  it("asks for the exact total, then runs, logs, lists the asset and serves a repeat from the cache", async () => {
    const g = await loadScript<Gen>("video-generate", "scripts/generate.mjs");
    const c = await loadScript<Cost>("video-generate", "scripts/cost.mjs");
    const dir = proj();
    writeFileSync(path.join(dir, "video.json"), JSON.stringify({ assets: [] }));
    const config = c.parseProviders(YAML);
    let calls = 0;
    const fetch = async (url: string, init: Loose) => {
      calls++;
      expect(url).toContain("generativelanguage.googleapis.com");
      expect(init.headers["x-goog-api-key"]).toBe(KEY);
      const data = png.toString("base64");
      return {
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [{ content: { parts: [{ inlineData: { mimeType: "image/png", data } }] } }],
        }),
      };
    };
    const ctx = { env: { GEMINI_API_KEY: KEY }, fetch, run: () => ({ status: 1 }) };
    const opts = {
      provider: "gem",
      prompt: "a lantern",
      id: "lamp",
      budget: 1,
      ref: [] as string[],
    };
    const now = new Date("2026-11-10T00:00:00Z");
    const first = await g.generateOne({ dir, kind: "image", opts, config, ctx, now });
    expect(first).toMatchObject({ status: "needs-approval", approve: "0.0400" });
    expect(calls).toBe(0);
    await expect(
      g.generateOne({ dir, kind: "image", opts: { ...opts, approve: "0.04" }, config, ctx, now }),
    ).resolves.toMatchObject({ status: "needs-approval" });
    const done = await g.generateOne({
      dir,
      kind: "image",
      opts: { ...opts, approve: "0.0400" },
      config,
      ctx,
      now,
    });
    expect(done).toMatchObject({ status: "done", costUsd: 0.04, path: "generated/lamp.png" });
    const again = await g.generateOne({
      dir,
      kind: "image",
      opts: { ...opts, id: "lamp2" },
      config,
      ctx,
      now,
    });
    expect(again).toMatchObject({ status: "cached", costUsd: 0 });
    expect(calls).toBe(1);
    const video = JSON.parse(readFileSync(path.join(dir, "video.json"), "utf8"));
    expect(video.assets.map((a: Loose) => a.id)).toEqual(["lamp", "lamp2"]);
    expect(video.assets[0]).toMatchObject({
      source: "generated",
      aiGenerated: true,
      kind: "image",
    });
    const logs = readFileSync(path.join(dir, "generation-log.jsonl"), "utf8");
    expect(logs.trim().split("\n")).toHaveLength(2);
    // the key never reaches the log, video.json or the cache listing
    expect(logs + JSON.stringify(video)).not.toContain(KEY);
  });
  it("refuses at a $0 budget without calling the provider, and rejects fake image bytes", async () => {
    const g = await loadScript<Gen>("video-generate", "scripts/generate.mjs");
    const c = await loadScript<Cost>("video-generate", "scripts/cost.mjs");
    const config = c.parseProviders(YAML);
    let calls = 0;
    const fetch = async () => (
      calls++,
      {
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ inlineData: { data: Buffer.from("<html>").toString("base64") } }],
              },
            },
          ],
        }),
      }
    );
    const ctx = { env: { GEMINI_API_KEY: KEY }, fetch, run: () => ({ status: 1 }) };
    const dir = proj();
    const opts = { provider: "gem", prompt: "p", ref: [] as string[], approve: "0.0400" };
    await expect(g.generateOne({ dir, kind: "image", opts, config, ctx })).rejects.toThrow(
      /budget is \$0/,
    );
    expect(calls).toBe(0);
    await expect(
      g.generateOne({ dir, kind: "image", opts: { ...opts, budget: 1 }, config, ctx }),
    ).rejects.toThrow(/not a real/);
    expect(existsSync(path.join(dir, "generated"))).toBe(false);
  });
  it("refuses unbuilt kinds, unknown providers, missing prices and refs outside the project", async () => {
    const g = await loadScript<Gen>("video-generate", "scripts/generate.mjs");
    const c = await loadScript<Cost>("video-generate", "scripts/cost.mjs");
    const config = c.parseProviders(YAML);
    const ctx = { env: {}, fetch: async () => ({}), run: () => ({ status: 1 }) };
    const dir = proj();
    const go = (kind: string, o: Loose) =>
      g.generateOne({
        dir,
        kind,
        opts: { prompt: "p", provider: "test", ref: [], ...o },
        config,
        ctx,
      });
    await expect(go("music", {})).rejects.toThrow(/not built/);
    await expect(go("image", { provider: "nope" })).rejects.toThrow(/Unknown provider/);
    await expect(go("image", { provider: "vv" })).rejects.toThrow(/cannot make image/);
    await expect(go("image", { ref: ["../x.png"] })).rejects.toThrow(/inside the project/);
    await expect(go("image", { id: "Bad Id" })).rejects.toThrow(/--id/);
    await expect(
      g.generateOne({
        dir,
        kind: "image",
        opts: { prompt: "p", provider: "gem", ref: [], budget: 1 },
        config: { ...config, providers: [{ id: "gem", adapter: "gemini-image", model: "m" }] },
        ctx,
      }),
    ).rejects.toThrow(/no usdPerImage/);
  });
});

describe("video-generate adapters", () => {
  it("veo polls the operation and refuses a download host that is not Google's", async () => {
    const { ADAPTERS } = await loadScript<{ ADAPTERS: Loose }>(
      "video-generate",
      "scripts/providers.mjs",
    );
    const mk =
      (uri: string) =>
      async (url: string, init: Loose = {}) => {
        if (init.method === "POST")
          return { ok: true, status: 200, json: async () => ({ name: "operations/abc" }) };
        if (url.endsWith("operations/abc"))
          return {
            ok: true,
            status: 200,
            json: async () => ({
              done: true,
              response: { generateVideoResponse: { generatedSamples: [{ video: { uri } }] } },
            }),
          };
        return { ok: true, status: 200, arrayBuffer: async () => Buffer.from("....ftypmp42") };
      };
    const ctx = (f: unknown) => ({ env: { GEMINI_API_KEY: KEY }, fetch: f, pollMs: 0 });
    const args = { prompt: "p", model: "m", seconds: 4 };
    await expect(
      ADAPTERS.veo.generate(args, ctx(mk("https://evil.example.com/v.mp4"))),
    ).rejects.toThrow(/Refused to download/);
    const ok = await ADAPTERS.veo.generate(
      args,
      ctx(mk("https://generativelanguage.googleapis.com/v1beta/files/x:download")),
    );
    expect(ok.ext).toBe(".mp4");
    await expect(ADAPTERS.veo.generate(args, { env: {}, fetch: mk("") })).rejects.toThrow(
      /GEMINI_API_KEY/,
    );
  });
  it("test provider is deterministic and free; the CLI shows the same bytes for the same prompt", () => {
    const a = proj();
    const b = proj();
    for (const d of [a, b]) expect(gen(d, "image", "--prompt", "fox", "--id", "x").status).toBe(0);
    expect(
      readFileSync(path.join(a, "generated/x.png")).equals(
        readFileSync(path.join(b, "generated/x.png")),
      ),
    ).toBe(true);
    expect(gen(a, "music", "--prompt", "x").status).toBe(2);
  });
  it("the CLI stops with exit 3 and a quote for a paid provider, sending nothing", () => {
    const dir = proj();
    writeFileSync(path.join(dir, "providers.yaml"), YAML);
    const r = gen(dir, "image", "--provider", "gem", "--prompt", "p", "--budget", "1");
    expect(r.status).toBe(3);
    expect(r.stdout).toContain("--approve 0.0400");
    expect(gen(dir, "image", "--provider", "gem", "--prompt", "p", "--yes").status).toBe(2);
  });
  it("keeps byte-identical copies of the runner and helpers", () => {
    for (const f of ["scripts/run.mjs", "scripts/_lib.mjs"])
      expect(readFileSync(skillFile("video-generate", f), "utf8")).toBe(
        readFileSync(skillFile("video-core", f), "utf8"),
      );
  });
});
