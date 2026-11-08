// Dial: a round dial turns to a value, marks around the edge fill as it goes.
// params: from, to, max, marks (count), labels (strings round the edge), label (small line),
//   kind ('clock' full circle + hand | 'gauge' 270 degree arc + needle + number | 'sun' half arc over a horizon + sun dot)
(function () {
  const K = window.Kit;
  let uid = 0;

  window.Screens.dial = function (root, params) {
    const p = K.params(params, { from: 0, to: 18, max: 24, marks: 24, labels: null, label: '', kind: 'clock', dur: 4 });
    const kind = ['clock', 'gauge', 'sun'].includes(p.kind) ? p.kind : 'clock';
    const max = p.max > 0 ? p.max : 1, nm = Math.max(0, Math.min(120, Math.floor(p.marks) || 0));
    const from = Math.min(max, Math.max(0, p.from)), to = Math.min(max, Math.max(0, p.to)), dir = to >= from ? 1 : -1;
    const R = kind === 'sun' ? 350 : kind === 'gauge' ? 310 : 300;
    const [a0, a1] = kind === 'clock' ? [0, 360] : kind === 'gauge' ? [-135, 135] : [-90, 90];
    const cy = kind === 'sun' ? 130 : kind === 'gauge' ? Math.round(R * 0.146) : 0;
    const nMark = kind === 'clock' ? nm : nm + 1, mval = (k) => (k / Math.max(1, nm)) * max;
    const snd = K.sounds(p), id = 'dial' + uid++;
    const travel = Math.max(0.3, p.dur - 0.5), arrive = p.t0 + travel;

    const pt = (r, a) => [r * Math.sin((a * Math.PI) / 180), -r * Math.cos((a * Math.PI) / 180)];
    const ang = (v) => a0 + (a1 - a0) * K.clamp(v / max);
    const arc = (r, as, ae) => {
      let lo = Math.min(as, ae), hi = Math.max(as, ae); if (hi - lo < 0.05) return '';
      if (hi - lo > 359.9) hi = lo + 359.9;
      const [x0, y0] = pt(r, lo), [x1, y1] = pt(r, hi);
      return `M${x0.toFixed(2)} ${y0.toFixed(2)}A${r} ${r} 0 ${hi - lo > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
    };

    // the value over time: eased travel, then a small damped settle, then a tiny idle sway
    const nominal = (t) => from + (to - from) * K.inout(K.prog(t, p.t0, travel));
    const value = (t) => {
      let v = nominal(t);
      const s = t - arrive;
      if (s > 0 && to !== from) v += (to - from) * 0.02 * Math.exp(-4.5 * s) * Math.sin(13 * s) + max * 0.0012 * K.clamp(s / 1) * Math.sin(t * 1.9);
      return Math.min(max, Math.max(0, v));
    };

    // when each mark is passed: invert the eased travel numerically
    const tm = [];
    for (let k = 0; k < nMark; k++) {
      const m = mval(k), x = to === from ? 2 : (m - from) / (to - from);
      if (x < 0 || x > 1) { tm.push(Infinity); continue; }
      let lo = 0, hi = 1; for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (K.inout(mid) < x) lo = mid; else hi = mid; }
      tm.push(p.t0 + lo * travel);
    }
    const tickT = tm.map((x, k) => [x, k]).filter(([x]) => isFinite(x) && x > p.t0 + 0.02).sort((a, b) => a[0] - b[0]);
    let lastT = -1; tickT.forEach(([x], j) => { if (x - lastT >= 0.085) { snd.add(x, 'tick', 0.16 + 0.14 * (j / tickT.length)); lastT = x; } });

    // DOM / SVG
    const stage = K.stage(root, p);
    const S = K.svg('svg', { width: '1100', height: '1100', viewBox: '-550 -550 1100 1100' }, stage);
    Object.assign(S.style, { position: 'absolute', left: '-550px', top: '-550px', overflow: 'visible' });
    const defs = K.svg('defs', {}, S);
    const blur = K.svg('filter', { id: id + 'b', x: '-50%', y: '-50%', width: '200%', height: '200%' }, defs);
    K.svg('feGaussianBlur', { stdDeviation: '9' }, blur);
    const grad = K.svg('radialGradient', { id: id + 'f' }, defs);
    [['0', 'var(--lift)', '0.9'], ['1', 'var(--deep)', '0']].forEach(([o, c, a]) => { const s = K.svg('stop', { offset: o }, grad); s.style.stopColor = c; s.style.stopOpacity = a; });
    const halo = K.svg('radialGradient', { id: id + 'h' }, defs);
    [['0', 'var(--accent-hi)', '0.75'], ['1', 'var(--accent)', '0']].forEach(([o, c, a]) => { const s = K.svg('stop', { offset: o }, halo); s.style.stopColor = c; s.style.stopOpacity = a; });
    const G = K.svg('g', { transform: `translate(0 ${cy})` }, S);
    const st = (e, o) => { Object.assign(e.style, o); return e; };
    // face
    if (kind === 'sun') st(K.svg('path', { d: `M${-R - 40} 0A${R + 40} ${R + 40} 0 0 1 ${R + 40} 0Z` }, G), { fill: `url(#${id}f)`, opacity: '0.7' });
    else st(K.svg('circle', { r: R + 40 }, G), { fill: `url(#${id}f)`, opacity: '0.8' });
    // rim
    const rimD = kind === 'clock' ? `M0 ${-R}A${R} ${R} 0 1 1 -0.01 ${-R}` : arc(R, a0, a1);
    const rim = st(K.svg('path', { d: rimD, pathLength: '1', fill: 'none' }, G), { stroke: 'var(--dim)', strokeWidth: '2', opacity: '0.75', strokeDasharray: '1' });
    const horizon = kind === 'sun' ? st(K.svg('path', { d: `M${-R - 110} 0H${R + 110}`, pathLength: '1', fill: 'none' }, G), { stroke: 'var(--ink)', strokeWidth: '3', opacity: '0.8', strokeDasharray: '1' }) : null;
    // marks
    const major = nm % 4 === 0 && nm >= 8 ? nm / 4 : 5;
    const marks = [];
    for (let k = 0; k < nMark; k++) {
      const a = kind === 'clock' ? (k / nm) * 360 : a0 + ((a1 - a0) * k) / Math.max(1, nm), big = k % major === 0, len = big ? 40 : 22;
      const l = K.svg('line', {}, G); st(l, { strokeLinecap: 'round' });
      marks.push({ l, a, big, len, ux: Math.sin((a * Math.PI) / 180), uy: -Math.cos((a * Math.PI) / 180) });
    }
    // trail, ghosts, needle / sun
    const glow = st(K.svg('path', { fill: 'none', filter: `url(#${id}b)` }, G), { stroke: 'var(--accent)', strokeWidth: '20', opacity: '0.28', strokeLinecap: 'round' });
    const trail = st(K.svg('path', { fill: 'none' }, G), { stroke: 'var(--accent)', strokeWidth: '7', strokeLinecap: 'round' });
    const ghosts = [], GN = 5;
    let needle, hub, hub2, sunHalo, sunCore, sunRef, sunGlint;
    if (kind === 'sun') {
      sunGlint = st(K.svg('ellipse', { cy: 4, ry: 7 }, G), { fill: 'var(--accent)' });
      sunRef = st(K.svg('circle', { r: 30 }, G), { fill: 'var(--accent)', opacity: '0.25', filter: `url(#${id}b)` });
      for (let i = 0; i < GN; i++) ghosts.push(st(K.svg('circle', { r: 30 }, G), { fill: 'var(--accent)' }));
      sunHalo = st(K.svg('circle', { r: 90, fill: `url(#${id}h)` }, G), {});
      sunCore = st(K.svg('circle', { r: 30 }, G), { fill: 'var(--accent-hi)' });
    } else {
      for (let i = 0; i < GN; i++) ghosts.push(st(K.svg('line', {}, G), { stroke: 'var(--accent)', strokeWidth: '7', strokeLinecap: 'round' }));
      needle = st(K.svg('line', {}, G), { stroke: 'var(--accent)', strokeWidth: '7', strokeLinecap: 'round' });
      hub = st(K.svg('circle', { r: 17 }, G), { fill: 'var(--ink)' });
      hub2 = st(K.svg('circle', { r: 6 }, G), { fill: 'var(--accent)' });
    }
    const setNeedle = (ln, a, rr) => { const [x, y] = pt(rr, a), [tx, ty] = pt(-38, a); ln.setAttribute('x1', tx); ln.setAttribute('y1', ty); ln.setAttribute('x2', x); ln.setAttribute('y2', y); };

    // labels (DOM, so the real fonts are used)
    const L = Array.isArray(p.labels) ? p.labels : [];
    const labs = L.map((s, i) => {
      const f = kind === 'clock' ? i / L.length : L.length > 1 ? i / (L.length - 1) : 0.5, a = a0 + (a1 - a0) * f;
      let x, y;
      if (kind === 'sun') { x = pt(R, a)[0]; y = cy + 62; } else { const q = pt(R + 54, a); x = q[0]; y = cy + q[1]; }
      const e = K.el('div', { text: s, style: { position: 'absolute', left: x + 'px', top: y + 'px', transform: 'translate(-50%,-50%)', fontSize: '34px', letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--quiet)', whiteSpace: 'nowrap' } }, stage);
      return { e, f };
    });
    const tol = L.length ? (kind === 'clock' ? 0.5 / L.length : 0.5 / Math.max(1, L.length - 1)) * 0.9 : 0;
    const bigNum = kind === 'gauge' ? K.el('div', { text: '0', style: { position: 'absolute', left: '0', top: cy + Math.round(R * 0.52) + 'px', transform: 'translate(-50%,-50%)', fontFamily: 'var(--serif, Baskerville, serif)', fontSize: '170px', lineHeight: '1', color: 'var(--ink)', fontVariantNumeric: 'tabular-nums lining-nums', whiteSpace: 'nowrap' } }, stage) : null;
    const nmb = bigNum ? K.motionBlur(bigNum, true) : null;
    const dec = Math.abs(to - Math.round(to)) > 1e-6 || Math.abs(from - Math.round(from)) > 1e-6 ? 1 : 0;
    const lab = p.label ? K.el('div', { text: p.label, style: { position: 'absolute', left: '0', top: cy + (kind === 'sun' ? 170 : kind === 'gauge' ? Math.round(R * 0.52) + 120 : R + 150) + 'px', transform: 'translate(-50%,-50%)', fontSize: '32px', letterSpacing: '.3em', textTransform: 'uppercase', color: 'var(--quiet)', whiteSpace: 'nowrap' } }, stage) : null;

    return {
      sfx: snd.list,
      end: arrive + 1.4,
      frame(t) {
        const show = K.ease(K.prog(t, p.t0 - 0.5, 0.5)), v = value(t), a = ang(v), f = v / max;
        const [dx, dy] = K.drift(t, p.seed, 3);
        stage.style.transform = `translate(${dx}px, ${dy}px) scale(${p.scale})`;
        S.style.opacity = String(show);
        const draw = K.ease(K.prog(t, p.t0 - 0.5, 0.8));
        rim.style.strokeDashoffset = String(1 - draw);
        if (horizon) horizon.style.strokeDashoffset = String(1 - draw);
        // marks
        marks.forEach((m, k) => {
          const age = t - tm[k], lit = age >= 0, fresh = lit && age < 0.4, pop = lit ? 1 + 0.35 * (1 - K.spring(K.prog(t, tm[k], 0.35))) : 1;
          const appear = K.ease(K.prog(t, p.t0 - 0.5 + (k / Math.max(1, nMark)) * 0.4, 0.3));
          const r2 = R - 10, r1 = r2 - m.len * (lit ? pop : 1);
          m.l.setAttribute('x1', m.ux * r1); m.l.setAttribute('y1', m.uy * r1); m.l.setAttribute('x2', m.ux * r2); m.l.setAttribute('y2', m.uy * r2);
          m.l.style.stroke = fresh ? 'var(--accent-hi)' : lit ? 'var(--ink)' : 'var(--dim)';
          m.l.style.strokeWidth = lit ? (m.big ? '5' : '4') : m.big ? '3.5' : '2.5';
          m.l.style.opacity = String(appear * (lit ? 1 : 0.8));
        });
        // trail, glow
        const startA = ang(from), d = kind === 'clock' || kind === 'gauge' || kind === 'sun' ? arc(R, startA, a) : '';
        trail.setAttribute('d', d); glow.setAttribute('d', d);
        trail.style.opacity = String(show); glow.style.opacity = String(0.22 + 0.08 * Math.sin(t * 1.6));
        const speed = Math.abs(value(t + 0.02) - value(t - 0.02));
        if (kind === 'sun') {
          const [x, y] = pt(R, a), bob = 1 + 0.04 * Math.sin(t * 1.5);
          sunCore.setAttribute('cx', x); sunCore.setAttribute('cy', y); sunCore.setAttribute('r', 30 * bob);
          sunHalo.setAttribute('cx', x); sunHalo.setAttribute('cy', y); sunHalo.setAttribute('r', 92 * (1 + 0.07 * Math.sin(t * 1.1)));
          sunRef.setAttribute('cx', x); sunRef.setAttribute('cy', -y * 0.35); sunRef.setAttribute('transform', `translate(${x} ${-y * 0.35}) scale(1 0.55) translate(${-x} ${y * 0.35})`);
          sunGlint.setAttribute('cx', x); sunGlint.setAttribute('rx', 60 + 110 * (y < -1 ? Math.min(1, -y / R) : 0)); sunGlint.style.opacity = String(0.35 * show);
          ghosts.forEach((gh, i) => { const [gx, gy] = pt(R, ang(value(t - (i + 1) * 0.022))); gh.setAttribute('cx', gx); gh.setAttribute('cy', gy); gh.setAttribute('r', 30 * (1 - i * 0.13)); gh.style.opacity = String(Math.min(0.35, speed * 40) * (1 - i / GN) * show); });
        } else {
          setNeedle(needle, a, R - 52);
          ghosts.forEach((gh, i) => { setNeedle(gh, ang(value(t - (i + 1) * 0.022)), R - 52); gh.style.opacity = String(Math.min(0.4, speed * 45) * (1 - i / GN) * show); });
        }
        // labels: the one the hand is on lights up
        labs.forEach((o) => {
          const on = Math.abs(o.f - f) <= tol || (kind === 'clock' && Math.abs(o.f - f) >= 1 - tol);
          o.e.style.color = on ? 'var(--accent-hi)' : 'var(--quiet)';
          o.e.style.opacity = String(K.ease(K.prog(t, p.t0 - 0.3, 0.6)));
        });
        if (bigNum) {
          bigNum.textContent = dec ? v.toFixed(1) : String(Math.round(v));
          bigNum.style.opacity = String(show);
          bigNum.style.color = t >= arrive ? 'var(--accent-hi)' : 'var(--ink)';
          nmb(t < arrive ? Math.min(8, speed * 8) : 0);
        }
        if (lab) K.up(lab, t, p.t0 + 0.2, 0.7);
      },
    };
  };
})();
