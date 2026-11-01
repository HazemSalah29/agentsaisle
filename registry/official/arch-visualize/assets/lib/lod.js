// Level of detail: how much of the diagram to draw at a zoom level. Pure.
(function (root) {
  "use strict";
  var FAR = 0.4; // below this: tier bands, group boxes and icons only
  var NEAR = 0.7; // from this: technology lines, risk badges and connection labels as well

  /** "far", "mid" or "near" for the zoom factor `k`. */
  function level(k) {
    return k < FAR ? "far" : k < NEAR ? "mid" : "near";
  }

  root.ArchLod = { level: level, FAR: FAR, NEAR: NEAR };
})(typeof globalThis !== "undefined" ? globalThis : this);
