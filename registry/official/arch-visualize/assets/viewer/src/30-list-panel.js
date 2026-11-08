// ---- the list shown on narrow screens
var list = $("list");
cols.forEach(function (c, ci) {
  if (!c.length) return;
  list.append(h("h2", {}, tierName(present[ci])));
  c.forEach(function (n) {
    var risks = risksByNode[n.id] || [];
    var outs = model.edges
      .filter(function (e) {
        return e.from === n.id && nodeById[e.to];
      })
      .map(function (e) {
        return nodeById[e.to].label;
      });
    var ic = iconSvg(n, 28, "icon", null, null);
    var card = h(
      "button",
      {
        type: "button",
        class: "card" + (isInferred("node", n.id) ? " inferred" : ""),
        "data-node": n.id,
      },
      h(
        "span",
        { class: "row" },
        ic ? (ic.setAttribute("fill", "currentColor"), ic) : null,
        h(
          "span",
          {},
          h("span", { class: "t" }, n.label),
          h("br"),
          h(
            "span",
            { class: "s mono" },
            (techText(n) === roleName(n.role)
              ? techText(n)
              : techText(n) + " · " + roleName(n.role)) +
              (isInferred("node", n.id) ? t("node.sub.inferred") : "") +
              (risks.length ? tn("node.sub.risks", risks.length) : ""),
          ),
        ),
      ),
      outs.length ? h("span", { class: "c" }, t("list.connects", { list: outs.join(", ") })) : null,
    );
    card.addEventListener("click", function () {
      select("node", n.id, true);
    });
    cardEls[n.id] = card;
    list.append(card);
  });
});

// ---- side panel
var sel = null;
var tab = "details";
var panel = $("panel"),
  body = $("body");
var returnTo = null; // where focus goes back to when the panel is closed with Esc
/** Select a component or connection. `moveFocus` (keyboard, click, search) puts focus on the panel heading. */
function select(kind, id, moveFocus) {
  if (traceOn && kind === "node") return tracePick(id);
  sel = kind ? { kind: kind, id: id } : null;
  if (sel) tab = "details";
  Object.keys(nodeEls).forEach(function (k) {
    var on = sel && sel.kind === "node" && sel.id === k;
    nodeEls[k].classList.toggle("selected", !!on);
    nodeEls[k].setAttribute("aria-pressed", on ? "true" : "false");
    cardEls[k].classList.toggle("selected", !!on);
  });
  Object.keys(edgeEls).forEach(function (k) {
    edgeEls[k].classList.toggle("selected", !!(sel && sel.kind === "edge" && sel.id === k));
  });
  panel.classList.toggle("open", !!sel);
  markDetailSel();
  renderPanel();
  scheduleLink();
  if (sel && moveFocus) {
    var listView = !stage.offsetParent; // narrow screens show the list instead of the diagram
    returnTo =
      sel.kind === "node" ? (listView ? cardEls[id] : nodeEls[id]) : listView ? list : stage;
    var heading = body.querySelector("h2");
    if (heading) {
      heading.tabIndex = -1;
      try {
        heading.focus({ preventScroll: true });
      } catch (e) {
        heading.focus();
      }
    }
  }
}
function evidenceList(items) {
  if (!items || !items.length) return null;
  return h(
    "ul",
    {},
    items.map(function (e) {
      return h(
        "li",
        {},
        h("code", {}, e.file + (e.line ? ":" + e.line : "")),
        e.note ? " — " + e.note : "",
      );
    }),
  );
}
function riskCard(r, withLink) {
  var nodes = r.nodes.map(function (id) {
    return nodeById[id] ? nodeById[id].label : id;
  });
  return h(
    "article",
    { class: "risk" },
    h("p", { class: "tag" }, t("risk.tag", { severity: t("sev." + r.severity) })),
    r.title ? h("h4", { class: "risk-title" }, r.title) : null,
    h("p", {}, r.why),
    h("p", {}, h("strong", {}, t("risk.check")), r.check),
    evidenceList(r.evidence),
    riskExtras(r),
    h(
      "p",
      { class: "src" },
      (r.source === "agent" ? t("risk.src.agent") : t("risk.src.rule")) +
        " · " +
        r.id +
        " · " +
        nodes.join(", "),
    ),
    withLink && r.nodes[0] && nodeById[r.nodes[0]]
      ? (function () {
          var b = h("button", { type: "button", class: "link" }, t("risk.show"));
          b.addEventListener("click", function () {
            select("node", r.nodes[0], true);
          });
          return b;
        })()
      : null,
  );
}
function linkTo(kind, id, text) {
  var b = h("button", { type: "button", class: "link" }, text);
  b.addEventListener("click", function () {
    select(kind, id, true);
  });
  return b;
}
function renderPanel() {
  var nRisks = (model.risks || []).length;
  $("tab-risks").textContent = t("tab.risks", { n: nRisks });
  $("tab-details").setAttribute("aria-selected", tab === "details" ? "true" : "false");
  $("tab-flow").setAttribute("aria-selected", tab === "flow" ? "true" : "false");
  $("tab-risks").setAttribute("aria-selected", tab === "risks" ? "true" : "false");
  clear(body);
  if (traceOn) return renderTracePanel();
  if (tab === "flow") return renderFlowPanel();
  if (tab === "risks") {
    body.append(h("p", { class: "note" }, nRisks ? t("risks.note") : t("risks.none")));
    (model.risks || []).forEach(function (r) {
      body.append(riskCard(r, true));
    });
    return;
  }
  var intro = !sel && lensIntro();
  if (intro) {
    intro.forEach(function (x) {
      body.append(x);
    });
    return;
  }
  if (!sel) {
    body.append(
      h("h2", {}, model.project),
      h(
        "p",
        { class: "meta" },
        t("summary", {
          components: tn("count.components", model.nodes.length),
          connections: tn("count.connections", model.edges.length),
        }),
      ),
      h("p", { class: "note" }, t("intro.select")),
      h("h3", {}, t("intro.read")),
      h(
        "div",
        { class: "legend" },
        h("span", {}, legendLine(false), t("legend.solid")),
        h("span", {}, legendLine(true), t("legend.dashed")),
      ),
      h("p", { class: "note" }, t("intro.honest")),
    );
    return;
  }
  if (sel.kind === "symbol") return renderSymbolPanel();
  if (sel.kind === "node") {
    var n = nodeById[sel.id];
    body.append(
      h("h2", {}, n.label),
      h(
        "p",
        { class: "meta" },
        t("node.meta", { tech: techText(n), role: roleName(n.role), tier: tierName(n.tier) }),
      ),
    );
    if (isInferred("node", n.id)) body.append(h("p", { class: "note" }, t("node.inferred.note")));
    if (n.detail && n.detail.symbols.length)
      detailNodeBlock(n).forEach(function (x) {
        body.append(x);
      });
    lensNodeExtras(n).forEach(function (x) {
      body.append(x);
    });
    body.append(
      h("h3", {}, t("h.evidence")),
      evidenceList(n.evidence) || h("p", { class: "meta" }, t("none.recorded")),
    );
    var conns = model.edges.filter(function (e) {
      return e.from === n.id || e.to === n.id;
    });
    body.append(h("h3", {}, t("h.connections")));
    body.append(
      conns.length
        ? h(
            "ul",
            {},
            conns.map(function (e) {
              var out = e.from === n.id;
              var other = nodeById[out ? e.to : e.from];
              return h(
                "li",
                {},
                out ? t("conn.to") : t("conn.from"),
                linkTo("edge", e.id, other ? other.label : out ? e.to : e.from),
                e.protocol ? " (" + e.protocol + ")" : "",
              );
            }),
          )
        : h("p", { class: "meta" }, t("none")),
    );
    var rs = risksByNode[n.id] || [];
    if (rs.length) {
      body.append(h("h3", {}, t("h.risks")));
      rs.forEach(function (r) {
        body.append(riskCard(r, false));
      });
    }
  } else {
    var e = edgeById[sel.id];
    var a = nodeById[e.from],
      b = nodeById[e.to];
    body.append(
      h("h2", {}, t("edge.title", { from: a ? a.label : e.from, to: b ? b.label : e.to })),
    );
    body.append(
      h(
        "p",
        { class: "meta" },
        [e.protocol, e.sync === true ? t("edge.sync") : e.sync === false ? t("edge.async") : null]
          .filter(Boolean)
          .join(" · ") || t("edge.connection"),
      ),
    );
    if (isInferred("edge", e.id)) body.append(h("p", { class: "note" }, t("edge.inferred.note")));
    lensEdgeExtras(e).forEach(function (x) {
      body.append(x);
    });
    body.append(
      h("h3", {}, t("h.evidence")),
      evidenceList(e.evidence) || h("p", { class: "meta" }, t("none.recorded")),
    );
    body.append(
      h("h3", {}, t("h.ends")),
      h(
        "ul",
        {},
        h("li", {}, t("conn.from"), a ? linkTo("node", a.id, a.label) : e.from),
        h("li", {}, t("conn.to"), b ? linkTo("node", b.id, b.label) : e.to),
      ),
    );
  }
}
function legendLine(dashed) {
  return s(
    "svg",
    { width: 34, height: 10, "aria-hidden": "true" },
    s("line", {
      x1: 1,
      y1: 5,
      x2: 33,
      y2: 5,
      stroke: "currentColor",
      "stroke-width": 2,
      "stroke-dasharray": dashed ? "6 4" : null,
    }),
  );
}
$("tab-details").addEventListener("click", function () {
  tab = "details";
  renderPanel();
});
$("tab-flow").addEventListener("click", function () {
  tab = "flow";
  panel.classList.add("open");
  renderPanel();
});
$("tab-risks").addEventListener("click", function () {
  tab = "risks";
  panel.classList.add("open");
  renderPanel();
});
$("open-risks").addEventListener("click", function () {
  tab = "risks";
  panel.classList.add("open");
  renderPanel();
});
$("close").addEventListener("click", function () {
  select(null);
});
document.addEventListener("keydown", function (ev) {
  if (ev.key === "Escape" && (sel || panel.classList.contains("open"))) {
    var back = returnTo;
    select(null);
    panel.classList.remove("open");
    if (back && back.focus) back.focus();
    returnTo = null;
  }
});

// ---- theme: follows the system until the button is used
$("theme").addEventListener("click", function () {
  var root = document.documentElement;
  var now =
    root.getAttribute("data-theme") ||
    (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  root.setAttribute("data-theme", now === "dark" ? "light" : "dark");
});
