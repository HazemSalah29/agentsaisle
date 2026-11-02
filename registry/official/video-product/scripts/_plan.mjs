// The pure part of a product edit: from the product's words, its photos and a preset, work out the shots (lengths,
// moves, effects, type, sound cues) and write them as a video.json. Everything is a function of its input; no file is
// read or written here. Shot lengths come from the preset, the optional reference recipe (numbers only) and the beats
// of the user's music when given. Text is only what the user supplied: no claim, price or number is invented.
import { snapScenes } from "./_beats.mjs";

export const FORMATS = ["reel-9x16", "short-9x16", "youtube-16x9", "square-1x1"];
export const LIMITS = {
  product: 30,
  line: 36,
  cta: 24,
  price: 12,
  lines: 3,
  photos: 6,
  seconds: [6, 30],
};
const HEX = /^#[0-9a-fA-F]{6}$/;
/** Different ways to look at a photo the second, third... time it is used, so few photos still give varied shots. */
const FRAMINGS = [
  null,
  { focus: [0, 14], zoom: 1.45 },
  { focus: [0, -16], zoom: 1.45 },
  { focus: [16, 0], zoom: 1.5 },
  { focus: [-16, 6], zoom: 1.5 },
];
/** For screenshots the card must stay in frame, so the looks are gentle shifts, not deep crops. */
const FRAMINGS_SCREENS = [
  null,
  { focus: [0, 9], zoom: 1.2 },
  { focus: [0, -9], zoom: 1.2 },
  { focus: [8, 0], zoom: 1.22 },
  { focus: [-8, 4], zoom: 1.22 },
];
const r2 = (n) => Math.round(n * 100) / 100;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

/** Problems with the inputs, as readable strings. Pure. */
export function inputProblems(i, presets) {
  const p = [];
  const text = (v, max, label, need = true) => {
    if (v === undefined || v === "") return need ? p.push(`${label}: needed`) : 0;
    if (typeof v !== "string" || !v.trim() || v.length > max)
      p.push(`${label}: 1 to ${max} characters`);
  };
  text(i.product, LIMITS.product, "product");
  text(i.cta, LIMITS.cta, "cta", false);
  text(i.price, LIMITS.price, "price", false);
  if (!Array.isArray(i.lines) || i.lines.length > LIMITS.lines)
    p.push(`lines: up to ${LIMITS.lines} short lines about the product, written by the user`);
  else i.lines.forEach((l, k) => text(l, LIMITS.line, `lines[${k}]`));
  if (!Array.isArray(i.photos) || i.photos.length < 1 || i.photos.length > LIMITS.photos)
    p.push(`photos: 1 to ${LIMITS.photos} photos`);
  if (!presets[i.preset]) p.push(`preset: one of ${Object.keys(presets).join(", ")}`);
  const [lo, hi] = LIMITS.seconds;
  if (
    i.seconds !== undefined &&
    !(Number.isFinite(i.seconds) && i.seconds >= lo && i.seconds <= hi)
  )
    p.push(`seconds: ${lo} to ${hi}`);
  if (i.format !== undefined && !FORMATS.includes(i.format))
    p.push(`format: one of ${FORMATS.join(", ")}`);
  if (i.accent !== undefined && !HEX.test(i.accent)) p.push("accent: a #rrggbb colour");
  return p;
}

/** Shot lengths: hook, features, call to action. Pure. */
export function shotLengths({ preset, seconds, recipe, beats }) {
  const hook = Math.max(preset.hook, Math.min(2.5, recipe?.hookSeconds ?? 0) || preset.hook);
  const cta = preset.cta;
  const feat = Math.max(preset.shot[0], seconds - hook - cta);
  const avg = clamp(
    recipe?.averageShotSeconds ?? (preset.shot[0] + preset.shot[1]) / 2,
    preset.shot[0],
    preset.shot[1],
  );
  const n = clamp(Math.round(feat / avg), 1, 12);
  const each = feat / n;
  const lengths = [hook, ...Array.from({ length: n }, () => r2(each)), cta];
  // Take up rounding so the total is exactly `seconds`.
  lengths[lengths.length - 2] = r2(
    lengths[lengths.length - 2] + (seconds - lengths.reduce((a, b) => a + b, 0)),
  );
  if (beats?.length) {
    const movable = lengths.map((_, i) => i > 0 && i < lengths.length - 1);
    return snapScenes(lengths, beats, {
      tolerance: preset.snapTolerance,
      minLen: preset.minShot,
      movable,
    }).map(r2);
  }
  return lengths;
}

/** Beat times at a steady tempo (used when only a tempo is known). */
export const gridFromBpm = (bpm, seconds) =>
  Number.isFinite(bpm) && bpm >= 60 && bpm <= 200
    ? Array.from({ length: Math.floor((seconds * bpm) / 60) + 1 }, (_, k) => r2((k * 60) / bpm))
    : [];

/** Darken a colour until white text on it reads (contrast of at least 3:1). Pure. */
export function readableAccent(hex) {
  const lum = (h) => {
    const v = [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16) / 255);
    const [r, g, b] = v.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  let h = hex;
  for (let k = 0; k < 12 && 1.05 / (lum(h) + 0.05) < 3; k++)
    h = `#${[1, 3, 5]
      .map((i) =>
        Math.round(parseInt(h.slice(i, i + 2), 16) * 0.85)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")}`;
  return h;
}

/**
 * The whole edit. `photos` is [{ id, layers: "cutout" | "photo" }]: with a cutout a photo gives a background and a
 * subject layer (ids `<id>-bg`, `<id>-subject`), without it one layer. Returns { video, brand, sfxNames, summary }.
 */
export function planEdit(i, presets) {
  const bad = inputProblems(i, presets);
  if (bad.length) throw new Error(bad[0]);
  const preset = presets[i.preset];
  const seconds = i.seconds ?? 15;
  const beats = i.beats?.length ? i.beats : gridFromBpm(i.bpm ?? i.recipe?.tempo?.bpm, seconds);
  const lengths = shotLengths({ preset, seconds, recipe: i.recipe, beats });
  const starts = lengths.reduce(
    (a, d, k) => (a.push(k ? r2(a[k - 1] + lengths[k - 1]) : 0), a),
    [],
  );
  const last = lengths.length - 1;
  const lines = i.lines ?? [];
  const flashes = []; // film-wide, to keep flashes apart across shots
  const flashOk = (t) => flashes.every((f) => Math.abs(f - t) >= 0.9);
  const sfx = [];
  const cue = (name, gain, at) => {
    if (at < 0 || at > seconds - 0.05) return;
    if (sfx.some((s) => s.name === name && Math.abs(s.at - at) < 0.15)) return;
    sfx.push({ name, at: r2(at), gainDb: gain });
  };
  const layersOf = (photo) =>
    photo.layers === "cutout"
      ? [
          { asset: `${photo.id}-bg`, role: "bg" },
          { asset: `${photo.id}-subject`, role: "subject" },
        ]
      : [{ asset: photo.id, role: "bg" }];
  // Screenshots sit on a card in the middle, so type goes above and below it instead of over it.
  const alt = (k) => (i.screens ? (k % 2 ? "head" : "foot") : k % 2 ? "top" : "bottom");
  const uses = new Map();

  const scenes = lengths.map((len, k) => {
    const photo = i.photos[k === 0 || k === last ? 0 : (k - 1) % i.photos.length];
    const framing =
      k === 0 || k === last
        ? null
        : (i.screens ? FRAMINGS_SCREENS : FRAMINGS)[
            Math.min(uses.get(photo.id) ?? 0, FRAMINGS.length - 1)
          ];
    if (k !== 0 && k !== last) uses.set(photo.id, (uses.get(photo.id) ?? 0) + 1);
    const hookShot = k === 0;
    const ctaShot = k === last;
    const t0 = starts[k];
    const move = hookShot ? "push" : ctaShot ? "pull" : preset.moves[(k - 1) % preset.moves.length];
    const camera = { move, ease: preset.ease };
    if (move === "push") {
      camera.from = preset.zoom[0];
      camera.to = hookShot ? preset.zoom[1] + 0.06 : preset.zoom[1];
    }
    if (move === "pull") {
      camera.from = preset.zoom[1] + 0.04;
      camera.to = preset.zoom[0] + 0.02;
    }
    if (framing) {
      camera.focus = framing.focus;
      if (move === "push") {
        camera.from = framing.zoom;
        camera.to = r2(framing.zoom + (preset.zoom[1] - preset.zoom[0]));
      } else if (move === "pull") {
        camera.from = r2(framing.zoom + 0.1);
        camera.to = framing.zoom;
      } else camera.from = framing.zoom;
    }
    if (preset.ramp && !hookShot && !ctaShot && k % 2 === 1 && len >= 1) camera.ramp = preset.ramp;
    const enterStyle = hookShot
      ? preset.hookEnter
      : ctaShot
        ? "zoom"
        : preset.enters[(k - 1) % preset.enters.length];
    const enter = { style: enterStyle === "flash" && !flashOk(t0) ? "cut" : enterStyle };
    if (enter.style === "flash") flashes.push(t0);
    const fx = { grade: preset.grade, grain: preset.grain, vignette: preset.vignette };
    const inShot = (beats ?? []).map((b) => r2(b - t0)).filter((b) => b > 0.15 && b < len - 0.15);
    if (preset.shakeOnBeat && inShot.length && !ctaShot) fx.shake = [inShot[0]];
    if (preset.glitchOnBeat && !ctaShot) fx.glitch = [inShot[0] ?? r2(len * 0.45)];
    if (preset.flashEvery && k % preset.flashEvery === 2 && len >= 1.1 && !ctaShot) {
      const at = r2(len * 0.6);
      if (flashOk(t0 + at)) {
        fx.flash = [at];
        flashes.push(t0 + at);
      }
    }

    const type = [];
    const cards = [];
    if (hookShot)
      type.push({
        text: i.product,
        at: 0.15,
        style: preset.type.hook,
        anchor: i.screens ? "head" : "center",
      });
    else if (ctaShot) {
      if (i.price)
        type.push({
          text: i.price,
          at: 0.2,
          style: "price",
          anchor: i.screens ? "head" : "center",
        });
      if (i.cta)
        type.push({
          text: i.cta,
          at: 0.5,
          style: preset.type.cta,
          anchor: i.screens ? "foot" : "bottom",
        });
      if (!i.price && !i.cta)
        type.push({
          text: i.product,
          at: 0.2,
          style: preset.type.hook,
          anchor: i.screens ? "head" : "center",
        });
    } else if (lines.length) {
      type.push({
        text: lines[(k - 1) % lines.length],
        at: r2(Math.min(0.2, len / 4)),
        style: preset.type.feature,
        anchor: alt(k),
      });
    }

    // Sound: effects the user can hear on the cuts and the hits, never louder than the voice-free mix allows.
    if (!hookShot && enter.style !== "cut" && preset.sfx.enter)
      cue(preset.sfx.enter[0], preset.sfx.enter[1], t0);
    if (hookShot && preset.sfx.hook) cue(preset.sfx.hook[0], preset.sfx.hook[1], t0 + 0.15);
    if (fx.flash && preset.sfx.flash)
      cue(preset.sfx.flash[0], preset.sfx.flash[1], t0 + fx.flash[0]);
    if (ctaShot && preset.sfx.cta) cue(preset.sfx.cta[0], preset.sfx.cta[1], t0);
    if (ctaShot && preset.sfx.riser) cue(preset.sfx.riser[0], preset.sfx.riser[1], t0 - 1.4);
    for (const g of fx.glitch ?? [])
      if (preset.sfx.enter?.[0] === "glitch") cue("glitch", preset.sfx.enter[1], t0 + g);
    return {
      id: `s${k + 1}`,
      kind: "shot",
      durationFrom: "fixed",
      seconds: len,
      props: {
        layers: layersOf(photo),
        camera,
        type,
        ...(cards.length ? { cards } : {}),
        fx,
        enter,
      },
    };
  });

  const accent = readableAccent(i.accent ?? "#e8542a");
  const video = {
    version: 1,
    meta: {
      title: `${i.product}`.slice(0, 120),
      type: "showcase",
      format: i.format ?? "reel-9x16",
      fps: 30,
      lang: "en",
      audience: "people who might buy this product",
      brand: "brand/brand.json",
    },
    voice: { provider: "none" },
    scenes,
    sfx: sfx
      .sort((a, b) => a.at - b.at)
      .map((s) => ({ file: `audio/${s.name}.wav`, at: s.at, gainDb: s.gainDb })),
  };
  return {
    video,
    brand: { colors: { bg: "#0b0d10", fg: "#ffffff", accent, muted: "#a8b0bb" } },
    sfxNames: [...new Set(sfx.map((s) => s.name))],
    summary: {
      shots: scenes.length,
      seconds,
      flashes: flashes.length,
      sfx: sfx.length,
      snapped: Boolean(beats?.length),
    },
  };
}
