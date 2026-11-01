// ---- export: save the diagram as SVG or PNG, the model as JSON, or print it
var exportBtn = $("export"),
  exportMenu = $("export-menu"),
  exportStatus = $("export-status");
var ELEMENT = 1;

/** Copy the computed look of `live` and everything under it onto `clone`, then drop what is not drawn. */
function bakeStyles(live, clone, top) {
  var cs = getComputedStyle(live);
  var drop =
    cs.display === "none" ||
    cs.visibility === "hidden" ||
    (live.classList && live.classList.contains("hit"));
  if (drop) return false;
  // Only what differs from the parent: inherited properties (fill, stroke, fonts, direction) pass down in
  // the picture exactly as they do on the page, and the rest are skipped at their default value.
  var parentCs =
    !top && live.parentNode && live.parentNode.nodeType === ELEMENT
      ? getComputedStyle(live.parentNode)
      : null;
  var css = ArchExport.STYLE_PROPS.filter(function (p) {
    var v = cs.getPropertyValue(p);
    if (ArchExport.INHERITED[p]) return !parentCs || parentCs.getPropertyValue(p) !== v;
    return ArchExport.DEFAULTS[p] !== v;
  })
    .map(function (p) {
      return p + ":" + cs.getPropertyValue(p);
    })
    .join(";");
  if (css) clone.setAttribute("style", css);
  else clone.removeAttribute("style");
  [
    "tabindex",
    "role",
    "aria-pressed",
    "aria-label",
    "data-node",
    "data-edge",
    "data-group",
  ].forEach(function (a) {
    clone.removeAttribute(a);
  });
  if (clone.getAttribute("id") !== "arrow") clone.removeAttribute("id");
  var kids = Array.prototype.slice.call(live.children);
  var cloneKids = Array.prototype.slice.call(clone.children);
  kids.forEach(function (k, i) {
    if (k.nodeType !== ELEMENT) return;
    if (!bakeStyles(k, cloneKids[i], false)) clone.removeChild(cloneKids[i]);
  });
  return true;
}

/** The whole diagram as a standalone SVG file's text. `print` forces the light theme. */
function buildSvgText(print) {
  var root = document.documentElement;
  var prevTheme = root.getAttribute("data-theme");
  var prevLod = canvas.getAttribute("data-lod");
  var body = "",
    bg = "#ffffff",
    muted = "#55524b";
  if (print) root.setAttribute("data-theme", "light");
  canvas.setAttribute("data-lod", "near");
  try {
    var ser = new XMLSerializer();
    var parts = [];
    [defs, vp].forEach(function (live) {
      var clone = live.cloneNode(true);
      clone.removeAttribute("transform");
      if (live === vp) clone.removeAttribute("id");
      bakeStyles(live, clone, true); // the top of each part has no parent in the file, so it states everything
      parts.push(ser.serializeToString(clone));
    });
    body = parts.join("").replace(/ xmlns="http:\/\/www\.w3\.org\/2000\/svg"/g, "");
    var cs = getComputedStyle(root);
    bg = cs.getPropertyValue("--bg").trim() || bg;
    muted = cs.getPropertyValue("--muted").trim() || muted;
  } finally {
    if (prevTheme === null) root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", prevTheme);
    if (prevLod === null) canvas.removeAttribute("data-lod");
    else canvas.setAttribute("data-lod", prevLod);
  }
  return ArchExport.svgDocument({
    width: contentW,
    height: contentH,
    background: bg,
    footerColor: muted,
    title: model.project,
    note: t("export.note"),
    lang: I18N.lang,
    dir: I18N.dir,
    body: body,
  });
}

function say(text) {
  exportStatus.textContent = text;
}
function saveBlob(blob, name, note) {
  try {
    var url = URL.createObjectURL(blob);
    var a = h("a", { href: url, download: name });
    a.style.display = "none";
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 4000);
    say(note || t("export.saved", { name: name }));
  } catch (e) {
    say(t("export.failed"));
  }
}
function exportSvg() {
  var name = ArchExport.fileName(model.project, "svg");
  saveBlob(new Blob([buildSvgText(false)], { type: "image/svg+xml" }), name);
}
function exportJson() {
  var name = ArchExport.fileName(model.project, "json");
  saveBlob(new Blob([JSON.stringify(model, null, 2) + "\n"], { type: "application/json" }), name);
}
function exportPng(wanted) {
  try {
    var svg = buildSvgText(false);
    var w = contentW,
      hgt = contentH + ArchExport.FOOTER_H;
    var scale = ArchExport.scaleFor(w, hgt, wanted);
    var name = ArchExport.fileName(model.project, "png", wanted > 1 ? "@" + wanted + "x" : "");
    var img = new Image();
    img.onload = function () {
      try {
        var cv = document.createElement("canvas");
        cv.width = Math.round(w * scale);
        cv.height = Math.round(hgt * scale);
        cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
        cv.toBlob(function (blob) {
          if (!blob) return say(t("export.pngFailed"));
          saveBlob(
            blob,
            name,
            scale < wanted ? t("export.scaled", { name: name, scale: scale }) : null,
          );
        }, "image/png");
      } catch (e) {
        say(t("export.pngFailed"));
      }
    };
    img.onerror = function () {
      say(t("export.pngFailed"));
    };
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  } catch (e) {
    say(t("export.pngFailed"));
  }
}

// ---- print: the diagram on page one, the possible risks on page two
var printDiagram = $("print-diagram"),
  printRisks = $("print-risks");
function fillPrint() {
  clear(printDiagram);
  clear(printRisks);
  printDiagram.append(h("h1", {}, model.project));
  try {
    var doc = new DOMParser().parseFromString(buildSvgText(true), "image/svg+xml");
    printDiagram.append(document.importNode(doc.documentElement, true));
  } catch (e) {
    // the screen version is still there; only the printed picture is missing
  }
  // when the page was built with a diff, the list of changes comes first
  if (DIFF && !DIFF.empty)
    diffIntro().forEach(function (x) {
      printRisks.append(x);
    });
  var rs = model.risks || [];
  printRisks.append(h("h2", {}, t("print.risks")));
  if (!rs.length) printRisks.append(h("p", {}, t("print.none")));
  rs.forEach(function (r) {
    printRisks.append(riskCard(r, false));
  });
  printRisks.hidden = false;
}
function clearPrint() {
  clear(printDiagram);
  clear(printRisks);
}
window.addEventListener("beforeprint", fillPrint);
window.addEventListener("afterprint", clearPrint);

// ---- the menu
function closeExport(back) {
  exportMenu.hidden = true;
  exportBtn.setAttribute("aria-expanded", "false");
  if (back) exportBtn.focus();
}
function openExport() {
  exportMenu.hidden = false;
  exportBtn.setAttribute("aria-expanded", "true");
  exportMenu.querySelector("button").focus();
}
exportBtn.addEventListener("click", function () {
  if (exportMenu.hidden) openExport();
  else closeExport(false);
});
var ACTIONS = {
  svg: exportSvg,
  png1: function () {
    exportPng(1);
  },
  png2: function () {
    exportPng(2);
  },
  png3: function () {
    exportPng(3);
  },
  json: exportJson,
  print: function () {
    window.print();
  },
};
Array.prototype.forEach.call(exportMenu.querySelectorAll("button"), function (b) {
  b.addEventListener("click", function () {
    var run = ACTIONS[b.getAttribute("data-act")];
    closeExport(true);
    if (run) run();
  });
});
exportMenu.addEventListener("keydown", function (ev) {
  var items = Array.prototype.slice.call(exportMenu.querySelectorAll("button"));
  var at = items.indexOf(document.activeElement);
  if (ev.key === "Escape") {
    ev.preventDefault();
    ev.stopPropagation();
    closeExport(true);
  } else if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
    ev.preventDefault();
    var n = items.length;
    items[(at + (ev.key === "ArrowDown" ? 1 : n - 1)) % n].focus();
  } else if (ev.key === "Home" || ev.key === "End") {
    ev.preventDefault();
    items[ev.key === "Home" ? 0 : items.length - 1].focus();
  }
});
document.addEventListener("pointerdown", function (ev) {
  if (!exportMenu.hidden && !ev.target.closest(".export")) closeExport(false);
});
