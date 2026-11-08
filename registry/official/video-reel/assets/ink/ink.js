// ink.js: the ink kit core. Every edge is a hand-inked, variable-width ribbon along a noise-displaced path;
// fills sit slightly off the line; the whole drawing "boils" (re-wobbles) at 8 fps.
// Not tied to 1080x740 panels or one palette.
// Plain script: <script src="ink/ink.js"></script> then finish.js, light.js, room3d.js, hand.js, figure.js. Everything lives on window.Ink.
// Pure by design: no Math.random, no Date, no state between frames except the boil index you set with Ink.setBoil(t) at the top of frame(t).
// Every stroke takes its own integer `seed` (hash noise, not a stateful rng), so lines do not wobble in sync. Ink.rng(seed) is there for scene code.
(function (g) {
  const Ink = g.Ink = g.Ink || {};

  // ---------- math ----------
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const inv = (a, b, v) => clamp((v - a) / (b - a));
  const smooth = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };
  const ease = {
    lin: (t) => clamp(t),
    inOut: (t) => { t = clamp(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; },
    out: (t) => 1 - Math.pow(1 - clamp(t), 3),
    in: (t) => Math.pow(clamp(t), 3),
    outBack: (t, s = 1.6) => { t = clamp(t); const c = s + 1; return 1 + c * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2); },
    sine: (t) => 0.5 - 0.5 * Math.cos(Math.PI * clamp(t)),
  };
  function hash(a, b = 0) {
    let h = (Math.imul((a | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((b | 0) + 0x632be5ab, 0xc2b2ae35)) >>> 0;
    h = Math.imul(h ^ (h >>> 16), 0x7feb352d); h = Math.imul(h ^ (h >>> 15), 0x846ca68b); h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  function rng(seed) {
    let a = (seed * 2654435761) >>> 0 || 1;
    return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  /** smooth value noise in [-1, 1] */
  function noise1(x, seed = 0) {
    const i = Math.floor(x), f = x - i;
    return lerp(hash(i, seed), hash(i + 1, seed), f * f * (3 - 2 * f)) * 2 - 1;
  }
  function noise2(x, y, seed = 0) {
    const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j;
    const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    const a = hash(i + j * 7919, seed), b = hash(i + 1 + j * 7919, seed), c = hash(i + (j + 1) * 7919, seed), d = hash(i + 1 + (j + 1) * 7919, seed);
    return lerp(lerp(a, b, u), lerp(c, d, u), v) * 2 - 1;
  }
  /** keyframes: key(t, [[t0, v0], [t1, v1], ...], easeFn) */
  function key(t, frames, fn = ease.inOut) {
    if (t <= frames[0][0]) return frames[0][1];
    for (let i = 1; i < frames.length; i++) {
      if (t <= frames[i][0]) {
        const [a, va] = frames[i - 1], [b, vb] = frames[i];
        const u = fn((t - a) / Math.max(1e-6, b - a));
        return Array.isArray(va) ? va.map((v, j) => lerp(v, vb[j], u)) : lerp(va, vb, u);
      }
    }
    return frames[frames.length - 1][1];
  }

  // ---------- colour ----------
  const cache = new Map();
  function rgb(hex) {
    if (cache.has(hex)) return cache.get(hex);
    const h = hex.replace('#', ''); const v = [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
    cache.set(hex, v); return v;
  }
  function mix(a, b, t) {
    const A = rgb(a), B = rgb(b);
    return '#' + A.map((v, i) => Math.round(lerp(v, B[i], clamp(t))).toString(16).padStart(2, '0')).join('');
  }
  const shade = (hex, k) => (k < 0 ? mix(hex, '#141018', -k) : mix(hex, '#fff6e6', k));
  function rgba(hex, a) { const [r, gg, b] = rgb(hex); return `rgba(${r},${gg},${b},${a})`; }

  // scratch canvases, reused per key
  const pool = new Map();
  function scratch(k, w, h) {
    let c = pool.get(k);
    if (!c) { c = document.createElement('canvas'); pool.set(k, c); }
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    const x = c.getContext('2d');
    x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over'; x.filter = 'none';
    return [c, x];
  }

  // ---------- palette ----------
  // Palette is passed in: Ink.setPalette({...}). Keys you leave out fall back to the lamplit preset.
  const palettes = {
    lamplit: {                // the source style sheet, kept as one named preset
      ink: '#2B2724',        // every line
      glass: '#1F2B52',      // outside the window only
      amber: '#F0B15A',      // light from a visible source only
      mustard: '#C8952F',    // the beanie, if you use one
      moss: '#3E6A4C', concrete: '#B3A996',
      cream: '#EFE6D3', paper: '#E7DCC4', face: '#FFFFFF',
      wall: '#7C8496', wallWarm: '#8E8A86', floor: '#7A5A40', wood: '#80603F', woodDark: '#5E4430',
      rug: '#B9AC93', tile: '#A9B3A8', water: '#7F98A6',
    },
  };
  Ink.palettes = palettes;
  Ink.pal = Object.assign({}, palettes.lamplit);
  Ink.setPalette = (p) => (Ink.pal = Object.assign({}, palettes.lamplit, typeof p === 'string' ? palettes[p] : p));

  // ---------- the boil ----------
  let BOIL = 0, BOIL_AMT = 0.45;
  /** call once at the top of frame(t). The wobble re-seeds from floor(t * fps). amt 0 = still. */
  function setBoil(t, amt = 0.45, fps = 8) { BOIL = Math.floor(t * fps + 1e-6); BOIL_AMT = amt; }

  // ---------- geometry helpers ----------
  function rectPts(x, y, w, h) { return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]]; }
  function ellipsePts(cx, cy, rx, ry, a0 = 0, a1 = Math.PI * 2, n = 0) {
    n = n || Math.max(12, Math.round(Math.abs(a1 - a0) * Math.max(rx, ry) / 6));
    const out = [];
    for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * (i / n); out.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); }
    if (Math.abs(a1 - a0 - Math.PI * 2) < 1e-6) out.pop();
    return out;
  }
  function bez(p0, p1, p2, p3, n = 16) {
    const o = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, u = 1 - t;
      o.push([u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0], u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]]);
    }
    return o;
  }
  function quad(p0, c, p1, n = 12) {
    const o = [];
    for (let i = 0; i <= n; i++) { const t = i / n, u = 1 - t; o.push([u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0], u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1]]); }
    return o;
  }
  /** round the corners of a closed polygon (screen space radius) */
  function roundPts(pts, r, seg = 4) {
    if (r <= 0.5) return pts;
    const out = [], n = pts.length;
    for (let i = 0; i < n; i++) {
      const p = pts[i], a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n];
      const da = Math.hypot(a[0] - p[0], a[1] - p[1]), db = Math.hypot(b[0] - p[0], b[1] - p[1]);
      const rr = Math.min(r, da * 0.45, db * 0.45);
      const pa = [p[0] + (a[0] - p[0]) / da * rr, p[1] + (a[1] - p[1]) / da * rr];
      const pb = [p[0] + (b[0] - p[0]) / db * rr, p[1] + (b[1] - p[1]) / db * rr];
      for (let k = 0; k <= seg; k++) { const t = k / seg, u = 1 - t; out.push([u * u * pa[0] + 2 * u * t * p[0] + t * t * pb[0], u * u * pa[1] + 2 * u * t * p[1] + t * t * pb[1]]); }
    }
    return out;
  }

  // ---------- the wobble ----------
  function resample(pts, closed, step) {
    const P = closed ? [...pts, pts[0]] : pts;
    const out = []; let s = 0;
    if (P.length < 2) return out;
    out.push({ x: P[0][0], y: P[0][1], s: 0 });
    let carry = 0;
    for (let i = 1; i < P.length; i++) {
      const ax = P[i - 1][0], ay = P[i - 1][1], bx = P[i][0], by = P[i][1];
      const L = Math.hypot(bx - ax, by - ay); if (L < 1e-6) continue;
      let d = step - carry;
      while (d <= L) { const t = d / L; s += step; out.push({ x: ax + (bx - ax) * t, y: ay + (by - ay) * t, s }); d += step; }
      carry = L - (d - step);
    }
    const last = P[P.length - 1], lp = out[out.length - 1];
    const tail = Math.hypot(last[0] - lp.x, last[1] - lp.y);
    if (tail > step * 0.35) out.push({ x: last[0], y: last[1], s: s + tail });
    if (closed && out.length > 2) out.pop();
    return out;
  }
  function normals(R, closed) {
    const n = R.length;
    for (let i = 0; i < n; i++) {
      const a = R[closed ? (i - 1 + n) % n : Math.max(0, i - 1)], b = R[closed ? (i + 1) % n : Math.min(n - 1, i + 1)];
      let dx = b.x - a.x, dy = b.y - a.y; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
      R[i].nx = -dy; R[i].ny = dx;
    }
  }
  /** displace a path by low-frequency noise along its normal (periodic for closed shapes) */
  function wobble(pts, { closed = false, amp = 1.2, freq = 0.018, seed = 1, step = 5, boil = 1 } = {}) {
    const R = resample(pts, closed, step); if (R.length < 2) return R;
    normals(R, closed);
    const L = R[R.length - 1].s + step;
    const b = boil * BOIL_AMT;
    for (const p of R) {
      let n;
      if (closed) { const a = (p.s / L) * Math.PI * 2, rad = Math.max(1, L * freq / (Math.PI * 2)); n = noise2(Math.cos(a) * rad + seed * 3.7, Math.sin(a) * rad, seed) * amp + noise2(Math.cos(a) * rad * 2.1, Math.sin(a) * rad * 2.1 + BOIL * 5.3, seed + 11) * b; }
      else n = noise1(p.s * freq + seed * 7.31, seed) * amp + noise1(p.s * freq * 2.1 + BOIL * 5.3, seed + 11) * b;
      p.x += p.nx * n; p.y += p.ny * n;
    }
    return R;
  }

  // ---------- strokes ----------
  /** one inked line: variable width ribbon, tapered ends, optional reveal (0..1) for write-on */
  function stroke(ctx, pts, o = {}) {
    const { w = 2.4, closed = false, color = Ink.pal.ink, alpha = 1, amp = 1.0, seed = 1, reveal = 1, taper = 0.55, press = 0.35, step = 4, freq = 0.018, boil = 1 } = o;
    if (reveal <= 0 || pts.length < 2) return;
    const R = wobble(pts, { closed, amp, seed, step, freq, boil });
    let n = R.length; if (n < 2) return;
    const isClosed = closed && reveal >= 1;
    if (!isClosed) { n = Math.max(2, Math.round(n * clamp(reveal))); normals(R, false); }
    const left = [], right = [];
    for (let i = 0; i < n; i++) {
      const p = R[i], u = n > 1 ? i / (n - 1) : 0;
      let ww = w * (1 + press * noise1(p.s * 0.035 + seed * 1.7, seed + 3));
      if (!isClosed) { const e = Math.min(u, 1 - u) / 0.14; ww *= taper + (1 - taper) * clamp(e) * clamp(e) * (3 - 2 * clamp(e)); }
      const h = Math.max(0.35, ww * 0.5);
      left.push([p.x + p.nx * h, p.y + p.ny * h]); right.push([p.x - p.nx * h, p.y - p.ny * h]);
    }
    ctx.save();
    ctx.globalAlpha *= alpha; ctx.fillStyle = color;
    ctx.beginPath();
    if (isClosed) {
      ctx.moveTo(left[0][0], left[0][1]); for (let i = 1; i < n; i++) ctx.lineTo(left[i][0], left[i][1]); ctx.closePath();
      ctx.moveTo(right[n - 1][0], right[n - 1][1]); for (let i = n - 2; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]); ctx.closePath();
    } else {
      ctx.moveTo(left[0][0], left[0][1]); for (let i = 1; i < n; i++) ctx.lineTo(left[i][0], left[i][1]);
      for (let i = n - 1; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]); ctx.closePath();
    }
    ctx.fill('nonzero');
    ctx.restore();
  }
  function line(ctx, a, b, o = {}) { stroke(ctx, [a, b], { step: 4, ...o }); }

  /** fill a closed shape with a softly wobbled edge */
  function fill(ctx, pts, color, o = {}) {
    const { amp = 0.8, seed = 2, alpha = 1, dx = 0, dy = 0 } = o;
    if (pts.length < 3) return;
    const R = wobble(pts, { closed: true, amp, seed: seed + 50, step: 6, boil: 0.6 });
    ctx.save(); ctx.globalAlpha *= alpha; ctx.fillStyle = color; ctx.beginPath();
    R.forEach((p, i) => (i ? ctx.lineTo(p.x + dx, p.y + dy) : ctx.moveTo(p.x + dx, p.y + dy)));
    ctx.closePath(); ctx.fill(); ctx.restore();
  }
  function pathOf(ctx, pts) { ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); }

  /** fill + ink outline (the workhorse). w = line weight in px. */
  function shape(ctx, pts, o = {}) {
    const { fill: f, w = 2.4, seed = 1, amp = 1.0, ink = true, round = 0, alpha = 1, inkColor = Ink.pal.ink, inkAlpha = 1, reveal = 1 } = o;
    const P = round ? roundPts(pts, round) : pts;
    if (f) fill(ctx, P, f, { seed, alpha, amp: amp * 0.7, dx: 0.6, dy: -0.4 });
    if (ink && w > 0) stroke(ctx, P, { closed: true, w, seed, amp, color: inkColor, alpha: alpha * inkAlpha, taper: 1, reveal });
  }

  /** cross-hatching clipped to a polygon (shadows) */
  function hatch(ctx, pts, o = {}) {
    const { angle = -0.9, gap = 7, w = 1.1, alpha = 0.45, seed = 5, color = Ink.pal.ink, cross = false } = o;
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    ctx.save(); pathOf(ctx, pts); ctx.clip();
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, R = Math.hypot(x1 - x0, y1 - y0) / 2 + gap;
    const angs = cross ? [angle, angle + 1.35] : [angle];
    angs.forEach((ang, ai) => {
      const ux = Math.cos(ang), uy = Math.sin(ang), vx = -uy, vy = ux;
      let k = 0;
      for (let d = -R; d <= R; d += gap) {
        const j = (hash(k++, seed + ai) - 0.5) * gap * 0.5;
        const px = cx + vx * (d + j), py = cy + vy * (d + j);
        stroke(ctx, [[px - ux * R, py - uy * R], [px + ux * R, py + uy * R]], { w, alpha, seed: seed + k, amp: 0.9, color, taper: 0.3, step: 6 });
      }
    });
    ctx.restore();
  }

  /** soft radial light blob (a light pool, not a blur) */
  function glow(ctx, x, y, r, color, a = 1, op = 'lighter') {
    if (r <= 0 || a <= 0) return;
    ctx.save(); ctx.globalCompositeOperation = op;
    const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, rgba(color, a)); gr.addColorStop(0.35, rgba(color, a * 0.45)); gr.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = gr; ctx.fillRect(x - r, y - r, r * 2, r * 2); ctx.restore();
  }

  Object.assign(Ink, {
    clamp, lerp, inv, smooth, ease, hash, rng, noise1, noise2, key, rgb, mix, shade, rgba, scratch,
    setBoil, rectPts, ellipsePts, bez, quad, roundPts, wobble, stroke, line, fill, pathOf, shape, hatch, glow,
  });
})(typeof window !== 'undefined' ? window : globalThis);
