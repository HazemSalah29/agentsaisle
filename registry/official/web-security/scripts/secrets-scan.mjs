#!/usr/bin/env node
// Looks for committed secrets in lines you have added (git diff plus new files).
// Matches are MASKED in the output, so a secret never reaches a log or the agent's context.
// Reads files and runs `git diff`; it makes no network calls.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const MAX_LINES = 40;
const MAX_FILE_BYTES = 1024 * 1024;

/** Order matters: the first pattern that matches a line wins, so specific keys come before generic ones. */
export const PATTERNS = [
  { name: "anthropic-api-key", re: /\bsk-ant-[A-Za-z0-9_-]{20,}/ },
  { name: "openai-api-key", re: /\bsk-(?:proj-)?[A-Za-z0-9_-]{32,}/ },
  { name: "aws-access-key-id", re: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/ },
  { name: "github-token", re: /\bgh[pousr]_[A-Za-z0-9]{36,}/ },
  { name: "github-fine-grained-token", re: /\bgithub_pat_[A-Za-z0-9_]{50,}/ },
  { name: "stripe-live-key", re: /\b[sr]k_live_[A-Za-z0-9]{20,}/ },
  { name: "slack-token", re: /\bxox[abprs]-[A-Za-z0-9-]{10,}/ },
  { name: "google-api-key", re: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  {
    name: "private-key-block",
    re: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY(?: BLOCK)?-----/,
  },
  { name: "jwt", re: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/ },
  {
    name: "public-env-secret",
    re: /\bNEXT_PUBLIC_[A-Z0-9_]*(?:SECRET|PRIVATE|PASSWORD|TOKEN)[A-Z0-9_]*\s*=\s*\S+/,
  },
  {
    name: "hardcoded-credential",
    re: /\b(?:api[_-]?key|secret|token|passw(?:or)?d|private[_-]?key)\b["']?\s*[:=]\s*["'`]([^"'`\s]{12,})["'`]/i,
    valueGroup: 1,
  },
];

const PLACEHOLDER =
  /(your[-_ ]|example|changeme|placeholder|xxxx|<[^>]+>|\$\{|process\.env|import\.meta\.env|\*{4,}|dummy|sample|test[-_]?key)/i;

const DEFAULT_IGNORE = [
  "pnpm-lock.yaml",
  "package-lock.json",
  "yarn.lock",
  "bun.lock",
  "**/*.min.js",
  "**/*.map",
];

/** Hide most of a secret: first 4 and last 2 characters, never the whole value. */
export function mask(value) {
  if (value.length <= 10) return "*".repeat(Math.max(4, value.length));
  return `${value.slice(0, 4)}${"*".repeat(Math.min(10, value.length - 6))}${value.slice(-2)}`;
}

/** "src/**\/*.ts" style globs: ** crosses folders, * does not. */
export function globToRegExp(glob) {
  let out = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*") {
      if (glob[i + 1] === "*") {
        out += glob[i + 2] === "/" ? "(?:.*/)?" : ".*";
        i += glob[i + 2] === "/" ? 2 : 1;
      } else out += "[^/]*";
    } else out += c.replace(/[.+^${}()|[\]\\?]/g, "\\$&");
  }
  return new RegExp(`^${out}$`);
}

export function isIgnored(file, globs) {
  const normal = file.split(path.sep).join("/");
  return globs.some(
    (g) => globToRegExp(g).test(normal) || globToRegExp(g).test(path.posix.basename(normal)),
  );
}

/** Findings for one line of text. A line holding `aisle-ignore` is skipped. */
export function scanLine(text) {
  if (text.includes("aisle-ignore")) return null;
  for (const { name, re, valueGroup } of PATTERNS) {
    const m = re.exec(text);
    if (!m) continue;
    const value = valueGroup ? m[valueGroup] : m[0];
    if (valueGroup && PLACEHOLDER.test(value)) continue;
    if (name === "public-env-secret" && PLACEHOLDER.test(m[0])) continue;
    return { pattern: name, masked: mask(value) };
  }
  return null;
}

/** Added lines of a unified diff (`git diff --unified=0`) with their file and new line number. */
export function parseDiff(diff) {
  const added = [];
  let file = null;
  let line = 0;
  for (const raw of diff.split("\n")) {
    if (raw.startsWith("+++ ")) {
      file = raw.startsWith("+++ b/") ? raw.slice(6) : null;
    } else if (raw.startsWith("@@")) {
      const m = /\+(\d+)/.exec(raw);
      line = m ? Number(m[1]) : 0;
    } else if (raw.startsWith("+") && !raw.startsWith("+++") && file) {
      added.push({ file, line, text: raw.slice(1) });
      line++;
    }
  }
  return added;
}

/** Scan added lines, skipping ignored files. */
export function scanAdded(added, ignoreGlobs = []) {
  const globs = [...DEFAULT_IGNORE, ...ignoreGlobs];
  const findings = [];
  for (const a of added) {
    if (isIgnored(a.file, globs)) continue;
    const hit = scanLine(a.text);
    if (hit) findings.push({ file: a.file, line: a.line, ...hit });
  }
  return findings;
}

export function parseIgnoreFile(text) {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
}

export function report(findings, maxLines = MAX_LINES) {
  if (findings.length === 0) return "secrets-scan: no secrets found in added lines.";
  const lines = [
    `secrets-scan: ${findings.length} possible secret${findings.length === 1 ? "" : "s"} (values masked)`,
  ];
  for (const f of findings) lines.push(`  ${f.file}:${f.line}  ${f.pattern}  ${f.masked}`);
  lines.push(
    "Remove each one, rotate it if it was ever committed, and load it from the environment instead.",
  );
  if (lines.length > maxLines) {
    const keep = lines.slice(0, maxLines - 2);
    return [...keep, `  ... ${lines.length - keep.length - 1} more`, lines[lines.length - 1]].join(
      "\n",
    );
  }
  return lines.join("\n");
}

function git(args, cwd) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["ignore", "pipe", "ignore"],
  });
}

/** Lines of files git does not track yet, treated as fully added. */
function untrackedAdded(cwd) {
  const out = git(["ls-files", "--others", "--exclude-standard"], cwd);
  const added = [];
  for (const file of out.split("\n").filter(Boolean)) {
    const full = path.join(cwd, file);
    try {
      if (!existsSync(full) || statSync(full).size > MAX_FILE_BYTES) continue;
      const text = readFileSync(full, "utf8");
      if (text.includes("\u0000")) continue;
      text.split(/\r?\n/).forEach((t, i) => added.push({ file, line: i + 1, text: t }));
    } catch {
      // unreadable: skip
    }
  }
  return added;
}

function main(argv) {
  const cwd = path.resolve(
    argv.includes("--cwd") ? argv[argv.indexOf("--cwd") + 1] : process.cwd(),
  );
  let added;
  try {
    const base = argv.includes("--staged") ? ["diff", "--cached"] : ["diff", "HEAD"];
    added = [
      ...parseDiff(git([...base, "--unified=0", "--no-color"], cwd)),
      ...(argv.includes("--staged") ? [] : untrackedAdded(cwd)),
    ];
  } catch {
    console.log(
      "secrets-scan: this is not a git repository with at least one commit, so there is no diff to scan.",
    );
    process.exit(1);
  }
  const ignoreFile = path.join(cwd, ".secretsignore");
  const ignore = existsSync(ignoreFile) ? parseIgnoreFile(readFileSync(ignoreFile, "utf8")) : [];
  const findings = scanAdded(added, ignore);
  console.log(report(findings));
  process.exit(findings.length ? 1 : 0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href)
  main(process.argv.slice(2));
