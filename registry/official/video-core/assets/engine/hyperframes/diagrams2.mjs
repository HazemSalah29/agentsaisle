// The second batch of idea scenes: `ranking` (bars sorted by the author's values), `checklist` (ticks that draw on
// their words), `terminal` (a command and its output typed, never run), `compare-table` (rows that reveal on their
// words), `stack` (labelled layers) and `gauge` (one percentage ring). Same rules as diagrams.mjs: pure functions of
// the props, every string escaped, every piece enters on the word that names it (`on` picks the words), nothing
// computed from data except the counter's in-between values and the geometry, and every one keeps moving while
// the voice is on an item (`focus`, on unless `focus: false`).
import { EASE_FN, r3 } from "./motion.mjs";
import { fmt, head, item, pop, whens, firstBy } from "./diagrams.mjs";
import { esc, fadeUp, focusOn, rail, settle, spansOf } from "./shared.mjs";

export const DIAGRAM2_KINDS = [
  "ranking",
  "checklist",
  "terminal",
  "compare-table",
  "stack",
  "gauge",
];

const isText = (v, max, min = 1) =>
  typeof v === "string" && v.trim().length >= min && v.length <= max;
const inRange = (n, lo, hi) => Array.isArray(n) && n.length >= lo && n.length <= hi;
export const TICK_STATES = ["done", "todo", "fail"];
export const LINE_KINDS = ["cmd", "out"];

/** Problems with the props of one of the second-batch scenes, as readable strings. */
export function diagram2Problems(kind, p = {}) {
  const out = [];
  if (p.title !== undefined && !isText(p.title, 80))
    out.push("title: text of at most 80 characters");
  if (p.focus !== undefined && typeof p.focus !== "boolean") out.push("focus: true or false");
  const ons = (list, name) => {
    if (list.some((x) => x?.on !== undefined && !isText(x.on, 60)))
      out.push(`${name}[].on: the spoken words that bring it in, up to 60 characters`);
  };
  if (kind === "ranking") {
    if (p.unit !== undefined && !isText(p.unit, 12, 0))
      out.push("unit: text of at most 12 characters");
    if (!inRange(p.items, 2, 8)) out.push("items: 2 to 8 items");
    else {
      p.items.forEach((x, i) => {
        if (!isText(x?.label, 40)) out.push(`items[${i}].label: 1 to 40 characters`);
        if (!Number.isFinite(x?.value)) out.push(`items[${i}].value: a number`);
      });
      ons(p.items, "items");
    }
  } else if (kind === "checklist") {
    if (!inRange(p.items, 2, 7)) out.push("items: 2 to 7 items");
    else {
      p.items.forEach((x, i) => {
        if (!isText(x?.text, 60)) out.push(`items[${i}].text: 1 to 60 characters`);
        if (x?.state !== undefined && !TICK_STATES.includes(x.state))
          out.push(`items[${i}].state: one of ${TICK_STATES.join(", ")}`);
      });
      ons(p.items, "items");
    }
  } else if (kind === "terminal") {
    if (p.prompt !== undefined && !isText(p.prompt, 4)) out.push("prompt: 1 to 4 characters");
    if (!inRange(p.lines, 1, 8)) out.push("lines: 1 to 8 lines");
    else {
      p.lines.forEach((x, i) => {
        if (!isText(x?.text, 64)) out.push(`lines[${i}].text: 1 to 64 characters`);
        if (x?.kind !== undefined && !LINE_KINDS.includes(x.kind))
          out.push(`lines[${i}].kind: one of ${LINE_KINDS.join(", ")}`);
      });
      ons(p.lines, "lines");
    }
  } else if (kind === "compare-table") {
    if (!inRange(p.columns, 2, 4) || p.columns.some((c) => !isText(c, 24)))
      out.push("columns: 2 to 4 names of up to 24 characters");
    if (!inRange(p.rows, 2, 6)) out.push("rows: 2 to 6 rows");
    else if (Array.isArray(p.columns)) {
      p.rows.forEach((r, i) => {
        if (!isText(r?.label, 30)) out.push(`rows[${i}].label: 1 to 30 characters`);
        if (!Array.isArray(r?.cells) || r.cells.length !== p.columns.length)
          out.push(`rows[${i}].cells: one text per column (${p.columns.length})`);
        else if (r.cells.some((c) => !isText(c, 40, 0)))
          out.push(`rows[${i}].cells: each up to 40 characters`);
      });
      ons(p.rows, "rows");
    }
  } else if (kind === "stack") {
    if (!inRange(p.layers, 2, 6)) out.push("layers: 2 to 6 layers");
    else {
      p.layers.forEach((x, i) => {
        if (!isText(x?.label, 40)) out.push(`layers[${i}].label: 1 to 40 characters`);
        if (x?.detail !== undefined && !isText(x.detail, 80))
          out.push(`layers[${i}].detail: up to 80 characters`);
      });
      ons(p.layers, "layers");
    }
  } else if (kind === "gauge") {
    if (!(Number.isFinite(p.value) && p.value >= 0 && p.value <= 100))
      out.push("value: a number from 0 to 100");
    if (p.from !== undefined && !(Number.isFinite(p.from) && p.from >= 0 && p.from <= 100))
      out.push("from: a number from 0 to 100");
    if (!isText(p.label, 60)) out.push("label: text of 1 to 60 characters");
    if (p.unit !== undefined && !isText(p.unit, 8, 0))
      out.push("unit: text of at most 8 characters");
    if (p.on !== undefined && !isText(p.on, 60))
      out.push("on: the spoken words, up to 60 characters");
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------- ranking
function ranking(s, ctx) {
  const p = s.props;
  const h = head(p, ctx);
  const t = whens(
    ctx,
    p.items.map((x) => x.label),
    p.items.map((x) => x.on),
    0.5,
    firstBy(p),
  );
  const focus = focusOn(p);
  const spans = spansOf(t, ctx);
  const plan = [...h.plan];
  const max = Math.max(...p.items.map((x) => x.value)) || 1;
  const decimals = Math.max(...p.items.map((x) => (String(x.value).split(".")[1] ?? "").length));
  // Shown largest first; each bar still comes in on its own spoken word.
  const order = p.items.map((x, i) => ({ ...x, i })).sort((a, b) => b.value - a.value || a.i - b.i);
  const rows = order
    .map((x, rank) => {
      const id = `${ctx.prefix}-k${x.i}`;
      const w = r3(Math.max(2, (Math.max(0, x.value) / max) * 100));
      plan.push(item(id, t[x.i], fadeUp(false, ctx.rise / 2)));
      // the bar grows across the whole stretch its item is spoken, so it keeps moving until the next one
      plan.push(
        item(
          `${id}-b`,
          t[x.i],
          [{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }],
          focus ? Math.max(0.6, spans[x.i].until - t[x.i]) : 0.7,
          focus ? "linear" : "out",
        ),
      );
      return `<li id="${id}" class="rk-row${rank === 0 ? " rk-top" : ""}"><span class="rk-l">${esc(x.label)}</span><span class="rk-v">${esc(fmt(x.value, ctx.lang, decimals))}${p.unit ? `<small>${esc(p.unit)}</small>` : ""}</span><span class="rk-track"><i id="${id}-b" class="rk-bar" style="width:${w}%"></i></span></li>`;
    })
    .join("");
  return { html: `${h.html}<ol class="rk">${rows}</ol>`, plan };
}

// -------------------------------------------------------------------------------------------------- checklist
const TICK = {
  done: '<path d="M4 12.5 L9.5 18 L20 6.5" pathLength="1"/>',
  fail: '<path d="M6 6 L18 18 M18 6 L6 18" pathLength="1"/>',
  todo: "",
};

function checklist(s, ctx) {
  const p = s.props;
  const h = head(p, ctx);
  const n = p.items.length;
  const t = whens(
    ctx,
    p.items.map((x) => x.text),
    p.items.map((x) => x.on),
    0.5,
    firstBy(p),
  );
  const focus = focusOn(p);
  const spans = spansOf(t, ctx);
  const plan = [...h.plan];
  const rows = p.items
    .map((x, i) => {
      const id = `${ctx.prefix}-c${i}`;
      const state = x.state ?? "done";
      plan.push(item(id, t[i], fadeUp(false, ctx.rise / 2)));
      if (TICK[state])
        plan.push(
          item(
            `${id}-t`,
            t[i] + 0.15,
            [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }],
            0.45,
            "out",
          ),
        );
      const r = focus ? rail(`${id}-r`, spans[i]) : null;
      if (r) plan.push(...r.plan, ...settle(id, spans[i], i === n - 1));
      return `<li id="${id}" class="ck-row ck-${state}"><svg class="ck-box" viewBox="0 0 24 24" aria-hidden="true"><rect x="1.5" y="1.5" width="21" height="21" rx="4"/><g id="${id}-t" stroke-dasharray="1" stroke-dashoffset="1">${TICK[state]}</g></svg><span>${esc(x.text)}</span>${r ? r.html : ""}</li>`;
    })
    .join("");
  return { html: `${h.html}<ul class="ck">${rows}</ul>`, plan };
}

// ---------------------------------------------------------------------------------------------------- terminal
/** Characters a second a terminal types at. */
export const TYPE_RATE = 28;

function terminal(s, ctx) {
  const p = s.props;
  const h = head(p, ctx);
  const prompt = p.prompt ?? "$";
  const t = whens(
    ctx,
    p.lines.map((x) => x.text),
    p.lines.map((x) => x.on),
    0.4,
    firstBy(p),
  );
  const plan = [...h.plan];
  const end = ctx.at + ctx.seconds - 0.15;
  const blink = (from, to) => {
    // a block cursor that blinks while its line is the active one: sampled, so it is a function of time. It is
    // hidden before and after (an animation holds its end values, so the ends are written out as hidden).
    const total = Math.max(0.5, to - from);
    const beats = Math.max(1, Math.round(total / 0.5));
    const frames = [{ offset: 0, opacity: 0 }];
    for (let k = 0; k < beats; k++)
      frames.push(
        { offset: r3(k / beats + 0.0005), opacity: k % 2 ? 0 : 1 },
        { offset: r3((k + 0.999) / beats), opacity: k % 2 ? 0 : 1 },
      );
    frames.push({ offset: 1, opacity: 0 });
    return { at: from, dur: total, frames };
  };
  const lines = p.lines
    .map((x, i) => {
      const id = `${ctx.prefix}-l${i}`;
      const kind = x.kind ?? (i === 0 ? "cmd" : "out");
      const chars = [...x.text].length;
      const next = i + 1 < t.length ? t[i + 1] : end;
      // typed at a steady rate, but never past the moment the next line starts
      const dur = Math.max(0.3, Math.min(chars / TYPE_RATE, next - t[i] - 0.05));
      plan.push(
        item(
          id,
          t[i],
          [{ clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0% 0 0)" }],
          dur,
          "linear",
        ),
      );
      // the cursor of the active line: it blinks from the moment the line starts until the next one does
      plan.push({ id: `${id}-c`, ease: "linear", ...blink(t[i], next) });
      return `<div class="tm-line tm-${kind}">${kind === "cmd" ? `<b>${esc(prompt)}</b>` : ""}<span id="${id}">${esc(x.text)}</span><i id="${id}-c" class="tm-cur"></i></div>`;
    })
    .join("");
  return {
    html: `${h.html}<div class="tm"><div class="tm-bar"><i></i><i></i><i></i></div><div class="tm-body">${lines}</div></div>`,
    plan,
  };
}

// ----------------------------------------------------------------------------------------------- compare-table
function compareTable(s, ctx) {
  const p = s.props;
  const h = head(p, ctx);
  const n = p.rows.length;
  const t = whens(
    ctx,
    p.rows.map((x) => x.label),
    p.rows.map((x) => x.on),
    0.5,
    firstBy(p),
  );
  const focus = focusOn(p);
  const spans = spansOf(t, ctx);
  const plan = [...h.plan];
  const cols = p.columns.length;
  const th = `<div id="${ctx.prefix}-th" class="ct-row ct-head" style="grid-template-columns:1.2fr repeat(${cols},1fr)"><span></span>${p.columns.map((c) => `<span>${esc(c)}</span>`).join("")}</div>`;
  plan.push(item(`${ctx.prefix}-th`, ctx.at, [{ opacity: 0 }, { opacity: 1 }], 0.4));
  const rows = p.rows
    .map((r, i) => {
      const id = `${ctx.prefix}-r${i}`;
      plan.push(item(id, t[i], fadeUp(false, ctx.rise / 2)));
      const rl = focus ? rail(`${id}-r`, spans[i]) : null;
      if (rl) plan.push(...rl.plan, ...settle(id, spans[i], i === n - 1));
      return `<div id="${id}" class="ct-row" style="grid-template-columns:1.2fr repeat(${cols},1fr)"><b>${esc(r.label)}</b>${r.cells.map((c) => `<span>${esc(c)}</span>`).join("")}${rl ? rl.html : ""}</div>`;
    })
    .join("");
  return {
    html: `${h.html}<div class="ct">${th}${rows}</div>`,
    plan,
  };
}

// ----------------------------------------------------------------------------------------------------- stack
function stack(s, ctx) {
  const p = s.props;
  const h = head(p, ctx);
  const n = p.layers.length;
  const t = whens(
    ctx,
    p.layers.map((x) => x.label),
    p.layers.map((x) => x.on),
    0.5,
    firstBy(p),
  );
  const focus = focusOn(p);
  const spans = spansOf(t, ctx);
  const plan = [...h.plan];
  const rows = p.layers
    .map((x, i) => {
      const id = `${ctx.prefix}-y${i}`;
      const side = i % 2 ? 1 : -1;
      plan.push(
        item(
          id,
          t[i],
          [
            { opacity: 0, transform: `translateX(${side * ctx.rise * 3}px) scale(0.97)` },
            { opacity: 1, transform: "translateX(0) scale(1)" },
          ],
          0.5,
        ),
      );
      const r = focus ? rail(`${id}-r`, spans[i]) : null;
      if (r) plan.push(...r.plan, ...settle(id, spans[i], i === n - 1));
      return `<li id="${id}" class="sk-layer" style="margin-inline-start:calc(var(--u)*${r3(i * 2)})"><b>${esc(x.label)}</b>${x.detail ? `<small>${esc(x.detail)}</small>` : ""}${r ? r.html : ""}</li>`;
    })
    .join("");
  return { html: `${h.html}<ol class="sk">${rows}</ol>`, plan };
}

// ----------------------------------------------------------------------------------------------------- gauge
const GAUGE_R = 42;

function gauge(s, ctx) {
  const p = s.props;
  const from = p.from ?? 0;
  const steps = 12;
  const t0 = whens(ctx, [p.label], [p.on], 0.25, 0.3)[0];
  // the ring fills across the whole scene (at most 8 s), so the picture keeps moving while the voice talks
  const span = Math.max(0.8, Math.min(8, ctx.at + ctx.seconds - 0.4 - t0));
  const circ = 2 * Math.PI * GAUGE_R;
  const plan = [item(`${ctx.prefix}-box`, t0, pop(0.9), 0.4)];
  const startOff = r3(circ * (1 - from / 100));
  const endOff = r3(circ * (1 - p.value / 100));
  plan.push(
    item(
      `${ctx.prefix}-arc`,
      t0,
      [{ strokeDashoffset: startOff }, { strokeDashoffset: endOff }],
      span,
      "out",
    ),
  );
  const decimals = Math.min(1, (String(p.value).split(".")[1] ?? "").length);
  let html = "";
  for (let k = 0; k <= steps; k++) {
    const v = k === steps ? p.value : from + (p.value - from) * EASE_FN.out(k / steps);
    const id = `${ctx.prefix}-g${k}`;
    const at = t0 + (k / steps) * span;
    const text = `${esc(fmt(v, ctx.lang, decimals))}${p.unit ? `<small>${esc(p.unit)}</small>` : ""}`;
    plan.push(item(id, at, [{ opacity: 0 }, { opacity: 1 }], 0.02, "linear"));
    if (k < steps) {
      plan.push(
        item(`${id}w`, at + span / steps, [{ opacity: 1 }, { opacity: 0 }], 0.02, "linear"),
      );
      html += `<span id="${id}w" class="num-hide"><span id="${id}" class="num-step">${text}</span></span>`;
    } else html += `<span id="${id}" class="num-step">${text}</span>`;
  }
  plan.push(item(`${ctx.prefix}-l`, t0 + 0.1, fadeUp(false, ctx.rise / 2)));
  return {
    html: `<div id="${ctx.prefix}-box" class="ga"><svg viewBox="0 0 100 100" aria-hidden="true"><circle class="ga-bg" cx="50" cy="50" r="${GAUGE_R}"/><circle id="${ctx.prefix}-arc" class="ga-arc" cx="50" cy="50" r="${GAUGE_R}" stroke-dasharray="${r3(circ)}" stroke-dashoffset="${startOff}" transform="rotate(-90 50 50)"/></svg><div class="ga-n"><span class="num-steps">${html}</span></div></div><p id="${ctx.prefix}-l" class="num-label">${esc(p.label)}</p>`,
    plan,
  };
}

export const DIAGRAM2_BUILDERS = {
  ranking,
  checklist,
  terminal,
  "compare-table": compareTable,
  stack,
  gauge,
};

export const diagram2Css = (brand, vertical = true) => {
  const { fg, accent, muted } = brand.colors;
  const K = vertical ? 1.4 : 1;
  const fs = (n) => `calc(var(--u)*${r3(n * K)})`;
  return `
.rk{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:calc(var(--u)*${vertical ? 3 : 1.6});width:100%}
.rk-row{display:grid;grid-template-columns:1fr auto;column-gap:calc(var(--u)*2);row-gap:calc(var(--u)*.8);align-items:baseline;font-size:${fs(3.8)};font-weight:700}
.rk-v{font-variant-numeric:tabular-nums;color:${fg}}.rk-v small{font-size:.6em;margin-inline-start:.2em;color:${muted}}
.rk-track{grid-column:1/-1;display:block;height:calc(var(--u)*${vertical ? 2.4 : 1.6});background:${muted}33;border-radius:calc(var(--u)*1.2);overflow:hidden}
.rk-bar{display:block;height:100%;background:${muted};border-radius:calc(var(--u)*1.2);transform-origin:0 50%}
[dir=rtl] .rk-bar{transform-origin:100% 50%}
.rk-top .rk-bar{background:${accent}}.rk-top .rk-v{color:${accent}}
.ck{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:calc(var(--u)*${vertical ? 3.4 : 2});width:100%}
.ck-row{position:relative;padding-bottom:calc(var(--u)*1.2);display:flex;align-items:center;gap:calc(var(--u)*2.6);font-size:${fs(4.2)};font-weight:700;line-height:1.2}
.ck-box{flex:none;width:calc(var(--u)*${r3(6.4 * K)});height:calc(var(--u)*${r3(6.4 * K)});fill:none;stroke:${muted};stroke-width:1.6}
.ck-box g{stroke:${accent};stroke-width:3;stroke-linecap:round;stroke-linejoin:round;fill:none}
.ck-fail .ck-box g{stroke:${fg}}
.tm{width:100%;background:#0b0d10;border:calc(var(--u)*.3) solid ${muted}66;border-radius:calc(var(--u)*1.6);overflow:hidden}
.tm-bar{display:flex;gap:calc(var(--u)*1);padding:calc(var(--u)*1.6) calc(var(--u)*2);background:#15181d}
.tm-bar i{width:calc(var(--u)*1.4);height:calc(var(--u)*1.4);border-radius:50%;background:${muted}88}
.tm-body{padding:calc(var(--u)*2.4);font:600 ${fs(3.2)}/1.5 monospace;color:${fg};min-height:calc(var(--u)*${vertical ? 28 : 18})}
.tm-line{display:block;white-space:pre-wrap;word-break:break-word}.tm-line b{color:${accent};margin-inline-end:.8ch}
.tm-out{color:${muted}}
.tm-cur{display:inline-block;margin-inline-start:.4ch;width:.6ch;height:1.1em;background:${accent};vertical-align:text-bottom;opacity:0}
.ct{width:100%;display:flex;flex-direction:column;gap:calc(var(--u)*${vertical ? 2.6 : 1.4})}
.ct-row{position:relative;padding-bottom:calc(var(--u)*1.2);display:grid;column-gap:calc(var(--u)*2);align-items:baseline;font-size:${fs(3.4)};line-height:1.25}
.ct-row b{font-weight:800}.ct-head{font-size:${fs(2.8)};font-weight:700;color:${muted};text-transform:uppercase;letter-spacing:.06em;padding-bottom:0}
.sk{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:calc(var(--u)*1.6);width:100%}
.sk-layer{position:relative;padding:calc(var(--u)*${vertical ? 3 : 1.8}) calc(var(--u)*3);padding-bottom:calc(var(--u)*${vertical ? 4 : 2.6});background:${muted}22;border:calc(var(--u)*.3) solid ${muted}88;border-radius:calc(var(--u)*1.4);font-size:${fs(3.8)}}
.sk-layer b{display:block}.sk-layer small{display:block;margin-top:calc(var(--u)*.6);font-size:.68em;font-weight:500;color:${muted}}
.sk-layer .rail{inset-inline:calc(var(--u)*1.6);bottom:calc(var(--u)*1.2)}
.ga{position:relative;width:calc(var(--u)*${vertical ? 62 : 34});max-width:100%;aspect-ratio:1/1;align-self:center}
.ga svg{position:absolute;inset:0;width:100%;height:100%}
.ga circle{fill:none;stroke-width:9}.ga-bg{stroke:${muted}33}.ga-arc{stroke:${accent};stroke-linecap:round}
.ga-n{position:absolute;inset:0;display:grid;place-items:center;font-size:calc(var(--u)*${vertical ? 17 : 9});font-weight:800;color:${fg};font-variant-numeric:tabular-nums}
.ga-n small{font-size:.4em;margin-inline-start:.1em;color:${muted}}
`;
};
