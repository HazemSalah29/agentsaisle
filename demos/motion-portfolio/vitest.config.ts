import { defineConfig } from "vitest/config";

export default defineConfig({
  // Next keeps jsx "preserve" for its own compiler; tests need real JSX transforms.
  oxc: { jsx: { runtime: "automatic" } },
  test: { include: ["kit-tests/**/*.test.{ts,tsx}"] },
});
