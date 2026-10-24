import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { EXTRACT_LIMITS, downloadSkill, isDevOnly, removeSymlinks } from "./github.js";
import { SHA, makeRawTarball, makeTarball, serveTarball, skillMd, tmpDir } from "./test-utils.js";

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

  it("does not install evals, previews, the README or the include source", async () => {
    const dest = await extract(
      {
        "skills/a/SKILL.md": skillMd("a"),
        "skills/a/SKILL.src.md": "source",
        "skills/a/README.md": "human docs",
        "skills/a/evals/tasks.yaml": "tasks",
        "skills/a/preview/home.png": "png",
        "skills/a/references/guide.md": "keep",
        "skills/a/scripts/check.mjs": "keep",
        "skills/a/assets/kit/Hero.tsx": "keep",
      },
      "skills/a",
    );
    expect((await readdir(dest)).sort()).toEqual(["SKILL.md", "assets", "references", "scripts"]);
    expect(await readFile(path.join(dest, "references", "guide.md"), "utf8")).toBe("keep");
  });

  it("only skips README.md at the skill's top level", async () => {
    const dest = await extract(
      {
        "s/SKILL.md": skillMd("s"),
        "s/README.md": "top",
        "s/references/README.md": "nested",
        "s/assets/preview/x.txt": "nested",
      },
      "s",
    );
    expect(await readdir(dest)).toEqual(
      expect.arrayContaining(["SKILL.md", "references", "assets"]),
    );
    expect(await readdir(dest)).not.toContain("README.md");
    expect(await readFile(path.join(dest, "references", "README.md"), "utf8")).toBe("nested");
    expect(await readFile(path.join(dest, "assets", "preview", "x.txt"), "utf8")).toBe("nested");
  });

  it("applies to a skill at the repository root too", async () => {
    const dest = await extract(
      { "SKILL.md": skillMd("root"), "README.md": "repo readme", "evals/a.yaml": "x" },
      "",
    );
    expect(await readdir(dest)).toEqual(["SKILL.md"]);
  });

  it("fails clearly when excluding dev files leaves nothing", async () => {
    await expect(
      extract({ "x/README.md": "only a readme", "x/evals/a.yaml": "x" }, "x"),
    ).rejects.toThrow(/No files found/);
  });
});

describe("isDevOnly", () => {
  it("matches the dev-only paths and nothing else", () => {
    for (const p of ["evals", "evals/tasks.yaml", "preview/a.png", "README.md", "SKILL.src.md"])
      expect(isDevOnly(p)).toBe(true);
    for (const p of [
      "SKILL.md",
      "references/README.md",
      "assets/preview/a.png",
      "scripts/run.mjs",
      "evalsuite/a.md",
      "README.markdown",
    ]) {
      expect(isDevOnly(p)).toBe(false);
    }
  });
});

describe("downloadSkill hardening", () => {
  const R = "repo-" + SHA + "/";
  const run = async (body: Buffer, skillPath = "s", options = {}) => {
    const server = await serveTarball(body);
    close = server.close;
    const dest = path.join(await tmpDir(), "out");
    await downloadSkill(
      { repo: "o/r", sha: SHA, path: skillPath },
      dest,
      { AISLE_CODELOAD_URL: server.url },
      options,
    );
    return dest;
  };
  const ok = { path: R + "s/SKILL.md", content: skillMd("s") };

  it("accepts a clean hand-built archive", async () => {
    expect(await readdir(await run(await makeRawTarball([ok])))).toEqual(["SKILL.md"]);
  });
  it("rejects absolute paths", async () => {
    await expect(
      run(await makeRawTarball([ok, { path: "/tmp/evil.txt", content: "x" }])),
    ).rejects.toThrow(/absolute path/);
  });
  it("rejects '..' segments", async () => {
    await expect(
      run(await makeRawTarball([ok, { path: R + "s/../../evil.txt", content: "x" }])),
    ).rejects.toThrow(/"\.\."/);
  });
  it("rejects hardlinks", async () => {
    await expect(
      run(
        await makeRawTarball([ok, { path: R + "s/h", type: "Link", linkpath: R + "s/SKILL.md" }]),
      ),
    ).rejects.toThrow(/hardlink/);
  });
  it("ignores entries outside the skill folder", async () => {
    const dest = await run(await makeRawTarball([ok, { path: R + "other/x.txt", content: "x" }]));
    expect(await readdir(dest)).toEqual(["SKILL.md"]);
  });
  it("rejects a file over 2 MB", async () => {
    const big = "x".repeat(EXTRACT_LIMITS.maxFileBytes + 1);
    await expect(
      run(await makeRawTarball([ok, { path: R + "s/big.txt", content: big }])),
    ).rejects.toThrow(/larger than 2 MB/);
  });
  it("rejects more than 2,000 files", async () => {
    const many = Array.from({ length: EXTRACT_LIMITS.maxFiles + 1 }, (_, i) => ({
      path: R + `s/f${i}.txt`,
      content: "x",
    }));
    await expect(run(await makeRawTarball([ok, ...many]))).rejects.toThrow(/more than 2000 files/);
  });
  it("rejects an archive over 20 MB", async () => {
    // Distinct random bytes barely compress, so the gzip stream itself passes the cap.
    const { randomBytes } = await import("node:crypto");
    const files = [
      ok,
      ...Array.from({ length: 24 }, (_, i) => ({
        path: R + `s/n${i}.txt`,
        content: randomBytes(1_400_000).toString("base64").slice(0, 1_900_000),
      })),
    ];
    await expect(run(await makeRawTarball(files))).rejects.toThrow(/larger than 20 MB/);
  });
  it("keeps symlinks only on request, and removeSymlinks strips them", async () => {
    const body = await makeRawTarball([
      ok,
      { path: R + "s/link", type: "SymbolicLink", linkpath: "/etc/hosts" },
    ]);
    expect(await readdir(await run(body))).toEqual(["SKILL.md"]);
    const dest = await run(body, "s", { links: "keep" });
    expect((await readdir(dest)).sort()).toEqual(["SKILL.md", "link"]);
    expect(await removeSymlinks(dest)).toEqual(["link"]);
    expect(await readdir(dest)).toEqual(["SKILL.md"]);
  });
  it("keeps dev-only files with keepAll", async () => {
    const body = await makeRawTarball([ok, { path: R + "s/README.md", content: "hi" }]);
    expect(await readdir(await run(body))).toEqual(["SKILL.md"]);
    expect((await readdir(await run(body, "s", { keepAll: true }))).sort()).toEqual([
      "README.md",
      "SKILL.md",
    ]);
  });
});
