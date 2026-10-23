import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { downloadSkill } from "./github.js";
import { SHA, makeTarball, serveTarball, skillMd, tmpDir } from "./test-utils.js";

let close: (() => Promise<void>) | undefined;
afterEach(async () => {
  await close?.();
  close = undefined;
});

async function extract(
  files: Record<string, string>,
  skillPath: string,
  symlinks?: Record<string, string>,
) {
  const server = await serveTarball(await makeTarball(files, { symlinks }));
  close = server.close;
  const dest = path.join(await tmpDir(), "out");
  await downloadSkill({ repo: "o/r", sha: SHA, path: skillPath }, dest, {
    AISLE_CODELOAD_URL: server.url,
  });
  return dest;
}

describe("downloadSkill", () => {
  it("extracts only the skill folder", async () => {
    const dest = await extract(
      {
        "skills/a/SKILL.md": skillMd("a"),
        "skills/a/refs/note.md": "hi",
        "skills/b/SKILL.md": skillMd("b"),
        "README.md": "root",
      },
      "skills/a",
    );
    expect((await readdir(dest)).sort()).toEqual(["SKILL.md", "refs"]);
    expect(await readFile(path.join(dest, "refs", "note.md"), "utf8")).toBe("hi");
  });
  it("does not match sibling folders with the same prefix", async () => {
    const dest = await extract(
      { "skills/a/SKILL.md": skillMd("a"), "skills/ab/SKILL.md": skillMd("ab") },
      "skills/a",
    );
    expect(await readdir(dest)).toEqual(["SKILL.md"]);
  });
  it("extracts the repo root when path is empty", async () => {
    const dest = await extract({ "SKILL.md": skillMd("root") }, "");
    expect(await readdir(dest)).toEqual(["SKILL.md"]);
  });
  it("skips symlinks", async () => {
    const dest = await extract({ "s/SKILL.md": skillMd("s") }, "s", { "s/evil": "/etc/passwd" });
    expect(await readdir(dest)).toEqual(["SKILL.md"]);
  });
  it("fails when the path has no files or the download fails", async () => {
    await expect(extract({ "x/SKILL.md": skillMd("x") }, "nope")).rejects.toThrow(/No files found/);
    await expect(
      downloadSkill({ repo: "o/r", sha: SHA, path: "x" }, await tmpDir(), {
        AISLE_CODELOAD_URL: "http://127.0.0.1:1",
      }),
    ).rejects.toThrow(/Could not download/);
  });
});
