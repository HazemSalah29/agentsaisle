// Bar race: two to five bars grow side by side; the lead can flip, or they lock equal.
// params: bars [{label, value, role:'accent'|'ink'}], steps [[share 0..1, [values]], ...] (keyframes over dur),
//   orient ('up'|'across'), lockEqual (the last 20% of dur: every bar eases to the mean and a line joins the tops;
//   with lockEqual the steps are squeezed into the first 80% of dur)
(function () {
  const K = window.Kit;

  // monotone cubic through keyframes [[share, value], ...]
  function curve(kf) {
    const m = kf.length, d = [], tg = new Array(m).fill(0);
    for (let k = 0; k < m - 1; k++) d.push((kf[k + 1][1] - kf[k][1]) / (kf[k + 1][0] - kf[k][0]));
    for (let k = 1; k < m - 1; k++) tg[k] = d[k - 1] * d[k] <= 0 ? 0 : (2 * d[k - 1] * d[k]) / (d[k - 1] + d[k]);
    return (x) => {
      if (x <= kf[0][0]) return kf[0][1];
      if (x >= kf[m - 1][0]) return kf[m - 1][1];
      let k = 0; while (x > kf[k + 1][0]) k++;
      const h = kf[k + 1][0] - kf[k][0], u = (x - kf[k][0]) / h, u2 = u * u, u3 = u2 * u;
      return Math.max(0, (2 * u3 - 3 * u2 + 1) * kf[k][1] + (u3 - 2 * u2 + u) * h * tg[k] + (-2 * u3 + 3 * u2) * kf[k + 1][1] + (u3 - u2) * h * tg[k + 1]);
    };
  }

  window.Screens.barRace = function (root, params) {
    const p = K.params(params, {
      bars: [{ label: 'Small and constant', value: 10, role: 'ink' }, { label: 'Big and rare', value: 7, role: 'accent' }],
      steps: null, orient: 'up', lockEqual: false, dur: 4.5,
    });
    const bars = (p.bars || []).slice(0, 5), n = bars.length, snd = K.sounds(p), across = p.orient === 'across';

    // keyframes per bar
    let steps = p.steps && p.steps.length ? p.steps.map((s) => [K.clamp(s[0]), s[1]]).sort((a, b) => a[0] - b[0]) : null;
    const finals = steps ? steps[steps.length - 1][1] : bars.map((b) => b.value);
    const mean = n ? finals.reduce((a, b) => a + (b || 0), 0) / n : 0;
    const kfs = bars.map((b, i) => {
      let list;
      if (steps) list = [[0, 0], ...steps.map((s) => [s[0] || 0.0001, s[1][i] || 0])];
      else list = [[0.06 * i, 0], [1, b.value || 0]];
      if (p.lockEqual) {
        list = list.map(([s, v], k) => [k === 0 ? s : s * 0.8, v]);
        if (!steps) list = [[list[0][0], 0], [0.8, b.value || 0]];
        list.push([1, mean]);
      }
      // strictly increasing shares
      for (let k = 1; k < list.length; k++) if (list[k][0] <= list[k - 1][0]) list[k][0] = list[k - 1][0] + 0.0001;
      return list;
    });
    const fns = kfs.map(curve);
    const axisMax = Math.max(1e-6, ...kfs.flat().map((a) => a[1]));
    const dec = kfs.flat().some((a) => Math.abs(a[1] - Math.round(a[1])) > 1e-6) ? 1 : 0;
    const valuesAt = (t) => fns.map((f) => f((t - p.t0) / p.dur));
    const leadOf = (v) => {
      if (!v.length) return -1;
      let b = 0; v.forEach((x, i) => { if (x > v[b]) b = i; });
      const second = Math.max(-1, ...v.filter((_, i) => i !== b));
      return v[b] > 0.02 * axisMax && v[b] > second * 1.004 + 0.002 * axisMax ? b : -1;
    };

    // lead changes (sampled once) -> one thud each
    const changes = []; let last = -1;
    for (let t = p.t0; t <= p.t0 + p.dur; t += 1 / 90) {
      const l = leadOf(valuesAt(t));
      if (l >= 0) { if (last >= 0 && l !== last) changes.push(t); last = l; }
    }
    changes.forEach((t) => snd.add(t, 'thud', 0.6));
    if (n) for (let i = 0; i < 7; i++) snd.add(p.t0 + 0.25 + (p.dur * 0.8) * (i / 6), 'tap', 0.07 + 0.13 * (i / 6));
    const lockT = p.t0 + p.dur * 0.93;
    if (p.lockEqual && n > 1) snd.add(lockT, 'bell2', 0.45);

    // layout
    const stage = K.stage(root, p);
    const els = [];
    let baseY = 420, maxLen = 760, slotW = 0, startX = 0, pitch = 0, rowThick = 62;
    if (!across) {
      const gap = 56; slotW = Math.min(260, (840 - gap * (n - 1)) / Math.max(1, n));
      const total = n * slotW + (n - 1) * gap; startX = -total / 2 + slotW / 2; pitch = slotW + gap;
    } else { pitch = Math.min(190, 900 / Math.max(1, n)); maxLen = 640; }
    const axisLine = K.rule(stage, across ? { h: 3, style: { left: '-424px', top: -(n * pitch) / 2 + 'px', width: '3px', height: n * pitch + 'px', background: 'var(--quiet)', opacity: '0.5', transformOrigin: 'center top' } } : { h: 3, style: { left: -(n * slotW + (n - 1) * 56) / 2 - 40 + 'px', top: baseY + 'px', width: n * slotW + (n - 1) * 56 + 80 + 'px', background: 'var(--quiet)', opacity: '0.5' } });
    if (across) axisLine.style.background = 'var(--quiet)';
    const eqLine = K.rule(stage, { h: 3, style: { zIndex: '3' } });

    bars.forEach((b, i) => {
      const accent = b.role === 'accent';
      const fill = accent ? 'linear-gradient(to ' + (across ? 'right' : 'top') + ', var(--accent), var(--accent-hi))' : 'linear-gradient(to ' + (across ? 'right' : 'top') + ', var(--quiet), var(--ink))';
      const cx = across ? -420 : startX + i * pitch, cy = across ? -(n - 1) * pitch / 2 + i * pitch : 0;
      const bw = across ? 0 : Math.min(220, slotW * 0.8);
      const track = K.el('div', { style: { position: 'absolute', background: 'var(--dim)', opacity: '0', borderRadius: '10px' } }, stage);
      const bar = K.el('div', { style: { position: 'absolute', background: fill, borderRadius: across ? '0 10px 10px 0' : '10px 10px 0 0' } }, stage);
      const val = K.el('div', { text: '0', style: { position: 'absolute', fontFamily: 'var(--serif, Baskerville, serif)', fontSize: across ? '66px' : '88px', lineHeight: '1', color: 'var(--ink)', fontVariantNumeric: 'tabular-nums lining-nums', whiteSpace: 'nowrap', transformOrigin: across ? 'left center' : 'center bottom' } }, stage);
      const lab = K.el('div', { text: b.label || '', style: { position: 'absolute', fontSize: across ? '30px' : '28px', letterSpacing: '.2em', textTransform: 'uppercase', color: 'var(--quiet)', textAlign: across ? 'left' : 'center', lineHeight: '1.3', width: across ? '700px' : slotW + 'px' } }, stage);
      if (across) { track.style.left = cx + 'px'; track.style.top = cy - 14 + 'px'; track.style.width = maxLen + 'px'; track.style.height = rowThick + 'px'; track.style.borderRadius = '0 10px 10px 0'; lab.style.left = cx + 'px'; lab.style.top = cy - 70 + 'px'; }
      else { track.style.left = cx - bw / 2 + 'px'; track.style.top = baseY - maxLen + 'px'; track.style.width = bw + 'px'; track.style.height = maxLen + 'px'; lab.style.left = cx - slotW / 2 + 'px'; lab.style.top = baseY + 28 + 'px'; }
      els.push({ b, cx, cy, bw, track, bar, val, lab, mb: K.motionBlur(val, true) });
    });

    return {
      sfx: snd.list,
      end: p.t0 + p.dur + 1.2,
      frame(t) {
        const vals = valuesAt(t), lead = leadOf(vals), [dx, dy] = K.drift(t, p.seed, 4);
        stage.style.transform = `translate(${dx}px, ${dy}px) scale(${p.scale})`;
        axisLine.style.transform = across ? `scaleY(${K.ease(K.prog(t, p.t0 - 0.5, 0.6))})` : `scaleX(${K.ease(K.prog(t, p.t0 - 0.5, 0.6))})`;
        els.forEach((e, i) => {
          const v = vals[i], len = Math.max(0, (v / axisMax) * maxLen), v2 = valuesAt(t + 1 / 30)[i], rate = Math.abs(v2 - v) / axisMax * maxLen;
          const a = K.ease(K.prog(t, p.t0 - 0.4 + i * 0.1, 0.5));
          e.track.style.opacity = String(0.2 * a);
          e.lab.style.opacity = String(a);
          // a change of lead: a pop on the new leader
          let flash = 0; for (const ct of changes) if (t >= ct && t - ct < 0.9 && i === lead) flash = 1 - K.spring(K.prog(t, ct, 0.5));
          const isLead = i === lead, glow = (isLead ? 0.5 + 0.2 * Math.sin(t * 2.2) : 0) + flash * 0.6;
          if (across) {
            e.bar.style.left = e.cx + 'px'; e.bar.style.top = e.cy - 14 + 'px'; e.bar.style.height = rowThick + 'px'; e.bar.style.width = len + 'px';
            e.val.style.left = e.cx + len + 26 + 'px'; e.val.style.top = e.cy - 14 + rowThick / 2 + 'px'; e.val.style.transform = `translateY(-50%) scale(${1 + 0.18 * flash})`;
          } else {
            e.bar.style.left = e.cx - e.bw / 2 + 'px'; e.bar.style.width = e.bw + 'px'; e.bar.style.top = baseY - len + 'px'; e.bar.style.height = len + 'px';
            e.val.style.left = e.cx + 'px'; e.val.style.top = baseY - len - 22 + 'px'; e.val.style.transform = `translate(-50%, -100%) scale(${1 + 0.18 * flash})`;
          }
          e.bar.style.opacity = String(a);
          e.bar.style.boxShadow = glow > 0.01 ? `0 0 ${30 + 40 * glow}px color-mix(in srgb, var(--accent) ${Math.round(25 + 35 * glow)}%, transparent)` : 'none';
          e.val.textContent = (dec ? v.toFixed(1) : String(Math.round(v)));
          e.val.style.color = isLead ? 'var(--accent-hi)' : 'var(--ink)';
          e.val.style.opacity = String(a);
          e.mb(Math.min(9, rate * 0.5));
        });
        // the equal line, drawn as the bars meet
        if (p.lockEqual && n > 1) {
          const q = K.ease(K.prog(t, p.t0 + p.dur * 0.88, 0.45));
          const lvl = (mean / axisMax) * maxLen;
          if (across) { eqLine.style.left = els[0].cx + lvl + 'px'; eqLine.style.top = -(n * pitch) / 2 + 10 + 'px'; eqLine.style.width = '4px'; eqLine.style.height = n * pitch - 20 + 'px'; eqLine.style.transformOrigin = 'center top'; eqLine.style.transform = `scaleY(${q})`; }
          else { const l = els[0].cx - els[0].bw / 2 - 30, r = els[n - 1].cx + els[n - 1].bw / 2 + 30; eqLine.style.left = l + 'px'; eqLine.style.width = r - l + 'px'; eqLine.style.top = baseY - lvl - 2 + 'px'; eqLine.style.transform = `scaleX(${q})`; }
          eqLine.style.opacity = String(q > 0 ? 0.9 : 0);
        } else eqLine.style.opacity = '0';
      },
    };
  };
})();
