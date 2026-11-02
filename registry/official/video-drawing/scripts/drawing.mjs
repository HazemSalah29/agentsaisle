#!/usr/bin/env node
// Turns a child's DRAWING (never a photo) into a puppet rig. `import` copies the drawing into a private folder,
// traces it into flat colour regions with OpenCV (trace.py) and writes a numbered sheet to look at; the parent
// (or the agent, looking at the sheet) says in marks.json which regions are the head, body, arms and legs; `rig`
// cuts those traced shapes into puppet.json parts and draws the eyes and mouths; `forget` deletes the original
// and everything traced from it. No network. The drawing is never named in video.json or any credits file.
// Usage: node drawing.mjs import|rig|forget|status <project-dir> --character <name> [--image file --parent-ok] [--force] [--yes]
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
  copyFileSync,
  openSync,
  readSync,
  closeSync,
} from "node:fs";
import path from "node:path";
import { bibleProblems, loadBible } from "./bible-check.mjs";
import { capLines, isEntry, parseArgs, skillDir } from "./_lib.mjs";
import { REQUIRED, VISEMES, rigProblems } from "./_rig.mjs";
import { run } from "./run.mjs";

const NAME = /^[a-z][a-z0-9-]{0,31}$/;
const HEX = /^#[0-9a-fA-F]{6}$/;
const MAX_BYTES = 10 * 1024 * 1024;
const BOX = { w: 300, h: 400 };
const LIMB_PARTS = ["arm-l", "arm-r", "leg-l", "leg-r"];
const ID = /^[a-z][a-z0-9-]{0,23}$/;
const num = (v) => typeof v === "number" && Number.isFinite(v);
const r1 = (n) => Math.round(n * 10) / 10;

/** Problems with trace.json (written by trace.py, but read as untrusted data). */
export function traceProblems(t) {
  const out = [];
  if (!t || typeof t !== "object" || !num(t.aspect) || t.aspect <= 0 || t.aspect > 20)
    return ["trace.json: aspect must be a positive number"];
  if (!Array.isArray(t.regions) || !t.regions.length || t.regions.length > 24)
    return ["trace.json: regions must be a list of 1 to 24"];
  if (t.paper !== undefined && !HEX.test(t.paper)) out.push("trace.json: paper must be #hex");
  const ids = new Set();
  for (const r of t.regions) {
    if (!r || !/^r\d{1,2}$/.test(r.id ?? "") || ids.has(r.id)) {
      out.push("trace.json: a region has a bad or repeated id");
      continue;
    }
    ids.add(r.id);
    if (!HEX.test(r.color ?? "")) out.push(`trace.json: ${r.id}.color must be #hex`);
    const ok =
      Array.isArray(r.polygon) &&
      r.polygon.length >= 3 &&
      r.polygon.length <= 60 &&
      r.polygon.every(
        (p) => Array.isArray(p) && p.length === 2 && p.every((n) => num(n) && n >= 0 && n <= 1),
      );
    if (!ok) out.push(`trace.json: ${r.id}.polygon must be 3 to 60 points between 0 and 1`);
    if (!Array.isArray(r.bbox) || r.bbox.length !== 4 || !r.bbox.every(num))
      out.push(`trace.json: ${r.id}.bbox must be four numbers`);
  }
  return out;
}

const center = (r) => [r.bbox[0] + r.bbox[2] / 2, r.bbox[1] + r.bbox[3] / 2];

/** A first guess at the marks from where the regions sit; the parent checks it against the sheet. Pure. */
export function guessMarks(trace) {
  const rs = [...trace.regions];
  const body = rs[0];
  const rest = rs.slice(1);
  const parts = { body: [body.id] };
  const [bx, by] = center(body);
  const head = [...rest].sort((a, b) => center(a)[1] - center(b)[1])[0];
  let face = { x: 0.5, y: 0.2, size: 0.3 };
  if (head) {
    parts.head = [head.id];
    face = {
      x: r1(center(head)[0] * 100) / 100,
      y: r1((head.bbox[1] + head.bbox[3] * 0.45) * 100) / 100,
      size: Math.min(0.9, Math.round(head.bbox[2] * 80) / 100),
    };
  }
  for (const r of rest) {
    if (r === head) continue;
    const [cx, cy] = center(r);
    const key =
      cy > by + 0.15 && cy > 0.65 ? (cx < bx ? "leg-l" : "leg-r") : cx < bx ? "arm-l" : "arm-r";
    if (!parts[key]) parts[key] = [r.id];
  }
  return {
    note: "A guess. Open trace-sheet.svg, then fix which region ids are which. Leave a part out if the drawing has none.",
    parts,
    extras: [],
    face,
  };
}

/** Problems with marks.json against a trace. */
export function marksProblems(marks, trace) {
  const out = [];
  if (!marks || typeof marks !== "object" || Array.isArray(marks))
    return ["marks.json must be an object"];
  const ids = new Set(trace.regions.map((r) => r.id));
  const seen = new Set();
  const check = (where, list) => {
    if (!Array.isArray(list) || !list.length) return out.push(`${where}: a list of region ids`);
    for (const id of list) {
      if (!ids.has(id)) out.push(`${where}: "${id}" is not a traced region`);
      else if (seen.has(id)) out.push(`${where}: "${id}" is used twice`);
      seen.add(id);
    }
  };
  const parts = marks.parts ?? {};
  for (const [k, v] of Object.entries(parts)) {
    if (k !== "body" && k !== "head" && !LIMB_PARTS.includes(k))
      out.push(`parts.${k}: use body, head, arm-l, arm-r, leg-l or leg-r (others go in extras)`);
    else check(`parts.${k}`, v);
  }
  if (!parts.body) out.push("parts.body: mark the region that is the body");
  if (!parts.head) out.push("parts.head: mark the region that is the head");
  const extras = marks.extras ?? [];
  if (!Array.isArray(extras) || extras.length > 12) out.push("extras: a list of at most 12");
  else
    extras.forEach((e, i) => {
      if (!ID.test(e?.id ?? "") || REQUIRED.includes(e.id) || e.id === "brows")
        out.push(`extras[${i}].id: a new lower-case name`);
      if (!["body", "head"].includes(e?.parent)) out.push(`extras[${i}].parent: body or head`);
      check(`extras[${i}].regions`, e?.regions);
    });
  const f = marks.face;
  if (
    !f ||
    !num(f.x) ||
    !num(f.y) ||
    !num(f.size) ||
    f.x < 0 ||
    f.x > 1 ||
    f.y < 0 ||
    f.y > 1 ||
    f.size < 0.05 ||
    f.size > 1
  )
    out.push(
      "face: {x, y, size} between 0 and 1 (size at least 0.05): where the eyes and mouth go and how wide the face is",
    );
  return out;
}

/** The drawing placed in the 300x400 box, feet at the bottom. Returns mapping functions. */
function placement(aspect) {
  const W = Math.min(260, 360 * aspect);
  const H = W / aspect;
  const ox = (BOX.w - W) / 2;
  const oy = BOX.h - 8 - H;
  return {
    W,
    H,
    pt: ([u, v]) => [r1(ox + u * W), r1(oy + v * H)],
    px: (u) => r1(ox + u * W),
    py: (v) => r1(oy + v * H),
  };
}

const polyFor = (regions, pt) =>
  regions
    .map(
      (r) =>
        `<polygon points="${r.polygon.map((p) => pt(p).join(",")).join(" ")}" fill="${r.color}"/>`,
    )
    .join("");
const bboxOf = (regions) => {
  const x0 = Math.min(...regions.map((r) => r.bbox[0]));
  const y0 = Math.min(...regions.map((r) => r.bbox[1]));
  const x1 = Math.max(...regions.map((r) => r.bbox[0] + r.bbox[2]));
  const y1 = Math.max(...regions.map((r) => r.bbox[1] + r.bbox[3]));
  return { x0, y0, x1, y1 };
};
const clampPivot = ([x, y]) => [Math.min(BOX.w, Math.max(0, x)), Math.min(BOX.h, Math.max(0, y))];

/** The rig and notes for a trace and its marks. Pure. */
export function buildRig(trace, marks, name, palette) {
  const byId = new Map(trace.regions.map((r) => [r.id, r]));
  const get = (ids) => ids.map((i) => byId.get(i));
  const pl = placement(trace.aspect);
  const notes = [];
  const parts = [];
  const add = (id, parent, pivot, svg) => parts.push({ id, parent, pivot: clampPivot(pivot), svg });
  const pivotFor = (rs, how) => {
    const b = bboxOf(rs);
    const cx = (b.x0 + b.x1) / 2;
    const at = how === "top" ? [cx, b.y0] : how === "bottom" ? [cx, b.y1] : [cx, (b.y0 + b.y1) / 2];
    return [pl.px(at[0]), pl.py(at[1])];
  };
  const bodyRs = get(marks.parts.body);
  add("body", null, pivotFor(bodyRs, "center"), polyFor(bodyRs, pl.pt));
  for (const key of ["leg-l", "leg-r", "arm-l", "arm-r"]) {
    const ids = marks.parts[key];
    if (!ids) {
      notes.push(`${key}: not marked, so it is an invisible placeholder (nothing was invented)`);
      add(
        key,
        "body",
        [BOX.w / 2, BOX.h / 2],
        `<circle cx="150" cy="200" r="1" opacity="0" fill="#000000"/>`,
      );
      continue;
    }
    const rs = get(ids);
    add(key, "body", pivotFor(rs, "top"), polyFor(rs, pl.pt));
  }
  const headRs = get(marks.parts.head);
  add("head", "body", pivotFor(headRs, "bottom"), polyFor(headRs, pl.pt));
  for (const e of marks.extras ?? []) {
    const rs = get(e.regions);
    add(e.id, e.parent, pivotFor(rs, "center"), polyFor(rs, pl.pt));
  }
  // Face: drawn flat in the darkest palette colour, at the marked place.
  const ink = [...palette].sort((a, b) => lum(a) - lum(b))[0];
  const fw = marks.face.size * pl.W;
  const [fx, fy] = [pl.px(marks.face.x), pl.py(marks.face.y)];
  const ex = r1(fw * 0.24);
  const er = r1(Math.max(3, fw * 0.1));
  const ey = r1(fy - fw * 0.08);
  const my = r1(fy + fw * 0.2);
  const pivot = [fx, fy];
  const line = (w) =>
    `fill="none" stroke="${ink}" stroke-width="${r1(Math.max(2, w))}" stroke-linecap="round"`;
  add(
    "eyes-open",
    "head",
    pivot,
    `<circle cx="${r1(fx - ex)}" cy="${ey}" r="${er}" fill="#ffffff"/><circle cx="${r1(fx + ex)}" cy="${ey}" r="${er}" fill="#ffffff"/><circle cx="${r1(fx - ex)}" cy="${ey}" r="${r1(er * 0.5)}" fill="${ink}"/><circle cx="${r1(fx + ex)}" cy="${ey}" r="${r1(er * 0.5)}" fill="${ink}"/>`,
  );
  add(
    "eyes-closed",
    "head",
    pivot,
    `<path d="M${r1(fx - ex - er)} ${ey} Q${r1(fx - ex)} ${r1(ey - er)} ${r1(fx - ex + er)} ${ey}" ${line(er * 0.4)}/><path d="M${r1(fx + ex - er)} ${ey} Q${r1(fx + ex)} ${r1(ey - er)} ${r1(fx + ex + er)} ${ey}" ${line(er * 0.4)}/>`,
  );
  const mw = fw * 0.22;
  const mouth = {
    rest: `<path d="M${r1(fx - mw)} ${my} Q${fx} ${r1(my + mw * 0.5)} ${r1(fx + mw)} ${my}" ${line(er * 0.45)}/>`,
    a: `<ellipse cx="${fx}" cy="${my}" rx="${r1(mw * 0.8)}" ry="${r1(mw * 0.9)}" fill="${ink}"/>`,
    e: `<ellipse cx="${fx}" cy="${my}" rx="${r1(mw * 1.1)}" ry="${r1(mw * 0.4)}" fill="${ink}"/>`,
    o: `<ellipse cx="${fx}" cy="${my}" rx="${r1(mw * 0.5)}" ry="${r1(mw * 0.7)}" fill="${ink}"/>`,
    u: `<ellipse cx="${fx}" cy="${my}" rx="${r1(mw * 0.35)}" ry="${r1(mw * 0.4)}" fill="${ink}"/>`,
    mbp: `<line x1="${r1(fx - mw)}" y1="${my}" x2="${r1(fx + mw)}" y2="${my}" ${line(er * 0.55)}/>`,
    fv: `<path d="M${r1(fx - mw)} ${r1(my - mw * 0.3)} L${r1(fx + mw)} ${r1(my - mw * 0.3)} L${r1(fx + mw * 0.7)} ${r1(my + mw * 0.4)} Q${fx} ${r1(my + mw * 0.7)} ${r1(fx - mw * 0.7)} ${r1(my + mw * 0.4)} Z" fill="${ink}"/><rect x="${r1(fx - mw * 0.6)}" y="${r1(my - mw * 0.3)}" width="${r1(mw * 1.2)}" height="${r1(mw * 0.3)}" fill="#ffffff"/>`,
    l: `<ellipse cx="${fx}" cy="${my}" rx="${r1(mw * 0.9)}" ry="${r1(mw * 0.6)}" fill="${ink}"/>`,
  };
  for (const v of VISEMES) add(`mouth-${v}`, "head", pivot, mouth[v]);
  const used = new Set([
    ...Object.values(marks.parts).flat(),
    ...(marks.extras ?? []).flatMap((e) => e.regions),
  ]);
  const unmarked = trace.regions.filter((r) => !used.has(r.id));
  if (unmarked.length)
    notes.push(
      `${unmarked.length} traced region(s) are not used: ${unmarked.map((r) => r.id).join(", ")}`,
    );
  return { rig: { name, box: { ...BOX }, palette, parts }, notes };
}

const lum = (hex) => {
  const v = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = v.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** 3 to 5 palette colours for the bible: the drawing's colours, padded with paper and a dark ink if too few. */
export function bibleColours(trace) {
  const c = [];
  for (const x of [...trace.regions.map((r) => r.color), trace.paper, "#2b2230", "#ffffff"]) {
    const h = String(x ?? "").toLowerCase();
    if (HEX.test(h) && !c.includes(h)) c.push(h);
  }
  return c.slice(0, 5);
}

/** A look-at sheet: the traced shapes in their colours with their ids. */
export function traceSheet(trace) {
  const W = 600;
  const H = Math.round(W / trace.aspect);
  const shapes = trace.regions
    .map(
      (r) =>
        `<polygon points="${r.polygon.map(([x, y]) => `${(x * W).toFixed(1)},${(y * H).toFixed(1)}`).join(" ")}" fill="${r.color}" fill-opacity="0.85" stroke="#000000" stroke-width="1"/>`,
    )
    .join("");
  const labels = trace.regions
    .map(
      (r) =>
        `<text x="${((r.bbox[0] + r.bbox[2] / 2) * W).toFixed(1)}" y="${((r.bbox[1] + r.bbox[3] / 2) * H).toFixed(1)}" font-family="sans-serif" font-size="22" font-weight="bold" text-anchor="middle" fill="#ffffff" stroke="#000000" stroke-width="3" paint-order="stroke">${r.id}</text>`,
    )
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-20 -20 ${W + 40} ${H + 40}" width="${W + 40}" height="${H + 40}"><rect x="-20" y="-20" width="${W + 40}" height="${H + 40}" fill="${HEX.test(trace.paper ?? "") ? trace.paper : "#ffffff"}"/>${shapes}${labels}</svg>\n`;
}

const template = (name, colours) => `# ${name}

- Name: ${name}
- Species: TODO
- Shape language: TODO
- Palette: ${colours.join(", ")}
- Outfits: TODO
- Catchphrase: TODO
- Personality: TODO
- Learning goal: TODO

## Never

- Never shouts at or teases anyone.
- Never takes something without asking.
`;

function readHead(file) {
  const fd = openSync(file, "r");
  try {
    const b = Buffer.alloc(8);
    readSync(fd, b, 0, 8, 0);
    return b;
  } finally {
    closeSync(fd);
  }
}

function main() {
  const { flags, positional } = parseArgs(process.argv.slice(2), {
    strings: ["character", "image"],
    booleans: ["force", "yes", "parent-ok"],
  });
  const [cmd, projectArg] = positional;
  const fail = (m, code = 1) => {
    console.error(m);
    process.exit(code);
  };
  const name = flags.character;
  if (!["import", "rig", "forget", "status"].includes(cmd) || !name)
    fail(
      "Usage: node drawing.mjs import|rig|forget|status <project-dir> --character <name> [--image file --parent-ok] [--force] [--yes]",
      2,
    );
  if (!NAME.test(name)) fail("--character: lower-case letters, digits and hyphens", 2);
  const dir = path.resolve(projectArg ?? ".");
  const folder = path.join(dir, "characters", name);
  const priv = path.join(folder, "private");
  const traceFile = path.join(priv, "trace.json");
  const marksFile = path.join(priv, "marks.json");

  if (cmd === "status") {
    console.log(
      existsSync(priv)
        ? `characters/${name}/private exists (original, trace and marks). Run forget --yes to delete it.`
        : `characters/${name}: no private drawing data.`,
    );
    return;
  }
  if (cmd === "forget") {
    if (!flags.yes)
      fail("This deletes the drawing and everything traced from it. Run again with --yes.", 2);
    if (existsSync(priv) && lstatSync(priv).isSymbolicLink())
      fail("private is a link; refusing to delete through it.");
    rmSync(priv, { recursive: true, force: true });
    console.log(
      `Deleted characters/${name}/private. Kept: puppet.json and bible.md (vector shapes and text only).`,
    );
    return;
  }
  if (cmd === "import") {
    if (!flags["parent-ok"])
      fail(
        "A parent or guardian must confirm that this is a DRAWING made by the child (not a photo of a child). Run again with --parent-ok after asking.",
        2,
      );
    const img = flags.image;
    if (!img || /^[a-z][a-z0-9+.-]*:\/\//i.test(img) || img.startsWith("-"))
      fail("--image: a PNG or JPEG file on this computer", 2);
    if (!/\.(png|jpe?g)$/i.test(img)) fail("Only .png, .jpg and .jpeg drawings are read.", 2);
    if (!existsSync(img)) fail(`${img} does not exist.`, 2);
    const st = lstatSync(img);
    if (st.isSymbolicLink() || !st.isFile()) fail("--image must be a plain file, not a link.", 2);
    if (st.size > MAX_BYTES) fail("The drawing is larger than 10 MB; save a smaller copy.", 2);
    const head = readHead(img);
    if (!(
      head.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])) ||
      head.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))
    ))
      fail("The file is not really a PNG or JPEG.", 2);
    if (existsSync(traceFile) && !flags.force)
      fail(`characters/${name}/private already holds a drawing; use --force to replace it.`);
    mkdirSync(priv, { recursive: true });
    writeFileSync(path.join(priv, ".gitignore"), "*\n");
    const copy = path.join(
      priv,
      `original${path.extname(img).toLowerCase().replace("jpeg", "jpg")}`,
    );
    copyFileSync(img, copy);
    const r = run("python", [path.join(skillDir(), "scripts", "trace.py"), copy, traceFile], {
      timeoutMs: 120_000,
    });
    if (r.status !== 0) {
      rmSync(priv, { recursive: true, force: true }); // a refused picture is not kept
      fail(
        `${String(r.stderr).trim().slice(0, 300) || "The drawing could not be traced."}${r.status === 4 ? " (Nothing was kept.)" : ""}`,
        r.status === 4 ? 4 : 1,
      );
    }
    const trace = JSON.parse(readFileSync(traceFile, "utf8"));
    const bad = traceProblems(trace);
    if (bad.length) fail(`The trace is not usable: ${bad[0]}`);
    writeFileSync(path.join(priv, "trace-sheet.svg"), traceSheet(trace));
    writeFileSync(marksFile, `${JSON.stringify(guessMarks(trace), null, 2)}\n`);
    if (!existsSync(path.join(folder, "bible.md")))
      writeFileSync(
        path.join(folder, "bible.md"),
        template(name[0].toUpperCase() + name.slice(1), bibleColours(trace)),
      );
    console.log(
      capLines(
        [
          `Traced ${trace.regions.length} regions into characters/${name}/private/trace-sheet.svg (open it in a browser).`,
          `Check private/marks.json against the sheet: which region ids are the head, body, arms and legs, and where the face is.`,
          `Fill the TODO lines in characters/${name}/bible.md with the child (species, shape, outfit, catchphrase, learning goal).`,
        ],
        `Next: node drawing.mjs rig ${projectArg ?? "."} --character ${name}`,
      ),
    );
    return;
  }
  // rig
  if (!existsSync(traceFile) || !existsSync(marksFile))
    fail(`Run import first (characters/${name}/private/trace.json and marks.json are missing).`);
  const rigFile = path.join(folder, "puppet.json");
  if (existsSync(rigFile) && !flags.force)
    fail(`characters/${name}/puppet.json already exists; it is never overwritten without --force.`);
  let trace;
  let marks;
  try {
    trace = JSON.parse(readFileSync(traceFile, "utf8"));
    marks = JSON.parse(readFileSync(marksFile, "utf8"));
  } catch {
    fail("trace.json or marks.json is not valid JSON.");
  }
  const tb = traceProblems(trace);
  if (tb.length) fail(`trace.json: ${tb[0]}`);
  const mb = marksProblems(marks, trace);
  if (mb.length) fail(`marks.json: ${mb.slice(0, 4).join("; ")}`);
  const found = loadBible(dir, name);
  if (!found) fail(`characters/${name}/bible.md is missing.`);
  const todo = found.text.split(/\r?\n/).find((l) => /:\s*TODO\b/.test(l));
  if (todo) fail(`The bible still has a TODO: "${todo.trim()}". Fill it in with the child first.`);
  const bp = bibleProblems(found.bible, name, found.text);
  if (bp.length) fail(`The bible is not ready: ${bp[0]} (run video-kids bible-check).`);
  const { rig, notes } = buildRig(trace, marks, name, found.bible.colours);
  const problems = rigProblems(rig);
  if (problems.length) fail(`The rig failed its check: ${problems[0]}`);
  writeFileSync(rigFile, `${JSON.stringify(rig, null, 2)}\n`);
  console.log(
    capLines(
      [`Wrote characters/${name}/puppet.json (${rig.parts.length} parts).`, ...notes],
      `Next: video-kids puppet.mjs sheet ${projectArg ?? "."} --character ${name}, then /video kids. To delete the drawing: node drawing.mjs forget ${projectArg ?? "."} --character ${name} --yes`,
    ),
  );
}

if (isEntry(import.meta.url)) main();
