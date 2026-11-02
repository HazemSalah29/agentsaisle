#!/usr/bin/env node
// Builds a product edit project from the user's own photos: cuts each product out (cutout.mjs), copies the photos and
// cutouts into the project, writes the original sound effects, finds the beats of the user's music if given, and
// writes video.json (shot scenes with camera moves, type, effects and sound cues) and brand/brand.json (an accent
// taken from the product). Nothing is fetched or uploaded. The user must confirm the photos (and music) are theirs
// to use with --own-photos; the licence of the music is recorded in the credits.
// With --screens the photos are screenshots of an app or website: each goes on a card over a styled background.
// Usage: node plan.mjs --project projects/<slug> --photos a.jpg|b.jpg|c.jpg --preset snap|glide|glitch --product "Name"
//        [--lines "line one|line two"] [--cta "Shop now"] [--price "$18"] [--seconds 15] [--accent #e8542a]
//        [--music track.mp3 --music-licence "own"] [--recipe recipe.json] [--format reel-9x16] --own-photos
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyse } from "./_beats.mjs";
import { planEdit } from "./_plan.mjs";
import { NAMES, synth, wav } from "./_synth.mjs";
import { imageProblems } from "./cutout.mjs";
import { capLines, isEntry, parseArgs, skillDir } from "./_lib.mjs";
import { run } from "./run.mjs";

const split = (v) =>
  v
    ? String(v)
        .split("|")
        .map((x) => x.trim())
        .filter(Boolean)
    : [];
const AUDIO = /\.(mp3|wav|m4a|aac|ogg|flac)$/i;

/** Beat times of a music file, found with ffmpeg and the pure analysis in _beats.mjs. */
function beatsOf(file) {
  const dir = mkdtempSync(path.join(os.tmpdir(), "aisle-product-"));
  const raw = path.join(dir, "pcm.f32");
  try {
    const r = run("ffmpeg", [
      "-v",
      "error",
      "-y",
      "-i",
      path.resolve(file),
      "-t",
      "180",
      "-vn",
      "-ac",
      "1",
      "-ar",
      "22050",
      "-f",
      "f32le",
      raw,
    ]);
    if (r.status !== 0)
      throw new Error(`ffmpeg could not read the music: ${String(r.stderr).trim().slice(0, 160)}`);
    const buf = readFileSync(raw);
    const samples = new Float32Array(buf.buffer, buf.byteOffset, Math.floor(buf.length / 4));
    return analyse(samples, 22050);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function main() {
  try {
    const { flags } = parseArgs(process.argv.slice(2), {
      strings: [
        "project",
        "photos",
        "preset",
        "product",
        "lines",
        "cta",
        "price",
        "seconds",
        "accent",
        "music",
        "music-licence",
        "recipe",
        "format",
      ],
      booleans: ["own-photos", "screens"],
    });
    if (!flags.project || !flags.photos || !flags.preset || !flags.product)
      throw new Error(
        'Usage: node plan.mjs --project projects/<slug> --photos a.jpg|b.jpg --preset snap|glide|glitch --product "Name" --own-photos',
      );
    if (!flags["own-photos"])
      throw new Error(
        "Confirm with the user that the photos (and any music) are theirs to use, then run again with --own-photos.",
      );
    const presets = JSON.parse(
      readFileSync(path.join(skillDir(), "assets", "presets.json"), "utf8"),
    );
    const photoFiles = split(flags.photos);
    for (const f of photoFiles) {
      const bad = imageProblems(f);
      if (bad.length) throw new Error(bad[0]);
    }
    if (flags.music && !AUDIO.test(flags.music))
      throw new Error("--music: an mp3, wav, m4a, aac, ogg or flac file");
    if (flags.music && !flags["music-licence"])
      throw new Error(
        '--music-licence: say why the track may be used (for example "own" or "CC BY 4.0, <author>")',
      );

    if (existsSync(path.join(flags.project, "video.json")))
      throw new Error(
        `${flags.project}/video.json exists; choose a new folder so nothing is overwritten.`,
      );
    const project = path.resolve(flags.project);
    mkdirSync(path.join(project, "assets"), { recursive: true });
    mkdirSync(path.join(project, "brand"), { recursive: true });
    mkdirSync(path.join(project, "audio"), { recursive: true });
    const notes = [];
    const assets = [];
    const photos = [];
    let accent = flags.accent;
    photoFiles.forEach((file, k) => {
      const id = `p${k + 1}`;
      const ext = path.extname(file).toLowerCase().replace(".jpeg", ".jpg");
      copyFileSync(file, path.join(project, "assets", `${id}${ext}`));
      assets.push({
        id,
        path: `assets/${id}${ext}`,
        kind: "image",
        source: "user",
        licence: "own",
      });
      const out = path.join(project, "assets", `${id}-cut`);
      // Screenshots are not cut out: each goes on a card over a styled background, as two layers.
      const r = flags.screens
        ? run(
            "node",
            [
              path.join(skillDir(), "scripts", "compose.mjs"),
              path.resolve(file),
              "--out",
              out,
              "--format",
              flags.format ?? "reel-9x16",
              "--accent",
              flags.accent ?? "#e8542a",
            ],
            { timeoutMs: 120_000 },
          )
        : run(
            "node",
            [path.join(skillDir(), "scripts", "cutout.mjs"), path.resolve(file), "--out", out],
            { timeoutMs: 240_000 },
          );
      let layers = "photo";
      if (flags.screens && r.status === 0 && existsSync(path.join(out, "subject.png"))) {
        copyFileSync(path.join(out, "photo.jpg"), path.join(project, "assets", `${id}.jpg`));
        assets[assets.length - 1].path = `assets/${id}.jpg`;
        copyFileSync(
          path.join(out, "subject.png"),
          path.join(project, "assets", `${id}-subject.png`),
        );
        copyFileSync(path.join(out, "bg.jpg"), path.join(project, "assets", `${id}-bg.jpg`));
        assets.push(
          {
            id: `${id}-subject`,
            path: `assets/${id}-subject.png`,
            kind: "image",
            source: "user",
            licence: "own",
          },
          {
            id: `${id}-bg`,
            path: `assets/${id}-bg.jpg`,
            kind: "image",
            source: "user",
            licence: "own",
          },
        );
        layers = "cutout";
      } else if (r.status === 0 && existsSync(path.join(out, "cutout.json"))) {
        const report = JSON.parse(readFileSync(path.join(out, "cutout.json"), "utf8"));
        if (report.ok) {
          copyFileSync(
            path.join(out, "subject.png"),
            path.join(project, "assets", `${id}-subject.png`),
          );
          copyFileSync(path.join(out, "bg.jpg"), path.join(project, "assets", `${id}-bg.jpg`));
          assets.push(
            {
              id: `${id}-subject`,
              path: `assets/${id}-subject.png`,
              kind: "image",
              source: "user",
              licence: "own",
            },
            {
              id: `${id}-bg`,
              path: `assets/${id}-bg.jpg`,
              kind: "image",
              source: "user",
              licence: "own",
            },
          );
          layers = "cutout";
          if (k === 0 && !accent && report.accent) accent = report.accent;
        } else
          notes.push(
            `photo ${k + 1}: no clean cutout (${report.reasons.join("; ")}); it is used as a single layer. A plain-background photo or a cutout PNG would give depth.`,
          );
      } else
        notes.push(
          `photo ${k + 1}: cutout failed (${String(r.stderr).trim().slice(0, 120)}); used as a single layer.`,
        );
      rmSync(out, { recursive: true, force: true });
      photos.push({ id, layers });
    });

    let beats;
    let music;
    if (flags.music) {
      const ext = path.extname(flags.music).toLowerCase();
      copyFileSync(flags.music, path.join(project, "audio", `music${ext}`));
      assets.push({
        id: "music",
        path: `audio/music${ext}`,
        kind: "audio",
        source: "user",
        licence: String(flags["music-licence"]).slice(0, 80),
      });
      music = `audio/music${ext}`;
      const b = beatsOf(flags.music);
      beats = b.beats?.length ? b.beats : b.onsets;
      notes.push(
        b.bpm
          ? `music tempo ${b.bpm} bpm; cuts snap to the beats`
          : "music has no steady tempo; cuts snap to its onsets, check them by ear",
      );
    }
    const recipe = flags.recipe ? JSON.parse(readFileSync(flags.recipe, "utf8")) : undefined;
    const result = planEdit(
      {
        product: flags.product,
        lines: split(flags.lines),
        cta: flags.cta,
        price: flags.price,
        photos,
        preset: flags.preset,
        seconds: flags.seconds === undefined ? undefined : Number(flags.seconds),
        accent,
        screens: Boolean(flags.screens),
        format: flags.format,
        beats,
        recipe: recipe
          ? {
              averageShotSeconds: recipe.pace?.averageShotSeconds,
              hookSeconds: recipe.pace?.hookSeconds,
              tempo: recipe.tempo,
            }
          : undefined,
      },
      presets,
    );
    result.video.assets = assets;
    if (music) result.video.music = { asset: music };
    for (const n of result.sfxNames)
      if (NAMES.includes(n)) writeFileSync(path.join(project, "audio", `${n}.wav`), wav(synth(n)));
    writeFileSync(
      path.join(project, "brand", "brand.json"),
      `${JSON.stringify(result.brand, null, 2)}\n`,
    );
    writeFileSync(path.join(project, "video.json"), `${JSON.stringify(result.video, null, 2)}\n`);
    const s = result.summary;
    console.log(
      capLines(
        [
          `Wrote ${flags.project}: ${s.shots} shots, ${s.seconds} s, preset ${flags.preset}, ${s.sfx} sound effects${s.snapped ? ", cuts on the beat" : ""}.`,
          ...notes,
        ],
        "Next: check.mjs, render.mjs --draft, look at the contact sheet (references/craft.md), fix, then render and qa.",
      ),
    );
  } catch (e) {
    console.error(e.message);
    process.exit(2);
  }
}

if (isEntry(import.meta.url)) main();
