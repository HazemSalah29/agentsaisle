import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll } from "vitest";
import type { FileSpec } from "./cases.js";

const made: string[] = [];
afterAll(() => {
  for (const d of made) rmSync(d, { recursive: true, force: true });
});

/** Build a skill folder named `name` in a temp dir from a file map. */
export function makeSkill(name: string, files: Record<string, FileSpec>): string {
  const parent = mkdtempSync(path.join(os.tmpdir(), "aisle-audit-test-"));
  made.push(parent);
  const dir = path.join(parent, name);
  mkdirSync(dir, { recursive: true });
  for (const [rel, spec] of Object.entries(files)) {
    const file = path.join(dir, rel);
    mkdirSync(path.dirname(file), { recursive: true });
    if (typeof spec === "object" && !Buffer.isBuffer(spec)) symlinkSync(spec.symlink, file);
    else writeFileSync(file, spec);
  }
  return dir;
}
