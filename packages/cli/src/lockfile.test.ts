import { writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { readLockfile, removeLockEntry, upsertLockEntry } from "./lockfile.js";
import { SHA, tmpDir } from "./test-utils.js";

const entry = (name: string, version = "1.0.0") => ({
  name,
  version,
  repo: "a/b",
  path: `skills/${name}`,
  sha: SHA,
  installedAt: "2026-01-01T00:00:00.000Z",
});

describe("lockfile", () => {
  it("is empty when missing", async () => {
    const file = path.join(await tmpDir(), "aisle-lock.json");
    expect(await readLockfile(file)).toEqual({ lockfileVersion: 1, skills: {} });
  });
  it("upserts, sorts and removes entries", async () => {
    const file = path.join(await tmpDir(), "aisle-lock.json");
    await upsertLockEntry(file, entry("zeta"));
    await upsertLockEntry(file, entry("alpha"));
    await upsertLockEntry(file, entry("zeta", "2.0.0"));
    const lock = await readLockfile(file);
    expect(Object.keys(lock.skills)).toEqual(["alpha", "zeta"]);
    expect(lock.skills.zeta?.version).toBe("2.0.0");
    expect(await removeLockEntry(file, "alpha")).toBe(true);
    expect(await removeLockEntry(file, "alpha")).toBe(false);
    expect(Object.keys((await readLockfile(file)).skills)).toEqual(["zeta"]);
  });
  it("fails clearly on a corrupt file", async () => {
    const file = path.join(await tmpDir(), "aisle-lock.json");
    await writeFile(file, "{nope");
    await expect(readLockfile(file)).rejects.toThrow(/corrupt/);
  });
});
