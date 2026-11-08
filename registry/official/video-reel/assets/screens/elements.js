// Elements: forces a line can name, acted out on screen. Lightning with a flash, fire, water, fog,
// cracks, glitch, light rays. Use one only when the script names that force (references/screens.md).
// Each maker: Elements.name(root, params) -> {frame(t), sfx, end}; glitch takes an element, not a root.
// Colours come from the palette tokens unless a `color` param is passed (fire and water usually want one).
(function () {
  const K = window.Kit;
  const tok = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const rgb = (s) => {
    s = (s || '').trim(); if (s.startsWith('var(')) s = tok(s.slice(4, -1));
    if (s[0] === '#') { let h = s.slice(1); if (h.length === 3) h = h.replace(/./g, '$&$&'); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
    const m = s.match(/[\d.]+/g) || [255, 255, 255]; return [+m[0], +m[1], +m[2]];
  };
  const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
  const canvas = (lay) => { const c = K.el('canvas', { attrs: { width: '1080', height: '1920' }, style: { position: 'absolute', left: '0', top: '0', width: '1080px', height: '1920px' } }, lay); return [c, c.getContext('2d')]; };
  // on/off envelope for a timed element: fades in over `fin`, out over `fout`
  const life = (t, t0, dur, fin, fout) => Math.min(K.ease(K.prog(t, t0, fin)), 1 - K.easeIn(K.prog(t, t0 + dur - fout, fout)));
  const E = {};

  // a full-frame flash: snaps up in 2 frames, decays fast
  E.flash = (root, params) => {
    const p = K.params(params, { dur: 0.45, peak: 0.85, color: '#ffffff', z: 40 });
    const f = K.el('div', { style: { position: 'absolute', inset: '0', background: p.color, opacity: '0', zIndex: String(p.z), pointerEvents: 'none', mixBlendMode: 'screen' } }, root);
    const frame = (t) => { const a = t < p.t0 ? 0 : K.prog(t, p.t0, 0.06) * Math.exp(-(t - p.t0) / (p.dur / 4)); f.style.opacity = String(t > p.t0 + p.dur ? 0 : p.peak * a); };
    return { frame, sfx: [], end: p.t0 + p.dur };
  };

  // lightning: a jagged bolt with branches draws in 0.08 s, flickers, fades; a flash and a crack with a boom
  E.lightning = (root, params) => {
    const p = K.params(params, { dur: 0.9, x0: 700, y0: -40, x1: 540, y1: 900, branches: 3, color: '#f4f1ff', glow: 'var(--accent-hi)', width: 5, flash: true, rise: false });
    const snd = K.sounds(p), lay = K.layer(root, 30), [cv, ctx] = canvas(lay), r = K.rng(p.seed * 31 + 7);
    const bolt = (ax, ay, bx, by, rough, depth) => { // midpoint displacement
      let pts = [[ax, ay], [bx, by]];
      for (let d = 0; d < depth; d++) { const n = []; for (let i = 0; i < pts.length - 1; i++) { const [x0, y0] = pts[i], [x1, y1] = pts[i + 1]; const len = Math.hypot(x1 - x0, y1 - y0); n.push(pts[i], [(x0 + x1) / 2 + (r() - 0.5) * len * rough, (y0 + y1) / 2 + (r() - 0.5) * len * rough * 0.3]); } n.push(pts[pts.length - 1]); pts = n; }
      return pts;
    };
    const main = bolt(p.x0, p.y0, p.x1, p.y1, 0.55, 7), arms = [];
    for (let b = 0; b < p.branches; b++) { const i = Math.floor(main.length * (0.25 + r() * 0.5)), [sx, sy] = main[i], a = (r() < 0.5 ? -1 : 1) * (0.4 + r() * 0.7), L = 140 + r() * 260; arms.push({ at: i / main.length, pts: bolt(sx, sy, sx + Math.sin(a) * L, sy + Math.cos(a) * L * 0.8, 0.6, 5) }); }
    const C = rgb(p.color), G = rgb(p.glow), fl = p.flash ? E.flash(root, { t0: p.t0, dur: 0.5, peak: 0.7 }) : null;
    snd.add(p.t0, 'crack', 0.8); snd.add(p.t0 + 0.02, 'boom', 0.7); if (p.rise) snd.add(p.t0, 'rise', 0.25);
    const path = (pts, share) => { const n = Math.max(2, Math.ceil(pts.length * share)); ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < n; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.stroke(); };
    const frame = (t) => {
      if (fl) fl.frame(t);
      ctx.clearRect(0, 0, 1080, 1920);
      if (t < p.t0 || t > p.t0 + p.dur) return;
      const k = t - p.t0, grow = K.prog(k, 0, 0.08), flick = k < 0.25 ? (Math.floor(k * 30) % 3 === 1 ? 0.35 : 1) : 1, a = flick * Math.exp(-Math.max(0, k - 0.12) / (p.dur / 3.5));
      ctx.lineCap = ctx.lineJoin = 'round';
      for (const [w, blur, col, al] of [[p.width * 4, 40, G, 0.35], [p.width * 1.6, 14, G, 0.8], [p.width, 0, C, 1]]) {
        ctx.shadowBlur = blur; ctx.shadowColor = rgba(G, 1); ctx.strokeStyle = rgba(col, al * a); ctx.lineWidth = w;
        path(main, grow); ctx.lineWidth = w * 0.55; arms.forEach((b) => { if (grow > b.at) path(b.pts, K.prog(grow, b.at, 1 - b.at)); });
      }
    };
    return { frame, sfx: snd.list, end: p.t0 + p.dur };
  };

  // fire: glowing embers rise from a base line, hot at the root, fading as they climb
  E.fire = (root, params) => {
    const p = K.params(params, { dur: 4, x: 540, y: 1300, width: 760, height: 560, count: 1600, color: '#e2541f', colorHi: '#ffd27a', fin: 0.6, fout: 0.6 });
    const lay = K.layer(root, 6), [cv, ctx] = canvas(lay), r = K.rng(p.seed * 17 + 1), N = p.count;
    const ox = new Float32Array(N), sp = new Float32Array(N), ph = new Float32Array(N), hh = new Float32Array(N), sz = new Float32Array(N), wv = new Float32Array(N);
    for (let i = 0; i < N; i++) { const u = r() + r() - 1; ox[i] = u * p.width / 2; sp[i] = 0.6 + r() * 0.9; ph[i] = r(); hh[i] = (0.3 + r() * 0.7) * p.height * (1 - Math.abs(u) * 0.75); sz[i] = 16 + r() * 34; wv[i] = r() * 6.28; }
    const lo = rgb(p.color), hi = rgb(p.colorHi), spr = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,.35)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return c; })();
    const tint = (c) => { const o = document.createElement('canvas'); o.width = o.height = 64; const x = o.getContext('2d'); x.drawImage(spr, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = rgba(c, 1); x.fillRect(0, 0, 64, 64); return o; };
    const SH = tint(hi), SL = tint(lo);
    const frame = (t) => {
      ctx.clearRect(0, 0, 1080, 1920);
      const on = life(t, p.t0, p.dur, p.fin, p.fout); if (on <= 0) return;
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < N; i++) {
        const q = (t * sp[i] * 0.9 + ph[i]) % 1, y = p.y - q * hh[i], x = p.x + ox[i] * (1 - q * 0.8) + Math.sin(t * 3 + wv[i] + q * 5) * 14 * q, s = sz[i] * (1 - q * 0.65);
        ctx.globalAlpha = on * 0.42 * Math.pow(1 - q, 0.7) * Math.min(1, q * 8); ctx.drawImage(q < 0.35 ? SH : SL, x - s, y - s, s * 2, s * 2);
      }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    };
    return { frame, sfx: [], end: p.t0 + p.dur };
  };

  // water: stacked wave lines that draw on left to right and keep rolling
  E.water = (root, params) => {
    const p = K.params(params, { dur: 4, x: 540, y: 1100, width: 760, lines: 9, gap: 26, amp: 10, wave: 120, color: '#5fb3d9', fin: 0.8, fout: 0.6, stroke: 2.5 });
    const snd = K.sounds(p), lay = K.layer(root, 6), sv = K.svg('svg', { width: 1080, height: 1920, viewBox: '0 0 1080 1920', style: 'position:absolute;left:0;top:0;overflow:visible' }, lay);
    const c = p.color, paths = [];
    for (let i = 0; i < p.lines; i++) paths.push(K.svg('path', { fill: 'none', stroke: c, 'stroke-width': p.stroke, 'stroke-linecap': 'round', opacity: 0.35 + 0.65 * (1 - i / p.lines), style: `filter:drop-shadow(0 0 6px ${c})` }, sv));
    snd.add(p.t0, 'slide', 0.15);
    const frame = (t) => {
      const on = life(t, p.t0, p.dur, p.fin, p.fout), draw = K.ease(K.prog(t, p.t0, p.fin * 1.4));
      sv.style.opacity = String(on);
      paths.forEach((el, i) => {
        const y0 = p.y + (i - (p.lines - 1) / 2) * p.gap, x0 = p.x - p.width / 2, n = 60, end = Math.max(1, Math.round(n * draw)); let d = '';
        for (let k = 0; k <= end; k++) { const x = x0 + (p.width * k) / n; d += (k ? 'L' : 'M') + x.toFixed(1) + ' ' + (y0 + Math.sin((x / p.wave) * 6.283 - t * 2.2 + i * 0.7) * p.amp * (0.6 + 0.4 * Math.sin(i + t))).toFixed(1); }
        el.setAttribute('d', d);
      });
    };
    return { frame, sfx: snd.list, end: p.t0 + p.dur };
  };

  // fog: soft banks drift sideways; at clearAt (share of dur) they lift and thin out
  E.fog = (root, params) => {
    const p = K.params(params, { dur: 5, y: 900, height: 900, banks: 14, opacity: 0.55, clearAt: 0.6, color: 'var(--ink)', fin: 0.8 });
    const lay = K.layer(root, 20), [cv, ctx] = canvas(lay), r = K.rng(p.seed * 41 + 9), C = rgb(p.color), B = [];
    for (let i = 0; i < p.banks; i++) B.push({ x: r() * 1300 - 110, y: p.y + (r() - 0.5) * p.height, rx: 260 + r() * 340, ry: 90 + r() * 120, v: (r() - 0.5) * 30, a: 0.25 + r() * 0.45 });
    const frame = (t) => {
      ctx.clearRect(0, 0, 1080, 1920);
      const tc = p.t0 + p.dur * p.clearAt, clear = K.inout(K.prog(t, tc, p.dur * (1 - p.clearAt))), on = K.ease(K.prog(t, p.t0, p.fin)) * (1 - clear);
      if (t < p.t0 || on <= 0.001) return;
      for (const b of B) {
        const x = b.x + b.v * (t - p.t0) + (b.x > 540 ? 1 : -1) * clear * 260, y = b.y - clear * 180;
        ctx.save(); ctx.translate(x, y); ctx.scale(1, b.ry / b.rx);
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, b.rx); g.addColorStop(0, rgba(C, p.opacity * b.a * on)); g.addColorStop(1, rgba(C, 0));
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, b.rx, 0, 6.283); ctx.fill(); ctx.restore();
      }
    };
    return { frame, sfx: [], end: p.t0 + p.dur };
  };

  // cracks: glowing veins grow from the frame edges toward a target ring and light where they hit
  E.cracks = (root, params) => {
    const p = K.params(params, { dur: 2.4, x: 540, y: 960, ring: 220, count: 12, color: '#e0452e', reach: 1, grow: 1.6 });
    const snd = K.sounds(p), lay = K.layer(root, 8), [cv, ctx] = canvas(lay), r = K.rng(p.seed * 23 + 4), C = rgb(p.color), V = [];
    for (let i = 0; i < p.count; i++) {
      const a = (i / p.count) * 6.283 + (r() - 0.5) * 0.4, R0 = 760 + r() * 200, R1 = p.ring + (1 - p.reach) * 300, pts = [];
      for (let k = 0; k <= 24; k++) { const q = k / 24, rad = K.lerp(R0, R1, q), wob = (r() - 0.5) * 0.12 * (1 - q); pts.push([p.x + Math.cos(a + wob) * rad, p.y + Math.sin(a + wob) * rad]); }
      const at = p.t0 + r() * 0.5; V.push({ pts, at, side: k0(pts, r) }); snd.add(at + p.grow, 'tap', 0.12);
    }
    function k0(pts, rr) { const i = 6 + Math.floor(rr() * 10), [x, y] = pts[i], a = rr() * 6.283, L = 40 + rr() * 80; return { from: i / 24, pts: [[x, y], [x + Math.cos(a) * L, y + Math.sin(a) * L]] }; }
    const frame = (t) => {
      ctx.clearRect(0, 0, 1080, 1920);
      const fade = 1 - K.easeIn(K.prog(t, p.t0 + p.dur - 0.5, 0.5)); if (t < p.t0 || fade <= 0) return;
      ctx.lineCap = ctx.lineJoin = 'round'; ctx.shadowColor = rgba(C, 1);
      for (const v of V) {
        const g = K.ease(K.prog(t, v.at, p.grow)); if (g <= 0) continue;
        const n = Math.max(2, Math.ceil(v.pts.length * g));
        for (const [w, blur, al] of [[6, 16, 0.4], [2.2, 4, 1]]) {
          ctx.shadowBlur = blur; ctx.strokeStyle = rgba(C, al * fade); ctx.lineWidth = w;
          ctx.beginPath(); ctx.moveTo(...v.pts[0]); for (let i = 1; i < n; i++) ctx.lineTo(...v.pts[i]); ctx.stroke();
          if (g > v.side.from) { const s = v.side.pts, q = K.prog(g, v.side.from, 0.3); ctx.lineWidth = w * 0.6; ctx.beginPath(); ctx.moveTo(...s[0]); ctx.lineTo(K.lerp(s[0][0], s[1][0], q), K.lerp(s[0][1], s[1][1], q)); ctx.stroke(); }
        }
        if (g >= 1) { const hit = Math.exp(-(t - v.at - p.grow) * 3), [hx, hy] = v.pts[v.pts.length - 1]; ctx.shadowBlur = 24; ctx.fillStyle = rgba(C, (0.5 + 0.5 * hit) * fade); ctx.beginPath(); ctx.arc(hx, hy, 6 + 6 * hit, 0, 6.283); ctx.fill(); }
      }
      ctx.shadowBlur = 0;
    };
    return { frame, sfx: snd.list, end: p.t0 + p.dur };
  };

  // glitch: an existing element jitters, splits red and cyan, and slices for `dur`, then settles
  E.glitch = (el, params) => {
    const p = K.params(params, { dur: 0.7, strength: 1, fps: 20 });
    const snd = K.sounds(p); for (let k = 0; k < 4; k++) snd.add(p.t0 + k * p.dur / 4, 'tick', 0.18);
    const base = el.style.transform || '';
    const frame = (t) => {
      if (t < p.t0 || t > p.t0 + p.dur) { el.style.filter = ''; el.style.transform = base; el.style.clipPath = ''; return; }
      const f = Math.floor((t - p.t0) * p.fps), h = (n) => K.hash(p.seed, f, n) - 0.5, s = p.strength * (1 - K.prog(t, p.t0, p.dur) * 0.6);
      const dx = h(1) * 26 * s, sp = (4 + Math.abs(h(2)) * 10) * s, y0 = Math.abs(h(3)) * 80, y1 = y0 + 8 + Math.abs(h(4)) * 30;
      el.style.transform = `${base} translate(${dx.toFixed(1)}px, ${(h(5) * 6 * s).toFixed(1)}px)`;
      el.style.filter = `drop-shadow(${sp.toFixed(1)}px 0 rgba(255,40,80,.85)) drop-shadow(${(-sp).toFixed(1)}px 0 rgba(40,220,255,.85))`;
      el.style.clipPath = K.hash(p.seed, f, 6) < 0.5 ? `polygon(0 0,100% 0,100% ${y0}%,0 ${y0}%,0 ${y1}%,100% ${y1}%,100% 100%,0 100%)` : '';
    };
    return { frame, sfx: snd.list, end: p.t0 + p.dur };
  };

  // light rays: soft beams fan down from a point above the frame and sway slowly
  E.rays = (root, params) => {
    const p = K.params(params, { dur: 6, x: 540, y: -160, count: 7, spread: 56, length: 2000, color: 'var(--accent-hi)', opacity: 0.12, fin: 1.2, fout: 1 });
    const lay = K.layer(root, 1), [cv, ctx] = canvas(lay), r = K.rng(p.seed * 53 + 2), C = rgb(p.color), R = [];
    for (let i = 0; i < p.count; i++) R.push({ a: ((i / Math.max(1, p.count - 1)) - 0.5) * p.spread * Math.PI / 180, w: 40 + r() * 70, ph: r() * 6.28, al: 0.5 + r() * 0.5 });
    const frame = (t) => {
      ctx.clearRect(0, 0, 1080, 1920);
      const on = life(t, p.t0, p.dur, p.fin, p.fout); if (on <= 0) return;
      ctx.globalCompositeOperation = 'lighter';
      for (const b of R) {
        const a = b.a + Math.sin(t * 0.25 + b.ph) * 0.03, br = b.al * (0.75 + 0.25 * Math.sin(t * 0.6 + b.ph * 2));
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(-a);
        const g = ctx.createLinearGradient(0, 0, 0, p.length); g.addColorStop(0, rgba(C, p.opacity * br * on)); g.addColorStop(1, rgba(C, 0));
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-b.w * 0.15, 0); ctx.lineTo(b.w * 0.15, 0); ctx.lineTo(b.w * 1.6, p.length); ctx.lineTo(-b.w * 1.6, p.length); ctx.closePath(); ctx.fill(); ctx.restore();
      }
      ctx.globalCompositeOperation = 'source-over';
    };
    return { frame, sfx: [], end: p.t0 + p.dur };
  };

  window.Elements = E;
})();
