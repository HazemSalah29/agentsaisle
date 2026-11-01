// ---- layout: computed by the shared layout module (assets/lib), so tests run the same code
var W = 190,
  H = 64;
var lay = ArchLayout.layout(model);
if (FLOW_RTL) lay = ArchLayout.mirror(lay);
var present = lay.layers.map(function (l) {
  return l.tier;
});
var cols = lay.layers.map(function (l) {
  return l.nodes.map(function (id) {
    return nodeById[id];
  });
});
var pos = lay.pos;
var contentW = lay.size.w,
  contentH = lay.size.h;

// ---- draw the diagram
var canvas = $("canvas");
var defs = s(
  "defs",
  {},
  s(
    "marker",
    {
      id: "arrow",
      viewBox: "0 0 10 10",
      refX: "9",
      refY: "5",
      markerWidth: "8",
      markerHeight: "8",
      orient: "auto",
    },
    s("path", { d: "M0 1 L10 5 L0 9 z", class: "arrow" }),
  ),
);
var vp = s("g", { id: "viewport" });
canvas.append(defs, vp);
lay.groups.forEach(function (g) {
  vp.append(
    s(
      "g",
      { class: "group", "data-group": g.id },
      s("rect", { x: g.x, y: g.y, width: g.w, height: g.h, rx: 6 }),
      s("text", { x: RTL ? g.x + g.w - 10 : g.x + 10, y: g.y + 16 }, clip(g.label, 40)),
    ),
  );
});
lay.layers.forEach(function (l, ci) {
  vp.append(
    s(
      "text",
      {
        x: RTL ? l.x + W : l.x,
        y: 36,
        class: "tier-label",
      },
      tierName(present[ci]),
    ),
  );
});
var edgeEls = {},
  nodeEls = {},
  cardEls = {};
var gEdges = s("g", { id: "edges" });
var gNodes = s("g", { id: "nodes" });
vp.append(gEdges, gNodes);
model.edges.forEach(function (e) {
  if (!pos[e.from] || !pos[e.to]) return;
  var d = lay.routes[e.id].d;
  var g = s("g", {
    class: "edge" + (isInferred("edge", e.id) ? " inferred" : ""),
    "data-edge": e.id,
  });
  g.append(
    s("path", { d: d, class: "hit" }),
    s("path", {
      d: d,
      class: "line",
      id: "edge-" + e.id,
      "data-edge": e.id,
      "marker-end": "url(#arrow)",
    }),
  );
  g.addEventListener("click", function (ev) {
    ev.stopPropagation();
    if (!moved) select("edge", e.id);
  });
  edgeEls[e.id] = g;
  gEdges.append(g);
});
model.nodes.forEach(function (n) {
  var p = pos[n.id];
  var risks = risksByNode[n.id] || [];
  var label =
    t("node.aria", { label: n.label, tech: techText(n), role: roleName(n.role) }) +
    (isInferred("node", n.id) ? t("node.aria.inferred") : "") +
    (risks.length ? tn("node.aria.risks", risks.length) : "");
  var g = s("g", {
    class: "node" + (isInferred("node", n.id) ? " inferred" : ""),
    "data-node": n.id,
    transform: "translate(" + p.x + " " + p.y + ")",
    tabindex: "0",
    role: "button",
    "aria-label": label,
  });
  g.append(
    s("title", {}, label),
    s("rect", { class: "ring", x: -4, y: -4, width: W + 8, height: H + 8, rx: 10 }),
    s("rect", { class: "box", width: W, height: H, rx: 7 }),
  );
  var ic = iconSvg(n, 32, "icon", RTL ? W - 46 : 14, 16);
  if (ic) g.append(ic);
  g.append(
    s("text", { class: "name", x: RTL ? W - 58 : 58, y: 28 }, clip(n.label, 17)),
    s("text", { class: "sub", x: RTL ? W - 58 : 58, y: 47 }, clip(techText(n), 20)),
  );
  if (risks.length)
    g.append(
      s(
        "g",
        { class: "badge", transform: "translate(" + (W - 4) + " 4)" },
        s("circle", { r: 11 }),
        s("text", { y: 4.5 }, String(risks.length)),
      ),
    );
  g.addEventListener("click", function (ev) {
    ev.stopPropagation();
    if (!moved) select("node", n.id);
  });
  g.addEventListener("keydown", function (ev) {
    if (ev.key === "Enter" || ev.key === " ") {
      ev.preventDefault();
      ev.stopPropagation();
      select("node", n.id);
    }
  });
  nodeEls[n.id] = g;
  gNodes.append(g);
});
