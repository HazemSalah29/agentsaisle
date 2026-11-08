// Arabic word highlight: a line of Arabic is revealed, then one key word lights in the accent,
// a line (or a thin hand-drawn ellipse) draws under it, and the English meaning rises 1.2 s later.
// The line is ONE text node, shaped once. The key word is found with a DOM Range and the light is an
// accent copy of the same line clipped to that box, so letters are never split.
// params: ar, key, en, reveal ('pen'|'words'|'fade'), underline ('draw'|'ring'|'none'), at (s after t0), size
(function () {
  const K = window.Kit;
  window.Screens.arabicHighlight = function (root, params) {
    const p = K.params(params, {
      ar: 'هَٰذِهِ كَلِمَةٌ تُضِيءُ',
      key: 'تُضِيءُ',
      en: 'This is a word that lights up',
      reveal: 'pen', underline: 'draw', at: 1.4, size: 128,
    });
    const idx = p.ar.indexOf(p.key);
    if (!p.key || idx < 0) throw new Error('arabicHighlight: key "' + p.key + '" not found in ar');
    const snd = K.sounds(p), stage = K.stage(root, p);
    const W = 880, LH = 1.85, lineH = p.size * LH, fontSpec = p.size + 'px Scheherazade';
    const words = [...p.ar.matchAll(/\S+/g)].map((m) => [m.index, m.index + m[0].length]);

    // timing
    const revealDur = p.reveal === 'words' ? (words.length - 1) * 0.3 + 0.55 : p.reveal === 'fade' ? 0.9 : 1.15;
    const lightT = p.t0 + Math.max(p.at, revealDur);
    const enT = lightT + 1.2;
    snd.add(lightT, 'drop', 0.5);
    if (p.reveal === 'pen') for (let i = 0; i < 9; i++) snd.add(p.t0 + 0.08 + i * 0.12, 'key', 0.1);
    if (p.reveal === 'words') words.forEach((w, i) => snd.add(p.t0 + i * 0.3 + 0.1, 'key', 0.1));

    // layers
    const group = K.el('div', { style: { position: 'absolute', left: '0', top: '0', width: '0', height: '0' } }, stage);
    const wrap = K.el('div', { style: { position: 'absolute', left: -W / 2 + 'px', top: -lineH / 2 - 70 + 'px', width: W + 'px', height: lineH + 'px' } }, group);
    const glow = K.el('div', { style: { position: 'absolute', left: '0', top: '0', width: '10px', height: '10px', background: 'radial-gradient(ellipse, var(--accent) 0%, transparent 68%)', opacity: '0' } }, wrap);
    const lineCss = { position: 'absolute', left: '0', top: '0', width: W + 'px', fontFamily: 'Scheherazade, serif', fontSize: p.size + 'px', lineHeight: String(LH), direction: 'rtl', textAlign: 'center', whiteSpace: 'normal', fontKerning: 'normal' };
    const base = K.el('div', { text: p.ar, attrs: { lang: 'ar' }, style: { ...lineCss, color: 'var(--ink)' } }, wrap);
    const over = K.el('div', { text: p.ar, attrs: { lang: 'ar', 'aria-hidden': 'true' }, style: { ...lineCss, color: 'var(--accent-hi)', clipPath: 'inset(100%)' } }, wrap);
    const nib = K.el('div', { style: { position: 'absolute', top: '0', width: '3px', height: '0', background: 'var(--accent)', boxShadow: '0 0 18px 2px var(--accent)', opacity: '0', borderRadius: '2px' } }, wrap);
    const rule = K.rule(wrap, { h: 5, rtl: true, style: { boxShadow: '0 0 16px var(--accent)', display: p.underline === 'draw' ? 'block' : 'none' } });
    const svg = K.svg('svg', { width: W, height: lineH, viewBox: `0 0 ${W} ${lineH}`, style: 'position:absolute;left:0;top:0;overflow:visible;filter:drop-shadow(0 0 8px var(--accent))' }, wrap);
    const ringPath = K.svg('path', { fill: 'none', stroke: 'var(--accent)', 'stroke-width': '3.5', 'stroke-linecap': 'round', pathLength: '1', 'stroke-dasharray': '1', 'stroke-dashoffset': '1' }, svg);
    if (p.underline !== 'ring') svg.style.display = 'none';
    const en = K.el('div', { text: p.en, style: { position: 'absolute', left: -W / 2 + 'px', top: lineH / 2 - 70 + 20 + 'px', width: W + 'px', textAlign: 'center', fontFamily: 'var(--serif, Baskerville, serif)', fontSize: '56px', lineHeight: '1.25', color: 'var(--ink)', opacity: '0' } }, group);

    // measure the key word and every word with DOM ranges (after the font is loaded, before any transform is read)
    let M = null;
    const node = base.firstChild;
    const rects = (a, b) => {
      const r = document.createRange(); r.setStart(node, a); r.setEnd(node, b);
      const bb = base.getBoundingClientRect(), k = bb.width / base.offsetWidth || 1;
      return [...r.getClientRects()].filter((q) => q.width > 1).map((q) => ({ x: (q.left - bb.left) / k, y: (q.top - bb.top) / k, w: q.width / k, h: q.height / k }));
    };
    const measure = () => {
      const keyR = rects(idx, idx + p.key.length), wordR = words.map(([a, b]) => rects(a, b));
      const all = wordR.flat();
      if (!keyR.length || !all.length) return;
      const minX = Math.min(...all.map((r) => r.x)), maxX = Math.max(...all.map((r) => r.x + r.w));
      const kx0 = Math.min(...keyR.map((r) => r.x)), kx1 = Math.max(...keyR.map((r) => r.x + r.w));
      const ky0 = Math.min(...keyR.map((r) => r.y)), ky1 = Math.max(...keyR.map((r) => r.y + r.h));
      M = { keyR, wordR, minX, maxX, kx0, kx1, ky0, ky1 };
      glow.style.left = kx0 - 110 + 'px'; glow.style.width = kx1 - kx0 + 220 + 'px';
      glow.style.top = ky0 - 40 + 'px'; glow.style.height = ky1 - ky0 + 80 + 'px';
      const uy = Math.min(ky1 + p.size * 0.04, lineH - 4);
      rule.style.left = kx0 + 'px'; rule.style.width = kx1 - kx0 + 'px'; rule.style.top = uy + 'px';
      // a thin hand-drawn ellipse that overshoots its start a little
      const cx = (kx0 + kx1) / 2, cy = (ky0 + ky1) / 2 - 4, rx = (kx1 - kx0) / 2 + 60, ry = Math.min((ky1 - ky0) * 0.5, p.size * 0.78);
      let d = '';
      for (let i = 0; i <= 90; i++) {
        const u = i / 90, th = Math.PI * 0.85 + u * Math.PI * 2.16, g = 1 + 0.045 * u;
        const px = cx + Math.cos(th) * rx * g, py = cy + Math.sin(th) * ry * g;
        d += (i ? 'L' : 'M') + px.toFixed(1) + ' ' + py.toFixed(1);
      }
      ringPath.setAttribute('d', d);
      ringPath.setAttribute('transform', `rotate(-2.5 ${cx} ${cy})`);
    };
    document.fonts.load(fontSpec, p.ar).then(measure, measure);
    let ok = false;
    const ensure = () => { if (!ok && document.fonts.check(fontSpec, p.ar)) { measure(); ok = true; } };

    const maskCss = (v) => { base.style.maskImage = base.style.webkitMaskImage = v; if (v === 'none') return; base.style.maskRepeat = base.style.webkitMaskRepeat = 'no-repeat'; };

    return {
      sfx: snd.list,
      end: enT + 0.8 + 1.0,
      frame(t) {
        ensure();
        const [dx, dy] = K.drift(t, p.seed, 5);
        group.style.transform = `translate(${dx}px, ${dy}px) scale(${1 + 0.03 * K.prog(t, p.t0, 7)})`;
        const L = K.ease(K.prog(t, lightT, 0.5));
        base.style.opacity = String(1 - 0.42 * K.ease(K.prog(t, lightT, 0.6)));
        if (!M) { base.style.opacity = '0'; return; }

        // reveal
        let nibA = 0;
        if (p.reveal === 'pen') {
          const wdt = M.maxX - M.minX, g = W - M.maxX, soft = 70, r = K.prog(t, p.t0, 1.15);
          const e = -soft / wdt + (1 + soft / wdt) * K.inout(r);
          if (r >= 1) maskCss('none');
          else maskCss(`linear-gradient(to left, rgba(0,0,0,1) ${(g + e * wdt).toFixed(1)}px, rgba(0,0,0,0) ${(g + e * wdt + soft).toFixed(1)}px)`);
          if (r > 0 && r < 1) { nibA = 0.8 * Math.min(1, r * 8) * Math.min(1, (1 - r) * 6); nib.style.left = (M.maxX - e * wdt - 1.5).toFixed(1) + 'px'; }
          base.style.transform = ''; base.style.filter = '';
        } else if (p.reveal === 'words') {
          const done = t >= p.t0 + revealDur;
          if (done) maskCss('none');
          else {
            const imgs = [], sizes = [], poss = [];
            M.wordR.forEach((rs, i) => {
              const a = K.ease(K.prog(t, p.t0 + i * 0.3, 0.55)).toFixed(3);
              rs.forEach((q) => { imgs.push(`linear-gradient(rgba(0,0,0,${a}),rgba(0,0,0,${a}))`); sizes.push(`${(q.w + 12).toFixed(1)}px ${(q.h + 70).toFixed(1)}px`); poss.push(`${(q.x - 6).toFixed(1)}px ${(q.y - 35).toFixed(1)}px`); });
            });
            maskCss(imgs.join(','));
            base.style.maskSize = base.style.webkitMaskSize = sizes.join(',');
            base.style.maskPosition = base.style.webkitMaskPosition = poss.join(',');
          }
          base.style.transform = ''; base.style.filter = '';
        } else {
          maskCss('none');
          const o = base.style.opacity; K.up(base, t, p.t0, 0.9, 26); base.style.opacity = String(Number(o) * K.ease(K.prog(t, p.t0, 0.9)));
        }
        nib.style.opacity = String(nibA);
        nib.style.height = lineH * 0.62 + 'px'; nib.style.top = lineH * 0.2 + 'px';

        // the light: the accent copy of the line, clipped to the key box, revealed right to left
        if (L <= 0) over.style.clipPath = 'inset(100%)';
        else {
          let d = '';
          M.keyR.forEach((q) => { const x0 = q.x + q.w * (1 - L), x1 = q.x + q.w, y0 = q.y - 36, y1 = q.y + q.h + 36; d += `M${x0.toFixed(1)} ${y0.toFixed(1)}H${x1.toFixed(1)}V${y1.toFixed(1)}H${x0.toFixed(1)}Z`; });
          over.style.clipPath = `path('${d}')`;
        }
        glow.style.opacity = String(0.26 * L * (0.86 + 0.14 * Math.sin(t * 1.7)));

        // underline
        if (p.underline === 'draw') K.draw(rule, K.ease(K.prog(t, lightT + 0.15, 0.55)));
        else if (p.underline === 'ring') ringPath.setAttribute('stroke-dashoffset', String(1 - K.inout(K.prog(t, lightT + 0.12, 0.8))));

        K.up(en, t, enT, 0.8, 28);
      },
    };
  };
})();
