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
import { whisperArgs, configuredModel, parseWhisperJson } from "./_whisper.mjs";
import { run } from "./run.mjs";
import { checkJson, checkLut, checkOutput, checkPath, ffmpeg, input, probe } from "./ffwrap.mjs";
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
];

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
      `Unknown command "${command}". Have: trim, join, speed, gif, scenes, audio, color, stabilize, jumpcut, cut, transcribe.`,
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
    console.error(e.message);
    process.exit(2);
  }
}

if (isEntry(import.meta.url)) main();
