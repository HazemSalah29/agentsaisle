import type { LinePattern, Rule } from "../types.js";
import { negatedBefore, runPatterns } from "../util.js";

const HOME = String.raw`(?:~|\$HOME|\$\{HOME\}|%USERPROFILE%|\$env:USERPROFILE|os\.homedir\(\)|\/home\/[\w.-]+|\/Users\/[\w.-]+)`;
const NET_CALL = String.raw`(?:\bcurl\b|\bwget\b|\bfetch\s*\(|\baxios\b|\brequests\.(?:get|post|put)|\bhttp\.request|\bhttps\.request|\burllib\b|\bInvoke-(?:WebRequest|RestMethod)\b|\b(?:iwr|irm)\b|\bnc\s+-|\bnetcat\b|\bsocket\.)`;
const ENV_DUMP = String.raw`(?:\bprintenv\b|\benv\s*(?:\||>)|process\.env(?![.\[])|JSON\.stringify\(\s*process\.env|Object\.(?:entries|keys|values)\(\s*process\.env|os\.environ(?![.\[])|dict\(os\.environ|\bgetenv\s*\(\s*\)|\bGet-ChildItem\s+env:|\bcat\s+\S*\.env\b|readFile\w*\([^)]*\.env\b|open\([^)]*\.env\b)`;

const notNegated = (line: { text: string }, m: RegExpExecArray) =>
  negatedBefore(line.text, m.index);

const patterns: LinePattern[] = [
  {
    rule: "AA-X01",
    severity: "critical",
    title: "Reads a credential store",
    why: "SSH keys, cloud credentials and browser cookies give anyone who gets them access to your accounts.",
    fix: "Remove the access; a skill should only touch files in the project it was asked to work on.",
    scope: "code",
    quotable: true,
    re: new RegExp(
      String.raw`${HOME}[\\/]\.(?:ssh|aws|gnupg|netrc|npmrc|pypirc|kube[\\/]config|docker[\\/]config\.json|config[\\/]gcloud|config[\\/]gh|git-credentials)\b|\bid_(?:rsa|ed25519|ecdsa|dsa)\b|Library\/Application Support\/(?:Google\/Chrome|Firefox|BraveSoftware)|\.mozilla\/firefox|\.config\/(?:google-chrome|chromium|BraveSoftware)|\bsecurity\s+find-(?:generic|internet)-password\b|\blogin\.keychain\b|\bsecret-tool\s+lookup\b|\bcmdkey\s+\/list\b`,
      "i",
    ),
    skip: notNegated,
  },
  {
    rule: "AA-X01",
    severity: "critical",
    title: "Instruction to read a credential store",
    why: "SSH keys, cloud credentials and browser cookies give anyone who gets them access to your accounts.",
    fix: "Remove the instruction; a skill should only touch files in the project it was asked to work on.",
    scope: "instruction",
    quotable: true,
    re: new RegExp(
      String.raw`\b(?:read|cat|copy|cp|upload|send|print|show|dump|open|grep|tar|zip|collect|list|access|extract)\b[^.\n]{0,60}(?:${HOME}[\\/]\.(?:ssh|aws|gnupg|netrc|npmrc|pypirc|kube|docker|config[\\/]gcloud|git-credentials)\b|\bid_(?:rsa|ed25519)\b|\bkeychain\b|browser\s+(?:cookies|profile|passwords))`,
      "i",
    ),
    skip: notNegated,
  },
  {
    rule: "AA-X02",
    severity: "critical",
    title: "Environment variables or .env contents sent over the network",
    why: "Environment variables usually hold API keys and tokens; sending them out hands those over.",
    fix: "Send only the specific, non-secret values the feature needs, never the whole environment.",
    scope: "code",
    quotable: true,
    re: new RegExp(`${ENV_DUMP}[^\\n]*${NET_CALL}|${NET_CALL}[^\\n]*${ENV_DUMP}`, "i"),
  },
  {
    rule: "AA-X02",
    severity: "critical",
    title: "Instruction to send environment variables or .env contents out",
    why: "Environment variables usually hold API keys and tokens; sending them out hands those over.",
    fix: "Remove the instruction; never ask the agent to transmit environment values.",
    scope: "instruction",
    quotable: true,
    re: /\b(?:send|post|upload|transmit|forward|curl|exfiltrate|include)\b[^.\n]{0,60}\b(?:environment\s+variables?|env\s+vars?|\.env\b|process\.env|printenv)\b[^.\n]{0,80}(?:https?:\/\/|\bto\s+(?:a|the|this|our)\s+(?:remote\s+)?(?:server|endpoint|url|webhook|api))/i,
    skip: notNegated,
  },
  {
    rule: "AA-X03",
    severity: "high",
    title: "Upload target is a paste, webhook or tunnel service",
    why: "Paste sites, webhooks and tunnels are the usual drop points for stolen data and cannot be audited.",
    fix: "Send data only to the service the skill is documented to use, over a domain you can name.",
    scope: "text",
    quotable: true,
    comments: true,
    re: /https?:\/\/(?:[\w-]+\.)*(?:discord(?:app)?\.com\/api\/webhooks|hooks\.slack\.com\/services|pastebin\.com|paste\.ee|hastebin\.com|ghostbin\.\w+|transfer\.sh|file\.io|0x0\.st|ngrok(?:-free)?\.(?:io|app|dev)|trycloudflare\.com|requestbin\.\w+|webhook\.site|pipedream\.net|interact\.sh|oast\.\w+|burpcollaborator\.net|serveo\.net|loca\.lt|localhost\.run|requestcatcher\.com)\b/i,
  },
  {
    rule: "AA-X04",
    severity: "high",
    title: "Instruction to send code, files or conversation to an external URL",
    why: "Your code and conversation can contain secrets and private work that should stay on your machine.",
    fix: "Remove the instruction, or limit it to a named service the user has chosen and approved.",
    scope: "instruction",
    quotable: true,
    re: /\b(?:send|upload|post|transmit|forward|exfiltrate|email|submit)\b[^.\n]{0,60}\b(?:code|source|files?|repo(?:sitory)?|conversation|chat|transcript|history|contents?|secrets?|keys?|credentials|tokens?)\b[^.\n]{0,80}\b(?:to|at)\b[^.\n]{0,30}(?:https?:\/\/|\ba\s+(?:remote\s+)?(?:server|endpoint|url|webhook)\b|\bthis\s+(?:url|endpoint)\b)/i,
    skip: notNegated,
  },
  {
    rule: "AA-X05",
    severity: "medium",
    title: "DNS lookup built from interpolated data",
    why: "Data placed in a hostname leaves the machine in DNS queries, which most firewalls allow.",
    fix: "Use fixed hostnames, and send data only through a documented API.",
    scope: "code",
    quotable: true,
    re: /\b(?:nslookup|dig|dns\.(?:lookup|resolve\w*)|dnsPromises\.\w+|Resolve-DnsName)\b[^\n]*(?:\$\{?\w|\$\(|`[^`]*\$\{|\+\s*\w|\{\w+\}|\bf["'])/i,
  },
];

export const exfiltrationRules: Rule[] = [(ctx) => runPatterns(ctx, patterns)];
