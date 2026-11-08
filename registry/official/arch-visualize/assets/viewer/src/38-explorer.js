// ---- explorer: a searchable list of everything inside the open component, and the numbered trace of one function
var EX_W = 300;
var ex = { node: null, tab: "all", q: "", hidden: false };
var tr = { start: null, steps: [], truncated: false, index: -1, timer: 0, speed: 1 };
var exEl = $("explorer"),
  exList = $("ex-list"),
  exQ = $("ex-q"),
  exTabs = $("ex-tabs"),
  exStatus = $("ex-status");
var trEl = $("calltrace");

function openSymbols() {
  var n = ex.node && nodeById[ex.node];
  return n && n.detail ? n.detail.symbols : [];
}
function explorerWidth() {
  return !ex.node || exEl.hidden || ex.hidden || stageSize()[0] < 760 ? 0 : EX_W;
}
/** The part of the stage the diagram may use: not under the list, the breadcrumb bar or the trace. */
function freeRegion() {
  var size = stageSize(),
    ew = explorerWidth();
  var top = crumbs.hidden ? 0 : Math.ceil(crumbs.getBoundingClientRect().height) + 22;
  var drawer = trEl.hidden ? 0 : Math.ceil(trEl.getBoundingClientRect().height);
  return {
    x0: RTL ? 0 : ew,
    x1: RTL ? size[0] - ew : size[0],
    y0: top,
    y1: size[1] - drawer,
  };
}
function layoutVars() {
  stage.style.setProperty("--ex-w", explorerWidth() + "px");
  stage.style.setProperty(
    "--crumbs-h",
    (crumbs.hidden ? 0 : Math.ceil(crumbs.getBoundingClientRect().height)) + 20 + "px",
  );
  stage.style.setProperty(
    "--tr-h",
    (trEl.hidden ? 0 : Math.ceil(trEl.getBoundingClientRect().height)) + "px",
  );
}
window.addEventListener("resize", function () {
  if (dState.open) layoutVars();
});

// ---- the list
function tabName(tabId) {
  var names = {
    all: t("explorer.tab.all"),
    components: t("explorer.tab.components"),
    functions: t("explorer.tab.functions"),
    routes: t("explorer.tab.routes"),
    hooks: t("explorer.tab.hooks"),
  };
  return names[tabId];
}
function showExplorer(n) {
  ex.node = n.id;
  ex.q = "";
  ex.tab = "all";
  exQ.value = "";
  exEl.hidden = false;
  $("crumb-list").hidden = false;
  $("ex-title").textContent = t("explorer.title", { label: n.label });
  applyCollapsed();
  renderExplorer();
}
function hideExplorer() {
  endTrace();
  exEl.hidden = true;
  ex.node = null;
  $("crumb-list").hidden = true;
  markFilter([]);
  layoutVars();
}
function applyCollapsed() {
  var off = ex.hidden || stageSize()[0] < 760;
  exEl.classList.toggle("collapsed", off);
  var btn = $("crumb-list");
  btn.setAttribute("aria-pressed", off ? "false" : "true");
  btn.textContent = off ? t("explorer.show") : t("explorer.hide");
  layoutVars();
}
$("crumb-list").addEventListener("click", function (ev) {
  ev.stopPropagation();
  ex.hidden = !ex.hidden;
  applyCollapsed();
});
function renderExplorer() {
  var syms = openSymbols();
  var counts = ArchDetail.kindCounts(syms);
  clear(exTabs);
  ["all", "components", "functions", "routes", "hooks"].forEach(function (id) {
    if (id !== "all" && !counts[id]) return;
    var b = h(
      "button",
      {
        type: "button",
        role: "tab",
        "aria-selected": ex.tab === id ? "true" : "false",
        tabindex: ex.tab === id ? "0" : "-1",
        "data-tab": id,
      },
      tabName(id) + " " + counts[id],
    );
    b.addEventListener("click", function () {
      ex.tab = id;
      renderExplorer();
    });
    exTabs.append(b);
  });
  if (!counts[ex.tab]) ex.tab = "all";
  var items = ArchDetail.filter(syms, ex.q, ex.tab);
  exStatus.textContent = items.length
    ? t("explorer.count", { shown: items.length, total: counts[ex.tab] })
    : t("explorer.none");
  clear(exList);
  var lastFile = null;
  items.forEach(function (x) {
    if (!ex.q.trim() && x.file !== lastFile) {
      exList.append(h("h4", {}, x.file));
      lastFile = x.file;
    }
    var b = h(
      "button",
      { type: "button", class: "ex-item k-" + x.kind, "data-sym": x.id, title: x.doc || x.file },
      h(
        "span",
        { class: "row1" },
        h("span", { class: "nm" }, x.name),
        h("span", { class: "kd" }, symKind(x.kind)),
      ),
      h("span", { class: "row2" }, (ex.q.trim() ? shortFile(x.file) : "") + ":" + x.line),
      x.doc ? h("span", { class: "row3" }, clip(x.doc, 90)) : null,
    );
    b.addEventListener("click", function () {
      focusSymbol(x.id);
    });
    exList.append(b);
  });
  markFilter(ex.q.trim() ? items : []);
  syncExplorer();
}
/** Cards that match the filter stay lit in the diagram; the others dim. */
function markFilter(items) {
  var on = {};
  items.forEach(function (x) {
    on[x.id] = true;
  });
  Object.keys(dState.scenes).forEach(function (nid) {
    var sc = dState.scenes[nid];
    sc.g.classList.toggle("has-filter", items.length > 0);
    Object.keys(sc.symEls).forEach(function (k) {
      sc.symEls[k].classList.toggle("match", !!on[k]);
    });
  });
}
exQ.addEventListener("input", function () {
  ex.q = exQ.value;
  renderExplorer();
});
exQ.addEventListener("keydown", function (ev) {
  var items = exList.querySelectorAll(".ex-item");
  if (ev.key === "ArrowDown" && items.length) {
    ev.preventDefault();
    items[0].focus();
  } else if (ev.key === "Enter" && items.length) {
    ev.preventDefault();
    items[0].click();
  } else if (ev.key === "Escape") {
    ev.preventDefault();
    ev.stopPropagation();
    if (exQ.value) {
      exQ.value = "";
      ex.q = "";
      renderExplorer();
    } else stage.focus();
  }
});
exList.addEventListener("keydown", function (ev) {
  var items = Array.prototype.slice.call(exList.querySelectorAll(".ex-item"));
  var at = items.indexOf(document.activeElement);
  if (at < 0) return;
  var next =
    ev.key === "ArrowDown"
      ? at + 1
      : ev.key === "ArrowUp"
        ? at - 1
        : ev.key === "Home"
          ? 0
          : ev.key === "End"
            ? items.length - 1
            : -1;
  if (next < 0) return;
  ev.preventDefault();
  if (next < 0 || next >= items.length) {
    if (next < 0) exQ.focus();
    return;
  }
  items[next].focus();
});
exTabs.addEventListener("keydown", function (ev) {
  var tabs = Array.prototype.slice.call(exTabs.querySelectorAll("button"));
  var at = tabs.indexOf(document.activeElement);
  var dir = ev.key === "ArrowRight" ? 1 : ev.key === "ArrowLeft" ? -1 : 0;
  if (at < 0 || !dir) return;
  if (RTL) dir = -dir;
  ev.preventDefault();
  tabs[(at + dir + tabs.length) % tabs.length].click();
  exTabs.querySelector('[aria-selected="true"]').focus();
});
/** Keep the list and the trace in step with what is selected in the diagram or the panel. */
function syncExplorer() {
  if (!dState.open) return;
  var picked = sel && sel.kind === "symbol" ? sel.id : null;
  Array.prototype.forEach.call(exList.querySelectorAll(".ex-item"), function (b) {
    var on = b.getAttribute("data-sym") === picked;
    b.classList.toggle("selected", on);
    if (on) {
      b.setAttribute("aria-current", "true");
      if (b.scrollIntoView && !exEl.classList.contains("collapsed"))
        b.scrollIntoView({ block: "nearest" });
    } else b.removeAttribute("aria-current");
  });
  if (picked) {
    if (tr.start !== picked) startTrace(picked);
  } else if (tr.start) endTrace();
}

// ---- the trace: the calls a function makes, in order, as numbered steps
var trTable = $("tr-table"),
  trBody = $("tr-body"),
  trCaption = $("tr-caption"),
  playBtn = $("tr-play");
function pad2(n) {
  return n < 10 ? "0" + n : String(n);
}
function symName(id) {
  var x = detailIdx.byId[id];
  return x ? x.name : id;
}
function startTrace(id) {
  stopPlay();
  var r = ArchDetail.trace(model, id, {}, detailIdx);
  tr = {
    start: id,
    steps: r.steps,
    truncated: r.truncated,
    index: -1,
    timer: 0,
    speed: tr.speed || 1,
  };
  trEl.hidden = false;
  stage.classList.add("has-trace");
  renderTrace();
  layoutVars();
}
function endTrace() {
  stopPlay();
  clearPlayMarks();
  tr.start = null;
  tr.steps = [];
  tr.index = -1;
  trEl.hidden = true;
  stage.classList.remove("has-trace");
  layoutVars();
}
function renderTrace() {
  $("tr-title").textContent = t("steps.title", { name: symName(tr.start) });
  clear(trBody);
  if (!tr.steps.length) {
    trBody.append(h("tr", {}, h("td", { colspan: "6", class: "empty" }, t("steps.empty"))));
  }
  tr.steps.forEach(function (st, i) {
    var from = detailIdx.byId[st.from];
    var notes = [];
    if (st.in) notes.push(ctxText(st.in));
    if (st.inferred) notes.push(t("sym.inferred"));
    if (st.again) notes.push(t("steps.again"));
    if (detailIdx.nodeOf[st.to] !== dState.open && nodeById[detailIdx.nodeOf[st.to]])
      notes.push(nodeById[detailIdx.nodeOf[st.to]].label);
    var row = h(
      "tr",
      { "data-step": i, style: "--depth:" + (st.depth - 1) },
      h("td", { class: "no" }, pad2(st.n)),
      h("td", { class: "fr" }, symName(st.from)),
      h("td", { class: "to" }, symName(st.to)),
      h("td", {}, linkKind(st.kind)),
      h("td", { class: "wh" }, from ? shortFile(from.file) + ":" + st.line : ""),
      h("td", { class: "nt" }, notes.filter(Boolean).join(" · ")),
    );
    row.addEventListener("click", function () {
      stopPlay();
      setStep(i);
    });
    trBody.append(row);
  });
  $("tr-limit").textContent = tr.truncated ? t("steps.limit", { n: tr.steps.length }) : "";
  setStep(tr.index, true);
}
function clearPlayMarks() {
  Object.keys(dState.scenes).forEach(function (nid) {
    var sc = dState.scenes[nid];
    Object.keys(sc.symEls).forEach(function (k) {
      sc.symEls[k].classList.remove("play-from", "play-to");
    });
    Object.keys(sc.edgeEls).forEach(function (k) {
      sc.edgeEls[k].classList.remove("playing", "trail");
    });
  });
}
function setStep(i, quiet) {
  tr.index = Math.max(-1, Math.min(tr.steps.length - 1, i));
  var total = tr.steps.length;
  $("tr-counter").textContent = t("steps.counter", {
    n: tr.index < 0 ? "–" : pad2(tr.index + 1),
    total: pad2(total),
  });
  Array.prototype.forEach.call(trBody.querySelectorAll("tr[data-step]"), function (row) {
    var k = Number(row.getAttribute("data-step"));
    row.classList.toggle("current", k === tr.index);
    row.classList.toggle("past", k < tr.index);
    if (k === tr.index) {
      row.setAttribute("aria-current", "step");
      if (!quiet && row.scrollIntoView) row.scrollIntoView({ block: "nearest" });
    } else row.removeAttribute("aria-current");
  });
  $("tr-back").disabled = tr.index < 0;
  $("tr-step").disabled = !total || tr.index >= total - 1;
  $("tr-reset").disabled = tr.index < 0;
  playBtn.disabled = !total;
  clearPlayMarks();
  clear(trCaption);
  if (tr.index < 0) return;
  var sc = dState.scenes[dState.open];
  var cur = tr.steps[tr.index];
  for (var j = 0; j <= tr.index && sc; j++) {
    var s2 = tr.steps[j];
    var eid = sc.keyToEdge[s2.from + ">" + s2.to + ":" + s2.kind];
    if (eid && sc.edgeEls[eid]) sc.edgeEls[eid].classList.add(j === tr.index ? "playing" : "trail");
  }
  if (sc) {
    if (sc.symEls[cur.from]) sc.symEls[cur.from].classList.add("play-from");
    if (sc.symEls[cur.to]) sc.symEls[cur.to].classList.add("play-to");
    if (!quiet) ensureVisible([cur.from, cur.to]);
  }
  trCaption.append(
    t("steps.caption", { from: symName(cur.from), how: linkKind(cur.kind), to: symName(cur.to) }) +
      (cur.in ? " · " + ctxText(cur.in) : ""),
  );
  var toNode = detailIdx.nodeOf[cur.to];
  if (toNode && toNode !== dState.open && nodeById[toNode]) {
    var go = h("button", { type: "button", class: "link" }, t("steps.go"));
    go.addEventListener("click", function () {
      stopPlay();
      gotoSymbol(cur.to);
    });
    trCaption.append(" ", t("steps.leaves", { node: nodeById[toNode].label }), " ", go);
  }
}
/** Pan the camera only when the two cards of a step are not both in view. */
function ensureVisible(ids) {
  var sc = dState.scenes[dState.open];
  if (!sc || !dState.plan) return;
  var rg = freeRegion();
  var x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  ids.forEach(function (id) {
    var p = sc.L.pos[id];
    if (!p) return;
    var a = ArchZoom.worldOf(dState.plan, p);
    x0 = Math.min(x0, a[0] - p.w / 2);
    x1 = Math.max(x1, a[0] + p.w / 2);
    y0 = Math.min(y0, a[1] - p.h / 2);
    y1 = Math.max(y1, a[1] + p.h / 2);
  });
  if (x0 === Infinity) return;
  var sx0 = view.x + view.k * x0,
    sx1 = view.x + view.k * x1,
    sy0 = view.y + view.k * y0,
    sy1 = view.y + view.k * y1;
  if (sx0 >= rg.x0 && sx1 <= rg.x1 && sy0 >= rg.y0 && sy1 <= rg.y1) return;
  var cx = (rg.x0 + rg.x1) / 2,
    cy = (rg.y0 + rg.y1) / 2;
  tweenView({ x: cx - (view.k * (x0 + x1)) / 2, y: cy - (view.k * (y0 + y1)) / 2, k: view.k }, 320);
}
function stopPlay() {
  clearTimeout(tr.timer);
  tr.timer = 0;
  playBtn.textContent = reduceMotion ? t("flow.playMotion") : t("flow.play");
  playBtn.setAttribute("aria-pressed", "false");
}
function tick() {
  if (tr.index >= tr.steps.length - 1) return stopPlay();
  setStep(tr.index + 1);
  tr.timer = setTimeout(tick, 1100 / tr.speed);
}
// Nothing plays until the reader asks: the button, or the P key.
function togglePlay() {
  if (tr.timer) return stopPlay();
  if (!tr.steps.length) return;
  if (tr.index >= tr.steps.length - 1) setStep(-1);
  playBtn.textContent = t("flow.pause");
  playBtn.setAttribute("aria-pressed", "true");
  tr.timer = setTimeout(tick, 250);
}
playBtn.addEventListener("click", togglePlay);
$("tr-step").addEventListener("click", function () {
  stopPlay();
  setStep(tr.index + 1);
});
$("tr-back").addEventListener("click", function () {
  stopPlay();
  setStep(tr.index - 1);
});
$("tr-reset").addEventListener("click", function () {
  stopPlay();
  setStep(-1);
});
$("tr-speed").addEventListener("change", function () {
  tr.speed = Number($("tr-speed").value) || 1;
});
$("tr-close").addEventListener("click", function (ev) {
  ev.stopPropagation();
  select(null);
});
// the list and the trace sit inside the stage, so their clicks, drags and scrolling must not reach it
[exEl, trEl].forEach(function (el) {
  ["pointerdown", "click"].forEach(function (name) {
    el.addEventListener(name, function (ev) {
      ev.stopPropagation();
    });
  });
  el.addEventListener(
    "wheel",
    function (ev) {
      ev.stopPropagation();
    },
    { passive: true },
  );
});
document.addEventListener("keydown", function (ev) {
  if (!dState.open || ev.ctrlKey || ev.metaKey || ev.altKey) return;
  var tag = ev.target && ev.target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
  if (ev.key === "]" && tr.start) {
    stopPlay();
    setStep(tr.index + 1);
  } else if (ev.key === "[" && tr.start) {
    stopPlay();
    setStep(tr.index - 1);
  } else if ((ev.key === "p" || ev.key === "P") && tr.start) togglePlay();
  else if (ev.key === "l" || ev.key === "L") $("crumb-list").click();
  else return;
  ev.preventDefault();
});
stopPlay();
