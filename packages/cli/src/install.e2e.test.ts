import type { RegistryIndex } from "@agentsaisle/registry-schema";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SHA, makeTarball, serveTarball, skillMd, tmpDir } from "./test-utils.js";

const run = promisify(execFile);
const here = path.dirname(fileURLToPath(import.meta.url));
const entry = path.join(here, "index.ts");
const tsx = pathToFileURL(createRequire(import.meta.url).resolve("tsx")).href;
const exploreMd = path.resolve(here, "../../../registry/official/explore/SKILL.md");

let server: Awaited<ReturnType<typeof serveTarball>>;
let registryFile: string;

const skill = (name: string, skillPath: string, runsScripts = false, verified = true) => ({
  name,
  description: `Test skill ${name}.`,
  source: "official" as const,
  author: "test",
  repo: "o/r",
  path: skillPath,
  latest: "1.0.0",
  versions: [{ version: "1.0.0", sha: SHA }],
  category: ["code"],
  clients: ["claude-code" as const],
  runsScripts,
  verified,
});

beforeAll(async () => {
  server = await serveTarball(
    await makeTarball({
      "registry/official/explore/SKILL.md": await readFile(exploreMd, "utf8"),
      "skills/risky/SKILL.md": skillMd("risky"),
      "skills/risky/scripts/run.sh": "echo should never run\n",
      "skills/mismatch/SKILL.md": skillMd("other-name"),
    }),
  );
  const index: RegistryIndex = {
    generatedAt: "2026-01-01T00:00:00.000Z",
    skills: [
      skill("explore", "registry/official/explore"),
      skill("risky", "skills/risky", false, false),
      skill("mismatch", "skills/mismatch"),
    ],
  };
  registryFile = path.join(await tmpDir(), "registry.json");
  await writeFile(registryFile, JSON.stringify(index));
});

afterAll(() => server.close());

async function aisle(cwd: string, args: string[], home?: string) {
  try {
    const { stdout, stderr } = await run(process.execPath, ["--import", tsx, entry, ...args], {
      cwd,
      env: {
        ...process.env,
        AISLE_REGISTRY: registryFile,
        AISLE_CODELOAD_URL: server.url,
        ...(home ? { HOME: home, USERPROFILE: home } : {}),
      },
    });
    return { code: 0, stdout, stderr };
  } catch (e) {
    const err = e as { code: number; stdout: string; stderr: string };
    return { code: err.code, stdout: err.stdout, stderr: err.stderr };
  }
}

const lock = async (dir: string) =>
  JSON.parse(await readFile(path.join(dir, "aisle-lock.json"), "utf8"));

describe("aisle CLI (end to end, no network)", () => {
  it("installs a pinned official skill, writes the lockfile, then removes it", async () => {
    const project = await tmpDir();
    const res = await aisle(project, ["add", "explore@1.0.0"]);
    expect(res.code, res.stderr).toBe(0);
    expect(res.stdout).toContain("Installed explore@1.0.0");
    expect(res.stdout).toContain("/explore");

    const dir = path.join(project, ".claude", "skills", "explore");
    expect(await readFile(path.join(dir, "SKILL.md"), "utf8")).toContain("name: explore");
    const entry = (await lock(project)).skills.explore;
    expect(entry).toMatchObject({ name: "explore", version: "1.0.0", repo: "o/r", sha: SHA });
    expect(Date.parse(entry.installedAt)).not.toBeNaN();

    const list = await aisle(project, ["list"]);
    expect(list.stdout).toMatch(/explore\s+1\.0\.0/);

    const removed = await aisle(project, ["remove", "explore", "--yes"]);
    expect(removed.code, removed.stderr).toBe(0);
    expect(existsSync(dir)).toBe(false);
    expect((await lock(project)).skills).toEqual({});
  });

  it("--dry-run changes nothing", async () => {
    const project = await tmpDir();
    const res = await aisle(project, ["add", "explore", "--dry-run"]);
    expect(res.code).toBe(0);
    expect(res.stdout).toContain("[dry-run]");
    expect(await readdir(project)).toEqual([]);
  });

  it("--global installs under the home folder", async () => {
    const project = await tmpDir();
    const home = await tmpDir();
    const res = await aisle(project, ["add", "explore", "--global"], home);
    expect(res.code, res.stderr).toBe(0);
    expect(existsSync(path.join(home, ".claude", "skills", "explore", "SKILL.md"))).toBe(true);
    expect(existsSync(path.join(project, ".claude"))).toBe(false);
  });

  it("warns about scripts, needs confirmation, and never executes them", async () => {
    const project = await tmpDir();
    const refused = await aisle(project, ["add", "risky"]);
    expect(refused.code).toBe(1);
    expect(refused.stderr).toContain("scripts/run.sh");
    expect(refused.stderr).toContain("--yes");
    expect(existsSync(path.join(project, ".claude"))).toBe(false);

    const ok = await aisle(project, ["add", "risky", "--yes"]);
    expect(ok.code, ok.stderr).toBe(0);
    expect(ok.stderr).toContain("not been verified");
    expect(existsSync(path.join(project, ".claude", "skills", "risky", "scripts", "run.sh"))).toBe(
      true,
    );
  });

  it("asks before overwriting", async () => {
    const project = await tmpDir();
    await aisle(project, ["add", "explore"]);
    const res = await aisle(project, ["add", "explore"]);
    expect(res.code).toBe(1);
    expect(res.stderr).toContain("already exists");
    expect((await aisle(project, ["add", "explore", "--yes"])).code).toBe(0);
  });

  it("fails with exit code 1 and suggestions for unknown skills and versions", async () => {
    const project = await tmpDir();
    const unknown = await aisle(project, ["add", "explor"]);
    expect(unknown.code).toBe(1);
    expect(unknown.stderr).toContain("Did you mean: explore");
    const badVersion = await aisle(project, ["add", "explore@9.9.9"]);
    expect(badVersion.code).toBe(1);
    expect(badVersion.stderr).toContain("Available: 1.0.0");
  });

  it("rejects a skill whose SKILL.md name does not match, installing nothing", async () => {
    const project = await tmpDir();
    const res = await aisle(project, ["add", "mismatch", "--yes"]);
    expect(res.code).toBe(1);
    expect(res.stderr).toContain("does not match");
    expect(existsSync(path.join(project, ".claude"))).toBe(false);
  });

  it("shows info", async () => {
    const res = await aisle(await tmpDir(), ["info", "risky"]);
    expect(res.stdout).toContain("risky 1.0.0");
    expect(res.stderr).toContain("not verified");
  });
});
