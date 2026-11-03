import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
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
    adapter: none
    kind: image
    model: m1
    keyEnv: KEY_VAR
    usdPerImage: 0.04 # price
  - id: vv
    adapter: none
    kind: video
    model: m2
    usdPerSecond: 0.1
`;
const proj = () => mkdtempSync(path.join(os.tmpdir(), "video-generate-"));
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
  it("refuses unbuilt kinds, unknown providers and refs outside the project", async () => {
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
    await expect(go("image", { provider: "gem" })).rejects.toThrow(/names adapter/);
    await expect(go("image", { ref: ["../x.png"] })).rejects.toThrow(/inside the project/);
    await expect(go("image", { id: "Bad Id" })).rejects.toThrow(/--id/);
  });
  it("has no network adapter: only the offline test provider is built in", async () => {
    const p = await loadScript<{ ADAPTERS: Loose }>("video-generate", "scripts/providers.mjs");
    expect(Object.keys(p.ADAPTERS)).toEqual(["test"]);
  });
});

describe("video-generate adapters", () => {
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
  it("keeps byte-identical copies of the runner and helpers", () => {
    for (const f of ["scripts/run.mjs", "scripts/_lib.mjs"])
      expect(readFileSync(skillFile("video-generate", f), "utf8")).toBe(
        readFileSync(skillFile("video-core", f), "utf8"),
      );
  });
});
