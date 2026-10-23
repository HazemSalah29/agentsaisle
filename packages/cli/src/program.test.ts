import { describe, expect, it } from "vitest";
import { VERSION, createProgram } from "./program.js";

describe("program", () => {
  it("registers every planned command", () => {
    const names = createProgram().commands.map((c) => c.name());
    expect(names).toEqual(["add", "remove", "list", "info", "search", "update", "init"]);
  });
  it("exposes the version", () => {
    expect(createProgram().version()).toBe(VERSION);
  });
});
