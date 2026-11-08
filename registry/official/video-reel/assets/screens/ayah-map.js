// Ayah map: 114 thin marks (one per surah) in rows, or 30 juz cells. Marks light in surah order,
// a tick each (grouped), and a count climbs. At the end it can zoom onto one hit.
// params: hits [{surah, ayah}], layout ('strip'|'grid'), label, zoomTo (index into hits), dur (length of the lighting)
// Demo data only: every real hit must be read on quran.com before use.
(function () {
  const K = window.Kit;
  const AYAHS = [7,286,200,176,120,165,206,75,129,109,123,111,43,52,99,128,111,110,98,135,112,78,118,64,77,227,93,88,69,60,34,30,73,54,45,83,182,88,75,85,54,53,89,59,37,35,38,29,18,45,60,49,62,55,78,96,29,22,24,13,14,11,11,18,12,12,30,52,52,44,28,28,20,56,40,31,50,40,46,42,29,19,36,25,22,17,19,26,30,20,15,21,11,8,8,19,5,8,8,11,11,8,3,9,5,4,7,3,6,3,5,4,5,6];
  // first (surah, ayah) of each of the 30 juz
  const JUZ = [[1,1],[2,142],[2,253],[3,93],[4,24],[4,148],[5,82],[6,111],[7,88],[8,41],[9,93],[11,6],[12,53],[15,1],[17,1],[18,75],[21,1],[23,1],[25,21],[27,56],[29,46],[33,31],[36,28],[39,32],[41,47],[46,1],[51,31],[58,1],[67,1],[78,1]];
  const juzOf = (s, a) => { let j = 0; JUZ.forEach((q, i) => { if (s > q[0] || (s === q[0] && a >= q[1])) j = i; }); return j; };
  const DEMO = [[2,255],[2,285],[3,2],[4,87],[6,102],[7,158],[9,31],[16,2],[18,10],[20,8],[23,116],[27,26],[28,70],[38,65],[59,23],[64,13],[73,9],[112,1]].map(([surah, ayah]) => ({ surah, ayah }));

  window.Screens.ayahMap = function (root, params) {
    const p = K.params(params, { hits: DEMO, layout: 'strip', label: 'ayahs', zoomTo: null, dur: 3, y: 800 });
    const snd = K.sounds(p), stage = K.stage(root, p);
    const grid = p.layout === 'grid';
    const hits = (p.hits || []).filter((h) => h && h.surah >= 1 && h.surah <= 114).map((h) => ({ surah: h.surah | 0, ayah: Math.max(1, h.ayah | 0) }));
    const order = hits.map((h, i) => ({ ...h, i })).sort((a, b) => a.surah - b.surah || a.ayah - b.ayah);
    const n = order.length;
    const markOf = (h) => (grid ? juzOf(h.surah, h.ayah) : h.surah - 1);
    const T0 = p.t0 + 0.7;
    order.forEach((h, k) => { h.time = T0 + (n > 1 ? p.dur * Math.pow(k / (n - 1), 0.88) : 0); h.mark = markOf(h); });
    const lastT = n ? order[n - 1].time : T0;
    const lockT = lastT + 0.35;
    const zoomIdx = p.zoomTo != null && hits[p.zoomTo] ? p.zoomTo : null;
    const zoomHit = zoomIdx != null ? order.find((h) => h.i === zoomIdx) : null;
    const zs = lockT + 0.7, zd = 1.2, zScale = grid ? 2.7 : 4;

    // sound: ticks grouped so they never exceed ~11 per second
    let lastTick = -1;
    order.forEach((h, k) => { if (h.time - lastTick >= 0.09) { snd.add(h.time, 'tick', 0.16 + 0.16 * (k / Math.max(1, n))); lastTick = h.time; } });
    if (n) snd.add(lockT, 'bell2', 0.3);
    if (zoomHit) snd.add(zs, 'slide', 0.25);

    // marks
    const world = K.el('div', { style: { position: 'absolute', left: '0', top: '0', width: '0', height: '0', transformOrigin: '0 0' } }, stage);
    const N = grid ? 30 : 114, marks = [];
    for (let m = 0; m < N; m++) {
      let cx, cy, w, h, base;
      if (grid) { const c = m % 6, r = Math.floor(m / 6); w = 132; h = 132; cx = (c - 2.5) * 150; cy = -150 + r * 150 + h / 2; }
      else { const c = m % 19, r = Math.floor(m / 19); w = 9; h = 34 + 70 * Math.sqrt(AYAHS[m] / 286); cx = (9 - c) * 48; base = -60 + r * 135; cy = base - h / 2; }
      const box = K.el('div', { style: { position: 'absolute', left: cx - w / 2 + 'px', top: cy - h / 2 + 'px', width: w + 'px', height: h + 'px', transformOrigin: grid ? '50% 50%' : '50% 100%' } }, world);
      const dim = K.el('div', { style: { position: 'absolute', inset: '0', borderRadius: grid ? '20px' : '5px', background: grid ? 'transparent' : 'var(--dim)', boxShadow: grid ? 'inset 0 0 0 2px var(--dim)' : 'none', opacity: grid ? '0.7' : '0.5' } }, box);
      const lit = K.el('div', { style: { position: 'absolute', inset: '0', borderRadius: grid ? '20px' : '5px', background: 'var(--accent)', boxShadow: grid ? '0 0 34px var(--accent), inset 0 0 0 2px var(--accent-hi)' : '0 0 18px var(--accent)', opacity: '0' } }, box);
      let num = null;
      if (grid) num = K.el('div', { text: String(m + 1), style: { position: 'absolute', inset: '0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--serif, Baskerville, serif)', fontSize: '38px', fontVariantNumeric: 'tabular-nums lining-nums', color: 'var(--quiet)' } }, box);
      const times = order.filter((q) => q.mark === m).map((q) => q.time);
      marks.push({ box, dim, lit, num, times, cx, cy });
      if (!grid && c0(m)) K.el('div', { style: { position: 'absolute', left: -456 + 'px', top: base + 12 + 'px', width: '912px', height: '2px', background: 'var(--dim)', opacity: '0.3' } }, world);
    }
    function c0(m) { return m % 19 === 0; }

    // count + label + underline
    const hud = K.el('div', { style: { position: 'absolute', left: '0', top: '0', width: '0', height: '0' } }, stage);
    const countBox = K.el('div', { style: { position: 'absolute', left: '-300px', top: '-470px', width: '600px', textAlign: 'center' } }, hud);
    const count = K.el('div', { text: '0', style: { fontFamily: 'var(--serif, Baskerville, serif)', fontSize: '210px', lineHeight: '1', color: 'var(--ink)', fontVariantNumeric: 'tabular-nums lining-nums', display: 'inline-block', position: 'relative' } }, countBox);
    const under = K.rule(count, { h: 6, style: { left: '10%', width: '80%', bottom: '-16px' } });
    const lab = p.label ? K.el('div', { text: p.label, style: { marginTop: '36px', fontSize: '32px', letterSpacing: '.3em', textTransform: 'uppercase', color: 'var(--quiet)', whiteSpace: 'nowrap' } }, countBox) : null;
    const tag = zoomHit ? K.el('div', { text: zoomHit.surah + ' : ' + zoomHit.ayah, style: { position: 'absolute', left: '-300px', top: '400px', width: '600px', textAlign: 'center', fontFamily: 'var(--serif, Baskerville, serif)', fontSize: '110px', lineHeight: '1', color: 'var(--accent-hi)', fontVariantNumeric: 'tabular-nums lining-nums', opacity: '0' } }, stage) : null;

    return {
      sfx: snd.list,
      end: (zoomHit ? zs + zd : lockT) + 1.3,
      frame(t) {
        const [dx, dy] = K.drift(t, p.seed, 4);
        const k = zoomHit ? K.inout(K.prog(t, zs, zd)) : 0;
        const s = K.lerp(1, zScale, k), target = zoomHit ? marks[zoomHit.mark] : null;
        const tx = target ? k * (0 - target.cx * zScale) : 0, ty = target ? k * (-40 - target.cy * zScale) : 0;
        world.style.transform = `translate(${tx + dx}px, ${ty + dy}px) scale(${s * (1 + 0.02 * K.prog(t, p.t0, 6))})`;
        world.style.opacity = String(K.ease(K.prog(t, p.t0 - 0.2, 0.5)));
        let c = 0, lastHit = -9;
        order.forEach((h) => { if (h.time <= t) { c++; lastHit = h.time; } });
        marks.forEach((m, i) => {
          let nl = 0, tl = -9;
          m.times.forEach((x) => { if (x <= t) { nl++; tl = x; } });
          const on = K.ease(K.prog(t, m.times.length ? m.times[0] : 1e9, 0.14));
          const fl = nl ? 1 - K.ease(K.prog(t, tl, 0.55)) : 0;
          m.lit.style.opacity = String(nl ? on * (Math.min(1, 0.7 + 0.15 * nl) * (0.9 + 0.1 * Math.sin(t * 1.3 + i)) + 0.3 * fl) : 0);
          m.box.style.transform = grid ? `scale(${1 + 0.09 * fl})` : `scaleY(${1 + 0.3 * fl * fl}) scaleX(${1 + 0.6 * fl})`;
          m.box.style.opacity = String(target && m !== target ? 1 - 0.92 * k : 1);
          if (m.num) m.num.style.color = nl ? 'var(--ink)' : 'var(--quiet)';
        });
        count.textContent = String(c);
        const live = t >= T0 && t < lockT;
        count.style.color = live ? 'var(--accent-hi)' : 'var(--ink)';
        const pulse = c ? 1 + 0.05 * (1 - K.ease(K.prog(t, lastHit, 0.28))) : 1;
        hud.style.transform = `translate(${dx * 0.5}px, ${dy * 0.5}px) scale(${pulse})`;
        hud.style.opacity = String(K.ease(K.prog(t, p.t0 - 0.2, 0.5)) * (1 - k));
        K.draw(under, K.ease(K.prog(t, lockT, 0.45)));
        if (tag) { tag.style.opacity = String(K.ease(K.prog(t, zs + 0.7, 0.5))); tag.style.transform = `translateY(${(1 - K.ease(K.prog(t, zs + 0.7, 0.6))) * 20}px)`; }
        if (lab) lab.style.opacity = '1';
      },
    };
  };
})();
