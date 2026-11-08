// Orbit rings: small bodies circle a lit centre on thin rings. Rings can slow to a stop in turn.
// params: rings [{r, count, speed (rad/s)}], centre ('dot' | 'word' | 'none'), centreText,
//         tilt (0 flat .. 1 strongly tilted ellipses, far bodies dimmer and smaller),
//         settleAt (share of dur when the rings start to slow to a stop, one after another; null = never)
// Body angle is an analytic integral of a smooth speed curve, so frame(t) is a pure function of t.
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
    const cv = document.createElement('canvas'); cv.width = cv.height = 128;
    const x = cv.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},1)`); g.addColorStop(0.3, `rgba(${c[0]},${c[1]},${c[2]},.38)`); g.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},0)`);
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    return (sprites[key] = cv);
  };

  window.Screens.orbitRings = function (root, params) {
    const p = K.params(params, {
      rings: [{ r: 200, count: 3, speed: 1.1 }, { r: 320, count: 5, speed: -0.8 }, { r: 440, count: 8, speed: 0.55 }],
      centre: 'dot', centreText: '', tilt: 0.55, settleAt: null, dur: 6,
    });
    const snd = K.sounds(p);
    const lay = K.layer(root, 1);
    const cv = K.el('canvas', { attrs: { width: '1080', height: '1920' }, style: { position: 'absolute', left: '0', top: '0', width: '1080px', height: '1920px' } }, lay);
    const ctx = cv.getContext('2d');
    const rings = (p.rings || []).map((r, i) => ({ r: r.r, count: Math.max(0, Math.floor(r.count)), speed: r.speed == null ? 0.5 : r.speed, off: K.hash(p.seed, i) * 6.283 }));
    const RAMP = 1.5, DOUT = 1.6, TRAIL = 14, DT = 0.034;
    const hasSettle = p.settleAt != null;
    const ts = (i) => Math.max(RAMP + 0.1, p.settleAt * p.dur + i * 0.6); // relative to t0
    // analytic integral of the speed curve: smooth ramp up, steady, smooth slow down
    const G = (tau) => tau <= 0 ? 0 : tau < RAMP ? RAMP * (Math.pow(tau / RAMP, 3) - Math.pow(tau / RAMP, 4) / 2) : RAMP * 0.5 + (tau - RAMP);
    const OUT = (u) => { if (u <= 0) return 0; const y = Math.min(1, u / DOUT); return DOUT * (y - (y * y * y - y * y * y * y / 2)); };
    const integral = (i, t) => { const tau = t - p.t0; if (!hasSettle) return G(tau); const s = ts(i); return G(Math.min(tau, s)) + (tau > s ? OUT(tau - s) : 0); };
    const angle = (ring, i, k, t) => ring.off + (ring.count ? (6.283 * k) / ring.count : 0) + ring.speed * integral(i, t);

    const isAr = /[؀-ۿ]/.test(p.centreText || '');
    const wordFont = isAr ? 'Scheherazade' : 'Baskerville, "Libre Baskerville", Georgia, serif';
    if (p.centre === 'word' && isAr && document.fonts) document.fonts.load('60px Scheherazade', p.centreText);

    snd.add(p.t0, 'bong', 0.16);
    if (hasSettle) rings.forEach((r, i) => snd.add(p.t0 + ts(i) + DOUT, 'plink', 0.28));
    const lastSettle = hasSettle && rings.length ? p.t0 + ts(rings.length - 1) + DOUT : p.t0 + p.dur;

    return {
      sfx: snd.list,
      end: Math.max(p.t0 + p.dur, lastSettle) + 1,
      frame(t) {
        const cs = getComputedStyle(root), col = (n) => parse(cs.getPropertyValue(n));
        const ink = col('--ink'), quiet = col('--quiet'), accent = col('--accent'), hi = col('--accent-hi');
        const css = (c) => `rgb(${c[0]},${c[1]},${c[2]})`;
        ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, 1080, 1920);
        const show = K.ease(K.prog(t, p.t0 - 0.3, 0.7));
        if (show <= 0) return;
        const [dx, dy] = K.drift(t, p.seed, 4), br = 1 + 0.012 * Math.sin(t * 0.9);
        const S = p.scale * br, ey = 1 - 0.62 * p.tilt, rot = -0.2 * p.tilt;
        const base = () => ctx.setTransform(S, 0, 0, S, p.x + dx, p.y + dy);

        // collect bodies and their depth
        const bodies = [];
        rings.forEach((ring, i) => {
          const grow = K.ease(K.prog(t, p.t0 - 0.2 + i * 0.25, 1.0)), rr = ring.r * (0.7 + 0.3 * grow);
          ring._rr = rr; ring._grow = grow;
          const flash = hasSettle ? 1 - K.prog(t, p.t0 + ts(i) + DOUT, 1.0) : 0, settled = hasSettle && t >= p.t0 + ts(i) + DOUT;
          ring._flash = settled ? flash : 0;
          for (let k = 0; k < ring.count; k++) {
            const a = angle(ring, i, k, t), d = Math.sin(a);
            bodies.push({ ring, i, k, a, d, rr, grow });
          }
        });

        // rings
        base(); ctx.rotate(rot);
        rings.forEach((ring) => {
          ctx.beginPath(); ctx.ellipse(0, 0, ring._rr, ring._rr * ey, 0, 0, 6.283);
          ctx.strokeStyle = css(quiet); ctx.globalAlpha = 0.22 * ring._grow * show; ctx.lineWidth = 2 / 1; ctx.stroke();
          if (ring._flash > 0) { ctx.strokeStyle = css(hi); ctx.globalAlpha = 0.55 * ring._flash * show; ctx.lineWidth = 3; ctx.stroke(); }
        });

        const drawBodies = (front) => {
          base(); ctx.rotate(rot);
          for (const b of bodies) {
            if ((b.d >= 0) !== front) continue;
            const depth = p.tilt * b.d, sz = (9 + 1.5 * (b.ring.r > 380 ? 0.3 : 0)) * (1 + 0.38 * depth);
            const al = (0.6 + 0.4 * (0.5 + 0.5 * b.d * (p.tilt > 0 ? 1 : 0)) * (p.tilt > 0 ? 1 : 0.8)) * b.grow * show;
            for (let m = TRAIL; m >= 0; m--) {
              const a = m ? angle(b.ring, b.i, b.k, t - m * DT) : b.a;
              const x = b.rr * Math.cos(a), y = b.rr * ey * Math.sin(a);
              const f = 1 - m / (TRAIL + 1), s = sz * (m ? 0.35 + 0.65 * f : 1);
              ctx.globalCompositeOperation = 'lighter';
              ctx.globalAlpha = m ? al * 0.5 * f * f : al * 0.55;
              const g = m ? s * 2.4 : s * 4.2;
              ctx.drawImage(glow(ink), x - g, y - g, g * 2, g * 2);
              if (!m && b.ring._flash > 0) { ctx.globalAlpha = 0.8 * b.ring._flash * show; ctx.drawImage(glow(accent), x - g * 2, y - g * 2, g * 4, g * 4); }
              ctx.globalCompositeOperation = 'source-over';
              if (!m) { ctx.globalAlpha = al; ctx.fillStyle = css(b.ring._flash > 0.2 ? hi : ink); ctx.beginPath(); ctx.arc(x, y, s * 0.62, 0, 6.283); ctx.fill(); }
            }
          }
        };
        drawBodies(false);

        // centre
        base();
        const rise = K.ease(K.prog(t, p.t0, 1.2)), pulse = 1 + 0.06 * Math.sin(t * 1.7);
        let kick = 0;
        if (hasSettle) { kick = 0; rings.forEach((r, i) => { const u = K.prog(t, p.t0 + ts(i) + DOUT, 0.7); if (u > 0 && u < 1) kick = Math.max(kick, 1 - u); }); }
        if (p.centre !== 'none') {
          const R = Math.max(1, rings.length ? rings[0].r : 160);
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = (0.55 + 0.3 * kick) * rise * show * (0.9 + 0.1 * Math.sin(t * 1.3));
          const gs = R * (0.9 + 0.25 * kick) * pulse;
          ctx.drawImage(glow(accent), -gs, -gs, gs * 2, gs * 2);
          ctx.globalCompositeOperation = 'source-over';
          const ph = (t * 0.22) % 1;
          ctx.globalAlpha = 0.28 * (1 - ph) * rise * show; ctx.strokeStyle = css(accent); ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(0, 0, 24 + ph * R * 0.9, 0, 6.283); ctx.stroke();
          if (p.centre === 'word' && p.centreText) {
            let size = 150; ctx.font = `${size}px ${wordFont}`;
            const maxW = Math.max(120, (rings.length ? rings[0].r : 200) * 1.6), w = ctx.measureText(p.centreText).width;
            if (w > maxW) { size = Math.max(24, Math.floor((size * maxW) / w)); ctx.font = `${size}px ${wordFont}`; }
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.direction = isAr ? 'rtl' : 'ltr';
            ctx.globalAlpha = rise * show; ctx.fillStyle = css(kick > 0.05 ? hi : ink);
            ctx.fillText(p.centreText, 0, 0);
          } else {
            ctx.globalAlpha = rise * show; ctx.fillStyle = css(hi);
            ctx.beginPath(); ctx.arc(0, 0, 15 * pulse * (1 + 0.5 * kick), 0, 6.283); ctx.fill();
          }
        }
        drawBodies(true);
        ctx.globalAlpha = 1; ctx.setTransform(1, 0, 0, 1, 0, 0);
      },
    };
  };
})();
