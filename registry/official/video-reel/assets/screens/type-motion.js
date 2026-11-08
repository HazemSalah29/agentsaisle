// Typography motion: text that arrives, morphs, sits in the world, has depth, or writes Arabic through a soft mask.
// Plain script after kit.js: sets window.TypeMotion. Every maker: TypeMotion.name(root, params) -> {frame(t), sfx, end}.
// frame(t) is a pure function of t. Latin text may be split into lines, words or letters; Arabic is ONE text node
// (splitting breaks shaping) and is only ever masked, never cut. Colours come only from the palette tokens.
// makers: maskReveal, wordStagger, textMorph, inWorld, dimensional, arabicMask
(function () {
  const K = window.Kit, T = (window.TypeMotion = window.TypeMotion || {});
  const SERIF = 'var(--serif, Baskerville, "Baskerville Old Face", Georgia, serif)';
  const AR = 'Scheherazade, "Scheherazade New", serif';
  const split = (o) => (o.lines || String(o.text || '').split('\n')).map(String);
  // width in px of a Latin string at a size, measured in a throwaway span (so a headline can be shrunk to fit)
  const widthOf = (parent, s, size, css = {}) => { const e = K.el('span', { text: s, style: { position: 'absolute', visibility: 'hidden', whiteSpace: 'pre', fontFamily: SERIF, fontSize: size + 'px', ...css } }, parent); const w = e.offsetWidth; e.remove(); return w; };
  const fitSize = (parent, lines, size, maxW, css) => { const w = Math.max(...lines.map((l) => widthOf(parent, l, size, css))); return w > maxW ? Math.floor((size * maxW) / w) : size; };
  const col = (parent, extra = {}) => K.el('div', { style: { position: 'absolute', left: '-540px', top: '0', width: '1080px', display: 'flex', flexDirection: 'column', alignItems: 'center', ...extra } }, parent);

  // 1. lines rise from behind a hard mask edge, one line after another
  // params: lines (or text with \n), size 112, stagger 0.2, lineDur 0.85, dir 'up'|'down'|'left', accentLine (index, turns accent-hi)
  T.maskReveal = function (root, o) {
    const p = K.params(o, { lines: ['What you hold', 'holds you back'], size: 112, stagger: 0.2, lineDur: 0.85, dir: 'up', accentLine: -1 });
    const snd = K.sounds(p), stage = K.stage(root, p), lines = split(p);
    const size = fitSize(stage, lines, p.size, 900), lh = size * 1.28;
    const c = col(stage, { top: -(lines.length * lh) / 2 + 'px' });
    const inner = lines.map((l, i) => {
      const mask = K.el('div', { style: { overflow: 'hidden', height: lh + 'px', padding: '0 0.06em' } }, c);
      return K.el('div', { text: l, style: { fontFamily: SERIF, fontSize: size + 'px', lineHeight: lh + 'px', whiteSpace: 'nowrap', color: i === p.accentLine ? 'var(--accent-hi)' : 'var(--ink)', willChange: 'transform' } }, mask);
    });
    lines.forEach((_, i) => { const a = p.t0 + i * p.stagger; snd.add(a + 0.04, i ? 'tap' : 'slide', i ? 0.14 : 0.2); });
    snd.add(p.t0 + (lines.length - 1) * p.stagger + p.lineDur * 0.8, 'drop', 0.22);
    return {
      sfx: snd.list, end: p.t0 + (lines.length - 1) * p.stagger + p.lineDur + 1.0,
      frame(t) {
        inner.forEach((e, i) => {
          const r = 1 - K.quartOut(K.prog(t, p.t0 + i * p.stagger, p.lineDur));
          e.style.transform = p.dir === 'down' ? `translateY(${-r * 108}%)` : p.dir === 'left' ? `translateX(${-r * 108}%)` : `translateY(${r * 108}%)`;
        });
      },
    };
  };

  // 2. words arrive one by one, heavier words slower with a small settle; keyWord lands last and turns accent
  // params: text, size 104, stagger 0.2, keyWord (a word of text, or its index), keyGap 0.5
  T.wordStagger = function (root, o) {
    const p = K.params(o, { text: 'Small deeds done daily outweigh grand ones', size: 104, stagger: 0.2, keyWord: null, keyGap: 0.5 });
    const snd = K.sounds(p), stage = K.stage(root, p), words = String(p.text).split(/\s+/).filter(Boolean);
    const bare = (w) => w.replace(/[^\p{L}\p{N}]/gu, '').toLowerCase();
    const ki = p.keyWord == null ? -1 : typeof p.keyWord === 'number' ? p.keyWord : words.findIndex((w) => bare(w) === bare(p.keyWord));
    if (p.keyWord != null && ki < 0) throw new Error('wordStagger: keyWord "' + p.keyWord + '" not in text');
    const size = Math.min(p.size, 130);
    const c = K.el('div', { style: { position: 'absolute', left: '-460px', top: '0', width: '920px', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', columnGap: size * 0.26 + 'px', rowGap: size * 0.1 + 'px', transform: 'translateY(-50%)' } }, stage);
    const base = { fontFamily: SERIF, fontSize: size + 'px', lineHeight: '1.18', whiteSpace: 'nowrap' };
    const cells = words.map((w) => { const e = K.el('div', { style: { position: 'relative', ...base, color: 'var(--ink)', opacity: '0' } }, c); const hi = K.el('div', { text: w, style: { position: 'absolute', left: '0', top: '0', ...base, color: 'var(--accent-hi)', opacity: '0' } }, e); e.prepend(document.createTextNode(w)); return { e, hi, w }; });
    const others = words.map((_, i) => i).filter((i) => i !== ki), start = {};
    others.forEach((wi, n) => { start[wi] = p.t0 + n * p.stagger; });
    const lastOther = others.length ? p.t0 + (others.length - 1) * p.stagger + 0.8 : p.t0;
    if (ki >= 0) start[ki] = lastOther + p.keyGap;
    const dur = (i) => 0.5 + 0.035 * words[i].length;
    words.forEach((_, i) => snd.add(start[i] + 0.05, i === ki ? 'bell' : 'tap', i === ki ? 0.32 : 0.12));
    const last = Math.max(...Object.values(start)) + 1.2;
    return {
      sfx: snd.list, end: last + 1.0,
      frame(t) {
        cells.forEach((q, i) => {
          const s = K.prog(t, start[i], dur(i)), y = (1 - K.spring(s)) * (34 + 3 * q.w.length);
          q.e.style.opacity = String(K.ease(K.prog(t, start[i], dur(i) * 0.5)));
          const key = i === ki, L = key ? K.ease(K.prog(t, start[i] + 0.12, 0.5)) : 0;
          q.e.style.transform = `translateY(${y.toFixed(2)}px) scale(${1 + 0.04 * Math.sin(Math.PI * L)})`;
          q.hi.style.opacity = String(L);
        });
      },
    };
  };

  // 3. one word becomes another: letters in both slide to their new spots (with a small hop), the rest fade and swap
  // params: from, to, size 230, hold 0.8 (s the first word is read), morph 1.0
  T.textMorph = function (root, o) {
    const p = K.params(o, { from: 'listen', to: 'silent', size: 230, hold: 0.8, morph: 1.0 });
    const snd = K.sounds(p), stage = K.stage(root, p);
    const size = fitSize(stage, [p.from, p.to], p.size, 880);
    const st = { fontFamily: SERIF, fontSize: size + 'px', lineHeight: '1.2', whiteSpace: 'pre', position: 'absolute', left: '0', top: '0' };
    // letter x positions inside a word, from DOM ranges of one text node (keeps kerning), centred on 0
    const spots = (w) => {
      const m = K.el('div', { text: w, style: { ...st, visibility: 'hidden' } }, stage), n = m.firstChild, out = [], r = document.createRange();
      for (let i = 0; i < w.length; i++) { r.setStart(n, i); r.setEnd(n, i + 1); out.push(r.getBoundingClientRect().left - m.getBoundingClientRect().left); }
      const W = m.offsetWidth; m.remove(); return out.map((x) => x - W / 2);
    };
    const xf = spots(p.from), xt = spots(p.to), used = new Set();
    const pair = [...p.to].map((ch) => { const k = [...p.from].findIndex((c, i) => c === ch && !used.has(i)); if (k >= 0) used.add(k); return k; });
    const g = K.el('div', { style: { position: 'absolute', left: '0', top: -size * 0.6 + 'px', width: '0', height: '0' } }, stage);
    const mk = (ch, hi) => K.el('div', { text: ch, style: { ...st, color: hi ? 'var(--accent-hi)' : 'var(--ink)', opacity: '0' } }, g);
    const mt = p.t0 + p.hold, stag = 0.04;
    const moving = [...p.to].map((ch, j) => (pair[j] >= 0 ? { e: mk(ch, false), a: xf[pair[j]], b: xt[j], j } : { e: mk(ch, true), b: xt[j], j }));
    const leaving = [...p.from].map((ch, i) => ({ e: mk(ch, false), a: xf[i] })).filter((_, i) => !used.has(i));
    snd.add(p.t0 + 0.05, 'tap', 0.16);
    snd.add(mt + 0.04, 'slide', 0.2);
    snd.add(mt + p.morph * 0.9, 'drop', 0.26);
    return {
      sfx: snd.list, end: mt + p.morph + 0.9 + 0.9,
      frame(t) {
        const enter = K.ease(K.prog(t, p.t0, 0.7));
        g.style.transform = `translateY(${(1 - enter) * 24}px)`;
        leaving.forEach((q) => { const s = K.ease(K.prog(t, mt, 0.4)); q.e.style.opacity = String(enter * (1 - s)); q.e.style.transform = `translate(${q.a}px, ${-s * 26}px)`; });
        moving.forEach((q) => {
          if (q.a != null) { const e = K.inout(K.prog(t, mt + q.j * stag, p.morph * 0.75)); q.e.style.opacity = String(enter); q.e.style.transform = `translate(${K.lerp(q.a, q.b, e)}px, ${-Math.sin(Math.PI * e) * 38}px)`; }
          else { const s = K.prog(t, mt + p.morph * 0.35 + q.j * stag, 0.5), e = K.ease(s); q.e.style.opacity = String(e); q.e.style.transform = `translate(${q.b}px, ${(1 - e) * 30}px)`; }
        });
      },
    };
  };

  // 4. text laid on a surface in the scene (wall, floor, page) in CSS 3D perspective, so it moves with the world
  // params: lines, size 104, surface 'wall'|'floor'|'page' (sets rotX, rotY, z unless given), rotX, rotY, z, persp 1400,
  //         cam: t => ({x, y, z}) camera position (px; +z moves toward the surface), default a slow push in
  T.inWorld = function (root, o) {
    const preset = { wall: { rotX: 3, rotY: -20, z: -60 }, floor: { rotX: 64, rotY: 0, z: -40 }, page: { rotX: 16, rotY: -12, z: -40 } };
    const p = K.params(o, { lines: ['Written on', 'the wall'], size: 104, surface: 'wall', persp: 1400, cam: null, rotX: null, rotY: null, z: null });
    const pr = preset[p.surface] || preset.wall;
    ['rotX', 'rotY', 'z'].forEach((k) => { if (p[k] == null) p[k] = pr[k]; });
    const snd = K.sounds(p), stage = K.stage(root, p), lines = split(p);
    const W = 880, size = fitSize(stage, lines, p.size, W - 140), lh = size * 1.25, H = lines.length * lh + 150;
    const scene = K.el('div', { style: { position: 'absolute', left: '0', top: '0', width: '0', height: '0', perspective: p.persp + 'px', perspectiveOrigin: '0 0' } }, stage);
    const world = K.el('div', { style: { position: 'absolute', left: '0', top: '0', transformStyle: 'preserve-3d' } }, scene);
    const skin = {
      wall: { background: 'linear-gradient(180deg, var(--lift), var(--bg))', border: '2px solid var(--dim)', borderRadius: '8px', boxShadow: '0 0 90px var(--deep)' },
      page: { background: 'var(--lift)', border: '2px solid var(--dim)', borderRadius: '6px', boxShadow: '0 40px 80px var(--deep)' },
      floor: { backgroundImage: 'repeating-linear-gradient(0deg, var(--dim) 0 3px, transparent 3px 130px), repeating-linear-gradient(90deg, var(--dim) 0 3px, transparent 3px 130px)', webkitMaskImage: 'linear-gradient(0deg, #000 35%, transparent 100%)', maskImage: 'linear-gradient(0deg, #000 35%, transparent 100%)' },
    }[p.surface] || {};
    const plane = K.el('div', { style: { position: 'absolute', left: -W / 2 + 'px', top: -H / 2 + 'px', width: W + 'px', height: H + 'px', transform: `translateZ(${p.z}px) rotateX(${p.rotX}deg) rotateY(${p.rotY}deg)`, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', ...skin } }, world);
    const rows = lines.map((l) => K.el('div', { text: l, style: { fontFamily: SERIF, fontSize: size + 'px', lineHeight: lh + 'px', whiteSpace: 'nowrap', color: 'var(--ink)', opacity: '0' } }, plane));
    const rule = K.rule(plane, { h: 5, style: { left: '70px', width: W - 140 + 'px', bottom: '46px', boxShadow: '0 0 14px var(--accent)' } });
    const stg = 0.3, camera = p.cam || ((t) => { const k = K.inout(K.prog(t, p.t0, p.dur)); return { x: K.lerp(40, -40, k), y: 0, z: K.lerp(0, 190, k) }; });
    snd.add(p.t0 + 0.1, 'slide', 0.16);
    lines.forEach((_, i) => snd.add(p.t0 + 0.5 + i * stg + 0.3, 'drop', 0.2));
    return {
      sfx: snd.list, end: p.t0 + p.dur,
      frame(t) {
        const c = camera(t), fade = K.ease(K.prog(t, p.t0, 0.7));
        world.style.transform = `translate3d(${-c.x}px, ${-c.y}px, ${c.z}px)`;
        plane.style.opacity = String(fade);
        rows.forEach((e, i) => { const s = K.ease(K.prog(t, p.t0 + 0.5 + i * stg, 0.8)); e.style.opacity = String(s); e.style.transform = `translateY(${(1 - s) * 30}px)`; });
        K.draw(rule, K.ease(K.prog(t, p.t0 + 0.5 + lines.length * stg, 0.7)));
      },
    };
  };

  // 5. a big headline with stacked layers behind it (real 3D, token colours) that grow out and turn as it holds
  // params: lines, size 230, depth 24 (layers), gap 4.5 (px between), turn [from, to] degrees [-26, 20]
  T.dimensional = function (root, o) {
    const p = K.params(o, { lines: ['DEPTH'], size: 230, depth: 18, gap: 3.4, turn: [-26, 20], persp: 1700 });
    const snd = K.sounds(p), stage = K.stage(root, p), lines = split(p);
    const size = fitSize(stage, lines, p.size, 860, { letterSpacing: '0.02em' }), n = p.depth;
    const scene = K.el('div', { style: { position: 'absolute', left: '0', top: '0', width: '0', height: '0', perspective: p.persp + 'px', perspectiveOrigin: '0 0' } }, stage);
    const grp = K.el('div', { style: { position: 'absolute', left: '0', top: '0', transformStyle: 'preserve-3d' } }, scene);
    const layers = [];
    for (let i = 0; i < n; i++) {
      const m = i / (n - 1), c = m >= 1 ? 'var(--ink)' : `color-mix(in srgb, var(--accent) ${Math.round(m * 80)}%, var(--dim))`;
      const e = K.el('div', { style: { position: 'absolute', left: '-540px', top: -(lines.length * size * 1.0) / 2 + 'px', width: '1080px', textAlign: 'center', fontFamily: SERIF, fontWeight: '700', fontSize: size + 'px', letterSpacing: '0.02em', lineHeight: '1.0', whiteSpace: 'pre', color: c } }, grp);
      e.textContent = lines.join('\n'); layers.push(e);
    }
    snd.add(p.t0 + 0.1, 'slide', 0.16);
    snd.add(p.t0 + 0.85, 'thud', 0.3);
    return {
      sfx: snd.list, end: p.t0 + p.dur,
      frame(t) {
        const grow = K.quartOut(K.prog(t, p.t0, 0.95)), a = K.ease(K.prog(t, p.t0, 0.4)), k = K.inout(K.prog(t, p.t0 + 0.3, p.dur - 0.3));
        grp.style.opacity = String(a);
        grp.style.transform = `translateY(${(1 - grow) * 40}px) rotateX(${(-4 + 2.5 * Math.sin(t * 0.7)).toFixed(3)}deg) rotateY(${K.lerp(p.turn[0], p.turn[1], k).toFixed(3)}deg)`;
        layers.forEach((e, i) => { e.style.transform = `translateZ(${(-(n - 1 - i) * p.gap * grow).toFixed(2)}px)`; });
      },
    };
  };

  // 6. an Arabic phrase (one node, never split) revealed right to left through a soft-edged moving mask; the English rises after
  // params: ar, en, size 140, softness 160 (px of mask edge), reveal 1.5 (s), gap 0.5 (s after the reveal before English)
  T.arabicMask = function (root, o) {
    const p = K.params(o, { ar: 'إِنَّ مَعَ الْعُسْرِ يُسْرًا', en: 'With hardship comes ease', size: 140, softness: 160, reveal: 1.5, gap: 0.5 });
    const snd = K.sounds(p), stage = K.stage(root, p), W = 900, LH = 1.85;
    let size = p.size, M = null;
    const group = K.el('div', { style: { position: 'absolute', left: '0', top: '0', width: '0', height: '0' } }, stage);
    const css = () => ({ position: 'absolute', left: '0', top: '0', width: W + 'px', fontFamily: AR, fontSize: size + 'px', lineHeight: String(LH), direction: 'rtl', textAlign: 'center', whiteSpace: 'nowrap', fontKerning: 'normal' });
    const wrap = K.el('div', { style: { position: 'absolute', left: -W / 2 + 'px', top: -size * LH / 2 - 110 + 'px', width: W + 'px', height: size * LH + 'px' } }, group);
    const base = K.el('div', { text: p.ar, attrs: { lang: 'ar' }, style: { ...css(), color: 'var(--ink)', opacity: '0' } }, wrap);
    const lit = K.el('div', { text: p.ar, attrs: { lang: 'ar', 'aria-hidden': 'true' }, style: { ...css(), color: 'var(--accent-hi)', opacity: '0' } }, wrap);
    const en = K.el('div', { text: p.en, style: { position: 'absolute', left: -W / 2 + 'px', top: '120px', width: W + 'px', textAlign: 'center', fontFamily: SERIF, fontSize: '64px', lineHeight: '1.25', color: 'var(--ink)', opacity: '0' } }, group);
    const node = base.firstChild;
    const extent = () => { const r = document.createRange(); r.setStart(node, 0); r.setEnd(node, node.length); const bb = base.getBoundingClientRect(), k = bb.width / base.offsetWidth || 1, q = [...r.getClientRects()].filter((c) => c.width > 1); return { minX: Math.min(...q.map((c) => c.left - bb.left)) / k, maxX: Math.max(...q.map((c) => c.right - bb.left)) / k }; };
    const measure = () => {
      let e = extent();
      if (e.maxX - e.minX > W - 20) { size = Math.floor((size * (W - 20)) / (e.maxX - e.minX)); [base, lit].forEach((x) => { x.style.fontSize = size + 'px'; }); wrap.style.height = size * LH + 'px'; wrap.style.top = -size * LH / 2 - 110 + 'px'; e = extent(); }
      M = e;
    };
    document.fonts.load(size + 'px Scheherazade', p.ar).then(measure, measure);
    let ok = false;
    const ensure = () => { if (!ok && document.fonts.check(size + 'px Scheherazade', p.ar)) { measure(); ok = true; } };
    const enT = p.t0 + 0.2 + p.reveal + p.gap;
    snd.add(p.t0 + 0.25, 'tap', 0.18);
    snd.add(p.t0 + 0.2 + p.reveal * 0.95, 'plink', 0.2);
    snd.add(enT + 0.05, 'drop', 0.24);
    const set = (el, v) => { el.style.maskImage = el.style.webkitMaskImage = v; };
    return {
      sfx: snd.list, end: enT + 0.8 + 1.2,
      frame(t) {
        ensure();
        if (!M) { base.style.opacity = lit.style.opacity = '0'; return; }
        const wd = M.maxX - M.minX, g = W - M.maxX, soft = p.softness, r = K.prog(t, p.t0 + 0.2, p.reveal);
        const e = -soft / wd + (1 + soft / wd) * K.inout(r), px = g + e * wd;
        base.style.opacity = String(r > 0 ? 1 : 0);
        if (r >= 1) { set(base, 'none'); lit.style.opacity = '0'; }
        else {
          set(base, `linear-gradient(to left, #000 ${px.toFixed(1)}px, transparent ${(px + soft).toFixed(1)}px)`);
          // a lit band riding the soft edge: the letters are accent-hi as they appear, then settle to ink
          set(lit, `linear-gradient(to left, transparent ${(px + soft * 0.1).toFixed(1)}px, #000 ${(px + soft * 0.45).toFixed(1)}px, transparent ${(px + soft * 1.05).toFixed(1)}px)`);
          lit.style.opacity = String(0.9 * (r > 0 ? 1 : 0));
        }
        const [dx, dy] = K.drift(t, p.seed, 4);
        group.style.transform = `translate(${dx}px, ${dy}px)`;
        K.up(en, t, enT, 0.8, 28);
      },
    };
  };
})();
