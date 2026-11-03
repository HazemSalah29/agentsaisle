// Explainer scenes that show an idea instead of listing it: a counted number, a big stat, two cards against each
// other, steps, a cycle, a funnel, a 2x2 matrix and a small node graph. Each is a pure function from validated props
// to { html, plan }; every string is escaped; every piece enters on the word that names it (`on` picks the words) and
// falls back to even spacing when there is no voice. Numbers are the ones the author wrote: nothing is computed from
// data here except the in-between values of the counter and the geometry. Nothing touches the disk.
import { EASE_FN, r3 } from "./motion.mjs";
import {
  FIRST_BY,
  IN,
  LEAD,
  STAGGER,
  esc,
  fadeUp,
  focusOn,
  pathPlan,
  pulsePlan,
  rail,
  settle,
  spansOf,
  wordCursor,
} from "./shared.mjs";

export const DIAGRAM_KINDS = [
  "number",
  "callout",
  "versus",
  "steps",
  "cycle",
  "funnel",
  "matrix",
  "nodes",
];

export const LIMITS = {
  text: 60,
  title: 80,
  label: 40,
  steps: [2, 6],
  cycle: [3, 6],
  funnel: [3, 5],
  matrix: 8,
  nodes: [2, 7],
  points: 4,
};

const isText = (v, max, min = 1) =>
  typeof v === "string" && v.trim().length >= min && v.length <= max;
const inRange = (n, [lo, hi]) => Array.isArray(n) && n.length >= lo && n.length <= hi;

/** Problems with the props of one of the diagram scenes, as readable strings. */
export function diagramProblems(kind, p = {}) {
  const out = [];
  const title = () => {
    if (p.title !== undefined && !isText(p.title, LIMITS.title))
      out.push(`title: text of at most ${LIMITS.title} characters`);
  };
  if (p.focus !== undefined && typeof p.focus !== "boolean") out.push("focus: true or false");
  const ons = (list, name) => {
    if (list.some((x) => x?.on !== undefined && !isText(x.on, 60)))
      out.push(`${name}[].on: the spoken words that bring it in, up to 60 characters`);
  };
  if (kind === "number") {
    if (!Number.isFinite(p.value)) out.push("value: a number");
    if (p.from !== undefined && !Number.isFinite(p.from)) out.push("from: a number");
    if (!isText(p.label, LIMITS.text)) out.push(`label: text of 1 to ${LIMITS.text} characters`);
    if (p.unit !== undefined && !isText(p.unit, 12, 0))
      out.push("unit: text of at most 12 characters");
    if (
      p.decimals !== undefined &&
      !(Number.isInteger(p.decimals) && p.decimals >= 0 && p.decimals <= 4)
    )
      out.push("decimals: a whole number from 0 to 4");
  } else if (kind === "callout") {
    if (!isText(p.stat, 14)) out.push("stat: text of 1 to 14 characters, as you were given it");
    if (!isText(p.label, LIMITS.text)) out.push(`label: text of 1 to ${LIMITS.text} characters`);
    if (p.note !== undefined && !isText(p.note, 120))
      out.push("note: text of at most 120 characters");
  } else if (kind === "versus") {
    for (const side of ["left", "right"]) {
      const s = p[side];
      if (!s || !isText(s.title, LIMITS.label))
        out.push(`${side}.title: text of 1 to ${LIMITS.label} characters`);
      else if (!Array.isArray(s.points) || s.points.length < 1 || s.points.length > LIMITS.points)
        out.push(`${side}.points: 1 to ${LIMITS.points} short lines`);
      else if (s.points.some((x) => !isText(x, LIMITS.text)))
        out.push(`${side}.points: each up to ${LIMITS.text} characters`);
    }
    if (p.verdict !== undefined && !isText(p.verdict, 100))
      out.push("verdict: text of at most 100 characters");
    title();
  } else if (kind === "steps") {
    if (!inRange(p.steps, LIMITS.steps))
      out.push(`steps: ${LIMITS.steps[0]} to ${LIMITS.steps[1]} steps`);
    else {
      p.steps.forEach((s, i) => {
        if (!isText(s?.label, LIMITS.label))
          out.push(`steps[${i}].label: 1 to ${LIMITS.label} characters`);
        if (s?.detail !== undefined && !isText(s.detail, 80))
          out.push(`steps[${i}].detail: up to 80 characters`);
      });
      ons(p.steps, "steps");
    }
    title();
  } else if (kind === "cycle") {
    if (!inRange(p.nodes, LIMITS.cycle) || p.nodes.some((n) => !isText(n, LIMITS.label)))
      out.push(
        `nodes: ${LIMITS.cycle[0]} to ${LIMITS.cycle[1]} labels of up to ${LIMITS.label} characters`,
      );
    if (p.center !== undefined && !isText(p.center, LIMITS.label))
      out.push("center: up to 40 characters");
    title();
  } else if (kind === "funnel") {
    if (!inRange(p.stages, LIMITS.funnel))
      out.push(`stages: ${LIMITS.funnel[0]} to ${LIMITS.funnel[1]} stages`);
    else {
      p.stages.forEach((s, i) => {
        if (!isText(s?.label, LIMITS.label))
          out.push(`stages[${i}].label: 1 to ${LIMITS.label} characters`);
        if (s?.value !== undefined && !isText(s.value, 16))
          out.push(`stages[${i}].value: text as you were given it, up to 16 characters`);
      });
      ons(p.stages, "stages");
    }
    title();
  } else if (kind === "matrix") {
    for (const axis of ["x", "y"])
      if (!p[axis] || !isText(p[axis].low, 24) || !isText(p[axis].high, 24))
        out.push(`${axis}: { low, high } labels of up to 24 characters`);
    if (!Array.isArray(p.items) || p.items.length < 1 || p.items.length > LIMITS.matrix)
      out.push(`items: 1 to ${LIMITS.matrix} items`);
    else {
      p.items.forEach((s, i) => {
        if (!isText(s?.label, 24)) out.push(`items[${i}].label: 1 to 24 characters`);
        for (const k of ["x", "y"])
          if (!(Number.isFinite(s?.[k]) && s[k] >= 0 && s[k] <= 1))
            out.push(`items[${i}].${k}: a number from 0 to 1`);
      });
      ons(p.items, "items");
    }
    title();
  } else if (kind === "nodes") {
    if (!inRange(p.nodes, LIMITS.nodes))
      out.push(`nodes: ${LIMITS.nodes[0]} to ${LIMITS.nodes[1]} nodes`);
    else {
      const ids = new Set();
      p.nodes.forEach((n, i) => {
        if (typeof n?.id !== "string" || !/^[a-z0-9-]{1,16}$/.test(n.id))
          out.push(`nodes[${i}].id: lowercase letters, digits, hyphens`);
        else if (ids.has(n.id)) out.push(`nodes[${i}].id: "${n.id}" is used twice`);
        else ids.add(n.id);
        if (!isText(n?.label, LIMITS.label))
          out.push(`nodes[${i}].label: 1 to ${LIMITS.label} characters`);
      });
      if (!Array.isArray(p.edges) || p.edges.length < 1 || p.edges.length > 12)
        out.push("edges: 1 to 12 edges");
      else
        p.edges.forEach((e, i) => {
          if (!ids.has(e?.from) || !ids.has(e?.to) || e.from === e.to)
            out.push(`edges[${i}]: from and to must be two different node ids`);
        });
      ons(p.nodes, "nodes");
    }
    title();
  }
  return out;
}

/** With a heading already on screen the first item may come in within a second; without one, at once. */
const firstBy = (p) => (p.title ? FIRST_BY : 0.3);

/** In-times (film seconds) for `texts`: their spoken words, else even spacing; never out of order, never past the scene. */
function whens(ctx, texts, ons = [], start = 0.35, firstBy = FIRST_BY) {
  const cursor = wordCursor(ctx);
  const n = texts.length;
  const gap = Math.max(STAGGER, Math.min(1.1, (ctx.seconds - start - 1) / Math.max(1, n)));
  let prev = -Infinity;
  return texts.map((t, i) => {
    const said = cursor.find(ons[i] ?? t);
    const base = said !== null ? said - LEAD : ctx.at + start + i * gap;
    // something moves early: the first item does not wait for a late word
    const early = i === 0 ? Math.min(base, ctx.at + firstBy) : base;
    const at = Math.min(Math.max(early, prev + 0.08), ctx.at + ctx.seconds - IN);
    prev = at;
    return at;
  });
}

const head = (p, ctx) =>
  p.title
    ? {
        html: `<h2 id="${ctx.prefix}-h" class="heading">${esc(p.title)}</h2>`,
        plan: [
          {
            id: `${ctx.prefix}-h`,
            frames: fadeUp(ctx.first, ctx.rise),
            at: ctx.at,
            dur: IN,
            ease: "out",
          },
        ],
      }
    : { html: "", plan: [] };

const pop = (from = 0.9) => [
  { opacity: 0, transform: `scale(${from})` },
  { opacity: 1, transform: "scale(1)" },
];
const item = (id, at, frames, dur = IN, ease = "out") => ({ id, frames, at, dur, ease });
const fmt = (v, lang, decimals) =>
  new Intl.NumberFormat(lang, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(v);

function number(s, ctx) {
  const p = s.props;
  const decimals = p.decimals ?? Math.min(4, (String(p.value).split(".")[1] ?? "").length);
  const from = p.from ?? 0;
  const steps = 10;
  const t0 = whens(ctx, [p.label], [p.on], 0.25, 0.3)[0];
  const span = Math.max(0.5, Math.min(1.6, ctx.seconds - (t0 - ctx.at) - 0.8));
  const plan = [item(`${ctx.prefix}-box`, t0, pop(0.85), 0.35)];
  // The counter is a stack of the in-between values: each one shows for its slice of time, then its wrapper hides it.
  let html = "";
  for (let k = 0; k <= steps; k++) {
    const v = k === steps ? p.value : from + (p.value - from) * EASE_FN.out(k / steps);
    const id = `${ctx.prefix}-n${k}`;
    const text = `${esc(fmt(v, ctx.lang, decimals))}${p.unit ? `<small>${esc(p.unit)}</small>` : ""}`;
    const at = t0 + (k / steps) * span;
    plan.push(item(id, at, [{ opacity: 0 }, { opacity: 1 }], 0.02, "linear"));
    if (k < steps) {
      plan.push(
        item(`${id}w`, at + span / steps, [{ opacity: 1 }, { opacity: 0 }], 0.02, "linear"),
      );
      html += `<span id="${id}w" class="num-hide"><span id="${id}" class="num-step">${text}</span></span>`;
    } else html += `<span id="${id}" class="num-step">${text}</span>`;
  }
  plan.push(item(`${ctx.prefix}-l`, t0 + 0.1, fadeUp(false, ctx.rise / 2)));
  let tail = "";
  if (focusOn(p)) {
    // once the count is done, a rail fills under the label until the scene ends
    const r = rail(`${ctx.prefix}-r`, { at: t0 + span, until: ctx.at + ctx.seconds - 0.15 });
    tail = r.html;
    plan.push(...r.plan);
  }
  return {
    html: `<div id="${ctx.prefix}-box" class="num"><span class="num-steps">${html}</span></div><p id="${ctx.prefix}-l" class="num-label">${esc(p.label)}</p><div class="rail-wrap">${tail}</div>`,
    plan,
  };
}

function callout(s, ctx) {
  const p = s.props;
  const [a, b, c] = whens(ctx, [p.stat, p.label, p.note ?? ""], [p.on], 0, 0.3);
  const plan = [
    item(
      `${ctx.prefix}-st`,
      ctx.first ? ctx.at : a,
      ctx.first ? fadeUp(true, ctx.rise) : pop(0.8),
      0.45,
    ),
    item(
      `${ctx.prefix}-bar`,
      a + 0.15,
      [{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }],
      focusOn(p) ? Math.max(0.5, ctx.at + ctx.seconds - 0.15 - (a + 0.15)) : 0.5,
      focusOn(p) ? "linear" : "out",
    ),
    item(`${ctx.prefix}-l`, Math.max(b, a + 0.25), fadeUp(false, ctx.rise / 2)),
  ];
  let html = `<div id="${ctx.prefix}-st" class="co-stat">${esc(p.stat)}</div><div id="${ctx.prefix}-bar" class="co-bar"></div><p id="${ctx.prefix}-l" class="co-label">${esc(p.label)}</p>`;
  if (p.note) {
    html += `<p id="${ctx.prefix}-note" class="sub">${esc(p.note)}</p>`;
    plan.push(item(`${ctx.prefix}-note`, Math.max(c, a + 0.5), fadeUp(false, ctx.rise / 2)));
  }
  return { html, plan };
}

function versus(s, ctx) {
  const p = s.props;
  const h = head(p, ctx);
  const all = [...p.left.points, ...p.right.points];
  const t = whens(ctx, all, [], 0.6, firstBy(p));
  const focus = focusOn(p);
  const spans = spansOf(t, ctx);
  const plan = [...h.plan];
  const sides = ["left", "right"].map((side, k) => {
    const d = p[side];
    const id = `${ctx.prefix}-${side[0]}`;
    plan.push(
      item(
        id,
        ctx.at + 0.1 + k * 0.12,
        [
          { opacity: 0, transform: `translateX(${k ? "" : "-"}${r3(ctx.rise * 2)}px)` },
          { opacity: 1, transform: "translateX(0)" },
        ],
        0.55,
      ),
    );
    const base = k ? p.left.points.length : 0;
    const pts = d.points
      .map((x, i) => {
        const pid = `${id}-p${i}`;
        plan.push(item(pid, t[base + i], fadeUp(false, ctx.rise / 2)));
        const r = focus ? rail(`${pid}-r`, spans[base + i]) : null;
        if (r) plan.push(...r.plan, ...settle(pid, spans[base + i], base + i === all.length - 1));
        return `<li id="${pid}">${esc(x)}${r ? r.html : ""}</li>`;
      })
      .join("");
    return `<div id="${id}" class="vs-card vs-${side}"><h3>${esc(d.title)}</h3><ul>${pts}</ul></div>`;
  });
  let html = `${h.html}<div class="vs"><div class="vs-pair">${sides[0]}<span class="vs-vs">vs</span>${sides[1]}</div></div>`;
  if (p.verdict) {
    html += `<p id="${ctx.prefix}-v" class="vs-verdict">${esc(p.verdict)}</p>`;
    plan.push(item(`${ctx.prefix}-v`, ctx.at + Math.max(ctx.seconds * 0.7, 2), pop(0.9), 0.4));
  }
  return { html, plan };
}

function steps(s, ctx) {
  const p = s.props;
  const h = head(p, ctx);
  const n = p.steps.length;
  const t = whens(
    ctx,
    p.steps.map((x) => x.label),
    p.steps.map((x) => x.on),
    0.5,
    firstBy(p),
  );
  const plan = [...h.plan];
  const focus = focusOn(p);
  const spans = spansOf(t, ctx);
  const rows = p.steps
    .map((st, i) => {
      const id = `${ctx.prefix}-s${i}`;
      plan.push(item(id, t[i], fadeUp(false, ctx.rise / 2)));
      plan.push(item(`${id}-c`, t[i], pop(0.4), 0.35));
      if (i + 1 < n) plan.push(item(id, t[i + 1], [{ opacity: 1 }, { opacity: 0.45 }], 0.3));
      const r = focus ? rail(`${id}-r`, spans[i]) : null;
      if (r) plan.push(...r.plan);
      return `<li id="${id}" class="st-row"><span id="${id}-c" class="st-n">${i + 1}</span><span class="st-b">${esc(st.label)}${st.detail ? `<small>${esc(st.detail)}</small>` : ""}</span>${r ? r.html : ""}</li>`;
    })
    .join("");
  return { html: `${h.html}<ol class="st">${rows}</ol>`, plan };
}

function cycle(s, ctx) {
  const p = s.props;
  const h = head(p, ctx);
  const n = p.nodes.length;
  const t = whens(ctx, p.nodes, [], 0.5, firstBy(p));
  const plan = [...h.plan];
  const R = 34;
  const pos = (i) => {
    const a = (-90 + (360 / n) * i) * (Math.PI / 180);
    return [r3(50 + R * Math.cos(a)), r3(50 + R * Math.sin(a))];
  };
  let nodes = "";
  p.nodes.forEach((label, i) => {
    const [x, y] = pos(i);
    const id = `${ctx.prefix}-n${i}`;
    nodes += `<div id="${id}" class="cy-node" style="left:${x}%;top:${y}%"><span>${esc(label)}</span></div>`;
    plan.push(item(id, t[i], pop(0.6), 0.4));
  });
  const ringId = `${ctx.prefix}-ring`;
  plan.push(
    item(
      ringId,
      t[0],
      [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }],
      Math.max(0.8, t[n - 1] - t[0] + 0.6),
      "inOut",
    ),
  );
  // A dot follows the voice round the ring: it sits on a node while that node is spoken and travels to the next
  // one as the next is named; after the last node it carries on to the first until the scene ends.
  const angle = (i) => -90 + (360 / n) * i;
  const at = (deg) => ({
    left: `${r3(50 + R * Math.cos((deg * Math.PI) / 180))}%`,
    top: `${r3(50 + R * Math.sin((deg * Math.PI) / 180))}%`,
  });
  const end = Math.max(t[n - 1] + 0.6, ctx.at + ctx.seconds - 0.15);
  const samples = [];
  for (let i = 0; i < n; i++) {
    const from = t[i];
    const to = i + 1 < n ? t[i + 1] : end;
    for (let k = 0; k < 10; k++)
      samples.push({
        t: from + ((to - from) * k) / 10,
        ...at(angle(i) + (360 / n) * EASE_FN.inOut(k / 10)),
      });
  }
  samples.push({ t: end, ...at(angle(n)) });
  plan.push({ id: `${ctx.prefix}-orb`, ease: "linear", ...pathPlan(samples) });
  const center = p.center ? `<div class="cy-center">${esc(p.center)}</div>` : "";
  const html = `${h.html}<div class="cy"><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><circle id="${ringId}" cx="50" cy="50" r="${R}" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/></svg><i id="${ctx.prefix}-orb" class="cy-orb"></i>${nodes}${center}</div>`;
  return { html, plan };
}

function funnel(s, ctx) {
  const p = s.props;
  const h = head(p, ctx);
  const n = p.stages.length;
  const t = whens(
    ctx,
    p.stages.map((x) => x.label),
    p.stages.map((x) => x.on),
    0.5,
    firstBy(p),
  );
  const plan = [...h.plan];
  const focus = focusOn(p);
  const spans = spansOf(t, ctx);
  const rows = p.stages
    .map((st, i) => {
      const id = `${ctx.prefix}-f${i}`;
      const r = focus ? rail(`${id}-r`, spans[i]) : null;
      if (r) plan.push(...r.plan);
      const w0 = 100 - (i * 62) / n;
      const w1 = 100 - ((i + 1) * 62) / n;
      const inset = r3(((w0 - w1) / 2 / w0) * 100);
      plan.push(
        item(
          id,
          t[i],
          [
            { opacity: 0, transform: "scaleX(0.6)" },
            { opacity: 1, transform: "scaleX(1)" },
          ],
          0.5,
        ),
      );
      return `<div id="${id}" class="fn-row" style="width:${r3(w0)}%;clip-path:polygon(0 0,100% 0,${r3(100 - inset)}% 100%,${inset}% 100%);opacity:${r3(1 - i * (0.5 / n))}"><span>${esc(st.label)}</span>${st.value ? `<b>${esc(st.value)}</b>` : ""}${r ? r.html : ""}</div>`;
    })
    .join("");
  return { html: `${h.html}<div class="fn">${rows}</div>`, plan };
}

function matrix(s, ctx) {
  const p = s.props;
  const h = head(p, ctx);
  const t = whens(
    ctx,
    p.items.map((x) => x.label),
    p.items.map((x) => x.on),
    0.5,
    firstBy(p),
  );
  const plan = [...h.plan];
  const focus = focusOn(p);
  const spans = spansOf(t, ctx);
  const dots = p.items
    .map((it, i) => {
      const id = `${ctx.prefix}-m${i}`;
      plan.push(item(id, t[i], pop(0.5), 0.4));
      if (focus) plan.push(pulsePlan(`${id}-h`, spans[i]));
      return `<div id="${id}" class="mx-item" style="left:${r3(8 + it.x * 84)}%;top:${r3(92 - it.y * 84)}%"><i>${focus ? `<b id="${id}-h" class="pulse"></b>` : ""}</i><span>${esc(it.label)}</span></div>`;
    })
    .join("");
  plan.push(item(`${ctx.prefix}-grid`, ctx.at, [{ opacity: 0 }, { opacity: 1 }], 0.4));
  const html = `${h.html}<div class="mx"><div id="${ctx.prefix}-grid" class="mx-grid"></div><span class="mx-x mx-lo">${esc(p.x.low)}</span><span class="mx-x mx-hi">${esc(p.x.high)}</span><span class="mx-y mx-ylo">${esc(p.y.low)}</span><span class="mx-y mx-yhi">${esc(p.y.high)}</span>${dots}</div>`;
  return { html, plan };
}

function nodes(s, ctx) {
  const p = s.props;
  const h = head(p, ctx);
  // Layers: a node sits one layer after the deepest node that points to it (cycles are cut by capping the depth).
  const depth = new Map(p.nodes.map((n) => [n.id, 0]));
  for (let pass = 0; pass < p.nodes.length; pass++)
    for (const e of p.edges)
      depth.set(
        e.to,
        Math.min(p.nodes.length - 1, Math.max(depth.get(e.to), depth.get(e.from) + 1)),
      );
  const layers = [];
  p.nodes.forEach((n) => (layers[depth.get(n.id)] ??= []).push(n));
  const rows = layers.filter(Boolean);
  const where = new Map();
  const wide = ctx.size?.[0] > ctx.size?.[1]; // wide frames are short, so layers run left to right
  rows.forEach((row, r) =>
    row.forEach((n, c) =>
      where.set(
        n.id,
        wide
          ? [
              r3(rows.length === 1 ? 50 : 12 + (r * 76) / (rows.length - 1)),
              r3(((c + 1) * 100) / (row.length + 1)),
            ]
          : [
              r3(((c + 1) * 100) / (row.length + 1)),
              r3(rows.length === 1 ? 50 : 10 + (r * 80) / (rows.length - 1)),
            ],
      ),
    ),
  );
  const t = whens(
    ctx,
    p.nodes.map((n) => n.label),
    p.nodes.map((n) => n.on),
    0.5,
    firstBy(p),
  );
  const at = new Map(p.nodes.map((n, i) => [n.id, t[i]]));
  const plan = [...h.plan];
  let svg = "";
  p.edges.forEach((e, i) => {
    const [x1, y1] = where.get(e.from);
    const [x2, y2] = where.get(e.to);
    const id = `${ctx.prefix}-e${i}`;
    svg += `<line id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/>`;
    plan.push(
      item(
        id,
        Math.max(at.get(e.from), at.get(e.to) - 0.4),
        [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }],
        0.5,
        "inOut",
      ),
    );
  });
  const html = p.nodes
    .map((n, i) => {
      const [x, y] = where.get(n.id);
      const id = `${ctx.prefix}-n${i}`;
      plan.push(item(id, t[i], pop(0.6), 0.4));
      return `<div id="${id}" class="nd-node" style="left:${x}%;top:${y}%"><span>${esc(n.label)}</span></div>`;
    })
    .join("");
  // A dot follows the voice from node to node (in the order they are spoken); the last node pulses to the end.
  let dotStyle = "opacity:0";
  if (focusOn(p)) {
    const pts = p.nodes.map((n) => where.get(n.id));
    const samples = [];
    p.nodes.forEach((n, i) => {
      samples.push({ t: t[i], left: `${pts[i][0]}%`, top: `${pts[i][1]}%` });
      if (i + 1 < pts.length)
        for (let k = 1; k < 8; k++) {
          const u = EASE_FN.inOut(k / 8);
          samples.push({
            t: t[i] + ((t[i + 1] - t[i]) * k) / 8,
            left: `${r3(pts[i][0] + (pts[i + 1][0] - pts[i][0]) * u)}%`,
            top: `${r3(pts[i][1] + (pts[i + 1][1] - pts[i][1]) * u)}%`,
          });
        }
    });
    const path = pathPlan(samples);
    plan.push({ id: `${ctx.prefix}-dot`, ease: "linear", ...path });
    plan.push(
      pulsePlan(`${ctx.prefix}-halo`, {
        at: t[t.length - 1],
        until: ctx.at + ctx.seconds - 0.15,
      }),
    );
    dotStyle = `left:${pts[0][0]}%;top:${pts[0][1]}%;opacity:0`;
  }
  const lastPos = where.get(p.nodes.at(-1).id);
  const halo = focusOn(p)
    ? `<b id="${ctx.prefix}-halo" class="pulse pulse-box" style="left:${lastPos[0]}%;top:${lastPos[1]}%"></b>`
    : "";
  return {
    html: `${h.html}<div class="nd"><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${svg}</svg>${html}<i id="${ctx.prefix}-dot" class="nd-dot" style="${dotStyle}"></i>${halo}</div>`,
    plan,
  };
}

export const DIAGRAM_BUILDERS = { number, callout, versus, steps, cycle, funnel, matrix, nodes };

export const diagramCss = (brand, vertical = true) => {
  const K = vertical ? 1.3 : 1; // type grows on tall frames, where the width is the limit
  const box = (w, ratio) =>
    `width:calc(var(--u)*${w});max-width:100%;align-self:center;aspect-ratio:${ratio}`;
  // Tall frames are limited by width, wide frames by height: the diagrams are square when tall and landscape when wide.
  const cy = box(vertical ? 86 : 72, vertical ? "1/1" : "2.2/1");
  const mx = box(vertical ? 86 : 66, vertical ? "1/1" : "2/1");
  const nd = box(vertical ? 86 : 80, vertical ? "1/1.1" : "2.5/1");
  const { fg, accent, muted, bg } = brand.colors;
  const card = `border:calc(var(--u)*.4) solid ${muted};border-radius:calc(var(--u)*2)`;
  return `
.num{display:flex;justify-content:center;font-size:calc(var(--u)*30);font-weight:800;line-height:1;color:${accent};font-variant-numeric:tabular-nums}
.num-steps{display:grid}.num-steps>*{grid-area:1/1;text-align:center}
.num-step{opacity:0}.num-hide{display:block}
.num small{font-size:.38em;margin-inline-start:.12em;color:${fg}}
.rail-wrap{position:relative;height:calc(var(--u)*1);width:100%;margin-top:calc(var(--u)*1)}
.num-label{margin:0;text-align:center;font-size:calc(var(--u)*${r3(5.2 * K)});font-weight:700}
.co-stat{font-size:calc(var(--u)*${r3(26 * K)});font-weight:800;line-height:1;color:${accent}}
.co-bar{height:calc(var(--u)*1.2);width:calc(var(--u)*30);background:${fg};transform-origin:0 50%;border-radius:calc(var(--u)*.6)}
.co-label{margin:0;font-size:calc(var(--u)*${r3(6.4 * K)});font-weight:700;line-height:1.15}
.vs{width:100%}.vs-pair{display:grid;grid-template-columns:1fr auto 1fr;gap:calc(var(--u)*2);align-items:stretch}
.vs-card{${card};padding:calc(var(--u)*3)}.vs-left{border-color:${muted}}.vs-right{border-color:${accent}}
.vs-card h3{margin:0 0 calc(var(--u)*2);font-size:calc(var(--u)*${r3(4.6 * K)})}
.vs-card li{position:relative;padding-bottom:calc(var(--u)*1.2)}
.vs-card ul{margin:0;padding:0;list-style:none;font-size:calc(var(--u)*${r3(3.6 * K)});line-height:1.3;display:flex;flex-direction:column;gap:calc(var(--u)*1.6)}
.vs-vs{align-self:center;font-size:calc(var(--u)*${r3(3.4 * K)});font-weight:800;color:${muted};text-transform:uppercase}
.vs-verdict{margin:0;font-size:calc(var(--u)*${r3(5 * K)});font-weight:800;color:${accent}}
.st{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:calc(var(--u)*2.6)}
.st-row{position:relative;padding-bottom:calc(var(--u)*1.2);display:flex;gap:calc(var(--u)*3);align-items:flex-start;font-size:calc(var(--u)*${r3(4.4 * K)});line-height:1.2;font-weight:700}
.st-n{flex:none;width:calc(var(--u)*8);height:calc(var(--u)*8);border-radius:50%;background:${accent};color:${bg};display:grid;place-items:center;font-size:calc(var(--u)*${r3(4.4 * K)})}
.st-b small{display:block;font-weight:400;font-size:.72em;color:${muted};margin-top:calc(var(--u)*.6)}
.cy{position:relative;${cy}}
.cy svg{position:absolute;inset:0;width:100%;height:100%}.cy circle{fill:none;stroke:${muted};stroke-width:.5}
.cy-node{position:absolute;z-index:2;translate:-50% -50%;${card};background:${bg};padding:calc(var(--u)*1.6) calc(var(--u)*2.4);font-size:calc(var(--u)*${r3(3.4 * K)});font-weight:700;text-align:center;max-width:36%}
.cy-center{position:absolute;left:50%;top:50%;translate:-50% -50%;max-width:34%;text-align:center;font-size:calc(var(--u)*${r3(4.4 * K)});font-weight:800;color:${accent}}
.cy-orb{position:absolute;z-index:1;left:50%;top:16%;width:calc(var(--u)*2.4);height:calc(var(--u)*2.4);margin:calc(var(--u)*-1.2);border-radius:50%;background:${accent};box-shadow:0 0 calc(var(--u)*3) ${accent};opacity:0}
.fn{display:flex;flex-direction:column;align-items:center;gap:calc(var(--u)*.8);width:100%}
.fn-row{background:${accent};color:${bg};padding:calc(var(--u)*2.4) 0;display:flex;justify-content:center;gap:calc(var(--u)*2);align-items:baseline;font-size:calc(var(--u)*${r3(4 * K)});font-weight:800;text-align:center;box-sizing:border-box}
.fn-row b{font-size:.9em}
.mx{position:relative;${mx}}
.mx-grid{position:absolute;inset:8%;border-inline-start:calc(var(--u)*.4) solid ${muted};border-bottom:calc(var(--u)*.4) solid ${muted};background:linear-gradient(${muted},${muted}) 50% 0/calc(var(--u)*.25) 100% no-repeat,linear-gradient(${muted},${muted}) 0 50%/100% calc(var(--u)*.25) no-repeat;opacity:.9}
.mx-x,.mx-y{position:absolute;font-size:calc(var(--u)*${r3(2.8 * K)});color:${muted};font-weight:700;text-transform:uppercase}
.mx-lo{left:8%;bottom:0}.mx-hi{right:8%;bottom:0}.mx-ylo{left:0;bottom:14%}.mx-yhi{left:0;top:6%}
.mx-item{position:absolute;translate:-50% -50%;display:flex;flex-direction:column;align-items:center;gap:calc(var(--u)*.6);font-size:calc(var(--u)*${r3(3 * K)});font-weight:700;white-space:nowrap}
.mx-item i{width:calc(var(--u)*3.6);height:calc(var(--u)*3.6);border-radius:50%;background:${accent}}
.nd{position:relative;${nd}}
.nd svg{position:absolute;inset:0;width:100%;height:100%}.nd line{stroke:${muted};stroke-width:.7;stroke-linecap:round}
.nd-node{position:absolute;z-index:2;translate:-50% -50%;${card};background:${bg};padding:calc(var(--u)*1.6) calc(var(--u)*2.4);font-size:calc(var(--u)*${r3(3.4 * K)});font-weight:700;text-align:center;max-width:34%}
.pulse{position:absolute;inset:-60%;border:calc(var(--u)*.5) solid ${accent};border-radius:50%;opacity:0;pointer-events:none}
.pulse-box{inset:auto;width:calc(var(--u)*14);height:calc(var(--u)*7);translate:-50% -50%;border-radius:calc(var(--u)*2)}
.fn-row .rail{background:${bg};opacity:.5;bottom:0;height:calc(var(--u)*.9);border-radius:0}
.nd-dot{position:absolute;z-index:1;width:calc(var(--u)*2.6);height:calc(var(--u)*2.6);margin:calc(var(--u)*-1.3);border-radius:50%;background:${accent};box-shadow:0 0 calc(var(--u)*3) ${accent}}
`;
};
