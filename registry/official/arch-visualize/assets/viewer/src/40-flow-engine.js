// <flow-engine>
// Pure helpers for the request flows: no DOM, no timers. A state is
// { index, t, playing, once }: the current step, how far through it (0 to 1), whether time is
// running, and whether to stop after this step. index -1 means not started.
var EDGE_MS = 1000,
  EVENT_MS = 800,
  MAX_DT = 100;
function buildSteps(flow, edgeById, nodeById) {
  var out = [];
  ((flow && flow.steps) || []).forEach(function (st) {
    if (st.edge) {
      var e = edgeById[st.edge];
      if (!e) return;
      var rev = st.reverse === true;
      out.push({
        kind: "edge",
        edge: e.id,
        reverse: rev,
        label: st.label || "",
        from: rev ? e.to : e.from,
        to: rev ? e.from : e.to,
      });
    } else if (st.event && nodeById[st.node]) {
      out.push({
        kind: "event",
        event: st.event,
        node: st.node,
        label: st.label || "",
        from: st.node,
        to: st.node,
      });
    }
  });
  return out;
}
function stepMs(step, speed) {
  return (step.kind === "edge" ? EDGE_MS : EVENT_MS) / speed;
}
function newState() {
  return { index: -1, t: 0, playing: false, once: false };
}
function copyState(x) {
  return { index: x.index, t: x.t, playing: x.playing, once: x.once };
}
function atEnd(x, steps) {
  return steps.length > 0 && x.index >= steps.length - 1 && x.t >= 1;
}
function play(x, steps) {
  var n = copyState(x);
  if (!steps.length) return n;
  if (n.index < 0 || atEnd(n, steps)) {
    n.index = 0;
    n.t = 0;
  }
  n.playing = true;
  n.once = false;
  return n;
}
function pause(x) {
  var n = copyState(x);
  n.playing = false;
  return n;
}
function stepForward(x, steps, instant) {
  var n = copyState(x);
  if (!steps.length) return n;
  if (n.index >= 0 && n.t < 1) {
    n.t = 1;
    n.playing = false;
    return n;
  }
  if (n.index >= steps.length - 1) {
    n.playing = false;
    return n;
  }
  n.index += 1;
  n.t = instant ? 1 : 0;
  n.playing = !instant;
  n.once = true;
  return n;
}
function stepBack(x) {
  var n = copyState(x);
  n.playing = false;
  if (n.index <= 0) {
    n.index = -1;
    n.t = 0;
  } else {
    n.index -= 1;
    n.t = 1;
  }
  return n;
}
function jump(x, i, steps) {
  var n = copyState(x);
  n.index = Math.max(0, Math.min(i, steps.length - 1));
  n.t = 1;
  n.playing = false;
  return n;
}
function advance(x, dtMs, steps, speed) {
  if (!x.playing || !steps.length) return x;
  var n = copyState(x);
  if (n.index < 0) {
    n.index = 0;
    n.t = 0;
  }
  n.t += Math.min(dtMs, MAX_DT) / stepMs(steps[n.index], speed);
  if (n.t >= 1) {
    n.t = 1;
    if (n.once || n.index >= steps.length - 1) n.playing = false;
    else {
      n.index += 1;
      n.t = 0;
    }
  }
  return n;
}
// Where the dot is along its edge (0 = start of the path): responses travel backwards.
function dotAt(step, t) {
  return step.reverse ? 1 - t : t;
}
// </flow-engine>
