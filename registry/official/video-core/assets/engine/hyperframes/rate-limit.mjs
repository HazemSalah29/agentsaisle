// The `rate-limit` scene: requests arrive as dots, a meter fills and drains, rejected requests stop at the
// gate and bounce back marked 429, and a live chart counts allowed against rejected. Everything on screen is
// drawn from the event log of the real algorithm (../../sim/rate-limit.mjs) run on the scene's seed, so the
// animation cannot disagree with the algorithm. Time is compressed to fit the scene; the footer says by how much.
import { simulate } from "../../sim/rate-limit.mjs";
import { IN, esc, fadeUp } from "./shared.mjs";

/** Most requests one scene draws (every request is a dot). The simulator itself allows more. */
export const MAX_DRAWN = 600;
/** Seconds kept free at the end of the scene for the last dots to finish (a bounce takes 1.1 s). */
const TAIL = 1.2;
export const REJECT = "#E5484D";

const NAMES = {
  "token-bucket": "Token bucket",
  "leaky-bucket": "Leaky bucket",
  "fixed-window": "Fixed window",
  "sliding-window": "Sliding window",
};
const METER = {
  "token-bucket": "tokens left",
  "leaky-bucket": "bucket level",
  "fixed-window": "requests in this window",
  "sliding-window": "requests in the last window",
};
const num = (v) => String(Math.round(v * 1000) / 1000);

function paramsText(a) {
  if (a.algo === "token-bucket")
    return `holds ${num(a.capacity)} · refills ${num(a.refillPerSec)} a second`;
  if (a.algo === "leaky-bucket")
    return `holds ${num(a.capacity)} · drains ${num(a.leakPerSec)} a second`;
  return `${num(a.limit)} requests per ${num(a.windowSec)} s`;
}

function patternText(p) {
  if (p.type === "steady") return `steady, ${num(p.ratePerSec)} a second`;
  if (p.type === "poisson") return `random arrivals, about ${num(p.ratePerSec)} a second`;
  return `bursts of ${num(p.burstSize)} every ${num(p.burstEverySec)} s`;
}

const r2 = (n) => Math.round(n * 100) / 100;

/** A number that counts up: a column of 0..n that slides up one row per step. Returns markup and its animation. */
function counter({ id, x, y, w, rows, steps, d, at, dur, cls }) {
  const lh = 5;
  let col = "";
  for (let k = 0; k <= rows; k++) col += `<text x="0" y="${k * lh + 3.6}">${k}</text>`;
  const frames = [{ offset: 0, transform: "translateY(0px)" }];
  steps.forEach((t, i) => {
    const o = r2(Math.min(1, t / d) * 1e4) / 1e4;
    frames.push({ offset: o, transform: `translateY(${-i * lh}px)` });
    frames.push({ offset: o, transform: `translateY(${-(i + 1) * lh}px)` });
  });
  frames.push({ offset: 1, transform: `translateY(${-rows * lh}px)` });
  return {
    html: `<svg x="${x}" y="${y}" width="${w}" height="${lh}" viewBox="0 0 ${w} ${lh}"><g id="${id}" class="cnt ${cls}">${col}</g></svg>`,
    plan: [{ id, frames, at, dur, ease: "linear" }],
  };
}

function panel(run, p, ctx, sweep) {
  const { events, meter } = run;
  const { at, dur, d } = sweep;
  const count = events.length;
  const id = (s) => `${ctx.prefix}-${p}${s}`;
  const plan = [];
  const X0 = 4;
  const GATE = 58;
  const FLY = 0.5;
  const when = (t) => at + (t / d) * dur;

  let svg = `<svg id="${id("")}" class="rl" viewBox="0 0 100 70" role="img" aria-label="${esc(NAMES[run.algo])}" dir="ltr">`;
  svg += `<text class="algo" x="${X0}" y="5">${esc(NAMES[run.algo])}</text>`;
  svg += `<text class="par" x="${X0}" y="9">${esc(paramsText({ algo: run.algo, ...run.params }))}</text>`;
  svg += `<line class="axis" x1="${X0}" x2="${GATE}" y1="17" y2="17"/><rect class="gate" x="${GATE}" y="11.5" width="0.8" height="11"/>`;
  svg += `<rect class="srv" x="66" y="11.5" width="30" height="11"/><text class="par mid" x="81" y="18">server</text>`;
  svg += `<text id="${id("-429")}" class="no-t" x="${GATE - 2}" y="9" text-anchor="end">429</text>`;

  // Dots: one per request, placed by its arrival time.
  events.forEach((e, i) => {
    const y = 17 + ((i % 3) - 1) * 1.8;
    const allowed = e.outcome === "allowed";
    svg += `<circle id="${id(`-d${i}`)}" class="dot" cx="${X0}" cy="${y}" r="1.1"/>`;
    const to = GATE - 1.6 - X0;
    const frames = allowed
      ? [
          { offset: 0, opacity: 0, transform: "translateX(0px)" },
          { offset: 0.08, opacity: 1, transform: "translateX(0px)" },
          { offset: 0.55, opacity: 1, transform: `translateX(${to}px)` },
          { offset: 1, opacity: 0, transform: `translateX(${to + 14}px)` },
        ]
      : [
          { offset: 0, opacity: 0, transform: "translateX(0px)" },
          { offset: 0.08, opacity: 1, transform: "translateX(0px)" },
          { offset: 0.4, opacity: 1, transform: `translateX(${to}px)` },
          { offset: 0.5, opacity: 1, transform: `translateX(${to}px)`, fill: REJECT },
          { offset: 1, opacity: 0, transform: `translateX(${to - 22}px)`, fill: REJECT },
        ];
    plan.push({
      id: id(`-d${i}`),
      frames,
      at: when(e.t),
      dur: allowed ? FLY * 1.7 : FLY * 2.2,
      ease: "linear",
    });
  });

  // The 429 mark flashes at each rejection.
  const rej = events.filter((e) => e.outcome === "rejected");
  if (rej.length) {
    const hold = 0.45 / dur;
    const f = [{ offset: 0, opacity: 0 }];
    let last = 0;
    rej.forEach((e, i) => {
      const o = Math.min(1, e.t / d);
      if (o > last) f.push({ offset: o, opacity: 0 });
      f.push({ offset: Math.max(o, last), opacity: 1 });
      const next = rej[i + 1] ? Math.min(1, rej[i + 1].t / d) : 1;
      last = Math.max(o, Math.min(o + hold, next));
      if (last < next) f.push({ offset: last, opacity: 0 });
    });
    f.push({ offset: 1, opacity: f[f.length - 1].opacity });
    plan.push({ id: id("-429"), frames: f, at, dur, ease: "linear" });
  }

  // Meter: the exact shape the algorithm gives, straight lines between its points.
  const max = events[0].max;
  svg += `<text class="par" x="${X0}" y="27.5">${esc(METER[run.algo])}</text>`;
  svg += `<rect class="bar-bg" x="${X0}" y="29" width="92" height="3.2"/>`;
  svg += `<rect id="${id("-m")}" class="bar-fill" x="${X0}" y="29" width="92" height="3.2" style="transform-origin:${X0}px 0px"/>`;
  const level = (v) => `scaleX(${Math.max(0, Math.min(1, v / max))})`;
  const mf = meter
    .filter(([t]) => t <= d)
    .map(([t, v]) => ({ offset: Math.min(1, t / d), transform: level(v) }));
  mf.push({ offset: 1, transform: mf[mf.length - 1].transform });
  plan.push({ id: id("-m"), frames: mf, at, dur, ease: "linear" });

  // Counters.
  const stepsOf = (kind) => events.filter((e) => e.outcome === kind).map((e) => e.t);
  svg += `<text class="par" x="${X0}" y="38.2">allowed</text><text class="par" x="52" y="38.2">rejected</text>`;
  const a = counter({
    id: id("-ca"),
    x: 20,
    y: 34,
    w: 24,
    rows: run.allowed,
    steps: stepsOf("allowed"),
    d,
    at,
    dur,
    cls: "ok-t",
  });
  const b = counter({
    id: id("-cr"),
    x: 68,
    y: 34,
    w: 24,
    rows: run.rejected,
    steps: stepsOf("rejected"),
    d,
    at,
    dur,
    cls: "no-t",
  });
  svg += a.html + b.html;
  plan.push(...a.plan, ...b.plan);

  // Live chart: cumulative allowed and rejected against time; a cover shrinks to reveal it left to right.
  const CT = 49;
  const CB = 68;
  const x = (t) => r2(X0 + (Math.min(t, d) / d) * 92);
  const y = (c) => r2(CB - (c / count) * (CB - CT));
  let ca = 0;
  let cr = 0;
  const pa = [`${x(0)},${y(0)}`];
  const pr = [`${x(0)},${y(0)}`];
  for (const e of events) {
    if (e.outcome === "allowed") ca += 1;
    else cr += 1;
    pa.push(`${x(e.t)},${y(ca)}`);
    pr.push(`${x(e.t)},${y(cr)}`);
  }
  svg += `<line class="axis" x1="${X0}" x2="96" y1="${CB}" y2="${CB}"/>`;
  svg += `<polyline class="ln ok-l" points="${pa.join(" ")}"/><polyline class="ln no-l" points="${pr.join(" ")}"/>`;
  svg += `<rect id="${id("-cv")}" class="cover" x="${X0}" y="${CT - 1}" width="92.6" height="${CB - CT + 2.5}" style="transform-origin:96.6px 0px"/>`;
  svg += `<text class="par" x="${X0}" y="${CT - 3}">requests so far:</text><text class="ok-t" x="30" y="${CT - 3}">allowed</text><text class="no-t" x="46" y="${CT - 3}">rejected</text>`;
  plan.push({
    id: id("-cv"),
    frames: [{ transform: "scaleX(1)" }, { transform: "scaleX(0)" }],
    at,
    dur,
    ease: "linear",
  });
  svg += "</svg>";
  return { svg, plan };
}

export function rateLimit(s, ctx) {
  const props = s.props;
  const result = simulate({
    seed: props.seed,
    count: props.count,
    pattern: props.pattern,
    algos: props.algos,
  });
  const d = Math.max(result.durationMs, 1000);
  const start = ctx.at + 0.7;
  const dur = Math.max(1, ctx.seconds - 0.7 - TAIL);
  const sweep = { at: start, dur, d };
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
  html += `<div class="rl-panels">`;
  result.runs.forEach((run, i) => {
    const p = panel(run, `p${i}`, ctx, sweep);
    html += p.svg;
    plan.push(
      {
        id: `${ctx.prefix}-p${i}`,
        frames: [{ opacity: ctx.first ? 1 : 0 }, { opacity: 1 }],
        at: ctx.at,
        dur: IN,
        ease: "out",
      },
      ...p.plan,
    );
  });
  html += `</div>`;
  const seconds = Math.round(d / 100) / 10;
  html += `<p id="${ctx.prefix}-note" class="rl-note">seed ${esc(props.seed)} · ${esc(props.count)} requests · ${esc(patternText(props.pattern))} · ${esc(num(seconds))} s of traffic shown in ${esc(num(Math.round(dur * 10) / 10))} s</p>`;
  return { html, plan };
}

/** Styles for this kind; project.mjs adds them to the page. */
export const rateLimitCss = (brand, vertical = true) => `
.rl-panels{display:flex;flex-direction:${vertical ? "column" : "row"};gap:calc(var(--u)*2)}
.rl-panels .rl{flex:1;min-width:0}
.rl{width:100%;height:auto;font-family:inherit}
.rl text{fill:${brand.colors.fg};font-size:2.4px}
.rl .algo{font-size:3.6px;font-weight:700}
.rl .par{fill:${brand.colors.muted}}
.rl .mid{text-anchor:middle}
.rl .axis{stroke:${brand.colors.muted};stroke-width:.25}
.rl .gate{fill:${brand.colors.fg}}
.rl .srv{fill:none;stroke:${brand.colors.muted};stroke-width:.3}
.rl .dot{fill:${brand.colors.fg}}
.rl .bar-bg{fill:none;stroke:${brand.colors.muted};stroke-width:.3}
.rl .bar-fill{fill:${brand.colors.accent}}
.rl .cnt text{font-size:4.2px;font-weight:700}
.rl .ok-t,.rl .ok-t text{fill:${brand.colors.fg};font-weight:700}
.rl .no-t,.rl .no-t text{fill:${REJECT};font-weight:700}
.rl .ln{fill:none;stroke-width:.7;stroke-linejoin:round;stroke-linecap:round}
.rl .ok-l{stroke:${brand.colors.fg}}
.rl .no-l{stroke:${REJECT}}
.rl .cover{fill:${brand.colors.bg}}
.rl-note{margin:0;font-size:calc(var(--u)*2.6);color:${brand.colors.muted}}
`;
