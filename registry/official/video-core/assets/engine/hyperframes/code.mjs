// The `code` scene: highlighted code that is revealed line by line, with optional focus (the rest dims) and a
// diff view. Highlighting is done here in Node by the vendored Shiki bundle, so the rendered page holds plain
// spans and no script. Code is text: every token goes through esc, so a hostile snippet cannot become markup.
import { LANGS, tokens } from "../../vendor/shiki.mjs";
import { IN, esc, fadeUp } from "./shared.mjs";

export const CODE_LANGS = Object.keys(LANGS);
export const LIMITS = { chars: 1500, lines: 20, width: 60 };
const COLOR = /^#[0-9a-fA-F]{6,8}$/;
const DIM = 0.28;
const MONO = `ui-monospace,'SF Mono',Menlo,Consolas,'DejaVu Sans Mono',monospace`;
const FADE = 0.3;

const linesOf = (text) => String(text).replace(/\r\n?/g, "\n").replace(/\n$/, "").split("\n");

/** Problems with a code scene's props, as readable strings. `narrationCount` is the scene's narration lines. */
export function codeProblems(props, narrationCount = 0) {
  const p = [];
  if (!CODE_LANGS.includes(props.language))
    p.push(`language: must be one of ${CODE_LANGS.join(", ")}`);
  const hasCode = typeof props.code === "string";
  const hasDiff = props.diff && typeof props.diff === "object";
  if (hasCode === Boolean(hasDiff))
    p.push('give either "code" or "diff", not both and not neither');
  const texts = hasDiff ? [props.diff.before, props.diff.after] : [props.code];
  texts.forEach((t, i) => {
    const at = hasDiff ? (i === 0 ? "diff.before" : "diff.after") : "code";
    if (typeof t !== "string" || !t.trim()) return p.push(`${at}: must be non-empty text`);
    if (t.length > LIMITS.chars) p.push(`${at}: longer than ${LIMITS.chars} characters`);
    const ls = linesOf(t);
    if (ls.length > LIMITS.lines)
      p.push(`${at}: more than ${LIMITS.lines} lines (split it over two scenes)`);
    if (ls.some((l) => l.length > LIMITS.width))
      p.push(
        `${at}: a line is longer than ${LIMITS.width} characters (it would be too small to read)`,
      );
  });
  const total = hasDiff ? 0 : typeof props.code === "string" ? linesOf(props.code).length : 0;
  (props.focus ?? []).forEach((f, i) => {
    const at = `focus[${i}]`;
    const [a, b] = f?.lines ?? [];
    if (!Number.isInteger(a) || !Number.isInteger(b) || a < 1 || b < a)
      p.push(`${at}.lines: must be [first, last] line numbers, counting from 1`);
    else if (total && b > total) p.push(`${at}.lines: line ${b} is past the end (${total} lines)`);
    const hasLine = Number.isInteger(f?.line);
    const hasAt = typeof f?.at === "number";
    if (hasLine === hasAt)
      p.push(`${at}: give either "line" (a narration line, from 0) or "at" (seconds)`);
    if (hasLine && !(f.line >= 0 && f.line < narrationCount))
      p.push(`${at}.line: the scene has ${narrationCount} narration line(s)`);
    if (hasAt && !(f.at >= 0)) p.push(`${at}.at: must be 0 or more`);
  });
  if (hasDiff && props.focus?.length) p.push("focus: not used with diff");
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
    } else {
      rows.push({ type: "add", text: b[j++] });
    }
  }
  return rows;
}

const spans = (toks) =>
  toks
    .map((t) =>
      COLOR.test(t.color)
        ? `<span style="color:${t.color}">${esc(t.content)}</span>`
        : `<span>${esc(t.content)}</span>`,
    )
    .join("");

export function code(s, ctx) {
  const { language, title, file } = s.props;
  const plan = [];
  let rows;
  if (s.props.diff) {
    const hl = (t) => tokens(t, language);
    const rb = hl(s.props.diff.before);
    const ra = hl(s.props.diff.after);
    // Highlight each side whole (so multi-line strings stay right), then pick the tokens for each row.
    let ib = 0;
    let ia = 0;
    rows = diffRows(s.props.diff.before, s.props.diff.after).map((r) => {
      if (r.type === "add") return { ...r, toks: ra[ia++] };
      if (r.type === "same") ia++;
      return { ...r, toks: rb[ib++] };
    });
  } else {
    const hl = tokens(s.props.code, language);
    rows = hl.map((toks, i) => ({ type: "same", text: "", toks, n: i + 1 }));
  }
  const diff = Boolean(s.props.diff);
  const maxLen = Math.max(
    8,
    ...rows.map((r) => (r.toks ?? []).reduce((n, t) => n + t.content.length, 0)),
  );
  // Size the text so the longest line fits the width: a monospace glyph is about 0.61 em wide.
  const fs = Math.round(Math.min(4.2, 84 / (maxLen * 0.61 + 4)) * 100) / 100;

  const heading = title ? `<h2 id="${ctx.prefix}-h" class="heading">${esc(title)}</h2>` : "";
  if (heading)
    plan.push({
      id: `${ctx.prefix}-h`,
      frames: fadeUp(ctx.first, ctx.rise),
      at: ctx.at,
      dur: IN,
      ease: "out",
    });

  const n = rows.length;
  const reveal = Math.min(0.35, Math.max(0.08, (ctx.seconds - 2) / (n + 4)));
  const diffAt = ctx.at + Math.max(1.2, ctx.seconds * 0.45);
  let body = "";
  rows.forEach((r, i) => {
    const id = `${ctx.prefix}-l${i}`;
    const mark = diff ? { same: " ", del: "-", add: "+" }[r.type] : String(r.n);
    body += `<div id="${id}" class="ln ${diff ? r.type : ""}"><span class="no">${esc(mark)}</span><span id="${id}-t" class="tx">${spans(r.toks)}</span></div>`;
    let at = ctx.at + 0.4 + i * reveal;
    if (diff && r.type === "add") at = diffAt + 0.4;
    if (diff && r.type === "del") at = ctx.at + 0.4 + i * reveal;
    plan.push({
      id,
      frames:
        i === 0 && ctx.first
          ? [{ opacity: 1 }, { opacity: 1 }]
          : [
              { opacity: 0, transform: `translateX(${-ctx.rise / 2}px)` },
              { opacity: 1, transform: "translateX(0px)" },
            ],
      at: Math.min(at, ctx.at + ctx.seconds - IN),
      dur: 0.3,
      ease: "out",
    });
    if (diff && r.type === "del") {
      // The removed line turns red when the change starts.
      plan.push({
        id,
        frames: [
          { backgroundColor: "rgba(248,81,73,0)" },
          { backgroundColor: "rgba(248,81,73,0.15)" },
        ],
        at: diffAt,
        dur: 0.4,
        ease: "out",
      });
      plan.push({
        id: `${id}-t`,
        frames: [{ opacity: 1 }, { opacity: 0.55 }],
        at: diffAt,
        dur: 0.4,
        ease: "out",
      });
    }
  });

  // Focus: from the given time, lines outside the range fade to DIM and the range stays bright.
  const steps = (s.props.focus ?? []).map((f) => ({
    from: f.lines[0],
    to: f.lines[1],
    t: f.line !== undefined ? (ctx.lines[f.line]?.start ?? 0) : f.at,
  }));
  if (steps.length)
    rows.forEach((r, i) => {
      const lit = (st) => (r.n >= st.from && r.n <= st.to ? 1 : DIM);
      const frames = [{ offset: 0, opacity: 1 }];
      let prev = 1;
      for (const st of steps) {
        const o = Math.min(1, st.t / ctx.seconds);
        const o2 = Math.min(1, (st.t + FADE) / ctx.seconds);
        const v = lit(st);
        if (v === prev) continue;
        frames.push({ offset: o, opacity: prev }, { offset: Math.max(o, o2), opacity: v });
        prev = v;
      }
      if (frames.length > 1) {
        frames.push({ offset: 1, opacity: prev });
        plan.push({
          id: `${ctx.prefix}-l${i}-t`,
          frames,
          at: ctx.at,
          dur: ctx.seconds,
          ease: "linear",
        });
      }
    });

  const bar = file ? `<div class="code-bar">${esc(file)}</div>` : "";
  const html = `${heading}<div class="code-card" dir="ltr">${bar}<div class="code" style="font-size:calc(var(--u)*${fs})">${body}</div></div>`;
  return { html, plan };
}

/** Styles for this kind. The panel keeps its own dark background so the theme colours always read well. */
export const codeCss = (brand) => `
.code-card{background:#0d1117;border:1px solid ${brand.colors.muted}55;border-radius:calc(var(--u)*1.2);overflow:hidden}
.code-bar{padding:calc(var(--u)*1.4) calc(var(--u)*2.4);font:600 calc(var(--u)*2.4)/1 ${MONO};color:#8b949e;border-bottom:1px solid #30363d}
.code{padding:calc(var(--u)*2) calc(var(--u)*2.4);font:400 1em/1.5 ${MONO};color:#e1e4e8}
.code .ln{display:flex;gap:1.2em;white-space:pre}
.code .no{flex:none;width:1.6em;text-align:right;color:#6e7681}
.code .add{background:rgba(63,185,80,.15)}
`;
