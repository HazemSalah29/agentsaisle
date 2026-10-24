// Prints a Markdown status report from a JSON file of { title, status } tasks.
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const file = process.argv[2] ?? "tasks.json";
const tasks = JSON.parse(readFileSync(file, "utf8"));
const groups = { done: [], "in-progress": [], blocked: [] };
for (const t of tasks) (groups[t.status] ?? groups.blocked).push(t.title);

const branch = execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
  encoding: "utf8",
}).trim();
console.log(`# Status report (${branch})\n`);
for (const [status, titles] of Object.entries(groups)) {
  console.log(`## ${status}`);
  for (const title of titles) console.log(`- ${title}`);
}
