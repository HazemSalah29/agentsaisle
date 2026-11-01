#!/usr/bin/env node
// Checks the writer's files for a project: brief.json, script.md, facts.md (explain), storyboard.md, hooks.md.
// Read-only. Errors fail the run (exit 1); warnings are printed but do not.
// Usage: node write-check.mjs <project-dir> [--json]
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { validate } from "./schema-check.mjs";
import {
  parseFacts,
  parseHooks,
  parseScript,
  parseStoryboard,
  speechSeconds,
} from "./script-parse.mjs";
import { capLines, isEntry, parseArgs, skillDir } from "./_lib.mjs";

export const BEATS = {
  explain: ["hook", "misconception", "analogy", "step", "edge", "takeaway", "cta"],
  story: ["hook", "setup", "turn", "climax", "button", "cta"],
};
/** The order the required beats must come in (cta may come after the last of them). */
const ORDER = {
  explain: ["hook", "misconception", "analogy", "step", "edge", "takeaway"],
  story: ["hook", "setup", "turn", "climax", "button"],
};
export const BUILT_KINDS = [
  "title",
  "quote",
  "list",
  "chart",
  "broll",
  "rate-limit",
  "code",
  "sequence",
  "request-flow",
];
const WEAK_HOOKS = [
  "you won't believe",
  "you wont believe",
  "storytime",
  "story time",
  "in this video we will",
  "today we're going to",
  "like and subscribe",
  "smash that",
];
const DIGITS = /[0-9٠-٩۰-۹]/;
// A number with a unit or percent sign reads as a statistic: it needs a source.
const STAT =
  /\d[\d.,]*\s?(%|x\b|ms\b|s\b|sec\b|seconds?\b|gb\b|mb\b|kb\b|k\b|m\b|million|billion|times)/i;

export const loadBriefSchema = () =>
  JSON.parse(readFileSync(path.join(skillDir(), "assets", "brief.schema.json"), "utf8"));

/**
 * Check a project from its file texts. `files` is { brief, script, facts, storyboard, hooks } (strings or
 * undefined). Returns [{ level: "error"|"warn", file, line, message }].
 */
export function checkWriting(files, schema = loadBriefSchema()) {
  const out = [];
  const add = (level, file, line, message) => out.push({ level, file, line, message });

  let brief;
  if (files.brief === undefined) add("error", "brief.json", 0, "missing");
  else {
    try {
      brief = JSON.parse(files.brief);
      for (const p of validate(schema, brief)) add("error", "brief.json", 0, p);
    } catch (e) {
      add("error", "brief.json", 0, `not valid JSON: ${e.message}`);
      brief = undefined;
    }
  }
  const mode = brief?.mode in BEATS ? brief.mode : "explain";
  const lang = typeof brief?.lang === "string" ? brief.lang : "en";

  if (files.script === undefined) {
    add("error", "script.md", 0, "missing");
    return out;
  }
  const { lines, problems } = parseScript(files.script);
  for (const p of problems) add("error", "script.md", p.line, p.message);
  if (!lines.length) add("error", "script.md", 0, "has no narration lines");

  const facts = files.facts === undefined ? [] : parseFacts(files.facts);
  const factById = new Map(facts.map((f) => [f.id, f]));
  if (mode === "explain" && files.facts === undefined)
    add("error", "facts.md", 0, "missing (explain mode needs a source for each technical claim)");
  for (const f of facts)
    if (!f.source) add("error", "facts.md", f.line, `fact "${f.id}" has no "Source:"`);

  // beats
  const beats = lines.map((l) => l.attrs.beat);
  lines.forEach((l, i) => {
    if (l.attrs.beat && !BEATS[mode].includes(l.attrs.beat))
      add(
        "error",
        "script.md",
        l.line,
        `beat "${l.attrs.beat}" is not a ${mode} beat (${BEATS[mode].join(", ")})`,
      );
    if (!l.attrs.beat) add("error", "script.md", l.line, `line "${l.id}" has no "beat:"`);
    if (i === 0 && l.attrs.beat !== "hook")
      add("error", "script.md", l.line, "the first line must be the hook (beat: hook)");
  });
  const firstAt = (b) => beats.indexOf(b);
  let lastAt = -1;
  for (const b of ORDER[mode]) {
    const at = firstAt(b);
    if (at === -1)
      add(
        "error",
        "script.md",
        0,
        `no "${b}" beat (${mode} mode needs ${ORDER[mode].join(" > ")})`,
      );
    else if (at < lastAt)
      add("error", "script.md", lines[at].line, `"${b}" comes before the beat it should follow`);
    else lastAt = b === "step" ? beats.lastIndexOf("step") : at;
  }
  const cta = beats.indexOf("cta");
  const payoff = mode === "explain" ? beats.lastIndexOf("takeaway") : beats.lastIndexOf("button");
  if (cta !== -1 && payoff !== -1 && cta < payoff)
    add("error", "script.md", lines[cta].line, "the call to action must come after the payoff");

  // claims, statistics, markers
  for (const l of lines) {
    if (/\[needs-source\]/i.test(l.text))
      add(
        "error",
        "script.md",
        l.line,
        "contains [needs-source]: find a source or remove the claim",
      );
    const fid = l.attrs.fact;
    if (fid && !factById.has(fid))
      add("error", "script.md", l.line, `fact "${fid}" is not in facts.md`);
    const needsFact =
      mode === "explain" &&
      (l.attrs.beat === "step" || l.attrs.beat === "edge" || STAT.test(l.text));
    if (needsFact && !fid)
      add(
        "error",
        "script.md",
        l.line,
        `line "${l.id}" makes a technical claim or states a number: add "fact: <id>" with a source`,
      );
    if (lang.startsWith("ar") && DIGITS.test(l.text))
      add(
        "error",
        "script.md",
        l.line,
        `line "${l.id}" has digits: write numbers as words for the voice`,
      );
    if (l.attrs.beat === "hook" || l.attrs.beat === "cta") {
      const low = l.text.toLowerCase();
      for (const w of WEAK_HOOKS)
        if (low.includes(w))
          add(
            "warn",
            "script.md",
            l.line,
            `"${w}" is a weak opener: lead with the payoff, a surprise or a counter-take`,
          );
    }
    const sec = speechSeconds(l.text, lang);
    if (sec > 6)
      add(
        "warn",
        "script.md",
        l.line,
        `line "${l.id}" takes about ${sec.toFixed(1)} s to say: split it so something new appears every few seconds`,
      );
  }
  if (lines[0] && speechSeconds(lines[0].text, lang) > 4)
    add(
      "warn",
      "script.md",
      lines[0].line,
      "the hook takes more than 4 s to say: shorten it so the payoff lands in the first 3 s",
    );

  const total = lines.reduce((s, l) => s + speechSeconds(l.text, lang), 0);
  if (
    brief?.lengthSeconds &&
    (total < brief.lengthSeconds * 0.6 || total > brief.lengthSeconds * 1.25)
  )
    add(
      "warn",
      "script.md",
      0,
      `about ${Math.round(total)} s of speech against a ${brief.lengthSeconds} s brief`,
    );

  // hooks
  if (files.hooks === undefined) add("error", "hooks.md", 0, "missing (5 alternative openings)");
  else if (parseHooks(files.hooks).length < 5)
    add(
      "error",
      "hooks.md",
      0,
      `has ${parseHooks(files.hooks).length} options; the brief asks for 5`,
    );

  // storyboard
  if (files.storyboard !== undefined) {
    const sb = parseStoryboard(files.storyboard);
    for (const p of sb.problems) add("error", "storyboard.md", p.line, p.message);
    const ids = new Set(lines.map((l) => l.id));
    const used = new Set();
    for (const r of sb.rows) {
      if (!BUILT_KINDS.includes(r.kind))
        add(
          "error",
          "storyboard.md",
          r.line,
          `scene "${r.scene}": kind "${r.kind}" is not built yet (${BUILT_KINDS.join(", ")})`,
        );
      for (const id of (r.narration ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)) {
        if (!ids.has(id))
          add(
            "error",
            "storyboard.md",
            r.line,
            `scene "${r.scene}": narration line "${id}" is not in script.md`,
          );
        used.add(id);
      }
    }
    for (const l of lines)
      if (!used.has(l.id))
        add("error", "storyboard.md", 0, `script line "${l.id}" is not used by any scene`);
  } else
    add(
      "warn",
      "storyboard.md",
      0,
      "missing (the user approves the storyboard before assets and voice)",
    );
  return out;
}

const read = (dir, f) =>
  existsSync(path.join(dir, f)) ? readFileSync(path.join(dir, f), "utf8") : undefined;

/** Read a project folder's writer files. */
export const readFiles = (dir) => ({
  brief: read(dir, "brief.json"),
  script: read(dir, "script.md"),
  facts: read(dir, "facts.md"),
  storyboard: read(dir, "storyboard.md"),
  hooks: read(dir, "hooks.md"),
});

function main() {
  let parsed;
  try {
    parsed = parseArgs(process.argv.slice(2), { booleans: ["json"] });
  } catch (e) {
    console.error(e.message);
    process.exit(2);
  }
  if (!parsed.positional[0]) {
    console.error("Usage: node write-check.mjs <project-dir> [--json]");
    process.exit(2);
  }
  const dir = path.resolve(parsed.positional[0]);
  if (!existsSync(dir)) {
    console.error(`No such folder: ${dir}`);
    process.exit(2);
  }
  const found = checkWriting(readFiles(dir));
  const errors = found.filter((f) => f.level === "error").length;
  const warns = found.length - errors;
  if (parsed.flags.json)
    console.log(JSON.stringify({ ok: errors === 0, findings: found }).slice(0, 8000));
  else
    console.log(
      capLines(
        found.map(
          (f) =>
            `${f.level === "error" ? "ERROR" : "warn "} ${f.file}${f.line ? `:${f.line}` : ""}  ${f.message}`,
        ),
        errors ? `${errors} error(s), ${warns} warning(s).` : `OK: ${warns} warning(s).`,
      ),
    );
  process.exit(errors ? 1 : 0);
}

if (isEntry(import.meta.url)) main();
