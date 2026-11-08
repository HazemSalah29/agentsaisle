// figure.js: the ink stick figure. A blank white circle head (FACELESS by default: no eyes, no nose, no mouth),
// ink stick body, little mitts for hands. The beanie and scarf are an optional costume, off by default.
// Poses are joint positions in head-radius units (y up = negative), feet on y = 0.
// Needs ink.js. Ink.figure(ctx, x, y, s, opts) returns info for relightHead and for light sources in the hands.
(function (g) {
  const Ink = g.Ink, { lerp, hash, noise1, mix, stroke, shape, ellipsePts, quad } = Ink;

  const BASE = {
    head: [0, -6.1], neck: [0, -5.0], hip: [0, -2.75],
    eL: [-0.72, -3.6], hL: [-0.82, -2.6], eR: [0.72, -3.6], hR: [0.82, -2.6],
    kL: [-0.3, -1.4], fL: [-0.55, 0], kR: [0.3, -1.4], fR: [0.55, 0], tilt: 0,
  };
  const P = (o) => ({ ...BASE, ...o });
  const POSES = {
    stand: P({}),
    standMug: P({ eR: [0.85, -3.45], hR: [0.62, -3.95] }),
    standMugSip: P({ eR: [0.7, -3.9], hR: [0.3, -4.9], tilt: -0.05 }),
    holdCandle: P({ eR: [0.75, -3.45], hR: [0.42, -3.7] }),
    arms: P({ eL: [-0.95, -3.4], hL: [-1.4, -2.9], eR: [0.95, -3.4], hR: [1.4, -2.9] }),
    shrug: P({ eL: [-0.9, -3.3], hL: [-1.25, -4.0], eR: [0.9, -3.3], hR: [1.25, -4.0] }),
    sit: P({ head: [0, -5.05], neck: [0, -3.95], hip: [0, -1.95], eL: [-0.75, -2.7], hL: [-0.7, -1.95], eR: [0.75, -2.7], hR: [0.7, -1.95], kL: [-0.55, -1.75], fL: [-0.65, 0], kR: [0.55, -1.75], fR: [0.65, 0] }),
    sitPhone: P({ head: [0, -4.95], neck: [0, -3.95], hip: [0, -1.95], eL: [-0.7, -2.55], hL: [-0.18, -2.95], eR: [0.7, -2.55], hR: [0.18, -2.95], kL: [-0.55, -1.75], fL: [-0.65, 0], kR: [0.55, -1.75], fR: [0.65, 0], tilt: 0.08 }),
    reachHigh: P({ eR: [0.9, -5.0], hR: [1.15, -6.0], eL: [-0.9, -5.0], hL: [-1.0, -6.0], tilt: -0.05 }),
    hug: P({ eL: [-0.6, -3.4], hL: [0.2, -3.6], eR: [0.6, -3.4], hR: [-0.2, -3.4] }),
    // seated, leaning forward to push up off the seat (between sit and stand)
    rise: P({ head: [0.25, -5.6], neck: [0.15, -4.5], hip: [-0.1, -2.35], eL: [-0.75, -3.2], hL: [-0.6, -2.2], eR: [0.75, -3.2], hR: [0.6, -2.2], kL: [-0.45, -1.6], fL: [-0.6, 0], kR: [0.45, -1.6], fR: [0.6, 0], tilt: 0.1 }),
  };
  /** blend two poses: u 0..1 */
  function mixPose(a, b, u) {
    const o = {};
    for (const k of Object.keys(BASE)) o[k] = k === 'tilt' ? lerp(a[k] ?? 0, b[k] ?? 0, u) : [lerp(a[k][0], b[k][0], u), lerp(a[k][1], b[k][1], u)];
    return o;
  }
  /** a walking pose at phase ph (cycles; one step is half a cycle): feet lift in turn, arms swing, the body bobs */
  function walkPose(ph) {
    const sL = Math.sin(ph * Math.PI * 2), sR = -sL, up = (v) => Math.max(0, v);
    const bob = -0.09 * Math.abs(Math.cos(ph * Math.PI * 2));
    return P({
      head: [0.04 * sL, -6.1 + bob], neck: [0.03 * sL, -5.0 + bob], hip: [0, -2.75 + bob * 0.7],
      eL: [-0.78, -3.55 + bob], hL: [-0.8 - 0.1 * sR, -2.65 + 0.28 * sL + bob], eR: [0.78, -3.55 + bob], hR: [0.8 + 0.1 * sL, -2.65 + 0.28 * sR + bob],
      fL: [-0.5 + 0.28 * sL, -0.62 * up(sL)], kL: [-0.32 + 0.2 * sL, -1.4 - 0.5 * up(sL)],
      fR: [0.5 + 0.28 * sR, -0.62 * up(sR)], kR: [0.32 + 0.2 * sR, -1.4 - 0.5 * up(sR)],
      tilt: 0.03 * sL,
    });
  }

  function limb(ctx, A, M, B, w, seed) {
    // a gentle curve through the joint
    const c = [2 * M[0] - (A[0] + B[0]) / 2, 2 * M[1] - (A[1] + B[1]) / 2];
    stroke(ctx, quad(A, c, B, 10), { w, seed, amp: 0.6, taper: 0.8, press: 0.2, step: 4 });
  }

  /**
   * Draw the figure. x,y = feet on the floor (px). s = px per head radius (a 1.6 m figure is about 7.1 head radii tall).
   * o: pose (object or name), t (s), seed, flip (mirror), alpha, lw (line weight, head-radius fraction), look [-1..1, -1..1] (eyes only),
   *    faceless (default true: blank head, no eyes), facing 'front'|'back',
   *    beanie (false | true | colour), scarf (false | true | colour)   // costume, off by default
   *    props {R:'mug'|'candle'|'phone', L:...}, wrap (blanket colour), blink (0..1), eyeSize.
   * returns { flames, screens, face: {x,y,r,tilt}, hands: {L, R}, ... } (for relightHead and for lights placed in the hands)
   */
  function figure(ctx, x, y, s, o = {}) {
    const t = o.t ?? 0, seed = o.seed ?? 1, pal = Ink.pal;
    const faceless = o.faceless !== false;
    const pose = typeof o.pose === 'string' ? POSES[o.pose] : o.pose || POSES.stand;
    const flip = o.flip ? -1 : 1;
    const breath = Math.sin(t * 1.7 + seed) * 0.045;
    const J = {};
    for (const k of Object.keys(BASE)) {
      if (k === 'tilt') continue;
      const up = ['head', 'neck', 'eL', 'hL', 'eR', 'hR'].includes(k) ? breath : 0;
      J[k] = [x + pose[k][0] * s * flip, y + (pose[k][1] + up) * s];
    }
    const tilt = (pose.tilt ?? 0) * flip + (o.tilt ?? 0) + Math.sin(t * 0.6 + seed * 2) * 0.012;
    const lw = Math.max(1.4, s * (o.lw ?? 0.13));
    const out = { flames: [], screens: [], face: null, hands: { L: J.hL, R: J.hR } };
    const facingBack = o.facing === 'back';
    const scarfCol = o.scarf === true ? pal.concrete : o.scarf;
    const beanieCol = o.beanie === true ? pal.mustard : o.beanie;

    ctx.save();
    ctx.globalAlpha *= o.alpha ?? 1;
    // ---- legs + shoes + torso ----
    if (!o.wrap) {
      limb(ctx, J.hip, J.kL, J.fL, lw, seed + 1);
      limb(ctx, J.hip, J.kR, J.fR, lw, seed + 2);
      for (const [f, k, sg] of [[J.fL, J.kL, -1], [J.fR, J.kR, 1]]) {
        const dir = (f[0] - k[0] >= 0 ? 1 : -1) * 0.6 + sg * flip * 0.4;
        shape(ctx, ellipsePts(f[0] + dir * s * 0.16, f[1] - s * 0.06, s * 0.26, s * 0.12), { fill: o.shoe || '#3A332E', w: lw * 0.7, seed: seed + 5 + sg });
      }
      stroke(ctx, quad(J.neck, [(J.neck[0] + J.hip[0]) / 2 + s * 0.04 * flip, (J.neck[1] + J.hip[1]) / 2], J.hip, 8), { w: lw * 1.05, seed: seed + 3, amp: 0.5, taper: 0.85 });
      // arms
      for (const side of ['L', 'R']) {
        const E = side === 'L' ? J.eL : J.eR, Hh = side === 'L' ? J.hL : J.hR;
        limb(ctx, [J.neck[0], J.neck[1] + s * 0.38], E, Hh, lw * 0.95, seed + (side === 'L' ? 7 : 8));
      }
    }

    // ---- blanket wrap ----
    if (o.wrap) {
      const hx = J.head[0], hy = J.head[1];
      const blank = [];
      blank.push(...quad([hx - s * 0.9, hy + s * 0.3], [hx - s * 1.6, hy + s * 1.6], [hx - s * 2.0, y - s * 0.05], 10));
      blank.push(...quad([hx - s * 2.0, y - s * 0.05], [hx, y + s * 0.35], [hx + s * 2.0, y - s * 0.05], 10));
      blank.push(...quad([hx + s * 2.0, y - s * 0.05], [hx + s * 1.6, hy + s * 1.6], [hx + s * 0.9, hy + s * 0.3], 10));
      blank.push(...quad([hx + s * 0.9, hy + s * 0.3], [hx, hy - s * 0.25], [hx - s * 0.9, hy + s * 0.3], 10));
      shape(ctx, blank, { fill: o.wrap, w: lw, seed: seed + 30 });
      stroke(ctx, quad([hx - s * 0.3, hy + s * 1.2], [hx - s * 0.6, hy + s * 2.6], [hx - s * 0.9, y - s * 0.3], 8), { w: lw * 0.6, seed: seed + 31, alpha: 0.7 });
      stroke(ctx, quad([hx + s * 0.5, hy + s * 1.4], [hx + s * 0.7, hy + s * 2.7], [hx + s * 1.2, y - s * 0.4], 8), { w: lw * 0.6, seed: seed + 32, alpha: 0.7 });
    }

    // ---- scarf (costume) ----
    if (scarfCol && !o.wrap) {
      const nx = J.neck[0], ny = J.neck[1] + s * 0.05;
      shape(ctx, ellipsePts(nx, ny, s * 0.62, s * 0.24), { fill: scarfCol, w: lw * 0.75, seed: seed + 11 });
      const side = (facingBack ? -0.25 : 0.25) * (o.props && o.props.R ? -1 : 1);
      const tail = [[nx + s * side * flip - s * 0.16, ny + s * 0.1], [nx + s * (side + 0.05) * flip - s * 0.17, ny + s * 1.45], [nx + s * (side + 0.05) * flip + s * 0.17, ny + s * 1.5], [nx + s * side * flip + s * 0.18, ny + s * 0.12]];
      shape(ctx, tail, { fill: mix(scarfCol, '#8f8676', 0.25), w: lw * 0.7, seed: seed + 12 });
      for (let k = 0; k < 4; k++) { const fx = lerp(tail[1][0], tail[2][0], (k + 0.5) / 4); stroke(ctx, [[fx, tail[1][1] + s * 0.02], [fx + s * 0.02, tail[1][1] + s * 0.2]], { w: lw * 0.45, seed: seed + 40 + k }); }
    }

    // ---- props in hands (drawn over the arms) ----
    for (const side of ['L', 'R']) {
      const prop = o.props && o.props[side]; if (!prop) continue;
      const Hh = side === 'L' ? J.hL : J.hR;
      if (prop === 'mug') {
        const mw = s * 0.4, mh = s * 0.44, mx = flip > 0 ? Hh[0] - mw * 0.12 : Hh[0] - mw * 0.88, my = Hh[1] - mh * 0.62;
        shape(ctx, [[mx, my], [mx + mw, my], [mx + mw * 0.96, my + mh], [mx + mw * 0.04, my + mh]], { fill: '#D9D3C7', w: lw * 0.7, seed: seed + 50 });
        stroke(ctx, ellipsePts(mx + mw + s * 0.06 * flip, my + mh * 0.45, s * 0.1, s * 0.14, -Math.PI / 2, Math.PI / 2), { w: lw * 0.6, seed: seed + 51 });
        for (let k = 0; k < 2; k++) {
          const ph = t * 0.9 + k * 0.5, a = 0.45 * Math.sin(Math.PI * (ph % 1));
          const sx = mx + mw * (0.35 + 0.3 * k), sy = my - s * 0.15 - (ph % 1) * s * 0.4;
          stroke(ctx, [[sx, sy], [sx + s * 0.08 * Math.sin(ph * 6), sy - s * 0.2], [sx - s * 0.05, sy - s * 0.42]], { w: lw * 0.4, seed: seed + 60 + k, alpha: a, color: '#E8E1D4' });
        }
      } else if (prop === 'candle') {
        const cw = s * 0.26, ch = s * 0.46, cx = Hh[0], cy = Hh[1] - s * 0.05;
        shape(ctx, ellipsePts(cx, cy + s * 0.08, s * 0.38, s * 0.1), { fill: '#9C8E76', w: lw * 0.6, seed: seed + 70 });
        shape(ctx, [[cx - cw / 2, cy - ch], [cx + cw / 2, cy - ch], [cx + cw / 2, cy + s * 0.05], [cx - cw / 2, cy + s * 0.05]], { fill: '#EDE4D0', w: lw * 0.6, seed: seed + 71 });
        stroke(ctx, [[cx, cy - ch], [cx + s * 0.01, cy - ch - s * 0.1]], { w: lw * 0.4, seed: seed + 72 });
        out.flames.push({ x: cx, y: cy - ch - s * 0.08, s: s * 0.95 });
      } else if (prop === 'phone') {
        const pw = s * 0.5, ph = s * 0.85, cx = Hh[0] + (side === 'L' ? s * 0.2 : -s * 0.2) * flip, cy = Hh[1] - s * 0.15;
        shape(ctx, [[cx - pw / 2, cy - ph / 2], [cx + pw / 2, cy - ph / 2], [cx + pw / 2, cy + ph / 2], [cx - pw / 2, cy + ph / 2]], { fill: '#2E2A2A', w: lw * 0.6, seed: seed + 80, round: s * 0.08 });
        out.screens.push([[cx - pw * 0.4, cy - ph * 0.42], [cx + pw * 0.4, cy - ph * 0.42], [cx + pw * 0.4, cy + ph * 0.42], [cx - pw * 0.4, cy + ph * 0.42]]);
      }
    }
    // hands (little mitts)
    if (!o.wrap) for (const Hh of [J.hL, J.hR]) shape(ctx, ellipsePts(Hh[0], Hh[1], s * 0.15, s * 0.15), { fill: o.hands || '#F3EEE6', w: lw * 0.6, seed: seed + 90 + Hh[0] });

    // ---- head ----
    const hx = J.head[0], hy = J.head[1];
    ctx.save(); ctx.translate(hx, hy); ctx.rotate(tilt);
    shape(ctx, ellipsePts(0, 0, s, s), { fill: pal.face, w: lw * 0.95, seed: seed + 100 });
    out.face = { x: hx, y: hy, r: s, tilt };
    if (!faceless && !facingBack) drawEyes(ctx, s, o, t, seed);
    if (beanieCol) drawBeanie(ctx, s, lw, seed, facingBack, beanieCol);
    ctx.restore();
    ctx.restore();
    out.eyes = !faceless && !facingBack;
    out.beanie = !!beanieCol;
    out.opts = { s, lw, seed, o, t };
    return out;
  }

  function drawEyes(ctx, s, o, t, seed) {
    const look = o.look || [0, 0];
    const lx = look[0] * s * 0.32, ly = look[1] * s * 0.2;
    let blink = o.blink;
    if (blink == null) { const per = 3.3 + hash(seed, 3) * 1.6, ph = (t + hash(seed, 4) * per) % per; blink = ph < 0.13 ? Math.sin((ph / 0.13) * Math.PI) : 0; }
    const size = o.eyeSize ?? 1;
    const ry = s * 0.125 * size * Math.max(0.12, 1 - blink), rx = s * 0.095 * size;
    const ey = s * 0.2 + ly;
    ctx.save(); ctx.fillStyle = Ink.pal.ink;
    for (const sx of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sx * s * 0.34 + lx, ey, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }

  function drawBeanie(ctx, s, lw, seed, back, col) {
    const dome = [], top = -1.32;
    for (let i = 0; i <= 22; i++) {
      const a = Math.PI + (i / 22) * Math.PI;
      const r = 1.06 + 0.04 * Math.sin(i * 0.9);
      dome.push([Math.cos(a) * s * r, -s * 0.32 + Math.sin(a) * s * (-top - 0.32) * 1.0 + (i === 11 ? -s * 0.02 : 0)]);
    }
    shape(ctx, dome, { fill: col, w: lw * 0.95, seed: seed + 120 });
    stroke(ctx, quad([-s * 0.55, -s * 0.42], [-s * 0.45, -s * 0.95], [-s * 0.05, -s * 1.22], 8), { w: lw * 0.55, seed: seed + 121, alpha: 0.65 });
    stroke(ctx, quad([s * 0.35, -s * 0.45], [s * 0.45, -s * 0.85], [s * 0.2, -s * 1.15], 8), { w: lw * 0.45, seed: seed + 122, alpha: 0.4 });
    const cuffTop = back ? -0.3 : -0.36, cuffBot = back ? 0.1 : 0.02;
    const cuff = [
      ...quad([-s * 1.1, s * cuffTop], [0, s * (cuffTop + 0.1)], [s * 1.1, s * cuffTop], 10),
      ...quad([s * 1.08, s * cuffBot], [0, s * (cuffBot + 0.12)], [-s * 1.08, s * cuffBot], 10),
    ];
    shape(ctx, cuff, { fill: mix(col, '#1a1410', 0.15), w: lw * 0.9, seed: seed + 123, round: s * 0.08 });
    for (let k = -5; k <= 5; k++) {
      const u = k / 5.6, xx = u * s * 1.0, bow = (1 - u * u) * 0.1;
      stroke(ctx, [[xx, s * (cuffTop + 0.06 + bow * 0.6)], [xx * 1.01, s * (cuffBot - 0.05 + bow)]], { w: lw * 0.4, seed: seed + 130 + k, alpha: 0.55 });
    }
  }

  /**
   * after lighting: re-whiten the head so it stays the only pure white in the frame.
   * Faceless: the whole head (or its lower part under a beanie). With eyes: the lower face, then the eyes again.
   */
  function relightHead(ctx, info, amt = 0.85) {
    if (!info || !info.face || amt <= 0) return;
    const { x, y, r, tilt } = info.face; const { s, seed, o, t } = info.opts;
    ctx.save(); ctx.translate(x, y); ctx.rotate(tilt); ctx.globalAlpha = amt;
    ctx.beginPath(); ctx.rect(-r * 1.2, info.beanie ? -r * 0.02 : -r * 1.3, r * 2.4, info.beanie ? r * 1.3 : r * 2.6); ctx.clip();
    ctx.fillStyle = Ink.pal.face; ctx.beginPath(); ctx.ellipse(0, 0, r * 0.93, r * 0.93, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    if (info.eyes) drawEyes(ctx, s, o, t, seed);
    ctx.restore();
  }

  Object.assign(Ink, { POSES, mixPose, walkPose, figure, relightHead });
  void noise1;
})(typeof window !== 'undefined' ? window : globalThis);
