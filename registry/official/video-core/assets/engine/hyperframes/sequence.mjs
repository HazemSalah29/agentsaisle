// The `sequence` scene: an animated sequence diagram. Messages and notes appear one at a time, in order, each
// with its narration line when there is one per row; earlier rows dim so one idea moves at a time.
// Source text is parsed by ../../seq/parse.mjs and every string is escaped.
import { LIMITS, parseSequence } from "../../seq/parse.mjs";
import { IN, esc, fadeUp } from "./shared.mjs";

export { LIMITS };
const TOP = 16;
const MIN_FONT = 2;
const r2 = (n) => Math.round(n * 100) / 100;

/** Positions for the parsed diagram: participant centres, row baselines and a font size per row that fits. */
function layout(parsed) {
  const n = parsed.participants.length;
  const slot = 100 / n;
  const centre = new Map(parsed.participants.map((p, k) => [p.id, r2((k + 0.5) * slot)]));
  // Few rows get more room, so the diagram fills the frame; many rows stay compact.
  const ROW = Math.max(9.5, Math.min(15, (125 - TOP) / parsed.items.length));
  const rows = parsed.items.map((it, i) => {
    const y = TOP + i * ROW;
    let width;
    if (it.type === "msg") {
      width =
        it.from === it.to
          ? // A message to itself loops on the side of its lifeline that has more room.
            Math.max(100 - centre.get(it.from), centre.get(it.from)) - 9
          : Math.abs(centre.get(it.to) - centre.get(it.from)) - 3;
    } else {
      const xs = it.over.map((id) => centre.get(id));
      width = Math.max(...xs) - Math.min(...xs) + slot * 0.85;
    }
    const fs = Math.min(3.2, r2(width / (it.text.length * 0.56)));
    return { y, fs, width };
  });
  return { slot, centre, rows, height: r2(TOP + parsed.items.length * ROW + 2) };
}

/** Problems with a sequence scene's props, as readable strings. */
export function sequenceProblems(props) {
  const src = props.source;
  if (typeof src !== "string" || !src.trim()) return ["source: write the diagram as text"];
  if (src.length > LIMITS.source) return [`source: longer than ${LIMITS.source} characters`];
  const parsed = parseSequence(src);
  const out = [...parsed.problems];
  if (!parsed.problems.length) {
    const lay = layout(parsed);
    parsed.items.forEach((it, i) => {
      if (lay.rows[i].fs < MIN_FONT)
        out.push(
          `"${it.text.slice(0, 20)}": too long for the space it has (shorten it, or use fewer participants)`,
        );
    });
  }
  return out;
}

export function sequence(s, ctx) {
  const parsed = parseSequence(s.props.source);
  const bad = sequenceProblems(s.props);
  if (bad.length) throw new Error(`Sequence scene cannot be drawn: ${bad[0]}`);
  const lay = layout(parsed);
  const n = parsed.items.length;
  const plan = [];
  let html = "";
  if (s.props.title) {
    html += `<h2 id="${ctx.prefix}-h" class="heading">${esc(s.props.title)}</h2>`;
    plan.push({
      id: `${ctx.prefix}-h`,
      frames: fadeUp(ctx.first, ctx.rise),
      at: ctx.at,
      dur: IN,
      ease: "out",
    });
  }
  const perLine = ctx.lines.length === n;
  const step = Math.max(0.25, (ctx.seconds - 1.4) / n);
  const when = (i) => ctx.at + (perLine ? ctx.lines[i].start : 0.6 + i * step);

  const mid = `${ctx.prefix}-ah`;
  let svg = `<svg id="${ctx.prefix}-sq" class="sq" viewBox="0 0 100 ${lay.height}" role="img" aria-label="${esc(s.props.title ?? "Sequence diagram")}" dir="ltr">`;
  svg += `<defs><marker id="${mid}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="4.5" markerHeight="4.5" orient="auto"><path class="ah" d="M0 0L10 5L0 10z"/></marker></defs>`;
  parsed.participants.forEach((p) => {
    const x = lay.centre.get(p.id);
    const fs = Math.min(3.2, r2((lay.slot - 3) / (p.label.length * 0.6)));
    svg += `<line class="life" x1="${x}" x2="${x}" y1="9" y2="${lay.height - 1}"/>`;
    svg += `<rect class="head" x="${r2(x - lay.slot / 2 + 1)}" y="2" width="${r2(lay.slot - 2)}" height="7" rx="0.6"/>`;
    svg += `<text class="hl" x="${x}" y="6.6" style="font-size:${fs}px">${esc(p.label)}</text>`;
  });
  plan.push({
    id: `${ctx.prefix}-sq`,
    frames: [{ opacity: ctx.first ? 1 : 0 }, { opacity: 1 }],
    at: ctx.at,
    dur: IN,
    ease: "out",
  });

  parsed.items.forEach((it, i) => {
    const row = lay.rows[i];
    const t = when(i);
    let g;
    let dir = 1;
    if (it.type === "msg") {
      const x1 = lay.centre.get(it.from);
      const x2 = lay.centre.get(it.to);
      const style = `style="font-size:${row.fs}px"`;
      if (it.from === it.to) {
        const side = x1 > 50 ? -1 : 1;
        const anchor = side > 0 ? "start" : "end";
        g = `<path class="arr ${it.dashed ? "rep" : "req"}" d="M${x1} ${row.y + 0.6} h${6 * side} v4.5 h${-5.4 * side}" marker-end="url(#${mid})"/><text class="ml" x="${x1 + 8 * side}" y="${row.y + 3.6}" style="font-size:${row.fs}px;text-anchor:${anchor}">${esc(it.text)}</text>`;
      } else {
        dir = x2 > x1 ? 1 : -1;
        const a = x1 + dir * 0.6;
        const b = x2 - dir * 0.6;
        g = `<line class="arr ${it.dashed ? "rep" : "req"}" x1="${a}" x2="${b}" y1="${row.y + 3.8}" y2="${row.y + 3.8}" marker-end="url(#${mid})"/><text class="ml" x="${r2((x1 + x2) / 2)}" y="${row.y + 2.2}" ${style}>${esc(it.text)}</text>`;
      }
    } else {
      const xs = it.over.map((id) => lay.centre.get(id));
      const lo = Math.min(...xs) - lay.slot * 0.42;
      const hi = Math.max(...xs) + lay.slot * 0.42;
      g = `<rect class="note" x="${r2(lo)}" y="${row.y - 0.8}" width="${r2(hi - lo)}" height="6.2" rx="0.6"/><text class="nl" x="${r2((lo + hi) / 2)}" y="${row.y + 3.2}" style="font-size:${row.fs}px">${esc(it.text)}</text>`;
    }
    svg += `<g id="${ctx.prefix}-w${i}"><g id="${ctx.prefix}-i${i}">${g}</g></g>`;
    plan.push({
      id: `${ctx.prefix}-i${i}`,
      frames: [
        { opacity: 0, transform: `translateX(${dir * -4}px)` },
        { opacity: 1, transform: "translateX(0px)" },
      ],
      at: t,
      dur: 0.4,
      ease: "out",
    });
    if (i + 1 < n)
      plan.push({
        id: `${ctx.prefix}-w${i}`,
        frames: [{ opacity: 1 }, { opacity: 0.4 }],
        at: when(i + 1),
        dur: 0.3,
        ease: "out",
      });
  });
  svg += "</svg>";
  return { html: html + svg, plan };
}

export const sequenceCss = (brand) => `
.sq{width:100%;height:auto;max-height:100%;flex:0 1 auto;min-height:0;font-family:inherit}
.sq .life{stroke:${brand.colors.muted};stroke-width:.25;stroke-dasharray:1 1}
.sq .head{fill:none;stroke:${brand.colors.fg};stroke-width:.35}
.sq .hl{fill:${brand.colors.fg};font-weight:700;text-anchor:middle}
.sq .arr{fill:none;stroke-width:.5}
.sq .req{stroke:${brand.colors.accent}}
.sq .rep{stroke:${brand.colors.fg};stroke-dasharray:1.6 1.2}
.sq .ah{fill:${brand.colors.fg}}
.sq .ml{fill:${brand.colors.fg};text-anchor:middle}
.sq .note{fill:none;stroke:${brand.colors.muted};stroke-width:.3}
.sq .nl{fill:${brand.colors.muted};text-anchor:middle}
`;
