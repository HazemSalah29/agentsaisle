// The `calligraphy` scene: a line of Arabic (or any script) lettering revealed word by word, in the text's own
// reading direction. Words are real text in HTML, so the browser shapes the letters and joins them; a word is
// never split into letters (that would break the joins) and the text is never rewritten (no tatweel, no
// presentation forms). Font: the brand font, or a family from brand/fonts named by file name.
import { LIMITS, calligraphyProblems, dirOf, hasArabic, wordsOf } from "../../calligraphy/text.mjs";
import { IN, esc } from "./shared.mjs";

export { LIMITS, calligraphyProblems, dirOf, wordsOf };

// Overhang room: marks above and below the line and the tails of letters must not be clipped by the wipe.
const wipe = (rtl, shown) => {
  // inset(top right bottom left): hidden means everything is cut from the side the reading starts on.
  const t = "-40%";
  const open = "-10%";
  if (shown) return `inset(${t} ${open} ${t} ${open})`;
  return rtl ? `inset(${t} ${open} ${t} 100%)` : `inset(${t} 100% ${t} ${open})`;
};

export function calligraphy(s, ctx) {
  const bad = calligraphyProblems(s.props);
  if (bad.length) throw new Error(`Calligraphy scene cannot be drawn: ${bad[0]}`);
  const words = wordsOf(s.props.text);
  const dir = dirOf(s.props.text);
  const rtl = dir === "rtl";
  const reveal = s.props.reveal ?? "wipe";
  const lang = hasArabic(s.props.text) ? "ar" : "und";
  const font = s.props.font ? ` style="font-family:'${esc(s.props.font)}',serif"` : "";
  const n = words.length;
  const perLine = ctx.lines.length === n;
  const span = Math.max(0.5, ctx.seconds - 1.6);
  const when = (i) =>
    ctx.at + (perLine ? ctx.lines[i].start : 0.4 + (n === 1 ? 0 : (i * span) / n));
  const plan = [];
  let html = `<p id="${ctx.prefix}-c" class="cal" dir="${dir}" lang="${lang}"${font}>`;
  words.forEach((w, i) => {
    const id = `${ctx.prefix}-w${i}`;
    html += `<span id="${id}" class="cal-w">${esc(w)}</span>${i < n - 1 ? " " : ""}`;
    const dur = reveal === "fade" ? IN : 0.7;
    const frames =
      reveal === "wipe"
        ? [
            { clipPath: wipe(rtl, false), opacity: 1 },
            { clipPath: wipe(rtl, true), opacity: 1 },
          ]
        : reveal === "rise"
          ? [
              { opacity: 0, transform: `translateY(${Math.round(ctx.rise / 2)}px)` },
              { opacity: 1, transform: "translateY(0px)" },
            ]
          : [{ opacity: 0 }, { opacity: 1 }];
    // The word is hidden before its turn: the first keyframe holds (fill: both).
    plan.push({
      id,
      frames,
      at: Math.min(when(i), ctx.at + ctx.seconds - dur),
      dur,
      ease: reveal === "wipe" ? "inOut" : "out",
    });
  });
  html += "</p>";
  const after = ctx.at + Math.min(ctx.seconds - IN, 0.4 + span + 0.5);
  for (const [k, cls] of [
    ["translation", "cal-tr"],
    ["by", "cal-by"],
  ]) {
    if (!s.props[k]) continue;
    const id = `${ctx.prefix}-${cls}`;
    html += `<p id="${id}" class="${cls}">${esc(s.props[k])}</p>`;
    plan.push({ id, frames: [{ opacity: 0 }, { opacity: 1 }], at: after, dur: IN, ease: "out" });
  }
  return { html, plan };
}

export const calligraphyCss = (brand) => `
.cal{margin:0;text-align:center;font-size:calc(var(--u)*15);line-height:1.8;font-weight:700;color:${brand.colors.fg}}
.cal-w{display:inline-block;unicode-bidi:isolate;padding-inline:.04em}
.cal-tr{margin:0;text-align:center;font-size:calc(var(--u)*4.2);line-height:1.4;color:${brand.colors.muted}}
.cal-by{margin:0;text-align:center;font-size:calc(var(--u)*3.2);color:${brand.colors.accent}}
`;
