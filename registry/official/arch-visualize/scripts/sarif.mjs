// SARIF 2.1.0 output for the possible risks, so a pull request can show them next to the code.
import { readFileSync } from "node:fs";
import path from "node:path";
import { skillDir } from "./_lib.mjs";
import { MAX_EVIDENCE, RULES } from "./risk-rules.mjs";

const toolVersion = () =>
  /^version:\s*(\S+)/m.exec(readFileSync(path.join(skillDir(), "skill.meta.yaml"), "utf8"))?.[1] ??
  "0";
const camel = (title) =>
  title
    .replace(/[^A-Za-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join("")
    .slice(0, 60) || "Risk";

/**
 * SARIF 2.1.0 for `risks`. `modelPath` is the model file, relative to the project, with forward slashes; every
 * result points at it, and also at each evidence file and line (at most 5). Deterministic and free of dates.
 */
export function toSarif(risks, modelPath) {
  const sorted = [...risks].sort((a, b) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : a.nodes.join() < b.nodes.join() ? -1 : 1,
  );
  const ruleIds = [...new Set(sorted.map((r) => r.id))].sort();
  const level = (r) => (r.severity === "warn" ? "warning" : "note");
  const rules = ruleIds.map((id) => {
    const r = RULES[id] ?? sorted.find((x) => x.id === id);
    const fixes = (r.fixes ?? []).map(
      (f) => `- ${f.text}${f.tradeoff ? ` (trade-off: ${f.tradeoff})` : ""}`,
    );
    return {
      id,
      name: camel(r.title ?? id),
      shortDescription: { text: r.title ?? id },
      fullDescription: { text: r.why },
      help: {
        text: [
          `Possible risk to check: ${r.check}`,
          ...(fixes.length ? ["Options:", ...fixes] : []),
        ].join("\n"),
      },
      defaultConfiguration: { level: level(r) },
      properties: {
        tags: ["architecture", "possible-risk", ...(r.heuristic ? ["heuristic"] : [])],
      },
    };
  });
  return {
    $schema: "https://json.schemastore.org/sarif-2.1.0.json",
    version: "2.1.0",
    runs: [
      {
        tool: { driver: { name: "arch-visualize", version: toolVersion(), rules } },
        results: sorted.map((r) => ({
          ruleId: r.id,
          ruleIndex: ruleIds.indexOf(r.id),
          level: level(r),
          message: {
            text: `Possible risk to check: ${r.title ?? r.id}. ${r.check}`,
          },
          locations: [
            {
              physicalLocation: { artifactLocation: { uri: modelPath }, region: { startLine: 1 } },
              message: {
                text: `Architecture model (${r.nodes.join(", ") || "no component named"})`,
              },
            },
            ...(r.evidence ?? []).slice(0, MAX_EVIDENCE).map((e) => ({
              physicalLocation: {
                artifactLocation: { uri: e.file },
                region: { startLine: Math.max(1, e.line ?? 1) },
              },
              ...(e.note ? { message: { text: e.note } } : {}),
            })),
          ],
        })),
      },
    ],
  };
}
