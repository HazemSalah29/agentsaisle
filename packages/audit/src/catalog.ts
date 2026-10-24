import type { AuditSeverity } from "@agentsaisle/registry-schema";

/**
 * Every audit rule with its default severity and a one-line description. Pure data: the website's
 * /audit page reads it, so the page and the scanner cannot drift. A test checks that every rule id
 * a fixture can trigger is listed here and that every id here exists in the code.
 */
export interface RuleInfo {
  id: string;
  severity: AuditSeverity;
  title: string;
}

export interface RuleGroup {
  prefix: string;
  name: string;
  rules: RuleInfo[];
}

const r = (id: string, severity: AuditSeverity, title: string): RuleInfo => ({
  id,
  severity,
  title,
});

export const RULE_GROUPS: RuleGroup[] = [
  {
    prefix: "S",
    name: "Structure",
    rules: [
      r("AA-S01", "high", "No SKILL.md, or frontmatter missing or invalid"),
      r(
        "AA-S02",
        "medium",
        "Name does not match the folder or spec format; description missing or too long",
      ),
      r("AA-S03", "critical", "Symlink in the skill, or a path escaping the folder"),
      r("AA-S04", "high", "Executable binaries or compiled files"),
      r("AA-S05", "medium", "Minified or obfuscated scripts"),
      r("AA-S06", "low", "SKILL.md over 500 lines, or references nested more than one level"),
      r("AA-S07", "low", "Hidden files or folders"),
      r(
        "AA-S08",
        "medium",
        "Invalid .aisleaudit.yaml, or an attempt to suppress a critical finding",
      ),
      r("AA-S09", "info", "Oversized media file skipped in a local folder"),
    ],
  },
  {
    prefix: "P",
    name: "Permissions",
    rules: [
      r("AA-P01", "high", "Unrestricted Bash in allowed-tools"),
      r("AA-P02", "medium", "Broad write plus shell without disable-model-invocation"),
      r("AA-P03", "high", "Hooks that run commands automatically on agent events"),
      r("AA-P04", "high", "Commands that run when the skill loads"),
      r("AA-P05", "medium", "Unrestricted web fetching combined with file reading"),
      r("AA-P06", "info", "Inventory of tools, scripts and URLs"),
    ],
  },
  {
    prefix: "I",
    name: "Prompt injection",
    rules: [
      r("AA-I01", "high", 'Override language such as "ignore previous instructions"'),
      r("AA-I02", "high", "Concealment from the user"),
      r("AA-I03", "critical", "Instructions to weaken agent safety settings"),
      r("AA-I04", "medium", "Instructions hidden in comments, collapsed sections or alt text"),
      r("AA-I05", "medium", "Long base64 or hex blobs in instruction files"),
      r("AA-I06", "high", "Instructions to fetch and follow remote instructions"),
    ],
  },
  {
    prefix: "X",
    name: "Exfiltration",
    rules: [
      r("AA-X01", "critical", "Reading credential stores"),
      r("AA-X02", "critical", "Environment variables or .env contents sent over the network"),
      r("AA-X03", "high", "Uploads to paste, webhook or tunnel services"),
      r("AA-X04", "high", "Instructions to send code, files or conversation to an external URL"),
      r("AA-X05", "medium", "DNS-based exfiltration patterns"),
    ],
  },
  {
    prefix: "E",
    name: "Dangerous execution",
    rules: [
      r("AA-E01", "critical", "Download and run"),
      r("AA-E02", "critical", "Decode and run"),
      r("AA-E03", "high", "Destructive commands"),
      r("AA-E04", "high", "Persistence (shell rc files, cron, launch agents, services)"),
      r("AA-E05", "high", "Privilege escalation"),
      r("AA-E06", "medium", "Installing unpinned or remote packages in scripts"),
      r("AA-E07", "medium", "Dynamic code execution in scripts"),
    ],
  },
  {
    prefix: "N",
    name: "Network",
    rules: [
      r("AA-N01", "low", "Plain http:// URL"),
      r("AA-N02", "medium", "URL shortener or raw IP address"),
      r("AA-N03", "info", "Inventory of referenced domains"),
    ],
  },
  { prefix: "K", name: "Secrets", rules: [r("AA-K01", "high", "Hardcoded secret")] },
  {
    prefix: "U",
    name: "Hidden characters",
    rules: [
      r("AA-U01", "critical", "Unicode tag characters (invisible instructions)"),
      r("AA-U02", "high", "Bidirectional controls in scripts (Trojan Source)"),
      r(
        "AA-U03",
        "medium",
        "Bidirectional controls in instruction files outside Arabic or Hebrew text",
      ),
      r("AA-U04", "medium", "Zero-width characters inside Latin words, or clustered"),
    ],
  },
];

export const RULES: RuleInfo[] = RULE_GROUPS.flatMap((g) => g.rules);

export const ruleInfo = (id: string): RuleInfo | undefined => RULES.find((x) => x.id === id);

/** How the grade is worked out, in the words the website shows. */
export const GRADES: Array<{ grade: string; meaning: string }> = [
  { grade: "A", meaning: "No findings above low." },
  { grade: "B", meaning: "Medium findings only." },
  { grade: "C", meaning: "One or two high findings." },
  { grade: "D", meaning: "Three or more high findings." },
  { grade: "F", meaning: "Any critical finding." },
];
