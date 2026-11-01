// Parsers for the three text files a video project keeps: script.md, facts.md and storyboard.md.
// Pure functions over text; nothing here touches the disk or the network.
//
// script.md   [l1] One narration line.            (id in square brackets, one line of speech)
//               beat: hook                         (indented "key: value" lines belong to the line above)
//               on-screen: Text shown on screen
//               visual: what the viewer sees
//               fact: f1                           (id of an entry in facts.md)
// facts.md    - [f1] A claim. Source: https://example.com/page
// storyboard  a markdown table; the props column is a JSON object in backticks

export const ID = /^[a-z0-9-]{1,32}$/;
const LINE = /^\[([a-z0-9-]{1,32})\]\s*(.*)$/;
const ATTR = /^\s+([a-z][a-z-]*):\s*(.*)$/;
const FACT = /^\s*[-*]\s*\[([a-z0-9-]{1,32})\]\s+(.*)$/;

/** Words in a narration line. */
export const wordCount = (text) => text.trim().split(/\s+/).filter(Boolean).length;

/** Spoken seconds at about 2.5 words a second (about 2.2 for Arabic). */
export const speechSeconds = (text, lang = "en") =>
  wordCount(text) / (lang.startsWith("ar") ? 2.2 : 2.5);

/** Narration lines of script.md: { lines: [{ id, text, attrs, line }], problems: [{ line, message }] }. */
export function parseScript(text) {
  const lines = [];
  const problems = [];
  const seen = new Set();
  text.split(/\r?\n/).forEach((raw, i) => {
    const n = i + 1;
    if (!raw.trim() || raw.startsWith("#") || raw.trim().startsWith("<!--")) return;
    const m = LINE.exec(raw);
    if (m) {
      if (seen.has(m[1])) problems.push({ line: n, message: `line id "${m[1]}" is used twice` });
      seen.add(m[1]);
      if (!m[2].trim()) problems.push({ line: n, message: `line "${m[1]}" has no text` });
      lines.push({ id: m[1], text: m[2].trim(), attrs: {}, line: n });
      return;
    }
    const a = ATTR.exec(raw);
    if (a && lines.length) {
      lines[lines.length - 1].attrs[a[1]] = a[2].trim();
      return;
    }
    problems.push({
      line: n,
      message: "not a script line: start narration with [id], or indent a key: value",
    });
  });
  return { lines, problems };
}

/** Entries of facts.md: [{ id, claim, source, line }]. A source is whatever follows "Source:". */
export function parseFacts(text) {
  const out = [];
  text.split(/\r?\n/).forEach((raw, i) => {
    const m = FACT.exec(raw);
    if (!m) return;
    const [claim, ...rest] = m[2].split(/\s+Source:\s*/);
    out.push({ id: m[1], claim: claim.trim(), source: rest.join(" ").trim(), line: i + 1 });
  });
  return out;
}

/** Split one table row on "|" except inside backtick spans. Leading/trailing bars are optional. */
export function splitRow(row) {
  const cells = [];
  let cur = "";
  let tick = false;
  for (const c of row.trim()) {
    if (c === "`") tick = !tick;
    if (c === "|" && !tick) {
      cells.push(cur.trim());
      cur = "";
    } else cur += c;
  }
  cells.push(cur.trim());
  if (cells[0] === "") cells.shift();
  if (cells.at(-1) === "") cells.pop();
  return cells;
}

/**
 * The storyboard table: { rows: [{ scene, kind, narration, seconds, transition, props, line, ... }],
 * problems }. Column names are the header cells, lower-cased; unknown columns are kept.
 */
export function parseStoryboard(text) {
  const rows = [];
  const problems = [];
  let head = null;
  text.split(/\r?\n/).forEach((raw, i) => {
    const n = i + 1;
    if (!raw.trim().startsWith("|")) return;
    const cells = splitRow(raw);
    if (cells.every((c) => /^:?-+:?$/.test(c))) return;
    if (!head) {
      head = cells.map((c) => c.toLowerCase());
      for (const need of ["scene", "kind"])
        if (!head.includes(need))
          problems.push({ line: n, message: `storyboard table needs a "${need}" column` });
      return;
    }
    const row = { line: n };
    head.forEach((h, k) => (row[h] = cells[k] ?? ""));
    if (row.props) {
      const body = row.props.replace(/^`|`$/g, "");
      try {
        const v = JSON.parse(body);
        if (!v || typeof v !== "object" || Array.isArray(v)) throw new Error("not an object");
        row.props = v;
      } catch {
        problems.push({
          line: n,
          message: `scene "${row.scene}": props must be a JSON object in backticks`,
        });
        row.props = {};
      }
    } else row.props = {};
    rows.push(row);
  });
  if (!head) problems.push({ line: 1, message: "no storyboard table found" });
  return { rows, problems };
}

/** The hooks.md options: numbered or bulleted lines, "1. text" or "- text". */
export const parseHooks = (text) =>
  text
    .split(/\r?\n/)
    .map((l) => /^\s*(?:\d+[.)]|[-*])\s+(.+)$/.exec(l)?.[1]?.trim())
    .filter(Boolean);
