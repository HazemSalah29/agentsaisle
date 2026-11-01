#!/usr/bin/env node
// Post-production with FFmpeg: trim, join, speed, gif, scenes (more subcommands are added by later versions of
// this file). Reads one or more media files, writes one new file; the original is never changed.
// Usage: node edit.mjs <command> --in <file>[,<file>...] --out <file> [options] [--best] [--force]
// Exit: 0 done, 2 refused or failed.
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  gifArgs,
  joinArgs,
  parseScenes,
  sceneReport,
  scenesArgs,
  speedArgs,
  trimArgs,
} from "./commands.mjs";
import { checkOutput, checkPath, ffmpeg, probe } from "./ffwrap.mjs";
import { capLines, isEntry, parseArgs } from "./_lib.mjs";

const STRINGS = ["in", "out", "from", "to", "factor", "width", "fps", "threshold"];

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
  else throw new Error(`Unknown command "${command}". Have: trim, join, speed, gif, scenes.`);
  ffmpeg(args);
  const after = probe(out);
  return [
    `Wrote ${path.basename(out)}: ${Math.round(after.seconds * 100) / 100} s, ${after.width}x${after.height}${after.audio ? ", with sound" : ""}.`,
  ];
}

function main() {
  try {
    const { flags, positional } = parseArgs(process.argv.slice(2), {
      booleans: ["best", "force"],
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
