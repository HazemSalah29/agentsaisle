// finish.js: the paper finish. Gouache wash (low-frequency tone so flat fills do not read as vector),
// paper grain, soft vignette. All textures are built once from fixed seeds; none of it is a blur.
// Needs ink.js. Call Ink.finish(ctx, w, h, opts) last on a canvas, before any camera transform.
(function (g) {
  const Ink = g.Ink, { hash, noise2 } = Ink;
  const tex = {};

  /** paper grain with a few long fibres; drawn once per size and seed */
  function paperTexture(w, h, seed = 3) {
    const k = `${w}x${h}:${seed}`; if (tex[k]) return tex[k];
    const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
    const img = x.createImageData(w, h), d = img.data;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const n = hash(i + j * 9173, seed) * 0.6 + (noise2(i * 0.012, j * 0.012, seed) * 0.5 + 0.5) * 0.4 + (noise2(i * 0.002, j * 0.002, seed + 4) * 0.5 + 0.5) * 0.25;
      const v = 255 - n * 46; const o = (j * w + i) * 4; d[o] = v; d[o + 1] = v - 3; d[o + 2] = v - 10; d[o + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    for (let i = 0; i < w * h / 9000; i++) {
      const px = hash(i, seed + 9) * w, py = hash(i, seed + 10) * h, a = hash(i, seed + 11) * Math.PI, L = 6 + hash(i, seed + 12) * 22;
      x.strokeStyle = `rgba(90,70,50,${0.05 + hash(i, seed + 13) * 0.08})`; x.lineWidth = 0.7; x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(a) * L, py + Math.sin(a) * L); x.stroke();
    }
    tex[k] = c; return c;
  }

  /** low-frequency tone map: noise computed at quarter size, stretched up (smooth by construction) */
  function washTexture(w, h, seed = 7) {
    const k = `wash${w}x${h}:${seed}`; if (tex[k]) return tex[k];
    const sw = Math.ceil(w / 4), sh = Math.ceil(h / 4);
    const c = document.createElement('canvas'); c.width = sw; c.height = sh; const x = c.getContext('2d');
    const img = x.createImageData(sw, sh), d = img.data;
    for (let j = 0; j < sh; j++) for (let i = 0; i < sw; i++) {
      const n = noise2(i * 0.03, j * 0.03, seed) * 0.6 + noise2(i * 0.09, j * 0.09, seed + 1) * 0.3 + noise2(i * 0.25, j * 0.25, seed + 2) * 0.1;
      const v = 128 + n * 60; const o = (j * sw + i) * 4; d[o] = v; d[o + 1] = v; d[o + 2] = v; d[o + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    const big = document.createElement('canvas'); big.width = w; big.height = h; const bx = big.getContext('2d');
    bx.imageSmoothingQuality = 'high'; bx.drawImage(c, 0, 0, w, h);
    tex[k] = big; return big;
  }

  /**
   * finish a canvas: gouache wash, paper grain, vignette. Each is an option (0 turns it off).
   * grain / wash 0..~0.4, vignette 0..1; vignetteTint is the rgb the edges multiply toward (default warm dark);
   * grainScale < 1 builds the grain smaller and stretches it (faster, chunkier paper); seed picks the paper.
   */
  function finish(ctx, w, h, { grain = 0.16, wash = 0.22, vignette = 0.35, seed = 3, grainScale = 0.5, vignetteTint = [150, 160, 140] } = {}) {
    ctx.save();
    if (wash > 0) { ctx.globalCompositeOperation = 'soft-light'; ctx.globalAlpha = wash; ctx.drawImage(washTexture(w, h, seed + 4), 0, 0); }
    if (grain > 0) {
      const gw = Math.round(w * grainScale), gh = Math.round(h * grainScale);
      ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = grain * 2.2; ctx.drawImage(paperTexture(gw, gh, seed), 0, 0, w, h);
    }
    if (vignette > 0) {
      ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = 1;
      const gr = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.hypot(w, h) * 0.6);
      const [r, gg, b] = vignetteTint;
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, `rgba(${Math.round(255 - r * vignette)},${Math.round(255 - gg * vignette)},${Math.round(255 - b * vignette)},1)`);
      ctx.fillStyle = gr; ctx.fillRect(0, 0, w, h);
    }
    ctx.restore();
  }

  Object.assign(Ink, { paperTexture, washTexture, finish });
})(typeof window !== 'undefined' ? window : globalThis);
