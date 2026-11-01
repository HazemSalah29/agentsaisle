// The five scene kinds for the HyperFrames engine. Each is a pure function from validated props to
// { html, plan }: markup for one scene and the animations that bring it in. Text is always escaped, so a
// hostile string in video.json is shown as text and never becomes markup. Nothing here touches the disk.

export const KINDS = ["title", "quote", "list", "chart", "broll"];

const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ESC[c]);

const fadeUp = (first, rise) => [
  first
    ? { transform: `translateY(${rise}px)` }
    : { opacity: 0, transform: `translateY(${rise}px)` },
  { opacity: 1, transform: "translateY(0)" },
];
const grow = [{ transform: "scaleY(0)" }, { transform: "scaleY(1)" }];

/** Seconds the entrance of each element takes, and how far apart staggered items start. */
const IN = 0.5;
const STAGGER = 0.18;

function title(s, ctx) {
  const id = `${ctx.prefix}-t`;
  const sub = s.props.subtitle
    ? `<p id="${ctx.prefix}-s" class="sub">${esc(s.props.subtitle)}</p>`
    : "";
  const plan = [{ id, frames: fadeUp(ctx.first, ctx.rise), at: ctx.at, dur: IN, ease: "out" }];
  if (sub)
    plan.push({
      id: `${ctx.prefix}-s`,
      frames: fadeUp(false, ctx.rise),
      at: ctx.at + 0.25,
      dur: IN,
      ease: "out",
    });
  return { html: `<h1 id="${id}" class="title">${esc(s.props.text)}</h1>${sub}`, plan };
}

function quote(s, ctx) {
  const id = `${ctx.prefix}-q`;
  const by = [s.props.by, s.props.source].filter(Boolean).map(esc).join(" · ");
  const cite = by ? `<p id="${ctx.prefix}-by" class="cite">${by}</p>` : "";
  const plan = [{ id, frames: fadeUp(ctx.first, ctx.rise), at: ctx.at, dur: IN, ease: "out" }];
  if (cite)
    plan.push({
      id: `${ctx.prefix}-by`,
      frames: fadeUp(false, ctx.rise),
      at: ctx.at + 0.6,
      dur: IN,
      ease: "out",
    });
  return {
    html: `<blockquote id="${id}" class="quote"><p>${esc(s.props.text)}</p></blockquote>${cite}`,
    plan,
  };
}

function list(s, ctx) {
  const items = s.props.items;
  const plan = [];
  let html = "";
  if (s.props.heading) {
    html += `<h2 id="${ctx.prefix}-h" class="heading">${esc(s.props.heading)}</h2>`;
    plan.push({
      id: `${ctx.prefix}-h`,
      frames: fadeUp(ctx.first, ctx.rise),
      at: ctx.at,
      dur: IN,
      ease: "out",
    });
  }
  const tag = s.props.numbered ? "ol" : "ul";
  html += `<${tag} class="items">`;
  items.forEach((text, i) => {
    const id = `${ctx.prefix}-i${i}`;
    // Reveal each item with its narration line when there is one per item; otherwise spread them out.
    const line = ctx.lines.length === items.length ? ctx.lines[i] : null;
    const at =
      ctx.at +
      (line
        ? line.start
        : 0.4 + i * Math.max(STAGGER, Math.min(1, (ctx.seconds - 1) / items.length)));
    html += `<li id="${id}">${esc(text)}</li>`;
    plan.push({
      id,
      frames: fadeUp(false, ctx.rise),
      at: Math.min(at, ctx.at + ctx.seconds - IN),
      dur: IN,
      ease: "out",
    });
  });
  html += `</${tag}>`;
  return { html, plan };
}

const num = (v, lang) => new Intl.NumberFormat(lang, { maximumFractionDigits: 2 }).format(v);
const r1 = (n) => Math.round(n * 100) / 100;

function chart(s, ctx) {
  const { type, data, unit = "" } = s.props;
  const W = 100;
  const top = 8;
  const bottom = 46;
  const lo = Math.min(0, ...data.map((d) => d.value));
  const hi = Math.max(0, ...data.map((d) => d.value)) || 1;
  const y = (v) => r1(bottom - ((v - lo) / (hi - lo || 1)) * (bottom - top));
  const y0 = y(0);
  const slot = (W - 8) / data.length;
  const cx = (i) => r1(4 + slot * (i + 0.5));
  const plan = [];
  let svg = `<svg class="chart" viewBox="0 0 ${W} 58" role="img" aria-label="${esc(s.props.title ?? "Chart")}" dir="ltr">`;
  svg += `<line class="axis" x1="4" x2="${W - 4}" y1="${y0}" y2="${y0}"/>`;
  if (type === "bar") {
    const bw = r1(Math.min(slot * 0.6, 14));
    data.forEach((d, i) => {
      const id = `${ctx.prefix}-b${i}`;
      const yy = y(d.value);
      svg += `<rect id="${id}" class="bar" x="${r1(cx(i) - bw / 2)}" y="${Math.min(yy, y0)}" width="${bw}" height="${r1(Math.abs(y0 - yy))}" style="transform-origin:0px ${y0}px"/>`;
      plan.push({ id, frames: grow, at: ctx.at + 0.3 + i * STAGGER, dur: 0.6, ease: "out" });
    });
  } else {
    const pts = data.map((d, i) => `${cx(i)},${y(d.value)}`).join(" ");
    svg += `<polyline id="${ctx.prefix}-ln" class="line" points="${pts}" pathLength="1" stroke-dasharray="1"/>`;
    plan.push({
      id: `${ctx.prefix}-ln`,
      frames: [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }],
      at: ctx.at + 0.3,
      dur: Math.max(0.8, Math.min(2.5, ctx.seconds - 1)),
      ease: "inOut",
    });
    data.forEach(
      (d, i) => (svg += `<circle class="dot" cx="${cx(i)}" cy="${y(d.value)}" r="1.2"/>`),
    );
  }
  data.forEach((d, i) => {
    svg += `<text class="val" x="${cx(i)}" y="${r1(Math.min(y(d.value), y0) - 1.6)}">${esc(num(d.value, ctx.lang))}${esc(unit)}</text>`;
    svg += `<text class="lab" x="${cx(i)}" y="54">${esc(d.label)}</text>`;
  });
  svg += "</svg>";
  const heading = s.props.title
    ? `<h2 id="${ctx.prefix}-h" class="heading">${esc(s.props.title)}</h2>`
    : "";
  if (heading)
    plan.push({
      id: `${ctx.prefix}-h`,
      frames: fadeUp(ctx.first, ctx.rise),
      at: ctx.at,
      dur: IN,
      ease: "out",
    });
  return { html: heading + svg, plan };
}

const VIDEO_EXT = /\.(mp4|webm|mov)$/i;

function broll(s, ctx) {
  const asset = ctx.assets.get(s.props.asset);
  const src = `assets/media/${esc(asset.file)}`;
  const id = `${ctx.prefix}-m`;
  const fit = s.props.fit === "contain" ? "contain" : "cover";
  const media = VIDEO_EXT.test(asset.file)
    ? `<video id="${id}" class="media" src="${src}" muted playsinline style="object-fit:${fit}"></video>`
    : `<img id="${id}" class="media" src="${src}" alt="" style="object-fit:${fit}">`;
  const cap = s.props.caption ? `<p class="media-cap">${esc(s.props.caption)}</p>` : "";
  // A slow push-in keeps stills alive; it is a function of time like everything else.
  const plan = [
    {
      id,
      frames: [{ transform: "scale(1)" }, { transform: "scale(1.06)" }],
      at: ctx.at,
      dur: ctx.seconds,
      ease: "linear",
    },
  ];
  return { html: media + cap, plan };
}

const BUILDERS = { title, quote, list, chart, broll };

/**
 * Markup and animations for one scene.
 * ctx: { prefix, at, seconds, lines, lang, first, rise, assets: Map(id -> { file }) } - `at` is the scene's start
 * in the film, `lines` the scene's narration lines with start offsets inside the scene.
 */
export function renderScene(scene, ctx) {
  const build = BUILDERS[scene.kind];
  if (!build)
    throw new Error(`Scene kind "${scene.kind}" is not built yet (have: ${KINDS.join(", ")}).`);
  return build(scene, ctx);
}
