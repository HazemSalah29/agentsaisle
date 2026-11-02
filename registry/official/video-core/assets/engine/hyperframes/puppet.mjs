// The `puppet` scene: original SVG characters (rigs from characters/<name>/puppet.json) acting on a flat,
// drifting backdrop. Everything is a pure function of time: acts (walk, wave, jump, nod, dance, emote) are
// data in the scene's props, blinks fall at fixed times, and the mouth follows a viseme track made from the
// voice. The motion is sampled into keyframes, one animation per element, so a frame depends on the clock
// alone. Rig SVG is checked by rig.mjs before it gets here; all other text is escaped.
import { PRESETS, backdropLayers } from "./backdrop.mjs";
import { VISEMES, partTree, rigProblems } from "../../puppet/rig.mjs";
import { esc } from "./shared.mjs";

export const ACTS = ["walk", "wave", "jump", "nod", "dance", "emote"];
export const MOODS = ["neutral", "happy", "sad", "surprised", "sleepy"];
export const LIMITS = { cast: 4, acts: 60, seconds: 600 };
const ID = /^[a-z][a-z0-9-]{0,31}$/;
const LINE = /^[a-z0-9-]{1,32}$/;
const TIMED_DUR = { wave: 1.6, jump: 0.9, nod: 0.9, dance: 3 };
const BROWS = { neutral: 0, happy: -3, sad: 3, surprised: -9, sleepy: 2 };
const STEP = 1 / 60;
const r2 = (n) => Math.round(n * 100) / 100;
const r4 = (n) => Math.round(n * 10000) / 10000;
const clamp01 = (n) => Math.min(1, Math.max(0, n));
const smooth = (u) => clamp01(u) ** 2 * (3 - 2 * clamp01(u));
const rad = (deg) => (deg * Math.PI) / 180;

/** Walk length in seconds when the scene gives none: about 3.5 s across the whole stage. */
const walkDur = (dx) => Math.max(0.8, Math.abs(dx) * 3.5);

/**
 * Acts with every length and starting place filled in, in time order. Each character does one thing at a time
 * (blinks and mouths run on their own). Returns { acts, problems }.
 */
export function normalizeActs(char) {
  const problems = [];
  const acts = [];
  let x = char.x;
  let end = 0;
  const sorted = [...(char.acts ?? [])].sort((a, b) => a.at - b.at);
  for (const [i, a] of sorted.entries()) {
    const at = `acts[${i}]`;
    if (!a || typeof a !== "object" || !ACTS.includes(a.do)) {
      problems.push(`${at}.do: one of ${ACTS.join(", ")}`);
      continue;
    }
    if (!(typeof a.at === "number" && a.at >= 0 && a.at <= LIMITS.seconds)) {
      problems.push(`${at}.at: seconds from the start of the scene`);
      continue;
    }
    if (a.do === "emote") {
      if (!MOODS.includes(a.mood)) problems.push(`${at}.mood: one of ${MOODS.join(", ")}`);
      else acts.push({ do: "emote", at: a.at, dur: 0, mood: a.mood });
      continue;
    }
    let dur = a.dur;
    if (a.do === "walk") {
      if (!(typeof a.to === "number" && a.to >= 0 && a.to <= 1)) {
        problems.push(`${at}.to: where to walk, 0 to 1 across the stage`);
        continue;
      }
      dur ??= walkDur(a.to - x);
    } else dur ??= TIMED_DUR[a.do];
    if (!(typeof dur === "number" && dur >= 0.2 && dur <= 30)) {
      problems.push(`${at}.dur: 0.2 to 30 seconds`);
      continue;
    }
    if (a.do === "jump" && a.lift !== undefined && !(a.lift >= 0.02 && a.lift <= 0.3))
      problems.push(`${at}.lift: 0.02 to 0.3 of the scene height`);
    if (a.at < end - 1e-6)
      problems.push(`${at}: starts at ${r2(a.at)} s, before the last act ends (${r2(end)} s)`);
    const norm = { do: a.do, at: a.at, dur, x0: x, lift: a.lift ?? 0.1 };
    if (a.do === "walk") {
      norm.to = a.to;
      x = a.to;
    }
    end = a.at + dur;
    acts.push(norm);
  }
  return { acts, problems };
}

/** Problems with a puppet scene's props, as readable strings. `lineIds` are the scene's narration line ids. */
export function puppetProblems(props, lineIds = null) {
  const out = [];
  const bd = props.backdrop;
  if (bd !== undefined && !(bd && PRESETS.includes(bd.preset)))
    out.push(`backdrop: {preset} one of ${PRESETS.join(", ")}`);
  const cast = props.cast;
  if (!Array.isArray(cast) || cast.length < 1 || cast.length > LIMITS.cast)
    return [...out, `cast: 1 to ${LIMITS.cast} characters`];
  cast.forEach((c, i) => {
    const at = `cast[${i}]`;
    if (!c || typeof c !== "object") return void out.push(`${at}: must be an object`);
    if (!ID.test(c.rig ?? "")) out.push(`${at}.rig: the character's folder name in characters/`);
    const frac = (v, lo) => typeof v === "number" && v >= lo && v <= 1;
    if (!frac(c.x, 0) || !frac(c.y, 0.2))
      out.push(`${at}: x (0 to 1) and y (0.2 to 1, the feet) are needed`);
    if (!(typeof c.height === "number" && c.height >= 0.1 && c.height <= 0.9))
      out.push(`${at}.height: 0.1 to 0.9 of the scene height`);
    if (c.flip !== undefined && typeof c.flip !== "boolean") out.push(`${at}.flip: true or false`);
    if (c.speaks !== undefined) {
      if (!Array.isArray(c.speaks) || !c.speaks.every((s) => LINE.test(s)))
        out.push(`${at}.speaks: a list of narration line ids`);
      else if (lineIds)
        for (const s of c.speaks)
          if (!lineIds.includes(s))
            out.push(`${at}.speaks: "${s}" is not a narration line of this scene`);
    }
    if (c.acts !== undefined && (!Array.isArray(c.acts) || c.acts.length > LIMITS.acts))
      return void out.push(`${at}.acts: a list of at most ${LIMITS.acts}`);
    if (frac(c.x, 0)) out.push(...normalizeActs(c).problems.map((p) => `${at}.${p}`));
  });
  return out;
}

/** Everything a character's body is doing at scene time `t`, from its normalized acts. */
export function evalPose(char, acts, t, blinkAt = []) {
  const p = {
    x: char.x,
    face: char.flip ? -1 : 1,
    lift: 0,
    sx: 1,
    sy: 1,
    bob: 2 * Math.sin((2 * Math.PI * t) / 2.6),
    head: 0,
    arms: { l: 0, r: 0 },
    legs: { l: 0, r: 0 },
    brows: 0,
    closed: 0,
  };
  let mood = "neutral";
  let before = "neutral";
  let moodAt = -1;
  for (const a of acts) {
    if (a.do === "emote") {
      if (a.at <= t) {
        before = mood;
        mood = a.mood;
        moodAt = a.at;
      }
      continue;
    }
    if (a.do === "walk") {
      const u = (t - a.at) / a.dur;
      if (t >= a.at) p.x = a.x0 + (a.to - a.x0) * smooth(u);
      if (t >= a.at && a.to !== a.x0) p.face = a.to > a.x0 ? 1 : -1;
    }
    if (t < a.at || t > a.at + a.dur) continue;
    const u = (t - a.at) / a.dur;
    const env = Math.min(1, (t - a.at) / 0.15, (a.at + a.dur - t) / 0.15);
    const e = clamp01(env);
    if (a.do === "walk") {
      const ph = 2 * Math.PI * 2.2 * (t - a.at);
      p.legs = { l: 26 * e * Math.sin(ph), r: -26 * e * Math.sin(ph) };
      p.arms = { l: -16 * e * Math.sin(ph), r: 16 * e * Math.sin(ph) };
      p.bob = -7 * e * Math.abs(Math.sin(ph));
    } else if (a.do === "wave") {
      p.arms.r = -(140 * e + 18 * e * Math.sin(2 * Math.PI * 3 * (t - a.at)));
    } else if (a.do === "nod") {
      p.head = 9 * Math.sin(Math.PI * u) * Math.sin(2 * Math.PI * 2 * u);
    } else if (a.do === "dance") {
      const ph = 2 * Math.PI * 1.6 * (t - a.at);
      p.bob = -9 * e * Math.abs(Math.sin(ph));
      p.arms = { l: e * (100 + 24 * Math.sin(ph)), r: -e * (100 - 24 * Math.sin(ph)) };
      p.head = 8 * e * Math.sin(ph);
    } else if (a.do === "jump") {
      if (u < 0.15) {
        const s = Math.sin((Math.PI / 2) * (u / 0.15));
        p.sy = 1 - 0.12 * s;
        p.sx = 1 + 0.1 * s;
      } else if (u < 0.85) {
        const w = (u - 0.15) / 0.7;
        p.lift = 4 * a.lift * w * (1 - w);
        p.sy = 1 + 0.1 * Math.sin(Math.PI * w);
        p.sx = 1 - 0.06 * Math.sin(Math.PI * w);
      } else {
        const s = Math.sin(Math.PI * ((u - 0.85) / 0.15));
        p.sy = 1 - 0.12 * s;
        p.sx = 1 + 0.1 * s;
      }
    }
  }
  if (moodAt >= 0)
    p.brows = BROWS[before] + (BROWS[mood] - BROWS[before]) * smooth((t - moodAt) / 0.2);
  const hold = mood === "sleepy" ? 1 : 0;
  const blink = Math.max(0, ...blinkAt.map((c) => 1 - Math.abs(t - c) / 0.08));
  p.closed = Math.max(hold, blink);
  return p;
}

/** Blink centres: a short blink about every 3.4 s, offset per character so a cast does not blink together. */
export const blinkTimes = (seconds, index) => {
  const out = [];
  for (let c = 0.9 + index * 0.6; c < seconds - 0.1; c += 3.4) out.push(r2(c));
  return out;
};

/** Mouth intervals [{ from, to, v }] in scene time for the lines a character speaks. */
export function mouthIntervals(speaks, lines, visemes) {
  const out = [];
  for (const id of speaks ?? []) {
    const line = lines.find((l) => l.id === id);
    const events = visemes?.get(id);
    if (!line || !events?.length) continue;
    events.forEach((ev, i) => {
      const to = i + 1 < events.length ? events[i + 1].t : line.seconds;
      const v = VISEMES.includes(ev.v) ? ev.v : "rest";
      if (to > ev.t) out.push({ from: line.start + ev.t, to: line.start + to, v });
    });
  }
  return out.sort((a, b) => a.from - b.from);
}

/** The times to sample a character's motion at: a slow grid at rest, a fine one inside acts. */
function sampleTimes(seconds, acts, blinks) {
  const set = new Set([0, r4(seconds)]);
  for (let t = 0; t < seconds; t += 1 / 6) set.add(r4(t));
  for (const a of acts) {
    set.add(r4(Math.max(0, a.at - STEP)));
    set.add(r4(a.at));
    for (let t = a.at; t < a.at + a.dur; t += 1 / 24) set.add(r4(t));
    set.add(r4(a.at + a.dur));
    set.add(r4(a.at + a.dur + STEP));
  }
  for (const c of blinks) for (const d of [-0.08, 0, 0.08]) set.add(r4(c + d));
  return [...set].filter((t) => t >= 0 && t <= seconds).sort((x, y) => x - y);
}

/** Keyframes from [time, value] samples: constant stretches collapse to their two ends. */
function toFrames(samples, seconds, key) {
  const keep = samples.filter((s, i) => {
    const prev = samples[i - 1];
    const next = samples[i + 1];
    return !(prev && next && prev[1] === s[1] && next[1] === s[1]);
  });
  return keep.map(([t, v]) => ({
    offset: r4(Math.min(1, t / seconds)),
    [key]: v,
    easing: "linear",
  }));
}

const rot = (deg, pivot) =>
  `translate(${pivot[0]}px, ${pivot[1]}px) rotate(${r2(deg)}deg) translate(${-pivot[0]}px, ${-pivot[1]}px)`;
const rigPart = (rig, id) => rig.parts.find((p) => p.id === id);

function partMarkup(node, base) {
  const hidden =
    node.id === "eyes-closed" || (node.id.startsWith("mouth-") && node.id !== "mouth-rest");
  const style = hidden ? ' style="opacity:0"' : "";
  return `<g id="${base}-${node.id}"${style}>${node.svg}${node.children.map((c) => partMarkup(c, base)).join("")}</g>`;
}

function renderCharacter(char, index, rig, ctx) {
  const [w, h] = ctx.size;
  const base = `${ctx.prefix}-c${index}`;
  const H = char.height * h;
  const W = (H * rig.box.w) / rig.box.h;
  const k = H / rig.box.h;
  const left = char.x * w - W / 2;
  const top = char.y * h - H;
  const html = `<div id="${base}" class="pup" style="left:${r2(left)}px;top:${r2(top)}px;width:${r2(W)}px;height:${r2(H)}px"><svg viewBox="0 0 ${rig.box.w} ${rig.box.h}" aria-hidden="true">${partTree(
    rig,
  )
    .map((n) => partMarkup(n, base))
    .join("")}</svg></div>`;
  const { acts } = normalizeActs(char);
  const blinks = blinkTimes(ctx.seconds, index);
  const times = sampleTimes(ctx.seconds, acts, blinks);
  const poses = times.map((t) => [t, evalPose(char, acts, t, blinks)]);
  const plan = [];
  const add = (id, samples, key) => {
    const frames = toFrames(samples, ctx.seconds, key);
    if (frames.length > 2 || (frames.length === 2 && frames[0][key] !== frames[1][key]))
      plan.push({ id, frames, at: ctx.at, dur: ctx.seconds, ease: "linear" });
  };
  const wrapper = poses.map(([t, p]) => [
    t,
    `translate(${r2((p.x - char.x) * w)}px, ${r2(-p.lift * h + p.bob * k)}px) scale(${r2(p.face * p.sx)}, ${r2(p.sy)})`,
  ]);
  add(base, wrapper, "transform");
  const swing = (id, pick) => {
    const part = rigPart(rig, id);
    if (part)
      add(
        `${base}-${id}`,
        poses.map(([t, p]) => [t, rot(pick(p), part.pivot)]),
        "transform",
      );
  };
  swing("head", (p) => p.head);
  swing("arm-l", (p) => p.arms.l);
  swing("arm-r", (p) => p.arms.r);
  swing("leg-l", (p) => p.legs.l);
  swing("leg-r", (p) => p.legs.r);
  if (rigPart(rig, "brows"))
    add(
      `${base}-brows`,
      poses.map(([t, p]) => [t, `translate(0px, ${r2(p.brows)}px)`]),
      "transform",
    );
  add(
    `${base}-eyes-closed`,
    poses.map(([t, p]) => [t, String(r2(p.closed))]),
    "opacity",
  );
  add(
    `${base}-eyes-open`,
    poses.map(([t, p]) => [t, String(r2(1 - p.closed))]),
    "opacity",
  );

  // Mouths step between shapes: a group is on while its viseme is current, and rest fills the gaps.
  const spans = mouthIntervals(char.speaks, ctx.lines, ctx.visemes);
  if (spans.length) {
    const shapeAt = (t) => spans.find((s) => t >= s.from && t < s.to)?.v ?? "rest";
    const cuts = new Set([0]);
    for (const s of spans) {
      cuts.add(r4(Math.max(0, s.from)));
      cuts.add(r4(Math.min(ctx.seconds, s.to)));
    }
    const at = [...cuts].sort((a, b) => a - b);
    for (const v of VISEMES) {
      const samples = [];
      let prev = v === "rest" ? 1 : 0;
      samples.push([0, String(prev)]);
      for (const t of at.slice(1)) {
        const now = shapeAt(t + 1e-4) === v ? 1 : 0;
        if (now !== prev) {
          samples.push([Math.max(0, t - STEP), String(prev)], [t, String(now)]);
          prev = now;
        }
      }
      samples.push([ctx.seconds, String(prev)]);
      add(`${base}-mouth-${v}`, samples, "opacity");
    }
  }
  return { html, plan };
}

export function puppet(s, ctx) {
  const props = s.props;
  const layers = backdropLayers(props.backdrop?.preset ?? "meadow");
  const plan = [];
  let bg = `<svg class="pup-bg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">`;
  layers.forEach((layer, i) => {
    const id = `${ctx.prefix}-bg${i}`;
    bg += `<g id="${id}">${layer.svg}</g>`;
    if (layer.drift) {
      const dir = i % 2 ? -1 : 1;
      plan.push({
        id,
        frames: [
          { transform: `translate(${-dir * layer.drift}px, 0px)` },
          { transform: `translate(${dir * layer.drift}px, 0px)` },
        ],
        at: ctx.at,
        dur: ctx.seconds,
        ease: "linear",
      });
    }
  });
  bg += "</svg>";
  let html = bg;
  props.cast.forEach((c, i) => {
    const rig = ctx.rigs?.get(c.rig);
    if (!rig)
      throw new Error(`Character "${c.rig}" has no puppet.json (characters/${c.rig}/puppet.json).`);
    const bad = rigProblems(rig);
    if (bad.length) throw new Error(`Character "${c.rig}": ${bad[0]}`);
    const r = renderCharacter(c, i, rig, ctx);
    html += r.html;
    plan.push(...r.plan);
  });
  const label = props.cast.map((c) => esc(c.rig)).join(", ");
  return { html: `<div class="pup-stage" role="img" aria-label="${label}">${html}</div>`, plan };
}

export const puppetCss = () => `
.scene-puppet{padding:0;z-index:2;overflow:hidden}
.pup-stage{position:absolute;inset:0;overflow:hidden;direction:ltr}
.pup-bg{position:absolute;inset:0;width:100%;height:100%}
.pup{position:absolute;transform-origin:50% 100%}
.pup svg{display:block;width:100%;height:100%;overflow:visible}
`;
