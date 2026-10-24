import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // The end-to-end tests start the CLI as a child process through tsx, which takes seconds on a
    // slow CI machine. The default 5 s limit made them flaky.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
