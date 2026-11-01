// Pure geometry helpers shared by the layout, the tests and the page. No DOM, no network, no timers.
// A rect is { x, y, w, h }; a point is [x, y]; a polyline is an array of points.
(function (root) {
  "use strict";

  function num(v) {
    return Math.round(v * 10) / 10;
  }

  /** True when the rects overlap by more than `gap` (touching edges do not count). */
  function rectsOverlap(a, b, gap) {
    var g = gap || 0;
    return a.x < b.x + b.w - g && b.x < a.x + a.w - g && a.y < b.y + b.h - g && b.y < a.y + a.h - g;
  }

  /** True when rect `inner` lies inside `outer` (edges may touch). */
  function rectInside(inner, outer) {
    return (
      inner.x >= outer.x &&
      inner.y >= outer.y &&
      inner.x + inner.w <= outer.x + outer.w &&
      inner.y + inner.h <= outer.y + outer.h
    );
  }

  /** The point where segments p1-p2 and p3-p4 properly cross, or null (parallel or touching ends only). */
  function segmentCross(p1, p2, p3, p4) {
    var d1x = p2[0] - p1[0],
      d1y = p2[1] - p1[1],
      d2x = p4[0] - p3[0],
      d2y = p4[1] - p3[1];
    var den = d1x * d2y - d1y * d2x;
    if (Math.abs(den) < 1e-9) return null;
    var t = ((p3[0] - p1[0]) * d2y - (p3[1] - p1[1]) * d2x) / den;
    var u = ((p3[0] - p1[0]) * d1y - (p3[1] - p1[1]) * d1x) / den;
    if (t <= 1e-9 || t >= 1 - 1e-9 || u <= 1e-9 || u >= 1 - 1e-9) return null;
    return [p1[0] + t * d1x, p1[1] + t * d1y];
  }

  function near(p, q, tol) {
    return Math.abs(p[0] - q[0]) <= tol && Math.abs(p[1] - q[1]) <= tol;
  }

  /**
   * How many times the polylines cross each other. A crossing within `endTolerance` px (default 10) of
   * either polyline's first or last point is ignored: edges that meet at the same node are not crossings.
   * Works on any polyline, so a curve sampled into points can be measured the same way.
   */
  function polylineCrossings(lines, opts) {
    var tol = opts && opts.endTolerance !== undefined ? opts.endTolerance : 10;
    var box = lines.map(function (l) {
      var x0 = Infinity,
        y0 = Infinity,
        x1 = -Infinity,
        y1 = -Infinity;
      l.forEach(function (p) {
        x0 = Math.min(x0, p[0]);
        y0 = Math.min(y0, p[1]);
        x1 = Math.max(x1, p[0]);
        y1 = Math.max(y1, p[1]);
      });
      return [x0, y0, x1, y1];
    });
    var count = 0;
    for (var i = 0; i < lines.length; i++) {
      for (var j = i + 1; j < lines.length; j++) {
        var a = box[i],
          b = box[j];
        if (a[0] > b[2] || b[0] > a[2] || a[1] > b[3] || b[1] > a[3]) continue;
        var li = lines[i],
          lj = lines[j];
        for (var s = 0; s + 1 < li.length; s++) {
          for (var t = 0; t + 1 < lj.length; t++) {
            var hit = segmentCross(li[s], li[s + 1], lj[t], lj[t + 1]);
            if (!hit) continue;
            if (
              near(hit, li[0], tol) ||
              near(hit, li[li.length - 1], tol) ||
              near(hit, lj[0], tol) ||
              near(hit, lj[lj.length - 1], tol)
            )
              continue;
            count++;
          }
        }
      }
    }
    return count;
  }

  /** True when segment p-q passes through the inside of `rect` shrunk by `inset` px on every side. */
  function segmentHitsRect(p, q, rect, inset) {
    var k = inset === undefined ? 2 : inset;
    var x0 = rect.x + k,
      y0 = rect.y + k,
      x1 = rect.x + rect.w - k,
      y1 = rect.y + rect.h - k;
    if (x1 <= x0 || y1 <= y0) return false;
    var dx = q[0] - p[0],
      dy = q[1] - p[1];
    var t0 = 0,
      t1 = 1;
    var ps = [-dx, dx, -dy, dy];
    var qs = [p[0] - x0, x1 - p[0], p[1] - y0, y1 - p[1]];
    for (var i = 0; i < 4; i++) {
      if (ps[i] === 0) {
        if (qs[i] <= 0) return false;
      } else {
        var r = qs[i] / ps[i];
        if (ps[i] < 0) {
          if (r > t1) return false;
          if (r > t0) t0 = r;
        } else {
          if (r < t0) return false;
          if (r < t1) t1 = r;
        }
      }
    }
    return t1 - t0 > 1e-9;
  }

  /**
   * Edge ids whose route passes through the inside of a node box. `routes` maps edge id to a polyline,
   * `rects` maps node id to a rect. Touching a box edge (where a line starts or ends) is allowed.
   */
  function edgesThroughNodes(routes, rects, inset) {
    var out = [];
    Object.keys(routes)
      .sort()
      .forEach(function (id) {
        var pts = routes[id];
        var hit = false;
        Object.keys(rects).forEach(function (nid) {
          for (var i = 0; !hit && i + 1 < pts.length; i++)
            if (segmentHitsRect(pts[i], pts[i + 1], rects[nid], inset)) hit = true;
        });
        if (hit) out.push(id);
      });
    return out;
  }

  /** Remove repeated points and points in the middle of a straight run. */
  function simplify(points) {
    var out = [];
    points.forEach(function (p) {
      if (out.length && out[out.length - 1][0] === p[0] && out[out.length - 1][1] === p[1]) return;
      while (out.length >= 2) {
        var a = out[out.length - 2],
          b = out[out.length - 1];
        var straight = (a[0] === b[0] && b[0] === p[0]) || (a[1] === b[1] && b[1] === p[1]);
        if (!straight) break;
        out.pop();
      }
      out.push(p);
    });
    return out;
  }

  /** SVG path data for a polyline with rounded corners (radius clipped to half of each side). */
  function roundedPath(points, radius) {
    var r = radius === undefined ? 8 : radius;
    if (!points.length) return "";
    var d = "M" + num(points[0][0]) + " " + num(points[0][1]);
    for (var i = 1; i < points.length; i++) {
      var p = points[i];
      var prev = points[i - 1];
      var next = points[i + 1];
      if (!next) {
        d += " L" + num(p[0]) + " " + num(p[1]);
        continue;
      }
      var inLen = Math.abs(p[0] - prev[0]) + Math.abs(p[1] - prev[1]);
      var outLen = Math.abs(next[0] - p[0]) + Math.abs(next[1] - p[1]);
      var rr = Math.min(r, inLen / 2, outLen / 2);
      if (rr <= 0) {
        d += " L" + num(p[0]) + " " + num(p[1]);
        continue;
      }
      var ux = Math.sign(p[0] - prev[0]),
        uy = Math.sign(p[1] - prev[1]);
      var vx = Math.sign(next[0] - p[0]),
        vy = Math.sign(next[1] - p[1]);
      d +=
        " L" +
        num(p[0] - ux * rr) +
        " " +
        num(p[1] - uy * rr) +
        " Q" +
        num(p[0]) +
        " " +
        num(p[1]) +
        " " +
        num(p[0] + vx * rr) +
        " " +
        num(p[1] + vy * rr);
    }
    return d;
  }

  /** FNV-1a (32 bit) of a string, as 8 hex digits. Used to compare layouts. */
  function hash(text) {
    var h = 0x811c9dc5;
    for (var i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return ("00000000" + h.toString(16)).slice(-8);
  }

  root.ArchGeometry = {
    rectsOverlap: rectsOverlap,
    rectInside: rectInside,
    segmentCross: segmentCross,
    segmentHitsRect: segmentHitsRect,
    polylineCrossings: polylineCrossings,
    edgesThroughNodes: edgesThroughNodes,
    simplify: simplify,
    roundedPath: roundedPath,
    hash: hash,
    round: num,
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
