#!/usr/bin/env node
// Voices every line of script.md: one WAV per line (voice/<id>.wav), a manifest with hashes, and a copy of the
// choice in video.json. Lines whose text, voice, speed and seed are unchanged are kept, so a re-run costs nothing.
// Never reads API keys; refuses cloning without recorded consent (and no provider here can clone yet).
// Usage: node voice.mjs <project-dir> [--provider kokoro|3arab|test] [--voice id] [--speed 1] [--seed 1]
//        [--only l1,l2] [--force] [--clone sample.wav --consent self|consent-file]
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PROVIDERS, UNBUILT, defaultProvider, wavSeconds } from "./providers.mjs";
import { parseScript } from "./script-parse.mjs";
import { capLines, isEntry, parseArgs } from "./_lib.mjs";

const DIGITS = /[0-9٠-٩۰-۹]/;
const sha = (data) => createHash("sha256").update(data).digest("hex");

/** Why a clone request is refused, or null when it may go ahead. No provider can clone yet, so it never is. */
export function cloneRefusal({ clone, consent }, exists = existsSync) {
  if (!clone) return null;
  if (!consent)
    return "Refused: cloning a voice needs consent. Pass --consent self (your own voice) or --consent <file> with the speaker's recorded consent. Public figures are never cloned.";
  if (consent !== "self" && !exists(consent))
    return `Refused: consent file "${consent}" does not exist.`;
  return "No voice provider in this version can clone a voice yet (providers: kokoro, 3arab, test).";
}

/** Plan and run the synthesis. `io` is injectable for tests: { readFile, exists, write, mkdir }. */
export function voiceProject({ dir, video, lines, opts, providers = PROVIDERS, io }) {
  const lang = video?.meta?.lang ?? "en";
  const id = opts.provider ?? video?.voice?.provider ?? defaultProvider(lang);
  if (UNBUILT.includes(id))
    throw new Error(
      `Provider "${id}" is not built yet (have: ${Object.keys(providers).join(", ")}).`,
    );
  if (id === "recorded")
    throw new Error(
      "This project uses a recorded voice. Cut a recording into lines with recorded.mjs; voice.mjs only makes synthetic voices.",
    );
  const provider = providers[id];
  if (!provider)
    throw new Error(`Unknown provider "${id}" (have: ${Object.keys(providers).join(", ")}).`);
  if (!provider.langs.includes("*") && !provider.langs.some((l) => lang.startsWith(l)))
    throw new Error(`Provider "${id}" speaks ${provider.langs.join(", ")}, not "${lang}".`);
  const voice = opts.voice ?? video?.voice?.voiceId ?? provider.defaultVoice;
  const speed = opts.speed ?? video?.voice?.speed ?? 1;
  const seed = opts.seed ?? 1;
  const only = opts.only ? new Set(opts.only) : null;
  if (lang.startsWith("ar")) {
    const bad = lines.filter((l) => DIGITS.test(l.text)).map((l) => l.id);
    if (bad.length)
      throw new Error(
        `Arabic lines with digits (${bad.join(", ")}): write numbers as words, then run again.`,
      );
  }
  const manifestFile = path.join(dir, "voice", "manifest.json");
  const old = io.exists(manifestFile) ? JSON.parse(io.readFile(manifestFile)) : { lines: {} };
  const manifest = {
    version: 1,
    provider: id,
    voice,
    speed,
    seed,
    model: old.model ?? "",
    license: provider.license,
    lines: {},
  };
  const done = [];
  const kept = [];
  io.mkdir(path.join(dir, "voice"));
  for (const l of lines) {
    const file = `voice/${l.id}.wav`;
    const key = sha(JSON.stringify([id, voice, speed, seed, l.text]));
    const before = old.lines?.[l.id];
    const skip =
      (only && !only.has(l.id)) ||
      (!opts.force && before?.key === key && io.exists(path.join(dir, file)));
    if (skip) {
      if (before) manifest.lines[l.id] = before;
      kept.push(l.id);
      continue;
    }
    const out = path.join(dir, file);
    const r = provider.synthesize({
      text: l.text,
      voice,
      speed,
      seed,
      lang,
      out,
      write: io.write,
      run: io.run,
    });
    manifest.model = r.model;
    const bytes = io.readBinary(out);
    manifest.lines[l.id] = {
      file,
      key,
      sha256: sha(bytes),
      seconds: Math.round((wavSeconds(bytes) ?? 0) * 1000) / 1000,
    };
    done.push(l.id);
  }
  io.write(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
  return { manifest, done, kept };
}

function main() {
  let parsed;
  try {
    parsed = parseArgs(process.argv.slice(2), {
      booleans: ["force"],
      strings: ["provider", "voice", "speed", "seed", "only", "clone", "consent"],
    });
  } catch (e) {
    console.error(e.message);
    process.exit(2);
  }
  const { flags, positional } = parsed;
  const refusal = cloneRefusal(flags);
  if (refusal) {
    console.error(refusal);
    process.exit(1);
  }
  if (!positional[0]) {
    console.error(
      "Usage: node voice.mjs <project-dir> [--provider kokoro|3arab|test] [--voice id] [--speed 1] [--seed 1] [--only l1,l2] [--force]",
    );
    process.exit(2);
  }
  const dir = path.resolve(positional[0]);
  const sfile = path.join(dir, "script.md");
  if (!existsSync(sfile)) {
    console.error(`No script.md in ${dir}.`);
    process.exit(2);
  }
  const vfile = path.join(dir, "video.json");
  const video = existsSync(vfile) ? JSON.parse(readFileSync(vfile, "utf8")) : null;
  const { lines, problems } = parseScript(readFileSync(sfile, "utf8"));
  if (problems.length || !lines.length) {
    console.error(
      capLines(
        problems.map((p) => `script.md:${p.line}  ${p.message}`),
        "script.md is not valid; run the writer check first.",
      ),
    );
    process.exit(1);
  }
  const num = (v, name) => {
    if (v === undefined) return undefined;
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0) {
      console.error(`--${name} must be a positive number.`);
      process.exit(2);
    }
    return n;
  };
  const io = {
    readFile: (f) => readFileSync(f, "utf8"),
    readBinary: (f) => readFileSync(f),
    exists: existsSync,
    mkdir: (d) => mkdirSync(d, { recursive: true }),
    write: (f, data) => writeFileSync(f, data),
  };
  let result;
  try {
    result = voiceProject({
      dir,
      video,
      lines,
      io,
      opts: {
        provider: flags.provider,
        voice: flags.voice,
        speed: num(flags.speed, "speed"),
        seed: num(flags.seed, "seed"),
        only: flags.only
          ?.split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        force: flags.force,
      },
    });
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
  const { manifest, done, kept } = result;
  if (video) {
    video.voice = {
      ...video.voice,
      provider: manifest.provider,
      voiceId: manifest.voice.slice(0, 80),
      speed: manifest.speed,
    };
    writeFileSync(vfile, `${JSON.stringify(video, null, 2)}\n`);
  }
  const total = Object.values(manifest.lines).reduce((s, l) => s + l.seconds, 0);
  console.log(
    capLines(
      [
        ...done.map((id) => `+ ${id}  ${manifest.lines[id].seconds}s`),
        ...kept.map((id) => `= ${id} (kept)`),
      ],
      `Voiced ${done.length} line(s), kept ${kept.length}: ${manifest.provider}/${manifest.voice.slice(0, 30)}, ${total.toFixed(1)}s of audio.${manifest.provider === "test" ? "\nThe test provider makes a tone, not speech." : ""}\nNext: node <video-core>/scripts/timing.mjs ${dir}`,
    ),
  );
}

if (isEntry(import.meta.url)) main();
