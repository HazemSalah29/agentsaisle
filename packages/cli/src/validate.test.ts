import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { skillMd, tmpDir } from "./test-utils.js";
import { findScripts, validateSkill } from "./validate.js";

async function skillDir(md?: string) {
  const dir = await tmpDir();
  if (md !== undefined) await writeFile(path.join(dir, "SKILL.md"), md);
  return dir;
}

describe("validateSkill", () => {
  it("accepts a valid skill", async () => {
    expect((await validateSkill(await skillDir(skillMd("ok")), "ok")).name).toBe("ok");
  });
  it("fails loudly on missing, malformed or mismatched SKILL.md", async () => {
    await expect(validateSkill(await skillDir())).rejects.toThrow(/SKILL.md not found/);
    await expect(validateSkill(await skillDir("# no frontmatter"))).rejects.toThrow(
      /no frontmatter/,
    );
    await expect(validateSkill(await skillDir("---\nname: x\n---\n"))).rejects.toThrow(
      /frontmatter is invalid/,
    );
    await expect(validateSkill(await skillDir(skillMd("a")), "b")).rejects.toThrow(
      /does not match "b"/,
    );
  });
});

describe("findScripts", () => {
  it("lists files under scripts/ recursively", async () => {
    const dir = await skillDir(skillMd("s"));
    await mkdir(path.join(dir, "scripts", "lib"), { recursive: true });
    await writeFile(path.join(dir, "scripts", "run.sh"), "");
    await writeFile(path.join(dir, "scripts", "lib", "a.py"), "");
    expect(await findScripts(dir)).toEqual(["scripts/lib/a.py", "scripts/run.sh"]);
    expect(await findScripts(await skillDir())).toEqual([]);
  });
});
