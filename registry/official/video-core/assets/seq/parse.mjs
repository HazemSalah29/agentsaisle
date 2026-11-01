// Parser for the `sequence` scene: a small text format and a subset of Mermaid sequence diagrams. Pure; it never
// evaluates anything. Returns { participants: [{ id, label }], items: [...], problems: [string] }.
//   A->B: text       a request (solid arrow)          A->>B: text    same, Mermaid style
//   B-->A: text      a reply (dashed arrow)           B-->>A: text   same, Mermaid style
//   participant A as Browser                           Note over A,B: text
// An item is { type: "msg", from, to, text, dashed } or { type: "note", over: [id, ...], text }.

export const LIMITS = { participants: 6, items: 12, label: 30, source: 1200 };
const ID = "[A-Za-z][A-Za-z0-9_]{0,15}";
const MSG = new RegExp(`^(${ID})\\s*(--?>>?)\\s*(${ID})\\s*:\\s*(.+)$`);
const PART = new RegExp(`^(?:participant|actor)\\s+(${ID})(?:\\s+as\\s+(.+))?$`);
const NOTE = new RegExp(
  `^note\\s+(?:over\\s+(${ID})(?:\\s*,\\s*(${ID}))?|(?:right|left)\\s+of\\s+(${ID}))\\s*:\\s*(.+)$`,
  "i",
);
const UNSUPPORTED =
  /^(loop|alt|else|opt|par|and|critical|break|rect|end|activate|deactivate|autonumber|box|create|destroy|link|links)\b/i;

export function parseSequence(source) {
  const problems = [];
  const participants = [];
  const items = [];
  const seen = new Map();
  const add = (id, label) => {
    if (!seen.has(id)) {
      seen.set(id, participants.length);
      participants.push({ id, label: label ?? id });
    } else if (label) participants[seen.get(id)].label = label;
  };
  String(source ?? "")
    .split(/\r?\n/)
    .forEach((raw, n) => {
      const line = raw.trim();
      const at = `line ${n + 1}`;
      if (
        !line ||
        line.startsWith("%%") ||
        /^sequenceDiagram$/i.test(line) ||
        /^title\b/i.test(line)
      )
        return;
      let m;
      if ((m = line.match(PART))) return add(m[1], m[2]?.trim());
      if ((m = line.match(MSG))) {
        add(m[1]);
        add(m[3]);
        const dashed = m[2].startsWith("--");
        return items.push({ type: "msg", from: m[1], to: m[3], text: m[4].trim(), dashed });
      }
      if ((m = line.match(NOTE))) {
        const over = [m[1], m[2], m[3]].filter(Boolean);
        over.forEach((id) => add(id));
        return items.push({ type: "note", over, text: m[4].trim() });
      }
      if (UNSUPPORTED.test(line))
        return problems.push(
          `${at}: "${line.split(/\s/)[0]}" is not supported (only participants, arrows and notes)`,
        );
      problems.push(`${at}: cannot read "${line.slice(0, 40)}" (write A->B: text)`);
    });
  if (!items.length) problems.push("no messages: write at least one line such as A->B: hello");
  if (participants.length > LIMITS.participants)
    problems.push(`more than ${LIMITS.participants} participants`);
  if (items.length > LIMITS.items)
    problems.push(`more than ${LIMITS.items} messages and notes (split it over two scenes)`);
  for (const it of items)
    if (it.text.length > LIMITS.label)
      problems.push(`"${it.text.slice(0, 20)}...": longer than ${LIMITS.label} characters`);
  for (const p of participants)
    if (p.label.length > 16)
      problems.push(`participant "${p.label.slice(0, 16)}...": name longer than 16 characters`);
  return { participants, items, problems };
}
