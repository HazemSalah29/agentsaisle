#!/usr/bin/env node
// Fetches one public dataset named in live.config.json (npm downloads, GitHub stars, or a CSV/JSON URL on a host
// you approved) and writes data/<id>.json with its sources and fetch time. This is the only script in this skill
// that uses the network: GET only, https only, no keys or tokens, no redirects, 15 s limit, 1 MB cap. Downloaded
// text is parsed as data and never run. The previous snapshot is kept as data/<id>-<date>.json so a later run can
// show the change since last time.
// Usage: node fetch.mjs --config live.config.json [--out data]
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { capLines, isEntry, parseArgs } from "./_lib.mjs";
import { fetchData } from "./sources.mjs";

const num = (v) => typeof v === "number" && Number.isFinite(v);

/** Adds `previous` from an older snapshot (same labels) where the source gave none. Pure. */
export function withPrevious(data, old) {
  if (!old || !Array.isArray(old.items) || !(old.asOf < data.asOf)) return data;
  const was = new Map(old.items.filter((i) => num(i?.value)).map((i) => [i.label, i.value]));
  return {
    ...data,
    items: data.items.map((i) =>
      num(i.previous) || !was.has(i.label) ? i : { ...i, previous: was.get(i.label) },
    ),
  };
}

async function main() {
  try {
    const { flags } = parseArgs(process.argv.slice(2), { strings: ["config", "out"] });
    if (!flags.config) throw new Error("Give --config live.config.json");
    const out = flags.out ?? "data";
    const config = JSON.parse(readFileSync(flags.config, "utf8"));
    let data = await fetchData(config);
    mkdirSync(out, { recursive: true });
    const file = path.join(out, `${data.id}.json`);
    if (existsSync(file)) {
      let old = null;
      try {
        old = JSON.parse(readFileSync(file, "utf8"));
      } catch {
        old = null;
      }
      if (old && /^\d{4}-\d{2}-\d{2}$/.test(old.asOf ?? "")) {
        data = withPrevious(data, old);
        if (old.asOf !== data.asOf) renameSync(file, path.join(out, `${data.id}-${old.asOf}.json`));
      }
    }
    writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
    const ledger = path.join(out, "ledger.jsonl");
    appendFileSync(
      ledger,
      `${JSON.stringify({ id: data.id, source: data.source, urls: data.urls, fetchedAt: data.fetchedAt, items: data.items.length })}\n`,
    );
    console.log(
      capLines(
        [
          `Fetched ${data.items.length} items from ${data.source} (as of ${data.asOf}).`,
          ...data.items.map(
            (i) =>
              `  ${i.label}: ${i.value}${i.previous !== undefined ? ` (was ${i.previous})` : ""}`,
          ),
        ],
        `Wrote ${file}. Next: node live.mjs build --config ${flags.config} --data ${file} --out projects/<slug>`,
      ),
    );
  } catch (e) {
    console.error(e.message);
    process.exit(2);
  }
}

if (isEntry(import.meta.url)) await main();
