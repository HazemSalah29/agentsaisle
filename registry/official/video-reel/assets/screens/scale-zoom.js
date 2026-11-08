// Scale zoom-out: the camera pulls back from one small thing until it is one cell of something bigger,
// then of something bigger still. Each level is drawn at its own scale; the camera eases on a log scale.
// params: levels [{label, kind:'dot'|'grid'|'rings', n (cells, grid/rings)}], speed (zoom pace), holdAt (share of dur when the
// zoom has finished and the last level holds)
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
    g.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},1)`); g.addColorStop(0.35, `rgba(${c[0]},${c[1]},${c[2]},.45)`); g.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},0)`);
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    return (sprites[key] = cv);
  };

  window.Screens.scaleZoom = function (root, params) {
    const p = K.params(params, {
      levels: [{ label: 'one deed', kind: 'dot' }, { label: 'a day', kind: 'grid', n: 48 }, { label: 'a month', kind: 'grid', n: 30 }, { label: 'a year', kind: 'grid', n: 365 }, { label: 'a lifetime', kind: 'rings', n: 5 }],
      speed: 1, holdAt: 0.8, dur: 7,
    });
    const snd = K.sounds(p), stage = K.stage(root, p);
    const levels = (p.levels || []).filter(Boolean), L = levels.length;
    const lay = K.layer(root, 1);
    const cv = K.el('canvas', { attrs: { width: '1080', height: '1920' }, style: { position: 'absolute', left: '0', top: '0', width: '1080px', height: '1920px' } }, lay);
    const ctx = cv.getContext('2d');

    // layouts, in each level's own pixels, centred on (0,0). cells: [x, y, dia, tone]; hl = highlighted cell index
    const info = levels.map((lv, j) => {
      const kind = lv.kind || 'dot', o = { kind, cells: [], rings: [], hx: 0, hy: 0, cell: 140, ext: 140 };
      if (kind === 'grid') {
        const n = Math.max(1, Math.floor(lv.n || 30)), cols = Math.max(1, Math.round(Math.sqrt(n * 0.78))), rows = Math.ceil(n / cols), pitch = Math.min(720 / cols, 760 / rows);
        const hl = Math.floor(n * 0.37);
        for (let i = 0; i < n; i++) o.cells.push([((i % cols) - (cols - 1) / 2) * pitch, (Math.floor(i / cols) - (rows - 1) / 2) * pitch, pitch * 0.62, 0.3 + 0.4 * K.hash(p.seed, j, i)]);
        o.hl = hl; o.hx = o.cells[hl][0]; o.hy = o.cells[hl][1]; o.cell = pitch * 0.62; o.ext = Math.max(cols * pitch, rows * pitch);
      } else if (kind === 'rings') {
        const nr = Math.max(2, Math.floor(lv.n || 5)); o.ext = 720;
        for (let k = 0; k < nr; k++) {
          const rr = (360 * (k + 1)) / nr, cnt = Math.round(7 * (k + 1) * 1.4);
          o.rings.push(rr);
          for (let i = 0; i < cnt; i++) { const a = (i / cnt) * 6.283 + k * 0.7; o.cells.push([rr * Math.cos(a), rr * Math.sin(a), 8, 0.3 + 0.4 * K.hash(p.seed, j, k, i)]); }
        }
        o.hl = Math.min(o.cells.length - 1, Math.floor(o.cells.length * 0.55)); o.cells[o.hl][2] = 26; o.hx = o.cells[o.hl][0]; o.hy = o.cells[o.hl][1]; o.cell = 26;
      } else { o.kind = 'dot'; o.ext = 140; o.cell = 112; }
      return o;
    });
    // world placement: m = world size of one layout pixel, C = world position of the level's centre
    const m = [], C = [];
    info.forEach((o, j) => {
      if (j === 0) { m.push(1); C.push([0, 0]); return; }
      const mj = (info[j - 1].ext * m[j - 1]) / o.cell; m.push(mj);
      C.push([C[j - 1][0] - o.hx * mj, C[j - 1][1] - o.hy * mj]);
    });

    // labels
    const labs = levels.map((lv) => K.el('div', { text: lv.label || '', style: { position: 'absolute', left: '-440px', top: '540px', width: '880px', textAlign: 'center', fontSize: '34px', letterSpacing: '.32em', textTransform: 'uppercase', color: 'var(--quiet)', whiteSpace: 'nowrap', opacity: '0' } }, stage));

    // timing
    const T0 = p.t0 + 0.5, T1 = T0 + Math.max(0.5, (p.holdAt * p.dur - 0.5) / Math.max(0.1, p.speed)), segs = Math.max(1, L - 1), segLen = (T1 - T0) / segs;
    const zAt = (t) => {
      if (L < 2) return 0;
      const x = K.prog(t, T0, T1 - T0) * segs, i = Math.min(Math.floor(x), segs - 1);
      return i + K.inout(K.clamp((x - i - 0.18) / 0.64));
    };
    for (let i = 0; i < L - 1; i++) snd.add(T0 + i * segLen + 0.18 * segLen, 'slide', 0.22);

    return {
      sfx: snd.list,
      end: Math.max(T1, p.t0 + p.dur) + 1,
      frame(t) {
        const cs = getComputedStyle(root), col = (n) => parse(cs.getPropertyValue(n));
        const ink = col('--ink'), accent = col('--accent'), hi = col('--accent-hi');
        const css = (c) => `rgb(${c[0]},${c[1]},${c[2]})`;
        ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, 1080, 1920);
        const show = K.ease(K.prog(t, p.t0 - 0.2, 0.7));
        if (!L || show <= 0) { labs.forEach((l) => (l.style.opacity = '0')); return; }
        const z = zAt(t), i0 = L > 1 ? Math.min(Math.floor(z), L - 2) : 0, f = L > 1 ? z - i0 : 0;
        let mc, cam;
        if (L > 1) {
          const rj = info[i0 + 1].cell / info[i0].ext, v = f, u = v * Math.pow(rj, 1 - f);
          mc = m[i0 + 1] * Math.pow(rj, 1 - f);
          cam = [C[i0][0] + (C[i0 + 1][0] - C[i0][0]) * u, C[i0][1] + (C[i0 + 1][1] - C[i0][1]) * u];
        } else { mc = 1; cam = [0, 0]; }
        const [dx, dy] = K.drift(t, p.seed, 5), br = 1 + 0.012 * Math.sin(t * 0.8), roll = 0.02 * Math.sin(t * 0.37);
        const S = p.scale * br;
        const bx0 = -p.x / S - 80, bx1 = (1080 - p.x) / S + 80, by0 = -p.y / S - 80, by1 = (1920 - p.y) / S + 80;
        ctx.setTransform(S, 0, 0, S, p.x + dx, p.y + dy); ctx.rotate(roll);
        const tw = (k) => 0.88 + 0.12 * Math.sin(t * 1.3 + k);
        levels.forEach((lv, j) => {
          const d = z - j, a = d < 0 ? K.clamp(1 + d * 1.5) : K.clamp(1 - d * 1.5);
          const lab = labs[j]; const la = K.clamp(1 - Math.abs(d) * 2.6) * show;
          lab.style.opacity = String(la); lab.style.transform = `translateY(${(1 - la) * 14}px)`;
          if (a <= 0.003) return;
          const o = info[j], s = m[j] / mc, ox = (C[j][0] - cam[0]) / mc, oy = (C[j][1] - cam[1]) / mc, A = a * show;
          if (o.ext * s < 1.5) return;
          if (o.kind === 'dot') {
            const r = 56 * s, gs = r * 4.2;
            ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.6 * A * tw(1); ctx.drawImage(glow(accent), ox - gs, oy - gs, gs * 2, gs * 2); ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = A; ctx.fillStyle = css(hi); ctx.beginPath(); ctx.arc(ox, oy, r * (1 + 0.03 * Math.sin(t * 1.6)), 0, 6.283); ctx.fill();
            return;
          }
          if (o.kind === 'rings') {
            ctx.strokeStyle = css(ink); ctx.lineWidth = Math.max(0.8, 2 * s); ctx.globalAlpha = 0.18 * A;
            o.rings.forEach((rr) => { const R = rr * s; if (R > 0.5 && ox + R > bx0 && ox - R < bx1) { ctx.beginPath(); ctx.arc(ox, oy, R, 0, 6.283); ctx.stroke(); } });
          }
          ctx.fillStyle = css(ink);
          const cells = o.cells;
          for (let k = 0; k < cells.length; k++) {
            const c = cells[k], x = ox + c[0] * s, y = oy + c[1] * s, r = (c[2] * s) / 2;
            if (x < bx0 || x > bx1 || y < by0 || y > by1 || r < 0.35) continue;
            if (k === o.hl && j > 0) continue;
            ctx.globalAlpha = c[3] * A * tw(k * 0.37); ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fill();
          }
          if (j > 0) {
            const c = cells[o.hl], x = ox + c[0] * s, y = oy + c[1] * s, r = (c[2] * s) / 2, gs = r * 3.4;
            ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.65 * A * (0.75 + 0.25 * Math.sin(t * 1.7)); ctx.drawImage(glow(accent), x - gs, y - gs, gs * 2, gs * 2); ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = A; ctx.fillStyle = css(hi); ctx.beginPath(); ctx.arc(x, y, Math.max(r, 0.8), 0, 6.283); ctx.fill();
          }
        });
        ctx.globalAlpha = 1; ctx.setTransform(1, 0, 0, 1, 0, 0);
      },
    };
  };
})();
