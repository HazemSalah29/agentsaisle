// ---- the list shown on narrow screens
var list = $("list");
cols.forEach(function (c, ci) {
  list.append(h("h2", {}, TIER_NAME[present[ci]]));
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
            (techText(n) === n.role ? n.role : techText(n) + " · " + n.role) +
              (isInferred("node", n.id) ? " · inferred" : "") +
              (risks.length
                ? " · " + risks.length + " possible risk" + (risks.length > 1 ? "s" : "")
                : ""),
          ),
        ),
      ),
      outs.length ? h("span", { class: "c" }, "Connects to: " + outs.join(", ")) : null,
    );
    card.addEventListener("click", function () {
      select("node", n.id);
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
function select(kind, id) {
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
  renderPanel();
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
    h("p", { class: "tag" }, "Possible risk to check · " + r.severity),
    r.title ? h("h4", { class: "risk-title" }, r.title) : null,
    h("p", {}, r.why),
    h("p", {}, h("strong", {}, "What to check: "), r.check),
    evidenceList(r.evidence),
    h(
      "p",
      { class: "src" },
      (r.source === "agent"
        ? "Added from the agent's reading of the code"
        : "Rule-based heuristic, so it can be wrong") +
        " · " +
        r.id +
        " · " +
        nodes.join(", "),
    ),
    withLink && r.nodes[0] && nodeById[r.nodes[0]]
      ? (function () {
          var b = h("button", { type: "button", class: "link" }, "Show on the diagram");
          b.addEventListener("click", function () {
            select("node", r.nodes[0]);
          });
          return b;
        })()
      : null,
  );
}
function linkTo(kind, id, text) {
  var b = h("button", { type: "button", class: "link" }, text);
  b.addEventListener("click", function () {
    select(kind, id);
  });
  return b;
}
function renderPanel() {
  var nRisks = (model.risks || []).length;
  $("tab-risks").textContent = "Risks (" + nRisks + ")";
  $("tab-details").setAttribute("aria-selected", tab === "details" ? "true" : "false");
  $("tab-flow").setAttribute("aria-selected", tab === "flow" ? "true" : "false");
  $("tab-risks").setAttribute("aria-selected", tab === "risks" ? "true" : "false");
  clear(body);
  if (tab === "flow") return renderFlowPanel();
  if (tab === "risks") {
    body.append(
      h(
        "p",
        { class: "note" },
        nRisks
          ? "These are possible risks, not confirmed problems. Each one says what to check and which files it is based on."
          : "No possible risks were recorded.",
      ),
    );
    (model.risks || []).forEach(function (r) {
      body.append(riskCard(r, true));
    });
    return;
  }
  if (!sel) {
    body.append(
      h("h2", {}, model.project),
      h(
        "p",
        { class: "meta" },
        model.nodes.length + " components, " + model.edges.length + " connections",
      ),
      h(
        "p",
        { class: "note" },
        "Select a component or a connection to see where it comes from in the code. Drag to pan, scroll to zoom.",
      ),
      h("h3", {}, "How to read it"),
      h(
        "div",
        { class: "legend" },
        h("span", {}, legendLine(false), " Backed by files"),
        h("span", {}, legendLine(true), " Inferred, no direct evidence"),
      ),
      h(
        "p",
        { class: "note" },
        "This page shows how requests would travel based on the code and config. It is not live traffic, and it does not say any design is best.",
      ),
    );
    return;
  }
  if (sel.kind === "node") {
    var n = nodeById[sel.id];
    body.append(
      h("h2", {}, n.label),
      h("p", { class: "meta" }, techText(n) + " · " + n.role + " · " + TIER_NAME[n.tier] + " tier"),
    );
    if (isInferred("node", n.id))
      body.append(
        h(
          "p",
          { class: "note" },
          "Inferred: no file in the project directly shows this component, so the diagram marks it with a dashed outline.",
        ),
      );
    body.append(
      h("h3", {}, "Evidence"),
      evidenceList(n.evidence) || h("p", { class: "meta" }, "None recorded."),
    );
    var conns = model.edges.filter(function (e) {
      return e.from === n.id || e.to === n.id;
    });
    body.append(h("h3", {}, "Connections"));
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
                out ? "To " : "From ",
                linkTo("edge", e.id, other ? other.label : out ? e.to : e.from),
                e.protocol ? " (" + e.protocol + ")" : "",
              );
            }),
          )
        : h("p", { class: "meta" }, "None."),
    );
    var rs = risksByNode[n.id] || [];
    if (rs.length) {
      body.append(h("h3", {}, "Possible risks"));
      rs.forEach(function (r) {
        body.append(riskCard(r, false));
      });
    }
  } else {
    var e = edgeById[sel.id];
    var a = nodeById[e.from],
      b = nodeById[e.to];
    body.append(h("h2", {}, (a ? a.label : e.from) + " → " + (b ? b.label : e.to)));
    body.append(
      h(
        "p",
        { class: "meta" },
        [e.protocol, e.sync === true ? "synchronous" : e.sync === false ? "asynchronous" : null]
          .filter(Boolean)
          .join(" · ") || "Connection",
      ),
    );
    if (isInferred("edge", e.id))
      body.append(
        h(
          "p",
          { class: "note" },
          "Inferred: no file directly shows this connection, so the diagram draws it dashed.",
        ),
      );
    body.append(
      h("h3", {}, "Evidence"),
      evidenceList(e.evidence) || h("p", { class: "meta" }, "None recorded."),
    );
    body.append(
      h("h3", {}, "Ends"),
      h(
        "ul",
        {},
        h("li", {}, "From ", a ? linkTo("node", a.id, a.label) : e.from),
        h("li", {}, "To ", b ? linkTo("node", b.id, b.label) : e.to),
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
    select(null);
    panel.classList.remove("open");
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
