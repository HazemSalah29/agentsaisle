// Dot grid fill: a grid of dots lights one by one (or in waves) until the count is full.
// The grid is the subject. A big count sits above it; the last dots fill, then one light
// sweeps through, and any missing cells are ringed in the accent.
// params: cols, rows, fill (lit count), order ('row'|'spiral'|'random'|'wave'), rate (dots per
//   second, null = fit dur), shape ('dot'|'bead'|'square'), missing (cell indices that stay dim), label
(function () {
  const K = window.Kit;

  // visiting order of every cell index, before missing cells are removed
  function makeOrder(kind, cols, rows, seed) {
    const idx = Array.from({ length: cols * rows }, (_, i) => i);
    if (kind === 'random') {
      const r = K.rng(seed * 7 + 3);
      for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
      return idx;
    }
    if (kind === 'spiral') {
      const out = []; let t = 0, b = rows - 1, l = 0, rt = cols - 1;
      while (t <= b && l <= rt) {
        for (let c = l; c <= rt; c++) out.push(t * cols + c);
        for (let r = t + 1; r <= b; r++) out.push(r * cols + rt);
        if (t < b) for (let c = rt - 1; c >= l; c--) out.push(b * cols + c);
        if (l < rt) for (let r = b - 1; r > t; r--) out.push(r * cols + l);
        t++; b--; l++; rt--;
      }
      return out;
    }
    if (kind === 'wave') {
      const key = (i) => (i % cols) + 2.4 * Math.sin(Math.floor(i / cols) * 0.55) + Math.floor(i / cols) * 0.001;
      return idx.sort((a, b) => key(a) - key(b));
    }
    return idx; // row
  }

  window.Screens.dotGrid = function (root, params) {
    const p = K.params(params, { cols: 21, rows: 18, fill: 365, order: 'row', rate: null, shape: 'dot', missing: [], label: '', dur: 3.5 });
    const cols = Math.max(1, Math.min(60, Math.floor(p.cols) || 1)), rows = Math.max(1, Math.min(60, Math.floor(p.rows) || 1)), N = cols * rows;
    const miss = new Set((p.missing || []).filter((i) => i >= 0 && i < N));
    const seq = makeOrder(p.order, cols, rows, p.seed).filter((i) => !miss.has(i)).slice(0, Math.max(0, Math.floor(p.fill) || 0));
    const n = seq.length, snd = K.sounds(p);

    // when each cell lights
    const span = Math.max(0.2, p.dur - 0.4), tc = new Float64Array(N).fill(Infinity), times = [];
    seq.forEach((cell, k) => {
      const x = n > 1 ? k / (n - 1) : 0;
      const tk = p.rate ? p.t0 + k / p.rate : p.t0 + span * (1 - Math.pow(1 - x, 1.35));
      tc[cell] = tk; times.push(tk);
    });
    const tEnd = n ? times[n - 1] : p.t0 + p.dur;

    // sound: one tick per row-sized group, never more than about 11 per second, a soft bell2 at the end
    let lastTick = -1;
    for (let k = 0; k < n; k++) {
      if ((k + 1) % cols === 0 || k === n - 1) {
        if (times[k] - lastTick >= 0.09) { snd.add(times[k], 'tick', 0.12 + 0.14 * (k / n)); lastTick = times[k]; }
      }
    }
    if (n) snd.add(tEnd + 0.15, 'bell2', 0.4);

    // layout: [count] [grid] [label], block centred on the stage origin, grid never taller than 960
    const cs = Math.min(110, 840 / cols, 960 / rows), gw = cs * cols, gh = cs * rows;
    const numH = 140, gap = 40, labH = p.label ? 70 : 0, block = numH + gap + gh + labH, top = -block / 2;
    const numY = top + numH / 2, gridCy = top + numH + gap + gh / 2, labY = gridCy + gh / 2 + 50;
    const pad = 60, CW = Math.ceil(gw + pad * 2), CH = Math.ceil(gh + pad * 2), Q = 2;

    const stage = K.stage(root, p);
    const num = K.el('div', { text: '0', style: { position: 'absolute', left: '0', top: numY + 'px', transform: 'translate(-50%,-50%)', fontFamily: 'var(--serif, Baskerville, serif)', fontSize: '150px', lineHeight: '1', color: 'var(--ink)', fontVariantNumeric: 'tabular-nums lining-nums', letterSpacing: '-0.02em', whiteSpace: 'nowrap' } }, stage);
    const mb = K.motionBlur(num, true);
    const cv = K.el('canvas', { attrs: { width: String(CW * Q), height: String(CH * Q) }, style: { position: 'absolute', left: -CW / 2 + 'px', top: gridCy - CH / 2 + 'px', width: CW + 'px', height: CH + 'px' } }, stage);
    const g = cv.getContext('2d');
    const lab = p.label ? K.el('div', { text: p.label, style: { position: 'absolute', left: '0', top: labY + 'px', transform: 'translate(-50%,-50%)', fontSize: '32px', letterSpacing: '.3em', textTransform: 'uppercase', color: 'var(--quiet)', whiteSpace: 'nowrap' } }, stage) : null;

    const countAt = (t) => { let c = 0; while (c < n && times[c] <= t) c++; return c; };
    const shapePath = (cx, cy, r) => {
      g.beginPath();
      if (p.shape === 'square') { const s = r * 0.92, rr = s * 0.28; g.roundRect(cx - s, cy - s, s * 2, s * 2, rr); } else g.arc(cx, cy, r, 0, Math.PI * 2);
    };

    return {
      sfx: snd.list,
      end: tEnd + 1.7,
      frame(t) {
        const cssv = getComputedStyle(root);
        const C = (k) => cssv.getPropertyValue(k).trim() || '#888';
        const ink = C('--ink'), dim = C('--dim'), quiet = C('--quiet'), acc = C('--accent'), hi = C('--accent-hi');
        const show = K.ease(K.prog(t, p.t0 - 0.5, 0.5));
        const [dx, dy] = K.drift(t, p.seed, 3);
        const ramp = K.prog(t, tEnd + 0.8, 1.0); // ripple of life after the fill
        const sweep = K.prog(t, tEnd + 0.1, 1.2) * (cols + rows + 8) - 4;

        g.setTransform(Q, 0, 0, Q, 0, 0);
        g.clearRect(0, 0, CW, CH);
        for (let i = 0; i < N; i++) {
          const col = i % cols, row = (i / cols) | 0, cx = pad + (col + 0.5) * cs, cy = pad + (row + 0.5) * cs;
          // the socket: always there, breathing a little
          const appear = K.ease(K.prog(t, p.t0 - 0.5 + (col + row) / (cols + rows) * 0.3, 0.35));
          g.globalAlpha = show * appear * (0.42 + 0.1 * Math.sin(t * 0.9 + (col + row) * 0.3));
          g.fillStyle = dim; shapePath(cx, cy, cs * 0.12); g.fill();
          const age = t - tc[i];
          if (age >= 0) {
            const s = K.spring(age / 0.42);
            const rip = 1 + 0.045 * ramp * Math.sin(t * 1.3 + (col + row) * 0.38);
            const r = cs * 0.29 * Math.max(0, s) * rip;
            const wave = Math.max(0, 1 - Math.abs(col + row - sweep) / 3.2) * (t > tEnd ? 1 : 0);
            const live = Math.max(K.clamp(1 - age / 0.8), wave * 0.9);
            g.globalAlpha = show;
            if (p.shape === 'bead') {
              g.save(); g.shadowColor = 'rgba(0,0,0,0.35)'; g.shadowBlur = cs * 0.2; g.shadowOffsetY = cs * 0.09;
              const gr = g.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r);
              gr.addColorStop(0, ink); gr.addColorStop(1, quiet);
              g.fillStyle = gr; shapePath(cx, cy, r); g.fill(); g.restore();
            } else { g.fillStyle = ink; shapePath(cx, cy, r); g.fill(); }
            if (live > 0.01) {
              g.save(); g.globalAlpha = show * live; g.shadowColor = acc; g.shadowBlur = 26 * live;
              g.fillStyle = hi; shapePath(cx, cy, r * (1 + 0.1 * live)); g.fill(); g.restore();
            }
          } else if (miss.has(i) && t > tEnd + 0.3) {
            // a missing cell: a thin accent ring, so the gaps are read as the point
            const e = K.ease(K.prog(t, tEnd + 0.3, 0.6));
            g.globalAlpha = show * e * (0.55 + 0.35 * Math.sin(t * 2.2 + i));
            g.strokeStyle = acc; g.lineWidth = 2.5; shapePath(cx, cy, cs * (0.2 + 0.08 * e)); g.stroke();
          }
        }
        g.globalAlpha = 1;

        // the count above
        const c = countAt(t), rate = countAt(t + 1 / 30) - c, done = t >= tEnd && n > 0;
        num.textContent = String(c);
        mb(done ? 0 : Math.min(8, rate * 0.5));
        const pop = done ? 1 + 0.07 * (1 - K.spring(K.prog(t, tEnd, 0.6))) : 1;
        num.style.color = done ? 'var(--accent-hi)' : 'var(--ink)';
        num.style.opacity = String(show);
        num.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(${pop})`;
        cv.style.transform = `translate(${dx * 0.6}px, ${dy * 0.6}px) scale(${1 + 0.012 * Math.sin(t * 0.7)})`;
        cv.style.opacity = '1';
        if (lab) K.up(lab, t, p.t0 + 0.1, 0.7);
      },
    };
  };
})();
