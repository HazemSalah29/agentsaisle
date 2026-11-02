#!/usr/bin/env node
// Turns storyboard.md (a table) plus brief.json into a video.json skeleton that video-core can check and render.
// Refuses scene kinds that are not built, never overwrites an existing video.json without --force.
// Usage: node storyboard.mjs <project-dir> [--force]
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseStoryboard } from "./script-parse.mjs";
import { BUILT_KINDS } from "./write-check.mjs";
import { capLines, isEntry, parseArgs } from "./_lib.mjs";

const TYPES = { explain: "explainer", story: "story", kids: "kids" };
const TRANSITIONS = ["cut", "fade", "slide", "zoom", "whip", "match"];

/** { video, problems }. `existing` (a parsed video.json) keeps its voice, music, assets and disclosure. */
export function buildVideo(brief, storyboardText, existing = {}) {
  const sb = parseStoryboard(storyboardText);
  const problems = sb.problems.map((p) => `storyboard.md:${p.line}  ${p.message}`);
  const scenes = [];
  for (const r of sb.rows) {
    const where = `storyboard.md:${r.line}  scene "${r.scene}": `;
    if (!/^[a-z][a-z0-9-]{0,31}$/.test(r.scene))
      problems.push(`${where}scene id must be lowercase letters, digits and hyphens`);
    if (!BUILT_KINDS.includes(r.kind))
      problems.push(`${where}kind "${r.kind}" is not built yet (${BUILT_KINDS.join(", ")})`);
    const narration = (r.narration ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const seconds = r.seconds ? Number(r.seconds) : undefined;
    if (r.seconds && !(seconds >= 0.5))
      problems.push(`${where}seconds must be a number of at least 0.5`);
    if (!narration.length && !seconds) problems.push(`${where}needs narration lines or seconds`);
    const scene = { id: r.scene, kind: r.kind, props: r.props };
    if (narration.length) scene.narration = narration;
    else scene.durationFrom = "fixed";
    if (seconds) scene.seconds = seconds;
    if (r.transition) {
      if (TRANSITIONS.includes(r.transition)) scene.transitionIn = r.transition;
      else
        problems.push(
          `${where}transition "${r.transition}" is not one of ${TRANSITIONS.join(", ")}`,
        );
    }
    scenes.push(scene);
  }
  const meta = {
    title: brief.title,
    type: TYPES[brief.mode] ?? "custom",
    format: brief.format,
    fps: 30,
    lang: brief.lang,
    audience: brief.audience,
    ...(brief.lang?.startsWith("ar") ? { dir: "rtl" } : {}),
    ...existing.meta,
  };
  // Children read big, high-contrast captions that stay inside the safe area.
  const kidsCaptions =
    brief.mode === "kids" ? { captions: { style: "kids", burn: true, safeZone: "reel" } } : {};
  const video = { version: 1, meta, script: "script.md", ...kidsCaptions, ...existing, scenes };
  video.meta = { ...meta, title: brief.title };
  return { video, problems };
}

function main() {
  let parsed;
  try {
    parsed = parseArgs(process.argv.slice(2), { booleans: ["force"] });
  } catch (e) {
    console.error(e.message);
    process.exit(2);
  }
  if (!parsed.positional[0]) {
    console.error("Usage: node storyboard.mjs <project-dir> [--force]");
    process.exit(2);
  }
  const dir = path.resolve(parsed.positional[0]);
  const need = (f) => {
    if (!existsSync(path.join(dir, f))) {
      console.error(`Missing ${f} in ${dir}.`);
      process.exit(2);
    }
    return readFileSync(path.join(dir, f), "utf8");
  };
  const brief = JSON.parse(need("brief.json"));
  const out = path.join(dir, "video.json");
  if (existsSync(out) && !parsed.flags.force) {
    console.error(
      "video.json already exists. Edit it, or pass --force to rebuild the scenes from storyboard.md (keeps voice, music, assets, disclosure).",
    );
    process.exit(2);
  }
  const existing = existsSync(out) ? JSON.parse(readFileSync(out, "utf8")) : {};
  const { video, problems } = buildVideo(brief, need("storyboard.md"), existing);
  if (problems.length) {
    console.error(capLines(problems, `${problems.length} problem(s); video.json not written.`));
    process.exit(1);
  }
  writeFileSync(out, `${JSON.stringify(video, null, 2)}\n`);
  console.log(
    `Wrote video.json: ${video.scenes.length} scenes (${video.scenes.map((s) => s.kind).join(", ")}).\nNext: node <video-core>/scripts/check.mjs ${dir}`,
  );
}

if (isEntry(import.meta.url)) main();
