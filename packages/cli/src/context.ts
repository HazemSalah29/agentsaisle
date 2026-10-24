import { confirm, isCancel, text } from "@clack/prompts";
import { AGENTS, detectAgent, parseAgent, type AgentId } from "./agents.js";
import { CliError } from "./errors.js";

export interface CommonOptions {
  global?: boolean;
  agent?: string;
  yes?: boolean;
  dryRun?: boolean;
  /** Allow installing a skill with critical audit findings (still needs the typed name). */
  force?: boolean;
  /** commander sets this to false for `--no-audit`. */
  audit?: boolean;
}

export interface Context {
  cwd: string;
  agent: AgentId;
  global: boolean;
  yes: boolean;
  dryRun: boolean;
  force: boolean;
  /** False under `--no-audit`: the install guard is skipped, with a warning. */
  audit: boolean;
  /** Ask a yes/no question. `--yes` answers yes; no TTY without `--yes` is an error. */
  confirm(message: string): Promise<boolean>;
  /**
   * Make the user type `expected`. `--yes` never answers this. Without a terminal it fails,
   * because there is nobody to type.
   */
  typed(message: string, expected: string): Promise<boolean>;
  log(line?: string): void;
  warn(line: string): void;
}

export function createContext(opts: CommonOptions, cwd = process.cwd()): Context {
  const yes = opts.yes === true;
  return {
    cwd,
    agent: opts.agent ? parseAgent(opts.agent) : detectAgent(cwd),
    global: opts.global === true,
    yes,
    dryRun: opts.dryRun === true,
    force: opts.force === true,
    audit: opts.audit !== false,
    async confirm(message) {
      if (yes) return true;
      if (!process.stdin.isTTY) {
        throw new CliError(`${message}\nNot running in a terminal. Re-run with --yes to confirm.`);
      }
      const answer = await confirm({ message });
      if (isCancel(answer)) throw new CliError("Cancelled.");
      return answer;
    },
    async typed(message, expected) {
      if (!process.stdin.isTTY) {
        throw new CliError(
          `${message}\nNot running in a terminal, so the name cannot be typed. Nothing was installed.`,
        );
      }
      const answer = await text({ message: `${message} Type "${expected}" to continue` });
      if (isCancel(answer)) throw new CliError("Cancelled.");
      return String(answer).trim() === expected;
    },
    log: (line = "") => console.log(line),
    warn: (line) => console.warn(line),
  };
}

export { AGENTS };
