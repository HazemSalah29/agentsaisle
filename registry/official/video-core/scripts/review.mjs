#!/usr/bin/env node
// The review loop around a draft: stills at the moments that matter, the check written after every render, and an
// approval that is tied to the exact files it was given for. Nothing is uploaded; programs start through run.mjs.
//   node review.mjs stills <project> --at 1.2,5 | --words bots,block   frames from the newest draft (or --video f)
//   node review.mjs approve <project> [--note "..."]                    record that this draft is approved
//   node review.mjs status <project>                                    approved, stale, or not approved yet
// Exit: 0 ok, 1 refused (nothing approved, stale draft), 2 could not run.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { run } from "./run.mjs";
import { capLines, isEntry, isInside, parseArgs } from "./_lib.mjs";

const readJson = (f) => JSON.parse(readFileSync(f, "utf8"));
const sha = (buf) => createHash("sha256").update(buf).digest("hex");

/**
 * One hash for everything a render is made from: video.json, the script, the brand file, every voice file and
 * every asset the project lists. Any change to any of them changes it. Pure apart from reading files.
 */
export function projectHash(dir) {
  const h = createHash("sha256");
  const add = (label, rel) => {
    const f = path.join(dir, rel);
    h.update(`${label}:${rel}:`);
    if (existsSync(f) && statSync(f).isFile()) h.update(sha(readFileSync(f)));
    h.update("\n");
  };
  add("video", "video.json");
  const video = existsSync(path.join(dir, "video.json"))
    ? readJson(path.join(dir, "video.json"))
    : {};
  if (video.script) add("script", video.script);
  if (video.meta?.brand && isInside(video.meta.brand)) add("brand", video.meta.brand);
  const voice = path.join(dir, "voice");
  if (existsSync(voice))
    for (const f of readdirSync(voice).sort()) add("voice", path.join("voice", f));
  for (const a of video.assets ?? []) if (a?.path && isInside(a.path)) add("asset", a.path);
  return h.digest("hex");
}

/** "none" (no approval recorded), "current" (it matches the project now) or "stale" (the project changed since). */
export function approvalState(dir) {
  const f = path.join(dir, "approval.json");
  if (!existsSync(f)) return { state: "none" };
  let a;
  try {
    a = readJson(f);
  } catch {
    return { state: "stale", reason: "approval.json cannot be read" };
  }
  return a?.hash === projectHash(dir)
    ? { state: "current", approval: a }
    : { state: "stale", approval: a, reason: "the project changed after the draft was approved" };
}

/**
 * What a rendered file should be, against what it is. `probe`: { width, height, fps, seconds, frames, audio };
 * `expected`: { size: [w, h], fps, seconds, wantsAudio }. Returns [{ id, level: "pass" | "fail", text }].
 */
export function validateRender(probe, expected, { draft = false } = {}) {
  const out = [];
  const add = (id, ok, text) => out.push({ id, level: ok ? "pass" : "fail", text });
  const [w, h] = expected.size;
  add(
    "size",
    draft
      ? Math.abs(probe.width / probe.height - w / h) < 0.01
      : probe.width === w && probe.height === h,
    `${probe.width}x${probe.height}, expected ${draft ? "the same shape as " : ""}${w}x${h}`,
  );
  add(
    "fps",
    Math.abs(probe.fps - expected.fps) < 0.01,
    `${probe.fps} fps, expected ${expected.fps}`,
  );
  add(
    "duration",
    Math.abs(probe.seconds - expected.seconds) <= Math.max(0.1, 2 / expected.fps),
    `${probe.seconds.toFixed(2)} s, expected ${expected.seconds.toFixed(2)} s`,
  );
  if (Number.isFinite(probe.frames) && probe.frames > 0) {
    const want = Math.round(expected.seconds * expected.fps);
    add(
      "frames",
      Math.abs(probe.frames - want) <= 2,
      `${probe.frames} frames, expected about ${want}`,
    );
  }
  add(
    "audio",
    expected.wantsAudio ? probe.audio : true,
    probe.audio
      ? "has an audio track"
      : expected.wantsAudio
        ? "no audio track but the project has sound"
        : "no audio track (none expected)",
  );
  return out;
}

/** ffprobe summary of a media file: { width, height, fps, seconds, frames, audio }. Throws when it cannot read it. */
export function probeFile(file) {
  const r = run("ffprobe", ["-v", "error", "-show_streams", "-show_format", "-of", "json", file]);
  if (r.error || r.status !== 0) throw new Error(`ffprobe could not read ${file}`);
  const j = JSON.parse(r.stdout);
  const v = j.streams.find((s) => s.codec_type === "video");
  if (!v) throw new Error(`${file} has no video stream.`);
  const [n, d] = String(v.r_frame_rate).split("/").map(Number);
  return {
    width: v.width,
    height: v.height,
    fps: d ? n / d : n,
    seconds: Number(j.format.duration),
    frames: Number(v.nb_frames),
    audio: j.streams.some((s) => s.codec_type === "audio"),
  };
}

/** Write out/<name>.validation.json for a rendered file and return it. */
export function writeValidation({ dir, file, video, timing, draft, size }) {
  const probe = probeFile(file);
  const wantsAudio =
    Boolean(video.music?.asset) ||
    (video.voice?.provider && video.voice.provider !== "none") ||
    (video.sfx ?? []).length > 0;
  const checks = validateRender(
    probe,
    { size, fps: video.meta.fps, seconds: timing.totalSeconds, wantsAudio },
    { draft },
  );
  const report = {
    ok: checks.every((c) => c.level === "pass"),
    file: path.relative(dir, file),
    draft: Boolean(draft),
    inputHash: projectHash(dir),
    ...probe,
    checks,
  };
  writeFileSync(file.replace(/\.mp4$/, ".validation.json"), `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

/** Times (seconds in the film) of the first spoken match of each word, from voice/words.json and timing.json. */
export function wordTimes(dir, wanted) {
  const timing = readJson(path.join(dir, "timing.json"));
  const words = readJson(path.join(dir, "voice", "words.json"));
  const start = new Map();
  for (const s of timing.scenes) for (const l of s.lines) start.set(l.id, s.start + l.start);
  const flat = (words.lines ?? []).flatMap((l) =>
    (l.words ?? []).map((w) => ({
      key: String(w.text)
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, ""),
      t: (start.get(l.id) ?? 0) + Number(w.start),
    })),
  );
  return wanted.map((w) => {
    const key = w.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
    const hit = flat.find((x) => x.key === key);
    if (!hit) throw new Error(`The word "${w}" is not in voice/words.json (spoken words only).`);
    return Math.round((hit.t + 0.15) * 100) / 100; // a moment after it is said, when it has landed
  });
}

const newestDraft = (dir) => {
  const out = path.join(dir, "out");
  if (!existsSync(out)) return null;
  const files = readdirSync(out)
    .filter((f) => f.endsWith("-draft.mp4"))
    .map((f) => path.join(out, f))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  return files[0] ?? null;
};

function stills(dir, flags) {
  const file = flags.video ? path.resolve(flags.video) : newestDraft(dir);
  if (!file || !existsSync(file))
    throw new Error("No draft to take frames from. Render one: render.mjs <project> --draft");
  const times = flags.at
    ? String(flags.at).split(",").map(Number)
    : wordTimes(
        dir,
        String(flags.words ?? "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      );
  if (!times.length || times.length > 12 || times.some((t) => !Number.isFinite(t) || t < 0))
    throw new Error(
      "Give --at with 1 to 12 times in seconds (1.2,5) or --words with the spoken words.",
    );
  const outDir = path.join(dir, "qa", "stills");
  mkdirSync(outDir, { recursive: true });
  const made = times.map((t) => {
    const png = path.join(outDir, `t-${t.toFixed(2)}.png`);
    const r = run("ffmpeg", [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-ss",
      String(t),
      "-i",
      file,
      "-frames:v",
      "1",
      "-vf",
      "scale=360:-2",
      png,
    ]);
    if (r.status !== 0 || !existsSync(png)) throw new Error(`could not take a frame at ${t} s`);
    return png;
  });
  const cols = Math.min(4, made.length);
  const sheet = path.join(outDir, "sheet.png");
  const args = ["-hide_banner", "-loglevel", "error", "-y"];
  made.forEach((m) => args.push("-i", m));
  args.push(
    "-filter_complex",
    `${made.map((_, i) => `[${i}:v]`).join("")}xstack=inputs=${made.length}:layout=${made.map((_, i) => `${(i % cols) * 360}_${Math.floor(i / cols) * 640}`).join("|")}[v]`,
    "-map",
    "[v]",
    "-frames:v",
    "1",
    sheet,
  );
  const r = run("ffmpeg", args);
  return {
    times,
    sheet: r.status === 0 && existsSync(sheet) ? path.relative(dir, sheet) : null,
    files: made.map((m) => path.relative(dir, m)),
  };
}

function approve(dir, flags) {
  const draft = newestDraft(dir);
  if (!draft)
    throw new Error("There is no draft to approve. Render one first: render.mjs <project> --draft");
  const vfile = draft.replace(/\.mp4$/, ".validation.json");
  const v = existsSync(vfile) ? readJson(vfile) : null;
  const now = projectHash(dir);
  if (!v)
    throw new Error(
      "The draft has no validation.json (it was rendered by an older version). Render the draft again.",
    );
  if (v.inputHash !== now)
    return {
      refused:
        "The draft was rendered from an older version of the project. Render a new draft, look at it, then approve.",
    };
  if (!v.ok)
    return {
      refused: "The draft failed its own checks (see its validation.json). Fix and render again.",
    };
  const approval = {
    version: 1,
    hash: now,
    draft: path.relative(dir, draft),
    draftSha256: sha(readFileSync(draft)),
    at: new Date().toISOString(),
    note: typeof flags.note === "string" ? flags.note.slice(0, 200) : "",
  };
  writeFileSync(path.join(dir, "approval.json"), `${JSON.stringify(approval, null, 2)}\n`);
  return { approved: approval };
}

function main() {
  let parsed;
  try {
    parsed = parseArgs(process.argv.slice(2), { strings: ["at", "words", "video", "note"] });
  } catch (e) {
    console.error(e.message);
    process.exit(2);
  }
  const [cmd, target] = parsed.positional;
  if (!["stills", "approve", "status"].includes(cmd) || !target) {
    console.error(
      "Usage: node review.mjs stills|approve|status <project-dir> [--at 1,2 | --words a,b] [--note text]",
    );
    process.exit(2);
  }
  const dir = path.resolve(target);
  if (!existsSync(path.join(dir, "video.json"))) {
    console.error(`No video.json in ${dir}.`);
    process.exit(2);
  }
  try {
    if (cmd === "stills") {
      const r = stills(dir, parsed.flags);
      console.log(
        capLines(
          [
            `Frames at ${r.times.join(", ")} s: ${r.files.join(", ")}`,
            r.sheet
              ? `Sheet: ${r.sheet} (look at it once)`
              : "No sheet could be made; open the frames.",
          ],
          "",
        ),
      );
    } else if (cmd === "approve") {
      const r = approve(dir, parsed.flags);
      if (r.refused) {
        console.error(r.refused);
        process.exit(1);
      }
      console.log(
        `Approved ${r.approved.draft} at ${r.approved.at}. A change to the project from now on makes this approval stale.`,
      );
    } else {
      const s = approvalState(dir);
      console.log(
        s.state === "current"
          ? `Approved (${s.approval.draft}, ${s.approval.at}).`
          : s.state === "stale"
            ? `Stale: ${s.reason}. Render a new draft and approve again.`
            : "Not approved yet.",
      );
      process.exit(s.state === "stale" ? 1 : 0);
    }
  } catch (e) {
    console.error(e.message);
    process.exit(2);
  }
}

if (isEntry(import.meta.url)) main();
