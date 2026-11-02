// Prices, caps and the spend ledger for paid generation. Reads providers.yaml (a small flat subset of YAML:
// top-level scalars and a list of "- key: value" entries) and generation-log.jsonl. Nothing here uses the network.
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";

const scalar = (v) => {
  const t = v.replace(/\s+#.*$/, "").trim();
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
  if (t === "true" || t === "false") return t === "true";
  return t.replace(/^(["'])(.*)\1$/, "$2");
};

/** Parse providers.yaml: { monthlyCapUsd, providers: [{ id, kind, adapter, model, keyEnv, usdPerImage, usdPerSecond }] }. */
export function parseProviders(text) {
  const out = { monthlyCapUsd: 0, providers: [] };
  let cur = null;
  for (const raw of text.split(/\r?\n/)) {
    if (!raw.trim() || raw.trim().startsWith("#")) continue;
    const m = raw.match(/^(\s*)(- )?([A-Za-z][A-Za-z0-9]*):\s*(.*)$/);
    if (!m) continue;
    const [, indent, dash, key, rest] = m;
    if (key === "providers" && !indent && /^(\[\s*\])?\s*(#.*)?$/.test(rest)) continue;
    if (dash) {
      cur = {};
      out.providers.push(cur);
    }
    if (indent || dash) {
      if (cur) cur[key] = scalar(rest);
    } else out[key] = scalar(rest);
  }
  return out;
}

export function loadProviders(dir, exists = existsSync, read = readFileSync) {
  for (const f of [path.join(dir, "providers.yaml"), path.join(dir, "..", "providers.yaml")])
    if (exists(f)) return parseProviders(read(f, "utf8"));
  return { monthlyCapUsd: 0, providers: [] };
}

/** What a run would cost: units are images or seconds. The test provider is always free. */
export function quote({ entry, kind, count, seconds }) {
  if (!entry)
    return { unit: kind === "video" ? "second" : "image", units: 0, unitUsd: 0, totalUsd: 0 };
  const unit = kind === "video" ? "second" : "image";
  const unitUsd = Number(kind === "video" ? entry.usdPerSecond : entry.usdPerImage);
  if (!Number.isFinite(unitUsd) || unitUsd < 0)
    throw new Error(
      `providers.yaml: "${entry.id}" has no ${kind === "video" ? "usdPerSecond" : "usdPerImage"}. Look up the current price and fill it in; nothing is assumed.`,
    );
  const units = kind === "video" ? count * seconds : count;
  return { unit, units, unitUsd, totalUsd: Math.round(units * unitUsd * 10000) / 10000 };
}

export const readLedger = (file, exists = existsSync, read = readFileSync) =>
  exists(file)
    ? read(file, "utf8")
        .split("\n")
        .filter(Boolean)
        .map((l) => {
          try {
            return JSON.parse(l);
          } catch {
            return null;
          }
        })
        .filter(Boolean)
    : [];

export const appendLedger = (file, row) => appendFileSync(file, JSON.stringify(row) + "\n");

const sum = (rows) => Math.round(rows.reduce((s, r) => s + (r.costUsd || 0), 0) * 10000) / 10000;
export const spentTotal = (rows) => sum(rows);
export const spentThisMonth = (rows, now = new Date()) =>
  sum(rows.filter((r) => String(r.at).slice(0, 7) === now.toISOString().slice(0, 7)));

/** Why a paid run may not go ahead, or null. `budgetUsd` is the project's cap from the video.json/CLI (0 = $0 tier). */
export function overCap({ totalUsd, monthlyCapUsd, budgetUsd, ledger, now }) {
  if (totalUsd === 0) return null;
  if (!(budgetUsd > 0))
    return "Refused: the project budget is $0, so paid generation is off. Pass --budget <usd> to allow it.";
  if (!(monthlyCapUsd > 0))
    return "Refused: monthlyCapUsd in providers.yaml is 0, so paid generation is off. Edit it to allow spend.";
  if (spentTotal(ledger) + totalUsd > budgetUsd)
    return `Refused: $${totalUsd} would take this project to $${(spentTotal(ledger) + totalUsd).toFixed(4)}, over its $${budgetUsd} budget.`;
  if (spentThisMonth(ledger, now) + totalUsd > monthlyCapUsd)
    return `Refused: $${totalUsd} would pass the monthly cap of $${monthlyCapUsd} (already $${spentThisMonth(ledger, now)} this month).`;
  return null;
}

/** The exact text the user must pass to --approve: the total in dollars with 4 decimals. */
export const approvalText = (totalUsd) => totalUsd.toFixed(4);
