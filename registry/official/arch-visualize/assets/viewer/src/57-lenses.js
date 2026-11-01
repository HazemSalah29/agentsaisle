// ---- the Security, Failure and AI lenses. Every node and edge already carries the classes these need
// (zone, data, ai, cross, carries); the lens attribute on the page decides which of them show. What is
// added here is the toolbar, the panel text and the two things you can do: trace data and simulate a failure.
var failDown = [],
  simResult = null,
  piiOn = false,
  piiTrace = null;

function hasSecurityFacts() {
  return (
    model.nodes.some(function (n) {
      return n.zone || (n.data && n.data.length);
    }) ||
    model.edges.some(function (e) {
      return e.auth || e.tls !== undefined || (e.carries && e.carries.length);
    })
  );
}
/** Which lenses have something to show for this model. */
function lensAvailable(name) {
  if (name === "system") return true;
  if (name === "flows") return flows.length > 0;
  if (name === "security") return hasSecurityFacts();
  if (name === "failure") return model.edges.length > 0;
  if (name === "ai")
    return model.nodes.some(function (n) {
      return n.ai;
    });
  if (name === "diff") return !!DIFF;
  return false;
}

// ---- toolbar and highlights, called whenever the lens changes
function applyLensView() {
  var showBar = lens === "security" || lens === "failure" || lens === "ai";
  $("lensbar").hidden = !showBar;
  ["security", "failure", "ai"].forEach(function (l) {
    $("lb-" + l).hidden = lens !== l;
  });
  if (lens !== "security" && piiOn) setPii(false);
  if (lens !== "failure" && simResult) clearSim();
  canvas.classList.toggle("simulating", !!simResult);
}

// ---- where does personal data go?
function setPii(on) {
  piiOn = on;
  piiTrace = on ? ArchData.trace(model, "pii") : null;
  $("pii-btn").setAttribute("aria-pressed", on ? "true" : "false");
  $("pii-btn").textContent = on ? t("sec.pii.off") : t("sec.pii");
  var nodeSet = {},
    edgeSet = {};
  if (piiTrace) {
    piiTrace.nodes.forEach(function (id) {
      nodeSet[id] = true;
    });
    piiTrace.edges.forEach(function (id) {
      edgeSet[id] = true;
    });
  }
  Object.keys(nodeEls).forEach(function (k) {
    nodeEls[k].classList.toggle("pii-on", !!nodeSet[k]);
  });
  Object.keys(edgeEls).forEach(function (k) {
    edgeEls[k].classList.toggle("pii-on", !!edgeSet[k]);
  });
  canvas.classList.toggle("pii-tracing", on && piiTrace.nodes.length > 0);
  renderPanel();
}
$("pii-btn").addEventListener("click", function () {
  setPii(!piiOn);
});

// ---- what if it goes down?
function simulateDown(ids) {
  failDown = ids.filter(function (id) {
    return nodeById[id];
  });
  if (!failDown.length) return clearSim();
  simResult = ArchSim.simulate(model, failDown);
  Object.keys(nodeEls).forEach(function (k) {
    var info = simResult.nodes[k];
    var st = info ? info.status : "unaffected";
    var el = nodeEls[k];
    el.classList.toggle("sim-failed", st === "failed");
    el.classList.toggle("sim-degraded", st === "degraded");
    el.classList.toggle("sim-ok", st === "unaffected");
    var chip = el.querySelector(".sim-chip");
    chip.textContent = st === "unaffected" ? "" : t("fail.status." + st);
  });
  Object.keys(edgeEls).forEach(function (k) {
    var st = simResult.edges[k];
    edgeEls[k].classList.toggle("sim-broken", st === "broken");
    edgeEls[k].classList.toggle("sim-fallback", st === "fallback");
    edgeEls[k].classList.toggle("sim-delayed", st === "delayed");
  });
  canvas.classList.add("simulating");
  $("sim-status").textContent = t("fail.announce", {
    node: failDown.map(nodeName).join(", "),
    failed: simResult.counts.failed,
    degraded: simResult.counts.degraded,
  });
  renderPanel();
  scheduleLink();
}
function clearSim() {
  failDown = [];
  simResult = null;
  Object.keys(nodeEls).forEach(function (k) {
    nodeEls[k].classList.remove("sim-failed", "sim-degraded", "sim-ok");
    nodeEls[k].querySelector(".sim-chip").textContent = "";
  });
  Object.keys(edgeEls).forEach(function (k) {
    edgeEls[k].classList.remove("sim-broken", "sim-fallback", "sim-delayed");
  });
  canvas.classList.remove("simulating");
  $("sim-status").textContent = "";
  renderPanel();
  scheduleLink();
}
$("fail-reset").addEventListener("click", clearSim);
/** The "what if it goes down?" action of a risk card or a component. */
function whatIf(id) {
  if (!lensAvailable("failure")) return;
  setLens("failure");
  select(null);
  simulateDown([id]);
}

// ---- panel text for each lens
function kv(rows) {
  var dl = h("dl", { class: "kv" });
  rows.forEach(function (r) {
    if (r[1] === null || r[1] === undefined || r[1] === "") return;
    dl.append(h("dt", {}, r[0]), h("dd", {}, r[1]));
  });
  return dl;
}
function simReason(link) {
  var vars = { who: nodeName(link.node), cause: nodeName(link.cause) };
  return t("fail." + link.kind, vars);
}
function simPanel() {
  var out = [
    h("h2", {}, t("fail.title", { node: failDown.map(nodeName).join(", ") })),
    h(
      "p",
      { class: "meta" },
      t("fail.counts", {
        failed: simResult.counts.failed,
        degraded: simResult.counts.degraded,
        unaffected: simResult.counts.unaffected,
      }),
    ),
    h("p", { class: "note" }, t("fail.note")),
  ];
  var ids = Object.keys(simResult.nodes).filter(function (id) {
    return simResult.nodes[id].status !== "unaffected" && simResult.nodes[id].chain.length;
  });
  if (!ids.length) out.push(h("p", { class: "meta" }, t("fail.none")));
  else {
    var ul = h("ul", { class: "panel-list" });
    ids.forEach(function (id) {
      var link = simResult.nodes[id].chain[0];
      var item = h("li", {}, simReason(link));
      if (link.evidence)
        item.append(
          " ",
          h("code", {}, link.evidence.file + (link.evidence.line ? ":" + link.evidence.line : "")),
        );
      ul.append(item);
    });
    out.push(ul);
  }
  var hit = simResult.flows.filter(function (f) {
    return f.status !== "ok";
  });
  if (hit.length) {
    out.push(h("h3", {}, t("fail.flows")));
    var fl = h("ul", { class: "panel-list" });
    hit.forEach(function (f) {
      fl.append(
        h(
          "li",
          {},
          t(f.status === "broken" ? "fail.flow.broken" : "fail.flow.degraded", {
            name: f.name,
            n: f.step,
            node: nodeName(f.node),
          }),
        ),
      );
    });
    out.push(fl);
  }
  return out;
}
function piiPanel() {
  var r = piiTrace;
  var out = [h("h2", {}, t("sec.pii.title"))];
  if (!r.nodes.length) return out.concat([h("p", { class: "note" }, t("sec.pii.none"))]);
  out.push(
    h(
      "p",
      { class: "meta" },
      t("sec.pii.reach", {
        summary: t("summary", {
          components: tn("count.components", r.nodes.length),
          connections: tn("count.connections", r.edges.length),
        }),
      }),
    ),
  );
  var ul = h("ul", { class: "panel-list" });
  r.nodes.forEach(function (id) {
    var z = zoneOf(id);
    ul.append(h("li", {}, nodeName(id) + (z ? " · " + t("zone." + z) : "")));
  });
  out.push(ul);
  if (r.unlabelled.length)
    out.push(h("p", { class: "note" }, tn("sec.pii.unknown", r.unlabelled.length)));
  return out;
}
/** What the panel shows when nothing is selected, in the Security, Failure and AI lenses. */
function lensIntro() {
  if (lens === "diff") return diffIntro();
  if (lens === "failure" && simResult) return simPanel();
  if (lens === "security") {
    if (piiOn && piiTrace) return piiPanel();
    var counts = {};
    model.nodes.forEach(function (n) {
      counts[n.zone || ""] = (counts[n.zone || ""] || 0) + 1;
    });
    var out = [h("h2", {}, t("sec.zones")), h("p", { class: "note" }, t("sec.intro"))];
    var ul = h("ul", { class: "panel-list" });
    ["public", "dmz", "private", "third-party", "user-device", ""].forEach(function (z) {
      if (counts[z])
        ul.append(h("li", {}, (z ? t("zone." + z) : t("sec.nozone")) + " · " + counts[z]));
    });
    out.push(ul);
    return out;
  }
  if (lens === "ai") {
    var ai = model.nodes.filter(function (n) {
      return n.ai;
    });
    var list = [h("h2", {}, t("ai.list")), h("p", { class: "note" }, t("ai.intro"))];
    if (!ai.length) return list.concat([h("p", { class: "meta" }, t("ai.none"))]);
    var items = h("ul", { class: "panel-list" });
    ai.forEach(function (n) {
      var li = h("li", {}, nodeName(n.id) + " · " + t("ai.kind." + n.ai.kind) + " · ");
      li.append(n.ai.auditGrade ? n.ai.auditGrade : t("ai.nograde"));
      items.append(li);
    });
    list.push(items);
    return list;
  }
  return null;
}
/** Extra panel sections for a selected component in the current lens. */
function lensNodeExtras(n) {
  var out = [];
  if (lens === "diff") return diffExtras("node", n.id);
  if (lens === "security") {
    out.push(
      kv([
        [t("sec.zone"), n.zone ? t("zone." + n.zone) : t("sec.nozone")],
        [
          t("sec.data"),
          n.data && n.data.length
            ? n.data
                .map(function (d) {
                  return t("data." + d);
                })
                .join(", ")
            : t("sec.none"),
        ],
      ]),
    );
  } else if (lens === "ai" && n.ai) {
    out.push(
      kv([
        [t("ai.kind"), t("ai.kind." + n.ai.kind)],
        [t("ai.grade"), n.ai.auditGrade || t("ai.nograde")],
        [t("ai.source"), n.ai.auditSource ? h("code", {}, n.ai.auditSource) : null],
        [t("ai.tools"), n.ai.tools && n.ai.tools.length ? n.ai.tools.join(", ") : null],
      ]),
    );
  } else if (lens === "failure") {
    var down = failDown.indexOf(n.id) >= 0;
    var btn = h("button", { type: "button" }, down ? t("fail.reset") : t("fail.simulate"));
    btn.addEventListener("click", function () {
      if (down) clearSim();
      else simulateDown([n.id]);
    });
    out.push(btn);
    if (simResult) out.push.apply(out, simPanel().slice(1)); // the summary stays in view while you look at a component
  }
  return out;
}
/** Extra panel sections for a selected connection. */
function lensEdgeExtras(e) {
  if (lens === "diff") return diffExtras("edge", e.id);
  if (lens !== "security") return [];
  var a = zoneOf(e.from),
    b = zoneOf(e.to);
  var rows = [
    [t("sec.auth"), e.auth ? t("auth." + e.auth) : t("sec.none")],
    [
      t("sec.tls"),
      e.tls === true
        ? t("tls.yes")
        : e.tls === false
          ? t("tls.no")
          : e.tls === "unknown"
            ? t("tls.unknown")
            : t("sec.none"),
    ],
    [
      t("sec.carries"),
      e.carries && e.carries.length
        ? e.carries
            .map(function (d) {
              return t("data." + d);
            })
            .join(", ")
        : t("sec.none"),
    ],
  ];
  var out = [kv(rows)];
  if (a && b && a !== b)
    out.push(h("p", { class: "note" }, t("sec.cross", { a: t("zone." + a), b: t("zone." + b) })));
  return out;
}
/** Options and the what-if button of a risk card. */
function riskExtras(r) {
  var out = [];
  if (r.fixes && r.fixes.length) {
    var ul = h("ul", { class: "panel-list fixes" });
    r.fixes.forEach(function (f) {
      var li = h("li", {}, f.text);
      if (f.tradeoff)
        li.append(" ", h("span", { class: "tradeoff" }, t("risk.tradeoff", { text: f.tradeoff })));
      ul.append(li);
    });
    out.push(h("h4", {}, t("risk.fixes")), ul);
  }
  var subject = r.nodes && r.nodes[0];
  if (subject && nodeById[subject] && lensAvailable("failure")) {
    var b = h("button", { type: "button", class: "link" }, t("risk.whatif"));
    b.addEventListener("click", function () {
      whatIf(subject);
    });
    out.push(b);
  }
  return out;
}
