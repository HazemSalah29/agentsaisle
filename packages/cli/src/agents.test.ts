import path from "node:path";
import { describe, expect, it } from "vitest";
import { detectAgent, lockfilePath, parseAgent, skillsRoot, targetDir } from "./agents.js";
import { mkdir } from "node:fs/promises";
import { tmpDir } from "./test-utils.js";

describe("agents", () => {
  it("builds project and global paths", () => {
    const base = { agent: "claude-code" as const, cwd: path.join("/p"), home: path.join("/h") };
    expect(targetDir("x", { ...base, global: false })).toBe(
      path.join("/p", ".claude", "skills", "x"),
    );
    expect(targetDir("x", { ...base, global: true })).toBe(
      path.join("/h", ".claude", "skills", "x"),
    );
    expect(skillsRoot({ ...base, agent: "cursor", global: false })).toBe(
      path.join("/p", ".cursor", "skills"),
    );
    expect(lockfilePath({ ...base, global: false })).toBe(path.join("/p", "aisle-lock.json"));
    expect(lockfilePath({ ...base, global: true })).toBe(path.join("/h", "aisle-lock.json"));
  });
  it("detects from marker folders and falls back to claude-code", async () => {
    const dir = await tmpDir();
    expect(detectAgent(dir)).toBe("claude-code");
    await mkdir(path.join(dir, ".cursor"));
    expect(detectAgent(dir)).toBe("cursor");
  });
  it("rejects unknown agents", () => {
    expect(() => parseAgent("vim")).toThrow(/Unknown agent/);
  });
});
