// Particle field: grains of light drift, gather into a shape or a word, then scatter.
// params: count (1400), target ('circle' | 'word' | 'none'), text (word target, Latin or Arabic),
//         gatherAt, scatterAt (shares of dur), drift (px amplitude multiplier)
// Each grain's position is a pure function of t: seeded start + sine drift, eased to its target and away again.
(function () {
  const K = window.Kit;
  const parse = (s) => {
    s = (s || '').trim();
    if (s[0] === '#') { let h = s.slice(1); if (h.length === 3) h = h.replace(/./g, '$&$&'); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
    const m = s.match(/[\d.]+/g) || [0, 0, 0]; return [+m[0], +m[1], +m[2]];
  };
  const sprites = {};
  const glow = (c) => {
    const key = c.join();
    if (sprites[key]) return sprites[key];
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const x = cv.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},1)`); g.addColorStop(0.35, `rgba(${c[0]},${c[1]},${c[2]},.5)`); g.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},0)`);
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    return (sprites[key] = cv);
  };

  window.Screens.particleField = function (root, params) {
    const p = K.params(params, { count: 1400, target: 'circle', text: '', gatherAt: 0.1, scatterAt: 0.62, drift: 1, dur: 6 });
    const N = Math.max(0, Math.min(40000, Math.floor(p.count) || 0));
    const snd = K.sounds(p);
    const lay = K.layer(root, 1);
    const cv = K.el('canvas', { attrs: { width: '1080', height: '1920' }, style: { position: 'absolute', left: '0', top: '0', width: '1080px', height: '1920px' } }, lay);
    const ctx = cv.getContext('2d');
    const r = K.rng(p.seed * 7 + 3);
    // per grain constants (seeded)
    const sx = new Float32Array(N), sy = new Float32Array(N), A1 = new Float32Array(N), W1 = new Float32Array(N), P1 = new Float32Array(N), A2 = new Float32Array(N), W2 = new Float32Array(N), P2 = new Float32Array(N);
    const sz = new Float32Array(N), al = new Float32Array(N), dl = new Float32Array(N), dl2 = new Float32Array(N), arc = new Float32Array(N), da = new Float32Array(N), dd = new Float32Array(N), ac = new Uint8Array(N), jx = new Float32Array(N), jy = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      sx[i] = -60 + r() * 1200; sy[i] = 120 + r() * 1700;
      A1[i] = (14 + r() * 40) * p.drift; W1[i] = 0.25 + r() * 0.5; P1[i] = r() * 6.28; A2[i] = (8 + r() * 22) * p.drift; W2[i] = 0.5 + r() * 0.8; P2[i] = r() * 6.28;
      sz[i] = 2.2 + r() * r() * 4; al[i] = 0.35 + 0.5 * r(); dl[i] = r(); dl2[i] = r(); arc[i] = (r() - 0.5) * 2; da[i] = r() * 6.283; dd[i] = 260 + r() * 520; ac[i] = r() < 0.2 ? 1 : 0; jx[i] = (r() - 0.5) * 4; jy[i] = (r() - 0.5) * 4;
    }
    // targets (relative to the stage centre, before scale)
    const tx = new Float32Array(N), ty = new Float32Array(N);
    let built = false;
    const isAr = /[؀-ۿ]/.test(p.text || '');
    const fam = isAr ? 'Scheherazade' : 'Baskerville, "Libre Baskerville", Georgia, serif';
    if (p.target === 'word' && isAr && document.fonts) document.fonts.load('200px Scheherazade', p.text);
    const build = () => {
      if (built) return;
      if (p.target === 'circle') {
        const q = K.rng(p.seed * 13 + 5);
        for (let i = 0; i < N; i++) {
          if (q() < 0.72) { const a = q() * 6.283, rr = 320 + (q() + q() - 1) * 7; tx[i] = rr * Math.cos(a); ty[i] = rr * Math.sin(a); }
          else { const a = q() * 6.283, rr = 320 * Math.sqrt(q()) * 0.97; tx[i] = rr * Math.cos(a); ty[i] = rr * Math.sin(a); }
        }
        built = true;
      } else if (p.target === 'word' && p.text) {
        if (document.fonts && !document.fonts.check(`200px ${fam}`, p.text)) return; // font not ready yet; retry next frame
        const W = 1000, H = 600, oc = document.createElement('canvas'); oc.width = W; oc.height = H;
        const o = oc.getContext('2d'); o.textAlign = 'center'; o.textBaseline = 'alphabetic'; o.direction = isAr ? 'rtl' : 'ltr';
        o.font = `200px ${fam}`; const w = o.measureText(p.text).width;
        const size = Math.min(isAr ? 340 : 280, Math.floor((200 * 860) / Math.max(1, w)));
        o.font = `${size}px ${fam}`; o.fillStyle = '#fff'; o.fillText(p.text, W / 2, H / 2 + size * 0.28);
        const d = o.getImageData(0, 0, W, H).data, pts = [];
        for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) if (d[(y * W + x) * 4 + 3] > 140) pts.push(x - W / 2, y - H / 2);
        const M = pts.length / 2;
        if (M) {
          const idx = new Uint32Array(M); for (let i = 0; i < M; i++) idx[i] = i;
          const q = K.rng(p.seed * 17 + 9);
          for (let i = M - 1; i > 0; i--) { const j = Math.floor(q() * (i + 1)), tmp = idx[i]; idx[i] = idx[j]; idx[j] = tmp; }
          for (let i = 0; i < N; i++) { const m = idx[i % M]; tx[i] = pts[m * 2] + jx[i] * (i >= M ? 1.5 : 0.4); ty[i] = pts[m * 2 + 1] + jy[i] * (i >= M ? 1.5 : 0.4); }
        }
        built = true;
      }
    };
    if (p.target === 'word' && document.fonts) document.fonts.ready.then(() => { try { build(); } catch (e) { /* retry in frame */ } });

    const gd = 0.26 * p.dur, sd = 0.28 * p.dur;
    const tg = p.t0 + p.gatherAt * p.dur, tsc = p.t0 + p.scatterAt * p.dur;
    const hasT = p.target === 'circle' || (p.target === 'word' && !!p.text);
    if (hasT) { snd.add(tg, 'bong', 0.14); }

    return {
      sfx: snd.list,
      end: Math.max(tsc + sd, p.t0 + p.dur) + 1,
      frame(t) {
        const cs = getComputedStyle(root), col = (n) => parse(cs.getPropertyValue(n));
        const ink = col('--ink'), quiet = col('--quiet'), hi = col('--accent-hi'), accent = col('--accent');
        ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, 1080, 1920);
        const show = K.ease(K.prog(t, p.t0 - 0.2, 0.9));
        if (show <= 0 || N === 0) return;
        if (hasT) build();
        const ready = hasT && built;
        const sIn = glow(ink), sQ = glow(quiet), sA = glow(hi);
        ctx.globalCompositeOperation = 'lighter';
        const S = p.scale, ox = p.x, oy = p.y, bre = 1 + 0.006 * Math.sin(t * 1.2);
        for (let i = 0; i < N; i++) {
          const dx = A1[i] * Math.sin(W1[i] * t + P1[i]) + A2[i] * Math.sin(W2[i] * t + P2[i]);
          const dy = A1[i] * Math.cos(W1[i] * t * 0.9 + P2[i]) + A2[i] * Math.sin(W2[i] * t * 1.1 + P1[i]);
          let x = sx[i], y = sy[i], g = 0, sc = 0;
          if (ready) {
            g = K.inout(K.prog(t, tg + dl[i] * 0.4 * gd, gd * 0.6));
            sc = K.inout(K.prog(t, tsc + dl2[i] * 0.35 * sd, sd * 0.65));
            const X = ox + tx[i] * S * bre, Y = oy + ty[i] * S * bre;
            const arcK = Math.sin(Math.PI * g) * arc[i] * 160;
            const ddx = X - sx[i], ddy = Y - sy[i], dlen = Math.hypot(ddx, ddy) || 1;
            x = sx[i] + ddx * g - (ddy / dlen) * arcK * (1 - sc);
            y = sy[i] + ddy * g + (ddx / dlen) * arcK * (1 - sc);
            if (sc > 0) { x = x + (Math.cos(da[i]) * dd[i]) * sc; y = y + (Math.sin(da[i]) * dd[i]) * sc; }
          }
          const gv = g * (1 - sc), df = 1 - 0.93 * gv;
          x += dx * df; y += dy * df;
          const size = sz[i] * (1 - 0.18 * gv) * 3.2 * S;
          let a = al[i] * (1 + 0.55 * gv) * (1 - 0.55 * sc) * show;
          if (ac[i] && gv > 0.01) {
            ctx.globalAlpha = Math.min(1, a * gv); ctx.drawImage(sA, x - size, y - size, size * 2, size * 2);
            ctx.globalAlpha = Math.min(1, a * (1 - gv)); ctx.drawImage(sIn, x - size, y - size, size * 2, size * 2);
          } else {
            ctx.globalAlpha = Math.min(1, a); ctx.drawImage(i % 3 ? sIn : sQ, x - size, y - size, size * 2, size * 2);
          }
        }
        ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      },
    };
  };
})();
