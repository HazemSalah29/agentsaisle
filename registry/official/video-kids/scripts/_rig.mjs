// The puppet rig: an SVG character split into parts with pivots, kept as plain data (puppet.json). This module
// only checks and reads that data. A rig may come from the user or from a model, so every SVG fragment is
// parsed as text against an allow-list of shapes and attributes: no scripts, no links, no images, no styles,
// no external references. Nothing here touches the disk, the network or the page.

export const VISEMES = ["rest", "a", "e", "o", "u", "mbp", "fv", "l"];
export const REQUIRED = [
  "body",
  "head",
  "arm-l",
  "arm-r",
  "leg-l",
  "leg-r",
  "eyes-open",
  "eyes-closed",
  ...VISEMES.map((v) => `mouth-${v}`),
];
export const LIMITS = { parts: 40, fragment: 3000, total: 60000, box: 2000 };

const ID = /^[a-z][a-z0-9-]{0,23}$/;
const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const NUM = /^-?\d+(?:\.\d+)?$/;
const TAGS = new Set(["g", "path", "circle", "ellipse", "rect", "line", "polyline", "polygon"]);
const NUMERIC = new Set([
  "cx",
  "cy",
  "r",
  "rx",
  "ry",
  "x",
  "y",
  "x1",
  "y1",
  "x2",
  "y2",
  "width",
  "height",
  "stroke-width",
  "opacity",
  "fill-opacity",
  "stroke-opacity",
]);
const COLOR = new Set(["fill", "stroke"]);
const FREE = {
  d: /^[MmLlHhVvCcSsQqTtAaZz0-9eE+\-.,\s]+$/,
  points: /^[0-9eE+\-.,\s]+$/,
  transform: /^(?:\s*(?:translate|rotate|scale|skewX|skewY)\([-0-9.,\s]+\))+\s*$/,
  "stroke-linecap": /^(?:butt|round|square)$/,
  "stroke-linejoin": /^(?:miter|round|bevel)$/,
};

/** Problems with one SVG fragment (markup of shapes only), as readable strings. */
export function fragmentProblems(svg) {
  if (typeof svg !== "string" || !svg.trim()) return ["is empty"];
  if (svg.length > LIMITS.fragment) return [`is longer than ${LIMITS.fragment} characters`];
  const out = [];
  const stack = [];
  let rest = svg;
  while (rest.length) {
    const lt = rest.indexOf("<");
    const text = lt === -1 ? rest : rest.slice(0, lt);
    if (text.trim()) {
      out.push("has text outside a tag");
      break;
    }
    if (lt === -1) break;
    const m =
      /^<(\/?)([A-Za-z][A-Za-z0-9]*)((?:\s+[A-Za-z][A-Za-z0-9-]*="[^"<>&]*")*)\s*(\/?)>/.exec(
        rest.slice(lt),
      );
    if (!m) {
      out.push("has markup that is not a plain shape tag with quoted attributes");
      break;
    }
    const [whole, closing, name, attrs, selfClose] = m;
    rest = rest.slice(lt + whole.length);
    if (!TAGS.has(name)) {
      out.push(`uses <${name}>, which is not allowed (allowed: ${[...TAGS].join(", ")})`);
      continue;
    }
    if (closing) {
      if (stack.pop() !== name) out.push(`closes <${name}> that is not open`);
      continue;
    }
    for (const [, key, value] of attrs.matchAll(/([A-Za-z][A-Za-z0-9-]*)="([^"]*)"/g)) {
      if (NUMERIC.has(key)) {
        if (!NUM.test(value)) out.push(`${key} must be a number`);
      } else if (COLOR.has(key)) {
        if (value !== "none" && !HEX.test(value)) out.push(`${key} must be #hex or none`);
      } else if (FREE[key]) {
        if (!FREE[key].test(value))
          out.push(`${key} has characters or functions that are not allowed`);
      } else out.push(`attribute ${key} is not allowed`);
    }
    if (!selfClose) stack.push(name);
  }
  if (stack.length) out.push(`leaves <${stack[stack.length - 1]}> open`);
  return [...new Set(out)];
}

/** Problems with a whole rig, as readable strings. An empty list means the renderer can use it. */
export function rigProblems(rig) {
  const out = [];
  if (!rig || typeof rig !== "object" || Array.isArray(rig)) return ["the rig must be an object"];
  if (!ID.test(rig.name ?? "")) out.push("name: lower-case letters, digits and hyphens");
  const box = rig.box;
  const okSide = (n) => Number.isInteger(n) && n >= 50 && n <= LIMITS.box;
  if (!box || !okSide(box.w) || !okSide(box.h)) out.push("box: {w, h} whole pixels, 50 to 2000");
  const pal = rig.palette;
  if (!Array.isArray(pal) || pal.length < 3 || pal.length > 5 || !pal.every((c) => HEX.test(c)))
    out.push("palette: 3 to 5 colours written as #hex");
  if (!Array.isArray(rig.parts)) return [...out, "parts: must be a list"];
  if (rig.parts.length > LIMITS.parts) out.push(`parts: at most ${LIMITS.parts}`);
  const ids = new Set();
  let total = 0;
  for (const [i, p] of rig.parts.slice(0, LIMITS.parts).entries()) {
    const at = `parts[${i}]`;
    if (!p || typeof p !== "object") {
      out.push(`${at}: must be an object`);
      continue;
    }
    if (!ID.test(p.id ?? "")) out.push(`${at}.id: lower-case letters, digits and hyphens`);
    else if (ids.has(p.id)) out.push(`${at}.id: "${p.id}" is used twice`);
    else ids.add(p.id);
    const pv = p.pivot;
    if (
      !Array.isArray(pv) ||
      pv.length !== 2 ||
      !pv.every((n) => typeof n === "number" && Number.isFinite(n)) ||
      (box && (pv[0] < 0 || pv[0] > box.w || pv[1] < 0 || pv[1] > box.h))
    )
      out.push(`${at}.pivot: [x, y] inside the box`);
    for (const f of fragmentProblems(p.svg)) out.push(`${at} (${p.id}) svg ${f}`);
    total += typeof p.svg === "string" ? p.svg.length : 0;
  }
  if (total > LIMITS.total)
    out.push(`parts: the SVG is longer than ${LIMITS.total} characters in all`);
  for (const id of REQUIRED) if (!ids.has(id)) out.push(`parts: "${id}" is missing`);
  const parentOf = new Map(rig.parts.map((p) => [p?.id, p?.parent ?? null]));
  for (const [id, parent] of parentOf) {
    if (parent !== null && !ids.has(parent))
      out.push(`part "${id}": parent "${parent}" is not a part`);
    const seen = new Set([id]);
    for (let p = parent; p; p = parentOf.get(p) ?? null) {
      if (seen.has(p)) {
        out.push(`part "${id}": parents form a loop`);
        break;
      }
      seen.add(p);
    }
  }
  return out;
}

/** Parts as a tree (children in list order), roots first. Call only on a rig with no problems. */
export function partTree(rig) {
  const kids = new Map();
  for (const p of rig.parts) {
    const key = p.parent ?? null;
    if (!kids.has(key)) kids.set(key, []);
    kids.get(key).push(p);
  }
  const build = (p) => ({ ...p, children: (kids.get(p.id) ?? []).map(build) });
  return (kids.get(null) ?? []).map(build);
}
