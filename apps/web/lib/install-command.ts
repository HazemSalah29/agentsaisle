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
