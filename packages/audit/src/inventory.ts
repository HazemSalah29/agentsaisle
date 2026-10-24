import type { AuditInventory } from "@agentsaisle/registry-schema";
import type { Ctx } from "./types.js";
import { isInstruction, isScript } from "./util.js";

/** Split `allowed-tools` into entries; patterns like `Bash(git diff *)` contain spaces. */
export function parseAllowedTools(value: unknown): string[] {
  const parts: string[] = [];
  const items = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
  for (const item of items) {
    if (typeof item !== "string") continue;
    for (const m of item.matchAll(/[A-Za-z_][\w:.-]*(?:\([^)]*\))?/g)) parts.push(m[0]);
  }
  return parts;
}

export const LOOPBACK = /^(?:localhost|127\.\d+\.\d+\.\d+|0\.0\.0\.0|\[::1\]|::1)(?::\d+)?$/i;
export const NAMESPACE_HOSTS =
  /(?:^|\.)(?:w3\.org|xmlns\.com|schemas\.\w+\.\w+|purl\.org|ns\.adobe\.com|json-schema\.org)$/i;

export function host(url: string): string {
  const m = /^https?:\/\/([^/?#\s]+)/i.exec(url);
  return (m?.[1] ?? "").replace(/^[^@]*@/, "").toLowerCase();
}

const URL_RE = /https?:\/\/[^\s)>"'`\]]+/gi;

/** Every URL mentioned in scripts and instruction files, sorted and de-duplicated. */
export function collectUrls(ctx: Ctx): string[] {
  const urls = new Set<string>();
  for (const f of ctx.skill.files) {
    if (f.text === undefined || !(isScript(f) || isInstruction(f))) continue;
    for (const m of f.text.matchAll(URL_RE)) urls.add(m[0].replace(/[.,;:]+$/, ""));
  }
  return [...urls].sort();
}

/** Domains referenced by those URLs, without loopback hosts and XML/JSON namespace hosts. */
export function collectDomains(ctx: Ctx): string[] {
  const set = new Set<string>();
  for (const url of collectUrls(ctx)) {
    const h = host(url).replace(/:\d+$/, "");
    if (h && !LOOPBACK.test(h) && !NAMESPACE_HOSTS.test(h)) set.add(h);
  }
  return [...set].sort();
}

export const collectTools = (ctx: Ctx): string[] =>
  parseAllowedTools(ctx.frontmatter.data?.["allowed-tools"]);

export const collectScripts = (ctx: Ctx): string[] =>
  ctx.skill.files.filter(isScript).map((f) => f.path);

/** What the skill can use, for the permissions block on the website. Not a finding. */
export function buildInventory(ctx: Ctx): AuditInventory {
  return {
    tools: collectTools(ctx),
    scripts: collectScripts(ctx),
    urls: collectUrls(ctx),
    domains: collectDomains(ctx),
  };
}
