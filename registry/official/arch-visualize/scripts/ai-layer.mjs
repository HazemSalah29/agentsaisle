// The AI layer, read as text: MCP server configs and SKILL.md folders. Only names and tool lists are kept; a
// config's commands, arguments and environment values are never read into the model.
import { findLine } from "./_lib.mjs";

/** Names of the servers in an MCP config (`.mcp.json`, `mcp.json`): [{ name, line }]. */
export function readMcp(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return [];
  }
  const servers = data && typeof data === "object" ? (data.mcpServers ?? data.servers) : null;
  if (!servers || typeof servers !== "object" || Array.isArray(servers)) return [];
  return Object.keys(servers)
    .sort()
    .map((name) => ({
      name,
      line: findLine(text, new RegExp(`"${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"\\s*:`)),
    }));
}

/** Split `Read Write Bash(node *)` or `Read, Write` into tool names, keeping a parenthesised argument whole. */
export function splitTools(value) {
  const out = [];
  let cur = "";
  let depth = 0;
  for (const ch of String(value)) {
    if (ch === "(") depth++;
    if (ch === ")") depth = Math.max(0, depth - 1);
    if ((ch === " " || ch === ",") && depth === 0) {
      if (cur) out.push(cur);
      cur = "";
    } else cur += ch;
  }
  if (cur) out.push(cur);
  return out.filter((t) => t.length <= 40).slice(0, 20);
}

/** The name and allowed tools from a SKILL.md frontmatter: { name, tools, line } or null. */
export function readSkill(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!m) return null;
  const name = /^name:\s*["']?([\w.-]+)["']?\s*$/m.exec(m[1]);
  if (!name) return null;
  const tools = /^allowed-tools:\s*(.+)$/m.exec(m[1]);
  return {
    name: name[1],
    tools: tools ? splitTools(tools[1].replace(/^["']|["']$/g, "")) : [],
    line: tools ? findLine(text, /^allowed-tools:/) : findLine(text, /^name:/),
  };
}
