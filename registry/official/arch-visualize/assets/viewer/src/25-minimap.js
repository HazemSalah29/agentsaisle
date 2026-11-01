// ---- minimap: the whole diagram in a corner, with the part in view outlined; click or drag to move
var mini = $("mini");
var MINI_W = 168;
var miniH = Math.max(40, Math.min(110, Math.round((MINI_W * contentH) / contentW)));
setAttrs(mini, { viewBox: "0 0 " + contentW + " " + contentH, width: MINI_W, height: miniH });
lay.groups.forEach(function (g) {
  mini.append(s("rect", { class: "mini-group", x: g.x, y: g.y, width: g.w, height: g.h }));
});
model.nodes.forEach(function (n) {
  var p = pos[n.id];
  if (p) mini.append(s("rect", { class: "mini-node", x: p.x, y: p.y, width: W, height: H }));
});
var miniView = s("rect", { class: "mini-view" });
mini.append(miniView);
function drawMinimapView() {
  var r = stage.getBoundingClientRect();
  if (!r.width || !view.k) return;
  setAttrs(miniView, {
    x: -view.x / view.k,
    y: -view.y / view.k,
    width: r.width / view.k,
    height: r.height / view.k,
  });
}
function miniMoveTo(ev) {
  var box = mini.getBoundingClientRect();
  if (!box.width) return;
  var scale = Math.min(box.width / contentW, box.height / contentH);
  var cx = (ev.clientX - box.left - (box.width - contentW * scale) / 2) / scale;
  var cy = (ev.clientY - box.top - (box.height - contentH * scale) / 2) / scale;
  var c = center();
  view.x = c[0] - cx * view.k;
  view.y = c[1] - cy * view.k;
  applyView();
}
var miniDrag = false;
$("minimap").addEventListener("pointerdown", function (ev) {
  ev.stopPropagation();
  miniDrag = true;
  try {
    $("minimap").setPointerCapture(ev.pointerId);
  } catch (e) {
    /* capture is optional */
  }
  miniMoveTo(ev);
});
$("minimap").addEventListener("pointermove", function (ev) {
  if (miniDrag) miniMoveTo(ev);
});
$("minimap").addEventListener("pointerup", function () {
  miniDrag = false;
});
$("minimap").addEventListener("pointercancel", function () {
  miniDrag = false;
});
$("minimap").addEventListener("click", function (ev) {
  ev.stopPropagation();
});
$("minimap").addEventListener("keydown", function (ev) {
  var step = 60;
  var d = {
    ArrowLeft: [step, 0],
    ArrowRight: [-step, 0],
    ArrowUp: [0, step],
    ArrowDown: [0, -step],
  }[ev.key];
  if (!d) return;
  ev.preventDefault();
  ev.stopPropagation();
  panBy(d[0], d[1]);
});
