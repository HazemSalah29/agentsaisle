#!/usr/bin/env node
// Checks shots.json (the shot list for a story) against script.md and style-bible.md, prints a plan, and with
// --build writes one scene per shot into video.json. Read-only except --build. No network, no process.
// Usage: node shots.mjs <project-dir> [--plan] [--build [--force]]
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseScript } from "./_script-parse.mjs";
import { ipRefusal } from "./ip-guard.mjs";
import { capLines, isEntry, parseArgs } from "./_lib.mjs";

export const GENERATORS = ["stills-only", "veo", "kling", "ltx", "wan"];
export const MIN_SECONDS = 3;
export const MAX_SECONDS = 8;
const ID = /^[a-z][a-z0-9-]{0,31}$/;

/** Problems in a parsed shots.json. `scriptIds` are the line ids of script.md, `bible` its style-bible.md text. */
export function shotProblems(doc, { scriptIds, bible, assetIds = null }) {
  const out = [];
  if (!doc || typeof doc !== "object" || !Array.isArray(doc.shots) || !doc.shots.length)
    return ['shots.json: needs a non-empty "shots" array'];
  if (!GENERATORS.includes(doc.generator))
    out.push(`generator: "${doc.generator}" is not one of ${GENERATORS.join(", ")}`);
  const stills = doc.generator === "stills-only";
  const seen = new Set();
  const used = [];
  const bibleText = (bible ?? "").toLowerCase();
  doc.shots.forEach((s, i) => {
    const at = `shots[${i}]${s?.id ? ` "${s.id}"` : ""}`;
    if (!s || typeof s !== "object") return out.push(`${at}: must be an object`);
    if (!ID.test(s.id ?? "")) out.push(`${at}.id: lowercase letters, digits and dashes`);
    else if (seen.has(s.id)) out.push(`${at}.id: used twice`);
    seen.add(s.id);
    if (!(s.seconds >= MIN_SECONDS && s.seconds <= MAX_SECONDS))
      out.push(`${at}.seconds: ${s.seconds} is outside ${MIN_SECONDS} to ${MAX_SECONDS}`);
    for (const k of ["camera", "action", "mood", "prompt"])
      if (typeof s[k] !== "string" || !s[k].trim()) out.push(`${at}.${k}: required`);
    if (typeof s.prompt === "string" && s.prompt.length > 600)
      out.push(`${at}.prompt: over 600 characters`);
    if (!stills && (typeof s.motion !== "string" || !s.motion.trim()))
      out.push(`${at}.motion: required for generated clips (describe only the movement)`);
    if (!Array.isArray(s.lines) || !s.lines.length) out.push(`${at}.lines: needs script line ids`);
    else
      for (const l of s.lines) {
        if (!scriptIds.includes(l)) out.push(`${at}.lines: "${l}" is not in script.md`);
        used.push(l);
      }
    for (const c of s.characters ?? [])
      if (!bibleText.includes(String(c).toLowerCase()))
        out.push(`${at}.characters: "${c}" is not described in style-bible.md`);
    for (const k of ["prompt", "action", "motion", "mood"]) {
      const r = typeof s[k] === "string" ? ipRefusal(s[k]) : null;
      if (r) out.push(`${at}.${k}: ${r}`);
    }
    if (s.asset !== undefined && assetIds && !assetIds.includes(s.asset))
      out.push(`${at}.asset: "${s.asset}" is not in video.json assets (generate it first)`);
  });
  const order = scriptIds.filter((id) => used.includes(id));
  if (used.join() !== order.join())
    out.push("lines: shots must use the script lines in script order");
  const dup = used.filter((l, i) => used.indexOf(l) !== i);
  if (dup.length) out.push(`lines: ${[...new Set(dup)].join(", ")} used by more than one shot`);
  const missing = scriptIds.filter((id) => !used.includes(id));
  if (missing.length) out.push(`lines: no shot covers ${missing.join(", ")}`);
  return out;
}

/** Counts for the plan: images (one keyframe per shot) and clips and seconds when a generator makes video. */
export function planOf(doc) {
  const clips = doc.generator === "stills-only" ? 0 : doc.shots.length;
  return {
    shots: doc.shots.length,
    seconds: doc.shots.reduce((s, x) => s + x.seconds, 0),
    images: doc.shots.length,
    clips,
    clipSeconds: clips ? doc.shots.reduce((s, x) => s + x.seconds, 0) : 0,
  };
}

/** Scenes for video.json: one broll per shot, showing the shot's asset. */
export function scenesOf(doc) {
  return doc.shots.map((s) => ({
    id: s.id,
    kind: "broll",
    narration: s.lines,
    seconds: s.seconds,
    props: { asset: s.asset, fit: "cover" },
  }));
}

function main() {
  const { flags, positional } = parseArgs(process.argv.slice(2), {
    booleans: ["plan", "build", "force"],
  });
  const dir = positional[0];
  if (!dir) {
    console.error("Usage: node shots.mjs <project-dir> [--plan] [--build [--force]]");
    process.exit(2);
  }
  const read = (f) =>
    existsSync(path.join(dir, f)) ? readFileSync(path.join(dir, f), "utf8") : null;
  let doc;
  try {
    doc = JSON.parse(read("shots.json") ?? "null");
  } catch (e) {
    console.error(`shots.json: not valid JSON (${e.message.slice(0, 80)})`);
    process.exit(1);
  }
  const script = read("script.md");
  if (!doc || script === null) {
    console.error("Needs shots.json and script.md in the project.");
    process.exit(2);
  }
  const videoText = read("video.json");
  const video = videoText ? JSON.parse(videoText) : null;
  const problems = shotProblems(doc, {
    scriptIds: parseScript(script).lines.map((l) => l.id),
    bible: read("style-bible.md"),
    assetIds: flags.build && video ? (video.assets ?? []).map((a) => a.id) : null,
  });
  if (flags.build && !flags.force && video?.scenes?.length)
    problems.push("video.json already has scenes; pass --force to replace them");
  if (flags.build && !video)
    problems.push("video.json is missing (run the writer's storyboard step first)");
  if (flags.build)
    doc.shots.forEach((s) => {
      if (!s.asset) problems.push(`shot "${s.id}": set "asset" to the id of its still or clip`);
    });
  if (problems.length) {
    console.log(
      capLines(
        problems.map((p) => `  ${p}`),
        `${problems.length} problem(s)`,
      ),
    );
    process.exit(1);
  }
  const p = planOf(doc);
  if (flags.build) {
    video.scenes = scenesOf(doc);
    writeFileSync(path.join(dir, "video.json"), JSON.stringify(video, null, 2) + "\n");
  }
  if (flags.plan || !flags.build)
    console.log(
      capLines(
        [
          `${p.shots} shots, ${p.seconds}s on screen`,
          `${p.images} keyframe image(s) to make`,
          p.clips
            ? `${p.clips} clip(s), ${p.clipSeconds}s of generated video (price: ask video-generate for a quote)`
            : "stills-only: no clips, $0 for motion (Ken Burns)",
        ],
        "ok",
      ),
    );
  else console.log(`ok: wrote ${p.shots} scene(s) to video.json`);
}
if (isEntry(import.meta.url)) main();
