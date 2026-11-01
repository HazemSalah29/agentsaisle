// Turns one flow of an arch-visualize model (docs/architecture.json) into the props of a `request-flow` scene.
// Pure and read-only: the model is data, never code. Only the components and connections the flow touches are
// kept, so a big system becomes a clear picture. Nothing is invented: labels, protocols and `file:line`
// evidence all come from the model.

export const MAX_BYTES = 2 * 1024 * 1024;
const ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
const TIERS = ["clients", "edge", "frontend", "backend", "async", "data", "external"];
// Control codes and bidi marks must not reach the screen or the terminal. (Joiners stay: Arabic needs them.)
// The pattern is a string of escapes, so no bidi character sits in this file.
const UNSAFE = new RegExp("[\\p{Cc}\\u200e\\u200f\\u202a-\\u202e\\u2066-\\u2069]", "gu");
const clean = (t, max) =>
  String(t ?? "")
    .replace(UNSAFE, " ")
    .trim()
    .slice(0, max);

/** Short `file:line` text from an edge's first piece of evidence, or undefined. */
function evidenceOf(edge) {
  const ev = edge.evidence?.[0];
  if (!ev || typeof ev.file !== "string") return undefined;
  const file = clean(ev.file, 200);
  const shown = file.length > 44 ? `...${file.slice(-41)}` : file;
  return Number.isInteger(ev.line) ? `${shown}:${ev.line}` : shown;
}

/** Flow ids in a model, for messages. */
export const flowIds = (model) =>
  Array.isArray(model?.flows) ? model.flows.map((f) => f?.id) : [];

/**
 * Props for a request-flow scene from `model` and a flow id. Throws an Error with a plain sentence when the
 * model or the flow cannot be used.
 */
export function importFlow(model, flowId) {
  if (!model || typeof model !== "object" || ![1, 2].includes(model.version))
    throw new Error("This does not look like an arch-visualize model (version 1 or 2 expected).");
  for (const k of ["nodes", "edges", "flows"])
    if (!Array.isArray(model[k])) throw new Error(`The model has no "${k}" list.`);
  const flow = model.flows.find((f) => f?.id === flowId);
  if (!flow)
    throw new Error(
      `No flow "${flowId}" in the model. Flows: ${flowIds(model).filter(Boolean).join(", ") || "none"}.`,
    );
  const nodes = new Map(model.nodes.filter((n) => ID.test(n?.id ?? "")).map((n) => [n.id, n]));
  const edges = new Map(model.edges.filter((e) => ID.test(e?.id ?? "")).map((e) => [e.id, e]));
  const steps = [];
  const useNodes = new Set();
  const useEdges = new Set();
  for (const [i, st] of (flow.steps ?? []).entries()) {
    if (st.edge !== undefined) {
      const e = edges.get(st.edge);
      if (!e)
        throw new Error(`Step ${i + 1} uses connection "${st.edge}", which is not in the model.`);
      if (!nodes.has(e.from) || !nodes.has(e.to))
        throw new Error(`Connection "${st.edge}" points to a component that is not in the model.`);
      useEdges.add(e.id);
      useNodes.add(e.from).add(e.to);
      const out = { edge: e.id };
      if (st.reverse === true) out.reverse = true;
      if (st.together === true) out.together = true;
      if (st.label) out.label = clean(st.label, 40);
      const ev = evidenceOf(e);
      if (ev) out.evidence = ev;
      steps.push(out);
    } else if (st.event !== undefined && nodes.has(st.node)) {
      useNodes.add(st.node);
      steps.push({ event: clean(st.event, 40), node: st.node });
    } else
      throw new Error(`Step ${i + 1} is neither a connection nor an event on a known component.`);
  }
  if (!steps.length) throw new Error(`Flow "${flowId}" has no steps.`);
  const order = (n) => TIERS.indexOf(n.tier);
  const keep = [...useNodes].map((id) => nodes.get(id)).sort((a, b) => order(a) - order(b));
  return {
    title: clean(flow.name, 120),
    nodes: keep.map((n) => ({ id: n.id, label: clean(n.label, 24), role: n.role, tier: n.tier })),
    edges: [...useEdges].map((id) => {
      const e = edges.get(id);
      const out = { id, from: e.from, to: e.to };
      if (e.protocol) out.protocol = clean(e.protocol, 30);
      return out;
    }),
    steps,
    shown: { nodes: keep.length, of: model.nodes.length },
  };
}
