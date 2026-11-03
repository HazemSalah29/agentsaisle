#!/usr/bin/env node
// Turns a Markdown document (a README, a spec, notes) into a draft explainer project: video.json, script.md and
// facts.md. Every spoken line is a sentence or bullet taken from the document, and every fact cites its file and
// line. Tables with a number column become bar charts whose title names the source line. Nothing is invented.
// PDFs are not read (no PDF parser is installed): export the text or Markdown first.
// Usage: node doc.mjs --doc README.md --out projects/<slug> [--max-sections 5] [--format short-9x16]
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { capLines, isEntry, parseArgs } from "./_lib.mjs";

const MAX_BYTES = 1024 * 1024;
const MAX_ITEM = 70; // whole sentences or bullets only: a longer one is skipped, never cut
const FORMATS = ["reel-9x16", "short-9x16", "youtube-16x9", "square-1x1"];
const UNSAFE = new RegExp("[\\p{Cc}\\u200e\\u200f\\u202a-\\u202e\\u2066-\\u2069]", "gu");
const plain = (t, max) =>
  String(t ?? "")
    .replace(UNSAFE, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[`*_~]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
const stop = (t) => (/[.!?]$/.test(t) ? t : `${t.replace(/[:;,\s]+$/, "")}.`);
/** A line that is only links and separators (a contents list or a nav bar): not narration. */
const linkOnly = (raw) =>
  /\]\(/.test(raw) &&
  !/[\p{L}\p{N}]/u.test(
    raw.replace(/!?\[[^\]]*\]\([^)]*\)/g, "").replace(/^\s*(?:[-*]|\d+\.)\s+/, ""),
  );
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/** Sections of a Markdown text: { title, sections: [{ heading, line, bullets: [{text,line}], tables: [] }] }. Pure. */
export function parseDoc(text) {
  const rows = String(text).replace(/\r\n?/g, "\n").split("\n");
  let title = "";
  const sections = [];
  let cur = null;
  let fence = false;
  let para = [];
  const flush = () => {
    if (para.length && cur) {
      const joined = plain(para.map((p) => p.text).join(" "), 600);
      joined
        .split(/(?<=[.!?])\s+/)
        .filter((s) => s.length >= 12 && s.length <= MAX_ITEM)
        .forEach((s) => cur.sentences.push({ text: s, line: para[0].line }));
    }
    para = [];
  };
  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i];
    const n = i + 1;
    if (/^\s*(```|~~~)/.test(raw)) {
      flush();
      fence = !fence;
      continue;
    }
    if (fence) continue;
    const h = /^(#{1,3})\s+(.*\S)/.exec(raw);
    if (h) {
      flush();
      if (h[1].length === 1 && !title) title = plain(h[2], 80);
      else {
        cur = { heading: plain(h[2], 60), line: n, bullets: [], sentences: [], tables: [] };
        sections.push(cur);
      }
      continue;
    }
    if (!cur) {
      if (!sections.length && /\S/.test(raw) && !title) title = plain(raw, 80);
      if (!h && /\S/.test(raw) && !/^[|\-*>\s]/.test(raw)) {
        cur = { heading: title || "Overview", line: n, bullets: [], sentences: [], tables: [] };
        sections.push(cur);
        para.push({ text: raw, line: n });
      }
      continue;
    }
    const b = /^\s*(?:[-*]|\d+\.)\s+(.*\S)/.exec(raw);
    if (linkOnly(raw)) {
      flush();
      continue;
    }
    if (b) {
      flush();
      const t = plain(b[1], 400);
      if (t.length >= 4 && t.length <= MAX_ITEM) cur.bullets.push({ text: t, line: n });
      continue;
    }
    if (/^\s*\|.*\|\s*$/.test(raw)) {
      flush();
      const cells = raw
        .trim()
        .replace(/^\||\|$/g, "")
        .split("|")
        .map((c) => plain(c, 40));
      let t = cur.tables.at(-1);
      if (!t || t.end !== n - 1) cur.tables.push((t = { line: n, rows: [], end: n }));
      t.end = n;
      if (!cells.every((c) => /^:?-{2,}:?$/.test(c.replace(/\s/g, "")))) t.rows.push(cells);
      continue;
    }
    if (!/\S/.test(raw)) flush();
    else para.push({ text: raw, line: n });
  }
  flush();
  return { title: title || "Untitled", sections };
}

/** A bar chart from a table of label and number columns, or null. */
function tableChart(t, heading) {
  if (t.rows.length < 3 || t.rows.length > 9 || t.rows[0].length < 2) return null;
  const data = t.rows
    .slice(1)
    .map((r) => ({ label: r[0].slice(0, 16), value: Number(r[1].replace(/[,\s%]/g, "")) }));
  if (data.some((d) => !d.label || !Number.isFinite(d.value))) return null;
  return {
    type: "bar",
    title: `${heading} (line ${t.line})`.slice(0, 80),
    data,
    unit: r1Unit(t.rows[1][1]),
  };
}
const r1Unit = (cell) => (/%\s*$/.test(cell) ? "%" : "");

/** The project files. Pure. */
export function buildDoc(doc, { file, maxSections = 5, format = "short-9x16" }) {
  const lines = [];
  const facts = [];
  const scenes = [];
  const fact = (text, line) => {
    facts.push({ id: `f${facts.length + 1}`, text, source: `${file}:${line}` });
    return `f${facts.length}`;
  };
  const line = (text, beat, factId) => {
    lines.push({ id: `l${lines.length + 1}`, text, beat, fact: factId });
    return `l${lines.length}`;
  };
  const use = doc.sections
    .filter((s) => s.bullets.length || s.sentences.length || s.tables.length)
    .slice(0, maxSections);
  if (!use.length)
    throw new Error("No sections with text, bullets or tables were found in the document.");
  scenes.push({
    id: "s1",
    kind: "title",
    props: { text: doc.title, subtitle: "from the document" },
    narration: [line(`This is ${doc.title}, in a minute.`, "hook")],
  });
  for (const sec of use) {
    const items = (
      sec.bullets.length ? sec.bullets : sec.sentences.map((s) => ({ text: s.text, line: s.line }))
    ).slice(0, 3);
    if (items.length >= 1) {
      const ids = items.map((it) => line(stop(it.text), "step", fact(stop(it.text), it.line)));
      scenes.push({
        id: `s${scenes.length + 1}`,
        kind: "list",
        props: { heading: sec.heading, items: items.map((i) => i.text) },
        narration: ids,
      });
    }
    const chart = sec.tables.map((t) => tableChart(t, sec.heading)).find(Boolean);
    if (chart) {
      const t = sec.tables.find((x) => chart.title.endsWith(`(line ${x.line})`));
      const f = fact(
        `${sec.heading}: ${chart.data.map((d) => `${d.label} ${d.value}${chart.unit}`).join(", ")}.`,
        t.line,
      );
      scenes.push({
        id: `s${scenes.length + 1}`,
        kind: "chart",
        props: chart,
        narration: [
          line(`The table in ${sec.heading} compares ${chart.data.length} values.`, "step", f),
        ],
      });
    }
  }
  scenes.push({
    id: `s${scenes.length + 1}`,
    kind: "title",
    props: { text: doc.title, subtitle: `every line is from ${file}` },
    narration: [line(`Every line here comes from ${path.basename(file)}.`, "button")],
  });
  const video = {
    version: 1,
    meta: {
      title: doc.title,
      type: "explainer",
      format,
      fps: 30,
      lang: "en",
      audience: "people who read this document",
    },
    script: "script.md",
    scenes,
  };
  const script = `# ${doc.title}\n\n${lines.map((l) => `[${l.id}] ${l.text}\n  beat: ${l.beat}${l.fact ? `\n  fact: ${l.fact}` : ""}\n`).join("\n")}`;
  const factsMd = `# Facts\n\n${facts.map((f) => `- [${f.id}] ${f.text} Source: ${f.source}`).join("\n")}\n`;
  return {
    video,
    script,
    facts: factsMd,
    summary: {
      scenes: scenes.length,
      facts: facts.length,
      charts: scenes.filter((s) => s.kind === "chart").length,
    },
  };
}

function main() {
  try {
    const { flags } = parseArgs(process.argv.slice(2), {
      strings: ["doc", "out", "max-sections", "format"],
    });
    if (!flags.doc || !flags.out) throw new Error("Give --doc README.md and --out projects/<slug>");
    if (/\.pdf$/i.test(flags.doc))
      throw new Error(
        "PDFs are not read: no PDF parser is installed. Export the text or Markdown and pass that file.",
      );
    if (statSync(flags.doc).size > MAX_BYTES)
      throw new Error("The document is larger than 1 MB; refusing to read it.");
    const format = flags.format ?? "short-9x16";
    if (!FORMATS.includes(format)) throw new Error(`--format is one of ${FORMATS.join(", ")}.`);
    const max = Number(flags["max-sections"] ?? 5);
    if (!Number.isInteger(max) || max < 1 || max > 8) throw new Error("--max-sections is 1 to 8.");
    if (existsSync(path.join(flags.out, "video.json")))
      throw new Error(
        `${flags.out}/video.json exists; choose a new folder so nothing is overwritten.`,
      );
    const r = buildDoc(parseDoc(readFileSync(flags.doc, "utf8")), {
      file: path.basename(flags.doc),
      maxSections: max,
      format,
    });
    mkdirSync(flags.out, { recursive: true });
    writeFileSync(path.join(flags.out, "video.json"), `${JSON.stringify(r.video, null, 2)}\n`);
    writeFileSync(path.join(flags.out, "script.md"), r.script);
    writeFileSync(path.join(flags.out, "facts.md"), r.facts);
    console.log(
      capLines(
        [
          `Wrote ${flags.out}: ${plural(r.summary.scenes, "scene", "scenes")}, ${plural(r.summary.facts, "fact", "facts")}, ${plural(r.summary.charts, "chart", "charts")}.`,
        ],
        "Draft narration is the document's own text: reword it with video-write, keep every fact id.",
      ),
    );
  } catch (e) {
    console.error(e.message);
    process.exit(2);
  }
}

if (isEntry(import.meta.url)) main();
