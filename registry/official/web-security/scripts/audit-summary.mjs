#!/usr/bin/env node
// Reads `npm audit --json` (or `pnpm audit --json`) on standard input and prints only high and
// critical findings. It runs nothing and makes no network calls; the agent runs the audit itself:
//   npm audit --omit=dev --json | node audit-summary.mjs
import path from "node:path";
import { pathToFileURL } from "node:url";

const MAX_LINES = 20;
const RANK = { critical: 2, high: 1 };

/** Normalize npm's v2 shape ({vulnerabilities}) and the older shape ({advisories}) into one list. */
export function parseAudit(json) {
  const found = [];
  if (json && typeof json.vulnerabilities === "object" && json.vulnerabilities) {
    for (const [name, v] of Object.entries(json.vulnerabilities)) {
      const via = Array.isArray(v.via)
        ? v.via
            .filter((x) => typeof x === "object")
            .map((x) => x.title)
            .filter(Boolean)
        : [];
      const fixAvailable = v.fixAvailable;
      const fix =
        fixAvailable && typeof fixAvailable === "object"
          ? `upgrade ${fixAvailable.name} to ${fixAvailable.version}${fixAvailable.isSemVerMajor ? " (major)" : ""}`
          : fixAvailable === true
            ? "npm audit fix"
            : "no fix available";
      found.push({
        name: v.name ?? name,
        severity: v.severity,
        range: v.range ?? "",
        direct: v.isDirect === true,
        title: via[0] ?? "",
        fix,
      });
    }
  } else if (json && typeof json.advisories === "object" && json.advisories) {
    for (const a of Object.values(json.advisories)) {
      found.push({
        name: a.module_name,
        severity: a.severity,
        range: a.vulnerable_versions ?? "",
        direct: false,
        title: a.title ?? "",
        fix:
          a.patched_versions && a.patched_versions !== "<0.0.0"
            ? `upgrade to ${a.patched_versions}`
            : "no fix available",
      });
    }
  } else {
    return null;
  }
  return found;
}

/** Only high and critical, worst first. */
export function onlySerious(list) {
  return list
    .filter((v) => v.severity in RANK)
    .sort((a, b) => RANK[b.severity] - RANK[a.severity] || a.name.localeCompare(b.name));
}

export function format(serious, maxLines = MAX_LINES) {
  if (serious.length === 0)
    return "audit: no high or critical vulnerabilities in production dependencies.";
  const critical = serious.filter((v) => v.severity === "critical").length;
  const high = serious.length - critical;
  const lines = [`audit: ${critical} critical, ${high} high`];
  for (const v of serious) {
    lines.push(
      `  ${v.severity} ${v.name}${v.range ? ` ${v.range}` : ""}${v.direct ? " (direct)" : ""}${v.title ? `: ${v.title}` : ""}`,
    );
    lines.push(`    fix: ${v.fix}`);
  }
  if (lines.length > maxLines)
    return [
      ...lines.slice(0, maxLines - 1),
      `  ... ${Math.ceil((lines.length - maxLines + 1) / 2)} more`,
    ].join("\n");
  return lines.join("\n");
}

async function readStdin() {
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  return Buffer.concat(chunks).toString("utf8");
}

async function main() {
  const text = await readStdin();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    console.log(
      "audit: could not read the audit output. Pipe the JSON from `npm audit --omit=dev --json`.",
    );
    process.exit(2);
  }
  const list = parseAudit(json);
  if (!list) {
    console.log("audit: unrecognized audit JSON (expected npm or pnpm audit output).");
    process.exit(2);
  }
  const serious = onlySerious(list);
  console.log(format(serious));
  process.exit(serious.length ? 1 : 0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href)
  await main();
