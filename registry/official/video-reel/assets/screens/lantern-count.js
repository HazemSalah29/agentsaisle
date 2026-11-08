// Lantern count: a count shown as lanterns that light, never a ring or bars.
// in the hall, keep y about 1000 so the counter and label stay inside the safe area.
// mode 'hall': the camera flies down a hall while lanterns light ahead of it, left and right in turn.
//   A counter climbs. Each miss stays a dark lantern with a small label; the flight slows past the first miss.
// mode 'strings': strings of small lanterns with the same number on each string. Each group lights in turn,
//   so a bigger count is more strings (57 = 3 strings of 19, 114 = 6), never a longer row into the distance.
// params: mode ('hall'|'strings'), total, misses [lantern numbers], missLabels {n: text}, label,
//   groups [{label, n, arabic}], perString (19), dur
// First built for Names of Allah part 1.
(function () {
  const K = window.Kit;

  // one hanging lantern at (x, y), scale s, light L in [0, 1]
  function lantern(g, x, y, s, L, t, i, C, cord = 400) {
    const fl = 0.85 + 0.15 * Math.sin(t * 7 + i) * Math.sin(t * 3.1 + i * 2);
    g.save(); g.translate(x, y); g.scale(s, s);
    g.strokeStyle = C.dim; g.lineWidth = 2;
    g.beginPath(); g.moveTo(0, -cord); g.lineTo(0, -8); g.stroke();
    if (L > 0) {
      const gr = g.createRadialGradient(0, 10, 0, 0, 10, 80);
      gr.addColorStop(0, C.acc); gr.addColorStop(1, 'transparent');
      g.globalAlpha = 0.6 * fl * L; g.fillStyle = gr; g.beginPath(); g.arc(0, 10, 80, 0, Math.PI * 2); g.fill();
    }
    g.globalAlpha = L > 0 ? 0.35 + 0.65 * fl * L : 1;
    g.fillStyle = L > 0 ? C.hi : C.deep;
    g.beginPath(); g.moveTo(-10, -8); g.lineTo(10, -8); g.lineTo(15, 6); g.lineTo(10, 28); g.lineTo(-10, 28); g.lineTo(-15, 6); g.closePath(); g.fill();
    g.globalAlpha = 1; g.strokeStyle = C.dim; g.lineWidth = 1.5; g.stroke();
    g.restore();
  }

  window.Screens.lanternCount = function (root, params) {
    const p = K.params(params, { mode: 'hall', total: 114, misses: [], missLabels: {}, label: '', groups: [], perString: 19, dur: 6 });
    const snd = K.sounds(p), layer = K.layer(root, 2);
    const cv = K.el('canvas', { attrs: { width: '1080', height: '1920' }, style: { position: 'absolute', left: '0', top: '0', width: '1080px', height: '1920px' } }, layer);
    const g = cv.getContext('2d');
    const txt = (text, y, css) => K.el('div', { text, style: { position: 'absolute', left: p.x + 'px', top: y + 'px', transform: 'translate(-50%,-50%)', whiteSpace: 'nowrap', color: 'var(--ink)', fontFamily: 'var(--serif, Baskerville, serif)', ...css } }, layer);
    const colors = () => { const s = getComputedStyle(root), v = (k) => s.getPropertyValue(k).trim() || '#888'; return { acc: v('--accent'), hi: v('--accent-hi'), dim: v('--dim'), deep: v('--deep'), lift: v('--lift'), ink: v('--ink'), quiet: v('--quiet') }; };

    if (p.mode === 'strings') return strings();

    // ---- hall ----
    const N = Math.max(1, Math.floor(p.total) || 1), miss = new Set(p.misses), m = p.misses.length ? Math.min(...p.misses) : 0;
    const t1 = p.t0 + p.dur;
    // the lit front: how many lanterns are lit at t (fast, slow past the first miss, then racing to the end)
    const front = (t) => {
      const u = K.prog(t, p.t0, p.dur);
      if (!m) return N * K.inout(u);
      if (u < 0.18) return (m - 0.6) * K.inout(u / 0.18);
      if (u < 0.4) return K.lerp(m - 0.6, m + 1.2, (u - 0.18) / 0.22);
      const v = (u - 0.4) / 0.6; return K.lerp(m + 1.2, N, v * v * (1.6 - 0.6 * v));
    };
    const countAt = (t) => { const f = Math.floor(front(t)); let c = 0; for (let i = 1; i <= f; i++) if (!miss.has(i)) c++; return c; };
    // sound: ticks on the last three counts, a bell when it lands
    const lastAt = (k) => { let lo = p.t0, hi = t1; for (let j = 0; j < 30; j++) { const mid = (lo + hi) / 2; if (front(mid) >= k) hi = mid; else lo = mid; } return hi; };
    [N - 2, N - 1].forEach((k) => snd.add(lastAt(k), 'tick', 0.2));
    snd.add(t1 + 0.1, 'bell2', 0.35);

    const num = txt('0', p.y - 570, { fontSize: '150px', lineHeight: '1', fontVariantNumeric: 'tabular-nums lining-nums' });
    const lab = p.label ? txt(p.label, p.y - 690, { fontSize: '30px', letterSpacing: '.3em', textTransform: 'uppercase', color: 'var(--accent)', fontFamily: 'Menlo, monospace' }) : null;
    const mb = K.motionBlur(num, true);
    const FX = 560, FY = 800, NEAR = 0.4, ZB = 18, LZ = (i) => 1.6 + i * 0.62;

    return {
      sfx: snd.list, end: t1 + 1.5,
      frame(t) {
        const C = colors(), show = K.ease(K.prog(t, p.t0 - 0.5, 0.5)), s = front(t), Zc = Math.max(0, LZ(s) - 6.2);
        const P = (x, y, z) => [p.x + x * FX / (z - Zc), p.y - y * FY / (z - Zc)];
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 1080, 1920); g.globalAlpha = show;
        // floor and the pillar lines of both walls, repeating so the flight never ends
        const a = P(-1, -1, Zc + NEAR), b = P(1, -1, Zc + NEAR), c = P(1, -1, Zc + ZB), d = P(-1, -1, Zc + ZB);
        const quad = (q, f) => { g.fillStyle = f; g.beginPath(); g.moveTo(...q[0]); q.slice(1).forEach((v) => g.lineTo(...v)); g.fill(); };
        const z0 = Zc + NEAR, z1 = Zc + ZB;
        quad([P(-1, 1.25, z0), P(1, 1.25, z0), P(1, 1.25, z1), P(-1, 1.25, z1)], C.deep);
        quad([P(-1, -1, z0), P(-1, 1.25, z0), P(-1, 1.25, z1), P(-1, -1, z1)], C.lift);
        quad([P(1, -1, z0), P(1, 1.25, z0), P(1, 1.25, z1), P(1, -1, z1)], C.lift);
        quad([a, b, c, d], C.deep);
        g.strokeStyle = C.dim; g.lineWidth = 2;
        for (let k = Math.floor((Zc - 1.05) / 0.9); k < Math.floor((Zc - 1.05) / 0.9) + 24; k++) {
          const z = 1.05 + k * 0.9; if (z - Zc <= NEAR || z - Zc >= ZB) continue;
          g.globalAlpha = show * (1 - (z - Zc) / ZB);
          for (const x of [-1, 1]) { const q = P(x, -1, z), r = P(x, 1.25, z); g.beginPath(); g.moveTo(...q); g.lineTo(...r); g.stroke(); }
        }
        // lanterns, far to near
        for (let i = N; i >= 1; i--) {
          const z = LZ(i); if (z - Zc < 1.6 || z - Zc > ZB) continue;
          const q = P(i % 2 ? -0.52 : 0.52, 0.5, z), L = miss.has(i) ? 0 : K.clamp(s - i + 1);
          g.globalAlpha = show; lantern(g, q[0], q[1], 2.8 / (z - Zc), L, t, i, C);
          if (miss.has(i) && z - Zc < 9 && p.missLabels[i]) {
            g.fillStyle = C.ink; g.globalAlpha = show * 0.85; g.textAlign = 'center';
            g.font = `${K.clamp(110 / (z - Zc), 18, 34)}px Menlo, monospace`; g.fillText(`${i} · ${p.missLabels[i]}`, q[0], q[1] + 360 / (z - Zc));
          }
        }
        g.globalAlpha = 1;
        const n = countAt(t), done = t >= t1;
        num.textContent = String(n);
        mb(done ? 0 : Math.min(8, (countAt(t + 1 / 30) - n) * 0.6));
        num.style.opacity = String(show);
        num.style.color = done ? 'var(--accent-hi)' : 'var(--ink)';
        if (lab) lab.style.opacity = String(show);
      },
    };

    // ---- strings ----
    function strings() {
      const per = Math.max(1, Math.floor(p.perString) || 19), G = p.groups;
      const nStr = G.map((x) => Math.ceil(x.n / per)), S = nStr.reduce((a, b) => a + b, 0) + Math.max(0, G.length - 1);
      const sx = Math.min(80, 900 / Math.max(1, S)), gap = Math.min(46, 820 / per), top = p.y - 360;
      // x of every string, one empty slot between groups
      let slot = 0; const xs = nStr.map((k) => { const out = []; for (let j = 0; j < k; j++) out.push(p.x + (slot++ - (S - 1) / 2) * sx); slot++; return out; });
      // timing: groups light one after another, each in proportion to its count
      const pause = 0.4, sum = G.reduce((a, x) => a + x.n, 0) || 1, avail = Math.max(1, p.dur - 1 - pause * (G.length - 1));
      let tt = p.t0; const win = G.map((x) => { const w = [tt, avail * x.n / sum]; tt += w[1] + pause; return w; });
      win.forEach(([a, d]) => snd.add(a + d, 'tick', 0.22));
      const tEnd = win.length ? win[win.length - 1][0] + win[win.length - 1][1] : p.t0;
      snd.add(tEnd + 0.15, 'bell2', 0.35);
      const lit = (k, t) => G[k].n * K.inout(K.prog(t, win[k][0], win[k][1]));
      const mid = (k) => (xs[k][0] + xs[k][xs[k].length - 1]) / 2;
      const heads = G.map((x, k) => txt(x.label, top - 170, { left: mid(k) + 'px', fontFamily: x.arabic ? "Scheherazade, 'Scheherazade New', serif" : 'var(--serif, Baskerville, serif)', fontSize: x.arabic ? '72px' : '40px', color: 'var(--accent-hi)', direction: x.arabic ? 'rtl' : 'ltr' }));
      const nums = G.map((x, k) => txt('0', top - 80, { left: mid(k) + 'px', fontSize: '64px', fontVariantNumeric: 'tabular-nums lining-nums' }));
      const lab = p.label ? txt(p.label, Math.min(top + per * gap + 30, 1480), { fontSize: '52px', fontStyle: 'italic', color: 'var(--ink)' }) : null;

      return {
        sfx: snd.list, end: tEnd + 1.7,
        frame(t) {
          const C = colors(), show = K.ease(K.prog(t, p.t0 - 0.5, 0.5));
          g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 1080, 1920);
          G.forEach((x, k) => {
            const n = lit(k, t);
            xs[k].forEach((x0, j) => {
              const m = K.clamp(n - j * per, 0, per), cnt = Math.min(per, x.n - j * per);
              g.globalAlpha = show; g.strokeStyle = C.dim; g.lineWidth = 2;
              g.beginPath(); g.moveTo(x0, top - 300); g.lineTo(x0, top - 14); g.stroke();
              for (let i = 0; i < cnt; i++) {
                const y = top + i * gap, x1 = x0 + Math.sin(t * 1.1 + j * 1.7 + k) * 4 * (i / (per - 1 || 1));
                g.globalAlpha = show; lantern(g, x1, y, 0.62, K.clamp(m - i), t, i + j * per + k * 999, C, i ? gap / 0.62 - 28 : 0);
              }
            });
            nums[k].textContent = String(Math.floor(n));
            nums[k].style.opacity = String(show * (t >= win[k][0] - 0.3 ? 1 : 0.35));
            heads[k].style.opacity = String(show);
          });
          g.globalAlpha = 1;
          if (lab) K.up(lab, t, tEnd + 0.3, 0.7);
        },
      };
    }
  };
})();
