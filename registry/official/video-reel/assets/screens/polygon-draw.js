// Polygon draw: a shape draws itself line by line, closes with a chime, then softly fills.
// params: sides, kind ('polygon' | 'star' (star polygon {n/k}) | 'bloom' (rosette of n equal circles round a centre)),
//         draw ('lines' one by one | 'all'), fill (bool), k (optional, star step)
(function () {
  const K = window.Kit;
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  window.Screens.polygonDraw = function (root, params) {
    const p = K.params(params, { sides: 7, kind: 'polygon', draw: 'lines', fill: true, k: 0, dur: 6 });
    const snd = K.sounds(p), stage = K.stage(root, p);
    const n = Math.max(3, Math.min(48, Math.round(p.sides) || 3));
    const R = 380, D = 215, ang = (i) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
    const pt = (i) => [R * Math.cos(ang(i)), R * Math.sin(ang(i))];
    const f2 = (v) => v.toFixed(2);

    // geometry: lines [{d, dot}], fill path
    const lines = []; let fillD = '', fillEach = null;
    if (p.kind === 'bloom') {
      const circ = (cx, cy, r, sx, sy) => `M${f2(sx)} ${f2(sy)}A${f2(r)} ${f2(r)} 0 1 1 ${f2(2 * cx - sx)} ${f2(2 * cy - sy)}A${f2(r)} ${f2(r)} 0 1 1 ${f2(sx)} ${f2(sy)}`;
      lines.push({ d: circ(0, 0, D, D, 0), dot: null }); // seed circle, from its right edge
      fillEach = [{ cx: 0, cy: 0, r: D }];
      for (let i = 0; i < n; i++) {
        const cx = D * Math.cos(ang(i)), cy = D * Math.sin(ang(i));
        lines.push({ d: circ(cx, cy, D, 0, 0), dot: [cx, cy] });
        fillEach.push({ cx, cy, r: D });
      }
    } else {
      let k = 1;
      if (p.kind === 'star') { k = p.k > 0 ? Math.floor(p.k) : Math.max(1, Math.floor((n - 1) / 2)); if (k < 1 || k >= n) k = 1; }
      const g = gcd(n, k), per = n / g;
      for (let s = 0; s < g; s++) { let i = s; for (let c = 0; c < per; c++) { const j = (i + k) % n, a = pt(i), b = pt(j); lines.push({ d: `M${f2(a[0])} ${f2(a[1])}L${f2(b[0])} ${f2(b[1])}`, dot: a }); i = j; } }
      if (p.kind === 'star') fillD = lines.map((l) => l.d).join('');
      else fillD = Array.from({ length: n }, (_, i) => pt(i)).map((a, i) => (i ? 'L' : 'M') + f2(a[0]) + ' ' + f2(a[1])).join('') + 'Z';
    }
    const L = lines.length;

    // timing
    const t1 = p.t0 + 0.45, t2 = p.t0 + Math.max(1.5, 0.7 * p.dur), span = t2 - t1;
    const all = p.draw === 'all';
    const ld = all ? span * 0.8 : Math.max(0.4, (span / L) * 1.5);
    const gap = all ? 0.05 : L > 1 ? Math.max(0, (span - ld) / (L - 1)) : 0;
    const start = (i) => t1 + i * gap, closeT = start(L - 1) + ld;

    // dom
    const svg = K.svg('svg', { width: '1000', height: '1000', viewBox: '-500 -500 1000 1000', style: 'position:absolute;left:-500px;top:-500px;overflow:visible' }, stage);
    const defs = K.svg('defs', {}, svg), fl = K.svg('filter', { id: 'pd-b' + p.seed + '-' + Math.floor(p.t0 * 100), x: '-30%', y: '-30%', width: '160%', height: '160%' }, defs);
    K.svg('feGaussianBlur', { stdDeviation: '9' }, fl);
    const grp = K.svg('g', {}, svg);
    const pulse = K.svg('circle', { r: R, fill: 'none', stroke: 'var(--accent)', 'stroke-width': '3', opacity: '0' }, grp);
    const fillG = K.svg('g', { opacity: '0' }, grp);
    if (fillEach) fillEach.forEach((c) => K.svg('circle', { cx: c.cx, cy: c.cy, r: c.r, fill: 'var(--accent)', 'fill-opacity': '0.07' }, fillG));
    else K.svg('path', { d: fillD, fill: 'var(--accent)', 'fill-opacity': '0.16', 'fill-rule': 'evenodd' }, fillG);
    const glowG = K.svg('g', { filter: `url(#${fl.id})`, opacity: '0' }, grp);
    const baseG = K.svg('g', { fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, grp);
    const dotG = K.svg('g', {}, grp);
    const tipDot = K.svg('circle', { r: 9, fill: 'var(--accent-hi)', opacity: '0' }, grp);
    const els = lines.map((l) => {
      const mk = (parent, attrs) => K.svg('path', { d: l.d, pathLength: '1', fill: 'none', ...attrs }, parent);
      const gl = mk(glowG, { stroke: 'var(--accent)', 'stroke-width': '12', 'stroke-dasharray': '1 2', 'stroke-dashoffset': '1', opacity: '0' });
      const b = mk(baseG, { stroke: 'var(--ink)', 'stroke-width': '4', 'stroke-dasharray': '1 2', 'stroke-dashoffset': '1', opacity: '0' });
      const tip = mk(baseG, { stroke: 'var(--accent-hi)', 'stroke-width': '5', 'stroke-dasharray': '0.07 2', 'stroke-dashoffset': '0.07', opacity: '0' });
      const dot = l.dot ? K.svg('circle', { cx: l.dot[0], cy: l.dot[1], r: 8, fill: 'var(--ink)', opacity: '0' }, dotG) : null;
      return { gl, b, tip, dot, len: b.getTotalLength ? 0 : 0 };
    });
    // path lengths for the pen dot are read lazily on first frame (layout needed)
    let lens = null;

    // sound
    if (all) { snd.add(t1, 'key', 0.1); snd.add(t1 + span * 0.35, 'key', 0.08); snd.add(t1 + span * 0.7, 'key', 0.08); }
    else for (let i = 0; i < L; i++) snd.add(start(i), 'key', 0.1);
    snd.add(closeT, 'plink', 0.34);

    return {
      sfx: snd.list,
      end: Math.max(closeT + 1.4, p.t0 + p.dur) + 1,
      frame(t) {
        if (!lens) lens = els.map((e) => { try { return e.b.getTotalLength(); } catch (x) { return 1; } });
        const show = K.ease(K.prog(t, p.t0 - 0.2, 0.5));
        svg.style.opacity = String(show);
        const rotA = 0.02 * (t - p.t0), after = K.prog(t, closeT, 1);
        const breath = 1 + (t > closeT ? 0.012 * Math.sin((t - closeT) * 1.3) * K.ease(after) : 0) + 0.02 * K.inout(K.prog(t, p.t0, p.dur));
        const [dx, dy] = K.drift(t, p.seed, 5);
        grp.setAttribute('transform', `translate(${f2(dx)} ${f2(dy)}) rotate(${f2((rotA * 180) / Math.PI)}) scale(${breath.toFixed(4)})`);
        let tipShown = false;
        els.forEach((e, i) => {
          const pr = K.inout(K.prog(t, start(i), ld)), live = pr > 0 && pr < 1;
          const off = String(1 - pr);
          e.b.setAttribute('stroke-dashoffset', off); e.gl.setAttribute('stroke-dashoffset', off);
          e.b.setAttribute('opacity', pr > 0 ? '1' : '0'); e.gl.setAttribute('opacity', pr > 0 ? '1' : '0');
          e.tip.setAttribute('stroke-dashoffset', String(-(pr - 0.07)));
          e.tip.setAttribute('opacity', live ? '1' : '0');
          if (live && !tipShown && lens[i]) { const q = e.b.getPointAtLength(pr * lens[i]); tipDot.setAttribute('cx', q.x); tipDot.setAttribute('cy', q.y); tipDot.setAttribute('opacity', '0.9'); tipShown = true; }
          if (e.dot) { const dp = K.spring(K.prog(t, start(i), 0.5)); e.dot.setAttribute('opacity', dp > 0 ? '1' : '0'); e.dot.setAttribute('r', f2(8 * dp)); e.dot.setAttribute('fill', t > closeT && t < closeT + 0.6 ? 'var(--accent-hi)' : 'var(--ink)'); }
        });
        if (!tipShown) tipDot.setAttribute('opacity', '0');
        const fp = p.fill ? K.ease(K.prog(t, closeT, 1.0)) : 0;
        fillG.setAttribute('opacity', f2(fp));
        glowG.setAttribute('opacity', f2(0.1 + 0.4 * (live1(t) ) + 0.12 * Math.sin(t * 1.4) * after + 0.2 * after));
        const pp = K.prog(t, closeT, 1.1);
        pulse.setAttribute('opacity', pp > 0 && pp < 1 ? f2(0.5 * (1 - pp)) : '0');
        pulse.setAttribute('r', f2(R * (0.9 + 0.35 * K.ease(pp))));
        function live1(tt) { return tt < closeT ? K.clamp((tt - t1) / span) * 0.5 : 0.5 * (1 - K.prog(tt, closeT, 1.2)); }
      },
    };
  };
})();
