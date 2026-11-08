export const CLI_PACKAGE = "@agentsaisle/cli";

/** One-line install command. The latest version (or none) gives the plain form. */
export function installCommand(name: string, version?: string, latest?: string): string {
  const pinned = version && version !== latest ? `@${version}` : "";
  return `npx ${CLI_PACKAGE} add ${name}${pinned}`;
}

/** One command that installs several skills. */
export function bundleCommand(names: string[]): string {
  return `npx ${CLI_PACKAGE} add ${names.join(" ")}`;
}

/** The command that installs a starter bundle through the CLI. */
export function initCommand(profileId: string): string {
  return `npx ${CLI_PACKAGE} init --profile ${profileId}`;
}

export type ManageAction = "add" | "update" | "remove";

/** The command to add, update or remove one skill. `everywhere` installs for every project (`--global`). */
export function manageCommand(action: ManageAction, name: string, everywhere = false): string {
  return `npx ${CLI_PACKAGE} ${action} ${name}${everywhere ? " --global" : ""}`;
}
