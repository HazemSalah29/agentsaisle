// ---- search: press / to search labels, technology, file paths and risk ids
var qBox = $("q"),
  resultsEl = $("results"),
  statusEl = $("find-status");
var hits = [],
  activeHit = -1;
function centerOnNodes(ids) {
  var x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  ids.forEach(function (id) {
    var p = pos[id];
    if (!p) return;
    x0 = Math.min(x0, p.x);
    y0 = Math.min(y0, p.y);
    x1 = Math.max(x1, p.x + W);
    y1 = Math.max(y1, p.y + H);
  });
  var r = stage.getBoundingClientRect();
  if (x0 === Infinity || !r.width) return;
  view.x = r.width / 2 - ((x0 + x1) / 2) * view.k;
  view.y = r.height / 2 - ((y0 + y1) / 2) * view.k;
  applyView();
}
function markMatches() {
  var nodeSet = {},
    edgeSet = {};
  hits.forEach(function (hit) {
    if (hit.kind === "edge") edgeSet[hit.id] = true;
    hit.nodes.forEach(function (id) {
      nodeSet[id] = true;
    });
  });
  Object.keys(nodeEls).forEach(function (k) {
    nodeEls[k].classList.toggle("match", !!nodeSet[k]);
  });
  Object.keys(edgeEls).forEach(function (k) {
    edgeEls[k].classList.toggle("match", !!edgeSet[k]);
  });
  canvas.classList.toggle("searching", hits.length > 0);
}
function hitLabel(hit) {
  if (hit.kind === "node") return nodeById[hit.id].label;
  if (hit.kind === "edge") {
    var e = edgeById[hit.id];
    return t("edge.title", {
      from: nodeById[e.from] ? nodeById[e.from].label : e.from,
      to: nodeById[e.to] ? nodeById[e.to].label : e.to,
    });
  }
  var r = (model.risks || []).filter(function (x) {
    return x.id === hit.id;
  })[0];
  return hit.id + (r && r.title ? " · " + r.title : "");
}
function closeResults() {
  resultsEl.hidden = true;
  qBox.setAttribute("aria-expanded", "false");
  qBox.removeAttribute("aria-activedescendant");
}
function setActive(i) {
  activeHit = i;
  Array.prototype.forEach.call(resultsEl.children, function (li, k) {
    li.setAttribute("aria-selected", k === i ? "true" : "false");
  });
  if (i >= 0) qBox.setAttribute("aria-activedescendant", "hit-" + i);
  else qBox.removeAttribute("aria-activedescendant");
}
function renderResults() {
  clear(resultsEl);
  hits.forEach(function (hit, i) {
    var li = h(
      "li",
      { role: "option", id: "hit-" + i, "aria-selected": "false" },
      h("span", { class: "kind" }, t("search.kind." + hit.kind)),
      " ",
      hitLabel(hit),
    );
    li.addEventListener("mousedown", function (ev) {
      ev.preventDefault();
      chooseHit(i);
    });
    resultsEl.append(li);
  });
  var any = hits.length > 0;
  resultsEl.hidden = !(any || qBox.value.trim());
  if (!any && qBox.value.trim()) resultsEl.append(h("li", { class: "none" }, t("search.none")));
  qBox.setAttribute("aria-expanded", resultsEl.hidden ? "false" : "true");
  statusEl.textContent = qBox.value.trim() ? tn("search.count", hits.length) : "";
}
function runSearch(centre) {
  hits = ArchSearch.search(model, qBox.value, 20);
  renderResults();
  setActive(-1);
  markMatches();
  if (centre && hits.length && qBox.value.trim().length > 1) centerOnNodes(hits[0].nodes);
}
function chooseHit(i) {
  var hit = hits[i];
  if (!hit) return;
  closeResults();
  centerOnNodes(hit.nodes);
  if (hit.kind === "node") select("node", hit.id);
  else if (hit.kind === "edge") select("edge", hit.id);
  else if (hit.nodes[0]) select("node", hit.nodes[0]);
  else {
    tab = "risks";
    panel.classList.add("open");
    renderPanel();
  }
}
function clearSearch() {
  qBox.value = "";
  hits = [];
  closeResults();
  markMatches();
  statusEl.textContent = "";
}
qBox.addEventListener("input", function () {
  runSearch(true);
});
qBox.addEventListener("keydown", function (ev) {
  if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
    if (!hits.length) return;
    ev.preventDefault();
    var n = hits.length;
    setActive(ev.key === "ArrowDown" ? (activeHit + 1) % n : (activeHit - 1 + n) % n);
  } else if (ev.key === "Enter") {
    ev.preventDefault();
    chooseHit(activeHit >= 0 ? activeHit : 0);
  } else if (ev.key === "Escape") {
    ev.preventDefault();
    ev.stopPropagation();
    clearSearch();
    qBox.blur();
    stage.focus();
  }
});
qBox.addEventListener("blur", closeResults);
qBox.addEventListener("focus", function () {
  if (qBox.value.trim()) runSearch(false);
});
document.addEventListener("keydown", function (ev) {
  if (ev.key !== "/" || ev.ctrlKey || ev.metaKey || ev.altKey) return;
  var tag = ev.target && ev.target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
  ev.preventDefault();
  qBox.focus();
  qBox.select();
});
