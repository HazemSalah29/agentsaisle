/**
 * CI entry point: validate the community entries a pull request adds or changes.
 *
 * Files come from, in order: command-line arguments, the CHANGED_FILES env var, or a git diff
 * against BASE_REF (default origin/main). With none changed it exits 0.
 * Maintainers set ALLOW_VERIFIED=1 to permit `verified: true`.
 */
import { appendFileSync, existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { allCommunityFiles, esc, registryDir, repoRoot, selectCommunityFiles } from "./pr-files";
import { createGitHubApi, validateEntryFile, type Finding } from "./validate";

async function main() {
  const files = await selectCommunityFiles(process.argv.slice(2));
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
