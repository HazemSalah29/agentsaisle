// The demo script: a short, plain-text list of steps that capture.mjs performs on the user's own app. Pure
// parsing and checking; nothing here opens a browser or the network.
//
//   go /pricing                  open a path on the app (a path only, never another site)
//   say intro                    mark where narration line "intro" starts
//   hover "Pricing"              move the cursor to a target
//   click "Start free trial"     click a target
//   type #email "me@example.com" type text into a target
//   scroll down 600              scroll by pixels (down or up)
//   wait 1.5                     pause (seconds, up to 10); cut from the film later
//
// A target is quoted text on the page, or a CSS selector that starts with # . [ or css=.
export const LIMITS = { steps: 60, target: 160, text: 120, wait: 10, scroll: 4000 };
const OPS = ["go", "say", "hover", "click", "type", "scroll", "wait"];
const ID = /^[a-z0-9-]{1,32}$/;

/** Split one line into words; a "quoted string" (with \" inside) is one word that keeps its quotes marked. */
function words(line) {
  const out = [];
  let i = 0;
  while (i < line.length) {
    if (/\s/.test(line[i])) {
      i++;
      continue;
    }
    if (line[i] === '"') {
      let j = i + 1;
      let s = "";
      while (j < line.length && line[j] !== '"') {
        if (line[j] === "\\" && j + 1 < line.length) j++;
        s += line[j++];
      }
      if (j >= line.length) return { error: "a quote is not closed" };
      out.push({ quoted: true, text: s });
      i = j + 1;
    } else {
      let j = i;
      while (j < line.length && !/\s/.test(line[j])) j++;
      out.push({ quoted: false, text: line.slice(i, j) });
      i = j;
    }
  }
  return { words: out };
}

/** A target as { text } or { css }, or an error string. */
function target(w) {
  if (!w) return "needs a target (quoted text or a CSS selector)";
  if (w.text.length === 0 || w.text.length > LIMITS.target)
    return `the target must be 1 to ${LIMITS.target} characters`;
  if (w.quoted) return { text: w.text };
  const css = w.text.replace(/^css=/, "");
  if (!/^[#.[]/.test(css) && css === w.text)
    return 'a bare word is ambiguous: quote the text ("Sign in") or write a selector (#id, .class, [attr])';
  if (/[\0\r\n]/.test(css)) return "the selector has control characters";
  return { css };
}

/** Parse demo.md into { steps, problems }. Lines starting with # followed by a space, and blank lines, are comments. */
export function parseDemo(text) {
  const steps = [];
  const problems = [];
  const lines = String(text).split(/\r?\n/);
  lines.forEach((raw, k) => {
    const line = raw.trim();
    if (!line || /^#(\s|$)/.test(line)) return;
    const at = `line ${k + 1}`;
    const bad = (m) => problems.push(`${at}: ${m}`);
    const w = words(line);
    if (w.error) return bad(w.error);
    const [op, ...args] = w.words;
    if (op.quoted || !OPS.includes(op.text))
      return bad(`unknown step "${op.text.slice(0, 20)}" (use ${OPS.join(", ")})`);
    const step = { line: k + 1, op: op.text };
    const need = (n) => args.length === n || (bad(`${op.text} takes ${n} value(s)`), false);
    if (op.text === "go") {
      if (!need(1)) return;
      const p = args[0].text;
      if (!/^\/[^\s]*$/.test(p) || p.startsWith("//") || /[\0\\]/.test(p))
        return bad('go takes a path that starts with "/" (not a full address)');
      step.path = p.slice(0, 200);
    } else if (op.text === "say") {
      if (!need(1)) return;
      if (!ID.test(args[0].text)) return bad("say takes a narration line id (a-z, 0-9, -)");
      step.id = args[0].text;
    } else if (op.text === "hover" || op.text === "click") {
      if (!need(1)) return;
      const t = target(args[0]);
      if (typeof t === "string") return bad(t);
      Object.assign(step, t);
    } else if (op.text === "type") {
      if (!need(2)) return;
      const t = target(args[0]);
      if (typeof t === "string") return bad(t);
      if (!args[1].quoted || args[1].text.length === 0 || args[1].text.length > LIMITS.text)
        return bad(`type needs the text in quotes, 1 to ${LIMITS.text} characters`);
      Object.assign(step, t, { value: args[1].text });
    } else if (op.text === "scroll") {
      if (!need(2)) return;
      const px = Number(args[1].text);
      if (
        !["down", "up"].includes(args[0].text) ||
        !Number.isInteger(px) ||
        px < 1 ||
        px > LIMITS.scroll
      )
        return bad(`scroll takes down or up and whole pixels, 1 to ${LIMITS.scroll}`);
      step.dir = args[0].text;
      step.px = px;
    } else if (op.text === "wait") {
      if (!need(1)) return;
      const s = Number(args[0].text);
      if (!(s > 0 && s <= LIMITS.wait))
        return bad(`wait takes seconds, above 0 and up to ${LIMITS.wait}`);
      step.seconds = s;
    }
    steps.push(step);
  });
  if (steps.length === 0 && problems.length === 0) problems.push("the demo script has no steps");
  if (steps.length > LIMITS.steps)
    problems.push(`at most ${LIMITS.steps} steps (has ${steps.length})`);
  if (steps.length && steps[0].op !== "go" && !problems.length)
    problems.push('start with a "go /path" step so the page is open');
  return { steps, problems };
}
