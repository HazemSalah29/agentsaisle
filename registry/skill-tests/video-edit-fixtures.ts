import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

/** An ffmpeg that can write H.264, from PATH or ~/bin, or undefined (the tests that need it are skipped). */
export const FF = [process.env.FFMPEG, "ffmpeg", path.join(os.homedir(), "bin", "ffmpeg")].find(
  (p) => p && spawnSync(p, ["-version"]).status === 0,
);
export const haveFF =
  Boolean(FF) &&
  spawnSync(FF!, ["-hide_banner", "-encoders"], { encoding: "utf8" }).stdout.includes("libx264");
/** PATH with the folder of that ffmpeg first, for child processes. */
export const ffPath = FF
  ? `${path.dirname(path.resolve(FF === "ffmpeg" ? "/usr/bin/ffmpeg" : FF))}${path.delimiter}${process.env.PATH}`
  : (process.env.PATH ?? "");

export const tmp = (name = "edit") => mkdtempSync(path.join(os.tmpdir(), `video-${name}-`));

export type Segment = { color: string; seconds: number; tone?: number | null };

/**
 * A small test video made of flat colour segments (320x180, 30 fps) with a sine tone per segment, or silence when
 * `tone` is null; `audio: false` makes a silent-less file with no audio track at all.
 */
export function makeClip(
  file: string,
  segments: Segment[],
  { audio = true, size = "320x180" } = {},
) {
  // Without ffmpeg the tests that read the clip are skipped, but some suites build their fixtures while collecting
  // (and the publish gate tests only need the file to exist): leave a placeholder instead of crashing.
  if (!FF) {
    writeFileSync(file, "placeholder: no ffmpeg");
    return file;
  }
  const inputs: string[] = [];
  const parts: string[] = [];
  segments.forEach((s) => {
    inputs.push("-f", "lavfi", "-i", `color=c=${s.color}:s=${size}:r=30:d=${s.seconds}`);
    if (audio) {
      const src =
        s.tone === null
          ? `anullsrc=r=48000:cl=mono:d=${s.seconds}`
          : `sine=frequency=${s.tone ?? 440}:sample_rate=48000:duration=${s.seconds}`;
      inputs.push("-f", "lavfi", "-i", src);
    }
  });
  const n = segments.length;
  const labels = segments
    .map((_, i) => (audio ? `[${2 * i}:v][${2 * i + 1}:a]` : `[${i}:v]`))
    .join("");
  parts.push(`${labels}concat=n=${n}:v=1:a=${audio ? 1 : 0}[v]${audio ? "[a]" : ""}`);
  const r = spawnSync(
    FF!,
    [
      "-y",
      "-loglevel",
      "error",
      ...inputs,
      "-filter_complex",
      parts.join(";"),
      "-map",
      "[v]",
      ...(audio ? ["-map", "[a]"] : []),
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-r",
      "30",
      ...(audio ? ["-c:a", "aac", "-ar", "48000"] : []),
      file,
    ],
    { encoding: "utf8" },
  );
  if (r.status !== 0) throw new Error(`fixture: ${r.stderr}`);
  return file;
}

/** Duration of a media file in seconds, by ffprobe. */
export function seconds(file: string) {
  const r = spawnSync(
    FF!.replace(/ffmpeg$/, "ffprobe"),
    ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", file],
    { encoding: "utf8" },
  );
  return Number(r.stdout);
}
