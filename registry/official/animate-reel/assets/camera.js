// camera.js: one camera for a reel, as a pure function of time (no timers, no state between frames).
// Needs motion.js loaded first (springs). Load: <script src="motion.js"></script><script src="camera.js"></script>
// Canvas 1080x1920. Camera state = {x, y, z, rot}: the world point at screen centre, zoom, degrees. Home = {540, 960, 1, 0}.
//
// Usage:
//   const rig = Camera.rig([
//     {el: document.getElementById('far'),   depth: .5},   // <1 farther: moves and zooms less
//     {el: document.getElementById('world'), depth: 1},    // the world plane: exactly translate(540 960) scale(z) translate(-x -y)
//     {el: document.getElementById('near'),  depth: 1.3},  // >1 nearer: moves more (the old nearCam)
//   ]);                                // layer el = an SVG <g> (transform attribute) or a 1080x1920 HTML box (CSS transform)
//   rig.push(1.0, .9, 1.12);           // push(t0, dur, toZ)   zoom in to 1.12 (default: 12% more than now)
//   rig.pan(2.5, .8, 840, 960);        // pan(t0, dur, toX, toY)
//   rig.whip(240, 4.0, .5);            // whip(toX, t0, dur)   1300 px style pan; draws horizontal blur only while moving
//   rig.crane(5.0, 1.0, 600);          // crane(t0, dur, toY)  vertical move; vertical blur only while moving
//   rig.shake(6.5, .5, 14, 3);         // shake(t0, dur, amp px, seed)  one impact onset, decays, seeded
//   rig.orbit(7, 1.2, 90, 40);         // orbit(t0, dur, radius px, degrees)  small 2D arc with a slight roll
//   rig.pull(8, .8, 1);                // pull(t0, dur, toZ)   zoom out
//   rig.drift();                       // slow breathing 1.00 to 1.06 (default period 14 s); rig.drift({period:10, amount:.04})
//   rig.creep(3.2, 6.0);               // creep(t0, t1, {rate, edge, back})  still shot pushes in .14 %/frame (3 s = +13 %), soft 8-frame edges;
//                                      //   the zoom it gained stays after t1 (end it on a scene change), or {back: .8} eases it back to 1 in .8 s
//   rig.punch(4.1);                    // punch(t0, {rate:.006, frames:35, back})  hard push on a punch word, about +22 %
//   rig.kick(6.5);                     // kick(t0, amp px = 4.5)  impact hit: jumps side to side every frame, gone in 7 frames, with a small roll
//   Camera.rig(layers, {ease: 'smooth'}) // smootherstep instead of cubic in-out for every eased move (top speed 1.9x the average, not 3x: no rush in the middle)
// Numbers from a measured study of 20 viral shorts: quiet frames push in
//   at a median .14 %/frame, punch words .6 %/frame for ~35 frames, glides peak at about 37 px/frame at 1080 (else cut), no hand-held float.
//   function frame(t){ rig.frame(t); /* ...rest of the page... */ }
//   const s = rig.state(t);            // {x, y, z, rot} at time t, shake and drift included, for placing captions
// Moves are relative to where the earlier moves end, so add them in time order; they may overlap (they add).
// Absolute keyframes instead: rig.keys([[0,{z:1}],[1.5,{z:1.1}],[3,{x:700,y:900}]])  eased from the previous key to this one
//   (channels left out hold). With a spring (everything, or per call): Camera.rig(layers,{spring:.8}) or rig.keys(keys,{spring:.8,f:2});
//   there each key time is when the spring starts (same as Motion.track). Whip and crane stay eased, never bounce.
// Layer maths: offset = (camera offset from home) * depth, zoom = 1 + (z-1)*depth. Depth means layers, never blur:
//   there is no depth-of-field here. Keep near things at the frame edges, out of the caption band y 1350 to 1550
//   (the rig warns once in the console if a child of a near layer sits there at rest; pass {guard:false} to silence).
// Blur: one hidden SVG filter per rig is switched on a layer only while a whip or crane moves (else the attribute is removed).
(function (g) {
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const inout = x => { x = clamp(x); return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
  const smoother = x => { x = clamp(x); return x * x * x * (x * (6 * x - 15) + 10); };
  // rate that ramps 0 -> 1 over e s from a, holds, and ramps 1 -> 0 over e s from b: its area up to t, in seconds at full rate
  const ramp = (x, e) => x <= 0 ? 0 : x < e ? x * x / (2 * e) : x - e / 2;
  const trap = (t, a, b, e) => ramp(t - a, e) - ramp(t - b, e);
  const HOME = { x: 540, y: 960, z: 1, rot: 0 };
  const CH = ['x', 'y', 'z', 'rot'];
  let rigCount = 0;

  function rng(seed) { // mulberry32
    let a = (seed | 0) + 0x6D2B79F5;
    return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  function rig(layers, opts = {}) {
    if (!g.Motion) throw new Error('camera.js needs motion.js loaded first');
    const segs = [], shakes = [], blurs = [], creeps = [], kicks = [];
    const ease = opts.ease === 'smooth' ? smoother : inout;
    const settled = { ...HOME, ...(opts.home || {}) };
    const home = { ...settled };
    let drift = null;
    const id = 'camblur' + (rigCount++);
    let blurNode = null;

    // ---- blur filter (SVG filter works on SVG groups and on HTML via CSS filter:url()) ----
    function ensureFilter() {
      if (blurNode || typeof document === 'undefined') return blurNode;
      const ns = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(ns, 'svg');
      svg.setAttribute('width', '0'); svg.setAttribute('height', '0');
      svg.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none';
      svg.innerHTML = `<defs><filter id="${id}" x="-30%" y="-30%" width="160%" height="160%" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="0 0"/></filter></defs>`;
      (document.body || document.documentElement).appendChild(svg);
      blurNode = svg.querySelector('feGaussianBlur');
      return blurNode;
    }

    // ---- building moves: each segment adds delta * progress(t); settled tracks where all moves end ----
    function add(seg) {
      seg.spring = seg.noSpring ? null : (seg.spring !== undefined ? seg.spring : (opts.spring || null));
      seg.f = seg.f || opts.f || 2;
      segs.push(seg);
      const fin = seg.path ? seg.path(1) : seg;
      for (const c of CH) settled[c] += (seg.path ? (fin[c] || 0) : (seg['d' + c] || 0));
      return api;
    }
    function to(t0, dur, target, extra = {}) { // move to absolute target channels
      const seg = { t0, dur, ...extra };
      for (const c of CH) if (target[c] !== undefined) seg['d' + c] = target[c] - settled[c];
      return add(seg);
    }
    function prog(s, t) {
      if (s.spring) return g.Motion.spring(t - s.t0, s.spring, s.f);
      return ease((t - s.t0) / Math.max(1e-6, s.dur));
    }

    function state(t) {
      const s = { ...home };
      for (const sg of segs) {
        const p = prog(sg, t);
        if (!p) continue;
        if (sg.path) { const d = sg.path(p); for (const c of CH) s[c] += d[c] || 0; }
        else for (const c of CH) if (sg['d' + c]) s[c] += sg['d' + c] * p;
      }
      for (const c of creeps) { // zoom factor exp(rate per s * time at rate), eased back to 1 after `back` when set
        const k = Math.exp(c.rate * trap(t, c.t0, c.t1, c.edge));
        s.z *= c.back ? 1 + (k - 1) * (1 - smoother((t - c.t1 - c.edge) / c.back)) : k;
      }
      for (const kc of kicks) { // frame-locked: the sign flips every frame, (1 - n/7)^1.5
        const n = Math.floor((t - kc.t0) * kc.fps + 1e-6);
        if (n < 0 || n >= 7) continue;
        const v = kc.amp * Math.pow(1 - n / 7, 1.5) * (n % 2 ? -1 : 1);
        s.x += v; s.y -= v * .5; s.rot += v * .05;
      }
      if (drift) s.z *= 1 + drift.amount * .5 * (1 - Math.cos(2 * Math.PI * (t - drift.t0) / drift.period)) * (t >= drift.t0 ? 1 : 0);
      for (const sh of shakes) {
        const u = (t - sh.t0) / sh.dur;
        if (u < 0 || u >= 1) continue;
        const env = Math.pow(1 - u, 2.2);
        s.x += sh.amp * env * sh.n(t, 0); s.y += sh.amp * env * sh.n(t, 1); s.rot += sh.amp * .02 * env * sh.n(t, 2);
      }
      return s;
    }

    function blur(t) { // {bx, by} in px, 0 at rest
      let bx = 0, by = 0;
      for (const b of blurs) {
        const u = (t - b.t0) / b.dur;
        if (u <= 0 || u >= 1) continue;
        const k = Math.sin(Math.PI * u);
        bx += b.bx * k; by += b.by * k;
      }
      return { bx, by };
    }

    let guarded = !(opts.guard === false);
    function guard() { // cheap: warn once if a child of a near layer has its centre in the caption band at rest
      guarded = false;
      layers.forEach(L => {
        if (!(L.depth > 1) || !L.el.children) return;
        for (const ch of L.el.children) {
          const r = ch.getBoundingClientRect();
          const cy = r.top + r.height / 2;
          if (r.height > 0 && cy > 1350 && cy < 1550 && r.height < 900)
            console.warn('camera.js: near layer child sits in the caption band y 1350-1550 at rest', ch);
        }
      });
    }

    function frame(t) {
      const s = state(t), bl = blur(t);
      const moving = bl.bx > .5 || bl.by > .5;
      if (moving) ensureFilter();
      if (blurNode && moving) blurNode.setAttribute('stdDeviation', `${bl.bx.toFixed(2)} ${bl.by.toFixed(2)}`);
      layers.forEach(L => {
        const d = L.depth === undefined ? 1 : L.depth;
        const cx = HOME.x + (s.x - HOME.x) * d, cy = HOME.y + (s.y - HOME.y) * d;
        const zl = Math.max(.05, 1 + (s.z - 1) * d);
        const el = L.el, isSvg = typeof SVGElement !== 'undefined' && el instanceof SVGElement;
        if (isSvg) {
          el.setAttribute('transform', `translate(540 960) rotate(${s.rot.toFixed(4)}) scale(${zl.toFixed(5)}) translate(${(-cx).toFixed(2)} ${(-cy).toFixed(2)})`);
          if (moving) el.setAttribute('filter', `url(#${id})`); else el.removeAttribute('filter');
        } else {
          el.style.transformOrigin = '0 0';
          el.style.transform = `translate(540px,960px) rotate(${s.rot.toFixed(4)}deg) scale(${zl.toFixed(5)}) translate(${(-cx).toFixed(2)}px,${(-cy).toFixed(2)}px)`;
          el.style.filter = moving ? `url(#${id})` : '';
        }
      });
      if (guarded && !moving) guard();
    }

    // ---- the move helpers ----
    const api = {
      frame, state, blur,
      // keys: [[t, {x,y,z,rot}], ...]; opts {spring: zeta, f}
      keys(list, o = {}) {
        let prev = 0;
        const sp = o.spring !== undefined ? o.spring : opts.spring;
        for (const [t, v] of list) {
          const seg = { t0: sp ? t : prev, dur: Math.max(1e-6, t - prev), spring: sp || null, f: o.f };
          for (const c of CH) if (v[c] !== undefined) seg['d' + c] = v[c] - settled[c];
          add(seg);
          prev = t;
        }
        return api;
      },
      push(t0, dur = .9, toZ) { return to(t0, dur, { z: toZ === undefined ? settled.z * 1.12 : toZ }); },
      pull(t0, dur = .9, toZ) { return to(t0, dur, { z: toZ === undefined ? settled.z / 1.12 : toZ }); },
      pan(t0, dur, toX, toY) { return to(t0, dur, { x: toX === undefined ? settled.x : toX, y: toY === undefined ? settled.y : toY }); },
      crane(t0, dur, toY, o = {}) {
        if (o.blur !== false) blurs.push({ t0, dur, bx: 0, by: o.amount || 30 });
        return to(t0, dur, { y: toY }, { noSpring: true });
      },
      whip(toX, t0, dur = .5, o = {}) {
        if (o.blur !== false) blurs.push({ t0, dur, bx: o.amount || 45, by: 0 });
        return to(t0, dur, { x: toX }, { noSpring: true });
      },
      orbit(t0, dur, radius = 80, deg = 40) { // arc of `deg` degrees: sideways and up a little, with a slight roll toward the end
        const a = deg * Math.PI / 180, roll = deg / 10;
        return add({ t0, dur, path: p => ({ x: radius * Math.sin(a * p), y: -radius * (1 - Math.cos(a * p)), rot: roll * p }) });
      },
      shake(t0, dur = .5, amp = 12, seed = 1) { // seeded smooth noise under a decaying envelope; a transient, never moves the settled camera
        const r = rng(seed), ph = [], fr = [];
        for (let ch = 0; ch < 3; ch++) { ph.push([r() * 6.28, r() * 6.28, r() * 6.28]); fr.push([22 + r() * 8, 31 + r() * 9, 45 + r() * 12]); }
        const n = (t, ch) => (Math.sin(fr[ch][0] * t + ph[ch][0]) + Math.sin(fr[ch][1] * t + ph[ch][1]) * .6 + Math.sin(fr[ch][2] * t + ph[ch][2]) * .3) / 1.9;
        shakes.push({ t0, dur, amp, n });
        return api;
      },
      creep(t0, t1, o = {}) { // rate per frame at 30 fps; edge = soft start and end in s (8 frames)
        creeps.push({ t0, t1, rate: (o.rate === undefined ? .0014 : o.rate) * 30, edge: o.edge === undefined ? 8 / 30 : o.edge, back: o.back || 0 });
        return api;
      },
      punch(t0, o = {}) { return api.creep(t0, t0 + (o.frames || 35) / 30, { rate: o.rate === undefined ? .006 : o.rate, back: o.back }); },
      kick(t0, amp = 4.5, o = {}) { kicks.push({ t0, amp, fps: o.fps || 30 }); return api; },
      drift(o = {}) { drift = { amount: o.amount === undefined ? .06 : o.amount, period: o.period || 14, t0: o.t0 || 0 }; return api; },
      settled: () => ({ ...settled }),
    };
    return api;
  }

  g.Camera = { rig, HOME };
})(typeof window !== 'undefined' ? window : globalThis);
