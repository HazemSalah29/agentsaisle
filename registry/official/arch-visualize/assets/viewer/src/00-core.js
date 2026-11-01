var NS = "http://www.w3.org/2000/svg";
var $ = function (id) {
  return document.getElementById(id);
};

// ---- tiny DOM helpers. Model text only ever goes in as text nodes or attribute values.
function setAttrs(el, attrs) {
  for (var k in attrs || {}) {
    var v = attrs[k];
    if (v === false || v === null || v === undefined) continue;
    el.setAttribute(k, String(v));
  }
}
function add(el, kids) {
  kids.forEach(function (k) {
    if (Array.isArray(k)) return add(el, k);
    if (k === null || k === undefined || k === false) return;
    el.append(k instanceof Node ? k : document.createTextNode(String(k)));
  });
}
function h(tag, attrs) {
  var el = document.createElement(tag);
  setAttrs(el, attrs);
  add(el, Array.prototype.slice.call(arguments, 2));
  return el;
}
function s(tag, attrs) {
  var el = document.createElementNS(NS, tag);
  setAttrs(el, attrs);
  add(el, Array.prototype.slice.call(arguments, 2));
  return el;
}
function clear(el) {
  el.textContent = "";
}

// ---- data
var model, icons;
try {
  model = JSON.parse($("model").textContent);
  icons = JSON.parse($("icons").textContent);
} catch (e) {
  clear($("body"));
  $("body").append("This page could not read its data.");
  return;
}
document.title = model.project + " architecture";
$("title").textContent = model.project;

var TIERS = ["clients", "edge", "frontend", "backend", "async", "data", "external"];
var TIER_NAME = {
  clients: "Clients",
  edge: "Edge",
  frontend: "Frontend",
  backend: "Backend",
  async: "Async",
  data: "Data",
  external: "External",
  other: "Other",
};
var inferred = new Set(model.inferred || []);
var nodeById = {};
model.nodes.forEach(function (n) {
  nodeById[n.id] = n;
});
var edgeById = {};
model.edges.forEach(function (e) {
  edgeById[e.id] = e;
});
var risksByNode = {};
(model.risks || []).forEach(function (r) {
  r.nodes.forEach(function (id) {
    (risksByNode[id] = risksByNode[id] || []).push(r);
  });
});
var techText = function (n) {
  return n.tech.indexOf("generic-") === 0 ? n.role : n.tech;
};
var isInferred = function (kind, id) {
  return inferred.has(kind + ":" + id);
};
var clip = function (str, max) {
  return str.length > max ? str.slice(0, max - 1) + "…" : str;
};

function iconSvg(n, size, cls, x, y) {
  var ic = icons[n.tech + "|" + n.role];
  if (!ic) return null;
  var svg = s("svg", {
    viewBox: ic.viewBox,
    width: size,
    height: size,
    x: x,
    y: y,
    class: cls,
    "aria-hidden": "true",
  });
  ic.paths.forEach(function (d) {
    svg.append(s("path", { d: d, "fill-rule": "evenodd" }));
  });
  return svg;
}
