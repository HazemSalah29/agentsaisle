import { describe, expect, it } from "vitest";
import { loadScript } from "./load";

type Loose = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
type Sim = {
  simulate: (spec: Loose) => {
    arrivals: number[];
    durationMs: number;
    runs: { algo: string; allowed: number; rejected: number; events: Loose[] }[];
  };
  specProblems: (spec: Loose) => string[];
  arrivals: (spec: Loose) => number[];
};
const load = () => loadScript<Sim>("video-core", "assets/sim/rate-limit.mjs");

const burst = (size: number, every = 2) => ({
  type: "burst",
  ratePerSec: 1,
  burstSize: size,
  burstEverySec: every,
});
const spec = (algo: Loose, pattern: Loose, count: number, seed = 1) => ({
  seed,
  count,
  pattern,
  algos: [algo],
});
const outcomes = (r: { runs: { events: Loose[] }[] }) =>
  r.runs[0].events.map((e) => (e.outcome === "allowed" ? "A" : "R")).join("");

describe("rate-limit simulator", () => {
  it("token bucket of 5 rejects the 6th request at t=0", async () => {
    const { simulate } = await load();
    const r = simulate(spec({ algo: "token-bucket", capacity: 5, refillPerSec: 1 }, burst(6), 6));
    expect(outcomes(r)).toBe("AAAAAR");
    expect(r.runs[0].events[5]).toMatchObject({ t: 0, outcome: "rejected", level: 0, max: 5 });
    expect(r.runs[0].allowed).toBe(5);
    expect(r.runs[0].rejected).toBe(1);
  });

  it("token bucket refills over time (capacity 1, 1 token a second, 2 requests a second)", async () => {
    const { simulate } = await load();
    const steady = { type: "steady", ratePerSec: 2 };
    const r = simulate(spec({ algo: "token-bucket", capacity: 1, refillPerSec: 1 }, steady, 6));
    expect(outcomes(r)).toBe("ARARAR");
  });

  it("leaky bucket of 2 takes 2 of a burst of 3, then has drained by the next burst", async () => {
    const { simulate } = await load();
    const r = simulate(spec({ algo: "leaky-bucket", capacity: 2, leakPerSec: 1 }, burst(3, 2), 6));
    expect(outcomes(r)).toBe("AARAAR");
  });

  it("fixed window resets at the window edge", async () => {
    const { simulate } = await load();
    const steady = { type: "steady", ratePerSec: 4 }; // t = 0, 250, 500, 750, 1000
    const r = simulate(spec({ algo: "fixed-window", limit: 2, windowSec: 1 }, steady, 5));
    expect(outcomes(r)).toBe("AARRA");
  });

  it("sliding window counts only the last window", async () => {
    const { simulate } = await load();
    const steady = { type: "steady", ratePerSec: 4 }; // t = 0, 250, 500, 750, 1000, 1250
    const r = simulate(spec({ algo: "sliding-window", limit: 2, windowSec: 1 }, steady, 6));
    // the window is (t - 1 s, t]: at 1000 the request from 0 has left it; at 1250 so has the one from 250
    expect(outcomes(r)).toBe("AARRAA");
  });

  it("describes the meter exactly: the token level flattens at the top, a window request leaves on time", async () => {
    const { simulate } = await load();
    const slow = { type: "steady", ratePerSec: 0.5 }; // t = 0, 2000
    const tb = simulate(spec({ algo: "token-bucket", capacity: 2, refillPerSec: 1 }, slow, 2));
    expect(tb.runs[0].meter).toEqual([
      [0, 2],
      [0, 2],
      [0, 1],
      [1000, 2],
      [2000, 2],
      [2000, 1],
    ]);
    const sw = simulate(spec({ algo: "sliding-window", limit: 2, windowSec: 1 }, slow, 2));
    expect(sw.runs[0].meter).toContainEqual([1000, 0]);
  });

  it("gives the same log for the same seed and a different one for another seed", async () => {
    const { simulate } = await load();
    const mk = (seed: number) =>
      spec(
        { algo: "token-bucket", capacity: 3, refillPerSec: 2 },
        { type: "poisson", ratePerSec: 5 },
        200,
        seed,
      );
    expect(JSON.stringify(simulate(mk(42)))).toBe(JSON.stringify(simulate(mk(42))));
    expect(simulate(mk(42)).arrivals).not.toEqual(simulate(mk(43)).arrivals);
  });

  it("arrivals are ascending whole milliseconds", async () => {
    const { arrivals } = await load();
    const t = arrivals(spec({}, { type: "poisson", ratePerSec: 10 }, 500, 7));
    expect(t.every((v, i) => Number.isInteger(v) && (i === 0 || v >= t[i - 1]))).toBe(true);
    expect(t).toHaveLength(500);
  });

  it("runs two algorithms over the same arrivals", async () => {
    const { simulate } = await load();
    const r = simulate({
      seed: 42,
      count: 100,
      pattern: { type: "poisson", ratePerSec: 8 },
      algos: [
        { algo: "token-bucket", capacity: 5, refillPerSec: 4 },
        { algo: "sliding-window", limit: 4, windowSec: 1 },
      ],
    });
    expect(r.runs).toHaveLength(2);
    expect(r.runs[0].events.map((e) => e.t)).toEqual(r.runs[1].events.map((e) => e.t));
    for (const run of r.runs) expect(run.allowed + run.rejected).toBe(100);
  });

  it("describes what is wrong with a bad spec, and simulate refuses it", async () => {
    const { specProblems, simulate } = await load();
    const bad = {
      seed: -1,
      count: 5000,
      pattern: { type: "zigzag", ratePerSec: 0 },
      algos: [{ algo: "token-bucket", capacity: 0, extra: 1 }],
    };
    const p = specProblems(bad).join("\n");
    for (const part of [
      "seed",
      "count",
      "pattern.type",
      "ratePerSec",
      "capacity",
      "refillPerSec",
      "extra",
    ])
      expect(p).toContain(part);
    expect(() => simulate(bad)).toThrow(/Invalid rate-limit spec/);
    expect(specProblems({ ...bad, algos: [] }).join()).toContain("algos");
  });
});
