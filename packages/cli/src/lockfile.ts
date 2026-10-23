import { LockFile, type LockEntry } from "@agentsaisle/registry-schema";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { CliError } from "./errors.js";

const empty = (): LockFile => ({ lockfileVersion: 1, skills: {} });

export async function readLockfile(file: string): Promise<LockFile> {
  let text: string;
  try {
    text = await readFile(file, "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return empty();
    throw e;
  }
  try {
    return LockFile.parse(JSON.parse(text));
  } catch {
    throw new CliError(`${file} is corrupt. Fix or delete it, then try again.`);
  }
}

export async function writeLockfile(file: string, lock: LockFile): Promise<void> {
  const sorted = Object.fromEntries(
    Object.entries(lock.skills).sort(([a], [b]) => a.localeCompare(b)),
  );
  await mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify({ lockfileVersion: 1, skills: sorted }, null, 2) + "\n");
  await rename(tmp, file);
}

export async function upsertLockEntry(file: string, entry: LockEntry): Promise<void> {
  const lock = await readLockfile(file);
  lock.skills[entry.name] = entry;
  await writeLockfile(file, lock);
}

export async function removeLockEntry(file: string, name: string): Promise<boolean> {
  const lock = await readLockfile(file);
  if (!(name in lock.skills)) return false;
  delete lock.skills[name];
  await writeLockfile(file, lock);
  return true;
}
