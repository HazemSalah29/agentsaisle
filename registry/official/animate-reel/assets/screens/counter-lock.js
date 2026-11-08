// Counter lock: a number counts up in front of the viewer, slows, and locks with one pulse
// and an accent line that draws under it. Never a slot-machine roll or a gold glow.
// params: from, to, curve ('ease' | 'flicker'), digits (pad), label, race {to, label, lead}
(function () {
  const K = window.Kit;
  window.Screens.counterLock = function (root, params) {
    const p = K.params(params, { from: 0, to: 100, curve: 'ease', digits: 0, label: '', race: null, dur: 3.5 });
    const snd = K.sounds(p), stage = K.stage(root, p), lock = p.t0 + p.dur;
    const pad = (n) => String(n).padStart(p.digits, '0');
    const cols = p.race ? [{ to: p.to, label: p.label, lead: 0 }, { to: p.race.to, label: p.race.label || '', lead: p.race.lead == null ? 0.35 : p.race.lead }] : [{ to: p.to, label: p.label, lead: 0 }];
    const size = p.race ? 220 : 340, gap = 460;

    const items = cols.map((c, i) => {
      const cx = p.race ? (i === 0 ? -gap / 2 : gap / 2) : 0;
      const box = K.el('div', { style: { position: 'absolute', left: cx + 'px', top: '0', transform: 'translate(-50%,-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center' } }, stage);
      const num = K.el('div', { style: { fontFamily: 'var(--serif, Baskerville, "Libre Baskerville", serif)', fontSize: size + 'px', lineHeight: '1', color: 'var(--ink)', fontVariantNumeric: 'tabular-nums lining-nums', letterSpacing: '-0.02em', whiteSpace: 'nowrap', position: 'relative' } }, box);
      const digits = K.el('span', { text: pad(c.to) }, num);
      const under = K.rule(num, { h: 6, style: { left: '6%', width: '88%', bottom: '-28px' } });
      const rs = p.race ? 1.15 : 1.5;
      const ring = K.el('div', { style: { position: 'absolute', left: '50%', top: '50%', width: size * rs + 'px', height: size * rs + 'px', marginLeft: -size * rs / 2 + 'px', marginTop: -size * rs / 2 + 'px', borderRadius: '50%', border: '3px solid var(--accent)', opacity: '0' } }, box);
      const lab = c.label ? K.el('div', { text: c.label, style: { marginTop: '70px', fontSize: '32px', letterSpacing: '.3em', textTransform: 'uppercase', color: 'var(--quiet)', whiteSpace: 'nowrap' } }, box) : null;
      return { c, box, num, digits, under, ring, lab, mb: K.motionBlur(digits, true) };
    });
    // fit the widest number into 880 px (or 400 each in a race)
    document.fonts.ready.then(() => items.forEach((it) => K.fit(it.num, p.race ? 400 : 880)));

    const span = p.dur - 0.3; // the count ends 0.3 s early: silence, then the lock
    const value = (c, t) => {
      const x = K.prog(t, p.t0, span);
      if (t >= lock) return c.to;
      if (p.curve === 'flicker' && x < 0.75) return Math.floor(p.from + K.hash(p.seed, Math.floor(t * 12)) * (c.to - p.from));
      // in a race the leader (lead > 0) shoots ahead, the other starts slow; both meet at the lock
      const e = !p.race ? K.quartOut(x) : c.lead ? K.quartOut(x) : Math.pow(x, 1.6 + 2 * cols[1].lead);
      return Math.round(p.from + (c.to - p.from) * Math.min(e, 0.999));
    };
    // ticks follow the count: one per visible change, at most every 0.06 s, none in the last 0.3 s
    let last = -1, lastT = -1;
    for (let f = 0; f <= span * 30; f++) {
      const t = p.t0 + f / 30, v = value(cols[0], t);
      if (v !== last && t - lastT >= 0.06) { snd.add(t, 'tick', 0.18 + 0.2 * (1 - f / (span * 30))); lastT = t; }
      last = v;
    }
    snd.add(lock, 'bell');

    return {
      sfx: snd.list,
      end: lock + 1.2,
      frame(t) {
        const show = K.ease(K.prog(t, p.t0 - 0.4, 0.4));
        items.forEach((it, i) => {
          const v = value(it.c, t), rate = Math.abs(value(it.c, t + 1 / 30) - v);
          it.digits.textContent = pad(v);
          it.mb(t < lock ? Math.min(10, rate * 0.6) : 0);
          const pop = t >= lock ? 1 + 0.07 * (1 - K.spring(K.prog(t, lock, 0.6))) : 1;
          const breathe = t > lock + 0.6 ? 1 + 0.008 * Math.sin((t - lock - 0.6) * 1.6) : 1;
          const [dx, dy] = K.drift(t, p.seed + i, 3);
          it.box.style.opacity = String(show);
          it.box.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(${pop * breathe})`;
          it.num.style.color = t >= lock ? 'var(--accent-hi)' : 'var(--ink)';
          K.draw(it.under, K.ease(K.prog(t, lock + 0.1, 0.45)));
          const r = K.prog(t, lock, 0.9);
          it.ring.style.opacity = String(r > 0 && r < 1 ? 0.55 * (1 - r) : 0);
          it.ring.style.transform = `scale(${0.7 + 0.6 * K.ease(r)})`;
          if (it.lab) K.up(it.lab, t, p.t0 + 0.2, 0.7);
        });
      },
    };
  };
})();
