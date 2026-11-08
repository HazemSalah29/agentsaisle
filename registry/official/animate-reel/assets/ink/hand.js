// hand.js: hand lettering. Each letter gets a little seeded jitter in angle and baseline; reveal 0..1 writes it on.
// Fonts are in ink/fonts (Google Fonts, SIL OFL / Apache 2.0): Permanent Marker for headlines, Patrick Hand and
// Patrick Hand SC for body and labels, Gochi Hand, Kalam, Caveat for variety.
// Needs ink.js. Call Ink.loadFonts(base) before you set window.ready.
(function (g) {
  const Ink = g.Ink, { clamp, hash } = Ink;

  const FONTS = [
    ['Permanent Marker', 'PermanentMarker.woff2', {}], ['Patrick Hand', 'PatrickHand.woff2', {}], ['Patrick Hand SC', 'PatrickHandSC.woff2', {}],
    ['Gochi Hand', 'GochiHand.woff2', {}], ['Kalam', 'Kalam-400.woff2', { weight: '400' }], ['Kalam', 'Kalam-700.woff2', { weight: '700' }],
    ['Caveat', 'Caveat-normal.woff2', { weight: '400 700' }],
  ];
  /** load the bundled fonts; base is the folder holding them, e.g. '../ink/fonts/'. Resolves when all are ready. */
  function loadFonts(base = 'fonts/', only) {
    const list = only ? FONTS.filter((f) => only.includes(f[0])) : FONTS;
    return Promise.all(list.map(async ([fam, file, d]) => { const f = new FontFace(fam, `url(${base}${file})`, d); await f.load(); document.fonts.add(f); }));
  }

  /** draw a string letter by letter with hand-made jitter; reveal 0..1 types it on; pop gives each letter a small overshoot */
  function hand(ctx, str, x, y, o = {}) {
    const { font = 'Patrick Hand', size = 40, color = Ink.pal.ink, align = 'left', reveal = 1, jitter = 1, seed = 9, weight = '400', ls = 0, alpha = 1, pop = 0 } = o;
    ctx.save(); ctx.font = `${weight} ${size}px "${font}"`; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = color; ctx.globalAlpha *= alpha;
    const chars = [...str], ws = chars.map((c) => ctx.measureText(c).width + ls);
    const total = ws.reduce((a, b) => a + b, 0) - ls;
    let cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
    const shown = reveal * chars.length;
    chars.forEach((c, i) => {
      const k = clamp(shown - i);
      if (k > 0 && c !== ' ') {
        const r = (hash(i, seed) - 0.5) * 0.07 * jitter, dy = (hash(i, seed + 1) - 0.5) * size * 0.05 * jitter;
        const s = pop ? 0.6 + 0.4 * Math.min(1, k * 1.0) + (k < 1 ? 0.15 * Math.sin(k * Math.PI) : 0) : 1;
        ctx.save(); ctx.translate(cx + ws[i] / 2, y + dy); ctx.rotate(r); ctx.scale(s, s); ctx.globalAlpha *= pop ? clamp(k * 1.6) : clamp(k * 3);
        ctx.fillText(c, -ws[i] / 2 + ls / 2, 0); ctx.restore();
      }
      cx += ws[i];
    });
    ctx.restore();
    return total;
  }
  function textWidth(ctx, str, font, size, weight = '400') { ctx.save(); ctx.font = `${weight} ${size}px "${font}"`; const w = ctx.measureText(str).width; ctx.restore(); return w; }

  /**
   * A line of handwriting that appears word by word: Ink.handWords(ctx, 'some words here', x, y, {t, t0, per, ...}).
   * t = film time, t0 = when the first word starts, per = seconds between words (0.18 to 0.25 reads human).
   * Wraps at maxW (px) and centres each line when align is 'center'. Same t gives the same pixels.
   * Returns { end (time the last letter lands), lines, bottom (y of the last baseline) }.
   */
  function handWords(ctx, text, x, y, o = {}) {
    const { t = 0, t0 = 0, per = 0.22, size = 72, font = 'Patrick Hand', weight = '400', color = Ink.pal.cream, align = 'left', maxW = 900, lineH = 1.18, seed = 20, alpha = 1, mark = {} } = o;
    const words = text.split(/\s+/).filter(Boolean), sp = textWidth(ctx, ' ', font, size, weight);
    const lines = []; let cur = [], cw = 0;
    words.forEach((w, i) => {
      const ww = textWidth(ctx, w, font, size, weight);
      if (cur.length && cw + sp + ww > maxW) { lines.push({ ws: cur, w: cw }); cur = []; cw = 0; }
      cur.push({ w, i, ww }); cw += (cur.length > 1 ? sp : 0) + ww;
    });
    if (cur.length) lines.push({ ws: cur, w: cw });
    lines.forEach((L, li) => {
      let cx = align === 'center' ? x - L.w / 2 : align === 'right' ? x - L.w : x;
      const ly = y + li * size * lineH;
      for (const wd of L.ws) {
        const rv = clamp((t - (t0 + wd.i * per)) / (per * 1.5));
        // a marked word (mark: {index: color}) takes its own colour, e.g. one accent word
        hand(ctx, wd.w, cx, ly, { font, size, weight, color: mark[wd.i] || color, reveal: rv, seed: seed + wd.i * 5, alpha, jitter: 1 });
        cx += wd.ww + sp;
      }
    });
    return { end: t0 + (words.length - 1) * per + per * 1.5, lines: lines.length, bottom: y + (lines.length - 1) * size * lineH };
  }

  Object.assign(Ink, { FONTS, loadFonts, hand, textWidth, handWords });
})(typeof window !== 'undefined' ? window : globalThis);
