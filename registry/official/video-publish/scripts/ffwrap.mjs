// What every video-edit command shares: a guard for file names, the ffmpeg input options, the encoding
// defaults and a probe. Pure helpers plus one wrapper around run.mjs (ffmpeg and ffprobe only, no shell).
import { existsSync } from "node:fs";
import path from "node:path";
import { run } from "./run.mjs";

const EXT_IN = /\.(mp4|mov|mkv|webm|m4v|wav|mp3|m4a|aac|flac|ogg|gif)$/i;
const EXT_OUT = /\.(mp4|mov|mkv|webm|gif|wav|m4a|json)$/i;

/**
 * A file name that is safe to hand to ffmpeg. ffmpeg reads URLs and pseudo-files ("concat:", "http:", "pipe:",
 * "lavfi") from the same place as paths, and an option from a name that starts with "-", so both are refused.
 * Windows drive letters ("C:\\") are paths and stay allowed.
 */
export function checkPath(p, what = "file", { output = false } = {}) {
  if (typeof p !== "string" || !p)
    throw new Error(`Give ${what} (--${what === "input" ? "in" : "out"} <file>).`);
  if (p.startsWith("-"))
    throw new Error(`Refused ${what} "${p.slice(0, 30)}": a name cannot start with "-".`);
  if (/^[A-Za-z][A-Za-z0-9+.-]+:/.test(p) && !/^[A-Za-z]:[\\/]/.test(p))
    throw new Error(
      `Refused ${what} "${p.slice(0, 30)}": URLs and ffmpeg pseudo-files are not files.`,
    );
  if (p.includes("\0") || /[\r\n]/.test(p))
    throw new Error(`Refused ${what}: the name has control characters.`);
  if (!(output ? EXT_OUT : EXT_IN).test(p))
    throw new Error(
      `Refused ${what} "${path.basename(p)}": use ${output ? "mp4, mov, mkv, webm, gif, wav, m4a or json" : "a video or audio file"}.`,
    );
  return path.resolve(p);
}

/**
 * A small side file (a LUT, a marks list, a words list): the same name guards as any file, plus an extension
 * check and a check that it exists. Returns the absolute path.
 */
export function checkSidecar(p, ext, what, hint) {
  checkPath(String(p).replace(ext, ".mp4"), what);
  if (!ext.test(String(p))) throw new Error(`${what} must be a ${hint} file.`);
  const abs = path.resolve(p);
  if (!existsSync(abs)) throw new Error(`${what} file ${path.basename(abs)} does not exist.`);
  return abs;
}
export const checkLut = (p) => checkSidecar(p, /\.(cube|3dl)$/i, "LUT", ".cube or .3dl");
export const checkJson = (p, what = "JSON") => checkSidecar(p, /\.json$/i, what, ".json");

/** An output may not be the input, and an existing file is only replaced with --force. */
export function checkOutput(out, input, force) {
  const o = checkPath(out, "output", { output: true });
  if (input && path.resolve(input) === o)
    throw new Error("The output is the input; choose another name so the original stays.");
  if (existsSync(o) && !force)
    throw new Error(`${path.basename(o)} already exists; use --force to replace it.`);
  return o;
}

/** Input options for one file: only the file protocol may be read. */
export const input = (file) => ["-protocol_whitelist", "file", "-i", file];

export const head = (level = "error") => ["-hide_banner", "-nostats", "-v", level];

/** Encoding defaults: H.264, yuv420p, AAC 48 kHz, fast start, bit-exact (the same input gives the same file). */
export function encode({ best = false, audio = true } = {}) {
  const a =
    audio === "copy"
      ? ["-c:a", "copy"]
      : audio
        ? ["-c:a", "aac", "-b:a", "192k", "-ar", "48000"]
        : ["-an"];
  return [
    "-c:v",
    "libx264",
    "-preset",
    best ? "slow" : "veryfast",
    "-crf",
    best ? "16" : "20",
    "-pix_fmt",
    "yuv420p",
    ...a,
    "-movflags",
    "+faststart",
    "-fflags",
    "+bitexact",
    "-flags:v",
    "+bitexact",
    "-flags:a",
    "+bitexact",
  ];
}

const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);

/** Facts about a media file from ffprobe: { width, height, fps, seconds, audio, hasVideo }. */
export function probe(file, runner = run) {
  const r = runner("ffprobe", [
    "-v",
    "error",
    "-show_streams",
    "-show_format",
    "-of",
    "json",
    file,
  ]);
  if (r.error || r.status !== 0)
    throw new Error(
      `ffprobe could not read ${path.basename(file)}: ${String(r.stderr).slice(0, 100)}`,
    );
  const j = JSON.parse(r.stdout);
  const v = j.streams.find((s) => s.codec_type === "video");
  const [n, d] = String(v?.r_frame_rate ?? "0/1")
    .split("/")
    .map(Number);
  return {
    hasVideo: Boolean(v),
    width: v?.width ?? 0,
    height: v?.height ?? 0,
    fps: d ? n / d : n,
    seconds: num(j.format.duration),
    audio: j.streams.some((s) => s.codec_type === "audio"),
  };
}

/** Run ffmpeg with the standard head (`level` "info" when a filter prints its result in the log, as loudnorm does). Throws with the tail of ffmpeg's message when it fails. */
export function ffmpeg(args, { level = "error", ...opts } = {}) {
  const r = run("ffmpeg", [...head(level), ...args], { timeoutMs: 1_800_000, ...opts });
  if (r.error) throw new Error(`ffmpeg could not start: ${r.error.message}`);
  if (r.status !== 0)
    throw new Error(
      `ffmpeg failed: ${r.stderr.trim().split("\n").slice(-3).join(" | ").slice(0, 300)}`,
    );
  return r;
}
