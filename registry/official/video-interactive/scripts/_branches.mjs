// Pure checks for an interactive.json (the branch points of an interactive explainer). No imports, so the
// video-interactive skill keeps a byte-identical copy. A branch is a question that appears at the end of one
// scene; each answer plays its own run of scenes, then every path continues at the same scene (or ends).
//
// { "version": 1, "branches": [ { "id": "pick", "after": "s3", "question": "Which one?",
//     "options": [ { "label": "Token bucket", "from": "s4", "to": "s5" }, { "label": "Sliding window", "from": "s6", "to": "s7" } ],
//     "then": "s8" } ] }
//
// Scenes of one branch sit next to each other in video.json, in this order: the `after` scene, the scenes of
// option 1, the scenes of option 2, and so on, then the `then` scene (or "end" when the options are last).

export const LIMITS = { branches: 4, options: 4, question: 100, label: 40 };
const ID = /^[a-z0-9-]{1,32}$/;
const UNSAFE = new RegExp("[\\p{Cc}\\u200e\\u200f\\u202a-\\u202e\\u2066-\\u2069]", "u");

/** Problems with interactive data against a video's scene ids, as readable strings. */
export function branchProblems(data, sceneIds) {
  const p = [];
  if (!data || typeof data !== "object" || data.version !== 1)
    return ['interactive.json: "version" must be 1'];
  const list = data.branches;
  if (!Array.isArray(list) || list.length < 1 || list.length > LIMITS.branches)
    return [`branches: a list of 1 to ${LIMITS.branches} branches`];
  const at = (id) => sceneIds.indexOf(id);
  const seen = new Set();
  let floor = 0;
  list.forEach((b, i) => {
    const w = `branches[${i}]`;
    if (!ID.test(b?.id ?? "")) p.push(`${w}.id: lowercase letters, digits and hyphens`);
    else if (seen.has(b.id)) p.push(`${w}.id: "${b.id}" is used twice`);
    else seen.add(b.id);
    for (const [k, max] of [["question", LIMITS.question]])
      if (typeof b?.[k] !== "string" || !b[k].trim() || b[k].length > max || UNSAFE.test(b[k]))
        p.push(`${w}.${k}: plain text of 1 to ${max} characters`);
    const opts = b?.options;
    if (!Array.isArray(opts) || opts.length < 2 || opts.length > LIMITS.options)
      return p.push(`${w}.options: 2 to ${LIMITS.options} options`);
    const a = at(b.after);
    if (a < 0) return p.push(`${w}.after: no scene "${b.after}"`);
    if (a < floor) p.push(`${w}.after: "${b.after}" comes before the end of the previous branch`);
    let next = a + 1;
    opts.forEach((o, j) => {
      const ow = `${w}.options[${j}]`;
      if (
        typeof o?.label !== "string" ||
        !o.label.trim() ||
        o.label.length > LIMITS.label ||
        UNSAFE.test(o.label)
      )
        p.push(`${ow}.label: plain text of 1 to ${LIMITS.label} characters`);
      const f = at(o?.from);
      const t = at(o?.to);
      if (f < 0 || t < 0) return p.push(`${ow}: "from" and "to" must be scene ids`);
      if (f !== next)
        p.push(
          `${ow}.from: must be "${sceneIds[next] ?? "?"}", the scene right after the previous part`,
        );
      if (t < f) p.push(`${ow}.to: comes before "from"`);
      next = t + 1;
    });
    const then = b.then === "end" ? sceneIds.length : at(b.then);
    if (then < 0) p.push(`${w}.then: a scene id or "end"`);
    else if (then !== next)
      p.push(
        `${w}.then: must be "${sceneIds[next] ?? "end"}", the scene right after the last option`,
      );
    floor = Math.max(then, next);
  });
  return p;
}

/** Branches with scene indexes resolved to times: scenes = [{ id, start, end }]. Call only when branchProblems is empty. */
export function resolveBranches(data, scenes) {
  const by = new Map(scenes.map((s) => [s.id, s]));
  return data.branches.map((b) => ({
    id: b.id,
    question: b.question,
    gate: by.get(b.after).end,
    options: b.options.map((o) => ({
      label: o.label,
      start: by.get(o.from).start,
      end: by.get(o.to).end,
    })),
    then: b.then === "end" ? null : by.get(b.then).start,
  }));
}
