/** `pnpm lint:skills`: check every official skill against the house standard. */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { lintAll } from "./lint-skills";

const registryDir = path.dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(
  await readFile(path.join(registryDir, "lint-skills.config.json"), "utf8"),
) as { legacy: string[] };

const report = await lintAll(
  path.join(registryDir, "official"),
  path.join(registryDir, "_shared"),
  config.legacy,
);

for (const f of report.findings) {
  const where =
    f.file === "lint-skills.config.json"
      ? `registry/${f.file}`
      : `registry/official/${f.skill}/${f.file}`;
  console.log(`${where}: ${f.rule}: ${f.message}`);
}
if (report.legacy.length) {
  console.log(
    `${report.legacy.length} legacy skill${report.legacy.length === 1 ? "" : "s"} exempt from section and meta rules until Milestone 8 (${report.legacy.join(", ")}). See registry/lint-skills.config.json.`,
  );
}
console.log(
  report.findings.length
    ? `\nChecked ${report.checked.length} skills: ${report.findings.length} problem${report.findings.length === 1 ? "" : "s"}.`
    : `Checked ${report.checked.length} skills: all good.`,
);
process.exit(report.findings.length ? 1 : 0);
