import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node20",
  clean: true,
  // Inline the private workspace package so the published CLI has no unpublished dependency.
  noExternal: ["@agentsaisle/registry-schema"],
  banner: { js: "#!/usr/bin/env node" },
});
