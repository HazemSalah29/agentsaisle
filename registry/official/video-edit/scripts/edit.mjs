#!/usr/bin/env node
// Post-production with FFmpeg: trim, join, speed, gif, scenes (more subcommands are added by later versions of
// this file). Reads one or more media files, writes one new file; the original is never changed.
// Usage: node edit.mjs <command> --in <file>[,<file>...] --out <file> [options] [--best] [--force]
// Exit: 0 done, 2 refused or failed.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  colorArgs,
  parseSize,
  readDetections,
  reframeArgs,
  jumpcutArgs,
  stabilizeArgs,
  gifArgs,
  joinArgs,
  loudnormApplyArgs,
  loudnormMeasureArgs,
  parseLoudnorm,
  parseScenes,
  sceneReport,
  scenesArgs,
  speedArgs,
  trimArgs,
} from "./commands.mjs";
import {
  buildCutPlan,
  cutArgs,
  fillerSet,
  parseSilence,
  readWords,
  silenceArgs,
  speechSpans,
} from "./cutplan.mjs";
import { configuredModel, parseWhisperJson, whisperArgs } from "./_whisper.mjs";
import { cropSize, describePath, fixedLeft, keyframes, smoothPath } from "./reframe-path.mjs";
import { run } from "./run.mjs";
import {
  checkJson,
  checkLut,
  checkOutput as checkOut,
  checkPath,
  ffmpeg,
  input,
  probe,
} from "./ffwrap.mjs";
import { capLines, isEntry, parseArgs, skillDir } from "./_lib.mjs";

const STRINGS = [
  "in",
  "out",
  "from",
  "to",
  "factor",
  "width",
  "fps",
  "threshold",
  "target",
  "music",
  "look",
  "lut",
  "marks",
  "strength",
  "pause",
  "breath",
  "lang",
  "words",
  "plan",
  "fillers-extra",
  "mode",
  "size",
  "detections",
];

/** Media files this run asked to create; a failed run removes the half-written ones. */
const claimed = [];
function checkOutput(...args) {
  const o = checkOut(...args);
  claimed.push(o);
  return o;
}
const MEDIA = /\.(mp4|mov|mkv|webm|gif|wav|m4a)$/i;

const readFillers = () =>
  JSON.parse(readFileSync(path.join(skillDir(), "assets", "fillers.json"), "utf8"));

/** Speech words of a clip from whisper.cpp (measured times). Needs whisper-cli and a ggml model (see doctor). */
function whisperWords(file, lang) {
  const model = configuredModel();
  if (!model || !existsSync(model))
    throw new Error(
      "whisper.cpp is not set up (no model in ~/.aisle-video/tools.json). Run /video doctor, or use --silence-only, or give --words words.json.",
    );
  const work = mkdtempSync(path.join(os.tmpdir(), "video-edit-"));
  try {
    const wav = path.join(work, "a.wav");
    ffmpeg([...input(file), "-vn", "-ac", "1", "-ar", "16000", "-y", wav]);
    const prefix = path.join(work, "out");
    const r = run("whisper-cli", whisperArgs({ model, wav, lang, outPrefix: prefix }), {
      timeoutMs: 3_600_000,
    });
    if (r.status !== 0)
      throw new Error(
        `whisper-cli failed: ${String(r.stderr).trim().split("\n").slice(-2).join(" | ").slice(0, 200)}`,
      );
    return parseWhisperJson(JSON.parse(readFileSync(`${prefix}.json`, "utf8")));
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

/** transcribe: write the clip's words with their times to --out (a .json file) for cut, or for the writer. */
function transcribe(file, flags) {
  const words = whisperWords(file, flags.lang ?? "en");
  const out = checkOutput(flags.out ?? "", file, flags.force);
  writeFileSync(out, `${JSON.stringify(words, null, 2)}\n`);
  return [`Wrote ${path.basename(out)}: ${words.length} words, measured with whisper.cpp.`];
}

/** cut: plan (and with --apply, render) the removal of long pauses and fillers. */
function cut(file, info, flags, best) {
  const lang = flags.lang ?? "en";
  const pause = flags.pause === undefined ? 0.35 : Number(flags.pause);
  const breath = flags.breath === undefined ? 0.12 : Number(flags.breath);
  let spans;
  if (flags["silence-only"]) {
    spans = speechSpans(
      parseSilence(ffmpeg(silenceArgs({ file, pause }), { level: "info" }).stderr, info.seconds),
      info.seconds,
    );
  } else if (flags.words)
    spans = readWords(JSON.parse(readFileSync(checkJson(flags.words, "words"), "utf8")));
  else spans = whisperWords(file, lang);
  const fillers =
    flags["silence-only"] || flags["no-fillers"]
      ? new Set()
      : fillerSet(readFillers(), lang, flags["fillers-extra"]);
  const plan = buildCutPlan(spans, { duration: info.seconds, pause, breath, fillers });
  const lines = [
    `${path.basename(file)}: ${plan.seconds.before} s -> ${plan.seconds.after} s (saves ${plan.seconds.saved} s): ${plan.counts.pauses} pause(s), ${plan.counts.fillers} filler(s)`,
    ...plan.removed
      .slice(0, 12)
      .map((r) => `  ${r.start}-${r.end} s  ${r.kind}${r.text ? ` "${r.text}"` : ""}`),
  ];
  if (plan.removed.length > 12) lines.push(`  ... ${plan.removed.length - 12} more`);
  if (flags.plan) {
    const p = checkOutput(flags.plan, file, flags.force);
    writeFileSync(p, `${JSON.stringify(plan, null, 2)}\n`);
    lines.push(`Wrote the plan to ${path.basename(p)}.`);
  }
  if (!flags.apply)
    return [...lines, "Dry run: nothing was cut. Add --apply --out <file> to render it."];
  if (!flags.out) throw new Error("--apply needs --out <file>.");
  const out = checkOutput(flags.out, file, flags.force);
  mkdirSync(path.dirname(out), { recursive: true });
  ffmpeg(cutArgs({ file, out, keeps: plan.keeps, best }, info));
  const after = probe(out);
  return [...lines, `Wrote ${path.basename(out)}: ${Math.round(after.seconds * 100) / 100} s.`];
}

/** Where the speaker's face is, a few times a second, from OpenCV (the python script in this skill). */
function detectFaces(file) {
  const work = mkdtempSync(path.join(os.tmpdir(), "video-edit-"));
  try {
    const out = path.join(work, "faces.json");
    const r = run(
      "python",
      [path.join(skillDir(), "scripts", "face_track.py"), file, out, "--fps", "3"],
      { timeoutMs: 3_600_000 },
    );
    if (r.status === 3)
      throw new Error(
        `${String(r.stderr).trim()} Or use --mode center, left, right or x=0.4, or give --detections file.json.`,
      );
    if (r.status !== 0)
      throw new Error(`Face detection failed: ${String(r.stderr).trim().slice(0, 200)}`);
    return readDetections(JSON.parse(readFileSync(out, "utf8")));
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

/** reframe: 16:9 to 9:16 (or any narrower shape), following the face or at a fixed place. */
function reframe(file, info, flags, best) {
  const size = parseSize(flags.size ?? "1080x1920");
  const { cropW, cropH } = cropSize({ srcW: info.width, srcH: info.height }, size[0], size[1]);
  const mode = flags.mode ?? "face";
  const lines = [];
  let keys;
  if (mode === "face") {
    const samples = flags.detections
      ? readDetections(JSON.parse(readFileSync(checkJson(flags.detections, "detections"), "utf8")))
      : detectFaces(file);
    const path1 = smoothPath(samples, { srcW: info.width, cropW });
    if (!path1)
      throw new Error(
        "No face was found. Use --mode center, left, right or x=0.4 to place the crop yourself.",
      );
    if (path1.coverage < 0.2)
      throw new Error(
        `A face was found in only ${Math.round(path1.coverage * 100)}% of the samples, too few to follow. Use --mode center, left, right or x=0.4.`,
      );
    keys = keyframes(path1.points);
    lines.push(
      `Face found in ${Math.round(path1.coverage * 100)}% of the samples; where it was missing the crop held its last place.`,
    );
  } else keys = [{ t: 0, x: Math.round(fixedLeft(mode, { srcW: info.width, cropW }) * 10) / 10 }];
  const d = describePath(keys, cropW, info.width);
  lines.push(
    `Crop ${cropW}x${cropH} out of ${info.width}x${info.height}, scaled to ${size.join("x")}: ${d.keyframes} keyframe(s), left edge ${d.leftMin} to ${d.leftMax} px.`,
  );
  if (flags.plan) {
    const p = checkOutput(flags.plan, file, flags.force);
    writeFileSync(
      p,
      `${JSON.stringify({ version: 1, mode, size, cropW, cropH, keyframes: keys }, null, 2)}\n`,
    );
    lines.push(`Wrote the path to ${path.basename(p)}.`);
  }
  const out = checkOutput(flags.out ?? "", file, flags.force);
  mkdirSync(path.dirname(out), { recursive: true });
  ffmpeg(reframeArgs({ file, out, keys, cropW, cropH, size, best }, info));
  const after = probe(out);
  return [
    ...lines,
    `Wrote ${path.basename(out)}: ${Math.round(after.seconds * 100) / 100} s, ${after.width}x${after.height}.`,
  ];
}

/** Run one command. Returns the lines to print. Exported for tests. */
export function execute(command, flags) {
  const ins = String(flags.in ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!ins.length) throw new Error("Give --in <file>.");
  const files = ins.map((f) => checkPath(f, "input"));
  const infos = files.map((f) => probe(f));
  const best = Boolean(flags.best);
  const need = (name) => {
    if (!flags[name]) throw new Error(`Give --${name} <file>.`);
    return flags[name];
  };
  if (command === "scenes") {
    const r = ffmpeg(scenesArgs({ file: files[0], threshold: flags.threshold }));
    const report = sceneReport(parseScenes(r.stdout), infos[0].seconds);
    const lines = [
      `${path.basename(files[0])}: ${report.seconds} s, ${report.cuts} cut(s), average shot ${report.averageShotSeconds} s, ${report.cutsPerMinute} cuts a minute`,
    ];
    if (report.cutTimes.length)
      lines.push(
        `cuts at: ${report.cutTimes.slice(0, 20).join(", ")}${report.cutTimes.length > 20 ? ", ..." : ""} s`,
      );
    if (flags.out) {
      const out = checkOutput(flags.out, files[0], flags.force);
      mkdirSync(path.dirname(out), { recursive: true });
      writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
      lines.push(`Wrote ${path.basename(out)}.`);
    }
    return lines;
  }
  if (command === "cut") return cut(files[0], infos[0], flags, best);
  if (command === "transcribe") return transcribe(files[0], flags);
  if (command === "reframe") return reframe(files[0], infos[0], flags, best);
  const out = checkOutput(need("out"), files[0], flags.force);
  mkdirSync(path.dirname(out), { recursive: true });
  let args;
  if (command === "trim")
    args = trimArgs({ file: files[0], out, from: flags.from, to: flags.to, best }, infos[0]);
  else if (command === "speed")
    args = speedArgs({ file: files[0], out, factor: flags.factor, best }, infos[0]);
  else if (command === "join") args = joinArgs({ files, out, best }, infos);
  else if (command === "gif")
    args = gifArgs(
      {
        file: files[0],
        out,
        from: flags.from,
        to: flags.to,
        width: flags.width ?? 480,
        fps: flags.fps ?? 12,
      },
      infos[0],
    );
  else if (command === "color")
    args = colorArgs(
      {
        file: files[0],
        out,
        look: flags.look,
        lut: flags.lut ? checkLut(flags.lut) : undefined,
        autoWb: flags["auto-wb"],
        best,
      },
      infos[0],
    );
  else if (command === "jumpcut")
    args = jumpcutArgs(
      {
        file: files[0],
        out,
        marks: JSON.parse(readFileSync(checkJson(need("marks"), "marks"), "utf8")),
        best,
      },
      infos[0],
    );
  else if (command === "stabilize") {
    const work = mkdtempSync(path.join(os.tmpdir(), "video-stab-"));
    try {
      const plan = stabilizeArgs(
        { file: files[0], out, trf: path.join(work, "motion.trf"), strength: flags.strength, best },
        infos[0],
      );
      ffmpeg(plan.detect);
      ffmpeg(plan.apply);
    } finally {
      rmSync(work, { recursive: true, force: true });
    }
    const after = probe(out);
    return [
      `Wrote ${path.basename(out)}: ${Math.round(after.seconds * 100) / 100} s, ${after.width}x${after.height}. The correction crops the picture slightly.`,
    ];
  } else if (command === "audio") {
    if (!infos[0].audio) throw new Error("This file has no sound to work on.");
    const music = flags.music ? checkPath(flags.music, "input") : null;
    const o = {
      file: files[0],
      out,
      denoise: flags.denoise,
      music,
      duck: flags.duck,
      target: flags.target,
    };
    const m = parseLoudnorm(ffmpeg(loudnormMeasureArgs(o, infos[0]), { level: "info" }).stderr);
    if (!m) throw new Error("ffmpeg gave no loudness measurement.");
    args = loudnormApplyArgs(o, infos[0], m);
  } else
    throw new Error(
      `Unknown command "${command}". Have: trim, join, speed, gif, scenes, audio, color, stabilize, jumpcut, cut, transcribe, reframe.`,
    );
  ffmpeg(args);
  const after = probe(out);
  return [
    `Wrote ${path.basename(out)}: ${Math.round(after.seconds * 100) / 100} s, ${after.width}x${after.height}${after.audio ? ", with sound" : ""}.`,
  ];
}

function main() {
  try {
    const { flags, positional } = parseArgs(process.argv.slice(2), {
      booleans: [
        "best",
        "force",
        "denoise",
        "duck",
        "auto-wb",
        "apply",
        "silence-only",
        "no-fillers",
      ],
      strings: STRINGS,
    });
    if (!positional[0])
      throw new Error(
        "Usage: node edit.mjs <trim|join|speed|gif|scenes> --in <file> --out <file> [options]",
      );
    console.log(capLines(execute(positional[0], flags), "The original file was not changed."));
  } catch (e) {
    for (const f of claimed) if (MEDIA.test(f)) rmSync(f, { force: true });
    console.error(e.message);
    process.exit(2);
  }
}

if (isEntry(import.meta.url)) main();
