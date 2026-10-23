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
let newerRegistryFile: string;
let noRulesRegistryFile: string;

const skill = (
  name: string,
  skillPath: string,
  runsScripts = false,
  verified = true,
  source: "official" | "community" = "official",
) => ({
  name,
  description: `Test skill ${name}.`,
  source,
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
      "skills/trusted/SKILL.md": skillMd("trusted"),
      "skills/trusted/scripts/check.mjs": "console.log('checked')\n",
      "skills/shared/SKILL.md": skillMd("shared"),
      "skills/shared/scripts/check.mjs": "console.log('checked')\n",
    }),
  );
  const index: RegistryIndex = {
    generatedAt: "2026-01-01T00:00:00.000Z",
    questions: [],
    houseRules: "## Test rules\n- Be brief.",
    profiles: [
      { id: "starter", name: "Starter", description: "Basics", skills: ["explore"] },
      {
        id: "mixed",
        name: "Mixed",
        description: "With a script skill",
        skills: ["explore", "risky"],
      },
    ],
    skills: [
      skill("explore", "registry/official/explore"),
      skill("risky", "skills/risky", false, false),
      skill("trusted", "skills/trusted", true, true, "official"),
      skill("shared", "skills/shared", true, true, "community"),
      skill("mismatch", "skills/mismatch"),
    ],
  };
  const newer: RegistryIndex = {
    ...index,
    skills: index.skills.map((sk) =>
      sk.name === "explore"
        ? { ...sk, latest: "1.1.0", versions: [{ version: "1.1.0", sha: SHA }, ...sk.versions] }
        : sk,
    ),
  };
  noRulesRegistryFile = path.join(await tmpDir(), "registry.json");
  await writeFile(noRulesRegistryFile, JSON.stringify({ ...index, houseRules: undefined }));
  newerRegistryFile = path.join(await tmpDir(), "registry.json");
  await writeFile(newerRegistryFile, JSON.stringify(newer));
  registryFile = path.join(await tmpDir(), "registry.json");
  await writeFile(registryFile, JSON.stringify(index));
});

afterAll(() => server.close());

async function aisle(cwd: string, args: string[], home?: string, registry = registryFile) {
  try {
    const { stdout, stderr } = await run(process.execPath, ["--import", tsx, entry, ...args], {
      cwd,
      env: {
        ...process.env,
        AISLE_REGISTRY: registry,
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

  it("lists scripts of a verified official skill without asking", async () => {
    const project = await tmpDir();
    const res = await aisle(project, ["add", "trusted"]); // no --yes and no terminal: a prompt would fail
    expect(res.code, res.stderr).toBe(0);
    expect(res.stdout).toContain("trusted includes scripts (reviewed by Agent Aisle):");
    expect(res.stdout).toContain("- scripts/check.mjs");
    expect(res.stderr).not.toContain("Warning");
    expect(
      existsSync(path.join(project, ".claude", "skills", "trusted", "scripts", "check.mjs")),
    ).toBe(true);
  });

  it("still asks about scripts for community skills, even verified ones", async () => {
    const project = await tmpDir();
    const refused = await aisle(project, ["add", "shared"]);
    expect(refused.code).toBe(1);
    expect(refused.stderr).toContain("scripts/check.mjs");
    expect(refused.stderr).toContain("--yes");
    expect(existsSync(path.join(project, ".claude"))).toBe(false);
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

  it("init installs a profile's bundle and records it in the lockfile", async () => {
    const project = await tmpDir();
    const res = await aisle(project, ["init", "--profile", "starter", "--yes"]);
    expect(res.code, res.stderr).toBe(0);
    expect(res.stdout).toContain("Starter: Basics");
    expect(res.stdout).toContain("Installed explore@1.0.0");
    expect(existsSync(path.join(project, ".claude", "skills", "explore", "SKILL.md"))).toBe(true);
    expect(Object.keys((await lock(project)).skills)).toEqual(["explore"]);
  });

  it("init --dry-run writes nothing", async () => {
    const project = await tmpDir();
    const res = await aisle(project, ["init", "--profile", "mixed", "--dry-run"]);
    expect(res.code, res.stderr).toBe(0);
    expect(res.stdout).toContain("[dry-run] would install explore");
    expect(res.stdout).toContain("[dry-run] would install risky");
    expect(await readdir(project)).toEqual([]);
  });

  it("init still warns about scripts inside a bundle", async () => {
    const project = await tmpDir();
    const refused = await aisle(project, ["init", "--profile", "mixed"]);
    expect(refused.code).toBe(1);
    expect(refused.stderr).toContain("--yes");
    const ok = await aisle(project, ["init", "--profile", "mixed", "--yes"]);
    expect(ok.code, ok.stderr).toBe(0);
    expect(ok.stderr).toContain("scripts/run.sh");
    expect(existsSync(path.join(project, ".claude", "skills", "risky"))).toBe(true);
  });

  it("init fails clearly for an unknown profile, and without a terminal or --profile", async () => {
    const project = await tmpDir();
    const unknown = await aisle(project, ["init", "--profile", "starte", "--yes"]);
    expect(unknown.code).toBe(1);
    expect(unknown.stderr).toContain("Did you mean: starter");
    const noProfile = await aisle(project, ["init"]);
    expect(noProfile.code).toBe(1);
    expect(noProfile.stderr).toContain("Pass --profile <id>");
    expect(noProfile.stderr).toContain("starter, mixed");
  });

  it("search ranks matches, lists trust labels and suggests an install", async () => {
    const project = await tmpDir();
    const res = await aisle(project, ["search", "explore"]);
    expect(res.code, res.stderr).toBe(0);
    expect(res.stdout).toContain("explore  v1.0.0  official");
    expect(res.stdout).toContain("Install one with: aisle add explore");

    const all = await aisle(project, ["search", "test", "skill"]);
    expect(all.stdout).toContain("risky  v1.0.0  official");
    expect(all.stdout).toContain("mismatch  v1.0.0  official");

    const none = await aisle(project, ["search", "zzz-nothing"]);
    expect(none.code).toBe(0);
    expect(none.stdout).toContain('No skills match "zzz-nothing"');
  });

  it("update moves an installed skill to the latest version", async () => {
    const project = await tmpDir();
    await aisle(project, ["add", "explore@1.0.0"], undefined, newerRegistryFile);
    expect((await lock(project)).skills.explore.version).toBe("1.0.0");

    const dry = await aisle(project, ["update", "--dry-run"], undefined, newerRegistryFile);
    expect(dry.code, dry.stderr).toBe(0);
    expect(dry.stdout).toContain("explore  1.0.0 -> 1.1.0");
    expect(dry.stdout).toContain("[dry-run] would update 1 skill");
    expect((await lock(project)).skills.explore.version).toBe("1.0.0");

    const noTty = await aisle(project, ["update"], undefined, newerRegistryFile);
    expect(noTty.code).toBe(1);
    expect(noTty.stderr).toContain("--yes");

    const done = await aisle(project, ["update", "--yes"], undefined, newerRegistryFile);
    expect(done.code, done.stderr).toBe(0);
    expect(done.stdout).toContain("Installed explore@1.1.0");
    expect((await lock(project)).skills.explore.version).toBe("1.1.0");
    expect(existsSync(path.join(project, ".claude", "skills", "explore", "SKILL.md"))).toBe(true);

    const again = await aisle(project, ["update"], undefined, newerRegistryFile);
    expect(again.code).toBe(0);
    expect(again.stdout).toContain("Everything is up to date.");
    const one = await aisle(project, ["update", "explore"], undefined, newerRegistryFile);
    expect(one.stdout).toContain("explore is already up to date.");
  });

  it("update fails clearly for a skill that isn't installed, and says so when nothing is installed", async () => {
    const project = await tmpDir();
    expect((await aisle(project, ["update"])).stdout).toContain("No skills installed.");
    await aisle(project, ["add", "explore"]);
    const missing = await aisle(project, ["update", "commit"]);
    expect(missing.code).toBe(1);
    expect(missing.stderr).toContain('"commit" is not installed.');
  });

  it("update --global works on the home folder's lockfile", async () => {
    const project = await tmpDir();
    const home = await tmpDir();
    await aisle(project, ["add", "explore@1.0.0", "--global"], home, newerRegistryFile);
    const done = await aisle(project, ["update", "--global", "--yes"], home, newerRegistryFile);
    expect(done.code, done.stderr).toBe(0);
    expect((await lock(home)).skills.explore.version).toBe("1.1.0");
    expect(existsSync(path.join(project, ".claude"))).toBe(false);
  });

  describe("init and the house rules block", () => {
    const START = "<!-- agent-aisle:start -->";
    const count = (text: string) => text.split(START).length - 1;
    const read = (file: string) => readFile(file, "utf8");

    it("writes the block, and a second run leaves exactly one block and identical bytes", async () => {
      const project = await tmpDir();
      const claude = path.join(project, "CLAUDE.md");
      await writeFile(claude, "# My project\n\nKeep this text.\n");

      const first = await aisle(project, ["init", "--profile", "starter", "--yes"]);
      expect(first.code, first.stderr).toBe(0);
      expect(first.stdout).toContain("Installed explore@1.0.0");
      expect(first.stdout).toMatch(/Wrote house rules to .*CLAUDE\.md \(added the block\)/);
      const afterFirst = await read(claude);
      expect(afterFirst.startsWith("# My project\n\nKeep this text.\n")).toBe(true);
      expect(afterFirst).toContain("## Test rules");
      expect(count(afterFirst)).toBe(1);

      const second = await aisle(project, ["init", "--profile", "starter", "--yes"]);
      expect(second.code, second.stderr).toBe(0);
      expect(second.stdout).toContain("already up to date");
      expect(await read(claude)).toBe(afterFirst);
      expect(count(await read(claude))).toBe(1);
    });

    it("--no-rules installs the bundle without touching CLAUDE.md", async () => {
      const project = await tmpDir();
      const res = await aisle(project, ["init", "--profile", "starter", "--yes", "--no-rules"]);
      expect(res.code, res.stderr).toBe(0);
      expect(existsSync(path.join(project, ".claude", "skills", "explore"))).toBe(true);
      expect(existsSync(path.join(project, "CLAUDE.md"))).toBe(false);
    });

    it("--rules-only writes the block and installs no skills", async () => {
      const project = await tmpDir();
      const res = await aisle(project, ["init", "--rules-only", "--yes"]);
      expect(res.code, res.stderr).toBe(0);
      expect(count(await read(path.join(project, "CLAUDE.md")))).toBe(1);
      expect(existsSync(path.join(project, ".claude"))).toBe(false);
      expect(existsSync(path.join(project, "aisle-lock.json"))).toBe(false);
    });

    it("rejects --rules-only together with --no-rules", async () => {
      const res = await aisle(await tmpDir(), ["init", "--rules-only", "--no-rules", "--yes"]);
      expect(res.code).toBe(1);
      expect(res.stderr).toContain("can't be used together");
    });

    it("--dry-run reports what it would do and writes nothing", async () => {
      const project = await tmpDir();
      const res = await aisle(project, ["init", "--profile", "starter", "--dry-run"]);
      expect(res.code, res.stderr).toBe(0);
      expect(res.stdout).toContain("[dry-run] would install explore");
      expect(res.stdout).toContain("[dry-run] would create");
      expect(await readdir(project)).toEqual([]);
    });

    it("writes AGENTS.md for Codex and Cursor", async () => {
      for (const agent of ["codex", "cursor"]) {
        const project = await tmpDir();
        const res = await aisle(project, ["init", "--rules-only", "--yes", "--agent", agent]);
        expect(res.code, res.stderr).toBe(0);
        expect(count(await read(path.join(project, "AGENTS.md")))).toBe(1);
        expect(existsSync(path.join(project, "CLAUDE.md"))).toBe(false);
      }
    });

    it("writes ~/.claude/CLAUDE.md with --global, and refuses --global for Cursor", async () => {
      const project = await tmpDir();
      const home = await tmpDir();
      const ok = await aisle(project, ["init", "--rules-only", "--yes", "--global"], home);
      expect(ok.code, ok.stderr).toBe(0);
      expect(count(await read(path.join(home, ".claude", "CLAUDE.md")))).toBe(1);
      expect(await readdir(project)).toEqual([]);

      const cursor = await aisle(
        project,
        ["init", "--rules-only", "--yes", "--global", "--agent", "cursor"],
        home,
      );
      expect(cursor.code).toBe(1);
      expect(cursor.stderr).toContain("no user-level rules file");
    });

    it("refuses a damaged file and leaves it unchanged", async () => {
      const project = await tmpDir();
      const claude = path.join(project, "CLAUDE.md");
      const damaged = `# Mine\n${START}\nhalf a block\n`;
      await writeFile(claude, damaged);
      const res = await aisle(project, ["init", "--rules-only", "--yes"]);
      expect(res.code).toBe(1);
      expect(res.stderr).toContain("start marker without a matching end marker");
      expect(await read(claude)).toBe(damaged);
    });

    it("fails before installing anything when the registry has no house rules", async () => {
      const project = await tmpDir();
      const res = await aisle(
        project,
        ["init", "--profile", "starter", "--yes"],
        undefined,
        noRulesRegistryFile,
      );
      expect(res.code).toBe(1);
      expect(res.stderr).toContain("no house rules yet");
      expect(await readdir(project)).toEqual([]);
      const skipped = await aisle(
        project,
        ["init", "--profile", "starter", "--yes", "--no-rules"],
        undefined,
        noRulesRegistryFile,
      );
      expect(skipped.code, skipped.stderr).toBe(0);
    });

    it("needs --yes when there is no terminal", async () => {
      const res = await aisle(await tmpDir(), ["init", "--rules-only"]);
      expect(res.code).toBe(1);
      expect(res.stderr).toContain("--yes");
    });
  });
});
