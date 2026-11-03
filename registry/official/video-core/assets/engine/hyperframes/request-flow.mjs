// The `request-flow` scene: components laid out by tier, a packet travelling the connections of one flow step by
// step, the step's caption and its `file:line` evidence underneath. Props come from arch-import (see
// ../../arch/import.mjs); the scene never reads a model file. Every string is escaped.
import { IN, esc, fadeUp } from "./shared.mjs";

export const LIMITS = { nodes: 10, steps: 14, label: 24, caption: 40 };
const TIERS = ["clients", "edge", "frontend", "backend", "async", "data", "external"];
const ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
const NODE_H = 10;
const r2 = (n) => Math.round(n * 100) / 100;

/** Problems with a request-flow scene's props, as readable strings. */
export function flowProblems(props) {
  const p = [];
  if ("model" in props || "flow" in props)
    return [
      "props: this scene does not read a model file; run arch-import and use the props it writes",
    ];
  const { nodes, edges, steps } = props;
  if (!Array.isArray(nodes) || nodes.length < 2 || nodes.length > LIMITS.nodes)
    p.push(`nodes: between 2 and ${LIMITS.nodes} components`);
  if (!Array.isArray(edges)) p.push("edges: a list of connections");
  if (!Array.isArray(steps) || steps.length < 1 || steps.length > LIMITS.steps)
    p.push(`steps: between 1 and ${LIMITS.steps} steps`);
  if (p.length) return p;
  const ids = new Set();
  nodes.forEach((n, i) => {
    if (!ID.test(n?.id ?? "")) p.push(`nodes[${i}].id: use lowercase letters, digits and dashes`);
    else if (ids.has(n.id)) p.push(`nodes[${i}].id: "${n.id}" is used twice`);
    ids.add(n?.id);
    if (typeof n?.label !== "string" || !n.label.trim() || n.label.length > LIMITS.label)
      p.push(`nodes[${i}].label: 1 to ${LIMITS.label} characters`);
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
      if (s?.[k] !== undefined && (typeof s[k] !== "string" || s[k].length > LIMITS.caption))
        p.push(`${at}.${k}: at most ${LIMITS.caption} characters`);
    if (s?.ms !== undefined && !(typeof s.ms === "number" && s.ms >= 0))
      p.push(`${at}.ms: a number of milliseconds`);
  });
  return p;
}

/**
 * Positions: one row per tier present, components spread across the row. When every tier holds a single
 * component (a plain chain), the components zig-zag between two columns, so the picture uses the width and the
 * text can be larger.
 */
function layout(props) {
  const tiers = TIERS.filter((t) => props.nodes.some((n) => n.tier === t));
  const widest = Math.max(...tiers.map((t) => props.nodes.filter((n) => n.tier === t).length));
  const pos = new Map();
  // Hub and spokes: one component on every connection (an app and what it talks to). The hub sits on the left,
  // the others in a column on the right in tier order, so no line crosses a box.
  const hub = props.nodes.find(
    (n) => props.edges.length >= 2 && props.edges.every((e) => e.from === n.id || e.to === n.id),
  );
  if (hub && props.nodes.length >= 3) {
    const spokes = props.nodes
      .filter((n) => n !== hub)
      .sort((a, b) => TIERS.indexOf(a.tier) - TIERS.indexOf(b.tier));
    const pitch = r2(Math.min(20, 100 / spokes.length));
    spokes.forEach((n, i) =>
      pos.set(n.id, { x: 74, y: r2(8 + pitch * (i + 0.5)), w: 40, h: NODE_H }),
    );
    pos.set(hub.id, { x: 24, y: r2(8 + (pitch * spokes.length) / 2), w: 36, h: NODE_H });
    return { pos, w: 40, bottom: r2(8 + pitch * spokes.length) };
  }
  if (widest === 1 && tiers.length >= 3) {
    const rowH = 15;
    tiers.forEach((t, ri) => {
      const n = props.nodes.find((x) => x.tier === t);
      pos.set(n.id, { x: ri % 2 ? 73 : 27, y: r2(8 + ri * rowH + NODE_H / 2), w: 40, h: NODE_H });
    });
    return { pos, w: 40, bottom: r2(8 + tiers.length * rowH) };
  }
  const w = r2(Math.min(30, (100 - 4) / widest - 3));
  const rowH = r2(Math.min(26, 120 / tiers.length));
  tiers.forEach((t, ri) => {
    const row = props.nodes.filter((n) => n.tier === t);
    row.forEach((n, k) => {
      pos.set(n.id, {
        x: r2(((k + 0.5) * 100) / row.length),
        y: r2(8 + ri * rowH + NODE_H / 2),
        w,
        h: NODE_H,
      });
    });
  });
  return { pos, w, bottom: r2(8 + tiers.length * rowH) };
}

/** Where a line from `a` toward `b` leaves a's box. */
function edgePoint(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const k = Math.min(
    dx ? a.w / 2 / Math.abs(dx) : Infinity,
    dy ? a.h / 2 / Math.abs(dy) : Infinity,
  );
  return { x: r2(a.x + dx * k), y: r2(a.y + dy * k) };
}

export function requestFlow(s, ctx) {
  const props = s.props;
  const bad = flowProblems(props);
  if (bad.length) throw new Error(`Request-flow scene cannot be drawn: ${bad[0]}`);
  const lay = layout(props);
  const byEdge = new Map(props.edges.map((e) => [e.id, e]));
  const n = props.steps.length;
  const plan = [];
  let html = "";
  if (props.title) {
    html += `<h2 id="${ctx.prefix}-h" class="heading">${esc(props.title)}</h2>`;
    plan.push({
      id: `${ctx.prefix}-h`,
      frames: fadeUp(ctx.first, ctx.rise),
      at: ctx.at,
      dur: IN,
      ease: "out",
    });
  }
  const perLine = ctx.lines.length === n;
  const gap = Math.max(0.8, (ctx.seconds - 1.4) / n);
  // Steps marked `together` start with the one before; the others go one after another.
  const times = [];
  let slot = 0;
  props.steps.forEach((st, i) => {
    if (perLine) return times.push(ctx.lines[i].start);
    if (i && st.together) return times.push(times[i - 1]);
    times.push(0.6 + slot * gap);
    slot += 1;
  });
  const T = (i) => ctx.at + times[i];
  const end = (i) => {
    const next = times.slice(i + 1).find((t) => t > times[i]);
    return ctx.at + (next ?? ctx.seconds - 0.4);
  };

  const H = r2(lay.bottom + 20);
  let svg = `<svg id="${ctx.prefix}-rf" class="rf" viewBox="0 0 100 ${H}" role="img" aria-label="${esc(props.title ?? "Request flow")}" dir="ltr">`;
  plan.push({
    id: `${ctx.prefix}-rf`,
    frames: [{ opacity: ctx.first ? 1 : 0 }, { opacity: 1 }],
    at: ctx.at,
    dur: IN,
    ease: "out",
  });
  // Connections first (under the boxes), then the boxes.
  props.edges.forEach((e) => {
    const a = lay.pos.get(e.from);
    const b = lay.pos.get(e.to);
    const p1 = edgePoint(a, b);
    const p2 = edgePoint(b, a);
    svg += `<line class="cn" x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}"/>`;
  });
  props.nodes.forEach((nd) => {
    const p = lay.pos.get(nd.id);
    const fs = Math.min(3.2, r2((p.w - 2) / (nd.label.length * 0.58)));
    svg += `<g id="${ctx.prefix}-n-${esc(nd.id)}"><rect class="nb" x="${r2(p.x - p.w / 2)}" y="${r2(p.y - p.h / 2)}" width="${p.w}" height="${p.h}" rx="0.8"/><text class="nt" x="${p.x}" y="${r2(p.y + fs * 0.35)}" style="font-size:${fs}px">${esc(nd.label)}</text></g>`;
  });
  // Steps: the connection lights up, a packet travels it, the caption (and evidence) shows until the next step.
  let cap = "";
  props.steps.forEach((st, i) => {
    const t = T(i);
    const idc = `${ctx.prefix}-s${i}`;
    let caption = st.label ?? st.event ?? "";
    if (st.ms !== undefined) caption += ` · ${st.ms} ms`;
    if (st.edge !== undefined) {
      const e = byEdge.get(st.edge);
      const [from, to] = st.reverse ? [e.to, e.from] : [e.from, e.to];
      const a = lay.pos.get(from);
      const b = lay.pos.get(to);
      const p1 = edgePoint(a, b);
      const p2 = edgePoint(b, a);
      svg += `<line id="${idc}-l" class="hot" x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}"/>`;
      svg += `<circle id="${idc}-p" class="pk ${st.reverse ? "res" : "req"}" cx="0" cy="0" r="1.5"/>`;
      const q = lay.pos.get(to);
      svg += `<rect id="${idc}-h" class="nh" x="${r2(q.x - q.w / 2)}" y="${r2(q.y - q.h / 2)}" width="${q.w}" height="${q.h}" rx="0.8"/>`;
      plan.push(
        {
          id: `${idc}-h`,
          frames: [
            { offset: 0, opacity: 0 },
            { offset: 0.1, opacity: 1 },
            { offset: 0.9, opacity: 1 },
            { offset: 1, opacity: 0 },
          ],
          at: t + 0.6,
          dur: Math.max(0.5, end(i) - t - 0.6),
          ease: "linear",
        },
        { id: `${idc}-l`, frames: [{ opacity: 0 }, { opacity: 1 }], at: t, dur: 0.25, ease: "out" },
        {
          id: `${idc}-p`,
          frames: [
            { offset: 0, opacity: 0, transform: `translate(${p1.x}px, ${p1.y}px)` },
            { offset: 0.12, opacity: 1, transform: `translate(${p1.x}px, ${p1.y}px)` },
            { offset: 0.88, opacity: 1, transform: `translate(${p2.x}px, ${p2.y}px)` },
            { offset: 1, opacity: 0, transform: `translate(${p2.x}px, ${p2.y}px)` },
          ],
          at: t,
          dur: 0.8,
          ease: "inOut",
        },
      );
    } else {
      const p = lay.pos.get(st.node);
      svg += `<circle id="${idc}-p" class="ev" cx="${p.x}" cy="${p.y}" r="${r2(p.h * 0.75)}" style="transform-origin:${p.x}px ${p.y}px"/>`;
      plan.push({
        id: `${idc}-p`,
        // The ring grows in, stays for the step, and goes when the next step starts.
        frames: [
          { offset: 0, opacity: 0, transform: "scale(0.6)" },
          { offset: 0.15, opacity: 1, transform: "scale(1)" },
          { offset: 0.85, opacity: 1, transform: "scale(1)" },
          { offset: 1, opacity: i + 1 < n ? 0 : 1, transform: "scale(1)" },
        ],
        at: t,
        dur: Math.max(0.6, end(i) - t),
        ease: "out",
      });
    }
    cap += `<g id="${idc}-c"><text class="cp" x="50" y="${r2(lay.bottom + 7)}">${esc(caption)}</text>${st.evidence ? `<text class="ev-t" x="50" y="${r2(lay.bottom + 12.5)}">${esc(st.evidence)}</text>` : ""}</g>`;
    plan.push({
      id: `${idc}-c`,
      frames: [
        { offset: 0, opacity: 0 },
        { offset: 0.08, opacity: 1 },
        { offset: 0.92, opacity: 1 },
        { offset: 1, opacity: i + 1 < n ? 0 : 1 },
      ],
      at: t,
      dur: Math.max(0.5, end(i) - t),
      ease: "linear",
    });
  });
  svg += cap;
  if (props.shown && props.shown.of > props.shown.nodes)
    svg += `<text class="sh" x="50" y="${r2(H - 1.5)}">${esc(props.shown.nodes)} of ${esc(props.shown.of)} components shown</text>`;
  svg += "</svg>";
  return { html: html + svg, plan };
}

export const requestFlowCss = (brand) => `
.rf{width:100%;height:auto;max-height:100%;flex:0 1 auto;min-height:0;font-family:inherit}
.rf .cn{stroke:${brand.colors.muted};stroke-width:.3}
.rf .hot{stroke:${brand.colors.accent};stroke-width:.7;opacity:0}
.rf .nh{fill:none;stroke:${brand.colors.accent};stroke-width:.7;opacity:0}
.rf .nb{fill:${brand.colors.bg};stroke:${brand.colors.fg};stroke-width:.35}
.rf .nt{fill:${brand.colors.fg};font-weight:700;text-anchor:middle}
.rf .pk{opacity:0}
.rf .req{fill:${brand.colors.accent}}
.rf .res{fill:${brand.colors.fg}}
.rf .ev{fill:none;stroke:${brand.colors.accent};stroke-width:.6;opacity:0}
.rf .cp{fill:${brand.colors.fg};font-size:3.4px;font-weight:700;text-anchor:middle}
.rf .ev-t{fill:${brand.colors.muted};font:400 2.3px ui-monospace,Menlo,monospace;text-anchor:middle}
.rf .sh{fill:${brand.colors.muted};font-size:2.2px;text-anchor:middle}
`;
