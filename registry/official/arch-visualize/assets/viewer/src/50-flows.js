// ---- request flows
var flows = model.flows || [];
var reducedMq = window.matchMedia("(prefers-reduced-motion: reduce)");
var motionOk = !reducedMq.matches; // pressing Play under reduced motion is a choice to see motion
var flowIx = 0,
  steps = [],
  st = newState(),
  speed = 1,
  raf = 0,
  lastTs = 0,
  shownIndex = -2;
var flowTabs = [],
  edgeLen = {};
var flowEdges = {},
  flowNodes = {};
var dot = s("g", { id: "dot", visibility: "hidden" }, s("circle", { r: 8, class: "dot req" }));
vp.append(dot);
var stepLabel = function (step) {
  if (step.label) return step.label;
  if (step.kind === "event") return step.event.replace(/[-_]+/g, " ");
  return step.reverse ? t("flow.response") : t("flow.request");
};
var nodeName = function (id) {
  return nodeById[id] ? nodeById[id].label : id;
};

function selectFlow(i) {
  flowIx = i;
  pauseLoop();
  st = newState();
  shownIndex = -2;
  steps = buildSteps(flows[i], edgeById, nodeById);
  flowEdges = {};
  flowNodes = {};
  steps.forEach(function (step) {
    if (step.kind === "edge") {
      flowEdges[step.edge] = true;
      flowNodes[step.from] = true;
      flowNodes[step.to] = true;
    } else flowNodes[step.node] = true;
  });
  flowTabs.forEach(function (b, k) {
    b.setAttribute("aria-selected", k === i ? "true" : "false");
  });
  Object.keys(edgeEls).forEach(function (k) {
    edgeEls[k].classList.toggle("dim", !flowEdges[k]);
  });
  Object.keys(nodeEls).forEach(function (k) {
    nodeEls[k].classList.toggle("dim", !flowNodes[k]);
  });
  renderFlow();
}
function pathLen(id) {
  if (edgeLen[id] === undefined) {
    try {
      edgeLen[id] = edgeEls[id].querySelector(".line").getTotalLength();
    } catch (e) {
      edgeLen[id] = 0;
    }
  }
  return edgeLen[id];
}
function renderFlow() {
  var step = st.index >= 0 ? steps[st.index] : null;
  Object.keys(edgeEls).forEach(function (k) {
    var on = !!(step && step.kind === "edge" && step.edge === k);
    edgeEls[k].classList.toggle("active", on && !step.reverse);
    edgeEls[k].classList.toggle("active-res", on && step.reverse);
  });
  Object.keys(nodeEls).forEach(function (k) {
    var flash = !!(step && step.kind === "event" && step.node === k);
    var onStep = !!(step && step.kind === "edge" && (step.from === k || step.to === k));
    nodeEls[k].classList.toggle("flash", flash);
    nodeEls[k].classList.toggle("on-step", onStep);
    cardEls[k].classList.toggle("on-step", flash || onStep);
  });
  if (step && step.kind === "edge" && edgeEls[step.edge]) {
    var len = pathLen(step.edge);
    var pt = edgeEls[step.edge].querySelector(".line").getPointAtLength(len * dotAt(step, st.t));
    dot.setAttribute("transform", "translate(" + pt.x + " " + pt.y + ")");
    dot.setAttribute("visibility", "visible");
    dot.firstChild.setAttribute("class", "dot " + (step.reverse ? "res" : "req"));
  } else dot.setAttribute("visibility", "hidden");
  // caption
  var cap = $("caption");
  clear(cap);
  if (!steps.length) cap.append(h("span", { class: "label" }, t("flow.empty")));
  else if (!step)
    cap.append(
      h(
        "span",
        { class: "label" },
        reducedMq.matches && !motionOk ? t("flow.reduced") : t("flow.hint"),
      ),
    );
  else {
    cap.append(
      h("span", { class: "step" }, t("flow.stepOf", { i: st.index + 1, n: steps.length })),
      h("span", { class: "label" }, stepLabel(step)),
      h(
        "span",
        { class: "dir" },
        step.kind === "edge"
          ? t(step.reverse ? "flow.dir.res" : "flow.dir.req", {
              from: nodeName(step.from),
              to: nodeName(step.to),
            })
          : t("flow.event", { node: nodeName(step.node) }),
      ),
    );
  }
  // controls
  var last = steps.length - 1;
  $("fplay").textContent = st.playing
    ? t("flow.pause")
    : reducedMq.matches && !motionOk
      ? t("flow.playMotion")
      : atEnd(st, steps)
        ? t("flow.replay")
        : t("flow.play");
  $("fplay").disabled = !steps.length;
  $("fstep").disabled = !steps.length || (st.index >= last && st.t >= 1);
  $("fback").disabled = st.index < 0;
  $("frestart").disabled = st.index < 0;
  if (tab === "flow" && shownIndex !== st.index) renderFlowPanel();
  shownIndex = st.index;
}
function renderFlowPanel() {
  clear(body);
  var f = flows[flowIx];
  body.append(h("h2", {}, f.name), h("p", { class: "meta" }, tn("flow.panel.meta", steps.length)));
  var ol = h("ol", { class: "steps" });
  steps.forEach(function (step, i) {
    var b = h(
      "button",
      {
        type: "button",
        class: i === st.index ? "current" : "",
        "aria-current": i === st.index ? "step" : false,
      },
      h("span", { class: "n" }, String(i + 1) + "."),
      stepLabel(step),
      h(
        "span",
        { class: "meta" },
        step.kind === "edge"
          ? t(step.reverse ? "flow.item.res" : "flow.item.req", {
              from: nodeName(step.from),
              to: nodeName(step.to),
            })
          : t("flow.item.event", { node: nodeName(step.node) }),
      ),
    );
    b.addEventListener("click", function () {
      pauseLoop();
      st = jump(st, i, steps);
      renderFlow();
    });
    ol.append(h("li", {}, b));
  });
  body.append(ol);
}
function frame(ts) {
  raf = 0;
  st = advance(st, lastTs ? ts - lastTs : 16, steps, speed);
  lastTs = ts;
  renderFlow();
  if (st.playing) raf = requestAnimationFrame(frame);
  else lastTs = 0;
}
function kick() {
  if (st.playing && !raf) {
    lastTs = 0;
    raf = requestAnimationFrame(frame);
  }
}
function pauseLoop() {
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
  lastTs = 0;
  st = pause(st);
}
if (flows.length) {
  $("flowbar").hidden = false;
  $("caption").hidden = false;
  $("tab-flow").hidden = false;
  flows.forEach(function (f, i) {
    var b = h("button", { type: "button", role: "tab", "aria-selected": "false" }, f.name);
    b.addEventListener("click", function () {
      selectFlow(i);
    });
    flowTabs.push(b);
    $("flowtabs").append(b);
  });
  $("fplay").addEventListener("click", function () {
    if (st.playing) {
      pauseLoop();
    } else {
      if (reducedMq.matches) motionOk = true;
      st = play(st, steps);
      kick();
    }
    renderFlow();
  });
  $("fstep").addEventListener("click", function () {
    pauseLoop();
    st = stepForward(st, steps, !motionOk);
    kick();
    renderFlow();
  });
  $("fback").addEventListener("click", function () {
    pauseLoop();
    st = stepBack(st);
    renderFlow();
  });
  $("frestart").addEventListener("click", function () {
    pauseLoop();
    st = newState();
    renderFlow();
  });
  $("fspeed").addEventListener("change", function (ev) {
    speed = parseFloat(ev.target.value) || 1;
  });
  var onMotionChange = function () {
    motionOk = !reducedMq.matches;
    if (reducedMq.matches) pauseLoop();
    renderFlow();
  };
  if (reducedMq.addEventListener) reducedMq.addEventListener("change", onMotionChange);
  selectFlow(0);
}

fit();
renderPanel();
