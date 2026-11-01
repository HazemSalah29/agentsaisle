// The edit commands as pure functions: each takes options and what was probed and returns ffmpeg arguments
// (an array of strings, never a shell string) or a plan. Nothing here starts a program or touches the disk.
import { encode, input } from "./ffwrap.mjs";

const num = (v, name) => {
  const n = Number(v);
  if (v === undefined || v === "" || !Number.isFinite(n))
    throw new Error(`--${name} must be a number.`);
  return n;
};
const r3 = (n) => Math.round(n * 1000) / 1000;

/** trim: keep from `from` to `to` seconds (re-encoded, so the cut is exact, not on a key frame). */
export function trimArgs({ file, out, from = 0, to, best }, info) {
  const a = num(from, "from");
  const b = to === undefined ? info.seconds : num(to, "to");
  if (a < 0 || b <= a) throw new Error("--to must be after --from, and --from at least 0.");
  if (b > info.seconds + 0.05)
    throw new Error(`--to ${b} is past the end (${r3(info.seconds)} s).`);
  return [
    ...input(file),
    "-ss",
    String(a),
    "-to",
    String(b),
    ...encode({ best, audio: info.audio }),
    "-y",
    out,
  ];
}

/** speed: a factor from 0.25 to 4; audio is kept in pitch with a chain of atempo filters (each 0.5 to 2). */
export function atempoChain(f) {
  const out = [];
  let left = f;
  while (left > 2) {
    out.push(2);
    left /= 2;
  }
  while (left < 0.5) {
    out.push(0.5);
    left /= 0.5;
  }
  out.push(r3(left));
  return out.map((x) => `atempo=${x}`).join(",");
}
export function speedArgs({ file, out, factor, best }, info) {
  const f = num(factor, "factor");
  if (f < 0.25 || f > 4) throw new Error("--factor must be from 0.25 to 4.");
  const v = `[0:v]setpts=PTS/${r3(f)}[v]`;
  const g = info.audio ? `;[0:a]${atempoChain(f)}[a]` : "";
  return [
    ...input(file),
    "-filter_complex",
    v + g,
    "-map",
    "[v]",
    ...(info.audio ? ["-map", "[a]"] : []),
    ...encode({ best, audio: info.audio }),
    "-y",
    out,
  ];
}

/**
 * join: several clips one after the other, scaled and padded to the first clip's size and frame rate. Either all
 * clips have sound or none do (a silent clip would need made-up silence; say so instead).
 */
export function joinArgs({ files, out, best }, infos) {
  if (files.length < 2) throw new Error("--in needs at least two files, separated by commas.");
  const sound = infos.map((i) => i.audio);
  if (sound.some(Boolean) && !sound.every(Boolean))
    throw new Error("Some clips have sound and some do not; add or remove the sound first.");
  const { width: w, height: h } = infos[0];
  const fps = Math.round(infos[0].fps * 100) / 100 || 30;
  const parts = files.map(
    (_, i) =>
      `[${i}:v]scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${fps}[v${i}]` +
      (sound[i] ? `;[${i}:a]aresample=48000[a${i}]` : ""),
  );
  const labels = files.map((_, i) => `[v${i}]` + (sound[0] ? `[a${i}]` : "")).join("");
  const concat = `${labels}concat=n=${files.length}:v=1:a=${sound[0] ? 1 : 0}[v]${sound[0] ? "[a]" : ""}`;
  return [
    ...files.flatMap((f) => input(f)),
    "-filter_complex",
    `${parts.join(";")};${concat}`,
    "-map",
    "[v]",
    ...(sound[0] ? ["-map", "[a]"] : []),
    ...encode({ best, audio: sound[0] }),
    "-y",
    out,
  ];
}

/** gif: from `from` for at most 15 s, width up to 720, 5 to 20 frames a second, one palette for the whole clip. */
export function gifArgs({ file, out, from = 0, to, width = 480, fps = 12 }, info) {
  const a = num(from, "from");
  const b = Math.min(to === undefined ? a + 8 : num(to, "to"), info.seconds);
  const wd = num(width, "width");
  const fr = num(fps, "fps");
  if (b <= a) throw new Error("--to must be after --from.");
  if (b - a > 15) throw new Error("A gif is at most 15 seconds; shorten --from to --to.");
  if (wd < 64 || wd > 720) throw new Error("--width must be from 64 to 720.");
  if (fr < 5 || fr > 20) throw new Error("--fps must be from 5 to 20.");
  const vf = `fps=${fr},scale=${wd}:-1:flags=lanczos,split[s0][s1];[s0]palettegen=stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=5`;
  return [
    ...input(file),
    "-ss",
    String(a),
    "-to",
    String(b),
    "-an",
    "-filter_complex",
    vf,
    "-loop",
    "0",
    "-fflags",
    "+bitexact",
    "-y",
    out,
  ];
}

/** scenes: the ffmpeg arguments that print the frames where the picture cuts (score at least `threshold`, 0 to 100). */
export function scenesArgs({ file, threshold = 10 }) {
  const t = num(threshold, "threshold");
  if (t < 1 || t > 60) throw new Error("--threshold must be from 1 to 60.");
  return [
    ...input(file),
    "-an",
    "-vf",
    `scdet=threshold=${t}:sc_pass=1,metadata=mode=print:file=-`,
    "-f",
    "null",
    "-",
  ];
}

/** Cut times in seconds from the printed metadata of scenes (one `pts_time` line per cut frame). */
export function parseScenes(text) {
  return [...text.matchAll(/^frame:\d+\s+pts:\S+\s+pts_time:([\d.]+)/gm)].map((m) =>
    r3(Number(m[1])),
  );
}

/** What `scenes` reports: cuts, the shots between them and their average length. */
export function sceneReport(cuts, seconds) {
  const edges = [0, ...cuts.filter((c) => c > 0 && c < seconds), seconds];
  const shots = edges.slice(1).map((e, i) => r3(e - edges[i]));
  return {
    seconds: r3(seconds),
    cuts: edges.length - 2,
    cutTimes: edges.slice(1, -1),
    shots,
    averageShotSeconds: shots.length ? r3(seconds / shots.length) : r3(seconds),
    cutsPerMinute: seconds ? r3(((edges.length - 2) / seconds) * 60) : 0,
  };
}
