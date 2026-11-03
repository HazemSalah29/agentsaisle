#!/usr/bin/env node
// Turns a capture's interaction log into the edited recording and the `screen` scene: cuts waiting, speeds up
// typing, and writes the camera, cursor and click ripples (see _plan.mjs). Reads the log as data; runs only ffmpeg.
// Usage: node plan.mjs --log <interaction-log.json> [--video <capture.webm> --out <edited.mp4> [--force]]
//          [--into <video.json> --scene <id> [--asset <id>] [--device phone|laptop|browser|none] [--title <text>]]
//          [--max-idle 1.2] [--type-speed 3]
// Without --video it only plans and prints. Exit: 0 done, 2 refused or failed.
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DEFAULTS, filterFor, planShowcase } from "./_plan.mjs";
import { capLines, isEntry, isInside, parseArgs } from "./_lib.mjs";
import { checkOutput, checkPath, encode, ffmpeg, input } from "./ffwrap.mjs";

const num = (v, name, lo, hi) => {
  const n = Number(v);
  if (!(n >= lo && n <= hi)) throw new Error(`--${name} must be ${lo} to ${hi}.`);
  return n;
};

export function execute(argv) {
  const { flags } = parseArgs(argv, {
    booleans: ["force"],
    strings: [
      "log",
      "video",
      "out",
      "into",
      "scene",
      "asset",
      "device",
      "title",
      "max-idle",
      "type-speed",
    ],
  });
  if (!flags.log) throw new Error("Give the interaction log (--log <file>).");
  const log = JSON.parse(readFileSync(path.resolve(flags.log), "utf8"));
  const opts = {};
  if (flags["max-idle"]) opts.maxIdle = num(flags["max-idle"], "max-idle", 0.3, 10);
  if (flags["type-speed"]) opts.typeSpeed = num(flags["type-speed"], "type-speed", 1, 8);
  const plan = planShowcase(log, { ...DEFAULTS, ...opts });
  const lines = [
    `film ${plan.seconds}s from a ${log.duration}s recording (${plan.segments.length} parts kept)`,
    `camera moves ${plan.props.zoom.length}, cursor points ${plan.props.cursor.length}, clicks ${plan.props.ripples.length}`,
  ];
  const ids = Object.entries(plan.says);
  if (ids.length) lines.push(`narration starts: ${ids.map(([k, v]) => `${k} ${v}s`).join(", ")}`);

  let outFile = null;
  if (flags.video) {
    const inFile = checkPath(flags.video, "input");
    outFile = checkOutput(flags.out, inFile, flags.force);
    if (!/\.mp4$/i.test(outFile)) throw new Error("The edited recording must be an .mp4 file.");
    if (!existsSync(inFile)) throw new Error(`${path.basename(inFile)} does not exist.`);
    try {
      ffmpeg([
        ...input(inFile),
        "-filter_complex",
        filterFor(plan.segments),
        "-map",
        "[v]",
        ...encode({ audio: false }),
        "-y",
        outFile,
      ]);
    } catch (e) {
      rmSync(outFile, { force: true }); // never leave a half-written file
      throw e;
    }
    lines.push(`wrote ${path.basename(outFile)}`);
  }

  if (flags.into) {
    if (!flags.scene) throw new Error("Give the scene id (--scene <id>).");
    const file = path.resolve(flags.into);
    const dir = path.dirname(file);
    const video = JSON.parse(readFileSync(file, "utf8"));
    const assetId = flags.asset ?? "screen-rec";
    video.assets ??= [];
    if (outFile) {
      const rel = path.relative(dir, outFile).split(path.sep).join("/");
      if (!isInside(rel))
        throw new Error("The edited recording must be inside the project folder.");
      const entry = {
        id: assetId,
        path: rel,
        source: "user",
        licence: log.rights ?? "own work (recorded from the owner's own app)",
      };
      const k = video.assets.findIndex((a) => a.id === assetId);
      if (k >= 0) video.assets[k] = { ...video.assets[k], ...entry };
      else video.assets.push(entry);
    } else if (!video.assets.some((a) => a.id === assetId))
      throw new Error(
        `Asset "${assetId}" is not in the project; pass --video and --out to add it.`,
      );
    video.scenes ??= [];
    const old = video.scenes.find((s) => s.id === flags.scene);
    const props = {
      ...(old?.props ?? {}),
      asset: assetId,
      device: flags.device ?? old?.props?.device ?? "browser",
      ...plan.props,
    };
    if (flags.title) props.title = flags.title;
    const scene = {
      ...(old ?? { id: flags.scene, kind: "screen", transitionIn: "cut" }),
      durationFrom: "fixed",
      seconds: plan.seconds,
      props,
    };
    if (old) video.scenes[video.scenes.indexOf(old)] = scene;
    else video.scenes.push(scene);
    writeFileSync(file, `${JSON.stringify(video, null, 2)}\n`);
    lines.push(`updated scene "${flags.scene}" in ${path.basename(file)}`);
  }
  return lines;
}

function main() {
  try {
    console.log(
      capLines(execute(process.argv.slice(2)), "The original recording was not changed."),
    );
  } catch (e) {
    console.error(e.message);
    process.exit(2);
  }
}

if (isEntry(import.meta.url)) main();
