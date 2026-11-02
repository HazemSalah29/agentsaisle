#!/usr/bin/env node
// Localizes a video project into a sibling folder (<project>.<lang>/): `plan` lists every translatable string
// in translate.json, the agent fills in the targets, `apply` checks them and writes the translated script.md and
// video.json (mirrored for right-to-left). Text and JSON only; no network, no process, nothing from the project runs.
// Usage: node localize.mjs plan  <project-dir> --to ar|en [--dialect msa|egyptian] [--force]
//        node localize.mjs apply <project-dir-or-localized-dir> [--dry-run]
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseScript } from "./_script-parse.mjs";
import { capLines, isEntry, parseArgs, skillDir } from "./_lib.mjs";

export const LANGS = ["ar", "en"];
export const DIALECTS = ["msa", "egyptian"];
/** Voice for each target. Arabic voices are described in Arabic (3arab VoiceDesign); TODO(verify) the dialect is honoured. */
export const VOICES = {
  ar: { msa: "صوت هادئ وواضح بلهجة فصحى", egyptian: "صوت هادئ وواضح بلهجة مصرية" },
  en: { provider: "kokoro" },
};
const DIGITS = /[0-9٠-٩۰-۹]/;
const ARABIC = /[؀-ۿ]/;
const DEFAULT_MAX = 120;
const RTL = new Set(["ar", "he", "fa", "ur"]);
export const dirOf = (lang) => (RTL.has(lang.slice(0, 2)) ? "rtl" : "ltr");

const readJson = (f) => JSON.parse(readFileSync(f, "utf8"));
const writeJson = (f, v) => writeFileSync(f, JSON.stringify(v, null, 2) + "\n");

/** Translatable text of a scene as [{ path, value, max }]; `path` is a list of keys into scene.props. */
export function sceneStrings(scene) {
  const p = scene.props ?? {};
  const out = [];
  const add = (pth, value, max = DEFAULT_MAX) => {
    if (typeof value === "string" && value.trim()) out.push({ path: pth, value, max });
  };
  switch (scene.kind) {
    case "title":
      add(["text"], p.text, 120);
      add(["subtitle"], p.subtitle, 200);
      break;
    case "quote":
      add(["text"], p.text, 300);
      add(["by"], p.by);
      add(["source"], p.source);
      break;
    case "list":
      add(["heading"], p.heading);
      (p.items ?? []).forEach((v, i) => add(["items", i], v, 120));
      break;
    case "chart":
      add(["title"], p.title);
      add(["unit"], p.unit, 40);
      (p.data ?? []).forEach((d, i) => add(["data", i, "label"], d?.label, 40));
      break;
    case "broll":
      add(["caption"], p.caption, 160);
      break;
    case "request-flow":
      add(["title"], p.title);
      (p.nodes ?? []).forEach((n, i) => add(["nodes", i, "label"], n?.label, 60));
      (p.steps ?? []).forEach((s, i) => add(["steps", i, "label"], s?.label, 120));
      break;
    case "screen":
    case "rate-limit":
    case "sequence": // the diagram source (labels in its text) is not extracted: edit it by hand
    case "code": // code is never translated, only the title
      add(["title"], p.title);
      break;
    default:
  }
  return out;
}

/** Every string to translate: script lines first, then scene props. */
export function collectItems(video, scriptText) {
  const items = [];
  for (const l of parseScript(scriptText).lines)
    items.push({ key: `line:${l.id}`, source: l.text, max: null, target: "" });
  for (const s of video.scenes ?? [])
    for (const t of sceneStrings(s))
      items.push({
        key: `scene:${s.id}:${t.path.join(".")}`,
        source: t.value,
        max: t.max,
        target: "",
      });
  return items;
}

/** Parses the small glossary format (brands list, terms with en/ar). */
export function parseGlossary(text) {
  const brands = [];
  const terms = [];
  let section = "";
  for (const raw of text.split(/\r?\n/)) {
    if (!raw.trim() || raw.trim().startsWith("#")) continue;
    if (/^brands:/.test(raw)) section = "brands";
    else if (/^terms:/.test(raw)) section = "terms";
    else if (section === "brands" && /^\s*-\s+/.test(raw))
      brands.push(raw.replace(/^\s*-\s+/, "").trim());
    else if (section === "terms") {
      const en = /^\s*-\s+en:\s*(.+)$/.exec(raw);
      const ar = /^\s+ar:\s*(.+)$/.exec(raw);
      if (en) terms.push({ en: en[1].trim(), ar: [] });
      else if (ar && terms.length)
        terms[terms.length - 1].ar = ar[1].split("|").map((s) => s.trim());
    }
  }
  return { brands, terms };
}

const tokens = (s) => (s.match(/\{[^}]*\}/g) ?? []).sort().join("|");

/** Problems in the translations (an empty list means they can be applied). */
export function translationProblems(doc, glossary = { brands: [], terms: [] }) {
  const out = [];
  const arabicTarget = doc.to === "ar";
  for (const it of doc.items ?? []) {
    const t = (it.target ?? "").trim();
    if (!t) {
      out.push(`${it.key}: no translation yet`);
      continue;
    }
    if (it.max && [...t].length > it.max)
      out.push(`${it.key}: ${[...t].length} characters, the limit is ${it.max}`);
    if (tokens(it.source) !== tokens(t))
      out.push(`${it.key}: placeholders {..} differ from the source`);
    if (arabicTarget) {
      if (DIGITS.test(t) && it.key.startsWith("line:"))
        out.push(`${it.key}: digits in an Arabic narration line; write numbers as words`);
      if (!ARABIC.test(t) && /[A-Za-z]{3}/.test(t) && !glossary.brands.some((b) => t.includes(b)))
        out.push(`${it.key}: no Arabic text`);
      for (const b of glossary.brands)
        if (it.source.includes(b) && !t.includes(b))
          out.push(`${it.key}: brand "${b}" must stay as written`);
      for (const term of glossary.terms)
        if (
          term.ar.length &&
          it.source.toLowerCase().includes(term.en.toLowerCase()) &&
          !term.ar.some((a) => t.includes(a))
        )
          out.push(`${it.key}: "${term.en}" should be translated as ${term.ar[0]}`);
    }
  }
  return out;
}

const setPath = (obj, pth, value) => {
  let o = obj;
  for (const k of pth.slice(0, -1)) o = o?.[k];
  if (o != null) o[pth[pth.length - 1]] = value;
};

/** The translated video: texts replaced, language and direction set, stale outputs dropped. */
export function localizeVideo(source, doc) {
  const video = JSON.parse(JSON.stringify(source));
  const byKey = new Map(doc.items.map((i) => [i.key, i.target.trim()]));
  for (const s of video.scenes ?? [])
    for (const t of sceneStrings(s)) {
      const v = byKey.get(`scene:${s.id}:${t.path.join(".")}`);
      if (v) setPath(s.props, t.path, v);
    }
  const toDir = dirOf(doc.to);
  video.meta.lang = doc.to;
  video.meta.dir = toDir;
  if (doc.to === "ar")
    video.voice = { provider: "3arab", voiceId: VOICES.ar[doc.dialect ?? "msa"] };
  else video.voice = { provider: VOICES.en.provider };
  delete video.captions; // captions.mjs writes them again from the new voice
  return video;
}

/** The translated script.md: every line's text replaced, attributes kept. */
export function localizeScript(scriptText, doc) {
  const byKey = new Map(doc.items.map((i) => [i.key, i.target.trim()]));
  return scriptText.replace(/^\[([a-z0-9-]{1,32})\]\s*(.*)$/gm, (all, id) =>
    byKey.has(`line:${id}`) ? `[${id}] ${byKey.get(`line:${id}`)}` : all,
  );
}

/** What the reviewer should know: a machine draft, and the things this tool cannot translate. */
export function reviewNotes(source, doc) {
  const lines = [
    `# Translation review (${doc.from} -> ${doc.to})`,
    "",
    "This translation is a machine-written draft. Have a native speaker read it before publishing.",
    doc.to === "ar"
      ? `Dialect: ${doc.dialect ?? "msa"}. Numbers in narration are spelled as words.`
      : "",
    "",
    "## Not translated, check by hand",
  ].filter((l, i) => l !== "" || i > 0);
  const hand = [];
  for (const s of source.scenes ?? []) {
    if (s.kind === "sequence")
      hand.push(`- scene "${s.id}": diagram labels in \`source\` (only the title was translated)`);
    if (s.kind === "screen")
      hand.push(
        `- scene "${s.id}": the recording may show ${doc.from} interface text baked into the video`,
      );
    if (s.kind === "code") hand.push(`- scene "${s.id}": code stays as written`);
    if (s.kind === "rate-limit" || s.kind === "request-flow")
      hand.push(`- scene "${s.id}": diagrams are drawn left to right in both languages`);
  }
  hand.push("- on-screen / visual attributes in script.md are copied as they were");
  return [...lines, ...hand, ""].join("\n");
}

function plan(dir, flags) {
  const to = flags.to;
  if (!LANGS.includes(to))
    throw new Error(
      `--to must be one of ${LANGS.join(", ")} (no voice exists for other languages yet)`,
    );
  const dialect = flags.dialect ?? "msa";
  if (!DIALECTS.includes(dialect))
    throw new Error(`--dialect must be one of ${DIALECTS.join(", ")}`);
  const src = path.resolve(dir);
  const video = readJson(path.join(src, "video.json"));
  const from = video.meta?.lang ?? "en";
  if (from.slice(0, 2) === to) throw new Error(`The project is already in "${from}".`);
  const scriptText = readFileSync(path.join(src, video.script ?? "script.md"), "utf8");
  const dest = `${src}.${to}`;
  if (existsSync(dest) && !flags.force)
    throw new Error(
      `${path.basename(dest)} already exists; use --force to replace its translate.json`,
    );
  mkdirSync(dest, { recursive: true });
  for (const d of ["assets", "brand", "characters"])
    if (existsSync(path.join(src, d)))
      cpSync(path.join(src, d), path.join(dest, d), { recursive: true });
  writeFileSync(path.join(dest, "source.video.json"), JSON.stringify(video, null, 2) + "\n");
  writeFileSync(path.join(dest, "source.script.md"), scriptText);
  const items = collectItems(video, scriptText);
  writeJson(path.join(dest, "translate.json"), {
    version: 1,
    from: from.slice(0, 2),
    to,
    dialect,
    items,
  });
  return { dest, count: items.length };
}

function apply(dir, flags) {
  const dest = path.resolve(dir);
  const doc = readJson(path.join(dest, "translate.json"));
  const gloss = path.join(dest, "glossary.ar.yaml");
  const glossary = parseGlossary(
    readFileSync(
      existsSync(gloss) ? gloss : path.join(skillDir(), "assets", "glossary.ar.yaml"),
      "utf8",
    ),
  );
  const problems = translationProblems(doc, glossary);
  if (problems.length) return { problems };
  const source = readJson(path.join(dest, "source.video.json"));
  const scriptText = readFileSync(path.join(dest, "source.script.md"), "utf8");
  const video = localizeVideo(source, doc);
  if (!flags["dry-run"]) {
    writeJson(path.join(dest, "video.json"), video);
    writeFileSync(path.join(dest, source.script ?? "script.md"), localizeScript(scriptText, doc));
    writeFileSync(path.join(dest, "translation-review.md"), reviewNotes(source, doc));
  }
  return { problems: [], video, count: doc.items.length };
}

function main() {
  const { flags, positional } = parseArgs(process.argv.slice(2), {
    booleans: ["force", "dry-run", "lipsync"],
    strings: ["to", "dialect", "keep-voice"],
  });
  const [cmd, dir] = positional;
  try {
    if (flags.lipsync) throw new Error("--lipsync is not built yet. Lip sync is not available.");
    if (flags["keep-voice"])
      throw new Error(
        "--keep-voice is not supported: this library does not clone voices. The dub uses a stock voice (video-voice).",
      );
    if (!dir || !["plan", "apply"].includes(cmd))
      throw new Error("usage: localize.mjs plan|apply <project-dir> [--to ar|en]");
    if (cmd === "plan") {
      const r = plan(dir, flags);
      console.log(
        `ok: ${r.count} string(s) to translate in ${path.basename(r.dest)}/translate.json\nNext: fill each "target", then run: node localize.mjs apply ${r.dest}`,
      );
    } else {
      const r = apply(dir, flags);
      if (r.problems.length) {
        console.log(
          capLines(r.problems, `${r.problems.length} problem(s); fix translate.json and run again`),
        );
        process.exit(1);
      }
      console.log(
        `ok: ${r.count} string(s) applied${flags["dry-run"] ? " (dry run, nothing written)" : ""}\nNext: voice.mjs, align.mjs, timing.mjs, captions.mjs, check, render, qa in the new folder. Read translation-review.md.`,
      );
    }
  } catch (e) {
    console.error(e.message);
    process.exit(2);
  }
}
if (isEntry(import.meta.url)) main();
