#!/usr/bin/env node
// Checks a rendered video against its project and writes qa/report.json and qa/contact-sheet.png. Nothing is
// changed except those two files. Programs run through run.mjs (ffmpeg and ffprobe only, no shell).
// Usage: node qa.mjs <project-dir> [--video <file>] [--draft] [--json]
// Exit: 0 passed (warnings allowed), 1 something failed, 2 the checks could not run.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  applyLessons,
  changedCells,
  contrast,
  fastRuns,
  flashes,
  hardSwaps,
  idleStretches,
  parseBlack,
  parseEbur128,
  parseFreeze,
  parseSignalstats,
  sheetTimes,
  shortScenes,
  textProblems,
} from "./_checks.mjs";
import { run } from "./run.mjs";
import { capLines, isEntry, parseArgs, skillDir } from "./_lib.mjs";

export const loadRules = () =>
  JSON.parse(readFileSync(path.join(skillDir(), "assets", "rules.json"), "utf8"));

const SIZES = {
  "reel-9x16": [1080, 1920],
  "short-9x16": [1080, 1920],
  "youtube-16x9": [1920, 1080],
  "square-1x1": [1080, 1080],
};
const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const r1 = (n) => Math.round(n * 10) / 10;

/** ffmpeg with a quiet banner; returns the program's log (stderr) and stdout. */
function ff(args, opts = {}) {
  const r = run("ffmpeg", ["-hide_banner", "-nostats", ...args], { timeoutMs: 600_000, ...opts });
  if (r.error) throw new Error(`ffmpeg could not start: ${r.error.message}`);
  return r;
}

function probe(file) {
  const r = run("ffprobe", ["-v", "error", "-show_streams", "-show_format", "-of", "json", file]);
  if (r.error || r.status !== 0)
    throw new Error(`ffprobe could not read ${file}: ${r.stderr.slice(0, 120)}`);
  const j = JSON.parse(r.stdout);
  const v = j.streams.find((s) => s.codec_type === "video");
  if (!v) throw new Error(`${file} has no video stream.`);
  const [n, d] = String(v.r_frame_rate).split("/").map(Number);
  return {
    width: v.width,
    height: v.height,
    fps: d ? n / d : n,
    codec: v.codec_name,
    pixFmt: v.pix_fmt,
    audio: j.streams.some((s) => s.codec_type === "audio"),
    seconds: num(j.format.duration),
  };
}

/** A strip of the frame as a crop expression. */
const strips = (z) => ({
  left: `iw*${z.left}:ih:0:0`,
  right: `iw*${z.right}:ih:iw*${1 - z.right}:0`,
  top: `iw:ih*${z.top}:0:0`,
  bottom: `iw:ih*${z.bottom}:0:ih*${1 - z.bottom}`,
});

/**
 * Run every check. `dir` is the project; `file` the rendered video. Returns { results, facts } where a result is
 * { id, level: "pass" | "warn" | "fail", text }.
 */
export async function qaProject({ dir, file, draft = false }, baseRules = loadRules()) {
  const video = JSON.parse(readFileSync(path.join(dir, "video.json"), "utf8"));
  // The project's own lessons (lessons.json: flat numbers) change the motion limits; anything else is ignored and said so.
  const lfile = path.join(dir, "lessons.json");
  let lessons;
  try {
    lessons = existsSync(lfile) ? JSON.parse(readFileSync(lfile, "utf8")) : null;
  } catch {
    lessons = {};
  }
  const { rules, applied, ignored } = applyLessons(baseRules, lessons);
  const tfile = path.join(dir, "timing.json");
  const timing = existsSync(tfile) ? JSON.parse(readFileSync(tfile, "utf8")) : null;
  const results = [];
  const add = (id, level, text) => results.push({ id, level, text });
  const fmt = video.meta.format;
  const info = probe(file);

  // Format.
  const [w, h] = SIZES[fmt] ?? [info.width, info.height];
  const sizeOk = draft
    ? Math.abs(info.width / info.height - w / h) < 0.01
    : info.width === w && info.height === h;
  add(
    "resolution",
    sizeOk ? "pass" : "fail",
    sizeOk
      ? `${info.width}x${info.height}`
      : `${info.width}x${info.height}, expected ${w}x${h} for ${fmt}${draft ? " (same shape)" : ""}`,
  );
  add(
    "fps",
    Math.abs(info.fps - video.meta.fps) < 0.01 ? "pass" : "fail",
    `${r1(info.fps)} fps (project says ${video.meta.fps})`,
  );
  const codecOk = info.codec === "h264" && info.pixFmt === "yuv420p";
  add(
    "codec",
    codecOk ? "pass" : "warn",
    codecOk ? "h264, yuv420p" : `${info.codec}, ${info.pixFmt}; platforms expect h264 and yuv420p`,
  );
  const plat = rules.platforms[fmt];
  const want = timing?.totalSeconds;
  if (want !== undefined && Math.abs(info.seconds - want) > rules.durationTolerance)
    add("duration", "fail", `video is ${r1(info.seconds)} s but timing.json says ${want} s`);
  else if (plat && info.seconds > plat.maxSeconds)
    add(
      "duration",
      "fail",
      `${r1(info.seconds)} s is over the ${plat.maxSeconds} s limit for ${fmt}`,
    );
  else add("duration", "pass", `${r1(info.seconds)} s`);

  // Sound.
  const wantsAudio =
    Boolean(video.music?.asset) || (video.voice?.provider && video.voice.provider !== "none");
  if (!info.audio)
    add(
      "audio",
      wantsAudio ? "fail" : "pass",
      wantsAudio
        ? "the project has voice or music but the video has no audio track"
        : "no audio track (the project has none)",
    );
  else {
    const m = parseEbur128(
      ff(["-i", file, "-vn", "-af", "ebur128=peak=true", "-f", "null", "-"]).stderr,
    );
    const L = rules.loudness;
    if (!m || m.lufs === null || m.lufs === -Infinity || m.lufs < -60)
      add("loudness", "fail", "the audio is silent");
    else {
      const off = Math.abs(m.lufs - L.targetLufs);
      add(
        "loudness",
        off <= L.warnWithin ? "pass" : off <= L.failBeyond ? "warn" : "fail",
        `${r1(m.lufs)} LUFS (target ${L.targetLufs}, working default)`,
      );
      add(
        "clipping",
        m.truePeak >= 0 ? "fail" : m.truePeak > L.maxTruePeakDb ? "warn" : "pass",
        `true peak ${r1(m.truePeak)} dBTP (limit ${L.maxTruePeakDb})`,
      );
    }
  }

  // Picture.
  const black = parseBlack(
    ff([
      "-i",
      file,
      "-an",
      "-vf",
      `blackdetect=d=${rules.black.minSeconds}:pic_th=0.98:pix_th=0.03`,
      "-f",
      "null",
      "-",
    ]).stderr,
  );
  if (black.length)
    for (const b of black)
      add("black", "fail", `black picture ${r1(b.start)} to ${r1(b.end)} s (${r1(b.seconds)} s)`);
  else add("black", "pass", "no black stretch");
  const freeze = parseFreeze(
    ff(["-i", file, "-an", "-vf", `freezedetect=d=${rules.freeze.warnSeconds}`, "-f", "null", "-"])
      .stderr,
  );
  if (freeze.length)
    for (const f of freeze)
      add(
        "freeze",
        "warn",
        `nothing changes ${Number.isFinite(f.seconds) ? `for ${r1(f.seconds)} s` : "until the end"} from ${r1(f.start)} s (pace: a change at least every ${rules.freeze.warnSeconds} s)`,
      );
  else add("freeze", "pass", `something changes at least every ${rules.freeze.warnSeconds} s`);
  const luma = parseSignalstats(
    ff([
      "-i",
      file,
      "-an",
      "-vf",
      "scale=32:18,signalstats,metadata=mode=print:key=lavfi.signalstats.YAVG:file=-",
      "-f",
      "null",
      "-",
    ]).stdout,
  );
  const flashRule = rules.flash;
  const fl = flashes(luma, flashRule.changeFraction);
  add(
    "flashing",
    fl.worst > flashRule.maxPerSecond ? "fail" : "pass",
    fl.worst > flashRule.maxPerSecond
      ? `${fl.worst} flashes in one second at ${r1(fl.at)} s (limit ${flashRule.maxPerSecond})`
      : "no fast flashing",
  );

  // Motion: how the picture moves, from the average change between frames (10 a second).
  const mo = rules.motion;
  const total = timing?.totalSeconds ?? info.seconds;
  const motion = parseSignalstats(
    ff([
      "-i",
      file,
      "-an",
      "-vf",
      `fps=${mo.sampleFps},scale=64:36,format=gray,tblend=all_mode=difference,signalstats,metadata=mode=print:key=lavfi.signalstats.YAVG:file=-`,
      "-f",
      "null",
      "-",
    ]).stdout,
  );
  const kindOf = (id) => video.scenes.find((v) => v.id === id)?.kind;
  const sceneSpans = (kinds) =>
    (timing?.scenes ?? [])
      .filter((s) => kinds.includes(kindOf(s.id)))
      .map((s) => [s.start, s.start + s.seconds]);
  const veil = (timing?.scenes ?? []).slice(1).map((s) => {
    const t = video.scenes.find((v) => v.id === s.id)?.transitionSeconds;
    return [s.start - 0.1, s.start + Math.max(1, t ?? 0)];
  });
  if (motion.length < 3) add("motion", "warn", "could not measure motion (the video is too short)");
  else {
    // Idle is judged on changed cells of a small grey picture, written to a temp file (the runner reads text only).
    const [gw, gh] = mo.idle.grid;
    const tmp = mkdtempSync(path.join(os.tmpdir(), "video-qa-"));
    let cells;
    try {
      const raw = path.join(tmp, "frames.gray");
      ff([
        "-y",
        "-i",
        file,
        "-an",
        "-vf",
        `fps=${mo.sampleFps},scale=${gw}:${gh}:flags=area,format=gray`,
        "-f",
        "rawvideo",
        raw,
      ]);
      cells = changedCells(readFileSync(raw), gw, gh, {
        cellDiff: mo.idle.cellDiff,
        dt: 1 / mo.sampleFps,
      });
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
    const idle = idleStretches(cells, {
      epsilon: mo.idle.cells,
      key: "cells",
      minSeconds: mo.idle.maxSeconds,
      ignore: [...sceneSpans(["broll"]), [total - mo.idle.endHoldSeconds, total + 1]],
      dt: 1 / mo.sampleFps,
    });
    const sceneAt = (t) =>
      (timing?.scenes ?? []).find((c) => t >= c.start && t < c.start + c.seconds)?.id;
    if (idle.length)
      add(
        "idle",
        "warn",
        `nothing moves for ${r1(idle[0].seconds)} s from ${r1(idle[0].start)} s${sceneAt(idle[0].start) ? ` (scene ${sceneAt(idle[0].start)})` : ""}${idle.length > 1 ? `, and in ${idle.length - 1} more place(s)` : ""}; bring the next item or a highlight in sooner, split the scene, or leave focus on for item scenes (limit ${mo.idle.maxSeconds} s)`,
      );
    else add("idle", "pass", `something moves at least every ${mo.idle.maxSeconds} s`);
    const fast = fastRuns(motion, {
      limit: mo.fast.limit,
      minSamples: mo.fast.minSamples,
      ignore: [...veil, ...sceneSpans(["shot"])],
      dt: 1 / mo.sampleFps,
    });
    if (fast.length)
      add(
        "speed",
        "warn",
        `a move is too fast to follow at ${r1(fast[0].start)} s (${r1(fast[0].seconds)} s of large change${fast.length > 1 ? `, ${fast.length} places` : ""}); slow it or give it longer`,
      );
    else add("speed", "pass", "no move is too fast to follow");
    const boundaries = (timing?.scenes ?? [])
      .slice(1)
      .map((s) => ({ t: s.start, id: s.id }))
      .filter((b) => {
        const v = video.scenes.find((x) => x.id === b.id);
        return !v?.transitionIn || v.transitionIn === "cut";
      });
    const swaps = hardSwaps(motion, boundaries, mo.swap);
    if (swaps.length)
      add(
        "joins",
        "warn",
        `the picture swaps in one frame at ${swaps.map((x) => `${r1(x.t)} s`).join(", ")}; use a transition there, or keep the cut on purpose`,
      );
    else add("joins", "pass", "no unplanned one-frame swaps between scenes");
  }
  const brief = shortScenes(timing, mo.minSceneSeconds);
  if (brief.length)
    add(
      "scene-length",
      brief.some((b) => b.seconds < 1) ? "fail" : "warn",
      `scene ${brief.map((b) => `${b.id} (${r1(b.seconds)} s)`).join(", ")} is under ${mo.minSceneSeconds} s; merge it with its neighbour or give it more narration`,
    );
  else if (timing)
    add("scene-length", "pass", `every scene lasts at least ${mo.minSceneSeconds} s`);
  if (lessons)
    add(
      "lessons",
      ignored.length ? "warn" : "pass",
      ignored.length
        ? `lessons.json: ignored ${ignored.join(", ")} (unknown or out of range)`
        : `lessons applied: ${applied.join(", ") || "none"}`,
    );

  // Text near the edges. Scenes with full-frame media are skipped; the rest should leave the margins empty.
  const zone = rules.zones[plat?.zone ?? "wide"];
  const skip = (timing?.scenes ?? []).filter((s) =>
    ["broll", "shot", "kinetic"].includes(video.scenes.find((v) => v.id === s.id)?.kind),
  );
  const inSkip = (t) => skip.some((s) => t >= s.start && t < s.start + s.seconds);
  const hits = [];
  for (const [side, crop] of Object.entries(strips(zone))) {
    const frames = parseSignalstats(
      ff([
        "-i",
        file,
        "-an",
        "-vf",
        `fps=3,crop=${crop},signalstats,metadata=mode=print:file=-`,
        "-f",
        "null",
        "-",
      ]).stdout,
    );
    frames.forEach((f) => {
      if (!inSkip(f.t) && f.YMAX - f.YMIN > rules.inkThreshold) hits.push({ side, t: f.t });
    });
  }
  if (hits.length) {
    hits.sort((a, b) => a.t - b.t);
    add(
      "safe-zone",
      "fail",
      `something is drawn in the ${hits[0].side} margin at ${r1(hits[0].t)} s (${hits.length} sample(s); margins use the library's values, see rules.json)`,
    );
  } else add("safe-zone", "pass", "margins are clear");

  // Captions.
  const cfile = path.join(dir, "captions.json");
  if (existsSync(cfile)) {
    const c = JSON.parse(readFileSync(cfile, "utf8"));
    const size = num(c.style?.size);
    const minCaption = rules.captionMinSize;
    const minContrast = rules.contrastMin;
    if (h > w)
      add(
        "caption-size",
        size >= minCaption ? "pass" : "fail",
        `captions are ${r1(size * 100)}% of the height (at least ${r1(minCaption * 100)}% on vertical video)`,
      );
    const bfile = video.meta.brand ? path.join(dir, video.meta.brand) : null;
    const colors =
      bfile && existsSync(bfile) ? (JSON.parse(readFileSync(bfile, "utf8")).colors ?? {}) : {};
    const hex = /^#[0-9a-fA-F]{6}$/;
    if (hex.test(colors.fg) && hex.test(colors.bg)) {
      const ratio = contrast(colors.fg, colors.bg);
      add(
        "caption-contrast",
        ratio >= minContrast ? "pass" : "fail",
        `caption text against the background is ${r1(ratio)}:1 (at least ${minContrast}:1)`,
      );
    }
  }

  // Content: project checks, licences and disclosure come from video-core, which sits next to this skill.
  const core = path.join(skillDir(), "..", "video-core", "scripts");
  try {
    const { checkProject } = await import(pathToFileURL(path.join(core, "check.mjs")).href);
    const problems = checkProject(video, dir);
    if (problems.length) for (const p of problems.slice(0, 6)) add("project", "fail", p);
    else add("project", "pass", "video.json passes check.mjs (props, assets, licences)");
    const { buildCredits } = await import(pathToFileURL(path.join(core, "credits.mjs")).href);
    const mfile = path.join(dir, "voice", "manifest.json");
    const credits = buildCredits(
      video,
      existsSync(mfile) ? JSON.parse(readFileSync(mfile, "utf8")) : null,
    );
    add(
      "disclosure",
      credits.ok ? "pass" : "fail",
      credits.ok ? "disclosure flags match the assets" : credits.problems[0],
    );
  } catch (e) {
    add(
      "project",
      "warn",
      `could not run video-core checks (is video-core installed next to video-qa?): ${String(e.message).slice(0, 80)}`,
    );
  }
  if (video.voice?.provider && video.voice.provider !== "none") {
    const missing = [...new Set(video.scenes.flatMap((s) => s.narration ?? []))].filter(
      (id) => !existsSync(path.join(dir, "voice", `${id}.wav`)),
    );
    add(
      "voiced",
      missing.length ? "fail" : "pass",
      missing.length
        ? `no audio for line(s) ${missing.slice(0, 5).join(", ")}`
        : "every narration line is voiced",
    );
  }
  const texts = [
    video.meta.title,
    ...(JSON.stringify(video.scenes.map((s) => s.props))
      .match(/"((?:[^"\\]|\\.)*)"/g)
      ?.map((s) => JSON.parse(s)) ?? []),
  ];
  const sfile = path.join(dir, "script.md");
  if (existsSync(sfile)) texts.push(readFileSync(sfile, "utf8"));
  const seen = new Set();
  for (const t of texts.filter((x) => typeof x === "string"))
    for (const p of textProblems(t)) {
      const key = `${p.level}${p.text}`;
      if (seen.has(key)) continue;
      seen.add(key);
      add("text", p.level, p.text);
    }
  if (!seen.size) add("text", "pass", "no placeholders or doubled words");

  // Contact sheet.
  let sheet = null;
  if (timing) {
    const times = sheetTimes(timing);
    const frames = times.map((t) => Math.round(t * info.fps));
    const cols = Math.min(6, times.length);
    const rows = Math.ceil(times.length / cols);
    mkdirSync(path.join(dir, "qa"), { recursive: true });
    const out = path.join(dir, "qa", "contact-sheet.png");
    const sel = frames.map((n) => `eq(n\\,${n})`).join("+");
    ff([
      "-y",
      "-i",
      file,
      "-an",
      "-vf",
      `select=${sel},scale=216:-2,tile=${cols}x${rows}:padding=6:margin=6:color=0x202020`,
      "-frames:v",
      "1",
      "-update",
      "1",
      out,
    ]);
    sheet = { file: path.join("qa", "contact-sheet.png"), times };
  }
  return { results, facts: { ...info, sheet } };
}

function main() {
  let parsed;
  try {
    parsed = parseArgs(process.argv.slice(2), { booleans: ["draft", "json"], strings: ["video"] });
  } catch (e) {
    console.error(e.message);
    process.exit(2);
  }
  const target = parsed.positional[0];
  if (!target) {
    console.error("Usage: node qa.mjs <project-dir> [--video <file>] [--draft] [--json]");
    process.exit(2);
  }
  const dir = path.resolve(target);
  const file = parsed.flags.video
    ? path.resolve(parsed.flags.video)
    : [
        path.join(dir, "out", `${path.basename(dir)}.mp4`),
        path.join(dir, "out", `${path.basename(dir)}-draft.mp4`),
      ].find(existsSync);
  if (!existsSync(path.join(dir, "video.json")) || !file || !existsSync(file)) {
    console.error(
      "Needs <project>/video.json and a rendered video (out/<name>.mp4). Render first with video-core.",
    );
    process.exit(2);
  }
  qaProject({ dir, file, draft: parsed.flags.draft || /-draft\.mp4$/.test(file) })
    .then(({ results, facts }) => {
      mkdirSync(path.join(dir, "qa"), { recursive: true });
      const failed = results.filter((r) => r.level === "fail");
      const warned = results.filter((r) => r.level === "warn");
      const report = { ok: failed.length === 0, file: path.relative(dir, file), facts, results };
      writeFileSync(path.join(dir, "qa", "report.json"), `${JSON.stringify(report, null, 2)}\n`);
      if (parsed.flags.json)
        console.log(JSON.stringify(report, null, 2).split("\n").slice(0, 40).join("\n"));
      else {
        const lines = [
          `QA ${failed.length ? "FAIL" : "PASS"}: ${path.relative(dir, file)} (${r1(facts.seconds)} s, ${facts.width}x${facts.height}, ${r1(facts.fps)} fps)`,
          ...[...failed, ...warned].map(
            (r) => `${r.level === "fail" ? "FAIL" : "WARN"}  ${r.text}`,
          ),
          `passed: ${results
            .filter((r) => r.level === "pass")
            .map((r) => r.id)
            .join(", ")}`,
        ];
        if (facts.sheet)
          lines.push(`contact sheet: ${facts.sheet.file} (${facts.sheet.times.length} frames)`);
        console.log(
          capLines(
            lines,
            "Not checked: spelling (no dictionary), platform UI margins and loudness targets are working defaults (see assets/rules.json).",
          ),
        );
      }
      process.exit(failed.length ? 1 : 0);
    })
    .catch((e) => {
      console.error(e.message);
      process.exit(2);
    });
}

if (isEntry(import.meta.url)) main();
