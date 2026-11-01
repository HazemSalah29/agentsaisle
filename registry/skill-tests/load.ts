import { readFileSync } from "node:fs";
import vm from "node:vm";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const official = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "official");

/** Absolute path of a file inside an official skill, for tests that run a script as a process. */
export const skillFile = (skill: string, rel: string) => path.join(official, skill, rel);

/** Import a skill's .mjs script as a module. Typed by each test with the shape it expects. */
export async function loadScript<T>(skill: string, rel: string): Promise<T> {
  return (await import(pathToFileURL(skillFile(skill, rel)).href)) as T;
}

/**
 * Run a skill's plain browser scripts (assets/lib/*.js, written without a module system so the page and the
 * tests run the same bytes) in a fresh context and return what they put on the global object.
 */
export function loadLib<T>(skill: string, files: string[]): T {
  const context = vm.createContext({});
  for (const f of files) vm.runInContext(readFileSync(skillFile(skill, f), "utf8"), context);
  return context as T;
}
