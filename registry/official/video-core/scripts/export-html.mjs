#!/usr/bin/env node
// Exports a project as a self-contained interactive page: the same scenes and animations as the video, with a
// player (play, pause, scrub, speed) and the branch points of interactive.json. One folder you can open from
// disk or host anywhere; no network, no external scripts, and a content-security policy that forbids both.
// Usage: node export-html.mjs <project-dir> [--out <folder>] [--audio <file>]
//   --audio takes one finished audio file (for example the voice mix) and plays it in step with the page.
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { branchProblems, resolveBranches } from "../assets/interactive/branches.mjs";
import { checkProject } from "./check.mjs";
import { buildParts } from "./project.mjs";
import { loadRigs, loadVisemes } from "./puppet-data.mjs";
import { buildTiming } from "./timing.mjs";
import { capLines, isEntry, isInside, parseArgs, skillDir } from "./_lib.mjs";

const MARK = ".aisle-interactive";
const FONT_EXT = /\.(woff2?|ttf|otf)$/i;
const AUDIO_EXT = /\.(wav|mp3|m4a|ogg)$/i;
const readJson = (f) => JSON.parse(readFileSync(f, "utf8"));
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const CSP =
  "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self' data:; media-src 'self'; font-src 'self'";

const PAGE_CSS = `
*{box-sizing:border-box}
#app{display:flex;flex-direction:column;min-height:100vh}
#viewport{flex:1;display:flex;align-items:flex-start;justify-content:center;padding:12px 12px 0}
#stage{position:relative;overflow:hidden;box-shadow:0 0 0 1px #8884}
#stage #root{position:absolute;left:0;top:0;transform-origin:0 0}
#panel{padding:12px;font:16px/1.4 system-ui,sans-serif;color:#eee;background:#16181d}
#ask{max-width:640px;margin:0 auto 12px}
#ask p{margin:0 0 8px;font-weight:700}
#opts{display:flex;flex-wrap:wrap;gap:8px}
#panel button,#panel select{font:inherit;color:#fff;background:#2b2f38;border:1px solid #666;border-radius:6px;padding:8px 14px;min-height:44px}
#panel button:focus-visible,#panel select:focus-visible,#scrub:focus-visible{outline:3px solid #ffb703;outline-offset:2px}
#bar{display:flex;gap:12px;align-items:center;max-width:900px;margin:0 auto}
#scrub{flex:1;min-width:80px;height:44px}
#clock{font-variant-numeric:tabular-nums;min-width:5.5em;text-align:end}
#bar label{display:flex;gap:6px;align-items:center}
`;

/** The page text for a built project. Pure (reads only the two bundled scripts). */
export function buildPage({ parts, film, title, audioFile }) {
  const dir = skillDir();
  const tween = readFileSync(path.join(dir, "assets", "lib", "tween.js"), "utf8");
  const player = readFileSync(path.join(dir, "assets", "lib", "player.js"), "utf8");
  const glue = readFileSync(path.join(dir, "assets", "interactive", "page.js"), "utf8");
  const filmJson = JSON.stringify(film).replace(/</g, "\\u003c");
  const [w, h] = parts.size;
  return `<!doctype html>
<html lang="${esc(parts.lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${CSP}">
<title>${esc(title)}</title>
<style>${parts.css}${PAGE_CSS}</style>
</head>
<body>
<main id="app">
<div id="viewport"><div id="stage"><div id="root" dir="${parts.dir}" data-width="${w}" data-height="${h}">
${parts.body}</div></div></div>
<section id="panel" aria-label="Player controls">
<div id="ask" hidden role="group" aria-labelledby="q" aria-live="polite"><p id="q"></p><div id="opts"></div></div>
<div id="bar"><button id="pp" type="button">Play</button><input id="scrub" type="range" min="0" max="1000" step="1" value="0" aria-label="Position"><span id="clock" aria-live="off"></span><label>Speed <select id="rate"><option value="0.5">0.5x</option><option value="0.75">0.75x</option><option value="1" selected>1x</option><option value="1.5">1.5x</option><option value="2">2x</option></select></label></div>
</section>
<noscript><p style="padding:12px;font:16px system-ui">This page needs JavaScript to play.</p></noscript>
</main>
${audioFile ? `<audio id="audio" src="${esc(audioFile)}" preload="auto"></audio>` : ""}
<script id="film" type="application/json">${filmJson}</script>
<script>${tween}</script>
<script>${player}</script>
<script>window.__timelines = window.__timelines || {};
window.__timelines["main"] = VT.run(${parts.planJson}, { id: "main", duration: ${parts.seconds} });</script>
<script>${glue}</script>
</body>
</html>
`;
}

function fail(msg, code = 1) {
  console.error(msg);
  process.exit(code);
}

function main() {
  let parsed;
  try {
    parsed = parseArgs(process.argv.slice(2), { strings: ["out", "audio"] });
  } catch (e) {
    return fail(e.message, 2);
  }
  const { flags, positional } = parsed;
  if (!positional[0])
    return fail("Usage: node export-html.mjs <project-dir> [--out <folder>] [--audio <file>]", 2);
  const dir = path.resolve(positional[0]);
  const vfile = path.join(dir, "video.json");
  if (!existsSync(vfile)) return fail(`No video.json in ${dir}.`, 2);
  const video = readJson(vfile);
  const problems = checkProject(video, dir);
  if (problems.length)
    return fail(
      capLines(problems, `${problems.length} problem(s); fix them (node check.mjs) first.`),
    );

  const tfile = path.join(dir, "timing.json");
  let timing;
  if (existsSync(tfile)) {
    timing = readJson(tfile);
    const same =
      timing.scenes?.length === video.scenes.length &&
      timing.scenes.every((s, i) => s.id === video.scenes[i].id);
    if (!same || timing.fps !== video.meta.fps)
      return fail("timing.json is out of date; run timing.mjs again.");
  } else if (video.scenes.every((s) => s.durationFrom === "fixed"))
    timing = buildTiming(video, () => 0, 0);
  else return fail("No timing.json: run timing.mjs after the voice step.");

  const scenes = video.scenes.map((s, i) => ({
    id: s.id,
    start: timing.scenes[i].start,
    end: timing.scenes[i].start + timing.scenes[i].seconds,
  }));
  let branches = [];
  const ifile = path.join(dir, "interactive.json");
  if (existsSync(ifile)) {
    const data = readJson(ifile);
    const bad = branchProblems(
      data,
      scenes.map((s) => s.id),
    );
    if (bad.length)
      return fail(
        capLines(
          bad,
          "Fix interactive.json (node <video-interactive>/scripts/branches.mjs shows the scene ids).",
        ),
      );
    branches = resolveBranches(data, scenes);
  }

  let audioFile = null;
  if (flags.audio) {
    if (!AUDIO_EXT.test(flags.audio) || !existsSync(flags.audio))
      return fail("--audio must be an existing .wav, .mp3, .m4a or .ogg file.", 2);
    audioFile = `assets/audio${path.extname(flags.audio).toLowerCase()}`;
  }

  let brand = {};
  let fontFiles = [];
  const brandRel = video.meta.brand;
  if (brandRel && isInside(brandRel) && existsSync(path.join(dir, brandRel))) {
    brand = readJson(path.join(dir, brandRel));
    const fdir = path.join(path.dirname(path.join(dir, brandRel)), "fonts");
    fontFiles = (existsSync(fdir) ? readdirSync(fdir) : [])
      .filter((f) => FONT_EXT.test(f))
      .map((f) => path.join(fdir, f));
  }
  let captions = null;
  if (video.captions?.burn === true) {
    const cfile = path.join(dir, "captions.json");
    if (!existsSync(cfile))
      return fail(
        "video.json asks for burned captions but captions.json is missing: run captions.mjs.",
      );
    captions = readJson(cfile);
  }
  let parts;
  try {
    const { rigs, rigs3d } = loadRigs(video, dir);
    parts = buildParts({
      video,
      timing,
      brand,
      fontFiles,
      captions,
      rigs,
      rigs3d,
      visemes: loadVisemes(dir),
      assetPaths: new Map((video.assets ?? []).map((a) => [a.id, path.join(dir, a.path)])),
    });
  } catch (e) {
    return fail(e.message);
  }
  if (parts.gls.length) return fail("3D puppet scenes are not supported in the interactive page.");
  if (/<video[\s>]/.test(parts.body))
    return fail(
      "Scenes with video media (b-roll or screen recordings) are not supported in the interactive page: use stills, or export the video instead.",
    );

  const out = path.resolve(flags.out ?? path.join(dir, "out", "interactive"));
  const marker = path.join(out, MARK);
  if (existsSync(out) && readdirSync(out).length) {
    if (!existsSync(marker))
      return fail(`${out} is not empty and was not made by this script; choose another folder.`, 2);
    rmSync(out, { recursive: true, force: true });
  }
  mkdirSync(out, { recursive: true });
  const film = { duration: timing.totalSeconds, w: parts.size[0], h: parts.size[1], branches };
  writeFileSync(
    path.join(out, "index.html"),
    buildPage({ parts, film, title: video.meta.title, audioFile }),
  );
  writeFileSync(marker, "made by export-html.mjs; safe to delete\n");
  for (const m of [...parts.media, ...parts.fonts]) {
    mkdirSync(path.dirname(path.join(out, m.to)), { recursive: true });
    copyFileSync(m.from, path.join(out, m.to));
  }
  if (audioFile) {
    mkdirSync(path.join(out, "assets"), { recursive: true });
    copyFileSync(flags.audio, path.join(out, audioFile));
  }
  const lines = [
    `Wrote ${path.relative(process.cwd(), out) || out}/index.html: ${scenes.length} scenes, ${timing.totalSeconds.toFixed(1)} s, ${branches.length} branch point(s)${audioFile ? ", with audio" : ", no audio"}.`,
    ...parts.notes.map((n) => `note: ${n}`),
  ];
  console.log(
    capLines(
      lines,
      "Open index.html in a browser. It needs no server and loads nothing from the network.",
    ),
  );
}

if (isEntry(import.meta.url)) main();
