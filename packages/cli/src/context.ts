import { confirm, isCancel } from "@clack/prompts";
import { AGENTS, detectAgent, parseAgent, type AgentId } from "./agents.js";
import { CliError } from "./errors.js";

export interface CommonOptions {
  global?: boolean;
  agent?: string;
  yes?: boolean;
  dryRun?: boolean;
}

export interface Context {
  cwd: string;
  agent: AgentId;
  global: boolean;
  yes: boolean;
  dryRun: boolean;
  /** Ask a yes/no question. `--yes` answers yes; no TTY without `--yes` is an error. */
  confirm(message: string): Promise<boolean>;
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
    async confirm(message) {
      if (yes) return true;
      if (!process.stdin.isTTY) {
        throw new CliError(`${message}\nNot running in a terminal. Re-run with --yes to confirm.`);
      }
      const answer = await confirm({ message });
      if (isCancel(answer)) throw new CliError("Cancelled.");
      return answer;
    },
    log: (line = "") => console.log(line),
    warn: (line) => console.warn(line),
  };
}

export { AGENTS };
