// The spotlight layout for item scenes (`layout: "spotlight"` on list, steps and funnel): one item fills the frame at
// a time, large, and the next replaces it on its spoken word. It uses the whole tall frame, always has something
// moving (the rail fills under the item for as long as it is spoken), and shows where you are with a row of dots.
// A pure function of the items and their in-times; every string is escaped.
import { IN, esc, fadeUp, rail, spansOf } from "./shared.mjs";

export const LAYOUTS = ["stack", "spotlight"];

/** Type size (in frame units) for a spotlight label: short labels are huge, long ones step down. */
export const sizeFor = (text, vertical = true) => {
  const n = [...String(text)].length;
  const base = n <= 10 ? 19 : n <= 16 ? 15 : n <= 28 ? 12 : n <= 48 ? 9.5 : 7.5;
  return vertical ? base : Math.round(base * 0.62 * 10) / 10;
};

/**
 * `entries`: [{ label, sub?, tag? }] (`tag` is a small kicker above the label, such as "2 of 5" or a number);
 * `ats`: in-times in film seconds, one per entry; `title`: an optional heading kept small at the top.
 * Returns { html, plan }.
 */
export function spotlight(ctx, { title, entries, ats }) {
  const vertical = !(ctx.size?.[0] > ctx.size?.[1]);
  const spans = spansOf(ats, ctx);
  const plan = [];
  let html = "";
  if (title) {
    html += `<h2 id="${ctx.prefix}-h" class="heading sp-title">${esc(title)}</h2>`;
    plan.push({
      id: `${ctx.prefix}-h`,
      frames: fadeUp(ctx.first, ctx.rise),
      at: ctx.at,
      dur: IN,
      ease: "out",
    });
  }
  html += `<div class="sp-stage">`;
  entries.forEach((e, i) => {
    const id = `${ctx.prefix}-p${i}`;
    const last = i === entries.length - 1;
    const r = rail(`${id}-r`, spans[i]);
    // the outer element leaves (opacity), the inner one arrives (opacity and rise), so the two never fight
    html += `<div id="${id}-x" class="sp-out"><div id="${id}" class="sp-item" style="font-size:calc(var(--u)*${sizeFor(e.label, vertical)})">${e.tag ? `<span class="sp-tag">${esc(e.tag)}</span>` : ""}<span class="sp-label">${esc(e.label)}</span>${e.sub ? `<small class="sp-sub">${esc(e.sub)}</small>` : ""}${r.html}</div></div>`;
    // in: rises and fades up on its word; out: leaves just before the next one arrives (the last one stays)
    plan.push({
      id,
      at: ats[i],
      dur: 0.4,
      ease: "out",
      frames: [
        { opacity: 0, transform: `translateY(${ctx.rise * 2}px) scale(0.96)` },
        { opacity: 1, transform: "translateY(0) scale(1)" },
      ],
    });
    plan.push(...r.plan);
    if (!last)
      plan.push({
        id: `${id}-x`,
        at: Math.max(ats[i] + 0.5, spans[i].until - 0.3),
        dur: 0.25,
        ease: "in",
        frames: [{ opacity: 1 }, { opacity: 0 }],
      });
  });
  html += `</div><div class="sp-dots">`;
  entries.forEach((_, i) => {
    const id = `${ctx.prefix}-d${i}`;
    html += `<i id="${id}" class="sp-dot"></i>`;
    plan.push({
      id,
      at: ats[i],
      dur: 0.3,
      ease: "out",
      frames: [
        { opacity: 0.35, transform: "scale(1)" },
        { opacity: 1, transform: "scale(1.5)" },
      ],
    });
    if (i + 1 < entries.length)
      plan.push({
        id,
        at: spans[i].until,
        dur: 0.3,
        ease: "out",
        frames: [
          { opacity: 1, transform: "scale(1.5)" },
          { opacity: 0.6, transform: "scale(1)" },
        ],
      });
  });
  html += `</div>`;
  return { html, plan };
}

export const spotlightCss = (brand) => {
  const { fg, accent, muted } = brand.colors;
  return `
.sp-title{font-size:calc(var(--u)*4.2);color:${muted};text-transform:uppercase;letter-spacing:.08em}
.sp-stage{position:relative;flex:1;min-height:calc(var(--u)*50);width:100%}
.sp-out{position:absolute;inset:0}
.sp-item{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;gap:calc(var(--u)*1.6);font-weight:800;line-height:1.05;letter-spacing:-.01em;opacity:0}
.sp-label{display:block}
.sp-tag{font-size:.34em;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:${accent}}
.sp-sub{font-size:.34em;font-weight:500;line-height:1.25;color:${muted};letter-spacing:0}
.sp-item .rail{position:static;margin-top:calc(var(--u)*2);height:calc(var(--u)*1.1);width:100%}
.sp-dots{display:flex;gap:calc(var(--u)*1.6);justify-content:center;padding-top:calc(var(--u)*2)}
.sp-dot{width:calc(var(--u)*1.6);height:calc(var(--u)*1.6);border-radius:50%;background:${accent};opacity:.35}
.sp-item .sp-label{color:${fg}}
`;
};
