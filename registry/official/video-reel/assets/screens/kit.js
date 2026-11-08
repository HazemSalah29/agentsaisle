// Shared helpers for the motion screens. Plain script: sets window.Kit and window.Screens.
// Every screen is a maker: Screens.name(root, params) -> {frame(t), sfx, end}.
// frame(t) must be a pure function of t: no timers, no state carried between calls.
(function () {
  const K = {};
  K.clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  K.lerp = (a, b, p) => a + (b - a) * p;
  K.prog = (t, t0, d) => (d <= 0 ? (t >= t0 ? 1 : 0) : K.clamp((t - t0) / d));
  K.ease = (x) => 1 - Math.pow(1 - K.clamp(x), 3);
  K.easeIn = (x) => Math.pow(K.clamp(x), 3);
  K.inout = (x) => { x = K.clamp(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
  K.quartOut = (x) => 1 - Math.pow(1 - K.clamp(x), 4);
  // a snap that overshoots a little and settles; reaches ~1 by x = 1
  K.spring = (x) => { x = K.clamp(x); return x >= 1 ? 1 : 1 - Math.exp(-6 * x) * Math.cos(9 * x); };

  // seeded random: K.rng(seed)() -> [0,1); K.hash(a, b, ...) -> [0,1) from numbers
  K.rng = (seed) => { let a = (seed * 2654435761) >>> 0 || 1; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  K.hash = (...n) => { let h = 2166136261; for (const v of n) { h ^= Math.floor(v * 1000) | 0; h = Math.imul(h, 16777619); } return K.rng(h >>> 0)(); };
  // smooth 1D value noise in [-1, 1]
  K.noise = (seed, x) => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return K.lerp(K.hash(seed, i), K.hash(seed, i + 1), u) * 2 - 1; };
  // slow drift for holds: [dx, dy] in px
  K.drift = (t, seed, amp = 6, speed = 0.25) => [K.noise(seed, t * speed) * amp, K.noise(seed + 99, t * speed) * amp];

  const common = { t0: 0, dur: 6, x: 540, y: 860, scale: 1, sound: true, seed: 1 };
  K.params = (p, own = {}) => ({ ...common, ...own, ...(p || {}) });

  // sound list for a screen; types are the ones in references/sound.md
  K.TYPES = ['key', 'tick', 'drop', 'plink', 'tap', 'thud', 'bell', 'bell2', 'bong', 'slide', 'boom', 'rise', 'crack'];
  K.sounds = (p) => { const list = []; return { list, add(t, type, v) { if (!K.TYPES.includes(type)) throw new Error('unknown sound type ' + type); if (p.sound) list.push(v == null ? { t, type } : { t, type, v }); } }; };

  K.el = (tag, opt = {}, parent) => {
    const e = document.createElement(tag);
    if (opt.class) e.className = opt.class;
    if (opt.text != null) e.textContent = opt.text;
    if (opt.style) Object.assign(e.style, opt.style);
    for (const [k, v] of Object.entries(opt.attrs || {})) e.setAttribute(k, v);
    if (parent) parent.append(e);
    return e;
  };
  const NS = 'http://www.w3.org/2000/svg';
  K.svg = (tag, attrs = {}, parent) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); if (parent) parent.append(e); return e; };

  // a full-frame layer, absolutely placed; screens draw inside it
  K.layer = (root, z = 0) => K.el('div', { style: { position: 'absolute', left: '0', top: '0', width: '1080px', height: '1920px', zIndex: String(z), pointerEvents: 'none' } }, root);
  // a stage centred on (p.x, p.y), scaled by p.scale; children use coordinates relative to that centre
  K.stage = (root, p) => K.el('div', { style: { position: 'absolute', left: p.x + 'px', top: p.y + 'px', width: '0', height: '0', transform: `scale(${p.scale})` } }, root);

  // ground: radial lift plus a slow breathing glow in the accent, so a hold is never fully still
  K.ground = (root, o = {}) => {
    const g = K.layer(root, 0);
    g.style.background = 'radial-gradient(ellipse 900px 1250px at 50% 45%, var(--lift) 0%, var(--bg) 55%, var(--deep) 100%)';
    const glow = K.el('div', { style: { position: 'absolute', left: '90px', top: '360px', width: '900px', height: '900px', borderRadius: '50%', background: 'radial-gradient(circle, var(--accent) 0%, transparent 65%)', opacity: '0' } }, g);
    const seed = o.seed || 1, base = o.glow == null ? 0.07 : o.glow;
    return { el: g, frame(t, warm = 0) { glow.style.opacity = String(base * (1 + warm) * (0.8 + 0.2 * Math.sin(t * 1.1 + seed))); } };
  };

  // film grain: six pre-made noise tiles, picked by floor(t * 12), so it is the same at the same t
  K.grain = (root, o = {}) => {
    const c = K.el('canvas', { attrs: { width: '540', height: '960' }, style: { position: 'absolute', left: '0', top: '0', width: '1080px', height: '1920px', zIndex: '50', opacity: String(o.opacity == null ? 0.05 : o.opacity), mixBlendMode: 'overlay', pointerEvents: 'none' } }, root);
    const x = c.getContext('2d'), tiles = [];
    for (let k = 0; k < 6; k++) {
      const r = K.rng(k + 11), img = x.createImageData(540, 960);
      for (let i = 0; i < img.data.length; i += 4) { const v = r() * 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
      tiles.push(img);
    }
    let shown = -1;
    return { el: c, frame(t) { const k = ((Math.floor(t * 12) % 6) + 6) % 6; if (k !== shown) { x.putImageData(tiles[k], 0, 0); shown = k; } } };
  };

  K.vignette = (root) => K.el('div', { style: { position: 'absolute', inset: '0', zIndex: '49', pointerEvents: 'none', background: 'radial-gradient(ellipse 760px 1150px at 50% 47%, transparent 55%, rgba(0,0,0,.42) 100%)' } }, root);

  // the three standard layers in one call: ground, vignette, grain
  K.atmosphere = (root, o = {}) => { const g = K.ground(root, o), v = K.vignette(root), n = K.grain(root, o); return { ground: g, frame(t, warm) { g.frame(t, warm); n.frame(t); } }; };

  // slow camera push for holds
  K.push = (el, t, t0, dur, from = 1, to = 1.035) => { el.style.transform = `scale(${K.lerp(from, to, K.inout(K.prog(t, t0, dur)))})`; };

  // horizontal motion blur for fast moves: const mb = K.motionBlur(el); mb(px)
  let fid = 0;
  K.motionBlur = (el, vertical = false) => {
    let defs = document.getElementById('kit-defs');
    if (!defs) { const s = K.svg('svg', { width: '0', height: '0', style: 'position:absolute' }, document.body); defs = K.svg('defs', { id: 'kit-defs' }, s); }
    const id = 'kit-mb' + fid++, f = K.svg('filter', { id, x: '-20%', y: '-20%', width: '140%', height: '140%' }, defs), b = K.svg('feGaussianBlur', { stdDeviation: '0 0' }, f);
    return (px) => { px = Math.max(0, px); if (px < 0.2) { el.style.filter = ''; return; } b.setAttribute('stdDeviation', vertical ? `0 ${px}` : `${px} 0`); el.style.filter = `url(#${id})`; };
  };

  // fade a block up with a blur clearing, as the starter's up()
  K.up = (el, t, t0, d = 0.7, dist = 22) => { const p = K.ease(K.prog(t, t0, d)); el.style.opacity = String(p); el.style.transform = `translateY(${(1 - p) * dist}px)`; el.style.filter = p < 1 ? `blur(${(1 - p) * 6}px)` : ''; };
  // a line drawn left to right (or right to left) under something: returns el; set width share with K.draw
  K.rule = (parent, o = {}) => K.el('div', { style: { position: 'absolute', height: (o.h || 4) + 'px', background: 'var(--accent)', borderRadius: '2px', transformOrigin: o.rtl ? 'right center' : 'left center', transform: 'scaleX(0)', ...(o.style || {}) } }, parent);
  K.draw = (el, p) => { el.style.transform = `scaleX(${K.clamp(p)})`; };

  // shrink an element's font until it fits a width
  K.fit = (el, maxW, min = 20) => { let s = parseFloat(getComputedStyle(el).fontSize); while (el.scrollWidth > maxW && s > min) { s -= 2; el.style.fontSize = s + 'px'; } return s; };

  window.Kit = K;
  window.Screens = window.Screens || {};
})();
