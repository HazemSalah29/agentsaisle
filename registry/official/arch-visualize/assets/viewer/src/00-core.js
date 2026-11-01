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

// ---- text: every string the page shows comes from the table the build embedded (assets/viewer/i18n.json)
var I18N = { lang: "en", dir: "ltr", strings: {} };
try {
  I18N = JSON.parse($("i18n").textContent);
} catch (e) {
  // keys are shown as they are
}
var RTL = I18N.dir === "rtl";
var FLOW_RTL = document.documentElement.getAttribute("data-flow") === "rtl";
var pluralRules = null;
try {
  pluralRules = new Intl.PluralRules(I18N.lang);
} catch (e) {
  // falls back to one/other
}
function fill(text, vars) {
  return text.replace(/\{(\w+)\}/g, function (m, k) {
    return vars && vars[k] !== undefined ? String(vars[k]) : m;
  });
}
function t(key, vars) {
  var v = I18N.strings[key];
  return fill(v === undefined ? key : v, vars);
}
/** The plural form of `key` for the count `n` (key.one, key.few, ..., falling back to key.other). */
function tn(key, n, vars) {
  var form = pluralRules ? pluralRules.select(n) : n === 1 ? "one" : "other";
  var v = I18N.strings[key + "." + form];
  if (v === undefined) v = I18N.strings[key + ".other"];
  return fill(v === undefined ? key : v, Object.assign({ n: n }, vars));
}

// ---- data
var model, icons;
try {
  model = JSON.parse($("model").textContent);
  icons = JSON.parse($("icons").textContent);
} catch (e) {
  clear($("body"));
  $("body").append(t("data.error"));
  return;
}
document.title = t("doc.title", { project: model.project });
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
var tierName = function (tier) {
  return t("tier." + (TIER_NAME[tier] ? tier : "misc"));
};
var roleName = function (role) {
  return I18N.strings["role." + role] !== undefined ? t("role." + role) : role;
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
/** The security facts of a connection as short text: "jwt · TLS", "no auth · TLS ?"; empty if none recorded. */
var secText = function (e) {
  var parts = [];
  if (e.auth) parts.push(t("auth." + e.auth));
  if (e.tls === true) parts.push(t("tls.yes"));
  else if (e.tls === false) parts.push(t("tls.no"));
  else if (e.tls === "unknown") parts.push(t("tls.unknown"));
  return parts.join(" · ");
};
var zoneOf = function (id) {
  return nodeById[id] && nodeById[id].zone;
};
var techText = function (n) {
  return n.tech.indexOf("generic-") === 0 ? roleName(n.role) : n.tech;
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
