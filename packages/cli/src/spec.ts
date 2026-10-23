import { SKILL_NAME_RE } from "@agentsaisle/registry-schema";
import { CliError } from "./errors.js";

export type Spec =
  | { kind: "registry"; name: string; version?: string }
  | { kind: "github"; repo: string; path: string; ref?: string };

/** `name[@version]` or `owner/repo[/path][@ref]`. */
export function parseSpec(input: string): Spec {
  const at = input.indexOf("@");
  const main = at === -1 ? input : input.slice(0, at);
  const suffix = at === -1 ? undefined : input.slice(at + 1) || undefined;

  if (main.includes("/")) {
    const [owner, repo, ...rest] = main.split("/");
    if (!owner || !repo || rest.some((p) => !p || p === "." || p === "..")) {
      throw new CliError(`Invalid GitHub spec "${input}". Use owner/repo[/path][@ref].`);
    }
    return { kind: "github", repo: `${owner}/${repo}`, path: rest.join("/"), ref: suffix };
  }
  if (!SKILL_NAME_RE.test(main)) {
    throw new CliError(`Invalid skill name "${main}". Names are lowercase kebab-case.`);
  }
  return { kind: "registry", name: main, version: suffix };
}

function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]!;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j]!;
      row[j] = Math.min(row[j]! + 1, row[j - 1]! + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length]!;
}

/** Up to `limit` candidates close to `input` (substring or small edit distance). */
export function closestMatches(input: string, candidates: string[], limit = 3): string[] {
  return candidates
    .map((c) => ({ c, d: c.includes(input) || input.includes(c) ? 0 : distance(input, c) }))
    .filter(({ d }) => d <= Math.max(2, Math.floor(input.length / 3)))
    .sort((x, y) => x.d - y.d || x.c.localeCompare(y.c))
    .slice(0, limit)
    .map(({ c }) => c);
}
