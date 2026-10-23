import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { VERSION, createProgram } from "./program.js";

describe("program", () => {
  it("registers every planned command", () => {
    const names = createProgram().commands.map((c) => c.name());
    expect(names).toEqual(["add", "remove", "list", "init", "info", "search", "update"]);
  });
  it("reports the version from package.json", () => {
    const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
      version: string;
    };
    expect(VERSION).toBe(pkg.version);
    expect(createProgram().version()).toBe(pkg.version);
  });
});
