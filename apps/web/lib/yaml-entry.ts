import { CommunityEntry } from "@agentsaisle/registry-schema";
import { REPO_URL } from "./site";

export interface VersionDraft {
  version: string;
  ref: string;
  sha: string;
}

/** The submit form's state. Everything is a string or list until validated. */
export interface EntryDraft {
  name: string;
  author: string;
  repo: string;
  path: string;
  versions: VersionDraft[];
  category: string[];
  clients: string[];
  runs_scripts: boolean;
}

export const emptyDraft: EntryDraft = {
  name: "",
  author: "",
  repo: "",
  path: "",
  versions: [{ version: "1.0.0", ref: "", sha: "" }],
  category: [],
  clients: ["claude-code"],
  runs_scripts: false,
};

const RESERVED = /^(true|false|yes|no|on|off|null|y|n|~)$/i;

/** Plain when that is unambiguous YAML; otherwise a double-quoted (JSON-style) string. */
function scalar(s: string): string {
  return /^[A-Za-z][A-Za-z0-9._/-]*$/.test(s) && !RESERVED.test(s) ? s : JSON.stringify(s);
}

/**
 * The registry/community/<name>.yaml text. `version`, `ref` and `sha` are always quoted: an
 * unquoted all-digit SHA would be read as a number. `verified` is never written; maintainers set it.
 */
export function entryToYaml(d: EntryDraft): string {
  const lines = [
    `name: ${scalar(d.name)}`,
    `author: ${scalar(d.author)}`,
    `repo: ${scalar(d.repo)}`,
    `path: ${scalar(d.path)}`,
    "versions:",
    ...d.versions.flatMap((v) => [
      `  - version: ${JSON.stringify(v.version)}`,
      `    ref: ${JSON.stringify(v.ref)}`,
      `    sha: ${JSON.stringify(v.sha)}`,
    ]),
    `category: [${d.category.map(scalar).join(", ")}]`,
    `clients: [${d.clients.map(scalar).join(", ")}]`,
    `runs_scripts: ${d.runs_scripts ? "true" : "false"}`,
  ];
  return lines.join("\n") + "\n";
}

function valueAt(d: EntryDraft, p: PropertyKey[]): unknown {
  let cur: unknown = d;
  for (const k of p) cur = (cur as Record<PropertyKey, unknown> | undefined)?.[k];
  return cur;
}

/** Field errors keyed by path ("name", "versions.0.sha", "category"), in plain language. */
export function fieldErrors(d: EntryDraft): Record<string, string> {
  const res = CommunityEntry.safeParse(d);
  if (res.success) return {};
  const out: Record<string, string> = {};
  for (const issue of res.error.issues) {
    const key = issue.path.map(String).join(".");
    if (key in out) continue;
    const v = valueAt(d, issue.path);
    const empty = v === "" || (Array.isArray(v) && v.length === 0) || v === undefined;
    out[key] = empty
      ? Array.isArray(v)
        ? "Pick or add at least one"
        : "Required"
      : issue.message.charAt(0).toUpperCase() + issue.message.slice(1);
  }
  return out;
}

/** GitHub's "create new file" page, prefilled. GitHub forks the repo and opens the pull request. */
export function newFileUrl(name: string, yaml: string): string {
  return `${REPO_URL}/new/main/registry/community?filename=${encodeURIComponent(`${name}.yaml`)}&value=${encodeURIComponent(yaml)}`;
}
