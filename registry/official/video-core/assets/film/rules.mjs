// The scene kinds the Remotion engine draws, and the checks on their props. Pure: no file, no network, nothing
// run. check.mjs reports these problems before anything is rendered, so the React side can trust its input.
import { LANGS } from "../vendor/shiki.mjs";
import { LIMITS as SEQ_LIMITS, parseSequence } from "../seq/parse.mjs";
import { specProblems } from "../sim/rate-limit.mjs";

/** Every kind the engine draws, grouped by the format that mostly uses it. */
export const KINDS = [
  // explainer
  "title",
  "list",
  "number",
  "versus",
  "steps",
  "code",
  "terminal",
  "chart",
  "nodes",
  "request-flow",
  "rate-limit",
  "sequence",
  "quote",
  "broll",
  // kinetic
  "kinetic",
  // showcase
  "screen",
];

export const TRANSITIONS = ["cut", "fade", "slide", "whip", "zoom-through", "slash", "shatter"];
export const LAYOUTS = ["stack", "spotlight"];
export const CODE_LANGS = Object.keys(LANGS);
export const CODE_LIMITS = { chars: 1200, lines: 16, width: 48 };
export const MAX_DRAWN = 400;
export const KINETIC = { phrases: 12, perPhrase: 4, phraseText: 40, emph: 12, text: 120 };
export const KINETIC_BGS = ["black", "dark", "accent"];
export const KINETIC_EXITS = ["slide", "drop", "blur", "shatter", "none"];
export const DEVICES = ["phone", "laptop", "browser", "none"];
export const SCREEN = { zoom: 40, cursor: 600, ripples: 60, scale: 3, seconds: 600 };
export const FLOW = { nodes: 8, steps: 12, label: 22, caption: 40 };
export const TIERS = ["clients", "edge", "frontend", "backend", "async", "data", "external"];

const ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
const ASSET_ID = /^[a-z][a-z0-9-]{0,31}$/;
const num = (v) => typeof v === "number" && Number.isFinite(v);
const unit = (v) => num(v) && v >= 0 && v <= 1;
const isText = (v, max, min = 1) =>
  typeof v === "string" && v.trim().length >= min && v.length <= max;
const linesOf = (text) => String(text).replace(/\r\n?/g, "\n").replace(/\n$/, "").split("\n");
/** An item may be plain text or { text, on }; returns the text. */
export const itemText = (x) => (typeof x === "string" ? x : x?.text);

/** Problems with one scene's props, as readable strings ("field: what is wrong"). */
export function kindProblems(kind, props = {}, narrationCount = 0) {
  const p = props ?? {};
  const out = [];
  const title = (max = 60) => {
    if (p.title !== undefined && !isText(p.title, max)) out.push(`title: up to ${max} characters`);
  };
  const ons = (list, name) => {
    list.forEach((x, i) => {
      if (x && typeof x === "object" && x.on !== undefined && !isText(x.on, 60))
        out.push(`${name}[${i}].on: the spoken words that bring it in, up to 60 characters`);
    });
  };
  const layout = () => {
    if (p.layout !== undefined && !LAYOUTS.includes(p.layout))
      out.push(`layout: one of ${LAYOUTS.join(", ")}`);
  };
  switch (kind) {
    case "title":
      if (!isText(p.text, 90)) out.push("text: 1 to 90 characters (a hook is short)");
      if (p.subtitle !== undefined && !isText(p.subtitle, 120))
        out.push("subtitle: up to 120 characters");
      if (p.kicker !== undefined && !isText(p.kicker, 32)) out.push("kicker: up to 32 characters");
      break;
    case "quote":
      if (!isText(p.text, 240)) out.push("text: 1 to 240 characters");
      for (const k of ["by", "source"])
        if (p[k] !== undefined && !isText(p[k], 80)) out.push(`${k}: up to 80 characters`);
      break;
    case "list": {
      const items = p.items;
      if (!Array.isArray(items) || items.length < 1 || items.length > 6)
        out.push("items: 1 to 6 items");
      else {
        items.forEach((x, i) => {
          if (!isText(itemText(x), 60)) out.push(`items[${i}]: 1 to 60 characters`);
        });
        ons(items, "items");
      }
      if (p.heading !== undefined && !isText(p.heading, 60))
        out.push("heading: up to 60 characters");
      if (p.numbered !== undefined && typeof p.numbered !== "boolean")
        out.push("numbered: true or false");
      layout();
      break;
    }
    case "number":
      if (!num(p.value)) out.push("value: a number");
      if (p.from !== undefined && !num(p.from)) out.push("from: a number");
      if (!isText(p.label, 60)) out.push("label: 1 to 60 characters");
      if (p.unit !== undefined && !isText(p.unit, 12, 0)) out.push("unit: up to 12 characters");
      if (p.prefix !== undefined && !isText(p.prefix, 4, 0)) out.push("prefix: up to 4 characters");
      if (
        p.decimals !== undefined &&
        !(Number.isInteger(p.decimals) && p.decimals >= 0 && p.decimals <= 4)
      )
        out.push("decimals: a whole number from 0 to 4");
      if (p.on !== undefined && !isText(p.on, 60)) out.push("on: up to 60 characters");
      break;
    case "versus":
      for (const side of ["left", "right"]) {
        const s = p[side];
        if (!s || !isText(s.title, 24)) out.push(`${side}.title: 1 to 24 characters`);
        else if (!Array.isArray(s.points) || s.points.length < 1 || s.points.length > 4)
          out.push(`${side}.points: 1 to 4 short lines`);
        else
          s.points.forEach((x, i) => {
            if (!isText(itemText(x), 40)) out.push(`${side}.points[${i}]: 1 to 40 characters`);
          });
      }
      if (p.verdict !== undefined && !isText(p.verdict, 80))
        out.push("verdict: up to 80 characters");
      title();
      break;
    case "steps":
      if (!Array.isArray(p.steps) || p.steps.length < 2 || p.steps.length > 6)
        out.push("steps: 2 to 6 steps");
      else {
        p.steps.forEach((s, i) => {
          if (!isText(s?.label, 40)) out.push(`steps[${i}].label: 1 to 40 characters`);
          if (s?.detail !== undefined && !isText(s.detail, 80))
            out.push(`steps[${i}].detail: up to 80 characters`);
        });
        ons(p.steps, "steps");
      }
      title();
      layout();
      break;
    case "code":
      out.push(...codeProblems(p, narrationCount));
      break;
    case "terminal":
      if (!Array.isArray(p.lines) || p.lines.length < 1 || p.lines.length > 8)
        out.push("lines: 1 to 8 lines");
      else {
        p.lines.forEach((l, i) => {
          if (!isText(l?.text, 48)) out.push(`lines[${i}].text: 1 to 48 characters`);
          if (l?.kind !== undefined && !["cmd", "out"].includes(l.kind))
            out.push(`lines[${i}].kind: cmd or out`);
        });
        ons(p.lines, "lines");
      }
      if (p.prompt !== undefined && !isText(p.prompt, 12, 0))
        out.push("prompt: up to 12 characters");
      title();
      break;
    case "chart":
      if (p.type !== undefined && !["bar", "line"].includes(p.type)) out.push("type: bar or line");
      if (!Array.isArray(p.data) || p.data.length < 2 || p.data.length > 10)
        out.push("data: 2 to 10 points of {label, value}");
      else {
        p.data.forEach((d, i) => {
          if (!isText(d?.label, 16)) out.push(`data[${i}].label: 1 to 16 characters`);
          if (!num(d?.value)) out.push(`data[${i}].value: a number (real data only)`);
        });
        ons(p.data, "data");
      }
      if (p.unit !== undefined && !isText(p.unit, 12, 0)) out.push("unit: up to 12 characters");
      title();
      break;
    case "nodes": {
      if (!Array.isArray(p.nodes) || p.nodes.length < 2 || p.nodes.length > 7)
        out.push("nodes: 2 to 7 of {id, label}");
      if (!Array.isArray(p.edges) || p.edges.length < 1 || p.edges.length > 12)
        out.push("edges: 1 to 12 of {from, to}");
      if (out.length) break;
      const ids = new Set();
      p.nodes.forEach((n, i) => {
        if (!ID.test(n?.id ?? "")) out.push(`nodes[${i}].id: lowercase letters, digits, dashes`);
        else if (ids.has(n.id)) out.push(`nodes[${i}].id: "${n.id}" is used twice`);
        ids.add(n?.id);
        if (!isText(n?.label, 20)) out.push(`nodes[${i}].label: 1 to 20 characters`);
      });
      p.edges.forEach((e, i) => {
        if (!ids.has(e?.from) || !ids.has(e?.to))
          out.push(`edges[${i}]: from and to must be listed nodes`);
      });
      ons(p.nodes, "nodes");
      title();
      break;
    }
    case "request-flow":
      out.push(...flowProblems(p));
      break;
    case "rate-limit":
      out.push(...specProblems(p));
      for (const k of ["log", "events", "results", "allowed", "rejected"])
        if (k in p)
          out.push(
            `${k}: results are computed from the seed; remove it (the animation is the simulation)`,
          );
      if (Number.isInteger(p.count) && p.count > MAX_DRAWN)
        out.push(`count: a scene draws at most ${MAX_DRAWN} requests (each is a dot); use fewer`);
      break;
    case "sequence": {
      if (!isText(p.source, SEQ_LIMITS.source)) {
        out.push(`source: write the diagram as text, up to ${SEQ_LIMITS.source} characters`);
        break;
      }
      const parsed = parseSequence(p.source);
      out.push(...parsed.problems);
      if (!parsed.problems.length && parsed.participants.length > 4)
        out.push("source: at most 4 participants fit a vertical frame");
      title();
      break;
    }
    case "broll":
      if (!ASSET_ID.test(p.asset ?? "")) out.push("asset: the id of an image or video in assets");
      if (p.fit !== undefined && !["cover", "contain"].includes(p.fit))
        out.push("fit: cover or contain");
      if (p.caption !== undefined && !isText(p.caption, 60))
        out.push("caption: up to 60 characters");
      break;
    case "kinetic":
      out.push(...kineticProblems(p));
      break;
    case "screen":
      out.push(...screenProblems(p));
      break;
    default:
      out.push(`kind "${kind}" is not built (have: ${KINDS.join(", ")})`);
  }
  return out;
}

/** Problems with a code scene's props. `narrationCount` is the number of narration lines of the scene. */
export function codeProblems(props, narrationCount = 0) {
  const p = [];
  if (!CODE_LANGS.includes(props.language))
    p.push(`language: must be one of ${CODE_LANGS.join(", ")}`);
  const hasCode = typeof props.code === "string";
  const hasDiff = Boolean(props.diff && typeof props.diff === "object");
  if (hasCode === hasDiff) p.push('give either "code" or "diff", not both and not neither');
  const texts = hasDiff ? [props.diff.before, props.diff.after] : [props.code];
  texts.forEach((t, i) => {
    const at = hasDiff ? (i === 0 ? "diff.before" : "diff.after") : "code";
    if (typeof t !== "string" || !t.trim()) return p.push(`${at}: must be non-empty text`);
    if (t.length > CODE_LIMITS.chars) p.push(`${at}: longer than ${CODE_LIMITS.chars} characters`);
    const ls = linesOf(t);
    if (ls.length > CODE_LIMITS.lines)
      p.push(`${at}: more than ${CODE_LIMITS.lines} lines (split it over two scenes)`);
    if (ls.some((l) => l.length > CODE_LIMITS.width))
      p.push(`${at}: a line is longer than ${CODE_LIMITS.width} characters (too small on a phone)`);
  });
  const total = hasCode ? linesOf(props.code).length : 0;
  (props.focus ?? []).forEach((f, i) => {
    const at = `focus[${i}]`;
    const [a, b] = f?.lines ?? [];
    if (!Number.isInteger(a) || !Number.isInteger(b) || a < 1 || b < a)
      p.push(`${at}.lines: must be [first, last] line numbers, counting from 1`);
    else if (total && b > total) p.push(`${at}.lines: line ${b} is past the end (${total} lines)`);
    const hasLine = Number.isInteger(f?.line);
    const hasAt = typeof f?.at === "number";
    const hasOn = typeof f?.on === "string";
    if (Number(hasLine) + Number(hasAt) + Number(hasOn) !== 1)
      p.push(
        `${at}: give one of "line" (a narration line, from 0), "at" (seconds) or "on" (a spoken word)`,
      );
    if (hasLine && !(f.line >= 0 && f.line < narrationCount))
      p.push(`${at}.line: the scene has ${narrationCount} narration line(s)`);
    if (hasAt && !(f.at >= 0)) p.push(`${at}.at: must be 0 or more`);
  });
  if (hasDiff && props.focus?.length) p.push("focus: not used with diff");
  if (props.title !== undefined && !isText(props.title, 40)) p.push("title: up to 40 characters");
  if (props.file !== undefined && !isText(props.file, 40)) p.push("file: up to 40 characters");
  return p;
}

/** Line diff by longest common subsequence: rows of { type: "same" | "del" | "add", text }. */
export function diffRows(before, after) {
  const a = linesOf(before);
  const b = linesOf(after);
  const m = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--)
      m[i][j] = a[i] === b[j] ? m[i + 1][j + 1] + 1 : Math.max(m[i + 1][j], m[i][j + 1]);
  const rows = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      rows.push({ type: "same", text: a[i++] });
      j++;
    } else if (i < a.length && (j === b.length || m[i + 1][j] >= m[i][j + 1])) {
      rows.push({ type: "del", text: a[i++] });
    } else rows.push({ type: "add", text: b[j++] });
  }
  return rows;
}

/** Problems with a request-flow scene's props. */
export function flowProblems(props) {
  const p = [];
  if ("model" in props || "flow" in props)
    return [
      "props: this scene does not read a model file; run arch-import and use the props it writes",
    ];
  const { nodes, edges, steps } = props;
  if (!Array.isArray(nodes) || nodes.length < 2 || nodes.length > FLOW.nodes)
    p.push(`nodes: between 2 and ${FLOW.nodes} components`);
  if (!Array.isArray(edges)) p.push("edges: a list of connections");
  if (!Array.isArray(steps) || steps.length < 1 || steps.length > FLOW.steps)
    p.push(`steps: between 1 and ${FLOW.steps} steps`);
  if (p.length) return p;
  const ids = new Set();
  nodes.forEach((n, i) => {
    if (!ID.test(n?.id ?? "")) p.push(`nodes[${i}].id: use lowercase letters, digits and dashes`);
    else if (ids.has(n.id)) p.push(`nodes[${i}].id: "${n.id}" is used twice`);
    ids.add(n?.id);
    if (!isText(n?.label, FLOW.label)) p.push(`nodes[${i}].label: 1 to ${FLOW.label} characters`);
    if (!TIERS.includes(n?.tier)) p.push(`nodes[${i}].tier: one of ${TIERS.join(", ")}`);
  });
  const edgeIds = new Set();
  edges.forEach((e, i) => {
    if (!ID.test(e?.id ?? "")) p.push(`edges[${i}].id: use lowercase letters, digits and dashes`);
    edgeIds.add(e?.id);
    if (!ids.has(e?.from) || !ids.has(e?.to))
      p.push(`edges[${i}]: from and to must be listed components`);
  });
  steps.forEach((s, i) => {
    const at = `steps[${i}]`;
    if (s?.edge !== undefined && !edgeIds.has(s.edge))
      p.push(`${at}.edge: "${s.edge}" is not in edges`);
    else if (s?.edge === undefined && !(typeof s?.event === "string" && ids.has(s?.node)))
      p.push(`${at}: give an edge, or an event with a listed node`);
    for (const k of ["label", "event"])
      if (s?.[k] !== undefined && (typeof s[k] !== "string" || s[k].length > FLOW.caption))
        p.push(`${at}.${k}: at most ${FLOW.caption} characters`);
    if (s?.ms !== undefined && !(num(s.ms) && s.ms >= 0))
      p.push(`${at}.ms: a number of milliseconds`);
  });
  return p;
}

/** Problems with a kinetic scene's props. */
export function kineticProblems(props) {
  const p = [];
  if (props.bg !== undefined && !KINETIC_BGS.includes(props.bg))
    p.push(`bg: one of ${KINETIC_BGS.join(", ")}`);
  if (props.exit !== undefined && !KINETIC_EXITS.includes(props.exit))
    p.push(`exit: one of ${KINETIC_EXITS.join(", ")}`);
  for (const k of ["grid", "vignette", "grain", "caption", "holdLast"])
    if (props[k] !== undefined && typeof props[k] !== "boolean") p.push(`${k}: true or false`);
  if (props.y !== undefined && !(num(props.y) && props.y >= 15 && props.y <= 85))
    p.push("y: 15 to 85 (percent down the frame)");
  if (props.text !== undefined && !isText(props.text, KINETIC.text))
    p.push(`text: up to ${KINETIC.text} characters (used only when the scene has no voice)`);
  const ph = props.phrases;
  if (ph !== undefined) {
    if (!Array.isArray(ph) || ph.length > KINETIC.phrases)
      p.push(`phrases: at most ${KINETIC.phrases}`);
    else
      ph.forEach((t, i) => {
        if (!isText(t, KINETIC.phraseText))
          p.push(`phrases[${i}]: 1 to ${KINETIC.phraseText} characters`);
        else if (t.trim().split(/\s+/).length > KINETIC.perPhrase)
          p.push(`phrases[${i}]: at most ${KINETIC.perPhrase} words on screen at once`);
      });
  }
  if (
    props.emph !== undefined &&
    (!Array.isArray(props.emph) ||
      props.emph.length > KINETIC.emph ||
      props.emph.some((e) => !isText(e, 24)))
  )
    p.push(`emph: up to ${KINETIC.emph} words`);
  const cards = props.cards ?? [];
  if (!Array.isArray(cards) || cards.length > 2) p.push("cards: at most 2");
  else
    cards.forEach((c, i) => {
      const at = `cards[${i}]`;
      if (!isText(c?.title, 24)) p.push(`${at}.title: 1 to 24 characters`);
      if (!Array.isArray(c?.rows) || c.rows.length < 1 || c.rows.length > 5)
        p.push(`${at}.rows: 1 to 5 rows`);
      else
        c.rows.forEach((r, k) => {
          if (!isText(r?.text, 32)) p.push(`${at}.rows[${k}].text: 1 to 32 characters`);
          if (r?.tag !== undefined && !isText(r.tag, 12, 0))
            p.push(`${at}.rows[${k}].tag: up to 12 characters`);
          if (r?.bind !== undefined && !(Number.isInteger(r.bind) && r.bind >= 0))
            p.push(`${at}.rows[${k}].bind: a word number`);
        });
      for (const k of ["x", "y"])
        if (c?.[k] !== undefined && !(num(c[k]) && c[k] >= 20 && c[k] <= 80))
          p.push(`${at}.${k}: 20 to 80`);
      if (
        c?.tilt !== undefined &&
        !(
          Array.isArray(c.tilt) &&
          c.tilt.length === 2 &&
          c.tilt.every((v) => num(v) && Math.abs(v) <= 40)
        )
      )
        p.push(`${at}.tilt: [x, y] degrees, at most 40`);
      if (c?.at !== undefined && !(num(c.at) && c.at >= 0))
        p.push(`${at}.at: seconds from the scene start`);
    });
  const flow = props.flow;
  if (flow !== undefined) {
    if (!flow || !Array.isArray(flow.nodes) || flow.nodes.length < 2 || flow.nodes.length > 5)
      p.push("flow.nodes: 2 to 5 labels");
    else
      flow.nodes.forEach((n, i) => {
        if (!isText(n, 16)) p.push(`flow.nodes[${i}]: 1 to 16 characters`);
      });
    if (flow?.at !== undefined && !(num(flow.at) && flow.at >= 0))
      p.push("flow.at: seconds from the scene start");
  }
  return p;
}

/** Problems with a screen scene's props. */
export function screenProblems(props) {
  const out = [];
  const time = (v) => num(v) && v >= 0 && v <= SCREEN.seconds;
  if (!ASSET_ID.test(props.asset ?? "")) out.push("asset: name the id of the recording in assets");
  if (props.pip !== undefined && !ASSET_ID.test(props.pip)) out.push("pip: must be an asset id");
  if (props.device !== undefined && !DEVICES.includes(props.device))
    out.push(`device: one of ${DEVICES.join(", ")}`);
  const vp = props.viewport;
  if (vp !== undefined) {
    const ok = (n) => Number.isInteger(n) && n >= 200 && n <= 4000;
    if (!vp || !ok(vp.w) || !ok(vp.h)) out.push("viewport: {w, h} in pixels, 200 to 4000");
  }
  const list = (key, max) => {
    const v = props[key];
    if (v === undefined) return [];
    if (!Array.isArray(v)) {
      out.push(`${key}: must be a list`);
      return [];
    }
    if (v.length > max) out.push(`${key}: at most ${max} entries`);
    return v.slice(0, max);
  };
  let prevEnd = 0;
  list("zoom", SCREEN.zoom).forEach((z, i) => {
    const at = `zoom[${i}]`;
    if (!z || typeof z !== "object") return void out.push(`${at}: must be an object`);
    if (!time(z.at) || !(z.dur > 0 && z.dur <= 30))
      return void out.push(`${at}: at (seconds) and dur (0 to 30 s) are needed`);
    if (!unit(z.x) || !unit(z.y)) out.push(`${at}: x and y are 0 to 1 across the recording`);
    if (!(z.scale >= 1 && z.scale <= SCREEN.scale)) out.push(`${at}.scale: 1 to ${SCREEN.scale}`);
    if (z.at < prevEnd - 1e-6)
      out.push(`${at}: starts before the previous zoom ends; move or shorten`);
    prevEnd = z.at + z.dur;
  });
  let prevT = -1;
  list("cursor", SCREEN.cursor).forEach((c, i) => {
    if (!c || !time(c.t) || !unit(c.x) || !unit(c.y))
      return void out.push(`cursor[${i}]: t (seconds), x and y (0 to 1) are needed`);
    if (c.t < prevT) out.push(`cursor[${i}].t: points must be in time order`);
    prevT = c.t;
  });
  list("ripples", SCREEN.ripples).forEach((c, i) => {
    if (!c || !time(c.t) || !unit(c.x) || !unit(c.y))
      out.push(`ripples[${i}]: t (seconds), x and y (0 to 1) are needed`);
  });
  if (props.title !== undefined && !isText(props.title, 60)) out.push("title: up to 60 characters");
  if (props.callouts !== undefined) {
    if (!Array.isArray(props.callouts) || props.callouts.length > 8)
      out.push("callouts: at most 8");
    else
      props.callouts.forEach((c, i) => {
        if (!isText(c?.text, 32) || !time(c?.at))
          out.push(`callouts[${i}]: {text up to 32 characters, at seconds}`);
      });
  }
  return out;
}
