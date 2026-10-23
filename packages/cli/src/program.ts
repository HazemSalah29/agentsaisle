import { Command } from "commander";

export const VERSION = "0.0.0";

const NOT_IMPLEMENTED = "Not implemented yet (coming in Milestone 2).";

export function createProgram(): Command {
  const program = new Command("aisle")
    .description("Install Agent Skills into your project")
    .version(VERSION, "-v, --version");

  const stub = (name: string, args: string, description: string) =>
    program
      .command(`${name} ${args}`.trim())
      .description(description)
      .action(() => {
        console.error(NOT_IMPLEMENTED);
        process.exitCode = 1;
      });

  stub("add", "<skills...>", "Install one or more skills");
  stub("remove", "<name>", "Remove an installed skill");
  stub("list", "", "List installed skills");
  stub("search", "<query>", "Search the registry");
  stub("update", "[name]", "Update one or all skills");
  stub("info", "<name>", "Show details for a skill");
  stub("init", "", "Pick a profile and install its starter bundle");

  return program;
}
