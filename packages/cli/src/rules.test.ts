import path from "node:path";
import { describe, expect, it } from "vitest";
import { rulesFile } from "./agents.js";
import { applyRulesBlock, RULES_END, RULES_START } from "./rules.js";

const RULES = "## Rules\n- Be brief.\n- Run the checks.\n";
const BLOCK = `${RULES_START}\n## Rules\n- Be brief.\n- Run the checks.\n${RULES_END}`;

describe("applyRulesBlock", () => {
  it("creates the file content when there is no file", () => {
    expect(applyRulesBlock(undefined, RULES)).toEqual({ text: `${BLOCK}\n`, action: "created" });
  });

  it("writes just the block into an empty file", () => {
    expect(applyRulesBlock("", RULES)).toEqual({ text: `${BLOCK}\n`, action: "appended" });
  });

  it("appends after a blank line and leaves existing text byte-identical", () => {
    const existing = "# My project\n\nKeep this exactly.\n";
    const { text, action } = applyRulesBlock(existing, RULES);
    expect(action).toBe("appended");
    expect(text).toBe(`${existing}\n${BLOCK}\n`);
    expect(text.startsWith(existing)).toBe(true);
  });

  it("adds the missing newline when the file doesn't end with one", () => {
    expect(applyRulesBlock("no trailing newline", RULES).text).toBe(
      `no trailing newline\n\n${BLOCK}\n`,
    );
  });

  it("replaces an existing block in place and keeps text before and after it", () => {
    const before = "# Top\n\nNotes above.\n\n";
    const after = "\n## Mine\nNotes below, no trailing newline";
    const old = `${RULES_START}\nold rules\n${RULES_END}`;
    const { text, action } = applyRulesBlock(`${before}${old}${after}`, RULES);
    expect(action).toBe("replaced");
    expect(text).toBe(`${before}${BLOCK}${after}`);
  });

  it("is idempotent: a second run changes nothing, byte for byte", () => {
    const first = applyRulesBlock("# Project\n", RULES);
    const second = applyRulesBlock(first.text, RULES);
    expect(second.action).toBe("unchanged");
    expect(second.text).toBe(first.text);
    expect(second.text.split(RULES_START)).toHaveLength(2);
  });

  it("updates only the block when the rules text changes", () => {
    const first = applyRulesBlock("# Project\n", RULES).text;
    const next = applyRulesBlock(first, "## Rules\n- Different.");
    expect(next.action).toBe("replaced");
    expect(next.text).toContain("- Different.");
    expect(next.text).not.toContain("Be brief");
    expect(next.text.startsWith("# Project\n")).toBe(true);
  });

  it("keeps CRLF files CRLF", () => {
    const existing = "# Project\r\n\r\nText\r\n";
    const { text } = applyRulesBlock(existing, RULES);
    expect(text).toBe(`${existing}\r\n${BLOCK.replace(/\n/g, "\r\n")}\r\n`);
    expect(text.replace(/\r\n/g, "")).not.toContain("\n");
    const again = applyRulesBlock(text, RULES);
    expect(again.action).toBe("unchanged");
  });

  it("uses LF for a file with mixed endings that is mostly LF", () => {
    expect(applyRulesBlock("a\nb\nc\r\n", RULES).text.endsWith(`${RULES_END}\n`)).toBe(true);
  });

  it("refuses a damaged file instead of modifying it", () => {
    expect(() => applyRulesBlock(`x\n${RULES_START}\ny\n`, RULES)).toThrow(
      /start marker without a matching end marker/,
    );
    expect(() => applyRulesBlock(`x\n${RULES_END}\n`, RULES)).toThrow(
      /end marker without a matching start marker/,
    );
    expect(() => applyRulesBlock(`${RULES_END}\n${RULES_START}\n`, RULES)).toThrow(/wrong order/);
    const twice = `${BLOCK}\ntext\n${BLOCK}\n`;
    expect(() => applyRulesBlock(twice, RULES)).toThrow(/more than one Agent Aisle rules block/);
  });
});

describe("rulesFile", () => {
  const base = { cwd: path.join("/p"), home: path.join("/h") };
  it("uses CLAUDE.md for Claude Code, in the project or ~/.claude", () => {
    expect(rulesFile({ ...base, agent: "claude-code", global: false })).toBe(
      path.join("/p", "CLAUDE.md"),
    );
    expect(rulesFile({ ...base, agent: "claude-code", global: true })).toBe(
      path.join("/h", ".claude", "CLAUDE.md"),
    );
  });
  it("uses AGENTS.md for Codex and Cursor", () => {
    expect(rulesFile({ ...base, agent: "codex", global: false })).toBe(
      path.join("/p", "AGENTS.md"),
    );
    expect(rulesFile({ ...base, agent: "codex", global: true })).toBe(
      path.join("/h", ".codex", "AGENTS.md"),
    );
    expect(rulesFile({ ...base, agent: "cursor", global: false })).toBe(
      path.join("/p", "AGENTS.md"),
    );
  });
  it("refuses a global Cursor rules file", () => {
    expect(() => rulesFile({ ...base, agent: "cursor", global: true })).toThrow(
      /no user-level rules file/,
    );
  });
});
