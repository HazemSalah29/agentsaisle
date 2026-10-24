import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { readFileSync } from "node:fs";
import path from "node:path";
import { ElsewhereFile, type ElsewhereEntry } from "@agentsaisle/registry-schema";
import {
  checkEntry,
  frontmatterLicense,
  validateElsewhere,
  type TextFetcher,
} from "./validate-elsewhere";

const entry: ElsewhereEntry = {
  name: "x",
  author: "a",
  repo: "o/r",
  path: "skills/x",
  description: "d",
  license: "MIT",
  aisle: "testing",
};
const SKILL = "---\nname: x\ndescription: d\n---\n# x\n";
const files =
  (map: Record<string, string>): TextFetcher =>
  async (url) =>
    map[url.replace("https://raw.githubusercontent.com/o/r/HEAD/", "")];

describe("validate-elsewhere", () => {
  it("reads a license from frontmatter", () => {
    expect(frontmatterLicense("---\nname: x\nlicense: MIT\n---\n")).toBe("MIT");
    expect(frontmatterLicense(SKILL)).toBeUndefined();
    expect(frontmatterLicense("no frontmatter")).toBeUndefined();
  });

  it("passes with a license in the frontmatter, in the skill folder, or at the repo root", async () => {
    expect(
      await checkEntry(entry, files({ "skills/x/SKILL.md": "---\nname: x\nlicense: MIT\n---\n" })),
    ).toEqual([]);
    expect(
      await checkEntry(
        entry,
        files({ "skills/x/SKILL.md": SKILL, "skills/x/LICENSE.txt": "Apache" }),
      ),
    ).toEqual([]);
    expect(await checkEntry(entry, files({ "skills/x/SKILL.md": SKILL, LICENSE: "MIT" }))).toEqual(
      [],
    );
  });

  it("reports a missing SKILL.md and a missing license", async () => {
    expect(await checkEntry(entry, files({}))).toEqual(["no SKILL.md at o/r/skills/x"]);
    expect((await checkEntry(entry, files({ "skills/x/SKILL.md": SKILL })))[0]).toMatch(
      /no license found/,
    );
  });

  it("reports a SKILL.md without frontmatter", async () => {
    const r = await checkEntry(entry, files({ "skills/x/SKILL.md": "# x", LICENSE: "MIT" }));
    expect(r).toEqual(["SKILL.md has no frontmatter"]);
  });

  it("looks at the repo root when the path is empty", async () => {
    const root = { ...entry, path: "" };
    expect(await checkEntry(root, files({ "SKILL.md": SKILL, LICENSE: "MIT" }))).toEqual([]);
  });

  it("collects problems across entries with a readable name", async () => {
    const problems = await validateElsewhere(
      [entry, { ...entry, name: "y", path: "skills/y" }],
      files({ "skills/x/SKILL.md": SKILL, LICENSE: "MIT" }),
    );
    expect(problems).toEqual([
      { entry: "o/r/skills/y (y)", message: "no SKILL.md at o/r/skills/y" },
    ]);
  });

  it("the committed elsewhere.yaml parses, lists real aisles and avoids copying other text", () => {
    const data = ElsewhereFile.parse(
      parse(readFileSync(path.join(__dirname, "elsewhere.yaml"), "utf8")),
    );
    const aisles = (
      parse(readFileSync(path.join(__dirname, "aisles.yaml"), "utf8")) as {
        aisles: Array<{ id: string }>;
      }
    ).aisles.map((a) => a.id);
    expect(data.entries.length).toBeGreaterThan(5);
    for (const e of data.entries) {
      expect(aisles, e.name).toContain(e.aisle);
      expect(e.description.length, e.name).toBeLessThanOrEqual(100); // one short line of our own
    }
    // Repos checked and dropped for having no license; they must not come back without one.
    expect(data.entries.map((e) => e.repo)).not.toContain("remotion-dev/skills");
    expect(data.entries.find((e) => e.name === "web-design-guidelines")).toBeUndefined();
  });
});
