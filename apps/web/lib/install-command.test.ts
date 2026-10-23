import { describe, expect, it } from "vitest";
import { bundleCommand, installCommand } from "./install-command";

describe("installCommand", () => {
  it("omits the version for latest or none", () => {
    expect(installCommand("explore")).toBe("npx @agentsaisle/cli add explore");
    expect(installCommand("explore", "1.2.0", "1.2.0")).toBe("npx @agentsaisle/cli add explore");
  });
  it("pins older versions", () => {
    expect(installCommand("explore", "1.0.0", "1.2.0")).toBe(
      "npx @agentsaisle/cli add explore@1.0.0",
    );
  });
  it("joins bundles", () => {
    expect(bundleCommand(["plan", "explore"])).toBe("npx @agentsaisle/cli add plan explore");
  });
});
