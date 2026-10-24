import { Command } from "commander";
import { createRequire } from "node:module";
import { runAudit, type AuditCliOptions } from "./audit.js";
import { loadRegistry } from "./registry.js";
import { removeSkill, listSkills, showInfo } from "./commands.js";
import { createContext, type CommonOptions } from "./context.js";
import { initProfile } from "./init.js";
import { searchRegistry } from "./search.js";
import { updateSkills } from "./update.js";
import { installMany } from "./install.js";

// Read from package.json so the number can't drift. The path is the same from src/ and from dist/.
export const VERSION: string = (
  createRequire(import.meta.url)("../package.json") as { version: string }
).version;

export function createProgram(): Command {
  const program = new Command("aisle")
    .description("Install Agent Skills into your project")
    .version(VERSION, "-v, --version");

  const withFlags = (
    cmd: Command,
    flags: Array<"global" | "agent" | "yes" | "dry-run" | "audit">,
  ) => {
    if (flags.includes("global")) cmd.option("-g, --global", "use the user-level skills folder");
    if (flags.includes("agent"))
      cmd.option("--agent <agent>", "claude-code, codex or cursor (default: detect)");
    if (flags.includes("yes")) cmd.option("-y, --yes", "skip confirmation prompts");
    if (flags.includes("dry-run"))
      cmd.option("--dry-run", "show what would happen without changing anything");
    if (flags.includes("audit")) {
      cmd.option(
        "--force",
        "install despite critical audit findings (you must also type the skill name)",
      );
      cmd.option("--no-audit", "skip the security audit (not recommended)");
    }
    return cmd;
  };

  withFlags(
    program
      .command("add <skills...>")
      .description("Install skills: <name>[@version] or <owner>/<repo>[/path][@ref]")
      .action((skills: string[], opts: CommonOptions) => installMany(skills, createContext(opts))),
    ["global", "agent", "yes", "dry-run", "audit"],
  );
  withFlags(
    program
      .command("remove <name>")
      .description("Delete an installed skill and its lockfile entry")
      .action((name: string, opts: CommonOptions) => removeSkill(name, createContext(opts))),
    ["global", "agent", "yes", "dry-run"],
  );
  withFlags(
    program
      .command("list")
      .description("Show installed skills and whether updates exist")
      .action((opts: CommonOptions) => listSkills(createContext(opts))),
    ["global", "agent"],
  );
  withFlags(
    program
      .command("init")
      .description(
        "Install a starter bundle and add the Agent Aisle house rules to CLAUDE.md or AGENTS.md",
      )
      .option("--profile <id>", "install this profile without asking")
      .option("--no-rules", "do not write the house rules block")
      .option("--rules-only", "only write the house rules block; skip the starter bundle")
      .action((opts: CommonOptions & { profile?: string; rules?: boolean; rulesOnly?: boolean }) =>
        initProfile(opts, createContext(opts)),
      ),
    ["global", "agent", "yes", "dry-run", "audit"],
  );
  program
    .command("info <name>")
    .description("Show details for a skill")
    .action((name: string) => showInfo(name, createContext({})));

  program
    .command("search <query...>")
    .description("Search the registry by name, aisle, author or description")
    .action((words: string[]) => searchRegistry(words.join(" "), createContext({})));
  withFlags(
    program
      .command("update [name]")
      .description("Update one or all installed skills to the latest version")
      .action((name: string | undefined, opts: CommonOptions) =>
        updateSkills(name, createContext(opts)),
      ),
    ["global", "agent", "yes", "dry-run", "audit"],
  );

  program
    .command("audit <target>")
    .description(
      "Scan a skill for risky patterns without running anything: ./folder, <name>[@version] or <owner>/<repo>[/path][@ref]",
    )
    .option("--format <format>", "pretty or json (sarif and markdown come later)", "pretty")
    .option(
      "--fail-on <severity>",
      "critical, high, medium, low or none (sets the exit code)",
      "high",
    )
    .option("--deep", "AI-assisted review (not available yet)")
    .option("--output <file>", "write the full report to a file")
    .option("--quiet", "print a summary line only")
    .action(async (target: string, opts: AuditCliOptions) => {
      process.exitCode = await runAudit(target, opts, () => loadRegistry());
    });

  return program;
}
