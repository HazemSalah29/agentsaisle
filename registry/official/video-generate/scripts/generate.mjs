#!/usr/bin/env node
// Makes one AI image or video for a project through a provider adapter. Paid calls go through a guard:
// the first run prints the quote and stops (exit 3); it runs only when re-run with --approve <that exact total>.
// There is no --yes. Results are cached by prompt hash (a repeat costs nothing), every call is appended to
// generation-log.jsonl (never the key), and the file is listed in video.json as aiGenerated.
// Usage: node generate.mjs image|video <project-dir> --provider <id> --prompt "..." [--id asset-id] [--seed 1]
//        [--ref a.png,b.png] [--seconds 4] [--aspect 9:16] [--realistic] [--budget usd] [--approve 0.0400]
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { ADAPTERS, UNBUILT } from "./providers.mjs";
import { approvalText, appendLedger, loadProviders, overCap, quote, readLedger } from "./cost.mjs";
import { run as runProgram } from "./run.mjs";
import { capLines, isEntry, isInside, parseArgs } from "./_lib.mjs";

const sha = (d) => createHash("sha256").update(d).digest("hex");
const MAX_BYTES = 200 * 1024 * 1024;
const MAGIC = {
  ".png": (b) => b.subarray(0, 4).equals(Buffer.from([137, 80, 78, 71])),
  ".jpg": (b) => b[0] === 0xff && b[1] === 0xd8,
  ".mp4": (b) => b.length > 12 && b.toString("latin1", 4, 8) === "ftyp",
};

/** The provider entry for an id: "test" is built in and free; anything else must be in providers.yaml. */
export function resolveProvider(id, config) {
  if (id === "test") return { entry: null, adapter: ADAPTERS.test, model: "test-gradient-1" };
  const entry = config.providers.find((p) => p.id === id);
  if (!entry)
    throw new Error(
      `Unknown provider "${id}". Add it to providers.yaml (have: test${config.providers.map((p) => ", " + p.id).join("")}).`,
    );
  const adapter = ADAPTERS[entry.adapter];
  if (!adapter)
    throw new Error(
      `providers.yaml: "${id}" names adapter "${entry.adapter}" (have: ${Object.keys(ADAPTERS).join(", ")}).`,
    );
  if (!entry.model)
    throw new Error(`providers.yaml: "${id}" needs a model (no model is hard-coded).`);
  return { entry, adapter, model: entry.model };
}

export const cacheKey = ({ adapter, model, kind, prompt, seed, seconds, aspect, refHashes }) =>
  sha(JSON.stringify([adapter, model, kind, prompt, seed, seconds, aspect, refHashes]));

/** Plan then (when allowed) make one asset. Returns { status: "done"|"cached"|"needs-approval", ... }. */
export async function generateOne({ dir, kind, opts, config, ctx, now = new Date() }) {
  if (UNBUILT.includes(kind)) throw new Error(`"${kind}" is not built yet (have: image, video).`);
  if (kind !== "image" && kind !== "video")
    throw new Error(`Unknown kind "${kind}" (have: image, video).`);
  if (!opts.prompt || !String(opts.prompt).trim()) throw new Error("Give --prompt.");
  const id = opts.id ?? `gen-${sha(opts.prompt).slice(0, 6)}`;
  if (!/^[a-z][a-z0-9-]{0,31}$/.test(id))
    throw new Error(`--id "${id}" must be lowercase letters, digits and dashes (max 32).`);
  const { entry, adapter, model } = resolveProvider(opts.provider, config);
  if (!adapter.kinds.includes(kind))
    throw new Error(`Provider "${opts.provider}" cannot make ${kind}.`);
  const refs = (opts.ref ?? []).map((r) => {
    if (!isInside(r)) throw new Error(`--ref "${r}" must be a relative path inside the project.`);
    const f = path.join(dir, r);
    if (!existsSync(f)) throw new Error(`--ref "${r}" does not exist.`);
    return f;
  });
  const seconds = kind === "video" ? Number(opts.seconds ?? 4) : undefined;
  if (kind === "video" && !(seconds >= 1 && seconds <= 12))
    throw new Error("--seconds must be between 1 and 12.");
  const spec = {
    adapter: adapter.adapter,
    model,
    kind,
    prompt: opts.prompt,
    seed: Number(opts.seed ?? 1),
    seconds,
    aspect: opts.aspect ?? "9:16",
    refHashes: refs.map((f) => sha(readFileSync(f))),
  };
  const key = cacheKey(spec);
  const cacheDir = path.join(dir, ".generate-cache");
  const cached = ["png", "jpg", "mp4"]
    .map((e) => path.join(cacheDir, `${key}.${e}`))
    .find((f) => existsSync(f));
  const logFile = path.join(dir, "generation-log.jsonl");
  const ledger = readLedger(logFile);
  const q = cached
    ? { unit: "cached", units: 0, unitUsd: 0, totalUsd: 0 }
    : adapter.free
      ? quote({ entry: null, kind })
      : quote({ entry, kind, count: 1, seconds });
  if (!cached && q.totalUsd > 0) {
    const refusal = overCap({
      totalUsd: q.totalUsd,
      monthlyCapUsd: config.monthlyCapUsd,
      budgetUsd: Number(opts.budget ?? 0),
      ledger,
      now,
    });
    if (refusal) throw new Error(refusal);
    if (opts.approve !== approvalText(q.totalUsd))
      return {
        status: "needs-approval",
        quote: q,
        provider: opts.provider,
        approve: approvalText(q.totalUsd),
      };
  }
  let bytes,
    ext,
    usedModel = model;
  if (cached) {
    bytes = readFileSync(cached);
    ext = path.extname(cached);
  } else {
    const r = await adapter.generate(
      { kind, prompt: opts.prompt, seed: spec.seed, refs, seconds, aspect: spec.aspect, model },
      ctx,
    );
    ({ bytes, ext } = r);
    usedModel = r.model ?? model;
    if (!MAGIC[ext]?.(bytes))
      throw new Error(
        `The provider's file is not a real ${ext} image or video; nothing was saved.`,
      );
    if (bytes.length > MAX_BYTES)
      throw new Error("The provider's file is over 200 MB; nothing was saved.");
    mkdirSync(cacheDir, { recursive: true });
    writeFileSync(path.join(cacheDir, `${key}${ext}`), bytes);
  }
  const rel = `generated/${id}${ext}`;
  mkdirSync(path.join(dir, "generated"), { recursive: true });
  writeFileSync(path.join(dir, rel), bytes);
  const hash = sha(bytes);
  appendLedger(logFile, {
    at: now.toISOString(),
    id,
    kind,
    provider: opts.provider,
    model: usedModel,
    prompt: opts.prompt,
    seed: spec.seed,
    seconds,
    refs: opts.ref ?? [],
    cached: Boolean(cached),
    costUsd: cached ? 0 : q.totalUsd,
    sha256: hash,
    path: rel,
  });
  const vf = path.join(dir, "video.json");
  if (existsSync(vf)) {
    const video = JSON.parse(readFileSync(vf, "utf8"));
    video.assets = (video.assets ?? []).filter((a) => a.id !== id);
    video.assets.push({
      id,
      path: rel,
      kind,
      source: "generated",
      licence: `Generated by ${opts.provider} (${usedModel}); provider terms apply`,
      aiGenerated: true,
      ...(opts.realistic ? { realistic: true } : {}),
    });
    writeFileSync(vf, JSON.stringify(video, null, 2) + "\n");
  }
  return {
    status: cached ? "cached" : "done",
    id,
    path: rel,
    costUsd: cached ? 0 : q.totalUsd,
    sha256: hash,
    model: usedModel,
  };
}

async function main() {
  let parsed;
  try {
    parsed = parseArgs(process.argv.slice(2), {
      booleans: ["realistic"],
      strings: [
        "provider",
        "prompt",
        "id",
        "seed",
        "ref",
        "seconds",
        "aspect",
        "budget",
        "approve",
      ],
    });
  } catch (e) {
    console.error(
      `${e.message}. There is no --yes: a paid run needs --approve <the quoted total>.`,
    );
    process.exit(2);
  }
  const { flags, positional } = parsed;
  const [kind, dir] = positional;
  if (!kind || !dir) {
    console.error(
      'Usage: node generate.mjs image|video <project-dir> --provider <id> --prompt "..." [--id x] [--seed 1] [--ref a.png] [--seconds 4] [--budget usd] [--approve total]',
    );
    process.exit(2);
  }
  const config = loadProviders(dir);
  try {
    const r = await generateOne({
      dir,
      kind,
      config,
      opts: {
        ...flags,
        provider: flags.provider ?? "test",
        ref: flags.ref ? flags.ref.split(",") : [],
      },
      ctx: { env: process.env, fetch: globalThis.fetch, run: (c, a) => runProgram(c, a) },
    });
    if (r.status === "needs-approval") {
      console.log(
        capLines(
          [
            `Quote: ${r.quote.units} ${r.quote.unit}(s) x $${r.quote.unitUsd} = $${r.approve} with ${r.provider}.`,
            `Nothing was sent or charged. To go ahead, the user must say yes to this exact total; then re-run with --approve ${r.approve} (plus --budget).`,
          ],
          "needs approval",
        ),
      );
      process.exit(3);
    }
    console.log(
      capLines(
        [
          `${r.status}: ${r.path} (${r.model}), cost $${r.costUsd}`,
          `sha256 ${r.sha256.slice(0, 16)}...`,
        ],
        "ok",
      ),
    );
  } catch (e) {
    console.error(e.message.replace(/[A-Za-z0-9_-]{30,}/g, "[redacted]"));
    process.exit(2);
  }
}
if (isEntry(import.meta.url)) await main();
