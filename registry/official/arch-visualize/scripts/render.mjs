// Stage 4: embed a checked model and its icons into the viewer template and write one self-contained,
// offline HTML file. Model text is data: it is escaped for the HTML data block and the viewer only ever
// shows it through textContent.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { capLines, isEntry, parseArgs, skillDir } from "./_lib.mjs";
import { checkModel } from "./model-check.mjs";

export const MARKER = "<!-- arch-visualize viewer v1 -->";

/** JSON that is safe inside <script type="application/json">: no "<", ">", "&" or line separators. */
export const safeJson = (value) =>
  JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(new RegExp(String.fromCharCode(0x2028), "g"), "\\u2028")
    .replace(new RegExp(String.fromCharCode(0x2029), "g"), "\\u2029");

/**
 * Read an icon SVG as { viewBox, paths }. Only the viewBox and the "d" of <path> elements are kept; an
 * icon with scripts, styles, links, event handlers or anything but svg/title/path is rejected.
 */
export function parseIcon(svg, name = "icon") {
  const bad =
    /<\s*(script|style|foreignObject|image|use|a|iframe|animate|set)\b|\son\w+\s*=|href\s*=|javascript:/i;
  if (bad.test(svg)) throw new Error(`${name}: unsafe SVG`);
  const tags = [...svg.matchAll(/<\s*\/?\s*([a-zA-Z][\w:-]*)/g)].map((m) => m[1].toLowerCase());
  if (tags.some((t) => !["svg", "title", "path"].includes(t)))
    throw new Error(`${name}: only svg, title and path are allowed`);
  const viewBox = /viewBox="([\d.\s-]+)"/.exec(svg)?.[1];
  const paths = [...svg.matchAll(/<path\b[^>]*?\sd="([^"]+)"/g)].map((m) => m[1]);
  if (!viewBox || paths.length === 0) throw new Error(`${name}: no viewBox or path`);
  return { viewBox, paths };
}

/** The icon for a technology: its brand logo, else the generic icon of its role. */
export function iconFor(tech, role, dir = path.join(skillDir(), "assets", "icons")) {
  const brand = path.join(dir, "brand", `${tech}.svg`);
  const file = existsSync(brand) ? brand : path.join(dir, "generic", `${role}.svg`);
  return parseIcon(readFileSync(file, "utf8"), path.basename(file));
}

/** Build the page for `model`. Throws with the list of problems when the model is invalid. */
export function renderPage(model) {
  const problems = checkModel(model);
  if (problems.length) throw Object.assign(new Error("model has problems"), { problems });
  const template = readFileSync(path.join(skillDir(), "assets", "viewer.html"), "utf8");
  const icons = {};
  for (const n of model.nodes) {
    const key = `${n.tech}|${n.role}`;
    icons[key] ??= iconFor(n.tech, n.role);
  }
  const sorted = Object.fromEntries(
    Object.keys(icons)
      .sort()
      .map((k) => [k, icons[k]]),
  );
  if (!template.includes("__MODEL_JSON__") || !template.includes("__ICONS_JSON__"))
    throw new Error("viewer.html is missing its data placeholders");
  return template
    .replace("__MODEL_JSON__", () => safeJson(model))
    .replace("__ICONS_JSON__", () => safeJson(sorted));
}

function run(argv) {
  const { flags } = parseArgs(argv, { strings: ["model", "out"], booleans: ["force"] });
  const modelFile = path.resolve(flags.model ?? "docs/architecture.json");
  const out = path.resolve(flags.out ?? "docs/architecture.html");
  let model;
  try {
    model = JSON.parse(readFileSync(modelFile, "utf8"));
  } catch (e) {
    console.error(`render: cannot read ${modelFile}: ${e.message}`);
    return 2;
  }
  if (existsSync(out) && !flags.force && !readFileSync(out, "utf8").includes(MARKER)) {
    console.error(
      `render: ${out} exists and is not an arch-visualize page. Use --out, or --force to replace it.`,
    );
    return 2;
  }
  let html;
  try {
    html = renderPage(model);
  } catch (e) {
    if (e.problems) {
      console.log(
        capLines(
          e.problems,
          `${e.problems.length} problem(s): fix them with model-check.mjs, then render again`,
        ),
      );
      return 1;
    }
    throw e;
  }
  mkdirSync(path.dirname(out), { recursive: true });
  writeFileSync(out, html);
  const rel = path.relative(process.cwd(), out) || out;
  console.log(
    `Wrote ${rel} (${Math.round(html.length / 1024)} KB, ${model.nodes.length} components, ${model.flows.length} flows).`,
  );
  console.log(`Open it in a browser: file://${out}`);
  return 0;
}

if (isEntry(import.meta.url)) {
  try {
    process.exitCode = run(process.argv.slice(2));
  } catch (e) {
    console.error(`render: ${e.message}`);
    process.exitCode = 2;
  }
}
