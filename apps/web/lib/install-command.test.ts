import { describe, expect, it } from "vitest";
import { bundleCommand, initCommand, installCommand, manageCommand } from "./install-command";

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
  it("builds the init command", () => {
    expect(initCommand("code")).toBe("npx @agentsaisle/cli init --profile code");
  });
});

describe("manageCommand", () => {
  it("builds add, update and remove for this folder", () => {
    expect(manageCommand("add", "video")).toBe("npx @agentsaisle/cli add video");
    expect(manageCommand("update", "video")).toBe("npx @agentsaisle/cli update video");
    expect(manageCommand("remove", "video")).toBe("npx @agentsaisle/cli remove video");
  });
  it("adds --global for every project", () => {
    expect(manageCommand("remove", "video", true)).toBe(
      "npx @agentsaisle/cli remove video --global",
    );
  });
});
