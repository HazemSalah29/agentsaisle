// The camera path of a zoom into a component, as pure numbers. The inner diagram is drawn at a small scale
// `m` inside the component's box and grows to full size while the camera moves in, so the eye follows the box
// that opens up. `frame(plan, e)` gives the camera, the inner scale and the two opacities at eased progress e
// (0 = the system diagram as it was, 1 = the inner diagram fitted to the stage).
(function (root) {
  "use strict";

  function clamp(v, lo, hi) {
    return Math.min(hi, Math.max(lo, v));
  }
  /** Ease in and out (cubic). */
  function ease(t) {
    t = clamp(t, 0, 1);
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }
  function smoothstep(a, b, x) {
    var t = clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  }
  /** Interpolate in log space, so a zoom feels the same speed all the way. */
  function logLerp(a, b, t) {
    return Math.exp(Math.log(a) + (Math.log(b) - Math.log(a)) * t);
  }
  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  /** The part of the stage that is free: { x0, y0, x1, y1 } in pixels. `inset` alone keeps the top free. */
  function regionOf(stage, opts) {
    var r = opts && opts.region;
    if (r)
      return {
        x0: r.x0,
        y0: r.y0,
        x1: Math.max(r.x1, r.x0 + 60),
        y1: Math.max(r.y1, r.y0 + 60),
      };
    var inset = (opts && opts.inset) || 0;
    return { x0: 0, y0: inset, x1: stage[0], y1: Math.max(stage[1], inset + 60) };
  }

  /**
   * The camera that fits a w x h inner diagram, centred on `c`, into the free part of the stage (`region`, or
   * the stage minus a top `inset` where the breadcrumb bar sits). With `minK`, a diagram too tall to read at
   * once keeps readable text, starts at the top and is left to the reader to pan.
   */
  function fitInner(stage, size, c, opts) {
    var pad = (opts && opts.pad) || 0.92;
    var maxK = (opts && opts.maxK) || 1.5;
    var r = regionOf(stage, opts);
    var w = r.x1 - r.x0,
      hh = r.y1 - r.y0;
    var cx = r.x0 + w / 2;
    var fit = clamp(Math.min((w * pad) / size[0], (hh * pad) / size[1], maxK), 0.2, 3);
    var minK = (opts && opts.minK) || 0;
    if (fit >= minK) return { k: fit, x: cx - fit * c[0], y: r.y0 + hh / 2 - fit * c[1] };
    var k = clamp(Math.min(minK, (w * pad) / size[0]), 0.2, 3);
    var top = c[1] - size[1] / 2;
    return { k: k, x: cx - k * c[0], y: r.y0 + 14 - k * top };
  }

  /**
   * o: { stage: [w, h], size: [w, h] of the inner diagram, node: { x, y, w, h } in diagram coordinates,
   * view: { x, y, k } the camera now }. The plan is plain data.
   */
  function plan(o) {
    var c = [o.node.x + o.node.w / 2, o.node.y + o.node.h / 2];
    var end = fitInner(o.stage, o.size, c, {
      pad: o.pad,
      maxK: o.maxK,
      inset: o.inset,
      region: o.region,
      minK: o.minK,
    });
    return {
      stage: o.stage,
      size: o.size,
      inset: o.inset || 0,
      c: c,
      // the inner diagram starts just inside the box it grows from
      m0: Math.min((o.node.w * 0.86) / o.size[0], (o.node.h * 0.86) / o.size[1], 1),
      k0: o.view.k,
      c0: [o.view.x + o.view.k * c[0], o.view.y + o.view.k * c[1]],
      end: end,
    };
  }

  /** The state at eased progress e (0 to 1). */
  function frame(p, e) {
    e = clamp(e, 0, 1);
    var k = logLerp(p.k0, p.end.k, e);
    var m = logLerp(p.m0, 1, e);
    // the box's centre travels from where it was to where the finished camera puts it
    var sx = lerp(p.c0[0], p.end.x + p.end.k * p.c[0], e);
    var sy = lerp(p.c0[1], p.end.y + p.end.k * p.c[1], e);
    return {
      k: k,
      m: m,
      x: sx - k * p.c[0],
      y: sy - k * p.c[1],
      overview: 1 - smoothstep(0.12, 0.62, e),
      detail: smoothstep(0.3, 0.85, e),
    };
  }

  /**
   * The way back, from wherever the camera is now (the reader may have panned): at e = 0 it is `cur` with the
   * inner diagram at full size, at e = 1 it is the system diagram exactly as it was before the zoom.
   */
  function reverse(p, cur, e) {
    e = clamp(e, 0, 1);
    var k = logLerp(cur.k, p.k0, e);
    var m = logLerp(1, p.m0, e);
    var cs = [cur.x + cur.k * p.c[0], cur.y + cur.k * p.c[1]];
    var sx = lerp(cs[0], p.c0[0], e);
    var sy = lerp(cs[1], p.c0[1], e);
    var back = 1 - e;
    return {
      k: k,
      m: m,
      x: sx - k * p.c[0],
      y: sy - k * p.c[1],
      overview: 1 - smoothstep(0.12, 0.62, back),
      detail: smoothstep(0.3, 0.85, back),
    };
  }

  /** SVG transform that puts the inner diagram, scaled by m, at the middle of the component's box. */
  function innerTransform(p, m) {
    var x = p.c[0] - (m * p.size[0]) / 2;
    var y = p.c[1] - (m * p.size[1]) / 2;
    return "translate(" + round(x) + " " + round(y) + ") scale(" + round(m * 10000) / 10000 + ")";
  }
  function round(v) {
    return Math.round(v * 100) / 100;
  }

  /** Where the middle of an inner card sits in diagram coordinates once the inner diagram is at full size. */
  function worldOf(p, pos) {
    return [
      p.c[0] - p.size[0] / 2 + pos.x + (pos.w || 0) / 2,
      p.c[1] - p.size[1] / 2 + pos.y + (pos.h || 0) / 2,
    ];
  }

  root.ArchZoom = {
    ease: ease,
    smoothstep: smoothstep,
    logLerp: logLerp,
    fitInner: fitInner,
    regionOf: regionOf,
    plan: plan,
    frame: frame,
    reverse: reverse,
    innerTransform: innerTransform,
    worldOf: worldOf,
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
