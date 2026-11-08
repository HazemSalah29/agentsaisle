// Shape morph: one outline turns into the next, point for point (a lamp becomes a crescent becomes a door).
// params: shapes [SVG path string | [[x, y], ...] closed point list, two or more],
//         at [absolute start time of each morph] (default: t0 + (i + 1) * hold + i * move), hold 1.3, move 1.0 (seconds; used when spring is false),
//         spring {zeta, f} from motion.js for a little overshoot (default zeta 0.6, f 2.2; false = plain ease over `move`),
//         fill true (soft) | 'solid' | false, stroke width 6 (0 = none), N points 240, size 560 (longest side of each shape, px).
// Each shape is resampled to N points by arc length; the next shape's winding and start point are chosen to minimise travel, so nothing twists.
// Use single closed outlines (one subpath, ends with Z). Shapes are centred and fitted to `size`, so sizes need not match.
// One soft 'slide' sound per morph (sound.md has no whoosh type in Kit.TYPES; a page can swap it for kit:whoosh-slow-soft).
// Screens.shapeMorph.shapes holds demo outlines: lamp, crescent, door, drop, leaf (no six-pointed stars).
(function () {
  const K = window.Kit;
  const f1 = (v) => (Math.round(v * 10) / 10).toString();
  const SVG_NS = 'http://www.w3.org/2000/svg';

  // N points spaced by arc length along a closed point list
  function fromPoints(pts, N) {
    const q = pts.concat([pts[0]]), cum = [0];
    for (let i = 1; i < q.length; i++) cum.push(cum[i - 1] + Math.hypot(q[i][0] - q[i - 1][0], q[i][1] - q[i - 1][1]));
    const L = cum[cum.length - 1], out = []; let j = 0;
    for (let i = 0; i < N; i++) {
      const d = (i / N) * L; while (j < q.length - 2 && cum[j + 1] < d) j++;
      const u = cum[j + 1] > cum[j] ? (d - cum[j]) / (cum[j + 1] - cum[j]) : 0;
      out.push([K.lerp(q[j][0], q[j + 1][0], u), K.lerp(q[j][1], q[j + 1][1], u)]);
    }
    return out;
  }
  // N points spaced by arc length along an SVG path (measured by the browser)
  function fromPath(d, N, host) {
    const path = document.createElementNS(SVG_NS, 'path'); path.setAttribute('d', d); host.appendChild(path);
    const L = path.getTotalLength(), out = [];
    for (let i = 0; i < N; i++) { const q = path.getPointAtLength((i / N) * L); out.push([q.x, q.y]); }
    host.removeChild(path);
    return out;
  }
  // centre on the bounding box and fit the longest side to `size`
  function fit(pts, size) {
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const [x, y] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    const s = size / Math.max(x1 - x0, y1 - y0, 1e-6), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    return pts.map(([x, y]) => [(x - cx) * s, (y - cy) * s]);
  }
  const area = (pts) => { let a = 0; for (let i = 0; i < pts.length; i++) { const [x, y] = pts[i], [u, v] = pts[(i + 1) % pts.length]; a += x * v - u * y; } return a; };
  // reverse B if it winds the other way, then rotate its start to the shift with the least total squared travel from A
  function align(A, B) {
    if (area(A) * area(B) < 0) B = B.slice().reverse();
    const N = A.length; let best = 0, bestC = Infinity;
    for (let s = 0; s < N; s++) {
      let c = 0; for (let i = 0; i < N; i++) { const b = B[(i + s) % N], a = A[i]; c += (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2; if (c >= bestC) break; }
      if (c < bestC) { bestC = c; best = s; }
    }
    return B.map((_, i) => B[(i + best) % N]);
  }
  // smooth closed outline through the midpoints of the point ring (quadratic curves)
  function outline(pts) {
    const n = pts.length, mid = (i, j) => [(pts[i][0] + pts[j][0]) / 2, (pts[i][1] + pts[j][1]) / 2];
    let m = mid(n - 1, 0), d = 'M' + f1(m[0]) + ' ' + f1(m[1]);
    for (let i = 0; i < n; i++) { m = mid(i, (i + 1) % n); d += 'Q' + f1(pts[i][0]) + ' ' + f1(pts[i][1]) + ' ' + f1(m[0]) + ' ' + f1(m[1]); }
    return d + 'Z';
  }

  window.Screens.shapeMorph = function (root, params) {
    const p = K.params(params, { shapes: [], N: 240, size: 560, fill: true, stroke: 6, hold: 1.3, move: 1.0, spring: { zeta: 0.6, f: 2.2 }, dur: 6 });
    if (!p.shapes || p.shapes.length < 2) throw new Error('shapeMorph needs two or more shapes');
    const snd = K.sounds(p), stage = K.stage(root, p), M = window.Motion, m = p.shapes.length - 1;
    const svg = K.svg('svg', { width: '1000', height: '1000', viewBox: '-500 -500 1000 1000', style: 'position:absolute;left:-500px;top:-500px;overflow:visible' }, stage);
    const grp = K.svg('g', {}, svg);

    // geometry, once: resample, fit, align each shape to the one before it
    const Q = [];
    p.shapes.forEach((sh, i) => {
      const pts = fit(typeof sh === 'string' ? fromPath(sh, p.N, svg) : fromPoints(sh, p.N), p.size);
      Q.push(i ? align(Q[i - 1], pts) : pts);
    });
    const at = (p.at && p.at.length >= m) ? p.at : Array.from({ length: m }, (_, i) => p.t0 + (i + 1) * p.hold + i * p.move);
    const useSpring = p.spring && M && M.spring;
    const w = (t, i) => (useSpring ? M.spring(t - at[i], p.spring.zeta, p.spring.f) : K.inout(K.prog(t, at[i], p.move)));
    at.forEach((a) => snd.add(a, 'slide', 0.1));

    const st = p.stroke, solid = p.fill === 'solid';
    const fillP = p.fill ? K.svg('path', { fill: 'var(--accent)', 'fill-opacity': solid ? '0.9' : '0.16' }, grp) : null;
    const glowP = st ? K.svg('path', { fill: 'none', stroke: 'var(--accent)', 'stroke-width': st * 3, 'stroke-opacity': '0.2', 'stroke-linejoin': 'round' }, grp) : null;
    const lineP = st ? K.svg('path', { fill: 'none', stroke: 'var(--ink)', 'stroke-width': st, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, grp) : null;

    return {
      sfx: snd.list,
      end: Math.max(at[m - 1] + (useSpring ? 1.4 : p.move + 0.6) + 1, p.t0 + p.dur),
      frame(t) {
        svg.style.opacity = String(K.ease(K.prog(t, p.t0 - 0.2, 0.5)));
        const pts = Q[0].map((q, k) => {
          let x = q[0], y = q[1];
          for (let i = 0; i < m; i++) { const u = w(t, i); x += (Q[i + 1][k][0] - Q[i][k][0]) * u; y += (Q[i + 1][k][1] - Q[i][k][1]) * u; }
          return [x, y];
        });
        const d = outline(pts);
        if (fillP) fillP.setAttribute('d', d);
        if (glowP) glowP.setAttribute('d', d);
        if (lineP) {
          lineP.setAttribute('d', d);
          let moving = false; for (let i = 0; i < m; i++) { const u = w(t, i), r = t - at[i]; if (r > 0 && r < 0.9 && u > 0.02 && u < 0.98) moving = true; }
          lineP.setAttribute('stroke', moving ? 'var(--accent-hi)' : 'var(--ink)');
        }
        const [dx, dy] = K.drift(t, p.seed, 5);
        grp.setAttribute('transform', 'translate(' + f1(dx) + ' ' + f1(dy) + ') scale(' + (1 + 0.02 * K.inout(K.prog(t, p.t0, p.dur))).toFixed(4) + ')');
      },
    };
  };

  // demo outlines (one closed subpath each, any size)
  window.Screens.shapeMorph.shapes = {
    lamp: 'M100 10 C112 10 118 20 118 30 L118 44 L150 44 C170 70 176 110 160 150 C152 170 140 178 128 184 L128 196 L72 196 L72 184 C60 178 48 170 40 150 C24 110 30 70 50 44 L82 44 L82 30 C82 20 88 10 100 10 Z',
    crescent: 'M120 20 A90 90 0 1 0 180 150 A72 72 0 1 1 120 20 Z',
    door: 'M50 190 L50 90 C50 40 150 40 150 90 L150 190 Z',
    drop: 'M100 10 C130 60 165 100 165 138 C165 176 135 196 100 196 C65 196 35 176 35 138 C35 100 70 60 100 10 Z',
    leaf: 'M30 180 C20 90 80 20 180 20 C190 120 130 190 30 180 Z',
  };
})();
