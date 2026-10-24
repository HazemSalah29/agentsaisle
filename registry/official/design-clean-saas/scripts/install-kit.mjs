#!/usr/bin/env node
// Copies this skill's component kit into the user's project and wires up the design tokens.
// It only copies files and edits text. It never runs the project's code and uses no network.
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/** First-load JavaScript budget (gzip, per route). A Next.js page with this kit measures about 140 kB; the web-performance default is 180. */
export const PERF_BUDGET_KB = 160;
export const KIT_DIR = "src/components/kit";
export const CSS_CANDIDATES = [
  "src/app/globals.css",
  "app/globals.css",
  "src/styles/globals.css",
  "styles/globals.css",
];
export const DESIGN_START = "<!-- design-clean-saas:start -->";
export const DESIGN_END = "<!-- design-clean-saas:end -->";
export const CLAUDE_BLOCK = `${DESIGN_START}
## Design system
This site uses the design-clean-saas kit. Read \`DESIGN.md\` before changing any page or style.
Build pages only from \`src/components/kit/\`. Colors, fonts, spacing and motion come from tokens. Keep it minimal: no gradients, glass or blobs, one accent use per section, icons from lucide-react only. If a component is missing, add one to the kit.
${DESIGN_END}`;

/** Insert or replace the marked block in `text`. Running it twice leaves one block. */
export function upsertBlock(text, block = CLAUDE_BLOCK) {
  const start = text.indexOf(DESIGN_START);
  const end = text.indexOf(DESIGN_END);
  if (start !== -1 && end > start)
    return text.slice(0, start) + block + text.slice(end + DESIGN_END.length);
  const sep = text.length === 0 ? "" : text.endsWith("\n") ? "\n" : "\n\n";
  return `${text}${sep}${block}\n`;
}

/** The import line for tokens.css, relative to the stylesheet that will hold it. */
export function tokensImport(cssFile, cwd = ".") {
  const from = path.dirname(path.join(cwd, cssFile));
  const rel = path
    .relative(from, path.join(cwd, KIT_DIR, "tokens.css"))
    .split(path.sep)
    .join("/");
  return `@import "${rel.startsWith(".") ? rel : "./" + rel}";`;
}

/** Add the tokens import after `@import "tailwindcss"`. Returns the new text, or null if it cannot. */
export function addTokensImport(css, line) {
  if (css.includes("components/kit/tokens.css")) return css; // already there
  const m = /^@import\s+["']tailwindcss["'][^;]*;[ \t]*$/m.exec(css);
  if (!m) return null;
  const at = m.index + m[0].length;
  return `${css.slice(0, at)}\n${line}${css.slice(at)}`;
}

function listFiles(dir, base = dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) listFiles(full, base, out);
    else out.push(path.relative(base, full));
  }
  return out.sort();
}

/** Copy the kit. Files the user edited are kept unless `force`. Returns a result per file. */
export function copyKit(from, to, { force = false, dryRun = false } = {}) {
  const results = [];
  for (const rel of listFiles(from)) {
    const src = path.join(from, rel);
    const dest = path.join(to, rel);
    if (existsSync(dest)) {
      if (readFileSync(dest, "utf8") === readFileSync(src, "utf8")) {
        results.push({ rel, status: "unchanged" });
        continue;
      }
      if (!force) {
        results.push({ rel, status: "kept" }); // edited by the user
        continue;
      }
    }
    if (!dryRun) {
      mkdirSync(path.dirname(dest), { recursive: true });
      copyFileSync(src, dest);
    }
    results.push({ rel, status: dryRun ? "would write" : "written" });
  }
  return results;
}

export function parseArgs(argv) {
  const get = (flag) => (argv.includes(flag) ? argv[argv.indexOf(flag) + 1] : undefined);
  return {
    cwd: path.resolve(get("--cwd") ?? process.cwd()),
    force: argv.includes("--force"),
    dryRun: argv.includes("--dry-run"),
  };
}

function main(argv) {
  const { cwd, force, dryRun } = parseArgs(argv);
  const skillDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const lines = [];

  const results = copyKit(path.join(skillDir, "assets", "kit"), path.join(cwd, KIT_DIR), {
    force,
    dryRun,
  });
  const count = (s) => results.filter((r) => r.status === s).length;
  lines.push(`install-kit: ${KIT_DIR}/ (${results.length} files)`);
  lines.push(
    `  written ${count("written") + count("would write")}, unchanged ${count("unchanged")}, kept your edits ${count("kept")}`,
  );
  for (const r of results.filter((x) => x.status === "kept"))
    lines.push(`  kept ${r.rel} (differs from the kit; use --force to overwrite)`);

  // DESIGN.md at the project root
  const designTo = path.join(cwd, "DESIGN.md");
  if (existsSync(designTo) && !force) lines.push("  DESIGN.md already exists, left as is");
  else {
    if (!dryRun) copyFileSync(path.join(skillDir, "assets", "DESIGN.md"), designTo);
    lines.push("  wrote DESIGN.md");
  }

  // pointer block in CLAUDE.md, so the rules apply in later sessions
  const claudeFile = path.join(cwd, "CLAUDE.md");
  const before = existsSync(claudeFile) ? readFileSync(claudeFile, "utf8") : "";
  const after = upsertBlock(before);
  if (after !== before) {
    if (!dryRun) writeFileSync(claudeFile, after);
    lines.push("  updated CLAUDE.md (design system pointer)");
  }

  // tokens.css into the global stylesheet
  const css = CSS_CANDIDATES.find((f) => existsSync(path.join(cwd, f)));
  if (css) {
    const text = readFileSync(path.join(cwd, css), "utf8");
    const next = addTokensImport(text, tokensImport(css, cwd));
    if (next === null) lines.push(`  add this to ${css} yourself: ${tokensImport(css, cwd)}`);
    else if (next !== text) {
      if (!dryRun) writeFileSync(path.join(cwd, css), next);
      lines.push(`  added the tokens import to ${css}`);
    }
  } else {
    lines.push(
      `  no global stylesheet found. In yours, after @import "tailwindcss", add: ${tokensImport("src/app/globals.css", cwd)}`,
    );
  }

  // A minimal site should stay small, so give it a tighter budget than the web-performance default.
  const perfFile = path.join(cwd, "perf.config.json");
  if (!existsSync(perfFile)) {
    if (!dryRun)
      writeFileSync(perfFile, `${JSON.stringify({ budgetKb: PERF_BUDGET_KB }, null, 2)}\n`);
    lines.push(
      `  wrote perf.config.json (budgetKb ${PERF_BUDGET_KB}, for the web-performance check)`,
    );
  }

  // dependencies: tell, don't install
  const pkgFile = path.join(cwd, "package.json");
  if (existsSync(pkgFile)) {
    const pkg = JSON.parse(readFileSync(pkgFile, "utf8"));
    const have = { ...pkg.dependencies, ...pkg.devDependencies };
    const missing = ["lucide-react"].filter((d) => !have[d]);
    if (missing.length) lines.push(`  install these packages: ${missing.join(" ")}`);
  }
  console.log(lines.slice(0, 40).join("\n"));
}

// realpathSync: a script reached through a symlinked folder must still count as the entry point.
if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href)
  main(process.argv.slice(2));
