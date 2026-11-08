// ---- detail: zoom into a component to read its functions, components and the calls between them
var DETAIL_W = 210,
  DETAIL_H = 84;
var dState = { open: null, busy: false, scenes: {}, prev: null, plan: null, raf: 0 };
var detailIdx = ArchDetail.index(model);
var detailLayer = s("g", { id: "detail", display: "none" });
vp.append(detailLayer);
var crumbs = $("crumbs");
var reduceMotion = false;
try {
  reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
} catch (e) {
  reduceMotion = false; // no matchMedia: animate
}

function symKind(kind) {
  var names = {
    component: t("sym.kind.component"),
    function: t("sym.kind.function"),
    hook: t("sym.kind.hook"),
    method: t("sym.kind.method"),
    route: t("sym.kind.route"),
    procedure: t("sym.kind.procedure"),
  };
  return names[kind] || kind;
}
function linkKind(kind) {
  var names = {
    call: t("sym.link.call"),
    render: t("sym.link.render"),
    fetch: t("sym.link.fetch"),
    rpc: t("sym.link.rpc"),
  };
  return names[kind] || kind;
}
function colName(i) {
  return [
    t("detail.col.0"),
    t("detail.col.1"),
    t("detail.col.2"),
    t("detail.col.3"),
    t("detail.col.4"),
    t("detail.col.5"),
    t("detail.col.6"),
  ][i];
}
function overviewKids() {
  return Array.prototype.filter.call(vp.children, function (c) {
    return c !== detailLayer;
  });
}
function shortFile(file) {
  return file.split("/").slice(-2).join("/");
}

// ---- the inner diagram of one component, drawn once and kept
function sceneFor(id) {
  if (dState.scenes[id]) return dState.scenes[id];
  var n = nodeById[id];
  var d = ArchDetail.build(n, {
    loop: t("sym.edge.loop"),
    branch: t("sym.edge.branch"),
    render: t("sym.edge.render"),
    fetch: t("sym.edge.fetch"),
    rpc: t("sym.edge.rpc"),
  });
  var L = ArchLayout.layout(d.layoutModel, {
    nodeW: DETAIL_W,
    nodeH: DETAIL_H,
    labelText: function (e) {
      return e.protocol || "";
    },
  });
  if (FLOW_RTL) L = ArchLayout.mirror(L);
  var g = s("g", {
    class: "scene",
    "data-scene": id,
    role: "group",
    "aria-label": t("detail.aria.scene", { label: n.label }),
  });
  L.layers.forEach(function (l) {
    g.append(
      s("rect", {
        class: "band",
        x: l.x - 14,
        y: 52,
        width: DETAIL_W + 28,
        height: Math.max(0, L.size.h - 52 - 14),
        rx: 12,
      }),
      s(
        "text",
        { class: "tier-label", x: RTL ? l.x + DETAIL_W : l.x, y: 36 },
        colName(Math.max(0, d.columns.indexOf(l.tier))),
      ),
    );
  });
  L.groups.forEach(function (gr) {
    var text = clip(gr.label, 30);
    var chipW = Math.min(gr.w - 16, text.length * 7 + 16);
    g.append(
      s(
        "g",
        { class: "group" },
        s("rect", { class: "box", x: gr.x, y: gr.y, width: gr.w, height: gr.h, rx: 10 }),
        s("rect", {
          class: "chip",
          x: RTL ? gr.x + gr.w - 8 - chipW : gr.x + 8,
          y: gr.y + 4,
          width: chipW,
          height: 18,
          rx: 9,
        }),
        s("text", { x: RTL ? gr.x + gr.w - 16 : gr.x + 16, y: gr.y + 17 }, text),
      ),
    );
  });
  var edgeEls2 = {},
    symEls = {};
  var gE = s("g", { class: "dedges" });
  var gS = s("g", { class: "syms" });
  g.append(gE, gS);
  d.edges.forEach(function (e) {
    var route = L.routes[e.id];
    if (!route) return;
    var eg = s("g", {
      class: "dedge k-" + e.kind + (e.in ? " in-" + e.in : "") + (e.inferred ? " inferred" : ""),
      "data-dedge": e.id,
    });
    eg.append(s("path", { d: route.d, class: "line", "marker-end": "url(#arrow)" }));
    var lab = L.labels[e.id];
    if (lab && e.label) {
      eg.append(
        s("rect", {
          class: "edge-label-bg",
          x: lab.x,
          y: lab.y,
          width: lab.w,
          height: lab.h,
          rx: 4,
        }),
        s(
          "text",
          {
            class: "edge-label dlabel",
            x: lab.x + lab.w / 2,
            y: lab.y + 12,
            "text-anchor": "middle",
          },
          clip(e.label, 18),
        ),
      );
    }
    edgeEls2[e.id] = eg;
    gE.append(eg);
  });
  d.layoutModel.nodes.forEach(function (nn) {
    var x = detailIdx.byId[nn.id];
    var p = L.pos[nn.id];
    var label = t("sym.aria", { name: x.name, kind: symKind(x.kind), file: x.file, line: x.line });
    // text-anchor "start" follows the reading direction, so only the x position changes in Arabic
    var side = RTL ? DETAIL_W - 12 : 12;
    var el = s("g", {
      class: "sym k-" + x.kind,
      "data-sym": x.id,
      transform: "translate(" + p.x + " " + p.y + ")",
      tabindex: "0",
      role: "button",
      "aria-label": label,
    });
    el.append(
      s("title", {}, label),
      s("rect", { class: "ring", x: -4, y: -4, width: DETAIL_W + 8, height: DETAIL_H + 8, rx: 12 }),
      s("rect", { class: "box", width: DETAIL_W, height: DETAIL_H, rx: 9 }),
      s("rect", {
        class: "stripe",
        x: RTL ? DETAIL_W - 5 : 0,
        y: 8,
        width: 5,
        height: DETAIL_H - 16,
      }),
      s("text", { class: "kind", x: side, y: 19 }, symKind(x.kind)),
      s("text", { class: "name", x: side, y: 40 }, clip(x.name, 26)),
      s("text", { class: "sub", x: side, y: 58 }, clip(shortFile(x.file) + ":" + x.line, 30)),
    );
    if (x.doc) el.append(s("text", { class: "doc", x: side, y: 74 }, clip(x.doc, 38)));
    var badges = [];
    if (x.loops) badges.push(["loop", t("sym.loops", { n: x.loops })]);
    if (x.branches) badges.push(["branch", t("sym.branches", { n: x.branches })]);
    badges.forEach(function (b, i) {
      el.append(
        s(
          "text",
          {
            class: "tag tag-" + b[0],
            x: RTL ? 10 + i * 56 : DETAIL_W - 10 - i * 56,
            y: 19,
            // the end of the text is its right edge in English and its left edge in Arabic
            "text-anchor": "end",
          },
          b[1],
        ),
      );
    });
    el.addEventListener("click", function (ev) {
      ev.stopPropagation();
      if (!moved) select("symbol", x.id, true);
    });
    el.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        ev.stopPropagation();
        select("symbol", x.id, true);
      }
    });
    symEls[x.id] = el;
    gS.append(el);
  });
  var keyToEdge = {};
  d.edges.forEach(function (e) {
    keyToEdge[e.from + ">" + e.to + ":" + e.kind] = e.id;
  });
  var sc = {
    g: g,
    L: L,
    d: d,
    size: L.size,
    symEls: symEls,
    edgeEls: edgeEls2,
    keyToEdge: keyToEdge,
  };
  dState.scenes[id] = sc;
  detailLayer.append(g);
  return sc;
}

// ---- the camera: one eased move, drawn frame by frame
function paintFrame(f) {
  detailLayer.setAttribute("transform", ArchZoom.innerTransform(dState.plan, f.m));
  detailLayer.setAttribute("opacity", String(f.detail));
  overviewKids().forEach(function (c) {
    c.style.opacity = f.overview >= 0.999 ? "" : String(f.overview);
  });
  view = { x: f.x, y: f.y, k: f.k };
  applyView();
}
function runMove(ms, frameAt, done) {
  cancelAnimationFrame(dState.raf);
  if (!ms || reduceMotion) {
    paintFrame(frameAt(1));
    if (done) done();
    return;
  }
  var t0 = null;
  function step(ts) {
    if (t0 === null) t0 = ts;
    var p = Math.min(1, (ts - t0) / ms);
    paintFrame(frameAt(ArchZoom.ease(p)));
    if (p < 1) dState.raf = requestAnimationFrame(step);
    else if (done) done();
  }
  dState.raf = requestAnimationFrame(step);
}
function tweenView(to, ms) {
  cancelAnimationFrame(dState.raf);
  var from = { x: view.x, y: view.y, k: view.k };
  function at(e) {
    view = {
      x: from.x + (to.x - from.x) * e,
      y: from.y + (to.y - from.y) * e,
      k: ArchZoom.logLerp(from.k, to.k, e),
    };
    applyView();
  }
  if (!ms || reduceMotion) return at(1);
  var t0 = null;
  function step(ts) {
    if (t0 === null) t0 = ts;
    var p = Math.min(1, (ts - t0) / ms);
    at(ArchZoom.ease(p));
    if (p < 1) dState.raf = requestAnimationFrame(step);
  }
  dState.raf = requestAnimationFrame(step);
}

function stageSize() {
  var r = stage.getBoundingClientRect();
  return [r.width, r.height];
}
/** Zoom into a component. `symId` selects one symbol on arrival; `instant` skips the animation. */
function openDetail(id, symId, instant, done) {
  var n = nodeById[id];
  if (!n || !n.detail || !n.detail.symbols.length) return;
  if (dState.open === id) {
    if (symId) focusSymbol(symId);
    return;
  }
  if (dState.open || dState.busy) {
    closeDetail(true);
  }
  var size = stageSize();
  if (!size[0] || !size[1]) {
    // the stage is hidden (phone width): the panel's list is the way in
    if (symId) select("symbol", symId, true);
    return;
  }
  if (lens !== "system") setLens("system");
  showCrumbs(n);
  showExplorer(n);
  var sc = sceneFor(id);
  Array.prototype.forEach.call(detailLayer.children, function (c) {
    c.setAttribute("display", c === sc.g ? "inline" : "none");
  });
  dState.plan = ArchZoom.plan({
    stage: size,
    size: [sc.size.w, sc.size.h],
    node: pos[id],
    view: view,
    region: freeRegion(),
    minK: 0.65,
  });
  dState.prev = { view: { x: view.x, y: view.y, k: view.k } };
  dState.open = id;
  dState.busy = true;
  document.documentElement.setAttribute("data-detail", id);
  canvas.classList.add("detail-open");
  detailLayer.setAttribute("display", "inline");
  select(null);
  runMove(
    instant ? 0 : 700,
    function (e) {
      return ArchZoom.frame(dState.plan, e);
    },
    function () {
      dState.busy = false;
      detailLayer.setAttribute("opacity", "1");
      if (symId && sc.symEls[symId]) focusSymbol(symId, true);
      else {
        select("node", id, false);
        var first = sc.g.querySelector(".sym");
        if (first && !instant) first.focus({ preventScroll: true });
      }
      if (done) done();
    },
  );
}
/** Zoom back out to the system diagram. */
function closeDetail(instant, done) {
  var id = dState.open;
  if (!id) return;
  if (dState.busy && !instant) return;
  cancelAnimationFrame(dState.raf);
  dState.busy = true;
  var cur = { x: view.x, y: view.y, k: view.k };
  var plan = dState.plan;
  select(null);
  runMove(
    instant ? 0 : 600,
    function (e) {
      return ArchZoom.reverse(plan, cur, e);
    },
    function () {
      detailLayer.setAttribute("display", "none");
      detailLayer.removeAttribute("transform");
      detailLayer.removeAttribute("opacity");
      overviewKids().forEach(function (c) {
        c.style.opacity = "";
      });
      view = dState.prev.view;
      applyView();
      canvas.classList.remove("detail-open");
      document.documentElement.removeAttribute("data-detail");
      crumbs.hidden = true;
      hideExplorer();
      dState.open = null;
      dState.busy = false;
      select("node", id, false);
      if (!instant && nodeEls[id] && nodeEls[id].focus) nodeEls[id].focus({ preventScroll: true });
      if (done) done();
    },
  );
}
function showCrumbs(n) {
  var d = n.detail;
  var found = d.symbolsFound !== undefined ? d.symbolsFound : d.symbols.length;
  clear($("crumb-path"));
  $("crumb-path").append(
    h("span", {}, t("detail.system")),
    h("span", { class: "sep", "aria-hidden": "true" }, " › "),
    h("strong", {}, n.label),
  );
  $("crumb-note").textContent =
    t("detail.summary", { shown: d.symbols.length, found: found, scope: d.scope }) +
    (d.focus ? " " + t("detail.focus", { entry: clip(d.focus.entries.join(", "), 60) }) : "");
  crumbs.hidden = false;
  layoutVars();
}
$("crumb-back").addEventListener("click", function (ev) {
  ev.stopPropagation();
  closeDetail();
});
crumbs.addEventListener("pointerdown", function (ev) {
  ev.stopPropagation();
});
// Esc leaves the detail view; when a function is selected the first Esc only clears the selection
document.addEventListener(
  "keydown",
  function (ev) {
    if (ev.key !== "Escape" || !dState.open) return;
    if (ev.target && ev.target.id === "ex-q") return; // Esc in the filter clears the filter
    if (sel && sel.kind === "symbol") return;
    ev.stopImmediatePropagation();
    closeDetail();
  },
  true,
);

/** Fit the inner diagram to the stage (the Fit button while a detail view is open). */
function fitDetail() {
  var sc = dState.scenes[dState.open];
  if (!sc || !dState.plan) return;
  var end = ArchZoom.fitInner(stageSize(), [sc.size.w, sc.size.h], dState.plan.c, {
    region: freeRegion(),
  });
  tweenView(end, 300);
}
/** Centre one symbol and show its panel. */
function focusSymbol(symId, instant) {
  var sc = dState.scenes[dState.open];
  if (!sc || !sc.L.pos[symId]) return;
  select("symbol", symId, !instant);
  var w = ArchZoom.worldOf(dState.plan, sc.L.pos[symId]);
  var rg = freeRegion();
  var k = Math.max(view.k, 0.9);
  tweenView(
    {
      x: (rg.x0 + rg.x1) / 2 - k * w[0],
      y: (rg.y0 + rg.y1) / 2 - k * w[1],
      k: k,
    },
    instant ? 0 : 380,
  );
}
/** Go to a symbol wherever it lives: in this view, or after zooming out and into another component. */
function gotoSymbol(id) {
  var owner = detailIdx.nodeOf[id];
  if (!owner) return;
  if (owner === dState.open) return focusSymbol(id);
  if (dState.open)
    closeDetail(false, function () {
      openDetail(owner, id);
    });
  else openDetail(owner, id);
}
/** Mark the selected symbol and what it touches; dim the rest. */
function markDetailSel() {
  Object.keys(dState.scenes).forEach(function (nid) {
    var sc = dState.scenes[nid];
    var on = sel && sel.kind === "symbol" && sc.symEls[sel.id] ? sel.id : null;
    var near = {};
    sc.g.classList.toggle("has-sel", !!on);
    sc.d.edges.forEach(function (e) {
      var hot = !!on && (e.from === on || e.to === on);
      if (hot) {
        near[e.from] = true;
        near[e.to] = true;
      }
      if (sc.edgeEls[e.id]) sc.edgeEls[e.id].classList.toggle("hot", hot);
    });
    Object.keys(sc.symEls).forEach(function (k) {
      sc.symEls[k].classList.toggle("selected", k === on);
      sc.symEls[k].classList.toggle("rel", !!on && k !== on && !!near[k]);
      sc.symEls[k].setAttribute("aria-pressed", k === on ? "true" : "false");
    });
  });
  syncExplorer();
}
/** Exporting always saves the system diagram, so the detail layer is hidden for that moment. */
function systemViewForExport() {
  if (!dState.open) return function () {};
  detailLayer.setAttribute("display", "none");
  var prev = overviewKids().map(function (c) {
    var o = c.style.opacity;
    c.style.opacity = "";
    return [c, o];
  });
  return function () {
    detailLayer.setAttribute("display", "inline");
    prev.forEach(function (p) {
      p[0].style.opacity = p[1];
    });
  };
}

// ---- panel text
function ctxText(inCtx) {
  return inCtx === "loop" ? t("sym.ctx.loop") : inCtx === "branch" ? t("sym.ctx.branch") : "";
}
function symButton(id, extra) {
  var x = detailIdx.byId[id];
  var ownerId = detailIdx.nodeOf[id];
  var b = h("button", { type: "button", class: "link" }, x ? x.name : id);
  b.addEventListener("click", function () {
    gotoSymbol(id);
  });
  return h(
    "span",
    {},
    b,
    ownerId && ownerId !== dState.open && nodeById[ownerId]
      ? h("span", { class: "meta" }, " (" + nodeById[ownerId].label + ")")
      : null,
    extra ? " " + extra : "",
  );
}
function linkItems(list, key) {
  return h(
    "ul",
    {},
    list.map(function (l) {
      var parts = [linkKind(l.kind)];
      if (l.in) parts.push(ctxText(l.in));
      if (l.inferred) parts.push(t("sym.inferred"));
      return h("li", {}, symButton(l[key], "· " + parts.filter(Boolean).join(" · ")));
    }),
  );
}
function renderSymbolPanel() {
  var x = detailIdx.byId[sel.id];
  if (!x) return;
  var owner = nodeById[detailIdx.nodeOf[sel.id]];
  body.append(
    h("h2", {}, x.name),
    h("p", { class: "meta" }, t("sym.meta", { kind: symKind(x.kind), node: owner.label })),
    h("p", {}, h("code", {}, x.file + ":" + x.line)),
  );
  if (x.route) body.append(h("p", { class: "meta" }, t("sym.route", x.route)));
  if (x.procedure)
    body.append(
      h(
        "p",
        { class: "meta" },
        t("sym.proc", { kind: x.procedure.kind, path: x.procedure.path || x.name }),
      ),
    );
  if (x.doc)
    body.append(
      h("p", {}, x.doc),
      h("p", { class: "note" }, x.docBy === "agent" ? t("sym.doc.agent") : t("sym.doc.comment")),
    );
  else body.append(h("p", { class: "note" }, t("sym.doc.none")));
  if (x.loops || x.branches)
    body.append(
      h(
        "p",
        { class: "meta" },
        [
          x.loops ? t("sym.loops", { n: x.loops }) : "",
          x.branches ? t("sym.branches", { n: x.branches }) : "",
        ]
          .filter(Boolean)
          .join(" · "),
      ),
    );
  var lk = ArchDetail.links(model, sel.id, detailIdx);
  body.append(h("h3", {}, t("sym.h.goes")));
  body.append(lk.out.length ? linkItems(lk.out, "to") : h("p", { class: "meta" }, t("sym.none")));
  body.append(h("h3", {}, t("sym.h.by")));
  body.append(lk.in.length ? linkItems(lk.in, "from") : h("p", { class: "meta" }, t("sym.none")));
  var uses = [];
  (x.fetches || []).forEach(function (f) {
    if (!f.to) uses.push(t("sym.unmatched.fetch", { method: f.method, url: f.url }));
  });
  (x.rpc || []).forEach(function (r) {
    if (!r.to) uses.push(t("sym.unmatched.rpc", { path: r.path }));
  });
  (x.external || []).forEach(function (e) {
    uses.push(e.module ? t("sym.external", { name: e.name, module: e.module }) : e.name);
  });
  if (uses.length) {
    body.append(
      h("h3", {}, t("sym.h.uses")),
      h(
        "ul",
        {},
        uses.slice(0, 14).map(function (u) {
          return h("li", {}, h("code", {}, clip(u, 90)));
        }),
      ),
    );
  }
  if (x.hiddenCalls) body.append(h("p", { class: "note" }, t("sym.hidden", { n: x.hiddenCalls })));
}
/** The block the side panel shows for a component that has an inside. */
function detailNodeBlock(n) {
  var d = n.detail;
  var found = d.symbolsFound !== undefined ? d.symbolsFound : d.symbols.length;
  var out = [
    h("h3", {}, t("detail.h")),
    h(
      "p",
      { class: "meta" },
      t("detail.summary", { shown: d.symbols.length, found: found, scope: d.scope }),
    ),
  ];
  if (d.focus)
    out.push(h("p", { class: "note" }, t("detail.focus", { entry: d.focus.entries.join(", ") })));
  // on a phone the diagram is hidden, so the list below is the way in
  var canZoom = stageSize()[0] > 0;
  if (canZoom && dState.open !== n.id) {
    var open = h("button", { type: "button", class: "primary" }, t("detail.open"));
    open.addEventListener("click", function () {
      openDetail(n.id);
    });
    out.push(open);
  }
  var files = {};
  d.symbols.forEach(function (x) {
    (files[x.file] = files[x.file] || []).push(x);
  });
  var list = h(
    "details",
    { class: "inside", open: canZoom ? false : "open" },
    h("summary", {}, t("detail.list")),
  );
  Object.keys(files)
    .sort()
    .forEach(function (f) {
      list.append(
        h("h4", {}, f),
        h(
          "ul",
          {},
          files[f].map(function (x) {
            var b = h("button", { type: "button", class: "link" }, x.name);
            b.addEventListener("click", function () {
              if (dState.open === n.id) focusSymbol(x.id);
              else if (stageSize()[0]) openDetail(n.id, x.id);
              else select("symbol", x.id, true);
            });
            return h(
              "li",
              {},
              b,
              " · " + symKind(x.kind) + ":" + x.line,
              x.doc ? h("br") : null,
              x.doc ? h("span", { class: "meta" }, x.doc) : null,
            );
          }),
        ),
      );
    });
  out.push(list);
  return out;
}
