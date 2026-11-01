// ---- pan and zoom
var stage = $("stage");
var view = { x: 0, y: 0, k: 1 };
var moved = false;
function applyView() {
  vp.setAttribute("transform", "translate(" + view.x + " " + view.y + ") scale(" + view.k + ")");
  canvas.setAttribute("data-lod", ArchLod.level(view.k));
  drawMinimapView();
  scheduleLink();
}
function panBy(dx, dy) {
  view.x += dx;
  view.y += dy;
  applyView();
}
function fit() {
  var r = stage.getBoundingClientRect();
  if (!r.width || !r.height) return;
  var k = Math.min(r.width / contentW, r.height / contentH, 1.25);
  view = { k: k, x: (r.width - contentW * k) / 2, y: (r.height - contentH * k) / 2 };
  applyView();
}
function zoomAt(px, py, f) {
  var k = Math.max(0.2, Math.min(3, view.k * f));
  view.x = px - ((px - view.x) * k) / view.k;
  view.y = py - ((py - view.y) * k) / view.k;
  view.k = k;
  applyView();
}
function center() {
  var r = stage.getBoundingClientRect();
  return [r.width / 2, r.height / 2];
}
var framed = false;
try {
  framed = window.self !== window.top;
} catch (e) {
  framed = true;
}
stage.addEventListener(
  "wheel",
  function (ev) {
    // Inside another page (an embedded demo) a plain scroll belongs to that page; zoom needs
    // ctrl or cmd, the + and - buttons, or a pinch.
    if (framed && !ev.ctrlKey && !ev.metaKey) return;
    ev.preventDefault();
    var r = stage.getBoundingClientRect();
    zoomAt(
      ev.clientX - r.left,
      ev.clientY - r.top,
      Math.exp(-ev.deltaY * (ev.ctrlKey ? 0.01 : 0.0018)),
    );
  },
  { passive: false },
);
var drag = null;
stage.addEventListener("pointerdown", function (ev) {
  if (ev.target.closest && ev.target.closest("#zoom, #minimap")) return;
  drag = { x: ev.clientX, y: ev.clientY, vx: view.x, vy: view.y };
  moved = false;
});
stage.addEventListener("pointermove", function (ev) {
  if (!drag) return;
  var dx = ev.clientX - drag.x,
    dy = ev.clientY - drag.y;
  if (!moved && Math.abs(dx) + Math.abs(dy) < 5) return;
  if (!moved) {
    moved = true;
    stage.classList.add("dragging");
    try {
      stage.setPointerCapture(ev.pointerId);
    } catch (e) {
      /* capture is optional */
    }
  }
  view.x = drag.vx + dx;
  view.y = drag.vy + dy;
  applyView();
});
function endDrag() {
  drag = null;
  stage.classList.remove("dragging");
  setTimeout(function () {
    moved = false;
  }, 0);
}
stage.addEventListener("pointerup", endDrag);
stage.addEventListener("pointercancel", endDrag);
stage.addEventListener("click", function () {
  if (!moved) select(null);
});
stage.addEventListener("keydown", function (ev) {
  if (ev.target !== stage) return;
  var c = center(),
    step = 60,
    handled = true;
  if (ev.key === "ArrowLeft") view.x += step;
  else if (ev.key === "ArrowRight") view.x -= step;
  else if (ev.key === "ArrowUp") view.y += step;
  else if (ev.key === "ArrowDown") view.y -= step;
  else if (ev.key === "+" || ev.key === "=") return zoomAt(c[0], c[1], 1.2);
  else if (ev.key === "-") return zoomAt(c[0], c[1], 1 / 1.2);
  else if (ev.key === "0") return fit();
  else handled = false;
  if (handled) {
    ev.preventDefault();
    applyView();
  }
});
$("zin").addEventListener("click", function (ev) {
  ev.stopPropagation();
  var c = center();
  zoomAt(c[0], c[1], 1.25);
});
$("zout").addEventListener("click", function (ev) {
  ev.stopPropagation();
  var c = center();
  zoomAt(c[0], c[1], 0.8);
});
$("zfit").addEventListener("click", function (ev) {
  ev.stopPropagation();
  fit();
});
window.addEventListener("resize", fit);
