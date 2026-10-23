import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { compileAll, compileSkill, expandIncludes, IncludeError } from "./compile";

const fragments: Record<string, string> = {
  "_shared/budget.md": "\n- Read line ranges.\n- Max 8 files.\n\n",
  "_shared/nested.md": "- see <!-- include: _shared/budget.md -->",
};
const read = (p: string) => fragments[p];

describe("expandIncludes", () => {
  it("replaces a full-line marker with the trimmed fragment and leaves other lines alone", () => {
    const out = expandIncludes("## Budget\n<!-- include: _shared/budget.md -->\n## Output\n", read);
    expect(out).toBe("## Budget\n- Read line ranges.\n- Max 8 files.\n## Output\n");
  });
  it("allows spacing inside the marker and expands the same fragment twice", () => {
    const out = expandIncludes(
      "<!--include:   _shared/budget.md   -->\nx\n<!-- include: _shared/budget.md -->",
      read,
    );
    expect(out.match(/Max 8 files/g)).toHaveLength(2);
  });
  it("normalizes CRLF input to LF and ends with one newline", () => {
    expect(expandIncludes("a\r\nb", read)).toBe("a\nb\n");
  });
  it("passes text with no markers through unchanged", () => {
    expect(expandIncludes("# Title\n\nBody\n", read)).toBe("# Title\n\nBody\n");
  });
  it("names the file and line for an unknown fragment", () => {
    expect(() =>
      expandIncludes("ok\n<!-- include: _shared/missing.md -->", read, "plan/SKILL.src.md"),
    ).toThrow(/plan\/SKILL\.src\.md:2: unknown fragment "_shared\/missing\.md"/);
  });
  it("rejects a marker that shares its line with other text", () => {
    expect(() => expandIncludes("text <!-- include: _shared/budget.md -->", read)).toThrow(
      /must be alone on its line/,
    );
  });
  it("rejects paths outside _shared", () => {
    for (const bad of [
      "../secret.md",
      "_shared/../x.md",
      "references/a.md",
      "_shared/sub/a.md",
      "_shared/a.txt",
    ]) {
      expect(() => expandIncludes(`<!-- include: ${bad} -->`, read)).toThrow(IncludeError);
    }
  });
  it("rejects nested includes", () => {
    expect(() => expandIncludes("<!-- include: _shared/nested.md -->", read)).toThrow(
      /can't be nested/,
    );
  });
});

describe("compileSkill and compileAll", () => {
  let official: string;
  let shared: string;

  beforeEach(async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "aisle-compile-"));
    official = path.join(root, "official");
    shared = path.join(root, "_shared");
    await mkdir(shared, { recursive: true });
    await writeFile(path.join(shared, "budget.md"), "- Read line ranges.\n");
  });

  async function skill(name: string, files: Record<string, string>) {
    const dir = path.join(official, name);
    await mkdir(dir, { recursive: true });
    for (const [f, text] of Object.entries(files)) await writeFile(path.join(dir, f), text);
    return dir;
  }

  it("writes SKILL.md from SKILL.src.md, then reports it up to date and byte-identical on rebuild", async () => {
    const dir = await skill("a", { "SKILL.src.md": "# A\n<!-- include: _shared/budget.md -->\n" });
    expect(await compileSkill(dir, shared, "write")).toEqual({ skill: "a", status: "written" });
    const first = await readFile(path.join(dir, "SKILL.md"), "utf8");
    expect(first).toBe("# A\n- Read line ranges.\n");
    expect(await compileSkill(dir, shared, "write")).toEqual({ skill: "a", status: "up-to-date" });
    expect(await readFile(path.join(dir, "SKILL.md"), "utf8")).toBe(first);
  });

  it("check mode reports stale without writing, for a missing or a changed SKILL.md", async () => {
    const dir = await skill("a", { "SKILL.src.md": "# A\n<!-- include: _shared/budget.md -->\n" });
    expect(await compileSkill(dir, shared, "check")).toEqual({ skill: "a", status: "stale" });
    await writeFile(path.join(dir, "SKILL.md"), "# A\nedited by hand\n");
    expect(await compileSkill(dir, shared, "check")).toEqual({ skill: "a", status: "stale" });
    expect(await readFile(path.join(dir, "SKILL.md"), "utf8")).toBe("# A\nedited by hand\n");
  });

  it("goes stale when a shared fragment changes", async () => {
    const dir = await skill("a", { "SKILL.src.md": "<!-- include: _shared/budget.md -->\n" });
    await compileSkill(dir, shared, "write");
    await writeFile(path.join(shared, "budget.md"), "- A different rule.\n");
    expect((await compileSkill(dir, shared, "check")).status).toBe("stale");
  });

  it("leaves skills without a SKILL.src.md completely untouched", async () => {
    const dir = await skill("legacy", { "SKILL.md": "# Legacy\r\nkeeps CRLF\r\n" });
    expect(await compileSkill(dir, shared, "write")).toEqual({
      skill: "legacy",
      status: "no-source",
    });
    expect(await readFile(path.join(dir, "SKILL.md"), "utf8")).toBe("# Legacy\r\nkeeps CRLF\r\n");
  });

  it("compiles every skill folder in name order", async () => {
    await skill("b", { "SKILL.src.md": "x\n" });
    await skill("a", { "SKILL.md": "y\n" });
    const results = await compileAll(official, shared, "write");
    expect(results).toEqual([
      { skill: "a", status: "no-source" },
      { skill: "b", status: "written" },
    ]);
  });
});
