// The `timeline` scene: a vertical timeline of events (an outage, a release, a day), shown one event at a time,
// each with its narration line when there is one line per event; earlier events dim so one idea moves at a time.
// The type of an event is also written as a word, so colour is never the only signal. Every string is escaped.
import { IN, LEAD, esc, fadeUp, focusOn, rail, spansOf, wordCursor } from "./shared.mjs";

export const LIMITS = { events: 10, at: 12, label: 60, where: 24, title: 80 };
export const TYPES = {
  failure: "FAILED",
  alert: "ALERT",
  action: "ACTION",
  fix: "FIXED",
  info: "INFO",
};

/** Problems with a timeline scene's props, as readable strings. */
export function timelineProblems(props) {
  const p = [];
  if (
    props.title !== undefined &&
    (typeof props.title !== "string" || props.title.length > LIMITS.title)
  )
    p.push(`title: text of at most ${LIMITS.title} characters`);
  const ev = props.events;
  if (!Array.isArray(ev) || ev.length < 2 || ev.length > LIMITS.events)
    return [...p, `events: a list of 2 to ${LIMITS.events} events`];
  ev.forEach((e, i) => {
    const at = `events[${i}]`;
    if (typeof e?.at !== "string" || !e.at.trim() || e.at.length > LIMITS.at)
      p.push(`${at}.at: a time as text, up to ${LIMITS.at} characters`);
    if (typeof e?.label !== "string" || !e.label.trim() || e.label.length > LIMITS.label)
      p.push(`${at}.label: text of 1 to ${LIMITS.label} characters`);
    if (e?.where !== undefined && (typeof e.where !== "string" || e.where.length > LIMITS.where))
      p.push(`${at}.where: text of at most ${LIMITS.where} characters`);
    if (e?.on !== undefined && (typeof e.on !== "string" || !e.on.trim() || e.on.length > 60))
      p.push(`${at}.on: the spoken words that bring it in, up to 60 characters`);
    if (e?.type !== undefined && !Object.hasOwn(TYPES, e.type))
      p.push(`${at}.type: one of ${Object.keys(TYPES).join(", ")}`);
  });
  return p;
}

export function timeline(s, ctx) {
  const bad = timelineProblems(s.props);
  if (bad.length) throw new Error(`Timeline scene cannot be drawn: ${bad[0]}`);
  const ev = s.props.events;
  const n = ev.length;
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
  const cursor = wordCursor(ctx);
  const said = ev.map((e) => cursor.find(e.on ?? e.label));
  const when = (i) =>
    said[i] !== null ? said[i] - LEAD : ctx.at + (perLine ? ctx.lines[i].start : 0.6 + i * step);
  const spans = spansOf(
    ev.map((_, i) => Math.min(when(i), ctx.at + ctx.seconds - IN)),
    ctx,
  );
  html += `<ol class="${n > 6 ? "tl tl-dense" : "tl"}">`;
  ev.forEach((e, i) => {
    const type = e.type ?? "info";
    html += `<li id="${ctx.prefix}-w${i}"><div id="${ctx.prefix}-e${i}" class="tl-row tl-${type}"><span class="tl-t">${esc(e.at)}</span><span class="tl-dot"></span><span class="tl-b"><span class="tl-k">${TYPES[type]}</span> ${esc(e.label)}${e.where ? `<small>${esc(e.where)}</small>` : ""}</span>${focusOn(s.props) ? rail(`${ctx.prefix}-r${i}`, spans[i]).html : ""}</div></li>`;
    if (focusOn(s.props)) plan.push(...rail(`${ctx.prefix}-r${i}`, spans[i]).plan);
    plan.push({
      id: `${ctx.prefix}-e${i}`,
      frames: fadeUp(false, ctx.rise / 2),
      at: Math.min(when(i), ctx.at + ctx.seconds - IN),
      dur: IN,
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
  html += "</ol>";
  return { html, plan };
}

export const timelineCss = (brand) => `
.tl{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:calc(var(--u)*2.6);width:100%}
.tl-row{position:relative;padding-bottom:calc(var(--u)*1.2);display:grid;grid-template-columns:calc(var(--u)*17) calc(var(--u)*3) 1fr;align-items:start;column-gap:calc(var(--u)*2.4);font-size:calc(var(--u)*3.8);line-height:1.25}
.tl-dense{gap:calc(var(--u)*1.5)}
.tl-dense .tl-row{font-size:calc(var(--u)*3.2)}
.tl-t{font-weight:700;color:${brand.colors.muted};text-align:end;font-variant-numeric:tabular-nums}
.tl-dot{width:calc(var(--u)*2.4);height:calc(var(--u)*2.4);margin-top:calc(var(--u)*.7);border-radius:50%;border:calc(var(--u)*.45) solid ${brand.colors.fg}}
.tl-failure .tl-dot,.tl-fix .tl-dot{background:${brand.colors.accent};border-color:${brand.colors.accent}}
.tl-alert .tl-dot{background:${brand.colors.fg}}
.tl-k{font-size:.62em;font-weight:700;letter-spacing:.08em;color:${brand.colors.accent};margin-inline-end:calc(var(--u)*1)}
.tl-b small{display:block;font-size:.72em;color:${brand.colors.muted}}
`;
