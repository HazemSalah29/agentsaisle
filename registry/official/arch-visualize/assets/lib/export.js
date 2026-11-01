// Helpers for saving the diagram as a picture: file names, XML escaping, the standalone SVG document and
// the largest safe PNG scale. Pure: the page does the DOM work, this file only builds strings and numbers.
(function (root) {
  "use strict";

  var MAX_SIDE = 16000; // browsers refuse canvases much larger than this on one side
  var MAX_PIXELS = 100000000;
  var FOOTER_H = 34;

  // The CSS properties copied from the live page into the exported picture. Nothing here can load a
  // resource (no background-image, no content, no filter or mask URLs).
  var STYLE_PROPS = [
    "fill",
    "fill-opacity",
    "stroke",
    "stroke-width",
    "stroke-dasharray",
    "opacity",
    "display",
    "visibility",
    "font-family",
    "font-size",
    "font-weight",
    "letter-spacing",
    "text-transform",
    "text-anchor",
    "direction",
    "unicode-bidi",
  ];

  /** A safe ASCII file name part: letters, digits and single hyphens; "architecture" when nothing is left. */
  function slug(name) {
    var s = String(name === undefined || name === null ? "" : name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40)
      .replace(/-+$/, "");
    return s || "architecture";
  }

  /** `shop.architecture.svg`, `shop.architecture@2x.png`. */
  function fileName(project, ext, suffix) {
    return slug(project) + ".architecture" + (suffix || "") + "." + ext;
  }

  /** Escape text for XML, and drop the characters XML 1.0 does not allow at all. */
  function xmlEscape(text) {
    return String(text === undefined || text === null ? "" : text)
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  function num(v) {
    return String(Math.round(v * 10) / 10);
  }

  /**
   * The standalone SVG file. `body` is already serialised markup for the diagram (made from text nodes by
   * the page); the title and the footer line are escaped here.
   */
  function svgDocument(o) {
    var w = Math.max(1, o.width),
      h = Math.max(1, o.height) + FOOTER_H;
    var rtl = o.dir === "rtl";
    var footerX = rtl ? w - 16 : 16;
    return (
      '<svg xmlns="http://www.w3.org/2000/svg" lang="' +
      xmlEscape(o.lang || "en") +
      '" width="' +
      num(w) +
      '" height="' +
      num(h) +
      '" viewBox="0 0 ' +
      num(w) +
      " " +
      num(h) +
      '">' +
      "<title>" +
      xmlEscape(o.title) +
      "</title>" +
      '<rect width="100%" height="100%" fill="' +
      xmlEscape(o.background || "#ffffff") +
      '"/>' +
      o.body +
      '<text x="' +
      num(footerX) +
      '" y="' +
      num(h - 12) +
      '" fill="' +
      xmlEscape(o.footerColor || "#55524b") +
      '" font-family="system-ui, sans-serif" font-size="12" direction="' +
      (rtl ? "rtl" : "ltr") +
      '" unicode-bidi="plaintext">' +
      xmlEscape(o.title) +
      " · " +
      xmlEscape(o.note) +
      "</text></svg>"
    );
  }

  /** The largest scale up to `wanted` (1 to 3) that keeps the picture within the canvas limits. */
  function scaleFor(width, height, wanted) {
    var s = Math.max(1, wanted || 1);
    s = Math.min(s, MAX_SIDE / Math.max(1, width), MAX_SIDE / Math.max(1, height));
    s = Math.min(s, Math.sqrt(MAX_PIXELS / Math.max(1, width * height)));
    return Math.max(0.1, Math.floor(s * 100) / 100);
  }

  root.ArchExport = {
    slug: slug,
    fileName: fileName,
    xmlEscape: xmlEscape,
    svgDocument: svgDocument,
    scaleFor: scaleFor,
    STYLE_PROPS: STYLE_PROPS,
    FOOTER_H: FOOTER_H,
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
