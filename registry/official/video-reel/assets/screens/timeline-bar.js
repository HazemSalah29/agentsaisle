// Timeline bar: a bar draws across a span of time, a fill follows it, event marks pop as the fill
// passes them, and a soft light runs along the filled part.
// params: span {start, end, unit}, events [{at: 0..1, label}], runner ('light'|'none'), fillTo (0..1), dur (fill time)
(function () {
  const K = window.Kit;
  const DEMO_EV = [[0.14, 'Jumu‘ah'], [0.29, 'Sat'], [0.43, 'Sun'], [0.57, 'Mon'], [0.71, 'Tue'], [0.86, 'Wed']].map(([at, label]) => ({ at, label }));

  window.Screens.timelineBar = function (root, params) {
    const p = K.params(params, { span: { start: 'Fri', end: 'Fri', unit: 'one week' }, events: DEMO_EV, runner: 'light', fillTo: 1, dur: 2.4, y: 900 });
    const snd = K.sounds(p), stage = K.stage(root, p);
    const span = p.span || {}, evs = (p.events || []).map((e) => ({ at: K.clamp(Number(e.at) || 0), label: e.label == null ? '' : String(e.label) }));
    const fillTo = K.clamp(p.fillTo), W = 840, H = 16;
    const ts = p.t0 + 0.2, trackD = 1.0, fs = ts + 0.55;
    const trackF = (t) => K.inout(K.prog(t, ts, trackD));
    const fillF = (t) => fillTo * K.inout(K.prog(t, fs, p.dur));
    // first time a front reaches a position (scanned once at make time)
    const reach = (f, v) => { for (let t = ts; t < fs + p.dur + 1; t += 1 / 120) if (f(t) >= v - 1e-6) return t; return fs + p.dur; };
    evs.forEach((e) => { e.lit = e.at <= fillTo; e.pop = e.lit ? reach(fillF, e.at) : reach(trackF, e.at) + 0.05; });
    snd.add(ts, 'slide', 0.3);
    let lastTick = -1;
    [...evs].sort((a, b) => a.pop - b.pop).forEach((e) => { const tt = Math.max(e.pop, lastTick + 0.09); snd.add(tt, 'tick', 0.28); lastTick = tt; });
    const fillEnd = fs + p.dur;

    const grp = K.el('div', { style: { position: 'absolute', left: '0', top: '0', width: '0', height: '0' } }, stage);
    const bar = K.el('div', { style: { position: 'absolute', left: -W / 2 + 'px', top: -H / 2 + 'px', width: W + 'px', height: H + 'px' } }, grp);
    const track = K.el('div', { style: { position: 'absolute', inset: '0', borderRadius: H / 2 + 'px', background: 'var(--dim)', opacity: '0.55', transformOrigin: 'left center', transform: 'scaleX(0)' } }, bar);
    const halo = K.el('div', { style: { position: 'absolute', inset: '0', borderRadius: H / 2 + 'px', background: 'var(--accent)', filter: 'blur(14px)', opacity: '0.5', transformOrigin: 'left center', transform: 'scaleX(0)' } }, bar);
    const clip = K.el('div', { style: { position: 'absolute', left: '0', top: '0', height: H + 'px', width: '0', overflow: 'hidden', borderRadius: H / 2 + 'px' } }, bar);
    K.el('div', { style: { position: 'absolute', left: '0', top: '0', width: W + 'px', height: H + 'px', background: 'linear-gradient(90deg, var(--accent) 0%, var(--accent-hi) 100%)' } }, clip);
    const runner = p.runner === 'light' ? K.el('div', { style: { position: 'absolute', left: '0', top: '-4px', width: '240px', height: H + 8 + 'px', background: 'linear-gradient(90deg, transparent 0%, var(--ink) 55%, transparent 100%)', opacity: '0.6' } }, clip) : null;
    const head = p.runner === 'light' ? K.el('div', { style: { position: 'absolute', left: '0', top: -70 + H / 2 + 'px', width: '140px', height: '140px', marginLeft: '-70px', borderRadius: '50%', background: 'radial-gradient(circle, var(--accent-hi) 0%, transparent 65%)', opacity: '0' } }, bar) : null;

    // event marks (stems rise from the bar, alternating two heights so labels never touch)
    const marks = evs.map((e, i) => {
      const x = -W / 2 + e.at * W, h = i % 2 ? 150 : 78;
      const m = K.el('div', { style: { position: 'absolute', left: x + 'px', top: '0', width: '0', height: '0' } }, grp);
      const stem = K.el('div', { style: { position: 'absolute', left: '-1.5px', top: -h - H / 2 + 'px', width: '3px', height: h + 'px', transformOrigin: '50% 100%', background: 'var(--dim)', borderRadius: '2px' } }, m);
      const dot = K.el('div', { style: { position: 'absolute', left: '-10px', top: -h - H / 2 - 10 + 'px', width: '20px', height: '20px', borderRadius: '50%', background: 'var(--dim)' } }, m);
      const lw = 220, off = K.clamp(x, -W / 2 + 70, W / 2 - 70) - x, lx = -lw / 2;
      const lab = K.el('div', { text: e.label, style: { position: 'absolute', left: lx + off + 'px', top: -h - H / 2 - 74 + 'px', width: lw + 'px', textAlign: 'center', fontFamily: 'var(--serif, Baskerville, serif)', fontSize: '48px', lineHeight: '1', whiteSpace: 'nowrap', color: 'var(--ink)' } }, m);
      return { e, m, stem, dot, lab };
    });

    // end labels and unit
    const endCss = { position: 'absolute', top: '46px', fontFamily: 'var(--serif, Baskerville, serif)', fontSize: '84px', lineHeight: '1', color: 'var(--ink)', whiteSpace: 'nowrap' };
    const l0 = K.el('div', { text: span.start == null ? '' : String(span.start), style: { ...endCss, left: -W / 2 + 'px' } }, grp);
    const l1 = K.el('div', { text: span.end == null ? '' : String(span.end), style: { ...endCss, right: -W / 2 + 'px' } }, grp);
    const unit = span.unit ? K.el('div', { text: String(span.unit), style: { position: 'absolute', left: '-300px', width: '600px', textAlign: 'center', top: '170px', fontSize: '30px', letterSpacing: '.3em', textTransform: 'uppercase', color: 'var(--quiet)', whiteSpace: 'nowrap' } }, grp) : null;

    return {
      sfx: snd.list,
      end: Math.max(fillEnd, ...evs.map((e) => e.pop)) + 1.0,
      frame(t) {
        const [dx, dy] = K.drift(t, p.seed, 4);
        grp.style.transform = `translate(${dx}px, ${dy}px) scale(${1 + 0.03 * K.prog(t, p.t0, 7)})`;
        const tf = trackF(t), ff = fillF(t);
        track.style.transform = `scaleX(${tf})`;
        const fw = W * ff;
        clip.style.width = fw + 'px';
        halo.style.transform = `scaleX(${ff})`;
        if (runner) {
          const per = 1.7, u = (((t - fs) / per) % 1 + 1) % 1;
          runner.style.transform = `translateX(${-240 + u * (fw + 240)}px)`;
          runner.style.opacity = String(ff > 0.004 ? 0.55 : 0);
          head.style.left = fw + 'px';
          head.style.opacity = String(ff > 0.004 ? (0.5 + 0.12 * Math.sin(t * 2.4)) * (t < fillEnd ? 1 : 0.7) : 0);
        }
        marks.forEach((o) => {
          const q = K.prog(t, o.e.pop, 0.5), sp = K.spring(q);
          const live = t >= o.e.pop;
          o.m.style.opacity = live ? '1' : '0';
          o.stem.style.transform = `scaleY(${live ? sp : 0})`;
          o.dot.style.transform = `scale(${live ? 0.4 + 0.6 * sp : 0})`;
          const col = o.e.lit ? 'var(--accent)' : 'var(--dim)';
          o.stem.style.background = col;
          o.dot.style.background = o.e.lit ? 'var(--accent-hi)' : 'var(--dim)';
          o.dot.style.boxShadow = o.e.lit ? '0 0 16px var(--accent)' : 'none';
          o.lab.style.color = o.e.lit ? 'var(--ink)' : 'var(--quiet)';
          if (live) K.up(o.lab, t, o.e.pop + 0.08, 0.5, 14);
        });
        K.up(l0, t, ts, 0.7); K.up(l1, t, ts + 0.5, 0.7);
        if (unit) K.up(unit, t, ts + 0.3, 0.7);
      },
    };
  };
})();
