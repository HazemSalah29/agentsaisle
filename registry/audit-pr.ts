/**
 * CI entry point: audit the community entries a pull request adds or changes, at their pinned
 * commit, and write a markdown report for a PR comment.
 *
 * Fails (exit 1) when any skill has an unsuppressed critical finding or cannot be audited.
 * Outputs (OUTPUT_DIR, default registry/.audit-out): audit-report.md and audit-pr.json with the PR
 * number. The comment itself is posted by a separate workflow (comment-audit.yml), because a
 * pull request from a fork gets a read-only token here.
 * Safety: skills are only downloaded as text and read. Nothing in them is executed.
 */
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { formatMarkdown } from "@agentsaisle/audit";
import { CommunityEntry, compareSemver, type AuditReport } from "@agentsaisle/registry-schema";
import { parse as parseYaml } from "yaml";
import { createAuditor, type Downloader } from "./audits";
import { esc, repoRoot, selectCommunityFiles } from "./pr-files";

/** Hidden marker the comment workflow uses to find and update its own comment. */
export const MARKER = "<!-- aisle-audit -->";
/** GitHub rejects comments over 65,536 characters. */
const MAX_COMMENT = 60_000;

export interface EntryResult {
  file: string;
  name: string;
  /** Present when the skill was audited. */
  report?: AuditReport;
  /** Present when it could not be (invalid entry, download failed). */
  problem?: string;
}

/** Audit each community entry file at its latest pinned version. */
export async function auditEntries(
  files: Array<{ file: string; text: string }>,
  opts: { rootDir: string; download?: Downloader; now?: Date; cacheDir?: string },
): Promise<EntryResult[]> {
  const out: EntryResult[] = [];
  for (const { file, text } of files) {
    const base = path.basename(file, ".yaml");
    let entry: CommunityEntry;
    try {
      entry = CommunityEntry.parse(parseYaml(text));
    } catch {
      out.push({
        file,
        name: base,
        problem: "The entry is not valid; fix the registry check first.",
      });
      continue;
    }
    const versions = [...entry.versions].sort((a, b) => compareSemver(b.version, a.version));
    const latest = versions[0]!;
    const warnings: string[] = [];
    const audit = createAuditor({
      rootDir: opts.rootDir,
      cacheDir: opts.cacheDir,
      download: opts.download,
      now: opts.now,
      warn: (m) => warnings.push(m),
    });
    const report = await audit({
      name: entry.name,
      description: "",
      source: "community",
      author: entry.author,
      repo: entry.repo,
      path: entry.path,
      latest: latest.version,
      versions: versions.map(({ version, sha }) => ({ version, sha })),
      category: entry.category,
      clients: entry.clients,
      runsScripts: entry.runs_scripts,
      verified: false,
    });
    out.push(
      report
        ? { file, name: entry.name, report }
        : { file, name: entry.name, problem: warnings[0] ?? "The skill could not be audited." },
    );
  }
  return out;
}

export const failed = (results: EntryResult[]) =>
  results.some((r) => r.problem || (r.report?.counts.critical ?? 0) > 0);

/** The PR comment: a verdict line, then one report per skill. */
export function renderComment(results: EntryResult[]): string {
  const bad = results.filter((r) => r.problem || (r.report?.counts.critical ?? 0) > 0);
  const lines = [MARKER, "## Agent Aisle audit", ""];
  if (results.length === 0) lines.push("No community entries changed.");
  else if (bad.length > 0)
    lines.push(
      `**This pull request cannot be merged yet.** ${bad.length} of ${results.length} skill${results.length === 1 ? "" : "s"} ${bad.length === 1 ? "has" : "have"} a critical finding or could not be audited. Critical findings cannot be suppressed by the author.`,
    );
  else
    lines.push(
      `Audited ${results.length} skill${results.length === 1 ? "" : "s"} at the pinned commit. No critical findings.`,
    );
  lines.push("");
  for (const r of results) {
    if (r.report) lines.push(formatMarkdown(r.report), "");
    else lines.push(`### ${r.name}`, "", `Could not audit: ${r.problem}`, "");
  }
  lines.push(
    "_The audit reads the skill as text and never runs it. It reduces risk and is not a guarantee of safety. [How audits work](https://agentsaisle-vercel.vercel.app/audit)_",
  );
  let text = lines.join("\n");
  if (text.length > MAX_COMMENT)
    text = `${text.slice(0, MAX_COMMENT - 200)}\n\n_Report shortened. Run \`aisle audit <owner>/<repo>/<path>@<sha>\` for the full list._\n`;
  return text;
}

function prNumber(): number | undefined {
  const file = process.env.GITHUB_EVENT_PATH;
  if (!file || !existsSync(file)) return undefined;
  try {
    const n = (JSON.parse(readFileSync(file, "utf8")) as { pull_request?: { number?: unknown } })
      .pull_request?.number;
    return typeof n === "number" && Number.isInteger(n) && n > 0 ? n : undefined;
  } catch {
    return undefined;
  }
}

async function main(): Promise<number> {
  const files = await selectCommunityFiles(process.argv.slice(2));
  if (files.length === 0) {
    console.log("No community registry entries changed. Nothing to audit.");
    return 0; // no report, so no comment
  }
  const entries = [];
  for (const f of files) {
    const abs = path.join(repoRoot, f);
    if (existsSync(abs)) entries.push({ file: f, text: await readFile(abs, "utf8") });
  }
  const registryDir = path.dirname(fileURLToPath(import.meta.url));
  const results = await auditEntries(entries, { rootDir: registryDir });

  for (const r of results) {
    if (r.problem)
      console.log(
        `::error file=${esc(r.file, true)},title=${esc("Audit", true)}::${esc(r.problem)}`,
      );
    for (const f of r.report?.findings ?? []) {
      if (f.severity !== "critical" || f.suppressed) continue;
      console.log(
        `::error file=${esc(r.file, true)},title=${esc(`Audit ${f.rule}`, true)}::${esc(`${f.title} (${f.file}${f.line ? ":" + f.line : ""})`)}`,
      );
    }
    console.log(
      r.report
        ? `${r.name}@${r.report.version}: grade ${r.report.grade} (${r.report.counts.critical} critical, ${r.report.counts.high} high, ${r.report.counts.medium} medium)`
        : `${r.name}: ${r.problem}`,
    );
  }

  const comment = renderComment(results);
  const outDir = process.env.OUTPUT_DIR ?? path.join(registryDir, ".audit-out");
  await mkdir(outDir, { recursive: true });
  await writeFile(path.join(outDir, "audit-report.md"), comment);
  await writeFile(
    path.join(outDir, "audit-pr.json"),
    JSON.stringify({
      pr: prNumber() ?? null,
      failed: failed(results),
      skills: results.map((r) => r.name),
    }),
  );
  if (process.env.GITHUB_STEP_SUMMARY)
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, comment + "\n");
  return failed(results) ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then(
    (code) => process.exit(code),
    (e) => {
      console.error(e instanceof Error ? e.message : e);
      process.exit(1);
    },
  );
}
