// The 3D look of the `puppet` scene (props.look = "3d"). The same props as the flat look: a cast, acts, moods, the
// lines each character speaks, and a backdrop preset. This file runs in node: it samples each character's motion
// at the film's frame rate (the same pure functions the flat look uses) and hands the numbers, the rig and the
// backdrop name to the page code (puppet3d-page.mjs), which draws them with three.js. Nothing is run from the rig.
import { VISEMES } from "../../puppet/rig.mjs";
import { rig3dProblems } from "../../puppet/rig3d.mjs";
import { blinkTimes, evalPose, mouthIntervals, normalizeActs } from "./puppet.mjs";

export const CHANNELS = 14;
const r4 = (n) => Math.round(n * 10000) / 10000;
/** How far a character turns toward the way it faces, and how quickly it turns (a share of the gap per frame). */
const YAW = 0.38;
const TURN = 0.22;

/** Per-frame pose numbers for one character: a flat list, CHANNELS numbers a frame. */
export function sampleCharacter(char, index, { seconds, fps, lines, visemes }) {
  const { acts } = normalizeActs(char);
  const blinks = blinkTimes(seconds, index);
  const spans = mouthIntervals(char.speaks, lines, visemes);
  const n = Math.ceil(seconds * fps) + 1;
  const out = [];
  let yaw = (char.flip ? -1 : 1) * YAW;
  for (let k = 0; k < n; k++) {
    const t = k / fps;
    const p = evalPose(char, acts, t, blinks);
    yaw += (p.face * YAW - yaw) * TURN;
    const shape = spans.find((s) => t >= s.from && t < s.to)?.v ?? "rest";
    out.push(
      r4(p.x),
      r4(p.lift),
      r4(yaw),
      r4(p.sx),
      r4(p.sy),
      r4(p.bob / 400),
      r4(p.head),
      r4(p.arms.l),
      r4(p.arms.r),
      r4(p.legs.l),
      r4(p.legs.r),
      r4(p.brows),
      r4(p.closed),
      Math.max(0, VISEMES.indexOf(shape)),
    );
  }
  return { n, samples: out };
}

/** Markup (an empty canvas) and the data the page needs for one 3D scene. */
export function puppet3d(s, ctx) {
  const props = s.props;
  const [w, h] = ctx.size;
  const id = `${ctx.prefix}-gl`;
  const cast = props.cast.map((c, i) => {
    const rig = ctx.rigs3d?.get(c.rig);
    if (!rig)
      throw new Error(
        `Character "${c.rig}" has no puppet3d.json (characters/${c.rig}/puppet3d.json).`,
      );
    const bad = rig3dProblems(rig);
    if (bad.length) throw new Error(`Character "${c.rig}" (3D): ${bad[0]}`);
    const sampled = sampleCharacter(c, i, {
      seconds: ctx.seconds,
      fps: ctx.fps ?? 30,
      lines: ctx.lines,
      visemes: ctx.visemes,
    });
    return { rig, x: c.x, y: c.y, height: c.height, ...sampled };
  });
  const gl = {
    id,
    at: ctx.at,
    seconds: ctx.seconds,
    fps: ctx.fps ?? 30,
    size: [w, h],
    backdrop: props.backdrop?.preset ?? "meadow",
    cast,
  };
  const label = props.cast.map((c) => c.rig).join(", ");
  return {
    html: `<div class="pup-stage" role="img" aria-label="${label.replace(/[^a-z0-9, -]/g, "")}"><canvas id="${id}" class="pup-gl" width="${w}" height="${h}"></canvas></div>`,
    plan: [],
    gl,
  };
}
