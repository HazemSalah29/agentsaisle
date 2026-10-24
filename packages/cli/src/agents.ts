import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { CliError } from "./errors.js";

export const AGENT_IDS = ["claude-code", "codex", "cursor"] as const;
export type AgentId = (typeof AGENT_IDS)[number];

/** Skill folders per agent, relative to the project root or the home directory. */
export const AGENTS: Record<AgentId, { project: string[]; global: string[] }> = {
  "claude-code": { project: [".claude", "skills"], global: [".claude", "skills"] },
  // TODO(verify): confirm against current Codex docs before release.
  codex: { project: [".codex", "skills"], global: [".codex", "skills"] },
  // TODO(verify): confirm against current Cursor docs before release.
  cursor: { project: [".cursor", "skills"], global: [".cursor", "skills"] },
};

export function parseAgent(value: string): AgentId {
  if ((AGENT_IDS as readonly string[]).includes(value)) return value as AgentId;
  throw new CliError(`Unknown agent "${value}". Choose one of: ${AGENT_IDS.join(", ")}.`);
}

/** Detect the agent from marker folders in the project; fall back to claude-code. */
export function detectAgent(cwd: string): AgentId {
  for (const id of AGENT_IDS) {
    const [dir] = AGENTS[id].project;
    if (dir && existsSync(path.join(cwd, dir))) return id;
  }
  return "claude-code";
}

export interface TargetOptions {
  agent: AgentId;
  global: boolean;
  cwd: string;
  home?: string;
}

/** The folder that holds all installed skills for this agent. */
export function skillsRoot({ agent, global, cwd, home }: TargetOptions): string {
  const base = global ? (home ?? os.homedir()) : cwd;
  return path.join(base, ...AGENTS[agent][global ? "global" : "project"]);
}

export function targetDir(name: string, opts: TargetOptions): string {
  return path.join(skillsRoot(opts), name);
}

/** The lockfile lives in the project root, or in the home directory for --global. */
export function lockfilePath(opts: Pick<TargetOptions, "global" | "cwd" | "home">): string {
  return path.join(opts.global ? (opts.home ?? os.homedir()) : opts.cwd, "aisle-lock.json");
}

/**
 * The file that holds always-on rules for an agent: CLAUDE.md for Claude Code, AGENTS.md for the
 * others. Globally, Claude Code reads ~/.claude/CLAUDE.md.
 */
export function rulesFile({ agent, global, cwd, home }: TargetOptions): string {
  const base = home ?? os.homedir();
  if (agent === "claude-code") {
    return global ? path.join(base, ".claude", "CLAUDE.md") : path.join(cwd, "CLAUDE.md");
  }
  if (agent === "codex") {
    // TODO(verify): confirm the user-level Codex instructions file against current docs.
    return global ? path.join(base, ".codex", "AGENTS.md") : path.join(cwd, "AGENTS.md");
  }
  // TODO(verify): confirm Cursor's AGENTS.md support and whether it has a user-level file.
  if (global) {
    throw new CliError("Cursor has no user-level rules file. Run aisle init without --global.");
  }
  return path.join(cwd, "AGENTS.md");
}
