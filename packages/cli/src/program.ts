import { Command } from "commander";
import { removeSkill, listSkills, showInfo } from "./commands.js";
import { createContext, type CommonOptions } from "./context.js";
import { initProfile } from "./init.js";
import { installMany } from "./install.js";

export const VERSION = "0.0.0";

const NOT_IMPLEMENTED = "Not implemented yet.";

export function createProgram(): Command {
  const program = new Command("aisle")
    .description("Install Agent Skills into your project")
    .version(VERSION, "-v, --version");

  const withFlags = (cmd: Command, flags: Array<"global" | "agent" | "yes" | "dry-run">) => {
    if (flags.includes("global")) cmd.option("-g, --global", "use the user-level skills folder");
    if (flags.includes("agent"))
      cmd.option("--agent <agent>", "claude-code, codex or cursor (default: detect)");
    if (flags.includes("yes")) cmd.option("-y, --yes", "skip confirmation prompts");
    if (flags.includes("dry-run"))
      cmd.option("--dry-run", "show what would happen without changing anything");
    return cmd;
  };

  withFlags(
    program
      .command("add <skills...>")
      .description("Install skills: <name>[@version] or <owner>/<repo>[/path][@ref]")
      .action((skills: string[], opts: CommonOptions) => installMany(skills, createContext(opts))),
    ["global", "agent", "yes", "dry-run"],
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
      .description("Pick a profile and install its starter bundle")
      .option("--profile <id>", "install this profile without asking")
      .action((opts: CommonOptions & { profile?: string }) =>
        initProfile(opts.profile, createContext(opts)),
      ),
    ["global", "agent", "yes", "dry-run"],
  );
  program
    .command("info <name>")
    .description("Show details for a skill")
    .action((name: string) => showInfo(name, createContext({})));

  const stub = (name: string, args: string, description: string) =>
    program
      .command(`${name} ${args}`.trim())
      .description(description)
      .action(() => {
        console.error(NOT_IMPLEMENTED);
        process.exitCode = 1;
      });
  stub("search", "<query>", "Search the registry");
  stub("update", "[name]", "Update one or all skills");

  return program;
}
