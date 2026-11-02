#!/usr/bin/env node
// Turns a unified diff (the output of `git diff`, saved to a file) and an optional changelog section into a draft
// "what changed" project: video.json, script.md and facts.md. Text only: it never runs git or anything from the
// repository. Every number (files, lines added and removed) is counted from the diff, never typed.
// Usage: node changes.mjs --diff change.diff --out projects/<slug> [--changelog CHANGELOG.md --release 1.2.0]
//        [--title "Release 1.2.0"] [--max-files 4] [--format short-9x16]
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { capLines, isEntry, parseArgs } from "./_lib.mjs";

const MAX_BYTES = 2 * 1024 * 1024;
const FORMATS = ["reel-9x16", "short-9x16", "youtube-16x9", "square-1x1"];
const LANG = {
  js: "js",
  mjs: "js",
  cjs: "js",
  jsx: "js",
  ts: "ts",
  tsx: "ts",
  json: "json",
  sh: "sh",
  py: "py",
};
const MAX_LINES = 20;
const MAX_WIDTH = 60;
const UNSAFE = new RegExp("[\\p{Cc}\\u200e\\u200f\\u202a-\\u202e\\u2066-\\u2069]", "gu");
const clean = (t, max) =>
  String(t ?? "")
    .replace(UNSAFE, " ")
    .trim()
    .slice(0, max);
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/** Parse a unified diff into files: { file, added, removed, hunks: [{ before: [], after: [] }] }. Pure. */
export function parseDiff(text) {
  const files = [];
  let cur = null;
  let hunk = null;
  for (const raw of String(text).replace(/\r\n?/g, "\n").split("\n")) {
    if (raw.startsWith("diff --git ")) {
      cur = null;
      hunk = null;
    } else if (raw.startsWith("+++ ")) {
      const name = raw.slice(4).replace(/^b\//, "");
      cur =
        name === "/dev/null" ? null : { file: clean(name, 200), added: 0, removed: 0, hunks: [] };
      if (cur) files.push(cur);
      hunk = null;
    } else if (raw.startsWith("--- ") && !cur) {
      // old-file header: the next "+++" names the file
    } else if (raw.startsWith("@@") && cur) {
      hunk = { before: [], after: [] };
      cur.hunks.push(hunk);
    } else if (hunk && cur) {
      if (raw.startsWith("+")) {
        cur.added++;
        hunk.after.push(raw.slice(1));
      } else if (raw.startsWith("-")) {
        cur.removed++;
        hunk.before.push(raw.slice(1));
      } else if (raw.startsWith(" ")) {
        hunk.before.push(raw.slice(1));
        hunk.after.push(raw.slice(1));
      }
    }
  }
  return files;
}

/** Bullets under the heading that mentions `release` (text only), at most `max`. */
export function changelogItems(text, release, max = 5) {
  const lines = String(text).replace(/\r\n?/g, "\n").split("\n");
  const start = lines.findIndex((l) => /^#{1,3}\s/.test(l) && l.includes(release));
  if (start < 0) throw new Error(`No heading mentioning "${release}" in the changelog.`);
  const items = [];
  for (const l of lines.slice(start + 1)) {
    if (/^#{1,3}\s/.test(l)) break;
    const m = /^\s*[-*]\s+(.*\S)/.exec(l);
    if (m) items.push(clean(m[1].replace(/[`*_]/g, ""), 70));
  }
  if (!items.length) throw new Error(`The "${release}" section has no bullet points.`);
  return items.slice(0, max);
}

/** First hunk of a file that fits the code scene's limits, or null. */
function fittingHunk(f) {
  return (
    f.hunks.find((h) =>
      [h.before, h.after].every(
        (ls) => ls.length > 0 && ls.length <= MAX_LINES && ls.every((l) => l.length <= MAX_WIDTH),
      ),
    ) ?? null
  );
}

/** The project files, as { video, script, facts, summary }. Pure. */
export function buildChanges(files, { title, items, maxFiles = 4, format = "short-9x16" }) {
  if (!files.length) throw new Error("The diff has no changed files.");
  const added = files.reduce((n, f) => n + f.added, 0);
  const removed = files.reduce((n, f) => n + f.removed, 0);
  const lines = [];
  const facts = [];
  const scenes = [];
  const fact = (text, source) => {
    facts.push({ id: `f${facts.length + 1}`, text, source });
    return `f${facts.length}`;
  };
  const line = (text, beat, factId) => {
    lines.push({ id: `l${lines.length + 1}`, text, beat, fact: factId });
    return `l${lines.length}`;
  };

  const totalFact = fact(
    `${plural(files.length, "file", "files")} changed, ${added} lines added and ${removed} removed.`,
    "the diff (counted)",
  );
  scenes.push({
    id: "s1",
    kind: "title",
    props: { text: title, subtitle: `${plural(files.length, "file", "files")} changed` },
    narration: [line(`Here is what changed in ${title}.`, "hook")],
  });
  scenes.push({
    id: "s2",
    kind: "list",
    props: {
      heading: "The size of it",
      items: [
        `${plural(files.length, "file", "files")} changed`,
        `${added} lines added`,
        `${removed} lines removed`,
      ],
    },
    narration: [
      line(
        `${plural(files.length, "file changed", "files changed")}: ${added} lines added, ${removed} removed.`,
        "step",
        totalFact,
      ),
    ],
  });
  if (items?.length)
    scenes.push({
      id: `s${scenes.length + 1}`,
      kind: "list",
      props: { heading: "From the changelog", items, numbered: false },
      narration: [
        line(
          `The changelog lists ${plural(items.length, "change", "changes")}.`,
          "step",
          fact(`The changelog lists these changes: ${items.join("; ")}.`, "CHANGELOG.md"),
        ),
      ],
    });

  const top = [...files].sort((a, b) => b.added + b.removed - (a.added + a.removed));
  const shown = [];
  const skipped = [];
  for (const f of top) {
    const ext = f.file.split(".").pop()?.toLowerCase() ?? "";
    const hunk = LANG[ext] ? fittingHunk(f) : null;
    if (shown.length < maxFiles && hunk) shown.push({ f, hunk, language: LANG[ext] });
    else skipped.push(f.file);
  }
  for (const { f, hunk, language } of shown) {
    const fid = fact(
      `${f.file} has ${f.added} lines added and ${f.removed} removed.`,
      `the diff: ${f.file}`,
    );
    scenes.push({
      id: `s${scenes.length + 1}`,
      kind: "code",
      props: {
        language,
        file: f.file.length > 44 ? `...${f.file.slice(-41)}` : f.file,
        diff: { before: hunk.before.join("\n"), after: hunk.after.join("\n") },
      },
      narration: [
        line(`In ${path.basename(f.file)}: ${f.added} added, ${f.removed} removed.`, "step", fid),
      ],
    });
  }
  scenes.push({
    id: `s${scenes.length + 1}`,
    kind: "title",
    props: { text: title, subtitle: "counted from the diff" },
    narration: [line("Every number here was counted from the diff.", "button")],
  });

  const video = {
    version: 1,
    meta: {
      title,
      type: "explainer",
      format,
      fps: 30,
      lang: "en",
      audience: "people who use or review this project",
    },
    script: "script.md",
    scenes,
  };
  const script = `# ${title}\n\n${lines.map((l) => `[${l.id}] ${l.text}\n  beat: ${l.beat}${l.fact ? `\n  fact: ${l.fact}` : ""}\n`).join("\n")}`;
  const factsMd = `# Facts\n\n${facts.map((f) => `- [${f.id}] ${f.text} Source: ${f.source}`).join("\n")}\n`;
  return {
    video,
    script,
    facts: factsMd,
    summary: { files: files.length, added, removed, code: shown.length, skipped },
  };
}

function main() {
  try {
    const { flags } = parseArgs(process.argv.slice(2), {
      strings: ["diff", "out", "changelog", "release", "title", "max-files", "format"],
    });
    if (!flags.diff || !flags.out)
      throw new Error("Give --diff change.diff and --out projects/<slug>");
    const read = (p) => {
      if (statSync(p).size > MAX_BYTES)
        throw new Error(`${p} is larger than 2 MB; refusing to read it.`);
      return readFileSync(p, "utf8");
    };
    const format = flags.format ?? "short-9x16";
    if (!FORMATS.includes(format)) throw new Error(`--format is one of ${FORMATS.join(", ")}.`);
    const maxFiles = Number(flags["max-files"] ?? 4);
    if (!Number.isInteger(maxFiles) || maxFiles < 1 || maxFiles > 8)
      throw new Error("--max-files is 1 to 8.");
    if (Boolean(flags.changelog) !== Boolean(flags.release))
      throw new Error("--changelog and --release go together.");
    const items = flags.changelog
      ? changelogItems(read(flags.changelog), flags.release)
      : undefined;
    const files = parseDiff(read(flags.diff));
    if (existsSync(path.join(flags.out, "video.json")))
      throw new Error(
        `${flags.out}/video.json exists; choose a new folder so nothing is overwritten.`,
      );
    const title = clean(
      flags.title ?? (flags.release ? `Release ${flags.release}` : "What changed"),
      60,
    );
    const r = buildChanges(files, { title, items, maxFiles, format });
    mkdirSync(flags.out, { recursive: true });
    writeFileSync(path.join(flags.out, "video.json"), `${JSON.stringify(r.video, null, 2)}\n`);
    writeFileSync(path.join(flags.out, "script.md"), r.script);
    writeFileSync(path.join(flags.out, "facts.md"), r.facts);
    const out = [
      `Wrote ${flags.out}: ${plural(r.summary.files, "file", "files")}, +${r.summary.added} -${r.summary.removed}, ${plural(r.summary.code, "code scene", "code scenes")}.`,
    ];
    if (r.summary.skipped.length)
      out.push(
        `Not shown as code (no fitting hunk or language): ${r.summary.skipped.slice(0, 5).join(", ")}${r.summary.skipped.length > 5 ? ", ..." : ""}`,
      );
    console.log(
      capLines(
        out,
        "Draft narration is mechanical: reword it with video-write, keep every fact id.",
      ),
    );
  } catch (e) {
    console.error(e.message);
    process.exit(2);
  }
}

if (isEntry(import.meta.url)) main();
