// ---- deep links: the address after # keeps the selection, flow step and camera
var linkTimer = 0,
  userTouched = false;
["pointerdown", "keydown", "wheel"].forEach(function (name) {
  document.addEventListener(
    name,
    function () {
      userTouched = true;
    },
    true,
  );
});
function linkState() {
  return {
    lens: lens !== "system" ? lens : undefined,
    node: sel && sel.kind === "node" ? sel.id : undefined,
    edge: sel && sel.kind === "edge" ? sel.id : undefined,
    in: dState.open || undefined,
    sym: sel && sel.kind === "symbol" ? sel.id : undefined,
    down: failDown.length ? failDown.join(",") : undefined,
    flow: flows.length && st.index >= 0 ? flows[flowIx].id : undefined,
    step: flows.length && st.index >= 0 ? st.index + 1 : undefined,
    x: view.x,
    y: view.y,
    k: view.k,
  };
}
function scheduleLink() {
  if (!userTouched) return;
  clearTimeout(linkTimer);
  linkTimer = setTimeout(function () {
    try {
      var hash = ArchHash.buildHash(linkState());
      history.replaceState(null, "", hash || location.href.split("#")[0]);
    } catch (e) {
      // some frames and file:// pages refuse; the link is a convenience
    }
  }, 250);
}
function applyLink(want) {
  if (want.lens && want.lens !== lens) setLens(want.lens);
  if (want.in && nodeById[want.in] && nodeById[want.in].detail) {
    if (dState.open !== want.in) openDetail(want.in, want.sym, true);
  } else if (dState.open) closeDetail(true);
  if (want.k !== undefined && want.x !== undefined && want.y !== undefined) {
    view = { x: want.x, y: want.y, k: want.k };
    applyView();
  }
  if (want.flow && flows.length) {
    var ix = flows.findIndex(function (f) {
      return f.id === want.flow;
    });
    if (ix >= 0) {
      selectFlow(ix);
      if (want.step) {
        st = jump(st, Math.min(want.step, steps.length) - 1, steps);
        renderFlow();
      }
    }
  }
  if (want.down && lens === "failure") simulateDown(want.down.split(","));
  if (want.in && want.sym && dState.open === want.in && detailIdx.byId[want.sym])
    select("symbol", want.sym);
  else if (want.node && nodeById[want.node]) select("node", want.node);
  else if (want.edge && edgeById[want.edge]) select("edge", want.edge);
}
window.addEventListener("hashchange", function () {
  applyLink(ArchHash.parseHash(location.hash));
});
