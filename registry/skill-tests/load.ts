import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const official = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "official");

/** Absolute path of a file inside an official skill, for tests that run a script as a process. */
export const skillFile = (skill: string, rel: string) => path.join(official, skill, rel);

/** Import a skill's .mjs script as a module. Typed by each test with the shape it expects. */
export async function loadScript<T>(skill: string, rel: string): Promise<T> {
  return (await import(pathToFileURL(skillFile(skill, rel)).href)) as T;
}
