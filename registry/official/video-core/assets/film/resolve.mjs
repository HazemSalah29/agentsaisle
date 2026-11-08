// Turns a checked video.json, its timing and its word times into the film the Remotion engine draws: every scene
// with its frames, its transition, and props already worked out (when each item appears, highlighted code, the
// rate-limit simulation, diagram positions). The React side only draws, so everything here is testable in Node and
// a frame depends on nothing but this data. Pure: it reads the vendored Shiki grammars and nothing else.
import { tokens } from "../vendor/shiki.mjs";
import { parseSequence } from "../seq/parse.mjs";
import { simulate } from "../sim/rate-limit.mjs";
import { KINETIC, TIERS, diffRows, itemText } from "./rules.mjs";

export const SIZES = {
  "reel-9x16": [1080, 1920],
  "short-9x16": [1080, 1920],
  "youtube-16x9": [1920, 1080],
  "square-1x1": [1080, 1080],
};

/** Looks the engine knows. A brand's colours override the preset's. */
export const PRESETS = {
  volt: { bg: "#06070a", fg: "#f5f7fa", accent: "#c6ff1a", accent2: "#5ce1ff", muted: "#8b93a1" },
  ember: { bg: "#0b0a0a", fg: "#fbf7f4", accent: "#ff5a1f", accent2: "#ffc23d", muted: "#9c928c" },
  ice: { bg: "#060c17", fg: "#f2f7ff", accent: "#38d9ff", accent2: "#8b7bff", muted: "#8a98ad" },
  grape: { bg: "#0a0711", fg: "#f7f4ff", accent: "#b48bff", accent2: "#ff6ad5", muted: "#968fa8" },
};

/** Transition lengths in seconds. A cut is instant; the rest overlap the end of the scene before. */
export const TRANSITION_SECONDS = {
  cut: 0,
  fade: 0.3,
  slide: 0.33,
  whip: 0.28,
  "zoom-through": 0.36,
  slash: 0.4,
  shatter: 0.4,
};

const HEX = /^#[0-9a-fA-F]{6}$/;
const r3 = (n) => Math.round(n * 1000) / 1000;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const STOP = new Set(
  "a an the and or of to in on at for with is are was were be it its this that as by from your you we our their".split(
    " ",
  ),
);
const norm = (s) =>
  String(s ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
const contentWords = (text) =>
  norm(text)
    .split(" ")
    .filter((w) => w.length >= 2 && !STOP.has(w));

/** How far ahead of its spoken word an item starts, so the eye is there when the word lands. */
export const LEAD = 0.08;

/**
 * When each item of a scene appears, in scene seconds. In order of preference: the item's `on` words, then the
 * first spoken word that names it (searching forward only), then one narration line per item, then evenly spread.
 * Times never go backwards and the first item is always on screen within `firstBy` seconds. Pure.
 */
export function beats(texts, { words = [], lines = [], seconds, ons = [], firstBy = 0.5 }) {
  const keyed = words.map((w) => ({ ...w, key: norm(w.text) }));
  let from = 0;
  const find = (text) => {
    const want = new Set(contentWords(text));
    if (!want.size) return null;
    for (let i = from; i < keyed.length; i++)
      if (want.has(keyed[i].key)) {
        from = i + 1;
        return keyed[i].start;
      }
    return null;
  };
  const n = texts.length;
  const span = Math.max(0.6, seconds * 0.8);
  const out = texts.map((t, i) => {
    const hit = (ons[i] && find(ons[i])) ?? find(t);
    if (hit !== null && hit !== undefined) return hit - LEAD;
    if (lines.length === n) return lines[i].start;
    return 0.15 + (span * i) / Math.max(1, n);
  });
  let prev = -Infinity;
  return out.map((t, i) => {
    let v = clamp(t, 0, Math.max(0, seconds - 0.4));
    if (i === 0) v = Math.min(v, firstBy);
    v = Math.max(v, prev + 0.12);
    prev = v;
    return r3(v);
  });
}

/** Colours, fonts and look for the film, from the brand file and a preset. Bad brand values are ignored. */
export function themeOf(brand = {}, presetName = "volt") {
  const preset = PRESETS[presetName] ?? PRESETS.volt;
  const c = brand.colors ?? {};
  const pick = (k) => (HEX.test(c[k] ?? "") ? c[k] : preset[k]);
  return {
    preset: PRESETS[presetName] ? presetName : "volt",
    bg: pick("bg"),
    fg: pick("fg"),
    accent: pick("accent"),
    accent2: pick("accent2"),
    muted: pick("muted"),
    danger: "#ff4d5e",
    ok: "#3ddc84",
    font:
      typeof brand.font === "string" && /^[\w .-]{1,40}$/.test(brand.font) ? brand.font : "Inter",
  };
}

/** Caption pages: up to `max` words, broken at punctuation and at pauses, in film seconds. Pure. */
export function captionPages(words, max = 3) {
  const pages = [];
  let cur = [];
  const flush = () => {
    if (cur.length) pages.push({ start: cur[0].start, end: cur[cur.length - 1].end, words: cur });
    cur = [];
  };
  words.forEach((w, i) => {
    const prev = words[i - 1];
    if (cur.length && (cur.length >= max || (prev && w.start - prev.end > 0.35))) flush();
    cur.push({ text: w.text, start: w.start, end: w.end });
    if (/[.!?,;:]$/.test(w.text)) flush();
  });
  flush();
  // A page stays up until the next one starts (or 0.4 s after its last word), so captions never flicker off.
  return pages.map((p, i) => ({
    ...p,
    end: r3(Math.min(pages[i + 1]?.start ?? p.end + 0.4, p.end + 0.4)),
  }));
}

/** Word groups for a kinetic scene: the given phrases when they match, else sentences in balanced groups. Pure. */
export function groupWords(words, phrases) {
  if (phrases?.length) {
    const counts = phrases.map((t) => t.trim().split(/\s+/).length);
    if (counts.reduce((a, b) => a + b, 0) === words.length) {
      let at = 0;
      return counts.map((n) => words.slice(at, (at += n)));
    }
  }
  const JOIN = new Set([
    "a",
    "an",
    "the",
    "to",
    "of",
    "in",
    "on",
    "at",
    "for",
    "with",
    "and",
    "or",
    "but",
    "is",
    "it",
    "your",
    "my",
  ]);
  const sentences = [];
  let cur = [];
  for (const w of words) {
    cur.push(w);
    if (/[.!?;:,]$/.test(w.text)) {
      sentences.push(cur);
      cur = [];
    }
  }
  if (cur.length) sentences.push(cur);
  const out = [];
  for (const sent of sentences) {
    const k = Math.ceil(sent.length / KINETIC.perPhrase);
    const base = Math.floor(sent.length / k);
    const extra = sent.length % k;
    const parts = [];
    let at = 0;
    for (let i = 0; i < k; i++) {
      const n = base + (i < extra ? 1 : 0);
      parts.push(sent.slice(at, at + n));
      at += n;
    }
    for (let i = 0; i + 1 < parts.length; i++)
      while (
        parts[i].length > 1 &&
        JOIN.has(norm(parts[i].at(-1).text)) &&
        parts[i + 1].length < KINETIC.perPhrase
      )
        parts[i + 1].unshift(parts[i].pop());
    out.push(...parts.filter((x) => x.length));
  }
  return out;
}

// Keep an apostrophe inside a word (I'll, it's, don't); strip quotes and
// punctuation everywhere else.
const shownWord = (w) =>
  String(w)
    .replace(/(?<=\p{L})['‘’](?=\p{L})/gu, "\u0000")
    .replace(/["'“”‘’,;:()]/g, "")
    .replace(/\u0000/g, "'")
    .trim();

function kinetic(props, ctx) {
  let words = ctx.words;
  if (!words.length) {
    const toks = String(props.text ?? "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    const span = Math.max(0.5, ctx.seconds - 0.5);
    words = toks.map((text, i) => ({
      text,
      start: r3(0.15 + (span * i) / toks.length),
      end: r3(0.15 + (span * (i + 0.8)) / toks.length),
    }));
  }
  const emph = new Set((props.emph ?? []).map(norm));
  const groups = groupWords(words, props.phrases);
  const slab = props.bg === "accent";
  const phrases = groups.map((g, j) => {
    const next = groups[j + 1]?.[0]?.start;
    const last = j === groups.length - 1;
    return {
      start: r3(Math.max(0, g[0].start - 0.03)),
      end: r3(
        last && props.holdLast !== false
          ? ctx.seconds + 1
          : // clears out just before the next phrase lands, so two never fight for the middle
            Math.max(g[0].start + 0.3, Math.min((next ?? ctx.seconds) - 0.2, g.at(-1).end + 0.6)),
      ),
      words: g.map((w) => ({
        text: shownWord(w.text),
        at: r3(Math.max(0, w.start - 0.03)),
        emph: emph.has(norm(w.text)),
      })),
    };
  });
  // With no emphasis given, the longest word of each phrase carries the accent, so every beat has a focus.
  if (!emph.size && !slab)
    for (const ph of phrases) {
      const best = ph.words.reduce((a, b) =>
        shownWord(b.text).length > shownWord(a.text).length ? b : a,
      );
      if (best.text.length >= 4) best.emph = true;
    }
  const cardAt = (c) => c.at ?? phrases[0]?.start ?? 0;
  return {
    bg: props.bg ?? "black",
    grid: props.grid !== false,
    exit: props.exit ?? "slide",
    y: props.y ?? (props.cards?.length || props.flow ? 30 : 50),
    phrases,
    cards: (props.cards ?? []).map((c, i) => ({
      title: c.title,
      x: c.x ?? 50,
      y: c.y ?? 66,
      tilt: c.tilt ?? [10, i % 2 ? 12 : -12],
      at: r3(cardAt(c)),
      rows: c.rows.map((r, k) => ({
        text: r.text,
        tag: r.tag,
        at: r3(
          Number.isInteger(r.bind) && words[r.bind]
            ? words[r.bind].start
            : cardAt(c) + 0.25 * (k + 1),
        ),
      })),
    })),
    flow: props.flow
      ? { nodes: props.flow.nodes, at: r3(props.flow.at ?? phrases[0]?.start ?? 0.2) }
      : null,
  };
}

function codeScene(props, ctx) {
  const lang = props.language;
  const toks = (text) =>
    tokens(text, lang).map((line) => line.map((t) => ({ t: t.content, c: t.color })));
  let rows;
  let diffAt = null;
  if (props.diff) {
    const d = diffRows(props.diff.before, props.diff.after);
    const before = toks(props.diff.before);
    const after = toks(props.diff.after);
    let i = 0;
    let j = 0;
    rows = d.map((r) => {
      const line = r.type === "add" ? after[j++] : before[i++];
      if (r.type === "same") j++;
      return { kind: r.type, tokens: line ?? [{ t: r.text, c: "#e1e4e8" }] };
    });
    diffAt = r3(clamp(ctx.lineStarts[1] ?? ctx.seconds * 0.45, 0.8, ctx.seconds - 1));
  } else rows = toks(props.code).map((line) => ({ kind: "same", tokens: line }));
  // Lines type in during the first stretch of the scene: fast enough to keep pace, slow enough to read.
  const n = rows.length;
  const typeSpan = clamp(ctx.seconds * 0.35, 0.6, 3.2);
  const lineAts = rows.map((_, i) => r3(0.25 + (typeSpan * i) / Math.max(1, n)));
  const focus = (props.focus ?? []).map((f) => {
    let at = f.at;
    if (Number.isInteger(f.line)) at = ctx.lineStarts[f.line] ?? 0;
    // A focus on a spoken word lands on that word, wherever it is in the scene (no early first item here).
    if (typeof f.on === "string")
      at = beats([f.on], { ...ctx.beatCtx, ons: [f.on], firstBy: Infinity })[0];
    return { from: f.lines[0], to: f.lines[1], at: r3(Math.max(typeSpan * 0.6, at)) };
  });
  focus.sort((x, y) => x.at - y.at);
  return { title: props.title, file: props.file, language: lang, rows, lineAts, focus, diffAt };
}

function rateLimit(props, ctx) {
  const sim = simulate(props);
  const start = 0.5;
  const span = Math.max(1, ctx.seconds - start - 0.8);
  const scale = sim.durationMs > 0 ? span / sim.durationMs : 0;
  const LABEL = {
    "token-bucket": "Token bucket",
    "leaky-bucket": "Leaky bucket",
    "fixed-window": "Fixed window",
    "sliding-window": "Sliding window",
  };
  return {
    title: props.title,
    travel: 0.55,
    runs: sim.runs.map((r) => ({
      algo: r.algo,
      label: LABEL[r.algo] ?? r.algo,
      allowed: r.allowed,
      rejected: r.rejected,
      events: r.events.map((e) => ({
        t: r3(start + e.t * scale),
        ok: e.outcome === "allowed",
        level: r3(e.level),
        max: e.max,
      })),
    })),
  };
}

/** Rows of components by tier for a request-flow, as percentages of the stage. */
function flowLayout(nodes) {
  const tiers = TIERS.filter((t) => nodes.some((n) => n.tier === t));
  const pos = {};
  const rowH = 100 / tiers.length;
  tiers.forEach((t, ri) => {
    const row = nodes.filter((n) => n.tier === t);
    row.forEach((n, k) => {
      pos[n.id] = { x: r3(((k + 0.5) * 100) / row.length), y: r3(rowH * (ri + 0.5)) };
    });
  });
  return pos;
}

function requestFlow(props, ctx) {
  const pos = flowLayout(props.nodes);
  const texts = props.steps.map((s) => s.label ?? s.event ?? "");
  const ats = beats(texts, { ...ctx.beatCtx, firstBy: 0.8 });
  const appear = {};
  const steps = props.steps.map((s, i) => {
    const e = s.edge ? props.edges.find((x) => x.id === s.edge) : null;
    const from = e ? (s.reverse ? e.to : e.from) : s.node;
    const to = e ? (s.reverse ? e.from : e.to) : s.node;
    for (const id of [from, to]) appear[id] ??= Math.max(0, ats[i] - 0.25);
    const next = ats[i + 1] ?? ctx.seconds;
    return {
      from,
      to,
      label: s.label ?? s.event ?? "",
      evidence: s.evidence,
      ms: s.ms,
      at: ats[i],
      dur: r3(clamp((next - ats[i]) * 0.7, 0.35, 1.2)),
      event: !e,
    };
  });
  return {
    title: props.title,
    nodes: props.nodes.map((n) => ({
      id: n.id,
      label: n.label,
      role: n.role,
      ...pos[n.id],
      at: r3(appear[n.id] ?? 0.1),
    })),
    edges: props.edges.map((e) => ({ id: e.id, from: e.from, to: e.to })),
    steps,
  };
}

/** Layers for a small graph: depth by longest path from a source, then spread across each layer. */
function graphLayout(nodes, edges) {
  const depth = Object.fromEntries(nodes.map((n) => [n.id, 0]));
  for (let k = 0; k < nodes.length; k++)
    for (const e of edges)
      if (depth[e.to] < depth[e.from] + 1 && depth[e.from] + 1 < nodes.length)
        depth[e.to] = depth[e.from] + 1;
  const layers = Math.max(...Object.values(depth)) + 1;
  const pos = {};
  for (let d = 0; d < layers; d++) {
    const row = nodes.filter((n) => depth[n.id] === d);
    row.forEach((n, k) => {
      pos[n.id] = { x: r3(((k + 0.5) * 100) / row.length), y: r3((100 * (d + 0.5)) / layers) };
    });
  }
  return pos;
}

function sequence(props, ctx) {
  const parsed = parseSequence(props.source);
  const ats = beats(
    parsed.items.map((it) => it.text),
    { ...ctx.beatCtx, firstBy: 0.6 },
  );
  return {
    title: props.title,
    participants: parsed.participants,
    rows: parsed.items.map((it, i) => ({ ...it, at: ats[i] })),
  };
}

/** Props for one scene, by kind, ready to draw. */
export function resolveScene(scene, ctx, assets) {
  const p = scene.props ?? {};
  const b = (texts, ons = []) => beats(texts, { ...ctx.beatCtx, ons });
  switch (scene.kind) {
    case "title":
      return { text: p.text, subtitle: p.subtitle, kicker: p.kicker };
    case "quote":
      return { text: p.text, by: p.by, source: p.source };
    case "list": {
      const texts = p.items.map(itemText);
      const ats = b(
        texts,
        p.items.map((x) => x?.on),
      );
      return {
        heading: p.heading,
        numbered: Boolean(p.numbered),
        layout: p.layout ?? (texts.length <= 4 ? "spotlight" : "stack"),
        items: texts.map((text, i) => ({ text, at: ats[i] })),
      };
    }
    case "number":
      return {
        value: p.value,
        from: p.from ?? 0,
        unit: p.unit ?? "",
        prefix: p.prefix ?? "",
        decimals: p.decimals ?? 0,
        label: p.label,
        at: p.on ? b([p.on], [p.on])[0] : 0.1,
      };
    case "versus": {
      const L = p.left.points.map(itemText);
      const R = p.right.points.map(itemText);
      const ats = b([p.left.title, p.right.title, ...L, ...R, ...(p.verdict ? [p.verdict] : [])]);
      return {
        title: p.title,
        left: {
          title: p.left.title,
          at: ats[0],
          points: L.map((t, i) => ({ text: t, at: ats[2 + i] })),
        },
        right: {
          title: p.right.title,
          at: ats[1],
          points: R.map((t, i) => ({ text: t, at: ats[2 + L.length + i] })),
        },
        verdict: p.verdict ? { text: p.verdict, at: ats.at(-1) } : null,
      };
    }
    case "steps": {
      const ats = b(
        p.steps.map((s) => s.label),
        p.steps.map((s) => s.on),
      );
      return {
        title: p.title,
        layout: p.layout ?? "stack",
        steps: p.steps.map((s, i) => ({ label: s.label, detail: s.detail, at: ats[i] })),
      };
    }
    case "code":
      return codeScene(p, ctx);
    case "terminal": {
      const ats = b(
        p.lines.map((l) => l.text),
        p.lines.map((l) => l.on),
      );
      return {
        title: p.title,
        prompt: p.prompt ?? "$",
        lines: p.lines.map((l, i) => ({
          text: l.text,
          kind: l.kind ?? (i === 0 ? "cmd" : "out"),
          at: ats[i],
        })),
      };
    }
    case "chart": {
      const ats = b(
        p.data.map((d) => d.label),
        p.data.map((d) => d.on),
      );
      return {
        title: p.title,
        type: p.type ?? "bar",
        unit: p.unit ?? "",
        data: p.data.map((d, i) => ({ label: d.label, value: d.value, at: ats[i] })),
      };
    }
    case "nodes": {
      const pos = graphLayout(p.nodes, p.edges);
      const ats = b(
        p.nodes.map((n) => n.label),
        p.nodes.map((n) => n.on),
      );
      return {
        title: p.title,
        nodes: p.nodes.map((n, i) => ({ id: n.id, label: n.label, ...pos[n.id], at: ats[i] })),
        edges: p.edges.map((e) => ({ from: e.from, to: e.to })),
      };
    }
    case "request-flow":
      return requestFlow(p, ctx);
    case "rate-limit":
      return rateLimit(p, ctx);
    case "sequence":
      return sequence(p, ctx);
    case "broll":
      return {
        src: assets[p.asset]?.src,
        media: assets[p.asset]?.type,
        fit: p.fit ?? "cover",
        caption: p.caption,
      };
    case "kinetic":
      return kinetic(p, ctx);
    case "screen":
      return {
        src: assets[p.asset]?.src,
        media: assets[p.asset]?.type,
        pip: p.pip ? assets[p.pip]?.src : null,
        device: p.device ?? "browser",
        viewport: p.viewport ?? { w: 1280, h: 800 },
        zoom: p.zoom ?? [],
        cursor: p.cursor ?? [],
        ripples: p.ripples ?? [],
        title: p.title,
        callouts: p.callouts ?? [],
        // The recording is this long; if the voice makes the scene longer, its last frame holds.
        mediaSeconds: scene.seconds ?? null,
      };
    default:
      throw new Error(`Scene kind "${scene.kind}" is not built.`);
  }
}

/**
 * The whole film for the engine, plus the media to copy and the sound cues to mix.
 * `assetFiles` maps asset id to { file (absolute), type: image | video }. `words` is per scene (sceneWords).
 * Returns { film, media: [{ from, to }], cues: [{ name, at, gainDb }], notes }.
 */
export function buildFilm({
  video,
  timing,
  brand = {},
  words = [],
  assetFiles = new Map(),
  preset,
}) {
  const notes = [];
  const [width, height] = SIZES[video.meta.format] ?? SIZES["reel-9x16"];
  const fps = video.meta.fps;
  const assets = {};
  const media = [];
  for (const [id, a] of assetFiles) {
    const ext = a.file.split(".").pop().toLowerCase();
    const to = `media/${id}.${ext}`;
    assets[id] = { src: to, type: a.type };
    media.push({ from: a.file, to });
  }
  const style = video.style ?? {};
  const kineticOnly = video.scenes.every((s) => s.kind === "kinetic");
  const allWords = [];
  const cues = [];
  const scenes = video.scenes.map((s, i) => {
    const t = timing.scenes[i];
    const sw = words[i] ?? [];
    const lines = t.lines ?? [];
    const ctx = {
      seconds: t.seconds,
      words: sw,
      lineStarts: lines.map((l) => l.start),
      beatCtx: { words: sw, lines, seconds: t.seconds },
    };
    if (s.kind !== "kinetic")
      for (const w of sw)
        allWords.push({ ...w, start: r3(t.start + w.start), end: r3(t.start + w.end) });
    let type = s.transitionIn ?? (i === 0 ? "cut" : "slide");
    if (i === 0) type = "cut";
    const tf = Math.round((TRANSITION_SECONDS[type] ?? 0) * fps);
    const transitionFrames = Math.min(tf, Math.floor(timing.scenes[i - 1]?.frames / 2 || 0));
    if (type !== "cut" && transitionFrames > 0)
      cues.push({
        name: "whoosh",
        at: r3(Math.max(0, t.start - transitionFrames / fps)),
        gainDb: -14,
      });
    const props = resolveScene(s, ctx, assets);
    if (i === 0 || (s.kind === "kinetic" && props.bg === "accent"))
      cues.push({ name: "impact", at: r3(t.start + (i === 0 ? 0.02 : 0)), gainDb: -12 });
    for (const at of revealTimes(s.kind, props))
      cues.push({ name: "pop", at: r3(t.start + at), gainDb: -22 });
    return {
      id: s.id,
      kind: s.kind,
      from: t.startFrame,
      frames: t.frames,
      transition: { type: transitionFrames ? type : "cut", frames: transitionFrames },
      props,
    };
  });
  const captionsOn = !kineticOnly && style.captions !== "none" && video.captions?.burn !== false;
  // Kinetic scenes put the words on screen themselves, so captions stop before one begins.
  const quiet = scenes
    .filter((s) => s.kind === "kinetic")
    .map((s) => [(s.from - s.transition.frames) / fps, (s.from + s.frames) / fps]);
  const pages = captionPages(allWords)
    .map((p) => {
      const block = quiet.find(([a, b]) => p.start < b && p.end > a);
      return block ? { ...p, end: Math.min(p.end, block[0]) } : p;
    })
    .filter((p) => p.end - p.start > 0.15);
  return {
    film: {
      width,
      height,
      fps,
      frames: timing.totalFrames,
      lang: video.meta.lang,
      dir: video.meta.dir ?? (/^(ar|he|fa|ur)\b/.test(video.meta.lang) ? "rtl" : "ltr"),
      theme: themeOf(brand, preset ?? style.preset),
      style: {
        captions: captionsOn ? (style.captions ?? "pop") : "none",
        // Off unless asked: a bar at the very top sits under the platforms' own buttons and trips the margin check.
        progress: style.progress === true,
        grain: style.grain !== false,
        background: style.background ?? "aurora",
      },
      captions: captionsOn ? pages : [],
      scenes,
    },
    media,
    cues: spaceCues(cues),
    notes,
  };
}

/** Moments a scene reveals something, for the soft pop under it. */
function revealTimes(kind, p) {
  switch (kind) {
    case "list":
      return p.items.map((x) => x.at);
    case "steps":
      return p.steps.map((x) => x.at);
    case "chart":
      return p.data.map((x) => x.at);
    case "versus":
      return [p.left.at, p.right.at, p.verdict?.at].filter((x) => x !== undefined);
    case "nodes":
      return p.nodes.map((x) => x.at);
    case "number":
      return [p.at + 1.1];
    case "kinetic":
      return p.phrases.map((x) => x.start);
    default:
      return [];
  }
}

/** Keeps cues at least 0.25 s apart and at most 60, so the mix never turns into a rattle. */
function spaceCues(cues) {
  const sorted = [...cues].sort((a, b) => a.at - b.at);
  const out = [];
  for (const c of sorted) {
    const last = out[out.length - 1];
    if (last && c.at - last.at < 0.25) {
      const rank = { impact: 3, whoosh: 2, pop: 1 };
      if ((rank[c.name] ?? 0) > (rank[last.name] ?? 0)) out[out.length - 1] = c;
      continue;
    }
    out.push(c);
  }
  return out.slice(0, 60);
}
