// Rules AV-R11 to AV-R18: they read the model's own facts (timeouts, retries, zones, data labels, AI parts,
// replicas, flows) and need no project files. Every result is a possible risk to check.
import { ev, risk } from "./risk-rules.mjs";

const nodeById = (m) => Object.fromEntries(m.nodes.map((n) => [n.id, n]));
const edgeEv = (e, note) => {
  const first = (e.evidence ?? [])[0];
  return first ? [ev(first.file, first.line ?? 1, `${e.id}: ${note}`)] : [];
};
const isSync = (e) => e.sync !== false;

function r11(ctx) {
  const sync = ctx.model.edges.filter(isSync);
  if (!sync.some((e) => e.timeoutMs !== undefined)) return [];
  const missing = sync.filter((e) => e.timeoutMs === undefined);
  if (!missing.length) return [];
  return [
    risk(
      "AV-R11",
      missing.map((e) => e.from),
      missing.flatMap((e) => edgeEv(e, "no timeout recorded")),
    ),
  ];
}
function r12(ctx) {
  const hit = ctx.model.edges.filter(
    (e) =>
      e.retries > 0 &&
      !(e.evidence ?? []).some((x) => /backoff|jitter|exponential/i.test(x.note ?? "")),
  );
  return hit.length
    ? [
        risk(
          "AV-R12",
          hit.map((e) => e.from),
          hit.flatMap((e) => edgeEv(e, `${e.retries} retries, no backoff noted`)),
        ),
      ]
    : [];
}
function r13(ctx) {
  const n = nodeById(ctx.model);
  const hit = ctx.model.edges.filter((e) => {
    const a = n[e.from]?.zone;
    const b = n[e.to]?.zone;
    return a && b && a !== b && (e.auth === "none" || e.tls === false);
  });
  return hit.length
    ? [
        risk(
          "AV-R13",
          hit.flatMap((e) => [e.from, e.to]),
          hit.flatMap((e) =>
            edgeEv(
              e,
              `crosses ${n[e.from].zone} to ${n[e.to].zone} with ${e.auth === "none" ? "no authentication" : "no TLS"}`,
            ),
          ),
        ),
      ]
    : [];
}
function r14(ctx) {
  const n = nodeById(ctx.model);
  const holdsLogs = (x) => (x.data ?? []).includes("logs");
  const edges = ctx.model.edges.filter(
    (e) =>
      (e.carries ?? []).includes("pii") && (n[e.to].zone === "third-party" || holdsLogs(n[e.to])),
  );
  const stored = ctx.model.nodes.filter(
    (x) => (x.data ?? []).includes("pii") && x.zone === "third-party",
  );
  if (!edges.length && !stored.length) return [];
  return [
    risk(
      "AV-R14",
      [...edges.flatMap((e) => [e.from, e.to]), ...stored.map((x) => x.id)],
      [
        ...edges.flatMap((e) => edgeEv(e, "carries personal data")),
        ...stored.flatMap((x) =>
          (x.evidence ?? [])
            .slice(0, 1)
            .map((v) =>
              ev(v.file, v.line ?? 1, `${x.id}: holds personal data in a third-party zone`),
            ),
        ),
      ],
    ),
  ];
}
const WRITE_TOOL =
  /\b(write|edit|multiedit|notebookedit|bash|shell|exec|run|delete|apply_patch)\b/i;
const aiNodes = (m) => m.nodes.filter((x) => x.ai);
function r15(ctx) {
  const hit = aiNodes(ctx.model).filter(
    (x) =>
      ["agent", "mcp-server", "skill"].includes(x.ai.kind) &&
      !x.ai.auditGrade &&
      (x.ai.tools ?? []).some((t) => WRITE_TOOL.test(t)),
  );
  return hit.length
    ? [
        risk(
          "AV-R15",
          hit.map((x) => x.id),
          hit.flatMap((x) =>
            (x.evidence ?? [])
              .slice(0, 1)
              .map((v) => ev(v.file, v.line ?? 1, `${x.id}: tools ${x.ai.tools.join(", ")}`)),
          ),
        ),
      ]
    : [];
}
function r16(ctx) {
  const hit = aiNodes(ctx.model).filter((x) => x.ai.auditGrade === "D" || x.ai.auditGrade === "F");
  return hit.length
    ? [
        risk(
          "AV-R16",
          hit.map((x) => x.id),
          hit.map((x) =>
            ev(x.ai.auditSource ?? x.id, 1, `${x.id}: audit grade ${x.ai.auditGrade}`),
          ),
        ),
      ]
    : [];
}
export const FAN_OUT_LIMIT = 4;
function r17(ctx) {
  const edgeById = Object.fromEntries(ctx.model.edges.map((e) => [e.id, e]));
  const nodes = [];
  const evidence = [];
  for (const flow of ctx.model.flows ?? []) {
    const steps = [];
    for (const s of flow.steps ?? []) {
      if (s.together === true && s.edge && steps.length) steps[steps.length - 1].push(s.edge);
      else steps.push(s.edge ? [s.edge] : []);
    }
    steps.forEach((ids) => {
      const calls = ids.map((id) => edgeById[id]).filter((e) => e && isSync(e));
      if (calls.length <= FAN_OUT_LIMIT) return;
      nodes.push(...calls.flatMap((e) => [e.from, e.to]));
      evidence.push(
        ...edgeEv(calls[0], `${calls.length} synchronous calls in one step of ${flow.id}`),
      );
    });
  }
  return nodes.length ? [risk("AV-R17", nodes, evidence)] : [];
}
function r18(ctx) {
  const used = {};
  const edgeById = Object.fromEntries(ctx.model.edges.map((e) => [e.id, e]));
  for (const flow of ctx.model.flows ?? []) {
    const seen = new Set();
    for (const s of flow.steps ?? []) {
      const e = s.edge && edgeById[s.edge];
      if (e) {
        seen.add(e.from);
        seen.add(e.to);
      } else if (s.node) seen.add(s.node);
    }
    for (const id of seen) used[id] = (used[id] ?? 0) + 1;
  }
  const hit = ctx.model.nodes.filter((x) => x.replicas === 1 && (used[x.id] ?? 0) >= 3);
  return hit.length
    ? [
        risk(
          "AV-R18",
          hit.map((x) => x.id),
          hit.flatMap((x) =>
            (x.evidence ?? [])
              .slice(0, 1)
              .map((v) =>
                ev(v.file, v.line ?? 1, `${x.id}: one replica, used by ${used[x.id]} flows`),
              ),
          ),
        ),
      ]
    : [];
}

export const MODEL_RULES = [r11, r12, r13, r14, r15, r16, r17, r18];
