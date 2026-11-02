// The `kinetic` scene: speech-synced bold type. Every word of the scene's narration pops in at the moment it is
// spoken, set in a heavy condensed display font; key words take the accent colour with a glow and a spark ring;
// a phrase leaves (slide, drop, blur or shatter) just before the next one arrives. Around the words the scene can
// show a running caption, 3D-tilted cards whose rows appear on spoken words, and a node flow with a travelling dot.
// Everything is HTML, CSS and the Web Animations plan: no script and no WebGL in the page, every string escaped,
// and all motion sampled from pure functions, so a frame depends on the scene's clock alone.
import { EASE_FN, clamp, r3, rnd, samples } from "./motion.mjs";
import { esc } from "./shared.mjs";

export const LIMITS = {
  phrases: 12,
  perPhrase: 4,
  phraseText: 40,
  emph: 12,
  cards: 2,
  rows: 5,
  nodes: 5,
  label: 24,
  tag: 12,
  text: 120,
  letters: 28,
};
export const BGS = ["black", "dark", "accent"];
export const EXITS = ["slide", "drop", "blur", "shatter", "none"];
export const POP = 0.22;
const BASE_SIZE = { 1: 26, 2: 20, 3: 15, 4: 12 };
const num = (v) => typeof v === "number" && Number.isFinite(v);
const norm = (w) =>
  String(w)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
/** The word as shown: quotes, commas, colons and semicolons removed; . ? ! stay. Pure. */
export const shown = (w) =>
  String(w)
    .replace(/["'“”‘’,;:()]/g, "")
    .trim();

/** Problems with a kinetic scene's props, as readable strings. Pure. */
export function kineticProblems(props) {
  const p = [];
  if (props.bg !== undefined && !BGS.includes(props.bg)) p.push(`bg: one of ${BGS.join(", ")}`);
  if (props.exit !== undefined && !EXITS.includes(props.exit))
    p.push(`exit: one of ${EXITS.join(", ")}`);
  for (const k of ["grid", "vignette", "grain", "caption", "holdLast"])
    if (props[k] !== undefined && typeof props[k] !== "boolean") p.push(`${k}: true or false`);
  if (props.y !== undefined && !(num(props.y) && props.y >= 15 && props.y <= 85))
    p.push("y: 15 to 85 (percent down the frame)");
  if (
    props.text !== undefined &&
    (typeof props.text !== "string" || props.text.length > LIMITS.text)
  )
    p.push(`text: up to ${LIMITS.text} characters (used only when the scene has no voice)`);
  const ph = props.phrases;
  if (ph !== undefined) {
    if (!Array.isArray(ph) || ph.length > LIMITS.phrases)
      p.push(`phrases: at most ${LIMITS.phrases}`);
    else
      ph.forEach((t, i) => {
        if (typeof t !== "string" || !t.trim() || t.length > LIMITS.phraseText)
          p.push(`phrases[${i}]: 1 to ${LIMITS.phraseText} characters`);
        else if (t.trim().split(/\s+/).length > LIMITS.perPhrase)
          p.push(`phrases[${i}]: at most ${LIMITS.perPhrase} words on screen at once`);
      });
  }
  if (props.emph !== undefined) {
    if (
      !Array.isArray(props.emph) ||
      props.emph.length > LIMITS.emph ||
      props.emph.some((e) => typeof e !== "string" || !e.trim() || e.length > 24)
    )
      p.push(`emph: up to ${LIMITS.emph} words`);
  }
  const cards = props.cards ?? [];
  if (!Array.isArray(cards) || cards.length > LIMITS.cards)
    p.push(`cards: at most ${LIMITS.cards}`);
  else
    cards.forEach((c, i) => {
      const at = `cards[${i}]`;
      if (typeof c?.title !== "string" || !c.title.trim() || c.title.length > LIMITS.label)
        p.push(`${at}.title: 1 to ${LIMITS.label} characters`);
      if (!Array.isArray(c?.rows) || c.rows.length < 1 || c.rows.length > LIMITS.rows)
        p.push(`${at}.rows: 1 to ${LIMITS.rows} rows`);
      else
        c.rows.forEach((r, k) => {
          if (typeof r?.text !== "string" || !r.text.trim() || r.text.length > 32)
            p.push(`${at}.rows[${k}].text: 1 to 32 characters`);
          if (r?.tag !== undefined && (typeof r.tag !== "string" || r.tag.length > LIMITS.tag))
            p.push(`${at}.rows[${k}].tag: up to ${LIMITS.tag} characters`);
          if (r?.bind !== undefined && !(Number.isInteger(r.bind) && r.bind >= 0))
            p.push(`${at}.rows[${k}].bind: a word number`);
        });
      for (const k of ["x", "y"])
        if (c?.[k] !== undefined && !(num(c[k]) && c[k] >= 20 && c[k] <= 80))
          p.push(`${at}.${k}: 20 to 80`);
      if (
        c?.tilt !== undefined &&
        !(
          Array.isArray(c.tilt) &&
          c.tilt.length === 2 &&
          c.tilt.every((v) => num(v) && Math.abs(v) <= 40)
        )
      )
        p.push(`${at}.tilt: [x, y] degrees, at most 40`);
      if (c?.at !== undefined && !(num(c.at) && c.at >= 0))
        p.push(`${at}.at: seconds from the scene start`);
    });
  const flow = props.flow;
  if (flow !== undefined) {
    if (
      !flow ||
      !Array.isArray(flow.nodes) ||
      flow.nodes.length < 2 ||
      flow.nodes.length > LIMITS.nodes
    )
      p.push(`flow.nodes: 2 to ${LIMITS.nodes} labels`);
    else
      flow.nodes.forEach((n, i) => {
        if (typeof n !== "string" || !n.trim() || n.length > 16)
          p.push(`flow.nodes[${i}]: 1 to 16 characters`);
      });
    if (flow?.at !== undefined && !(num(flow.at) && flow.at >= 0))
      p.push("flow.at: seconds from the scene start");
  }
  return p;
}

/** Spoken words for the scene: the scene's own word times, or `text` spread evenly when it has no voice. Pure. */
export function wordsOf(props, words, seconds) {
  if (words?.length) return words;
  const toks = String(props.text ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!toks.length) return [];
  const span = Math.max(0.5, seconds - 0.5);
  return toks.map((text, i) => ({
    text,
    start: r3(0.2 + (span * i) / toks.length),
    end: r3(0.2 + (span * (i + 0.8)) / toks.length),
    line: "t",
  }));
}

/** Words in groups of at most `LIMITS.perPhrase`: by the given phrases when they match the words, else at punctuation. Pure. */
export function groupWords(words, phrases) {
  if (phrases?.length) {
    const counts = phrases.map((t) => t.trim().split(/\s+/).length);
    if (counts.reduce((a, b) => a + b, 0) === words.length) {
      let at = 0;
      return counts.map((n) => words.slice(at, (at += n)));
    }
  }
  const out = [];
  let cur = [];
  for (const w of words) {
    cur.push(w);
    if (/[.!?;:,]$/.test(w.text) || cur.length >= LIMITS.perPhrase) {
      out.push(cur);
      cur = [];
    }
  }
  if (cur.length) out.push(cur);
  return out;
}

/** Type size (units of 1% of the frame width) for a phrase: big for few words, small enough that no word runs off. Pure. */
export function phraseSize(texts, slab = false) {
  const n = Math.min(4, Math.max(1, texts.length));
  const longest = Math.max(...texts.map((t) => t.length));
  const fit = 84 / (0.52 * Math.max(1, longest));
  const base = BASE_SIZE[n] * (slab ? 1.15 : 1);
  return Math.round(clamp(Math.min(base, fit), 6, slab ? 32 : 26) * 10) / 10;
}

const popFrames = () =>
  samples(POP, 40, 9).map((u) => {
    const e = EASE_FN.outBack(u);
    return {
      offset: r3(u),
      opacity: r3(Math.min(1, u * 7)),
      transform: `translateY(${r3((1 - e) * 22)}%) scale(${r3(0.35 + 0.65 * e)})`,
    };
  });

const exitFrames = (style, key) => {
  switch (style) {
    case "drop":
      return [
        { opacity: 1, transform: "translateY(0%) rotate(0deg)" },
        { opacity: 0, transform: `translateY(40%) rotate(${r3((rnd(key) - 0.5) * 12)}deg)` },
      ];
    case "blur":
      return [
        { opacity: 1, filter: "blur(0px)" },
        { opacity: 0, filter: "blur(18px)" },
      ];
    default:
      return [
        { opacity: 1, transform: "translateY(0%)" },
        { opacity: 0, transform: "translateY(-30%)" },
      ];
  }
};

/** The scene's markup and its animation plan. */
export function kinetic(s, ctx) {
  const props = s.props ?? {};
  const bad = kineticProblems(props);
  if (bad.length) throw new Error(`Kinetic scene cannot be drawn: ${bad[0]}`);
  const P = ctx.prefix;
  const T = ctx.seconds;
  const plan = [];
  const bg = props.bg ?? "black";
  const words = wordsOf(props, ctx.words, T);
  const groups = groupWords(words, props.phrases);
  const emph = new Set((props.emph ?? []).map(norm));
  // Phrases that never left would pile up on each other: with more than one phrase, "none" means slide.
  const exit =
    props.exit === "none" && groupWords(words, props.phrases).length > 1
      ? "slide"
      : (props.exit ?? "slide");
  const holdLast = props.holdLast !== false;
  const slab = bg === "accent";
  let html = `<div class="kn-root kn-bg-${bg}">`;
  if (bg !== "accent") html += `<div class="kn-glow"></div>`;
  if (props.grid) html += `<div class="kn-grid"></div>`;
  if (props.vignette) html += `<div class="kn-vignette"></div>`;

  // Phrases and their words.
  const y = props.y ?? (props.cards?.length || props.flow ? 24 : 46);
  const aspect = ctx.size ? ctx.size[1] / ctx.size[0] : 16 / 9; // frame height over width
  // Two slots, one above the other: the next phrase arrives in the free slot while the last one is still readable.
  const shownTexts = groups.map((g) => g.map((w) => shown(w.text)));
  const sizes = shownTexts.map((t) => phraseSize(t, slab));
  const heights = shownTexts.map(
    (t, j) => Math.max(1, Math.ceil((t.join(" ").length * 0.52 * sizes[j]) / 84)) * sizes[j],
  );
  const gap = Math.max(...heights, 0) / aspect / 2 + 4;
  const slotY = (j) => clamp(groups.length > 1 ? y + (j % 2 ? gap : -gap) : y, 14, 86);
  let n = 0;
  groups.forEach((g, j) => {
    const texts = shownTexts[j];
    const size = sizes[j];
    const pid = `${P}-p${j}`;
    const lastEnd = g[g.length - 1].end;
    const wantsExit = exit !== "none" && !(holdLast && j === groups.length - 1);
    const shatter = wantsExit && exit === "shatter" && texts.join("").length <= LIMITS.letters;
    let inner = "";
    g.forEach((w, i) => {
      const k = n++;
      const wid = `${P}-w${k}`;
      const isEmph = emph.has(norm(w.text));
      const label = esc(texts[i]);
      const body = shatter
        ? [...texts[i]]
            .map((ch, c) => `<span id="${P}-l${k}-${c}" class="kn-l">${esc(ch)}</span>`)
            .join("")
        : label;
      inner += `<span id="${wid}" class="kn-w${isEmph ? " kn-emph" : ""}">${body}${isEmph ? `<b id="${P}-b${k}" class="kn-burst"></b>` : ""}</span> `;
      plan.push({
        id: wid,
        frames: popFrames(),
        at: ctx.at + Math.max(0, w.start - 0.03),
        dur: POP,
        ease: "linear",
      });
      if (isEmph) {
        plan.push({
          id: `${P}-b${k}`,
          frames: [
            { opacity: 0.95, transform: "translate(-50%, -50%) scale(0.2)" },
            { opacity: 0, transform: "translate(-50%, -50%) scale(1.7)" },
          ],
          at: ctx.at + Math.max(0, w.start - 0.02),
          dur: 0.45,
          ease: "out",
        });
      }
    });
    html += `<div class="kn-pos" style="top:${r3(slotY(j))}%"><div id="${pid}" class="kn-phrase" style="font-size:calc(var(--u)*${size})">${inner.trim()}</div></div>`;
    if (wantsExit) {
      // Leave when the slot is needed again (two phrases on), or a little after the last word is said.
      const slotNeeded = groups[j + 2]?.[0]?.start ?? T;
      const tExit = clamp(Math.min(lastEnd + 0.5, slotNeeded - 0.05), lastEnd + 0.12, T - 0.05);
      if (shatter) {
        g.forEach((w, i) => {
          const k = n - g.length + i;
          [...texts[i]].forEach((_, c) => {
            const r1 = rnd(k * 31 + c * 7 + 1);
            const r2 = rnd(k * 31 + c * 7 + 2);
            const r3_ = rnd(k * 31 + c * 7 + 3);
            plan.push({
              id: `${P}-l${k}-${c}`,
              frames: [
                { opacity: 1, transform: "translate(0%, 0%) rotate(0deg) scale(1)" },
                {
                  opacity: 0,
                  transform: `translate(${r3((r1 - 0.5) * 340)}%, ${r3((r2 - 0.3) * 420)}%) rotate(${r3((r3_ - 0.5) * 220)}deg) scale(${r3(0.4 + r1)})`,
                },
              ],
              at: ctx.at + tExit,
              dur: 0.3,
              ease: "out",
            });
          });
        });
      } else
        plan.push({
          id: pid,
          frames: exitFrames(exit, j),
          at: ctx.at + tExit,
          dur: 0.18,
          ease: "in",
        });
    }
  });

  // Running caption (small, top left) of the line being spoken, with key words in chips.
  if (props.caption) {
    const lines = [...new Set(words.map((w) => w.line))];
    lines.forEach((ln, li) => {
      const ws = words.filter((w) => w.line === ln);
      const cid = `${P}-cl${li}`;
      html += `<div id="${cid}" class="kn-cap">${ws
        .map(
          (w, i) =>
            `<span id="${cid}-w${i}" class="kn-cw${emph.has(norm(w.text)) ? " kn-chip" : ""}">${esc(shown(w.text))}</span>`,
        )
        .join(" ")}</div>`;
      const t0 = ws[0].start;
      const t1 = Math.min(T, ws[ws.length - 1].end + 0.12);
      plan.push({
        id: cid,
        frames: [{ opacity: 0 }, { opacity: 1 }, { opacity: 1 }, { opacity: 0 }],
        at: ctx.at + Math.max(0, t0 - 0.05),
        dur: Math.max(0.2, t1 - t0 + 0.05),
        ease: "linear",
      });
      ws.forEach((w, i) =>
        plan.push({
          id: `${cid}-w${i}`,
          frames: [{ opacity: 0 }, { opacity: 1 }],
          at: ctx.at + Math.max(0, w.start - 0.01),
          dur: 0.06,
          ease: "out",
        }),
      );
    });
  }

  // Cards: tilted in 3D, rows appear on spoken words.
  (props.cards ?? []).forEach((c, i) => {
    const id = `${P}-c${i}`;
    const [rx, ry] = c.tilt ?? [14, -16];
    const t0 = c.at ?? words[0]?.start ?? 0.2;
    html += `<div class="kn-persp" style="left:${c.x ?? 50}%;top:${c.y ?? 66}%"><div id="${id}" class="kn-card"><div class="kn-card-title">${esc(c.title)}</div>`;
    c.rows.forEach((r, k) => {
      html += `<div id="${id}-r${k}" class="kn-row"><span>${esc(r.text)}</span>${r.tag ? `<small>${esc(r.tag)}</small>` : ""}</div>`;
      const bound = Number.isInteger(r.bind) ? words[r.bind]?.start : undefined;
      const at = bound ?? t0 + 0.35 + k * Math.max(0.25, (T - t0 - 1) / (c.rows.length + 1));
      plan.push({
        id: `${id}-r${k}`,
        frames: [
          { opacity: 0, transform: "translateX(40%)" },
          { opacity: 1, transform: "translateX(0%)" },
        ],
        at: ctx.at + clamp(at, 0, T - 0.1),
        dur: 0.28,
        ease: "out",
      });
    });
    html += `</div></div>`;
    plan.push({
      id,
      frames: samples(0.6, 40, 15).map((u) => {
        const e = EASE_FN.spring(u);
        return {
          offset: r3(u),
          opacity: r3(Math.min(1, u * 5)),
          transform: `rotateX(${r3(rx)}deg) rotateY(${r3(ry + (1 - e) * -70)}deg) translateX(${r3((1 - e) * 60)}%) scale(${r3(0.8 + 0.2 * e)})`,
        };
      }),
      at: ctx.at + t0,
      dur: 0.6,
      ease: "linear",
    });
  });

  // Flow: a vertical chain of nodes with a glowing dot travelling down it.
  if (props.flow) {
    const f = props.flow;
    const t0 = f.at ?? words[0]?.start ?? 0.2;
    const id = `${P}-f`;
    html += `<div class="kn-flow" style="top:${props.cards?.length ? 78 : 62}%"><div class="kn-flow-line"></div><div id="${id}-dot" class="kn-dot"></div>`;
    f.nodes.forEach((label, k) => {
      html += `<div id="${id}-n${k}" class="kn-node">${esc(label)}</div>`;
      plan.push({
        id: `${id}-n${k}`,
        frames: [
          { opacity: 0, transform: "scale(0.6)" },
          { opacity: 1, transform: "scale(1)" },
        ],
        at: ctx.at + clamp(t0 + k * 0.35, 0, T - 0.1),
        dur: 0.25,
        ease: "out",
      });
    });
    html += `</div>`;
    const span = Math.max(0.5, f.nodes.length * 0.35 + 0.3);
    plan.push({
      id: `${id}-dot`,
      frames: samples(span, 30, 30).map((u) => ({
        offset: r3(u),
        top: `${r3(EASE_FN.inOut(u) * 100)}%`,
        opacity: u < 0.04 ? 0 : 1,
      })),
      at: ctx.at + clamp(t0, 0, T - 0.1),
      dur: span,
      ease: "linear",
    });
  }
  if (props.grain) html += `<div class="kn-grain"></div>`;
  html += `</div>`;
  return { html, plan };
}

/** Styles for the kinetic scene. The display font is Anton (SIL OFL), copied into the project when a kinetic scene exists. */
export const kineticCss = (brand) => {
  const a = brand.colors.accent;
  return `
.scene-kinetic{padding:0}
.kn-root{position:absolute;inset:0;overflow:hidden;font-family:'Anton',sans-serif;perspective:calc(var(--u)*120)}
.kn-bg-black{background:#050607}
.kn-bg-dark{background:${brand.colors.bg}}
.kn-bg-accent{background:${a};color:#08090a}
.kn-glow{position:absolute;inset:0;background:radial-gradient(circle at 50% 44%,${a}40,transparent 62%)}
.kn-grid{position:absolute;inset:0;background-image:radial-gradient(rgba(255,255,255,.16) 1px,transparent 1.5px);background-size:calc(var(--u)*5) calc(var(--u)*5);opacity:.55}
.kn-vignette{position:absolute;inset:0;background:radial-gradient(ellipse at center,rgba(0,0,0,0) 55%,rgba(0,0,0,.65) 100%)}
.kn-grain{position:absolute;inset:0;opacity:.06;background-image:radial-gradient(rgba(255,255,255,.9) 1px,transparent 1px);background-size:calc(var(--u)*.7) calc(var(--u)*.7)}
.kn-pos{position:absolute;left:calc(var(--u)*7);right:calc(var(--u)*7);transform:translateY(-50%)}
.kn-phrase{display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:.04em .3em;text-align:center;text-transform:uppercase;line-height:.98;letter-spacing:.005em;color:#fff;font-weight:400}
.kn-bg-accent .kn-phrase{color:#08090a}
.kn-w{position:relative;display:inline-block;opacity:0;will-change:transform}
.kn-l{display:inline-block}
.kn-emph{color:${a};text-shadow:0 0 calc(var(--u)*2.6) ${a}99,0 0 calc(var(--u)*6) ${a}55}
.kn-bg-accent .kn-emph{color:#fff;text-shadow:none}
.kn-burst{position:absolute;left:50%;top:50%;width:2.6em;height:2.6em;border-radius:50%;opacity:0;pointer-events:none;background:repeating-conic-gradient(${a} 0 5deg,transparent 5deg 30deg);-webkit-mask:radial-gradient(circle,transparent 28%,#000 30%,#000 62%,transparent 64%);mask:radial-gradient(circle,transparent 28%,#000 30%,#000 62%,transparent 64%)}
.kn-cap{position:absolute;left:calc(var(--u)*6);top:calc(var(--u)*7);right:calc(var(--u)*30);font-family:'Inter',sans-serif;font-weight:800;font-size:calc(var(--u)*3.3);line-height:1.25;color:#fff;opacity:0}
.kn-cw{opacity:0}
.kn-chip{background:${a};color:#08090a;padding:0 .3em;border-radius:.2em}
.kn-persp{position:absolute;width:72%;transform:translate(-50%,-50%);perspective:calc(var(--u)*110)}
.kn-card{border:calc(var(--u)*.3) solid ${a}aa;background:rgba(10,12,14,.88);padding:calc(var(--u)*2.4);box-shadow:0 0 calc(var(--u)*5) ${a}44;font-family:'Inter',sans-serif;opacity:0}
.kn-card-title{font-family:'Anton',sans-serif;text-transform:uppercase;letter-spacing:.04em;font-size:calc(var(--u)*3.6);color:${a};margin-bottom:calc(var(--u)*1.6)}
.kn-row{display:flex;justify-content:space-between;align-items:center;gap:calc(var(--u)*2);padding:calc(var(--u)*1.4) calc(var(--u)*2);margin-top:calc(var(--u)*1.1);border:calc(var(--u)*.2) solid rgba(255,255,255,.28);color:#fff;font-weight:800;font-size:calc(var(--u)*3.3);text-transform:uppercase;opacity:0}
.kn-row small{font-size:.7em;color:${a};font-weight:800}
.kn-flow{position:absolute;left:50%;transform:translateX(-50%);display:flex;flex-direction:column;gap:calc(var(--u)*4);align-items:center}
.kn-flow-line{position:absolute;top:0;bottom:0;left:50%;width:calc(var(--u)*.35);transform:translateX(-50%);background:linear-gradient(${a}88,${a}22)}
.kn-dot{position:absolute;left:50%;top:0;width:calc(var(--u)*2.2);height:calc(var(--u)*2.2);transform:translate(-50%,-50%);border-radius:50%;background:${a};box-shadow:0 0 calc(var(--u)*3) ${a},0 0 calc(var(--u)*7) ${a}aa;opacity:0;z-index:2}
.kn-node{position:relative;z-index:1;padding:calc(var(--u)*1.2) calc(var(--u)*3.4);border:calc(var(--u)*.3) solid ${a};background:#090a0c;color:#fff;font-family:'Inter',sans-serif;font-weight:800;font-size:calc(var(--u)*3.8);text-transform:uppercase;letter-spacing:.06em;opacity:0}
`;
};
