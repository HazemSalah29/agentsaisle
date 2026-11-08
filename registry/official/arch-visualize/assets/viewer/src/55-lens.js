// ---- lenses: the same diagram, read for a different question. System shows the parts; Flows plays a request.
var LENS_ORDER = ["system", "flows", "security", "failure", "ai", "diff"].filter(lensAvailable);
function setLens(name) {
  lens = LENS_ORDER.indexOf(name) >= 0 ? name : "system";
  document.documentElement.setAttribute("data-lens", lens);
  LENS_ORDER.forEach(function (l) {
    var b = $("lens-" + l);
    b.hidden = false;
    b.setAttribute("aria-selected", l === lens ? "true" : "false");
    b.tabIndex = l === lens ? 0 : -1;
  });
  var inFlows = lens === "flows";
  $("flowbar").hidden = !inFlows || !flows.length;
  $("caption").hidden = !inFlows || !flows.length;
  $("tab-flow").hidden = !inFlows || !flows.length;
  if (!inFlows) {
    pauseLoop();
    if (tab === "flow") tab = "details";
  }
  if (flows.length) applyFocus();
  $("lenses").hidden = LENS_ORDER.length < 2;
  applyLensView();
  renderPanel();
  scheduleLink();
}
LENS_ORDER.forEach(function (l) {
  $("lens-" + l).addEventListener("click", function () {
    if (dState.open) closeDetail(true);
    setLens(l);
  });
  $("lens-" + l).addEventListener("keydown", function (ev) {
    var dir = ev.key === "ArrowRight" ? 1 : ev.key === "ArrowLeft" ? -1 : 0;
    if (!dir) return;
    if (RTL) dir = -dir;
    ev.preventDefault();
    var next = LENS_ORDER[(LENS_ORDER.indexOf(l) + dir + LENS_ORDER.length) % LENS_ORDER.length];
    if (dState.open) closeDetail(true);
    setLens(next);
    $("lens-" + next).focus();
  });
});
