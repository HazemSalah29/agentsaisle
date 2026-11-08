// Card grid: cards slide into a grid one by one, each showing a word and a small line. They can
// flip from a blank back to the face (3D rotateY), and an accent tick can draw onto each in turn.
// params: cards [{text, sub}], cols, order ('row'|'random'), flip (bool), checks (bool), stagger
(function () {
  const K = window.Kit;
  const DEMO = [['One', 'first'], ['Two', 'second'], ['Three', 'third'], ['Four', 'fourth'], ['Five', 'fifth'], ['Six', 'sixth']].map(([text, sub]) => ({ text, sub }));

  window.Screens.cardGrid = function (root, params) {
    const p = K.params(params, { cards: DEMO, cols: 3, order: 'row', flip: false, checks: false, stagger: 0.3, y: 860 });
    const cards = p.cards || [], n = cards.length;
    const snd = K.sounds(p), stage = K.stage(root, p);
    const cols = Math.max(1, Math.min(p.cols | 0 || 1, Math.max(1, n))), rows = Math.max(1, Math.ceil(n / cols));
    const gap = 28;
    let cw = (880 - gap * (cols - 1)) / cols;
    let ch = Math.min(cw * 1.3, (1150 - gap * (rows - 1)) / rows);
    cw = Math.min(cw, ch * 1.05);
    const gw = cols * cw + (cols - 1) * gap, gh = rows * ch + (rows - 1) * gap;

    // arrival order
    const arr = cards.map((_, i) => i);
    if (p.order === 'random') { const r = K.rng(p.seed * 7 + 3); for (let i = n - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } }
    const st = Math.max(0.09, Math.min(p.stagger, 2.4 / Math.max(1, n)));
    const slideD = 0.8, flipD = 0.8;
    const land = []; // time each card is on the grid
    arr.forEach((ci, k) => { land[ci] = p.t0 + 0.2 + k * st; });
    const flipT = (ci) => land[ci] + 0.55;
    const doneAll = n ? Math.max(...land) + (p.flip ? 0.55 + flipD : 0.6) : p.t0;
    const ckT = [];
    const ck = Math.min(0.28, 2.2 / Math.max(1, n));
    arr.forEach((ci, k) => { ckT[ci] = doneAll + 0.25 + k * ck; });
    const lastEvent = p.checks && n ? Math.max(...ckT) + 0.5 : doneAll;

    arr.forEach((ci) => snd.add(land[ci] + 0.05, 'slide', 0.22));
    if (p.checks) arr.forEach((ci) => snd.add(ckT[ci] + 0.12, 'tick', 0.3));

    const grp = K.el('div', { style: { position: 'absolute', left: '0', top: '0', width: '0', height: '0' } }, stage);
    const face = (parent) => K.el('div', { style: { position: 'absolute', inset: '0', borderRadius: '24px', background: 'linear-gradient(160deg, var(--lift) 0%, var(--deep) 130%)', boxShadow: 'inset 0 0 0 2px var(--dim), 0 26px 50px rgba(0,0,0,.38)', backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' } }, parent);
    const items = cards.map((c, i) => {
      const col = i % cols, row = Math.floor(i / cols);
      const cx = -gw / 2 + col * (cw + gap) + cw / 2, cy = -gh / 2 + row * (ch + gap) + ch / 2;
      const outer = K.el('div', { style: { position: 'absolute', left: cx - cw / 2 + 'px', top: cy - ch / 2 + 'px', width: cw + 'px', height: ch + 'px', perspective: '1400px', opacity: '0' } }, grp);
      const inner = K.el('div', { style: { position: 'absolute', inset: '0', transformStyle: 'preserve-3d' } }, outer);
      const front = face(inner);
      const box = K.el('div', { style: { position: 'absolute', inset: '0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '18px', padding: '0 14px' } }, front);
      const tx = K.el('div', { text: String(c.text == null ? '' : c.text), style: { fontFamily: 'var(--serif, Baskerville, serif)', fontSize: Math.round(cw * 0.26) + 'px', lineHeight: '1.1', color: 'var(--ink)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums lining-nums' } }, box);
      if (c.sub) K.el('div', { text: String(c.sub), style: { fontSize: Math.max(20, Math.round(cw * 0.1)) + 'px', letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--quiet)', whiteSpace: 'nowrap' } }, box);
      K.fit(tx, cw - 40, 18);
      const edge = K.el('div', { style: { position: 'absolute', inset: '0', borderRadius: '24px', boxShadow: 'inset 0 0 0 3px var(--accent), 0 0 40px var(--accent)', opacity: '0' } }, front);
      const tk = K.svg('svg', { width: '64', height: '64', viewBox: '0 0 64 64', style: 'position:absolute;right:16px;top:16px;overflow:visible' }, front);
      const ring = K.svg('circle', { cx: '32', cy: '32', r: '27', fill: 'none', stroke: 'var(--accent)', 'stroke-width': '2.5', pathLength: '1', 'stroke-dasharray': '1', 'stroke-dashoffset': '1', transform: 'rotate(-90 32 32)' }, tk);
      const tick = K.svg('path', { d: 'M18 33 L28 43 L47 21', fill: 'none', stroke: 'var(--accent)', 'stroke-width': '5.5', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', pathLength: '1', 'stroke-dasharray': '1', 'stroke-dashoffset': '1' }, tk);
      if (!p.checks) tk.style.display = 'none';
      let back = null;
      if (p.flip) {
        back = face(inner); back.style.transform = 'rotateY(180deg)';
        back.style.background = 'linear-gradient(160deg, var(--deep) 0%, var(--bg) 120%)';
        K.el('div', { style: { position: 'absolute', inset: '22px', borderRadius: '14px', boxShadow: 'inset 0 0 0 1.5px var(--dim)', opacity: '0.7' } }, back);
        K.el('div', { style: { position: 'absolute', left: '50%', top: '50%', width: cw * 0.16 + 'px', height: cw * 0.16 + 'px', transform: 'translate(-50%,-50%) rotate(45deg)', boxShadow: 'inset 0 0 0 1.5px var(--dim)', opacity: '0.7' } }, back);
      }
      const r = K.rng(p.seed * 31 + i * 5 + 1);
      return { outer, inner, edge, ring, tick, mb: K.motionBlur(outer, true), side: r() < 0.5 ? -1 : 1, rot: (r() - 0.5) * 12, i };
    });

    return {
      sfx: snd.list,
      end: lastEvent + 1.2,
      frame(t) {
        grp.style.transform = `scale(${1 + 0.025 * K.prog(t, p.t0, 6)})`;
        items.forEach((it) => {
          const x = K.prog(t, land[it.i] - slideD + 0.25, slideD);
          const sp = K.spring(x), spd = Math.abs(K.spring(Math.min(1, x + 0.03)) - sp) / 0.03 * 260 / slideD;
          const fl = K.ease(K.prog(t, land[it.i] - slideD + 0.25 + slideD, 0.6));
          const settle = K.ease(K.prog(t, land[it.i] + 0.3, 0.6));
          const oy = (1 - sp) * 280 + settle * 3 * Math.sin(t * 0.9 + it.i * 1.3), ox = (1 - K.ease(x)) * it.side * 50;
          const rz = (1 - K.ease(x)) * it.rot + settle * 0.4 * Math.sin(t * 0.7 + it.i);
          it.outer.style.opacity = String(K.ease(K.prog(t, land[it.i] - slideD + 0.25, 0.3)));
          it.outer.style.transform = `translate(${ox}px, ${oy}px) rotate(${rz}deg)`;
          it.mb(Math.min(9, spd * 0.006));
          if (p.flip) {
            const f = K.inout(K.prog(t, flipT(it.i), flipD));
            it.inner.style.transform = `rotateY(${180 * (1 - f)}deg) scale(${1 + 0.07 * Math.sin(Math.PI * f)})`;
          }
          if (p.checks) {
            const c = K.prog(t, ckT[it.i], 0.4);
            it.ring.setAttribute('stroke-dashoffset', String(1 - K.ease(c)));
            it.tick.setAttribute('stroke-dashoffset', String(1 - K.ease(K.prog(t, ckT[it.i] + 0.12, 0.35))));
            it.edge.style.opacity = String(t >= ckT[it.i] ? 0.7 * (1 - K.ease(K.prog(t, ckT[it.i], 0.7))) : 0);
          }
        });
      },
    };
  };
})();
