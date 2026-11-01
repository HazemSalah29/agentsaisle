// ---- the Diff lens: what changed since an earlier model. Added and changed items are marked on the
// current drawing; items that are gone are drawn as dashed ghosts where they used to be. Ghosts live only
// in this layer: search, lists, risks and the what-if simulation never see them.
var diffNodeKind = {},
  diffEdgeKind = {},
  diffChanges = {},
  diffRenamedFrom = {},
  diffGhosts = {};

function diffMark(kind, id, how, changes) {
  var els = kind === "node" ? nodeEls : edgeEls;
  (kind === "node" ? diffNodeKind : diffEdgeKind)[id] = how;
  if (changes && changes.length) diffChanges[kind + ":" + id] = changes;
  var g = els[id];
  if (!g) return;
  g.classList.add("d-" + how);
  if (kind !== "node") return;
  var sign = how === "added" ? "+" : "~";
  g.append(
    s(
      "g",
      { class: "d-chip", transform: "translate(" + W / 2 + " 2)" },
      s("circle", { r: 11 }),
      s("text", { y: 5 }, sign),
    ),
  );
  var aria = g.getAttribute("aria-label") || "";
  var say = {
    added: t("diff.aria.added"),
    changed: t("diff.aria.changed"),
    renamed: t("diff.aria.renamed"),
  };
  g.setAttribute("aria-label", aria + say[how]);
}

function ghostChip(x, y) {
  return s(
    "g",
    { class: "d-chip", transform: "translate(" + x + " " + y + ")" },
    s("circle", { r: 11 }),
    s("text", { y: 5 }, "−"),
  );
}

function drawGhosts() {
  var layer = s("g", { id: "ghosts", class: "ghost" });
  vp.insertBefore(layer, gEdges);
  ghostEdges.forEach(function (e) {
    var route = lay.routes[e.id];
    if (!route) return;
    var g = s(
      "g",
      { class: "ghost-edge", "data-ghost-edge": e.id },
      s("path", { d: route.d, class: "hit" }),
      s("path", { d: route.d, class: "line" }),
    );
    g.addEventListener("click", function (ev) {
      ev.stopPropagation();
      showGhost("edge", e);
    });
    diffGhosts["edge:" + e.id] = e;
    layer.append(g);
  });
  ghostNodes.forEach(function (n) {
    var p = pos[n.id];
    if (!p) return;
    var label = t("node.aria", { label: n.label, tech: techText(n), role: roleName(n.role) });
    var g = s(
      "g",
      {
        class: "ghost-node",
        "data-ghost-node": n.id,
        transform: "translate(" + p.x + " " + p.y + ")",
        tabindex: "0",
        role: "button",
        "aria-label": label + t("diff.aria.removed"),
      },
      s("rect", { class: "box", width: W, height: H, rx: 10 }),
      s("text", { class: "name", x: RTL ? W - 14 : 14, y: 29 }, clip(n.label, 20)),
      s("text", { class: "sub", x: RTL ? W - 14 : 14, y: 47 }, clip(techText(n), 20)),
      ghostChip(W / 2, 2),
    );
    var open = function () {
      showGhost("node", n);
    };
    g.addEventListener("click", function (ev) {
      ev.stopPropagation();
      open();
    });
    g.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        open();
      }
    });
    diffGhosts["node:" + n.id] = n;
    layer.append(g);
  });
}

if (DIFF) {
  DIFF.nodes.added.forEach(function (n) {
    diffMark("node", n.id, "added");
  });
  DIFF.nodes.changed.forEach(function (n) {
    diffMark("node", n.id, "changed", n.changes);
  });
  DIFF.nodes.renamed.forEach(function (r) {
    diffRenamedFrom[r.to] = r.from;
    diffMark("node", r.to, "renamed", r.changes);
  });
  DIFF.edges.added.forEach(function (e) {
    diffMark("edge", e.id, "added");
  });
  DIFF.edges.changed.forEach(function (e) {
    diffMark("edge", e.id, "changed", e.changes);
  });
  drawGhosts();
}

/** One value of a changed fact as short text. */
function diffValue(v) {
  if (v === null || v === undefined || v === "") return t("diff.empty");
  if (Array.isArray(v)) return v.length ? v.join(", ") : t("diff.empty");
  if (typeof v === "object") return clip(JSON.stringify(v), 60);
  return String(v);
}
function diffRows(changes) {
  return kv(
    changes.map(function (c) {
      return [
        h("code", {}, c.field),
        t("diff.arrow", { before: diffValue(c.before), after: diffValue(c.after) }),
      ];
    }),
  );
}
/** Panel sections for a selected current component or connection. */
function diffExtras(kind, id) {
  var out = [];
  if (kind === "node" && diffRenamedFrom[id])
    out.push(h("p", { class: "note" }, t("diff.wasNamed", { old: diffRenamedFrom[id] })));
  var changes = diffChanges[kind + ":" + id];
  if (changes && changes.length) out.push(h("h3", {}, t("diff.what")), diffRows(changes));
  return out;
}
/** The panel for a ghost: what it was, and that it is no longer in the model. */
function showGhost(kind, item) {
  tab = "details";
  sel = null;
  panel.classList.add("open");
  clear(body);
  if (kind === "node") {
    body.append(
      h("h2", {}, item.label),
      h(
        "p",
        { class: "meta" },
        t("node.meta", {
          tech: techText(item),
          role: roleName(item.role),
          tier: tierName(item.tier),
        }),
      ),
    );
  } else {
    body.append(
      h("h2", {}, t("diff.edge", { from: diffLabel(item.from), to: diffLabel(item.to) })),
      item.protocol ? h("p", { class: "meta" }, item.protocol) : "",
    );
  }
  body.append(h("p", { class: "note" }, t("diff.ghost")));
  if (item.evidence && item.evidence.length) {
    var ul = h("ul", { class: "panel-list" });
    item.evidence.forEach(function (e) {
      ul.append(h("li", {}, h("code", {}, e.file + (e.line ? ":" + e.line : ""))));
    });
    body.append(ul);
  }
}
function diffLabel(id) {
  var n = nodeById[id] || diffGhosts["node:" + id];
  return n ? n.label : id;
}

function diffButton(text, action) {
  var li = h("li", {});
  var b = h("button", { type: "button" }, text);
  b.addEventListener("click", action);
  li.append(b);
  return li;
}
function diffSection(title, items) {
  if (!items.length) return [];
  var ul = h("ul", { class: "diff-list" });
  items.forEach(function (x) {
    ul.append(x);
  });
  return [h("h3", {}, title), ul];
}
function goNode(id) {
  select("node", id, true);
  centerOnNodes([id]);
}
/** What the panel shows in the Diff lens when nothing is selected. */
function diffIntro() {
  var out = [h("h2", {}, t("diff.title"))];
  if (!DIFF) return out;
  out.push(
    h("p", { class: "note" }, t("diff.note", { project: DIFF.base.project || model.project })),
    h(
      "p",
      { class: "diff-legend" },
      h("span", { class: "k-added" }, "+ " + t("diff.legend.added")),
      h("span", { class: "k-changed" }, "~ " + t("diff.legend.changed")),
      h("span", { class: "k-removed" }, "− " + t("diff.legend.removed")),
    ),
  );
  if (DIFF.empty) return out.concat([h("p", { class: "meta" }, t("diff.none"))]);
  var edgeText = function (e) {
    return t("diff.edge", { from: diffLabel(e.from), to: diffLabel(e.to) });
  };
  var added = DIFF.nodes.added
    .map(function (n) {
      return diffButton(n.label, function () {
        goNode(n.id);
      });
    })
    .concat(
      DIFF.edges.added.map(function (e) {
        return diffButton(edgeText(e), function () {
          select("edge", e.id, true);
        });
      }),
    );
  var removed = DIFF.nodes.removed
    .map(function (n) {
      return diffButton(n.label, function () {
        centerOnNodes([n.id]);
        showGhost("node", n);
      });
    })
    .concat(
      DIFF.edges.removed.map(function (e) {
        return diffButton(edgeText(e), function () {
          showGhost("edge", e);
        });
      }),
    );
  var changed = DIFF.nodes.changed
    .map(function (n) {
      return diffButton(n.label || n.id, function () {
        goNode(n.id);
      });
    })
    .concat(
      DIFF.edges.changed.map(function (e) {
        return diffButton(edgeText(e), function () {
          select("edge", e.id, true);
        });
      }),
    );
  var renamed = DIFF.nodes.renamed.map(function (r) {
    return diffButton((r.label || r.to) + " · " + r.from + " → " + r.to, function () {
      goNode(r.to);
    });
  });
  var plain = function (list) {
    return list.map(function (r) {
      return h("li", {}, r.title || r.id);
    });
  };
  return out
    .concat(diffSection(t("diff.added", { n: added.length }), added))
    .concat(diffSection(t("diff.changed", { n: changed.length }), changed))
    .concat(diffSection(t("diff.renamed", { n: renamed.length }), renamed))
    .concat(diffSection(t("diff.removed", { n: removed.length }), removed))
    .concat(
      diffSection(t("diff.risks.added", { n: DIFF.risks.added.length }), plain(DIFF.risks.added)),
    )
    .concat(
      diffSection(
        t("diff.risks.removed", { n: DIFF.risks.removed.length }),
        plain(DIFF.risks.removed),
      ),
    );
}
