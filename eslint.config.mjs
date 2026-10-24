import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/.next/**",
      "**/node_modules/**",
      "**/next-env.d.ts",
      "demos/*/src/components/kit/**",
      "packages/audit/fixtures/**",
      "registry/official/arabic-rtl/evals/fixture-app/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Skill scripts are plain Node ES modules that run in the user's project.
    files: ["registry/official/**/scripts/**/*.mjs"],
    languageOptions: {
      globals: {
        process: "readonly",
        console: "readonly",
        Buffer: "readonly",
        URL: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        // Used inside page.evaluate(), which runs in the browser.
        window: "readonly",
        document: "readonly",
      },
    },
  },
);
