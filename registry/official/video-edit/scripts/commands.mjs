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

/** The loudness the library brings sound to. The same numbers as video-core/scripts/render.mjs (a test checks). */
export const LOUDNESS = Object.freeze({ lufs: -14, truePeak: -1.5, range: 11 }); // TODO(verify) per platform

const FILTER_SPECIAL = /([\\':,;[\]])/g;
/** A file path made safe inside an ffmpeg filter argument (backslash, colon, quote, comma, brackets, semicolon). */
export const filterPath = (p) => p.replace(/\\/g, "/").replace(FILTER_SPECIAL, "\\$1");

/**
 * The filter graph that turns the clip's sound (and optional music) into one stream labelled [mix] and the
 * ffmpeg inputs it needs. `music`: absolute path or null; `duck`: lower the music under speech.
 */
export function audioGraph({
  denoise = false,
  music = null,
  duck = false,
  musicDb = -18,
  seconds,
}) {
  const head = `[0:a]${denoise ? "afftdn=nr=12" : "anull"}`;
  if (!music) return { graph: `${head}[mix]`, inputs: [] };
  const bed = `[1:a]aloop=loop=-1:size=2147483647,atrim=0:${r3(seconds)},aresample=48000,volume=${musicDb}dB`;
  if (!duck)
    return {
      graph: `${head}[vo];${bed}[m];[vo][m]amix=inputs=2:normalize=0:dropout_transition=0[mix]`,
      inputs: [music],
    };
  return {
    graph: [
      `${head}[v0]`,
      "[v0]asplit=2[vo][sc]",
      `${bed}[m]`,
      "[m][sc]sidechaincompress=threshold=0.05:ratio=8:attack=20:release=400[duck]",
      "[duck][vo]amix=inputs=2:normalize=0:dropout_transition=0[mix]",
    ].join(";"),
    inputs: [music],
  };
}

const ln = (target) => `loudnorm=I=${target}:TP=${LOUDNESS.truePeak}:LRA=${LOUDNESS.range}`;

function checkTarget(t) {
  const n = num(t ?? LOUDNESS.lufs, "target");
  if (n < -30 || n > -8) throw new Error("--target must be from -30 to -8 LUFS.");
  return n;
}

/** Pass 1: measure. The program prints a JSON block on stderr (see parseLoudnorm). */
export function loudnormMeasureArgs({ file, denoise, music, duck, target }, info) {
  const g = audioGraph({ denoise, music, duck, seconds: info.seconds });
  return [
    ...input(file),
    ...g.inputs.flatMap((m) => input(m)),
    "-filter_complex",
    `${g.graph};[mix]${ln(checkTarget(target))}:print_format=json[a]`,
    "-map",
    "[a]",
    "-f",
    "null",
    "-",
  ];
}

/** The measurement from pass 1, or null when ffmpeg printed none. Values are numbers; "-inf" stays -Infinity. */
export function parseLoudnorm(stderr) {
  const m = stderr.match(/\{[^{}]*"input_i"[^{}]*\}/);
  if (!m) return null;
  const j = JSON.parse(m[0]);
  const n = (v) => (String(v).includes("inf") ? -Infinity : Number(v));
  return {
    i: n(j.input_i),
    tp: n(j.input_tp),
    lra: n(j.input_lra),
    thresh: n(j.input_thresh),
    offset: n(j.target_offset),
  };
}

/** Pass 2: apply the measured gain linearly, so dynamics are kept; the picture is copied, not re-encoded. */
export function loudnormApplyArgs({ file, out, denoise, music, duck, target }, info, m) {
  if (!Number.isFinite(m.i) || m.i < -60)
    throw new Error("The sound is silent, so there is nothing to bring to a level.");
  const g = audioGraph({ denoise, music, duck, seconds: info.seconds });
  const measured = `measured_I=${m.i}:measured_TP=${m.tp}:measured_LRA=${m.lra}:measured_thresh=${m.thresh}:offset=${m.offset}:linear=true`;
  return [
    ...input(file),
    ...g.inputs.flatMap((x) => input(x)),
    "-filter_complex",
    `${g.graph};[mix]${ln(checkTarget(target))}:${measured},aresample=48000[a]`,
    "-map",
    "0:v",
    "-map",
    "[a]",
    "-c:v",
    "copy",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-ar",
    "48000",
    "-movflags",
    "+faststart",
    "-fflags",
    "+bitexact",
    "-flags:a",
    "+bitexact",
    "-y",
    out,
  ];
}

/** Looks built from ffmpeg's own filters, so there is no third-party LUT file and no licence to track. */
export const LOOKS = Object.freeze({
  warm: "colorbalance=rs=0.06:bs=-0.08:rm=0.05:bm=-0.06:rh=0.04:bh=-0.05,eq=saturation=1.05",
  cool: "colorbalance=rs=-0.06:bs=0.08:rm=-0.05:bm=0.06:rh=-0.04:bh=0.05,eq=saturation=1.02",
  film: "curves=m='0/0.04 0.5/0.5 1/0.96',colorbalance=rs=0.03:bs=-0.02:rh=0.03:bh=-0.03,eq=contrast=1.05:saturation=0.9",
});

/** color: a look or a LUT, optionally after an automatic white balance (grayworld). */
export function colorArgs({ file, out, look, lut, autoWb, best }, info) {
  if (look && lut) throw new Error("Choose either --look or --lut, not both.");
  if (!look && !lut && !autoWb)
    throw new Error("Give --look warm|cool|film, --lut <file.cube>, or --auto-wb.");
  const chain = [];
  if (autoWb) chain.push("format=gbrpf32le,grayworld,format=yuv420p");
  if (look) {
    if (!LOOKS[look])
      throw new Error(`Unknown look "${look}". Have: ${Object.keys(LOOKS).join(", ")}.`);
    chain.push(LOOKS[look]);
  }
  if (lut) {
    if (!/\.(cube|3dl)$/i.test(lut)) throw new Error("--lut must be a .cube or .3dl file.");
    chain.push(`lut3d=file=${filterPath(lut)}`);
  }
  return [
    ...input(file),
    "-vf",
    chain.join(","),
    ...encode({ best, audio: info.audio ? "copy" : false }),
    "-y",
    out,
  ];
}

const STAB = Object.freeze({
  low: { shakiness: 3, smoothing: 10 },
  normal: { shakiness: 5, smoothing: 15 },
  high: { shakiness: 8, smoothing: 30 },
});

/**
 * stabilize: two passes with vidstab. `trf` is the motion file both passes share (a path in a temp folder).
 * Returns { detect, apply } argument arrays. The picture is cropped a little by the correction; audio is copied.
 */
export function stabilizeArgs({ file, out, trf, strength = "normal", best }, info) {
  const s = STAB[strength];
  if (!s)
    throw new Error(`Unknown --strength "${strength}". Have: ${Object.keys(STAB).join(", ")}.`);
  const t = filterPath(trf);
  return {
    detect: [
      ...input(file),
      "-an",
      "-vf",
      `vidstabdetect=shakiness=${s.shakiness}:accuracy=15:result=${t}`,
      "-f",
      "null",
      "-",
    ],
    apply: [
      ...input(file),
      "-vf",
      `vidstabtransform=input=${t}:smoothing=${s.smoothing}:zoom=0:optzoom=1,unsharp=5:5:0.8:3:3:0.4`,
      ...encode({ best, audio: info.audio ? "copy" : false }),
      "-y",
      out,
    ],
  };
}

/**
 * Marks for jumpcut: an array of times (seconds) or of { t, hold, zoom }. Returns clean objects. Marks must be
 * at least 1 s apart, inside the clip, and at most 20; zoom 1.05 to 1.3; hold 0 to 3 s.
 */
export function parseMarks(raw, seconds) {
  if (!Array.isArray(raw) || !raw.length)
    throw new Error("The marks file must be a list of times, such as [1.5, 4.2].");
  if (raw.length > 20) throw new Error("At most 20 marks in one pass.");
  const marks = raw.map((m, i) => {
    const o = typeof m === "number" ? { t: m } : m;
    const t = Number(o?.t);
    const hold = o?.hold === undefined ? 0.8 : Number(o.hold);
    const zoom = o?.zoom === undefined ? 1.12 : Number(o.zoom);
    if (!Number.isFinite(t) || t < 0 || t > seconds - 0.5)
      throw new Error(
        `Mark ${i + 1}: the time must be inside the clip (0 to ${r3(seconds - 0.5)} s).`,
      );
    if (!(hold >= 0 && hold <= 3))
      throw new Error(`Mark ${i + 1}: hold must be from 0 to 3 seconds.`);
    if (!(zoom >= 1.05 && zoom <= 1.3))
      throw new Error(`Mark ${i + 1}: zoom must be from 1.05 to 1.3.`);
    return { t: r3(t), hold: r3(hold), zoom: r3(zoom) };
  });
  marks.sort((a, b) => a.t - b.t);
  marks.forEach((m, i) => {
    if (i && m.t - marks[i - 1].t < 1 + marks[i - 1].hold)
      throw new Error(
        `Marks at ${marks[i - 1].t} s and ${m.t} s are too close; leave the zoom time to finish (at least 1 s plus the hold).`,
      );
  });
  return marks;
}

const UP = 0.15;
const DOWN = 0.35;
/** The zoom factor over time as an ffmpeg expression in `it`: smooth in, hold, smooth out, for each mark. */
export function zoomExpr(marks) {
  const bump = (m) => {
    const a = m.t;
    const b = r3(m.t + UP);
    const c = r3(m.t + UP + m.hold);
    const d = r3(m.t + UP + m.hold + DOWN);
    const k = r3(m.zoom - 1);
    return `${k}*(between(it,${a},${b})*(0.5-0.5*cos(PI*(it-${a})/${UP}))+between(it,${b},${c})+between(it,${c},${d})*(0.5+0.5*cos(PI*(it-${c})/${DOWN})))`;
  };
  return `1+${marks.map(bump).join("+")}`;
}

/** jumpcut: punch-in zooms at the marks, around the centre of the picture, same size and length as the input. */
export function jumpcutArgs({ file, out, marks, best }, info) {
  const m = parseMarks(marks, info.seconds);
  const up = info.width <= 1920 ? "scale=iw*2:ih*2:flags=bicubic," : ""; // sharper zoom for HD and smaller
  const vf = `${up}zoompan=z='${zoomExpr(m)}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=${info.width}x${info.height}:fps=${r3(info.fps)}`;
  return [
    ...input(file),
    "-vf",
    vf,
    ...encode({ best, audio: info.audio ? "copy" : false }),
    "-y",
    out,
  ];
}
