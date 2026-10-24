import type { AuditFinding } from "@agentsaisle/registry-schema";
import type { LinePattern, Rule } from "../types.js";
import { collectDomains, host, LOOPBACK, NAMESPACE_HOSTS } from "../inventory.js";
import { finding, runPatterns } from "../util.js";

const patterns: LinePattern[] = [
  {
    rule: "AA-N01",
    severity: "low",
    title: "Plain http:// URL",
    why: "Plain HTTP can be read or altered by anyone on the network path.",
    fix: "Use https://.",
    scope: "text",
    comments: true,
    re: /http:\/\/[^\s)>"'`\]]+/i,
    skip: (_l, m) => {
      const h = host(m[0]);
      return LOOPBACK.test(h) || NAMESPACE_HOSTS.test(h.replace(/:\d+$/, ""));
    },
  },
  {
    rule: "AA-N02",
    severity: "medium",
    title: "URL shortener or raw IP address",
    why: "Shorteners and raw IPs hide where the request really goes.",
    fix: "Use the full, named https:// URL of the service.",
    scope: "text",
    comments: true,
    re: /https?:\/\/(?:(?:bit\.ly|tinyurl\.com|t\.co|goo\.gl|ow\.ly|is\.gd|buff\.ly|rebrand\.ly|cutt\.ly|shorturl\.at|tiny\.cc|rb\.gy|s\.id|lnkd\.in|t\.ly|v\.gd)\b|\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(?::\d+)?(?:[/?#\s)"'`]|$))/i,
    skip: (_l, m) => LOOPBACK.test(host(m[0])),
  },
];

const domains: Rule = (ctx) => {
  const list = collectDomains(ctx);
  const out: AuditFinding[] = [
    finding({
      rule: "AA-N03",
      severity: "info",
      title: `Inventory: ${list.length} ${list.length === 1 ? "domain" : "domains"}`,
      file: "SKILL.md",
      excerpt: list.join(", ") || "none",
      why: "Lists every domain the skill mentions, so you can check each one is expected.",
      fix: "Nothing to fix; remove domains the skill does not need.",
    }),
  ];
  return out;
};

export const networkRules: Rule[] = [(ctx) => runPatterns(ctx, patterns), domains];
