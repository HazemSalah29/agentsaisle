// Transitions between scenes: crossfade, dipSeed, colorShift, keyUnderline, fold, mirrorFold, maskWipe, matchCut, pageTurn.
// Plain script: sets window.Transitions. Each maker returns { frame(t), sfx, end } and frame(t)
// is a pure function of t (every style is set from t alone on every call).
//
// Scene elements (a, b) are full-frame layers the PAGE owns (position:absolute, 1080x1920 at 0,0).
// The transitions own only opacity, transform, transform-origin and filter on them, so keep
// your own transforms on an inner wrapper, not on the scene layer itself.
//
// crossfade(a, b, {t0, dur=0.45, sound})
// dipSeed(a, b, {t0, dur=1.6, seed='dot'|'zero'|<text>, x=540, y=860, parent, sound})
// colorShift(target, {t0, dur=2.5, to='oxblood', from=<data-palette of target or 'olive'>, sound})
// keyUnderline(wordEl, {at, lag=0.1, colour='var(--accent)', sound})
//   keyUnderline measures wordEl ONCE at make time (and again when document.fonts.ready resolves),
//   using offsetLeft/Top/Width/Height, which ignore transforms. Make it after the word's layout is
//   final (fonts loaded, fit/size applied) and before any transform on the scene. The underline
//   element is appended inside wordEl.offsetParent, so that parent must be positioned.
// fold(a, b, {t0, dur=0.9, axis='y'|'x', hinge='left'|'right'|'top'|'bottom', dist=2.4*side px, sound})
//   a swings off its hinge toward the viewer (CSS 3D, perspective dist px) with a shade; b waits behind with a cast shadow.
// mirrorFold(a, b, {t0, dur=0.9, right=<layer>, dist=2600, sound})
//   a splits at x=540: a itself is the left half, `right` the right half. `right` must be a SECOND layer showing the
//   same scene as a (build the scene twice, call both frames). Omitted, a static clone of a is made at make time (no canvas).
// maskWipe(a, b, {t0, dur=0.9, shape='circle'|'arch'|'line'|<svg path>, x=540, y=960, lead=<el in a>, soft=0, rin=30, rim=true, sound})
//   b shows through a growing shape that starts at x,y (or at the centre of lead). soft (px) feathers circle and line.
//   An svg path string is drawn in a 100x100 box; rin is the radius of the biggest circle that fits inside it at its
//   centre (the mask grows until that circle covers the frame). Arch and path edges are hard.
// matchCut(a, b, {t0, dur=0.9, fromEl, toEl, fromRect, toRect, parent, sound})
//   a clone of fromEl (in a) travels and scales onto toEl (in b) while the scenes swap behind it. Both rects are measured
//   ONCE at make time and again when document.fonts.ready resolves (getBoundingClientRect), so make it with both scenes at
//   rest and fonts loaded; m.measure() re-measures; fromRect/toRect {x,y,w,h} skip measuring (use them when the element
//   moves in its scene). fromEl should be self-contained (inline styles, no ancestor-dependent CSS, no transform of its own).
//   fromEl and toEl get their inline visibility set while it runs and put back after.
// pageTurn(a, b, {t0, dur=1.0, corner='br'|'bl'|'tr'|'tl', angle=30, sound})
//   a peels off a corner: its back (palette --lift) folds over with a moving highlight and a shadow, b waits behind.
// fold, mirrorFold, maskWipe, pageTurn also set zIndex on a and b (and on right) while they run; they paint a ground
// behind a so a stays solid as it moves. The layers need position:absolute and a zIndex (the screens' windows have both).
(function () {
  const K = window.Kit;
  const T = {};
  const sounds = (o) => K.sounds({ sound: o.sound !== false });

  // ---------- crossfade ----------
  T.crossfade = function (a, b, opts) {
    const o = { t0: 0, dur: 0.45, ...(opts || {}) };
    const snd = sounds(o);
    snd.add(o.t0, 'slide', 0.1);
    return {
      sfx: snd.list,
      end: o.t0 + o.dur + 0.3,
      frame(t) {
        const p = K.inout(K.prog(t, o.t0, o.dur));
        a.style.opacity = String(1 - p);
        a.style.transformOrigin = '50% 50%';
        a.style.transform = p > 0 ? `scale(${1 + 0.02 * p})` : '';
        b.style.opacity = String(p);
        b.style.transformOrigin = '50% 50%';
        b.style.transform = '';
        b.style.filter = p > 0 && p < 1 ? `blur(${(1 - p) * 10}px)` : '';
        a.style.filter = '';
      },
    };
  };

  // ---------- dip and seed ----------
  T.dipSeed = function (a, b, opts) {
    const o = { t0: 0, dur: 1.6, seed: 'dot', x: 540, y: 860, ...(opts || {}) };
    const parent = o.parent || a.parentNode;
    const snd = sounds(o);
    const low = o.t0 + o.dur * 0.4; // the dip's low point
    snd.add(low, 'tap', 0.3);
    const base = { position: 'absolute', left: o.x + 'px', top: o.y + 'px', zIndex: '20', pointerEvents: 'none', opacity: '0', color: 'var(--accent-hi)', whiteSpace: 'nowrap' };
    let seedEl, grow = 4;
    if (o.seed === 'dot') {
      seedEl = K.el('div', { style: { ...base, width: '44px', height: '44px', marginLeft: '-22px', marginTop: '-22px', borderRadius: '50%', background: 'var(--accent-hi)', boxShadow: '0 0 60px 18px var(--accent), 0 0 160px 50px var(--accent)' } }, parent);
    } else {
      const word = o.seed === 'zero' ? '0' : String(o.seed);
      const size = o.seed === 'zero' ? 300 : 130;
      seedEl = K.el('div', { text: word, style: { ...base, fontFamily: 'var(--serif, Baskerville, "Libre Baskerville", serif)', fontSize: size + 'px', lineHeight: '1', transform: 'translate(-50%,-50%)', textShadow: '0 0 50px var(--accent)' } }, parent);
      grow = 2.4;
    }
    const centre = o.seed === 'dot' ? '' : 'translate(-50%,-50%) ';
    return {
      sfx: snd.list,
      end: o.t0 + o.dur + 0.8,
      frame(t) {
        const D = o.dur, u = t - o.t0;
        const dim = K.inout(K.prog(u, 0, D * 0.4)); // a goes to the ground
        const gp = K.quartOut(K.prog(u, D * 0.55, D * 0.45)); // b grows out of the seed
        // outgoing scene
        a.style.opacity = String(1 - dim);
        a.style.transformOrigin = `${o.x}px ${o.y}px`;
        a.style.transform = dim > 0 ? `scale(${1 - 0.04 * dim})` : '';
        a.style.filter = '';
        // incoming scene
        b.style.opacity = String(u < D * 0.55 ? 0 : K.ease(K.prog(u, D * 0.55, D * 0.3)));
        b.style.transformOrigin = `${o.x}px ${o.y}px`;
        b.style.transform = u < D * 0.55 ? 'scale(0.85)' : `scale(${0.85 + 0.15 * gp})`;
        b.style.filter = gp > 0 && gp < 1 ? `blur(${(1 - gp) * 8}px)` : '';
        // seed: appears while a dims, breathes in the hold, swells and fades into b
        const inP = K.ease(K.prog(u, D * 0.12, D * 0.28));
        const out = K.inout(K.prog(u, D * 0.55, D * 0.45));
        const breath = 1 + 0.07 * Math.sin(u * 5);
        const sc = (0.6 + 0.4 * K.spring(inP)) * breath * (1 + (grow - 1) * out);
        seedEl.style.opacity = String(inP * (1 - out));
        seedEl.style.transform = centre + `scale(${sc})`;
      },
    };
  };

  // ---------- colour shift (OKLab) ----------
  const TOKENS = ['--bg', '--lift', '--deep', '--ink', '--quiet', '--dim', '--accent', '--accent-hi'];
  const lin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const unlin = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
  const toLab = ([r, g, b]) => {
    r = lin(r / 255); g = lin(g / 255); b = lin(b / 255);
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
  };
  const fromLab = ([L, A, B]) => {
    const l = Math.pow(L + 0.3963377774 * A + 0.2158037573 * B, 3);
    const m = Math.pow(L - 0.1055613458 * A - 0.0638541728 * B, 3);
    const s = Math.pow(L - 0.0894841775 * A - 1.291485548 * B, 3);
    const c = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
    return c.map((v) => Math.round(K.clamp(unlin(K.clamp(v, 0, 1))) * 255));
  };
  // read a palette's tokens as [r,g,b] by probing an element with data-palette set
  const readPalette = (name) => {
    const probe = document.createElement('div');
    probe.setAttribute('data-palette', name);
    probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;width:0;height:0';
    document.body.append(probe);
    const out = {};
    for (const tk of TOKENS) {
      probe.style.backgroundColor = `var(${tk})`;
      const m = getComputedStyle(probe).backgroundColor.match(/[\d.]+/g) || [0, 0, 0];
      out[tk] = [+m[0], +m[1], +m[2]];
    }
    probe.remove();
    return out;
  };

  T.colorShift = function (target, opts) {
    const o = { t0: 0, dur: 2.5, to: 'oxblood', ...(opts || {}) };
    const holder = target.closest('[data-palette]');
    const from = o.from || (holder && holder.getAttribute('data-palette')) || 'olive';
    const A = readPalette(from), B = readPalette(o.to);
    const labA = {}, labB = {};
    for (const tk of TOKENS) { labA[tk] = toLab(A[tk]); labB[tk] = toLab(B[tk]); }
    const snd = sounds(o);
    snd.add(o.t0, 'bong', 0.1);
    const rgb = (c) => `rgb(${c[0]},${c[1]},${c[2]})`;
    return {
      sfx: snd.list,
      end: o.t0 + o.dur + 1,
      frame(t) {
        if (t < o.t0) { for (const tk of TOKENS) target.style.removeProperty(tk); return; }
        if (t >= o.t0 + o.dur) { for (const tk of TOKENS) target.style.setProperty(tk, rgb(B[tk])); return; }
        const p = K.inout(K.prog(t, o.t0, o.dur));
        for (const tk of TOKENS) {
          const x = labA[tk], y = labB[tk];
          target.style.setProperty(tk, rgb(fromLab([K.lerp(x[0], y[0], p), K.lerp(x[1], y[1], p), K.lerp(x[2], y[2], p)])));
        }
      },
    };
  };

  // ---------- key-word underline ----------
  T.keyUnderline = function (wordEl, opts) {
    const o = { at: 0, lag: 0.1, colour: 'var(--accent)', ...(opts || {}) };
    const t1 = o.at + o.lag;
    const snd = sounds(o);
    snd.add(t1, 'drop', 0.25);
    const parent = wordEl.offsetParent || wordEl.parentNode;
    const rtl = !!wordEl.closest('[dir="rtl"]') || /[؀-ۿ]/.test(wordEl.textContent);
    const line = K.rule(parent, { rtl, h: 5, style: { background: o.colour, pointerEvents: 'none', zIndex: '20' } });
    const measure = () => {
      const h = Math.max(4, Math.round(wordEl.offsetHeight * 0.05));
      line.style.left = wordEl.offsetLeft + 'px';
      line.style.width = wordEl.offsetWidth + 'px';
      line.style.height = h + 'px';
      line.style.top = wordEl.offsetTop + wordEl.offsetHeight + Math.round(h * 0.8) + 'px';
    };
    measure();
    document.fonts.ready.then(measure);
    const baseInline = wordEl.style.color;
    const baseColour = getComputedStyle(wordEl).color; // the word's colour at make time
    return {
      sfx: snd.list,
      end: t1 + 0.25 + 1,
      frame(t) {
        const cp = K.ease(K.prog(t, t1, 0.2));
        wordEl.style.color = cp <= 0 ? baseInline : `color-mix(in oklab, ${o.colour} ${Math.round(cp * 100)}%, ${baseColour})`;
        K.draw(line, K.ease(K.prog(t, t1, 0.25)));
      },
    };
  };

  // ---------- shared: stacking, clean rest states, grounds ----------
  const zOf = (e) => parseInt(getComputedStyle(e).zIndex, 10) || 0;
  const CLEAN = { transform: '', transformOrigin: '', filter: '', clipPath: '' };
  const maskSet = (e, img, size, pos) => { for (const [k, v] of [['image', img || ''], ['size', size || ''], ['position', pos || ''], ['repeat', img ? 'no-repeat' : '']]) { e.style.setProperty('mask-' + k, v); e.style.setProperty('-webkit-mask-' + k, v); } };
  const clean = (...es) => es.forEach((e) => { Object.assign(e.style, CLEAN); maskSet(e, ''); });
  // p<=0: a showing, b waiting. p>=1: a hidden, b normal. In between the transition sets everything.
  const rest = (a, b, p) => { clean(a, b); a.style.opacity = p >= 1 ? '0' : '1'; b.style.opacity = p >= 1 ? '1' : '0'; };
  // z flip while running; puts back the page's own zIndex at both ends. set(p, aTop) is true while running
  const stack = (a, b, more = []) => {
    const all = [a, b, ...more], keep = all.map((e) => e.style.zIndex), z = Math.max(zOf(a), zOf(b));
    for (const e of [a, b]) e.style.isolation = 'isolate';
    return { z, set(p, aTop) {
      const on = p > 0 && p < 1;
      all.forEach((e, i) => { e.style.zIndex = on ? String(z + (i === 0 ? (aTop ? 2 : 0) : i === 1 ? (aTop ? 0 : 2) : 2)) : keep[i]; });
      return on;
    } };
  };
  const ground = (a) => K.el('div', { style: { position: 'absolute', inset: '0', zIndex: '-1', opacity: '0', pointerEvents: 'none', background: 'radial-gradient(ellipse 900px 1250px at 50% 45%, var(--lift) 0%, var(--bg) 55%, var(--deep) 100%)' } }, a);
  const shadeOf = (pct) => `color-mix(in srgb, var(--deep) ${pct}%, transparent)`;
  const sheet = (parent, z, css) => K.el('div', { style: { position: 'absolute', inset: '0', zIndex: String(z), opacity: '0', pointerEvents: 'none', ...(css || {}) } }, parent);
  const RAD = Math.PI / 180;

  // ---------- fold: a swings off a hinge ----------
  T.fold = function (a, b, opts) {
    const o = { t0: 0, dur: 0.9, axis: 'y', hinge: 'left', ...(opts || {}) };
    const hinge = o.axis === 'x' ? (o.hinge === 'bottom' ? 'bottom' : 'top') : (o.hinge === 'right' ? 'right' : 'left');
    // origin, angle sign (free edge toward the viewer), gradient direction (hinge to free edge), length, rotate axis
    const [org, sg, ang, L, ax] = { left: ['0% 50%', -1, 90, 1080, 'Y'], right: ['100% 50%', 1, 270, 1080, 'Y'], top: ['50% 0%', 1, 180, 1920, 'X'], bottom: ['50% 100%', -1, 0, 1920, 'X'] }[hinge];
    o.dist = o.dist || L * 2.4; // perspective distance: a free edge never grows past about 1.7x
    const snd = sounds(o);
    snd.add(o.t0 + o.dur * 0.3, 'slide', 0.12);
    const S = stack(a, b), back = ground(a);
    const shade = sheet(a, 99, { background: `linear-gradient(${ang}deg, transparent 5%, var(--deep) 100%)` });
    const cw = 300, vert = ax === 'Y';
    const cast = sheet(b, 99, { inset: 'auto', left: '0', top: '0', width: vert ? cw + 'px' : '1080px', height: vert ? '1920px' : cw + 'px', background: `linear-gradient(${ang}deg, ${shadeOf(60)}, transparent)` });
    return {
      sfx: snd.list,
      end: o.t0 + o.dur + 0.3,
      frame(t) {
        const p = K.prog(t, o.t0, o.dur);
        if (!S.set(p, true)) { rest(a, b, p); back.style.opacity = shade.style.opacity = cast.style.opacity = '0'; return; }
        clean(a, b);
        a.style.opacity = b.style.opacity = '1';
        const phi = 90 * K.inout(p), r = phi * RAD;
        a.style.transformOrigin = org;
        a.style.transform = `perspective(${o.dist}px) rotate${ax}(${sg * phi}deg)`;
        back.style.opacity = String(K.ease(K.prog(p, 0, 0.12)));
        shade.style.opacity = String(0.7 * Math.sin(r));
        // the shadow a throws on b follows its projected free edge
        const E = L * Math.cos(r) * o.dist / (o.dist - L * Math.sin(r));
        const edge = hinge === 'left' || hinge === 'top' ? E : L - E - cw;
        if (vert) cast.style.left = edge + 'px'; else cast.style.top = edge + 'px';
        cast.style.opacity = String(Math.sin(p * Math.PI * (phi / 90)) * 0.9);
      },
    };
  };

  // ---------- mirror fold: two halves open like doors ----------
  T.mirrorFold = function (a, b, opts) {
    const o = { t0: 0, dur: 0.9, dist: 2600, ...(opts || {}) };
    let right = o.right;
    if (!right) { right = a.cloneNode(true); a.parentNode.insertBefore(right, a.nextSibling); }
    const snd = sounds(o);
    snd.add(o.t0, 'tap', 0.12);
    snd.add(o.t0 + o.dur * 0.2, 'slide', 0.12);
    const S = stack(a, b, [right]), backs = [ground(a), ground(right)];
    const halfShade = (e, d) => sheet(e, 99, { background: `linear-gradient(${d}deg, transparent 0%, var(--deep) 50%, transparent 50%)` });
    const shades = [halfShade(a, 90), halfShade(right, 270)];
    const cw = 260;
    const casts = [90, 270].map((d) => sheet(b, 99, { inset: 'auto', left: '0', top: '0', width: cw + 'px', height: '1920px', background: `linear-gradient(${d}deg, ${shadeOf(60)}, transparent)` }));
    return {
      sfx: snd.list,
      end: o.t0 + o.dur + 0.3,
      frame(t) {
        const p = K.prog(t, o.t0, o.dur);
        if (!S.set(p, true)) {
          rest(a, b, p); clean(right); right.style.opacity = '0';
          [...backs, ...shades, ...casts].forEach((e) => { e.style.opacity = '0'; });
          return;
        }
        clean(a, b, right);
        a.style.opacity = b.style.opacity = right.style.opacity = '1';
        const phi = 90 * K.inout(p), r = phi * RAD;
        a.style.clipPath = 'inset(0 539px 0 0)';
        right.style.clipPath = 'inset(0 0 0 539px)';
        a.style.transformOrigin = '0% 50%';
        right.style.transformOrigin = '100% 50%';
        a.style.transform = `perspective(${o.dist}px) rotateY(${-phi}deg)`;
        right.style.transform = `perspective(${o.dist}px) rotateY(${phi}deg)`;
        backs.forEach((e) => { e.style.opacity = String(K.ease(K.prog(p, 0, 0.12))); });
        shades.forEach((e) => { e.style.opacity = String(0.7 * Math.sin(r)); });
        const E = 540 * Math.cos(r) * o.dist / (o.dist - 540 * Math.sin(r));
        casts[0].style.left = E + 'px';
        casts[1].style.left = 1080 - E - cw + 'px';
        casts.forEach((e) => { e.style.opacity = String(Math.sin(p * Math.PI * (phi / 90)) * 0.9); });
      },
    };
  };

  // ---------- mask wipe: b through a growing shape ----------
  T.maskWipe = function (a, b, opts) {
    const o = { t0: 0, dur: 0.9, shape: 'circle', x: 540, y: 960, soft: 0, rin: 30, rim: true, ...(opts || {}) };
    const at = { x: o.x, y: o.y };
    const measure = () => {
      if (!o.lead) return;
      const r = o.lead.getBoundingClientRect(), q = a.getBoundingClientRect(), k = (q.width / 1080) || 1;
      at.x = (r.left - q.left + r.width / 2) / k; at.y = (r.top - q.top + r.height / 2) / k;
    };
    measure();
    document.fonts.ready.then(measure);
    const snd = sounds(o);
    snd.add(o.t0, 'drop', 0.2);
    const parent = o.parent || a.parentNode;
    const S = stack(a, b), backB = ground(b);
    const circle = o.shape === 'circle', line = o.shape === 'line';
    // svg shapes: [viewBox w, h, anchor x, y, inscribed radius, path]; the anchor sits on x,y
    const sv = !circle && !line ? (o.shape === 'arch' ? [100, 140, 50, 70, 50, 'M0 140V50A50 50 0 0 1 100 50V140Z'] : [100, 100, 50, 50, o.rin, o.shape]) : null;
    const img = sv && `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${sv[0]} ${sv[1]}" preserveAspectRatio="none"><path d="${sv[5]}" fill="#000"/></svg>`)}")`;
    const rim = o.rim && (circle || line) ? [0, 1].slice(0, circle ? 1 : 2).map(() => K.el('div', { style: { position: 'absolute', zIndex: String(S.z + 3), opacity: '0', pointerEvents: 'none', background: line ? 'var(--accent-hi)' : 'none', boxShadow: '0 0 40px 6px var(--accent)', ...(circle ? { borderRadius: '50%', border: '3px solid var(--accent-hi)' } : { left: '0', width: '1080px', height: '3px' }) } }, parent)) : [];
    return {
      sfx: snd.list,
      end: o.t0 + o.dur + 0.3,
      measure,
      frame(t) {
        const p = K.prog(t, o.t0, o.dur);
        if (!S.set(p, false)) { rest(a, b, p); backB.style.opacity = '0'; rim.forEach((e) => { e.style.opacity = '0'; }); return; }
        clean(a, b);
        const tail = K.ease(K.prog(p, 0.9, 0.1)); // b's own ground hands back to the page's as a goes
        a.style.opacity = String(1 - tail); b.style.opacity = '1'; backB.style.opacity = String(1 - tail);
        const e = K.inout(p), { x, y } = at, sf = o.soft;
        const R = Math.max(Math.hypot(x, y), Math.hypot(1080 - x, y), Math.hypot(x, 1920 - y), Math.hypot(1080 - x, 1920 - y));
        a.style.transformOrigin = `${x}px ${y}px`;
        a.style.transform = `scale(${1 + 0.025 * e})`;
        if (circle) {
          const r = (R + sf + 2) * e;
          maskSet(b, `radial-gradient(circle at ${x}px ${y}px, #000 ${Math.max(r - sf, 0)}px, transparent ${r + sf + 0.8}px)`);
          if (rim[0]) Object.assign(rim[0].style, { left: x - r + 'px', top: y - r + 'px', width: 2 * r + 'px', height: 2 * r + 'px', opacity: String(0.9 * (1 - K.ease(K.prog(p, 0.55, 0.45)))) });
        } else if (line) {
          const h = (Math.max(y, 1920 - y) + sf + 2) * e, y0 = y - h, y1 = y + h;
          maskSet(b, `linear-gradient(180deg, transparent ${y0}px, #000 ${y0 + sf + 0.8}px, #000 ${y1 - sf - 0.8}px, transparent ${y1}px)`);
          rim.forEach((m, i) => Object.assign(m.style, { top: (i ? y1 : y0) - 1.5 + 'px', opacity: String(0.9 * (1 - K.ease(K.prog(p, 0.55, 0.45)))) }));
        } else {
          const k = (R / sv[4]) * e;
          maskSet(b, img, `${sv[0] * k}px ${sv[1] * k}px`, `${x - sv[2] * k}px ${y - sv[3] * k}px`);
        }
      },
    };
  };

  // ---------- match cut: one shape becomes the next scene ----------
  T.matchCut = function (a, b, opts) {
    const o = { t0: 0, dur: 0.9, ...(opts || {}) };
    const parent = o.parent || a.parentNode;
    const snd = sounds(o);
    snd.add(o.t0 + o.dur * 0.78, 'tap', 0.2);
    const S = stack(a, b);
    const fv = o.fromEl.style.visibility, tv = o.toEl ? o.toEl.style.visibility : '';
    const rectOf = (el, layer) => {
      const r = el.getBoundingClientRect(), q = layer.getBoundingClientRect(), k = (q.width / 1080) || 1;
      return { x: (r.left - q.left) / k, y: (r.top - q.top) / k, w: r.width / k, h: r.height / k };
    };
    const trav = o.fromEl.cloneNode(true);
    trav.removeAttribute('id');
    const cs = getComputedStyle(o.fromEl);
    for (const k of ['color', 'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'letterSpacing', 'lineHeight', 'textAlign', 'direction', 'whiteSpace', 'textShadow']) trav.style[k] = cs[k];
    Object.assign(trav.style, { position: 'absolute', margin: '0', right: 'auto', bottom: 'auto', transformOrigin: '50% 50%', transform: '', opacity: '0', pointerEvents: 'none', zIndex: String(S.z + 4), visibility: 'visible' });
    parent.append(trav);
    let F, G;
    const measure = () => {
      F = o.fromRect || rectOf(o.fromEl, a);
      G = o.toRect || rectOf(o.toEl, b);
      Object.assign(trav.style, { left: F.x + 'px', top: F.y + 'px', width: F.w + 'px', height: F.h + 'px' });
    };
    measure();
    document.fonts.ready.then(measure);
    return {
      sfx: snd.list,
      end: o.t0 + o.dur + 0.3,
      measure,
      frame(t) {
        const p = K.prog(t, o.t0, o.dur);
        if (!S.set(p, false)) {
          rest(a, b, p); trav.style.opacity = '0';
          o.fromEl.style.visibility = fv; if (o.toEl) o.toEl.style.visibility = tv;
          return;
        }
        clean(a, b);
        a.style.opacity = String(1 - K.inout(K.prog(p, 0.25, 0.35)));
        b.style.opacity = String(K.inout(K.prog(p, 0.3, 0.35)));
        o.fromEl.style.visibility = 'hidden';
        if (o.toEl) o.toEl.style.visibility = p < 0.7 ? 'hidden' : tv;
        const e = K.inout(p), s = F.w * F.h > 0 ? Math.sqrt((G.w * G.h) / (F.w * F.h)) : 1;
        const dx = K.lerp(0, G.x + G.w / 2 - F.x - F.w / 2, e), dy = K.lerp(0, G.y + G.h / 2 - F.y - F.h / 2, e);
        trav.style.transform = `translate(${dx}px, ${dy}px) scale(${K.lerp(1, s, e)})`;
        trav.style.opacity = String(1 - K.ease(K.prog(p, 0.72, 0.28)));
      },
    };
  };

  // ---------- page turn: a peels off a corner ----------
  // canonical space: the turning corner is (1080, 1920); points are mapped to the real corner on output
  const cutHalf = (poly, n, s, keepLow) => {
    const f = (q) => (keepLow ? s - (n[0] * q[0] + n[1] * q[1]) : n[0] * q[0] + n[1] * q[1] - s), out = [];
    poly.forEach((A, i) => {
      const B = poly[(i + 1) % poly.length], fa = f(A), fb = f(B);
      if (fa >= 0) out.push(A);
      if (fa >= 0 !== fb >= 0) { const u = fa / (fa - fb); out.push([A[0] + (B[0] - A[0]) * u, A[1] + (B[1] - A[1]) * u]); }
    });
    return out;
  };
  T.pageTurn = function (a, b, opts) {
    const o = { t0: 0, dur: 1, corner: 'br', angle: 30, ...(opts || {}) };
    const W = 1080, H = 1920, snd = sounds(o);
    snd.add(o.t0 + o.dur * 0.15, 'slide', 0.1);
    const S = stack(a, b), back = ground(a);
    const n = [Math.cos(o.angle * RAD), Math.sin(o.angle * RAD)], smax = n[0] * W + n[1] * H;
    const mx = o.corner[1] === 'l' ? -1 : 1, my = o.corner[0] === 't' ? -1 : 1;
    const deg = Math.atan2(mx * n[0], -(my * n[1])) / RAD; // gradient direction: toward the turning corner
    const map = (poly) => poly.length < 3 ? 'polygon(0px 0px)' : 'polygon(' + poly.map(([x, y]) => `${mx < 0 ? W - x : x}px ${my < 0 ? H - y : y}px`).join(',') + ')';
    const rect = [[0, 0], [W, 0], [W, H], [0, H]];
    const castB = sheet(a.parentNode, S.z + 1), castA = sheet(a.parentNode, S.z + 3), flap = sheet(a.parentNode, S.z + 4);
    return {
      sfx: snd.list,
      end: o.t0 + o.dur + 0.3,
      frame(t) {
        const p = K.prog(t, o.t0, o.dur);
        if (!S.set(p, true)) { rest(a, b, p); back.style.opacity = castB.style.opacity = castA.style.opacity = flap.style.opacity = '0'; return; }
        clean(a, b);
        a.style.opacity = b.style.opacity = '1';
        const s = smax * (1 - K.inout(p)), far = 2 * s - smax; // fold line and the flap's far edge, as distance along n
        const cut = cutHalf(rect, n, s, false);
        let fl = cut.map((q) => { const d = 2 * (n[0] * q[0] + n[1] * q[1] - s); return [q[0] - d * n[0], q[1] - d * n[1]]; });
        fl = cutHalf(cutHalf(cutHalf(cutHalf(fl, [1, 0], 0, false), [1, 0], W, true), [0, 1], 0, false), [0, 1], H, true);
        a.style.clipPath = map(cutHalf(rect, n, s, true));
        back.style.opacity = String(K.ease(K.prog(p, 0, 0.1)));
        Object.assign(castB.style, { opacity: '1', background: `linear-gradient(${deg}deg, transparent ${s - 1}px, ${shadeOf(55)} ${s}px, transparent ${s + 190}px)` });
        Object.assign(castA.style, { opacity: '1', background: `linear-gradient(${deg}deg, transparent ${far - 170}px, ${shadeOf(45)} ${far}px, transparent ${far + 1}px)` });
        Object.assign(flap.style, { opacity: '1', clipPath: map(fl), background: `linear-gradient(${deg}deg, var(--lift) ${far}px, color-mix(in srgb, var(--deep) 25%, var(--lift)) ${s - 110}px, color-mix(in srgb, var(--accent-hi) 34%, var(--lift)) ${s - 62}px, color-mix(in srgb, var(--deep) 40%, var(--lift)) ${s - 22}px, var(--deep) ${s}px)` });
      },
    };
  };

  window.Transitions = T;
})();
