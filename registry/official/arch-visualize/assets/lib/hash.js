// Deep links: the part of the address after "#" holds the view (lens, selection, flow step, camera).
// Only known keys with valid values survive; anything else is dropped. Pure.
(function (root) {
  "use strict";

  var LENSES = ["system", "flows", "security", "failure", "ai", "diff"];
  var ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
  var ORDER = ["lens", "node", "edge", "down", "flow", "step", "x", "y", "k"];

  function clamp(v, lo, hi) {
    return Math.min(hi, Math.max(lo, v));
  }
  function round(v) {
    return Math.round(v * 10) / 10;
  }

  /** `#lens=flows&node=redis&k=1.2` -> { lens, node, k }. Invalid or unknown parts are left out. */
  function parseHash(text) {
    var out = {};
    String(text || "")
      .replace(/^#/, "")
      .split("&")
      .forEach(function (pair) {
        var i = pair.indexOf("=");
        if (i < 1) return;
        var key = pair.slice(0, i);
        var raw;
        try {
          raw = decodeURIComponent(pair.slice(i + 1));
        } catch (e) {
          void e; // a broken escape sequence: ignore this part
          return;
        }
        if (ORDER.indexOf(key) < 0 || key in out) return;
        if (key === "lens") {
          if (LENSES.indexOf(raw) >= 0) out.lens = raw;
        } else if (key === "down") {
          var ids = raw.split(",");
          if (
            ids.length <= 10 &&
            ids.every(function (id) {
              return ID.test(id);
            })
          )
            out.down = raw;
        } else if (key === "node" || key === "edge" || key === "flow") {
          if (ID.test(raw)) out[key] = raw;
        } else if (/^-?\d+(\.\d+)?$/.test(raw)) {
          var v = parseFloat(raw);
          if (!isFinite(v)) return;
          if (key === "step") out.step = clamp(Math.round(v), 0, 999);
          else if (key === "k") out.k = clamp(round(v * 100) / 100, 0.2, 3);
          else out[key] = clamp(round(v), -100000, 100000);
        }
      });
    return out;
  }

  /** The inverse of parseHash, with keys in a fixed order so the same view gives the same link. */
  function buildHash(state) {
    var parts = [];
    ORDER.forEach(function (key) {
      var v = state && state[key];
      if (v === undefined || v === null || v === "") return;
      if (key === "lens" && LENSES.indexOf(v) < 0) return;
      if ((key === "node" || key === "edge" || key === "flow") && !ID.test(v)) return;
      if (key === "down" && !/^[a-z0-9][a-z0-9-]{0,63}(,[a-z0-9][a-z0-9-]{0,63}){0,9}$/.test(v))
        return;
      if (typeof v === "number" && !isFinite(v)) return;
      var text = typeof v === "number" ? (key === "k" ? round(v * 100) / 100 : round(v)) : v;
      parts.push(key + "=" + encodeURIComponent(String(text)));
    });
    return parts.length ? "#" + parts.join("&") : "";
  }

  root.ArchHash = { parseHash: parseHash, buildHash: buildHash, LENSES: LENSES };
})(typeof globalThis !== "undefined" ? globalThis : this);
