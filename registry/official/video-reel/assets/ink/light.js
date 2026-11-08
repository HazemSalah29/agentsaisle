// light.js: lighting as a multiply pass. The whole layer sits in a cool ambient, and each practical light
// (lamp, candle, window, phone) adds its own pool with a warm spill. One visible warm source per scene.
// Needs ink.js. Order per frame: draw the world into a layer, Ink.lightPass(layer, ...), put the layer on the canvas,
// then the emissive bits and Ink.bloom on top (the lamp shade fill, flame, screen).
(function (g) {
  const Ink = g.Ink, { scratch, rgba, clamp, noise1, quad, stroke } = Ink;

  /**
   * lights: [{ x, y, r, color, a, sx (x-stretch), sy (y-stretch), falloff }] in canvas px
   * ambient: hex the unlit layer multiplies by (lighter = brighter grade). keepAlpha keeps the layer's holes (a window cut-out).
   */
  function lightPass(ctx, w, h, { ambient = '#6C7898', lights = [], exposure = 1, keepAlpha = false } = {}) {
    let keep = null;
    if (keepAlpha) { const [kc, kx] = scratch('lightKeep' + w, w, h); kx.clearRect(0, 0, w, h); kx.drawImage(ctx.canvas, 0, 0); keep = kc; }
    const [c, x] = scratch('light' + w, w, h);
    x.fillStyle = ambient; x.fillRect(0, 0, w, h);
    x.globalCompositeOperation = 'lighter';
    for (const L of lights) {
      const a = clamp(L.a ?? 1, 0, 2);
      if (a <= 0 || L.r <= 0) continue;
      x.save(); x.translate(L.x, L.y); x.scale(L.sx ?? 1, L.sy ?? 1);
      const gr = x.createRadialGradient(0, 0, 0, 0, 0, L.r);
      const falloff = L.falloff ?? 0.4;
      gr.addColorStop(0, rgba(L.color, Math.min(1, a))); gr.addColorStop(falloff, rgba(L.color, Math.min(1, a) * 0.55)); gr.addColorStop(1, rgba(L.color, 0));
      x.fillStyle = gr; x.fillRect(-L.r, -L.r, L.r * 2, L.r * 2);
      x.restore();
    }
    x.globalCompositeOperation = 'source-over';
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'multiply'; ctx.drawImage(c, 0, 0);
    if (exposure !== 1) { ctx.globalCompositeOperation = exposure > 1 ? 'screen' : 'multiply'; ctx.fillStyle = exposure > 1 ? `rgba(255,240,220,${clamp(exposure - 1, 0, 0.6)})` : `rgba(0,0,0,${clamp(1 - exposure, 0, 1)})`; ctx.fillRect(0, 0, w, h); }
    if (keep) { ctx.globalCompositeOperation = 'destination-in'; ctx.drawImage(keep, 0, 0); }
    ctx.restore();
  }

  /** additive bloom pool for emissive things (after the multiply) */
  function bloom(ctx, x, y, r, color, a = 0.35, sx = 1, sy = 1) {
    if (a <= 0 || r <= 0) return;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.translate(x, y); ctx.scale(sx, sy);
    const gr = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
    gr.addColorStop(0, rgba(color, a)); gr.addColorStop(0.3, rgba(color, a * 0.4)); gr.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = gr; ctx.fillRect(-r, -r, r * 2, r * 2); ctx.restore();
  }

  /**
   * One practical light as data: Ink.practical('lamp', x, y, {k, a, t, color, spill}).
   * x, y = where the light sits on the canvas; k = pixels per metre there (cam.k(P)); a = 0..1 on/off; t = film time (candle flicker).
   * kind: 'lamp' | 'candle' | 'window' | 'phone'. Returns { lights, emit(ctx) }:
   * put `lights` in lightPass, call emit(ctx) after the layer is drawn (bloom, and the flame for a candle).
   * A window is a light too: pass color (cool for moon, warm for dawn) and w (window width px) for its pool.
   */
  function practical(kind, x, y, o = {}) {
    const k = o.k ?? 300, a = clamp(o.a ?? 1), t = o.t ?? 0, amber = o.color || Ink.pal.amber;
    const warm = o.warm || '#F7C47E', spill = o.spill || '#B87A40';
    if (kind === 'lamp') return {
      lights: [
        { x, y: y + 0.25 * k, r: 2.3 * k, color: warm, a, sy: 1.15, falloff: 0.3 },
        { x: x + 0.9 * k * (o.spillSide ?? 1), y: y + 1.5 * k, r: 3.6 * k, color: spill, a: 0.75 * a, sx: 1.5, falloff: 0.25 },
      ],
      emit(ctx) { bloom(ctx, x, y + 0.05 * k, 1.9 * k, amber, 0.45 * a); bloom(ctx, x, y + 0.05 * k, 0.55 * k, '#FFE2AE', 0.5 * a); },
    };
    if (kind === 'candle') {
      const fl = 1 + 0.06 * noise1(t * 8, 3);
      return {
        lights: [{ x, y, r: (o.r ?? 2.4) * k, color: '#E9A45E', a: a * fl, falloff: 0.2 }],
        emit(ctx) { flame(ctx, x, y, o.s ?? k * 0.25, t, o.seed ?? 5, a); },
      };
    }
    if (kind === 'phone') return {
      lights: [{ x, y: y - 10, r: o.r ?? 260, color: '#F2D7A8', a: 0.9 * a, falloff: 0.3 }],
      emit(ctx) { bloom(ctx, x, y, 90, '#F0C27A', 0.35 * a); },
    };
    // window
    return {
      lights: [{ x, y: y + 60, r: (o.w ?? 700) * 0.95, color: o.color || '#3C4C80', a: o.a ?? 0.5, sy: 0.6, falloff: 0.3 }],
      emit() {},
    };
  }

  /** a candle flame (emissive; draw after lighting). k = 0..1 alive */
  function flame(ctx, x, y, s, t, seed = 1, k = 1) {
    if (k <= 0) return;
    const fl = 1 + 0.12 * noise1(t * 9 + seed, seed) + 0.06 * Math.sin(t * 23 + seed);
    const lean = noise1(t * 3 + seed * 2, seed + 1) * 0.25 + (fl - 1);
    const h = s * 0.55 * fl * k, w = s * 0.18 * k;
    ctx.save();
    const gr = ctx.createRadialGradient(x, y - h * 0.3, 0, x, y - h * 0.3, s * 3.2 * k);
    gr.addColorStop(0, 'rgba(255,214,140,0.55)'); gr.addColorStop(0.25, 'rgba(240,177,90,0.22)'); gr.addColorStop(1, 'rgba(240,177,90,0)');
    ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = gr; ctx.fillRect(x - s * 3.4, y - s * 3.6, s * 6.8, s * 6.8);
    ctx.globalCompositeOperation = 'source-over';
    const tip = [x + lean * w * 2, y - h];
    const outer = [[x - w, y], ...quad([x - w, y], [x - w * 1.1, y - h * 0.55], tip, 8), ...quad(tip, [x + w * 1.1, y - h * 0.55], [x + w, y], 8), ...quad([x + w, y], [x, y + w * 1.2], [x - w, y], 6)];
    ctx.fillStyle = Ink.pal.amber; ctx.beginPath(); outer.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.fill();
    ctx.fillStyle = '#FFE7B0'; ctx.beginPath(); ctx.ellipse(x + lean * w * 0.6, y - h * 0.28, w * 0.5, h * 0.3, lean * 0.3, 0, Math.PI * 2); ctx.fill();
    stroke(ctx, outer, { closed: true, w: Math.max(1, s * 0.05), seed, amp: 0.3, alpha: 0.5, color: '#7a4a1a' });
    ctx.restore();
  }

  Object.assign(Ink, { lightPass, bloom, practical, flame });
})(typeof window !== 'undefined' ? window : globalThis);
