// The pure part of a kinetic video: from the lines of script.md (the user's words) and a preset, decide each scene's
// layout, emphasis, exits and the transition into it, and write them as a video.json. Everything is a function of
// its input; no file is read or written here. Text on screen is only what the script says (the scene pops in the
// spoken words themselves), and cards and flows only appear when the user's script has `card:` or `flow:` lines.

export const LAYOUTS = ["stack", "slab"];
export const TRANSITIONS = ["slash", "shatter", "whip", "zoom-through", "cut"];
const STOP = new Set(
  "about after again against also because before being between could does doing during each from have having here into just like made make more most much must only other over same should some such than that their them then there these they this those through under until very want were what when where which while will with would your you're it's don't won't can't".split(
    " ",
  ),
);
const HEX = /^#[0-9a-fA-F]{6}$/;
const norm = (w) => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
export const wordsIn = (text) => text.trim().split(/\s+/).filter(Boolean);

/** One key word of a line when the user named none: the longest word of five or more letters that is not a filler word. Pure. */
export function autoEmph(text) {
  const cands = wordsIn(text)
    .map(norm)
    .filter((w) => w.length >= 5 && !STOP.has(w));
  if (!cands.length) return [];
  return [cands.reduce((a, b) => (b.length > a.length ? b : a))];
}

/** Problems with the lines and options, as readable strings. Pure. */
export function inputProblems(lines, opts, presets) {
  const p = [];
  if (!Array.isArray(lines) || lines.length < 2 || lines.length > 24)
    p.push("script: 2 to 24 narration lines");
  if (!presets[opts.preset]) p.push(`preset: one of ${Object.keys(presets).join(", ")}`);
  if (opts.accent !== undefined && !HEX.test(opts.accent)) p.push("accent: a #rrggbb colour");
  (lines ?? []).forEach((l) => {
    const n = wordsIn(l.text).length;
    if (n < 1 || n > 24)
      p.push(`[${l.id}]: 1 to 24 words a line (a kinetic line is short and punchy)`);
    const a = l.attrs ?? {};
    if (a.layout !== undefined && ![...LAYOUTS].includes(a.layout))
      p.push(`[${l.id}] layout: one of ${LAYOUTS.join(", ")}`);
    if (a.transition !== undefined && !TRANSITIONS.includes(a.transition))
      p.push(`[${l.id}] transition: one of ${TRANSITIONS.join(", ")}`);
    if (a.exit !== undefined && !["slide", "drop", "blur", "shatter", "none"].includes(a.exit))
      p.push(`[${l.id}] exit: slide, drop, blur, shatter or none`);
  });
  return p;
}

/** `Title|row;row;row` to a card (rows may carry a tag after "="), or null. */
export function parseCard(v) {
  if (!v) return null;
  const [title, rest = ""] = String(v).split("|");
  const rows = rest
    .split(";")
    .map((r) => r.trim())
    .filter(Boolean)
    .slice(0, 5)
    .map((r) => {
      const [text, tag] = r.split("=").map((x) => x.trim());
      return { text: text.slice(0, 32), ...(tag ? { tag: tag.slice(0, 12) } : {}) };
    });
  return title.trim() && rows.length
    ? { title: title.trim().slice(0, 24), rows, x: 50, y: 68, tilt: [14, -16] }
    : null;
}

/** `a>b>c` to a flow of 2 to 5 nodes, or null. */
export function parseFlow(v) {
  const nodes = String(v ?? "")
    .split(">")
    .map((n) => n.trim().slice(0, 16))
    .filter(Boolean)
    .slice(0, 5);
  return nodes.length >= 2 ? { nodes } : null;
}

/** The whole video. `lines` are [{ id, text, attrs }]. Returns { video, brand, summary }. Pure. */
export function planKinetic(lines, opts, presets) {
  const bad = inputProblems(lines, opts, presets);
  if (bad.length) throw new Error(bad[0]);
  const pre = presets[opts.preset];
  const accent = opts.accent ?? pre.accent;
  let slabs = 0;
  let sinceSlab = 0;
  const scenes = lines.map((l, k) => {
    const a = l.attrs ?? {};
    const n = wordsIn(l.text).length;
    const card = parseCard(a.card);
    const flow = parseFlow(a.flow);
    let layout = a.layout;
    if (!layout) {
      sinceSlab++;
      layout =
        n <= 3 && k > 0 && k < lines.length - 1 && sinceSlab >= pre.slabEvery && !card && !flow
          ? "slab"
          : "stack";
    }
    if (layout === "slab") {
      slabs++;
      sinceSlab = 0;
    }
    const slab = layout === "slab";
    const emph = a.emph
      ? a.emph
          .split(",")
          .map((w) => w.trim())
          .filter(Boolean)
          .slice(0, 4)
      : slab
        ? []
        : autoEmph(l.text);
    const transition =
      k === 0 ? undefined : (a.transition ?? pre.transitions[(k - 1) % pre.transitions.length]);
    const props = {
      bg: slab ? "accent" : "black",
      ...(slab ? {} : { grid: pre.grid, vignette: pre.vignette }),
      ...(pre.grain && !slab ? { grain: true } : {}),
      ...(pre.caption && !slab && !card && !flow ? { caption: true } : {}),
      emph,
      exit: a.exit ?? pre.exits[k % pre.exits.length],
      ...(card ? { cards: [card], y: 28 } : {}),
      ...(flow ? { flow, ...(card ? {} : { y: 22 }) } : {}),
    };
    return {
      id: `s${k + 1}`,
      kind: "kinetic",
      narration: [l.id],
      props,
      ...(transition && transition !== "cut" ? { transitionIn: transition } : {}),
    };
  });
  const video = {
    version: 1,
    meta: {
      title: String(opts.title ?? "Kinetic video").slice(0, 120),
      type: "kinetic",
      format: opts.format ?? "reel-9x16",
      fps: 30,
      lang: opts.lang ?? "en",
      brand: "brand/brand.json",
    },
    script: "script.md",
    style: {
      preset: ["volt", "ember", "ice", "grape"].includes(opts.preset) ? opts.preset : "volt",
      captions: "none",
    },
    voice: {
      provider: opts.voice ?? "kokoro",
      ...(opts.voice && opts.voice !== "kokoro" ? {} : { voiceId: "af_heart", speed: 1.05 }),
    },
    scenes,
  };
  return {
    video,
    brand: { colors: { bg: pre.bg, fg: "#ffffff", accent, muted: "#a8b0bb" } },
    summary: {
      scenes: scenes.length,
      slabs,
      transitions: scenes.filter((s) => s.transitionIn).length,
    },
  };
}
