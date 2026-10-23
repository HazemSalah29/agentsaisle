/**
 * CI entry point: validate the community entries a pull request adds or changes.
 *
 * Files come from, in order: command-line arguments, the CHANGED_FILES env var, or a git diff
 * against BASE_REF (default origin/main). With none changed it exits 0.
 * Maintainers set ALLOW_VERIFIED=1 to permit `verified: true`.
 */
import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createGitHubApi, validateEntryFile, type Finding } from "./validate";

const registryDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.dirname(registryDir);
const COMMUNITY = "registry/community";

const esc = (s: string, prop = false) => {
  const base = s.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
  return prop ? base.replace(/:/g, "%3A").replace(/,/g, "%2C") : base;
};

function changedFiles(args: string[]): string[] {
  if (args.length) return args;
  if (process.env.CHANGED_FILES?.trim()) return process.env.CHANGED_FILES.trim().split(/\s+/);
  const base = process.env.BASE_REF ?? "origin/main";
  try {
    return execFileSync(
      "git",
      ["diff", "--name-only", "--diff-filter=ACMR", `${base}...HEAD`, "--", COMMUNITY],
      {
        cwd: repoRoot,
        encoding: "utf8",
      },
    )
      .split("\n")
      .filter(Boolean);
  } catch {
    console.warn(`Could not diff against ${base}; checking every community entry instead.`);
    return [];
  }
}

async function allCommunityFiles(): Promise<string[]> {
  const dir = path.join(registryDir, "community");
  return (await readdir(dir).catch(() => [] as string[])).map((f) => `${COMMUNITY}/${f}`);
}

async function main() {
  let files = changedFiles(process.argv.slice(2))
    .map((f) => path.relative(repoRoot, path.resolve(repoRoot, f)).split(path.sep).join("/"))
    .filter((f) => f.startsWith(`${COMMUNITY}/`));
  if (
    files.length === 0 &&
    process.argv.length <= 2 &&
    !process.env.CHANGED_FILES &&
    !process.env.GITHUB_ACTIONS
  ) {
    files = await allCommunityFiles();
  }
  if (files.length === 0) {
    console.log("No community registry entries changed. Nothing to check.");
    return 0;
  }

  const official = (
    await readdir(path.join(registryDir, "official"), { withFileTypes: true }).catch(() => [])
  )
    .filter((e) => e.isDirectory())
    .map((e) => e.name);
  const community = (await allCommunityFiles()).map((f) => path.basename(f, ".yaml"));
  const github = createGitHubApi();

  const all: Finding[] = [];
  for (const file of files) {
    const abs = path.join(repoRoot, file);
    if (!existsSync(abs)) continue;
    const own = path.basename(file, ".yaml");
    const takenNames = new Set([...official, ...community.filter((n) => n !== own)]);
    all.push(
      ...(await validateEntryFile(file, await readFile(abs, "utf8"), {
        github,
        takenNames,
        allowVerified: process.env.ALLOW_VERIFIED === "1",
      })),
    );
  }

  for (const f of all) {
    console.log(
      `::${f.level} file=${esc(f.file, true)},title=${esc("Registry check", true)}::${esc(f.message)}`,
    );
    console.log(`${f.level.toUpperCase().padEnd(7)} ${f.file}: ${f.message}`);
  }
  const errors = all.filter((f) => f.level === "error");

  if (process.env.GITHUB_STEP_SUMMARY) {
    const lines = [
      `## Registry check: ${errors.length ? "failed" : "passed"}`,
      "",
      `Checked ${files.length} file${files.length === 1 ? "" : "s"}: ${files.map((f) => `\`${path.basename(f)}\``).join(", ")}.`,
      "",
      ...(all.length
        ? [
            "| Level | File | Message |",
            "| --- | --- | --- |",
            ...all.map(
              (f) =>
                `| ${f.level} | \`${path.basename(f.file)}\` | ${f.message.replace(/\|/g, "\\|")} |`,
            ),
          ]
        : ["No problems found."]),
      "",
    ];
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join("\n"));
  }

  console.log(
    errors.length
      ? `\n${errors.length} problem(s) to fix.`
      : `\nChecked ${files.length} entr${files.length === 1 ? "y" : "ies"}: all good.`,
  );
  return errors.length ? 1 : 0;
}

main().then(
  (code) => process.exit(code),
  (e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  },
);
