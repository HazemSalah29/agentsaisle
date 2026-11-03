#!/usr/bin/env node
// Builds a kinetic video project from script.md (the user's words, one line per beat): each line becomes a `kinetic`
// scene (the spoken words pop in as they are said), with a layout, key words, an exit and the transition into it
// chosen by the preset. Writes video.json and brand/brand.json. Cards and flows appear only when a line has
// `card:` or `flow:` attributes the user wrote. Nothing is run or fetched.
// Usage: node plan.mjs --project projects/<slug> --preset volt|ember|ice [--title "..."] [--accent #rrggbb]
//        [--format reel-9x16] [--lang en] [--voice kokoro|3arab|test]
// Line attributes (indented under a [id] line): layout: stack|slab, emph: word,word, exit: slide|drop|blur|shatter|none,
//        transition: slash|shatter|whip|zoom-through|cut, card: Title|row;row=tag;row, flow: a>b>c
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { capLines, isEntry, parseArgs, skillDir } from "./_lib.mjs";
import { parseScript } from "./_script-parse.mjs";
import { planKinetic } from "./_plan.mjs";

function main() {
  try {
    const { flags } = parseArgs(process.argv.slice(2), {
      strings: ["project", "preset", "title", "accent", "format", "lang", "voice"],
    });
    if (!flags.project || !flags.preset)
      throw new Error("Usage: node plan.mjs --project projects/<slug> --preset volt|ember|ice");
    const presets = JSON.parse(
      readFileSync(path.join(skillDir(), "assets", "presets.json"), "utf8"),
    );
    const scriptFile = path.join(flags.project, "script.md");
    if (!existsSync(scriptFile))
      throw new Error(`${scriptFile} is missing: write the script first (references/script.md).`);
    const text = readFileSync(scriptFile, "utf8");
    const { lines, problems } = parseScript(text);
    const real = problems.filter((x) => !/^\s*#/.test(text.split(/\r?\n/)[x.line - 1] ?? ""));
    if (real.length) throw new Error(`script.md line ${real[0].line}: ${real[0].message}`);
    if (existsSync(path.join(flags.project, "video.json")))
      throw new Error(
        `${flags.project}/video.json exists; choose a new folder so nothing is overwritten.`,
      );
    const heading = /^#\s+(.+)$/m.exec(text)?.[1];
    const r = planKinetic(
      lines,
      {
        preset: flags.preset,
        title: flags.title ?? heading,
        accent: flags.accent,
        format: flags.format,
        lang: flags.lang,
        voice: flags.voice,
      },
      presets,
    );
    mkdirSync(path.join(flags.project, "brand"), { recursive: true });
    writeFileSync(
      path.join(flags.project, "brand", "brand.json"),
      `${JSON.stringify(r.brand, null, 2)}\n`,
    );
    writeFileSync(path.join(flags.project, "video.json"), `${JSON.stringify(r.video, null, 2)}\n`);
    console.log(
      capLines(
        [
          `Wrote ${flags.project}: ${r.summary.scenes} beats, ${r.summary.slabs} slab(s), ${r.summary.transitions} transitions, preset ${flags.preset}.`,
        ],
        "Next: voice, align, timing, then cues.mjs, check, render --draft, sync.mjs and the contact sheet (references/craft.md).",
      ),
    );
  } catch (e) {
    console.error(e.message);
    process.exit(2);
  }
}

if (isEntry(import.meta.url)) main();
