#!/usr/bin/env node
// Runs the rate-limit simulator (the same code the `rate-limit` scene draws) and prints what happened, so the
// script and the facts can quote real numbers. With --into it also writes the scene props into a video.json.
// Usage: node simulate.mjs --seed 42 --count 80 --pattern poisson --rate 6
//          --algo token-bucket --capacity 5 --refill 3 [--algo2 sliding-window --limit 4 --window 1] [--into video.json --scene s2]
// Patterns: steady (--rate), poisson (--rate), burst (--burst-size --burst-every [--burst-offset]).
// Algorithms: token-bucket (--capacity --refill), leaky-bucket (--capacity --leak), fixed-window and
// sliding-window (--limit --window); the second algorithm uses the same names with a 2 (--capacity2 ...).
import { readFileSync, writeFileSync } from "node:fs";
import { simulate } from "./_sim.mjs";
import { capLines, isEntry, parseArgs } from "./_lib.mjs";

const STRINGS = [
  "seed",
  "count",
  "pattern",
  "rate",
  "burst-size",
  "burst-every",
  "burst-offset",
  "into",
  "scene",
  "title",
  ...["algo", "capacity", "refill", "leak", "limit", "window"].flatMap((k) => [k, `${k}2`]),
];

const num = (v) => (v === undefined ? undefined : Number(v));

/** The algorithm parameters for suffix "" (first) or "2" (second), from parsed flags. */
export function algoFrom(f, sfx = "") {
  const a = f[`algo${sfx}`];
  if (!a) return null;
  const pick = (flag, key) =>
    f[`${flag}${sfx}`] === undefined ? {} : { [key]: num(f[`${flag}${sfx}`]) };
  return {
    algo: a,
    ...pick("capacity", "capacity"),
    ...pick("refill", "refillPerSec"),
    ...pick("leak", "leakPerSec"),
    ...pick("limit", "limit"),
    ...pick("window", "windowSec"),
  };
}

/** The spec (scene props) from parsed flags. */
export function specFrom(f) {
  const pattern = { type: f.pattern ?? "poisson", ratePerSec: num(f.rate ?? 5) };
  if (pattern.type === "burst") {
    pattern.burstSize = num(f["burst-size"]);
    pattern.burstEverySec = num(f["burst-every"]);
    if (f["burst-offset"] !== undefined) pattern.burstOffsetSec = num(f["burst-offset"]);
  }
  const algos = [algoFrom(f), algoFrom(f, "2")].filter(Boolean);
  const spec = { seed: num(f.seed ?? 42), count: num(f.count ?? 60), pattern, algos };
  if (f.title) spec.title = f.title;
  return spec;
}

const sec = (ms) => `${Math.round(ms / 100) / 10} s`;

/** Facts a script can quote, per algorithm. */
export function summarize(result) {
  const n = result.arrivals.length;
  return result.runs.map((r) => {
    const first = r.events.find((e) => e.outcome === "rejected");
    let streak = 0;
    let best = 0;
    for (const e of r.events) {
      streak = e.outcome === "rejected" ? streak + 1 : 0;
      best = Math.max(best, streak);
    }
    return {
      algo: r.algo,
      allowed: r.allowed,
      rejected: r.rejected,
      percentAllowed: Math.round((r.allowed / n) * 100),
      firstRejection: first ? { request: first.id + 1, at: sec(first.t) } : null,
      longestRejectedRun: best,
    };
  });
}

function main() {
  let parsed;
  try {
    parsed = parseArgs(process.argv.slice(2), { strings: STRINGS });
    const spec = specFrom(parsed.flags);
    const result = simulate(spec);
    const lines = [
      `seed ${spec.seed}, ${spec.count} requests over ${sec(result.durationMs)} (${spec.pattern.type})`,
    ];
    for (const s of summarize(result))
      lines.push(
        `${s.algo}: ${s.allowed} allowed, ${s.rejected} rejected (${s.percentAllowed}% allowed); ` +
          (s.firstRejection
            ? `first 429 is request ${s.firstRejection.request} at ${s.firstRejection.at}; `
            : "no 429; ") +
          `longest run of 429s: ${s.longestRejectedRun}`,
      );
    const { into, scene } = parsed.flags;
    if (into) {
      const video = JSON.parse(readFileSync(into, "utf8"));
      const target = video.scenes?.find((s) => s.id === scene);
      if (!target) throw new Error(`No scene "${scene}" in ${into}.`);
      if (target.kind !== "rate-limit")
        throw new Error(`Scene "${scene}" is "${target.kind}", not "rate-limit".`);
      target.props = { ...spec };
      writeFileSync(into, `${JSON.stringify(video, null, 2)}\n`);
      lines.push(`Wrote the props into scene ${scene} of ${into}.`);
    } else lines.push(`props: ${JSON.stringify(spec)}`);
    console.log(
      capLines(
        lines,
        "Quote only these numbers; they come from the same code that draws the scene.",
      ),
    );
  } catch (e) {
    console.error(e.message);
    process.exit(2);
  }
}

if (isEntry(import.meta.url)) main();
