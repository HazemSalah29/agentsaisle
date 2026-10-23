/** `pnpm skills:build` writes SKILL.md from SKILL.src.md; `pnpm skills:check` fails if any is stale. */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compileAll, IncludeError } from "./compile";

const registryDir = path.dirname(fileURLToPath(import.meta.url));
const check = process.argv.includes("--check");

try {
  const results = await compileAll(
    path.join(registryDir, "official"),
    path.join(registryDir, "_shared"),
    check ? "check" : "write",
  );
  const compiled = results.filter((r) => r.status !== "no-source");
  const stale = results.filter((r) => r.status === "stale");
  for (const r of compiled) console.log(`${r.status.padEnd(10)} ${r.skill}`);
  if (stale.length) {
    console.error(
      `\n${stale.length} generated SKILL.md out of date (${stale.map((s) => s.skill).join(", ")}). Run: pnpm skills:build`,
    );
    process.exit(1);
  }
  console.log(
    compiled.length
      ? `\n${compiled.length} skill(s) use SKILL.src.md.`
      : "No skills use SKILL.src.md yet; nothing to compile.",
  );
} catch (e) {
  if (e instanceof IncludeError) {
    console.error(e.message);
    process.exit(1);
  }
  throw e;
}
