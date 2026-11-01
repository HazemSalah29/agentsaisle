// ---- trace: pick a start and an end component and list every path between them
var traceOn = false,
  traceA = null,
  traceB = null,
  traceResult = null,
  traceIx = -1;
function applyTraceClasses() {
  var path = traceResult && traceIx >= 0 ? traceResult.paths[traceIx] : null;
  var nodeSet = {},
    edgeSet = {},
    asyncSet = {};
  if (path) {
    path.nodes.forEach(function (id) {
      nodeSet[id] = true;
    });
    path.edges.forEach(function (id, i) {
      edgeSet[id] = true;
      if (path.sync[i] === false) asyncSet[id] = true;
    });
  }
  Object.keys(nodeEls).forEach(function (k) {
    nodeEls[k].classList.toggle("trace-a", traceOn && traceA === k);
    nodeEls[k].classList.toggle("trace-b", traceOn && traceB === k);
    nodeEls[k].classList.toggle("trace-on", !!nodeSet[k]);
  });
  Object.keys(edgeEls).forEach(function (k) {
    edgeEls[k].classList.toggle("trace-on", !!edgeSet[k]);
    edgeEls[k].classList.toggle("trace-async", !!asyncSet[k]);
  });
  canvas.classList.toggle("tracing", !!path);
}
function setTrace(on) {
  traceOn = on;
  traceA = traceB = traceResult = null;
  traceIx = -1;
  $("trace").setAttribute("aria-pressed", on ? "true" : "false");
  if (on) {
    sel = null;
    panel.classList.add("open");
  } else if (!sel) panel.classList.remove("open");
  select(null);
  applyTraceClasses();
  renderPanel();
}
function tracePick(id) {
  if (!traceA || traceB) {
    traceA = id;
    traceB = null;
    traceResult = null;
    traceIx = -1;
  } else if (id !== traceA) {
    traceB = id;
    traceResult = ArchPaths.findPaths(model, traceA, traceB);
    traceIx = traceResult.paths.length ? 0 : -1;
  }
  applyTraceClasses();
  renderPanel();
}
function renderTracePanel() {
  var exit = h("button", { type: "button", class: "link" }, t("trace.exit"));
  exit.addEventListener("click", function () {
    setTrace(false);
  });
  if (!traceA) return body.append(h("p", { class: "note" }, t("trace.pickA")), exit);
  var a = nodeName(traceA);
  if (!traceB) return body.append(h("p", { class: "note" }, t("trace.pickB", { a: a })), exit);
  var b = nodeName(traceB);
  body.append(h("h2", {}, t("trace.title", { a: a, b: b })));
  if (!traceResult.paths.length)
    body.append(h("p", { class: "note" }, t("trace.none", { a: a, b: b })));
  else {
    body.append(h("p", { class: "meta" }, tn("trace.found", traceResult.paths.length)));
    var ol = h("ol", { class: "steps" });
    traceResult.paths.forEach(function (p, i) {
      var btn = h(
        "button",
        {
          type: "button",
          class: i === traceIx ? "current" : "",
          "aria-current": i === traceIx ? "true" : false,
        },
        h("span", { class: "n" }, tn("trace.hops", p.hops)),
        p.nodes.map(nodeName).join(t("trace.sep")),
        p.asyncCount
          ? h("span", { class: "meta" }, " (" + t("trace.async") + " ×" + p.asyncCount + ")")
          : null,
      );
      btn.addEventListener("click", function () {
        traceIx = i;
        applyTraceClasses();
        renderPanel();
      });
      ol.append(h("li", {}, btn));
    });
    body.append(ol);
    if (traceResult.truncated) body.append(h("p", { class: "meta" }, t("trace.cut")));
  }
  var reset = h("button", { type: "button", class: "link" }, t("trace.reset"));
  reset.addEventListener("click", function () {
    traceA = traceB = traceResult = null;
    traceIx = -1;
    applyTraceClasses();
    renderPanel();
  });
  body.append(reset, " ", exit);
}
$("trace").addEventListener("click", function () {
  setTrace(!traceOn);
});
document.addEventListener("keydown", function (ev) {
  if (ev.key === "Escape" && traceOn) setTrace(false);
});
