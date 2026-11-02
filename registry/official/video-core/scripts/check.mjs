#!/usr/bin/env node
// Checks a video.json before anything is rendered: schema, per-kind props, narration, assets and licences,
// and credentials. Read-only; never runs anything from the project.
// Usage: node check.mjs <project-dir | path/to/video.json> [--json]
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { codeProblems } from "../assets/engine/hyperframes/code.mjs";
import { screenProblems } from "../assets/engine/hyperframes/screen.mjs";
import { sequenceProblems } from "../assets/engine/hyperframes/sequence.mjs";
import { calligraphyProblems } from "../assets/engine/hyperframes/calligraphy.mjs";
import { DIAGRAM_KINDS, diagramProblems } from "../assets/engine/hyperframes/diagrams.mjs";
import { kineticProblems } from "../assets/engine/hyperframes/kinetic.mjs";
import { shotProblems } from "../assets/engine/hyperframes/shot.mjs";
import { timelineProblems } from "../assets/engine/hyperframes/timeline.mjs";
import { flowProblems } from "../assets/engine/hyperframes/request-flow.mjs";
import { MAX_DRAWN } from "../assets/engine/hyperframes/rate-limit.mjs";
import { specProblems } from "../assets/sim/rate-limit.mjs";
import { validate } from "./schema-check.mjs";
import { capLines, isEntry, isInside, parseArgs, skillDir } from "./_lib.mjs";

const SECRET_RES = [
  /sk-(?:ant-)?[A-Za-z0-9_-]{20,}/,
  /gh[pousr]_[A-Za-z0-9]{30,}/,
  /github_pat_[A-Za-z0-9_]{40,}/,
  /AKIA[0-9A-Z]{16}/,
  /xox[abprs]-[A-Za-z0-9-]{10,}/,
  /AIza[0-9A-Za-z_-]{35}/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /[a-z][a-z0-9+.-]*:\/\/[^\s/:@]+:[^\s/@]{3,}@/i,
];

export const loadSchema = () =>
  JSON.parse(readFileSync(path.join(skillDir(), "assets", "video.schema.json"), "utf8"));

function* strings(value, at = "$") {
  if (typeof value === "string") yield [at, value];
  else if (Array.isArray(value))
    for (let i = 0; i < value.length; i++) yield* strings(value[i], `${at}[${i}]`);
  else if (value && typeof value === "object")
    for (const [k, v] of Object.entries(value)) yield* strings(v, `${at}.${k}`);
}

/** Line ids defined in script.md: lines that start with "[id]". */
export const scriptLineIds = (text) =>
  new Set([...text.matchAll(/^\s*(?:[-*]\s*)?\[([a-z0-9-]{1,32})\]/gm)].map((m) => m[1]));

/**
 * Check a parsed video.json. `dir` is the project folder that relative paths resolve against.
 * Returns an array of problem strings (empty when the project is ready to render).
 */
export function checkProject(video, dir, schema = loadSchema()) {
  const problems = validate(schema, video);
  if (!video || typeof video !== "object" || !Array.isArray(video.scenes)) return problems;

  const exists = (rel) => isInside(rel) && existsSync(path.join(dir, rel));
  const assets = Array.isArray(video.assets) ? video.assets : [];
  const assetIds = new Map();
  assets.forEach((a, i) => {
    const at = `$.assets[${i}]`;
    if (!a || typeof a !== "object") return;
    if (assetIds.has(a.id)) problems.push(`${at}.id: "${a.id}" is used twice`);
    assetIds.set(a.id, a);
    if (typeof a.path === "string") {
      if (!isInside(a.path))
        problems.push(`${at}.path: must be a relative path inside the project`);
      else if (!exists(a.path)) problems.push(`${at}.path: file "${a.path}" is missing`);
    }
    if (!a.licence || !String(a.licence).trim())
      problems.push(`${at}.licence: asset "${a.id}" has no licence`);
    if (a.aiGenerated !== undefined && typeof a.aiGenerated !== "boolean")
      problems.push(`${at}.aiGenerated: must be true or false`);
  });

  if (video.music?.asset && typeof video.music.asset === "string") {
    const byPath = assets.some((a) => a?.path === video.music.asset);
    if (!exists(video.music.asset))
      problems.push(`$.music.asset: file "${video.music.asset}" is missing`);
    else if (!byPath)
      problems.push(`$.music.asset: "${video.music.asset}" is not listed in assets (no licence)`);
  }

  let lineIds = null;
  if (typeof video.script === "string") {
    if (!exists(video.script)) problems.push(`$.script: file "${video.script}" is missing`);
    else lineIds = scriptLineIds(readFileSync(path.join(dir, video.script), "utf8"));
  }

  const seen = new Set();
  video.scenes.forEach((s, i) => {
    const at = `$.scenes[${i}]`;
    if (!s || typeof s !== "object") return;
    if (seen.has(s.id)) problems.push(`${at}.id: "${s.id}" is used twice`);
    seen.add(s.id);
    const from = s.durationFrom ?? "voice";
    if (from === "fixed" && !(s.seconds > 0))
      problems.push(`${at}.seconds: a fixed scene needs seconds`);
    if (from === "voice" && !(s.narration?.length > 0))
      problems.push(
        `${at}.narration: scene "${s.id}" takes its length from the voice but has no narration`,
      );
    if (lineIds)
      for (const id of s.narration ?? [])
        if (!lineIds.has(id))
          problems.push(`${at}.narration: line "${id}" is not in ${video.script}`);
    const propSchema = schema.definitions?.props?.[s.kind];
    if (propSchema) problems.push(...validate(propSchema, s.props ?? {}, schema, `${at}.props`));
    if (s.kind === "rate-limit") problems.push(...rateLimitProblems(s.props ?? {}, `${at}.props`));
    if (s.kind === "request-flow")
      problems.push(...flowProblems(s.props ?? {}).map((p) => `${at}.props.${p}`));
    if (s.kind === "sequence")
      problems.push(...sequenceProblems(s.props ?? {}).map((p) => `${at}.props.${p}`));
    if (s.kind === "calligraphy")
      problems.push(...calligraphyProblems(s.props ?? {}).map((p) => `${at}.props.${p}`));
    if (s.kind === "timeline")
      problems.push(...timelineProblems(s.props ?? {}).map((p) => `${at}.props.${p}`));
    if (DIAGRAM_KINDS.includes(s.kind))
      problems.push(...diagramProblems(s.kind, s.props ?? {}).map((p) => `${at}.props.${p}`));
    if (s.kind === "kinetic")
      problems.push(...kineticProblems(s.props ?? {}).map((p) => `${at}.props.${p}`));
    if (s.kind === "shot") {
      problems.push(...shotProblems(s.props ?? {}).map((p) => `${at}.props.${p}`));
      for (const l of s.props?.layers ?? [])
        if (l?.asset && !assetIds.has(l.asset))
          problems.push(`${at}.props.layers: asset "${l.asset}" is not listed in assets`);
    }
    if (s.kind === "code")
      problems.push(
        ...codeProblems(s.props ?? {}, s.narration?.length ?? 0).map((p) => `${at}.props.${p}`),
      );
    if (s.kind === "broll" && s.props?.asset && !assetIds.has(s.props.asset))
      problems.push(`${at}.props.asset: "${s.props.asset}" is not listed in assets`);
    if (s.kind === "screen") {
      problems.push(...screenProblems(s.props ?? {}).map((p) => `${at}.props.${p}`));
      for (const key of ["asset", "pip"])
        if (s.props?.[key] && !assetIds.has(s.props[key]))
          problems.push(`${at}.props.${key}: "${s.props[key]}" is not listed in assets`);
    }
  });

  // Footage downloaded as a reference (video-ingest --analysis-only) may be measured, never shown.
  const analysisOnly = (id) => assetIds.get(id)?.analysisOnly === true;
  video.scenes.forEach((s, i) => {
    for (const key of ["asset", "pip"])
      if (analysisOnly(s?.props?.[key]))
        problems.push(
          `$.scenes[${i}].props.${key}: "${s.props[key]}" is marked analysisOnly and cannot appear in a video`,
        );
  });
  if (assets.some((a) => a?.analysisOnly === true && a.path === video.music?.asset))
    problems.push("$.music.asset: this file is marked analysisOnly and cannot be used");

  for (const [at, text] of strings(video))
    if (SECRET_RES.some((re) => re.test(text)))
      problems.push(`${at}: looks like a credential; remove it`);
  return problems;
}

/** The rate-limit scene is drawn from the simulator, so its props must be a spec and never a typed-in result. */
function rateLimitProblems(props, at) {
  const out = specProblems(props).map((p) => `${at}.${p}`);
  for (const k of ["log", "events", "results", "allowed", "rejected"])
    if (k in props)
      out.push(
        `${at}.${k}: results are computed from the seed; remove it (the animation is the simulation)`,
      );
  if (Number.isInteger(props.count) && props.count > MAX_DRAWN)
    out.push(`${at}.count: a scene draws at most ${MAX_DRAWN} requests (each is a dot); use fewer`);
  return out;
}

/** Resolve the argument to { file, dir }. */
export function locate(arg) {
  const p = path.resolve(arg);
  const file = existsSync(p) && statSync(p).isDirectory() ? path.join(p, "video.json") : p;
  return { file, dir: path.dirname(file) };
}

function main() {
  let parsed;
  try {
    parsed = parseArgs(process.argv.slice(2), { booleans: ["json"] });
  } catch (e) {
    console.error(e.message);
    process.exit(2);
  }
  const target = parsed.positional[0];
  if (!target) {
    console.error("Usage: node check.mjs <project-dir | video.json> [--json]");
    process.exit(2);
  }
  const { file, dir } = locate(target);
  let video;
  try {
    video = JSON.parse(readFileSync(file, "utf8"));
  } catch (e) {
    console.error(`Cannot read ${file}: ${e.message}`);
    process.exit(2);
  }
  const problems = checkProject(video, dir);
  if (parsed.flags.json)
    console.log(
      JSON.stringify({ ok: problems.length === 0, problems }, null, 2)
        .split("\n")
        .slice(0, 40)
        .join("\n"),
    );
  else
    console.log(
      capLines(
        problems,
        problems.length
          ? `${problems.length} problem(s) in ${path.basename(file)}.`
          : `OK: ${path.basename(file)} is ready to render.`,
      ),
    );
  process.exit(problems.length ? 1 : 0);
}

if (isEntry(import.meta.url)) main();
